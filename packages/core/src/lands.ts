// Mana base: how many lands a deck wants, and which ones. The count comes
// from the template's land formula applied to the spells actually chosen;
// the lands come from the pool's nonbasics scored by the land rules, with
// basics filling the rest.

import {
  addSupply,
  landEntryReading,
  landHasUse,
  landText,
  landUtilityEarned,
  lineConditions,
  needMet,
  type DeckSupply,
  type NeedRef,
} from './card-needs.ts';
import { forSize, type BulkBrewConfig, type DeckTemplate, type LandRulesConfig } from './config.ts';
import type { Candidate, CardFacts } from './candidates.ts';
import type { CardIndex } from './pack.ts';
import { isCommanderSize, pipDemand, sourcesNeeded } from './colors.ts';
import { needsCommander } from './matchers.ts';
import { matchCard, themeRulesFor } from './theme-rules.ts';
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
  /** Sources each color wants so its spells cast on curve, by colorWants (multi-color only). */
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
 * What a deck of these colors supplies when its spells are not known: its
 * colors (and so its basic land types), its size, and a commander at 100.
 */
export function colorsSupply(colors: readonly Color[], size: DeckSize): DeckSupply {
  return {
    size,
    colors: [...colors],
    commander: isCommanderSize(size),
    counts: new Map(),
    devotion: new Map(),
  };
}

/** What a deck's spells (and commander, when listed among them) supply, for the land rules. */
export function spellsSupply(
  spells: readonly SpellCopies[],
  colors: readonly Color[],
  size: DeckSize,
  config: BulkBrewConfig,
): DeckSupply {
  const supply = colorsSupply(colors, size);
  for (const { facts, qty } of spells) if (qty > 0) addSupply(supply, facts.card, qty, config);
  return supply;
}

/**
 * Whether an "Activate only if ..." mana condition holds in the deck, as the
 * card needs reader reads it: every resource it names met ("you control an
 * Island or a Swamp" by a deck of either color, "a basic land" by any deck).
 * With no resource named, a condition on game state (Mirrex's "this land
 * entered this turn") is no steady source; otherwise nothing is asked.
 */
