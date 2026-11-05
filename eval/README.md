# Evaluation

Regression tests for deck quality. Run the suite after every builder or config change and compare the numbers with the previous run before shipping.

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
npm run corpus:learn                          # data/corpus/report.md: suggestions for config
```

Read the eval summary per size: `recall` (share of the deck's spells our build used), `style match` (our style is one the deck meets), `ref ahead` (our score rates the deck's own build at least as high as ours), and the ours/reference pairs for lands, average mana value, creatures, card strength, and popularity rank. Tune on the train split and confirm on the test split; a change that only helps train is fitting the corpus, not building better decks. Preconstructed decks are a floor, not a ceiling: a build that beats them on strength is fine, one that misses their plan is not.

## What is where

- `pools/`: fixed pools as decklist text. `white-bulk.txt` is a real ManaBox export; the others are generated from the data pack with a fixed seed. Each file starts with comment lines saying what it exercises.
- `rubric.md`: the written rubric for scoring a deck by hand, with notes on how the automatic numbers map to it.
- `results/`: one JSON file per run, named by date and git commit, with `-dirty` when the working tree had uncommitted changes and a numeric suffix instead of overwriting. Deltas compare against the latest earlier full run (no `--pools` filter) with the same `--styles` and `--colors` settings, per deck size, over pools present in both runs. A size the earlier run did not build shows no deltas. Commit only full best-fit runs that establish a new baseline; `--styles` files are large and stay local.

## Metrics

Per deck, from `packages/pipeline/src/metrics.ts`. Commander decks count the commander as one of their 100 cards, use the copy exceptions its rules allow, and follow the `commander` curve profile, as Jumpstart packets follow `jumpstart`.

| Metric                                                                   | Meaning                                                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| exactSize, copyLimitOk, colorLegal                                       | Hard invariants; any failure is a builder bug.                                                                              |
| lands, landsInClamp, nonbasics                                           | Land count and whether it sits inside the template's formula clamp.                                                         |
| averageMv                                                                | Average mana value of the spells.                                                                                           |
| curveDeviation                                                           | Sum over mana value buckets of the difference from the effective profile beyond the template tolerance.                     |
| creatureShare, instantSorceryShare, noncreaturePermanentShare, typeMixOk | Type mix against the effective bounds.                                                                                      |
| roles, rolesBelowMin, rolesBelowTarget                                   | Role coverage against the effective quotas.                                                                                 |
| synergyPairs, synergyDensity                                             | Enabler and payoff pairs over the synergy rules; density is weighted pairs per spell.                                       |
| filler                                                                   | Copies the builder recorded as filler, plus curve picks that fill none of the deck's roles (`isFillerPick` in the builder). |
| castable, offenders                                                      | Whether every spell's colored pips can be paid with the deck colors, and which cannot.                                      |

`npm run eval` exits 1 when any build fails or any deck breaks a hard invariant, so it can gate a change. The summary table reports averages per pool, per size, and overall, plus failures (the scan said possible but the builder threw), skips (the scan said not possible), uncastable decks, and size errors. Per-size rows are the ones to compare over time; the overall row mixes sizes.

Claude reviews sample decks against the rubric as a development aid, not as ground truth; the user calibrates on a sample.
