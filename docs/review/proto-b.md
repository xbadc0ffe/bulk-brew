# Prototype B: seed and grow

B builds the way a person does: pick a plan from honest counts, seed the payoffs the pool supports, grow setup to what those payoffs need, add interaction and card advantage, fill the curve slot by slot, then build the mana. It is the second prototype on the shortlist (`docs/review/shortlist.md`, ideas 3, 4, 5, 9, and 12 in `docs/review/research.md`).

Date: 2026-11-08. Data pack 2026-11-03. Theme rules version 2 (`packages/pipeline/src/review/theme-rules.json`).

**Now in the core (2026-11-11).** The algorithm lives on as the app's builder for styles the player asks for by name at 60, 40, and 100 cards, in `packages/core/src/grow.ts` (`buildDeck` routes there; best fit, 20-card packets, secondary styles, and tribes keep the classic builder). It reads the rules from `config/theme-rules.json` and the bulk baseline from `config/theme-bulk.json`, and its constants from `config/builder-weights.json` under `grow`. What differs from the prototype below: a commander counts once (`commanderCredit` 1, the prototype's 3); the gate has a third rule, so setup for a style marked `setupNeedsPayoff` (Mill, Group hug, Energy) enters another deck only beside a payoff of its own and within the floors' ratio, which keeps Ruin Crab out of Graveyard and plain decks; a requested style the pool cannot support is answered with a note and the nearest deck (the first buildable style in its `kin` list, else today's best fit, else the plain shape the pool fills best when today's best fit would carry the asked-for name) instead of a decline; a deck whose lands would fall outside the template's range counts as unfillable, where the prototype checked only the slack over the formula; and tribes are left to the classic builder. Best fit (`chooseBestFit`) is ported but not wired in. The prototype here stays as it was, for the review.

Two versions share one algorithm:

- `b-grow`: setup and payoff jobs, weights, exclusions, and per-size floors from the theme rules.
- `b-oldrules`: the same algorithm with setup and payoff membership from the live style matchers in `config/archetypes.json`, as the core's candidate facts report them (`enablerOf` and `payoffOf` from `computeFacts` in `candidates.ts`). Each card counts once; a card that is both is a payoff, since payoffs are the rarer job. Weights are 1, floors are the archetype minimums (`minimumsFor`). This separates definitions from algorithm.

Code: `packages/pipeline/src/review/algos/b/` (`builder.ts` the algorithm, `defs.ts` the two sources of definitions and the bulk baseline, `grow.ts` and `oldrules.ts` the two versions). Tests: `packages/pipeline/test/review-proto-b.test.ts`.

**Held-out pools.** B was developed and tuned only on `plain-01` to `plain-10` and the public pools in `data/review/pools/public/`. I did not look at or build `plain-11` to `plain-30` or any theme pool; they are held out for judging.

## What B takes from the core

Facts and mechanics only:

- `listCandidates` for legality, colors, and copy limits; B uses each card's preferred copies (fewer for legendary and expensive cards), and the full limit only as a last resort.
- `cardStrength` (through the candidate facts) for quality within a slot.
- `planLandCount` and `chooseManaBase` from `lands.ts`, `pipDemand` and `castChance` from `colors.ts`.
- `config/deck-templates.json` (role minimums, type mix, land formula), `config/curve-profiles.json` through `curveTargets`, the archetypes' curve profile, role overrides, and type mix overrides, and `config/roles.json` through the facts' roles.
- `canBeCommander`, `inTribe`, and the core's tribal minimums (`tribalArchetype`) at 100 cards.

It never calls the core's scan, plan choice, theme matchers, deck score, or swap search.

## Card facts B computes

For each spell candidate in the deck's colors:

- **Slot**: mana value 1 to 7 (zero-drops sit in slot 1, seven and up in slot 7).
- **Cast chance**: 1 in one color. In two or more, each color's sources are its share of the pool's colored weight (strength times copies of spells asking for it) of the template's base land count, and the chance is the product over colors of the core's `castChance` on curve, given the land drops were made (one more card seen at 100, on the draw).
- **Value** = strength x cast chance. Used to rank cards within one slot or one role.
- **Quality among peers** `q` = value / level, where level is the mean value of the pool's best copies of the same slot and kind (creature or not), taking about a seventh of the spell slots (5 at 60). Strength grows with mana value and cheap spells earn a cost bonus, so comparisons across slots use `q`, never raw strength.
- **Job per style**: setup, payoff, or none, from the definitions, each card once. With the theme rules this is `matchCard` from `theme-rules.ts`; an excluded card or a job of weight 0 is no job.

