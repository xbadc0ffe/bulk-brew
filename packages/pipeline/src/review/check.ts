// Entry point for `npm run review:check`: cheap automatic checks on every
// stored review deck, independent of any judge (docs/algo-review.md, Phase 3).
// Checks reuse the core's own rules where the core exports them; the rest are
// labeled proxies. Usage, output, and thresholds: docs/review/checks.md.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  canBeCommander,
  cardStrength,
  colorPlan,
  colorWants,
  commanderCopies,
  configVersion,
  curveProfileFor,
  curveTargets,
  effectiveCurveProfile,
  factsFor,
  identityWithin,
  inTribe,
  isBasicLand,
  isCommanderSize,
  isLand,
  landColors,
  maxCopiesFor,
  normalizeColors,
  pipDemand,
  planLandCount,
  playableWith,
  sourcesNeeded,
  templateFor,
  tribeOf,
  type BulkBrewConfig,
  type Candidate,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type Color,
  type ColorRole,
  type DataPack,
  type Settings,
  type SpellCopies,
} from '@bulk-brew/core';
import { arg, flag } from '../corpus.ts';
import { deckDifferences, JobError, runJob, type ReviewJob, type RunContext } from './build.ts';
import { loadReviewContext, ROOT } from './card-facts.ts';
import {
  countTheme,
  DEFAULT_THEME_RULES_FILE,
  loadThemeRules,
  matchCard,
  type ThemeCount,
  type ThemeFloor,
  type ThemeMinimumsCheck,
  type ThemeRules,
} from './theme-rules.ts';
import { deckColorsOf, VersionLoadError, type ReviewDeck, type ReviewSize } from './version.ts';
import { listVersions } from './versions.ts';

// Flag thresholds, all in one place; docs/review/checks.md quotes them.
export const THRESHOLDS = {
  /** lands-low / lands-high: the deck's lands differ from the land formula's count by more than this. */
  landSlack: { 100: 2, 60: 2, 40: 1, 20: 1 },
  /**
   * sources-short: castability (the builder's formula) below this. Not the core's per-color
   * colorWants gap, which is reported but flags most real two-color precons.
   */
  castabilityMin: 0.6,
  /** curve-top-heavy: more than this share of spells cost five or more... */
  topHeavyShare: { 100: 0.45, 60: 0.35, 40: 0.35, 20: 0.35 },
  /** ...or the spells' average mana value is above this. */
  topHeavyAverageMv: { 100: 4.2, 60: 4, 40: 4, 20: 3.8 },
  /** curve-flat: less than this share of spells cost three or less (no early peak). */
  flatLowShare: { 100: 0.4, 60: 0.45, 40: 0.45, 20: 0.45 },
  /** no-removal: fewer removal, sweeper, and counterspell copies than this. */
  interactionMin: { 100: 3, 60: 2, 40: 2, 20: 1 },
  /** no-threat: fewer big or evasive threat copies than this. */
  threatMin: { 100: 2, 60: 1, 40: 1, 20: 1 },
  /**
   * Theme flags read the style's minimums in theme-rules.json. These placeholders apply only
   * to a style the rules cover without minimums. theme-no-setup: weighted setup below this.
   */
  themeSetupMin: { 100: 5, 60: 3, 40: 2, 20: 1 },
  /** theme-no-payoff (placeholder): payoff copies below this. */
  themePayoffMin: { 100: 3, 60: 2, 40: 1, 20: 1 },
  /** theme-unbalanced (placeholder): weighted setup per payoff copy outside this range. */
  themeRatio: { min: 0.75, max: 4 },
  /** theme-unbalanced with minimums met: setup units below this share of payoff units. */
  themeSetupPerPayoffMin: 0.5,
  /** slow: build time above this, in milliseconds. */
  slowMs: { 100: 1000, 60: 300, 40: 300, 20: 300 },
} as const;

/** Bump when a check changes, so stored results are recomputed. */
export const CHECKER_VERSION = '4';

export const FLAGS = [
  'size',
  'copies',
  'colors',
  'illegal-card',
  'lands-low',
  'lands-high',
  'sources-short',
  'curve-top-heavy',
  'curve-flat',
  'no-removal',
  'no-threat',
  'theme-no-setup',
  'theme-no-payoff',
  'theme-unbalanced',
  'nondeterministic',
  'slow',
] as const;
export type Flag = (typeof FLAGS)[number];

const PROXY_ROLES =
  "Proxy: the builder's own role definitions from config/roles.json (counterspells by the counterspell tag), not a judgment of the cards.";
const PROXY_DEAD =
  'Proxy: spells with no role, no style membership, no theme-rule job, and strength below the pack median.';

/** Everything the checks read, loaded once per run. */
export interface CheckContext {
  index: CardIndex;
  config: BulkBrewConfig;
  settings: Settings;
  /** Median card strength over the pack's spells (Un-sets left out), for the dead-card proxy. */
  medianStrength: number;
  themes: ThemeRules | null;
}

export interface LegalityResult {
  /** Cards including basics and the commander. */
  total: number;
  want: number;
  sizeOk: boolean;
  /** The size's copy limit from the settings; basics are exempt, and card text can allow more. */
  copyLimit: number;
  overLimit: { name: string; qty: number; limit: number }[];
  /** Identity at 100 (the Commander rule); castable with the colors below 100, as the core's playableWith. */
  colorRule: 'identity' | 'castable';
  /** Colors for spells: the commander's identity at 100, else the deck's own. */
  allowed: Color[];
  /** Colors for lands and basics: also the requested ones, so a dual land of a color the deck dropped is legal. */
  allowedLands: Color[];
  offColor: string[];
  /** Below 100: cards whose identity leaves the colors but whose costs fit them, such as hybrid cards. Not a failure. */
  identityOutside: string[];
  /** Un-set cards, cards not in the pack, Commander-banned or not-legal cards at 100, and commander problems. */
  illegal: { name: string; why: string }[];
  commander: { id: string; name: string; canLead: boolean; inDeck: boolean } | null;
}

