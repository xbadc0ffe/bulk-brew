# Verification of our-builder.md

A skeptical check of `docs/review/our-builder.md` against the code at 26.0.35 (`packages/core/src`, last core change 217aa00), `config/`, and `data/packs/cards.json`. Scratch scripts and outputs are in `data/review/scratch/our-builder-verify-*` (gitignored). Run each with `node data/review/scratch/<name>`.

## What holds

The code description is accurate. Every function and line reference I opened points at the code it names, with three small slips listed below. Specifically:

- The pass order in `fillAll`, the `pickBest` order (curve deficit, then `themeTagHits`, `strength`, `lowerMv`, `name`, then id), the swap search (3 passes of 200, first improvement in id order), and every objective term and weight match `builder.ts` and `builder-weights.json`.
- The dual-count path holds line by line: `themeOf` (269-277), payoffs first in `fillTheme` (765-771) with `count(isEnabler)` counting dual payoffs (750-754, 775), theme value 2 in `attempt` (1365-1380), `addToTally` (418-419), and the same counting in `scan.ts:96-97`, `plan.ts:196-205`, `planCloseness` (1103-1104), and `styleCounts`.
- `PrimaryTheme.pairs` is false for synergy styles (`builder.ts:276`). `MatcherClause` is at `config.ts:44`. `combos.weight` is only validated, never read.
- Plan choice: I rebuilt best fit for every eval pool and mono color. At 20 and at 60, best fit kept the top buildable plan in 16 of 16 and 15 of 15 cases (`our-builder-verify-build.ts`, `our-builder-verify-out-build.txt`). The Build page and the Analyze pane at 60, 40, and 20 always pass a style (`options.ts:141-153`, `best-decks.ts:160-173`).
- The counts reproduce: 1,020 `mill-self` spells, 184 `graveyard-fuel-self`, 644 cantrips that all carry `pure-draw`, 39 of 407 looters, 10,790 combos, 339 mana-only two-card combos, and 1,109 commanders. The fit values reproduce too: Microscope 0.89 and Merfolk Looter 0.50 (`our-builder-verify-out-cards.txt`, `config/learned/tags.json`).
- Timing reproduces within a few ms: 416, 57, 152, 49, 188, and 73 ms (`our-builder-time.ts`). The profile shares reproduce: `localSearch` 62.7%, `objectiveOf` 27.5%, `selectionFor` 8.7%, `fillAll` 7.4% inclusive (`our-builder-verify-out-prof.txt`).
- Determinism: repeat builds came out identical.

## Issues

### Wrong

- **Claim:** "White Lifegain counted three Sonar Strikes as enablers ('You gain 3 life if you control a Bat.') with no Bat in the deck" (section "Where a card can get in", item 3; also in the summary).
  - **Problem:** the deck runs five Bat copies, so Sonar Strike's life gain is live. Sonar Strike is still a one-time rider, so the class of failure stands, but this example is false.
  - **Evidence:** Essence Channeler (Creature, Bat Cleric), Lifecreed Duo (Bat Bird), Momo, Friendly Flier and Momo, Playful Pet (Lemur Bat Ally), and Star Charter (Bat Cleric) are all in the deck (`our-builder-verify-out-build.txt`: "Bat or changeling copies 5"). The same cards are in the author's own `our-builder-out-decks-other.txt`.
  - **Severity:** wrong.
- **Claim:** "La Forge, Perceptive Engineer (mana only for artifact spells) ran as 'Ramp' in Blue Graveyard, which plays one artifact" (item 5).
  - **Problem:** the deck plays three artifact spells.
  - **Evidence:** Microscope (Artifact), Etherium Sculptor (Artifact Creature), and Torrential Gearhulk (Artifact Creature) (`our-builder-verify-out-build.txt`: "artifact spell copies 3").
  - **Severity:** wrong (the point about restricted ramp still holds).
- **Claim:** "Sacrifice outlets are in no clause at all; the 30 of 952 that count get in through `mill-self` or `graveyard-fuel-self`" (cause 2).
  - **Problem:** only 26 of the 30 get in that way. The other 4 match a discard-outlet or rummage clause with a payoff tag.
  - **Evidence:** the 4 are Kardur's Vicious Return, Shilgengar, Sire of Famine, Souls of the Lost, and Tarrian's Journal (`our-builder-verify-sac.ts`, `our-builder-verify-out-sac.txt`).
  - **Severity:** wrong (minor).
- **Claim:** three line references.
  - **Problem:** each is off by a few lines.
  - **Evidence:** the 90 ms note is at `docs/algo-review.md:53`, not `:50`. `featuresOf` is at `packages/pipeline/src/plans.ts:244`, not `:241`. `minimumScale` is read at `config.ts:513`; `:506` is the start of its function.
  - **Severity:** wrong (nit).

### Unsupported

