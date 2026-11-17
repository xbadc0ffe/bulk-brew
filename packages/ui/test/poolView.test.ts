import { describe, expect, it } from 'vitest';
import { CardIndex, deckCredits, type Color, type Deck } from '@bulk-brew/core';
import {
  cardTags,
  colorKey,
  majorTags,
  nextSort,
  poolFacets,
  poolRows,
  poolSummary,
  typeParts,
} from '../src/data/poolView.ts';
import { DISPLAY_TAGS } from '../src/data/config.ts';
import { deckGroups } from '../src/data/deckGroups.ts';
import { bigPool, CONFIG_BUNDLE as CONFIG, PACK } from '../../core/test/builder-fixtures.ts';
import { NEEDS_CARD, needsCard } from '../../core/test/needs-cards.ts';

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

describe('tags in a deck', () => {
  const needsIndex = new CardIndex({
    schema: 2,
    version: '2026-11-03',
    builtAt: '2026-11-03T00:00:00Z',
    cardCount: Object.keys(NEEDS_CARD).length,
    cards: Object.values(NEEDS_CARD),
  });
  const yathan = needsCard('Yathan Tombguard');
  const deckOf = (cards: [string, number][], colors: Color[]): Deck => ({
    id: 'test',
    name: 'Test',
    size: 60,
    color: colors[0]!,
    ...(colors.length > 1 ? { colors } : {}),
    archetype: 'counters',
    cards: [
      ...cards.map(([name, qty]) => ({ cardId: needsCard(name).id, qty })),
      // As a builder records it: picked for the role.
      { cardId: yathan.id, qty: 2, why: 'Card advantage' },
    ],
    basics: { B: 24 },
    committed: false,
    createdAt: '',
    configVersion: '',
    dataVersion: '',
  });
  const black: [string, number][] = [
    ['Walking Corpse', 4],
    ['Typhoid Rats', 4],
    ['Vampire Interloper', 4],
    ['Murder', 2],
  ];
  const counters: [string, number][] = [
    ['Luminarch Aspirant', 4],
    ['Hunger of the Howlpack', 2],
  ];
  const tags = (deck?: Deck) => {
    const credits = deck ? deckCredits(deck, needsIndex, CONFIG) : undefined;
    return {
      general: cardTags(needsIndex, CONFIG, yathan, credits).map((t) => t.label),
      major: majorTags(needsIndex, CONFIG, DISPLAY_TAGS, yathan, credits).map((t) => t.label),
    };
  };

  it('shows every credit outside a deck', () => {
    expect(tags().general).toEqual([
      'card advantage',
      'evasive threat',
      'evasion',
      '+1/+1 counters payoff',
    ]);
    expect(tags().major).toContain('Draw');
  });

  it('shows only what the card earns in a deck with no counters', () => {
    const { general, major } = tags(deckOf(black, ['B']));
    expect(general).not.toContain('card advantage');
    expect(general).not.toContain('+1/+1 counters payoff');
    expect(general).toContain('evasive threat');
    expect(major).not.toContain('Draw');
    expect(major).toContain('Evasion');
  });

  it('keeps card advantage in a deck with counters', () => {
    const { general, major } = tags(deckOf([...black, ...counters], ['B', 'W', 'G']));
    expect(general).toContain('card advantage');
    expect(general).toContain('+1/+1 counters payoff');
    expect(major).toContain('Draw');
  });

  it('leaves out a row reason the deck does not earn', () => {
    const why = (deck: Deck) =>
      deckGroups(deck, needsIndex, CONFIG)
        .flatMap((g) => g.rows)
        .find((r) => r.card?.id === yathan.id)!.why;
    expect(why(deckOf(black, ['B']))).toBeUndefined();
    expect(why(deckOf([...black, ...counters], ['B', 'W', 'G']))).toBe('card advantage');
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
