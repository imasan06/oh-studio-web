// Layout for the "window" hero: the O of OH is the circular window into the city,
// H sits beside it (stacked below it on portrait screens), ESTUDIO runs vertically on the left,
// spaced wide like the logotype.
// Everything is sized from the real glyph metrics of the loaded font, so the O ring matches
// the H's cap height and stem weight.

export type WindowLayout = {
  ox: number; oy: number;   // O centre (also the stage clip centre and the fly-through origin)
  R: number; t: number;     // O outer radius and ring weight
  rc: number;               // clip radius at rest (middle of the ring, hidden under the stroke)
  rMax: number;             // clip radius that covers the whole viewport
  h: { x: number; y: number; size: number };
  s: { x: number; y: number; size: number };
};

const O_HEIGHT = 1.03; // a round O overshoots the cap height slightly
const O_GAP = 0.12;    // space between O and H, in cap heights
const O_WEIGHT = 0.2;  // ring weight ≈ bold grotesk stem, in cap heights

let ctx: CanvasRenderingContext2D | null = null;
function ink(text: string, font: string, spacingEm: number) {
  ctx ??= document.createElement('canvas').getContext('2d');
  const c = ctx as (CanvasRenderingContext2D & { letterSpacing?: string }) | null;
  if (!c) return { left: 0, right: 0.72, ascent: 0.72 };
  c.font = `700 100px ${font}`;
  if ('letterSpacing' in c) c.letterSpacing = `${spacingEm * 100}px`;
  const m = c.measureText(text);
  return { left: m.actualBoundingBoxLeft / 100, right: m.actualBoundingBoxRight / 100, ascent: m.actualBoundingBoxAscent / 100 };
}

/** The word on the left edge and its tracking (the logo's ESTUDIO: geometric sans, wide spacing). */
export const SIDE_WORD = 'STUDIO', SIDE_TRACKING = 0.3;

export function layoutWindowHero(font: string, vw: number, vh: number, nav: number, portrait: boolean): WindowLayout {
  const H = ink('H', font, 0), S = ink(SIDE_WORD, font, SIDE_TRACKING);
  const pad = portrait ? 16 : 48;
  const footer = portrait ? 250 : 96; // keep clear of the tagline (phones) / contact row (desktop)
  const hW = (H.left + H.right) / H.ascent; // H ink width, in cap heights

  // ESTUDIO, rotated to read bottom-to-top along the left edge, baseline facing OH
  const top = nav + pad, bottom = vh - footer;
  const sLen = S.left + S.right;
  // the band-fill term ((bottom-top)/sLen) is what guarantees no top/bottom overflow; the
  // vw term only guards against absurdly thick letters on an ultra-wide, short viewport
  const sSize = Math.min((bottom - top) / sLen, ((portrait ? 0.26 : 0.22) * vw) / S.ascent);
  const sRight = pad + sSize * S.ascent;
  const gapS = Math.max(16, 0.035 * vw);
  const availW = vw - sRight - gapS - pad;

  let cap: number, ox: number, oy: number, hx: number, hy: number, midY: number;
  if (!portrait) {
    midY = (nav + vh) / 2 - 0.03 * vh;
    // the tagline sits bottom-right from 12% up (~135px tall): OH must end above it
    const clearTagline = 2 * (vh * 0.88 - 135 - 16 - midY);
    cap = Math.min(0.36 * vh, availW / (O_HEIGHT + O_GAP + hW), clearTagline);
    const w = cap * (O_HEIGHT + O_GAP + hW);
    const cx = Math.min(vw - pad - w / 2, Math.max(sRight + gapS + w / 2, vw / 2));
    ox = cx - w / 2 + (cap * O_HEIGHT) / 2;
    oy = midY;
    hx = ox + (cap * O_HEIGHT) / 2 + cap * O_GAP;
    hy = oy + cap / 2;
  } else {
    // O above H: keeps the window big on a narrow screen
    const availH = bottom - top;
    cap = Math.min(availW / Math.max(O_HEIGHT, hW), availH / (O_HEIGHT + O_GAP + 1));
    const w = cap * Math.max(O_HEIGHT, hW), h = cap * (O_HEIGHT + O_GAP + 1);
    const cx = Math.min(vw - pad - w / 2, Math.max(sRight + gapS + w / 2, vw / 2));
    const y0 = top + (availH - h) / 2;
    midY = y0 + h / 2;
    ox = cx;
    oy = y0 + (cap * O_HEIGHT) / 2;
    hx = cx - (hW * cap) / 2;
    hy = y0 + cap * (O_HEIGHT + O_GAP + 1);
  }

  const R = (cap * O_HEIGHT) / 2, t = cap * O_WEIGHT;
  const hSize = cap / H.ascent;
  // centre ESTUDIO on the composition, kept inside its band
  const half = (sLen * sSize) / 2;
  const sMid = Math.min(bottom - half, Math.max(top + half, midY));
  const rMax = Math.max(Math.hypot(ox, oy), Math.hypot(vw - ox, oy), Math.hypot(ox, vh - oy), Math.hypot(vw - ox, vh - oy)) + 4;

  return {
    ox, oy, R, t, rc: R - t / 2, rMax,
    // text x is the pen position: ink starts `left` before it
    h: { x: hx + H.left * hSize, y: hy, size: hSize },
    // after rotate(-90): ink spans x ∈ [x - ascent, x], y ∈ [y - right, y + left]
    s: { x: sRight, y: sMid - ((S.left - S.right) * sSize) / 2, size: sSize },
  };
}
