## Bulk Brew's builder (26.0.35)

What the code does, read from `packages/core/src` and `config/`, with differences from the docs noted. Examples come from builds on `eval/pools/` made with scratch scripts in `data/review/scratch/` (gitignored), named beside each number.

### How it picks a plan

**Scan.** `scanCandidates` (`packages/core/src/scan.ts:157`) counts the pool's enabler and payoff copies for each of the 18 themed styles (`reportSynergy`, `scan.ts:85`) against the size's `minimums` in `config/archetypes.json` (Commander scales the 60-card numbers by `commander.minimumScale` 1.6, `config.ts:513`). A style is viable when both counts reach their minimums; its margin counts only cards with strength at least `themeMinStrength` (3). Aggro, Midrange, and Control are viable when the pool covers each role minimum (`reportComposition`, `scan.ts:124`). Enablers and payoffs are counted separately, so a card that is both adds to each.

**Best fit.** `buildDeck` (`builder.ts:1522`) takes the 20 viable themes with the largest margins and the 3 best viable shapes (`bestFitCandidates`, `builder.ts:1217`). At 100, 60, and 20, where `learned.plan[size].use` is on, `planScores` (`plan.ts:120`) scores each theme as log prior + `liftPower` times log lift + 2 log fill + a calibrated `bias`:

- **prior:** the share of real decks of the size that run the plan (`planPriors`, `plan.ts:72`), blended with the commander's EDHREC plan shares at `commanderShare` 0.6;
- **lift:** theme copies in the pool (each card once, weighted by learned card fit) over what random bulk of the same color classes would hold (`expectedThemeCopies`, `colors.ts:200`);
- **fill:** how close the pool comes to the plan's learned median of enablers and payoffs, each counted on its own (`plan.ts:188-205`; the comment there says a card can be both);
- a theme is dropped when the pool holds less than the lower quarter of real decks' enablers or payoffs (`quartileMinimums`, `plan.ts:166-176`).

Shapes score by how close the curve of the pool's strongest cards sits to each shape's profile (`shapeDistances`, `plan.ts:241`). The 3 best themes (`learned.candidates`) and the viable shapes are built in full, and the winner is the best plan score plus `deckScoreWeight` times the deck score (`rankOf`, `builder.ts:1629`). That weight is 0 at 100 and 60 and 0.01 at 20, so the top plan wins unless its build fails. At 40 the learned plans are off and best fit keeps the highest deck score. `docs/guides/card-strength.md:48` still describes the 40-card way for every size; `SPEC.md` "Builder" step 2 is current.

**The 40-card deck score.** At 40 the deck score (`scoreDeck`, `builder.ts:1133`, totals at `1191-1208`) decides best fit and the Build page ranking. Its weights (`builder-weights.json` `deckScore`) are synergy 0.6, castability 0.3, strength 0.15, roles 0.1, curve 0.1, and type mix 0.05, so synergy is nearly half the total. Synergy is the hand rules' pairs per spell over `synergyReference` 2: every rule counts in every deck, and dual cards add to both sides. Learned selection is also off at 40, so the swap objective uses the hand rules at full weight. A requested Blue Graveyard 40 on `eval/pools/bulk-blue.txt` has 4 enabler copies and Clockspinning, Endless Evil, and Ichormoon Gauntlet as filler. Four of its six cheap mana sources are restricted ramp (2 La Forge, 2 Soldevi Machinist, mana only for artifacts), and their credits help cut it to 16 lands from a base of 17 (`our-builder-verify-out-decks.txt`).

**Requested styles.** A named, viable style is the only one built (`builder.ts:1550-1575`), and `planScores` does not run. The Build page options and the Analyze pane at 60, 40, and 20 always name a style (`buildOption`, `options.ts:134`; `best-decks.ts:160`), ordered by scan margin (`byStylePromise`, `options.ts:68`) and ranked by deck score plus `allColorsBonus` and `secondaryBonus` (`options.ts:206`). So the calibrated plan choice runs only for a single best-fit build and the Analyze pane at 100.

