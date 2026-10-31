import { describe, expect, it } from 'vitest';
import { analyzeImage } from '../vision/reconstructBoard';
import { clusterColors } from '../vision/classifyColors';
import { GAME_COLORS, renderBoard, sameUpToRelabeling } from './helpers';

const TUBES_10: number[][] = [
  [0, 0, 1, 2],
  [3, 3, 3, 4],
  [], // leeres Röhrchen mitten in der Reihe
  [5, 6, 6, 7],
  [1, 2, 2, 0],
  [4, 4, 5, 5],
  [7, 7, 6, 3],
  [1, 5, 4, 6],
  [0, 1, 2, 7],
  [], // leeres Röhrchen am rechten Rand
];

function detectedBalls(p: { tubes: { balls: number[] }[] } | null): number[][] {
  return (p?.tubes ?? []).map((t) => t.balls);
}

describe('Bilderkennung (synthetischer Screenshot)', () => {
  it('rekonstruiert 10 Röhrchen in 2 Reihen inkl. leerer Röhrchen und ähnlicher Farben', () => {
    const img = renderBoard({
      width: 400, height: 820, tubes: TUBES_10, colors: GAME_COLORS, cols: 5, x0: 60, pitch: 70, d: 44,
      rowBottoms: [330, 700], capacity: 4, bgTop: [70, 40, 130], bgBottom: [25, 15, 70],
      distractor: { x: 120, y: 760, w: 160, h: 40, color: [255, 140, 20] },
    });
    const r = analyzeImage(img);
    expect(r.success).toBe(true);
    expect(r.puzzle?.capacity).toBe(4);
    expect(r.puzzle?.tubes).toHaveLength(10);
    expect(sameUpToRelabeling(detectedBalls(r.puzzle), TUBES_10)).toBe(true);
    // genau 8 Farben, eindeutige Kennungen
    const ids = new Set(detectedBalls(r.puzzle).flat());
    expect(ids.size).toBe(8);
    // abgeleitete (nicht gesehene) Röhrchen sind gekennzeichnet
    expect(r.overlay.tubes.filter((t) => t.inferred)).toHaveLength(2);
  });

  it('andere Anordnung: eine Reihe, helles Türkis-Hintergrundbild, leeres Röhrchen links außen', () => {
    const tubes = [[], [0, 1, 2], [3, 3, 4], [4, 0, 0], [2, 1, 1], [3, 4, 2], [0, 3, 1]];
    const img = renderBoard({
      width: 520, height: 500, tubes, colors: GAME_COLORS, cols: 7, x0: 50, pitch: 70, d: 40,
      rowBottoms: [380], capacity: 3, bgTop: [120, 190, 200], bgBottom: [60, 130, 150],
    });
    const r = analyzeImage(img);
    expect(r.success).toBe(true);
    expect(sameUpToRelabeling(detectedBalls(r.puzzle), tubes)).toBe(true);
  });

  it('Nummerierung: links → rechts, danach oben → unten', () => {
    const img = renderBoard({
      width: 400, height: 820, tubes: TUBES_10, colors: GAME_COLORS, cols: 5, x0: 60, pitch: 70, d: 44,
      rowBottoms: [330, 700], capacity: 4, bgTop: [70, 40, 130], bgBottom: [25, 15, 70],
    });
    const r = analyzeImage(img);
    const xs = r.overlay.tubes.map((t) => t.x);
    const ys = r.overlay.tubes.map((t) => t.y);
    expect(xs.slice(0, 5)).toEqual([...xs.slice(0, 5)].sort((a, b) => a - b));
    expect(Math.max(...ys.slice(0, 5))).toBeLessThan(Math.min(...ys.slice(5)));
  });

  it('scheitert ehrlich bei einem Bild ohne Kugeln', () => {
    const img = renderBoard({
      width: 300, height: 300, tubes: [], colors: GAME_COLORS, cols: 1, x0: 0, pitch: 10, d: 30,
      rowBottoms: [], capacity: 4, bgTop: [30, 30, 30], bgBottom: [60, 60, 60],
    });
    const r = analyzeImage(img);
    expect(r.success).toBe(false);
    expect(r.puzzle).toBeNull();
    expect(r.messages[0].level).toBe('error');
  });

  it('Farbclustering trennt Orange/Rot, Blau/Türkis, Pink/Lila und fasst Schattierungen zusammen', () => {
    const pairs: [number, number, number][] = [
      [229, 57, 53], [200, 45, 42], [255, 143, 31], [235, 125, 25],
      [30, 99, 233], [25, 80, 200], [25, 195, 195], [20, 170, 170],
      [255, 95, 168], [225, 80, 150], [142, 68, 214], [120, 55, 190],
    ];
    const c = clusterColors(pairs);
    expect(c.centroids).toHaveLength(6);
    expect(c.assignment[0]).toBe(c.assignment[1]);
    expect(c.assignment[0]).not.toBe(c.assignment[2]);
    expect(c.assignment[4]).not.toBe(c.assignment[6]);
    expect(c.assignment[8]).not.toBe(c.assignment[10]);
  });
});
