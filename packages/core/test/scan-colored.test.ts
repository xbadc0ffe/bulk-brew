import { describe, expect, it } from 'vitest';
import { listCandidates } from '../src/candidates.ts';
import { templateFor } from '../src/config.ts';
import { CardIndex } from '../src/pack.ts';
import { addToPool, emptyPool } from '../src/pool.ts';
import { MIN_COLORED_SHARE, scanPool } from '../src/scan.ts';
import type { CardRecord, DataPack } from '../src/types.ts';
import { CONFIG_BUNDLE as CONFIG, SETTINGS } from './builder-fixtures.ts';

function artifact(i: number): CardRecord {
  return {
    id: `rock-${i}`,
    name: `Trinket ${i}`,
    layout: 'normal',
    manaCost: '{2}',
    mv: 2,
    typeLine: 'Artifact',
    text: '',
    colors: [],
    identity: [],
    keywords: [],
    types: ['artifact'],
    tags: [],
    img: 'x',
  };
}

function blueCreature(i: number): CardRecord {
  return {
    ...artifact(100 + i),
    id: `fish-${i}`,
    name: `Fish ${i}`,
    manaCost: '{1}{U}',
    typeLine: 'Creature — Fish',
    colors: ['U'],
    identity: ['U'],
    types: ['creature'],
    power: '2',
    toughness: '2',
  };
}

const eldrazi: CardRecord = {
  ...artifact(999),
  id: 'eldrazi',
  name: 'Needy Eldrazi',
  manaCost: '{2}{C}{C}',
  mv: 4,
  typeLine: 'Creature — Eldrazi',
  types: ['creature'],
  power: '4',
  toughness: '4',
};

const modalColorless: CardRecord = {
  ...artifact(998),
  id: 'modal-c',
  name: 'Odd Relic // Odd Field',
  layout: 'modal_dfc',
  manaCost: '{3}',
  faces: [
    { name: 'Odd Relic', manaCost: '{3}', typeLine: 'Artifact', colors: [] },
    { name: 'Odd Field', manaCost: '{C}', typeLine: 'Artifact', colors: [] },
  ],
};

const cards = [
  ...Array.from({ length: 16 }, (_, i) => artifact(i)),
  ...Array.from({ length: 8 }, (_, i) => blueCreature(i)),
  eldrazi,
  modalColorless,
];
const pack: DataPack = {
  schema: 1,
  version: 't',
  builtAt: 't',
  cardCount: cards.length,
  cards,
};
const index = new CardIndex(pack);

function poolOf(ids: string[]) {
  return addToPool(
    emptyPool('t'),
    ids.map((cardId) => ({ cardId, qty: 1 })),
    't',
  );
}

const artifactIds = Array.from({ length: 16 }, (_, i) => `rock-${i}`);
const fishIds = (n: number) => Array.from({ length: n }, (_, i) => `fish-${i}`);

describe('cards with a {C} pip', () => {
  it('are never candidates, on the front or on any face', () => {
    const cands = listCandidates(
      poolOf(['eldrazi', 'modal-c', 'rock-0']),
      index,
      CONFIG,
      SETTINGS,
      'U',
      20,
    );
    expect(cands.map((c) => c.facts.card.id)).toEqual(['rock-0']);
  });
});

describe('scan requires cards of the deck color', () => {
  it('rejects a pile of colorless artifacts as a deck of any color', () => {
    const scan = scanPool(poolOf(artifactIds), index, CONFIG, SETTINGS, 20, 'W');
    expect(scan.candidates).toBe(16);
    expect(scan.colored).toBe(0);
    expect(scan.possible).toBe(false);
    expect(scan.notes.some((n) => n.includes('more White cards'))).toBe(true);
  });

  it('flips exactly at the colored threshold', () => {
    const slots = 20 - templateFor(CONFIG, 20).baseLands;
    const needed = Math.ceil(slots * MIN_COLORED_SHARE);
    const below = scanPool(
      poolOf([...artifactIds, ...fishIds(needed - 1)]),
      index,
      CONFIG,
      SETTINGS,
      20,
      'U',
    );
    expect(below.colored).toBe(needed - 1);
    expect(below.possible).toBe(false);
    expect(below.notes.some((n) => n.includes('needs 1 more Blue card '))).toBe(true);
    const at = scanPool(
      poolOf([...artifactIds, ...fishIds(needed)]),
      index,
      CONFIG,
      SETTINGS,
      20,
      'U',
    );
    expect(at.colored).toBe(needed);
    expect(at.possible).toBe(true);
  });
});
