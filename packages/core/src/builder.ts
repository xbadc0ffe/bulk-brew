// Deck builder v1: mono-color, best-cards mode. Deterministic: every loop
// walks candidates in card id order and never depends on object iteration
// order, so the same pool, settings, config, and data give the same deck.
//
// Shape of a build: pick an archetype from the scan, reserve the template's
// land count, fill spell slots in passes (role minimums, theme minimums, role
// targets, type minimums, curve, filler), size the mana base from the spells
// actually chosen, improve by swaps, re-fit the land count, then pick lands.

import {
  configVersion,
  curveProfileFor,
  forSize,
  minimumsFor,
  roleOverridesFor,
  templateFor,
  type Archetype,
  type BuilderWeightsConfig,
  type BulkBrewConfig,
  type DeckTemplate,
  type RoleQuota,
  type SynergyArchetype,
  type TypeMix,
} from './config.ts';
import {
  factsFor,
  listCandidates,
  maxCopiesFor,
  type Candidate,
  type CardFacts,
} from './candidates.ts';
import { canBeCommander, commanderCopies, inTribe } from './matchers.ts';
import {
  chooseManaBase,
  ManaBaseError,
  planLandCount,
  type ColorPlan,
  type ManaBase,
  type SpellCopies,
} from './lands.ts';
import {
  colorsLabel,
  identityWithin,
  isCommanderSize,
  normalizeColors,
  pipDemand,
  playableWith,
  sourcesNeeded,
} from './colors.ts';
import type { CardIndex } from './pack.ts';
import { learnedAt, learnedPlanFor, learnedSizeKey, learnedTheme, type Spread } from './learned.ts';
import { planScores } from './plan.ts';
import {
  commanderTribes,
  countCopies,
  effectiveCurveProfile,
  effectiveQuotas,
  effectiveTypeMix,
  scanCandidates,
  secondaryLabel,
  tribalArchetype,
  tribeOf,
  tribeShortfall,
} from './scan.ts';
import {
  type BuildExplanation,
  type BuildRequest,
  RARITY_LABELS,
  type BuildResult,
  type CardRecord,
  type Color,
  type Deck,
  type DeckScore,
  type DeckSize,
  type DeckCard,
  type Pool,
  type ScanReport,
} from './types.ts';

export class BuildError extends Error {
  override name = 'BuildError';
}

/** Reason recorded for a copy picked only to fill a slot. */
export const FILLER_WHY = 'Filler';
const CURVE_WHY_PREFIX = 'Curve: ';

/** Reason recorded for a copy picked to fill a curve bucket. */
export function curveWhy(bucket: number): string {
  return bucket === 7 ? `${CURVE_WHY_PREFIX}7-plus drop` : `${CURVE_WHY_PREFIX}${bucket}-drop`;
}

/**
 * Whether a pick counts as filler for evaluation: picked as filler, or picked
 * for the curve by a card that fills none of the deck's roles.
 */
export function isFillerPick(why: string | undefined, fillsRole: boolean): boolean {
  if (why === FILLER_WHY) return true;
  return !fillsRole && (why?.startsWith(CURVE_WHY_PREFIX) ?? false);
}

/** Why a copy was picked, which also decides what gets trimmed first. */
type PickKind =
  'roleMin' | 'colorMin' | 'theme' | 'roleTarget' | 'typeMin' | 'curve' | 'filler' | 'swap';

/** Trim order: filler goes first; role minimums go only as a last resort. */
const TRIM_ORDER: PickKind[] = [
  'filler',
  'curve',
  'typeMin',
  'swap',
  'roleTarget',
  'theme',
  'colorMin',
  'roleMin',
];

interface Chosen {
  cand: Candidate;
  qty: number;
  why: string;
}

interface Pick {
  id: string;
  kind: PickKind;
}

interface State {
  /** Spell slots: deck size minus the current land count. */
  slots: number;
  chosen: Map<string, Chosen>;
  /** One entry per chosen copy, in pick order. */
  order: Pick[];
}

type Tiebreak = BuilderWeightsConfig['tiebreaks'][number];

interface Ctx {
  config: BulkBrewConfig;
  template: DeckTemplate;
  archetype: Archetype;
  quotas: Record<string, RoleQuota>;
  typeMix: TypeMix;
  curveShape: number[];
  weights: BuilderWeightsConfig;
  /** Multiplier on the synergy term, from the chosen archetype. */
  synergyScale: number;
  roleLabels: Map<string, string>;
  /** Spell candidates in card id order. */
  spells: Candidate[];
  plan: ColorPlan;
  /** Card strength points taken off spells that strain the mana base (multi-color only). */
  penalty: Map<string, number>;
  secondary: SecondaryTheme | undefined;
  /** Theme weight per card id: primary enabler and payoff count 1 each, secondary ones a share. */
  themeValue: Map<string, number>;
  /** Theme membership per card id, as THEME_* bits. */
  themeFlags: Map<string, number>;
  /** Theme minimums the swaps must not drop below: primary, then secondary. */
  themeWant: { pe: number; pp: number; se: number; sp: number };
  /** The primary style's theme cards, for a synergy style or a tribe. */
  theme: PrimaryTheme | undefined;
  /** The middle half of real decks of the plan, for roles and card types (learned). */
  profile: PlanShape | undefined;
}

/** Where real decks of a plan sit for each role and card type, as shares of their spells. */
interface PlanShape {
  roles: [string, Spread][];
  creatures?: Spread;
  instSorc?: Spread;
  ncPerm?: Spread;
  /** Objective points per copy outside the middle half. */
  weight: number;
}

/** The learned shape of a plan at a size, when the builder is set to use it. */
function planShapeOf(a: Archetype, config: BulkBrewConfig, size: DeckSize): PlanShape | undefined {
  const weight = learnedAt(config, size) ? (config.builderWeights.learned?.profileWeight ?? 0) : 0;
  const block = config.learned?.plans.sizes[learnedSizeKey(size)];
  if (!weight || !block) return undefined;
  // A shape has its own profile (aggro, midrange, control); a style needs enough real decks behind it.
  const plan = learnedPlanFor(config, a.id, size);
  if (!plan || plan.source !== 'plan') return undefined;
  const at = (name: string) => plan.q[block.features.indexOf(name)] ?? undefined;
  const roles: [string, Spread][] = [];
  for (const name of block.features) {
    const q = at(name);
    if (name.startsWith('role ') && q) roles.push([name.slice(5), q]);
  }
  const out: PlanShape = { roles, weight };
  const creatures = at('creatures');
  const instSorc = at('instants and sorceries');
  const ncPerm = at('other permanents');
  if (creatures) out.creatures = creatures;
  if (instSorc) out.instSorc = instSorc;
  if (ncPerm) out.ncPerm = ncPerm;
  return out;
}

/** Copies a count sits outside a spread's middle half, scaled to a slot count. */
function outside(have: number, q: Spread, slots: number): number {
  return Math.max(0, q[0] * slots - have, have - q[2] * slots);
}

/** How a primary style's theme cards are told apart, and how many it needs. */
interface PrimaryTheme {
  isEnabler(c: Candidate): boolean;
  isPayoff(c: Candidate): boolean;
  want: { enablers: number; payoffs: number };
  /** Theme copies real decks of the plan play at a slot count, when learned and switched on. */
  target?: (slots: number) => { enablers: number; payoffs: number };
  enablerWhy: string;
  payoffWhy: string;
  /**
   * Whether members and payoffs count as synergy pairs themselves. A tribe
   * has no synergy rule of its own, so its pairs would go uncounted.
   */
  pairs: boolean;
}

/** Theme tests for a primary style: config themes by their matchers, tribes by type and tag. */
function themeOf(a: Archetype, config: BulkBrewConfig, size: DeckSize): PrimaryTheme | undefined {
  if (a.kind !== 'synergy') return undefined;
  const want = minimumsFor(config, a, size);
  const target =
    config.builderWeights.learned?.fillToTarget && learnedAt(config, size)
      ? (slots: number) => learnedTheme(config, a.id, size, slots)?.target ?? want
      : undefined;
  const type = tribeOf(a.id);
  if (type) {
    const tag = `typal-${type.toLowerCase()}`;
    return {
      isEnabler: (c) => inTribe(c.facts.card, type),
      isPayoff: (c) => c.facts.card.tags.includes(tag),
      want,
      ...(target ? { target } : {}),
      enablerWhy: a.label,
      payoffWhy: `${a.label} payoff`,
      pairs: true,
    };
  }
  return {
    isEnabler: (c) => c.facts.enablerOf.includes(a.id),
    isPayoff: (c) => c.facts.payoffOf.includes(a.id),
    want,
    ...(target ? { target } : {}),
    enablerWhy: `${a.label} enabler`,
    payoffWhy: `${a.label} payoff`,
    pairs: false,
  };
}

