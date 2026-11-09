# Theme guide: Graveyard, Mill, Spellslinger

Part of the Phase 2 theme guide (`docs/algo-review.md`): what counts as setup and payoff for three styles, and how much of each a decent bulk deck needs.

Sources. Card text and tags come from `npm run review:cards -- "<name>" --style <id>`, saved as `data/review/scratch/g2-*.txt` and `data/review/scratch/g2fix4/*.txt`. Pack-wide counts come from the scratch scripts listed at the end, which use the helper's `checkStyle`. Designed decks come from `data/corpus/decks.json`, scored with `gyscore.ts` and `spellsdecks.ts`. Commander evidence comes from `data/edhrec/pages/`, summed with `node data/review/scratch/g2-edh.cjs <slug> [commanders]`: listed cards' inclusion rates added up, a lower bound since each list is cut off. Rules: 701.17 (mill), 701.25 (surveil), 702.108 (prowess), 704.5b (drawing from an empty library loses), 704.5f (a creature with toughness 0 dies).

Weights. Setup: a repeatable engine counts 2, a real one-shot 1, a rider 0, unless a job says otherwise. Payoff weights are given per job in section 4. Each table in section 7 says whether it counts weight or copies.

Matcher hints (section 9) are regular expressions for the case-insensitive flag (`i`), run on oracle text with reminder text removed (`\([^)]*\)`). Without `i` they miss their own examples: Corpse Churn starts "Mill three cards", Millstone reads "Target player mills two cards", Guttersnipe "Whenever you cast" (`data/review/scratch/g2chk3/regex-cards.out`).

Drawing odds (hypergeometric, about 12 cards seen by turn 5; chance to see at least one / at least two copies; `node data/review/scratch/g2fix4/odds.mjs`):

| Copies | 60 cards  | 40 cards   | 99 cards  |
| ------ | --------- | ---------- | --------- |
| 3      | 49% / 10% | 67% / 21%  | 32% / 4%  |
| 4      | 60% / 18% | 78% / 35%  | 41% / 7%  |
| 6      | 75% / 34% | 90% / 59%  | 55% / 15% |
| 8      | 85% / 51% | 96% / 77%  | 66% / 25% |
| 10     | 91% / 65% | 98% / 89%  | 74% / 35% |
| 12     | 95% / 76% | 99% / 95%  | 81% / 44% |
| 16     | 98% / 90% | 100% / 99% | 90% / 62% |

