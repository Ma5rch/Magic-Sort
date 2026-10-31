import type { ValidationResult } from '../solver/validatePuzzle';
import type { DetectionMessage } from '../vision/types';

export interface ValidationPanelProps {
  validation: ValidationResult;
  uncertainCount: number;
  detectionMessages: DetectionMessage[];
}

/** Trennt: ungültiger Zustand (Fehler) · unsichere Erkennung · Hinweise. */
export function ValidationPanel({ validation, uncertainCount, detectionMessages }: ValidationPanelProps) {
  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');
  const detection = detectionMessages;
  return (
    <section className="validation" aria-labelledby="h-valid">
      <h3 id="h-valid">Prüfung</h3>
      {errors.length > 0 ? (
        <div className="msg msg-error" role="alert">
          <strong>Ungültiger Zustand – so kann nicht gelöst werden:</strong>
          <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
        </div>
      ) : (
        <p className="msg msg-ok">Der Zustand ist gültig ({validation.totalBalls} Kugeln).</p>
      )}
      {uncertainCount > 0 && (
        <p className="msg msg-warn">
          <strong>Unsichere Erkennung:</strong> {uncertainCount} Kugel(n) sind orange mit „?“ markiert. Tippe sie an und wähle die
          richtige Farbe (Modus „Ändern“). Das Markieren verschwindet, sobald du die Kugel bearbeitest.
        </p>
      )}
      {warnings.length > 0 && (
        <div className="msg msg-warn">
          <strong>Hinweise:</strong>
          <ul>{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </div>
      )}
      {detection.length > 0 && (
        <details>
          <summary>Details zur Bilderkennung ({detection.length})</summary>
          <ul>{detection.map((m, i) => <li key={i}>{m.text}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
