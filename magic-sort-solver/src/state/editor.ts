import { cloneTube, renumberTubes } from '../solver/puzzleUtils';
import { MAX_CAPACITY, MAX_COLOR_ID, MAX_TUBES, type ColorId, type PuzzleState, type Tube } from '../solver/types';

/** Reine Funktionen des manuellen Editors. Sie verändern den Eingabezustand nie. */
export interface EditResult {
  state: PuzzleState;
  /** Gesetzt, wenn die Änderung abgelehnt wurde (Zustand bleibt dann unverändert). */
  error?: string;
}

const ok = (state: PuzzleState): EditResult => ({ state });
const fail = (state: PuzzleState, error: string): EditResult => ({ state, error });

function finalize(t: Tube): Tube {
  if (t.uncertain && !t.uncertain.some(Boolean)) {
    const { uncertain: _drop, ...rest } = t;
    void _drop;
    return rest;
  }
  return t;
}

function replaceTube(state: PuzzleState, index: number, fn: (t: Tube) => Tube): PuzzleState {
  return { capacity: state.capacity, tubes: state.tubes.map((t, i) => (i === index ? finalize(fn(cloneTube(t))) : t)) };
}

function validIndex(state: PuzzleState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.tubes.length;
}

const validColor = (c: ColorId) => Number.isInteger(c) && c >= 0 && c <= MAX_COLOR_ID;

export function createEmptyPuzzle(tubeCount = 6, capacity = 4): PuzzleState {
  return { capacity, tubes: Array.from({ length: tubeCount }, (_, id) => ({ id, balls: [], capacity })) };
}

export function addTube(state: PuzzleState, capacity?: number): EditResult {
  if (state.tubes.length >= MAX_TUBES) return fail(state, `Maximal ${MAX_TUBES} Röhrchen möglich.`);
  const tube: Tube = { id: state.tubes.length, balls: [], capacity: capacity ?? state.capacity };
  return ok({ capacity: state.capacity, tubes: [...state.tubes, tube] });
}

export function removeTube(state: PuzzleState, index: number): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  if (state.tubes.length <= 1) return fail(state, 'Das letzte Röhrchen kann nicht entfernt werden.');
  const tubes = renumberTubes(state.tubes.filter((_, i) => i !== index));
  return ok({ capacity: state.capacity, tubes });
}

export function clearTube(state: PuzzleState, index: number): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  return ok(replaceTube(state, index, (t) => ({ id: t.id, capacity: t.capacity, balls: [] })));
}

export function setTubeCapacity(state: PuzzleState, index: number, capacity: number): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    return fail(state, `Die Kapazität muss zwischen 1 und ${MAX_CAPACITY} liegen.`);
  }
  if (state.tubes[index].balls.length > capacity) {
    return fail(state, `Röhrchen ${index + 1} enthält mehr als ${capacity} Kugeln. Erst Kugeln entfernen.`);
  }
  return ok(replaceTube(state, index, (t) => ({ ...t, capacity })));
}

/** Setzt die Standardkapazität und die Kapazität aller Röhrchen. */
export function setAllCapacities(state: PuzzleState, capacity: number): EditResult {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    return fail(state, `Die Kapazität muss zwischen 1 und ${MAX_CAPACITY} liegen.`);
  }
  const tooFull = state.tubes.findIndex((t) => t.balls.length > capacity);
  if (tooFull >= 0) return fail(state, `Röhrchen ${tooFull + 1} enthält mehr als ${capacity} Kugeln. Erst Kugeln entfernen.`);
  return ok({ capacity, tubes: state.tubes.map((t) => ({ ...cloneTube(t), capacity })) });
}

/** Fügt eine Kugel OBEN im Röhrchen ein (Reihenfolge der Daten: unten → oben). */
export function pushBall(state: PuzzleState, index: number, color: ColorId): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  if (!validColor(color)) return fail(state, 'Ungültige Farbe.');
  const t = state.tubes[index];
  if (t.balls.length >= t.capacity) return fail(state, `Röhrchen ${index + 1} ist voll.`);
  return ok(
    replaceTube(state, index, (tt) => ({
      ...tt,
      balls: [...tt.balls, color],
      uncertain: tt.uncertain ? [...tt.uncertain, false] : undefined,
    })),
  );
}

/** Entfernt die Kugel an Position `pos` (0 = unterste). Kugeln darüber rutschen nach. */
export function removeBall(state: PuzzleState, index: number, pos: number): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  const t = state.tubes[index];
  if (!Number.isInteger(pos) || pos < 0 || pos >= t.balls.length) return fail(state, 'An dieser Stelle liegt keine Kugel.');
  return ok(
    replaceTube(state, index, (tt) => {
      const balls = tt.balls.filter((_, i) => i !== pos);
      const uncertain = tt.uncertain ? tt.uncertain.filter((_, i) => i !== pos) : undefined;
      return { ...tt, balls, uncertain };
    }),
  );
}

export function setBall(state: PuzzleState, index: number, pos: number, color: ColorId): EditResult {
  if (!validIndex(state, index)) return fail(state, 'Röhrchen existiert nicht.');
  if (!validColor(color)) return fail(state, 'Ungültige Farbe.');
  const t = state.tubes[index];
  if (!Number.isInteger(pos) || pos < 0 || pos >= t.balls.length) return fail(state, 'An dieser Stelle liegt keine Kugel.');
  return ok(
    replaceTube(state, index, (tt) => {
      const balls = [...tt.balls];
      balls[pos] = color;
      const uncertain = tt.uncertain ? [...tt.uncertain] : undefined;
      if (uncertain) uncertain[pos] = false;
      return { ...tt, balls, uncertain };
    }),
  );
}

/** Editor-Funktion „Kugel verschieben“: oberste Kugel von `from` nach `to` – ohne Spielregeln, nur Kapazität. */
export function moveTopBall(state: PuzzleState, from: number, to: number): EditResult {
  if (!validIndex(state, from) || !validIndex(state, to)) return fail(state, 'Röhrchen existiert nicht.');
  if (from === to) return fail(state, 'Quelle und Ziel sind identisch.');
  const src = state.tubes[from];
  if (src.balls.length === 0) return fail(state, `Röhrchen ${from + 1} ist leer.`);
  const color = src.balls[src.balls.length - 1];
  const removed = removeBall(state, from, src.balls.length - 1);
  const pushed = pushBall(removed.state, to, color);
  if (pushed.error) return fail(state, pushed.error);
  return ok(pushed.state);
}
