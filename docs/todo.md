# Backlog

Ranked. The current phase is at the top. Finished phases are removed, not struck through.

## Phase 8: iOS app (on hold until the owner starts it)

- Capacitor project around `apps/mobile`, bundled data pack and config, over-the-air data update.
- Pick the bundle identifier with the user (for example com.<name>.bulkbrew).
- Home-screen icon: put `apps/mobile/resources/app-icon-light.png` and `app-icon-dark.png` in the AppIcon set (Any and Dark appearances); see the README there.
- Storage: confirm IndexedDB persistence in the WebView or move the key-value store to the Filesystem plugin.

## Builder follow-ups

- Learned deck building (`docs/learned-builder.md`, status at its top): measures, learned data, plan choice, learned card selection, and the learned deck score shipped on 2026-11-05 (26.0.31 to 26.0.34) at 100, 60, and 20 cards; the Drain style and the card quality recalibration were tried and not shipped (the next two items). Next, in order: turn the learned plans on at 40 (see the next item); rank the Build page options by the calibrated plan choice, with the deck score inside a plan, since at 100 the first option leans to Tokens (48% of first options over 40 corpus pools against 9% of real decks; the old score leaned as far to Aristocrats), because bulk imitates some plans' real decks more easily than others; per-shape role profiles for Commander, where unthemed precons are mostly control-shaped; a calibration that also sees the finished deck, so the deck score can weigh in on best fit at 100 and 60.
- Drain as a new style (phase 6 of `docs/learned-builder.md`, tried 2026-11-05 and not shipped): cards that drain or make each opponent lose life as enablers, cards that reward life loss as payoffs (8/2 at 60, 5/1 at 40, 3/1 at 20), with EDHREC's drain and group slug themes. Only 1 or 2 real decks at 100, 60, and 20 meet it, since real decks run drain cards without the rare payoffs (about 300 draft decks do at 40, where learned plans are off). Best fit never built it, and the recalibration it forced moved builds slightly away from real decks (distance 0.445 to 0.458 at 100 and 0.476 to 0.486 on the 60 test split) and cost plan recall on the 100 test split (0.421 to 0.412). Next: a definition whose payoffs real drain decks run, or add it once 40-card learned plans are on.
- Card quality recalibration (phase 7 of `docs/learned-builder.md`, tried 2026-11-05 and not shipped). Two changes to card strength, each measured with `corpus:eval` against the shipped builder:
  - Effect points moved halfway toward how much more often real decks carry each trait than bulk does (report section 5), for traits that point the same way at three or four sizes and do not define a style (exile removal 0.4 to 0.75, removal that hits any nonland permanent 0.5 to 0.8, repeatable card advantage 1.5 to 1.8, several bodies 0.7 to 0.95, drawback -0.4 to -0.7, stat-only auras and equipment -0.8 to -1.1, artifact or enchantment removal 1 to 0.7, counterspell 1.2 to 1.1). Distance improved at 100 and 60 but plan recall fell at 100 (0.601 to 0.596 train, 0.421 to 0.414 test) and 60 (0.201 to 0.192 train), and 40 moved further from real decks (0.643 to 0.665 test); recalibrating the plan choice on the new strengths was worse still.
  - A learned draft win rate per card from the 17Lands decks already in the corpus (train split, games-weighted, each card against its set's decks, shrunk with 200 games at the set's rate; 4,764 cards from 18 sets, the middle 80% between -2.8 and +1.9 points), at 0.25 strength per point within 1.5. Distance improved at 100, 60, and on the 20 test split, but plan recall fell at every size (100 test 0.421 to 0.401, 20 test 0.095 to 0.067): generically strong cards pushed out the theme cards real decks play.
  - Next: let quality act only among cards of the same job (removal against removal, theme card against theme card) rather than across the whole deck, then measure again.
