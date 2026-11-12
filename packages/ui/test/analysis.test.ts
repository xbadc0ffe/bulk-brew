import { describe, expect, it } from 'vitest';
import { CardIndex, type ArchetypeReport, type Deck, type ScanReport } from '@bulk-brew/core';
import {
  analysisRows,
  archetypeViability,
  buildableSizes,
  curveBuckets,
  primaryLacks,
  styleChoicesFrom,
  viabilityDetail,
  viabilityLabel,
} from '../src/data/analysis.ts';
import { nearestNote } from '../src/data/deckGroups.ts';
import { DECK_SIZES, type ScansBySize } from '../src/data/analysis.ts';
import { scanAll, scanPool } from '@bulk-brew/core';
import {
  bigPool,
  CONFIG_BUNDLE as CONFIG,
  PACK,
  SETTINGS,
  thinPool,
} from '../../core/test/builder-fixtures.ts';

const index = new CardIndex(PACK);

function scans(pool = bigPool()): ScansBySize {
  const out = {} as ScansBySize;
  for (const size of DECK_SIZES) out[size] = scanAll(pool, index, CONFIG, SETTINGS, size);
  return out;
}

const report = (over: Partial<ArchetypeReport>): ArchetypeReport => ({
  archetype: 'tokens',
  label: 'Tokens',
  kind: 'synergy',
  viable: false,
  enablers: { have: 10, want: 10 },
  payoffs: { have: 3, want: 6 },
  margin: -0.5,
  notes: [],
  ...over,
});
const possible = { possible: true } as ScanReport;

describe('archetypeViability', () => {
  it('labels viable, near miss, and not enough', () => {
    expect(archetypeViability(report({ viable: true }), possible, CONFIG)).toBe('viable');
    expect(
      archetypeViability(report({ notes: ['needs 3 more Tokens payoffs'] }), possible, CONFIG),
    ).toBe('near');
    expect(
      archetypeViability(
        report({ notes: ['needs 2 more Tokens enablers', 'needs 2 more Tokens payoffs'] }),
        possible,
        CONFIG,
      ),
    ).toBe('none');
  });

  it('never calls a style near when the pool cannot build the size or the color is wrong', () => {
    const note = report({ notes: ['needs 1 more Tokens payoff'] });
    expect(archetypeViability(note, { possible: false } as ScanReport, CONFIG)).toBe('none');
    const wrongColor = report({
      notes: ['Lifegain does not work in this color', 'needs 1 more Lifegain payoff'],
    });
    expect(archetypeViability(wrongColor, possible, CONFIG)).toBe('none');
    expect(viabilityDetail(wrongColor, possible, 'none')).toBe('does not work in this color');
  });
});

describe('archetypeViability with the theme rules', () => {
  const near = CONFIG.builderWeights.grow.nearMargin;
  const lacks = 'few repeatable ways to fill the graveyard (1 of 2)';
  const ruled = (viable: boolean, margin: number) =>
    // The old fields say viable, so only the rules can make it short or out.
    report({ viable: true, rules: { viable, margin, lacks: viable ? '' : lacks } });

  it('reads the rules where the scan carries them', () => {
    expect(archetypeViability(ruled(true, 1.4), possible, CONFIG)).toBe('viable');
    expect(archetypeViability(ruled(false, near), possible, CONFIG)).toBe('short');
    expect(archetypeViability(ruled(false, near - 0.01), possible, CONFIG)).toBe('none');
    expect(archetypeViability(ruled(true, 1.4), { possible: false } as ScanReport, CONFIG)).toBe(
      'none',
    );
  });

  it('says what a short style lacks in a sentence', () => {
    expect(viabilityLabel('short')).toBe('Short');
    expect(viabilityDetail(ruled(false, near), possible, 'short')).toBe(
      'Few repeatable ways to fill the graveyard (1 of 2)',
    );
    expect(viabilityDetail(ruled(false, 0.1), possible, 'none')).toBe(lacks);
  });
});

