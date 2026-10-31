import type { PuzzleState, Tube } from './types';

const SEP = '\u0000';

/** Ein Zeichen Kapazität + ein Zeichen je Kugel (Farbe + 1, daher nie \u0000). */
export function encodeTube(t: Tube): string {
  let s = String.fromCharCode(t.capacity);
  for (const b of t.balls) s += String.fromCharCode(b + 1);
  return s;
}

/** Exakte Kodierung (Reihenfolge der Röhrchen zählt). */
export function encodeState(state: PuzzleState): string {
  return state.tubes.map(encodeTube).join(SEP);
}

/**
 * Symmetrie-reduzierter Schlüssel: Röhrchen mit gleicher Kapazität sind austauschbar.
 * Der Schlüssel dient nur der Erkennung doppelter Zustände; die realen Röhrchennummern
 * bleiben in den Zügen erhalten.
 */
export function canonicalKey(state: PuzzleState): string {
  return state.tubes.map(encodeTube).sort().join(SEP);
}

export function statesEqual(a: PuzzleState, b: PuzzleState): boolean {
  return encodeState(a) === encodeState(b);
}
