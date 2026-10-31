import type { CSSProperties } from 'react';
import { colorHex, type ColorDef } from '../solver/palette';
import type { LoadedImage } from '../vision/loadImage';
import type { DetectionResult } from '../vision/types';

export interface ImageUploaderProps {
  image: LoadedImage | null;
  overlay: DetectionResult['overlay'] | null;
  palette: ColorDef[];
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onAnalyze: () => void;
  onManual: () => void;
  onExample: () => void;
}

export function ImageUploader({ image, overlay, palette, busy, error, onFile, onAnalyze, onManual, onExample }: ImageUploaderProps) {
  const showOverlay = overlay && overlay.balls.length > 0;
  const r = overlay?.balls[0]?.r ?? 20;
  return (
    <section className="card" aria-labelledby="h-import">
      <h2 id="h-import">1 · Screenshot</h2>
      <input
        id="file-input"
        className="file-input"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ''; // dasselbe Bild kann erneut gewählt werden
        }}
      />
      <div className="btn-row">
        <label htmlFor="file-input" className="btn btn-primary">
          {image ? 'Anderen Screenshot auswählen' : 'Screenshot auswählen'}
        </label>
      </div>
      {error && <p className="msg msg-error" role="alert">{error}</p>}
      {image ? (
        <figure className="preview">
          <div className="preview-frame">
            <img src={image.url} alt="Ausgewählter Screenshot" width={image.width} height={image.height} />
            {showOverlay && overlay && (
              <svg viewBox={`0 0 ${overlay.width} ${overlay.height}`} className="overlay" aria-hidden="true">
                {overlay.balls.map((b, i) => (
                  <g key={i}>
                    <circle cx={b.x} cy={b.y} r={b.r * 0.62} fill={colorHex(palette, b.colorId)} />
                    <circle
                      cx={b.x}
                      cy={b.y}
                      r={b.r * 0.95}
                      fill="none"
                      stroke={b.uncertain ? '#ff9f0a' : '#ffffff'}
                      strokeWidth={b.r * (b.uncertain ? 0.2 : 0.1)}
                      strokeDasharray={b.uncertain ? `${b.r * 0.4} ${b.r * 0.3}` : undefined}
                    />
                  </g>
                ))}
                {overlay.tubes.map((t) => (
                  <text
                    key={t.index}
                    x={t.x}
                    y={t.y + r * 2.1}
                    textAnchor="middle"
                    fontSize={r * 0.9}
                    fontWeight="700"
                    fill={t.inferred ? '#ff9f0a' : '#ffffff'}
                    stroke="#000000"
                    strokeWidth={r * 0.12}
                    paintOrder="stroke"
                  >
                    {t.index + 1}
                    {t.inferred ? '?' : ''}
                  </text>
                ))}
              </svg>
            )}
          </div>
          <figcaption className="muted">
            {image.name} · {image.width} × {image.height} px
            {showOverlay ? ' · Kreise zeigen die erkannten Kugeln, orange = unsicher' : ''}
          </figcaption>
        </figure>
      ) : (
        <p className="muted">Wähle einen vorhandenen Screenshot aus der Fotos- oder Dateien-App. Er wird nur auf diesem Gerät verarbeitet.</p>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={!image || busy} onClick={onAnalyze}>
          Screenshot analysieren
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onManual}>
          Level manuell eingeben
        </button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={onExample}>
          Beispiellevel laden
        </button>
      </div>
    </section>
  );
}