export interface ManaResult {
  /** Land cards (modal spell-lands are spells, as in the core) plus basics. */
  lands: number;
  /** What the core's planLandCount wants for this deck's spells. */
  wanted: number;
  diff: number;
  formula: { raw: number; min: number; max: number; averageMv: number; cheapManaSources: number };
  /** The core's colorPlan over the deck's own spells. */
  colorPlan: { main: Color; role: Partial<Record<Color, ColorRole>> } | null;
  sources: Partial<Record<Color, number>>;
  /** The core's colorWants: sources each color needs for its most demanding spell. */
  wantedSources: Partial<Record<Color, number>>;
  /** Largest shortfall of sources below what a color wants; 0 when none is short. */
  sourceGap: number;
  /** Share of spell copies the lands cast on curve, by the builder's castability formula. */
  castability: number | null;
  /** score.castability from the deck's own explanation, when the version gave one. */
  builderCastability: number | null;
}

export interface CurveResult {
  /** Spell copies (modal spell-lands included); the commander is left out, as the builder counts its 99. */
  spells: number;
  /** Spell copies per mana value bucket 0 through 7-plus. */
  buckets: number[];
  profile: string;
  /** Targets per bucket 1 through 7 (index 0 unused), as metrics.ts. */
  targets: number[];
  /** Sum of bucket differences beyond the template tolerance, zero-drops counted with one-drops, as metrics.ts. */
  deviation: number;
  averageMv: number;
  /** Spell copies at one (zero included), two, and three mana. */
  plays: { one: number; two: number; three: number };
  /** Share of spells at three or less, and at five or more. */
  shareLow: number;
  shareHigh: number;
}

export interface InteractionResult {
  proxy: string;
  removal: number;
  sweeper: number;
  counter: number;
  cheapInteraction: number;
  finisher: number;
  commanderFinisher: number;
  evasiveThreat: number;
  /** Copies that are removal, a sweeper, or a counterspell, each card once. */
  interaction: number;
  /** Copies that are a finisher, a Commander finisher, or an evasive threat, each card once. */
  threats: number;
}

export type ThemeEntry = ThemeCount | { style: string; covered: false };

export interface ThemeSection {
  rules: string;
  /** The style the version built. */
  archetype: ThemeEntry;
  /** The requested style, when one was asked for and the version built something else. */
  requested: ThemeEntry | null;
}

export interface DeadResult {
  proxy: string;
  medianStrength: number;
  copies: number;
  /** Of the spell copies. */
  share: number;
  cards: { name: string; qty: number; strength: number }[];
}

export type Determinism =
  | { checked: true; identical: boolean; differences: string[]; rebuildMs: number }
  | { checked: false; reason: string };

export interface TimingResult {
  buildMs: number;
  slowOver: number;
  /** null when --rebuild was not given. */
  determinism: Determinism | null;
}

export interface DeckRef {
  /** The deck file, relative to the repo root. */
  file: string;
  version: string;
  pool: string;
  size: ReviewSize;
  colors: Color[];
  style?: string;
  secondary?: string;
  commander?: string;
  archetype: string;
  seed: number;
  builtAt: string;
  dataVersion: string;
}

interface CheckBase {
  checker: string;
  /** Checker, pack, config, and theme-rules versions; a stored check is reused only when it matches. */
  stamp: string;
  deck: DeckRef;
}

export interface DeclinedCheck extends CheckBase {
  declined: string;
}

export interface DeckCheck extends CheckBase {
  legality: LegalityResult;
  mana: ManaResult;
  curve: CurveResult;
  interaction: InteractionResult;
  /** null when config/theme-rules.json does not exist. */
  themes: ThemeSection | null;
  dead: DeadResult;
  timing: TimingResult;
  flags: Flag[];
}

export type CheckFile = DeckCheck | DeclinedCheck;

function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function sum(values: Iterable<number>): number {
  let n = 0;
  for (const v of values) n += v;
  return n;
}

/** One deck card with its facts; duplicate rows are merged. */
interface Entry {
  card: CardRecord;
  qty: number;
  facts: CardFacts;
  commander: boolean;
}

function entriesOf(
  d: ReviewDeck,
  ctx: CheckContext,
): { list: Entry[]; missing: { name: string; qty: number }[] } {
  const byId = new Map<string, Entry>();
  const missing: { name: string; qty: number }[] = [];
  for (const c of d.deck.cards) {
    const card = ctx.index.get(c.id);
    if (!card) {
      missing.push({ name: c.name, qty: c.qty });
      continue;
    }
    const e = byId.get(c.id);
    if (e) e.qty += c.qty;
    else
      byId.set(c.id, {
        card,
        qty: c.qty,
        facts: factsFor(ctx.index, ctx.config, card),
        commander: c.id === d.deck.commander,
      });
  }
  return { list: [...byId.values()], missing };
}

function basicsOf(d: ReviewDeck): [Color, number][] {
  return normalizeColors(Object.keys(d.deck.basics) as Color[])
    .map((c) => [c, d.deck.basics[c] ?? 0] as [Color, number])
    .filter(([, n]) => n > 0);
}

/**
 * The colors the deck's spells may use: the commander's identity at 100, else the deck's own
 * (a best fit can use fewer than were requested), or the request's in older files.
 */
export function allowedColors(d: ReviewDeck, index: CardIndex): Color[] {
  const commander = d.deck.commander ? index.get(d.deck.commander) : undefined;
  if (d.request.size === 100 && commander) return normalizeColors(commander.identity);
  return normalizeColors(deckColorsOf(d));
}

