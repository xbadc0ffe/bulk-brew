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
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hash32 } from '../../corpus.ts';
import type { BuilderVersion, BuiltDeck, ReviewRequest } from '../version.ts';

const coreHashes = new Map<string, string>();

/**
 * FNV-1a of packages/core/src (paths and text, line endings folded), so a deck's
 * notes say which core built it, committed or not, and the runner rebuilds decks
 * an older core made.
 */
export function coreSourceHash(root: string): string {
  let h = coreHashes.get(root);
  if (h) return h;
  const dir = path.join(root, 'packages', 'core', 'src');
  const files = (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.ts'))
    .sort();
  const text = files
    .map((f) => `${f}\n${readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n')}`)
    .join('\n');
  h = hash32(text).toString(16).padStart(8, '0');
  coreHashes.set(root, h);
  return h;
}

/** The notes head and head-web add to every deck: core, config, and learned data. */
export function headNotes(ctx: {
  root: string;
  config: Parameters<typeof configVersion>[0];
  index: { learnedVersion?: string | undefined };
}): string {
  const learned = ctx.index.learnedVersion;
  return `Core ${coreSourceHash(ctx.root)}, config ${configVersion(ctx.config)}${learned ? `, learned data ${learned}` : ''}.`;
}

function toBuildRequest(request: ReviewRequest, settings: Settings): BuildRequest {
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
    return headNotes(ctx);
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
