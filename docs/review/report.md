# Builder review: report

Written 2026-11-09, the last step of the builder review (`docs/algo-review.md`, Phase 4). Builder 26.0.35, data pack 2026-11-03, theme rules version 2. Every number names the file or command it came from. Files under `data/review/` are gitignored and stay on the development machine. The scripts written for this report are in `data/review/scratch/report/`, each with its output beside it (`<name>.out`), run from the repo root as `node data/review/scratch/report/<name>.mjs .` plus the arguments shown.

**In short.** The current builder makes a decent deck in 76% of the 60-card, 62% of the 100-card, 27% of the 40-card, and 67% of the 20-card requests the panel judged. Its own best fit at 60 and 100 is nearly always decent (15 of 16), but its themed styles are decent 12 times in 30 across all sizes, and the first option on the web Build page 15 times in 26. Two prototypes, seed and grow with honest theme rules (`b-grow`) and the current builder with an honest objective (`a-search`), are decent in 88% of judged decks over the four sizes, but both decline about a quarter of all requests (42% of themed requests at 60 and 100) where the pool lacks enough setup and payoff cards; counting a decline as not decent, `b-grow` makes a decent deck for 69% of 60-card and 71% of 100-card requests. By a keyword check of the judges' plan sentences, `b-grow`'s themed decks play their theme far more often, and it builds about two to twelve times faster than the current builder. Build on `b-grow`, in phases, each gated by a blind panel on held-out pools, and fix its 20-card halves before they ship.

## How often does each version build a decent deck?

A blind panel of Opus agents judged one deck each, from card text alone, with a score from 1 to 5 where 3 means decent: a plan a player could explain, setup and payoffs that feed each other, castable spells, some interaction, few dead cards (`docs/review/rubric.md`). The versions:

