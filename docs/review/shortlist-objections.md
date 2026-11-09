# Objections to the shortlist

Written 2026-11-08 by the devil's advocate agent against `docs/review/shortlist.md`. Each objection ends with what to change.

## 1. Prototypes that should not be built as written

**C overlaps both A and B.** C "starts from B's deck or from a greedy fill". From B, whose gate already feeds payoffs, C minus B measures strength polishing under a lock. From a fill, C is a swap search that fixes setup shortfall first: A's repair pass. The methods section says better moves "matter only after that, if real dips remain" (`research.md`, local search). The shortlist itself calls C "the easiest to tune to the test pools".

What to change: **merge.** C's lexicographic objective and package moves become switches on A' (below), reported as paired deltas.

**D duplicates what ships.** The research calls the rating-and-template builders "close to Bulk Brew's plain Aggro, Midrange and Control" (`research.md`, draft tools). HEAD already builds those shapes, and builds one on request by name (`reportComposition` in `scan.ts`, `request.style` in `buildDeck`). The 17Lands signal is weak: only 16.8% of card entries in the 30 plain pools appear in any 17Lands draft deck (one-off count, plain pools against `data/corpus/decks.json`); it applies only at 40; single-deck win rates have a noise ceiling of 0.23 rank correlation (Rigaux and Kashima); and Phase 7's win-rate strength cost plan recall at every size (`research.md`, 17Lands).

What to change: **replace** D with HEAD's three shapes requested by name; drop the 17Lands signal.

## 2. What the list leaves out

**The research's top method fix has no prototype.** The methods section's first idea is to fix the balance term inside our own swap search, which with better definitions "is what would make the engine deck score higher". The shortlist's own evidence says most off-plan cards enter through the swap objective (`our-builder.md`). Yet A keeps HEAD's objective, B has no swap search, and C is a new search: nothing tests HEAD's search with a fixed objective, the likeliest thing to ship.

What to change: **replace** A's config trick with A', a copy of HEAD's builder with three code changes: count each card once in the tally, a supply-and-demand term in place of min(enablers, payoffs), and the payoff gate in every pass (idea 3: "in every layer that adds cards"). Keep config-only A as an arm, A0.

**Ideas no prototype carries.** Idea 12 (colors and cast chance) is invisible on a mono-color test. Idea 14 (best deck per plan and curve cell) alone targets the options list and style mix. Idea 6 (what a card needs from the deck) appears only in C's plan health, and the `theme-rules.json` format has no field for it (`checks.md`).

What to change: **add** a `requires` rule type to the theme rules; carry idea 14 under point 5.

**Co-occurrence and pick order as builders.** The evidence does not favor them: co-occurrence is "Good as an input to the objective, not as a builder", HEAD already uses lift pairs and still failed, and pick order covers too few bulk cards. But idea 10 (sizing setup per payoff from real decks) is the only outside check on the guide's numbers, and the shortlist runs it only "if the theme guide's numbers need checking". Nothing can trigger that: builders, checks, and rubric share the numbers.

What to change: **add** idea 10 as a required check of `theme-rules.json` before any prototype reads it.

## 3. Hidden assumptions

**The theme guide is good enough to share.** It is not assembled yet, and its checkers found errors of this review's own kind: a repeatable life-gain regex matching Food reminder text, "the Graveyard failure again" (`themes/g3-lifegain-artifacts-enchantments.check.md`); a Counters minimum none of its eight backing precons meets (`g1`); 20-card rows at odds with real Jumpstart packets in both directions (`g2`, `g5`). Errors not caught go into every prototype at once, and the report will blame algorithms. Only HEAD and 26.0.30 are independent of the rules.

What to change: **keep with a condition:** also run B on HEAD's own matchers, so definitions and algorithm form a two-by-two.