/** Deck size, copy limits, colors, Un-sets, Commander legality, and the commander. */
export function checkLegality(d: ReviewDeck, ctx: CheckContext): LegalityResult {
  const size = d.request.size;
  const commanderDeck = isCommanderSize(size);
  const allowed = allowedColors(d, ctx.index);
  // A best fit can drop a requested color but keep a dual land that makes it; that is legal.
  const allowedLands = commanderDeck
    ? allowed
    : normalizeColors([...new Set([...allowed, ...d.request.colors])]);
  const { list, missing } = entriesOf(d, ctx);
  const limit = maxCopiesFor(ctx.settings, ctx.config, size);
  const overLimit: LegalityResult['overLimit'] = [];
  const offColor: string[] = [];
  const identityOutside: string[] = [];
  const illegal: LegalityResult['illegal'] = missing.map((m) => ({
    name: m.name,
    why: 'not in the data pack',
  }));
  for (const { card, qty, facts } of list) {
    if (!isBasicLand(card)) {
      // Card text such as "a deck can have any number of cards named" allows more at any size.
      const most = Math.max(limit, commanderCopies(card));
      if (qty > most) overLimit.push({ name: card.name, qty, limit: most });
    }
    // Modal spell-lands are spells, as in the mana check.
    const colors = facts.land && !facts.mdfcLand ? allowedLands : allowed;
    const fits = commanderDeck ? identityWithin(card, colors) : playableWith(card, colors);
    if (!fits) offColor.push(card.name);
    else if (!identityWithin(card, colors)) identityOutside.push(card.name);
    if (card.unset) illegal.push({ name: card.name, why: 'Un-set card' });
    if (commanderDeck && card.commanderLegality)
      illegal.push({
        name: card.name,
        why: card.commanderLegality === 'banned' ? 'banned in Commander' : 'not legal in Commander',
      });
  }
  const names = ctx.config.landRules.basics.names;
  for (const [c, qty] of basicsOf(d)) {
    if (!allowedLands.includes(c)) offColor.push(`${qty} ${names[c]}`);
  }
  let commander: LegalityResult['commander'] = null;
  if (commanderDeck) {
    const id = d.deck.commander;
    const card = id ? ctx.index.get(id) : undefined;
    if (!id) illegal.push({ name: '(none)', why: 'a 100-card deck needs a commander' });
    else if (!card) illegal.push({ name: id, why: 'commander not in the data pack' });
    else {
      commander = {
        id,
        name: card.name,
        canLead: canBeCommander(card),
        inDeck: list.some((e) => e.commander),
      };
      if (!commander.canLead) illegal.push({ name: card.name, why: 'cannot be a commander' });
      if (!commander.inDeck)
        illegal.push({ name: card.name, why: 'the commander is not among the cards' });
    }
  }
  const total =
    sum(d.deck.cards.map((c) => c.qty)) + sum(Object.values(d.deck.basics).map((q) => q ?? 0));
  return {
    total,
    want: size,
    sizeOk: total === size,
    copyLimit: limit,
    overLimit,
    colorRule: commanderDeck ? 'identity' : 'castable',
    allowed,
    allowedLands,
    offColor,
    identityOutside,
    illegal,
    commander,
  };
}

/** Same test as the core's private isFetch in lands.ts: a land that only fetches basics. */
function isFetchLand(card: CardRecord): boolean {
  return (
    (card.produces ?? []).length === 0 &&
    (card.tags.includes('fetchland') || card.tags.includes('tutor-land-basic'))
  );
}

/** score.castability from a version's explanation, when it has one. */
function explainedCastability(explanation: unknown): number | null {
  const score = (explanation as { score?: { castability?: unknown } } | undefined)?.score;
  return typeof score?.castability === 'number' ? score.castability : null;
}

/**
 * Land count against the core's land formula, color sources against the
 * core's colorWants, and castability by the builder's formula. The builder's
 * castability function is private, so it is recomputed here from the same
 * exported pieces (pipDemand, sourcesNeeded, castChance). One difference:
 * the builder plans colors from the whole pool, this from the deck's spells.
 */
export function checkMana(d: ReviewDeck, ctx: CheckContext, list: Entry[]): ManaResult {
  const size = d.request.size;
  const template = templateFor(ctx.config, size);
  const spells: SpellCopies[] = list
    .filter((e) => e.facts.spell && !e.commander)
    .map((e) => ({ facts: e.facts, qty: e.qty }));
  const plan = planLandCount(template, spells, ctx.config.landRules.mdfc);
  const landCards = list.filter((e) => e.facts.land && !e.facts.mdfcLand);
  const basics = basicsOf(d);
  const lands = sum(landCards.map((e) => e.qty)) + sum(basics.map(([, n]) => n));
  const colors = allowedColors(d, ctx.index);
  const result: ManaResult = {
    lands,
    wanted: plan.count,
    diff: lands - plan.count,
    formula: {
      raw: plan.raw,
      min: template.landFormula.min,
      max: template.landFormula.max,
      averageMv: plan.averageMv,
      cheapManaSources: plan.cheapManaSources,
    },
    colorPlan: null,
    sources: {},
    wantedSources: {},
    sourceGap: 0,
    castability: null,
    builderCastability: explainedCastability(d.explanation),
  };
  if (colors.length === 0) return result;

  // Sources as the core's chooseManaBase counts them: basics, then lands by landColors;
  // in a multi-color deck a fetch land counts for a color only when a basic of it is there.
  const multi = colors.length > 1;
  const sources: Partial<Record<Color, number>> = {};
  const basicFor = new Map<Color, number>();
  for (const c of colors) sources[c] = 0;
  for (const [c, n] of basics) {
    if (!colors.includes(c)) continue;
    sources[c]! += n;
    basicFor.set(c, (basicFor.get(c) ?? 0) + n);
  }
  for (const e of landCards) {
    if (!isBasicLand(e.card)) continue;
    for (const c of landColors(e.card, colors, size))
      basicFor.set(c, (basicFor.get(c) ?? 0) + e.qty);
  }
  for (const e of landCards) {
    const fetch = isFetchLand(e.card);
    for (const c of landColors(e.card, colors, size)) {
      if (fetch && multi && !(basicFor.get(c) ?? 0)) continue;
      sources[c]! += e.qty;
    }
  }

  const cands: Candidate[] = spells.map((s) => ({
    facts: s.facts,
    available: s.qty,
    preferred: s.qty,
  }));
  const cp = colorPlan(cands, colors, ctx.config);
  const wanted = colorWants(spells, cp, size, lands, ctx.config);
  let gap = 0;
  for (const c of colors) gap = Math.max(gap, (wanted[c] ?? 0) - (sources[c] ?? 0));

  // The builder's castability (builder.ts), on the finished deck.
  const chance = ctx.config.landRules.colors.castChance;
  let ok = 0;
  let all = 0;
  for (const { facts, qty } of spells) {
    const demand = pipDemand(facts.card, cp.colors);
    let fine = true;
    for (const c of cp.colors) {
      const pips = demand[c] ?? 0;
      if (pips === 0) continue;
      const target = cp.colors.length === 1 ? chance.main : chance[cp.role[c] ?? 'secondary'];
      const need = sourcesNeeded(
        size,
        lands,
        pips,
        Math.ceil(facts.card.mv),
        target,
        isCommanderSize(size),
      );
      if ((sources[c] ?? 0) < need) fine = false;
    }
    all += qty;
    if (fine) ok += qty;
  }
  result.colorPlan = { main: cp.main, role: cp.role };
  result.sources = sources;
  result.wantedSources = wanted;
  result.sourceGap = gap;
  result.castability = round(all > 0 ? ok / all : 1, 3);
  return result;
}

