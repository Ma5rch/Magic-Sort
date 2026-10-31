import type { GoalMode, Move, MoveMode, PuzzleState, Rules } from './types';

/**
 * Unabhängige Verifizierung: bewusst OHNE getLegalMoves/applyMove/isSolved implementiert,
 * damit ein Fehler im Solver oder in den Spielfunktionen hier auffällt.
 */
export interface VerificationResult {
  ok: boolean;
  error?: string;
  /** 1-basierter Index des fehlerhaften Zuges. */
  failedStep?: number;
  /** states[0] = Ausgangszustand, states[i] = Zustand nach Zug i (nur bei ok vollständig). */
  states: PuzzleState[];
}

function snapshot(initial: PuzzleState, tubes: number[][]): PuzzleState {
  return {
    capacity: initial.capacity,
    tubes: tubes.map((balls, id) => ({ id, balls: [...balls], capacity: initial.tubes[id].capacity })),
  };
}

function goalReached(tubes: number[][], goal: GoalMode): boolean {
  const usedColors = new Set<number>();
  for (const balls of tubes) {
    if (balls.length === 0) continue;
    for (let i = 1; i < balls.length; i++) if (balls[i] !== balls[0]) return false;
    if (goal === 'complete') {
      if (usedColors.has(balls[0])) return false;
      usedColors.add(balls[0]);
    }
  }
  return true;
}

function tally(tubes: number[][]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of tubes) for (const b of t) m.set(b, (m.get(b) ?? 0) + 1);
  return m;
}

export function verifySolution(initial: PuzzleState, moves: readonly Move[], rules: Rules): VerificationResult {
  const mode: MoveMode = rules.mode;
  const tubes = initial.tubes.map((t) => [...t.balls]);
  const caps = initial.tubes.map((t) => t.capacity);
  const states: PuzzleState[] = [snapshot(initial, tubes)];
  const startCounts = tally(tubes);
  const startTotal = tubes.reduce((n, t) => n + t.length, 0);

  for (let i = 0; i < tubes.length; i++) {
    if (tubes[i].length > caps[i]) {
      return { ok: false, error: `Ausgangszustand: Röhrchen ${i + 1} ist überfüllt.`, failedStep: 0, states };
    }
  }

  for (let step = 0; step < moves.length; step++) {
    const m = moves[step];
    const fail = (msg: string): VerificationResult => ({ ok: false, error: `Zug ${step + 1}: ${msg}`, failedStep: step + 1, states });
    if (!m || !Number.isInteger(m.from) || !Number.isInteger(m.to) || !Number.isInteger(m.count) || !Number.isInteger(m.color)) {
      return fail('Zug ist unvollständig oder ungültig.');
    }
    if (m.from < 0 || m.from >= tubes.length || m.to < 0 || m.to >= tubes.length) return fail('Quelle oder Ziel existiert nicht.');
    if (m.from === m.to) return fail('Quelle und Ziel sind identisch.');
    const src = tubes[m.from];
    const dst = tubes[m.to];
    if (src.length === 0) return fail(`Röhrchen ${m.from + 1} ist leer.`);
    if (m.count < 1 || m.count > src.length) return fail('Die Anzahl der Kugeln passt nicht zum Quellröhrchen.');
    const topColor = src[src.length - 1];
    if (m.color !== topColor) return fail(`Oben in Röhrchen ${m.from + 1} liegt Farbe ${topColor}, nicht ${m.color}.`);
    for (let k = 0; k < m.count; k++) {
      if (src[src.length - 1 - k] !== m.color) return fail('Die bewegten Kugeln sind nicht alle gleichfarbig.');
    }
    const free = caps[m.to] - dst.length;
    if (m.count > free) return fail(`Röhrchen ${m.to + 1} hat nicht genug freien Platz.`);
    if (dst.length > 0 && dst[dst.length - 1] !== m.color) return fail(`Röhrchen ${m.to + 1} hat oben eine andere Farbe.`);

    let run = 0;
    while (run < src.length && src[src.length - 1 - run] === m.color) run++;
    const expected = mode === 'single' ? 1 : Math.min(run, free);
    if (m.count !== expected) {
      return fail(`Der Zugmodus verlangt ${expected} Kugel(n), der Zug bewegt ${m.count}.`);
    }

    const before = src.length + dst.length;
    const moved = src.splice(src.length - m.count, m.count);
    for (const b of moved) dst.push(b);
    if (src.length + dst.length !== before) return fail('Kugelanzahl hat sich verändert.');
    states.push(snapshot(initial, tubes));
  }

  const endTotal = tubes.reduce((n, t) => n + t.length, 0);
  if (endTotal !== startTotal) return { ok: false, error: 'Es gingen Kugeln verloren oder entstanden neu.', states };
  const endCounts = tally(tubes);
  for (const [c, n] of startCounts) {
    if (endCounts.get(c) !== n) return { ok: false, error: `Anzahl der Kugeln von Farbe ${c} hat sich verändert.`, states };
  }
  if (!goalReached(tubes, rules.goal)) {
    return { ok: false, error: 'Der Zielzustand wurde nicht erreicht.', failedStep: moves.length, states };
  }
  return { ok: true, states };
}
