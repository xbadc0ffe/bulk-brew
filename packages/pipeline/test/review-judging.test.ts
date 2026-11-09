import { describe, expect, it } from 'vitest';
import { CardIndex, type CardRecord, type Color, type DataPack } from '@bulk-brew/core';
import {
  checkPair,
  checkSingle,
  collate,
  deadCopies,
  parseAnswer,
  renderCollation,
  type AnswerFile,
  type SingleAnswer,
} from '../src/review/collate.ts';
import {
  builtAnotherStyle,
  choosePairs,
  inventoryOf,
  makeBatch,
  packetCard,
  poolKindOf,
  renderPairPacket,
  renderSinglePacket,
  shuffled,
  type BatchKey,
  type SingleKey,
  type StoredDeck,
} from '../src/review/packets.ts';
import type { ReviewDeck, ReviewSize } from '../src/review/version.ts';

// One marker per field that could give a version or an anchor away
// (docs/review/anchors.md), plus the builder's view of cards; none may reach a packet.
const SECRETS = [
  'WHY_SECRET',
  'ARCH_SECRET',
  'NAME_SECRET',
  'POOL_SECRET',
  'HASH_SECRET',
  'VER_SECRET',
  'NOTES_SECRET',
  'EXPL_SECRET',
  'FILE_SECRET',
  'STYLE_SECRET',
  'SEC_SECRET',
  'BUILT_SECRET',
  'TAG_SECRET',
  'mythic',
  'rarity',
  'strength',
  '987654',
  'eval/pools',
];

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
    tags: ['TAG_SECRET'],
    rarity: 'mythic',
    rank: 987654,
    img: 'x',
    manaCost: '{1}{B}',
    ...partial,
  };
}

const LOOTER = card({
  id: 'looter',
  name: 'Grave Looter',
  power: '1',
  toughness: '2',
  keywords: ['Flying'],
  text: 'Flying\n{T}: Draw a card, then discard a card.',
});
const SPLIT = card({
  id: 'split',
  name: 'Fire // Ice',
  layout: 'split',
  typeLine: 'Instant // Instant',
  types: ['instant'],
  manaCost: '{1}{R} // {1}{U}',
  text: 'Fire deals 2 damage divided as you choose.\n//\nTap target permanent.',
  faces: [
    {
      name: 'Fire',
      manaCost: '{1}{R}',
      typeLine: 'Instant',
      text: 'Fire deals 2 damage divided as you choose.',
      colors: ['R'],
    },
    {
      name: 'Ice',
      manaCost: '{1}{U}',
      typeLine: 'Instant',
      text: 'Tap target permanent.\nDraw a card.',
      colors: ['U'],
    },
  ],
});
const WALKER = card({
  id: 'walker',
  name: 'Lili the Tester',
  typeLine: 'Legendary Planeswalker — Lili',
  types: ['planeswalker'],
  loyalty: '3',
  text: '+1: Each opponent loses 1 life.',
});
const basic = (id: string, name: string, c: Color): CardRecord =>
  card({
    id,
    name,
    typeLine: `Basic Land — ${name}`,
    types: ['land'],
    mv: 0,
    text: `({T}: Add {${c}}.)`,
    colors: [],
    identity: [c],
  });
const { manaCost: _unused, ...SWAMP_BASE } = basic('swamp', 'Swamp', 'B');
const SNOW_SWAMP: CardRecord = {
  ...basic('snow-swamp', 'Snow-Covered Swamp', 'B'),
  typeLine: 'Basic Snow Land — Swamp',
};
const FROST = card({ id: 'frost', name: 'Frost Tester', text: '{S}: This gets +1/+0.' });
const CARDS = [
  LOOTER,
  SPLIT,
  WALKER,
  SWAMP_BASE as CardRecord,
  basic('plains', 'Plains', 'W'),
  basic('island', 'Island', 'U'),
  SNOW_SWAMP,
  FROST,
];
const PACK: DataPack = {
  schema: 2,
  version: 'test',
  builtAt: 'test',
  cardCount: CARDS.length,
  cards: CARDS,
};
const INDEX = new CardIndex(PACK);

