// The agreement check (builder phase 2, step 4): the scan, the Analyze pane's
// plan, the Build page's plan, and the builder name the same viable styles,
// and every deck shows the setup and payoff counts its builder counted.

import { describe, expect, it } from 'vitest';
import {
  checkAgreement,
  deckDisagreements,
  planDisagreements,
  type PlanInputs,
} from '../src/agreement.ts';
import { bestDeckPlans } from '../src/best-decks.ts';
import { cardNeeds } from '../src/card-needs.ts';
import { pickerPlans } from '../src/grow.ts';
import { planOptions } from '../src/options.ts';
import { buildDeck } from '../src/builder.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import type { BuildResult, CardRecord, Deck, Pool, ScanReport } from '../src/types.ts';
import {
  bigPool,
  CONFIG_BUNDLE as CONFIG,
  HAND_CONFIG,
  PACK,
  SETTINGS,
} from './builder-fixtures.ts';
import {
  AGREEMENT_CARDS,
  agreementCard,
  GOBLIN_POOL,
  RED_POOL,
  TOKENS_POOL,
  VOLTRON_POOL,
} from './agreement-cards.ts';

const index = new CardIndex(PACK);
const kinds = (deck: Deck) => deckDisagreements(deck, index, CONFIG).map((d) => d.kind);

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
    img: `print-${partial.id}`,
    ...partial,
  };
}

/**
 * A white Commander pool of 90 singletons, token makers, anthems, and Human
 * lords among them, led by a Human commander whose own anthem pays off Tokens
 * and who names the Human tribe.
 */
function commanderFixture(): { pool: Pool; idx: CardIndex } {
  const cards: CardRecord[] = [];
  for (let i = 0; i < 90; i++) {
    const mv = 1 + (i % 6);
    const kind = i % 9;
    cards.push(
      card({
        id: `c-${i}`,
        name: `Soldier ${i}`,
        mv,
        manaCost: `{${mv - 1}}{W}`,
        power: String(mv),
        toughness: String(mv),
        types: kind === 2 ? ['artifact'] : ['creature'],
        typeLine: kind === 2 ? 'Artifact' : 'Creature — Human',
        tags:
          kind === 0
            ? ['removal-creature', 'removal']
            : kind === 1
              ? ['draw-engine']
              : kind === 2
                ? ['mana-rock']
                : kind === 3 || kind === 4
                  ? ['repeatable-creature-tokens']
                  : kind === 5
                    ? ['anthem']
                    : kind === 6
                      ? ['typal-human']
                      : [],
        text:
          kind === 3 || kind === 4
            ? 'At the beginning of your upkeep, create a 1/1 white Soldier creature token.'
            : kind === 5
              ? 'Other creatures you control get +1/+1.'
              : kind === 6
                ? 'Other Humans you control get +1/+1.'
                : '',
      }),
    );
  }
  const lead = card({
    id: 'lead',
    name: 'Lead, the Banner',
    mv: 3,
    manaCost: '{2}{W}',
    typeLine: 'Legendary Creature — Human',
    text: 'Other creatures you control get +1/+1.\nHumans you control have vigilance.',
    power: '2',
    toughness: '2',
    tags: ['anthem', 'typal-human'],
  });
  const plains = card({
    id: 'plains',
    name: 'Plains',
    manaCost: '',
    mv: 0,
    typeLine: 'Basic Land — Plains',
    types: ['land'],
    colors: [],
    produces: ['W'],
  });
  const pool: Pool = {
    entries: Object.fromEntries([...cards, lead].map((c) => [c.id, { cardId: c.id, qty: 1 }])),
    updatedAt: 't',
  };
  return {
    pool,
    idx: new CardIndex({ ...PACK, cardCount: 92, cards: [...cards, lead, plains] }),
  };
}

