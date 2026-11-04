import { describe, expect, it } from 'vitest';
import { CardIndex, type CardRecord, type Pool } from '@bulk-brew/core';
import { poolStats, STAT_COLORS } from '../src/data/poolStats.ts';
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

  it('counts cards by color class and by each of their colors', () => {
    expect(stats.colors).toEqual({ W: 16, U: 0, B: 2, R: 0, G: 0, C: 3, M: 4 });
    // The gold Elf and the dual land count in white and in blue.
    expect(stats.eachColor).toEqual({ W: 20, U: 4, B: 2, R: 0, G: 0, C: 3, M: 0 });
  });

  it('counts types, roles, creature types, and other subtypes by color in copies', () => {
    const row = (r: { label: string; byColor: Record<string, number>; total: number }) => [
      r.label,
      Object.fromEntries(Object.entries(r.byColor).filter(([, n]) => n > 0)),
      r.total,
    ];
    expect(stats.types.map(row)).toEqual([
      ['Creatures', { W: 6, M: 2 }, 8],
      ['Instants', { B: 2 }, 2],
      ['Artifacts', { C: 3 }, 3],
      ['Lands', { W: 10, M: 2 }, 12],
    ]);
    expect(stats.roles.find((r) => r.id === 'removal')).toMatchObject({
      label: 'Removal',
      total: 2,
      byColor: { B: 2, W: 0 },
    });
    expect(stats.creatureTypes.map(row)).toEqual([
      // The changeling counts under the types it prints.
      ['Human', { W: 5 }, 5],
      ['Soldier', { W: 5 }, 5],
      ['Elf', { W: 1, M: 2 }, 3],
    ]);
    expect(stats.subtypes.map(row)).toEqual([['Equipment', { C: 3 }, 3]]);
  });

  it('accounts for every copy in a larger pool', () => {
    const big = poolStats(bigPool(), new CardIndex(PACK), CONFIG);
    const copies = Object.values(bigPool().entries).reduce((n, e) => n + e.qty, 0);
    expect(big.types.reduce((n, t) => n + t.total, 0)).toBe(copies);
    expect(STAT_COLORS.reduce((n, c) => n + big.colors[c], 0)).toBe(copies);
    const lands = big.types.find((t) => t.label === 'Lands')?.total ?? 0;
    const spells = STAT_COLORS.reduce((n, c) => n + big.curve[c].reduce((a, b) => a + b, 0), 0);
    expect(spells).toBe(copies - lands);
  });
});
