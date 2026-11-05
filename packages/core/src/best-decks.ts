// Best decks for the Bulk List analysis. For each deck size, plan a build for
// every color set and style the pool can make (at 100, one under every
// commander), most promising first, then build them one step at a time and
// keep the strongest few, ranked like deck options. Nothing here is timed or
// threaded, so a shell can run the steps in the background and stop between
// any two of them.

import { BuildError, buildDeck } from './builder.ts';
import { commanderCandidates } from './commander.ts';
import type { BulkBrewConfig } from './config.ts';
import {
  addOption,
  byStylePromise,
  colorSubsets,
  sameOptions,
  type DeckOption,
} from './options.ts';
import type { CardIndex } from './pack.ts';
import { scanPool } from './scan.ts';
import {
  COLORS,
  type BuildResult,
  type Color,
  type DataPack,
  type DeckSize,
  type Pool,
  type ScanReport,
  type Settings,
} from './types.ts';

/** Commander first, then the other sizes largest first. */
export const BEST_DECK_SIZES: readonly DeckSize[] = [100, 60, 40, 20];

/** One planned build: a color set and a style, or a commander with its best fit. */
export interface BestDeckPlan {
  /** "WU:tokens", or the commander's card id. */
  key: string;
  colors: Color[];
  style?: string;
  commander?: string;
}

/**
 * Plans for a 60, 40, or 20-card size, from scans keyed by color letters
 * such as "WU". Builds take turns by style rank: every color set's most
 * promising style, then each one's next. Inside a turn fewer colors go first,
 * since mono-color decks build strongest.
 */
export function bestDeckPlans(scans: ReadonlyMap<string, ScanReport>): BestDeckPlan[] {
  const perSubset: BestDeckPlan[][] = [];
  for (const subset of fewestColorsFirst()) {
    const scan = scans.get(subset.join(''));
    if (!scan?.possible) continue;
    const styles = scan.archetypes.filter((a) => a.viable).sort(byStylePromise);
    if (styles.length === 0) continue;
    perSubset.push(
      styles.map((a) => ({
        key: `${subset.join('')}:${a.archetype}`,
        colors: subset,
        style: a.archetype,
      })),
    );
  }
  const plans: BestDeckPlan[] = [];
  for (let round = 0; ; round++) {
    let any = false;
    for (const list of perSubset) {
      const plan = list[round];
      if (!plan) continue;
      any = true;
      plans.push(plan);
    }
    if (!any) return plans;
  }
}

/** Every non-empty color set: one color, then pairs, and so on, WUBRG order inside each. */
function fewestColorsFirst(): Color[][] {
  return colorSubsets(COLORS).sort((a, b) => a.length - b.length);
}

/** What a search has found so far for one size. */
export interface BestDeckState {
  size: DeckSize;
  /** Builds planned; undefined while the pool is still being scanned. */
  planned: number | undefined;
  /** Builds finished, decks or not. */
  built: number;
  /**
   * The strongest decks so far, best first, for each most colors a deck may
   * have: index 0 holds mono-color decks, index 4 decks of any colors.
   */
  options: DeckOption[][];
  /** Commanders in the pool, at 100 once they are listed. */
  commanders?: number;
  done: boolean;
}

/** What one step did. */
export type BestDeckStep =
  | { kind: 'scan'; colors: Color[]; scan: ScanReport }
  | { kind: 'planned'; planned: number }
  | { kind: 'built'; key: string; changed: boolean };

export interface BestDeckSearch {
  readonly size: DeckSize;
  /** Runs the next scan or build; undefined once everything is done. */
  step(): BestDeckStep | undefined;
  state(): BestDeckState;
}

/**
 * A search for one deck size. Each step is one scan or one build, so a step
 * takes as long as the slowest build. The deck score can favor decks with
 * more colors, so the best decks are kept for each color limit and the
 * shell lets the player pick one. Options are ranked by deck score with
 * no picked colors, so no deck gets the all-colors bonus, and at most a few
 * share a style. At 60, 40, and 20 a deck that shares most of its cards with
 * a stronger one is dropped, as on the Build page; commanders of the same
 * colors draw on the same cards, so at 100 each commander keeps its deck.
 */
