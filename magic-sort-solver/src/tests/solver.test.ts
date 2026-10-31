import { describe, expect, it } from 'vitest';
import { applyMove } from '../solver/applyMove';
import { encodeState, canonicalKey } from '../solver/encodeState';
import { exampleLevel } from '../fixtures/exampleLevel';
import { getLegalMoves, tryMove } from '../solver/getLegalMoves';
import { isSolved } from '../solver/isSolved';
import { cloneState, createPuzzle, totalBalls } from '../solver/puzzleUtils';
import { solvePuzzle } from '../solver/solvePuzzle';
import type { Move, Rules } from '../solver/types';
import { verifySolution } from '../solver/verifySolution';
import { randomLevel } from './helpers';

const single: Rules = { mode: 'single', goal: 'complete' };
const block: Rules = { mode: 'block', goal: 'complete' };

describe('Zugregeln', () => {
  it('Einzelkugelmodus: genau eine Kugel pro Zug', () => {
    const p = createPuzzle([[0, 1, 1], [1], []], 4);
    const m = tryMove(p, 0, 1, 'single');
    expect(m).toEqual({ from: 0, to: 1, color: 1, count: 1 });
    const q = applyMove(p, m as Move, 'single');
    expect(q.tubes[0].balls).toEqual([0, 1]);
    expect(q.tubes[1].balls).toEqual([1, 1]);
  });

  it('Blockmodus: verschiebt den gleichfarbigen Block, soweit er passt', () => {
    const p = createPuzzle([[0, 1, 1, 1], [1, 1], []], 4);
    // Ziel hat nur 2 freie Plätze → 2 von 3 Kugeln
    expect(tryMove(p, 0, 1, 'block')).toEqual({ from: 0, to: 1, color: 1, count: 2 });
    // Ziel leer → alle 3
    expect(tryMove(p, 0, 2, 'block')).toEqual({ from: 0, to: 2, color: 1, count: 3 });
  });

  it('lehnt unpassendes Ziel, volles Ziel, leere Quelle und Quelle = Ziel ab', () => {
    const p = createPuzzle([[0, 1], [0, 0, 0, 0], [], [2]], 4);
    expect(tryMove(p, 0, 3, 'single')).toBeNull(); // andere Farbe oben
    expect(tryMove(p, 0, 1, 'single')).toBeNull(); // Ziel voll
    expect(tryMove(p, 2, 0, 'single')).toBeNull(); // Quelle leer
    expect(tryMove(p, 0, 0, 'single')).toBeNull(); // identisch
    expect(() => applyMove(p, { from: 0, to: 3, color: 1, count: 1 }, 'single')).toThrow();
  });

  it('applyMove verändert den Eingabezustand nicht und erhält alle Kugeln', () => {
    const p = exampleLevel();
    const before = encodeState(p);
    const n = totalBalls(p);
    for (const mode of ['single', 'block'] as const) {
      for (const m of getLegalMoves(p, mode)) {
        const q = applyMove(p, m, mode);
        expect(totalBalls(q)).toBe(n);
      }
    }
    expect(encodeState(p)).toBe(before);
  });

  it('Symmetrie-Schlüssel ignoriert die Röhrchenreihenfolge, exakte Kodierung nicht', () => {
    const a = createPuzzle([[0, 1], [1, 0], []], 2);
    const b = createPuzzle([[1, 0], [], [0, 1]], 2);
    expect(canonicalKey(a)).toBe(canonicalKey(b));
    expect(encodeState(a)).not.toBe(encodeState(b));
  });
});