const THEME_PE = 1;
const THEME_PP = 2;
const THEME_SE = 4;
const THEME_SP = 8;

/** A secondary style resolved against the primary: a second theme, a shape, or a tribe. */
interface SecondaryTheme {
  id: string;
  label: string;
  kind: 'synergy' | 'composition' | 'tribal';
  /** The shape archetype whose curve, type mix, and roles replace the primary's. */
  shape?: Archetype;
  isEnabler(c: Candidate): boolean;
  isPayoff(c: Candidate): boolean;
  want: { enablers: number; payoffs: number };
}

/**
 * Resolve a secondary style id for a primary archetype. A second theme needs
 * a share of its minimums; a shape only goes under a themed primary; a tribe
 * needs members and type payoffs. Returns a note when the id cannot apply.
 */
function resolveSecondary(
  id: string | undefined,
  primary: Archetype,
  config: BulkBrewConfig,
  size: DeckSize,
): { theme?: SecondaryTheme; note?: string } {
  if (!id) return {};
  const sec = config.builderWeights.secondary;
  if (id === primary.id)
    return { note: `Ignored the secondary archetype ${secondaryLabel(config, id)}.` };
  if (id.startsWith('tribal:')) {
    const type = id.slice(7);
    const tag = `typal-${type.toLowerCase()}`;
    return {
      theme: {
        id,
        label: secondaryLabel(config, id),
        kind: 'tribal',
        isEnabler: (c) => inTribe(c.facts.card, type),
        isPayoff: (c) => c.facts.card.tags.includes(tag),
        want: forSize(sec.tribal, size),
      },
    };
  }
  const a = config.archetypes.archetypes.find((x) => x.id === id);
  if (!a || a.id === primary.id)
    return { note: `Ignored the secondary archetype ${secondaryLabel(config, id)}.` };
  if (a.kind === 'composition') {
    if (primary.kind === 'composition')
      return { note: `${a.label} cannot be a secondary archetype under ${primary.label}.` };
    return {
      theme: {
        id,
        label: a.label,
        kind: 'composition',
        shape: a,
        isEnabler: () => false,
        isPayoff: () => false,
        want: { enablers: 0, payoffs: 0 },
      },
    };
  }
  return {
    theme: {
      id,
      label: a.label,
      kind: 'synergy',
      isEnabler: (c) => c.facts.enablerOf.includes(a.id),
      isPayoff: (c) => c.facts.payoffOf.includes(a.id),
      want: {
        enablers: Math.ceil(minimumsFor(config, a, size).enablers * sec.minimumShare),
        payoffs: Math.ceil(minimumsFor(config, a, size).payoffs * sec.minimumShare),
      },
    },
  };
}

interface Tally {
  total: number;
  curve: number[];
  creatures: number;
  instSorc: number;
  ncPerm: number;
  roles: Map<string, number>;
  ruleEnablers: Map<string, number>;
  rulePayoffs: Map<string, number>;
  themeHits: number;
  /** Sum of card strength over every copy. */
  strength: number;
  /** Sum of cast penalties over every copy. */
  castPen: number;
  /** Copies of primary and secondary theme enablers and payoffs. */
  pe: number;
  pp: number;
  se: number;
  sp: number;
}

