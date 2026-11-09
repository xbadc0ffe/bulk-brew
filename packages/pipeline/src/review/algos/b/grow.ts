// b-grow: prototype B, seed and grow, with setup and payoff from the review's
// theme rules (theme-rules.json). Design: docs/review/proto-b.md.

import type { BulkBrewConfig, CardIndex } from '@bulk-brew/core';
import type { BuilderVersion } from '../../version.ts';
import { buildB, makeContext } from './builder.ts';
import { loadRulesDefs, withBulkBaseline, type ThemeDefs } from './defs.ts';

// Loaded at prepare() time, once per config the runner passes.
const defsByConfig = new WeakMap<BulkBrewConfig, ThemeDefs>();

// The bulk baseline reads the whole pack once, so it is built here, outside build times.
function defsFor(config: BulkBrewConfig, index: CardIndex): ThemeDefs {
  let defs = defsByConfig.get(config);
  if (!defs)
    defsByConfig.set(config, (defs = withBulkBaseline(loadRulesDefs(config), index, config)));
  return defs;
}

const grow: BuilderVersion = {
  id: 'b-grow',
  label: 'Prototype B: seed and grow (theme rules)',
  notes:
    'Seeds the payoffs the pool supports, grows setup to their demand, then roles, curve slots, and the core land formula. Setup and payoff from theme-rules.json. Ignores the seed.',
  prepare(ctx) {
    return `Definitions: ${defsFor(ctx.config, ctx.index).name}.`;
  },
  build(ctx) {
    const defs = defsFor(ctx.config, ctx.index);
    return buildB(makeContext(ctx.pool, ctx.request, ctx.index, ctx.config, ctx.settings, defs));
  },
};

export default grow;
