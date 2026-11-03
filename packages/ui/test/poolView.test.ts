import { describe, expect, it } from 'vitest';
import { CardIndex } from '@bulk-brew/core';
import { cardTags, colorKey, poolRows, poolSummary } from '../src/data/poolView.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK } from '../../core/test/builder-fixtures.ts';

const index = new CardIndex(PACK);
const pool = bigPool();
const ids = (opts: Parameters<typeof poolRows>[2]) =>
  poolRows(pool, index, { ...opts, config: CONFIG }).map((r) => r.card.id);

describe('poolRows filters', () => {
  it('filters by color class, with gold and colorless as their own classes', () => {
    expect(ids({ colors: ['M'] })).toEqual(['wu-creature']);
    const colorless = ids({ colors: ['C'] });
    expect(colorless).toContain('c-artifact');
    expect(colorless.every((id) => index.get(id)!.identity.length === 0)).toBe(true);
    expect(ids({ colors: ['U', 'M'] }).sort()).toEqual(['u-creature', 'wu-creature']);
    expect(colorKey(index.get('wu-creature')!)).toBe('M');
  });

  it('filters by type, mana value with six-plus, and tags, combining categories', () => {
    expect(ids({ types: ['sorcery'] }).every((id) => id.startsWith('w-draw'))).toBe(true);
    const six = ids({ manaValues: [6] });
    expect(six.length).toBeGreaterThan(0);
    expect(six.every((id) => index.get(id)!.mv >= 6)).toBe(true);
    const removal = ids({ tags: ['role:removal'] });
    expect(removal.some((id) => id.startsWith('w-removal'))).toBe(true);
    expect(ids({ tags: ['role:removal'], types: ['sorcery'] })).toEqual([]);
  });

  it('searches names, type lines, and oracle text', () => {
    expect(ids({ search: 'colorless rock' })).toEqual(['c-artifact']);
    expect(ids({ search: 'sorcery' }).every((id) => id.startsWith('w-draw'))).toBe(true);
  });

  it('labels tags in plain words from the config', () => {
    const tags = cardTags(index, CONFIG, index.get('w-removal-0')!).map((t) => t.label);
    expect(tags).toContain('removal');
  });

  it('sums copies per color class', () => {
    const s = poolSummary(pool, index);
    expect(s.byColor.M).toBe(4);
    expect(s.cards).toBe(Object.values(pool.entries).reduce((n, e) => n + e.qty, 0));
  });
});
