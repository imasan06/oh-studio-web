// Procedural placeholder city, ported from the design prototype (arq-scene-v2.jsx).
// It stands in for the real renders: same camera moves, same anchor data, so the site
// works identically once the studio's rendered frames replace these.
//
// The frames carry everything static (streets, sidewalks, crossings, shadows, facades).
// Everything that moves (cars, people, traffic lights) is drawn live in the browser on top,
// from the per-frame camera and the building volumes exported by lifeData().

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const C = {
  bg: '#F4F5F2', ink: '#1F2421', lime: '#C5E063', cobalt: '#0129FA', line: '#D6D9D4',
  n1: '#E6E9E4', n2: '#CDD1CB', st: '#B4B9B2', mid: '#5E6560',
};
export const DW = 1920, DH = 1080, CX = 960, CY = 540; // design space of the prototype

export const N = 48, OFF = 17, A = 20, B = 10;
export const L = (x: number, y: number, z: number): [number, number] => [(x - y) * A, (x + y - N) * B - z];

const NEU = ['#F8F9F6', '#EDEFEB', '#E0E3DE'];
const CITY_ST = '#CBCFC9', PARK = '#E3E8DC', WATER = '#DDE3E6', TREE = '#C9D1C2';
const PAL = {
  cobalt: ['#F4F5F2', '#3A403C', '#2A2F2C'], lime: ['#D6D9D4', '#737974', '#5E6560'],
  gl: ['#D6D9D4', '#3A403C', '#2A2F2C'], gc: ['#8C928D', '#5E6560', '#4A504C'],
  cl: ['#FFFFFF', '#5E6560', '#4A504C'], wc: ['#3A403C', '#8C928D', '#737974'],
  glass: ['#E6E9E4', '#A8AEA8', '#8C928D'],
};

export type Part = { dx: number; dy: number; w: number; d: number; z0: number; h: number; c: string[]; stroke?: boolean };
/**
 * `sprite`: folder of a real model rendered by scripts/blender/render_sprites.py. It is drawn instead
 * of the boxes; the parts then only describe its volumes (shadow, height, what hides cars and people).
 * `clear`: cells around the lot left without city buildings (1 = the whole block), for models
 * larger than one cell at real scale.
 */
export type ProjectModel = { x: number; y: number; parts: Part[]; sprite?: string; clear?: number };

// Six test projects. Grid positions match the prototype; each gets a small multi-volume model.
export const PROJECTS: ProjectModel[] = [
  { x: 5, y: 1, parts: [
    { dx: 0.05, dy: 0.05, w: 0.9, d: 0.9, z0: 0, h: 12, c: PAL.cl },
    { dx: 0.18, dy: 0.18, w: 0.64, d: 0.64, z0: 12, h: 58, c: PAL.gl },
    { dx: 0.3, dy: 0.3, w: 0.4, d: 0.4, z0: 70, h: 8, c: PAL.lime },
  ] },
  { x: 9, y: 5, parts: [
    { dx: 0.05, dy: 0.05, w: 0.9, d: 0.9, z0: 0, h: 56, c: PAL.lime },
    { dx: 0.15, dy: 0.15, w: 0.7, d: 0.7, z0: 56, h: 6, c: PAL.cl },
  ] },
  { x: 1, y: 5, parts: [
    { dx: 0.05, dy: 0.05, w: 0.9, d: 0.5, z0: 0, h: 52, c: PAL.gl },
    { dx: 0.05, dy: 0.55, w: 0.9, d: 0.4, z0: 0, h: 30, c: PAL.cl },
  ] },
  { x: 5, y: 9, parts: [
    { dx: 0.05, dy: 0.05, w: 0.9, d: 0.9, z0: 0, h: 40, c: PAL.gc },
    { dx: 0.1, dy: 0.1, w: 0.55, d: 0.8, z0: 40, h: 30, c: PAL.gc },
  ] },
  // Tu Duc's Tomb, Stele Building (CyArk scan, CC BY): a real model rendered in Blender at real
  // scale (26 m terrace = 1.36 cells), standing alone in its block like a square
  { x: 9, y: 9, sprite: 'assets/models/tu-duc', clear: 1, parts: [
    { dx: -0.18, dy: -0.17, w: 1.36, d: 1.34, z0: 0, h: 2.3, c: PAL.cl },
    { dx: 0.08, dy: 0.08, w: 0.84, d: 0.84, z0: 0, h: 20, c: PAL.cl },
  ] },
  { x: 13, y: 1, parts: [
    { dx: 0.05, dy: 0.05, w: 0.9, d: 0.9, z0: 0, h: 56, c: PAL.wc, stroke: true },
  ] },
].map(p => ({ ...p, x: p.x + OFF, y: p.y + OFF }));