- **Claim:** "Learned pairs from other plans... Poppet Stitcher... had the highest pair gain in Blue Graveyard (0.20 points) and came in as 'Filler'." The summary says "Learned pairs pulled in Poppet Stitcher."
  - **Problem:** the pair gain is real, but nothing shows it caused the pick. With learned pairs switched off in memory, Poppet Stitcher stays in the deck. Microscope, Ephara's Dispersal, and Sentinel of the Pearl Trident drop out instead.
  - **Evidence:** `our-builder-verify-ablate.ts`, `our-builder-verify-out-ablate.txt`: "no learned pairs: Poppet Stitcher=1". Its strength of 5.44 (1.63 objective points) alone can carry a swap.
  - **Severity:** unsupported. Pick an example whose removal flips with the pairs term.

### Misleading

- **Claim:** "Six enabler copies were riders or self-use: Ephara's Dispersal, Microscope, Screeching Sliver, Spyglass Siren, and two Constrictor Sages."
  - **Problem:** Microscope and Screeching Sliver are not riders. Each is a repeatable one-card engine (weak, but it fills the graveyard every turn), and that ability is the card's main text. Four copies are one-time riders or self-use, not six. The doc's own frame ("how much or how often") separates these.
  - **Evidence:** Microscope reads "{T}: Surveil 1." and carries `repeatable-surveil`. Screeching Sliver reads 'All Slivers have "{T}: Target player mills a card."' (`our-builder-verify-out-cards.txt`).
  - **Severity:** misleading.
- **Claim:** "Riptide Survivor and Teferi's Imp, real discard setup, made the deck as card advantage and counted as nothing."
  - **Problem:** Riptide Survivor discards two cards once, when turned face up. That is the same one-time size the doc calls a rider on Ephara's Dispersal. Both cards also count as enablers of the hand rule `graveyard`, so they are not "nothing".
  - **Evidence:** both have `ruleE: graveyard` (`our-builder-verify-out-cards.txt`). Riptide Survivor's text: "When this creature is turned face up, discard two cards, then draw three cards."
  - **Severity:** misleading (minor).
