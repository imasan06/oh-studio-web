// The living city: cars, people and traffic lights simulated in real time and drawn over the
// pre-rendered frames. Each frame carries its camera, so everything lands exactly on the streets
// of the image.
//
// Nothing pops: cars drive closed routes through the street grid (turning at corners, stopping at
// lights), people walk around blocks and cross to neighbouring blocks at the zebra crossings, and
// when something passes behind a building, that building's pixels are restored from the frame on
// top of it, so it is hidden progressively, as in real life.
//
// World units: one grid cell (~20 m) on the ground, z in the renderer's height units (~0.9 m).

import type { SeqMeta } from '../renders/frames';
import { RENDERS_URL } from '../renders/registry';

type LifeData = {
  N: number; A: number; B: number; CX: number; CY: number; walk: number;
  streets: number[]; canal: number;
  blocks: [number, number, number][];   // [bx, by, isPark]
  occluders: number[][];                 // [x, y, w, d, h]
};

type P2 = [number, number];
type Shade = [string, string, string]; // top, lit side, shaded side
type Axis = 0 | 1;                     // 0 = col roads (traffic along y), 1 = row roads (along x)

/** Population, tuned for a steady 60 fps. Phones get 30% fewer cars and people (decided once, at load: nothing pops). */
export const DENSITY = { carsPerCell: 1 / 7.5, walkersPerBlock: 1.6, parkWalkers: 2, crossChance: 0.35 };
const PHONE_SCALE = 0.7;

// ---------- traffic signals: 12 s cycle, the two axes alternate, each junction slightly offset (green wave) ----------
const CYCLE = 12, GREEN = 4.6, AMBER = 0.8;
type Sig = 'g' | 'a' | 'r';
const phaseOf = (local: number, axis: Axis) => (axis === 0 ? local : (local + CYCLE / 2) % CYCLE);
const signalAt = (local: number, axis: Axis): Sig => { const t = phaseOf(local, axis); return t < GREEN ? 'g' : t < GREEN + AMBER ? 'a' : 'r'; };
const greenLeft = (local: number, axis: Axis) => { const t = phaseOf(local, axis); return t < GREEN ? GREEN - t : 0; };
export const LIGHT: Record<Sig, string> = { g: '#2FB06C', a: '#F2A11F', r: '#E5484D' };

// ---------- palette: the city stays in the brand neutrals, a few cars and people carry the accents ----------
const CAR_COLORS = ['#F4F5F2', '#E6E9E4', '#B4B9B2', '#8C928D', '#5E6560', '#3A403C', '#1F2421', '#0129FA', '#C5E063'];
const CAR_WEIGHTS = [5, 2, 2, 2, 2, 2, 2, 0.6, 0.5];
const CLOTHES = ['#1F2421', '#3A403C', '#5E6560', '#8C928D', '#F4F5F2', '#0129FA', '#C5E063', '#B4B9B2'];
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};
const shadesOf = (hex: string): Shade => [shade(hex, 0.18), hex, shade(hex, -0.22)];
export const GLASS = shadesOf('#5E6A6E');

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ================================================================================================
// Cars: closed routes around a rectangle of blocks, with rounded turns at the corners
// ================================================================================================
type Leg = { axis: Axis; road: number; dir: 1 | -1; key?: string };
type Piece = { line: boolean; a: P2; b: P2; c: P2; s0: number; len: number; leg: Leg | null };
type Stop = { at: number; s: number; t: number; axis: Axis };
const TURN_R = 0.3;
const laneOf = (l: Leg) => (l.axis === 0 ? l.road + (l.dir === 1 ? 0.67 : 0.33) : l.road + (l.dir === 1 ? 0.33 : 0.67));
const headingOf = (l: Leg): P2 => (l.axis === 0 ? [0, l.dir] : [l.dir, 0]);

