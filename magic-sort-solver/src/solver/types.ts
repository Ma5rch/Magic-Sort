/** Eindeutige Farbkennung (0–254). Darstellungswerte stehen in palette.ts. */
export type ColorId = number;

export interface Tube {
  /** Interne Nummer ab 0 (== Index in PuzzleState.tubes). Die Oberfläche zeigt id + 1. */
  id: number;
  /** Kugeln von UNTEN nach OBEN. */
  balls: ColorId[];
  capacity: number;
  /** Prüfstatus aus der Bilderkennung, parallel zu `balls`: true = unsichere Farbe. */
  uncertain?: boolean[];
}

export interface PuzzleState {
  tubes: Tube[];
  /** Standardkapazität (neue Röhrchen, Anzeige). Der Solver nutzt die Kapazität je Röhrchen. */
  capacity: number;
}

export interface Move {
  from: number;
  to: number;
  color: ColorId;
  count: number;
}

/** single = Modus A (eine Kugel pro Zug), block = Modus B (gleichfarbiger Block). */
export type MoveMode = 'single' | 'block';
/**
 * monochrome: jedes Röhrchen leer oder einfarbig.
 * complete: zusätzlich liegt jede Farbe in genau einem Röhrchen (entspricht dem Spiel).
 */
export type GoalMode = 'monochrome' | 'complete';

export interface Rules {
  mode: MoveMode;
  goal: GoalMode;
}

export const DEFAULT_RULES: Rules = { mode: 'single', goal: 'complete' };

export const MAX_COLOR_ID = 254;
export const MAX_CAPACITY = 32;
export const MAX_TUBES = 40;
