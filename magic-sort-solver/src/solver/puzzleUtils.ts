import type { ColorId, PuzzleState, Tube } from './types';

export function createPuzzle(tubeBalls: ColorId[][], capacity: number): PuzzleState {
  return {
    capacity,
    tubes: tubeBalls.map((balls, id) => ({ id, balls: [...balls], capacity })),
  };
}

export function cloneTube(t: Tube): Tube {
  const c: Tube = { id: t.id, balls: [...t.balls], capacity: t.capacity };
  if (t.uncertain) c.uncertain = [...t.uncertain];
  return c;
}

export function cloneState(s: PuzzleState): PuzzleState {
  return { capacity: s.capacity, tubes: s.tubes.map(cloneTube) };
}

/** Setzt id = Index. */
export function renumberTubes(tubes: Tube[]): Tube[] {
  return tubes.map((t, i) => ({ ...t, id: i }));
}

export function colorCounts(s: PuzzleState): Map<ColorId, number> {
  const m = new Map<ColorId, number>();
  for (const t of s.tubes) for (const b of t.balls) m.set(b, (m.get(b) ?? 0) + 1);
  return m;
}

export function totalBalls(s: PuzzleState): number {
  return s.tubes.reduce((n, t) => n + t.balls.length, 0);
}

/** Anzeige-Nummer (ab 1) zu interner Nummer (ab 0). */
export function tubeLabel(index: number): number {
  return index + 1;
}

export function countUncertain(s: PuzzleState): number {
  let n = 0;
  for (const t of s.tubes) if (t.uncertain) for (const u of t.uncertain) if (u) n++;
  return n;
}
