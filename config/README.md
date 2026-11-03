# Config

Versioned data files that hold every judgment call the builder makes. Logic lives in `packages/core`; numbers and rules live here, so tuning never needs a code change. Both apps load these files, and the iOS app can refresh them over the air together with the card data. The reasoning behind the numbers is in `docs/guides/`.

| File                     | Purpose                                                                                                              | Status  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------- |
| `settings.defaults.json` | Default user settings: copy limits per deck size, unlimited basics, Un-sets, art toggle.                             | present |
| `deck-templates.json`    | Per deck size: base lands and land formula, default curve profile, type mix, role quotas, tolerances.                | present |
| `curve-profiles.json`    | Spell distributions by mana value: aggro, midrange, control, jumpstart.                                              | present |
| `roles.json`             | Role definitions (removal, card advantage, finisher, ...) as matchers over tags, keywords, types, and derived facts. | present |
| `archetypes.json`        | Synergy archetypes (enablers, payoffs, minimums) and composition archetypes (aggro, midrange, control).              | present |
| `synergy-rules.json`     | Enabler and payoff matcher pairs with weights.                                                                       | present |
| `land-rules.json`        | Basic land names, nonbasic scoring, colorless land caps, modal land faces.                                           | present |
| `builder-weights.json`   | Objective weights, tiebreak order, local search limits.                                                              | present |
| `tag-overlay.json`       | Local tag fixes and gap-fills applied on top of Scryfall Tagger tags at pipeline time.                               | present |
| `display-tags.json`      | Short tags shown on cards and offered as filters ("Removal", "Draw", "+1/+1"), from roles, styles, and tags.         | present |

Every file carries a `version` field. A deck records the joined config version it was built with (see `configVersion()` in `packages/core/src/config.ts`). `display-tags.json` is display only: the builder never reads it, so it is not part of that version.

Edit, then run `npm run config:check`: it validates shapes and cross-references, confirms every tag slug exists in the current data pack, and prints per-color match counts for each role, archetype, and display tag. The same validation runs in `npm test`.

Builder tiebreaks in `builder-weights.json` apply in list order after one fixed leading check: a card that fills a curve bucket still below its target beats one that does not. Card id breaks any remaining tie.
