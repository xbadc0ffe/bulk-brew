# How deck builders build decks: a review

This review looks at how other systems build card game decks, so Bulk Brew can design better builders of its own. It covers five families: general methods for choosing a set of items under constraints, open-source Magic engines, cube and draft tools with their bots and research, data-driven recommenders, and auto-build features in digital card games. Bulk Brew's own builder (26.0.35) appears beside them as one more entry. Sources were read on 2026-11-08.

The question behind every entry comes from `docs/algo-review.md`: does the approach make setup and payoff cards feed each other, or does it only count theme cards? The owner found Graveyard decks whose "setup" was payoffs with a one-card rider and no real engine.

Each family section was written by one agent, then checked against its sources by a second agent who tried to prove it wrong, and fixed. The checkers' notes are kept beside the sections in `docs/review/research/*.verify.md`, and for our builder in `docs/review/our-builder.verify.md` and `docs/review/our-builder-themes.verify.md`.

## Summary table

One row per approach or project, in family order: methods, engines, draft, recommenders, games, then Bulk Brew. A project that two families cover has one row.

- **Setup-payoff fit:** "yes" means it checks that payoffs have setup behind them; "counts theme cards only" means it rewards theme cards or card pairs without checking the balance; "none" means no setup or payoff term; "unknown" means the method is not public.
- **Data, have it?** refers to what Bulk Brew holds: Scryfall cards and Tagger tags, the corpus (1,441 precons and 54,000 17Lands draft decks with wins), the raw 17Lands game files for 18 sets, EDHREC pages, and Commander Spellbook.

| Approach                                                                                | Plan choice                                   | Setup-payoff fit                                             | Mana and curve                                              | Data needed (have it?)                                       | Speed on a phone                                        | Deterministic                 | License                                 |
| --------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| Greedy fill, with lookahead                                                             | None; first picks decide                      | None (only via the objective)                                | Quota passes or penalties                                   | Any objective (yes)                                          | Fastest, under 50 ms (estimate)                         | Yes, id tie-break             | Papers only                             |
| Swap and tabu search                                                                    | Given from outside                            | None (only via the objective)                                | Checked per swap                                            | Objective (yes)                                              | Fast                                                    | Yes, fixed order              | Papers only                             |
| Simulated annealing                                                                     | Given from outside                            | None (only via the objective)                                | Checked per swap                                            | Objective (yes)                                              | Fast with a move cap                                    | With a seeded generator       | Papers only                             |
| Genetic search on a rule objective (magique; Bjørke and Fludal)                         | Emerges from fitness                          | Counts theme cards only (hand-tagged pairs)                  | Curve and type targets in fitness                           | Rule objective (yes)                                         | Feasible with an evaluation cap                         | With a seeded generator       | magique none; thesis copyright          |
| Integer programming (Hernandez)                                                         | Enumerate color pairs                         | None as built; balance fits as a linear constraint           | Native: 23 spells, curve slack, 4 removal                   | Card ratings; our objective inputs (yes)                     | No time bound; risky                                    | With a node cap               | Repo none; a solver is a new dependency |
| Co-occurrence: lift, PMI, embeddings                                                    | Clusters can name archetypes                  | Counts theme cards only (no direction or amount)             | Not covered                                                 | Corpus, EDHREC (yes; tag and card pairs shipped)             | Fast lookups; GloVe 13 MB too big                       | Yes                           | GloVe MIT; papers vary                  |
| Forge Limited builder (`DeckHas`, `DeckNeeds`)                                          | Two most common colors in the top third       | Yes, weakly: yes-or-no hints; gate passes on the card itself | 17 or 18 lands; creature caps by cost; no removal count     | Per-set pick ranks, GPL hints (no)                           | Greedy; all-pairs ranker heavy at 3,000                 | No                            | GPL-3.0                                 |
| Forge card-gen decks (topic model)                                                      | Random key card or topic                      | Counts theme cards only (co-occurrence topics)               | Lands from average mana value; castability repair           | Tournament decklists (no; other decks yes)                   | Greedy, but draws from the whole database               | No                            | GPL-3.0                                 |
| Forge color generators and theme files                                                  | User or random colors; 68 hand-written themes | None (themes are hand-made groups)                           | Fixed shares, 42% lands at two colors                       | Hand lists (no)                                              | Fast                                                    | No                            | GPL-3.0                                 |
| Forge genetic algorithm (offline)                                                       | Evolves card-gen decks                        | None (only through simulated wins)                           | As card-gen                                                 | AI-versus-AI simulator (no)                                  | Far too slow                                            | No                            | GPL-3.0                                 |
| XMage `LimitedDeckBuilder`                                                              | Color pair with the highest summed rating     | None                                                         | 17 of 40; basics by pips; curve and creature repairs        | 47 set rating files covering 28% to 64% of our pools (no)    | One sort and a few swaps                                | Yes, given ratings            | MIT                                     |
| Ryan Saxe's DeckBuilder                                                                 | Learned, one model per set                    | None explicit (learned, one set)                             | Heads for nonbasics and basics; mean mana value term        | 17Lands games with sideboards (raw files yes)                | Fast, but needs TensorFlow                              | Yes at inference              | Apache-2.0                              |
| Magarena                                                                                | Named core, or random type or keyword         | Counts theme cards only (type and keyword match)             | Not checked                                                 | Hand lists (no)                                              | Fast                                                    | No, random by design          | GPL-3.0                                 |
| sparkroot                                                                               | Commander's creature type or keyword          | Counts theme cards only (word match)                         | 33 to 38 lands; curve by commander; role ranges             | Scryfall data and popularity rank (yes)                      | Greedy, server side, not timed                          | Probably not (untested)       | BUSL-1.1                                |
| Wagic                                                                                   | Random colors                                 | None                                                         | Fixed 18 basics and type counts                             | None; not from a pool                                        | Fast                                                    | No, random by design          | BSD (source)                            |
| CubeCobra bot builder                                                                   | None; label after the build                   | None explicit (learned co-picks)                             | 23 spells, 17 lands; land trim; basics by demand            | Cube picks and decks (no)                                    | Poor: 70 MB model on TF.js                              | Yes, fixed model              | Apache-2.0; weights unlicensed          |
| mtgml (CubeArtisan)                                                                     | None                                          | None explicit (transformer)                                  | Lands by the same score                                     | Human picks and decks (partly)                               | Too heavy for 3,000 cards                               | Not stated                    | AGPL-3.0                                |
| mtgdraftbots                                                                            | None; picks only, builds no deck              | None (embedding synergy for picks)                           | Eight seeded 17-land setups; value times cast chance        | Learned ratings, 33 MB table (no)                            | Fast lookups; table too big                             | Yes, given the seed           | AGPL-3.0                                |
| Draftsim autobuild                                                                      | Two colors                                    | None                                                         | 23 best cards, 17 lands                                     | Expert ratings (no)                                          | Fast                                                    | Yes                           | Site copyright                          |
| MTGA_Draft_17Lands                                                                      | Each color pair as Aggro, Mid, Control        | None                                                         | Creature and drop minimums; curve cap; 16 to 18 lands       | Win rates per color pair (computable for 18 sets)            | Fast                                                    | Yes                           | MIT, archived                           |
| Draft-pick research (Ward; Bertram; Rigaux and Kashima)                                 | None; builds no deck                          | None (pick models; pair lift for picks)                      | Not treated                                                 | Pick logs (no); 17Lands decks (yes)                          | Network pass per added card                             | Not stated                    | CC BY 4.0 or arXiv; code unlicensed     |
| Legends of Code and Magic drafting (Kowalski and Miernik; Vieira and others)            | None                                          | None (only through simulated play)                           | No curve control                                            | Game simulator (no)                                          | Simulation, too slow                                    | No                            | arXiv; competition repo MIT             |
| EDHREC inclusion, synergy, lift                                                         | User picks commander and theme                | Counts theme cards only (lift is symmetric)                  | Color identity only                                         | Millions of decklists; aggregates for 1,110 commanders (yes) | Lookups free                                            | Yes, as a snapshot            | EDHREC Terms; owner's exception         |
| EDHREC average deck                                                                     | By commander                                  | None (most-included cards per type)                          | Type counts and lands from averages                         | Average-deck pages (no)                                      | Fast                                                    | Yes, as a snapshot            | EDHREC Terms                            |
| EDHREC Recs (also Archidekt, Moxfield)                                                  | From the commander and the deck               | Counts theme cards only (Jaccard, 2015 method)               | None                                                        | Raw decklists (no)                                           | Server side                                             | Not stated                    | EDHREC Terms                            |
| 17Lands card metrics                                                                    | None; colors only                             | None (per-card quality)                                      | Not in the metrics                                          | Game data (yes, 18 sets)                                     | Offline aggregate                                       | Yes, as a snapshot            | Data CC BY 4.0                          |
| Association rules (Sephton and others)                                                  | Identity card                                 | Counts theme cards only (direction is mostly base rate)      | None; influence budget                                      | Decklists (yes)                                              | Fast lookups                                            | Yes                           | Paper all rights reserved               |
| Other deck sites (TappedOut, Deckstats, DeckCheck)                                      | Unknown                                       | Unknown                                                      | Unknown                                                     | Decklists                                                    | Server side                                             | Unknown                       | Proprietary                             |
| Hearthstone Smart Deck Builder                                                          | Clusters of popular decks                     | None in the back-fill (a test found lone payoffs)            | Curve only; soft cap of 10 per cost                         | Ranked decklists, win rates (lists only)                     | Not stated                                              | No, by design                 | Proprietary                             |
| Hearthstone Deck Recipes                                                                | Designer's themed recipe                      | Yes, by hand; substitutes unknown                            | In the recipe                                               | Hand lists (no)                                              | Not stated                                              | Not stated                    | Proprietary                             |
| Marvel Snap autofill                                                                    | Popular shell around seed cards               | Unknown (lone cards land in shells)                          | Not documented                                              | Live match stats (no)                                        | Not documented                                          | Not documented                | Proprietary                             |
| Master Duel, Duel Links, Shadowverse, Pokémon TCG Pocket                                | Class, types, or players' decks               | Unknown                                                      | Not public                                                  | Not public                                                   | Not public                                              | Master Duel's random mode: no | Proprietary                             |
| Magic Duels Deck Wizard                                                                 | Player picks an archetype first               | Unknown (cards in stages)                                    | Ignores cost                                                | Not described                                                | Not described                                           | Not described                 | Proprietary                             |
| Jumpstart and Arena Jump In!                                                            | Player picks two designed packets             | Yes, by design                                               | Designed curve; Arena adds basics from costs                | Hand-designed packets (no)                                   | Cheap                                                   | No, alternates drawn at odds  | Proprietary                             |
| Search by simulated games (García-Sánchez; Q-DeckRec; MAP-Elites; surrogate MAP-Elites) | None; set by the AI player or target          | None (only through simulated wins)                           | Simulator; MAP-Elites curve axes                            | Rules simulator (no)                                         | Far too slow                                            | No                            | Papers; simulators GPL or AGPL          |
| Utility scoring without simulation (Stiegler; Betley)                                   | Unverified; clusters (Betley)                 | Unknown (synergy term undefined)                             | Curve metric                                                | Popular decklists (yes)                                      | Cheap greedy                                            | Yes, fixed tie-breaks         | IEEE; FedCSIS none stated               |
| Bulk Brew 26.0.35                                                                       | Scan, then plan score or requested style      | Counts theme cards only (dual cards count twice)             | Land formula refit; hypergeometric sources; roles and curve | Tags, corpus, EDHREC, Spellbook (yes)                        | About 50 ms a build on desktop; up to 36 per Build page | Yes                           | MIT                                     |