export const projectHeight = (i: number) => Math.max(...PROJECTS[i].parts.map(p => p.z0 + p.h));

/** Sprite box relative to the projected cell centre (city design units, y down), from render_sprites.py. */
type SpriteMeta = { x: number; y: number; w: number; h: number; steps: number };
const SPRITES = new Map<string, { meta: SpriteMeta; png: Map<number, string> }>();
function sprite(dir: string, theta: number) {
  let s = SPRITES.get(dir);
  if (!s) SPRITES.set(dir, (s = { meta: JSON.parse(readFileSync(path.join(dir, 'sprite.json'), 'utf8')), png: new Map() }));
  const step = Math.round((theta / 360) * s.meta.steps) % s.meta.steps;
  let png = s.png.get(step);
  if (!png) s.png.set(step, (png = readFileSync(path.join(dir, `${String(step).padStart(3, '0')}.png`)).toString('base64')));
  return { meta: s.meta, png };
}

const PARKS = [[1, 1], [-2, 2], [3, -2], [-1, -3], [4, 3]];
const RIVER = -5;

// ---------- street network ----------
// Every 4th cell is a street, one cell wide: [s, s + 1]. A "col" street runs along y at x = s,
// a "row" street along x at y = s. Inside the cell: sidewalks of 0.16 at both edges, a two-lane
// road in between. The col street at CANAL is water instead of road.
export const STREETS = Array.from({ length: N / 4 }, (_, k) => k * 4); // 0, 4, … 44
export const CANAL = OFF + RIVER;
export const WALK = 0.16;

const ROAD = '#D3D6D0', SIDEWALK = '#E9EBE6', CURB = '#C6CAC4', MARK = '#FAFBF8', PATH = '#EEF0EA';
const WIN = ['#DCE1E1', '#CED4D4'], WIN_LIT = '#F1F3F1', SHOP = '#C8CECD', GREEN_ROOF = '#E2E7D9';
const SHADOW_DIR: [number, number] = [0.024, 0.009]; // world cells of shadow per unit of height (light from the upper left)

const hash = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

type Item =
  | { type: 'b'; x: number; y: number; w: number; d: number; h: number; top: { s: number; h: number } | null; k: number; r: number }
  | { type: 'p'; idx: number; x: number; y: number; w: number; d: number; k: number }
  | { type: 't' | 'l'; x: number; y: number; k: number; w?: undefined; d?: undefined };

