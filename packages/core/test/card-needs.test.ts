import { describe, expect, it } from 'vitest';
import {
  addSupply,
  cardCredits,
  cardNeeds,
  checkCardNeeds,
  creditEarned,
  creditNeeds,
  deckSupply,
  effectiveManaValue,
  needMet,
  needThreshold,
  pluralOf,
  strengthCredit,
  themeCredit,
  type CardNeedsConfig,
  type NeedRef,
} from '../src/card-needs.ts';
import { configVersion, validateConfig, type BulkBrewConfig } from '../src/config.ts';
import { landEntry } from '../src/lands.ts';
import { cardMatches } from '../src/matchers.ts';
import type { Color, DeckSize } from '../src/types.ts';
import { CONFIG } from './config.test.ts';
import { needsCard } from './needs-cards.ts';

type Cards = [string, number][];

/** A plain mono-black 60: no Elves, Dragons, Nobles, Lessons, counters plan, or lifegain plan. */
const MONO_BLACK: Cards = [
  ['Walking Corpse', 4],
  ['Typhoid Rats', 4],
  ['Vampire Interloper', 4],
  ['Okiba-Gang Shinobi', 4],
  ['Ravenous Chupacabra', 2],
  ['Murder', 2],
  ['Cast Down', 2],
  ['Mind Rot', 2],
  ['Duress', 2],
];

function supply(cards: Cards, colors: Color[] = ['B'], size: DeckSize = 60) {
  return deckSupply(
    { cards: cards.map(([name, qty]) => ({ card: needsCard(name), qty })), colors, size },
    CONFIG,
  );
}

/** The mono-black 60 with the card under test in it. */
function withCard(name: string, more: Cards = [], colors: Color[] = ['B']) {
  return supply([...MONO_BLACK, [name, 1], ...more], colors);
}

const earned = (name: string, credit: string, more: Cards = [], colors: Color[] = ['B']) =>
  creditEarned(needsCard(name), credit, withCard(name, more, colors), CONFIG);

const read = (name: string) => cardNeeds(needsCard(name), CONFIG);

const refsOf = (name: string) => read(name).abilities.flatMap((a) => a.refs);

function roles(name: string): string[] {
  return CONFIG.roles.roles.filter((r) => cardMatches(needsCard(name), r.match)).map((r) => r.id);
}

