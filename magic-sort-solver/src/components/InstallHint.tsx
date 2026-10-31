import { useState } from 'react';
import { KEY_HINT } from '../storage';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true);
}

export function InstallSteps() {
  return (
    <ol>
      <li>Öffne diese Seite in <strong>Safari</strong>.</li>
      <li>Tippe auf <strong>Teilen</strong> (Quadrat mit Pfeil; auf dem iPhone unten, auf dem iPad oben in der Leiste).</li>
      <li>Wähle <strong>„Zum Home-Bildschirm“</strong> und bestätige mit <strong>„Hinzufügen“</strong>.</li>
    </ol>
  );
}

export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(KEY_HINT) === '1';
    } catch {
      return false;
    }
  });
  if (isStandalone() || dismissed) return null;
  return (
    <aside className="card hint-card" aria-label="Installationshinweis">
      <h2>Als App auf den Home-Bildschirm</h2>
      <p className="muted">Optional: So startest du die App ohne Browserleiste. Das Hinzufügen musst du selbst bestätigen.</p>
      <InstallSteps />
      <button
        type="button"
        className="btn"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(KEY_HINT, '1');
          } catch {
            /* ignorieren */
          }
        }}
      >
        Hinweis ausblenden
      </button>
    </aside>
  );
}
