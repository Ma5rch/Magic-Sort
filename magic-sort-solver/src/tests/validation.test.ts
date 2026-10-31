import { describe, expect, it } from 'vitest';
import { exampleLevel } from '../fixtures/exampleLevel';
import { cloneState, createPuzzle } from '../solver/puzzleUtils';
import { validatePuzzle } from '../solver/validatePuzzle';

const codes = (r: ReturnType<typeof validatePuzzle>, sev: 'error' | 'warning') =>
  r.issues.filter((i) => i.severity === sev).map((i) => i.code);

describe('Validierung', () => {
  it('Beispiellevel ist gültig: 32 Kugeln, 8 Farben à 4', () => {
    const r = validatePuzzle(exampleLevel());
    expect(r.valid).toBe(true);
    expect(r.totalBalls).toBe(32);
    expect(Object.values(r.colorCounts)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
    expect(r.issues).toHaveLength(0);
  });

  it('erkennt überfüllte Röhrchen', () => {
    const r = validatePuzzle(createPuzzle([[0, 0, 0], []], 2));
    expect(r.valid).toBe(false);
    expect(codes(r, 'error')).toContain('OVERFULL');
  });

  it('erkennt ungültige Farbkennungen und Farben außerhalb der Palette', () => {
    expect(codes(validatePuzzle(createPuzzle([[-1], []], 2)), 'error')).toContain('BAD_COLOR');
    expect(codes(validatePuzzle(createPuzzle([[1.5], []], 2)), 'error')).toContain('BAD_COLOR');
    expect(codes(validatePuzzle(createPuzzle([[300], []], 2)), 'error')).toContain('BAD_COLOR');
    expect(codes(validatePuzzle(createPuzzle([[5], []], 2), { paletteIds: [0, 1, 2] }), 'error')).toContain('UNKNOWN_COLOR');
  });

  it('erkennt nicht positive Kapazität', () => {
    const p = createPuzzle([[], []], 2);
    p.tubes[0].capacity = 0;
    expect(codes(validatePuzzle(p), 'error')).toContain('BAD_CAPACITY');
    expect(codes(validatePuzzle(createPuzzle([[]], -1)), 'error')).toContain('BAD_CAPACITY');
  });

  it('warnt bei uneinheitlichen Farbanzahlen (fehlende/doppelte Kugel), blockiert aber nicht', () => {
    const p = cloneState(exampleLevel());
    p.tubes[0].balls.pop(); // eine Kugel „verloren“
    const r = validatePuzzle(p);
    expect(r.valid).toBe(true);
    expect(codes(r, 'warning')).toContain('COUNT_MISMATCH');
  });

  it('meldet unerreichbare Ziele: mehr Farben als Röhrchen, Farbe passt nicht in ein Röhrchen', () => {
    const tooFewTubes = createPuzzle([[0, 1], [2, 3]], 2); // 4 Farben, 2 Röhrchen
    expect(codes(validatePuzzle(tooFewTubes), 'error')).toContain('TOO_FEW_TUBES');
    const big = createPuzzle([[0, 0], [0], []], 2); // 3 Kugeln einer Farbe, Kapazität 2
    expect(codes(validatePuzzle(big, { rules: { mode: 'single', goal: 'complete' } }), 'error')).toContain('COLOR_TOO_MANY');
    expect(codes(validatePuzzle(big, { rules: { mode: 'single', goal: 'monochrome' } }), 'error')).not.toContain('COLOR_TOO_MANY');
  });

  it('verändert den Zustand nicht (kein stilles Korrigieren)', () => {
    const p = createPuzzle([[0, 0, 0], []], 2);
    const before = JSON.stringify(p);
    validatePuzzle(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
