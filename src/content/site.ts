// Studio details used across the site.
export const site = {
  name: 'OH ESTUDIO',
  owner: 'Olinda Hoyos',
  email: 'olindapolahoyoscallacondo@gmail.com',
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/ohstudioarq/' },
    { label: 'LinkedIn',  href: 'https://linkedin.com/company/ohestudio' },
  ],
  year: 2026,
};

/** Paths are written with the locale prefix: /es/proyectos/casa-patio, /en/proyectos/casa-patio */
export const paths = {
  home: (l: string) => `/${l}`,
  project: (l: string, slug: string) => `/${l}/proyectos/${slug}`,
};
