# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 2: data pipeline

- Read the three bulk files, filter to paper-playable layouts, trim to `CardRecord`.
- Derive normalized types, `entersTapped`, `unset`, multi-face handling (split, adventure, transform, modal DFC).
- Join Tagger tags, apply `config/tag-overlay.json`.
- Disambiguate the 36 names that map to more than one oracle id.
- Emit the data pack and `data/manifest.json`; publish as a release asset.
- Weekly refresh workflow that opens a pull request when card data changed.

## Phase 3: core library

- Data pack loader and name index.
- Name resolution: full names, front-face names, accents and punctuation.
- Pool model: import with resolved and unresolved report, add, remove, clear, export, backup.

## Phase 4: guides and config v1

## Phase 5: archetype scan and builder v1

## Phase 6: evaluation harness

## Phase 7: web app

## Phase 8: iOS app

## Phase 9: v2 ideas

- Proper two-color builds with gold cards.
- Batch balanced mode: several decks of similar strength from one pool.
- Optional card quality score.
- Download images for the pool for full offline use.
- Collection CSV imports (ManaBox, Moxfield) in addition to decklist text.

## Open questions

- Commit policy: commit after each verified step (current default) or only when asked.
- Pick a short app id for the iOS bundle identifier before phase 8.
