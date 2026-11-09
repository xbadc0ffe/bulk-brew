## General methods for choosing a set of cards

Picking k cards to maximise card value plus pair value, under size, curve, and color limits, is a quadratic knapsack problem. In its graph form, where pair profits sit only on a graph's edges, setting every weight and profit to one gives the densest k-subgraph problem (Galli, Martello and Toth 2025, citing Pisinger et al. 2007). The survey adds, citing Fomeni and Letchford (2014), that even with unit weights it cannot be approximated within a constant factor in polynomial time. The result behind that, Khot (2006), rules out an approximation scheme (a PTAS), and only under a complexity assumption, so the survey's wording is stronger than its source. Either way the problem is hard, and every practical builder is a heuristic. The question is which one can say "setup must feed payoff". There are three ways:

- **Pairwise terms:** a bonus when setup and payoff share a deck. Cheap, but silent on how much setup a payoff needs.
- **Set-level resource terms:** score or constrain the balance between the resource the deck makes and what its payoffs need.
- **Sequential seeding:** choose payoffs first, then add setup in proportion.

**Our builder today** fills by passes, then runs a first-improvement single-swap hill climb: for each chosen card in id order it tries every pool spell and keeps the first swap that raises the objective, for at most 3 passes and 200 swaps per pass. A swap may not take a theme card away while that count is below the larger of the style minimum and the fill target (`localSearch` and the theme guard in `packages/core/src/builder.ts`, `config/builder-weights.json`). It uses no randomness.

Its objective already has a set-level balance term. For each hand-written synergy rule it adds the rule's weight times the smaller of the deck's enabler and payoff counts, and for a tribe also the smaller of its member and payoff counts. The sum is scaled by `synergyDensity` 1.5, the style's synergy weight, and, under learned selection, `rules` 0.25 (`synergyPairs` and `objectiveOf` in `builder.ts`). So it pays for setup while setup is short, at one to one. It fails on Graveyard because a card that is both setup and payoff counts on both sides, and because the matchers leave real setup out (`docs/algo-review.md`, causes 2 and 3). The term exists; its counts are wrong.

Speed figures marked "estimate" are arithmetic, not measurements.

### Greedy fill and greedy with lookahead

- **What it is.** Add the item with the best marginal gain until full. For the quadratic knapsack, Hammer and Rader (1997) replace the pair objective with its best linear approximation, add the best item, update, and finish with insertions and exchanges (per the Galli, Martello and Toth survey). Sephton et al. (2016) use greedy completion for a different task: predicting an opponent's hidden Netrunner deck from the cards seen so far. They rank cards by how many mined rules the seen cards activate and add them in that order, scored by overlap with the real list, not by how good the deck is.
- **Plan.** None; the first picks decide it.
- **Setup and payoff.** Only through the gain. Greedy gets within 1 - 1/e of the best when the objective has diminishing returns (is monotone submodular) and only the size is limited (Nemhauser, Wolsey and Fisher 1978). Setup and payoff are complements: a payoff gains value as setup joins it, so returns increase and the guarantee does not hold. That is why greedy cannot see that a payoff is worthless until enough setup joins it. Pair terms let an early payoff pull in its setup; lookahead adds a payoff and its setup as one move.
- **Mana, curve, interaction.** Quota passes, as ours do, or penalties in the gain.
- **Data.** Any objective; we have it.
- **Speed, determinism, license.** 99 picks times 3,000 candidates is 300,000 sparse lookups, well under 50 ms (estimate). Deterministic with an id tie-break. Papers only.
- **Bulk on a phone.** Excellent; the weakness is early commitment.

### Local search, swap search, and tabu search

