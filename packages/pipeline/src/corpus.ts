// Reference decks for learning and evaluation: official preconstructed decks
// (100, 60, and 20 cards), Arena draft decks with their results (40), and the
// owner's local lists. Downloads and the corpus live in data/corpus/, which
// is never committed. Shared by corpus-fetch, corpus-eval, and corpus-learn.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addToPool,
  commanderTribes,
  emptyPool,
  factsFor,
  manaCostsOf,
  minimumsFor,
  normalizeColors,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
  type DeckSize,
  type Pool,
  type Rarity,
} from '@bulk-brew/core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CORPUS_DIR = path.join(ROOT, 'data', 'corpus');
export const CORPUS_RAW = path.join(CORPUS_DIR, 'raw');
export const CORPUS_FILE = path.join(CORPUS_DIR, 'decks.json');
export const CORPUS_RESULTS = path.join(CORPUS_DIR, 'results');
export const USER_AGENT = 'bulk-brew/0.1 (+https://github.com/xbadc0ffe/bulk-brew)';

export const SIZES: readonly DeckSize[] = [100, 60, 40, 20];

export interface CorpusDeck {
  /** Stable id: source, product or set, and the deck's own key. */
  id: string;
  /** precon: an official product; draft: an Arena draft deck; local: the owner's list. */
  source: 'precon' | 'draft' | 'local';
  /** Product type (Commander Deck, Jumpstart, ...) or "Draft". */
  kind: string;
  name: string;
  /** Release date for products, YYYY-MM-DD. */
  released?: string;
  size: DeckSize;
  /** Commander oracle ids (two for partner pairs). */
  commander?: string[];
  /** Main deck as [oracle id, copies], commander left out, basics included. */
  cards: [string, number][];
  /** Draft decks: games won and played with this build. */
  wins?: number;
  games?: number;
}

export interface Corpus {
  builtAt: string;
  dataVersion: string;
  decks: CorpusDeck[];
  /** Card names that did not resolve, with how often. */
  unresolved: Record<string, number>;
}

export function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(CORPUS_FILE, 'utf8')) as Corpus;
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

/** FNV-1a: a stable 32-bit hash for seeds and splits. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small seeded generator, so every run draws the same noise. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One deck in five is held out as the test split, so tuning on the rest can be checked. */
export function splitOf(id: string): 'train' | 'test' {
  return hash32(`split:${id}`) % 5 === 0 ? 'test' : 'train';
}

// A bulk box is mostly commons: these shares pick each noise card's rarity.
const RARITY_SHARE: [Rarity, number][] = [
  ['common', 0.55],
  ['uncommon', 0.3],
  ['rare', 0.12],
  ['mythic', 0.03],
];
const MAX_COPIES: Record<Rarity, number> = { common: 3, uncommon: 2, rare: 1, mythic: 1 };

/** Cards that can show up in a bulk box, grouped by rarity. */
export function noiseSource(index: CardIndex): Map<Rarity, CardRecord[]> {
  const out = new Map<Rarity, CardRecord[]>(RARITY_SHARE.map(([r]) => [r, []]));
  for (const card of index.pack.cards) {
    if (card.unset || !card.rarity || card.commanderLegality === 'not_legal') continue;
    if (card.types.includes('land') && /^Basic\b/.test(card.typeLine)) continue;
    out.get(card.rarity)!.push(card);
  }
  return out;
}