/** Spells per mana value, and the curve deviation the way metrics.ts measures it. */
export function checkCurve(d: ReviewDeck, ctx: CheckContext, list: Entry[]): CurveResult {
  const template = templateFor(ctx.config, d.request.size);
  const archetype = ctx.config.archetypes.archetypes.find((a) => a.id === d.deck.archetype);
  const profile = effectiveCurveProfile(template, archetype);
  const shape = curveProfileFor(ctx.config, profile).shape;
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  let spells = 0;
  let mv = 0;
  for (const e of list) {
    if (!e.facts.spell || e.commander) continue;
    spells += e.qty;
    mv += e.card.mv * e.qty;
    buckets[e.facts.bucket]! += e.qty;
  }
  const targets = curveTargets(shape, spells);
  let deviation = 0;
  for (let b = 1; b <= 7; b++) {
    const have = buckets[b]! + (b === 1 ? buckets[0]! : 0);
    deviation += Math.max(0, Math.abs(have - targets[b]!) - template.tolerances.curve);
  }
  const share = (n: number) => (spells > 0 ? round(n / spells, 3) : 0);
  return {
    spells,
    buckets,
    profile,
    targets: [...targets],
    deviation,
    averageMv: spells > 0 ? round(mv / spells) : 0,
    plays: { one: buckets[0]! + buckets[1]!, two: buckets[2]!, three: buckets[3]! },
    shareLow: share(buckets[0]! + buckets[1]! + buckets[2]! + buckets[3]!),
    shareHigh: share(buckets[5]! + buckets[6]! + buckets[7]!),
  };
}

/** Role counts from the core's matcher, as a cheap proxy for interaction and threats. */
export function checkInteraction(list: Entry[]): InteractionResult {
  const count = (test: (e: Entry) => boolean) => sum(list.filter(test).map((e) => e.qty));
  const has = (e: Entry, role: string) => e.facts.roles.includes(role);
  // config/roles.json has no counterspell role; cheap interaction reads this tag.
  const counter = (e: Entry) => e.card.tags.includes('counterspell');
  return {
    proxy: PROXY_ROLES,
    removal: count((e) => has(e, 'removal')),
    sweeper: count((e) => has(e, 'sweeper')),
    counter: count(counter),
    cheapInteraction: count((e) => has(e, 'cheapInteraction')),
    finisher: count((e) => has(e, 'finisher')),
    commanderFinisher: count((e) => has(e, 'commanderFinisher')),
    evasiveThreat: count((e) => has(e, 'evasiveThreat')),
    interaction: count((e) => has(e, 'removal') || has(e, 'sweeper') || counter(e)),
    threats: count(
      (e) => has(e, 'finisher') || has(e, 'commanderFinisher') || has(e, 'evasiveThreat'),
    ),
  };
}

/** Every card the deck holds, basics included, for theme counts. */
function themeCards(
  d: ReviewDeck,
  ctx: CheckContext,
  list: Entry[],
): { card: CardRecord; qty: number }[] {
  const out = list.map((e) => ({ card: e.card, qty: e.qty }));
  for (const [c, qty] of basicsOf(d)) {
    const card = ctx.index.find(ctx.config.landRules.basics.names[c]);
    if (card) out.push({ card, qty });
  }
  return out;
}

function themeEntry(
  style: string,
  rules: ThemeRules,
  cards: { card: CardRecord; qty: number }[],
): ThemeEntry {
  const s = rules.styles.get(style);
  return s ? countTheme(cards, s) : { style, covered: false };
}

export function checkThemes(d: ReviewDeck, ctx: CheckContext, list: Entry[]): ThemeSection | null {
  if (!ctx.themes) return null;
  const cards = themeCards(d, ctx, list);
  const requested = d.request.style;
  return {
    rules: ctx.themes.version,
    archetype: themeEntry(d.deck.archetype, ctx.themes, cards),
    requested:
      requested && requested !== d.deck.archetype ? themeEntry(requested, ctx.themes, cards) : null,
  };
}

/** Spells that serve no role, style, tribe, or theme-rule job and are weaker than the median card. */
export function checkDead(d: ReviewDeck, ctx: CheckContext, list: Entry[]): DeadResult {
  const tribes = [d.deck.archetype, d.request.style, d.request.secondary]
    .map((s) => tribeOf(s))
    .filter((t): t is string => t !== undefined);
  const styles = [d.deck.archetype, d.request.style, d.request.secondary]
    .map((s) => (s ? ctx.themes?.styles.get(s) : undefined))
    .filter((s) => s !== undefined);
  const cards: DeadResult['cards'] = [];
  let spells = 0;
  for (const e of list) {
    if (!e.facts.spell || e.commander) continue;
    spells += e.qty;
    const f = e.facts;
    if (f.roles.length || f.enablerOf.length || f.payoffOf.length) continue;
    if (f.strength >= ctx.medianStrength) continue;
    const tribal = tribes.some(
      (t) => inTribe(e.card, t) || e.card.tags.includes(`typal-${t.toLowerCase()}`),
    );
    if (tribal) continue;
    const job = styles.some((s) => {
      const m = matchCard(e.card, s);
      return m !== undefined && m.as !== 'excluded';
    });
    if (job) continue;
    cards.push({ name: e.card.name, qty: e.qty, strength: f.strength });
  }
  const copies = sum(cards.map((c) => c.qty));
  return {
    proxy: PROXY_DEAD,
    medianStrength: ctx.medianStrength,
    copies,
    share: spells > 0 ? round(copies / spells, 3) : 0,
    cards,
  };
}

