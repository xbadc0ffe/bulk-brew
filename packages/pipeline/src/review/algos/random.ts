// Anchor with a known answer: a legal random pile in the requested colors.
// Judges should fail these (docs/review/anchors.md). Spells come uniformly at
// random from the cards the current builder could legally use; the mana base
// is plain basics, as many as the builder's land formula asks for.

import {
  BuildError,
  canBeCommander,
  COLORS,
  identityWithin,
  listCandidates,
  normalizeColors,
  pipDemand,
  planLandCount,
  templateFor,
  type BulkBrewConfig,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type Color,
  type Pool,
  type Settings,
} from '@bulk-brew/core';
import { hash32, rng } from '../../corpus.ts';
import type { BuilderVersion, BuiltDeck, ReviewRequest } from '../version.ts';

export const RANDOM_WHY = 'random';

export function randomSeed(seed: number): number {
  return hash32(`review:random:${seed}`);
}

interface Pick {
  facts: CardFacts;
  qty: number;
}

/** The first `slots` copies of the shuffled picks, cutting the last pick short. */
function prefix(picks: readonly Pick[], slots: number): Pick[] {
  const out: Pick[] = [];
  let left = slots;
  for (const p of picks) {
    if (left <= 0) break;
    const qty = Math.min(p.qty, left);
    out.push({ facts: p.facts, qty });
    left -= qty;
  }
  return out;
}

function copies(picks: readonly Pick[]): number {
  return picks.reduce((n, p) => n + p.qty, 0);
}

/**
 * Split `lands` basics over the colors in proportion to colored pips, by
 * largest remainder (ties in WUBRG order). Every color with a pip gets at
 * least one basic; with no pips at all the requested colors share evenly.
 */
export function splitBasics(
  lands: number,
  pips: Partial<Record<Color, number>>,
  colors: readonly Color[],
): Partial<Record<Color, number>> {
  let weights = COLORS.filter((c) => (pips[c] ?? 0) > 0).map((c) => [c, pips[c]!] as const);
  if (weights.length === 0) weights = normalizeColors(colors).map((c) => [c, 1] as const);
  const out: Partial<Record<Color, number>> = {};
  if (weights.length === 0 || lands <= 0) return out;
  const total = weights.reduce((n, [, w]) => n + w, 0);
  const shares = weights.map(([c, w]) => {
    const exact = (lands * w) / total;
    return { c, n: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = lands - shares.reduce((n, s) => n + s.n, 0);
  for (const s of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    s.n++;
    left--;
  }
  // A color with pips and no basic cannot cast its spells; take one from the largest.
  for (const s of shares) {
    if (s.n > 0) continue;
    const big = shares.reduce((a, b) => (b.n > a.n ? b : a));
    if (big.n <= 1) break;
    big.n--;
    s.n++;
  }
  for (const s of shares) if (s.n > 0) out[s.c] = s.n;
  return out;
}

function commanderOf(request: ReviewRequest, pool: Pool, index: CardIndex): CardRecord {
  if (!request.commander) throw new BuildError('Pick a commander for a 100-card deck.');
  const card = index.get(request.commander);
  if (!card) throw new BuildError('The picked commander is not in the card data.');
  if (!canBeCommander(card)) throw new BuildError(`${card.name} cannot be a commander.`);
  if ((pool.entries[card.id]?.qty ?? 0) < 1)
    throw new BuildError(`${card.name} is not in your bulk list.`);
  if (card.identity.length === 0)
    throw new BuildError(`${card.name} is colorless; a random pile needs colored basics.`);
  return card;
}

/** A seeded random pile: legal, in color, with basics, and no plan at all. */
export function randomDeck(
  pool: Pool,
  request: ReviewRequest,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): BuiltDeck {
  const { size } = request;
  const commander = size === 100 ? commanderOf(request, pool, index) : undefined;
  const colors = commander ? normalizeColors(commander.identity) : normalizeColors(request.colors);
  if (colors.length === 0) throw new BuildError('Pick at least one color.');

  // The builder's own legality rules (Un-sets, rarities, Commander bans, copy
  // limits), then color identity on top, which is stricter than castability.
  const eligible = listCandidates(pool, index, config, settings, colors, size).filter(
    (c) =>
      c.facts.spell && identityWithin(c.facts.card, colors) && c.facts.card.id !== commander?.id,
  );

  // Fisher-Yates over the id-sorted candidates, then a random count of each, 1 to what is allowed.
  const next = rng(randomSeed(request.seed));
  const order = [...eligible];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const picks: Pick[] = order.map((c) => ({
    facts: c.facts,
    qty: 1 + Math.floor(next() * Math.max(1, c.available)),
  }));

  const template = templateFor(config, size);
  const slots = size - (commander ? 1 : 0);
  const have = copies(picks);
  const fail = (lands: number) =>
    new BuildError(
      `The pool has ${have} playable spell ${have === 1 ? 'copy' : 'copies'} in ${colors.join('') || 'these colors'}; a random ${size}-card pile with ${lands} lands needs ${slots - lands}.`,
    );
  // Land count as the builder would aim for these spells: base count first, then its formula.
  if (have < slots - template.baseLands) throw fail(template.baseLands);
  const draft = prefix(picks, slots - template.baseLands);
  const plan = planLandCount(template, draft, config.landRules.mdfc);
  const lands = plan.count;
  if (have < slots - lands) throw fail(lands);
  const spells = prefix(picks, slots - lands);

  const pips: Partial<Record<Color, number>> = {};
  const addPips = (card: CardRecord, qty: number) => {
    for (const [c, n] of Object.entries(pipDemand(card, colors)) as [Color, number][])
      pips[c] = (pips[c] ?? 0) + n * qty;
  };
  if (commander) addPips(commander, 1);
  for (const p of spells) addPips(p.facts.card, p.qty);
  const basics = splitBasics(lands, pips, colors);

  const cards = spells
    .map((p) => ({ id: p.facts.card.id, name: p.facts.card.name, qty: p.qty }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1))
    .map(({ id, qty }) => ({ id, qty, why: RANDOM_WHY }));
  if (commander) cards.unshift({ id: commander.id, qty: 1, why: 'Commander' });

  return {
    name: 'Random pile',
    archetype: 'none',
    ...(commander ? { commander: commander.id } : {}),
    cards,
    basics,
    explanation: {
      eligibleCards: eligible.length,
      eligibleCopies: have,
      lands,
      landPlan: plan,
      pips,
    },
  };
}

const random: BuilderVersion = {
  id: 'random',
  label: 'Random pile (anchor)',
  notes:
    'Anchor that should fail: spells drawn uniformly at random from the legal, on-identity pool cards, basics by the land formula split by pips.',
  build(ctx) {
    return randomDeck(ctx.pool, ctx.request, ctx.index, ctx.config, ctx.settings);
  },
};

export default random;
