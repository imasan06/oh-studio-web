import Link from 'next/link';
import type { Locale, Project } from '@/content/projects';
import { paths } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';
import { RenderArt } from '../ui/RenderArt';
import Gallery from './Gallery';

type Props = { lang: Locale; project: Project; next: Project; t: Dictionary['detail'] };

export default function ProjectDetail({ lang, project: p, next, t }: Props) {
  const facts: [string, string][] = [
    [t.facts.location, p.facts.location[lang]], [t.facts.area, p.facts.area],
    [t.facts.status, p.facts.status[lang]], [t.facts.team, p.facts.team],
  ];
  return (
    <>
      <section id="info" className="relative scroll-mt-[var(--nav-h)] bg-marfil px-4 pb-20 pt-10 md:px-12 md:pb-28 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-16">
          <div data-reveal><Gallery items={p.gallery} lang={lang} label={t.gallery} /></div>
          <div className="flex flex-col gap-6 md:gap-7">
            <p data-reveal className="label text-azul">{p.kind[lang]} · {p.year}</p>
            <h2 data-reveal className="text-[clamp(48px,4.8vw,84px)] font-bold leading-[0.98] tracking-[-0.03em] text-azul">{p.name}</h2>
            <p data-reveal className="accent text-[22px] leading-[1.35] text-noche md:text-[25px]">{p.summary[lang]}</p>
            <p data-reveal className="text-[18px] leading-[1.5] text-pretty md:text-[19px]">{p.description[lang]}</p>
            {/* ficha: ubicación · superficie · estado · equipo */}
            <dl data-reveal className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-[22px] bg-noche px-7 py-7">
              {facts.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <dt className="label text-[11px] text-verde">{k}</dt>
                  <dd className="text-[18px] leading-snug text-marfil md:text-[20px]">{v}</dd>
                </div>
              ))}
            </dl>
            <div data-reveal className="mt-auto flex flex-wrap gap-3 pt-2">
              <a href="#top" className="pill bg-gris px-6 py-4 text-[16px] text-noche hover:bg-noche hover:text-marfil">{t.view3d}</a>
              <Link href={paths.project(lang, next.slug)} className="pill bg-azul px-6 py-4 text-[16px] text-blanco hover:bg-noche">
                {t.next}<span className="punta text-[13px] -rotate-90" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Link href={paths.project(lang, next.slug)} className="group relative flex flex-col gap-8 bg-noche px-4 py-14 text-marfil md:flex-row md:items-center md:justify-between md:px-12 md:py-20">
        <div className="flex flex-col gap-4">
          <span className="label text-gris">{t.next}</span>
          <span className="flex items-center gap-5 text-[clamp(44px,6vw,100px)] font-bold leading-none tracking-[-0.035em] transition-colors group-hover:text-verde">
            {next.name}<span className="punta text-[0.5em] -rotate-90 text-azul transition-transform duration-500 group-hover:translate-x-2" />
          </span>
          <span className="accent text-[20px] text-gris">{next.kind[lang]} · {next.year}</span>
        </div>
        <RenderArt i={next.cardArt} className="aspect-[16/9] w-full rounded-[22px] transition-transform duration-500 group-hover:scale-[1.02] md:w-[min(420px,30vw)]" />
      </Link>
    </>
  );
}
