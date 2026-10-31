import { useCallback, useEffect, useRef, useState } from 'react';
import { solvePuzzle, type SolveProgress, type SolveResult, type SolverStrategy } from '../solver/solvePuzzle';
import type { PuzzleState, Rules } from '../solver/types';
import type { SolveRequest, WorkerResponse } from '../workers/protocol';

export type SolveOutcome =
  | { kind: 'result'; result: SolveResult }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export interface SolveRunOptions {
  rules: Rules;
  strategy: SolverStrategy;
  maxStates: number;
  maxTimeMs: number;
}

function createWorker(): Worker {
  return new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
}

export function useSolver() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<((o: SolveOutcome) => void) | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SolveProgress | null>(null);
  const [usesWorker, setUsesWorker] = useState(true);

  const solve = useCallback(
    (puzzle: PuzzleState, options: SolveRunOptions): Promise<SolveOutcome> =>
      new Promise<SolveOutcome>((resolve) => {
        setRunning(true);
        setProgress(null);
        const finish = (o: SolveOutcome) => {
          pendingRef.current = null;
          setRunning(false);
          resolve(o);
        };

        let worker: Worker | null = null;
        try {
          worker = workerRef.current ?? createWorker();
          workerRef.current = worker;
          setUsesWorker(true);
        } catch {
          worker = null;
        }

        if (!worker) {
          // Notfall: ohne Web Worker im Hauptthread rechnen (nicht abbrechbar).
          setUsesWorker(false);
          setTimeout(() => {
            try {
              finish({ kind: 'result', result: solvePuzzle(puzzle, { ...options, onProgress: setProgress }) });
            } catch (e) {
              finish({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
            }
          }, 50);
          return;
        }

        pendingRef.current = finish;
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const msg = e.data;
          if (msg.type === 'progress') setProgress(msg.progress);
          else if (msg.type === 'result') finish({ kind: 'result', result: msg.result });
          else finish({ kind: 'error', message: msg.message });
        };
        worker.onerror = (e) => {
          worker?.terminate();
          workerRef.current = null;
          finish({ kind: 'error', message: e.message || 'Der Rechen-Thread ist abgestürzt.' });
        };
        const req: SolveRequest = { type: 'solve', puzzle, options };
        worker.postMessage(req);
      }),
    [],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRef.current?.({ kind: 'cancelled' });
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return { solve, cancel, running, progress, usesWorker };
}
