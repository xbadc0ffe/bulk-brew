// The half cast rule (template.halfCast): a 20-card packet keeps out spells
// its lands cannot cast once it is shuffled with another packet.

import { describe, expect, it } from 'vitest';
import { halfCastable, listCandidates } from '../src/candidates.ts';
import { templateFor, validateConfig, type BulkBrewConfig } from '../src/config.ts';
import { CardIndex } from '../src/pack.ts';
import type { Color, DeckSize, Pool } from '../src/types.ts';
import { CONFIG_BUNDLE as CONFIG, PACK, SETTINGS } from './builder-fixtures.ts';
import { HALF_CARDS } from './half-cards.ts';

const index = new CardIndex({ ...PACK, cardCount: HALF_CARDS.length, cards: HALF_CARDS });
const pool: Pool = {
  entries: Object.fromEntries(HALF_CARDS.map((c) => [c.id, { cardId: c.id, qty: 2 }])),
  updatedAt: 't',
};
const byName = (name: string) => HALF_CARDS.find((c) => c.name === name)!;
const names = (colors: Color[], size: DeckSize) =>
  listCandidates(pool, index, CONFIG, SETTINGS, colors, size)
    .map((c) => c.facts.card.name)
    .sort();

describe('the half cast rule', () => {
  const t20 = templateFor(CONFIG, 20);

  it('keeps ten-drops and eight-drops out of a packet, but not out of larger decks', () => {
    for (const name of ['Ulamog, the Ceaseless Hunger', 'Kozilek, Butcher of Truth'])
      expect(halfCastable(byName(name), ['B'], t20)).toBe(false);
    expect(halfCastable(byName('Craterhoof Behemoth'), ['G'], t20)).toBe(false);
    expect(names(['G'], 20)).toEqual([]);
    expect(names(['G'], 40)).toEqual([
      'Craterhoof Behemoth',
      'Kozilek, Butcher of Truth',
      'Ulamog, the Ceaseless Hunger',
    ]);
  });

  it('keeps a seven-drop and a four-pip four-drop, but not five pips of one color', () => {
    expect(halfCastable(byName('Gearseeker Serpent'), ['U'], t20)).toBe(true);
    expect(halfCastable(byName('Phyrexian Obliterator'), ['B'], t20)).toBe(true);
    expect(halfCastable(byName('Pox Plague'), ['B'], t20)).toBe(false);
    expect(names(['B'], 20)).toEqual(['Phyrexian Obliterator']);
  });

  it('splits its own lands among its colors', () => {
    // Four of eight lands make black in a two-color packet: four black pips are out of reach.
    expect(halfCastable(byName('Phyrexian Obliterator'), ['W', 'B'], t20)).toBe(false);
    expect(names(['W', 'B'], 20)).toEqual([]);
  });

  it('pays a hybrid pip from either color', () => {
    // {R/W}{R/W}{R/W}: all eight lands of a red and white packet pay it, as in mono-red.
    const reckoner = byName('Boros Reckoner');
    expect(halfCastable(reckoner, ['R'], t20)).toBe(true);
    expect(halfCastable(reckoner, ['R', 'W'], t20)).toBe(true);
    // In a white and black packet only the four white lands do.
    expect(halfCastable(reckoner, ['W', 'B'], t20)).toBe(false);
    expect(names(['R', 'W'], 20)).toEqual([
      'Boom // Bust',
      'Boros Reckoner',
      'Fallaji Dragon Engine',
    ]);
  });

  it('reads a prototype card by its cheaper cost', () => {
    // Fallaji Dragon Engine costs {8}, or {2}{R} as a prototype.
    const engine = byName('Fallaji Dragon Engine');
    expect(engine.mv).toBe(8);
    expect(halfCastable(engine, ['R'], t20)).toBe(true);
    expect(halfCastable({ ...engine, text: 'Flying' }, ['R'], t20)).toBe(false);
  });

  it('reads a split card by its cheapest half', () => {
    // Boom // Bust has mana value 8 as a whole; Boom costs {1}{R}.
    const boom = byName('Boom // Bust');
    expect(boom.mv).toBe(8);
    expect(halfCastable(boom, ['R'], t20)).toBe(true);
    expect(halfCastable({ ...boom, layout: 'normal' }, ['R'], t20)).toBe(false);
  });

  it('rejects a rule outside the range its meaning allows', () => {
    const c = JSON.parse(JSON.stringify(CONFIG)) as BulkBrewConfig;
    c.deckTemplates.templates['20']!.halfCast = { turn: 0, minChance: 1.5 };
    expect(validateConfig(c)).toContain(
      'deckTemplates.20.halfCast: turn must be at least 1 and minChance from 0 to 1',
    );
    expect(validateConfig(CONFIG)).toEqual([]);
  });
});
