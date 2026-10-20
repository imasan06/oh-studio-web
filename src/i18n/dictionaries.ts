import type { Locale } from '@/content/projects';

export const locales: Locale[] = ['es', 'en'];
export const defaultLocale: Locale = 'es';
export const hasLocale = (l: string): l is Locale => (locales as string[]).includes(l);

// Copy in the brand's voice (Manual · Descripciones): first person plural, short sentences, no jargon.
// *word* marks the highlighted word of a headline, set in Krub Italic (see rich() in ui/Logo.tsx).
const es = {
  meta: {
    title: 'OH ESTUDIO — Arquitectura e interiorismo',
    description: 'Estudio de arquitectura e interiorismo. Estructura, espacio y dirección: diseñamos espacios para habitar, de la idea a la obra.',
  },
  nav: { projects: 'Proyectos', studio: 'Estudio', contact: 'Contacto', menu: 'Menú', close: 'Cerrar', home: 'Inicio', language: 'English', languageShort: 'EN', tagline: 'Estructura, espacio y dirección.' },
  hero: {
    headline: 'OH ESTUDIO',
    tagline: 'Estructura, espacio y dirección.',
    intro: 'Diseñamos espacios para habitar, de la idea a la obra.',
    scroll: 'Desliza',
  },
  city: {
    label: 'Proyectos en la ciudad',
    hint: 'Elige un proyecto',
    open: 'Ver proyecto',
  },
  viewer: {
    back: 'Ciudad',
    rotate: 'Girar',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    info: 'Fotos e info',
    dragHint: 'Arrastra para recorrer',
    loading: 'Cargando',
  },
  detail: {
    facts: { location: 'Ubicación', area: 'Superficie', status: 'Estado', team: 'Equipo' },
    view3d: 'Ver en 3D',
    next: 'Siguiente proyecto',
    gallery: 'Galería',
    photo: 'Foto',
  },
  studio: {
    eyebrow: 'Estudio',
    title: 'El espacio *se habita.*',
    body: 'Entendemos la arquitectura como la integración de tres ideas: estructura, espacio y dirección. Con la arquitecta Olinda Hoyos, cada proyecto parte de entender cómo se habita un lugar —su luz, su recorrido y su contexto— para transformarlo con claridad y precisión.',
    cta: 'Agenda tu reunión',
    portrait: 'Foto del equipo',
    highlight: 'Desde la idea hasta la obra',
    stat: '120+',
    statLabel: 'proyectos entregados',
  },
  services: {
    eyebrow: 'Servicios',
    title: 'Del boceto *a la obra*',
    all: 'Ver proyectos',
    items: [
      { title: 'Arquitectura', body: 'Proyectos residenciales y comerciales. Escuchamos el lugar y a quien lo habita, y proyectamos su estructura.', art: 0 },
      { title: 'Interiorismo', body: 'Interiores, remodelaciones y mobiliario a medida, pensados desde la luz y el recorrido.', art: 2 },
      { title: 'Dirección de obra', body: 'Acompañamos cada etapa: diagnóstico, diseño, desarrollo técnico y obra.', art: 4 },
    ],
  },
  contact: {
    eyebrow: 'Contacto',
    title: '¿Tienes un proyecto *en mente?*',
    body: 'Escríbenos para conversar sobre tu proyecto. Respondemos de lunes a viernes.',
    write: 'Escríbenos',
    form: {
      name: 'Nombre', email: 'Email', message: 'Cuéntanos tu proyecto', send: 'Escríbenos', sending: 'Enviando…',
      sent: 'Gracias. Te respondemos pronto.', error: 'No se pudo enviar. Escríbenos directamente a',
    },
  },
  footer: { rights: 'OH ESTUDIO', tagline: 'Estructura, espacio y dirección.' },
  notFound: { title: 'Esta calle *no existe*', back: 'Volver a la ciudad' },
};

export type Dictionary = typeof es;

const en: Dictionary = {
  meta: {
    title: 'OH ESTUDIO — Architecture and interiors',
    description: 'Architecture and interior design studio. Structure, space and direction: we design spaces to be lived in, from idea to building.',
  },
  nav: { projects: 'Projects', studio: 'Studio', contact: 'Contact', menu: 'Menu', close: 'Close', home: 'Home', language: 'Español', languageShort: 'ES', tagline: 'Structure, space and direction.' },
  hero: {
    headline: 'OH ESTUDIO',
    tagline: 'Structure, space and direction.',
    intro: 'We design spaces to be lived in, from idea to building.',
    scroll: 'Scroll',
  },
  city: {
    label: 'Projects in the city',
    hint: 'Choose a project',
    open: 'See project',
  },
  viewer: {
    back: 'City',
    rotate: 'Rotate',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    info: 'Photos & info',
    dragHint: 'Drag to look around',
    loading: 'Loading',
  },
  detail: {
    facts: { location: 'Location', area: 'Area', status: 'Status', team: 'Team' },
    view3d: 'View in 3D',
    next: 'Next project',
    gallery: 'Gallery',
    photo: 'Photo',
  },
  studio: {
    eyebrow: 'Studio',
    title: 'Space is *lived in.*',
    body: 'We understand architecture as three ideas working together: structure, space and direction. With architect Olinda Hoyos, every project starts by understanding how a place is lived in —its light, its paths and its context— to transform it with clarity and precision.',
    cta: 'Book a meeting',
    portrait: 'Team photo',
    highlight: 'From idea to building',
    stat: '120+',
    statLabel: 'projects delivered',
  },
  services: {
    eyebrow: 'Services',
    title: 'From sketch *to building*',
    all: 'See projects',
    items: [
      { title: 'Architecture', body: 'Residential and commercial projects. We listen to the place and to those who live in it, and design its structure.', art: 0 },
      { title: 'Interior design', body: 'Interiors, refurbishments and bespoke furniture, designed from light and movement.', art: 2 },
      { title: 'Site direction', body: 'We accompany every stage: assessment, design, technical development and construction.', art: 4 },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Have a project *in mind?*',
    body: 'Write to us to talk about your project. We reply Monday to Friday.',
    write: 'Write to us',
    form: {
      name: 'Name', email: 'Email', message: 'Tell us about your project', send: 'Write to us', sending: 'Sending…',
      sent: 'Thank you. We’ll be in touch soon.', error: 'Could not send. Write to us directly at',
    },
  },
  footer: { rights: 'OH ESTUDIO', tagline: 'Structure, space and direction.' },
  notFound: { title: 'This street *doesn’t exist*', back: 'Back to the city' },
};

const dictionaries: Record<Locale, Dictionary> = { es, en };
export const getDictionary = (l: Locale) => dictionaries[l];
