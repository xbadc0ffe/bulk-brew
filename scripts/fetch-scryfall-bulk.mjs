#!/usr/bin/env node
// Downloads the Scryfall bulk files the pipeline needs into data/raw/.
// Skips files whose Scryfall `updated_at` has not changed. Pass --force to
// re-download everything. Scryfall asks for a descriptive User-Agent, an
// Accept header, and a short pause between requests; all three are honored.

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const META_PATH = path.join(RAW_DIR, 'bulk-meta.json');
const BULK_TYPES = ['oracle_cards', 'oracle_tags', 'rulings'];
const USER_AGENT = 'bulk-brew/0.1 (+https://github.com/xbadc0ffe/bulk-brew)';
const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
const PAUSE_MS = 150;

const force = process.argv.includes('--force');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readMeta() {
  try {
    return JSON.parse(await readFile(META_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
  if (!res.ok || !res.body) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, dest);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const meta = await readMeta();

  const res = await fetch('https://api.scryfall.com/bulk-data', { headers: HEADERS });
  if (!res.ok) throw new Error(`bulk-data listing failed: ${res.status} ${res.statusText}`);
  const listing = await res.json();
  const byType = new Map(listing.data.map((item) => [item.type, item]));

  for (const type of BULK_TYPES) {
    const item = byType.get(type);
    if (!item) throw new Error(`Scryfall bulk listing has no "${type}" entry`);
    const url = item.jsonl_download_uri ?? item.download_uri;
    if (!url) throw new Error(`"${type}" has no download URI`);
    const ext = url.endsWith('.jsonl.gz') ? '.jsonl.gz' : '.json';
    const dest = path.join(RAW_DIR, `${type}${ext}`);
    const unchanged = meta[type]?.updated_at === item.updated_at && existsSync(dest);

    if (unchanged && !force) {
      console.log(`${type}: up to date (${item.updated_at})`);
      continue;
    }
    const mb = ((item.compressed_size ?? item.size ?? 0) / 1e6).toFixed(1);
    console.log(`${type}: downloading ${mb} MB from ${url}`);
    await sleep(PAUSE_MS);
    await download(url, dest);
    meta[type] = { updated_at: item.updated_at, url, file: path.basename(dest) };
    await writeFile(META_PATH, JSON.stringify(meta, null, 2) + '\n');
    console.log(`${type}: saved ${path.relative(ROOT, dest)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
