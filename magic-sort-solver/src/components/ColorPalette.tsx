import type { CSSProperties } from 'react';
import type { ColorDef } from '../solver/palette';

export interface ColorPaletteProps {
  palette: ColorDef[];
  selected: number;
  onSelect: (id: number) => void;
}

export function ColorPalette({ palette, selected, onSelect }: ColorPaletteProps) {
  const current = palette.find((c) => c.id === selected);
  return (
    <div className="palette-wrap">
      <div className="palette" role="radiogroup" aria-label="Farbpalette">
        {palette.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === selected}
            aria-label={c.name}
            className={c.id === selected ? 'swatch is-active' : 'swatch'}
            style={{ '--c': c.hex } as CSSProperties}
            onClick={() => onSelect(c.id)}
          >
            {c.id === selected && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
      <p className="muted palette-name">Gewählte Farbe: <strong>{current?.name ?? '–'}</strong></p>
    </div>
  );
}
