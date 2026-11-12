// The grow builder (seed and grow), for styles the player asks for by name at
// 60, 40, and 100 cards: a theme the rules describe, or Aggro, Midrange, or
// Control. It builds the way a person does: check the plan against honest
// counts (config/theme-rules.json), seed the payoffs the pool supports, grow
// setup to what they demand, add interaction and card advantage to the role
// minimums, fill the curve slot by slot, then build the mana. A style the pool
// cannot support is answered with a note and the nearest deck it can build.
// Ported from the review prototype b-grow (docs/review/proto-b.md); its
// constants live in config/builder-weights.json under `grow`. Deterministic:
// candidates are walked in card id order and ties go to strength, then id.

import {
  buildClassic,
  BuildError,
  checkBuiltDeck,
  commanderFor,
  commanderShortName,
  copyNotes,
  curveTargets,
  curveWhy,
  FILLER_WHY,
  landLine,
  spellReport,
} from './builder.ts';
import { factsFor, listCandidates, type Candidate, type CardFacts } from './candidates.ts';
import {
  castChance,
  colorClassOf,
  colorsLabel,
  isCommanderSize,
  normalizeColors,
  pipDemand,
} from './colors.ts';
import {
  configVersion,
  curveProfileFor,
  roleOverridesFor,
  templateFor,
  type Archetype,
  type BulkBrewConfig,
  type DeckTemplate,
  type GrowWeights,
  type RoleQuota,
  type TypeMix,
} from './config.ts';
import {
  chooseManaBase,
  ManaBaseError,
  planLandCount,
  type ColorPlan,
  type ManaBase,
} from './lands.ts';
import type { CardIndex } from './pack.ts';
import { scanCandidates, secondaryLabel, tribeOf } from './scan.ts';
import {
  matchCard,
  themeRulesFor,
  type CompiledStyle,
  type ThemeFloor,
  type ThemeLacks,
  type ThemeSize,
  type ThemeTally,
} from './theme-rules.ts';
import type {
  BuildExplanation,
  BuildRequest,
  BuildResult,
  CardRecord,
  Color,
  Deck,
  DeckCard,
  DeckSize,
  Pool,
  Settings,
} from './types.ts';

/** The plain shapes, Midrange first so the templates' default shape wins a best-fit tie. */
export const PLAIN_SHAPES = ['midrange', 'aggro', 'control'] as const;
/** Roles whose cards do something in any game, so an off-plan theme job does not gate them. */
const SPELL_JOBS = ['removal', 'sweeper', 'cardAdvantage', 'cheapInteraction', 'ramp'];
const EPS = 1e-9;

type SetupKey = 'setup' | 'setupWeight' | 'repeatable';
type PayoffKey = 'payoff' | 'payoffWeight' | 'repeatableOrPayoff';
type FloorKey = keyof ThemeFloor;
const SETUP_KEYS: readonly SetupKey[] = ['setup', 'setupWeight', 'repeatable'];
const PAYOFF_KEYS: readonly PayoffKey[] = ['payoff', 'payoffWeight', 'repeatableOrPayoff'];
const FLOOR_KEYS: readonly FloorKey[] = [...SETUP_KEYS, ...PAYOFF_KEYS];

/** One card's job for one style: setup or payoff, never both. */
export interface Job {
  as: 'setup' | 'payoff';
  job: string;
  weight: number;
  repeatable: boolean;
}

type Tally = ThemeTally;

function emptyTally(): Tally {
  return { setupUnits: 0, setupWeight: 0, repeatable: 0, payoffUnits: 0, payoffWeight: 0 };
}

function addJob(t: Tally, job: Job | undefined, copies: number): void {
  if (!job) return;
  const units = Math.min(job.weight, 1) * copies;
  if (job.as === 'setup') {
    t.setupUnits += units;
    t.setupWeight += job.weight * copies;
    if (job.repeatable) t.repeatable += copies;
  } else {
    t.payoffUnits += units;
    t.payoffWeight += job.weight * copies;
  }
}

// ---------------------------------------------------------------- definitions

interface Defs {
  /** Synergy archetype ids the rules describe, in config order. */
  styles: readonly string[];
  compiled: readonly CompiledStyle[];
}

const defsCache = new WeakMap<BulkBrewConfig, Defs>();

function defsFor(config: BulkBrewConfig): Defs {
  let defs = defsCache.get(config);
  if (!defs) {
    const rules = themeRulesFor(config);
    const styles = config.archetypes.archetypes
      .filter((a) => a.kind === 'synergy' && rules.styles.has(a.id))
      .map((a) => a.id);
    defs = { styles, compiled: styles.map((id) => rules.styles.get(id)!) };
    defsCache.set(config, defs);
  }
  return defs;
}

/** Floor alternatives for a style at a size, one of which a deck must meet. */
function floorsFor(defs: Defs, i: number, size: DeckSize): ThemeFloor[] | undefined {
  const entry = defs.compiled[i]?.minimums?.[`${size as ThemeSize}`];
  if (!entry) return undefined;
  return Array.isArray(entry) ? entry : [entry];
}

// The scan has no card index, so jobs are cached per config and per card
// facts object, which factsFor already caches per index, config, and card.
const jobsCache = new WeakMap<
  BulkBrewConfig,
  WeakMap<CardFacts, Map<number, (Job | undefined)[]>>
>();

/** A card's job for each style the rules describe (undefined: none, a rider, or excluded). */
function jobsOf(config: BulkBrewConfig, facts: CardFacts, size: DeckSize): (Job | undefined)[] {
  let byFacts = jobsCache.get(config);
  if (!byFacts) jobsCache.set(config, (byFacts = new WeakMap()));
  let bySize = byFacts.get(facts);
  if (!bySize) byFacts.set(facts, (bySize = new Map()));
  let jobs = bySize.get(size);
  if (!jobs) {
    jobs = defsFor(config).compiled.map((style) => {
      const m = matchCard(facts.card, style, size as ThemeSize);
      // A rider weighs 0: it is not setup.
      if (!m || m.as === 'excluded' || m.weight <= 0) return undefined;
      return { as: m.as, job: m.job, weight: m.weight, repeatable: m.repeatable };
    });
    bySize.set(size, jobs);
  }
  return jobs;
}

// ---------------------------------------------------------------- floors

