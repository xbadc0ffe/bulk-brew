import { describe, expect, it } from 'vitest';
import {
  cardMatches,
  isFinisher,
  isMdfcLand,
  manaSourceKind,
  powerValue,
} from '../src/matchers.ts';
import type { CardRecord } from '../src/types.ts';

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  return {
    id: partial.name.toLowerCase().replace(/\W+/g, '-'),
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature',
    text: 'Some text.',
    colors: ['G'],
    identity: ['G'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    ...partial,
  };
}

describe('derived predicates', () => {
  it('reads power, treating stars as zero', () => {
    expect(powerValue(card({ name: 'A', power: '4' }))).toBe(4);
    expect(powerValue(card({ name: 'B', power: '*' }))).toBe(0);
    expect(powerValue(card({ name: 'C' }))).toBe(0);
  });

  it('recognizes finishers by size, evasion, or planeswalker type', () => {
    expect(isFinisher(card({ name: 'Big', mv: 5, power: '5' }))).toBe(true);
    expect(isFinisher(card({ name: 'Angel', mv: 4, power: '3', keywords: ['Flying'] }))).toBe(true);
    expect(isFinisher(card({ name: 'Bear', mv: 2, power: '2' }))).toBe(false);
    expect(isFinisher(card({ name: 'Journeyman', mv: 5, power: '3' }))).toBe(false);
    expect(
      isFinisher(
        card({ name: 'Cheap Walker', mv: 2, typeLine: 'Planeswalker', types: ['planeswalker'] }),
      ),
    ).toBe(false);
    expect(
      isFinisher(
        card({
          name: 'Walker',
          mv: 4,
          typeLine: 'Legendary Planeswalker',
          types: ['planeswalker'],
        }),
      ),
    ).toBe(true);
  });

  it('classifies cheap mana sources by kind and cost', () => {
    expect(manaSourceKind(card({ name: 'Elf', mv: 1, tags: ['mana-dork', 'ramp'] }))).toBe('dork');
    expect(
      manaSourceKind(card({ name: 'Stone', mv: 2, types: ['artifact'], tags: ['mana-rock'] })),
    ).toBe('rock');
    expect(
      manaSourceKind(
        card({ name: 'Growth', mv: 2, types: ['sorcery'], tags: ['tutor-land-to-battlefield'] }),
      ),
    ).toBe('landRamp');
    expect(
      manaSourceKind(card({ name: 'Explore', mv: 2, types: ['sorcery'], tags: ['land-ramp'] })),
    ).toBeUndefined();
    expect(
      manaSourceKind(card({ name: 'Pricey', mv: 4, types: ['artifact'], tags: ['mana-rock'] })),
    ).toBeUndefined();
    expect(
      manaSourceKind(card({ name: 'Land', mv: 0, types: ['land'], tags: ['mana-producer'] })),
    ).toBeUndefined();
  });

  it('spots modal land faces but not plain lands', () => {
    expect(
      isMdfcLand(
        card({
          name: 'Spell // Place',
          layout: 'modal_dfc',
          typeLine: 'Creature // Land',
          types: ['creature', 'land'],
        }),
      ),
    ).toBe(true);
    expect(isMdfcLand(card({ name: 'Forest', typeLine: 'Basic Land', types: ['land'] }))).toBe(
      false,
    );
  });
});

describe('cardMatches', () => {
  const bolt = card({
    name: 'Bolt',
    mv: 1,
    types: ['instant'],
    typeLine: 'Instant',
    tags: ['burn', 'spot-removal', 'removal'],
  });
  const bird = card({ name: 'Bird', mv: 2, keywords: ['Flying'], tags: ['evasion'], power: '1' });
  const aura = card({
    name: 'Rancor',
    mv: 1,
    types: ['enchantment'],
    typeLine: 'Enchantment — Aura',
  });

  it('matches any clause, requiring every condition in the clause', () => {
    expect(
      cardMatches(bolt, [{ anyTags: ['spot-removal'], maxMv: 2, excludeTypes: ['creature'] }]),
    ).toBe(true);
    expect(cardMatches(bolt, [{ anyTags: ['spot-removal'], types: ['creature'] }])).toBe(false);
    expect(cardMatches(bird, [{ anyTags: ['nothing'] }, { anyKeywords: ['Flying'] }])).toBe(true);
  });

  it('supports type line words, keywords, and exclusions', () => {
    expect(cardMatches(aura, [{ typeLineAny: ['Aura', 'Equipment'] }])).toBe(true);
    expect(cardMatches(bird, [{ anyTags: ['evasion'], excludeTags: ['evasion'] }])).toBe(false);
    expect(cardMatches(bird, [{ derived: 'evasiveCreature' }])).toBe(true);
    expect(cardMatches(bolt, [{ derived: 'evasiveCreature' }])).toBe(false);
  });
});