- **What it is.** Start from a full deck and exchange cards while it helps. Exchange after greedy is the standard second phase for the quadratic knapsack; its first metaheuristic was a tabu search (Glover et al. 2002), which forbids undoing recent moves for a few steps so the search can pass through a dip. Q-DeckRec (Chen et al. 2018) is a learned local search for Hearthstone: its one action replaces a card, and a Q-learning network picks which.
- **Plan.** Given from outside (ours: `plan.ts`).
- **Setup and payoff.** As good as the objective. Today's objective does not prefer the engine deck, so there is no dip for a better search to cross. Take a Graveyard deck of payoffs that each mill one card:
  - Under the Graveyard style a plain looter is not setup. Loot, rummage, and discard outlets count only on a card that also has a graveyard payoff tag (`config/archetypes.json`), while the rider payoff counts as both setup and payoff (`addToTally` in `builder.ts`). Swapping one for a looter lowers both counts by one, and the theme guard may refuse the swap.
  - Under the hand-written graveyard rule the looter is setup (`config/synergy-rules.json`), so rule setup stays level and rule payoff drops by one.
  - A two-for-two swap, two rider payoffs out and a looter and a pure payoff in, also scores worse: style setup down two, payoff down one.

  Learned fit and card pairs may credit a particular looter, but no theme count does. Tabu memory, annealing, or package moves cannot reach a deck the objective does not prefer. The fix is in the setup definitions and the objective; better moves matter only after that, if real dips remain.

- **Mana, curve, interaction.** Checked per swap (ours: `canAdd` and the theme guard).
- **Data.** The objective only.
- **Speed, determinism, license.** The brief reports about 90 ms per synthetic 100-card build on desktop. Q-DeckRec takes 9.63 s of CPU per instance after one to three days of training, against 6 to 16 CPU hours for its genetic baseline, because each evaluation is 300 simulated matches. Fixed scan order keeps tabu deterministic.
- **Bulk on a phone.** Good; we ship it now.

### Simulated annealing

- **What it is.** Kirkpatrick, Gelatt and Vecchi (1983) accept a worse move with probability exp(-change/T) and lower T slowly; they call improvement-only search rapid quenching that freezes in poor states. I found no published deck builder that uses it.
- **Plan, mana, data.** As swap search.
- **Setup and payoff.** Can cross a dip by chance, but only where the objective rewards the far side. Today's objective does not for the rider-payoff deck (see swap search).
- **Speed, determinism, license.** Tens of thousands of cheap moves, tens of milliseconds (estimate). Needs our own seeded generator, since `Math.random` takes no seed. About 50 lines over the swap search (estimate).
- **Bulk on a phone.** Fine with a move cap; no proven gain over tabu.

### Genetic and evolutionary algorithms

- **What it is.**
  - García-Sánchez et al. (2018; 2016 CIG precursor): an individual is a 30-card Hearthstone deck, scored by 16 simulated games against each of 8 human decks, compared in order: rule errors, wins, then spread of wins across opponents. Population 10, 200 generations. "Smart Mutation" swaps a card for one within one mana of it. Each run took about 30 days of cluster compute; evolved decks beat the human decks when the AI played them.
  - Fontaine et al. (2019): MAP-Elites keeps the best Hearthstone deck in each cell of a grid over average mana cost and its variance, returning many different good decks from 10,000 evaluations of 200 simulated games.
  - Zhang, Fontaine, Hoover and Nikolaidis (2022), Deep Surrogate Assisted MAP-Elites: a neural network trained on simulated results predicts how a deck will do. MAP-Elites searches against the network, only the decks it keeps are simulated, and the network is retrained on them. With a budget of 10,000 simulated evaluations it reports better sample efficiency than plain MAP-Elites. A network trained once offline and then frozen did worse than the one retrained during the search.
  - Goodman-Wilson (2018, magique): evolves decks from the cards a player owns, with no simulation. Fitness scores closeness to target curve and type counts, creature stats, and hand-tagged pair synergies. Without synergy it made "piles"; with it, better decks, though his went 0 and 7 at a Standard Open.
  - Bjørke and Fludal (2017, NTNU thesis): a genetic algorithm for Magic card selection; only the abstract was readable.
