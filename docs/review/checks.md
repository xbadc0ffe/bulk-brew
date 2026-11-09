# Automatic deck checks

`npm run review:check` runs cheap checks on every stored review deck, independent of any judge. They back up the blind panel (`docs/review/rubric.md`); they do not replace it. Each check reuses the core's own rules where the core exports them. Where it cannot, or where the number only stands in for a judgment, the output says so.

Code: `packages/pipeline/src/review/check.ts` (the checks and the command) and `theme-rules.ts` (theme counting). Tests: `packages/pipeline/test/review-check.test.ts`.

## Commands

```sh
npm run review:check                                     # every deck under data/review/decks
npm run review:check -- --decks data/review/decks/head   # one version folder
npm run review:check -- --decks "data/review/decks/*/bulk-*-60-*.json"
npm run review:check -- --decks data/review/decks/head --rebuild
```

| Flag             | Meaning                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--decks <spec>` | Deck files: a folder (read recursively), a file, or a glob with `*` (inside one folder), `**` (any depth), and `?`. Several may follow `--decks`. Default `data/review/decks`. Quote globs in Git Bash. |
| `--out <dir>`    | Where results go. Default `data/review/checks`.                                                                                                                                                         |
| `--force`        | Recompute every check. Without it, a stored result is reused when the deck file, its `builtAt`, and the stamp (checker, data pack, config, and theme-rules versions) all match.                         |
| `--rebuild`      | Build each deck once more and compare (see Determinism). Slow at scale; off by default.                                                                                                                 |
| `--rules <file>` | Theme rules file. Default `packages/pipeline/src/review/theme-rules.json`.                                                                                                                              |

The pack, config, and default settings load once per run. About 2 seconds for 200 decks without `--rebuild`. The exit code is 1 when a deck file cannot be read, else 0; flags never change it.

## Output

- `data/review/checks/<version>/<deck file name>.json`: one result per deck.
- `data/review/checks/summary.json` and `summary.md`: per version and size, the pass rate of each check, the count of each flag, and medians of the numbers. The summary covers the decks of that run only, so a run on one folder replaces the summary of a full run.

A deck with `error` set (the version could not build the request) is not checked. Its result holds `declined` with the error, and the summary counts it as declined.

Every result also has `deck` (file, version, pool, request, built archetype, `builtAt`, `dataVersion`), `stamp`, and `flags`.

## The checks

### 1. Legality (`legality`)

- **Size.** Cards plus basics, commander included, against the requested size.
- **Copies.** The size's limit from `config/settings.defaults.json` through the core's `maxCopiesFor` (1 at 100, 4 at 60 and 40, 2 at 20). Basic lands are exempt. Card text such as "a deck can have any number of cards named" allows more at any size, through the core's `commanderCopies`. Duplicate rows of one card are added up first.
- **Colors.** At 100, every card's color identity within the commander's identity (`identityWithin`, the Commander rule). Below 100, the core's `playableWith`: every mana symbol in the card's costs and text payable with the deck's own colors (`allowed`; the request's in files without them), so a hybrid card fits either color. Cards whose identity leaves the colors but which are playable this way are listed in `identityOutside` and are not a failure. Lands, basics included, are judged by color identity against the deck's colors plus the requested ones (`allowedLands`): a best fit asked for black-green that built mono-black can keep Nurturing Peatland, which is legal, while a land of a color outside the request is off-color. Modal spell-lands count as spells here, as in the mana check.
- **Cards.** Un-set cards, cards not in the data pack, and at 100 cards banned or not legal in Commander.
- **Commander.** At 100, the deck needs one; it must be among the cards and pass the core's `canBeCommander` (CR 903.3, legendary creature and the like, legal in Commander).

Real decks fail these honestly: Limited decks with five copies of a common, draft decks with an off-color tri-land, and an older precon with a card banned since.

### 2. Mana (`mana`)

- **Land count.** Land cards (modal spell-lands count as spells, as in the core) plus basics, against what the core's `planLandCount` wants for this deck's own spells and template. `diff` is lands minus wanted; `formula` shows the raw value, clamp, average mana value, and cheap mana sources.
- **Color sources.** Per deck color, as the core's `chooseManaBase` counts them: basics, plus each land by `landColors`. In a multi-color deck a fetch land counts for a color only when the deck has a basic of it (the core's test for a fetch land is private; `check.ts` repeats it). `wantedSources` is the core's `colorWants`: the sources each color needs so its most demanding spell casts on curve at the color's target chance. The color plan comes from the core's `colorPlan` run on the deck's own spells; the builder runs it on the whole pool, so roles can differ.
- **Castability.** The share of spell copies the lands cast on curve, by the formula behind the builder's `score.castability`. That function is private in `builder.ts`, so it is recomputed from the same exported pieces (`pipDemand`, `sourcesNeeded`, and `castChance` from `config/land-rules.json`). `builderCastability` copies the version's own score when its explanation has one. The two can differ on multi-color decks because the color plan differs (see Color sources): on a head blue-red 60-card deck from `plain-01` the pool made blue the main color and the deck's spells make red, so the check reads 0.861 and the builder 0.944. With the pool's plan put in, the formula gave the builder's number exactly on that deck, a white-black-green 40 and a white-green 20 (2026-11-08); mono-color decks and the elf decks agree as stored. The check keeps the deck's own plan, so every version and the real decks are read the same way.

### 3. Curve (`curve`)

Spell copies per mana value bucket 0 to 7-plus, the commander left out (the builder counts its 99). The deviation is computed the way `metrics.ts` does: targets from the curve profile of the built archetype (`effectiveCurveProfile`, the template's for 20, 100, tribes, and unknown styles) through `curveTargets`; the sum over buckets 1 to 7 of the difference beyond the template's curve tolerance, with zero-drops counted as one-drops. Also the average mana value, copies at one (zero included), two, and three mana, and the shares at three or less and at five or more.

### 4. Interaction and threats (`interaction`, a proxy)

Copies meeting the builder's own roles from `config/roles.json`, through the core's matchers (`factsFor`, the same facts the card helper prints): `removal`, `sweeper`, `cheapInteraction`, `finisher`, `commanderFinisher`, `evasiveThreat`. `roles.json` has no counterspell role, so `counter` counts the `counterspell` tag that cheap interaction reads. `interaction` counts copies that are removal, a sweeper, or a counterspell, each card once; `threats` counts finishers, Commander finishers, and evasive creatures, each card once. The commander counts. These are the builder's definitions, not a reading of the cards: a burn deck has no "threats", and a 1/1 flier is one.

### 5. Theme counts (`themes`)

Honest setup and payoff counts from `packages/pipeline/src/review/theme-rules.json`, written from `docs/review/themes.md`. Until that file exists, `themes` is `null` in every result and the summary says so.

For the built archetype (`themes.archetype`), and for the requested style when it differs (`themes.requested`), each count holds `setupCopies`, `setupWeighted` (copies times job weight), `payoffCopies`, `payoffWeighted`, `dualResolved` (copies that met both jobs and were counted once), `excludedCopies`, `repeatableSetupCopies`, `ratio` (weighted setup per payoff copy, null without payoffs), and the `setup` and `payoff` cards with their jobs. A style the rules do not describe gives `{ "style": ..., "covered": false }`; plain shapes and tribes are never flagged for lacking a theme. Every card in the deck counts, basics and the commander included.

#### The rules file format

```json
{
  "version": "1",
  "styles": {
    "graveyard": {
      "resource": "cards in your graveyard",
      "setup": [
        {
          "job": "loots every turn",
          "weight": 2,
          "anyTags": ["loot"],
          "text": "\\{T\\}",
          "repeatable": true
        },
        { "job": "mills itself", "weight": 1, "anyTags": ["mill-self"] }
      ],
      "payoff": [
        { "job": "returns a creature card", "weight": 1, "anyTags": ["reanimate"] },
        { "job": "counts the graveyard", "weight": 1.5, "text": "for each card in your graveyard" }
      ],
      "exclude": [
        { "job": "one-off surveil rider", "anyTags": ["mill-self"], "text": "^surveil 1\\.$" }
      ]
    }
  }
}
```

- `version`: any non-empty string; it goes into every result's stamp, so changing it recomputes stored checks.
- `styles`: keyed by style id as decks record it (`config/archetypes.json` ids such as `graveyard`).
- `resource`: what the theme builds up and spends.
- `setup` and `payoff`: lists of rules. Each rule has:
  - `job`: a few words for what the card does;
  - `weight`: a number of 0 or more. Use about 1 for an ordinary piece, 2 for a strong repeatable one, 0.5 for a weak one-off, as the rubric counts strong setup as about two weak pieces;
  - conditions, of which a card must meet every one given: `anyTags` (at least one tag), `allTags` (every tag), `text` (a regular expression the oracle text matches), `notText` (one it must not match). At least one of `anyTags`, `allTags`, or `text` is required;
  - `repeatable`: optional, true when the job happens again and again; it is not a condition, only counted in `repeatableSetupCopies`.
- `exclude`: optional, same shape, `weight` not needed. A card that meets setup or payoff and also an exclude rule counts as neither.

Matching:

- Regular expressions are case-insensitive and multiline (`^` and `$` anchor one line), over the oracle text with reminder text in parentheses removed and the spaces it leaves at line ends trimmed. Oracle sentences end with a full stop: "Surveil 1. (Look at...)" reads as `Surveil 1.`, so `^surveil 1\\.$` matches it and `^surveil 1$` matches nothing. Faces of a multi-face card are joined by a `//` line, as in the pack. Escape braces for mana symbols: `\\{T\\}` in JSON.
- A card's best setup weight is the highest weight among the setup rules it meets; the same for payoff. A card meeting both counts once: as setup when its best setup weight is higher, else as payoff (a tie goes to payoff).
- Unknown keys (at the top level, in a style, or in a rule), bad regular expressions, and missing fields stop the run with every problem named. Style ids are not checked against `config/archetypes.json`: a misspelled id simply never matches a deck.

