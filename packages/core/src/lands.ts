// Mana base: how many lands a deck wants, and which ones. The count comes
// from the template's land formula applied to the spells actually chosen;
// the lands come from the pool's nonbasics scored by the land rules, with
// basics filling the rest.

import { forSize, type BulkBrewConfig, type DeckTemplate, type LandRulesConfig } from './config.ts';
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

/** A land that fetches a basic rather than tapping for mana itself. */
export function isFetch(card: CardRecord): boolean {
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

/** Colors of the basic land types on a card's front face type line. */
function basicTypeColors(card: CardRecord): Color[] {
  const typeWords = (card.typeLine.split('//')[0] ?? '').split('—')[1] ?? '';
  return typeWords
    .toLowerCase()
    .split(/\s+/)
    .flatMap((word) => (Object.hasOwn(BASIC_TYPE_COLOR, word) ? [BASIC_TYPE_COLOR[word]!] : []));
}

/**
 * Whether an "Activate only if ..." mana condition holds in a deck of these
 * colors: one that asks for a basic land, or a basic land type of a deck
 * color. Any other condition does not.
 */
function manaConditionMet(condition: string, colors: readonly Color[]): boolean {
  if (/(?:^|or if )you control a basic land$/i.test(condition)) return colors.length > 0;
  const m = /^you control (an? \w+(?: or an? \w+)*)$/i.exec(condition);
  if (!m) return false;
  return m[1]!.split(' or ').some((w) => {
    const type = w.replace(/^an? /i, '').toLowerCase();
    return Object.hasOwn(BASIC_TYPE_COLOR, type) && colors.includes(BASIC_TYPE_COLOR[type]!);
  });
}

interface ManaLine {
  /** The cost before the colon, such as "{T}, Pay 1 life". */
  cost: string;
  /** What it adds, after "Add ". */
  what: string;
}

/**
 * The text's mana abilities, and those of them a deck of these colors can
 * count on: {T} with no other mana cost, nothing sacrificed, no limit on what
 * the mana may be spent on, and no condition the deck's basics do not meet.
 * Mana that depends on other permanents ("any color among legendary
 * permanents you control") does not count either.
 */
function manaLines(
  card: CardRecord,
  colors: readonly Color[],
): { any: boolean; steady: ManaLine[] } {
  const steady: ManaLine[] = [];
  let any = false;
  const text = card.text.replace(/\([^)]*\)/g, '');
  for (const line of text.split('\n')) {
    if (!/: Add /i.test(line)) continue;
    any = true;
    const m = /^(\{T\}(?:, [^:]*)?): Add (.+)$/i.exec(line.trim());
    if (!m || /\{\d+\}|\{[WUBRG]\}|sacrifice/i.test(m[1]!)) continue;
    if (/spend this mana only/i.test(line)) continue;
    if (/\bamong\b|that an? (?!land\b)\w+ you control could produce/i.test(m[2]!)) continue;
    const only = /Activate only if (.+?)\.?$/i.exec(line)?.[1];
    if (only && !manaConditionMet(only, colors)) continue;
    steady.push({ cost: m[1]!, what: m[2]! });
  }
  return { any, steady };
}

const ANY_COLOR = /any (one )?color|any type|chosen color/i;

/**
 * Colors a land makes directly in a deck of these colors: from basic land
 * types, and from the mana abilities `manaLines` counts on. Filter lands
 * ("{1}, {T}: Add one mana of any color") and restricted mana do not count;
 * "any color" counts as every color. Returns undefined when the text shows
 * no mana ability at all.
 */
export function landMana(card: CardRecord, colors: readonly Color[] = []): Set<Color> | undefined {
  const out = new Set<Color>(basicTypeColors(card));
  const { any, steady } = manaLines(card, colors);
  // Any mana ability means the text was read, even one this rule does not count.
  if (out.size === 0 && !any) return undefined;
  for (const { what } of steady) {
    if (ANY_COLOR.test(what)) for (const c of COLORS) out.add(c);
    for (const sym of what.matchAll(/\{([WUBRG])\}/g)) out.add(sym[1] as Color);
  }
  return out;
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
  const direct = landMana(card, colors);
  if (direct) return colors.filter((c) => direct.has(c));
  const p = card.produces ?? [];
  return colors.filter((c) => p.includes(c));
}

