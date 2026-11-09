// What a web user opens. The web Build page never calls buildDeck for a best fit:
// its worker (packages/ui/src/data/deckOptions.worker.ts) runs deckOptionSearch,
// which builds every viable style in each subset of the picked colors and ranks
// the decks, and the user opens the first. This version records that first option.

import {
  BuildError,
  configVersion,
  deckOptionSearch,
  normalizeColors,
  type OptionsRequest,
  type Settings,
} from '@bulk-brew/core';
import type { BuilderVersion, ReviewRequest } from '../version.ts';
import { toBuiltDeck } from './head.ts';

/**
 * The request useDeckOptions sends: a picked style is the primary, a commander
 * fixes the colors. The Build page offers a secondary only once a primary is picked.
 */
export function toOptionsRequest(request: ReviewRequest, settings: Settings): OptionsRequest {
  return {
    size: request.size,
    colors: request.colors,
    settings,
    ...(request.style ? { primary: request.style } : {}),
    ...(request.style && request.secondary ? { secondary: request.secondary } : {}),
    ...(request.commander ? { commander: request.commander } : {}),
  };
}

function round1(ms: number): number {
  return Math.round(ms * 10) / 10;
}

const headWeb: BuilderVersion = {
  id: 'head-web',
  label: 'Current builder, first web Build page option (HEAD)',
  notes:
    'deckOptionSearch from the current core, as the web Build page worker runs it, with config/ and data/learned.json; the first ranked option is the deck. buildMs is the whole search. Ignores the seed.',
  prepare(ctx) {
    const learned = ctx.index.learnedVersion;
    return `Config ${configVersion(ctx.config)}${learned ? `, learned data ${learned}` : ''}.`;
  },
  build(ctx) {
    // useDeckOptions stays idle with no colors, as under a colorless commander.
    if (ctx.request.colors.length === 0)
      throw new BuildError('The Build page shows no deck options without a color.');
    const search = deckOptionSearch(
      toOptionsRequest(ctx.request, ctx.settings),
      ctx.pool,
      ctx.index,
      ctx.config,
    );
    // One scan, the plan, or one build per step, so the chosen deck's own time can be kept apart.
    const buildMs = new Map<string, number>();
    let planMs = 0;
    for (;;) {
      const t0 = performance.now();
      const step = search.step();
      if (!step) break;
      const ms = performance.now() - t0;
      if (step.kind === 'built') buildMs.set(step.key, ms);
      else planMs += ms;
    }
    const state = search.state();
    const top = state.options[0];
    if (!top) {
      throw new BuildError(
        state.primaryUnavailable
          ? `None of the picked colors can build ${ctx.request.style}.`
          : (state.failure ?? 'The picked colors do not have enough cards for this deck size.'),
      );
    }
    const built = toBuiltDeck(top.result);
    const deck = top.result.deck;
    return {
      ...built,
      explanation: {
        ...top.result.explanation,
        // What the Build page showed: the options in order, and the one recorded here.
        web: {
          key: top.key,
          style: deck.archetype,
          // A best fit can use fewer colors than were picked; the request keeps the picked ones.
          colors: normalizeColors(deck.colors ?? [deck.color]),
          rank: round1(top.rank),
          optionCount: state.options.length,
          planned: state.planned ?? 0,
          built: state.built,
          options: state.options.map((o) => ({ key: o.key, rank: round1(o.rank) })),
          // Scans and the plan, then the chosen deck's own build; buildMs is the whole search.
          planMs: round1(planMs),
          deckMs: round1(buildMs.get(top.key) ?? 0),
        },
      },
    };
  },
};

export default headWeb;
