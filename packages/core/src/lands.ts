// Mana base: how many lands a deck wants, and which ones. The count comes
// from the template's land formula applied to the spells actually chosen;
// the lands come from the pool's nonbasics scored by the land rules, with
// basics filling the rest.

import type { BulkBrewConfig, DeckTemplate, LandRulesConfig } from './config.ts';
import type { Candidate, CardFacts } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import { isCommanderSize, pipDemand, sourcesNeeded } from './colors.ts';
import { needsCommander } from './matchers.ts';
import {
  COLOR_LABELS,
  COLORS,
  type CardRecord,
  type Color,
  type DeckSize,
  type Settings,
} from './types.ts';

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
  /** Basic land copies per color. */
  basics: Partial<Record<Color, number>>;
  /** Lands that can make each deck color. */
  sources: Partial<Record<Color, number>>;
  /** Sources each color wants so its most demanding spell casts on curve (multi-color only). */
  wanted: Partial<Record<Color, number>>;
  notes: string[];
}

export class ManaBaseError extends Error {
  override name = 'ManaBaseError';
}

export type ColorRole = 'main' | 'secondary' | 'splash';

/** The deck's colors, the main one first, and how much each is asked to carry. */
export interface ColorPlan {
  colors: Color[];
  main: Color;
  role: Partial<Record<Color, ColorRole>>;
}

function producesOnlyColorless(card: CardRecord): boolean {
  const p = card.produces ?? [];
  return p.length === 0 || p.every((m) => m === 'C');
}

function isFetch(card: CardRecord): boolean {
  return (
    (card.produces ?? []).length === 0 &&
    (card.tags.includes('fetchland') || card.tags.includes('tutor-land-basic'))
  );
}

const BASIC_TYPE_COLOR: Record<string, Color> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
};

/**
 * Colors a land makes directly: from basic land types, and from abilities
 * that tap for mana with no other mana cost and no limit on what the mana
 * may be spent on. Filter lands ("{1}, {T}: Add one mana of any color") and
 * restricted mana do not count; "any color" counts as every color. Returns
 * undefined when the text shows no mana ability at all.
 */
export function landMana(card: CardRecord): Set<Color> | undefined {
  const out = new Set<Color>();
  let found = false;
  const typeWords = (card.typeLine.split('//')[0] ?? '').split('—')[1] ?? '';
  for (const word of typeWords.toLowerCase().split(/\s+/)) {
    const c = BASIC_TYPE_COLOR[word];
    if (c) {
      out.add(c);
      found = true;
    }
  }
  const text = card.text.replace(/\([^)]*\)/g, '');
  for (const line of text.split('\n')) {
    if (!/: Add /i.test(line)) continue;
    // Any mana ability means the text was read, even one this rule does not count.
    found = true;
    const m = /^\{T\}(?:, [^:]*)?: Add (.+)$/i.exec(line.trim());
    if (!m || /\{\d+\}|\{[WUBRG]\}/.test(line.split(':')[0]!)) continue;
    if (/spend this mana only/i.test(line)) continue;
    const what = m[1]!;
    if (/any (one )?color|any type|chosen color/i.test(what)) for (const c of COLORS) out.add(c);
    for (const sym of what.matchAll(/\{([WUBRG])\}/g)) out.add(sym[1] as Color);
  }
  return found ? out : undefined;
}

/** Basic land colors a fetching land can find: its named types, or every color. */
function fetchColors(card: CardRecord): Color[] {
  const named = Object.entries(BASIC_TYPE_COLOR)
    .filter(([type]) => card.tags.includes(`tutor-land-basic-${type}`))
    .map(([, c]) => c);
  return named.length > 0 ? named : [...COLORS];
}

/**
 * Deck colors a land can make. A land that fetches basics makes the deck
 * colors it can find, but only counts in multi-color decks: in a mono deck it
 * is a slow basic. Without readable mana text, Scryfall's produced mana stands in.
 */
export function landColors(card: CardRecord, colors: readonly Color[], size: DeckSize): Color[] {
  if (!isCommanderSize(size) && needsCommander(card)) return [];
  if (isFetch(card)) {
    if (colors.length < 2) return [];
    const can = fetchColors(card);
    return colors.filter((c) => can.includes(c));
  }
  const direct = landMana(card);
  if (direct) return colors.filter((c) => direct.has(c));
  const p = card.produces ?? [];
  return colors.filter((c) => p.includes(c));
}

export interface NonbasicScore {
  score: number;
  why: string;
  colorlessOnly: boolean;
}