/** A seeded random bulk list: `count` copies, mostly commons, a few copies of each. */
export function noisePool(
  source: Map<Rarity, CardRecord[]>,
  seed: number,
  count: number,
): [string, number][] {
  const next = rng(seed);
  const qty = new Map<string, number>();
  let total = 0;
  while (total < count) {
    let roll = next();
    let rarity: Rarity = 'common';
    for (const [r, share] of RARITY_SHARE) {
      if (roll < share) {
        rarity = r;
        break;
      }
      roll -= share;
    }
    const list = source.get(rarity)!;
    const card = list[Math.floor(next() * list.length)]!;
    const n = Math.min(count - total, 1 + Math.floor(next() * MAX_COPIES[rarity]));
    qty.set(card.id, (qty.get(card.id) ?? 0) + n);
    total += n;
  }
  return [...qty.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function poolOf(...lists: [string, number][][]): Pool {
  let pool = emptyPool('corpus');
  for (const list of lists) {
    pool = addToPool(
      pool,
      list.map(([cardId, qty]) => ({ cardId, qty })),
      'corpus',
    );
  }
  return pool;
}

/** What a deck looks like, counted the same way for reference decks and our builds. */
export interface DeckShape {
  spells: number;
  lands: number;
  nonbasics: number;
  /** Average mana value of the spells. */
  avgMv: number;
  /** Spell copies by mana value bucket 0 through 7 (7 is seven or more). */
  curve: number[];
  creatures: number;
  instSorc: number;
  ncPerm: number;
  /** Spell copies per builder role. */
  roles: Record<string, number>;
  /** Distinct spells. */
  distinct: number;
}

export function shapeOf(
  cards: readonly [CardRecord, number][],
  index: CardIndex,
  config: BulkBrewConfig,
): DeckShape {
  const s: DeckShape = {
    spells: 0,
    lands: 0,
    nonbasics: 0,
    avgMv: 0,
    curve: [0, 0, 0, 0, 0, 0, 0, 0],
    creatures: 0,
    instSorc: 0,
    ncPerm: 0,
    roles: {},
    distinct: 0,
  };
  let mv = 0;
  for (const [card, qty] of cards) {
    const f = factsFor(index, config, card);
    if (!f.spell) {
      s.lands += qty;
      if (!f.basic) s.nonbasics += qty;
      continue;
    }
    s.spells += qty;
    s.distinct += 1;
    mv += card.mv * qty;
    s.curve[f.bucket]! += qty;
    if (f.creature) s.creatures += qty;
    if (f.instantOrSorcery) s.instSorc += qty;
    if (f.noncreaturePermanent) s.ncPerm += qty;
    for (const r of f.roles) s.roles[r] = (s.roles[r] ?? 0) + qty;
  }
  s.avgMv = s.spells > 0 ? Math.round((mv / s.spells) * 100) / 100 : 0;
  return s;
}

/** Resolve [oracle id, copies] pairs, dropping ids the pack does not know. */
export function recordsOf(
  index: CardIndex,
  cards: readonly [string, number][],
): [CardRecord, number][] {
  const out: [CardRecord, number][] = [];
  for (const [id, qty] of cards) {
    const card = index.get(id);
    if (card) out.push([card, qty]);
  }
  return out;
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Synergy styles a deck meets: enablers and payoffs at the size's minimums,
 * plus, under a commander, the tribes its text names at the primary minimums.
 */
export function stylesMet(
  cards: [CardRecord, number][],
  size: DeckSize,
  index: CardIndex,
  config: BulkBrewConfig,
  commander?: CardRecord,
): string[] {
  const out: string[] = [];
  if (commander) {
    const cands = cards
      .map(([card, qty]) => ({
        facts: factsFor(index, config, card),
        available: qty,
        preferred: qty,
      }))
      .filter((c) => c.facts.spell);
    for (const t of commanderTribes(commander, cands, config, size))
      if (t.viable) out.push(t.archetype.id);
  }
  for (const a of config.archetypes.archetypes) {
    if (a.kind !== 'synergy') continue;
    let e = 0;
    let p = 0;
    for (const [card, qty] of cards) {
      const f = factsFor(index, config, card);
      if (!f.spell) continue;
      if (f.enablerOf.includes(a.id)) e += qty;
      if (f.payoffOf.includes(a.id)) p += qty;
    }
    const want = minimumsFor(config, a, size);
    if (e >= want.enablers && p >= want.payoffs) out.push(a.id);
  }
  return out;
}

/**
 * The colors a deck's spells must pay: every plain colored pip in their
 * costs, then one color of a hybrid card (the first in WUBRG order) only
 * when none of its colors is in yet. Counting a hybrid card as both colors
 * made mono decks two-colored.
 */
export function deckColors(
  cards: [CardRecord, number][],
  index: CardIndex,
  config: BulkBrewConfig,
): Color[] {
  const spells = cards.map(([c]) => c).filter((c) => factsFor(index, config, c).spell);
  const set = new Set<Color>();
  for (const card of spells)
    for (const cost of manaCostsOf(card))
      for (const m of cost.matchAll(/\{([WUBRG])\}/g)) set.add(m[1] as Color);
  for (const card of spells) {
    if (card.colors.length > 0 && !card.colors.some((c) => set.has(c)))
      set.add(normalizeColors(card.colors)[0]!);
  }
  return normalizeColors([...set]);
}

// ---- File formats ----

/** Split one CSV line, honoring double quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface TarEntry {
  name: string;
  data: Buffer;
}

/** Read the regular files of a tar stream (ustar, with GNU and pax long names). */
export async function* readTar(input: AsyncIterable<Buffer>): AsyncGenerator<TarEntry> {
  let buf: Buffer = Buffer.alloc(0);
  let pending: { name: string; size: number; file: boolean } | undefined;
  let longName: string | undefined;
  const cstr = (b: Buffer) => {
    const end = b.indexOf(0);
    return b.subarray(0, end < 0 ? b.length : end).toString('utf8');
  };
  for await (const chunk of input) {
    buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);
    for (;;) {
      if (!pending) {
        if (buf.length < 512) break;
        const h = buf.subarray(0, 512);
        buf = buf.subarray(512);
        if (h.every((x) => x === 0)) continue;
        const size = Number.parseInt(cstr(h.subarray(124, 136)).trim() || '0', 8);
        const type = String.fromCharCode(h[156]!);
        const prefix = cstr(h.subarray(345, 500));
        const base = cstr(h.subarray(0, 100));
        const name = longName ?? (prefix ? `${prefix}/${base}` : base);
        longName = undefined;
        pending = {
          name,
          size,
          file: type === '0' || type === '\0' || type === 'L' || type === 'x',
        };
        if (type === 'L' || type === 'x') pending.name = `\0${type}`;
      }
      const padded = Math.ceil(pending.size / 512) * 512;
      if (buf.length < padded) break;
      const data = Buffer.from(buf.subarray(0, pending.size));
      buf = buf.subarray(padded);
      const { name, file } = pending;
      pending = undefined;
      if (name === '\0L') longName = cstr(data);
      else if (name === '\0x') {
        const m = /\d+ path=([^\n]*)\n/.exec(data.toString('utf8'));
        if (m) longName = m[1];
      } else if (file) yield { name, data };
    }
  }
}
