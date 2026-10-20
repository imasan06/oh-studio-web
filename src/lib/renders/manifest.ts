// Contract between the render pipeline (placeholder script or Blender export) and the site.
// Frames live at `${RENDERS_URL}/${sequence.dir}/${tier}/${index padded to 3}.webp`.

export type Tier = 'd' | 'm'; // d = desktop landscape, m = mobile portrait

export type SequenceInfo = {
  dir: string;
  frames: number;
  /** Camera per frame ([k, tx, ty, theta, fz]) for the live city layer. Optional: real renders without it simply have no live layer. */
  cam?: { pivot: [number, number]; focus: number | null; frames: Partial<Record<Tier, number[][]>> };
  /** For each tier, per frame, per city project index: normalised [x, y] of the roof anchor. */
  anchors?: Partial<Record<Tier, [number, number][][]>>;
};

export type RenderManifest = {
  tiers: Record<Tier, { w: number; h: number; s?: number }>;
  sequences: Record<string, SequenceInfo>;
};

export const SEQ = {
  city: 'city',
  dive: (slug: string) => `dive:${slug}`,
  orbit: (slug: string) => `orbit:${slug}`,
};

export const ORBIT_STEP_DEG = 5;

export const frameUrl = (base: string, seq: SequenceInfo, tier: Tier, i: number) =>
  `${base}/${seq.dir}/${tier}/${String(i).padStart(3, '0')}.webp`;