- `head`: the current core's `buildDeck` (26.0.35), what `demo:build` and the iOS Build button give.
- `head-web`: the first option on the web Build page, which ranks every viable style's build by deck score (`docs/review/runner.md`).
- `v26.0.30`: the builder before the learned work.
- `a-objective` and `a-search` (A'): a copy of the current builder with an honest objective (each card counted once as setup or payoff, a payoff gate in every pass), and a variant with a different search (`docs/review/proto-a.md`).
- `b-grow`: seed and grow: payoffs the pool supports, setup to their demand, roles, curve slots, lands, with setup and payoff from the theme rules (`docs/review/proto-b.md`).
- `b-oldrules`: the same algorithm with setup and payoff from today's config matchers.

Terms used below:

- **Best fit**: the builder picks the style. A **themed request** names a style such as Graveyard; **shapes** are plain Aggro, Midrange, and Control decks.
- **The scan**: the current builder's check of which styles a pool can support ("viable").
- **Theme rules** (`docs/review/theme-rules.md`): rules written for this review that read each card's text and give it one job, setup or payoff, with minimum counts per size, the **floors**. "Honest" means counted this way. Today's builder counts with tag matchers in `config/archetypes.json`, which let a **rider** (a small side effect, such as surveil 1 on a removal spell) count as setup and let one card count on both sides.
- **Payoff gate**: a payoff joins the deck only when enough setup is already there to feed it.
- **Declined**: the version built no deck for the request. For the honest versions this means the pool falls short of the floors, so they refuse rather than build a weaker deck; the others decline rarely, on build errors.

This section covers 60 and 100 cards; the next covers 40 and 20.

### By version and size

Source: `data/review/results/main.md`, "By version and size"; the declined share is its Declined column as a percentage. Anchors from `data/review/results/calib.md`.

| Version                  | Judged 60 / 100 | Decent, built 60 / 100 | Decent, all requests 60 / 100 | Mean score 60 / 100 | Declined 60 / 100 |
| ------------------------ | --------------- | ---------------------- | ----------------------------- | ------------------- | ----------------- |
| head                     | 21 / 21         | 76% / 62%              | 76% / 61%                     | 2.81 / 2.57         | 0.6% / 1.4%       |
| head-web (best fit only) | 8 / 8           | 63% / 50%              | 62% / 49%                     | 2.63 / 2.50         | 0.1% / 2.7%       |
| v26.0.30                 | 21 / 21         | 52% / 43%              | 52% / 42%                     | 2.52 / 2.38         | 0.5% / 1.2%       |
| a-objective              | 21 / 21         | 81% / 86%              | 62% / 60%                     | 2.76 / 2.86         | 23.6% / 29.5%     |
| a-search                 | 21 / 20         | 81% / 90%              | 62% / 63%                     | 2.81 / 2.95         | 23.6% / 29.5%     |
| b-grow                   | 20 / 20         | 90% / 100%             | 69% / 71%                     | 2.95 / 3.05         | 23.7% / 29.4%     |
| b-oldrules               | 21 / 21         | 91% / 95%              | 88% / 92%                     | 2.95 / 3.05         | 2.2% / 3.7%       |
| Hand-built reference     | 5 / 1           | 100% / 100%            |                               | 4 / 5               |                   |
| Floor: random piles      | 15 / 15         | 40% / 27%              |                               | 2.2 / 2.2           |                   |
| Ceiling: real decks      | 15 / 14         | 100% / 100%            |                               | 3.73 / 4.14         |                   |

"Decent, built" is over judged built decks. "Decent, all requests" counts a declined request as not decent. Declined counts come from all 207,161 deck files, not only the judged ones (about 11,360 requests per version at 60 and 2,400 at 100). Pooled over both sizes (`groups.mjs`, `groups.out`): `b-grow` 95% (38 of 40), `b-oldrules` 93% (39 of 42), `a-search` 85% (35 of 41), `a-objective` 83% (35 of 42), `head` 69% (29 of 42), `head-web` 56% (9 of 16), `v26.0.30` 48% (20 of 42).

### By requested style

Source: `groups.mjs` (`groups.out`), 60 and 100 pooled, from the main key and judgments; its totals match `main.md` for every version and size. The themed sample drew eight styles: Graveyard, Tokens, Counters, Aristocrats, Lifegain, Spellslinger, Artifacts, Enchantments. Declined is over every request for those eight styles at 60 and 100.

| Version     | Best fit: decent (judged), mean | Themed: decent (judged), mean | Themed declined | Themed, all requests | Shapes: decent (judged) |
| ----------- | ------------------------------- | ----------------------------- | --------------- | -------------------- | ----------------------- |
| head        | 94% (16), 2.94                  | 40% (20), 2.40                | 0.4%            | 40%                  | 100% (6)                |
| head-web    | 56% (16), 2.56                  | not requested                 |                 |                      | not requested           |
| v26.0.30    | 56% (16), 2.56                  | 35% (20), 2.30                | 0.4%            | 35%                  | 67% (6)                 |
| a-objective | 81% (16), 2.81                  | 85% (20), 2.80                | 42.0%           | 49%                  | 83% (6)                 |
| a-search    | 88% (16), 2.94                  | 79% (19), 2.79                | 42.0%           | 46%                  | 100% (6)                |
| b-grow      | 87% (15), 2.87                  | 100% (19), 3.11               | 42.1%           | 58%                  | 100% (6)                |
| b-oldrules  | 94% (16), 3.06                  | 90% (20), 2.95                | 3.2%            | 87%                  | 100% (6)                |

What this says:

- The current builder's weak point is a requested theme: 8 of 20 decent. Its best fit and the plain shapes do not show the problem.
- The web's first option (9 of 16) trails the core's best fit (15 of 16) from the same builder. Which plan the user sees first may matter as much as how the deck is built, but in the five same-request pairs the judges preferred the web's option 4 to 1, so this is not settled (see Phase 2).
- Every prototype lifts themed requests to 15 to 19 of about 20. The honest versions decline 42% of the themed requests today's scan calls viable, so over all themed requests they reach 46% to 58%.
- Plain Aggro, Midrange, and Control decks read as decent from every version but `v26.0.30` (4 of 6) and `a-objective` (5 of 6).

### Head to head

Same pool, same request, two versions, one judge picks the better deck (`main.md`, "Head to head"). Each cell is the row version's wins and losses against the column. The pooled share counts a tie as half a win (`groups.out`).

| Version     | head | head-web | v26.0.30 | a-objective | a-search | b-grow     | b-oldrules | Pooled share (games) |
| ----------- | ---- | -------- | -------- | ----------- | -------- | ---------- | ---------- | -------------------- |
| head        |      | 1-4      | 4-1      | 3-3         | 1-4      | 3-2        | 0-5        | 39% (31)             |
| head-web    | 4-1  |          | 5-0      | 2-4         | 1-4      | 1-4        | 2-3        | 48% (31)             |
| v26.0.30    | 1-4  | 0-5      |          | 1-4         | 1-4      | 0-5        | 0-5        | 10% (30)             |
| a-objective | 3-3  | 4-2      | 4-1      |             | 3-3      | 2-4        | 0-6        | 46% (35)             |
| a-search    | 4-1  | 4-1      | 4-1      | 3-3         |          | 2-3        | 3-2        | 65% (31)             |
| b-grow      | 2-3  | 4-1      | 5-0      | 4-2         | 3-2      |            | 3-1, 1 tie | 69% (31)             |
| b-oldrules  | 5-0  | 3-2      | 5-0      | 6-0         | 2-3      | 1-3, 1 tie |            | 73% (31)             |

A version that declines a request skips that pair, so the honest versions are compared only on requests they built. The order check found no position bias: of 110 pairs, deck A won 57, deck B 52, one tie.

### How to read these numbers

- **Floor and ceiling.** In calibration, 16 of 60 random piles with a legal mana base scored 3 or more (27%; 40% at 60 cards, 27% at 100), and 59 of 59 real decks did (`calib.md`). So a decent rate near 40% at 60 is what chance gives, and the panel passes every real deck. Mean scores separate better: random piles 2.2, real decks 3.7 at 60 and 4.1 at 100, hand-built decks 4 to 5. Every builder sits between 2.38 and 3.05: at the bar, and well below the eight decks an agent built by hand from public pools.
- **Noise.** With about 20 decks per cell, two versions' decent rates need to differ by roughly 25 to 30 points before chance is an unlikely cause; gaps under about 15 points are plainly noise. Five or six pairs per cell say little; the pooled shares (about 31 games each) say a little more. Read the direction of several measures together, never one cell.
- **Separate samples.** Each version's judged decks were drawn separately from the decks it built (`data/review/plans/main.json`; `packages/pipeline/src/review/packets.ts`), so two cells hold different pools and styles: `b-grow`'s 60-card themed sample, for one, holds no Graveyard deck. Only the head-to-head pairs compare two versions on the same request. The honest versions' themed decks also come only from requests they accepted, where the pool holds a full engine, likely the easier ones. `b-oldrules`, which builds 97% of themed requests and still has 18 of 20 decent, shows the lift is not only that selection.
- **Judge agreement.** Two judges scored 32 calibration decks and 50 main decks independently: they agreed on decent 88% and 86% of the time, gave the same score 78% and 82%, and differed by 0.25 and 0.18 points on average (`calib.md`, `main.md`).
- **Held-out pools.** On plain-11 to plain-30, which no prototype author saw (`heldout.mjs`, `heldout.out`): `b-grow` 11 of 12, `a-objective` 15 of 18, `b-oldrules` 12 of 15, `a-search` 8 of 11, `head` 9 of 13, `head-web` 2 of 5, `v26.0.30` 3 of 10. Every prototype is ahead of `head` and `v26.0.30` in direction, but on cells of 5 to 18 only the gaps to `v26.0.30` are clearly past the noise.
- **No substitutions.** No version answered a styled request with another style (`main.md`, "Built another style").

## 40 and 20 cards

Source: `data/review/results/small.md` (154 decks, 26 second copies, 50 pairs; 226 valid answers, 4 invalid for a missing failures field) and `node data/review/scratch/report/batch.mjs . small 40,20` (`small.out`), whose totals match `small.md` for every version and size. The sample per version and size was 5 best fits, 5 themed requests from the same eight styles, and 2 shapes (`data/review/plans/small.json`), so a cell holds about 12 decks and 2 or 3 pairs: two cells need to differ by roughly 35 to 40 points before chance is an unlikely cause. Two judges scored 25 decks independently and agreed on decent 96% of the time, gave the same score 92%, and differed by 0.08 points on average.

### By version and size

Source: `small.md`, "By version and size". Hand-built decks from `main.md`; anchors from `calib.md`.

| Version                  | Judged 40 / 20 | Decent, built 40 / 20 | Decent, all requests 40 / 20 | Mean score 40 / 20 | Declined 40 / 20 |
| ------------------------ | -------------- | --------------------- | ---------------------------- | ------------------ | ---------------- |
| head                     | 11 / 12        | 27% / 67%             | 27% / 66%                    | 2.27 / 2.58        | 0.4% / 0.6%      |
| head-web (best fit only) | 5 / 5          | 40% / 80%             | 40% / 80%                    | 2.40 / 2.80        | 0% / 0%          |
| v26.0.30                 | 11 / 12        | 55% / 33%             | 54% / 33%                    | 2.55 / 2.25        | 0.5% / 0.6%      |
| a-objective              | 12 / 12        | 75% / 92%             | 58% / 71%                    | 2.83 / 2.92        | 22.2% / 23.1%    |
| a-search                 | 12 / 12        | 100% / 83%            | 78% / 64%                    | 3.08 / 2.75        | 22.2% / 23.1%    |
| b-grow                   | 12 / 12        | 92% / 58%             | 71% / 45%                    | 3.00 / 2.67        | 22.2% / 23.3%    |
| b-oldrules               | 11 / 12        | 73% / 75%             | 71% / 73%                    | 2.73 / 2.83        | 2.6% / 3.3%      |
| Hand-built reference     | 1 / 1          | 100% / 100%           |                              | 4 / 4              |                  |
| Floor: random piles      | 15 / 15        | 13% / 27%             |                              | 1.93 / 2.07        |                  |
| Ceiling: real decks      | 15 / 15        | 100% / 100%           |                              | 3.20 / 3.27        |                  |

Pooled over 40 and 20 (`small.out`): `a-search` 92% (22 of 24), `a-objective` 83% (20 of 24), `b-grow` 75% (18 of 24), `b-oldrules` 74% (17 of 23), `head-web` 60% (6 of 10), `head` 48% (11 of 23), `v26.0.30` 43% (10 of 23). Over all four sizes (`node data/review/scratch/report/combined.mjs .`, `combined.out`): `a-search` 88% (57 of 65), `b-grow` 88% (56 of 64), `b-oldrules` 86% (56 of 65), `a-objective` 83% (55 of 66), `head` 62% (40 of 65), `head-web` 58% (15 of 26), `v26.0.30` 46% (30 of 65).

### By requested style

Source: `small.out`, 40 and 20 pooled. Declined is over every request for the eight themed styles at 40 and 20.

| Version     | Best fit: decent (judged), mean | Themed: decent (judged), mean | Themed declined | Themed, all requests | Shapes: decent (judged) |
| ----------- | ------------------------------- | ----------------------------- | --------------- | -------------------- | ----------------------- |
| head        | 70% (10), 2.70                  | 40% (10), 2.40                | 0.2%            | 40%                  | 0% (3)                  |
| head-web    | 60% (10), 2.60                  | not requested                 |                 |                      | not requested           |
| v26.0.30    | 50% (10), 2.50                  | 44% (9), 2.33                 | 0.2%            | 44%                  | 25% (4)                 |
| a-objective | 80% (10), 2.80                  | 80% (10), 2.90                | 31.0%           | 55%                  | 100% (4)                |
| a-search    | 100% (10), 3.10                 | 90% (10), 2.80                | 31.0%           | 62%                  | 75% (4)                 |
| b-grow      | 90% (10), 3.10                  | 60% (10), 2.50                | 31.0%           | 41%                  | 75% (4)                 |
| b-oldrules  | 78% (9), 2.89                   | 70% (10), 2.80                | 1.6%            | 69%                  | 75% (4)                 |

Split by size (`small.out`), the themed rows hide two opposite results: `head` built 0 decent themed decks of 5 at 40 and 4 of 5 at 20; `b-grow` built 5 of 5 at 40 and 1 of 5 at 20.

### Head to head

Source: `small.md`, "Head to head", same-request pairs; pooled shares from `small.out`. Two or three games per cell.

| Version     | head        | head-web    | v26.0.30   | a-objective | a-search | b-grow | b-oldrules | Pooled share (games) |
| ----------- | ----------- | ----------- | ---------- | ----------- | -------- | ------ | ---------- | -------------------- |
| head        |             | 0-0, 2 ties | 1-0, 1 tie | 1-2         | 0-2      | 0-2    | 0-2        | 27% (13)             |
| head-web    | 0-0, 2 ties |             | 1-0, 1 tie | 1-2         | 2-0      | 0-2    | 0-2        | 42% (13)             |
| v26.0.30    | 0-1, 1 tie  | 0-1, 1 tie  |            | 0-3         | 0-2      | 0-2    | 1-1        | 15% (13)             |
| a-objective | 2-1         | 2-1         | 3-0        |             | 2-1      | 2-1    | 3-0        | 78% (18)             |
| a-search    | 2-0         | 0-2         | 2-0        | 1-2         |          | 1-2    | 2-1        | 53% (15)             |
| b-grow      | 2-0         | 2-0         | 2-0        | 1-2         | 2-1      |        | 0-2        | 64% (14)             |
| b-oldrules  | 2-0         | 2-0         | 1-1        | 0-3         | 1-2      | 2-0    |            | 57% (14)             |

Order check: of 50 pairs, deck A won 21, deck B 25, 4 ties. Over both batches (`combined.out`), the pooled shares are `b-grow` 68% (45 games), `b-oldrules` 68% (45), `a-search` 61% (46), `a-objective` 57% (53), `head-web` 47% (44), `head` 35% (44), `v26.0.30` 12% (43); `b-grow` beat `a-search` 5 to 3 and `a-objective` 5 to 4.

### Failures at 40 and 20

Pooled over 40 and 20 from `small.md` ("By version and size").

| Version     | Judged | None | No plan | Thin setup | Thin payoff | Dead cards | Other                        | Dead copies per deck 40 / 20 |
| ----------- | ------ | ---- | ------- | ---------- | ----------- | ---------- | ---------------------------- | ---------------------------- |
| head        | 23     | 9    | 3       | 3          | 5           | 9          | bad mana 1, no interaction 1 | 2.27 / 1.08                  |
| head-web    | 10     | 6    |         |            | 1           | 3          |                              | 3.00 / 0.60                  |
| v26.0.30    | 23     | 9    | 2       | 4          | 3           | 7          | no interaction 3             | 2.55 / 0.92                  |
| a-objective | 24     | 14   |         |            |             | 10         |                              | 1.92 / 1.25                  |
| a-search    | 24     | 16   | 1       |            |             | 8          |                              | 2.00 / 1.17                  |
| b-grow      | 24     | 15   | 1       | 2          | 2           | 8          | bad curve 1                  | 1.75 / 1.58                  |
| b-oldrules  | 23     | 11   | 4       |            | 1           | 11         |                              | 2.27 / 1.33                  |

At the small sizes dead cards are every version's commonest failure. The current and older builders still fail on the plan too (11 and 9 plan marks); `a-objective` has none and `a-search` one.

### What the small sizes add

- **The current builder is weakest at 40**: 3 of 11 decent, mean 2.27, nearer random piles at 40 (13%, mean 1.93) than real draft decks (100%, mean 3.20), and no themed deck of 5 decent. The prototypes built 11 or 12 decent decks of 12 at 40 (`a-search`, `b-grow`), a gap well past the noise. At 40 the current builder runs without its learned plans, which are off there because the panel preferred the old 40-card builds 9 to 1 (`docs/learned-builder.md`). Its swap objective then uses the hand-written synergy rules at full weight, and its deck score, which picks best fit and ranks the Build page options at 40, is nearly half hand-rule synergy, counted with dual cards on both sides (`docs/review/our-builder.md`, "The 40-card deck score"); `docs/todo.md` notes that every synergy rule counts in every deck's score. The two worst 40-card decks below show the result: thin payoffs, riders (sacrifice outlets that "just surveil 1"), and a scatter of off-plan cards.
- **`b-grow` drops at 20**: 7 of 12 decent, and 1 of 5 themed halves (`small.out`). Its failures there are thin setup, thin payoffs, a half with no plan, and dead cards; a 10-mana Ulamog, the Ceaseless Hunger or Kozilek, Butcher of Truth sits on the dead list of 6 of its 12 halves, each played on 8 lands, and 11 of the 12 come from theme pools (`node data/review/scratch/report/list.mjs . small b-grow 20`, `b-grow-20.out`; 6 to 9 of 12 for the other versions at 20, same script), whose plain bases carry those Eldrazi (see "Dead cards cross every version"). The rubric judges a 20-card packet as a self-contained half: it shuffles with another color's half, so its theme must work from its own cards, its other cards must still play when the theme does not show, and it needs a low curve (`docs/review/rubric.md`). B's floors at 20 are small (Artifacts: 4 setup, 3 payoffs; `docs/review/theme-rules.md`) and a package that meets them does not carry a half, while nothing keeps a 10-mana card out of an 8-land half. Against `head`'s 8 of 12 at 20 the gap is inside the noise, but the pattern is specific and fixable.
- **Themed decks that play their theme.** On the keyword check described under "The surprising result" (`small.out`), the judges' plans named the requested theme for `b-grow` 7 of 10, `head` 6, `a-objective` 6, `a-search` 3, `b-oldrules` 3, `v26.0.30` 3 of 9. Over all four sizes: `b-grow` 26 of 29, `a-objective` 20 of 30, `head` 19 of 30, `a-search` 14 of 29, `v26.0.30` 11 of 29, `b-oldrules` 9 of 30.
- **The web's first option** was decent 2 of 5 times at 40 and 4 of 5 at 20, against the core's best fit at 3 of 5 and 4 of 5.

### Example decks at 40 and 20

From `small.md`, "Example decks" (plain pools), quoted and shortened where marked.

**head**

- Plain-18, UG, Counters requested, 40 cards, score 2. Plan: "Grow creatures with +1/+1 counters from Training Regimen, Defiler of Vigor, and Ant-Man, turning counters into Insect tokens and big tramplers." Reason: "only three real payoff copies and many cards that chase unrelated themes [...]. The mana base hurts most: only nine lands reliably make colored mana, Paliano makes no mana outside a draft [...]." Dead: Eternity Vessel, Idol of False Gods, Ashnod's Altar, Paliano, the High City. Failures: thin payoff, bad mana, dead cards.
- Plain-15, UB, best fit, 40 cards, score 2. Plan: "Play artifact creatures and token fodder, sacrifice them for card flow, and win with Iron Man and other flyers." Reason: "its only real payoff is a single Iron Man, and the sacrifice outlets just surveil 1." Dead: Sailors' Bane, Idol of False Gods, Worldwalker Helm. Failures: thin payoff, dead cards.
- Plain-03, U, Graveyard requested, 20 cards, score 3 (the highest). Plan: "Blue tempo half: put cards in the graveyard with surveil, looting and cycling, recast instants from it with Bilbo and exile the pile for Abhorrent Oculus, while bounce and counters hold the board for flyers." Dead: Sojourner's Companion.

**head-web**

- Plain-07, W, best fit, 40 cards, score 2. Reason: "About six of its 23 spells do nothing: two Arcbound Wanderers [...], a Metalwork Colossus with too few artifacts to make it cheap, a five-color win card it cannot meet, a symmetric Smokestack, and a lifegain War Report [...]." Dead: Arcbound Wanderer, Metalwork Colossus, Happily Ever After, Smokestack, War Report.
- Plain-05, B, best fit, 20 cards, score 3. Plan: "Black midrange half: trade off creatures with edicts and blockers, sacrifice spare bodies for cards, and win with two planeswalkers, a flyer, and Imotekh's pumps and tokens." No dead cards.

**v26.0.30**

- Plain-26, G, Spellslinger requested, 20 cards, score 2. Plan: "Put +1/+1 counters on green creatures to grow a Hydra, and use Bite Down as removal." Reason: "only one Wildwood Scourge pays off and the setup is a few one-shot counters [...]." Dead: Geometric Nexus. Failures: thin setup, thin payoff.
- Plain-24, U, best fit, 40 cards, score 2. Reason: "apart from a single Traxos the artifact payoffs are small riders like a one-time draw or a sacrifice for flying [...]." Dead: Spell Satchel, Vision Charm. Failure: thin payoff.

**a-objective**

- Plain-04, RG, Aristocrats requested, 40 cards, score 2. Plan: "Attack with cheap red creatures and burn blockers or the opponent, with a few loose sacrifice and morbid extras." Reason: "only 11 creatures are in the deck and three of them cost 6, 8, and 9 with 17 lands and no ramp [...]." Dead: Pyroblast, Artisan of Kozilek, Ulamog's Crusher.
- Plain-29, B, Enchantments requested, 40 cards, score 4 (the highest). Plan: "Mono black midrange: kill or force sacrifices of the opponent's creatures with edicts and removal, wall up with Grim Guardians that drain, then win with Desecration Demon, Sheoldred, Egon, and small fliers." No dead cards; decent, but read as midrange, not Enchantments.

**a-search**

- Plain-04, R, Control requested, 20 cards, score 2. Reason: "Four of its twelve spells do nothing in most games: Myr Reservoir has no Myr, Pyroblast and Burnout only hit blue, and the 8-mana Abomination needs the single Ravager discard to be castable [...]." Dead: Myr Reservoir, Pyroblast, Burnout, Abomination, World Ravager.
- Plain-08, U, Graveyard requested, 40 cards, score 3. Plan: "Mono-blue tempo control: hold the ground with high-toughness flying blockers, bounce or counter threats while drawing cards, then win in the air with big flyers [...]." Reason: "This is a plain blue control deck [...]." Dead: Ceta Sanctuary. Decent, but not a Graveyard deck.

**b-grow**

- Plain-09, G, Artifacts requested, 20 cards, score 2. Plan: "Play cheap artifacts and mana rocks, then sacrifice them to Extruder to put +1/+1 counters on a few creatures." Reason: "This half is eight artifacts and only four creatures: plenty of fodder, but the only real outlet is two Extruders with echo [...]." Dead: Tome of the Guildpact, Grinding Station, Dragon's Hoard. Failures: thin payoff, dead cards.
- Plain-20, U, Graveyard requested, 40 cards, score 3. Plan: "Mono-blue tempo control: peck with cheap fliers, loot and draw extra cards with Accumulated Knowledge, Jace, and Teferi, and stop a few threats with a counter, bounce, and a frog aura." Reason: "both Hydroblasts do nothing unless the opponent is red [...]." Dead: Hydroblast, Back from the Brink.
- Plain-26, B, best fit, 40 cards, score 4 (the highest). Plan: "Mono-black removal midrange: kill or edict the opponent's creatures with cheap removal and value creatures, then win with planeswalkers, Sword of Fire and Ice, and a few large bodies." Dead: Vexing Bauble.

**b-oldrules**

- Plain-19, G, Graveyard requested, 20 cards, score 2. Plan: no clear plan. Reason: "Loamcrafter Faun and Zask want lands in the graveyard but only Lunatic Pandora's slow surveil puts any there [...]." The owner's failure again: payoffs with no setup.
- Plain-02, UG, best fit, 40 cards, score 2. Plan: no clear plan. Reason: "a Spider payoff with no Spiders, a Dinosaur payoff with one Dinosaur, Elf lands with no Elves [...], and three cards (Bronze Tablet, Ulamog, Aetherflux Reservoir) do nothing [...]." Dead: Bronze Tablet, Ulamog, the Ceaseless Hunger, Aetherflux Reservoir.
- Plain-23, W, Lifegain requested, 20 cards, score 4 (the highest). Plan: "Attack in the air with small lifelink and flying creatures, turn the life gained into cards with Dawn of Hope and counters on Lyra, and remove blockers and attackers with cheap white removal." No dead cards.

## Why decks fail, per version

This section covers 60 and 100 cards; the failures at 40 and 20 are in the section above.

### The failures the judges named

Pooled over 60 and 100 from `main.md` ("By version and size", Failures and Dead copies). A deck can carry several failures; "None" counts decks with none.

| Version     | Judged | None | No plan | Thin setup | Thin payoff | Dead cards | Other            | Dead copies per deck 60 / 100 |
| ----------- | ------ | ---- | ------- | ---------- | ----------- | ---------- | ---------------- | ----------------------------- |
| head        | 42     | 26   | 3       | 5          | 7           | 4          |                  | 2.10 / 3.71                   |
| head-web    | 16     | 9    | 2       | 1          | 3           | 1          | bad mana 1       | 2.50 / 4.38                   |
| v26.0.30    | 42     | 18   | 7       | 8          | 11          | 6          |                  | 2.76 / 2.81                   |
| a-objective | 42     | 34   | 2       | 1          |             | 6          | no interaction 1 | 2.52 / 2.57                   |
| a-search    | 41     | 35   | 4       |            | 2           | 2          |                  | 2.14 / 2.40                   |
| b-grow      | 40     | 34   | 1       |            | 1           | 5          |                  | 2.00 / 2.10                   |
| b-oldrules  | 42     | 37   | 1       |            |             | 4          |                  | 2.48 / 2.24                   |

The current and older builders fail on the plan: thin setup, thin payoffs, or none at all (15 such marks for `head`, 26 for `v26.0.30`). The prototypes have almost no plan failures left; what remains is dead cards and the odd best fit with no plan. Bad mana and missing interaction came up once each in 273 judged decks, so removal, curve, and mana are not where decks fail, as `docs/review/our-builder-themes.md` found.

**Dead cards cross every version.** The cards judges called dead most often in the main batch were popular, expensive, or narrow cards (`dead.mjs`, `dead.out`): Aetherflux Reservoir in 23 decks, Technodrome 19, Emrakul, the World Anew 18, Séance Board 17, Ulamog, the Ceaseless Hunger 13, Kozilek, Butcher of Truth 12, Idol of False Gods 10. They are almost never theme extras (added in at most 1 of 54 theme pools; `added.mjs`, `added.out`), so they come with the plain bases; since the 54 theme pools reuse plain-01 to plain-03, 68 of 131 judged theme-pool decks carried one called dead, against 15 of 128 plain-pool decks (`dead-by-version.mjs`, `dead-by-version.out`). Every version plays them, and every version ranks by the core's card strength, which adds up to 2 points for popularity (`docs/review/our-builder.md`). Why each one entered is left for the next session. Color hosers (Hydroblast, Red Elemental Blast, Pyroblast) and tribe cards with no tribe recur in the example decks of both batches.

### Example decks

From `main.md`, "Example decks": the two lowest and the highest scored deck per version and size, all from plain pools. Quotes are the judges' words, shortened where marked.

**head**

- Plain-24, BG, Graveyard requested, 60 cards, score 2. Plan: "Mill creatures into your own graveyard, trade them off with sacrifice and deathtouch, then bring them back with reanimation spells while big green creatures hold the board." Reason: "The graveyard plan rests on singleton one-shot mills and a handful of slow or small payoffs, and about a third of the deck pulls in unrelated directions [...]." Dead: Awaken the Erstwhile. Failures: thin setup, thin payoff. This is the owner's failure, on a held-out pool.
- Plain-24, WUG, Aristocrats under Brenard, Ginger Sculptor, 100 cards, score 2. Plan: "Fill the board with creatures and let Brenard turn each one that dies into a 3/3 trample Food Golem copy, using a few sacrifice outlets and big green and blue finishers." Reason: "Only two repeatable sac outlets feed that engine in 99 cards, and many cards chase things the deck never has (Angels, Auras, instants and sorceries, a full party, Heroes, Spiders) [...]." Dead: Coral Reef, Spell Satchel, Vision Charm, Bishop of Wings, Dawn Evangel. Failure: thin setup.
- Plain-23, UG, Enchantments requested, 60 cards, score 2. Reason: "The curve, mana, and interaction are fine, but the enchantment payoffs are four weak creatures and many cards pull in unrelated directions [...]." Dead: Dragonstorm Forecaster, Kozilek's Unsealing. Failure: thin payoff.

**head-web**

- Plain-07, RG, best fit under Blaster, Combat DJ, 100 cards, score 2. Plan: no clear plan. Reason: "a spread of creatures, burn, and ramp mixed with stray synergy cards that point in many directions [...], while the commander's artifact creature theme gets only seven artifact creatures, most costing six or more." Dead: Flourishing Defenses, Viridian Harvest, Banner of Kinship, For the Ancestors, Tooth and Claw, Crescent Island Temple.
- Plain-27, WR, best fit, 60 cards, score 2. Plan: "Curve out with small white and red creatures, grow them with +1/+1 counters, and finish with fliers." Reason: "The mana is the serious flaw: about 16 white cards, most of them early plays and two needing WW, sit on only about 10 white sources with many entering tapped [...]." Dead: Serra's Sanctum, Ravnica at War, Golem Foundry. Failure: bad mana, the only one in the batch.

**v26.0.30**

- Plain-09, UB, Graveyard under Tegwyll, Duke of Splendor, 100 cards, score 1. Plan: no clear plan. Reason: "The commander wants Faeries but the deck has only two other Faerie cards, and the rest points in many unrelated directions [...]." Dead: Theft of Dreams, Gremlin Mine, Altar of the Goyf.
- Plain-18, WU, Spellslinger requested, 60 cards, score 2. Reason: "The payoffs are few and mostly weak or rarely triggered, the threats are small 1/3 bodies plus two five-mana Pharaohs, and about eight cards do nothing [...]." Dead: Gaze of Justice, Paliano, the High City, Serra's Sanctum, Rewards of Diversity, Steel Sabotage, Idol of False Gods. Failures: thin payoff, dead cards.

**a-objective**

- Plain-16, G, Graveyard requested, 60 cards, score 1. Plan: no clear plan. Reason: "two Elf lords with only one other Elf, a Squirrel lord and a Squirrel maker, a Wolf maker, [...] and a loose self-mill angle with no real payoff, so there is no plan a player could explain." Dead: Mutant's Prey, Wren's Run Packmaster, Heroes' Podium, Life Chisel, Rumbleweed. This deck meets every Graveyard floor exactly (setup weight 8, 2 repeatable, payoff weight 6; `data/review/checks/a-objective/plain-16-G-60-graveyard-s1.json`), and two of the cards the rules count, Life Chisel and Rumbleweed, are on the dead list. The floors are necessary, not enough.
- Plain-05, WB, Midrange requested, 60 cards, score 2. Reason: "It pulls against itself: three Plague Stingers deal poison while the rest deal normal damage, Black Sun's Zenith, Shefet Archfiend, and the sweeper modes kill its own small creatures, and four cards are dead [...]." Dead: Artisan of Kozilek, Urza's Ruinous Blast, Priest of the Haunted Edge, Vexing Bauble.

**a-search**

- Plain-16, UR, Artifacts requested, 60 cards, score 2. Plan: "Blue-red tempo: play cheap fliers and small artifact creatures, use cheap artifacts to switch on a few artifact bonuses, and clear blockers with removal and bounce." Reason: "The artifact payoffs are small single copies, several one-ofs point elsewhere [...]." Dead: Forerunner of the Empire, Gonti's Aether Heart, Power Conduit, Mirrorweave, Melek, Reforged Researcher. Failures: thin payoff, dead cards.
- Plain-14, UR, best fit under Adeliz, the Cinder Wind, 100 cards, score 2 (`a-objective` built nearly the same deck, also score 2). Plan: no clear plan. Reason: "a loose mix of blue and red creatures, removal, mana rocks, and one-off theme cards (a Goblin lord with one other Goblin, a lone Sliver, a dice Class with no dice [...])". Dead: Gates Ablaze, Skred, Fatigue, Lost Isle Calling, Tectonic Instability, Barbarian Class.

**b-grow**

- Plain-16, UG, best fit, 60 cards, score 2. Plan: no clear plan. Reason: "a mutate payoff with no mutate creatures, a Food and token maker with no tokens, an Elf champion with no Elves, four snow looters with one snow land, and two lone infect creatures [...]." Dead: Wren's Run Packmaster, Smoke Bomb.
- Plain-21, WU, Graveyard under Linvala, Shield of Sea Gate, 100 cards, score 3. Plan: "White-blue control: trade and sweep with lots of spot removal, exile effects, board wipes, and counters, filter with looters and mana rocks, then win with flyers and a few big threats." Decent, but read as control, not Graveyard. Dead: Distant Melody, Skittering Invasion, Revivify.
- Plain-04, WB, Spellslinger requested, 60 cards, score 4 (the highest). Plan: "Control: kill nearly every opposing creature with cheap black and white removal and edicts, then win with planeswalkers and small prowess and value creatures." Dead: Ravnica at War. B's decks lean on removal; both of these read as control.

**b-oldrules**

- Plain-11, WU, Counters requested, 60 cards, score 2. Plan: "Play a curve of small white and blue creatures, many with flying, grow them with planeswalker counters, and clear blockers with removal." Reason: "five dead cards (three Hydroblast with no red to hit, Dynavolt Tower with only six live instants, and a nine-mana Artisan with no ramp) [...]." Dead: Hydroblast, Dynavolt Tower, Artisan of Kozilek.
- Plain-29, WBG, Lifegain under Anikthea, Hand of Erebos, 100 cards, score 2. Plan: no clear plan. Reason: "lifegain, sacrifice, artifact, vehicle, and tribe payoffs each appear once or twice." Dead: Dawn-Blessed Pennant, Wild Dogs, Worldslayer.
- Plain-05, B, best fit, 60 cards, score 4. Plan: "Mono-black control: kill everything with cheap removal, edicts, and sweepers, then win late with big threats [...]." Dead: Vexing Bauble.

### What the code explains

**head.** Its failures are the four causes the brief named, confirmed in the code (`docs/review/our-builder.md`) and on 24 public-pool decks (`docs/review/our-builder-themes.md`):

- Broad tags count riders as setup: rider copies among counted setup were Graveyard 21 of 41, Lifegain 17 of 30, Counters 17 of 35, Tokens 13 of 39, Aristocrats 11 of 50.
- Real setup is left out: looters and discard outlets count for Graveyard only when they are also payoffs, and sacrifice outlets never do.
- A card that is both counts twice: theme value 2 in every tiebreak, and on both sides of every count.
- Payoffs need no engine: nothing gates a payoff on setup, learned targets fill past the minimums (Graveyard at 60: 8 enablers and 10 payoffs against minimums of 6 and 5), and the swap guard keeps them. Most off-plan cards enter through the swap search, which takes 63% of build time.

All 24 public-pool decks met the builder's own minimums; 8 to 10 met an honest count. Over every stored deck, `head`'s themed decks meet the honest floors 24% of the time at 60 and 6% at 100 (`data/review/checks/summary.md`). The panel's thin-setup and thin-payoff marks are the same finding from an independent reader. At 40 the hand-written rules carry the whole build (see "40 and 20 cards").

**head-web.** The same builder with a different plan choice: it ranks every viable style's build by deck score, which with learned data is mostly closeness to real decks of the plan, counted with the same matchers. On six public pools the core's best fit was never the web's first option (second to ninth on four, missing on two; `docs/review/runner.md`). On the development plain pools its largest style is Midrange, 36% of best fits at 60 (`docs/review/proto-b.md`). Its themed first options meet the honest floors 28% of the time at 60 and 1% at 100 (`summary.md`).

**v26.0.30.** The old matchers without the learned machinery: the most plan failures (26 marks in 42 decks), and the honest floors met 6% and 3% of the time (`summary.md`).

**A' (a-objective, a-search).** Counting once with a payoff gate removed the plan failures: themed decks meet the floors 94% to 99% of the time (`summary.md`), and thin-setup or thin-payoff marks fell to 3 in 83 decks. What is left comes from the copied builder: its filler and swap search still add off-plan singles (Loki, Sea Hag, and Sentinel of the Pearl Trident in Blue Graveyard; `proto-a.md`), setup stops exactly at the floor because the plan term pays nothing past it, and best fit leans to shapes at 60 (83 of 161 development best fits for `a-objective`, 122 for `a-search`, against 50 for `head`) and to Ramp at 100 (14 of 38). The strength polish shows in what its decks play: on themed requests the judges named the theme for `a-search` 14 times in 29 over all sizes.

**B (b-grow).** The payoff gate is in every step and cards compete inside their slot, so a rider cannot fill a setup slot and a payoff cannot arrive alone; its themed decks meet the floors 100% of the time at 60 and 88% at 100 (`summary.md`). Its weaknesses (`proto-b.md`): its plan choice leans to Control (15 of 50 plain-pool best fits at 60) and never picks Aggro (0 of 50), because its quality measure penalizes the many cheap creatures Aggro needs; theme picks on plain bulk rest on richness near 1.15, which is sampling noise; off-plan setup enters on strength (four Ruin Crab, which mill the opponent, in a Graveyard deck); Sphinx's Tutelage counts as weight-2 Graveyard setup though it mainly mills the opponent; setup grows only a little past the floors; and at 20 its halves miss the rubric's bar (see "40 and 20 cards").

**b-oldrules.** The same algorithm on today's matchers. Its decks pass the honest floors 11% of the time (`summary.md`), with a median of 2 payoffs at 60 against `b-grow`'s 8.

### The surprising result: b-oldrules

`b-oldrules` scored as well as `b-grow` on built decks at 60 and 100 (91% and 95% against 90% and 100%; mean 2.95 and 3.05 for both) and declined about a ninth as often (912 declines against 7,854 over all sizes; `main.md`). Over all four sizes the two tie: 56 decent decks each, and 3 to 3 with a tie in pairs (`combined.out`). Read honestly, that means:

- **The structure is what the panel rewards.** Seed and grow with a payoff gate, slot filling, and a curve pass make decks a judge calls decent, whichever definitions feed them. Both B versions beat `v26.0.30` (7 to 0 and 6 to 1 over both batches) and `head` (4 to 3 and 7 to 0).
- **The honest definitions mostly change which requests get declined, and keep rider cards out.**

It does not mean the definitions do not matter. The judges never saw the requested style, so they judged "is this a decent deck", not "is this a decent Graveyard deck". A keyword check of the judges' plan sentences on themed requests shows what each version's themed decks played at 60 and 100 (`node data/review/scratch/report/theme-named.mjs . --list`, `theme-named.out`):

| Version     | Themed decks judged | Decent | Judges' plan names the requested theme | Judges listed no setup cards |
| ----------- | ------------------- | ------ | -------------------------------------- | ---------------------------- |
| head        | 20                  | 8      | 13                                     | 3                            |
| v26.0.30    | 20                  | 7      | 8                                      | 6                            |
| a-objective | 20                  | 17     | 14                                     | 7                            |
| a-search    | 19                  | 15     | 11                                     | 7                            |
| b-grow      | 19                  | 19     | 19                                     | 5                            |
| b-oldrules  | 20                  | 18     | 6                                      | 15                           |

The test is crude and generous (`b-grow`'s Graveyard deck under Linvala, above, passes on the word "looters" though the judge called it control), but the gap is large, and it holds at 40 and 20 (7 of 10 against 3 of 10). `b-oldrules`' themed decks are decent mostly as plain removal-heavy decks, and the judges listed no setup at all for 15 of its 20. In the app such a deck carries the theme's name: the owner's original complaint, in a milder form.

It also does not mean declining is wrong, or that the "all requests" column is the cost a user pays:

- The honest floors are stricter than many real decks: of real precons named for their theme, 22% of Tokens decks, 30% of Counters, and 61% of Graveyard meet them, and 15% of winning draft decks meet their best theme (`docs/review/theme-rules.md`). A decline says the pool lacks a full engine, not that no playable deck exists.
- In the app a declined style need not be a failure. The iOS Build button already builds the best fit when a style falls short, and the web lists only viable styles (`runner.md`). Under either, the user gets a best-fit deck (decent 87% of the time from `b-grow` at 60 and 100, 90% at 40 and 20) or a shorter list, not nothing, so the "all requests" column overstates the cost.

## Which version to build on

### Speed

Median build time on the development desktop over every stored deck (`data/review/checks/summary.md`, Medians, Build ms). These are mostly single requested-style builds, run in batch processes side by side, so read them as ratios.

| Version                        | 60       | 40     | 20     | 100      |
| ------------------------------ | -------- | ------ | ------ | -------- |
| head                           | 67 ms    | 30 ms  | 27 ms  | 131 ms   |
| head-web (whole option search) | 1,162 ms | 419 ms | 461 ms | 1,490 ms |
| v26.0.30                       | 38 ms    | 28 ms  | 15 ms  | 101 ms   |
| a-objective                    | 61 ms    | 41 ms  | 26 ms  | 153 ms   |
| a-search                       | 51 ms    | 29 ms  | 31 ms  | 58 ms    |
| b-grow                         | 10 ms    | 9 ms   | 6 ms   | 12 ms    |
| b-oldrules                     | 13 ms    | 10 ms  | 6 ms   | 19 ms    |

Best fit, each prototype against `head` on the same jobs in one process (`runner.md`, "Build times"; `proto-b.md`, "Build times" and "Code review"; `proto-a.md`, "Build times"):

| Jobs                                              | Version     | 60            | 40    | 20     | 100             |
| ------------------------------------------------- | ----------- | ------------- | ----- | ------ | --------------- |
| 20 public best fits (`runner.md`)                 | head        | 86 ms         | 67 ms | 41 ms  | 459 ms          |
|                                                   | v26.0.30    | 79 ms         | 62 ms | 34 ms  | 402 ms          |
| The same 20 jobs (`proto-b.md`)                   | head        | 96 ms         | 68 ms | 43 ms  | 478 ms          |
|                                                   | b-grow      | 14 ms         | 23 ms | 20 ms  | 39 ms           |
|                                                   | b-oldrules  | 20 ms         | 13 ms | 6 ms   | 90 ms           |
| A's public best fits (`proto-a.md`)               | head        | 84 ms         | 56 ms | 40 ms  | 35 ms           |
|                                                   | a-objective | 99 ms         | 60 ms | 79 ms  | 42 ms           |
|                                                   | a-search    | 154 ms        | 84 ms | 128 ms | 35 ms           |
| 3,000-card plain-03: B 60, and WRG 100 under Rith | head        | 165 to 172 ms |       |        | 946 to 1,011 ms |
|                                                   | a-objective | 301 ms        |       |        | 2,431 ms        |
|                                                   | a-search    | 274 ms        |       |        | 712 ms          |
|                                                   | b-grow      | 23 ms         |       |        | 88 ms           |
|                                                   | b-oldrules  | 76 ms         |       |        | 280 ms          |

- **B is the fastest**, about two to twelve times faster than `head` per build (2 times on the 20-card public best fits, 12 at 100). Its one slow part is a bulk baseline (each style's expected count per color class over every common and uncommon), which takes 3.1 s once per run with the theme rules, outside the build; with a cold cache `b-grow` builds in 28, 22, 19, and 102 ms at 60, 40, 20, and 100 (`proto-b.md`). On a device the baseline must be precomputed.
- **A' best fit is mostly slower than `head`**: it builds every viable style, 12 for the three-color Rith deck, where `a-objective` took 2.4 s. `a-search` at 100 is the exception (712 ms against 946 ms on Rith, and the same 35 ms median on A's public jobs).
- **`head-web` is what a web user waits for**: the whole option search, up to 36 builds per request (`our-builder.md`), 1.2 s at 60 and 1.5 s at 100 on desktop. The same search with B builds would be several times faster; that was not measured. Nothing was timed on a phone.

### Code and data

- **B is new code of its own**: 1,663 lines in `packages/pipeline/src/review/algos/b/` (`wc -l`). From the core it takes only facts and mechanics (legality, card strength, the land formula and mana base, cast chance, templates, curve profiles, roles, commander rules); it never calls the scan, plan choice, theme matchers, deck score, or swap search (`proto-b.md`). It uses none of the learned plan data, pairs, or combos, so the learned work would stop shaping the styles B builds.
- **A' is a modified copy of the current builder**: 3,079 lines in `algos/a/`, of which `builder.ts` (2,114 lines) is the core's 1,923-line file with every change listed in `proto-a.md`, and `select.ts` a verbatim copy. It keeps learned pairs, combos, and commander fit, but drops the learned plan scores and theme targets for honest styles.
- **Both need the theme rules** (`packages/pipeline/src/review/theme-rules.json`, 2,691 lines, read by the 651-line `theme-rules.ts`). Shipping them makes a new config file, and the owner decides config format changes. The rules read oracle text and type lines with regular expressions, which today's matchers never do (`docs/review/shortlist.md`, objection 1), but the data pack already carries oracle text (`CardRecord.text` in `packages/core/src/types.ts`), so no pack schema change is needed. B also needs its bulk baseline shipped as computed data beside the learned files.

### Recommendation

Build on B, the seed-and-grow algorithm, with the honest theme rules (`b-grow`). Ship it first for requested styles at 60, 100, and 40, fix its 20-card halves before 20 moves, and then give it a plan picker that does not lean to one style.

The reasons:

- It ties `a-search` for the best decent rate over all four sizes (88%) and is ahead at 60 and 100 (95% pooled, 11 of 12 on the held-out plain pools); over both batches it has the best pooled head-to-head share (68%, tied with `b-oldrules`) and won its pairs against both A' versions (5 to 3 and 5 to 4). None of these leads is past the noise: on the panel's bar B is at least as good as A', not shown better.
- Its themed decks play their theme: by the keyword check, the judges' plans named it for 26 of 29 over all sizes, against 14 of 29 for `a-search` and 9 of 30 for `b-oldrules`. That points at the owner's complaint fixed, but the panel saw only five `b-grow` Graveyard decks over all sizes (four decent; `main.md` and `small.md`, "By version and requested style"), and one of the two at 100 read as control.
- At 40, where the current builder is weakest (3 of 11 decent), it was decent 11 of 12.
- It is the fastest version, which matters on a phone and in the web's option search.
- It is independent of today's theme judgment, so it does not inherit the matchers' flaws, while A' inherits the copied filler and search.

Its weak spot is 20 cards (7 of 12 decent, 1 of 5 themed halves), which Phase 4 addresses. Over A' the case on decent rate is a tie; it rests on speed, theme fidelity, and fewer inherited flaws. Over `b-oldrules` it rests on what the decks play, not on the decent rate, which cannot tell them apart.

### How sure we are

- **High** that the current builder's themed requests are its weak point (12 of 30 decent over all sizes, against 15 to 19 of about 20 for every prototype at 60 and 100), that it is weak at 40 (3 of 11 against 11 and 12 of 12 for `b-grow` and `a-search`), and that `v26.0.30` is the weakest version (46% over all sizes, 12% of pairs; `combined.out`).
- **Low to moderate** that B beats A' on the panel's bar: 88% each over all sizes, B ahead at 60 and 100 and behind at 20, pairs 5 to 3 against `a-search` and 5 to 4 against `a-objective`. Speed and theme fidelity favor B whatever the panel says.
- **Moderate to low** that `b-grow` beats `b-oldrules` for users: it rests on a keyword check and the judges' setup lists, not on a question the judges were asked.

### What would change it

- B's 20-card halves still miss the bar after the Phase 4 fixes.
- A panel told the requested style ("is this a decent Graveyard deck?") passes `b-oldrules`' or `a-search`'s themed decks about as often as `b-grow`'s.
- B's plan picker cannot reach a style mix the owner accepts without losing its decent rate.
- A fresh panel on new held-out pools puts A' clearly ahead.
- The owner would rather build every style the scan allows than decline a quarter of them; then `b-oldrules`' coverage, or A' with softer floors, weighs more.

## What to build next

Every phase ships on two rules. **Decent rate**: a fresh blind panel on held-out pools (new plain seeds, and theme pools on bases no author has seen), with at least 40 judged decks per size and request kind, so a gap of about 20 points means something (a 15-point gap needs about 60), and the same requests given to both versions where possible, so the singles are paired as well as the head-to-head games. **The first option and the rest of the list**: the first deck the user sees must be judged decent at least as often as today's, and the list below it must still offer the other styles the pool can really build. The style mix itself is not a gate (see the owner's third decision below); it is reported so a skew caused by a scoring artifact, rather than by what the bulk genuinely builds best, can still be caught. Resemblance to real decks is reported as a diagnostic only, never as a gate.

### Owner decisions before the first phase

Asked after the report; answered by the owner on 2026-11-11.

- **Config format**: the theme rules as a new config file, with regular expressions over oracle text, and where B's precomputed bulk baseline lives. **Decided: yes, a new config file.**
- **A requested style that is not viable**: hide it from the Build page, show it with what it lacks, or build the best fit in its place, as the iOS Build button does today. **Decided: show a note that says why the request cannot be built, then show something that can be built, as similar to the request as possible.**
- **The plan picker's lean**: how often a plain shape should win best fit on plain bulk, and how clearly a theme must beat the plain deck the same pool makes. **Decided: best fit means the best deck, with no target mix. Aggro and Midrange being common from bulk is fine. The other options must stay a scroll away for anyone who wants something more unusual.**
- **Build time on a phone**: the budget for one deck and for the Build page's whole option list. **Decided: speed is not a goal in itself; it only needs to stay well short of minutes, since a build that slow would point to a bad algorithm.**

### Phase 1: B for requested styles at 60, 100, and 40

Port `algos/b/` (`b-grow`) into `packages/core` as the builder for requested themed styles and the three shapes at 60, 100, and 40, with the theme rules in `config/` and a loader in the core (no Node), the bulk baseline computed by the pipeline, and the Build page's style list from B's honest viability. First fix the rule findings: Sphinx's Tutelage as Graveyard setup, and opponent mill (Ruin Crab) entering a self-mill deck. Keep `head`'s best fit at 60 and 100 for now (decent 15 times in 16), and keep `head` at 20 until Phase 4. At 40 the gain should be largest: `head` was decent 3 times in 11.

When a requested style is not viable, the app shows a note that says what the pool lacks (for example, "no repeatable way to fill the graveyard") and then builds the nearest thing it can: the closest viable style when one shares the theme's resource, else the best fit. The deck is labelled for what it is, never for the style that was asked.

- **Ship rule**: B's themed decent rate on held-out pools above `head`'s by more than the noise at each size; with the note-and-nearest rule, the rate over all requests not below `head`'s; and judges also asked whether each themed deck is a decent deck of its named style. Report which styles drop out of the lists (`b-grow` declines Energy in 432 of 460 requests, Goad in 116 of 118, Group hug in 298 of 300; `main.md`).
- **Needs from the owner**: nothing further; the config format, the non-viable behaviour, and the time budget are decided above.

### Phase 2: one plan picker

Today three pickers disagree. At 60 and 100 the core's best fit was decent 15 of 16 times and the web's first option 9 of 16, and on six public pools the core's best fit was never the web's first option. The web leans to Midrange (36% of development best fits at 60) and Aggro; B leans to Control (15 of 50) and never picks Aggro at 60; A' leans to shapes at 60 and Ramp at 100. The five same-request pairs at 60 and 100 went 4 to 1 to the web's option, against the singles, so this needs its own test. At 40 the best fit and the web's first option both rest on the hand-rule deck score (decent 3 of 5 and 2 of 5). Build one ranking for best fit, the web's first option, and the Analyze pane at every size, with one rule: the deck the panel would score highest comes first, whatever its style. Fix B's quality measure so cheap creatures are not penalized (otherwise Aggro never wins, which would be a scoring artifact, not a fact about the bulk); ask a theme to beat the plain deck by a clear margin rather than by richness noise, so the first option is the better deck and not the more unusual one. Keep every other viable style in the list below the first option, so a user who wants something more unusual can scroll to it.

- **Ship rule**: first-option decent rate on held-out pools not below `head`'s best fit by more than the noise at each size, and the other viable styles still present in the list. The style mix is reported, not gated.
- **Needs from the owner**: nothing further; the lean is decided above (best fit means the best deck).

### Phase 3: matcher cleanup for the scan and the Analyze pane

Whatever still reads the `config/archetypes.json` matchers (the Analyze pane's counts and Roles bars, the deck score's theme features, the hand synergy rules, the learned plan priors and targets) either moves to the theme rules or gets matchers that agree with them. The theme guide's list (`docs/review/our-builder-themes.md`, "What this shows"): `mill-self` riders such as surveil 1 on removal; `graveyard-fuel-self` on cards that use up or empty the graveyard; looters and sacrifice outlets missing from Graveyard setup; `counters-matter` on charge, nest, and energy counters; `keyword-anthem` on haste for Slivers; `synergy-artifact` on spells that can target an artifact; Aristocrats outlet tags on Treasure and Food outlets, and fodder and outlets sharing one count; `synergy-enchantment` on Shrines. Relearn `config/learned/` with honest counts if any picker keeps learned priors.

- **Ship rule**: the scan, the Analyze pane, and B's viability agree on held-out pools; any change that moves best fit is judged by Phase 2's rules.
- **Needs from the owner**: whether the learned plan data is relearned or retired for themed styles.

### Phase 4: 20-card halves and Commander

**20 cards.** B's halves need rules of their own before B replaces `head` there (8 of 12 decent; `a-objective` 11 of 12). From the small batch: keep cards a half cannot cast out of an 8-land half (Ulamog, the Ceaseless Hunger or Kozilek, Butcher of Truth was dead in 6 of B's 12 halves); set the 20-card floors so a theme works from its own 12 or so spells and the rest of the half still plays when it does not show, as the rubric asks; then judge again against `head` and `a-objective`.

