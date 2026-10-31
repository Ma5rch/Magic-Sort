import { colorCounts, totalBalls } from './puzzleUtils';
import { MAX_CAPACITY, MAX_COLOR_ID, MAX_TUBES, type PuzzleState, type Rules } from './types';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  tubeId?: number;
}

export interface ValidationResult {
  /** true, wenn keine Fehler (Warnungen sind erlaubt). */
  valid: boolean;
  issues: ValidationIssue[];
  colorCounts: Record<number, number>;
  totalBalls: number;
}

export interface ValidateOptions {
  /** Erlaubte Farbkennungen (z. B. aus der Palette). Ohne Angabe: 0–254. */
  paletteIds?: Iterable<number>;
  rules?: Rules;
}

/** Prüft einen Zustand. Verändert nichts und korrigiert nichts. */
export function validatePuzzle(state: PuzzleState, options: ValidateOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, tubeId?: number) => issues.push({ severity: 'error', code, message, tubeId });
  const warn = (code: string, message: string, tubeId?: number) => issues.push({ severity: 'warning', code, message, tubeId });
  const allowed = options.paletteIds ? new Set(options.paletteIds) : null;

  if (!Number.isInteger(state.capacity) || state.capacity < 1) {
    err('BAD_CAPACITY', 'Die Standardkapazität muss eine positive ganze Zahl sein.');
  }
  if (state.tubes.length === 0) err('NO_TUBES', 'Es gibt kein Röhrchen.');
  if (state.tubes.length > MAX_TUBES) err('TOO_MANY_TUBES', `Maximal ${MAX_TUBES} Röhrchen werden unterstützt.`);

  state.tubes.forEach((t, i) => {
    const n = i + 1;
    if (t.id !== i) err('BAD_ID', `Röhrchen ${n}: interne Nummer stimmt nicht überein.`, i);
    if (!Number.isInteger(t.capacity) || t.capacity < 1) {
      err('BAD_CAPACITY', `Röhrchen ${n}: Die Kapazität muss positiv sein.`, i);
    } else if (t.capacity > MAX_CAPACITY) {
      err('BAD_CAPACITY', `Röhrchen ${n}: Die Kapazität darf höchstens ${MAX_CAPACITY} sein.`, i);
    } else if (t.balls.length > t.capacity) {
      err('OVERFULL', `Röhrchen ${n} ist überfüllt (${t.balls.length} Kugeln, Kapazität ${t.capacity}).`, i);
    }
    if (t.capacity !== state.capacity && Number.isInteger(t.capacity)) {
      warn('MIXED_CAPACITY', `Röhrchen ${n} hat die Kapazität ${t.capacity} (Standard: ${state.capacity}).`, i);
    }
    t.balls.forEach((b, pos) => {
      if (!Number.isInteger(b) || b < 0 || b > MAX_COLOR_ID) {
        err('BAD_COLOR', `Röhrchen ${n}, Position ${pos + 1}: ungültige Farbkennung (${String(b)}).`, i);
      } else if (allowed && !allowed.has(b)) {
        err('UNKNOWN_COLOR', `Röhrchen ${n}, Position ${pos + 1}: Farbe ${b} ist nicht in der Palette.`, i);
      }
    });
  });

  const counts = colorCounts(state);
  const countObj: Record<number, number> = {};
  counts.forEach((v, k) => (countObj[k] = v));
  const total = totalBalls(state);
  const hasStructuralError = issues.some((x) => x.severity === 'error');

  if (!hasStructuralError) {
    if (total === 0) warn('NO_BALLS', 'Es liegen keine Kugeln in den Röhrchen.');
    const distinct = new Set(counts.values());
    if (distinct.size > 1) {
      const parts = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([c, n]) => `Farbe ${c}: ${n}`);
      warn(
        'COUNT_MISMATCH',
        `Die Farben kommen unterschiedlich oft vor (${parts.join(', ')}). Möglicherweise fehlt eine Kugel oder wurde doppelt erfasst.`,
      );
    }
    const maxCap = Math.max(0, ...state.tubes.map((t) => t.capacity));
    const colors = counts.size;
    if (colors > state.tubes.length) {
      err('TOO_FEW_TUBES', `Es gibt ${colors} Farben, aber nur ${state.tubes.length} Röhrchen – das Ziel ist nicht erreichbar.`);
    }
    if ((options.rules?.goal ?? 'complete') === 'complete') {
      counts.forEach((n, c) => {
        if (n > maxCap) {
          err('COLOR_TOO_MANY', `Farbe ${c} hat ${n} Kugeln, aber in ein Röhrchen passen höchstens ${maxCap}.`);
        }
      });
    }
  }

  return { valid: !issues.some((x) => x.severity === 'error'), issues, colorCounts: countObj, totalBalls: total };
}
