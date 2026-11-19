// What a card earns in one deck: each credit the config gives it (a role or a
// theme side) held against what the deck supplies, by the card needs reader.
// Deck views use it so they never show a credit the deck cannot pay for, such
// as Card advantage on a card whose draw needs counters in a deck with none.
// Outside a deck (the Bulk List) every credit shows.

import { factsFor } from './candidates.ts';
import {
  addSupply,
  cardSupport,
  creditEarned,
  creditNeeds,
  deckSupply,
  themeCredit,
  type DeckSupply,
} from './card-needs.ts';
import type { BulkBrewConfig } from './config.ts';
import type { CardIndex } from './pack.ts';
import { COLORS, type BuildExplanation, type CardRecord, type Color, type Deck } from './types.ts';

/** A deck's supply, with each credit checked against it once. */
export interface DeckCredits {
  readonly supply: DeckSupply;
  /** Whether the card earns a credit (a role id or a `themeCredit`) here. */
  earned(card: CardRecord, credit: string): boolean;
  /** Whether the config gives the card this credit at all, whatever the deck. */
  given(card: CardRecord, credit: string): boolean;
}

/** The deck's colors as the supply reads them: its own and those of its basics. */
function supplyColors(deck: Deck): Color[] {
  const set = new Set<Color>(deck.colors ?? [deck.color]);
  for (const c of COLORS) if ((deck.basics[c] ?? 0) > 0) set.add(c);
  return [...set];
}

/** What a deck supplies: its cards and copies (the commander among them), colors, and size. */
export function supplyOfDeck(deck: Deck, index: CardIndex, config: BulkBrewConfig): DeckSupply {
  const cards: { card: CardRecord; qty: number }[] = [];
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (card) cards.push({ card, qty: dc.qty });
  }
  const commander = deck.commander ? index.get(deck.commander) : undefined;
  return deckSupply(
    { cards, ...(commander ? { commander } : {}), colors: supplyColors(deck), size: deck.size },
    config,
  );
}

/** Credits checked against a supply, each card and credit once. The supply must not change after. */
export function creditsFor(supply: DeckSupply, config: BulkBrewConfig): DeckCredits {
  const memo = new Map<string, boolean>();
  return {
    supply,
    earned(card, credit) {
      const key = `${card.id}|${credit}`;
      let v = memo.get(key);
      if (v === undefined) memo.set(key, (v = creditEarned(card, credit, supply, config)));
      return v;
    },
    given(card, credit) {
      return creditNeeds(card, credit, config, supply.size).kind !== 'absent';
    },
  };
}

const cache = new WeakMap<Deck, WeakMap<CardIndex, WeakMap<BulkBrewConfig, DeckCredits>>>();

/**
 * A deck's credits, computed once per deck object, index, and config, so a
 * view can ask on every render. Decks are treated as immutable: a changed
 * deck is a new object.
 */
export function deckCredits(deck: Deck, index: CardIndex, config: BulkBrewConfig): DeckCredits {
  let byIndex = cache.get(deck);
  if (!byIndex) cache.set(deck, (byIndex = new WeakMap()));
  let byConfig = byIndex.get(index);
  if (!byConfig) byIndex.set(index, (byConfig = new WeakMap()));
  let out = byConfig.get(config);
  if (!out) byConfig.set(config, (out = creditsFor(supplyOfDeck(deck, index, config), config)));
  return out;
}

/** A copy of a supply with `outQty` copies of one card taken out and `inQty` of another put in. */
export function swapSupply(
  supply: DeckSupply,
  out: CardRecord,
  outQty: number,
  into: CardRecord,
  inQty: number,
  config: BulkBrewConfig,
): DeckSupply {
  const next: DeckSupply = {
    ...supply,
    colors: [...supply.colors],
    counts: new Map(supply.counts),
    devotion: new Map(supply.devotion),
  };
  addSupply(next, out, -outQty, config);
  addSupply(next, into, inQty, config);
  return next;
}

