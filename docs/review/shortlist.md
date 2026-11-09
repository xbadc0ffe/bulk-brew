# Shortlist: the algorithms to prototype

Written 2026-11-08 by the coordinating session from `docs/review/research.md` (the ranked ideas and the comparison tables), `docs/review/our-builder.md`, and `docs/review/our-builder-themes.md`. A fresh agent argued against this list before it was final; its objections and what changed are at the end.

## What the evidence says

- The failure is in what the builder counts, more than in how it searches. Setup and payoff membership is a yes-or-no tag match with no amount, a card that is both counts on both sides in every layer (fill, tiebreak, swap guard, scan, deck score), and the only balance term is min(enablers, payoffs) at a quarter weight. Of the 24 requested-style decks checked on public pools, all 24 meet the builder's minimums and only 8 to 10 meet an honest count; 7 have no plan for the theme they are named after.
- Most off-plan cards enter through the swap search, so the objective is where a redesign should aim first.
- No other system we read does setup-payoff balance well either. Forge's provides-and-wants hints have the right shape but no amounts; Hearthstone's back-fill leaves lone payoffs; co-occurrence models have no direction. The ideas that would fix it (count once with supply and demand, gate payoffs on separate setup, slot-based filling, lexicographic plan-before-strength scoring) are cheap, deterministic, and need only data we have.
- Integer programming states the balance best but needs a solver and has no time bound; genetic search and simulation are too slow or need a game engine; learned models (CubeCobra, mtgml, mtgdraftbots) are too big for a phone and cover only draft-era cards. None of these can ship.
- Plain decks matter. The goal counts a plain Aggro, Midrange, or Control deck with a working curve as decent, the failed themed decks already play as midrange piles, and the web's first option is Midrange or Aggro on several public pools. A themed deck should have to beat the plain deck the same pool makes.

## The four prototypes

All four take `build(pool, request, seed)` through the shared runner, are deterministic, use no network, add no dependencies, report build time, and import from `@bulk-brew/core` without changing it. All four read setup and payoff jobs from `theme-rules.json`, the machine form of `docs/review/themes.md`, so the comparison is between algorithms and not between definitions.

### A. Honest definitions on the current builder, plus repair

The current `buildDeck`, given a config object whose style matchers are rewritten from the theme guide (jobs, repeatable against one-shot, false friends excluded), followed by a deterministic repair pass: count setup and payoff once each with supply and demand, and while the deck is short of setup per payoff, swap the weakest rider or dual card for the best real setup card the pool holds in the deck's colors, keeping roles, curve, and lands legal. Nothing in `packages/core` or `config/` changes; the prototype passes its own config.

Why: it answers the brief's question of how much of the problem is definitions rather than algorithm, at the lowest cost, on the algorithm that ships today. It also shows what a config-only fix could deliver next week. Ideas 1, 2, 8 from the research.

Risk: dual counting lives in the code, not the config, so the rewritten matchers can only approximate "count once" by excluding payoff tags from the setup clauses; the repair pass carries the rest.

### B. Seed and grow

Build the way a person does. Pick the plan from honest counts (the theme whose payoffs the pool supports best, or a plain shape when none does). Seed the payoffs the pool supports best, up to the guide's count for the size. Grow setup in proportion to what those payoffs demand, re-scoring each candidate against the deck so far (supply still needed, cast chance, strength). Then interaction and card advantage to the role minimums, then creatures and spells by mana value slot to the curve profile, each card competing only for the slot of its job. Then lands from the core's formula. A payoff never enters unless the setup already in the deck covers it.

Why: it puts the payoff gate and slot-based ranking in the fill itself, so a rider cannot fill a setup slot and a payoff cannot arrive alone. Ideas 3, 4, 5 from the research, with CubeCobra's seed-then-fill and the EDHREC average deck's type slots as the models.

Risk: greedy fill has no guarantee when setup and payoff are complements; the order of passes decides, and a thin pool may stall after the seeds. The plain-shape fallback (D) covers the stall.

### C. Supply and demand with local search

A new objective and a new search. Each card produces or consumes its theme's resource with a weight from the theme rules. The objective is lexicographic: legality, then plan health (setup supply short of payoff demand, payoffs with no setup, cards whose conditions the deck does not meet), then roles and curve, then card strength and learned pairs. The search starts from B's deck or from a greedy fill, then swaps within a neighbourhood (same mana value or same job first), moves setup and payoff as a package (pull a payoff and its setup out together and refill), and keeps a short tabu list so it crosses dips without randomness. A move cap keeps it under the time budget.

Why: it keeps what the current builder does well (a swap search over a rich objective) and fixes the two things the review found wrong with it: the objective does not prefer the engine deck, and strength can trade a setup card away. Ideas 2, 7, 11 from the research.

Risk: more code than A or B and the easiest to tune to the test pools. Its reviewer must look for that.

### D. Plain shapes from slot templates

Aggro, Midrange, and Control built from slot templates: creatures by mana value, removal, card advantage, finishers, and lands by the core's formula, ranked by card strength within each slot, with 17Lands card win rates as an extra quality signal at 40 cards where the set is covered (computed offline from the corpus in `prepare()`, never at build time). No theme. For a pool and colors it returns the best of the three shapes by a template-fit score.

Why: the baseline a themed deck must beat, and a candidate for best fit on pools whose themes are thin. XMage's `LimitedDeckBuilder`, Draftsim's autobuild, and MTGA_Draft_17Lands all build this way. Idea 9 from the research, and the finding that most of our failed themed decks play as midrange piles anyway.

Risk: it can only ever be decent, never good; and it needs the panel to confirm that plain decks from bulk really read as decent.

