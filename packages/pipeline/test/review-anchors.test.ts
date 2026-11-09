import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addToPool,
  BuildError,
  CardIndex,
  emptyPool,
  templateFor,
  type CardRecord,
  type Color,
  type DataPack,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import { loadConfigDir } from '../src/check-config.ts';
import { hash32, ROOT, type CorpusDeck } from '../src/corpus.ts';
import { randomDeck, splitBasics } from '../src/review/algos/random.ts';
import {
  candidatesFor,
  fileStem,
  groupOf,
  realDeck,
  realFileName,
  realSeed,
  selectAnchors,
  spreadSample,
} from '../src/review/anchors.ts';
import type { ReviewRequest, ReviewSize } from '../src/review/version.ts';

// The committed config/ holds the land formula and basic names; no data pack is read.
const CONFIG = loadConfigDir(path.join(ROOT, 'config'));
const SETTINGS: Settings = {
  maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
  unlimitedBasics: true,
  includeUnsets: false,
  showArt: false,
};

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Zombie',
    text: '',
    colors: ['B'],
    identity: ['B'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{B}',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

function mono(color: Color, i: number): CardRecord {
  const mv = 1 + (i % 6);
  return card({
    id: `${color.toLowerCase()}-${i}`,
    name: `Test ${color} ${String(i).padStart(2, '0')}`,
    mv,
    manaCost: `{${mv - 1}}{${color}}`,
    colors: [color],
    identity: [color],
  });
}

const BASICS = (['W', 'U', 'B', 'R', 'G'] as const).map((c) =>
  card({
    id: `basic-${c}`,
    name: CONFIG.landRules.basics.names[c],
    mv: 0,
    manaCost: '',
    typeLine: `Basic Land — ${CONFIG.landRules.basics.names[c]}`,
    types: ['land'],
    colors: [],
    identity: [c],
    produces: [c],
  }),
);
const COMMANDER = card({
  id: 'commander',
  name: 'Test Elf Lord',
  mv: 3,
  manaCost: '{1}{B}{G}',
  typeLine: 'Legendary Creature — Elf Noble',
  colors: ['B', 'G'],
  identity: ['B', 'G'],
});
const GOLD = card({
  id: 'gold',
  name: 'Test Gold',
  manaCost: '{B}{G}',
  colors: ['B', 'G'],
  identity: ['B', 'G'],
});
const OFF = {
  unset: card({ id: 'unset', name: 'Test Unset', unset: true }),
  banned: card({ id: 'banned', name: 'Test Banned', commanderLegality: 'banned' }),
  // A hybrid card casts for black alone, but its identity is black and red.
  identity: card({
    id: 'hybrid',
    name: 'Test Hybrid',
    manaCost: '{1}{B/R}',
    colors: ['B', 'R'],
    identity: ['B', 'R'],
  }),
  land: card({
    id: 'nonbasic',
    name: 'Test Swamp Two',
    mv: 0,
    manaCost: '',
    typeLine: 'Land',
    types: ['land'],
    colors: [],
    identity: ['B'],
    produces: ['B'],
  }),
};
const BLACK = Array.from({ length: 40 }, (_, i) => mono('B', i));
const GREEN = Array.from({ length: 40 }, (_, i) => mono('G', i));
const RED = Array.from({ length: 10 }, (_, i) => mono('R', i));
const ARTIFACTS = Array.from({ length: 5 }, (_, i) =>
  card({
    id: `artifact-${i}`,
    name: `Test Artifact ${i}`,
    manaCost: '{2}',
    typeLine: 'Artifact',
    types: ['artifact'],
    colors: [],
    identity: [],
  }),
);
const ALL = [
  ...BASICS,
  COMMANDER,
  GOLD,
  ...Object.values(OFF),
  ...BLACK,
  ...GREEN,
  ...RED,
  ...ARTIFACTS,
];
const PACK: DataPack = {
  schema: 2,
  version: '2026-01-01',
  builtAt: '2026-01-01',
  cardCount: ALL.length,
  cards: ALL,
};
const INDEX = new CardIndex(PACK);

function poolOf(cards: readonly CardRecord[], qty: number): Pool {
  return addToPool(
    emptyPool('t'),
    cards.map((c) => ({ cardId: c.id, qty })),
    't',
  );
}

const POOL = poolOf(ALL, 3);

function req(size: ReviewSize, colors: Color[], seed = 1, commander?: string): ReviewRequest {
  return { size, colors, seed, ...(commander ? { commander } : {}) };
}

function check(request: ReviewRequest, pool = POOL) {
  const built = randomDeck(pool, request, INDEX, CONFIG, SETTINGS);
  const lands = Object.values(built.basics).reduce((n, q) => n + (q ?? 0), 0);
  const spells = built.cards.reduce((n, c) => n + c.qty, 0);
  expect(spells + lands).toBe(request.size);
  const formula = templateFor(CONFIG, request.size).landFormula;
  expect(lands).toBeGreaterThanOrEqual(formula.min);
  expect(lands).toBeLessThanOrEqual(formula.max);
  const limit = SETTINGS.maxCopies[request.size];
  for (const c of built.cards) {
    const record = INDEX.get(c.id)!;
    expect(record.identity.every((x) => request.colors.includes(x))).toBe(true);
    expect(c.qty).toBeLessThanOrEqual(Math.min(limit, pool.entries[c.id]!.qty));
    expect(record.types).not.toContain('land');
    expect(c.why).toBe(c.id === request.commander ? 'Commander' : 'random');
  }
  for (const c of Object.keys(built.basics)) expect(request.colors).toContain(c);
  const ids = built.cards.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of [OFF.unset.id, OFF.identity.id, OFF.land.id]) expect(ids).not.toContain(id);
  return built;
}

