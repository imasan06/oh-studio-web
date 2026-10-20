'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Adds .is-in to [data-reveal] elements as they enter the viewport (one observer for the page). */
export default function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