function floorValue(t: Tally, key: FloorKey): number {
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

interface Margin {
  setup: number;
  payoff: number;
  margin: number;
}

/** Have over need on one side of a floor; Infinity when the side has no floor. */
function sideMargin(t: Tally, floor: ThemeFloor, keys: readonly FloorKey[]): number {
  let m = Infinity;
  for (const k of keys) {
    const need = floor[k];
    if (need === undefined || need <= 0) continue;
    m = Math.min(m, floorValue(t, k) / need);
  }
  return m;
}

/** The smaller of the setup and payoff margins (a side without a floor does not count). */
function themeMargin(t: Tally, floor: ThemeFloor): Margin {
  const setup = sideMargin(t, floor, SETUP_KEYS);
  const payoff = sideMargin(t, floor, PAYOFF_KEYS);
  const margin = Math.min(setup, payoff);
  return { setup, payoff, margin: Number.isFinite(margin) ? margin : 0 };
}

/** The floor alternative a tally meets best. */
function bestFloor(t: Tally, floors: readonly ThemeFloor[]): { floor: ThemeFloor; margin: Margin } {
  let pick: { floor: ThemeFloor; margin: Margin } | undefined;
  for (const floor of floors) {
    const margin = themeMargin(t, floor);
    if (!pick || margin.margin > pick.margin.margin + EPS) pick = { floor, margin };
  }
  return pick!;
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

/** Whether the setup covers the payoffs plus `extra`; a card never counts toward its own need. */
function covered(t: Tally, floor: ThemeFloor, extra: Job | undefined): boolean {
  const b = balance(floor);
  const after = { ...t };
  addJob(after, extra, 1);
  return floorValue(t, b.setup) + EPS >= b.ratio * floorValue(after, b.payoff);
}

/**
 * Whether setup that needs its own payoffs (opponent mill, gifts) has them:
 * at least one payoff in the deck, and the setup after this card within the
 * floor's ratio of setup per payoff.
 */
function fed(t: Tally, floor: ThemeFloor | undefined, job: Job): boolean {
  if (t.payoffUnits <= EPS) return false;
  if (!floor) return true;
  const b = balance(floor);
  const after = { ...t };
  addJob(after, job, 1);
  return floorValue(after, b.setup) <= b.ratio * floorValue(t, b.payoff) + EPS;
}

type Targets = Partial<Record<FloorKey, number>>;

function sideTargets(floor: ThemeFloor, keys: readonly FloorKey[], scale: number): Targets {
  const out: Targets = {};
  for (const k of keys) if ((floor[k] ?? 0) > 0) out[k] = floor[k]! * scale;
  return out;
}

function met(t: Tally, targets: Targets): boolean {
  return (Object.entries(targets) as [FloorKey, number][]).every(
    ([k, v]) => floorValue(t, k) + EPS >= v,
  );
}

/** Each floor a tally misses, in floor order. */
function shortOf(t: Tally, targets: Targets): StyleShort[] {
  const out: StyleShort[] = [];
  for (const k of FLOOR_KEYS) {
    const need = targets[k];
    if (need === undefined) continue;
    const have = floorValue(t, k);
    if (have + EPS < need) out.push({ floor: k, have: round2(have), need: round2(need) });
  }
  return out;
}

/** Floor names for notes, when a style gives no phrase of its own. */
const FLOOR_WORDS: Record<FloorKey, string> = {
  setup: 'setup cards',
  setupWeight: 'setup weight',
  repeatable: 'repeatable setup',
  payoff: 'payoff cards',
  payoffWeight: 'payoff weight',
  repeatableOrPayoff: 'repeatable setup or payoff cards',
};

/** The style's phrase for the floor missed by the largest share, with the counts. */
function lacksSentence(lacks: ThemeLacks, short: readonly StyleShort[]): string {
  let worst: StyleShort | undefined;
  for (const s of short)
    if (!worst || (s.need - s.have) / s.need > (worst.need - worst.have) / worst.need + EPS)
      worst = s;
  if (!worst) return 'too few cards for this style';
  const phrase = lacks[worst.floor] ?? `too few ${FLOOR_WORDS[worst.floor]}`;
  return `${phrase} (${wholeCount(worst.have)} of ${wholeCount(worst.need)})`;
}

/** Units and weights can be halves; a player reads whole cards. */
function wholeCount(n: number): string {
  return Number.isInteger(n) ? String(n) : `about ${Math.round(n)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- viability

/** One floor a pool misses, for the floor alternative it meets best. */
export interface StyleShort {
  floor: FloorKey;
  have: number;
  need: number;
}

/** A themed style against the rules' floors, as the scan reports it. */
export interface StyleViability {
  /** The pool meets every floor of its best alternative (margin at least 1). */
  viable: boolean;
  /** The smaller of the setup and payoff sides' have over need. */
  margin: number;
  short: StyleShort[];
  /** What the pool lacks, as a phrase a player reads: "no repeatable way to fill the graveyard (1 of 2)". Empty when viable. */
  lacks: string;
}

/**
 * Each themed style the rules describe at this size, the pool against its
 * floors: every copy the builder may use of each spell candidate, plus the
 * commander's job when given. Cheap enough for the scan: no deck is built.
 */
export function growViability(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
  commander?: CardFacts,
): Record<string, StyleViability> {
  const defs = defsFor(config);
  const credit = config.builderWeights.grow.commanderCredit;
  const tallies = defs.styles.map(emptyTally);
  for (const c of cands) {
    if (!c.facts.spell) continue;
    jobsOf(config, c.facts, size).forEach((j, i) => addJob(tallies[i]!, j, c.preferred));
  }
  if (commander) jobsOf(config, commander, size).forEach((j, i) => addJob(tallies[i]!, j, credit));
  const out: Record<string, StyleViability> = {};
  defs.styles.forEach((style, i) => {
    const floors = floorsFor(defs, i, size);
    if (!floors?.length) return;
    const t = tallies[i]!;
    const { floor, margin } = bestFloor(t, floors);
    const short = shortOf(t, sideTargets(floor, FLOOR_KEYS, 1));
    const viable = margin.margin >= 1 - EPS;
    out[style] = {
      viable,
      margin: margin.margin,
      short,
      lacks: viable ? '' : lacksSentence(defs.compiled[i]!.lacks, short),
    };
  });
  return out;
}

// ---------------------------------------------------------------- cards and plans

/** A pool spell in the deck's colors, with what every step reads. */
interface GrowCard {
  cand: Candidate;
  facts: CardFacts;
  id: string;
  /** Copies the builder uses: the core's preferred copies (legendary and expensive cards fewer). */
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
  /** Job per style, aligned with the defs' styles. */
  jobs: readonly (Job | undefined)[];
}

type Plan =
  | { kind: 'plain'; style: string; archetype: Archetype }
  | {
      kind: 'theme';
      style: string;
      /** Index into the defs' styles. */
      index: number;
      archetype: Archetype;
      floor: ThemeFloor;
      /** The pool's own margin for this floor. */
      poolMargin: Margin;
    };

type ThemePlan = Extract<Plan, { kind: 'theme' }>;

/** Everything a build needs about the request and the pool, computed once. */
export interface GrowContext {
  request: BuildRequest;
  size: DeckSize;
  colors: Color[];
  config: BulkBrewConfig;
  settings: Settings;
  index: CardIndex;
  pool: Pool;
  defs: Defs;
  k: GrowWeights;
  template: DeckTemplate;
  commander?: { card: CardRecord; facts: CardFacts; jobs: readonly (Job | undefined)[] };
  cards: GrowCard[];
  byId: Map<string, GrowCard>;
  /** Every candidate but the commander, lands included, for the mana base and the report. */
  candidates: Candidate[];
  /** Mean value of the pool's best copies per curve slot (1 to 7) and kind (0 noncreature, 1 creature). */
  levels: number[][];
  /** Spell slots before the land formula adjusts them. */
  slots0: number;
  roleLabels: Map<string, string>;
}

function planJob(plan: Plan, jobs: readonly (Job | undefined)[]): Job | undefined {
  return plan.kind === 'theme' ? jobs[plan.index] : undefined;
}

/**
 * Cast chance on curve, given the deck made its land drops. Before any card
 * is picked, each color's sources are its share of the pool's colored weight
 * (strength times copies of spells asking for it).
 */
function castModel(
  cands: readonly Candidate[],
  colors: Color[],
  size: DeckSize,
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

function mean(v: readonly number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/**
 * The pool's cards for a request: legality, copies, cast chance, and jobs.
 * Exported with chooseBestFit for phase 2's plan picker.
 */
export function growContext(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): GrowContext {
  const { size, settings } = request;
  const lead = isCommanderSize(size) ? commanderFor(request, pool, index) : undefined;
  const colors = normalizeColors(lead ? lead.identity : request.colors);
  if (colors.length === 0) throw new BuildError('Pick at least one color.');
  const template = templateFor(config, size);
  const listed = listCandidates(pool, index, config, settings, colors, size);
  // The commander's pips weigh in the color split: it is cast every game.
  const cast = castModel(listed, colors, size, template.baseLands);
  const candidates = listed.filter((c) => c.facts.card.id !== lead?.id);
  const cards: GrowCard[] = [];
  for (const cand of candidates) {
    const f = cand.facts;
    if (!f.spell) continue;
    const p = cast(f.card);
    cards.push({
      cand,
      facts: f,
      id: f.card.id,
      max: cand.preferred,
      avail: cand.available,
      slot: Math.max(1, Math.min(7, f.bucket)),
      cast: p,
      value: Math.max(0, f.strength) * p,
      q: 0,
      jobs: jobsOf(config, f, size),
    });
  }
  const slots0 = size - template.baseLands - (lead ? 1 : 0);
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
  const ctx: GrowContext = {
    request,
    size,
    colors,
    config,
    settings,
    index,
    pool,
    defs: defsFor(config),
    k: config.builderWeights.grow,
    template,
    cards,
    byId: new Map(cards.map((c) => [c.id, c])),
    candidates,
    levels,
    slots0,
    roleLabels: new Map(config.roles.roles.map((r) => [r.id, r.label])),
  };
  if (lead) {
    const facts = factsFor(index, config, lead);
    ctx.commander = { card: lead, facts, jobs: jobsOf(config, facts, size) };
  }
  return ctx;
}

function archetypeOf(config: BulkBrewConfig, id: string): Archetype | undefined {
  return config.archetypes.archetypes.find((a) => a.id === id);
}

/** The pool's tally for a style: every copy the builder may use, the commander credited. */
function poolTally(ctx: GrowContext, index: number): Tally {
  const t = emptyTally();
  const cmd = ctx.commander;
  if (cmd) addJob(t, cmd.jobs[index], ctx.k.commanderCredit);
  for (const c of ctx.cards) addJob(t, c.jobs[index], c.max);
  return t;
}

/** A themed plan with the floor alternative the pool meets best; undefined when the rules give no floors. */
function themePlan(ctx: GrowContext, style: string): ThemePlan | undefined {
  const index = ctx.defs.styles.indexOf(style);
  const archetype = archetypeOf(ctx.config, style);
  const floors = index >= 0 ? floorsFor(ctx.defs, index, ctx.size) : undefined;
  if (!archetype || !floors?.length) return undefined;
  const { floor, margin } = bestFloor(poolTally(ctx, index), floors);
  return { kind: 'theme', style, index, archetype, floor, poolMargin: margin };
}

function plainPlan(ctx: GrowContext, style: string): Plan | undefined {
  const archetype = archetypeOf(ctx.config, style);
  return archetype ? { kind: 'plain', style, archetype } : undefined;
}

// ---------------------------------------------------------------- the deck

interface GrowDeck {
  qty: Map<string, number>;
  why: Map<string, string>;
  /** Copies added by the curve step, in order, so the land count can trim them. */
  curveCopies: string[];
  /** Copies added by the seed step, so payoffs the setup cannot cover can go again. */
  seedCopies: string[];
  spells: number;
  /** Per style, aligned with the defs' styles. */
  tallies: Tally[];
  /** The plan's own tally, the commander credited. */
  plan: Tally;
  /** Role copies, the commander included. */
  roles: Map<string, number>;
  /** Copies per curve slot, index 1 to 7. */
  slots: number[];
  creatures: number;
  noncreaturePermanents: number;
  instantsAndSorceries: number;
}

function cloneDeck(d: GrowDeck): GrowDeck {
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

function newDeck(ctx: GrowContext, plan: Plan): GrowDeck {
  const d: GrowDeck = {
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
    // The commander is there every game; the rules count it as one card.
    const credit = ctx.k.commanderCredit;
    cmd.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, credit));
    addJob(d.plan, planJob(plan, cmd.jobs), credit);
    for (const r of cmd.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) + 1);
  }
  return d;
}

function have(d: GrowDeck, c: GrowCard): number {
  return d.qty.get(c.id) ?? 0;
}

function add(plan: Plan, d: GrowDeck, c: GrowCard, why: string): void {
  d.qty.set(c.id, have(d, c) + 1);
  if (!d.why.has(c.id)) d.why.set(c.id, why);
  d.spells += 1;
  c.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, 1));
  addJob(d.plan, planJob(plan, c.jobs), 1);
  for (const r of c.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) + 1);
  d.slots[c.slot]! += 1;
  if (c.facts.creature) d.creatures += 1;
  else if (c.facts.instantOrSorcery) d.instantsAndSorceries += 1;
  else if (c.facts.noncreaturePermanent) d.noncreaturePermanents += 1;
}

function remove(plan: Plan, d: GrowDeck, c: GrowCard): void {
  const n = have(d, c) - 1;
  if (n < 0) return;
  if (n === 0) {
    d.qty.delete(c.id);
    d.why.delete(c.id);
  } else d.qty.set(c.id, n);
  d.spells -= 1;
  c.jobs.forEach((j, i) => addJob(d.tallies[i]!, j, -1));
  addJob(d.plan, planJob(plan, c.jobs), -1);
  for (const r of c.facts.roles) d.roles.set(r, (d.roles.get(r) ?? 0) - 1);
  d.slots[c.slot]! -= 1;
  if (c.facts.creature) d.creatures -= 1;
  else if (c.facts.instantOrSorcery) d.instantsAndSorceries -= 1;
  else if (c.facts.noncreaturePermanent) d.noncreaturePermanents -= 1;
}

/** The first floor alternative of another style, which its off-plan cards are measured against. */
function offPlanFloor(ctx: GrowContext, i: number): ThemeFloor | undefined {
  return floorsFor(ctx.defs, i, ctx.size)?.[0];
}

/**
 * The gate every step after the theme core checks. A payoff of the plan
 * enters only when the setup already in the deck covers it. A card that is
 * not setup for the plan and fills no spell role also needs, for each other
 * style: as a payoff at weight 1 or more (it does little without its
 * resource), that style's setup covering it; as setup for a style whose setup
 * does nothing without its own payoffs (Ruin Crab's opponent mill), a payoff
 * of that style in the deck and no more setup than the floors' ratio.
 */
function gateOpen(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): boolean {
  const own = planJob(plan, c.jobs);
  if (plan.kind === 'theme' && own?.as === 'payoff' && !covered(d.plan, plan.floor, own))
    return false;
  if (own?.as === 'setup') return true;
  if (c.facts.roles.some((r) => SPELL_JOBS.includes(r))) return true;
  for (let i = 0; i < c.jobs.length; i++) {
    const j = c.jobs[i];
    if (!j || (plan.kind === 'theme' && i === plan.index)) continue;
    if (j.as === 'payoff') {
      if (j.weight < ctx.k.offPlanGateWeight) continue;
      const floor = offPlanFloor(ctx, i);
      if (floor && !covered(d.tallies[i]!, floor, j)) return false;
    } else if (ctx.defs.compiled[i]!.setupNeedsPayoff) {
      if (!fed(d.tallies[i]!, offPlanFloor(ctx, i), j)) return false;
    }
  }
  return true;
}

/** The last relaxation keeps only the plan's own payoff gate. */
function planGateOnly(plan: Plan, d: GrowDeck, c: GrowCard): boolean {
  const own = planJob(plan, c.jobs);
  return !(plan.kind === 'theme' && own?.as === 'payoff' && !covered(d.plan, plan.floor, own));
}

/** Extra value for the plan's setup in the role and curve fills, fading out above the floor. */
function setupPull(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): number {
  if (plan.kind !== 'theme') return 1;
  const job = planJob(plan, c.jobs);
  if (job?.as !== 'setup') return 1;
  const b = balance(plan.floor);
  const floor = plan.floor[b.setup] ?? 0;
  if (floor <= 0) return 1;
  const target = floor * ctx.k.setupTarget;
  const fade = Math.min(1, Math.max(0, (target - floorValue(d.plan, b.setup)) / (target - floor)));
  return 1 + ctx.k.setupPull * Math.min(1, job.weight) * fade;
}

/** The highest score among cards passing the filter; ties by strength, then card id. */
function best(
  cards: readonly GrowCard[],
  ok: (c: GrowCard) => boolean,
  score: (c: GrowCard) => number,
): GrowCard | undefined {
  let top: GrowCard | undefined;
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
function gain(t: Tally, job: Job | undefined, targets: Targets): number {
  if (!job) return 0;
  const after = { ...t };
  addJob(after, job, 1);
  let g = 0;
  for (const [k, target] of Object.entries(targets) as [FloorKey, number][]) {
    if (target <= 0) continue;
    const now = floorValue(t, k);
    if (now >= target) continue;
    g += (Math.min(target, floorValue(after, k)) - now) / target;
  }
  return g;
}

interface CoreResult {
  deck: GrowDeck;
  ok: boolean;
  /** Floors the theme core missed, when not ok. */
  short: StyleShort[];
}

/**
 * Steps 2 and 3: seed the payoffs the pool supports best, then grow setup to
 * the demand they create in the ratio the floors imply, re-scoring every
 * candidate after each add (demand met, quality with cast chance, room on the
 * curve). Payoffs the setup cannot cover go again, never below the floor.
 */
function themeCore(ctx: GrowContext, plan: ThemePlan): CoreResult {
  const d = newDeck(ctx, plan);
  const jobOf = (c: GrowCard) => c.jobs[plan.index];
  // Theme cards go where the curve has room, as a person would pick a cheap looter over a dear one.
  const targets = curveTargets(shapeFor(ctx, plan).shape, ctx.slots0);
  const room = (c: GrowCard) => (d.slots[c.slot]! < (targets[c.slot] ?? 0) ? 1 : ctx.k.fullSlot);
  const rich = plan.poolMargin.setup >= 2 && plan.poolMargin.payoff >= 2;
  const payoffTargets = sideTargets(plan.floor, PAYOFF_KEYS, rich ? ctx.k.richSeed : 1);
  for (;;) {
    if (met(d.plan, payoffTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => have(d, c) < c.max && jobOf(c)?.as === 'payoff',
      (c) => gain(d.plan, jobOf(c), payoffTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(plan, d, pick, `Payoff: ${jobOf(pick)!.job}`);
    d.seedCopies.push(pick.id);
  }

  const b = balance(plan.floor);
  const payoffNeed = plan.floor[b.payoff] ?? 0;
  const scale = payoffNeed > 0 ? Math.max(1, floorValue(d.plan, b.payoff) / payoffNeed) : 1;
  const setupTargets = sideTargets(plan.floor, SETUP_KEYS, scale);
  for (;;) {
    if (met(d.plan, setupTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => have(d, c) < c.max && jobOf(c)?.as === 'setup',
      (c) => gain(d.plan, jobOf(c), setupTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(plan, d, pick, `Setup: ${jobOf(pick)!.job}`);
  }

  // Setup ran out: drop the weakest seeded payoffs while above the floor and uncovered.
  const floorTargets = sideTargets(plan.floor, PAYOFF_KEYS, 1);
  while (!covered(d.plan, plan.floor, undefined)) {
    const seeded = [...new Set(d.seedCopies)]
      .map((id) => ctx.byId.get(id)!)
      .sort((x, y) => x.value - y.value || (x.id < y.id ? -1 : 1));
    const drop = seeded.find((c) => {
      const after = { ...d.plan };
      addJob(after, jobOf(c), -1);
      return met(after, floorTargets);
    });
    if (!drop) break;
    remove(plan, d, drop);
    d.seedCopies.splice(d.seedCopies.lastIndexOf(drop.id), 1);
  }

  const minimum = sideTargets(plan.floor, FLOOR_KEYS, 1);
  const ok = met(d.plan, minimum);
  return { deck: d, ok, short: ok ? [] : shortOf(d.plan, minimum) };
}

// ---------------------------------------------------------------- steps 4 and 5

interface Shape {
  quotas: Record<string, RoleQuota>;
  shape: number[];
  typeMix: TypeMix;
}

function shapeFor(ctx: GrowContext, plan: Plan): Shape {
  const t = ctx.template;
  const a = plan.archetype;
  const profile = t.size === 20 || t.size === 100 ? t.curveProfile : a.curveProfile;
  return {
    quotas: { ...t.roles, ...(roleOverridesFor(a, t.size) ?? {}) },
    shape: curveProfileFor(ctx.config, profile).shape,
    typeMix: { ...t.typeMix, ...(a.typeMixOverrides ?? {}) },
  };
}

/**
 * Step 4: each role to its minimum, a card competing only with cards of the
 * same role, by value. Cards already in the deck count for every role they fill.
 */
function fillRoles(ctx: GrowContext, plan: Plan, d: GrowDeck, shape: Shape, slots: number): void {
  for (const [role, q] of Object.entries(shape.quotas)) {
    while ((d.roles.get(role) ?? 0) < q.min && d.spells < slots) {
      const pick = best(
        ctx.cards,
        (c) => have(d, c) < c.max && c.facts.roles.includes(role) && gateOpen(ctx, plan, d, c),
        (c) => c.value * setupPull(ctx, plan, d, c),
      );
      if (!pick) break;
      add(plan, d, pick, ctx.roleLabels.get(role) ?? role);
    }
  }
}

/** What each fill level gives up, for the notes; levels 0 and 1 are the curve itself. */
const RELAXATIONS = [
  '',
  '',
  'the card type mix',
  'the usual copy counts',
  "the rule that keeps other themes' cards out",
];

/**
 * Step 5: fill the slot furthest below the curve profile with the best card
 * at that mana value, keeping the type mix; when every slot is full or empty,
 * the card best among its peers. Each relaxation is a last resort for thin pools.
 */
function fillCurve(
  ctx: GrowContext,
  plan: Plan,
  d: GrowDeck,
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
  const copies = (c: GrowCard) => (level >= 3 ? c.avail : c.max);
  while (d.spells < slots) {
    const left = slots - d.spells;
    const mustSpell = spellMin - d.instantsAndSorceries >= left;
    const wantCreature = d.creatures < mix.creatureMin * (d.spells + 1);
    const typeOk = (c: GrowCard) => {
      if (level >= 2) return true;
      if (mustSpell && !c.facts.instantOrSorcery) return false;
      if (c.facts.creature && d.creatures >= creatureMax) return false;
      if (c.facts.noncreaturePermanent && d.noncreaturePermanents >= permanentMax) return false;
      return true;
    };
    const base = (c: GrowCard) =>
      have(d, c) < copies(c) &&
      typeOk(c) &&
      (level >= 4 ? planGateOnly(plan, d, c) : gateOpen(ctx, plan, d, c));
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
    const inSlot = (c: GrowCard) => slot < 0 || c.slot === slot;
    // Within a slot, strength; across slots, quality among peers, so price does not decide.
    const score = (c: GrowCard) => (slot >= 0 ? c.value : c.q) * setupPull(ctx, plan, d, c);
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
    add(plan, d, pick, slot >= 0 ? curveWhy(slot) : FILLER_WHY);
    d.curveCopies.push(pick.id);
  }
}

/** Steps 4 and 5 into a given number of spell slots. */
function fillSpells(
  ctx: GrowContext,
  plan: Plan,
  d: GrowDeck,
  slots: number,
  relaxed: Set<string>,
): Shape {
  const shape = shapeFor(ctx, plan);
  fillRoles(ctx, plan, d, shape, slots);
  fillCurve(ctx, plan, d, shape, slots, relaxed);
  return shape;
}

/** The deck's spells as the land formula and mana base read them; the commander is left out. */
function spellCopies(ctx: GrowContext, d: GrowDeck): { facts: CardFacts; qty: number }[] {
  return ctx.cards.filter((c) => have(d, c) > 0).map((c) => ({ facts: c.facts, qty: have(d, c) }));
}

/**
 * The plain shape's template fit: the share of its role minimums, curve
 * targets, and creature floor that the filled deck reaches.
 */
function templateFit(ctx: GrowContext, d: GrowDeck, shape: Shape, slots: number): number {
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
function meanQuality(ctx: GrowContext, d: GrowDeck): number {
  let total = 0;
  let n = 0;
  for (const c of ctx.cards) {
    const k = have(d, c);
    total += Math.min(1, c.q) * k;
    n += k;
  }
  return n > 0 ? total / n : 0;
}

// ---------------------------------------------------------------- best fit (phase 2)

/**
 * How far the pool's setup and payoff stand above what plain bulk of the same
 * cards' colors holds (config/theme-bulk.json), the smaller of the two; 1
 * when no baseline is bundled.
 */
function richness(ctx: GrowContext, plan: ThemePlan, pool: Tally): number {
  const bulk = ctx.config.themeBulk?.styles[plan.style];
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
  const sides: FloorKey[] = [b.setup];
  if (Number.isFinite(plan.poolMargin.payoff)) sides.push(b.payoff);
  let r = Infinity;
  for (const k of sides) {
    const e = floorValue(expected, k);
    r = Math.min(r, e > 0 ? floorValue(pool, k) / e : Infinity);
  }
  return Math.min(r, ctx.k.richnessCap);
}

export interface GrowPlanScore {
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

export interface GrowBestFit {
  style: string;
  kind: 'plain' | 'theme';
  reason: string;
  scores: GrowPlanScore[];
}

// Stable sorts: a tie keeps the order tried (Midrange first, then the styles' order).
function byScore(a: { score: number }, b: { score: number }): number {
  return b.score > a.score + EPS ? 1 : a.score > b.score + EPS ? -1 : 0;
}

/**
 * The plain shapes, best first: each filled without lands and scored by its
 * template fit times the mean quality of its spells among their peers.
 */
function rankPlains(ctx: GrowContext, scores?: GrowPlanScore[]): { plan: Plan; score: number }[] {
  const plains: { plan: Plan; score: number }[] = [];
  for (const style of PLAIN_SHAPES) {
    const plan = plainPlan(ctx, style);
    if (!plan) continue;
    const d = newDeck(ctx, plan);
    const shape = fillSpells(ctx, plan, d, ctx.slots0, new Set());
    const fit = templateFit(ctx, d, shape, ctx.slots0);
    const quality = meanQuality(ctx, d);
    const score = fit * quality;
    scores?.push({
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
  return plains.sort(byScore);
}

/**
 * Best fit by the grow builder's own measure, ported from the prototype but
 * not wired to buildDeck in this phase (today's best fit stays); kept for
 * phase 2's plan picker. Each plan's deck is built without lands and scored
 * by the mean quality of its spells among their peers. A theme multiplies
 * that by min(margin / marginFull, 1) and by its richness over plain bulk
 * (capped); a plain shape by its template fit. A theme must beat the best
 * plain shape. Returns the plans to try in order: the themes that beat the
 * best plain shape, best first, then the plain shapes, best first. Tribes
 * keep today's builder and are not among them.
 */
export function chooseBestFit(ctx: GrowContext): GrowBestFit[] {
  const k = ctx.k;
  const scores: GrowPlanScore[] = [];
  const plains = rankPlains(ctx, scores);
  const themes: { plan: ThemePlan; score: number }[] = [];
  for (const style of ctx.defs.styles) {
    const plan = themePlan(ctx, style);
    if (!plan) continue;
    const out = { style, kind: 'theme' as const, richness: 0, quality: 0, score: 0 };
    if (plan.poolMargin.margin < 1) {
      scores.push({ ...out, viable: false, margin: round2(plan.poolMargin.margin) });
      continue;
    }
    const core = themeCore(ctx, plan);
    if (!core.ok) {
      scores.push({
        ...out,
        viable: false,
        margin: round2(plan.poolMargin.margin),
        note: lacksSentence(ctx.defs.compiled[plan.index]!.lacks, core.short),
      });
      continue;
    }
    // Quality of the whole deck the plan would build, as for the plain shapes.
    const full = cloneDeck(core.deck);
    fillSpells(ctx, plan, full, ctx.slots0, new Set());
    const quality = meanQuality(ctx, full);
    // With no payoff floor of its own (none, or one repeatable setup can meet)
    // there is no engine to balance: it competes as a plain shape.
    const oneSided = !(plan.floor.payoff || plan.floor.payoffWeight);
    const margin = Math.min(1, plan.poolMargin.margin / k.marginFull);
    const rich = oneSided ? 1 : richness(ctx, plan, poolTally(ctx, plan.index));
    const cmd = ctx.commander;
    const led = cmd && planJob(plan, cmd.jobs)?.as === 'payoff' ? k.commanderPlan : 1;
    const score = margin * rich * quality * led;
    const notes = [
      oneSided ? 'no payoff floor, scored as a plain shape' : '',
      led > 1 ? 'the commander rewards it' : '',
    ].filter(Boolean);
    scores.push({
      ...out,
      viable: true,
      margin: round2(margin),
      richness: round2(rich),
      quality: round2(quality),
      score: round2(score),
      ...(notes.length ? { note: notes.join('; ') } : {}),
    });
    themes.push({ plan, score });
  }
  scores.sort((a, b) => b.score - a.score || (a.style < b.style ? -1 : 1));
  themes.sort(byScore);
  const bestPlain = plains[0];
  if (!bestPlain) return [];
  const bestTheme = themes[0];
  const out: GrowBestFit[] = themes
    .filter((t) => t.score > bestPlain.score + EPS)
    .map((t) => ({
      style: t.plan.style,
      kind: 'theme',
      scores,
      reason: `${t.plan.style} scored ${round2(t.score)}, above the best plain shape (${bestPlain.plan.style}, ${round2(bestPlain.score)})`,
    }));
  for (const p of plains)
    out.push({
      style: p.plan.style,
      kind: 'plain',
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

// ---------------------------------------------------------------- steps 6 and 7

/** Main color by pips in the deck; a color carrying little next to it is a splash. */
function deckColorPlan(ctx: GrowContext, d: GrowDeck): ColorPlan {
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
function fitSpells(
  ctx: GrowContext,
  plan: Plan,
  d: GrowDeck,
  slots: number,
  relaxed: Set<string>,
): void {
  // A setup copy whose loss would leave the plan's payoffs uncovered stays. Only
  // setup can uncover them, so other copies may go even when cover is already short.
  const keepsCover = (c: GrowCard) => {
    if (plan.kind !== 'theme') return true;
    const job = planJob(plan, c.jobs);
    if (job?.as !== 'setup') return true;
    const after = { ...d.plan };
    addJob(after, job, -1);
    return covered(after, plan.floor, undefined);
  };
  while (d.spells > slots) {
    let at = -1;
    let low = Infinity;
    d.curveCopies.forEach((id, i) => {
      const c = ctx.byId.get(id)!;
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
    remove(plan, d, ctx.byId.get(id)!);
  }
  if (d.spells < slots) fillCurve(ctx, plan, d, shapeFor(ctx, plan), slots, relaxed);
}

interface Built {
  d: GrowDeck;
  lands: number;
  mana: ManaBase;
  colorPlan: ColorPlan;
  relaxed: string[];
}

/** Steps 4 to 7 for one plan, or what the pool lacks to fill it. */
function buildPlan(
  ctx: GrowContext,
  plan: Plan,
  core: CoreResult | undefined,
): Built | { lacks: string } {
  const d = core ? cloneDeck(core.deck) : newDeck(ctx, plan);
  const relaxed = new Set<string>();
  const cmd = ctx.commander ? 1 : 0;

  // The land count follows the spells' mana values; settle it in a few rounds.
  let lands = ctx.template.baseLands;
  fillSpells(ctx, plan, d, ctx.size - lands - cmd, relaxed);
  let formula = lands;
  for (let round = 0; round < 3; round++) {
    formula = planLandCount(ctx.template, spellCopies(ctx, d), ctx.config.landRules.mdfc).count;
    if (formula === lands) break;
    lands = formula;
    fitSpells(ctx, plan, d, ctx.size - lands - cmd, relaxed);
  }
  lands = ctx.size - cmd - d.spells;
  const range = ctx.template.landFormula;
  // The prototype checked only the slack over the formula; the template's
  // range is a hard limit for every deck (checkBuiltDeck).
  if (lands - formula > (ctx.size >= 60 ? 2 : 1) || lands > range.max)
    return {
      lacks: `too few playable cards for a ${ctx.size}-card ${plan.archetype.label} deck (${d.spells} spells for ${ctx.size - cmd - formula} slots)`,
    };
  if (lands < range.min)
    return {
      lacks: `more theme and role cards than a ${ctx.size}-card deck has room for (${d.spells} spells)`,
    };

  const colorPlan = deckColorPlan(ctx, d);
  const spells = spellCopies(ctx, d);
  if (ctx.commander) spells.push({ facts: ctx.commander.facts, qty: 1 });
  try {
    const mana = chooseManaBase(
      lands,
      ctx.candidates,
      colorPlan,
      spells,
      ctx.config,
      ctx.settings,
      ctx.size,
      ctx.index,
    );
    return { d, lands, mana, colorPlan, relaxed: [...relaxed] };
  } catch (err) {
    if (err instanceof ManaBaseError)
      return {
        lacks: `too few lands (${err.message.replace(/^Not enough lands: /, '').replace(/\.$/, '')})`,
      };
    throw err;
  }
}

function joinWords(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

/** The finished deck and explanation, in the same shapes the classic builder returns. */
function finish(
  ctx: GrowContext,
  plan: Plan,
  built: Built,
  lead: readonly string[],
  nearest?: BuildExplanation['nearest'],
): BuildResult {
  const { d, lands, mana, colorPlan } = built;
  const { config, index, request, size } = ctx;
  const commander = ctx.commander?.card;
  const chosen = ctx.cards
    .filter((c) => have(d, c) > 0)
    .map((c) => ({ cand: c.cand, qty: have(d, c), why: d.why.get(c.id)! }));
  const landPlan = planLandCount(ctx.template, spellCopies(ctx, d), config.landRules.mdfc);
  const report = spellReport(
    plan.archetype,
    chosen,
    ctx.candidates,
    lands,
    mana,
    colorPlan,
    config,
    index,
    size,
    commander,
  );

  const notes = [...lead];
  if (plan.kind === 'theme') {
    const counts = FLOOR_KEYS.filter((k) => (plan.floor[k] ?? 0) > 0).map(
      (k) => `${FLOOR_WORDS[k]} ${round2(floorValue(d.plan, k))} of ${plan.floor[k]}`,
    );
    notes.push(`${plan.archetype.label} minimums met: ${counts.join(', ')}.`);
  }
  if (built.relaxed.length) notes.push(`To fill every slot, relaxed ${joinWords(built.relaxed)}.`);
  notes.push(...mana.notes, ...copyNotes(chosen, mana.nonbasics), ...report.roleNotes);
  notes.push(landLine(lands, landPlan, mana));

  const byName = (a: CardFacts, b: CardFacts) =>
    a.card.name < b.card.name ? -1 : a.card.name > b.card.name ? 1 : a.card.id < b.card.id ? -1 : 1;
  const cards: DeckCard[] = [...chosen]
    .sort((a, b) => byName(a.cand.facts, b.cand.facts))
    .map(({ cand, qty, why }) => {
      const dc: DeckCard = { cardId: cand.facts.card.id, qty, why };
      if (cand.printing) dc.printing = cand.printing;
      return dc;
    });
  if (commander) {
    const leadCard: DeckCard = { cardId: commander.id, qty: 1, why: 'Commander' };
    const printing = ctx.pool.entries[commander.id]?.printing;
    if (printing) leadCard.printing = printing;
    cards.unshift(leadCard);
  }
  for (const pick of mana.nonbasics) {
    const dc: DeckCard = { cardId: pick.candidate.facts.card.id, qty: pick.qty, why: pick.why };
    if (pick.candidate.printing) dc.printing = pick.candidate.printing;
    cards.push(dc);
  }
  checkBuiltDeck(cards, mana.basics, lands, request, ctx.colors, commander, config, index);

  const explanation: BuildExplanation = {
    archetype: plan.style,
    builder: 'grow',
    ...(nearest ? { nearest } : {}),
    curve: report.curve,
    roles: report.roles,
    lands: {
      count: lands,
      averageMv: landPlan.averageMv,
      cheapManaSources: landPlan.cheapManaSources,
      nonbasics: mana.nonbasics.reduce((n, p) => n + p.qty, 0),
      ...(ctx.colors.length > 1 ? { sources: mana.sources } : {}),
    },
    synergies: report.synergies,
    notes,
    score: report.score,
  };

  // The deck carries the colors its spells use, main first, as the classic builder
  // reports them; a Commander deck keeps its commander's colors.
  const order = [colorPlan.main, ...ctx.colors.filter((c) => c !== colorPlan.main)];
  const used = commander
    ? order
    : order.filter((c) => chosen.some(({ cand }) => cand.facts.card.colors.includes(c)));
  const deckColors = used.length > 0 ? used : [colorPlan.main];
  const deck: Deck = {
    id: request.id ?? '',
    name: `${commander ? commanderShortName(commander.name) : colorsLabel(deckColors)} ${plan.archetype.label} ${size}`,
    size,
    color: deckColors[0]!,
    ...(deckColors.length > 1 ? { colors: deckColors } : {}),
    archetype: plan.style,
    ...(commander ? { commander: commander.id } : {}),
    cards,
    basics: Object.fromEntries(Object.entries(mana.basics).filter(([, q]) => (q ?? 0) > 0)),
    committed: false,
    createdAt: request.createdAt ?? '',
    configVersion: configVersion(config),
    dataVersion: index.dataVersion,
    explanation,
  };
  return { deck, explanation };
}

// ---------------------------------------------------------------- routing and the nearest rule

/**
 * Whether buildDeck sends a request here: a style the player asked for by
 * name (`requireStyle`), no secondary style, 60, 40, or 100 cards, and a
 * theme the rules describe at that size or a plain shape. Tribes, best fit,
 * 20-card packets, and styles picked internally keep the classic builder.
 */
export function growBuilds(request: BuildRequest, config: BulkBrewConfig): boolean {
  const { style, size } = request;
  if (!style || request.requireStyle !== true || request.secondary) return false;
  if (size !== 60 && size !== 40 && size !== 100) return false;
  if (tribeOf(style)) return false;
  if ((PLAIN_SHAPES as readonly string[]).includes(style))
    return archetypeOf(config, style)?.kind === 'composition';
  const defs = defsFor(config);
  const i = defs.styles.indexOf(style);
  return i >= 0 && floorsFor(defs, i, size) !== undefined;
}

type ThemeTry = { plan: ThemePlan; built: Built } | { lacks: string };

/** A themed style built, or what the pool lacks for it in a phrase a player reads. */
function tryTheme(ctx: GrowContext, style: string): ThemeTry {
  const plan = themePlan(ctx, style);
  if (!plan) return { lacks: 'no rules for this style at this size' };
  const lacks = ctx.defs.compiled[plan.index]!.lacks;
  if (plan.poolMargin.margin < 1 - EPS)
    return {
      lacks: lacksSentence(
        lacks,
        shortOf(poolTally(ctx, plan.index), sideTargets(plan.floor, FLOOR_KEYS, 1)),
      ),
    };
  const core = themeCore(ctx, plan);
  if (!core.ok) return { lacks: lacksSentence(lacks, core.short) };
  const built = buildPlan(ctx, plan, core);
  return 'lacks' in built ? built : { plan, built };
}

/**
 * The grow builder for a request growBuilds accepts. A theme the pool
 * supports is built to its floors. One it cannot support gets the nearest
 * deck: the first style of its `kin` list in the rules that the pool can
 * build, else the classic best fit, or a plain shape when that best fit
 * would carry the asked-for name, with a note saying what the pool lacks.
 * A plain shape is built as its curve, roles, and type mix; on a pool too
 * thin for this builder's fill it goes to the classic builder, as before.
 */
export function buildGrowDeck(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildResult {
  const ctx = growContext(request, pool, index, config);
  const scan = scanCandidates(ctx.candidates, config, ctx.settings, ctx.size, ctx.colors);
  if (!scan.possible)
    throw new BuildError(
      `Not enough ${colorsLabel(ctx.colors)} cards for a ${ctx.size}-card deck: ${scan.notes.join('; ')}.`,
    );
  const style = request.style!;
  if ((PLAIN_SHAPES as readonly string[]).includes(style)) {
    const plan = plainPlan(ctx, style)!;
    const built = buildPlan(ctx, plan, undefined);
    if ('lacks' in built) return buildClassic(request, pool, index, config);
    return finish(ctx, plan, built, [`Built ${plan.archetype.label} as asked.`]);
  }

  const asked = tryTheme(ctx, style);
  const label = archetypeOf(config, style)!.label;
  if ('built' in asked) return finish(ctx, asked.plan, asked.built, [`Built ${label} as asked.`]);

  const nearest = { requested: style, lacks: asked.lacks };
  const why = `Asked for ${label}: your bulk list has ${asked.lacks}.`;
  const defs = ctx.defs;
  for (const kin of defs.compiled[defs.styles.indexOf(style)]!.kin) {
    if (!defs.styles.includes(kin)) continue;
    const next = tryTheme(ctx, kin);
    if ('built' in next)
      return finish(
        ctx,
        next.plan,
        next.built,
        [`${why} Built ${next.plan.archetype.label} instead.`],
        nearest,
      );
  }
  // No kin to build: today's best fit, same colors, settings, and commander.
  const { style: _style, requireStyle: _required, ...rest } = request;
  const fit = buildClassic(rest, pool, index, config);
  if (fit.deck.archetype === style) {
    // Today's matchers read the pool as the very style the rules find short, so that
    // deck would carry the asked-for name without the cards. The plain shape this
    // pool fills best is the nearest honest deck.
    for (const { plan } of rankPlains(ctx)) {
      const shape = buildPlan(ctx, plan, undefined);
      if (!('lacks' in shape))
        return finish(ctx, plan, shape, [`${why} Built ${plan.archetype.label} instead.`], nearest);
    }
    // Too thin for this builder's fill: the classic builder's shapes, as for a shape asked
    // for by name. Never the classic deck under the asked-for name.
    for (const shape of PLAIN_SHAPES) {
      let classic: BuildResult;
      try {
        classic = buildClassic({ ...rest, style: shape, requireStyle: true }, pool, index, config);
      } catch (err) {
        if (err instanceof BuildError) continue;
        throw err;
      }
      return withNote(
        classic,
        nearest,
        `${why} Built ${archetypeOf(config, shape)!.label} instead.`,
      );
    }
    throw new BuildError(`Not enough cards to build ${label}: your bulk list has ${asked.lacks}.`);
  }
  return withNote(
    fit,
    nearest,
    `${why} Built ${secondaryLabel(config, fit.deck.archetype)} instead, the best fit for this bulk list.`,
  );
}

/** A classic deck answering a request for another style: the note first, and what was asked. */
function withNote(
  r: BuildResult,
  nearest: NonNullable<BuildExplanation['nearest']>,
  note: string,
): BuildResult {
  const explanation: BuildExplanation = {
    ...r.explanation,
    nearest,
    notes: [note, ...r.explanation.notes],
  };
  return { deck: { ...r.deck, explanation }, explanation };
}
