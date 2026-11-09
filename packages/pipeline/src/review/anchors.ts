// Entry point for `npm run review:anchors`: real decks from the corpus, written
// as ReviewDeck files under data/review/decks/real/ so the judging panel can be
// checked on decks that should pass. Random piles, which should fail, come from
// the `random` version through the runner. Selection rules: docs/review/anchors.md.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  isBasicLand,
  isLand,
  normalizeColors,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
} from '@bulk-brew/core';
import {
  CORPUS_FILE,
  arg,
  deckColors,
  flag,
  hash32,
  loadCorpus,
  rng,
  ROOT,
  type CorpusDeck,
} from '../corpus.ts';
import { DEFAULT_OUT, deckFileName, poolHash, writeReviewDeck } from './build.ts';
import { loadReviewContext } from './card-facts.ts';
import type { ReviewCard, ReviewDeck, ReviewRequest, ReviewSize } from './version.ts';

export const REAL_VERSION = 'real';
export const RANDOM_VERSION = 'random';
export const ANCHOR_SIZES: readonly ReviewSize[] = [100, 60, 40, 20];
/** Decks per size before --per-size. */
export const DEFAULT_COUNTS: Record<ReviewSize, number> = { 100: 40, 60: 40, 40: 60, 20: 30 };
/** Draft decks qualify with at least this many wins in at most MAX_GAMES games. */
export const MIN_WINS = 7;
export const FALLBACK_WINS = 6;
export const MAX_GAMES = 9;
export const KEYS_FILE = path.join(ROOT, 'data', 'review', 'keys', 'anchors.json');

export function realSeed(size: ReviewSize): number {
  return hash32(`review:real:${size}`);
}

/** The set or product code: "draft:FDN:..." gives FDN, "precon:Cats1_JMP" gives JMP. */
export function setOf(deck: CorpusDeck): string {
  if (deck.source === 'draft') return deck.id.split(':')[1] ?? '?';
  const tail = deck.id.split('_');
  return tail.length > 1 ? tail[tail.length - 1]! : '?';
}

/** What the sample spreads over: release years at 100, kinds at 60, sets at 40, products at 20. */
export function groupOf(deck: CorpusDeck): string {
  switch (deck.size) {
    case 100:
      return deck.released?.slice(0, 4) ?? 'unknown';
    case 60:
      return deck.kind;
    default:
      return setOf(deck);
  }
}

/** Corpus decks that may be real anchors at a size. The owner's local lists never are. */
export function candidatesFor(
  decks: readonly CorpusDeck[],
  size: ReviewSize,
  minWins = MIN_WINS,
): CorpusDeck[] {
  return decks.filter((d) => {
    if (d.size !== size) return false;
    switch (size) {
      case 100:
        // One commander only: the review files hold one, so partner pairs are left out.
        return d.source === 'precon' && d.kind.includes('Commander') && d.commander?.length === 1;
      case 60:
        return d.source === 'precon';
      case 40:
        return (
          d.source === 'draft' &&
          d.wins !== undefined &&
          d.games !== undefined &&
          d.wins >= minWins &&
          d.games <= MAX_GAMES
        );
      case 20:
        return d.source === 'precon' && d.kind.includes('Jumpstart');
    }
  });
}

