// Prototype B, seed and grow (docs/review/proto-b.md): build the way a person
// does. Pick a plan from honest counts, seed the payoffs the pool supports,
// grow setup to what they demand, add interaction and card advantage to the
// role minimums, fill the curve slot by slot, then build the mana. The core
// gives only facts and mechanics: legality and copy limits, card strength,
// the land formula and mana base, color math, the config's templates, roles,
// and curve profiles. It never calls the core's scan, plan choice, theme
// matchers, deck score, or swap search.

import {
  BuildError,
  canBeCommander,
  colorClassOf,
  castChance,
  chooseManaBase,
  colorsLabel,
  curveProfileFor,
  curveTargets,
  isCommanderSize,
  listCandidates,
  ManaBaseError,
  normalizeColors,
  pipDemand,
  planLandCount,
  roleOverridesFor,
  templateFor,
  type Archetype,
  type BulkBrewConfig,
  type Candidate,
  type CardFacts,
  type CardIndex,
  type CardRecord,
  type Color,
  type ColorPlan,
  type DeckTemplate,
  type Pool,
  type RoleQuota,
  type Settings,
  type TypeMix,
} from '@bulk-brew/core';
import type { ThemeFloor } from '../../theme-rules.ts';
import type { BuiltDeck, ReviewRequest } from '../../version.ts';
import {
  addJob,
  emptyTally,
  tribalFloors,
  tribalJob,
  type Job,
  type Tally,
  type ThemeDefs,
} from './defs.ts';

/** Judgment constants, set from the theme guide before any pool was built. See proto-b.md. */
export const B = {
  /** A theme whose pool holds this many times its floors is comfortable; less scores less. */
  marginFull: 1.5,
  /** Richness over plain bulk counts up to this. */
  richnessCap: 2,
  /** Seed this much over the payoff floor when both halves of the pool have twice the floor. */
  richSeed: 1.25,
  /** A commander does its job every game: its theme job counts as this many copies. */
  commanderCredit: 3,
  /** A theme the commander pays off (it rewards the plan) scores this much higher in best fit. */
  commanderPlan: 1.25,
  /** Off-plan payoffs at or above this weight need their setup in the deck. */
  offPlanGateWeight: 1,
  /** A theme card whose mana value slot is already at its curve target counts this much. */
  fullSlot: 0.5,
  /**
   * Setup keeps this much extra value in the role and curve fills while the
   * deck is at its setup floor, fading to none at `setupTarget` times the
   * floor: the guide's targets sit above its minimums (Graveyard 10 to 12
   * setup weight over 8), so the engine gets depth, not just the floor.
   */
  setupPull: 0.25,
  setupTarget: 1.5,
} as const;

// Midrange first: the templates' default shape wins a tie.
const PLAIN_SHAPES = ['midrange', 'aggro', 'control'] as const;
/** Roles whose cards do something in any game, so an off-plan payoff rider does not gate them. */
const SPELL_JOBS = ['removal', 'sweeper', 'cardAdvantage', 'cheapInteraction', 'ramp'];
const EPS = 1e-9;

type Size = ReviewRequest['size'];
type SetupKey = 'setup' | 'setupWeight' | 'repeatable';
type PayoffKey = 'payoff' | 'payoffWeight' | 'repeatableOrPayoff';
const SETUP_KEYS: readonly SetupKey[] = ['setup', 'setupWeight', 'repeatable'];
const PAYOFF_KEYS: readonly PayoffKey[] = ['payoff', 'payoffWeight', 'repeatableOrPayoff'];

/** A pool card in the deck's colors, with what every step reads. */
export interface BCard {
  facts: CardFacts;
  id: string;
  /** Copies B uses: the core's preferred copies (legendary and expensive cards fewer). */
  max: number;
  /** The copy limit, used only when the deck cannot be filled otherwise. */
  avail: number;
  /** Curve slot 1 to 7; zero-drops sit in slot 1. */
  slot: number;
  /** Chance to cast it on curve in these colors (1 in one color). */
  cast: number;
  /** Strength times cast chance: quality within a slot. */
  value: number;
  /** Value over the pool's best cards of the same slot and kind: quality among its peers. */
  q: number;
  /** Job per defs style, aligned with `ThemeDefs.styles`. */
  jobs: readonly (Job | undefined)[];
}

function floorValue(t: Tally, key: SetupKey | PayoffKey): number {
  switch (key) {
    case 'setup':
      return t.setupUnits;
    case 'setupWeight':
      return t.setupWeight;
    case 'repeatable':
      return t.repeatable;
    case 'payoff':
      return t.payoffUnits;
    case 'payoffWeight':
      return t.payoffWeight;
    case 'repeatableOrPayoff':
      return t.repeatable + t.payoffUnits;
  }
}

/** Have over need on one side of a floor; Infinity when the side has no floor. */
function sideMargin(t: Tally, floor: ThemeFloor, keys: readonly (SetupKey | PayoffKey)[]): number {
  let m = Infinity;
  for (const k of keys) {
    const need = floor[k];
    if (need === undefined || need <= 0) continue;
    m = Math.min(m, floorValue(t, k) / need);
  }
  return m;
}

/** The smaller of setup and payoff margins (a missing side does not count). */
function themeMargin(
  t: Tally,
  floor: ThemeFloor,
): { setup: number; payoff: number; margin: number } {
  const setup = sideMargin(t, floor, SETUP_KEYS);
  const payoff = sideMargin(t, floor, PAYOFF_KEYS);
  const margin = Math.min(setup, payoff);
  return { setup, payoff, margin: Number.isFinite(margin) ? margin : 0 };
}

/**
 * Setup measure, payoff measure, and setup per payoff the floor implies; one
 * per one without a payoff floor. The payoff measure counts payoffs only, even
 * where the floor also takes repeatable setup, so setup never raises it.
 */
function balance(floor: ThemeFloor): { setup: SetupKey; payoff: PayoffKey; ratio: number } {
  const setup: SetupKey = floor.setupWeight !== undefined ? 'setupWeight' : 'setup';
  const payoff: PayoffKey = floor.payoffWeight !== undefined ? 'payoffWeight' : 'payoff';
  const s = floor[setup] ?? 0;
  const p = floor[payoff] ?? floor.repeatableOrPayoff ?? 0;
  return { setup, payoff, ratio: p > 0 ? s / p : 1 };
}

/** Whether the deck's setup covers its payoffs plus `extra`; a card never counts toward its own need. */
function covered(t: Tally, floor: ThemeFloor, extra: Job | undefined): boolean {
  const b = balance(floor);
  const after = { ...t };
  addJob(after, extra, 1);
  return floorValue(t, b.setup) + EPS >= b.ratio * floorValue(after, b.payoff);
}

