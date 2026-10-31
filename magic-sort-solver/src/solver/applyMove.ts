import { tryMove } from './getLegalMoves';
import type { Move, MoveMode, PuzzleState, Tube } from './types';

/** Wendet einen Zug an (ohne den Eingabezustand zu verändern). Wirft bei illegalen Zügen. */
export function applyMove(state: PuzzleState, move: Move, mode: MoveMode): PuzzleState {
  const legal = tryMove(state, move.from, move.to, mode);
  if (!legal) {
    throw new Error(`Illegaler Zug: Röhrchen ${move.from + 1} → ${move.to + 1}`);
  }
  if (legal.count !== move.count || legal.color !== move.color) {
    throw new Error(
      `Zug passt nicht zum Modus: erwartet ${legal.count}× Farbe ${legal.color}, erhalten ${move.count}× Farbe ${move.color}`,
    );
  }
  const tubes: Tube[] = state.tubes.map((t, i) => {
    if (i === move.from) {
      return { id: t.id, capacity: t.capacity, balls: t.balls.slice(0, t.balls.length - move.count) };
    }
    if (i === move.to) {
      return { id: t.id, capacity: t.capacity, balls: [...t.balls, ...new Array<number>(move.count).fill(move.color)] };
    }
    return t;
  });
  return { capacity: state.capacity, tubes };
}