export function bestDeckSearch(
  size: DeckSize,
  pool: Pool,
  index: CardIndex,
  config: BulkBrewConfig,
  settings: Settings,
): BestDeckSearch {
  const state: BestDeckState = {
    size,
    planned: undefined,
    built: 0,
    options: COLORS.map(() => []),
    done: false,
  };
  const rankRequest = { size, colors: [], settings };

  function* run(): Generator<BestDeckStep, void, void> {
    let plans: BestDeckPlan[];
    if (size === 100) {
      // Listing scans each commander's colors once, the longest step at this size.
      const list = commanderCandidates(pool, index, config, settings).filter((c) => c.enough);
      state.commanders = list.length;
      plans = list.map((c) => ({ key: c.id, colors: c.colors, commander: c.id }));
    } else {
      const scans = new Map<string, ScanReport>();
      for (const subset of fewestColorsFirst()) {
        const scan = scanPool(pool, index, config, settings, size, subset);
        scans.set(subset.join(''), scan);
        yield { kind: 'scan', colors: subset, scan };
      }
      plans = bestDeckPlans(scans);
    }
    state.planned = plans.length;
    yield { kind: 'planned', planned: plans.length };

    for (const plan of plans) {
      let changed = false;
      try {
        const result = buildDeck(
          {
            size,
            colors: plan.colors,
            ...(plan.style ? { style: plan.style } : {}),
            ...(plan.commander ? { commander: plan.commander } : {}),
            settings,
            id: plan.key,
            createdAt: '',
          },
          pool,
          index,
          config,
        );
        // A deck joins the list for its own color count and every larger one.
        for (let k = plan.colors.length; k <= COLORS.length; k++) {
          const list = state.options[k - 1]!;
          const next =
            size === 100
              ? addCommanderDeck(list, plan.key, result, config)
              : addOption(list, plan.key, result, rankRequest, index, config);
          if (!sameOptions(next, list)) changed = true;
          state.options[k - 1] = next;
        }
      } catch (err) {
        // A plan the pool cannot build counts as checked; anything else is a bug.
        if (!(err instanceof BuildError)) throw err;
      }
      state.built += 1;
      yield { kind: 'built', key: plan.key, changed };
    }
  }

  const steps = run();
  return {
    size,
    step() {
      if (state.done) return undefined;
      const next = steps.next();
      if (next.done) {
        state.done = true;
        return undefined;
      }
      return next.value;
    },
    state: () => state,
  };
}

/** Ranks a commander's deck in with the others: by deck score, a few per style, capped. */
function addCommanderDeck(
  list: readonly DeckOption[],
  key: string,
  result: BuildResult,
  config: BulkBrewConfig,
): DeckOption[] {
  const cfg = config.builderWeights.buildOptions;
  // The rank deck options get with no picked colors and no secondary style.
  const option: DeckOption = {
    key,
    result,
    rank: result.explanation.score?.total ?? 0,
    allColors: true,
  };
  const ranked = [...list, option].sort(
    (a, b) => b.rank - a.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const perStyle = new Map<string, number>();
  return ranked
    .filter((o) => {
      const n = (perStyle.get(o.result.deck.archetype) ?? 0) + 1;
      perStyle.set(o.result.deck.archetype, n);
      return n <= cfg.maxPerStyle;
    })
    .slice(0, cfg.maxOptions);
}

/**
 * A data pack with only what a build reads from the index: the pool's cards
 * and the basic lands. Builds against it give the same decks as against the
 * full pack, at a fraction of its size, so it can be handed to a worker.
 */
export function poolPack(pool: Pool, index: CardIndex, config: BulkBrewConfig): DataPack {
  const cards = new Map<string, DataPack['cards'][number]>();
  for (const entry of Object.values(pool.entries)) {
    const card = index.get(entry.cardId);
    if (card) cards.set(card.id, card);
  }
  for (const c of COLORS) {
    const basic = index.find(config.landRules.basics.names[c]);
    if (basic) cards.set(basic.id, basic);
  }
  const list = [...cards.values()];
  return { ...index.pack, cardCount: list.length, cards: list };
}
