import { gsap } from 'gsap';
import type { FrameSequence, SeqMeta } from './renders/frames';
import type { Tier } from './renders/manifest';

// One fixed canvas for the whole site. Pages tell it which sequence/frame to show and how
// to mask it; it repaints only when something changed, from the shared GSAP ticker.

type Intent = { type: 'dive'; slug: string } | { type: 'return-city' } | null;
/** Something drawn live over each frame (the city's cars, people and lights). */
export type LiveLayer = { ready: boolean; render(ctx: CanvasRenderingContext2D, meta: SeqMeta, frame: number, now: number, bm: ImageBitmap): void };

class Stage {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private root: HTMLElement | null = null;
  private tintEl: HTMLElement | null = null;
  private seq: FrameSequence | null = null;
  private frame = 0;
  private drawn: { seq: FrameSequence | null; frame: number; version: number; bm: ImageBitmap | null } = { seq: null, frame: -1, version: -1, bm: null };
  private dims = { w: 1920, h: 1080 };
  private hidden = false;
  private zoom = 1;
  private live: LiveLayer | null = null;
  private ticks = 0;
  private coarse = false;
  /** Set before a navigation so the next page knows how it was reached. */
  intent: Intent = null;

  attach(root: HTMLElement, canvas: HTMLCanvasElement, tint: HTMLElement) {
    this.root = root;
    this.canvas = canvas;
    this.tintEl = tint;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    gsap.ticker.add(this.tick);
    return () => { gsap.ticker.remove(this.tick); this.root = this.canvas = this.ctx = this.tintEl = null; };
  }

  setSequence(seq: FrameSequence, tier: Tier, dims: { w: number; h: number }, frame = 0) {
    this.seq = seq;
    this.dims = dims;
    this.frame = frame;
    if (this.canvas && (this.canvas.width !== dims.w || this.canvas.height !== dims.h)) {
      this.canvas.width = dims.w;
      this.canvas.height = dims.h;
      this.drawn.seq = null;
    }
    this.root?.setAttribute('data-tier', tier);
  }

  get sequence() { return this.seq; }
  get frameCount() { return this.seq?.count ?? 0; }

  setFrame(f: number) {
    const n = this.frameCount;
    if (!n) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(f)));
    if (i !== this.frame) { this.seq!.prefetch(i, i - this.frame); this.frame = i; }
  }

  /** Circular window in CSS px (centred on the viewport unless x/y are given); null removes the mask. */
  setClip(r: number | null, x?: number, y?: number) {
    if (!this.root) return;
    const at = x === undefined || y === undefined ? '50% 50%' : `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    this.root.style.clipPath = r === null ? 'none' : `circle(${r.toFixed(1)}px at ${at})`;
  }

  setTint(o: number) {
    if (this.tintEl) this.tintEl.style.opacity = String(o);
  }

  setZoom(z: number) {
    this.zoom = z;
    if (this.canvas) this.canvas.style.transform = z === 1 ? '' : `scale(${z})`;
  }
  get currentZoom() { return this.zoom; }

  /** Hide when fully covered by page content: no painting, no compositing. */
  setHidden(h: boolean) {
    if (h === this.hidden) return;
    this.hidden = h;
    if (this.root) this.root.style.visibility = h ? 'hidden' : '';
  }

  /** Map a normalised point of the frame to viewport px (canvas uses object-fit: cover). */
  toScreen([nx, ny]: [number, number]): [number, number] {
    const vw = window.innerWidth, vh = window.innerHeight, { w, h } = this.dims;
    const s = Math.max(vw / w, vh / h) * this.zoom;
    return [vw / 2 + (nx - 0.5) * w * s, vh / 2 + (ny - 0.5) * h * s];
  }

  /** px per design unit of the current frame on screen. */
  get screenScale() {
    const { w, h } = this.dims;
    return Math.max(window.innerWidth / w, window.innerHeight / h);
  }

  setLive(layer: LiveLayer | null) { this.live = layer; }

  private tick = () => {
    if (this.hidden || !this.ctx || !this.seq) return;
    const seq = this.seq, d = this.drawn;
    const live = this.live?.ready && seq.meta ? this.live : null;
    if (live) {
      // the city is alive: repaint every tick (every other one on phones, ~30 fps)
      if (this.coarse && this.ticks++ % 2) return;
    } else if (d.seq === seq && d.frame === this.frame && d.version === seq.version) return;
    const got = seq.get(this.frame);
    d.seq = seq; d.frame = this.frame; d.version = seq.version;
    if (!got || (!live && got.bm === d.bm)) return;
    this.ctx.drawImage(got.bm, 0, 0, this.dims.w, this.dims.h);
    if (live) live.render(this.ctx, seq.meta!, got.i, performance.now() / 1000, got.bm);
    if (!d.bm && this.canvas) this.canvas.style.opacity = '1'; // an opaque canvas is black until its first frame
    d.bm = got.bm;
  };
}

export const stage = new Stage();
