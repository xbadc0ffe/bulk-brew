// A synthetic pack and pool big enough to build 60, 40, and 20-card white
// decks, with enough tagged cards for the tokens theme, removal, card draw,
// mana dorks, nonbasic lands, and basics. Generated in code so tests never
// read data/.

import type { CardRecord, DataPack, Pool, PoolEntry, Settings } from '../src/types.ts';
import { CONFIG, HAND_CONFIG } from './config.test.ts';

export const SETTINGS: Settings = {
  maxCopies: { 100: 1, 60: 4, 40: 4, 20: 2 },
  unlimitedBasics: true,
  includeUnsets: false,
  showArt: false,
};

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Human',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: `print-${partial.id}`,
    ...partial,
  };
}

const cards: CardRecord[] = [];

// Creatures at every mana value, some with theme tags, some evasive, some big.
for (let mv = 1; mv <= 6; mv++) {
  for (let i = 0; i < 6; i++) {
    const id = `w-creature-${mv}-${i}`;
    const tags: string[] = [];
    if (i % 3 === 0) tags.push('repeatable-creature-tokens');
    if (i % 3 === 1 && mv >= 3) tags.push('anthem', 'power-boost-to-all');
    const keywords = i % 2 === 0 && mv >= 2 ? ['Flying'] : [];
    cards.push(
      card({
        id,
        name: `White Creature ${mv}-${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        power: String(mv >= 4 ? mv : Math.max(1, mv - 1)),
        toughness: String(mv),
        keywords,
        tags,
      }),
    );
  }
}

// Removal, card advantage, tricks, and ramp.
for (let i = 0; i < 6; i++) {
  cards.push(
    card({
      id: `w-removal-${i}`,
      name: `White Removal ${i}`,
      mv: i < 3 ? 2 : 4,
      typeLine: 'Instant',
      types: ['instant'],
      tags: ['removal-creature', 'spot-removal', 'removal'],
    }),
  );
  cards.push(
    card({
      id: `w-draw-${i}`,
      name: `White Draw ${i}`,
      mv: 3,
      typeLine: 'Sorcery',
      types: ['sorcery'],
      tags: ['pure-draw', 'draw'],
    }),
  );
  cards.push(
    card({
      id: `w-trick-${i}`,
      name: `White Trick ${i}`,
      mv: 1,
      typeLine: 'Instant',
      types: ['instant'],
      tags: ['combat-trick'],
    }),
  );
}
for (let i = 0; i < 3; i++) {
  cards.push(
    card({
      id: `w-dork-${i}`,
      name: `White Dork ${i}`,
      mv: 1,
      power: '1',
      toughness: '1',
      tags: ['mana-dork', 'mana-producer', 'ramp'],
      produces: ['W'],
    }),
  );
}

// Lands.
cards.push(
  card({
    id: 'plains',
    name: 'Plains',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    colors: [],
    types: ['land'],
    produces: ['W'],
  }),
  card({
    id: 'w-utility-land',
    name: 'Sunlit Tower',
    mv: 0,
    typeLine: 'Land',
    colors: [],
    identity: [],
    types: ['land'],
    produces: ['C'],
    tags: ['utility-land'],
  }),
  card({
    id: 'w-tapland',
    name: 'Slow Meadow',
    mv: 0,
    typeLine: 'Land',
    colors: [],
    types: ['land'],
    produces: ['W'],
    entersTapped: true,
  }),
  card({
    id: 'w-good-land',
    name: 'Bright Meadow',
    mv: 0,
    typeLine: 'Land',
    colors: [],
    types: ['land'],
    produces: ['W'],
    tags: ['utility-land'],
  }),
);

// Off-color and un-set cards that must never be chosen in a white deck.
cards.push(
  card({ id: 'u-creature', name: 'Blue Creature', colors: ['U'], identity: ['U'] }),
  card({ id: 'wu-creature', name: 'Gold Creature', colors: ['W', 'U'], identity: ['W', 'U'] }),
  card({ id: 'w-unset', name: 'Silly Creature', unset: true }),
  card({
    id: 'c-artifact',
    name: 'Colorless Rock',
    mv: 2,
    typeLine: 'Artifact',
    colors: [],
    identity: [],
    types: ['artifact'],
    tags: ['mana-rock', 'mana-producer', 'ramp'],
    produces: ['C'],
  }),
);

export const PACK: DataPack = {
  schema: 1,
  version: '2026-01-01',
  builtAt: '2026-01-01T00:00:00Z',
  cardCount: cards.length,
  cards,
};

export const CONFIG_BUNDLE = CONFIG;
export { HAND_CONFIG };

/** A pool with several copies of everything, like a real bulk pile. */
export function bigPool(copies = 4): Pool {
  const entries: Record<string, PoolEntry> = {};
  for (const c of cards) entries[c.id] = { cardId: c.id, qty: c.id === 'plains' ? 30 : copies };
  return { entries, updatedAt: '2026-01-01T00:00:00Z' };
}

/** Only creatures (and no lands), enough copies for a 60-card deck. */
export function creaturePool(): Pool {
  const entries: Record<string, PoolEntry> = {};
  for (const c of cards) {
    if (!c.types.includes('creature') || c.identity.some((x) => x !== 'W') || c.unset) continue;
    entries[c.id] = { cardId: c.id, qty: 4 };
  }
  return { entries, updatedAt: '2026-01-01T00:00:00Z' };
}

/** A pool too thin for a 60-card deck. */
export function thinPool(): Pool {
  const entries: Record<string, PoolEntry> = {};
  for (const c of cards.slice(0, 8)) entries[c.id] = { cardId: c.id, qty: 1 };
  return { entries, updatedAt: '2026-01-01T00:00:00Z' };
}
