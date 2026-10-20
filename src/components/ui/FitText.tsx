'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

// One line of text scaled so it spans its parent's full width, refitted on resize and once the web font loads.
export default function FitText({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current, box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.fontSize = '100px';
      const cs = getComputedStyle(box);
      const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      el.style.fontSize = `${(100 * room * 0.93) / el.getBoundingClientRect().width}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return <span ref={ref} className={`inline-block whitespace-nowrap ${className}`} style={{ fontSize: '17vw' }}>{children}</span>;
}
