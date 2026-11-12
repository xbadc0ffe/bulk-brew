import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CardIndex, COLOR_CLASSES, type CardRecord, type DataPack } from '@bulk-brew/core';
import { loadConfigDir } from '../src/check-config.ts';
import { ROOT } from '../src/corpus.ts';
import { rulesDefs, withBulkBaseline } from '../src/review/algos/b/defs.ts';
import { compileThemeRules } from '../src/review/theme-rules.ts';
import { computeThemeBulk } from '../src/theme-bulk.ts';

const CONFIG = loadConfigDir(path.join(ROOT, 'config'));

let n = 0;
/** Made-up cards; the tags are what the rules read for each job. */
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
    rarity: 'common',
    ...partial,
  };
}

const looter = {
  tags: ['repeatable-loot', 'loot'],
  text: '{T}: Draw a card, then discard a card.',
};
const CARDS: CardRecord[] = [
  card({ name: 'Blue Looter', ...looter }),
  card({ name: 'Blue Looter Two', ...looter, rarity: 'uncommon' }),
  card({ name: 'Rare Looter', ...looter, rarity: 'rare' }),
  card({ name: 'Joke Looter', ...looter, unset: true }),
  card({ name: 'Red Looter', ...looter, colors: ['R'], identity: ['R'] }),
  card({ name: 'Gold Looter', ...looter, colors: ['U', 'R'], identity: ['U', 'R'] }),
  card({
    name: 'Token Maker',
    colors: ['W'],
    identity: ['W'],
    text: 'At the beginning of your upkeep, create a 1/1 white Soldier creature token.',
  }),
  card({
    name: 'Grave Count',
    colors: ['B'],
    identity: ['B'],
    tags: ['cards-in-graveyard-matter'],
    text: 'This creature gets +1/+1 for each creature card in your graveyard.',
  }),
  card({ name: 'Plain Bear', colors: ['G'], identity: ['G'] }),
  card({
    name: 'Rock',
    colors: [],
    identity: [],
    types: ['artifact'],
    typeLine: 'Artifact',
    text: '{T}: Add {C}.',
  }),
  card({ name: 'Field', colors: [], identity: [], types: ['land'], typeLine: 'Land' }),
  card({
    name: 'Spell // Field',
    layout: 'modal_dfc',
    colors: ['G'],
    identity: ['G'],
    types: ['sorcery', 'land'],
    typeLine: 'Sorcery // Land',
  }),
];
const PACK: DataPack = {
  schema: 2,
  version: 'test-pack',
  builtAt: 'test',
  cardCount: CARDS.length,
  cards: CARDS,
};

describe('the bulk baseline', () => {
  const bulk = computeThemeBulk(PACK, CONFIG);

  it("computes what the prototype's run-time baseline computes", () => {
    const index = new CardIndex(PACK);
    const proto = withBulkBaseline(
      rulesDefs(compileThemeRules(CONFIG.themeRules), CONFIG, 'test'),
      index,
      CONFIG,
    );
    expect(Object.keys(bulk.styles).sort()).toEqual([...proto.bulk!.keys()].sort());
    for (const [style, per] of proto.bulk!)
      for (const k of COLOR_CLASSES) {
        const got = bulk.styles[style]![k] as unknown as Record<string, number>;
        for (const [key, v] of Object.entries(per[k]))
          expect(got[key], `${style} ${k} ${key}`).toBeCloseTo(v, 6);
      }
    // Both blue bulk cards loot; the rare and the Un-set card stay out.
    expect(bulk.styles.graveyard!.U).toMatchObject({ setupWeight: 2, repeatable: 1 });
    expect(bulk.styles.graveyard!.M.repeatable).toBe(1);
    expect(bulk.styles.graveyard!.B.payoffUnits).toBe(1);
  });

  it('records the data and rules it came from, and versions the content', () => {
    expect(bulk).toMatchObject({
      dataVersion: 'test-pack',
      rulesVersion: CONFIG.themeRules.version,
    });
    expect(bulk.version).toMatch(/^[0-9a-z]+$/);
    expect(computeThemeBulk(PACK, CONFIG).version).toBe(bulk.version);
    const fewer = CARDS.filter((c) => c.name !== 'Grave Count');
    expect(computeThemeBulk({ ...PACK, cards: fewer }, CONFIG).version).not.toBe(bulk.version);
    expect(computeThemeBulk({ ...PACK, version: 'next' }, CONFIG).version).not.toBe(bulk.version);
  });
});
