import type { RGBAImage } from './types';

export interface LoadedImage {
  /** Objekt-URL des Originals (für die Vorschau in voller Qualität). */
  url: string;
  width: number;
  height: number;
  name: string;
  /** Verkleinerte Arbeitskopie für die Analyse. */
  analysis: RGBAImage;
}

/** Lädt ein Bild lokal (nichts wird hochgeladen). Hochauflösende Bilder werden nur für die Analyse verkleinert. */
export async function loadScreenshot(file: File, maxAnalysisSide = 1100): Promise<LoadedImage> {
  const looksLikeImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) throw new Error('Bitte wähle eine Bilddatei (PNG oder JPEG) aus.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('empty');
    const scale = Math.min(1, maxAnalysisSide / Math.max(width, height));
    const cw = Math.max(1, Math.round(width * scale));
    const ch = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no-canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch);
    return { url, width, height, name: file.name, analysis: { width: cw, height: ch, data: data.data } };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Das Bild konnte nicht geladen werden. Unterstützt werden PNG und JPEG; wähle bei Fotos am besten „Screenshot“ oder ein Standardformat.');
  }
}
