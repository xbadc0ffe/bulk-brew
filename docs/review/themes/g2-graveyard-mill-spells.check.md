# Check: Graveyard, Mill, Spellslinger theme guide

A skeptical check of `docs/review/themes/g2-graveyard-mill-spells.md`.

Evidence was made with these commands, outputs in `data/review/scratch/g2chk3/` (gitignored):

- Example cards: `node packages/pipeline/src/review/cards.ts <names> --style graveyard|mill|spells` into `gy.txt`, `mill.txt`, `spells.txt`.
- Pack counts: `node data/review/scratch/g2chk3/count.ts` into `count.out`; `hate.ts`, `sm.ts`.
- Regular expressions: `node data/review/scratch/g2chk3/regex.ts [names]` into `regex-cards.out` and `regex-pack.out`.
- Real decks: `decks.ts show <id>` into `decks1.out`, `decks2.out`; `spellsdecks.ts <ids>` into `spellsdecks.out`.
- EDHREC: the writer's `node data/review/scratch/g2-edh.cjs <slug> [commanders]`, rerun.

## What holds up

All three sections have the nine parts in order, and nothing is cut off. Every example card was found, and every quoted line of oracle text matches the pack, except the one `repeatable-crime` claim below. These reproduce exactly:

- The drawing-odds table.
- `mill-self` 1,020 (199 small one-shots, 181 small repeatable) and `graveyard-fuel-self` 184 (171 also payoffs).
- `repeatable-loot`: 206 of 228 count as neither. `tutor-to-graveyard`: 27 of 31.
- 902 of 2,788 payoffs, and 562 cards that count as both (264 and 171).
- `mill-opponent` 434 (118 `mill-exile`, 233 also `mill-self`) and `synergy-mill` 91 (28 also enablers).
- Spellslinger: 7,182 and 1,465 enablers; 808 payoffs (38, 22, and 287); 85 that count as both.
- The EDHREC sums (Mill 15.3 to 21.2 opponent-mill and 8.4 to 11.6 repeatable; Meren 11.6 sacrifice outlets; Talrand 40, Veyran 36, Kess 36, Niv-Mizzet 33, Kykar 30; Talrand 11 creatures).
- The learned-plan shares (0.529 at 60; 0.478 and 0.217 of 23 at 40, from 2,290 decks).
- 21 riders in 41 setup copies, and 2 wrong of 7 payoffs.
- Rules 701.17a, 701.25a, 702.108a, 704.5b, and 715.3b (an Adventure on the stack is an instant or sorcery).

The Graveyard numbers would reject the owner's bad deck. Riders count 0, and payoffs count once as payoffs. That leaves about 3 setup weight from two looting sorceries and one loot instant, with no repeatable setup, against a bar of 10 to 12 and 4+.

## Issues

- **Mill, false friends and hints. Claim:** "`repeatable-crime` means targeting an opponent, not repeating: Tome Scour has it", and the hint "Exclude: ... `repeatable-crime`". **Problem:** Tome Scour does not carry the tag. The tag marks crimes a card can commit again and again. Following the hint would drop the guide's own engines. **Evidence:** Tome Scour's tags are "mill, mill-any, mill-opponent, mill-self, single-target-instant-sorcery". The tag is on Millstone, Hedron Crab, Codex Shredder, Jace's Erasure, Cathartic Adept, and Phenax. It is on 142 of 434 `mill-opponent` cards: 134 are permanents, and 40 match the guide's own engine patterns. On instants and sorceries (202 cards) it marks recastable cards: Deep Analysis (flashback), Ancient Grudge, Allay, Anoint. Of 36 "target player mills" spells, only 5 carry it. **Severity: wrong.**

- **Mill, matcher hints. Claim:** "Payoff: `synergy-mill` with `(an opponent|target opponent|defending player)[^.]*graveyard`, or `twice that many`." **Problem:** it misses three of the six payoffs the section names. **Evidence:** with the `i` flag it matches Jace's Phantasm, Mind Carver, and Bruvac. It misses Drown in the Loch ("its controller's graveyard"), Fraying Sanity ("enchanted player mills X cards"), and Consuming Aberration ("your opponents' graveyards"). It matches 25 of 91 `synergy-mill` cards. **Severity: misleading.**