/** What the mana base knows about the deck a land would join. */
export interface LandDeck {
  colors: readonly Color[];
  size: DeckSize;
  /** The deck's style ids, such as "graveyard" or "tribal:Elf". */
  styles?: readonly string[] | undefined;
}

/** How a land enters in one deck. */
export interface LandEntry {
  /** Chance it enters tapped, from 0 to 1. */
  tapped: number;
  /** Life it lets you pay to enter untapped instead (shock lands); 0 when none. */
  life: number;
}

const COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

const countOf = (word: string) => COUNT_WORDS[word.toLowerCase()] ?? Number(word);

/** "Swamps" and "a Swamp" both read as the type "swamp"; "Plains" is its own plural. */
const typeWord = (word: string) =>
  word
    .replace(/^an? /i, '')
    .toLowerCase()
    .replace(/(?<!plain)s$/, '');

const PAY_LIFE = /you may pay (\d+) life\. If you don't, it enters (?:the battlefield )?tapped/i;
const REVEAL = /you may reveal (.+?) cards? from your hand/i;
const TAPPED_LINE = /\benters (?:the battlefield )?tapped\b/i;
const TAPPED_IF_LANDS =
  /^If you control (\w+) or more other lands, .+ enters (?:the battlefield )?tapped/i;
const UNLESS = /enters (?:the battlefield )?tapped unless (.+?)\.?$/i;

/**
 * How a land enters in this deck, read from its text. The pack marks every
 * land whose text says it enters tapped, conditions and all, so the
 * condition is read here against the deck: "unless you control a Swamp" and
 * "reveal a Swamp card" against the basics of its colors, "two or more other
 * lands" against the land drops of a typical game, "two or more opponents"
 * against Commander, "pay 2 life" as a life cost instead. A condition this
 * does not know reads as always tapped.
 */
export function landEntry(card: CardRecord, deck: LandDeck, config: BulkBrewConfig): LandEntry {
  if (!card.entersTapped) return { tapped: 0, life: 0 };
  const e = config.landRules.entering;
  const tapped = (chance: number): LandEntry => ({ tapped: chance, life: 0 });
  const text = card.text.replace(/\([^)]*\)/g, '');
  const runs = new Set<string>(
    deck.colors.map((c) => config.landRules.basics.names[c].toLowerCase()),
  );
  // A tribe's style id ("tribal:Elf") means the deck runs that creature type.
  for (const style of deck.styles ?? []) {
    const tribe = /^tribal:(.+)$/.exec(style)?.[1];
    if (tribe) runs.add(tribe.toLowerCase());
  }
  const anyRun = (list: string) => list.split(/,? or |, /).some((w) => runs.has(typeWord(w)));
  const played = forSize(e.landsPlayed, deck.size);
  // Of a typical game's land drops, the share this land would enter tapped on.
  const drops = (n: number) => Math.min(1, Math.max(0, n) / played);
  const commander = isCommanderSize(deck.size);

  const pay = PAY_LIFE.exec(text);
  if (pay) return { tapped: 0, life: Number(pay[1]) };
  const reveal = REVEAL.exec(text);
  if (reveal) return tapped(anyRun(reveal[1]!) ? e.revealFromHand : 1);
  const line = (text.split('\n').find((l) => TAPPED_LINE.test(l)) ?? '').trim();
  const late = TAPPED_IF_LANDS.exec(line);
  if (late) return tapped(drops(played - countOf(late[1]!)));
  const unless = UNLESS.exec(line)?.[1];
  if (!unless) return tapped(1);
  let m: RegExpExecArray | null;
  if (/^you control a basic land$/i.test(unless)) return tapped(e.basicInPlay);
  if (/^you control a legendary creature$/i.test(unless))
    return tapped(commander ? e.legendInPlay : 1);
  if (/^you have two or more opponents$/i.test(unless)) return tapped(commander ? 0 : 1);
  if (/^a player has \d+ or less life$/i.test(unless)) return tapped(e.lowLife);
  if ((m = /^you control (\w+) or more basic lands$/i.exec(unless)))
    return tapped(drops(countOf(m[1]!)));
  if ((m = /^you control (\w+) or more other lands$/i.exec(unless)))
    return tapped(drops(countOf(m[1]!)));
  if ((m = /^you control (\w+) or fewer other lands$/i.exec(unless)))
    return tapped(drops(played - countOf(m[1]!) - 1));
  if ((m = /^you control (\w+) or more other (\w+)$/i.exec(unless)))
    return tapped(runs.has(typeWord(m[2]!)) ? drops(countOf(m[1]!)) : 1);
  if ((m = /^you control (an? \w+(?: or (?:an? )?\w+)*)$/i.exec(unless)))
    return tapped(anyRun(m[1]!) ? e.basicInPlay : 1);
  return tapped(1);
}

