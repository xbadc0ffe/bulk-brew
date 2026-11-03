import { describe, expect, it } from 'vitest';
import { parseDecklist } from '../src/decklist.ts';
import { CardIndex } from '../src/pack.ts';
import { editDistance, resolveLines, suggestNames, toPoolEntries } from '../src/resolve.ts';
import { PACK } from './fixtures.ts';

const index = new CardIndex(PACK);

describe('resolveLines', () => {
  it('splits resolved and unresolved lines and counts copies', () => {
    const { lines } = parseDecklist(
      '4 Lightning Bolt (M10) 146\n2 Fire // Ice\n1 Lightning Blot\n3 Forest',
    );
    const report = resolveLines(lines, index);
    expect(report.resolved.map((r) => r.card.id)).toEqual(['bolt', 'fireice', 'forest']);
    expect(report.cardCount).toBe(9);
    expect(report.unresolved).toHaveLength(1);
    expect(report.unresolved[0]?.line.name).toBe('Lightning Blot');
    expect(report.unresolved[0]?.suggestions).toEqual(['Lightning Bolt']);
  });

  it('merges duplicate lines into one pool entry and keeps the first printing hint', () => {
    const { lines } = parseDecklist(
      '2 Lightning Bolt (M10) 146\n1 Lightning Bolt (2XM) 1\n1 Forest',
    );
    const entries = toPoolEntries(resolveLines(lines, index).resolved);
    expect(entries).toEqual([
      { cardId: 'bolt', qty: 3, printing: { set: 'm10', collectorNumber: '146' } },
      { cardId: 'forest', qty: 1 },
    ]);
  });
});

describe('suggestNames', () => {
  it('offers close names only', () => {
    expect(suggestNames(index, 'Lightnin Bolt')).toEqual(['Lightning Bolt']);
    expect(suggestNames(index, 'Zebra Unicorn Rainbow')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('computes Levenshtein distance with early exit', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('abcdefgh', 'xyz', 2)).toBe(3);
  });
});
