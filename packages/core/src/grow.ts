// The grow builder (seed and grow), for every deck at 60, 40, 20, and 100
// cards but secondary styles: best fit, a theme the rules describe (under a
// commander, the tribes it names too), or Aggro, Midrange, or Control. It
// builds the way a person does: check the plan
// against honest counts (config/theme-rules.json), seed the payoffs the pool
// supports, grow setup to what they demand, add interaction and card advantage
// to the role minimums, fill the curve slot by slot, then build the mana. A
// style the pool cannot support is answered with a note and the nearest deck
// it can build. The plan picker (pickScore) scores every finished deck with
// one number, which ranks best fit, the Build page's options, and the Analyze
// pane alike. Ported from the review prototype b-grow (docs/review/proto-b.md);
// its constants live in config/builder-weights.json under `grow` and `picker`.
// Deterministic: candidates are walked in card id order and ties go to
// strength, then id.

import {
  buildClassic,
  BuildError,
  checkBuiltDeck,
  commanderFor,
  commanderShortName,
  copyNotes,
  creditCommander,
  curveTargets,
  curveWhy,
  FILLER_WHY,
  landLine,
} from './builder.ts';
import { themeSynergyLines } from './deck-themes.ts';
import { withoutLearned } from './learned.ts';
import { canBeCommander } from './matchers.ts';
import {
  addSupply,
  cardNeeds,
  cardSupply,
  cardSupport,
  creditEarned,
  creditNeeds,
  deckSupply,
  effectiveManaValue,
  feedResources,
  needMet,
  needThreshold,
  positiveCredits,
  refSupplies,
  strengthCredit,
  themeAbilities,
  themeCredit,
  themeOwnResources,
  themeStyleOf,
  typalTypes,
  unmetDrawback,
  type DeckSupply,
  type NeedRef,
} from './card-needs.ts';
import {
  bucketOf,
  factsFor,
  listCandidates,
  type Candidate,
  type CardFacts,
} from './candidates.ts';
import { creditsFor, unsupportedCards } from './deck-credits.ts';
import { cardStrength } from './strength.ts';
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
import { scanPossible, secondaryLabel, TRIBAL, tribalArchetype, tribeOf } from './scan.ts';
import {
  matchCard,
  themeRulesFor,
  tribeBulkOf,
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
  FloorCount,
  PickScore,
  Pool,
  Settings,
} from './types.ts';

/**
 * The plain shapes in the picker's tie order: plans whose scores tie (to
 * `picker.scoreStep`) go to Midrange, the templates' default shape, then
 * Aggro, then Control, then the themes by style id.
 */
export const PLAIN_SHAPES = ['midrange', 'aggro', 'control'] as const;

/** A plan's place among plans whose scores tie: the plain shapes in order, then every theme. */
export function planOrder(style: string): number {
  const i = (PLAIN_SHAPES as readonly string[]).indexOf(style);
  return i >= 0 ? i : PLAIN_SHAPES.length;
}

/** Best score first; a tie goes by planOrder, then style id. */
export function byPlanScore(
  a: { style: string; score: number },
  b: { style: string; score: number },
): number {
  return (
    b.score - a.score ||
    planOrder(a.style) - planOrder(b.style) ||
    (a.style < b.style ? -1 : a.style > b.style ? 1 : 0)
  );
}
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
  /** It also met a job of the other side, as a lord of a type is a creature of it. */
  dual: boolean;
}

interface Tally extends ThemeTally {
  /** Payoff units that also met a setup job: they supply the other payoffs where the style says so. */
  supplied: number;
}

function emptyTally(): Tally {
  return {
    setupUnits: 0,
    setupWeight: 0,
    repeatable: 0,
    payoffUnits: 0,
    payoffWeight: 0,
    supplied: 0,
  };
}

/** Count `copies` of a card's job for a style, each card once, as the floors measure it. */
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
    if (job.dual) t.supplied += units;
  }
}

// ---------------------------------------------------------------- definitions

interface Defs {
  /** Synergy archetype ids the rules describe, in config order, then the request's tribes. */
  styles: readonly string[];
  compiled: readonly CompiledStyle[];
  /** With tribes: the rules' own styles alone, which every request has and `styles` starts with. */
  root?: Defs;
}

const defsCache = new WeakMap<BulkBrewConfig, Map<string, Defs>>();

/**
 * The themes a request plans with: the rules' styles, and after them the
 * tribes given (style ids such as "tribal:Elf", a commander's named tribes).
 */
function defsFor(config: BulkBrewConfig, tribes: readonly string[] = []): Defs {
  let byKey = defsCache.get(config);
  if (!byKey) defsCache.set(config, (byKey = new Map()));
  const key = tribes.join('|');
  let defs = byKey.get(key);
  if (!defs) {
    if (key) {
      const root = defsFor(config);
      const own = tribes.filter((id) => themeStyleOf(config, id) && !root.styles.includes(id));
      defs = {
        styles: [...root.styles, ...own],
        compiled: [...root.compiled, ...own.map((id) => themeStyleOf(config, id)!)],
        root,
      };
    } else {
      const rules = themeRulesFor(config);
      const styles = config.archetypes.archetypes
        .filter((a) => a.kind === 'synergy' && rules.styles.has(a.id))
        .map((a) => a.id);
      defs = { styles, compiled: styles.map((id) => rules.styles.get(id)!) };
    }
    byKey.set(key, defs);
  }
  return defs;
}

/**
 * The tribes a commander's text names, as theme style ids ("tribal:Elf"):
 * each creature type whose Tagger tag it carries and whose tribe the rules
 * give it a payoff job for. Such a tribe leads the commander's plans.
 */
