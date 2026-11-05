// Learn from real decks: turn the reference corpus, EDHREC's pages, and
// Commander Spellbook's combos into the learned data the builder reads.
// Developer-side only; everything it writes is aggregate, rounded numbers
// keyed by oracle id, tag, or style, never a source's pages or deck lists.
//
// - config/learned/plans.json: plan profiles per style and size.
// - config/learned/tags.json: tag fit per style and tag pairs.
// - data/learned.json: per-card plan fit, commander plans and card fit, card
//   pairs, and combos; copied into each app's public/data/.
//
// Only the corpus's train split is learned from, so corpus:eval's test split
// stays decks the builder never saw.
//
// Usage: npm run learn:build                (--since 2015 for products, as corpus:eval)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CardIndex,
  factsFor,
  learnedAt,
  LearnedCards,
  LEARNED_FILES,
  LEARNED_SCHEMA,
  parseLearnedData,
  parsePack,
  validateLearnedConfig,
  type BulkBrewConfig,
  type CardRecord,
  type ClassShares,
  type DeckSize,
  type LearnedDataFile,
  type LearnedPlan,
  type LearnedPlanSize,
  type LearnedPlansConfig,
  type LearnedTagsConfig,
  type Settings,
  type Spread,
} from '@bulk-brew/core';
import { PACK_FILE } from './build.ts';
import { calibrate, calibrationCases } from './calibrate.ts';
import { loadConfigDir } from './check-config.ts';
import {
  arg,
  hash32,
  loadCorpus,
  noiseSource,
  quantile,
  recordsOf,
  ROOT,
  SIZES,
  splitOf,
  type CorpusDeck,
} from './corpus.ts';
import { EDHREC_DIR, edhrecSlug, readPage, type EdhrecPage } from './edhrec.ts';
import {
  bulkThemeShares,
  featureNames,
  featuresOf,
  MIN_PLAN_DECKS,
  planOf,
  SHAPE,
  type DeckPlan,
} from './plans.ts';
import { readJsonl } from './read.ts';
import { gunzipText, readTopLevel, SPELLBOOK_FILE, type SpellbookVariant } from './spellbook.ts';

const LEARNED_DIR = path.join(ROOT, 'config', 'learned');
const DATA_FILE = path.join(ROOT, 'data', 'learned.json');
const APP_DATA_DIRS = ['apps/web/public/data', 'apps/mobile/public/data'];
const TRIBAL = 'tribal:';

/**
 * EDHREC theme pages and their style ids. Several themes can feed one
 * style; tribes map to "tribal:<Type>". Themes not listed are not learned.
 */