// ---------------------------------------------------------------- the plan

export type Plan =
  | { kind: 'plain'; style: string; archetype: Archetype | undefined }
  | {
      kind: 'theme';
      style: string;
      /** Index into ThemeDefs.styles, or -1 for a tribe. */
      index: number;
      tribe?: string;
      archetype: Archetype | undefined;
      floor: ThemeFloor;
      /** The pool's own margin for this floor. */
      poolMargin: { setup: number; payoff: number; margin: number };
    };

export interface PlanScore {
  style: string;
  kind: 'plain' | 'theme';
  viable: boolean;
  /** Theme: min(margin / marginFull, 1). Plain: template fit. */
  margin: number;
  /** Theme: min(richness over plain bulk, cap); plain shapes 1. */
  richness: number;
  /** Mean quality of the plan's deck among each card's peers. */
  quality: number;
  score: number;
  note?: string;
}

// ---------------------------------------------------------------- the deck

interface Deck {
  qty: Map<string, number>;
  why: Map<string, string>;
  /** Copies added by the curve step, in order, so the land count can trim them. */
  curveCopies: string[];
  /** Copies added by the seed step, so payoffs the setup cannot cover can go again. */
  seedCopies: string[];
  spells: number;
  tallies: Tally[];
  plan: Tally;
  roles: Map<string, number>;
  /** Copies per curve slot, index 1 to 7. */
  slots: number[];
  creatures: number;
  noncreaturePermanents: number;
  instantsAndSorceries: number;
}

function cloneDeck(d: Deck): Deck {
  return {
    qty: new Map(d.qty),
    why: new Map(d.why),
    curveCopies: [...d.curveCopies],
    seedCopies: [...d.seedCopies],
    spells: d.spells,
    tallies: d.tallies.map((t) => ({ ...t })),
    plan: { ...d.plan },
    roles: new Map(d.roles),
    slots: [...d.slots],
    creatures: d.creatures,
    noncreaturePermanents: d.noncreaturePermanents,
    instantsAndSorceries: d.instantsAndSorceries,
  };
}

/** Everything a build needs about the request and the pool, computed once. */
export interface BContext {
  request: ReviewRequest;
  size: Size;
  colors: Color[];
  config: BulkBrewConfig;
  settings: Settings;
  index: CardIndex;
  defs: ThemeDefs;
  template: DeckTemplate;
  commander?: { card: CardRecord; facts: CardFacts; jobs: readonly (Job | undefined)[] };
  cards: BCard[];
  /** Every candidate, lands included, for the mana base. */
  candidates: Candidate[];
  /** Mean value of the pool's best copies per curve slot (1 to 7) and kind (0 noncreature, 1 creature). */
  levels: number[][];
  /** Spell slots before the land formula adjusts them. */
  slots0: number;
}

function planJob(ctx: BContext, plan: Plan, facts: CardFacts, jobs: readonly (Job | undefined)[]) {
  if (plan.kind !== 'theme') return undefined;
  if (plan.tribe) return tribalJob(facts.card, plan.tribe);
  return jobs[plan.index];
}

function newDeck(ctx: BContext, plan: Plan): Deck {
  const d: Deck = {
    qty: new Map(),
    why: new Map(),
    curveCopies: [],
    seedCopies: [],
    spells: 0,
    tallies: ctx.defs.styles.map(emptyTally),
    plan: emptyTally(),
    roles: new Map(),
    slots: [0, 0, 0, 0, 0, 0, 0, 0],
    creatures: 0,
    noncreaturePermanents: 0,
    instantsAndSorceries: 0,
  };
  const cmd = ctx.commander;
  if (cmd) {
    // The commander is there every game, so its job counts several times over.
    cmd.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, B.commanderCredit));
    addJob(d.plan, planJob(ctx, plan, cmd.facts, cmd.jobs), B.commanderCredit);
    for (const r of cmd.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) + 1);
  }
  return d;
}

function have(d: Deck, c: BCard): number {
  return d.qty.get(c.id) ?? 0;
}

function add(ctx: BContext, plan: Plan, d: Deck, c: BCard, why: string, copies = 1): void {
  d.qty.set(c.id, have(d, c) + copies);
  if (!d.why.has(c.id)) d.why.set(c.id, why);
  d.spells += copies;
  c.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, copies));
  addJob(d.plan, planJob(ctx, plan, c.facts, c.jobs), copies);
  for (const r of c.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) + copies);
  d.slots[c.slot]! += copies;
  if (c.facts.creature) d.creatures += copies;
  else if (c.facts.instantOrSorcery) d.instantsAndSorceries += copies;
  else if (c.facts.noncreaturePermanent) d.noncreaturePermanents += copies;
}

function remove(ctx: BContext, plan: Plan, d: Deck, c: BCard): void {
  const n = have(d, c) - 1;
  if (n < 0) return;
  if (n === 0) {
    d.qty.delete(c.id);
    d.why.delete(c.id);
  } else d.qty.set(c.id, n);
  d.spells -= 1;
  c.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, -1));
  addJob(d.plan, planJob(ctx, plan, c.facts, c.jobs), -1);
  for (const r of c.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) - 1);
  d.slots[c.slot]! -= 1;
  if (c.facts.creature) d.creatures -= 1;
  else if (c.facts.instantOrSorcery) d.instantsAndSorceries -= 1;
  else if (c.facts.noncreaturePermanent) d.noncreaturePermanents -= 1;
}

/**
 * The payoff gate. A payoff of the plan enters after the seed step only when
 * the setup already in the deck covers it. A payoff of another style at weight
 * 1 or more (it does little without its resource) needs that style's setup in
 * the deck too, unless it is setup for the plan or fills a spell role.
 */
function gateOpen(ctx: BContext, plan: Plan, d: Deck, c: BCard): boolean {
  const own = planJob(ctx, plan, c.facts, c.jobs);
  if (plan.kind === 'theme' && own?.as === 'payoff' && !covered(d.plan, plan.floor, own))
    return false;
  if (own?.as === 'setup') return true;
  if (c.facts.roles.some((r) => SPELL_JOBS.includes(r))) return true;
  for (let i = 0; i < c.jobs.length; i++) {
    const j = c.jobs[i];
    if (!j || j.as !== 'payoff' || j.weight < B.offPlanGateWeight) continue;
    if (plan.kind === 'theme' && i === plan.index) continue;
    const floor = ctx.defs.floors(ctx.defs.styles[i]!, ctx.size)?.[0];
    if (floor && !covered(d.tallies[i]!, floor, j)) return false;
  }
  return true;
}

