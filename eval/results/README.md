# Eval baselines

This folder holds the current baseline only: one JSON from a full best-fit run, named `<date>-<commit>.json`. `npm run eval` prints per-size deltas against it. When a builder or config change moves a metric on purpose, commit the new run and delete the old file, then add a row to the history below. How to read the deltas: `docs/evaluation.md`.

## History

Overall averages from each earlier baseline, oldest first. The files themselves were removed in the 2026-11 tidy-up and are still at the `pre-audit` git tag.

Read down the table with care:

- The deck count changes when pools or sizes were added (100-card Commander decks arrive in the fifth row), so compare a row only with its neighbors.
- Score is the classic builder's deck score. Decks from the grow builder do not carry it, so the column ends when best fit moved to the grow builder.
- Unsupported counts cards whose needs the deck does not meet. It was added on 2026-11-17, and the card needs gate brought it to 0.
- Why each change was made, and what was tried and dropped, is in `docs/builder.md`.

| Date       | Change measured                                                     | Decks | Lands | Curve deviation | Roles below minimum | Synergy density | Filler | Strength | Score | Unsupported |
| ---------- | ------------------------------------------------------------------- | ----- | ----- | --------------- | ------------------- | --------------- | ------ | -------- | ----- | ----------- |
| 2026-11-03 | Add the deck evaluation harness                                     | 32    | 15.44 | 1.03            | 0.13                | 0.96            | 3.75   |          |       |             |
| 2026-11-04 | Score card strength and pick best fit by building                   | 32    | 15.03 | 0.94            | 0.13                | 0.88            | 3.97   | 5.48     | 73.1  |             |
| 2026-11-04 | Build decks of one to five colors                                   | 32    | 15.25 | 0.78            | 0.13                | 0.96            | 3.41   | 5.39     | 70.43 |             |
| 2026-11-04 | Add secondary styles, tribes, and four new styles                   | 32    | 15.19 | 0.69            | 0.13                | 0.99            | 3.41   | 5.37     | 71.14 |             |
| 2026-11-04 | Add Commander: 100-card singleton decks led by a commander          | 48    | 22.08 | 2.48            | 0.58                | 0.88            | 7.25   | 5.27     | 67.44 |             |
| 2026-11-04 | Keep themed decks on theme and make Finisher mean Commander finisher | 48    | 22.06 | 2.65            | 0.65                | 0.87            | 7.63   | 5.27     | 66.87 |             |
| 2026-11-04 | Fix review findings from the second cleanup round                   | 48    | 22.1  | 2.6             | 0.65                | 0.87            | 7.6    | 5.28     | 66.91 |             |
| 2026-11-04 | Fix review findings on the Curse change                             | 48    | 22.1  | 2.6             | 0.65                | 0.87            | 7.63   | 5.28     | 66.91 |             |
| 2026-11-05 | Let reference decks build from their own cards                      | 49    | 22.18 | 2.84            | 0.65                | 0.85            | 7.65   | 5.27     | 66.41 |             |
| 2026-11-05 | Add Commander plans: tribes, Tappers, and the commander's own style | 49    | 22.16 | 2.86            | 0.65                | 0.86            | 7.67   | 5.27     | 66.51 |             |
| 2026-11-05 | Shape decks like the reference decks at every size                  | 49    | 22.69 | 2.37            | 0.69                | 0.86            | 7.82   | 5.24     | 66.92 |             |
| 2026-11-05 | Pick the plan a pool leans to and build it like real decks          | 66    | 21.77 | 1.97            | 0.52                | 0.82            | 7.88   | 5.16     | 66.24 |             |
| 2026-11-05 | Choose cards by what they add to the plan                           | 66    | 21.91 | 2               | 0.52                | 0.69            | 7.42   | 5.19     | 63.19 |             |
| 2026-11-05 | Score decks by how close they sit to real decks of their plan       | 66    | 21.94 | 1.98            | 0.52                | 0.69            | 7.44   | 5.19     | 76.84 |             |
| 2026-11-17 | Same builder, run again with the unsupported count added            | 66    | 21.94 | 1.98            | 0.52                | 0.69            | 7.44   | 5.19     | 76.84 | 1.18        |
| 2026-11-17 | Build every style the scan plans, on thin pools too                 | 64    | 21.41 | 1.45            | 0.38                | 0.42            | 8.2    | 5.59     | 81.75 | 0.13        |
| 2026-11-17 | Feed below a role minimum only at 20, and hold a would-be commander | 64    | 21.45 | 1.33            | 0.36                | 0.29            | 7.7    | 5.79     |       | 0           |
| 2026-11-19 | One-color utility lands, and the bulk baseline on the 2026-11-16 pack | 64    | 21.45 | 1.33            | 0.36                | 0.29            | 7.75   | 5.79     |       | 0           |

The last row is the current baseline, `2026-11-19-73b7090.json`.