export const EDHREC_THEMES: Record<string, string> = {
  tokens: 'tokens',
  'go-wide': 'tokens',
  populate: 'tokens',
  'plus-1-plus-1-counters': 'counters',
  'counters-matter': 'counters',
  proliferate: 'counters',
  aristocrats: 'aristocrats',
  sacrifice: 'aristocrats',
  reanimator: 'graveyard',
  graveyard: 'graveyard',
  'self-mill': 'graveyard',
  dredge: 'graveyard',
  spellslinger: 'spells',
  prowess: 'spells',
  storm: 'spells',
  'spell-copy': 'spells',
  lifegain: 'lifegain',
  artifacts: 'artifacts',
  affinity: 'artifacts',
  voltron: 'auras',
  equipment: 'auras',
  auras: 'auras',
  flying: 'flyers',
  unblockable: 'flyers',
  burn: 'burn',
  pingers: 'burn',
  landfall: 'landfall',
  'lands-matter': 'landfall',
  mill: 'mill',
  enchantress: 'enchantments',
  ramp: 'bigCreatures',
  'big-mana': 'bigCreatures',
  stompy: 'bigCreatures',
  'group-hug': 'groupHug',
  'forced-combat': 'goad',
  energy: 'energy',
  aggro: 'aggro',
  midrange: 'midrange',
  control: 'control',
  angels: 'tribal:Angel',
  assassins: 'tribal:Assassin',
  birds: 'tribal:Bird',
  cats: 'tribal:Cat',
  demons: 'tribal:Demon',
  dinosaurs: 'tribal:Dinosaur',
  dragons: 'tribal:Dragon',
  dwarves: 'tribal:Dwarf',
  eldrazi: 'tribal:Eldrazi',
  elementals: 'tribal:Elemental',
  elves: 'tribal:Elf',
  faeries: 'tribal:Faerie',
  goblins: 'tribal:Goblin',
  horrors: 'tribal:Horror',
  humans: 'tribal:Human',
  hydras: 'tribal:Hydra',
  insects: 'tribal:Insect',
  knights: 'tribal:Knight',
  merfolk: 'tribal:Merfolk',
  ninjas: 'tribal:Ninja',
  phyrexians: 'tribal:Phyrexian',
  pirates: 'tribal:Pirate',
  rats: 'tribal:Rat',
  rogues: 'tribal:Rogue',
  shapeshifters: 'tribal:Shapeshifter',
  slivers: 'tribal:Sliver',
  soldiers: 'tribal:Soldier',
  spiders: 'tribal:Spider',
  spirits: 'tribal:Spirit',
  squirrels: 'tribal:Squirrel',
  vampires: 'tribal:Vampire',
  warriors: 'tribal:Warrior',
  wizards: 'tribal:Wizard',
  zombies: 'tribal:Zombie',
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Added to both shares before a lift is taken, so a tag on one card in a
 * thousand cannot show a lift of 50 from a handful of copies.
 */
const SMOOTH = 0.01;
/** Tags about printing history or jokes, not what a card does. */
const IGNORED_TAG = /^(meme|deprecated-|interrupt$|cycle-|reprint|french-vanilla$|vanilla$)/;
const smoothLift = (share: number, base: number) => (share + SMOOTH) / (base + SMOOTH);
/** Tags that only say which color a card is; pairs of them are colors, not synergy. */
const COLOR_TAG = /-effect$/;
/** A card's fit to a plan is capped here, from either source. */
const MAX_FIT = 4;
/** Pseudo-decks a card's rate in a plan's decks is shrunk with, toward its rate everywhere. */
const PSEUDO_DECKS = 8;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function spreadOf(xs: number[]): Spread | null {
  const v = xs.filter((x) => !Number.isNaN(x));
  if (v.length === 0) return null;
  return [r3(quantile(v, 0.25)), r3(quantile(v, 0.5)), r3(quantile(v, 0.75))];
}

interface Labeled {
  deck: CorpusDeck;
  cards: [CardRecord, number][];
  plan: DeckPlan;
}

/** Spell copies per tag, and spells in all, for one deck. */
function tagCounts(
  cards: readonly [CardRecord, number][],
  index: CardIndex,
  config: BulkBrewConfig,
): { spells: number; tags: Map<string, number> } {
  const tags = new Map<string, number>();
  let spells = 0;
  for (const [card, qty] of cards) {
    if (!factsFor(index, config, card).spell) continue;
    spells += qty;
    for (const t of card.tags) tags.set(t, (tags.get(t) ?? 0) + qty);
  }
  return { spells, tags };
}

/** Mean share of spell copies carrying each tag, over a list of decks. */
function tagShares(
  decks: readonly Labeled[],
  index: CardIndex,
  config: BulkBrewConfig,
): Map<string, number> {
  const sum = new Map<string, number>();
  for (const d of decks) {
    const { spells, tags } = tagCounts(d.cards, index, config);
    for (const [t, n] of tags) sum.set(t, (sum.get(t) ?? 0) + n / Math.max(1, spells));
  }
  for (const [t, v] of sum) sum.set(t, v / Math.max(1, decks.length));
  return sum;
}

function profile(
  decks: readonly Labeled[],
  style: string,
  size: DeckSize,
  source: LearnedPlan['source'],
  index: CardIndex,
  config: BulkBrewConfig,
  ownTribe = false,
): LearnedPlan {
  const rows = decks.map((d) =>
    featuresOf(d.cards, size, ownTribe ? d.plan.plan : style, index, config),
  );
  const n = featureNames(config, size).length;
  const lands = decks.map((d) =>
    d.cards.reduce((a, [c, q]) => a + (factsFor(index, config, c).spell ? 0 : q), 0),
  );
  return {
    decks: decks.length,
    source,
    q: Array.from({ length: n }, (_, i) => spreadOf(rows.map((r) => r[i]!))),
    lands: spreadOf(lands) ?? [0, 0, 0],
  };
}

async function main(): Promise<number> {
  const since = arg('since') ?? '2015';
  const t0 = Date.now();
  const index = new CardIndex(
    parsePack(readFileSync(path.join(ROOT, 'data', 'packs', PACK_FILE), 'utf8')),
  );
  const config = loadConfigDir(path.join(ROOT, 'config'));
  delete config.learned;
  const corpus = loadCorpus();
  const source = noiseSource(index);
  const bulk = bulkThemeShares(index, config, source);
  const styles = config.archetypes.archetypes.filter((a) => a.kind === 'synergy').map((a) => a.id);
  const log = (msg: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${msg}`);

  // ---- Label the train split with the plan each deck runs.
  const bySize = new Map<DeckSize, Labeled[]>();
  for (const size of SIZES) {
    const list: Labeled[] = [];
    for (const deck of corpus.decks) {
      // The owner's own lists are never a tuning target.
      if (deck.size !== size || deck.source === 'local' || splitOf(deck.id) !== 'train') continue;
      if (deck.released && deck.released.slice(0, 4) < since) continue;
      const commander =
        size === 100 && deck.commander?.length === 1 ? index.get(deck.commander[0]!) : undefined;
      if (size === 100 && !commander) continue;
      const cards = recordsOf(index, deck.cards);
      list.push({ deck, cards, plan: planOf(cards, size, index, config, bulk, commander) });
    }
    bySize.set(size, list);
    log(`${size}: ${list.length} train decks labeled`);
  }

  // ---- 1. Plan profiles per style and size.
  const plans: LearnedPlansConfig = { version: '', bulkShare: {}, tribeShare: {}, sizes: {} };
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  const round4 = (shares: ClassShares) =>
    Object.fromEntries(Object.entries(shares).map(([c, v]) => [c, r4(v)])) as ClassShares;
  for (const [s, v] of bulk.styles) plans.bulkShare[s] = round4(v);
  for (const [t, v] of bulk.tribes) plans.tribeShare[t] = round4(v);
  for (const size of SIZES) {
    const decks = bySize.get(size)!;
    const block: LearnedPlanSize = {
      features: featureNames(config, size),
      all: profile(decks, SHAPE, size, 'plan', index, config).q,
      plans: {},
    };
    const shape = decks.filter((d) => d.plan.plan === SHAPE);
    if (shape.length) block.plans[SHAPE] = profile(shape, SHAPE, size, 'plan', index, config);
    // Each plain shape from the unthemed decks whose curve reads as it.
    for (const id of ['aggro', 'midrange', 'control']) {
      const own = shape.filter((d) => d.plan.shape === id);
      if (own.length >= MIN_PLAN_DECKS)
        block.plans[id] = profile(own, SHAPE, size, 'plan', index, config);
    }
    const tribal = decks.filter((d) => d.plan.plan.startsWith(TRIBAL));
    if (tribal.length)
      block.plans.tribal = profile(tribal, 'tribal', size, 'plan', index, config, true);
    for (const style of styles) {
      const running = decks.filter((d) => d.plan.plan === style);
      const meeting = decks.filter((d) => d.plan.met.includes(style));
      if (running.length >= MIN_PLAN_DECKS)
        block.plans[style] = profile(running, style, size, 'plan', index, config);
      else if (meeting.length > 0)
        block.plans[style] = profile(meeting, style, size, 'met', index, config);
    }
    plans.sizes[String(size) as '100'] = block;
  }
  log('plan profiles done');

  // ---- 2. Tag fit per style: tags a style's real decks play more than real decks in general.
  const fitSum = new Map<string, Map<string, { w: number; v: number }>>();
  const addFit = (style: string, tag: string, lift: number, w: number) => {
    let m = fitSum.get(style);
    if (!m) fitSum.set(style, (m = new Map()));
    const e = m.get(tag) ?? { w: 0, v: 0 };
    e.w += w;
    e.v += w * lift;
    m.set(tag, e);
  };
  const allShares = new Map<DeckSize, Map<string, number>>();
  for (const size of SIZES) {
    const decks = bySize.get(size)!;
    // Draft decks are many; a sample keeps the work and the weight in line with other sizes.
    const sample = decks.length > 4000 ? sampleOf(decks, 4000) : decks;
    const all = tagShares(sample, index, config);
    allShares.set(size, all);
    const groups = new Map<string, Labeled[]>();
    for (const d of sample) {
      const key = d.plan.plan.startsWith(TRIBAL) ? 'tribal' : d.plan.plan;
      if (key === SHAPE) continue;
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    for (const [style, list] of groups) {
      if (list.length < 3) continue;
      const shares = tagShares(list, index, config);
      for (const [tag, share] of shares) {
        const base = all.get(tag) ?? 0;
        if (share < 0.03 || IGNORED_TAG.test(tag)) continue;
        const lift = smoothLift(share, base);
        if (lift >= 1.3) addFit(style, tag, lift, Math.min(list.length, 50));
      }
    }
  }
  log('corpus tag fit done');

  // EDHREC theme pages at 100: tags of a theme's cards, weighted by inclusion, against Commander decks in general.
  const printToOracle = await printingMap(index);
  const oracleOf = (id: string, name: string) =>
    printToOracle.get(id) ?? index.find(name)?.id ?? undefined;
  const themeCards = new Map<string, Map<string, { incl: number; lift: number; decks: number }>>();
  const commanderAll = allShares.get(100)!;
  for (const [slug, style] of Object.entries(EDHREC_THEMES)) {
    const page = readPage<EdhrecPage>(`tags/${slug}`);
    if (!page) continue;
    const cards = themeCards.get(style) ?? new Map();
    themeCards.set(style, cards);
    const tagW = new Map<string, number>();
    let total = 0;
    for (const list of page.container.json_dict.cardlists) {
      if (/commanders/i.test(list.header)) continue;
      for (const v of list.cardviews) {
        const id = oracleOf(v.id, v.name);
        const card = id ? index.get(id) : undefined;
        if (!card || !v.potential_decks || !v.num_decks) continue;
        if (!factsFor(index, config, card).spell) continue;
        const incl = v.num_decks / v.potential_decks;
        const prev = cards.get(card.id);
        if (!prev || prev.lift < (v.lift ?? 1))
          cards.set(card.id, { incl, lift: v.lift ?? 1, decks: v.num_decks });
        total += incl;
        for (const t of card.tags) tagW.set(t, (tagW.get(t) ?? 0) + incl);
      }
    }
    if (style.startsWith(TRIBAL) || ['aggro', 'midrange', 'control'].includes(style)) continue;
    for (const [tag, w] of tagW) {
      const share = w / Math.max(1, total);
      const base = commanderAll.get(tag) ?? 0;
      if (share < 0.03 || IGNORED_TAG.test(tag)) continue;
      const lift = smoothLift(share, base);
      if (lift >= 1.3) addFit(style, tag, lift, 50);
    }
  }
  log('EDHREC theme pages read');
  const tags: LearnedTagsConfig = { version: '', fit: {}, pairs: [] };
  for (const [style, m] of [...fitSum.entries()].sort()) {
    const list = [...m.entries()]
      .map(([t, e]) => [t, e.v / e.w, e.w] as const)
      .filter(([, lift, w]) => lift >= 1.4 && w >= 20)
      .sort((a, b) => b[1] * Math.sqrt(b[2]) - a[1] * Math.sqrt(a[2]) || (a[0] < b[0] ? -1 : 1))
      .slice(0, 40);
    tags.fit[style] = Object.fromEntries(list.map(([t, lift]) => [t, r2(lift)]));
  }

  // ---- 3. Tag pairs: tags real decks hold together more often than their shares predict.
  const pairSum = new Map<string, { w: number; v: number }>();
  for (const size of SIZES) {
    const decks = bySize.get(size)!;
    const sample = decks.length > 2500 ? sampleOf(decks, 2500) : decks;
    const all = allShares.get(size)!;
    const top = new Set(
      [...all.entries()]
        .filter(([t]) => !IGNORED_TAG.test(t) && !COLOR_TAG.test(t))
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, 220)
        .map(([t]) => t),
    );
    // Pairs count copies of two different cards: a card carrying both tags is one card, not a pair.
    const joint = new Map<string, number>();
    for (const d of sample) {
      const { spells, tags: tc } = tagCounts(d.cards, index, config);
      const s = Math.max(1, spells);
      const list = [...tc.entries()]
        .filter(([t]) => top.has(t))
        .sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const same = new Map<string, number>();
      for (const [card, qty] of d.cards) {
        if (!factsFor(index, config, card).spell) continue;
        const own = card.tags.filter((t) => top.has(t)).sort();
        for (let i = 0; i < own.length; i++)
          for (let j = i + 1; j < own.length; j++) {
            const k = `${own[i]}|${own[j]}`;
            same.set(k, (same.get(k) ?? 0) + qty * qty);
          }
      }
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const k = `${list[i]![0]}|${list[j]![0]}`;
          const across = list[i]![1] * list[j]![1] - (same.get(k) ?? 0);
          if (across > 0) joint.set(k, (joint.get(k) ?? 0) + across / (s * s));
        }
    }
    const shares = tagShares(sample, index, config);
    for (const [k, sum] of joint) {
      const [a, b] = k.split('|') as [string, string];
      const expected = (shares.get(a) ?? 0) * (shares.get(b) ?? 0);
      const lift = (sum / sample.length + SMOOTH * SMOOTH) / (expected + SMOOTH * SMOOTH);
      if (Number.isFinite(lift) && lift >= 1.5) {
        const e = pairSum.get(k) ?? { w: 0, v: 0 };
        e.w += 1;
        e.v += lift;
        pairSum.set(k, e);
      }
    }
  }
  // Tags that mostly sit on the same cards (a tag and its parent, or two names for one ability) are not a pair.
  const overlap = tagOverlap(
    index,
    config,
    new Set([...pairSum.keys()].flatMap((k) => k.split('|'))),
  );
  tags.pairs = [...pairSum.entries()]
    .filter(([k, e]) => e.w >= 2 && (overlap.get(k) ?? 0) < 0.5)
    .map(
      ([k, e]) =>
        [...(k.split('|') as [string, string]), r2(e.v / e.w)] as [string, string, number],
    )
    .sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .slice(0, 1500);
  log(`tag pairs: ${tags.pairs.length}`);

  // ---- 4. Card level: plan fit, commanders, card pairs, combos.
  const ids: string[] = [];
  const idx = new Map<string, number>();
  const ref = (id: string) => {
    let i = idx.get(id);
    if (i === undefined) {
      i = ids.length;
      ids.push(id);
      idx.set(id, i);
    }
    return i;
  };

  // Plan fit from EDHREC theme pages (lift over decks of the card's colors) and the corpus.
  const cardFit = new Map<string, Map<string, number>>();
  const setFit = (style: string, id: string, lift: number) => {
    let m = cardFit.get(style);
    if (!m) cardFit.set(style, (m = new Map()));
    m.set(id, Math.max(m.get(id) ?? 0, lift));
  };
  for (const [style, cards] of themeCards)
    for (const [id, c] of cards)
      if (c.decks >= 100 && c.lift >= 1.3) setFit(style, id, Math.min(MAX_FIT, c.lift));
  // Corpus lift, shrunk toward no lift with pseudo-decks so a card seen only in a rare
  // style's few decks does not read as a perfect fit, and at 40 within one set, so a
  // set's main archetype does not lift every card printed in it.
  for (const size of SIZES) {
    const minDecks = size === 40 ? 15 : 4;
    const groups = new Map<string, Labeled[]>();
    for (const d of bySize.get(size)!) {
      const key = size === 40 ? (d.deck.id.split(':')[1] ?? '') : 'all';
      let list = groups.get(key);
      if (!list) groups.set(key, (list = []));
      list.push(d);
    }
    for (const [, decks] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const inAll = new Map<string, number>();
      const inPlan = new Map<string, Map<string, number>>();
      const planDecks = new Map<string, number>();
      for (const d of decks) {
        const style = d.plan.plan;
        planDecks.set(style, (planDecks.get(style) ?? 0) + 1);
        const m = inPlan.get(style) ?? new Map<string, number>();
        inPlan.set(style, m);
        for (const [card] of d.cards) {
          if (!factsFor(index, config, card).spell) continue;
          inAll.set(card.id, (inAll.get(card.id) ?? 0) + 1);
          m.set(card.id, (m.get(card.id) ?? 0) + 1);
        }
      }
      for (const [style, m] of inPlan) {
        if (style === SHAPE || style.startsWith(TRIBAL)) continue;
        const n = planDecks.get(style)!;
        for (const [id, k] of m) {
          if (k < minDecks) continue;
          const pAll = inAll.get(id)! / decks.length;
          const lift = (k + PSEUDO_DECKS * pAll) / (n + PSEUDO_DECKS) / pAll;
          if (lift >= 1.5) setFit(style, id, r2(Math.min(MAX_FIT, lift)));
        }
      }
    }
  }
  const fit: LearnedDataFile['fit'] = {};
  for (const [style, m] of [...cardFit.entries()].sort()) {
    fit[style] = [...m.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 600)
      .map(([id, lift]) => [ref(id), r2(lift)]);
  }
  log('card plan fit done');

  // Commanders: the plans their decks run and the 30 cards they play most beyond decks of their colors.
  const commanders: LearnedDataFile['commanders'] = [];
  const seenCommanders = new Set<string>();
  const wantedCommanders = index.pack.cards
    .filter((c) => c.identity.length > 0 && !c.commanderLegality)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const card of wantedCommanders) {
    const page = readPage<EdhrecPage>(`commanders/${edhrecSlug(card.name)}`);
    if (!page || seenCommanders.has(card.id)) continue;
    const head = page.container.json_dict.card;
    if (!head?.num_decks || (head.name && edhrecSlug(head.name) !== edhrecSlug(card.name)))
      continue;
    seenCommanders.add(card.id);
    const shares: Record<string, number> = {};
    for (const t of page.panels?.taglinks ?? []) {
      const style = EDHREC_THEMES[t.slug];
      if (!style) continue;
      shares[style] = Math.min(1, (shares[style] ?? 0) + t.count / head.num_decks);
    }
    const plansOut = Object.fromEntries(
      Object.entries(shares)
        .filter(([, v]) => v >= 0.03)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([k, v]) => [k, r2(v)]),
    );
    const fitList: [number, number][] = [];
    const seen = new Set<string>();
    const views = page.container.json_dict.cardlists.flatMap((l) => l.cardviews);
    views.sort((a, b) => (b.synergy ?? 0) - (a.synergy ?? 0) || (a.id < b.id ? -1 : 1));
    for (const v of views) {
      if ((v.synergy ?? 0) < 0.1 || fitList.length >= 30) break;
      const id = oracleOf(v.id, v.name);
      const c = id ? index.get(id) : undefined;
      if (!c || seen.has(c.id) || !factsFor(index, config, c).spell) continue;
      seen.add(c.id);
      // Kept coarse (steps of 0.05): a derived fit, not EDHREC's numbers.
      fitList.push([ref(c.id), Math.round(v.synergy! * 20) / 20]);
    }
    commanders.push([ref(card.id), plansOut, fitList]);
  }
  log(`commanders: ${commanders.length}`);

  // Card pairs from draft decks of one set and color pair, so a shared color is not mistaken for synergy.
  const pairs = draftPairs(bySize.get(40)!, index, config).map(
    ([a, b, v]) => [ref(a), ref(b), v] as [number, number, number],
  );
  log(`card pairs: ${pairs.length}`);

  // Combos from Commander Spellbook.
  const combos: LearnedDataFile['combos'] = [];
  const results: Record<string, string> = {};
  const sources: Record<string, string> = { corpus: corpus.dataVersion };
  const keep = new Set(config.builderWeights.combos?.results ?? []);
  if (existsSync(SPELLBOOK_FILE) && keep.size) {
    for await (const part of readTopLevel(gunzipText(SPELLBOOK_FILE))) {
      if (!part.item) {
        if (part.key === 'timestamp') sources.spellbook = String(part.value);
        continue;
      }
      if (part.key !== 'variants') continue;
      const v = part.value as SpellbookVariant;
      if (v.uses.length > 3 || v.requires.length > 0) continue;
      if ((v.status !== 'OK' && v.status !== 'E') || v.spoiler) continue;
      const kept = v.produces.filter((p) => p.feature.status === 'S' && keep.has(p.feature.name));
      if (kept.length === 0) continue;
      const cards = v.uses.map((u) => index.get(u.card.oracleId));
      if (cards.some((c) => !c)) continue;
      const legal = (v.legalities?.commander ? 1 : 0) | (v.legalities?.vintage ? 2 : 0);
      if (!legal) continue;
      // Two-card combos of any bracket; larger ones only in the brackets the builder weighs
      // (Core, Oddball, Powerful, Spicy, and Ruthless as a bonus), to keep the file small.
      const bracket = v.bracketTag ?? 'E';
      if (bracket === 'B' || (v.uses.length > 2 && !['C', 'O', 'P', 'S', 'R'].includes(bracket)))
        continue;
      const cmd = v.uses.findIndex((u) => u.mustBeCommander);
      for (const p of kept) results[String(p.feature.id)] = p.feature.name;
      combos.push([
        v.id,
        cards.map((c) => ref(c!.id)),
        cmd >= 0 ? ref(cards[cmd]!.id) : -1,
        kept.map((p) => p.feature.id).sort((a, b) => a - b),
        bracket,
        legal,
      ]);
    }
    combos.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  log(`combos: ${combos.length}`);
  if (existsSync(path.join(EDHREC_DIR, 'index.json'))) sources.edhrec = latestFetch();

  // ---- Write, with versions that change only when the content does.
  const dataFile: LearnedDataFile = {
    schema: LEARNED_SCHEMA,
    version: '',
    sources,
    ids,
    fit,
    commanders,
    pairs,
    combos,
    results,
  };
  // ---- 5. Calibrate best fit's plan choice on the train split (see calibrate.ts).
  const withLearned: BulkBrewConfig = { ...config, learned: { plans, tags } };
  const yard = withLearned;
  const settings = JSON.parse(
    readFileSync(path.join(ROOT, 'config', 'settings.defaults.json'), 'utf8'),
  ) as Settings;
  index.learned = new LearnedCards(dataFile);
  for (const size of SIZES) {
    const labeled = bySize.get(size)!;
    // A size that does not build with the learned plans needs no weights.
    if (!learnedAt(withLearned, size)) {
      log(`${size}: learned plans off, no plan choice to calibrate`);
      continue;
    }
    // Draft decks: the ones corpus:eval builds (the first 2,000 by hash), train split only.
    const evalDecks = new Set(
      corpus.decks
        .filter((d) => d.size === size)
        .sort((a, b) => hash32(a.id) - hash32(b.id) || (a.id < b.id ? -1 : 1))
        .slice(0, 2000)
        .map((d) => d.id),
    );
    const decks = labeled.filter((l) => size !== 40 || evalDecks.has(l.deck.id)).map((l) => l.deck);
    // At 100, the weights for commanders the EDHREC data covers are fitted on those alone.
    const covered =
      size === 100
        ? decks.filter((d) => index.learned!.commanders.has(d.commander?.[0] ?? ''))
        : decks;
    const cases = calibrationCases(covered, size, index, withLearned, yard, bulk, source, settings);
    const fit = calibrate(cases);
    plans.sizes[String(size) as '100']!.bias = fit.bias;
    if (size === 100) {
      // Commanders EDHREC does not cover get weights fitted with the commander data hidden.
      const full: LearnedCards | undefined = index.learned;
      index.learned = new LearnedCards({ ...dataFile, commanders: [] });
      const bare = calibrate(
        calibrationCases(decks, size, index, withLearned, yard, bulk, source, settings),
      );
      index.learned = full;
      plans.sizes['100']!.biasNoCommander = bare.bias;
      log(
        `100 without commander data: ${Math.round(bare.themedHit * 100)}% of themed decks get their plan, ${bare.over.toFixed(1)} builds over the limits`,
      );
    }
    log(
      `${size}: plan choice calibrated on ${cases.length} pools, ${Math.round(fit.themedHit * 100)}% of themed decks get their plan, ${fit.over.toFixed(1)} builds over the style-mix limits`,
    );
  }

  plans.version = contentVersion(plans);
  tags.version = contentVersion(tags);
  dataFile.version = contentVersion(dataFile);
  const problems = validateLearnedConfig(
    { plans, tags },
    new Set(config.archetypes.archetypes.map((a) => a.id)),
  );
  const parsed = parseLearnedData(JSON.stringify(dataFile));
  if (problems.length || parsed.problems.length) {
    console.error('learned data problems:', [...problems, ...parsed.problems]);
    return 1;
  }
  mkdirSync(LEARNED_DIR, { recursive: true });
  writeFileSync(path.join(LEARNED_DIR, LEARNED_FILES.plans), `${JSON.stringify(plans)}\n`);
  writeFileSync(path.join(LEARNED_DIR, LEARNED_FILES.tags), `${JSON.stringify(tags)}\n`);
  writeFileSync(DATA_FILE, `${JSON.stringify(dataFile)}\n`);
  for (const dir of APP_DATA_DIRS) {
    mkdirSync(path.join(ROOT, dir), { recursive: true });
    copyFileSync(DATA_FILE, path.join(ROOT, dir, 'learned.json'));
  }
  const kb = (f: string) => `${Math.round(readFileSync(f).length / 1024)} KB`;
  log(
    `wrote config/learned (${kb(path.join(LEARNED_DIR, LEARNED_FILES.plans))} + ${kb(path.join(LEARNED_DIR, LEARNED_FILES.tags))}) and data/learned.json (${kb(DATA_FILE)})`,
  );
  return 0;
}

/** A deterministic sample of decks. */
function sampleOf<T extends { deck: CorpusDeck }>(list: readonly T[], n: number): T[] {
  return [...list].sort((a, b) => hash32(`s:${a.deck.id}`) - hash32(`s:${b.deck.id}`)).slice(0, n);
}

/** Scryfall printing id to oracle id, from default_cards. */
async function printingMap(index: CardIndex): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const file = path.join(ROOT, 'data', 'raw', 'default_cards.jsonl.gz');
  if (!existsSync(file)) return out;
  for await (const p of readJsonl<{
    id: string;
    oracle_id?: string;
    card_faces?: { oracle_id?: string }[];
  }>(file)) {
    const oid = p.oracle_id ?? p.card_faces?.[0]?.oracle_id;
    if (oid && index.get(oid)) out.set(p.id, oid);
  }
  return out;
}

/**
 * Card pairs from draft decks: within one set and color pair, how much more
 * often two spells share a deck than their own rates predict. Kept when at
 * least 20 decks hold both and the lift is 1.5 or more.
 */
function draftPairs(
  decks: readonly Labeled[],
  index: CardIndex,
  config: BulkBrewConfig,
): [string, string, number][] {
  const groups = new Map<string, Labeled[]>();
  for (const d of decks) {
    if (d.deck.source !== 'draft') continue;
    // A deck's two main colors, by colored spell copies, so a light splash does not split groups.
    const weight = new Map<string, number>();
    for (const [c, q] of d.cards)
      if (factsFor(index, config, c).spell)
        for (const x of c.colors) weight.set(x, (weight.get(x) ?? 0) + q);
    const main = [...weight.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 2)
      .map(([x]) => x)
      .sort()
      .join('');
    const set = d.deck.id.split(':')[1] ?? '';
    const key = `${set}:${main}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const best = new Map<string, { lift: number; n: number }>();
  for (const [, list] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length < 100) continue;
    const single = new Map<string, number>();
    const joint = new Map<string, number>();
    for (const d of list) {
      const spells = [
        ...new Set(d.cards.filter(([c]) => factsFor(index, config, c).spell).map(([c]) => c.id)),
      ].sort();
      for (const a of spells) single.set(a, (single.get(a) ?? 0) + 1);
      for (let i = 0; i < spells.length; i++)
        for (let j = i + 1; j < spells.length; j++) {
          const k = `${spells[i]}|${spells[j]}`;
          joint.set(k, (joint.get(k) ?? 0) + 1);
        }
    }
    const n = list.length;
    for (const [k, both] of joint) {
      if (both < 20) continue;
      const [a, b] = k.split('|') as [string, string];
      const lift = (both * n) / (single.get(a)! * single.get(b)!);
      if (lift < 1.5) continue;
      const prev = best.get(k);
      if (!prev || prev.n < both) best.set(k, { lift, n: both });
    }
  }
  return [...best.entries()]
    .sort(
      (a, b) =>
        b[1].lift * Math.sqrt(b[1].n) - a[1].lift * Math.sqrt(a[1].n) || (a[0] < b[0] ? -1 : 1),
    )
    .slice(0, 20000)
    .map(([k, v]) => {
      const [a, b] = k.split('|') as [string, string];
      return [a, b, r2(v.lift)];
    });
}

/** For each pair of the given tags, the share of the rarer tag's spells that carry both. */
function tagOverlap(
  index: CardIndex,
  config: BulkBrewConfig,
  wanted: Set<string>,
): Map<string, number> {
  const count = new Map<string, number>();
  const both = new Map<string, number>();
  for (const card of index.pack.cards) {
    if (!factsFor(index, config, card).spell) continue;
    const own = card.tags.filter((t) => wanted.has(t)).sort();
    for (const t of own) count.set(t, (count.get(t) ?? 0) + 1);
    for (let i = 0; i < own.length; i++)
      for (let j = i + 1; j < own.length; j++) {
        const k = `${own[i]}|${own[j]}`;
        both.set(k, (both.get(k) ?? 0) + 1);
      }
  }
  const out = new Map<string, number>();
  for (const [k, n] of both) {
    const [a, b] = k.split('|') as [string, string];
    out.set(k, n / Math.max(1, Math.min(count.get(a) ?? 0, count.get(b) ?? 0)));
  }
  return out;
}

function latestFetch(): string {
  const idxFile = JSON.parse(readFileSync(path.join(EDHREC_DIR, 'index.json'), 'utf8')) as Record<
    string,
    { at: number }
  >;
  const at = Math.max(...Object.values(idxFile).map((e) => e.at));
  return new Date(at).toISOString().slice(0, 10);
}

/** A short hash of the content without its version, so an unchanged learn keeps its version. */
function contentVersion(o: { version: string }): string {
  const { version: _, ...rest } = o;
  return hash32(JSON.stringify(rest)).toString(36);
}

process.exitCode = await main();
