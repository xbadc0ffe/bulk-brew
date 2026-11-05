// Learned card selection: what a candidate is worth to a plan beyond its own
// strength, from what real decks do. Three parts, weighted per size in
// builderWeights.learned.selection:
//
// - fit: how much more the plan's real decks play the card's tags (config
//   learned tag fit) and the card itself (data/learned.json), plus at 100
//   how much more the commander's EDHREC decks play it;
// - pairs: how much more real decks hold the card's tags, and the card
//   itself, together with the cards already chosen (learned tag pairs, draft
//   card pairs), counted as the deck grows;
// - combos: Commander Spellbook combos the deck can complete, by bracket.
//
// The builder keeps a running tally of these, so a swap is scored by what
// it adds and takes away rather than by rescoring the deck.

import { forSize, type BulkBrewConfig } from './config.ts';
import type { Candidate } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import type { CardRecord, DeckSize } from './types.ts';

interface ComboUse {
  /** Position in Selection.combos. */
  at: number;
}

export interface Selection {
  /** Static value per card id, in objective points per copy: plan fit and commander fit. */
  fit: Map<string, number>;
  /** Per card id, the keys it pairs with (as key numbers) and the weight of each pair. */
  links: Map<string, { at: Int32Array; w: Float64Array }>;
  /** Per card id, the keys it gives a partner to pair with (its tags and itself), as key numbers. */
  keys: Map<string, Int32Array>;
  /** How many keys there are: the size of a tally's `provided`. */
  keyCount: number;
  /** Combos the pool can complete: pieces and the points a complete one is worth. */
  combos: { pieces: number; points: number }[];
  /** Per card id, the combos it is a piece of. */
  comboOf: Map<string, ComboUse[]>;
  /** Combo pieces the commander already provides, per combo. */
  given: Map<number, number>;
  /** Objective points per unit of pair synergy per spell. */
  pairWeight: number;
  /** Multiplier on the hand-written synergy rules, kept for cards no data covers. */
  ruleWeight: number;
}

/** The learned part of a deck's tally. */
export interface LearnedTally {
  /** Copies in the deck that give each key, by key number. */
  provided: Float64Array;
  /** Copies of each card in the deck. */
  cards: Map<string, number>;
  /** Pair synergy summed over pairs of copies. */
  syn: number;
  /** Static fit summed over copies. */
  fit: number;
  /** Combo points, each combo scored by the square of the share of its pieces in the deck. */
  combo: number;
  /** Distinct pieces of each combo in the deck, commander included. */
  present: Map<number, number>;
}

export function emptyLearnedTally(sel: Selection): LearnedTally {
  const present = new Map(sel.given);
  let combo = 0;
  for (const [at, n] of present) {
    const c = sel.combos[at]!;
    combo += c.points * (n / c.pieces) ** 2;
  }
  return {
    provided: new Float64Array(sel.keyCount),
    cards: new Map(),
    syn: 0,
    fit: 0,
    combo,
    present,
  };
}

const TAG = 't:';
const CARD = 'c:';
const EMPTY = new Int32Array(0);

/** The pair synergy a copy of a card adds to a deck with this tally. */
export function pairGain(sel: Selection, t: LearnedTally, id: string): number {
  let v = 0;
  const l = sel.links.get(id);
  if (!l) return 0;
  for (let i = 0; i < l.at.length; i++) v += l.w[i]! * t.provided[l.at[i]!]!;
  return v;
}

/** Combo points one more copy of a card would add. */
export function comboGain(sel: Selection, t: LearnedTally, id: string): number {
  if ((t.cards.get(id) ?? 0) > 0) return 0;
  let v = 0;
  for (const { at } of sel.comboOf.get(id) ?? []) {
    const c = sel.combos[at]!;
    const n = t.present.get(at) ?? 0;
    v += c.points * (((n + 1) / c.pieces) ** 2 - (n / c.pieces) ** 2);
  }
  return v;
}

/**
 * Add (or with a negative qty, take out) copies of a card, one at a time, so
 * a card's copies pair with each other the same way however they come in.
 */
export function addLearned(sel: Selection, t: LearnedTally, id: string, qty: number): void {
  const step = qty > 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(qty); i++) addOneLearned(sel, t, id, step);
}

function addOneLearned(sel: Selection, t: LearnedTally, id: string, qty: 1 | -1): void {
  const keys = sel.keys.get(id) ?? EMPTY;
  const before = t.cards.get(id) ?? 0;
  if (qty > 0) {
    t.syn += qty * pairGain(sel, t, id);
    for (const k of keys) t.provided[k]! += qty;
  } else {
    for (const k of keys) t.provided[k]! += qty;
    t.syn += qty * pairGain(sel, t, id);
  }
  t.fit += qty * (sel.fit.get(id) ?? 0);
  const after = before + qty;
  t.cards.set(id, after);
  // A combo counts a card once, whatever its copies.
  const step = before === 0 && after > 0 ? 1 : before > 0 && after <= 0 ? -1 : 0;
  if (step !== 0)
    for (const { at } of sel.comboOf.get(id) ?? []) {
      const c = sel.combos[at]!;
      const n = t.present.get(at) ?? 0;
      t.combo += c.points * (((n + step) / c.pieces) ** 2 - (n / c.pieces) ** 2);
      t.present.set(at, n + step);
    }
}

