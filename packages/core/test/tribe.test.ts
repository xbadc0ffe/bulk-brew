// Tribes in the theme rules: a tribe is a theme whose setup is
// creatures of the type, changelings included, and whose payoffs are the cards that reward
// the type; a commander that names it leads it, and the grow builder builds it at 100.

import { describe, expect, it } from 'vitest';
import { checkAgreement, deckDisagreements } from '../src/agreement.ts';
import { buildDeck } from '../src/builder.ts';
import { factsFor } from '../src/candidates.ts';
import {
  cardNeeds,
  cardSupply,
  creditEarned,
  creditNeeds,
  deckSupply,
  feedResources,
  themeCredit,
  themeStyleOf,
  type DeckSupply,
} from '../src/card-needs.ts';
import { commanderCandidates } from '../src/commander.ts';
import { deckStyleRows } from '../src/deck-themes.ts';
import { growBuilds, namedTribes, themeJobsOf, themeStyles } from '../src/grow.ts';
import { creatureTypes, typalTag } from '../src/matchers.ts';
import { buildOption, planOptions } from '../src/options.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import { checkThemeRules, matchCard } from '../src/theme-rules.ts';
import type { CardRecord, Color, DataPack, Pool } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { SETTINGS } from './builder-fixtures.ts';
import { MORE_CARDS, READER_CARDS, TRIBE_CARDS } from './tribe-cards.ts';

const named = (name: string) => TRIBE_CARDS.find((c) => c.name === name)!;
const LATHRIL = named('Lathril, Blade of the Elves');

/** Cards no tribe cares about, to fill the 99: Bears and Horrors, removal, and draw. */
function filler(): CardRecord[] {
  const out: CardRecord[] = [];
  const base = (id: string, color: Color, mv: number): CardRecord => ({
    id,
    name: id,
    layout: 'normal',
    mv,
    manaCost: `{${mv - 1}}{${color}}`,
    typeLine: 'Sorcery',
    text: '',
    colors: [color],
    identity: [color],
    keywords: [],
    types: ['sorcery'],
    tags: [],
    img: id,
  });
  for (const color of ['G', 'B'] as const)
    for (let mv = 1; mv <= 6; mv++)
      for (let i = 0; i < 3; i++)
        out.push({
          ...base(`${color}-${mv}-${i}`, color, mv),
          typeLine: color === 'G' ? 'Creature — Bear' : 'Creature — Horror',
          types: ['creature'],
          power: String(mv),
          toughness: String(mv),
        });
  for (let i = 0; i < 6; i++) {
    const tags = (t: string[]) => ({ ...base(`${t[0]}-${i}`, 'B', 3), tags: t });
    out.push(tags(['removal-creature', 'spot-removal', 'removal']), tags(['pure-draw', 'draw']));
  }
  const basic = (id: string, name: string, color: Color): CardRecord => ({
    ...base(id, color, 0),
    name,
    manaCost: '',
    typeLine: `Basic Land — ${name}`,
    types: ['land'],
    colors: [],
    produces: [color],
  });
  out.push(basic('swamp', 'Swamp', 'B'), basic('forest', 'Forest', 'G'));
  return out;
}

const elves = TRIBE_CARDS.filter((c) => c.identity.every((x) => x === 'B' || x === 'G'));
const cards = [...elves, ...filler()];
const pack: DataPack = { schema: 2, version: 't', builtAt: 't', cardCount: cards.length, cards };
const index = new CardIndex(pack);
const pool: Pool = {
  entries: Object.fromEntries(
    cards.filter((c) => !c.types.includes('land')).map((c) => [c.id, { cardId: c.id, qty: 1 }]),
  ),
  updatedAt: 't',
};
const request = { size: 100 as const, colors: [], commander: LATHRIL.id, settings: SETTINGS };

