// Faint architectural sketches behind the hero, in azul vívido: two plan drawings and one
// axonometric (3D) drawing of pavilion studies. Decorative only; kept to the edges so the
// O window stays the focus.

const CO = '#123BFF';
const thin = { stroke: CO, strokeWidth: 1, fill: 'none', vectorEffect: 'non-scaling-stroke' as const };
const hair = { ...thin, strokeWidth: 0.6 };
const label = { fill: CO, stroke: 'none', fontFamily: 'var(--font-inter), Inter, sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '0.3em' };
const rad = (d: number) => (d * Math.PI) / 180;
/** Trig differs in the last digit between the server and the browser: round, so hydration matches. */
const round1 = (v: number) => Math.round(v * 10) / 10;
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Person seen from above (plan): a dot with a small shoulder line. */
const Dot = ({ x, y }: { x: number; y: number }) => <g><circle cx={x} cy={y} r={2.2} fill={CO} /><line x1={x - 4} y1={y + 4} x2={x + 4} y2={y + 4} {...hair} /></g>;
/** Person in elevation (3D drawing): head + body. */
const Figure = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g><circle cx={x} cy={y - 13 * s} r={2.2 * s} {...thin} /><path d={`M${x} ${y - 11 * s} L${x} ${y - 4 * s} M${x - 3 * s} ${y} L${x} ${y - 4 * s} L${x + 3 * s} ${y} M${x - 3.5 * s} ${y - 8.5 * s} L${x + 3.5 * s} ${y - 8.5 * s}`} {...thin} /></g>
);

// ------------------------------------------------------------------------------------------
// 1. Spiral ribbon walls, in plan: tapering ribbons with their panel joints
function Ribbon({ cx, cy, r0, r1, a0, a1, w, joints = 30 }: { cx: number; cy: number; r0: number; r1: number; a0: number; a1: number; w: number; joints?: number }) {
  const N = 72;
  const at = (t: number) => {
    const a = rad(a0 + (a1 - a0) * t), r = r0 + (r1 - r0) * t, ww = w * Math.pow(Math.sin(Math.PI * t), 0.6);
    const c = Math.cos(a), s = Math.sin(a);
    return { o: [round1(cx + (r + ww / 2) * c), round1(cy + (r + ww / 2) * s)] as [number, number], i: [round1(cx + (r - ww / 2) * c), round1(cy + (r - ww / 2) * s)] as [number, number] };
  };
  const samples = Array.from({ length: N + 1 }, (_, k) => at(k / N));
  return (
    <g>
      <polygon points={pts([...samples.map(p => p.o), ...samples.map(p => p.i).reverse()])} {...thin} />
      {Array.from({ length: joints - 1 }, (_, k) => { const p = at((k + 1) / joints); return <line key={k} x1={p.i[0]} y1={p.i[1]} x2={p.o[0]} y2={p.o[1]} {...hair} />; })}
    </g>
  );
}

function SpiralPlan() {
  return (
    <g>
      <Ribbon cx={640} cy={830} r0={150} r1={118} a0={150} a1={440} w={30} joints={40} />
      <Ribbon cx={438} cy={905} r0={78} r1={70} a0={195} a1={335} w={16} joints={16} />
      <Ribbon cx={770} cy={965} r0={120} r1={96} a0={185} a1={318} w={18} joints={18} />
      {/* canopy on a single post, at the end of the big ribbon */}
      <path d="M760 812 L808 790 L812 818 Z" {...thin} /><circle cx={790} cy={812} r={2} {...thin} />
      {[[600, 790], [622, 838], [655, 812], [470, 905], [720, 912], [835, 880], [820, 940]].map(([x, y]) => <Dot key={`${x}${y}`} x={x} y={y} />)}
      {/* radius dimension */}
      <line x1={640} y1={830} x2={746} y2={724} {...hair} strokeDasharray="3 4" />
      <circle cx={640} cy={830} r={2} fill={CO} />
      <text {...label} x={660} y={790} transform="rotate(-45 660 790)">R 12.50</text>
      <text {...label} x={420} y={985}>PASEO · PLANTA · E 1:250</text>
    </g>
  );
}