describe('agreement between the scan, the plans, the builder, and the deck views', () => {
  it('agrees at 60 and 40 on the fixture pool', () => {
    for (const size of [60, 40] as const) {
      const r = checkAgreement({ size, colors: ['W'] }, bigPool(), index, CONFIG, SETTINGS);
      expect(r.issues).toEqual([]);
      expect(r.plans).toEqual(expect.arrayContaining(['midrange', 'aggro', 'control', 'tokens']));
      expect(r.unbuilt).toEqual([]);
      expect(r.decks).toBe(r.plans.length);
      expect(r.decks).toBeGreaterThan(3);
    }
  });

  it('agrees under a commander, the scan crediting it once as the builder does', () => {
    const { pool, idx } = commanderFixture();
    const scan = scanPool(pool, idx, CONFIG, SETTINGS, 100, ['W'], idx.get('lead'));
    const without = scanPool(pool, idx, CONFIG, SETTINGS, 100, ['W']);
    // Led, the commander is not one of the 99 the scan counts.
    expect(scan.candidates).toBe(without.candidates - 1);
    const r = checkAgreement(
      { size: 100, colors: [], commander: 'lead' },
      pool,
      idx,
      CONFIG,
      SETTINGS,
    );
    expect(r.issues).toEqual([]);
    expect(r.unbuilt).toEqual([]);
    expect(r.plans).toEqual(expect.arrayContaining(['tokens', 'midrange', 'tribal:Human']));
    expect(r.decks).toBeGreaterThan(1);
  });

  it('finds a deck whose bars, reasons, or key synergies differ from its builder', () => {
    const { deck } = buildDeck(
      {
        size: 60,
        colors: ['W'],
        style: 'tokens',
        requireStyle: true,
        settings: SETTINGS,
        id: 't',
        createdAt: 't',
      },
      bigPool(),
      index,
      CONFIG,
    );
    expect(kinds(deck)).toEqual([]);
    const e = deck.explanation!;
    expect(e.theme?.style).toBe('tokens');

    const recount = {
      ...deck,
      explanation: {
        ...e,
        theme: { ...e.theme!, floors: e.theme!.floors.map((f) => ({ ...f, have: f.have + 1 })) },
      },
    };
    expect(kinds(recount)).toContain('bars');

    const setup = deck.cards.find((c) => c.why?.startsWith('Setup: '))!;
    const relabelled = {
      ...deck,
      cards: deck.cards.map((c) => (c === setup ? { ...c, why: 'Setup: a job of its own' } : c)),
    };
    expect(kinds(relabelled)).toContain('reasons');

    const oldLines = {
      ...deck,
      explanation: { ...e, synergies: ['Tokens and anthems: 9 enablers, 4 payoffs'] },
    };
    expect(kinds(oldLines)).toContain('synergies');
  });

  it('leaves a classic deck to its own counts', () => {
    const { deck } = buildDeck(
      { size: 20, colors: ['W'], settings: SETTINGS, id: 't', createdAt: 't' },
      bigPool(),
      index,
      CONFIG,
    );
    expect(deck.explanation?.builder).toBe('classic');
    expect(kinds(deck)).toEqual([]);
  });
});

describe('learned plan data on grow paths', () => {
  // The same decks with or without the learned files: nothing the grow builder serves reads them.
  const cardsOf = (r: BuildResult) => ({
    archetype: r.deck.archetype,
    builder: r.explanation.builder,
    cards: r.deck.cards,
    basics: r.deck.basics,
  });

  it('builds best fit and every planned style alike without the learned files', () => {
    for (const size of [60, 40] as const) {
      const request = { size, colors: ['W' as const], settings: SETTINGS, id: 't', createdAt: 't' };
      const styles = ['', 'midrange', 'aggro', 'control', 'tokens'];
      for (const style of styles) {
        const req = style ? { ...request, style } : request;
        const a = buildDeck(req, bigPool(), index, CONFIG);
        const b = buildDeck(req, bigPool(), index, HAND_CONFIG);
        expect(cardsOf(a)).toEqual(cardsOf(b));
        expect(a.explanation.score).toBeUndefined();
      }
    }
  });

  it('builds a commander best fit and its tribe alike without them', () => {
    const { pool, idx } = commanderFixture();
    const req = { size: 100 as const, colors: [], commander: 'lead', settings: SETTINGS };
    expect(cardsOf(buildDeck(req, pool, idx, CONFIG))).toEqual(
      cardsOf(buildDeck(req, pool, idx, HAND_CONFIG)),
    );
    // The tribe is one of best fit's plans, and the grow builder builds it.
    const tribe = { ...req, style: 'tribal:Human' };
    const a = buildDeck(tribe, pool, idx, CONFIG);
    expect(a.deck.archetype).toBe('tribal:Human');
    expect(a.explanation.builder).toBe('grow');
    expect(cardsOf(a)).toEqual(cardsOf(buildDeck(tribe, pool, idx, HAND_CONFIG)));
    expect(a.deck.learnedVersion).toBeUndefined();
  });
});

