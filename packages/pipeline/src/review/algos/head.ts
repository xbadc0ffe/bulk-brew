// The current builder, run as demo:build runs it: buildDeck from @bulk-brew/core
// with config/, config/learned/, and data/learned.json (the runner loads those).

import {
  buildDeck,
  configVersion,
  normalizeColors,
  type BuildRequest,
  type BuildResult,
  type Settings,
} from '@bulk-brew/core';
import type { BuilderVersion, BuiltDeck, ReviewRequest } from '../version.ts';

export function toBuildRequest(request: ReviewRequest, settings: Settings): BuildRequest {
  return {
    size: request.size,
    colors: request.colors,
    settings,
    // A requested style must be built or fail, so style comparisons never get a best fit in disguise.
    ...(request.style ? { style: request.style, requireStyle: true } : {}),
    ...(request.secondary ? { secondary: request.secondary } : {}),
    ...(request.commander ? { commander: request.commander } : {}),
    // Fixed id and time keep the deck free of clocks.
    id: 'review',
    createdAt: 'review',
  };
}

export function toBuiltDeck(result: BuildResult): BuiltDeck {
  const { deck } = result;
  return {
    name: deck.name,
    archetype: deck.archetype,
    colors: normalizeColors(deck.colors ?? [deck.color]),
    ...(deck.commander ? { commander: deck.commander } : {}),
    cards: deck.cards.map((c) => ({
      id: c.cardId,
      qty: c.qty,
      ...(c.why ? { why: c.why } : {}),
    })),
    basics: deck.basics,
    explanation: result.explanation,
  };
}

const head: BuilderVersion = {
  id: 'head',
  label: 'Current builder (HEAD)',
  notes: 'buildDeck from the current core with config/ and data/learned.json. Ignores the seed.',
  prepare(ctx) {
    const learned = ctx.index.learnedVersion;
    return `Config ${configVersion(ctx.config)}${learned ? `, learned data ${learned}` : ''}.`;
  },
  build(ctx) {
    const result = buildDeck(
      toBuildRequest(ctx.request, ctx.settings),
      ctx.pool,
      ctx.index,
      ctx.config,
    );
    return toBuiltDeck(result);
  },
};

export default head;