export function scoreNonbasic(
  card: CardRecord,
  colors: readonly Color[],
  config: BulkBrewConfig,
  size: DeckSize,
): NonbasicScore {
  const r = config.landRules.nonbasic;
  const multi = colors.length > 1;
  const reasons: string[] = [];
  let score = 0;
  const makes = landColors(card, colors, size);
  const colorlessOnly =
    makes.length === 0 && ((card.produces ?? []).length > 0 || producesOnlyColorless(card));
  if (makes.length > 0) {
    score +=
      r.producesDeckColor + (makes.length - 1) * config.landRules.colors.producesExtraDeckColor;
    reasons.push(`produces ${makes.join('')}`);
  } else if (colorlessOnly) {
    score += r.colorlessOnly;
    reasons.push('colorless only');
  }
  if (card.entersTapped || (multi && isFetch(card))) {
    score += multi ? config.landRules.colors.entersTappedMulticolor : r.entersTapped;
    reasons.push('enters tapped');
  }
  if (card.tags.includes('utility-land') || card.tags.includes('manland')) {
    score += r.utility;
    reasons.push('utility');
  }
  return { score, why: `Land: ${reasons.join(', ') || 'basic replacement'}`, colorlessOnly };
}

/**
 * Sources each color wants: for every spell, the sources that cast it on
 * curve with the color role's target chance; the most demanding spell sets
 * the want. Mono decks want every land.
 */
export function colorWants(
  spells: SpellCopies[],
  plan: ColorPlan,
  size: DeckSize,
  lands: number,
  config: BulkBrewConfig,
): Partial<Record<Color, number>> {
  const want: Partial<Record<Color, number>> = {};
  if (plan.colors.length === 1) {
    want[plan.main] = lands;
    return want;
  }
  const chance = config.landRules.colors.castChance;
  const prefer = [plan.main, ...plan.colors.filter((c) => c !== plan.main)];
  for (const { facts, qty } of spells) {
    if (qty <= 0) continue;
    const demand = pipDemand(facts.card, prefer);
    for (const c of plan.colors) {
      const pips = demand[c] ?? 0;
      if (pips === 0) continue;
      const target = chance[plan.role[c] ?? 'secondary'];
      const need = sourcesNeeded(
        size,
        lands,
        pips,
        Math.ceil(facts.card.mv),
        target,
        isCommanderSize(size),
      );
      want[c] = Math.max(want[c] ?? 0, need);
    }
  }
  return want;
}

/**
 * Pick nonbasics from the pool by score, then fill with basics. Mono decks
 * take basics of their color. Multi-color decks give basics first to the
 * colors furthest below what their spells want, then by colored pips.
 * Basics are unlimited unless the settings track them, in which case the
 * pool's basics (passed as candidates) bound each color.
 */
