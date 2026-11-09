// b-oldrules: prototype B's algorithm with setup and payoff from the live
// config's style matchers and minimums, so the review can tell definitions
// from algorithm. Design: docs/review/proto-b.md.

import type { BulkBrewConfig, CardIndex } from '@bulk-brew/core';
import type { BuilderVersion } from '../../version.ts';
import { buildB, makeContext } from './builder.ts';
import { oldRulesDefs, withBulkBaseline, type ThemeDefs } from './defs.ts';

const defsByConfig = new WeakMap<BulkBrewConfig, ThemeDefs>();

// The bulk baseline reads the whole pack once, so it is built here, outside build times.
function defsFor(config: BulkBrewConfig, index: CardIndex): ThemeDefs {
  let defs = defsByConfig.get(config);
  if (!defs)
    defsByConfig.set(config, (defs = withBulkBaseline(oldRulesDefs(config), index, config)));
  return defs;
}

const oldrules: BuilderVersion = {
  id: 'b-oldrules',
  label: 'Prototype B: seed and grow (config matchers)',
  notes:
    'b-grow with setup and payoff from the enabler and payoff matchers in config/archetypes.json (a card both counts as payoff), weights 1, and its minimums. Ignores the seed.',
  prepare(ctx) {
    return `Definitions: ${defsFor(ctx.config, ctx.index).name}.`;
  },
  build(ctx) {
    const defs = defsFor(ctx.config, ctx.index);
    return buildB(makeContext(ctx.pool, ctx.request, ctx.index, ctx.config, ctx.settings, defs));
  },
};

export default oldrules;