describe('the tribe rules', () => {
  it('are checked as written: known placeholders, no kin', () => {
    const tribes = CONFIG.themeRules.tribes!;
    expect(checkThemeRules(CONFIG.themeRules)).toEqual([]);
    const typo = { ...tribes, lacks: { ...tribes.lacks, setup: 'few {tpye} creatures' } };
    expect(checkThemeRules({ ...CONFIG.themeRules, tribes: typo })).toEqual([
      'tribes.lacks.setup: unknown placeholder {tpye}',
    ]);
    const kin = { ...tribes, kin: ['tokens'] };
    expect(checkThemeRules({ ...CONFIG.themeRules, tribes: kin })).toContain(
      'tribes: a tribe has no "kin"',
    );
  });

  it('keep the two-word creature type whole (CR 205.3m)', () => {
    const river = named('River Song');
    expect(creatureTypes(river)).toEqual(['Human', 'Time Lord', 'Rogue']);
    expect(typalTag('Time Lord')).toBe('typal-time-lord');
    const style = themeStyleOf(CONFIG, 'tribal:Time Lord')!;
    expect(style.id).toBe('tribal:Time Lord');
    expect(matchCard(river, style, 100)).toMatchObject({ as: 'setup', job: 'Time Lord creature' });
    expect(matchCard(named('Time Lord Regeneration'), style, 100)).toMatchObject({
      as: 'payoff',
      job: 'rewards Time Lords',
    });
    // Neither word alone is a type.
    expect(themeStyleOf(CONFIG, 'tribal:Lord')).toBeUndefined();
  });

  it('count a changeling creature for every tribe, and not a changeling instant (CR 702.73a)', () => {
    for (const type of ['Elf', 'Dragon', 'Time Lord']) {
      const style = themeStyleOf(CONFIG, `tribal:${type}`)!;
      expect(matchCard(named('Avian Changeling'), style, 100)).toMatchObject({
        as: 'setup',
        job: 'changeling creature',
      });
      expect(matchCard(named('Blades of Velis Vel'), style, 100)).toBeUndefined();
    }
  });

  it('count a creature that is every creature type and changeling tokens for every tribe', () => {
    const more = (name: string) => MORE_CARDS.find((c) => c.name === name)!;
    for (const type of ['Elf', 'Dragon', 'Time Lord']) {
      const style = themeStyleOf(CONFIG, `tribal:${type}`)!;
      expect(matchCard(more('Mistform Ultimus'), style, 100)).toMatchObject({
        as: 'setup',
        job: 'creature that is every creature type',
      });
      // Its creatures are every type, and it makes changeling Shapeshifters.
      expect(matchCard(more('Maskwood Nexus'), style, 100)).toMatchObject({
        as: 'setup',
        job: 'makes changeling creature tokens',
      });
      // The token goes to the exiled creature's controller.
      expect(matchCard(more('Crib Swap'), style, 100)).toBeUndefined();
    }
    // The reader supplies every type for them too, so a payoff of any type can count them.
    for (const name of ['Mistform Ultimus', 'Maskwood Nexus', 'Irregular Cohort'])
      expect(cardSupply(more(name), CONFIG, 100)).toContain('tribe:*');
  });

  it('read a lord, a reward, and the type a token maker makes', () => {
    const elf = themeStyleOf(CONFIG, 'tribal:Elf')!;
    expect(matchCard(named('Imperious Perfect'), elf, 100)).toMatchObject({
      as: 'payoff',
      job: 'Elf lord',
      dual: true,
    });
    expect(matchCard(named('Elvish Archdruid'), elf, 100)).toMatchObject({ as: 'payoff' });
    // A reward that is no Elf, and one that makes Elves too.
    expect(matchCard(named('Elderfang Venom'), elf, 100)).toMatchObject({
      as: 'payoff',
      dual: false,
    });
    expect(matchCard(named('Elvish Promenade'), elf, 100)).toMatchObject({
      as: 'payoff',
      dual: true,
    });
    expect(matchCard(named('Wood Elves'), elf, 100)).toMatchObject({
      as: 'setup',
      job: 'Elf creature',
    });
    expect(matchCard(LATHRIL, elf, 100)).toMatchObject({ as: 'payoff', job: 'rewards Elves' });
    expect(namedTribes(CONFIG, LATHRIL)).toEqual(['tribal:Elf']);
    expect(namedTribes(CONFIG, named('Wood Elves'))).toEqual([]);
  });

  it('count a payoff only where the deck supplies the type', () => {
    // Its anthem is for other Elves; Imperious Perfect makes its own, and Elvish Archdruid's
    // mana for each Elf counts itself.
    const tactician = named('Canopy Tactician');
    const credit = themeCredit('tribal:Elf', 'payoff');
    const supplyOf = (list: CardRecord[]) =>
      deckSupply(
        { cards: list.map((card) => ({ card, qty: 1 })), colors: ['G'], size: 100 },
        CONFIG,
      );
    const members = elves.filter((c) => creatureTypes(c).includes('Elf'));
    expect(members.length).toBeGreaterThan(20);
    expect(creditEarned(tactician, credit, supplyOf(members), CONFIG)).toBe(true);
    const bears = filler().filter((c) => c.types.includes('creature'));
    expect(creditEarned(tactician, credit, supplyOf([tactician, ...bears]), CONFIG)).toBe(false);
    const perfect = named('Imperious Perfect');
    expect(creditEarned(perfect, credit, supplyOf([perfect, ...bears]), CONFIG)).toBe(true);
  });
});

