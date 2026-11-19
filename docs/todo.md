# Backlog

Ranked within each group. The current work is at the top. One line per item. Finished items are removed, not struck through.

## Next up: phone layout and iOS

One app: `apps/web` has a phone layout below 768 px and Capacitor will wrap it (SPEC "Decisions"). Done so far: folder tabs, the sheet, the Bulk List, deck options, and the deck view.

- Phone: the Decks table has `min-w-[760px]` and tapping a name starts a rename instead of opening the deck (`apps/web/src/screens/DecksScreen.tsx`); show a list where the name opens the deck.
- Phone: Export, Replace, Accept, and the confirm boxes are centered dialogs; make them bottom sheets like the rest.
- Phone: Toggle, Stepper, and Segmented are 24 to 34 px tall (`packages/ui/src/components/controls.tsx`); raise them to 44 px on touch screens, as buttons and fields are.
- Phone: Settings, Import, and the Build form are the desktop layout squeezed; the Build page's 340 px archetype menu (`BuildScreen.tsx`) scrolls sideways under 360 px.
- Phone: hover-only cues (the rename pencil, the reason Pair with is disabled in `DecksScreen.tsx`) need a touch equivalent.
- Phone: the sheet's drag and the 16 px fields are checked only in an emulated browser; try them on a real iPhone.
- Add an apple-touch-icon to the web app, and make the theme-color meta in `apps/web/index.html` follow the theme (it stays `#18181b`).
- iOS: Capacitor project around `apps/web` with the bundled data pack and config and the over-the-air data update.
- iOS: pick the bundle identifier with the owner (for example com.<name>.bulkbrew).
- iOS: put `apps/mobile/resources/app-icon-light.png` and `app-icon-dark.png` in the AppIcon set (Any and Dark); see the README there. Move them out of `apps/mobile` first.
- iOS: confirm IndexedDB persistence in the WebView, or move the key-value store to the Filesystem plugin (a new dependency; ask first).
- iOS: backup and .txt downloads use a blob link (`packages/ui/src/util/files.ts`), which probably does not work in a WKWebView; check, then use the Filesystem and Share plugins if needed (new dependencies; ask first).
- iOS: check that external links open in Safari from the WebView, and that the sheet's Back handling does no harm where there is no Back.
- Remove `apps/mobile`, its scripts, and the `phone` variants in `packages/ui` that only it uses, once the iOS project wraps `apps/web`; then drop the Mobile app from `docs/DESIGN_BRIEF.md`, the README, and CLAUDE.md.
- Storage: the app now asks for persistent storage after the first saved bulk list or deck (`packages/ui/src/storage/kv.ts`); Firefox asks the user once. Still open: suggest a backup when the browser refuses.

## Builder defects

