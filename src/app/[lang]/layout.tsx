import type { Metadata, Viewport } from 'next';
import { Inter, Krub } from 'next/font/google';
import { notFound } from 'next/navigation';
import IntroCurtain from '@/components/IntroCurtain';
import Nav from '@/components/Nav';
import SmoothScroll from '@/components/SmoothScroll';
import StageView from '@/components/stage/StageView';
import { getDictionary, hasLocale, locales } from '@/i18n/dictionaries';
import { RENDERS_URL } from '@/lib/renders/registry';
import '../globals.css';

// the brand's two families, self-hosted: Inter (principal) and Krub (complementaria, mostly italic)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const krub = Krub({ subsets: ['latin'], weight: ['400', '500', '700'], style: ['normal', 'italic'], variable: '--font-krub', display: 'swap' });

export function generateStaticParams() {
  return locales.map(lang => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: t.meta.title, template: '%s — OH ESTUDIO' },
    description: t.meta.description,
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { title: t.meta.title, description: t.meta.description, siteName: 'OH ESTUDIO', locale: lang, type: 'website' },
  };
}

export const viewport: Viewport = { themeColor: '#F0EDE7', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang} className={`${inter.variable} ${krub.variable}`} suppressHydrationWarning>
      <head>
        {/* repeat visits in the same session skip the opening curtain before first paint */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('oh-intro-played')==='1')document.documentElement.classList.add('intro-skip')}catch(e){}" }} />
        <link rel="preload" href={`${RENDERS_URL}/manifest.json`} as="fetch" crossOrigin="anonymous" />
      </head>
      <body>
        <IntroCurtain />
        <SmoothScroll />
        <StageView />
        <Nav lang={lang} t={t.nav} />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
