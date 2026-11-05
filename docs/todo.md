# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 8: iOS app (on hold until the owner starts it)

- Capacitor project around `apps/mobile`, bundled data pack and config, over-the-air data update.
- Pick the bundle identifier with the user (for example com.<name>.bulkbrew).
- Home-screen icon: put `apps/mobile/resources/app-icon-light.png` and `app-icon-dark.png` in the AppIcon set (Any and Dark appearances); see the README there.
- Storage: confirm IndexedDB persistence in the WebView or move the key-value store to the Filesystem plugin.

## Builder follow-ups

- Corpus-led tuning (owner agreed, 2026-11-04): fix the scan gates that stop reference decks building from their own cards at every size (spell slots against the land clamp, not the base count; colored share and per-color minimums at 100); flavor names in the data pack (schema change, approved); a tribe as the main style under a commander whose text names it (SPEC decision change, approved); styles for commander plans the corpus finds uncovered, such as tappers and group slug; then curve, roles, card strength, and the deck score, each measured with `npm run corpus:eval` on the train split and confirmed on the test split.
- Multi-color: split cards count only their first half's pips; pathway lands (land // land) count for both colors; Thriving lands count for every deck color in 3+ color decks; fetch lands without the `tutor-land-basic` tag (true fetches) are not used for fixing.
- Eval: `npm run eval -- --dir test-bulk --combine --colors all` runs the owner's local lists across every color set (results stay in that folder).
- The deck score rewards putting strong cards together, which by itself tends to build a bad deck (owner's view). Keep it internal and keep reworking its weight in option ranking so synergy and a working plan win over raw card quality.
- Castability scores 1.0 for four and five-color decks in a five-color pool (for example a four-color 20-card packet), so more colors only add synergy and win on score. The Analyze pane defaults to two colors per deck because of it; a castability term that grows with the number of colors would let it show any colors.
- Calibrate the deck score with the owner on a sample of decks. Synergy leads (0.6) since the owner found strength-led ranking ignored synergy; card strength, roles, curve, and type mix are tiebreaks (`deckScore.weights` in builder-weights.json).
- Best fit builds every viable style per request; a 60-card build averages about 190 ms on desktop and runs on the main thread until phase 11 moves building to a worker.
- Role and type-mix parts of the deck score are full in every bulk pool, so they do not separate decks; consider dropping or rescaling them.
- The first schema 2 pack goes live with the next weekly data refresh (or a manual run of the Refresh card data workflow); until then the live site builds without the popularity signal.
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
- Mobile: Rename uses the browser prompt; replace it with an inline field like the web's click-to-rename.
- Build page: the archetype drop-down shows a horizontal scrollbar under its list when the list scrolls (seen at 1600 by 1000, any deck size).

## Owner review follow-ups

- Commander: Partner, Background, and similar pairs; colorless commanders (need Wastes); a role for answers to artifacts and enchantments; prefer ramp that costs less than the commander; extra copies of a commander whose text allows any number; the phone layout (phones do not offer 100 yet).
- Mobile: secondary style picker (phones build with the primary style only).
- Tribes: multi-word creature types such as "Time Lord" split into two words.
- Mobile parity for the deck options list on the Build page (phones still build one deck).
- Mobile parity for the web cleanup round: colored deck actions (Accept green, Back red, Export grey) and the icon sidebar's look in the tab bar.
- Voltron: nine Auras that enchant a player but are not Curses (Archnemesis, Grievous Wound, Overencumbered, Paradox Haze, Psychic Possession, Shadow of the Second Sun, Tenuous Truce, Wheel of Sun and Moon, Volrath's Motion Sensor) still count as enablers. A tag overlay entry (applied at the next data build) or a check on "Enchant player" text would catch them.
- Mobile parity for the second cleanup round: the Remove dialog (Delete or Disassemble), and Settings without copy limits and with Reset above a red Clear.
- Eval: add a metric for decks that miss their own theme minimums, so a regression like the one fixed in local search shows up.
- Deck options build on the main thread, one per tick; move to a Web Worker if phones stutter. The Analyze pane's worker (`bestDecks.worker.ts` with `poolPack`) is the model.
- Mobile parity for the web-only changes of the owner review: column sorting, the Analyze split, multi-select removal, and the deck details expand.
- Mobile parity for Settings export and restore by part (bulk list, decks, or both; JSON or TXT); phones still export and restore everything.
- Mobile parity for the rebuilt Analyze pane (recommended decks from the worker, color pie, mana value chart, by-color tables); phones still show the per-color archetype table from `analysisRows`.
- Tune `config/display-tags.json` after use; Blink and -1/-1 match few cards, Artifacts and Graveyard match many.

## App follow-ups

- Hook tests with a DOM test environment (needs a jsdom dev dependency; ask first). useBuildFlow's accept and reject paths and the packet merge are the first candidates.
- Service worker: show a "new version available" prompt instead of waiting for the next load.
- Card detail: show rulings fetched from Scryfall on demand.

## Later

- Batch balanced mode: several decks of similar strength from one pool.
- Download images for the pool for full offline use.

## Open questions

- Modal double-faced cards with a land back face are marked entersTapped from the land face; decide how the builder treats them.
