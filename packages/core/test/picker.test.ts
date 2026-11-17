// The plan picker (builder phase 2, step 3): one score ranks best fit, the
// Build page's options, and the Analyze pane's decks at 60, 40, and 100.

import { describe, expect, it } from 'vitest';
import { bestDeckSearch } from '../src/best-decks.ts';
import { buildDeck } from '../src/builder.ts';
import { byPlanScore } from '../src/grow.ts';
import type { BulkBrewConfig } from '../src/config.ts';
import { deckOptionSearch, planOptions, type OptionsRequest } from '../src/options.ts';
import { CardIndex } from '../src/pack.ts';
import type {
  BuildRequest,
  BuildResult,
  CardRecord,
  Color,
  DataPack,
  DeckSize,
  Pool,
} from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';

const index = new CardIndex(PACK);

function bestFit(
  pool: Pool,
  idx: CardIndex,
  size: DeckSize,
  colors: Color[],
  more: Partial<BuildRequest> = {},
  config: BulkBrewConfig = CONFIG,
): BuildResult {
  return buildDeck(
    { size, colors, settings: SETTINGS, id: 'best', createdAt: 't', ...more },
    pool,
    idx,
    config,
  );
}

/** The Build page's first option for the request useDeckOptions sends with no style picked. */
function firstOption(pool: Pool, idx: CardIndex, req: OptionsRequest) {
  const search = deckOptionSearch(req, pool, idx, CONFIG);
  while (search.step());
  return search.state();
}

function lines(r: BuildResult) {
  return { cards: r.deck.cards.map((c) => [c.cardId, c.qty]), basics: r.deck.basics };
}

