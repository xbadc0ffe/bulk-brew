import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CardRecord } from '@bulk-brew/core';
import { findCard, loadReviewContext, ROOT } from '../src/review/card-facts.ts';
import {
  checkMinimums,
  compileThemeRules,
  countTheme,
  loadThemeRules,
  matchCard,
  nearestThemeSize,
  type ThemeRulesFile,
  type ThemeStyleRules,
} from '../src/review/theme-rules.ts';

let n = 0;
function card(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  n++;
  return {
    id: `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`,
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Bird',
    text: '',
    colors: ['U'],
    identity: ['U'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{U}',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

/** A noncreature card: no power or toughness. */
function noBody(partial: Partial<CardRecord> & Pick<CardRecord, 'name'>): CardRecord {
  const c = card(partial);
  delete c.power;
  delete c.toughness;
  return c;
}

function style(s: ThemeStyleRules) {
  return compileThemeRules({ version: 't', styles: { x: s } } satisfies ThemeRulesFile).styles.get(
    'x',
  )!;
}

describe('theme rule conditions', () => {
  it('reads tags, types, type line, mana value, power, and keywords', () => {
    const st = style({
      resource: 'r',
      setup: [
        {
          job: 'evasive attacker',
          weight: 2,
          types: ['creature'],
          keywords: ['Flying'],
          notKeywords: ['Defender'],
          minPower: 2,
          maxMv: 4,
        },
        { job: 'equipment', weight: 2, typeLine: '\\bEquipment\\b', notTags: ['shroud'] },
      ],
      payoff: [
        { job: 'small body', weight: 1, types: ['creature'], maxPower: 1, notTypes: ['land'] },
      ],
    });
    const drake = card({ name: 'Drake', keywords: ['Flying'] });
    expect(matchCard(drake, st)).toMatchObject({ as: 'setup', job: 'evasive attacker' });
    // Variable power passes a minimum and fails a maximum.
    const star = card({ name: 'Star', keywords: ['Flying'], power: '*' });
    expect(matchCard(star, st)?.as).toBe('setup');
    expect(matchCard(card({ name: 'Wall', keywords: ['Flying', 'Defender'] }), st)).toBeUndefined();
    expect(matchCard(card({ name: 'Big', keywords: ['flying'], mv: 5 }), st)).toBeUndefined();
    expect(matchCard(card({ name: 'Mite', keywords: ['Flying'], power: '1' }), st)).toMatchObject({
      as: 'payoff',
      job: 'small body',
    });
    const sword = noBody({ name: 'Sword', typeLine: 'Artifact — Equipment', types: ['artifact'] });
    expect(matchCard(sword, st)?.as).toBe('setup');
    expect(matchCard({ ...sword, tags: ['shroud'] }, st)).toBeUndefined();
    // A card without power fails a power condition.
    expect(matchCard(noBody({ name: 'Rock', types: ['artifact'] }), st)).toBeUndefined();
  });

  it('applies a rule with sizes only at those sizes', () => {
    const st = style({
      resource: 'r',
      setup: [{ job: 'land gift', weight: 1, text: 'each player may search', sizes: [100] }],
      payoff: [{ job: 'p', weight: 1, text: 'whenever an opponent draws' }],
    });
    const gift = card({ name: 'Gift', text: 'When this enters, each player may search.' });
    expect(matchCard(gift, st)).toBeUndefined();
    expect(matchCard(gift, st, 60)).toBeUndefined();
    expect(matchCard(gift, st, 100)?.as).toBe('setup');
    // countTheme reads the size from the copies when none is given.
    expect(countTheme([{ card: gift, qty: 100 }], st).setupCopies).toBe(100);
    expect(countTheme([{ card: gift, qty: 60 }], st).setupCopies).toBe(0);
    expect(countTheme([{ card: gift, qty: 60 }], st, 100).size).toBe(100);
  });

  it('lets priority decide a card meeting both jobs before weight does', () => {
    const st = style({
      resource: 'r',
      setup: [{ job: 'outlet', weight: 1, text: 'sacrifice a creature:', priority: 2 }],
      payoff: [{ job: 'drain', weight: 2, text: 'whenever [^.]*dies', priority: 1 }],
    });
    const both = card({
      name: 'Both',
      text: 'Sacrifice a creature: Scry 1.\nWhenever another creature you control dies, each opponent loses 1 life.',
    });
    expect(matchCard(both, st)).toMatchObject({ as: 'setup', job: 'outlet', dual: true });
  });

  it('rejects bad conditions, sizes, and floors with every problem named', () => {
    expect(() =>
      compileThemeRules({
        version: '1',
        styles: {
          x: {
            resource: 'r',
            setup: [
              { job: 's', weight: 1, types: ['wizard'] },
              { job: 't', weight: 1, text: 'x', sizes: [30], minMv: '2' },
              { job: 'u', weight: 1, notTags: ['a'] },
            ],
            payoff: [{ job: 'p', weight: 1, typeLine: '(' }],
            minimums: { '60': { setup: 2, payoffs: 1 }, '50': { setup: 1 }, '40': [] },
          },
        },
      }),
    ).toThrow(
      /types.*must be a non-empty list of creature[\s\S]*minMv[\s\S]*sizes[\s\S]*give at least one of[\s\S]*typeLine: bad regular expression[\s\S]*give at least one set of floors[\s\S]*the size must be one of[\s\S]*unknown floor "payoffs"/,
    );
  });
});

describe('theme minimums', () => {
  const st = style({
    resource: 'r',
    setup: [
      { job: 'engine', weight: 2, text: 'engine', repeatable: true },
      { job: 'half', weight: 0.5, text: 'half' },
    ],
    payoff: [{ job: 'pay', weight: 1, text: 'payoff' }],
    minimums: {
      '60': [
        { setup: 4, repeatable: 2, payoff: 2 },
        { setup: 6, payoff: 2 },
      ],
      '40': { setupWeight: 5, repeatableOrPayoff: 4 },
    },
  });
  const engine = card({ name: 'Engine', text: 'engine' });
  const half = card({ name: 'Half', text: 'half' });
  const pay = card({ name: 'Pay', text: 'payoff' });

  it('counts units with weight capped at 1, so a half job counts half', () => {
    const c = countTheme(
      [
        { card: engine, qty: 1 },
        { card: half, qty: 4 },
        { card: pay, qty: 2 },
      ],
      st,
      60,
    );
    expect(c).toMatchObject({ setupCopies: 5, setupWeighted: 4, setupUnits: 3, payoffUnits: 2 });
    // The second alternative misses one floor, the first two: the report names the closer one.
    expect(c.minimums).toEqual({
      size: 60,
      met: false,
      short: [{ floor: 'setup', have: 3, need: 6 }],
    });
  });

  it('passes on any one alternative and reads each floor', () => {
    const c = countTheme(
      [
        { card: engine, qty: 2 },
        { card: half, qty: 4 },
        { card: pay, qty: 2 },
      ],
      st,
      60,
    );
    expect(c.minimums).toEqual({ size: 60, met: true, short: [] });
    const at40 = countTheme(
      [
        { card: engine, qty: 2 },
        { card: pay, qty: 1 },
      ],
      st,
      40,
    );
    expect(at40.minimums).toEqual({
      size: 40,
      met: false,
      short: [
        { floor: 'setupWeight', have: 4, need: 5 },
        { floor: 'repeatableOrPayoff', have: 3, need: 4 },
      ],
    });
    expect(checkMinimums(at40, st.minimums, 20)).toBeUndefined();
    expect(countTheme([{ card: pay, qty: 1 }], st, 100).minimums).toBeUndefined();
  });

  it('reads the nearest deck size from a copy count', () => {
    expect([18, 41, 45, 52, 61, 80, 99].map(nearestThemeSize)).toEqual([
      20, 40, 40, 60, 60, 100, 100,
    ]);
  });
});

describe('the theme rules file', () => {
  const rules = loadThemeRules();
  const archetypes = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'archetypes.json'), 'utf8'),
  ) as { archetypes: { id: string; kind: string }[] };
  const themed = archetypes.archetypes.filter((a) => a.kind === 'synergy').map((a) => a.id);

  it('covers every themed style with minimums at every size, and no plain shape', () => {
    expect(rules).not.toBeNull();
    expect([...rules!.styles.keys()].sort()).toEqual([...themed].sort());
    for (const s of rules!.styles.values()) {
      expect(s.setup.length, s.id).toBeGreaterThan(0);
      expect(s.payoff.length, s.id).toBeGreaterThan(0);
      expect(Object.keys(s.minimums ?? {}).sort(), s.id).toEqual(['100', '20', '40', '60']);
    }
  });

  const HAS_PACK = existsSync(path.join(ROOT, 'data', 'packs', 'cards.json'));
  it.skipIf(!HAS_PACK)('keeps riders out of Graveyard setup and counts real setup', () => {
    const ctx = loadReviewContext();
    const gy = rules!.styles.get('graveyard')!;
    const as = (name: string) => {
      const m = matchCard(findCard(ctx.index, name)!, gy, 60);
      return !m || m.as === 'excluded' ? 'neither' : m.as;
    };
    expect(
      ['Merfolk Looter', 'Careful Study', 'Faithless Looting', 'Stinkweed Imp'].map(as),
    ).toEqual(['setup', 'setup', 'setup', 'setup']);
    expect(['Price of Fame', "Ephara's Dispersal", 'Hymn of the Faller'].map(as)).toEqual([
      'neither',
      'neither',
      'neither',
    ]);
    expect(['Zombify', 'Boneyard Wurm', 'Splinterfright'].map(as)).toEqual([
      'payoff',
      'payoff',
      'payoff',
    ]);
  });
});