/**
 * The learned selection for one build: the plan (a style id, a tribe as
 * "tribal:<Type>", or undefined for a plain shape), the candidates, and the
 * commander. Undefined when the builder is not set to use it.
 */
export function selectionFor(
  config: BulkBrewConfig,
  index: CardIndex,
  cands: readonly Candidate[],
  plan: string | undefined,
  size: DeckSize,
  commander: CardRecord | undefined,
): Selection | undefined {
  const w = config.builderWeights.learned?.selection;
  const tags = config.learned?.tags;
  if (!w || !tags) return undefined;
  const sw = forSize(w, size);
  const data = index.learned;
  // Tribes share one tag fit table, but each has its own card fit.
  const tagFit = plan ? tags.fit[plan.startsWith('tribal:') ? 'tribal' : plan] : undefined;
  const cardFit = plan ? data?.fit.get(plan) : undefined;
  const cmdFit = commander ? data?.commanders.get(commander.id)?.cards : undefined;
  // At 100 the commander's own EDHREC cards lead; without them, the tag-level data alone
  // pulled decks off the shape of real Commander decks, so those builds skip it.
  if (commander && !cmdFit) return undefined;
  // Tag pairs as partner lists, in log form.
  const partners = new Map<string, [string, number][]>();
  for (const [a, b, lift] of tags.pairs) {
    const v = Math.log(lift);
    if (v <= 0) continue;
    const add = (x: string, y: string) => {
      let list = partners.get(x);
      if (!list) partners.set(x, (list = []));
      list.push([TAG + y, v]);
    };
    add(a, b);
    add(b, a);
  }
  const fit = new Map<string, number>();
  const links = new Map<string, { at: Int32Array; w: Float64Array }>();
  const keys = new Map<string, Int32Array>();
  // Keys as numbers, so a tally is a plain array and a pair lookup an index.
  const keyAt = new Map<string, number>();
  const keyOf = (k: string) => {
    let i = keyAt.get(k);
    if (i === undefined) keyAt.set(k, (i = keyAt.size));
    return i;
  };
  const inPool = new Set(cands.map((c) => c.facts.card.id));
  for (const c of cands) {
    if (!c.facts.spell) continue;
    const card = c.facts.card;
    let f = 0;
    if (tagFit) {
      // The card's best-fitting tags, at most two, so a card with many related tags is not counted many times.
      const logs = card.tags
        .map((t) => tagFit[t])
        .filter((v): v is number => v !== undefined && v > 1)
        .map((v) => Math.log(v))
        .sort((a, b) => b - a)
        .slice(0, 2);
      f += sw.fit * logs.reduce((a, b) => a + b, 0);
    }
    const own = cardFit?.get(card.id);
    if (own && own > 1) f += sw.fit * Math.log(own);
    const cf = cmdFit?.get(card.id);
    if (cf) f += sw.commander * cf;
    if (f) fit.set(card.id, f);
    const l: [string, number][] = [];
    for (const t of card.tags) for (const p of partners.get(t) ?? []) l.push(p);
    for (const [other, lift] of data?.pairs.get(card.id) ?? [])
      if (inPool.has(other)) l.push([CARD + other, sw.cardPair * Math.log(lift)]);
    if (l.length)
      links.set(card.id, {
        at: Int32Array.from(l.map(([k]) => keyOf(k))),
        w: Float64Array.from(l.map(([, v]) => v)),
      });
    keys.set(
      card.id,
      Int32Array.from([...card.tags.map((t) => TAG + t), CARD + card.id].map(keyOf)),
    );
  }
  // Combos every piece of which the pool (or the commander) holds, legal at this size.
  const combos: Selection['combos'] = [];
  const comboOf = new Map<string, ComboUse[]>();
  const given = new Map<number, number>();
  const brackets = config.builderWeights.combos.brackets;
  const legalHere = (c: { commanderLegal: boolean; vintageLegal: boolean }) =>
    size === 100 ? c.commanderLegal : c.vintageLegal;
  if (data && sw.combos > 0) {
    const seen = new Set<string>();
    for (const id of [...inPool, ...(commander ? [commander.id] : [])].sort())
      for (const combo of data.combosByCard.get(id) ?? []) {
        if (seen.has(combo.id) || !legalHere(combo)) continue;
        seen.add(combo.id);
        const points = sw.combos * (brackets[combo.bracket] ?? 0);
        if (points <= 0) continue;
        const ok = combo.cards.every((x) => inPool.has(x) || x === commander?.id);
        if (!ok) continue;
        // A piece that must be the commander only counts when it is.
        if (combo.commander && combo.commander !== commander?.id) continue;
        if (size !== 100 && combo.cards.length > 2 && !sw.largeCombos) continue;
        const at = combos.length;
        combos.push({ pieces: combo.cards.length, points });
        for (const x of combo.cards) {
          if (x === commander?.id) given.set(at, (given.get(at) ?? 0) + 1);
          else {
            let list = comboOf.get(x);
            if (!list) comboOf.set(x, (list = []));
            list.push({ at });
          }
        }
      }
  }
  return {
    fit,
    links,
    keys,
    keyCount: keyAt.size,
    combos,
    comboOf,
    given,
    pairWeight: sw.pairs,
    ruleWeight: sw.rules,
  };
}
