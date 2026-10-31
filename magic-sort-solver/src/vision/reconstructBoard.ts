import type { PuzzleState, Tube } from '../solver/types';
import { assignPalette, clusterColors, sampleBallColor } from './classifyColors';
import { detectBalls } from './detectBalls';
import { groupTubes, type RawTube } from './detectTubes';
import {
  PARAM_ATTEMPTS,
  type DetectionMessage,
  type DetectionResult,
  type OverlayBall,
  type OverlayTube,
  type RGBAImage,
} from './types';
import { DEFAULT_PALETTE } from '../solver/palette';

function failure(width: number, height: number, text: string): DetectionResult {
  return {
    success: false,
    puzzle: null,
    palette: DEFAULT_PALETTE,
    overlay: { width, height, balls: [], tubes: [] },
    messages: [{ level: 'error', text }],
  };
}

/** Komplette Pipeline: Bild → Kugeln → Röhrchen → Farben → Spielzustand. Arbeitet nur lokal. */
export function analyzeImage(img: RGBAImage): DetectionResult {
  const { width: W, height: H } = img;
  if (W < 50 || H < 50) return failure(W, H, 'Das Bild ist zu klein für eine Analyse.');

  // Mehrere Schwellen probieren und den Versuch mit den meisten stimmigen Kugeln und den
  // wenigsten verworfenen Objekten wählen (getönte Röhrchen/Oberflächenelemente stören sonst).
  let chosen: ReturnType<typeof detectBalls> = null;
  let bestScore = -Infinity;
  for (const params of PARAM_ATTEMPTS) {
    const det = detectBalls(img, params);
    if (!det) continue;
    const score = det.balls.length - 1.5 * det.rejectedComponents;
    if (score > bestScore) {
      bestScore = score;
      chosen = det;
    }
    if (det.balls.length >= 4 && det.rejectedComponents === 0) break;
  }
  if (!chosen || chosen.balls.length < 2) {
    return failure(
      W,
      H,
      'Es wurden keine Kugeln erkannt. Ist das Spielfeld vollständig im Screenshot? Du kannst das Level auch manuell eingeben.',
    );
  }

  const messages: DetectionMessage[] = [];
  const d = chosen.diameter;
  const grouping = groupTubes(chosen.balls, d, W);
  messages.push(...grouping.messages);
  const rawTubes: RawTube[] = grouping.rows.flat();

  // Farben aller Kugeln messen und clustern
  const flat = rawTubes.flatMap((t, ti) => t.balls.map((b, pos) => ({ ti, pos, ball: b })));
  const rgbs = flat.map((f) => sampleBallColor(img, f.ball));
  const clustering = clusterColors(rgbs);
  const { palette, clusterToColor } = assignPalette(clustering);

  const capacity = Math.max(1, ...rawTubes.map((t) => t.balls.length));
  messages.push({
    level: 'info',
    text: `Kapazität ${capacity} wurde aus dem am höchsten gefüllten Röhrchen abgeleitet. Bitte prüfen.`,
  });
  if (clustering.centroids.length > DEFAULT_PALETTE.length) {
    messages.push({ level: 'warn', text: `Es wurden ${clustering.centroids.length} verschiedene Farben unterschieden – ungewöhnlich viele.` });
  }

  const tubes: Tube[] = rawTubes.map((_rt, id) => ({ id, balls: [], capacity }));
  const unc: boolean[][] = rawTubes.map(() => []);
  const overlayBalls: OverlayBall[] = [];
  flat.forEach((f, i) => {
    const colorId = clusterToColor[clustering.assignment[i]];
    tubes[f.ti].balls[f.pos] = colorId;
    unc[f.ti][f.pos] = clustering.uncertain[i];
    overlayBalls.push({
      x: f.ball.cx,
      y: f.ball.cy,
      r: f.ball.r,
      colorId,
      uncertain: clustering.uncertain[i],
      tube: f.ti,
      pos: f.pos,
    });
  });
  tubes.forEach((t, i) => {
    if (unc[i].some(Boolean)) t.uncertain = unc[i];
  });

  const puzzle: PuzzleState = { tubes, capacity };

  const counts = new Map<number, number>();
  tubes.forEach((t) => t.balls.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));
  if (new Set(counts.values()).size > 1) {
    messages.push({
      level: 'warn',
      text: 'Die erkannten Farben kommen unterschiedlich oft vor. Wahrscheinlich wurde eine Kugel falsch zugeordnet oder übersehen.',
    });
  }
  const uncertainCount = clustering.uncertain.filter(Boolean).length;
  if (uncertainCount > 0) {
    messages.push({ level: 'warn', text: `${uncertainCount} Kugel(n) sind farblich unsicher und orange markiert.` });
  }

  const overlayTubes: OverlayTube[] = rawTubes.map((t, index) => ({ index, x: t.x, y: t.bottomY, inferred: t.inferred }));
  return {
    success: true,
    puzzle,
    palette,
    overlay: { width: W, height: H, balls: overlayBalls, tubes: overlayTubes },
    messages,
  };
}
