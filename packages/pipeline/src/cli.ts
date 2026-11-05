// Entry point for `npm run data:build`. Runs directly under Node 24 (type
// stripping), so this file and its imports must use erasable TypeScript only.
//
// Usage: node packages/pipeline/src/cli.ts [--raw data/raw] [--out data/packs]
//          [--overlay config/tag-overlay.json] [--repo owner/repo] [--version YYYY-MM-DD]

import path from 'node:path';
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildPack, PACK_FILE } from './build.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? fallback;
}

/** Vite serves public/ as-is, so each app gets a copy of the pack for local dev. */
const APP_PUBLIC_DIRS = ['apps/web/public/data', 'apps/mobile/public/data'];

async function main(): Promise<number> {
  const started = Date.now();
  const opts = {
    rawDir: path.resolve(ROOT, arg('raw', 'data/raw')),
    outDir: path.resolve(ROOT, arg('out', 'data/packs')),
    overlayPath: path.resolve(ROOT, arg('overlay', 'config/tag-overlay.json')),
    repo: arg('repo', 'xbadc0ffe/bulk-brew'),
    log: (m: string) => console.log(`  ${m}`),
  };
  const explicitVersion = arg('version', '');
  const report = await buildPack(explicitVersion ? { ...opts, version: explicitVersion } : opts);

  for (const dir of APP_PUBLIC_DIRS) {
    const target = path.resolve(ROOT, dir);
    await mkdir(target, { recursive: true });
    await copyFile(report.packPath, path.join(target, PACK_FILE));
    // The learned card data is committed; the apps serve it beside the pack.
    const learned = path.join(ROOT, 'data', 'learned.json');
    if (existsSync(learned)) await copyFile(learned, path.join(target, 'learned.json'));
  }

  const mb = (report.manifest.bytes / 1e6).toFixed(2);
  console.log(
    `pack ${report.version}: ${report.cardCount} cards (${report.skipped} skipped, ${report.unset} un-set, ${report.taggedCards} tagged)`,
  );
  console.log(
    `  ${path.relative(ROOT, report.gzPath)} ${mb} MB gz, sha256 ${report.manifest.sha256.slice(0, 12)}`,
  );
  if (report.overlayUnknown.length)
    console.log(`  overlay names not found: ${report.overlayUnknown.join(', ')}`);
  console.log(
    `  copied to ${APP_PUBLIC_DIRS.join(', ')} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  },
);
