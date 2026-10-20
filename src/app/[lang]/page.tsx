import { notFound } from 'next/navigation';
import HomeExperience from '@/components/home/HomeExperience';
import RevealObserver from '@/components/RevealObserver';
import { Contact, Services, SiteFooter, Studio } from '@/components/sections/Sections';
import { byCityIndex } from '@/content/projects';
import { getDictionary, hasLocale } from '@/i18n/dictionaries';

export default async function Home({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const items = byCityIndex.map(p => ({ slug: p.slug, name: p.name, kind: p.kind[lang], year: p.year, cardArt: p.cardArt, cityIndex: p.cityIndex }));

  return (
    <>
      <HomeExperience lang={lang} t={{ hero: t.hero, city: t.city }} items={items} />
      <Studio t={t.studio} />
      <Services t={t.services} />
      <Contact t={t.contact} />
      <SiteFooter lang={lang} t={t.footer} />
      <RevealObserver />
    </>
  );
}
