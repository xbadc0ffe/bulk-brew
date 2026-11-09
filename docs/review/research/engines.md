## Open-source Magic engines and tools

I read the deck-building code of Forge, XMage, and Ryan Saxe's DeckBuilder on 2026-11-08, and looked briefly at three smaller projects. Only one feature in this family checks that a payoff has its setup: Forge's hand-written card hints. They cover part of the card pool, and they share our false-friend problem: a removal spell with surveil 2 is tagged as graveyard setup, and the keep-or-drop check can count a card toward itself. Only sparkroot sets minimums for removal and other roles in the deck it builds.

### Forge

**What it is.** A free Magic rules engine and game by the Forge team, [github.com/Card-Forge/forge](https://github.com/Card-Forge/forge). I read its deck generation, Limited, draft AI, mana-base repair, and topic-model code, its genetic algorithm, sample card scripts, and the wiki page "Card scripting API". It has four deck builders, plus an offline genetic algorithm in its test code.

**How it picks a plan.**

- _Color generators_ (DeckGenerator2Color and siblings) use the user's colors or random ones. No theme.
- _Theme files_: 68 hand-written `.thm` files. Each lists groups of named cards with a percentage and a copy cap. "Elves G" has a group of lords, a group of mana elves, and so on.
- _Card-gen decks_ come from an offline topic model (LDA) over folders of real tournament decklists per format. Each topic is named from common words in deck names. A deck starts from a random key card or a random topic. Commander uses a count matrix of how often each card appears in decks with each commander. Only the trained `.dat` files ship.
- _Limited_: for sealed, Forge ranks the pool and takes the two colors most common in the top third. It adds a third color only when the deck is short of playables.
- _Genetic algorithm_ (offline, in test sources, used to make Planar Conquest decks): it evolves card-gen decks. A mutation builds a new card-gen deck around one of a parent's first eight cards, and a child builds one around a card from each parent. Fitness is the deck's place in a Swiss tournament of simulated AI-versus-AI matches, three games per match. It is the only approach in this family whose fitness is games played, not ratings or co-occurrence, which bears on the optional goldfish check in Phase 3.

**How it picks cards.**

- Color generators take random cards in each cost band, with no synergy.
- Card-gen decks take a topic's cards in probability order, keep each copy with 90% chance, and drop up to four cards at random. A comment says the drop chance grows down the list, but integer division makes it a flat 14%. The Commander path drops at a flat 24%, and the random-topic path never drops its first five cards. Hard-coded name checks protect engines from the drops: names containing "Urza" or "Yawgmoth" and "Living End" in the 60-card paths, and "Urza" or "Wastes" in Commander, commented as avoiding broken Tron decks. Random dropout broke engines, and the fix was a name list. Forge's own comment on that list says it should become deck or card hints.
- The Limited builder scores each card as its pick-order rank (0 to 100) plus a synergy term from three hand-written card fields:
  - `DeckHas`: what a card provides, such as Graveyard, Token, Counters, Discard, or Mill.
  - `DeckHints`: what a card wants.
  - `DeckNeeds`: what a card cannot work without.

  The bonus goes to the _provider_. A card gains 3 for each other pool card whose ability, type, or keyword hint it meets (10 for a name, 1 for a color). A card with unmet `DeckNeeds` loses, once for each kind of need, up to that kind's weight (3 for an ability, type, or keyword, 10 for a name, 1 for a color), scaled by how far it falls below a threshold: 5 providers for abilities, 8 for types and keywords, 2 for names, 10 for colors. After the build, a card marked `RemoveDeck:Random` stays only if at least one card matching its needs or hints is in the deck list. The wiki advises tagging about 50 cards for a new archetype and "balancing the Has/Needs ratio".

  This is setup and payoff accounting, but with four limits, and the first is the failure this review exists to fix:
  - Tags are yes or no, and they count one-time riders. `DeckHas` records no amount or frequency. Price of Fame (destroy target creature, surveil 2) and Consider (surveil 1, draw a card) both carry `DeckHas:Ability$Surveil|Graveyard`, and about half of the scripts that surveil carry a graveyard `DeckHas` (131 of 266 by grep). Real enablers can go untagged: Mulch (reveal four, lands to hand, the rest to the graveyard) has no hint, and Faithless Looting has only `AI:RemoveDeck:All`. So Forge's gate would count a removal spell with surveil as graveyard setup, just as our `mill-self` tag does, and the owner's failed Graveyard deck would pass it.
  - The gate can pass with no partner at all. It matches a card's needs and hints against the deck list, and that list includes the card itself. Azami, Lady of Scrolls is a Wizard marked `AI:RemoveDeck:Random` with `DeckHints:Type$Wizard`, so it meets its own hint and always stays. A card that both provides and wants a resource passes the same way, which is our "dual cards count twice" flaw. The ranking step does leave the card itself out; only the gate does not.
  - The main ranking scores hints against the whole on-color pool, not the deck being built. Two paths do score against a deck: the third-color step ranks candidates against the deck list so far, and the draft AI ranks each pack against its picks so far, both through `rankCardsInPack`. That is a hand-tagged form of Idea 8. (A SealedDeckBuilder comment notes a related problem in color choice: the first ranking counts hints from cards whose colors may not make the deck.)
  - Coverage is partial. Of 34,465 card scripts in a sparse clone today, 7,578 have `DeckHas`, 4,153 `DeckHints`, and 1,222 `DeckNeeds`. Stitched Drake has no hint, though its cost exiles a creature card from your graveyard (our `cards.json`). Armored Skaab mills four but has no `DeckHas`.

**Mana, curve, interaction.**

- Color generators use fixed shares: for two colors, 42% lands, 34% creatures, 24% other. They find dual lands by matching "Add {X} or {Y}" in oracle text. When splitting basics, an else-if chain counts each card toward only its first color in WUBRG order.
- Card-gen decks set lands as (16 + 3.14 × average mana value) × size / 60, citing a ChannelFireball article on land drops that I have not read. The base drops to 15 when the filtered-hands option is on. The Commander builder inherits the same formula. They re-roll the caps per mana cost at random each build.
- After the 60-card card-gen builds, a castability repair (`DeckManaBase`) runs. If at least five copies of spells need a color the lands cannot make, it adds four basics of that color in place of the most plentiful basics. Otherwise it moves those spells to the sideboard and refills with more of what the deck can cast. It counts a fetch land only for the basic land types the deck really has.
- The Limited builder starts from 22 spells and 18 lands. When it reaches 22 spells with an average mana value below 4, it adds a 23rd spell and drops to 17 lands, so 23 and 17 is the common result. It caps creatures by cost (2, 6, 7, 4, 3, 2 for costs 1 to 6+). It adds two basics of each needed color first, then splits the rest by colored mana symbols.
- No Forge builder counts removal or blockers.

**Data, and whether we have it.**

- _Pick orders_: 194 per-set rank files holding 28,948 card names. A rank is the card's position divided by its set's size, so ranks from different sets sit on different scales. A printing whose set has no file, or that is missing from its file, scores −100 ("unpickable"), with no fallback by name. By name, the files hold 87% to 97% of the distinct cards in each public pool in `eval/pools`. In `white-bulk.txt`, the only one with set codes, 662 of 734 copies (90%) have a rank for their exact set. The owner's pools were not measured. (Command: `node data/review/scratch/engines-fix/rank-coverage.mjs data/review/scratch/engines-verify/forge-rnk eval/pools`; output in `data/review/scratch/engines-fix/rank-coverage.txt`.) We have no pick orders.
- _Real decklists for topics_: we have 54,000 17Lands draft decks and 1,441 precons in `data/corpus/decks.json`, and EDHREC pages for Commander.
- _Hand hints_: these live in a GPL repository, so we must not copy them. Our Scryfall Tagger tags cover part of the same ground: Merfolk Looter has `discard-outlet` and `repeatable-loot`, and Armored Skaab has `mill-self`.

**Speed, determinism, license.**

- Every builder is a greedy loop. The genetic algorithm plays simulated matches, so it is far too slow for a phone.
- CardRanker compares every pool card with every other one. That is fine for a sealed pool but heavy for 3,000 cards.
- Builds are not deterministic. `MyRandom` wraps `SecureRandom` by default, and some paths call `Collections.shuffle` without Forge's random source.
- License: GPL-3.0 (root `LICENSE` and file headers, "version 3 ... or any later version").

**Fit for bulk on a phone.** The Limited builder has the right shape (pool in, deck out), and its needs gate is the right idea. Three parts fail on bulk:

- Ranks are per set and per printing. Most cards in our public pools have one by name, but a printing without its own set's rank drops to −100, and ranks from different sets do not compare, so a mixed bulk pool is ranked on mixed scales.
- The gate passes on one partner card, or on the card itself.
- The tags are yes or no and count one-time riders, so the gate would pass the owner's failed Graveyard deck.

The card-gen paths draw from the whole card database, not a pool.

### XMage

**What it is.** A Magic engine, client, and server, [github.com/magefree/mage](https://github.com/magefree/mage). I read the client deck generator, `LimitedDeckBuilder`, `RateCard`, `DeckBuildUtils`, `ComputerPlayer.construct`, the ratings index, and the 17Lands rating script.

**Plan.** The client generator uses chosen or random colors. The builder that bots use, and that runs when a player's construction time runs out (`LimitedDeckBuilder`), takes the color pair whose cards have the highest summed rating across the pool. A comment says this choice is closer to human picks on 17Lands than taking the colors of the first best cards. There are no themes.

**Cards.**

- The client generator draws random cards per cost band.
- `LimitedDeckBuilder` sorts the pool by rating and takes the top 23 non-lands per 40 cards, scaled to deck size. It then repairs the deck, swapping the worst card in a class for the best fitting card left, while any of these hold (all scaled):
  - more than 3 cards cost 6 or more;
  - fewer than 15 creatures;
  - fewer than 4 cards cost 2 or less.
- There is no synergy term. A card with a file rating uses that rating as is. A `RateCard` comment gives the reason: the file rating already holds the card's value from type, removal, and mana cost, and adding those bonuses on top made bot picks worse when checked against 17Lands human picks. The comment is about those bonuses, not about synergy.

**Mana, curve, interaction.**

- Lands are 17 of 40. Basics follow colored mana symbols. A hybrid symbol counts half to each deck color, and sources from the deck's nonbasic lands are subtracted.
- The deck does not count interaction. Removal shows up only in the rating of cards with no file rating (see Data).

**Data.**

- There are 47 set rating files. 33 come from 17Lands: z(games-in-hand win rate) + z(take rate in the first four picks), for cards with 500 or more games. The other 14, for older sets such as DOM, GRN, and XLN, come from Draftaholics Anonymous, which the ratings index calls "outdated and manually created".
- A card missing from its own set's file takes a rating by name from another file. Only a card with no file rating at all gets the heuristic, which is half of: a rarity default (40, 60, 75, 90), plus twice a type weight (5 to 15, such as 10 for a creature), minus 2 per colored mana symbol, plus 40 for an instant, sorcery, or enchantment whose effects the engine classes as removal (destroy or exile a permanent, damage that can hit a non-player, or fight). So removal adds 20 on the final scale.
- The heuristic matters for bulk. By name, the 47 files rate only 28% to 45% of the distinct cards in ten of the eleven public pools in `eval/pools`, and 64% in `white-bulk.txt`. (Command: `node data/review/scratch/engines-fix/mage-coverage.mjs data/review/scratch/engines-verify/mage/ratings eval/pools`; output in `data/review/scratch/engines-fix/mage-coverage.txt`.)
- We have wins and games for 54,000 17Lands decks, but no pick or in-hand data.

**Speed, determinism, license.**

- A build is one sort and a few swaps.
- Card choice is deterministic given the ratings. Only basic land printings are random.
- License: MIT (`LICENSE.txt`). The script header says 17Lands data is CC BY 4.0.

**Fit for bulk.** Rate-then-repair is cheap, deterministic, and easy to extend. On its own it builds "good stuff" decks with no plan. Most bulk cards have no file rating, so they are ranked mainly by rarity and card type, with a bonus for removal.

### Ryan Saxe's DeckBuilder

**What it is.** A draft AI and a deck builder AI trained on 17Lands data, [github.com/RyanSaxe/mtg](https://github.com/RyanSaxe/mtg). The last push was on 2024-03-30, and no trained models ship. The README says the author reached Mythic on Arena using "this algorithm" (the author's claim, not checked). Its TODO list still includes joining the deck builder and the drafter into one end-to-end pipeline, so the claim cannot be pinned on the deck builder.

**Plan.** Learned, with one model per set.

**Cards.** A denoising autoencoder treats the deck as the pool with the sideboard removed. It builds step by step: given the remaining pool and the deck so far, it adds the top-scoring card and repeats until a predicted count of non-basic cards is reached. Since each pick sees the deck so far, it can learn that a payoff wants its setup, but only implicitly and within one set.

**Mana, curve, interaction.** A second head predicts basics from the finished deck, with a floor of 22 non-basic cards. Interaction is implicit. Curve has one explicit term: the training loss penalizes the gap between the average mana value of the predicted deck and the human's deck (`cmc_lambda`, default 0.01). The author's comments say this term needs improvement and that the model still plays too few two-drops.

**Data.** It trains on per-set 17Lands Bo1 game data with deck and sideboard columns. Examples can be weighted by player rank, win-rate bucket, and recency. We have main decks but no sideboards.

**Speed, determinism, license.** Inference is one small-network pass per card added, so it is fast. It needs TensorFlow, and we may not add dependencies. Inference is deterministic. License: Apache-2.0.

**Fit for bulk.** Low as it stands: its card list is fixed to one set, and it needs pools. The transferable idea is to score the next card given the pool and the deck so far.

### Also checked

- **Magarena** ([github.com/magarena/magarena](https://github.com/magarena/magarena), GPL-3.0, last push 2023-04-24). The random generator lists commons four times and mythics once. Nine of its eleven themed generators add a fixed core of named cards, then random filler. Most generators keep every non-creature but only creatures that pass one test: a creature type (Elf, Faerie, Human, Knight, Vampire, Zombie), being an artifact, or, for "Token Madness", the word "token" in the card's text. The other two, Tribal Mono and Ability Mono, have no named core: they pick a random creature type or keyword ability and keep only creatures that have it. This is plain type and keyword matching, with no count of how many cards feed the plan. Decks are random by design; I did not check its mana or curve rules.
- **sparkroot** ([github.com/gurleyryan/sparkroot](https://github.com/gurleyryan/sparkroot), BUSL-1.1, non-production use only until it becomes Apache-2.0 on 2028-07-15). It builds a Commander deck from a user's uploaded collection and a chosen commander, the closest task to ours in this family.
  - _Plan_: the theme is the commander's creature type when more than two pool cards share it. Otherwise it is the first of the commander's keywords, oracle word pairs, or oracle words (three letters or more) that appears in some pool card's type line or keywords.
  - _Cards_: it fills roles to a minimum and maximum each, such as removal 6 to 9, sweepers 2 to 4, draw 5 to 9, ramp 5 to 10, and win conditions 1 to 3. Within a role it takes theme matches first, then roles the commander supports, then the rest by Commander popularity rank (`edhrec_rank`). Roles come from words such as destroy, exile, or draw in a card's keyword list and type line, not its rules text. In our Scryfall data no card has any of those words as a keyword, so unless sparkroot's database adds its own keywords or categories (not checked), these minimums may rarely fill. Theme matching is plain word matching, so it falls into the same keyword trap, and nothing checks setup against payoff.
  - _Mana and curve_: 33 to 38 lands, plus curve targets per mana value keyed on the commander's mana value (credited to a TCGPlayer article) and a mana rock count.
  - _Data_: Scryfall card data and a popularity rank, which our `cards.json` also carries, held in a Supabase database with a salt list, so it runs on a server.
  - _Speed and determinism_: a few greedy passes, not timed. I found no random calls, but theme choice walks Python sets, whose order can change between runs (not tested).
  - _Fit for bulk_: the collection-in shape and the role ranges suit us; its role and theme detection do not.
- **Wagic** ([github.com/WagicProject/wagic](https://github.com/WagicProject/wagic)). Its LICENSE file says the source code is under the BSD License; graphics and other resources are licensed separately. Its Random game modes generate decks, but not from a pool. The one-color and two-color modes take 9 + 9 basics, one uncommon and one rare land, 12 creatures, and two each of sorcery, enchantment, instant, and artifact, all drawn at random within the colors from the whole card database. There are also three-color, five-color, random-set Limited, and random Commander modes. There is no synergy, curve, or interaction check, and decks are random by design.

### Ideas worth borrowing

1. **Provides and wants, with a real gate** (Forge `DeckHas`, `DeckNeeds`, `RemoveDeck:Random`). Tag cards with the theme resources they provide and want, in our own config. Seed providers from Tagger tags such as `discard-outlet`, `repeatable-loot`, and `mill-self`, and wanters from tags such as `graveyard-fuel` (Stitched Drake has it, since it spends the graveyard). Unlike Forge, record how much and how often a card provides, from its oracle text, since `mill-self` also covers surveil 1 on a removal spell. Keep a payoff only when the deck, not the pool, holds enough providers for it at that deck size, counting other cards only, so a card never meets its own need.
2. **Raise the provider, starve the needy** (Forge CardRanker). A setup card gains value for each payoff it would feed, and a payoff loses value in proportion to its shortfall below a threshold. Keep a count per resource so the cost stays linear in pool size.
3. **Track the has-to-needs ratio** (Forge wiki). Report providers per payoff for each themed deck, counting each card once, and fail decks below a floor set for each theme.
4. **Rate, then repair** (XMage `LimitedDeckBuilder`, Forge `DeckManaBase`). Fill greedily, then run deterministic replace-the-worst passes for hard rules. Alongside XMage's rules for expensive cards, creatures, and cheap cards, and Forge's castability repair (give a needed color lands, or swap out the spells that need it), add rules for enough setup per payoff, a minimum of removal or blockers, and a way to win.
5. **Colors by summed quality** (XMage). For a theme, score each color pair by the quality of both its providers and its payoffs, so the chosen colors can feed the payoffs.
6. **Lands from average mana value, with reserved sources** (Forge). Use (16 + 3.14 × average mana value) × size / 60 as a cross-check on `lands.ts` for 60, 40, and 20 cards. It scales linearly, so it overshoots at 100 cards: Forge applies it to Commander too, which at average mana value 3 gives 41 lands out of 99, against sparkroot's 33 to 38. Forge lowers the base to 15 when hands are filtered, and the article it cites is unread. Reserve sources for each color before the proportional split.
7. **Packages from real decks, offline** (Forge topics and commander matrix). In the learned-data build, mine co-occurrence topics from our 17Lands decks and precons to suggest which setup goes with which payoff. Never drop cards at random, and protect engine cards by role, not by name.
8. **Next card given the deck so far** (Saxe; Forge's draft AI does a hand-tagged version). Fit pair weights on real corpus decks with some cards hidden and random bulk added, so the signal rewards completing an engine. This is untested.
9. **Games as an independent judge** (Forge's genetic algorithm). Simulated games score a deck without sharing any of the builder's definitions. They are far too slow for the phone, but the same idea suits the optional goldfish check in Phase 3.

### Sources

All were read on 2026-11-08.

- Forge, [github.com/Card-Forge/forge](https://github.com/Card-Forge/forge) (`master`), GPL-3.0 (root `LICENSE`, file headers): `LimitedDeckBuilder.java`, `CardRanker.java`, `SealedDeckBuilder.java`, `LimitedPlayerAI.java`, `ReadDraftRankings.java`, `DeckgenUtil.java`, `CardThemedDeckBuilder.java`, `CardThemedCommanderDeckBuilder.java`, `DeckManaBase.java`, `PlanarConquestGeneraterGA.java`, `AbstractGeneticAlgorithm.java`, and card scripts including `p/price_of_fame.txt`, `c/consider.txt`, `m/mulch.txt`, `f/faithless_looting.txt`, and `a/azami_lady_of_scrolls.txt`.
- Forge wiki, [Card scripting API](https://github.com/Card-Forge/forge/wiki/Card-scripting-API). No separate license stated.
- XMage, [github.com/magefree/mage](https://github.com/magefree/mage) (`master`), MIT (`LICENSE.txt`), including `RateCard.java`, `Mage/src/main/resources/ratings/setsWithRatings.csv`, and [Utils/gen-draft-rates-17Lands.py](https://github.com/magefree/mage/blob/master/Utils/gen-draft-rates-17Lands.py). That script states that 17Lands data is CC BY 4.0.
- Ryan Saxe, [github.com/RyanSaxe/mtg](https://github.com/RyanSaxe/mtg), Apache-2.0: `README.md`, `mtg/ml/models.py`, `generator.py`, `utils.py`, `mtg/obj/expansion.py`.
- Magarena, [github.com/magarena/magarena](https://github.com/magarena/magarena), GPL-3.0: `RandomDeckGenerator.java`, the eleven `*_DeckGenerator.java` files in `src/magic/generator/`, `deckgenerators.txt`.
- sparkroot, [github.com/gurleyryan/sparkroot](https://github.com/gurleyryan/sparkroot), BUSL-1.1: `backend/deckgen.py`, `README.md`, `LICENSE`.
- Wagic, [github.com/WagicProject/wagic](https://github.com/WagicProject/wagic), BSD for source code: `LICENSE`, `projects/mtg/src/Rules.cpp`, `projects/mtg/src/GameStateDuel.cpp`.
- Bulk Brew `data/packs/cards.json` and `data/corpus/decks.json`, for card text, tags, keywords, and corpus counts. Card facts were printed with `npm run review:cards`.
- Coverage scripts and outputs: `data/review/scratch/engines-fix/rank-coverage.mjs` and `mage-coverage.mjs`, with `.txt` outputs beside them. Hint and surveil counts are from grep over the Forge sparse clone at commit `f2d88b2` in `data/review/scratch/engines/forge-sparse/`.