interface FakeDeck {
  version?: string;
  source?: string;
  poolId?: string;
  size?: ReviewSize;
  colors?: Color[];
  style?: string;
  archetype?: string;
  error?: string;
  seed?: number;
}

function stored(file: string, o: FakeDeck = {}): StoredDeck {
  const d: ReviewDeck = {
    version: o.version ?? 'VER_SECRET',
    versionNotes: 'NOTES_SECRET',
    pool: {
      id: o.poolId ?? 'POOL_SECRET',
      source: o.source ?? 'eval/pools/POOL_SECRET.txt',
      hash: 'HASH_SECRET',
      cards: 300,
    },
    request: {
      size: o.size ?? 60,
      colors: o.colors ?? ['B'],
      ...(o.style ? { style: o.style, secondary: 'SEC_SECRET' } : {}),
      seed: o.seed ?? 1,
    },
    deck: o.error
      ? { name: '', archetype: '', cards: [], basics: {} }
      : {
          name: 'NAME_SECRET',
          archetype: o.archetype ?? 'ARCH_SECRET',
          cards: [
            { id: 'looter', name: 'Grave Looter', qty: 4, why: 'WHY_SECRET' },
            { id: 'split', name: 'Fire // Ice', qty: 2, why: 'WHY_SECRET' },
            { id: 'walker', name: 'Lili the Tester', qty: 1, why: 'WHY_SECRET' },
          ],
          basics: { B: 20 },
        },
    buildMs: 5,
    explanation: { note: 'EXPL_SECRET' },
    ...(o.error ? { error: o.error } : {}),
    builtAt: 'BUILT_SECRET',
    dataVersion: 'test',
  };
  return { file, deck: d };
}