export function namedTribes(config: BulkBrewConfig, card: CardRecord): string[] {
  const out: string[] = [];
  for (const type of typalTypes(card, config)) {
    const id = `${TRIBAL}${type}`;
    const style = themeStyleOf(config, id);
    const m = style && matchCard(card, style, 100);
    if (m && m.as === 'payoff' && m.weight > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Floor alternatives for a style at a size, one of which a deck must meet. */
function floorsFor(defs: Defs, i: number, size: DeckSize): ThemeFloor[] | undefined {
  const entry = defs.compiled[i]?.minimums?.[`${size as ThemeSize}`];
  if (!entry) return undefined;
  return Array.isArray(entry) ? entry : [entry];
}

/**
 * Synergy style ids the theme rules describe, in config order (the order of
 * themeJobsOf), then the tribes given (style ids such as "tribal:Elf").
 */
export function themeStyles(
  config: BulkBrewConfig,
  tribes: readonly string[] = [],
): readonly string[] {
  return defsFor(config, tribes).styles;
}

/** A style's floor alternatives at a size, a tribe's too; undefined when the rules give it none there. */
export function themeFloorsOf(
  config: BulkBrewConfig,
  style: string,
  size: DeckSize,
): ThemeFloor[] | undefined {
  const defs = defsFor(config, tribeOf(style) ? [style] : []);
  const i = defs.styles.indexOf(style);
  return i < 0 ? undefined : floorsFor(defs, i, size);
}

// The scan has no card index, so jobs are cached per definitions and per card
// facts object, which factsFor already caches per index, config, and card.
const jobsCache = new WeakMap<Defs, WeakMap<CardFacts, Map<number, (Job | undefined)[]>>>();

/**
 * A card's job for each style the rules describe and each tribe given,
 * aligned with themeStyles (undefined: none, a rider, or excluded).
 * Read-only: cached per card and size.
 */
export function themeJobsOf(
  config: BulkBrewConfig,
  facts: CardFacts,
  size: DeckSize,
  tribes: readonly string[] = [],
): readonly (Job | undefined)[] {
  return jobsOf(defsFor(config, tribes), facts, size);
}

function jobsOf(defs: Defs, facts: CardFacts, size: DeckSize): (Job | undefined)[] {
  let byFacts = jobsCache.get(defs);
  if (!byFacts) jobsCache.set(defs, (byFacts = new WeakMap()));
  let bySize = byFacts.get(facts);
  if (!bySize) byFacts.set(facts, (bySize = new Map()));
  let jobs = bySize.get(size);
  if (!jobs) {
    // The rules' own styles come from their cache; only the tribes are read here.
    const root = defs.root;
    jobs = root
      ? [
          ...jobsOf(root, facts, size),
          ...defs.compiled.slice(root.styles.length).map((s) => jobIn(s, facts, size)),
        ]
      : defs.compiled.map((s) => jobIn(s, facts, size));
    bySize.set(size, jobs);
  }
  return jobs;
}

function jobIn(style: CompiledStyle, facts: CardFacts, size: DeckSize): Job | undefined {
  const m = matchCard(facts.card, style, size as ThemeSize);
  // A rider weighs 0: it is not setup.
  if (!m || m.as === 'excluded' || m.weight <= 0) return undefined;
  return { as: m.as, job: m.job, weight: m.weight, repeatable: m.repeatable, dual: m.dual };
}

// ---------------------------------------------------------------- floors

/** A tally in the measure one floor counts. */
function floorValue(t: ThemeTally, key: FloorKey): number {
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

export interface Margin {
  setup: number;
  payoff: number;
  margin: number;
}

/** Have over need on one side of a floor; Infinity when the side has no floor. */
function sideMargin(t: ThemeTally, floor: ThemeFloor, keys: readonly FloorKey[]): number {
  let m = Infinity;
  for (const k of keys) {
    const need = floor[k];
    if (need === undefined || need <= 0) continue;
    m = Math.min(m, floorValue(t, k) / need);
  }
  return m;
}

/** The smaller of the setup and payoff margins (a side without a floor does not count). */
function themeMargin(t: ThemeTally, floor: ThemeFloor): Margin {
  const setup = sideMargin(t, floor, SETUP_KEYS);
  const payoff = sideMargin(t, floor, PAYOFF_KEYS);
  const margin = Math.min(setup, payoff);
  return { setup, payoff, margin: Number.isFinite(margin) ? margin : 0 };
}

/** The floor alternative a tally meets best. */
export function bestFloor(
  t: ThemeTally,
  floors: readonly ThemeFloor[],
): { floor: ThemeFloor; margin: Margin } {
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

/**
 * Whether the setup covers the payoffs plus `extra`; a card never counts
 * toward its own need. Where the style's payoffs supply it (`supplies`, a
 * tribe), a payoff that is also setup covers the others, in setup units.
 */
function covered(t: Tally, floor: ThemeFloor, extra: Job | undefined, supplies = false): boolean {
  const b = balance(floor);
  const after = { ...t };
  addJob(after, extra, 1);
  const setup = floorValue(t, b.setup) + (supplies ? t.supplied : 0);
  return setup + EPS >= b.ratio * floorValue(after, b.payoff);
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

/** Every floor of an alternative, what the tally holds against what it asks, in floor order. */
export function floorCounts(t: ThemeTally, floor: ThemeFloor): FloorCount[] {
  const out: FloorCount[] = [];
  for (const k of FLOOR_KEYS) {
    const need = floor[k];
    if (need === undefined || need <= 0) continue;
    out.push({ floor: k, have: round2(floorValue(t, k)), need: round2(need) });
  }
  return out;
}

/** Floor names a player reads, in the builder's notes and the Roles bars. */
export const FLOOR_WORDS: Record<FloorKey, string> = {
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
  // A count short of its floor rounds down, so it never reads as met ("about 6 of 6").
  return `${phrase} (${wholeCount(worst.have, Math.floor)} of ${wholeCount(worst.need, Math.round)})`;
}

/** Units and weights can be halves; a player reads whole cards. */
function wholeCount(n: number, round: (x: number) => number): string {
  return Number.isInteger(n) ? String(n) : `about ${round(n)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- viability

/** One floor a pool misses, for the floor alternative it meets best. */
export type StyleShort = FloorCount;

/** A themed style against the rules' floors, as the scan reports it. */
export interface StyleViability {
  /** The pool meets every floor of its best alternative (margin at least 1). */
  viable: boolean;
  /** The smaller of the setup and payoff sides' have over need. */
  margin: number;
  short: StyleShort[];
  /** Every floor of the alternative the pool meets best, with the pool's counts. */
  floors: FloorCount[];
  /** What the pool lacks, as a phrase a player reads: "no repeatable way to fill the graveyard (1 of 2)". Empty when viable. */
  lacks: string;
}

/**
 * What a pool could supply a deck: every copy the builder may use of each
 * candidate, lands included, and the commander. A credit whose needs this
 * cannot meet holds in no deck the pool builds. A spell supplies it only
 * when every deck of the request can hold it (`holdable`); `everyCard`
 * counts every spell, for pricing a card's strength rather than counting
 * the jobs the scan and the builder agree on.
 */
export function poolSupply(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
  colors: readonly Color[],
  commander?: CardRecord,
  everyCard = false,
): DeckSupply {
  const supply: DeckSupply = {
    size,
    colors: [...colors],
    // A Commander deck always has one, named or not.
    commander: !!commander || isCommanderSize(size),
    counts: new Map(),
    devotion: new Map(),
  };
  // What every deck of the request holds: its colors, size, and commander.
  const base: DeckSupply = {
    ...supply,
    colors: [...colors],
    counts: new Map(),
    devotion: new Map(),
  };
  if (commander) addSupply(base, commander, 1, config);
  const unheld = new Set<string>();
  for (const c of cands) {
    if (c.facts.card.id === commander?.id) continue;
    // Without a named commander (the commander list's scan) a card that could lead is held:
    // as the commander every deck of it holds it.
    if (
      everyCard ||
      !c.facts.spell ||
      (!commander && isCommanderSize(size) && canBeCommander(c.facts.card)) ||
      holdable(c.facts.card, base, config)
    )
      addSupply(supply, c.facts.card, c.preferred, config);
    else unheld.add(c.facts.card.id);
  }
  if (commander) addSupply(supply, commander, 1, config);
  unheldOf.set(supply, unheld);
  return supply;
}

/** The spells each pool supply leaves out as not holdable, so their own jobs can count themselves. */
const unheldOf = new WeakMap<DeckSupply, ReadonlySet<string>>();

/**
 * Whether every deck of a request can hold a spell: no drawback it leaves
 * unmet and a credit it earns with only the request's colors, size,
 * commander, and the card itself. A spell that needs more to have a place
 * (Kiora, Behemoth Beckoner, whose one credit wants big creatures) supplies
 * nothing to the pool: the deck that would use its supply may not hold it,
 * and the builder could not put it there to feed another card.
 */
function holdable(card: CardRecord, base: DeckSupply, config: BulkBrewConfig): boolean {
  addSupply(base, card, 1, config);
  try {
    return cardSupport(card, base, config) === undefined;
  } finally {
    addSupply(base, card, -1, config);
  }
}

/**
 * A card's jobs that the pool could pay for: a theme job counts only when the
 * pool's supply meets its credit's needs and its drawbacks. The pool is the
 * bound: nothing is taken as met here, so Lo and Li's Noble and Lesson
 * payoffs count in no pool without Nobles or Lessons, and an Equipment
 * payoff in none without Equipment.
 */
function poolJobs(
  config: BulkBrewConfig,
  defs: Defs,
  card: CardRecord,
  jobs: readonly (Job | undefined)[],
  supply: DeckSupply,
  from = 0,
): (Job | undefined)[] {
  // A spell the pool supply leaves out still supplies itself where its job counts.
  const self = unheldOf.get(supply)?.has(card.id) ? 1 : 0;
  return withCopy(supply, card, self, config, () => {
    const styles = defs.styles;
    if (jobs.some((j, i) => j && i >= from) && unmetDrawback(card, supply, config))
      return jobs.map(() => undefined);
    return jobs.map((j, i) =>
      i >= from && j && creditEarned(card, themeCredit(styles[i]!, j.as), supply, config)
        ? j
        : undefined,
    );
  });
}

/**
 * A commander's jobs as the scan and the builder both count them: each job
 * the pool pays for, and a tribe's only where it holds in every deck of the
 * tribe (`base`: the commander, the colors, and the size), its own creature
 * type taken as met. A tribe deck promises its members and nothing else, so
 * a commander whose tribe job needs more (another type) does not count for it.
 */
function commanderJobs(
  config: BulkBrewConfig,
  defs: Defs,
  card: CardRecord,
  jobs: readonly (Job | undefined)[],
  pool: DeckSupply,
  base: DeckSupply,
  from = 0,
): (Job | undefined)[] {
  const tribes = (defs.root ?? defs).styles.length;
  return poolJobs(config, defs, card, jobs, pool, from).map((j, i) => {
    if (!j || i < tribes) return j;
    const style = defs.styles[i]!;
    const own = themeOwnResources(config, style);
    return creditEarned(card, themeCredit(style, j.as), base, config, own) ? j : undefined;
  });
}

/** The supply every deck under a commander holds: the commander, its colors, and the size. */
function commanderBase(
  size: DeckSize,
  colors: readonly Color[],
  card: CardRecord,
  config: BulkBrewConfig,
): DeckSupply {
  const base: DeckSupply = {
    size,
    colors: [...colors],
    commander: true,
    counts: new Map(),
    devotion: new Map(),
  };
  addSupply(base, card, 1, config);
  return base;
}

/**
 * A card's theme jobs, per style in themeStyles order (the tribes given
 * after the rules' styles), that a pool's supply could pay for: a
 * commander's jobs as the builder credits them.
 */
export function poolThemeJobs(
  config: BulkBrewConfig,
  facts: CardFacts,
  size: DeckSize,
  supply: DeckSupply,
  tribes: readonly string[] = [],
): readonly (Job | undefined)[] {
  const defs = defsFor(config, tribes);
  return poolJobs(config, defs, facts.card, jobsOf(defs, facts, size), supply);
}

/**
 * Each themed style the rules describe at this size, and each tribe given
 * (a commander's named tribes), the pool against its floors: every copy the
 * builder may use of each spell candidate, plus the commander's job when
 * given and its needs met. A theme card counts only when the pool could meet
 * its needs (`colors` are the deck's, for needs such as "you control a
 * Forest"; `supply` is the pool's when the caller has it). Cheap enough for
 * the scan: no deck is built. `tribesOnly` leaves the rules' styles out.
 */
export function growViability(
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  size: DeckSize,
  commander?: CardFacts,
  colors?: readonly Color[],
  supply?: DeckSupply,
  tribes: readonly string[] = [],
  tribesOnly = false,
): Record<string, StyleViability> {
  const defs = defsFor(config, tribes);
  const from = tribesOnly ? (defs.root ?? defs).styles.length : 0;
  const credit = config.builderWeights.grow.commanderCredit;
  const tallies = defs.styles.map(emptyTally);
  const deckColors =
    colors ?? normalizeColors([...new Set(cands.flatMap((c) => c.facts.card.identity))]);
  const pool = supply ?? poolSupply(cands, config, size, deckColors, commander?.card);
  for (const c of cands) {
    if (!c.facts.spell || c.facts.card.id === commander?.card.id) continue;
    poolJobs(config, defs, c.facts.card, jobsOf(defs, c.facts, size), pool, from).forEach((j, i) =>
      addJob(tallies[i]!, j, c.preferred),
    );
  }
  if (commander)
    commanderJobs(
      config,
      defs,
      commander.card,
      jobsOf(defs, commander, size),
      pool,
      commanderBase(size, deckColors, commander.card, config),
      from,
    ).forEach((j, i) => addJob(tallies[i]!, j, credit));
  const out: Record<string, StyleViability> = {};
  defs.styles.forEach((style, i) => {
    if (i < from) return;
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
      floors: floorCounts(t, floor),
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
  /** Curve slot 1 to 7 at its mana value in this pool (an "or pay" cost paid in mana without the resource); zero-drops sit in slot 1. */
  slot: number;
  /** Chance to cast it on curve in these colors (1 in one color). */
  cast: number;
  /** Strength the pool can pay for, times cast chance: quality within a slot. */
  value: number;
  /** Value over the pool's best cards of the same slot and kind: quality among its peers. */
  q: number;
  /** Job per style the pool could pay for (poolJobs), aligned with the defs' styles. */
  jobs: readonly (Job | undefined)[];
  gate: CardGate;
}

/**
 * What the card needs reader says about a card for this request, read once:
 * which credits hold in every deck the request can build, and whether its
 * roles, jobs, or place in a deck can follow the deck.
 */
interface CardGate {
  /** Roles and strength credits earned in every deck. */
  always: ReadonlySet<string>;
  /** Per style: its job holds in every deck, the theme's own resources taken as met. */
  jobsAlways: readonly boolean[];
  /**
   * Per style: a creature whose payoff job the card needs reader finds needs
   * nothing, no resource of the theme taken as met (a flying carrier for
   * Auras, a big body for Big creatures): a body any deck can play, so the
   * off-plan gate lets it in.
   */
  bodies: readonly boolean[];
  /** A drawback, or credits that may all go unearned: check the card against the deck. */
  check: boolean;
  /** Roles and jobs hold in every deck. */
  fixed: boolean;
  /** Strength effect labels the card earns only in some decks. */
  effects: string[];
  /** An additional cost payable with mana instead ("behold a Dragon or pay {1}"). */
  orPay: boolean;
}

/** The deck's supply with one more copy of a card, for a check before it goes in. */
function withCopy<T>(
  supply: DeckSupply,
  card: CardRecord,
  extra: number,
  config: BulkBrewConfig,
  f: () => T,
): T {
  if (extra === 0) return f();
  addSupply(supply, card, extra, config);
  try {
    return f();
  } finally {
    addSupply(supply, card, -extra, config);
  }
}

const gateCache = new WeakMap<CardRecord, WeakMap<BulkBrewConfig, Map<string, CardGate>>>();

/**
 * Read a card's gate against the supply every deck of the request holds (the
 * commander's, else only its colors and size). Without a commander it is
 * cached by size, colors, and which jobs the pool leaves the card.
 */
function readGate(
  config: BulkBrewConfig,
  defs: Defs,
  card: CardRecord,
  roles: readonly string[],
  jobs: readonly (Job | undefined)[],
  base: DeckSupply,
): CardGate {
  let byKey: Map<string, CardGate> | undefined;
  let key = '';
  if (base.counts.size === 0) {
    let byConfig = gateCache.get(card);
    if (!byConfig) gateCache.set(card, (byConfig = new WeakMap()));
    byKey = byConfig.get(config);
    if (!byKey) byConfig.set(config, (byKey = new Map()));
    const tribes = defs.styles.slice((defs.root ?? defs).styles.length).join('|');
    key = `${base.size}|${base.colors.join('')}|${base.commander}|${jobs.map((j) => (j ? j.as[0] : '-')).join('')}|${tribes}`;
    const hit = byKey.get(key);
    if (hit) return hit;
  }
  // Needs are monotone in the supply: met with only the commander and this card, met always.
  const gate = withCopy(base, card, 1, config, () =>
    gateWith(config, defs, card, roles, jobs, base),
  );
  byKey?.set(key, gate);
  return gate;
}

function gateWith(
  config: BulkBrewConfig,
  defs: Defs,
  card: CardRecord,
  roles: readonly string[],
  jobs: readonly (Job | undefined)[],
  base: DeckSupply,
): CardGate {
  const styles = defs.styles;
  const always = new Set<string>();
  const earns = (credit: string) => {
    const ok = creditEarned(card, credit, base, config);
    if (ok) always.add(credit);
    return ok;
  };
  let fixed = true;
  for (const r of roles) if (!earns(r)) fixed = false;
  const jobsAlways = jobs.map((j, i) => {
    const ok =
      !!j &&
      creditEarned(
        card,
        themeCredit(styles[i]!, j.as),
        base,
        config,
        themeOwnResources(config, styles[i]!),
      );
    if (j && !ok) fixed = false;
    return ok;
  });
  const creature = card.types.includes('creature');
  const bodies = jobs.map(
    (j, i) =>
      creature &&
      j?.as === 'payoff' &&
      creditEarned(card, themeCredit(styles[i]!, 'payoff'), base, config),
  );
  const effects: string[] = [];
  for (const e of config.cardStrength.effects) {
    const credit = strengthCredit(e.label);
    if (positiveCredits(card, config, base.size).includes(credit) && !earns(credit))
      effects.push(e.label);
  }
  const orPay = cardNeeds(card, config).abilities.some(
    (a) => a.shape === 'additionalCost' && a.refs.some((r) => r.orPay),
  );
  const check = cardSupport(card, base, config) !== undefined;
  return { always, jobsAlways, bodies, check, fixed, effects, orPay };
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
  commander?: {
    card: CardRecord;
    facts: CardFacts;
    /** Its jobs as the scan and the plans count them (commanderJobs). */
    jobs: readonly (Job | undefined)[];
    /** Every job the pool pays for: the finished deck counts each one it earns. */
    paid: readonly (Job | undefined)[];
    gate: CardGate;
  };
  /** The supply every deck of the request holds: its colors, size, and commander. */
  base: DeckSupply;
  /** What the pool could supply: every candidate's usable copies and the commander. */
  poolSupply: DeckSupply;
  /** Each style's own resources, which its floors count (themeOwnResources). */
  own: ReadonlySet<string>[];
  cards: GrowCard[];
  byId: Map<string, GrowCard>;
  /** Every candidate but the commander, lands included, for the mana base and the report. */
  candidates: Candidate[];
  /** Mean value of the pool's best copies per curve slot (1 to 7) and kind (0 noncreature, 1 creature). */
  levels: number[][];
  /** Every usable copy's value per curve slot and kind, best first: the picker's quality compares rank for rank. */
  peers: number[][][];
  /** Spell slots before the land formula adjusts them. */
  slots0: number;
  roleLabels: Map<string, string>;
  /** Role ids by label, to read the reasons cards were picked for. */
  roleIds: Map<string, string>;
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

/** The pool's cards for a request: legality, copies, cast chance, and jobs. */
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
  // A commander's named tribes are themes of its requests, after the rules' own.
  const defs = defsFor(config, lead ? namedTribes(config, lead) : []);
  const base: DeckSupply = {
    size,
    colors: [...colors],
    commander: !!lead,
    counts: new Map(),
    devotion: new Map(),
  };
  if (lead) addSupply(base, lead, 1, config);
  const supply = poolSupply(candidates, config, size, colors, lead);
  // Strength and "or pay" prices read every card the pool holds; jobs only what a deck can hold.
  const priceSupply = poolSupply(candidates, config, size, colors, lead, true);
  const cards: GrowCard[] = [];
  for (const cand of candidates) {
    const f = cand.facts;
    if (!f.spell) continue;
    const jobs = poolJobs(config, defs, f.card, jobsOf(defs, f, size), supply);
    const gate = readGate(config, defs, f.card, f.roles, jobs, base);
    // Picks are scored on what the pool can pay for; the finished-deck check
    // holds the deck to the rest. An "or pay" cost is paid in mana where the
    // pool lacks the resource, for the curve, the cast chance, and strength.
    const mv = gate.orPay ? effectiveManaValue(f.card, priceSupply, config) : f.card.mv;
    const priced = mv === f.card.mv ? f.card : { ...f.card, mv };
    const unearned = gate.effects.filter(
      (l) => !creditEarned(f.card, strengthCredit(l), priceSupply, config),
    );
    const strength =
      unearned.length || priced !== f.card
        ? cardStrength(priced, config.cardStrength, new Set(unearned)).score
        : f.strength;
    const p = cast(priced);
    cards.push({
      cand,
      facts: f,
      id: f.card.id,
      max: cand.preferred,
      avail: cand.available,
      slot: Math.max(1, Math.min(7, bucketOf(mv))),
      cast: p,
      value: Math.max(0, strength) * p,
      q: 0,
      jobs,
      gate,
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
  // Sorts each group in place, best first; the picker reads them as peers.
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
    defs,
    k: config.builderWeights.grow,
    template,
    base,
    poolSupply: supply,
    own: defs.styles.map((s) => themeOwnResources(config, s)),
    cards,
    byId: new Map(cards.map((c) => [c.id, c])),
    candidates,
    levels,
    peers: groups,
    slots0,
    roleLabels: new Map(config.roles.roles.map((r) => [r.id, r.label])),
    roleIds: new Map(config.roles.roles.map((r) => [r.label, r.id])),
  };
  if (lead) {
    const facts = factsFor(index, config, lead);
    // The commander's jobs count only when the deck meets its needs (see cur).
    const all = jobsOf(defs, facts, size);
    const jobs = commanderJobs(config, defs, lead, all, supply, base);
    const empty: DeckSupply = { ...base, counts: new Map(), devotion: new Map() };
    ctx.commander = {
      card: lead,
      facts,
      jobs,
      paid: poolJobs(config, defs, lead, all, supply),
      gate: readGate(config, defs, lead, facts.roles, jobs, empty),
    };
  }
  return ctx;
}

// ---------------------------------------------------------------- what the deck earns

/**
 * Whether a card earns a credit in the deck with `extra` more copies of it;
 * `assumed` resources count as met (a theme's own, for its floors). Memoized
 * until the deck next changes.
 */
function earns(
  ctx: GrowContext,
  d: GrowDeck,
  card: CardRecord,
  gate: CardGate,
  credit: string,
  extra: number,
  assumed?: ReadonlySet<string>,
): boolean {
  if (gate.always.has(credit)) return true;
  const key = `e|${card.id}|${credit}|${extra}|${assumed ? 'a' : ''}`;
  let v = d.memo.get(key);
  if (v === undefined) {
    v = withCopy(d.supply, card, extra, ctx.config, () =>
      creditEarned(card, credit, d.supply, ctx.config, assumed),
    );
    d.memo.set(key, v);
  }
  return v;
}

/** Whether a candidate earns a role in the deck once it is in. */
function earnsRole(ctx: GrowContext, d: GrowDeck, c: GrowCard, role: string, extra = 1): boolean {
  return earns(ctx, d, c.facts.card, c.gate, role, extra);
}

/**
 * Whether a card's job for a style holds in the deck: its theme credit's
 * needs met, the style's own resources taken as met (its floors count them).
 * A loose deck takes every job the pool could pay for (see themeCore).
 */
function jobOpen(ctx: GrowContext, d: GrowDeck, c: GrowCard, i: number, extra = 1): boolean {
  const j = c.jobs[i];
  if (!j) return false;
  if (d.loose || c.gate.jobsAlways[i]) return true;
  const credit = themeCredit(ctx.defs.styles[i]!, j.as);
  return earns(ctx, d, c.facts.card, c.gate, credit, extra, ctx.own[i]);
}

/** The plan job a card holds in the deck: undefined when the deck does not pay for it. */
function openPlanJob(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): Job | undefined {
  if (plan.kind !== 'theme') return undefined;
  return jobOpen(ctx, d, c, plan.index) ? c.jobs[plan.index] : undefined;
}

/**
 * Whether the deck can hold the card at all: its drawbacks met (Tragedy
 * Feaster sacrifices without lifegain) and, when the config gives it credits,
 * at least one of them earned. A card that is neither has no place. While the
 * deck is built the plan's own resources count as met, as its floors promise
 * them (payoffs go in before their setup); `honest` checks the finished deck.
 */
function supported(ctx: GrowContext, d: GrowDeck, c: GrowCard, extra = 1, honest = false): boolean {
  if (!c.gate.check) return true;
  const key = `s|${c.id}|${extra}|${honest ? 'h' : ''}`;
  const hit = d.memo.get(key);
  if (hit !== undefined) return hit;
  const card = c.facts.card;
  const own = !honest && d.planIndex >= 0 ? ctx.own[d.planIndex] : undefined;
  const planCredit = own ? `theme:${ctx.defs.styles[d.planIndex]}:` : undefined;
  const earned = (credit: string) => {
    if (planCredit && credit.startsWith(planCredit))
      return (
        (d.loose && c.jobs[d.planIndex] !== undefined) ||
        creditEarned(card, credit, d.supply, ctx.config, own)
      );
    if (c.gate.always.has(credit)) return true;
    return creditEarned(card, credit, d.supply, ctx.config);
  };
  const v =
    withCopy(d.supply, card, extra, ctx.config, () =>
      cardSupport(card, d.supply, ctx.config, earned, own),
    ) === undefined;
  d.memo.set(key, v);
  return v;
}

function archetypeOf(config: BulkBrewConfig, id: string): Archetype | undefined {
  const type = tribeOf(id);
  if (type) return tribalArchetype(type, config);
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
  /** The plan's index in the defs' styles; -1 for a plain shape. */
  planIndex: number;
  /** What the deck supplies so far: its spells and the commander (and its lands once chosen). */
  supply: DeckSupply;
  /** Contributions of cards whose roles, jobs, and slot hold in every deck, kept as they go in and out. */
  fixed: Derived;
  /** Cards whose contributions follow the deck's supply, by id. */
  cond: Set<string>;
  /** Everything counted, recomputed after a change (see cur). */
  derived?: Derived | undefined;
  /**
   * Theme jobs count as the pool could pay for them rather than as the deck
   * so far does: the theme core's second try, when the first is short because
   * a payoff's needs (ten creatures for a reanimation trigger) come from cards
   * the fill adds later. The finished-deck check holds the deck to them.
   */
  loose: boolean;
  /** Credits and support checked against the supply, until the deck next changes. */
  memo: Map<string, boolean>;
  creatures: number;
  noncreaturePermanents: number;
  instantsAndSorceries: number;
}

/** What the deck counts: only the credits it earns. */
interface Derived {
  /** Per style, aligned with the defs' styles; each style's own resources taken as met. */
  tallies: Tally[];
  /** The plan's own tally, the commander credited. */
  plan: Tally;
  /** Role copies, the commander included. */
  roles: Map<string, number>;
  /** Copies per curve slot, index 1 to 7. */
  slots: number[];
}

function emptyDerived(ctx: GrowContext): Derived {
  return {
    tallies: ctx.defs.styles.map(emptyTally),
    plan: emptyTally(),
    roles: new Map(),
    slots: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

function cloneDerived(x: Derived): Derived {
  return {
    tallies: x.tallies.map((t) => ({ ...t })),
    plan: { ...x.plan },
    roles: new Map(x.roles),
    slots: [...x.slots],
  };
}

function cloneSupply(s: DeckSupply): DeckSupply {
  return { ...s, colors: [...s.colors], counts: new Map(s.counts), devotion: new Map(s.devotion) };
}

function cloneDeck(d: GrowDeck): GrowDeck {
  return {
    qty: new Map(d.qty),
    why: new Map(d.why),
    curveCopies: [...d.curveCopies],
    seedCopies: [...d.seedCopies],
    spells: d.spells,
    planIndex: d.planIndex,
    supply: cloneSupply(d.supply),
    fixed: cloneDerived(d.fixed),
    cond: new Set(d.cond),
    loose: d.loose,
    memo: new Map(),
    creatures: d.creatures,
    noncreaturePermanents: d.noncreaturePermanents,
    instantsAndSorceries: d.instantsAndSorceries,
  };
}

/** One card's contribution: its jobs (scaled by `jobCopies`), roles, and slot, as `ok` says they hold. */
function contribute(
  ctx: GrowContext,
  x: Derived,
  planIndex: number,
  jobs: readonly (Job | undefined)[],
  roles: readonly string[],
  copies: number,
  jobCopies: number,
  slot: number | undefined,
  ok: (credit: string, i?: number) => boolean,
): void {
  jobs.forEach((j, i) => {
    if (!j || !ok(themeCredit(ctx.defs.styles[i]!, j.as), i)) return;
    addJob(x.tallies[i]!, j, jobCopies);
    if (i === planIndex) addJob(x.plan, j, jobCopies);
  });
  for (const r of roles) if (ok(r)) x.roles.set(r, (x.roles.get(r) ?? 0) + copies);
  if (slot !== undefined) x.slots[slot]! += copies;
}

/**
 * What the deck counts now: the fixed cards' share, plus each card whose
 * credits follow the supply, counted for the credits it earns in this
 * deck. The commander's jobs and roles count only when the deck meets its needs.
 */
function cur(ctx: GrowContext, d: GrowDeck): Derived {
  if (d.derived) return d.derived;
  const x = cloneDerived(d.fixed);
  const earnedBy =
    (card: CardRecord, gate: CardGate, loose: boolean) => (credit: string, i?: number) =>
      i === undefined
        ? earns(ctx, d, card, gate, credit, 0)
        : loose || gate.jobsAlways[i] || earns(ctx, d, card, gate, credit, 0, ctx.own[i]);
  for (const id of d.cond) {
    const c = ctx.byId.get(id)!;
    const q = have(d, c);
    contribute(
      ctx,
      x,
      d.planIndex,
      c.jobs,
      c.facts.roles,
      q,
      q,
      c.slot,
      earnedBy(c.facts.card, c.gate, d.loose),
    );
  }
  const cmd = ctx.commander;
  if (cmd && !cmd.gate.fixed)
    contribute(
      ctx,
      x,
      d.planIndex,
      cmd.jobs,
      cmd.facts.roles,
      1,
      ctx.k.commanderCredit,
      undefined,
      // The loose try counts the commander's jobs as the scan does, as it counts the cards'.
      earnedBy(cmd.card, cmd.gate, d.loose),
    );
  d.derived = x;
  return x;
}

function newDeck(ctx: GrowContext, plan: Plan, loose = false): GrowDeck {
  const d: GrowDeck = {
    loose,
    memo: new Map(),
    qty: new Map(),
    why: new Map(),
    curveCopies: [],
    seedCopies: [],
    spells: 0,
    planIndex: plan.kind === 'theme' ? plan.index : -1,
    supply: cloneSupply(ctx.base),
    fixed: emptyDerived(ctx),
    cond: new Set(),
    creatures: 0,
    noncreaturePermanents: 0,
    instantsAndSorceries: 0,
  };
  const cmd = ctx.commander;
  // The commander is there every game; the rules count it as one card.
  if (cmd?.gate.fixed)
    contribute(
      ctx,
      d.fixed,
      d.planIndex,
      cmd.jobs,
      cmd.facts.roles,
      1,
      ctx.k.commanderCredit,
      undefined,
      () => true,
    );
  return d;
}

/** The deck's supply changed: what was counted from it is stale. */
function changed(d: GrowDeck): void {
  d.derived = undefined;
  d.memo.clear();
}

function have(d: GrowDeck, c: GrowCard): number {
  return d.qty.get(c.id) ?? 0;
}

function add(ctx: GrowContext, d: GrowDeck, c: GrowCard, why: string): void {
  d.qty.set(c.id, have(d, c) + 1);
  if (!d.why.has(c.id)) d.why.set(c.id, why);
  d.spells += 1;
  addSupply(d.supply, c.facts.card, 1, ctx.config);
  changed(d);
  if (c.gate.fixed)
    contribute(ctx, d.fixed, d.planIndex, c.jobs, c.facts.roles, 1, 1, c.slot, () => true);
  else d.cond.add(c.id);
  if (c.facts.creature) d.creatures += 1;
  else if (c.facts.instantOrSorcery) d.instantsAndSorceries += 1;
  else if (c.facts.noncreaturePermanent) d.noncreaturePermanents += 1;
}

function remove(ctx: GrowContext, d: GrowDeck, c: GrowCard): void {
  const n = have(d, c) - 1;
  if (n < 0) return;
  if (n === 0) {
    d.qty.delete(c.id);
    d.why.delete(c.id);
    d.cond.delete(c.id);
  } else d.qty.set(c.id, n);
  d.spells -= 1;
  addSupply(d.supply, c.facts.card, -1, ctx.config);
  changed(d);
  if (c.gate.fixed)
    contribute(ctx, d.fixed, d.planIndex, c.jobs, c.facts.roles, -1, -1, c.slot, () => true);
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
 * resource), that style's setup covering it, unless it is a creature whose
 * payoff job needs nothing (a body any deck plays, such as Vampire Nighthawk
 * as an Auras carrier); as setup for a style whose setup does nothing
 * without its own payoffs (Ruin Crab's opponent mill), a payoff of that style
 * in the deck and no more setup than the floors' ratio.
 */
function gateOpen(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): boolean {
  const x = cur(ctx, d);
  const own = planJob(plan, c.jobs);
  if (plan.kind === 'theme' && own?.as === 'payoff' && !coversPlan(ctx, plan, x.plan, own))
    return false;
  // Setup and spell roles open the gate only when the deck pays for them.
  if (own?.as === 'setup' && openPlanJob(ctx, plan, d, c)) return true;
  if (c.facts.roles.some((r) => SPELL_JOBS.includes(r) && earnsRole(ctx, d, c, r))) return true;
  for (let i = 0; i < c.jobs.length; i++) {
    const j = c.jobs[i];
    if (!j || (plan.kind === 'theme' && i === plan.index)) continue;
    if (j.as === 'payoff') {
      if (j.weight < ctx.k.offPlanGateWeight || c.gate.bodies[i]) continue;
      const floor = offPlanFloor(ctx, i);
      if (floor && !covered(x.tallies[i]!, floor, j, ctx.defs.compiled[i]!.payoffSupplies))
        return false;
    } else if (ctx.defs.compiled[i]!.setupNeedsPayoff) {
      if (!fed(x.tallies[i]!, offPlanFloor(ctx, i), j)) return false;
    }
  }
  return true;
}

/** The last relaxation keeps only the plan's own payoff gate. */
function planGateOnly(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): boolean {
  const own = planJob(plan, c.jobs);
  return !(
    plan.kind === 'theme' &&
    own?.as === 'payoff' &&
    !coversPlan(ctx, plan, cur(ctx, d).plan, own)
  );
}

/** Whether a theme plan's setup covers its payoffs plus `extra` (covered, with the style's own rule). */
function coversPlan(ctx: GrowContext, plan: ThemePlan, t: Tally, extra: Job | undefined): boolean {
  return covered(t, plan.floor, extra, ctx.defs.compiled[plan.index]!.payoffSupplies);
}

/** 1 at a floor, fading to 0 at `target` times it. */
function fadeAbove(have: number, floor: number, target: number): number {
  const top = floor * target;
  return Math.min(1, Math.max(0, (top - have) / (top - floor)));
}

/**
 * Extra value for the plan's own cards in the role and curve fills, so the
 * deck gets some depth above its floors: setup fading out above the setup
 * floor, and payoffs the setup already covers fading out above the payoff
 * floor (a theme with no payoff floor pulls them only while covered). A
 * payoff the setup cannot feed gets no pull; the gate keeps it out anyway.
 */
function planPull(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard): number {
  if (plan.kind !== 'theme') return 1;
  const job = planJob(plan, c.jobs);
  if (!job || !openPlanJob(ctx, plan, d, c)) return 1;
  const b = balance(plan.floor);
  const x = cur(ctx, d).plan;
  if (job.as === 'setup') {
    const floor = plan.floor[b.setup] ?? 0;
    if (floor <= 0) return 1;
    const fade = fadeAbove(floorValue(x, b.setup), floor, ctx.k.setupTarget);
    return 1 + ctx.k.setupPull * Math.min(1, job.weight) * fade;
  }
  if (!coversPlan(ctx, plan, x, job)) return 1;
  const floor = plan.floor[b.payoff] ?? 0;
  const fade = floor > 0 ? fadeAbove(floorValue(x, b.payoff), floor, ctx.k.setupTarget) : 1;
  return 1 + ctx.k.payoffPull * Math.min(1, job.weight) * fade;
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
 * A theme card goes in only on a job the deck so far pays for, its theme's
 * own resources aside; when that leaves the floors short, a second try takes
 * each job the pool could pay for (the scan's view), and the finished-deck
 * check holds the deck to the rest.
 */
function themeCore(ctx: GrowContext, plan: ThemePlan): CoreResult {
  const strict = themeCoreOnce(ctx, plan, false);
  if (strict.ok) return strict;
  const loose = themeCoreOnce(ctx, plan, true);
  return loose.ok ? loose : strict;
}

function themeCoreOnce(ctx: GrowContext, plan: ThemePlan, loose: boolean): CoreResult {
  const d = newDeck(ctx, plan, loose);
  const jobOf = (c: GrowCard) => c.jobs[plan.index];
  // Theme cards go where the curve has room, as a person would pick a cheap looter over a dear one.
  const targets = curveTargets(shapeFor(ctx, plan).shape, ctx.slots0);
  const room = (c: GrowCard) => {
    const slot = c.slot;
    return cur(ctx, d).slots[slot]! < (targets[slot] ?? 0) ? 1 : ctx.k.fullSlot;
  };
  // A theme card enters on its job only when the deck pays for it, the theme's own resources aside.
  // The loose try takes it as the scan's pool count does, without checking its drawbacks against
  // the few cards picked so far (Frightcrawler's threshold); the finished-deck check holds it to them.
  const open = (c: GrowCard, as: Job['as']) =>
    have(d, c) < c.max &&
    jobOf(c)?.as === as &&
    jobOpen(ctx, d, c, plan.index) &&
    (loose || supported(ctx, d, c));
  const rich = plan.poolMargin.setup >= 2 && plan.poolMargin.payoff >= 2;
  const payoffTargets = sideTargets(plan.floor, PAYOFF_KEYS, rich ? ctx.k.richSeed : 1);
  for (;;) {
    if (met(cur(ctx, d).plan, payoffTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => open(c, 'payoff'),
      (c) => gain(cur(ctx, d).plan, jobOf(c), payoffTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(ctx, d, pick, `Payoff: ${jobOf(pick)!.job}`);
    d.seedCopies.push(pick.id);
  }

  const b = balance(plan.floor);
  const payoffNeed = plan.floor[b.payoff] ?? 0;
  const scale =
    payoffNeed > 0 ? Math.max(1, floorValue(cur(ctx, d).plan, b.payoff) / payoffNeed) : 1;
  // Repeatable setup counts toward a floor of repeatable setup or payoffs (Burn's), as the scan counts it.
  const setupTargets = {
    ...sideTargets(plan.floor, SETUP_KEYS, scale),
    ...sideTargets(plan.floor, ['repeatableOrPayoff'], 1),
  };
  for (;;) {
    if (met(cur(ctx, d).plan, setupTargets)) break;
    const pick = best(
      ctx.cards,
      (c) => open(c, 'setup'),
      (c) => gain(cur(ctx, d).plan, jobOf(c), setupTargets) * (c.q + EPS) * room(c),
    );
    if (!pick) break;
    add(ctx, d, pick, `Setup: ${jobOf(pick)!.job}`);
  }

  // Setup ran out: drop the weakest seeded payoffs while above the floor and uncovered.
  const floorTargets = sideTargets(plan.floor, PAYOFF_KEYS, 1);
  while (!coversPlan(ctx, plan, cur(ctx, d).plan, undefined)) {
    const seeded = [...new Set(d.seedCopies)]
      .map((id) => ctx.byId.get(id)!)
      .sort((x, y) => x.value - y.value || (x.id < y.id ? -1 : 1));
    const drop = seeded.find((c) => {
      const after = { ...cur(ctx, d).plan };
      addJob(after, jobOf(c), -1);
      return met(after, floorTargets);
    });
    if (!drop) break;
    remove(ctx, d, drop);
    d.seedCopies.splice(d.seedCopies.lastIndexOf(drop.id), 1);
  }

  const minimum = sideTargets(plan.floor, FLOOR_KEYS, 1);
  const ok = met(cur(ctx, d).plan, minimum);
  return { deck: d, ok, short: ok ? [] : shortOf(cur(ctx, d).plan, minimum) };
}

// ---------------------------------------------------------------- steps 4 and 5

interface Shape {
  quotas: Record<string, RoleQuota>;
  shape: number[];
  typeMix: TypeMix;
}

function shapeFor(ctx: GrowContext, plan: { archetype: Archetype }): Shape {
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
 * The creature share the curve fill takes creatures first to. A plain shape
 * aims into its range (`grow.creatureFill`), so Control holds the ground with
 * creatures as bulk control decks do; a theme keeps its minimum, leaving the
 * rest to its own cards.
 */
function creatureShare(ctx: GrowContext, plan: { kind: string }, mix: TypeMix): number {
  if (plan.kind !== 'plain') return mix.creatureMin;
  return mix.creatureMin + ctx.k.creatureFill * (mix.creatureMax - mix.creatureMin);
}

/**
 * Step 4: each role to its minimum, a card competing only with cards of the
 * same role, by value. Cards already in the deck count for every role they fill.
 */
function fillRoles(ctx: GrowContext, plan: Plan, d: GrowDeck, shape: Shape, slots: number): void {
  for (const [role, q] of Object.entries(shape.quotas)) {
    while ((cur(ctx, d).roles.get(role) ?? 0) < q.min && d.spells < slots) {
      // A card fills a role slot only on a role it earns in this deck.
      const pick = best(
        ctx.cards,
        (c) =>
          c.facts.roles.includes(role) &&
          have(d, c) < c.max &&
          earnsRole(ctx, d, c, role) &&
          supported(ctx, d, c) &&
          gateOpen(ctx, plan, d, c),
        (c) => c.value * planPull(ctx, plan, d, c),
      );
      if (!pick) break;
      add(ctx, d, pick, ctx.roleLabels.get(role) ?? role);
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
  'the rule that keeps out cards this deck cannot use',
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
  const creatureFirst = creatureShare(ctx, plan, mix);
  const empty = new Set<number>();
  // 0 slot rules, 1 any slot, 2 type mix caps off, 3 copy guideline off, 4 off-plan gate off,
  // 5 cards the deck does not support (the finished-deck check swaps them out where it can).
  let level = 0;
  const copies = (c: GrowCard) => (level >= 3 ? c.avail : c.max);
  while (d.spells < slots) {
    const left = slots - d.spells;
    const mustSpell = spellMin - d.instantsAndSorceries >= left;
    const wantCreature = d.creatures < creatureFirst * (d.spells + 1);
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
      (level >= 5 || supported(ctx, d, c)) &&
      (level >= 4 ? planGateOnly(ctx, plan, d, c) : gateOpen(ctx, plan, d, c));
    let slot = -1;
    let gap = 0;
    if (level === 0) {
      for (let s = 1; s <= 7; s++) {
        const g = (targets[s] ?? 0) - cur(ctx, d).slots[s]!;
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
    const score = (c: GrowCard) => (slot >= 0 ? c.value : c.q) * planPull(ctx, plan, d, c);
    const pick =
      (wantCreature
        ? best(ctx.cards, (c) => base(c) && inSlot(c) && c.facts.creature, score)
        : undefined) ?? best(ctx.cards, (c) => base(c) && inSlot(c), score);
    if (!pick) {
      if (slot >= 0) empty.add(slot);
      else if (level < RELAXATIONS.length - 1) {
        const name = RELAXATIONS[++level]!;
        if (name) relaxed.add(name);
      } else break;
      continue;
    }
    add(ctx, d, pick, slot >= 0 ? curveWhy(slot) : FILLER_WHY);
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

// ---------------------------------------------------------------- the plan picker (phase 2)

/**
 * The finished deck against its shape's template: the share of the role
 * minimums, the curve slots within the template's tolerance, and the
 * creature count the curve fill aims for, that the deck reaches. Roles count
 * only where earned, the commander included. Role targets stay out: the
 * fill builds to the minimums, and a shape with small targets would reach
 * them more easily than one with large ones.
 */
function shapeFit(
  ctx: GrowContext,
  plan: { kind: string; archetype: Archetype },
  d: GrowDeck,
): number {
  const shape = shapeFor(ctx, plan);
  const x = cur(ctx, d);
  const slots = d.spells;
  let got = 0;
  let want = 0;
  for (const [role, q] of Object.entries(shape.quotas)) {
    got += Math.min(x.roles.get(role) ?? 0, q.min);
    want += q.min;
  }
  const targets = curveTargets(shape.shape, slots);
  const tol = ctx.template.tolerances.curve;
  for (let s = 1; s <= 7; s++) {
    got += Math.min(x.slots[s]! + tol, targets[s] ?? 0);
    want += targets[s] ?? 0;
  }
  const creatures = Math.round(creatureShare(ctx, plan, shape.typeMix) * slots);
  got += Math.min(d.creatures, creatures);
  want += creatures;
  return want > 0 ? got / want : 1;
}

/**
 * What a plan costs in card quality. Each copy is compared with the pool's
 * copies of the same mana value and kind (a creature or a spell) rank for
 * rank: the deck's best two-drop creature with the pool's best, its tenth
 * with the pool's tenth. A deck that plays the best cards for each slot it
 * uses scores 1 however many it needs (an Aggro deck's dozen cheap
 * creatures), while a weak card a plan forces in over better ones of its
 * slot and kind costs it. A copy beyond the pool's usual copies (a thin
 * pool's last relaxation) is compared with the slot's last peer.
 */
function deckQuality(ctx: GrowContext, d: GrowDeck): number {
  const mine: number[][][] = Array.from({ length: 8 }, () => [[], []]);
  for (const c of ctx.cards)
    for (let i = have(d, c); i > 0; i--) mine[c.slot]![c.facts.creature ? 1 : 0]!.push(c.value);
  let total = 0;
  let n = 0;
  for (let s = 1; s <= 7; s++)
    for (const kind of [0, 1]) {
      const peers = ctx.peers[s]![kind]!;
      mine[s]![kind]!.sort((a, b) => b - a).forEach((v, i) => {
        const ref = peers[Math.min(i, peers.length - 1)] ?? 0;
        total += ref > EPS ? Math.min(1, v / ref) : 1;
        n++;
      });
    }
  return n > 0 ? total / n : 0;
}

/** The payoff measure a floor counts: payoff weight, payoff cards, or repeatable setup or payoff cards (Burn). */
function payoffMeasure(floor: ThemeFloor): PayoffKey {
  if (floor.payoffWeight !== undefined) return 'payoffWeight';
  if (floor.payoff !== undefined) return 'payoff';
  return floor.repeatableOrPayoff !== undefined ? 'repeatableOrPayoff' : 'payoff';
}

/**
 * How far the pool's setup and payoff stand above what plain bulk of the same
 * cards' colors holds (config/theme-bulk.json, a tribe's under `tribes`), the
 * smaller of the two, each side in the measure its floor counts; 1 when no
 * baseline is bundled. A
 * ratio of counts is noisy: a side counts above 1 only beyond its own noise,
 * `picker.richnessZ` over the square root of the theme cards plain bulk of
 * these colors would hold (distinct cards, not copies), so a theme a few
 * dozen cards carry in this pool cannot lead on chance (plain bulk reads up
 * to about 1.3 to 1.8 by chance where the expected count is small).
 */
function richness(ctx: GrowContext, plan: ThemePlan, pool: Tally): number {
  const type = tribeOf(plan.style);
  const bulk = type
    ? tribeBulkOf(ctx.config.themeBulk, type)
    : ctx.config.themeBulk?.styles[plan.style];
  if (!bulk) return 1;
  const expected = emptyTally();
  const distinct = emptyTally();
  for (const c of ctx.cards) {
    const per = bulk[colorClassOf(c.facts.card)];
    for (const [t, n] of [
      [expected, c.max],
      [distinct, 1],
    ] as const) {
      t.setupUnits += per.setupUnits * n;
      t.setupWeight += per.setupWeight * n;
      t.repeatable += per.repeatable * n;
      t.payoffUnits += per.payoffUnits * n;
      t.payoffWeight += per.payoffWeight * n;
    }
  }
  const z = ctx.config.builderWeights.picker.richnessZ;
  const b = balance(plan.floor);
  const sides: [FloorKey, number][] = [[b.setup, distinct.setupUnits]];
  if (Number.isFinite(plan.poolMargin.payoff)) {
    const k = payoffMeasure(plan.floor);
    sides.push([k, k === 'repeatableOrPayoff' ? floorValue(distinct, k) : distinct.payoffUnits]);
  }
  let r = Infinity;
  for (const [k, cards] of sides) {
    const e = floorValue(expected, k);
    // Plain bulk of these colors holds none: no evidence the pool is richer.
    if (e <= 0) {
      r = Math.min(r, 1);
      continue;
    }
    const ratio = floorValue(pool, k) / e;
    r = Math.min(r, ratio <= 1 ? ratio : Math.max(1, ratio - z / Math.sqrt(Math.max(cards, EPS))));
  }
  return Math.min(r, ctx.k.richnessCap);
}

/**
 * How far the commander leads a theme plan: 1 unless its own job for the
 * theme is a payoff; then up to `grow.commanderPlan` by how central the theme
 * is to its own text, not by how rare the theme's payoffs are in the pool:
 * the share of its text abilities (keyword lines aside) that do the theme's
 * work, setup or payoff, as the card needs reader ties the rules to their
 * clauses (themeAbilities), times its payoff job's weight up to 1. Lathril
 * makes Elf tokens and taps Elves, all of its text, so it leads its Elf tribe
 * in full; its own combat damage trigger, an Evasion payoff, is half of its
 * text. A theme only its body serves (an evasive carrier's keyword) leads
 * only a commander with no other text. The payoff job is the one the pool
 * pays for, whatever else it needs beside the theme's own resource (Adeliz's
 * Wizards need instants and sorceries too).
 */
function commanderLead(ctx: GrowContext, plan: Plan): number {
  const cmd = ctx.commander;
  const job = plan.kind === 'theme' ? cmd?.paid[plan.index] : undefined;
  if (!cmd || job?.as !== 'payoff') return 1;
  const central = commanderTextShare(ctx.config, cmd.card, plan.style, ctx.size);
  return 1 + (ctx.k.commanderPlan - 1) * central * Math.min(1, job.weight);
}

/**
 * How central a theme is to a card's own text: the share of its text
 * abilities (keyword lines aside, a modal bullet as its ability) whose clauses
 * do the theme's work, setup or payoff (themeAbilities). A card with no text
 * besides its body and keywords counts 1 when they do the work, else 0.
 */
export function commanderTextShare(
  config: BulkBrewConfig,
  card: CardRecord,
  style: string,
  size: DeckSize,
): number {
  const needs = cardNeeds(card, config);
  const root = (i: number) => needs.abilities[i]?.parent ?? i;
  const text = new Set<number>();
  needs.abilities.forEach((a, i) => {
    if (a.shape !== 'keyword') text.add(root(i));
  });
  const work = themeAbilities(card, style, config, size);
  const read = new Set(work.abilities.map(root).filter((i) => text.has(i)));
  // A keyword line does a theme's work as the body does.
  const body = work.body || work.abilities.some((i) => !text.has(root(i)));
  return text.size > 0 ? read.size / text.size : body ? 1 : 0;
}

/** How far a side stands above its floor: 0 at the floor, 1 at `picker.depthFull` times it. */
function deepShare(ctx: GrowContext, have: number, need: number): number {
  if (need <= 0) return 1;
  const full = ctx.config.builderWeights.picker.depthFull;
  return Math.min(1, Math.max(0, (have / need - 1) / (full - 1)));
}

/**
 * A theme deck's depth: each side (setup, and payoff where the floors ask
 * for payoffs) left at its bare floor costs `picker.depthWeight` of the
 * score, nothing once it reaches `picker.depthFull` times the floor. The
 * phase 1 panel found decks at their floors decent only about half the time,
 * failing on thin payoffs.
 */
function themeDepth(ctx: GrowContext, plan: ThemePlan, t: Tally): number {
  const w = ctx.config.builderWeights.picker.depthWeight;
  const b = balance(plan.floor);
  let depth = 1 - w * (1 - deepShare(ctx, floorValue(t, b.setup), plan.floor[b.setup] ?? 0));
  const p = payoffMeasure(plan.floor);
  const payoffNeed = plan.floor[p] ?? 0;
  if (payoffNeed > 0) depth -= w * (1 - deepShare(ctx, floorValue(t, p), payoffNeed));
  return depth;
}

/** The deck's spells and lands as a GrowDeck of this request, so any finished deck is scored the same way. */
function deckFor(ctx: GrowContext, plan: Plan, deck: Deck): GrowDeck {
  const d = newDeck(ctx, plan);
  for (const dc of deck.cards) {
    if (dc.cardId === ctx.commander?.card.id) continue;
    const c = ctx.byId.get(dc.cardId);
    if (c) for (let i = 0; i < dc.qty; i++) add(ctx, d, c, dc.why ?? FILLER_WHY);
    else {
      const card = ctx.index.get(dc.cardId);
      if (card) addSupply(d.supply, card, dc.qty, ctx.config);
    }
  }
  changed(d);
  return d;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * The share of the deck's spells (the commander included) its mana base
 * casts on curve: each copy's chance to have the sources its pips ask for by
 * the turn of its mana value, given the land drops, from the lands the deck
 * records per color. 1 for a deck of one color, whose every land makes it.
 * Quality is measured within one color set's own pool, so this is what keeps
 * a deck of more colors from ranking above a one-color deck on as good cards.
 */
function castShare(ctx: GrowContext, deck: Deck): number {
  const lands = deck.explanation?.lands;
  const colors = deck.colors ?? [deck.color];
  if (!lands?.sources || colors.length < 2) return 1;
  const size = ctx.size;
  const onDraw = isCommanderSize(size) ? 1 : 0;
  const memo = new Map<string, number>();
  let total = 0;
  let n = 0;
  for (const dc of deck.cards) {
    const card = ctx.index.get(dc.cardId);
    if (!card || !factsFor(ctx.index, ctx.config, card).spell) continue;
    const dem = pipDemand(card, colors);
    const turn = Math.max(1, Math.min(10, Math.ceil(card.mv)));
    const seen = Math.min(size, 7 + turn - 1 + onDraw);
    let p = 1;
    for (const c of colors) {
      const pips = dem[c] ?? 0;
      if (pips === 0) continue;
      const src = Math.min(lands.count, lands.sources[c] ?? 0);
      const key = `${src}:${pips}:${turn}`;
      let q = memo.get(key);
      if (q === undefined)
        memo.set(key, (q = castChance(size, lands.count, src, seen, turn, pips)));
      p *= q;
    }
    total += p * dc.qty;
    n += dc.qty;
  }
  return n > 0 ? total / n : 1;
}

/**
 * The plan picker's one score for a finished deck, whatever built it:
 * quality times fit times the share of supported copies, times the share of
 * spells its mana casts on curve to `picker.castWeight`, times
 * (1 - `picker.colorCost`) for each color the request's color set has past
 * the first (none under a commander). A theme, a commander's tribe among
 * them, multiplies in its pool margin (full at `grow.marginFull`), its
 * richness over plain bulk (capped; a tribe's read from its type's own
 * baseline), its depth above the floors, and the commander's lead
 * (commanderLead), and is divided by `picker.themeMargin`, so it ranks above
 * a plain shape only by that clear margin and never on richness noise. The
 * score is rounded to `picker.scoreStep`, below which the parts do not tell
 * decks apart, and plans that tie go by planOrder (Midrange first).
 */
function pickScore(ctx: GrowContext, plan: Plan, deck: Deck): PickScore {
  const d = deckFor(ctx, plan, deck);
  const quality = deckQuality(ctx, d);
  const fit = shapeFit(ctx, plan, d);
  let unsupported = 0;
  for (const u of unsupportedCards(deck, ctx.index, ctx.config)) unsupported += u.qty;
  const clean = d.spells > 0 ? Math.max(0, 1 - unsupported / d.spells) : 0;
  const picker = ctx.config.builderWeights.picker;
  const cast = castShare(ctx, deck);
  const out: PickScore = {
    score: 0,
    quality: round3(quality),
    fit: round3(fit),
    clean: round3(clean),
    cast: round3(cast),
  };
  // Quality, fit, depth, and margin are measured within the color set's own pool, which grows
  // with every color the set adds: across sets (the Analyze pane, the options of smaller
  // subsets) each extra color costs colorCost. A commander's colors are not a choice.
  const extra = ctx.commander ? 0 : ctx.colors.length - 1;
  const colorFactor = (1 - picker.colorCost) ** extra;
  if (extra > 0) out.colors = round3(colorFactor);
  let score = quality * fit * clean * cast ** picker.castWeight * colorFactor;
  if (plan.kind === 'theme') {
    const k = ctx.k;
    const margin = Math.min(1, plan.poolMargin.margin / k.marginFull);
    const rich = richness(ctx, plan, poolTally(ctx, plan.index));
    const depth = themeDepth(ctx, plan, honestPlan(ctx, plan, d));
    const lead = commanderLead(ctx, plan);
    score *= (margin * rich * depth * lead) / picker.themeMargin;
    Object.assign(out, {
      margin: round3(margin),
      richness: round3(rich),
      depth: round3(depth),
      ...(lead > 1 ? { lead: round3(lead) } : {}),
    });
  }
  out.score =
    picker.scoreStep > 0 ? Math.round(score / picker.scoreStep) * picker.scoreStep : score;
  return out;
}

/** A result with the picker's score in its explanation. */
function withPick(r: BuildResult, pick: PickScore): BuildResult {
  const explanation: BuildExplanation = { ...r.explanation, pick };
  return { deck: { ...r.deck, explanation }, explanation };
}

/**
 * Sizes where a thin pool's plain shape, or a request no plan fills, may
 * fall back to the classic builder. A 20-card packet never does: it pads
 * with lands instead (buildPlan), and the classic builder there serves only
 * secondary styles.
 */
function classicFallback(ctx: GrowContext): boolean {
  return ctx.size !== 20;
}

/** Why the grow builder cannot fill a plain shape, in its notes' words ("too few lands (...)"). */
function plainLacks(ctx: GrowContext, style: string): string {
  const built = buildPlan(ctx, plainPlan(ctx, style)!, undefined);
  return 'lacks' in built ? built.lacks : 'too few cards for this shape';
}

/**
 * One plan of the picker's list, built and scored, or undefined when the
 * pool cannot fill it. A theme (a commander's tribe among them) comes from
 * the grow builder only; a plain shape too thin for this builder's fill
 * comes from the classic builder, as a shape asked for by name does (not at
 * 20).
 */
function planResult(
  ctx: GrowContext,
  plan: Plan,
  pool: Pool,
  lead: readonly string[],
): BuildResult | undefined {
  if (plan.kind === 'theme') {
    const t = tryTheme(ctx, plan.style);
    return 'built' in t ? finish(ctx, t.plan, t.built, lead) : undefined;
  }
  const built = buildPlan(ctx, plan, undefined);
  if (!('lacks' in built)) return finish(ctx, plan, built, lead);
  if (!classicFallback(ctx)) return undefined;
  try {
    // A shape as asked for by name. It is a plan of a grow best fit, so the classic
    // builder reads no learned plan data for it.
    const r = buildClassic(
      { ...ctx.request, style: plan.style, requireStyle: true },
      pool,
      ctx.index,
      withoutLearned(ctx.config),
    );
    return withPick(r, pickScore(ctx, plan, r.deck));
  } catch (err) {
    if (err instanceof BuildError) return undefined;
    throw err;
  }
}

interface Ranked {
  style: string;
  score: number;
  result: BuildResult;
}

/**
 * The plans best fit compares: the three plain shapes, and each theme the
 * rules call viable (the pool meets its floors), under a commander the
 * tribes it names among them.
 */
function planList(ctx: GrowContext): Plan[] {
  const plans: Plan[] = [];
  for (const style of PLAIN_SHAPES) {
    const plan = plainPlan(ctx, style);
    if (plan) plans.push(plan);
  }
  for (const style of ctx.defs.styles) {
    const plan = themePlan(ctx, style);
    if (plan && plan.poolMargin.margin >= 1 - EPS) plans.push(plan);
  }
  return plans;
}

/** A plan best fit compares, with the pool's counts against a theme's floors. */
export interface PickerPlan {
  style: string;
  kind: 'plain' | 'theme' | 'tribe';
  /** A theme: every floor of the alternative the pool meets best, as the builder counts the pool. */
  floors?: FloorCount[];
}

/**
 * The plans the builder's best fit would build for a request, before building
 * any (none when the size cannot be built). The scan, the Build page's plan,
 * and the Analyze pane's plan must list the same ones (see the agreement check).
 */
export function pickerPlans(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): PickerPlan[] {
  const { style: _style, requireStyle: _asked, ...bestFitRequest } = request;
  if (!growBuilds(bestFitRequest, config)) return [];
  const ctx = growContext(bestFitRequest, pool, index, config);
  if (!scanPossible(ctx.candidates, config, ctx.settings, ctx.size, ctx.colors).possible) return [];
  return planList(ctx).map((p) =>
    p.kind === 'theme'
      ? {
          style: p.style,
          kind: tribeOf(p.style) ? 'tribe' : 'theme',
          floors: floorCounts(poolTally(ctx, p.index), p.floor),
        }
      : { style: p.style, kind: p.kind },
  );
}

/**
 * Every plan the request can build, finished and ranked by pickScore: the
 * three plain shapes and each theme the rules call viable (the pool meets its
 * floors), under a commander the tribes it names among them. These are
 * exactly the plans the Build page's options and the Analyze pane plan, so
 * their first option is this list's first deck.
 */
function rankPlans(ctx: GrowContext, pool: Pool): Ranked[] {
  const out: Ranked[] = [];
  for (const plan of planList(ctx)) {
    const result = planResult(ctx, plan, pool, []);
    if (result?.explanation.pick)
      out.push({ style: plan.style, score: result.explanation.pick.score, result });
  }
  return out.sort(byPlanScore);
}

function labelOf(config: BulkBrewConfig, style: string): string {
  return archetypeOf(config, style)?.label ?? secondaryLabel(config, style);
}

/**
 * Best fit: the first deck of the picker's list. With nothing the grow
 * builder can fill and no classic shape either, the classic builder's own
 * best fit is the last resort (not at 20).
 */
function bestFit(ctx: GrowContext, pool: Pool): BuildResult {
  const ranked = rankPlans(ctx, pool);
  const top = ranked[0];
  if (!top && !classicFallback(ctx))
    throw new BuildError(
      `Not enough cards for a ${ctx.size}-card ${colorsLabel(ctx.colors)} deck: ${plainLacks(ctx, PLAIN_SHAPES[0])}.`,
    );
  if (!top) return buildClassic(ctx.request, pool, ctx.index, withoutLearned(ctx.config));
  const rest = ranked.slice(1).map((r) => labelOf(ctx.config, r.style));
  const shown = rest.slice(0, 3);
  if (rest.length > 3) shown.push(`${rest.length - 3} more`);
  const label = labelOf(ctx.config, top.style);
  const note =
    ranked.length > 1
      ? `Compared ${ranked.length} archetypes and kept ${label}, the best fit for this bulk list. Next: ${shown.join(', ')}.`
      : `Built ${label}, the only archetype this bulk list fills.`;
  const r = top.result;
  const explanation: BuildExplanation = {
    ...r.explanation,
    notes: [note, ...r.explanation.notes],
    pick: {
      ...r.explanation.pick!,
      ranked: ranked.map((x) => ({ style: x.style, score: round3(x.score) })),
    },
  };
  return { deck: { ...r.deck, explanation }, explanation };
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
    const after = { ...cur(ctx, d).plan };
    addJob(after, job, -1);
    return coversPlan(ctx, plan, after, undefined);
  };
  while (d.spells > slots) {
    let at = -1;
    let low = Infinity;
    d.curveCopies.forEach((id, i) => {
      const c = ctx.byId.get(id)!;
      // Weakest among its peers, not by raw strength, which would cut cheap cards
      // first and raise the land count again. The latest copy goes on a tie.
      const q = c.q * planPull(ctx, plan, d, c);
      if (q <= low && keepsCover(c)) {
        low = q;
        at = i;
      }
    });
    if (at < 0) break;
    const id = d.curveCopies.splice(at, 1)[0]!;
    remove(ctx, d, ctx.byId.get(id)!);
  }
  if (d.spells < slots) fillCurve(ctx, plan, d, shapeFor(ctx, plan), slots, relaxed);
}

interface Built {
  d: GrowDeck;
  lands: number;
  mana: ManaBase;
  colorPlan: ColorPlan;
  relaxed: string[];
  /** The plan's tally as the finished deck earns it (settle). */
  floors?: Tally;
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
  // range is a hard limit for every deck (checkBuiltDeck). Where no classic
  // builder takes a thin pool's plain shape, the deck pads with lands up to
  // the range, as the scan counts the size buildable.
  const slack = !classicFallback(ctx) ? Infinity : ctx.size >= 60 ? 2 : 1;
  if (lands - formula > slack || lands > range.max)
    return {
      lacks: `too few playable cards for a ${ctx.size}-card ${plan.archetype.label} deck (${d.spells} spells for ${ctx.size - cmd - formula} slots)`,
    };
  if (lands < range.min)
    return {
      lacks: `more theme and role cards than a ${ctx.size}-card deck has room for (${d.spells} spells)`,
    };

  try {
    const { mana, colorPlan } = manaFor(ctx, plan, d, lands);
    return settle(ctx, plan, { d, lands, mana, colorPlan, relaxed: [...relaxed] });
  } catch (err) {
    if (err instanceof ManaBaseError)
      return {
        lacks: `too few lands (${err.message.replace(/^Not enough lands: /, '').replace(/\.$/, '')})`,
      };
    throw err;
  }
}

/** The mana base for the deck's spells and commander. */
function manaFor(
  ctx: GrowContext,
  plan: Plan,
  d: GrowDeck,
  lands: number,
): { mana: ManaBase; colorPlan: ColorPlan } {
  const colorPlan = deckColorPlan(ctx, d);
  const spells = spellCopies(ctx, d);
  if (ctx.commander) spells.push({ facts: ctx.commander.facts, qty: 1 });
  const mana = chooseManaBase(
    lands,
    ctx.candidates,
    colorPlan,
    spells,
    ctx.config,
    ctx.settings,
    ctx.size,
    ctx.index,
    [plan.style],
  );
  return { mana, colorPlan };
}

/** Whether the reason recorded for a card holds in the deck, as deck views check it (reasonEarned). */
function whyEarned(ctx: GrowContext, plan: Plan, d: GrowDeck, c: GrowCard, why: string): boolean {
  const role = ctx.roleIds.get(why);
  if (role) return earnsRole(ctx, d, c, role, 0);
  const side = THEME_WHY.exec(why);
  if (side && plan.kind === 'theme')
    return earns(ctx, d, c.facts.card, c.gate, themeCredit(plan.style, sideOf(side[1]!)), 0);
  return true;
}

const THEME_WHY = /^(Setup|Payoff): /;
/** The finished-deck check repeats while it changes something, this many rounds at most. */
const SETTLE_ROUNDS = 3;
const sideOf = (word: string): Job['as'] => (word === 'Setup' ? 'setup' : 'payoff');

/**
 * The plan's tally as the finished deck earns it: each card's plan job counts
 * only when its needs are met by the deck as it stands, the theme's own
 * resources included and nothing taken as met. The floors are held to this.
 */
function honestPlan(ctx: GrowContext, plan: Plan, d: GrowDeck): Tally {
  const t = emptyTally();
  if (plan.kind !== 'theme') return t;
  for (const c of ctx.cards) {
    const j = c.jobs[plan.index];
    const n = have(d, c);
    if (j && n > 0 && earns(ctx, d, c.facts.card, c.gate, themeCredit(plan.style, j.as), 0))
      addJob(t, j, n);
  }
  // The commander counts for any job the deck earns, as the deck views count it, though the plan
  // counted a tribe job only where every deck of the tribe holds it.
  const cmd = ctx.commander;
  const j = cmd?.paid[plan.index];
  if (cmd && j && earns(ctx, d, cmd.card, cmd.gate, themeCredit(plan.style, j.as), 0))
    addJob(t, j, ctx.k.commanderCredit);
  return t;
}

/**
 * The best card for the slot a copy held, never the copy's own card: the role
 * or theme side its reason names, else (for a card the deck does not support,
 * or a theme card whose job it does not earn) its curve slot, else any slot. A
 * replacement earns what it is picked for in the finished deck and passes the
 * same gates as any pick.
 */
function replacementFor(
  ctx: GrowContext,
  plan: Plan,
  d: GrowDeck,
  out: GrowCard,
  why: string,
  anySlot: boolean,
): { c: GrowCard; why: string } | undefined {
  const ok = (c: GrowCard) =>
    c !== out && have(d, c) < c.max && supported(ctx, d, c, 1, true) && gateOpen(ctx, plan, d, c);
  const role = ctx.roleIds.get(why);
  if (role) {
    const pick = best(
      ctx.cards,
      (c) => c.facts.roles.includes(role) && ok(c) && earnsRole(ctx, d, c, role),
      (c) => c.value * planPull(ctx, plan, d, c),
    );
    if (pick) return { c: pick, why };
  }
  const side = THEME_WHY.exec(why);
  if (side && plan.kind === 'theme') {
    const as = sideOf(side[1]!);
    const credit = themeCredit(plan.style, as);
    const pick = best(
      ctx.cards,
      (c) =>
        c.jobs[plan.index]?.as === as && ok(c) && earns(ctx, d, c.facts.card, c.gate, credit, 1),
      (c) => c.jobs[plan.index]!.weight * c.q,
    );
    if (pick) return { c: pick, why: `${side[1]}: ${pick.jobs[plan.index]!.job}` };
  }
  if (!anySlot) return undefined;
  const inSlot = best(
    ctx.cards,
    (c) => ok(c) && c.slot === out.slot,
    (c) => c.value * planPull(ctx, plan, d, c),
  );
  if (inSlot) return { c: inSlot, why: curveWhy(out.slot) };
  const any = best(ctx.cards, ok, (c) => c.q * planPull(ctx, plan, d, c));
  return any ? { c: any, why: curveWhy(any.slot) } : undefined;
}

/** The floor alternative's counts no worse after a swap than before it. */
function noWorse(before: Tally, after: Tally, targets: Targets): boolean {
  return (Object.keys(targets) as FloorKey[]).every(
    (k) => floorValue(after, k) + EPS >= Math.min(floorValue(before, k), targets[k] ?? 0),
  );
}

/** Rounds of supply a feed may add for one need before it gives up, at least (more where the need asks more). */
const FEED_ROUNDS = 10;

/**
 * Feed a theme card whose job the finished deck does not pay for. The theme
 * core counts a job the pool pays for (its second, loose try, as the scan
 * counts the pool), but nothing put that supply in the deck. Each unmet gate
 * (a drawback, a required cost such as Goblin Grenade's Goblin) and each unmet
 * need of the credit's clause with the fewest unmet takes the best pool card
 * that supplies it (more copies of the card itself when it supplies its own
 * need). It replaces a curve copy, other plans' cards before the plan's own
 * and the weakest first, or else a card picked for a role the deck holds above
 * its minimum; never the card, a supplier of any of its gates or needs, or a
 * copy another card that holds needs. A role minimum yields only to the
 * plan's floors: when the deck is short of them without the card's job, and
 * nothing else can go, a role card may go below its minimum (a 20-card
 * packet has few other copies to give). Kept when the card then earns its
 * reason and the plan's floors are no worse; otherwise every swap is undone
 * and the card goes as before. Without `c` it feeds the commander's own job,
 * which the theme core's loose try counted as the scan does.
 */
function feedNeeds(
  ctx: GrowContext,
  plan: ThemePlan,
  d: GrowDeck,
  c: GrowCard | undefined,
  why: string,
  minimum: Targets,
): boolean {
  const side = THEME_WHY.exec(why);
  const cmd = ctx.commander;
  if (!side || (!c && !cmd)) return false;
  const card = c ? c.facts.card : cmd!.card;
  const credit = themeCredit(plan.style, sideOf(side[1]!));
  const earned = () =>
    c
      ? supported(ctx, d, c, 0, true) && whyEarned(ctx, plan, d, c, why)
      : earns(ctx, d, card, cmd!.gate, credit, 0);
  const reading = creditNeeds(card, credit, ctx.config, ctx.size);
  const unmet = (r: NeedRef) => !needMet(r, d.supply, card, ctx.config);
  if (reading.kind === 'absent') return false;
  // Every unmet gate (a drawback, a required cost such as a Goblin to sacrifice) and the
  // unmet needs of the clause closest to holding: each is a resource a supplier can feed.
  let needs: NeedRef[] | undefined;
  for (const cl of reading.clauses) {
    const u = cl.needs.filter(unmet);
    if (!needs || u.length < needs.length) needs = u;
  }
  const refs = [...reading.gates.filter(unmet), ...(needs ?? [])];
  if (!refs.length) return false;
  const before = honestPlan(ctx, plan, d);
  // A 20-card half short of the floors without this job: a role minimum yields to them as a
  // last resort, and the feed then holds only when the floors are met.
  const floorsNeedIt = ctx.size === 20 && !met(before, minimum);
  let belowMinimum = false;
  // Copies that hold now must still hold after: a feed never starves another card's need.
  const holds = (x: GrowCard) =>
    supported(ctx, d, x, 0, true) && whyEarned(ctx, plan, d, x, d.why.get(x.id)!);
  const fine = ctx.cards.filter((x) => x !== c && have(d, x) > 0 && holds(x));
  const done: { out: GrowCard; outWhy: string; inn: GrowCard; at: number }[] = [];
  const quotas = shapeFor(ctx, plan).quotas;
  // A supplier of any ref stays, those brought in for an earlier ref among them.
  const fed = new Set(refs.flatMap((r) => refSupplies(r)));
  const feeds = (x: GrowCard) =>
    cardSupply(x.facts.card, ctx.config, ctx.size).some((r) => fed.has(r));
  for (const ref of refs) {
    // One alternative at a time: Auras and Equipment split between meet neither.
    const res = new Set(feedResources(ref, d.supply, ctx.poolSupply, card, ctx.config));
    const supplies = (x: GrowCard) =>
      cardSupply(x.facts.card, ctx.config, ctx.size).some((r) => res.has(r));
    // As many rounds as the need can ask for ("four or more Wizards" asks 14 at 100).
    const rounds = Math.max(
      FEED_ROUNDS,
      ...[...res].map((r) => needThreshold(r, ctx.size, ctx.config, ref.count ?? 1)),
    );
    for (let n = 0; n < rounds && unmet(ref); n++) {
      const inn = best(
        ctx.cards,
        (s) =>
          have(d, s) < s.max &&
          supplies(s) &&
          supported(ctx, d, s, 1, true) &&
          gateOpen(ctx, plan, d, s),
        (s) => s.value * planPull(ctx, plan, d, s),
      );
      if (!inn) break;
      // The copy that goes: never the card or a supplier. First a curve copy,
      // cards of other plans before the plan's own, then a card picked for a role the deck
      // holds above its minimum; the weakest first. Never one another card's needs hold on.
      const value = (x: GrowCard) => x.q * planPull(ctx, plan, d, x);
      const curve = d.curveCopies
        .map((id, at) => ({ x: ctx.byId.get(id)!, at }))
        .filter(({ x }) => x !== c && !feeds(x))
        .map((o) => ({ ...o, mine: o.x.jobs[plan.index] ? 1 : 0, v: value(o.x) }))
        .sort((p, q) => p.mine - q.mine || p.v - q.v || q.at - p.at);
      const roleCards = ctx.cards
        .filter(
          (x) =>
            have(d, x) > 0 &&
            x !== c &&
            !feeds(x) &&
            !x.jobs[plan.index] &&
            ctx.roleIds.has(d.why.get(x.id)!) &&
            !d.curveCopies.includes(x.id),
        )
        .map((x) => ({ x, at: -1, v: value(x) }))
        .sort((p, q) => p.v - q.v);
      const roles = new Map(cur(ctx, d).roles);
      const keepsRoles = () =>
        Object.entries(quotas).every(
          ([r, q]) => (cur(ctx, d).roles.get(r) ?? 0) >= Math.min(q.min, roles.get(r) ?? 0),
        );
      let swap: (typeof done)[number] | undefined;
      const outs = [
        ...[...curve, ...roleCards].map((o) => ({ ...o, keep: true })),
        ...(floorsNeedIt ? roleCards.map((o) => ({ ...o, keep: false })) : []),
      ];
      for (const { x: out, at, keep } of outs) {
        const outWhy = d.why.get(out.id)!;
        remove(ctx, d, out);
        add(ctx, d, inn, curveWhy(inn.slot));
        if ((at >= 0 || !keep || keepsRoles()) && fine.every((x) => have(d, x) === 0 || holds(x))) {
          swap = { out, outWhy, inn, at };
          if (!keep) belowMinimum = true;
          break;
        }
        remove(ctx, d, inn);
        add(ctx, d, out, outWhy);
      }
      if (!swap) break;
      if (swap.at >= 0) d.curveCopies.splice(swap.at, 1, inn.id);
      done.push(swap);
    }
  }
  if (
    done.length > 0 &&
    earned() &&
    (belowMinimum
      ? met(honestPlan(ctx, plan, d), minimum)
      : noWorse(before, honestPlan(ctx, plan, d), minimum)) &&
    fine.every((x) => have(d, x) === 0 || holds(x))
  )
    return true;
  for (const x of done.reverse()) {
    remove(ctx, d, x.inn);
    add(ctx, d, x.out, x.outWhy);
    if (x.at >= 0) d.curveCopies.splice(x.at, 1, x.out.id);
  }
  return false;
}

/**
 * The finished-deck check: the deck's supply, lands included, can differ
 * from the running one the picks saw, so every spell is checked once more.
 * A theme card whose job the deck does not pay for is fed first (feedNeeds).
 * A copy the deck does not support (an unmet drawback, no credit earned) or
 * whose recorded reason it does not earn goes for the best card for its slot,
 * keeping the deck's size and land count, a few rounds at most, choosing the
 * mana base again after each. A role card the deck still supports whose role
 * nothing else can fill stays as a curve card; any other copy with no
 * replacement stays as it is, and the deck reports it as unsupported. Last,
 * the plan's floors are counted as the finished deck earns them: a theme the
 * deck cannot pay for is short, and the request gets the nearest deck.
 */
function settle(ctx: GrowContext, plan: Plan, built: Built): Built | { lacks: string } {
  const { d, lands } = built;
  let { mana, colorPlan } = built;
  const minimum = plan.kind === 'theme' ? sideTargets(plan.floor, FLOOR_KEYS, 1) : undefined;
  const withLands = (sign: 1 | -1) => {
    for (const p of mana.nonbasics)
      addSupply(d.supply, p.candidate.facts.card, sign * p.qty, ctx.config);
    changed(d);
  };
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    withLands(1);
    const bad = ctx.cards.filter(
      (c) =>
        have(d, c) > 0 &&
        (!supported(ctx, d, c, 0, true) || !whyEarned(ctx, plan, d, c, d.why.get(c.id)!)),
    );
    let swapped = false;
    for (const c of bad) {
      while (have(d, c) > 0) {
        // Checked again per copy: an earlier swap can have changed the supply.
        const why = d.why.get(c.id)!;
        const holds = supported(ctx, d, c, 0, true);
        if (holds && whyEarned(ctx, plan, d, c, why)) break;
        // A theme card the pool pays for but the deck does not: feed its needs first.
        if (plan.kind === 'theme' && minimum && feedNeeds(ctx, plan, d, c, why, minimum)) {
          swapped = true;
          continue;
        }
        const roleCard = holds && ctx.roleIds.has(why);
        const before = honestPlan(ctx, plan, d);
        remove(ctx, d, c);
        const pick = replacementFor(ctx, plan, d, c, why, !roleCard);
        if (pick) add(ctx, d, pick.c, pick.why);
        if (pick && (!minimum || noWorse(before, honestPlan(ctx, plan, d), minimum))) {
          for (const list of [d.curveCopies, d.seedCopies]) {
            const i = list.lastIndexOf(c.id);
            if (i >= 0) list.splice(i, 1, pick.c.id);
          }
          swapped = true;
          continue;
        }
        if (pick) remove(ctx, d, pick.c);
        add(ctx, d, c, why);
        // A role card the deck supports stays for its curve slot; nothing else is relabelled.
        if (roleCard) d.why.set(c.id, curveWhy(c.slot));
        break;
      }
    }
    // The commander's job the loose try counted, when the floors need it: feed it as a card's.
    const cj = plan.kind === 'theme' ? ctx.commander?.paid[plan.index] : undefined;
    if (
      cj &&
      minimum &&
      plan.kind === 'theme' &&
      !met(honestPlan(ctx, plan, d), minimum) &&
      feedNeeds(
        ctx,
        plan,
        d,
        undefined,
        `${cj.as === 'setup' ? 'Setup' : 'Payoff'}: ${cj.job}`,
        minimum,
      )
    )
      swapped = true;
    withLands(-1);
    if (!swapped) break;
    // New spells can ask for other colors or other lands.
    try {
      ({ mana, colorPlan } = manaFor(ctx, plan, d, lands));
    } catch (err) {
      if (!(err instanceof ManaBaseError)) throw err;
    }
  }
  withLands(1);
  const floors = honestPlan(ctx, plan, d);
  withLands(-1);
  if (minimum && plan.kind === 'theme' && !met(floors, minimum))
    return {
      lacks: lacksSentence(ctx.defs.compiled[plan.index]!.lacks, shortOf(floors, minimum)),
    };
  return { ...built, mana, colorPlan, floors };
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
  const shape = shapeFor(ctx, plan);
  // The targets the classic builder reports: the commander counts toward the roles its tags give it.
  const quotas = creditCommander(
    shape.quotas,
    ctx.commander?.facts.roles ?? [],
    config.builderWeights.commander.roleCredit,
  );
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const x of chosen) curve[x.cand.facts.bucket]! += x.qty;

  // Roles as the finished deck earns them, the commander left out as the deck views count it.
  const supply = deckSupply(
    {
      cards: [
        ...chosen.map((x) => ({ card: x.cand.facts.card, qty: x.qty })),
        ...mana.nonbasics.map((p) => ({ card: p.candidate.facts.card, qty: p.qty })),
      ],
      ...(commander ? { commander } : {}),
      colors: ctx.colors,
      size,
    },
    config,
  );
  const credits = creditsFor(supply, config);
  const roles: BuildExplanation['roles'] = {};
  for (const [id, q] of Object.entries(quotas)) {
    let have = 0;
    for (const x of chosen)
      if (x.cand.facts.roles.includes(id) && credits.earned(x.cand.facts.card, id)) have += x.qty;
    roles[id] = { have, want: q.target };
  }
  const roleNotes: string[] = [];
  for (const [id, q] of Object.entries(shape.quotas)) {
    if ((roles[id]?.have ?? 0) >= q.min) continue;
    let inPool = 0;
    for (const c of ctx.cards)
      if (c.facts.roles.includes(id) && credits.earned(c.facts.card, id)) inPool += c.avail;
    const label = (ctx.roleLabels.get(id) ?? id).toLowerCase();
    roleNotes.push(`Wanted ${q.min} ${label}, the bulk list had ${inPool}.`);
  }

  const notes = [...lead];
  // The theme as the finished deck earns it, against the floor alternative the deck was built to.
  const theme =
    plan.kind === 'theme'
      ? { style: plan.style, floors: floorCounts(built.floors ?? cur(ctx, d).plan, plan.floor) }
      : undefined;
  if (theme) {
    const counts = theme.floors.map((f) => `${FLOOR_WORDS[f.floor]} ${f.have} of ${f.need}`);
    notes.push(`${plan.archetype.label} minimums met: ${counts.join(', ')}.`);
  }
  if (built.relaxed.length) notes.push(`To fill every slot, relaxed ${joinWords(built.relaxed)}.`);
  notes.push(...mana.notes, ...copyNotes(chosen, mana.nonbasics), ...roleNotes);
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
    curve,
    roles,
    lands: {
      count: lands,
      averageMv: landPlan.averageMv,
      cheapManaSources: landPlan.cheapManaSources,
      nonbasics: mana.nonbasics.reduce((n, p) => n + p.qty, 0),
      ...(ctx.colors.length > 1 ? { sources: mana.sources } : {}),
    },
    synergies: [],
    notes,
    ...(theme ? { theme } : {}),
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
  // The key synergies are the rules' themes the finished deck earns, as its views count them.
  explanation.synergies = themeSynergyLines(deck, index, config);
  explanation.pick = pickScore(ctx, plan, deck);
  return { deck, explanation };
}

// ---------------------------------------------------------------- routing and the nearest rule

/**
 * Whether buildDeck sends a request here: any size with no secondary style,
 * and best fit (no style), a plain shape, a theme the rules describe at that
 * size, or at 100 a tribe (which only a commander that names it leads).
 * Secondary styles and tribes below 100 keep the classic builder.
 */
export function growBuilds(request: BuildRequest, config: BulkBrewConfig): boolean {
  const { style, size } = request;
  if (request.secondary) return false;
  if (!style) return true;
  if (tribeOf(style)) return isCommanderSize(size);
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
 * The grow builder for a request growBuilds accepts.
 *
 * - No style: best fit, the first deck of the plan picker's list.
 * - A style without `requireStyle` is one plan of a list (a Build page
 *   option, an Analyze deck): built as the picker builds it, or a BuildError
 *   when the pool cannot fill it, so the list drops it.
 * - A style the player asked for: a theme the pool supports is built to its
 *   floors. One it cannot support gets the nearest deck: the first style of
 *   its `kin` list in the rules that the pool can build, else best fit, with
 *   a note saying what the pool lacks. A plain shape is built as its curve,
 *   roles, and type mix; on a pool too thin for this builder's fill it comes
 *   from the classic builder.
 */
export function buildGrowDeck(
  request: BuildRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildResult {
  const ctx = growContext(request, pool, index, config);
  const scan = scanPossible(ctx.candidates, config, ctx.settings, ctx.size, ctx.colors);
  if (!scan.possible)
    throw new BuildError(
      `Not enough ${colorsLabel(ctx.colors)} cards for a ${ctx.size}-card deck: ${scan.notes.join('; ')}.`,
    );
  const style = request.style;
  if (!style) return bestFit(ctx, pool);
  const asked = request.requireStyle === true;
  const label = labelOf(config, style);
  // A tribe leads only a commander whose own text names it.
  if (tribeOf(style) && !ctx.defs.styles.includes(style)) {
    const why = ctx.commander
      ? `${commanderShortName(ctx.commander.card.name)} does not reward the ${tribeOf(style)} tribe`
      : 'a tribe leads only a Commander deck whose commander names it';
    throw new BuildError(
      `Not enough cards to build ${label}${ctx.commander ? ` under ${commanderShortName(ctx.commander.card.name)}` : ''}: ${why}.`,
    );
  }
  if ((PLAIN_SHAPES as readonly string[]).includes(style)) {
    const r = planResult(
      ctx,
      plainPlan(ctx, style)!,
      pool,
      asked ? [`Built ${label} as asked.`] : [],
    );
    if (!r)
      throw new BuildError(
        `Not enough cards for a ${ctx.size}-card ${label} deck: ${plainLacks(ctx, style)}.`,
      );
    return r;
  }

  const theme = tryTheme(ctx, style);
  if ('built' in theme)
    return finish(ctx, theme.plan, theme.built, asked ? [`Built ${label} as asked.`] : []);
  if (!asked)
    throw new BuildError(`Not enough cards to build ${label}: your bulk list has ${theme.lacks}.`);

  const nearest = { requested: style, lacks: theme.lacks };
  const why = `Asked for ${label}: your bulk list has ${theme.lacks}.`;
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
  // No kin to build: best fit, which never holds the style the pool falls short of.
  const fit = rankPlans(ctx, pool).find((r) => r.style !== style)?.result;
  if (!fit)
    throw new BuildError(`Not enough cards to build ${label}: your bulk list has ${theme.lacks}.`);
  return withNote(
    fit,
    nearest,
    `${why} Built ${labelOf(config, fit.deck.archetype)} instead, the best fit for this bulk list.`,
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

// Theme tallies for the deck views (deck-themes.ts), under names that say what they count.
export { addJob as addThemeJob, emptyTally as emptyThemeTally };
