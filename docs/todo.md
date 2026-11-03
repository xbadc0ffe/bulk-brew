# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 8: iOS app

- Capacitor project around `apps/mobile`, bundled data pack and config, over-the-air data update.
- Pick the bundle identifier with the user (for example com.<name>.bulkbrew).
- Storage: confirm IndexedDB persistence in the WebView or move the key-value store to the Filesystem plugin.

## Builder follow-ups

- Cheap-heavy pools overshoot the low end of the curve: eval bulk-black 60 has 9 one-drops against a target of 3 (curve deviation 7), because role and theme passes pick cheap cards before the curve pass runs. Consider curve-aware ordering inside the role and theme passes.
- `MIN_COLORED_SHARE` in scan.ts (half the spell slots must be the deck color) is a constant; move it to deck-templates.json if it ever needs tuning per size.
- 60-card decks average 6.7 filler copies in the baseline (filler now includes curve picks that fill no role); the next config pass should look at roles for cheap creatures.
- Creature-only pools always miss the cheap interaction minimum (eval creatures-only-green); fine as a note, but the Build screen could say so before building.
- Tune the composition fallback: margin picks aggro for most creature-heavy pools.
- Let the objective see land count changes during local search.
- Prefer spreading copies across more distinct cards when the pool allows (variety).
- Config tuning after the first builds: lifegain payoffs are thin outside white and black; spells payoffs are thin outside blue and red.

## Design follow-ups

- Owner to pick among the design alternates kept as reference: 1c Pool grouped by mana value with art (the model for a grid or art view, not built), 1e Analysis as an all-colors matrix per size, 1h Result with the explanation above the list, 1k a desktop top bar instead of the sidebar.
- `ink` and `fg-1` share a lightness in light mode, so primary and secondary text differ mostly by weight; if it reads flat, split `ink` into a text and an accent color (changes the look, check with the owner).
- iPad: the mobile app shows the phone screens beside a side rail; the handoff suggests reusing the desktop layouts there.
- `<meta name="theme-color">` stays dark grey; make it follow the theme.
- Empty, loading, and error states follow the handoff's suggestions; confirm them with the owner.
- Mobile: Rename uses the browser prompt; replace it with an inline field or a sheet.

## Owner review follow-ups

- Mobile parity for the web-only changes of the owner review: column sorting, the Analyze split, multi-select removal, and the deck details expand.
- Tune `config/display-tags.json` after use; Blink and -1/-1 match few cards, Artifacts and Graveyard match many.
- Decks saved with the short-lived Save deck show "Not accepted"; drop that path once no such decks remain.

## App follow-ups

- Hook tests with a DOM test environment (needs a jsdom dev dependency; ask first). useBuildFlow's accept and reject paths and the packet merge are the first candidates.
- Service worker: show a "new version available" prompt instead of waiting for the next load.
- Card detail: show rulings fetched from Scryfall on demand.

## Phase 9: v2 ideas

- Proper two-color builds with gold cards.
- Batch balanced mode: several decks of similar strength from one pool.
- Optional card quality score.
- Download images for the pool for full offline use.

## Open questions

- Modal double-faced cards with a land back face are marked entersTapped from the land face; decide how the builder treats them.
