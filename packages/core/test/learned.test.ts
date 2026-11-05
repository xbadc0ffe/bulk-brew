import { describe, expect, it } from 'vitest';
import {
  parseLearnedData,
  trimLearned,
  validateLearnedConfig,
  type LearnedConfig,
  type LearnedDataFile,
} from '../src/learned.ts';
import { configVersion, validateConfig } from '../src/config.ts';
import { CONFIG } from './config.test.ts';

const FILE: LearnedDataFile = {
  schema: 1,
  version: 'abc',
  sources: { corpus: '2026-11-03.s2' },
  ids: ['a', 'b', 'c'],
  fit: { tokens: [[0, 2.5]] },
  commanders: [[2, { tokens: 0.4 }, [[0, 0.3]]]],
  pairs: [[0, 1, 1.8]],
  combos: [['1-2', [0, 1], -1, [13], 'C', 3]],
  results: { '13': 'Infinite damage' },
};

const LEARNED: LearnedConfig = {
  plans: {
    version: 'p1',
    bulkShare: { tokens: { W: 0.08, C: 0.02 } },
    tribeShare: { Elf: { G: 0.05 } },
    sizes: {
      '60': {
        features: ['theme enablers', 'creatures'],
        all: [null, [0.5, 0.6, 0.7]],
        plans: {
          tokens: {
            decks: 8,
            source: 'plan',
            q: [
              [0.2, 0.25, 0.3],
              [0.5, 0.6, 0.7],
            ],
            lands: [24, 25, 25],
          },
        },
      },
    },
  },
  tags: { version: 'g1', fit: { tokens: { 'synergy-token': 3 } }, pairs: [['a', 'b', 2]] },
};

describe('learned card data', () => {
  it('reads plan fit, commanders, pairs both ways, and combos', () => {
    const { data, problems } = parseLearnedData(JSON.stringify(FILE));
    expect(problems).toEqual([]);
    expect(data!.version).toBe('abc');
    expect(data!.fit.get('tokens')!.get('a')).toBe(2.5);
    expect(data!.commanders.get('c')!.plans.tokens).toBe(0.4);
    expect(data!.commanders.get('c')!.cards.get('a')).toBe(0.3);
    expect(data!.pairs.get('b')!.get('a')).toBe(1.8);
    const combo = data!.combosByCard.get('b')![0]!;
    expect(combo).toMatchObject({ id: '1-2', cards: ['a', 'b'], results: ['Infinite damage'] });
    expect(combo.commanderLegal && combo.vintageLegal).toBe(true);
  });

  it('refuses a file with bad card references, another schema, or broken JSON', () => {
    expect(parseLearnedData('{').data).toBeUndefined();
    expect(parseLearnedData(JSON.stringify({ ...FILE, schema: 2 })).data).toBeUndefined();
    expect(parseLearnedData(JSON.stringify({ ...FILE, fit: { x: [null] } })).data).toBeUndefined();
    const bad = { ...FILE, pairs: [[0, 9, 1.5]] };
    const { data, problems } = parseLearnedData(JSON.stringify(bad));
    expect(data).toBeUndefined();
    expect(problems).toContain('pairs: bad entry');
  });
});

describe('trimLearned', () => {
  it('keeps only what a pool of the given cards can use', () => {
    const t = trimLearned(FILE, new Set(['a', 'c']));
    expect(t.ids).toEqual(['a', 'c']);
    expect(t.pairs).toEqual([]);
    expect(t.combos).toEqual([]);
    expect(t.commanders).toEqual([[1, { tokens: 0.4 }, [[0, 0.3]]]]);
    expect(parseLearnedData(JSON.stringify(t)).problems).toEqual([]);
  });
});

describe('learned config', () => {
  it('validates and joins the config version', () => {
    expect(validateLearnedConfig(LEARNED, new Set(['tokens']))).toEqual([]);
    const withLearned = { ...CONFIG, learned: LEARNED };
    expect(validateConfig(withLearned)).toEqual([]);
    const { learned: _shipped, ...bare } = CONFIG;
    expect(configVersion(withLearned)).toBe(`${configVersion(bare)}.pp1.gg1`);
  });

  it('flags unknown styles and broken spreads', () => {
    const broken: LearnedConfig = {
      ...LEARNED,
      plans: {
        ...LEARNED.plans,
        sizes: {
          '60': {
            ...LEARNED.plans.sizes['60']!,
            plans: {
              nope: { decks: 1, source: 'plan', q: [null, [0.7, 0.6, 0.5]], lands: [1, 2, 3] },
            },
          },
        },
      },
    };
    const problems = validateLearnedConfig(broken, new Set(['tokens']));
    expect(problems.some((p) => p.includes('nope: unknown style'))).toBe(true);
    expect(problems.some((p) => p.includes('[q1, median, q3]'))).toBe(true);
  });
});