/**
 * Whether a classic deck's theme card earns its side: `setup` for an enabler,
 * `payoff` for a payoff. A classic deck counts theme cards with the old
 * matchers, so a side the theme rules do not give the card at all is left as
 * the old matchers count it rather than dropped. A grow deck's jobs come from
 * the rules and must be earned outright (see reasonEarned, deck-themes.ts).
 */
export function earnedTheme(
  card: CardRecord,
  style: string,
  side: 'setup' | 'payoff',
  credits: DeckCredits,
): boolean {
  const credit = themeCredit(style, side);
  return !credits.given(card, credit) || credits.earned(card, credit);
}

/**
 * The Roles bars' role counts: each spell's copies under the roles it earns
 * in this deck, the commander left out as the builders count it, against the
 * targets the build recorded. The explanation keeps the builder's own count.
 * Empty for a deck saved without an explanation.
 */
export function deckRoleCounts(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildExplanation['roles'] {
  const out: BuildExplanation['roles'] = {};
  if (!deck.explanation) return out;
  for (const [id, c] of Object.entries(deck.explanation.roles)) out[id] = { have: 0, want: c.want };
  const credits = deckCredits(deck, index, config);
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || dc.cardId === deck.commander) continue;
    const f = factsFor(index, config, card);
    if (!f.spell) continue;
    for (const id of f.roles) {
      const r = out[id];
      if (r && credits.earned(card, id)) r.have += dc.qty;
    }
  }
  return out;
}

const SIDE_WHY = /^(Setup|Payoff): /;
const THEME_WHY = / (enabler|payoff)$/;

/**
 * Whether a reason the builder recorded for a card still holds in its deck.
 * A reason that names a role ("Removal"), a classic theme side ("Tokens
 * enabler", "Tokens payoff"), or a grow builder job ("Setup: ...",
 * "Payoff: ...") holds only when the card earns that credit; a grow job must
 * be the side the theme rules give the card, as the builder counted it. Any
 * other reason (the curve, filler, lands, a swap, a tribe) always holds.
 */
export function reasonEarned(
  why: string,
  card: CardRecord,
  deck: Deck,
  credits: DeckCredits,
  config: BulkBrewConfig,
): boolean {
  const role = config.roles.roles.find((r) => r.label === why);
  if (role) return credits.earned(card, role.id);
  const job = SIDE_WHY.exec(why);
  if (job) {
    const side = job[1] === 'Setup' ? 'setup' : 'payoff';
    return credits.earned(card, themeCredit(deck.archetype, side));
  }
  const theme = THEME_WHY.exec(why);
  if (theme) {
    const label = why.slice(0, theme.index);
    const style = config.archetypes.archetypes.find(
      (a) => a.kind === 'synergy' && a.label === label,
    );
    if (style)
      return earnedTheme(card, style.id, theme[1] === 'enabler' ? 'setup' : 'payoff', credits);
  }
  return true;
}

/** Why a card in a deck is unsupported there. */
export type UnsupportedKind = 'drawback' | 'dead' | 'reason';

export interface UnsupportedCard {
  cardId: string;
  name: string;
  qty: number;
  /** The reason the builder recorded. */
  why: string;
  kind: UnsupportedKind;
  detail: string;
}

/**
 * The deck's spells that the deck does not support: a drawback the deck does
 * not meet, credits the config gives the
 * card of which it earns none (dead), or a recorded reason it does not earn.
 * Lands and the commander are left out. The eval and the grow builder's
 * finished-deck check count these.
 */
export function unsupportedCards(
  deck: Deck,
  index: CardIndex,
  config: BulkBrewConfig,
): UnsupportedCard[] {
  const credits = deckCredits(deck, index, config);
  const out: UnsupportedCard[] = [];
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || dc.cardId === deck.commander) continue;
    if (!factsFor(index, config, card).spell) continue;
    const why = dc.why ?? '';
    const base = { cardId: card.id, name: card.name, qty: dc.qty, why };
    const s = cardSupport(card, credits.supply, config, (c) => credits.earned(card, c));
    if (s) out.push({ ...base, ...s });
    else if (!reasonEarned(why, card, deck, credits, config))
      out.push({ ...base, kind: 'reason', detail: `does not earn "${why}"` });
  }
  return out;
}