**Commander.** A commander that does a job counts as one card in the rules (`theme-rules.md`, Limits) while B counts it three times; tribes are outside the rules (A' uses the old matchers for them, and `a-search` has no tribe guard); and the core's per-color source rule fails multi-color Commander decks (below).

- **Ship rule**: Phases 1 and 2's rules, at 20 and 100.
- **Needs from the owner**: nothing beyond the earlier decisions.

### Open bugs found along the way

In the core or config (`docs/review/log.md`, also in `docs/todo.md`, unless named):

- The per-color source rule is far stricter than real decks: median shortfall 3 sources at 60 and 40, 11 for multi-color Commander precons.
- `config/roles.json` has no counterspell role.
- A `head` deck (plain-02, UB, 60, Aristocrats) carried Ice Cream Kitty outside its color identity; check the castable rule.
- `curveTargets` returns a leading 0 for bucket 0 while its comment says 1 through 7.
- Sphinx's Tutelage counts as Graveyard setup in the theme rules though it mainly mills the opponent, and the core's learned fit rates it 0.71 for Graveyard (`our-builder.md`).
- Paliano, the High City enters mana bases though, as the judges put it, it "makes no mana outside a draft" (dead in a `head` 40, a `head-web` 40, and a `v26.0.30` 60 deck; `small.md` and `main.md` examples).

In the review tooling:

- The checker flagged dual lands as off-color in mono-color decks built for two-color requests (all of the 53 `b-grow`, 42 `b-oldrules`, and 2 `head` legality flags in the first run). Fixed on 2026-11-09 (checker version 4): lands are judged against the requested colors too. The rerun in `summary.md` leaves 6 `b-grow` flags, all 40-card decks from two-color requests built in one color whose spells use the dropped color in an activated ability (legal for the request, a note for B's color narrowing; `log.md`), and 1 `b-oldrules` flag not yet looked at.
- Real draft decks carry kicker and disguise costs in another color, which the checker reads as off-color (10 of 60 winning 17Lands decks).

## Method and limits

### How the test was built

- **Pools** (`docs/review/pools.md`): 30 plain 3,000-card samples from the corpus noise source with nothing hidden in them, the main test; 54 theme-rich pools (each of 18 styles on plain-01, plain-02, and plain-03, plus 120 copies of the theme's cards); 11 public pools from `eval/pools`. The owner's pools were never built or judged.
- **Requests** (`docs/review/requests.md`): per pool and color, best fit, every style the current scan calls viable, the three shapes by name, and the enriched style on theme pools; two commanders per pool at 100; a two-color slice on plain pools at 60 and 40. 33,452 requests per full version; `head-web` and the random piles got best fit only. 207,161 deck files in all, 24,816 declined (`summary.md`).
- **Versions**: the seven above, plus two anchors with known answers, random legal piles in the same colors and 170 real decks (Commander and 60-card precons, winning draft decks, Jumpstart packets; `docs/review/anchors.md`), and eight hand-built reference decks.
- **Blind packets** (`docs/review/judging.md`): card names, costs, types, stats, and oracle text only; no version, pool, style, deck name, or builder notes; answer keys outside the judges' folders.
- **The panel**: one Opus agent per packet, with the rubric. Calibration came first (160 packets): it failed most random piles, passed every real deck, and passed all 8 hand-built decks. The main batch at 60 and 100: 439 packets, 276 decks (42 per full version: 8 best fit, 10 themed, 3 shapes per size; 16 `head-web` best fits; the hand decks), 53 second copies, 110 pairs; 433 valid answers, 6 invalid, 3 decks with no valid answer (`main.md`). The small batch at 40 and 20: 230 packets, 154 decks (5 best fit, 5 themed, 2 shapes per version and size; 5 `head-web` best fits per size), 26 second copies, 50 pairs; 226 valid answers, 4 invalid (`small.md`).
- **Automatic checks as gates** (`summary.md`): legality, land count, color sources, curve, interaction and threat proxies, honest theme floors, speed. Every builder passes legality and land count, and random piles raise no flag in 86% of 60-card decks, so the checks separate built from random, never good from bad.

### Known biases

1. **Styles come from the current scan.** A prototype was never asked for a style today's scan rules out, so its own coverage is untested. This favors `head`: every request is one its own scan accepts.
2. **The themed sample drew 8 of 18 styles** (`data/review/plans/main.json`, `small.json`): Ramp, Evasion, Voltron, Burn, Landfall, Mill, Tappers, Group hug, Goad, Energy, and tribes went unjudged as requests.
3. **Commanders at 100 are the current core's top two** by its own ordering: the same for every version, but chosen by `head`, which if anything favors it.
4. **Mono-color below 100**, except the two-color slice on plain pools at 60 and 40.
5. **Theme pools were enriched by the current matchers**: 89% of the extra copies are cards today's matchers accept, so they raise exactly the counts `head`'s scan reads (`log.md`). That favors the versions that read those matchers (`head`, `v26.0.30`, `b-oldrules`) on theme pools.
6. **Theme pools are not fully held out.** They are plain-01 to plain-03 plus 120 copies, and those bases were development pools for the prototypes. 131 of the 273 judged decks at 60 and 100 come from them, and the truly held-out ones are the 84 from plain-11 to plain-30 (`heldout.out`). This favors the prototypes, whose authors tuned on those bases. At 40 and 20, `b-grow`'s judged decks came 15 of 24 from theme pools and 3 from plain-11 to plain-30 (`small.out`).
7. **Judges had repository access**; blinding rests on the prompt's instructions. Draft decks, precons, and random piles carry tells no packet can remove.
8. **Judges never saw the requested style.** They judged whether a deck is decent, not whether it is a decent deck of its named theme; collation catches only decks the builder itself labeled as another style (none in either batch). This favors versions whose themed decks drift into plain decks (`b-oldrules`, `a-search`; see "The surprising result").
9. **Shared theme rules.** The prototypes build to the same rules the checks count with, so floor pass rates measure obedience, not quality; and the rubric's guide counts come from the same theme guide, which may lean the panel toward honest counting.
10. **Small cells**: about 20 decks per version and size at 60 and 100 with 5 or 6 pairs per cell; about 12 decks and 2 or 3 pairs at 40 and 20.
11. **Development pools**: the prototypes were developed on plain-01 to plain-10 and the public pools, with plain-11 to plain-30 and the theme pools held out (but see 6).
12. **One judge model.** Two Opus judges agreeing 86% to 96% of the time shows consistency, not independence from the model's shared habits.
13. **Desktop timings.** Nothing was timed on a phone, and `head-web`'s time is the whole option search while the others are single builds.
14. **Separate samples.** Each version's judged decks were drawn separately from what it built, so cells differ in pools and styles, and decliners are judged only on requests they accepted (see "How to read these numbers").
