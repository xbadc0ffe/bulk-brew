# Corpus-led tuning

A brief for a session that improves the deck builder. The goal: decks closer to real, well-built decks at all four sizes (100 Commander, 60, 40, 20), measured with the reference corpus, without overfitting. The owner approved the four-step plan below. Work through it in order without stopping between steps, and report after each one.

## Status (2026-11-05)

Steps 1 to 3 shipped in 26.0.26 to 26.0.28. Step 4 shipped as 26.0.29 and was reverted in 26.0.30: it made Graveyard about a third of 60 and 40-card best fits (see the first Builder follow-up in `docs/todo.md`). The live builder is step 3.

Live against the 54165ab baseline (train; test in brackets):

| size | self fail  | style match                 | lands ours/real   | avg mana value ours/real | extra ramp |
| ---- | ---------- | --------------------------- | ----------------- | ------------------------ | ---------- |
| 100  | 117 -> 10  | 0.41 -> 0.50 [0.42, same]   | 36.0 -> 37.3/38.0 | 3.48 -> 3.49/3.62        | 2.4 -> 0.6 |
| 60   | 205 -> 4   | 0.17 -> 0.16 [0.06 -> 0.22] | 23.1 -> 24.0/24.8 | 3.19 -> 3.05/3.01        | 3.1 -> 2.5 |
| 40   | 886 -> 131 | 0.20, same [0.16 -> 0.14]   | 16.5 -> 16.4/16.8 | 3.10 -> 2.99/3.00        | 1.8 -> 1.5 |
| 20   | 99 -> 3    | 0.19 -> 0.20 [0.18 -> 0.27] | 8.0 -> 8.0/8.0    | 2.90 -> 3.00/3.06        | 1.2 -> 0.9 |

Style match is measured against the current style list. Changes of a few decks at 60 and 20 (test) are within noise.

## Read first

- `CLAUDE.md`: rules, working style, decision authority
- `SPEC.md`: Builder, Commander, Evaluation (the "Reference corpus" bullet), Decisions
- `docs/todo.md`: "Builder follow-ups", first item ("Corpus-led tuning")
- `eval/README.md`: the "Reference corpus" section
- `data/corpus/report.md`: the latest suggestions report (gitignored, local only)
- `packages/pipeline/src/corpus.ts`, `corpus-fetch.ts`, `corpus-eval.ts`, `corpus-learn.ts`

## The corpus tools

- `npm run corpus:fetch` collects real decks into `data/corpus/` (gitignored). It is already done: 55,446 decks.
  - Official precons from MTGJSON: 183 Commander, about 280 60-card, 510 Jumpstart.
  - 54,000 Arena draft decks with win/loss records, from 18 sets of 17Lands data.
  - The owner's 8 Moxfield lists (source `local`).
  - If `data/corpus/decks.json` is missing, rerun: `npm run corpus:fetch -- --drafts FDN,DSK,BLB,OTJ,MKM,LCI,WOE,MOM,ONE,DMU,DFT,TDM,FIN,EOE,TLA,ECL,TMT,SOS --local test-bulk`
- `npm run corpus:eval` shuffles each reference deck into a seeded random bulk of about 3,000 cards, builds at the deck's size (under its commander at 100, in its colors otherwise), and compares the build with the deck.
  - It also builds each deck from its own cards alone ("self"), to test the gates and our deck score.
  - One deck in five is a held-out test split. A full run takes about 20 minutes; use `--sizes` and `--limit` for quick iteration.
  - Results go to `data/corpus/results/`, and each run prints deltas against the previous run with the same options.
- `npm run corpus:learn` rewrites `data/corpus/report.md`: deck shapes against our templates, commander plans (card tags over-represented under commander tags), theme coverage, card traits against bulk, and what goes with winning in draft.

## Baseline

Measured at commit 54165ab, config t4.c3.r2.a8.s7.l3.w8.k1. The results file is `data/corpus/results/2026-11-05-54165ab-dirty.json`. "Ours/real" pairs compare our builds with the reference decks.

| size | decks | self fail | recall | style match | ref ahead | lands ours/real | avg mana value ours/real |
| ---- | ----: | --------: | -----: | ----------: | --------: | --------------: | -----------------------: |
| 100  |   182 |       117 |   0.21 |        0.47 |         0 |       36.0/38.0 |                3.48/3.62 |
| 60   |   277 |       205 |   0.07 |        0.14 |         0 |       23.1/24.8 |                3.19/3.01 |
| 40   |  2000 |       886 |   0.04 |        0.19 |         0 |       16.5/16.8 |                3.10/3.00 |
| 20   |   509 |        99 |   0.04 |        0.17 |         0 |         8.0/8.1 |                2.90/3.06 |

What the columns mean:

- **self fail:** reference decks the builder can't build from their own cards.
- **recall:** share of the deck's spells our build used.
- **style match:** our style is one the deck meets.
- **ref ahead:** share of decks where our score rates the deck's self build at least as high as our bulk build.

Role gaps, our builds minus the reference decks: ramp is 1 to 3 over at every size, big threats 1 to 3 over, and card draw at 100 is about 1 under (precons have a median of 14 against our target of 10).

## Ground rules for tuning

