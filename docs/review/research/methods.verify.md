# Fact check: General methods for choosing a set of cards

Checked 2026-11-08 against `docs/review/research/methods.md`. I opened each cited source and the Bulk Brew code and data. Copies of the PDFs and their text are in `data/review/scratch/verify-methods/` (gitignored).

## Verdict

**Needs fixes.** The citations hold up well. Almost every number, author list, and license I could open matches its source. The problems are in the section's own reasoning about our builder. Its headline finding (single swaps are trapped behind a "dip" that tabu or package moves can cross) does not match the objective and matchers we actually ship. It also leaves out that our objective already has a setup-payoff balance term. Both can be fixed without a rewrite.

## Issues

### Reasoning about our builder

- **Claim:** "In a deck of payoffs that each mill one card, swapping one for a real looter lowers the payoff count and raises setup by one; if the objective counts tags, that scores worse, so the search stays. Tabu memory or package swaps cross that dip." The summary repeats this as finding 1.
  - **Problem:** The mechanism is wrong for the builder we ship, so the fix it points to is unsupported.
    - Under the Graveyard style, a plain looter is not setup at all. Loot, rummage, and discard outlets count only alongside a graveyard payoff tag. The rider payoff counts as both setup and payoff. Swapping it for a looter lowers setup by one and payoff by one. It does not raise setup.
    - Under the hand-written `graveyard` synergy rule the looter does count as setup, so rule setup stays level and rule payoff drops by one.
    - Either way, nothing in the current objective rewards the far side, so there is no dip to cross. A two-for-two swap (two rider payoffs out, one looter and one pure payoff in) also scores worse: setup minus 2, payoff minus 1 by the style count.
    - Tabu, annealing, and package moves only help when the objective already prefers the engine deck. That is the brief's own diagnosis: definitions and double counting, not the search.
  - **Evidence:** `config/archetypes.json`, style `graveyard`: `enablers` lists `loot`/`rummage`/`discard-outlet` only with `allTags` of `castable-from-graveyard`, `cards-in-graveyard-matter`, `reanimate`, `recursion-creature`, or `activate-from-graveyard`. `config/synergy-rules.json`, rule `graveyard`: the enabler tags include `loot`, `rummage`, `discard-outlet`. `packages/core/src/builder.ts` lines 418-421 add a dual card to both `pe` and `pp`. `docs/algo-review.md` "Why it strings random cards together", causes 2 and 3.
  - **Severity:** wrong (the mechanism); misleading (tabu and package moves offered as fixes on a par with an objective change).

- **Claim:** The three ways to say "setup must feed payoff" ("pairwise terms", "set-level resource terms", "sequential seeding"), the description of "Our builder today", and idea 1 ("Resource balance as one linear line ... penalise supply short of a ratio of demand").
  - **Problem:**
    - The section never says that our objective already has a set-level balance term. For each synergy rule it adds `weight × min(enablers, payoffs)`, and `min(pe, pp)` when the style has pairs. That pays for setup while setup is short, at a 1:1 ratio.
    - It fails on Graveyard because a dual card adds to both sides, and because the style matchers leave real setup out. A missing balance term is not the cause.
    - Idea 1 is therefore a change to an existing term: count each card once, weight supply, and use a ratio other than 1. The section presents it as a new term. The section should say so, or it will mislead the shortlist.
  - **Evidence:** `packages/core/src/builder.ts` `synergyPairs` (lines 485-494) and `objectiveOf` line 521. `config/builder-weights.json`: `synergyDensity` 1.5, `rules` 0.25 per size under learned selection.
  - **Severity:** missing.

- **Claim:** The swap search runs "never dropping a theme count below its minimum".
  - **Problem:** The guard holds the theme at the larger of the style minimum and the fill target for the current slot count, not at the minimum.
  - **Evidence:** `packages/core/src/builder.ts` lines 1436-1441 (`ctx.themeWant.pe = Math.max(theme.want.enablers, t.enablers)`) and the guard at lines 1001-1013.
  - **Severity:** misleading (small).