A 20-card packet is shuffled with another packet into a 40-card deck, so it uses the 40 column. Its rows are about half the 40 rows, so its plan shows up less often: 3 copies in 40 cards are seen by turn 5 in 67% of games and 4 in 78%, against 90% for the 6 copies of a 40 row. That is the price of half a deck, and Jumpstart packets pay it too. Where the other packet cannot help (Mill engines, Graveyard setup), the 20 row carries the theme alone. Where it can (any packet's instants and sorceries trigger Spellslinger payoffs), the row counts on it.

### Graveyard (graveyard)

**1. The plan.** "I fill my graveyard fast, then bring back my best creature or play cards that grow with it."

**2. What it builds up and spends.** Cards in your own graveyard; for reanimation and undergrowth, creature cards there. The unit is cards put in per use. Threshold wants seven; delve and escape spend the pile.

**3. Setup jobs.**

- **Looter or rummager on a permanent** (2; it picks the card it bins, such as a reanimation target). Merfolk Looter: "{T}: Draw a card, then discard a card." Rummaging Goblin: "{T}, Discard a card: Draw a card."
- **Repeatable self-mill** (2 at two or more a turn, 1 at one). Stinkweed Imp: "Dredge 5". One a turn, so 1: Millikin and Deranged Assistant: "{T}, Mill a card: Add {C}."; Cathartic Adept: "{T}: Target player mills a card."
- **Big one-shot self-mill** (1 at three or more). Armored Skaab: "When this creature enters, mill four cards." Grisly Salvage, Satyr Wayfinder: "Put the rest into your graveyard." Tracker's Instincts: "Put a creature card from among them into your hand and the rest into your graveyard."
- **Small one-shot on a creature with no other job** (0.5; 1 when it fires on enters and dies). Wailing Ghoul: "When this creature enters, mill two cards." Crow of Dark Tidings: "When this creature enters or dies, mill two cards." The same text on removal, a counter, bounce, a draw spell, or a payoff is a rider (section 5).
- **Loot and rummage spells** (1; 0.5 for one card). Careful Study: "Draw two cards, then discard two cards." Faithless Looting adds flashback (1.5). Thrill of Possibility discards one to draw two.
- **Entomb** (1.5 with reanimation, 1 without). Buried Alive: "Search your library for up to three creature cards, put them into your graveyard".
- **Free discard outlet** (1; it draws nothing, so it needs cards worth discarding). Wild Mongrel: "Discard a card: This creature gets +1/+1".
- **Cycling** (0.5; 1 for a creature card when reanimating, since it bins a target). Striped Riverwinder is a 7-mana creature with "Cycling {U}". 351 nonland cards have cycling, 170 of them creatures.
- **Creatures dying, for creature payoffs only** (reanimation, regrowth, creature counts). A free sacrifice outlet on a permanent (1, needs fodder): Viscera Seer: "Sacrifice a creature: Scry 1." A one-shot sacrifice or discard (0.5; 1 when reanimating and you choose the creature): Crypt Lurker: "When this creature enters, you may sacrifice a creature or discard a creature card. If you do, draw a card." Goremand: "As an additional cost to cast this spell, sacrifice a creature." Miasmic Mummy: "When this creature enters, each player discards a card." Creatures that die in combat are not counted per card; section 7 says what that means for designed decks.

**4. Payoff jobs.** Each card counts once, at its highest weight.

- **Reanimation** (1; needs one good creature there). Zombify: "Return target creature card from your graveyard to the battlefield." Also Animate Dead. Wants 4 to 6 big targets and discard to bin them.
- **Graveyard count** (1, whether the bonus is static or not; needs five to seven cards by turn 5 or 6). Boneyard Wurm: "equal to the number of creature cards in your graveyard". Nimble Mongoose: "+2/+2 as long as there are seven or more cards in your graveyard."
- **Delve, escape, and other costs that exile from your graveyard** (1; they need four to six cards and spend them, fighting threshold). Treasure Cruise ("Delve"), Gurmag Angler. Graf Harvest: "{3}{B}, Exile a creature card from your graveyard: Create a 2/2 black Zombie creature token."
- **Regrowth to hand** (0.5, one dead creature is enough). Gravedigger: "return target creature card from your graveyard to your hand".
- **Self-recursion and flashback** (0.5). "this card from your graveyard", Flashback, Unearth (section 5).

**5. False friends.**

- `mill-self` riders, 0: Price of Fame ("Destroy target creature. Surveil 2."), Ephara's Dispersal (bounce, "Surveil 2."), Hymn of the Faller ("Surveil 1, then you draw a card").
- `mill-self` on an attack trigger, 0.5: Fear of Surveillance ("Whenever this creature attacks, surveil 1.") fills only when it attacks. A tap ability that mills one a turn is a real engine at 1 (Cathartic Adept, section 3).
- `graveyard-fuel-self` uses the card up: Constrictor Sage ("Exile this card from your graveyard: Tap target creature"). Barishi ("shuffle all creature cards from your graveyard into your library") also has `recursion-creature` and undoes the plan.
- `castable-from-graveyard` flashback: Think Twice, Deep Analysis need no setup and do not scale. 0.5 payoff, good to discard.
- Counting only opponents' graveyards: Wight of Precinct Six ("This creature gets +1/+1 for each creature card in your opponents' graveyards."), Nighthawk Scavenger ("power is equal to 1 plus the number of card types among cards in your opponents' graveyards"). They are live Graveyard payoffs through `cards-in-graveyard-matter` (20 such payoffs), but self-mill does nothing for them. They are Mill payoffs.
- Graveyard hate: Scavenging Ooze ("{G}: Exile target card from a graveyard."), Diregraf Scavenger ("exile up to one target card from a graveyard"). Live payoffs through `graveyard-fuel`; 148 live payoffs carry `hate-graveyard`, 118 of them with no reanimation, recursion, count, or delve tag. They eat graveyards, your own payoffs' fuel included. Cling to Dust is hate first; only its escape ("Exile five other cards from your graveyard") counts, as an escape payoff (section 4).

All checked with the helper, as was Merfolk Looter (`repeatable-loot`), which counts as nothing.

**6. Both jobs.** Count once. A card whose body needs a full graveyard is a payoff whatever it fills: Splinterfright's "power and toughness are each equal to the number of creature cards in your graveyard", so with none there it is a 0/0 that dies (704.5f) before its upkeep "mill two cards" fires; Patchwork Beastie "can't attack or block unless" delirium. Otherwise a card that puts in three or more, or fills every turn, is setup, and its graveyard reward is a bonus: Corpse Churn ("Mill three cards, then you may return a creature card"), Crop Sigil ("At the beginning of your upkeep, you may mill a card."). A payoff with a small one-shot rider stays a payoff. Self-only cards are never setup.

**7. Enough for a decent bulk deck.** Setup and Payoff count weight (sections 3 and 4); Repeatable counts copies. Aim for about 3 setup weight per 2 payoff weight; 1 per 1 is the floor.

| Size | Setup weight         | Repeatable copies | Payoff weight | Also                                          |
| ---- | -------------------- | ----------------- | ------------- | --------------------------------------------- |
| 60   | 10 to 12 (8 minimum) | 2+, 3 or 4 better | 6 to 8        | 4 to 6 targets if reanimating; 4 to 7 removal |
| 40   | 6 to 8 (5 minimum)   | 1+, 2 better      | 4 or 5        | 2 or 3 targets; 3 to 5 removal                |
| 20   | 3 to 5               | none required     | 2 to 4        | payoffs that need one creature, not seven     |
| 100  | 14 to 18             | 6+                | 10 to 14      | 5 to 8 targets; sacrifice outlets             |

Ten or eleven weight at 60 is about 8 copies, for example three repeatable at 2 and five one-shots at 1. With 8 setup copies, 85% of games see one by turn 5 and 51% see two. It wins with reanimated or count creatures. At 20, one repeatable copy in the shuffled 40 is seen by turn 5 in only 30% of games, so the row does not require one.

Designed decks, scored with these weights (`node data/review/scratch/g2fix4/gyscore.ts <deck ids>`, output `gyscore.out`), run less setup than the target:

- Seven 60-card graveyard precons (Grave Power, Grave Advantage, Graveborn, Beyond the Grave, Grave Matters, Grave Danger, Shallow Graves): 4.5 to 23.5 setup weight (median 9), 0 to 13 repeatable (median 3), 4 to 12.5 payoff weight (median 9), about 1 setup per payoff. Shallow Graves has 8, 3, and 9. Three of the seven meet the 60 minimums (8 weight, 2 repeatable, 1 per 1).
- Eight Jumpstart packets (Reanimated 1 to 4, Grave Robbers 1 to 4): 4 to 5 setup weight, 0 or 1 repeatable, 2.5 to 5.5 payoff weight. Reanimated (1) has 4, 0, and 2.5; Grave Robbers (1) has 4, 1, and 4. Seven of the eight meet the 20 row's setup and the 1 per 1 floor.

The minimum sits at about the designed median, and the target is stricter on purpose. Designed decks run 13 to 27 creatures, and those that die in trades feed creature payoffs, which a count cannot see. A designer checked that each payoff works, while a bulk builder only counts. And the failure this guide exists to stop is a payoff-heavy deck that passes a count: the owner's Blue deck had about 3 setup weight and no repeatable setup, and fails even the minimum.

At 100, EDHREC self-mill decks list about 11 loot, discard, and self-mill cards against 8.5 payoffs. A setup commander such as Sidisi, Brood Tyrant ("Whenever Sidisi enters or attacks, mill three cards.") lets you trade 3 or 4 setup for payoffs. Decks under Meren of Clan Nel Toth, a payoff, list about 12 sacrifice outlets. Designed Commander precons score lower (Plunder the Graves 12, Grave Danger 6.5, Graveyard Overdrive 6, whose payoffs mostly count all graveyards, which four players fill); the row follows the EDHREC lists.

**8. Where the live matchers differ.**

- Enabler 1, `mill-self` (1,020): 199 fill one or two once (55 on removal, counters, bounce, cantrips), 181 one or two repeatedly. Public-pool decks had 21 riders in 41 setup copies (`docs/review/our-builder-themes.md`).
- Enabler 1, `graveyard-fuel-self` (184, 171 also payoffs): fills nothing.
- Enablers 2 to 6 take `loot`, `rummage`, `discard-outlet` only with a payoff tag: 206 of 228 `repeatable-loot` cards, Careful Study, and Wild Mongrel count as neither.
- Missing: `tutor-to-graveyard` (27 of 31, Buried Alive too); cycling (7 of 351 count); sacrifice outlets for creature recursion.
- Payoffs: `castable-from-graveyard`, `activate-from-graveyard`, `graveyard-fuel`, `reanimate`, `recursion-creature` include self-recursion and restock; at least 902 of 2,788 payoffs have no tag about other graveyard cards. 148 carry `hate-graveyard`, and 20 count only opponents' graveyards.
- Both: 562 cards, 264 through `mill-self`, 171 through `graveyard-fuel-self`.

**9. Matcher hints.** Score setup and payoff for each card, then keep one (last item).

- Repeat test: `(\{T\}[^.\n]*(mill|surveil|discard)|\}: [^.\n]*(mill|surveil)|whenever[^.\n]*(mill|surveil)|at the beginning of[^.\n]*(mill|surveil)|dredge)`. "When this creature enters" fails it, "Whenever" passes. Attack and combat-damage triggers (`whenever [^.\n]*(attacks|deals combat damage)`) count half.
- Repeatable setup, 2: `repeatable-loot`, `repeatable-rummage` on a permanent; Dredge; the repeat test with two or more cards a use.
- Repeatable setup, 1: the repeat test with one card a use (Millikin, Cathartic Adept, Cryptbreaker's "{T}, Discard a card"); `free-discard-outlet` (Wild Mongrel); `free-sacrifice-outlet` on a permanent when the deck has creature payoffs (Viscera Seer).
- One-shot setup, 1: `\bmill (three|four|five|six|seven|eight|nine|ten|x) cards` (you mill), `(target player|each player) mills (three|four|five|six|seven|eight|nine|ten|x) cards` (you may pick yourself), `the rest into your graveyard`, `mulch`; `tutor-to-graveyard` (1.5 with reanimation); `loot` or `rummage` on a spell that discards two. The two mill patterns name who mills: 0 of their 260 hits lack `mill-self`, against 20 of 276 for the bare `mills? (three|four|five|six|x) cards`, which also took Ruin Crab ("each opponent mills three cards") and Didn't Say Please ("Its controller mills three cards").
- One-shot setup, 0.5: one-card `loot` or `rummage`; Cycling (1 for a creature when reanimating); `sacrifice a creature`, `discard a creature card`, or `each player discards a card` once (1 when reanimating and you choose the creature); `\bmill two cards` on a creature with no `removal`, `counterspell`, `bounce`, `cantrip`, or `draw` tag and no payoff hint (`enters or dies` counts 1).
- Rider, 0: any other `(surveil [12]|mills? (a|one|two) cards?)` that fails the repeat test. Of the 382 `mill-self` cards this pattern hits, 182 pass the repeat test (Millstone, Codex Shredder, Jace's Erasure, Cathartic Adept, Millikin, Splinterfright) and 200 do not.
- Never setup: `graveyard-fuel-self`, `restock`.
- Strong payoff, 1: `reanimate-creature` minus `reanimate-self`; `cards-in-graveyard-matter`, `threshold`, `undergrowth`, minus cards whose only graveyard words are `opponents'`, `an opponent has`, `its controller's graveyard`, or `defending player has`; Delve, Escape; `graveyard-fuel` without `hate-graveyard`.
- Light payoff, 0.5: `regrowth-creature`, `recursion-creature` without reanimation; `this card from your graveyard`; Flashback, Unearth.
- Not a payoff: `hate-graveyard` with nothing else above (Scavenging Ooze, Diregraf Scavenger).
- Both: setup under 1, or only from a 0.5 job, loses to any payoff, so riders stay payoffs. Otherwise setup wins, unless a strong payoff's body needs the graveyard (`lhurgoyf`, `cda-power`, or `restricted-attacker`). Of the 7 cards that pass the repeat test through `upkeep, (you may )?mill` and also carry `cards-in-graveyard-matter`, that makes Splinterfright and Patchwork Beastie payoffs, and Bloodcurdler, Cemetery Tampering, Crop Sigil, Deathbonnet Sprout, and Vilespawn Spider setup.

### Mill (mill)

**1. The plan.** "I mill the opponent every turn, hold off their creatures, and they lose when they cannot draw."

**2. What it builds up and spends.** Cards gone from the opponent's library; the unit is cards milled per use, per turn for engines. Drawing from an empty library loses (704.5b). After the opening hand the library holds 53 cards at 60, 33 at 40, and about 92 per opponent at 100, minus a draw a turn.

**3. Setup jobs.**

- **Repeatable engine** (2 at two or more a turn, 1 at one). Hedron Crab: "Whenever a land you control enters, target player mills three cards." Millstone: "{2}, {T}: Target player mills two cards." Also Ruin Crab, Curse of the Bloody Tome, and Consuming Aberration (section 6); one a turn: Codex Shredder, Jace's Erasure.
- **Fed engine** (1; it needs other cards of a type to enter). Sage's Row Denizen: "Whenever another blue creature you control enters, target player mills two cards."
- **Draw-trigger engine** (2, only with card draw). Psychic Corrosion: "Whenever you draw a card, each opponent mills two cards."
- **Big one-shot** (1 at four or more). Tome Scour: "Target player mills five cards." Mind Sculpt: "Target opponent mills seven cards."
- **Small one-shot** (0.5). Thought Scour: "Target player mills two cards."

**4. Payoff jobs.** Mill wins without payoffs; they speed it up or add a threat.

- **Opponent graveyard size** (eight to ten cards there, mid game with three engines). Jace's Phantasm: "+4/+4 as long as an opponent has ten or more cards in their graveyard." Mind Carver, Drown in the Loch.
- **Multipliers** (2, they double setup). Bruvac the Grandiloquent: "they mill twice that many cards instead." Fraying Sanity.
- **A threat that grows.** Wight of Precinct Six: "This creature gets +1/+1 for each creature card in your opponents' graveyards." Nighthawk Scavenger. Neither has `synergy-mill`, so the live Mill matcher misses both. Consuming Aberration grows too, but counts as setup (section 6).

**5. False friends.**

- `synergy-mill` for your own library (27 of 91): Laboratory Maniac ("If you would draw a card while your library has no cards in it, you win the game instead."), Crawling Sensation, Narcomoeba.
- `mill-exile` (118 of 434 `mill-opponent` cards): Benthic Infiltrator ("that player exiles the top card of their library"). Counts toward decking, not graveyard payoffs.
- Riders: Didn't Say Please (counter; "Its controller mills three cards."), Winds of Rebuke (bounce; "Each player mills two cards."). Ghoulcaller's Bell ("{T}: Each player mills a card.") mills you too.
- `repeatable-crime` is not a mill tag. It marks a card that can target an opponent again and again: Millstone, Hedron Crab, Codex Shredder, Jace's Erasure, Cathartic Adept, and Phenax have it; Tome Scour does not. On instants and sorceries it marks recastable cards such as Deep Analysis and Ancient Grudge, both with flashback. It sits on 134 `mill-opponent` permanents, of which 77 pass the repeat test, and 59 permanents that pass the test lack it (Ruin Crab, which mills each opponent and targets no one, and Curse of the Bloody Tome). Use the repeat test, not this tag, in either direction.

All of these were checked with the helper.

**6. Both jobs.** Count once. A card that mills two or more every turn on its own is setup, whatever else it does: Consuming Aberration ("Whenever you cast a spell, each opponent reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard", about 2.5 cards a spell) is an engine whose size is a bonus. Otherwise it is a payoff: Vantress Gargoyle ("{T}: Each player mills a card.") is a flier waiting for seven cards; Thieves' Guild Enforcer mills two only when it or another Rogue enters, and its "+2/+1 and has deathtouch" needs eight cards there; Fraying Sanity's X counts only what other cards put in.

**7. Enough for a decent bulk deck.** All columns count copies; Engines are part of Mill cards.

| Size | Mill cards | Engines | Payoffs | Also                                      |
| ---- | ---------- | ------- | ------- | ----------------------------------------- |
| 60   | 12 to 16   | 6 to 8  | 2 to 4  | 10 to 14 removal, counters, high blockers |
| 40   | 8 to 11    | 4 to 6  | 1 to 3  | 7 to 9 defense                            |
| 20   | 6 to 8     | 4+      | 0 or 1  | offer only when the pool has the engines  |
| 100  | 16 to 22   | 8 to 12 | 3 to 8  | 8 to 10 removal, sweepers                 |

Measure a rate as well as a count. A rough race (`node data/review/scratch/g2fix4/millsim.ts`: engines mill two a turn from the turn after they land, one card cast a turn, one-shots 3.5 cards) gives these median turns to deck the opponent:

- At 60 with 6 one-shots: 5 engines, turn 16; 7 engines, turn 14; 8 engines, turn 13; 10 engines, turn 12. With 7 or 8 engines, 75 to 80% of games have milled 8 or more cards by turn 6.
- At 40 with 4 one-shots: 4 engines, turn 11; 5 engines, turn 10; 6 engines, turn 9.

More engines than 8 gain little. Real decks run about 5 to 7: Dimir Dementia (GTC intro pack, 60) has 11 opponent-mill copies and about 5 engines, and EDHREC mill decks list 8.4 to 11.6 repeatable cards in 99, about 5 to 7 per 60. The row asks a little more, as a margin for a builder that only counts. Because 6 to 8 engines deck slowly, the 60 row asks for 2 to 4 payoffs that win sooner, as Dimir Dementia does with two Wight of Precinct Six, Jace's Phantasm, and Consuming Aberration. Draw-trigger engines need 4 to 6 draw spells. It is a control deck: defense fills most other slots, with a flier as a backup win.

At 20 the other packet adds no mill, so the packet holds close to a whole 40-card deck's mill. The Milling Jumpstart packet has 8 opponent-mill copies, 4 or 5 of them engines, and Bruvac.

At 100 it mills three libraries. EDHREC decks under mill commanders (The Wise Mothman, Bruvac, Phenax, The Mindskinner) list 15.3 to 21.2 opponent-mill cards, 8.4 to 11.6 repeatable, and 3.1 to 7.6 payoffs; these sums are lower bounds, so the row rounds up a little. A milling commander replaces several engines: Phenax gives creatures "{T}: Target player mills X cards, where X is this creature's toughness." Without one, three libraries of about 92 cards are too many for 8 to 12 engines, so do not offer Mill at 100 from bulk.

**8. Where the live matchers differ.**

- Enabler `mill-opponent` (434): no amount or repeat check. 99 mill one or two, 118 exile, 233 also carry `mill-self` and count for Graveyard. Twelve copies that mill two once meet the 60 minimum while milling 24.
- Payoff `synergy-mill` (91): 27 reward only your own library or graveyard. 28 also count as enablers, so they count twice; section 6 settles each once (Consuming Aberration setup, Vantress Gargoyle and Fraying Sanity payoffs). Threats that count opponents' graveyards without `synergy-mill` (Wight of Precinct Six, Nighthawk Scavenger) are missed. Sidisi counts as a mill payoff though it mills itself.
- Minimums: 1 payoff is fine, but the setup bar belongs on milled cards per turn, not a count of 12.

**9. Matcher hints.**

- Repeat test: as for Graveyard, without `discard`, plus `(whenever|at the beginning of)[^.\n]*into their graveyard` for reveal-until-a-land engines (Consuming Aberration, Thief of Sanity). With `mill-opponent` on a permanent it passes 139 cards.
- Engine, 2 at two or more a use, 1 at one: a passing permanent whose trigger runs on its own: `\{T\}`, `\}: `, `at the beginning of`, landfall (`whenever a land you control enters`), `whenever you (draw|cast)`.
- Fed engine, 1: `whenever (this creature or )?another [^.]* enters`, attack and combat-damage triggers (34 of the passing permanents). One that also meets the payoff hint is a payoff (Thieves' Guild Enforcer).
- One-shot: an instant or sorcery, or a `when this creature enters` or `dies` trigger; weight by amount.
- Amount: `mills? (a|one|two|three|four|five|six|seven|eight|nine|ten) cards?`; X or half count about 5, until a land about 2.5 (40% lands).
- Exclude: `mill-exile` for graveyard payoffs; `synergy-mill` cards whose text matches `your (library|graveyard)` and not `opponent|defending player|that player|target player|its controller|each player|their|chosen player|a library|a graveyard|all graveyards|a single graveyard` (27, such as Laboratory Maniac). Do not use `repeatable-crime` (section 5).
- Payoff: `synergy-mill` minus that exclusion (64 of 91, including Jace's Phantasm, Mind Carver, Drown in the Loch, Bruvac, Fraying Sanity, Consuming Aberration, and Thieves' Guild Enforcer); `cards-in-graveyard-matter` whose only graveyard words are `opponents'`, `an opponent has`, `its controller's graveyard`, or `defending player has` (Wight of Precinct Six, Nighthawk Scavenger). The earlier `(an opponent|target opponent|defending player)[^.]*graveyard` matched only 25 of 91 and missed Drown in the Loch, Fraying Sanity, and Consuming Aberration.
- Multiplier, 2: `twice that many|that many cards plus|mills? x cards, where x is the number of cards put into` within `synergy-mill` (Bruvac, Fraying Sanity, The Water Crystal).

### Spellslinger (spells)

**1. The plan.** "I cast a cheap instant or sorcery most turns, and each one grows a creature, makes a token, or deals damage."

**2. What it builds up and spends.** Casts of instants and sorceries (any noncreature spell for prowess); the unit is one cast. A few payoffs count instants and sorceries in the graveyard.

**3. Setup jobs.**

- **Cheap cantrips** (1.25, they keep the chain going). Opt: "Scry 1. Draw a card." Consider, Preordain.
- **Cheap interaction** (1 at mana value 2 or less). Shock: "Shock deals 2 damage to any target." Lightning Bolt.
- **Cast twice** (1.75 by the section 9 formula: 1 for mana value 2, 0.25 for `cantrip`, 0.5 for `castable-from-graveyard`). Think Twice: "Draw a card." with "Flashback {2}{U}".
- **Expensive spells** (0.75 at 3, 0.5 at 4, 0.25 at 5+). Overwhelming Stampede counts today like Opt.
- **Engines that add casts** (2). Goblin Electromancer: "Instant and sorcery spells you cast cost {1} less to cast." Mnemonic Wall returns an instant or sorcery (1).

**4. Payoff jobs.** Permanents that trigger on each cast; they want about one cast a turn.

- **Cast triggers** (1). Guttersnipe: "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent." Young Pyromancer, Kiln Fiend.
- **Prowess and noncreature triggers** (1). Monastery Swiftspear. Firebrand Archer: "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent."
- **Graveyard count** (1 with 18 or more spells, late). Enigma Drake: "power is equal to the number of instant and sorcery cards in your graveyard."
- **Density checks** (0.5). Delver of Secrets flips on an instant or sorcery on top; Prismari Pledgemage attacks only after a spell.

**5. False friends.** `synergy-instant` and `synergy-sorcery` mark any card that mentions the types.

- Restricted mana: Karfell Harbinger ("Spend this mana only to foretell a card from your hand or cast an instant or sorcery spell."). Ramp.
- Dig: Pieces of the Puzzle, Arcane Infusion ("You may reveal an instant or sorcery card from among them and put it into your hand."). Setup.
- Quicken ("The next sorcery spell you cast this turn can be cast as though it had flash."), Cloud Key, Izzet Guildmage (pays to copy). Weak or neither.
- Burrog Barrage: "+1/+0 ... if you've cast another instant or sorcery spell this turn." One-shot: setup.

All of these were checked with the helper.

**6. Both jobs.** An instant or sorcery that also rewards spells is setup: it is a cast, and its reward fires once. A permanent with a cast trigger is a payoff. A cost reducer is a setup engine.

**7. Enough for a decent bulk deck.** All columns count copies; setup weights (section 9) only rank spells against each other. About two spells per payoff, counting the other packet's spells at 20.

| Size | Instants and sorceries | Mana value 2 or less           | Payoffs |
| ---- | ---------------------- | ------------------------------ | ------- |
| 60   | 18 to 22               | 12+, with 4 to 8 cantrips      | 6 to 10 |
| 40   | 10 to 13               | 7+                             | 5 to 7  |
| 20   | 4 to 6                 | 2+                             | 3 to 5  |
| 100  | 30 to 40               | 15 to 20, with 6 to 8 cantrips | 8 to 14 |

With 20 spells at 60, about four of the 12 cards seen by turn 5 are spells; 8 payoffs show one in 85% of games. Removal is mostly the spells; the win is damage triggers or tokens.

Designed decks (`node data/review/scratch/g2chk3/spellsdecks.ts <deck ids>`, output `data/review/scratch/g2fix4/spells60.out`):

- Three Arena starter decks built on spells (Spellpower, Izzet Spellweaving, Spellweaver) run 20 to 23 instants and sorceries, 12 or 13 at mana value 2 or less, 3 cantrips, and 5 to 10 cast-trigger permanents. A fourth, Izzet League, runs 13 spells with 11 cast-trigger permanents and misses the row.
- The four Spellcasting Jumpstart packets run 4 to 6 instants and sorceries, 2 to 4 at mana value 2 or less, and 3 to 5 cast-trigger permanents: about one spell per payoff. That works because the other packet's spells trigger them too. Corpus 20-card packets hold a median 3 instants and sorceries (510 packets, `jmp.ts`), so the shuffled 40 holds 7 to 9 spells, about two per payoff. The 20 row follows the packets.

`config/learned/plans.json` gives a median 0.53 of nonland cards as spells at 60, and about 11 spells and 5 payoffs in 2,290 40-card draft decks. It is not an independent check: the 60 figure rests on 12 decks, both figures count "theme enablers" and "theme payoffs" with the live matchers that section 8 faults for payoffs, and the same matchers chose which decks count as Spellslinger.

At 100, EDHREC average decks run 30 to 40 instants and sorceries (Talrand 40, Veyran 36, Kess 36, Niv-Mizzet, Parun 33, Kykar 30); listed cards alone include 12 to 19 cheap spells. A payoff commander is always out: Talrand, Sky Summoner ("Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake") decks run 11 creatures, so take 6 to 10 other payoffs.

**8. Where the live matchers differ.**

- Enabler `anyTypes instant, sorcery` minus creatures (7,182): no weight by cost; 1,465 cost 5 or more. Missed: Adventure halves (Venture Deeper), cheap artifacts and enchantments for prowess (287 of 808 payoffs trigger on any noncreature spell), spell regrowth (Mnemonic Wall).
- Payoff `synergy-instant`, `synergy-sorcery`, `synergy-noncreature` (808): includes all 38 `cost-reducer-instant-sorcery` cards, 22 `restricted-mana` cards, dig spells, and copy abilities; about 424 have a "whenever you cast" trigger. The public blue deck had 2 wrong payoffs of 7.
- Both: 85 cards, mostly instants and sorceries with `synergy-instant`. Burn reuses these payoff tags.

**9. Matcher hints.**

- Repeatable payoff: a permanent with `whenever you cast an? (instant|sorcery|noncreature)`, `magecraft`, or Prowess; `cast-trigger-you` plus a `synergy-` spell tag.
- Count payoff: `instant and sorcery cards (you own )?in (exile and in )?your graveyard`.
- Not payoff: `restricted-mana`; `impulse-instant`, `impulse-sorcery` (setup); `cost-reducer-instant-sorcery` (setup engine); `gives-flash`.
- Setup weight by mana value: 2 or less 1, 3 is 0.75, 4 is 0.5, 5 or more 0.25; plus 0.25 for `cantrip`, 0.5 for `castable-from-graveyard`. Adventure faces: `(Instant|Sorcery)\W+Adventure` in the type line.
- `if you've cast another` on an instant or sorcery: setup, not payoff.

### Scratch scripts

In `data/review/scratch/`, gitignored, run with `node` from the repo root:

- `g2-match.ts <style> <tag...>`: per tag, cards counted as enabler, payoff, both, or neither.
- `g2-stats.ts <tag> <regex...>`: per tag, cards whose text matches each pattern.
- `g2-riders.ts`: `mill-self` cards by amount and repeat, reminder text removed.
- `g2-self.ts`: Graveyard payoffs with no tag about other graveyard cards.
- `g2-spells.ts`: Spellslinger payoffs by text pattern, enablers by cost.
- `g2-edh.cjs <slug> [commanders]`: EDHREC inclusion sums by job.
- `g2-pool.ts <pool> <color> <style>`: a pool's live enablers by amount and repeat.
- `g2fix4/an.ts`: the section 9 patterns pack-wide (repeat test, who mills, `repeatable-crime`, payoffs, hate, cycling), into `an.out`.
- `g2fix4/check.ts`: the Graveyard rider and self-mill counts with the exact section 9 patterns, into `check.out`.
- `g2fix4/pay2.ts`, `g2fix4/mult.ts`, `g2fix4/rep2.ts`: Mill payoff exclusion, multipliers, and the Mill repeat test.
- `g2fix4/gyscore.ts <deck ids> [-v]`: designed decks scored with the Graveyard weights, into `gyscore.out`.
- `g2fix4/millsim.ts`: the rough mill race, into `millsim.out`.
- `g2fix4/odds.mjs`: the drawing-odds table. `g2fix4/jmp.ts`: instants and sorceries per 20-card packet.