(Dropped after the objections below: the current builder already builds the three shapes by name, so the baseline comes from requesting them.)

## Left out, and why

- Integer programming: needs a solver (a new dependency) and has no time bound. Its balance constraint is borrowed into A and C as a penalty.
- Genetic and evolutionary search: needs a seeded generator and an evaluation cap, and the research found it strong only with a simulator or a trained surrogate, neither of which we have; on a rule objective it has not been shown better than a swap search.
- Learned pick or build models (CubeCobra, mtgml, mtgdraftbots, Saxe): tens of megabytes, draft-era cards only, TensorFlow.
- Simulation (Forge's GA, Legends of Code and Magic, MAP-Elites with a game): no engine on the device, far too slow.
- Co-occurrence as a builder: no direction and no amounts, so it rewards theme cards together without saying which feeds which. Directional tag co-occurrence from real decks (idea 10) stays as an offline way to size setup per payoff for the theme rules, if the theme guide's numbers need checking.
- A 40-card pick-order build from 17Lands as its own version: folded into D as a quality signal, since the pick model and the build model differ and only the build model matters here.

## How the comparison will read

Each prototype runs on the same jobs as head, head-web, and 26.0.30. The report compares them on the shared best-fit subset and per requested style, on decent rates from the blind panel, with declines reported separately, and with the automatic checks as gates only. A prototype that wins by being slow, nondeterministic, or tuned to the test pools is not a winner; the reviewers of B and C are told to look for tuning.

## The argument against, and what changed

A fresh agent read the list and the evidence and argued against it in `docs/review/shortlist-objections.md`. What it said, and the decision on each:

1. **A cannot be done through the config.** The config's matcher clauses (`MatcherClause` in `packages/core/src/config.ts`) match tags only, never oracle text, and there is no tag for repeatable self-mill, so the Graveyard engine, the motivating case, is the one a config-only A handles worst. Counting a card once would need synthetic tags in the card index, which ships through a data pack, not a config change. **Accepted.** A becomes A': a copy of the current builder's code inside the prototype folder (the core itself is unchanged), with the honest objective written in code: each card counted once with supply and demand from the theme rules, a balance penalty in place of min(enablers, payoffs), and the payoff gate in every pass that adds cards, including filler and curve picks. The config-only arm is dropped.
2. **C overlaps A' and B.** Started from B's deck it measures only strength polishing; started from a fill it is A's repair pass; and the research says search moves help only once the objective prefers the engine deck. **Accepted, as a merge.** C's lexicographic ordering, package moves, and tabu memory become a second variant of A' (`a-search` beside `a-objective`), from one codebase, so the comparison still shows whether the search changes add anything.
3. **D duplicates the current builder.** HEAD builds Aggro, Midrange, and Control and can be asked for them by name, and the 17Lands signal reaches only about 17% of the cards in the plain pools, at 40 cards only. **Accepted.** D is dropped. The plain baseline comes from requesting the three shapes by name from every version (the request generator excluded them; it now includes them), which also gives the "a theme must beat the plain deck" comparison for free.
4. **Every prototype, the honest check, and the rubric's guide counts lean on one `theme-rules.json`.** If the guide is wrong for a theme, everything fails together, and the guide's own checkers found rider-style errors (a lifegain pattern that matched Food reminder text). **Accepted in two parts.** Before any prototype reads the rules, they are run over the real decks (the 170 anchors and the corpus by style) and a theme whose real decks mostly miss the guide's minimums is re-examined. B also gets a variant that uses the current matchers instead of the rules (`b-oldrules`), so definitions and algorithm can be told apart. Theme counts from the rules are never cited as evidence that a prototype is better; the panel is.
5. **The test has slants.** Packets hide the requested style and the rubric lets a plain deck be decent, so a Graveyard request answered with a midrange pile could pass; styles and commanders come from HEAD's scan; theme pools are enriched with cards HEAD's matchers accept; every request below 100 is mono-color; and no pools are held back from the builders. **Accepted where cheap.** A styled request whose deck is not that style counts as a decline in collation. A two-color slice at 60 and 40 is added on the plain pools. Prototype authors may develop against plain-01 to plain-10 and the public pools only; plain-11 to plain-30 and the theme pools are held out for judging. Builder-neutral enrichment (EDHREC synergy-weighted) is recorded as a later pass; commanders stay as they are, since every version gets the same ones.
6. **No prototype decides which plan the user sees first.** The web's first option is a deck-score ranking over every viable style and leans to Midrange and Aggro. **Noted, not added.** Each prototype's best-fit deck is its own plan choice, and best-fit pairs against `head-web` are the plan-choice test this session can run. A plan picker that ranks options by plan health is the first item of the next phase, not a fifth prototype.
7. **Unsupported lines.** The objection lists five sentences the cited evidence does not support, among them "real draft decks are mostly this" and "genetic search is too slow". The first is removed from D's justification above; the research's wording for genetic search ("not shown slow on a rule objective") is used in "Left out".

## The final list

| Version       | What it is                                                                                                        | Codebase |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| `a-objective` | Current builder's code with the honest objective: count once, supply against demand, payoff gate in every pass    | A'       |
| `a-search`    | `a-objective` plus lexicographic ordering (legality, plan health, roles and curve, strength), package moves, tabu | A'       |
| `b-grow`      | Seed and grow from the theme rules: payoffs the pool supports, setup to their demand, roles, curve slots, lands   | B        |
| `b-oldrules`  | `b-grow` with the current config matchers in place of the theme rules                                             | B        |

Baselines: `head`, `head-web`, `v26.0.30`, `random`, `real`, and the three shapes requested by name from every version.