- **Claim:** Genetic speed: "50 by 200 is 10,000 whole-deck evaluations, about 100 swap passes (estimate)". The comparison table rates genetic search "Slow", and the summary says it is the weakest for speed.
  - **Problem:**
    - The population of 50 comes from no cited work. García-Sánchez et al. used a population of 10 with 10 offspring per generation, which over 200 generations is about 2,000 evaluations.
    - The conversion to swap passes is not shown, and it does not match the code. One pass with no improvement tries every distinct chosen spell against every pool spell. For a 3,000-card two-color pool that is roughly 35 × 1,000 = 35,000 objective evaluations, so 10,000 evaluations is less than one pass.
    - A whole-deck rescore costs more than our incremental tally, so the gap may narrow. Still, "Slow" for a genetic search on a rule objective is not shown. The slowness in the literature comes from game simulation.
  - **Evidence:** García-Sánchez manuscript, Table 4 (population 10, operators applied 10, generations 200). `packages/core/src/builder.ts` `localSearch` lines 984-1031 (outer loop over chosen ids, inner loop over `ctx.spells`). `spells = cands.filter((c) => c.facts.spell)` at line 1360.
  - **Severity:** unsupported.

### Data claims

- **Claim:** "Draft decks never pair cards across sets and bulk is cross-set, so card-level draft pairs transfer poorly; only the 1,441 precons and EDHREC cover cross-set pairs."
  - **Problem:**
    - The counts are right: 54,000 draft decks, 3,000 from each of 18 sets; precons 680 + 510 + 51 + 200 = 1,441.
    - "Never" is too strong. Cards are keyed on oracle id, and 112 oracle ids appear in more than one draft environment (reprints and basics). A reprint-heavy set such as FDN pairs cards whose printings span many older sets.
    - The real limit is coverage: the draft decks hold only 5,195 distinct oracle cards. That number is the useful one to report.
  - **Evidence:** a node count over `data/corpus/decks.json` (2026-11-08): sources `draft size=40: 54000`, `precon` 680/510/51/200, `local size=100: 5`; 5,195 distinct draft oracle ids, 112 seen in two or more set environments.
  - **Severity:** misleading (small).

- **Claim:** "Tag-level pairs generalise better", and idea 7 ("Directional, tag-level co-occurrence").
  - **Problem:** The section reads as if tag-level pairs would be new. We already ship 691 tag-level lift pairs in `config/learned/tags.json` (`pairs`), next to 908 card-level pairs in `data/learned.json`. The new part of idea 7 is the direction (setup tag given payoff tag) and the amount, and the section should say that.
  - **Evidence:** `config/learned/tags.json` keys `version`, `fit`, `pairs` (691 entries, for example `["lifegain","lifegain-matters",4.84]`). `docs/learned-builder.md` lines 120 and 148.
  - **Severity:** missing.

- **Claim:** The co-occurrence entry's "Data" line lists draft decks and precons only as co-occurrence sources.
  - **Problem:** The brief asks each entry to say whether we have "17Lands draft decks with wins". Every draft deck in the corpus carries `wins` and `games`. That lets us weight co-occurrence by winning decks, or compare pairs in winning and losing decks, which partly separates synergy from mere co-play. The entry leaves this out.
  - **Evidence:** `data/corpus/decks.json`, first draft deck: `"wins":7,"games":9`. `docs/algo-review.md` Phase 1 format list.
  - **Severity:** missing.

### Claims about sources

- **Claim:** "With all weights and profits equal to one it is the densest k-subgraph problem, and even with unit weights it cannot be approximated within a constant factor in polynomial time (Galli, Martello and Toth 2025, citing Pisinger et al. 2007 and Fomeni and Letchford 2014)."
  - **Problem:** This follows the survey, but it overstates what is known on two points.
    - The densest k-subgraph equivalence holds in the survey's graph setting, where pair profits sit only on a graph's edges. Read without that condition, "all profits equal to one" makes every k-set score the same.
    - The hardness result the survey leans on, Khot (2006), rules out an approximation scheme (a PTAS) under a complexity assumption. It does not rule out a constant factor, and it is conditional. The survey also reports an approximation algorithm with a ratio of n to the power of about 2/5 (Taylor 2016).
    - None of this changes the section's conclusion that we need a heuristic.
  - **Evidence:** survey text, Section 5: "Fomeni and Letchford (2014) observed that the results by Khot (2006), which rule out the existence of a Polynomial Time Approximation Scheme (PTAS)..." and "Pisinger et al. (2007) observed that the special case ... where the weights and profits are all one is equivalent to the densest k-subgraph problem", in the graph setting with profits on edges. Khot, SIAM J. Computing 2006, https://epubs.siam.org/doi/10.1137/S0097539705447037: no PTAS, assuming NP is not in BPTIME(2^(n^ε)).
  - **Severity:** misleading (small).