**Commander.** Its color identity sets the colors (`builder.ts:1530`). Tribes its own `typal-*` tags name join the try list (`commanderTribes`, `scan.ts:340`). `commanderPull` (`builder.ts:1489`) raises the prior of styles its text rewards, most for the style whose payoffs are rarest in the pool. The commander counts one copy toward each role it fills (`creditCommander`, `builder.ts:1297`). Without EDHREC data for the commander, learned selection is off for the build (`select.ts:162`).

### How it picks cards

**Passes** (`fillAll`, `builder.ts:932`), after reserving the template's base land count:

1. role minimums (`fillRoles`, `builder.ts:723`), in template key order;
2. the theme to its minimums (`fillTheme`, `builder.ts:746`): payoffs first, then enablers, each in three tries (strong cards only, any card, then bending copy guidelines);
3. a secondary style to half its minimums (`fillSecondary`, `builder.ts:880`);
4. each color's minimum in a multi-color deck (`fillColorMinimums`, `builder.ts:917`);
5. role targets;
6. the theme toward the learned median of real decks of the plan (`fillThemeTarget`, `builder.ts:787`; `learnedTheme`, `learned.ts:378`), strong cards first;
7. creature and instant-or-sorcery minimums (`fillTypeMinimums`, `builder.ts:810`);
8. the curve, always the bucket furthest below target (`fillCurve`, `builder.ts:837`);
9. filler, any card, first ignoring type caps, then copy guidelines (`fillAny`, `builder.ts:861`).

Every pass picks with `pickBest` (`builder.ts:651`): a card in a curve bucket below target wins; then the tiebreaks in `builder-weights.json` (`themeTagHits`, `strength`, `lowerMv`, `name`), then card id. "Strength" there is card strength minus the cast penalty plus the learned gain in strength points (`builder.ts:671-680`). The land count is then refit to the spells, trimming filler first (`refitLands`, `trimTo`, `builder.ts:945-974`).

**Swap search** (`localSearch`, `builder.ts:976`): up to 3 passes of 200 swaps. For each chosen card in id order it removes one copy and tries every candidate in id order, keeping the first that raises the objective. The objective (`objectiveOf`, `builder.ts:500`; weights in `builder-weights.json` `objective` unless named):

- minus `curveDeviation` (1) per copy a bucket sits outside `tolerances.curve` of its target;
- minus `typeMixDeviation` (1) per copy outside the type mix bounds;
- minus `roleShortfall` (2) times (2 per copy below a role minimum, plus 1 per copy below its target);
- plus `synergyDensity` (1.5) times the style's `synergyWeight` times the sum over every rule in `synergy-rules.json` of its weight times min(enablers, payoffs), times `learned.selection[size].rules` (0.25) under learned selection (`synergyPairs`, `builder.ts:485`);
- plus learned plan fit, pairs, and combos (`select.ts`; `learned.selection` per size);
- plus `themeHit` (0.3) per theme hit;
- plus `cardStrength` (0.3) per strength point, less cast penalties;
- minus `learned.profileWeight` (2) per copy a role or card type sits outside the middle half of real decks of the plan, and per theme enabler or payoff above their upper quarter (`builder.ts:526-537`; `planShapeOf`, `builder.ts:200`).

A swap may not take a theme card out when that leaves the count below `themeWant`: the minimums, raised to the learned target after the first refit (`builder.ts:1001-1013`, `1437-1441`).

After the swaps, `refitLands` runs once more (`builder.ts:1446`). When the land count moves, it trims by `TRIM_ORDER` or calls `fillAll` (`builder.ts:964-974`), which adds cards that no swap checks. So the final deck is not always the swap search's result.

**Theme target.** The median share of real decks of the plan times the spell slots: for Graveyard at 60, 8 enablers and 10 payoffs on 35 slots (shares 0.232 and 0.285 in `config/learned/plans.json`).