- Teach the grow builder secondary styles (a tribe as the secondary included): the owner wants secondary styles kept (2026-11-18), and they are the only reason the apps still reach the classic builder. Build a secondary style as a second, smaller set of floors, judge it on new held-out pools, then remove the classic builder as below.
- Removing the classic builder, once the grow builder builds secondary styles: route thin-pool plain shapes at 60, 40, and 100 to land padding as at 20; move the 11 helpers `grow.ts` imports out of `builder.ts`; keep or recount `styleCounts` and `deckThemes` for saved classic decks; delete `buildClassic`, `plan.ts`, `select.ts`, and their tests.
- Follow-up to that removal (config formats and `ATTRIBUTION.md`; ask first): the classic-only `builderWeights` keys, `config/learned`, the `archetypes.json` matchers, and the learned data scripts.
- Until then, classic decks skip the card needs gate (unsupported copies per deck 1.0 at 60, 0.88 at 40, 2.33 at 100), keep the old matchers' false friends (surveil 1 on removal, charge and energy counters, Sphinx's Tutelage, nine player Auras as Voltron, Treasure and Food as outlets, Shrines), and can swap out a color's minimum in local search.
- Learned selection (EDHREC, Commander Spellbook) now runs only on the classic path, so it shapes secondary-style decks alone while About credits it for the builder; `configVersion` (`config.ts`) still includes the learned versions.
- That last-resort classic best fit (`bestFit` in `grow.ts`) can name a deck after a theme the rules call short, with no `nearest` note (`grow.test.ts` asserts Graveyard on a pool with 0 of 6 payoffs); pad with lands or refuse.
- `scan.ts` caps usable nonbasics with the one-color `nonbasic.maxShare` at every color count, while the mana base uses `colors.nonbasicMaxShare`; a multi-color scan can report missing lands for a pool the builder could fill (suspected).
- `theme-bulk.json` counts every theme card while pool tallies drop jobs the pool cannot pay for, and the smaller of two noisy sides biases two-sided themes low (0.78 to 0.96 against Evasion's 1.05); recompute the baseline with the pool rule.
- Confirm that dropping the review prototype's "one-sided theme reads richness 1" guard was intended; `richness()` now reads setup alone for such themes.
- Validation does not require theme minimums at every size, so a style without them falls back to setup and payoff floors with no `lacks` phrase.
- A theme floor can sit below what the reader asks of an unparsed need: the Enchantments floor at 40 (5) is below `unparsedScale` times the threshold (6), so plain-03 B 40 Enchantments is short (11 named requests short this way).
- `feedNeeds`' supplier test (`refSupplies`) mirrors `resourceMet` by hand, and a need met by colors, lands, or devotion is never fed.
- The scan can plan a style the deck cannot hold (Spawnbed Protector's Eldrazi, 1 in about 3,900 thinned requests); recheck since the `holdable` rule.
- `holdable` counts a spell's supply only when one copy holds alone, so Foundry Inspector, Urza's Tome, and Golem Foundry supply nothing to other cards, and Chillerpillar (60) and Fodder Launch (40) lose their own jobs.
- Tribe floors at 100 (20 setup, 10 payoff) are untuned: they refused 4 of 20 panel tribe requests the classic builder built decently, and tribe decks stay at the setup floor because `grow.setupPull` rarely beats a stronger card (Lathril's Elves 20 setup, 13 payoff).
- A commander that does a job counts as one copy, so decks built around their commander read short (Voltron carriers, Energy, Group hug, Goad precons); the source want also counts the commander as one copy though it is cast every game.
- Mill at 100 has plain floors though the theme guide offers it only under a milling commander, and Group hug at 100 assumes a hugging commander; decide both.
- Theme rules cannot hold some sub-floors (cheap Artifacts and Enchantments sources, Ramp payoffs at mana value 6 or more, Evasion attackers at power 2 or more, Landfall's lasting payoffs) or deck-dependent weights (Graveyard entomb and creature cycling when reanimating), and the Aristocrats value-outlet rule is not encoded.
- The 20-card theme core can fill most of a packet (Lifegain 10.5 of 12 spells, Spellslinger 9.1); a spell budget that leaves room for role minimums is not built.
- `halfCast` splits a packet's lands evenly whatever its spells ask, checks color sets one at a time, reads printed mana value (Ghalta, Primal Hunger and Gorex, the Tombshell stay out), and counts an "or pay" cost without its extra mana.
- Cheap-heavy pools overshoot the low curve: bulk-black 60 best fit (Aggro) plays 13 one-drops against a target of 8.
- Off-color kicker and disguise costs keep 61 cards (`offcolor-additional-cost`) out of decks without that color, though real draft decks play them unkicked; role credit must ignore the kicker first (Desolation Giant reads as a sweeper).
- Draft splashes run on fewer sources than the 75% splash target, so half of real multi-color draft decks read as stretched; a lower splash chance fits better but `castChance` also drives classic castability.
- The picker's near ties flip on the last few basics, which keeps out the cast split (10% to 20% of best fits moved); make the picker robust to them.
- Multi-color mana: split cards count only their first half's pips, pathway lands count for both colors, Thriving lands count for every color in 3+ color decks, and true fetches (no `tutor-land-basic` tag) are not used for fixing.
- One-color fetch lands: in Landfall they gain plan credit even when they find no basic of the deck color (Bad River in mono-white), the mana base skips every fetch, and Replace may rank one above a basic.
- Evasion's rules count no maker of evasive tokens, so Realm of Koh and flying-token spells earn no Evasion job; needs a theme rules change and a panel.
- `manaSourceKind` ignores `restricted-mana`, so La Forge, Perceptive Engineer, and Soldevi Machinist lower the land count through `landFormula.credits`.
- Two-color 40-card requests built in one color kept spells whose activated ability needs the dropped color (Haywire Mite, Gruul Cluestone, Shalai, Voice of Plenty); recheck on current code.
- Roles: `cardAdvantage` lists cantrip (89 removal spells that only cantrip fill it); removal counts bounce alone (217 cards), face-only burn, Pyroblast, and Plummet; `earlyCreature` counts Defender walls (Wall of Wood); there is no counterspell role above mana value 2.
- Shape templates the theme guide recommended were never applied (Aggro removal 5/7 at 60 and 3/5 at 40, no Aggro finisher minimum, Midrange 100 removal 9 and card advantage 14, Control sweeper minimum 0 at 60); decide with a panel.
- Strong creatures that fill no role score below median and are rarely played: True-Name Nemesis, Rangers of Ithilien, Steel Leaf Champion, Skyship Stalker.
- Cards dead in every reviewed version were never explained (Aetherflux Reservoir, Technodrome, Séance Board, Idol of False Gods, Hydroblast, Red Elemental Blast); recheck on the grow builder.
- Symmetric or self-harming cards are not seen as such: Rites of Flourishing helps the opponent, Day of Black Sun kills your own creatures.
- Decide how the builder treats modal double-faced cards with a land back face, which the pack marks `entersTapped` from the land face.
- Judgment numbers sit in code, not config (a config format change; ask first): `grow.ts` peer group size, rich seed margins, and slack; `commander.ts` fixing lands, cheap mana value range, tier weights, and top-quarter minimum; `scan.ts` `MIN_COLORED_SHARE`, tribe member minimum, top 15 tribes, and the tribal curve profile; `matchers.ts` finisher thresholds and the mana source mana value.
- `curveTargets` (`builder.ts`) returns a leading 0 for bucket 0 while its comment says buckets 1 through 7.
- Validation gaps: the sign of `nonbasic.entersTapped` and size 100 in the merged `typeMixOverrides` are unchecked.
- Dead config (a format change; ask first): `card-needs.json` `vocabulary.builtInSacrifice` is never read.
- `pool.ts` defaults `now` to `new Date()`, the only clock in core, and `pool.ts` and `resolve.ts` call `localeCompare` with no locale, so export order and name suggestions depend on the device; neither feeds the builder.

## Reader misreads

- Dragon's Fire: the optional "you may reveal a Dragon card ... or choose a Dragon" cost reads as a required need, so the card is dead without Dragons.
- Mirror Shield: the granted deathtouch trigger makes the whole Equipment clause need deathtouch creatures.
- Cloud Key: "choose artifact, creature, enchantment, instant, or sorcery" is unparsed and reads as needing artifacts or enchantments.
- Imperious Perfect, Elvish Archdruid, and Crown of Skemfar earn tribe payoff credit with no other card of the type (they supply or count themselves).
- Cards that make one creature every type are no tribe setup: Amorphous Axe, Runed Stalactite, Arachnoform, and Maskwood Nexus's static ability.
- Lands: animate conditions are missed, so Frostwalk Bastion (snow), Cavernous Maw (three other Caves), and Inkmoth Nexus (infect) count as creature lands for every shape.
- Lands: typal or colorless abilities read with no need: Swarmyard, Tomb of the Spirit Dragon, and Minas Morgul, Dark Fortress (makes a Wraith).
- Lands: conditions missed on plan lands: Field of the Dead (seven differently named lands) and Ruins of Oran-Rief (a colorless creature that entered this turn).
- Lands: mana of more than one of the deck color reads as plain mana (Castle Garenbrig, Gaea's Cradle outside Tokens), and Cabal Coffers reads as no deck color.
- Lands: abilities that almost never matter score as utility: Tolaria (banding), Hammerheim (landwalk), Urborg (first strike or swampwalk).
- Lands: Phyrexian Tower reads as colorless only, so it cannot enter mono-black Aristocrats.
- Lands: Theorist's Sanctum counts in mono-blue Graveyard, since Empower Jace reads as needing nothing.
- Lands: these still read as always tapped: "your opponents control eight or more lands" and Starting Town's first three turns; Argoth's "legendary green creature" drops the color.
- Theme rule patterns cannot strip abilities granted in quotes (Goad, Group hug), and `[^.]` stops at a period inside a name, so Black Waltz No. 3 misses the Burn payoff.

## Measurement gaps

- Best fit is a plain shape about 90% of the time (Midrange by the tie rule) and no measure tells plain decks apart; a panel should judge whether `picker.themeMargin` and `picker.richnessZ` are right.
- `npm run eval`'s synergyPairs, synergyDensity, and filler are classic deck score measures; replace them with grow measures and add one for decks that miss their own theme floors.
- `corpus:eval` reads the classic deck score (`explanation.score`), so its score and "ref ahead" columns are empty for grow decks.
- `corpus:eval`'s style-mix blockers apply the mechanical rule from before 2026-11-11; align them with the owner rule or label them diagnostics.
- Two panels exist with two rubrics and packet formats (`corpus:panel`, and `review:packets` with `review:collate`); pick one.
- Every eval run writes into the tracked `eval/results` folder (`eval.ts`); write runs that are not baselines elsewhere.
- Nothing warns when `config/theme-bulk.json` and the pinned pack differ; the "shipped baseline" test skips when they do, and always in CI.
- Test fixtures (`needs-cards.ts`, `land-cards.ts`, `needs-expected.json`, and the rest) are hand-copied from the 2026-11-03 pack with no documented way to add or refresh them.
- The 708 theme-rule example expectations sit in gitignored `data/review/scratch/tr/`; commit them as a fixture or accept losing them.
- Rerun `npm run needs:report`: the coverage summary predates the card needs changes in 26.0.46 and 26.0.47.
- Re-measure the Analyze search on a 3,000-card five-color list (last: about 1,500 decks in 75 s, before 20-card packets moved to the grow builder).
- Recheck whether the Analyze pane still needs its two-color default now that the picker charges `picker.colorCost` per color.
- Recheck `review:check`'s theme-flag minimums and proxy thresholds against the anchors and the last two panels.
- `review:cards` shows classic matchers and learned notes, not theme rule jobs or card needs.
- Judge agreement was last measured in the builder review (86% to 96%); give a share of packets to second judges on the next panel.

## Later

- Batch balanced mode: several decks of similar strength from one pool.
- Download images for the pool for full offline use.
- Service worker: show a "new version available" prompt instead of waiting for the next load.
- Card detail: rulings fetched from Scryfall on demand.
- Replace on saved decks (a kept deck in place; an accepted one also moves cards between pool and deck).
- Hook tests in a DOM test environment (needs jsdom; ask first): `useBuildFlow` accept and reject, the packet merge.
- Commander: Partner, Background, and similar pairs; colorless commanders (Wastes); a role for answers to artifacts and enchantments; prefer ramp cheaper than the commander; extra copies of a commander whose text allows any number.
- Drain as a theme rules style, with payoffs real drain decks run (the 2026-11-05 learned definition matched 1 or 2 real decks).
- Let card quality compete only within a job (removal against removal) and measure again; the 2026-11-05 recalibrations cost plan recall.
- Prefer spreading copies across more distinct cards when the pool allows.
- The Build screen could say before building that a creature-only pool misses cheap interaction.
- Move the Commander list's checks (`useCommanderList`, `commanderCanBuild`) to a worker if the list stutters.
- Grow build speed: skip the supply copy when a card supplies nothing its credits read.
- Tune `config/display-tags.json` (Blink and -1/-1 match few cards, Artifacts and Graveyard many).
- Split the large files along their marked seams: `grow.ts` (plans, fill, picker, routing), `card-needs.ts` (compile and validate, and the land section beside `lands.ts`), and the Bulk List in web `screens.tsx`.
- Duplicated builder code, moot once the classic builder goes: the deck assembly tails, the color weight formula, and the role-short and tribe refusal notes in `builder.ts` and `grow.ts`; `castModel` and `castShare` repeat one loop in `grow.ts`.
- Pipeline: one loader for the pack, config, settings, and learned data (about nine scripts repeat it); one CLI helper file for `ROOT`, `arg`, `git`, and `median`; one list of the app data folders (now in `cli.ts`, `learn-build.ts`, and `scripts/pull-data-pack.mjs`).
- Config loading lists the files by hand in three places (`packages/ui/src/data/config.ts`, the core config test, `loadConfigDir`), and per-size tables follow two conventions (`PerSize`, `SizeTable`); unify each.
- Move word lists in `card-needs.ts` (`namedResources`, `NO_USE`, `BODY_HARM`) into `card-needs.json` (a format change; ask first).
- Design: decide whether to build the Bulk List grouped by mana value (header bars like "Mana value 2, 7 cards", small thumbnails, a "Group: Mana value" chip).
- Design: ink and fg-1 share a lightness in light mode; split ink into a text and an accent color if it reads flat.
