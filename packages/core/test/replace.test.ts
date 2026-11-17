import { describe, expect, it } from 'vitest';
import { buildDeck, landNote, styleCounts } from '../src/builder.ts';
import { computeFacts } from '../src/candidates.ts';
import { CardIndex } from '../src/pack.ts';
import { replaceCard, replacementOptions } from '../src/replace.ts';
import type { CardRecord, Deck, DeckSize, Pool } from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';

const index = new CardIndex(PACK);

function build(size: DeckSize, style?: string, pool: Pool = bigPool()): Deck {
  return buildDeck(
    { size, colors: ['W'], settings: SETTINGS, ...(style ? { style } : {}) },
    pool,
    index,
    CONFIG,
  ).deck;
}

const total = (d: Deck) =>
  d.cards.reduce((n, c) => n + c.qty, 0) +
  Object.values(d.basics).reduce((n, q) => n + (q ?? 0), 0);

const qtyOf = (d: Deck, id: string) => d.cards.find((c) => c.cardId === id)?.qty ?? 0;

/** A deck card whose card id starts with the prefix. */
function pick(d: Deck, prefix: string) {
  const dc = d.cards.find((c) => c.cardId.startsWith(prefix));
  if (!dc) throw new Error(`no ${prefix} card in the deck`);
  return dc;
}

describe('replacementOptions', () => {
  it('offers spare pool cards of the same kind in the deck colors, never the card itself', () => {
    const deck = build(60);
    const out = pick(deck, 'w-removal-');
    const r = replacementOptions(deck, out.cardId, bigPool(), index, CONFIG, SETTINGS)!;
    expect(r.card.id).toBe(out.cardId);
    expect(r.qty).toBe(out.qty);
    const ids = r.options.map((o) => o.card.id);
    expect(ids).not.toContain(out.cardId);
    expect(ids).not.toContain('u-creature');
    expect(ids).not.toContain('w-unset');
    // Spells only for a spell.
    expect(ids.filter((id) => index.get(id)!.types.includes('land'))).toEqual([]);
    // A card already played four times has no spare copies.
    for (const dc of deck.cards) if (dc.qty >= 4) expect(ids).not.toContain(dc.cardId);
    expect(r.options.every((o) => o.qty >= 1 && o.qty <= out.qty)).toBe(true);
  });

  it('ranks cards that do the same job first', () => {
    const deck = build(60);
    const out = pick(deck, 'w-removal-');
    const r = replacementOptions(deck, out.cardId, bigPool(), index, CONFIG, SETTINGS)!;
    expect(r.jobs.map((j) => j.label)).toContain('Removal');
    const first = r.options[0]!;
    expect(first.shared.map((j) => j.label)).toContain('Removal');
    // Every option sharing a job ranks above every option sharing none.
    const sharing = r.options.map((o) => o.shared.length > 0);
    expect(sharing.indexOf(false)).toBeGreaterThan(sharing.lastIndexOf(true));
  });

  it('swaps fewer copies when the pool runs short', () => {
    const deck = build(60);
    const out = deck.cards.find((c) => c.qty >= 2 && !c.cardId.startsWith('w-utility'))!;
    const pool = bigPool();
    for (const id of Object.keys(pool.entries))
      if (qtyOf(deck, id) === 0) pool.entries[id]!.qty = 1;
    const r = replacementOptions(deck, out.cardId, pool, index, CONFIG, SETTINGS)!;
    const fresh = r.options.find((o) => qtyOf(deck, o.card.id) === 0)!;
    expect(fresh.qty).toBe(1);
  });

  it('offers lands for a land, its basic among them, and nothing for basics or unknown cards', () => {
    const deck = build(60);
    const land = deck.cards.find((c) => index.get(c.cardId)!.types.includes('land'));
    if (land) {
      const r = replacementOptions(deck, land.cardId, bigPool(), index, CONFIG, SETTINGS)!;
      for (const o of r.options) expect(o.card.types).toContain('land');
      expect(r.options.filter((o) => o.card.id === 'plains')).toHaveLength(1);
    }
    expect(replacementOptions(deck, 'plains', bigPool(), index, CONFIG, SETTINGS)).toBeUndefined();
    expect(replacementOptions(deck, 'nope', bigPool(), index, CONFIG, SETTINGS)).toBeUndefined();
  });

  it('is deterministic', () => {
    const deck = build(40);
    const out = deck.cards[0]!;
    const a = replacementOptions(deck, out.cardId, bigPool(), index, CONFIG, SETTINGS);
    const b = replacementOptions(deck, out.cardId, bigPool(), index, CONFIG, SETTINGS);
    expect(a).toEqual(b);
  });
});

