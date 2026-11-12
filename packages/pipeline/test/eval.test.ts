import { describe, expect, it } from 'vitest';
import {
  CardIndex,
  type BulkBrewConfig,
  type CardRecord,
  type DataPack,
  type Deck,
  type Settings,
} from '@bulk-brew/core';
import deckTemplates from '../../../config/deck-templates.json';
import curveProfiles from '../../../config/curve-profiles.json';
import roles from '../../../config/roles.json';
import archetypes from '../../../config/archetypes.json';
import synergyRules from '../../../config/synergy-rules.json';
import landRules from '../../../config/land-rules.json';
import builderWeights from '../../../config/builder-weights.json';
import cardStrength from '../../../config/card-strength.json';
import themeRules from '../../../config/theme-rules.json';
import settingsDefaults from '../../../config/settings.defaults.json';
import { castableIn, deckMetrics } from '../src/metrics.ts';

const CONFIG = {
  deckTemplates,
  curveProfiles,
  roles,
  archetypes,
  synergyRules,
  landRules,
  builderWeights,
  cardStrength,
  themeRules,
} as unknown as BulkBrewConfig;
const SETTINGS = settingsDefaults as unknown as Settings;

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{W}',
    ...partial,
  };
}

const CARDS: CardRecord[] = [
  card({ id: 'one', name: 'One Drop', mv: 1, manaCost: '{W}', power: '2', toughness: '1' }),
  card({ id: 'two', name: 'Two Drop', mv: 2, manaCost: '{1}{W}', power: '2', toughness: '2' }),
  card({ id: 'three', name: 'Three Drop', mv: 3, manaCost: '{2}{W}', power: '3', toughness: '3' }),
  card({
    id: 'bolt',
    name: 'Splash Bolt',
    mv: 1,
    manaCost: '{R}',
    types: ['instant'],
    typeLine: 'Instant',
    colors: ['R'],
    identity: ['R'],
    tags: ['removal-creature', 'spot-removal'],
  }),
  card({
    id: 'strike',
    name: 'Holy Strike',
    mv: 1,
    manaCost: '{W}',
    types: ['instant'],
    typeLine: 'Instant',
    tags: ['removal-creature', 'spot-removal'],
  }),
  card({
    id: 'shield',
    name: 'Quick Shield',
    mv: 1,
    manaCost: '{W}',
    types: ['instant'],
    typeLine: 'Instant',
    tags: ['combat-trick'],
  }),
  card({
    id: 'pacify',
    name: 'Pacify It',
    mv: 2,
    manaCost: '{1}{W}',
    types: ['enchantment'],
    typeLine: 'Enchantment — Aura',
    tags: ['removal-creature', 'spot-removal'],
  }),
  card({
    id: 'plains',
    name: 'Plains',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    produces: ['W'],
  }),
];

const PACK: DataPack = {
  schema: 1,
  version: 'test',
  builtAt: 'test',
  cardCount: CARDS.length,
  cards: CARDS,
};
const index = new CardIndex(PACK);

function deck(partial: Partial<Deck> & Pick<Deck, 'cards'>): Deck {
  return {
    id: 'd',
    name: 'test',
    size: 20,
    color: 'W',
    archetype: 'midrange',
    basics: { W: 8 },
    committed: false,
    createdAt: 'x',
    configVersion: 'x',
    dataVersion: 'x',
    ...partial,
  };
}

describe('castableIn', () => {
  it('accepts own color, generic, X, hybrid with a fitting side, and Phyrexian mana', () => {
    expect(castableIn(card({ id: 'a', name: 'a', manaCost: '{2}{W}{W}' }), 'W')).toBe(true);
    expect(castableIn(card({ id: 'b', name: 'b', manaCost: '{W/U}' }), 'U')).toBe(true);
    expect(castableIn(card({ id: 'c', name: 'c', manaCost: '{2/G}' }), 'W')).toBe(true);
    expect(castableIn(card({ id: 'd', name: 'd', manaCost: '{G/P}{G/P}' }), 'W')).toBe(true);
    expect(castableIn(card({ id: 'e', name: 'e', manaCost: '{X}{1}' }), 'W')).toBe(true);
  });

  it('rejects off-color pips, hybrid with no fitting side, and {C} pips', () => {
    expect(castableIn(card({ id: 'f', name: 'f', manaCost: '{1}{R}' }), 'W')).toBe(false);
    expect(castableIn(card({ id: 'g', name: 'g', manaCost: '{B/R}' }), 'W')).toBe(false);
    expect(castableIn(card({ id: 'h', name: 'h', manaCost: '{X}{C}' }), 'W')).toBe(false);
    expect(castableIn(card({ id: 'i', name: 'i', manaCost: '{2}{C}{C}' }), 'W')).toBe(false);
  });

  it('checks every face of split, adventure, and modal cards', () => {
    const split = card({
      id: 'split',
      name: 'Light // Fire',
      layout: 'split',
      manaCost: '{W}',
      faces: [
        { name: 'Light', manaCost: '{W}', typeLine: 'Instant', colors: ['W'] },
        { name: 'Fire', manaCost: '{1}{R}', typeLine: 'Instant', colors: ['R'] },
      ],
    });
    expect(castableIn(split, 'W')).toBe(false);

    const adventure = card({
      id: 'adv',
      name: 'Knight // Charge',
      layout: 'adventure',
      manaCost: '{2}{W}',
      faces: [
        { name: 'Knight', manaCost: '{2}{W}', typeLine: 'Creature', colors: ['W'] },
        { name: 'Charge', manaCost: '{W}', typeLine: 'Instant — Adventure', colors: ['W'] },
      ],
    });
    expect(castableIn(adventure, 'W')).toBe(true);

    const modalLand = card({
      id: 'mdfc',
      name: 'Cleric // Shrine',
      layout: 'modal_dfc',
      manaCost: '{3}{W}',
      faces: [
        { name: 'Cleric', manaCost: '{3}{W}', typeLine: 'Creature', colors: ['W'] },
        { name: 'Shrine', typeLine: 'Land', colors: [] },
      ],
    });
    expect(castableIn(modalLand, 'W')).toBe(true);

    const modalColorless = card({
      id: 'mdfc-c',
      name: 'Relic // Engine',
      layout: 'modal_dfc',
      manaCost: '{3}',
      faces: [
        { name: 'Relic', manaCost: '{3}', typeLine: 'Artifact', colors: [] },
        { name: 'Engine', manaCost: '{C}{C}', typeLine: 'Artifact', colors: [] },
      ],
    });
    expect(castableIn(modalColorless, 'W')).toBe(false);
  });
});

