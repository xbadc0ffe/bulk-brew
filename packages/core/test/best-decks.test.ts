import { describe, expect, it } from 'vitest';
import { bestDeckPlans, bestDeckSearch, poolPack } from '../src/best-decks.ts';
import { buildDeck } from '../src/builder.ts';
import { colorSubsets } from '../src/options.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import {
  COLORS,
  type CardRecord,
  type DeckSize,
  type Pool,
  type ScanReport,
} from '../src/types.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';

const index = new CardIndex(PACK);

function scansFor(pool: Pool, size: DeckSize): Map<string, ScanReport> {
  const scans = new Map<string, ScanReport>();
  for (const s of colorSubsets(COLORS))
    scans.set(s.join(''), scanPool(pool, index, CONFIG, SETTINGS, size, s));
  return scans;
}

function runAll(size: DeckSize, pool: Pool) {
  const search = bestDeckSearch(size, pool, index, CONFIG, SETTINGS);
  const steps = [];
  for (let step = search.step(); step; step = search.step()) steps.push(step);
  return { steps, state: search.state() };
}

describe('bestDeckPlans', () => {
  it('plans every viable style of every buildable color set, fewer colors first in each turn', () => {
    const scans = scansFor(bigPool(), 60);
    const plans = bestDeckPlans(scans);
    const viable = [...scans.values()]
      .filter((s) => s.possible)
      .reduce((n, s) => n + s.archetypes.filter((a) => a.viable).length, 0);
    expect(plans.length).toBe(viable);
    expect(new Set(plans.map((p) => p.key)).size).toBe(plans.length);
    // The fixture is white with colorless cards, so white comes first.
    expect(plans[0]!.colors).toEqual(['W']);
    for (const p of plans) expect(scans.get(p.colors.join(''))!.possible).toBe(true);
  });
});

describe('bestDeckSearch', () => {
  it('scans, plans, and builds every plan, keeping the strongest decks ranked', () => {
    const { steps, state } = runAll(60, bigPool());
    expect(steps.filter((s) => s.kind === 'scan')).toHaveLength(31);
    expect(steps[31]).toEqual({ kind: 'planned', planned: state.planned });
    expect(state.done).toBe(true);
    expect(state.built).toBe(state.planned);
    expect(state.options).toHaveLength(5);
    for (const [k, list] of state.options.entries()) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(CONFIG.builderWeights.buildOptions.maxOptions);
      // Each list holds decks of at most k + 1 colors, ranked.
      for (const o of list) expect(o.key.split(':')[0]!.length).toBeLessThanOrEqual(k + 1);
      for (let i = 1; i < list.length; i++)
        expect(list[i - 1]!.rank).toBeGreaterThanOrEqual(list[i]!.rank);
    }
    expect(state.options[0]!.every((o) => o.key.startsWith('W:'))).toBe(true);
  });

  it('builds the same decks as a direct build of the same plan', () => {
    const pool = bigPool();
    const { state } = runAll(40, pool);
    const best = state.options[4]![0]!;
    const [colors, style] = best.key.split(':');
    const direct = buildDeck(
      {
        size: 40,
        colors: [...colors!] as never,
        style: style!,
        settings: SETTINGS,
        id: best.key,
        createdAt: '',
      },
      pool,
      index,
      CONFIG,
    );
    expect(best.result).toEqual(direct);
  });

  it('gives the same result twice', () => {
    const keys = () => runAll(20, bigPool()).state.options.map((l) => l.map((o) => o.key));
    const a = keys();
    const b = keys();
    expect(a).toEqual(b);
  });

  it('finishes with no plans when the pool has no commanders', () => {
    const { steps, state } = runAll(100, bigPool());
    expect(steps).toEqual([{ kind: 'planned', planned: 0 }]);
    expect(state).toMatchObject({ commanders: 0, planned: 0, built: 0, done: true });
    expect(state.options.flat()).toEqual([]);
  });

  it('stops stepping once done', () => {
    const search = bestDeckSearch(100, bigPool(), index, CONFIG, SETTINGS);
    while (search.step());
    expect(search.step()).toBeUndefined();
  });
});

describe('bestDeckSearch at 100', () => {
  // Two white commanders over the same 90 white cards, so their decks share nearly everything.
  const card = (id: string, extra: Partial<CardRecord> = {}): CardRecord => ({
    id,
    name: id,
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{W}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...extra,
  });
  const cards = Array.from({ length: 90 }, (_, i) =>
    card(`w-${i}`, {
      mv: (i % 6) + 1,
      manaCost: `{${i % 6}}{W}`,
      tags: i % 9 === 0 ? ['removal-creature', 'removal'] : [],
    }),
  );
  const leads = ['Ada, the First', 'Bea, the Second'].map((name) =>
    card(name, { typeLine: 'Legendary Creature — Human', mv: 3, manaCost: '{2}{W}' }),
  );
  const plains = card('Plains', {
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    manaCost: '',
    mv: 0,
    colors: [],
    produces: ['W'],
  });
  const all = [...cards, ...leads, plains];
  const cmdIndex = new CardIndex({
    schema: 2,
    version: 't',
    builtAt: 't',
    cardCount: all.length,
    cards: all,
  });
  const pool: Pool = {
    entries: Object.fromEntries([...cards, ...leads].map((c) => [c.id, { cardId: c.id, qty: 1 }])),
    updatedAt: 't',
  };

  it('keeps a deck for each commander even when they share their cards', () => {
    const search = bestDeckSearch(100, pool, cmdIndex, CONFIG, SETTINGS);
    while (search.step());
    const state = search.state();
    expect(state).toMatchObject({ commanders: 2, planned: 2, built: 2, done: true });
    const mono = state.options[0]!;
    expect(mono.map((o) => o.result.deck.commander).sort()).toEqual(leads.map((c) => c.id).sort());
    expect(mono[0]!.rank).toBeGreaterThanOrEqual(mono[1]!.rank);
    expect(state.options[4]).toEqual(mono);
  });

  it('builds the same commander deck from the pool pack as from the full pack', () => {
    const small = new CardIndex(poolPack(pool, cmdIndex, CONFIG));
    const request = {
      size: 100 as const,
      colors: [],
      commander: leads[0]!.id,
      settings: SETTINGS,
      id: 'x',
      createdAt: '',
    };
    expect(buildDeck(request, pool, small, CONFIG)).toEqual(
      buildDeck(request, pool, cmdIndex, CONFIG),
    );
  });
});

describe('poolPack', () => {
  it('holds the pool cards and basics, and builds the same deck as the full pack', () => {
    const full = bigPool();
    // Half the cards and no basics in the pool, so the pack must add Plains itself.
    const ids = Object.keys(full.entries).filter((id, i) => id !== 'plains' && i % 2 === 0);
    const pool: Pool = {
      ...full,
      entries: Object.fromEntries(ids.map((id) => [id, full.entries[id]!])),
    };
    const pack = poolPack(pool, index, CONFIG);
    expect(pack.cards.map((c) => c.id).sort()).toEqual([...ids, 'plains'].sort());
    expect(pack.cardCount).toBe(pack.cards.length);
    const small = new CardIndex(pack);
    expect(small.dataVersion).toBe(index.dataVersion);
    const request = { size: 20 as const, colors: ['W' as const], settings: SETTINGS, id: 'x' };
    expect(buildDeck({ ...request, createdAt: '' }, pool, small, CONFIG)).toEqual(
      buildDeck({ ...request, createdAt: '' }, pool, index, CONFIG),
    );
  });
});
