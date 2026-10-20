import Image from 'next/image';
import Link from 'next/link';
import type { Locale } from '@/content/projects';
import { site } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';
import { Logo, rich } from '../ui/Logo';
import { RenderArt } from '../ui/RenderArt';
import { IconEmail, SOCIAL_ICONS } from '../ui/SocialIcons';
import FitText from '../ui/FitText';
import ContactForm from './ContactForm';

// Section headline: one weight throughout; the highlighted words only change colour
const h2 = 'font-medium leading-[1.02] tracking-[-0.035em] text-balance';

// Section opener: its label followed by a hairline that runs to the edge
function Eyebrow({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div data-reveal className={`flex items-center gap-5 ${className}`}>
      <span className="label">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-current opacity-25" />
    </div>
  );
}

// From md up every section is one screen: it starts under the fixed nav and ends at the viewport's bottom
const screen = 'md:pt-[calc(var(--nav-h)+32px)] md:pb-10';

// Bento cell: square edges. Below lg it keeps its own aspect ratio, on lg the grid places it.
// On hover (or tap, via focus) a panel slides up over the lower half.
const cell = 'group @container relative overflow-hidden';
const panel = 'absolute inset-x-0 bottom-0 min-h-1/2 translate-y-full bg-noche text-marfil transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-y-0 group-focus-visible:translate-y-0 group-focus:translate-y-0 motion-reduce:transition-none';

type Info = Dictionary['studio']['gallery']['house'];

