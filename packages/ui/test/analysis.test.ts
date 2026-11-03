import { describe, expect, it } from 'vitest';
import { CardIndex, type ArchetypeReport, type ScanReport } from '@bulk-brew/core';
import {
  analysisRows,
  archetypeViability,
  buildableSizes,
  curveBuckets,
  viabilityDetail,
} from '../src/data/analysis.ts';
import { DECK_SIZES, type ScansBySize } from '../src/data/analysis.ts';
import { scanAll } from '@bulk-brew/core';
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
    expect(archetypeViability(report({ viable: true }), possible)).toBe('viable');
    expect(archetypeViability(report({ notes: ['needs 3 more Tokens payoffs'] }), possible)).toBe(
      'near',
    );
    expect(
      archetypeViability(
        report({ notes: ['needs 2 more Tokens enablers', 'needs 2 more Tokens payoffs'] }),
        possible,
      ),
    ).toBe('none');
  });

  it('never calls a style near when the pool cannot build the size or the color is wrong', () => {
    const note = report({ notes: ['needs 1 more Tokens payoff'] });
    expect(archetypeViability(note, { possible: false } as ScanReport)).toBe('none');
    const wrongColor = report({
      notes: ['Lifegain does not work in this color', 'needs 1 more Lifegain payoff'],
    });
    expect(archetypeViability(wrongColor, possible)).toBe('none');
    expect(viabilityDetail(wrongColor, possible, 'none')).toBe('does not work in this color');
  });
});

describe('analysisRows', () => {
  it('puts the most buildable styles first and covers every size', () => {
    const rows = analysisRows(scans(), 'W');
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