- **Mill, sections 6 and 9 disagree. Claim:** Thieves' Guild Enforcer is a payoff ("mills two only when a Rogue enters"), and Consuming Aberration is "a threat that grows". **Problem:** the engine pattern `whenever [^.]*(each opponent|target player|that player) mills? (two|three|four)` matches Thieves' Guild Enforcer. Consuming Aberration ("Whenever you cast a spell, each opponent reveals cards ... until they reveal a land card, then puts those cards into their graveyard") meets the guide's own setup rule, "mills two or more every turn on its own". Yet section 8 treats the live matchers counting it as an enabler as a fault. **Evidence:** `regex-cards.out`; the helper's `mill.txt` text for both cards. **Severity: misleading.**

- **Graveyard, sections 6 and 9 disagree. Claim:** section 6 makes Splinterfright a payoff, though it mills two each upkeep. **Problem:** the repeatable-setup hint `upkeep, (you may )?mill` matches Splinterfright. By section 3's own weights ("2 at two or more a turn"), it is a weight-2 engine. **Evidence:** of 15 cards that match `upkeep, (you may )?mill`, 7 also carry `cards-in-graveyard-matter`: Bloodcurdler, Cemetery Tampering, Crop Sigil, Deathbonnet Sprout, Patchwork Beastie, Splinterfright, Vilespawn Spider (`regex-pack.out`). A programmer gets opposite answers from sections 6 and 9. **Severity: misleading.**

- **Graveyard, setup weights. Claim:** Millikin is "repeatable self-mill (... 1 at one)". Cathartic Adept ("{T}: Target player mills a card.") is "one card at a time, 0.5 at most". **Problem:** both mill one card per tap, once a turn, but get different weights. Wild Mongrel is weighted 1 in section 3, while section 9 lists `free-discard-outlet` under "Repeatable setup", which the header weights 2. **Evidence:** Millikin's text is "{T}, Mill a card: Add {C}."; Cathartic Adept's is "{T}: Target player mills a card." (`gy.txt`). **Severity: misleading.**

- **Graveyard, matcher hints. Claim:** one-shot setup is `mills? (three|four|five|six|x) cards`. **Problem:** the pattern does not ask who mills, so opponent mill and counterspell riders count as self-mill setup. **Evidence:** it matches Ruin Crab ("each opponent mills three cards"), Didn't Say Please ("Its controller mills three cards"), Phenax, and Fraying Sanity. Of 276 nonland matches, 20 carry no `mill-self` tag at all. The pattern needs a self-mill guard (`mill-self`, and not `each opponent` or `its controller`). **Severity: misleading.**

- **Graveyard, matcher hints. Claim:** a rider is `(surveil [12]|mills? (a|one|two) cards?)` "firing once". **Problem:** the guide never says how to tell "once" from "repeated", so the hint cannot be built as written. The pattern alone hits 382 of 1,020 `mill-self` cards, including the repeatable Millstone, Codex Shredder, Jace's Erasure, Cathartic Adept, Millikin, and Splinterfright. The writer's own `g2-riders.ts` has a repeat test (`{T}`, `}:`, `whenever`, `at the beginning of`, dredge) that belongs in the guide. **Evidence:** `regex-pack.out` (R5 rider hits among mill-self: 382); `regex-cards.out`. **Severity: missing.**

- **All styles, matcher hints. Claim:** the patterns are given as plain regular expressions. **Problem:** most need the case-insensitive flag, and the guide does not say so. Taken literally, they miss their own examples. **Evidence:** without `i`, these miss: Rummaging Goblin ("{T}, Discard a card"), Grisly Salvage and Satyr Wayfinder ("Put the rest"), Corpse Churn ("Mill three cards"), Millstone ("Target player mills two"), Hedron Crab, Ruin Crab, Psychic Corrosion, Guttersnipe, Firebrand Archer, Kiln Fiend ("Whenever you cast"). Source: `regex-cards.out`. **Severity: misleading.**

