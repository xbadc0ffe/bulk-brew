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
| `builder-weights.json`   | Objective weights, tiebreak order, local search limits, deck score weights, best fit candidate counts.               | present |
| `card-strength.json`     | Card strength score weights: popularity, stats, keywords, effects, removal quality, cost, pips.                      | present |
| `theme-rules.json`       | Setup and payoff jobs per themed style, the false friends, and the minimums a decent bulk deck needs at each size.   | present |
| `theme-bulk.json`        | Computed: each themed style's mean setup and payoff per bulk card of each color class. Never edited by hand.         | present |
| `tag-overlay.json`       | Local tag fixes and gap-fills applied on top of Scryfall Tagger tags at pipeline time.                               | present |
| `display-tags.json`      | Short tags shown on cards and offered as filters ("Removal", "Draw", "+1/+1"), from roles, styles, and tags.         | present |
| `learned/plans.json`     | Learned from real decks: each style's profile per size (theme cards, roles, curve, types) and theme shares in bulk.  | present |
| `learned/tags.json`      | Learned from real decks: tags each style's decks play more than real decks in general, and tag pairs.                | present |

Every file carries a `version` field. A deck records the joined config version it was built with (see `configVersion()` in `packages/core/src/config.ts`). `display-tags.json` is display only: the builder never reads it, so it is not part of that version.

`theme-rules.json` holds the theme guide (`docs/review/themes.md`) as rules: each rule reads a card's tags, types, keywords, mana value, and power, and regular expressions over its oracle text (reminder text removed) and type line. A card counts once per style, as setup or as payoff. Besides the rules and `minimums`, a style can give `kin` (other styles that use the same resource, nearest first: where a request the pool cannot support falls back), `setupNeedsPayoff` (its setup does nothing without its own payoffs, so other themes do not take it as setup), and `lacks` (for every floor its minimums use, a short phrase a player reads when the pool misses it). The format and how the rules were set: `docs/review/theme-rules.md`. Any edit bumps the rules `version` and must be followed by `npm run theme:bulk`: `theme-bulk.json` records the rules version it was computed with, and validation fails while the two differ.

`theme-bulk.json` is written by `npm run theme:bulk` from the data pack and the rules, never by hand: every common and uncommon (Un-sets left out, nonlands plus modal double-faced land cards), read at 60 cards. It records the data pack it was read from; rerun it after a new pack. Its version is a hash of the content and joins the config version.

`learned/` is written by `npm run learn:build`, never by hand; its versions are hashes of the content and join the config version. The judgment about how the builder uses it (weights per size, combo results and brackets) stays in `builder-weights.json` under `learned` and `combos`.

Edit, then run `npm run config:check`: it validates shapes and cross-references, confirms every tag slug exists in the current data pack, and prints per-color match counts for each role, archetype, and display tag. The same validation runs in `npm test`.

Builder tiebreaks in `builder-weights.json` apply in list order after one fixed leading check: a card that fills a curve bucket still below its target beats one that does not. Card id breaks any remaining tie.

The `grow` block in `builder-weights.json` holds the constants of the grow builder (`packages/core/src/grow.ts`), which builds a style the player asks for by name at 60, 40, and 100 cards from the theme rules. The reasoning behind each is in `docs/review/proto-b.md`, "Constants".

| Key                 | Meaning                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marginFull`        | Best fit (not used by `buildDeck` yet): a theme whose pool holds this many times its floors counts in full.                                           |
| `richnessCap`       | Best fit: richness over plain bulk (`theme-bulk.json`) counts up to this.                                                                             |
| `richSeed`          | Seed this much over the payoff floor when both halves of the pool hold twice their floors.                                                            |
| `commanderCredit`   | Copies a commander's theme job counts as. The rules count a commander as one card, so 1.                                                              |
| `commanderPlan`     | Best fit: a theme the commander pays off scores this much higher.                                                                                     |
| `offPlanGateWeight` | A payoff of another style at this weight or more enters only when that style's setup in the deck covers it.                                           |
| `fullSlot`          | A theme card whose mana value slot is already at its curve target counts this much in the seed and grow steps.                                        |
| `setupPull`         | Extra value the plan's setup keeps in the role and curve fills while the deck sits at its setup floor.                                                |
| `setupTarget`       | The setup pull fades to nothing at this multiple of the setup floor (above 1).                                                                        |
| `nearMargin`        | A style whose pool reaches this share of its floors is short: offered, and answered with a note and the nearest deck. Below it the style is left out. |
