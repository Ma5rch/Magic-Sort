import type { ColorDef } from '../solver/palette';
import type { PuzzleState } from '../solver/types';
import { TubeView } from './TubeView';

export interface PuzzleBoardProps {
  puzzle: PuzzleState;
  palette: ColorDef[];
  mini?: boolean;
  source?: number | null;
  target?: number | null;
  selectedTube?: number | null;
  arrived?: { tube: number; count: number } | null;
  onTubeTap?: (index: number) => void;
  onBallTap?: (index: number, pos: number) => void;
  onLabelTap?: (index: number) => void;
}

/** Röhrchen von links nach rechts, danach zeilenweise von oben nach unten (Umbruch automatisch). */
export function PuzzleBoard({
  puzzle,
  palette,
  mini = false,
  source = null,
  target = null,
  selectedTube = null,
  arrived = null,
  onTubeTap,
  onBallTap,
  onLabelTap,
}: PuzzleBoardProps) {
  return (
    <div className={mini ? 'board board-mini' : 'board'}>
      {puzzle.tubes.map((tube, i) => (
        <TubeView
          key={i}
          tube={tube}
          index={i}
          palette={palette}
          mini={mini}
          role={i === source ? 'source' : i === target ? 'target' : null}
          selected={selectedTube === i}
          arrivedCount={arrived && arrived.tube === i ? arrived.count : 0}
          onTubeTap={onTubeTap}
          onBallTap={onBallTap}
          onLabelTap={onLabelTap}
        />
      ))}
    </div>
  );
}