function bump(map: Map<string, number>, key: string, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function emptyTally(): Tally {
  return {
    total: 0,
    curve: [0, 0, 0, 0, 0, 0, 0, 0],
    creatures: 0,
    instSorc: 0,
    ncPerm: 0,
    roles: new Map(),
    ruleEnablers: new Map(),
    rulePayoffs: new Map(),
    themeHits: 0,
    strength: 0,
    castPen: 0,
    pe: 0,
    pp: 0,
    se: 0,
    sp: 0,
  };
}

function addToTally(
  t: Tally,
  f: CardFacts,
  qty: number,
  theme: number,
  pen: number,
  flags: number,
): void {
  t.total += qty;
  if (flags & THEME_PE) t.pe += qty;
  if (flags & THEME_PP) t.pp += qty;
  if (flags & THEME_SE) t.se += qty;
  if (flags & THEME_SP) t.sp += qty;
  t.castPen += pen * qty;
  t.curve[f.bucket]! += qty;
  if (f.creature) t.creatures += qty;
  if (f.instantOrSorcery) t.instSorc += qty;
  if (f.noncreaturePermanent) t.ncPerm += qty;
  t.strength += f.strength * qty;
  for (const r of f.roles) bump(t.roles, r, qty);
  for (const r of f.ruleEnabler) bump(t.ruleEnablers, r, qty);
  for (const r of f.rulePayoff) bump(t.rulePayoffs, r, qty);
  t.themeHits += theme * qty;
}

function tally(state: State, ctx: Ctx): Tally {
  const t = emptyTally();
  for (const { cand, qty } of state.chosen.values()) {
    const id = cand.facts.card.id;
    addToTally(
      t,
      cand.facts,
      qty,
      ctx.themeValue.get(id) ?? 0,
      ctx.penalty.get(id) ?? 0,
      ctx.themeFlags.get(id) ?? 0,
    );
  }
  return t;
}

const TARGETS_CACHE = new WeakMap<number[], Map<number, number[]>>();

/**
 * Curve targets per bucket 1 through 7 for a slot count, rounded so they sum
 * to the slots. Cached per shape and slot count; callers must not change the result.
 */
export function curveTargets(shape: number[], slots: number): number[] {
  let bySlots = TARGETS_CACHE.get(shape);
  if (!bySlots) TARGETS_CACHE.set(shape, (bySlots = new Map()));
  let out = bySlots.get(slots);
  if (!out) bySlots.set(slots, (out = computeTargets(shape, slots)));
  return out;
}

function computeTargets(shape: number[], slots: number): number[] {
  const raw = shape.map((s) => s * slots);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = slots - floors.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return [0, ...floors];
}

/** Weighted enabler and payoff pairs over the synergy rules, plus a tribe's own pairs. */
function synergyPairs(t: Tally, ctx: Ctx): number {
  let pairs = 0;
  for (const rule of ctx.config.synergyRules.rules) {
    const e = t.ruleEnablers.get(rule.id) ?? 0;
    const p = t.rulePayoffs.get(rule.id) ?? 0;
    pairs += rule.weight * Math.min(e, p);
  }
  if (ctx.theme?.pairs) pairs += Math.min(t.pe, t.pp);
  return pairs;
}

function objective(state: State, ctx: Ctx): number {
  return objectiveOf(tally(state, ctx), state.slots, ctx);
}

function objectiveOf(t: Tally, slots: number, ctx: Ctx): number {
  const w = ctx.weights.objective;
  let s = 0;
  const targets = curveTargets(ctx.curveShape, slots);
  for (let b = 1; b <= 7; b++) {
    const have = t.curve[b]! + (b === 1 ? t.curve[0]! : 0);
    s -=
      w.curveDeviation * Math.max(0, Math.abs(have - targets[b]!) - ctx.template.tolerances.curve);
  }
  const tol = ctx.template.tolerances.typeMix * slots;
  const tm = ctx.typeMix;
  s -= w.typeMixDeviation * Math.max(0, tm.creatureMin * slots - t.creatures - tol);
  s -= w.typeMixDeviation * Math.max(0, t.creatures - tm.creatureMax * slots - tol);
  s -= w.typeMixDeviation * Math.max(0, tm.instantSorceryMin * slots - t.instSorc - tol);
  s -= w.typeMixDeviation * Math.max(0, t.ncPerm - tm.noncreaturePermanentMax * slots - tol);
  for (const [roleId, q] of Object.entries(ctx.quotas)) {
    const have = t.roles.get(roleId) ?? 0;
    s -= w.roleShortfall * (2 * Math.max(0, q.min - have) + Math.max(0, q.target - have));
  }
  s += w.synergyDensity * ctx.synergyScale * synergyPairs(t, ctx);
  s += w.themeHit * t.themeHits;
  s += w.cardStrength * (t.strength - t.castPen);
  const p = ctx.profile;
  if (p) {
    let off = 0;
    for (const [roleId, q] of p.roles) off += outside(t.roles.get(roleId) ?? 0, q, slots);
    if (p.creatures) off += outside(t.creatures, p.creatures, slots);
    if (p.instSorc) off += outside(t.instSorc, p.instSorc, slots);
    if (p.ncPerm) off += outside(t.ncPerm, p.ncPerm, slots);
    s -= p.weight * off;
  }
  return s;
}

function remaining(state: State, cand: Candidate): number {
  return cand.available - (state.chosen.get(cand.facts.card.id)?.qty ?? 0);
}

/**
 * How far a pass may bend the guidelines. Shaped passes keep the type caps and
 * the preferred copy counts; the filler passes drop the type caps, then the
 * copy guidelines, so a narrow pool still fills every slot. Hard limits
 * (pool copies, the copy limit setting) always hold.
 */
type Relax = 'none' | 'types' | 'copies' | 'all';

function canAdd(state: State, ctx: Ctx, cand: Candidate, t: Tally, relax: Relax = 'none'): boolean {
  if (remaining(state, cand) <= 0) return false;
  if (t.total >= state.slots) return false;
  const bendCopies = relax === 'copies' || relax === 'all';
  if (!bendCopies && (state.chosen.get(cand.facts.card.id)?.qty ?? 0) >= cand.preferred)
    return false;
  if (relax === 'types' || relax === 'all') return true;
  const f = cand.facts;
  if (f.creature && t.creatures + 1 > Math.ceil(ctx.typeMix.creatureMax * state.slots))
    return false;
  if (
    f.noncreaturePermanent &&
    t.ncPerm + 1 > Math.ceil(ctx.typeMix.noncreaturePermanentMax * state.slots)
  )
    return false;
  return true;
}

function addOne(state: State, cand: Candidate, why: string, kind: PickKind): void {
  const id = cand.facts.card.id;
  const existing = state.chosen.get(id);
  if (existing) existing.qty += 1;
  else state.chosen.set(id, { cand, qty: 1, why });
  state.order.push({ id, kind });
}

/** Remove the most recently picked copy of a card. */
function removeOne(state: State, id: string): Pick | undefined {
  const existing = state.chosen.get(id);
  if (!existing) return undefined;
  existing.qty -= 1;
  if (existing.qty <= 0) state.chosen.delete(id);
  for (let i = state.order.length - 1; i >= 0; i--) {
    if (state.order[i]!.id === id) return state.order.splice(i, 1)[0];
  }
  return undefined;
}

function themeHitsOf(cand: Candidate, ctx: Ctx): number {
  return ctx.themeValue.get(cand.facts.card.id) ?? 0;
}

export function statsPerMana(cand: Candidate): number {
  const f = cand.facts;
  if (!f.creature) return 0;
  return (f.power + f.toughness) / Math.max(1, f.card.mv);
}

/**
 * Compare two candidates by the configured tiebreaks, in order. Positive
 * means a is preferred. Card id breaks any remaining tie so sorting is total.
 */
export function compareCandidates(
  a: Candidate,
  b: Candidate,
  tiebreaks: readonly Tiebreak[],
  themeHits: (c: Candidate) => number,
  strengthOf: (c: Candidate) => number = (c) => c.facts.strength,
): number {
  for (const key of tiebreaks) {
    let d = 0;
    switch (key) {
      case 'themeTagHits':
        d = themeHits(a) - themeHits(b);
        break;
      case 'strength':
        d = strengthOf(a) - strengthOf(b);
        break;
      case 'statsPerMana':
        d = statsPerMana(a) - statsPerMana(b);
        break;
      case 'lowerMv':
        d = b.facts.card.mv - a.facts.card.mv;
        break;
      case 'name': {
        const an = a.facts.card.name;
        const bn = b.facts.card.name;
        d = an === bn ? 0 : an < bn ? 1 : -1;
        break;
      }
    }
    if (Math.abs(d) > 1e-9) return d;
  }
  return a.facts.card.id < b.facts.card.id ? 1 : a.facts.card.id > b.facts.card.id ? -1 : 0;
}

/** Pick the best available candidate passing the filter; false when none can be added. */
function pickBest(
  state: State,
  ctx: Ctx,
  filter: (c: Candidate) => boolean,
  why: string | ((c: Candidate) => string),
  kind: PickKind,
  relax: Relax = 'none',
): boolean {
  const t = tally(state, ctx);
  const targets = curveTargets(ctx.curveShape, state.slots);
  const deficit = (c: Candidate) => {
    const b = Math.max(1, c.facts.bucket);
    const have = t.curve[b]! + (b === 1 ? t.curve[0]! : 0);
    return have < targets[b]! ? 1 : 0;
  };
  let best: Candidate | undefined;
  for (const cand of ctx.spells) {
    if (!filter(cand) || !canAdd(state, ctx, cand, t, relax)) continue;
    if (!best) {
      best = cand;
      continue;
    }
    // A card that fills a curve gap wins; then the configured tiebreaks decide.
    const d = deficit(cand) - deficit(best);
    const better =
      d > 0 ||
      (d === 0 &&
        compareCandidates(
          cand,
          best,
          ctx.weights.tiebreaks,
          (c) => themeHitsOf(c, ctx),
          (c) => c.facts.strength - (ctx.penalty.get(c.facts.card.id) ?? 0),
        ) > 0);
    if (better) best = cand;
  }
  if (!best) return false;
  addOne(state, best, typeof why === 'string' ? why : why(best), kind);
  return true;
}

function roleLabel(ctx: Ctx, roleId: string): string {
  return ctx.roleLabels.get(roleId) ?? roleId;
}

function describeWhy(cand: Candidate, ctx: Ctx): string {
  for (const roleId of Object.keys(ctx.quotas)) {
    if (cand.facts.roles.includes(roleId)) return roleLabel(ctx, roleId);
  }
  if (ctx.theme) {
    if (ctx.theme.isPayoff(cand)) return ctx.theme.payoffWhy;
    if (ctx.theme.isEnabler(cand)) return ctx.theme.enablerWhy;
  }
  const sec = ctx.secondary;
  if (sec && sec.kind !== 'composition') {
    if (sec.isPayoff(cand)) return `${sec.label} payoff`;
    if (sec.isEnabler(cand)) return sec.kind === 'tribal' ? sec.label : `${sec.label} enabler`;
  }
  return FILLER_WHY;
}

/** Roles fill in the template's key order, so removal comes before filler-ish roles. */
function fillRoles(state: State, ctx: Ctx, level: 'min' | 'target', kind: PickKind): void {
  for (const roleId of Object.keys(ctx.quotas)) {
    const want = ctx.quotas[roleId]![level];
    // Minimums may bend the copy guidelines, since the scan counted every copy the settings allow.
    const passes: Relax[] = level === 'min' ? ['none', 'copies'] : ['none'];
    for (const relax of passes) {
      for (;;) {
        const have = tally(state, ctx).roles.get(roleId) ?? 0;
        if (have >= want) break;
        const ok = pickBest(
          state,
          ctx,
          (c) => c.facts.roles.includes(roleId),
          roleLabel(ctx, roleId),
          kind,
          relax,
        );
        if (!ok) break;
      }
    }
  }
}

function fillTheme(state: State, ctx: Ctx): void {
  const theme = ctx.theme;
  if (!theme) return;
  const want = theme.want;
  const count = (pick: (c: Candidate) => boolean) => {
    let n = 0;
    for (const { cand, qty } of state.chosen.values()) if (pick(cand)) n += qty;
    return n;
  };
  // Theme cards strong enough to play on their own go first; weaker ones only fill what is left.
  const bar = ctx.config.cardStrength.themeMinStrength;
  const strong = (c: Candidate) => c.facts.strength >= bar;
  const { isEnabler, isPayoff } = theme;
  // Last, bend the copy guidelines: the scan counted every copy the settings allow.
  const passes: [(c: Candidate) => boolean, Relax][] = [
    [strong, 'none'],
    [() => true, 'none'],
    [() => true, 'copies'],
  ];
  for (const [ok, relax] of passes) {
    const pick = (c: Candidate) => isPayoff(c) && ok(c);
    while (
      count(isPayoff) < want.payoffs &&
      pickBest(state, ctx, pick, theme.payoffWhy, 'theme', relax)
    );
  }
  for (const [ok, relax] of passes) {
    const pick = (c: Candidate) => isEnabler(c) && ok(c);
    while (
      count(isEnabler) < want.enablers &&
      pickBest(state, ctx, pick, theme.enablerWhy, 'theme', relax)
    );
  }
}

/**
 * The primary theme from its minimums toward what real decks of the plan
 * play (learned), after the roles reach their targets, so the plan runs as
 * deep as a real deck's within the size's role and curve limits. Strong
 * cards first; the copy guidelines hold.
 */
function fillThemeTarget(state: State, ctx: Ctx): void {
  const theme = ctx.theme;
  if (!theme?.target) return;
  const want = theme.target(state.slots);
  const count = (pick: (c: Candidate) => boolean) => {
    let n = 0;
    for (const { cand, qty } of state.chosen.values()) if (pick(cand)) n += qty;
    return n;
  };
  const bar = ctx.config.cardStrength.themeMinStrength;
  for (const strongOnly of [true, false]) {
    const ok = (c: Candidate) => !strongOnly || c.facts.strength >= bar;
    while (
      count(theme.isPayoff) < want.payoffs &&
      pickBest(state, ctx, (c) => theme.isPayoff(c) && ok(c), theme.payoffWhy, 'theme')
    );
    while (
      count(theme.isEnabler) < want.enablers &&
      pickBest(state, ctx, (c) => theme.isEnabler(c) && ok(c), theme.enablerWhy, 'theme')
    );
  }
}

function fillTypeMinimums(state: State, ctx: Ctx): void {
  const creatureMin = Math.floor(ctx.typeMix.creatureMin * state.slots);
  while (tally(state, ctx).creatures < creatureMin) {
    if (
      !pickBest(
        state,
        ctx,
        (c) => c.facts.creature,
        (c) => describeWhy(c, ctx),
        'typeMin',
      )
    )
      break;
  }
  const spellMin = Math.floor(ctx.typeMix.instantSorceryMin * state.slots);
  while (tally(state, ctx).instSorc < spellMin) {
    const ok = pickBest(
      state,
      ctx,
      (c) => c.facts.instantOrSorcery,
      (c) => describeWhy(c, ctx),
      'typeMin',
    );
    if (!ok) break;
  }
}

function fillCurve(state: State, ctx: Ctx): void {
  const targets = curveTargets(ctx.curveShape, state.slots);
  const exhausted = new Set<number>();
  for (;;) {
    const t = tally(state, ctx);
    if (t.total >= state.slots) return;
    let bucket = -1;
    let deficit = 0;
    for (let b = 1; b <= 7; b++) {
      if (exhausted.has(b)) continue;
      const have = t.curve[b]! + (b === 1 ? t.curve[0]! : 0);
      const d = targets[b]! - have;
      if (d > deficit) {
        deficit = d;
        bucket = b;
      }
    }
    if (bucket < 0) return;
    const label = curveWhy(bucket);
    const inBucket = (c: Candidate) => Math.max(1, c.facts.bucket) === bucket;
    if (!pickBest(state, ctx, inBucket, label, 'curve')) exhausted.add(bucket);
  }
}

function fillAny(state: State, ctx: Ctx): void {
  for (const relax of ['types', 'all'] as const) {
    while (tally(state, ctx).total < state.slots) {
      if (
        !pickBest(
          state,
          ctx,
          () => true,
          (c) => describeWhy(c, ctx),
          'filler',
          relax,
        )
      )
        break;
    }
  }
}

/** The secondary theme or tribe to its minimums, strong cards first, as the primary theme does. */
function fillSecondary(state: State, ctx: Ctx): void {
  const sec = ctx.secondary;
  if (!sec || sec.kind === 'composition') return;
  const count = (pick: (c: Candidate) => boolean) => {
    let n = 0;
    for (const { cand, qty } of state.chosen.values()) if (pick(cand)) n += qty;
    return n;
  };
  const bar = ctx.config.cardStrength.themeMinStrength;
  const passes: [(c: Candidate) => boolean, Relax][] = [
    [(c) => c.facts.strength >= bar, 'none'],
    [() => true, 'none'],
    [() => true, 'copies'],
  ];
  const payoffWhy = `${sec.label} payoff`;
  const enablerWhy = sec.kind === 'tribal' ? sec.label : `${sec.label} enabler`;
  for (const [ok, relax] of passes) {
    const pick = (c: Candidate) => sec.isPayoff(c) && ok(c);
    while (
      count(sec.isPayoff) < sec.want.payoffs &&
      pickBest(state, ctx, pick, payoffWhy, 'theme', relax)
    );
  }
  for (const [ok, relax] of passes) {
    const pick = (c: Candidate) => sec.isEnabler(c) && ok(c);
    while (
      count(sec.isEnabler) < sec.want.enablers &&
      pickBest(state, ctx, pick, enablerWhy, 'theme', relax)
    );
  }
}

/**
 * Every color of a multi-color deck gets at least its minimum of spells of
 * that color. A color the pool holds fewer of is a light splash: its cards
 * come in on their own merit, not forced in to name the deck.
 */
function fillColorMinimums(state: State, ctx: Ctx): void {
  if (ctx.plan.colors.length < 2) return;
  const want = forSize(ctx.config.landRules.colors.minCardsPerColor, ctx.template.size);
  for (const color of ctx.plan.colors) {
    const has = (c: Candidate) => c.facts.card.colors.includes(color);
    if (countCopies(ctx.spells, has) < want) continue;
    const count = () => {
      let n = 0;
      for (const { cand, qty } of state.chosen.values()) if (has(cand)) n += qty;
      return n;
    };
    while (count() < want && pickBest(state, ctx, has, (c) => describeWhy(c, ctx), 'colorMin'));
  }
}

function fillAll(state: State, ctx: Ctx): void {
  fillRoles(state, ctx, 'min', 'roleMin');
  fillTheme(state, ctx);
  fillSecondary(state, ctx);
  fillColorMinimums(state, ctx);
  fillRoles(state, ctx, 'target', 'roleTarget');
  fillThemeTarget(state, ctx);
  fillTypeMinimums(state, ctx);
  fillCurve(state, ctx);
  fillAny(state, ctx);
}

/** Drop copies down to the slot count, least important picks first. */
function trimTo(state: State, slots: number): void {
  for (const kind of TRIM_ORDER) {
    for (let i = state.order.length - 1; i >= 0 && state.order.length > slots; i--) {
      if (state.order[i]!.kind !== kind) continue;
      const { id } = state.order[i]!;
      const existing = state.chosen.get(id)!;
      existing.qty -= 1;
      if (existing.qty <= 0) state.chosen.delete(id);
      state.order.splice(i, 1);
    }
    if (state.order.length <= slots) return;
  }
}

function spellCopies(state: State): SpellCopies[] {
  return [...state.chosen.values()].map(({ cand, qty }) => ({ facts: cand.facts, qty }));
}

/** Re-fit the land count to the chosen spells until it stops moving (bounded). */
function refitLands(state: State, ctx: Ctx, lands: number, size: number): number {
  for (let i = 0; i < 4; i++) {
    const plan = planLandCount(ctx.template, spellCopies(state), ctx.config.landRules.mdfc);
    if (plan.count === lands) break;
    lands = plan.count;
    state.slots = size - lands;
    if (state.order.length > state.slots) trimTo(state, state.slots);
    else fillAll(state, ctx);
  }
  return lands;
}

function localSearch(state: State, ctx: Ctx): number {
  const { maxPasses, maxSwapsPerPass } = ctx.weights.localSearch;
  let accepted = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    let swaps = 0;
    let best = objective(state, ctx);
    const chosenIds = [...state.chosen.keys()].sort();
    for (const outId of chosenIds) {
      if (swaps >= maxSwapsPerPass) break;
      const out = state.chosen.get(outId);
      if (!out) continue;
      const outWhy = out.why;
      const outCand = out.cand;
      let outKind: PickKind | undefined;
      let base: Tally | undefined;
      let swapped = false;
      for (const cand of ctx.spells) {
        const inId = cand.facts.card.id;
        if (inId === outId || remaining(state, cand) <= 0) continue;
        if (!base) {
          outKind = removeOne(state, outId)?.kind ?? 'swap';
          base = tally(state, ctx);
        }
        if (!canAdd(state, ctx, cand, base)) continue;
        // A swap may not take a theme card away while the style is at or below its minimum.
        const outFlags = ctx.themeFlags.get(outId) ?? 0;
        const inFlags = ctx.themeFlags.get(cand.facts.card.id) ?? 0;
        const tw = ctx.themeWant;
        const drops = (bit: number, have: number, want: number) =>
          (outFlags & bit) !== 0 && (inFlags & bit) === 0 && have < want;
        if (
          drops(THEME_PE, base.pe, tw.pe) ||
          drops(THEME_PP, base.pp, tw.pp) ||
          drops(THEME_SE, base.se, tw.se) ||
          drops(THEME_SP, base.sp, tw.sp)
        )
          continue;
        // Score the swap by adding the copy to the tally and taking it back out.
        const pen = ctx.penalty.get(cand.facts.card.id) ?? 0;
        const theme = ctx.themeValue.get(cand.facts.card.id) ?? 0;
        const flags = ctx.themeFlags.get(cand.facts.card.id) ?? 0;
        addToTally(base, cand.facts, 1, theme, pen, flags);
        const val = objectiveOf(base, state.slots, ctx);
        addToTally(base, cand.facts, -1, theme, pen, flags);
        if (val > best + 1e-9) {
          addOne(state, cand, describeWhy(cand, ctx), 'swap');
          best = val;
          swaps++;
          accepted++;
          improved = true;
          swapped = true;
          break;
        }
      }
      // No better swap: the outgoing copy goes back, at the end of the pick order as before.
      if (base && !swapped) addOne(state, outCand, outWhy, outKind!);
    }
    if (!improved) break;
  }
  return accepted;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Share of spell copies the mana base casts on curve: for each color a spell
 * asks for, the deck has at least the sources that color's target chance needs.
 */
function castability(state: State, ctx: Ctx, mana: ManaBase, lands: number): number {
  const plan = ctx.plan;
  const prefer = [plan.main, ...plan.colors.filter((c) => c !== plan.main)];
  const chance = ctx.config.landRules.colors.castChance;
  const size = ctx.template.size;
  let ok = 0;
  let all = 0;
  for (const { cand, qty } of state.chosen.values()) {
    const card = cand.facts.card;
    const demand = pipDemand(card, prefer);
    let fine = true;
    for (const c of plan.colors) {
      const pips = demand[c] ?? 0;
      if (pips === 0) continue;
      const target = plan.colors.length === 1 ? chance.main : chance[plan.role[c] ?? 'secondary'];
      const need = sourcesNeeded(
        size,
        lands,
        pips,
        Math.ceil(card.mv),
        target,
        isCommanderSize(size),
      );
      if ((mana.sources[c] ?? 0) < need) fine = false;
    }
    all += qty;
    if (fine) ok += qty;
  }
  return all > 0 ? ok / all : 1;
}

/** Deck score: synergy, card strength, roles, curve, type mix, and castability, each 0 to 1. */
function scoreDeck(state: State, ctx: Ctx, mana: ManaBase, lands: number): DeckScore {
  const t = tally(state, ctx);
  const cfg = ctx.weights.deckScore;
  const slots = Math.max(1, state.slots);
  const spells = Math.max(1, t.total);
  const [lo, hi] = cfg.strengthRange;
  const strength = clamp01((t.strength / spells - lo) / (hi - lo));

  let roleSum = 0;
  let roleCount = 0;
  for (const [roleId, q] of Object.entries(ctx.quotas)) {
    if (q.target <= 0) continue;
    roleSum += Math.min(1, (t.roles.get(roleId) ?? 0) / q.target);
    roleCount++;
  }
  const roles = roleCount > 0 ? roleSum / roleCount : 1;

  const slack = cfg.shapeSlack * slots;
  const targets = curveTargets(ctx.curveShape, slots);
  let curveDev = 0;
  for (let b = 1; b <= 7; b++) {
    const have = t.curve[b]! + (b === 1 ? t.curve[0]! : 0);
    curveDev += Math.max(0, Math.abs(have - targets[b]!) - ctx.template.tolerances.curve);
  }
  const curve = clamp01(1 - curveDev / slack);

  const tol = ctx.template.tolerances.typeMix * slots;
  const tm = ctx.typeMix;
  const typeDev =
    Math.max(0, tm.creatureMin * slots - t.creatures - tol) +
    Math.max(0, t.creatures - tm.creatureMax * slots - tol) +
    Math.max(0, tm.instantSorceryMin * slots - t.instSorc - tol) +
    Math.max(0, t.ncPerm - tm.noncreaturePermanentMax * slots - tol);
  const typeMix = clamp01(1 - typeDev / slack);

  const synergy = clamp01(synergyPairs(t, ctx) / spells / cfg.synergyReference);

  const cast = castability(state, ctx, mana, lands);
  const w = cfg.weights;
  const sumW = w.strength + w.roles + w.curve + w.typeMix + w.synergy + w.castability;
  const weighted =
    w.strength * strength +
    w.roles * roles +
    w.curve * curve +
    w.typeMix * typeMix +
    w.synergy * synergy +
    w.castability * cast;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    total: Math.round((1000 * weighted) / sumW) / 10,
    strength: r3(strength),
    roles: r3(roles),
    curve: r3(curve),
    typeMix: r3(typeMix),
    synergy: r3(synergy),
    castability: r3(cast),
  };
}

