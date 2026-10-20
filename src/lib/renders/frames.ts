// A pre-rendered image sequence, built for scrubbing without hurting the machine:
// - compressed frames are fetched progressively (every 8th first, then 4th, 2nd, all),
//   so the whole range is scrubbable early at low temporal resolution;
// - only a small window of frames is kept decoded (decoded 1080p ≈ 8 MB each), LRU-evicted;
// - when the exact frame isn't ready, the nearest decoded frame is shown instead of blocking.

const CONCURRENCY = 6;

/** Camera of each frame, so live elements can be drawn in register with the image. */
export type SeqMeta = {
  cams: number[][];               // per frame: [k, tx, ty, theta, fz]
  pivot: [number, number];
  focus: number | null;
  s: number; w: number; h: number; // output frame size and design→frame scale
};

export class FrameSequence {
  readonly count: number;
  /** Bumps whenever a new frame becomes drawable, so the stage knows to repaint. */
  version = 0;
  meta: SeqMeta | null = null;
  fetched = 0;
  private blobs: (Blob | undefined)[];
  private bitmaps = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private wanted = new Set<number>();
  private queue: number[];
  private inflight = 0;
  private ctrl = new AbortController();
  private disposed = false;
  private settle: (() => void)[] = [];

  constructor(private urls: string[], private capacity: number) {
    this.count = urls.length;
    this.blobs = new Array(this.count);
    this.queue = strideOrder(this.count);
  }

  start() {
    this.pump();
    return this;
  }

  /** Resolves once every frame has been downloaded. */
  whenFetched(): Promise<void> {
    if (this.fetched >= this.count) return Promise.resolve();
    return new Promise(r => this.settle.push(r));
  }

  /** Resolves once frame `i` can be drawn (exact). */
  async whenReady(i: number): Promise<void> {
    while (!this.disposed && !this.bitmaps.has(i)) {
      this.request(i);
      await new Promise(r => setTimeout(r, 30));
    }
  }

  /** Best drawable bitmap for frame i: the exact one, or the nearest already decoded (with its index). */
  get(i: number): { bm: ImageBitmap; i: number } | null {
    const exact = this.bitmaps.get(i);
    if (exact) {
      this.bitmaps.delete(i);
      this.bitmaps.set(i, exact); // refresh LRU position
      return { bm: exact, i };
    }
    this.request(i);
    let best: { bm: ImageBitmap; i: number } | null = null, bestD = Infinity;
    for (const [k, bm] of this.bitmaps) { const d = Math.abs(k - i); if (d < bestD) { bestD = d; best = { bm, i: k }; } }
    return best;
  }

  /** Decode ahead in the direction of travel so scrubbing rarely waits. */
  prefetch(i: number, dir: number, ahead = 4) {
    const step = dir < 0 ? -1 : 1;
    for (let k = 1; k <= ahead; k++) {
      const j = i + k * step;
      if (j < 0 || j >= this.count) break;
      this.request(j);
    }
  }

  dispose() {
    this.disposed = true;
    this.ctrl.abort();
    for (const bm of this.bitmaps.values()) bm.close();
    this.bitmaps.clear();
    this.blobs = [];
  }

  private request(i: number) {
    if (this.bitmaps.has(i) || this.decoding.has(i)) return;
    if (this.blobs[i]) { this.decode(i); return; }
    this.wanted.add(i);
    // jump the download queue
    const at = this.queue.indexOf(i);
    if (at > 0) { this.queue.splice(at, 1); this.queue.unshift(i); }
  }

  private pump() {
    while (!this.disposed && this.inflight < CONCURRENCY && this.queue.length) {
      const i = this.queue.shift()!;
      if (this.blobs[i]) continue;
      this.inflight++;
      fetch(this.urls[i], { signal: this.ctrl.signal })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status} ${this.urls[i]}`))))
        .then(blob => {
          this.blobs[i] = blob;
          this.fetched++;
          // keep the coarse first pass decoded early: it's what makes fast scrubs look continuous
          if (this.wanted.delete(i) || this.bitmaps.size < Math.min(4, this.capacity)) this.decode(i);
          if (this.fetched >= this.count) this.settle.splice(0).forEach(r => r());
        })
        .catch(err => { if (!this.disposed) console.warn('[frames]', err); })
        .finally(() => { this.inflight--; this.pump(); });
    }
  }

  private decode(i: number) {
    const blob = this.blobs[i];
    if (!blob || this.decoding.has(i) || this.bitmaps.has(i)) return;
    this.decoding.add(i);
    createImageBitmap(blob)
      .then(bm => {
        if (this.disposed) { bm.close(); return; }
        this.bitmaps.set(i, bm);
        while (this.bitmaps.size > this.capacity) {
          const oldest = this.bitmaps.keys().next().value as number;
          this.bitmaps.get(oldest)!.close();
          this.bitmaps.delete(oldest);
        }
        this.version++;
      })
      .catch(err => console.warn('[frames] decode', err))
      .finally(() => this.decoding.delete(i));
  }
}

/** 0, last, then every 8th, 4th, 2nd, rest. */
function strideOrder(n: number): number[] {
  const seen = new Set<number>(), out: number[] = [];
  const add = (i: number) => { if (i >= 0 && i < n && !seen.has(i)) { seen.add(i); out.push(i); } };
  add(0); add(n - 1);
  for (const s of [8, 4, 2, 1]) for (let i = 0; i < n; i += s) add(i);
  return out;
}
