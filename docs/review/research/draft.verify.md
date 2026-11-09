# Fact check: Cube and draft tools, draft bots, and draft-bot research

Checked on 2026-11-08 against each project's current code (raw GitHub files and `gh api`), the arXiv PDFs, the Draftsim pages, and Bulk Brew's local data. Scratch copies are in `data/review/scratch/draft-verify/` (gitignored).

## Verdict

**needs-fixes.** Most facts hold up: every license, the CubeCobra build loop, the CubeCobraML numbers and quote, the mtgml DeckBuilder losses, Saxe's DeckBuilder docstring, the Draftsim quotes, the MTGA_Draft_17Lands shapes, and the paper figures and quotes. The local data claims are true for all 18 raw files, not just BLB. But two statements are wrong, and three of the "Ideas" and phone-fit judgments rest on readings the sources do not support. Several items the section flags as unverified can in fact be settled from the code. One research line that scores draft decks by simulated play is missing.

## Issues

### Wrong

- **Claim:** Bertram et al.'s anchor-and-distance model is cheap at run time: "one stored vector per card, a summed deck vector, one distance per candidate."
  - **Problem:** The deck vector is not a sum. In the 2021 paper the picked set (a count vector) goes through several fully connected layers, so each new deck state needs a forward pass of the network. The 2024 paper says plainly that a summed deck encoding loses information. It uses a 45-slot array and a separate convolutional deck encoder instead.
  - **Evidence:** arXiv 2105.11864, Section IV-B: the anchor uses "an encoding in which each dimension encodes the number of already chosen cards", which is processed "through multiple fully-connected network layers". arXiv 2407.05879, Section IV-C: "with feature-based card encodings, a sum-based encoding of a deck makes it impossible to reconstruct individual cards. To prevent this, we represent a deck of cards as a two-dimensional array of size 45 x n".
  - **Severity:** wrong

- **Claim:** MTGA_Draft_17Lands sets "Basics in proportion to colored pips".
  - **Problem:** `card_colors()` loops over the five colors once, so each color counts at most 1 per card. `mana_base()` therefore splits basics by how many nonland cards have each color in their cost, minus on-color nonbasic lands. Pips are never counted.
  - **Evidence:** https://github.com/bstaple1/MTGA_Draft_17Lands `src/card_logic.py`, `card_colors` and `mana_base`. `src/constants.py` `CARD_COLORS` lists each color once.
  - **Severity:** wrong

### Unsupported

- **Claim:** CubeCobra labels a built deck with "the nearest hand-annotated cluster center".
  - **Problem:** The code shows the nearest-center lookup (cosine similarity over 128-dim embeddings). Nothing shows the labels are hand-made. The `archetypeAnnotater` package has a manual labeling page, but it also has `labelClusters.py`, which labels clusters "using a two-pass LLM approach via AWS Bedrock" from each cluster's top 40 cards. The clusters come from `leidenCluster.py`. Which method produced the shipped `annotations.json` is not shown.
  - **Evidence:** https://github.com/dekkerglen/CubeCobra `packages/archetypeAnnotater/src/scripts/labelClusters.py` (docstring, model id set to a Claude model on Bedrock), `packages/archetypeAnnotater/src/AnnotatePage.tsx` (manual label editor), `packages/server/src/serverutils/archetype.ts` (loads `static/annotations.json`).
  - **Severity:** unsupported

### Misleading

- **Claim:** Idea 7 and the research entry's phone verdict: the 2024 feature model "predicts 55% of human choices on cards never seen in training", and a scorer "built from oracle text, types, costs and tags" can therefore rate old bulk cards with no 17Lands record.
  - **Problem:** The 55% comes from a Features + Meta + Image model. Meta means 17Lands usage statistics for the held-out set (BRO), and the paper itself says such statistics do not exist for new sets. In the paper's own comparison (trained on NEO only), text and type features alone reached 33.6% on unseen sets, against 23.8% for random vectors. Meta statistics alone reached 42.1%. The authors say hand-engineered features did "only slightly better" than images. So the evidence says text features alone carry over weakly, which is the opposite of what the idea leans on for bulk.
  - **Evidence:** arXiv 2407.05879, Table II (unseen sets: Random 23.79%, Meta 42.14%, Features 33.57%, Features + Meta + Image 1024 42.87%). Section IV-B4: "card statistics are only available when a set has seen sufficient server play and is thus impossible to use for entirely new sets". Section VI-B: the 55.44% BRO figure uses the Features + Meta + Image model.
  - **Severity:** misleading

