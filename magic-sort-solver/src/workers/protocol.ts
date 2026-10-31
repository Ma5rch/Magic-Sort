import type { Rules, PuzzleState } from '../solver/types';
import type { SolveProgress, SolveResult, SolverStrategy } from '../solver/solvePuzzle';

export interface SolveRequest {
  type: 'solve';
  puzzle: PuzzleState;
  options: { rules: Rules; strategy: SolverStrategy; maxStates: number; maxTimeMs: number };
}

export type WorkerResponse =
  | { type: 'progress'; progress: SolveProgress }
  | { type: 'result'; result: SolveResult }
  | { type: 'error'; message: string };