- **Plan.** Emerges from fitness; MAP-Elites spreads decks across styles by design.
- **Setup and payoff.** With simulation an engine shows up as wins. Without it, our case, it optimises the same objective as swap search, and one-point crossover splits payoffs from their setup. A learned model can stand in for part of the simulation, but Deep Surrogate Assisted MAP-Elites still simulates to train and check it. Our nearest analogue, a model trained offline on 17Lands decks with wins, would be the frozen kind with no simulator to correct it (my inference).
- **Mana, curve, interaction.** Smart Mutation keeps the curve; magique scores it.
- **Data.** A simulator, which we lack; a learned surrogate, which needs game results to train on; or a rule objective, which we have.
- **Speed, determinism, license.** García-Sánchez et al. ran a population of 10 with 10 offspring per generation for 200 generations, about 2,000 deck evaluations. One pass of our swap search that finds no improvement tries each chosen spell against each pool spell: for a 3,000-card two-color pool, roughly 35 times 1,000, or 35,000 objective evaluations (estimate). So a genetic search on a rule objective is not shown to be slower. Each of its evaluations rescores a whole deck, which costs more than our incremental tally, so the gap is smaller than the counts suggest. The slowness reported in the literature comes from simulated games. Needs a seeded generator. The 2018 manuscript is CC BY-NC-ND 4.0; magique has no license; the surrogate paper is CC BY 4.0 on arXiv.
- **Bulk on a phone.** Feasible on a rule objective with a seeded generator and an evaluation cap; the useful idea is quality diversity, not the search itself.

### Integer and constraint programming

- **What it is.** Card counts are integers up to the copies owned; size, curve bands, role minimums, and color sources are linear constraints. Hernandez (2018) built 40-card sealed decks this way with R's lpSolve: maximise summed review ratings, exactly 23 spells, creature counts per mana value as soft targets with penalised slack, at least 4 removal, one solve per color pair. He notes the model ignores card interactions and is "more naturally solved using quadratic programming". He wrote a quadratic version, but it needed proprietary libraries.
- **Plan.** Enumerate, as he did with color pairs.
- **Setup and payoff.** A pair term costs a new variable and three constraints. The resource balance itself is linear: total setup supply must reach a ratio of total payoff demand. That is the cleanest statement of "setup feeds payoff" here, and a local search can carry it as a soft penalty. Our objective's smaller-of-enablers-and-payoffs term is a soft, one-to-one version of it, with dual cards counted on both sides.
- **Mana, curve, interaction.** Native constraints.
- **Data.** Our objective's inputs.
- **Speed, determinism, license.** Exact solvers in the survey reach a few hundred to about 1,500 items on test instances. A dependency-free simplex with branch and bound is roughly 500 to 1,000 lines (estimate) with no time bound; a node cap keeps it deterministic but not optimal. A solver package would be a new dependency, as Hernandez found for his quadratic version. Hernandez's repo has no license.
- **Bulk on a phone.** Risky to ship; useful offline to measure a heuristic's gap on the same objective.

### Co-occurrence models: association rules, PMI, embeddings

- **What it is.**
  - Sephton et al. (2016) mined Apriori rules from 6,000 Netrunner decklists and predicted the rest of an opponent's deck from five seen cards with up to 59% accuracy, measured as overlap with the real list; copy counts followed the card more than the deck.
  - PMI is the log of P(a and b) over P(a)P(b). EDHREC's lift is the same ratio without the log; our learned card pairs already use lift (`docs/learned-builder.md`).
  - Levy and Goldberg (2014) show skip-gram embeddings implicitly factorise a shifted PMI matrix, so a skip-gram card embedding is close to smoothed PMI. MTG-GloVe-Commander is GloVe, trained with weighted least squares per its model card, not skip-gram, so that result applies to it only loosely. It has 128 dimensions over 25,932 cards from over 5 million Commander co-occurrence pairs and reads no card text, so new cards get no vector.
  - Janusz, Grad and Ślęzak (ICDM Workshops 2018) report that combining deck co-occurrence with card text improved card similarity in Hearthstone and Clash Royale (abstract only).
  - Bertram, Fürnkranz and Müller (CoG 2024) predict human draft picks, about 100 million of them mostly from 17Lands, from card representations built from card attributes, a text embedding, images, and usage statistics. The representation barely matters for known cards but matters for unseen ones: a model trained on many sets matched 55% of human picks on a held-out set. Trained on one set, usage statistics alone beat attributes with text on unseen sets. Our tag-level learned data is a hand-built form of the same idea: signal carried by card features, not card identity.