describe('replaceCard', () => {
  it('swaps every copy, keeps the size, and labels the new card', () => {
    const deck = build(60);
    const out = pick(deck, 'w-removal-');
    const inId = replacementOptions(
      deck,
      out.cardId,
      bigPool(),
      index,
      CONFIG,
      SETTINGS,
    )!.options.find((o) => qtyOf(deck, o.card.id) === 0 && o.qty === out.qty)!.card.id;
    const next = replaceCard(deck, out.cardId, inId, out.qty, index, CONFIG);
    expect(total(next)).toBe(60);
    expect(qtyOf(next, out.cardId)).toBe(0);
    const dc = next.cards.find((c) => c.cardId === inId)!;
    expect(dc.qty).toBe(out.qty);
    expect(dc.why).toBe(`Swapped in for ${index.get(out.cardId)!.name}`);
    // The original deck is untouched.
    expect(qtyOf(deck, out.cardId)).toBe(out.qty);
  });

  it('keeps the rest of the copies on a partial swap and adds to a card already in', () => {
    const deck = build(60);
    const out = deck.cards.find(
      (c) => c.qty >= 2 && index.get(c.cardId)!.types.includes('creature'),
    )!;
    const already = deck.cards.find(
      (c) =>
        c.cardId !== out.cardId && c.qty < 4 && index.get(c.cardId)!.types.includes('creature'),
    )!;
    const next = replaceCard(deck, out.cardId, already.cardId, 1, index, CONFIG);
    expect(total(next)).toBe(60);
    expect(qtyOf(next, out.cardId)).toBe(out.qty - 1);
    expect(qtyOf(next, already.cardId)).toBe(already.qty + 1);
    expect(next.cards.find((c) => c.cardId === already.cardId)!.why).toBe(already.why);
  });

  it('brings the curve, roles, and synergies up to date and drops the score', () => {
    const deck = build(60, 'tokens');
    const e = deck.explanation!;
    const out = pick(deck, 'w-removal-');
    // A three-mana draw spell with copies to spare.
    const inId = replacementOptions(deck, out.cardId, bigPool(), index, CONFIG, SETTINGS)!
      .options.map((o) => o.card.id)
      .find((id) => id.startsWith('w-draw-'))!;
    const n = Math.min(out.qty, 4 - qtyOf(deck, inId));
    expect(n).toBeGreaterThan(0);
    const next = replaceCard(deck, out.cardId, inId, n, index, CONFIG);
    const ne = next.explanation!;
    const outBucket = index.get(out.cardId)!.mv;
    expect(outBucket).not.toBe(3);
    expect(ne.curve[outBucket]).toBe(e.curve[outBucket]! - n);
    expect(ne.curve[3]).toBe(e.curve[3]! + n);
    expect(ne.curve.reduce((a, b) => a + b, 0)).toBe(e.curve.reduce((a, b) => a + b, 0));
    expect(ne.roles.removal!.have).toBe(e.roles.removal!.have - n);
    expect(ne.roles.cardAdvantage!.have).toBe(e.roles.cardAdvantage!.have + n);
    expect(ne.lands.count).toBe(e.lands.count);
    expect(ne.score).toBeUndefined();
    expect(e.score).toBeDefined();
    // Theme bars read the deck itself.
    expect(styleCounts(next, index, CONFIG)[0]!.id).toBe('tokens');
  });

  it('counts cheap mana sources and the average cost, and rewrites the land note', () => {
    const deck = build(60);
    const e = deck.explanation!;
    const out = pick(deck, 'w-removal-');
    const dork = replacementOptions(
      deck,
      out.cardId,
      bigPool(),
      index,
      CONFIG,
      SETTINGS,
    )!.options.find((o) => o.card.id.startsWith('w-dork-'))!;
    const next = replaceCard(deck, out.cardId, dork.card.id, dork.qty, index, CONFIG);
    const ne = next.explanation!;
    const spells = e.curve.reduce((a, b) => a + b, 0);
    expect(ne.lands.cheapManaSources).toBe(e.lands.cheapManaSources + dork.qty);
    expect(ne.lands.averageMv).toBeCloseTo(
      e.lands.averageMv + ((1 - index.get(out.cardId)!.mv) * dork.qty) / spells,
      1,
    );
    const { count, averageMv, cheapManaSources, nonbasics } = ne.lands;
    expect(e.notes).toContain(
      landNote(e.lands.count, e.lands.averageMv, e.lands.cheapManaSources, e.lands.nonbasics),
    );
    expect(ne.notes).toContain(landNote(count, averageMv, cheapManaSources, nonbasics));
    expect(ne.notes.length).toBe(e.notes.length);
  });

  it('leaves roles and the curve alone on a land swap', () => {
    // A land that draws cards matches a role, but the builders count roles over spells only.
    const drawLand: CardRecord = {
      ...index.get('w-good-land')!,
      id: 'w-draw-land',
      name: 'Library Spire',
      tags: ['pure-draw', 'draw'],
    };
    expect(computeFacts(drawLand, CONFIG).roles).toContain('cardAdvantage');
    const idx = new CardIndex({ ...PACK, cards: [...PACK.cards, drawLand] });
    // Built before the land joins the pool, so it has copies to spare.
    const deck = build(60);
    const pool = bigPool();
    pool.entries['w-draw-land'] = { cardId: 'w-draw-land', qty: 4 };
    const land = deck.cards.find((c) => idx.get(c.cardId)!.types.includes('land'));
    expect(land).toBeDefined();
    const r = replacementOptions(deck, land!.cardId, pool, idx, CONFIG, SETTINGS)!;
    expect(r.jobs).toEqual([]);
    expect(r.options.map((o) => o.card.id)).toContain('w-draw-land');
    const next = replaceCard(deck, land!.cardId, 'w-draw-land', 1, idx, CONFIG);
    expect(next.explanation!.roles).toEqual(deck.explanation!.roles);
    expect(next.explanation!.curve).toEqual(deck.explanation!.curve);
  });

  it('refuses a land for a spell, the same card, and a card not in the deck', () => {
    const deck = build(60);
    const spell = pick(deck, 'w-removal-');
    expect(() => replaceCard(deck, 'nope', 'w-draw-0', 1, index, CONFIG)).toThrow();
    expect(() => replaceCard(deck, spell.cardId, 'w-good-land', 1, index, CONFIG)).toThrow();
    expect(() => replaceCard(deck, spell.cardId, spell.cardId, 1, index, CONFIG)).toThrow();
  });
});