`EXAMPLE_THEME_RULES` in `theme-rules.ts` is this example; the tests use it. It is not a judgment on the Graveyard theme.

### 6. Determinism and time (`timing`)

`buildMs` comes from the deck file. With `--rebuild`, each deck is built once more through the runner's `runJob` (into `data/review/scratch/rebuild/`, so stored decks stay as built) and compared with the runner's `deckDifferences`: error, name, archetype, commander, card ids and quantities, and basics. `determinism` is null without `--rebuild`, else `{ checked: true, identical, differences, rebuildMs }` or `{ checked: false, reason }`. Skipped: `real` decks (not built), versions not in the registry, decks built on another data pack, and decks whose pool file changed since (its hash differs). Checked on 2026-11-08: all 9 head decks identical on rebuild, and a deck file edited by hand was flagged.

### 7. Dead cards (`dead`, a proxy)

Spells (the commander left out) with no role from `config/roles.json`, no enabler or payoff membership in any style of `config/archetypes.json`, no membership in the deck's tribe (creature type or `typal-` tag) when its style is a tribe, no setup or payoff job in the theme rules for its styles, and strength (the core's `cardStrength`) below the median of the pack's spells (Un-sets left out; 4.42 on the 2026-11-03 pack). It catches weak cards the builder's own definitions cannot explain. It does not catch a card that needs a resource the deck never makes.

