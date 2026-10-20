'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Locale } from '@/content/projects';
import { paths, site } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';
import { SEQ } from '@/lib/renders/manifest';
import { prefetchSequence } from '@/lib/renders/registry';
import { isCoarsePointer, prefersReducedMotion, scrollToEl, scrollToY } from '@/lib/scroll';
import { introOrigin, introRemaining } from '@/lib/intro';
import { stage } from '@/lib/stage';
import { useSequence } from '@/lib/useSequence';
import { RenderArt } from '../ui/RenderArt';
import { IconEmail, SOCIAL_ICONS } from '../ui/SocialIcons';
import PlanBackdrop from './PlanBackdrop';
import { layoutWindowHero, SIDE_TRACKING, SIDE_WORD, type WindowLayout } from './windowHero';

gsap.registerPlugin(ScrollTrigger);

export type CityItem = { slug: string; name: string; kind: string; year: number; cardArt: number; cityIndex: number };

// Scroll choreography, as fractions of the intro's scroll length (from the prototype's scene timings)
const T = {
  frames: [0.03, 0.5] as const,   // camera: hero → city
  open: [0.05, 0.5] as const,     // the circular window opens to full screen
  split: [0.03, 0.36] as const,   // headline splits and flies past the camera
  footer: [0.03, 0.2] as const,
  bar: [0.54, 0.62] as const,
  cards: 0.53,
  hold: 0.82,                     // where "Proyectos" lands: the settled city
};
// card offsets from each roof, in frame px (desktop renders), from the prototype
const CARD_OFF: [number, number][] = [[200, 110], [-110, -40], [-170, 50], [-200, 60], [170, 60], [60, -50]];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, [a, b]: readonly [number, number]) => clamp((p - a) / (b - a));
const inOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const inCubic = (t: number) => t * t * t;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

type Props = { lang: Locale; t: Pick<Dictionary, 'hero' | 'city'>; items: CityItem[] };

/** Hero lettering: 'window' = the O is the window, ESTUDIO vertical (default); 'split' = original. Preview with ?hero=split */
type HeroVariant = 'window' | 'split';
const noSubscribe = () => () => { };
// Guard: `location` must not be accessed at module scope in Next.js 16 (triggers "URL data during prerendering").
// useSyncExternalStore already provides 'window' as the server snapshot; this only runs client-side.
const readVariant = (): HeroVariant =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hero') === 'split'
    ? 'split'
    : 'window';