- Learned plans at 40 cards (phase 3 of `docs/learned-builder.md`): off (`builderWeights.learned.plan.40.use`), so 40-card decks still build with the hand-set best fit. With them on, the style mix had no blockers and builds sat closer to real draft decks (profile distance 0.64 to 0.46), but the blind review panel preferred the old 40-card builds 9 to 1: in pools of three to five colors the new plan choice picked themes the pool held thinly (a Graveyard deck of three Stone Docents and two flashback spells), while the old deck score found real engines (sacrifice, artifacts). Blending the old score back in brought the old skew back (Artifacts 29% of builds against 10% of real decks). Next: let plan choice see how well the finished deck plays its plan (the learned deck score of phase 5), or weigh the theme's strong cards, then turn 40 back on.
- Multi-color: split cards count only their first half's pips; pathway lands (land // land) count for both colors; Thriving lands count for every deck color in 3+ color decks; fetch lands without the `tutor-land-basic` tag (true fetches) are not used for fixing.
- Eval: `npm run eval -- --dir test-bulk --combine --colors all` runs the owner's local lists across every color set (results stay in that folder).
- At 40 cards (the other sizes use the learned deck score) the deck score rewards putting strong cards together, which by itself tends to build a bad deck (owner's view). Keep it internal and keep reworking its weight in option ranking so synergy and a working plan win over raw card quality.
- Castability scores 1.0 for four and five-color decks in a five-color pool (for example a four-color 20-card packet), so more colors only add synergy and win on score. The Analyze pane defaults to two colors per deck because of it; a castability term that grows with the number of colors would let it show any colors.
- Owner review of decks waits for a working product: the learned builder (`docs/learned-builder.md`) judges itself with automated measures and a blind agent review panel, and the owner tries the result on the live site.
- Best fit builds every viable style per request; a 60-card build averages about 190 ms on desktop and runs on the main thread until phase 11 moves building to a worker.
- Role and type-mix parts of the 40-card deck score are full in every bulk pool, so they do not separate decks; consider dropping or rescaling them.
- The first schema 2 pack goes live with the next weekly data refresh (or a manual run of the Refresh card data workflow); until then the live site builds without the popularity signal.
- Cheap-heavy pools overshoot the low end of the curve: eval bulk-black 60 has 9 one-drops against a target of 3 (curve deviation 7), because role and theme passes pick cheap cards before the curve pass runs. Consider curve-aware ordering inside the role and theme passes.
- `MIN_COLORED_SHARE` in scan.ts (half the spell slots must be the deck color) is a constant; move it to deck-templates.json if it ever needs tuning per size.
- Styles tried on the corpus and left out: Discard and madness (pulled graveyard Commander decks off their plan), group slug and casting from exile (too few precons meet any version tried), and Landfall payoffs that count lands (`lands-matter` is broad and lowered style match at 40). Group hug, goad, and energy are styles without synergy rules until the deck score counts a plan's own pairs; their payoff tags are broad (`combat-manipulation`, `draw-matters` also rewards your own draws).
- The commander pull measures how rare a style's payoffs are in the pool, not how central the style is to the commander: Toby (token flyers) leans to Evasion and Danitha (aura and equipment cost reducer) to Enchantments on the eval pools. A tribe the commander names also keeps the styles it only feeds from getting any pull. A Commander theme target above the minimums was not needed: builds that keep a reference deck's style carry 21.6 enablers and 17.4 payoffs against the precons' 24.8 and 16.1.
- Every synergy rule counts in every deck's score, so adding rules for one style moves the ranking of others: trial rules for group hug, goad, and energy changed the best-fit style of 55% of the 40-card draft decks, and a goad rule lifted a Tokens build over Admiral Brass's Pirate tribe. The deck score rework should count the chosen plan's pairs.
- Kicker cards with an off-color kicker (61 cards, all tagged `offcolor-additional-cost`) stay out of decks without that color, though real draft decks play them unkicked. Their role tags describe the kicked effect (Desolation Giant counts as a sweeper), so letting them in needs role credit that ignores the kicker first. They are most of the remaining 40-card self-build failures in `corpus:eval`.
- Local search can swap out the cards that fill a color's minimum, so a deck can end up without a picked color; the deck is then named for the colors it uses. Guarding color minimums in the swap, as theme minimums are, would keep the floor.
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
- The Commander list's archetype checks (`useCommanderList`: the listing scans and `commanderCanBuild`, a full Commander build each) still run on the main thread, one per tick. Move them to a worker like `deckOptions.worker.ts` if the list stutters.
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
