import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColorPalette } from './components/ColorPalette';
import { EditorToolbar, type EditMode } from './components/EditorToolbar';
import { ImageUploader } from './components/ImageUploader';
import { InstallHint } from './components/InstallHint';
import { MoveCard } from './components/MoveCard';
import { PuzzleBoard } from './components/PuzzleBoard';
import { SettingsPanel } from './components/SettingsPanel';
import { SolutionPlayer } from './components/SolutionPlayer';
import { StatusBanner, type StatusKind } from './components/StatusBanner';
import { ValidationPanel } from './components/ValidationPanel';
import { exampleLevel } from './fixtures/exampleLevel';
import { useSolver } from './hooks/useSolver';
import { DEFAULT_PALETTE, colorName, type ColorDef } from './solver/palette';
import { cloneState, countUncertain, tubeLabel } from './solver/puzzleUtils';
import type { SolveResult } from './solver/solvePuzzle';
import type { Move, PuzzleState, Rules } from './solver/types';
import { validatePuzzle } from './solver/validatePuzzle';
import { verifySolution } from './solver/verifySolution';
import {
  addTube, clearTube, createEmptyPuzzle, moveTopBall, pushBall, removeBall, removeTube,
  setAllCapacities, setBall, setTubeCapacity, type EditResult,
} from './state/editor';
import { movesToText } from './state/playback';
import { clearAllStorage, clearSavedPuzzle, loadPuzzle, loadSettings, saveSettings, savePuzzle, type Settings } from './storage';
import { loadScreenshot, type LoadedImage } from './vision/loadImage';
import { analyzeImage } from './vision/reconstructBoard';
import type { DetectionResult } from './vision/types';

type Tab = 'board' | 'solution' | 'settings';

interface Solution {
  moves: Move[];
  states: PuzzleState[];
  rules: Rules;
  optimal: boolean;
  algorithm: string;
  statesExplored: number;
  elapsedMs: number;
}

interface Status {
  kind: StatusKind;
  text: string;
  detail?: string;
}

const tick = (ms = 60) => new Promise<void>((r) => setTimeout(r, ms));

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fallback unten */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const LIMIT_TEXT: Record<string, string> = {
  states: 'Zustandsgrenze erreicht',
  time: 'Zeitgrenze erreicht',
  cancelled: 'Vom Nutzer abgebrochen',
};