describe('planDisagreements', () => {
  function inputs(): PlanInputs {
    const pool = bigPool();
    const request = { size: 60 as const, colors: ['W' as const], settings: SETTINGS };
    const builder = pickerPlans(request, pool, index, CONFIG);
    const scan = scanPool(pool, index, CONFIG, SETTINGS, 60, ['W']);
    const best = buildDeck({ ...request, id: 't', createdAt: 't' }, pool, index, CONFIG);
    return {
      builder,
      scan,
      analyze: bestDeckPlans(new Map([['W', scan]])).map((p) => p.style!),
      options: planOptions(request, pool, index, CONFIG).plans.map((p) => p.style),
      compared: best.explanation.pick!.ranked!.map((r) => r.style),
      unbuilt: [],
    };
  }
  const kindsOf = (i: PlanInputs) => planDisagreements(i).map((d) => d.kind);
  const withRules = (scan: ScanReport, style: string, over: object): ScanReport => ({
    ...scan,
    archetypes: scan.archetypes.map((a) =>
      a.archetype === style ? { ...a, rules: { ...a.rules!, ...over } } : a,
    ),
  });

  it('finds nothing when every surface plans what the builder plans', () => {
    const i = inputs();
    expect(i.builder.map((p) => p.style)).toContain('tokens');
    expect(planDisagreements(i)).toEqual([]);
  });

  it('finds each surface that plans otherwise', () => {
    const i = inputs();
    expect(kindsOf({ ...i, scan: withRules(i.scan, 'tokens', { viable: false }) })).toEqual([
      'scan',
    ]);
    expect(kindsOf({ ...i, scan: withRules(i.scan, 'midrange', { viable: false }) })).toEqual([
      'scan',
    ]);
    const tokens = i.scan.archetypes.find((a) => a.archetype === 'tokens')!.rules!;
    const floors = tokens.floors.map((f, n) => (n === 0 ? { ...f, have: f.have + 1 } : f));
    expect(kindsOf({ ...i, scan: withRules(i.scan, 'tokens', { floors }) })).toEqual([
      'pool-counts',
    ]);
    expect(kindsOf({ ...i, analyze: i.analyze!.filter((s) => s !== 'tokens') })).toEqual([
      'analyze',
    ]);
    expect(kindsOf({ ...i, options: [...i.options, 'graveyard'] })).toEqual(['options']);
    expect(kindsOf({ ...i, compared: i.compared!.filter((s) => s !== 'control') })).toEqual([
      'best-fit',
    ]);
    expect(kindsOf({ ...i, compared: [...i.compared!, 'graveyard'] })).toEqual(['best-fit']);
  });

  it('counts a planned style no deck could be built for', () => {
    const i = inputs();
    const compared = i.compared!.filter((s) => s !== 'tokens');
    expect(kindsOf({ ...i, compared, unbuilt: ['tokens'] })).toEqual(['unbuilt']);
  });
});