Theme jobs are cached per card and size. Both versions compute a bulk baseline once in `prepare()`, outside build times (see Step 1).

## The steps

### Step 1: the plan

**Floors.** For a style and size, the floor alternatives come from the rules' `minimums`; a style without them falls back to the config's enabler and payoff minimums as `{ setup, payoff }`. Of several alternatives, B keeps the one the pool meets best.

**Pool tally.** Every copy B may use of every card with a job for the style, plus the commander's job counted three times at 100. Units as the floors name them: setup units (weight capped at 1 per copy), setup weight, repeatable setup copies, payoff units, payoff weight, and repeatable-or-payoff.

**Margin** = the smaller of the setup side and the payoff side, each side being the smallest `have / need` over its floors. A side with no floor does not count.

**A requested style** is built when the margin is at least 1 and the theme core (steps 2 and 3) meets every floor; otherwise B throws `BuildError` naming what is short, and never substitutes another style. Aggro, Midrange, and Control requested by name are built as plain shapes. A tribe (`tribal:<Type>`) is a theme whose setup is creatures of the type and whose payoffs carry `typal-<type>`, with the core's tribal minimums.

**Best fit** builds a deck for every plan without lands (Aggro, Midrange, Control, and each style with a margin of 1 or more whose core meets its floors, plus at 100 each tribe the commander rewards) and scores it:

- **Deck quality** `Q` = the mean over the deck's spell copies of `min(1, q)`: what the plan costs in card quality. Weak cards a plan forces in count against it; a few stars of a lightly used kind do not lift it.
- **Plain shape**: `score = fit x Q`, where `fit` is the share of the template's role minimums, curve slot targets (within the template's curve tolerance), and creature floor that the deck reaches.
- **Theme**: `score = min(margin / 1.5, 1) x min(richness, 2) x Q x lead`, where:
  - a margin of 1.5 or more counts in full;
  - **richness** is the smaller of the pool's setup and payoff over what plain bulk of the same cards' colors holds (below);
  - **lead** is 1.25 when the commander is a payoff of the plan (it rewards it), else 1.
