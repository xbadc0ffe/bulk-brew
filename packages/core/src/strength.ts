// Card strength: a context-free estimate of how good a card is, from card
// data alone. Every weight lives in config/card-strength.json. The builder
// uses it to break ties and to swap weak cards for strong ones; themes add
// their own pull on top, so a card that is weak alone can still make a deck
// that wants it.

import type { CardStrengthConfig } from './config.ts';
import { cardMatches, isCreature, isLand, manaCostsOf } from './matchers.ts';
import type { CardRecord } from './types.ts';

export interface StrengthPart {
  label: string;
  value: number;
}

export interface CardStrength {
  /** Clamped to the config range; higher is better. */
  score: number;
  /** What added or subtracted, for explanations and tuning. Base is not listed. */
  parts: StrengthPart[];
}

const COLORED_SYMBOL = /\{([^}]*[WUBRG][^}]*)\}/g;

/** Colored mana symbols in the card's first cost. Hybrid and Phyrexian symbols count once each. */
export function coloredPips(card: CardRecord): number {
  const cost = manaCostsOf(card)[0] ?? '';
  return [...cost.matchAll(COLORED_SYMBOL)].length;
}

const TWO_PERMANENT_FACES = new Set(['transform', 'modal_dfc', 'flip', 'meld']);

/** Front face text when the card's keywords may belong to its other face. */
function frontFaceText(card: CardRecord): string | undefined {
  if (!TWO_PERMANENT_FACES.has(card.layout) || !card.faces?.length) return undefined;
  return card.faces[0]!.text ?? '';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** A printed power or toughness as a number, or undefined when it depends on the game (stars). */
function fixedStat(v: string | undefined): number | undefined {
  if (v === undefined || !/^-?\d+$/.test(v)) return undefined;
  return Number.parseInt(v, 10);
}

export function cardStrength(card: CardRecord, cfg: CardStrengthConfig): CardStrength {
  const parts: StrengthPart[] = [];
  const add = (label: string, value: number) => {
    if (Math.abs(value) >= 0.005) parts.push({ label, value: round2(value) });
  };
  if (isLand(card) && card.layout !== 'modal_dfc') return { score: cfg.base, parts };

  const r = cfg.rank;
  const popularity =
    card.rank !== undefined ? 1 - Math.min(card.rank, r.maxRank) / r.maxRank : r.unranked;
  add('popularity', r.weight * popularity);

  if (isCreature(card)) {
    const p = fixedStat(card.power);
    const t = fixedStat(card.toughness);
    if (p !== undefined && t !== undefined) {
      const b = cfg.body;
      const expected = Math.max(b.expectedMin, b.expectedPerMv * card.mv);
      add('stats for its cost', clamp((p + t - expected) * b.perPoint, b.min, b.max));
    }
    let kw = 0;
    const front = frontFaceText(card);
    for (const k of card.keywords) {
      if (front !== undefined && !front.toLowerCase().includes(k.toLowerCase())) continue;
      kw += cfg.keywords[k] ?? 0;
    }
    add('keywords', Math.min(cfg.keywordCap, kw));
  } else if (card.keywords.includes('Flash')) {
    add('instant speed', cfg.instantSpeed);
  }

  let effects = 0;
  for (const e of cfg.effects) {
    if (cardMatches(card, e.match)) {
      effects += e.value;
      add(e.label, e.value);
    }
  }
  // The cap keeps a card with many tags from outscoring a card that does one thing well.
  if (effects > cfg.effectCap) add('effect cap', cfg.effectCap - effects);

  if (card.types.includes('planeswalker')) add('planeswalker', cfg.planeswalker);
  if (card.types.includes('instant')) add('instant speed', cfg.instantSpeed);
  if (!isCreature(card)) {
    const c = cfg.cheapSpell;
    add('cost', clamp(c.perMv * (c.pivotMv - card.mv), c.min, c.max));
  }
  add('colored pips', -cfg.extraPipPenalty * Math.max(0, coloredPips(card) - 1));

  const total = cfg.base + parts.reduce((s, x) => s + x.value, 0);
  return { score: round2(clamp(total, cfg.min, cfg.max)), parts };
}