describe('worked examples, in a mono-black 60', () => {
  it('Lo and Li: every ability needs Nobles or Lessons; no role, and no credit earned', () => {
    const r = read('Lo and Li, Twin Tutors');
    expect(r.abilities).toHaveLength(2);
    for (const a of r.abilities) {
      expect(a.kind).toBe('need');
      expect(
        a.refs.some((x) => x.anyOf.includes('tribe:Noble') && x.anyOf.includes('subtype:Lesson')),
      ).toBe(true);
    }
    expect(roles('Lo and Li, Twin Tutors')).toEqual([]);
    const credits = cardCredits(needsCard('Lo and Li, Twin Tutors'), CONFIG);
    expect(credits.length).toBeGreaterThan(0);
    for (const credit of credits) expect(earned('Lo and Li, Twin Tutors', credit)).toBe(false);
  });

  it('Yathan Tombguard: an evasive attacker whose draw needs counters, so no card advantage', () => {
    expect(roles('Yathan Tombguard')).toEqual(['cardAdvantage', 'evasiveThreat']);
    expect(earned('Yathan Tombguard', 'evasiveThreat')).toBe(true);
    const ca = creditNeeds(needsCard('Yathan Tombguard'), 'cardAdvantage', CONFIG);
    expect(ca.kind).toBe('need');
    expect(ca.resources).toEqual(['counters:any']);
    expect(earned('Yathan Tombguard', 'cardAdvantage')).toBe(false);
  });

  it('Dawnhand Eulogist: a 3/3 menace body; its drain needs an Elf in the graveyard', () => {
    const [menace, drain] = read('Dawnhand Eulogist').abilities;
    expect(menace!.kind).toBe('unconditional');
    expect(drain!.refs).toEqual([
      expect.objectContaining({ kind: 'need', place: 'condition', anyOf: ['graveyard:tribe:Elf'] }),
    ]);
    // The mill comes first and does not depend on the Elf; the drain does.
    expect(drain!.clauses.map((c) => c.kind)).toEqual(['unconditional', 'need']);
    expect(earned('Dawnhand Eulogist', 'evasiveThreat')).toBe(true);
    expect(earned('Dawnhand Eulogist', themeCredit('lifegain', 'setup'))).toBe(false);
  });

  it('Tragedy Feaster: a drawback without lifegain, and not picked without enough supply', () => {
    const r = read('Tragedy Feaster');
    expect(r.kind).toBe('drawback');
    const [ref] = refsOf('Tragedy Feaster');
    expect(ref).toMatchObject({ kind: 'drawback', place: 'condition', anyOf: ['lifegain'] });
    expect(ref!.harm).toMatch(/sacrifice/);
    expect(creditNeeds(needsCard('Tragedy Feaster'), 'finisher', CONFIG).gates).toHaveLength(1);
    expect(earned('Tragedy Feaster', 'finisher')).toBe(false);
    expect(earned('Tragedy Feaster', 'commanderFinisher')).toBe(false);
  });

  it('Starlit Soothsayer: an evasive attacker whose rider is met by life loss as well', () => {
    expect(earned('Starlit Soothsayer', 'evasiveThreat')).toBe(true);
    const [ref] = refsOf('Starlit Soothsayer');
    expect(ref).toMatchObject({ kind: 'need', anyOf: ['lifegain', 'lifeloss'] });
    const rider = themeCredit('lifegain', 'payoff');
    expect(earned('Starlit Soothsayer', rider)).toBe(false);
    const lifeLoss: Cards = [
      ["Night's Whisper", 2],
      ['Feed the Swarm', 2],
      ['Gruesome Realization', 2],
    ];
    expect(earned('Starlit Soothsayer', rider, lifeLoss)).toBe(true);
  });

  it('Shilgengar: an evasive threat; the Angel text is a bonus ("instead")', () => {
    const angel = refsOf('Shilgengar, Sire of Famine').find((x) => x.anyOf.includes('tribe:Angel'));
    expect(angel).toMatchObject({ kind: 'bonus', place: 'replacement' });
    expect(earned('Shilgengar, Sire of Famine', 'evasiveThreat')).toBe(true);
    expect(earned('Shilgengar, Sire of Famine', themeCredit('aristocrats', 'setup'))).toBe(true);
    // It makes the Blood tokens its last ability spends.
    expect(read('Shilgengar, Sire of Famine').selfSupplies).toEqual(['subtype:Blood']);
  });

  it('Caustic Exhale: removal; the Dragon is a bonus ("or pay") and gates nothing', () => {
    const [cost, effect] = read('Caustic Exhale').abilities;
    expect(cost!.shape).toBe('additionalCost');
    expect(cost!.refs).toEqual([
      expect.objectContaining({ kind: 'bonus', place: 'additionalCost', anyOf: ['tribe:Dragon'] }),
    ]);
    expect(effect!.kind).toBe('unconditional');
    expect(creditNeeds(needsCard('Caustic Exhale'), 'removal', CONFIG)).toMatchObject({
      kind: 'unconditional',
      gates: [],
    });
    expect(earned('Caustic Exhale', 'removal')).toBe(true);
  });

  it('Great Arashin City: always tapped without a Forest or Plains, as landEntry reads it', () => {
    const card = needsCard('Great Arashin City');
    const [ref] = refsOf('Great Arashin City');
    expect(ref).toMatchObject({ kind: 'drawback', anyOf: ['land:Forest', 'land:Plains'] });
    expect(ref!.harm).toMatch(/enters tapped/);
    expect(needMet(ref!, supply(MONO_BLACK), card, CONFIG)).toBe(false);
    expect(landEntry(card, { colors: ['B'], size: 60 }, CONFIG).tapped).toBe(1);
    expect(needMet(ref!, supply(MONO_BLACK, ['B', 'G']), card, CONFIG)).toBe(true);
    expect(landEntry(card, { colors: ['B', 'G'], size: 60 }, CONFIG).tapped).toBeLessThan(1);
  });
});

