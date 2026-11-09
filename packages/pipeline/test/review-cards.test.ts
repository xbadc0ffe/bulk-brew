import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CardIndex, type CardRecord, type DataPack, type SynergyArchetype } from '@bulk-brew/core';
import { loadConfigDir } from '../src/check-config.ts';
import {
  ROOT,
  cardFacts,
  cardsFromDecklist,
  cardsWithTag,
  findCard,
  formatCardFacts,
  loadReviewContext,
  synergyStyle,
  type ReviewContext,
} from '../src/review/card-facts.ts';

const CONFIG = loadConfigDir(path.join(ROOT, 'config'));
const GRAVEYARD = synergyStyle(CONFIG, 'graveyard') as SynergyArchetype;

function card(partial: Partial<CardRecord> & Pick<CardRecord, 'id' | 'name'>): CardRecord {
  return {
    layout: 'normal',
    mv: 2,
    typeLine: 'Creature — Zombie',
    text: '',
    colors: ['B'],
    identity: ['B'],
    keywords: [],
    types: ['creature'],
    tags: [],
    img: 'x',
    manaCost: '{1}{B}',
    power: '2',
    toughness: '2',
    ...partial,
  };
}

const MILLER = card({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test Miller',
  text: 'When this creature enters, mill three cards.',
  tags: ['mill', 'mill-self'],
});
const LOOTER = card({
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Test Looter',
  text: '{T}: Draw a card, then discard a card.',
  tags: ['loot', 'discard-outlet'],
});
const FLIPPER = card({
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Test Front // Test Back',
  layout: 'transform',
  typeLine: 'Creature — Human // Creature — Horror',
  text: 'Front text.\n//\nBack text.',
  tags: ['mill-self'],
  faces: [
    {
      name: 'Test Front',
      manaCost: '{1}{B}',
      typeLine: 'Creature — Human',
      text: 'Front text.',
      colors: ['B'],
      power: '2',
      toughness: '2',
    },
    {
      name: 'Test Back',
      typeLine: 'Creature — Horror',
      text: 'Back text.',
      colors: ['B'],
      power: '4',
      toughness: '4',
    },
  ],
});

const SPLIT: CardRecord = {
  id: '00000000-0000-4000-8000-000000000004',
  name: 'Test Hot // Test Cold',
  layout: 'split',
  manaCost: '{1}{R}',
  mv: 4,
  typeLine: 'Instant // Instant',
  text: 'Hot text.\n//\nCold text.',
  colors: ['R', 'U'],
  identity: ['R', 'U'],
  keywords: [],
  types: ['instant'],
  tags: [],
  img: 'x',
  faces: [
    { name: 'Test Hot', manaCost: '{1}{R}', typeLine: 'Instant', text: 'Hot text.', colors: ['R'] },
    {
      name: 'Test Cold',
      manaCost: '{1}{U}',
      typeLine: 'Instant',
      text: 'Cold text.',
      colors: ['U'],
    },
  ],
};

const PACK: DataPack = {
  schema: 2,
  version: '2026-01-01',
  builtAt: '2026-01-01',
  cardCount: 4,
  cards: [LOOTER, FLIPPER, MILLER, SPLIT],
};

