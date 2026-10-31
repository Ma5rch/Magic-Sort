import { solvePuzzle } from '../solver/solvePuzzle';
import type { SolveRequest, WorkerResponse } from './protocol';

// Der Worker läuft in einem eigenen Thread, damit die Oberfläche bedienbar bleibt.
// Abbrechen = Worker beenden (terminate) – die Suche ist eine synchrone Schleife.
const scope = self as unknown as {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<SolveRequest>) => void) | null;
};

scope.onmessage = (event) => {
  const req = event.data;
  if (!req || req.type !== 'solve') return;
  try {
    const result = solvePuzzle(req.puzzle, {
      ...req.options,
      onProgress: (progress) => scope.postMessage({ type: 'progress', progress }),
    });
    scope.postMessage({ type: 'result', result });
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