**Setup and payoff are counted, not fitted.** Nothing makes them feed each other. Membership is a yes or no from tag matchers (`computeFacts`, `candidates.ts:89-93`), and the matcher language cannot say how much (`MatcherClause`, `config.ts:44`). It can say how often only through Tagger's existing `repeatable-*` tags, which `anyTags` or `allTags` can require: `repeatable-surveil` on 146 cards, `repeatable-loot` on 234, `repeatable-rummage` on 134, and for other themes `repeatable-lifegain` on 1,463, `repeatable-creature-tokens` on 1,439, and `repeatable-sacrifice-outlet` on 892 (no Un-sets; `our-builder-fix-check.ts`, `our-builder-fix-out-check.txt`). There is no `repeatable-mill` tag, so only 146 of the 1,070 `mill-self` cards are marked repeatable, and Screeching Sliver is not one of them. That makes a cheap first fix possible for surveil, looting, and rummaging, not for milling. For synergy styles `PrimaryTheme.pairs` is false (`builder.ts:276`), so min(enablers, payoffs) never applies to the chosen theme. The only balance-shaped term is the hand rules' min(enablers, payoffs), at a quarter weight under learned selection, and dual cards add to both of its sides.

**A card that is both enabler and payoff counts as both:**

- `themeOf` (`builder.ts:269-277`) makes `isEnabler` and `isPayoff` independent tests;
- `fillTheme` adds payoffs first (`builder.ts:765-771`); the enabler loop's `count(isEnabler)` (`builder.ts:750-754`, used at 775) sums every chosen copy that is an enabler, including the dual payoffs just added, so the enabler minimum is partly met before any enabler is picked;
- `attempt` gives a dual card theme value 2 and both flag bits (`builder.ts:1365-1380`): 0.6 objective points of `themeHit` (2 strength points), and it wins the `themeTagHits` tiebreak over a single-role card;
- `addToTally` adds it to both `pe` and `pp` (`builder.ts:418-419`), so the swap guard counts it toward both minimums;
- the scan, the plan fill, the plan profile, the deck score, and `styleCounts` (the Roles bars on screen) count the same way.

### Mana, curve, and interaction

**Roles** (`config/roles.json`): removal, sweeper, card advantage, cheap interaction, big threat, Commander finisher, ramp, early creature, evasive threat. Minimums and targets per size are in `deck-templates.json` (60: removal 4 to 7, card advantage 2 to 4, cheap interaction 2 to 4, big threat 2 to 4, early creature 4 to 8), with per-style overrides in `archetypes.json`.

**Curve.** Each style names a profile in `curve-profiles.json`; 20 and 100 always use the template's (`effectiveCurveProfile`, `scan.ts:47`). `curveTargets` (`builder.ts:461`) turns shares into copies per bucket.

**Lands.** `planLandCount` (`lands.ts:57`): base lands plus a slope times (average mana value minus a reference), minus credits per cheap mana source (`manaSourceKind`, `matchers.ts:80`), rounded and clamped. `chooseManaBase` (`lands.ts:282`) takes scored nonbasics up to a share, then basics. Multi-color decks size each color's sources with a conditional hypergeometric (`sourcesNeeded`, `colors.ts:158`) at `castChance` 0.9, 0.85, and 0.75 for main, secondary, and splash colors; `castPenalties` (`builder.ts:1266`) take strength off spells that lean on a weak color.

### Data it uses

