# OH Studio — web

Portfolio site for OH Studio (Olinda Hoyos). Next.js 16 (App Router, static generation), GSAP + ScrollTrigger, Lenis, Tailwind 4. Spanish and English (`/es`, `/en`).

```bash
npm install
npm run dev            # http://localhost:3000 → redirects to /es or /en
npm run build && npm start
```

Copy `.env.example` to `.env.local` and fill what you need (fonts, contact form, render CDN). Everything works without it.

## How the site works

The city is **not real-time 3D**. It is a sequence of pre-rendered frames that one fixed `<canvas>` plays back, driven by scroll (home) or by dragging (project viewer). Cards, route, headline and UI are HTML/SVG on top, positioned from per-frame **anchor** data exported with the renders.

| Scene (prototype) | Where | Sequence |
|---|---|---|
| Hero → scroll into the city | `/[lang]` (`HomeExperience`) | `city` — scrubbed by scroll |
| City: cards, route, project bar | `/[lang]` | last `city` frame + anchors |
| Focus: zoom to the building | `/[lang]/proyectos/[slug]` | `dive:<slug>` — played on arrival, reversed on "← Ciudad" |
| Orbit: drag to rotate | same page (`ProjectViewer`) | `orbit:<slug>` — 360° turntable |
| Photos & info | same page (`ProjectDetail`) | — |
| Studio · Services · Contact | home, below the city | — |
| Logo → back to the hero | `Nav` | scrolls to top, the scroll timeline plays in reverse |

Key files:

- `src/lib/renders/frames.ts` — frame loader/decoder (progressive download, small decoded LRU window)
- `src/lib/stage.ts` — the single canvas: repaints only when the frame changes
- `src/components/home/HomeExperience.tsx` — scroll choreography (timings in `T`)
- `src/components/project/ProjectViewer.tsx` — dive, turntable, drag/inertia, zoom
- `src/content/projects.ts` — projects (bilingual); `src/i18n/dictionaries.ts` — UI copy
- `public/renders/manifest.json` — sequences, frame counts and anchors

## The living city

The frames hold everything static (streets, sidewalks, crossings, shadows, facades). On top, `src/lib/life/cityLife.ts` simulates and draws in real time: cars that keep their lane and distance and stop at red lights, traffic lights cycling at every junction (a green wave), and people walking around the blocks, through the parks and across the zebra crossings on the walk signal. Scrolling only moves the camera; the city keeps living.

It lines up with each frame through two files the render pipeline writes:

- `manifest.json` → `cam` per sequence: the camera of every frame (`[k, tx, ty, theta, fz]`).
- `city-life.json` → the street grid and every building volume, so anything behind a building in that view is hidden.

Nothing appears or vanishes out of nowhere: cars drive closed routes around groups of blocks (rounded turns, stop lines, keeping distance from whoever is ahead in their lane, also across routes), and people walk around their block, wait at the kerb and cross to the next block on the walk signal. When anything passes behind a building, that building's pixels are restored from the frame on top of it, so it is hidden progressively.

Density lives in `DENSITY` at the top of `cityLife.ts` (about 150 cars and 240 people on desktop; phones get 30% fewer, decided at load). Measured cost: ~2 ms of main thread per frame on desktop, 60 fps on a phone simulated at 6× slower CPU. Phones repaint it at ~30 fps; `prefers-reduced-motion` freezes it. Real renders without `cam` data simply show no live layer. For Blender renders, the camera per frame can be exported alongside the anchors.

## Render pipeline

The six projects are **test projects** and the frames in `public/renders` are **placeholders** generated from the design prototype's procedural city (`npm run renders`). Replace them with real renders as follows.

### What to render

Two orientations per shot: **landscape 1920×1080** (`d`) and **portrait 720×1280** (`m`, phones). Same camera path and the same frame count for both.

| Shot | Frames | Camera |
|---|---|---|
| `city` | ~120 | From the hero view (wide, high) to the city view framing all projects. In portrait, keep projects in the upper ~60% (a card carousel covers the bottom). |
| `dive:<slug>` | ~60 | From exactly the last `city` frame to a close view of the project. Buildings in front can fade (ghost). |
| `orbit:<slug>` | 72 (5° steps) | 360° turntable around the project. Frame 0 must equal the last `dive` frame. Any count works; it's spread over 360°. |

Rules: keep the projects' materials neutral (the UI carries the brand colours), and keep a matching frame where shots meet (city→dive→orbit), so cuts are invisible.

### Recommended tools

The architect's models come from **Revit / SketchUp / AutoCAD**. Do the camera work and rendering in **Blender** (free):

1. Model the generic city (or generate it; e.g. a Blender add-on or OSM import) and import the projects: SketchUp → `.dae`/`.fbx`, Revit → `.fbx` or IFC (BlenderBIM/Bonsai).
2. Animate the cameras for each shot; render with Cycles or EEVEE to PNG sequences.
3. Put an empty on each project roof named `anchor_00`, `anchor_01`… (number = `cityIndex`) and export anchors for the city shot:
   `blender city.blend --background --python scripts/blender/export_anchors.py -- --out anchors-city-d.json`

Images from another renderer (D5, Lumion, Enscape, V-Ray) work too, as long as the camera path matches the Blender one used for the anchors. Photoshop is fine for colour-grading the frames in batch.

### Import