- **Graveyard, false friends. Claim:** the false-friend list (riders, `graveyard-fuel-self`, flashback) and the strong-payoff hint `cards-in-graveyard-matter`. **Problem:** two large groups of live Graveyard payoffs are not covered:
  - Cards that count only opponents' graveyards. The strong-payoff hint takes them in.
  - Graveyard hate, through `graveyard-fuel` and `castable-from-graveyard`.

  **Evidence:**
  - Wight of Precinct Six ("+1/+1 for each creature card in your opponents' graveyards"), Jace's Phantasm, Consuming Aberration, Drown in the Loch, and Nighthawk Scavenger are all "graveyard (payoff)". About 20 such cards (`hate.ts`).
  - Scavenging Ooze (`hate-graveyard`, payoff via `graveyard-fuel`), Diregraf Scavenger ("exile up to one target card from a graveyard"), and Cling to Dust are live payoffs. 148 live Graveyard payoffs carry `hate-graveyard`.
  - Dimir Dementia, a Mill precon, plays Wight of Precinct Six twice.

  **Severity: missing.**

- **Graveyard, setup jobs. Claim:** the setup list (looters, self-mill, loot spells, entomb, free outlets). **Problem:** two common setup sources are left out:
  - Cycling, which bins the cycled card. There are 351 nonland cards with a cycling keyword, and 7 count as live enablers.
  - Creatures dying, through sacrifice outlets, sacrifice costs, or trades, for creature recursion. These show up only in section 8 and the 100 row.

  Without the second, the 20 row fails a real reanimation packet (see the next issue). **Evidence:** `count.out` (cyclingKeyword 351, cyclingAsGyEnabler 7). Reanimated (1) (JMP, 20) fills the graveyard with Goremand ("sacrifice a creature"), Crypt Lurker ("sacrifice a creature or discard a creature card"), and Miasmic Mummy ("each player discards a card"), plus "mill two" riders (`decks1.out`). **Severity: missing.**

- **Graveyard, enough for a decent deck. Claim:** 60: 10 to 12 setup, 4+ repeatable; 20: 3 or 4 setup, 1+ repeatable. **Problem:** the rows are not tested against any real deck, and the two designed decks checked here fail them.
  - Shallow Graves (EMN intro pack, 60): about 3 repeatable setup cards (Reckless Scholar, Cryptbreaker, Ghostly Wings) and about 7 to 9 setup weight, against 9 to 11 payoffs.
  - Reanimated (1) (JMP, 20): no repeatable setup, and about 1 to 1.5 weight once the "mill two" riders count 0.
  - Grave Robbers (1) (J25, 20) passes, but only just.

  The bar may be right for bulk, but the guide should say that it is stricter than designed decks, and why. **Evidence:** `decks1.out`, `decks2.out`. **Severity: unsupported.**

- **Graveyard, payoff jobs. Claim:** "Payoff jobs the same way" as setup. **Problem:** only regrowth has a weight (0.5). Reanimation, graveyard count, and delve have none. Section 7 asks for "3 setup weight per 2 payoff weight", which cannot be computed without them. The header default (repeatable 2, one-shot 1) does not say whether a static count creature like Boneyard Wurm is 1 or 2. **Evidence:** section 4 of the guide. **Severity: missing.**

- **Graveyard and Mill, table units. Claim:** "About 3 setup weight per 2 payoff weight" next to a table of "Setup 10 to 12, Repeatable 4+", then "With 10 setup copies at 60". **Problem:** the table does not say whether it counts weight or copies. Four repeatable cards at weight 2 already give 8 of the 10 to 12 weight, but only 4 of the 10 copies. The two readings differ by about a factor of two. **Evidence:** section 7 text. **Severity: misleading.**

