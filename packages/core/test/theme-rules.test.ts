import { describe, expect, it } from 'vitest';
import { configVersion, validateConfig, type BulkBrewConfig } from '../src/config.ts';
import {
  checkMinimums,
  checkThemeRules,
  compileThemeRules,
  countTheme,
  EXAMPLE_THEME_RULES,
  matchCard,
  themeRulesFor,
  type ThemeRulesFile,
  type ThemeStyleRules,
} from '../src/theme-rules.ts';
import type { CardRecord } from '../src/types.ts';
import { CONFIG } from './config.test.ts';

let n = 0;
/** A made-up blue creature; tests give it the text and tags they read. */
function card(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  n++;
  return {
    id: `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature',
    text: '',
    colors: ['U'],
    identity: ['U'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

function file(styles: Record<string, ThemeStyleRules>): ThemeRulesFile {
  return { version: 't', styles };
}

const BASE: ThemeStyleRules = {
  resource: 'r',
  setup: [{ job: 's', weight: 1, text: 'setup' }],
  payoff: [{ job: 'p', weight: 1, text: 'payoff' }],
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('compiling theme rules', () => {
  it('names every problem in one error, and checkThemeRules lists them without throwing', () => {
    const bad = {
      version: '1',
      styles: {
        a: {
          ...BASE,
          colour: 'blue',
          setup: [{ job: 's', text: 'x' }],
          payoff: [{ job: 'p', weight: 1, text: '(' }],
          kin: ['a', 'nope'],
          minimums: { '60': { setup: 2, payoff: 1 } },
          lacks: { setup: 'few cards — none at all' },
        },
        b: BASE,
      },
    };
    const problems = checkThemeRules(bad);
    expect(problems).toEqual([
      'styles.a: unknown key "colour"',
      'styles.a.setup[0]: "weight" must be a number of 0 or more',
      expect.stringMatching(/^styles\.a\.payoff\[0\] text: bad regular expression/),
      'styles.a.kin: "a" must be another style in the file',
      'styles.a.kin: "nope" must be another style in the file',
      'styles.a.lacks.setup: no em-dashes in a phrase',
      'styles.a.lacks: give a phrase for the floor "payoff" the minimums use',
    ]);
    expect(() => compileThemeRules(bad, 'test rules')).toThrow(
      /^test rules: styles\.a: unknown key "colour"; .*no em-dashes/,
    );
  });

  it('requires a phrase for every floor any size uses, and only known floors', () => {
    const problems = checkThemeRules(
      file({
        a: {
          ...BASE,
          minimums: { '20': { setup: 1 }, '60': [{ setupWeight: 3 }, { repeatable: 2 }] },
          lacks: { setup: 'few s', setupWeight: 'few weighty s', payof: 'typo' } as never,
          setupNeedsPayoff: 'yes' as never,
        },
      }),
    );
    expect(problems).toEqual([
      'styles.a: "setupNeedsPayoff" must be true or false',
      'styles.a.lacks: unknown floor "payof"',
      'styles.a.lacks: give a phrase for the floor "repeatable" the minimums use',
    ]);
  });

  it('keeps kin, the payoff flag, and the phrases on the compiled style', () => {
    const rules = compileThemeRules(
      file({
        a: {
          ...BASE,
          kin: ['b'],
          setupNeedsPayoff: true,
          minimums: { '60': { payoff: 2 } },
          lacks: { payoff: 'few p' },
        },
        b: BASE,
      }),
    );
    expect(rules.styles.get('a')).toMatchObject({
      kin: ['b'],
      setupNeedsPayoff: true,
      lacks: { payoff: 'few p' },
    });
    expect(rules.styles.get('b')).toMatchObject({ kin: [], setupNeedsPayoff: false, lacks: {} });
    expect(checkThemeRules(EXAMPLE_THEME_RULES)).toEqual([]);
  });
});

describe('matching and counting', () => {
  const style = compileThemeRules(
    file({
      x: {
        resource: 'r',
        setup: [
          { job: 'outlet', weight: 1, text: 'sacrifice a creature:', priority: 2 },
          { job: 'engine', weight: 2, text: 'engine', repeatable: true },
          { job: 'gift', weight: 1, text: 'each player draws', sizes: [100] },
        ],
        payoff: [{ job: 'drain', weight: 2, text: 'whenever [^.]*dies', priority: 1 }],
        exclude: [{ job: 'false friend', text: 'only on tuesdays' }],
        minimums: {
          '60': [
            { setup: 3, repeatable: 1, payoff: 1 },
            { setup: 5, payoff: 1 },
          ],
        },
        lacks: { setup: 'few s', repeatable: 'no r', payoff: 'few p' },
      },
    }),
  ).styles.get('x')!;
  const both = card({
    name: 'Both',
    text: 'Sacrifice a creature: Scry 1.\nWhenever another creature you control dies, each opponent loses 1 life.',
  });

  it('counts a card meeting both jobs once, for the side with the higher priority', () => {
    expect(matchCard(both, style)).toMatchObject({ as: 'setup', job: 'outlet', dual: true });
    const c = countTheme([{ card: both, qty: 3 }], style, 60);
    expect(c).toMatchObject({ setupCopies: 3, payoffCopies: 0, dualResolved: 3 });
    const friend = card({ name: 'Friend', text: 'Engine, but only on Tuesdays.' });
    expect(matchCard(friend, style)).toEqual({ as: 'excluded', job: 'false friend' });
  });

  it('applies a size-bound rule only at its sizes', () => {
    const gift = card({ name: 'Gift', text: 'When this enters, each player draws a card.' });
    expect(matchCard(gift, style, 60)).toBeUndefined();
    expect(matchCard(gift, style)).toBeUndefined();
    expect(matchCard(gift, style, 100)?.as).toBe('setup');
  });

  it('checks minimums against each alternative and reports the closest miss', () => {
    const engine = card({ name: 'Engine', text: 'Engine.' });
    const drain = card({ name: 'Drain', text: 'Whenever a creature dies, you gain 1 life.' });
    const met = countTheme(
      [
        { card: engine, qty: 1 },
        { card: both, qty: 2 },
        { card: drain, qty: 1 },
      ],
      style,
      60,
    );
    expect(met.minimums).toEqual({ size: 60, met: true, short: [] });
    // No engine: the second alternative misses on setup only, the first on two floors.
    const short = countTheme(
      [
        { card: both, qty: 2 },
        { card: drain, qty: 1 },
      ],
      style,
      60,
    );
    expect(short.minimums).toEqual({
      size: 60,
      met: false,
      short: [{ floor: 'setup', have: 2, need: 5 }],
    });
    expect(checkMinimums(short, style.minimums, 40)).toBeUndefined();
  });
});

describe('the shipped rules', () => {
  const graveyard = themeRulesFor(CONFIG).styles.get('graveyard')!;
  const job = (c: CardRecord) => {
    const m = matchCard(c, graveyard, 60);
    return m && m.as !== 'excluded' ? `${m.as} ${m.weight}` : 'neither';
  };

  it('compiles once per rules file', () => {
    expect(themeRulesFor(CONFIG)).toBe(themeRulesFor(CONFIG));
    // A config spread from another shares its rules file, so it shares the compiled rules.
    const copy: BulkBrewConfig = { ...CONFIG };
    expect(themeRulesFor(copy)).toBe(themeRulesFor(CONFIG));
    expect(themeRulesFor(clone(CONFIG))).not.toBe(themeRulesFor(CONFIG));
  });

  it('reads a looter only when a loot line is cheap', () => {
    // Made-up cards with the tags the pack gives looters.
    const tags = ['repeatable-loot', 'loot'];
    const looter = card({ name: 'Looter', tags, text: '{T}: Draw a card, then discard a card.' });
    const dear = card({
      name: 'Dear',
      tags,
      types: ['enchantment'],
      text: 'Whenever you draw a card, target opponent mills two cards.\n{5}{U}: Draw a card, then discard a card.',
    });
    const both = card({
      name: 'Both',
      tags,
      text: '{1}, {T}: Draw a card, then discard a card.\n{7}, {T}, Sacrifice this creature: Draw three cards.',
    });
    const fourMana = card({
      name: 'Four',
      tags,
      text: '{3}{U}, {T}: Draw a card, then discard a card.',
    });
    const threeMana = card({
      name: 'Three',
      tags,
      text: '{2}{U}, {T}: Draw a card, then discard a card.',
    });
    expect([looter, dear, both, fourMana, threeMana].map(job)).toEqual([
      'setup 2',
      'setup 0.5',
      'setup 2',
      'setup 0.5',
      'setup 2',
    ]);
    // Four mana in any mix of generic and colored or hybrid pips is dear; X and triggers are not.
    const loot = 'Draw a card, then discard a card.';
    const texts = [
      `{2}{U}{R}: ${loot}`,
      `{1}{U}{U}{U}: ${loot}`,
      `{3}{U/R}: ${loot}`,
      `{1}{U}{U}, {T}: ${loot}`,
      `{X}{U}, {T}: Draw X cards, then discard X cards.`,
      '{T}, Discard a card: Draw a card.',
      'Whenever you cast a noncreature spell, you may draw a card. If you do, discard a card.',
      `{5}{U}: ${loot}\n{T}: ${loot}`,
    ];
    expect(texts.map((text, i) => job(card({ name: `Cost ${i}`, tags, text })))).toEqual([
      'setup 0.5',
      'setup 0.5',
      'setup 0.5',
      'setup 2',
      'setup 2',
      'setup 2',
      'setup 2',
      'setup 2',
    ]);
  });

  it('reads Evasion payoffs from combat damage triggers, each card once', () => {
    const flyers = themeRulesFor(CONFIG).styles.get('flyers')!;
    // "both" marks a card that met a setup and a payoff job and was counted once.
    const as = (c: CardRecord) => {
      const m = matchCard(c, flyers, 60);
      return m && m.as !== 'excluded' ? `${m.as} ${m.weight}${m.dual ? ' both' : ''}` : 'neither';
    };
    const permanent = (partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord => {
      const { power: _p, toughness: _t, ...rest } = card(partial);
      return rest;
    };
    // Text, keywords, and power as the pack gives them.
    const cards = [
      card({ name: 'Wind Drake', keywords: ['Flying'], text: 'Flying' }),
      // Its own trigger pays off only its own body, so it stays an evasive attacker.
      card({
        name: 'Nightveil Specter',
        keywords: ['Flying'],
        text: 'Flying\nWhenever this creature deals combat damage to a player, that player exiles the top card of their library.\nYou may play lands and cast spells from among cards exiled with this creature.',
      }),
      card({
        name: 'Shadowmage Infiltrator',
        keywords: ['Fear'],
        power: '1',
        text: "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\nWhenever this creature deals combat damage to a player, you may draw a card.",
      }),
      card({
        name: 'Thieving Magpie',
        keywords: ['Flying'],
        power: '1',
        text: "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever this creature deals damage to an opponent, draw a card.",
      }),
      card({
        name: 'Gregor, Shrewd Magistrate',
        keywords: ['Skulk'],
        power: '1',
        text: "Skulk (This creature can't be blocked by creatures with greater power.)\nWhenever Gregor, Shrewd Magistrate deals combat damage to a player, draw cards equal to its power.",
      }),
      card({
        name: "Suq'Ata Assassin",
        keywords: ['Fear'],
        power: '1',
        text: "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\nWhenever this creature attacks and isn't blocked, defending player gets a poison counter. (A player with ten or more poison counters loses the game.)",
      }),
      permanent({
        name: 'Coastal Piracy',
        types: ['enchantment'],
        typeLine: 'Enchantment',
        text: 'Whenever a creature you control deals combat damage to an opponent, you may draw a card.',
      }),
      card({
        name: 'Rapacious Guest',
        keywords: ['Food', 'Menace'],
        text: 'Menace\nWhenever one or more creatures you control deal combat damage to a player, create a Food token.\nWhenever you sacrifice a Food, put a +1/+1 counter on this creature.\nWhen this creature leaves the battlefield, target opponent loses life equal to its power.',
      }),
      // Paid by counters, by Faeries, or only on what an Aura or Equipment is on.
      card({
        name: 'Yathan Tombguard',
        keywords: ['Menace'],
        text: "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever a creature you control with a counter on it deals combat damage to a player, you draw a card and you lose 1 life.",
      }),
      card({
        name: 'Faerie Bladecrafter',
        keywords: ['Flying'],
        text: 'Flying\nWhenever one or more Faeries you control deal combat damage to a player, put a +1/+1 counter on this creature.\nWhen this creature dies, each opponent loses X life and you gain X life, where X is its power.',
      }),
      permanent({
        name: 'Curious Obsession',
        types: ['enchantment'],
        typeLine: 'Enchantment — Aura',
        keywords: ['Enchant'],
        text: 'Enchant creature\nEnchanted creature gets +1/+1 and has "Whenever this creature deals combat damage to a player, you may draw a card."\nAt the beginning of your end step, if you didn\'t attack with a creature this turn, sacrifice this Aura.',
      }),
      permanent({
        name: 'Zephyr Boots',
        types: ['artifact'],
        typeLine: 'Artifact — Equipment',
        keywords: ['Equip'],
        tags: ['gives-flying'],
        text: 'Equipped creature has flying.\nWhenever equipped creature deals combat damage to a player, draw a card, then discard a card.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)',
      }),
      // Not evasive, or only for one turn.
      card({
        name: 'Thieving Otter',
        text: 'Whenever this creature deals damage to an opponent, draw a card.',
      }),
      permanent({
        name: "Predators' Hour",
        types: ['sorcery'],
        typeLine: 'Sorcery',
        text: 'Until end of turn, creatures you control gain menace and "Whenever this creature deals combat damage to a player, exile the top card of that player\'s library face down. You may look at and play that card for as long as it remains exiled, and you may spend mana as though it were mana of any color to cast that spell."',
      }),
    ];
    expect(Object.fromEntries(cards.map((c) => [c.name, as(c)]))).toEqual({
      'Wind Drake': 'setup 2',
      'Nightveil Specter': 'setup 2 both',
      'Shadowmage Infiltrator': 'setup 1 both',
      'Thieving Magpie': 'setup 1 both',
      'Gregor, Shrewd Magistrate': 'setup 1 both',
      "Suq'Ata Assassin": 'setup 1 both',
      // A team trigger pays off the rest, so it is a payoff even on an evasive body.
      'Coastal Piracy': 'payoff 2',
      'Rapacious Guest': 'payoff 2 both',
      'Yathan Tombguard': 'setup 2',
      'Faerie Bladecrafter': 'setup 2',
      'Curious Obsession': 'neither',
      'Zephyr Boots': 'setup 1',
      'Thieving Otter': 'neither',
      "Predators' Hour": 'neither',
    });
  });

  it('marks the styles whose setup needs their own payoffs, and their kin', () => {
    const rules = themeRulesFor(CONFIG);
    const needs = [...rules.styles.values()].filter((s) => s.setupNeedsPayoff).map((s) => s.id);
    expect(needs.sort()).toEqual(['energy', 'groupHug', 'mill']);
    expect(rules.styles.get('aristocrats')!.kin).toEqual(['tokens', 'graveyard']);
    expect(rules.styles.get('mill')!.kin).toEqual([]);
  });
});

describe('theme rules and the bulk baseline in the config', () => {
  it('validates with the rules and the baseline, and without the baseline', () => {
    expect(CONFIG.themeBulk).toBeDefined();
    expect(CONFIG.themeBulk!.rulesVersion).toBe(CONFIG.themeRules.version);
    expect(validateConfig(CONFIG)).toEqual([]);
    const { themeBulk: _bulk, ...bare } = CONFIG;
    expect(validateConfig(bare)).toEqual([]);
    expect(configVersion(CONFIG)).toContain(
      `.k${CONFIG.cardStrength.version}.h${CONFIG.themeRules.version}.q${CONFIG.themeBulk!.version}.`,
    );
    expect(configVersion(bare)).not.toContain('.q');
  });

  it('rejects a baseline computed for other rules, or with a hole', () => {
    const stale = clone(CONFIG);
    stale.themeRules.version = 'next';
    expect(validateConfig(stale)).toEqual([
      `themeBulk: computed for theme rules version "${CONFIG.themeRules.version}", but the rules are version "next": run npm run theme:bulk`,
    ]);
    const holes = clone(CONFIG);
    delete (holes.themeBulk!.styles.graveyard as Partial<Record<string, unknown>>).M;
    holes.themeBulk!.styles.tokens!.W.payoffUnits = -1;
    expect(validateConfig(holes)).toEqual([
      'themeBulk: styles.tokens.W.payoffUnits: must be a number of 0 or more',
      'themeBulk: styles.graveyard.M: missing',
    ]);
  });

  it('needs rules for every themed style and no others', () => {
    const c = clone(CONFIG);
    delete c.themeRules.styles.goad;
    c.themeRules.styles.dragons = clone(c.themeRules.styles.tokens!);
    c.themeRules.styles.tokens!.lacks = {};
    const problems = validateConfig(c);
    expect(problems).toContain('themeRules: no rules for the themed style "goad"');
    expect(problems).toContain(
      'themeRules.styles.dragons: not a synergy archetype in archetypes.json',
    );
    expect(problems).toContain(
      'themeRules: styles.tokens.lacks: give a phrase for the floor "setup" the minimums use',
    );
  });
});
