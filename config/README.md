# Config

Versioned data files that hold every judgment call the builder makes. Logic lives in `packages/core`; numbers and rules live here, so tuning never needs a code change. Both apps load these files, and the iOS app can refresh them over the air together with the card data.

| File                     | Purpose                                                                                                 | Status  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------- |
| `settings.defaults.json` | Default user settings: copy limits per deck size, unlimited basics, Un-sets, art toggle.                | present |
| `deck-templates.json`    | Per deck size: land formula constants, curve targets, type mix, role quotas, tolerances.                | phase 4 |
| `roles.json`             | Role definitions (removal, draw, ramp, finisher, ...) mapped to Tagger tags and derived facts.          | phase 4 |
| `archetypes.json`        | Synergy archetypes (enabler and payoff tag sets) and composition archetypes (aggro, control, midrange). | phase 4 |
| `synergy-rules.json`     | Enabler and payoff tag pairs with weights.                                                              | phase 4 |
| `land-rules.json`        | Basic land handling, nonbasic evaluation, colorless lands in colored decks.                             | phase 4 |
| `builder-weights.json`   | Relative weight of curve fit, type mix, role quotas, synergy density, tiebreaks.                        | phase 5 |
| `tag-overlay.json`       | Local tag fixes and gap-fills applied on top of Scryfall Tagger tags at pipeline time.                  | phase 2 |

Every file carries a `version` field. A deck records the config version it was built with.
