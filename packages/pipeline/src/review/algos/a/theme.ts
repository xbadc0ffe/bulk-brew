// Honest plan accounting for prototype A' (docs/review/proto-a.md): every card
// counts once, as setup with a supply weight or as payoff with a demand
// weight, by the theme rules (theme-rules.json). The plan-health term, the
// payoff gate, and the honest viability scan all read these numbers.

import type { CardRecord, DeckSize } from '@bulk-brew/core';
import {
  checkMinimums,
  compileThemeRules,
  EXAMPLE_THEME_RULES,
  loadThemeRules,
  matchCard,
  type CompiledStyle,
  type ThemeCount,
  type ThemeFloor,
  type ThemeMinimumsCheck,
  type ThemeRules,
} from '../../theme-rules.ts';

/** What one card is to the deck's style, counted once. */
export interface CardJob {
  as: 'setup' | 'payoff';
  job: string;
  /** Supply weight for setup, demand weight for payoff. */
  weight: number;
  repeatable: boolean;
}

/** Running honest counts of a deck (or a pool), each card once. */
export interface ThemeTally {
  /** Weighted setup supply: copies times weight. */
  sW: number;
  /** Setup units: copies, each counting its weight capped at 1. */
  sU: number;
  /** Repeatable setup copies. */
  rep: number;
  /** Weighted payoff demand. */
  pW: number;
  pU: number;
  /** Payoff copies. */
  pN: number;
  /** Payoff copies by demand weight, for counting payoffs with no setup behind them. */
  byW: Map<number, number>;
}

export function emptyThemeTally(): ThemeTally {
  return { sW: 0, sU: 0, rep: 0, pW: 0, pU: 0, pN: 0, byW: new Map() };
}

export function copyThemeTally(t: ThemeTally): ThemeTally {
  return { ...t, byW: new Map(t.byW) };
}

/** Add (or with a negative qty, take out) copies of a card with a job. */
export function addJob(t: ThemeTally, job: CardJob | undefined, qty: number): void {
  if (!job || qty === 0) return;
  const units = Math.min(job.weight, 1) * qty;
  if (job.as === 'setup') {
    t.sW += job.weight * qty;
    t.sU += units;
    if (job.repeatable) t.rep += qty;
    return;
  }
  t.pW += job.weight * qty;
  t.pU += units;
  t.pN += qty;
  const n = (t.byW.get(job.weight) ?? 0) + qty;
  if (n === 0) t.byW.delete(job.weight);
  else t.byW.set(job.weight, n);
}

/** One style at one size: its floors and the setup it asks per unit of payoff demand. */
export interface PlanSpec {
  style: string;
  rules: CompiledStyle;
  size: DeckSize;
  /** Alternatives from the rules' minimums for the size; empty when none are given. */
  alts: ThemeFloor[];
  /** Setup weight wanted per unit of payoff weight: setup minimum over payoff minimum. */
  ratio: number;
  setupNeed: number;
  payoffNeed: number;
  /** Floor units of the first alternative, so each floor unit weighs the same in the plan term. */
  scale: number;
}

/** Ratio when the rules give no payoff minimum (Evasion, Mill at 20, Burn): one setup per payoff. */
const DEFAULT_RATIO = 1;

export function planSpec(rules: CompiledStyle, size: DeckSize): PlanSpec {
  const entry = rules.minimums?.[`${size}`];
  const alts = entry ? (Array.isArray(entry) ? entry : [entry]) : [];
  const first = alts[0] ?? {};
  // A weighted floor, where given, is the one the rules mean; units otherwise.
  const setupNeed = first.setupWeight ?? first.setup ?? 0;
  const payoffNeed = first.payoffWeight ?? first.payoff ?? 0;
  const ratio = setupNeed > 0 && payoffNeed > 0 ? setupNeed / payoffNeed : DEFAULT_RATIO;
  let scale = 0;
  for (const v of Object.values(first)) scale += v ?? 0;
  return { style: rules.id, rules, size, alts, ratio, setupNeed, payoffNeed, scale };
}

function floorHave(t: ThemeTally, key: keyof ThemeFloor): number {
  switch (key) {
    case 'setup':
      return t.sU;
    case 'setupWeight':
      return t.sW;
    case 'repeatable':
      return t.rep;
    case 'payoff':
      return t.pU;
    case 'payoffWeight':
      return t.pW;
    case 'repeatableOrPayoff':
      return t.rep + t.pU;
  }
}

const EPS = 1e-9;

/**
 * Share of the floors met, 0 to 1, for the alternative closest to met (the
 * first wins a tie). It stops growing once every floor is met, so theme
 * density past the minimums earns nothing.
 */
export function progressOf(t: ThemeTally, spec: PlanSpec): { progress: number; alt: number } {
  if (spec.alts.length === 0) return { progress: 1, alt: -1 };
  let best = -1;
  let at = 0;
  spec.alts.forEach((floors, i) => {
    let have = 0;
    let need = 0;
    for (const [k, n] of Object.entries(floors) as [keyof ThemeFloor, number][]) {
      if (n <= 0) continue;
      need += n;
      have += Math.min(n, floorHave(t, k));
    }
    const p = need > 0 ? have / need : 1;
    if (p > best + EPS) {
      best = p;
      at = i;
    }
  });
  return { progress: best, alt: at };
}

/** Setup weight short of what the payoffs in the deck ask for. */
export function shortOf(t: ThemeTally, spec: PlanSpec): number {
  return Math.max(0, spec.ratio * t.pW - t.sW);
}

/**
 * Payoff copies with no setup behind them: the supply backs the cheapest
 * payoffs first, so this is the fewest payoffs the supply cannot feed.
 */
