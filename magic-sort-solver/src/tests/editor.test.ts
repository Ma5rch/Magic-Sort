import { describe, expect, it } from 'vitest';
import {
  addTube, clearTube, createEmptyPuzzle, moveTopBall, pushBall, removeBall, removeTube,
  setAllCapacities, setBall, setTubeCapacity,
} from '../state/editor';
import { validatePuzzle } from '../solver/validatePuzzle';
import { solvePuzzle } from '../solver/solvePuzzle';
import { verifySolution } from '../solver/verifySolution';
import { countUncertain } from '../solver/puzzleUtils';
import type { PuzzleState } from '../solver/types';

describe('Manueller Editor', () => {
  it('legt ein leeres Level an und fügt Kugeln OBEN ein (Reihenfolge unten → oben)', () => {
    let p = createEmptyPuzzle(3, 4);
    expect(p.tubes).toHaveLength(3);
    p = pushBall(p, 0, 2).state;
    p = pushBall(p, 0, 5).state;
    expect(p.tubes[0].balls).toEqual([2, 5]);
  });

  it('lehnt volle Röhrchen, ungültige Farben und falsche Indizes ab – ohne den Zustand zu ändern', () => {
    let p = createEmptyPuzzle(2, 2);
    p = pushBall(pushBall(p, 0, 1).state, 0, 1).state;
    const full = pushBall(p, 0, 3);
    expect(full.error).toBeTruthy();
    expect(full.state).toBe(p);
    expect(pushBall(p, 1, -2).error).toBeTruthy();
    expect(pushBall(p, 9, 1).error).toBeTruthy();
    expect(setBall(p, 0, 7, 1).error).toBeTruthy();
  });

  it('ändert und entfernt Kugeln; Kugeln darüber rutschen nach', () => {
    let p = createEmptyPuzzle(1, 4);
    for (const c of [0, 1, 2]) p = pushBall(p, 0, c).state;
    p = setBall(p, 0, 1, 7).state;
    expect(p.tubes[0].balls).toEqual([0, 7, 2]);
    p = removeBall(p, 0, 0).state;
    expect(p.tubes[0].balls).toEqual([7, 2]);
  });

  it('fügt Röhrchen hinzu/entfernt sie und nummeriert neu (interne Nummer = Index)', () => {
    let p = createEmptyPuzzle(3, 4);
    p = pushBall(p, 2, 6).state;
    p = addTube(p).state;
    expect(p.tubes).toHaveLength(4);
    p = removeTube(p, 0).state;
    expect(p.tubes.map((t) => t.id)).toEqual([0, 1, 2]);
    expect(p.tubes[1].balls).toEqual([6]);
    expect(removeTube(createEmptyPuzzle(1, 4), 0).error).toBeTruthy();
  });

  it('leert Röhrchen und setzt Kapazitäten, ohne Kugeln eigenmächtig zu löschen', () => {
    let p = createEmptyPuzzle(2, 4);
    for (const c of [0, 1, 2]) p = pushBall(p, 0, c).state;
    expect(setTubeCapacity(p, 0, 2).error).toBeTruthy();
    expect(setAllCapacities(p, 2).error).toBeTruthy();
    expect(setAllCapacities(p, 0).error).toBeTruthy();
    p = setAllCapacities(p, 5).state;
    expect(p.capacity).toBe(5);
    expect(p.tubes.every((t) => t.capacity === 5)).toBe(true);
    p = clearTube(p, 0).state;
    expect(p.tubes[0].balls).toEqual([]);
  });

  it('verschiebt die oberste Kugel (Editor-Funktion) nur bei freiem Platz', () => {
    let p = createEmptyPuzzle(2, 2);
    p = pushBall(pushBall(p, 0, 1).state, 0, 2).state;
    p = moveTopBall(p, 0, 1).state;
    expect(p.tubes[0].balls).toEqual([1]);
    expect(p.tubes[1].balls).toEqual([2]);
    expect(moveTopBall(p, 0, 0).error).toBeTruthy();
    expect(moveTopBall(createEmptyPuzzle(2, 2), 0, 1).error).toBeTruthy();
  });

  it('löscht die Unsicher-Markierung einer Kugel, sobald sie bearbeitet wird', () => {
    const p: PuzzleState = { capacity: 3, tubes: [{ id: 0, capacity: 3, balls: [1, 2], uncertain: [false, true] }, { id: 1, capacity: 3, balls: [] }] };
    expect(countUncertain(p)).toBe(1);
    expect(countUncertain(setBall(p, 0, 1, 4).state)).toBe(0);
    expect(countUncertain(removeBall(p, 0, 1).state)).toBe(0);
    expect(countUncertain(p)).toBe(1); // Eingabe unverändert
  });

  it('ein manuell gebauter Zustand ist lösbar und besteht die Prüfung (gleiche Datenstruktur wie Erkennung)', () => {
    let p = createEmptyPuzzle(3, 2);
    for (const [t, c] of [[0, 0], [0, 1], [1, 1], [1, 0]] as const) p = pushBall(p, t, c).state;
    expect(validatePuzzle(p).valid).toBe(true);
    const rules = { mode: 'single', goal: 'complete' } as const;
    const r = solvePuzzle(p, { rules });
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(verifySolution(p, r.moves, rules).ok).toBe(true);
  });
});