/** The numbers the flags read, so the thresholds can be tested without a deck. */
export interface FlagInputs {
  size: ReviewSize;
  sizeOk: boolean;
  copiesOk: boolean;
  colorsOk: boolean;
  illegalCards: number;
  landDiff: number;
  /** null when the deck has no colors to check. */
  castability: number | null;
  spells: number;
  shareLow: number;
  shareHigh: number;
  averageMv: number;
  interaction: number;
  threats: number;
  /** The requested style's theme count (else the built style's); null when the rules do not cover it. */
  theme: {
    setupWeighted: number;
    payoffCopies: number;
    ratio: number | null;
    setupUnits?: number;
    payoffUnits?: number;
    /** The style's minimums verdict for the deck's size; absent when the rules give none. */
    minimums?: ThemeMinimumsCheck;
  } | null;
  /** null when not rebuilt. */
  identical: boolean | null;
  buildMs: number;
}

const SETUP_FLOORS: (keyof ThemeFloor)[] = ['setup', 'setupWeight', 'repeatable'];
// Burn's pingers-or-payoffs floor counts toward payoffs: a short one means too little reach.
const PAYOFF_FLOORS: (keyof ThemeFloor)[] = ['payoff', 'payoffWeight', 'repeatableOrPayoff'];

export function flagsFor(x: FlagInputs): Flag[] {
  const t = THRESHOLDS;
  const s = x.size;
  const out = new Set<Flag>();
  if (!x.sizeOk) out.add('size');
  if (!x.copiesOk) out.add('copies');
  if (!x.colorsOk) out.add('colors');
  if (x.illegalCards > 0) out.add('illegal-card');
  if (x.landDiff < -t.landSlack[s]) out.add('lands-low');
  if (x.landDiff > t.landSlack[s]) out.add('lands-high');
  if (x.castability !== null && x.castability < t.castabilityMin) out.add('sources-short');
  if (x.spells > 0) {
    if (x.shareHigh > t.topHeavyShare[s] || x.averageMv > t.topHeavyAverageMv[s])
      out.add('curve-top-heavy');
    if (x.shareLow < t.flatLowShare[s]) out.add('curve-flat');
  }
  if (x.interaction < t.interactionMin[s]) out.add('no-removal');
  if (x.threats < t.threatMin[s]) out.add('no-threat');
  const m = x.theme?.minimums;
  if (x.theme && m) {
    // The guide's floors: which side the closest alternative misses.
    const missed = new Set(m.short.map((f) => f.floor));
    if (SETUP_FLOORS.some((f) => missed.has(f))) out.add('theme-no-setup');
    if (PAYOFF_FLOORS.some((f) => missed.has(f))) out.add('theme-no-payoff');
    // Floors met, but fewer setup units than half the payoffs: the guide's quick test.
    const { setupUnits: su, payoffUnits: pu } = x.theme;
    if (m.met && su !== undefined && pu !== undefined && su < t.themeSetupPerPayoffMin * pu)
      out.add('theme-unbalanced');
  } else if (x.theme) {
    const noSetup = x.theme.setupWeighted < t.themeSetupMin[s];
    const noPayoff = x.theme.payoffCopies < t.themePayoffMin[s];
    if (noSetup) out.add('theme-no-setup');
    if (noPayoff) out.add('theme-no-payoff');
    const r = x.theme.ratio;
    if (!noSetup && !noPayoff && r !== null && (r < t.themeRatio.min || r > t.themeRatio.max))
      out.add('theme-unbalanced');
  }
  if (x.identical === false) out.add('nondeterministic');
  if (x.buildMs > t.slowMs[s]) out.add('slow');
  return FLAGS.filter((f) => out.has(f));
}

function isCount(e: ThemeEntry | null): e is ThemeCount {
  return e !== null && !('covered' in e);
}

/** The theme count the flags read: the requested style when there is one, else the built style. */
export function flaggedTheme(t: ThemeSection | null): ThemeCount | null {
  if (!t) return null;
  const e = t.requested ?? t.archetype;
  return isCount(e) ? e : null;
}

export function deckRef(d: ReviewDeck, file: string): DeckRef {
  return {
    file,
    version: d.version,
    pool: d.pool.id,
    size: d.request.size,
    colors: d.request.colors,
    ...(d.request.style ? { style: d.request.style } : {}),
    ...(d.request.secondary ? { secondary: d.request.secondary } : {}),
    ...(d.deck.commander ? { commander: d.deck.commander } : {}),
    archetype: d.deck.archetype,
    seed: d.request.seed,
    builtAt: d.builtAt,
    dataVersion: d.dataVersion,
  };
}