describe("Lathril's Elf tribe", () => {
  it('is an option the commander leads, built and ranked by the grow builder', () => {
    expect(growBuilds({ ...request, style: 'tribal:Elf', requireStyle: true }, CONFIG)).toBe(true);
    const [lead] = commanderCandidates(pool, index, CONFIG, SETTINGS);
    expect(lead!.id).toBe(LATHRIL.id);
    expect(lead!.leads.map((l) => l.id)).toContain('tribal:Elf');
    expect(lead!.primaryTribes).toEqual(['tribal:Elf']);

    const scan = scanPool(pool, index, CONFIG, SETTINGS, 100, ['B', 'G'], LATHRIL);
    const tribe = scan.leadTribes?.find((t) => t.style === 'tribal:Elf');
    expect(tribe?.rules.viable).toBe(true);
    expect(tribe?.label).toBe('Elf tribe');

    // The tribe leads the options, and its option is the deck asked for by name.
    const { plans } = planOptions(request, pool, index, CONFIG);
    expect(plans[0]!.style).toBe('tribal:Elf');
    const option = buildOption(plans[0]!, request, pool, index, CONFIG);
    const asked = buildDeck(
      { ...request, style: 'tribal:Elf', requireStyle: true },
      pool,
      index,
      CONFIG,
    );
    expect(option.deck.cards).toEqual(asked.deck.cards);
    expect(asked.deck.archetype).toBe('tribal:Elf');
    expect(asked.deck.name).toBe('Lathril Elf tribe 100');
    expect(asked.explanation.builder).toBe('grow');
    expect(asked.explanation.nearest).toBeUndefined();

    // Counted by the tribe rules, the commander once, and shown as counted.
    const floors = asked.explanation.theme!;
    expect(floors.style).toBe('tribal:Elf');
    for (const f of floors.floors) expect(f.have).toBeGreaterThanOrEqual(f.need);
    expect(deckStyleRows(asked.deck, index, CONFIG).map((r) => r.label)).toEqual([
      'Elf tribe setup cards',
      'Elf tribe payoff cards',
    ]);
    expect(deckDisagreements(asked.deck, index, CONFIG)).toEqual([]);
    // Its text is all Elves: it leads the tribe in full.
    expect(asked.explanation.pick?.lead).toBe(CONFIG.builderWeights.grow.commanderPlan);

    // Best fit compares it, as the scan and the options plan it.
    const best = buildDeck(request, pool, index, CONFIG);
    expect(best.explanation.pick?.ranked?.map((r) => r.style)).toContain('tribal:Elf');
    const r = checkAgreement(
      { size: 100, colors: [], commander: LATHRIL.id },
      pool,
      index,
      CONFIG,
      SETTINGS,
    );
    expect(r.issues).toEqual([]);
    expect(r.plans).toContain('tribal:Elf');
  });

  it('lets a payoff of the type cover the other payoffs, as the rules say (payoffSupplies)', () => {
    const tribes = CONFIG.themeRules.tribes!;
    const without: typeof CONFIG = {
      ...CONFIG,
      themeRules: { ...CONFIG.themeRules, tribes: { ...tribes, payoffSupplies: false } },
    };
    const payoffs = (config: typeof CONFIG) =>
      buildDeck(
        { ...request, style: 'tribal:Elf', requireStyle: true },
        pool,
        index,
        config,
      ).explanation.theme!.floors.find((f) => f.floor === 'payoff')!.have;
    // Most Elf payoffs are Elves: each covers the others, so the deck holds more of them.
    expect(payoffs(CONFIG)).toBeGreaterThan(payoffs(without));
  });

  it('gives each card one job per tribe, aligned with the theme styles', () => {
    const facts = factsFor(index, CONFIG, named('Imperious Perfect'));
    const styles = themeStyles(CONFIG, ['tribal:Elf']);
    const jobs = themeJobsOf(CONFIG, facts, 100, ['tribal:Elf']);
    expect(styles.at(-1)).toBe('tribal:Elf');
    expect(jobs).toHaveLength(styles.length);
    expect(jobs.at(-1)).toMatchObject({ as: 'payoff', job: 'Elf lord' });
  });
});

