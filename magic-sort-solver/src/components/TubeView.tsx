import type { CSSProperties } from 'react';
import { colorHex, colorName, type ColorDef } from '../solver/palette';
import type { Tube } from '../solver/types';

export interface TubeViewProps {
  tube: Tube;
  index: number;
  palette: ColorDef[];
  mini?: boolean;
  /** Hervorhebung als Quelle/Ziel eines Zuges (mit Textmarke, nicht nur Farbe). */
  role?: 'source' | 'target' | null;
  /** Vom Nutzer markiertes Röhrchen (Werkzeugleiste wirkt darauf). */
  selected?: boolean;
  /** Anzahl der obersten Kugeln, die gerade „angekommen“ sind (Animation). */
  arrivedCount?: number;
  onTubeTap?: (index: number) => void;
  onBallTap?: (index: number, pos: number) => void;
  onLabelTap?: (index: number) => void;
}

export function TubeView({
  tube,
  index,
  palette,
  mini = false,
  role = null,
  selected = false,
  arrivedCount = 0,
  onTubeTap,
  onBallTap,
  onLabelTap,
}: TubeViewProps) {
  const n = index + 1;
  const interactive = !mini && Boolean(onTubeTap || onBallTap);
  const slots = Array.from({ length: tube.capacity }, (_, pos) => pos);
  const summary =
    tube.balls.length === 0
      ? 'leer'
      : `${tube.balls.map((b) => colorName(palette, b)).join(', ')} (unten nach oben)`;
  const cls = ['tube', mini ? 'tube-mini' : '', role ? `is-${role}` : '', selected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} data-tube={index}>
      {!mini && (
        <div className="tube-head">
          {onLabelTap ? (
            <button
              type="button"
              className="tube-label"
              aria-pressed={selected}
              aria-label={`Röhrchen ${n} markieren`}
              onClick={() => onLabelTap(index)}
            >
              {n}
            </button>
          ) : (
            <span className="tube-label tube-label-static">{n}</span>
          )}
          {role && <span className="tube-role">{role === 'source' ? 'Von' : 'Nach'}</span>}
        </div>
      )}
      <div className="tube-body" role="group" aria-label={mini ? undefined : `Röhrchen ${n}: ${summary}`} aria-hidden={mini || undefined}>
        {slots.map((pos) => {
          const color = tube.balls[pos];
          if (color === undefined) {
            return interactive ? (
              <button
                key={pos}
                type="button"
                className="slot"
                aria-label={`Leerer Platz in Röhrchen ${n}`}
                onClick={() => onTubeTap?.(index)}
              />
            ) : (
              <span key={pos} className="slot" />
            );
          }
          const uncertain = Boolean(tube.uncertain?.[pos]);
          const arrived = pos >= tube.balls.length - arrivedCount;
          const style = { '--c': colorHex(palette, color) } as CSSProperties;
          const ballCls = ['ball', uncertain ? 'is-uncertain' : '', arrived && arrivedCount > 0 ? 'arrived' : '']
            .filter(Boolean)
            .join(' ');
          const label = `Röhrchen ${n}, Position ${pos + 1} von unten: ${colorName(palette, color)}${uncertain ? ', unsichere Erkennung' : ''}`;
          return interactive ? (
            <button
              key={pos}
              type="button"
              className={ballCls}
              style={style}
              aria-label={label}
              onClick={() => (onBallTap ? onBallTap(index, pos) : onTubeTap?.(index))}
            >
              {uncertain && <span aria-hidden="true">?</span>}
            </button>
          ) : (
            <span key={pos} className={ballCls} style={style}>
              {uncertain && !mini && <span aria-hidden="true">?</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
