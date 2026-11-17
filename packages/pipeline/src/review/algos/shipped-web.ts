// The shipped builder's first web Build page option: deckOptionSearch from a
// worktree at the shipped commit, recorded as head-web records the current one
// (docs/review/runner.md, "The shipped worktree").

import type { BuilderVersion } from '../version.ts';
import { webFirstOption } from './head-web.ts';
import {
  loadShipped,
  shippedFor,
  toBuiltShipped,
  toShippedOptionsRequest,
  withShippedErrors,
} from './shipped-core.ts';

const shippedWeb: BuilderVersion = {
  id: 'shipped-web',
  label: 'Shipped builder, first web Build page option (worktree)',
  notes:
    'deckOptionSearch from the core of a worktree at the shipped commit (REVIEW_WORKTREE_SHIPPED), as that web Build page worker runs it, with its config/ as its own loadConfigDir reads it, its config/learned/ and data/learned.json, and the current data pack; the first ranked option is the deck. buildMs is the whole search. Ignores the seed.',
  async prepare(ctx) {
    return (await loadShipped(ctx)).notes;
  },
  build(ctx) {
    const s = shippedFor(ctx.root, 'shipped-web');
    return withShippedErrors(s, () =>
      webFirstOption(
        ctx.request,
        () =>
          s.core.deckOptionSearch(
            toShippedOptionsRequest(ctx.request, s.settings),
            ctx.pool,
            s.index,
            s.config,
          ),
        toBuiltShipped,
      ),
    );
  },
};

export default shippedWeb;
