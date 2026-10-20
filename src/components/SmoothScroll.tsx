'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { getLenis, isCoarsePointer, prefersReducedMotion, setLenis } from '@/lib/scroll';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // address-bar show/hide on phones must not re-measure every trigger mid-scroll
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (prefersReducedMotion() || isCoarsePointer()) return; // native scrolling is already smooth on touch

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, anchors: { offset: 0 } });
    setLenis(lenis);
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); setLenis(null); };
  }, []);

  // after a route change the document height changes: re-measure
  useEffect(() => {
    getLenis()?.resize();
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
