// The two A' versions share one builder and differ only in their search.

import type { BuilderVersion } from '../../version.ts';
import { toBuildRequest, toBuiltDeck } from '../head.ts';
import { buildDeckA, type SearchFn } from './builder.ts';
import { loadRulesOrExample, type LoadedRules } from './theme.ts';

export function makeVersion(
  id: string,
  label: string,
  notes: string,
  search: SearchFn,
): BuilderVersion {
  // Loaded at prepare(), outside build times; a direct build() loads it on first use.
  let loaded: LoadedRules | undefined;
  return {
    id,
    label,
    notes,
    prepare() {
      loaded = loadRulesOrExample();
      return loaded.note;
    },
    build(ctx) {
      loaded ??= loadRulesOrExample();
      const result = buildDeckA(
        toBuildRequest(ctx.request, ctx.settings),
        ctx.pool,
        ctx.index,
        ctx.config,
        { rules: loaded.rules, search },
      );
      return toBuiltDeck(result);
    },
  };
}