class Route {
  pieces: Piece[] = [];
  stops: Stop[] = [];
  total = 0;
  constructor(legs: Leg[], junctionCols: number[], junctionRows: number[], canal: number) {
    // corner k joins legs[k] → legs[k+1]
    const corners: P2[] = legs.map((l, k) => {
      const n = legs[(k + 1) % legs.length];
      return l.axis === 1 ? [laneOf(n), laneOf(l)] : [laneOf(l), laneOf(n)];
    });
    const ent = (k: number): P2 => { const h = headingOf(legs[k]); return [corners[k][0] - h[0] * TURN_R, corners[k][1] - h[1] * TURN_R]; };
    const ext = (k: number): P2 => { const h = headingOf(legs[(k + 1) % legs.length]); return [corners[k][0] + h[0] * TURN_R, corners[k][1] + h[1] * TURN_R]; };
    let s = 0;
    for (let k = 0; k < legs.length; k++) {
      const prev = (k - 1 + legs.length) % legs.length;
      const a = ext(prev), b = ent(k), leg = legs[k];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      this.pieces.push({ line: true, a, b, c: b, s0: s, len, leg });
      // stop lines of every junction this leg drives into (bridges over the canal have none)
      const from = leg.axis === 1 ? a[0] : a[1];
      const cross = leg.axis === 1 ? junctionCols : junctionRows;
      for (const j of cross) {
        if (leg.axis === 1 && j === canal) continue;
        const stopAt = leg.dir === 1 ? j - 0.36 : j + 1.36;
        const d = (stopAt - from) * leg.dir;
        if (d < 0 || d > len) continue;
        this.stops.push({ at: s + d, s: leg.axis === 1 ? j : leg.road, t: leg.axis === 1 ? leg.road : j, axis: leg.axis });
      }
      s += len;
      // rounded corner (quadratic curve through the corner point)
      const ca = ent(k), cb = ext(k), cc = corners[k];
      let clen = 0, px = ca[0], py = ca[1];
      for (let i = 1; i <= 8; i++) { const q = bez(ca, cc, cb, i / 8); clen += Math.hypot(q[0] - px, q[1] - py); px = q[0]; py = q[1]; }
      this.pieces.push({ line: false, a: ca, b: cb, c: cc, s0: s, len: clen, leg: null });
      s += clen;
    }
    this.total = s;
    this.stops.sort((p, q) => p.at - q.at);
  }
  /** Position, heading and the piece at distance s along the loop. */
  at(s: number): { x: number; y: number; hx: number; hy: number; piece: Piece } {
    s = ((s % this.total) + this.total) % this.total;
    let p = this.pieces[0];
    for (const q of this.pieces) { if (q.s0 <= s) p = q; else break; }
    const u = Math.min(1, (s - p.s0) / (p.len || 1));
    if (p.line) {
      const hx = Math.sign(p.b[0] - p.a[0]), hy = Math.sign(p.b[1] - p.a[1]);
      return { x: p.a[0] + (p.b[0] - p.a[0]) * u, y: p.a[1] + (p.b[1] - p.a[1]) * u, hx, hy, piece: p };
    }
    const q = bez(p.a, p.c, p.b, u);
    const tx = 2 * (1 - u) * (p.c[0] - p.a[0]) + 2 * u * (p.b[0] - p.c[0]), ty = 2 * (1 - u) * (p.c[1] - p.a[1]) + 2 * u * (p.b[1] - p.c[1]);
    const n = Math.hypot(tx, ty) || 1;
    return { x: q[0], y: q[1], hx: tx / n, hy: ty / n, piece: p };
  }
}
const bez = (a: P2, c: P2, b: P2, u: number): P2 => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];

export type Car = { route: Route; s: number; v: number; vmax: number; len: number; wid: number; col: Shade; x: number; y: number; hx: number; hy: number; leg: Leg | null; next: Leg | null };

// ================================================================================================
// People: block rings, crossings to neighbouring blocks, park loops
// ================================================================================================
type Ring = { x0: number; x1: number; y0: number; y1: number; per: number; crossings: Crossing[] };
type Crossing = { u: number; to: number; toU: number; from: P2; dest: P2; s: number; t: number; axis: Axis };
export type Walker = {
  x: number; y: number; dx: number; dy: number; col: string; ph: number;
  mode: 'ring' | 'wait' | 'cross' | 'park';
  ring: number; u: number; v: number; cool: number;
  cr: Crossing | null; k: number;
  park?: { cx: number; cy: number; a: number; v: number };
};
const ringPoint = (r: Ring, u: number): { x: number; y: number; dx: number; dy: number } => {
  const wx = r.x1 - r.x0, wy = r.y1 - r.y0;
  let a = ((u % r.per) + r.per) % r.per;
  if (a < wx) return { x: r.x0 + a, y: r.y0, dx: 1, dy: 0 };
  if ((a -= wx) < wy) return { x: r.x1, y: r.y0 + a, dx: 0, dy: 1 };
  if ((a -= wy) < wx) return { x: r.x1 - a, y: r.y1, dx: -1, dy: 0 };
  a -= wx;
  return { x: r.x0, y: r.y1 - a, dx: 0, dy: -1 };
};
const ringU = (r: Ring, x: number, y: number) => {
  const wx = r.x1 - r.x0, wy = r.y1 - r.y0, e = 1e-3;
  if (Math.abs(y - r.y0) < e) return x - r.x0;
  if (Math.abs(x - r.x1) < e) return wx + (y - r.y0);
  if (Math.abs(y - r.y1) < e) return wx + wy + (r.x1 - x);
  return 2 * wx + wy + (r.y1 - y);
};