describe('styleChoicesFrom', () => {
  const near = CONFIG.builderWeights.grow.nearMargin;
  const scan = (colors: string, archetypes: ArchetypeReport[]) =>
    [colors, { possible: true, colors: [...colors], archetypes } as unknown as ScanReport] as const;
  const rules = (margin: number, lacks = '') => ({ viable: margin >= 1, margin, lacks });
  const at = (archetype: string, over: Partial<ArchetypeReport>) =>
    report({ archetype, label: archetype, ...over });

  it('offers viable, then short, then near styles, and leaves out the rest', () => {
    const scans = new Map([
      scan('WU', [
        at('graveyard', { rules: rules(near + 0.1, 'few graveyard fillers (5 of 8)') }),
        at('tokens', { rules: rules(0.2, 'few cards that make creature tokens (2 of 9)') }),
        at('flyers', { rules: rules(0.1, 'few flyers (1 of 10)') }),
        at('midrange', { kind: 'composition', notes: ['needs 2 more spells'] }),
      ]),
      scan('W', [
        at('graveyard', {
          rules: rules(near + 0.2, 'few cards that fill your graveyard (6 of 8)'),
        }),
        at('tokens', { rules: rules(0.2, 'few cards that make creature tokens (2 of 9)') }),
        at('flyers', { rules: rules(1.5) }),
        at('midrange', { kind: 'composition', notes: ['needs 1 more spell'] }),
      ]),
    ]);
    const choices = styleChoicesFrom(CONFIG, scans);
    expect(choices.map((c) => [c.id, c.state])).toEqual([
      ['flyers', 'viable'],
      ['graveyard', 'short'],
      ['midrange', 'near'],
    ]);
    const label = (id: string) => CONFIG.archetypes.archetypes.find((a) => a.id === id)!;
    expect(choices[0]).toMatchObject({
      label: label('flyers').label,
      description: label('flyers').description,
    });
    // The subset closest to the floors says what is missing.
    expect(choices[1]!.description).toBe('Few cards that fill your graveyard (6 of 8)');
    // A near miss keeps the first subset's note, as before.
    expect(choices[2]!.description).toBe('Needs 2 more spells');
  });

  it('reads real scans: the fixture pool builds Tokens, not Graveyard', () => {
    const pool = bigPool();
    const scans = new Map([['W', scanPool(pool, index, CONFIG, SETTINGS, 60, ['W'])]]);
    const choices = styleChoicesFrom(CONFIG, scans);
    expect(choices.find((c) => c.id === 'tokens')?.state).toBe('viable');
    expect(choices.some((c) => c.id === 'graveyard')).toBe(false);
  });
});

describe('primaryLacks', () => {
  it('reads the fullest subset that can build the size', () => {
    const scan = (colors: string, possible: boolean, lacks: string) =>
      [
        colors,
        {
          possible,
          colors: [...colors],
          archetypes: [report({ rules: { viable: false, margin: 0.2, lacks } })],
        } as unknown as ScanReport,
      ] as const;
    const scans = new Map([
      scan('W', true, 'few cards that make creature tokens (2 of 9)'),
      scan('WUB', false, 'few cards that make creature tokens (0 of 9)'),
      scan('WU', true, 'few cards that make creature tokens (3 of 9)'),
    ]);
    expect(primaryLacks(scans, 'tokens')).toBe('few cards that make creature tokens (3 of 9)');
    expect(primaryLacks(scans, 'graveyard')).toBeUndefined();
  });
});

describe('nearestNote', () => {
  it('says what was asked for, what the bulk list lacks, and what was built', () => {
    const deck = {
      archetype: 'aristocrats',
      explanation: {
        nearest: {
          requested: 'graveyard',
          lacks: 'few repeatable ways to fill the graveyard (1 of 2)',
        },
      },
    } as unknown as Deck;
    expect(nearestNote(CONFIG, deck)).toBe(
      'Asked for Graveyard: your bulk list has few repeatable ways to fill the graveyard (1 of 2). Built Aristocrats instead.',
    );
    expect(nearestNote(CONFIG, { archetype: 'aristocrats' } as Deck)).toBeUndefined();
  });
});

describe('analysisRows', () => {
  it('puts the most buildable styles first and covers every size', () => {
    const rows = analysisRows(scans(), 'W', CONFIG);
    expect(rows.length).toBe(CONFIG.archetypes.archetypes.length);
    const states = rows.map((r) => DECK_SIZES.filter((s) => r.cells[s].state === 'viable').length);
    expect(states).toEqual([...states].sort((a, b) => b - a));
    const tokens = rows.find((r) => r.archetype === 'tokens')!;
    expect(tokens.cells[60].state).toBe('viable');
    expect(tokens.cells[60].detail).toMatch(/\d+ enablers · \d+ payoffs/);
  });

  it('reports which sizes a color can build', () => {
    expect(buildableSizes(scans(), 'W')).toEqual([60, 40, 20]);
    expect(buildableSizes(scans(), 'U')).toEqual([]);
    expect(buildableSizes(scans(thinPool()), 'W')).toEqual([]);
  });
});

describe('curveBuckets', () => {
  it('folds seven-plus into six-plus', () => {
    expect(curveBuckets([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([1, 2, 3, 4, 5, 6, 15]);
  });
});
