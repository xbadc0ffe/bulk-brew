import { describe, expect, it } from 'vitest';
import { CardIndex, type CardRecord, type Pool } from '@bulk-brew/core';
import { COLOR_PAIRS, poolStats, STAT_COLORS } from '../src/data/poolStats.ts';
import { CONFIG_BUNDLE as CONFIG, bigPool, PACK } from '../../core/test/builder-fixtures.ts';

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{W}',
    typeLine: 'Creature — Human Soldier',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    ...partial,
  };
}

const cards = [
  card({ id: 'soldier', name: 'Soldier' }),
  card({
    id: 'elf',
    name: 'Gold Elf',
    mv: 3,
    typeLine: 'Creature — Elf',
    colors: ['W', 'U'],
    identity: ['W', 'U'],
  }),
  card({
    id: 'elf-lord',
    name: 'Elf Lord',
    mv: 7,
    typeLine: 'Creature — Elf',
    tags: ['typal-elf'],
  }),
  card({ id: 'shape', name: 'Shapeshifter', keywords: ['Changeling'] }),
  card({
    id: 'sword',
    name: 'Sword',
    typeLine: 'Artifact — Equipment',
    colors: [],
    identity: [],
    types: ['artifact'],
  }),
  card({
    id: 'kill',
    name: 'Kill',
    mv: 1,
    typeLine: 'Instant',
    types: ['instant'],
    colors: ['B'],
    identity: ['B'],
    tags: ['removal-creature', 'spot-removal', 'removal'],
  }),
  card({
    id: 'dual',
    name: 'Dual',
    mv: 0,
    typeLine: 'Land — Plains Island',
    colors: [],
    identity: ['W', 'U'],
    types: ['land'],
    produces: ['W', 'U'],
  }),
  card({
    id: 'plains',
    name: 'Plains',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    colors: [],
    identity: ['W'],
    types: ['land'],
    produces: ['W'],
  }),
];
const index = new CardIndex({
  schema: 2,
  version: '2026-01-01',
  builtAt: '',
  cardCount: cards.length,
  cards,
});
const qty: Record<string, number> = {
  soldier: 4,
  elf: 2,
  'elf-lord': 1,
  shape: 1,
  sword: 3,
  kill: 2,
  dual: 2,
  plains: 10,
};
const pool: Pool = {
  entries: Object.fromEntries(Object.entries(qty).map(([id, n]) => [id, { cardId: id, qty: n }])),
  updatedAt: '',
};

describe('poolStats', () => {
  const stats = poolStats(pool, index, CONFIG);

  it('puts spells on the curve by color and mana value', () => {
    expect(stats.curve.W).toEqual([0, 0, 5, 0, 0, 0, 1]);
    expect(stats.curve.M).toEqual([0, 0, 0, 2, 0, 0, 0]);
    expect(stats.curve.C).toEqual([0, 0, 3, 0, 0, 0, 0]);
    expect(stats.curve.B).toEqual([0, 2, 0, 0, 0, 0, 0]);
  });

  it('counts types, roles, creature types, and other subtypes in copies', () => {
    expect(stats.types).toEqual([
      { label: 'Creatures', count: 8 },
      { label: 'Instants', count: 2 },
      { label: 'Artifacts', count: 3 },
      { label: 'Lands', count: 12 },
    ]);
    expect(stats.roles.find((r) => r.id === 'removal')).toMatchObject({
      total: 2,
      byColor: { B: 2, W: 0 },
    });
    expect(stats.creatureTypes).toEqual([
      { name: 'Human', count: 4, payoffs: 0 },
      { name: 'Soldier', count: 4, payoffs: 0 },
      { name: 'Elf', count: 3, payoffs: 1 },
    ]);
    expect(stats.changelings).toBe(1);
    expect(stats.otherSubtypes).toEqual([{ name: 'Equipment', count: 3 }]);
  });

  it('counts nonbasic lands that make both colors of a pair', () => {
    expect(Object.keys(stats.fixing)).toHaveLength(10);
    expect(stats.fixing.WU).toBe(2);
    expect(stats.fixing.WB).toBe(0);
  });

  it('accounts for every copy in a larger pool', () => {
    const big = poolStats(bigPool(), new CardIndex(PACK), CONFIG);
    const copies = Object.values(bigPool().entries).reduce((n, e) => n + e.qty, 0);
    expect(big.types.reduce((n, t) => n + t.count, 0)).toBe(copies);
    const lands = big.types.find((t) => t.label === 'Lands')?.count ?? 0;
    const spells = STAT_COLORS.reduce((n, c) => n + big.curve[c].reduce((a, b) => a + b, 0), 0);
    expect(spells).toBe(copies - lands);
    expect(COLOR_PAIRS.map((p) => p.join(''))).toEqual([
      'WU',
      'WB',
      'WR',
      'WG',
      'UB',
      'UR',
      'UG',
      'BR',
      'BG',
      'RG',
    ]);
  });
});