describe('card facts on fixture cards', () => {
  const index = new CardIndex(PACK);

  it('finds cards by name, oracle id, and either face', () => {
    expect(findCard(index, 'Test Miller')?.id).toBe(MILLER.id);
    expect(findCard(index, MILLER.id.toUpperCase())?.name).toBe('Test Miller');
    expect(findCard(index, 'Test Front // Test Back')?.id).toBe(FLIPPER.id);
    expect(findCard(index, 'Test Front')?.id).toBe(FLIPPER.id);
    expect(findCard(index, 'Test Back')?.id).toBe(FLIPPER.id);
    expect(findCard(index, 'No Such Card')).toBeUndefined();
  });

  it('lists a tag sorted by name', () => {
    expect(cardsWithTag(index, 'mill-self').map((c) => c.name)).toEqual([
      'Test Front // Test Back',
      'Test Miller',
    ]);
    expect(cardsWithTag(index, 'no-such-tag')).toEqual([]);
  });

  it('keeps decklist quantities and reports unknown lines', () => {
    const got = cardsFromDecklist(index, '2 Test Miller\n1 Test Looter\n1 Test Miller\n3 Nope');
    expect(got.cards.map((c) => [c.card.name, c.qty])).toEqual([
      ['Test Miller', 3],
      ['Test Looter', 1],
    ]);
    expect(got.unresolved).toEqual(['3 Nope']);
  });

  it('reports the styles and clauses the config matches', () => {
    const miller = cardFacts(MILLER, CONFIG, index, { style: GRAVEYARD, qty: 2 });
    expect(miller.qty).toBe(2);
    expect(miller.styles).toContainEqual({ style: 'graveyard', as: ['enabler'] });
    expect(miller.styleCheck?.enabler[0]).toMatchObject({ clause: 1, hits: ['mill-self'] });
    expect(miller.styleCheck?.payoff).toEqual([]);
    expect(typeof miller.strength).toBe('number');
    // A looter with no graveyard payoff tag is not a graveyard enabler under the current config.
    const looter = cardFacts(LOOTER, CONFIG, index, { style: GRAVEYARD });
    expect(looter.styleCheck?.enabler).toEqual([]);
    expect(looter.styles.find((s) => s.style === 'graveyard')).toBeUndefined();
  });

  it('prints both faces, and one line in compact form', () => {
    const sheet = cardFacts(FLIPPER, CONFIG, index);
    expect(sheet.faces?.map((f) => f.text)).toEqual(['Front text.', 'Back text.']);
    expect(sheet).not.toHaveProperty('qty');
    const text = formatCardFacts(sheet);
    expect(text).toContain('face 1: Test Front  {1}{B}');
    expect(text).toContain('face 2: Test Back  (Creature — Horror, 4/4)');
    expect(text).toContain('    Back text.');
    expect(formatCardFacts(sheet, { compact: true })).not.toContain('\n');
  });

  it('prints both costs of a split card, keeping the pack cost in the sheet', () => {
    const sheet = cardFacts(SPLIT, CONFIG, index);
    expect(sheet.manaCost).toBe('{1}{R}');
    expect(formatCardFacts(sheet)).toMatch(
      /^Test Hot \/\/ Test Cold {2}\{1\}\{R\} \/\/ \{1\}\{U\} {2}mv 4/,
    );
    expect(formatCardFacts(sheet, { compact: true })).toContain('{1}{R} // {1}{U} mv 4');
  });

  it('says when the builder leaves a card out', () => {
    expect(cardFacts(MILLER, CONFIG, index)).not.toHaveProperty('leftOut');
    // New ids, since the core caches facts by card id.
    const unset = cardFacts({ ...MILLER, id: `${MILLER.id}-u`, unset: true }, CONFIG, index);
    expect(unset.leftOut).toEqual(['Un-set (off by default)']);
    const text = 'Your commander costs {1} less.';
    const boss = cardFacts({ ...LOOTER, id: `${LOOTER.id}-c`, text }, CONFIG, index);
    expect(boss.leftOut).toEqual(['mentions a commander (60, 40, 20)']);
    expect(formatCardFacts(boss, { compact: true })).toContain('left out: mentions a commander');
  });

  it('rejects shape styles and unknown styles with the valid ids', () => {
    expect(synergyStyle(CONFIG, 'aggro')).toMatch(/shape style.*graveyard/);
    expect(synergyStyle(CONFIG, 'nope')).toMatch(/no style "nope".*graveyard/);
  });
});

const HAS_PACK = existsSync(path.join(ROOT, 'data', 'packs', 'cards.json'));

// CI has no data pack; these run wherever npm run data:pull has.
describe.skipIf(!HAS_PACK)('card facts on the data pack', () => {
  let ctx: ReviewContext;
  beforeAll(() => {
    ctx = loadReviewContext();
  });

  it('finds a card by name and by oracle id', () => {
    const byName = findCard(ctx.index, 'Thraben Inspector')!;
    expect(byName.text).toMatch(/^When this creature enters, investigate\./);
    expect(findCard(ctx.index, byName.id)?.name).toBe('Thraben Inspector');
  });

  it('finds a two-faced card by its full name and by either face', () => {
    const full = findCard(ctx.index, 'Delver of Secrets // Insectile Aberration')!;
    expect(findCard(ctx.index, 'Delver of Secrets')?.id).toBe(full.id);
    expect(findCard(ctx.index, 'Insectile Aberration')?.id).toBe(full.id);
    const sheet = cardFacts(full, ctx.config, ctx.index);
    expect(sheet.faces?.map((f) => f.name)).toEqual(['Delver of Secrets', 'Insectile Aberration']);
    expect(sheet.faces?.[1]).toMatchObject({ text: 'Flying', power: '3', toughness: '2' });
  });

  it('reports the graveyard clauses a self-mill card and a looter meet', () => {
    const gy = synergyStyle(ctx.config, 'graveyard') as SynergyArchetype;
    // Oracle text in the pack: "When this creature enters or dies, mill three cards."
    const supplier = findCard(ctx.index, "Stitcher's Supplier")!;
    expect(supplier.text).toContain('When this creature enters or dies, mill three cards.');
    const s = cardFacts(supplier, ctx.config, ctx.index, { style: gy });
    expect(s.styles).toContainEqual({ style: 'graveyard', as: ['enabler'] });
    expect(s.styleCheck?.enabler.map((h) => h.clause)).toEqual([1]);
    // Oracle text in the pack: "Draw two cards, then discard two cards. Flashback {2}{R} ..."
    // A looter counts as setup only because it is also castable from the graveyard.
    const looting = findCard(ctx.index, 'Faithless Looting')!;
    expect(looting.text).toContain('Draw two cards, then discard two cards.');
    const l = cardFacts(looting, ctx.config, ctx.index, { style: gy });
    expect(l.styleCheck?.enabler[0]).toMatchObject({ clause: 2 });
    expect(l.styleCheck?.enabler[0]?.hits).toContain('castable-from-graveyard');
  });

  it('lists a tag through the command line as JSON, sorted by name', () => {
    const out = execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'packages', 'pipeline', 'src', 'review', 'cards.ts'),
        '--tag',
        'mill-self',
        '--limit',
        '3',
        '--json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const sheets = JSON.parse(out) as { name: string; tags: string[] }[];
    const expected = cardsWithTag(ctx.index, 'mill-self')
      .slice(0, 3)
      .map((c) => c.name);
    expect(sheets.map((s) => s.name)).toEqual(expected);
    expect(sheets.every((s) => s.tags.includes('mill-self'))).toBe(true);
  });
});
