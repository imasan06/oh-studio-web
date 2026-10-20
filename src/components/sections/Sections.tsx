import Link from 'next/link';
import type { Locale } from '@/content/projects';
import { site } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';
import { Logo, rich } from '../ui/Logo';
import { RenderArt } from '../ui/RenderArt';
import { IconEmail, SOCIAL_ICONS } from '../ui/SocialIcons';
import ContactForm from './ContactForm';

// Section headline: Inter Bold with its Krub Italic word, after the brand's vertical bar
const h2 = 'bar font-bold leading-[1.02] tracking-[-0.03em] text-balance';

export function Studio({ t }: { t: Dictionary['studio'] }) {
  return (
    <section id="estudio" className="relative bg-marfil px-4 py-20 md:min-h-[calc(100svh-var(--nav-h))] md:px-12 md:py-28">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_min(520px,34vw)] lg:gap-24">
        <div className="flex flex-col gap-8 md:gap-10">
          <p data-reveal className="label text-azul">{t.eyebrow}</p>
          <h2 data-reveal className={`${h2} text-[clamp(48px,6vw,104px)] text-azul`}>{rich(t.title)}</h2>
          <p data-reveal className="max-w-[820px] text-[clamp(19px,1.45vw,24px)] leading-[1.5] text-pretty">{t.body}</p>
          <div data-reveal className="lg:mt-auto">
            <a href="#contacto" className="pill bg-azul px-7 py-4 text-[16px] text-blanco hover:bg-noche">{t.cta}<span className="punta text-[13px] -rotate-90" /></a>
          </div>
        </div>
        <div className="flex flex-col items-center gap-6 lg:items-stretch">
          {/* contenedor: the symbol's silhouette frames the studio photo */}
          <div data-reveal className="contenedor relative flex w-full max-w-[360px] items-start justify-center self-center bg-gris pt-[34%]">
            <span className="label text-noche/60">{t.portrait}</span>
          </div>
          <div data-reveal className="flex w-full flex-col gap-2 rounded-[22px] bg-noche px-8 py-7">
            <span className="label text-gris">{t.highlight}</span>
            <span className="text-[64px] font-bold leading-none tracking-[-0.03em] text-verde md:text-[76px]">{t.stat}</span>
            <span className="text-[20px] text-marfil">{t.statLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Services({ t }: { t: Dictionary['services'] }) {
  return (
    <section id="servicios" className="relative bg-noche px-4 py-20 text-marfil md:px-12 md:py-28">
      <div className="mb-12 flex flex-col justify-between gap-8 md:mb-16 md:flex-row md:items-end">
        <div className="flex flex-col gap-7">
          <p data-reveal className="label text-gris">{t.eyebrow}</p>
          <h2 data-reveal className={`${h2} text-[clamp(48px,6vw,104px)]`}>{rich(t.title)}</h2>
        </div>
        <a data-reveal href="#proyectos" className="pill w-fit border border-marfil/35 px-6 py-3.5 text-[15px] hover:bg-marfil hover:text-noche">
          <span className="punta text-[12px] text-verde" />{t.all}
        </a>
      </div>
      <div className="grid gap-12 md:grid-cols-3 md:gap-8">
        {t.items.map((s, i) => (
          <article key={s.title} data-reveal className="flex flex-col gap-5" style={{ transitionDelay: `${i * 90}ms` }}>
            <RenderArt i={s.art} className="aspect-[4/3] rounded-[22px]" />
            <h3 className="flex items-center gap-4">
              <span className="num">{i + 1}.</span>
              <span className="text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">{s.title}</span>
            </h3>
            <p className="text-[18px] leading-[1.5] text-gris text-pretty">{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Contact({ t }: { t: Dictionary['contact'] }) {
  return (
    <section id="contacto" className="relative bg-azul px-4 py-20 text-blanco md:min-h-[calc(100svh-var(--nav-h)-120px)] md:px-12 md:py-28">
      <div className="flex h-full flex-col gap-10 md:gap-12">
        <p data-reveal className="label text-marfil/80">{t.eyebrow}</p>
        <h2 data-reveal className={`${h2} max-w-[14ch] text-[clamp(56px,8.4vw,156px)] leading-[0.98]`}>{rich(t.title)}</h2>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-end">
          <div data-reveal className="flex flex-col gap-7">
            <p className="max-w-[640px] text-[clamp(20px,1.5vw,26px)] leading-[1.5] text-pretty">{t.body}</p>
            <a href={`mailto:${site.email}`} className="w-fit text-[clamp(20px,1.5vw,26px)] font-medium underline decoration-verde decoration-[3px] underline-offset-8">{site.email}</a>
          </div>
          <div data-reveal><ContactForm t={t.form} /></div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter({ lang, t }: { lang: Locale; t: Dictionary['footer'] }) {
  return (
    <footer className="relative flex flex-col gap-8 bg-noche px-4 py-10 md:flex-row md:items-center md:justify-between md:px-12 md:py-0 md:h-[120px]">
      {/* logo + lema */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
        <Link href={`/${lang}`} aria-label={site.name} className="block w-fit">
          <Logo tone="marfil" height={44} alt="" className="h-[44px] w-auto" />
        </Link>
        <span className="accent text-[19px] text-gris">{t.tagline}</span>
      </div>

      {/* redes sociales con iconos oficiales */}
      <div className="flex items-center gap-5">
        {site.social.map(s => {
          const Icon = SOCIAL_ICONS[s.label];
          return (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
              aria-label={s.label}
              className="flex items-center gap-2 text-gris transition-colors hover:text-verde">
              {Icon && <Icon size={22} />}
              <span className="label text-[11px] hidden md:inline">{s.label}</span>
            </a>
          );
        })}
        {/* correo con ícono */}
        <a href={`mailto:${site.email}`} aria-label="Email"
          className="flex items-center gap-2 text-gris transition-colors hover:text-verde">
          <IconEmail size={22} />
          <span className="label text-[11px] hidden md:inline">Email</span>
        </a>
      </div>

      <span className="label text-[11px] text-gris/60">© {site.year} {t.rights}</span>
    </footer>
  );
}