- **Claim:** mtgdraftbots' lookups are cheap, and Idea 4 says "A table keyed by mana value, pips and sources makes it one lookup per card". The summary calls this the most portable mana idea for phone builds.
  - **Problem:** The table is huge. Its size is 32 x 32 x 32 (land counts) x 4 x 7 (pips) x 9 (mana values) = 8,257,536 floats, about 33 MB as 32-bit floats. The generated source file is 74 MB. It is also built around 17-land, 40-card setups: `get_random_lands` always draws 17 lands. A phone build at 60 or 100 cards would need its own, smaller table or an on-the-fly calculation. The idea may still be good, but "cheap" leaves out the cost that matters most on a phone.
  - **Evidence:** https://github.com/ruler501/mtgdraftbots `include/mtgdraftbots/details/constants.hpp` (`PROB_TABLE_SIZE` dimensions). `gh api` reports `include/mtgdraftbots/generated/prob_table.hpp` at 74,317,881 bytes. `generate_probs.hpp` (`get_random_lands` loops 17 times).
  - **Severity:** misleading

- **Claim:** Rating-and-template section, Data: "Per-card 17Lands win rates per color pair. Bulk Brew lacks this table."
  - **Problem:** Bulk Brew does not store the table, but every raw game file on disk has `opening_hand_`, `drawn_`, `won`, `main_colors` and `splash_colors` columns. Games-in-hand win rates per color pair can be computed for those 18 sets without a download. This is the same kind of point the section makes about `sideboard_` columns, so the two passages disagree.
  - **Evidence:** `data/corpus/raw/game_data_public.BLB.PremierDraft.csv.gz` header (checked: `main_colors`, `won`, and 252 each of `opening_hand_`, `drawn_`, `deck_`, `sideboard_`). The same column families appear in all 18 files.
  - **Severity:** misleading

- **Claim:** mtgdraftbots uses hand-built "oracles": rating, pick synergy, internal synergy, colors, openness.
  - **Problem:** There are six oracles. External Synergy (how picks go with cards seen in those colors) is left out. Only the oracle formulas are hand-written. Each oracle's weight is learned and looked up by pack and pick position from a loaded parameter file, and card ratings and embeddings are learned too.
  - **Evidence:** https://github.com/ruler501/mtgdraftbots `include/mtgdraftbots/oracles.hpp` (`ORACLES` array of six; `calculate_weight` reads `weights_map`). `mtgdraftbots.hpp` `initialize_draftbots` (loads weights, ratings, embeddings).
  - **Severity:** misleading

- **Claim:** CubeCobra runs "one draft-head pass per added card (about 30 per deck)".
  - **Problem:** Thirty is the ceiling (40 minus 10 seeds). The loop adds only pool cards and stops once spells reach 23 and no nonbasic lands remain. Basics are added later by heuristic. A typical 45-card cube pool with few nonbasics needs fewer passes, plus one batched pass for the land trim.
  - **Evidence:** https://github.com/dekkerglen/CubeCobra `packages/utils/src/drafting/deckbuildCore.ts`, Phase 2 loop and candidate filter. Basics come from `calculateBasics` after the trim.
  - **Severity:** misleading (minor)

- **Claim:** "a code comment puts the encoder weights at about 69 MB".
  - **Problem:** The quote is accurate, but the deck-build decoder has the same "~69 MB weight shards" comment. Another comment calls the whole model bundle "~70 MB", and TF.js adds about 3 MB. The phone download is at least 70 MB, not just the encoder.
  - **Evidence:** CubeCobra `packages/client/src/utils/draftBot.ts`, comments on the encoder and `deck_build_decoder` loads, the CDN note ("the bundle is ~70 MB"), and the dynamic TF.js import ("~3 MB").
  - **Severity:** misleading (minor)

