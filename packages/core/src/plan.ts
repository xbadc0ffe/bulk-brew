// Plan choice with learned plans: which of the styles a pool can build it
// should build. Each plan gets a score from how often real decks run it (the
// prior, from config/learned/plans.json, and under a commander from the
// plans its EDHREC decks run) and how much more of its theme the pool holds
// than random bulk of the same colors would (the lift), so a theme made of
// common cards does not win by default, and a pool that holds nothing
// unusual builds a plain shape, as most real decks without a theme are.

import {
  curveProfileFor,
  forSize,
  minimumsFor,
  type BulkBrewConfig,
  type SynergyArchetype,
} from './config.ts';
import type { Candidate } from './candidates.ts';
import { colorClassOf, expectedThemeCopies, type ColorClass } from './colors.ts';
import { baseSpellSlots, learnedAt, learnedSizeKey, learnedTheme } from './learned.ts';
import { inTribe } from './matchers.ts';
import type { CardIndex } from './pack.ts';
import type { CardRecord, DeckSize } from './types.ts';

/** The plan id of the plain shapes (Aggro, Midrange, Control) together. */
export const SHAPE_PLAN = 'shape';
const TRIBAL = 'tribal:';
const SHAPE_IDS = ['aggro', 'midrange', 'control'];

export interface PlanScore {
  /** Style id, a tribe as "tribal:<Type>", or "shape". */
  style: string;
  /** How often real decks run the plan, as a share. */
  prior: number;
  /** Theme copies in the pool, and what random bulk of its colors would hold. */
  theme: number;
  expected: number;
  /**
   * Theme copies over the expected copies, both raised by liftSmoothing so a
   * handful of a rare theme's cards does not read as a deep plan (1 for a shape).
   */
  lift: number;
  /** Theme copies in the pool over the copies real decks of the plan play, at most 1. */
  fill: number;
  /** In log form; higher is better. */
  score: number;
}

function isEnabler(a: SynergyArchetype, c: Candidate): boolean {
  if (!a.id.startsWith(TRIBAL)) return c.facts.enablerOf.includes(a.id);
  return inTribe(c.facts.card, a.id.slice(TRIBAL.length));
}

function isPayoff(a: SynergyArchetype, c: Candidate): boolean {
  if (!a.id.startsWith(TRIBAL)) return c.facts.payoffOf.includes(a.id);
  return c.facts.card.tags.includes(`typal-${a.id.slice(TRIBAL.length).toLowerCase()}`);
}

/** Whether a candidate is a theme card of a synergy style or a tribe. */
function themeTest(a: SynergyArchetype): (c: Candidate) => boolean {
  if (a.id.startsWith(TRIBAL)) {
    const type = a.id.slice(TRIBAL.length);
    const tag = `typal-${type.toLowerCase()}`;
    return (c) => inTribe(c.facts.card, type) || c.facts.card.tags.includes(tag);
  }
  return (c) => c.facts.enablerOf.includes(a.id) || c.facts.payoffOf.includes(a.id);
}

/**
 * Share of a size's real decks that run each plan: the decks behind each
 * profile that comes from decks running it, plus the shape decks. A style
 * whose profile only borrows decks that meet it counts half a deck.
 */
export function planPriors(config: BulkBrewConfig, size: DeckSize): Map<string, number> {
  const block = config.learned?.plans.sizes[learnedSizeKey(size)];
  const out = new Map<string, number>();
  if (!block) return out;
  let total = 0;
  for (const [style, p] of Object.entries(block.plans)) {
    const n = p.source === 'plan' ? p.decks : 0.5;
    out.set(style, n);
    total += n;
  }
  for (const [k, v] of out) out.set(k, v / Math.max(1, total));
  return out;
}

/** The commander's EDHREC plan shares, with the plain shapes summed as "shape". */
function commanderPlans(
  index: CardIndex,
  commander: CardRecord | undefined,
): Map<string, number> | undefined {
  const fit = commander ? index.learned?.commanders.get(commander.id) : undefined;
  if (!fit) return undefined;
  const out = new Map<string, number>();
  for (const [style, share] of Object.entries(fit.plans)) {
    const key = SHAPE_IDS.includes(style) ? SHAPE_PLAN : style;
    out.set(key, Math.min(1, (out.get(key) ?? 0) + share));
  }
  return out;
}

/** The key a plan's calibrated weight is stored under: tribes share one. */
export function planGroup(style: string): string {
  return style.startsWith(TRIBAL) ? 'tribal' : style;
}

/**
 * Plan scores, in log form, for the synergy styles and tribes a pool can
 * build and each plain shape, best first:
 *
 * - a theme: log prior + liftPower times log lift + 2 log fill + its weight;
 * - a shape: log of the shapes' prior split among them, minus
 *   shapeSharpness times how far the pool's curve sits from the shape's
 *   (see shapeDistances), plus its weight.
 *
 * The weights (config/learned/plans.json, `bias`) are calibrated by the
 * learning script so that, over the corpus's train split, each plan is
 * picked about as often as real decks run it. `pull` is the commander's own
 * pull on each style (see commanderPull in builder.ts), which raises its prior.
 */