const CITY = (() => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const m4 = (v: number) => ((v % 4) + 4) % 4;
  const items: Item[] = [];
  const plates: { bx: number; by: number; park: boolean }[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const li = i - OFF, lj = j - OFF;
    if (m4(li) === 3 || m4(lj) === 3) continue;
    if (PARKS.some(([m, n]) => li >= 4 * m && li <= 4 * m + 2 && lj >= 4 * n && lj <= 4 * n + 2)) continue;
    if (PROJECTS.some(p => p.x === i && p.y === j)) continue;
    if (rnd() < 0.12) continue;
    const w = 0.62 + rnd() * 0.3, d = 0.62 + rnd() * 0.3;
    const dist = Math.hypot(li - 6.5, lj - 6.5);
    let h = 5 + rnd() * 11 + Math.max(0, 12 - dist * 1.5) * rnd();
    const r2 = rnd(), tower = r2 < 0.05 && dist > 9, low = r2 > 0.84;
    const ww = tower ? 0.5 : low ? 0.9 : w, dd = tower ? 0.5 : low ? 0.9 : d;
    if (tower) h = 26 + rnd() * 12; else if (low) h = 3 + rnd() * 3;
    const top = !tower && !low && h > 16 && rnd() < 0.3 ? { s: 0.55, h: 4 + rnd() * 8 } : null;
    // dropped after drawing its random numbers, so clearing a block leaves the rest of the city as it was
    if (PROJECTS.some(p => p.clear && Math.abs(p.x - i) <= p.clear && Math.abs(p.y - j) <= p.clear)) continue;
    items.push({ type: 'b', x: i + (1 - ww) / 2, y: j + (1 - dd) / 2, w: ww, d: dd, h, top, k: i + j + (ww + dd) / 2, r: hash(i, j) });
  }
  PROJECTS.forEach((p, idx) => items.push({ type: 'p', idx, x: p.x + 0.05, y: p.y + 0.05, w: 0.9, d: 0.9, k: p.x + p.y + 0.9 }));
  PARKS.forEach(([m, n]) => {
    const cnt = 4 + Math.floor(rnd() * 3);
    for (let q = 0; q < cnt; q++) {
      // keep trees off the park's walking loop (radius 1 around the centre)
      let tx = 0, ty = 0;
      for (let tries = 0; tries < 8; tries++) {
        tx = OFF + 4 * m + 0.35 + rnd() * 2.3; ty = OFF + 4 * n + 0.35 + rnd() * 2.3;
        const rr = Math.hypot(tx - (OFF + 4 * m + 1.5), ty - (OFF + 4 * n + 1.5));
        if (Math.abs(rr - 1) > 0.22) break;
      }
      items.push({ type: 't', x: tx, y: ty, k: tx + ty + 0.2 });
    }
  });
  // street lamps at mid-block on the sidewalks
  for (const s of STREETS) for (const t of STREETS) {
    if (rnd() > 0.35 || s === CANAL) continue;
    const lx = s + 1 - WALK / 2, ly = t + 2.5;
    if (ly > N - 0.5) continue;
    items.push({ type: 'l', x: lx, y: ly, k: lx + ly });
  }
  items.sort((p, q) => p.k - q.k);
  for (let m = -5; m < 8; m++) for (let n = -5; n < 8; n++) {
    const bx = OFF + 4 * m, by = OFF + 4 * n;
    if (bx < 0 || by < 0 || bx > N - 3 || by > N - 3) continue;
    plates.push({ bx, by, park: PARKS.some(([pm, pn]) => pm === m && pn === n) });
  }
  return { items, plates };
})();

// ---------- camera ----------

/** Design-space camera: the iso point (fx, fy) lands on design-screen point (sx, sy) at zoom k. */
export type Cam = { k: number; fx: number; fy: number; sx: number; sy: number };
/** Output frame: pixel size and design→output scale. The visible window is centred on the design centre. */
export type Frame = { w: number; h: number; s: number };
export type Shot = { cam: Cam; theta: number; pivot: [number, number]; fz: number; focus: number | null };

type View = { th: number; rot: (x: number, y: number) => [number, number] };
function makeView(theta: number, pivot: [number, number]): View {
  const t = ((theta % 360) + 360) % 360, th = t < 0.01 || t > 359.99 ? 0 : t;
  const co = Math.cos((th * Math.PI) / 180), si = Math.sin((th * Math.PI) / 180);
  const rot = th === 0
    ? (x: number, y: number): [number, number] => [x, y]
    : (x: number, y: number): [number, number] => [pivot[0] + (x - pivot[0]) * co - (y - pivot[1]) * si, pivot[1] + (x - pivot[0]) * si + (y - pivot[1]) * co];
  return { th, rot };
}

/** Projects world (x, y, z) straight to output pixels. */
function projector(shot: Shot, fr: Frame) {
  const V = makeView(shot.theta, shot.pivot);
  const { k, fx, fy, sx, sy } = shot.cam;
  const tx = sx - fx * k, ty = sy - fy * k;
  const ox = CX - fr.w / (2 * fr.s), oy = CY - fr.h / (2 * fr.s);
  const toOut = (l: [number, number]): [number, number] => [(tx + l[0] * k - ox) * fr.s, (ty + l[1] * k - oy) * fr.s];
  const P = (x: number, y: number, z: number) => { const r = V.rot(x, y); return toOut(L(r[0], r[1], z)); };
  return { V, P, unit: k * fr.s, toOut };
}