// ------------------------------------------------------------------------------------------
// 2. Curved-wall pavilion under a floating ring, isometric (3D) sketch
type P2 = [number, number];
const quad = (a: P2, c: P2, b: P2, n = 10): P2[] =>
  Array.from({ length: n + 1 }, (_, k) => { const t = k / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as P2; });
const line2 = (a: P2, b: P2, n = 6): P2[] => Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] as P2);
const circle2 = (c: P2, r: number, from = 0, to = 360, n = 48): P2[] =>
  Array.from({ length: n + 1 }, (_, k) => { const a = rad(from + ((to - from) * k) / n); return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as P2; });

// isometric projection of the pavilion: plan metres (x, y) and height z → viewBox units
const ISO = { ox: 398, oy: 214, s: 8.2 };
const P = (x: number, y: number, z: number): P2 => [round1(ISO.ox + (x - y) * 0.866 * ISO.s), round1(ISO.oy + (x + y) * 0.5 * ISO.s - z * ISO.s)];
const proj = (path: P2[], z: number) => pts(path.map(([x, y]) => P(x, y, z)));

/** A wall: its plan path extruded to height h, with vertical edges at the ends and along curves. */
function Wall3D({ path, h, every = 5 }: { path: P2[]; h: number; every?: number }) {
  return (
    <g>
      <polyline points={proj(path, 0)} {...thin} />
      <polyline points={proj(path, h)} {...thin} />
      {path.map(([x, y], k) => (k === 0 || k === path.length - 1 || k % every === 0) &&
        <line key={k} x1={P(x, y, 0)[0]} y1={P(x, y, 0)[1]} x2={P(x, y, h)[0]} y2={P(x, y, h)[1]} {...(k === 0 || k === path.length - 1 ? thin : hair)} />)}
    </g>
  );
}

function RingPavilion3D() {
  const longWall = [...line2([-13, 5], [-3, 5]), ...quad([-3, 5], [1.5, 5], [1.8, 1.2]).slice(1), ...line2([1.8, 1.2], [9, -9]).slice(1)];
  const sWall = [...quad([-7, 9], [-3.5, 9], [-3.2, 6.6], 8), ...quad([-3.2, 6.6], [-2.8, 4.2], [0.5, 5.6], 8).slice(1), ...quad([0.5, 5.6], [3.6, 7], [3.4, 9.4], 8).slice(1)];
  const RING = 9.2, RZ = 8.5;
  return (
    <g>
      {/* ground: the pavilion's square of paving */}
      <polygon points={pts([P(-15, -11, 0), P(13, -11, 0), P(13, 13, 0), P(-15, 13, 0)])} {...hair} strokeDasharray="2 5" />
      <Wall3D path={longWall} h={4.2} />
      <Wall3D path={sWall} h={3.2} every={4} />
      {/* the cylinder room, with an opening facing the ring */}
      <Wall3D path={circle2([7.5, 4.5], 2.6, -40, 250, 36)} h={3.6} every={6} />
      <polyline points={proj(circle2([7.5, 4.5], 2.2, -40, 250, 36), 3.6)} {...hair} />
      {/* the ring floating overhead, on three slender posts */}
      <polyline points={proj(circle2([0, 0], RING), RZ)} {...thin} />
      <polyline points={proj(circle2([0, 0], RING - 0.55), RZ)} {...thin} />
      <polyline points={proj(circle2([0, 0], RING, -45, 135), RZ - 0.45)} {...hair} />
      {[15, 140, 250].map(a => { const x = RING * Math.cos(rad(a)), y = RING * Math.sin(rad(a)); const b = P(x, y, 0), t = P(x, y, RZ - 0.45); return <line key={a} x1={b[0]} y1={b[1]} x2={t[0]} y2={t[1]} {...thin} />; })}
      {/* people for scale */}
      {([[-1.5, -2], [4, 2.5], [-11, 9.5], [6, -4]] as P2[]).map(([x, y]) => { const [fx, fy] = P(x, y, 0); return <Figure key={`${x}${y}`} x={fx} y={fy} s={0.85} />; })}
      <text {...label} x={290} y={340}>PABELLÓN DEL ANILLO · ISOMETRÍA</text>
    </g>
  );
}

