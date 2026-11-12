import { describe, expect, it } from 'vitest';
import type { ArchetypeReport } from '@bulk-brew/core';
import {
  bestColorFor,
  colorsInComment,
  expandJobs,
  hasPrefix,
  hasTwoColor,
  isPartner,
  jobFileName,
  largestColor,
  pickCommanders,
  poolColorSets,
  requestsFor,
  seedsFor,
  setOf,
  styleRequests,
  themeStyleOf,
  twoColorSets,
  type CommanderPick,
  type PoolRequest,
} from '../src/review/requests.ts';

const NO_COUNTS = { W: 0, U: 0, B: 0, R: 0, G: 0 };

describe('pool colors', () => {
  it('reads the colors a public pool comment names before its first colon or full stop', () => {
    expect(colorsInComment('// Synthetic black bulk pool: 140 distinct mono-black cards')).toEqual([
      'B',
    ]);
    expect(colorsInComment('// Black pool padded with gold: 40 mono-red.')).toEqual(['B']);
    expect(colorsInComment('// Mono-white bulk pool used as a fixture. Red is later.')).toEqual([
      'W',
    ]);
    expect(colorsInComment('# Green-blue pool\n1 Opt')).toEqual(['U', 'G']);
    expect(colorsInComment('// Commander tribe smoke pool: the Elven Empire precon')).toEqual([]);
    expect(colorsInComment('1 Opt\n2 Shock')).toEqual([]);
  });

  it('falls back to the largest color, ties in WUBRG order', () => {
    expect(largestColor({ ...NO_COUNTS, G: 307, B: 289 })).toBe('G');
    expect(largestColor({ ...NO_COUNTS, U: 5, R: 5 })).toBe('U');
    expect(largestColor(NO_COUNTS)).toBe('W');
  });

  it('asks every mono color of plain, theme, and owner pools, and one set of a public pool', () => {
    const mono = [['W'], ['U'], ['B'], ['R'], ['G']];
    expect(poolColorSets('plain', NO_COUNTS)).toEqual(mono);
    expect(poolColorSets('theme', NO_COUNTS, '// Blue pool')).toEqual(mono);
    expect(poolColorSets('owner', NO_COUNTS)).toEqual(mono);
    expect(poolColorSets('public', NO_COUNTS, '// Thin red pool: 40 cards')).toEqual([['R']]);
    expect(poolColorSets('public', { ...NO_COUNTS, G: 3 }, '// Smoke pool')).toEqual([['G']]);
    expect(poolColorSets('public', { ...NO_COUNTS, B: 3 })).toEqual([['B']]);
  });

  it('adds every two-color pair, plain pools at 60 and 40 only, unless turned off', () => {
    expect(twoColorSets().map((c) => c.join(''))).toEqual([
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
    expect(hasTwoColor('plain', 60)).toBe(true);
    expect(hasTwoColor('plain', 40)).toBe(true);
    expect(hasTwoColor('plain', 20)).toBe(false);
    expect(hasTwoColor('plain', 100)).toBe(false);
    expect(hasTwoColor('theme', 60)).toBe(false);
    expect(hasTwoColor('public', 60)).toBe(false);
    expect(hasTwoColor('owner', 60)).toBe(false);
    expect(hasTwoColor('plain', 60, false)).toBe(false);
  });

  it('finds the enriched style in a theme pool id', () => {
    expect(themeStyleOf('theme-bigCreatures-02')).toBe('bigCreatures');
    expect(themeStyleOf('plain-01')).toBeUndefined();
    expect(themeStyleOf('public-bulk-black')).toBeUndefined();
  });

  it('reads a seed prefix out of pool ids', () => {
    expect(themeStyleOf('h1-theme-graveyard-03')).toBe('graveyard');
    expect(themeStyleOf('H2b-theme-bigCreatures-01')).toBe('bigCreatures');
    expect(themeStyleOf('h1-plain-01')).toBeUndefined();
    expect(hasPrefix('h1-plain-01', 'h1')).toBe(true);
    expect(hasPrefix('h1-theme-tokens-02', 'h1')).toBe(true);
    expect(hasPrefix('h12-plain-01', 'h1')).toBe(false);
    expect(hasPrefix('plain-01', 'h1')).toBe(false);
    expect(hasPrefix('public-bulk-black', 'h1')).toBe(false);
    expect(hasPrefix('public-bulk-black')).toBe(true);
  });
});

function report(
  archetype: string,
  kind: ArchetypeReport['kind'],
  viable: boolean,
  rules?: boolean,
) {
  return {
    archetype,
    kind,
    viable,
    ...(rules === undefined ? {} : { rules: { viable: rules, margin: rules ? 1 : 0, lacks: '' } }),
  } as ArchetypeReport;
}

describe('styleRequests', () => {
  const scan = {
    archetypes: [
      report('aggro', 'composition', true),
      report('midrange', 'composition', true),
      report('control', 'composition', false),
      report('tokens', 'synergy', true, false),
      report('mill', 'synergy', false),
      report('burn', 'synergy', true),
      // The old matchers reject it, the theme rules accept it.
      report('graveyard', 'synergy', false, true),
      report('lifegain', 'synergy', false, false),
    ],
  };

  it('puts best fit first, then every style either scan accepts in config order, shapes by name', () => {
    expect(styleRequests(scan)).toEqual([
      { reason: 'bestfit' },
      { style: 'aggro', reason: 'shape' },
      { style: 'midrange', reason: 'shape' },
      { style: 'tokens', reason: 'viable' },
      { style: 'burn', reason: 'viable' },
      { style: 'graveyard', reason: 'viable' },
    ]);
  });

  it('adds viable tribes sorted, and the enriched style only when the scan left it out', () => {
    expect(styleRequests(scan, 'mill', ['tribal:Zombie', 'tribal:Elf'])).toEqual([
      { reason: 'bestfit' },
      { style: 'aggro', reason: 'shape' },
      { style: 'midrange', reason: 'shape' },
      { style: 'tokens', reason: 'viable' },
      { style: 'burn', reason: 'viable' },
      { style: 'graveyard', reason: 'viable' },
      { style: 'tribal:Elf', reason: 'viable' },
      { style: 'tribal:Zombie', reason: 'viable' },
      { style: 'mill', reason: 'enriched' },
    ]);
    expect(styleRequests(scan, 'tokens').filter((s) => s.style === 'tokens')).toEqual([
      { style: 'tokens', reason: 'viable' },
    ]);
  });
});

describe('commanders', () => {
  const c = (name: string, over: Partial<CommanderPick> = {}): CommanderPick => ({
    id: name.toLowerCase(),
    name,
    colors: ['W'],
    tier: 'top',
    score: 3,
    enough: true,
    partner: false,
    primaryTribes: [],
    ...over,
  });
  const names = (list: CommanderPick[]) => list.map((x) => x.name);

  it('spots partner-style keywords', () => {
    expect(isPartner({ keywords: ['Flying', 'Partner'] })).toBe(true);
    expect(isPartner({ keywords: ['Partner with'] })).toBe(true);
    expect(isPartner({ keywords: ['Choose a background'] })).toBe(true);
    expect(isPartner({ keywords: ["Doctor's companion"] })).toBe(true);
    expect(isPartner({ keywords: ['Friends forever'] })).toBe(true);
    expect(isPartner({ keywords: ['Companion', 'Flying'] })).toBe(false);
  });

  it('orders by tier, then score, then name, and drops partners and short pools', () => {
    const list = [
      c('Zed', { score: 3 }),
      c('Amy', { score: 3 }),
      c('Top', { score: 4, tier: 'good' }),
      c('Best', { score: 5, partner: true }),
      c('Short', { score: 6, enough: false }),
    ];
    expect(names(pickCommanders(list))).toEqual(['Amy', 'Zed']);
    expect(names(pickCommanders(list, undefined, 3))).toEqual(['Amy', 'Zed', 'Top']);
  });

  it('swaps the second pick for the first in the window with the preferred color', () => {
    const list = [
      c('A', { score: 9 }),
      c('B', { score: 8 }),
      c('C', { score: 7 }),
      c('D', { score: 6, colors: ['U', 'B'] }),
      c('E', { score: 5, colors: ['B'] }),
    ];
    expect(names(pickCommanders(list, 'B'))).toEqual(['A', 'D']);
    // Already among the first two: no change.
    expect(names(pickCommanders(list, 'W'))).toEqual(['A', 'B']);
    // Outside the window: no change.
    expect(names(pickCommanders(list, 'B', 2, 3))).toEqual(['A', 'B']);
    expect(names(pickCommanders(list, 'G'))).toEqual(['A', 'B']);
  });

  it("takes the enriched style's best color from the scan counts", () => {
    expect(bestColorFor({ W: 3, U: 9, B: 9, R: 1, G: 0 })).toBe('U');
    expect(bestColorFor({ W: 3, U: 9, B: 9, R: 1, G: 0 }, ['R', 'B'])).toBe('B');
    expect(bestColorFor({ W: 0, U: 0 })).toBeUndefined();
  });
});

describe('job files', () => {
  it('names a file per set and version', () => {
    expect(setOf(60)).toBe('main');
    expect(setOf(100)).toBe('main');
    expect(setOf(40)).toBe('small');
    expect(setOf(20)).toBe('small');
    expect(jobFileName('main', 'v26.0.30')).toBe('main-v26.0.30.json');
    expect(seedsFor('head')).toEqual([1]);
    expect(seedsFor('random')).toEqual([1, 2]);
  });

  const requests: PoolRequest[] = [
    {
      pool: 'data/review/pools/plain/plain-01.json',
      poolId: 'plain-01',
      kind: 'plain',
      size: 60,
      colors: ['B'],
      reason: 'bestfit',
    },
    {
      pool: 'data/review/pools/plain/plain-01.json',
      poolId: 'plain-01',
      kind: 'plain',
      size: 20,
      colors: ['B'],
      style: 'tokens',
      reason: 'viable',
    },
    {
      pool: 'data/review/pools/public/elf-tribe.json',
      poolId: 'public-elf-tribe',
      kind: 'public',
      size: 100,
      colors: ['B', 'G'],
      style: 'tribal:Elf',
      reason: 'viable',
      commander: { id: 'id-1', name: 'Lathril, Blade of the Elves' },
    },
  ];

  it('copies requests per version and seed, with the deck file the runner writes', () => {
    const files = expandJobs(requests, ['head', 'random']);
    expect([...files.keys()]).toEqual([
      'main-head.json',
      'small-head.json',
      'main-random.json',
      'small-random.json',
    ]);
    expect(files.get('main-head.json')).toEqual([
      {
        version: 'head',
        pool: 'data/review/pools/plain/plain-01.json',
        colors: 'B',
        size: 60,
        seed: 1,
        reason: 'bestfit',
        deck: 'head/plain-01-B-60-bestfit-s1.json',
      },
      {
        version: 'head',
        pool: 'data/review/pools/public/elf-tribe.json',
        colors: 'BG',
        size: 100,
        style: 'tribal:Elf',
        commander: 'id-1',
        commanderName: 'Lathril, Blade of the Elves',
        seed: 1,
        reason: 'viable',
        deck: 'head/public-elf-tribe-BG-100-tribal-Elf-lathril-blade-of-the-elves-s1.json',
      },
    ]);
    expect(files.get('small-random.json')!.map((j) => j.deck)).toEqual([
      'random/plain-01-B-20-tokens-s1.json',
      'random/plain-01-B-20-tokens-s2.json',
    ]);
  });

  it('records the two-color slice in the job', () => {
    const two: PoolRequest = {
      ...requests[0]!,
      colors: ['U', 'B'],
      style: 'control',
      reason: 'shape',
      slice: 'two-color',
    };
    expect(expandJobs([two], ['head']).get('main-head.json')).toEqual([
      {
        version: 'head',
        pool: 'data/review/pools/plain/plain-01.json',
        colors: 'UB',
        size: 60,
        style: 'control',
        seed: 1,
        reason: 'shape',
        slice: 'two-color',
        deck: 'head/plain-01-UB-60-control-s1.json',
      },
    ]);
  });

  it('gives a best-fit-only version only the best-fit requests', () => {
    const only = new Set(['head-web']);
    expect(requestsFor(requests, 'head-web', only)).toEqual([requests[0]]);
    expect(requestsFor(requests, 'head', only)).toEqual(requests);
    const files = expandJobs(requests, ['head-web'], only);
    expect(files.get('main-head-web.json')!.map((j) => j.deck)).toEqual([
      'head-web/plain-01-B-60-bestfit-s1.json',
    ]);
    expect(files.get('small-head-web.json')).toBeUndefined();
  });
});
