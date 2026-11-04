#!/usr/bin/env node
// Downloads Scryfall's card symbol images ({W}, {T}, {2/U}, ...) into
// packages/ui/src/symbols/ with an index of symbol -> file and plain name.
// The files are committed; run this again only when new symbols appear.

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages', 'ui', 'src', 'symbols');
const USER_AGENT = 'bulk-brew/0.1 (+https://github.com/xbadc0ffe/bulk-brew)';
const PAUSE_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const res = await fetch('https://api.scryfall.com/symbology', {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`symbology listing failed: ${res.status} ${res.statusText}`);
  const listing = await res.json();

  await mkdir(OUT, { recursive: true });
  for (const f of await readdir(OUT)) if (f.endsWith('.svg')) await rm(path.join(OUT, f));

  const index = {};
  for (const s of listing.data) {
    if (!s.svg_uri) continue;
    const file = path.basename(new URL(s.svg_uri).pathname);
    const svg = await fetch(s.svg_uri, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
    if (!svg.ok) throw new Error(`GET ${s.svg_uri} failed: ${svg.status} ${svg.statusText}`);
    await writeFile(path.join(OUT, file), await svg.text());
    // Key without braces: "W", "2/U", "T".
    index[s.symbol.slice(1, -1)] = { file, name: s.english };
    await sleep(PAUSE_MS);
  }
  await writeFile(path.join(OUT, 'symbols.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(index).length} symbols to ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