```bash
npm run import-renders -- --seq city --tier d --src ~/renders/city-d --anchors anchors-city-d.json
npm run import-renders -- --seq city --tier m --src ~/renders/city-m --anchors anchors-city-m.json
npm run import-renders -- --seq dive:pabellon-lima --tier d --src ~/renders/pabellon-dive-d
npm run import-renders -- --seq orbit:pabellon-lima --tier d --src ~/renders/pabellon-orbit-d
```

This converts to WebP (quality 72), resizes to the tier and updates the manifest.

### A real model inside the placeholder city

Before rendering a whole city, a real model can stand in one of the placeholder lots. The city is an exact orthographic projection, so an orthographic Blender camera reproduces it and the model is drawn into every `city`, `dive` and `orbit` frame with correct depth:

```bash
blender --background --python scripts/blender/render_sprites.py -- --glb model.glb --out assets/models/<name> --m-per-cell 19.6 [--yaw 0] [--preview]
```

`--m-per-cell 19.6` puts a model in metres at the city's scale (a floor every 4 height units ≈ 3.2 m); without it the model is fitted to one lot (`--cells 0.9`). It renders one transparent sprite per orbit step (72) plus `sprite.json`. In `scripts/city/geometry.ts` set `sprite: 'assets/models/<name>'` on the project's lot and describe its volumes in `parts` (shadow, height, what hides cars and people); the script prints the footprint and height. A model larger than its lot needs `clear: 1`, which empties its block.

### Live 3D view

With a web model the project page becomes a live 3D city instead of playing `orbit` frames: the camera orbits the project smoothly, all the way round, from almost overhead to almost the horizon, closer or further (pinch on touch screens and trackpads, or the + / − buttons; a plain wheel still scrolls the page). The project stays put on its lot.

The city is not a separate model: `src/lib/city3d/scene.ts` rebuilds the placeholder city from `city-scene.json` (written by `npm run renders` from `scripts/city/geometry.ts`) with the frames' own rules: palette, a shaded side turned to the right of the screen, outlines, windows, shopfronts, parapets, street markings, canal, bridges, trees, lamps and cast shadows; buildings between the camera and the project turn see-through as in the dive. Cars, people and traffic lights come from the same simulation as the frames (`src/lib/city3d/life.ts`, reading `cityLife`). The 3D view opens on exactly the dive's last frame (same projection, scale and screen position) and fades in over it. Once real Blender renders replace the placeholder city, export that city to glTF and load it in place of `buildCity`.

Export the project's model in two versions from the same script (one mesh, JPEG textures, Draco):

```bash
blender --background --python scripts/blender/render_sprites.py -- --glb model.glb --web public/models/<slug>.glb   --m-per-cell 19.6 --web-tex 2048
blender --background --python scripts/blender/render_sprites.py -- --glb model.glb --web public/models/<slug>-m.glb --m-per-cell 19.6 --web-tex 1024
```

and set `model: { src: '/models/<slug>.glb', small: '/models/<slug>-m.glb' }` on the project in `src/content/projects.ts`; `npm run renders` then skips its orbit frames.

Cost (`src/components/project/ModelView.tsx`): one opaque canvas and ~12 draw calls per frame (static city merged, everything that moves instanced, no shadow maps: shadows are the frames' polygons); 60 fps on desktop, 30 on phones; with reduced motion nothing moves and it draws only on input; the stage stops painting while the 3D view covers it. Touch and low-memory devices get the 1024 px textures (a quarter of the GPU memory; the mesh is cheap, so both keep ~250k triangles: decimating harder shows the scan's gaps as dark specks); the drawing buffer is capped at ~2.4 MP; MSAA is off on dense screens; geometry and textures are dropped from RAM once on the GPU. The Draco decoder is served from `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf/`).

## Adding a real project

1. Add an entry to `src/content/projects.ts` (slug, `cityIndex`, ES/EN copy, facts). Real photos: put them in `public/projects/<slug>/` and use `{ src, width, height, caption }` gallery items.
2. Import its `dive:<slug>` and `orbit:<slug>` sequences (both tiers) and the city with its anchor.
3. If you add more than six projects, add card offsets in `CARD_OFF` (`HomeExperience.tsx`) and extend `ROUTE`.

## Fonts

Neue Haas Grotesk is licensed. With Adobe Creative Cloud (Photoshop includes it) it's free for web use through Adobe Fonts: create a Web Project with *Neue Haas Grotesk Display* and *Neue Haas Grotesk Text*, put its ID in `NEXT_PUBLIC_ADOBE_FONTS_KIT`. Without it the site falls back to Helvetica Neue / Arial.

## Deploy

Vercel (recommended). For production move `public/renders` to a CDN bucket (Cloudflare R2 or similar) with the same folder structure and set `NEXT_PUBLIC_RENDERS_URL`; frames are then cached at the edge and don't count against the app bundle. Serve them with `Cache-Control: public, max-age=31536000, immutable` and re-upload under a new folder when renders change.

## Performance notes

- One canvas, drawn only when the frame index changes; nothing runs while the page is idle.
- Frames download in passes (every 8th, 4th, 2nd, all), so the whole scroll is usable early; project sequences load only on hover/tap.
- At most 12 (desktop) / 16 (phone) frames are kept decoded; the canvas stops painting when covered by content.
- Per-frame UI updates write styles directly (no React re-renders); only `transform`/`opacity`/`clip-path` change.
- Phones use native scrolling (no smooth-scroll hijack) and their own lighter portrait frames.
- `prefers-reduced-motion`: scroll animations become simple state changes and the dive is skipped.