describe('deckMetrics', () => {
  const midrange = deck({
    cards: [
      { cardId: 'one', qty: 2, why: 'Early creature' },
      { cardId: 'two', qty: 4, why: 'Filler' },
      { cardId: 'three', qty: 3, why: 'Curve: 3-drop' },
      { cardId: 'bolt', qty: 1, why: 'Removal' },
      { cardId: 'pacify', qty: 2, why: 'Removal' },
    ],
  });
  const m = deckMetrics(midrange, index, CONFIG, SETTINGS);

  it('counts cards, lands, and spells and checks the invariants', () => {
    expect(m.total).toBe(20);
    expect(m.exactSize).toBe(true);
    expect(m.spells).toBe(12);
    expect(m.lands).toBe(8);
    expect(m.nonbasics).toBe(0);
    expect(m.landsInClamp).toBe(true);
    expect(m.copyLimitOk).toBe(false);
    expect(m.colorLegal).toBe(false);
  });

  it('reports off-color pips by name', () => {
    expect(m.castable).toBe(false);
    expect(m.offenders).toEqual(['Splash Bolt']);
  });

  it('computes the curve and its deviation from the jumpstart profile', () => {
    expect(m.curve).toEqual([0, 3, 6, 3, 0, 0, 0, 0]);
    // A 20-card packet always uses the jumpstart profile. Its shares over 12
    // spells round to 2, 4, 3, 2, 1, 0, 0 for mana values 1 through 7-plus.
    expect(m.curveTargets).toEqual([0, 2, 4, 3, 2, 1, 0, 0]);
    // Beyond the tolerance of 1: two-drops 6 vs 4 adds 1, four-drops 0 vs 2 adds 1.
    expect(m.curveDeviation).toBe(2);
    expect(m.averageMv).toBe(2);
  });

  it('measures roles, type mix, and filler', () => {
    expect(m.roles['removal']).toEqual({ have: 3, min: 1, target: 2 });
    expect(m.roles['earlyCreature']?.have).toBe(6);
    expect(m.rolesBelowMin).toBeGreaterThan(0);
    expect(m.creatureShare).toBe(0.75);
    // "Filler" counts, and so does a curve pick that fills no role (the three-drops).
    expect(m.filler).toBe(7);
  });

  it('uses the archetype overrides for role quotas and type mix bounds', () => {
    const cards = [
      { cardId: 'one', qty: 2, why: 'Early creature' },
      { cardId: 'two', qty: 2, why: 'Early creature' },
      { cardId: 'three', qty: 2, why: 'Finisher' },
      { cardId: 'strike', qty: 2, why: 'Removal' },
      { cardId: 'shield', qty: 2, why: 'Cheap interaction' },
      { cardId: 'pacify', qty: 2, why: 'Removal' },
    ];
    const asMidrange = deckMetrics(deck({ cards }), index, CONFIG, SETTINGS);
    const asAggro = deckMetrics(deck({ cards, archetype: 'aggro' }), index, CONFIG, SETTINGS);
    expect(asMidrange.creatureShare).toBe(0.5);
    // Template 20-card bounds allow 50% creatures; aggro raises the minimum to 60%.
    expect(asMidrange.typeMixOk).toBe(true);
    expect(asAggro.typeMixOk).toBe(false);
    expect(asMidrange.roles['earlyCreature']).toEqual({ have: 4, min: 2, target: 3 });
    expect(asAggro.roles['earlyCreature']).toEqual({ have: 4, min: 4, target: 5 });
    expect(asAggro.roles['cardAdvantage']).toEqual({ have: 0, min: 0, target: 0 });
    expect(asAggro.castable).toBe(true);
    expect(asAggro.colorLegal).toBe(true);
  });
});