function shuffle<T>(items: T[], next: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/**
 * A seeded sample of `n` that spreads over groups: shuffle the groups and
 * each group's members, then take one from each group in turn. Items are
 * sorted by id first, so the corpus file's order never matters.
 */
export function spreadSample<T>(
  items: readonly T[],
  group: (item: T) => string,
  id: (item: T) => string,
  n: number,
  seed: number,
): T[] {
  const next = rng(seed);
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0))) {
    const key = group(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  const keys = shuffle([...groups.keys()].sort(), next);
  const lists = keys.map((k) => shuffle(groups.get(k)!, next));
  const out: T[] = [];
  for (let round = 0; out.length < n; round++) {
    let took = false;
    for (const list of lists) {
      if (out.length >= n) break;
      if (round < list.length) {
        out.push(list[round]!);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

export interface AnchorSelection {
  size: ReviewSize;
  /** Decks that met the rule. */
  candidates: number;
  /** Candidates by kind. */
  kinds: Record<string, number>;
  /** Draft decks: the win threshold used. */
  minWins?: number;
  /** Decks left out for a reason worth printing, such as partner pairs. */
  excluded?: string;
  chosen: CorpusDeck[];
}

function tally(
  decks: readonly CorpusDeck[],
  key: (d: CorpusDeck) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of decks) out[key(d)] = (out[key(d)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The seeded selection at every size; `counts` caps each sample. */
export function selectAnchors(
  decks: readonly CorpusDeck[],
  counts: Record<ReviewSize, number> = DEFAULT_COUNTS,
): AnchorSelection[] {
  return ANCHOR_SIZES.map((size) => {
    const n = counts[size];
    let minWins: number | undefined;
    let cands: CorpusDeck[];
    if (size === 40) {
      minWins = MIN_WINS;
      cands = candidatesFor(decks, size, minWins);
      if (cands.length < n) {
        minWins = FALLBACK_WINS;
        cands = candidatesFor(decks, size, minWins);
      }
    } else {
      cands = candidatesFor(decks, size);
    }
    const sel: AnchorSelection = {
      size,
      candidates: cands.length,
      kinds: tally(cands, (d) => d.kind),
      chosen: spreadSample(cands, groupOf, (d) => d.id, n, realSeed(size)),
    };
    if (minWins !== undefined) sel.minWins = minWins;
    if (size === 100) {
      const pairs = decks.filter(
        (d) =>
          d.size === 100 &&
          d.source === 'precon' &&
          d.kind.includes('Commander') &&
          (d.commander?.length ?? 0) > 1,
      ).length;
      if (pairs) sel.excluded = `${pairs} with two commanders`;
    }
    return sel;
  });
}

export function groupTally(decks: readonly CorpusDeck[]): Record<string, number> {
  return tally(decks, groupOf);
}

/** Windows-safe file stem for a corpus id. */
export function fileStem(corpusId: string): string {
  return corpusId.replace(/[^A-Za-z0-9_.]+/g, '-').replace(/^-+|-+$/g, '');
}

function notesFor(deck: CorpusDeck): string {
  let s = `Real deck from the corpus (anchor that should pass): ${deck.kind}, "${deck.name}"`;
  if (deck.released) s += `, released ${deck.released}`;
  if (deck.wins !== undefined && deck.games !== undefined)
    s += `, ${deck.wins} wins in ${deck.games} games`;
  return `${s}.`;
}

/**
 * A corpus deck as a ReviewDeck: plain basics move to `basics` (by the land
 * rules' basic names), the commander joins `cards` as the core puts it, and
 * colors are the commander's identity at 100, else the colors the spells must
 * pay (the corpus's deckColors, so a hybrid card counts once) that some land
 * in the deck makes.
 */
export function realDeck(
  deck: CorpusDeck,
  index: CardIndex,
  config: BulkBrewConfig,
  builtAt: string,
  corpusDataVersion?: string,
): { review: ReviewDeck; commanderName?: string } {
  const colorOfBasic = new Map(
    (Object.entries(config.landRules.basics.names) as [Color, string][]).map(([c, n]) => [n, c]),
  );
  const cardOf = (id: string) => {
    const card = index.get(id);
    if (!card) throw new Error(`${deck.id}: card ${id} is not in the data pack`);
    return card;
  };
  const qty = new Map<string, number>();
  for (const [id, n] of deck.cards) qty.set(id, (qty.get(id) ?? 0) + n);
  const basics: Partial<Record<Color, number>> = {};
  const listed: [CardRecord, number][] = [];
  const landColors = new Set<string>();
  const cards: ReviewCard[] = [];
  for (const [id, n] of qty) {
    const card = cardOf(id);
    listed.push([card, n]);
    if (isLand(card)) for (const c of card.produces ?? []) landColors.add(c);
    const basic = isBasicLand(card) ? colorOfBasic.get(card.name) : undefined;
    if (basic) {
      basics[basic] = (basics[basic] ?? 0) + n;
      continue;
    }
    cards.push({ id, name: card.name, qty: n });
  }
  cards.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));

  // Judges see these colors. Identity listed a mono-red deck with a {R/W} card as
  // two colors, and a W/R deck running disguise cards with green costs needs no green.
  const pays = deckColors(listed, index, config);
  const made = pays.filter((c) => landColors.has(c));
  let colors = made.length ? made : pays;
  let commanderName: string | undefined;
  const commanderId = deck.size === 100 ? deck.commander?.[0] : undefined;
  if (deck.size === 100) {
    if (deck.commander?.length !== 1) throw new Error(`${deck.id}: needs exactly one commander`);
    const commander = cardOf(commanderId!);
    commanderName = commander.name;
    colors = normalizeColors(commander.identity);
    cards.unshift({ id: commander.id, name: commander.name, qty: 1, why: 'Commander' });
  }

  const pairs = [...qty.entries(), ...(commanderId ? [[commanderId, 1] as const] : [])];
  const request: ReviewRequest = {
    size: deck.size,
    colors,
    ...(commanderId ? { commander: commanderId } : {}),
    seed: 0,
  };
  const review: ReviewDeck = {
    version: REAL_VERSION,
    versionNotes: notesFor(deck),
    pool: {
      id: deck.id,
      source: 'corpus',
      hash: poolHash(pairs),
      cards: pairs.reduce((n, [, q]) => n + q, 0),
    },
    request,
    deck: {
      name: deck.name,
      archetype: 'none',
      colors,
      ...(commanderId ? { commander: commanderId } : {}),
      cards,
      basics,
    },
    buildMs: 0,
    explanation: {
      corpusId: deck.id,
      kind: deck.kind,
      name: deck.name,
      ...(deck.released ? { released: deck.released } : {}),
      ...(deck.wins !== undefined ? { wins: deck.wins, games: deck.games } : {}),
      ...(corpusDataVersion ? { corpusDataVersion } : {}),
    },
    builtAt,
    dataVersion: index.dataVersion,
  };
  return commanderName ? { review, commanderName } : { review };
}

export function realFileName(review: ReviewDeck, commanderName?: string): string {
  return deckFileName(fileStem(review.pool.id), review.request, commanderName);
}

function rel(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function list(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
}

const USAGE = `usage: npm run review:anchors -- [--out data/review/decks] [--per-size <n>]
    [--keys data/review/keys/anchors.json] [--force]`;

function main(): number {
  if (flag('help')) {
    console.log(USAGE);
    return 2;
  }
  const outRoot = path.resolve(ROOT, arg('out') ?? DEFAULT_OUT);
  const outDir = path.join(outRoot, REAL_VERSION);
  const keysFile = path.resolve(ROOT, arg('keys') ?? KEYS_FILE);
  const force = flag('force');
  const perSize = arg('per-size');
  let counts = DEFAULT_COUNTS;
  if (perSize !== undefined) {
    const n = Number(perSize);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`--per-size must be a whole number of at least 1; got "${perSize}"`);
      return 2;
    }
    counts = { 100: n, 60: n, 40: n, 20: n };
  }
  if (!existsSync(CORPUS_FILE)) {
    console.error('no corpus at data/corpus/decks.json; run npm run corpus:fetch');
    return 1;
  }

  const ctx = loadReviewContext();
  const corpus = loadCorpus();
  const builtAt = new Date().toISOString();
  const selections = selectAnchors(corpus.decks, counts);

  const keys: Record<string, unknown>[] = [];
  const keep = new Set<string>();
  for (const sel of selections) {
    let wrote = 0;
    let kept = 0;
    for (const deck of sel.chosen) {
      const { review, commanderName } = realDeck(
        deck,
        ctx.index,
        ctx.config,
        builtAt,
        corpus.dataVersion,
      );
      const file = path.join(outDir, realFileName(review, commanderName));
      keep.add(path.basename(file));
      if (!force && existsSync(file)) kept++;
      else {
        writeReviewDeck(file, review);
        wrote++;
      }
      keys.push({
        file: rel(file),
        version: REAL_VERSION,
        expect: 'pass',
        corpusId: deck.id,
        kind: deck.kind,
        name: deck.name,
        ...(deck.released ? { released: deck.released } : {}),
        ...(deck.wins !== undefined ? { wins: deck.wins, games: deck.games } : {}),
        size: deck.size,
        colors: review.request.colors.join(''),
        ...(commanderName ? { commander: commanderName } : {}),
      });
    }
    const rule =
      sel.size === 40
        ? `17Lands draft decks with at least ${sel.minWins} wins in at most ${MAX_GAMES} games${sel.minWins === MIN_WINS ? '' : ` (lowered from ${MIN_WINS}: too few decks)`}`
        : `kinds: ${list(sel.kinds)}`;
    const spread = { 100: 'release year', 60: 'kind', 40: 'set', 20: 'product' }[sel.size];
    console.log(
      `${sel.size}: ${sel.candidates} candidates (${rule}${sel.excluded ? `; left out ${sel.excluded}` : ''})`,
    );
    if (sel.candidates === 0) {
      console.log(`  no real anchor at this size`);
      continue;
    }
    console.log(
      `  chose ${sel.chosen.length} (seed ${realSeed(sel.size)}), wrote ${wrote}, kept ${kept} existing`,
    );
    console.log(`  by ${spread}: ${list(groupTally(sel.chosen))}`);
  }

  // Files from an earlier, larger selection would still be read as anchors.
  const stale = existsSync(outDir)
    ? readdirSync(outDir).filter((f) => f.endsWith('.json') && !keep.has(f))
    : [];
  if (stale.length && force) {
    for (const f of stale) rmSync(path.join(outDir, f));
    console.log(`removed ${stale.length} files from an earlier selection`);
  } else if (stale.length) {
    console.log(
      `${stale.length} files in ${rel(outDir)} are not in this selection; --force removes them`,
    );
  }

  mkdirSync(path.dirname(keysFile), { recursive: true });
  const key = {
    builtAt,
    corpusDataVersion: corpus.dataVersion,
    dataVersion: ctx.index.dataVersion,
    rules: {
      real: `Every file listed under "real", version "${REAL_VERSION}", in ${rel(outDir)}/. Expected to pass.`,
      random: `Every file with version "${RANDOM_VERSION}", written by npm run review:build into ${rel(path.join(outRoot, RANDOM_VERSION))}/. Expected to fail.`,
    },
    counts: Object.fromEntries(
      selections.map((s) => [
        s.size,
        {
          candidates: s.candidates,
          chosen: s.chosen.length,
          seed: realSeed(s.size),
          ...(s.minWins !== undefined ? { minWins: s.minWins, maxGames: MAX_GAMES } : {}),
        },
      ]),
    ),
    real: keys,
  };
  writeFileSync(keysFile, JSON.stringify(key, null, 2) + '\n');
  console.log(`wrote ${keys.length} real anchors; key in ${rel(keysFile)}`);
  return 0;
}

// Run only as a script, so tests can import the selection.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/anchors.ts')) {
  process.exitCode = main();
}
