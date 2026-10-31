import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/**
 * Erzeugt nach dem Build `sw.js` aus pwa/sw-template.js: Liste aller Dateien aus dist/ (inkl. Worker,
 * Manifest, Icons) zum Vorab-Cachen plus eine Versionskennung aus den Dateiinhalten.
 */
function pwaPlugin(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();
  return {
    name: 'magic-sort-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      const files = walk(outDir)
        .map((f) => path.relative(outDir, f).split(path.sep).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha1');
      for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const template = fs.readFileSync(path.resolve(root, 'pwa/sw-template.js'), 'utf8');
      const sw = template
        .split('__VERSION__')
        .join(hash.digest('hex').slice(0, 12))
        .split('__PRECACHE__')
        .join(JSON.stringify(files));
      if (sw.includes('__VERSION__') || sw.includes('__PRECACHE__')) {
        throw new Error('Service-Worker-Vorlage: Platzhalter wurden nicht vollständig ersetzt.');
      }
      fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  // Relative Pfade: funktioniert auf jedem Hosting, auch in einem Unterordner (z. B. GitHub Pages).
  base: './',
  plugins: [react(), pwaPlugin()],
  build: { target: 'es2020', sourcemap: false },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
