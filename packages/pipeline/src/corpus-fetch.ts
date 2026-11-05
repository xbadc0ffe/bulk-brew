// Build the reference deck corpus in data/corpus/decks.json.
//
// Usage: npm run corpus:fetch                         preconstructed decks (100, 60, 20)
//        npm run corpus:fetch -- --drafts FDN,DSK     also Arena draft decks for these sets (40)
//        npm run corpus:fetch -- --local test-bulk    also the owner's test_deck-*.txt lists
//        --force re-downloads; --draft-max <n> caps draft decks per set (default 3000)
//
// Sources: MTGJSON's AllDeckFiles (MIT license) for every official
// preconstructed deck, and 17lands' public game data for draft decks with
// their wins. Each file is downloaded once, one request at a time, with a
// descriptive User-Agent. Nothing here is committed or shipped in the app.

import {
  createReadStream,
  createWriteStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import {
  CardIndex,
  canBeCommander,
  parseDecklist,
  parsePack,
  type DeckSize,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import {
  arg,
  CORPUS_DIR,
  CORPUS_FILE,
  CORPUS_RAW,
  flag,
  hash32,
  readTar,
  ROOT,
  splitCsvLine,
  USER_AGENT,
  type Corpus,
  type CorpusDeck,
} from './corpus.ts';

const DECKS_URL = 'https://mtgjson.com/api/v5/AllDeckFiles.tar.gz';
const DRAFT_URL = (set: string) =>
  `https://17lands-public.s3.amazonaws.com/analysis_data/game_data/game_data_public.${set}.PremierDraft.csv.gz`;
const MAX_AGE_DAYS = 7;
const PAUSE_MS = 1000;

/** Product types whose decks are playable on their own, as the app's sizes mean them. */
const KEEP_TYPES = new Set([
  'Commander Deck',
  'MTGO Commander Deck',
  'Jumpstart',
  'Theme Deck',
  'Intro Pack',
  'Arena Starter Deck',
  'Arena Starter Kit',
  'Duel Deck',
  'Planeswalker Deck',
  'Event Deck',
  'Challenger Deck',
  'Pioneer Challenger Deck',
  'Starter Deck',
  'Starter Kit',
  'Game Night Deck',
  'Guild Kit',
  'Clash Pack',
  'Enhanced Deck',
  'Advanced Deck',
  'World Championship Deck',
  'Pro Tour Deck',
  'Modern Event Deck',
  'Premium Deck',
  'Duel Of The Planeswalkers Deck',
  'Spellslinger Starter Kit',
  'Welcome Deck',
]);
const DECK_SIZES = new Set<number>([100, 60, 40, 20]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url: string, dest: string, force: boolean): Promise<void> {
  if (!force && existsSync(dest)) {
    const ageDays = (Date.now() - statSync(dest).mtimeMs) / 86_400_000;
    if (ageDays < MAX_AGE_DAYS) {
      console.log(`  kept ${path.basename(dest)} (${ageDays.toFixed(1)} days old)`);
      return;
    }
  }
  const t0 = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
  if (!res.ok || !res.body) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
  const mb = statSync(dest).size / 1e6;
  console.log(
    `  downloaded ${path.basename(dest)}: ${mb.toFixed(0)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
  await sleep(PAUSE_MS);
}

class Resolver {
  readonly unresolved = new Map<string, number>();
  private readonly byName = new Map<string, string | undefined>();
  private readonly index: CardIndex;
  constructor(index: CardIndex) {
    this.index = index;
  }

  /** An oracle id from MTGJSON's identifiers, else by name. */
  id(name: string, oracleId?: string): string | undefined {
    if (oracleId && this.index.get(oracleId)) return oracleId;
    let id = this.byName.get(name);
    if (!this.byName.has(name)) {
      id = this.index.find(name)?.id;
      this.byName.set(name, id);
    }
    if (!id) this.unresolved.set(name, (this.unresolved.get(name) ?? 0) + 1);
    return id;
  }
}

interface MtgjsonCard {
  name: string;
  count: number;
  identifiers?: { scryfallOracleId?: string };
}
interface MtgjsonDeck {
  code: string;
  name: string;
  type: string;
  releaseDate?: string;
  commander?: MtgjsonCard[];
  mainBoard: MtgjsonCard[];
}

function addCount(map: Map<string, number>, id: string, n: number): void {
  map.set(id, (map.get(id) ?? 0) + n);
}

async function precons(resolve: Resolver, force: boolean): Promise<CorpusDeck[]> {
  const dest = path.join(CORPUS_RAW, 'AllDeckFiles.tar.gz');
  console.log('preconstructed decks:');
  await download(DECKS_URL, dest, force);
  const out: CorpusDeck[] = [];
  let seen = 0;
  for await (const entry of readTar(createReadStream(dest).pipe(createGunzip()))) {
    if (!entry.name.endsWith('.json')) continue;
    seen++;
    const deck = (JSON.parse(entry.data.toString('utf8')) as { data: MtgjsonDeck }).data;
    if (!KEEP_TYPES.has(deck.type)) continue;
    const commander = (deck.commander ?? [])
      .map((c) => resolve.id(c.name, c.identifiers?.scryfallOracleId))
      .filter((x): x is string => !!x);
    const main = new Map<string, number>();
    let missing = 0;
    for (const c of deck.mainBoard) {
      const id = resolve.id(c.name, c.identifiers?.scryfallOracleId);
      if (id) addCount(main, id, c.count);
      else missing += c.count;
    }
    const total =
      [...main.values()].reduce((a, b) => a + b, 0) + missing + (deck.commander?.length ?? 0);
    if (!DECK_SIZES.has(total) || missing > 0) continue;
    // A 100-card deck without a named commander is not a Commander deck.
    if (total === 100 && commander.length === 0) continue;
    const file = path.basename(entry.name, '.json');
    out.push({
      id: `precon:${file}`,
      source: 'precon',
      kind: deck.type,
      name: deck.name,
      ...(deck.releaseDate ? { released: deck.releaseDate } : {}),
      size: total as DeckSize,
      ...(commander.length ? { commander } : {}),
      cards: [...main.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    });
  }
  console.log(`  ${out.length} decks kept of ${seen} files`);
  return out;
}

async function drafts(
  set: string,
  resolve: Resolver,
  force: boolean,
  max: number,
): Promise<CorpusDeck[]> {
  const dest = path.join(CORPUS_RAW, `game_data_public.${set}.PremierDraft.csv.gz`);
  console.log(`draft decks, ${set}:`);
  await download(DRAFT_URL(set), dest, force);
  const lines = createInterface({
    input: createReadStream(dest).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let header: string[] | undefined;
  let deckCols: { col: number; id: string }[] = [];
  let iDraft = -1;
  let iBuild = -1;
  let iWon = -1;
  // One entry per draft and build: the deck from its first game, plus its record.
  const builds = new Map<string, { cards: [string, number][]; wins: number; games: number }>();
  let rows = 0;
  for await (const line of lines) {
    if (!header) {
      header = splitCsvLine(line);
      iDraft = header.indexOf('draft_id');
      iBuild = header.indexOf('build_index');
      iWon = header.indexOf('won');
      deckCols = [];
      header.forEach((h, col) => {
        if (!h.startsWith('deck_')) return;
        const id = resolve.id(h.slice(5));
        if (id) deckCols.push({ col, id });
      });
      if (iDraft < 0 || iWon < 0 || deckCols.length === 0)
        throw new Error(`${set}: unexpected columns in the game data`);
      continue;
    }
    rows++;
    // Data rows hold no quoted fields, so a plain split is safe and much faster.
    let f = line.split(',');
    if (f.length !== header.length) f = splitCsvLine(line);
    const key = `${f[iDraft]}:${iBuild >= 0 ? f[iBuild] : '0'}`;
    let b = builds.get(key);
    if (!b) {
      const cards: [string, number][] = [];
      for (const { col, id } of deckCols) {
        const n = Number(f[col]);
        if (n > 0) cards.push([id, n]);
      }
      b = { cards, wins: 0, games: 0 };
      builds.set(key, b);
    }
    b.games++;
    if (f[iWon] === 'True') b.wins++;
  }
  const out: CorpusDeck[] = [];
  for (const [key, b] of builds) {
    const total = b.cards.reduce((n, [, q]) => n + q, 0);
    if (total !== 40 || b.games < 3) continue;
    out.push({
      id: `draft:${set}:${key}`,
      source: 'draft',
      kind: 'Draft',
      name: `${set} draft ${key.slice(0, 8)}`,
      size: 40,
      cards: b.cards.sort((x, y) => (x[0] < y[0] ? -1 : 1)),
      wins: b.wins,
      games: b.games,
    });
  }
  // A fixed sample keeps the corpus small; the hash makes it the same sample every time.
  out.sort((a, b) => hash32(a.id) - hash32(b.id) || (a.id < b.id ? -1 : 1));
  const kept = out.slice(0, max);
  console.log(
    `  ${rows} games, ${builds.size} builds, ${out.length} with 40 cards and 3+ games, kept ${kept.length}`,
  );
  return kept;
}

/** The owner's lists: test_deck-*.txt, commander on the last line. */
function local(dir: string, index: CardIndex, resolve: Resolver): CorpusDeck[] {
  const out: CorpusDeck[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => /^test_deck-.*\.txt$/.test(f))
    .sort()) {
    const lines = parseDecklist(readFileSync(path.join(dir, file), 'utf8')).lines;
    const main = new Map<string, number>();
    const commander: string[] = [];
    // Moxfield exports put the commander alone on the last line, even after a sideboard.
    const hasSection = lines.some((l) => l.section === 'commander');
    lines.forEach((l, i) => {
      const id = resolve.id(l.name);
      if (!id) return;
      const last = i === lines.length - 1 && !hasSection && canBeCommander(index.get(id)!);
      if (l.section === 'commander' || last) commander.push(id);
      else if (l.section !== 'sideboard' && l.section !== 'maybeboard') addCount(main, id, l.qty);
    });
    const total = [...main.values()].reduce((a, b) => a + b, 0) + commander.length;
    if (!DECK_SIZES.has(total)) {
      console.log(`  ${file}: ${total} cards resolved, skipped`);
      continue;
    }
    out.push({
      id: `local:${file.replace(/\.txt$/, '')}`,
      source: 'local',
      kind: 'Local list',
      name: file.replace(/^test_deck-/, '').replace(/\.txt$/, ''),
      size: total as DeckSize,
      ...(total === 100 && commander.length ? { commander } : {}),
      cards: [...main.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    });
  }
  console.log(`local lists: ${out.length} decks`);
  return out;
}

async function main(): Promise<number> {
  const force = flag('force');
  const draftSets = (arg('drafts') ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const draftMax = Number(arg('draft-max') ?? 3000);
  const localDir = arg('local');
  await mkdir(CORPUS_RAW, { recursive: true });
  const packPath = path.join(ROOT, 'data', 'packs', PACK_FILE);
  if (!existsSync(packPath)) {
    console.error('no data pack at data/packs/cards.json; run npm run data:pull first');
    return 1;
  }
  const index = new CardIndex(parsePack(readFileSync(packPath, 'utf8')));
  const resolve = new Resolver(index);

  const decks: CorpusDeck[] = await precons(resolve, force);
  for (const set of draftSets) decks.push(...(await drafts(set, resolve, force, draftMax)));
  if (localDir) decks.push(...local(path.resolve(localDir), index, resolve));

  const corpus: Corpus = {
    builtAt: new Date().toISOString(),
    dataVersion: index.dataVersion,
    decks,
    unresolved: Object.fromEntries([...resolve.unresolved.entries()].sort((a, b) => b[1] - a[1])),
  };
  await mkdir(CORPUS_DIR, { recursive: true });
  await writeFile(CORPUS_FILE, JSON.stringify(corpus));
  const counts = new Map<string, number>();
  for (const d of decks)
    counts.set(`${d.size} ${d.source}`, (counts.get(`${d.size} ${d.source}`) ?? 0) + 1);
  console.log(
    `\nwrote ${path.relative(ROOT, CORPUS_FILE)}: ${decks.length} decks (${[...counts.entries()]
      .sort()
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}); ${resolve.unresolved.size} card names unresolved`,
  );
  return 0;
}

process.exitCode = await main();