/** Every check on one built deck. Pure: no files, no clock. */
export function checkDeck(
  d: ReviewDeck,
  ctx: CheckContext,
  opts: { file: string; stamp: string; determinism: Determinism | null },
): DeckCheck {
  const { list } = entriesOf(d, ctx);
  const legality = checkLegality(d, ctx);
  const mana = checkMana(d, ctx, list);
  const curve = checkCurve(d, ctx, list);
  const interaction = checkInteraction(list);
  const themes = checkThemes(d, ctx, list);
  const dead = checkDead(d, ctx, list);
  const timing: TimingResult = {
    buildMs: d.buildMs,
    slowOver: THRESHOLDS.slowMs[d.request.size],
    determinism: opts.determinism,
  };
  const theme = flaggedTheme(themes);
  const flags = flagsFor({
    size: d.request.size,
    sizeOk: legality.sizeOk,
    copiesOk: legality.overLimit.length === 0,
    colorsOk: legality.offColor.length === 0,
    illegalCards: legality.illegal.length,
    landDiff: mana.diff,
    castability: mana.castability,
    spells: curve.spells,
    shareLow: curve.shareLow,
    shareHigh: curve.shareHigh,
    averageMv: curve.averageMv,
    interaction: interaction.interaction,
    threats: interaction.threats,
    theme,
    identical: opts.determinism?.checked ? opts.determinism.identical : null,
    buildMs: d.buildMs,
  });
  return {
    checker: CHECKER_VERSION,
    stamp: opts.stamp,
    deck: deckRef(d, opts.file),
    legality,
    mana,
    curve,
    interaction,
    themes,
    dead,
    timing,
    flags,
  };
}

/** Median strength of the pack's spells, Un-sets and plain lands left out. */
export function packMedianStrength(pack: DataPack, config: BulkBrewConfig): number {
  const s: number[] = [];
  for (const c of pack.cards) {
    if (c.unset || (isLand(c) && c.layout !== 'modal_dfc')) continue;
    s.push(cardStrength(c, config.cardStrength).score);
  }
  return median(s) ?? 0;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2);
}

// ---- Files and the command ----

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.toLowerCase().endsWith('.json')) out.push(p);
  }
}

/** `*` within a folder, `**` across folders, `?` one character. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else re += '.*';
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/** Deck files from folders, files, or globs, relative to the repo root; sorted, no repeats. */
export function listDeckFiles(specs: readonly string[], root: string = ROOT): string[] {
  const out = new Set<string>();
  for (const spec of specs) {
    const norm = spec.replace(/\\/g, '/');
    const abs = path.resolve(root, norm);
    if (existsSync(abs)) {
      if (statSync(abs).isDirectory()) {
        const found: string[] = [];
        walk(abs, found);
        for (const f of found) out.add(f);
      } else out.add(abs);
      continue;
    }
    if (!/[*?]/.test(norm)) throw new Error(`no file or folder ${spec}`);
    const parts = norm.split('/');
    const firstGlob = parts.findIndex((p) => /[*?]/.test(p));
    const base = path.resolve(root, parts.slice(0, firstGlob).join('/') || '.');
    if (!existsSync(base)) continue;
    const re = globToRegExp(parts.slice(firstGlob).join('/'));
    const found: string[] = [];
    walk(base, found);
    for (const f of found) if (re.test(path.relative(base, f).replace(/\\/g, '/'))) out.add(f);
  }
  return [...out].sort();
}

