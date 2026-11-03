// Mana base: how many lands a deck wants, and which ones. The count comes
// from the template's land formula applied to the spells actually chosen;
// the lands come from the pool's nonbasics scored by the land rules, with
// basics filling the rest.

import type { BulkBrewConfig, DeckTemplate, LandRulesConfig } from './config.ts';
import type { Candidate, CardFacts } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import type { CardRecord, Color, DeckSize, Settings } from './types.ts';

export interface LandPlan {
  count: number;
  averageMv: number;
  cheapManaSources: number;
  /** Total land credit subtracted for cheap mana sources. */
  credits: number;
  /** The formula value before rounding and clamping. */
  raw: number;
}

export interface SpellCopies {
  facts: CardFacts;
  qty: number;
}

function creditFor(
  facts: CardFacts,
  template: DeckTemplate,
  mdfc: LandRulesConfig['mdfc'] | undefined,
): number {
  const c = template.landFormula.credits;
  // A modal land face counts toward the land count only when the land rules say so.
  if (facts.mdfcLand) return mdfc?.landFaceCountsAsLand === false ? 0 : c.mdfcLand;
  const mv = facts.card.mv;
  switch (facts.manaSource) {
    case 'rock':
      return mv <= 2 ? c.rockCheap : c.rockThree;
    case 'dork':
      return mv <= 2 ? c.dorkCheap : c.dorkThree;
    case 'landRamp':
      return c.landRamp;
    default:
      return 0;
  }
}

/** lands = base + slope * (average mv - reference) - credits, rounded, clamped. */
export function planLandCount(
  template: DeckTemplate,
  spells: SpellCopies[],
  mdfc?: LandRulesConfig['mdfc'],
): LandPlan {
  const f = template.landFormula;
  let copies = 0;
  let mvTotal = 0;
  let credits = 0;
  let sources = 0;
  for (const { facts, qty } of spells) {
    copies += qty;
    mvTotal += facts.card.mv * qty;
    const credit = creditFor(facts, template, mdfc);
    if (credit > 0) {
      credits += credit * qty;
      sources += qty;
    }
  }
  const averageMv = copies > 0 ? mvTotal / copies : f.referenceMv;
  const raw = template.baseLands + f.slopePerMv * (averageMv - f.referenceMv) - credits;
  const count = Math.min(f.max, Math.max(f.min, Math.round(raw)));
  return {
    count,
    averageMv: Math.round(averageMv * 100) / 100,
    cheapManaSources: sources,
    credits: Math.round(credits * 100) / 100,
    raw: Math.round(raw * 100) / 100,
  };
}

export interface LandPick {
  candidate: Candidate;
  qty: number;
  why: string;
}

export interface ManaBase {
  nonbasics: LandPick[];
  basics: number;
  basicName: string;
  basicCard: CardRecord | undefined;
  notes: string[];
}

export class ManaBaseError extends Error {
  override name = 'ManaBaseError';
}

function producesOnlyColorless(card: CardRecord): boolean {
  const p = card.produces ?? [];
  return p.length === 0 || p.every((m) => m === 'C');
}

export interface NonbasicScore {
  score: number;
  why: string;
  colorlessOnly: boolean;
}

export function scoreNonbasic(
  card: CardRecord,
  color: Color,
  config: BulkBrewConfig,
): NonbasicScore {
  const r = config.landRules.nonbasic;
  const reasons: string[] = [];
  let score = 0;
  const colorlessOnly = producesOnlyColorless(card);
  if ((card.produces ?? []).includes(color)) {
    score += r.producesDeckColor;
    reasons.push(`produces ${color}`);
  } else if (colorlessOnly) {
    score += r.colorlessOnly;
    reasons.push('colorless only');
  }
  if (card.entersTapped) {
    score += r.entersTapped;
    reasons.push('enters tapped');
  }
  if (card.tags.includes('utility-land') || card.tags.includes('manland')) {
    score += r.utility;
    reasons.push('utility');
  }
  return { score, why: `Land: ${reasons.join(', ') || 'basic replacement'}`, colorlessOnly };
}

/**
 * Pick nonbasics from the pool by score, then fill with basics of the deck
 * color. Basics are unlimited unless the settings track them, in which case
 * the pool's basics (passed as candidates) bound the count.
 */
export function chooseManaBase(
  count: number,
  landCandidates: Candidate[],
  color: Color,
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  index: CardIndex,
): ManaBase {
  const rules = config.landRules.nonbasic;
  const key = String(size) as '60' | '40' | '20';
  const maxNonbasics = Math.floor(count * rules.maxShare);
  const maxColorless = rules.maxColorlessOnly[key];
  const basicName = config.landRules.basics.names[color];
  const basicCard = index.find(basicName);
  const notes: string[] = [];

  const scored = landCandidates
    .filter((c) => c.facts.land && !c.facts.mdfcLand && !c.facts.basic)
    .map((candidate) => ({ candidate, ...scoreNonbasic(candidate.facts.card, color, config) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.facts.card.name < b.candidate.facts.card.name ? -1 : 1) ||
        (a.candidate.facts.card.id < b.candidate.facts.card.id ? -1 : 1),
    );

  const nonbasics: LandPick[] = [];
  let taken = 0;
  let colorless = 0;
  const take = (minScore: number, limit: number) => {
    for (const s of scored) {
      if (s.score < minScore) continue;
      // The fallback must still add mana: skip lands that produce nothing.
      if ((s.candidate.facts.card.produces ?? []).length === 0) continue;
      if (nonbasics.some((n) => n.candidate === s.candidate)) continue;
      let qty = 0;
      while (qty < s.candidate.available && taken < limit && taken < count) {
        if (s.colorlessOnly && colorless >= maxColorless) break;
        qty++;
        taken++;
        if (s.colorlessOnly) colorless++;
      }
      if (qty > 0) nonbasics.push({ candidate: s.candidate, qty, why: s.why });
    }
  };
  take(rules.minScore, maxNonbasics);

  let basics = count - taken;
  if (!settings.unlimitedBasics) {
    const basicsInPool = landCandidates
      .filter((c) => c.facts.basic && c.facts.card.id === basicCard?.id)
      .reduce((n, c) => n + c.available, 0);
    if (basicsInPool < basics) {
      notes.push(`only ${basicsInPool} ${basicName} in the pool; adding more nonbasics`);
      // Fill the gap with lower-scored nonbasics before giving up.
      take(-Infinity, count);
      basics = Math.min(basicsInPool, count - taken);
      if (taken + basics < count) {
        throw new ManaBaseError(
          `Not enough lands: wanted ${count}, the pool has ${taken + basics} usable lands in ${color}.`,
        );
      }
    }
  }
  if (!basicCard) notes.push(`no card named ${basicName} in the card data`);
  return { nonbasics, basics, basicName, basicCard, notes };
}