- A theme whose floors name no payoff count of its own (Evasion has none; Burn's can be met by repeatable setup alone) has no engine to balance, so it competes as a plain shape: richness 1.
- The best theme must score above the best plain shape to be chosen. Midrange is tried first among the plain shapes, so it wins a tie.
- **Fallback** (added in code review). When the chosen plan's deck cannot be filled (too few playable cards for the land count, or no mana base), best fit tries the next theme that beat the best plain shape, then the plain shapes by score. `explanation.plan.tried` lists the plans tried first and why each failed; when none fills, the decline names them all.

**Bulk baseline.** Every common and uncommon spell in the pack (Un-sets left out, 20,125 cards), read at 60 cards, gives per style and color class (W, U, B, R, G, multicolor, colorless) the mean tally of one card. A pool's expected tally is the sum over its copies of its class's mean. Tribes get the same baseline by creature type on first use. It takes about 3.1 s once per run for the theme rules and 31 ms for the config matchers.

### Step 2: seed payoffs

Add payoff copies one at a time until the payoff floors are met (times 1.25 when both sides of the pool hold twice their floors). Each pick maximises

`gain x q x room`

- `gain`: the share of each payoff floor's remaining shortfall this copy closes, summed. "Demand met by the pool's supply" is the same for every payoff of one style, since the rules give no per-payoff requirement, so ranking falls to the job's weight (inside `gain`), quality among peers, and cast chance (inside `q`).
- `room`: 1 when the card's slot is below the plan's curve target, 0.5 when it is full, so theme cards go where the curve has space.
- Ties go to strength, then card id.

### Step 3: grow setup

The setup floors are scaled by `max(1, payoff measure / payoff floor)`, the demand the seeded payoffs create in the ratio the floors imply. Setup copies are added one at a time by the same `gain x q x room`, re-scored after every add. A repeatable card closes the repeatable floor too, so it is preferred while that floor is open. Riders are not setup: the rules give them no job or weight 0.

If setup runs out, the weakest seeded payoff copies go again while the payoffs stay above their floor and the setup does not cover them. If the floors are still not met, the plan fails (a requested style declines).

### The payoff gate

Every later step checks it:

- A payoff of the plan enters only when the setup already in the deck covers it: `setup measure >= ratio x (payoff measure + this card)`, with the ratio from the floors (8 setup weight per 6 payoff weight for Graveyard at 60; one per one when there is no payoff floor). A card meeting both jobs counts once, so it never covers its own need.
- A payoff of another style at weight 1 or more needs that style's setup in the deck by the same test, unless it is setup for the plan or fills a spell role (removal, sweeper, card advantage, cheap interaction, ramp). It keeps payoffs with nothing to pay off out of every deck, plain ones included.

### Step 4: interaction and card advantage

Each role in the template, with the plan's role overrides, is filled to its minimum. A card competes only with cards of that role, by value; a card already in the deck counts for every role it fills (the commander too).

### Step 5: curve fill

Spell slots start at the size minus the template's base land count (minus the commander). Repeatedly take the mana value slot furthest below its curve target (the plan's curve profile; the template's at 20 and 100) and add the best card in it by value, keeping the type mix:

- creatures first while the deck is below the creature share;
- no creature above the creature cap, no noncreature permanent above its cap, and only instants and sorceries when the remaining slots are needed for their minimum.

When every slot is at target or has nothing left, the card with the best quality among peers fills in.

In a theme deck, the plan's setup keeps some pull in steps 4 and 5 (added in code review): its value counts 1.25 times while the deck sits at its setup floor (half that for a weight-0.5 job), fading to 1 at 1.5 times the floor. The guide's targets run above its minimums (Graveyard: 10 to 12 setup weight, 8 minimum), so the engine gets some depth instead of stopping at the floor. On the development best fits this adds 0.23 setup units per theme deck on average and leaves the style mix unchanged.

For thin pools, B relaxes in order: the type mix, the copy guideline (full copy limit), then the off-plan gate. It never relaxes the plan's own payoff gate; if the deck still cannot be filled, it declines.

### Step 6: lands

The count comes from `planLandCount` on the spells (the commander left out). When it differs from the slots assumed, B trims curve-step copies, weakest among their peers first (with the setup pull) and never a setup copy whose loss would leave the plan's payoffs uncovered, or fills more, and repeats up to three times. Basics and nonbasic lands come from `chooseManaBase`, with a color plan from the deck's own pips (a color carrying less than the land rules' splash share of the main color's pips is a splash). The deck reports the colors its spells use.

### Step 7: 100 cards

The commander sets the colors (its identity), counts three times toward its theme job in every tally, counts toward roles, and leads best fit when it is a payoff of a plan (the 1.25 lead), including the tribes its `typal-` tags name. Copies are one per card through `listCandidates`.

## Constants

All in `B` at the top of `builder.ts`, set from the theme guide's reasoning, not fitted to a score: margin counts in full at 1.5 floors; richness caps at 2; seeds go 1.25 over the floor on a rich pool; a commander's job counts three copies (the guide's "a setup commander lets you trade 3 or 4 setup for payoffs"); a commander that rewards a plan leads it by 1.25; off-plan payoffs of weight 1 or more are gated; a full slot halves a theme pick; setup keeps up to 1.25 times its value until the deck holds 1.5 times its setup floor (the reviewer's addition, from the guide's targets over its minimums; 0.5 instead of 0.25 adds 0.45 setup units per theme deck with the same style mix).

## Where B departs from the brief, and why

Each change was made after a run on the development pools showed the literal design skewing best fit, which the owner treats as a blocker.

1. **Richness over plain bulk.** On 3,000-card pools every two-sided theme met its floors with room, so margin stopped telling themes apart and best fit went to whichever theme had the broadest definition: Ramp took 43 of the 62 best fits built at 60 on the development pools (first runs of `data/review/scratch/proto-b/bestfit-jobs.json`). A person picks what stands out in this pile, so the theme score uses richness, and margin becomes a soft gate.
2. **Quality among peers, capped at 1.** Raw strength made top-heavy and spell-heavy plans look better (Ramp, then Spellslinger in `b-oldrules`). Normalising by slot and kind fixed that; capping at 1 stopped Control winning plain-shape comparisons by skimming its few creatures (Control took 21 of 50 plain-pool best fits at 60 before the cap, 15 after).
3. **One-sided themes compete as plain shapes.** Evasion and Burn have no payoff floor of their own. Scored as themes, Evasion won three of five public pools and Burn won blue and black plain pools on colorless pingers, with no engine in either.
4. **The commander leads only plans it rewards.** Lathril's menace made it Evasion setup; it rewards Elves.
5. **Theme picks respect the curve.** The Elf tribe's 28 setup copies were picked by quality alone and the deck flagged `curve-flat`.

## Results

### Build times

`buildMs` from the runner, development desktop, 2026-11-08, one batch after the first build. Jobs: the 20 per version in `data/review/scratch/jobs-timing.json` (`bulk-black`, `bulk-blue`, `bulk-green`, `bulk-red`, `white-bulk` at 60, 40, and 20 best fit; `elf-tribe` at 100 under Lathril seeds 1 to 3, Imaryll, and Dwynen). Median, range in brackets. Command: `npm run review:build -- --jobs data/review/scratch/proto-b/jobs-timing-all.json --out data/review/scratch/proto-b/timing --force`.

| Size | b-grow           | b-oldrules        | head                |
| ---- | ---------------- | ----------------- | ------------------- |
| 60   | 14 ms (10 to 34) | 20 ms (14 to 77)  | 96 ms (83 to 223)   |
| 40   | 23 ms (20 to 67) | 13 ms (9 to 51)   | 68 ms (49 to 207)   |
| 20   | 20 ms (19 to 59) | 6 ms (5 to 25)    | 43 ms (38 to 82)    |
| 100  | 39 ms (8 to 107) | 90 ms (28 to 107) | 478 ms (104 to 529) |

The bulk baseline in `prepare()` also caches theme jobs for every common and uncommon. With a cold job cache for every card (`node data/review/scratch/proto-b/cold-time.ts`), `b-grow` takes 28, 22, 19, and 102 ms at 60, 40, 20, and 100, still well under head. On the 3,000-card plain pools, `b-grow` best fit takes a median of 33 ms at 60.

Code review, on the 3,000-card `plain-03`, best fit, median of five builds in one run (`data/review/scratch/proto-b-review/timing-jobs.json`, output in `data/review/scratch/proto-b-review/timing/`):

| Request                           | b-grow | b-oldrules | head    |
| --------------------------------- | ------ | ---------- | ------- |
| B 60                              | 23 ms  | 76 ms      | 165 ms  |
| U 100, Bilbo, Thief in the Night  | 25 ms  | 59 ms      | 233 ms  |
| WRG 100, Rith, Liberated Primeval | 88 ms  | 280 ms     | 1011 ms |

### Determinism

All 18 verification requests below were rebuilt with `--twice` on the final code and were identical. Builds use fixed orders and ties broken by strength, then card id; there is no randomness and no clock. The seed is ignored.

### Verification builds

All in `data/review/decks/b-grow/` and `b-oldrules/`, from `data/review/scratch/proto-b/verify-jobs.json`. `review:check` results went to `data/review/scratch/proto-b/checks-*` so the shared summary in `data/review/checks/` was not replaced.

| Request                          | b-grow                               | b-oldrules                                       |
| -------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `bulk-blue` U 60 Graveyard       | Graveyard, no flags, every floor met | Graveyard, `theme-no-setup`, `theme-no-payoff`   |
| `bulk-black` B 60 best fit       | Control, no flags                    | Aggro, no flags                                  |
| `bulk-green` G 60 best fit       | Enchantments, no flags               | Enchantments, `theme-no-payoff`                  |
| `bulk-red` R 40 best fit         | Voltron, no flags                    | Voltron, `theme-no-setup`, `theme-no-payoff`     |
| `white-bulk` W 60 Tokens         | Tokens, no flags                     | Tokens, `theme-no-setup`, `theme-no-payoff`      |
| `elf-tribe` 100 Lathril best fit | Elf tribe, no flags                  | Aristocrats, `theme-no-setup`, `theme-no-payoff` |
| `bulk-blue` U 20 best fit        | Control, no flags                    | Landfall, `theme-no-payoff`                      |

Every `b-grow` deck in the folder (11) passes legality, mana, curve, interaction, and theme checks. The theme flags on `b-oldrules` read its decks by the theme rules, which it does not use: the same algorithm on the old definitions builds decks the honest count fails. That is the definitions half of the problem, measured.

### What best fit chose, and why

From each deck's `explanation.plan.scores`:

- **`bulk-black` B 60: Control** (0.98) over Evasion (0.97, scored as a plain shape), Aggro and Midrange (0.95). No two-sided theme stood out: Graveyard and Aristocrats have richness under 1 or fail their floors. The hand build is Midrange for the same reason ("no theme in the pool has both halves").
- **`bulk-green` G 60: Enchantments** (margin 0.78, richness 1.75, quality 0.94: 1.28) over Midrange (0.98). The pool holds about 1.75 times the enchantment setup and payoffs green bulk would: Nexus Wardens, Verduran Enchantress, Sanctum Weaver, Rites of Flourishing. The hand build chose Midrange and left that package out.
- **`bulk-red` R 40: Voltron** (richness 1.65, quality 0.87: 1.43) over Midrange (0.98), on Ring of Thune, Samurai's Katana, Fiendlash, and carriers. The hand build chose Midrange around Skyship Stalker, which B does not play.
- **`elf-tribe` 100 under Lathril: Elf tribe** (margin 0.69, richness 1.6, quality 0.88, lead 1.25: 1.21) over Ramp (1.06) and the plain shapes (0.98), as in the hand build. `b-oldrules` picks Aristocrats, which the old matchers find rich here.

### Best-fit style mix on the development pools

`plain-01` to `plain-10`, every color, best fit (`data/review/scratch/proto-b/bestfit-jobs.json`):

| Size | b-grow                                                                | head (stored decks)                                     |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 60   | Control 15, Midrange 12, Tokens 4, Spellslinger 4, 7 other styles 15  | Spellslinger 9, Midrange 7, 14 other styles 34          |
| 40   | Control 11, Midrange 10, Tokens 5, Spellslinger 4, 11 other styles 20 | Artifacts 14, Counters 10, Tokens 10, 7 other styles 16 |
| 20   | Control 8, Midrange 6, Evasion 5, Aggro 5, 12 other styles 26         | Spellslinger 7, 14 other styles 43                      |

`b-grow` builds a plain deck in about half of the 60-card best fits on plain bulk, where no theme stands out; its largest single style is 30% at 60 (head-web's is Midrange at 36%). `b-oldrules` at 60: Control 7, Artifacts 7, Burn 5, 13 other styles 31.

## Comparisons with the hand builds and head

Counts by the theme rules, from `review:check` (`data/review/scratch/proto-b/checks-*`).

### `bulk-blue` U 60 Graveyard

| Deck       | Setup weight (copies, repeatable) | Payoff weight (copies) | Floors                 | Interaction |
| ---------- | --------------------------------- | ---------------------- | ---------------------- | ----------- |
| b-grow     | 9 (5, 4)                          | 6 (9)                  | met                    | 11          |
| b-oldrules | 5 (5, 1)                          | 3 (4)                  | short on all three     | 18          |
| head       | 12 (10, 4)                        | 3.5 (6)                | payoff weight 3.5 of 6 | 10          |
| hand       | 14 (15, 3)                        | 4.5 (6)                | payoff weight 4.5 of 6 | 5           |

- **What B got that head did not:** the payoff floor (6 weight: Conspiracy Unraveler, Makeshift Mauler, Otterball Antics, Ureni's Rebuff), every floor met, and Jace, the Perfected Mind, which head leaves out.
- **What the hand build still has that B lacks:** setup in depth, 15 separate copies against B's 5 (B meets the 8-weight floor with four weight-2 Sphinx's Tutelage and one Jace), so B's engine rests on one card; the loot and draw spells Winternight Stories, Fact or Fiction, Stern Lesson, and Riptide Survivor; Trickster Mage as an outlet; Mana Drain, True-Name Nemesis, and Rangers of Ithilien. B also plays four Ruin Crab as early creatures, which mill the opponent and do nothing for this plan. By the rules v2 count, neither head nor the hand build meets the payoff floor: the rules count neither Torrential Gearhulk nor Constrictor Sage as a payoff.

### `bulk-black` B 60 best fit

| Deck     | Plan      | Interaction | Threats | Curve 1/2/3/4/5/6/7+ | Flags                               |
| -------- | --------- | ----------- | ------- | -------------------- | ----------------------------------- |
| b-grow   | Control   | 25          | 6       | 7/7/7/6/4/2/2        | none                                |
| head     | Counters  | 10          | 8       | 7/12/10/3/3/1/0      | `theme-no-setup`, `theme-no-payoff` |
| head-web | Graveyard | 13          | 6       | 5/11/10/5/3/2/0      | `theme-no-setup`                    |
| hand     | Midrange  | 16          | 13      | 3/8/12/5/6/2/0       | none                                |

- **What B got that head did not:** a plain deck instead of a thin theme (head's Counters is short on both halves, head-web's Graveyard has 2.5 setup weight), and the pool's best removal in numbers: four Grim Bounty, Disfigure, Dark Salvation, Phyrexian Obliterator, Summon: Primal Odin.
- **What the hand build still has that B lacks:** a creature plan. The hand deck runs 25 creatures with three Vampire Nighthawk, Sengir Nosferatu, Salt Vampire, Skirsdag Flayer, and Reaver Ambush; B's Control runs about 10 creatures, three Day of Black Sun, and Mirror Shield, so it wins slowly with few threats.

## Known weaknesses

- **Setup near the floors.** Step 3 grows setup to what the seeded payoffs demand, and weight-2 cards meet a weight floor in few copies (the Graveyard deck's five setup copies). The rules have no copy floor for Graveyard setup. The setup pull added in review lifts setup a little on average but not in that deck: its unused setup (Winternight Stories, Fact or Fiction) are sorceries, and the curve fill takes creatures first while below the creature share.
- **Plain-shape choice is close, and leans away from Aggro.** Plain shapes differ by a few hundredths of quality. Quality is measured against the best five or so copies of each slot and kind, so a deck that needs many cheap creatures (Aggro) digs below that level and scores lower (mean 0.961 against Control's 0.977 at 60): Aggro wins 0 of 50 plain-pool best fits at 60 and 1 at 40, while Control wins 15 and 11. Control's decks lean on removal and sweepers with few threats (the template asks only 2 finishers and a 25% creature share).
- **Themes on plain bulk.** The bulk baseline is the same population the plain pools are drawn from, so a plain pool's richness is near 1 by construction; a theme wins when sampling noise lifts it a little (median richness of chosen themes 1.15 at 60, 23 of 50 best fits). No single theme dominates, but these picks rest on noise rather than a rich pool.
- **Off-plan setup cards enter by strength.** Ruin Crab ("each opponent mills three cards", a Mill engine) enters the Graveyard deck through the early-creature role on a popularity-lifted strength (5.27). Nothing marks setup for another theme as dead in this one. A general penalty would be wrong: off-plan setup for most styles (token makers, counters, artifacts, enchantments, cheap spells, evasive creatures, ramp) is good on its own. The rules would need a mark for setup that does nothing without its payoffs (opponent mill, gifts to opponents).
- **Strength blind spots carry over.** Cards that meet no role and score low (True-Name Nemesis, Rangers of Ithilien, Steel Leaf Champion, Skyship Stalker) rarely get in, as with head.
- **Symmetric and drawback cards.** B does not know Rites of Flourishing helps the opponent too, or that Day of Black Sun kills its own creatures.
- **Richness depends on the baseline.** It is every common and uncommon equally weighted, not print runs or real bulk; on small curated pools it can lift a theme the hand builder judged too thin (green Enchantments, red Voltron).
- **Thin pools decline.** Best fit now falls back through its ranked plans, but the 23 of 85 development declines per size at 40 and 60 (7 at 20) remain: they are public pools asked for colors they hold a few cards in (such as 18 spells for 38 slots), which no plan can fill.
- **Cast chance before lands.** The color split is estimated from the pool before any card is chosen; two-color requests were not part of the development runs.
- **No secondary style.** A requested secondary is ignored and recorded as `secondaryIgnored`.

## What I did not do

- Look at or build `plain-11` to `plain-30` or the theme pools.
- Tune constants against the hand builds or head; the hand builds were read only after the design changes above, for the comparisons.
- Add per-payoff requirements (the rules have no `requires` field), a package-move search, or a plan picker over several builders.
- Change `packages/core`, `config/`, the apps, the data packs, `package.json`, or the theme rules.
- Run the full `npm run check`.

## Reproducing

```sh
npm run review:build -- --version b-grow --pool data/review/pools/public/bulk-blue.json --colors U --size 60 --style graveyard --print --twice
npm run review:build -- --jobs data/review/scratch/proto-b/verify-jobs.json --force
npm run review:check -- --decks data/review/decks/b-grow --out data/review/scratch/proto-b/checks-b-grow --force
npm run review:build -- --jobs data/review/scratch/proto-b/bestfit-jobs.json --out data/review/scratch/proto-b/decks --force
npx vitest run packages/pipeline/test/review-proto-b.test.ts
```

The scratch scripts (`summary.mjs`, `cold-time.ts`, `slot.ts`, `why-out.ts`) and job files are in `data/review/scratch/proto-b/` (gitignored).
