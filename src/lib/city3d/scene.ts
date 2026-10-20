// The live 3D city: the city of the frames (scripts/city/geometry.ts) rebuilt in three.js from the
// same data (city-scene.json) and drawn by the same rules: flat brand neutrals, the side turned to the
// right of the screen is the shaded one, thin outlines, windows, shopfronts, parapets, street
// markings, the canal and its bridges and the same cast shadows. Buildings standing between the
// camera and the project turn see-through, as in the dive.
//
// World: x = city x, y = height (1 = one cell), z = city y. Colours go out exactly as written
// (sRGB, no lighting), like the SVG renderer, so the 3D view and the frames match.

import {
  type BufferAttribute, BufferGeometry, CustomBlending, DataTexture, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, RedFormat, ShaderMaterial, Uint8BufferAttribute, UnsignedByteType, Vector3,
} from 'three';
import type { SceneData } from '../../../scripts/city/geometry';

export type { SceneData };
type P2 = [number, number];
type RGB = [number, number, number];

/** City height units per world unit: the 2:1 projection draws one height unit as one design px. */
export const zUnit = (A: number) => A * Math.SQRT2 * Math.sqrt(3) / 2;
/** Design px per world unit across the screen. */
export const pxUnit = (A: number) => A * Math.SQRT2;

export function rgb(c: string): RGB {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+/g)!.map(Number);
  return [m[0], m[1], m[2]];
}
function dropArray(this: BufferAttribute) { (this as { array: unknown }).array = null; }
const hash = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

// ------------------------------------------------------------------------------------------------
// shaders

/** Face normals by side: 0 −y, 1 +x, 2 +y, 3 −x (city), 4 up. */
const SIDE_NORMAL = /* glsl */ `
vec3 sideNormal(float s) {
  return s < 0.5 ? vec3(0., 0., -1.) : s < 1.5 ? vec3(1., 0., 0.) : s < 2.5 ? vec3(0., 0., 1.) : s < 3.5 ? vec3(-1., 0., 0.) : vec3(0., 1., 0.);
}`;
const GHOST = /* glsl */ `
uniform sampler2D uGhost;
float ghostOf(float id) { return id < 0. ? 0. : texelFetch(uGhost, ivec2(int(mod(id, 1024.)), int(id / 1024.)), 0).r; }`;

