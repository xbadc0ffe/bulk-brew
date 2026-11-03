# Evaluation

Regression tests for deck quality. Run the suite after every builder or config change and compare the numbers with the previous run before shipping.

## Running

```sh
npm run data:pull      # or data:fetch and data:build; the suite needs data/packs/cards.v1.json
npm run eval           # best fit for every pool, size, and color the scan allows
npm run eval -- --styles          # also build every viable style
npm run eval -- --pools bulk      # only pools whose file name contains "bulk"
npm run eval:pools     # regenerate the synthetic pools (keeps existing files unless --force)
```

The same suite runs on demand in GitHub Actions ("Evaluate decks" workflow) and uploads the results as an artifact.

## What is where

- `pools/`: fixed pools as decklist text. `white-bulk.txt` is a real ManaBox export; the others are generated from the data pack with a fixed seed. Each file starts with comment lines saying what it exercises.
- `rubric.md`: the written rubric for scoring a deck by hand, with notes on how the automatic numbers map to it.
- `results/`: one JSON file per run, named by date and git commit, with `-dirty` when the working tree had uncommitted changes and a numeric suffix instead of overwriting. Deltas compare against the latest earlier full run (no `--pools` filter) with the same `--styles` setting, per deck size, over pools present in both runs. Commit only full best-fit runs that establish a new baseline; `--styles` files are large and stay local.

## Metrics

Per deck, from `packages/pipeline/src/metrics.ts`:

| Metric                                                                   | Meaning                                                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| exactSize, copyLimitOk, colorLegal                                       | Hard invariants; any failure is a builder bug.                                                                              |
| lands, landsInClamp, nonbasics                                           | Land count and whether it sits inside the template's formula clamp.                                                         |
| averageMv                                                                | Average mana value of the spells.                                                                                           |
| curveDeviation                                                           | Sum over mana value buckets of the difference from the archetype's profile beyond the template tolerance.                   |
| creatureShare, instantSorceryShare, noncreaturePermanentShare, typeMixOk | Type mix against the effective bounds.                                                                                      |
| roles, rolesBelowMin, rolesBelowTarget                                   | Role coverage against the effective quotas.                                                                                 |
| synergyPairs, synergyDensity                                             | Enabler and payoff pairs over the synergy rules; density is weighted pairs per spell.                                       |
| filler                                                                   | Copies the builder recorded as filler, plus curve picks that fill none of the deck's roles (`isFillerPick` in the builder). |
| castable, offenders                                                      | Whether every spell's colored pips can be paid with the deck color, and which cannot.                                       |

`npm run eval` exits 1 when any build fails or any deck breaks a hard invariant, so it can gate a change. The summary table reports averages per pool, per size, and overall, plus failures (the scan said possible but the builder threw), skips (the scan said not possible), uncastable decks, and size errors. Per-size rows are the ones to compare over time; the overall row mixes sizes.

Claude reviews sample decks against the rubric as a development aid, not as ground truth; the user calibrates on a sample.
