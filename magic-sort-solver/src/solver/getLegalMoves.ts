import type { ColorId, Move, MoveMode, PuzzleState } from './types';

/** Länge des zusammenhängenden gleichfarbigen Blocks am oberen Ende. */
export function topRunLength(balls: readonly ColorId[]): number {
  if (balls.length === 0) return 0;
  const c = balls[balls.length - 1];
  let n = 1;
  while (n < balls.length && balls[balls.length - 1 - n] === c) n++;
  return n;
}

/** Liefert den (eindeutig bestimmten) Zug von `from` nach `to` oder null, wenn er illegal ist. */
export function tryMove(state: PuzzleState, from: number, to: number, mode: MoveMode): Move | null {
  const src = state.tubes[from];
  const dst = state.tubes[to];
  if (!src || !dst || from === to) return null;
  if (src.balls.length === 0) return null;
  const free = dst.capacity - dst.balls.length;
  if (free <= 0) return null;
  const color = src.balls[src.balls.length - 1];
  if (dst.balls.length > 0 && dst.balls[dst.balls.length - 1] !== color) return null;
  const count = mode === 'single' ? 1 : Math.min(topRunLength(src.balls), free);
  return { from, to, color, count };
}

export function getLegalMoves(state: PuzzleState, mode: MoveMode): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < state.tubes.length; from++) {
    for (let to = 0; to < state.tubes.length; to++) {
      const m = tryMove(state, from, to, mode);
      if (m) moves.push(m);
    }
  }
  return moves;
}
