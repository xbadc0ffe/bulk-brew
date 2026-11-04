// Deck options for the Build page: from the picked size, colors, and styles,
// plan a list of builds (each subset of the picked colors times each viable
// style), build them one at a time, and rank what comes back. Each option is
// built from the full pool; options are ideas, not commitments.

import { buildDeck } from './builder.ts';
import { normalizeColors } from './colors.ts';
import type { BulkBrewConfig } from './config.ts';
import type { CardIndex } from './pack.ts';
import { scanPool } from './scan.ts';
import {
  COLORS,
  type BuildResult,
  type Color,
  type DeckSize,
  type Pool,
  type ScanReport,
  type Settings,
} from './types.ts';

export interface OptionsRequest {
  size: DeckSize;
  /** Picked colors; options use any non-empty subset of them. */
  colors: Color[];
  /** Required style id, or undefined for every viable style. */
  primary?: string;
  /** Wanted second style id; best effort. */
  secondary?: string;
  settings: Settings;
}

/** One planned build. */
export interface OptionPlan {
  /** Stable id: color letters and the style id, such as "WU:tokens". */
  key: string;
  colors: Color[];
  style: string;
}

export interface OptionsPlan {
  plans: OptionPlan[];
  /** A primary style was picked and no subset of the picked colors can build it. */
  primaryUnavailable: boolean;
}

/** Non-empty subsets of the colors: larger sets first, then WUBRG order. */
export function colorSubsets(colors: readonly Color[]): Color[][] {
  const list = normalizeColors(colors);
  const out: Color[][] = [];
  for (let mask = 1; mask < 1 << list.length; mask++) {
    out.push(list.filter((_, i) => mask & (1 << i)));
  }
  const rank = (set: Color[]) => set.map((c) => COLORS.indexOf(c));
  return out.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! - rb[i]!;
    return 0;
  });
}

/**
 * Plan the builds for a request. Each color subset lists its viable styles,
 * themes first by how deep they run, then the plain shapes; the plan takes
 * one from each subset in turn (subsets that use every picked color first),
 * so smaller color sets get built too. Capped at `buildOptions.maxBuilds`.
 */
export function planOptions(
  req: OptionsRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  /** Scans the caller already has, keyed by color letters such as "WU". */
  scans?: ReadonlyMap<string, ScanReport>,
): OptionsPlan {
  const picked = normalizeColors(req.colors);
  const perSubset: OptionPlan[][] = [];
  for (const subset of colorSubsets(picked)) {
    const scan =
      scans?.get(subset.join('')) ?? scanPool(pool, index, config, req.settings, req.size, subset);
    if (!scan.possible) continue;
    const styles = scan.archetypes
      .filter((a) => a.viable && (!req.primary || a.archetype === req.primary))
      .sort(
        (a, b) =>
          Number(b.kind === 'synergy') - Number(a.kind === 'synergy') ||
          b.margin - a.margin ||
          (a.archetype < b.archetype ? -1 : a.archetype > b.archetype ? 1 : 0),
      );
    if (styles.length === 0) continue;
    perSubset.push(
      styles.map((a) => ({
        key: `${subset.join('')}:${a.archetype}`,
        colors: subset,
        style: a.archetype,
      })),
    );
  }
  const plans: OptionPlan[] = [];
  const max = config.builderWeights.buildOptions.maxBuilds;
  for (let round = 0; plans.length < max; round++) {
    let any = false;
    for (const list of perSubset) {
      const plan = list[round];
      if (!plan) continue;
      any = true;
      if (plans.length < max) plans.push(plan);
    }
    if (!any) break;
  }
  return { plans, primaryUnavailable: Boolean(req.primary) && perSubset.length === 0 };
}

/** Build one planned option. Throws BuildError when the pool cannot make it. */
export function buildOption(
  plan: OptionPlan,
  req: OptionsRequest,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
): BuildResult {
  return buildDeck(
    {
      size: req.size,
      colors: plan.colors,
      style: plan.style,
      ...(req.secondary ? { secondary: req.secondary } : {}),
      settings: req.settings,
      id: plan.key,
      createdAt: '',
    },
    pool,
    index,
    config,
  );
}

export interface DeckOption {
  key: string;
  result: BuildResult;
  /** Deck score plus the bonus for using every picked color. */
  rank: number;
  /** True when the option uses every picked color. */
  allColors: boolean;
}

/** Spell copies two decks share, over the smaller deck's spell copies. */
function overlap(a: BuildResult, b: BuildResult, index: CardIndex): number {
  const spells = (r: BuildResult) => {
    const m = new Map<string, number>();
    for (const c of r.deck.cards) {
      const card = index.get(c.cardId);
      if (card && !card.types.includes('land')) m.set(c.cardId, c.qty);
    }
    return m;
  };
  const sa = spells(a);
  const sb = spells(b);
  let shared = 0;
  for (const [id, q] of sa) shared += Math.min(q, sb.get(id) ?? 0);
  const size = (m: Map<string, number>) => [...m.values()].reduce((n, q) => n + q, 0);
  const smaller = Math.min(size(sa), size(sb));
  return smaller > 0 ? shared / smaller : 0;
}

/**
 * Add a finished option to a ranked list: drop it when a stronger option
 * shares most of its cards, drop weaker near copies of it, keep the list
 * sorted by rank (then key), and cap it at `buildOptions.maxOptions`.
 */
export function addOption(
  list: readonly DeckOption[],
  key: string,
  result: BuildResult,
  req: OptionsRequest,
  index: CardIndex,
  config: BulkBrewConfig,
): DeckOption[] {
  const cfg = config.builderWeights.buildOptions;
  const picked = normalizeColors(req.colors);
  const deckColors = result.deck.colors ?? [result.deck.color];
  const allColors = deckColors.length === picked.length;
  const rank =
    (result.explanation.score?.total ?? 0) +
    (allColors ? cfg.allColorsBonus : 0) +
    (result.explanation.secondary?.met ? cfg.secondaryBonus : 0);
  const option: DeckOption = { key, result, rank, allColors };
  const byRank = (a: DeckOption, b: DeckOption) =>
    b.rank - a.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const kept: DeckOption[] = [];
  for (const other of list) {
    if (overlap(other.result, result, index) < cfg.duplicateShare) {
      kept.push(other);
      continue;
    }
    // Near copies: keep whichever ranks higher.
    if (byRank(other, option) < 0) return [...list];
  }
  const ranked = [...kept, option].sort(byRank);
  // Without a picked style, show variety: at most a few options of any one style.
  const perStyle = new Map<string, number>();
  const varied = req.primary
    ? ranked
    : ranked.filter((o) => {
        const style = o.result.deck.archetype;
        const n = (perStyle.get(style) ?? 0) + 1;
        perStyle.set(style, n);
        return n <= cfg.maxPerStyle;
      });
  return varied.slice(0, cfg.maxOptions);
}
