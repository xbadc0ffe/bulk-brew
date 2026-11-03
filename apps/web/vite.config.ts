import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Writes the emitted asset paths into the service worker, so its install step
 * caches the whole app shell and the app opens offline after one visit.
 */
function serviceWorkerAssets(): Plugin {
  let base = '/';
  let outDir = 'dist';
  let assets: string[] = [];
  return {
    name: 'bulk-brew-sw-assets',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((file) => file.startsWith('assets/'))
        .map((file) => base + file);
    },
    closeBundle() {
      const file = path.join(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const source = readFileSync(file, 'utf8');
      const marker = '/* @assets */ []';
      if (!source.includes(marker)) throw new Error('sw.js is missing the @assets marker');
      writeFileSync(file, source.replace(marker, JSON.stringify(assets)));
    },
  };
}

// BASE_PATH is set by the GitHub Pages workflow (/bulk-brew/). Local dev uses /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), serviceWorkerAssets()],
  define: {
    // A new id per build gives the service worker a fresh shell cache.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  server: { port: 5173 },
});