- **Plan.** Clusters can name archetypes; no explicit plan.
- **Setup and payoff.** The only family that learns what real decks run: a looter that Graveyard decks play beside their payoffs gets credit. But the signal is symmetric, silent on how much setup a payoff needs, and mixes synergy with same set, same colors, and staples.
- **Mana, curve, interaction.** Not covered.
- **Data.** `data/corpus/decks.json` holds 54,000 17Lands draft decks, 3,000 from each of 18 sets, plus 680 60-card, 510 20-card, 51 40-card, and 200 Commander precons (counted 2026-11-08 with a one-off node script over the file).
  - Each draft deck comes from one set's draft. Cards are keyed on oracle id, so reprints link sets: 112 oracle ids appear in two or more draft sets. The real limit is coverage: the draft decks hold only 5,195 distinct cards, while bulk can come from any set. The 1,441 precons and EDHREC cover far more cross-set pairs.
  - Every draft deck records its wins and games (the first one: 7 wins in 9 games). That allows weighting co-occurrence by winning decks, or comparing pairs in winning and losing decks, which partly separates synergy from mere co-play.
  - We already ship 691 tag-level lift pairs (`config/learned/tags.json`) beside 908 card-level pairs (`data/learned.json`). Tag-level pairs reach cards the corpus never saw.
- **Speed, determinism, license.** Built offline, looked up at build time, deterministic. The GloVe model is MIT, but one 128-number vector per card is about 13 MB as float32 (the published file holds 6.7 million parameters), too large for the bundle untrimmed. The Sephton paper is all rights reserved. The Bertram paper is CC BY 4.0 on arXiv.
- **Bulk on a phone.** Good as an input to the objective, not as a builder.

### Comparison

| Method                | Setup-payoff fit                                                                              | Speed on a phone                                         | Deterministic         | Data needed                        | Cost in plain TypeScript |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------- | ---------------------------------- | ------------------------ |
| Greedy fill           | Weak alone, no guarantee when setup and payoff are complements; better with package lookahead | Fastest                                                  | Yes                   | Objective                          | Low                      |
| Swap search (ours)    | As good as the objective; today's does not prefer the engine deck                             | Fast (about 90 ms desktop, 100 cards)                    | Yes                   | Objective                          | Done                     |
| Tabu search           | Crosses short dips, once the objective prefers the engine                                     | Fast                                                     | Yes, fixed order      | Objective                          | Low                      |
| Simulated annealing   | Crosses dips by chance, same condition                                                        | Fast with a move cap                                     | With seeded generator | Objective                          | Low                      |
| Genetic, evolutionary | Strong only with simulation or a trained surrogate                                            | Slow with simulation; not shown slow on a rule objective | With seeded generator | Simulator, surrogate, or objective | Medium                   |
| Integer programming   | Best: balance is a linear constraint                                                          | No time bound                                            | With node cap         | Objective                          | High                     |
| Co-occurrence         | Learns real pairs; no direction or amounts                                                    | Fast lookups                                             | Yes                   | Corpus, EDHREC                     | Medium, offline          |

### Ideas worth borrowing

