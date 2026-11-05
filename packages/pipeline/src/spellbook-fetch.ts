// Download Commander Spellbook's bulk combo file into data/spellbook/
// (gitignored), at most weekly. The file is made for third parties; the live
// API asks not to be used for a full export. Credit: Commander Spellbook,
// https://commanderspellbook.com.
//
// Usage: npm run spellbook:fetch [--force]

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { flag, ROOT, USER_AGENT } from './corpus.ts';
import { SPELLBOOK_DIR, SPELLBOOK_FILE, SPELLBOOK_URL } from './spellbook.ts';

const WEEK = 7 * 24 * 3600 * 1000;

async function main(): Promise<number> {
  if (existsSync(SPELLBOOK_FILE) && !flag('force')) {
    const age = Date.now() - statSync(SPELLBOOK_FILE).mtimeMs;
    if (age < WEEK) {
      console.log(`${path.relative(ROOT, SPELLBOOK_FILE)} is under a week old; --force to refetch`);
      return 0;
    }
  }
  mkdirSync(SPELLBOOK_DIR, { recursive: true });
  console.log(`downloading ${SPELLBOOK_URL}`);
  // Ask for the raw bytes: the host sends the file with a gzip content encoding.
  const res = await fetch(SPELLBOOK_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity' },
  });
  if (!res.ok) {
    console.error(`download failed: ${res.status} ${res.statusText}`);
    return 1;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // fetch may have decoded the gzip already; keep the file gzipped either way.
  const gz = buf[0] === 0x1f && buf[1] === 0x8b ? buf : (await import('node:zlib')).gzipSync(buf);
  writeFileSync(SPELLBOOK_FILE, gz);
  console.log(`wrote ${path.relative(ROOT, SPELLBOOK_FILE)} (${(gz.length / 1e6).toFixed(1)} MB)`);
  return 0;
}

process.exitCode = await main();