/** Extra value for the plan's setup in the role and curve fills, fading out above the floor. */
function setupPull(ctx: BContext, plan: Plan, d: Deck, c: BCard): number {
  if (plan.kind !== 'theme') return 1;
  const job = planJob(ctx, plan, c.facts, c.jobs);
  if (job?.as !== 'setup') return 1;
  const b = balance(plan.floor);
  const floor = plan.floor[b.setup] ?? 0;
  if (floor <= 0) return 1;
  const target = floor * B.setupTarget;
  const fade = Math.min(1, Math.max(0, (target - floorValue(d.plan, b.setup)) / (target - floor)));
  return 1 + B.setupPull * Math.min(1, job.weight) * fade;
}

/** The highest score among cards passing the filter; ties by strength, then card id. */
function best(
  cards: readonly BCard[],
  ok: (c: BCard) => boolean,
  score: (c: BCard) => number,
): BCard | undefined {
  let top: BCard | undefined;
  let topScore = -Infinity;
  for (const c of cards) {
    if (!ok(c)) continue;
    const s = score(c);
    if (s <= 0) continue;
    // Cards come sorted by id, so a strict comparison keeps the lower id on a full tie.
    if (
      s > topScore + EPS ||
      (Math.abs(s - topScore) <= EPS && c.facts.strength > top!.facts.strength + EPS)
    ) {
      top = c;
      topScore = s;
    }
  }
  return top;
}

// ---------------------------------------------------------------- steps 2 and 3

/** Deficit closed by one copy, each floor's share normalised by its target. */
function gain(
  d: Tally,
  job: Job | undefined,
  targets: Partial<Record<SetupKey | PayoffKey, number>>,
): number {
  if (!job) return 0;
  const after = { ...d };
  addJob(after, job, 1);
  let g = 0;
  for (const [k, target] of Object.entries(targets) as [SetupKey | PayoffKey, number][]) {
    if (target <= 0) continue;
    const now = floorValue(d, k);
    if (now >= target) continue;
    g += (Math.min(target, floorValue(after, k)) - now) / target;
  }
  return g;
}

function sideTargets<K extends SetupKey | PayoffKey>(
  floor: ThemeFloor,
  keys: readonly K[],
  scale: number,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const k of keys) if ((floor[k] ?? 0) > 0) out[k] = floor[k]! * scale;
  return out;
}

function met(t: Tally, targets: Partial<Record<SetupKey | PayoffKey, number>>): boolean {
  return Object.entries(targets).every(([k, v]) => floorValue(t, k as SetupKey) + EPS >= (v ?? 0));
}

export interface CoreResult {
  deck: Deck;
  ok: boolean;
  seeded: number;
  grown: number;
  trimmed: number;
  setupTargets: Partial<Record<SetupKey, number>>;
  payoffTargets: Partial<Record<PayoffKey, number>>;
  /** Mean quality among peers: the theme copies, or in best fit the whole deck. */
  quality: number;
  short?: string;
}

/**
 * Steps 2 and 3: seed the payoffs the pool supports best, then grow setup to
 * the demand they create in the ratio the floors imply, re-scoring every
 * candidate after each add (demand met, quality with cast chance, room on the curve). Payoffs the setup cannot cover go again, never
 * below the floor.
 */