/**
 * Archetypes to try for best fit: the viable synergy themes with the largest
 * scan margins, then the viable composition shapes. The margin says how deep
 * a theme runs in the pool, not how good its deck is, so each is built and
 * the deck score decides.
 */
export function bestFitCandidates(scan: ScanReport, config: BulkBrewConfig): Archetype[] {
  const byId = new Map(config.archetypes.archetypes.map((a) => [a.id, a]));
  const bf = config.builderWeights.bestFit;
  const synergy = scan.archetypes
    .filter((r) => r.kind === 'synergy' && r.viable)
    .sort((a, b) => b.margin - a.margin || (a.archetype < b.archetype ? -1 : 1))
    .slice(0, bf.synergyCandidates);
  const composition = scan.archetypes
    .filter((r) => r.kind === 'composition' && r.viable)
    .sort(
      (a, b) =>
        b.margin - a.margin ||
        (a.archetype === 'midrange' ? -1 : b.archetype === 'midrange' ? 1 : 0) ||
        (a.archetype < b.archetype ? -1 : 1),
    )
    .slice(0, bf.compositionCandidates);
  return [...synergy, ...composition].map((r) => byId.get(r.archetype)!);
}

/**
 * The main color carries the most weight among the candidates (strength
 * times copies of spells asking for it); a color carrying much less than the
 * main one is a splash.
 */
