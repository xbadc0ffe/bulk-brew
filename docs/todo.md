# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 6: evaluation harness

- `eval/pools/white-bulk.txt` exists; add pools for the other colors and a thin pool.
- Scoring script over all pools and sizes, results in `eval/results/`.
- Rubric in `eval/rubric.md`.

## Phase 8: iOS app

- Capacitor project around `apps/mobile`, bundled data pack and config, over-the-air data update.
- Pick a short app id for the bundle identifier.
- Storage: confirm IndexedDB persistence in the WebView or move the key-value store to the Filesystem plugin.

## Builder follow-ups

- Tune the composition fallback: margin picks aggro for most creature-heavy pools.
- Let the objective see land count changes during local search.
- Prefer spreading copies across more distinct cards when the pool allows (variety).
- Config tuning after the first builds: lifegain payoffs are thin outside white and black; spells payoffs are thin outside blue and red.

## App follow-ups

- Hook tests with a DOM test environment (needs a jsdom dev dependency; ask first).
- Mobile pool list is not windowed; fine up to a few thousand rows, revisit if it lags.
- Service worker: show a "new version available" prompt instead of waiting for the next load.
- Card detail: show rulings fetched from Scryfall on demand.

## Phase 9: v2 ideas

- Proper two-color builds with gold cards.
- Batch balanced mode: several decks of similar strength from one pool.
- Optional card quality score.
- Download images for the pool for full offline use.

## Open questions

- Modal double-faced cards with a land back face are marked entersTapped from the land face; decide how the builder treats them.
- Commit policy: commit after each verified step (current default) or only when asked.
