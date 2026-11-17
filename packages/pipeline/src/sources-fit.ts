// Entry point for `npm run sources:fit`: how far real multi-color decks fall
// short of the per-color source rule (`colorWants`, `landRules.colors.sourceCover`),
// measured as the review checker measures it (`sourceCheck` in review/check.ts):
// per deck, the largest gap of any color below its want, the commander counted
// among the spells. It prints the gap per size and corpus split for each
// candidate cover, and the strictest cover at which the median train deck is
// short in no color. The test split is printed only for the old rule (cover 1),
// the fitted cover, and the configured one.
//
// Usage: npm run sources:fit          the corpus fit (data/corpus/decks.json)
//        npm run sources:fit -- --dev every two-color best fit at 60 and 40 on the
//                                     development pools, built with cover 1 and with
//                                     the configured covers: basic splits changed,
//                                     best-fit styles changed, and copies cast on curve
//
// The corpus selection matches corpus:eval's defaults: precon, draft, and local
// decks from 2015 on, at most 2000 draft decks per size.

import { existsSync } from 'node:fs';
import {
  BuildError,
  buildDeck,
  canBeCommander,
  castChance,
  COLORS,
  factsFor,
  isCommanderSize,
  normalizeColors,
  pipDemand,
  scanPool,
  type BulkBrewConfig,
  type CardIndex,
  type CardRecord,
  type Color,
  type Deck,
  type DeckSize,
  type SpellCopies,
} from '@bulk-brew/core';
import {
  CORPUS_FILE,
  deckColors,
  flag,
  hash32,
  loadCorpus,
  mean,
  median,
  recordsOf,
  round,
  splitOf,
} from './corpus.ts';
import { createContext, devPools, loadPool } from './review/build.ts';
import { sourceCheck } from './review/check.ts';

const COVERS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];
const SIZES: DeckSize[] = [60, 40, 100, 20];

interface RealDeck {
  size: DeckSize;
  split: 'train' | 'test';
  spells: SpellCopies[];
  landCards: { card: CardRecord; qty: number }[];
  colors: Color[];
}

function realDecks(index: CardIndex, config: BulkBrewConfig): RealDeck[] {
  const out: RealDeck[] = [];
  const corpus = loadCorpus();
  for (const size of SIZES) {
    let decks = corpus.decks.filter(
      (d) =>
        d.size === size &&
        ['precon', 'draft', 'local'].includes(d.source) &&
        (!d.released || d.released.slice(0, 4) >= '2015'),
    );
    decks.sort((a, b) => hash32(a.id) - hash32(b.id) || (a.id < b.id ? -1 : 1));
    if (decks.some((d) => d.source === 'draft')) decks = decks.slice(0, 2000);
    for (const deck of decks) {
      const cards = recordsOf(index, deck.cards);
      let commander: CardRecord | undefined;
      if (size === 100) {
        if (deck.commander?.length !== 1) continue;
        commander = index.get(deck.commander[0]!);
        if (!commander || !canBeCommander(commander) || commander.identity.length === 0) continue;
      }
      const colors = commander
        ? normalizeColors(commander.identity)
        : deckColors(cards, index, config);
      if (colors.length < 2) continue;
      const spells: SpellCopies[] = [];
      const landCards: { card: CardRecord; qty: number }[] = [];
      for (const [card, qty] of cards) {
        const facts = factsFor(index, config, card);
        if (facts.spell) spells.push({ facts, qty });
        else if (facts.land && !facts.mdfcLand) landCards.push({ card, qty });
      }
      if (commander) spells.push({ facts: factsFor(index, config, commander), qty: 1 });
      out.push({ size, split: splitOf(deck.id), spells, landCards, colors });
    }
  }
  return out;
}

function gaps(decks: RealDeck[], config: BulkBrewConfig, cover: number): number[] {
  return decks.map(
    (d) => sourceCheck(d.spells, d.landCards, [], d.colors, d.size, config, cover).gap,
  );
}

function describe(g: number[]): string {
  const short = g.filter((x) => x > 0).length;
  return `median ${median(g)}, mean ${round(mean(g))}, short ${Math.round((100 * short) / Math.max(1, g.length))}% of ${g.length}`;
}

function fit(): void {
  if (!existsSync(CORPUS_FILE)) throw new Error('no corpus at data/corpus/decks.json');
  const { index, config } = createContext();
  const decks = realDecks(index, config);
  for (const size of SIZES) {
    const train = decks.filter((d) => d.size === size && d.split === 'train');
    const test = decks.filter((d) => d.size === size && d.split === 'test');
    console.log(
      `\n${size} cards, real multi-color decks: train ${train.length}, test ${test.length}`,
    );
    let fitted: number | undefined;
    for (const cover of COVERS) {
      const g = gaps(train, config, cover);
      if (fitted === undefined && median(g) <= 0) fitted = cover;
      console.log(`  cover ${cover}: train ${describe(g)}`);
    }
    const configured = config.landRules.colors.sourceCover[String(size) as '60'];
    console.log(`  fitted (strictest with a train median of 0): ${fitted ?? 'none'}`);
    for (const [label, cover] of [
      ['old rule, cover 1', 1],
      [`fitted, cover ${fitted}`, fitted],
      [`configured, cover ${configured}`, configured],
    ] as const) {
      if (cover === undefined) continue;
      console.log(
        `  ${label}: train ${describe(gaps(train, config, cover))}; test ${describe(gaps(test, config, cover))}`,
      );
    }
  }
}

