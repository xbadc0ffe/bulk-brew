#!/usr/bin/env node
// Downloads the data pack pinned in data/manifest.json, verifies its checksum,
// and installs it where the apps serve it from. Used by the deploy workflow
// and by anyone who does not want to run the full pipeline locally.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS_DIR = path.join(ROOT, 'data', 'packs');
const APP_PUBLIC_DIRS = ['apps/web/public/data', 'apps/mobile/public/data'];

async function main() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'data', 'manifest.json'), 'utf8'));
  const file = path.basename(new URL(manifest.url).pathname);
  console.log(`downloading data pack ${manifest.version} from ${manifest.url}`);

  const res = await fetch(manifest.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const gz = Buffer.from(await res.arrayBuffer());

  const sha = createHash('sha256').update(gz).digest('hex');
  if (sha !== manifest.sha256)
    throw new Error(`checksum mismatch: got ${sha}, want ${manifest.sha256}`);

  await mkdir(PACKS_DIR, { recursive: true });
  await writeFile(path.join(PACKS_DIR, file), gz);
  const json = gunzipSync(gz);
  // Installed under a fixed name whatever the schema; keep in sync with PACK_FILE in packages/pipeline/src/build.ts.
  const plain = 'cards.json';
  await writeFile(path.join(PACKS_DIR, plain), json);
  for (const dir of APP_PUBLIC_DIRS) {
    const target = path.join(ROOT, dir);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, plain), json);
  }
  console.log(
    `installed ${plain} (${manifest.cardCount} cards) into data/packs and ${APP_PUBLIC_DIRS.join(', ')}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