describe('random anchor version', () => {
  it('builds a legal 60-card pile in the requested colors, the same for the same seed', () => {
    const a = check(req(60, ['B']));
    expect(a.basics).toEqual({ B: expect.any(Number) });
    expect(a.archetype).toBe('none');
    // 40 black cards, 5 artifacts, and the Commander-banned card; no Un-set, hybrid, land, or gold card.
    expect(a.explanation).toMatchObject({ eligibleCards: 46 });
    expect(randomDeck(POOL, req(60, ['B']), INDEX, CONFIG, SETTINGS)).toEqual(a);
    const b = check(req(60, ['B'], 2));
    expect(b.cards).not.toEqual(a.cards);
  });

  it('keeps 40 and 20-card copy limits and the land formula', () => {
    check(req(40, ['B', 'G']));
    const twenty = check(req(20, ['G']));
    for (const c of twenty.cards) expect(c.qty).toBeLessThanOrEqual(2);
  });

  it('builds a singleton 100-card pile under a commander, with no banned cards', () => {
    const built = check(req(100, ['B', 'G'], 1, COMMANDER.id));
    expect(built.commander).toBe(COMMANDER.id);
    expect(built.cards[0]).toEqual({ id: COMMANDER.id, qty: 1, why: 'Commander' });
    for (const c of built.cards) expect(c.qty).toBe(1);
    expect(built.cards.map((c) => c.id)).not.toContain(OFF.banned.id);
    expect(Object.keys(built.basics).sort()).toEqual(['B', 'G']);
  });

  it('refuses a pool too small for the deck, and a commander not in the pool', () => {
    const small = poolOf(BLACK.slice(0, 5), 4);
    expect(() => randomDeck(small, req(60, ['B']), INDEX, CONFIG, SETTINGS)).toThrow(BuildError);
    expect(() =>
      randomDeck(small, req(100, ['B', 'G'], 1, COMMANDER.id), INDEX, CONFIG, SETTINGS),
    ).toThrow(/not in your bulk list/);
  });
});

describe('splitBasics', () => {
  it('splits by pips, gives every color with pips a basic, and splits evenly with none', () => {
    expect(splitBasics(17, { B: 30, G: 10 }, ['B', 'G'])).toEqual({ B: 13, G: 4 });
    expect(splitBasics(17, { B: 60, G: 1 }, ['B', 'G'])).toEqual({ B: 16, G: 1 });
    expect(splitBasics(8, {}, ['U', 'R'])).toEqual({ U: 4, R: 4 });
    expect(splitBasics(7, { W: 1, U: 1 }, ['W', 'U'])).toEqual({ W: 4, U: 3 });
  });
});