describe('Solver', () => {
  it('erkennt ein bereits gelöstes Level (0 Züge)', () => {
    const p = createPuzzle([[0, 0], [1, 1], []], 2);
    const r = solvePuzzle(p, { rules: single });
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(r.moves).toHaveLength(0);
  });

  it('kleines Level mit bekannter Lösung (Einzelkugel, 3 Züge, optimal)', () => {
    const p = createPuzzle([[0, 1], [1, 0], []], 2);
    const r = solvePuzzle(p, { rules: single, strategy: 'bfs' });
    expect(r.status).toBe('solved');
    if (r.status !== 'solved') return;
    expect(r.moves).toHaveLength(3);
    expect(r.optimal).toBe(true);
    expect(verifySolution(p, r.moves, single).ok).toBe(true);
  });

  it('Zielbedingung „monochrome“ ist schwächer als „complete“', () => {
    const p = createPuzzle([[0, 1], [1, 0], []], 2);
    const r = solvePuzzle(p, { rules: { mode: 'single', goal: 'monochrome' }, strategy: 'bfs' });
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(r.moves).toHaveLength(2);
  });

  it('Blockmodus: bekannte Lösung mit 3 Blockzügen', () => {
    const p = createPuzzle([[0, 0, 1, 1], [1, 1, 0, 0], []], 4);
    const r = solvePuzzle(p, { rules: block, strategy: 'bfs' });
    expect(r.status).toBe('solved');
    if (r.status !== 'solved') return;
    expect(r.moves).toHaveLength(3);
    expect(r.moves.every((m) => m.count === 2)).toBe(true);
    expect(verifySolution(p, r.moves, block).ok).toBe(true);
  });

  it('funktioniert mit mehreren leeren Röhrchen', () => {
    const p = createPuzzle([[0, 1, 0, 1], [1, 0, 1, 0], [], [], []], 4);
    for (const rules of [single, block]) {
      const r = solvePuzzle(p, { rules });
      expect(r.status).toBe('solved');
      if (r.status === 'solved') expect(verifySolution(p, r.moves, rules).ok).toBe(true);
    }
  });

  it('beweist Unlösbarkeit nur bei vollständiger Suche', () => {
    // Keine freie Stelle, nichts zu bewegen
    const p = createPuzzle([[0, 1], [1, 0]], 2);
    const r = solvePuzzle(p, { rules: single });
    expect(r.status).toBe('unsolvable');
  });

  it('meldet ungültige Zustände als „invalid“, ohne zu suchen', () => {
    const over = createPuzzle([[0, 0, 0], []], 2);
    expect(solvePuzzle(over, { rules: single }).status).toBe('invalid');
    const bad = createPuzzle([[0, 999], []], 4);
    expect(solvePuzzle(bad, { rules: single }).status).toBe('invalid');
  });

  it('Beispiellevel (10 Röhrchen, 8 Farben): gelöst, jeder Zug legal, Endzustand gelöst', () => {
    for (const rules of [single, block]) {
      const p = exampleLevel();
      const r = solvePuzzle(p, { rules, maxTimeMs: 60_000 });
      expect(r.status).toBe('solved');
      if (r.status !== 'solved') continue;
      // Zug für Zug mit den Spielfunktionen nachspielen
      let s = cloneState(p);
      for (const m of r.moves) s = applyMove(s, m, rules.mode);
      expect(isSolved(s, rules.goal)).toBe(true);
      expect(totalBalls(s)).toBe(32);
      // und unabhängig verifizieren
      const v = verifySolution(p, r.moves, rules);
      expect(v.ok).toBe(true);
      expect(v.states).toHaveLength(r.moves.length + 1);
    }
  });

  it('Zufallslevel: jede gemeldete Lösung besteht die unabhängige Prüfung', () => {
    let solved = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const p = randomLevel(6, 4, 2, seed);
      for (const rules of [single, block]) {
        const r = solvePuzzle(p, { rules, maxTimeMs: 20_000 });
        expect(r.status).not.toBe('invalid');
        if (r.status === 'solved') {
          solved++;
          expect(verifySolution(p, r.moves, rules).ok).toBe(true);
        }
      }
    }
    expect(solved).toBeGreaterThanOrEqual(20);
  });

  it('IDA* und BFS liefern gleich lange (optimale) Lösungen', () => {
    const p = createPuzzle([[0, 1, 0], [1, 0, 1], [], []], 3);
    const a = solvePuzzle(p, { rules: single, strategy: 'bfs' });
    const b = solvePuzzle(p, { rules: single, strategy: 'idastar' });
    expect(a.status).toBe('solved');
    expect(b.status).toBe('solved');
    if (a.status === 'solved' && b.status === 'solved') {
      expect(a.moves.length).toBe(b.moves.length);
      expect(verifySolution(p, b.moves, single).ok).toBe(true);
    }
  });

  it('IDA* (zulässige Heuristik) und BFS stimmen in beiden Modi auf Zufallsleveln überein', () => {
    for (const rules of [single, block, { mode: 'block', goal: 'monochrome' } as Rules]) {
      for (let seed = 1; seed <= 6; seed++) {
        const p = randomLevel(4, 3, 2, seed);
        const a = solvePuzzle(p, { rules, strategy: 'bfs' });
        const b = solvePuzzle(p, { rules, strategy: 'idastar' });
        expect(b.status).toBe(a.status);
        if (a.status === 'solved' && b.status === 'solved') expect(b.moves.length).toBe(a.moves.length);
      }
    }
  });

  it('gewichtetes A* meldet keine Optimalität', () => {
    const r = solvePuzzle(exampleLevel(), { rules: single, strategy: 'wastar' });
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(r.optimal).toBe(false);
  });

  it('Zustandsgrenze: „limit“ statt „unlösbar“', () => {
    const r = solvePuzzle(exampleLevel(), { rules: single, strategy: 'bfs', maxStates: 50 });
    expect(r.status).toBe('limit');
    if (r.status === 'limit') expect(r.reason).toBe('states');
  });

  it('Abbruch durch den Nutzer: „limit“ mit Grund „cancelled“', () => {
    let calls = 0;
    const r = solvePuzzle(exampleLevel(), {
      rules: single,
      strategy: 'bfs',
      maxStates: 5_000_000,
      shouldCancel: () => ++calls > 3,
    });
    expect(r.status).toBe('limit');
    if (r.status === 'limit') expect(r.reason).toBe('cancelled');
  });
});

