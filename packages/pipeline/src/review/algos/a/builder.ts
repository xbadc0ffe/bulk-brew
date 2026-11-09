// Prototype A' (docs/review/proto-a.md): a copy of packages/core/src/builder.ts
// (26.0.35) with an honest objective. Exported helpers the copy used unchanged
// (curveTargets, compareCandidates, colorPlan, castPenalties) come from the core.
//
// What changed, for a style the theme rules describe:
// - each card counts once, as setup (supply) or payoff (demand), by the rules;
// - one plan-health term replaces the hand rules' min(enablers, payoffs), the
//   theme-hit bonus worth 2 for dual cards, the learned plan fit, the learned
//   theme target, and the drift cap on theme cards;
// - a payoff enters in any pass only when setup already in the deck feeds it;
// - viability and best fit read the honest counts.
// Tribes, shapes, and secondary styles run as in the copy.
//
// Deterministic as the copy: every loop walks candidates in card id order.

import {
  BuildError,
  FILLER_WHY,
  ManaBaseError,
  RARITY_LABELS,
  canBeCommander,
  castPenalties,
  chooseManaBase,
  colorPlan,
  colorsLabel,
  commanderCopies,
  commanderTribes,
  compareCandidates,
  configVersion,
  countCopies,
  curveProfileFor,
  curveTargets,
  curveWhy,
  effectiveCurveProfile,
  effectiveQuotas,
  effectiveTypeMix,
  factsFor,
  forSize,
  identityWithin,
  inTribe,
  isCommanderSize,
  learnedAt,
  learnedPlanFor,
  learnedSizeKey,
  learnedTheme,
  listCandidates,
  maxCopiesFor,
  minimumsFor,
  normalizeColors,
  pipDemand,
  planLandCount,
  playableWith,
  roleOverridesFor,
  scanCandidates,
  secondaryLabel,
  sourcesNeeded,
  templateFor,
  tribeOf,
  tribeShortfall,
  type Archetype,
  type BuildExplanation,
  type BuildRequest,
  type BuilderWeightsConfig,
  type BulkBrewConfig,
  type Candidate,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type Color,
  type ColorPlan,
  type Deck,
  type DeckCard,
  type DeckScore,
  type DeckSize,
  type DeckTemplate,
  type LearnedPlan,
  type ManaBase,
  type Pool,
  type RoleQuota,
  type SpellCopies,
  type Spread,
  type TypeMix,
} from '@bulk-brew/core';
import type { ThemeRules } from '../../theme-rules.ts';
import {
  addLearned,
  comboGain,
  emptyLearnedTally,
  pairGain,
  selectionFor,
  type LearnedTally,
  type Selection,
} from './select.ts';
import {
  addJob,
  copyThemeTally,
  emptyThemeTally,
  gateOpen,
  jobOf,
  lonePayoffs,
  minimumsMet,
  planHealth,
  planSpec,
  planTerm,
  progressOf,
  shortFloors,
  shortOf,
  shortWords,
  type CardJob,
  type PlanSpec,
  type ThemeTally,
} from './theme.ts';

/** Why a copy was picked, which also decides what gets trimmed first. */
export type PickKind =
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

export interface Chosen {
  cand: Candidate;
  qty: number;
  why: string;
}

interface Pick {
  id: string;
  kind: PickKind;
}

export interface State {
  /** Spell slots: deck size minus the current land count. */
  slots: number;
  chosen: Map<string, Chosen>;
  /** One entry per chosen copy, in pick order. */
  order: Pick[];
}

/** The deck's style as the theme rules count it (A'). */
export interface Honest {
  spec: PlanSpec;
  /** Job per spell candidate id; cards with no job are absent. */
  jobs: Map<string, CardJob>;
  /** The commander's own job, there every game. */
  base: ThemeTally;
  label: string;
}

export interface Ctx {
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
  /** Theme weight per card id: the copy's primary (tribes) and secondary membership. */
  themeValue: Map<string, number>;
  /** Theme membership per card id, as THEME_* bits. */
  themeFlags: Map<string, number>;
  /** Theme minimums the swaps must not drop below: primary, then secondary. */
  themeWant: { pe: number; pp: number; se: number; sp: number };
  /** The primary style's theme cards by the current matchers (tribes, styles without rules). */
  theme: PrimaryTheme | undefined;
  /** The primary style by the theme rules; when set, `theme` is unset. */
  honest: Honest | undefined;
  /** The middle half of real decks of the plan, for roles and card types (learned). */
  profile: PlanShape | undefined;
  /** Learned card selection: plan fit, pairs, combos (see select.ts). */
  selection: Selection | undefined;
  /** Cards a search move just took out; the fill passes skip them while set. */
  exclude?: Set<string> | undefined;
}

/** Where real decks of a plan sit for each role and card type, as shares of their spells. */
interface PlanShape {
  roles: [string, Spread][];
  /** The primary theme's enablers and payoffs, so a theme does not run far past real decks either. */
  enablers?: Spread;
  payoffs?: Spread;
  creatures?: Spread;
  instSorc?: Spread;
  ncPerm?: Spread;
  /** Objective points per copy outside the middle half. */
  weight: number;
}