- **Scryfall Tagger tags** drive every role, style, rule, and strength effect. The **tag overlay** (`config/tag-overlay.json`) is applied when the pack is built (`packages/pipeline/src/build.ts:105`); today it removes one tag from one card. A few **derived facts** cover what tags cannot (`DerivedPredicate`, `config.ts:9-16`); `docs/guides/archetypes.md:7` also lists a "vanilla body" fact that the code does not have.
- **Card strength** (`strength.ts`, `card-strength.json`): base 3, up to +2 from Scryfall's popularity rank (EDHREC rank), stats for cost, keywords, effect points by tag, cost, pips.
- **`config/learned/plans.json`** (corpus): priors, `bias`, plan profiles (quartiles of theme enablers and payoffs, roles, curve, types), and bulk theme shares. Read by `plan.ts`, `planShapeOf`, `learnedTheme`, and `planCloseness` (`builder.ts:1089`).
- **`config/learned/tags.json`** (corpus): tag fit per style and tag pairs, read by `selectionFor` (`select.ts:143`).
- **`data/learned.json`**: card fit per style, draft card pairs, 10,790 Commander Spellbook combos, and EDHREC plans and card fit for 1,109 commanders; optional.
- **Combos** count when every piece is in the pool, the combo is legal at the size, and (below 100) it has two cards. A complete combo is worth `learned.selection[size].combos` (3 at 100, 1 at 60 and 40, 0.6 at 20) times its bracket weight, scored by the square of the share of pieces present (`select.ts:220-251`). `builderWeights.combos.weight` is validated (`config.ts:1004`) but never read.
- **Learned selection is off at 40** (`learnedAt`, `learned.ts:344`): hand rules at full weight, no fit, pairs, or combos.

### Speed and determinism

**Determinism.** No randomness and no seed: candidates are sorted by card id (`candidates.ts:187`), tallies sum in id order (`builder.ts:437`), the last tiebreaks are name and id, and the swap search walks in id order. Every scratch deck built twice came out identical (`our-builder-decks.ts`).

**Measured times.** The docs give about 90 ms for a synthetic 100-card build (`docs/algo-review.md:53`), about 190 ms for a 60-card best fit (`docs/todo.md:26`, which is stale beyond timing: best fit does not build every viable style, and building now runs in a worker), and 1.3 to 1.5 times the pre-learned time (`docs/learned-builder.md:22`). Here, on desktop, `node data/review/scratch/our-builder-time.ts` (`our-builder-out-timing.txt`), median of 5:

| Build                             | Time   |
| --------------------------------- | ------ |
| 100, Lathril, best fit (6 builds) | 420 ms |
| 100, Lathril, Elf tribe requested | 51 ms  |
| 60 white, best fit (6 builds)     | 152 ms |
| 60 white, Tokens requested        | 51 ms  |
| 40 white, best fit (16 builds)    | 186 ms |
| 20 white, best fit (6 builds)     | 78 ms  |

**What dominates.** A CPU profile of that script (`node --cpu-prof`, in `our-builder-prof/`) puts 63% of samples in `localSearch`, 28% in `objectiveOf`, 13% in `tally`, 9% in `selectionFor` (rebuilt per attempt), and 7% in the fill passes (inclusive shares; `tally` from `our-builder-verify-out-prof.txt`). `objectiveOf` does not rescore the deck. It turns the running tally's sums into a number, and each candidate is scored by adding one copy to the tally and taking it back (`builder.ts:1014-1021`). Its cost is fixed work per call: every hand rule in `synergyPairs`, every role, and the profile terms (`builder.ts:500-539`). The full re-tally runs once per removed card (`builder.ts:996-999`), not once per candidate. Best fit at 60 and 100 also builds up to five decks whose scores cannot change the pick: 3 times a requested build at 60 and 8 times at 100.

**License and phone fit.** Our code, MIT. It runs offline in a Web Worker on a pool-only pack. A requested build takes about 50 ms on desktop, but the Build page, the main flow, makes up to `buildOptions.maxBuilds` 36 of them per request (`options.ts:119-129`): near 2 seconds on desktop before every option shows, and more on a phone. So phone speed matters for the Build page as much as for best fit and the Analyze pane.

### Where a card can get in for a reason unrelated to how the deck plays

The Graveyard finding in `docs/algo-review.md` names four causes. Against the code:

1. **Broad setup tags: confirmed.** Graveyard enablers start with `anyTags: ["mill-self", "graveyard-fuel-self"]` (`config/archetypes.json:169`), read in `computeFacts` (`candidates.ts:91`). 1,020 spells carry `mill-self`; 197 mill or surveil one card only, and 213 of the 226 spells that surveil carry it (`our-builder-tags.ts`, `our-builder-out-tags.txt`). It also covers cards that make a target player mill and a creature that makes a Map token. `graveyard-fuel-self` (184 cards, 171 also payoffs) marks cards that use themselves from the graveyard.
2. **Real setup excluded: confirmed, slightly misstated.** Every looter, rummage, and discard-outlet clause also requires a tag that is itself a Graveyard payoff (`archetypes.json:170-180`), so such a card is never setup alone: 39 of 407 looters count, 37 of them payoffs. Sacrifice outlets are in no clause at all. Of the 952 spells tagged `sacrifice-outlet-creature`, 30 count as enablers: 26 through `mill-self` or `graveyard-fuel-self`, and 4 (Kardur's Vicious Return; Shilgengar, Sire of Famine; Souls of the Lost; Tarrian's Journal) through a discard-outlet or rummage clause that also needs a payoff tag (`our-builder-verify-sac.ts`, `our-builder-verify-out-sac.txt`). The hand rule `graveyard` (`synergy-rules.json:79`) does count looters and discard outlets, at a quarter weight under learned selection.
3. **Dual cards count twice: confirmed**, along the path above. One correction: the rules' min(enablers, payoffs) does look at balance, but weakly, and it double counts too. Energy is the extreme case: 102 of 120 Energy enabler spells are also payoffs (85%), against 42% for Graveyard, 22% for Counters, 17% for Tokens, 5% for Lifegain, and 3% for Aristocrats (`our-builder-fix-check.ts`, `our-builder-fix-out-check.txt`). A requested White Energy 60 met its theme with 13 of its 16 enabler copies dual and no payoff-only card (`our-builder-verify-out-decks.txt`).
4. **Learned data and deck score inherit the flaw: confirmed.** The learning script assigns real decks to plans (`planOf`, `packages/pipeline/src/plans.ts:141`) and measures their theme shares (`featuresOf`, `plans.ts:244`) with the same `enablerOf` and `payoffOf`, each counted on its own. Those shares become the fill target, the drift penalty, the plan fill, and the deck score's closeness (`planCloseness`, `builder.ts:1089`). The Graveyard profile at 60 behind the target, the cap, and closeness comes from only 12 real decks (`config/learned/plans.json`, `sizes.60.plans.graveyard.decks`). The tag fit per style (`packages/pipeline/src/learn-build.ts:318-400`) compares how often a tag shows up in decks assigned to the plan, at every size and in EDHREC theme pages, with real decks in general, so it inherits the same plan assignment. It rates `mill-self` at 4.88 and `mill` at 4.02, above `rummage` 3.26, `discard-outlet` 2.69, and `loot` 1.98 (`config/learned/tags.json`).

On `eval/pools/bulk-blue.txt`, a requested Blue Graveyard 60 counted 10 enablers and 10 payoffs and scored 0.87 closeness (`our-builder-decks.ts`, `our-builder-out-decks-graveyard.txt`). Four enabler copies were one-time riders or self-use: Ephara's Dispersal (bounce, surveil 2), Spyglass Siren (a Map token), and two Constrictor Sages, which exile themselves from the graveyard for value. Two more are repeatable but small, and that ability is the card's main text: Microscope ("{T}: Surveil 1.", tagged `repeatable-surveil`) and Screeching Sliver (Slivers tap to make a target player mill a card). The other four are card draw that also bins cards: two Fact or Fiction and two Winternight Stories. Teferi's Imp, a repeatable rummager, and Riptide Survivor, which discards two once when turned face up, made the deck as card advantage. Neither is a Graveyard enabler; both count only as enablers of the hand rule `graveyard`, at a quarter weight (`our-builder-verify-out-cards.txt`). The black deck (`eval/pools/bulk-black.txt`) did the same with a sweeper and a draw spell that surveil.

