import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CardIndex,
  COLOR_CLASSES,
  parsePack,
  type CardRecord,
  type DataPack,
} from '@bulk-brew/core';
import { PACK_FILE } from '../src/build.ts';
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
  // A plain card in the mean, so leaving the next two out shows in it.
  card({ name: 'Blue Bear' }),
  card({ name: 'Rare Looter', ...looter, rarity: 'rare' }),
  card({ name: 'Joke Looter', ...looter, unset: true }),
  card({ name: 'Red Looter', ...looter, colors: ['R'], identity: ['R'] }),
  // Goad setup weighs 1 at 60 and 2 at 100, so it shows the size the rules were read at.
  card({
    name: 'Goad Aura',
    colors: ['R'],
    identity: ['R'],
    types: ['enchantment'],
    typeLine: 'Enchantment — Aura',
    text: 'Enchant creature\nEnchanted creature gets +2/+0 and is goaded.',
  }),
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
  });

  // Pinned on their own too, so a change to both computations still shows.
  it('reads commons and uncommons, nonlands and modal land cards, at 60, per color class', () => {
    const at = (style: string, k: (typeof COLOR_CLASSES)[number]) => bulk.styles[style]![k];
    // Two looters and a bear: the rare and the Un-set looters would raise the mean.
    expect(at('graveyard', 'U').setupWeight).toBeCloseTo(4 / 3, 6);
    expect(at('graveyard', 'U').repeatable).toBeCloseTo(2 / 3, 6);
    expect(at('graveyard', 'M').repeatable).toBe(1);
    expect(at('graveyard', 'B').payoffUnits).toBe(1);
    // Goad Aura weighs 1 at 60 (2 and repeatable at 100), over two red cards.
    expect(at('goad', 'R')).toMatchObject({ setupWeight: 0.5, repeatable: 0 });
    // The plain land stays out of the colorless mean; the modal land card is in green's.
    expect(at('artifacts', 'C').setupUnits).toBe(1);
    expect(at('spells', 'G').setupUnits).toBe(0.5);
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

// The version check in validateConfig misses a rules edit made without a version bump.
const PACK_PATH = path.join(ROOT, 'data', 'packs', PACK_FILE);
const LOCAL_PACK = existsSync(PACK_PATH) ? parsePack(readFileSync(PACK_PATH, 'utf8')) : undefined;
describe.skipIf(!LOCAL_PACK || LOCAL_PACK.version !== CONFIG.themeBulk?.dataVersion)(
  'the shipped baseline',
  () => {
    it('is what npm run theme:bulk writes for its pack and the rules', { timeout: 60_000 }, () => {
      expect(computeThemeBulk(LOCAL_PACK!, CONFIG)).toEqual(CONFIG.themeBulk);
    });
  },
);