const FACE_VS = /* glsl */ `
attribute float side; attribute vec3 cLit; attribute vec3 cShade; attribute vec3 cTop; attribute float bid;
attribute vec2 fuv; attribute vec2 fsize; attribute vec3 extra;
uniform vec3 uRight; uniform float uZUnit;
varying vec3 vColor; varying vec3 vTop; varying vec2 vUv; varying vec2 vSize; varying vec3 vExtra; varying float vH; varying float vGhost;
${SIDE_NORMAL}
${GHOST}
void main() {
  // the side facing the right of the screen is the shaded one, as in the frames
  vColor = mix(cLit, cShade, smoothstep(-0.02, 0.02, dot(sideNormal(side), uRight)));
  vTop = cTop; vUv = fuv; vSize = fsize; vExtra = extra; vH = position.y * uZUnit; vGhost = ghostOf(bid);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;
const FACE_FS = /* glsl */ `
uniform float uStroke; uniform vec3 uStrokeColor; uniform float uPass;
varying vec3 vColor; varying vec3 vTop; varying vec2 vUv; varying vec2 vSize; varying vec3 vExtra; varying float vH; varying float vGhost;
float line(float distPx, float halfWidth) { return 1. - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distPx); }
void main() {
  float a = 1. - 0.82 * vGhost;
  if (uPass < 0.5 ? a < 0.999 : a >= 0.999) discard;
  vec3 col = vColor;
  float flags = vExtra.x;
  vec2 fw = max(fwidth(vUv), vec2(1e-6));
  if (mod(flags, 2.) >= 1.) { // outline: half of the stroke falls inside each face
    vec2 d = min(vUv, vSize - vUv) / fw;
    col = mix(col, uStrokeColor, line(min(d.x, d.y), uStroke * 0.5));
  }
  if (mod(floor(flags / 2.), 2.) >= 1.) { // parapet: the roof edge as an inset line
    vec2 c = abs(vUv - vSize * 0.5), hs = vSize * 0.43, d = abs(c - hs) / fw;
    float dist = min(c.y <= hs.y ? d.x : 1e9, c.x <= hs.x ? d.y : 1e9);
    col = mix(col, uStrokeColor, line(dist, uStroke * 0.35));
  }
  if (mod(floor(flags / 4.), 2.) >= 1.) { // floor lines every 4 height units
    float t = (vH - vExtra.y) / 4., k = floor(t + 0.5);
    if (k >= 1. && vExtra.y + 4. * k < vExtra.z) col = mix(col, mix(col, vTop, 0.6), line(abs(t - k) * 4. / max(fwidth(vH), 1e-6), uStroke * 0.5));
  }
  gl_FragColor = vec4(col, a);
}`;

const GROUND_VS = /* glsl */ `
attribute vec4 color4; attribute float sid;
varying vec4 vColor;
${GHOST}
void main() {
  vColor = color4;
  vColor.a *= 1. - step(0.01, ghostOf(sid)); // a see-through building casts no shadow, as in the frames
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;
const GROUND_FS = /* glsl */ `
varying vec4 vColor;
void main() { if (vColor.a < 0.002) discard; gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a); } // premultiplied`;

/** Camera-facing quads: discs (canopies, lamps), rings, rects, and bars that stay upright (trunks, poles). */
const BOARD_VS = /* glsl */ `
attribute vec3 iPos; attribute vec2 iSize; attribute vec2 iOff; attribute vec4 iColor; attribute vec4 iMeta;
uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uToCam;
varying vec2 vLocal; varying vec4 vColor; varying float vKind; varying vec3 vStroke;
void main() {
  float kind = iMeta.x;
  vec3 up = kind > 2.5 ? vec3(0., 1., 0.) : uUp;
  vec3 right = kind > 2.5 ? normalize(vec3(uRight.x, 0., uRight.z)) : uRight;
  vec3 p = iPos + right * (iOff.x + position.x * iSize.x) + up * (iOff.y + position.y * iSize.y) + uToCam * iMeta.y;
  vLocal = position.xy * 2.; vColor = iColor; vKind = kind; vStroke = vec3(iMeta.zw, 0.);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const BOARD_FS = /* glsl */ `
uniform vec3 uStrokeColor;
varying vec2 vLocal; varying vec4 vColor; varying float vKind; varying vec3 vStroke;
void main() {
  vec3 col = vColor.rgb;
  if (vKind < 1.5) {
    float r = length(vLocal);
    if (r > 1.) discard;
    if (vKind > 0.5 && r > 1. - vStroke.x) col = uStrokeColor; // a disc with an outline
  }
  gl_FragColor = vec4(col, vColor.a);
}`;

// ------------------------------------------------------------------------------------------------
// buffers

class Faces {
  pos: number[] = []; side: number[] = []; lit: number[] = []; shade: number[] = []; top: number[] = []; bid: number[] = [];
  uv: number[] = []; size: number[] = []; extra: number[] = [];
  /** A quad p0..p3 (counter-clockwise seen from outside) with its in-face coordinates. */
  quad(p: Vector3[], uv: P2[], side: number, lit: RGB, shade: RGB, top: RGB, id: number, size: P2, flags: number, z0 = 0, zmax = 0) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(p[k].x, p[k].y, p[k].z); this.side.push(side); this.bid.push(id);
      this.lit.push(...lit); this.shade.push(...shade); this.top.push(...top);
      this.uv.push(...uv[k]); this.size.push(...size); this.extra.push(flags, z0, zmax);
    }
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('side', new Float32BufferAttribute(this.side, 1));
    g.setAttribute('cLit', new Uint8BufferAttribute(this.lit, 3, true));
    g.setAttribute('cShade', new Uint8BufferAttribute(this.shade, 3, true));
    g.setAttribute('cTop', new Uint8BufferAttribute(this.top, 3, true));
    g.setAttribute('bid', new Float32BufferAttribute(this.bid, 1));
    g.setAttribute('fuv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('fsize', new Float32BufferAttribute(this.size, 2));
    g.setAttribute('extra', new Float32BufferAttribute(this.extra, 3));
    return g;
  }
}

class Ground {
  pos: number[] = []; col: number[] = []; sid: number[] = [];
  private tri(a: P2, b: P2, c: P2, y: number, color: RGB, alpha: number, sid: number) {
    for (const [x, z] of [a, b, c]) { this.pos.push(x, y, z); this.col.push(...color, Math.round(alpha * 255)); this.sid.push(sid); }
  }
  /** A convex polygon on the ground, in city (x, y). */
  poly(p: P2[], color: RGB, alpha = 1, y = 0, sid = -1) { for (let i = 1; i < p.length - 1; i++) this.tri(p[0], p[i], p[i + 1], y, color, alpha, sid); }
  rect(x0: number, y0: number, x1: number, y1: number, color: RGB, alpha = 1, y = 0) { this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], color, alpha, y); }
  seg(a: P2, b: P2, w: number, color: RGB, alpha = 1, y = 0) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w / 2, ny = (dx / l) * w / 2;
    this.poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color, alpha, y);
  }
  disc(cx: number, cy: number, r: number, color: RGB, alpha: number) {
    this.poly(Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * Math.PI * 2; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r] as P2; }), color, alpha);
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color4', new Uint8BufferAttribute(this.col, 4, true));
    g.setAttribute('sid', new Float32BufferAttribute(this.sid, 1));
    return g;
  }
}

export class Boards {
  pos: number[] = []; size: number[] = []; off: number[] = []; col: number[] = []; meta: number[] = [];
  /** kind: 0 disc, 1 disc with outline (stroke = share of the radius), 2 rect, 3 upright bar. */
  add(p: Vector3, size: P2, off: P2, color: RGB, kind: number, lift = 0, stroke = 0, alpha = 1) {
    this.pos.push(p.x, p.y, p.z); this.size.push(...size); this.off.push(...off);
    this.col.push(...color, Math.round(alpha * 255)); this.meta.push(kind, lift, stroke, 0);
    return this.pos.length / 3 - 1;
  }
  geometry() {
    const g = new InstancedBufferGeometry().copy(new PlaneGeometry(1, 1) as unknown as InstancedBufferGeometry);
    g.instanceCount = this.pos.length / 3;
    g.setAttribute('iPos', new InstancedBufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('iSize', new InstancedBufferAttribute(new Float32Array(this.size), 2));
    g.setAttribute('iOff', new InstancedBufferAttribute(new Float32Array(this.off), 2));
    g.setAttribute('iColor', new InstancedBufferAttribute(new Uint8Array(this.col), 4, true));
    g.setAttribute('iMeta', new InstancedBufferAttribute(new Float32Array(this.meta), 4));
    return g;
  }
}

// ------------------------------------------------------------------------------------------------

export type CityUniforms = {
  uRight: { value: Vector3 }; uUp: { value: Vector3 }; uToCam: { value: Vector3 };
  uStroke: { value: number }; uStrokeColor: { value: Vector3 }; uGhost: { value: DataTexture }; uZUnit: { value: number };
};

export function boardMaterial(u: CityUniforms, transparent = false) {
  return new ShaderMaterial({ uniforms: u, vertexShader: BOARD_VS, fragmentShader: BOARD_FS, transparent, side: DoubleSide });
}

/**
 * Builds the city. `focus` is the project the camera turns around: it is drawn by its own model,
 * keeps its lot and shadow, and is never see-through.
 */
export function buildCity(d: SceneData, focus: number) {
  const Z = zUnit(d.A), PX = pxUnit(d.A), pal = d.palette;
  const P = (x: number, y: number, z: number) => new Vector3(x, z / Z, y);
  const c = (s: string) => rgb(s);
  const NEU = d.palette.neu.map(c) as [RGB, RGB, RGB];
  const faces = new Faces(), ground = new Ground(), boards = new Boards();
  const centres: P2[] = []; // per building id: the point the see-through test uses

  type Tex = { r: number; shop: boolean; roof: boolean };
  const box = (x: number, y: number, w: number, dd: number, z0: number, h: number, col: [RGB, RGB, RGB], stroke: boolean, floors: boolean, id: number, tex?: Tex) => {
    const cr: P2[] = [[x, y], [x + w, y], [x + w, y + dd], [x, y + dd]];
    const hw = h / Z, flags = (stroke ? 1 : 0) | (floors ? 4 : 0);
    for (let e = 0; e < 4; e++) {
      const p0 = cr[e], p1 = cr[(e + 1) % 4], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const side = [0, 1, 2, 3][e];
      // counter-clockwise from outside: walk the edge backwards along the bottom
      faces.quad([P(p1[0], p1[1], z0), P(p0[0], p0[1], z0), P(p0[0], p0[1], z0 + h), P(p1[0], p1[1], z0 + h)],
        [[len, 0], [0, 0], [0, hw], [len, hw]], side, col[1], col[2], col[0], id, [len, hw], flags, z0, z0 + h - 1);
      if (!tex) continue;
      // facade: storefronts on the ground floor, windows above (lit at random), just off the wall
      const n: P2 = e === 0 ? [0, -1] : e === 1 ? [1, 0] : e === 2 ? [0, 1] : [-1, 0], o = 0.0025;
      const at = (u: number): P2 => [p0[0] + (p1[0] - p0[0]) * u + n[0] * o, p0[1] + (p1[1] - p0[1]) * u + n[1] * o];
      const pane = (u0: number, u1: number, za: number, zb: number, lit: RGB, shade: RGB) => {
        const a = at(u0), b = at(u1);
        faces.quad([P(b[0], b[1], za), P(a[0], a[1], za), P(a[0], a[1], zb), P(b[0], b[1], zb)], [[0, 0], [0, 0], [0, 0], [0, 0]], side, lit, shade, lit, id, [1, 1], 0);
      };
      if (tex.shop && z0 === 0 && h > 6) pane(0.06, 0.94, 0.35, 2.7, c(pal.shop), c(pal.shop));
      for (let fz = z0 + 4; fz + 3 <= z0 + h - 0.6; fz += 4) {
        const m = Math.max(1, Math.round(len / 0.16));
        for (let j = 0; j < m; j++) {
          const lit = hash(x * 7 + j, fz + e) > 0.86;
          pane((j + 0.22) / m, (j + 0.78) / m, fz + 0.9, fz + 2.9, lit ? c(pal.winLit) : c(pal.win[0]), lit ? c(pal.winLit) : c(pal.win[1]));
        }
      }
    }
    const topCol = tex && tex.r > 0.88 ? c(pal.greenRoof) : col[0];
    faces.quad([P(x, y + dd, z0 + h), P(x + w, y + dd, z0 + h), P(x + w, y, z0 + h), P(x, y, z0 + h)],
      [[0, dd], [w, dd], [w, 0], [0, 0]], 4, topCol, topCol, topCol, id, [w, dd], (stroke ? 1 : 0) | (tex?.roof ? 2 : 0));
  };

  // ---- ground, in the frames' paint order
  const W = d.walk, rx = d.canal;
  ground.rect(0, 0, d.N, d.N, c(pal.road));
  for (const [bx, by, park] of d.plates) {
    const s0: P2 = [bx - W, by - W], s1: P2 = [bx + 3 + W, by + 3 + W];
    ground.rect(s0[0], s0[1], s1[0], s1[1], c(pal.sidewalk));
    for (const [a, b] of [[s0, [s1[0], s0[1]]], [[s1[0], s0[1]], s1], [s1, [s0[0], s1[1]]], [[s0[0], s1[1]], s0]] as [P2, P2][]) ground.seg(a, b, 0.0055, c(pal.curb));
    ground.rect(bx, by, bx + 3, by + 3, park ? c(pal.park) : c(pal.n1));
    if (park) for (let i = 0; i < 40; i++) {
      const a0 = (i / 40) * Math.PI * 2, a1 = ((i + 1.15) / 40) * Math.PI * 2;
      ground.seg([bx + 1.5 + Math.cos(a0), by + 1.5 + Math.sin(a0)], [bx + 1.5 + Math.cos(a1), by + 1.5 + Math.sin(a1)], 0.1, c(pal.path));
    }
  }
  // road markings: centre dashes between junctions, zebra crossings and stop lines
  const MK = c(pal.mark), mw = 0.0065, DASH = 0.0805, GAP = 0.0626;
  const dashed = (a: P2, b: P2) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
    for (let s = 0; s < l; s += DASH + GAP) { const e = Math.min(l, s + DASH); ground.seg([a[0] + ux * s, a[1] + uy * s], [a[0] + ux * e, a[1] + uy * e], mw, MK); }
  };
  for (const s of d.streets) for (let t = -4; t < d.N; t += 4) {
    const a = Math.max(0, t + 1.4), b = Math.min(d.N, t + 3.6);
    if (b <= a) continue;
    if (s !== d.canal) dashed([s + 0.5, a], [s + 0.5, b]);
    if (!(a < d.canal + 1 && b > d.canal)) dashed([a, s + 0.5], [b, s + 0.5]);
  }
  for (const s of d.streets) for (const t of d.streets) {
    if (s === d.canal) continue;
    const stripes = (lo: number, hi: number, along: 'x' | 'y', from: number, to: number) => {
      for (let v = from; v < to - 0.03; v += 0.1) {
        if (along === 'x') ground.rect(v, lo, v + 0.055, hi, MK); else ground.rect(lo, v, hi, v + 0.055, MK);
      }
    };
    stripes(t - 0.3, t - 0.06, 'x', s + W + 0.03, s + 1 - W);
    stripes(t + 1.06, t + 1.3, 'x', s + W + 0.03, s + 1 - W);
    stripes(s - 0.3, s - 0.06, 'y', t + W + 0.03, t + 1 - W);
    stripes(s + 1.06, s + 1.3, 'y', t + W + 0.03, t + 1 - W);
    ground.seg([s + 0.5, t - 0.36], [s + 1 - W, t - 0.36], mw, MK);
    ground.seg([s + W, t + 1.36], [s + 0.5, t + 1.36], mw, MK);
    ground.seg([s - 0.36, t + W], [s - 0.36, t + 0.5], mw, MK);
    ground.seg([s + 1.36, t + 0.5], [s + 1.36, t + 1 - W], mw, MK);
  }
  // the canal: water, quays, ripples and bridges
  ground.rect(rx, 0, rx + 1, d.N, c(pal.water));
  for (const xx of [rx, rx + 1]) ground.seg([xx, 0], [xx, d.N], 0.007, c(pal.curb));
  for (let yy = 0.6; yy < d.N; yy += 0.9) { const xr = rx + 0.25 + hash(yy, 3) * 0.4; ground.seg([xr, yy], [xr + 0.12, yy + 0.18], 0.007, c('#F4F7F8')); }
  const deck = 0.8 / Z, rail = 2.8 / Z;
  for (let n = -4; n <= 7; n++) {
    const by = d.off + 4 * n - 1;
    if (by < 0 || by > d.N - 1) continue;
    const q: P2[] = [[rx - 0.1, by + 0.12], [rx + 1.1, by + 0.12], [rx + 1.1, by + 0.88], [rx - 0.1, by + 0.88]];
    ground.poly(q, c(pal.road), 1, deck);
    for (let i = 0; i < 4; i++) ground.seg(q[i], q[(i + 1) % 4], 0.007, c(pal.cityStroke), 1, deck);
    ground.seg(q[0], q[1], 0.008, c(pal.cityStroke), 1, rail);
    ground.seg(q[3], q[2], 0.008, c(pal.cityStroke), 1, rail);
  }
  // project lots, grown to any part that reaches past them
  for (const p of d.projects) {
    const x0 = Math.min(0, ...p.parts.map(q => q.dx)), y0 = Math.min(0, ...p.parts.map(q => q.dy));
    const x1 = Math.max(1, ...p.parts.map(q => q.dx + q.w)), y1 = Math.max(1, ...p.parts.map(q => q.dy + q.d));
    ground.rect(p.x + x0 - 0.12, p.y + y0 - 0.12, p.x + x1 + 0.12, p.y + y1 + 0.12, c(pal.lime), 0.8);
  }
  // cast shadows, fixed to the city like its light
  const INK = c(pal.ink), [sdx, sdy] = d.shadowDir;
  const shadow = (x: number, y: number, w: number, dd: number, h: number, sid: number) => {
    const dx = sdx * h, dy = sdy * h;
    ground.poly([[x, y], [x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dd + dy], [x + dx, y + dd + dy], [x, y + dd]], INK, 0.075, 0, sid);
  };

  // ---- volumes
  d.buildings.forEach(([x, y, w, dd, h, ts, th, r]) => {
    const id = centres.push([x + w / 2, y + dd / 2]) - 1;
    shadow(x, y, w, dd, h + th, id);
    const tex: Tex = { r, shop: r < 0.55, roof: !ts };
    box(x, y, w, dd, 0, h, NEU, true, false, id, tex);
    if (ts) {
      const o = (1 - ts) / 2;
      box(x + w * o, y + dd * o, w * ts, dd * ts, h, th, NEU, true, false, id, { ...tex, shop: false, roof: true });
    } else if (r < 0.4 && h > 6) {
      box(x + w * (0.2 + 0.4 * r), y + dd * 0.3, w * 0.24, dd * 0.22, h, 1.8, NEU, true, false, id); // rooftop plant room
    }
  });
  d.projects.forEach((p, i) => {
    const id = i === focus ? -1 : centres.push([p.x + 0.5, p.y + 0.5]) - 1;
    if (p.sprite || i === focus) for (const q of p.parts) shadow(p.x + q.dx, p.y + q.dy, q.w, q.d, q.z0 + q.h, -1);
    else shadow(p.x + 0.05, p.y + 0.05, 0.9, 0.9, Math.max(...p.parts.map(q => q.z0 + q.h)), -1);
    if (i === focus) return; // drawn by its own model
    for (const q of p.parts) box(p.x + q.dx, p.y + q.dy, q.w, q.d, q.z0, q.h, q.c.map(c) as [RGB, RGB, RGB], q.stroke, true, id);
  });
  // trees and street lamps
  for (const [x, y] of d.trees) {
    ground.disc(x + 0.12, y + 0.05, 7 / PX, INK, 0.07);
    boards.add(P(x, y, 4), [0.48 / PX, 8 / Z], [0, 0], c(pal.st), 3);
    boards.add(P(x, y, 12), [11 / PX, 11 / PX], [0, 0], c(pal.tree), 0, 0.001);
    boards.add(P(x, y, 12), [6 / PX, 6 / PX], [-1.6 / PX, 1.8 / PX], c('#D6DCCF'), 0, 0.002);
  }
  for (const [x, y] of d.lamps) {
    ground.disc(x, y, 7 / PX, [255, 255, 255], 0.7);
    boards.add(P(x, y, 5), [0.32 / PX, 10 / Z], [0, 0], c(pal.cityStroke), 3);
    boards.add(P(x, y, 10), [3.2 / PX, 3.2 / PX], [0, 0], [255, 255, 255], 1, 0.001, 0.25);
  }

  // ---- see-through state, one texel per building, eased on the CPU
  const n = centres.length, rows = Math.ceil(n / 1024);
  const ghostData = new Uint8Array(1024 * rows), ghostNow = new Float32Array(n).fill(-1);
  const ghostTex = new DataTexture(ghostData, 1024, rows, RedFormat, UnsignedByteType);
  ghostTex.needsUpdate = true;

  const uniforms: CityUniforms = {
    uRight: { value: new Vector3(1, 0, 0) }, uUp: { value: new Vector3(0, 1, 0) }, uToCam: { value: new Vector3(0, 0, 1) },
    uStroke: { value: 1 }, uStrokeColor: { value: new Vector3(...c(pal.cityStroke).map(v => v / 255)) },
    uGhost: { value: ghostTex }, uZUnit: { value: Z },
  };
  const faceMat = (pass: number) => new ShaderMaterial({
    uniforms: { ...uniforms, uPass: { value: pass } }, vertexShader: FACE_VS, fragmentShader: FACE_FS,
    transparent: pass === 1, depthWrite: pass === 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const faceGeo = faces.geometry();
  const solid = new Mesh(faceGeo, faceMat(0));
  const glassy = new Mesh(faceGeo, faceMat(1));
  glassy.renderOrder = 2;
  // the ground goes down first, blended in its paint order, and never hides anything
  const groundMesh = new Mesh(ground.geometry(), new ShaderMaterial({
    uniforms, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, depthTest: false, depthWrite: false, side: DoubleSide,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
  }));
  groundMesh.renderOrder = -10;
  const boardMesh = new Mesh(boards.geometry(), boardMaterial(uniforms));
  for (const m of [solid, glassy, groundMesh, boardMesh]) {
    m.frustumCulled = false;
    // static: once on the GPU, the copies in RAM can go (the renderer still sorts by bounds, so keep those)
    m.geometry.computeBoundingSphere();
    for (const a of Object.values(m.geometry.attributes)) (a as BufferAttribute).onUpload(dropArray);
  }

  const group = new Group();
  group.add(groundMesh, solid, boardMesh, glassy);

  /**
   * See-through rule of the frames (geometry.ts `ghost`), turned with the camera: a building whose
   * centre lies 0.2–7 diagonal cells in front of the project and within 3.2 to the side. From higher
   * up fewer buildings are in the way, from lower more.
   */
  const updateGhosts = (pivot: P2, toCam: P2, polar: number, dt: number) => {
    const ease = dt < 0 ? 1 : 1 - Math.exp(-dt * 9);
    const reach = 7 * Math.min(1.8, Math.max(0.25, Math.tan(polar) / Math.tan(Math.PI / 3)));
    let changed = false;
    for (let i = 0; i < n; i++) {
      const vx = centres[i][0] - pivot[0], vy = centres[i][1] - pivot[1];
      const ds = Math.SQRT2 * (vx * toCam[0] + vy * toCam[1]), dd = Math.SQRT2 * Math.abs(vx * toCam[1] - vy * toCam[0]);
      const want = ds > 0.2 && ds < reach && dd < 3.2 ? 1 : 0;
      const g = ghostNow[i] < 0 ? want : ghostNow[i] + (want - ghostNow[i]) * ease;
      const v = Math.abs(g - want) < 0.01 ? want : g;
      if (v === ghostNow[i]) continue;
      ghostNow[i] = v;
      const b = Math.round(v * 255);
      if (ghostData[i] !== b) { ghostData[i] = b; changed = true; }
    }
    if (changed) ghostTex.needsUpdate = true;
    return changed;
  };

  const dispose = () => {
    for (const m of [solid, glassy, groundMesh, boardMesh]) (m.material as ShaderMaterial).dispose();
    faceGeo.dispose(); groundMesh.geometry.dispose(); boardMesh.geometry.dispose(); ghostTex.dispose();
  };
  return { group, uniforms, updateGhosts, dispose, zUnit: Z, pxUnit: PX };
}
export type City = ReturnType<typeof buildCity>;