describe('packets show only printed card facts', () => {
  it('copies only the fields a judge may see', () => {
    const p = packetCard(LOOTER);
    expect(Object.keys(p).sort()).toEqual(
      ['keywords', 'manaCost', 'mv', 'name', 'power', 'text', 'toughness', 'typeLine'].sort(),
    );
  });

  it('renders a single packet with copies, costs, stats, every face, and no builder field', () => {
    const d = stored('d/FILE_SECRET-a.json', { style: 'STYLE_SECRET' }).deck;
    const text = renderSinglePacket('p-0001', d, INDEX);
    for (const s of SECRETS) expect(text).not.toContain(s);
    expect(text).toContain('- Size: 60 cards');
    expect(text).toContain('- Colors: Black (B)');
    expect(text).toContain('### Creatures (4)');
    expect(text).toContain('### Lands (20)');
    expect(text).toContain('20 Swamp');
    expect(text).toContain('Copies: 4\nCost: {1}{B} (mana value 2)');
    expect(text).toContain('Power/toughness: 1/2');
    expect(text).toContain('Keywords: Flying');
    expect(text).toContain('> {T}: Draw a card, then discard a card.');
    expect(text).toContain('Face 1: Fire\nCost: {1}{R}');
    expect(text).toContain('Face 2: Ice\nCost: {1}{U}');
    expect(text).toContain('> Tap target permanent.\n> Draw a card.');
    expect(text).toContain('Loyalty: 3');
    expect(text).toContain('Cost: none (mana value 0)');
    expect(text).toContain('> ({T}: Add {B}.)');
  });

  it('renders a pair packet with both lists and copies per deck', () => {
    const a = stored('d/a.json').deck;
    const b = stored('d/b.json').deck;
    b.deck.cards = b.deck.cards.filter((c) => c.id !== 'walker');
    const text = renderPairPacket('pair-0001', a, b, INDEX);
    for (const s of SECRETS) expect(text).not.toContain(s);
    expect(text).toContain('## Deck A (27 cards)');
    expect(text).toContain('## Deck B (26 cards)');
    expect(text).toContain('Copies: A 1, B 0');
    expect(text.match(/^### Grave Looter$/gm)).toHaveLength(1);
  });

  it('says so when a card is missing from the pack', () => {
    const d = stored('d/a.json').deck;
    d.deck.cards.push({ id: 'gone', name: 'Lost Card', qty: 1 });
    expect(renderSinglePacket('p-0001', d, INDEX)).toContain(
      '### Lost Card\n\nCopies: 1\nText missing from the data pack.',
    );
  });

  it('shows snow basics as plain ones unless a card reads snow, and each name once', () => {
    const d = stored('d/a.json').deck;
    d.deck.cards.push(
      { id: 'snow-swamp', name: 'Snow-Covered Swamp', qty: 3 },
      { id: 'swamp', name: 'Swamp', qty: 1 },
      { id: 'looter', name: 'Grave Looter', qty: 1 },
    );
    const plain = renderSinglePacket('p-0001', d, INDEX);
    expect(plain).not.toContain('Snow-Covered');
    expect(plain).toContain('\n24 Swamp\n');
    expect(plain).toContain('\n5 Grave Looter\n');
    expect(plain.match(/^### (Swamp|Grave Looter)$/gm)).toHaveLength(2);
    d.deck.cards.push({ id: 'frost', name: 'Frost Tester', qty: 1 });
    const snowy = renderSinglePacket('p-0001', d, INDEX);
    expect(snowy).toContain('\n3 Snow-Covered Swamp\n');
    expect(snowy).toContain('\n21 Swamp\n');
  });

  it("shows the deck's own colors, and the request's in files without them", () => {
    const d = stored('d/a.json', { colors: ['W', 'B'] }).deck;
    expect(renderSinglePacket('p-0001', d, INDEX)).toContain('- Colors: White and Black (WB)');
    d.deck.colors = ['B'];
    expect(renderSinglePacket('p-0001', d, INDEX)).toContain('- Colors: Black (B)\n');
    const old = stored('d/b.json', { colors: ['W', 'B'] }).deck;
    const pair = renderPairPacket('pair-0001', d, old, INDEX);
    expect(pair).toContain('Two decks of the same size, labeled A and B');
    expect(pair).toContain('- Colors: Deck A Black (B); Deck B White and Black (WB)');
  });

  it('reads the pool kind from where the pool file lives', () => {
    expect(poolKindOf('data/review/pools/plain/plain-01.json')).toBe('plain');
    expect(poolKindOf('data/review/pools/owner/b.json')).toBe('owner');
    expect(poolKindOf('eval/pools/bulk-black.txt')).toBe('public');
    expect(poolKindOf('test-bulk/mine.txt')).toBe('owner');
    expect(poolKindOf('data/corpus/decks.json')).toBe('other');
  });
});

const DECKS: StoredDeck[] = [
  stored('decks/head/a-60.json', { version: 'head' }),
  stored('decks/head/a-60-gy.json', {
    version: 'head',
    style: 'graveyard',
    archetype: 'graveyard',
  }),
  stored('decks/head/own-60.json', { version: 'head', source: 'test-bulk/own.txt', poolId: 'own' }),
  stored('decks/head/a-40.json', { version: 'head', size: 40, colors: ['W', 'U'] }),
  stored('decks/proto/a-60.json', { version: 'proto' }),
  stored('decks/proto/a-60-gy.json', { version: 'proto', style: 'graveyard', error: 'no theme' }),
  stored('decks/proto/a-40.json', { version: 'proto', size: 40, colors: ['W', 'U'] }),
  stored('decks/random/a-60.json', { version: 'random' }),
  stored('decks/random/a-60-s2.json', { version: 'random', seed: 2 }),
  stored('decks/real/r-40.json', { version: 'real', size: 40, source: 'data/corpus/decks.json' }),
];

function batch(seed = 1, extra: Partial<Parameters<typeof makeBatch>[0]> = {}) {
  return makeBatch({
    batch: 't',
    decks: DECKS,
    decksSpec: 'decks',
    index: INDEX,
    seed,
    // A plan replaces the quota, as on the command line.
    ...(extra.plan ? {} : { quota: 1 }),
    pairs: 2,
    twoJudges: 0.5,
    anchors: 25,
    rubric: 'rubric',
    ...extra,
  });
}

describe('makeBatch', () => {
  it('gives no version, anchor, pool, or file away in any packet', () => {
    const b = batch();
    const telltales = [
      ...SECRETS,
      ...DECKS.flatMap((s) => [s.file, s.file.split('/').pop()!, s.deck.pool.source]),
    ];
    for (const p of b.packets) {
      for (const t of telltales) expect(p.text, `${p.id} shows ${t}`).not.toContain(t);
      for (const v of ['head', 'proto', 'random', 'real', 'bestfit', 'graveyard'])
        expect(p.text, `${p.id} shows ${v}`).not.toMatch(new RegExp(`\\b${v}\\b`, 'i'));
    }
  });

  it('keys every packet, includes every anchor, and skips declined decks', () => {
    const b = batch();
    const ids = b.packets.map((p) => p.id).sort();
    expect(b.index.map((x) => x.id).sort()).toEqual(ids);
    expect(Object.keys(b.key.packets).sort()).toEqual(ids);
    const singles = Object.entries(b.key.packets).filter(
      (e): e is [string, SingleKey] => e[1].kind === 'single',
    );
    for (const [, e] of singles) {
      expect(e.file && e.version && e.pool.id && e.request).toBeTruthy();
      expect(Object.keys(e.copies).length).toBeGreaterThan(0);
    }
    const files = singles.filter(([, e]) => !e.duplicateOf).map(([, e]) => e.file);
    expect(files).toContain('decks/random/a-60.json');
    expect(files).toContain('decks/random/a-60-s2.json');
    expect(files).toContain('decks/real/r-40.json');
    expect(files).not.toContain('decks/proto/a-60-gy.json');
    // quota 1 per version, size, and pool kind: head has 60 public, 60 owner, 40 public; proto 60 and 40 public.
    expect(files.filter((f) => f.startsWith('decks/head/'))).toHaveLength(3);
    expect(files.filter((f) => f.startsWith('decks/proto/'))).toHaveLength(2);
    const declined = b.key.inventory.find((r) => r.version === 'proto' && r.style === 'graveyard');
    expect(declined).toMatchObject({ built: 0, declined: 1 });
  });

  it('records the built style in the key and counts another style as declined', () => {
    const archetypeOf = new Map(DECKS.map((s) => [s.file, s.deck.deck.archetype]));
    for (const e of Object.values(batch().key.packets))
      if (e.kind === 'single') expect(e.archetype).toBe(archetypeOf.get(e.file));
    expect(builtAnotherStyle({ style: 'graveyard' }, 'midrange')).toBe(true);
    expect(builtAnotherStyle({ style: 'graveyard' }, 'graveyard')).toBe(false);
    expect(builtAnotherStyle({ style: 'tribal:Elf' }, 'tribal:Elf')).toBe(false);
    expect(builtAnotherStyle({ style: 'tribal:Elf' }, 'tribal:Goblin')).toBe(true);
    expect(builtAnotherStyle({}, 'midrange')).toBe(false);
    expect(builtAnotherStyle({ style: 'graveyard' }, undefined)).toBe(false);
    const rows = inventoryOf([
      stored('d/1.json', { version: 'p', style: 'graveyard', archetype: 'graveyard' }),
      stored('d/2.json', { version: 'p', style: 'graveyard', archetype: 'midrange' }),
      stored('d/3.json', { version: 'p', style: 'graveyard', error: 'no theme' }),
      stored('d/4.json', { version: 'p', archetype: 'midrange' }),
    ]);
    expect(rows.map((r) => [r.style, r.built, r.declined, r.substituted])).toEqual([
      ['bestfit', 1, 0, 0],
      ['graveyard', 1, 2, 1],
    ]);
  });

  it('caps anchors per version and size', () => {
    const files = (b: ReturnType<typeof batch>) =>
      Object.values(b.key.packets).flatMap((e) =>
        e.kind === 'single' && !e.duplicateOf ? [e.file] : [],
      );
    const one = files(batch(1, { anchors: 1 }));
    expect(one.filter((f) => f.startsWith('decks/random/'))).toHaveLength(1);
    expect(one.filter((f) => f.startsWith('decks/real/'))).toHaveLength(1);
    expect(batch(1, { anchors: 1 }).key.notes.some((n) => n.startsWith('anchors'))).toBe(false);
    expect(batch(1, { anchors: 3 }).key.notes).toContain('anchors random|60: 2 of 3 decks found');
  });

  it('duplicates the asked share of each version under other numbers', () => {
    const b = batch();
    const entries = Object.entries(b.key.packets);
    const singlesOf = (v: string, dup: boolean) =>
      entries.filter(([, e]) => e.kind === 'single' && e.version === v && !!e.duplicateOf === dup);
    for (const v of ['head', 'proto', 'random', 'real'])
      expect(singlesOf(v, true)).toHaveLength(Math.round(singlesOf(v, false).length * 0.5));
    const dups = entries.filter(([, e]) => e.kind === 'single' && e.duplicateOf);
    for (const [id, e] of dups) {
      const s = e as SingleKey;
      const orig = b.key.packets[s.duplicateOf!] as SingleKey;
      expect(orig.file).toBe(s.file);
      expect(orig.duplicateOf).toBeUndefined();
      expect(s.duplicateOf).not.toBe(id);
      const text = (x: string) => b.packets.find((p) => p.id === x)!.text;
      expect(text(id).replace(id, '')).toBe(text(s.duplicateOf!).replace(s.duplicateOf!, ''));
    }
  });

  it('pairs two versions on the same request first, same size and colors always', () => {
    const b = batch();
    const pairs = Object.values(b.key.packets).flatMap((e) => (e.kind === 'pair' ? [e.pair] : []));
    expect(pairs).toHaveLength(2);
    for (const p of pairs) {
      expect(p.A.version).not.toBe(p.B.version);
      expect(p.A.request.size).toBe(p.B.request.size);
      expect(p.A.request.colors).toEqual(p.B.request.colors);
      expect(['random', 'real']).not.toContain(p.A.version);
      expect(p.match).toBe('same-request');
    }
  });

  it('matches looser pairs on the colors each deck was built in', () => {
    const a = stored('decks/head/x.json', { version: 'head', colors: ['W', 'B'] });
    a.deck.deck.colors = ['B'];
    const b = stored('decks/proto/y.json', { version: 'proto', style: 'graveyard' });
    const pairs = choosePairs([a, b], 1, 1);
    expect(pairs.map((p) => p.match)).toEqual(['same-pool']);
  });

  it('is stable for a seed and shuffles differently for another', () => {
    expect(batch(1)).toEqual(batch(1));
    const order = (s: number) =>
      Object.entries(batch(s).key.packets).map(([id, e]) => `${id}:${'file' in e ? e.file : ''}`);
    expect(order(1)).not.toEqual(order(2));
    const ten = Array.from({ length: 10 }, (_, i) => i);
    expect(shuffled(ten, 'x')).toEqual(shuffled(ten, 'x'));
    expect([...shuffled(ten, 'x')].sort((a, b) => a - b)).toEqual(ten);
    expect(shuffled(ten, 'x')).not.toEqual(shuffled(ten, 'y'));
  });

  it('leaves anchors out on request and follows a plan', () => {
    const b = batch(1, {
      plan: [{ version: 'head', size: 60, count: 5 }],
      anchors: 0,
    });
    const files = Object.values(b.key.packets).flatMap((e) =>
      e.kind === 'single' && !e.duplicateOf ? [e.file] : [],
    );
    expect(files.sort()).toEqual([
      'decks/head/a-60-gy.json',
      'decks/head/a-60.json',
      'decks/head/own-60.json',
    ]);
    expect(b.key.notes).toContain('plan entry 1 (head): 3 of 5 decks found');
  });
});

const GOOD: SingleAnswer = {
  plan: 'Loot and grow.',
  setup: [{ card: 'Grave Looter', job: 'loots every turn', strength: 'strong' }],
  payoff: [{ card: 'Ice', job: 'draws', strength: 'weak' }],
  enough_setup: true,
  enough_payoff: true,
  curve: 'good',
  mana: 'ok',
  interaction: 'ok',
  win: 'clear',
  dead: [],
  decent: true,
  score: 4,
  reason: 'It loots. It wins.',
  failures: ['none'],
};
const COPIES = { 'Grave Looter': 4, 'Fire // Ice': 2, 'Lili the Tester': 1, Swamp: 20 };

describe('answer checks', () => {
  it('accepts a valid answer and a face name', () => {
    expect(checkSingle(GOOD, COPIES, 60)).toEqual({ errors: [], warnings: [] });
    expect(checkPair({ better: 'tie', reason: 'Even.' })).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a bad shape', () => {
    const bad = { ...GOOD, score: 6, extra: 1, failures: ['bad-luck'] } as unknown;
    const { errors } = checkSingle(bad);
    expect(errors.join('\n')).toMatch(/extra key "extra"/);
    expect(errors.join('\n')).toMatch(/"score" must be one of/);
    expect(errors.join('\n')).toMatch(/unknown failure "bad-luck"/);
    expect(checkSingle({ ...GOOD, score: 2 }).errors[0]).toMatch(/decent/);
    expect(checkSingle({ ...GOOD, failures: ['none', 'no-win'] }).errors).toHaveLength(1);
    const { reason: _r, ...missing } = GOOD;
    expect(checkSingle(missing).errors).toEqual(['missing "reason"']);
    expect(checkPair({ better: 'C', reason: '' }).errors).toHaveLength(2);
    expect(checkSingle([]).errors).toEqual(['not a JSON object']);
  });

  it('warns on broken consistency rules but keeps the answer', () => {
    const a = {
      ...GOOD,
      enough_setup: false,
      interaction: 'none',
      dead: ['Lili the Tester', 'Grave Looter', 'Nope'],
    };
    const { errors, warnings } = checkSingle(a, COPIES, 60);
    expect(errors).toEqual([]);
    expect(warnings.join('\n')).toMatch(/enough_setup/);
    expect(warnings.join('\n')).toMatch(/no-interaction/);
    expect(warnings.join('\n')).toMatch(/"Grave Looter" is named more than once/);
    expect(warnings.join('\n')).toMatch(/"Nope" is not a card/);
    expect(warnings.join('\n')).toMatch(/5 dead copies without "dead-cards"/);
  });

  it('counts dead copies from the deck list and parses fenced JSON', () => {
    expect(deadCopies(['fire', 'Swamp', 'Swamp'], COPIES)).toBe(22);
    expect(parseAnswer('```json\n{"better":"A","reason":"x"}\n```')).toEqual({
      value: { better: 'A', reason: 'x' },
      warning: 'answer was wrapped in a code fence',
    });
    expect(parseAnswer('nope').error).toMatch(/not valid JSON/);
  });
});

describe('collate', () => {
  const ref = (version: string, file: string, kind = 'public', style?: string) => ({
    file,
    version,
    pool: { id: 'p', source: 's', kind },
    request: { size: 60 as const, colors: ['B' as Color], ...(style ? { style } : {}), seed: 1 },
    copies: COPIES,
  });
  const key: BatchKey = {
    batch: 'tiny',
    options: { decks: 'd', seed: 1, quota: 1, pairs: 3, twoJudges: 0.5, anchors: 25 },
    packets: {
      'p-0001': { kind: 'single', ...ref('head', 'h1') },
      'p-0002': { kind: 'single', ...ref('head', 'h2', 'plain', 'graveyard') },
      'p-0003': { kind: 'single', ...ref('head', 'h3', 'owner') },
      'p-0004': { kind: 'single', ...ref('head', 'h1'), duplicateOf: 'p-0001' },
      'p-0005': { kind: 'single', ...ref('random', 'r1') },
      'p-0006': { kind: 'single', ...ref('random', 'r2') },
      'p-0007': { kind: 'single', ...ref('real', 'x1', 'other') },
      'pair-0001': {
        kind: 'pair',
        pair: { A: ref('head', 'h1'), B: ref('proto', 'q1'), match: 'same-request' },
      },
      'pair-0002': {
        kind: 'pair',
        pair: { A: ref('proto', 'q2'), B: ref('head', 'h2'), match: 'same-request' },
      },
      'pair-0003': {
        kind: 'pair',
        pair: { A: ref('proto', 'q3'), B: ref('head', 'h3'), match: 'same-pool' },
      },
    },
    inventory: [
      { version: 'head', size: 60, style: 'bestfit', kind: 'public', built: 2, declined: 1 },
      { version: 'head', size: 60, style: 'graveyard', kind: 'plain', built: 1, declined: 2 },
    ],
    notes: [],
  };
  const single = (
    score: 1 | 2 | 3 | 4 | 5,
    failures: SingleAnswer['failures'],
    dead: string[] = [],
  ) => JSON.stringify({ ...GOOD, score, decent: score >= 3, failures, dead });
  const answers: AnswerFile[] = [
    { id: 'p-0001', file: 'j/p-0001.json', text: single(4, ['none']) },
    {
      id: 'p-0002',
      file: 'j/p-0002.json',
      text: single(2, ['thin-setup', 'bad-curve'], ['Lili the Tester']),
    },
    { id: 'p-0003', file: 'j/p-0003.json', text: single(1, ['no-plan', 'bad-mana']) },
    { id: 'p-0004', file: 'j/p-0004.json', text: single(2, ['thin-payoff']) },
    { id: 'p-0005', file: 'j/p-0005.json', text: single(1, ['no-plan']) },
    { id: 'p-0006', file: 'j/p-0006.json', text: single(3, ['none']) },
    { id: 'p-0007', file: 'j/p-0007.json', text: '{ "score": 5 }' },
    { id: 'pair-0001', file: 'j/pair-0001.json', text: '{"better":"A","reason":"r"}' },
    { id: 'pair-0002', file: 'j/pair-0002.json', text: '{"better":"A","reason":"r"}' },
    { id: 'pair-0003', file: 'j/pair-0003.json', text: '{"better":"tie","reason":"r"}' },
    { id: 'p-9999', file: 'j/p-9999.json', text: '{}' },
    { id: 'constructor', file: 'j/constructor.json', text: '{"better":"A","reason":"r"}' },
  ];
  const c = collate(key, answers);

  it('tabulates each deck once by version and size, with declined counts', () => {
    const head = c.bySize.find((r) => r.version === 'head' && r.size === 60)!;
    expect(head).toMatchObject({ judged: 3, decent: 1, built: 3, declined: 3, builtShare: 0.5 });
    expect(head.decentRate).toBe(0.333);
    // A declined request counts as not decent: 1/3 of the built decks, half the requests built.
    expect(head.decentRateAll).toBe(0.167);
    expect(head.meanScore).toBe(2.333);
    expect(head.meanDeadCopies).toBe(0.333);
    expect(head.failures).toEqual({
      none: 1,
      'thin-setup': 1,
      'bad-curve': 1,
      'no-plan': 1,
      'bad-mana': 1,
    });
    const gy = c.byStyle.find((r) => r.version === 'head' && r.style === 'graveyard')!;
    expect(gy).toMatchObject({ judged: 1, decent: 0, built: 1, declined: 2, decentRateAll: 0 });
  });

  it('takes built and declined counts from the deck files when given', () => {
    const inventory = [
      { version: 'head', size: 60, style: 'bestfit', kind: 'public', built: 9, declined: 1 },
    ];
    const d = collate(key, answers, { inventory, from: 'ten files' });
    expect(d.countsFrom).toBe('ten files');
    const head = d.bySize.find((r) => r.version === 'head' && r.size === 60)!;
    expect(head).toMatchObject({ built: 9, declined: 1, builtShare: 0.9, decentRateAll: 0.3 });
    expect(c.countsFrom).toMatch(/key's inventory/);
  });

  it('checks anchors, agreement, and pairs', () => {
    expect(c.anchors).toEqual([
      { version: 'random', judged: 2, passed: 1, passShare: 0.5, expected: 'fail most', ok: false },
      { version: 'real', judged: 0, passed: 0, passShare: null, expected: 'pass most', ok: null },
    ]);
    expect(c.agreement).toEqual({
      pairs: 1,
      decentAgree: 0,
      decentAgreeShare: 0,
      meanAbsScoreDiff: 2,
      exactScore: 0,
      exactScoreShare: 0,
    });
    // A same-pool pair is not pooled with same-request pairs.
    expect(c.headToHead).toEqual([
      {
        a: 'head',
        b: 'proto',
        match: 'same-request',
        games: 2,
        wins: 1,
        losses: 1,
        ties: 0,
        winShare: 0.5,
      },
      {
        a: 'head',
        b: 'proto',
        match: 'same-pool',
        games: 1,
        wins: 0,
        losses: 0,
        ties: 1,
        winShare: 0.5,
      },
    ]);
    expect(c.position).toEqual({ games: 3, pickedA: 2, pickedB: 0, ties: 1 });
  });

  it('counts a deck built in another style as declined in every table', () => {
    const built = (version: string, file: string, style: string, archetype: string) => ({
      ...ref(version, file, 'plain', style),
      archetype,
    });
    const withSub: BatchKey = {
      ...key,
      packets: {
        ...key.packets,
        // A tokens request answered with midrange, judged decent: it must not count.
        'p-0008': { kind: 'single', ...built('head', 'h8', 'tokens', 'midrange') },
        'p-0009': { kind: 'single', ...built('head', 'h9', 'tribal:Elf', 'tribal:Elf') },
        'pair-0004': {
          kind: 'pair',
          pair: {
            A: built('head', 'h8', 'tokens', 'midrange'),
            B: built('proto', 'q8', 'tokens', 'tokens'),
            match: 'same-request',
          },
        },
      },
      inventory: [
        ...key.inventory,
        {
          version: 'head',
          size: 60,
          style: 'tokens',
          kind: 'plain',
          built: 0,
          declined: 1,
          substituted: 1,
        },
        { version: 'head', size: 60, style: 'tribal:Elf', kind: 'plain', built: 1, declined: 0 },
      ],
    };
    const d = collate(withSub, [
      ...answers,
      { id: 'p-0008', file: 'j/p-0008.json', text: single(5, ['none']) },
      { id: 'p-0009', file: 'j/p-0009.json', text: single(3, ['none']) },
      { id: 'pair-0004', file: 'j/pair-0004.json', text: '{"better":"A","reason":"r"}' },
    ]);
    const head = d.bySize.find((r) => r.version === 'head' && r.size === 60)!;
    expect(head).toMatchObject({ judged: 4, decent: 2, built: 4, declined: 4, substituted: 1 });
    expect(d.byStyle.find((r) => r.version === 'head' && r.style === 'tokens')).toMatchObject({
      judged: 0,
      built: 0,
      declined: 1,
      substituted: 1,
      decentRateAll: null,
    });
    expect(d.byStyle.find((r) => r.style === 'tribal:Elf')).toMatchObject({ judged: 1 });
    expect(d.anotherStyle).toEqual([
      { version: 'head', styled: 5, substituted: 1, judgedSetAside: 1 },
    ]);
    expect(d.headToHead).toEqual(c.headToHead);
    expect(d.pairsSetAside).toBe(1);
    expect(d.position.games).toBe(4);
    expect(d.examples.some((e) => e.packet === 'p-0008')).toBe(false);
    const md = renderCollation(d);
    expect(md).toContain('| head | 60 | 4 | 50% (2) |');
    expect(md).toContain('| 4 of 8 (1 another style) |');
    expect(md).toContain('| head | 5 | 1 (20%) | 1 |');
    expect(md).toContain('1 judged pair with a deck built in another style is left out.');
    expect(c.anotherStyle).toEqual([
      { version: 'head', styled: 3, substituted: 0, judgedSetAside: 0 },
    ]);
    expect(c.pairsSetAside).toBe(0);
  });

  it('lists invalid files and quotes examples from public and plain pools only', () => {
    expect(c.invalid.map((f) => f.file)).toEqual([
      'j/constructor.json',
      'j/p-0007.json',
      'j/p-9999.json',
    ]);
    expect(c.answered).toBe(9);
    expect(c.unanswered).toEqual([]);
    const head = c.examples.filter((e) => e.version === 'head');
    expect(head.map((e) => [e.which, e.packet, e.score])).toEqual([
      ['lowest', 'p-0002', 2],
      ['highest', 'p-0001', 4],
    ]);
    expect(c.examples.some((e) => e.poolKind === 'owner')).toBe(false);
    const md = renderCollation(c);
    expect(md).toContain('| head | 60 | 3 | 33% (1) | 17% | 2.333 |');
    expect(md).toContain('Declined builds never enter pairs');
    expect(md).toContain('| head | proto | same-request | 2 | 1 | 1 | 0 | 50% |');
    expect(md).toContain('| head | proto | same-pool | 1 | 0 | 0 | 1 | 50% |');
  });
});
