import { DEFAULT_PALETTE, type ColorDef } from './solver/palette';
import { renumberTubes } from './solver/puzzleUtils';
import type { SolverStrategy } from './solver/solvePuzzle';
import { DEFAULT_RULES, type PuzzleState, type Rules } from './solver/types';

export interface Settings {
  rules: Rules;
  strategy: SolverStrategy;
  maxStates: number;
  maxTimeMs: number;
  /** Letztes Spielfeld lokal auf dem Gerät merken (nie Screenshots, nie auf einen Server). */
  persistPuzzle: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  rules: DEFAULT_RULES,
  strategy: 'auto',
  maxStates: 400_000,
  maxTimeMs: 30_000,
  persistPuzzle: true,
};

const KEY_SETTINGS = 'magic-sort:v1:settings';
const KEY_PUZZLE = 'magic-sort:v1:puzzle';
export const KEY_HINT = 'magic-sort:v1:install-hint-dismissed';

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privater Modus / Speicher voll: App funktioniert ohne Speicherung weiter */
  }
}

export function loadSettings(): Settings {
  const raw = read(KEY_SETTINGS) as Partial<Settings> | null;
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const modeOk = raw.rules?.mode === 'single' || raw.rules?.mode === 'block';
  const goalOk = raw.rules?.goal === 'monochrome' || raw.rules?.goal === 'complete';
  const strategies: SolverStrategy[] = ['auto', 'bfs', 'idastar', 'wastar'];
  return {
    rules: {
      mode: modeOk ? (raw.rules as Rules).mode : DEFAULT_RULES.mode,
      goal: goalOk ? (raw.rules as Rules).goal : DEFAULT_RULES.goal,
    },
    strategy: strategies.includes(raw.strategy as SolverStrategy) ? (raw.strategy as SolverStrategy) : DEFAULT_SETTINGS.strategy,
    maxStates: typeof raw.maxStates === 'number' && raw.maxStates >= 1000 ? raw.maxStates : DEFAULT_SETTINGS.maxStates,
    maxTimeMs: typeof raw.maxTimeMs === 'number' && raw.maxTimeMs >= 1000 ? raw.maxTimeMs : DEFAULT_SETTINGS.maxTimeMs,
    persistPuzzle: typeof raw.persistPuzzle === 'boolean' ? raw.persistPuzzle : DEFAULT_SETTINGS.persistPuzzle,
  };
}

export function saveSettings(s: Settings): void {
  write(KEY_SETTINGS, s);
}

export interface SavedPuzzle {
  puzzle: PuzzleState;
  palette: ColorDef[];
}

export function loadPuzzle(): SavedPuzzle | null {
  const raw = read(KEY_PUZZLE) as { puzzle?: PuzzleState; palette?: ColorDef[] } | null;
  const p = raw?.puzzle;
  if (!p || !Array.isArray(p.tubes) || typeof p.capacity !== 'number') return null;
  const tubes = p.tubes.map((t) => ({
    id: 0,
    capacity: typeof t?.capacity === 'number' ? t.capacity : p.capacity,
    balls: Array.isArray(t?.balls) ? t.balls.filter((b) => typeof b === 'number') : [],
    ...(Array.isArray(t?.uncertain) ? { uncertain: t.uncertain.map(Boolean) } : {}),
  }));
  const palette =
    Array.isArray(raw?.palette) && raw.palette.every((c) => c && typeof c.id === 'number' && typeof c.hex === 'string')
      ? (raw.palette as ColorDef[])
      : DEFAULT_PALETTE;
  return { puzzle: { capacity: p.capacity, tubes: renumberTubes(tubes) }, palette };
}

export function savePuzzle(s: SavedPuzzle): void {
  write(KEY_PUZZLE, s);
}

export function clearSavedPuzzle(): void {
  try {
    window.localStorage.removeItem(KEY_PUZZLE);
  } catch {
    /* ignorieren */
  }
}

export function clearAllStorage(): void {
  try {
    window.localStorage.removeItem(KEY_PUZZLE);
    window.localStorage.removeItem(KEY_SETTINGS);
    window.localStorage.removeItem(KEY_HINT);
  } catch {
    /* ignorieren */
  }
}