- **Claim:** CubeCobra's land trim asks the draft head: "is the best basic better than this land?"
  - **Problem:** This is a paraphrase shown in quotation marks. The code comment reads "would I rather have the best basic here?". The trim also asks only about lands its rules mark as suspect. Must-keep and non-suspect lands are never asked.
  - **Evidence:** CubeCobra `packages/utils/src/drafting/landTrim.ts`, header comment and `classifySuspects`.
  - **Severity:** misleading (minor)

- **Claim:** Summary bullet: CubeCobra "adds basics by pip demand".
  - **Problem:** The section body is right ("colored nonland cards per current source"), but the summary is not. Demand counts each nonland card's color identity once, and pips are not counted.
  - **Evidence:** CubeCobra `packages/utils/src/drafting/manabaseBasics.ts`, `sourceDemandRatio`.
  - **Severity:** misleading (minor)

- **Claim:** Idea 3: if drafters often sideboard a rider card, "that is tag-independent evidence it is not real setup".
  - **Problem:** Main-deck rate mixes card strength, color fit and role. A strong payoff with a mill rider will be kept, and a weak real looter will be sideboarded. Without conditioning on the deck's colors and archetype, the rate does not separate setup from payoff. It is evidence about card value, not about role.
  - **Evidence:** This is reasoning about the 17Lands data shape (one row per game with `deck_` and `sideboard_` counts and no archetype label), not a source claim. Saxe's and CubeCobraML's deck heads learn inclusion given the whole pool, not role.
  - **Severity:** misleading (minor)

### Missing

- **Claim:** Summary: "The academic work is about picks only". Section: "None of these papers builds a deck... Nobody treats mana, curve or interaction."
  - **Problem:** The section leaves out the arena-drafting research on Legends of Code and Magic, which Ward et al. themselves cite. Kowalski and Miernik evolve a card-choice policy whose fitness "can only be estimated with simulation-based approaches", that is, by playing games with the resulting deck. Vieira, Tavares and Chaimowicz treat arena drafting as a decision process solved with reinforcement learning. This is the one research line that judges draft decks by how they play rather than by agreement with humans. That bears directly on the review's goldfish option and its "judge independently" lesson. Within the section, Rigaux and Kashima also predict outcomes, not picks.
  - **Evidence:** https://arxiv.org/abs/2001.01326 ("Evolutionary Approach to Collectible Card Game Arena Deckbuilding using Active Genes", IEEE CEC 2020, arXiv non-exclusive license). "Drafting in Collectible Card Games via Reinforcement Learning", SBGames 2020 (https://sol.sbc.org.br/index.php/sbgames_estendido/article/view/19743). Ward et al. 2009.00655, Related Work, mentions "evolutionary algorithms towards arena drafting in a CCG named Legends of Code and Magic".
  - **Severity:** missing

- **Claim:** Flagged unverified: "How CubeArtisan turns mtgml DeckBuilder inclusion probabilities into a final 40-card list."
  - **Problem:** mtgml's own server code answers this. It adds up to 17 copies of each basic to the pool, scores every card, sorts by score, and takes the top 40 as the main deck. So lands, basics included, are chosen by the same model score, with no separate mana step.
  - **Evidence:** https://github.com/CubeArtisan/mtgml `mtgml/server/deck_builder.py`, `get_deck_scores` (returns `sorted_scores[:40]` as main). `mtgml/constants.py` (`MAX_COPIES = 17`).
  - **Severity:** missing

- **Claim:** Flagged unverified: where mtgdraftbots' random seed comes from.
  - **Problem:** It is documented. The caller passes `seed` in the drafter state. The README says it is "best not to use a constant" and that results are "reproducible if this is known". The generator is a fixed linear congruential one seeded from that value.
  - **Evidence:** https://github.com/ruler501/mtgdraftbots `emscripten/README.md` (drafterState example), `include/mtgdraftbots/types.hpp` (`unsigned int seed`), `details/generate_probs.hpp` (`Rand rng{drafter_state.seed}`).
  - **Severity:** missing (minor)