function manaConditionMet(
  card: CardRecord,
  line: string,
  supply: DeckSupply,
  config: BulkBrewConfig,
): boolean {
  const read = lineConditions(card, config, line);
  if (!read) return false;
  if (read.refs.length === 0) return !read.gameState;
  return read.refs.every((r) => needMet(r, supply, card, config));
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
  supply: DeckSupply,
  config: BulkBrewConfig,
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
    if (/Activate only if /i.test(line) && !manaConditionMet(card, line, supply, config)) continue;
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
export function landMana(
  card: CardRecord,
  supply: DeckSupply,
  config: BulkBrewConfig,
): Set<Color> | undefined {
  const out = new Set<Color>(basicTypeColors(card));
  const { any, steady } = manaLines(card, supply, config);
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
 * is a slow basic. Without readable mana text, Scryfall's produced mana stands
 * in. `supply` is what the deck supplies, for "Activate only if" conditions;
 * without it, the deck's colors alone.
 */
export function landColors(
  card: CardRecord,
  colors: readonly Color[],
  size: DeckSize,
  config: BulkBrewConfig,
  supply: DeckSupply = colorsSupply(colors, size),
): Color[] {
  if (!isCommanderSize(size) && needsCommander(card)) return [];
  if (isFetch(card)) {
    if (colors.length < 2) return [];
    const can = fetchColors(card);
    return colors.filter((c) => can.includes(c));
  }
  const direct = landMana(card, supply, config);
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
  /** What the deck's spells supply, for conditions such as "a legendary creature"; colors alone without it. */
  supply?: DeckSupply | undefined;
}

/** How a land enters in one deck. */
export interface LandEntry {
  /** Chance it enters tapped, from 0 to 1. */
  tapped: number;
  /** Life it lets you pay to enter untapped instead (shock lands); 0 when none. */
  life: number;
}

/**
 * How a land enters in this deck. The card needs reader reads the tapped line
 * (landEntryReading); this turns it into a chance against the deck: a
 * resource condition by what the deck supplies ("unless you control a Swamp"
 * against its basics, "you may reveal a Dragon card" against its Dragons, "a
 * legendary creature" against its legends or a commander, "two or more
 * opponents" against Commander), land counts against the land drops of a
 * typical game, "pay 2 life" as a life cost instead. The chance weights are
 * the land rules'. A condition the reader does not read stays tapped.
 */
export function landEntry(card: CardRecord, deck: LandDeck, config: BulkBrewConfig): LandEntry {
  if (!card.entersTapped) return { tapped: 0, life: 0 };
  const e = config.landRules.entering;
  const tapped = (chance: number): LandEntry => ({ tapped: chance, life: 0 });
  const played = forSize(e.landsPlayed, deck.size);
  // Of a typical game's land drops, the share this land would enter tapped on.
  const drops = (n: number) => Math.min(1, Math.max(0, n) / played);
  const commander = isCommanderSize(deck.size);
  const read = landEntryReading(card, config);
  switch (read.shape) {
    case 'life':
      return { tapped: 0, life: read.life ?? 0 };
    case 'lowLife':
      return tapped(e.lowLife);
    case 'lands': {
      const l = read.lands ?? {};
      if (l.atLeast !== undefined) return tapped(drops(l.atLeast));
      if (l.atMost !== undefined) return tapped(drops(played - l.atMost - 1));
      return tapped(drops(played - (l.tappedFrom ?? 0)));
    }
    case 'unless':
    case 'reveal': {
      const supply = deck.supply ?? colorsSupply(deck.colors, deck.size);
      // A tribe's style id ("tribal:Elf") means the deck runs that creature type.
      const tribes = new Set(
        (deck.styles ?? []).flatMap((s) => {
          const t = /^tribal:(.+)$/.exec(s)?.[1];
          return t ? [`tribe:${t}`] : [];
        }),
      );
      const reveal = read.shape === 'reveal';
      const chance = (read: NeedRef): number => {
        // A land entering cannot meet its own condition (Argoth is legendary but not a creature).
        const r: NeedRef = { ...read, self: false };
        delete r.selfVia;
        if (r.anyOf.includes('format:multiplayer')) return commander ? 0 : 1;
        // A legendary creature: the commander is one; else the deck's own legends.
        if (r.anyOf.includes('type:legendary'))
          return commander || needMet({ ...r, anyOf: ['type:legendary'] }, supply, card, config)
            ? e.legendInPlay
            : 1;
        const met = r.anyOf.some((x) => tribes.has(x)) || needMet(r, supply, card, config);
        if (!met) return 1;
        if (reveal) return e.revealFromHand;
        // "Two or more basic lands", "three or more other Mountains": that many land drops.
        if (r.anyOf.every((x) => x.startsWith('land:')) && (r.count ?? 1) > 1)
          return drops(r.count!);
        return r.anyOf.every((x) => x.startsWith('land:') || x.startsWith('tribe:'))
          ? e.basicInPlay
          : e.legendInPlay;
      };
      return tapped(Math.min(...read.refs.map(chance)));
    }
    default:
      return tapped(1);
  }
}

/**
 * Life paid each time the land taps for a deck color, the cheapest way it
 * makes one: "{T}, Pay 1 life: Add {B}", a painland's damage, or City of
 * Brass's. A basic land type of a deck color taps for it free.
 */
export function lifePerTap(
  card: CardRecord,
  colors: readonly Color[],
  config: BulkBrewConfig,
  supply: DeckSupply = colorsSupply(colors, 60),
): number {
  const text = card.text.replace(/\([^)]*\)/g, '');
  const always = Number(/becomes tapped, it deals (\d+) damage to you/i.exec(text)?.[1] ?? 0);
  if (basicTypeColors(card).some((c) => colors.includes(c))) return always;
  let least = Infinity;
  for (const { cost, what } of manaLines(card, supply, config).steady) {
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

const isUtility = (card: CardRecord) => card.tags.includes('utility-land');

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

/**
 * A nonbasic land's score in a deck of these colors. `supply` is what the
 * deck's spells supply, for conditions on how the land enters or what its
 * mana asks for, and in a one-color deck for whether its own abilities do
 * anything (Trenzalore Clocktower's needs a Time Lord). Without it, the colors
 * alone. Multi-color utility still reads the tag alone.
 */
export function scoreNonbasic(
  card: CardRecord,
  colors: readonly Color[],
  config: BulkBrewConfig,
  size: DeckSize,
  styles: readonly string[] = [],
  supply: DeckSupply = colorsSupply(colors, size),
): NonbasicScore {
  if (colors.length <= 1) return scoreMono(card, colors, config, size, styles, supply);
  const r = config.landRules.nonbasic;
  const reasons: string[] = [];
  let score = 0;
  const makes = landColors(card, colors, size, config, supply);
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
  const tapped = isFetch(card)
    ? 1
    : landEntry(card, { colors, size, styles, supply }, config).tapped;
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
 * A land's tags, with `creatureland` added for a land whose text makes it a
 * creature: the tag is on the colorless creature lands only (Mutavault, not
 * Treetop Village).
 */
function landTags(card: CardRecord): readonly string[] {
  if (card.tags.includes('creatureland')) return card.tags;
  return /\bthis land becomes an? [^.]*\bcreature\b/i.test(landText(card))
    ? [...card.tags, 'creatureland']
    : card.tags;
}

/** Whether the theme rules give a land a setup or payoff job in one of these styles. */
function themeWork(
  card: CardRecord,
  styles: readonly string[],
  config: BulkBrewConfig,
  size: DeckSize,
): boolean {
  const rules = themeRulesFor(config).styles;
  return styles.some((s) => {
    const style = rules.get(s);
    const job = style && matchCard(card, style, size);
    return job !== undefined && job.as !== 'excluded';
  });
}

/**
 * A one-color deck scores a nonbasic against the basic it replaces, so the
 * basic scores 0: making the deck color or any color gains nothing, and paying
 * life, a drawback, or making no deck color all cost. Entering tapped costs
 * `nonbasic.entersTapped` by its chance here, 0 in the shipped rules: a tapped
 * dual stays out because its second color does nothing here, and a tapped land
 * with an ability is judged on what the ability does. An ability the card
 * needs reader says works in this deck gains, more when it does theme work for
 * one of the deck's styles. A land that makes only colorless mana gains only
 * when it helps the plan.
 */
function scoreMono(
  card: CardRecord,
  colors: readonly Color[],
  config: BulkBrewConfig,
  size: DeckSize,
  styles: readonly string[],
  supply: DeckSupply,
): NonbasicScore {
  const r = config.landRules.nonbasic;
  const m = config.landRules.mono;
  const reasons: string[] = [];
  let cost = 0;
  const makes = landColors(card, colors, size, config, supply);
  const colorlessOnly =
    makes.length === 0 && ((card.produces ?? []).length > 0 || producesOnlyColorless(card));
  const colorless = makes.length === 0 && producesOnlyColorless(card);
  if (makes.length > 0) reasons.push(`produces ${makes.join('')}`);
  else if (colorless) {
    cost += m.colorlessOnly;
    reasons.push('colorless only');
  } else {
    cost += m.noDeckColor;
    reasons.push('no deck color');
  }
  const entry = landEntry(card, { colors, size, styles, supply }, config);
  if (entry.life > 0) {
    // Pay the life or enter tapped, whichever costs less.
    cost += Math.max(r.entersTapped, entry.life * m.lifeToEnter);
    reasons.push(`pays ${entry.life} life or enters tapped`);
  } else {
    cost += entry.tapped * r.entersTapped;
    const words = tappedWords(entry.tapped, config);
    if (words) reasons.push(words);
  }
  const life = makes.length > 0 ? lifePerTap(card, colors, config, supply) : 0;
  if (life > 0) {
    cost += life * m.lifePerTap;
    reasons.push(`costs ${life} life to tap`);
  }
  const drawback = m.drawbackTags.some((t) => card.tags.includes(t));
  if (drawback) {
    cost += m.drawback;
    reasons.push('drawback');
  }
  // An ability that asks for mana of another color does nothing in this deck, nor
  // one whose needs the deck does not meet (the reader reads the land's text).
  const fits = card.identity.every((c) => colors.includes(c));
  const lasting = fits && landUtilityEarned(card, supply, config);
  // A land with no ability does a style's job by its types alone (an artifact land).
  const typeOnly = fits && !landHasUse(card, config);
  const tags = landTags(card);
  const plan =
    (lasting && styles.some((s) => (m.planTags[s] ?? []).some((t) => tags.includes(t)))) ||
    ((lasting || typeOnly) && themeWork(card, styles, config, size));
  // A colorless land costs a source of the deck color, so only the plan pays for it. A land of
  // the deck color also counts what it does as it enters and beyond its mana.
  const earned = !colorless && fits && landUtilityEarned(card, supply, config, true);
  const gain = Math.max(plan ? m.planUtility : 0, earned ? r.utility : 0);
  if (gain > 0) reasons.push(plan && gain === m.planUtility ? 'helps the plan' : 'utility');
  return { score: gain + cost, why: `Land: ${reasons.join(', ')}`, colorlessOnly };
}

/**
 * Sources each color wants: for every spell, the sources that cast it on
 * curve with the color role's target chance; the want is the fewest sources
 * that do so for the size's `sourceCover` share of the color's spell copies,
 * so its most demanding few may wait a turn, as in real decks (at a `cover`
 * of 1, the most demanding spell sets it). Mono decks want every land.
 */
export function colorWants(
  spells: SpellCopies[],
  plan: ColorPlan,
  size: DeckSize,
  lands: number,
  config: BulkBrewConfig,
  cover = forSize(config.landRules.colors.sourceCover, size),
): Partial<Record<Color, number>> {
  const want: Partial<Record<Color, number>> = {};
  if (plan.colors.length === 1) {
    want[plan.main] = lands;
    return want;
  }
  const chance = config.landRules.colors.castChance;
  const prefer = [plan.main, ...plan.colors.filter((c) => c !== plan.main)];
  // Per color, each spell's sources needed and its copies.
  const needs = new Map<Color, [number, number][]>();
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
      const list = needs.get(c) ?? [];
      list.push([need, qty]);
      needs.set(c, list);
    }
  }
  for (const [c, list] of needs) {
    list.sort((a, b) => a[0] - b[0]);
    const total = list.reduce((n, [, qty]) => n + qty, 0);
    let copies = 0;
    for (const [need, qty] of list) {
      copies += qty;
      want[c] = need;
      if (copies >= cover * total - 1e-9) break;
    }
  }
  return want;
}

/**
 * Pick nonbasics from the pool by score, then fill with basics. Mono decks
 * take basics of their color. Multi-color decks give basics first to the
 * colors furthest below what their spells want, then below what every copy
 * needs on curve, then by colored pips.
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
  // A one-color deck takes fewer colorless utility lands, so they never flood it.
  const preferredColorless = multi
    ? maxColorless
    : forSize(config.landRules.mono.maxColorlessOnly, size);
  const minScore = multi ? rules.minScore : config.landRules.mono.minScore;
  // In a one-color deck many utility lands tie; the one that enters untapped more often goes
  // first, then the more played one, not the first name.
  const rankOf = (c: Candidate) => (multi ? 0 : (c.facts.card.rank ?? Infinity));
  const notes: string[] = [];
  // What the spells (and a listed commander) supply, for the lands' own conditions.
  const supply = spellsSupply(spells, colors, size, config);

  // Draft-only lands stay out of the fallback too: they make no mana.
  const scored = landCandidates
    .filter((c) => c.facts.land && !c.facts.mdfcLand && !c.facts.basic && !draftOnly(c.facts.card))
    .map((candidate) => ({
      candidate,
      ...scoreNonbasic(candidate.facts.card, colors, config, size, styles, supply),
      slow: multi
        ? 0
        : landEntry(candidate.facts.card, { colors, size, styles, supply }, config).tapped,
    }))
    .sort((a, b) => {
      const x = a.candidate.facts.card;
      const y = b.candidate.facts.card;
      return (
        b.score - a.score ||
        a.slow - b.slow ||
        rankOf(a.candidate) - rankOf(b.candidate) ||
        (x.name < y.name ? -1 : x.name > y.name ? 1 : 0) ||
        (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
      );
    });

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
    multi && isFetch(card) ? 1 : landEntry(card, { colors, size, styles, supply }, config).tapped;
  const take = (
    least: number,
    limit: number,
    copies: 'preferred' | 'available',
    colorlessLimit: number,
  ) => {
    for (const s of scored) {
      if (s.score < least) continue;
      // The fallback must still add mana: skip lands that make no usable mana.
      const card = s.candidate.facts.card;
      if (
        landColors(card, colors, size, config, supply).length === 0 &&
        (card.produces ?? []).length === 0
      )
        continue;
      if (!isCommanderSize(size) && needsCommander(card)) continue;
      // A fetch land needs a basic of a color it can find.
      if (
        isFetch(card) &&
        !landColors(card, colors, size, config, supply).some((c) => (cap.get(c) ?? 0) > 0)
      )
        continue;
      const already = nonbasics.find((n) => n.candidate === s.candidate);
      const most = copies === 'preferred' ? s.candidate.preferred : s.candidate.available;
      let qty = already?.qty ?? 0;
      const before = qty;
      const slow = tappedChance(card);
      while (qty < most && taken < limit && taken < count) {
        if (s.colorlessOnly && colorless >= colorlessLimit) break;
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
  take(minScore, maxNonbasics, 'preferred', preferredColorless);

  const sources: Partial<Record<Color, number>> = {};
  const addSources = (pick: LandPick) => {
    for (const c of landColors(pick.candidate.facts.card, colors, size, config, supply))
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
    take(-Infinity, count - totalCap, 'available', maxColorless);
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
      for (const c of landColors(pick.candidate.facts.card, colors, size, config, supply))
        fetchFor[c] = (fetchFor[c] ?? 0) + pick.qty;
    }
  }

  const wanted = colorWants(spells, plan, size, count, config);
  const basics: Partial<Record<Color, number>> = {};
  if (!multi) {
    if (need > 0) basics[plan.main] = need;
    sources[plan.main] = (sources[plan.main] ?? 0) + need;
  } else {
    // Past the want, basics aim at what every copy needs, then go by pips: the other
    // splits measured moved near-tie plan picks (docs/todo.md).
    const every = colorWants(spells, plan, size, count, config, 1);
    // Colored pips per color, for the split once every color has what every copy needs.
    const prefer = [plan.main, ...colors.filter((c) => c !== plan.main)];
    const pips: Partial<Record<Color, number>> = {};
    for (const { facts, qty } of spells) {
      const d = pipDemand(facts.card, prefer);
      for (const c of colors) pips[c] = (pips[c] ?? 0) + (d[c] ?? 0) * qty;
    }
    const order = prefer;
    // One basic at a time to the color furthest below the first aim it is short of, then by pips.
    const split = (aims: Partial<Record<Color, number>>[]) => {
      const got: Partial<Record<Color, number>> = {};
      const have = (c: Color) =>
        (sources[c] ?? 0) + (got[c] ?? 0) + ((got[c] ?? 0) > 0 ? (fetchFor[c] ?? 0) : 0);
      for (let i = 0; i < need; i++) {
        const open = order.filter((c) => (got[c] ?? 0) < (cap.get(c) ?? 0));
        let short: { c: Color; gap: number }[] = [];
        for (const want of aims) {
          short = open
            .map((c) => ({ c, gap: ((want[c] ?? 0) - have(c)) / Math.max(1, want[c] ?? 0) }))
            .filter((x) => x.gap > 0);
          if (short.length > 0) break;
        }
        const pick =
          short.length > 0
            ? short.reduce((a, b) => (b.gap > a.gap ? b : a)).c
            : open.reduce((a, b) =>
                (pips[b] ?? 0) / (have(b) + 1) > (pips[a] ?? 0) / (have(a) + 1) ? b : a,
              );
        got[pick] = (got[pick] ?? 0) + 1;
      }
      return got;
    };
    const counts = split([wanted, every]);
    // Deck views list basics in this object's order: take it from the split without the
    // want, so the want moves only the counts.
    for (const c of [...Object.keys(split([every])), ...Object.keys(counts)] as Color[]) {
      const n = counts[c] ?? 0;
      if (n > 0 && basics[c] === undefined) basics[c] = n;
    }
    for (const c of colors) sources[c] = (sources[c] ?? 0) + (basics[c] ?? 0);
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