describe('Unabhängige Verifizierung', () => {
  const p = createPuzzle([[0, 1], [1, 0], []], 2);
  const good: Move[] = [
    { from: 0, to: 2, color: 1, count: 1 },
    { from: 1, to: 0, color: 0, count: 1 },
    { from: 2, to: 1, color: 1, count: 1 },
  ];

  it('akzeptiert eine korrekte Lösung', () => {
    expect(verifySolution(p, good, single).ok).toBe(true);
  });

  it('verwirft falsche Farbe, leere Quelle, volles Ziel, falsche Anzahl und unfertigen Endzustand', () => {
    expect(verifySolution(p, [{ ...good[0], color: 0 }], single).ok).toBe(false);
    expect(verifySolution(p, [{ from: 2, to: 0, color: 1, count: 1 }], single).ok).toBe(false);
    expect(verifySolution(p, [good[0], { from: 1, to: 2, color: 0, count: 1 }], single).ok).toBe(false);
    expect(verifySolution(p, [{ ...good[0], count: 2 }], single).ok).toBe(false);
    expect(verifySolution(p, good.slice(0, 2), single).ok).toBe(false);
    expect(verifySolution(p, [{ from: 0, to: 0, color: 1, count: 1 }], single).ok).toBe(false);
  });

  it('prüft den Zugmodus: Einzelzug im Blockmodus ist falsch, wenn mehr Kugeln gemeint sind', () => {
    const q = createPuzzle([[0, 0, 1, 1], [1, 1, 0, 0], []], 4);
    const wrong: Move[] = [{ from: 0, to: 2, color: 1, count: 1 }];
    const v = verifySolution(q, wrong, block);
    expect(v.ok).toBe(false);
    expect(v.failedStep).toBe(1);
  });
});

describe('Wiedergabe: Vor- und Zurückschritte', () => {
  it('Zustände sind nach Vor- und Zurückschritt identisch', async () => {
    const { stateAt, clampStep } = await import('../state/playback');
    const p = exampleLevel();
    const r = solvePuzzle(p, { rules: single });
    expect(r.status).toBe('solved');
    if (r.status !== 'solved') return;
    const v = verifySolution(p, r.moves, single);
    const total = r.moves.length;
    const first = encodeState(stateAt(v.states, 0));
    expect(first).toBe(encodeState(p));
    const mid = Math.floor(total / 2);
    const snapshot = encodeState(stateAt(v.states, mid));
    let step = mid;
    step = clampStep(step + 1, total);
    step = clampStep(step - 1, total);
    expect(encodeState(stateAt(v.states, step))).toBe(snapshot);
    expect(clampStep(-3, total)).toBe(0);
    expect(clampStep(total + 5, total)).toBe(total);
    expect(isSolved(stateAt(v.states, total), single.goal)).toBe(true);
    // Zustand nach Zug i == applyMove-Kette
    let s = cloneState(p);
    r.moves.forEach((m, i) => {
      s = applyMove(s, m, single.mode);
      expect(encodeState(s)).toBe(encodeState(v.states[i + 1]));
    });
  });
});
