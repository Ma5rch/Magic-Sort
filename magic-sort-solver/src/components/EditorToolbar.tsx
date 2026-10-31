export type EditMode = 'recolor' | 'add' | 'remove' | 'move';

const MODES: { id: EditMode; label: string; hint: string }[] = [
  { id: 'recolor', label: 'Ändern', hint: 'Tippe eine Kugel an: Sie bekommt die gewählte Farbe. Ein leerer Platz fügt oben eine Kugel ein.' },
  { id: 'add', label: 'Hinzufügen', hint: 'Tippe ein Röhrchen an: Eine Kugel in der gewählten Farbe wird oben eingefügt.' },
  { id: 'remove', label: 'Entfernen', hint: 'Tippe eine Kugel an, um sie zu entfernen. Kugeln darüber rutschen nach.' },
  { id: 'move', label: 'Verschieben', hint: 'Tippe erst das Quell-, dann das Zielröhrchen an: Die oberste Kugel wandert hinüber.' },
];

export interface EditorToolbarProps {
  mode: EditMode;
  onMode: (m: EditMode) => void;
  selectedTube: number | null;
  capacity: number;
  tubeCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onAddTube: () => void;
  onRemoveTube: () => void;
  onClearTube: () => void;
  onCapacity: (delta: number) => void;
  onReset: () => void;
  hint: string;
}

export function EditorToolbar(p: EditorToolbarProps) {
  const current = MODES.find((m) => m.id === p.mode) ?? MODES[0];
  const capLabel = p.selectedTube === null ? 'alle Röhrchen' : `Röhrchen ${p.selectedTube + 1}`;
  return (
    <div className="toolbar">
      <div className="segmented" role="radiogroup" aria-label="Bearbeitungsmodus">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={p.mode === m.id}
            className={p.mode === m.id ? 'seg is-active' : 'seg'}
            onClick={() => p.onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted">{current.hint}</p>
      <p className="muted">Kugeln werden von <strong>unten nach oben</strong> gespeichert; neue Kugeln kommen oben dazu.</p>
      <p className="hint" role="status" aria-live="polite">{p.hint}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={p.onAddTube}>＋ Röhrchen</button>
        <button type="button" className="btn" disabled={p.selectedTube === null || p.tubeCount <= 1} onClick={p.onRemoveTube}>
          − Röhrchen {p.selectedTube === null ? '' : p.selectedTube + 1}
        </button>
        <button type="button" className="btn" disabled={p.selectedTube === null} onClick={p.onClearTube}>
          Leeren
        </button>
        <button type="button" className="btn" disabled={!p.canUndo} onClick={p.onUndo}>↶ Rückgängig</button>
      </div>
      <div className="stepper">
        <span>Kapazität ({capLabel}):</span>
        <button type="button" className="btn btn-icon" aria-label="Kapazität verringern" onClick={() => p.onCapacity(-1)}>−</button>
        <strong aria-live="polite">{p.selectedTube === null ? p.capacity : '·'}</strong>
        <button type="button" className="btn btn-icon" aria-label="Kapazität erhöhen" onClick={() => p.onCapacity(1)}>＋</button>
      </div>
      <p className="muted">Tippe die Nummer eines Röhrchens, um es zu markieren (Entfernen, Leeren, einzelne Kapazität). Nochmal tippen hebt die Markierung auf.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-danger" onClick={p.onReset}>Level komplett zurücksetzen</button>
      </div>
    </div>
  );
}