## Flags

Each result has a `flags` array the report can count. The thresholds live in one block, `THRESHOLDS`, at the top of `check.ts`.

| Flag               | Raised when                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `size`             | the card count differs from the requested size                                                                                         |
| `copies`           | a card is over its copy limit                                                                                                          |
| `colors`           | a card or basic is off-color                                                                                                           |
| `illegal-card`     | any entry in `legality.illegal` (Un-set, not in the pack, Commander-banned or not legal at 100, a commander problem)                   |
| `lands-low`        | lands below the formula's count by more than 2 at 100 and 60, more than 1 at 40 and 20                                                 |
| `lands-high`       | lands above it by the same margins                                                                                                     |
| `sources-short`    | castability below 0.6                                                                                                                  |
| `curve-top-heavy`  | more than 45% of spells at five or more at 100 (35% at other sizes), or average mana value above 4.2 at 100, 4 at 60 and 40, 3.8 at 20 |
| `curve-flat`       | less than 40% of spells at three or less at 100 (45% at other sizes): no early peak                                                    |
| `no-removal`       | fewer than 3 interaction copies at 100, 2 at 60 and 40, 1 at 20                                                                        |
| `no-threat`        | fewer than 2 threat copies at 100, 1 at other sizes                                                                                    |
| `theme-no-setup`   | the style's minimums for the deck's size (`theme-rules.json`) miss a setup floor (`setup`, `setupWeight`, or `repeatable`)             |
| `theme-no-payoff`  | they miss a payoff floor (`payoff`, `payoffWeight`, or Burn's `repeatableOrPayoff`)                                                    |
| `theme-unbalanced` | they are met, but setup units are below half the payoff units (the theme guide's quick test)                                           |
| `nondeterministic` | the rebuild differs                                                                                                                    |
| `slow`             | build time over 1,000 ms at 100, 300 ms at other sizes                                                                                 |

Theme flags read the requested style when the request named one, else the built archetype, and only when the rules describe that style. With minimums for several alternatives, the flags name the side the closest alternative misses (`themes.*.minimums.short`). A style the rules cover without minimums falls back to the old placeholders in `THRESHOLDS`: weighted setup below 5 at 100, 3 at 60, 2 at 40, 1 at 20; payoff copies below 3 at 100, 2 at 60, 1 at 40 and 20; weighted setup per payoff copy below 0.75 or above 4. Every style in rules version 2 has minimums. The rules, their minimums, and how they were checked against real decks: `docs/review/theme-rules.md`.

### How the thresholds were set

The proxies were set so the real-deck anchors mostly pass, from a run over 170 real decks (`data/review/decks/real`: 40 Commander precons, 40 60-card precons, 60 winning draft decks, 30 20-card packets) on 2026-11-08:

- `sources-short` does not use the core's per-color `colorWants`. Its gap (`mana.sourceGap`, still reported) has a median of 3 sources for real multi-color 60 and 40-card decks (2 for two-color ones) and 11 for real multi-color Commander precons, so it would flag most real multi-color decks. Castability below 0.6 flags 18 of 170 real decks, mostly older multi-color precons and three-color draft decks.
- The curve thresholds are looser at 100 because real Commander precons run more top end than the builder's Commander profile (among the multi-color ones, a median of 52% of spells at three or less, and 41% or less for one in ten).
- A `no-threat` minimum of 2 at 60 and 40 flagged 14 real decks with one big or evasive creature; at 1 it flags 5 (burn, control, and a Snakes packet), which is the proxy's known blind spot.
- The theme flags read the minimums in `theme-rules.json`, set from the theme guide and checked against real decks in `docs/review/theme-rules.md`. Revisit them against the panel.

Do not tune these against the builder versions under review; recheck them against the anchors and the panel.

The checks are sanity gates, not a quality score. On a partial Phase 3 run (`npm run review:check -- --decks data/review/decks --force`, 12,250 decks, 2026-11-08), random piles raised no flag in 87% of 60-card and 54% of 20-card decks, while real 60-card precons raised none in 68%. Report flag counts per check next to the panel; never read "No flags" as a decent rate. `slow` also counts in "No flags", and `head-web` times the whole deck-option search, so it is slow by design.