describe('a floor the scan counts, the builder reaches', () => {
  const s = { ...SETTINGS, unlimitedBasics: true };
  const idx = new CardIndex({
    ...PACK,
    cardCount: AGREEMENT_CARDS.length,
    cards: AGREEMENT_CARDS,
  });
  const poolOf = (qty: Record<string, number>): Pool => ({
    entries: Object.fromEntries(
      Object.entries(qty).map(([name, n]) => {
        const id = agreementCard(name).id;
        return [id, { cardId: id, qty: n }];
      }),
    ),
    updatedAt: 't',
  });
  const pool = poolOf(RED_POOL);
  /** The deck's reason for a card, undefined when the card is not in it. */
  const whyOf = (deck: Deck, name: string) =>
    deck.cards.find((c) => c.cardId === agreementCard(name).id)?.why;

  it('grows repeatable setup to Burn floor of repeatable setup or payoffs', () => {
    // The pool's repeatable pingers (Goblin Fireslinger, Kindlespark Duo, Retributive Wand,
    // Blisterspit Gremlin) meet the floor with almost no payoff; the theme core used to stop
    // growing setup at the setup floors and leave the deck short of this one.
    const request = { size: 40 as const, colors: ['R' as const], settings: s };
    expect(pickerPlans(request, pool, idx, CONFIG).map((p) => p.style)).toContain('burn');
    const r = buildDeck({ ...request, style: 'burn', id: 't', createdAt: 't' }, pool, idx, CONFIG);
    expect(r.deck.archetype).toBe('burn');
    const floor = r.explanation.theme!.floors.find((f) => f.floor === 'repeatableOrPayoff')!;
    expect(floor.have).toBeGreaterThanOrEqual(floor.need);
    expect(checkAgreement({ size: 40, colors: ['R'] }, pool, idx, CONFIG, s).issues).toEqual([]);
  });

  it('takes a plan card in the loose core as the pool count does, drawbacks included', () => {
    // Frightcrawler, the eighth carrier: its threshold drawback is unmet by the core's few
    // cards but met by the finished deck, as the scan's pool count takes it.
    const voltron = poolOf(VOLTRON_POOL);
    const request = { size: 60 as const, colors: ['B' as const], settings: s };
    expect(pickerPlans(request, voltron, idx, CONFIG).map((p) => p.style)).toContain('auras');
    const r = buildDeck(
      { ...request, style: 'auras', id: 't', createdAt: 't' },
      voltron,
      idx,
      CONFIG,
    );
    expect(r.deck.archetype).toBe('auras');
    expect(whyOf(r.deck, 'Frightcrawler')).toBe('Payoff: carrier');
    expect(checkAgreement({ size: 60, colors: ['B'] }, voltron, idx, CONFIG, s).issues).toEqual([]);
  });

  it('feeds a theme card its gate: Goblin Grenade gets Goblins to sacrifice', () => {
    const goblins = poolOf(GOBLIN_POOL);
    const request = { size: 40 as const, colors: ['R' as const], settings: s };
    expect(pickerPlans(request, goblins, idx, CONFIG).map((p) => p.style)).toContain('burn');
    const r = buildDeck(
      { ...request, style: 'burn', id: 't', createdAt: 't' },
      goblins,
      idx,
      CONFIG,
    );
    expect(r.deck.archetype).toBe('burn');
    expect(whyOf(r.deck, 'Goblin Grenade')).toMatch(/^Setup: /);
    expect(whyOf(r.deck, 'Redcap Heelslasher')).toBeDefined();
    expect(checkAgreement({ size: 40, colors: ['R'] }, goblins, idx, CONFIG, s).issues).toEqual([]);
  });

  it('feeds theme cards their needs in place of curve copies and role picks above the minimum', () => {
    // Hallowed Haunting wants enchantments cast and Crested Sunmare lifegain; the feed brings
    // in Hopeful Vigil for a curve copy and for a card-draw pick the deck holds above its
    // minimum, and Righteous Cause for a curve copy.
    const tokens = poolOf(TOKENS_POOL);
    const request = { size: 40 as const, colors: ['W' as const], settings: s };
    expect(pickerPlans(request, tokens, idx, CONFIG).map((p) => p.style)).toContain('tokens');
    const r = buildDeck(
      { ...request, style: 'tokens', id: 't', createdAt: 't' },
      tokens,
      idx,
      CONFIG,
    );
    expect(r.deck.archetype).toBe('tokens');
    expect(whyOf(r.deck, 'Hallowed Haunting')).toMatch(/^Setup: /);
    expect(whyOf(r.deck, 'Crested Sunmare')).toMatch(/^Setup: /);
    expect(whyOf(r.deck, 'Hopeful Vigil')).toBeDefined();
    expect(whyOf(r.deck, 'Righteous Cause')).toBeDefined();
    expect(checkAgreement({ size: 40, colors: ['W'] }, tokens, idx, CONFIG, s).issues).toEqual([]);
  });

  it('reads a list of spell kinds as any one of them', () => {
    // "Whenever you cast an instant, sorcery, or Wizard spell": instants meet it without Wizards.
    const relic = agreementCard('Relic Amulet');
    const trigger = cardNeeds(relic, CONFIG).abilities[0]!;
    const needs = trigger.refs.filter((r) => r.kind === 'need');
    expect(needs).toHaveLength(1);
    expect(needs[0]!.anyOf).toEqual(expect.arrayContaining(['spells', 'cast:tribe:Wizard']));
    // "Whenever a Kraken, Leviathan, Octopus, or Serpent you control ...": one need, any of four.
    const kraken = cardNeeds(agreementCard('Spawning Kraken'), CONFIG).abilities[0]!;
    expect(kraken.unparsed).toBeUndefined();
    expect(kraken.refs.filter((r) => r.kind === 'need').map((r) => [...r.anyOf].sort())).toEqual([
      ['tribe:Kraken', 'tribe:Leviathan', 'tribe:Octopus', 'tribe:Serpent'],
    ]);
    // A list with creature or land in it is met by every deck: "an artifact, creature, ... or planeswalker".
    const braids = cardNeeds(agreementCard('Braids, Arisen Nightmare'), CONFIG).abilities[0]!;
    expect(braids.refs.filter((r) => r.kind === 'need')).toEqual([]);
    // "A blue, black, or red spell": any of the three colors.
    const faithful = cardNeeds(agreementCard("God-Pharaoh's Faithful"), CONFIG).abilities[0]!;
    expect(faithful.refs.filter((r) => r.kind === 'need').map((r) => [...r.anyOf].sort())).toEqual([
      ['colored:B', 'colored:R', 'colored:U'],
    ]);
    // "Sacrifice an artifact, enchantment, or token": a token is one of the alternatives.
    const sugarmaw = cardNeeds(agreementCard('Devouring Sugarmaw // Have for Dinner'), CONFIG);
    const drawback = sugarmaw.abilities.flatMap((a) => a.refs).find((r) => r.kind === 'drawback')!;
    expect([...drawback.anyOf].sort()).toEqual(['tokens', 'type:artifact', 'type:enchantment']);
  });
});