/** Per-frame camera for the live layer: [k, tx, ty, theta, fz]. */
export function camOf(shot: Shot): number[] {
  const { k, fx, fy, sx, sy } = shot.cam;
  return [+k.toFixed(5), +(sx - fx * k).toFixed(2), +(sy - fy * k).toFixed(2), +shot.theta.toFixed(3), +shot.fz.toFixed(3)];
}

export function anchors(shot: Shot, fr: Frame): [number, number][] {
  const { P } = projector(shot, fr);
  return PROJECTS.map((p, i) => {
    const o = P(p.x + 0.5, p.y + 0.5, projectHeight(i));
    return [+(o[0] / fr.w).toFixed(4), +(o[1] / fr.h).toFixed(4)];
  });
}

/**
 * Everything the live 3D city (src/lib/city3d) rebuilds the frames from: the same items, palette and
 * street grid, so the 3D view and the rendered frames show one and the same city.
 */
export function sceneData() {
  const r3 = (v: number) => +v.toFixed(3);
  const buildings: number[][] = [], trees: number[][] = [], lamps: number[][] = [];
  for (const it of CITY.items) {
    if (it.type === 'b') buildings.push([r3(it.x), r3(it.y), r3(it.w), r3(it.d), r3(it.h), it.top ? it.top.s : 0, it.top ? r3(it.top.h) : 0, r3(it.r)]);
    else if (it.type === 't') trees.push([r3(it.x), r3(it.y)]);
    else if (it.type === 'l') lamps.push([r3(it.x), r3(it.y)]);
  }
  return {
    N, A, B, CX, CY, off: OFF, walk: WALK, streets: STREETS, canal: CANAL, shadowDir: SHADOW_DIR,
    palette: {
      bg: C.bg, ink: C.ink, lime: C.lime, st: C.st, n1: C.n1, neu: NEU, cityStroke: CITY_ST, park: PARK, water: WATER, tree: TREE,
      road: ROAD, sidewalk: SIDEWALK, curb: CURB, mark: MARK, path: PATH, win: WIN, winLit: WIN_LIT, shop: SHOP, greenRoof: GREEN_ROOF,
    },
    plates: CITY.plates.map(p => [p.bx, p.by, p.park ? 1 : 0]),
    buildings, trees, lamps,
    projects: PROJECTS.map(p => ({
      x: p.x, y: p.y, sprite: !!p.sprite,
      parts: p.parts.map(q => ({ dx: q.dx, dy: q.dy, w: q.w, d: q.d, z0: q.z0, h: q.h, c: q.c, stroke: !!q.stroke })),
    })),
  };
}
export type SceneData = ReturnType<typeof sceneData>;

/** Static data the live layer needs: the street grid and every volume that can hide a car or a person. */
export function lifeData() {
  const r3 = (v: number) => +v.toFixed(3);
  const occluders: number[][] = [];
  for (const b of CITY.items) {
    if (b.type === 'b') occluders.push([r3(b.x), r3(b.y), r3(b.w), r3(b.d), r3(b.h + (b.top?.h ?? 0))]);
    if (b.type === 'p') {
      // every volume of the project (cantilevers included), each from the ground to its top
      const pm = PROJECTS[b.idx];
      for (const part of pm.parts) occluders.push([r3(pm.x + part.dx), r3(pm.y + part.dy), r3(part.w), r3(part.d), r3(part.z0 + part.h)]);
    }
  }
  return {
    N, A, B, CX, CY, walk: WALK, streets: STREETS, canal: CANAL,
    blocks: CITY.plates.map(p => [p.bx, p.by, p.park ? 1 : 0]),
    occluders,
  };
}

// ---------- svg ----------

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const pts = (r: [number, number][]) => r.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');

