import type Lenis from 'lenis';

let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => { lenis = l; };
export const getLenis = () => lenis;

export function scrollToY(y: number, opts: { immediate?: boolean; duration?: number } = {}) {
  if (lenis) lenis.scrollTo(y, { immediate: opts.immediate, duration: opts.duration, force: true });
  else window.scrollTo({ top: y, behavior: opts.immediate ? 'instant' : 'smooth' });
}

export function scrollToEl(el: Element | null, opts: { immediate?: boolean; duration?: number } = {}) {
  if (!el) return;
  scrollToY(el.getBoundingClientRect().top + window.scrollY, opts);
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
