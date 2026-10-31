import type { ColorId } from './types';

export interface ColorDef {
  id: ColorId;
  name: string;
  /** Darstellungswert für die Oberfläche; die interne Identität ist `id`. */
  hex: string;
}

export const DEFAULT_PALETTE: ColorDef[] = [
  { id: 0, name: 'Rot', hex: '#e53935' },
  { id: 1, name: 'Blau', hex: '#1e63e9' },
  { id: 2, name: 'Grün', hex: '#2eb84b' },
  { id: 3, name: 'Gelb', hex: '#fbc02d' },
  { id: 4, name: 'Türkis', hex: '#19c3c3' },
  { id: 5, name: 'Pink', hex: '#ff5fa8' },
  { id: 6, name: 'Orange', hex: '#ff8f1f' },
  { id: 7, name: 'Lila', hex: '#8e44d6' },
  { id: 8, name: 'Braun', hex: '#8d5a3b' },
  { id: 9, name: 'Hellgrün', hex: '#9be564' },
  { id: 10, name: 'Grau', hex: '#9e9e9e' },
  { id: 11, name: 'Weiß', hex: '#f5f5f5' },
];

export function getColor(palette: ColorDef[], id: ColorId): ColorDef | undefined {
  return palette.find((c) => c.id === id);
}

export function colorName(palette: ColorDef[], id: ColorId): string {
  return getColor(palette, id)?.name ?? `Farbe ${id}`;
}

export function colorHex(palette: ColorDef[], id: ColorId): string {
  return getColor(palette, id)?.hex ?? '#888888';
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const x = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}