- **Train and test:** tune on `--split train`. Keep a change only if `--split test` does not get worse. Report both.
- **Synthetic pools too:** after any builder or config change, also run `npm run eval` and compare the per-size deltas with the committed baseline in `eval/results/` (CLAUDE.md requires it). Commit a new full baseline when a step moves the numbers, as SPEC.md describes.
- **No tuning to the 8 Moxfield decks.** The owner worries about overfitting, and the corpus exists for that reason. For example, Commander precons average 3.62 mana per spell, so the 8 Moxfield decks' 2.3 to 2.9 is not a reason to lower the Commander curve.
- **Precons are a floor, not a ceiling.** A build stronger than a precon is fine; one that misses its plan is not.
- **Draft win correlations are small** (under 0.07 either way), so treat them as tiebreakers, not big swings. Removal, cheap interaction, 2-drops, and more copies of fewer distinct cards go with winning; expensive top end goes with losing.
- **The builder must stay deterministic.**

## The plan

### 1. Fix the scan gates that block self builds, at every size

In `packages/core/src/scan.ts`, `scanCandidates`:

- Spell slots are computed from the template's base lands, but the builder can pad lands up to `landFormula.max`. Decks that run more lands fail with "needs N more spells". This is most of the failures at 100 and 60.
- At 100 the commander's identity sets the colors, so the colored-share check (`MIN_COLORED_SHARE`) and the per-color minimums (`minCardsPerColor`) shouldn't block a deck.
- At 40 and 20, "needs N more cards of one color" is the main failure: 673 of 2000 draft decks, mostly ones with a light splash. First decide whether this is a real gate problem or an artifact of how corpus-eval picks colors (the union of every spell's colors). In the app, the Build page tries every subset of the picked colors. Either treat a light color as a splash in the gate, or make the eval try the deck's colors with and without the splash.
- The Build page reads the scan too (color counts, near misses, the "possible" flag), so check those still behave.
- Target: self fail near 0 at every size, with no regressions in `npm run eval`.

### 2. Commander plans and styles

- **Tappers style:** tag `tapper-creature` and `freeze-creature` cards as enablers and `hate-tapped` and `synergy-tapped` cards as payoffs, in `config/archetypes.json` and `config/synergy-rules.json`. A prototype moved Hylda of the Icy Crown from 36th to 10th in the commander list.
- **Commander style bonus:** best fit still picked +1/+1 counters for Hylda, because the commander style bonus (`builderWeights.commander.styleBonus`) applies to every style the commander touches. Make best fit favor the commander's most specific style.
- **Tribe as primary:** let a tribe be the primary style when the commander's own text names the tribe (The Ur-Dragon, Reaper King, Winota). The owner approved this; update the SPEC decision "Tribal is a secondary style, not a primary one."
- **More styles from report section 3:** add the plans the report finds in several products, such as group hug and group slug, discard and madness, forcing opponents to attack (goad), lands-matter, energy, and casting from exile. Add only the ones the data supports, measured by style match at 100 and theme coverage in the report. Note the report marks `typal-*` tags "not covered" because tribes match type lines, not tags.
- **Theme density:** a Commander theme currently fills only to its minimum; a forced Tappers build played just 16 tappers. Consider a target.
- New archetype entries are config content, not a format change. Bump the config file versions.

### 3. Card counts toward real decks

- Use report section 1 and the eval's ours/real pairs: lands at 100 and 60, ramp and big threats at every size, card draw at 100, creature share at 60, curve per size.
- The settings live in `config/deck-templates.json` and `config/curve-profiles.json`. Update `docs/guides/` when the reasoning changes; guides restate outside material in our own words, with no source names.

### 4. Rework the deck score

In `scoreDeck` (`packages/core/src/builder.ts`) and `deckScore` (`config/builder-weights.json`):

- Today "ref ahead" is 0 at every size: our score never rates a real deck above our own build. The synergy term is 60% of the score and counts generic enabler/payoff pairs, while real decks' synergy is plan-specific.
- The owner's view: a score that rewards strong cards together builds bad decks; synergy and a working plan should win. Scores stay internal, never shown.
- Targets: raise "ref ahead" and style match without breaking option ranking.

## Working style

These come from CLAUDE.md and the owner's preferences:

- One step at a time. Each ends with `npm run check` green.
- The owner's loop: implement, have a fresh agent review the diff, verify in the browser, then commit.
  - Browser check: `npm run build -w @bulk-brew/web`, then `npx -w @bulk-brew/web vite preview --port 4173 --strictPort` in the background, then `npm run smoke`, plus `SMOKE_SIZE=100 npm run smoke`.
- Commit when a step is green. Bump `version` in the root, web, mobile, and ui `package.json` files in its own commit when a shipped change lands (currently 26.0.30).
- Push at the end of each step. The owner tests only on the live site, so after each push watch the deploy and run `npm run smoke -- https://xbadc0ffe.github.io/bulk-brew/`.
- Stop and ask before: adding a dependency, changing the data pack schema, changing a config file format, touching `ATTRIBUTION.md` or `LICENSE`, or publishing a data release. Don't run the "Refresh card data" workflow without asking. It publishes a public release; the weekly run on Monday, Nov 9, ships the flavor-name support already in the code.
- Keep `SPEC.md` and `docs/todo.md` current as decisions change.
- Record each step's corpus summary (train and test, per size) in the commit body so progress is traceable across sessions.
- After each step, report to the owner in plain language: what changed, the before and after numbers, and what they'll notice in the app. The owner isn't deep in the code, so lead with the outcome and skip jargon.

## Out of scope

Partner and Background commanders, colorless commanders, and the mobile app's phase 8.