function rel(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function isReviewDeck(x: unknown): x is ReviewDeck {
  const d = x as Partial<ReviewDeck> | null;
  return (
    typeof d === 'object' &&
    d !== null &&
    typeof d.version === 'string' &&
    typeof d.request?.size === 'number' &&
    Array.isArray(d.deck?.cards) &&
    typeof d.pool?.id === 'string'
  );
}

/** Build the deck again through the runner and compare. Real decks and unknown versions are skipped. */
async function rebuildOnce(d: ReviewDeck, run: RunContext): Promise<Determinism> {
  if (!listVersions().includes(d.version))
    return {
      checked: false,
      reason:
        d.version === 'real'
          ? 'real decks are not built'
          : `"${d.version}" is not a builder version`,
    };
  if (d.dataVersion !== run.index.dataVersion)
    return {
      checked: false,
      reason: `built on data ${d.dataVersion}; the pack is ${run.index.dataVersion}`,
    };
  const r = d.request;
  const job: ReviewJob = {
    version: d.version,
    pool: d.pool.source,
    colors: r.colors,
    size: r.size,
    ...(r.style ? { style: r.style } : {}),
    ...(r.secondary ? { secondary: r.secondary } : {}),
    ...(r.commander ? { commander: r.commander } : {}),
    seed: r.seed,
  };
  try {
    const again = (await runJob(job, run)).deck;
    if (again.pool.hash !== d.pool.hash)
      return { checked: false, reason: `the pool file ${d.pool.source} changed since the build` };
    const differences = deckDifferences(d, again);
    return {
      checked: true,
      identical: differences.length === 0,
      differences,
      rebuildMs: again.buildMs,
    };
  } catch (err) {
    if (err instanceof JobError || err instanceof VersionLoadError)
      return { checked: false, reason: err.message };
    throw err;
  }
}

// ---- Summary ----

type Rate = { pass: number; of: number };

export interface GroupSummary {
  version: string;
  size: number;
  decks: number;
  declined: number;
  pass: Record<string, Rate>;
  flags: Partial<Record<Flag, number>>;
  medians: Record<string, number | null>;
}

const PASS_CHECKS: { key: string; label: string; flags: Flag[] }[] = [
  { key: 'legal', label: 'Legal', flags: ['size', 'copies', 'colors', 'illegal-card'] },
  { key: 'lands', label: 'Lands', flags: ['lands-low', 'lands-high'] },
  { key: 'sources', label: 'Sources', flags: ['sources-short'] },
  { key: 'curve', label: 'Curve', flags: ['curve-top-heavy', 'curve-flat'] },
  { key: 'interaction', label: 'Interaction (proxy)', flags: ['no-removal'] },
  { key: 'threats', label: 'Threats (proxy)', flags: ['no-threat'] },
  {
    key: 'theme',
    label: 'Theme',
    flags: ['theme-no-setup', 'theme-no-payoff', 'theme-unbalanced'],
  },
  { key: 'deterministic', label: 'Same on rebuild', flags: ['nondeterministic'] },
  { key: 'fast', label: 'Fast', flags: ['slow'] },
];

const MEDIANS: { key: string; label: string; of: (c: DeckCheck) => number | null | undefined }[] = [
  { key: 'landsDiff', label: 'Lands vs formula', of: (c) => c.mana.diff },
  { key: 'castability', label: 'Castability', of: (c) => c.mana.castability },
  { key: 'curveDeviation', label: 'Curve deviation', of: (c) => c.curve.deviation },
  { key: 'averageMv', label: 'Average mv', of: (c) => c.curve.averageMv },
  { key: 'oneDrops', label: '1-drops', of: (c) => c.curve.plays.one },
  { key: 'twoDrops', label: '2-drops', of: (c) => c.curve.plays.two },
  { key: 'threeDrops', label: '3-drops', of: (c) => c.curve.plays.three },
  { key: 'interaction', label: 'Interaction (proxy)', of: (c) => c.interaction.interaction },
  { key: 'threats', label: 'Threats (proxy)', of: (c) => c.interaction.threats },
  { key: 'deadCopies', label: 'Dead (proxy)', of: (c) => c.dead.copies },
  { key: 'buildMs', label: 'Build ms', of: (c) => c.timing.buildMs },
  {
    key: 'themeSetup',
    label: 'Setup (weighted)',
    of: (c) => flaggedTheme(c.themes)?.setupWeighted,
  },
  { key: 'themePayoffs', label: 'Payoffs', of: (c) => flaggedTheme(c.themes)?.payoffCopies },
  { key: 'themeRatio', label: 'Setup per payoff', of: (c) => flaggedTheme(c.themes)?.ratio },
];

const SIZE_ORDER: Record<number, number> = { 100: 0, 60: 1, 40: 2, 20: 3 };

export function summarize(checks: readonly CheckFile[]): GroupSummary[] {
  const groups = new Map<string, CheckFile[]>();
  for (const c of checks) {
    const key = `${c.deck.version}\u0000${c.deck.size}`;
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }
  const out: GroupSummary[] = [];
  for (const list of groups.values()) {
    const built = list.filter((c): c is DeckCheck => !('declined' in c));
    const pass: Record<string, Rate> = {};
    for (const p of PASS_CHECKS) {
      let of = built;
      if (p.key === 'theme') of = built.filter((c) => flaggedTheme(c.themes) !== null);
      if (p.key === 'deterministic') of = built.filter((c) => c.timing.determinism?.checked);
      pass[p.key] = {
        pass: of.filter((c) => !c.flags.some((f) => p.flags.includes(f))).length,
        of: of.length,
      };
    }
    pass.noFlags = { pass: built.filter((c) => c.flags.length === 0).length, of: built.length };
    const flags: Partial<Record<Flag, number>> = {};
    for (const f of FLAGS) {
      const n = built.filter((c) => c.flags.includes(f)).length;
      if (n) flags[f] = n;
    }
    const medians: Record<string, number | null> = {};
    for (const m of MEDIANS) {
      const values = built.map(m.of).filter((v): v is number => typeof v === 'number');
      medians[m.key] = median(values);
    }
    out.push({
      version: list[0]!.deck.version,
      size: list[0]!.deck.size,
      decks: list.length,
      declined: list.length - built.length,
      pass,
      flags,
      medians,
    });
  }
  return out.sort(
    (a, b) =>
      (a.version < b.version ? -1 : a.version > b.version ? 1 : 0) ||
      (SIZE_ORDER[a.size] ?? 9) - (SIZE_ORDER[b.size] ?? 9),
  );
}

function rateText(r: Rate | undefined): string {
  if (!r || r.of === 0) return 'n/a';
  return `${r.pass}/${r.of} (${Math.round((100 * r.pass) / r.of)}%)`;
}

function table(head: string[], rows: string[][]): string[] {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
}

export function summaryMarkdown(
  groups: readonly GroupSummary[],
  info: {
    decks: string;
    total: number;
    declined: number;
    rules: string | null;
    rulesFile: string;
    rebuild: boolean;
    /** Built decks with a rebuild result, from this run or a stored earlier --rebuild run. */
    rebuilt: number;
    bad: number;
  },
): string {
  const lines: string[] = ['# Automatic deck checks', ''];
  lines.push(
    `Command: \`npm run review:check -- --decks ${info.decks}${info.rebuild ? ' --rebuild' : ''}\`. ` +
      `${info.total} deck files, ${info.declined} declined (the version could not build the request)` +
      `${info.bad ? `, ${info.bad} unreadable` : ''}. Per-deck results: \`data/review/checks/<version>/\`. ` +
      'Checks, proxies, and thresholds: `docs/review/checks.md`.',
  );
  lines.push('');
  lines.push(
    info.rules
      ? `Theme counts use \`${info.rulesFile}\` version ${info.rules}. Theme columns cover only decks whose style the rules describe; plain shapes are never flagged for lacking a theme.`
      : `Theme counts: not run. \`${info.rulesFile}\` does not exist yet, so every deck's \`themes\` is null and the theme columns are empty.`,
  );
  lines.push(
    info.rebuilt
      ? `Determinism: ${info.rebuilt} decks were rebuilt once through the runner and compared, in this run or a stored earlier \`--rebuild\` run; the rest were not (run with \`--rebuild\`).`
      : 'Determinism: not checked (run with `--rebuild`).',
  );
  lines.push('');
  lines.push('## Pass rates', '');
  lines.push(
    ...table(
      ['Version', 'Size', 'Decks', 'Declined', ...PASS_CHECKS.map((p) => p.label), 'No flags'],
      groups.map((g) => [
        g.version,
        String(g.size),
        String(g.decks),
        String(g.declined),
        ...PASS_CHECKS.map((p) => rateText(g.pass[p.key])),
        rateText(g.pass.noFlags),
      ]),
    ),
  );
  lines.push('', '## Medians', '');
  lines.push(
    ...table(
      ['Version', 'Size', ...MEDIANS.map((m) => m.label)],
      groups.map((g) => [
        g.version,
        String(g.size),
        ...MEDIANS.map((m) => {
          const v = g.medians[m.key];
          return v === null || v === undefined ? 'n/a' : String(v);
        }),
      ]),
    ),
  );
  const seen = FLAGS.filter((f) => groups.some((g) => g.flags[f]));
  lines.push('', '## Flags', '');
  if (seen.length === 0) lines.push('No deck raised a flag.');
  else
    lines.push(
      ...table(
        ['Version', 'Size', ...seen],
        groups.map((g) => [g.version, String(g.size), ...seen.map((f) => String(g.flags[f] ?? 0))]),
      ),
    );
  return lines.join('\n') + '\n';
}

const USAGE = `usage:
  npm run review:check -- [--decks <folder, file, or glob> ...] [--out data/review/checks]
      [--force] [--rebuild] [--rules <theme-rules.json>]

  --decks    Deck files to check (default data/review/decks). Folders are read recursively;
             globs take * (one folder), ** (any depth), and ? (one character).
  --out      Where results go (default data/review/checks).
  --force    Recompute every check, even one stored for the same deck and versions.
  --rebuild  Build each deck once more through the runner and compare (slow; skips real decks).
  --rules    Theme rules file (default config/theme-rules.json).`;

/** Values after --decks up to the next flag, so a shell-expanded glob works too. */
function deckSpecs(): string[] {
  const i = process.argv.indexOf('--decks');
  if (i < 0) return ['data/review/decks'];
  const out: string[] = [];
  for (const a of process.argv.slice(i + 1)) {
    if (a.startsWith('--')) break;
    out.push(a);
  }
  return out;
}

async function main(): Promise<number> {
  if (flag('help')) {
    console.log(USAGE);
    return 0;
  }
  const specs = deckSpecs();
  if (specs.length === 0) {
    console.error(USAGE);
    return 2;
  }
  let files: string[];
  try {
    files = listDeckFiles(specs);
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
  if (files.length === 0) {
    console.error(`no deck files match ${specs.join(' ')}`);
    return 2;
  }
  const outDir = path.resolve(ROOT, arg('out') ?? 'data/review/checks');
  const force = flag('force');
  const rebuild = flag('rebuild');
  const rulesArg = arg('rules');
  const rulesFile = rulesArg ? path.resolve(ROOT, rulesArg) : DEFAULT_THEME_RULES_FILE;
  const rulesName = rulesArg ? rel(rulesFile as string) : 'config/theme-rules.json';

  // The runner's builds need learned data attached; the checks themselves do not read it.
  const review = loadReviewContext({ learned: rebuild });
  const themes = loadThemeRules(rulesFile);
  const ctx: CheckContext = {
    index: review.index,
    config: review.config,
    settings: review.settings,
    medianStrength: packMedianStrength(review.pack, review.config),
    themes,
  };
  const stamp = [
    `checker ${CHECKER_VERSION}`,
    `data ${review.index.dataVersion}`,
    `config ${configVersion(review.config)}`,
    `rules ${themes?.version ?? 'none'}`,
  ].join('; ');
  const run: RunContext | undefined = rebuild
    ? {
        index: review.index,
        config: review.config,
        settings: review.settings,
        root: ROOT,
        // Rebuilt decks go to scratch, so the stored decks stay as built.
        outDir: path.join(ROOT, 'data', 'review', 'scratch', 'rebuild'),
        force: true,
        pools: new Map(),
        versions: new Map(),
      }
    : undefined;

  const checks: CheckFile[] = [];
  let bad = 0;
  let reused = 0;
  for (const file of files) {
    const name = rel(file);
    let d: unknown;
    try {
      d = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (err) {
      bad++;
      console.log(`${name}: unreadable: ${(err as Error).message}`);
      continue;
    }
    if (!isReviewDeck(d)) {
      bad++;
      console.log(`${name}: not a review deck file`);
      continue;
    }
    const out = path.join(outDir, d.version, path.basename(file));
    if (!force && existsSync(out)) {
      try {
        const old = JSON.parse(readFileSync(out, 'utf8')) as CheckFile;
        const fresh =
          old.stamp === stamp &&
          old.deck.file === name &&
          old.deck.builtAt === d.builtAt &&
          (!rebuild || 'declined' in old || old.timing.determinism !== null);
        if (fresh) {
          checks.push(old);
          reused++;
          continue;
        }
      } catch {
        // An unreadable old result is simply recomputed.
      }
    }
    let check: CheckFile;
    if (d.error) {
      check = { checker: CHECKER_VERSION, stamp, deck: deckRef(d, name), declined: d.error };
      console.log(`${name}: declined: ${d.error}`);
    } else {
      const determinism = run ? await rebuildOnce(d, run) : null;
      check = checkDeck(d, ctx, { file: name, stamp, determinism });
      const det =
        determinism === null
          ? ''
          : determinism.checked
            ? determinism.identical
              ? ', same on rebuild'
              : `, rebuild differs: ${determinism.differences.join('; ')}`
            : `, not rebuilt: ${determinism.reason}`;
      console.log(`${name}: ${check.flags.join(', ') || 'no flags'}${det}`);
    }
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(check, null, 2) + '\n');
    checks.push(check);
  }

  const groups = summarize(checks);
  const declined = checks.filter((c) => 'declined' in c).length;
  mkdirSync(outDir, { recursive: true });
  const summary = {
    checker: CHECKER_VERSION,
    stamp,
    decks: specs,
    files: checks.length,
    declined,
    unreadable: bad,
    themeRules: themes ? { file: rulesName, version: themes.version } : null,
    rebuild,
    thresholds: THRESHOLDS,
    groups,
  };
  writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(
    path.join(outDir, 'summary.md'),
    summaryMarkdown(groups, {
      decks: specs.join(' '),
      total: checks.length,
      declined,
      rules: themes?.version ?? null,
      rulesFile: rulesName,
      rebuild,
      rebuilt: checks.filter((c) => !('declined' in c) && c.timing.determinism?.checked).length,
      bad,
    }),
  );
  console.log(
    `\n${checks.length} decks checked (${reused} reused, ${declined} declined${bad ? `, ${bad} unreadable` : ''}). ` +
      `Theme rules: ${themes ? `version ${themes.version}` : 'none yet'}.`,
  );
  console.log(`wrote ${rel(outDir)}/<version>/*.json, summary.json, summary.md`);
  return bad ? 1 : 0;
}

// Run only as a script, so tests can import the checks.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/review/check.ts')) {
  process.exitCode = await main();
}