describe('the plan picker', () => {
  it('ranks best fit and every plan it compared by one score', () => {
    const r = bestFit(bigPool(), index, 60, ['W']);
    const pick = r.explanation.pick!;
    expect(r.explanation.builder).toBe('grow');
    expect(pick.ranked!.map((x) => x.style)).toContain('midrange');
    expect(pick.ranked!.map((x) => x.style)).toContain('aggro');
    expect(pick.ranked!.map((x) => x.style)).toContain('control');
    const scores = pick.ranked!.map((x) => x.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const raw = pick.quality * pick.fit * pick.clean * pick.cast! * themePart(pick);
    expect(Math.abs(pick.score - raw)).toBeLessThanOrEqual(CONFIG.builderWeights.picker.scoreStep);
  });

  it('breaks ties toward Midrange, then Aggro, Control, and the themes by id', () => {
    const list = ['tokens', 'control', 'aggro', 'artifacts', 'midrange'].map((style) => ({
      style,
      score: 0.99,
    }));
    expect([...list].sort(byPlanScore).map((x) => x.style)).toEqual([
      'midrange',
      'aggro',
      'control',
      'artifacts',
      'tokens',
    ]);
    // On a plain pool the shapes fill their templates alike, within a step or two of each other.
    const { pool, idx } = plainPool();
    const r = bestFit(pool, idx, 60, ['W']);
    expect(r.deck.archetype).toBe('midrange');
    const ranked = r.explanation.pick!.ranked!;
    const aggro = ranked.find((x) => x.style === 'aggro')!.score;
    expect(ranked[0]!.score - aggro).toBeLessThanOrEqual(
      2 * CONFIG.builderWeights.picker.scoreStep + 1e-9,
    );
  });

  it('picks a plain shape from a pool no theme stands out in', () => {
    const { pool, idx } = plainPool();
    for (const size of [60, 40] as const) {
      const r = bestFit(pool, idx, size, ['W']);
      expect(['midrange', 'aggro', 'control'], `${size}`).toContain(r.deck.archetype);
    }
  });

  it('leads with a theme only when its richness stands clear of its own noise', () => {
    // Token makers in the fixture pool: about 2.9 times what plain bulk of white holds.
    const at = (scale: number) => {
      const c = JSON.parse(JSON.stringify(CONFIG)) as BulkBrewConfig;
      for (const per of Object.values(c.themeBulk!.styles['tokens']!))
        for (const k of Object.keys(per) as (keyof typeof per)[]) per[k] *= scale;
      const r = bestFit(bigPool(), index, 60, ['W'], {}, c);
      const t = buildDeck(
        { size: 60, colors: ['W'], settings: SETTINGS, style: 'tokens' },
        bigPool(),
        index,
        c,
      );
      const score = (s: string) => r.explanation.pick!.ranked!.find((x) => x.style === s)!.score;
      return {
        richness: t.explanation.pick!.richness!,
        tokens: score('tokens'),
        plain: score('midrange'),
      };
    };
    // A baseline 2.5 times as rich leaves the pool about 15% over bulk, inside the noise of its count.
    const noise = at(2.5);
    expect(noise.richness).toBe(1);
    expect(noise.tokens).toBeLessThan(noise.plain);
    // As shipped the pool holds clearly more token makers than bulk: Tokens beats the plain shapes.
    const rich = at(1);
    expect(rich.richness).toBeGreaterThan(1.5);
    expect(rich.tokens).toBeGreaterThan(rich.plain);
    // The margin divides a theme's score and nothing else.
    const strict = JSON.parse(JSON.stringify(CONFIG)) as BulkBrewConfig;
    strict.builderWeights.picker.themeMargin = 3;
    const r = bestFit(bigPool(), index, 60, ['W'], {}, strict).explanation.pick!.ranked!;
    const tokens = r.find((x) => x.style === 'tokens')!.score;
    const shipped = rich.tokens * CONFIG.builderWeights.picker.themeMargin;
    expect(Math.abs(tokens * 3 - shipped)).toBeLessThan(0.05);
    expect(r.find((x) => x.style === 'midrange')!.score).toBe(rich.plain);
  });

  it('picks Aggro on a plainly aggressive pool, where Midrange cannot fill its curve', () => {
    const { pool, idx } = aggressivePool();
    for (const size of [60, 40] as const) {
      const r = bestFit(pool, idx, size, ['R']);
      expect(r.deck.archetype, `${size}`).toBe('aggro');
      const ranked = r.explanation.pick!.ranked!;
      const score = (s: string) => ranked.find((x) => x.style === s)!.score;
      // Midrange and Control are built, and score lower on what the pool cannot fill.
      expect(score('midrange')).toBeLessThan(score('aggro'));
      expect(score('control')).toBeLessThan(score('midrange'));
    }
  });

  it('ranks Analyze decks fairly across color counts', () => {
    // White and blue halves of the same cards: a two-color deck has no better cards, only worse mana.
    const { pool, idx } = twinPool();
    expect(bestFit(pool, idx, 60, ['W']).explanation.pick!.cast).toBe(1);
    const pair = bestFit(pool, idx, 60, ['W', 'U']);
    if ((pair.deck.colors ?? [pair.deck.color]).length > 1)
      expect(pair.explanation.pick!.cast!).toBeLessThan(1);
    const search = bestDeckSearch(60, pool, idx, CONFIG, SETTINGS);
    while (search.step());
    const any = search.state().options[4]!;
    expect(any[0]!.key.split(':')[0]!).toHaveLength(1);
    for (const o of any) {
      if ((o.result.deck.colors ?? [o.result.deck.color]).length < 2) continue;
      // A two-color deck ranks below the one-color deck of its style.
      const style = o.result.deck.archetype;
      const mono = any.find((x) => x.result.deck.archetype === style && !x.result.deck.colors);
      if (mono) expect(mono.rank).toBeGreaterThanOrEqual(o.rank);
    }
  });

  it('gives Control a creature count inside its range, near the middle', () => {
    const r = buildDeck(
      { size: 60, colors: ['W'], settings: SETTINGS, style: 'control', requireStyle: true },
      bigPool(),
      index,
      CONFIG,
    );
    const creatures = r.deck.cards.reduce(
      (n, c) => n + (index.get(c.cardId)!.types.includes('creature') ? c.qty : 0),
      0,
    );
    const spells = r.deck.cards.reduce(
      (n, c) => n + (index.get(c.cardId)!.types.includes('land') ? 0 : c.qty),
      0,
    );
    // Control's range is 25% to 50%; the fill aims at the middle.
    expect(creatures / spells).toBeGreaterThanOrEqual(0.36);
    expect(creatures / spells).toBeLessThanOrEqual(0.5);
  });

  it('builds the same best fit and the same options twice', () => {
    expect(bestFit(bigPool(), index, 40, ['W'])).toEqual(bestFit(bigPool(), index, 40, ['W']));
    const req: OptionsRequest = { size: 60, colors: ['W', 'U'], settings: SETTINGS };
    const a = firstOption(bigPool(), index, req).options.map((o) => [o.key, o.rank]);
    expect(firstOption(bigPool(), index, req).options.map((o) => [o.key, o.rank])).toEqual(a);
  });
});

describe('the first option is the best fit', () => {
  for (const [size, colors] of [
    [60, ['W']],
    [40, ['W']],
    [60, ['W', 'U']],
    [40, ['W', 'U']],
  ] as const)
    it(`card for card at ${size} in ${colors.join('')}`, () => {
      const best = bestFit(bigPool(), index, size, [...colors]);
      const state = firstOption(bigPool(), index, {
        size,
        colors: [...colors],
        settings: SETTINGS,
      });
      const top = state.options[0]!;
      expect(top.result.deck.archetype).toBe(best.deck.archetype);
      expect(lines(top.result)).toEqual(lines(best));
      // The other plans follow in the picker's order, a few per style.
      expect(state.options.length).toBeGreaterThan(1);
    });

  it('card for card under a commander, the Analyze pane included', () => {
    const { pool, idx } = commanderPool();
    const best = bestFit(pool, idx, 100, [], { commander: 'lead' });
    expect(best.explanation.builder).toBe('grow');
    expect(best.explanation.pick!.ranked!.map((x) => x.style).sort()).toEqual([
      'aggro',
      'control',
      'midrange',
    ]);
    const state = firstOption(pool, idx, {
      size: 100,
      colors: ['W'],
      commander: 'lead',
      settings: SETTINGS,
    });
    expect(lines(state.options[0]!.result)).toEqual(lines(best));
    // The Analyze pane builds the same best fit for the commander.
    const search = bestDeckSearch(100, pool, idx, CONFIG, SETTINGS);
    while (search.step());
    const analyzed = search.state().options[0]![0]!;
    expect(analyzed.key).toBe('lead');
    expect(lines(analyzed.result)).toEqual(lines(best));
  });
});

describe('a Commander deck opened from Analyze', () => {
  it('lands on options even when no theme is viable at 100', () => {
    const { pool, idx } = commanderPool();
    // Nothing the theme rules describe is viable in this pool under the commander.
    const { plans } = planOptions(
      { size: 100, colors: ['W'], commander: 'lead', settings: SETTINGS },
      pool,
      idx,
      CONFIG,
    );
    expect(plans.map((p) => p.style).sort()).toEqual(['aggro', 'control', 'midrange']);
    // The deck Analyze opens is best fit under the commander; Back lands on its options.
    const state = firstOption(pool, idx, {
      size: 100,
      colors: ['W'],
      commander: 'lead',
      settings: SETTINGS,
    });
    expect(state.options.length).toBeGreaterThan(0);
    expect(state.failure).toBeUndefined();
  });
});

function themePart(pick: NonNullable<BuildResult['explanation']['pick']>): number {
  if (pick.margin === undefined) return pick.lead ?? 1;
  return (
    (pick.margin * pick.richness! * pick.depth! * (pick.lead ?? 1)) /
    CONFIG.builderWeights.picker.themeMargin
  );
}

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  const out: CardRecord = {
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{R}',
    typeLine: 'Creature — Goblin',
    text: '',
    colors: ['R'],
    identity: ['R'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...partial,
  };
  // Spells and lands have no stats.
  if (!out.types.includes('creature')) {
    delete out.power;
    delete out.toughness;
  }
  return out;
}

function packOf(cards: CardRecord[]): DataPack {
  return { schema: 2, version: 't', builtAt: 't', cardCount: cards.length, cards };
}

/**
 * A made-up red pool a person would build as Aggro: many efficient one- and
 * two-drops with haste or first strike, cheap burn, a few three-drops, and
 * few late cards.
 */
function aggressivePool(): { pool: Pool; idx: CardIndex } {
  const cards: CardRecord[] = [];
  const qty = new Map<string, number>();
  const put = (c: CardRecord, n: number) => {
    cards.push(c);
    qty.set(c.id, n);
  };
  for (let i = 0; i < 6; i++)
    put(
      card({
        id: `r1-${i}`,
        name: `Quick Raider ${i}`,
        mv: 1,
        manaCost: '{R}',
        power: '2',
        toughness: '1',
        keywords: ['Haste'],
        text: 'Haste',
        rank: 2000 + i,
      }),
      4,
    );
  for (let i = 0; i < 6; i++)
    put(
      card({
        id: `r2-${i}`,
        name: `Keen Duelist ${i}`,
        mv: 2,
        power: '3',
        toughness: '2',
        keywords: ['First strike'],
        text: 'First strike',
        rank: 3000 + i,
      }),
      4,
    );
  for (let i = 0; i < 3; i++)
    put(
      card({
        id: `rb-${i}`,
        name: `Quick Bolt ${i}`,
        mv: 1,
        manaCost: '{R}',
        typeLine: 'Instant',
        types: ['instant'],
        text: `Quick Bolt ${i} deals 3 damage to target creature.`,
        tags: ['removal', 'removal-creature', 'removal-burn', 'burn-creature', 'spot-removal'],
        rank: 1500 + i,
      }),
      3,
    );
  for (let i = 0; i < 3; i++)
    put(
      card({
        id: `r3-${i}`,
        name: `Ridge Brute ${i}`,
        mv: 3,
        manaCost: '{2}{R}',
        power: '3',
        toughness: '3',
        rank: 9000 + i,
      }),
      2,
    );
  put(
    card({
      id: 'r5',
      name: 'Lumbering Giant',
      mv: 5,
      manaCost: '{4}{R}',
      power: '5',
      toughness: '5',
      rank: 12000,
    }),
    1,
  );
  const mountain = card({
    id: 'mountain',
    name: 'Mountain',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Mountain',
    types: ['land'],
    colors: [],
    produces: ['R'],
  });
  const all = [...cards, mountain];
  const pool: Pool = {
    entries: Object.fromEntries([...qty].map(([id, n]) => [id, { cardId: id, qty: n }])),
    updatedAt: 't',
  };
  return { pool, idx: new CardIndex(packOf(all)) };
}

/** A white pool of plain creatures, removal, and card draw: no theme the rules describe stands out. */
function plainPool(): { pool: Pool; idx: CardIndex } {
  const cards: CardRecord[] = [];
  for (let i = 0; i < 60; i++) {
    const mv = 1 + (i % 6);
    const removal = i % 6 === 0;
    cards.push(
      card({
        id: `p-${i}`,
        name: `Plain Footman ${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        colors: ['W'],
        identity: ['W'],
        typeLine: 'Creature — Human',
        power: String(mv),
        toughness: String(mv),
        tags: removal ? ['removal-creature', 'removal'] : [],
        text: removal
          ? 'When this creature enters, exile target creature an opponent controls.'
          : '',
      }),
    );
  }
  for (let i = 0; i < 6; i++)
    cards.push(
      card({
        id: `ps-${i}`,
        name: `Plain Study ${i}`,
        mv: 2 + (i % 3),
        manaCost: '{1}{W}',
        colors: ['W'],
        identity: ['W'],
        typeLine: 'Sorcery',
        types: ['sorcery'],
        tags: ['draw', 'pure-draw'],
        text: 'Draw two cards.',
      }),
    );
  const plains = card({
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    identity: ['W'],
    produces: ['W'],
  });
  const pool: Pool = {
    entries: Object.fromEntries(cards.map((c) => [c.id, { cardId: c.id, qty: 4 }])),
    updatedAt: 't',
  };
  return { pool, idx: new CardIndex(packOf([...cards, plains])) };
}

/** The fixture pool with a blue copy of every white spell: two halves of equal cards. */
function twinPool(): { pool: Pool; idx: CardIndex } {
  const base = bigPool();
  const blue: CardRecord[] = [];
  const entries = { ...base.entries };
  for (const c of PACK.cards) {
    const entry = entries[c.id];
    if (!entry || c.types.includes('land') || c.colors.join('') !== 'W' || c.unset) continue;
    const u: CardRecord = {
      ...c,
      id: `blue-${c.id}`,
      name: `Blue ${c.name}`,
      colors: ['U'],
      identity: ['U'],
      manaCost: (c.manaCost ?? '').replace(/\{W\}/g, '{U}'),
      text: c.text.replace(/white/g, 'blue'),
    };
    blue.push(u);
    entries[u.id] = { cardId: u.id, qty: entry.qty };
  }
  const island = card({
    id: 'island',
    name: 'Island',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Island',
    types: ['land'],
    colors: [],
    identity: ['U'],
    produces: ['U'],
  });
  return {
    pool: { entries, updatedAt: 't' },
    idx: new CardIndex(packOf([...PACK.cards, ...blue, island])),
  };
}

/** A white Commander pool with no theme the rules call viable, as on the live site's Tymaret. */
function commanderPool(): { pool: Pool; idx: CardIndex } {
  const w = (partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>) =>
    card({
      colors: ['W'],
      identity: ['W'],
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human',
      ...partial,
    });
  const cards: CardRecord[] = [];
  for (let i = 0; i < 90; i++) {
    const mv = 1 + (i % 6);
    cards.push(
      w({
        id: `c-${i}`,
        name: `Plain Soldier ${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        power: String(mv),
        toughness: String(mv),
        tags:
          i % 9 === 0
            ? ['removal-creature', 'removal']
            : i % 9 === 1
              ? ['draw-engine']
              : i % 9 === 2
                ? ['mana-rock']
                : [],
        types: i % 9 === 2 ? ['artifact'] : ['creature'],
        typeLine: i % 9 === 2 ? 'Artifact' : 'Creature — Human',
      }),
    );
  }
  const lead = w({
    id: 'lead',
    name: 'Lead, the Bright',
    typeLine: 'Legendary Creature — Human',
    mv: 3,
    manaCost: '{2}{W}',
  });
  const plains = card({
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    identity: ['W'],
    produces: ['W'],
  });
  const pool: Pool = {
    entries: Object.fromEntries([...cards, lead].map((c) => [c.id, { cardId: c.id, qty: 3 }])),
    updatedAt: 't',
  };
  return { pool, idx: new CardIndex(packOf([...cards, lead, plains])) };
}