export default function App() {
  const [initial] = useState(() => {
    const settings = loadSettings();
    return { settings, saved: settings.persistPuzzle ? loadPuzzle() : null };
  });
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [puzzle, setPuzzle] = useState<PuzzleState>(() => initial.saved?.puzzle ?? createEmptyPuzzle(6, 4));
  const [palette, setPalette] = useState<ColorDef[]>(() => initial.saved?.palette ?? DEFAULT_PALETTE);
  const [history, setHistory] = useState<PuzzleState[]>([]);
  const [tab, setTab] = useState<Tab>('board');

  const [image, setImage] = useState<LoadedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [mode, setMode] = useState<EditMode>('recolor');
  const [color, setColor] = useState(0);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moveSource, setMoveSource] = useState<number | null>(null);
  const [hint, setHint] = useState('');

  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });
  const [solution, setSolution] = useState<Solution | null>(null);
  const [step, setStep] = useState(0);
  const [listView, setListView] = useState<'cards' | 'table'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(min-width: 834px)').matches ? 'table' : 'cards',
  );
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const solver = useSolver();
  const validationRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLElement>(null);

  // --- Persistenz -------------------------------------------------------
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (settings.persistPuzzle) savePuzzle({ puzzle, palette });
  }, [puzzle, palette, settings.persistPuzzle]);

  // --- Validierung ------------------------------------------------------
  const validation = useMemo(
    () => validatePuzzle(puzzle, { paletteIds: palette.map((c) => c.id), rules: settings.rules }),
    [puzzle, palette, settings.rules],
  );
  const uncertainCount = countUncertain(puzzle);

  // --- Zustand ändern ---------------------------------------------------
  const commit = useCallback(
    (next: PuzzleState) => {
      setHistory((h) => [...h.slice(-49), puzzle]);
      setPuzzle(next);
      setSolution(null);
      setStep(0);
    },
    [puzzle],
  );

  const apply = (r: EditResult): boolean => {
    if (r.error) {
      setHint(r.error);
      return false;
    }
    setHint('');
    commit(r.state);
    return true;
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setPuzzle(prev);
    setSolution(null);
    setSelectedTube(null);
    setMoveSource(null);
    setHint('');
  };

  const handleMoveTap = (i: number) => {
    if (moveSource === null) {
      if (puzzle.tubes[i].balls.length === 0) setHint(`Röhrchen ${tubeLabel(i)} ist leer – wähle ein Röhrchen mit Kugeln als Quelle.`);
      else {
        setMoveSource(i);
        setHint(`Quelle: Röhrchen ${tubeLabel(i)}. Tippe jetzt das Zielröhrchen an.`);
      }
      return;
    }
    if (moveSource === i) {
      setMoveSource(null);
      setHint('Verschieben abgebrochen.');
      return;
    }
    apply(moveTopBall(puzzle, moveSource, i));
    setMoveSource(null);
  };

  const onBallTap = (i: number, pos: number) => {
    if (mode === 'recolor') apply(setBall(puzzle, i, pos, color));
    else if (mode === 'add') apply(pushBall(puzzle, i, color));
    else if (mode === 'remove') apply(removeBall(puzzle, i, pos));
    else handleMoveTap(i);
  };

  const onTubeTap = (i: number) => {
    if (mode === 'recolor' || mode === 'add') apply(pushBall(puzzle, i, color));
    else if (mode === 'remove') {
      const n = puzzle.tubes[i].balls.length;
      if (n === 0) setHint(`Röhrchen ${tubeLabel(i)} ist bereits leer.`);
      else apply(removeBall(puzzle, i, n - 1));
    } else handleMoveTap(i);
  };

  const changeMode = (m: EditMode) => {
    setMode(m);
    setMoveSource(null);
    setHint('');
  };

  const newManualLevel = () => {
    commit(createEmptyPuzzle(Math.max(6, puzzle.tubes.length), puzzle.capacity));
    setDetection(null);
    setSelectedTube(null);
    setStatus({ kind: 'ok', text: 'Leeres Level angelegt. Wähle eine Farbe und tippe auf die Röhrchen.' });
    window.setTimeout(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const loadExample = () => {
    setPalette(DEFAULT_PALETTE);
    commit(exampleLevel());
    setDetection(null);
    setSelectedTube(null);
    setStatus({ kind: 'ok', text: 'Beispiellevel geladen (10 Röhrchen, 8 Farben).' });
  };

  const changeCapacity = (delta: number) => {
    if (selectedTube === null) apply(setAllCapacities(puzzle, puzzle.capacity + delta));
    else apply(setTubeCapacity(puzzle, selectedTube, puzzle.tubes[selectedTube].capacity + delta));
  };

  // --- Screenshot -------------------------------------------------------
  const onFile = async (file: File) => {
    setImageError(null);
    try {
      const loaded = await loadScreenshot(file);
      setImage((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return loaded;
      });
      setDetection(null);
      setStatus({ kind: 'idle', text: '' });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Das Bild konnte nicht geladen werden.');
    }
  };

  const analyze = async () => {
    if (!image) return;
    setDetecting(true);
    setStatus({ kind: 'busy', text: 'Screenshot wird analysiert …', detail: 'Kugeln, Röhrchen und Farben werden lokal erkannt.' });
    await tick();
    try {
      const res = analyzeImage(image.analysis);
      setDetection(res);
      if (res.success && res.puzzle) {
        setPalette(res.palette);
        commit(res.puzzle);
        setSelectedTube(null);
        const unsure = countUncertain(res.puzzle);
        const warnings = res.messages.filter((m) => m.level === 'warn').length;
        setStatus(
          unsure > 0 || warnings > 0
            ? { kind: 'warn', text: 'Erkennung abgeschlossen – bitte prüfen.', detail: `${unsure} unsichere Kugel(n), ${warnings} Hinweis(e). Korrigiere Fehler unten, bevor du löst.` }
            : { kind: 'ok', text: 'Erkennung abgeschlossen.', detail: 'Bitte vergleiche das Ergebnis trotzdem kurz mit deinem Spiel.' },
        );
        window.setTimeout(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      } else {
        setStatus({
          kind: 'error',
          text: 'Erkennung fehlgeschlagen.',
          detail: (res.messages[0]?.text ?? 'Unbekannter Fehler.') + ' Dein bisheriges Spielfeld blieb unverändert; die manuelle Eingabe funktioniert weiterhin.',
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: 'Interner Fehler bei der Bilderkennung.', detail: String(e) });
    } finally {
      setDetecting(false);
    }
  };

  // --- Lösen --------------------------------------------------------------
  const describeResult = (r: SolveResult, snapshot: PuzzleState, rules: Rules): Status | null => {
    if (r.status === 'solved') {
      if (r.moves.length === 0) return { kind: 'ok', text: 'Das Level ist bereits gelöst.' };
      const v = verifySolution(snapshot, r.moves, rules);
      if (!v.ok) {
        return {
          kind: 'error',
          text: 'Interner Fehler: Die berechnete Lösung wurde verworfen.',
          detail: `Die unabhängige Prüfung ist fehlgeschlagen: ${v.error ?? 'unbekannt'}. Es wird keine Zugfolge angezeigt.`,
        };
      }
      setSolution({
        moves: r.moves,
        states: v.states,
        rules,
        optimal: r.optimal,
        algorithm: r.stats.algorithm,
        statesExplored: r.stats.statesExplored,
        elapsedMs: r.stats.elapsedMs,
      });
      setStep(0);
      setTab('solution');
      return {
        kind: 'ok',
        text: `Lösung gefunden und geprüft: ${r.moves.length} Züge.`,
        detail: r.optimal ? 'Kürzeste Lösung garantiert (vollständige Suche).' : 'Nicht unbedingt die kürzeste Lösung.',
      };
    }
    if (r.status === 'unsolvable') {
      return {
        kind: 'error',
        text: 'Das Level ist unlösbar.',
        detail: `Die vollständige Suche (${r.stats.statesExplored.toLocaleString('de-DE')} Zustände) fand keine Lösung. Prüfe Farben und Anzahl der Kugeln auf Eingabe- oder Erkennungsfehler.`,
      };
    }
    if (r.status === 'limit') {
      return {
        kind: 'warn',
        text: 'Suche abgebrochen oder Grenze erreicht.',
        detail: `${LIMIT_TEXT[r.reason]} nach ${r.stats.statesExplored.toLocaleString('de-DE')} Zuständen. Das heißt nicht, dass das Level unlösbar ist – erhöhe die Grenzen in den Einstellungen.`,
      };
    }
    return { kind: 'error', text: 'Ungültiger Zustand.', detail: r.message };
  };

  const solve = async () => {
    if (!validation.valid) {
      setStatus({ kind: 'error', text: 'Der Zustand ist ungültig.', detail: 'Bitte zuerst die unter „Prüfung“ genannten Fehler beheben.' });
      validationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (uncertainCount > 0 && !window.confirm(`${uncertainCount} Kugel(n) sind als unsicher markiert. Trotzdem lösen?`)) return;
    const snapshot = cloneState(puzzle);
    const rules: Rules = { ...settings.rules };
    setSolution(null);
    setStatus({ kind: 'busy', text: 'Level wird gelöst …' });
    const out = await solver.solve(snapshot, {
      rules,
      strategy: settings.strategy,
      maxStates: settings.maxStates,
      maxTimeMs: settings.maxTimeMs,
    });
    if (out.kind === 'cancelled') setStatus({ kind: 'warn', text: 'Berechnung abgebrochen.' });
    else if (out.kind === 'error') setStatus({ kind: 'error', text: 'Interner Fehler im Solver.', detail: out.message });
    else setStatus(describeResult(out.result, snapshot, rules) ?? { kind: 'idle', text: '' });
  };

  const busy = solver.running || detecting;
  const shownStatus: Status = solver.running
    ? {
        kind: 'busy',
        text: 'Level wird gelöst …',
        detail: solver.progress
          ? `${solver.progress.phase}: ${solver.progress.statesExplored.toLocaleString('de-DE')} Zustände · ${(solver.progress.elapsedMs / 1000).toFixed(1)} s${solver.usesWorker ? '' : ' (im Hauptthread, nicht abbrechbar)'}`
          : 'Suche startet …',
      }
    : status;

  const copyMoves = async () => {
    if (!solution) return;
    setCopied((await copyText(movesToText(solution.moves, palette))) ? 'ok' : 'fail');
  };

  const clearData = () => {
    if (!window.confirm('Gespeichertes Spielfeld und Einstellungen von diesem Gerät löschen?')) return;
    clearAllStorage();
    clearSavedPuzzle();
    setSettings({ ...loadSettings(), persistPuzzle: false });
  };

  const changeSettings = (s: Settings) => {
    if (!s.persistPuzzle) clearSavedPuzzle();
    if (s.rules.mode !== settings.rules.mode || s.rules.goal !== settings.rules.goal) {
      // Eine Lösung gilt nur für die Regeln, mit denen sie berechnet wurde.
      setSolution(null);
    }
    setSettings(s);
  };

  // --- Darstellung ------------------------------------------------------
  const boardTab = (
    <div className="grid-2">
      <div className="stack">
        <InstallHint />
        <ImageUploader
          image={image}
          overlay={detection?.overlay ?? null}
          palette={palette}
          busy={busy}
          error={imageError}
          onFile={onFile}
          onAnalyze={analyze}
          onManual={newManualLevel}
          onExample={loadExample}
        />
      </div>
      <div className="stack">
        <section className="card" ref={boardRef} aria-labelledby="h-board">
          <h2 id="h-board">2 · Spielfeld prüfen und korrigieren</h2>
          <ColorPalette palette={palette} selected={color} onSelect={setColor} />
          <PuzzleBoard
            puzzle={puzzle}
            palette={palette}
            source={mode === 'move' ? moveSource : null}
            selectedTube={selectedTube}
            onTubeTap={onTubeTap}
            onBallTap={onBallTap}
            onLabelTap={(i) => setSelectedTube((s) => (s === i ? null : i))}
          />
          <EditorToolbar
            mode={mode}
            onMode={changeMode}
            selectedTube={selectedTube}
            capacity={puzzle.capacity}
            tubeCount={puzzle.tubes.length}
            canUndo={history.length > 0}
            onUndo={undo}
            onAddTube={() => apply(addTube(puzzle))}
            onRemoveTube={() => {
              if (selectedTube !== null && apply(removeTube(puzzle, selectedTube))) setSelectedTube(null);
            }}
            onClearTube={() => selectedTube !== null && apply(clearTube(puzzle, selectedTube))}
            onCapacity={changeCapacity}
            onReset={() => {
              if (window.confirm('Das komplette Level zurücksetzen?')) {
                commit(createEmptyPuzzle(6, 4));
                setSelectedTube(null);
                setDetection(null);
              }
            }}
            hint={hint}
          />
          <div ref={validationRef}>
            <ValidationPanel validation={validation} uncertainCount={uncertainCount} detectionMessages={detection?.messages ?? []} />
          </div>
        </section>
        <section className="card" aria-labelledby="h-solve">
          <h2 id="h-solve">3 · Lösen</h2>
          <p className="muted">
            Regeln: {settings.rules.mode === 'single' ? 'Einzelkugel' : 'Gleichfarbiger Block'} · Ziel:{' '}
            {settings.rules.goal === 'complete' ? 'jede Farbe in einem Röhrchen' : 'Röhrchen leer oder einfarbig'} (änderbar unter „Einstellungen“)
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary btn-big" disabled={busy || !validation.valid} onClick={solve}>
              Level lösen
            </button>
          </div>
          <StatusBanner kind={shownStatus.kind} text={shownStatus.text} detail={shownStatus.detail} onCancel={solver.running ? solver.cancel : undefined} />
        </section>
      </div>
    </div>
  );

  const solutionTab = !solution ? (
    <section className="card">
      <h2>Lösung</h2>
      <p className="muted">Noch keine Lösung. Gehe zu „Spielfeld“, prüfe das Level und tippe auf „Level lösen“.</p>
      <StatusBanner kind={shownStatus.kind} text={shownStatus.text} detail={shownStatus.detail} onCancel={solver.running ? solver.cancel : undefined} />
    </section>
  ) : (
    <div className="grid-2 solution-grid">
      <div className="sticky-col">
        <SolutionPlayer states={solution.states} moves={solution.moves} palette={palette} step={step} onStep={setStep} />
      </div>
      <div className="stack">
        <StatusBanner kind={shownStatus.kind} text={shownStatus.text} detail={shownStatus.detail} />
        <section className="card" aria-labelledby="h-copy">
          <h2 id="h-copy">Kompakte Zugliste</h2>
          <p className="muted">Format: Zugnummer. Von → Nach (Farbe ×Anzahl). Röhrchen sind von links nach rechts, dann von oben nach unten ab 1 nummeriert.</p>
          <pre className="movetext" tabIndex={0}>{movesToText(solution.moves, palette)}</pre>
          <div className="btn-row">
            <button type="button" className="btn" onClick={copyMoves}>Zugliste kopieren</button>
            {copied === 'ok' && <span className="msg-inline msg-ok" role="status">Kopiert.</span>}
            {copied === 'fail' && <span className="msg-inline msg-error" role="status">Kopieren nicht möglich – Text oben markieren.</span>}
          </div>
        </section>
        <section className="card" aria-labelledby="h-list">
          <h2 id="h-list">Alle Züge</h2>
          <div className="segmented" role="radiogroup" aria-label="Darstellung der Zugliste">
            <button type="button" role="radio" aria-checked={listView === 'cards'} className={listView === 'cards' ? 'seg is-active' : 'seg'} onClick={() => setListView('cards')}>Karten</button>
            <button type="button" role="radio" aria-checked={listView === 'table'} className={listView === 'table' ? 'seg is-active' : 'seg'} onClick={() => setListView('table')}>Tabelle</button>
          </div>
          {listView === 'cards' ? (
            <ol className="move-list">
              {solution.moves.map((m, i) => (
                <MoveCard key={i} index={i} move={m} stateAfter={solution.states[i + 1]} palette={palette} active={step === i + 1} onSelect={(idx) => setStep(idx + 1)} />
              ))}
            </ol>
          ) : (
            <div className="table-wrap">
              <table className="move-table">
                <thead>
                  <tr><th scope="col">Zug</th><th scope="col">Von</th><th scope="col">Nach</th><th scope="col">Farbe</th><th scope="col">Anzahl</th></tr>
                </thead>
                <tbody>
                  {solution.moves.map((m, i) => (
                    <tr key={i} className={step === i + 1 ? 'is-active' : undefined}>
                      <th scope="row"><button type="button" className="link-btn" onClick={() => setStep(i + 1)}>{i + 1}</button></th>
                      <td>{m.from + 1}</td>
                      <td>{m.to + 1}</td>
                      <td>{colorName(palette, m.color)}</td>
                      <td>{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <details className="card">
          <summary>Technische Details</summary>
          <ul>
            <li>Verfahren: {solution.algorithm}</li>
            <li>Untersuchte Zustände: {solution.statesExplored.toLocaleString('de-DE')}</li>
            <li>Rechenzeit: {(solution.elapsedMs / 1000).toFixed(2)} s</li>
            <li>Kürzeste Lösung garantiert: {solution.optimal ? 'ja' : 'nein'}</li>
            <li>Zugmodus: {solution.rules.mode === 'single' ? 'Einzelkugel' : 'Gleichfarbiger Block'}</li>
            <li>Unabhängige Prüfung: bestanden ({solution.moves.length} Züge, Endzustand gelöst)</li>
          </ul>
        </details>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'board', label: 'Spielfeld', icon: '◍' },
    { id: 'solution', label: 'Lösung', icon: '▶' },
    { id: 'settings', label: 'Einstellungen', icon: '⚙' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Magic Sort Solver</h1>
      </header>
      <main className="content">
        {tab === 'board' && boardTab}
        {tab === 'solution' && solutionTab}
        {tab === 'settings' && <SettingsPanel settings={settings} onChange={changeSettings} onClearData={clearData} />}
      </main>
      <nav className="tabbar" aria-label="Hauptnavigation">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab is-active' : 'tab'}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              window.scrollTo({ top: 0 });
            }}
          >
            <span aria-hidden="true" className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
