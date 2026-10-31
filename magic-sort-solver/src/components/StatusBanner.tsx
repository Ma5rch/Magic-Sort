export type StatusKind = 'idle' | 'busy' | 'ok' | 'warn' | 'error';

export interface StatusBannerProps {
  kind: StatusKind;
  text: string;
  detail?: string;
  onCancel?: () => void;
}

export function StatusBanner({ kind, text, detail, onCancel }: StatusBannerProps) {
  if (kind === 'idle' && !text) return null;
  return (
    <div className={`status status-${kind}`} role="status" aria-live="polite">
      {kind === 'busy' && <span className="spinner" aria-hidden="true" />}
      <div className="status-text">
        <strong>{text}</strong>
        {detail && <div className="muted">{detail}</div>}
      </div>
      {kind === 'busy' && onCancel && (
        <button type="button" className="btn" onClick={onCancel}>Abbrechen</button>
      )}
    </div>
  );
}