// ------------------------------------------------------------------------------------------
// 3. Elevated ring building, axonometric: slab, columns, glass skin, hatched shadow, people
function RingAxonometric() {
  const cx = 1318, cy = 238;        // centre of the slab's top face
  const RX = 205, RY = 74, rx = 160, ry = 52, slab = 11, H = 104;
  const e = (a: number, X: number, Y: number, dy = 0): [number, number] => [round1(cx + X * Math.cos(rad(a))), round1(cy + dy + Y * Math.sin(rad(a)))];
  const arc = (X: number, Y: number, dy: number, from: number, to: number, n = 60) => Array.from({ length: n + 1 }, (_, k) => e(from + ((to - from) * k) / n, X, Y, dy));
  const cols = Array.from({ length: 19 }, (_, k) => 8 + k * 9.1);
  return (
    <g>
      <defs>
        <pattern id="pb-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={CO} strokeWidth="1" />
        </pattern>
      </defs>
      {/* landscape: paths sweeping around the building */}
      <path d="M1010 120 C1120 70 1300 64 1420 92 C1500 110 1560 150 1600 170" {...hair} />
      <path d="M1000 150 C1110 112 1210 118 1240 150" {...hair} />
      <path d="M1040 400 C1120 440 1200 452 1300 450 C1420 448 1520 470 1600 520" {...hair} />
      <path d="M1520 270 C1560 262 1585 280 1600 300" {...hair} />
      {/* shadow cast to the lower right */}
      <ellipse cx={cx + 60} cy={cy + H + 30} rx={RX - 10} ry={RY - 6} fill="url(#pb-hatch)" opacity={0.5} />
      {/* glass skin at ground level (front half) and its mullions */}
      <polyline points={pts(arc(rx + 12, ry + 6, H + slab, 0, 180))} {...thin} />
      {Array.from({ length: 13 }, (_, k) => { const [x, y] = e(12 + k * 12.5, rx + 12, ry + 6, H + slab); return <line key={k} x1={x} y1={y} x2={x} y2={y - H + 6} {...hair} />; })}
      {/* columns under the slab edge */}
      {cols.map(a => { const [x, y] = e(a, RX - 8, RY - 3, slab); return <line key={a} x1={x} y1={y} x2={x} y2={y + H} {...thin} />; })}
      {/* slab: top face (outer + inner edge), front thickness */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} {...thin} />
      <ellipse cx={cx} cy={cy - 4} rx={rx} ry={ry} {...thin} />
      <polyline points={pts(arc(RX, RY, slab, 0, 180))} {...thin} />
      <line x1={cx + RX} y1={cy} x2={cx + RX} y2={cy + slab} {...thin} />
      <line x1={cx - RX} y1={cy} x2={cx - RX} y2={cy + slab} {...thin} />
      {/* inner face of the ring seen through the opening (back half) */}
      <polyline points={pts(arc(rx, ry, slab - 4, 180, 360))} {...hair} />
      {/* people on the roof walk and below */}
      <Figure x={1268} y={cy + RY - 6} s={0.9} /><Figure x={1282} y={cy + RY - 8} s={0.9} /><Figure x={1380} y={cy + RY - 12} s={0.9} />
      <Figure x={1406} y={cy + H + 52} /><Figure x={1470} y={cy + H + 30} />
      <text {...label} x={1190} y={478}>ANILLO ELEVADO · AXONOMETRÍA</text>
    </g>
  );
}

export default function PlanBackdrop() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <RingAxonometric />
      <RingPavilion3D />
      <SpiralPlan />
    </svg>
  );
}