- **Claim:** "Sephton et al. (2016) complete Netrunner decks greedily", listed among greedy builders.
  - **Problem:** The numbers are right: 6,000 decklists, up to 59% from 5 seen cards, and copy counts depend on the card more than the deck. But the task is predicting an opponent's hidden deck, scored by overlap with the real list, not building a good deck. The entry should say so.
  - **Evidence:** https://eprints.whiterose.ac.uk/104807/1/2016_CIG_RuleMining.pdf, title "...to Predict Opponent Deck Content..."; Section V: "completing decks with an accuracy of up to 59% from viewing only 5 cards".
  - **Severity:** misleading (small).

- **Claim:** "Levy and Goldberg (2014) show skip-gram embeddings implicitly factorise a shifted PMI matrix, so card2vec is smoothed PMI."
  - **Problem:**
    - The Levy and Goldberg result is right.
    - "card2vec" is not cited anywhere, so the reader cannot tell which project is meant.
    - The very next model, MTG-GloVe-Commander, is GloVe, not skip-gram. The PMI link carries over only loosely, so the text should not imply it applies directly.
  - **Evidence:** NeurIPS 2014 abstract (via https://proceedings.neurips.cc/paper/2014/hash/b78666971ceae55a8e87efb7cbfd9ad4-Abstract.html; the papers.nips.cc host refused connections): SGNS factorises a word-context PMI matrix shifted by a global constant. Model card: https://huggingface.co/nishtahir/mtg-glove-embedding-commander ("trained with Weighted Least Squares").
  - **Severity:** unsupported (small).

- **Claim:** "An ICDM workshop paper (2018) reports deck co-occurrence improved text-based card similarity in Hearthstone and Clash Royale (abstract only)."
  - **Problem:** The content matches the abstract, but the citation names no authors. They are Janusz, Grad and Ślęzak, ICDM Workshops 2018, pages 422-429. A 2022 Information Sciences follow-up (SENSEI) by the same group is not mentioned.
  - **Evidence:** https://researchr.org/publication/JanuszGS18; catalog record at the searchworks link the section cites.
  - **Severity:** missing (small).

- **Claim:** Hernandez "notes the model ignores card interactions and is 'more naturally solved using quadratic programming'."
  - **Problem:** The quotes are accurate and appear next to each other. The page also says he wrote a quadratic version "but getting it to work required proprietary libraries". That backs the section's point about solver dependencies and is worth adding.
  - **Evidence:** https://troyhernandez.com/2018/09/28/optimizing-magic-the-gathering-in-r/
  - **Severity:** missing (small).

### Omissions in the family

- **Claim:** "MTG-GloVe-Commander ... reads no card text, so new cards get no vector", and the summary's point that co-occurrence can't carry cross-set pairs.
  - **Problem:** The section skips the best-known Magic work on this exact gap. Bertram, Fürnkranz and Müller (IEEE CoG 2024, best paper nominee) build card representations from numbers, types, text, and images. They report that the input form barely matters for known cards but helps a lot on unseen ones: 55% of human picks matched on completely unseen cards. That is a direct route to giving bulk cards from any set a learned signal through their text.
  - **Evidence:** https://arxiv.org/abs/2407.05879 (CC BY 4.0 per the arXiv page).
  - **Severity:** missing.

- **Claim:** "The genetic deckbuilders that find engines rely on game simulation, which we lack."
  - **Problem:** The section skips the direct follow-up to Fontaine et al. In Deep Surrogate Assisted MAP-Elites (Zhang, Fontaine, Hoover, Nikolaidis, GECCO 2022), a learned model stands in for most of the simulation. That weakens "needs a simulator". A model trained offline, for example on the 17Lands decks with wins, is the analogue for us.
  - **Evidence:** https://arxiv.org/abs/2112.03534
  - **Severity:** missing.

- **Claim:** The greedy entry: "greedy cannot see that a payoff is worthless until six setup cards join it."
  - **Problem:** The entry gives no theory for when greedy works. The classic result: greedy is within 1 − 1/e of the best when the objective has diminishing returns (monotone submodular) under a size limit (Nemhauser, Wolsey and Fisher 1978). Setup and payoff are complements, so increasing returns break that guarantee. That is the formal reason behind the section's own point, and a design rule: concave terms in the objective keep greedy safe.
  - **Evidence:** Mathematical Programming 14 (1978) 265-294, DOI 10.1007/BF01588971 (bibliographic record and result confirmed via https://devel.isa-afp.org/entries/Submodular_Greedy.html).
  - **Severity:** missing.

- **Claim:** Idea 2, "Package moves ... This leaves the 'payoffs with riders' optimum that one-for-one swaps cannot."
  - **Problem:**
    - As shown above, under the current objective that deck is not a trap that bigger moves can leave.
    - Where package moves do help, the standard deterministic framework is Large Neighbourhood Search: remove a related group of items and rebuild them greedily (Shaw 1998). The section does not name it, and it fits "pull a payoff and its setup out, then refill" better than two-for-two swaps.
  - **Evidence:** Shaw, CP 1998, LNCS 1520, https://link.springer.com/doi/10.1007/3-540-49481-2_30
  - **Severity:** missing (and misleading for the claimed effect).

## Checked and confirmed

- **Galli, Martello, Toth.** EJOR 326 (2025) 1-12, CC BY-NC-ND (Crossref and the article footer). Hammer and Rader (1997) use the best linear approximation, add the item with the best ratio, then do inserts and exchanges. Glover et al. (2002) is the first metaheuristic, a tabu search. Exact methods reach up to 1,500 items (Pisinger et al. 2007).
- **García-Sánchez et al.** Knowledge-Based Systems 153 (2018) 133-146 (Crossref); manuscript under CC-BY-NC-ND 4.0. Confirmed details:
  - 16 games against each of 8 human decks (128 per evaluation);
  - lexicographic order: errors, then wins, then spread of wins;
  - population 10, 200 generations;
  - Smart Mutation within plus or minus 1 mana, chosen at random;
  - about 30 days per run;
  - evolved decks beat the human decks.
- **Q-DeckRec.** 9.63 s CPU (0.38 s wall) per instance after 1 to 3 days of training. The genetic baseline took 6.2 to 15.9 CPU hours. Each evaluation is 300 matches, about 5 s. arXiv non-exclusive license.
- **Fontaine et al.** The grid axes are average mana cost and its variance. 10,000 evaluations of 200 games each. arXiv non-exclusive license.
- **Goodman-Wilson, magique.** No simulation. Fitness covers the curve, type targets, creature stats, and hand-tagged synergies in `data/annotations.json`. Without synergy the article calls the result "a pile of cards". 0-7 at the February 2018 Dutch Standard Open. HackerNoon, 2018-06-01. The repo has no license (GitHub API `license: null`).
- **Hernandez.** lpSolve, 23 spells, creature curve slack with a linear penalty, at least 4 removal, one solve per color pair, Guilds of Ravnica sealed. The MTGcsv repo has no license (GitHub API).
- **Kowalski and Miernik.** The genotype is a vector of 160 card priorities with no pair terms. The repo is MIT (GitHub API).
- **Kirkpatrick et al.** Improvement-only search is "like extremely rapid quenching", and its results are "usually metastable"; Metropolis acceptance uses exp(-ΔE/kT).
- **Sephton et al.** 6,000 decklists, Apriori rules, greedy completion ranked by how many rules are active, copies "more dependent on the nature of the card". White Rose "all rights reserved" notice.
- **MTG-GloVe-Commander.** `embedding_dim` 128, `vocab_size` 25,932 (this includes the unknown token), 6,690,456 float32 parameters (two matrices plus biases), so one matrix is about 13.3 MB. More than 5M pairs and no rules text, per the card. MIT. The training source is not stated.
- **Bjørke and Fludal.** The NVA record matches the title, the 2017 date, and the abstract. The license is the Norwegian copyright act. The full-text download returns 403 (`{"message":"Forbidden"}`), so the fitness and results remain unverified, as the section says.
- **Our builder.** First-improvement swaps over sorted chosen ids, 3 passes, 200 swaps per pass. No `Math.random` anywhere in `packages/core/src`. The learned pairs use lift (`docs/learned-builder.md`). The EDHREC pages we store hold raw lift (15,908 values from 0.14 to 1,633, none negative), although edhrec.com displays log-lift.
- **Copying.** There are no code blocks, and the longest quote is a seven-word phrase. Nothing was copied from another project.

## Process note

The artifact named in the summary (https://claude.ai/artifact/4FsHUwXT5xQewTbKd82xe2) exists and is private. It holds an earlier draft of this research text, for example the older wording "With equal weights it is the densest k-subgraph problem". I saw no owner pool data in it. I did not change or delete it.
