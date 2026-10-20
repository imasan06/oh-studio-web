'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import type { Locale } from '@/content/projects';
import { site } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';
import { getLenis, scrollToEl, scrollToY } from '@/lib/scroll';
import { Logo } from './ui/Logo';

export default function Nav({ lang, t }: { lang: Locale; t: Dictionary['nav'] }) {
  const pathname = usePathname();
  // the menu belongs to the page it was opened on, so any navigation closes it
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn((typeof v === 'function' ? v(open) : v) ? pathname : null);
  const home = `/${lang}`;
  const onHome = pathname === home;
  const other: Locale = lang === 'es' ? 'en' : 'es';
  const switchHref = pathname.replace(/^\/(es|en)(?=\/|$)/, `/${other}`);

  useEffect(() => {
    const l = getLenis();
    if (open) l?.stop(); else l?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }, [open]);

  // On the home page, section links scroll in place; elsewhere they navigate home first.
  const go = (id: string) => (e: MouseEvent) => {
    setOpen(false);
    if (!onHome) return;
    e.preventDefault();
    scrollToEl(document.getElementById(id), { duration: 1.6 });
    history.replaceState(null, '', `#${id}`);
  };
  const toTop = (e: MouseEvent) => {
    if (!onHome) return;
    e.preventDefault();
    scrollToY(0, { duration: Math.min(2.6, 0.9 + window.scrollY / 3000) }); // the reverse fly-out back to the hero
    history.replaceState(null, '', home);
  };

  const links = [
    { id: 'proyectos', label: t.projects },
    { id: 'estudio', label: t.studio },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--nav-h)] items-center justify-between bg-marfil px-4 md:px-12">
        {/* horizontal version, the manual's header logo (never under 100 px wide) */}
        <Link href={home} onClick={toTop} className="block" aria-label={`${site.name} — ${t.home}`}>
          <Logo height={44} priority alt="" className="h-[42px] w-auto md:h-[44px]" />
        </Link>

        <nav className="hidden items-center gap-10 text-[16px] font-medium md:flex" aria-label="Principal">
          {links.map(l => (
            <Link key={l.id} href={`${home}#${l.id}`} onClick={go(l.id)} scroll={false}
              className="border-b-2 border-transparent pb-1 transition-colors hover:border-azul hover:text-azul">
              {l.label}
            </Link>
          ))}
          <Link href={switchHref} hrefLang={other} className="label text-noche/60 hover:text-azul" aria-label={t.language}>
            {t.languageShort}
          </Link>
          <Link href={`${home}#contacto`} onClick={go('contacto')} scroll={false} className="pill bg-azul px-6 py-3.5 text-[15px] text-blanco hover:bg-noche">
            {t.contact}
          </Link>
        </nav>

        <div className="flex items-center gap-5 md:hidden">
          <Link href={switchHref} hrefLang={other} className="label text-noche/60" aria-label={t.language}>{t.languageShort}</Link>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-menu"
            className="pill bg-noche px-5 py-3 text-[15px] text-marfil">
            {open ? t.close : t.menu}
          </button>
        </div>
      </header>

      <div id="mobile-menu" hidden={!open}
        className="fixed inset-0 top-[var(--nav-h)] z-40 flex flex-col justify-between bg-noche px-4 pb-10 pt-8 text-marfil md:hidden">
        <nav className="flex flex-col gap-1" aria-label="Móvil">
          {[...links, { id: 'contacto', label: t.contact }].map((l, i) => (
            <Link key={l.id} href={`${home}#${l.id}`} onClick={go(l.id)} scroll={false}
              className="flex items-center gap-5 border-b border-marfil/15 py-5 text-[42px] font-bold leading-none tracking-[-0.03em]">
              <span className="num">{i + 1}.</span>{l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <p className="accent text-[22px] text-gris">{t.tagline}</p>
          <Link href={switchHref} hrefLang={other} className="label w-fit text-marfil underline underline-offset-4">{t.language}</Link>
        </div>
      </div>
    </>
  );
}
