import { FrameSequence } from './frames';
import { frameUrl, type RenderManifest, type Tier } from './manifest';

export const RENDERS_URL = process.env.NEXT_PUBLIC_RENDERS_URL || '/renders';

let manifestPromise: Promise<RenderManifest> | null = null;
export function loadManifest(): Promise<RenderManifest> {
  manifestPromise ??= fetch(`${RENDERS_URL}/manifest.json`).then(r => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json();
  });
  return manifestPromise;
}

/** Portrait screens get the portrait renders; everything else the landscape ones. */
export const currentTier = (): Tier => (window.matchMedia('(max-aspect-ratio: 1/1)').matches ? 'm' : 'd');

// Keep at most a few sequences alive; older ones are disposed to free memory.
const MAX_LIVE = 4;
const live = new Map<string, FrameSequence>();

export async function getSequence(key: string, tier: Tier = currentTier()): Promise<FrameSequence> {
  const id = `${key}@${tier}`;
  const hit = live.get(id);
  if (hit) { live.delete(id); live.set(id, hit); return hit; }
  const m = await loadManifest();
  const info = m.sequences[key];
  if (!info) throw new Error(`unknown sequence ${key}`);
  const urls = Array.from({ length: info.frames }, (_, i) => frameUrl(RENDERS_URL, info, tier, i));
  // portrait frames are ~2.2x lighter, so the phone keeps a wider window for the same memory
  const seq = new FrameSequence(urls, tier === 'd' ? 12 : 16).start();
  const cams = info.cam?.frames[tier], t = m.tiers[tier];
  if (info.cam && cams) seq.meta = { cams, pivot: info.cam.pivot, focus: info.cam.focus, s: t.s ?? 1, w: t.w, h: t.h };
  live.set(id, seq);
  while (live.size > MAX_LIVE) {
    const [oldId, old] = live.entries().next().value as [string, FrameSequence];
    if (oldId.startsWith('city@')) { live.delete(oldId); live.set(oldId, old); continue; } // the city stays
    old.dispose();
    live.delete(oldId);
  }
  return seq;
}

/** Start downloading a sequence ahead of need (e.g. on hover). */
export function prefetchSequence(key: string) {
  getSequence(key).catch(() => {});
}