- **Mill, enough for a decent deck. Claim:** 60: 14 to 18 mill cards with 10 to 12 engines; 100: 12+ engines. **Problem:** both are above the evidence.
  - Dimir Dementia (GTC intro pack, the Mill precon, 60) has 12 opponent-mill copies and about 5 engines: Vedalken Entrancer, Duskmantle Guildmage, Sage's Row Denizen, Consuming Aberration, and cipher on Paranoid Delusions.
  - At 100, the guide's own EDHREC sums under mill commanders give 8.4 to 11.6 repeatable (Mothman 8.4, Bruvac 11.6, Phenax 8.8, Mindskinner 9.8).
  - The Milling (JMP, 20) packet roughly meets the 20 row.

  If 10 to 12 engines at 60 is meant to keep Mill off most bulk pools, the guide should say so, as it does for 100. **Evidence:** `decks1.out`; `g2-edh.cjs` reruns. **Severity: unsupported.**

- **Spellslinger, enough for a decent deck. Claim:** 20: 5 to 7 instants and sorceries, 4+ at mana value 2 or less, 3 or 4 payoffs. **Problem:** all three Spellcasting Jumpstart packets fall short. The reasoning also ignores that the partner packet's instants and sorceries trigger these payoffs too, which explains why the real packets run about one spell per payoff, not two. **Evidence:** Spellcasting (1), (2), and (3) have 5, 4, and 4 instants and sorceries; 2, 2, and 3 at mana value 2 or less; 3 to 5 cast-trigger permanents (`spellsdecks.out`). The 60 row holds: Spellpower, Izzet Spellweaving, and Spellweaver run 20 to 23 spells with 12 or 13 cheap. **Severity: unsupported.**

- **All styles, the 20 row. Claim:** "A 20-card packet is shuffled into a 40-card deck, so it uses the 40 column." **Problem:** the 20 rows are about half the 40 rows. Inside the shuffled 40 cards, that gives clearly lower odds, and the guide does not state them. **Evidence:** recomputed hypergeometric odds by turn 5: 3 setup copies in 40 cards give 67%, and 4 give 78%, against 90% for the 40 row's 6. Mill's 4 engines in 40 give 78%. This is fine for Jumpstart if it is said and meant. **Severity: unsupported.**

- **Spellslinger, setup weights. Claim:** Think Twice is "Cast twice (1.5)". **Problem:** section 9's formula gives 1.75 for the same card. **Evidence:** mana value 2 gives 1, `cantrip` adds 0.25, and `castable-from-graveyard` adds 0.5. Think Twice carries both tags (`spells.txt`). **Severity: misleading.**

- **Spellslinger, evidence. Claim:** "Real decks agree (`config/learned/plans.json`): a median 0.53 of nonland cards are spells at 60, and 2,290 40-card draft decks run about 11 spells and 5 payoffs." **Problem:**
  - The 60 figure comes from 12 decks, which the guide does not say.
  - Both figures are counted with the live matchers, so "5 payoffs" uses the payoff definition this guide calls broken (restricted mana, cost reducers, dig).
  - The decks themselves were picked as Spellslinger by those same matchers.

  This is the "score and yardstick on the same definitions" trap from `docs/algo-review.md`. **Evidence:** `plans.json`: `sizes.60.plans.spells.decks` 12; the features are "theme enablers" and "theme payoffs" (`packages/pipeline/src/plans.ts` `featureNames`). **Severity: misleading.**

## Verdict

**Needs fixes.** The research is careful: every count and quote I tried reproduces, and the Graveyard bar would reject the owner's bad deck.

Fix the wrong `repeatable-crime` claim and its exclusion hint before a programmer uses the hints. Then:

- Make sections 6 and 9 agree on Splinterfright, Thieves' Guild Enforcer, and Consuming Aberration.
- Give the self-mill and rider patterns a who-mills guard and a repeat test, and note the `i` flag.
- Add payoff weights and say whether the tables count weight or copies.
- Add opponent-graveyard counters and graveyard hate as Graveyard false friends, and cycling and creature deaths as setup.
- Either justify the Mill 60 and 100 engine counts and the 20 rows against the real decks above, or loosen them.