function deck(partial: Partial<CorpusDeck> & Pick<CorpusDeck, 'id' | 'size'>): CorpusDeck {
  return { source: 'precon', kind: 'Theme Deck', name: partial.id, cards: [], ...partial };
}

// Draft records as [wins, games]: only [7, 9] meets the first bar; [6, 9] and [6, 6] meet the second.
const RECORDS: [number, number][] = [
  [7, 10],
  [8, 11],
  [7, 9],
  [6, 9],
  [6, 6],
  [5, 9],
  [3, 6],
  [2, 5],
  [1, 4],
  [0, 3],
];

const CORPUS: CorpusDeck[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    deck({
      id: `precon:Cmd${i}_C${i % 4}`,
      size: 100,
      kind: i === 11 ? 'MTGO Commander Deck' : 'Commander Deck',
      released: `${2011 + (i % 4)}-01-01`,
      commander: ['c'],
    }),
  ),
  deck({ id: 'precon:Partners_C9', size: 100, kind: 'Commander Deck', commander: ['a', 'b'] }),
  deck({ id: 'local:mine', size: 100, source: 'local', kind: 'Local list', commander: ['c'] }),
  ...Array.from({ length: 9 }, (_, i) =>
    deck({ id: `precon:Sixty${i}_S${i}`, size: 60, kind: ['Theme Deck', 'Intro Pack'][i % 2]! }),
  ),
  ...Array.from({ length: 30 }, (_, i) =>
    deck({
      id: `draft:${['AAA', 'BBB', 'CCC'][i % 3]}:${String(i).padStart(4, '0')}:0`,
      size: 40,
      source: 'draft',
      kind: 'Draft',
      wins: RECORDS[i % 10]![0],
      games: RECORDS[i % 10]![1],
    }),
  ),
  deck({ id: 'precon:Welcome_W16', size: 40, kind: 'Welcome Deck' }),
  ...Array.from({ length: 6 }, (_, i) =>
    deck({ id: `precon:Pack${i}_J${i % 2}`, size: 20, kind: 'Jumpstart' }),
  ),
];

describe('real anchor selection', () => {
  it('takes Commander precons with one commander, never the owner lists', () => {
    const c = candidatesFor(CORPUS, 100).map((d) => d.id);
    expect(c).toHaveLength(12);
    expect(c).not.toContain('precon:Partners_C9');
    expect(c).not.toContain('local:mine');
  });

  it('takes draft decks with enough wins in few enough games, else lowers the bar', () => {
    expect(candidatesFor(CORPUS, 40).map((d) => d.id)).toEqual([
      'draft:CCC:0002:0',
      'draft:AAA:0012:0',
      'draft:BBB:0022:0',
    ]);
    const enough = selectAnchors(CORPUS, { 100: 5, 60: 5, 40: 3, 20: 5 });
    expect(enough.find((s) => s.size === 40)!.minWins).toBe(7);
    const sel = selectAnchors(CORPUS, { 100: 5, 60: 5, 40: 4, 20: 5 });
    const forty = sel.find((s) => s.size === 40)!;
    expect(forty.minWins).toBe(6);
    expect(forty.candidates).toBe(9);
    expect(forty.chosen).toHaveLength(4);
    for (const d of forty.chosen) {
      expect(d.source).toBe('draft');
      expect(d.wins).toBeGreaterThanOrEqual(6);
      expect(d.games).toBeLessThanOrEqual(9);
    }
    expect(sel.find((s) => s.size === 20)!.candidates).toBe(6);
  });

  it('samples with the review seed, spread over groups, the same for any input order', () => {
    const sel = selectAnchors(CORPUS, { 100: 8, 60: 4, 40: 2, 20: 4 });
    const hundred = sel.find((s) => s.size === 100)!;
    expect(hundred.chosen).toHaveLength(8);
    expect(hundred.excluded).toBe('1 with two commanders');
    // Four release years, so eight picks take two from each.
    const years = new Map<string, number>();
    for (const d of hundred.chosen) years.set(groupOf(d), (years.get(groupOf(d)) ?? 0) + 1);
    expect([...years.values()]).toEqual([2, 2, 2, 2]);
    const again = selectAnchors([...CORPUS].reverse(), { 100: 8, 60: 4, 40: 2, 20: 4 });
    expect(again.map((s) => s.chosen.map((d) => d.id))).toEqual(
      sel.map((s) => s.chosen.map((d) => d.id)),
    );
    expect(realSeed(60)).toBe(hash32('review:real:60'));
  });

  it('spreads round-robin and stops when it runs out', () => {
    const items = ['a1', 'a2', 'a3', 'b1', 'c1'];
    const got = spreadSample(
      items,
      (s) => s[0]!,
      (s) => s,
      3,
      1,
    );
    expect(new Set(got.map((s) => s[0]))).toEqual(new Set(['a', 'b', 'c']));
    expect(
      spreadSample(
        items,
        (s) => s[0]!,
        (s) => s,
        99,
        1,
      ).sort(),
    ).toEqual([...items].sort());
    const seeds = [1, 2, 3, 4, 5, 6];
    const outs = seeds.map((seed) =>
      spreadSample(
        items,
        (s) => s[0]!,
        (s) => s,
        3,
        seed,
      ).join(),
    );
    expect(new Set(outs).size).toBeGreaterThan(1);
  });
});

