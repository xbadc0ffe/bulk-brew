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
  templateFor,
  type Archetype,
  type BuilderWeightsConfig,
  type BulkBrewConfig,
  type DeckTemplate,
  type RoleQuota,
  type SynergyArchetype,
  type TypeMix,
} from './config.ts';
import { listCandidates, maxCopiesFor, type Candidate, type CardFacts } from './candidates.ts';
import {
  chooseManaBase,
  ManaBaseError,
  planLandCount,
  type ManaBase,
  type SpellCopies,
} from './lands.ts';
import type { CardIndex } from './pack.ts';
import {
  countCopies,
  effectiveCurveProfile,
  effectiveQuotas,
  effectiveTypeMix,
  scanCandidates,
} from './scan.ts';
import {
  COLOR_LABELS,
  type BuildExplanation,
  type BuildRequest,
  type BuildResult,
  type Deck,
  type DeckScore,
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
type PickKind = 'roleMin' | 'theme' | 'roleTarget' | 'typeMin' | 'curve' | 'filler' | 'swap';

/** Trim order: filler goes first; role minimums go only as a last resort. */
const TRIM_ORDER: PickKind[] = [
  'filler',
  'curve',
  'typeMin',
  'swap',
  'roleTarget',
  'theme',
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
  };
}

function themeIdOf(ctx: Ctx): string | undefined {
  return ctx.archetype.kind === 'synergy' ? ctx.archetype.id : undefined;
}

function addToTally(t: Tally, f: CardFacts, qty: number, themeId: string | undefined): void {
  t.total += qty;
  t.curve[f.bucket]! += qty;
  if (f.creature) t.creatures += qty;
  if (f.instantOrSorcery) t.instSorc += qty;
  if (f.noncreaturePermanent) t.ncPerm += qty;
  t.strength += f.strength * qty;
  for (const r of f.roles) bump(t.roles, r, qty);
  for (const r of f.ruleEnabler) bump(t.ruleEnablers, r, qty);
  for (const r of f.rulePayoff) bump(t.rulePayoffs, r, qty);
  if (themeId && (f.enablerOf.includes(themeId) || f.payoffOf.includes(themeId))) {
    t.themeHits += qty;
  }
}

function tally(state: State, ctx: Ctx): Tally {
  const t = emptyTally();
  const themeId = themeIdOf(ctx);
  for (const { cand, qty } of state.chosen.values()) addToTally(t, cand.facts, qty, themeId);
  return t;
}

/** A copy of a tally with one more copy of a card. */
function tallyWith(t: Tally, f: CardFacts, themeId: string | undefined): Tally {
  const n: Tally = {
    ...t,
    curve: t.curve.slice(),
    roles: new Map(t.roles),
    ruleEnablers: new Map(t.ruleEnablers),
    rulePayoffs: new Map(t.rulePayoffs),
  };
  addToTally(n, f, 1, themeId);
  return n;
}

