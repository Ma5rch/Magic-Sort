import { createPuzzle } from '../solver/puzzleUtils';
import type { PuzzleState } from '../solver/types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zufälliges Level: `colors` volle Röhrchen (Kapazität `cap`) gemischt + `empty` leere Röhrchen. */
export function randomLevel(colors: number, cap: number, empty: number, seed: number): PuzzleState {
  const rng = mulberry32(seed);
  const balls: number[] = [];
  for (let c = 0; c < colors; c++) for (let i = 0; i < cap; i++) balls.push(c);
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  const tubes: number[][] = [];
  for (let t = 0; t < colors; t++) tubes.push(balls.slice(t * cap, (t + 1) * cap));
  for (let e = 0; e < empty; e++) tubes.push([]);
  return createPuzzle(tubes, cap);
}

// ---------------------------------------------------------------------------
// Synthetischer Screenshot für die Bilderkennungs-Tests
// ---------------------------------------------------------------------------
import type { RGBAImage } from '../vision/types';

export interface RenderOptions {
  width: number;
  height: number;
  /** Inhalt je Röhrchen (Farbindex, unten → oben), Reihen-weise von links nach rechts. */
  tubes: number[][];
  colors: [number, number, number][];
  cols: number;
  x0: number;
  pitch: number;
  d: number;
  rowBottoms: number[];
  capacity: number;
  bgTop: [number, number, number];
  bgBottom: [number, number, number];
  /** Zeichnet ein gesättigtes Rechteck als „Button“ (Störobjekt). */
  distractor?: { x: number; y: number; w: number; h: number; color: [number, number, number] };
}

export function renderBoard(o: RenderOptions): RGBAImage {
  const { width: W, height: H } = o;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = o.bgTop[c] + (o.bgBottom[c] - o.bgTop[c]) * t;
      data[i + 3] = 255;
    }
  }
  const put = (x: number, y: number, rgb: number[], alpha = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (Math.round(y) * W + Math.round(x)) * 4;
    for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - alpha) + rgb[c] * alpha;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, rgb: number[], alpha: number) => {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) put(x, y, rgb, alpha);
  };
  o.tubes.forEach((balls, i) => {
    const row = Math.floor(i / o.cols);
    const col = i % o.cols;
    const x = o.x0 + col * o.pitch;
    const bottom = o.rowBottoms[row];
    const top = bottom - o.capacity * o.d;
    // Glasröhrchen: helle, kaum gesättigte Fläche mit Rand
    rect(x - o.d / 2 - 7, top - 8, x + o.d / 2 + 7, bottom + 8, [235, 240, 255], 0.16);
    rect(x - o.d / 2 - 7, top - 8, x - o.d / 2 - 5, bottom + 8, [240, 245, 255], 0.5);
    rect(x + o.d / 2 + 5, top - 8, x + o.d / 2 + 7, bottom + 8, [240, 245, 255], 0.5);
    rect(x - o.d / 2 - 7, bottom + 6, x + o.d / 2 + 7, bottom + 8, [240, 245, 255], 0.5);
    balls.forEach((ci, j) => {
      const cy = bottom - o.d / 2 - j * o.d;
      const r = o.d / 2 - 1;
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          if (xx * xx + yy * yy > r * r) continue;
          const shade = 1.08 - 0.3 * ((xx + yy + 2 * r) / (4 * r)); // oben links heller
          const rgb = o.colors[ci].map((v) => Math.min(255, v * shade));
          put(x + xx, cy + yy, rgb, 1);
        }
      }
      // Glanzlicht
      const hr = r * 0.22;
      for (let yy = -hr; yy <= hr; yy++) {
        for (let xx = -hr; xx <= hr; xx++) {
          if (xx * xx + yy * yy <= hr * hr) put(x - r * 0.4 + xx, cy - r * 0.4 + yy, [255, 255, 255], 0.92);
        }
      }
    });
  });
  if (o.distractor) {
    const d = o.distractor;
    rect(d.x, d.y, d.x + d.w, d.y + d.h, d.color, 1);
  }
  return { width: W, height: H, data };
}

export const GAME_COLORS: [number, number, number][] = [
  [229, 57, 53], // 0 Rot
  [30, 99, 233], // 1 Blau
  [46, 184, 75], // 2 Grün
  [251, 192, 45], // 3 Gelb
  [25, 195, 195], // 4 Türkis
  [255, 95, 168], // 5 Pink
  [255, 143, 31], // 6 Orange
  [142, 68, 214], // 7 Lila
];

/** Vergleicht zwei Zustände bis auf Umbenennung der Farben (bijektiv). */
export function sameUpToRelabeling(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  const ab = new Map<number, number>();
  const ba = new Map<number, number>();
  for (let t = 0; t < a.length; t++) {
    if (a[t].length !== b[t].length) return false;
    for (let i = 0; i < a[t].length; i++) {
      const x = a[t][i];
      const y = b[t][i];
      if ((ab.has(x) && ab.get(x) !== y) || (ba.has(y) && ba.get(y) !== x)) return false;
      ab.set(x, y);
      ba.set(y, x);
    }
  }
  return true;
}