export type Light = { x: number; y: number; s: number; t: number; axis: Axis };

// ================================================================================================
class CityLife {
  ready = false;
  private d: LifeData | null = null;
  private cars: Car[] = [];
  private rings: Ring[] = [];
  private walkers: Walker[] = [];
  private lanes = new Map<string, Car[]>();
  private lights: Light[] = [];
  private t = 0;
  private last = 0;
  private frozen = false;
  private loading: Promise<void> | null = null;
  private r = rng(7);
  // occlusion data for the current camera
  private occKey = '';
  private occ: { bx0: number; by0: number; bx1: number; by1: number; hull: P2[] }[] = [];
  private buckets: number[][] = [];
  private bcols = 0;
  private brows = 0;
  /** Main-thread cost of the last render, in ms (for tuning). */
  cost = 0;

  load() {
    this.loading ??= fetch(`${RENDERS_URL}/city-life.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: LifeData) => {
        this.d = d;
        this.frozen = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.spawn();
        this.ready = true;
      })
      .catch(err => console.warn('[life]', err));
    return this.loading;
  }

  private local(s: number, t: number) { return (this.t + (((s + t) / 4) * 1.15) % CYCLE) % CYCLE; }
  private signal(s: number, t: number, axis: Axis) { return signalAt(this.local(s, t), axis); }

  // ---------- population ----------
  private spawn() {
    const d = this.d!, r = this.r, W = d.walk;
    const scale = window.matchMedia('(pointer: coarse)').matches ? PHONE_SCALE : 1;
    const pick = <T,>(arr: T[], w?: number[]) => {
      if (!w) return arr[Math.floor(r() * arr.length)];
      let x = r() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; }
      return arr[arr.length - 1];
    };
    const cols = d.streets.filter(s => s !== d.canal), rows = d.streets;

    // --- cars on closed routes
    let budget = Math.round(d.N * (cols.length + rows.length) * DENSITY.carsPerCell * scale);
    for (let tries = 0; budget > 0 && tries < 400; tries++) {
      const i = Math.floor(r() * (cols.length - 1)), j = Math.floor(r() * (rows.length - 1));
      const sA = cols[i], sB = cols[Math.min(cols.length - 1, i + 1 + Math.floor(r() * 3))];
      const tA = rows[j], tB = rows[Math.min(rows.length - 1, j + 1 + Math.floor(r() * 3))];
      if (sA === sB || tA === tB) continue;
      const legs: Leg[] = r() < 0.5
        ? [{ axis: 1, road: tA, dir: 1 }, { axis: 0, road: sB, dir: 1 }, { axis: 1, road: tB, dir: -1 }, { axis: 0, road: sA, dir: -1 }]
        : [{ axis: 0, road: sA, dir: 1 }, { axis: 1, road: tB, dir: 1 }, { axis: 0, road: sB, dir: -1 }, { axis: 1, road: tA, dir: -1 }];
      for (const l of legs) l.key = `${l.axis}:${l.road}:${l.dir}`;
      const route = new Route(legs, cols, rows, d.canal);
      const n = Math.max(1, Math.min(budget, Math.round(route.total / 9)));
      const s0 = r() * route.total;
      for (let k = 0; k < n; k++) {
        this.cars.push({
          route, s: s0 + (k / n) * route.total, v: 0, vmax: 0.55 + r() * 0.2, len: 0.21 + r() * 0.05, wid: 0.1,
          col: shadesOf(pick(CAR_COLORS, CAR_WEIGHTS)), x: 0, y: 0, hx: 1, hy: 0, leg: null, next: null,
        });
      }
      budget -= n;
    }

    // --- traffic lights: one pole on each corner of every junction
    for (const s of cols) for (const t of rows) {
      this.lights.push({ x: s + 1 - W / 2, y: t + W / 2, s, t, axis: 0 }, { x: s + W / 2, y: t + 1 - W / 2, s, t, axis: 1 });
    }

    // --- sidewalk rings and the crossings that connect them
    const index = new Map<string, number>();
    d.blocks.forEach(([bx, by]) => {
      let x0 = bx - W / 2, x1 = bx + 3 + W / 2;
      const y0 = by - W / 2, y1 = by + 3 + W / 2;
      if (x1 > d.canal && x1 < d.canal + 1) x1 = d.canal - 0.06; // quay side: stay out of the water
      if (x0 > d.canal && x0 < d.canal + 1) x0 = d.canal + 1.06;
      index.set(`${bx},${by}`, this.rings.length);
      this.rings.push({ x0, x1, y0, y1, per: 2 * (x1 - x0) + 2 * (y1 - y0), crossings: [] });
    });
    d.blocks.forEach(([bx, by], i) => {
      const me = this.rings[i];
      const link = (nb: string, from: P2, toFn: (o: Ring) => P2, s: number, t: number, axis: Axis) => {
        const j = index.get(nb);
        if (j === undefined || s === d.canal || s < 0 || t < 0) return;
        const other = this.rings[j], dest = toFn(other);
        me.crossings.push({ u: ringU(me, from[0], from[1]), to: j, toU: ringU(other, dest[0], dest[1]), from, dest, s, t, axis });
      };
      for (const [yy, t] of [[by + 0.18, by - 1], [by + 2.82, by + 3]] as P2[]) {
        link(`${bx + 4},${by}`, [me.x1, yy], o => [o.x0, yy], bx + 3, t, 1); // across the col road to the east
        link(`${bx - 4},${by}`, [me.x0, yy], o => [o.x1, yy], bx - 1, t, 1); // … to the west
      }
      for (const [xx, s] of [[bx + 0.18, bx - 1], [bx + 2.82, bx + 3]] as P2[]) {
        link(`${bx},${by - 4}`, [xx, me.y0], o => [xx, o.y1], s, by - 1, 0); // across the row road to the north
        link(`${bx},${by + 4}`, [xx, me.y1], o => [xx, o.y0], s, by + 3, 0); // … to the south
      }
    });

    // --- people
    const person = (): Walker => ({ x: 0, y: 0, dx: 1, dy: 0, col: pick(CLOTHES), ph: r() * 6.28, mode: 'ring', ring: 0, u: 0, v: 0, cool: 0, cr: null, k: 0 });
    d.blocks.forEach(([bx, by, park], i) => {
      const count = Math.floor(DENSITY.walkersPerBlock * scale + r());
      for (let q = 0; q < count; q++) {
        const w = person();
        w.ring = i; w.u = r() * this.rings[i].per; w.v = (0.12 + r() * 0.07) * (r() < 0.5 ? 1 : -1);
        this.placeOnRing(w);
        this.walkers.push(w);
      }
      if (park) for (let q = 0; q < Math.round(DENSITY.parkWalkers * scale); q++) {
        const w = person();
        w.mode = 'park';
        w.park = { cx: bx + 1.5, cy: by + 1.5, a: r() * 6.28, v: (0.13 + r() * 0.06) * (r() < 0.5 ? 1 : -1) };
        this.walkers.push(w);
      }
    });
  }

  private placeOnRing(w: Walker) {
    const p = ringPoint(this.rings[w.ring], w.u);
    w.x = p.x; w.y = p.y; w.dx = p.dx * Math.sign(w.v); w.dy = p.dy * Math.sign(w.v);
  }

  // ---------- simulation ----------
  private step(dt: number) {
    this.t += dt;
    // where every car is, per lane, for keeping distance across routes that share a street
    const lanes = this.lanes;
    for (const a of lanes.values()) a.length = 0;
    const enter = (l: Leg, c: Car) => { let a = lanes.get(l.key!); if (!a) lanes.set(l.key!, (a = [])); a.push(c); };
    for (const c of this.cars) {
      const p = c.route.at(c.s);
      c.x = p.x; c.y = p.y; c.hx = p.hx; c.hy = p.hy; c.leg = p.piece.leg;
      const ps = c.route.pieces, i = ps.indexOf(p.piece);
      c.next = ps[(i + 1) % ps.length].leg;
      if (p.piece.leg) enter(p.piece.leg, c);
      else {
        // in a turn: block both the street it leaves and the one it joins
        const prev = ps[(i - 1 + ps.length) % ps.length].leg;
        if (prev) enter(prev, c);
        if (c.next) enter(c.next, c);
      }
    }
    for (const c of this.cars) {
      let target = c.vmax;
      const front = c.s + c.len / 2;
      // keep distance from whoever is ahead in the same lane
      const leg = c.leg ?? c.next;
      if (leg) {
        const mine = leg.axis === 0 ? c.y : c.x;
        let near = Infinity, ahead: Car | null = null;
        for (const o of lanes.get(leg.key!) ?? []) {
          if (o === c) continue;
          const d = ((leg.axis === 0 ? o.y : o.x) - mine) * leg.dir;
          if (d > 0 && d < near) { near = d; ahead = o; }
        }
        if (ahead) target = Math.min(target, Math.max(0, (near - (ahead.len + c.len) / 2 - 0.07) * 2.2));
      }
      // the next stop line on the route: stop there unless the light is green
      const T = c.route.total;
      for (const st of c.route.stops) {
        const dist = (((st.at - front) % T) + T) % T;
        if (dist > T - 0.02) continue;
        if (dist > 1.2) continue;
        const sig = this.signal(st.s, st.t, st.axis);
        if (sig !== 'g' && !(sig === 'a' && dist < 0.12)) target = Math.min(target, Math.max(0, dist * 2.4));
      }
      c.v += (target - c.v) * Math.min(1, dt * 3.5);
      c.s += c.v * dt;
    }

    for (const w of this.walkers) {
      w.ph += dt * 9;
      if (w.mode === 'park') {
        const p = w.park!;
        p.a += p.v * dt;
        w.x = p.cx + Math.cos(p.a); w.y = p.cy + Math.sin(p.a);
        w.dx = -Math.sin(p.a) * Math.sign(p.v); w.dy = Math.cos(p.a) * Math.sign(p.v);
        continue;
      }
      if (w.mode === 'ring') {
        const ring = this.rings[w.ring];
        const u0 = w.u;
        w.u = (w.u + w.v * dt + ring.per) % ring.per;
        w.cool = Math.max(0, w.cool - dt);
        if (w.cool === 0) {
          for (const c of ring.crossings) {
            // did we just walk past this crossing's kerb point?
            const passed = w.v > 0 ? (c.u > u0 && c.u <= u0 + w.v * dt) || (c.u + ring.per > u0 && c.u + ring.per <= u0 + w.v * dt)
              : (c.u < u0 && c.u >= u0 + w.v * dt) || (c.u - ring.per < u0 && c.u - ring.per >= u0 + w.v * dt);
            if (!passed) continue;
            if (this.r() < DENSITY.crossChance) { w.mode = 'wait'; w.cr = c; w.x = c.from[0]; w.y = c.from[1]; }
            else w.cool = 1;
            break;
          }
        }
        if (w.mode === 'ring') this.placeOnRing(w);
        continue;
      }
      const c = w.cr!;
      if (w.mode === 'wait') {
        w.ph = 0;
        const local = this.local(c.s, c.t);
        // the traffic being crossed must be stopped, with time left to reach the other side
        if (greenLeft(local, c.axis) > 2.6) { w.mode = 'cross'; w.k = 0; }
        w.dx = Math.sign(c.dest[0] - c.from[0]); w.dy = Math.sign(c.dest[1] - c.from[1]);
        continue;
      }
      // crossing
      const len = Math.hypot(c.dest[0] - c.from[0], c.dest[1] - c.from[1]);
      w.k = Math.min(1, w.k + (0.32 * dt) / len);
      w.x = c.from[0] + (c.dest[0] - c.from[0]) * w.k; w.y = c.from[1] + (c.dest[1] - c.from[1]) * w.k;
      if (w.k >= 1) { w.mode = 'ring'; w.ring = c.to; w.u = c.toU; w.v = Math.abs(w.v) * (this.r() < 0.5 ? 1 : -1); w.cool = 2; w.cr = null; this.placeOnRing(w); }
    }
  }

  /** Moves everything on to `now` (seconds). The frame layer does it while drawing; the live 3D view calls it itself. */
  advance(now: number) {
    const dt = this.last ? Math.min(0.1, now - this.last) : 0;
    this.last = now;
    if (!this.frozen) this.step(dt);
  }

  /** The simulation as it stands, read by the live 3D view (src/lib/city3d/life.ts). */
  get state() {
    return {
      cars: this.cars as readonly Car[], walkers: this.walkers as readonly Walker[], lights: this.lights as readonly Light[],
      canal: this.d?.canal ?? -1, frozen: this.frozen,
      signal: (l: Light) => this.signal(l.s, l.t, l.axis),
    };
  }

  // ---------- drawing ----------
  render(ctx: CanvasRenderingContext2D, meta: SeqMeta, frame: number, now: number, bm: ImageBitmap) {
    const d = this.d;
    if (!d) return;
    const t0 = performance.now();
    this.advance(now);

    const cam = meta.cams[frame];
    if (!cam) return;
    const [k, tx, ty, theta, fz] = cam;
    const ox = d.CX - meta.w / (2 * meta.s), oy = d.CY - meta.h / (2 * meta.s), S = meta.s;
    const [pvx, pvy] = meta.pivot;
    const th = (theta * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th), rotated = Math.abs(theta % 360) > 0.01;
    const rot = (x: number, y: number): P2 => (rotated ? [pvx + (x - pvx) * co - (y - pvy) * si, pvy + (x - pvx) * si + (y - pvy) * co] : [x, y]);
    const Pr = (rx: number, ry: number, z: number): P2 => [(tx + (rx - ry) * d.A * k - ox) * S, (ty + ((rx + ry - d.N) * d.B - z) * k - oy) * S];
    const P = (x: number, y: number, z: number): P2 => { const [rx, ry] = rot(x, y); return Pr(rx, ry, z); };
    const zpx = k * S; // px per height unit
    const W = meta.w, H = meta.h, M = 60;
    this.buildOcclusion(`${meta.cams.length}:${frame}:${cam.join(',')}`, d, rot, Pr, fz, meta, W, H);

    type Item = { depth: number; ground: P2[]; draw: () => P2[] };
    const items: Item[] = [];
    const onScreen = (p: P2) => p[0] > -M && p[0] < W + M && p[1] > -M && p[1] < H + M;
    const depth = (x: number, y: number) => { const [rx, ry] = rot(x, y); return rx + ry; };

    for (const c of this.cars) {
      const g = P(c.x, c.y, 0);
      if (!onScreen(g)) continue;
      const fp = carFootprint(c.x, c.y, c.hx, c.hy, c.len, c.wid);
      items.push({ depth: depth(c.x, c.y), ground: [g, ...fp.map(([x, y]) => P(x, y, 0))], draw: () => this.drawCar(ctx, c, fp, rot, Pr, zpx, d) });
    }
    for (const w of this.walkers) {
      const g = P(w.x, w.y, 0);
      if (!onScreen(g)) continue;
      items.push({ depth: depth(w.x, w.y), ground: [g], draw: () => drawPerson(ctx, w, P, zpx) });
    }
    for (const l of this.lights) {
      const g = P(l.x, l.y, 0);
      if (!onScreen(g)) continue;
      const sig = this.signal(l.s, l.t, l.axis);
      items.push({ depth: depth(l.x, l.y), ground: [g], draw: () => drawLight(ctx, g, P(l.x, l.y, 4.6), sig, zpx) });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) {
      const occ = this.occludersOf(it.ground);
      // entirely behind one building (every ground point inside it, and it is tall enough to cover the item): skip
      if (occ.length && it.ground.length > 1 && occ.some(i => this.occ[i].by0 < it.ground[0][1] - 4 * zpx && it.ground.every(([x, y]) => inside(this.occ[i].hull, x, y)))) continue;
      const box = it.draw();
      if (!occ.length) continue;
      // put back the buildings in front: their pixels come straight from the frame
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [px, py] of box) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      x0 = Math.max(0, Math.floor(x0 - 2)); y0 = Math.max(0, Math.floor(y0 - 2)); x1 = Math.min(W, Math.ceil(x1 + 2)); y1 = Math.min(H, Math.ceil(y1 + 2));
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.save();
      ctx.beginPath();
      for (const i of occ) { const h = this.occ[i].hull; ctx.moveTo(h[0][0], h[0][1]); for (let q = 1; q < h.length; q++) ctx.lineTo(h[q][0], h[q][1]); ctx.closePath(); }
      ctx.clip();
      ctx.drawImage(bm, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
    this.cost = this.cost * 0.9 + (performance.now() - t0) * 0.1;
  }

  private drawCar(ctx: CanvasRenderingContext2D, c: Car, fp: P2[], rot: (x: number, y: number) => P2, Pr: (x: number, y: number, z: number) => P2, zpx: number, d: LifeData): P2[] {
    const onBridge = c.leg?.axis === 1 && c.x > d.canal - 0.05 && c.x < d.canal + 1.05;
    const z0 = onBridge ? 0.8 : 0;
    const shadow = carFootprint(c.x + 0.03, c.y + 0.02, c.hx, c.hy, c.len + 0.03, c.wid + 0.02).map(([x, y]) => { const [rx, ry] = rot(x, y); return Pr(rx, ry, z0); });
    poly(ctx, shadow, 'rgba(31,36,33,0.14)');
    const out = drawQuadBox(ctx, rot, Pr, fp, z0 + 0.25, 1.25, c.col);
    if (c.len * 22 * zpx > 7) {
      const back = -c.len * 0.08;
      const cab = carFootprint(c.x + c.hx * back, c.y + c.hy * back, c.hx, c.hy, c.len * 0.55, c.wid * 0.84);
      out.push(...drawQuadBox(ctx, rot, Pr, cab, z0 + 1.5, 0.75, GLASS));
    }
    return out;
  }

  // ---------- occlusion ----------
  private buildOcclusion(key: string, d: LifeData, rot: (x: number, y: number) => P2, Pr: (x: number, y: number, z: number) => P2, fz: number, meta: SeqMeta, W: number, H: number) {
    if (key === this.occKey) return;
    this.occKey = key;
    const CELL = 96;
    this.bcols = Math.ceil(W / CELL) + 1; this.brows = Math.ceil(H / CELL) + 1;
    this.buckets = Array.from({ length: this.bcols * this.brows }, () => []);
    this.occ = [];
    const [pvx, pvy] = meta.pivot;
    const ghosting = fz > 0.01 && meta.focus !== null;
    for (const [x, y, w, dd, h] of d.occluders) {
      if (ghosting) {
        // buildings between the camera and the focused project are drawn see-through: they hide nothing
        const [cx, cy] = rot(x + w / 2, y + dd / 2);
        const ds = cx + cy - (pvx + pvy), dz = Math.abs(cx - cy - (pvx - pvy));
        if (ds > 0.2 && ds < 7 && dz < 3.2) continue;
      }
      const pts: P2[] = [];
      for (const [rx, ry] of [rot(x, y), rot(x + w, y), rot(x + w, y + dd), rot(x, y + dd)]) pts.push(Pr(rx, ry, 0), Pr(rx, ry, h));
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const [px, py] of pts) { bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); by0 = Math.min(by0, py); by1 = Math.max(by1, py); }
      if (bx1 < 0 || by1 < 0 || bx0 > W || by0 > H) continue;
      const idx = this.occ.push({ bx0, by0, bx1, by1, hull: hull(pts) }) - 1;
      for (let gx = Math.max(0, Math.floor(bx0 / CELL)); gx <= Math.min(this.bcols - 1, Math.floor(bx1 / CELL)); gx++)
        for (let gy = Math.max(0, Math.floor(by0 / CELL)); gy <= Math.min(this.brows - 1, Math.floor(by1 / CELL)); gy++)
          this.buckets[gy * this.bcols + gx].push(idx);
    }
  }

  /** Buildings standing in front of any of these ground points (the point falls inside their silhouette). */
  private occludersOf(points: P2[]): number[] {
    const found: number[] = [];
    for (const [px, py] of points) {
      const gx = Math.floor(px / 96), gy = Math.floor(py / 96);
      if (gx < 0 || gy < 0 || gx >= this.bcols || gy >= this.brows) continue;
      for (const i of this.buckets[gy * this.bcols + gx]) {
        if (found.includes(i)) continue;
        const o = this.occ[i];
        if (px < o.bx0 || px > o.bx1 || py < o.by0 || py > o.by1) continue;
        if (inside(o.hull, px, py)) found.push(i);
      }
    }
    return found;
  }
}

// ---------- drawing helpers ----------
function carFootprint(x: number, y: number, hx: number, hy: number, len: number, wid: number): P2[] {
  const nx = -hy, ny = hx, l = len / 2, w = wid / 2;
  const q: P2[] = [[x - hx * l - nx * w, y - hy * l - ny * w], [x + hx * l - nx * w, y + hy * l - ny * w], [x + hx * l + nx * w, y + hy * l + ny * w], [x - hx * l + nx * w, y - hy * l + ny * w]];
  // same winding as the frame renderer's boxes, so its face test applies
  const area = q.reduce((a, p, i) => { const n = q[(i + 1) % 4]; return a + p[0] * n[1] - n[0] * p[1]; }, 0);
  return area < 0 ? q.reverse() : q;
}

function poly(ctx: CanvasRenderingContext2D, p: P2[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath(); ctx.fill();
}

/** A box on any footprint: faces turned to the camera, lit or shaded, like the frame renderer. Returns its screen points. */
function drawQuadBox(ctx: CanvasRenderingContext2D, rot: (x: number, y: number) => P2, Pr: (x: number, y: number, z: number) => P2, fp: P2[], z0: number, h: number, c: Shade): P2[] {
  const cr = fp.map(([x, y]) => rot(x, y));
  const out: P2[] = [];
  for (let e = 0; e < 4; e++) {
    const p0 = cr[e], p1 = cr[(e + 1) % 4], nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]);
    if (nx + ny <= 1e-6) continue;
    const f = [Pr(p0[0], p0[1], z0), Pr(p1[0], p1[1], z0), Pr(p1[0], p1[1], z0 + h), Pr(p0[0], p0[1], z0 + h)];
    poly(ctx, f, nx > ny ? c[2] : c[1]);
    out.push(...f);
  }
  const top = cr.map(([rx, ry]) => Pr(rx, ry, z0 + h));
  poly(ctx, top, c[0]);
  out.push(...top);
  return out;
}

function drawPerson(ctx: CanvasRenderingContext2D, w: Walker, P: (x: number, y: number, z: number) => P2, zpx: number): P2[] {
  const foot = P(w.x, w.y, 0), hip = P(w.x, w.y, 1.0), neck = P(w.x, w.y, 1.75), head = P(w.x, w.y, 2.05);
  const hr = Math.max(1, 0.3 * zpx);
  ctx.fillStyle = 'rgba(31,36,33,0.16)';
  ctx.beginPath(); ctx.ellipse(foot[0], foot[1], Math.max(1, 0.45 * zpx), Math.max(0.5, 0.22 * zpx), 0, 0, 6.283); ctx.fill();
  ctx.lineCap = 'round';
  if (2.1 * zpx < 4) {
    ctx.strokeStyle = w.col; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(neck[0], neck[1]); ctx.stroke();
    ctx.fillStyle = '#3A403C'; ctx.beginPath(); ctx.arc(head[0], head[1], 0.9, 0, 6.283); ctx.fill();
  } else {
    const swing = Math.sin(w.ph) * 0.014;
    const fa = P(w.x + w.dx * swing, w.y + w.dy * swing, 0), fb = P(w.x - w.dx * swing, w.y - w.dy * swing, 0);
    ctx.strokeStyle = '#3A403C'; ctx.lineWidth = Math.max(1, 0.3 * zpx);
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(fa[0], fa[1]); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(fb[0], fb[1]); ctx.stroke();
    ctx.strokeStyle = w.col; ctx.lineWidth = Math.max(1.4, 0.55 * zpx);
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(neck[0], neck[1]); ctx.stroke();
    ctx.fillStyle = '#3A403C'; ctx.beginPath(); ctx.arc(head[0], head[1], hr, 0, 6.283); ctx.fill();
  }
  const pad = Math.max(2, 0.6 * zpx);
  return [[foot[0] - pad, foot[1] + pad], [head[0] + pad, head[1] - hr - pad]];
}

function drawLight(ctx: CanvasRenderingContext2D, base: P2, top: P2, sig: Sig, zpx: number): P2[] {
  if (zpx < 1.3) {
    // far away: only the lit lamp, a small spark of colour
    ctx.fillStyle = LIGHT[sig]; ctx.fillRect(top[0] - 0.9, top[1] - 0.9, 1.8, 1.8);
    return [[top[0] - 2, top[1] - 2], [top[0] + 2, base[1] + 2]];
  }
  if (zpx < 3.5) {
    // mid distance: pole and the lit lamp
    ctx.strokeStyle = '#5E6560'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.fillStyle = '#2A2F2C'; ctx.fillRect(top[0] - 1.4, top[1] - 3.2, 2.8, 3.4);
    ctx.fillStyle = LIGHT[sig]; ctx.fillRect(top[0] - 0.8, top[1] - (sig === 'r' ? 2.8 : sig === 'a' ? 1.9 : 1.1), 1.6, 1.0);
    return [[top[0] - 3, top[1] - 4], [top[0] + 3, base[1] + 2]];
  }
  ctx.strokeStyle = '#5E6560'; ctx.lineWidth = Math.max(0.8, 0.16 * zpx); ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
  const hw = Math.max(2, 0.42 * zpx), hh = Math.max(4.5, 1.25 * zpx);
  ctx.fillStyle = '#2A2F2C';
  ctx.fillRect(top[0] - hw / 2, top[1] - hh, hw, hh);
  const r = Math.max(0.8, 0.15 * zpx), slot = sig === 'r' ? 0 : sig === 'a' ? 1 : 2;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === slot ? LIGHT[sig] : '#4A504C';
    ctx.beginPath(); ctx.arc(top[0], top[1] - hh + (hh * (i + 0.5)) / 3, r, 0, 6.283); ctx.fill();
  }
  return [[top[0] - hw, top[1] - hh - 2], [top[0] + hw, base[1] + 2]];
}

function hull(points: P2[]): P2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function inside(h: P2[], x: number, y: number) {
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
  }
  return h.length > 2;
}

export const cityLife = new CityLife();
export type { CityLife };
