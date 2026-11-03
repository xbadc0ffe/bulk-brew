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
import { listCandidates, maxCopiesFor, type Candidate } from './candidates.ts';
import { chooseManaBase, ManaBaseError, planLandCount, type SpellCopies } from './lands.ts';
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
}

function bump(map: Map<string, number>, key: string, by: number): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function tally(state: State, ctx: Ctx): Tally {
  const t: Tally = {
    total: 0,
    curve: [0, 0, 0, 0, 0, 0, 0, 0],
    creatures: 0,
    instSorc: 0,
    ncPerm: 0,
    roles: new Map(),
    ruleEnablers: new Map(),
    rulePayoffs: new Map(),
    themeHits: 0,
  };
  const themeId = ctx.archetype.kind === 'synergy' ? ctx.archetype.id : undefined;
  for (const { cand, qty } of state.chosen.values()) {
    const f = cand.facts;
    t.total += qty;
    t.curve[f.bucket]! += qty;
    if (f.creature) t.creatures += qty;
    if (f.instantOrSorcery) t.instSorc += qty;
    if (f.noncreaturePermanent) t.ncPerm += qty;
    for (const r of f.roles) bump(t.roles, r, qty);
    for (const r of f.ruleEnabler) bump(t.ruleEnablers, r, qty);
    for (const r of f.rulePayoff) bump(t.rulePayoffs, r, qty);
    if (themeId && (f.enablerOf.includes(themeId) || f.payoffOf.includes(themeId))) {
      t.themeHits += qty;
    }
  }
  return t;
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
  const t = tally(state, ctx);
  const w = ctx.weights.objective;
  const slots = state.slots;
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
  return s;
}

function remaining(state: State, cand: Candidate): number {
  return cand.available - (state.chosen.get(cand.facts.card.id)?.qty ?? 0);
}

/**
 * Type caps apply during the shaped passes. The final filler pass ignores
 * them so a creature-only pool still fills every slot; the objective keeps
 * penalizing the type mix so swaps can repair it when the pool allows.
 */
function canAdd(state: State, ctx: Ctx, cand: Candidate, t: Tally, ignoreCaps = false): boolean {
  if (remaining(state, cand) <= 0) return false;
  if (t.total >= state.slots) return false;
  if (ignoreCaps) return true;
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
  ignoreCaps = false,
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
    if (!filter(cand) || !canAdd(state, ctx, cand, t, ignoreCaps)) continue;
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
  const isEnabler = (c: Candidate) => c.facts.enablerOf.includes(a.id);
  const isPayoff = (c: Candidate) => c.facts.payoffOf.includes(a.id);
  while (
    count(isPayoff) < want.payoffs &&
    pickBest(state, ctx, isPayoff, `${a.label} payoff`, 'theme')
  );
  while (
    count(isEnabler) < want.enablers &&
    pickBest(state, ctx, isEnabler, `${a.label} enabler`, 'theme')
  );
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
  while (tally(state, ctx).total < state.slots) {
    if (
      !pickBest(
        state,
        ctx,
        () => true,
        (c) => describeWhy(c, ctx),
        'filler',
        true,
      )
    )
      break;
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
      for (const cand of ctx.spells) {
        const inId = cand.facts.card.id;
        if (inId === outId || remaining(state, cand) <= 0) continue;
        const removed = removeOne(state, outId);
        const outKind = removed?.kind ?? 'swap';
        if (!canAdd(state, ctx, cand, tally(state, ctx))) {
          addOne(state, outCand, outWhy, outKind);
          continue;
        }
        addOne(state, cand, describeWhy(cand, ctx), 'swap');
        const val = objective(state, ctx);
        if (val > best + 1e-9) {
          best = val;
          swaps++;
          accepted++;
          improved = true;
          break;
        }
        removeOne(state, inId);
        addOne(state, outCand, outWhy, outKind);
      }
    }
    if (!improved) break;
  }
  return accepted;
}

/** Choose the archetype: the requested style when viable, else the best the scan found. */
export function chooseArchetype(
  scan: ScanReport,
  config: BulkBrewConfig,
  style: string | undefined,
  notes: string[],
): Archetype {
  const byId = new Map(config.archetypes.archetypes.map((a) => [a.id, a]));
  if (style) {
    const report = scan.archetypes.find((r) => r.archetype === style);
    const a = byId.get(style);
    if (report?.viable && a) return a;
    const why = report?.notes.join('; ') ?? 'unknown style';
    notes.push(
      `Style "${a?.label ?? style}" is not viable here (${why}); picked the best fit instead.`,
    );
  }
  const synergy = scan.archetypes
    .filter((r) => r.kind === 'synergy' && r.viable)
    .sort((a, b) => b.margin - a.margin || (a.archetype < b.archetype ? -1 : 1));
  if (synergy[0]) return byId.get(synergy[0].archetype)!;
  const composition = scan.archetypes
    .filter((r) => r.kind === 'composition' && r.viable)
    .sort(
      (a, b) =>
        b.margin - a.margin ||
        (a.archetype === 'midrange' ? -1 : b.archetype === 'midrange' ? 1 : 0) ||
        (a.archetype < b.archetype ? -1 : 1),
    );
  if (composition[0]) return byId.get(composition[0].archetype)!;
  const fallback =
    byId.get('midrange') ?? config.archetypes.archetypes.find((a) => a.kind === 'composition')!;
  notes.push(`No archetype fits this bulk list well; built a ${fallback.label} deck anyway.`);
  return fallback;
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
  const archetype = chooseArchetype(scan, config, request.style, notes);
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

  let mana;
  try {
    mana = chooseManaBase(lands, cands, color, config, settings, size, index);
  } catch (err) {
    if (err instanceof ManaBaseError) throw new BuildError(err.message);
    throw err;
  }
  notes.push(...mana.notes);

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
    dataVersion: index.version,
    explanation,
  };
  return { deck, explanation };
}