1. **Fix the balance term we have.** From integer programming and Hernandez's penalised slack. Today's term takes the smaller of setup and payoff counts, at one to one, with dual cards on both sides. Change it: count each card once, give each setup card a supply weight for how much and how often it feeds the resource and each payoff a demand, and penalise supply short of a ratio of demand. A swap search can carry this without a solver. This, with better setup definitions, is what would make the engine deck score higher; the search ideas below help only after that.
2. **Package moves.** From greedy lookahead, the knapsack exchange step, and Large Neighbourhood Search (Shaw 1998), which removes a related group of items and reinserts them by search. Pull a payoff and its setup out together and refill, or allow two-for-two swaps. Under today's objective this would not leave the "payoffs with riders" deck, since nothing prefers the engine deck; it helps once idea 1 is in. With a fixed rule for what to remove, it stays deterministic.
3. **Swap within a neighbourhood.** From García-Sánchez et al.'s Smart Mutation: try only replacements within one mana value, or in the same role. It keeps the curve and cuts candidates per swap.
4. **Lexicographic objective.** From García-Sánchez et al.: compare legality first, then plan health such as setup shortfall, then strength. No weight can trade a setup card for a generically strong one.
5. **Tabu memory.** From Glover et al. (2002) and Kirkpatrick et al.'s point that improvement-only search freezes early: forbid undoing the last few swaps so the search passes short dips, with no randomness. Like idea 2, it helps only once the objective prefers the engine deck.
6. **Quality-diversity options.** From Fontaine et al.'s MAP-Elites: keep the best deck per cell of (plan, curve height) for the Build page, not the top few by one score. This guards the style mix directly.
7. **Directional tag-level co-occurrence, weighted by wins.** We already ship symmetric tag-level lift pairs. The new part, from Sephton et al.'s directed rules: measure how often each setup tag appears given a payoff tag, and in what numbers, across precons, EDHREC, and draft decks, to size setup per payoff. Weight draft decks by wins to lean toward pairs that win, not just pairs that co-occur. Take copy counts from card-level data, as Sephton et al. found copies follow the card.

### Sources

