import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/project/ProjectDetail';
import ProjectViewer from '@/components/project/ProjectViewer';
import RevealObserver from '@/components/RevealObserver';
import { Contact, SiteFooter } from '@/components/sections/Sections';
import { byCityIndex, getProject, projects } from '@/content/projects';
import { getDictionary, hasLocale } from '@/i18n/dictionaries';

export function generateStaticParams() {
  return projects.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/proyectos/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const p = getProject(slug);
  if (!p || !hasLocale(lang)) return {};
  return {
    title: p.name,
    description: p.summary[lang],
    alternates: { languages: { es: `/es/proyectos/${slug}`, en: `/en/proyectos/${slug}` } },
  };
}

export default async function ProjectPage({ params }: PageProps<'/[lang]/proyectos/[slug]'>) {
  const { lang, slug } = await params;
  const project = getProject(slug);
  if (!project || !hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const at = byCityIndex.indexOf(project);
  const next = byCityIndex[(at + 1) % byCityIndex.length];

  return (
    <>
      <div id="top" />
      <ProjectViewer lang={lang} slug={slug} name={project.name} meta={`${project.kind[lang]} · ${project.year}`} model={project.model} t={t.viewer} />
      <ProjectDetail lang={lang} project={project} next={next} t={t.detail} />
      <Contact t={t.contact} />
      <SiteFooter lang={lang} t={t.footer} />
      <RevealObserver />
    </>
  );
}
