import type { SolverStrategy } from '../solver/solvePuzzle';
import type { GoalMode, MoveMode } from '../solver/types';
import type { Settings } from '../storage';
import { InstallSteps, isStandalone } from './InstallHint';

export interface SettingsPanelProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClearData: () => void;
}

const STATES = [50_000, 200_000, 400_000, 1_000_000, 2_000_000];
const TIMES = [10_000, 30_000, 60_000, 120_000];

export function SettingsPanel({ settings, onChange, onClearData }: SettingsPanelProps) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="stack">
      <section className="card" aria-labelledby="h-rules">
        <h2 id="h-rules">Spielregeln</h2>
        <p className="muted">Wähle die Regeln so, wie dein Spiel sie verwendet. Suche, Prüfung und Wiedergabe nutzen exakt diese Einstellung.</p>
        <fieldset className="radio-group">
          <legend>Zugmodus</legend>
          {(
            [
              ['single', 'Modus A – Einzelkugel: pro Zug genau eine Kugel'],
              ['block', 'Modus B – Gleichfarbiger Block: so viele gleiche Kugeln, wie passen'],
            ] as [MoveMode, string][]
          ).map(([id, label]) => (
            <label key={id} className="radio">
              <input type="radio" name="mode" checked={settings.rules.mode === id} onChange={() => set({ rules: { ...settings.rules, mode: id } })} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="radio-group">
          <legend>Zielbedingung</legend>
          {(
            [
              ['complete', 'Jede Farbe liegt in genau einem Röhrchen (wie im Spiel)'],
              ['monochrome', 'Jedes Röhrchen ist leer oder einfarbig'],
            ] as [GoalMode, string][]
          ).map(([id, label]) => (
            <label key={id} className="radio">
              <input type="radio" name="goal" checked={settings.rules.goal === id} onChange={() => set({ rules: { ...settings.rules, goal: id } })} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card" aria-labelledby="h-search">
        <h2 id="h-search">Suche</h2>
        <label className="field">
          Verfahren
          <select value={settings.strategy} onChange={(e) => set({ strategy: e.target.value as SolverStrategy })}>
            <option value="auto">Automatisch (empfohlen)</option>
            <option value="bfs">Breitensuche – kürzeste Lösung, mehr Speicher</option>
            <option value="idastar">IDA* – kürzeste Lösung, wenig Speicher</option>
            <option value="wastar">Gewichtetes A* – schnell, nicht unbedingt kürzeste Lösung</option>
          </select>
        </label>
        <label className="field">
          Grenze für Zustände
          <select value={settings.maxStates} onChange={(e) => set({ maxStates: Number(e.target.value) })}>
            {STATES.map((s) => <option key={s} value={s}>{s.toLocaleString('de-DE')}</option>)}
          </select>
        </label>
        <label className="field">
          Höchste Suchzeit
          <select value={settings.maxTimeMs} onChange={(e) => set({ maxTimeMs: Number(e.target.value) })}>
            {TIMES.map((t) => <option key={t} value={t}>{t / 1000} Sekunden</option>)}
          </select>
        </label>
        <p className="muted">Höhere Grenzen brauchen auf dem iPhone mehr Arbeitsspeicher. Wird eine Grenze erreicht, heißt das nicht, dass das Level unlösbar ist.</p>
      </section>

      <section className="card" aria-labelledby="h-priv">
        <h2 id="h-priv">Datenschutz</h2>
        <p className="muted">Alle Bilder und Berechnungen bleiben auf diesem Gerät. Es gibt keine Konten, keine Werbung und kein Tracking.</p>
        <label className="radio">
          <input type="checkbox" checked={settings.persistPuzzle} onChange={(e) => set({ persistPuzzle: e.target.checked })} />
          <span>Letztes Spielfeld auf diesem Gerät merken (ohne Screenshot)</span>
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-danger" onClick={onClearData}>Gespeicherte Daten löschen</button>
        </div>
      </section>

      <section className="card" aria-labelledby="h-inst">
        <h2 id="h-inst">Installation</h2>
        {isStandalone() ? (
          <p>Die App läuft gerade als installierte Web-App.</p>
        ) : (
          <>
            <p className="muted">Zum Home-Bildschirm hinzufügen:</p>
            <InstallSteps />
          </>
        )}
      </section>
    </div>
  );
}
