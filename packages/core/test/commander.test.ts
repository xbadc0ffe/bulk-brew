import { describe, expect, it } from 'vitest';
import { BuildError, buildClassic, buildDeck, styleCounts } from '../src/builder.ts';
import { planOptions } from '../src/options.ts';
import {
  commanderCanBuild,
  commanderCandidates,
  commanderSuits,
  filterCommanders,
  type CommanderCandidate,
} from '../src/commander.ts';
import { deckToDecklist } from '../src/export.ts';
import { canBeCommander, commanderCopies } from '../src/matchers.ts';
import { CardIndex } from '../src/pack.ts';
import type { CardRecord, Color, DataPack, Pool, ScanReport } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { SETTINGS } from './builder-fixtures.ts';

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{W}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['W'],
    identity: ['W'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

describe('canBeCommander and commanderCopies', () => {
  it('follows the deck-building rules for commanders', () => {
    expect(canBeCommander(card({ id: 'a', name: 'A', typeLine: 'Legendary Creature — Elf' }))).toBe(
      true,
    );
    expect(canBeCommander(card({ id: 'b', name: 'B', typeLine: 'Creature — Elf' }))).toBe(false);
    expect(
      canBeCommander(
        card({ id: 'v', name: 'V', typeLine: 'Legendary Artifact — Vehicle', types: ['artifact'] }),
      ),
    ).toBe(true);
    expect(
      canBeCommander(
        card({
          id: 'p',
          name: 'P',
          typeLine: 'Legendary Planeswalker — Teyo',
          types: ['planeswalker'],
          text: 'Teyo can be your commander.',
        }),
      ),
    ).toBe(true);
    expect(
      canBeCommander(
        card({
          id: 'x',
          name: 'X',
          typeLine: 'Legendary Creature — Elf',
          commanderLegality: 'banned',
        }),
      ),
    ).toBe(false);
  });

  it('accepts a card that is a creature everywhere but the battlefield', () => {
    expect(
      canBeCommander(
        card({
          id: 'g',
          name: 'G',
          typeLine: 'Legendary Planeswalker — Grist',
          types: ['planeswalker'],
          text: "As long as G isn't on the battlefield, it's a 1/1 Insect creature in addition to its other types.",
        }),
      ),
    ).toBe(true);
  });

  it('allows extra copies only where the card says so', () => {
    expect(commanderCopies(card({ id: 'a', name: 'A' }))).toBe(1);
    expect(
      commanderCopies(
        card({ id: 'r', name: 'R', text: 'A deck can have any number of cards named R.' }),
      ),
    ).toBe(Infinity);
    expect(
      commanderCopies(
        card({ id: 's', name: 'S', text: 'A deck can have up to seven cards named S.' }),
      ),
    ).toBe(7);
  });
});

describe('Commander builds', () => {
  const cards: CardRecord[] = [];
  for (let i = 0; i < 90; i++) {
    const mv = (i % 6) + 1;
    cards.push(
      card({
        id: `w-${i}`,
        name: `White ${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        power: String(mv),
        toughness: String(mv),
        tags:
          i % 9 === 0
            ? ['removal-creature', 'removal']
            : i % 9 === 1
              ? ['draw-engine']
              : i % 9 === 2
                ? ['mana-rock']
                : [],
        types: i % 9 === 2 ? ['artifact'] : ['creature'],
        typeLine: i % 9 === 2 ? 'Artifact' : 'Creature — Human',
      }),
    );
  }
  const lead = card({
    id: 'lead',
    name: 'Lead, the Bright',
    typeLine: 'Legendary Creature — Human',
    mv: 3,
    manaCost: '{2}{W}',
  });
  const blue = card({
    id: 'blue',
    name: 'Blue One',
    colors: ['U'],
    identity: ['U'],
    manaCost: '{1}{U}',
  });
  const plains = card({
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    identity: ['W'],
    produces: ['W'],
  });
  const banned = card({
    id: 'banned',
    name: 'Banned One',
    commanderLegality: 'banned',
    tags: ['removal-creature', 'removal'],
  });
  const all = [...cards, lead, blue, plains, banned];
  const pack: DataPack = {
    schema: 2,
    version: 't',
    builtAt: 't',
    cardCount: all.length,
    cards: all,
  };
  const index = new CardIndex(pack);
  const pool: Pool = {
    entries: Object.fromEntries(
      [...cards, lead, blue, banned].map((c) => [c.id, { cardId: c.id, qty: 3 }]),
    ),
    updatedAt: 't',
  };
  const request = { size: 100 as const, colors: [], settings: SETTINGS, id: 't', createdAt: 't' };

  it('lists the commanders in the pool', () => {
    const list = commanderCandidates(pool, index, CONFIG, SETTINGS);
    expect(list.map((c) => c.id)).toEqual(['lead']);
    expect(list[0]!.colors).toEqual(['W']);
  });

  it('builds 100 cards, one copy each, in the commander colors, commander first', () => {
    const r = buildDeck({ ...request, commander: 'lead' }, pool, index, CONFIG);
    const total =
      r.deck.cards.reduce((n, c) => n + c.qty, 0) +
      Object.values(r.deck.basics).reduce((n, q) => n + (q ?? 0), 0);
    expect(total).toBe(100);
    expect(r.deck.commander).toBe('lead');
    expect(r.deck.cards[0]).toMatchObject({ cardId: 'lead', qty: 1, why: 'Commander' });
    expect(r.deck.cards.every((c) => c.qty === 1)).toBe(true);
    expect(r.deck.cards.some((c) => c.cardId === 'blue')).toBe(false);
    expect(r.deck.cards.some((c) => c.cardId === 'banned')).toBe(false);
    expect(r.deck.name.startsWith('Lead ')).toBe(true);
    expect(deckToDecklist(r.deck, index, CONFIG)).toMatch(
      /\/\/ Commander \(1\)\n1 Lead, the Bright/,
    );
  });

  it('leaves out commanders of an unchecked rarity', () => {
    const mythicLead = { ...lead, rarity: 'mythic' as const };
    const idx = new CardIndex({ ...pack, cards: [...cards, mythicLead, blue, plains, banned] });
    const commons = { ...SETTINGS, rarities: ['common' as const, 'uncommon' as const] };
    expect(commanderCandidates(pool, idx, CONFIG, commons)).toEqual([]);
    expect(() =>
      buildDeck({ ...request, commander: 'lead', settings: commons }, pool, idx, CONFIG),
    ).toThrow(/rarity left out/);
  });

  it('explains what is missing in plain words', () => {
    expect(() => buildDeck(request, pool, index, CONFIG)).toThrow(BuildError);
    expect(() => buildDeck({ ...request, commander: 'w-3' }, pool, index, CONFIG)).toThrow(
      /cannot be a commander/,
    );
  });

  it('fills the scans of each commander color set while listing', () => {
    const scans = new Map<string, ScanReport>();
    commanderCandidates(pool, index, CONFIG, SETTINGS, scans);
    expect([...scans.keys()]).toEqual(['W']);
    expect(scans.get('W')!.size).toBe(100);
  });

  it('answers a style the pool cannot build with a note, or refuses it on the classic path', () => {
    const loose = buildDeck(
      { ...request, commander: 'lead', style: 'tokens' },
      pool,
      index,
      CONFIG,
    );
    expect(loose.deck.archetype).not.toBe('tokens');
    // Asked for by the player: the nearest deck the pool can build, labelled for what it is.
    const asked = buildDeck(
      { ...request, commander: 'lead', style: 'tokens', requireStyle: true },
      pool,
      index,
      CONFIG,
    );
    expect(asked.deck.archetype).not.toBe('tokens');
    expect(asked.explanation.nearest?.requested).toBe('tokens');
    expect(asked.explanation.notes[0]).toMatch(/^Asked for Tokens: your bulk list has /);
    expect(() =>
      buildClassic(
        { ...request, commander: 'lead', style: 'tokens', requireStyle: true },
        pool,
        index,
        CONFIG,
      ),
    ).toThrow(/Not enough cards to build Tokens under Lead/);
  });

  it('checks whether a commander can build a style', () => {
    // Nothing is viable here: a requested Midrange deck is only built as a last resort.
    const midrange = buildDeck(
      { ...request, commander: 'lead', style: 'midrange' },
      pool,
      index,
      CONFIG,
    );
    expect(midrange.deck.archetype).toBe('midrange');
    expect(commanderCanBuild('lead', 'midrange', pool, index, CONFIG, SETTINGS)).toBe(false);

    // Token makers and anthems make Tokens viable, and a commander with an anthem leads it.
    const themed = cards.map((c, i) =>
      i % 9 === 3 || i % 9 === 4
        ? { ...c, tags: ['multiple-bodies'] }
        : i % 9 === 5
          ? { ...c, tags: ['anthem'] }
          : c,
    );
    const anthemLead = { ...lead, tags: ['anthem'] };
    const tIndex = new CardIndex({ ...pack, cards: [...themed, anthemLead, plains] });
    const listed = commanderCandidates(pool, tIndex, CONFIG, SETTINGS);
    expect(listed[0]!.supports).toContain('tokens');
    expect(commanderCanBuild('lead', 'tokens', pool, tIndex, CONFIG, SETTINGS)).toBe(true);
    expect(commanderCanBuild('lead', 'counters', pool, tIndex, CONFIG, SETTINGS)).toBe(false);
  });

  it('builds a tribe its commander names as the primary style', () => {
    // Every white creature is a Human; ten of them reward Humans.
    const tribal = cards.map((c, i) => (i % 9 === 6 ? { ...c, tags: ['typal-human'] } : c));
    const humanLead = { ...lead, tags: ['typal-human'] };
    const hIndex = new CardIndex({ ...pack, cards: [...tribal, humanLead, blue, plains, banned] });
    const best = buildDeck({ ...request, commander: 'lead' }, pool, hIndex, CONFIG);
    expect(best.deck.archetype).toBe('tribal:Human');
    expect(best.deck.name).toBe('Lead Human tribe 100');
    const [counts] = styleCounts(best.deck, hIndex, CONFIG);
    expect(counts).toMatchObject({ id: 'tribal:Human', label: 'Human tribe', tribal: true });
    expect(counts!.enablers.have).toBeGreaterThanOrEqual(counts!.enablers.want);
    expect(counts!.payoffs.have).toBeGreaterThanOrEqual(counts!.payoffs.want);

    const [listed] = commanderCandidates(pool, hIndex, CONFIG, SETTINGS);
    expect(listed!.primaryTribes).toEqual(['tribal:Human']);
    expect(commanderSuits(listed!, 'tribal:Human', CONFIG)).toBe(true);
    expect(commanderCanBuild('lead', 'tribal:Human', pool, hIndex, CONFIG, SETTINGS)).toBe(true);
    const { plans } = planOptions({ ...request, commander: 'lead' }, pool, hIndex, CONFIG);
    expect(plans[0]!.style).toBe('tribal:Human');

    // A tribe the commander does not name cannot lead, and the plain lead names none.
    expect(() =>
      buildDeck(
        { ...request, commander: 'lead', style: 'tribal:Elf', requireStyle: true },
        pool,
        hIndex,
        CONFIG,
      ),
    ).toThrow(/does not reward the Elf tribe/);
    const plainIndex = new CardIndex({ ...pack, cards: [...tribal, lead, blue, plains, banned] });
    expect(
      buildDeck({ ...request, commander: 'lead' }, pool, plainIndex, CONFIG).deck.archetype,
    ).not.toBe('tribal:Human');
  });
});

describe('filterCommanders', () => {
  const lead = (id: string, colors: Color[], supports: string[] = []): CommanderCandidate => ({
    id,
    name: id,
    colors,
    tier: 'good',
    score: 1,
    styles: [],
    leads: [],
    supports,
    primaryTribes: [],
    reasons: [],
    depth: 100,
    enough: true,
    mv: 3,
    fixers: 0,
    fixed: true,
  });
  const list = [
    lead('w', ['W'], ['tokens']),
    lead('u', ['U']),
    lead('wu', ['W', 'U'], ['tokens']),
    lead('wub', ['W', 'U', 'B']),
    lead('g', ['G'], ['counters']),
  ];
  const ids = (l: CommanderCandidate[]) => l.map((c) => c.id);

  it('keeps every commander when nothing is picked', () => {
    expect(ids(filterCommanders(list, [], undefined, CONFIG))).toEqual(ids(list));
  });

  it('keeps commanders whose colors fit inside the picked ones, every picked color first', () => {
    expect(ids(filterCommanders(list, ['W'], undefined, CONFIG))).toEqual(['w']);
    expect(ids(filterCommanders(list, ['W', 'U'], undefined, CONFIG))).toEqual(['wu', 'w', 'u']);
    expect(ids(filterCommanders(list, ['W', 'U', 'B'], undefined, CONFIG))).toEqual([
      'wub',
      'w',
      'u',
      'wu',
    ]);
  });

  it('keeps the commanders that lead a synergy style, and all of them for a plain shape', () => {
    expect(ids(filterCommanders(list, [], 'tokens', CONFIG))).toEqual(['w', 'wu']);
    expect(ids(filterCommanders(list, ['W'], 'tokens', CONFIG))).toEqual(['w']);
    expect(ids(filterCommanders(list, [], 'midrange', CONFIG))).toEqual(ids(list));
    expect(commanderSuits(list[4]!, 'counters', CONFIG)).toBe(true);
    expect(commanderSuits(list[4]!, 'tokens', CONFIG)).toBe(false);
    expect(commanderSuits(list[4]!, 'no-such-style', CONFIG)).toBe(false);
  });
});