/**
 * Life paid each time the land taps for a deck color, the cheapest way it
 * makes one: "{T}, Pay 1 life: Add {B}", a painland's damage, or City of
 * Brass's. A basic land type of a deck color taps for it free.
 */
export function lifePerTap(card: CardRecord, colors: readonly Color[]): number {
  const text = card.text.replace(/\([^)]*\)/g, '');
  const always = Number(/becomes tapped, it deals (\d+) damage to you/i.exec(text)?.[1] ?? 0);
  if (basicTypeColors(card).some((c) => colors.includes(c))) return always;
  let least = Infinity;
  for (const { cost, what } of manaLines(card, colors).steady) {
    if (!ANY_COLOR.test(what) && !colors.some((c) => what.includes(`{${c}}`))) continue;
    const life =
      Number(/pay (\d+) life/i.exec(cost)?.[1] ?? 0) +
      Number(/deals (\d+) damage to you/i.exec(what)?.[1] ?? 0);
    least = Math.min(least, life);
  }
  return (least === Infinity ? 0 : least) + always;
}

/** Lands whose mana depends on a draft (Paliano, the High City) make none in a built deck. */
export function draftOnly(card: CardRecord): boolean {
  return card.tags.includes('draft-matters') || /\bas you draft\b/i.test(card.text);
}

const isUtility = (card: CardRecord) =>
  card.tags.includes('utility-land') || card.tags.includes('manland');

/**
 * Whether a land has an ability beyond its mana abilities, how it enters, and
 * what it does once as it enters: "When this land enters, surveil 1" is a
 * one-time rider, not a plan; Dakmor Salvage's dredge is.
 */
function lastingAbility(card: CardRecord): boolean {
  const text = card.text.replace(/\([^)]*\)/g, '').replaceAll(card.name, 'this land');
  // Mode lines ("• Surveil 1.") belong to the ability above them.
  return text.split('\n').some((raw) => {
    const line = raw.trim();
    return (
      line !== '' &&
      !line.startsWith('•') &&
      !/^[^:]*: Add /i.test(line) &&
      !TAPPED_LINE.test(line) &&
      !/^(?:When |As )?this land enters\b/i.test(line)
    );
  });
}

/** The land note's words for a chance to enter tapped; none for a land that reads as untapped. */
function tappedWords(chance: number, config: BulkBrewConfig): string | undefined {
  if (chance <= config.landRules.entering.readsUntapped) return undefined;
  return chance >= 1 ? 'enters tapped' : 'sometimes enters tapped';
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
  styles: readonly string[] = [],
): NonbasicScore {
  if (colors.length <= 1) return scoreMono(card, colors, config, size, styles);
  const r = config.landRules.nonbasic;
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
  const tapped = isFetch(card) ? 1 : landEntry(card, { colors, size, styles }, config).tapped;
  score += tapped * config.landRules.colors.entersTappedMulticolor;
  const words = tappedWords(tapped, config);
  if (words) reasons.push(words);
  if (isUtility(card)) {
    score += r.utility;
    reasons.push('utility');
  }
  return { score, why: `Land: ${reasons.join(', ') || 'basic replacement'}`, colorlessOnly };
}

/**
 * A one-color deck scores a nonbasic against the basic it replaces, so the
 * basic scores 0: making the deck color or any color gains nothing, and
 * entering tapped, paying life, a drawback, or making no deck color all cost.
 * Utility gains only on a land that costs nothing against a basic, or when
 * one of the land's tags helps one of the deck's styles.
 */