describe('the reader and the finished-deck feed', () => {
  const card = (name: string) => READER_CARDS.find((c) => c.name === name)!;
  const refsOf = (name: string) => cardNeeds(card(name), CONFIG).abilities.flatMap((a) => a.refs);

  it('reads a list of kinds joined by "and" as alternatives', () => {
    const warrior = card('The Destined Warrior');
    const party = ['tribe:Cleric', 'tribe:Rogue', 'tribe:Warrior', 'tribe:Wizard'];
    expect(refsOf('The Destined Warrior')).toContainEqual(
      expect.objectContaining({ kind: 'need', anyOf: party }),
    );
    expect(cardNeeds(warrior, CONFIG).abilities.some((a) => a.unparsed)).toBe(false);
    expect(refsOf('Urza, Lord Protector')).toContainEqual(
      expect.objectContaining({ anyOf: ['type:artifact', 'type:instant-sorcery'] }),
    );
    // Its cost reducer pays off Warriors in a deck of Warriors alone, so it leads its Warrior tribe.
    const warriors: DeckSupply = {
      size: 100,
      colors: ['W', 'U', 'B'],
      commander: true,
      counts: new Map([['tribe:Warrior', 20]]),
      devotion: new Map(),
    };
    expect(creditEarned(warrior, themeCredit('tribal:Warrior', 'payoff'), warriors, CONFIG)).toBe(
      true,
    );
    expect(namedTribes(CONFIG, warrior)).toContain('tribal:Warrior');
  });

  it('feeds one alternative of a need: the one the pool can meet, else the one the deck holds most of', () => {
    const valduk = card('Valduk, Keeper of the Flame');
    // "For each Aura and Equipment attached": any one kind meets it, so copies split between them meet neither.
    const ref = creditNeeds(valduk, themeCredit('tokens', 'setup'), CONFIG, 100).clauses[0]!
      .needs[0]!;
    expect(ref.anyOf).toEqual(['subtype:Aura', 'subtype:Equipment']);
    const supply = (equipment: number, auras: number) =>
      deckSupply(
        {
          cards: [
            { card: card("Explorer's Scope"), qty: equipment },
            { card: card('Dramatic Accusation'), qty: auras },
          ],
          colors: ['R'],
          size: 100,
        },
        CONFIG,
      );
    expect(feedResources(ref, supply(3, 4), supply(9, 4), valduk, CONFIG)).toEqual([
      'subtype:Equipment',
    ]);
    expect(feedResources(ref, supply(3, 4), supply(9, 9), valduk, CONFIG)).toEqual([
      'subtype:Aura',
    ]);
  });
});