export function themeCore(ctx: BContext, plan: Extract<Plan, { kind: 'theme' }>): CoreResult {
  const d = newDeck(ctx, plan);
  const jobOf = (c: BCard) => planJob(ctx, plan, c.facts, c.jobs);
  // Theme cards go where the curve has room, as a person would pick a cheap looter over a dear one.
  const targets = curveTargets(shapeFor(ctx, plan).shape, ctx.slots0);
  const room = (c: BCard) => (d.slots[c.slot]! < (targets[c.slot] ?? 0) ? 1 : B.fullSlot);
  const rich = plan.poolMargin.setup >= 2 && plan.poolMargin.payoff >= 2;
  const payoffTargets = sideTargets(plan.floor, PAYOFF_KEYS, rich ? B.richSeed : 1);
  let seeded = 0;
  for (;;) {
    if (met(d.plan, payoffTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => have(d, c) < c.max && jobOf(c)?.as === 'payoff',
      (c) => gain(d.plan, jobOf(c), payoffTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(ctx, plan, d, pick, `Payoff: ${jobOf(pick)!.job}`);
    d.seedCopies.push(pick.id);
    seeded++;
  }

  const b = balance(plan.floor);
  const payoffNeed = plan.floor[b.payoff] ?? 0;
  const scale = payoffNeed > 0 ? Math.max(1, floorValue(d.plan, b.payoff) / payoffNeed) : 1;
  const setupTargets = sideTargets(plan.floor, SETUP_KEYS, scale);
  let grown = 0;
  for (;;) {
    if (met(d.plan, setupTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => have(d, c) < c.max && jobOf(c)?.as === 'setup',
      (c) => gain(d.plan, jobOf(c), setupTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(ctx, plan, d, pick, `Setup: ${jobOf(pick)!.job}`);
    grown++;
  }

  // Setup ran out: drop the weakest seeded payoffs while above the floor and uncovered.
  let trimmed = 0;
  const floorTargets = sideTargets(plan.floor, PAYOFF_KEYS, 1);
  while (!covered(d.plan, plan.floor, undefined)) {
    const seededCards = [...new Set(d.seedCopies)]
      .map((id) => ctx.cards.find((c) => c.id === id)!)
      .sort((x, y) => x.value - y.value || (x.id < y.id ? -1 : 1));
    const drop = seededCards.find((c) => {
      const after = { ...d.plan };
      addJob(after, jobOf(c), -1);
      return met(after, floorTargets);
    });
    if (!drop) break;
    remove(ctx, plan, d, drop);
    d.seedCopies.splice(d.seedCopies.lastIndexOf(drop.id), 1);
    trimmed++;
  }

  const minimum = sideTargets(plan.floor, [...SETUP_KEYS, ...PAYOFF_KEYS], 1);
  const ok = met(d.plan, minimum);
  const out: CoreResult = {
    deck: d,
    ok,
    seeded,
    grown,
    trimmed,
    setupTargets,
    payoffTargets,
    quality: meanQuality(ctx, d),
  };
  if (!ok) out.short = shortText(d.plan, minimum);
  return out;
}

function shortText(t: Tally, need: Partial<Record<SetupKey | PayoffKey, number>>): string {
  const label: Record<SetupKey | PayoffKey, string> = {
    setup: 'setup cards',
    setupWeight: 'setup weight',
    repeatable: 'repeatable setup cards',
    payoff: 'payoff cards',
    payoffWeight: 'payoff weight',
    repeatableOrPayoff: 'repeatable setup or payoff cards',
  };
  return (Object.entries(need) as [SetupKey | PayoffKey, number][])
    .filter(([k, v]) => floorValue(t, k) + EPS < v)
    .map(([k, v]) => `${label[k]} ${round2(floorValue(t, k))} of ${v}`)
    .join(', ');
}

function mean(v: readonly number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- steps 4 and 5

interface Shape {
  quotas: Record<string, RoleQuota>;
  shape: number[];
  typeMix: TypeMix;
}

function shapeFor(ctx: BContext, plan: Plan): Shape {
  const t = ctx.template;
  const a = plan.archetype;
  const profile =
    t.size === 20 || t.size === 100 ? t.curveProfile : (a?.curveProfile ?? t.curveProfile);
  return {
    quotas: { ...t.roles, ...(roleOverridesFor(a, t.size) ?? {}) },
    shape: curveProfileFor(ctx.config, profile).shape,
    typeMix: { ...t.typeMix, ...(a?.typeMixOverrides ?? {}) },
  };
}

const ROLE_LABELS: Record<string, string> = {
  removal: 'Removal',
  sweeper: 'Sweeper',
  cardAdvantage: 'Card advantage',
  cheapInteraction: 'Cheap interaction',
  finisher: 'Big threat',
  commanderFinisher: 'Finisher',
  ramp: 'Ramp',
  earlyCreature: 'Early creature',
};

/**
 * Step 4: each role to its minimum, a card competing only with cards of the
 * same role, by value. Cards already in the deck count for every role they fill.
 */
function fillRoles(ctx: BContext, plan: Plan, d: Deck, shape: Shape, slots: number) {
  const short: Record<string, { need: number; have: number }> = {};
  for (const [role, q] of Object.entries(shape.quotas)) {
    while ((d.roles.get(role) ?? 0) < q.min && d.spells < slots) {
      const pick = best(
        ctx.cards,
        (c) => have(d, c) < c.max && c.facts.roles.includes(role) && gateOpen(ctx, plan, d, c),
        (c) => c.value * setupPull(ctx, plan, d, c),
      );
      if (!pick) break;
      add(ctx, plan, d, pick, ROLE_LABELS[role] ?? role);
    }
    const n = d.roles.get(role) ?? 0;
    if (n < q.min) short[role] = { need: q.min, have: n };
  }
  return short;
}

/**
 * Step 5: fill the slot furthest below the curve profile with the best card
 * at that mana value, keeping the type mix; when every slot is full or empty,
 * the card best among its peers. Each relaxation is a last resort for thin pools.
 */
function fillCurve(
  ctx: BContext,
  plan: Plan,
  d: Deck,
  shape: Shape,
  slots: number,
  relaxed: Set<string>,
): void {
  // Indexed by mana value slot: index 0 is the zero-drops' empty target.
  const targets = curveTargets(shape.shape, slots);
  const mix = shape.typeMix;
  const creatureMax = Math.floor(mix.creatureMax * slots);
  const permanentMax = Math.floor(mix.noncreaturePermanentMax * slots);
  const spellMin = Math.ceil(mix.instantSorceryMin * slots);
  const empty = new Set<number>();
  // 0 slot rules, 1 any slot, 2 type mix caps off, 3 copy guideline off, 4 off-plan gate off.
  let level = 0;
  const copies = (c: BCard) => (level >= 3 ? c.avail : c.max);
  while (d.spells < slots) {
    const left = slots - d.spells;
    const mustSpell = spellMin - d.instantsAndSorceries >= left;
    const wantCreature = d.creatures < mix.creatureMin * (d.spells + 1);
    const typeOk = (c: BCard) => {
      if (level >= 2) return true;
      if (mustSpell && !c.facts.instantOrSorcery) return false;
      if (c.facts.creature && d.creatures >= creatureMax) return false;
      if (c.facts.noncreaturePermanent && d.noncreaturePermanents >= permanentMax) return false;
      return true;
    };
    const base = (c: BCard) =>
      have(d, c) < copies(c) &&
      typeOk(c) &&
      (level >= 4 ? planGateOnly(ctx, plan, d, c) : gateOpen(ctx, plan, d, c));
    let slot = -1;
    let gap = 0;
    if (level === 0) {
      for (let s = 1; s <= 7; s++) {
        const g = (targets[s] ?? 0) - d.slots[s]!;
        if (g > gap && !empty.has(s)) {
          slot = s;
          gap = g;
        }
      }
      if (slot < 0) {
        level = 1;
        continue;
      }
    }
    const inSlot = (c: BCard) => slot < 0 || c.slot === slot;
    // Within a slot, strength; across slots, quality among peers, so price does not decide.
    const score = (c: BCard) => (slot >= 0 ? c.value : c.q) * setupPull(ctx, plan, d, c);
    const pick =
      (wantCreature
        ? best(ctx.cards, (c) => base(c) && inSlot(c) && c.facts.creature, score)
        : undefined) ?? best(ctx.cards, (c) => base(c) && inSlot(c), score);
    if (!pick) {
      if (slot >= 0) empty.add(slot);
      else if (level < 4) {
        const name = RELAXATIONS[++level]!;
        if (name) relaxed.add(name);
      } else break;
      continue;
    }
    add(ctx, plan, d, pick, slot >= 0 ? `Curve ${slot}` : 'Filler');
    d.curveCopies.push(pick.id);
  }
}

/** What each fill level gives up; levels 0 and 1 are the curve itself. */
const RELAXATIONS = ['', '', 'type mix', 'copy guideline', 'off-plan gate'];

function planGateOnly(ctx: BContext, plan: Plan, d: Deck, c: BCard): boolean {
  const own = planJob(ctx, plan, c.facts, c.jobs);
  return !(plan.kind === 'theme' && own?.as === 'payoff' && !covered(d.plan, plan.floor, own));
}

/** Steps 4 and 5 into a given number of spell slots. */
function fillSpells(ctx: BContext, plan: Plan, d: Deck, slots: number, relaxed: Set<string>) {
  const shape = shapeFor(ctx, plan);
  const roleShort = fillRoles(ctx, plan, d, shape, slots);
  fillCurve(ctx, plan, d, shape, slots, relaxed);
  return { shape, roleShort };
}

/** The deck's spells as the land formula and mana base read them; the commander is left out. */
function spellCopies(ctx: BContext, d: Deck): { facts: CardFacts; qty: number }[] {
  return ctx.cards.filter((c) => have(d, c) > 0).map((c) => ({ facts: c.facts, qty: have(d, c) }));
}

/**
 * The plain shape's template fit: the share of its role minimums, curve
 * targets, and creature floor that the filled deck reaches.
 */
function templateFit(ctx: BContext, d: Deck, shape: Shape, slots: number): number {
  let got = 0;
  let want = 0;
  for (const [role, q] of Object.entries(shape.quotas)) {
    got += Math.min(d.roles.get(role) ?? 0, q.min);
    want += q.min;
  }
  // A slot within the template's curve tolerance counts as on target.
  const targets = curveTargets(shape.shape, slots);
  const tol = ctx.template.tolerances.curve;
  for (let s = 1; s <= 7; s++) {
    got += Math.min(d.slots[s]! + tol, targets[s] ?? 0);
    want += targets[s] ?? 0;
  }
  const creatures = Math.ceil(shape.typeMix.creatureMin * slots);
  got += Math.min(d.creatures, creatures);
  want += creatures;
  return want > 0 ? got / want : 1;
}

/**
 * What a plan costs in card quality: each copy's quality among its peers,
 * capped at the pool's standard (1), so weak cards a plan forces in count
 * against it and skimming a few stars from a lightly used kind does not.
 */
function meanQuality(ctx: BContext, d: Deck): number {
  let total = 0;
  let n = 0;
  for (const c of ctx.cards) {
    const k = have(d, c);
    total += Math.min(1, c.q) * k;
    n += k;
  }
  return n > 0 ? total / n : 0;
}

// ---------------------------------------------------------------- context

function commanderOf(request: ReviewRequest, pool: Pool, index: CardIndex): CardRecord {
  if (!request.commander) throw new BuildError('Pick a commander for a 100-card deck.');
  const card = index.get(request.commander);
  if (!card) throw new BuildError('The picked commander is not in the card data.');
  if (!canBeCommander(card)) throw new BuildError(`${card.name} cannot be a commander.`);
  if ((pool.entries[card.id]?.qty ?? 0) < 1)
    throw new BuildError(`${card.name} is not in your bulk list.`);
  if (card.identity.length === 0)
    throw new BuildError(
      `${card.name} is colorless; its deck needs colorless mana basics cannot make.`,
    );
  return card;
}

/**
 * Cast chance on curve, given the deck made its land drops, by the core's
 * castChance. Before any card is picked, each color's sources are its share
 * of the pool's colored weight (strength times copies of spells asking for it).
 */
function castModel(
  cands: Candidate[],
  colors: Color[],
  size: Size,
  lands: number,
): (card: CardRecord) => number {
  if (colors.length < 2) return () => 1;
  const weight = new Map<Color, number>(colors.map((c) => [c, 0]));
  for (const cand of cands) {
    if (!cand.facts.spell) continue;
    const dem = pipDemand(cand.facts.card, colors);
    for (const c of colors)
      if ((dem[c] ?? 0) > 0)
        weight.set(c, weight.get(c)! + Math.max(0, cand.facts.strength) * cand.preferred);
  }
  const total = [...weight.values()].reduce((a, b) => a + b, 0) || 1;
  const sources = new Map<Color, number>(
    colors.map((c) => [c, Math.max(1, Math.round((lands * weight.get(c)!) / total))]),
  );
  const onDraw = isCommanderSize(size);
  const memo = new Map<string, number>();
  return (card) => {
    const dem = pipDemand(card, colors);
    const turn = Math.max(1, Math.min(10, Math.ceil(card.mv)));
    const seen = Math.min(size, 7 + turn - 1 + (onDraw ? 1 : 0));
    let p = 1;
    for (const c of colors) {
      const pips = dem[c] ?? 0;
      if (pips === 0) continue;
      const s = sources.get(c)!;
      const key = `${s}:${pips}:${turn}`;
      let q = memo.get(key);
      if (q === undefined) memo.set(key, (q = castChance(size, lands, s, seen, turn, pips)));
      p *= q;
    }
    return p;
  };
}

/** Load the pool's cards for the request: legality, copies, cast chance, and jobs. */
export function makeContext(
  pool: Pool,
  request: ReviewRequest,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
  defs: ThemeDefs,
): BContext {
  const size = request.size;
  const cmdCard = size === 100 ? commanderOf(request, pool, index) : undefined;
  const colors = cmdCard ? normalizeColors(cmdCard.identity) : normalizeColors(request.colors);
  if (colors.length === 0) throw new BuildError('Pick at least one color.');
  const template = templateFor(config, size);
  const candidates = listCandidates(pool, index, config, settings, colors, size);
  const cast = castModel(candidates, colors, size, template.baseLands);
  const cards: BCard[] = [];
  let cmd: BContext['commander'];
  for (const cand of candidates) {
    const f = cand.facts;
    if (cmdCard && f.card.id === cmdCard.id) {
      cmd = { card: f.card, facts: f, jobs: defs.jobs(f, size) };
      continue;
    }
    if (!f.spell) continue;
    const p = cast(f.card);
    cards.push({
      facts: f,
      id: f.card.id,
      max: cand.preferred,
      avail: cand.available,
      slot: Math.max(1, Math.min(7, f.bucket)),
      cast: p,
      value: Math.max(0, f.strength) * p,
      q: 0,
      jobs: defs.jobs(f, size),
    });
  }
  if (cmdCard && !cmd) throw new BuildError(`${cmdCard.name} cannot lead a deck from this pool.`);
  const slots0 = size - template.baseLands - (cmdCard ? 1 : 0);
  // Strength grows with mana value and cheap spells earn a cost bonus, so a
  // card is judged against its peers: the best copies of its slot and kind,
  // about a seventh of the spell slots. Plans then compare fairly across curves.
  const top = Math.max(2, Math.round(slots0 / 7));
  const groups: number[][][] = Array.from({ length: 8 }, () => [[], []]);
  for (const c of cards)
    for (let i = 0; i < c.max; i++) groups[c.slot]![c.facts.creature ? 1 : 0]!.push(c.value);
  const all = cards.flatMap((c) => Array<number>(c.max).fill(c.value)).sort((a, b) => b - a);
  const fallback = mean(all.slice(0, slots0)) || 1;
  const levels = groups.map((kinds) =>
    kinds.map((v) => mean(v.sort((a, b) => b - a).slice(0, top)) || fallback),
  );
  for (const c of cards) c.q = c.value / levels[c.slot]![c.facts.creature ? 1 : 0]!;
  return {
    request,
    size,
    colors,
    config,
    settings,
    index,
    defs,
    template,
    ...(cmd ? { commander: cmd } : {}),
    cards,
    candidates,
    levels,
    slots0,
  };
}

// ---------------------------------------------------------------- step 1

function archetypeOf(config: BulkBrewConfig, id: string): Archetype | undefined {
  return config.archetypes.archetypes.find((a) => a.id === id);
}

/** The pool's tally for a theme: every copy B may use, the commander credited. */
function poolTally(ctx: BContext, plan: Extract<Plan, { kind: 'theme' }>): Tally {
  const t = emptyTally();
  const cmd = ctx.commander;
  if (cmd) addJob(t, planJob(ctx, plan, cmd.facts, cmd.jobs), B.commanderCredit);
  for (const c of ctx.cards) addJob(t, planJob(ctx, plan, c.facts, c.jobs), c.max);
  return t;
}

/**
 * How far the pool's setup and payoff stand above what plain bulk of the same
 * cards' colors holds, the smaller of the two; 1 when no baseline was computed.
 */
function richness(ctx: BContext, plan: Extract<Plan, { kind: 'theme' }>, pool: Tally): number {
  const bulk = plan.tribe ? ctx.defs.tribeBulk?.(plan.tribe) : ctx.defs.bulk?.get(plan.style);
  if (!bulk) return 1;
  const expected = emptyTally();
  for (const c of ctx.cards) {
    const per = bulk[colorClassOf(c.facts.card)];
    expected.setupUnits += per.setupUnits * c.max;
    expected.setupWeight += per.setupWeight * c.max;
    expected.repeatable += per.repeatable * c.max;
    expected.payoffUnits += per.payoffUnits * c.max;
    expected.payoffWeight += per.payoffWeight * c.max;
  }
  const b = balance(plan.floor);
  const sides: (SetupKey | PayoffKey)[] = [b.setup];
  if (Number.isFinite(plan.poolMargin.payoff)) sides.push(b.payoff);
  let r = Infinity;
  for (const k of sides) {
    const e = floorValue(expected, k);
    r = Math.min(r, e > 0 ? floorValue(pool, k) / e : Infinity);
  }
  return Math.min(r, B.richnessCap);
}

/** A themed plan with the floor alternative the pool meets best; undefined when the defs give no floors. */
export function themePlan(
  ctx: BContext,
  style: string,
): Extract<Plan, { kind: 'theme' }> | undefined {
  const tribe = style.startsWith('tribal:') ? style.slice('tribal:'.length) : undefined;
  const index = tribe ? -1 : ctx.defs.styles.indexOf(style);
  if (!tribe && index < 0) return undefined;
  const floors = tribe
    ? tribalFloors(ctx.config, tribe, ctx.size)
    : ctx.defs.floors(style, ctx.size);
  if (!floors?.length) return undefined;
  const base = {
    kind: 'theme' as const,
    style,
    index,
    ...(tribe ? { tribe } : {}),
    archetype: archetypeOf(ctx.config, style),
  };
  let pick: Extract<Plan, { kind: 'theme' }> | undefined;
  for (const floor of floors) {
    const plan = { ...base, floor, poolMargin: { setup: 0, payoff: 0, margin: 0 } };
    plan.poolMargin = themeMargin(poolTally(ctx, plan), floor);
    if (!pick || plan.poolMargin.margin > pick.poolMargin.margin + EPS) pick = plan;
  }
  return pick;
}

function plainPlan(ctx: BContext, style: string): Plan {
  return { kind: 'plain', style, archetype: archetypeOf(ctx.config, style) };
}

/** Tribes the commander rewards, as plan ids such as "tribal:Elf". */
function commanderTribes(ctx: BContext): string[] {
  const card = ctx.commander?.card;
  if (!card) return [];
  const out: string[] = [];
  for (const tag of card.tags) {
    const m = /^typal-([a-z]+)$/.exec(tag);
    if (!m || m[1] === 'creature') continue;
    const type = m[1]![0]!.toUpperCase() + m[1]!.slice(1);
    if (ctx.cards.some((c) => c.facts.creature && tribalJob(c.facts.card, type)?.as === 'setup'))
      out.push(`tribal:${type}`);
  }
  return out.sort();
}

interface Chosen {
  plan: Plan;
  core?: CoreResult;
  scores: PlanScore[];
  reason: string;
}

/**
 * Step 1 for best fit. Each plan's deck is built without lands and scored by
 * the mean quality of its spells among their peers. A theme multiplies that by
 * min(margin / 1.5, 1) and by its richness over plain bulk (capped at 2); a
 * plain shape by its template fit. A theme must beat the best plain shape, so
 * on plain bulk it must stand out by more than the quality it costs.
 *
 * Returns the plans to try in order: the themes that beat the best plain
 * shape, best first, then the plain shapes, best first. The first is the
 * choice; the rest are the fallbacks when a plan's deck cannot be filled.
 */
export function chooseBestFit(ctx: BContext): Chosen[] {
  const scores: PlanScore[] = [];
  const plains: { plan: Plan; score: number }[] = [];
  for (const style of PLAIN_SHAPES) {
    const plan = plainPlan(ctx, style);
    const d = newDeck(ctx, plan);
    const { shape } = fillSpells(ctx, plan, d, ctx.slots0, new Set());
    const fit = templateFit(ctx, d, shape, ctx.slots0);
    const quality = meanQuality(ctx, d);
    const score = fit * quality;
    scores.push({
      style,
      kind: 'plain',
      viable: true,
      margin: round2(fit),
      richness: 1,
      quality: round2(quality),
      score: round2(score),
    });
    plains.push({ plan, score });
  }
  const themes: { plan: Plan; core: CoreResult; score: number }[] = [];
  for (const style of [...ctx.defs.styles, ...commanderTribes(ctx)]) {
    const plan = themePlan(ctx, style);
    if (!plan) continue;
    if (plan.poolMargin.margin < 1) {
      scores.push({
        style,
        kind: 'theme',
        viable: false,
        margin: round2(plan.poolMargin.margin),
        richness: 0,
        quality: 0,
        score: 0,
      });
      continue;
    }
    const core = themeCore(ctx, plan);
    if (core.ok) {
      // Quality of the whole deck the plan would build, as for the plain shapes.
      const full = cloneDeck(core.deck);
      fillSpells(ctx, plan, full, ctx.slots0, new Set());
      core.quality = meanQuality(ctx, full);
    }
    if (!core.ok) {
      scores.push({
        style,
        kind: 'theme',
        viable: false,
        margin: round2(plan.poolMargin.margin),
        richness: 0,
        quality: 0,
        score: 0,
        ...(core.short ? { note: core.short } : {}),
      });
      continue;
    }
    // With no payoff floor of its own (none, or one repeatable setup can meet)
    // there is no engine to balance: it competes as a plain shape.
    const oneSided = !(plan.floor.payoff || plan.floor.payoffWeight);
    const margin = Math.min(1, plan.poolMargin.margin / B.marginFull);
    const rich = oneSided ? 1 : richness(ctx, plan, poolTally(ctx, plan));
    const cmd = ctx.commander;
    const led =
      cmd && planJob(ctx, plan, cmd.facts, cmd.jobs)?.as === 'payoff' ? B.commanderPlan : 1;
    const score = margin * rich * core.quality * led;
    scores.push({
      style,
      kind: 'theme',
      viable: true,
      margin: round2(margin),
      richness: round2(rich),
      quality: round2(core.quality),
      score: round2(score),
      ...(led > 1 || oneSided
        ? {
            note: [
              oneSided ? 'no payoff floor, scored as a plain shape' : '',
              led > 1 ? 'the commander rewards it' : '',
            ]
              .filter(Boolean)
              .join('; '),
          }
        : {}),
    });
    themes.push({ plan, core, score });
  }
  scores.sort((a, b) => b.score - a.score || (a.style < b.style ? -1 : 1));
  // Stable sorts: a tie keeps the order tried (Midrange first, then the styles' order).
  plains.sort((a, b) => (b.score > a.score + EPS ? 1 : a.score > b.score + EPS ? -1 : 0));
  themes.sort((a, b) => (b.score > a.score + EPS ? 1 : a.score > b.score + EPS ? -1 : 0));
  const bestPlain = plains[0]!;
  const bestTheme = themes[0];
  const out: Chosen[] = themes
    .filter((t) => t.score > bestPlain.score + EPS)
    .map((t) => ({
      plan: t.plan,
      core: t.core,
      scores,
      reason: `${t.plan.style} scored ${round2(t.score)}, above the best plain shape (${bestPlain.plan.style}, ${round2(bestPlain.score)})`,
    }));
  for (const p of plains)
    out.push({
      plan: p.plan,
      scores,
      reason:
        out.length > 0
          ? `${p.plan.style} scored ${round2(p.score)}`
          : bestTheme
            ? `the best theme (${bestTheme.plan.style}, ${round2(bestTheme.score)}) did not beat ${p.plan.style} (${round2(p.score)})`
            : `no theme meets its floors in these colors; ${p.plan.style} fits the template best`,
    });
  return out;
}

function requested(ctx: BContext, style: string): Chosen {
  if ((PLAIN_SHAPES as readonly string[]).includes(style))
    return { plan: plainPlan(ctx, style), scores: [], reason: 'requested' };
  const plan = themePlan(ctx, style);
  if (!plan) throw new BuildError(`${labelOf(ctx, style)} is not described by ${ctx.defs.name}.`);
  const where = `${colorsLabel(ctx.colors)} at ${ctx.size} cards`;
  if (plan.poolMargin.margin < 1) {
    const t = poolTally(ctx, plan);
    throw new BuildError(
      `The pool cannot build ${labelOf(ctx, style)} in ${where}: ${shortText(t, sideTargets(plan.floor, [...SETUP_KEYS, ...PAYOFF_KEYS], 1))}.`,
    );
  }
  const core = themeCore(ctx, plan);
  if (!core.ok)
    throw new BuildError(
      `The pool cannot build ${labelOf(ctx, style)} in ${where}: ${core.short}.`,
    );
  return { plan, core, scores: [], reason: 'requested' };
}

function labelOf(ctx: BContext, style: string): string {
  if (style.startsWith('tribal:')) return `${style.slice('tribal:'.length)} tribe`;
  return archetypeOf(ctx.config, style)?.label ?? style;
}

// ---------------------------------------------------------------- steps 6 and 7

/** Main color by pips in the deck; a color carrying little next to it is a splash. */
function deckColorPlan(ctx: BContext, d: Deck): ColorPlan {
  const weight = new Map<Color, number>(ctx.colors.map((c) => [c, 0]));
  const count = (card: CardRecord, qty: number) => {
    const dem = pipDemand(card, ctx.colors);
    for (const c of ctx.colors) weight.set(c, weight.get(c)! + (dem[c] ?? 0) * qty);
  };
  if (ctx.commander) count(ctx.commander.card, 1);
  for (const c of ctx.cards) if (have(d, c) > 0) count(c.facts.card, have(d, c));
  let used = ctx.colors.filter((c) => weight.get(c)! > 0);
  if (used.length === 0) used = [...ctx.colors];
  const main = used.reduce((a, b) => (weight.get(b)! > weight.get(a)! ? b : a));
  const cut = ctx.config.landRules.colors.splashShare * weight.get(main)!;
  const role: ColorPlan['role'] = {};
  for (const c of used)
    role[c] = c === main ? 'main' : weight.get(c)! < cut ? 'splash' : 'secondary';
  return { colors: [main, ...used.filter((c) => c !== main)], main, role };
}

/** Trim curve copies, weakest among their peers first, or fill more, to a spell count. */
function fitSpells(ctx: BContext, plan: Plan, d: Deck, slots: number, relaxed: Set<string>): void {
  // A setup copy whose loss would leave the plan's payoffs uncovered stays. Only
  // setup can uncover them, so other copies may go even when cover is already short.
  const keepsCover = (c: BCard) => {
    if (plan.kind !== 'theme') return true;
    const job = planJob(ctx, plan, c.facts, c.jobs);
    if (job?.as !== 'setup') return true;
    const after = { ...d.plan };
    addJob(after, job, -1);
    return covered(after, plan.floor, undefined);
  };
  while (d.spells > slots) {
    let at = -1;
    let low = Infinity;
    d.curveCopies.forEach((id, i) => {
      const c = ctx.cards.find((x) => x.id === id)!;
      // Weakest among its peers, not by raw strength, which would cut cheap cards
      // first and raise the land count again. The latest copy goes on a tie.
      const q = c.q * setupPull(ctx, plan, d, c);
      if (q <= low && keepsCover(c)) {
        low = q;
        at = i;
      }
    });
    if (at < 0) break;
    const id = d.curveCopies.splice(at, 1)[0]!;
    remove(
      ctx,
      plan,
      d,
      ctx.cards.find((c) => c.id === id)!,
    );
  }
  if (d.spells < slots) fillCurve(ctx, plan, d, shapeFor(ctx, plan), slots, relaxed);
}

export interface BExplanation {
  defs: string;
  plan: {
    style: string;
    kind: 'plain' | 'theme';
    reason: string;
    floor?: ThemeFloor;
    poolMargin?: { setup: number; payoff: number; margin: number };
    scores?: PlanScore[];
    /** Best fit only: higher-ranked plans whose decks could not be filled, in the order tried. */
    tried?: { style: string; error: string }[];
  };
  theme?: {
    tally: Tally;
    seeded: number;
    grown: number;
    trimmed: number;
    setupTargets: Record<string, number>;
    payoffTargets: Record<string, number>;
  };
  roleShort: Record<string, { need: number; have: number }>;
  relaxed: string[];
  lands: {
    count: number;
    formula: number;
    sources: Partial<Record<Color, number>>;
    notes: string[];
  };
  colors: { main: Color; role: ColorPlan['role'] };
  /** Mean value of the pool's best copies per curve slot, noncreature then creature. */
  levels: number[][];
  secondaryIgnored?: string;
}

/**
 * Build one deck: steps 1 to 7. A requested style is built or declined. Best
 * fit tries its ranked plans in order until one fills, so a pool too thin for
 * its first choice still gets the best deck it allows.
 */
export function buildB(ctx: BContext): BuiltDeck {
  const style = ctx.request.style;
  if (style) return buildPlan(ctx, requested(ctx, style), []);
  const tried: { style: string; error: string }[] = [];
  for (const chosen of chooseBestFit(ctx)) {
    try {
      return buildPlan(ctx, chosen, tried);
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      tried.push({ style: chosen.plan.style, error: err.message });
    }
  }
  const names = tried.map((t) => labelOf(ctx, t.style)).join(', ');
  throw new BuildError(`${tried[0]!.error} Tried ${names}; none could be filled.`);
}

/** Steps 2 to 7 for one chosen plan; throws BuildError when the pool cannot fill it. */
function buildPlan(
  ctx: BContext,
  chosen: Chosen,
  tried: readonly { style: string; error: string }[],
): BuiltDeck {
  const { plan } = chosen;
  const d = chosen.core ? cloneDeck(chosen.core.deck) : newDeck(ctx, plan);
  const relaxed = new Set<string>();
  const cmd = ctx.commander ? 1 : 0;

  // The land count follows the spells' mana values; settle it in a few rounds.
  let lands = ctx.template.baseLands;
  const { roleShort } = fillSpells(ctx, plan, d, ctx.size - lands - cmd, relaxed);
  let formula = lands;
  for (let round = 0; round < 3; round++) {
    formula = planLandCount(ctx.template, spellCopies(ctx, d), ctx.config.landRules.mdfc).count;
    if (formula === lands) break;
    lands = formula;
    fitSpells(ctx, plan, d, ctx.size - lands - cmd, relaxed);
  }
  lands = ctx.size - cmd - d.spells;
  if (lands - formula > (ctx.size >= 60 ? 2 : 1)) {
    throw new BuildError(
      `The pool has too few playable cards in ${colorsLabel(ctx.colors)} for a ${ctx.size}-card ${labelOf(ctx, plan.style)} deck: ${d.spells} spells for ${ctx.size - cmd - formula} slots.`,
    );
  }

  const colorPlan = deckColorPlan(ctx, d);
  const spells = spellCopies(ctx, d);
  if (ctx.commander) spells.push({ facts: ctx.commander.facts, qty: 1 });
  let mana;
  try {
    mana = chooseManaBase(
      lands,
      ctx.candidates,
      colorPlan,
      spells,
      ctx.config,
      ctx.settings,
      ctx.size,
      ctx.index,
    );
  } catch (err) {
    if (err instanceof ManaBaseError) throw new BuildError(err.message);
    throw err;
  }

  const byName = (a: { id: string; name: string }, b: { id: string; name: string }) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1;
  const cards = ctx.cards
    .filter((c) => have(d, c) > 0)
    .map((c) => ({ id: c.id, name: c.facts.card.name, qty: have(d, c), why: d.why.get(c.id)! }))
    .sort(byName)
    .map(({ id, qty, why }) => ({ id, qty, why }));
  for (const pick of mana.nonbasics)
    cards.push({ id: pick.candidate.facts.card.id, qty: pick.qty, why: pick.why });
  if (ctx.commander) cards.unshift({ id: ctx.commander.card.id, qty: 1, why: 'Commander' });

  const used = normalizeColors(colorPlan.colors);
  const explanation: BExplanation = {
    defs: ctx.defs.name,
    plan: {
      style: plan.style,
      kind: plan.kind,
      reason: tried.length
        ? `${chosen.reason}; tried first: ${tried.map((t) => t.style).join(', ')}, which could not be filled`
        : chosen.reason,
      ...(plan.kind === 'theme'
        ? { floor: plan.floor, poolMargin: roundMargin(plan.poolMargin) }
        : {}),
      ...(chosen.scores.length ? { scores: chosen.scores } : {}),
      ...(tried.length ? { tried: [...tried] } : {}),
    },
    ...(chosen.core
      ? {
          theme: {
            tally: roundTally(d.plan),
            seeded: chosen.core.seeded,
            grown: chosen.core.grown,
            trimmed: chosen.core.trimmed,
            setupTargets: roundRecord(chosen.core.setupTargets),
            payoffTargets: roundRecord(chosen.core.payoffTargets),
          },
        }
      : {}),
    roleShort,
    relaxed: [...relaxed],
    lands: { count: lands, formula, sources: mana.sources, notes: mana.notes },
    colors: { main: colorPlan.main, role: colorPlan.role },
    levels: ctx.levels.slice(1).map((k) => k.map(round2)),
    ...(ctx.request.secondary ? { secondaryIgnored: ctx.request.secondary } : {}),
  };
  return {
    name: `${colorsLabel(ctx.size === 100 ? ctx.colors : used)} ${labelOf(ctx, plan.style)}`,
    archetype: plan.style,
    colors: ctx.size === 100 ? ctx.colors : used,
    ...(ctx.commander ? { commander: ctx.commander.card.id } : {}),
    cards,
    basics: mana.basics,
    explanation,
  };
}

function roundTally(t: Tally): Tally {
  return {
    setupUnits: round2(t.setupUnits),
    setupWeight: round2(t.setupWeight),
    repeatable: round2(t.repeatable),
    payoffUnits: round2(t.payoffUnits),
    payoffWeight: round2(t.payoffWeight),
  };
}

function roundMargin(m: { setup: number; payoff: number; margin: number }) {
  const r = (n: number) => (Number.isFinite(n) ? round2(n) : null);
  return { setup: r(m.setup) ?? 0, payoff: r(m.payoff) ?? 0, margin: r(m.margin) ?? 0 };
}

function roundRecord(r: Partial<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) if (v !== undefined) out[k] = round2(v);
  return out;
}
