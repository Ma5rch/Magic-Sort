import { useEffect, useState, type CSSProperties } from 'react';
import { clampStep, describeMove, stateAt } from '../state/playback';
import type { ColorDef } from '../solver/palette';
import type { Move, PuzzleState } from '../solver/types';
import { PuzzleBoard } from './PuzzleBoard';

export interface SolutionPlayerProps {
  states: PuzzleState[];
  moves: Move[];
  palette: ColorDef[];
  step: number;
  onStep: (step: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

/** Der angezeigte Zustand ist immer states[step] – Animation und Daten können nicht auseinanderlaufen. */
export function SolutionPlayer({ states, moves, palette, step, onStep }: SolutionPlayerProps) {
  const total = moves.length;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => onStep(clampStep(step + 1, total)), 900 / speed);
    return () => window.clearTimeout(id);
  }, [playing, step, speed, total, onStep]);

  const state = stateAt(states, step);
  const move = step > 0 ? moves[step - 1] : null;
  const d = move ? describeMove(move, palette) : null;

  const go = (s: number) => {
    setPlaying(false);
    onStep(clampStep(s, total));
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= total) onStep(0);
    setPlaying(true);
  };

  return (
    <section className="card player" aria-labelledby="h-player" style={{ '--anim-ms': `${Math.round(350 / speed)}ms` } as CSSProperties}>
      <h2 id="h-player">Lösung nachspielen</h2>
      <p className="step-info" role="status" aria-live="polite">
        {move && d
          ? <>Zug {step} von {total}: {d.route} · {d.color} · {d.count} Kugel{d.count === 1 ? '' : 'n'}</>
          : <>Ausgangszustand · {total} Züge bis zur Lösung</>}
      </p>
      <PuzzleBoard
        puzzle={state}
        palette={palette}
        source={move ? move.from : null}
        target={move ? move.to : null}
        arrived={move ? { tube: move.to, count: move.count } : null}
      />
      <div className="controls" role="group" aria-label="Wiedergabe">
        <button type="button" className="btn btn-icon" aria-label="Ersten Zug anzeigen" disabled={step === 0} onClick={() => go(0)}>⏮</button>
        <button type="button" className="btn btn-icon" aria-label="Vorheriger Zug" disabled={step === 0} onClick={() => go(step - 1)}>◀</button>
        <button type="button" className="btn btn-primary btn-play" onClick={togglePlay}>
          {playing ? '⏸ Pause' : step >= total ? '↻ Von vorn' : '▶ Abspielen'}
        </button>
        <button type="button" className="btn btn-icon" aria-label="Nächster Zug" disabled={step >= total} onClick={() => go(step + 1)}>▶</button>
        <button type="button" className="btn btn-icon" aria-label="Letzten Zug anzeigen" disabled={step >= total} onClick={() => go(total)}>⏭</button>
      </div>
      <label className="speed">
        Geschwindigkeit
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </section>
  );
}
