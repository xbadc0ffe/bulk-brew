# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 3: core library (remaining)

- Backup: export and import pool, decks, and settings as one JSON file.
- Collection CSV imports (ManaBox, Moxfield, Deckbox) next to decklist text.
- Virtualize the pool list for pools with thousands of distinct cards.
- Card detail view: oracle text, tags in plain words, art when enabled.
- Settings screen: copy limits, basics, Un-sets, art toggle, wired to storage.
- Hook tests with a DOM test environment (needs a jsdom dev dependency; ask first).

- Scan: per color and size, evaluate archetype minimums and role quotas over the pool; report near-misses.
- Builder: candidates, archetype choice, reserved lands, role and curve fill passes with per-type caps, land formula, local search, nonbasics and basics, provenance per card.
- Deck storage, Build and Deck screens, Accept to commit, Decks list, packet pairing.
- Config tuning after the first builds: lifegain payoffs are thin outside white and black; spells payoffs are thin outside blue and red.

## Phase 6: evaluation harness

- `eval/pools/white-bulk.txt` exists; add pools for the other colors and a thin pool.
- Scoring script over all pools and sizes, results in `eval/results/`.

## Builder follow-ups

- Tune the composition fallback: margin picks aggro for most creature-heavy pools.
- Let the objective see land count changes during local search.
- Prefer spreading copies across more distinct cards when the pool allows (variety).

## Phase 7: web app

## Phase 8: iOS app

## Phase 9: v2 ideas

- Proper two-color builds with gold cards.
- Batch balanced mode: several decks of similar strength from one pool.
- Optional card quality score.
- Download images for the pool for full offline use.
- Collection CSV imports (ManaBox, Moxfield) in addition to decklist text.

## Open questions

- Modal double-faced cards with a land back face are marked entersTapped from the land face; decide how the builder treats them.

- Commit policy: commit after each verified step (current default) or only when asked.
- Pick a short app id for the iOS bundle identifier before phase 8.
