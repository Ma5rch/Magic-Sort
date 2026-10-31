import { createPuzzle } from '../solver/puzzleUtils';
import type { PuzzleState } from '../solver/types';

/**
 * Beispielzustand mit der Struktur des Referenz-Screenshots (10 Röhrchen, Kapazität 4,
 * 8 belegte + 2 leere Röhrchen, 8 Farben à 4 Kugeln). Farben: 0 Rot, 1 Blau, 2 Grün, 3 Gelb,
 * 4 Türkis, 5 Pink, 6 Orange, 7 Lila. Reihenfolge je Röhrchen: unten → oben.
 *
 * HINWEIS: Die genaue Belegung muss mit dem echten Screenshot abgeglichen werden
 * (Screenshot lag beim Erstellen nicht vor). Die Fixture dient dem Solver-Test unabhängig
 * von der Bilderkennung und lässt sich hier 1:1 durch den manuell geprüften Zustand ersetzen.
 */
export const EXAMPLE_LEVEL_TUBES: number[][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [1, 0, 3, 2],
  [5, 4, 7, 6],
  [2, 3, 0, 1],
  [6, 7, 4, 5],
  [3, 2, 1, 0],
  [7, 6, 5, 4],
  [],
  [],
];

export function exampleLevel(): PuzzleState {
  return createPuzzle(EXAMPLE_LEVEL_TUBES, 4);
}
