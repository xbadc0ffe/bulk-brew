import { describe, expect, it } from 'vitest';
import { BuildError, buildDeck } from '../src/builder.ts';
import { factsFor, listCandidates } from '../src/candidates.ts';
import { commitDeck } from '../src/decks.ts';
import { deckToDecklist } from '../src/export.ts';
import { growBuilds, growViability } from '../src/grow.ts';
import { CardIndex } from '../src/pack.ts';
import { scanPool } from '../src/scan.ts';
import { countTheme, matchCard, themeRulesFor, type ThemeFloor } from '../src/theme-rules.ts';
import type { BuildRequest, BuildResult, CardRecord, Deck, DeckSize, Pool } from '../src/types.ts';
import { bigPool, PACK, SETTINGS } from './builder-fixtures.ts';
import { CONFIG } from './config.test.ts';

// A made-up blue pack whose oracle text the shipped Graveyard, Aristocrats,
// and Mill rules read as people would: looters, self-mill, reanimation, a
// removal spell with a surveil rider, a card that does both jobs, sacrifice
// outlets and fodder, and opponent mill.

let n = 0;
function card(
  partial: Partial<CardRecord> & Pick<CardRecord, 'name'> & { noStats?: boolean },
): CardRecord {
  n++;
  const { noStats, ...rest } = partial;
  const out: CardRecord = {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    manaCost: '{1}{U}',
    typeLine: 'Creature — Human',
    text: '',
    colors: ['U'],
    identity: ['U'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    power: '2',
    toughness: '2',
    ...rest,
  };
  if (noStats) {
    delete out.power;
    delete out.toughness;
  }
  return out;
}

const spell = (
  name: string,
  mv: number,
  tags: string[],
  text: string,
  type: 'Sorcery' | 'Instant' = 'Sorcery',
  rank?: number,
) =>
  card({
    name,
    mv,
    manaCost: `{${mv - 1}}{U}`,
    typeLine: type,
    types: [type === 'Sorcery' ? 'sorcery' : 'instant'],
    noStats: true,
    tags,
    text,
    ...(rank ? { rank } : {}),
  });

const LOOT = '{T}: Draw a card, then discard a card.';
const REANIMATE = 'Return target creature card from your graveyard to the battlefield.';

interface FakeOptions {
  /** Looter cards (repeatable setup, weight 2). */
  looters?: number;
  /** Copies of each looter in the pool. */
  looterCopies?: number;
  /** One-shot self-mill sorceries (setup, weight 1). */
  mill?: number;
  /** Reanimation spells (payoff, weight 1). */
  payoffs?: number;
  /** The card that is both setup and payoff. */
  dual?: boolean;
  /** Sacrifice outlets, fodder, and death payoffs for Aristocrats. */
  aristocrats?: boolean;
  /** Opponent mill: a Ruin Crab, tap millers, one-shots, and with `millPayoffs` a payoff. */
  millOpponent?: boolean;
  millPayoffs?: boolean;
  /** Vanilla creatures per mana value 1 to 6. */
  creatures?: number;
  /** Copies of every other card. */
  copies?: number;
}

function fakePool(o: FakeOptions = {}) {
  const copies = o.copies ?? 4;
  const cards: { card: CardRecord; qty: number }[] = [];
  const put = (c: CardRecord, qty = copies) => {
    cards.push({ card: c, qty });
    return c;
  };
  const looters = Array.from({ length: o.looters ?? 2 }, (_, i) =>
    put(
      card({ name: `Looter ${i}`, tags: ['repeatable-loot', 'loot'], text: LOOT }),
      o.looterCopies ?? copies,
    ),
  );
  const mills = Array.from({ length: o.mill ?? 3 }, (_, i) =>
    put(spell(`Mill Spell ${i}`, 2, ['mill-self'], 'Mill three cards.')),
  );
  // Popular cards are strong: the first payoff is the best.
  const payoffs = Array.from({ length: o.payoffs ?? 4 }, (_, i) =>
    put(spell(`Reanimate ${i}`, 3, ['reanimate-creature'], REANIMATE, 'Sorcery', 100 + i * 2000)),
  );
  const rider = put(
    spell(
      'Surveil Removal',
      2,
      ['mill-self', 'removal-creature', 'removal', 'spot-removal'],
      'Destroy target creature.\nSurveil 1.',
      'Instant',
    ),
  );
  const dual =
    o.dual === false
      ? undefined
      : put(
          spell(
            'Dual Spell',
            4,
            ['mill-self', 'reanimate-creature'],
            'Mill three cards, then return up to one target creature card from your graveyard to the battlefield.',
          ),
        );
  if (o.aristocrats) {
    put(card({ name: 'Altar Imp', text: 'Sacrifice another creature: Draw a card.' }));
    for (let i = 0; i < 2; i++)
      put(card({ name: `Dying Wisp ${i}`, mv: 1, text: 'When this creature dies, draw a card.' }));
    for (let i = 0; i < 2; i++)
      put(
        card({
          name: `Drain Ghost ${i}`,
          mv: 3,
          text: 'Whenever another creature you control dies, each opponent loses 1 life.',
        }),
      );
  }
  let crab: CardRecord | undefined;
  if (o.millOpponent) {
    // Ruin Crab: cheap, popular, and useless without a reason to mill the opponent.
    crab = put(
      card({
        name: 'Shore Crab',
        mv: 1,
        manaCost: '{U}',
        power: '0',
        toughness: '3',
        tags: ['mill-opponent'],
        text: 'Whenever a land you control enters, each opponent mills three cards.',
        rank: 50,
      }),
    );
    put(
      card({
        name: 'Tide Miller',
        tags: ['mill-opponent'],
        text: '{T}: Each opponent mills two cards.',
      }),
    );
    put(spell('Brain Flood', 2, ['mill-opponent'], 'Each opponent mills four cards.'));
    if (o.millPayoffs)
      put(
        card({
          name: 'Archive Ghoul',
          mv: 3,
          tags: ['synergy-mill'],
          text: "This creature gets +1/+1 for each card in your opponents' graveyards.",
        }),
      );
  }
  for (let i = 0; i < 6; i++) {
    put(
      spell(
        `Removal ${i}`,
        2,
        ['removal-creature', 'removal', 'spot-removal'],
        'Destroy target creature.',
        'Instant',
      ),
    );
    put(spell(`Draw ${i}`, 3, ['pure-draw', 'draw'], 'Draw two cards.'));
  }
  for (let mv = 1; mv <= 6; mv++)
    for (let i = 0; i < (o.creatures ?? 5); i++)
      put(
        card({
          name: `Creature ${mv}-${i}`,
          mv,
          manaCost: `{${mv - 1}}{U}`,
          power: String(mv),
          toughness: String(mv),
        }),
      );
  put(
    card({
      name: 'Island',
      mv: 0,
      manaCost: '',
      typeLine: 'Basic Land — Island',
      types: ['land'],
      colors: [],
      noStats: true,
      text: '({T}: Add {U}.)',
    }),
  );
  return pack(cards, { looters, mills, payoffs, rider, dual, crab });
}

function pack<T>(cards: { card: CardRecord; qty: number }[], extra: T) {
  const index = new CardIndex({
    schema: 2,
    version: 'test',
    builtAt: 'test',
    cardCount: cards.length,
    cards: cards.map((c) => c.card),
  });
  const pool: Pool = { entries: {}, updatedAt: 'test' };
  for (const c of cards) pool.entries[c.card.id] = { cardId: c.card.id, qty: c.qty };
  return { index, pool, ...extra };
}

type Fake = { index: CardIndex; pool: Pool };

function request(size: DeckSize, style?: string, more: Partial<BuildRequest> = {}): BuildRequest {
  return {
    size,
    colors: ['U'],
    settings: SETTINGS,
    id: 'test',
    createdAt: 'test',
    ...(style ? { style, requireStyle: true } : {}),
    ...more,
  };
}

function build(f: Fake, style?: string, size: DeckSize = 60, more: Partial<BuildRequest> = {}) {
  return buildDeck(request(size, style, more), f.pool, f.index, CONFIG);
}

function total(deck: Deck): number {
  return (
    deck.cards.reduce((k, c) => k + c.qty, 0) +
    Object.values(deck.basics).reduce((k, q) => k + (q ?? 0), 0)
  );
}

function copiesOf(deck: Deck, id: string | undefined): number {
  return deck.cards.find((c) => c.cardId === id)?.qty ?? 0;
}

const RULES = themeRulesFor(CONFIG);

/** The deck's spells (commander left out) counted by the shipped rules. */
function themeCount(r: BuildResult, index: CardIndex, style: string, size: DeckSize = 60) {
  return countTheme(
    r.deck.cards
      .filter((c) => c.cardId !== r.deck.commander)
      .map((c) => ({ card: index.get(c.cardId)!, qty: c.qty })),
    RULES.styles.get(style)!,
    size as 60,
  );
}

function floorAt(style: string, size: DeckSize): ThemeFloor {
  const m = RULES.styles.get(style)!.minimums![`${size as 60}`]!;
  return Array.isArray(m) ? m[0]! : m;
}

describe('grow builder: a requested theme', () => {
  it('meets every floor of the shipped Graveyard rules, every payoff covered, legal and exact', () => {
    const f = fakePool();
    const r = build(f, 'graveyard');
    expect(r.explanation.builder).toBe('grow');
    expect(r.deck.archetype).toBe('graveyard');
    expect(r.deck.name).toBe('Blue Graveyard 60');
    expect(total(r.deck)).toBe(60);
    for (const c of r.deck.cards) expect(c.qty).toBeLessThanOrEqual(4);
    const floor = floorAt('graveyard', 60);
    const t = themeCount(r, f.index, 'graveyard');
    expect(t.setupWeighted).toBeGreaterThanOrEqual(floor.setupWeight!);
    expect(t.repeatableSetupCopies).toBeGreaterThanOrEqual(floor.repeatable!);
    expect(t.payoffWeighted).toBeGreaterThanOrEqual(floor.payoffWeight!);
    // Every payoff covered: setup weight at least the floors' ratio times payoff weight.
    const ratio = floor.setupWeight! / floor.payoffWeight!;
    expect(t.setupWeighted + 1e-9).toBeGreaterThanOrEqual(ratio * t.payoffWeighted);
    expect(r.explanation.notes[0]).toBe('Built Graveyard as asked.');
    expect(r.explanation.notes[1]).toMatch(/^Graveyard minimums met: setup weight /);
    expect(r.deck.cards.some((c) => c.why?.startsWith('Payoff: reanimation'))).toBe(true);
    expect(r.deck.cards.some((c) => c.why?.startsWith('Setup: looter'))).toBe(true);
  });

  it('counts a card meeting both jobs once and never a rider as setup', () => {
    const f = fakePool();
    const style = RULES.styles.get('graveyard')!;
    const dual = matchCard(f.dual!, style, 60);
    expect(dual).toMatchObject({ dual: true });
    expect(matchCard(f.rider, style, 60)).toBeUndefined();
    const r = build(f, 'graveyard');
    const t = themeCount(r, f.index, 'graveyard');
    const onSetup = t.setup.some((l) => l.name === 'Dual Spell');
    const onPayoff = t.payoff.some((l) => l.name === 'Dual Spell');
    expect(onSetup && onPayoff).toBe(false);
    expect(t.setup.some((l) => l.name === 'Surveil Removal')).toBe(false);
    const rider = r.deck.cards.find((c) => c.cardId === f.rider.id);
    if (rider) expect(rider.why).not.toMatch(/^Setup/);
  });

  it('keeps payoffs the setup cannot cover out of the deck', () => {
    // One looter card (8 setup weight) against 32 payoff weight in the pool.
    const f = fakePool({ looters: 1, mill: 0, dual: false, payoffs: 8 });
    const r = build(f, 'graveyard');
    expect(r.deck.archetype).toBe('graveyard');
    const t = themeCount(r, f.index, 'graveyard');
    const floor = floorAt('graveyard', 60);
    expect(t.setupWeighted + 1e-9).toBeGreaterThanOrEqual(
      (floor.setupWeight! / floor.payoffWeight!) * t.payoffWeighted,
    );
    expect(t.payoffCopies).toBeLessThan(32);
    // A plain deck from a pool with no graveyard setup carries no reanimation.
    const bare = fakePool({ looters: 0, mill: 0, dual: false, payoffs: 8 });
    const plain = build(bare, 'midrange');
    expect(plain.deck.archetype).toBe('midrange');
    for (const p of bare.payoffs) expect(copiesOf(plain.deck, p.id)).toBe(0);
  });

  it('keeps opponent mill out of decks without a Mill payoff, and lets it into Mill', () => {
    const f = fakePool({ millOpponent: true, millPayoffs: true });
    expect(copiesOf(build(f, 'graveyard').deck, f.crab!.id)).toBe(0);
    const plain = fakePool({ millOpponent: true });
    expect(copiesOf(build(plain, 'midrange').deck, plain.crab!.id)).toBe(0);
    expect(copiesOf(build(plain, 'aggro').deck, plain.crab!.id)).toBe(0);
    const mill = build(f, 'mill');
    expect(mill.deck.archetype).toBe('mill');
    expect(copiesOf(mill.deck, f.crab!.id)).toBeGreaterThan(0);
  });

  it('builds the same deck twice, with no clock or random values in it', () => {
    const f = fakePool({ aristocrats: true });
    const a = build(f, 'graveyard');
    expect(build(f, 'graveyard')).toEqual(a);
    expect(JSON.stringify(a)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(a.deck.createdAt).toBe('test');
  });

  it('passes the final checks and commits and exports like any deck', () => {
    const f = fakePool();
    const r = build(f, 'graveyard');
    const committed = commitDeck(f.pool, r.deck, SETTINGS, f.index, CONFIG, 'now');
    expect(committed.deck.committed).toBe(true);
    const text = deckToDecklist(r.deck, f.index, CONFIG);
    const counted = text
      .split('\n')
      .filter((l) => /^\d+ /.test(l))
      .reduce((k, l) => k + Number(l.split(' ')[0]), 0);
    expect(counted).toBe(60);
    expect(r.explanation.score!.total).toBeGreaterThan(0);
    expect(r.explanation.curve).toHaveLength(8);
    expect(r.explanation.notes.at(-1)).toMatch(/^25 lands|^\d+ lands: average cost/);
    expect(r.deck.learnedVersion).toBeUndefined();
  });
});

describe('grow builder: the nearest rule', () => {
  // One looter copy: 1 of 2 repeatable setup, so Graveyard is short.
  const short = { looters: 1, looterCopies: 1 };

  it('builds the nearest kin the pool supports, named for what it is', () => {
    const f = fakePool({ ...short, aristocrats: true });
    // Asked for by the player: answered, never refused.
    const r = build(f, 'graveyard');
    expect(r.explanation.builder).toBe('grow');
    expect(r.deck.archetype).toBe('aristocrats');
    expect(r.deck.name).toBe('Blue Aristocrats 60');
    expect(r.explanation.nearest).toEqual({
      requested: 'graveyard',
      lacks: 'no repeatable way to fill the graveyard (1 of 2)',
    });
    expect(r.explanation.notes[0]).toBe(
      'Asked for Graveyard: your bulk list has no repeatable way to fill the graveyard (1 of 2). Built Aristocrats instead.',
    );
    expect(r.explanation.notes[1]).toMatch(/^Aristocrats minimums met: /);
    expect(total(r.deck)).toBe(60);
    // A style picked internally keeps the classic path and its own fallback.
    const internal = build(f, 'graveyard', 60, { requireStyle: false });
    expect(internal.explanation.builder).toBe('classic');
    expect(internal.explanation.nearest).toBeUndefined();
  });

  it('falls back to the classic best fit with the note when no kin can be built', () => {
    // Aristocrats' kin are Tokens (none here) and Graveyard (short).
    const f = fakePool(short);
    const r = build(f, 'aristocrats');
    expect(r.explanation.builder).toBe('classic');
    expect(r.deck.archetype).not.toBe('aristocrats');
    expect(r.explanation.nearest?.requested).toBe('aristocrats');
    expect(r.explanation.nearest?.lacks).toContain(
      'few creatures to sacrifice and ways to sacrifice them',
    );
    expect(r.explanation.notes[0]).toMatch(
      /^Asked for Aristocrats: your bulk list has few creatures .* instead, the best fit for this bulk list\.$/,
    );
    expect(r.deck.explanation).toBe(r.explanation);
    expect(total(r.deck)).toBe(60);
  });

  it('never answers with a best fit that carries the asked-for name', () => {
    // Today's matchers read this pool as Graveyard; the rules find it short, so a plain shape answers.
    const f = fakePool(short);
    const r = build(f, 'graveyard');
    expect(r.explanation.builder).toBe('grow');
    expect(['midrange', 'aggro', 'control']).toContain(r.deck.archetype);
    expect(r.explanation.nearest?.lacks).toBe('no repeatable way to fill the graveyard (1 of 2)');
    expect(r.explanation.notes[0]).toMatch(
      /^Asked for Graveyard: .* Built (Midrange|Aggro|Control) instead\.$/,
    );
  });
});

describe('grow builder: plain shapes', () => {
  const index = new CardIndex(PACK);
  const shape = (style: string) =>
    buildDeck(
      { size: 60, colors: ['W'], settings: SETTINGS, style, requireStyle: true },
      bigPool(),
      index,
      CONFIG,
    );

  it('builds Aggro by name as an aggro deck', () => {
    const aggro = shape('aggro');
    const control = shape('control');
    expect(aggro.explanation.builder).toBe('grow');
    expect(aggro.deck.archetype).toBe('aggro');
    expect(aggro.deck.name).toBe('White Aggro 60');
    const min = CONFIG.archetypes.archetypes.find((a) => a.id === 'aggro')!.roleOverrides!['60']
      .earlyCreature!.min;
    expect(aggro.explanation.roles['earlyCreature']!.have).toBeGreaterThanOrEqual(min);
    expect(aggro.explanation.lands.averageMv).toBeLessThan(control.explanation.lands.averageMv);
    expect(total(aggro.deck)).toBe(60);
  });
});

describe('grow builder: the commander counts once', () => {
  // A commander that reanimates is a Graveyard payoff of weight 1.
  const lead = card({
    name: 'Grave Captain, the Returned',
    mv: 4,
    manaCost: '{3}{U}',
    typeLine: 'Legendary Creature — Zombie Wizard',
    tags: ['reanimate-creature'],
    text: 'Whenever this creature attacks, return target creature card from your graveyard to the battlefield.',
  });

  function singleton(payoffs: number) {
    const f = fakePool({ looters: 8, payoffs, mill: 0, dual: false, creatures: 6, copies: 1 });
    const cards = [...Object.values(f.pool.entries)].map((e) => ({
      card: f.index.get(e.cardId)!,
      qty: e.cardId === f.index.find('Island')!.id ? 40 : 1,
    }));
    return pack([...cards, { card: lead, qty: 1 }], { payoffs: f.payoffs });
  }

  it('credits its job once in the pool tally', () => {
    const f = singleton(8);
    const cands = listCandidates(f.pool, f.index, CONFIG, SETTINGS, ['U'], 100).filter(
      (c) => c.facts.card.id !== lead.id,
    );
    const without = growViability(cands, CONFIG, 100).graveyard!;
    const withLead = growViability(cands, CONFIG, 100, factsFor(f.index, CONFIG, lead)).graveyard!;
    const payoff = (v: typeof without) => v.short.find((s) => s.floor === 'payoffWeight')!.have;
    expect(payoff(without)).toBe(8);
    expect(payoff(withLead)).toBe(9);
    expect(withLead.viable).toBe(false);
  });

  it('credits it once in the deck it builds', () => {
    const f = singleton(12);
    const r = buildDeck(
      { ...request(100, 'graveyard'), colors: [], commander: lead.id },
      f.pool,
      f.index,
      CONFIG,
    );
    expect(r.explanation.builder).toBe('grow');
    expect(r.deck.archetype).toBe('graveyard');
    expect(r.deck.name).toBe('Grave Captain Graveyard 100');
    expect(r.deck.cards[0]).toMatchObject({ cardId: lead.id, why: 'Commander' });
    expect(total(r.deck)).toBe(100);
    const spells = themeCount(r, f.index, 'graveyard', 100).payoffWeighted;
    const noted = /payoff weight ([\d.]+) of/.exec(r.explanation.notes[1]!)?.[1];
    expect(Number(noted)).toBe(spells + 1);
  });
});

describe('grow builder: routing', () => {
  const index = new CardIndex(PACK);
  const run = (req: Partial<BuildRequest>) =>
    buildDeck(
      { size: 60, colors: ['W'], settings: SETTINGS, ...req } as BuildRequest,
      bigPool(),
      index,
      CONFIG,
    );

  it('takes only styles the player asked for at 60, 40, and 100 without a secondary or a tribe', () => {
    expect(run({ style: 'tokens', requireStyle: true }).explanation.builder).toBe('grow');
    expect(run({ style: 'tokens', requireStyle: true, size: 40 }).explanation.builder).toBe('grow');
    expect(run({}).explanation.builder).toBe('classic');
    expect(run({ style: 'tokens' }).explanation.builder).toBe('classic');
    expect(run({ style: 'tokens', requireStyle: true, size: 20 }).explanation.builder).toBe(
      'classic',
    );
    expect(
      run({ style: 'tokens', secondary: 'aggro', requireStyle: true }).explanation.builder,
    ).toBe('classic');
    const tribe: Partial<BuildRequest> = { style: 'tribal:Human', requireStyle: true };
    expect(growBuilds({ size: 60, colors: ['W'], settings: SETTINGS, ...tribe }, CONFIG)).toBe(
      false,
    );
    // The classic path declines a tribe outside Commander, as before.
    expect(() => run(tribe)).toThrow(BuildError);
  });
});

describe('growViability and the scan', () => {
  const at = (o: FakeOptions, size: DeckSize = 60) => {
    const f = fakePool(o);
    return listCandidates(f.pool, f.index, CONFIG, SETTINGS, ['U'], size);
  };

  it('tells viable, short, and out apart with the phrase for the floor missed most', () => {
    const near = CONFIG.builderWeights.grow.nearMargin;
    const viable = growViability(at({}), CONFIG, 60).graveyard!;
    expect(viable).toMatchObject({ viable: true, short: [], lacks: '' });
    expect(viable.margin).toBeGreaterThanOrEqual(1);

    const short = growViability(at({ looters: 1, looterCopies: 1 }), CONFIG, 60).graveyard!;
    expect(short.viable).toBe(false);
    expect(short.margin).toBeGreaterThanOrEqual(near);
    expect(short.margin).toBeLessThan(1);
    expect(short.short).toEqual([{ floor: 'repeatable', have: 1, need: 2 }]);
    expect(short.lacks).toBe('no repeatable way to fill the graveyard (1 of 2)');

    const out = growViability(at({ looters: 0, mill: 0, dual: false }), CONFIG, 60).graveyard!;
    expect(out.viable).toBe(false);
    expect(out.margin).toBeLessThan(near);
    expect(out.lacks).toBe('few cards that fill your graveyard (0 of 8)');
  });

  it('reports the rules on synergy styles at 60, 40, and 100 but not at 20', () => {
    const f = fakePool();
    for (const size of [60, 40] as const) {
      const scan = scanPool(f.pool, f.index, CONFIG, SETTINGS, size, ['U']);
      const gy = scan.archetypes.find((a) => a.archetype === 'graveyard')!;
      expect(gy.rules).toMatchObject({ viable: true, lacks: '' });
      expect(scan.archetypes.find((a) => a.archetype === 'midrange')!.rules).toBeUndefined();
    }
    const twenty = scanPool(f.pool, f.index, CONFIG, SETTINGS, 20, ['U']);
    expect(twenty.archetypes.every((a) => a.rules === undefined)).toBe(true);
  });
});