describe('the same cards in decks that supply the need', () => {
  const elves: Cards = [
    ['Llanowar Elves', 4],
    ['Elvish Mystic', 4],
  ];

  it('Dawnhand Eulogist keeps its drain among Elves', () => {
    expect(earned('Dawnhand Eulogist', themeCredit('lifegain', 'setup'), elves, ['B', 'G'])).toBe(
      true,
    );
  });

  it('Tragedy Feaster is a threat in a lifegain build', () => {
    const lifegain: Cards = [
      ['Vampire Nighthawk', 4],
      ['Child of Night', 4],
    ];
    expect(earned('Tragedy Feaster', 'finisher', lifegain)).toBe(true);
  });

  it('Yathan Tombguard draws with a counters plan', () => {
    const counters: Cards = [
      ['Luminarch Aspirant', 4],
      ['Hunger of the Howlpack', 4],
    ];
    expect(earned('Yathan Tombguard', 'cardAdvantage', counters, ['B', 'W', 'G'])).toBe(true);
  });

  it('changelings count for a tribe: Lo and Li gives lifelink to Nobles', () => {
    const changelings: Cards = [['Changeling Outcast', 8]];
    expect(earned('Lo and Li, Twin Tutors', strengthCredit('anthem'), changelings)).toBe(true);
  });

  it('a tribe the deck holds too few of stays unmet, and enough of it is met', () => {
    const card = needsCard('Lord of the Undead');
    const [anthem] = refsOf('Lord of the Undead');
    expect(anthem).toMatchObject({ kind: 'need', anyOf: ['tribe:Zombie'], self: false });
    expect(needMet(anthem!, supply(MONO_BLACK), card, CONFIG)).toBe(false);
    const zombies = supply([...MONO_BLACK, ['Gravedigger', 4]]);
    expect(needMet(anthem!, zombies, card, CONFIG)).toBe(true);
  });
});

