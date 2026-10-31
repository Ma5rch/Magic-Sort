import { DEFAULT_PALETTE, hexToRgb, rgbToHex, type ColorDef } from '../solver/palette';
import { colorDistance, rgbToLab, saturation, type Lab } from './colorSpace';
import type { BallCandidate, RGBAImage } from './types';

/** Medianfarbe der inneren Kugelfläche ohne Glanzlichter und tiefe Schatten (mehrere Pixel, nie nur einer). */
export function sampleBallColor(img: RGBAImage, ball: BallCandidate): [number, number, number] {
  const { width: W, height: H, data } = img;
  const rad = Math.max(2, ball.r * 0.55);
  const x0 = Math.max(0, Math.floor(ball.cx - rad));
  const x1 = Math.min(W - 1, Math.ceil(ball.cx + rad));
  const y0 = Math.max(0, Math.floor(ball.cy - rad));
  const y1 = Math.min(H - 1, Math.ceil(ball.cy + rad));
  const good: number[][] = [[], [], []];
  const all: number[][] = [[], [], []];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - ball.cx;
      const dy = y - ball.cy;
      if (dx * dx + dy * dy > rad * rad) continue;
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      all[0].push(r);
      all[1].push(g);
      all[2].push(b);
      const v = Math.max(r, g, b);
      const highlight = v > 235 && saturation(r, g, b) < 0.35;
      if (highlight || v < 55) continue;
      good[0].push(r);
      good[1].push(g);
      good[2].push(b);
    }
  }
  const src = good[0].length >= 6 ? good : all;
  const med = (a: number[]) => {
    const s = [...a].sort((p, q) => p - q);
    return s.length ? s[s.length >> 1] : 0;
  };
  return [med(src[0]), med(src[1]), med(src[2])];
}

export const MERGE_THRESHOLD = 15;

export interface ColorClustering {
  /** Clusterindex je Kugel. */
  assignment: number[];
  centroids: Lab[];
  centroidRgb: [number, number, number][];
  /** Je Kugel: true, wenn die Zuordnung nicht eindeutig ist. */
  uncertain: boolean[];
}

/** Agglomeratives Clustering (average linkage) im Lab-Raum. */
export function clusterColors(rgbs: [number, number, number][], threshold = MERGE_THRESHOLD): ColorClustering {
  const labs = rgbs.map((c) => rgbToLab(c[0], c[1], c[2]));
  let clusters: number[][] = labs.map((_, i) => [i]);
  const dist = (a: number[], b: number[]) => {
    let s = 0;
    for (const i of a) for (const j of b) s += colorDistance(labs[i], labs[j]);
    return s / (a.length * b.length);
  };
  for (;;) {
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = dist(clusters[i], clusters[j]);
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0 || best > threshold) break;
    clusters[bi] = clusters[bi].concat(clusters[bj]);
    clusters.splice(bj, 1);
  }
  clusters = clusters.sort((a, b) => b.length - a.length);
  const assignment = new Array<number>(labs.length).fill(0);
  const centroids: Lab[] = [];
  const centroidRgb: [number, number, number][] = [];
  clusters.forEach((members, ci) => {
    let l = 0, a = 0, b = 0, r = 0, g = 0, bl = 0;
    for (const m of members) {
      assignment[m] = ci;
      l += labs[m][0]; a += labs[m][1]; b += labs[m][2];
      r += rgbs[m][0]; g += rgbs[m][1]; bl += rgbs[m][2];
    }
    const n = members.length;
    centroids.push([l / n, a / n, b / n]);
    centroidRgb.push([r / n, g / n, bl / n]);
  });
  const uncertain = labs.map((lab, i) => {
    const own = colorDistance(lab, centroids[assignment[i]]);
    let other = Infinity;
    centroids.forEach((c, ci) => {
      if (ci !== assignment[i]) other = Math.min(other, colorDistance(lab, c));
    });
    return own > 0.85 * threshold || (other < Infinity && own / other > 0.55);
  });
  return { assignment, centroids, centroidRgb, uncertain };
}

const DEFAULT_LABS: Lab[] = DEFAULT_PALETTE.map((c) => {
  const [r, g, b] = hexToRgb(c.hex);
  return rgbToLab(r, g, b);
});

/**
 * Ordnet jedem Cluster eine Kennung/einen Namen zu (nächstliegende Standardfarbe, jede nur einmal).
 * Als Anzeigefarbe dient die gemessene Farbe, damit die Oberfläche dem Screenshot ähnelt.
 */
export function assignPalette(clustering: ColorClustering): { palette: ColorDef[]; clusterToColor: number[] } {
  const pairs: { c: number; p: number; d: number }[] = [];
  clustering.centroids.forEach((lab, c) => {
    DEFAULT_LABS.forEach((pl, p) => pairs.push({ c, p, d: colorDistance(lab, pl) }));
  });
  pairs.sort((a, b) => a.d - b.d);
  const clusterToColor = new Array<number>(clustering.centroids.length).fill(-1);
  const usedPalette = new Set<number>();
  for (const { c, p } of pairs) {
    if (clusterToColor[c] !== -1 || usedPalette.has(p)) continue;
    clusterToColor[c] = p;
    usedPalette.add(p);
  }
  const palette: ColorDef[] = DEFAULT_PALETTE.map((c) => ({ ...c }));
  let nextId = DEFAULT_PALETTE.length;
  clusterToColor.forEach((id, c) => {
    const rgb = clustering.centroidRgb[c];
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    if (id === -1) {
      clusterToColor[c] = nextId;
      palette.push({ id: nextId, name: `Farbe ${nextId + 1}`, hex });
      nextId++;
    } else {
      palette[id] = { ...palette[id], hex };
    }
  });
  return { palette, clusterToColor };
}