/** Mean chance over the deck's spell copies to cast each on curve from the sources it records, as the plan picker reads it. */
function castShare(deck: Deck, index: CardIndex, config: BulkBrewConfig, size: DeckSize): number {
  const lands = deck.explanation?.lands;
  const colors = deck.colors ?? [deck.color];
  if (!lands?.sources || colors.length < 2) return 1;
  let total = 0;
  let n = 0;
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || !factsFor(index, config, card).spell) continue;
    const dem = pipDemand(card, colors);
    const turn = Math.max(1, Math.min(10, Math.ceil(card.mv)));
    const seen = Math.min(size, 7 + turn - 1 + (isCommanderSize(size) ? 1 : 0));
    let p = 1;
    for (const c of colors) {
      const pips = dem[c] ?? 0;
      if (pips === 0) continue;
      p *= castChance(
        size,
        lands.count,
        Math.min(lands.count, lands.sources[c] ?? 0),
        seen,
        turn,
        pips,
      );
    }
    total += p * dc.qty;
    n += dc.qty;
  }
  return n > 0 ? total / n : 1;
}

function dev(): void {
  const { index, config, settings } = createContext();
  const every = structuredClone(config) as BulkBrewConfig;
  for (const k of ['20', '40', '60', '100'] as const) every.landRules.colors.sourceCover[k] = 1;
  const pairs: Color[][] = [];
  for (let i = 0; i < COLORS.length; i++)
    for (let j = i + 1; j < COLORS.length; j++) pairs.push([COLORS[i]!, COLORS[j]!]);
  for (const size of [60, 40] as const) {
    let requests = 0;
    let built = 0;
    let splits = 0;
    let styles = 0;
    let spellsChanged = 0;
    let multi = 0;
    const cast = { before: 0, after: 0 };
    const stretched = { before: 0, after: 0 };
    const flips = new Map<string, number>();
    for (const file of devPools()) {
      const { pool } = loadPool(file, index);
      for (const colors of pairs) {
        if (!scanPool(pool, index, config, settings, size, colors).possible) continue;
        requests++;
        const request = { size, colors, settings, id: 'sources-fit', createdAt: 'sources-fit' };
        const build = (c: BulkBrewConfig) => {
          try {
            return buildDeck(request, pool, index, c).deck;
          } catch (err) {
            if (err instanceof BuildError) return undefined;
            throw err;
          }
        };
        const a = build(every);
        const b = build(config);
        if (!a || !b) continue;
        built++;
        const cards = (d: Deck) => JSON.stringify(d.cards.map((c) => [c.cardId, c.qty]).sort());
        const basics = (d: Deck) =>
          JSON.stringify(COLORS.map((c) => d.basics[c as keyof Deck['basics']] ?? 0));
        if (basics(a) !== basics(b)) splits++;
        if (cards(a) !== cards(b)) spellsChanged++;
        if (a.archetype !== b.archetype) {
          styles++;
          const k = `${a.archetype} to ${b.archetype}`;
          flips.set(k, (flips.get(k) ?? 0) + 1);
        }
        if ((b.colors ?? [b.color]).length > 1) {
          multi++;
          cast.before += castShare(a, index, config, size);
          cast.after += castShare(b, index, config, size);
          const short = (d: Deck) =>
            d.explanation?.notes.some((n) => n.includes('mana is stretched')) ? 1 : 0;
          stretched.before += short(a);
          stretched.after += short(b);
        }
      }
    }
    const per = (x: number) => round(x / Math.max(1, multi), 4);
    console.log(
      `${size} cards: ${requests} two-color requests, ${built} built both ways; basic splits changed ${splits}, cards changed ${spellsChanged}, best-fit styles changed ${styles}${
        flips.size
          ? ` (${[...flips]
              .sort((x, y) => y[1] - x[1])
              .map(([k, n]) => `${k} ${n}`)
              .join(', ')})`
          : ''
      }`,
    );
    console.log(
      `  ${multi} decks of two colors: copies cast on curve ${per(cast.before)} with cover 1, ${per(cast.after)} now; a stretched note on ${Math.round((100 * stretched.before) / Math.max(1, multi))}% and ${Math.round((100 * stretched.after) / Math.max(1, multi))}%`,
    );
  }
}

if (flag('dev')) dev();
else fit();