describe('kinds, resource families, and colors', () => {
  it('a need and a bonus naming the same tribe', () => {
    expect(refsOf("Dragonlord's Servant")).toEqual([
      expect.objectContaining({ kind: 'need', place: 'selection', anyOf: ['tribe:Dragon'] }),
    ]);
    expect(refsOf('Caustic Exhale')[0]).toMatchObject({ kind: 'bonus', anyOf: ['tribe:Dragon'] });
  });

  it('artifacts: metalcraft needs three; affinity is a bonus, and an artifact counts itself', () => {
    expect(refsOf('Lumengrid Drake')).toEqual([
      expect.objectContaining({
        kind: 'need',
        place: 'condition',
        anyOf: ['type:artifact'],
        count: 3,
      }),
    ]);
    expect(refsOf('Somber Hoverguard')).toEqual([
      expect.objectContaining({
        kind: 'bonus',
        place: 'count',
        anyOf: ['type:artifact'],
        self: false,
      }),
    ]);
    expect(refsOf('Frogmite')[0]).toMatchObject({ kind: 'bonus', self: true });
    expect(read('Thoughtcast').kind).toBe('bonus');
  });

  it('instants and sorceries: a cast trigger needs spells', () => {
    const card = needsCard('Kiln Fiend');
    const [ref] = refsOf('Kiln Fiend');
    expect(ref).toMatchObject({ kind: 'need', place: 'trigger', anyOf: ['spells'] });
    const spells = supply(
      [
        ['Kiln Fiend', 4],
        ['Murder', 4],
        ['Cast Down', 4],
      ],
      ['B', 'R'],
    );
    expect(needMet(ref!, spells, card, CONFIG)).toBe(true);
    expect(needMet(ref!, supply([['Walking Corpse', 4]], ['B', 'R']), card, CONFIG)).toBe(false);
  });

  it('lifegain: a white trigger on gaining life', () => {
    expect(refsOf("Ajani's Pridemate")).toEqual([
      expect.objectContaining({ kind: 'need', place: 'trigger', anyOf: ['lifegain'] }),
    ]);
  });

  it('counters: a selection of creatures with +1/+1 counters, met by its own Outlast', () => {
    expect(refsOf('Ainok Bond-Kin')).toEqual([
      expect.objectContaining({
        kind: 'need',
        place: 'selection',
        anyOf: ['counters:+1/+1'],
        self: true,
      }),
    ]);
  });

  it('graveyard: returning a creature card is met by a deck of creatures', () => {
    const card = needsCard('Gravedigger');
    const [ref] = refsOf('Gravedigger');
    expect(ref).toMatchObject({ kind: 'need', anyOf: ['graveyard:creature'] });
    expect(needMet(ref!, supply(MONO_BLACK), card, CONFIG)).toBe(true);
    expect(needMet(ref!, supply([['Murder', 4]]), card, CONFIG)).toBe(false);
  });

  it("color: mana of the card's own colors names nothing, since the deck holds them", () => {
    expect(
      refsOf('Bant Battlemage').filter((r) => r.anyOf.some((x) => x.startsWith('color:'))),
    ).toEqual([]);
  });

  it('drawbacks: a tribe, a devotion, a revealed card', () => {
    expect(refsOf('Felhide Brawler')).toEqual([
      expect.objectContaining({ kind: 'drawback', anyOf: ['tribe:Minotaur'], other: true }),
    ]);
    const erebos = needsCard('Erebos, God of the Dead');
    const devotion = refsOf('Erebos, God of the Dead').find((x) => x.anyOf.includes('devotion:B'));
    expect(devotion).toMatchObject({ kind: 'drawback' });
    expect(needMet(devotion!, supply([['Murder', 4]]), erebos, CONFIG)).toBe(false);
    const permanents = supply([
      ['Walking Corpse', 4],
      ['Typhoid Rats', 4],
      ['Vampire Interloper', 4],
    ]);
    expect(needMet(devotion!, permanents, erebos, CONFIG)).toBe(true);
    expect(refsOf('Ancient Amphitheater')).toEqual([
      expect.objectContaining({ kind: 'drawback', anyOf: ['tribe:Giant'] }),
    ]);
  });

  it('a basic land condition is met by any deck with a color', () => {
    const card = needsCard('Realm of Koh');
    const [ref] = refsOf('Realm of Koh');
    expect(ref).toMatchObject({ kind: 'drawback', anyOf: ['land:basic'] });
    expect(needMet(ref!, supply(MONO_BLACK), card, CONFIG)).toBe(true);
  });
});

describe('self-supply', () => {
  it('a card of the type it counts supplies itself, but not "other" or "another"', () => {
    const [anthem, mana] = refsOf('Elvish Archdruid');
    expect(anthem).toMatchObject({ anyOf: ['tribe:Elf'], other: true, self: false });
    expect(mana).toMatchObject({ place: 'count', anyOf: ['tribe:Elf'], self: true });
    const [count, attack] = refsOf('Wintermoor Commander');
    expect(count).toMatchObject({ place: 'count', anyOf: ['tribe:Knight'], self: true });
    expect(attack).toMatchObject({ anyOf: ['tribe:Knight'], other: true, self: false });
  });

  it('a card that makes its own Food or Treasure meets the need it creates', () => {
    expect(read('Experimental Confectioner').selfSupplies).toEqual(['subtype:Food']);
    expect(read("Alchemist's Talent").selfSupplies).toEqual(['subtype:Treasure']);
  });

  it('an earlier sentence of the same ability supplies a later one', () => {
    expect(refsOf('Fortifying Draught')).toEqual([
      expect.objectContaining({ kind: 'need', place: 'count', anyOf: ['lifegain'], self: true }),
    ]);
    // The same count with nothing before it that gains life.
    expect(refsOf('Accomplished Alchemist')).toEqual([
      expect.objectContaining({ kind: 'need', place: 'count', anyOf: ['lifegain'], self: false }),
    ]);
  });

  it('a supplier with a need of its own self-supplies only when that need is met', () => {
    const card = needsCard("Cleric of Life's Bond");
    const lifegain = refsOf("Cleric of Life's Bond").find((r) => r.anyOf.includes('lifegain'));
    expect(lifegain).toMatchObject({
      self: true,
      selfVia: [expect.objectContaining({ anyOf: ['tribe:Cleric'] })],
    });
    const alone = supply([...MONO_BLACK, ["Cleric of Life's Bond", 1]], ['W', 'B']);
    expect(needMet(lifegain!, alone, card, CONFIG)).toBe(false);
    const clerics = supply([...MONO_BLACK, ["Cleric of Life's Bond", 8]], ['W', 'B']);
    expect(needMet(lifegain!, clerics, card, CONFIG)).toBe(true);
  });

  it('a self-supplied need is met in any deck', () => {
    const card = needsCard('Experimental Confectioner');
    const [ref] = refsOf('Experimental Confectioner');
    expect(needMet(ref!, supply(MONO_BLACK), card, CONFIG)).toBe(true);
  });
});