describe('replacing in a Commander deck', () => {
  const card = (i: number): CardRecord => {
    const mv = (i % 6) + 1;
    return {
      id: `w-${i}`,
      name: `White ${i}`,
      layout: 'normal',
      mv,
      manaCost: `{${mv - 1}}{W}`,
      typeLine: 'Creature — Human',
      text: '',
      colors: ['W'],
      identity: ['W'],
      keywords: [],
      types: ['creature'],
      tags: i % 9 === 0 ? ['removal-creature', 'removal'] : [],
      img: 'x',
      power: String(mv),
      toughness: String(mv),
    };
  };
  const spells = Array.from({ length: 90 }, (_, i) => card(i));
  const lead: CardRecord = {
    ...card(1000),
    id: 'lead',
    name: 'Lead, the Bright',
    typeLine: 'Legendary Creature — Human',
  };
  const blue: CardRecord = {
    ...card(2000),
    id: 'blue',
    name: 'Blue One',
    colors: ['U'],
    identity: ['U'],
    manaCost: '{1}{U}',
  };
  const plains: CardRecord = {
    ...card(3000),
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    produces: ['W'],
  };
  const all = [...spells, lead, blue, plains];
  const idx = new CardIndex({
    schema: 2,
    version: 't',
    builtAt: 't',
    cardCount: all.length,
    cards: all,
  });
  const pool: Pool = {
    entries: Object.fromEntries(
      [...spells, lead, blue].map((c) => [c.id, { cardId: c.id, qty: 3 }]),
    ),
    updatedAt: 't',
  };
  const deck = buildDeck(
    { size: 100, colors: [], settings: SETTINGS, commander: 'lead' },
    pool,
    idx,
    CONFIG,
  ).deck;
  const out = deck.cards.find((c) => c.cardId !== 'lead')!;

  it('offers single copies of cards outside the deck, in the commander identity', () => {
    const r = replacementOptions(deck, out.cardId, pool, idx, CONFIG, SETTINGS)!;
    expect(r.options.length).toBeGreaterThan(0);
    for (const o of r.options) {
      expect(o.qty).toBe(1);
      expect(qtyOf(deck, o.card.id)).toBe(0);
      expect(o.card.identity).toEqual(['W']);
    }
    expect(r.options.map((o) => o.card.id)).not.toContain('lead');
  });

  it('never swaps the commander out or in', () => {
    expect(replacementOptions(deck, 'lead', pool, idx, CONFIG, SETTINGS)).toBeUndefined();
    const free = spells.find((c) => qtyOf(deck, c.id) === 0)!;
    expect(() => replaceCard(deck, 'lead', free.id, 1, idx, CONFIG)).toThrow();
    expect(() => replaceCard(deck, out.cardId, 'lead', 1, idx, CONFIG)).toThrow();
    const next = replaceCard(deck, out.cardId, free.id, 1, idx, CONFIG);
    expect(next.commander).toBe('lead');
    expect(total(next)).toBe(100);
  });
});
