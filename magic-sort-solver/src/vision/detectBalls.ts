import { saturation } from './colorSpace';
import type { BallCandidate, RGBAImage, VisionParams } from './types';

interface Component {
  area: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Hintergrundfarbe je Bildzeile aus den Randspalten (dort liegen keine Kugeln). */
export function estimateRowBackground(img: RGBAImage): Uint8Array {
  const { width: W, height: H, data } = img;
  const m = Math.max(2, Math.round(W * 0.02));
  const out = new Uint8Array(H * 3);
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = 0; y < H; y++) {
    rs.length = gs.length = bs.length = 0;
    for (let k = 0; k < m; k++) {
      for (const x of [k, W - 1 - k]) {
        const i = (y * W + x) * 4;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
    out[y * 3] = median(rs);
    out[y * 3 + 1] = median(gs);
    out[y * 3 + 2] = median(bs);
  }
  return out;
}

/** Vordergrundmaske: gesättigte, helle Pixel, die sich deutlich vom Zeilenhintergrund abheben. */
export function buildForegroundMask(img: RGBAImage, params: VisionParams): Uint8Array {
  const { width: W, height: H, data } = img;
  const bg = estimateRowBackground(img);
  const mask = new Uint8Array(W * H);
  const minV = params.minValue * 255;
  const minD2 = params.minBgDistance * params.minBgDistance;
  for (let y = 0; y < H; y++) {
    const br = bg[y * 3];
    const bgc = bg[y * 3 + 1];
    const bb = bg[y * 3 + 2];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.max(r, g, b) < minV) continue;
      if (saturation(r, g, b) < params.minSaturation) continue;
      const dr = r - br;
      const dg = g - bgc;
      const db = b - bb;
      if (dr * dr + dg * dg + db * db < minD2) continue;
      mask[y * W + x] = 1;
    }
  }
  fillHoles(mask, W, H);
  return mask;
}

/** Füllt vom Rand aus nicht erreichbare Lücken (Glanzlichter in Kugeln). */
function fillHoles(mask: Uint8Array, W: number, H: number): void {
  const reach = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const seed = (x: number, y: number) => {
    const p = y * W + x;
    if (mask[p] === 0 && reach[p] === 0) {
      reach[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x, 0);
    seed(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    seed(0, y);
    seed(W - 1, y);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) seed(x - 1, y);
    if (x < W - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < H - 1) seed(x, y + 1);
  }
  for (let p = 0; p < W * H; p++) if (mask[p] === 0 && reach[p] === 0) mask[p] = 1;
}

function findComponents(mask: Uint8Array, W: number, H: number, minSide: number): Component[] {
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const comps: Component[] = [];
  for (let start = 0; start < W * H; start++) {
    if (mask[start] === 0 || seen[start] === 1) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    const c: Component = { area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W;
      const y = (p - x) / W;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      const push = (q: number) => {
        if (mask[q] === 1 && seen[q] === 0) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      };
      if (x > 0) push(p - 1);
      if (x < W - 1) push(p + 1);
      if (y > 0) push(p - W);
      if (y < H - 1) push(p + W);
    }
    if (c.x1 - c.x0 + 1 >= minSide && c.y1 - c.y0 + 1 >= minSide) comps.push(c);
  }
  return comps;
}

/** Häufigste Breite (±12 %) der Kandidaten = Kugeldurchmesser. */
function pickDiameter(widths: number[]): number {
  let best: number[] = [];
  for (const w of widths) {
    const near = widths.filter((v) => Math.abs(v - w) <= 0.12 * w);
    if (near.length > best.length) best = near;
  }
  return median(best);
}

export interface BallDetection {
  balls: BallCandidate[];
  diameter: number;
  rejectedComponents: number;
}

/**
 * Findet Kugeln als Vordergrund-Komponenten. Senkrecht gestapelte, sich berührende Kugeln bilden
 * eine Komponente der Breite d und Höhe k·d und werden in k gleich große Kugeln zerlegt.
 */
export function detectBalls(img: RGBAImage, params: VisionParams): BallDetection | null {
  const { width: W, height: H } = img;
  const mask = buildForegroundMask(img, params);
  const minSide = Math.max(6, Math.round(W * 0.025));
  const comps = findComponents(mask, W, H, minSide).filter((c) => c.x1 - c.x0 + 1 <= W * 0.35);
  if (comps.length === 0) return null;
  const d = pickDiameter(comps.map((c) => c.x1 - c.x0 + 1));
  const balls: BallCandidate[] = [];
  let rejected = 0;
  for (const c of comps) {
    const w = c.x1 - c.x0 + 1;
    const h = c.y1 - c.y0 + 1;
    const k = Math.round(h / d);
    const fill = c.area / (w * h);
    if (Math.abs(w - d) > 0.22 * d || k < 1 || k > 32 || Math.abs(h / d - k) > 0.35 || fill < 0.5 || fill > 0.92) {
      rejected++;
      continue;
    }
    const cx = (c.x0 + c.x1) / 2;
    for (let i = 0; i < k; i++) {
      const cy = k === 1 ? (c.y0 + c.y1) / 2 : c.y0 + d / 2 + (i * (h - d)) / (k - 1);
      balls.push({ cx, cy, r: d / 2 });
    }
  }
  if (balls.length === 0) return null;
  return { balls, diameter: d, rejectedComponents: rejected };
}