## Ideas worth borrowing, ranked

Every family's list, merged and ranked by how directly each idea makes setup and payoff fit together in a bulk pool, on a phone, with data we already have. The first three change what the builder counts and wants; the rest build on them.

1. **Count setup and payoff honestly, each card once.** Give each card one job per theme. Setup gets a supply weight for how much and how often it feeds the resource, read from oracle text and, where they exist, Tagger's `repeatable-*` tags; each payoff gets a demand. Forge's provides-and-wants hints have the right shape but no amounts, so they too count surveil 2 on a removal spell as setup. (Engines: Forge `DeckHas` and `DeckNeeds`; methods: fix the balance term.)
2. **Balance supply against demand in the objective.** Replace today's min(enablers, payoffs), which counts dual cards on both sides at one to one, with a penalty when setup supply falls short of a ratio of payoff demand. Integer programming states this as one linear constraint, and a swap search can carry it as a soft penalty with no solver. Forge's ranker applies the same pressure card by card: a setup card gains for each payoff it would feed, and a payoff loses by its shortfall. (Methods: integer programming and Hernandez's penalised slack; engines: Forge CardRanker.)
3. **A payoff enters only when enough separate setup is already in the deck.** Apply the gate in every layer that adds cards, filler and curve passes included, and count other cards in the deck, not the pool, so a card never meets its own need. Hearthstone's synergy-blind back-fill is a plausible source of its payoffs with no enablers, and Forge's keep-or-drop gate passes on one partner or on the card itself. (Games: the fallback keeps the dependency; engines: Forge `RemoveDeck:Random`; recommenders: add a payoff only when the pool supplies its setup.)
4. **Seed payoffs, then grow setup, re-scoring against the deck so far.** Start from the few payoffs the pool supports best plus the setup they need, then re-score every remaining card after each add, so setup gains value as payoffs arrive and payoffs stop once setup runs out. CubeCobra seeds 10 cards and then fills one at a time against the deck, Sephton's best rule variant re-checks after each predicted card, and Magic Duels' Deck Wizard has the player pick the plan before any card; Blizzard's back-fill shows re-scoring helps only if the score has a setup-and-payoff term. (Draft: CubeCobra, Saxe; recommenders: Sephton variant a7; games: Stiegler, Deck Wizard, Smart Deck Builder.)
5. **Fill slots, and rank cards only within their slot.** Take slot counts per plan (setup, payoff, removal, creatures by mana value) and let each card compete only for the slot of its job, so a payoff with a mill rider never fills a setup slot and theme value stops breaking ties inside the removal pass. EDHREC's average deck fills type slots with each type's most-included cards, Jumpstart packets and Arena's alternates are shipped slot templates with setup and payoff in the same packet, and Hearthstone's soft cap per cost bucket keeps the curve. (Recommenders: EDHREC average deck; games: Jumpstart, Jump In!, Smart Deck Builder.)
6. **Check what each theme card needs from the rest of the deck.** A short per-theme list of if-this-then-require rules would drop Ajani's Comrade with no Ajani, Iron Monger with nothing that connives, and cards that shuffle the graveyard away from a Graveyard deck. Blizzard ships rules of this kind ("with Prince Keleseth, avoid two-cost cards"), and our own theme review found 10 counted copies that cannot do their counted job in their deck. (Games: Hearthstone's quality-assurance rules; Bulk Brew's theme review.)
7. **Compare plan health before strength.** Score decks in order: legality first, then plan health such as setup shortfall, then card strength, so no weight can trade a setup card for a generically strong one. This guards against what an earlier phase saw when card strength pushed theme cards out. (Methods: García-Sánchez and others' ordered fitness.)
8. **Repair after the fill with hard plan rules.** After a greedy fill, run deterministic replace-the-worst passes until the deck has enough setup per payoff, a minimum of removal or blockers, a way to win, and spells its lands can cast. XMage repairs curve and creature counts this way and Forge swaps out spells its lands cannot cast; the plan rules are the new part. (Engines: XMage `LimitedDeckBuilder`, Forge `DeckManaBase`.)
9. **A plain deck that a theme must beat.** For each color choice, also build a plain Aggro, Midrange, or Control deck from creature, drop, curve, and land requirements; a themed deck that cannot fill its setup slots should lose to it, not replace it. The goal already counts a plain deck with a working curve as decent, and our failed themed decks play as midrange piles anyway. (Recommenders and draft: MTGA_Draft_17Lands.)
10. **Size setup per payoff from real decks.** Offline, measure how often each payoff tag's decks hold at least k separate setup cards, against the base rate, across precons, EDHREC, and draft decks weighted by wins. Count only decks that could have played the card (right colors, released by then), and take the setup and payoff labels from the theme guide, since co-occurrence alone cannot say which card feeds which. (Methods: directional tag co-occurrence; recommenders: association-rule confidence and EDHREC's potential-decks denominator; draft: lift over chance.)
11. **Move setup and payoff as a package.** Let the swap search pull a payoff and its setup out together and refill, swap two for two, try replacements in the same role or mana value first, and use tabu memory to pass short dips. Packages could also be mined offline from the corpus, by topics or clusters, and placed as units. All of this helps only after ideas 1 and 2, since today's objective does not prefer the engine deck. (Methods: Large Neighbourhood Search, Smart Mutation, tabu search; engines: Forge topics; games: packages first, deck clusters.)
12. **Pick colors and weight cards so the engine can be cast.** Score each color choice by the quality of both its setup and its payoffs, and weight each card's plan value by its chance to be cast, so a heavy-pip payoff on a thin splash counts for less. mtgdraftbots reads that chance from a 33 MB table sized for 40 cards, so a phone needs a direct calculation, and Forge's land formula and Arena's basics from spell costs are cross-checks for `lands.ts`. (Engines: XMage colors, Forge lands; draft: mtgdraftbots; games: Jump In!.)
13. **Judge with checks the builder does not share.** Measure how often each builder plays hand-picked card families when the pool has them, such as looters and repeatable self-mill against one-time surveil riders, picked from oracle text rather than the builder's tags, and report setup per payoff for each themed deck. A goldfish simulation is the cheap form of judging by play, which Forge's genetic algorithm and the Legends of Code and Magic papers use. (Draft: CubeCobra's evaluation harness proposal, judging by play; engines: Forge's has-to-needs ratio and genetic algorithm.)
14. **Offer different decks, not the top few by one score.** Keep the best deck per cell of plan and curve height for the Build page, which guards the style mix directly. (Methods and games: MAP-Elites.)
15. **Learn from 17Lands pools, decks, and games.** The raw 17Lands files pair each draft pool with the deck a person kept, with wins and cards in hand, so they can test which setup and payoff tag pairs win together and train a "next card given the deck so far" score. The keep rate measures card value, not role, coverage stops at draft-era cards, and reaching old bulk cards needs features such as tags and oracle text, where the evidence is weak. (Draft: Saxe, CubeCobraML, Bertram and others; recommenders: 17Lands win-rate interaction; engines: next card given the deck.)

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

## Data-driven card recommenders

These systems rank cards by what real players put in their decks, or by how those decks did. The question for Bulk Brew is which counts can tell a real engine from a payoff with a one-card rider.

Local numbers in this section come from `node data/review/scratch/recommenders/numbers.cjs`, run from the repo root, with its output in `data/review/scratch/recommenders/numbers.txt`, unless another source is named.

### EDHREC: inclusion, synergy, lift, and average decks

- **What it is.** EDHREC is a Commander statistics site. It computes statistics from public decklists on Archidekt, Moxfield, and Scryfall ([How to Use EDHREC](https://edhrec.com/guides/how-to-use-edhrec), 2025). Sources read: the [FAQ](https://edhrec.com/faq), the [lift article](https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era) (Julia Maddalena, 2025-12-15), and the [Digital Deckbuilding guide](https://edhrec.com/articles/digital-deckbuilding-the-how-to-guide-to-building-a-commander-deck-using-edhrec-archidekt-and-commander-spellbook) (John Sherwood, 2024-04-17).
- **Definitions.**
  - **Inclusion** is the number of decks that run a card over its "potential decks". Those are decks that could legally run it: the right color identity, and updated after the card was previewed (FAQ).
  - **Synergy** is a card's inclusion in one commander's decks minus its inclusion across eligible decks of overlapping colors (guide). The lift article gives the formula with the color identity as the base.
  - **Lift** is how often two cards appear together compared with chance, within decks that could run both. EDHREC is retiring synergy for lift because synergy is asymmetric (card A's page can disagree with card B's) and gave bad scores for some card pairs.
  - **Our cache.** 1,106 of the 1,113 cached commander and commander theme pages in `data/edhrec/` show "High Lift Cards". Seven do not, among them Atraxa, Praetors' Voice and Yasmin Khan. The lift article said lift had not yet replaced synergy on commander pages, so the switch came after it. Every card carries `num_decks`, `potential_decks`, `synergy`, and `lift`. For example, Brainstorm on Abaddon the Despoiler's page: 4,472 of 6,791 decks (66%), synergy 0.49, lift 3.93.
- **Plan.** None: the user picks a commander and, optionally, a theme. Each commander page counts its decks per theme. The FAQ says each theme is "defined individually", with no single formula, and "not scientific": the developers adjusted counts until the pages looked right. No thresholds are published.
- **Cards.** Ranked by inclusion and lift, which measure what players put together, not what feeds what. Lift is symmetric, so it cannot tell setup from payoff, and it rates both jobs on one scale. On the cached graveyard theme page, Living Death, a payoff with no setup of its own, has lift 2.69, close to the looter Faithless Looting at 2.88. Syr Konrad, the Grim, a payoff whose only setup is a paid one-card mill, has 2.23 (card text from `npm run review:cards -- "Living Death" "Faithless Looting" "Syr Konrad, the Grim" --style graveyard`). Lift says a card belongs to the theme, not which job it does. Human judgment is built in, though: real graveyard decks run looters, so looters show up on the theme page (Faithless Looting is in 49.8% of its potential decks there).
- **Average deck.** EDHREC does not document how it is assembled (unverified). Its JSON holds counts per card type that sum to 99, a deck count, and the cards. We checked one: Krenko, Mob Boss's average deck has the same type counts as our cached commander page (31 creatures, 7 instants, 8 sorceries, 12 artifacts, 6 enchantments, 35 lands, 30 of them Mountains), and each type holds that type's most-included cards (the least-included creature kept is in 32% of decks, the most-included one left out in 30%; instants, sorceries, and enchantments show the same cutoff). One commander does not prove a general rule (unverified).
- **Mana, curve, interaction.** Land count, type counts, and the curve are population averages. Nothing checks interaction or castability beyond color identity; removal appears only as far as players include it.
- **Data, and whether we have it.** EDHREC draws on millions of decklists: the deck counts on our 1,110 cached commander pages sum to about 6.6 million. We have aggregates in `data/edhrec/`: 1,110 commander pages, 3 commander theme pages, and 160 theme pages, each listing top cards per section, not raw decklists. We do not have average-deck pages. `learn-build.ts` already turns these into style fit and commander plan shares.
- **Speed, determinism, license.** Computed on EDHREC's servers, so lookups are fast; numbers drift as decks arrive, but a cached snapshot is deterministic. The [Terms of Service](https://edhrec.com/terms) (effective 2024-08-06) grant a personal, noncommercial license. Their "Certain Restrictions" forbid, among other things: (b) changing or making "derivative works of" any part of the site; (c) building a similar or competitive site; (d) copying or republishing it; and "automated searches, requests, or queries". Clause (b) bears most directly on shipping numbers derived from EDHREC pages. The owner's 2026-11-05 exception in `SPEC.md` allows a gentle developer-side fetch with only derived numbers in the app. That exception is an owner decision that overrides these clauses for this project, not a reading of the Terms. Ideas may be reimplemented; lists may not be shipped.
- **Bulk on a phone.** Commander only, singleton, multiplayer, and the card lists favor popular cards a pool of commons rarely holds. What transfers is shapes (type counts, curve, lands) and tag-level summaries, which we already learn. Lookups cost nothing on a phone.

### 17Lands: public data and card metrics

- **What it is.** An MTG Arena draft tracker; players opt in to share drafts and games. Sources: its metric definitions, public datasets, and usage guidelines pages (rendered by JavaScript, so read from the site's script bundle, saved in `data/review/scratch/recommenders/`); the blog post [Using Win Rate Data](https://blog.17lands.com/posts/using-win-rate-data/) (Sierkovitz, 2021, updated 2026); and the paper ["Embarrassingly Causal"](https://arxiv.org/abs/2604.18314) (Ramos, 2026).
- **Metrics, as 17Lands defines them.** ALSA: the average pick number where a card was last seen in packs. ATA: the average pick at which 17Lands drafters took it. GP WR: the win rate of decks with the card in the main deck, weighted by copies. OH WR: in the kept opening hand. GD WR: drawn after the opening hand. GIH WR: in hand at any point. GNS WR: in the deck but never seen. IIH: GIH WR minus GNS WR, called IWD until its rename on 2025-08-01 (same definition). In-game metrics count games, not matches.
- **Known biases.**
  - **17Lands' own caveats:** OH WR is skewed because hard-to-cast cards get mulliganed away. IIH is a plain difference that may overvalue powerful late-game cards. ALSA runs slightly high when first-pick data is missing.
  - **The blog adds:** GP WR is half noise, since about half the deck goes undrawn; win rates mix the card with the strength of its archetypes; long games inflate GIH WR; splashed bombs skew results; the users are average to good players.
  - **The paper:** GIH WR and IIH are associations, biased by confounding (drawing a card goes with the number of turns in the game), selection effects, and "post-treatment conditioning". Its thesis is the other half: because a pick so plainly affects the games that follow, these associational numbers are still "causally informative" for pick decisions, which it calls "embarrassingly causal".
- **Plan.** None. Games carry `main_colors` and `splash_colors`, so color pairs can be compared, but there are no archetype labels.
- **Cards.** Per-card quality only. The definitions page lists no pair metric, so nothing here encodes setup and payoff.
- **Mana, curve, interaction.** Not in the metrics. Games record `num_mulligans`, `num_turns`, and `on_play`.
- **Data, and whether we have it.**
  - We hold the Premier Draft game data for 18 sets in `data/corpus/raw/` (FDN alone: 791,159 games). 17Lands also publishes other event types and draft and replay data, which we have not downloaded. Each row is one game, with per-card counts in deck, opening hand, drawn, tutored, and sideboard, plus `won`, colors, turns, mulligans, and skill buckets (`user_game_win_rate_bucket`, `user_n_games_bucket`). The corpus keeps 54,000 of these decks.
  - In a draft the sideboard is the rest of the pool, so each row pairs a pool with the deck a person built from it (`deck_` and `sideboard_` columns, 259 of each in FDN). That is the closest public analogue of building from bulk; `draft.md` covers it (idea 7 below).
  - Every in-game metric can be computed locally. ALSA and ATA need the draft data files, which we do not have.
  - Phase 7 tried a games-weighted card win rate as strength; plan recall fell at every size because "generically strong cards pushed out the theme cards" (`docs/todo.md`).
- **Speed, determinism, license.** Aggregation is offline, and a file snapshot is deterministic. The public datasets are CC BY 4.0 "unless otherwise noted" (public datasets page). The usage guidelines ask for visible credit, discourage scraping the API, and point to the data dumps instead. We already credit 17Lands. The blog posts are CC BY 4.0 by their authors "except where otherwise noted" (blog footer).
- **Bulk on a phone.** Draft commons are exactly what bulk holds, so coverage is good for those 18 sets and empty for older ones, and a rate belongs to its own draft environment. As a strength number it already hurt themes; its better uses are independent evidence (idea 2 below) and pool-to-deck pairs (idea 7).

### MTGA_Draft_17Lands: a deck builder on 17Lands ratings

- **What it is.** An open-source draft assistant by bstaple1 ([repository](https://github.com/bstaple1/MTGA_Draft_17Lands)). Its README says it has been unmaintained since June 2023, and the repository was archived on 2025-08-23. It is not the only published builder on 17Lands data: Ryan Saxe's `DeckBuilder` ([repository](https://github.com/RyanSaxe/mtg), Apache-2.0), a denoising autoencoder that turns a draft pool into a 40-card deck, is covered in `draft.md`, section "Ryan Saxe's DeckBuilder (17Lands data)".
- **Plan.** For each viable color combination it builds an Aggro, a Mid, and a Control deck, then keeps the best-rated deck per combination.
- **Cards.** It takes the highest win-rate cards. Ratings are GIH WR within the color combination being built, not one number per card per set. A deck's rating is the cards' combined GIH WR minus penalties for missed requirements. The README says it "will NOT identify card synergies".
- **Mana, curve, interaction.**
  - **Creatures:** at least 9, ideally 17, 15, or 10 for Aggro, Mid, and Control.
  - **Curve:** a minimum number of cards at each mana value, and an average creature mana value of at most 2.40, 3.04, or 3.68.
  - **Lands:** 16, 17, or 18, from a ChannelFireball article. It splashes a color for cards rated far above the mean, and adds nonbasic lands whose win rate clears a threshold. `draft.md` describes how it splits the basics.
  - **Interaction:** none.
- **Data.** 17Lands GIH win rates per color combination. We do not store this table, but can compute it for our 18 sets from local game data.
- **Speed, determinism, license.** Fast and deterministic: `src/card_logic.py` uses no randomness and builds by sorting and greedy fill, with a small recursive search for the creature curve (read for facts only, nothing copied). License: MIT (repository `LICENSE`).
- **Bulk on a phone.** Its templates resemble our Aggro, Midrange, and Control shapes. It is a fair baseline for plain decks, which the goal accepts as decent, but it builds no engines.

### Association rules: Apriori on Netrunner decklists

- **What it is.** Sephton, Cowling, Devlin, Hodge, and Slaven, ["Using Association Rule Mining to Predict Opponent Deck Content in Android: Netrunner"](https://eprints.whiterose.ac.uk/id/eprint/104807/) (IEEE CIG 2016; University of York and Stainless Games).
- **Plan.** None. The identity card, Netrunner's counterpart of a commander, is the main evidence.
- **Cards.** Rules say "these observed cards imply that card", each with a support and a directional confidence (how often B appears given A). Prediction adds cards in order of how many active rules point to them.
  - **Variants.** Plain Apriori (a1) predicted up to 48% of a deck. Each later variant adds one change, with gains at each step's best minimum support: copy counts (a2, about 5 points), spending the influence budget first (a3, under 2), separate rules for cards that cost influence (a4, about 4), preferring larger rules (a6), and re-checking (a7). The paper reports "a maximum improvement of 13%" from a1 to its best variant, a7, and up to 59% of a deck from 5 seen cards.
  - **Re-checking.** In a1 to a6, rules fire only from the observed cards. a7 adds each predicted card to the observed set and checks all rules again. The paper found this helped at higher minimum support and had "almost no effect" at 15 and below.
- **Mana, curve, interaction.** None. It handles influence, a deck-building budget, and game knowledge such as copy limits and influence drove several of the steps above.
- **Data.** 6,000 community decklists from NetrunnerDB. We have the equivalent: 200 Commander precons, 680 60-card, 51 40-card, and 510 20-card precons, and 54,000 draft decks.
- **Speed, determinism, license.** Mining is offline; prediction counts active rules, fast and deterministic. The paper is copyrighted, all rights reserved (repository notice), so we reuse ideas only.
- **Bulk on a phone.** Rules on specific cards rarely fire in a bulk pool. Rules on tags or functions would fire, and their cost is a small table lookup.

### Deck sites with recommendation features

- **Archidekt:** in 2019 its Recs tab sent the deck to EDHREC and showed EDHREC's suggestions ([2019 partnership](https://edhrec.com/articles/archidekt-and-edhrec-announce-partnership)). The 2024 [EDHREC guide](https://edhrec.com/articles/digital-deckbuilding-the-how-to-guide-to-building-a-commander-deck-using-edhrec-archidekt-and-commander-spellbook) says "the Recs tool" can be used "directly within Archidekt" for Commander decks, which suggests it still comes from EDHREC, but it does not say so outright.
- **EDHREC Recs:** the 2024 guide says Recs give "customized recommendations based on comparisons to similar deck lists"; with only a commander entered, it returns the average deck. EDHREC's founder, Donald Miner, described the method in a [2015 talk](https://www.slideshare.net/slideshow/edhrec-data-science-md/53058725) (Data Science MD, 2015-09-21):
  - Version 1 was user-based collaborative filtering, with decks as users and cards as items. It caught big themes but missed subtle ones.
  - Version 2 built an offline card-to-card matrix of Jaccard (Tanimoto) similarity: decks holding both cards over decks holding either. For a deck, it summed its cards' rows and showed the top scores.
  - Decks were split by color combination, which the talk says hurt themes that span colors; splitting by commander was worse.
  - Whether today's Recs still work this way is unverified. Jaccard is symmetric like lift, so it also cannot tell setup from payoff.
- **Moxfield:** its [public wiki](https://github.com/moxfield/moxfield-public/wiki/Features) says it "fully integrated EDHREC right into the deck building experience", that users "can view recommendations on our site", and that its Commander data goes to EDHREC daily. So its recommendations come from EDHREC, like Archidekt's. The page was last edited 2020-10-14 and may be out of date.
- **Scryfall:** no recommender. Its [syntax docs](https://scryfall.com/docs/syntax) offer sorting by EDHREC rank and searching Tagger tags that "describe the function of the card", the tags our matchers use.
- **TappedOut:** a "Get Suggestions" engine was announced in 2014 ([post](https://tappedout.net/mtg-forum/site-updates/suggestion-engine)), with no method given.
- **Deckstats:** reportedly links Commander decks to EDHREC suggestions (unverified; the forum page could not be read).
- **DeckCheck:** in April 2026 it began testing, in beta, a recommender called Recommander, which its [post](https://deckcheck.co/blog/deckcheck-x-recommander) says uses collaborative filtering over "a huge collection of Commander decks". No method details are public.

### Ideas worth borrowing

1. **Test whether a labeled payoff needs labeled setup** (association-rule confidence, Sephton et al.; EDHREC's note that lift is symmetric). Co-occurrence alone cannot say which card feeds which. For one pair, the two directional confidences differ only by how common each card is: confidence from A to B over confidence from B to A always equals the rate of B over the rate of A. So the setup and payoff labels must come from elsewhere, such as the theme guide. Given those labels, measure in real decks how often a payoff's decks also hold at least k separate setup cards, against the base rate. A payoff whose decks nearly always carry several setup cards needs them, and the builder should add it only when the pool supplies that many distinct setup cards.
2. **Win-rate interaction for setup and payoff pairs** (17Lands GIH and GNS definitions and their caveats; Ramos). From local game data, within one set, compare the win rate when both a setup tag and a payoff tag were in hand against what each predicts alone. Split by the skill bucket and by play or draw, which are fixed before the game. Be careful with `num_turns`: game length depends on the cards drawn and on who wins, so splitting by it conditions on something that happens after the draw. That is a form of the post-treatment conditioning that Ramos lists among the biases in 17Lands data, and it can add bias as well as remove it. Check a result by comparing the same pair across sets. The tags still come from our matchers or the theme guide, so this tests which tagged pairs pay off in games, not which cards are setup. Use it as evidence for the theme guide, never as raw card strength.
3. **Fill slots, rank within the slot** (EDHREC average deck, as observed on Krenko). Take slot counts from real decks of the plan (setup, payoff, removal, creatures by curve), then rank pool cards only within each slot. A payoff with a mill rider competes for a payoff slot and cannot fill a setup slot. This also matches the `docs/todo.md` note that quality should act only among cards with the same job.
4. **A potential-decks denominator** (EDHREC FAQ). Count a card's or tag's rate only over corpus decks that could have played it: right colors, and from sets at or after its release. Otherwise a card looks unpopular only because most decks could never have held it: they predate it, or come from draft sets it was not in. Part of this exists: `learn-build.ts` computes 40-card corpus lift within one set, and draft card pairs within one set and color pair, so draft cards are compared only with decks from their own set. What is new is restricting by colors and release date at 60, 100, and 20.
5. **Re-check rules after every pick** (Sephton et al.'s variant a7). In a greedy build, recompute which payoffs the chosen setup now supports before each pick, so the deck follows its own engine. Choose setup first, then only payoffs that setup activates. The paper tested this: a7 was its best variant, but re-checking helped only at higher minimum support and had "almost no effect" at 15 and below. Treat it as worth testing, not proven. `draft.md` idea 1 reaches the same idea from CubeCobra and Saxe.
6. **A plain-shape fallback that themes must beat** (MTGA_Draft_17Lands deck suggester). For each color pair, build Aggro, Mid, and Control from requirements on creatures, drops, average creature cost, and lands, rated by summed card quality minus penalties. A themed deck that cannot fill its setup slots should lose to this deck, not replace it.
7. **Learn from pool and deck pairs** (17Lands `deck_` and `sideboard_` columns; Saxe's DeckBuilder). Each local game row shows what a person kept from a given draft pool, the closest public analogue of building from bulk. `draft.md` idea 3 covers how to use it and its limits: the plain keep rate measures card value, not role.

### Sources

All read 2026-11-08.

- EDHREC, Frequently Asked Questions, https://edhrec.com/faq. EDHREC Terms of Service (all rights reserved; personal, noncommercial use).
- EDHREC, "From Synergy to Lift: The Math Behind EDHREC's New Era of Recommendations", https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era. EDHREC Terms.
- EDHREC, "Digital Deckbuilding: The How-to Guide to Building a Commander Deck Using EDHREC, Archidekt and Commander Spellbook", https://edhrec.com/articles/digital-deckbuilding-the-how-to-guide-to-building-a-commander-deck-using-edhrec-archidekt-and-commander-spellbook. EDHREC Terms.
- EDHREC, How to Use EDHREC, https://edhrec.com/guides/how-to-use-edhrec. EDHREC Terms.
- EDHREC, "New EDHREC Feature! A Clipboard for Cards", https://edhrec.com/articles/new-edhrec-feature-a-clipboard-for-cards. EDHREC Terms.
- EDHREC, "Archidekt and EDHREC Announce Partnership", https://edhrec.com/articles/archidekt-and-edhrec-announce-partnership. EDHREC Terms.
- EDHREC, "An Interview with EDHREC Founder Don Miner", https://edhrec.com/articles/edhrec-founder-don-miner-to-speak-at-mv-con-2025 (title only, for his role). EDHREC Terms.
- EDHREC, Terms of Service, https://edhrec.com/terms (effective 2024-08-06), section "Certain Restrictions".
- EDHREC, average deck JSON for Atraxa, Praetors' Voice (read in place) and Krenko, Mob Boss (saved in `data/review/scratch/recommenders/`), https://json.edhrec.com/pages/average-decks/atraxa-praetors-voice.json and https://json.edhrec.com/pages/average-decks/krenko-mob-boss.json. EDHREC Terms; read for analysis only.
- Donald Miner, "EDHREC @ Data Science MD", 2015-09-21, https://www.slideshare.net/slideshow/edhrec-data-science-md/53058725. License not checked; read for ideas only.
- Moxfield, public wiki, Features, https://github.com/moxfield/moxfield-public/wiki/Features (last edited 2020-10-14). License not checked.
- DeckCheck, "DeckCheck x Recommander", 2026-04-27, https://deckcheck.co/blog/deckcheck-x-recommander. Site content, license not checked.
- 17Lands, metric definitions, public datasets, and usage guidelines, https://www.17lands.com/metrics_definitions, https://www.17lands.com/public_datasets, https://www.17lands.com/usage_guidelines (text read from the site's script bundle). Datasets CC BY 4.0 unless noted; site pages under 17Lands' terms.
- Sierkovitz, "Using Win Rate Data", 17Lands Blog, https://blog.17lands.com/posts/using-win-rate-data/. CC BY 4.0 by the author, except where otherwise noted (blog footer).
- Mark Louie F. Ramos, "Embarrassingly Causal: Causal Use of Associational Data in Magic The Gathering Drafts", arXiv:2604.18314, https://arxiv.org/abs/2604.18314. CC BY 4.0 (arXiv page). arXiv's metadata lists "Ph.D" as a second author; the PDF names only Ramos.
- bstaple1, MTGA_Draft_17Lands, https://github.com/bstaple1/MTGA_Draft_17Lands, including `src/card_logic.py` (read for facts only). MIT.
- Ryan Saxe, mtg, https://github.com/RyanSaxe/mtg. Apache-2.0. Described in `docs/review/research/draft.md`.
- Sephton et al., "Using Association Rule Mining to Predict Opponent Deck Content in Android: Netrunner", CIG 2016, https://eprints.whiterose.ac.uk/id/eprint/104807/. Copyright, all rights reserved (repository notice).
- Scryfall, Search Reference, https://scryfall.com/docs/syntax. Scryfall site terms (not rechecked here).
- TappedOut, "Suggestion Engine", https://tappedout.net/mtg-forum/site-updates/suggestion-engine. Site content, no license stated.
- Local: `data/edhrec/pages/` (EDHREC cache), `data/corpus/raw/game_data_public.*.PremierDraft.csv.gz` and `data/corpus/decks.json` (17Lands and MTGJSON corpus), `packages/pipeline/src/learn-build.ts`, `docs/review/research/draft.md`, `docs/todo.md`, `docs/learned-builder.md`, `SPEC.md`. Numbers from `data/review/scratch/recommenders/numbers.cjs` (output in `numbers.txt` beside it).

## Auto-build in digital card games, and deck-building research

Several digital card games offer a button that finishes a deck: Hearthstone, Marvel Snap, Yu-Gi-Oh! Master Duel and Duel Links, Shadowverse, and Pokémon TCG Pocket. MTG Arena has none for constructed decks, and searches found none in four other games. Few say how their button works; Blizzard is the exception. Two older designs, Hearthstone's Deck Recipes and Magic Duels' Deck Wizard, start from a themed plan instead. The research splits in two: deck search by simulating games, and cheaper scoring by rules or by how often cards appear together in real decks.

Nearly everything here works inside a card set designed for the game, where every card is meant to be playable and millions of games show which decks are good. A bulk pool is the opposite: thousands of mostly weak cards and no play data for most of them. A score that rates single cards with no setup-and-payoff term invites the owner's Graveyard failure, payoffs without enablers. An independent Hearthstone test found such decks, though it cannot say which part of the builder chose them. Each idea at the end says whether a source shows it or it is our own. Claims were checked on 2026-11-08 and corrected after a fact check the same day; secondary sources are marked.

### Hearthstone: Smart Deck Builder ("Complete My Deck")

**What and where.** Blizzard's in-client deck completer, described by data scientist Tian Ding in [Developer Insights: Smart Deck Builder](https://hearthstone.blizzard.com/en-us/news/22938500/developer-insights-smart-deck-builder) (28 March 2019); [Patch 14.0](https://hearthstone.wiki.gg/wiki/Patch_14.0.0.29933) (4 April 2019) extended it. The player gives a class, any chosen cards, and their collection; it returns a 30-card Standard deck of owned cards.

**Plan.** The first layer, the "meta layer", clusters popular decks ("millions of variations of decks") into archetypes such as "Secret Hunter" or "Dragon Priest". Then, "combined with other mathematical solutions, the algorithm then dynamically fills your deck until the deck is full", or hands over to the second layer. Sub-layers pick different meta decks by player rank. The post does not say how the cluster is chosen, or whether cards are placed one at a time or in groups. From an empty deck, repeated requests give different decks.

**Cards.** The meta layer fills toward a popular deck of the matched archetype, so setup and payoff probably arrive together. That is our reading: Blizzard never says the layer copies or places packages. If the collection cannot fill 30 cards that way, a "back-fill layer" adds, one at a time, the card with the best per-class "card power": its win-rate impact, how its cost fits an unfilled slot, and penalties such as a full cost bucket. Card power "changes dynamically based on the deck's current composition", yet it is computed "without considering unique synergies and combo potential".

An [independent test](https://www.hearthstonetopdecks.com/complete-my-deck-how-good-is-netdecking-within-the-hearthstone-client/) (Old Guardian, 15 March 2019) found decks with payoffs and no enablers: Grand Archivist "but there were no spells", Lesser Emerald Spellstone in a deck "that had no Secrets", and Electra Stormsurge with no cards that synergize with her. The tester summed it up as cards "it considered powerful, but which could not function without synergy cards that were not present in the decks". The test came out two weeks before Blizzard described the two layers and does not say which layer chose these cards. The synergy-blind back-fill is a plausible cause, not a finding. Other failures point at the meta side: off-meta seeds were pulled toward known archetypes, and every attempt at a Mech Paladin came back as Odd Paladin or Secret Paladin.

**Mana, curve, interaction.** Hearthstone has no lands, so mana is only the curve. The back-fill is reluctant to add a card to a cost bucket that already holds 10 cards unless it is "significantly better than the alternatives". Blizzard also mentions "many quality assurance rules" within both layers, without saying how they were made; the example given is avoiding two-cost cards when Prince Keleseth is in the deck. Interaction is not mentioned.

**Data.** Ranked decklists in volume, plus per-card win-rate impact; Patch 14.0 says it needs "some time" after a set launches to gather data. Bulk Brew has decklists (1,441 precons and 54,000 17Lands draft decks with wins and games in `data/corpus/decks.json`, plus EDHREC pages) but no per-card win rates for constructed or Commander play.

**Speed, determinism, license.** Speed and where it runs are not stated (unverified). Not deterministic from an empty deck, by design. Proprietary; ideas only.

**Bulk on a phone.** A bulk pool rarely holds most of any known deck, so most builds would fall to the back-fill, the layer that ignores synergy. Our lesson: every layer that adds cards, including the fallback, must keep setup and payoff together.

### Hearthstone: Deck Recipes

**What and where.** Added in March 2016, per Blizzard's [Let's Get Brewing with Deck Recipes!](https://hearthstone.blizzard.com/en-us/blog/20056279) (8 March 2016). Each class has three designer-made lists: one "classic" recipe of Basic and Classic cards, and two "themed" recipes.

**Plan and cards.** Themed recipes "revolve around certain card types or mechanics" and "generally promote synergy between the cards included in the recipe". Examples are a Hunter deck built on Trap spells and a Shaman Murloc deck. The plan and the setup-to-payoff balance are the designer's. Missing cards are greyed out; clicking one opens "Suggest a Card", which "will help you replace it with a card from your collection". The post does not say how the substitute is chosen.

**Mana, data, speed, license.** Curve and interaction come with the hand-made list. No play data is named. How substitutes are picked, and how fast, is not stated. Proprietary.

**Bulk on a phone.** This is a hand-designed themed template filled from what the player owns, between Jumpstart's packets and the Smart Deck Builder. Each recipe assumes the player owns most of it, which a bulk pool rarely does, so the substitute step would carry most of the load.

### Marvel Snap: Deck Builder autofill

**What and where.** Second Dinner added autofill in the 5 December 2023 patch. The patch notes, as quoted by [Marvel Snap Zone](https://marvelsnapzone.com/autofill-deck-builder-guide/) (guide by "den", published 14 December 2023), say the builder "analyzes vast amounts of Data and Statistics from Live Games, taking your collection into account", and that its data "is updated regularly". The player picks 1 to 11 cards; it fills the 12-card deck.

**Plan and cards.** It appears to complete a known popular shell. The reviewer found it good when the seed fits "a popular shell of the metagame" from the last patch; otherwise it drops lone cards into shells they do not help. Asked for several cards, it builds around one, "typically the first", and ignores the rest.

**Mana, data, license, bulk fit.** Curve handling is not documented. Speed, and whether the same request gives the same deck, are not documented either. It needs live match statistics, which Bulk Brew lacks. Proprietary. Same limit as Hearthstone's meta layer: it works only where play data already defines the deck.

### Other games: Master Duel, Duel Links, Shadowverse, Pokémon TCG Pocket

These have auto-build buttons with almost no public method.

- **Yu-Gi-Oh! Master Duel** added Auto-Build in version 2.1.0 (7 November 2024). [Game8](https://game8.co/games/Yu-Gi-Oh-Master-Duel/archives/483223) says it generates a deck "with the help of AI, based on the Decks of players around the world". That points to decklists, not match statistics. "Build New Deck" makes one "completely at random"; "Add rest of the cards to this Deck" completes around chosen cards. No source tests how good its decks are (secondary source; Konami's own notice not found).
- **Yu-Gi-Oh! Duel Links**: Konami's [guide](https://www.konami.com/yugioh/duel_links/en/guide/) says "Create Auto-Deck" "will build a Deck for you". No method given.
- **Shadowverse**: the [official help](https://shadowverse.com/help) says: "Select a class character and a deck will be automatically created with the cards you own", a 40-card deck. After buying a prebuilt deck, "you are given the option to automatically create a full deck" from those cards plus the collection, a seed-completion mode. No method given. The page covers the original Shadowverse.
- **Pokémon TCG Pocket** (2024): a [Digital Trends guide](https://digitaltrends.com/gaming/best-tips-on-making-a-good-deck-pokemon-trading-card-game-pocket) (31 October 2024) says auto-build creates a deck "based on the Pokémon types of your choosing", and that it "won't always create the perfect deck" (secondary source; no official description found). Decks are 20 cards, per the [official Pokémon guide](https://www.pokemon.com/uk/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket). That is our 20-card size, on a phone.

**Bulk fit.** With no method published, only the interface carries over: build from scratch, complete around chosen cards, or, as in Pocket, let the player pick types first. Master Duel's reliance on players' decklists has the same limit as Hearthstone's meta layer.

Searches found no documented auto-build in Legends of Runeterra, Gwent, Eternal, or Pokémon TCG Live (absence not proven).

### Magic Duels: Deck Wizard

**What and where.** Magic Duels: Origins (Wizards of the Coast, July 2015, reviewed on iPhone and iPad) has a Deck Wizard. It is the one official Magic game in this survey that builds around an archetype. Only press guides describe it (secondary sources).

**Plan.** The player picks "a common deck archetype", such as Magical Armour (pumping creatures) or Control the Sky (flyers), per [Pocket Gamer](https://www.pocketgamer.com/magic-duels-origins/how-to-get-started-with-magic-duels-origins-our-beginners-guide/) (Matt Thrower, 8 July 2015). The plan comes first, then the cards.

**Cards.** The wizard "will then suggest cards to fit that archetype", and "It even does it in stages, so you can get a sense of how the suggested cards should work together". It "tries to steer you toward two colours". [GeekDad](https://geekdad.com/2015/07/magic-ios/) (14 July 2015) says the app scores a built deck "based on speed, strength, control, and synergy", and that a wizard deck cannot be edited outside the wizard once built. What each stage adds, and how the four scores are computed, is not described.

**Mana, curve, interaction.** "One thing the Deck Wizard doesn't do is watch the cost of your cards", per Pocket Gamer. Lands and interaction are not described.

**Data, speed, determinism, license.** Not described. Proprietary.

**Bulk on a phone.** The closest match to our flow: pick a plan, then add cards in stages. Stages could put setup before payoff, but that is our reading; the sources do not say what the stages hold. Its known gap, ignoring cost, is one a curve pass covers.

### MTG Arena: Jump In!, lands, and Quick Draft bots

**What and where.** I found no constructed auto-build in Arena. Jump In! is a pick-two-packets event much like paper Jumpstart, though neither source below links the two and the packets differ. Doug Beyer describes the paper design in [Behind the Scenes of Designing Jumpstart](https://magic.wizards.com/en/news/card-preview/behind-scenes-designing-jumpstart-2020-06-17) (17 June 2020). The [Duskmourn Jump In! update](https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-duskmourn-house-of-horror) (24 September 2024) gives Arena's event rules and packet lists.

**Plan.** The player picks one of three hand-designed themed packets, then one of three more, and plays "a combined deck with added basic lands". Second-packet options depend on the first, but only partly. For a one-color first pick, "All multicolor options will contain the color of the first packet selection"; monocolor options can be any color. Only after a two- or three-color first pick does the page say "No monocolor option will be outside of the first packet selection's colors". The plan is whatever the designers built into each packet.

**Cards.** Paper packets are "like miniature 20-card theme decks", each with "a flavorful theme and a mechanical heart". Each holds "lands and creatures, ways to interact with your opponent, powerhouse cards to help you close out the game, and a sensible mana curve", so any two packets make a complete deck. Some paper themes come in up to four variant lists that keep "the same general flavor, mana curve, and game plan". Setup and payoff fit because a designer put both in the same packet. In Beyer's words, "if you want to ease the load on the player, you have to put that load on the design work."

Arena's Duskmourn packets are smaller. Each lists 12 cards, and only 4 of the 10 include a land (packet lists checked against `data/packs/cards.json`). Each packet then has a "Variability" table: three or four slots draw one of two or three alternates at stated odds, for example Final Vengeance or Murder at 50% each. That is a shipped slot template: the slot holds a role, and the card in it varies.

**Mana, curve, interaction.** The sample paper Predatory packet has 8 lands (six Forests, a themed Forest, a Thriving land) and 7 creatures. Arena instead adds basics itself, "balanced for the costs and activated abilities on the spells in your packets", plus dual lands "in the colors appropriate to your deck", which are counted before the basics. Outside Jump In!, Arena's Suggest Lands button adjusts lands by the deck's color makeup, adding only basics, with 24 lands in Constructed and 17 in Limited by default. It is on by default and turns off when the player edits lands, per a [community guide](https://sites.google.com/view/asap-bg-to-mtga/using-arena) (community source).

**Draft bots.** [State of the Formats 2026](https://magic.wizards.com/en/news/mtg-arena/state-of-the-formats-2026) (Dave Finseth, 11 September 2026) says Wizards gathers "data on card picks" for a few days after a set launches to update the Quick Draft algorithm. The method is not described.

**Data, determinism, license, bulk fit.** Hand-designed packets and human pick data. Alternate slots are drawn at stated odds, so the same two packets can give different decks: not deterministic. How the basics are balanced is not described. Proprietary. The template is cheap and phone-friendly, but a bulk builder must fill it from weak cards itself.

### Research: deck search with a game simulator

**What and where.** Four papers search for decks by playing simulated games:

- García-Sánchez and others, [Evolutionary deckbuilding in Hearthstone](https://iris.polito.it/handle/11583/2666239) (CIG 2016): a genetic algorithm scored by simulated games against human-made decks. Abstract only.
- Chen and others, [Q-DeckRec](https://arxiv.org/abs/1806.09771) (CIG 2018): learns a card-swap search policy so new requests need no simulation.
- Fontaine and others, [MAP-Elites with Sliding Boundaries](https://arxiv.org/abs/1904.10656) (GECCO 2019): keeps the best deck per cell of a behavior grid.
- Kowalski and Miernik, [Arena deckbuilding using active genes](https://arxiv.org/abs/2001.01326) (CEC 2020): evolves draft policies for Legends of Code and Magic.

Fontaine and others cite two more:

- Bhatt and others, Exploring the Hearthstone deck space (FDG 2018): per Fontaine and others, evolves starter decks "by evaluating decks against a single AI opponent". Not read.
- Bjørke and Fludal, [Deckbuilding in Magic: The Gathering Using a Genetic Algorithm](https://hdl.handle.net/11250/2462429) (NTNU master's thesis, 2017), the one Magic-specific work found. The abstract describes "a system for automatic card selection using a genetic algorithm", judged by "an expert analysis". Fontaine and others group it with the evolutionary work above. How it scores a deck is unverified: the record was read, but the full-text download was refused.

**Plan.** None is chosen from the cards. Q-DeckRec targets one opponent deck. In MAP-Elites the play style (aggro or control) is set by the simulated player's heuristic, and decks are spread over two axes: average mana cost and its variance.

**Cards.** Synergy appears only through simulated win rate. Nothing models setup and payoff. Kowalski and Miernik represent a draft policy as one value per card (160 cards) and state that ignoring earlier picks removes "taking to account card synergies or controlling a mana curve".

**Mana, curve, interaction.** Left to the simulator, apart from the MAP-Elites curve axes.

**Data.** A full rules simulator with an AI player: [MetaStone](https://github.com/demilich1/metastone) (GPL-2.0) for Q-DeckRec, [SabberStone](https://github.com/HearthSim/SabberStone) (AGPL-3.0) for MAP-Elites. Bulk Brew has no simulator.

**Speed, determinism, license.** All Q-DeckRec timings come from a 56-core server, with "match simulations evenly spread on all cores". On it, scoring a deck with 300 simulated matches takes about 5 seconds; on one core that would be a few minutes (our estimate from the paper's wall and CPU times). A 25-minute genetic search used 15.9 CPU hours. After three days of training, Q-DeckRec solved a request in 0.38 seconds wall time (9.63 CPU seconds). MAP-Elites ran 10,000 evaluations of 200 games each on a 500-node cluster. All are stochastic. The pools were small and designed: 312 Warrior cards, each forced to two copies, in Q-DeckRec; 171 cards per class in MAP-Elites. Papers: arXiv non-exclusive license or IEEE/ACM copyright; the thesis is under copyright per the NTNU record. The MAP-Elites code, [EvoSabber](https://github.com/tehqin/EvoSabber), has no license on GitHub, so no reuse.

**Bulk on a phone.** Not usable: no simulator, and orders of magnitude too slow.

### Research: scoring without simulation

**What and where.** Stiegler and others, [Hearthstone deck-construction with a utility system](https://research-portal.uws.ac.uk/en/publications/hearthstone-deck-construction-with-a-utility-system/) (SKIMA 2016, DOI 10.1109/SKIMA.2016.7916192), abstract only. Betley, Sztyber and Witkowski, [Predicting winrate of Hearthstone decks using their archetypes](https://annals-csis.org/Volume_15/drp/pdf/362.pdf) (FedCSIS 2018), open PDF. Their decks came from the AAIA'18 data mining contest, described by Janusz and others in [Toward an Intelligent HS Deck Advisor](https://annals-csis.org/Volume_15/drp/pdf/386.pdf) (FedCSIS 2018 position papers).

**Plan.** Stiegler's abstract lists "strategic deck parameters" among its metrics; how a plan is chosen is unverified. Betley and others clustered the contest's training and test decks together, about 600 (400 training, 200 test), with a simple distance, (30 minus shared cards) divided by 30, using DBSCAN. The 11 clusters fall along hero classes (two each for Paladin and Warlock, one for each other class), with 25 decks left out. Each cluster had 5 to 10 cards that "appeared in almost every deck", such as a set of Murloc minions in one Paladin cluster.

Those clean clusters are built into the data. The contest decks "were created by randomly mutating a set of 13 deck archetypes" (12 top-rated ladder archetypes and one group of basic-card decks), per Janusz and others. So each cluster is roughly one seed deck plus noise. The authors asked whether the decks were random or "followed the pattern of human players decks", not how to find themes in real decks.

**Cards.** Stiegler's utility combines cost effectiveness, mana curve, card synergies, strategic parameters, and community popularity. It builds from scratch or fills holes in a deck skeleton; it was tested on holes in esports decks. Fontaine and others describe it as adding the highest-utility card, then recomputing the rest of the pool. How synergy is defined is unverified. Betley and others measured "card pair connection strength" from 2,821 popular decks. It is the quotient of how often two cards appear together and how often they appear at all (exact formula not given), averaged over all pairs in a deck. They used it to predict win rate, not to build.

**Mana, curve, interaction.** Stiegler has a curve metric. Betley and others count one-mana cards added or removed against the archetype deck.

**Data.** Popular decklists and card popularity. Bulk Brew has these: the corpus, EDHREC pages, and Spellbook combos.

**Speed, determinism, license.** Greedy fill with re-scoring is cheap and deterministic with fixed tie-breaks. No code was seen for either. Stiegler: IEEE; the FedCSIS pages state no license.

**Bulk on a phone.** The best fit in this family. The catch is sparsity: most bulk cards appear in few real decks, so pair counts are thin outside commons from recent draft sets. Betley's clusters say nothing about how well clustering works on decks that are not mutations of a few seeds, such as our precons and draft decks.

### Ideas worth borrowing

Each idea says whether a source shows it or it is our own, prompted by a source.

1. **Packages first, single cards last.** Ours. Mine setup-and-payoff packages from the corpus and EDHREC, place them as units, then fill. Prompted by Blizzard's two layers: the meta layer fills toward a popular archetype deck, and the back-fill scores cards alone without synergy. Blizzard does not say the meta layer places packages.
2. **The fallback keeps the dependency.** Ours. A payoff may enter only when enough separate enablers are already in, counted apart from the payoff. Prompted by the Hearthstone Top Decks test, which found payoffs such as Grand Archivist with no spells; it does not say which layer chose them.
3. **Small conditional rules.** Shown by Blizzard: its quality-assurance rules ("with Prince Keleseth, avoid two-cost cards") are if-this-then-require-or-avoid checks. Using a short per-theme list to catch dead payoffs is ours.
4. **Soft caps per cost bucket.** Shown by Blizzard's back-fill: refuse a card for a cost bucket that already holds 10 cards unless it is clearly better than the alternatives. A cheap curve control for greedy fill.
5. **A slot template for half-decks.** Shown by Jumpstart and Jump In!. Each paper packet holds lands, creatures, interaction, finishers, and a curve, with theme support and payoff inside it, and Arena's packets fill some slots from listed alternates. Building 20-card themed cores to a slot template and pairing two for 40 cards is ours. If the second core's colors should depend on the first, note that Jump In! bounds only the multicolor options after a one-color first pick (Beyer 2020; Arena Jump In! update 2024).
6. **Core cards from simple clusters.** Ours, untested. Clustering decks by shared-card count might define themes on the corpus without broad tags like `mill-self`. Betley and others found 5 to 10 near-universal cards per cluster, but their decks were mutations of 13 seed decks, so that result is not evidence the idea works on real decks (Betley, Sztyber and Witkowski 2018; Janusz and others 2018).
7. **Re-score after every pick, with a synergy term.** Shown by Stiegler and others 2016 (as described by Fontaine and others 2019) and by Blizzard's back-fill. Recomputing each remaining card's value after every addition lets an enabler's value rise once payoffs are in, and the reverse. Blizzard's card power also "changes dynamically based on the deck's current composition" yet ignores synergy, so re-scoring helps only if the score has a setup-and-payoff term.
8. **Diversity across curve cells.** Shown by Fontaine and others 2019 with a simulator: keep the best deck per cell of average cost and cost spread, not one overall best, to offer different shapes. Using it with a cheap scorer instead is ours.
9. **Plan first, then cards in stages.** Shown by Magic Duels' Deck Wizard and Hearthstone's Deck Recipes: the player picks an archetype or a themed recipe before any card is chosen, and the Deck Wizard suggests cards in stages. What the stages hold is not documented; ordering them setup before payoff is ours.
10. **Basics from the spells.** Shown by Jump In!: Arena balances basics "for the costs and activated abilities on the spells in your packets", after counting nonbasics. Worth comparing with `lands.ts` (Arena Jump In! update 2024).

### Sources

All read 2026-11-08.

- Blizzard, Developer Insights: Smart Deck Builder, https://hearthstone.blizzard.com/en-us/news/22938500/developer-insights-smart-deck-builder. Proprietary; no license stated.
- Blizzard, Let's Get Brewing with Deck Recipes!, https://hearthstone.blizzard.com/en-us/blog/20056279. Proprietary; no license stated.
- Hearthstone Wiki, Patch 14.0.0.29933, https://hearthstone.wiki.gg/wiki/Patch_14.0.0.29933. CC BY-NC-SA 4.0 unless otherwise noted, per the page footer; ideas only.
- Hearthstone Top Decks, Complete My Deck test, https://www.hearthstonetopdecks.com/complete-my-deck-how-good-is-netdecking-within-the-hearthstone-client/. No license stated.
- Marvel Snap Zone, Autofill Deck Builder Guide, https://marvelsnapzone.com/autofill-deck-builder-guide/. No license stated.
- Game8, Master Duel update page, https://game8.co/games/Yu-Gi-Oh-Master-Duel/archives/483223. No license stated.
- Konami, Duel Links guide, https://www.konami.com/yugioh/duel_links/en/guide/. Proprietary.
- Cygames, Shadowverse help, https://shadowverse.com/help. Proprietary.
- Digital Trends, How to make a good deck in Pokémon Trading Card Game Pocket, https://digitaltrends.com/gaming/best-tips-on-making-a-good-deck-pokemon-trading-card-game-pocket. No license stated.
- The Pokémon Company, Learn How to Build a Deck in Pokémon TCG Pocket, https://www.pokemon.com/uk/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket. Proprietary.
- Pocket Gamer, Magic Duels: Origins beginner's guide, https://www.pocketgamer.com/magic-duels-origins/how-to-get-started-with-magic-duels-origins-our-beginners-guide/. No license stated.
- GeekDad, Magic Duels on iOS, https://geekdad.com/2015/07/magic-ios/. No license stated.
- Wizards of the Coast, Behind the Scenes of Designing Jumpstart, https://magic.wizards.com/en/news/card-preview/behind-scenes-designing-jumpstart-2020-06-17. Proprietary.
- Wizards of the Coast, Jump In! Packets Update for Duskmourn, https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-duskmourn-house-of-horror. Proprietary.
- Wizards of the Coast, MTG Arena State of the Formats 2026, https://magic.wizards.com/en/news/mtg-arena/state-of-the-formats-2026. Proprietary.
- ASAP Beginner's Guide to MTG Arena, https://sites.google.com/view/asap-bg-to-mtga/using-arena. Community source; no license stated.
- García-Sánchez and others, Evolutionary deckbuilding in Hearthstone, IRIS record https://iris.polito.it/handle/11583/2666239. All rights reserved per the record.
- Chen and others, Q-DeckRec, https://arxiv.org/abs/1806.09771 (full PDF read). arXiv non-exclusive distribution license 1.0.
- Fontaine and others, MAP-Elites with Sliding Boundaries, https://arxiv.org/abs/1904.10656 (full PDF read). arXiv non-exclusive distribution license 1.0; ACM copyright in the PDF.
- Kowalski and Miernik, Arena Deckbuilding using Active Genes, https://arxiv.org/abs/2001.01326 (full PDF read). arXiv non-exclusive distribution license 1.0.
- Bhatt and others, Exploring the Hearthstone deck space, FDG 2018. Not read; cited from Fontaine and others.
- Bjørke and Fludal, Deckbuilding in Magic: The Gathering Using a Genetic Algorithm, https://hdl.handle.net/11250/2462429 (record and abstract only; full text refused). Copyright act per the NTNU record.
- Stiegler and others, Hearthstone deck-construction with a utility system, https://research-portal.uws.ac.uk/en/publications/hearthstone-deck-construction-with-a-utility-system/ (abstract only). IEEE; license not shown.
- Betley, Sztyber and Witkowski, Predicting winrate of Hearthstone decks using their archetypes, https://annals-csis.org/Volume_15/drp/pdf/362.pdf (full PDF read). No license stated.
- Janusz and others, Toward an Intelligent HS Deck Advisor: Lessons Learned from AAIA'18 Data Mining Competition, https://annals-csis.org/Volume_15/drp/pdf/386.pdf (deck-origin passage read). No license stated.
- EvoSabber, https://github.com/tehqin/EvoSabber. No license (GitHub API).
- SabberStone, https://github.com/HearthSim/SabberStone. AGPL-3.0 (GitHub API).
- MetaStone, https://github.com/demilich1/metastone. GPL-2.0 (GitHub API).

## Bulk Brew's builder

Our own builder is the last entry, written in the same format by reading `packages/core/src` and `config/` and by building decks from the public pools. `docs/review/our-builder.md` covers how it picks a plan and cards, its mana, data, speed, and every way a card can get in for a reason unrelated to how the deck plays. `docs/review/our-builder-themes.md` builds 24 requested-style 60-card decks across 10 themes and reads every counted setup and payoff card. The builder is deterministic by construction and takes about 50 ms per requested build on desktop, but the Build page makes up to 36 builds per request.

From `our-builder.md`:

1. **Setup and payoff are counted, not fitted.** Membership is a yes-or-no tag match that cannot say how much, and a card that is both setup and payoff counts on both sides everywhere: the fill, the tiebreak (worth 2), the swap guard, the scan, and the deck score. The only balance-shaped term is the hand rules' min(enablers, payoffs), at a quarter weight under learned selection.
2. **Most off-plan cards enter through the swap search, not the fill passes.** With the swaps off, most of the off-plan cards in the sample decks were absent, so the swap objective (theme hits, a learned tag fit that counts a tag and its parent tag, role credit on riders, and the drift penalty) is where a redesign should aim first.
3. **The learned data and the deck score inherit the flaw.** Real decks are assigned to plans and measured with the same matchers, the Graveyard profile at 60 rests on only 12 decks, and the learned tag fit rates `mill-self` (4.88) above `loot` (1.98).

From `our-builder-themes.md`:

1. **The Graveyard failure is common.** All 24 decks meet their style's minimums by the builder's count, but only 8 to 10 do when counting cards that really do the job, and 7 have no plan for the theme they are named after. Graveyard, Aristocrats, and +1/+1 counters fail most; themes whose setup is a card type mostly work.
2. **Tags are only half the cause.** Tags that mean something else (`graveyard-fuel-self`, `counters-matter`, Treasure and Food outlets) count as theme cards, and the builder then pushes them in: theme value breaks ties before strength with a dual card worth 2, learned targets fill well past the minimums, and the swap guard keeps them. In the green pool, 3 Sylvan Hierophant outranked Circle of the Land Druid, which is real setup.
3. **Not every failure is the builder's.** Theme cards' conditions are never checked against the deck (Ajani's Comrade with no Ajani), cards that work against the theme count for it (Barishi shuffles the graveyard away), and some pools lack real setup (white-bulk has nothing for Graveyard beyond surveil 1 and the like) while the scan still calls them viable. A builder fix alone will not mend every deck.
