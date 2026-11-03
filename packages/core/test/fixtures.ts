import type { CardRecord, DataPack } from '../src/types.ts';

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 1,
    typeLine: 'Instant',
    text: '',
    colors: ['R'],
    identity: ['R'],
    keywords: [],
    types: ['instant'],
    tags: [],
    img: `print-${partial.id}`,
    ...partial,
  };
}

export const CARDS: CardRecord[] = [
  card({ id: 'bolt', name: 'Lightning Bolt', manaCost: '{R}', tags: ['burn', 'removal'] }),
  card({
    id: 'fireice',
    name: 'Fire // Ice',
    layout: 'split',
    manaCost: '{1}{R}',
    mv: 4,
    typeLine: 'Instant // Instant',
    colors: ['R', 'U'],
    identity: ['R', 'U'],
    faces: [
      { name: 'Fire', manaCost: '{1}{R}', typeLine: 'Instant', colors: ['R'] },
      { name: 'Ice', manaCost: '{1}{U}', typeLine: 'Instant', colors: ['U'] },
    ],
  }),
  card({
    id: 'delver',
    name: 'Delver of Secrets // Insectile Aberration',
    layout: 'transform',
    manaCost: '{U}',
    typeLine: 'Creature — Human Wizard // Creature — Human Insect',
    colors: ['U'],
    identity: ['U'],
    types: ['creature'],
    faces: [
      {
        name: 'Delver of Secrets',
        manaCost: '{U}',
        typeLine: 'Creature — Human Wizard',
        colors: ['U'],
      },
      { name: 'Insectile Aberration', typeLine: 'Creature — Human Insect', colors: ['U'] },
    ],
  }),
  card({ id: 'silly', name: 'Plot Armor', unset: true, colors: ['G'], identity: ['G'] }),
  card({ id: 'dup-unset', name: 'Twin Name', unset: true }),
  card({ id: 'dup-real', name: 'Twin Name' }),
  card({
    id: 'forest',
    name: 'Forest',
    mv: 0,
    typeLine: 'Basic Land — Forest',
    colors: [],
    identity: ['G'],
    types: ['land'],
    produces: ['G'],
  }),
];

export const PACK: DataPack = {
  schema: 1,
  version: '2026-01-01',
  builtAt: '2026-01-01T00:00:00Z',
  cardCount: CARDS.length,
  cards: CARDS,
};
