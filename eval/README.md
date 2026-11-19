# Evaluation

Regression tests for deck quality. Run the suite after every builder or config change and compare the numbers with the previous run. Builder changes ship on the blind review panel, not on these numbers: see `docs/evaluation.md`.

## Running

```sh
npm run data:pull      # or data:fetch and data:build; the suite needs data/packs/cards.json
npm run eval           # best fit for every pool, size, and color the scan allows, plus Commander
npm run eval -- --styles          # also build every viable style
npm run eval -- --pools bulk      # only pools whose file name contains "bulk"
npm run eval -- --colors pairs    # also every two-color set ("all": every set of one to five colors)
npm run eval -- --commanders 0    # skip Commander (default: the two most promising commanders per pool)
npm run eval -- --dir test-bulk --combine   # a local folder of lists as one pool; results stay there
npm run eval:pools     # regenerate the synthetic pools (keeps existing files unless --force)
```

The same suite runs on demand in GitHub Actions ("Evaluate decks" workflow) and uploads the results as an artifact.

## Reference corpus

A second, larger check against decks people built: official preconstructed decks and Arena draft decks. Everything lands in `data/corpus/` (gitignored).

```sh
npm run corpus:fetch                          # preconstructed decks: Commander, 60-card, Jumpstart (about 260 MB, once a week at most)
npm run corpus:fetch -- --drafts FDN,DSK,BLB  # also 40-card draft decks with game records, 3,000 per set (60 to 80 MB per set)
npm run corpus:fetch -- --local test-bulk     # also the owner's test_deck-*.txt lists
npm run corpus:eval                           # build every reference deck from random bulk plus its cards (about 20 minutes)
npm run corpus:eval -- --sizes 100 --split train   # one size, the training split only
npm run corpus:eval -- --noise-dir test-bulk  # the owner's bulk as the noise instead of random cards
npm run corpus:eval -- --rescore <results.json>   # an earlier run's builds measured with the current styles
npm run corpus:learn                          # data/corpus/report.md: suggestions for config
npm run corpus:panel -- --a <old.json> --b <new.json>   # paired review packets from two results files
npm run corpus:panel -- --tally <panel dir>   # share of pairs the newer build wins
```

`--sources` (default precon, draft, local), `--since` (default 2015), `--limit`, and `--noise` are in the script header. Read the eval summary per size: `recall` (share of the deck's spells our build used), `style match` (our style is one the deck meets), `score` and `ref ahead` (the classic deck score, and whether it rates the deck's own build at least as high as ours; empty for grow decks), and the ours/reference pairs for lands, average mana value, creatures, card strength, and popularity rank. Tune on the train split and confirm on the test split; a change that only helps train is fitting the corpus, not building better decks. Preconstructed decks are a floor, not a ceiling: a build that beats them on strength is fine, one that misses their plan is not.

The plan measures (`packages/pipeline/src/plans.ts`) judge whether builds look like real decks of their plan:

- **Plan of a reference deck:** among the styles whose minimums it meets (and under a commander, the tribes the commander names), the one whose theme cards stand out most over random bulk, or `shape` when it meets none. A style made of common cards, such as Graveyard, meets its minimums in many decks without being their plan.
- **Style mix:** the share of builds per style next to the share of reference decks running it, per size and split. The mix is reported, not gated: best fit means the best deck and there is no target mix, so Aggro and Midrange being common from bulk is fine while the other buildable styles stay in the list. A skew caused by a scoring artifact (a loose matcher, a score that rewards one style's cards) is a regression. The summary still flags as BLOCKERS any style (each plain shape on its own) above 25% of builds unless real decks run it nearly as often (within 1.2 times), and any style above 1.5 times its reference share by at least three decks and 2% of the size (plain shapes folded into `shape`); read those as prompts to look for an artifact, not as a gate.
- **Profile distance:** how far a deck's makeup (theme enablers and payoffs, roles, curve, card types, as shares of its spells) sits from the median of real decks running its plan, each feature in units of their middle-half spread (at least half the spread over all decks of the size, or over all themed decks for the theme features) and capped at 3, averaged. Plans with fewer than six decks borrow the decks that meet the style. `core distance` leaves the theme features out, so shapes and themes compare on the same features. The reference decks' own distance from their plan, each measured without itself when its plan has under 30 decks, sits beside ours as the yardstick.
- **Plan of a reference deck** compares its theme copies with what random bulk of the same color make-up would hold, so a color's natural themes (tokens in white, burn in red) do not read as a plan by color alone.
- **Plan recall:** with a reference deck shuffled into bulk, the share of its theme cards for its plan that the build used.
- **Style match** deltas are paired: decks that gained or lost a style match against the previous run.
- **Review panel:** `corpus:panel` pairs builds of the same decks from two results files, hides which is which, and writes packets for fresh agent reviewers, who rate each build against `rubric.md` and the profile of its plan and write a verdicts file beside the packet. `--tally` reports the share the newer version wins. It shows each build's style, so it is a sanity check beside the numbers, not the blind panel.

## What is where

- `pools/`: fixed pools as decklist text. `white-bulk.txt` is a real ManaBox export; the others are generated from the data pack with a fixed seed. Each file starts with comment lines saying what it exercises.
- `panel-rubric.md`: the blind panel's rubric. `review:packets` pastes it into every judge prompt and `review:collate` enforces its answer shape, so change its wording only together with `packages/pipeline/src/review/collate.ts`.
- `rubric.md`: the older six-axis rubric for scoring a deck by hand; `corpus:panel` still cites it.
- `needs-coverage.md`: the card needs reader's coverage over the pack, written by `npm run needs:report`.
- `results/`: one JSON file per run, named by date and git commit, with `-dirty` when the working tree had uncommitted changes and a numeric suffix instead of overwriting. Deltas compare against the latest earlier full run (no `--pools` filter) with the same `--styles` and `--colors` settings, per deck size, over pools present in both runs. A size the earlier run did not build shows no deltas. Commit only full best-fit runs that establish a new baseline; `--styles` files are large and stay local.

## Metrics

Per deck, from `packages/pipeline/src/metrics.ts`. Commander decks count the commander as one of their 100 cards, use the copy exceptions its rules allow, and follow the `commander` curve profile, as Jumpstart packets follow `jumpstart`.

| Metric                                                                   | Meaning                                                                                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| exactSize, copyLimitOk, colorLegal                                       | Hard invariants; any failure is a builder bug.                                                                                |
| lands, landsInClamp, nonbasics                                           | Land count and whether it sits inside the template's formula clamp.                                                           |
| averageMv                                                                | Average mana value of the spells.                                                                                             |
| curveDeviation                                                           | Sum over mana value buckets of the difference from the effective profile beyond the template tolerance.                       |
| creatureShare, instantSorceryShare, noncreaturePermanentShare, typeMixOk | Type mix against the effective bounds.                                                                                        |
| roles, rolesBelowMin, rolesBelowTarget                                   | Role coverage against the effective quotas.                                                                                   |
| synergyPairs, synergyDensity                                             | Enabler and payoff pairs over the synergy rules; density is weighted pairs per spell. A classic deck score measure.           |
| filler                                                                   | Copies the builder recorded as filler, plus curve picks that fill none of the deck's roles (`isFillerPick`). Classic measure. |
| strength                                                                 | Average card strength over spell copies.                                                                                      |
| score                                                                    | The classic builder's deck score, 0 to 100; absent on grow decks, which rank by the plan picker's score.                      |
| unsupported                                                              | Spell copies the deck does not support: an unmet drawback, or a credit the deck does not earn (card needs).                   |
| castable, offenders                                                      | Whether every spell's colored pips can be paid with the deck colors, and which cannot.                                        |

`npm run eval` exits 1 when any build fails or any deck breaks a hard invariant, so it can gate a change. The summary table reports averages per pool, per size, and overall, plus failures (the scan said possible but the builder threw), skips (the scan said not possible), uncastable decks, and size errors. Per-size rows are the ones to compare over time; the overall row mixes sizes.
