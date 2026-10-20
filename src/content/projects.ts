// Portfolio content. These six are TEST projects (names and copy from the design prototype).
// To add a real project: add an entry here, then drop its rendered frames into
// public/renders/projects/<slug>/ and regenerate the manifest (see README).

export type Locale = 'es' | 'en';
export type Localized = Record<Locale, string>;

/** `art` = one of the brand illustrations (placeholder); `src` = a real photo in /public. */
export type GalleryItem =
  | { art: number; caption: Localized }
  | { src: string; width: number; height: number; caption: Localized };

export type Project = {
  slug: string;
  /** Index of the building in the rendered city (anchor order in the manifest). */
  cityIndex: number;
  name: string;
  kind: Localized;
  year: number;
  summary: Localized;
  description: Localized;
  facts: { location: Localized; area: string; status: Localized; team: string };
  cardArt: number;
  gallery: GalleryItem[];
  /** Web GLBs for the live 3D turntable (replaces the orbit frames): full, and a lighter one for phones. */
  model?: { src: string; small: string };
};

const caption = (es: string, en: string): Localized => ({ es, en });
const BUILT = caption('Construido', 'Built');

export const projects: Project[] = [
  {
    slug: 'casa-patio', cityIndex: 0, name: 'Casa Patio', year: 2025,
    kind: caption('Vivienda', 'Housing'),
    summary: caption('Una casa organizada alrededor de un patio de luz.', 'A house organised around a light well.'),
    description: caption(
      'La vivienda se vuelca hacia un patio central que reparte luz y ventilación a todas las estancias. Desde la calle, una fachada sobria; desde dentro, el cielo.',
      'The house turns inward to a central courtyard that brings light and air to every room. From the street, a quiet facade; from inside, the sky.'),
    facts: { location: caption('Ciudad, País', 'City, Country'), area: '320 m²', status: BUILT, team: 'Olinda Hoyos + 2' },
    cardArt: 0,
    gallery: [
      { art: 0, caption: caption('Fachada', 'Facade') }, { art: 3, caption: caption('Patio', 'Courtyard') },
      { art: 2, caption: caption('Interior', 'Interior') }, { art: 5, caption: caption('Planta', 'Plan') },
    ],
  },
  {
    slug: 'edificio-mirador', cityIndex: 1, name: 'Edificio Mirador', year: 2024,
    kind: caption('Residencial', 'Residential'),
    summary: caption('Viviendas en altura con una terraza para cada planta.', 'Apartments with a terrace on every floor.'),
    description: caption(
      'Un edificio residencial que escalona sus terrazas para que cada vivienda tenga vistas y sol. La cubierta es un mirador común para los vecinos.',
      'A residential block that staggers its terraces so every home gets views and sun. The roof is a shared lookout for the neighbours.'),
    facts: { location: caption('Ciudad, País', 'City, Country'), area: '4 800 m²', status: BUILT, team: 'Olinda Hoyos + 6' },
    cardArt: 1,
    gallery: [
      { art: 1, caption: caption('Acceso', 'Entrance') }, { art: 4, caption: caption('Terrazas', 'Terraces') },
      { art: 3, caption: caption('Fachada', 'Facade') }, { art: 5, caption: caption('Planta tipo', 'Typical floor') },
    ],
  },
  {
    slug: 'taller-hoyos', cityIndex: 2, name: 'Taller Hoyos', year: 2024,
    kind: caption('Interiorismo', 'Interior design'),
    summary: caption('El taller del estudio: un interior de trabajo y maquetas.', 'The studio workshop: a space for work and models.'),
    description: caption(
      'La reforma del propio taller del estudio. Mesas largas, muros de maquetas y una única ventana que ordena todo el espacio.',
      'The refit of the studio’s own workshop. Long tables, walls of models and a single window that orders the whole space.'),
    facts: { location: caption('Ciudad, País', 'City, Country'), area: '180 m²', status: BUILT, team: 'Olinda Hoyos + 3' },
    cardArt: 2,
    gallery: [
      { art: 2, caption: caption('Taller', 'Workshop') }, { art: 0, caption: caption('Acceso', 'Entrance') },
      { art: 3, caption: caption('Maquetas', 'Models') }, { art: 5, caption: caption('Planta', 'Plan') },
    ],
  },
  {
    slug: 'residencia-arco', cityIndex: 3, name: 'Residencia Arco', year: 2023,
    kind: caption('Vivienda', 'Housing'),
    summary: caption('Una residencia que se abre al jardín bajo un gran arco.', 'A residence opening onto the garden under a large arch.'),
    description: caption(
      'Dos volúmenes escalonados que enmarcan un arco hacia el jardín. La luz entra filtrada por celosías de ladrillo.',
      'Two stepped volumes that frame an arch towards the garden. Light filters in through brick screens.'),
    facts: { location: caption('Ciudad, País', 'City, Country'), area: '540 m²', status: BUILT, team: 'Olinda Hoyos + 3' },
    cardArt: 3,
    gallery: [
      { art: 3, caption: caption('Celosía', 'Brick screen') }, { art: 1, caption: caption('Arco', 'Arch') },
      { art: 0, caption: caption('Jardín', 'Garden') }, { art: 5, caption: caption('Sección', 'Section') },
    ],
  },
  {
    // TEST with a real 3D model: "Tu Duc's Tomb - Stele Building (CyArk Dataset)" by Vasilis Haroupas,
    // CC BY (credit required). City sprites: scripts/blender/render_sprites.py.
    slug: 'tu-duc', cityIndex: 4, name: 'Pabellón de la Estela', year: 1867,
    kind: caption('Patrimonio', 'Heritage'),
    summary: caption('El pabellón de la estela de la tumba de Tự Đức, escaneado en 3D.', 'The stele pavilion of Tự Đức’s tomb, 3D scanned.'),
    description: caption(
      'Modelo de prueba: un escaneo real del pabellón que guarda la estela de la tumba del emperador Tự Đức, en Huế. Sirve para probar cómo se ve y rinde un proyecto real dentro de la ciudad.',
      'Test model: a real scan of the pavilion that houses the stele of Emperor Tự Đức’s tomb in Huế. It shows how a real project looks and performs inside the city.'),
    facts: { location: caption('Huế, Vietnam', 'Huế, Vietnam'), area: '680 m²', status: BUILT, team: 'CyArk · V. Haroupas (CC BY)' },
    cardArt: 4,
    model: { src: '/models/tu-duc.glb', small: '/models/tu-duc-m.glb' },
    gallery: [
      { src: '/projects/tu-duc/00.webp', width: 1600, height: 1000, caption: caption('Acceso', 'Entrance') },
      { src: '/projects/tu-duc/01.webp', width: 1600, height: 1000, caption: caption('Lateral', 'Side') },
      { src: '/projects/tu-duc/02.webp', width: 1600, height: 1000, caption: caption('Posterior', 'Rear') },
      { src: '/projects/tu-duc/03.webp', width: 1600, height: 1000, caption: caption('Lateral', 'Side') },
    ],
  },
  {
    slug: 'torre-ventana', cityIndex: 5, name: 'Torre Ventana', year: 2026,
    kind: caption('Oficinas', 'Offices'),
    summary: caption('Oficinas con una gran ventana hacia la ciudad.', 'Offices with a large window onto the city.'),
    description: caption(
      'Una torre de oficinas compacta cuya fachada se perfora con una gran ventana de doble altura en cada planta.',
      'A compact office tower whose facade is cut by a large double-height window on every floor.'),
    facts: { location: caption('Ciudad, País', 'City, Country'), area: '6 200 m²', status: caption('En obra', 'Under construction'), team: 'Olinda Hoyos + 8' },
    cardArt: 5,
    gallery: [
      { art: 5, caption: caption('Fachada', 'Facade') }, { art: 3, caption: caption('Ventana', 'Window') },
      { art: 2, caption: caption('Oficina', 'Office') }, { art: 0, caption: caption('Planta', 'Plan') },
    ],
  },
];

export const getProject = (slug: string) => projects.find(p => p.slug === slug);
/** Projects ordered by their building index in the city render. */
export const byCityIndex = [...projects].sort((a, b) => a.cityIndex - b.cityIndex);