**A's config trick cannot do what it says.** `MatcherClause` (`packages/core/src/config.ts`) offers tags, keywords, types, type-line words, mana value bounds, and seven fixed derived predicates. No oracle-text pattern, so the guide's `text` and `notText` rules (such as `^surveil 1\.$`) cannot be written. Frequency exists only through `repeatable-*` tags and amount not at all; there is no `repeatable-mill` (`our-builder.md`), so Graveyard, the motivating case, fares worst. Excluding payoff tags from setup clauses always resolves a dual card to payoff; the rules pick the higher weight. Exact counting needs synthetic tags in the `CardIndex` that `buildDeck(request, pool, index, config)` takes, which ships only through the tag overlay and a new data pack, not as "a config-only fix next week". Also, `config.learned` keeps targets from the old matchers and a tag fit rating `mill-self` 4.88 over `loot` 1.98; the hand rule `graveyard` still counts `mill-self`; and the last `refitLands` can call `fillAll`, adding unchecked cards after an earlier repair.

What to change: **keep A0 only with a condition:** state whether learned data is on, rewrite `synergy-rules.json` too, run the repair after the last refit, and drop the "next week" claim.

**Four prototypes fit one session.** A five-hour limit already cut off four agents and two workflows today (`log.md`, "Rate limit and recovery"). Still ahead: guide assembly, the rules file, hand-built references, panel calibration, judging. At 25 judged decks per version and size, a decent rate's 95% interval is about plus or minus 20 points; more versions means fewer decks each.

What to change: **drop** to two builders with arms (A' with A0 and C's switches; B with B on old matchers), and spend the saving on judged decks.

## 4. Ways to win unfairly

- **Styles from HEAD's scan.** Honest builders will decline many requests HEAD calls viable. Decent over built decks rewards declining hard requests; decent over all requests punishes correct declines. Favors A to C on the first rate. What to change: report both, and have the hand-built reference check a sample of declines for whether a decent deck existed.
- **Silent substitution.** Packets omit the requested style (`judging.md`) and the rubric exempts plain shapes from setup and payoff (`rubric.md`, section 2). A Graveyard request answered with Midrange is judged as a decent Midrange deck. Favors B's plain fallback and D. What to change: a styled request whose deck is not that style counts as a decline.
- **Rules shared with the checks.** The honest-count check reads the same `theme-rules.json`, whose weights `checks.md` ties to the rubric's guide counts. The brief's first lesson says such agreement tells us nothing. Favors A to C. What to change: never cite theme counts for a prototype; measure idea 13's card families from a list the builders never see.
- **Mono-color requests.** HEAD's source sizing and cast penalties earn nothing; builders without mana logic lose nothing. Favors B to D. What to change: add a two-color slice at 60 before any ship recommendation.
- **Commanders and theme pools from HEAD's matchers.** Commanders are ordered by HEAD's scan (`commanderCandidates`), and 89% of theme extras are cards HEAD's matchers accept (`log.md`). Favors HEAD and A0; a theme-rules recipe would favor A to C instead. What to change: enrich from EDHREC theme pages or real decks of the theme, and add one commander per pool by a builder-neutral rule.
- **Tuning.** Every pool is visible to every builder. What to change: develop on the public pools and plain-01 to 10; judge on plain-11 to 30.

## 5. Plan choice

Best fit is 1,479 of 18,565 jobs per version (8%, `requests.md`), and users see the web's first option, which was never the core's best fit on six public pools (`log.md`). The shortlist says a themed deck "should have to beat the plain deck", but no prototype says beat by what. Today's deck score inherits dual counting (`our-builder-themes.md`, cause 4); B uses a threshold, D a template-fit score. Falling back to plain too often would also break the owner's rule that a skewed best-fit style mix is a blocker.

What to change: **add** one shared plan picker over each builder's honest plans and HEAD's shapes, with idea 14's best deck per plan cell for the options; judge it on blind pairs of first options and on their style mix against real decks.

## 6. Reasoning the evidence does not support

- "Real draft decks are mostly this" (D): no research section says so. What to change: delete it.
- "genetic search ... too slow": the methods section says on a rule objective it "is not shown to be slower"; the real reason is that it optimises the same objective. What to change: restate.
- "The ideas that would fix it ... need only data we have": no system tested them, and the rules they need are unwritten. What to change: say "untested".
- "Midrange or Aggro on several public pools": the log names two (bulk-red 60, bulk-green 40). What to change: say two.
- B's stall "covered" by D: then B's rate partly measures D. What to change: report B's fallback rate separately.