- **Claim:** "the matcher language cannot say how much or how often" (section "Setup and payoff are counted, not fitted"; summary).
  - **Problem:** it cannot say how much. It can say how often through Tagger tags that already exist and can be required with `anyTags` or `allTags`. That makes a cheap first fix possible, which the review should know about.
  - **Evidence:** spell and card counts for `repeatable-surveil` 152, `repeatable-loot` 242, `repeatable-rummage` 136, `repeatable-lifegain` 1,498, `repeatable-creature-tokens` 1,497, `repeatable-sacrifice-outlet` 905. 146 of the 1,070 `mill-self` cards carry a repeatable mill or surveil tag (command in this file's session, pack 2026-11-03).
  - **Severity:** misleading.
- **Claim:** "All 644 cantrips also carry `pure-draw`, so removal that draws a card fills Card advantage; 428 cards fill both."
  - **Problem:** `cantrip` is itself listed in the Card advantage matcher, so the cause is the role definition, not tag leakage through `pure-draw`. Also, the 428 are every card that is both removal and card advantage. Only 89 of them are cantrip-style removal; the rest include real card advantage.
  - **Evidence:** `config/roles.json`, `cardAdvantage.match[0].anyTags` includes `"cantrip"`. "removal and cardAdvantage 428 of which cantrip with no other draw tag but pure-draw 89" (`our-builder-verify-out-cards.txt`).
  - **Severity:** misleading.
- **Claim:** "It ignores the `restricted-mana` tag, so 84 cheap mana sources that only cast some spells fill Ramp."
  - **Problem:** 84 is a text search for "spend this mana only" over every card, Un-sets included. It is not a count of the tag the sentence names.
  - **Evidence:** the tag gives 96 cheap mana source spells without Un-sets, or 97 with them. The text search gives 83 or 84 (`our-builder-verify-out-sac.txt`; `our-builder-misc.ts` uses the regex on `pack.cards`).
  - **Severity:** misleading (minor).
- **Claim:** "Sphinx's Tutelage, which mills the opponent, gets 0.71 through the generic `mill` tag." The summary also says "Graveyard fit is mill-self 4.88 against loot 1.98."
  - **Problem:** `mill` gives 0.42 of Tutelage's 0.71. The other 0.30 comes from `discard-outlet`, for its {5}{U} loot. The loot comparison also leaves out that `rummage` (3.26) and `discard-outlet` (2.69) fit better than `loot`.
  - **Evidence:** `config/learned/tags.json` graveyard fit: mill 4.02, mill-self 4.88, discard-outlet 2.69, rummage 3.26, loot 1.98; 0.3 × (ln 4.02 + ln 2.69) = 0.71.
  - **Severity:** misleading (minor).
- **Claim:** "`objectiveOf` (a full rescore per candidate per removed card)", and "drop the full rescore in `objectiveOf`."
  - **Problem:** `objectiveOf` does not rescore the deck. It turns the running tally's sums into a number, which costs O(rules + roles + buckets), and each candidate changes the tally by plus or minus one copy. The full re-tally happens once per removed card (`builder.ts:996-999`), not once per candidate. The cost is real (27.5%), but it comes from the fixed per-call work in `synergyPairs` and the role and profile loops.
  - **Evidence:** `builder.ts:1014-1021` and `500-539`. `tally` is 13% inclusive and `objectiveOf` 27.5% (`our-builder-verify-out-prof.txt`).
  - **Severity:** misleading (minor).
- **Claim:** "requested builds take tens of milliseconds on desktop, so phone speed matters mostly for best fit and the Analyze pane."
  - **Problem:** the Build page, the main flow, makes up to `buildOptions.maxBuilds` 36 requested builds per request. At about 50 ms each that is near 2 seconds on desktop before every option is shown, and more on a phone.
  - **Evidence:** `config/builder-weights.json` `buildOptions.maxBuilds: 36`; `options.ts:119-129`.
  - **Severity:** misleading.

### Missing

- **Most off-plan cards entered in the swap search, not in the fill passes.**
  - **What is missing:** the doc reads "why" labels as the pass that picked a card ("came in as Early creature", "ran as Ramp"). Swapped-in cards get their label from `describeWhy` (the first role they fill), so the label does not say how they got in.
  - **Evidence:** with the swap search off in memory, these Blue Graveyard cards were not in the deck before the swaps: Loki, Sentinel of the Pearl Trident, Poppet Stitcher, La Forge, Microscope, Fact or Fiction, Riptide Survivor, Sphinx's Tutelage, Etherium Sculptor, Torrential Gearhulk, Ruin Crab, and Sudden Setback. The same holds for Anafenza (Lifegain) and Zodiac Goat (Spellslinger) (`our-builder-verify-out-build.txt`). Ephara's Dispersal and the Sonar Strikes did come from the fill passes.
  - **Why it matters:** this points the redesign at the objective that drives the swaps more than at the pass order.
  - **Severity:** missing.
- **Energy is the most extreme case of cause 3, and the doc never names it.**
  - **What is missing:** the author's own scratch output shows that 102 of 120 Energy enablers are also payoffs (85%). Counters is at 22% and Tokens at 17%.
  - **Evidence:** a requested White Energy 60 met its theme with 13 of 16 enabler copies being dual cards and no payoff-only cards (`our-builder-verify-out-decks.txt`; `our-builder-out-tags.txt`).
  - **Why it matters:** the brief says to expect the problem in every theme, so per-theme dual shares belong in the doc.
  - **Severity:** missing.
- **The 40-card path is not described or tested.**
  - **What is missing:** at 40, best fit and the Build page ranking use the old deck score: synergy 0.6 (hand-rule pairs per spell over `synergyReference` 2, every rule in every deck, dual cards on both sides), plus strength, roles, curve, type mix, and castability (`builder.ts:1191-1208`). The doc names no part of it, and all its deck evidence is at 60.
  - **Evidence:** a requested Blue Graveyard 40 has 4 enabler copies and is padded with Clockspinning, Endless Evil, and Ichormoon Gauntlet as filler. It also runs four restricted ramp copies (2 La Forge, 2 Soldevi Machinist, mana only for artifacts) that cut the deck to 16 lands (`our-builder-verify-out-decks.txt`).
  - **Severity:** missing.
- **The learned fit's two-tag cap is filled by a tag and its parent.**
  - **What is missing:** every `mill-self` card also carries `mill` (1,094 of 1,094), and every `loot` card carries `discard-outlet` (425 of 425). So "at most two tags" (`select.ts:192-198`) counts one effect twice. This is the same double-count pattern the review is hunting, inside the learned data.
  - **Evidence:** command over `data/packs/cards.json` in this session.
  - **Severity:** missing (minor).
- **A land refit after the swap search can add or trim cards.**
  - **What is missing:** after `localSearch`, `refitLands` runs again (`builder.ts:1446`). It can call `fillAll` (`964-974`), which adds cards that no swap checks, or trim by `TRIM_ORDER`. So the final deck is not always the swap search's result.
  - **Severity:** missing (minor).
- **Doc drift named in the summary is not in the document.**
  - **What is missing:** the summary reports that `docs/guides/archetypes.md:7` lists a "vanilla body" derived fact that `DerivedPredicate` (`config.ts:9-16`) lacks. That is true, but the document does not say it. `docs/todo.md:26` ("Best fit builds every viable style per request") is also stale; the document cites it for timing only.
  - **Severity:** missing (minor).
- **Small samples behind the Graveyard target are not mentioned.**
  - **What is missing:** the Graveyard profile at 60 comes from 12 real decks (`config/learned/plans.json`, `sizes.60.plans.graveyard.decks`). The fill target, the drift cap, and closeness for that theme all rest on it.
  - **Why it matters:** cause 4 is about learned data, so the sample size belongs there.
  - **Severity:** missing (minor).

## Verdict

**Needs fixes.** The code reading is sound, and all four causes are checked correctly against the code. The fixes concern the deck evidence:

- Two concrete examples are false: the "no Bat" claim and the "one artifact" claim.
- One causal claim is unsupported: pairs pulled in Poppet Stitcher.
- Two of the six "riders" are repeatable engines.
- The doc misses that most off-plan cards entered during the swap search, misses the most extreme dual-count theme (Energy), and misses the 40-card path.

None of this overturns the main finding: setup and payoff are counted by tag membership, each on its own, and nothing makes them fit together.