/** The learned shape of a plan at a size, when the builder is set to use it. */
function planShapeOf(
  a: Archetype,
  config: BulkBrewConfig,
  size: DeckSize,
  honest: boolean,
): PlanShape | undefined {
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
  // A': the theme caps count with the current matchers, so an honest style drops them.
  const enablers = honest ? undefined : at('theme enablers');
  const payoffs = honest ? undefined : at('theme payoffs');
  if (enablers) out.enablers = enablers;
  if (payoffs) out.payoffs = payoffs;
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

export interface Tally {
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
  /** Copies of primary and secondary theme enablers and payoffs (current matchers). */
  pe: number;
  pp: number;
  se: number;
  sp: number;
  /** A': setup supply and payoff demand by the theme rules, the commander included. */
  th: ThemeTally;
  /** Learned fit, pairs, and combos of the chosen cards (see select.ts). */
  learned?: LearnedTally;
}

function bump(map: Map<string, number>, key: string, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function emptyTally(ctx: Ctx): Tally {
  const sel = ctx.selection;
  return {
    ...(sel ? { learned: emptyLearnedTally(sel) } : {}),
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
    th: ctx.honest ? copyThemeTally(ctx.honest.base) : emptyThemeTally(),
  };
}

/** The card's job under the deck's honest style, if any. */
export function jobFor(ctx: Ctx, id: string): CardJob | undefined {
  return ctx.honest?.jobs.get(id);
}

export function addToTally(
  t: Tally,
  f: CardFacts,
  qty: number,
  theme: number,
  pen: number,
  flags: number,
  job: CardJob | undefined,
  sel?: Selection,
): void {
  if (sel && t.learned) addLearned(sel, t.learned, f.card.id, qty);
  t.total += qty;
  if (flags & THEME_PE) t.pe += qty;
  if (flags & THEME_PP) t.pp += qty;
  if (flags & THEME_SE) t.se += qty;
  if (flags & THEME_SP) t.sp += qty;
  addJob(t.th, job, qty);
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

/** Add or take out copies of a candidate, with everything the context knows about it. */
export function addCand(t: Tally, ctx: Ctx, cand: Candidate, qty: number, learned = false): void {
  const id = cand.facts.card.id;
  addToTally(
    t,
    cand.facts,
    qty,
    ctx.themeValue.get(id) ?? 0,
    ctx.penalty.get(id) ?? 0,
    ctx.themeFlags.get(id) ?? 0,
    jobFor(ctx, id),
    learned ? ctx.selection : undefined,
  );
}

export function tally(state: State, ctx: Ctx): Tally {
  const t = emptyTally(ctx);
  // Card id order, so the pair and combo sums come out the same every time.
  const chosen = [...state.chosen.values()].sort((a, b) =>
    a.cand.facts.card.id < b.cand.facts.card.id ? -1 : 1,
  );
  for (const { cand, qty } of chosen) addCand(t, ctx, cand, qty, true);
  return t;
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

/**
 * The objective in three tiers, highest first: the plan, the deck's shape
 * (curve, type mix, roles), and card value (strength, learned terms, drift).
 * a-objective adds them up as the copy did; a-search compares them in order.
 */
export interface Tiers {
  plan: number;
  shape: number;
  value: number;
}

export function tiersOf(t: Tally, slots: number, ctx: Ctx): Tiers {
  const w = ctx.weights.objective;
  let shape = 0;
  const targets = curveTargets(ctx.curveShape, slots);
  for (let b = 1; b <= 7; b++) {
    const have = t.curve[b]! + (b === 1 ? t.curve[0]! : 0);
    shape -=
      w.curveDeviation * Math.max(0, Math.abs(have - targets[b]!) - ctx.template.tolerances.curve);
  }
  const tol = ctx.template.tolerances.typeMix * slots;
  const tm = ctx.typeMix;
  shape -= w.typeMixDeviation * Math.max(0, tm.creatureMin * slots - t.creatures - tol);
  shape -= w.typeMixDeviation * Math.max(0, t.creatures - tm.creatureMax * slots - tol);
  shape -= w.typeMixDeviation * Math.max(0, tm.instantSorceryMin * slots - t.instSorc - tol);
  shape -= w.typeMixDeviation * Math.max(0, t.ncPerm - tm.noncreaturePermanentMax * slots - tol);
  for (const [roleId, q] of Object.entries(ctx.quotas)) {
    const have = t.roles.get(roleId) ?? 0;
    shape -= w.roleShortfall * (2 * Math.max(0, q.min - have) + Math.max(0, q.target - have));
  }
  const sel = ctx.selection;
  let plan = 0;
  let value = 0;
  if (ctx.honest) {
    // A': one plan-health term in place of the hand rules' pairs and the theme hits.
    plan = planTerm(t.th, ctx.honest.spec);
    value += w.themeHit * t.themeHits;
  } else {
    // A': the hand rules' min(enablers, payoffs) leaves every A' objective, so best fit compares
    // shapes and themes on even terms; a tribe, which the theme rules do not cover, keeps its own pairs.
    const rules = ctx.synergyScale * (sel ? sel.ruleWeight : 1);
    const tribe = ctx.theme?.pairs ? Math.min(t.pe, t.pp) : 0;
    plan += w.synergyDensity * rules * tribe + w.themeHit * t.themeHits;
  }
  if (sel && t.learned)
    value +=
      (sel.pairWeight * t.learned.syn) / Math.max(1, slots) + t.learned.fit + t.learned.combo;
  value += w.cardStrength * (t.strength - t.castPen);
  const p = ctx.profile;
  if (p) {
    let off = 0;
    for (const [roleId, q] of p.roles) off += outside(t.roles.get(roleId) ?? 0, q, slots);
    if (p.creatures) off += outside(t.creatures, p.creatures, slots);
    if (p.instSorc) off += outside(t.instSorc, p.instSorc, slots);
    if (p.ncPerm) off += outside(t.ncPerm, p.ncPerm, slots);
    // Above the middle half only: the theme's floor is the fill's job and the swap guard's.
    if (p.enablers) off += Math.max(0, t.pe - p.enablers[2] * slots);
    if (p.payoffs) off += Math.max(0, t.pp - p.payoffs[2] * slots);
    value -= p.weight * off;
  }
  return { plan, shape, value };
}

function objectiveOf(t: Tally, slots: number, ctx: Ctx): number {
  const s = tiersOf(t, slots, ctx);
  return s.plan + s.shape + s.value;
}

function objective(state: State, ctx: Ctx): number {
  return objectiveOf(tally(state, ctx), state.slots, ctx);
}

/** What one more copy of a card adds to the learned part of the objective. */
export function learnedGain(ctx: Ctx, t: Tally, id: string, slots: number): number {
  const sel = ctx.selection;
  if (!sel || !t.learned) return 0;
  return (
    (sel.fit.get(id) ?? 0) +
    (sel.pairWeight * pairGain(sel, t.learned, id)) / Math.max(1, slots) +
    comboGain(sel, t.learned, id)
  );
}

export function remaining(state: State, cand: Candidate): number {
  return cand.available - (state.chosen.get(cand.facts.card.id)?.qty ?? 0);
}

/** A': the payoff gate against a tally that holds every other card in the deck. */
export function gateOk(ctx: Ctx, t: Tally, cand: Candidate): boolean {
  const h = ctx.honest;
  return !h || gateOpen(t.th, h.spec, h.jobs.get(cand.facts.card.id));
}

/**
 * How far a pass may bend the guidelines. Shaped passes keep the type caps and
 * the preferred copy counts; the filler passes drop the type caps, then the
 * copy guidelines, so a narrow pool still fills every slot. Hard limits
 * (pool copies, the copy limit setting) always hold.
 */
type Relax = 'none' | 'types' | 'copies' | 'all';

export function canAdd(
  state: State,
  ctx: Ctx,
  cand: Candidate,
  t: Tally,
  relax: Relax = 'none',
): boolean {
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

export function addOne(state: State, cand: Candidate, why: string, kind: PickKind): void {
  const id = cand.facts.card.id;
  const existing = state.chosen.get(id);
  if (existing) existing.qty += 1;
  else state.chosen.set(id, { cand, qty: 1, why });
  state.order.push({ id, kind });
}

/** Remove the most recently picked copy of a card. */
export function removeOne(state: State, id: string): Pick | undefined {
  const existing = state.chosen.get(id);
  if (!existing) return undefined;
  existing.qty -= 1;
  if (existing.qty <= 0) state.chosen.delete(id);
  for (let i = state.order.length - 1; i >= 0; i--) {
    if (state.order[i]!.id === id) return state.order.splice(i, 1)[0];
  }
  return undefined;
}

/**
 * The first tiebreak of every pass. The copy used theme hits (2 for a dual
 * card); A' uses what one more copy adds to plan health, which is zero once
 * the floors are met, plus the secondary style's hits.
 */
function themeHitsFn(ctx: Ctx, t: Tally): (c: Candidate) => number {
  const h = ctx.honest;
  if (!h) return (c) => ctx.themeValue.get(c.facts.card.id) ?? 0;
  const before = planTerm(t.th, h.spec);
  // Cards with the same job add the same, so a few keys cover the pool.
  const gains = new Map<string, number>();
  return (c) => {
    const id = c.facts.card.id;
    const job = h.jobs.get(id);
    let gain = 0;
    if (job) {
      const key = `${job.as}:${job.weight}:${job.repeatable ? 1 : 0}`;
      let g = gains.get(key);
      if (g === undefined) {
        const next = copyThemeTally(t.th);
        addJob(next, job, 1);
        gains.set(key, (g = planTerm(next, h.spec) - before));
      }
      gain = g;
    }
    return gain + (ctx.themeValue.get(id) ?? 0);
  };
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
  // A card's value: its strength less its cast penalty, plus with learned selection what it
  // adds to the plan (fit, pairs with the cards chosen, combos), in strength points.
  const values = new Map<string, number>();
  const sel = ctx.selection;
  const per = 1 / Math.max(1e-6, ctx.weights.objective.cardStrength);
  const valueOf = (c: Candidate) => {
    const id = c.facts.card.id;
    let v = values.get(id);
    if (v === undefined) {
      v = c.facts.strength - (ctx.penalty.get(id) ?? 0);
      if (sel) v += per * learnedGain(ctx, t, id, state.slots);
      values.set(id, v);
    }
    return v;
  };
  const hits = themeHitsFn(ctx, t);
  const exclude = ctx.exclude;
  let best: Candidate | undefined;
  for (const cand of ctx.spells) {
    if (!filter(cand) || !canAdd(state, ctx, cand, t, relax)) continue;
    // A': no payoff in any pass without setup already there to feed it.
    if (!gateOk(ctx, t, cand)) continue;
    if (exclude?.has(cand.facts.card.id)) continue;
    if (!best) {
      best = cand;
      continue;
    }
    // A card that fills a curve gap wins; then the configured tiebreaks decide.
    const d = deficit(cand) - deficit(best);
    const better =
      d > 0 || (d === 0 && compareCandidates(cand, best, ctx.weights.tiebreaks, hits, valueOf) > 0);
    if (better) best = cand;
  }
  if (!best) return false;
  addOne(state, best, typeof why === 'string' ? why : why(best), kind);
  return true;
}

function roleLabel(ctx: Ctx, roleId: string): string {
  return ctx.roleLabels.get(roleId) ?? roleId;
}

function honestWhy(h: Honest, job: CardJob): string {
  return `${h.label} ${job.as}: ${job.job}`;
}

export function describeWhy(cand: Candidate, ctx: Ctx): string {
  for (const roleId of Object.keys(ctx.quotas)) {
    if (cand.facts.roles.includes(roleId)) return roleLabel(ctx, roleId);
  }
  const h = ctx.honest;
  const job = h?.jobs.get(cand.facts.card.id);
  if (h && job) return honestWhy(h, job);
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
 * A': the honest theme to the rules' floors for the size. Setup first, since
 * the gate admits a payoff only once setup is there to feed it; when payoffs
 * are short and the gate holds them back, more setup goes in. Strong cards
 * first, then any, then bending the copy guidelines, as the copy's theme pass.
 */
function fillHonest(state: State, ctx: Ctx): void {
  const h = ctx.honest;
  if (!h) return;
  const jobOfC = (c: Candidate) => h.jobs.get(c.facts.card.id);
  const bar = ctx.config.cardStrength.themeMinStrength;
  const passes: [(c: Candidate) => boolean, Relax][] = [
    [(c) => c.facts.strength >= bar, 'none'],
    [() => true, 'none'],
    [() => true, 'copies'],
  ];
  const why = (c: Candidate) => honestWhy(h, jobOfC(c)!);
  for (const [ok, relax] of passes) {
    const pick = (test: (j: CardJob) => boolean) =>
      pickBest(
        state,
        ctx,
        (c) => {
          const j = jobOfC(c);
          return !!j && test(j) && ok(c);
        },
        why,
        'theme',
        relax,
      );
    // Weightless setup feeds nothing, so it never comes in to open the gate.
    const setup = (j: CardJob) => j.as === 'setup' && j.weight > 0;
    const repeatable = (j: CardJob) => setup(j) && j.repeatable;
    const payoff = (j: CardJob) => j.as === 'payoff';
    for (;;) {
      const short = shortFloors(tally(state, ctx).th, h.spec);
      if (short.size === 0) break;
      let picked = false;
      if (short.has('repeatable')) picked = pick(repeatable);
      if (!picked && (short.has('setup') || short.has('setupWeight'))) picked = pick(setup);
      if (!picked && (short.has('payoff') || short.has('payoffWeight'))) {
        // A payoff the gate admits, else setup so the next payoff can come in.
        picked = pick(payoff) || (payoffWaiting(state, ctx, ok, relax) && pick(setup));
      }
      if (!picked && short.has('repeatableOrPayoff')) picked = pick(payoff) || pick(repeatable);
      if (!picked) break;
    }
  }
}

/** Whether this pass could add a payoff but for the gate, so more setup would let it in. */
function payoffWaiting(
  state: State,
  ctx: Ctx,
  ok: (c: Candidate) => boolean,
  relax: Relax,
): boolean {
  const h = ctx.honest;
  if (!h) return false;
  const t = tally(state, ctx);
  for (const c of ctx.spells) {
    if (h.jobs.get(c.facts.card.id)?.as !== 'payoff' || !ok(c)) continue;
    if (canAdd(state, ctx, c, t, relax) && !gateOk(ctx, t, c)) return true;
  }
  return false;
}

/**
 * The primary theme from its minimums toward what real decks of the plan
 * play (learned), after the roles reach their targets, so the plan runs as
 * deep as a real deck's within the size's role and curve limits. Strong
 * cards first; the copy guidelines hold. A' keeps it only for tribes and
 * styles the rules do not describe.
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

export function fillAll(state: State, ctx: Ctx): void {
  fillRoles(state, ctx, 'min', 'roleMin');
  fillTheme(state, ctx);
  fillHonest(state, ctx);
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

/** A': plan health parts before a swap, so the guard can tell what a swap costs the plan. */
export interface PlanParts {
  progress: number;
  short: number;
  lone: number;
}

export function planParts(t: ThemeTally, spec: PlanSpec): PlanParts {
  return {
    progress: progressOf(t, spec).progress,
    short: shortOf(t, spec),
    lone: lonePayoffs(t, spec),
  };
}

/** A': a swap may not lower the floors met, leave payoffs unfed, or widen the shortfall. */
export function guardOk(before: PlanParts, after: PlanParts): boolean {
  return (
    after.progress >= before.progress - 1e-9 &&
    after.lone <= before.lone &&
    after.short <= before.short + 1e-9
  );
}

/**
 * A': the colors a swap may not take out, for a deck without the outgoing
 * copy: each color of a multi-color deck now below the per-color minimum
 * (`landRules.colors.minCardsPerColor`) that the pool can meet. The copy's
 * swaps did not hold that minimum; without the hand rules, cast penalties
 * alone could swap a second color away and leave its dual lands in a
 * one-color deck.
 */
export function colorsAtMinimum(state: State, ctx: Ctx): Color[] {
  if (ctx.plan.colors.length < 2) return [];
  const want = forSize(ctx.config.landRules.colors.minCardsPerColor, ctx.template.size);
  const out: Color[] = [];
  for (const color of ctx.plan.colors) {
    const has = (c: Candidate) => c.facts.card.colors.includes(color);
    if (countCopies(ctx.spells, has) < want) continue;
    let n = 0;
    for (const { cand, qty } of state.chosen.values()) if (has(cand)) n += qty;
    if (n < want) out.push(color);
  }
  return out;
}

/** Whether a swap keeps every color the deck holds at its minimum. */
export function colorsOk(held: Color[], out: Candidate, inCand: Candidate): boolean {
  for (const c of held)
    if (out.facts.card.colors.includes(c) && !inCand.facts.card.colors.includes(c)) return false;
  return true;
}

/** A search: improves the deck in place and returns the moves it made. */
export type SearchFn = (state: State, ctx: Ctx) => number;

/** The copy's swap search, with the honest guard and the gate on the swapped-in card. */
export function localSearch(state: State, ctx: Ctx): number {
  const { maxPasses, maxSwapsPerPass } = ctx.weights.localSearch;
  const h = ctx.honest;
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
      let before: PlanParts | undefined;
      let held: Color[] = [];
      let swapped = false;
      for (const cand of ctx.spells) {
        const inId = cand.facts.card.id;
        if (inId === outId || remaining(state, cand) <= 0) continue;
        if (!base) {
          outKind = removeOne(state, outId)?.kind ?? 'swap';
          base = tally(state, ctx);
          held = colorsAtMinimum(state, ctx);
          if (h) {
            const full = copyThemeTally(base.th);
            addJob(full, h.jobs.get(outId), 1);
            before = planParts(full, h.spec);
          }
        }
        if (!canAdd(state, ctx, cand, base)) continue;
        if (!gateOk(ctx, base, cand) || !colorsOk(held, outCand, cand)) continue;
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
        // Score the swap by adding the copy to the tally and taking it back out. The learned
        // part is added as the copy's gain against the tally, which is the same and much cheaper.
        addCand(base, ctx, cand, 1);
        const keep = !h || guardOk(before!, planParts(base.th, h.spec));
        const val = keep
          ? objectiveOf(base, state.slots, ctx) + learnedGain(ctx, base, inId, state.slots)
          : -Infinity;
        addCand(base, ctx, cand, -1);
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

/**
 * A': after the last trims and fills, no payoff may sit unfed. While one
 * does, the payoff copy worth least goes and the gated passes refill.
 */
function repairBalance(state: State, ctx: Ctx): number {
  const h = ctx.honest;
  if (!h) return 0;
  let dropped = 0;
  for (let i = 0; i < 40; i++) {
    const t = tally(state, ctx);
    if (lonePayoffs(t.th, h.spec) === 0) break;
    let worst: Candidate | undefined;
    let worstValue = Infinity;
    for (const id of [...state.chosen.keys()].sort()) {
      if (h.jobs.get(id)?.as !== 'payoff') continue;
      const cand = state.chosen.get(id)!.cand;
      const v = cand.facts.strength - (ctx.penalty.get(id) ?? 0);
      if (v < worstValue) {
        worst = cand;
        worstValue = v;
      }
    }
    if (!worst) break;
    removeOne(state, worst.facts.card.id);
    dropped++;
    const exclude = new Set([worst.facts.card.id]);
    ctx.exclude = exclude;
    fillAll(state, ctx);
    ctx.exclude = undefined;
  }
  return dropped;
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

/**
 * How close a deck sits to real decks of its plan, 0 to 1, as in the copy.
 * A': an honest style has no `theme`, so its theme features (counted with
 * the current matchers in the learned profiles) are left out.
 */
function planCloseness(t: Tally, ctx: Ctx): number | undefined {
  const size = ctx.template.size;
  const block = ctx.config.learned?.plans.sizes[learnedSizeKey(size)];
  if (!block) return undefined;
  const profileOf = (a: { id: string; kind: string }): LearnedPlan | undefined => {
    const p = learnedPlanFor(ctx.config, a.id, size);
    if (p && p.source === 'plan') return p;
    return a.kind === 'composition' ? block.plans['shape'] : undefined;
  };
  const plan = profileOf(ctx.archetype);
  // A shape as secondary style sets the roles, type mix, and (but at 20) the curve: measure those against its own decks.
  const shape = ctx.secondary?.shape ? profileOf(ctx.secondary.shape) : undefined;
  const spells = Math.max(1, t.total);
  const feature = (name: string): number | undefined => {
    if (name === 'theme enablers') return ctx.theme ? t.pe / spells : undefined;
    if (name === 'theme payoffs') return ctx.theme ? t.pp / spells : undefined;
    if (name.startsWith('role ')) return (t.roles.get(name.slice(5)) ?? 0) / spells;
    if (name.startsWith('curve ')) {
      const b = name === 'curve 7+' ? 7 : Number(name.slice(6));
      return (t.curve[b]! + (b === 1 ? t.curve[0]! : 0)) / spells;
    }
    if (name === 'creatures') return t.creatures / spells;
    if (name === 'instants and sorceries') return t.instSorc / spells;
    if (name === 'other permanents') return t.ncPerm / spells;
    return undefined;
  };
  let sum = 0;
  let n = 0;
  block.features.forEach((name, i) => {
    const theme = name.startsWith('theme ');
    const own = shape && !theme && !(size === 20 && name.startsWith('curve ')) ? shape : plan;
    // Without a profile, theme features have nothing to compare with, as in corpus:eval.
    const q = own ? own.q[i] : theme ? null : block.all[i];
    const x = feature(name);
    if (!q || x === undefined) return;
    const all = block.all[i];
    const spread = Math.max(q[2] - q[0], all ? 0.5 * (all[2] - all[0]) : 0.02, 0.01);
    sum += Math.min(3, Math.abs(x - q[1]) / spread);
    n++;
  });
  return n ? clamp01(1 - sum / n / 3) : undefined;
}

/** Deck score: synergy, card strength, roles, curve, type mix, and castability, each 0 to 1. */
function scoreDeck(state: State, ctx: Ctx, mana: ManaBase, lands: number): DeckScore {
  const t = tally(state, ctx);
  const cfg = ctx.weights.deckScore;
  const slots = Math.max(1, state.slots);
  const spells = Math.max(1, t.total);
  const [lo, hi] = cfg.strengthRange;
  const strength = clamp01((t.strength / spells - lo) / (hi - lo));

  const roles = roleCoverage(t, ctx, 'target');

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
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  // With learned plans, the score is how close the deck sits to real decks of its plan,
  // with card strength and castability as small parts.
  const learned = cfg.learned && learnedAt(ctx.config, ctx.template.size);
  const close = learned ? planCloseness(t, ctx) : undefined;
  if (learned && close !== undefined) {
    const lw = cfg.learned!;
    const sum = lw.closeness + lw.strength + lw.castability;
    const weighted = lw.closeness * close + lw.strength * strength + lw.castability * cast;
    return {
      total: Math.round((1000 * weighted) / sum) / 10,
      strength: r3(strength),
      roles: r3(roles),
      curve: r3(curve),
      typeMix: r3(typeMix),
      synergy: r3(synergy),
      castability: r3(cast),
      closeness: r3(close),
    };
  }
  const w = cfg.weights;
  const sumW = w.strength + w.roles + w.curve + w.typeMix + w.synergy + w.castability;
  const weighted =
    w.strength * strength +
    w.roles * roles +
    w.curve * curve +
    w.typeMix * typeMix +
    w.synergy * synergy +
    w.castability * cast;
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

/** Mean share of each role's minimum or target the deck covers, 0 to 1. */
function roleCoverage(t: Tally, ctx: Ctx, level: 'min' | 'target'): number {
  let sum = 0;
  let count = 0;
  for (const [roleId, q] of Object.entries(ctx.quotas)) {
    if (q[level] <= 0) continue;
    sum += Math.min(1, (t.roles.get(roleId) ?? 0) / q[level]);
    count++;
  }
  return count > 0 ? sum / count : 1;
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
  /** A': plan health on one scale for every style, at most 1. */
  health: number;
}

/** A' options: the rules and the search, which a-objective and a-search set apart. */
export interface AOptions {
  rules: ThemeRules;
  search: SearchFn;
}

/** The honest view of a style at a size, or undefined when the rules do not describe it. */
function honestFor(
  archetype: Archetype,
  rules: ThemeRules,
  size: DeckSize,
  spells: Candidate[],
  commander: CardRecord | undefined,
): Honest | undefined {
  if (archetype.kind !== 'synergy' || tribeOf(archetype.id)) return undefined;
  const style = rules.styles.get(archetype.id);
  if (!style) return undefined;
  const spec = planSpec(style, size);
  const jobs = new Map<string, CardJob>();
  for (const c of spells) {
    const job = jobOf(c.facts.card, style, size);
    if (job) jobs.set(c.facts.card.id, job);
  }
  const base = emptyThemeTally();
  if (commander) addJob(base, jobOf(commander, style, size), 1);
  return { spec, jobs, base, label: archetype.label };
}

/**
 * A': plan health of a finished deck, at most 1: the honest one for a style
 * the rules describe, the current matchers' minimums for a tribe or another
 * theme, and 1 for a shape; never above the deck's cover of role minimums.
 */
function healthOf(state: State, ctx: Ctx): number {
  const t = tally(state, ctx);
  let plan = 1;
  if (ctx.honest) plan = planHealth(t.th, ctx.honest.spec);
  else if (ctx.theme) {
    const w = ctx.theme.want;
    plan = Math.min(
      1,
      w.enablers > 0 ? t.pe / w.enablers : 1,
      w.payoffs > 0 ? t.pp / w.payoffs : 1,
    );
  }
  return Math.min(plan, roleCoverage(t, ctx, 'min'));
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
  opts: AOptions,
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
  const honest = honestFor(archetype, opts.rules, size, spells, commander);
  // A': a style the rules describe is counted by them alone; its matchers drop out.
  const theme = honest ? undefined : themeOf(archetype, config, size);
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
    honest,
    profile: planShapeOf(archetype, config, size, !!honest),
    selection: learnedAt(config, size)
      ? selectionFor(
          config,
          index,
          spells,
          // A': the learned plan fit rates the current matchers' tags, so an honest style goes without it.
          archetype.kind === 'synergy' && !honest ? archetype.id : undefined,
          size,
          commander,
        )
      : undefined,
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
  const swaps = opts.search(state, ctx);
  if (swaps > 0) {
    notes.push(`Improved by ${swaps} swap${swaps === 1 ? '' : 's'} after the first pass.`);
  }
  let repaired = repairBalance(state, ctx);
  lands = refitLands(state, ctx, lands, deckSize);
  repaired += repairBalance(state, ctx);
  if (repaired > 0)
    notes.push(`Dropped ${repaired} payoff${repaired === 1 ? '' : 's'} with no setup to feed it.`);
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
  const choose = (from: Candidate[]): ManaBase => {
    try {
      return chooseManaBase(lands, from, plan, spellCopies(state), config, settings, size, index);
    } catch (err) {
      if (err instanceof ManaBaseError) throw new BuildError(err.message);
      throw err;
    }
  };
  let mana = choose(cands);
  // A': the gate covers the mana base too. Its nonbasic lands come after the spells, so when
  // they bring a payoff the deck's setup cannot feed (threshold lands, for one), choose again
  // without payoff lands.
  const h = ctx.honest;
  if (h) {
    const landJob = (c: Candidate) => jobOf(c.facts.card, h.spec.rules, size);
    const withLands = copyThemeTally(tally(state, ctx).th);
    for (const pick of mana.nonbasics) addJob(withLands, landJob(pick.candidate), pick.qty);
    if (lonePayoffs(withLands, h.spec) > 0) {
      const isPayoffLand = (c: Candidate) =>
        c.facts.land && !c.facts.spell && landJob(c)?.as === 'payoff';
      mana = choose(cands.filter((c) => !isPayoffLand(c)));
      notes.push('Left out payoff lands with no setup to feed them.');
    }
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
    health: healthOf(state, ctx),
  };
}

/** A' pool count of a style by the rules, the commander included. */
function poolTally(h: Honest, cands: Candidate[]): ThemeTally {
  const t = copyThemeTally(h.base);
  for (const c of cands) if (c.facts.spell) addJob(t, h.jobs.get(c.facts.card.id), c.available);
  return t;
}

interface HonestScan {
  viable: boolean;
  /** "needs 2 more setup weight", when not viable. */
  why: string;
  /** The pool's payoff copies, for the commander's pull. */
  payoffs: number;
}

/**
 * A': whether the pool, in the deck's colors, holds the rules' floors for the
 * size, each card counted once. The scan's spell count and the style's color
 * limit still apply.
 */
function honestScan(
  a: Archetype,
  rules: ThemeRules,
  size: DeckSize,
  cands: Candidate[],
  commander: CardRecord | undefined,
  possible: boolean,
  colors: readonly Color[],
): HonestScan | undefined {
  const spells = cands.filter((c) => c.facts.spell);
  const h = honestFor(a, rules, size, spells, commander);
  if (!h) return undefined;
  const t = poolTally(h, cands);
  const check = minimumsMet(t, h.spec);
  const reasons: string[] = [];
  if (!possible) reasons.push('not enough spells');
  if (a.kind === 'synergy' && a.colors && !colors.some((c) => a.colors!.includes(c)))
    reasons.push(`${a.label} does not work in this color`);
  if (check && !check.met) reasons.push(shortWords(check));
  return { viable: reasons.length === 0, why: reasons.join('; '), payoffs: t.pN };
}

/** "Anafenza, Kin-Tree Spirit" becomes "Anafenza"; the front face of a two-faced name. */
function shortName(name: string): string {
  return (name.split(' // ')[0] ?? name).split(',')[0]!.trim();
}

/** What A' adds to the explanation. */
export interface AExplanation {
  rules: string;
  /** The built style's honest counts, when the rules describe it. */
  honest?: {
    style: string;
    ratio: number;
    setupWeight: number;
    setupUnits: number;
    repeatable: number;
    payoffWeight: number;
    payoffUnits: number;
    payoffCopies: number;
    short: number;
    lonePayoffs: number;
    minimumsMet: boolean | null;
  };
  health: number;
  /** Every style built for best fit, with its health and deck score. */
  tried: { style: string; health: number; score: number }[];
}

export interface AResult {
  deck: Deck;
  explanation: BuildExplanation & { a: AExplanation };
}

/**
 * Build one deck. A requested style is built or declined with a BuildError,
 * never replaced by another (A' declines whatever requireStyle says).
 */
export function buildDeckA(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  opts: AOptions,
): AResult {
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
  const scanOf = (a: Archetype) =>
    honestScan(a, opts.rules, size, cands, commander, scan.possible, colors);
  let tryList: Archetype[] = [];
  let styleBuilt = false;
  if (request.style) {
    const report = scan.archetypes.find((r) => r.archetype === request.style);
    const tribe = tribes.find((t) => t.archetype.id === request.style);
    const a = byId.get(request.style) ?? tribe?.archetype;
    const honest = a ? scanOf(a) : undefined;
    const viable = honest ? honest.viable : tribe ? tribe.viable : report?.viable;
    if (viable && a) {
      tryList = [a];
      styleBuilt = true;
    } else {
      const why = honest
        ? `${honest.why} (counted once by the theme rules)`
        : tribe
          ? tribeShortfall(tribe, config, size)
          : (report?.notes.join('; ') ??
            (tribeOf(request.style)
              ? commander
                ? `${shortName(commander.name)} does not reward the ${tribeOf(request.style)} tribe`
                : 'a tribe leads only a Commander deck whose commander names it'
              : 'unknown archetype'));
      // A': a requested style is built or declined, never swapped for the best fit.
      throw new BuildError(
        `Not enough cards to build ${a?.label ?? secondaryLabel(config, request.style)}${commander ? ` under ${shortName(commander.name)}` : ''}${why ? `: ${why}` : ''}.`,
      );
    }
  }
  const payoffsInPool = new Map<string, number>();
  if (tryList.length === 0) {
    // A': every style the honest scan calls viable, plus every viable shape.
    const themes: Archetype[] = [];
    for (const a of config.archetypes.archetypes) {
      if (a.kind !== 'synergy') continue;
      const honest = scanOf(a);
      if (honest) {
        if (honest.viable) {
          themes.push(a);
          payoffsInPool.set(a.id, honest.payoffs);
        }
      } else if (scan.archetypes.find((r) => r.archetype === a.id)?.viable) themes.push(a);
    }
    const shapes = config.archetypes.archetypes.filter(
      (a) => a.kind === 'composition' && scan.archetypes.find((r) => r.archetype === a.id)?.viable,
    );
    tryList = [...tribes.filter((t) => t.viable).map((t) => t.archetype), ...themes, ...shapes];
  }
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
    ? honestPull(tryList, commander, cands, config, size, opts.rules, payoffsInPool)
    : new Map<string, number>();
  // A': plan health first; the copy's deck score (plus the commander's pull) breaks ties.
  const rankOf = (at: Attempt) =>
    at.score.total + (pull.get(at.archetype.id) ?? 0) * config.builderWeights.commander.styleBonus;
  const better = (a: Attempt, b: Attempt) =>
    a.health > b.health + 1e-9 || (Math.abs(a.health - b.health) <= 1e-9 && rankOf(a) > rankOf(b));

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
        opts,
      );
      if (resolved.note) at.notes.unshift(resolved.note);
      tried.push(at);
      if (!best || better(at, best)) best = at;
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      firstError ??= err;
    }
  }
  if (!best) throw firstError;
  if (tried.length > 1) {
    const rest = tried
      .filter((at) => at !== best)
      .sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    const shown = rest.slice(0, 3).map((at) => at.archetype.label);
    if (rest.length > 3) shown.push(`${rest.length - 3} more`);
    notes.push(
      `Compared ${tried.length} archetypes and kept ${best.archetype.label}, the healthiest plan. Next: ${shown.join(', ')}.`,
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

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const h = ctx.honest;
  const a: AExplanation = {
    rules: opts.rules.version,
    ...(h
      ? {
          honest: {
            style: h.spec.style,
            ratio: r2(h.spec.ratio),
            setupWeight: r2(t.th.sW),
            setupUnits: r2(t.th.sU),
            repeatable: t.th.rep,
            payoffWeight: r2(t.th.pW),
            payoffUnits: r2(t.th.pU),
            payoffCopies: t.th.pN,
            short: r2(shortOf(t.th, h.spec)),
            lonePayoffs: lonePayoffs(t.th, h.spec),
            minimumsMet: minimumsMet(t.th, h.spec)?.met ?? null,
          },
        }
      : {}),
    health: r2(best.health),
    tried: tried.map((at) => ({
      style: at.archetype.id,
      health: r2(at.health),
      score: at.score.total,
    })),
  };

  const explanation: BuildExplanation & { a: AExplanation } = {
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
    a,
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

/**
 * The commander's pull on each style to try, as the copy's commanderPull, but
 * by the rules: the styles its text pays off (or a tribe it names) lead, else
 * the styles it sets up; the one with the fewest payoffs in the pool gets all
 * of it, one with n times as many gets 1/n².
 */
function honestPull(
  tryList: readonly Archetype[],
  commander: CardRecord,
  cands: Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
  rules: ThemeRules,
  payoffsInPool: Map<string, number>,
): Map<string, number> {
  const jobAs = (a: Archetype) => {
    const style = a.kind === 'synergy' && !tribeOf(a.id) ? rules.styles.get(a.id) : undefined;
    return style ? jobOf(commander, style, size)?.as : undefined;
  };
  const leads = tryList.filter((a) => tribeOf(a.id) !== undefined || jobAs(a) === 'payoff');
  const pulled = leads.length > 0 ? leads : tryList.filter((a) => jobAs(a) === 'setup');
  const payoffs = new Map<string, number>();
  for (const a of pulled) {
    const theme = themeOf(a, config, size);
    const n = payoffsInPool.get(a.id) ?? (theme ? countCopies(cands, theme.isPayoff) : 0);
    payoffs.set(a.id, Math.max(1, n));
  }
  const out = new Map<string, number>();
  if (payoffs.size === 0) return out;
  const fewest = Math.min(...payoffs.values());
  for (const [id, n] of payoffs) out.set(id, (fewest / n) ** 2);
  return out;
}
