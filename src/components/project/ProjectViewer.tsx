'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Locale } from '@/content/projects';
import type { Dictionary } from '@/i18n/dictionaries';
import { SEQ } from '@/lib/renders/manifest';
import { prefersReducedMotion, scrollToEl } from '@/lib/scroll';
import { stage } from '@/lib/stage';
import { useSequence } from '@/lib/useSequence';
import type { ModelApi, ModelStart } from './ModelView';

// three.js only loads on pages that have a model
const ModelView = dynamic(() => import('./ModelView'), { ssr: false });

gsap.registerPlugin(ScrollTrigger);

type Phase = 'loading' | 'diving' | 'orbit' | 'leaving';
const ZOOMS = [1, 1.25, 1.5];
const DEG_PER_PX = 0.45;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Two paints: what the stage was just given is on screen. */
const painted = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const FADE = 380; // ms, the 3D canvas fading over the dive's last frame (ModelView)

/** `model`: web GLBs (scripts/blender/render_sprites.py --web). With them the turntable is the live 3D city, else the orbit frames. */
type Props = { lang: Locale; slug: string; name: string; meta: string; model?: { src: string; small: string }; t: Dictionary['viewer'] };

export default function ProjectViewer({ lang, slug, name, meta, model, t }: Props) {
  const router = useRouter();
  const dive = useSequence(SEQ.dive(slug));
  const orbit = useSequence(model ? null : SEQ.orbit(slug));
  const [phase, setPhase] = useState<Phase>('loading');
  const [zoom, setZoom] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const section = useRef<HTMLElement>(null);
  const deg = useRef<HTMLSpanElement>(null);
  const angle = useRef({ a: 0 });
  const spin = useRef<gsap.core.Tween | null>(null);
  const drag = useRef<{ x: number; t: number; v: number } | null>(null);
  const view = useRef<ModelApi | null>(null);
  const [show3d, setShow3d] = useState(false);
  const live3d = useRef(false); // the 3D city covers the stage, which then stops painting
  const [modelReady] = useState(() => {
    let resolve = () => {};
    const wait = new Promise<void>(r => { resolve = r; });
    const state = { done: false, wait, resolve: () => { state.done = true; resolve(); } };
    return state;
  });
  // the 3D view opens on the dive's last frame
  const start = useMemo<ModelStart | null>(() => {
    const cam = dive?.manifest.sequences[SEQ.dive(slug)]?.cam;
    const frames = cam?.frames[dive!.tier];
    return cam && frames?.length ? { pivot: cam.pivot, cam: frames[frames.length - 1], frame: dive!.dims } : null;
  }, [dive, slug]);

  const showAngle = () => {
    const a = angle.current.a, n = stage.frameCount; // the turntable's frames cover 360° evenly
    stage.setFrame(((Math.round((a / 360) * n) % n) + n) % n);
    if (deg.current) deg.current.textContent = `${Math.round(((a % 360) + 360) % 360)}°`;
  };

  // first paint: the dive's opening frame (it matches the city view we came from)
  useLayoutEffect(() => {
    if (!dive) return;
    stage.setSequence(dive.seq, dive.tier, dive.dims, 0);
    stage.setClip(null);
    stage.setTint(0);
    stage.setZoom(1);
    stage.setHidden(false);
  }, [dive]);

  // dive → turntable
  useEffect(() => {
    if (!dive || (!model && !orbit)) return;
    let cancelled = false;
    const fromCity = stage.intent?.type === 'dive';
    stage.intent = null;
    angle.current.a = 0;
    (async () => {
      setPhase('loading');
      await dive.seq.whenReady(0);
      if (!prefersReducedMotion()) {
        // give the frames a moment to arrive; the player falls back to the nearest frame anyway
        await Promise.race([dive.seq.whenFetched(), wait(fromCity ? 900 : 2200)]);
        if (cancelled) return;
        setPhase('diving');
        const st = { f: 0 };
        await new Promise<void>(done => gsap.to(st, {
          f: dive.seq.count - 1, duration: fromCity ? 1.9 : 1.5, ease: 'power2.inOut',
          onUpdate: () => stage.setFrame(st.f), onComplete: done,
        }));
      }
      if (model) {
        if (!modelReady.done) setPhase('loading');
        await modelReady.wait;
        if (cancelled) return;
        // the 3D city opens on this very view and fades in over it
        setShow3d(true);
        await wait(FADE);
        if (cancelled) return;
        live3d.current = true;
        stage.setHidden(true);
        setPhase('orbit');
        return;
      }
      await Promise.race([orbit!.seq.whenReady(0), wait(1500)]);
      if (cancelled) return;
      stage.setSequence(orbit!.seq, orbit!.tier, orbit!.dims, 0);
      setPhase('orbit');
    })();
    return () => { cancelled = true; };
  }, [dive, orbit, model, modelReady]);

  // idle auto-rotation once the turntable is up; paused when scrolled away
  useEffect(() => {
    if (phase !== 'orbit' || prefersReducedMotion()) return;
    const id = setTimeout(() => setSpinning(true), 1200);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    spin.current?.kill();
    if (!spinning || phase !== 'orbit' || model) return;
    spin.current = gsap.to(angle.current, { a: '+=360', duration: 30, ease: 'none', repeat: -1, onUpdate: showAngle });
    return () => { spin.current?.kill(); };
  }, [spinning, phase, model]);

  // hide the canvas once the info section covers the screen
  useEffect(() => {
    if (!section.current) return;
    const st = ScrollTrigger.create({
      trigger: section.current, start: 'bottom top',
      onEnter: () => { stage.setHidden(true); spin.current?.pause(); },
      onLeaveBack: () => { if (!live3d.current) stage.setHidden(false); spin.current?.resume(); },
    });
    return () => st.kill();
  }, []);

  useEffect(() => { if (!model) stage.setZoom(ZOOMS[zoom]); }, [zoom, model]);

  // ---- drag to rotate ----
  const onDown = (e: PointerEvent) => {
    if (model || phase !== 'orbit' || (e.target as HTMLElement).closest('a,button')) return;
    setSpinning(false);
    gsap.killTweensOf(angle.current);
    drag.current = { x: e.clientX, t: performance.now(), v: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now(), dx = e.clientX - d.x;
    angle.current.a -= dx * DEG_PER_PX;
    d.v = (-dx * DEG_PER_PX) / Math.max(1, now - d.t); // deg per ms
    d.x = e.clientX; d.t = now;
    showAngle();
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || Math.abs(d.v) < 0.01) return;
    gsap.to(angle.current, { a: angle.current.a + d.v * 320, duration: 1.1, ease: 'power3.out', onUpdate: showAngle }); // inertia
  };
  const onKey = (e: KeyboardEvent) => {
    if (phase !== 'orbit') return;
    if (model) {
      const step: Record<string, [number, number]> = { ArrowLeft: [15, 0], ArrowRight: [-15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
      if (!step[e.key]) return;
      e.preventDefault();
      setSpinning(false);
      view.current?.nudge(...step[e.key]);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setSpinning(false);
    gsap.to(angle.current, { a: Math.round(angle.current.a / 15) * 15 + (e.key === 'ArrowLeft' ? -15 : 15), duration: 0.45, ease: 'power2.out', onUpdate: showAngle });
  };

  // ---- back to the city: turn to the start angle, reverse the dive, then go home ----
  const back = async (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (phase === 'leaving') return;
    setPhase('leaving');
    setSpinning(false);
    gsap.killTweensOf(angle.current);
    stage.setZoom(1);
    if (model && view.current && dive) {
      // back to the opening view, the dive's last frame under it, then the 3D city fades out
      await Promise.all([view.current.reset(), dive.seq.whenReady(dive.seq.count - 1)]);
      live3d.current = false;
      stage.setSequence(dive.seq, dive.tier, dive.dims, dive.seq.count - 1);
      stage.setHidden(false);
      await painted();
      setShow3d(false);
      await wait(FADE);
    }
    if (dive && !prefersReducedMotion()) {
      const a = angle.current.a, target = Math.round(a / 360) * 360;
      if (Math.abs(a - target) > 1) await new Promise<void>(done => gsap.to(angle.current, { a: target, duration: 0.6, ease: 'power2.inOut', onUpdate: showAngle, onComplete: done }));
      stage.setSequence(dive.seq, dive.tier, dive.dims, dive.seq.count - 1);
      const st = { f: dive.seq.count - 1 };
      await new Promise<void>(done => gsap.to(st, { f: 0, duration: 1.3, ease: 'power2.inOut', onUpdate: () => stage.setFrame(st.f), onComplete: done }));
    }
    stage.intent = { type: 'return-city' };
    router.push(`/${lang}`, { scroll: false });
  };

  const ui = phase === 'orbit';
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-marfil transition-colors hover:bg-marfil/10 disabled:opacity-40 md:h-[52px] md:w-[52px]';

  return (
    <section ref={section} aria-label={name} tabIndex={0} onKeyDown={onKey}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className={`relative h-svh select-none outline-none ${ui && !model ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ touchAction: 'pan-y' }}>
      {model && start && (
        <ModelView src={model.src} small={model.small} start={start} shown={show3d} spinning={spinning}
          onApi={api => { view.current = api; }} onReady={modelReady.resolve}
          onGrab={() => setSpinning(false)} onAngle={d => { if (deg.current) deg.current.textContent = `${d}°`; }} />
      )}
      <div className={`absolute left-4 top-[calc(var(--nav-h)+16px)] flex max-w-[calc(100%-32px)] flex-col gap-2 rounded-[22px] bg-marfil/95 px-5 py-4 transition-all duration-700 ease-out md:left-12 md:top-[calc(var(--nav-h)+28px)] md:px-6 md:py-5 ${ui || phase === 'leaving' ? '' : 'translate-y-[-12px] opacity-0'}`}>
        <Link href={`/${lang}#proyectos`} onClick={back} className="label flex w-fit items-center gap-2 text-[11px] text-noche/60 hover:text-azul">
          <span className="punta rotate-90 text-[12px] text-azul" />{t.back}
        </Link>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-azul md:text-[42px]">{name}</h1>
        <p className="accent text-[18px] md:text-[20px]">{meta}</p>
      </div>

      {(phase === 'loading') && (
        <p role="status" className="label absolute inset-x-0 bottom-[18%] text-center text-noche/70">{t.loading}…</p>
      )}

      <div className={`absolute inset-x-4 bottom-6 flex flex-col items-center gap-3 transition-all duration-700 ease-out md:bottom-14 ${ui ? '' : 'pointer-events-none translate-y-[140%] opacity-0'}`}>
        <p className="pill label bg-marfil/90 px-4 py-2 text-[11px] text-noche">{t.dragHint}</p>
        <div className="flex w-full max-w-[600px] items-center justify-between gap-2 rounded-full bg-noche p-1.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSpinning(s => !s)} aria-pressed={spinning}
              className={`pill h-11 px-5 text-[15px] md:h-[52px] md:text-[16px] ${spinning ? 'bg-verde text-noche' : 'text-marfil hover:bg-marfil/10'}`}>
              {t.rotate} <span ref={deg} className={`text-[13px] tabular-nums ${spinning ? 'text-noche' : 'text-verde'}`}>0°</span>
            </button>
            <button type="button" className={btn} aria-label={t.zoomIn} disabled={!model && zoom === ZOOMS.length - 1}
              onClick={() => (model ? view.current?.zoomBy(1.35) : setZoom(z => Math.min(ZOOMS.length - 1, z + 1)))}>+</button>
            <button type="button" className={btn} aria-label={t.zoomOut} disabled={!model && zoom === 0}
              onClick={() => (model ? view.current?.zoomBy(1 / 1.35) : setZoom(z => Math.max(0, z - 1)))}>−</button>
          </div>
          <a href="#info" onClick={e => { e.preventDefault(); scrollToEl(document.getElementById('info'), { duration: 1.4 }); }}
            className="pill h-11 bg-azul px-5 text-[15px] text-blanco hover:bg-blanco hover:text-azul md:h-[52px] md:w-[210px] md:text-[16px]">
            {t.info}
          </a>
        </div>
      </div>
    </section>
  );
}
