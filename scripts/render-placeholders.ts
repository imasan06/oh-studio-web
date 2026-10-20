// Renders the placeholder city as WebP frame sequences + public/renders/manifest.json.
// Usage: npm run renders            (everything)
//        npm run renders -- city    (only sequences whose key starts with "city")
import { fork } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { PROJECTS, L, anchors, camOf, lifeData, projectHeight, renderSVG, sceneData, type Cam, type Frame, type Shot } from './city/geometry';
import { projects } from '../src/content/projects';
import { SEQ, ORBIT_STEP_DEG, type RenderManifest, type Tier } from '../src/lib/renders/manifest';

const OUT = path.join(process.cwd(), 'public', 'renders');
const TIERS: Record<Tier, Frame> = { d: { w: 1920, h: 1080, s: 1 }, m: { w: 720, h: 1280, s: 0.95 } };
const CITY_FRAMES = 120, DIVE_FRAMES = 60, ORBIT_FRAMES = 360 / ORBIT_STEP_DEG;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const inOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), t)), // log-space zoom feels like constant speed
  fx: lerp(a.fx, b.fx, t), fy: lerp(a.fy, b.fy, t), sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t),
});

const camHero = (tier: Tier): Cam => ({ k: tier === 'd' ? 1.25 : 1.1, fx: 80, fy: -75, sx: 960, sy: 540 });
const camCity = (tier: Tier): Cam => (tier === 'd' ? { k: 2.6, fx: 80, fy: -40, sx: 960, sy: 600 } : { k: 1.45, fx: 80, fy: -40, sx: 960, sy: 470 });
const camFocus = (i: number, tier: Tier): Cam => {
  const p = PROJECTS[i], h = projectHeight(i), f = L(p.x + 0.5, p.y + 0.5, h * 0.5);
  return { k: (670 / (h + 20)) * (tier === 'd' ? 1 : 0.85), fx: f[0], fy: f[1], sx: 960, sy: tier === 'd' ? 560 : 540 };
};
const pivotOf = (i: number): [number, number] => [PROJECTS[i].x + 0.5, PROJECTS[i].y + 0.5];

type SeqDef = { key: string; dir: string; frames: number; anchors: boolean; shot: (f: number, tier: Tier) => Shot };

function sequences(): SeqDef[] {
  const defs: SeqDef[] = [{
    key: SEQ.city, dir: 'city', frames: CITY_FRAMES, anchors: true,
    shot: (f, tier) => {
      // only the camera moves with the scroll: the city itself stays as it is
      const u = f / (CITY_FRAMES - 1);
      return { cam: lerpCam(camHero(tier), camCity(tier), inOutSine(u)), theta: 0, pivot: [0, 0], fz: 0, focus: null };
    },
  }];
  for (const p of projects) {
    const i = p.cityIndex;
    defs.push({
      key: SEQ.dive(p.slug), dir: `projects/${p.slug}/dive`, frames: DIVE_FRAMES, anchors: false,
      shot: (f, tier) => {
        const u = f / (DIVE_FRAMES - 1);
        return {
          cam: lerpCam(camCity(tier), camFocus(i, tier), inOutCubic(u)), theta: 0, pivot: pivotOf(i),
          fz: inOutSine(clamp((u - 0.1) / 0.8)), focus: i,
        };
      },
    });
    if (p.model) continue; // live 3D view instead of orbit frames
    defs.push({
      key: SEQ.orbit(p.slug), dir: `projects/${p.slug}/orbit`, frames: ORBIT_FRAMES, anchors: false,
      shot: (f, tier) => ({
        cam: camFocus(i, tier), theta: f * ORBIT_STEP_DEG, pivot: pivotOf(i), fz: 1, focus: i,
      }),
    });
  }
  return defs;
}

type Job = { key: string; tier: Tier; from: number; to: number };

async function renderJob(job: Job) {
  const def = sequences().find(d => d.key === job.key)!;
  const fr = TIERS[job.tier];
  const dir = path.join(OUT, def.dir, job.tier);
  await mkdir(dir, { recursive: true });
  for (let f = job.from; f < job.to; f++) {
    const png = new Resvg(renderSVG(def.shot(f, job.tier), fr)).render().asPng();
    await sharp(png).webp({ quality: 72, effort: 5, smartSubsample: true }).toFile(path.join(dir, `${String(f).padStart(3, '0')}.webp`));
  }
}

async function main() {
  const only = process.argv[2];
  const defs = sequences();
  const todo = only ? defs.filter(d => d.key.startsWith(only)) : defs;

  const jobs: Job[] = [];
  for (const d of todo) for (const tier of ['d', 'm'] as Tier[]) for (let f = 0; f < d.frames; f += 15) jobs.push({ key: d.key, tier, from: f, to: Math.min(d.frames, f + 15) });

  const workers = Math.max(1, Math.min(availableParallelism() - 1, 10));
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const j = job;
      await new Promise<void>((resolve, reject) => {
        const child = fork(process.argv[1], ['--job', JSON.stringify(j)], { execArgv: process.execArgv, stdio: 'inherit' });
        child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`job ${j.key} ${j.tier} failed`))));
      });
      done++;
      process.stdout.write(`\r${done} jobs · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));

  // the manifest always describes every sequence, so partial re-renders keep it complete
  const manifest: RenderManifest = { tiers: { d: { ...TIERS.d }, m: { ...TIERS.m } }, sequences: {} };
  for (const d of defs) {
    const s0 = d.shot(0, 'd');
    manifest.sequences[d.key] = {
      dir: d.dir, frames: d.frames,
      // per-frame camera, so the live layer (cars, people, lights) lines up with each frame
      cam: {
        pivot: s0.pivot, focus: s0.focus,
        frames: { d: Array.from({ length: d.frames }, (_, f) => camOf(d.shot(f, 'd'))), m: Array.from({ length: d.frames }, (_, f) => camOf(d.shot(f, 'm'))) },
      },
    };
    if (d.anchors) {
      manifest.sequences[d.key].anchors = {
        d: Array.from({ length: d.frames }, (_, f) => anchors(d.shot(f, 'd'), TIERS.d)),
        m: Array.from({ length: d.frames }, (_, f) => anchors(d.shot(f, 'm'), TIERS.m)),
      };
    }
  }
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(OUT, 'city-life.json'), JSON.stringify(lifeData()));
  await writeFile(path.join(OUT, 'city-scene.json'), JSON.stringify(sceneData()));
  console.log(`\nmanifest written · ${Object.keys(manifest.sequences).length} sequences`);
}

if (process.argv[2] === "--check") {
  for (const d of sequences()) for (const tier of ["d", "m"] as Tier[]) for (let f = 0; f < d.frames; f++) {
    const svg = renderSVG(d.shot(f, tier), TIERS[tier]);
    if (/NaN|Infinity/.test(svg)) console.log("bad", d.key, tier, f, svg.match(/.{60}(NaN|Infinity).{20}/)?.[0]);
  }
  process.exit(0);
}
const jobArg = process.argv.indexOf("--job");
if (jobArg > 0) renderJob(JSON.parse(process.argv[jobArg + 1])).catch(e => { console.error(e); process.exit(1); });
else main().catch(e => { console.error(e); process.exit(1); });
