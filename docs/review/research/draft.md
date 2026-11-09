## Cube and draft tools, their bots, and draft-bot research

Draft tools have a pick model (which card to take) and a deck-build model (which 23 spells and 17 lands to play from the pool). Bulk Brew needs only the second, so each entry keeps them apart. Claims were checked today against each project's code, docs, or paper, then corrected after a separate fact check (`draft.verify.md`).

### CubeCobra's bot deck builder

**What and where.** CubeCobra is an open-source cube manager, maintained under the dekkerglen GitHub account ([repository](https://github.com/dekkerglen/CubeCobra)). The bot build is in `packages/utils/src/drafting/deckbuildCore.ts`, with lands in `landTrim.ts` and `manabaseBasics.ts`. Its models are trained in [CubeCobraML](https://github.com/dekkerglen/CubeCobraML).

**Pick model.** A shared encoder maps a set of cards (a multi-hot over about 37,000 cards) to 128 numbers. A draft head scores cards given the picks so far. Its README reports about 50% top-one agreement with humans.

**Plan.** None. After the build, the deck gets the label of the nearest cluster center by cosine similarity (`archetype.ts`). The clusters come from Leiden clustering of deck embeddings (`leidenCluster.py`), and the labels are read from `annotations.json`. The repository has both a manual labeling page and a script that labels clusters with a two-pass LLM; which one made the shipped labels is not shown. The label describes the deck; it does not steer it.

**Cards.**

- **Seed.** A deck-build head, trained to predict which pool cards made a human's main deck, rates the pool. The top 10 go in.
- **Fill.** The rest of the pool is treated as a "pack". The draft head adds one card at a time, conditioned on the deck so far, re-scoring every remaining card after each add.
- **Duplicates.** Each extra copy is discounted by 0.9 per copy already in.

A card's value depends on what is already in the deck, but only through what humans drafted together. Nothing names setup or payoff, or checks that a payoff has setup behind it.

**Mana, curve, interaction.** Caps of 23 spells and 17 lands. A land trim screens nonbasic lands by rule first. It keeps typed lands with two or more on-color basic types and fetch lands that can find something, and force-cuts typed lands and fetch lands that do not fit the colors. Only the remaining suspect lands go to the draft head, which the code comment frames as "would I rather have the best basic here?". Basics go one at a time to the color with the most colored nonland cards per current source. Each nonland card counts once for each color in its color identity, so pips are not counted. There is no curve target and no removal or creature count.

**Data.** CubeCobra's public exports of cubes, picks and decks. The deck head's input is main deck plus sideboard; its target is the main deck. Training drops cubes outside 180 to 1,080 cards because "multi-thousand-card 'all sets' dumps and tiny stubs destabilize the encoder". Bulk Brew has no cube data, but its 17Lands files hold the same kind of main-plus-sideboard pairs (see Ideas).

**Speed, determinism, license.** One deck-head pass, then one draft-head pass per added pool card, at most 30 per deck (40 minus the 10 seeds). The fill adds only pool cards and stops when the deck is full or no pool card fits under the caps; basics are added afterward by rule, so a typical cube pool needs fewer passes. The land trim then asks the draft head about its suspect lands in batches. The browser runs it on TensorFlow.js. Code comments put the encoder and the deck-build decoder at about 69 MB of weights each and the whole model bundle at about 70 MB, and TF.js itself adds about 3 MB, so a phone would download at least 70 MB. Another comment says iOS needs the WASM backend because WebGL runs out of memory. Greedy argmax, so deterministic for a fixed model. CubeCobra is Apache-2.0; CubeCobraML has no license file, so its weights and code cannot be reused.

**Bulk on a phone.** Poor: a new runtime dependency, a download of 70 MB or more, unlicensed weights, and training that excludes pools of thousands of cards. The algorithm's shape carries over well: seed, conditional fill, land trim, basics by demand.

### CubeArtisan: mtgml and mtgdraftbots

**What and where.** [mtgml](https://github.com/CubeArtisan/mtgml) is a multitask Magic model in TensorFlow. [mtgdraftbots](https://github.com/ruler501/mtgdraftbots) is a C++/WebAssembly bot whose license notice names CubeArtisan. Both are AGPL-3.0.

**Pick model.** mtgml sums learned sub-scores: card rating ("how good the card is in a vacuum"), pool synergy, seen-pack synergy, and a combined transformer score. mtgdraftbots mixes six "oracles": rating, pick synergy (embedding closeness to the picks), internal synergy, external synergy (how the picks go with cards seen in those colors), colors, and openness. The oracle formulas are hand-written, but each oracle's weight by draft position is learned and loaded from a parameter file, and so are the card ratings and embeddings.

**Plan.** Neither picks a plan.

**Cards.** mtgml's `DeckBuilder` runs a transformer over the pool so cards can "interact with each other", then gives each card a probability of making the deck. Training penalizes total probability far from 40 and a land count far from the human's. Synergy is implicit. mtgml's own server code (`server/deck_builder.py`) turns the scores into a list simply: it pads the pool with up to 17 copies of each basic, scores every card, sorts, and takes the top 40 as the main deck. Lands, basics included, are chosen by that same score, with no separate mana step.

**Mana, curve, interaction.** mtgdraftbots has this family's most concrete mana idea, though it serves picks; mtgdraftbots builds no deck. It makes eight candidate 17-land setups. Each starts from a seeded random draw of 17 lands and climbs by shifting lands from one kind to another while a castability score improves: the castability of the cards picked so far, plus 3 times the mean for cards seen, plus 5 times the best card in the current pack. The climb maximizes castability, not card value. Each new setup must differ from the earlier ones by at least 12 in its color sums, which forces eight different setups. Every card's rating and synergy is then multiplied by its chance to be cast under each setup, and each option is scored under its best setup. The chance comes from a precomputed table keyed by mana value, colored pips and matching land counts. Whether the table means "castable on curve" is unverified. Neither project handles interaction.

**Data.** Human picks and decks from cube sites and 17Lands; Bulk Brew has the 17Lands part.

**Speed, determinism, license.** A transformer over a 3,000-card pool means about nine million attention pairs per layer, too heavy for a phone. mtgdraftbots' per-card lookups are fast, but the table behind them is large: 32 x 32 x 32 land counts x 4 x 7 pip counts x 9 mana values, about 8.3 million numbers (about 33 MB as 32-bit floats; the generated source file is 74 MB). The land search always draws 17 lands, so it assumes a 40-card deck. The random generator is a fixed linear congruential one, seeded from a `seed` the caller passes; the README says it is "best not to use a constant" and that results are "reproducible if this is known". AGPL-3.0, so ideas only.

**Bulk on a phone.** mtgml: no. Castability-weighted scoring: yes, as an idea, but with a much smaller table or a direct calculation sized for 60 and 100 cards, not the 33 MB 40-card table.

### Ryan Saxe's DeckBuilder (17Lands data)

**What and where.** A draft model and a separate deck builder by Ryan Saxe ([repository](https://github.com/RyanSaxe/mtg), Apache-2.0). The README reports reaching Mythic on Arena (self-reported). No trained models ship.

**Pick model.** A transformer over pack and picks, trained on 17Lands data.

**Plan.** None in the builder. An earlier pick bot ([Draftsim article](https://draftsim.com/ryan-saxe-bot-model/), 2020) clustered drafts into archetypes with K-means.

**Cards.** The `DeckBuilder` docstring treats the build as denoising: the pool is a deck plus noise (the sideboard). Given the remaining pool and a partial deck, the model rates cards to add; at inference it adds the top card and repeats until it says stop. Saxe chose this loop because one-shot outputs handle multiple copies badly. Synergy is implicit.

**Mana, curve, interaction.** Separate heads predict the number of nonbasic cards (at least 22) and the basics, from the finished spells. An optional term pulls average mana value toward the human's. No interaction logic.

**Data.** 17Lands game and draft data. Training examples are weighted (`importance_weighting`) by player rank and win-rate bucket, by recency, by the game result (`won` clipped to between 0.5 and 1, so a lost game counts half), and for picks by pick position. His deck-build data generator reads the 17Lands `deck` and `sideboard` column families with these weights. Bulk Brew's `data/corpus/decks.json` has 54,000 17Lands decks with `wins` and `games` but no sideboards. The raw game files in `data/corpus/raw/` do carry `sideboard_<card>` columns next to `deck_<card>` and `won`, in all 18 files (checked today by reading each file's header).

**Speed, determinism, license.** One forward pass per added card; deterministic given the model. Apache-2.0. The card list is fixed to one set.

**Bulk on a phone.** As written, no. Its training recipe (pool in, deck out, weighted by wins) suits developer-side learning.

### Rating-and-template autobuilders: Draftsim and MTGA_Draft_17Lands

**What and where.** [Draftsim](https://draftsim.com/methodology/) is a web draft simulator. Draftsim also offers [Arena Tutor](https://draftsim.com/arenatutor), an Arena companion that "recommends the best build" from a drafted pool and promises "the power of Draftsim bots"; whether its builder matches the methodology page's autobuild is unverified. [MTGA_Draft_17Lands](https://github.com/bstaple1/MTGA_Draft_17Lands) by bstaple1 (MIT) is an Arena overlay that suggests decks (`src/card_logic.py`). It is archived (last push 23 August 2025), so it is a snapshot, not active work.

**Pick model.** Draftsim: a 0 to 5 expert rating plus a color bonus, up to +0.9 while speculating and +2.0 once committed to two colors.

**Plan.** Draftsim: two colors. MTGA_Draft_17Lands tries each leading color combination against three shapes (Mid, Aggro, Control) and keeps the best-rated deck per combination.

**Cards.** Draftsim's autobuild takes "the most powerful 23 cards in two colors and 17 lands", and its FAQ says it "doesn't explicitly take synergy into account for its picks and deck building." MTGA_Draft_17Lands fills each shape in order:

- creatures by rating up to a minimum per mana value (Aggro: 2 one-drops, 5 two-drops, 3 three-drops);
- more creatures while average mana value stays under the shape's cap;
- the best remaining spells, then nonbasic lands above a rating threshold.

Ratings are 17Lands "games in hand" win rates within the color pair. It splashes the best off color among cards rated 2.33 standard deviations above the mean. Decks score summed win rates minus penalties for too few creatures or too high a curve. No synergy.

**Mana, curve, interaction.** MTGA_Draft_17Lands splits basics by how many nonland cards have each color in their mana cost, minus on-color nonbasic lands. Each card counts at most once per color, so pips are not counted. Curve from shape minimums; interaction not counted.

**Data.** Per-card 17Lands "games in hand" win rates per color pair. Bulk Brew does not store this table, but the 18 raw game files in `data/corpus/raw/` have `opening_hand_`, `drawn_`, `won`, `main_colors` and `splash_colors` columns, so it could be computed for those sets without a download. Most bulk cards come from sets 17Lands never covered, so coverage is still the limit.

**Speed, determinism, license.** Fast sorts, deterministic. Draftsim's site is under its own copyright with no license; MTGA_Draft_17Lands is MIT.

**Bulk on a phone.** Fast, but a baseline, not a fix: pure rating plus shape, close to Bulk Brew's plain Aggro, Midrange and Control.

### Published draft-bot research

**What and where.**

- Ward et al., "AI solutions for drafting in Magic: the Gathering" ([arXiv 2009.00655](https://arxiv.org/abs/2009.00655), IEEE CoG 2021), with Draftsim.
- Bertram, Fürnkranz and Müller on contextual preference ranking ([2105.11864](https://arxiv.org/abs/2105.11864), [2107.04438](https://arxiv.org/abs/2107.04438), [2407.05879](https://arxiv.org/abs/2407.05879)).
- Rigaux and Kashima, "Predicting Drafted Deck Strength" ([2607.04782](https://arxiv.org/abs/2607.04782), July 2026).
- Arena drafting in Legends of Code and Magic, a card game made for AI research, which Ward et al. cite: Kowalski and Miernik, "Evolutionary Approach to Collectible Card Game Arena Deckbuilding using Active Genes" ([2001.01326](https://arxiv.org/abs/2001.01326), IEEE CEC 2020), and Vieira, Tavares and Chaimowicz, "Drafting in Collectible Card Games via Reinforcement Learning" ([SBGames 2021 extended proceedings](https://sol.sbc.org.br/index.php/sbgames_estendido/article/view/19743)).

**Pick model.** Ward et al. compare five bots on Core Set 2019, by top-one agreement with humans: RandomBot 22.15%, RaredraftBot 30.53%, the hand-tuned DraftsimBot 44.54%, the co-occurrence BayesBot 43.35%, and a neural net, NNetBot, best at 48.67%. The hand-tuned heuristic came within about 4 points of the neural net and beat the co-occurrence bot. They measure pair synergy as S_ij = P_ij / (P_i P_j), how much more often two cards end up together than chance. BayesBot picks with a related conditional matrix, which the authors note "also indirectly encodes the rating of each card".

Bertram et al. embed the current picks as an anchor and rank candidates by distance to it, framing drafting as "set addition" that seeks "cards that complement the deck". On the same data they report 83.78% top-one. Their 2024 paper builds cards from features (numbers, types, a sentence embedding of the text, images, 17Lands statistics). Its best model, which uses all of these, predicts 55% of human choices on a set held out of training (BRO). That model leans on 17Lands statistics for the held-out set, which the paper says are "impossible to use for entirely new sets". In the paper's own comparison, trained on one set (NEO), numbers, types and text alone reached 33.6% on unseen sets, against 23.8% for random vectors and 42.1% for 16 17Lands statistics alone.

Rigaux and Kashima predict outcomes rather than picks: a deck's win rate from its draft. Their simple baseline averages 17Lands "in deck" win rates of the best 23 picks. They estimate a noise ceiling of 0.23 rank correlation, so single-deck win rates are a weak label.

The Legends of Code and Magic papers judge the drafted deck by how it plays. Kowalski and Miernik evolve a card-choice policy whose fitness "can only be estimated with simulation-based approaches", that is, by playing games with the resulting deck. Vieira, Tavares and Chaimowicz train draft agents with deep reinforcement learning and report that they beat the game's best draft agents "by building very different decks". The game is much simpler than Magic, and Ward et al. note that Kowalski and Miernik assume card choices do not depend on earlier choices, which fits Magic poorly. Still, this is the one line here that grades decks by play rather than by agreement with humans, which bears on a goldfish judge.

**Plan, cards, mana.** None of the Magic papers builds a deck. Ward et al. call "deck-building algorithms for MtG" out of scope and list "algorithms for building decks from completed drafts" as future work. None of the Magic papers treats mana, curve or interaction. The Legends of Code and Magic papers do build decks, but by drafting in a much simpler game.

**Data.** Draftsim's M19 drafts (CC BY 4.0) and 17Lands data. Bulk Brew has 17Lands decks, not pick logs. The Legends of Code and Magic work uses games played by bots, not human data.

**Speed, determinism, license.** 2009.00655 and 2001.01326 use arXiv's non-exclusive license; the four Bertram and Rigaux papers are CC BY 4.0; the SBGames paper states no license. The Ward code ([khakhalin/MTG](https://github.com/khakhalin/MTG)) and the Rigaux code ([akulen/MtGDraftEncoder](https://github.com/akulen/MtGDraftEncoder)) have no license file. Bertram et al.'s models are not cheap to update during a build. Candidate cards' vectors can be computed ahead of time, but the deck side needs a network pass after every add. The 2021 model passes the count vector of picks through several fully connected layers. The 2024 model encodes the deck with a convolutional network over a 45-slot array, because a summed deck vector "makes it impossible to reconstruct individual cards".

**Bulk on a phone.** The Magic papers predict picks (Rigaux and Kashima: outcomes) for one set at a time. Only the 2024 feature model targets unseen cards, the bulk case, and without 17Lands statistics its accuracy on unseen sets is modest (33.6% against 23.8% for random vectors).

### Ideas worth borrowing

1. **Re-score candidates against the deck so far after each add** (CubeCobra `deckbuildCore.ts`; Saxe's DeckBuilder loop). Score a payoff by the real setup already chosen, and setup by the payoffs already chosen, recomputing after each card. The builder then stops adding payoffs once setup runs out.
2. **Seed a small core, then grow conditionally** (CubeCobra: 10 seed cards, then fill). For a themed plan the seed is the best few payoffs plus the setup they need most, as in the planned "seed and grow" prototype.
3. **Learn "kept in the main deck when in the pool" from 17Lands deck and sideboard columns, weighted by wins** (Saxe's denoising builder and its `won` weighting; CubeCobraML's deck head). The raw files already on disk hold `sideboard_` columns, so no new download is needed. The plain rate measures card value, not role: a strong payoff with a mill rider gets kept, and a weak real looter gets sideboarded. It says something about setup only when compared within decks of the same colors that play the theme, against cards of similar strength. Coverage is limited to draft-era cards.
4. **Weight each card's plan value by its chance to be cast, with a seeded land search** (mtgdraftbots). A heavy-pip payoff on a thin splash then counts for less toward setup and payoff targets. mtgdraftbots reads the chance from a 33 MB table built for 17 lands in 40 cards, so a phone build at 60 and 100 cards needs a much smaller table or a direct calculation per card. Its land search maximizes castability alone, so Bulk Brew would borrow the weighting, not the search's objective.
5. **Pair synergy as lift over chance, separated from card strength** (Ward et al., S_ij = P_ij / (P_i P_j)). Lift between one theme's setup and payoff cards in real decks would show which pairs feed each other. Their note that the pick-time version also encodes card rating argues for comparing each pair against both cards' base rates.
6. **Judge builders by inclusion rate of hand-picked card families, with no named-card rules** (CubeCobra's `packages/docs/deckbuild-eval-harness.md` proposal). Pick families from oracle text, such as "repeatable self-mill and looters" and "one-time surveil riders", and measure how often each builder plays them when the pool has them. This checks the Graveyard failure directly, without the builder's own tags.
7. **Represent cards by features, not ids** (Bertram et al. 2024). A learned scorer for bulk must rate old cards with no 17Lands record, and only features such as oracle text, types, costs and tags can do that. The paper's evidence for this case is weak: trained on one set, a features-only model picked 33.6% right on unseen sets, against 23.8% for random vectors, and its best unseen-card results lean on 17Lands statistics that old bulk cards lack. Treat it as a direction to test, not a proven fix. A scorer of this kind also needs a deck encoder at run time, not only per-card vectors.
8. **Judge decks by play, not only by agreement with humans** (Kowalski and Miernik; Vieira, Tavares and Chaimowicz). Their draft policies are scored by games played with the finished deck. A goldfish judge is the same idea in a cheaper form, and it stays independent of the builder's tags.

### Sources

All read on 2026-11-08.

- CubeCobra repository: `deckbuildCore.ts`, `landTrim.ts`, `manabaseBasics.ts`, `mlScoring.ts`, `archetype.ts`, `serverutils/archetype.ts`, `serverutils/draftbots.ts`, `client/src/utils/draftBot.ts`, `recommenderService` README and `ml.ts`, `packages/docs/deckbuild-eval-harness.md`, and in `packages/archetypeAnnotater`: `src/scripts/labelClusters.py`, `src/scripts/leidenCluster.py`, `src/AnnotatePage.tsx`. https://github.com/dekkerglen/CubeCobra (Apache-2.0)
- CubeCobraML repository: README, `ccml/model.py`, `ccml/data.py`, `backend/lib/deckbuild.py`. https://github.com/dekkerglen/CubeCobraML (no license file)
- mtgml: `models/deck_builder.py`, `models/draftbots.py`, `server/deck_builder.py`, `constants.py`. https://github.com/CubeArtisan/mtgml (AGPL-3.0)
- mtgdraftbots: `oracles.hpp`, `mtgdraftbots.hpp`, `details/generate_probs.hpp`, `details/constants.hpp`, `cardcost.hpp`, `types.hpp`, `emscripten/README.md`, and the size of `generated/prob_table.hpp` from the GitHub API. https://github.com/ruler501/mtgdraftbots (AGPL-3.0)
- Ryan Saxe, mtg repository: README, `mtg/ml/models.py`, `mtg/ml/utils.py`, `mtg/ml/generator.py`, `mtg/scripts/README.md`. https://github.com/RyanSaxe/mtg (Apache-2.0)
- Ryan Saxe, Draftsim article on his bot model. https://draftsim.com/ryan-saxe-bot-model/ (site copyright, no license)
- Draftsim methodology page. https://draftsim.com/methodology/ (site copyright, no license)
- Draftsim FAQ. https://draftsim.com/faq.php (site copyright, no license)
- Draftsim Arena Tutor page. https://draftsim.com/arenatutor (site copyright, no license)
- MTGA_Draft_17Lands: `src/card_logic.py`, `src/configuration.py`, `src/constants.py`; archive status from the GitHub API. https://github.com/bstaple1/MTGA_Draft_17Lands (MIT, archived)
- Ward, Brooks, Troha, Mills, Khakhalin, "AI solutions for drafting in Magic: the Gathering". https://arxiv.org/abs/2009.00655 (arXiv non-exclusive license; data CC BY 4.0; code at https://github.com/khakhalin/MTG has no license file)
- Bertram, Fürnkranz, Müller, "Predicting Human Card Selection in Magic: The Gathering with Contextual Preference Ranking". https://arxiv.org/abs/2105.11864 (CC BY 4.0)
- Bertram, Fürnkranz, Müller, "A Comparison of Contextual and Non-Contextual Preference Ranking for Set Addition Problems". https://arxiv.org/abs/2107.04438 (CC BY 4.0)
- Bertram, Fürnkranz, Müller, "Learning With Generalised Card Representations for Magic: The Gathering". https://arxiv.org/abs/2407.05879 (CC BY 4.0)
- Rigaux, Kashima, "Predicting Drafted Deck Strength for Magic: the Gathering". https://arxiv.org/abs/2607.04782 (CC BY 4.0; code at https://github.com/akulen/MtGDraftEncoder has no license file)
- Kowalski, Miernik, "Evolutionary Approach to Collectible Card Game Arena Deckbuilding using Active Genes", IEEE CEC 2020 (abstract only). https://arxiv.org/abs/2001.01326 (arXiv non-exclusive license)
- Vieira, Tavares, Chaimowicz, "Drafting in Collectible Card Games via Reinforcement Learning", SBGames 2021 extended proceedings (abstract only). https://sol.sbc.org.br/index.php/sbgames_estendido/article/view/19743 (no license stated)
- Bulk Brew's 17Lands game data headers, all 18 `data/corpus/raw/game_data_public.*.PremierDraft.csv.gz` files, and `data/corpus/decks.json` (17Lands data CC BY 4.0, per `ATTRIBUTION.md`)
