// The shipped builder's core best fit: buildDeck from a worktree at the shipped
// commit, as head runs the current one (docs/evaluation.md, "The shipped worktree").

import type { BuilderVersion } from '../version.ts';
import {
  loadShipped,
  shippedFor,
  toBuiltShipped,
  toShippedBuildRequest,
  withShippedErrors,
} from './shipped-core.ts';

const shipped: BuilderVersion = {
  id: 'shipped',
  label: 'Shipped builder, core best fit (worktree)',
  notes:
    'buildDeck from the core of a worktree at the shipped commit (REVIEW_WORKTREE_SHIPPED), with its config/ as its own loadConfigDir reads it, its config/learned/ and data/learned.json, and the current data pack. Ignores the seed.',
  async prepare(ctx) {
    return (await loadShipped(ctx)).notes;
  },
  build(ctx) {
    const s = shippedFor(ctx.root, 'shipped');
    return withShippedErrors(s, () =>
      toBuiltShipped(
        s.core.buildDeck(
          toShippedBuildRequest(ctx.request, s.settings),
          ctx.pool,
          s.index,
          s.config,
        ),
      ),
    );
  },
};

export default shipped;
