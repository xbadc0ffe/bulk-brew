// Blind judge packets for the builder review (docs/algo-review.md, Phase 3):
// sample stored decks, render each one with the cards' printed facts only,
// and keep the answer key outside the folder judges read.
// Format, sampling, and commands: docs/review/judging.md.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  COLOR_LABELS,
  COLORS,
  isBasicLand,
  primaryGroup,
  type CardIndex,
  type CardRecord,
  type Color,
} from '@bulk-brew/core';
import { arg, flag, hash32, rng, ROOT } from '../corpus.ts';
import { loadReviewContext } from './card-facts.ts';
import { deckColorsOf, type ReviewDeck, type ReviewRequest } from './version.ts';

export const PACKETS_DIR = path.join(ROOT, 'data', 'review', 'packets');
export const KEYS_DIR = path.join(ROOT, 'data', 'review', 'keys');
export const JUDGMENTS_DIR = path.join(ROOT, 'data', 'review', 'judgments');
export const RUBRIC_FILE = path.join(ROOT, 'docs', 'review', 'rubric.md');

/** Versions whose decks have known answers; every one found joins a batch. */
export const ANCHOR_VERSIONS: readonly string[] = ['random', 'real'];

/** Anchor decks per anchor version and size in a batch, unless --anchors says otherwise. */
export const DEFAULT_ANCHORS = 25;

const DEFAULT_BASICS: Record<Color, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

const GROUP_ORDER = [
  'Commander',
  'Creatures',
  'Planeswalkers',
  'Instants',
  'Sorceries',
  'Artifacts',
  'Enchantments',
  'Battles',
  'Lands',
  'Other',
];

/** A stored deck file and its path relative to the repo root. */
export interface StoredDeck {
  file: string;
  deck: ReviewDeck;
}

export interface PlanEntry {
  version: string;
  size?: number;
  /** Pool kinds: plain, theme, public, owner, other. Absent means any. */
  kinds?: string[];
  /** Requested style ids, "bestfit" for none. Absent means any. */
  styles?: string[];
  count: number;
}

/** What the key remembers about one deck, so collation never rereads a deck file that may have been rebuilt. */
export interface DeckRef {
  file: string;
  version: string;
  pool: { id: string; source: string; kind: string };
  request: ReviewRequest;
  /** The style the version built (`deck.archetype`); keys made before it have none. */
  archetype?: string;
  /** Copies per card name as the packet lists them, basics included. */
  copies: Record<string, number>;
}

export interface SingleKey extends DeckRef {
  kind: 'single';
  /** Set on the second copy of a packet, so two judges score one deck blind. */
  duplicateOf?: string;
}

export type PairMatch = 'same-request' | 'same-pool' | 'same-colors';

export interface PairKey {
  kind: 'pair';
  pair: { A: DeckRef; B: DeckRef; match: PairMatch };
}

export type KeyEntry = SingleKey | PairKey;

/** Decks the glob found, per version, size, requested style, and pool kind. */
export interface InventoryRow {
  version: string;
  size: number;
  style: string;
  kind: string;
  built: number;
  /** Errors plus decks built in another style than the one requested. */
  declined: number;
  /** Of `declined`, the decks built in another style; inventories made before it have none. */
  substituted?: number;
}

export interface BatchOptions {
  decks: string;
  seed: number;
  quota?: number;
  plan?: PlanEntry[];
  pairs: number;
  twoJudges: number;
  /** Anchor decks per anchor version and size, drawn seeded; 0 leaves anchors to the plan. */
  anchors: number;
}

export interface BatchKey {
  batch: string;
  options: BatchOptions;
  dataVersion?: string;
  /** FNV-1a of the rubric text the prompt carried. */
  rubricHash?: string;
  packets: Record<string, KeyEntry>;
  inventory: InventoryRow[];
  /** Shortfalls and skipped files, in plain words. */
  notes: string[];
}

export interface Packet {
  id: string;
  kind: 'single' | 'pair';
  text: string;
}

export interface Batch {
  packets: Packet[];
  key: BatchKey;
  index: { id: string; kind: 'single' | 'pair' }[];
}

// ---------------------------------------------------------------- helpers

export function styleOf(r: ReviewRequest): string {
  return r.style ?? 'bestfit';
}

/**
 * A styled request answered with another style, such as a Graveyard request
 * built as Midrange. Collation counts it as declined: packets hide the request,
 * so a decent plain deck would otherwise pass for the theme. Ids compare whole,
 * "tribal:<Type>" included; best fit has no style and never substitutes.
 */
export function builtAnotherStyle(
  request: Pick<ReviewRequest, 'style'>,
  archetype: string | undefined,
): boolean {
  return request.style !== undefined && archetype !== undefined && archetype !== request.style;
}