export function chooseManaBase(
  count: number,
  landCandidates: Candidate[],
  plan: ColorPlan,
  spells: SpellCopies[],
  config: BulkBrewConfig,
  settings: Settings,
  size: DeckSize,
  index: CardIndex,
): ManaBase {
  const rules = config.landRules.nonbasic;
  const colors = plan.colors;
  const multi = colors.length > 1;
  const key = String(size) as '60' | '40' | '20';
  const shareByCount = config.landRules.colors.nonbasicMaxShare;
  const maxShare = multi ? (shareByCount[String(colors.length)] ?? rules.maxShare) : rules.maxShare;
  const maxNonbasics = Math.floor(count * maxShare);
  const maxColorless = rules.maxColorlessOnly[key] ?? 0;
  const notes: string[] = [];

  const scored = landCandidates
    .filter((c) => c.facts.land && !c.facts.mdfcLand && !c.facts.basic)
    .map((candidate) => ({
      candidate,
      ...scoreNonbasic(candidate.facts.card, colors, config, size),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.facts.card.name < b.candidate.facts.card.name ? -1 : 1) ||
        (a.candidate.facts.card.id < b.candidate.facts.card.id ? -1 : 1),
    );

  const nonbasics: LandPick[] = [];
  // Basics available per color: unlimited, or what the pool holds.
  const basicIds = new Map<Color, string | undefined>(
    colors.map((c) => [c, index.find(config.landRules.basics.names[c])?.id]),
  );
  const inPool = (c: Color) =>
    landCandidates
      .filter((x) => x.facts.basic && x.facts.card.id === basicIds.get(c))
      .reduce((n, x) => n + x.available, 0);
  const cap = new Map<Color, number>(
    colors.map((c) => [c, settings.unlimitedBasics ? Infinity : inPool(c)]),
  );

  let taken = 0;
  let colorless = 0;
  let tapped = 0;
  const tappedShare = config.landRules.colors.tappedMaxShare[String(colors.length)];
  const maxTapped = multi && tappedShare !== undefined ? Math.floor(count * tappedShare) : Infinity;
  const isTapped = (card: CardRecord) => Boolean(card.entersTapped) || (multi && isFetch(card));
  const take = (minScore: number, limit: number, copies: 'preferred' | 'available') => {
    for (const s of scored) {
      if (s.score < minScore) continue;
      // The fallback must still add mana: skip lands that make no usable mana.
      const card = s.candidate.facts.card;
      if (landColors(card, colors, size).length === 0 && (card.produces ?? []).length === 0)
        continue;
      if (!isCommanderSize(size) && needsCommander(card)) continue;
      // A fetch land needs a basic of a color it can find.
      if (isFetch(card) && !landColors(card, colors, size).some((c) => (cap.get(c) ?? 0) > 0))
        continue;
      const already = nonbasics.find((n) => n.candidate === s.candidate);
      const most = copies === 'preferred' ? s.candidate.preferred : s.candidate.available;
      let qty = already?.qty ?? 0;
      const before = qty;
      const slow = isTapped(card);
      while (qty < most && taken < limit && taken < count) {
        if (s.colorlessOnly && colorless >= maxColorless) break;
        // The fallback ignores the tapped cap: a slow land beats running short of lands.
        if (slow && tapped >= maxTapped && minScore > -Infinity) break;
        qty++;
        taken++;
        if (s.colorlessOnly) colorless++;
        if (slow) tapped++;
      }
      if (already) already.qty = qty;
      else if (qty > before) nonbasics.push({ candidate: s.candidate, qty, why: s.why });
    }
  };
  take(rules.minScore, maxNonbasics, 'preferred');

  const sources: Partial<Record<Color, number>> = {};
  const addSources = (pick: LandPick) => {
    for (const c of landColors(pick.candidate.facts.card, colors, size))
      sources[c] = (sources[c] ?? 0) + pick.qty;
  };

  let need = count - taken;
  const totalCap = [...cap.values()].reduce((a, b) => a + b, 0);
  if (totalCap < need) {
    notes.push(
      multi
        ? `only ${totalCap} basic lands of the deck colors in the pool; adding more nonbasics`
        : `only ${totalCap} ${config.landRules.basics.names[plan.main]} in the pool; adding more nonbasics`,
    );
    take(-Infinity, count - totalCap, 'available');
    need = count - taken;
    if (totalCap < need) {
      throw new ManaBaseError(
        `Not enough lands: wanted ${count}, the pool has ${taken + totalCap} usable lands in ${colors.join('')}.`,
      );
    }
  }
  for (const pick of nonbasics) if (!multi || !isFetch(pick.candidate.facts.card)) addSources(pick);
  const fetchFor: Partial<Record<Color, number>> = {};
  if (multi) {
    for (const pick of nonbasics) {
      if (!isFetch(pick.candidate.facts.card)) continue;
      for (const c of landColors(pick.candidate.facts.card, colors, size))
        fetchFor[c] = (fetchFor[c] ?? 0) + pick.qty;
    }
  }

  const wanted = colorWants(spells, plan, size, count, config);
  const basics: Partial<Record<Color, number>> = {};
  if (!multi) {
    if (need > 0) basics[plan.main] = need;
    sources[plan.main] = (sources[plan.main] ?? 0) + need;
  } else {
    // Colored pips per color, for the split once every color has what it wants.
    const prefer = [plan.main, ...colors.filter((c) => c !== plan.main)];
    const pips: Partial<Record<Color, number>> = {};
    for (const { facts, qty } of spells) {
      const d = pipDemand(facts.card, prefer);
      for (const c of colors) pips[c] = (pips[c] ?? 0) + (d[c] ?? 0) * qty;
    }
    const order = prefer;
    for (let i = 0; i < need; i++) {
      const open = order.filter((c) => (basics[c] ?? 0) < (cap.get(c) ?? 0));
      const have = (c: Color) =>
        (sources[c] ?? 0) + ((basics[c] ?? 0) > 0 ? (fetchFor[c] ?? 0) : 0);
      const short = open
        .map((c) => ({ c, gap: ((wanted[c] ?? 0) - have(c)) / Math.max(1, wanted[c] ?? 0) }))
        .filter((x) => x.gap > 0);
      let pick: Color;
      if (short.length > 0) {
        pick = short.reduce((a, b) => (b.gap > a.gap ? b : a)).c;
      } else {
        pick = open.reduce((a, b) =>
          (pips[b] ?? 0) / (have(b) + 1) > (pips[a] ?? 0) / (have(a) + 1) ? b : a,
        );
      }
      basics[pick] = (basics[pick] ?? 0) + 1;
      sources[pick] = (sources[pick] ?? 0) + 1;
    }
    // Fetch lands now count for every color they can find a basic of.
    for (const c of colors)
      if ((basics[c] ?? 0) > 0) sources[c] = (sources[c] ?? 0) + (fetchFor[c] ?? 0);
    const parts = colors.map((c) => `${COLOR_LABELS[c]} ${sources[c] ?? 0}`);
    notes.push(`Colored sources: ${parts.join(', ')}.`);
    for (const c of colors) {
      const w = wanted[c] ?? 0;
      if ((sources[c] ?? 0) < w) {
        notes.push(
          `${COLOR_LABELS[c]} mana is stretched: ${sources[c] ?? 0} sources where ${w} would cast its spells on curve reliably.`,
        );
      }
    }
  }
  for (const c of colors) {
    if ((basics[c] ?? 0) > 0 && !basicIds.get(c))
      notes.push(`no card named ${config.landRules.basics.names[c]} in the card data`);
  }
  return { nonbasics, basics, sources, wanted, notes };
}