**A card's label does not say how it got in.** The `why` names the pass only for cards a fill pass picked. A swapped-in card is labeled by `describeWhy` (`builder.ts:706`): the first template role it fills, else theme payoff or enabler, else Filler. With the swap search off in memory, most off-plan cards named below were not in the deck before the swaps: Loki, Sentinel of the Pearl Trident, Poppet Stitcher, La Forge, Microscope, Fact or Fiction, Riptide Survivor, Sphinx's Tutelage, Etherium Sculptor, Torrential Gearhulk, Ruin Crab, and Sudden Setback in Blue Graveyard, Anafenza in White Lifegain, and Zodiac Goat in Red Spellslinger. Ephara's Dispersal and the Sonar Strikes did come from the fill passes (`our-builder-verify-build.ts`, `our-builder-verify-out-build.txt`). So for most of these cards the swap objective matters more than the pass order, and a redesign should aim there first.

The same pattern elsewhere:

1. **Theme hits are the first tiebreak in every pass** (`compareCandidates`, `builder.ts:616`, via `pickBest`). The removal pass takes removal with a theme rider over removal without one before looking at strength. Ephara's Dispersal ran as "Removal" in Blue Graveyard; its rider can put up to two cards in the graveyard, once.
2. **Learned tag fit rewards the tag, not the amount** (`selectionFor`, `select.ts:190-205`). In Graveyard at 60, Microscope gets 0.89 objective points per copy (about 3 strength points), Merfolk Looter 0.50 and no enabler credit (`our-builder-fit.ts`, `our-builder-out-fit-graveyard.txt`). Sphinx's Tutelage, which mills the opponent, gets 0.71: 0.42 from the generic `mill` tag and 0.30 from `discard-outlet`, for its {5}{U} loot. The fit keeps each card's best two tags (`select.ts:192-198`) so related tags are not counted many times, but the two slots often hold a tag and its parent: every `mill-self` card also carries `mill` (1,070 of 1,070 cards, no Un-sets), and every `loot` card carries `discard-outlet` (414 of 414) (`our-builder-fix-out-check.txt`). Microscope's 0.89 is `mill-self` 0.48 plus `mill` 0.42, and Merfolk Looter's 0.50 is `discard-outlet` 0.30 plus `loot` 0.21: one effect counted twice, inside the learned fit.
3. **Payoffs and enablers that are riders, in other themes** (`our-builder-out-decks-other.txt`). Black Aristocrats 60 met its 4 payoffs with Phyrexian Vivisector ("Whenever a creature you control dies, scry 1."), Lightless Evangel, and two Malefic Scythes, beside 21 enabler copies. White Lifegain counted three Sonar Strikes as enablers: removal with a one-time rider ("You gain 3 life if you control a Bat."). The rider is live there, since the deck runs five Bat copies, but each Strike gains life once.
4. **Role credit on riders and narrow tags** (`roles.json`). The Card advantage matcher lists `cantrip` itself, beside `pure-draw`, which all 644 cantrips also carry, so the role definition makes removal that draws a card fill Card advantage. Of the 428 spells that fill both Removal and Card advantage, 89 do so only as cantrips; the rest include real card advantage (`our-builder-verify-out-cards.txt`). Mirror Shield fills Removal because it destroys a deathtouch creature in combat with the equipped one. `earlyCreature` is any creature costing two or less: Zodiac Goat (Mountainwalk, nothing else) is in Red Spellslinger, labeled "Early creature"; it entered in a swap. Below a role minimum each copy is worth 6 objective points (about 20 strength points), below the target 2.
5. **Restricted mana counts as ramp** (`manaSourceKind`, `matchers.ts:80`). It ignores the `restricted-mana` tag, which 96 cheap mana sources carry (no Un-sets; `our-builder-verify-out-sac.txt`), so mana that only casts some spells fills Ramp and lowers the land count (`creditFor`, `lands.ts:35`). La Forge, Perceptive Engineer (mana only for artifact spells) is labeled "Ramp" in Blue Graveyard, which plays three artifact spells (Microscope, Etherium Sculptor, Torrential Gearhulk); it entered in a swap. The 40-card deck from the same pool runs four restricted ramp copies.
6. **The drift penalty rewards role counts** (`builder.ts:526-537`). A copy that brings a role or type into real decks' middle half earns 2 points (about 7 strength points), whichever card it is. The theme cap counts dual cards on both sides, so riders use up room real self-mill would need.
7. **Every hand rule counts in every deck** (`synergyPairs`, `builder.ts:485`): `ramp-finishers` and `haste-finishers` pairs score inside a Graveyard deck (`docs/todo.md:33`).
8. **Learned pairs from other plans** (`pairGain`, `select.ts:85`). Poppet Stitcher, an instant-and-sorcery payoff, has the highest pair gain in Blue Graveyard (0.20 points) and is labeled "Filler" (`our-builder-out-pairs-graveyard.txt`), but nothing shows the pairs put it there: with learned pairs off in memory it stays, and its strength of 5.44 (1.63 objective points) can carry a swap alone. Turning pairs off does drop Microscope, Ephara's Dispersal, and Sentinel of the Pearl Trident, so the term moves cards, though in a first-improvement swap search one change reshuffles many picks (`our-builder-verify-ablate.ts`, `our-builder-verify-out-ablate.txt`).
9. **Combos without a plan** (`select.ts:220-251`). 339 kept two-card combos make only mana, such as There and Back Again with Clockspinning (Core bracket). At 100 such a pair is worth 3 points (10 strength points) with nothing required to spend the mana (`our-builder-out-misc.txt`).
10. **Strength and popularity over plan.** Up to 2 strength points come from Commander popularity (`strength.ts:60-63`), and above the theme target swaps trade theme cards for strong off-plan ones. Two copies of Anafenza, Unyielding Lineage are labeled "Filler" in White Lifegain; both entered in swaps.
11. **Filler** (`fillAny`, `builder.ts:861`, and swaps, labeled by `describeWhy`, `builder.ts:706`): Loki, Lord of Misrule and Sentinel of the Pearl Trident (strength 2.84) in Blue Graveyard, both from swaps; Distress and Manor Guardian in the black one.
12. **Curve first** (`pickBest`, `builder.ts:661-665`; `fillCurve`, `builder.ts:837`). A card in a short bucket beats a better card in a full one in every pass, and the curve pass takes any card. Here the curve picks happened to be removal or theme cards; the eval baseline averages 6.7 filler copies at 60, curve picks that fill no role included (`docs/todo.md:36`).
13. **First improvement in id order** (`localSearch`, `builder.ts:1022-1030`): the swap keeps the first candidate by card id that helps at all, not the best one.
14. **Color minimums** (`fillColorMinimums`, `builder.ts:917`) add cards for their color alone.

### Ideas worth keeping

- **Determinism by construction,** and a `why` on every card naming the pass that picked it. That made this review possible.
- **Judgment in config, logic in code,** with matchers that are easy to refine, as the Voltron cleanup shows (`docs/guides/archetypes.md:65`).
- **Lift over random bulk by color class** keeps a color's natural themes from reading as a plan, and the calibrated `bias` keeps the style mix close to real decks.
- **The scan as a gate** with plain "needs N more" notes, requested styles that fail clearly, and the swap guard that holds a theme's floor.
- **Template constraints and the mana model:** role minimums and targets, type mix, curve per style, copy caps that bend only when the pool runs out, the land formula refit to the chosen spells, and hypergeometric color sources.
- **Incremental scoring:** running tallies make swaps cheap. A redesign can keep them and trim the fixed work per call in `objectiveOf` (every hand rule, role, and profile term).
- **Commander anchoring:** identity, named tribes, EDHREC plan shares, and role credit for the commander.
- **Optional learned data** with a working fallback, and pool-only packs for workers (`poolPack`).