export default function HomeExperience({ lang, t, items }: Props) {
  const router = useRouter();
  const city = useSequence(SEQ.city);
  const portrait = city?.tier === 'm';
  const variant = useSyncExternalStore(noSubscribe, readVariant, (): HeroVariant => 'window');

  const intro = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const headOuter = useRef<HTMLDivElement>(null);
  const headInner = useRef<HTMLDivElement>(null);
  const oWrap = useRef<HTMLDivElement>(null);
  const plans = useRef<HTMLDivElement>(null);
  const oRing = useRef<SVGCircleElement>(null);
  const oH = useRef<SVGTextElement>(null);
  const oStudio = useRef<SVGTextElement>(null);
  const win = useRef<WindowLayout | null>(null);
  const footer = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const pins = useRef<(HTMLElement | null)[]>([]);

  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const progress = useRef(0);
  const enter = useRef({ r: 0 }); // load-in of the circular window
  const origin = useRef({ x: 0, y: 0 });
  const roofs = useRef<[number, number][]>([]);
  const updateRef = useRef<(p: number) => void>(() => { });

  // the drawing layer: a hole where the window is, drifts toward the camera and fades during the fly-through
  const setPlans = (cx: number, cy: number, r: number, z: number) => {
    const el = plans.current;
    if (!el) return;
    const o = 1 - clamp(z / 0.55);
    el.style.visibility = o > 0 ? '' : 'hidden';
    if (o <= 0) return;
    el.style.opacity = String(o);
    const m = `radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, transparent ${(r + 6).toFixed(1)}px, #000 ${(r + 60).toFixed(1)}px)`;
    el.style.maskImage = m;
    el.style.webkitMaskImage = m;
    el.style.transformOrigin = `${cx}px ${cy}px`;
    el.style.transform = z > 0 ? `scale(${1 + 0.6 * z})` : '';
  };

  // ---- per-frame update: styles only, no React state ----
  const update = useCallback((p: number) => {
    progress.current = p;
    if (!city) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const reduced = prefersReducedMotion();
    const q = reduced ? (p > 0.15 ? 1 : 0) : p;

    stage.setFrame(seg(q, T.frames) * (city.seq.count - 1));
    const z = inOutSine(seg(q, T.open));
    if (variant === 'window') {
      // the camera flies through the O: everything scales around its centre until the counter fills the screen
      const L = win.current;
      if (L) {
        const e = enter.current.r;
        const sc = reduced ? 1 : Math.pow(L.rMax / L.rc, z);
        stage.setClip(z >= 1 ? null : L.rc * e * sc, L.ox, L.oy);
        stage.setTint(0.3 * (1 - z));
        const gone = reduced ? q >= 1 : z > 0.985;
        if (head.current) head.current.style.visibility = gone ? 'hidden' : '';
        if (oWrap.current) oWrap.current.style.transform = sc === 1 ? '' : `scale(${sc})`;
        oRing.current?.setAttribute('transform', `translate(${L.ox} ${L.oy}) scale(${e}) translate(${-L.ox} ${-L.oy})`);
        setPlans(L.ox, L.oy, L.R * e * sc, z);
      }
    } else {
      const r0 = (portrait ? 0.42 * vw : 0.243 * vh) * enter.current.r;
      const rMax = Math.hypot(vw, vh) / 2 + 4;
      const r = r0 + (rMax - r0) * z;
      stage.setClip(z >= 1 ? null : r);
      stage.setTint(0.3 * (1 - z));
      setPlans(vw / 2, vh / 2, r, z);

      // headline: off-white inside the window, graphite outside; scales from the word gap
      const split = reduced ? 0 : inCubic(seg(q, T.split));
      const gone = reduced ? q >= 1 : split > 0.985;
      const sc = Math.pow(24, split);
      const hole = `path(evenodd, 'M0 0H${vw}V${vh}H0Z M${vw / 2 - r} ${vh / 2}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z')`;
      if (head.current) head.current.style.visibility = gone ? 'hidden' : '';
      if (!gone && headOuter.current && headInner.current) {
        headOuter.current.style.clipPath = hole;
        headInner.current.style.clipPath = `circle(${r.toFixed(1)}px at 50% 50%)`;
        const tf = sc === 1 ? '' : `scale(${sc})`;
        for (const el of head.current!.querySelectorAll<HTMLElement>('[data-words]')) {
          el.style.transform = tf;
          el.style.transformOrigin = `${origin.current.x}px ${origin.current.y}px`;
        }
      }
    }
    if (footer.current) {
      const f = inOutCubic(seg(q, T.footer));
      footer.current.style.transform = f ? `translate3d(0, ${f * 40}vh, 0)` : '';
      footer.current.style.opacity = String(1 - f);
    }

    // city overlay
    const barT = inOutCubic(seg(q, T.bar));
    if (bar.current) {
      bar.current.style.transform = `translate3d(0, ${(1 - barT) * 110}%, 0)`;
      bar.current.style.visibility = barT > 0 ? '' : 'hidden';
    }
    if (hint.current) hint.current.style.opacity = String(barT);
    if (overlay.current) overlay.current.style.pointerEvents = q > T.bar[1] ? '' : 'none';
    const R = roofs.current;
    if (!R.length) return;
    const f = stage.screenScale;
    const act = activeRef.current;
    items.forEach((_, i) => {
      const show = reduced ? (q >= 1 ? 1 : 0) : outBack(seg(q, [T.cards + i * 0.025, T.cards + 0.07 + i * 0.025]));
      const [rx, ry] = R[i];
      if (portrait) {
        const pin = pins.current[i];
        if (pin) pin.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -100%) scale(${show})`;
        return;
      }
      const [ox, oy] = CARD_OFF[i];
      const w = Math.min(250, Math.max(150, 210 * f));
      const cx = Math.min(vw - w / 2 - 16, Math.max(w / 2 + 16, rx + ox * f)), cy = ry + oy * f;
      const card = cards.current[i];
      if (card) {
        card.style.width = `${w}px`;
        card.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -100%) scale(${Math.max(0, show) * (act === i ? 1.1 : 1)})`;
        card.style.visibility = show > 0.001 ? '' : 'hidden';
      }
      const ln = lines.current[i];
      if (ln) { ln.setAttribute('x1', `${rx}`); ln.setAttribute('y1', `${ry}`); ln.setAttribute('x2', `${rx + (cx - rx) * clamp(show)}`); ln.setAttribute('y2', `${ry + (cy - ry) * clamp(show)}`); }
      const dot = dots.current[i];
      if (dot) { dot.setAttribute('cx', `${rx}`); dot.setAttribute('cy', `${ry}`); dot.setAttribute('r', `${Math.max(0, 5 * show)}`); }
    });
  }, [city, portrait, items, variant]);
  useLayoutEffect(() => { updateRef.current = update; }, [update]);

  // layout that only changes on resize: roof positions and the headline's scale origin
  const measure = useCallback(() => {
    if (!city) return;
    const a = city.manifest.sequences[SEQ.city]?.anchors?.[city.tier];
    if (a) {
      const last = a[a.length - 1];
      roofs.current = items.map(it => stage.toScreen(last[it.cityIndex]));
    }
    if (variant === 'window' && oH.current) {
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
      const L = layoutWindowHero(getComputedStyle(oH.current).fontFamily, window.innerWidth, window.innerHeight, nav, portrait);
      win.current = L;
      const ring = oRing.current!;
      ring.setAttribute('cx', `${L.ox}`); ring.setAttribute('cy', `${L.oy}`);
      ring.setAttribute('r', `${L.R - L.t / 2}`); ring.setAttribute('stroke-width', `${L.t}`);
      oH.current.setAttribute('x', `${L.h.x}`); oH.current.setAttribute('y', `${L.h.y}`); oH.current.style.fontSize = `${L.h.size}px`;
      oStudio.current!.setAttribute('transform', `translate(${L.s.x} ${L.s.y}) rotate(-90)`); oStudio.current!.style.fontSize = `${L.s.size}px`;
      if (oWrap.current) oWrap.current.style.transformOrigin = `${L.ox}px ${L.oy}px`;
      introOrigin.x = L.ox; introOrigin.y = L.oy; // the opening curtain ripples out from the O
      return;
    }
    const words = head.current?.querySelector<HTMLElement>('[data-words]');
    const [w1, w2] = words ? Array.from(words.children) as HTMLElement[] : [];
    if (w1 && w2) {
      const column = w2.offsetTop > w1.offsetTop + w1.offsetHeight / 2;
      origin.current = column
        ? { x: words!.offsetWidth / 2, y: (w1.offsetTop + w1.offsetHeight + w2.offsetTop) / 2 }
        : { x: (w1.offsetLeft + w1.offsetWidth + w2.offsetLeft) / 2, y: w1.offsetTop + w1.offsetHeight / 2 };
    }
  }, [city, items, variant, portrait]);

  // hand the city sequence to the stage
  useLayoutEffect(() => {
    if (!city) return;
    stage.setSequence(city.seq, city.tier, city.dims, seg(progress.current, T.frames) * (city.seq.count - 1));
    stage.setZoom(1);
    stage.setHidden(false);
  }, [city]);

  // scroll timeline
  useEffect(() => {
    if (!city || !intro.current) return;
    measure();
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1, ease: 'none',
      scrollTrigger: { trigger: intro.current, start: 'top top', end: 'bottom bottom', scrub: isCoarsePointer() ? 0.35 : true },
      onUpdate: () => updateRef.current(proxy.p),
    });
    // once the sections cover the screen, stop painting the canvas
    const cover = ScrollTrigger.create({
      trigger: intro.current, start: 'bottom top',
      onEnter: () => stage.setHidden(true), onLeaveBack: () => stage.setHidden(false),
    });
    const onRefresh = () => { measure(); updateRef.current(tween.scrollTrigger?.progress ?? proxy.p); };
    ScrollTrigger.addEventListener('refresh', onRefresh);
    document.fonts?.ready.then(onRefresh);

    // arriving back from a project, or with a #section in the URL
    const intent = stage.intent;
    stage.intent = null;
    const el = intro.current;
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (intent?.type === 'return-city') {
        scrollToY(el.offsetTop + T.hold * (el.offsetHeight - window.innerHeight), { immediate: true });
      } else if (location.hash.length > 1) {
        scrollToEl(document.getElementById(location.hash.slice(1)), { immediate: true });
      }
      onRefresh();
    });

    // load-in: the window opens and the words rise
    if (!prefersReducedMotion() && enter.current.r < 1) {
      // start while the opening curtain is still clearing, so both read as one motion
      const d = Math.max(0, introRemaining() - 0.7);
      gsap.to(enter.current, { r: 1, duration: 1.4, ease: 'expo.out', delay: d + 0.1, onUpdate: () => updateRef.current(progress.current) });
      gsap.fromTo(head.current!.querySelectorAll('[data-word]'), { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: d + 0.25 });
      gsap.fromTo(head.current!.querySelectorAll('[data-letter]'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: d + 0.35 });

    } else {
      enter.current.r = 1;
    }
    return () => {
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      tween.scrollTrigger?.kill();
      tween.kill();
      cover.kill();
      stage.setClip(null);
      stage.setTint(0);
    };
  }, [city, measure]);

  // hover/active state only re-applies styles
  useEffect(() => { activeRef.current = active; updateRef.current(progress.current); }, [active]);

  // phones: the card centred in the carousel becomes the active project
  const carousel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!portrait || !carousel.current) return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { root: carousel.current, threshold: 0.6 });
    carousel.current.querySelectorAll('[data-i]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [portrait]);
  useEffect(() => { if (active !== null) prefetchSequence(SEQ.dive(items[active].slug)); }, [active, items]);

  const open = (i: number) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const slug = items[i].slug;
    prefetchSequence(SEQ.dive(slug));
    prefetchSequence(SEQ.orbit(slug));
    stage.intent = { type: 'dive', slug };
    setActive(i);
    gsap.to(overlay.current, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => router.push(paths.project(lang, slug)) });
  };
  // the overlay may have been faded out on the way to a project
  useEffect(() => { if (overlay.current) overlay.current.style.opacity = ''; }, []);

  const [a, b] = splitWords(t.hero.headline);
  const words = (color: string) => (
    <div data-words className={`absolute inset-0 flex items-center justify-center whitespace-nowrap font-bold leading-[0.82] tracking-[-0.035em] ${color} ${portrait ? 'flex-col gap-[0.06em] text-[24vw]' : 'gap-[0.46em] text-[13.5vw]'}`}>
      <span className="block overflow-hidden pb-[0.04em]"><span data-word className="block">{a}</span></span>
      <span className="block overflow-hidden pb-[0.04em]"><span data-word className="block">{b}</span></span>
    </div>
  );

  return (
    <section ref={intro} className="relative h-[400svh] md:h-[420svh]" aria-label={t.city.label}>
      <div id="proyectos" aria-hidden className="pointer-events-none absolute left-0 w-px" style={{ top: `calc(${T.hold} * (100% - 100svh))` }} />
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* faint architectural drawing behind the lettering */}
        <div ref={plans} className="pointer-events-none absolute inset-0 text-azul [&>svg]:opacity-[0.16]" aria-hidden>
          <PlanBackdrop />
        </div>

        {/* headline */}
        <div ref={head}>
          <h1 className="sr-only">{`${site.name} — ${t.hero.tagline}`}</h1>
          {variant === 'window' ? (
            <div ref={oWrap} className="absolute inset-0" aria-hidden>
              {/* OH negro, ESTUDIO en azul vívido, Inter Bold */}
              <svg className="absolute inset-0 h-full w-full overflow-visible font-sans font-bold" fill="#000000">
                <circle ref={oRing} fill="none" stroke="#000000" r={0} />
                <g data-letter><text ref={oH}>H</text></g>
                <g data-letter fill="#123BFF"><text ref={oStudio} letterSpacing={`${SIDE_TRACKING}em`}>{SIDE_WORD}</text></g>
              </svg>
            </div>
          ) : (
            <>
              <div ref={headOuter} className="absolute inset-0" aria-hidden>{words('text-azul')}</div>
              <div ref={headInner} className="absolute inset-0" aria-hidden>{words('text-marfil')}</div>
            </>
          )}
        </div>
        {/* barra inferior: correo e iconos de redes */}
        <div ref={footer} className="pointer-events-none absolute inset-x-4 bottom-6 flex items-center justify-between md:inset-x-12 md:bottom-10">
          <a href={`mailto:${site.email}`}
            className="pointer-events-auto flex items-center gap-2 font-medium text-azul hover:opacity-70">
            <IconEmail size={18} />
            <span className="hidden text-[15px] underline underline-offset-[5px] md:inline">{site.email}</span>
          </a>
          <div className="pointer-events-auto flex items-center gap-5">
            {site.social.slice(0, 2).map(s => {
              const Icon = SOCIAL_ICONS[s.label];
              return (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                  aria-label={s.label}
                  className="flex items-center gap-1.5 text-noche/70 transition-colors hover:text-azul">
                  {Icon && <Icon size={20} />}
                  <span className="label text-[11px] hidden md:inline">{s.label}</span>
                </a>
              );
            })}
          </div>
        </div>


        {/* city: cards and project list */}
        <div ref={overlay} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {!portrait && items.map((_, i) => (
              <g key={i}>
                <line ref={el => { lines.current[i] = el; }} stroke="#232A5B" strokeWidth={1} />
                <circle ref={el => { dots.current[i] = el; }} r={0} fill={active === i ? '#C0DF7A' : '#232A5B'} stroke={active === i ? '#232A5B' : 'none'} />
              </g>
            ))}
          </svg>

          <p ref={hint} className="absolute left-4 top-[calc(var(--nav-h)+16px)] md:left-12" style={{ opacity: 0 }}>
            <span className="pill label bg-marfil px-4 py-3 text-noche"><span className="punta text-[14px] text-azul" />{t.city.hint}</span>
          </p>

          {!portrait && items.map((it, i) => (
            <Link key={it.slug} href={paths.project(lang, it.slug)} ref={el => { cards.current[i] = el; }}
              onClick={open(i)} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              aria-label={`${t.city.open}: ${it.name}`}
              className={`absolute left-0 top-0 block origin-bottom rounded-[16px] p-1.5 shadow-[0_12px_32px_-20px_rgba(35,42,91,.55)] transition-colors duration-200 ${active === i ? 'z-10 bg-azul' : 'bg-blanco'}`}
              style={{ visibility: 'hidden', willChange: 'transform' }}>
              <RenderArt i={it.cardArt} className="aspect-[16/9] rounded-[11px]" />
              <span className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5">
                <span className={`truncate text-[15px] font-semibold ${active === i ? 'text-blanco' : 'text-noche'}`}>{it.name}</span>
                <span className="num text-[10px]">{it.cityIndex + 1}.</span>
              </span>
            </Link>
          ))}

          {portrait && items.map((it, i) => (
            <span key={it.slug} ref={el => { pins.current[i] = el; }} aria-hidden
              className={`num absolute left-0 top-0 origin-bottom transition-colors ${active === i ? '' : 'bg-noche text-marfil'}`}
              style={{ transform: 'scale(0)' }}>
              {it.cityIndex + 1}.
            </span>
          ))}

          <div ref={bar} className="absolute inset-x-0 bottom-0" style={{ visibility: 'hidden' }}>
            {portrait ? (
              <div ref={carousel} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[14vw] pb-5 pt-2" data-lenis-prevent>
                {items.map((it, i) => (
                  <Link key={it.slug} data-i={i} href={paths.project(lang, it.slug)} onClick={open(i)}
                    className={`w-[72vw] shrink-0 snap-center rounded-[18px] p-1.5 transition-colors ${active === i ? 'bg-azul text-blanco' : 'bg-blanco text-noche'}`}>
                    <RenderArt i={it.cardArt} className="aspect-[16/9] rounded-[13px]" />
                    <span className="flex items-center gap-3 px-1.5 pb-1.5 pt-3">
                      <span className="num text-[11px]">{it.cityIndex + 1}.</span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[17px] font-semibold leading-tight">{it.name}</span>
                        <span className={`label text-[10px] ${active === i ? 'text-gris' : 'text-noche/60'}`}>{it.kind} · {it.year}</span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <nav aria-label={t.city.label} className="grid h-[88px] grid-cols-6 items-center gap-6 bg-noche px-12">
                {items.map((it, i) => (
                  <Link key={it.slug} href={paths.project(lang, it.slug)} onClick={open(i)}
                    onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                    className="flex min-w-0 items-center gap-3">
                    <span className={`num text-[11px] ${active === i ? '' : 'bg-marfil/12 text-marfil'}`}>{it.cityIndex + 1}.</span>
                    <span className={`truncate text-[16px] font-medium transition-colors ${active === i ? 'text-verde' : 'text-marfil'}`}>{it.name}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function splitWords(text: string): [string, string] {
  const sp = text.indexOf(' ');
  const cut = sp > 0 ? sp : Math.ceil(text.length / 2);
  return [text.slice(0, cut), text.slice(cut).trim()];
}