export function isAnchor(version: string): boolean {
  return ANCHOR_VERSIONS.includes(version);
}

/** The pool kind from where the pool file lives; owner pools must be recognizable so examples skip them. */
export function poolKindOf(source: string): string {
  const s = source.replace(/\\/g, '/');
  const m = /(?:^|\/)data\/review\/pools\/(plain|theme|public|owner)\//.exec(s);
  if (m) return m[1]!;
  if (/(?:^|\/)eval\/pools\//.test(s)) return 'public';
  if (/(?:^|\/)test-bulk\//.test(s)) return 'owner';
  return 'other';
}

/** A seeded Fisher-Yates shuffle; the same items and seed text give the same order. */
export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = rng(hash32(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

function byFile(a: StoredDeck, b: StoredDeck): number {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

function colorKey(colors: readonly Color[]): string {
  return colors.join('');
}

function requestKey(d: ReviewDeck): string {
  const r = d.request;
  return [
    d.pool.id,
    d.pool.hash,
    r.size,
    colorKey(r.colors),
    r.style ?? '',
    r.secondary ?? '',
    r.commander ?? '',
    r.seed,
  ].join('|');
}

/** "Black and Green (BG)", or "Colorless". */
export function colorsText(colors: readonly Color[]): string {
  const ordered = COLORS.filter((c) => colors.includes(c));
  if (!ordered.length) return 'Colorless';
  const labels = ordered.map((c) => COLOR_LABELS[c]);
  const words =
    labels.length <= 2
      ? labels.join(' and ')
      : `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
  return `${words} (${ordered.join('')})`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ---------------------------------------------------------------- deck files

function globToRegExp(glob: string): RegExp {
  let re = '';
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      depth++;
      re += '(?:';
    } else if (c === '}' && depth > 0) {
      depth--;
      re += ')';
    } else if (c === ',' && depth > 0) re += '|';
    else re += c.replace(/[.+^$()|[\]{}\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.json')) out.push(p);
  }
}

/** Deck files under a folder, or matching a glob (`*`, `**`, `?`, `{a,b}`), relative to the root, sorted. */
export function findDeckFiles(spec: string, root: string = ROOT): string[] {
  const rel = (p: string) => path.relative(root, p).replace(/\\/g, '/');
  const abs = path.resolve(root, spec);
  if (existsSync(abs)) {
    if (statSync(abs).isFile()) return [rel(abs)];
    const out: string[] = [];
    walk(abs, out);
    return out.map(rel).sort();
  }
  // path.resolve leaves wildcards alone, so the pattern is the spec relative to the root.
  const pattern = rel(path.resolve(root, spec));
  const fixed: string[] = [];
  for (const p of pattern.split('/')) {
    if (/[*?{]/.test(p)) break;
    fixed.push(p);
  }
  const base = path.resolve(root, fixed.join('/') || '.');
  if (!existsSync(base) || !statSync(base).isDirectory()) return [];
  const re = globToRegExp(pattern);
  const out: string[] = [];
  walk(base, out);
  return out
    .map(rel)
    .filter((f) => re.test(f))
    .sort();
}

/** Parse deck files; anything that is not a ReviewDeck is skipped with a note. */
export function readDecks(
  files: readonly string[],
  root: string = ROOT,
): {
  decks: StoredDeck[];
  skipped: string[];
} {
  const decks: StoredDeck[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    try {
      const d = JSON.parse(readFileSync(path.resolve(root, file), 'utf8')) as Partial<ReviewDeck>;
      if (typeof d.version !== 'string' || !d.request || !d.deck || !d.pool) {
        skipped.push(`${file}: not a review deck`);
        continue;
      }
      decks.push({ file, deck: d as ReviewDeck });
    } catch (err) {
      skipped.push(`${file}: ${(err as Error).message}`);
    }
  }
  return { decks, skipped };
}

// ---------------------------------------------------------------- what a judge may see

export interface PacketFace {
  name: string;
  manaCost?: string;
  typeLine: string;
  text: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
}

export interface PacketCard {
  name: string;
  manaCost?: string;
  mv: number;
  typeLine: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  text: string;
  faces?: PacketFace[];
  keywords: string[];
}

function opt<K extends string>(key: K, v: string | undefined): { [P in K]?: string } {
  return v === undefined ? {} : ({ [key]: v } as { [P in K]?: string });
}

/**
 * The printed facts a judge may see, copied field by field so nothing else
 * leaks: no tags, rarity, rank, roles, styles, or strength.
 */
export function packetCard(card: CardRecord): PacketCard {
  const faces = card.faces?.map((f): PacketFace => ({
    name: f.name,
    ...opt('manaCost', f.manaCost),
    typeLine: f.typeLine,
    text: f.text ?? '',
    ...opt('power', f.power),
    ...opt('toughness', f.toughness),
    ...opt('loyalty', f.loyalty),
  }));
  return {
    name: card.name,
    ...opt('manaCost', card.manaCost),
    mv: card.mv,
    typeLine: card.typeLine,
    ...opt('power', card.power),
    ...opt('toughness', card.toughness),
    ...opt('loyalty', card.loyalty),
    text: card.text,
    ...(faces?.length ? { faces } : {}),
    keywords: [...card.keywords],
  };
}

export interface ListedCard {
  name: string;
  qty: number;
  group: string;
  card?: PacketCard;
}

const READS_SNOW = /\bsnow\b|\{S\}/i;

function readsSnow(rec: CardRecord): boolean {
  const faces = rec.faces ?? [];
  return [rec.text, rec.manaCost, ...faces.flatMap((f) => [f.text, f.manaCost])].some(
    (s) => s !== undefined && READS_SNOW.test(s),
  );
}

/**
 * The deck's cards with copies and type groups, basics included; the commander gets its own group.
 * A name listed twice shows once. Builders never play snow basics, so in a deck where no card
 * reads snow they would only mark a real deck; they show as the plain basic, which plays the same.
 */
export function listDeck(
  d: ReviewDeck,
  index: Pick<CardIndex, 'get' | 'find'>,
  basicNames: Record<Color, string> = DEFAULT_BASICS,
): ListedCard[] {
  const recs = d.deck.cards.map((c) => index.get(c.id));
  // A card missing from the pack might read snow, so it keeps snow basics as they are.
  const keepSnow = recs.some((r) => !r || (!isBasicLand(r) && readsSnow(r)));
  const colorOfType = new Map(COLORS.map((c) => [basicNames[c], c] as const));
  const extraBasics: Partial<Record<Color, number>> = {};
  const listed = new Map<string, ListedCard>();
  d.deck.cards.forEach((c, i) => {
    const rec = recs[i];
    if (rec && isBasicLand(rec)) {
      // Plain basics a version lists as cards join the basics too.
      const m = /^Basic (Snow )?Land — (\w+)$/.exec(rec.typeLine);
      const color = m ? colorOfType.get(m[2]!) : undefined;
      const snow = m?.[1] !== undefined;
      if (color && (!snow || !keepSnow)) {
        extraBasics[color] = (extraBasics[color] ?? 0) + c.qty;
        return;
      }
    }
    const name = rec?.name ?? c.name;
    const seen = listed.get(name);
    if (seen) {
      seen.qty += c.qty;
      return;
    }
    const group = c.id === d.deck.commander ? 'Commander' : rec ? primaryGroup(rec) : 'Other';
    listed.set(name, { name, qty: c.qty, group, ...(rec ? { card: packetCard(rec) } : {}) });
  });
  const out = [...listed.values()];
  for (const color of COLORS) {
    const qty = (d.deck.basics[color] ?? 0) + (extraBasics[color] ?? 0);
    if (qty <= 0) continue;
    const name = basicNames[color];
    const rec = index.find(name);
    out.push({ name, qty, group: 'Lands', ...(rec ? { card: packetCard(rec) } : {}) });
  }
  return out;
}

export function copiesOf(cards: readonly ListedCard[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) out[c.name] = (out[c.name] ?? 0) + c.qty;
  return out;
}

function total(cards: readonly ListedCard[]): number {
  return cards.reduce((n, c) => n + c.qty, 0);
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function deckListLines(cards: readonly ListedCard[], level: string): string[] {
  const lines: string[] = [];
  for (const g of GROUP_ORDER) {
    const inGroup = cards.filter((c) => c.group === g).sort(byName);
    if (!inGroup.length) continue;
    lines.push(`${level} ${g} (${total(inGroup)})`, '');
    for (const c of inGroup) lines.push(`${c.qty} ${c.name}`);
    lines.push('');
  }
  return lines;
}

function statsText(p?: string, t?: string, l?: string): string | undefined {
  if (p !== undefined || t !== undefined) return `Power/toughness: ${p ?? '?'}/${t ?? '?'}`;
  return l !== undefined ? `Loyalty: ${l}` : undefined;
}

function textLines(text: string): string[] {
  if (!text.trim()) return ['Text: none'];
  return ['Text:', ...text.split('\n').map((l) => (l ? `> ${l}` : '>'))];
}

/** One card's block: copies, cost, type, stats, keywords, and every face's text. */
export function cardBlock(name: string, card: PacketCard | undefined, copies: string): string[] {
  const lines = [`### ${name}`, '', copies];
  if (!card) {
    lines.push('Text missing from the data pack.', '');
    return lines;
  }
  if (card.faces?.length) {
    lines.push(`Mana value: ${card.mv}`);
    lines.push(`Keywords: ${card.keywords.join(', ') || 'none'}`);
    card.faces.forEach((f, i) => {
      lines.push('', `Face ${i + 1}: ${f.name}`);
      lines.push(`Cost: ${f.manaCost || 'none'}`);
      lines.push(`Type: ${f.typeLine}`);
      const st = statsText(f.power, f.toughness, f.loyalty);
      if (st) lines.push(st);
      lines.push(...textLines(f.text));
    });
  } else {
    lines.push(`Cost: ${card.manaCost || 'none'} (mana value ${card.mv})`);
    lines.push(`Type: ${card.typeLine}`);
    const st = statsText(card.power, card.toughness, card.loyalty);
    if (st) lines.push(st);
    lines.push(`Keywords: ${card.keywords.join(', ') || 'none'}`);
    lines.push(...textLines(card.text));
  }
  lines.push('');
  return lines;
}

function commanderName(d: ReviewDeck, cards: readonly ListedCard[]): string | undefined {
  return d.deck.commander ? cards.find((c) => c.group === 'Commander')?.name : undefined;
}

const CARDS_INTRO =
  'One block per distinct card, sorted by name: copies, cost, type, stats, keywords, and the oracle text of every face.';

/** A packet with one deck: size, colors, commander, the list, and the cards. Nothing from the builder. */
export function renderSinglePacket(
  id: string,
  d: ReviewDeck,
  index: Pick<CardIndex, 'get' | 'find'>,
  basicNames?: Record<Color, string>,
): string {
  const cards = listDeck(d, index, basicNames);
  const cmd = commanderName(d, cards);
  const lines = [
    `# Packet ${id}`,
    '',
    'One deck. Judge it by the rubric and answer with the one-deck shape.',
    '',
    `- Size: ${d.request.size} cards`,
    `- Colors: ${colorsText(deckColorsOf(d))}`,
  ];
  if (cmd) lines.push(`- Commander: ${cmd}`);
  lines.push('', `## Deck list (${total(cards)} cards)`, '', ...deckListLines(cards, '###'));
  lines.push('## Cards', '', CARDS_INTRO, '');
  for (const c of [...cards].sort(byName))
    lines.push(...cardBlock(c.name, c.card, `Copies: ${c.qty}`));
  return lines.join('\n').replace(/\n+$/, '\n');
}

/** A packet with decks A and B of one size and colors, and one card block per distinct card in either. */
export function renderPairPacket(
  id: string,
  a: ReviewDeck,
  b: ReviewDeck,
  index: Pick<CardIndex, 'get' | 'find'>,
  basicNames?: Record<Color, string>,
): string {
  const ca = listDeck(a, index, basicNames);
  const cb = listDeck(b, index, basicNames);
  // Two builds of one request can differ in colors when a best fit drops one.
  const [colorsA, colorsB] = [colorsText(deckColorsOf(a)), colorsText(deckColorsOf(b))];
  const same = colorsA === colorsB;
  const lines = [
    `# Packet ${id}`,
    '',
    `Two decks of the same size${same ? ' and colors' : ''}, labeled A and B; which one is A means nothing. Pick the better one by the rubric and answer with the pair shape.`,
    '',
    `- Size: ${a.request.size} cards`,
    same ? `- Colors: ${colorsA}` : `- Colors: Deck A ${colorsA}; Deck B ${colorsB}`,
    '',
  ];
  // Each list opens with its own Commander group when it has one.
  for (const [label, cards] of [
    ['A', ca],
    ['B', cb],
  ] as const) {
    lines.push(`## Deck ${label} (${total(cards)} cards)`, '', ...deckListLines(cards, '###'));
  }
  const qa = copiesOf(ca);
  const qb = copiesOf(cb);
  const seen = new Map<string, PacketCard | undefined>();
  for (const c of [...ca, ...cb]) if (!seen.has(c.name) || c.card) seen.set(c.name, c.card);
  lines.push('## Cards', '', CARDS_INTRO, '');
  for (const name of [...seen.keys()].sort()) {
    const copies = `Copies: A ${qa[name] ?? 0}, B ${qb[name] ?? 0}`;
    lines.push(...cardBlock(name, seen.get(name), copies));
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}

/** What each judge gets: the full rubric, then the task. `{{packetId}}` is filled in per judge. */
export function judgePrompt(batch: string, rubric: string): string {
  return (
    [
      rubric.trimEnd(),
      '',
      '---',
      '',
      '# Your task',
      '',
      'You are one judge on a blind panel. The text above is the rubric. Judge by it alone.',
      '',
      `1. Read your packet: \`data/review/packets/${batch}/{{packetId}}.md\`. It holds the deck list and every card's oracle text.`,
      '2. A packet whose id starts with `p-` holds one deck: answer with the one-deck shape. A packet whose id starts with `pair-` holds decks A and B: answer with the pair shape only.',
      `3. Write your answer, one JSON object and nothing else, to \`data/review/judgments/${batch}/{{packetId}}.json\`. Create the folder if it is missing.`,
      '4. Reply with the one word "done".',
      '',
      'Rules:',
      '',
      '- Read only your packet and the rubric. Do not open any other file in the repository: not other packets, not other judgments, not the card data, the decks, the results, or the review tools.',
      '- Never open `data/review/keys/`. It holds the answer keys, and reading it breaks the blind test.',
      "- Do not run any repo command. The card tools show a builder's view of each card, which you must not see.",
      '- Every card you need is in the packet. If one is missing, say so in `reason`; do not recall it from memory or look it up.',
    ].join('\n') + '\n'
  );
}

// ---------------------------------------------------------------- sampling

function matchesPlan(s: StoredDeck, e: PlanEntry): boolean {
  const d = s.deck;
  if (d.version !== e.version) return false;
  if (e.size !== undefined && d.request.size !== e.size) return false;
  if (e.kinds && !e.kinds.includes(poolKindOf(d.pool.source))) return false;
  if (e.styles && !e.styles.includes(styleOf(d.request))) return false;
  return true;
}

/** Group decks by a key, keys sorted, each group in the given order. */
function groupBy(decks: readonly StoredDeck[], keyOf: (s: StoredDeck) => string) {
  const groups = new Map<string, StoredDeck[]>();
  for (const s of decks) {
    const k = keyOf(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  return [...groups.keys()].sort().map((k) => [k, groups.get(k)!] as const);
}

/**
 * The decks to judge: up to `anchors` decks per anchor version and size, plus a
 * seeded draw without replacement by quota (per version, size, and pool kind) or
 * by plan. Decks with `error` are never drawn; the inventory counts them as declined.
 */
export function selectDecks(
  decks: readonly StoredDeck[],
  opts: Pick<BatchOptions, 'seed' | 'quota' | 'plan' | 'anchors'>,
): { selected: StoredDeck[]; scope: StoredDeck[]; notes: string[] } {
  const built = decks.filter((s) => !s.deck.error).sort(byFile);
  const notes: string[] = [];
  const taken = new Set<string>();
  const selected: StoredDeck[] = [];
  const take = (s: StoredDeck) => {
    if (taken.has(s.file)) return;
    taken.add(s.file);
    selected.push(s);
  };
  if (opts.anchors > 0) {
    const anchors = built.filter((s) => isAnchor(s.deck.version));
    for (const [k, g] of groupBy(anchors, (s) => `${s.deck.version}|${s.deck.request.size}`)) {
      shuffled(g, `review:packets:${opts.seed}:anchors:${k}`).slice(0, opts.anchors).forEach(take);
      if (g.length < opts.anchors)
        notes.push(`anchors ${k}: ${g.length} of ${opts.anchors} decks found`);
    }
  }

  let scope: StoredDeck[];
  if (opts.plan) {
    scope = built.filter(
      (s) => !isAnchor(s.deck.version) && opts.plan!.some((e) => matchesPlan(s, e)),
    );
    opts.plan.forEach((e, i) => {
      const pool = built.filter((s) => matchesPlan(s, e) && !taken.has(s.file));
      const drawn = shuffled(pool, `review:packets:${opts.seed}:plan:${i}`).slice(0, e.count);
      drawn.forEach(take);
      if (drawn.length < e.count)
        notes.push(`plan entry ${i + 1} (${e.version}): ${drawn.length} of ${e.count} decks found`);
    });
  } else {
    const quota = opts.quota ?? 0;
    scope = built.filter((s) => !isAnchor(s.deck.version));
    const groups = groupBy(
      scope,
      (s) => `${s.deck.version}|${s.deck.request.size}|${poolKindOf(s.deck.pool.source)}`,
    );
    for (const [k, g] of groups) {
      const drawn = shuffled(g, `review:packets:${opts.seed}:quota:${k}`).slice(0, quota);
      drawn.forEach(take);
      if (drawn.length < quota) notes.push(`quota ${k}: ${drawn.length} of ${quota} decks found`);
    }
  }
  return { selected: selected.sort(byFile), scope, notes };
}

function cross<T extends StoredDeck>(group: readonly T[], seed: string): [T, T][] {
  const out: [T, T][] = [];
  if (group.length <= 12) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (group[i]!.deck.version !== group[j]!.deck.version) out.push([group[i]!, group[j]!]);
    return out;
  }
  // Large groups (same colors only) would give too many pairs; pair neighbors in a seeded order.
  const order = shuffled(group, seed);
  for (let i = 0; i + 1 < order.length; i++)
    if (order[i]!.deck.version !== order[i + 1]!.deck.version) out.push([order[i]!, order[i + 1]!]);
  return out;
}

/**
 * Pairs of decks from two versions with the same size and colors, preferring
 * the same pool and request, then the same pool, then any pool. Each deck
 * joins at most one pair, and version pairs take turns so each gets a share.
 */
export function choosePairs(
  scope: readonly StoredDeck[],
  n: number,
  seed: number,
): { A: StoredDeck; B: StoredDeck; match: PairMatch }[] {
  // Same request means the same input, whatever colors each version built; the looser
  // steps match on the built decks' colors.
  const tiers: [PairMatch, (d: ReviewDeck) => string][] = [
    ['same-request', requestKey],
    [
      'same-pool',
      (d) => `${d.pool.id}|${d.pool.hash}|${d.request.size}|${colorKey(deckColorsOf(d))}`,
    ],
    ['same-colors', (d) => `${d.request.size}|${colorKey(deckColorsOf(d))}`],
  ];
  const used = new Set<string>();
  const out: { A: StoredDeck; B: StoredDeck; match: PairMatch }[] = [];
  const sorted = [...scope].sort(byFile);
  for (const [match, keyOf] of tiers) {
    if (out.length >= n) break;
    const groups = new Map<string, StoredDeck[]>();
    for (const s of sorted) {
      if (used.has(s.file)) continue;
      const k = keyOf(s.deck);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }
    const buckets = new Map<string, [StoredDeck, StoredDeck][]>();
    for (const k of [...groups.keys()].sort()) {
      for (const [x, y] of cross(groups.get(k)!, `review:packets:${seed}:${match}:${k}`)) {
        const vp = [x.deck.version, y.deck.version].sort().join(' vs ');
        if (!buckets.has(vp)) buckets.set(vp, []);
        buckets.get(vp)!.push([x, y]);
      }
    }
    const queues = [...buckets.keys()]
      .sort()
      .map((vp) => shuffled(buckets.get(vp)!, `review:packets:${seed}:${match}:${vp}`));
    let progress = true;
    while (out.length < n && progress) {
      progress = false;
      for (const q of queues) {
        if (out.length >= n) break;
        while (q.length) {
          const [x, y] = q.shift()!;
          if (used.has(x.file) || used.has(y.file)) continue;
          used.add(x.file);
          used.add(y.file);
          // A seeded coin per pair decides which deck is A.
          const flip = rng(hash32(`review:packets:${seed}:ab:${x.file}|${y.file}`))() < 0.5;
          out.push(flip ? { A: y, B: x, match } : { A: x, B: y, match });
          progress = true;
          break;
        }
      }
    }
  }
  return out;
}

export function inventoryOf(decks: readonly StoredDeck[]): InventoryRow[] {
  const rows = new Map<string, InventoryRow>();
  for (const { deck: d } of decks) {
    const kind = poolKindOf(d.pool.source);
    const style = styleOf(d.request);
    const k = [d.version, d.request.size, style, kind].join('|');
    const row = rows.get(k) ?? {
      version: d.version,
      size: d.request.size,
      style,
      kind,
      built: 0,
      declined: 0,
      substituted: 0,
    };
    if (d.error) row.declined++;
    else if (builtAnotherStyle(d.request, d.deck.archetype)) {
      row.declined++;
      row.substituted = (row.substituted ?? 0) + 1;
    } else row.built++;
    rows.set(k, row);
  }
  return [...rows.keys()].sort().map((k) => rows.get(k)!);
}

function deckRef(s: StoredDeck, cards: readonly ListedCard[]): DeckRef {
  const d = s.deck;
  return {
    file: s.file,
    version: d.version,
    pool: { id: d.pool.id, source: d.pool.source, kind: poolKindOf(d.pool.source) },
    request: d.request,
    archetype: d.deck.archetype,
    copies: copiesOf(cards),
  };
}

export interface MakeBatchInput extends Omit<BatchOptions, 'decks'> {
  batch: string;
  decks: StoredDeck[];
  /** The decks spec, recorded in the key. */
  decksSpec: string;
  index: Pick<CardIndex, 'get' | 'find'>;
  basicNames?: Record<Color, string>;
  dataVersion?: string;
  rubric?: string;
}

/** Everything a batch writes, computed without touching the disk. */
export function makeBatch(input: MakeBatchInput): Batch {
  const { seed } = input;
  const { selected, scope, notes } = selectDecks(input.decks, input);
  const lists = new Map<string, ListedCard[]>();
  const listFor = (s: StoredDeck) => {
    let l = lists.get(s.file);
    if (!l) lists.set(s.file, (l = listDeck(s.deck, input.index, input.basicNames)));
    return l;
  };

  // The same share of every version's decks gets a second judge, so agreement is not mostly anchors.
  const dupOf = groupBy(selected, (s) => s.deck.version).flatMap(([v, g]) =>
    shuffled(g, `review:packets:${seed}:two-judges:${v}`).slice(
      0,
      Math.round(g.length * input.twoJudges),
    ),
  );
  // Singles and their second copies share one shuffled numbering, so neither order nor number gives a deck away.
  const singles = shuffled(
    [...selected.map((s) => ({ s, dup: false })), ...dupOf.map((s) => ({ s, dup: true }))],
    `review:packets:${seed}:single-numbers`,
  );
  const width = Math.max(4, String(singles.length).length);
  const primaryId = new Map<string, string>();
  singles.forEach((x, i) => {
    if (!x.dup) primaryId.set(x.s.file, `p-${pad(i + 1, width)}`);
  });

  const packets: Packet[] = [];
  const keyed: Record<string, KeyEntry> = {};
  singles.forEach((x, i) => {
    const id = `p-${pad(i + 1, width)}`;
    const entry: SingleKey = { kind: 'single', ...deckRef(x.s, listFor(x.s)) };
    if (x.dup) entry.duplicateOf = primaryId.get(x.s.file)!;
    keyed[id] = entry;
    packets.push({
      id,
      kind: 'single',
      text: renderSinglePacket(id, x.s.deck, input.index, input.basicNames),
    });
  });

  const pairs = shuffled(
    choosePairs(scope, input.pairs, seed),
    `review:packets:${seed}:pair-numbers`,
  );
  if (pairs.length < input.pairs) notes.push(`pairs: ${pairs.length} of ${input.pairs} found`);
  const pw = Math.max(4, String(pairs.length).length);
  pairs.forEach((p, i) => {
    const id = `pair-${pad(i + 1, pw)}`;
    keyed[id] = {
      kind: 'pair',
      pair: { A: deckRef(p.A, listFor(p.A)), B: deckRef(p.B, listFor(p.B)), match: p.match },
    };
    packets.push({
      id,
      kind: 'pair',
      text: renderPairPacket(id, p.A.deck, p.B.deck, input.index, input.basicNames),
    });
  });

  const options: BatchOptions = {
    decks: input.decksSpec,
    seed,
    ...(input.quota !== undefined ? { quota: input.quota } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
    pairs: input.pairs,
    twoJudges: input.twoJudges,
    anchors: input.anchors,
  };
  const key: BatchKey = {
    batch: input.batch,
    options,
    ...(input.dataVersion ? { dataVersion: input.dataVersion } : {}),
    ...(input.rubric !== undefined
      ? { rubricHash: hash32(input.rubric).toString(16).padStart(8, '0') }
      : {}),
    packets: keyed,
    inventory: inventoryOf(input.decks),
    notes,
  };
  return { packets, key, index: packets.map((p) => ({ id: p.id, kind: p.kind })) };
}

/** Write packets, the folder index, the judge prompt, and the key (outside the packet folder). */
export function writeBatch(
  b: Batch,
  opts: { packetsDir?: string; keysDir?: string; rubric: string; force?: boolean },
): { dir: string; keyFile: string } {
  const dir = path.join(opts.packetsDir ?? PACKETS_DIR, b.key.batch);
  const keyFile = path.join(opts.keysDir ?? KEYS_DIR, `${b.key.batch}.json`);
  if (existsSync(dir) || existsSync(keyFile)) {
    if (!opts.force)
      throw new Error(`batch "${b.key.batch}" exists; pick another name or pass --force`);
    // Only files this tool writes go, so a stray file in the folder survives.
    if (existsSync(dir))
      for (const f of readdirSync(dir))
        if (/^(p|pair)-\d+\.md$/.test(f) || f === 'index.json' || f === 'PROMPT.md')
          rmSync(path.join(dir, f));
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.dirname(keyFile), { recursive: true });
  for (const p of b.packets) writeFileSync(path.join(dir, `${p.id}.md`), p.text);
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify(b.index, null, 2) + '\n');
  writeFileSync(path.join(dir, 'PROMPT.md'), judgePrompt(b.key.batch, opts.rubric));
  writeFileSync(keyFile, JSON.stringify(b.key, null, 2) + '\n');
  return { dir, keyFile };
}

// ---------------------------------------------------------------- command line

const USAGE = `Usage: npm run review:packets -- --batch <name> (--quota <n> | --plan <plan.json>)
  [--decks data/review/decks] [--seed 1] [--pairs 0] [--two-judges 0.25]
  [--anchors 25 | --no-anchors] [--out data/review/packets] [--force]`;

function readPlan(file: string): PlanEntry[] {
  const raw = JSON.parse(readFileSync(path.resolve(ROOT, file), 'utf8')) as unknown;
  if (!Array.isArray(raw)) throw new Error(`${file}: a plan is an array of entries`);
  return raw.map((e, i) => {
    const x = e as Partial<PlanEntry>;
    if (typeof x.version !== 'string' || typeof x.count !== 'number' || x.count < 0)
      throw new Error(`${file}: entry ${i + 1} needs "version" and a "count" of 0 or more`);
    return x as PlanEntry;
  });
}

function wholeNumber(name: string, fallback: number): number {
  const v = arg(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a whole number`);
  return n;
}

function main(): number {
  const batch = arg('batch');
  if (!batch || !/^[A-Za-z0-9._-]+$/.test(batch)) {
    console.error(`${USAGE}\n--batch takes letters, digits, dots, dashes, and underscores.`);
    return 2;
  }
  let seed: number, pairs: number, quota: number | undefined, plan: PlanEntry[] | undefined;
  let twoJudges: number, anchors: number;
  try {
    seed = wholeNumber('seed', 1);
    pairs = wholeNumber('pairs', 0);
    anchors = flag('no-anchors') ? 0 : wholeNumber('anchors', DEFAULT_ANCHORS);
    quota = arg('quota') !== undefined ? wholeNumber('quota', 0) : undefined;
    const planFile = arg('plan');
    plan = planFile ? readPlan(planFile) : undefined;
    twoJudges = Number(arg('two-judges') ?? 0.25);
    if (!(twoJudges >= 0 && twoJudges <= 1)) throw new Error('--two-judges is a share from 0 to 1');
  } catch (err) {
    console.error(`${(err as Error).message}\n${USAGE}`);
    return 2;
  }
  if ((quota === undefined) === (plan === undefined)) {
    console.error(`Give exactly one of --quota and --plan.\n${USAGE}`);
    return 2;
  }
  const decksSpec = arg('decks') ?? 'data/review/decks';
  const files = findDeckFiles(decksSpec);
  if (!files.length) {
    console.error(`no deck files match ${decksSpec}`);
    return 1;
  }
  const { decks, skipped } = readDecks(files);
  const ctx = loadReviewContext();
  const rubric = readFileSync(RUBRIC_FILE, 'utf8');
  const b = makeBatch({
    batch,
    decks,
    decksSpec,
    index: ctx.index,
    basicNames: ctx.config.landRules.basics.names,
    dataVersion: ctx.pack.version,
    rubric,
    seed,
    ...(quota !== undefined ? { quota } : {}),
    ...(plan ? { plan } : {}),
    pairs,
    twoJudges,
    anchors,
  });
  b.key.notes.push(...skipped.map((s) => `skipped ${s}`));
  let where: { dir: string; keyFile: string };
  try {
    const out = arg('out');
    where = writeBatch(b, {
      rubric,
      force: flag('force'),
      ...(out ? { packetsDir: path.resolve(ROOT, out) } : {}),
    });
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  const singles = Object.values(b.key.packets).filter((e): e is SingleKey => e.kind === 'single');
  const versions = [...new Set(decks.map((s) => s.deck.version))].sort();
  for (const v of versions) {
    const rows = b.key.inventory.filter((r) => r.version === v);
    const built = rows.reduce((n, r) => n + r.built, 0);
    const declined = rows.reduce((n, r) => n + r.declined, 0);
    const other = rows.reduce((n, r) => n + (r.substituted ?? 0), 0);
    const picked = singles.filter((e) => e.version === v && !e.duplicateOf).length;
    console.log(
      `${v}: ${built + declined} found, ${declined} declined${other ? ` (${other} built another style)` : ''}, ${picked} picked`,
    );
  }
  const dups = singles.filter((e) => e.duplicateOf).length;
  const pairCount = b.packets.length - singles.length;
  console.log(
    `${b.packets.length} packets: ${singles.length - dups} decks, ${dups} second copies, ${pairCount} pairs`,
  );
  for (const n of b.key.notes) console.log(`note: ${n}`);
  const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');
  console.log(`wrote ${rel(where.dir)}/ (packets, index.json, PROMPT.md)`);
  console.log(`wrote ${rel(where.keyFile)} (answer key; judges never read it)`);
  return 0;
}

// Run only as a script, so tests and the collator can import the pieces.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/packets.ts')) {
  process.exitCode = main();
}
