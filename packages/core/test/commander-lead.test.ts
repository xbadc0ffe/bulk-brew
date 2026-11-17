// A commander's lead and its own job (builder phase 2, step 5): the lead follows the share of
// its text that does a theme's work, and the job it does counts as the scan counts it, the
// finished deck feeding its needs. Real commanders from the pack; the pools around them are
// made-up cards that only fill the 99.

import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/builder.ts';
import { commanderTextShare } from '../src/grow.ts';
import { creatureTypes } from '../src/matchers.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import type { CardRecord, Color, DataPack, Pool } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { SETTINGS } from './builder-fixtures.ts';
import { MORE_CARDS, TRIBE_CARDS } from './tribe-cards.ts';

const real = (name: string) => [...TRIBE_CARDS, ...MORE_CARDS].find((c) => c.name === name)!;
const ADELIZ = real('Adeliz, the Cinder Wind');
const KUJA = real('Kuja, Genome Sorcerer // Trance Kuja, Fate Defied');

/** A made-up card of one color. */
function made(id: string, color: Color, mv: number, more: Partial<CardRecord> = {}): CardRecord {
  return {
    id,
    name: id,
    layout: 'normal',
    mv,
    manaCost: `{${Math.max(0, mv - 1)}}{${color}}`,
    typeLine: 'Creature — Horror',
    text: '',
    colors: [color],
    identity: [color],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: id,
    power: String(mv + 1),
    toughness: String(mv + 1),
    ...more,
  };
}

function basic(name: string, color: Color): CardRecord {
  return made(name, color, 0, {
    manaCost: '',
    typeLine: `Basic Land — ${name}`,
    types: ['land'],
    colors: [],
    produces: [color],
  });
}

/** Strong vanilla creatures and some removal and draw in two colors, to fill the 99. */
function filler(colors: readonly [Color, Color], perSlot = 3): CardRecord[] {
  const out: CardRecord[] = [];
  for (const color of colors)
    for (let mv = 1; mv <= 6; mv++)
      for (let i = 0; i < perSlot; i++) out.push(made(`${color}-filler-${mv}-${i}`, color, mv));
  for (let i = 0; i < 6; i++) {
    const spell = { typeLine: 'Sorcery', types: ['sorcery' as const] };
    out.push(
      made(`removal-${i}`, colors[0], 2, { ...spell, tags: ['removal-creature', 'removal'] }),
      made(`draw-${i}`, colors[1], 3, { ...spell, tags: ['pure-draw', 'draw'] }),
    );
  }
  return out;
}

function fixture(lead: CardRecord, cards: CardRecord[], basics: CardRecord[]) {
  const all = [lead, ...cards, ...basics];
  const pack: DataPack = {
    schema: 2,
    version: 't',
    builtAt: 't',
    cardCount: all.length,
    cards: all,
  };
  const pool: Pool = {
    entries: Object.fromEntries([lead, ...cards].map((c) => [c.id, { cardId: c.id, qty: 1 }])),
    updatedAt: 't',
  };
  return { index: new CardIndex(pack), pool };
}