export function lonePayoffs(t: ThemeTally, spec: PlanSpec): number {
  if (t.pN <= 0) return 0;
  let supply = t.sW + EPS;
  let lone = 0;
  for (const w of [...t.byW.keys()].sort((a, b) => a - b)) {
    const n = t.byW.get(w)!;
    const cost = spec.ratio * w;
    if (cost <= 0) continue;
    const fed = Math.max(0, Math.min(n, Math.floor(supply / cost)));
    supply -= fed * cost;
    lone += n - fed;
  }
  return lone;
}

/** Objective points per unit of each plan-health part. */
export const PLAN_WEIGHTS = {
  /** Per floor unit toward the minimums: as much as a copy toward a role target. */
  fill: 2,
  /** Per unit of setup weight short of the ratio. */
  short: 2,
  /** Per payoff copy with no setup behind it. */
  lone: 2,
};

/** The plan-health term of the objective, in objective points. */
export function planTerm(t: ThemeTally, spec: PlanSpec): number {
  const w = PLAN_WEIGHTS;
  return (
    w.fill * spec.scale * progressOf(t, spec).progress -
    w.short * shortOf(t, spec) -
    w.lone * lonePayoffs(t, spec)
  );
}

/**
 * Plan health on one scale for every style, at most 1: the share of the
 * floors met, less the share of demand unfed and of payoffs alone. Best fit
 * compares decks of different styles by it.
 */
export function planHealth(t: ThemeTally, spec: PlanSpec): number {
  const { progress } = progressOf(t, spec);
  const wanted = spec.ratio * Math.max(t.pW, spec.payoffNeed);
  return (
    progress - shortOf(t, spec) / Math.max(1, wanted) - lonePayoffs(t, spec) / Math.max(1, t.pN)
  );
}

/**
 * The payoff gate: a payoff may join only when the setup already in the
 * deck covers every payoff's demand with it at the plan's ratio. A card is
 * setup or payoff, never both, so it never feeds its own need.
 */
export function gateOpen(t: ThemeTally, spec: PlanSpec, job: CardJob | undefined): boolean {
  if (!job || job.as !== 'payoff') return true;
  return t.sW + EPS >= spec.ratio * (t.pW + job.weight);
}

/** Which floors of the alternative closest to met are still short. */
export function shortFloors(t: ThemeTally, spec: PlanSpec): Set<keyof ThemeFloor> {
  const out = new Set<keyof ThemeFloor>();
  const { alt } = progressOf(t, spec);
  const floors = spec.alts[alt];
  if (!floors) return out;
  for (const [k, n] of Object.entries(floors) as [keyof ThemeFloor, number][])
    if (floorHave(t, k) + EPS < n) out.add(k);
  return out;
}

/** A card's job for a style at a size, counted once; excluded cards and others have none. */
export function jobOf(card: CardRecord, rules: CompiledStyle, size: DeckSize): CardJob | undefined {
  const m = matchCard(card, rules, size);
  if (!m || m.as === 'excluded') return undefined;
  return { as: m.as, job: m.job, weight: m.weight, repeatable: m.repeatable };
}

/** A tally as the shape theme-rules.ts checks minimums on. */
function asCount(t: ThemeTally, spec: PlanSpec): ThemeCount {
  return {
    style: spec.style,
    resource: spec.rules.resource,
    size: spec.size,
    setupCopies: 0,
    setupWeighted: t.sW,
    setupUnits: t.sU,
    payoffCopies: t.pN,
    payoffWeighted: t.pW,
    payoffUnits: t.pU,
    dualResolved: 0,
    excludedCopies: 0,
    repeatableSetupCopies: t.rep,
    ratio: null,
    setup: [],
    payoff: [],
  };
}

/** Whether counts meet the style's minimums for the size; undefined when the rules give none. */
export function minimumsMet(t: ThemeTally, spec: PlanSpec): ThemeMinimumsCheck | undefined {
  return checkMinimums(asCount(t, spec), spec.rules.minimums, spec.size);
}

const FLOOR_WORDS: Record<keyof ThemeFloor, string> = {
  setup: 'setup card',
  setupWeight: 'setup weight',
  repeatable: 'repeatable setup card',
  payoff: 'payoff card',
  payoffWeight: 'payoff weight',
  repeatableOrPayoff: 'repeatable setup or payoff card',
};

/** "needs 2 more setup weight; needs 1 more payoff card", from a missed minimums check. */
export function shortWords(check: ThemeMinimumsCheck): string {
  return check.short
    .map((s) => {
      const n = Math.round((s.need - s.have) * 100) / 100;
      const word = FLOOR_WORDS[s.floor];
      return `needs ${n} more ${word}${word.endsWith('card') && n !== 1 ? 's' : ''}`;
    })
    .join('; ');
}

export interface LoadedRules {
  rules: ThemeRules;
  /** Plain words for the version notes. */
  note: string;
  example: boolean;
}

/** The theme rules file, or the example rules with a loud warning when it is missing. */
export function loadRulesOrExample(): LoadedRules {
  const rules = loadThemeRules();
  if (rules)
    return {
      rules,
      note: `Theme rules ${rules.version} (${rules.styles.size} styles).`,
      example: false,
    };
  console.warn(
    "WARNING: packages/pipeline/src/review/theme-rules.json is missing; A' uses EXAMPLE_THEME_RULES (Graveyard only). Other styles build with the current matchers.",
  );
  return {
    rules: compileThemeRules(EXAMPLE_THEME_RULES, 'EXAMPLE_THEME_RULES'),
    note: 'EXAMPLE theme rules: theme-rules.json was missing.',
    example: true,
  };
}
