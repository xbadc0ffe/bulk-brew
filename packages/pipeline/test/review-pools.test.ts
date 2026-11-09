import { describe, expect, it } from 'vitest';
import type { CardRecord, Color, Rarity } from '@bulk-brew/core';
import { hash32, noisePool } from '../src/corpus.ts';
import {
  colorCounts,
  drawExtras,
  formatPool,
  indexEntry,
  mergeLists,
  plainSeed,
  restrictSource,
  themeSeed,
  twoDigits,
  withFallback,
  type PoolFile,
} from '../src/review/pools.ts';

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

function source(sizes: Record<Rarity, number>): Map<Rarity, CardRecord[]> {
  return new Map(
    RARITIES.map((r) => [
      r,
      Array.from({ length: sizes[r] }, (_, i) => ({ id: `${r}-${i}` }) as CardRecord),
    ]),
  );
}

const total = (list: [string, number][]) => list.reduce((n, [, q]) => n + q, 0);

describe('seeds', () => {
  it('derive from the review prefix, the style, and the sample number', () => {
    expect(plainSeed(1)).toBe(hash32('review:plain:1'));
    expect(plainSeed(30)).toBe(hash32('review:plain:30'));
    expect(themeSeed('graveyard', 2)).toBe(hash32('review:theme:graveyard:2'));
    expect(new Set([1, 2, 3].map(plainSeed)).size).toBe(3);
    expect(themeSeed('tokens', 1)).not.toBe(themeSeed('counters', 1));
    expect(twoDigits(3)).toBe('03');
    expect(twoDigits(30)).toBe('30');
  });
});

describe('drawExtras', () => {
  it('draws exactly as noisePool when every rarity has cards', () => {
    const full = source({ common: 8, uncommon: 6, rare: 4, mythic: 2 });
    const got = drawExtras(full, 42, 120);
    expect(got).toEqual(noisePool(full, 42, 120));
    expect(total(got)).toBe(120);
    expect(drawExtras(full, 42, 120)).toEqual(got);
    expect(drawExtras(full, 43, 120)).not.toEqual(got);
  });

  it('only draws candidate cards', () => {
    const full = source({ common: 8, uncommon: 6, rare: 4, mythic: 2 });
    const ids = new Set(['common-1', 'uncommon-2', 'rare-0', 'mythic-1']);
    const got = drawExtras(restrictSource(full, ids), 7, 120);
    expect(total(got)).toBe(120);
    for (const [id] of got) expect(ids.has(id)).toBe(true);
  });

  it('falls back to the next rarity when a bucket is empty', () => {
    const noCommons = drawExtras(source({ common: 0, uncommon: 3, rare: 2, mythic: 1 }), 5, 300);
    expect(total(noCommons)).toBe(300);
    expect(noCommons.some(([id]) => id.startsWith('common'))).toBe(false);
    // Mythic, the last bucket, falls back to rare.
    const map = withFallback(source({ common: 2, uncommon: 0, rare: 1, mythic: 0 }));
    expect(map.get('uncommon')!.map((c) => c.id)).toEqual(['rare-0']);
    expect(map.get('mythic')!.map((c) => c.id)).toEqual(['rare-0']);
    const onlyMythic = drawExtras(source({ common: 0, uncommon: 0, rare: 0, mythic: 2 }), 9, 50);
    expect(total(onlyMythic)).toBe(50);
    for (const [id] of onlyMythic) expect(id.startsWith('mythic')).toBe(true);
  });

  it('refuses an empty candidate set', () => {
    expect(() =>
      drawExtras(source({ common: 0, uncommon: 0, rare: 0, mythic: 0 }), 1, 10),
    ).toThrow();
  });
});

describe('pool lists', () => {
  it('merge by summing copies and sort by id', () => {
    expect(
      mergeLists(
        [
          ['b', 2],
          ['a', 1],
        ],
        [
          ['c', 1],
          ['b', 1],
        ],
      ),
    ).toEqual([
      ['a', 1],
      ['b', 3],
      ['c', 1],
    ]);
  });

  it('format as JSON that reads back the same', () => {
    const pool: PoolFile = {
      id: 'theme-tokens-01',
      kind: 'theme',
      recipe: 'test',
      seed: 12,
      dataVersion: '2026-11-03',
      configVersion: 't5',
      cards: [
        ['a', 2],
        ['b', 1],
      ],
      added: [['b', 1]],
    };
    expect(JSON.parse(formatPool(pool))).toEqual(pool);
    const plain: PoolFile = {
      id: 'plain-01',
      kind: 'plain',
      recipe: 'r',
      seed: 1,
      dataVersion: 'd',
      configVersion: 'c',
      cards: [],
    };
    expect(JSON.parse(formatPool(plain))).toEqual(plain);
  });
});

describe('index color counts', () => {
  const identities: Record<string, Color[]> = {
    w1: ['W'],
    w2: ['W'],
    u1: ['U'],
    g1: ['G'],
    wu: ['W', 'U'],
    art: [],
  };
  const identityOf = (id: string) => identities[id];

  it('counts copies by exact single color, multicolor, and colorless', () => {
    const cards: [string, number][] = [
      ['art', 4],
      ['g1', 1],
      ['u1', 2],
      ['unknown', 5],
      ['w1', 3],
      ['w2', 1],
      ['wu', 2],
    ];
    expect(colorCounts(cards, identityOf)).toEqual({
      W: 4,
      U: 2,
      B: 0,
      R: 0,
      G: 1,
      multi: 2,
      colorless: 4,
    });
    const entry = indexEntry(
      {
        id: 'plain-01',
        kind: 'plain',
        recipe: 'r',
        seed: 1,
        dataVersion: 'd',
        configVersion: 'c',
        cards,
      },
      'plain/plain-01.json',
      identityOf,
    );
    expect(entry).toMatchObject({ id: 'plain-01', path: 'plain/plain-01.json' });
    expect(entry.copies).toBe(18);
    expect(entry.distinct).toBe(7);
  });
});