- **Claim:** mtgdraftbots builds eight 17-land setups by hill climbing, "shifting lands from one kind to another while the score improves".
  - **Problem:** Two details that matter if Bulk Brew borrows this are left out. First, the climb maximizes castability, not card value: castable picks, plus 3 times the mean for seen cards, plus 5 times the best card in the pack. Second, each new setup must differ from earlier ones by at least 12 in its color sums, which forces eight different setups. Each option is then scored under its best setup. It is a pick-time device, and mtgdraftbots builds no deck.
  - **Evidence:** mtgdraftbots `details/generate_probs.hpp` (`evaluate_option` score formula, `min_diff >= 12` rule). `mtgdraftbots.hpp` `calculate_pick_from_options` (best over `NUM_LAND_COMBS`).
  - **Severity:** missing (minor)

- **Claim:** Flagged unverified: the exact accuracies of DraftsimBot and BayesBot in Ward et al.
  - **Problem:** The plain-text extraction gives the table cleanly: RandomBot 22.15%, RaredraftBot 30.53%, DraftsimBot 44.54%, BayesBot 43.35%, NNetBot 48.67%. Bertram et al.'s Table I repeats these numbers. The useful context is that the hand-tuned DraftsimBot came within about 4 points of the neural net and beat the co-occurrence bot.
  - **Evidence:** arXiv 2009.00655 v3, Table II (`pdftotext` without layout). arXiv 2105.11864, Table I.
  - **Severity:** missing (minor)

- **Claim:** Saxe's training examples are "weighted by player rank, win-rate bucket and recency (`importance_weighting`)".
  - **Problem:** The function also multiplies by the game result (`won` clipped to 0.5 to 1) and, for picks, by pick position. The `won` factor is what Idea 3's "weighted by wins" depends on, so it should be stated. Saxe's deck data generator reads the 17Lands `deck` and `sideboard` column families with these weights, which supports Idea 3.
  - **Evidence:** https://github.com/RyanSaxe/mtg `mtg/ml/utils.py` `importance_weighting`. `mtg/ml/generator.py` (`card_col_prefixes=["deck", "sideboard"]`, `importance_weighting(data)`).
  - **Severity:** missing (minor)

- **Claim:** The rating-and-template entry covers Draftsim and MTGA_Draft_17Lands.
  - **Problem:** It does not say that MTGA_Draft_17Lands is archived, with no development since 2025. It also skips Draftsim's Arena Tutor, the Arena companion that pops up a recommended build of your pool and is described as using the same engine. That bears on the flagged question of whether Draftsim's autobuild still matches its methodology page. Newer third-party 40-card builders on 17Lands data exist too (for example Draftgoblin), unchecked here.
  - **Evidence:** `gh api repos/bstaple1/MTGA_Draft_17Lands` (`archived: true`, last push 2025-08-23). https://draftsim.com/arenatutor and https://mtg.wiki/page/Arena_Tutor (recommended build from the pool). https://github.com/andreagrandi/draftgoblin (search result only, not read).
  - **Severity:** missing (minor)

## Checked and confirmed

- **Licenses** (via `gh api`): CubeCobra Apache-2.0; CubeCobraML none; mtgml AGPL-3.0; mtgdraftbots AGPL-3.0, with a notice naming Cube Artisan; RyanSaxe/mtg Apache-2.0; MTGA_Draft_17Lands MIT; khakhalin/MTG and akulen/MtGDraftEncoder none.
- **arXiv licenses:** 2009.00655 is non-exclusive; 2105.11864, 2107.04438, 2407.05879 and 2607.04782 are CC BY 4.0.
- **Ward et al. data:** the M19 data is CC BY 4.0, as the paper states.
- **CubeCobra `deckbuildCore.ts`:**
  - The build model seeds 10 cards.
  - Each extra copy's rating is multiplied by 0.9 per copy already in.
  - The draft model re-ranks the whole remaining pool against the deck so far after every add.
  - Defaults are 23 spells and 17 lands (`draftbots.ts`, `draftBot.ts`).
  - The land trim keeps typed lands with two or more on-color subtypes, force-cuts off-color lands, and asks the model about suspect lands.
  - Basics are added one at a time by colored nonland cards per source.
  - There is no curve or interaction logic.
