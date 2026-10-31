import { colorName, type ColorDef } from '../solver/palette';
import type { Move, PuzzleState } from '../solver/types';

export function clampStep(step: number, total: number): number {
  return Math.max(0, Math.min(total, Math.floor(step)));
}

/** Schritt 0 = Ausgangszustand, Schritt i = Zustand nach Zug i. */
export function stateAt(states: readonly PuzzleState[], step: number): PuzzleState {
  return states[clampStep(step, states.length - 1)];
}

export function describeMove(move: Move, palette: ColorDef[]): { route: string; color: string; count: number } {
  return {
    route: `Von Röhrchen ${move.from + 1} zu Röhrchen ${move.to + 1}`,
    color: colorName(palette, move.color),
    count: move.count,
  };
}

/** Kompakte, kopierbare Zugliste (eine Zeile pro Zug). */
export function movesToText(moves: readonly Move[], palette: ColorDef[]): string {
  return moves
    .map((m, i) => `${i + 1}. ${m.from + 1} → ${m.to + 1} (${colorName(palette, m.color)}${m.count > 1 ? ` ×${m.count}` : ''})`)
    .join('\n');
}