export function renderSVG(shot: Shot, fr: Frame): string {
  const { V, P, unit, toOut: proj } = projector(shot, fr);
  const out: string[] = [];
  const { k } = shot.cam;
  const strokeUnit = Math.sqrt(k) * 1.6 * fr.s; // thin lines stay thin when the camera zooms in
  const sw = (n: number) => f1(Math.max(0.35, n * strokeUnit));
  const onCanvas = (r: [number, number][]) => !(r.every(o => o[0] < 0) || r.every(o => o[0] > fr.w) || r.every(o => o[1] < 0) || r.every(o => o[1] > fr.h));
  const quadW = (x0: number, y0: number, x1: number, y1: number, z = 0): [number, number][] => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
  const fillPoly = (r: [number, number][], fill: string, extra = '') => { if (onCanvas(r)) out.push(`<polygon points="${pts(r)}" fill="${fill}"${extra}/>`); };

  type Tex = { r: number; shop: boolean; roof: boolean };
  const box = (x: number, y: number, w: number, d: number, z0: number, h: number, c: string[], stroke: boolean, floors: boolean, op: number, tex?: Tex) => {
    const cr = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(p => V.rot(p[0], p[1]));
    const sp = stroke ? ` stroke="${CITY_ST}" stroke-width="${sw(0.5)}" stroke-linejoin="round"` : '';
    const g: string[] = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const poly = (r: [number, number][]) => { for (const [px, py] of r) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return pts(r); };
    const q = (pp: number[], z: number) => proj(L(pp[0], pp[1], z));
    for (let e = 0; e < 4; e++) {
      const p0 = cr[e], p1 = cr[(e + 1) % 4], nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]);
      if (nx + ny <= 1e-6) continue;
      const shaded = nx > ny;
      g.push(`<polygon points="${poly([q(p0, z0), q(p1, z0), q(p1, z0 + h), q(p0, z0 + h)])}" fill="${shaded ? c[2] : c[1]}"${sp}/>`);
      if (floors) for (let zz = z0 + 4; zz < z0 + h - 1; zz += 4) {
        const a = q(p0, zz), b = q(p1, zz);
        g.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c[0]}" stroke-width="${sw(0.5)}" stroke-opacity="0.6"/>`);
      }
      // facade texture: storefronts on the ground floor, windows (or ribbon glazing when far) above
      if (tex && unit >= 1.0) {
        const at = (u: number): number[] => [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
        const quadF = (u0: number, u1: number, za: number, zb: number, fill: string) =>
          g.push(`<polygon points="${pts([q(at(u0), za), q(at(u1), za), q(at(u1), zb), q(at(u0), zb)])}" fill="${fill}"/>`);
        const win = shaded ? WIN[1] : WIN[0];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (tex.shop && z0 === 0 && h > 6) quadF(0.06, 0.94, 0.35, 2.7, SHOP);
        for (let fz = z0 + 4; fz + 3 <= z0 + h - 0.6; fz += 4) {
          if (unit >= 2.2) {
            const n = Math.max(1, Math.round(len / 0.16));
            for (let j = 0; j < n; j++) quadF((j + 0.22) / n, (j + 0.78) / n, fz + 0.9, fz + 2.9, hash(x * 7 + j, fz + e) > 0.86 ? WIN_LIT : win);
          } else {
            quadF(0.08, 0.92, fz + 1.1, fz + 2.7, win);
          }
        }
      }
    }
    const topRing = cr.map(p => proj(L(p[0], p[1], z0 + h)));
    g.push(`<polygon points="${poly(topRing)}" fill="${tex && tex.r > 0.88 ? GREEN_ROOF : c[0]}"${sp}/>`);
    if (tex?.roof && unit >= 1.4) {
      // parapet: the roof edge seen as an inset line
      const cx = (cr[0][0] + cr[2][0]) / 2, cy = (cr[0][1] + cr[2][1]) / 2;
      const inset = cr.map(p => proj(L(cx + (p[0] - cx) * 0.86, cy + (p[1] - cy) * 0.86, z0 + h)));
      g.push(`<polygon points="${pts(inset)}" fill="none" stroke="${CITY_ST}" stroke-width="${sw(0.35)}"/>`);
    }
    // resvg panics on an opacity layer that lies entirely off-canvas; skipping those also trims the file
    if (x1 < 0 || y1 < 0 || x0 > fr.w || y0 > fr.h) return;
    out.push(op < 1 ? `<g opacity="${op.toFixed(2)}">${g.join('')}</g>` : g.join(''));
  };

  const padX = (140 + 30 * k) * fr.s, padY = (140 + 60 * k) * fr.s;
  const vis = (o: [number, number]) => o[0] > -padX && o[0] < fr.w + padX && o[1] > -padX && o[1] < fr.h + padY;

  const ghost = (x: number, y: number) => {
    if (shot.fz <= 0.01 || shot.focus === null) return 1;
    const pr = V.rot(shot.pivot[0], shot.pivot[1]), pSum = pr[0] + pr[1];
    const r = V.rot(x, y);
    const ds = r[0] + r[1] - pSum, dd = Math.abs((r[0] - r[1]) - (pr[0] - pr[1]));
    return ds > 0.2 && ds < 7 && dd < 3.2 ? 1 - 0.82 * shot.fz : 1;
  };

  // --- ground: asphalt everywhere, then each block with its sidewalk ring and curb
  out.push(`<rect x="0" y="0" width="${fr.w}" height="${fr.h}" fill="${C.bg}"/>`);
  out.push(`<polygon points="${pts(quadW(0, 0, N, N))}" fill="${ROAD}"/>`);
  for (const p of CITY.plates) {
    if (!vis(P(p.bx + 1.5, p.by + 1.5, 0))) continue;
    fillPoly(quadW(p.bx - WALK, p.by - WALK, p.bx + 3 + WALK, p.by + 3 + WALK), SIDEWALK, ` stroke="${CURB}" stroke-width="${sw(0.4)}"`);
    fillPoly(quadW(p.bx, p.by, p.bx + 3, p.by + 3), p.park ? PARK : C.n1);
    if (p.park && unit >= 0.9) {
      // the park's walking loop
      const loop = Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return P(p.bx + 1.5 + Math.cos(a), p.by + 1.5 + Math.sin(a), 0); });
      out.push(`<polyline points="${pts(loop)}" fill="none" stroke="${PATH}" stroke-width="${f1(0.13 * A * unit)}" stroke-linejoin="round"/>`);
    }
  }

  // --- road markings: centre dashes between junctions, zebra crossings and stop lines at each junction
  if (unit >= 0.9) {
    const dash = f1(0.09 * A * unit), gap = f1(0.07 * A * unit), mw = sw(0.45);
    const seg = (a: [number, number], b: [number, number], extra = '') => {
      if (onCanvas([a, b])) out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${MARK}" stroke-width="${mw}"${extra}/>`);
    };
    for (const s of STREETS) for (let t = -4; t < N; t += 4) {
      const a = Math.max(0, t + 1.4), b = Math.min(N, t + 3.6);
      if (b <= a) continue;
      if (s !== CANAL && vis(P(s + 0.5, (a + b) / 2, 0))) seg(P(s + 0.5, a, 0), P(s + 0.5, b, 0), ` stroke-dasharray="${dash} ${gap}"`);
      if (vis(P((a + b) / 2, s + 0.5, 0)) && !(a < CANAL + 1 && b > CANAL)) seg(P(a, s + 0.5, 0), P(b, s + 0.5, 0), ` stroke-dasharray="${dash} ${gap}"`);
    }
    for (const s of STREETS) for (const t of STREETS) {
      if (s === CANAL || !vis(P(s + 0.5, t + 0.5, 0))) continue;
      const stripes = (fixedLo: number, fixedHi: number, along: 'x' | 'y', lo: number, hi: number) => {
        for (let v = lo; v < hi - 0.03; v += 0.1) {
          const r = along === 'x' ? quadW(v, fixedLo, v + 0.055, fixedHi) : quadW(fixedLo, v, fixedHi, v + 0.055);
          fillPoly(r, MARK);
        }
      };
      // crossings over the col road (people walk along x) just outside the junction
      stripes(t - 0.3, t - 0.06, 'x', s + WALK + 0.03, s + 1 - WALK);
      stripes(t + 1.06, t + 1.3, 'x', s + WALK + 0.03, s + 1 - WALK);
      // crossings over the row road (people walk along y)
      stripes(s - 0.3, s - 0.06, 'y', t + WALK + 0.03, t + 1 - WALK);
      stripes(s + 1.06, s + 1.3, 'y', t + WALK + 0.03, t + 1 - WALK);
      // stop lines, one per approaching lane
      seg(P(s + 0.5, t - 0.36, 0), P(s + 1 - WALK, t - 0.36, 0));
      seg(P(s + WALK, t + 1.36, 0), P(s + 0.5, t + 1.36, 0));
      seg(P(s - 0.36, t + WALK, 0), P(s - 0.36, t + 0.5, 0));
      seg(P(s + 1.36, t + 0.5, 0), P(s + 1.36, t + 1 - WALK, 0));
    }
  }

  // --- the canal with quay edges, ripples and bridges
  const rx = CANAL;
  out.push(`<polygon points="${pts(quadW(rx, 0, rx + 1, N))}" fill="${WATER}"/>`);
  for (const xx of [rx, rx + 1]) { const a = P(xx, 0, 0), b = P(xx, N, 0); out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${CURB}" stroke-width="${sw(0.5)}"/>`); }
  if (unit >= 0.9) for (let yy = 0.6; yy < N; yy += 0.9) {
    const xr = rx + 0.25 + hash(yy, 3) * 0.4, a = P(xr, yy, 0), b = P(xr + 0.12, yy + 0.18, 0);
    if (vis(a)) out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#F4F7F8" stroke-width="${sw(0.5)}" stroke-linecap="round"/>`);
  }
  for (let n = -4; n <= 7; n++) {
    const by = OFF + 4 * n - 1; if (by < 0 || by > N - 1) continue;
    const a = P(rx - 0.1, by + 0.12, 0.8), b2 = P(rx + 1.1, by + 0.12, 0.8), c2 = P(rx + 1.1, by + 0.88, 0.8), d2 = P(rx - 0.1, by + 0.88, 0.8);
    if (!vis(a)) continue;
    const rail = 2 * unit;
    out.push(`<polygon points="${pts([a, b2, c2, d2])}" fill="${ROAD}" stroke="${CITY_ST}" stroke-width="${sw(0.5)}"/>`);
    out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1] - rail)}" x2="${f1(b2[0])}" y2="${f1(b2[1] - rail)}" stroke="${CITY_ST}" stroke-width="${sw(0.6)}"/>`);
    out.push(`<line x1="${f1(d2[0])}" y1="${f1(d2[1] - rail)}" x2="${f1(c2[0])}" y2="${f1(c2[1] - rail)}" stroke="${CITY_ST}" stroke-width="${sw(0.6)}"/>`);
  }

  // --- project pads
  // the lot, grown to any part that reaches past it
  PROJECTS.forEach(p => {
    const x0 = Math.min(0, ...p.parts.map(q => q.dx)), y0 = Math.min(0, ...p.parts.map(q => q.dy));
    const x1 = Math.max(1, ...p.parts.map(q => q.dx + q.w)), y1 = Math.max(1, ...p.parts.map(q => q.dy + q.d));
    fillPoly(quadW(p.x + x0 - 0.12, p.y + y0 - 0.12, p.x + x1 + 0.12, p.y + y1 + 0.12), C.lime, ' fill-opacity="0.8"');
  });

  // --- cast shadows (light fixed to the city, so they turn with it in the orbit views)
  const shadow = (x: number, y: number, w: number, d: number, h: number) => {
    const dx = SHADOW_DIR[0] * h, dy = SHADOW_DIR[1] * h;
    const r = [P(x, y, 0), P(x + w, y, 0), P(x + w + dx, y + dy, 0), P(x + w + dx, y + d + dy, 0), P(x + dx, y + d + dy, 0), P(x, y + d, 0)];
    if (onCanvas(r)) out.push(`<polygon points="${pts(r)}" fill="${C.ink}" fill-opacity="0.075"/>`);
  };
  const cx = (b: Item) => b.x + (b.w ?? 0) / 2, cy = (b: Item) => b.y + (b.d ?? 0) / 2;
  const visible = CITY.items.filter(b => vis(P(cx(b), cy(b), 0)));
  for (const b of visible) {
    if (b.type === 'b' && ghost(cx(b), cy(b)) === 1) shadow(b.x, b.y, b.w, b.d, b.h + (b.top?.h ?? 0));
    if (b.type === 'p') {
      const pm = PROJECTS[b.idx];
      if (pm.sprite) for (const part of pm.parts) shadow(pm.x + part.dx, pm.y + part.dy, part.w, part.d, part.z0 + part.h);
      else shadow(b.x, b.y, b.w, b.d, projectHeight(b.idx));
    }
    if (b.type === 't') { const o = P(b.x + 0.12, b.y + 0.05, 0); if (vis(o)) out.push(`<ellipse cx="${f1(o[0])}" cy="${f1(o[1])}" rx="${f1(7 * unit)}" ry="${f1(3.5 * unit)}" fill="${C.ink}" fill-opacity="0.07"/>`); }
  }

  // --- volumes, depth sorted
  const list = visible
    .map(b => {
      const r = V.rot(cx(b), cy(b));
      const s = V.th !== 0 ? r[0] + r[1] + ((b.w ?? 0) + (b.d ?? 0)) / 2 : b.type === 'b' || b.type === 'p' ? b.k : r[0] + r[1];
      return { b, s };
    })
    .sort((p, q) => p.s - q.s)
    .map(o => o.b);

  const u = unit;
  for (const b of list) {
    if (b.type === 't') {
      const b0 = P(b.x, b.y, 0), b1 = P(b.x, b.y, 8), cc = P(b.x, b.y, 12);
      out.push(`<line x1="${f1(b0[0])}" y1="${f1(b0[1])}" x2="${f1(b1[0])}" y2="${f1(b1[1])}" stroke="${C.st}" stroke-width="${sw(1.2)}"/>`);
      out.push(`<circle cx="${f1(cc[0])}" cy="${f1(cc[1])}" r="${f1(5.5 * u)}" fill="${TREE}"/><circle cx="${f1(cc[0] - 1.6 * u)}" cy="${f1(cc[1] - 1.8 * u)}" r="${f1(3 * u)}" fill="#D6DCCF"/>`);
    } else if (b.type === 'l') {
      const f = P(b.x, b.y, 0), tp = P(b.x, b.y, 10);
      out.push(`<ellipse cx="${f1(f[0])}" cy="${f1(f[1])}" rx="${f1(7 * u)}" ry="${f1(3.5 * u)}" fill="#FFFFFF" fill-opacity="0.7"/><line x1="${f1(f[0])}" y1="${f1(f[1])}" x2="${f1(tp[0])}" y2="${f1(tp[1])}" stroke="${CITY_ST}" stroke-width="${sw(0.8)}"/><circle cx="${f1(tp[0])}" cy="${f1(tp[1])}" r="${f1(1.6 * u)}" fill="#FFFFFF" stroke="${CITY_ST}" stroke-width="${sw(0.5)}"/>`);
    } else if (b.type === 'p') {
      const pm = PROJECTS[b.idx];
      const op = b.idx === shot.focus ? 1 : ghost(cx(b), cy(b));
      if (pm.sprite) {
        // the model turns about its own centre, so the orbit angle picks the sprite and the centre places it
        const { meta: m, png } = sprite(pm.sprite, V.th), o = P(pm.x + 0.5, pm.y + 0.5, 0);
        const x = o[0] + m.x * u, y = o[1] + m.y * u, w = m.w * u, h = m.h * u;
        if (x + w > 0 && y + h > 0 && x < fr.w && y < fr.h) {
          out.push(`<image href="data:image/png;base64,${png}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" preserveAspectRatio="none"${op < 1 ? ` opacity="${op.toFixed(2)}"` : ''}/>`);
        }
      } else {
        for (const part of pm.parts) box(pm.x + part.dx, pm.y + part.dy, part.w, part.d, part.z0, part.h, part.c, !!part.stroke, true, op);
      }
    } else if (b.type === 'b') {
      const op = ghost(cx(b), cy(b));
      const tex: Tex = { r: b.r, shop: b.r < 0.55, roof: !b.top };
      box(b.x, b.y, b.w, b.d, 0, b.h, NEU, true, false, op, tex);
      if (b.top) {
        const o = (1 - b.top.s) / 2;
        box(b.x + b.w * o, b.y + b.d * o, b.w * b.top.s, b.d * b.top.s, b.h, b.top.h, NEU, true, false, op, { ...tex, shop: false, roof: true });
      } else if (b.r < 0.4 && b.h > 6) {
        // rooftop plant room
        box(b.x + b.w * (0.2 + 0.4 * b.r), b.y + b.d * 0.3, b.w * 0.24, b.d * 0.22, b.h, 1.8, NEU, true, false, op);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fr.w}" height="${fr.h}" viewBox="0 0 ${fr.w} ${fr.h}">${out.join('')}</svg>`;
}