describe('shapes: faces, Sagas, Classes, modal spells', () => {
  it('reads both faces of a two-faced card', () => {
    const [front, back] = read('Delver of Secrets // Insectile Aberration').abilities;
    expect(front).toMatchObject({ face: 0, shape: 'triggered', kind: 'need' });
    expect(front!.refs[0]).toMatchObject({ anyOf: ['type:instant-sorcery'] });
    expect(back).toMatchObject({
      face: 1,
      shape: 'keyword',
      kind: 'unconditional',
      text: 'Flying',
    });
  });

  it('reads each Saga chapter as an ability', () => {
    const r = read('The Eldest Reborn');
    expect(r.abilities.map((a) => a.shape)).toEqual(['chapter', 'chapter', 'chapter']);
    expect(r.abilities.map((a) => a.starts.split(' ')[0])).toEqual(['I', 'II', 'III']);
    expect(r.kind).toBe('unconditional');
  });

  it('reads Class levels', () => {
    const r = read("Alchemist's Talent");
    expect(r.abilities.map((a) => a.level)).toEqual([undefined, 2, 2, 3, 3]);
    expect(r.abilities[2]!.refs[0]).toMatchObject({ anyOf: ['subtype:Treasure'], self: true });
  });

  it('reads modal bullets as abilities under their header', () => {
    const r = read('Gruesome Realization');
    expect(r.abilities.map((a) => a.shape)).toEqual(['modal', 'mode', 'mode']);
    expect(r.abilities.map((a) => a.parent)).toEqual([undefined, 0, 0]);
    expect(r.abilities[1]!.supplies).toContain('lifeloss');
  });

  it('bullets under a triggered "choose one" carry the trigger', () => {
    const r = read('Ojutai Exemplars');
    expect(r.abilities.map((a) => a.shape)).toEqual(['triggered', 'mode', 'mode', 'mode']);
    for (const a of r.abilities.slice(1))
      expect(a.refs).toEqual([
        expect.objectContaining({ kind: 'need', place: 'trigger', anyOf: ['cast:noncreature'] }),
      ]);
  });
});

