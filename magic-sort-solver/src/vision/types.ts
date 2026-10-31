import type { ColorDef } from '../solver/palette';
import type { ColorId, PuzzleState } from '../solver/types';

/** RGBA-Pixel wie ImageData (Zeilen von oben nach unten). */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface BallCandidate {
  cx: number;
  cy: number;
  r: number;
}

export interface VisionParams {
  minSaturation: number;
  minValue: number;
  /** Mindestabstand (RGB) zur Hintergrundfarbe der jeweiligen Bildzeile. */
  minBgDistance: number;
}

export const STRICT_PARAMS: VisionParams = { minSaturation: 0.3, minValue: 0.27, minBgDistance: 55 };
export const STRONG_PARAMS: VisionParams = { minSaturation: 0.35, minValue: 0.3, minBgDistance: 90 };
export const STRONGER_PARAMS: VisionParams = { minSaturation: 0.4, minValue: 0.3, minBgDistance: 130 };
export const RELAXED_PARAMS: VisionParams = { minSaturation: 0.18, minValue: 0.2, minBgDistance: 35 };
/** Reihenfolge der Versuche: getönte Glasröhrchen brauchen einen höheren Hintergrundabstand. */
export const PARAM_ATTEMPTS: VisionParams[] = [STRICT_PARAMS, STRONG_PARAMS, STRONGER_PARAMS, RELAXED_PARAMS];

export interface DetectionMessage {
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface OverlayBall {
  x: number;
  y: number;
  r: number;
  colorId: ColorId;
  uncertain: boolean;
  tube: number;
  pos: number;
}

export interface OverlayTube {
  index: number;
  x: number;
  /** y-Koordinate des Röhrchenbodens (unterste Kugel). */
  y: number;
  /** true = nicht direkt gesehen, sondern aus dem Raster abgeleitet (leeres Röhrchen). */
  inferred: boolean;
}

export interface DetectionResult {
  success: boolean;
  puzzle: PuzzleState | null;
  palette: ColorDef[];
  overlay: { width: number; height: number; balls: OverlayBall[]; tubes: OverlayTube[] };
  messages: DetectionMessage[];
}