export function colorPlan(
  cands: Candidate[],
  colors: readonly Color[],
  config: BulkBrewConfig,
): ColorPlan {
  const list = normalizeColors(colors);
  const weight = new Map<Color, number>(list.map((c) => [c, 0]));
  for (const cand of cands) {
    if (!cand.facts.spell) continue;
    const d = pipDemand(cand.facts.card, list);
    for (const c of list) {
      if ((d[c] ?? 0) > 0)
        weight.set(c, weight.get(c)! + Math.max(0, cand.facts.strength) * cand.preferred);
    }
  }
  const main = list.reduce((a, b) => (weight.get(b)! > weight.get(a)! ? b : a));
  const role: ColorPlan['role'] = {};
  const cut = config.landRules.colors.splashShare * weight.get(main)!;
  for (const c of list) {
    role[c] = c === main ? 'main' : weight.get(c)! < cut ? 'splash' : 'secondary';
  }
  return { colors: [main, ...list.filter((c) => c !== main)], main, role };
}

/** Strength points off for spells that ask a lot of a secondary or splash color. */
export function castPenalties(
  cands: Candidate[],
  plan: ColorPlan,
  config: BulkBrewConfig,
): Map<string, number> {
  const out = new Map<string, number>();
  if (plan.colors.length < 2) return out;
  const p = config.builderWeights.castability;
  for (const cand of cands) {
    if (!cand.facts.spell) continue;
    const card = cand.facts.card;
    const demand = pipDemand(card, plan.colors);
    let pen = 0;
    for (const c of plan.colors) {
      if (c === plan.main) continue;
      const k = demand[c] ?? 0;
      if (k === 0) continue;
      const early = card.mv <= 2;
      if (plan.role[c] === 'splash') {
        pen += p.splashPip * k + (k >= 2 ? p.splashDouble : 0) + (early ? p.splashEarly : 0);
      } else {
        pen +=
          p.secondaryPip * k + (k >= 2 ? p.doubleSecondary : 0) + (early ? p.earlySecondary : 0);
      }
    }
    if (pen > 0) out.set(card.id, pen);
  }
  return out;
}