describe('death, sacrifice, commander, free spells, and unread text', () => {
  it('"a creature you control dies" needs deaths; "you sacrifice" needs sacrifice outlets', () => {
    expect(refsOf('Grave Pact')).toEqual([
      expect.objectContaining({ kind: 'need', place: 'trigger', anyOf: ['death'] }),
    ]);
    const [sacrifice] = refsOf('Fleshtaker');
    expect(sacrifice).toMatchObject({ kind: 'need', place: 'trigger', anyOf: ['sacrifice'] });
    // Its own "Sacrifice another creature" cost supplies the trigger.
    expect(read('Fleshtaker').selfSupplies).toEqual(['sacrifice']);
  });

  it('a commander spell is met only in a Commander deck with a commander', () => {
    const card = needsCard('Sagrada Familiar');
    const ref = read('Sagrada Familiar')
      .abilities.flatMap((a) => a.refs)
      .find((r) => r.place === 'trigger');
    expect(ref).toMatchObject({ anyOf: ['cast:commander'] });
    const cards = [{ card, qty: 1 }];
    const commander = needsCard('Shilgengar, Sire of Famine');
    const edh = deckSupply({ cards, colors: ['W', 'B'], size: 100, commander }, CONFIG);
    expect(needMet(ref!, edh, card, CONFIG)).toBe(true);
    expect(
      needMet(ref!, deckSupply({ cards, colors: ['W'], size: 60 }, CONFIG), card, CONFIG),
    ).toBe(false);
  });

  it('casting another spell for free is not a bonus; only the card casting itself is', () => {
    expect(refsOf('Torrential Gearhulk')).toEqual([
      expect.objectContaining({ kind: 'need', anyOf: ['graveyard:instant-sorcery'] }),
    ]);
  });

  it('an unparsed ability that names nothing adds no ref, so it costs no credit', () => {
    const r = read('Imprisoned in the Moon');
    expect(r.abilities.flatMap((a) => a.refs).filter((x) => x.anyOf.length === 0)).toEqual([]);
    expect(
      creditEarned(
        needsCard('Imprisoned in the Moon'),
        'removal',
        supply([['Imprisoned in the Moon', 4]], ['U']),
        CONFIG,
      ),
    ).toBe(true);
  });
});

describe('deck supply', () => {
  it('counts copies, and grows when cards are added', () => {
    const base = supply(MONO_BLACK);
    expect(base.counts.get('tribe:Zombie')).toBe(4);
    expect(base.counts.get('type:creature')).toBe(18);
    addSupply(base, needsCard('Gravedigger'), 4, CONFIG);
    expect(base.counts.get('tribe:Zombie')).toBe(8);
    expect(base.counts).toEqual(supply([...MONO_BLACK, ['Gravedigger', 4]]).counts);
  });

  it('points lifegain at the Lifegain setup jobs', () => {
    const s = supply([
      ['Vampire Nighthawk', 4],
      ['Child of Night', 4],
    ]);
    expect(s.counts.get('lifegain')).toBe(8);
    expect(supply(MONO_BLACK).counts.get('lifegain')).toBeUndefined();
  });

  it('thresholds grow with size and with the count asked for, but not for graveyard counts', () => {
    const t = (res: string, size: DeckSize, count?: number) =>
      needThreshold(res, size, CONFIG, count);
    expect(t('tribe:Elf', 60, 3)).toBeGreaterThan(t('tribe:Elf', 60));
    expect(t('lifegain', 20)).toBeLessThan(t('lifegain', 60));
    expect(t('type:creature', 100)).toBeGreaterThanOrEqual(t('type:creature', 60));
    expect(t('graveyard:creature', 60, 3)).toBe(t('graveyard:creature', 60));
    for (const size of [20, 40, 60, 100] as const) expect(t('tribe:Elf', size)).toBeGreaterThan(0);
  });

  it('an unparsed ability needs more than the threshold of what its words name, and nothing meets an empty one', () => {
    const ref: NeedRef = {
      kind: 'need',
      place: 'unparsed',
      anyOf: ['tribe:Elf'],
      self: false,
      text: '',
    };
    const card = needsCard('Walking Corpse');
    const eight = supply([
      ['Llanowar Elves', 4],
      ['Elvish Mystic', 4],
    ]);
    expect(needMet(ref, eight, card, CONFIG)).toBe(false);
    const ten = supply([
      ['Llanowar Elves', 4],
      ['Elvish Mystic', 4],
      ['Elvish Visionary', 2],
    ]);
    expect(needMet(ref, ten, card, CONFIG)).toBe(true);
    expect(needMet({ ...ref, anyOf: [] }, ten, card, CONFIG)).toBe(false);
  });
});