function Photo({ src, info, drawing, className }: { src: string; info: Info; drawing?: boolean; className: string }) {
  return (
    <figure tabIndex={0} className={`${cell} cursor-default outline-none ${drawing ? 'bg-blanco' : 'bg-gris'} ${className}`}>
      <Image src={src} alt={info.name} fill sizes="(min-width: 1024px) 75vw, 100vw"
        className={`transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.03] ${drawing ? 'object-contain p-4 mix-blend-multiply md:p-8' : 'object-cover'}`} />
      <figcaption className={`${panel} flex flex-col justify-end gap-2 p-4 @xs:gap-3 @xs:p-5 @lg:p-7`}>
        <span className="label text-[10px] text-verde">{info.kind}</span>
        <span className="text-[19px] font-medium leading-[1.1] tracking-[-0.02em] @xs:text-[22px] @lg:text-[30px]">{info.name}</span>
        <span className="hidden max-w-[52ch] text-[14px] leading-[1.45] text-gris text-pretty @xs:block @lg:text-[16px]">{info.body}</span>
        <dl className="mt-1 hidden grid-cols-2 gap-x-5 gap-y-2 border-t border-marfil/15 pt-3 @sm:grid @2xl:grid-cols-4">
          {info.specs.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="label text-[9px] text-gris/70">{k}</dt>
              <dd className="text-[13px] leading-[1.3]">{v}</dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  );
}

// Empty slot waiting for its photo: only the panel's slide, with nothing in it
const Slot = ({ className }: { className: string }) => (
  <div aria-hidden className={`${cell} bg-gris/60 ${className}`}><div className={panel} /></div>
);

export function Studio({ t }: { t: Dictionary['studio'] }) {
  const g = t.gallery;
  return (
    <section id="estudio" aria-label={t.eyebrow} className="relative bg-marfil p-1 pt-[calc(var(--nav-h)+4px)]">
      <h2 data-reveal className="overflow-hidden px-[2vw] pb-[0.6vw] pt-[2vw] text-azul">
        <FitText className="font-medium leading-[0.8] tracking-[-0.055em]">{g.title}</FitText>
      </h2>
      {/* Bento, edge to edge: 4 columns × 7 rows of 22svh on lg, taller than the screen so it scrolls */}
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-4 lg:grid-rows-[repeat(7,22svh)]">
        <Photo src="/estudio/casa-ladera.jpg" info={g.house} className="col-span-2 aspect-[4/5] md:aspect-[16/10] lg:col-span-3 lg:row-span-3 lg:aspect-auto" />
        <Photo src="/estudio/dormitorio-1.jpg" info={g.room1} className="aspect-[3/4] lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:aspect-auto" />
        <Photo src="/estudio/dormitorio-2.jpg" info={g.room2} className="aspect-[3/4] lg:col-start-4 lg:row-span-2 lg:row-start-3 lg:aspect-auto" />
        <Photo src="/estudio/planta.jpg" info={g.plan} drawing className="col-span-2 aspect-[4/3] lg:col-start-1 lg:row-span-2 lg:row-start-4 lg:aspect-auto" />
        <Slot className="aspect-[3/4] lg:col-start-3 lg:row-span-2 lg:row-start-4 lg:aspect-auto" />
        <Slot className="aspect-[3/4] lg:col-start-4 lg:row-span-3 lg:row-start-5 lg:aspect-auto" />
        <Photo src="/estudio/corte.jpg" info={g.section} drawing className="col-span-2 aspect-[2/1] lg:col-span-3 lg:col-start-1 lg:row-span-2 lg:row-start-6 lg:aspect-auto" />
      </div>
    </section>
  );
}

export function Services({ t }: { t: Dictionary['services'] }) {
  return (
    <section id="servicios" className={`relative flex flex-col bg-noche px-4 py-20 text-marfil md:h-[100svh] md:px-12 ${screen}`}>
      <Eyebrow className="mb-8 text-gris md:mb-[clamp(16px,3svh,32px)]">{t.eyebrow}</Eyebrow>
      <div className="mb-12 flex flex-col justify-between gap-8 md:mb-[clamp(24px,5svh,64px)] md:flex-row md:items-end">
        <h2 data-reveal className={`${h2} text-[clamp(44px,min(6vw,11svh),104px)]`}>{rich(t.title, 'text-marfil/45')}</h2>
        <a data-reveal href="#proyectos" className="pill w-fit border border-marfil/35 px-6 py-3.5 text-[15px] hover:bg-marfil hover:text-noche">
          <span className="punta text-[12px] text-verde" />{t.all}
        </a>
      </div>
      {/* subgrid rows keep the three illustrations the same height whatever their copy's length */}
      <div className="grid gap-12 md:min-h-0 md:flex-1 md:grid-cols-3 md:grid-rows-[minmax(140px,1fr)_auto_auto] md:gap-x-8 md:gap-y-5">
        {t.items.map((s, i) => (
          <article key={s.title} data-reveal className="flex flex-col gap-5 md:row-span-3 md:grid md:grid-rows-subgrid md:gap-0" style={{ transitionDelay: `${i * 90}ms` }}>
            <RenderArt i={s.art} className="aspect-[4/3] rounded-[22px] md:aspect-auto" />
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
    // with the 120px footer below, contact + footer make exactly one screen
    <section id="contacto" className={`relative flex flex-col bg-azul px-4 py-20 text-blanco md:h-[calc(100svh-120px)] md:px-12 ${screen}`}>
      <Eyebrow className="mb-10 text-marfil/80 md:mb-[clamp(16px,3svh,32px)]">{t.eyebrow}</Eyebrow>
      {/* copy on the left; the form takes the whole right column, top to bottom */}
      <div className="grid gap-12 md:min-h-0 md:flex-1 md:grid-cols-2 md:gap-12 lg:gap-20">
        <div className="flex flex-col justify-between gap-10">
          <h2 data-reveal className={`${h2} max-w-[14ch] text-[clamp(48px,min(6.4vw,12svh),128px)] leading-[0.98]`}>{rich(t.title, 'text-blanco/50')}</h2>
          <div data-reveal className="flex flex-col gap-7 md:gap-4">
            <p className="max-w-[560px] text-[clamp(19px,1.4vw,24px)] leading-[1.5] text-pretty">{t.body}</p>
            <a href={`mailto:${site.email}`} className="w-fit break-all text-[clamp(18px,1.4vw,24px)] font-medium underline decoration-verde decoration-[3px] underline-offset-8">{site.email}</a>
          </div>
        </div>
        <div data-reveal className="md:min-h-0"><ContactForm t={t.form} /></div>
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