/** The commander counts toward the roles it fills, so the 99 need fewer of them. */
function creditCommander(
  quotas: Record<string, RoleQuota>,
  roles: readonly string[],
  credit: number,
): Record<string, RoleQuota> {
  if (roles.length === 0) return quotas;
  const out: Record<string, RoleQuota> = {};
  for (const [id, q] of Object.entries(quotas)) {
    out[id] = roles.includes(id)
      ? { min: Math.max(0, q.min - credit), target: Math.max(0, q.target - credit) }
      : q;
  }
  return out;
}

/** The commander for a 100-card request, or a plain-language reason it cannot lead. */
function commanderFor(request: BuildRequest, pool: Pool, index: CardIndex): CardRecord {
  const rarities = request.settings.rarities?.length ? request.settings.rarities : undefined;
  if (!request.commander) throw new BuildError('Pick a commander for a 100-card deck.');
  const card = index.get(request.commander);
  if (!card) throw new BuildError('The picked commander is not in the card data.');
  if (!canBeCommander(card)) throw new BuildError(`${card.name} cannot be a commander.`);
  if ((pool.entries[card.id]?.qty ?? 0) < 1)
    throw new BuildError(`${card.name} is not in your bulk list.`);
  if (rarities && card.rarity && !rarities.includes(card.rarity))
    throw new BuildError(
      `${card.name} is ${RARITY_LABELS[card.rarity].toLowerCase()}, a rarity left out of builds.`,
    );
  if (card.identity.length === 0)
    throw new BuildError(`${card.name} is colorless; colorless commanders are not supported yet.`);
  return card;
}

/** One complete spell build for one archetype, before the mana base is picked. */
interface Attempt {
  archetype: Archetype;
  ctx: Ctx;
  state: State;
  lands: number;
  plan: ReturnType<typeof planLandCount>;
  mana: ManaBase;
  score: DeckScore;
  notes: string[];
}

function attempt(
  archetype: Archetype,
  template: DeckTemplate,
  cands: Candidate[],
  config: BulkBrewConfig,
  request: BuildRequest,
  index: CardIndex,
  colorLabel: string,
  plan: ColorPlan,
  penalty: Map<string, number>,
  secondary: SecondaryTheme | undefined,
  commander: CardRecord | undefined,
): Attempt {
  const { size, settings } = request;
  // A Commander deck builds its 99 around the commander, who takes the hundredth slot.
  const deckSize = commander ? size - 1 : size;
  // A shape as secondary style sets the curve, type mix, and roles under a themed primary.
  const shape = secondary?.shape;
  const spells = cands.filter((c) => c.facts.spell);
  const themeValue = new Map<string, number>();
  const themeFlags = new Map<string, number>();
  const share = config.builderWeights.secondary.themeHitShare;
  const theme = themeOf(archetype, config, size);
  for (const c of spells) {
    const sec = secondary && secondary.kind !== 'composition';
    const pe = theme?.isEnabler(c) ?? false;
    const pp = theme?.isPayoff(c) ?? false;
    const flags =
      (pe ? THEME_PE : 0) |
      (pp ? THEME_PP : 0) |
      (sec && secondary.isEnabler(c) ? THEME_SE : 0) |
      (sec && secondary.isPayoff(c) ? THEME_SP : 0);
    if (flags) themeFlags.set(c.facts.card.id, flags);
    let v = (pe ? 1 : 0) + (pp ? 1 : 0);
    if (secondary && secondary.kind !== 'composition') {
      v += share * ((secondary.isEnabler(c) ? 1 : 0) + (secondary.isPayoff(c) ? 1 : 0));
    }
    if (v > 0) themeValue.set(c.facts.card.id, v);
  }
  const ctx: Ctx = {
    config,
    template,
    archetype,
    quotas: creditCommander(
      shape
        ? { ...effectiveQuotas(template, archetype), ...(roleOverridesFor(shape, size) ?? {}) }
        : effectiveQuotas(template, archetype),
      commander ? factsFor(index, config, commander).roles : [],
      config.builderWeights.commander.roleCredit,
    ),
    typeMix: shape
      ? { ...effectiveTypeMix(template, archetype), ...(shape.typeMixOverrides ?? {}) }
      : effectiveTypeMix(template, archetype),
    curveShape: curveProfileFor(
      config,
      shape && template.size !== 20
        ? shape.curveProfile
        : effectiveCurveProfile(template, archetype),
    ).shape,
    weights: config.builderWeights,
    synergyScale: archetype.kind === 'synergy' ? archetype.synergyWeight : 1,
    roleLabels: new Map(config.roles.roles.map((r) => [r.id, r.label])),
    spells,
    plan,
    penalty,
    secondary,
    themeValue,
    themeFlags,
    themeWant: {
      pe: theme?.want.enablers ?? 0,
      pp: theme?.want.payoffs ?? 0,
      se: secondary?.want.enablers ?? 0,
      sp: secondary?.want.payoffs ?? 0,
    },
    theme,
    profile: planShapeOf(archetype, config, size),
  };
  const notes: string[] = [];

  let lands = template.baseLands;
  const state: State = { slots: deckSize - lands, chosen: new Map(), order: [] };
  fillAll(state, ctx);
  lands = refitLands(state, ctx, lands, deckSize);

  // The swaps keep the theme at the target its fill aimed for, at the slots the land count left.
  if (theme?.target) {
    const t = theme.target(state.slots);
    ctx.themeWant.pe = Math.max(theme.want.enablers, t.enablers);
    ctx.themeWant.pp = Math.max(theme.want.payoffs, t.payoffs);
  }
  const swaps = localSearch(state, ctx);
  if (swaps > 0) {
    notes.push(`Improved by ${swaps} swap${swaps === 1 ? '' : 's'} after the first pass.`);
  }
  lands = refitLands(state, ctx, lands, deckSize);
  let landPlan = planLandCount(template, spellCopies(state), config.landRules.mdfc);

  // A thin pool may not fill every slot: pad with lands up to the clamp.
  if (state.order.length < state.slots) {
    const short = state.slots - state.order.length;
    if (lands + short > template.landFormula.max) {
      throw new BuildError(
        `Not enough playable ${colorLabel} cards for a ${size}-card deck: ${short} spell slots could not be filled.`,
      );
    }
    lands += short;
    state.slots = deckSize - lands;
    landPlan = planLandCount(template, spellCopies(state), config.landRules.mdfc);
    notes.push(`Ran out of fitting spells; added ${short} extra land${short === 1 ? '' : 's'}.`);
  }
  let mana: ManaBase;
  try {
    mana = chooseManaBase(lands, cands, plan, spellCopies(state), config, settings, size, index);
  } catch (err) {
    if (err instanceof ManaBaseError) throw new BuildError(err.message);
    throw err;
  }
  return {
    archetype,
    ctx,
    state,
    lands,
    plan: landPlan,
    mana,
    score: scoreDeck(state, ctx, mana, lands),
    notes,
  };
}

/**
 * The commander's pull on each style to try, as a share of the style bonus.
 * The styles its text rewards (a payoff for them, or a tribe it names) are
 * scaled by how specific they are: the one with the fewest payoffs among the
 * candidates gets all of it, and one with n times as many payoffs gets 1/n²,
 * as a rarer payoff marks the commander's own plan. A commander that rewards
 * none pulls the styles it feeds the same way.
 */
export function commanderPull(
  tryList: readonly Archetype[],
  commander: CardRecord,
  cands: Candidate[],
  index: CardIndex,
  config: BulkBrewConfig,
  size: DeckSize,
): Map<string, number> {
  const facts = factsFor(index, config, commander);
  const rewards = (a: Archetype) => tribeOf(a.id) !== undefined || facts.payoffOf.includes(a.id);
  const leads = tryList.filter(rewards);
  const pulled = leads.length > 0 ? leads : tryList.filter((a) => facts.enablerOf.includes(a.id));
  const payoffs = new Map<string, number>();
  for (const a of pulled) {
    const theme = themeOf(a, config, size);
    if (theme) payoffs.set(a.id, Math.max(1, countCopies(cands, theme.isPayoff)));
  }
  const fewest = Math.min(...payoffs.values());
  const out = new Map<string, number>();
  for (const [id, n] of payoffs) out.set(id, (fewest / n) ** 2);
  return out;
}

/** "Anafenza, Kin-Tree Spirit" becomes "Anafenza"; the front face of a two-faced name. */
function shortName(name: string): string {
  return (name.split(' // ')[0] ?? name).split(',')[0]!.trim();
}

/**
 * Build one deck. Throws BuildError with a plain-language message when the
 * pool cannot make a deck of the requested size and color.
 */