describe('realDeck', () => {
  it('moves basics out, adds the commander, and takes the commander identity at 100', () => {
    const corpus = deck({
      id: 'precon:Elves_C1',
      size: 100,
      kind: 'Commander Deck',
      commander: [COMMANDER.id],
      cards: [
        ...BLACK.slice(0, 30).map((c): [string, number] => [c.id, 1]),
        ...GREEN.slice(0, 30).map((c): [string, number] => [c.id, 1]),
        [OFF.land.id, 1],
        [BASICS[2]!.id, 20],
        [BASICS[4]!.id, 18],
      ],
    });
    const { review, commanderName } = realDeck(corpus, INDEX, CONFIG, 'now');
    expect(review.version).toBe('real');
    expect(review.pool).toMatchObject({ id: 'precon:Elves_C1', source: 'corpus', cards: 100 });
    expect(review.request).toEqual({
      size: 100,
      colors: ['B', 'G'],
      commander: COMMANDER.id,
      seed: 0,
    });
    expect(review.deck.basics).toEqual({ B: 20, G: 18 });
    expect(review.deck.cards[0]).toEqual({
      id: COMMANDER.id,
      name: COMMANDER.name,
      qty: 1,
      why: 'Commander',
    });
    expect(review.deck.cards.map((c) => c.id)).toContain(OFF.land.id);
    expect(review.versionNotes).toContain('Commander Deck');
    expect(realFileName(review, commanderName)).toBe(
      'precon-Elves_C1-BG-100-bestfit-test-elf-lord-s0.json',
    );
  });

  it('takes the colors the spells pay and the lands make, and notes a draft record', () => {
    const corpus = deck({
      id: 'draft:AAA:0001:0',
      size: 40,
      source: 'draft',
      kind: 'Draft',
      wins: 7,
      games: 8,
      // The black land adds no color by itself, the {B/R} card is paid with red, and
      // the green card has no land to cast it: the deck is red.
      cards: [
        ...RED.slice(0, 9).map((c): [string, number] => [c.id, 2]),
        [OFF.identity.id, 1],
        [GREEN[0]!.id, 1],
        [ARTIFACTS[0]!.id, 2],
        [OFF.land.id, 1],
        [BASICS[3]!.id, 17],
      ],
    });
    const { review } = realDeck(corpus, INDEX, CONFIG, 'now');
    expect(review.request.colors).toEqual(['R']);
    expect(review.versionNotes).toContain('7 wins in 8 games');
    expect(fileStem(corpus.id)).toBe('draft-AAA-0001-0');
    let n = 0;
    for (const c of review.deck.cards) n += c.qty;
    expect(n + review.deck.basics.R!).toBe(40);
  });
});
