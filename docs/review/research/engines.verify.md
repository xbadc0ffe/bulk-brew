## Fact check: Open-source Magic engines (engines.md)

Checked on 2026-11-08 against fresh downloads of each project's `master` or `main` branch. Source copies and scripts are in `data/review/scratch/engines-verify/` (gitignored). Card-script counts use the Forge sparse clone at commit `f2d88b2` in `data/review/scratch/engines/forge-sparse/`, with `git status` clean, so its files match the commit.

### Verdict

**Needs fixes.** The core facts hold up. Every count, formula, and license I could check reproduces. That includes the 34,465 scripts and the 7,578 / 4,153 / 1,222 hint counts, the 14% dropout, the CardRanker weights, and XMage's top-23 repair rules. But the summary makes one family-wide claim that the section's own sparkroot entry contradicts. One Magarena detail is wrong. The section also misses the point that matters most for this review: Forge's hand tags share our false-friend problem.

### Issues

- **Claim (summary):** "No builder in this family counts removal or blockers in the deck."
  - **Problem:** sparkroot counts removal in the deck. It fills categories with a minimum and maximum each: removal 6 to 9, sweepers 2 to 4, draw 5 to 9, ramp 5 to 10, win conditions 1 to 3. The section's own sparkroot bullet lists the removal range. The per-engine statements for Forge and XMage are correct; the family-wide one is not.
  - **Evidence:** [sparkroot deckgen.py](https://github.com/gurleyryan/sparkroot/blob/main/backend/deckgen.py). `CATEGORY_TARGETS` sits near line 197. The "Strict category fill" loop near line 1035 walks each category and adds cards until its minimum is met. Cards are sorted by theme match, then commander synergy, then `edhrec_rank`.
  - **Severity:** wrong

- **Claim:** "Eleven themed generators each add a fixed core of named cards, then random filler that passes a text test." (Magarena)
  - **Problem:** Two of the eleven, Tribal Mono and Ability Mono, have no named core. They pick a random tribe or keyword ability and keep only creatures with that subtype or ability. Their filter is a type or ability check, not a text test.
  - **Evidence:** [Tribal_Mono_DeckGenerator.java](https://github.com/magarena/magarena/blob/master/src/magic/generator/Tribal_Mono_DeckGenerator.java) and [Ability_Mono_DeckGenerator.java](https://github.com/magarena/magarena/blob/master/src/magic/generator/Ability_Mono_DeckGenerator.java). Neither overrides the method that adds required spells. Their accept test checks `hasSubType(tribe)` or `hasAbility(ability)`. `deckgenerators.txt` lists all eleven.
  - **Severity:** wrong

- **Claim:** Forge's hints are "real setup and payoff accounting", and Idea 1 borrows them as "provides and wants, with a real gate".
  - **Problem:** The section lists three limits but misses a fourth, the one this review exists to fix. `DeckHas` is a yes-or-no tag with no amount or frequency, and the hand tags include one-time riders.
    - Price of Fame (destroy target creature, surveil 2) and Consider (surveil 1, draw) both carry `DeckHas:Ability$Surveil|Graveyard`.
    - 134 of the 248 scripts that surveil carry `DeckHas ... Graveyard`.
    - Real enablers go untagged. Mulch has no hint, and Faithless Looting has only `AI:RemoveDeck:All`.

    So Forge's gate would count a removal spell with surveil as graveyard setup, just as our `mill-self` tag does. The owner's failure would pass it.

  - **Evidence:** Forge scripts [p/price_of_fame.txt](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/cardsfolder/p/price_of_fame.txt), [c/consider.txt](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/cardsfolder/c/consider.txt), [m/mulch.txt](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/cardsfolder/m/mulch.txt), and [f/faithless_looting.txt](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/cardsfolder/f/faithless_looting.txt). Card text is from our `data/packs/cards.json`. Counts come from grep over the sparse clone: `DeckHas ... Graveyard` 1,070, `DeckHints ... Graveyard` 382, `DeckNeeds ... Graveyard` 6.
  - **Severity:** missing

- **Claim:** "One partner card passes the gate."
  - **Problem:** It can pass with no partner at all. The post-build check matches a card's needs and hints against the whole deck list, and that list includes the card itself. Azami, Lady of Scrolls is a Wizard marked `AI:RemoveDeck:Random` with `DeckHints:Type$Wizard`, so it meets its own hint and always stays. A card that both provides and wants a resource passes the same way. That is our "dual cards count twice" flaw. The ranking step does exclude the card itself (`getCardsExceptOne`); only the gate does not.
  - **Evidence:** [Forge LimitedDeckBuilder.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/gamemodes/limited/LimitedDeckBuilder.java), `checkRemRandomDeckCards` (about lines 593 to 639), which filters `deckList`. Script [a/azami_lady_of_scrolls.txt](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/cardsfolder/a/azami_lady_of_scrolls.txt).
  - **Severity:** misleading

- **Claim:** "The ranks are per printing, and most bulk has none." (Forge, fit for bulk)
  - **Problem:** This was never measured, and the data I could measure points the other way. Forge's 194 rank files hold 28,948 card names across 213 editions.
    - By name, 88.6% to 98.0% of the cards in every `eval/pools/*.txt` file appear in some Forge rank file.
    - On `white-bulk.txt`, the only public pool with set codes, 706 of 785 printings (89.9%) have a rank for that exact set.

    Two weaknesses are real but unstated. A rank is a position within its own set (rank divided by set size), so ranks from different sets do not compare. And any printing without a rank drops to -100, with no fallback by name.

  - **Evidence:** [ReadDraftRankings.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/gamemodes/limited/ReadDraftRankings.java) keys ranks by the edition column of each line and divides rank by set size. [CardRanker.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/gamemodes/limited/CardRanker.java) gives -100 when no rank is found. Measured with node scripts over `data/review/scratch/engines-verify/forge-rnk/` and `eval/pools/`. The owner's private pools were not used.
  - **Severity:** unsupported

- **Claim:** "There is no synergy at all. A `RateCard` comment says that bonuses added on top of file ratings made bot picks worse when checked against 17Lands human picks." The summary says "synergy bonuses".
  - **Problem:** The comment is about the type, mana-cost, and removal bonuses. It says a file rating already contains the card's value from type, removal, and mana cost, so it is used as is. It says nothing about synergy. Placing it right after "no synergy at all" suggests synergy was tried and failed. The summary's "synergy bonuses" is wrong.
  - **Evidence:** [XMage RateCard.java](https://github.com/magefree/mage/blob/master/Mage.Common/src/main/java/mage/cards/RateCard.java), about lines 118 to 121.
  - **Severity:** misleading

- **Claim:** "Old bulk commons fall back to flat rarity ratings." (XMage). The summary says "flat rarity defaults".
  - **Problem:** The fallback is not flat. An unrated card scores half of a sum: rarity default (40, 60, 75, 90), plus twice a type weight (6 to 15), minus 2 per colored symbol in the cost, plus 40 if it is removal. So the removal bonus is +20 on the final scale, not the "+40" the section states. The fallback also matters for most bulk: XMage's 47 files rate only 27.6% to 45.0% of cards by name in ten of the eleven public pools (78.3% in `white-bulk.txt`).
  - **Evidence:** RateCard.java, about lines 122 to 126 (heuristic times `HEURISTIC_TO_RATING_SCALE` 0.5) and 340 to 369 (rarity defaults). Coverage was measured over the 47 downloaded rating files in `data/review/scratch/engines-verify/mage/ratings/`.
  - **Severity:** misleading

- **Claim:** "Curve and interaction are implicit." (Saxe)
  - **Problem:** Interaction is implicit, but curve is not. The training loss includes an explicit term that penalizes the gap between the predicted deck's average mana value and the human deck's (`cmc_lambda`, default 0.01).
  - **Evidence:** [mtg/ml/models.py](https://github.com/RyanSaxe/mtg/blob/main/mtg/ml/models.py), `DeckBuilder.compile` and `DeckBuilder.loss`, about lines 546 to 630.
  - **Severity:** misleading

- **Claim:** "Hints are scored against the whole on-color pool, not the deck being built. A SealedDeckBuilder comment admits this."
  - **Problem:** The code fact is right: `buildDeck` ranks the on-color pool. But the SealedDeckBuilder comment says something else. It is about choosing colors: the first ranking counts deck hints from cards whose colors may not make the deck. Two paths do score against a deck. The third-color step scores candidates against the deck list being built, and the draft AI scores pack cards against the picks so far, both through `rankCardsInPack`. That is a hand-tagged version of Idea 8's "next card given the deck so far".
  - **Evidence:** [SealedDeckBuilder.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/gamemodes/limited/SealedDeckBuilder.java), lines 35 to 37. LimitedDeckBuilder.java `addThirdColorCards`, about line 500. [LimitedPlayerAI.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/gamemodes/limited/LimitedPlayerAI.java), line 54.
  - **Severity:** misleading

- **Claim:** "Wagic ... Its 'Random' menu picks existing decks, and I found no pool builder in the duel setup code ... GitHub reports no standard license, and I did not read its license file."
  - **Problem:** Both points can be settled.
    - Wagic does generate decks, in its Random game modes. "Random 1" and "Random 2" colors build 9 + 9 basics, one uncommon and one rare land, 12 creatures, and 2 each of sorcery, enchantment, instant, and artifact. All are drawn at random within the colors from the whole card database, so it is not a pool builder.
    - There are also Random 3 and 5 colors, random-set limited, and random Commander modes.
    - The LICENSE file says Wagic's source code is under the BSD License. Resources such as graphics are licensed separately.
  - **Evidence:** [projects/mtg/src/Rules.cpp](https://github.com/WagicProject/wagic/blob/master/projects/mtg/src/Rules.cpp): `loadPlayerRandom` (about line 280), `loadRandomSetLimited`, `loadPlayerRandomThree`, `loadPlayerRandomFive`, `loadPlayerRandomCommander`. [Wagic LICENSE](https://github.com/WagicProject/wagic/blob/master/LICENSE): "Wagic's source code is licensed under the BSD License".
  - **Severity:** missing

- **Claim:** Forge "has four builders".
  - **Problem:** It leaves out Forge's offline genetic algorithm. It evolves card-gen decks by mutation and scores each one by simulated AI-versus-AI matches (three games per match). It lives in test sources and is used to make Planar Conquest decks. It is the one engine approach whose fitness is games played, not ratings or co-occurrence, which bears on Phase 3's optional goldfish idea.
  - **Evidence:** [PlanarConquestGeneraterGA.java](https://github.com/Card-Forge/forge/blob/master/forge-gui-desktop/src/test/java/forge/planarconquestgenerate/PlanarConquestGeneraterGA.java) (`evaluateFitness`, `mutateObject`, `SimulateMatch`) and [AbstractGeneticAlgorithm.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/util/AbstractGeneticAlgorithm.java).
  - **Severity:** missing

- **Claim:** Card-gen mana: "They set lands as (16 + 3.14 x average mana value) ... They re-roll the caps per mana cost at random each build."
  - **Problem:** It leaves out the castability repair that runs after every card-gen build. If spells need a color the lands cannot make, it either adds basics of that color or swaps those spells out. Fetch lands with nothing to find are fixed the same way. This is a repair pass in the spirit of Idea 4 and worth crediting there.
  - **Evidence:** [DeckManaBase.java](https://github.com/Card-Forge/forge/blob/master/forge-core/src/main/java/forge/deck/DeckManaBase.java) (class comment), called from DeckgenUtil.java after `buildDeck` in both card-gen paths.
  - **Severity:** missing

- **Claim:** "drop up to four cards at random ... a flat 14% ... A hard-coded check protects names containing 'Urza' or 'Yawgmoth' and 'Living End'."
  - **Problem:** Correct for the 60-card card-gen path, but incomplete. The Commander card-gen path drops at a flat 24% (threshold 75), with its own name list ("Urza", "Wastes", commented "avoid breaking Tron decks"). The archetype path also never drops the first five cards. These details strengthen the section's point that dropout breaks decks.
  - **Evidence:** [DeckgenUtil.java](https://github.com/Card-Forge/forge/blob/master/forge-gui/src/main/java/forge/deck/DeckgenUtil.java), about lines 167, 265 (`i > 4`), and 718 to 719.
  - **Severity:** missing

- **Claim:** "A card with unmet `DeckNeeds` loses up to 3."
  - **Problem:** True only for ability, type, and keyword needs. A name need loses up to 10 (threshold 2, factor 10) and a color need up to 1 (threshold 10, factor 1). The penalty applies once per need type.
  - **Evidence:** CardRanker.java, lines 22 to 35 and 193 to 203.
  - **Severity:** misleading

- **Claim:** "The Limited builder targets 22 spells and 18 lands."
  - **Problem:** Those are the starting values. When the deck reaches 22 spells with an average mana value below 4, step 6 adds a 23rd spell and drops lands to 17. So 23 and 17 is the usual result.
  - **Evidence:** Forge LimitedDeckBuilder.java, lines 47 to 48 and 177 to 190.
  - **Severity:** misleading

- **Claim:** Idea 6: "Use (16 + 3.14 x average mana value) x size / 60 as a cross-check on `lands.ts`."
  - **Problem:** It needs a caveat for 100 cards. Scaled linearly, the formula gives (16 + 9.42) x 100 / 60 = 42.4 lands at average mana value 3.0, against sparkroot's 33 to 38. Forge lowers the base to 15 when its filtered-hands option is on. The ChannelFireball source is still unread; the article's formula is an image I could not render.
  - **Evidence:** Forge CardThemedDeckBuilder.java, about lines 216 to 223, and CardThemedCommanderDeckBuilder.java, which inherits it. sparkroot `CATEGORY_TARGETS`. The article PDF copy is in `data/review/scratch/engines-verify/karsten-lands.pdf` (formula image `Correct-land-formula.png`, not readable here).
  - **Severity:** missing

- **Claim:** Idea 1: "seeded from Tagger tags such as `discard-outlet`, `repeatable-loot`, and `graveyard-fuel`".
  - **Problem:** `graveyard-fuel` marks cards that spend the graveyard. Stitched Drake has `graveyard-fuel` and `graveyard-fuel-creature`. So it seeds the "wants" side, not "provides". The list mixes the two.
  - **Evidence:** `data/packs/cards.json`, Stitched Drake tags.
  - **Severity:** misleading

- **Claim:** "The README says it reached Mythic on Arena." (Saxe, in an entry about the deck builder)
  - **Problem:** The README credits "this algorithm" for Mythic. Its TODO still lists "Integrate deckbuilder and drafter in one end-to-end pipeline", so the claim cannot be pinned on the deck builder.
  - **Evidence:** [RyanSaxe/mtg README](https://github.com/RyanSaxe/mtg/blob/main/README.md), "achievements" and "TODO".
  - **Severity:** unsupported

- **Claim:** XMage: "Older ones are hand-made."
  - **Problem:** Close, but the source has a name. The ratings index says the older files come from Draftaholics Anonymous and are "outdated and manually created". That is 14 of the 47 files (A25, AER, AKH, DOM, GRN, HOU, IMA, KLD, M13, M19, RIX, RNA, UMA, XLN); the other 33 come from 17Lands.
  - **Evidence:** [setsWithRatings.csv](https://github.com/magefree/mage/blob/master/Mage/src/main/resources/ratings/setsWithRatings.csv) header, plus a grep for the generator mark in the 47 files.
  - **Severity:** misleading

- **Claim:** The "Also checked" entries (Magarena, sparkroot, Wagic).
  - **Problem:** They skip most of the required format: mana and curve, speed and determinism, data needs, and fit for bulk on a phone. As one-paragraph entries that is acceptable, but sparkroot in particular would gain from the full format. It counts roles in the deck, sorts filler by `edhrec_rank`, and builds from a user's collection, the closest match to our task in this family.
  - **Evidence:** docs/algo-review.md, Phase 1 format list. sparkroot README ("Upload your collection ... Generate and save legal Commander decks from your collection").
  - **Severity:** missing

### Confirmed

These claims match the source:

**Licenses and repo facts**

- Forge GPL-3.0. XMage MIT (`LICENSE.txt`). Saxe Apache-2.0. Magarena GPL-3.0 (`LICENSE.txt`).
- sparkroot BUSL-1.1, non-production use, Change Date 2028-07-15, Change License Apache 2.0. The license adds "or the fourth anniversary ... whichever comes first".
- Push dates for Saxe (2024-03-30) and Magarena (2023-04-24).

**Forge**

- Counts: 34,465 scripts; 7,578 `DeckHas`, 4,153 `DeckHints`, 1,222 `DeckNeeds`; 68 `.thm` files; 194 `.rnk` files.
- CardRanker: weights 3, 1, 3, 10, 3 and thresholds 5, 10, 8, 2, 8; the bonus goes to the card that meets another card's `DeckHints`; unranked cards score -100.
- Integer division makes the drop chance a flat 14%. The 90% copy keep. The Urza, Yawgmoth, and Living End list.
- The LDA topic naming from deck-name words, and the Commander count matrix.
- Color generator shares of 42%, 34%, and 24%; the dual-land regex; the WUBRG else-if chain.
- Limited curve caps 2, 6, 7, 4, 3, 2; two basics of each color first.
- `MyRandom` wraps `SecureRandom`, and CardThemedDeckBuilder calls `Collections.shuffle` without Forge's random source.
- No Forge builder counts removal.
- Wiki: "tag at least roughly 50 cards" and "Has/Needs ratio".
- Stitched Drake and Armored Skaab have no hints; Merfolk Looter's tags.

**XMage**

- Top 23 of 40, scaled; repair rules 3, 15, and 4; 17 lands.
- Hybrid symbols count half to each deck color; nonbasic sources are subtracted.
- `chooseDeckColors` takes the pair with the highest summed rating, with a comment checking it against 17Lands picks.
- Rating formula z(GIH WR) + z(take rate in picks 1 to 4) for cards with 500 or more games.
- The script header names CC BY 4.0. I could not load 17Lands' own page to confirm this at the source.
- 47 set files, and the comment "8622 cards ... spearman 0.46".

**Saxe**

- Denoising autoencoder over pool and partial deck, argmax loop until the predicted non-basic count, basics head with a floor of 22.
- Weighting by rank, win-rate bucket, and recency (it also weights by whether the game was won).
- No trained models ship.

**Others and our data**

- Magarena: commons listed four times, mythics once; Token Madness filter.
- sparkroot: theme taken from the commander's type line, keywords, and oracle words; ranges 33 to 38, 5 to 10, 6 to 9.
- Corpus: 54,000 draft decks with `wins` and `games` and no sideboards; 1,441 precons.

### Copying check

The section has no code blocks and no multi-line quotes. Quoted text is limited to field names, a regex fragment ("Add {X} or {Y}"), and short phrases. The land formula is restated as arithmetic. Nothing needs removing.

### Reproduce

- Licenses and push dates: `curl https://api.github.com/repos/<owner>/<repo>`, plus each repo's LICENSE file.
- Repo file counts: GitHub tree API with `recursive=1` (not truncated), saved in `data/review/scratch/engines-verify/*-tree.json`.
- Hint counts: `grep -rlE '^DeckHas:'` and similar in the Forge sparse clone's `forge-gui/res/cardsfolder`.
- Rank and rating coverage: node one-liners over `data/review/scratch/engines-verify/forge-rnk/`, `.../mage/ratings/`, and `eval/pools/*.txt`.
