import type { GoalMode, PuzzleState } from './types';

export function isSolved(state: PuzzleState, goal: GoalMode = 'complete'): boolean {
  const seen = new Set<number>();
  for (const t of state.tubes) {
    if (t.balls.length === 0) continue;
    const first = t.balls[0];
    for (const b of t.balls) if (b !== first) return false;
    if (goal === 'complete') {
      if (seen.has(first)) return false;
      seen.add(first);
    }
  }
  return true;
}