describe('credits', () => {
  it('a credit the config does not give the card reads as absent, and is not earned', () => {
    const card = needsCard('Walking Corpse');
    expect(creditNeeds(card, 'removal', CONFIG, 60).kind).toBe('absent');
    expect(creditEarned(card, 'removal', supply(MONO_BLACK), CONFIG)).toBe(false);
  });

  it('an "or pay" additional cost adds its mana when the deck lacks the resource', () => {
    const card = needsCard('Goldmeadow Stalwart');
    expect(effectiveManaValue(card, supply([['Goldmeadow Stalwart', 1]], ['W']), CONFIG)).toBe(
      card.mv + 3,
    );
    expect(effectiveManaValue(card, supply([['Goldmeadow Stalwart', 12]], ['W']), CONFIG)).toBe(
      card.mv,
    );
    expect(
      creditEarned(card, 'earlyCreature', supply([['Goldmeadow Stalwart', 1]], ['W']), CONFIG),
    ).toBe(false);
  });
});

describe('determinism and caching', () => {
  it('returns the cached reading for the same record, and the same reading for a copy', () => {
    const card = needsCard('Shilgengar, Sire of Famine');
    expect(cardNeeds(card, CONFIG)).toBe(cardNeeds(card, CONFIG));
    const copy = JSON.parse(JSON.stringify(card)) as typeof card;
    expect(cardNeeds(copy, CONFIG)).not.toBe(cardNeeds(card, CONFIG));
    expect(cardNeeds(copy, CONFIG)).toEqual(cardNeeds(card, CONFIG));
  });
});

describe('config', () => {
  const copy = () => JSON.parse(JSON.stringify(CONFIG)) as BulkBrewConfig;
  const needsOf = (c: BulkBrewConfig) =>
    c.cardNeeds as unknown as Record<string, unknown> & CardNeedsConfig;

  it('is valid and joins the config version', () => {
    expect(validateConfig(CONFIG)).toEqual([]);
    expect(configVersion(CONFIG)).toContain(`.n${CONFIG.cardNeeds.version}`);
  });

  it('pluralizes as the pack does', () => {
    const plurals = CONFIG.cardNeeds.vocabulary.plurals;
    expect(pluralOf('Elf', plurals)).toBe('Elves');
    expect(pluralOf('Ally', plurals)).toBe('Allies');
    expect(pluralOf('Sphinx', plurals)).toBe('Sphinxes');
    expect(pluralOf('Merfolk', plurals)).toBe('Merfolk');
    expect(pluralOf('Goblin', plurals)).toBe('Goblins');
  });

  it('needs a clause pattern for every role and strength effect', () => {
    const c = copy();
    delete needsOf(c).credits.roles.removal;
    delete needsOf(c).credits.strength.counterspell;
    const problems = validateConfig(c);
    expect(problems).toContain(
      'cardNeeds: credits.roles: no clause pattern for the role "removal"',
    );
    expect(problems).toContain(
      'cardNeeds: credits.strength: no clause pattern for the effect "counterspell"',
    );
  });

  it('rejects a bad expression, an unknown key, and an unknown theme', () => {
    const c = copy();
    needsOf(c).templates.effect.push({ re: '(unclosed', ignore: true });
    needsOf(c).templates.cost.push({ re: 'pay', ignore: true, colour: 'red' } as never);
    needsOf(c).supply.lifegain = { theme: 'lifegian' };
    const problems = checkCardNeeds(c.cardNeeds, c);
    expect(problems.some((p) => p.includes('bad regular expression'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown key "colour"'))).toBe(true);
    expect(problems).toContain('supply.lifegain: "lifegian" is not a style in the theme rules');
  });

  it('rejects thresholds that miss a size', () => {
    const c = copy();
    delete (needsOf(c).thresholds.base as Partial<Record<string, number>>)['100'];
    expect(checkCardNeeds(c.cardNeeds, c)).toContain(
      'thresholds.base.100: must be a number of 0 or more',
    );
  });
});
