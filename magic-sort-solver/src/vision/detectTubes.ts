import type { BallCandidate, DetectionMessage } from './types';

export interface RawTube {
  x: number;
  bottomY: number;
  /** Kugeln von unten nach oben. */
  balls: BallCandidate[];
  inferred: boolean;
}

export interface TubeGrouping {
  /** Reihen von oben nach unten, Röhrchen je Reihe von links nach rechts. */
  rows: RawTube[][];
  messages: DetectionMessage[];
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Ordnet Kugeln zu Röhrchen (Spalten + Lücken), Röhrchen zu Reihen (gleiche Bodenlinie) und ergänzt
 * leere Röhrchen: Lücken im Raster sowie symmetrisch zur Bildmitte fehlende Randröhrchen.
 */
export function groupTubes(balls: BallCandidate[], d: number, imageWidth: number): TubeGrouping {
  const messages: DetectionMessage[] = [];

  // 1) Spalten
  const sorted = [...balls].sort((a, b) => a.cx - b.cx);
  const columns: BallCandidate[][] = [];
  for (const b of sorted) {
    const last = columns[columns.length - 1];
    if (last && Math.abs(b.cx - mean(last.map((q) => q.cx))) <= 0.5 * d) last.push(b);
    else columns.push([b]);
  }

  // 2) Röhrchen = zusammenhängende Kugelketten innerhalb einer Spalte
  const tubes: RawTube[] = [];
  for (const col of columns) {
    const byY = [...col].sort((a, b) => a.cy - b.cy);
    let chain: BallCandidate[] = [byY[0]];
    const flush = () => {
      const bottomUp = [...chain].sort((a, b) => b.cy - a.cy);
      tubes.push({ x: mean(chain.map((q) => q.cx)), bottomY: bottomUp[0].cy, balls: bottomUp, inferred: false });
    };
    for (let i = 1; i < byY.length; i++) {
      if (byY[i].cy - byY[i - 1].cy > 1.5 * d) {
        flush();
        chain = [byY[i]];
      } else chain.push(byY[i]);
    }
    flush();
  }

  // 3) Reihen über die Bodenlinie
  const byBottom = [...tubes].sort((a, b) => a.bottomY - b.bottomY);
  const rows: RawTube[][] = [];
  for (const t of byBottom) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(t.bottomY - mean(last.map((q) => q.bottomY))) <= 0.9 * d) last.push(t);
    else rows.push([t]);
  }
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));

  // 4) Rasterabstand
  const diffs: number[] = [];
  for (const r of rows) for (let i = 1; i < r.length; i++) diffs.push(r[i].x - r[i - 1].x);
  diffs.sort((a, b) => a - b);
  let pitch = 0;
  if (diffs.length > 0 && diffs[0] >= d) {
    pitch = median(diffs.filter((v) => v <= diffs[0] * 1.3));
  }

  if (pitch > 0) {
    let inferredCount = 0;
    let irregular = false;
    for (const r of rows) {
      const rowBottom = mean(r.map((t) => t.bottomY));
      // Lücken im Raster
      const filled: RawTube[] = [r[0]];
      for (let i = 1; i < r.length; i++) {
        const gap = r[i].x - r[i - 1].x;
        const m = Math.round(gap / pitch);
        if (m > 1 && Math.abs(gap - m * pitch) <= 0.25 * pitch) {
          for (let j = 1; j < m; j++) {
            filled.push({ x: r[i - 1].x + (j * gap) / m, bottomY: rowBottom, balls: [], inferred: true });
            inferredCount++;
          }
        } else if (Math.abs(gap - m * pitch) > 0.25 * pitch) irregular = true;
        filled.push(r[i]);
      }
      // Randröhrchen: Reihe wird als zur Bildmitte zentriert angenommen
      if (filled.length >= 2) {
        const first = filled[0].x;
        const last = filled[filled.length - 1].x;
        const n = (imageWidth - first - last) / pitch;
        const k = Math.round(n);
        if (k !== 0 && Math.abs(n - k) <= 0.3 && Math.abs(k) <= 2) {
          const add = Math.abs(k);
          for (let j = 1; j <= add; j++) {
            const x = k > 0 ? last + j * pitch : first - j * pitch;
            if (x > pitch * 0.4 && x < imageWidth - pitch * 0.4) {
              const t: RawTube = { x, bottomY: rowBottom, balls: [], inferred: true };
              if (k > 0) filled.push(t);
              else filled.unshift(t);
              inferredCount++;
            }
          }
        }
      }
      r.length = 0;
      r.push(...filled);
    }
    if (inferredCount > 0) {
      messages.push({
        level: 'warn',
        text: `${inferredCount} leere(s) Röhrchen wurden aus dem Raster abgeleitet. Bitte prüfen, ob die Anzahl stimmt.`,
      });
    }
    if (irregular) {
      messages.push({ level: 'warn', text: 'Die Röhrchenabstände sind unregelmäßig. Möglicherweise fehlen Röhrchen.' });
    }
  } else if (rows.some((r) => r.length > 1)) {
    messages.push({ level: 'warn', text: 'Der Röhrchenabstand konnte nicht bestimmt werden. Leere Röhrchen bitte manuell ergänzen.' });
  } else {
    messages.push({ level: 'warn', text: 'Leere Röhrchen lassen sich hier nicht sicher erkennen. Bitte manuell ergänzen.' });
  }

  return { rows, messages };
}
