// Fetch EDHREC's own JSON pages for learning, developer-side only. One
// request per second with a named User-Agent; every answer is cached under
// data/edhrec/ (gitignored) and refetched at most weekly. Nothing from these
// pages ships as such: learn-build.ts turns them into rounded numbers.
//
// Usage: npm run edhrec:fetch
//        --commanders <n>   most popular commanders by rank (default 1000), plus the corpus ones
//        --tags <n>         most popular theme pages (default 160)
//        --themes <n>       theme variants per commander, where a theme is large (default 2)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canBeCommander, CardIndex, parsePack, type CardRecord } from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { arg, CORPUS_FILE, loadCorpus, ROOT } from './corpus.ts';
import { cachePath, EDHREC_DIR, edhrecSlug, readPage } from './edhrec.ts';

const BASE = 'https://json.edhrec.com/pages/';
const WEEK = 7 * 24 * 3600 * 1000;
const GAP_MS = 1000;

const VERSION = (
  JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;
const USER_AGENT = `bulk-brew/${VERSION} (+https://github.com/xbadc0ffe/bulk-brew)`;

interface CacheEntry {
  at: number;
  status: number;
}

const INDEX_FILE = path.join(EDHREC_DIR, 'index.json');

function loadIndex(): Record<string, CacheEntry> {
  if (!existsSync(INDEX_FILE)) return {};
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as Record<string, CacheEntry>;
}

let last = 0;
async function politeFetch(url: string): Promise<Response> {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  return fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
}

async function main(): Promise<number> {
  const nCommanders = Number(arg('commanders') ?? 1000);
  const nTags = Number(arg('tags') ?? 160);
  const nThemes = Number(arg('themes') ?? 2);
  const index = new CardIndex(
    parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8')),
  );
  const cache = loadIndex();
  mkdirSync(EDHREC_DIR, { recursive: true });
  let fetched = 0;
  let saved = 0;
  const get = async <T>(page: string): Promise<T | undefined> => {
    const hit = cache[page];
    if (hit && Date.now() - hit.at < WEEK)
      return hit.status === 200 ? readPage<T>(page) : undefined;
    let res: Response;
    try {
      res = await politeFetch(`${BASE}${page}.json`);
    } catch (err) {
      console.warn(`  ${page}: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
    fetched++;
    cache[page] = { at: Date.now(), status: res.status };
    if (res.status !== 200) return undefined;
    const text = await res.text();
    const file = cachePath(page);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
    if (++saved % 25 === 0) writeFileSync(INDEX_FILE, JSON.stringify(cache));
    return JSON.parse(text) as T;
  };

  // Themes first: the popularity list, then each large theme's own page.
  interface ListPage {
    container: { json_dict: { cardlists: { cardviews: { url: string; num_decks: number }[] }[] } };
  }
  const tags = await get<ListPage>('tags');
  const tagSlugs = (tags?.container.json_dict.cardlists[0]?.cardviews ?? [])
    .slice(0, nTags)
    .map((v) => v.url.replace(/^\/tags\//, ''));
  console.log(`theme pages: ${tagSlugs.length}`);
  for (const slug of tagSlugs) await get(`tags/${slug}`);

  // Commanders: the most popular legal ones by rank, plus every commander in the corpus.
  const wanted = new Map<string, CardRecord>();
  const ranked = index.pack.cards
    .filter((c) => canBeCommander(c) && c.identity.length > 0 && c.rank !== undefined)
    .sort((a, b) => a.rank! - b.rank! || (a.id < b.id ? -1 : 1));
  for (const c of ranked.slice(0, nCommanders)) wanted.set(c.id, c);
  if (existsSync(CORPUS_FILE)) {
    for (const d of loadCorpus().decks)
      for (const id of d.commander ?? []) {
        const c = index.get(id);
        if (c) wanted.set(c.id, c);
      }
  }
  console.log(`commander pages: ${wanted.size}`);
  interface CommanderPage {
    container: { json_dict: { card?: { num_decks?: number } } };
    panels?: { taglinks?: { slug: string; count: number }[] };
  }
  const themeQueue: string[] = [];
  let n = 0;
  for (const card of wanted.values()) {
    const slug = edhrecSlug(card.name);
    const page = await get<CommanderPage>(`commanders/${slug}`);
    if (++n % 100 === 0) console.log(`  ${n}/${wanted.size} commanders, ${fetched} fetched`);
    if (!page) continue;
    const total = page.container.json_dict.card?.num_decks ?? 0;
    const big = (page.panels?.taglinks ?? [])
      .filter((t) => t.count >= Math.max(200, total * 0.2))
      .slice(0, nThemes);
    for (const t of big) themeQueue.push(`commanders/${slug}/${t.slug}`);
  }
  console.log(`theme variants: ${themeQueue.length}`);
  for (const page of themeQueue) await get(page);
  writeFileSync(INDEX_FILE, JSON.stringify(cache));
  console.log(`done: ${fetched} requests, cache at ${path.relative(ROOT, EDHREC_DIR)}`);
  return 0;
}

process.exitCode = await main();
