# Evaluation

Regression tests for deck quality. Every rule or config change runs this suite.

- `pools/`: fixed test pools as decklist text, each with a short note on what it is meant to exercise (a thin red pool, a token-heavy white pool, a pool with many nonbasic lands, and so on).
- `rubric.md`: the written rubric decks are judged against: curve, type mix, role coverage, synergy, mana base, playability.
- `results/`: scored output over time, so changes can be compared.

The harness arrives in phase 6. Claude reviews decks against the rubric as a development aid, not as ground truth; the user calibrates on a sample.