- Galli, Martello, Toth, "The quadratic knapsack problem", European Journal of Operational Research 326 (2025): https://cris.unibo.it/bitstream/11585/1007965/3/1-s2.0-S0377221724009743-main.pdf. Read 2026-11-08. CC BY-NC-ND 4.0 (stated in the article).
- Khot, "Ruling Out PTAS for Graph Min-Bisection, Dense k-Subgraph, and Bipartite Clique", SIAM Journal on Computing 36(4) (2006) 1025-1071: https://epubs.siam.org/doi/10.1137/S0097539705447037. The publisher page refused the request; title and pages from the survey's reference list, the no-PTAS result and its assumption (NP not in randomized subexponential time) from abstract copies found by search, 2026-11-08. Publisher copyright.
- Nemhauser, Wolsey, Fisher, "An analysis of approximations for maximizing submodular set functions, I", Mathematical Programming 14 (1978) 265-294, DOI 10.1007/BF01588971: record at https://dblp.org/rec/journals/mp/NemhauserWF78.html and result restated at https://devel.isa-afp.org/entries/Submodular_Greedy.html. Checked 2026-11-08. Publisher copyright; result only.
- Shaw, "Using Constraint Programming and Local Search Methods to Solve Vehicle Routing Problems", CP 1998, LNCS 1520, 417-431: https://link.springer.com/doi/10.1007/3-540-49481-2_30. Bibliographic record and abstract via search results 2026-11-08; the publisher page redirected to a login. Publisher copyright; ideas only.
- García-Sánchez, Tonda, Mora, Squillero, Merelo, "Automated playtesting in collectible card games using evolutionary algorithms: a case study in HearthStone", Knowledge-Based Systems 153 (2018), accepted manuscript: https://iris.polito.it/bitstream/11583/2706329/1/2018-kbsys.pdf. Read 2026-11-08. CC BY-NC-ND 4.0 (stated on the manuscript).
- Chen et al., "Q-DeckRec: A Fast Deck Recommendation System for Collectible Card Games", CIG 2018: https://arxiv.org/abs/1806.09771 (read via https://ar5iv.labs.arxiv.org/html/1806.09771). Read 2026-11-08. arXiv license; no code release found.
- Fontaine, Lee, Soros, De Mesentier Silva, Togelius, Hoover, "Mapping Hearthstone Deck Spaces through MAP-Elites with Sliding Boundaries", GECCO 2019: https://arxiv.org/abs/1904.10656. Read 2026-11-08. arXiv non-exclusive distribution license.
- Zhang, Fontaine, Hoover, Nikolaidis, "Deep Surrogate Assisted MAP-Elites for Automated Hearthstone Deckbuilding", GECCO 2022: https://arxiv.org/abs/2112.03534 (read via https://ar5iv.labs.arxiv.org/html/2112.03534). Read 2026-11-08. CC BY 4.0 (arXiv page).
- Kowalski, Miernik, "Evolutionary Approach to Collectible Card Game Arena Deckbuilding using Active Genes" (2020): https://arxiv.org/abs/2001.01326; code in https://github.com/acatai/Strategy-Card-Game-AI-Competition. Read 2026-11-08. arXiv license; repo MIT (GitHub API). Evolves draft pick priorities with no pair terms, so not covered above.
- Goodman-Wilson, "Harnessing AI to evolve solid MtG decks from cards you already own", HackerNoon, 2018-06-01: https://hackernoon.com/machine-learning-magic-64a6a7f864d4; code https://github.com/UncannyBingo/magique. Read 2026-11-08. No license on the repo (GitHub API).
- Bjørke, Fludal, "Deckbuilding in Magic: The Gathering Using a Genetic Algorithm", NTNU master's thesis, 2017: https://hdl.handle.net/11250/2462429. Abstract read 2026-11-08 via the NVA API; full text download refused. Norwegian copyright act license.
- Hernandez, "Optimizing Magic: The Gathering in R", 2018-09-28: https://troyhernandez.com/2018/09/28/optimizing-magic-the-gathering-in-r/; code https://github.com/TroyHernandez/MTGcsv. Read 2026-11-08. No license on page or repo.
- Kirkpatrick, Gelatt, Vecchi, "Optimization by Simulated Annealing", Science 220 (1983): https://zhanggroup.org/teaching/literature/Kirkpatrick_Annealing_Science_1983.pdf. Read 2026-11-08. Copyright AAAS; ideas only.
- Sephton, Cowling, Devlin, Hodge, Slaven, "Using Association Rule Mining to Predict Opponent Deck Content in Android: Netrunner", CIG 2016: https://eprints.whiterose.ac.uk/104807/1/2016_CIG_RuleMining.pdf. Read 2026-11-08. All rights reserved (White Rose notice).
- Levy, Goldberg, "Neural Word Embedding as Implicit Matrix Factorization", NIPS 2014: https://neurips.cc/virtual/2014/poster/4686. Abstract read 2026-11-08. Publisher copyright.
- nishtahir, MTG-GloVe-Commander: https://huggingface.co/nishtahir/mtg-glove-embedding-commander and its config.json. Read 2026-11-08. MIT (model card).
- Janusz, Grad, Ślęzak, "Utilizing Hybrid Information Sources to Learn Representations of Cards in Collectible Card Video Games", ICDM Workshops 2018, 422-429: authors and pages from the record at https://researchr.org/publication/JanuszGS18 (the fact-checker's reading and search results; the site refused my connection); abstract via https://searchworks.jioinstitute.edu.in/articles/edsair__edsair.doi...........fe63b8f0a5f1ebee449b64114e0483ed. Read 2026-11-08, abstract only. Publisher copyright.
- Bertram, Fürnkranz, Müller, "Learning With Generalised Card Representations for 'Magic: The Gathering'", IEEE CoG 2024: https://arxiv.org/abs/2407.05879 (read via https://arxiv.org/html/2407.05879v1). Read 2026-11-08. CC BY 4.0 (arXiv page).
- Bulk Brew: `packages/core/src/builder.ts`, `config/builder-weights.json`, `config/archetypes.json`, `config/synergy-rules.json`, `config/learned/tags.json`, `data/learned.json`, `docs/learned-builder.md`, `data/corpus/decks.json`. Read 2026-11-08. MIT.
