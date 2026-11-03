import { describe, expect, it } from 'vitest';
import { CardIndex } from '@bulk-brew/core';
import {
  cardTags,
  colorKey,
  nextSort,
  poolFacets,
  poolRows,
  poolSummary,
  typeParts,
} from '../src/data/poolView.ts';
import { DISPLAY_TAGS } from '../src/data/config.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK } from '../../core/test/builder-fixtures.ts';

const index = new CardIndex(PACK);
const pool = bigPool();
const ids = (opts: Parameters<typeof poolRows>[2]) =>
  poolRows(pool, index, { ...opts, config: CONFIG, displayTags: DISPLAY_TAGS }).map(
    (r) => r.card.id,
  );

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
    const six = ids({ mv: { op: 'ge', value: 6 } });
    expect(six.length).toBeGreaterThan(0);
    expect(six.every((id) => index.get(id)!.mv >= 6)).toBe(true);
    const removal = ids({ subtags: ['role:removal'] });
    expect(removal.some((id) => id.startsWith('w-removal'))).toBe(true);
    expect(ids({ subtags: ['role:removal'], types: ['sorcery'] })).toEqual([]);
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

  it('filters by short tags and sorts by a clicked column', () => {
    const removal = ids({ tags: ['removal'] });
    expect(removal.some((id) => id.startsWith('w-removal'))).toBe(true);
    const byQty = poolRows(pool, index, { sort: { key: 'qty', dir: 'desc' } });
    expect(byQty[0]!.entry.qty).toBe(Math.max(...byQty.map((r) => r.entry.qty)));
    const byCost = poolRows(pool, index, { sort: { key: 'cost', dir: 'asc' } }).map(
      (r) => r.card.mv,
    );
    expect(byCost).toEqual([...byCost].sort((a, b) => a - b));
  });

  it('offers only values present in the pool', () => {
    const f = poolFacets(pool, index, CONFIG, DISPLAY_TAGS);
    expect(f.types.map((t) => t.id)).not.toContain('planeswalker');
    expect(f.types.map((t) => t.id)).toContain('creature');
    expect(f.subtypes.map((s) => s.id)).toContain('Human');
    expect(f.tags.map((t) => t.label)).toContain('Removal');
  });
});

describe('typeParts and nextSort', () => {
  it('splits type lines at the dash, face by face', () => {
    expect(typeParts('Legendary Creature — Human Soldier')).toEqual({
      type: 'Legendary Creature',
      subtype: 'Human Soldier',
    });
    expect(typeParts('Instant')).toEqual({ type: 'Instant', subtype: '' });
    expect(typeParts('Creature — Elf // Land')).toEqual({
      type: 'Creature // Land',
      subtype: 'Elf',
    });
  });

  it('cycles ascending, descending, off; quantity starts high', () => {
    const a = nextSort(undefined, 'name');
    expect(a).toEqual({ key: 'name', dir: 'asc' });
    const b = nextSort(a, 'name');
    expect(b).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort(b, 'name')).toBeUndefined();
    expect(nextSort(b, 'qty')).toEqual({ key: 'qty', dir: 'desc' });
  });
});