export function buildDeck(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildResult {
  const { size, settings } = request;
  const commander = isCommanderSize(size) ? commanderFor(request, pool, index) : undefined;
  const colors = normalizeColors(commander ? commander.identity : request.colors);
  if (colors.length === 0) throw new BuildError('Pick at least one color.');
  const template = templateFor(config, size);
  const cands = listCandidates(pool, index, config, settings, colors, size).filter(
    (c) => c.facts.card.id !== commander?.id,
  );
  const scan = scanCandidates(cands, config, settings, size, colors);
  const colorLabel = colorsLabel(colors);
  if (!scan.possible) {
    throw new BuildError(
      `Not enough ${colorLabel} cards for a ${size}-card deck: ${scan.notes.join('; ')}.`,
    );
  }

  const notes: string[] = [];
  const byId = new Map(config.archetypes.archetypes.map((a) => [a.id, a]));
  // Under a commander whose text names a creature type, the tribe can be the primary style.
  const tribes = commander ? commanderTribes(commander, cands, config, size) : [];
  let tryList: Archetype[] = [];
  let styleBuilt = false;
  if (request.style) {
    const report = scan.archetypes.find((r) => r.archetype === request.style);
    const tribe = tribes.find((t) => t.archetype.id === request.style);
    const a = byId.get(request.style) ?? tribe?.archetype;
    if ((tribe ? tribe.viable : report?.viable) && a) {
      tryList = [a];
      styleBuilt = true;
    } else {
      const why = tribe
        ? tribeShortfall(tribe, config, size)
        : (report?.notes.join('; ') ??
          (tribeOf(request.style)
            ? commander
              ? `${shortName(commander.name)} does not reward the ${tribeOf(request.style)} tribe`
              : 'a tribe leads only a Commander deck whose commander names it'
            : 'unknown archetype'));
      if (request.requireStyle) {
        throw new BuildError(
          `Not enough cards to build ${a?.label ?? secondaryLabel(config, request.style)}${commander ? ` under ${shortName(commander.name)}` : ''}${why ? `: ${why}` : ''}.`,
        );
      }
      notes.push(
        `Archetype "${a?.label ?? secondaryLabel(config, request.style)}" is not viable here (${why}); picked the best fit instead.`,
      );
    }
  }
  if (tryList.length === 0)
    tryList = [
      ...tribes.filter((t) => t.viable).map((t) => t.archetype),
      ...bestFitCandidates(scan, config),
    ];
  if (tryList.length === 0) {
    const fallback =
      byId.get('midrange') ?? config.archetypes.archetypes.find((a) => a.kind === 'composition')!;
    notes.push(`No archetype fits this bulk list well; built a ${fallback.label} deck anyway.`);
    tryList = [fallback];
  }

  const colorPlanned = colorPlan(cands, colors, config);
  const penalty = castPenalties(cands, colorPlanned, config);

  // A secondary style only means something next to a picked primary style.
  if (request.secondary && !request.style)
    notes.push('A secondary archetype needs a primary archetype; built the best fit without it.');

  // A commander pulls best fit toward the styles its own text rewards or feeds, the most specific most.
  const pull = commander
    ? commanderPull(tryList, commander, cands, index, config, size)
    : new Map<string, number>();
  // With learned plans, best fit builds the plans the pool runs most (see plan.ts) and
  // keeps the best of them; the plain shapes stay in as the fallback and as the "shape" plan.
  // No scores (learned plans off for this size, or not calibrated) keeps best fit's old way.
  const scored =
    !styleBuilt && config.learned && config.builderWeights.learned
      ? planScores(
          tryList.filter((a): a is SynergyArchetype => a.kind === 'synergy'),
          tryList.filter((a) => a.kind === 'composition'),
          cands,
          config,
          index,
          size,
          commander,
          pull,
        )
      : [];
  const plans = scored.length > 0 ? scored : undefined;
  const planScore = new Map(plans?.map((p) => [p.style, p.score]));
  if (plans) {
    // The best themes by plan score; every viable shape stays in as a fallback.
    const kept = new Set(
      plans
        .filter((p) => tryList.some((a) => a.id === p.style && a.kind === 'synergy'))
        .slice(0, config.builderWeights.learned!.candidates)
        .map((p) => p.style),
    );
    const narrowed = tryList.filter((a) => a.kind === 'composition' || kept.has(a.id));
    // Nothing left (no shape viable, no theme deep enough): build what the scan allows, as before.
    if (narrowed.length > 0) tryList = narrowed;
  }
  const rankOf = (at: Attempt) =>
    plans
      ? // The plan leads; the finished deck's score counts by deckScoreWeight (and breaks ties).
        (planScore.get(at.archetype.id) ?? -1e6) +
        (forSize(config.builderWeights.learned!.plan, size).deckScoreWeight + 1e-4) * at.score.total
      : at.score.total +
        (pull.get(at.archetype.id) ?? 0) * config.builderWeights.commander.styleBonus;

  // Ties keep the earlier candidate: themes come first, so a theme beats a plain shape it ties.
  let best: Attempt | undefined;
  let firstError: unknown;
  const tried: Attempt[] = [];
  for (const a of tryList) {
    try {
      const resolved = styleBuilt ? resolveSecondary(request.secondary, a, config, size) : {};
      const at = attempt(
        a,
        template,
        cands,
        config,
        request,
        index,
        colorLabel,
        colorPlanned,
        penalty,
        resolved.theme,
        commander,
      );
      if (resolved.note) at.notes.unshift(resolved.note);
      tried.push(at);
      if (!best || rankOf(at) > rankOf(best)) best = at;
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      firstError ??= err;
    }
  }
  if (!best) throw firstError;
  if (tried.length > 1 && plans) {
    const rest = tried.filter((at) => at !== best).sort((a, b) => rankOf(b) - rankOf(a));
    const shown = rest.slice(0, 3).map((at) => at.archetype.label);
    if (rest.length > 3) shown.push(`${rest.length - 3} more`);
    notes.push(
      `Compared ${tried.length} archetypes and kept ${best.archetype.label}, the plan this bulk list leans to most. Next: ${shown.join(', ')}.`,
    );
  } else if (tried.length > 1) {
    const rest = tried.filter((at) => at !== best).sort((a, b) => b.score.total - a.score.total);
    // Scores stay internal; the note names the runners-up in order.
    const shown = rest.slice(0, 3).map((at) => at.archetype.label);
    if (rest.length > 3) shown.push(`${rest.length - 3} more`);
    const favored =
      rankOf(best) > best.score.total && rest.some((at) => at.score.total > best!.score.total);
    notes.push(
      favored
        ? `Compared ${tried.length} archetypes and kept ${best.archetype.label}, an archetype ${shortName(commander!.name)} leads. Next: ${shown.join(', ')}.`
        : `Compared ${tried.length} archetypes and kept the strongest, ${best.archetype.label}. Next: ${shown.join(', ')}.`,
    );
  }
  const { archetype, ctx, state, lands, plan, mana, score } = best;
  // Whether the deck holds the secondary style's minimums.
  let secondaryInfo: BuildExplanation['secondary'];
  const sec = ctx.secondary;
  if (sec) {
    let enablers = 0;
    let payoffs = 0;
    for (const { cand, qty } of state.chosen.values()) {
      if (sec.isEnabler(cand)) enablers += qty;
      if (sec.isPayoff(cand)) payoffs += qty;
    }
    const met = enablers >= sec.want.enablers && payoffs >= sec.want.payoffs;
    secondaryInfo = { id: sec.id, label: sec.label, met };
    if (!met) {
      const short = [
        enablers < sec.want.enablers
          ? `${enablers} of ${sec.want.enablers} ${sec.kind === 'tribal' ? 'tribe members' : 'enablers'}`
          : '',
        payoffs < sec.want.payoffs ? `${payoffs} of ${sec.want.payoffs} payoffs` : '',
      ]
        .filter(Boolean)
        .join(' and ');
      notes.push(`Could not fully fit the secondary archetype ${sec.label}: ${short}.`);
    }
  }
  notes.push(...best.notes, ...mana.notes);
  const picks = [
    ...[...state.chosen.values()].map(({ cand, qty }) => ({ cand, qty })),
    ...mana.nonbasics.map((p) => ({ cand: p.candidate, qty: p.qty })),
  ].sort((a, b) =>
    a.cand.facts.card.name < b.cand.facts.card.name
      ? -1
      : a.cand.facts.card.name > b.cand.facts.card.name
        ? 1
        : a.cand.facts.card.id < b.cand.facts.card.id
          ? -1
          : 1,
  );
  for (const { cand, qty } of picks) {
    if (qty > cand.preferred) {
      notes.push(
        `Played ${qty} copies of ${cand.facts.card.name}, more than the usual ${cand.preferred}, because the bulk list ran out of other cards.`,
      );
    }
  }

  const t = tally(state, ctx);
  for (const [roleId, q] of Object.entries(ctx.quotas)) {
    const have = t.roles.get(roleId) ?? 0;
    if (have < q.min) {
      const inPool = countCopies(cands, (c) => c.facts.roles.includes(roleId));
      notes.push(
        `Wanted ${q.min} ${roleLabel(ctx, roleId).toLowerCase()}, the bulk list had ${inPool}.`,
      );
    }
  }

  const cards: DeckCard[] = [...state.chosen.values()]
    .sort((a, b) => {
      const an = a.cand.facts.card.name;
      const bn = b.cand.facts.card.name;
      return an < bn ? -1 : an > bn ? 1 : a.cand.facts.card.id < b.cand.facts.card.id ? -1 : 1;
    })
    .map(({ cand, qty, why }) => {
      const dc: DeckCard = { cardId: cand.facts.card.id, qty, why };
      if (cand.printing) dc.printing = cand.printing;
      return dc;
    });
  if (commander) {
    const lead: DeckCard = { cardId: commander.id, qty: 1, why: 'Commander' };
    const printing = pool.entries[commander.id]?.printing;
    if (printing) lead.printing = printing;
    cards.unshift(lead);
  }
  for (const pick of mana.nonbasics) {
    const dc: DeckCard = { cardId: pick.candidate.facts.card.id, qty: pick.qty, why: pick.why };
    if (pick.candidate.printing) dc.printing = pick.candidate.printing;
    cards.push(dc);
  }

  const basicCount = Object.values(mana.basics).reduce((n, q) => n + (q ?? 0), 0);
  const total = cards.reduce((n, c) => n + c.qty, 0) + basicCount;
  if (total !== size) throw new Error(`builder produced ${total} cards for a ${size}-card deck`);
  const limit = maxCopiesFor(settings, config, size);
  for (const dc of cards) {
    const card = index.get(dc.cardId)!;
    const fits = isCommanderSize(size) ? identityWithin(card, colors) : playableWith(card, colors);
    if (!fits) throw new Error(`builder chose off-color ${card.name}`);
    const most = commander ? commanderCopies(card) : limit;
    if (dc.qty > most) throw new Error(`builder exceeded the copy limit on ${card.name}`);
    if (commander && card.commanderLegality)
      throw new Error(`builder chose ${card.name}, which is not legal in Commander`);
  }
  if (lands < template.landFormula.min || lands > template.landFormula.max) {
    throw new Error(`builder picked ${lands} lands, outside the template range`);
  }

  const synergies = config.synergyRules.rules
    .map((rule) => ({
      rule,
      e: t.ruleEnablers.get(rule.id) ?? 0,
      p: t.rulePayoffs.get(rule.id) ?? 0,
    }))
    .filter((s) => s.e > 0 && s.p > 0)
    .sort((a, b) => Math.min(b.e, b.p) - Math.min(a.e, a.p) || (a.rule.id < b.rule.id ? -1 : 1))
    .slice(0, 5)
    .map((s) => `${s.rule.note.replace(/\.$/, '')}: ${s.e} enablers, ${s.p} payoffs`);

  const roles: BuildExplanation['roles'] = {};
  for (const roleId of Object.keys(ctx.quotas)) {
    roles[roleId] = { have: t.roles.get(roleId) ?? 0, want: ctx.quotas[roleId]!.target };
  }
  const nonbasicCount = mana.nonbasics.reduce((n, p) => n + p.qty, 0);
  notes.push(
    `${lands} lands: average cost ${plan.averageMv.toFixed(1)}, ${plan.cheapManaSources} cheap mana source${plan.cheapManaSources === 1 ? '' : 's'}, ${nonbasicCount} nonbasic.`,
  );

  const explanation: BuildExplanation = {
    archetype: archetype.id,
    ...(secondaryInfo ? { secondary: secondaryInfo } : {}),
    curve: t.curve,
    roles,
    lands: {
      count: lands,
      averageMv: plan.averageMv,
      cheapManaSources: plan.cheapManaSources,
      nonbasics: nonbasicCount,
      ...(colors.length > 1 ? { sources: mana.sources } : {}),
    },
    synergies,
    notes,
    score,
  };

  // The deck carries the colors its spells use: a picked color it ended up without drops out.
  // A Commander deck keeps its commander's colors.
  const used = commander
    ? colorPlanned.colors
    : colorPlanned.colors.filter((c) =>
        [...state.chosen.values()].some(({ cand }) => cand.facts.card.colors.includes(c)),
      );
  const deckColors = used.length > 0 ? used : [colorPlanned.main];
  const deck: Deck = {
    id: request.id ?? '',
    name: `${commander ? shortName(commander.name) : colorsLabel(deckColors)} ${archetype.label}${secondaryInfo ? ` with ${secondaryInfo.label}` : ''} ${size}`,
    size,
    color: deckColors[0]!,
    ...(deckColors.length > 1 ? { colors: deckColors } : {}),
    archetype: archetype.id,
    ...(secondaryInfo ? { secondary: secondaryInfo.id } : {}),
    ...(commander ? { commander: commander.id } : {}),
    cards,
    basics: Object.fromEntries(Object.entries(mana.basics).filter(([, q]) => (q ?? 0) > 0)),
    committed: false,
    createdAt: request.createdAt ?? '',
    configVersion: configVersion(config),
    dataVersion: index.dataVersion,
    ...(index.learnedVersion ? { learnedVersion: index.learnedVersion } : {}),
    explanation,
  };
  return { deck, explanation };
}

/** A deck's theme cards against what its archetype asks for. */
export interface StyleCount {
  /** Archetype id, or "tribal:<type>" for a tribe. */
  id: string;
  label: string;
  tribal: boolean;
  enablers: { have: number; want: number };
  payoffs: { have: number; want: number };
}

/**
 * Enablers and payoffs of the deck's primary archetype and of its secondary
 * one (a theme or a tribe), counted the way the builder counts them: spells
 * only, commander left out, against the minimums for the deck's size. Shapes
 * such as Aggro have no theme cards and give nothing.
 */
export function styleCounts(deck: Deck, index: CardIndex, config: BulkBrewConfig): StyleCount[] {
  // Merged packets record "a+b"; neither part's minimums fit 40 cards.
  const tribe = tribeOf(deck.archetype);
  const primary =
    config.archetypes.archetypes.find((a) => a.id === deck.archetype) ??
    (tribe ? tribalArchetype(tribe, config) : undefined);
  if (!primary) return [];
  const cands: { cand: Candidate; qty: number }[] = [];
  for (const dc of deck.cards) {
    const card = index.get(dc.cardId);
    if (!card || dc.cardId === deck.commander) continue;
    const facts = factsFor(index, config, card);
    if (facts.spell)
      cands.push({ cand: { facts, available: dc.qty, preferred: dc.qty }, qty: dc.qty });
  }
  const count = (
    id: string,
    label: string,
    tribal: boolean,
    isEnabler: (c: Candidate) => boolean,
    isPayoff: (c: Candidate) => boolean,
    want: { enablers: number; payoffs: number },
  ): StyleCount => {
    let e = 0;
    let p = 0;
    for (const { cand, qty } of cands) {
      if (isEnabler(cand)) e += qty;
      if (isPayoff(cand)) p += qty;
    }
    return {
      id,
      label,
      tribal,
      enablers: { have: e, want: want.enablers },
      payoffs: { have: p, want: want.payoffs },
    };
  };
  const out: StyleCount[] = [];
  const theme = themeOf(primary, config, deck.size);
  if (theme) {
    out.push(
      count(
        primary.id,
        primary.label,
        tribe !== undefined,
        theme.isEnabler,
        theme.isPayoff,
        theme.want,
      ),
    );
  }
  const sec = resolveSecondary(deck.secondary, primary, config, deck.size).theme;
  if (sec && sec.kind !== 'composition') {
    out.push(
      count(sec.id, sec.label, sec.kind === 'tribal', sec.isEnabler, sec.isPayoff, sec.want),
    );
  }
  return out;
}
