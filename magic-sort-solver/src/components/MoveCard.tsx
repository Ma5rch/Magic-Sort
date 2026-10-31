import { describeMove } from '../state/playback';
import type { ColorDef } from '../solver/palette';
import type { Move, PuzzleState } from '../solver/types';
import { PuzzleBoard } from './PuzzleBoard';

export interface MoveCardProps {
  index: number;
  move: Move;
  /** Zustand nach diesem Zug (Miniaturansicht). */
  stateAfter: PuzzleState;
  palette: ColorDef[];
  active: boolean;
  onSelect: (index: number) => void;
}

export function MoveCard({ index, move, stateAfter, palette, active, onSelect }: MoveCardProps) {
  const d = describeMove(move, palette);
  return (
    <li>
      <button
        type="button"
        className={active ? 'move-card is-active' : 'move-card'}
        aria-current={active ? 'step' : undefined}
        onClick={() => onSelect(index)}
      >
        <span className="move-title">Zug {index + 1}</span>
        <span className="move-text">{d.route}.</span>
        <span className="move-text">Farbe: {d.color}.</span>
        <span className="move-text">Anzahl der Kugeln: {d.count}.</span>
        <span className="move-mini" aria-hidden="true">
          <PuzzleBoard puzzle={stateAfter} palette={palette} mini source={move.from} target={move.to} />
        </span>
      </button>
    </li>
  );
}
