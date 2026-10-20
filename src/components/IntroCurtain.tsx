'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { INTRO_KEY, introOrigin, markIntro } from '@/lib/intro';
import { prefersReducedMotion } from '@/lib/scroll';
import { Logo } from './ui/Logo';

/**
 * Opening: the brand's cover (white principal logo on azul vívido, as on the manual's first page),
 * then the blue breaks into a grid of tiles, each scaling down in a wave from the O window,
 * revealing the hero. Plays once per browser session. The cover is in the server HTML so the page
 * never flashes before it.
 */
export default function IntroCurtain() {
  const root = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<{ cols: number; rows: number; size: number } | null>(null);
  const [done, setDone] = useState(false);

  // 1. decide whether to play, and size the grid for this screen
  useEffect(() => {
    let played = false;
    try { played = sessionStorage.getItem(INTRO_KEY) === '1'; } catch {}
    const id = requestAnimationFrame(() => {
      if (played) { setDone(true); return; }
      const vw = window.innerWidth, vh = window.innerHeight;
      const size = vw < 768 ? 48 : 72;
      setGrid({ cols: Math.ceil(vw / size), rows: Math.ceil(vh / size), size });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // 2. once the squares are in place, open them
  useEffect(() => {
    const el = root.current;
    if (!grid || !el) return;
    const squares = el.querySelectorAll<HTMLElement>('[data-sq]');
    el.style.background = 'transparent'; // the squares now cover the screen instead of the solid fill
    const mark = el.querySelector<HTMLElement>('[data-mark]');
    document.documentElement.style.overflow = 'hidden';
    const finish = () => {
      document.documentElement.style.overflow = '';
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
      setDone(true);
    };

    if (prefersReducedMotion()) {
      markIntro(300);
      const t = gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.5, onComplete: finish });
      return () => { t.kill(); document.documentElement.style.overflow = ''; };
    }

    // mosaic transition: tiles scale out in a wave from the O window, with a little jitter per tile
    const dur = 0.6, spread = 1.0, jitter = 0.22, hold = 0.55;
    markIntro((0.5 + hold + dur + spread + jitter) * 1000);
    const tl = gsap.timeline({ paused: true, onComplete: finish });
    // the logo holds a moment on the blue, then gives way
    if (mark) tl.to(mark, { opacity: 0, scale: 0.94, duration: 0.35, ease: 'power2.in' }, hold);
    const t0 = performance.now();
    let raf = 0;
    const start = () => {
      // the hero publishes the O's centre once it has measured; fall back to the screen centre
      const ox = introOrigin.x >= 0 ? introOrigin.x : window.innerWidth / 2;
      const oy = introOrigin.y >= 0 ? introOrigin.y : window.innerHeight / 2;
      const { cols, size } = grid;
      const dist = Array.from(squares, (_, i) => Math.hypot((i % cols + 0.5) * size - ox, (Math.floor(i / cols) + 0.5) * size - oy));
      const far = Math.max(...dist) || 1;
      tl.to(squares, {
        scale: 0, duration: dur, ease: 'power3.inOut',
        delay: (i: number) => Math.pow(dist[i] / far, 0.85) * spread + Math.random() * jitter,
      }, hold + 0.2).play();
    };
    const waitForO = () => {
      if (introOrigin.x >= 0 || performance.now() - t0 > 800) start();
      else raf = requestAnimationFrame(waitForO);
    };
    raf = requestAnimationFrame(waitForO);
    return () => { cancelAnimationFrame(raf); tl.kill(); document.documentElement.style.overflow = ''; };
  }, [grid]);

  if (done) return null;
  return (
    <div ref={root} className="intro-curtain pointer-events-auto fixed inset-0 z-[100] overflow-hidden bg-azul" aria-hidden>
      {grid && Array.from({ length: grid.rows * grid.cols }, (_, i) => (
        <div key={i} data-sq className="absolute bg-azul will-change-transform"
          style={{ left: (i % grid.cols) * grid.size, top: Math.floor(i / grid.cols) * grid.size, width: grid.size + 1, height: grid.size + 1 }} />
      ))}
      <div data-mark className="absolute inset-0 flex items-center justify-center">
        <Logo version="principal" height={160} priority alt="" className="h-[clamp(120px,18vh,180px)] w-auto" />
      </div>
    </div>
  );
}