function scoreMono(
  card: CardRecord,
  colors: readonly Color[],
  config: BulkBrewConfig,
  size: DeckSize,
  styles: readonly string[],
): NonbasicScore {
  const r = config.landRules.nonbasic;
  const m = config.landRules.mono;
  const reasons: string[] = [];
  let cost = 0;
  const makes = landColors(card, colors, size);
  const colorlessOnly =
    makes.length === 0 && ((card.produces ?? []).length > 0 || producesOnlyColorless(card));
  if (makes.length > 0) reasons.push(`produces ${makes.join('')}`);
  else {
    cost += m.noDeckColor;
    reasons.push(colorlessOnly ? 'colorless only' : 'no deck color');
  }
  const entry = landEntry(card, { colors, size, styles }, config);
  if (entry.life > 0) {
    // Pay the life or enter tapped, whichever costs less.
    cost += Math.max(r.entersTapped, entry.life * m.lifeToEnter);
    reasons.push(`pays ${entry.life} life or enters tapped`);
  } else {
    cost += entry.tapped * r.entersTapped;
    const words = tappedWords(entry.tapped, config);
    if (words) reasons.push(words);
  }
  const life = makes.length > 0 ? lifePerTap(card, colors) : 0;
  if (life > 0) {
    cost += life * m.lifePerTap;
    reasons.push(`costs ${life} life to tap`);
  }
  const drawback = m.drawbackTags.some((t) => card.tags.includes(t));
  if (drawback) {
    cost += m.drawback;
    reasons.push('drawback');
  }
  const free =
    makes.length > 0 &&
    entry.life === 0 &&
    entry.tapped <= config.landRules.entering.readsUntapped &&
    life === 0 &&
    !drawback;
  // An ability that asks for mana of another color does nothing in this deck.
  const fits = card.identity.every((c) => colors.includes(c));
  const plan =
    fits &&
    lastingAbility(card) &&
    styles.some((s) => (m.planTags[s] ?? []).some((t) => card.tags.includes(t)));
  const gain = Math.max(plan ? m.planUtility : 0, fits && free && isUtility(card) ? r.utility : 0);
  if (gain > 0) reasons.push(plan && gain === m.planUtility ? 'helps the plan' : 'utility');
  return { score: gain + cost, why: `Land: ${reasons.join(', ')}`, colorlessOnly };
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
 * pool's basics (passed as candidates) bound each color. `styles` are the
 * deck's style ids, which decide whether a land's ability helps its plan.
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
  styles: readonly string[] = [],
): ManaBase {
  const rules = config.landRules.nonbasic;
  const colors = plan.colors;
  const multi = colors.length > 1;
  const shareByCount = config.landRules.colors.nonbasicMaxShare;
  const maxShare = multi ? (shareByCount[String(colors.length)] ?? rules.maxShare) : rules.maxShare;
  const maxNonbasics = Math.floor(count * maxShare);
  const maxColorless = forSize(rules.maxColorlessOnly, size);
  const minScore = multi ? rules.minScore : config.landRules.mono.minScore;
  const notes: string[] = [];

  // Draft-only lands stay out of the fallback too: they make no mana.
  const scored = landCandidates
    .filter((c) => c.facts.land && !c.facts.mdfcLand && !c.facts.basic && !draftOnly(c.facts.card))
    .map((candidate) => ({
      candidate,
      ...scoreNonbasic(candidate.facts.card, colors, config, size, styles),
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
  // Each copy counts its chance to enter tapped, so a check land of the deck colors adds little.
  const tappedChance = (card: CardRecord) =>
    multi && isFetch(card) ? 1 : landEntry(card, { colors, size, styles }, config).tapped;
  const take = (least: number, limit: number, copies: 'preferred' | 'available') => {
    for (const s of scored) {
      if (s.score < least) continue;
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
      const slow = tappedChance(card);
      while (qty < most && taken < limit && taken < count) {
        if (s.colorlessOnly && colorless >= maxColorless) break;
        // The fallback ignores the tapped cap: a slow land beats running short of lands.
        if (slow > 0 && tapped + slow > maxTapped + 1e-9 && least > -Infinity) break;
        qty++;
        taken++;
        if (s.colorlessOnly) colorless++;
        tapped += slow;
      }
      if (already) already.qty = qty;
      else if (qty > before) nonbasics.push({ candidate: s.candidate, qty, why: s.why });
    }
  };
  take(minScore, maxNonbasics, 'preferred');

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