- **CubeCobra `draftBot.ts`:** the encoder comment says about 69 MB, and the iOS WASM switch exists because WebGL "hits the shared memory budget".
- **CubeCobra `deckbuild-eval-harness.md`:** it is a proposal, with inclusion rates by benchmark family and explicitly no named-card runtime rules.
- **CubeCobraML README and `data.py`:**
  - The encoder outputs 128 dimensions over a 37,238-card multi-hot.
  - The cube filter keeps 180 to 1,080 cards, and the destabilize quote matches.
  - `val_top1` is about 0.50.
  - Deck-head input is the main deck plus sideboard; the target is the main deck.
  - CubeCobra exports are public on S3 and updated every three months.
- **mtgml `deck_builder.py`:** a transformer (BERT) runs over the pool. The help text says "Allow the card embeddings to interact with each other". Penalties apply for total probability away from 40 and for land count away from the human's (the code compares with the true deck, though the help text says 17).
- **mtgml `draftbots.py`:** the sub-scores are rating, pool synergy, seen synergy and combined, mixed by a learned weighted sum.
- **mtgdraftbots:** there are 8 land setups (`NUM_LAND_COMBS`). Card values are multiplied by castability under each setup. The probability table is keyed by mana value, required pips and land counts.
- **Saxe `models.py`:**
  - The docstring frames building as denoising: the sideboard is noise.
  - Inference is an iterative argmax until the model says stop, chosen because one-shot outputs handle multiple copies badly.
  - The nonbasic count is relu plus 22; a basics head works from the built deck; there is an optional curve term.
  - The card list is fixed per set.
  - The README says no models ship, reports Mythic (self-reported), and lists a TODO to integrate drafter and builder.
- **Draftsim:** the methodology page has the 0 to 5 rating, +0 to +0.9 while speculating, +2.0 once committed, and the "most powerful 23 cards in two colors and 17 lands" sentence. It is undated, under site copyright, with no license. The FAQ sentence on synergy is exact.
- **Draftsim article on Saxe's bot (2020):** K-means with fifteen clusters, as the archetype labels.
- **MTGA_Draft_17Lands:**
  - Shapes are Mid, Aggro and Control. Aggro's distribution is 2 one-drops, 5 two-drops, 3 three-drops.
  - The splash threshold is mean plus 2.33 standard deviations.
  - Nonbasic lands are kept above mean minus 0.33 standard deviations.
  - The deck score is summed games-in-hand win rate, minus 50 per missing creature and 500 for too high a creature curve.
  - The best deck per color combination is kept.
- **Ward et al.:**
  - The paper defines S_ij = P_ij / (P_i P_j).
  - The BayesBot quote "also indirectly encodes the rating of each card" is exact.
  - "deck-building algorithms for MtG are outside the scope" (Limitations) and "algorithms for building decks from completed drafts" (Future work) are exact.
  - NNetBot scores 48.67% on M19.
  - IEEE CoG 2021 is confirmed by the citation in 2407.05879.
- **Bertram et al.:** 83.78% MTTA (mean testing top-one accuracy) on the same M19 data. The papers use "set addition" and "complement the deck". The 2024 paper uses numeric and categorical features, a sentence-transformer text embedding, images and 17Lands statistics, and reports 55% on unseen cards (but see the issue above).
- **Rigaux and Kashima:** the HEURISTIC baseline averages 17Lands "in deck" win rate of the best 23 picks. The noise ceiling is about 0.23. The paper was submitted 6 July 2026, accepted at CoG 2026.
- **Local data:**
  - `data/corpus/decks.json` has 54,000 `draft` decks with `wins` and `games`, and no sideboard field.
  - All 18 raw game files have matching `deck_` and `sideboard_` column counts and a `won` column.
  - `ATTRIBUTION.md` states 17Lands data is CC BY 4.0.
- **No copied code:** the section quotes only short phrases and one formula; no code blocks or multi-line snippets from other projects.
- **Format:** every entry covers plan, cards and setup-payoff fit, mana and curve and interaction, data and whether we have it, speed and determinism and license, and fit for bulk on a phone. The research entry merges plan, cards and mana into one paragraph, which is acceptable.