export function planScores(
  themes: readonly SynergyArchetype[],
  shapes: readonly { id: string; curveProfile: string }[],
  cands: readonly Candidate[],
  config: BulkBrewConfig,
  index: CardIndex,
  size: DeckSize,
  commander: CardRecord | undefined,
  pull: ReadonlyMap<string, number>,
): PlanScore[] {
  const w = config.builderWeights.learned;
  const plans = config.learned?.plans;
  // Without calibrated weights the scores would not be balanced, so best fit keeps its old way.
  if (!w || !plans || !learnedAt(config, size) || !plans.sizes[learnedSizeKey(size)]?.bias)
    return [];
  const sw = forSize(w.plan, size);
  const priors = planPriors(config, size);
  const fromCommander = commanderPlans(index, commander);
  // A commander EDHREC does not cover gets the weights calibrated for that case.
  const block = plans.sizes[learnedSizeKey(size)];
  const bias =
    (commander && !fromCommander ? block?.biasNoCommander : undefined) ?? block?.bias ?? {};
  // A theme the calibration never saw gets the middle of the themes' weights, not zero.
  const themeWeights = Object.entries(bias)
    .filter(([k]) => !SHAPE_IDS.includes(k))
    .map(([, v]) => v)
    .sort((a, b) => a - b);
  const unseen = themeWeights.length ? themeWeights[Math.floor(themeWeights.length / 2)]! : 0;
  const cardFit = (style: string) => index.learned?.fit.get(style);
  const minPrior = Math.min(...[...priors.values()].filter((v) => v > 0), 1) / 2;
  const prior = (style: string) => {
    let p = priors.get(planGroup(style)) ?? minPrior;
    if (fromCommander)
      p = (1 - w.commanderShare) * p + w.commanderShare * (fromCommander.get(style) ?? 0);
    return Math.max(p, minPrior) * (1 + w.pullBoost * (pull.get(style) ?? 0));
  };
  const classes: Partial<Record<ColorClass, number>> = {};
  for (const c of cands) {
    if (!c.facts.spell) continue;
    const k = colorClassOf(c.facts.card);
    classes[k] = (classes[k] ?? 0) + c.available;
  }
  const out: PlanScore[] = [];
  for (const a of themes) {
    const test = themeTest(a);
    const learned = learnedTheme(config, a.id, size);
    // Best fit only builds a theme the pool holds at least the lower quarter of its real decks for.
    if (w.quartileMinimums && learned) {
      let e = 0;
      let p = 0;
      for (const c of cands) {
        if (!c.facts.spell) continue;
        if (isEnabler(a, c)) e += c.available;
        if (isPayoff(a, c)) p += c.available;
      }
      if (e < learned.min.enablers || p < learned.min.payoffs) continue;
    }
    let theme = 0;
    // Cards real decks of the plan play more than other decks count for more (learned card fit).
    const fit = cardFit(a.id);
    for (const c of cands)
      if (c.facts.spell && test(c))
        theme += c.available * (1 + sw.cardFit * Math.log(fit?.get(c.facts.card.id) ?? 1));
    const shares = a.id.startsWith(TRIBAL)
      ? plans.tribeShare[a.id.slice(TRIBAL.length)]
      : plans.bulkShare[a.id];
    const expected = shares ? expectedThemeCopies(shares, classes) : 0;
    const lift = expected > 0 ? (theme + sw.liftSmoothing) / (expected + sw.liftSmoothing) : 1;
    // A theme the pool cannot fill to what its real decks play (or half again its minimums)
    // scores lower; enablers and payoffs each count, since one card can be both.
    const min = minimumsFor(config, a, size);
    const want = learned?.target ?? {
      enablers: Math.ceil(1.5 * min.enablers),
      payoffs: Math.ceil(1.5 * min.payoffs),
    };
    let haveE = 0;
    let haveP = 0;
    for (const c of cands) {
      if (!c.facts.spell) continue;
      if (isEnabler(a, c)) haveE += c.available;
      if (isPayoff(a, c)) haveP += c.available;
    }
    const fill = Math.sqrt(
      (want.enablers > 0 ? Math.min(1, haveE / want.enablers) : 1) *
        (want.payoffs > 0 ? Math.min(1, haveP / want.payoffs) : 1),
    );
    const p = prior(a.id);
    out.push({
      style: a.id,
      prior: p,
      theme,
      expected,
      lift,
      fill,
      score:
        Math.log(p) +
        sw.liftPower * Math.log(lift) +
        2 * Math.log(Math.max(1e-6, fill)) +
        (bias[planGroup(a.id)] ?? unseen),
    });
  }
  const slots = baseSpellSlots(config, size);
  const shapePrior = prior(SHAPE_PLAN) / Math.max(1, shapes.length);
  for (const [id, d] of shapeDistances(cands, shapes, config, slots))
    out.push({
      style: id,
      prior: shapePrior,
      theme: 0,
      expected: 0,
      lift: 1,
      fill: 1,
      score: Math.log(shapePrior) - sw.shapeSharpness * d + (bias[id] ?? 0),
    });
  return out.sort((x, y) => y.score - x.score || (x.style < y.style ? -1 : 1));
}

/**
 * How far the curve of a pool's strongest spells (as many copies as a deck
 * has spell slots) sits from each plain shape's curve profile, the way a
 * deck with no theme is read as aggro, midrange, or control from its curve.
 */
export function shapeDistances(
  cands: readonly Candidate[],
  shapes: readonly { id: string; curveProfile: string }[],
  config: BulkBrewConfig,
  slots: number,
): Map<string, number> {
  const spells = cands
    .filter((c) => c.facts.spell)
    .sort(
      (a, b) => b.facts.strength - a.facts.strength || (a.facts.card.id < b.facts.card.id ? -1 : 1),
    );
  const curve = new Array<number>(7).fill(0);
  let n = 0;
  for (const c of spells) {
    if (n >= slots) break;
    const q = Math.min(c.preferred, slots - n);
    curve[Math.max(1, c.facts.bucket) - 1]! += q;
    n += q;
  }
  const out = new Map<string, number>();
  for (const s of shapes) {
    const shape = curveProfileFor(config, s.curveProfile).shape;
    out.set(
      s.id,
      shape.reduce((a, v, i) => a + Math.abs(v - curve[i]! / Math.max(1, n)), 0),
    );
  }
  return out;
}
