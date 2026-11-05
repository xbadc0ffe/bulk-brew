import { describe, expect, it } from 'vitest';
import type { CardRecord } from '@bulk-brew/core';
import { flavorNamesFor, foldFlavorNames } from '../src/printings.ts';
import type { ScryfallCard } from '../src/scryfall.ts';

const printing = (extra: Partial<ScryfallCard>) =>
  ({
    id: 'p',
    oracle_id: 'o1',
    name: 'Winota, Joiner of Forces',
    layout: 'normal',
    color_identity: [],
    set: 'tst',
    ...extra,
  }) as ScryfallCard;

describe('foldFlavorNames', () => {
  it('collects card and face flavor names per oracle id', () => {
    const m = new Map<string, Set<string>>();
    foldFlavorNames(m, printing({ flavor_name: 'Bartz Klauser' }));
    foldFlavorNames(m, printing({ flavor_name: 'Bartz Klauser' }));
    foldFlavorNames(m, printing({}));
    foldFlavorNames(
      m,
      printing({
        oracle_id: 'o2',
        card_faces: [
          { name: 'Front', mana_cost: '', flavor_name: 'Front Alias' },
          { name: 'Back', mana_cost: '' },
        ],
      }),
    );
    expect([...m.get('o1')!]).toEqual(['Bartz Klauser']);
    expect([...m.get('o2')!]).toEqual(['Front Alias']);
  });

  it('reads the face oracle id on reversible cards', () => {
    const m = new Map<string, Set<string>>();
    const { oracle_id: _drop, ...rest } = printing({});
    foldFlavorNames(m, {
      ...rest,
      layout: 'reversible_card',
      card_faces: [{ name: 'A', mana_cost: '', oracle_id: 'face-o', flavor_name: 'Alias A' }],
    } as ScryfallCard);
    expect([...m.get('face-o')!]).toEqual(['Alias A']);
  });
});

describe('flavorNamesFor', () => {
  it('sorts and drops names the card already has', () => {
    const card = { name: 'Fire // Ice', faces: [{ name: 'Fire' }, { name: 'Ice' }] } as CardRecord;
    expect(flavorNamesFor(card, new Set(['Zed', 'fire', 'Alpha']))).toEqual(['Alpha', 'Zed']);
    expect(flavorNamesFor(card, undefined)).toEqual([]);
  });
});
