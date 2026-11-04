// Color sets: which cards a set of colors can play, how many colored pips a
// card asks of each color, and how many sources of a color a deck needs to
// cast a spell on curve. The source math is a conditional hypergeometric:
// given the deck made its land drops, the chance that enough of them make
// the color.

import { isLand, manaCostsOf } from './matchers.ts';
import { COLORS, COLOR_LABELS, type CardRecord, type Color } from './types.ts';

/** Commander decks are 100 cards; every other size builds by castability. */
export function isCommanderSize(size: number): boolean {
  return size === 100;
}

/** Unique colors in WUBRG order. */
export function normalizeColors(colors: readonly Color[]): Color[] {
  return COLORS.filter((c) => colors.includes(c));
}

/** "White", "White-Blue", "White-Blue-Red", then "Four-color" and "Five-color". */
export function colorsLabel(colors: readonly Color[]): string {
  const list = normalizeColors(colors);
  if (list.length === 4) return 'Four-color';
  if (list.length === 5) return 'Five-color';
  return list.map((c) => COLOR_LABELS[c]).join('-');
}

/** Rules text without reminder text, which can name mana a card never asks for. */
function rulesText(card: CardRecord): string {
  return card.text.replace(/\([^)]*\)/g, '');
}

const SYMBOL = /\{([^}]+)\}/g;

/**
 * Every mana symbol the card asks to be paid, upper case: its casting costs
 * and the costs in its rules text. Mana the card makes ("Add {C}") is not a
 * cost, and a {C} in an ability only limits that ability, not the card.
 */
function symbolsOf(card: CardRecord): string[] {
  const out: string[] = [];
  for (const cost of manaCostsOf(card)) for (const m of cost.matchAll(SYMBOL)) out.push(m[1]!);
  const asked = rulesText(card).replace(/\badd [^.]*\./gi, '');
  for (const m of asked.matchAll(SYMBOL)) if (m[1]!.toUpperCase() !== 'C') out.push(m[1]!);
  return out.map((s) => s.toUpperCase());
}

/** Whether a symbol can be paid with mana of these colors (or life, or generic mana). */
function payable(sym: string, colors: readonly Color[]): boolean {
  if (sym === 'C') return false;
  if (sym.includes('/')) {
    const parts = sym.split('/');
    if (parts.includes('P')) return true;
    return parts.some((p) => (colors as readonly string[]).includes(p) || /^\d+$/.test(p));
  }
  if ((COLORS as readonly string[]).includes(sym))
    return (colors as readonly string[]).includes(sym);
  return true;
}

/**
 * Whether a deck of these colors can use the card. Nonland cards need every
 * mana symbol in their costs and rules text payable, so a hybrid card fits a
 * deck of either color. Lands keep the color identity rule: a land's colors
 * often come from its basic land types, which have no symbols in the text.
 */
export function playableWith(card: CardRecord, colors: readonly Color[]): boolean {
  if (isLand(card) && card.layout !== 'modal_dfc') {
    return card.identity.every((c) => colors.includes(c));
  }
  const symbols = symbolsOf(card);
  if (!symbols.every((s) => payable(s, colors))) return false;
  if (card.identity.every((c) => colors.includes(c))) return true;
  // An identity color outside the deck is fine only when a hybrid or Phyrexian
  // symbol brings it, since those can be paid without that color.
  const outside = card.identity.filter((c) => !colors.includes(c));
  return outside.every((o) => symbols.some((s) => s.includes('/') && s.split('/').includes(o)));
}

/** Whether the card's color identity fits inside the colors (the Commander rule). */
export function identityWithin(card: CardRecord, colors: readonly Color[]): boolean {
  return card.identity.every((c) => colors.includes(c));
}

/**
 * Colored pips the card's casting cost asks of each deck color. Hybrid pips
 * go to the first listed deck color in `prefer` order; Phyrexian and
 * generic-hybrid pips ask for no color.
 */
export function pipDemand(
  card: CardRecord,
  prefer: readonly Color[],
): Partial<Record<Color, number>> {
  const out: Partial<Record<Color, number>> = {};
  const cost = manaCostsOf(card)[0] ?? '';
  for (const m of cost.matchAll(SYMBOL)) {
    const sym = m[1]!.toUpperCase();
    let color: Color | undefined;
    if (sym.includes('/')) {
      const parts = sym.split('/');
      if (parts.includes('P') || parts.some((p) => /^\d+$/.test(p))) continue;
      color = prefer.find((c) => parts.includes(c));
    } else if ((COLORS as readonly string[]).includes(sym)) {
      color = sym as Color;
    }
    if (color) out[color] = (out[color] ?? 0) + 1;
  }
  return out;
}

function lnChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
  return s;
}

/**
 * Chance that at least `pips` of the lands seen are sources of a color, given
 * at least `turn` lands were seen by that turn. `seen` cards drawn from a
 * deck of `deck` cards holding `lands` lands, `sources` of which make the color.
 */
export function castChance(
  deck: number,
  lands: number,
  sources: number,
  seen: number,
  turn: number,
  pips: number,
): number {
  const total = lnChoose(deck, seen);
  let hit = 0;
  let any = 0;
  for (let a = 0; a <= Math.min(sources, seen); a++) {
    for (let b = 0; b <= Math.min(lands - sources, seen - a); b++) {
      const rest = seen - a - b;
      if (rest > deck - lands) continue;
      const p = Math.exp(
        lnChoose(sources, a) + lnChoose(lands - sources, b) + lnChoose(deck - lands, rest) - total,
      );
      if (a + b >= turn) {
        any += p;
        if (a >= pips) hit += p;
      }
    }
  }
  return any > 0 ? hit / any : 0;
}

const NEEDED_CACHE = new Map<string, number>();

/**
 * Fewest sources of a color for a spell asking `pips` of it to be castable on
 * `turn` with at least `target` chance, assuming the deck made its land drops.
 * Cards seen by a turn are the opening seven plus one draw per turn after the
 * first (on the play), or one more on the draw. Capped at the land count.
 */
export function sourcesNeeded(
  deck: number,
  lands: number,
  pips: number,
  turn: number,
  target: number,
  onDraw = false,
): number {
  const t = Math.max(1, Math.min(turn, 10));
  const key = `${deck}:${lands}:${pips}:${t}:${target}:${onDraw}`;
  const hit = NEEDED_CACHE.get(key);
  if (hit !== undefined) return hit;
  const seen = Math.min(deck, 7 + (t - 1) + (onDraw ? 1 : 0));
  let need = lands;
  for (let s = pips; s <= lands; s++) {
    if (castChance(deck, lands, s, seen, t, pips) >= target) {
      need = s;
      break;
    }
  }
  NEEDED_CACHE.set(key, need);
  return need;
}