/** Curve targets per bucket 1 through 7 for a slot count, rounded so they sum to the slots. */
export function curveTargets(shape: number[], slots: number): number[] {
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
  for (const rule of ctx.config.synergyRules.rules) {
    const e = t.ruleEnablers.get(rule.id) ?? 0;
    const p = t.rulePayoffs.get(rule.id) ?? 0;
    s += w.synergyDensity * ctx.synergyScale * rule.weight * Math.min(e, p);
  }
  s += w.themeHit * t.themeHits;
  s += w.cardStrength * t.strength;
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
type Relax = 'none' | 'types' | 'all';

function canAdd(state: State, ctx: Ctx, cand: Candidate, t: Tally, relax: Relax = 'none'): boolean {
  if (remaining(state, cand) <= 0) return false;
  if (t.total >= state.slots) return false;
  if (relax !== 'all' && (state.chosen.get(cand.facts.card.id)?.qty ?? 0) >= cand.preferred)
    return false;
  if (relax !== 'none') return true;
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
  if (ctx.archetype.kind !== 'synergy') return 0;
  const id = ctx.archetype.id;
  return (cand.facts.enablerOf.includes(id) ? 1 : 0) + (cand.facts.payoffOf.includes(id) ? 1 : 0);
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
): number {
  for (const key of tiebreaks) {
    let d = 0;
    switch (key) {
      case 'themeTagHits':
        d = themeHits(a) - themeHits(b);
        break;
      case 'strength':
        d = a.facts.strength - b.facts.strength;
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
        compareCandidates(cand, best, ctx.weights.tiebreaks, (c) => themeHitsOf(c, ctx)) > 0);
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
  if (ctx.archetype.kind === 'synergy') {
    if (cand.facts.payoffOf.includes(ctx.archetype.id)) return `${ctx.archetype.label} payoff`;
    if (cand.facts.enablerOf.includes(ctx.archetype.id)) return `${ctx.archetype.label} enabler`;
  }
  return FILLER_WHY;
}

/** Roles fill in the template's key order, so removal comes before filler-ish roles. */
function fillRoles(state: State, ctx: Ctx, level: 'min' | 'target', kind: PickKind): void {
  for (const roleId of Object.keys(ctx.quotas)) {
    const want = ctx.quotas[roleId]![level];
    for (;;) {
      const have = tally(state, ctx).roles.get(roleId) ?? 0;
      if (have >= want) break;
      const ok = pickBest(
        state,
        ctx,
        (c) => c.facts.roles.includes(roleId),
        roleLabel(ctx, roleId),
        kind,
      );
      if (!ok) break;
    }
  }
}

function fillTheme(state: State, ctx: Ctx): void {
  if (ctx.archetype.kind !== 'synergy') return;
  const a: SynergyArchetype = ctx.archetype;
  const key = String(ctx.template.size) as '60' | '40' | '20';
  const want = a.minimums[key];
  const count = (pick: (c: Candidate) => boolean) => {
    let n = 0;
    for (const { cand, qty } of state.chosen.values()) if (pick(cand)) n += qty;
    return n;
  };
  // Theme cards strong enough to play on their own go first; weaker ones only fill what is left.
  const bar = ctx.config.cardStrength.themeMinStrength;
  const strong = (c: Candidate) => c.facts.strength >= bar;
  const isEnabler = (c: Candidate) => c.facts.enablerOf.includes(a.id);
  const isPayoff = (c: Candidate) => c.facts.payoffOf.includes(a.id);
  for (const pick of [(c: Candidate) => isPayoff(c) && strong(c), isPayoff]) {
    while (
      count(isPayoff) < want.payoffs &&
      pickBest(state, ctx, pick, `${a.label} payoff`, 'theme')
    );
  }
  for (const pick of [(c: Candidate) => isEnabler(c) && strong(c), isEnabler]) {
    while (
      count(isEnabler) < want.enablers &&
      pickBest(state, ctx, pick, `${a.label} enabler`, 'theme')
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

function fillAll(state: State, ctx: Ctx): void {
  fillRoles(state, ctx, 'min', 'roleMin');
  fillTheme(state, ctx);
  fillRoles(state, ctx, 'target', 'roleTarget');
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
  const themeId = themeIdOf(ctx);
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
        const val = objectiveOf(tallyWith(base, cand.facts, themeId), state.slots, ctx);
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

/** Deck score: card strength, role coverage, curve, type mix, and synergy, each 0 to 1. */
function scoreDeck(state: State, ctx: Ctx): DeckScore {
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

  let pairs = 0;
  for (const rule of ctx.config.synergyRules.rules) {
    const e = t.ruleEnablers.get(rule.id) ?? 0;
    const p = t.rulePayoffs.get(rule.id) ?? 0;
    pairs += rule.weight * Math.min(e, p);
  }
  const synergy = clamp01(pairs / spells / cfg.synergyReference);

  const w = cfg.weights;
  const sumW = w.strength + w.roles + w.curve + w.typeMix + w.synergy;
  const weighted =
    w.strength * strength +
    w.roles * roles +
    w.curve * curve +
    w.typeMix * typeMix +
    w.synergy * synergy;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    total: Math.round((1000 * weighted) / sumW) / 10,
    strength: r3(strength),
    roles: r3(roles),
    curve: r3(curve),
    typeMix: r3(typeMix),
    synergy: r3(synergy),
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
): Attempt {
  const { size, color, settings } = request;
  const ctx: Ctx = {
    config,
    template,
    archetype,
    quotas: effectiveQuotas(template, archetype),
    typeMix: effectiveTypeMix(template, archetype),
    curveShape: curveProfileFor(config, effectiveCurveProfile(template, archetype)).shape,
    weights: config.builderWeights,
    synergyScale: archetype.kind === 'synergy' ? archetype.synergyWeight : 1,
    roleLabels: new Map(config.roles.roles.map((r) => [r.id, r.label])),
    spells: cands.filter((c) => c.facts.spell),
  };
  const notes: string[] = [];

  let lands = template.baseLands;
  const state: State = { slots: size - lands, chosen: new Map(), order: [] };
  fillAll(state, ctx);
  lands = refitLands(state, ctx, lands, size);

  const swaps = localSearch(state, ctx);
  if (swaps > 0) {
    notes.push(`Improved by ${swaps} swap${swaps === 1 ? '' : 's'} after the first pass.`);
  }
  lands = refitLands(state, ctx, lands, size);
  let plan = planLandCount(template, spellCopies(state), config.landRules.mdfc);

  // A thin pool may not fill every slot: pad with lands up to the clamp.
  if (state.order.length < state.slots) {
    const short = state.slots - state.order.length;
    if (lands + short > template.landFormula.max) {
      throw new BuildError(
        `Not enough playable ${colorLabel} cards for a ${size}-card deck: ${short} spell slots could not be filled.`,
      );
    }
    lands += short;
    state.slots = size - lands;
    plan = planLandCount(template, spellCopies(state), config.landRules.mdfc);
    notes.push(`Ran out of fitting spells; added ${short} extra land${short === 1 ? '' : 's'}.`);
  }
  let mana: ManaBase;
  try {
    mana = chooseManaBase(lands, cands, color, config, settings, size, index);
  } catch (err) {
    if (err instanceof ManaBaseError) throw new BuildError(err.message);
    throw err;
  }
  return { archetype, ctx, state, lands, plan, mana, score: scoreDeck(state, ctx), notes };
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
  const { size, color, settings } = request;
  const template = templateFor(config, size);
  const cands = listCandidates(pool, index, config, settings, color, size);
  const scan = scanCandidates(cands, config, settings, size, color);
  const colorLabel = COLOR_LABELS[color];
  if (!scan.possible) {
    throw new BuildError(
      `Not enough ${colorLabel} cards for a ${size}-card deck: ${scan.notes.join('; ')}.`,
    );
  }

  const notes: string[] = [];
  const byId = new Map(config.archetypes.archetypes.map((a) => [a.id, a]));
  let tryList: Archetype[] = [];
  if (request.style) {
    const report = scan.archetypes.find((r) => r.archetype === request.style);
    const a = byId.get(request.style);
    if (report?.viable && a) tryList = [a];
    else {
      const why = report?.notes.join('; ') ?? 'unknown style';
      notes.push(
        `Style "${a?.label ?? request.style}" is not viable here (${why}); picked the best fit instead.`,
      );
    }
  }
  if (tryList.length === 0) tryList = bestFitCandidates(scan, config);
  if (tryList.length === 0) {
    const fallback =
      byId.get('midrange') ?? config.archetypes.archetypes.find((a) => a.kind === 'composition')!;
    notes.push(`No archetype fits this bulk list well; built a ${fallback.label} deck anyway.`);
    tryList = [fallback];
  }

  // Ties keep the earlier candidate: themes come first, so a theme beats a plain shape it ties.
  let best: Attempt | undefined;
  let firstError: unknown;
  const tried: Attempt[] = [];
  for (const a of tryList) {
    try {
      const at = attempt(a, template, cands, config, request, index, colorLabel);
      tried.push(at);
      if (!best || at.score.total > best.score.total) best = at;
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      firstError ??= err;
    }
  }
  if (!best) throw firstError;
  if (tried.length > 1) {
    const others = tried
      .filter((at) => at !== best)
      .map((at) => `${at.archetype.label} ${at.score.total.toFixed(1)}`)
      .join(', ');
    notes.push(
      `Compared ${tried.length} styles and kept the strongest, ${best.archetype.label} (${best.score.total.toFixed(1)} of 100). Others: ${others}.`,
    );
  }
  const { archetype, ctx, state, lands, plan, mana, score } = best;
  notes.push(...best.notes, ...mana.notes);
  for (const { cand, qty } of [...state.chosen.values()].sort((a, b) =>
    a.cand.facts.card.name < b.cand.facts.card.name ? -1 : 1,
  )) {
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
  for (const pick of mana.nonbasics) {
    const dc: DeckCard = { cardId: pick.candidate.facts.card.id, qty: pick.qty, why: pick.why };
    if (pick.candidate.printing) dc.printing = pick.candidate.printing;
    cards.push(dc);
  }

  const total = cards.reduce((n, c) => n + c.qty, 0) + mana.basics;
  if (total !== size) throw new Error(`builder produced ${total} cards for a ${size}-card deck`);
  const limit = maxCopiesFor(settings, config, size);
  for (const dc of cards) {
    const card = index.get(dc.cardId)!;
    if (!card.identity.every((c) => c === color))
      throw new Error(`builder chose off-color ${card.name}`);
    if (dc.qty > limit) throw new Error(`builder exceeded the copy limit on ${card.name}`);
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
    curve: t.curve,
    roles,
    lands: {
      count: lands,
      averageMv: plan.averageMv,
      cheapManaSources: plan.cheapManaSources,
      nonbasics: nonbasicCount,
    },
    synergies,
    notes,
    score,
  };

  const deck: Deck = {
    id: request.id ?? '',
    name: `${colorLabel} ${archetype.label} ${size}`,
    size,
    color,
    archetype: archetype.id,
    cards,
    basics: mana.basics > 0 ? { [color]: mana.basics } : {},
    committed: false,
    createdAt: request.createdAt ?? '',
    configVersion: configVersion(config),
    dataVersion: index.dataVersion,
    explanation,
  };
  return { deck, explanation };
}