describe("a commander's lead", () => {
  it('is the share of its text that does the theme its work', () => {
    const lathril = real('Lathril, Blade of the Elves');
    // Elf tokens and tapping Elves: all of its text.
    expect(commanderTextShare(CONFIG, lathril, 'tribal:Elf', 100)).toBe(1);
    // Its own combat damage trigger, an Evasion payoff: one of its two text abilities.
    expect(commanderTextShare(CONFIG, lathril, 'flyers', 100)).toBe(0.5);
    // Lifelink is a keyword: no line of Danitha's text gains life.
    expect(commanderTextShare(CONFIG, real('Danitha Capashen, Paragon'), 'lifegain', 100)).toBe(0);
  });

  it('leads a tribe in full when its whole text is the tribe, whatever else that text needs', () => {
    // Adeliz's Wizards grow when you cast instants and sorceries: a tribe job that needs more
    // than the type, so it does not count toward the pool's floors, yet all its text is Wizards.
    expect(commanderTextShare(CONFIG, ADELIZ, 'tribal:Wizard', 100)).toBe(1);
    const wizard = (i: number, color: Color, more: Partial<CardRecord> = {}) =>
      made(`wizard-${i}`, color, 1 + (i % 5), { typeLine: 'Creature — Human Wizard', ...more });
    const cards = [
      ...Array.from({ length: 30 }, (_, i) => wizard(i, i % 2 ? 'U' : 'R')),
      ...Array.from({ length: 12 }, (_, i) =>
        wizard(100 + i, i % 2 ? 'U' : 'R', {
          tags: ['typal-wizard'],
          text: 'Other Wizards you control get +1/+1.',
        }),
      ),
      ...Array.from({ length: 12 }, (_, i) =>
        made(`bolt-${i}`, 'R', 1, {
          typeLine: 'Instant',
          types: ['instant'],
          tags: ['removal-creature', 'removal'],
        }),
      ),
      ...filler(['U', 'R']),
    ];
    const { index, pool } = fixture(ADELIZ, cards, [basic('Island', 'U'), basic('Mountain', 'R')]);
    const tribe = scanPool(pool, index, CONFIG, SETTINGS, 100, ['U', 'R'], ADELIZ).leadTribes!;
    expect(tribe.map((t) => [t.style, t.rules.viable])).toEqual([['tribal:Wizard', true]]);
    const built = buildDeck(
      { size: 100, colors: [], commander: ADELIZ.id, settings: SETTINGS, style: 'tribal:Wizard' },
      pool,
      index,
      CONFIG,
    );
    expect(built.deck.archetype).toBe('tribal:Wizard');
    expect(built.explanation.pick?.lead).toBe(CONFIG.builderWeights.grow.commanderPlan);
  });
});

describe("a commander's own job", () => {
  it('counts as the scan counts it, the finished deck feeding all the copies its need asks', () => {
    // Tokens' second floor set (18 setup, 8 payoff) is met only with Kuja's own token engine,
    // which needs four or more Wizards: 14 at 100. The Wizards are weak 0/1s the fill passes over.
    const burst = (i: number) =>
      made(`burst-${i}`, i % 2 ? 'B' : 'R', 3, {
        typeLine: 'Sorcery',
        types: ['sorcery'],
        text: 'Create two 1/1 black Rat creature tokens.',
      });
    const anthem = (i: number) =>
      made(`anthem-${i}`, i % 2 ? 'B' : 'R', 3, {
        typeLine: 'Enchantment',
        types: ['enchantment'],
        tags: ['anthem'],
        text: 'Other creatures you control get +1/+1.',
      });
    const wizard = (i: number) =>
      made(`wizard-${i}`, 'B', 4, {
        typeLine: 'Creature — Human Wizard',
        power: '0',
        toughness: '1',
      });
    const cards = [
      ...Array.from({ length: 17 }, (_, i) => burst(i)),
      ...Array.from({ length: 9 }, (_, i) => anthem(i)),
      ...Array.from({ length: 20 }, (_, i) => wizard(i)),
      ...filler(['B', 'R'], 6),
    ];
    const { index, pool } = fixture(KUJA, cards, [basic('Swamp', 'B'), basic('Mountain', 'R')]);
    const scan = scanPool(pool, index, CONFIG, SETTINGS, 100, ['B', 'R'], KUJA);
    const tokens = scan.archetypes.find((a) => a.archetype === 'tokens')!.rules!;
    expect(tokens.viable).toBe(true);
    expect(tokens.floors).toEqual([
      { floor: 'setup', have: 18, need: 18 },
      { floor: 'payoff', have: 9, need: 8 },
    ]);
    const built = buildDeck(
      {
        size: 100,
        colors: [],
        commander: KUJA.id,
        settings: SETTINGS,
        style: 'tokens',
        requireStyle: true,
      },
      pool,
      index,
      CONFIG,
    );
    expect(built.explanation.nearest).toBeUndefined();
    expect(built.deck.archetype).toBe('tokens');
    const wizards = built.deck.cards.filter(
      (dc) => dc.cardId !== KUJA.id && creatureTypes(index.get(dc.cardId)!).includes('Wizard'),
    );
    expect(wizards.length).toBeGreaterThanOrEqual(13);
  });
});
