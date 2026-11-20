import { createHash } from 'node:crypto';
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

/**
 * Writes data/pack-manifest.json beside the card data the build copied from public/,
 * so the site and the iOS bundle each describe exactly the files they carry. The iOS
 * app reads it to decide cheaply whether the site has newer card data
 * (PackManifest in packages/ui/src/data/packUpdate.ts).
 */
function packManifest(): Plugin {
  let dataDir = 'dist/data';
  return {
    name: 'bulk-brew-pack-manifest',
    apply: 'build',
    configResolved(config) {
      dataDir = path.resolve(config.root, config.build.outDir, 'data');
    },
    closeBundle() {
      const read = (name: string) => {
        const file = path.join(dataDir, name);
        return existsSync(file) ? readFileSync(file) : undefined;
      };
      const cards = read('cards.json');
      const learned = read('learned.json');
      // A build without the data (npm run data:pull) has nothing to describe.
      if (!cards || !learned) return;
      const info = (bytes: Buffer) => ({
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      const pack = JSON.parse(cards.toString('utf8')) as {
        schema: number;
        version: string;
        cardCount: number;
      };
      const learnedFile = JSON.parse(learned.toString('utf8')) as {
        schema: number;
        version: string;
      };
      const manifest = {
        schema: pack.schema,
        version: pack.version,
        cardCount: pack.cardCount,
        learned: { schema: learnedFile.schema, version: learnedFile.version },
        files: { 'cards.json': info(cards), 'learned.json': info(learned) },
      };
      writeFileSync(path.join(dataDir, 'pack-manifest.json'), `${JSON.stringify(manifest)}\n`);
    },
  };
}

// BASE_PATH is set by the GitHub Pages workflow (/bulk-brew/). Local dev uses /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), serviceWorkerAssets(), packManifest()],
  define: {
    // A new id per build gives the service worker a fresh shell cache.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  server: { port: 5173 },
});
