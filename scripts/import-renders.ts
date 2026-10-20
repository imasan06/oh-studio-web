// Imports a rendered image sequence (PNG/JPG/TIFF/WebP from any renderer) into the site.
//
//   npm run import-renders -- --seq city --tier d --src ~/renders/city-landscape [--anchors anchors-city-d.json]
//   npm run import-renders -- --seq dive:pabellon-lima --tier m --src ~/renders/pabellon-dive-portrait
//   npm run import-renders -- --seq orbit:pabellon-lima --tier d --src ~/renders/pabellon-orbit
//
// Frames are sorted by file name, resized (cover) to the tier size and written as WebP;
// public/renders/manifest.json is updated. Render both tiers with the same frame count.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { RenderManifest, Tier } from '../src/lib/renders/manifest';

const OUT = path.join(process.cwd(), 'public', 'renders');
const TIERS: Record<Tier, { w: number; h: number }> = { d: { w: 1920, h: 1080 }, m: { w: 720, h: 1280 } };

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const dirFor = (seq: string) => {
  if (seq === 'city') return 'city';
  const [kind, slug] = seq.split(':');
  if ((kind === 'dive' || kind === 'orbit') && slug) return `projects/${slug}/${kind}`;
  throw new Error(`--seq must be "city", "dive:<slug>" or "orbit:<slug>" (got ${seq})`);
};

async function main() {
  const seq = arg('seq'), tier = arg('tier') as Tier | undefined, src = arg('src');
  const quality = Number(arg('quality') ?? 72);
  if (!seq || !src || (tier !== 'd' && tier !== 'm')) throw new Error('usage: --seq <key> --tier d|m --src <folder> [--anchors file.json] [--quality 72]');

  const files = (await readdir(src)).filter(f => /\.(png|jpe?g|tiff?|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!files.length) throw new Error(`no images in ${src}`);
  const dir = dirFor(seq);
  const dest = path.join(OUT, dir, tier);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  const { w, h } = TIERS[tier];
  let bytes = 0;
  for (let i = 0; i < files.length; i++) {
    const info = await sharp(path.join(src, files[i])).resize(w, h, { fit: 'cover' }).webp({ quality, effort: 5, smartSubsample: true })
      .toFile(path.join(dest, `${String(i).padStart(3, '0')}.webp`));
    bytes += info.size;
    process.stdout.write(`\r${i + 1}/${files.length}`);
  }

  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest: RenderManifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => JSON.stringify({ tiers: TIERS, sequences: {} })));
  const entry = (manifest.sequences[seq] ??= { dir, frames: files.length });
  if (entry.frames !== files.length) console.warn(`\nwarning: ${seq} had ${entry.frames} frames, now ${files.length} — re-import the other tier with the same count`);
  entry.frames = files.length;
  const anchorsFile = arg('anchors');
  if (anchorsFile) {
    const { frames } = JSON.parse(await readFile(anchorsFile, 'utf8')) as { frames: [number, number][][] };
    if (frames.length !== files.length) throw new Error(`anchors have ${frames.length} frames, images ${files.length}`);
    (entry.anchors ??= {})[tier] = frames;
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
  console.log(`\n${seq} [${tier}] · ${files.length} frames · ${(bytes / 1048576).toFixed(1)} MB → ${path.relative(process.cwd(), dest)}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
