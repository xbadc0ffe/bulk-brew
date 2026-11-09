# Theme guide: setup and payoff per style

For each of Bulk Brew's 21 styles, this guide says what the deck builds up and spends, which cards set the plan up, which cards pay it off, and how many of each a decent bulk deck needs at 60, 40, 20, and 100 cards. It also says where the live matchers in `config/archetypes.json` count the wrong cards, and gives matcher hints a prototype can start from.

It is for the builder prototypes and the automatic deck checks of the builder review (`docs/algo-review.md`). The judges do not use it. They read the cards and decide for themselves, so the yardstick stays independent of the builders.

How it was written and checked. The styles were written in seven groups, `docs/review/themes/g1` to `g7`. Every example card was printed with the card helper (`npm run review:cards`, data pack 2026-11-03), and every quote comes from that output, not from memory. A second agent checked every section against the helper and the counts; its notes are the `.check.md` files beside each group file. This file puts the checked sections together without rewriting them: only heading levels changed. Counts come from scratch scripts in `data/review/scratch/` (gitignored), named in each section and in the group notes at the end.

Date: 2026-11-08.

Reading a section. Each themed style has nine parts: plan, resource, setup jobs, payoff jobs, false friends, both jobs, enough, where the live matchers differ, and matcher hints. The plain shapes (Aggro, Midrange, Control) have no resource and six parts. "Section 9" or "part 6" inside a style means that style's own part. "The top", "the counting rules", and a group's odds tables mean that group's notes, kept verbatim under "Group notes" at the end. "Judging a plain deck" comes right before Aggro: it says how to tell a plain deck from a themed deck that lost its engine.

## How to count

Every section shares these rules. Where a section sets its own weights or tie rules, its numbers win.

- **A card counts once,** as the job it mostly does. A card that is both setup and payoff never counts for both; part 6 of each style says which way it goes. If one half is a rider, the card is the other job.
- **Repeatable setup weighs about twice a one-shot.** A card that feeds the plan every turn, such as a looter, a token engine, a pinger, or a mana creature, is worth about two cards that do it once. Parts 3 and 4 give each style's weights. Some tables count copies with a separate floor for repeatable cards, others add up weight; part 7 says which.
- **A rider is not setup.** A small one-time bonus on a card that does another job, such as surveil 1 on removal or a Food on a burn spell, counts 0. This is the failure the review exists to fix: the owner's Graveyard decks counted payoffs and removal with a one-card rider as setup.
- **Enough means the plan shows up by turn 5 in most games.** Most sections set the setup floor to show one setup card in about 9 games of 10, and the payoff floor to show one payoff in about 3 games of 4. Cards seen:
  - 60 cards: about 12 to 13 by turn 5.
  - 40 cards: about 12 by turn 5, with a 7-card hand.
  - 20 cards: a packet is half of a shuffled 40-card deck, so it gives about half the cards seen. Judge the partial plan, not a whole one.
  - 100 cards: about 13 by turn 6 or 7, plus the commander, which is there every game. A commander that does a job lowers that job's count, as each part 7 says.

The odds tables in the sections count 12 cards seen by turn 5 at every size, so their 99-card figures are a little stricter than a turn 6 or 7 check.

## Summary table

One row per style, in `config/archetypes.json` order. The 60 and 100 cells are "setup / payoff" from each style's part 7 table, with its repeatable or engine floor in brackets. They count copies, except Graveyard, which counts weight. The plain shapes have no setup or payoff, so their cells give the nearest jobs from their tables. The last column is the biggest gap from part 8 (part 5 for the shapes).

| Style                       | Resource                                                   | Main setup jobs                                                        | Main payoff jobs                                                     | At 60                                                           | At 100                                                                | Biggest matcher gap                                                                            |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Aggro (aggro)               | None, a plain shape                                        | Attackers at 1 to 3 mana, cheap removal that hits creatures            | Reach: cheap burn to the face, evasive bodies, team pump             | 16+ attackers / 6+ reach                                        | 24+ attackers / 10+ reach (3+ team pump)                              | `earlyCreature` counts walls; removal role counts face-only burn                               |
| Midrange (midrange)         | None, a plain shape                                        | Efficient value creatures, removal, a little card advantage            | Top end: 4 to 6 mana threats with evasion, trample, haste, or value  | 18-24 creatures, 6-9 removal / 3-5 top end                      | 26-32 creatures, 8-10 removal / 4-6 top end                           | Removal quota takes bounce, color hosers, and face-only burn                                   |
| Control (control)           | None, a plain shape                                        | Removal and counters, sweepers where the colors allow, card advantage  | A few finishers, ideally flyers                                      | 8-12 removal and counters, 5-8 card advantage / 3-5 finishers   | 9-12 removal and counters, 12-16 card advantage / 4-6 finishers       | Sweeper min 1 rules out most white, blue, and green pools; 166 counterspells meet no role      |
| Tokens (tokens)             | Creature tokens that stay, counted in bodies               | Token engines, bursts of two or more tokens                            | Lasting anthems, enters triggers, team pump, count scalers           | 9-12 (4+ engines) / 6-8                                         | 14-18 (7+ engines) / 8-12                                             | No weights: one-token creatures and temporary tokens count as setup; enters triggers missed    |
| +1/+1 counters (counters)   | +1/+1 counters and the creatures carrying them             | Spreaders, mass placers, single placers, self-growers                  | Counter lords, cash-ins, damage triggers, multipliers                | 10-12 (4+ growth engines) / 5-7                                 | 14-18 (7+ growth engines) / 8-12                                      | About 2,240 of 3,247 enablers never put a counter on another creature                          |
| Aristocrats (aristocrats)   | Creature deaths you cause                                  | Repeatable sacrifice outlets, fodder that dies with value              | Drain, value, and sacrifice triggers on each death                   | 4-6 outlets (3+ repeatable), 8-12 fodder / 4-6                  | 6-10 outlets (5+ repeatable), 10-14 fodder / 6-10                     | Outlets and fodder share one count, so a deck meets it with no outlet                          |
| Graveyard (graveyard)       | Cards in your own graveyard                                | Looters and rummagers, repeatable and big self-mill, loot spells       | Reanimation, graveyard counts, delve and escape, regrowth            | 10-12 weight (8 minimum, 2+ repeatable) / 6-8 weight            | 14-18 weight (6+ repeatable) / 10-14 weight                           | `mill-self` counts riders such as surveil 1; looters count only when also payoffs              |
| Spellslinger (spells)       | Instant and sorcery casts                                  | Cheap cantrips, cheap interaction, flashback, cost reducers            | Cast triggers, prowess, graveyard spell counts                       | 18-22 spells (12+ at 2 or less) / 6-10                          | 30-40 spells (15-20 at 2 or less) / 8-14                              | Payoff tags take any card that names the types; about half have no cast trigger                |
| Lifegain (lifegain)         | Life-gain events, not life points                          | Lifelink bodies, Soul Warden triggers, lifelink granters, Food engines | Per-event (Ajani's Pridemate), once a turn, threshold, amount        | 10-14 (8+ repeatable) / 6-10                                    | 16-22 (12+ repeatable) / 10-14                                        | `lifegain` takes any gain: only 48% repeatable, 201 removal riders                             |
| Artifacts (artifacts)       | Artifacts you control                                      | Cheap artifacts that stay, artifact lands, artifact token makers       | Count, enters, cast, and sacrifice payoffs                           | 16-22 sources (10+ at 3 or less) / 6-8                          | 30-40 sources (15+ at 3 or less) / 10-14                              | Only 38% of live payoffs pass a strict rule; non-artifact token makers missed                  |
| Voltron (auras)             | Attachments on your creatures                              | Equipment, sticky Auras, buff Auras, Aura finders                      | Carriers (hexproof, evasive, double strike), cast and target engines | 12-14 attachments (weighted 18+) / 8-10 (4+ carriers)           | 18-24 attachments (weighted 30+) / 8-12                               | Payoff tags take all `heroic`, `exalted`, and removal such as Fumble; evasive carriers missed  |
| Evasion (flyers)            | Evasive power attacking each turn                          | Evasive attackers, lasting flying granters                             | Flyer lords, lasting anthems, flyer triggers (not required)          | 10-16 attackers, 7+ at power 2+ (weighted 17+) / 0-4            | 18-26 attackers (weighted 30+) / 3-8                                  | Derived evasive counts defenders, power-0 bodies, and conditional unblockable alike            |
| Burn (burn)                 | Damage to the opponent                                     | Burn spells that can hit a player, pingers, punishers                  | Spells into damage, prowess and spell pumps                          | 10-16 burn spells (weighted 14+) / 4-10 pingers and payoffs     | 3-8 burn spells (weighted 12+) / 6-10 pingers, punishers, and payoffs | Payoffs are Spellslinger's tags: about 16 of 659 turn a cast into damage                       |
| Landfall (landfall)         | Lands entering under your control                          | Fetch and bounce lands, land ramp, extra land drops                    | Lasting rewards (tokens, counters, life, damage), one-turn pumps     | 3-6 nonland, plus 2-4 fetch or bounce lands / 8-12 (2+ lasting) | 10-15 nonland, plus 4-8 fetch or bounce lands / 13-17 (4+ lasting)    | Lands never count; enabler takes donate, theft, and land destruction                           |
| Mill (mill)                 | Cards gone from the opponent's library                     | Repeatable mill engines, big one-shot mill                             | Opponent graveyard size, multipliers, threats that grow              | 12-16 mill cards (6-8 engines) / 2-4                            | 16-22 mill cards (8-12 engines) / 3-8, only with a milling commander  | `mill-opponent` has no amount or repeat check                                                  |
| Enchantments (enchantments) | Enchantments cast, entering, and on the battlefield        | Removal Auras, enchantment creatures, Sagas, enchantment token makers  | Enchantress, constellation and eerie, count, leaving                 | 14-18 enchantments (9+ at 3 or less) / 6-8                      | 30-40 enchantments (15+ at 3 or less) / 10-14                         | Half the live payoffs fail a strict rule; token makers missed                                  |
| Ramp (bigCreatures)         | Mana beyond the land count                                 | Mana creatures, mana rocks, land ramp, cost reducers                   | Creatures at 6+, evasive five-drops, X spells                        | 6-10 lasting / 6-10 (3+ at 6+)                                  | 10-16 lasting / 12-20                                                 | Derived `finisher` takes about 5,000 cards, 4-mana 4/4s and defenders included                 |
| Tappers (tappers)           | Opposing creatures tapped when it matters                  | Repeatable tappers, enters tappers, tap spells                         | Tap-trigger engines, tapped-only removal, attackers                  | 8-10 tap sources (4-6 repeatable) / 2-4                         | 15-20 tap sources (8+ repeatable) / 4-8                               | Lock Auras, narrow tappers, and riders count as tappers; payoff tags are mostly removal        |
| Group hug (groupHug)        | Extra cards the opponent draws; at 100 also lands and mana | Repeatable symmetric draw, one-shot draw gifts                         | Draw punishers, full-hand burn, draw rewards                         | 10 (4+ repeatable) / 6-8 (4+ punishers)                         | 10-14 (6+ repeatable) / 6-10                                          | Only 122 of 432 hug-tagged cards are draw gifts; payoff takes draw stax, misses full-hand burn |
| Goad (goad)                 | Forced attacks by opposing creatures                       | Lasting forcers ("goad", "attacks if able"), one-shot goad             | Attack drains, punish triggers, tap and attack punisher Auras        | 10-12 (6+ lasting) / 4-6                                        | 15-20 (10+ lasting) / 5-8                                             | `force-attacker` has no owner check; attack drains and punisher Auras missed                   |
| Energy (energy)             | Energy counters on you                                     | One-shot and repeatable energy makers                                  | Repeatable sinks, scaling one-shots, get triggers                    | 8-10 (3+ repeatable) / 8-10 (4+ repeatable)                     | 12-15 (6+ repeatable) / 10-12                                         | Maker and spender tags overlap on 104 of 141 cards, so 8 cards meet the 60 minimums            |

## Judging a plain deck

A plain deck has nothing to set up and nothing to pay off. Judge it on its plays.

- A plain deck with a working curve, enough interaction, and a way to win is decent. It does not need a theme.
- Read the shape from the cards. A low curve of attackers with burn is Aggro. Good creatures, removal, and a few big threats is Midrange. Answers, card draw, and a few finishers is Control.
- A themed deck that lacks its engine is not rescued by calling it Midrange. Measure this before using the tables below:
  - Count the deck's payoff copies for each theme by that theme's guide (g1 to g6). A card the guide weights at 0.5 counts half, so Gravedigger counts 0.5 for Graveyard.
  - If one theme reaches 6 payoffs at 60 (4 at 40, 2 in a 20-card packet, 10 at 100), judge the deck by that theme's guide, not by these tables. It is decent only if it meets that guide's setup row, with separate setup cards and each card counted once.
  - Quick test: fewer separate setup cards than half the payoffs fails in every theme, since no theme guide asks for less than about one setup per payoff (Landfall and Energy are the lowest). The owner's Blue Graveyard deck had 11 payoff copies and three real setup cards (two looting sorceries and a loot-and-draw instant), so it fails.
  - Reasoning: 6 copies at 60 show one by turn 5 in 75% of games, 4 at 40 in 78%, and 10 at 99 in 74% (`g7fix.txt`). From that count on, the resource decides most games. The floors are also the lower ends of the Graveyard guide's payoff row.
  - Below the floor, a payoff that does little without its resource counts as a card that does nothing.
- Plain decks fail in their own ways: a curve that starts on turn four, removal that cannot hit a creature, no way to win, cards that do nothing in an ordinary game, or early cards the lands cannot cast. The checks below look for those.

**Colors.** The live builder gives each color the sources its most demanding spell needs, by `sourcesNeeded` in `packages/core/src/colors.ts`: the chance, given the deck made its land drops, that enough of those lands make the color. It aims at 90% for the main color and 85% for the second (`config/land-rules.json`). Judge early cards by the same math. Sources of one color for 90% / 85%:

| Card, cast on curve    | 60 cards, 24 lands | 40 cards, 17 lands | 99 cards, 37 lands |
| ---------------------- | ------------------ | ------------------ | ------------------ |
| One pip at one mana    | 15 / 13            | 10 / 9             | 23 / 20            |
| One pip at two mana    | 13 / 11            | 9 / 8              | 19 / 16            |
| Two pips at two mana   | 20 / 19            | 14 / 13            | 31 / 28            |
| One pip at three mana  | 11 / 9             | 7 / 6              | 16 / 14            |
| Two pips at three mana | 17 / 16            | 12 / 11            | 26 / 24            |

From `g7fix-sources.txt`; Commander is on the draw, as the builder assumes. So in two colors at 60, 24 lands split 13 and 11 cast one-pip two-drops of both colors, and one-drops of the main color only, at 85%. Two pips at two mana need 19 or more sources, which only a one-color or nearly one-color deck has. Count early cards the split cannot cast as a curve that starts late.

## Aggro (aggro)

### 1. Plan

Play cheap creatures from the first turns, clear or get past blockers, and finish with burn or flyers before the opponent's bigger cards take over.

### 2. What it needs

- **Attackers at one to three mana.** Power at least equal to mana value, or a keyword that helps attacking: haste, first strike, flying, menace, prowess, an attack trigger. Savannah Lions: a 2/1 for {W} with no text. Raging Goblin: "Haste". Borderland Marauder: "Whenever this creature attacks, it gets +2/+0 until end of turn."
- **A few pump and evasion effects.** "Gets +N/+N", "creatures you control get", "can't block". Brute Force: "Target creature gets +3/+3 until end of turn." Falter: "Creatures without flying can't block this turn."
- **Cheap removal for blockers.** One or two mana, and it must hit a creature. Shock: "deals 2 damage to any target". Disfigure: "Target creature gets -2/-2 until end of turn." Journey to Nowhere: "exile target creature".
- **Reach.** Cheap burn that can hit a player, evasive bodies, or team pump. Lightning Bolt: "deals 3 damage to any target". Suntail Hawk: a 1/1 for {W} with "Flying".

### 3. False friends

- Five-mana 3/3s: Battle Hurda ({4}{W}, "First strike"), Venser's Sliver ({5}, no text). Bad-rate vanillas such as Gray Ogre ({2}{R} 2/2, no text).
- Creatures that cannot attack. Wall of Wood: "Defender (This creature can't attack.)" The live early creature role counts it.
- Defensive cards. Accorder's Shield: "Equipped creature gets +0/+3 and has vigilance."
- Sweepers that hit both sides. Pyroclasm: "deals 2 damage to each creature".
- Lava Axe ({4}{R}): "deals 5 damage to target player or planeswalker". Late, and useless against a blocker, yet the live removal role counts it.

### 4. Enough for a decent bulk deck

| Size | Lands                 | Creatures (attackers at 3 or less) | Removal that hits creatures | Pump or evasion | Reach or team pump | Curve 1 / 2 / 3 / 4 / 5+                  |
| ---- | --------------------- | ---------------------------------- | --------------------------- | --------------- | ------------------ | ----------------------------------------- |
| 60   | 22 to 25, 24 typical  | 20+ (16+, 20+ better)              | 5+, most at 1 or 2          | 0 to 4          | 6+                 | 6+ / 11+ / up to 10 / up to 4 / up to 2   |
| 40   | 16 to 17              | 14+ (11+)                          | 3+                          | 0 to 3          | 4+                 | 3+ / 7+ / up to 7 / up to 3 / up to 1     |
| 20   | 8                     | 8+ (6+)                            | 2+                          | 0 to 1          | 2+                 | 1+ / 4+ / up to 4 / up to 2 / up to 1     |
| 100  | 35 to 37, ramp 6 to 8 | 32+ (24+)                          | 7 to 9, no sweepers         | 4 to 6          | 10+, 3+ team pump  | 4+ / 15+ / up to 18 / up to 12 / up to 10 |

How to read it: "16+" is a floor with no upper limit, and "up to 4" is a cap. Real aggro decks run past the floors: Mono White Aggro plays 30 creatures and 15 one-drops, Mono-Red Aggro 27 creatures and 12 one-drops. The caps that matter are on cards at four and at five or more. Lands are a range: the named aggro decks play 22, 24, 24, and 25, unthemed decks with an aggro curve a median 25 (quartiles 24, 25, 25), and the live formula about 24. Pump is optional: the named decks play no `giant-growth` or `enlarge` card.

Reasoning for attackers. With 16 cheap attackers in 60 cards, 90% of opening hands hold one, and 45% of games on the play (53% on the draw) see one by turn 1, two by turn 2, and three by turn 3. With 20 that rises to 64% (72%), with 24 to 79% (86%). The test ignores mana cost, so it is an upper bound for an attacker every turn. No count makes three early attackers certain; aggro fills the gaps with one-mana burn and pump. The floors sit where about nine opening hands in ten hold an attacker: 16 at 60, 11 at 40 (92%), and 24 at 100 (87%, plus the commander as one more early play). The named aggro decks run 16, 16, 21, and 24 attackers by this guide's definition. Odds from `g7fix.txt`; deck counts from `g7fix-c-decks.txt`.

A way to win is the attackers plus reach: cheap burn that hits players, evasive creatures, or team pump. Reach finishes once a 1/4 blocker stalls the ground. By the reach hint below, the named decks have 8 to 14 (`g7fix-decks.txt`); Mono White Aggro gets 4 of its 9 from team pump. At 100 each opponent starts at 40 life (rule 903.7), so one-shot burn matters less. The deck wants 10 or more, the 60-card density over 61 slots, with at least 3 team pumps such as Overrun ("Creatures you control get +3/+3 and gain trample until end of turn."), and 6 to 8 ramp.

Colors. One color, or a second color only for one-pip cards at two mana or more. One-drops of two colors need 13 or more sources each at 85%, more than 24 lands split two ways. All four named aggro decks are one color.

### 5. Where the live templates differ

- The `aggro` curve profile and the land formula (about 24 lands at an average cost of 2.4) fit.
- Removal 3/5 (min/target) at 60 and 2/4 at 40 is low. Unthemed decks with an aggro curve play a median 7 and 5, the named aggro decks 6 to 19 removal that hits creatures, and cheap burn is removal and reach. Set 5/7 and 3/5, counting only cards that hit creatures.
- `finisher` min 1 asks for a four-mana body with four power. Aggro wins with reach; count that instead.
- `earlyCreature` counts walls, so the 10/14 quota can be met by creatures that cannot attack.
- At 100 aggro has no overrides: it inherits sweeper min 1, which kills its own board, and the Commander curve, about 9 cards at six or more. Add overrides with sweeper 0 and a lower curve.

### 6. Matcher hints

- Attacker: creature, mana value 3 or less, no `Defender` keyword, and power at least its mana value or a keyword in Haste, First strike, Double strike, Flying, Menace, Prowess, or the tag `attack-trigger`. Needs code twice. Matchers have no power condition. They also cannot exclude a keyword (`anyKeywords` only requires one), and no `defender` tag exists. `excludeTags: ["drawback"]` drops 309 of 310 Defender creatures but also 603 cheap creatures with other drawbacks, and `excludeTypeLine: ["Wall"]` misses the 154 Defender creatures that are not Walls (`g7fix.txt`). A keyword exclusion in the matcher schema is a config format change, which needs the owner's approval.
- Vanillas: test for empty oracle text, not for no tags. Savannah Lions has no tags, but Gray Ogre carries `cycle-lea-red-escalate` and Craw Wurm `meme`. The strength part "stats for its cost" judges them.
- Pump: `giant-growth` or `enlarge` (471 cards; Brute Force has both). Not `combat-trick`, which also covers removal and life tricks: Disfigure ("Target creature gets -2/-2 until end of turn.") and Healing Salve carry it, and 160 of its 1,384 cards give -N by the text test `gets? -\d`. Team pump: `power-boost-to-all`, `trumpet-blast`, `anthem`, `overrun`. Evasion: `gives-evasion`, `prevent-blocker`, `prevent-mass-blockers`.
- Reach: `burn-player` without `sweeper`, noncreature, `maxMv: 3` (537 cards). The cap drops Lava Axe and the other 178 noncreature matches at five or more, such as Aether Charge and Arc Blade. Add the derived `evasiveCreature` at mana value 4 or less, and team pump.
- Exclude: `Defender` (needs code, as above), `fog`, `sweeper` without `sweeper-one-sided` (Pyroclasm has no `symmetrical` tag), and creatures at mana value 5 or more with power 3 or less (needs code: no power test).

## Midrange (midrange)

### 1. Plan

Trade well early with creatures that bring extra value, remove the opponent's best threats, then win with a few bigger threats the opponent cannot match.

### 2. What it needs

- **Efficient creatures with value.** Good stats for the cost, or a body plus "When this creature enters, draw a card", "destroy", or "return". Watchwolf (uncommon): a 3/3 for {G}{W} with no text. Thraben Inspector: "When this creature enters, investigate." Man-o'-War: "When this creature enters, return target creature to its owner's hand."
- **Removal.** Unconditional or close: "Destroy target creature", "exile target creature", damage to any target, "-N/-N", "can't attack or block", fight. Murder: "Destroy target creature." Doom Blade: "Destroy target nonblack creature." Prey Upon: "Target creature you control fights target creature you don't control."
- **A little card advantage.** Cards that net a card. Night's Whisper: "You draw two cards and lose 2 life." Divination: "Draw two cards." Mulldrifter: "When this creature enters, draw two cards."
- **A top end that wins.** Four to six mana threats that beat bulk blockers: four or more power with flying, trample, haste, or an enters effect. Serra Angel: a 4/4 for five with "Flying" and "Vigilance". Charging Monstrosaur (uncommon): a 5/5 with "Trample, haste".

### 3. False friends

- Big vanillas at a poor rate. Craw Wurm ({4}{G}{G} 6/4, no text) counts as a big threat today. Hill Giant ({3}{R} 3/3, no text) is filler.
- Color hosers. Pyroblast: "Counter target spell if it's blue" or "Destroy target permanent if it's blue". It scores 9.37, above every other card checked here (Lightning Bolt: 7.89), and counts as removal and cheap interaction, yet it is blank against most opponents. Circle of Protection: Red ("a red source of your choice") is just as narrow for a judge, but it meets no live role and scores 4.05, so the builder has no reason to pick it.
- Removal that cannot hit a creature. Lava Spike: "deals 3 damage to target player or planeswalker". It meets the live removal role.
- Bounce counted as removal. Unsummon: "Return target creature to its owner's hand." It meets `removal` and `cheapInteraction` at strength 7.73, above Murder (7.05), because bounce cards carry `removal-creature`. A bounce spell spends a card to delay one threat. 217 noncreature cards meet the removal role through bounce alone (`g7fix-removal.txt`). Bounce on a body is fine: Man-o'-War is a value creature, not removal.
- Narrow removal that is not color hate. Plummet: "Destroy target creature with flying." It meets `removal` and `cheapInteraction` at strength 6.8, and it is not `single-minded-color-hate`, so dropping that tag keeps it. 105 removal-role cards carry `hate-flying`. One is fine; it does not count as unconditional removal.
- Many combat tricks. Giant Growth ("Target creature gets +3/+3 until end of turn.") is fine as one or two, but tricks are not removal.

### 4. Enough for a decent bulk deck

| Size | Lands    | Creatures | Removal                  | Card advantage         | Top end | Curve 1 / 2 / 3 / 4 / 5+           |
| ---- | -------- | --------- | ------------------------ | ---------------------- | ------- | ---------------------------------- |
| 60   | 24 to 25 | 18 to 24  | 6 to 9                   | 3 to 5                 | 3 to 5  | 2-4 / 10-12 / 8-10 / 5-7 / 4-6     |
| 40   | 17       | 14 to 17  | 4 to 6                   | 2 to 3                 | 2 to 4  | 1-3 / 6-8 / 5-6 / 3-4 / 2-4        |
| 20   | 8        | 7 to 9    | 2 to 3                   | 1                      | 1 to 2  | 1-2 / 3-4 / 3 / 2 / 1-2            |
| 100  | 36 to 38 | 26 to 32  | 8 to 10, 1 to 2 sweepers | 10 to 14, ramp 8 to 10 | 4 to 6  | 3-5 / 13-17 / 14-17 / 9-12 / 10-14 |

A way to win is the top end: three to five threats at 60 that a bulk creature cannot block well. Reasoning: unthemed decks with a midrange curve (the learner's `midrange` profile, 79 decks at 60) sit close to these numbers (removal 7, early creatures 8 or 9, about 23 creatures, 25 lands at 60); bulk midrange fails on card quality, not counts. Count only removal that meets the removal hint below.

Colors. Two colors work. At 60, 13 sources of the main color cast its two-drops at 90%, and 11 of the second cast one-pip two-drops at 85% (9 and 8 at 40). Keep two-pip cards in the main color, at three mana or more (16 to 17 sources).

### 5. Where the live templates differ

- Midrange is the template default, and its counts sit near real decks. The gaps are in what counts.
- The removal quota accepts face-only burn (166 cards meet the removal role with no `removal-creature` tag), color hosers (58 cards tagged `single-minded-color-hate` meet removal or cheap interaction), bounce alone (217 noncreature cards), and flyer-only removal (68 noncreature removal-role cards with `hate-flying`).
- `finisher` accepts expensive vanillas. Prefer evasion, trample, haste, or value.
- `cardAdvantage` counts noncreature cantrips, which only replace themselves, the same as draw-two spells.
- At 100 the template asks removal 6/8 and card advantage 8/12. The 8 unthemed Commander decks with a midrange curve play about 10 and 16. Raise the targets to 9 and 14.

### 6. Matcher hints

- Value creature: a creature whose own enters trigger draws, investigates, removes, or returns a card. Needs code: matchers have no text test. Test each line of the text, with reminder text stripped, against `^When(ever)? (this creature|[A-Z][^,.]*?) enters[^,.]*?, (you may )?(draw|investigate|destroy|exile|return|target player draws|it deals \d+ damage to (any target|target creature)|target creature (an opponent controls )?gets -)`, and drop cards that match `return (a|another|target) [^.]*?you control to its owner's hand`. It finds 642 creatures (`g7fix-value.txt`): Thraben Inspector, Man-o'-War, Mulldrifter, Ravenous Chupacabra, Gravedigger, Aven Interrupter, and Annex Sentry pass. Kor Skyfisher ("return a permanent you control to its owner's hand"), Bloated Toad, and Avian Oddity fail.
- The tag version is looser. `virtual-vanilla` or `virtual-french-vanilla` plus `pure-draw`, `removal-creature`, or `recursion-creature` matches 663 cards: 21 are not creatures (Carrion Cruiser, Fell Gravship), and 56 creatures have no enters, dies, or leaves trigger (Bloated Toad and Avian Oddity, through cycling). It also misses 226 creatures the text test finds. If used, add `types: ["creature"]`.
- Gravedigger meets both and is also a light Graveyard payoff (0.5 in the Graveyard guide). That is fine in a plain deck, because the failed-theme check in "Judging a plain deck" runs first.
- Efficient body: power plus toughness at least twice the mana value at three mana or less, power 1 or more, and no `Defender`. Needs code: no power or toughness test and no keyword exclusion. Without the Defender test, 157 Defender creatures at three or less pass; Wall of Wood (0/3 for {G}) scores 3 against a bar of 2.
- Top end: derived `finisher` with `evasiveCreature`, Trample, Haste, or the enters test above; rank a vanilla `finisher` last. Of 3,234 creatures at four to six mana with power 4 or more, 1,319 have Flying, Trample, Haste, Menace, or the enters test.
- Removal: two clauses, so bounce counts only next to another kind of removal. First `{ allTags: ["removal-creature"], excludeTags: ["removal-bounce", "sweeper", "single-minded-color-hate"] }`; then `{ allTags: ["removal-creature", "removal-bounce"], anyTags: ["removal-destroy", "removal-exile", "removal-burn", "removal-toughness", "removal-sacrifice", "removal-fight", "removal-tuck", "pacifism", "lockdown"], excludeTags: ["sweeper", "single-minded-color-hate"] }`. It keeps Murder, Doom Blade, Pacifism, Claustrophobia, Journey to Nowhere, Prey Upon, and Disfigure, and drops Unsummon, Pyroblast, Lava Spike, and all 217 bounce-only cards. It keeps Plummet, so rank cards with `hate-flying` (67 noncreature matches) below unconditional removal and count at most two.

## Control (control)

### 1. Plan

Answer threats one at a time or several at once, draw more cards than the opponent, and win late with a few finishers.

### 2. What it needs

- **Interaction to survive.** Spot removal, counterspells in blue, and blockers. Doom Blade: "Destroy target nonblack creature." Counterspell: "Counter target spell." for {U}{U}. Wall of Omens (uncommon): a 0/4 with "Defender" and "When this creature enters, draw a card."
- **Card advantage.** Cards that net a card, or a body plus a card. Compulsive Research: "Target player draws three cards. Then that player discards two cards unless they discard a land card." Phyrexian Rager: "you draw a card and you lose 1 life".
- **Sweepers where the colors allow.** "Each creature", "All creatures get -N/-N". One-color common and uncommon sweepers are mostly black (88) and red (100). White has 7 and blue 8; white's are mostly rare (131 rare or mythic). Green has 20, but 17 hit only flyers, such as Hurricane. Drown in Sorrow: "All creatures get -2/-2 until end of turn." Electrickery: "deals 1 damage to target creature you don't control", with overload for each one.
- **A few finishers.** Threats that win alone once the board is clear, ideally flyers. Air Elemental (uncommon): a 4/4 for five with "Flying". Serra Angel: "Flying" and "Vigilance", so it attacks and still blocks.

### 3. False friends

- Cheap attackers with no late use: Goblin Piker ({1}{R} 2/1, no text).
- Fog: "Prevent all combat damage that would be dealt this turn." One turn for one card.
- Life with no card. Healing Salve: "Target player gains 3 life". It counts as cheap interaction today, through its `combat-trick` tag. Of the 54 cheap-interaction cards that gain life and carry no removal tag, 22 are life or prevention alone like it (Healing Grace, Candles' Glow). The other 32 are pump tricks with a lifelink or life rider, such as Give In to Violence ("Target creature gets +2/+2 and gains lifelink until end of turn.").
- Bounce and narrow removal, as in Midrange. Unsummon spends a card to delay one threat, which costs Control the card it is trying to gain. Plummet answers only flyers.
- Narrow hosers. Deathgrip: "{B}{B}: Counter target green spell."
- Expensive vanillas. Enormous Baloth ({6}{G} 7/7, no text) can be chump-blocked each turn.
- Noncreature cantrips. Opt ("Scry 1." and "Draw a card.") nets no card.

### 4. Enough for a decent bulk deck

| Size | Lands    | Creatures | Removal and counters | Sweepers                                                    | Card advantage        | Finishers | Curve 1 / 2 / 3 / 4 / 5+            |
| ---- | -------- | --------- | -------------------- | ----------------------------------------------------------- | --------------------- | --------- | ----------------------------------- |
| 60   | 25 to 27 | 9 to 17   | 8 to 12              | 1 to 3 in black or red; 0 to 2 in white or blue; 0 in green | 5 to 8                | 3 to 5    | 2-3 / 7-9 / 8-10 / 6-8 / 6-8        |
| 40   | 17 to 18 | 6 to 11   | 5 to 7               | 0 to 1                                                      | 3 to 4                | 2 to 4    | 1-2 / 5-6 / 5-6 / 4-5 / 4-5         |
| 20   | 8        | 3 to 6    | 3                    | 0                                                           | 1 to 2                | 1 to 2    | 1 / 2-3 / 3-4 / 2 / 2-3             |
| 100  | 37 to 39 | 15 to 25  | 9 to 12              | 2 to 4                                                      | 12 to 16, ramp 7 to 9 | 4 to 6    | 3-5 / 10-14 / 13-16 / 10-13 / 14-18 |

A way to win is the finishers plus the card draw to find them.

Reasoning. The six named control decks at 60 play 1 to 16 creatures, 25 to 28 lands (median 26), 10 to 20 removal and counters, 4 to 14 net card advantage (median 8.5), and 3 to 7 cards at six or more (median 4) (`g7fix-c-decks.txt`, `g7fix-decks.txt`). The tuned ones hold the board with sweepers and counters and play 1 to 6 creatures. Bulk can copy that only in part. One-color common and uncommon sweepers are W 7, U 8, B 88, R 100, G 20, and common or uncommon counterspells at three mana or less are almost all blue (U 197; W 7, B 2, R 3, G 2) (`g7fix.txt`). So a bulk control deck also holds the ground with creatures that block or draw, as Control Center does with 16 creatures and 20 commons among its 34 spells. The creature range is the live type mix, 25% to 50% of the spells. Above 17 at 60 a deck nears Midrange's live floor of 55% (about 19), and Control turns into a second Midrange.

Card advantage. With 5 net card advantage cards at 60, 69% of games see one by turn 5 (`g7fix.mjs`), and the named decks run 4 to 14. Bulk has plenty in blue (288 noncreature common or uncommon cards by the hint below) and black (119). White (71) and red (64) have fewer, and their bodies that draw (78 and 108) fill in. The `control` profile's median of 3 comes from the mislabeled decks above and is not evidence.

At 100 the one named control precon, Seize Control, plays 14 creatures, 39 lands, 7 removal, 4 sweepers, and 15 net card advantage. The floor of 15 creatures is the live 25%; the cap of 25 stays under Midrange's 26.

Colors. Two-pip counters such as Counterspell ({U}{U}) need 20 to 21 blue sources of 26 lands on turn 2 and 17 to 18 on turn 3 (`g7fix-sources.txt`). Five of the named two-color control decks run 15 to 19 sources of their main color, so they accept lower odds; Nassif's deck fixes with fetch lands instead. In a bulk deck, keep two-pip cards in the main color and count them as plays from turn three.

### 5. Where the live templates differ

- Sweeper min 1 at 60 marks Control not viable in a pool with no sweeper, likely in white, blue, or green pools, whose one-color common and uncommon sweepers number 7, 8, and 20 (17 of green's hit only flyers). A white pool with rares may have one. Make it min 0, target 2, in black and red.
- Of 420 noncreature counterspells (Un-sets removed), 231 cost three or more. 207 of those miss the removal role, and 166 meet no role at all, Cancel ("Counter target spell.") among them. The other 41 count through `cardAdvantage` (39, such as Contradict: "Counter target spell." and "Draw a card."), `ramp` (1), or `sweeper` (1). Source: `node packages/pipeline/src/review/cards.ts --tag counterspell --limit 0 --json`, saved as `g7fix-counter.json`. Count counters up to three mana as interaction.
- The 50% creature cap (about 17, 11, and 6) fits the named decks, which play 1 to 16. Keep it. A higher cap overlaps Midrange's live floor (55% at 60, 50% at 40), the style mix the owner treats as a blocker. What the creatures do matters more: prefer the defensive bodies and bodies that draw in the hints.
- The curve puts about 6 cards at six or more at 60 (16% of 35); the named control decks play 3 to 7, median 4. Move share from 7+ to three and four.
- The land formula gives about 27 at the profile's average cost of 3.7; the named control decks play 25 to 28, so it fits.
- `cardAdvantage` 4/7 can be met with cantrips.
- At 100 Control has no overrides and takes the template's removal 6/8, sweeper 1/3, and card advantage 8/12, the same as Midrange. Seize Control plays 7 removal, 4 sweepers, and 15 net card advantage. Add 7/10, 2/4, and 10/14, a first guess from one named deck.

### 6. Matcher hints

- Interaction: removal by the Midrange removal hint (no bounce alone, no `single-minded-color-hate`), noncreature `counterspell` up to mana value 3, and `sweeper` with `removal-creature`.
- Net card advantage: `burst-draw`, `draw-engine`, `repeatable-card-advantage`, or `pure-draw` without `cantrip`. A `cantrip` counts in full on a creature (Wall of Omens), half on an instant or sorcery.
- Defensive body: `Defender` with toughness 4 or more, or `freeze`, `damage-prevention-self`, or `Lifelink`. Toughness needs code.
- Finisher: derived `finisher` with `evasiveCreature`, or a planeswalker; `commanderFinisher` at 100.
- Exclude: `fog`. Life tricks need no exclusion: the interaction hint above never counts `combat-trick` or `lifegain`, so Healing Salve is already out.

## Tokens (tokens)

### 1. Plan

Make lots of small creatures, then make them all bigger or turn each one into damage.

### 2. Resource

Creature tokens that stay on the battlefield, counted in bodies.

### 3. Setup jobs

- **Engine** (weight 2): "create ... creature token" after "{T}:", a mana cost and colon, "At the beginning of", or a "Whenever" the deck meets each turn. Selesnya Guildmage: "{3}{G}: Create a 1/1 green Saproling creature token." Squirrel Nest: 'Enchanted land has "{T}: Create a 1/1 green Squirrel creature token."' An engine fed by another resource (life gained, energy, a nontoken death, spells cast) weighs 1, since it runs only when the deck supplies that resource.
- **Burst** (one-shot, two or more tokens, weight 1). Raise the Alarm: "Create two 1/1 white Soldier creature tokens." Drey Keeper: "When this creature enters, create two 1/1 green Squirrel creature tokens." Dark Salvation: "Target player creates X 2/2 black Zombie creature tokens, then up to one target creature gets -1/-1 until end of turn for each Zombie that player controls." Aimed at yourself, it is X Zombies plus removal.
- **Creature plus one token** (weight 0.5): filler, not setup alone. It counts half in the table.
- Temporary tokens (sacrificed at the next end step) halve the weight: they attack or feed Aristocrats but never build a board.

### 4. Payoff jobs

- **Lasting anthem** (weight 2, 3+ creatures). Gaea's Anthem: "Creatures you control get +1/+1." Scarce in bulk: a text search found about six non-typal ones at common or uncommon.
- **Enters trigger** (weight 2, wants an engine). Impact Tremors: "Whenever a creature you control enters, this enchantment deals 1 damage to each opponent." Corpse Knight: "each opponent loses 1 life".
- **Team pump**, the finisher (weight 1, 4+ attackers). Overrun: "Creatures you control get +3/+3 and gain trample until end of turn."
- **Count scaler** (weight 1, 3+). Coordinated Maneuver: "deals damage equal to the number of creatures you control".
- **Tap for value** (weight 0.5). Convoke and "tap untapped creatures" costs turn spare bodies into mana or effects. Stoke the Flames: "Convoke" and "Stoke the Flames deals 4 damage to any target." Siege Zombie: "Tap three untapped creatures you control: Each opponent loses 1 life." Good in a token deck, but not its plan, so they count half. The pack has 104 convoke cards (`g1chk/broad.ts`).

A payoff that needs one token (Seasoned Warrenguard: "attacks while you control a token") is weak.

### 5. False friends

From the `repeatable-creature-tokens`, `multiple-bodies`, `anthem`, `keyword-anthem`, and `creature-count-matters` listings:

- Temporary tokens: Dragonback Lancer (Mobilize 1, "Sacrifice it at the beginning of the next end step"), Thatcher Revolt. Good Aristocrats fodder, no board.
- Fed by another resource (weight 1 at most): Griffin Aerie ("if you gained 3 or more life this turn"), Anafenza, Unyielding Lineage ("another nontoken creature you control dies"), Field of Souls ("Whenever a nontoken creature is put into your graveyard from the battlefield"), Aether Chaser ("you may pay {E}{E}. If you do, create a 1/1 colorless Servo artifact creature token", and it brings only two energy itself).
- Not tokens, or not yours: Badgermole (earthbend), Invading Manticore (amass grows one Army), Mogg Infestation ("Destroy all creatures target player controls. For each creature that died this way, that player creates two 1/1 red Goblin creature tokens."), a one-sided wipe that gives the opponent the Goblins. "Target player creates" alone is yours: Dark Salvation is setup (section 3).
- Narrow payoffs: Valley Questcaller ("Other Rabbits, Bats, Birds, and Mice"), Bebop, Warthog Warrior ("Rhinos you control have menace."), Absolute Grace ("All creatures have protection from black."), Drove of Elves ("the number of green permanents you control").
- Anti-payoffs: Always Watching ("Nontoken creatures you control get +1/+1"), Thraben Watcher. Wipes that grow with the board: Blasphemous Act ("This spell costs {1} less to cast for each creature on the battlefield." and "Blasphemous Act deals 13 damage to each creature.") is a `creature-count-matters` payoff that kills the token board.

### 6. Both jobs

Goblin Surprise (pump or two Goblins) and Drey Keeper (a Squirrel-only pump rider) are setup. Selesnya Guildmage is real on both sides and counts once, as setup: its engine weighs 2, its team pump 1.

### 7. Enough

Setup and payoffs count copies with the half rule; engines are the weight-2 copies. Real decks: setup / engines / payoffs, counted the same way.

| Size | Setup    | Engines  | Payoffs | Real decks                                                                    |
| ---- | -------- | -------- | ------- | ----------------------------------------------------------------------------- |
| 60   | 9 to 12  | 4+ (60%) | 6 to 8  | 9.25 / 4.5 / 6.5, top 8 precons                                               |
| 40   | 6 to 8   | 3+ (67%) | 4 to 5  | 6 / 3 / 5, top 100 drafts                                                     |
| 20   | 3 to 4   | 2 (52%)  | 2       | 3.5 / 2 / 2, top 8 Jumpstart                                                  |
| 100  | 14 to 18 | 7+ (61%) | 8 to 12 | 14.75 / 9.5 / 6.75, top 10 precons; 13 / 5 / 4.5, 13 EDHREC-commander precons |

The setup floors show one setup card by turn 5 in about 9 games of 10 (9 at 60: 89%; 6 at 40: 90%; 14 at 99: 86%). With single tokens counted half, the 60 floor moved from 10 to 9, near the top precons' median of 9.25. The engine floors are the "3 games of 5" kind, since bursts stand in for engines: the 40 floor moved from 2 to 3 and the 100 floor from 8 to 7 to match the 60 one. The 100 payoff floor asks for more than the precons play by this count (6.75 and 4.5), because 8 payoffs in 99 already show one by turn 5 in only 66% of games, against 75% for 6 at 60. Several EDHREC-commander precons hold few token payoffs by this count (Vampiric Bloodlust 1, Undead Unleashed 2, Multiverse Reforged 2). About 3 setup to 2 payoffs, plus cheap creatures and 5 to 8 removal at 60. An engine commander (Emmara, Soul of the Accord: "Whenever Emmara becomes tapped, create a 1/1 white Soldier creature token with lifelink.") cuts setup by 3 or 4; spend the slots on payoffs. EDHREC token decks favor enters and token triggers: Impact Tremors 29%, Mirkwood Bats ("Whenever you create or sacrifice a token, each opponent loses 1 life.") 29%.

### 8. Where the live matchers differ

Enablers: `anyTags repeatable-creature-tokens|multiple-bodies`. Payoffs: eight tags.

- No weights: Raise the Alarm equals Selesnya Guildmage.
- `repeatable-creature-tokens` (1,412 enablers) includes 91 `temporary-token` cards (109 across both enabler tags) and engines that need energy, life gain, a nontoken death, or spells. `multiple-bodies` (881) holds about 280 cards that put one token beside a creature (a rough text count finds 278), plus earthbend, amass, manifest, offspring, and 28 `donate-token` cards (61 across both enabler tags).
- `power-boost-to-all` (1,206 payoffs, 449 by it alone): about 360 one-turn pumps and many lords; 633 payoffs carry `typal`. `keyword-anthem` (513, 395 alone) is mostly narrow or symmetric. `creature-count-matters` (321) counts colors, snow, and lands, and holds wipes that scale with the creature count, such as Blasphemous Act. 48 payoffs say "nontoken".
- Missed: enters triggers (Impact Tremors, Corpse Knight, Molten Gatekeeper; tags `impact-effect`, `creaturefall`) and tap-for-value cards.
- 384 cards count as both.
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 3 at 40, 8 and 4 at 60. There is no 100 entry: Commander takes the 60 minimums times 1.6, rounded up (`builderWeights.commander.minimumScale`), so 13 and 7. They count unweighted copies, and a dual counts on both sides. For best fit the scan also asks for the lower quarter of real decks (`learned.quartileMinimums`); a picked style keeps these hand-set ones. This guide asks for as much or more at every size, counted more strictly: at 60, 9 setup with single tokens counted half, 4 of them engines, and 6 payoffs counted apart from setup.

### 9. Matcher hints

Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Engine: a line matching `(\{T\}|\}|^at the beginning of|^whenever)[^.]*create[^.]*creature tokens?` (also inside `has "..."`) whose cost does not sacrifice, exile, or discard the card itself, or a `^(mobilize|myriad)\b` line. The cost check drops Twitching Doll ("{T}, Sacrifice this creature: Create a 2/2 green Spider creature token with reach for each counter on this creature."), a one-shot. Weight 1 when the line also matches `if you gained|pay \{E\}|nontoken|whenever you cast` (Griffin Aerie, Field of Souls) or the tokens are temporary. Use `repeatable-creature-tokens` only to find candidates, never to count: the tag keeps Griffin Aerie, Anafenza, and Aether Chaser. Aether Chaser fails the text rule, since the sentence ends after "pay {E}{E}"; it makes one Servo from its own energy, so that loss is fine.
- Burst: `creates? (two|three|four|five|x|that many)[^.]*creature tokens` on a line that is not an engine.
- Temporary: `sacrifice (it|them|those tokens) at the beginning of the next end step|^mobilize\b` halves the weight.
- Not yours: `(its controller|that player|each opponent|target opponent|each other player|their controller) creates?` (Mogg Infestation). "Target player creates" counts as yours.
- Payoffs: `anthem` minus `typal`; `(^|\. )(other )?creatures you control get \+\d+/\+\d+` without `until end of turn` (lasting anthem) or with it (team pump); `whenever (a|another|one or more)( other)? (creatures?|creature tokens?|tokens?)( you control)? enters?|whenever you create (a|one or more)` (enters trigger, which now takes "Whenever one or more other creatures you control enter", 12 cards by `g1chk/broad.ts`); `overrun`; `(number of|for each) (other )?creatures? you control(?! with)` (count scaler, which now takes "for each other creature you control" and drops the Counters payoffs Inspiring Call and Armorcraft Judge, "for each creature you control with a +1/+1 counter on it"); `^convoke\b|^tap (two|three|four|five|x) untapped creatures you control` (tap for value).
- Drop payoffs with `nontoken` or `opponent controls`, typal lords, `keyword-anthem` without `creatures you control have`, and `creature-count-matters` cards tagged `sweeper`.

## +1/+1 counters (counters)

### 1. Plan

Put +1/+1 counters on several creatures, then play cards that reward creatures with counters.

### 2. Resource

+1/+1 counters, counted as counters placed and as creatures carrying one. Most payoffs say "each creature you control with a +1/+1 counter on it", so several carriers beat one big creature. Real decks get carriers three ways: spreaders, many self-growers (adapt, outlast, evolve), or many single placers (bolster).

### 3. Setup jobs

- **Spreader** (repeatable, other creatures, weight 2). Loxodon Battle Priest: "At the beginning of combat on your turn, put a +1/+1 counter on another target creature you control." Dragon Blood: "{3}, {T}: Put a +1/+1 counter on target creature." Bellowing Aegisaur puts one on each other creature you control whenever it is dealt damage.
- **Mass placer** (one-shot, weight 1.5). Pledge of Unity: "Put a +1/+1 counter on each creature you control." Myojin of Towering Might: "Remove an indestructible counter from Myojin of Towering Might: Distribute eight +1/+1 counters among any number of target creatures you control." It does so once, and only when cast from hand ("enters with an indestructible counter on it if you cast it from your hand").
- **Single placer** (one-shot, weight 1). Battlegrowth: "Put a +1/+1 counter on target creature." Aven Tactician: "When this creature enters, bolster 1."
- **Self-grower** (weight 1). Scurry Oak (evolve), Gnoll Hunter, adapt and outlast creatures.
- **Enters with counters** (weight 0.5). Endless One: "This creature enters with X +1/+1 counters on it." Wren's Run Hydra also enters with X counters, but its Reinforce ability, used from your hand instead of casting it, puts X counters on target creature, so it is a single placer (1).

### 4. Payoff jobs

- **Counter lord** (weight 2, 3+ carriers). Abzan Falconer: "Each creature you control with a +1/+1 counter on it has flying."
- **Cash-in** (weight 1, 3+). Inspiring Call: "Draw a card for each creature you control with a +1/+1 counter on it." Armorcraft Judge does it on enter.
- **Damage trigger** (weight 2, 2+). Bred for the Hunt: "Whenever a creature you control with a +1/+1 counter on it deals combat damage to a player, you may draw a card."
- **Multiplier** (weight 2, needs setup). Kami of Whispered Hopes, Conclave Mentor ("that many plus one +1/+1 counters"), Corpsejack Menace ("twice that many"), Thrummingbird ("proliferate" on combat damage).

### 5. False friends

From the `counters-matter`, `gains-pp-counters`, and `gives-pp-counters` listings:

- Other counters: Aether Chaser ("you get {E}{E}"), Gavel of the Righteous ("a charge counter"), Twitching Doll ("a nest counter"). Myojin of Towering Might is a false payoff only: its indestructible counter trips `counters-matter`, but its eight +1/+1 counters are real setup (section 3).
- Self-contained: Festercreep ("Remove a +1/+1 counter from this creature: All other creatures get -1/-1 until end of turn.", which kills your own small creatures), Fertilid, Academy Elite. Each enters with counters only to spend them on itself.
- Missing condition: Ajani's Comrade ("if you control an Ajani planeswalker").
- Hidden cost: Forcemage Advocate ("{T}: Return target card from an opponent's graveyard to their hand. Put a +1/+1 counter on target creature."). Each use hands the opponent a card (tag `group-hug`), so it is a spreader at weight 1, not 2.
- Rider: Enduring Victory ("Destroy target attacking or blocking creature. Bolster 1.").
- Weak payoff: Laid to Rest ("you gain 2 life"), weight 0.5.
- Anti-synergy: +1/+1 and -1/-1 counters cancel (rule 704.5q); undying returns only a creature that "had no +1/+1 counters on it" (702.93a).

### 6. Both jobs

Outlast lords (Abzan Falconer, Ainok Bond-Kin, Tuskguard Captain) and enter-plus-lord creatures (Duskshell Crawler, Pridemalkin) are payoffs: the lord weighs 2, the self-growth 1. Mass placers are setup. Training Regimen is real on both sides.

### 7. Enough

Setup and payoffs count copies with the half rule. Growth engines are spreaders, mass placers, and self-growers: the cards that grow a creature more than once, or several creatures at once. Real decks: setup / spreaders and mass / growth engines / payoffs.

| Size | Setup    | Growth engines         | Payoffs | Real decks                                                                         |
| ---- | -------- | ---------------------- | ------- | ---------------------------------------------------------------------------------- |
| 60   | 10 to 12 | 4+ (60%), or setup 13+ | 5 to 7  | 12 / 1 / 6 / 8, top 8 precons                                                      |
| 40   | 6 to 8   | 3+ (67%), or setup 9+  | 3 to 4  | 6 / 1.5 / 3 / 3, top 100 drafts                                                    |
| 20   | 3 to 4   | 2 (52%), or setup 5+   | 2       | 5.5 / 1 / 2.5 / 3, top 8 Jumpstart                                                 |
| 100  | 14 to 18 | 7+ (61%), or setup 22+ | 8 to 12 | 13.25 / 3 / 9.5 / 9.5, top 10 precons; 8 / 1 / 6 / 5.5, 9 EDHREC-commander precons |

Why these numbers:

- The old floor of 3 spreaders or mass placers at 60 failed every top precon: they run 0 to 2 (median 1), and the old real-deck figure counted only repeatable spreaders. Spreaders are the best growth engines, but not the only way to get carriers. Adapt and outlast decks (Simic Combine, Abzan Siege) play many creatures that grow themselves, and the bolster deck Massed Ranks plays many single placers. So the floor counts growth engines of any kind.
- The growth floors are the "3 games of 5" kind. A deck with fewer can pass on a deep setup count instead: without engines each setup card makes about one carrier, and the counter lords want 3. 13 setup in 60 put about 2.6 setup cards in the 12 seen by turn 5 (12 x 13 / 60), as do 9 in 40 and 22 in 99; a packet takes half the 40 count.
- Of the top 8 precons at 60, six pass. Growing Hunger and Simic Domination fall just short on setup (9 each).
- At 100 the setup range moved from 16 to 20 down to 14 to 18, the Tokens range, since weight-0.5 cards now count half; the top precons sit at 13.25. Several EDHREC-commander precons hold little +1/+1 setup by this count (Calling All Angels 3, Swell the Host 4.5, Vampiric Bloodlust 5), so that sample runs low.

About 2 setup to 1 payoff. Counters live on creatures: 16 or more at 60, plus removal and trample or evasion. A spreading commander (Leinore, Autumn Sovereign: "At the beginning of combat on your turn, put a +1/+1 counter on up to one target creature you control.") cuts setup by 3 or 4. EDHREC counters decks rank multipliers high: Kami of Whispered Hopes 29%, Corpsejack Menace 27%.

### 8. Where the live matchers differ

Enablers: `anyTags gives-pp-counters|gains-pp-counters|repeatable-pp-counters`. Payoffs: `counters-matter|pp-counters-matter|repeatable-proliferate|pseudo-proliferate|gives-pp-counters-to-all`.

- About 2,240 of 3,247 enablers never put a +1/+1 counter on another creature: a strict text count finds 1,003 that do (`g1chk/counts4.ts`), and the `jobs.ts` classifier 1,007 (`g1chk/counts3.ts`). `gains-pp-counters` (2,159, 703 alone) is self-growth and "enters with".
- `counters-matter` (1,262 payoffs, 755 alone) covers every counter kind: 605 payoffs count only through it and never mention +1/+1.
- `gives-pp-counters-to-all` sits in the payoff clause, so mass placers count as both.
- 66 payoffs only remove a +1/+1 counter "from this creature".
- 699 cards count as both, the most of these styles; top 60-card precons show 11 both copies (`g1/jobs-out.txt`).
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 2 at 40, 8 and 3 at 60, and 13 and 5 at 100 (the 60 minimums times 1.6, rounded up). This guide asks for more: at 60, 10 setup with enters-with cards counted half, 4 growth engines, and 5 payoffs counted apart from setup.

### 9. Matcher hints

Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Spreader (2): a repeatable line (it starts with `at the beginning of` or `whenever`, or its cost holds `{T}` or a mana symbol) that matches `put (a|an|one|two|x) \+1/\+1 counters? on (another|target|each|up to)` anywhere on the line, and whose cost does not discard, sacrifice, or exile the card. Matching the whole line, not one sentence, catches Forcemage Advocate (then weight 1 for its hidden cost). Removing reminder text drops Wren's Run Hydra's Reinforce ("Discard this card: Put X +1/+1 counters on target creature"); the cost check drops it too if reminder text is kept. Dropping the ability word lets Bellowing Aegisaur match.
- Mass (1.5): `distribute [^.]*\+1/\+1 counters|put (a|an|one|two|x) \+1/\+1 counters? on each (other )?creature you control` on a line that is not repeatable (Pledge of Unity, Myojin of Towering Might). `gives-pp-counters-to-all` is setup, not payoff.
- Single (1): `put (a|an|one|two) \+1/\+1 counters? on (target|up to)|\bbolster \d|^support \d`; 0.5 on a card tagged `removal`.
- Self (1): `^(evolve|outlast|training)\b|\badapt \d`. Use `gains-pp-counters` without `gives-pp-counters` only when no other line matched, the card does not spend its own counters, and it is not tagged `synergy-pw-specific` (Ajani's Comrade).
- Enters with (0.5): `enters with [^.]*\+1/\+1 counters? on it`, but 0 when a cost on the card matches `remove [^:]*\+1/\+1 counters? from (this creature|it)` (Festercreep, Fertilid, Academy Elite).
- Payoffs: `pp-counters-matter` minus `remove [^:]*counters? from (this creature|it)`; `counter-increaser`, `counter-doubler`, `repeatable-proliferate`; `creatures? you control with (a|one or more) \+1/\+1 counters?`, weight 0.5 when the line ends in `you gain \d+ life` or `scry 1` (Laid to Rest).
- Keep `counters-matter` only when the text says `+1/+1` or `proliferate`.

## Aristocrats (aristocrats)

### 1. Plan

Play creatures that are happy to die, sacrifice them when it suits you, and drain the opponent or draw with each death.

### 2. Resource

Creature deaths you cause, one per sacrifice. Each needs a body (fodder) and a way to spend it on demand (an outlet). "Dies" means put into a graveyard from the battlefield (rule 700.4), so sacrificed tokens trigger death payoffs before they cease to exist (111.7).

### 3. Setup jobs

Two jobs; the deck needs both.

- **Repeatable outlet** (weight 2; best with no mana and no tap). Viscera Seer: "Sacrifice a creature: Scry 1." Goblin Bombardment: "Sacrifice a creature: This enchantment deals 1 damage to any target." Phyrexian Vault ("{2}, {T}, Sacrifice a creature: Draw a card.") works once a turn. A **value outlet** is one whose effect pays off each death by itself, with damage, life loss, or a card: Goblin Bombardment and Phyrexian Vault are; Viscera Seer's scry 1 is not.
- **One-shot outlet** (weight 0.5). Village Rites, Bone Splinters: "As an additional cost to cast this spell, sacrifice a creature." Minister of Pain (exploit).
- **Fodder** (weight 1; token engines 2). Doomed Traveler: "When this creature dies, create a 1/1 white Spirit creature token with flying." Nested Shambler, Raise the Alarm, Kozilek's Predator, temporary tokens. Any death trigger with value counts, "you may" ones included: Byway Courier ("When this creature dies, investigate."), Injector Crocodile ("When this creature dies, incubate 3."). So do creatures that die twice or leave a body: Kitchen Finks (persist), Young Wolf (undying), Imperious Oligarch (afterlife 1).
- **Self-recurring fodder** (weight 1). Reassembling Skeleton: "{1}{B}: Return this card from your graveyard to the battlefield tapped." It comes back to die again. No live tag or matcher finds it.

### 4. Payoff jobs

Each wants about five deaths a game, so a repeatable outlet.

- **Drain** (weight 2). Zulaport Cutthroat: "Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life." Blood Artist, Bastion of Remembrance.
- **Value** (weight 2). Pitiless Plunderer: "Whenever another creature you control dies, create a Treasure token." Morbid Opportunist: "draw a card. This ability triggers only once each turn."
- **Sacrifice trigger** (weight 2). Lightless Evangel: "Whenever you sacrifice another creature or artifact, put a +1/+1 counter on this creature."
- A trigger on nontoken deaths only weighs 1; a scry 1 rider 0.5.

**Value outlets and the payoff count.** A value outlet counts once, as an outlet. Each one in the deck lowers the payoff minimum by one, down to half of it: at 60, two Goblin Bombardments let 2 payoffs do instead of 4. This credits outlets that pay off by themselves without counting any card twice.

### 5. False friends

From the `free-sacrifice-outlet`, `sacrifice-outlet-creature`, `death-trigger`, and `death-trigger-self` listings:

- Other permanents: Akki Avalanchers ("Sacrifice a land:"), Atog ("Sacrifice an artifact:").
- Symmetric edicts: Barter in Blood ("Each player sacrifices two creatures of their choice."), Abyssal Gatekeeper.
- Typal: Skirsdag Flayer ("Sacrifice a Human:"), Fodder Launch ("As an additional cost to cast this spell, sacrifice a Goblin.").
- One creature: Malefic Scythe ("Whenever equipped creature dies"), Elephant Guide ("When enchanted creature dies").
- Rider: Phyrexian Vivisector ("Whenever a creature you control dies, scry 1.").
- Anti-synergy: Death's-Head Buzzard ("all creatures get -1/-1 until end of turn" kills your 1/1s).
- Half the job: Field of Souls ("Whenever a nontoken creature is put into your graveyard from the battlefield, create a 1/1 white Spirit creature token with flying.") turns each nontoken death into new fodder but ignores token deaths. Count it as fodder (a token engine fed by your own deaths, weight 1), not as a payoff, though the live matcher counts it as both.
- Not fodder: Chromatic Star (an artifact: "When this artifact is put into a graveyard from the battlefield, draw a card.").
- Weak fodder (weight 0.5): Endling ("{B}: This creature gains undying until end of turn.") dies twice only with {B} open, and costs four mana first.

### 6. Both jobs

Outlet beats payoff beats fodder, whatever the weights: Body Dropper (outlet plus sacrifice trigger) is an outlet. Zulaport Cutthroat and Bastion of Remembrance are payoffs. A value outlet is still only an outlet; the value-outlet rule in section 4 credits its payoff side through the payoff minimum.

### 7. Enough

Outlets count every outlet copy, one-shots at half; the number in brackets is the repeatable ones alone. Fodder and payoffs count copies with the half rule. Real decks: repeatable outlets / one-shot outlets / fodder / payoffs, counted the same way, with outlets first as in section 6.

| Size | Outlets (repeatable) | Fodder   | Payoffs | Real decks                                                                    |
| ---- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------- |
| 60   | 4 to 6 (3+, 49%)     | 8 to 12  | 4 to 6  | 4 / 2 / 9 / 3.5, top 8 precons                                                |
| 40   | 3 to 4 (2+, 52%)     | 5 to 7   | 3 to 4  | 1 / 0 / 4.5 / 3, top 100 drafts                                               |
| 20   | 1 to 2 (1+, 30%)     | 3        | 2       | 1 / 1 / 2.5 / 2, top 8 Jumpstart                                              |
| 100  | 6 to 10 (5+, 48%)    | 10 to 14 | 6 to 10 | 2.5 / 1 / 9.5 / 7, top 10 precons; 5 / 1 / 11 / 6, 8 EDHREC-commander precons |

Why these numbers:

- **No repeatable outlet, no deck.** Each outlet floor shows one by turn 5 in about half of games. The 40 floor moved from 1 to 2: one copy shows in only 30% of games, against 49% for 3 at 60. The 100 floor moved from 4 (41%) to 5 (48%). A 20-card packet holds half of the 40 floor, rounded up.
- **Some real decks fall short, on purpose.** The top draft decks run one repeatable outlet: drafters take what the packs offer, and with one copy the outlet shows by turn 5 in only 30% of games. Bulk Brew names the deck Aristocrats, so it must deliver the plan; a pool short of outlets should build Tokens or a plain shape instead. At 100 the classifier's top 10 includes decks with 0 to 3 repeatable outlets (Squirreled Away 3, Hail, Caesar 1, Deep Clue Sea 0, World Shaper 0), while the precons led by EDHREC aristocrats commanders run a median of 5, the floor.
- **Fodder is the largest of the three jobs** at every size in the table. It need not outnumber outlets and payoffs together: payoff creatures and plain creatures die too. Power Hungry runs more repeatable outlets (12) than fodder (8.5) because its commander supplies the bodies. Prossh, Skyraider of Kher: "When you cast this spell, create X 0/1 red Kobold creature tokens named Kobolds of Kher Keep, where X is the amount of mana spent to cast it." and "Sacrifice another creature: Prossh gets +1/+0 until end of turn."
- An outlet commander such as Prossh is always there, so the 99 needs only 3 to 5 outlets (2+ repeatable).
- The 100 fodder range moved from 12 to 16 down to 10 to 14, to the real precons' 9.5 to 11.

Add removal (Goblin Bombardment is both) and cheap creatures. EDHREC aristocrats decks: Ashnod's Altar ("Sacrifice a creature: Add {C}{C}.") 41%, Goblin Bombardment 35%, Pitiless Plunderer 43%.

### 8. Where the live matchers differ

Enablers: #1 `sacrifice-outlet-creature|repeatable-sacrifice-outlet|free-sacrifice-outlet`, #2 `repeatable-creature-tokens|multiple-bodies|death-trigger-self`. Payoffs: #1 `blood-artist-ability|sacrifice-matters|your-sacrifice-matters`, #2 `death-trigger` with exclusions.

- Outlets and fodder share one count: 2,878 cards meet only #2, 1,084 only #1. A deck reaches 8 enablers with no outlet; the green deck in `our-builder-themes.md` did.
- #1: 299 cards sacrifice only lands, artifacts, Food, or Treasure (`repeatable-sacrifice-outlet`, `free-sacrifice-outlet`). `sacrifice-outlet-creature` adds about 111 additional-cost spells, 24 exploit cards, and about 46 "each player sacrifices" edicts.
- #2 inherits every Tokens enabler; `death-trigger-self` adds 68 noncreatures (63 through it alone, `g1fix/dts.ts`). Self-recurring creatures such as Reassembling Skeleton meet neither clause.
- Payoff #2 counts 41 Aura and Equipment death triggers, scry riders, and nontoken-only triggers.
- Value outlets count only as enablers while the payoff minimum stays, so a deck of draw and damage outlets reads as payoff-starved. Section 4 lowers the payoff minimum instead.
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 2 at 40, 8 and 4 at 60, and 13 and 7 at 100 (the 60 minimums times 1.6, rounded up). Enablers mix outlets and fodder, so a deck meets them with no outlet at all. This guide asks for three separate counts: at 60, 4 outlets (3 repeatable), 8 fodder, and 4 payoffs.

### 9. Matcher hints

Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Outlet (2): the cost matches `sacrifice (a|another) (other )?(nontoken )?(creature|artifact or creature|creature or artifact|permanent)`. Use `free-sacrifice-outlet` only with `sacrifice-outlet-creature`; exclude `mutual-sacrifice`. It is a value outlet when the effect after the colon matches `deals? \d+ damage|draw a card|loses? \d+ life|each opponent loses`.
- One-shot outlet (0.5): `as an additional cost to cast this spell, sacrifice (a|an|one or more|two|x) (creature|artifact or creature|creature or artifact|permanent)|^exploit\b|^casualty \d|^emerge\b|^when this creature enters, you may sacrifice (a|another) creature`. Naming what is sacrificed drops Crop Rotation ("sacrifice a land"), Forge Armor ("sacrifice an artifact"), and Fodder Launch ("sacrifice a Goblin", typal). 165 cards match.
- Fodder (1): a creature with a line matching `^when this creature (enters or )?dies, (?!all creatures|each creature|each player)` or `^(afterlife|persist|undying)\b`. The lookahead drops Death's-Head Buzzard and symmetric death edicts. Of 803 creatures tagged `death-trigger-self`, it matches 564; the old hint matched 241.
- Self-recurring fodder (1): a creature with `return this card from your graveyard to the battlefield` (80 creatures).
- Token fodder: the Tokens setup jobs, `temporary-token` included.
- Payoffs: `blood-artist-ability`, `your-sacrifice-matters`; `whenever (this creature or )?(a|another|one or more)( other)? creatures?( you control)? dies?` without `enchanted|equipped`, weight 1 with `nontoken`, 0.5 when the only effect is scry 1.
- Report outlets, fodder, and payoffs as three numbers; fodder never stands in for outlets.

## Graveyard (graveyard)

### 1. The plan

"I fill my graveyard fast, then bring back my best creature or play cards that grow with it."

### 2. What it builds up and spends

Cards in your own graveyard; for reanimation and undergrowth, creature cards there. The unit is cards put in per use. Threshold wants seven; delve and escape spend the pile.

### 3. Setup jobs

- **Looter or rummager on a permanent** (2; it picks the card it bins, such as a reanimation target). Merfolk Looter: "{T}: Draw a card, then discard a card." Rummaging Goblin: "{T}, Discard a card: Draw a card."
- **Repeatable self-mill** (2 at two or more a turn, 1 at one). Stinkweed Imp: "Dredge 5". One a turn, so 1: Millikin and Deranged Assistant: "{T}, Mill a card: Add {C}."; Cathartic Adept: "{T}: Target player mills a card."
- **Big one-shot self-mill** (1 at three or more). Armored Skaab: "When this creature enters, mill four cards." Grisly Salvage, Satyr Wayfinder: "Put the rest into your graveyard." Tracker's Instincts: "Put a creature card from among them into your hand and the rest into your graveyard."
- **Small one-shot on a creature with no other job** (0.5; 1 when it fires on enters and dies). Wailing Ghoul: "When this creature enters, mill two cards." Crow of Dark Tidings: "When this creature enters or dies, mill two cards." The same text on removal, a counter, bounce, a draw spell, or a payoff is a rider (section 5).
- **Loot and rummage spells** (1; 0.5 for one card). Careful Study: "Draw two cards, then discard two cards." Faithless Looting adds flashback (1.5). Thrill of Possibility discards one to draw two.
- **Entomb** (1.5 with reanimation, 1 without). Buried Alive: "Search your library for up to three creature cards, put them into your graveyard".
- **Free discard outlet** (1; it draws nothing, so it needs cards worth discarding). Wild Mongrel: "Discard a card: This creature gets +1/+1".
- **Cycling** (0.5; 1 for a creature card when reanimating, since it bins a target). Striped Riverwinder is a 7-mana creature with "Cycling {U}". 351 nonland cards have cycling, 170 of them creatures.
- **Creatures dying, for creature payoffs only** (reanimation, regrowth, creature counts). A free sacrifice outlet on a permanent (1, needs fodder): Viscera Seer: "Sacrifice a creature: Scry 1." A one-shot sacrifice or discard (0.5; 1 when reanimating and you choose the creature): Crypt Lurker: "When this creature enters, you may sacrifice a creature or discard a creature card. If you do, draw a card." Goremand: "As an additional cost to cast this spell, sacrifice a creature." Miasmic Mummy: "When this creature enters, each player discards a card." Creatures that die in combat are not counted per card; section 7 says what that means for designed decks.

### 4. Payoff jobs

Each card counts once, at its highest weight.

- **Reanimation** (1; needs one good creature there). Zombify: "Return target creature card from your graveyard to the battlefield." Also Animate Dead. Wants 4 to 6 big targets and discard to bin them.
- **Graveyard count** (1, whether the bonus is static or not; needs five to seven cards by turn 5 or 6). Boneyard Wurm: "equal to the number of creature cards in your graveyard". Nimble Mongoose: "+2/+2 as long as there are seven or more cards in your graveyard."
- **Delve, escape, and other costs that exile from your graveyard** (1; they need four to six cards and spend them, fighting threshold). Treasure Cruise ("Delve"), Gurmag Angler. Graf Harvest: "{3}{B}, Exile a creature card from your graveyard: Create a 2/2 black Zombie creature token."
- **Regrowth to hand** (0.5, one dead creature is enough). Gravedigger: "return target creature card from your graveyard to your hand".
- **Self-recursion and flashback** (0.5). "this card from your graveyard", Flashback, Unearth (section 5).

### 5. False friends

- `mill-self` riders, 0: Price of Fame ("Destroy target creature. Surveil 2."), Ephara's Dispersal (bounce, "Surveil 2."), Hymn of the Faller ("Surveil 1, then you draw a card").
- `mill-self` on an attack trigger, 0.5: Fear of Surveillance ("Whenever this creature attacks, surveil 1.") fills only when it attacks. A tap ability that mills one a turn is a real engine at 1 (Cathartic Adept, section 3).
- `graveyard-fuel-self` uses the card up: Constrictor Sage ("Exile this card from your graveyard: Tap target creature"). Barishi ("shuffle all creature cards from your graveyard into your library") also has `recursion-creature` and undoes the plan.
- `castable-from-graveyard` flashback: Think Twice, Deep Analysis need no setup and do not scale. 0.5 payoff, good to discard.
- Counting only opponents' graveyards: Wight of Precinct Six ("This creature gets +1/+1 for each creature card in your opponents' graveyards."), Nighthawk Scavenger ("power is equal to 1 plus the number of card types among cards in your opponents' graveyards"). They are live Graveyard payoffs through `cards-in-graveyard-matter` (20 such payoffs), but self-mill does nothing for them. They are Mill payoffs.
- Graveyard hate: Scavenging Ooze ("{G}: Exile target card from a graveyard."), Diregraf Scavenger ("exile up to one target card from a graveyard"). Live payoffs through `graveyard-fuel`; 148 live payoffs carry `hate-graveyard`, 118 of them with no reanimation, recursion, count, or delve tag. They eat graveyards, your own payoffs' fuel included. Cling to Dust is hate first; only its escape ("Exile five other cards from your graveyard") counts, as an escape payoff (section 4).

All checked with the helper, as was Merfolk Looter (`repeatable-loot`), which counts as nothing.

### 6. Both jobs

Count once. A card whose body needs a full graveyard is a payoff whatever it fills: Splinterfright's "power and toughness are each equal to the number of creature cards in your graveyard", so with none there it is a 0/0 that dies (704.5f) before its upkeep "mill two cards" fires; Patchwork Beastie "can't attack or block unless" delirium. Otherwise a card that puts in three or more, or fills every turn, is setup, and its graveyard reward is a bonus: Corpse Churn ("Mill three cards, then you may return a creature card"), Crop Sigil ("At the beginning of your upkeep, you may mill a card."). A payoff with a small one-shot rider stays a payoff. Self-only cards are never setup.

### 7. Enough for a decent bulk deck

Setup and Payoff count weight (sections 3 and 4); Repeatable counts copies. Aim for about 3 setup weight per 2 payoff weight; 1 per 1 is the floor.

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

### 8. Where the live matchers differ

- Enabler 1, `mill-self` (1,020): 199 fill one or two once (55 on removal, counters, bounce, cantrips), 181 one or two repeatedly. Public-pool decks had 21 riders in 41 setup copies (`docs/review/our-builder-themes.md`).
- Enabler 1, `graveyard-fuel-self` (184, 171 also payoffs): fills nothing.
- Enablers 2 to 6 take `loot`, `rummage`, `discard-outlet` only with a payoff tag: 206 of 228 `repeatable-loot` cards, Careful Study, and Wild Mongrel count as neither.
- Missing: `tutor-to-graveyard` (27 of 31, Buried Alive too); cycling (7 of 351 count); sacrifice outlets for creature recursion.
- Payoffs: `castable-from-graveyard`, `activate-from-graveyard`, `graveyard-fuel`, `reanimate`, `recursion-creature` include self-recursion and restock; at least 902 of 2,788 payoffs have no tag about other graveyard cards. 148 carry `hate-graveyard`, and 20 count only opponents' graveyards.
- Both: 562 cards, 264 through `mill-self`, 171 through `graveyard-fuel-self`.

### 9. Matcher hints

Score setup and payoff for each card, then keep one (last item).

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

## Spellslinger (spells)

### 1. The plan

"I cast a cheap instant or sorcery most turns, and each one grows a creature, makes a token, or deals damage."

### 2. What it builds up and spends

Casts of instants and sorceries (any noncreature spell for prowess); the unit is one cast. A few payoffs count instants and sorceries in the graveyard.

### 3. Setup jobs

- **Cheap cantrips** (1.25, they keep the chain going). Opt: "Scry 1. Draw a card." Consider, Preordain.
- **Cheap interaction** (1 at mana value 2 or less). Shock: "Shock deals 2 damage to any target." Lightning Bolt.
- **Cast twice** (1.75 by the section 9 formula: 1 for mana value 2, 0.25 for `cantrip`, 0.5 for `castable-from-graveyard`). Think Twice: "Draw a card." with "Flashback {2}{U}".
- **Expensive spells** (0.75 at 3, 0.5 at 4, 0.25 at 5+). Overwhelming Stampede counts today like Opt.
- **Engines that add casts** (2). Goblin Electromancer: "Instant and sorcery spells you cast cost {1} less to cast." Mnemonic Wall returns an instant or sorcery (1).

### 4. Payoff jobs

Permanents that trigger on each cast; they want about one cast a turn.

- **Cast triggers** (1). Guttersnipe: "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent." Young Pyromancer, Kiln Fiend.
- **Prowess and noncreature triggers** (1). Monastery Swiftspear. Firebrand Archer: "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent."
- **Graveyard count** (1 with 18 or more spells, late). Enigma Drake: "power is equal to the number of instant and sorcery cards in your graveyard."
- **Density checks** (0.5). Delver of Secrets flips on an instant or sorcery on top; Prismari Pledgemage attacks only after a spell.

### 5. False friends

`synergy-instant` and `synergy-sorcery` mark any card that mentions the types.

- Restricted mana: Karfell Harbinger ("Spend this mana only to foretell a card from your hand or cast an instant or sorcery spell."). Ramp.
- Dig: Pieces of the Puzzle, Arcane Infusion ("You may reveal an instant or sorcery card from among them and put it into your hand."). Setup.
- Quicken ("The next sorcery spell you cast this turn can be cast as though it had flash."), Cloud Key, Izzet Guildmage (pays to copy). Weak or neither.
- Burrog Barrage: "+1/+0 ... if you've cast another instant or sorcery spell this turn." One-shot: setup.

All of these were checked with the helper.

### 6. Both jobs

An instant or sorcery that also rewards spells is setup: it is a cast, and its reward fires once. A permanent with a cast trigger is a payoff. A cost reducer is a setup engine.

### 7. Enough for a decent bulk deck

All columns count copies; setup weights (section 9) only rank spells against each other. About two spells per payoff, counting the other packet's spells at 20.

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

### 8. Where the live matchers differ

- Enabler `anyTypes instant, sorcery` minus creatures (7,182): no weight by cost; 1,465 cost 5 or more. Missed: Adventure halves (Venture Deeper), cheap artifacts and enchantments for prowess (287 of 808 payoffs trigger on any noncreature spell), spell regrowth (Mnemonic Wall).
- Payoff `synergy-instant`, `synergy-sorcery`, `synergy-noncreature` (808): includes all 38 `cost-reducer-instant-sorcery` cards, 22 `restricted-mana` cards, dig spells, and copy abilities; about 424 have a "whenever you cast" trigger. The public blue deck had 2 wrong payoffs of 7.
- Both: 85 cards, mostly instants and sorceries with `synergy-instant`. Burn reuses these payoff tags.

### 9. Matcher hints

- Repeatable payoff: a permanent with `whenever you cast an? (instant|sorcery|noncreature)`, `magecraft`, or Prowess; `cast-trigger-you` plus a `synergy-` spell tag.
- Count payoff: `instant and sorcery cards (you own )?in (exile and in )?your graveyard`.
- Not payoff: `restricted-mana`; `impulse-instant`, `impulse-sorcery` (setup); `cost-reducer-instant-sorcery` (setup engine); `gives-flash`.
- Setup weight by mana value: 2 or less 1, 3 is 0.75, 4 is 0.5, 5 or more 0.25; plus 0.25 for `cantrip`, 0.5 for `castable-from-graveyard`. Adventure faces: `(Instant|Sorcery)\W+Adventure` in the type line.
- `if you've cast another` on an instant or sorcery: setup, not payoff.

## Lifegain (lifegain)

### 1. Plan

Gain a little life several times a turn with lifelink creatures and Soul Warden effects, and let cards like Ajani's Pridemate grow or drain each time.

### 2. Resource

Life-gain events, not life points: each source that gains life is one event (rules 119.9, 702.15e). A repeatable source makes about one a turn, a one-shot card one in total. Only "that much", amount, and threshold payoffs care about the amount. Increasers ("you gain that much life plus 1 instead") raise the amount of each event, not the number of events.

### 3. Setup jobs

- **Lifelink bodies**, repeatable, weight 2. Healer's Hawk (common): "Flying / Lifelink". Vampire Nighthawk (uncommon): "Flying / Deathtouch / Lifelink".
- **Trigger gainers**, repeatable, weight 2. Soul Warden (common): "Whenever another creature enters, you gain 1 life." Basilica Screecher (common): "Extort".
- **Granters and Food engines**, repeatable, weight 2. Lifelink (common): "Enchanted creature has lifelink." Eager Trufflesnout (uncommon): "Whenever this creature deals combat damage to a player, create a Food token."
- **One-shot gainers**, weight 1, 0.5 at mana value 5 or more. Lone Missionary (common): "When this creature enters, you gain 4 life." Revitalize (common): "You gain 3 life. Draw a card." Enters and dies gains on creatures belong here.
- **Riders**, weight 0. A gain on removal or a counterspell (a Food included), or a one-turn lifelink grant on an instant or sorcery. Fell the Pheasant (common): "deals 5 damage to target creature with flying. Create a Food token."

### 4. Payoff jobs

- **Per event**, the core. Ajani's Pridemate (uncommon) and Celestial Unicorn (common): "Whenever you gain life, put a +1/+1 counter on this creature." Marauding Blight-Priest (common): "each opponent loses 1 life." Wax-Wane Witness (common): "Whenever you gain or lose life during your turn, this creature gets +1/+0 until end of turn."
- **Once a turn.** Bloombrute (uncommon): "draw a card. This ability triggers only once each turn." Ulna Alley Shopkeep (common): "This creature gets +2/+0 as long as you gained life this turn." Foolish Fate (uncommon), "Destroy target creature." with an Infusion rider, is half a payoff: the removal works without the theme.
- **Threshold.** Griffin Aerie (uncommon): "if you gained 3 or more life this turn". Needs a 3-power lifelinker or two sources.
- **Amount.** Sanguine Bond (uncommon): "target opponent loses that much life." Nightmare's Thirst (uncommon): "Target creature gets -X/-X until end of turn, where X is the amount of life you gained this turn."
- **Increasers**, half a payoff. Angel of Vitality and Honor Troll (uncommon): "If you would gain life, you gain that much life plus 1 instead." They help amount and threshold payoffs and do nothing for per-event ones. They make no events, so they are never setup.
- **Life total**, half a payoff. Twinblade Paladin (uncommon): "As long as you have 25 or more life". Slow from 20 life; always on from Commander's 40 (rule 903.7), so at 100 the clause is free and is not a payoff. Count the card by its other text: Twinblade Paladin also reads "Whenever you gain life, put a +1/+1 counter on this creature", so it stays a per-event payoff at every size.

### 5. False friends

Checked with the helper.

- `lifegain` marks any gain. Swords to Plowshares: "Its controller gains life" (the opponent; `opponent-lifegain`). Moment of Craving: removal plus "You gain 2 life." Anodet Lurker: "When this creature dies, you gain 3 life", a one-shot at mana value 5. Bake into a Pie: removal plus one Food.
- `gives-lifelink` on one-turn grants: Archon's Glory, lifelink "until end of turn" if bargained.
- `synergy-lifelink`: Thunderous Orator copies lifelink among eight keywords (`keyword-soup`) and counts as both.
- `lifegain-matters` on the wrong player: Kavu Predator, "Whenever an opponent gains life".
- Food reminder text: every Food maker reads "{2}, {T}, Sacrifice this token: You gain 3 life." A text search that does not drop reminder text calls Bake into a Pie a repeatable gainer.

### 6. Both jobs

If the reward reads "whenever you gain life", scales, or checks a total, it is a payoff (Indulging Patrician, Cat Collector). Oloro, Ageless Ascetic gains life ("At the beginning of your upkeep, you gain 2 life.") but also reads "Whenever you gain life, you may pay {1}. If you do, draw a card and each opponent loses 1 life.": a payoff. If the card makes its own events and the reward only improves itself, it is setup: Lone Rider is a 1/1 with "First strike, lifelink" that transforms after 3 life in a turn.

### 7. Enough for a decent bulk deck

Copies, riders left out.

| Size | Setup (repeatable) | Payoffs  | Also                                                 |
| ---- | ------------------ | -------- | ---------------------------------------------------- |
| 60   | 10 to 14 (8+)      | 6 to 10  | 5 to 7 removal, evasive lifelinkers                  |
| 40   | 7 to 10 (5+)       | 4 to 6   | 3 to 5 removal                                       |
| 20   | 5 to 7 (3+)        | 3 to 4   | per-event and once-a-turn payoffs, no thresholds     |
| 100  | 16 to 22 (12+)     | 10 to 14 | life-total clauses are not payoffs (always on at 40) |

About one to two setup per payoff. Per-event payoffs share the same sources, so payoffs may match or outnumber setup once the repeatable floor is met. Take more setup when thresholds are most of the payoffs, since they need two sources or a 3-power lifelinker in one turn.

Odds: 8 repeatable sources in 60 show one by turn 5 in 85% of games, 5 in 40 in 85%, 12 in 99 in 81%. Payoffs: 6 in 60 show one in 75%, 4 in 40 in 78%, 10 in 99 in 74%. A packet's 3 repeatable sources or 3 payoffs show in 67% of paired 40-card games, 4 in 78%. Thresholds are out of packets because two sources rarely meet in one turn.

Commander: a payoff commander such as Dina, Soul Steeper ("Whenever you gain life, each opponent loses 1 life.") is a payoff in every game, so other payoffs can drop to about 8. Oloro, Ageless Ascetic is a repeatable source and a payoff at once (part 6): cut setup and payoffs by about 3 each.

Evidence, copies under the part 9 hints (`g3fix/decks-lifegain.txt`):

- Theme Deck "Lifegain" (60): 11 setup, all repeatable; 19 payoff cards, 16 with Foolish Fate at half.
- Arena Starter "Lifeline" (60): 11 setup (8 repeatable); 11 payoffs.
- Arena Starter "Life Skills" (60): 19 setup (14 repeatable); 9 payoffs.
- Jumpstart "Healers (1)" to "(4)": 6 or 7 setup (3 or 4 repeatable); 3 or 4 payoff cards, 2.5 to 3.5 with increasers at half. With 2 or 3 full payoffs, real packets show one in 52% to 67% of paired games, at or under the packet floor.
- Commander "Witherbloom Witchcraft", under Willowdusk, Essence Seer (an amount payoff): 20 setup (14 repeatable); 18 payoff cards, 16 with halves. "Eternal Bargain", under Oloro: 13 setup (9 repeatable); 5 payoffs.
- Learned 40-card lifegain plans (937 draft decks, `config/learned/plans.json`): a median 3 live payoffs, quartiles 2 to 5. Draft decks take payoffs as they come. A deck that names the theme should hold 4, since 3 show one by turn 5 in only 67% of games.
- EDHREC's lifegain page has Soul Warden, Essence Warden, and Soul's Attendant in 30% to 40% of decks.

### 8. Where the live matchers differ

- Enabler #1 `anyTags lifegain` takes 1,548 bulk cards (7.7%), so almost any white, black, or green pool meets the minimum of 8. Only 738 (48%) are repeatable; 201 are removal with a gain rider. `our-builder-themes.md` found 11 of 15 setup copies were riders in its black deck.
- No weight: Revitalize counts like Soul Warden; `opponent-lifegain` counts as setup.
- Payoff #1 is mostly right (72 of 94 pass a strict rule); `synergy-lifelink` and `hate-lifegain` slip in. 28 bulk cards count as both (Bloombrute).

### 9. Matcher hints

Every pattern runs on oracle text with reminder text (anything in parentheses) removed, case-insensitive, with `^` matching each line start (flags `im`). Removing reminder text keeps Food's "Sacrifice this token: You gain 3 life." out of every pattern.

- Repeatable setup, weight 2 (1 at mana value 5 or more): `repeatable-lifegain`, or keyword Lifelink on a creature, or, on a permanent only, text `whenever [^.]*you (may )?gain (\d+|x|that much) life`, `at the beginning of [^.]*you gain (\d+|x) life`, `\{t\}(?![^:]*sacrifice)[^:]*: [^.]*you gain[^.]*\.(?! (shuffle|exile) this)`, `\bextort\b`, `(enchanted|equipped) creature has lifelink`; minus `opponent-lifegain`. "You gain (\d+|x) life" leaves out "you gained", so threshold payoffs do not count as setup. On an instant or sorcery a "whenever" gain lasts one turn (Death Frenzy: "Whenever a creature dies this turn, you gain 1 life."), so it is a one-shot at most. Elixir of Immortality ("{2}, {T}: You gain 5 life. Shuffle this artifact and your graveyard into their owner's library.") is one-shot too.
- One-shot, weight 1 (0.5 at mana value 5 or more): `lifegain` that is not repeatable. Enters and dies gains land here (Lone Missionary).
- Rider, weight 0: `lifegain` with `removal` or `counterspell` (Moment of Craving, Bake into a Pie, Fell the Pheasant); `lifelink until end of turn` on an instant or sorcery with no other gain (Archon's Glory); `(its controller|each player) gains` with no "you gain".
- Payoffs, weight 1: `pridemate`, `lifegain-to-damage`; text `whenever you gain life|whenever you gain or lose life` (per event); `you gain life for the first time each turn|(if|as long as) you gained (or lost )?life this turn`, or "whenever you gain life" with `only once each turn` (once a turn); `gained \d+ or more life` (threshold); `amount of life you('ve)? gained this turn|whenever you gain life[^.]*that much` (amount). `lifegain-matters` alone is not enough: take it only with one of these texts, which drops Kavu Predator.
- Half payoffs, weight 0.5: any payoff above that also carries `removal` (Foolish Fate, Nightmare's Thirst); `lifegain-increaser` (Angel of Vitality); text `you have \d+ or more life|more life than (an|each|that) (opponent|player)` (life total), except at 100, where the clause counts zero and the card counts by its other text.
- Count once: a card that is repeatable setup and whose payoff text only improves itself (`transform`, "this creature gets", "counter on this creature", with no drain, draw, or token) stays setup (Lone Rider). Every other card that meets a payoff rule is a payoff (Oloro, Bloombrute).
- Exclude: `hate-lifegain`; `keyword-soup` (Thunderous Orator); `drawback` unless the card also carries `pridemate` or `lifegain-to-damage`. That keeps Wall of Limbs and Starscape Cleric and drops Lurking Roper, whose "Whenever you gain life, untap this creature." only undoes its own drawback.

Bulk under these hints (`g3fix/bulk.txt`): 706 repeatable, 556 one-shot, 221 riders, 88 payoffs. No card is repeatable through text alone. The earlier patterns added 99 cards beyond the tags, 20 of them removal (Fell the Pheasant, Food Coma) and 9 payoffs (Griffin Aerie, Cat Collector), through Food reminder text and "you gained". The earlier once-a-turn pattern took "first time each turn" and "only once each turn" with no life in sight and matched 194 unrelated cards; now all 28 once-a-turn payoffs mention life. The 8 payoffs the earlier patterns missed now match (Ulna Alley Shopkeep, Wax-Wane Witness, Nightmare's Thirst).

## Artifacts (artifacts)

### 1. Plan

Fill the board with cheap artifacts and artifact tokens, then let cards that count, trigger on, or sacrifice them take over.

### 2. Resource

Artifacts you control. Units: one on the battlefield (count payoffs), one entering (tokens and lands count), one artifact spell cast (tokens and lands do not), one to sacrifice. Treasure, Clue, and Food are artifact tokens (rule 111.10) that leave when used. Artifact lands are artifacts that enter and stay, but they are played, not cast.

### 3. Setup jobs

- **Cheap artifacts that stay**, weight 1, mana value 3 or less. Ornithopter (common): "Flying" for {0}. Iron Myr (common): "{T}: Add {R}." 5-drops rank at half.
- **Artifact lands**, weight 1, no spell slot. Seat of the Synod (common): "{T}: Add {U}." They feed count, enters, and sacrifice payoffs, not cast payoffs. Take them in place of basics when the pool has them in the deck's colors.
- **One-shot token makers**, weight 1, half on instants and sorceries and at mana value 5 or more. Thraben Inspector (common): "When this creature enters, investigate." Aviation Pioneer (common): "create a 1/1 colorless Thopter artifact creature token with flying." Beamsaw Prospector (common): "When this creature dies, create a Lander token."
- **Repeatable token makers**, weight 2. Flamewright (uncommon): "{1}, {T}: Create a 1/1 colorless Construct artifact creature token". Floodhound (common): "{3}, {T}: Investigate."

### 4. Payoff jobs

- **Count**, three artifacts by turn 4 or 5. Carapace Forger (common): "+2/+2 as long as you control three or more artifacts." Frogmite and Thoughtcast (common): "Affinity for artifacts". Chief of the Foundry (uncommon): "Other artifact creatures you control get +1/+1."
- **Enters**, about one a turn. Reckless Fireweaver (common): "Whenever an artifact you control enters, this creature deals 1 damage to each opponent."
- **Cast**, artifact cards only. Embersmith (uncommon): "Whenever you cast an artifact spell, you may pay {1}."
- **Cost reducers**, half a payoff, the same rule as in Enchantments. Etherium Sculptor (common): "Artifact spells you cast cost {1} less to cast." The reward is mana for each artifact spell, which needs the setup but draws, drains, and grows nothing.
- **Sacrifice**, spare Treasure or Thopters. Atog (common): "Sacrifice an artifact: This creature gets +2/+2 until end of turn."
- **One-artifact conditions**, half a payoff, on a card that is not an artifact. Aeronaut Tinkerer (common): "flying as long as you control an artifact."

### 5. False friends

Checked with the helper.

- `affinity` is the parent of every "costs less for each X" tag. Cryptic Serpent ("for each instant and sorcery card in your graveyard"), Daybreak Chimera (devotion), and Deadly Alliance (party) count as artifact payoffs.
- `synergy-artifact`: Drooling Ogre changes hands "Whenever a player casts an artifact spell"; Desperate Castaways "can't attack unless you control an artifact"; Acolyte of Aclazotz sacrifices "another creature or artifact"; Benevolent River Spirit's waterbend taps "artifacts and creatures"; Reality Ripple only targets one.
- `synergy-artifact-creature`: Arcbound Worker is an artifact with "Modular 1", so setup; Abuna Acolyte prevents damage to "target artifact creature"; Whipflare "deals 2 damage to each nonartifact creature."
- Bargain: Candy Grapple may sacrifice "an artifact, enchantment, or token", so it is a payoff for three themes.
- Token riders: Ancestors' Aid is a pump spell that adds "Create a Treasure token". Half weight at most.

### 6. Both jobs

Count once. A reward that scales or triggers is a payoff (Frogmite, Embersmith); a cost reducer is half a payoff (Etherium Sculptor). A reward that needs a single artifact is setup when the card is itself an artifact: Court Homunculus (common), "+1/+1 as long as you control another artifact", is an artifact creature, so the half-payoff rule skips it. Whirler Rogue (uncommon), which makes "two 1/1 colorless Thopter artifact creature tokens", is setup. Counting once only splits the jobs. An artifact payoff is still an artifact on the table, so the source counts in part 7 include it.

### 7. Enough for a decent bulk deck

Sources are copies of every artifact card (payoffs and artifact lands included) plus token makers.

| Size | Sources (mana value 3 or less) | Payoffs  | Also                           |
| ---- | ------------------------------ | -------- | ------------------------------ |
| 60   | 16 to 22 (10+)                 | 6 to 8   | 5 to 7 removal, evasive bodies |
| 40   | 10 to 14 (7+)                  | 4 to 5   | 3 to 5 removal                 |
| 20   | 7 to 10 (5+)                   | 3 to 4   | no count payoffs               |
| 100  | 30 to 40 (15+), lands included | 10 to 14 | 8 to 10 removal                |

About three sources per payoff. Count payoffs need three artifacts on the table, so take them only at the top of the range: 18 sources in 60 give 78% to have seen three by turn 5, 12 in 40 give 79%, 32 in 99 give 82%. Near the bottom, 16 in 60 give 68% and 10 in 40 give 65%, so lean on enters, cast, and sacrifice payoffs, which need one artifact at a time. A packet's 7 sources give 35% to have three in the paired 40-card game but 94% to have one: no metalcraft or "three or more" in packets. Payoffs follow the shared standard: 6 in 60 (75%), 4 in 40 (78%), 3 or 4 in a packet (67% to 78%), 10 in 99 (74%).

Repeatable token makers are welcome, not a floor: neither 60-card Intro Pack below runs one. Cast payoffs count only artifact cards, so a deck whose payoffs are mostly cast payoffs needs its floor in artifact cards alone. A commander that counts artifacts allows 6 to 8 other payoffs; one that makes an artifact token every turn lets sources drop by about 5.

Type caps: noncreature artifacts share the cap with enchantments (about 11 at 60, 6 at 40, 3 at 20, 25 at 100). The rest of the sources must be artifact creatures, token makers, and artifact lands. Bulk has 870 artifact creatures against 1,310 noncreature artifacts, so this works at 60 and 100. At 20 it binds: real Inventive and Vehicles packets run up to 4 or 5 noncreature artifacts and enchantments against the cap of 3.

Evidence, copies under the part 9 hints (`g3fix/decks-artifacts.txt`):

- Intro Pack "Myr of Mirrodin" (60): 16 sources (14 at 3 or less), 6 payoffs, 4 of them metalcraft. It sits at the floor, with count payoffs a little under the odds.
- Intro Pack "Metalcraft" (60): 21 sources (16 at 3 or less), 22 payoffs (17 count), 10 of which are artifacts themselves.
- Commander "Urza's Iron Alliance": 47 source cards (46.5 with one token-making spell at half), 7 of them artifact lands (Ancient Den, Seat of the Synod, Vault of Whispers, Darksteel Citadel, three Bridges), 30 at 3 or less; 17 payoff cards, 16 with halves.
- Jumpstart "Inventive" and "Urza's" packets: 6.5 to 11 sources; 0 to 5 payoffs, median 2. Those packets show a payoff in about half of paired games; a packet that names the theme should hold 3.
- Learned 40-card artifacts plans (4,868 draft decks): a median 9 live enablers, which are artifact cards (quartiles 7 to 11, so token makers come on top), and 4 live payoffs. Most sit at the bottom of the range, which suits enters and sacrifice payoffs better than count payoffs.
- EDHREC's artifacts page has Etherium Sculptor in 51% of decks.

### 8. Where the live matchers differ

- Enabler #1 `types artifact` is the right resource with no weight: 6-mana Archive Arbiter counts like Ornithopter. It does count artifact lands: the helper shows Seat of the Synod meeting enabler #1.
- Missed setup: 332 bulk non-artifact token makers under the part 9 pattern (Thraben Inspector, Ambitious Aetherborn's "Fabricate 1", Beamsaw Prospector's Lander). Only `repeatable-artifact-tokens` admits them; Whirler Rogue counts only as payoff.
- Payoff #1 is the weak spot: 248 of 657 bulk payoffs (38%) pass a strict rule. 455 hit only through `synergy-artifact`, 56 only through `affinity`, and 50 only through `synergy-artifact-creature`: Modular artifact creatures (Arcbound Worker), damage prevention (Abuna Acolyte), one-sided sweepers (Whipflare). The part 9 hints keep 7 of those 50, mostly lords and counts (Chief of the Foundry, Collective Drone).
- Both: 206 bulk artifacts carry a payoff tag. Cast triggers are not checked against the deck (`our-builder-themes.md`: Poetic Ingenuity beside one artifact spell).

### 9. Matcher hints

Patterns run as in Lifegain: reminder text removed, flags `im`. Removing reminder text keeps Bargain's "sacrifice an artifact" out of the sacrifice pattern.

- Setup: type Artifact on a nonland card, weight 1, 0.5 at mana value 5 or more; artifact lands, weight 1; `repeatable-artifact-tokens`, weight 2; text `investigate|fabricate \d|incubate|create [^.]*\b(treasure|clue|food|blood|powerstone|map|gold|junk|lander|mutagen|vibranium)\b[^.]*tokens?|artifact (creature )?tokens?`, minus `its controller creates|gift a|(target|each) opponent creates|that player creates`; half weight on instants and sorceries and at mana value 5 or more. The token names are every token whose reminder text in the pack says it is an artifact (`node data/review/scratch/g3fix/tokens.cjs`).
- Tokens and lands feed count, enters, and sacrifice payoffs, not cast payoffs. When cast payoffs are most of the deck's payoffs, count only artifact cards toward the floor.
- Payoffs, weight 1. Count: `artifact-count-matters`, `metalcraft`, `affinity-for-artifacts`, `improvise`, text `for each artifact (and\/or [a-z]+ )?you control|(two|three) or more artifacts|number of artifacts you control|artifact creatures you control get|number of artifact creatures you control`. Enters: `artifactfall`, text `whenever (an|another|one or more) [^.]*artifacts? you control enters?`. Cast: `whenever you cast an artifact spell`. Sacrifice: `sacrifice an artifact[:,]|sacrifice (two|three) artifacts|whenever you sacrifice an artifact`.
- Half payoff, weight 0.5: `cost-reducer-artifact`; text `as long as you control (an|another) artifact|if you control an artifact` on a card that is not an artifact. On an artifact the same text is setup (Court Homunculus).
- Exclude: `hate-artifact`. `synergy-artifact`, `synergy-artifact-creature`, `synergy-historic`, `affinity` without `affinity-for-artifacts`, and keyword Bargain admit a card only when a tag or pattern above also matches.

Bulk under these hints (`g3fix/bulk.txt`): 2,053 artifacts as setup, 332 non-artifact one-shot token makers, 161 repeatable token makers, 248 payoffs (109 count, 53 enters, 10 cast, 34 sacrifice, plus 13 cost reducers and 29 one-artifact conditions at half).

## Voltron (auras)

### 1. Plan

Suit up one or two creatures that are hard to block or kill, and hit hard.

### 2. Builds up and spends

Attachments on your creatures, one per card. Equipment stays when its creature dies (rule 301.5c), so it is repeatable. An Aura dies with its creature (303.4c) unless it returns or has umbra armor (702.89a). Carriers are what get spent.

### 3. Setup jobs

- **Buff Auras** (one-shot, weight 1): an Aura that enchants a creature and makes it bigger, evasive, or harder to kill. Holy Strength: "gets +1/+2". Ethereal Armor: "+1/+1 for each enchantment you control". Aqueous Form: "Enchanted creature can't be blocked." Steel of the Godhead: "As long as enchanted creature is white, it gets +1/+1 and has lifelink."
- **Sticky Auras** (repeatable, weight 1.5): umbra armor, return to hand, bestow. Rancor: "return it to its owner's hand". Hyena Umbra: "+1/+1 and has first strike. Umbra armor". Nimbus Naiad has bestow.
- **Equipment** (repeatable, weight 2). Bonesplitter: "Equipped creature gets +2/+0. Equip {1}". Vulshok Morningstar: "+2/+2".
- **Finders** (one-shot, weight 1). Heliod's Pilgrim: "search your library for an Aura card".

### 4. Payoff jobs

- **Carriers** (repeatable, weight 1), the main payoff in bulk: hexproof, evasive, or double strike bodies at one to three mana that can attack. Gladecover Scout: "Hexproof". Silhana Ledgewalker adds "can't be blocked except by creatures with flying". A power-0 body counts half, since it does nothing until suited up (Ornithopter: "Flying", 0/2). A defender is never a carrier (Angelic Wall: "Defender (This creature can't attack.)"). Needs 6+ attachments.
- **Cast, enter, and target engines** (repeatable, weight 2). Kor Spiritdancer (rare): "Whenever you cast an Aura spell, you may draw a card." Light-Paws, Emperor's Voice: "Whenever an Aura you control enters, if you cast it, you may search your library for an Aura card". Heroic, as on Favored Hoplite: "Whenever you cast a spell that targets this creature". Valiant reads "a spell or ability you control", so equip abilities trigger it too: Heartfire Hero, "put a +1/+1 counter on it". Need ten or more attachments and tricks.
- **Equipped bonuses** (repeatable, weight 1). Armed Assailant: "As long as this creature is equipped, it gets +2/+0 and has menace." Needs four or more Equipment.

### 5. False friends

- Hostile Auras the six excluded tags miss: Dwindle ("gets -6/-0", tag `shrink`), Frogify ("loses all abilities", `humble`), Cast into Darkness ("can't block", `prevent-blocker`).
- Auras made for an opponent's creature. Goad: Coercive Impetus ("gets +1/+1 and is goaded") and the rest of the Impetus cycle. Slow death: Necrotic Plague ("Enchanted creature has 'At the beginning of your upkeep, sacrifice this creature.'"). A forced attack alone is fine in a deck that attacks anyway: Furor of the Bitten ("gets +2/+2 and attacks each combat if able") stays setup.
- Wild Growth: "Enchant land". Ramp.
- Skullclamp ("gets +1/-1", "Whenever equipped creature dies, draw two cards") is a sacrifice engine. Lightning Greaves gives shroud (702.18a), and Auras and equip both target (702.6a: "Attach this permanent to target creature you control"), so it blocks your other attachments. Swiftfoot Boots gives hexproof instead and is fine.
- Payoff #1's tags pull in cards that pay nothing off. All 47 `synergy-modified` cards also carry `synergy-aura` and `synergy-equipment`, and enter through those: Ambitious Assault is a team pump with a draw rider. Fumble (`synergy-aura`, `synergy-equipment`) is removal that steals attachments. `exalted` makes Ignoble Hierarch, a mana creature, a payoff.
- `heroic` covers 128 cards. The 45 with Heroic and the 10 with Valiant are payoffs, though Flowerfoot Swordmaster's Valiant only gives "Mice you control get +1/+0". The other 73 are mixed: Angelic Cub grows when targeted, while Cephalid Aristocrat only mills ("Whenever this creature becomes the target of a spell or ability, mill two cards").

### 6. Both jobs

Count what the card is on the battlefield. An Aura or Equipment is setup even with a payoff rider (Daybreak Coronet: "Enchant creature with another Aura attached to it"). A creature is a payoff (Lizard Blades: "Double strike", plus reconfigure). A tutor is setup, except Light-Paws: it finds Auras only when you cast one, so it is a payoff engine.

### 7. Enough for a decent deck

| Size | Attachments (weighted floor)                 | Carriers and payoffs | Also needs                   |
| ---- | -------------------------------------------- | -------------------- | ---------------------------- |
| 60   | 12-14 (18+), more if most are one-shot Auras | 8-10, 4+ carriers    | 16-20 creatures, 4-6 removal |
| 40   | 7-8 (11+)                                    | 5-6                  | 12-13 creatures, 2-3 removal |
| 20   | 2-4 (4+), mostly Equipment                   | 1-2                  | 1 removal                    |
| 100  | 18-24 (30+)                                  | 8-12                 | 5+ protection, 8 removal     |

Reasoning: the weighted floor stands in for "half repeatable". At 60, 18 means about six Equipment among 12 attachments, or about 18 one-shot Auras: Orzhov Auras runs 20 Auras (weighted 20) and 8 payoffs on 19 lands. 13 attachments in 60 show two by turn 5 in 80% of games. 8 carriers and payoff creatures show one in 85%; the 4 carriers alone show one in only 60%, so the payoff creatures must also be bodies worth suiting up.

A 40-card deck with 16 or 17 lands has 23 or 24 other slots: 8 attachments, 13 creatures with the carriers and payoffs among them, and 2 or 3 removal. 8 attachments show two by turn 5 in 78% of games, and 5 carriers and payoffs show one in 85%.

A 20-card packet adds its attachments to a 40 that holds another packet's cards. There, 4 attachments show one by turn 5 in 78% of games but two in only 35%, so the packet's plan is one suited-up creature, not a stack. Equipment also suits up the other packet's creatures. The Enchanted, Equipped, and Swordmaster packets hold 2 to 4 attachments (weighted 2 to 6); 4 of the 8 meet this row.

At 100, EDHREC's listed cards give 5.4 Auras and 7.3 Equipment per deck on the voltron page, 17.5 Auras on the auras page, and 13.6 Equipment on the equipment page; Swiftfoot Boots ("hexproof and haste") is in 36 to 65% of decks. Aura of Courage has 18 attachments (weighted 31). A carrier commander replaces most carriers; spend the slots on attachments and protection. An engine commander such as Light-Paws wants 20+ of the type it counts.

### 8. Where the live matchers differ

- Enabler #2 (`typeLineAny Aura` minus six tags) counts 911 Auras, and 145 of them enchant no creature. Of the 766 that enchant a creature, the section 9 exclusions catch 68 by tag or text and 14 more that goad, phase out, or kill their creature (`g4fix/hints.cjs voltron`). `g4-auras2.cjs` finds 222 with a hostile tag such as `removal`, though some of those are buffs with a damage rider. The section 9 setup hint keeps 513.
- Missed setup: 43 bestow creatures (no "Aura" in the type line) and heroic's targeted tricks (Gods Willing).
- Enabler #1 counts all 627 Equipment alike, Skullclamp and Lightning Greaves included, and never weighs Equipment above one-shot Auras.
- Payoff #1 takes `synergy-aura` and `synergy-equipment` (and with them all 47 `synergy-modified` cards and removal such as Fumble), all 128 `heroic` cards (73 with neither Heroic nor Valiant), and `exalted` (46). Payoff #2 misses evasive carriers.
- Both: Stoneforge Mystic (enabler #3, payoff #1), Lizard Blades (#1, #2), Daybreak Coronet, Light-Paws.
- `our-builder-themes.md` rated both Voltron decks it checked as working.

### 9. Matcher hints

Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: an Aura whose enchant line names a creature, `/^Enchant [^\n]*\bcreature\b/m` (this takes "creature you control", "creature or Vehicle", Daybreak Coronet's line, and reminder text), with `/(Enchanted (creature|permanent)|enchanted (creature|permanent) is [^,.]*, it) (gets \+|has|gains|can't be blocked)/`. Equipment with `/Equipped creature (gets \+|has|gains)/`. Repeatable: Equipment; sticky: keywords `Bestow` or `Umbra armor`, or `/return (it|this card) to its owner's hand/i`.
- Exclude Auras: tags `shrink`, `humble`, `prevent-blocker`; `/Enchanted (creature|permanent) (gets -\d|can't (attack|block)|doesn't untap|loses all abilities)/`; Auras for an opponent's creature, `/is goaded|sacrifice this (creature|permanent)|has phasing\.|enchanted creature's controller (loses|sacrifices)/i`. Exclude Equipment: `/Equipped creature gets \+\d+\/-\d[\s\S]*Whenever equipped creature dies|Equipped creature has [^.]*\bshroud\b/` (Skullclamp, Lightning Greaves, Neurok Stealthsuit, General's Kabuto: 4 of 540).
- Payoffs: `/Whenever you cast an? (Aura|Equipment)/i`, `/Whenever an? (Aura|Equipment) (you control )?(enters|becomes attached)/i` (Light-Paws), `/for each (Aura|Equipment)[^.]*attached/i`, `/as long as (this creature|it) is (enchanted|equipped)/i` (Armed Assailant), keywords `Heroic` and `Valiant`. They hit 72 permanents. Carriers: a creature at mana value 3 or less with Hexproof, Double strike, or derived evasive, without Defender or `/can't attack/`; power 0 counts half.
- Down-weight: `synergy-modified`, `exalted`, `heroic` without Heroic or Valiant (unless the text grows the creature when targeted), payoffs tagged `removal`.

## Evasion (flyers)

### 1. Plan

Play creatures the opponent cannot block, mostly flyers, make them bigger, and save removal for theirs.

### 2. Builds up and spends

Evasive power attacking each turn. Unit: one evasive creature that can attack; power 2 or more counts in full, power 1 half, power 0 or defender nothing. Variable power (`*`) counts in full. Payoffs multiply it. The setup cards are the win, so the deck is mostly setup, and payoffs help but are not needed.

### 3. Setup jobs

- **Evasive attackers** (repeatable, weight 2 at power 2+ or `*` power, 1 at power 1): Flying, Menace, Shadow, Fear, Intimidate, Skulk, Horsemanship, "This creature can't be blocked", or fake flying ("can't be blocked except by creatures with flying", tag `fake-flying`), without Defender. Wind Drake: a 2/2 "Flying" for three. Mist Raven: "Flying" and an enters bounce. Skyhunter Skirmisher: "Flying, double strike". Crackling Drake ("\*/4", "Flying") grows with your instants and sorceries.
- **Landwalk and conditional unblockable** (repeatable, half the attacker weight): they work only against some opponents. Bog Raiders: "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)".
- **Granters.** Repeatable (weight 2): Levitation ("Creatures you control have flying."), Pegasus Courser ("another target attacking creature gains flying until end of turn", on each attack). One creature at a time (weight 1): Arcane Flight ("+1/+1 and has flying"), Cobbled Wings. One-turn tricks are tricks, and an enters trigger that grants flying until end of turn is a rider.

### 4. Payoff jobs

- **Flyer lords** (repeatable, weight 2). Favorable Winds: "Creatures you control with flying get +1/+1." Empyrean Eagle: "Other creatures you control with flying get +1/+1." Spirit of the Spires gives +0/+1: weak, weight 1. Lords want 10+ flyers in 60.
- **Lasting anthems** (repeatable, weight 1). Glorious Anthem: "Creatures you control get +1/+1." Not specific to flyers.
- **Flyer triggers and discounts** (repeatable, weight 1). Watcher of the Spheres: "Creature spells with flying you cast cost {1} less", and it grows when another flyer enters. Wants 10+ flyers.

### 5. False friends

- Non-attackers in the derived enabler: Angelic Wall ("Defender, Flying"), Ornithopter (0/2), Birds of Paradise (0/1, "{T}: Add one mana of any color").
- Conditional `unblockable`. Bouncing Beebles: "can't be blocked as long as defending player controls an artifact."
- `synergy-flying` mixes in flyer hate and riders. Earthquake ("each creature without flying and each player") and Moat ("Creatures without flying can't attack") are interaction that spares your flyers. Lofty Denial only improves "If you control a creature with flying".
- Flyer hate that names flyers without "you control": Gravity Well ("Whenever a creature with flying attacks, it loses flying until end of turn") and Ezuri's Archers ("Whenever this creature blocks a creature with flying, this creature gets +3/+0"). A flyer payoff rewards flyers you control.
- `anthem` and `keyword-anthem`: Goblin King ("Other Goblins get +1/+1 and have mountainwalk"), Intangible Virtue ("Creature tokens you control"), A Tale for the Ages ("Enchanted creatures you control"), Gate Hound (vigilance "as long as this creature is enchanted"), and keyword-only anthems such as Temur Ascendancy ("Creatures you control have haste").
- `gives-flying` and `gives-evasion` cover 936 permanents, with one-turn grants, typal lords, and landwalk among them (Goblin King again).

### 6. Both jobs

An evasive lord (Empyrean Eagle) is a payoff: its body is one flyer, its text pays off the rest. A granter on an evasive body (Pegasus Courser) is setup, counted once, as a granter.

### 7. Enough for a decent deck

| Size | Evasive attackers (weighted floor) | Payoffs | Also needs                            |
| ---- | ---------------------------------- | ------- | ------------------------------------- |
| 60   | 10-16, 7+ at power 2+ (17+)        | 0-4     | 6-8 removal, curve topping at 4 or 5  |
| 40   | 9-11 (14+)                         | 0-2     | 4-5 removal, 15-17 creatures          |
| 20   | 4-6 (6+)                           | 0-1     | 1-2 removal                           |
| 100  | 18-26 (30+)                        | 3-8     | 8-10 removal, sweepers sparing flyers |

Granters count toward the weighted floor, not the attacker copies.

Reasoning: the deck wants two evasive attackers by turn 5; 12 in 60 give that in 76% of games, 16 in 90%, and 10 in 65%. The three 60-card flyer precons sit at the low end with few payoffs: Wings of Light has 12 attackers and 1 payoff (weighted 19), Take to the Sky 10 and 2 (17), and Sky Patrol 10 and 0 (20), which makes up for it with 12 removal. Payoffs help: a lord over 10 flyers adds several damage a turn. But a deck with none still works, so the row does not require them.

At 40, Sky Slam has 11 attackers and no payoffs (weighted 18); 9 attackers show two by turn 5 in 84% of games. In the shuffled 40 of two packets, 4 attackers from one packet show one by turn 5 in 78% of games, 6 in 90%. The Jumpstart flyer packets hold 3 to 6 attackers and 0 to 2 payoffs; 8 of the 12 meet this row.

At 100, EDHREC's flying page lists 13.8 flying creatures (14.0 evasive) and 3.5 `synergy-flying` cards per deck. Its `anthem` and `keyword-anthem` permanents add 5.6, but stat anthems and flyer lords among them add only 1.1 (Empyrean Eagle 36%, Favorable Winds 21%). The rest are keyword or typal grants: the top two are Temur Ascendancy (64%, "Creatures you control have haste") and Call the Spirit Dragons (46%, "Dragons you control have indestructible") (`g4fix/edh.cjs flying`). 18 attackers in 99 show two by turn 5 in 69% of games. Its top commanders are typal, such as Giada, Font of Hope ("Each other Angel you control enters with an additional +1/+1 counter"). A lord commander does the payoff job: halve the payoffs, add flyers.

### 8. Where the live matchers differ

- Enabler #1 (`derived evasiveCreature`) counts 72 that cannot attack, 108 power-0 bodies, and 158 conditional `unblockable` cards, and weighs a 1/1 like a 4/4. Of the 108, 31 have `*` power, which the core reads as 0 (`powerValue` in `matchers.ts`), so Crackling Drake and Battle Squadron ("power and toughness are each equal to the number of creatures you control") look like Ornithopter (`g4chk/counts.cjs`).
- It misses 127 landwalk creatures and the 8 tagged `fake-flying`, such as Silhana Ledgewalker.
- Granters are missed: Arcane Flight and Cobbled Wings meet no flyers clause; Levitation and Archetype of Imagination ("Creatures you control have flying") count as payoffs via `keyword-anthem` (payoff #2).
- Payoff #1 (`synergy-flying`, 102 cards without Un-sets): 34 match the section 9 payoff hint; 16 mention "without flying", mostly sweepers and locks; 7 are "if you control a creature with flying" riders.
- Payoff #2 (957 anthem permanents): 427 carry the `typal` tag. Of the other 530, 79 are team stat anthems or flyer lords by the section 9 hint, 275 grant keywords only (no `anthem` tag), and 32 pump only tokens, enchanted, or equipped creatures.
- Both: flying lords and discounts (Empyrean Eagle, Watcher of the Spheres).

Counts without a script named are from `g4fix/hints.cjs evasion`.

### 9. Matcher hints

Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: derived evasive or tag `fake-flying`, power 1+ or `*` power, no Defender, no `/can't attack/`, weighted by power. `unblockable` counts in full only with `/This creature can't be blocked\.?$/m`; `/can't be blocked (as long as|if|this turn)/` and landwalk keywords count half.
- Granters: tag `gives-flying` on a permanent without tag `typal`, and the grant must last: `/(Enchanted|Equipped) creature [^.]*\b(has|gains) [^.]*flying|creatures you control (have|gain) flying(?! until)/i`, or on each attack or tap, `/(Whenever [^,]*attacks|\{T\}[^:]*:)[^.]*gains flying/i`. This keeps 188 of the 936 permanents the two tags cover.
- Payoffs: `/creatures you control with flying get \+/i`, `/(whenever|for each)[^.]*creatures? you control with flying/i`, `/spells with flying you cast cost/i`, `/^(Other )?creatures you control get \+\d/im` on permanents. The first three hit 32 permanents, none of them flyer hate.
- Exclude from payoffs: `/without flying/i` (interaction), `/if you control a creature with flying/i` (rider), tag `typal`, `/(creature tokens|enchanted creatures|equipped creatures) you control/i`, keyword-only anthems (setup if they grant flying).

## Burn (burn)

### 1. Plan

Attack early with cheap creatures, then point burn at the opponent for the last 6 to 10 life, helped by creatures that ping each turn or grow or ping when you cast spells.

### 2. Builds up and spends

Damage to the opponent: 20 life, or 40 per opponent in Commander. Unit: points of damage or life loss to a player; the style's colors are red and black, and black's drain does the same job. Payoffs feed on a second resource, noncreature spells cast. A burn spell makes both; a burn creature only damage.

### 3. Setup jobs

- **Burn spells that can hit a player** (one-shot, weight 1): instant or sorcery with "damage to any target", "target player or planeswalker", or "each opponent", X and variable damage, or life loss. Lightning Bolt: "3 damage to any target". Shock: "2 damage to any target". Lava Spike: "3 damage to target player or planeswalker". Fireball: "X damage divided evenly, rounded down, among any number of targets". Fling: "damage equal to the sacrificed creature's power to any target". Black: Sovereign's Bite, "Target player loses 3 life and you gain 3 life".
- **Repeatable damage** (weight 2): a permanent that hits a player every turn on its own. Prodigal Pyromancer: "{T}: This creature deals 1 damage to any target." Goblin Fireslinger: the same, to "target player or planeswalker". Punishers that fire on the opponent's own actions count here too: Underworld Dreams, "Whenever an opponent draws a card, this enchantment deals 1 damage to that player." A pinger that can hit only creatures is removal: Aven Archer, "2 damage to target attacking or blocking creature".
- **One-shot damage on a body** (weight 0.5). Viashino Pyromancer: "When this creature enters, it deals 2 damage to target player". Goblin Arsonist: "When this creature dies, you may have it deal 1 damage to any target." Fire Imp ("2 damage to target creature") is removal.

### 4. Payoff jobs

- **Spells into damage** (repeatable, weight 2), the best. Guttersnipe: "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent." Firebrand Archer and Kessig Flamebreather: "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent."
- **Prowess and spell pumps** (repeatable, weight 1: the damage must get through in combat). Monastery Swiftspear: "Haste, Prowess". Kiln Fiend: "+3/+0" per instant or sorcery. Runaway Steam-Kin: "Whenever you cast a red spell, if this creature has fewer than three +1/+1 counters on it, put a +1/+1 counter on this creature." They need one- and two-mana spells.
- Each payoff wants two or more spells cast while it lives.

### 5. False friends

- Face damage as a rider or the opponent's choice: Chandra's Outrage ("2 damage to that creature's controller"), Agonizing Demise (only "If this spell was kicked"), Blazing Salvo ("unless that creature's controller has Blazing Salvo deal 5 damage to them").
- Symmetric sweepers: Earthquake hits "each player", you too.
- Face damage on another theme's trigger. Impact Tremors ("Whenever a creature you control enters, this enchantment deals 1 damage to each opponent") needs a creature or token engine, Scourge of Valkas ("Whenever this creature or another Dragon you control enters") needs Dragons, and Mayhem Devil ("Whenever a player sacrifices a permanent") needs sacrifices. The live enabler counts them via `burn-player`; `g4-burn.cjs` finds 228 such permanents. They are Burn setup only when the deck runs that engine.
- Pingers and enters triggers that hit only creatures: Aven Archer, Fire Imp, Chaos Maw ("deals 3 damage to each other creature").
- Burn creatures do not feed prowess.
- Spell payoffs with no damage: Augur of Bolas ("look at the top three cards... instant or sorcery"), graveyard counts (Ghitu Lavarunner: "As long as there are two or more instant and/or sorcery cards in your graveyard"), cost reducers. Those are Spellslinger.

### 6. Both jobs

A card that deals damage when you cast spells (Guttersnipe, Electrostatic Field) is a payoff: it does nothing without spells. A pinger is setup, even when spells untap it: Thermo-Alchemist ("{T}: This creature deals 1 damage to each opponent. Whenever you cast an instant or sorcery spell, untap this creature.") and Cinder Pyromancer count once, as repeatable damage, since the tap works with no spells.

### 7. Enough for a decent deck

| Size | Burn spells (weighted setup floor) | Repeatable damage and payoffs, together  | Also needs                                      |
| ---- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| 60   | 10-16 (14+)                        | 4-10, either kind                        | 8-12 other cheap creatures                      |
| 40   | 7-10 (10+)                         | 3-6                                      | 6-8 creatures                                   |
| 20   | 2-3 (4+)                           | 3-4                                      | 3+ cheap creatures                              |
| 100  | 3-8 (12+)                          | 6-10, mostly cast triggers and punishers | 20+ instants and sorceries, ramp, draw, removal |

The weighted floor adds burn spells at 1, repeatable damage at 2, and one-shot bodies at 0.5.

Reasoning: 20 life is about seven 3-damage spells, and cheap creatures deal the first 8 to 10, so the deck wants three or four burn spells by turn 6 or 7. A pinger that lands on turn 2 or 3 deals 4 or 5 damage by turn 7, more than one burn spell, hence weight 2; a one-shot body deals 1 or 2, hence 0.5. A floor of 14 then works about like 14 burn spells, which show three in 14 cards 70% of the time (10 spells alone: 43%).

The three 60-card burn decks in the corpus meet the row: Fire and Lightning has 11 burn spells, 4 repeatable, and 0 payoffs (weighted 20.5); Lightning Aggro 13, 4, and 4 (25); Mono-Red Burn 12, 0, and 8 (14). Repeatable damage and payoffs stand in for each other, so the row asks for four or more of either: 4 show one by turn 5 in 60% of games, 8 in 85%, and burn spells carry the rest. Burn doubles as removal.

At 40, the 23 or 24 spell slots hold about 8 burn spells, 4 repeatable or payoffs, and 8 creatures; 8 burn spells show three by turn 7 in 59% of games, 10 in 77%. In the shuffled 40 of two packets, a packet's 3 burn spells show one by turn 7 in 74% of games, and its 3 repeatable or payoffs show one by turn 5 in 67%. The Jumpstart packets Lightning (1), Lightning (2), and Burning hold 1 or 2 face-burn spells and 3 or 4 repeatable or payoffs; the last two meet this row.

In Commander, three opponents at 40 make one-shot face burn weak. EDHREC's burn page gives 1.9 burn spells by the section 9 hint, 4.3 burn permanents or spell payoffs, and 22.4 instants and sorceries per deck. The burn permanents split into 1.6 cast triggers (Guttersnipe 22%), 1.8 punishers and other triggers (Niv-Mizzet, Parun 24%; Mayhem Devil 19%; Impact Tremors 18%; Underworld Dreams 12%; Manabarbs 9%), and 0.1 tap pingers (Thermo-Alchemist 12%) (`g4fix/edh.cjs burn`). So at 100, punishers count as repeatable damage, symmetric ones too (Manabarbs: "Whenever a player taps a land for mana"), since each opponent takes the hit as often as you do. Other-engine triggers count only with their engine. 8 repeatable or payoffs in 99 show one by turn 5 in 66% of games. A commander like Ghyrson Starn, Kelermorph ("deals exactly 1 damage... deals 2 damage") is the payoff: add pingers.

Black's half: drain spells such as Sovereign's Bite do burn's job. The pack has 58 instants and sorceries that make a target player or each opponent lose life, none tagged burn. Underworld Dreams is black's punisher.

### 8. Where the live matchers differ

- The enabler (`burn-player|burn-any`, not land) counts 1,751 cards; only 547 are instants or sorceries, so most never feed the payoffs. The section 9 setup hint keeps 392 of the 547; the other 155 hit a player only as a rider (33), through "each player" (53), or not at all. It also misses the 58 drain spells.
- It counts one-shot bodies (Viashino Pyromancer) the same as pingers, and pingers that hit only creatures: of 187 `pinger` permanents with a tap damage ability, 138 can hit a player. It also counts the 228 face-damage triggers of other themes.
- Payoff #1 misses `synergy-noncreature`: 157 of its 310 cards meet no live payoff clause, and Firebrand Archer, Kessig Flamebreather, and Coruscation Mage count only as enablers. The tag is too broad to add: the section 9 payoff hint catches 154 of its 310 cards, and most of the rest are quest counters, cost reducers, and cards like Brazen Bluff.
- The payoff clauses are Spellslinger's: of 659 cards, only about 16 turn a cast into damage and 133 into a pump; 94 care about the graveyard, 31 make tokens, and some reduce costs (Goblin Electromancer). They miss the 8 "Whenever you cast a red spell" payoffs, such as Runaway Steam-Kin.
- Both: Guttersnipe, Thermo-Alchemist, Electrostatic Field.

Counts without a script named are from `g4fix/hints.cjs burn` and `g4chk/counts.cjs`.

### 9. Matcher hints

Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: instant or sorcery with `/damage (equal to [^.]*? )?to (any (other )?target|target player|target opponent|each opponent)|divided (evenly|as you choose)[^.]* among|Choose any target|any number of targets|each of (up to )?(one or )?\w+ targets|(target player|target opponent|each opponent) loses (\d+|X) life/i`.
- Rider: `/damage to that creature's controller|unless that creature's controller|If this spell was kicked/i`. `/each player/i` is interaction.
- Repeatable: a permanent with `/\{T\}[^:]*: [^.]*deals? (\d+|X) damage to [^.]*(any target|player|opponent)/i`. Punishers: `/Whenever (an opponent|a player) [^,.]*, [^.]*(deals? \d+ damage to (that player|each opponent)|that player loses \d+ life)/i` (53 permanents). One that hits only opponents counts at every size; one that names "a player" hits you too and counts only at 100.
- One-shot: a creature with `/When [^.]*(enters|dies)[^.]*deals? (\d+|X) damage to [^.]*(any target|player|opponent)/`. "deals?" takes Goblin Arsonist's "have it deal", and "When " with its space leaves out "Whenever" triggers.
- Other engines: a `burn-player` permanent whose damage trigger needs creatures entering, sacrifices, or a creature type counts only with that engine in the deck.
- Payoffs: keyword Prowess; tag `prowess-like`; `/Whenever you cast (or copy )?(an instant or sorcery|a noncreature|an instant|a sorcery|a red) spell[^.]*(deals? (\d+|X) damage|loses \d+ life|gets \+|put a \+1\/\+1 counter|untap)/i`, which also takes magecraft's "cast or copy". Not tag `synergy-noncreature`. A pinger that spells untap is repeatable setup, not a payoff (section 6).
- Exclude from payoffs: `/(instant|sorcery) cards? in your graveyard/i`, tag `impulse-instant`, cost reducers without damage. Tokens on cast count half.
- Limit, for all three styles: the `[^.]*` parts stop at the first period, so a name with a period hides a payoff. Black Waltz No. 3 ("Whenever you cast a noncreature spell, Black Waltz No. 3 deals 2 damage to each opponent") fails the payoff hint. A hint is a first pass; the examples and false friends above are the test.

## Landfall (landfall)

### 1. Plan

Make a land drop every turn, add extra lands with fetch lands and ramp, and let permanents that trigger on each land build tokens, counters, life, or damage.

### 2. Resource

Lands entering under your control; one land is one trigger. Plain land drops give about one a turn. Setup adds a second or third.

### 3. Setup jobs

- **Fetch and bounce lands** (one-shot, weight 1, no spell slot). Evolving Wilds: "Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped", two triggers from one drop. Simic Growth Chamber: "return a land you control to its owner's hand", to replay it.
- **Land ramp** (one-shot, weight 1 per land). Rampant Growth: "put that card onto the battlefield tapped". Harrow: "sacrifice a land ... put them onto the battlefield", two triggers.
- **One-shot extra drop** (weight 0.5 to 1; needs a land in hand). Explore: "You may play an additional land this turn." Growth Spiral.
- **Repeatable engines** (weight 2). Walking Atlas, Sakura-Tribe Scout: "{T}: You may put a land card from your hand onto the battlefield."
- **Land recursion** (mostly Commander). Crucible of Worlds: "You may play lands from your graveyard." It replaces the land drop rather than adding one, so it is repeatable setup (weight 2) only with 3 or more fetch lands, which it replays for two triggers every turn; without them it is support. Returning lands to the battlefield is one-shot (weight 1 per land): Quarry Beetle, "return target land card from your graveyard to the battlefield"; Splendid Reclamation, "Return all land cards from your graveyard to the battlefield tapped." Few are cheap: 21 nonland cards carry `crucible-of-worlds` (1 common or uncommon) and 68 carry `reanimate-land` (12). EDHREC's landfall page lists about 3.5 per deck.

Land to hand (Civic Wayfinder; Groundskeeper, "Return target basic land card from your graveyard to your hand") and card draw are support, not setup.

### 4. Payoff jobs

All fire on a normal land drop, so payoffs never starve; setup decides how hard they hit.

- **Lasting reward** (weight 1). Zendikar's Roil: "create a 2/2 green Elemental creature token". Prowling Felidar: "put a +1/+1 counter on this creature". Grazing Gladehart: "gain 2 life". Worth a card after two or three lands.
- **One-turn rewards** (weight 0.5). Steppe Lynx, Plated Geopede: "+2/+2 until end of turn". Good only when attacking after a land. Mana is a one-turn reward too: Lotus Cobra, "add one mana of any color".
- **Riders and thresholds** (0.25). Searing Blaze: "If you had a land enter the battlefield under your control this turn". Fledgling Griffin: "gains flying until end of turn", a keyword for one turn.

### 5. False friends

- `tutor-land-to-battlefield` on Path to Exile: "Its controller may search", so the opponent gets the land. 21 setup-tagged cards carry `donate-rampant-growth`. Cleansing Wildfire is different and has no `donate-` tag: "Destroy target land. Its controller may search ... Draw a card." Aimed at your own land it trades a land for a tapped basic: one extra trigger and a card, but no extra land. Count it as setup worth 0.5, like half a fetch land, and never as Ramp.
- `land-ramp` on Annex: "You control enchanted land." It never enters; 43 setup-tagged cards carry `control-changing-effects`.
- `landfall` on Polluted Bonds ("a land an opponent controls enters"), Staff of the Wild Magus ("Forest you control enters, you gain 1 life"), and Hedron Crab, whose "target player mills three cards" pays off Mill. The `landfall-other` tag marks triggers on other players' lands or any player's: 29 live payoffs carry it, Polluted Bonds and Ankh of Mishra ("Whenever a land enters") among them.

### 6. Both jobs

Ask what the card does with no other setup. If it still makes lands enter, it is setup: Burgeoning, "Whenever an opponent plays a land, you may put a land card from your hand onto the battlefield"; Khalni Heart Expedition, whose quest ends "Search your library for up to two basic land cards, put them onto the battlefield tapped" (slow land ramp, weight 1). If it only rewards lands, it is a payoff: Lotus Cobra. Count once.

### 7. Enough

By turn 5 a deck has seen 11 cards on the play and 12 on the draw (7 plus 4 or 5 draws). In multiplayer Commander nobody skips the first draw (rule 103.8c), so 12. That is about a fifth of 60 cards, 30% of 40, and 12% of 100.

| Size | Lands (fetch or bounce) | Nonland setup | Payoffs (lasting) |
| ---- | ----------------------- | ------------- | ----------------- |
| 60   | 25 to 27 (2 to 4)       | 3 to 6        | 8 to 12 (2+)      |
| 40   | 17 to 18 (1 to 2)       | 2 to 4        | 5 to 8 (1+)       |
| 20   | 8 to 9 (0 to 1)         | 1 to 3        | 5 to 7 (1+)       |
| 100  | 38 to 42 (4 to 8)       | 10 to 15      | 13 to 17 (4+)     |

- **Payoffs set the bar**, since land drops feed them. 8 in 60 shows one by turn 5 in 82% to 85% of games; 5 in 40 gives the same, and 13 in 100 gives 80% to 83%. The 60-card landfall precons hold 7 to 14 by the section 9 hint (Savage Lands 7, the Zendikar duel deck 8, Zendikar's Rage 14).
- **A packet carries its theme alone.** Any two packets shuffle into a 40-card deck, often with a packet of another theme. So a packet needs the 40-card payoff count by itself: 5 payoffs in 40 cards show one by turn 5 in 82% to 85% of games, 3 only in 63% to 67%. The six Landfall Jumpstart packets hold 5 to 8.
- **Setup multiplies.** Count fetch and bounce lands with it: 6 to 10 in all at 60 shows one or two by turn 5, so a turn or two triggers twice. The 60-card landfall precons hold 7 to 9 in all (Zendikar's Rage 4 lands and 3 spells, the Zendikar duel deck 2 and 5, Savage Lands 4 and 5).
- **Repeatable setup is welcome, not required.** No 60-card landfall precon or Landfall Jumpstart packet in the corpus runs one (one packet has Ancient Greenwarden, but with a single fetch land), and the Commander lands precons run 1 to 4.
- **Lasting payoffs** keep the plan alive when the board stalls, since pumps pay only on attacks. The 60-card precons hold 1 to 5. A pool with none builds a landfall aggro deck instead: low curve and 16 or more creatures.
- **Lands.** Each land is a trigger, so landfall runs a land or two above the usual: the 60-card landfall precons run 26 to 27, the Commander lands precons 37 to 44 (most 40 to 44), and the Jumpstart packets 8 to 9.
- **Commander.** The 100 row assumes no payoff commander. Setup there: the lands precons run 10 to 20 nonland setup. EDHREC's landfall page lists about 15 land makers, 6 fetch or bounce lands, and 14.1 payoffs per deck, all lower bounds. A payoff commander (Tatyova, Benthic Druid: "gain 1 life and draw a card") frees 3 or 4 payoff slots for setup; an extra-drop commander (Azusa, Lost but Seeking) replaces repeatable setup.

Add 4 to 6 removal at 60 and creatures to carry counters.

### 8. Where the live matchers differ

- Lands never count: `countCopies` (`scan.ts`) counts spells only, and `lands.ts` picks fetch lands for color.
- Enabler #1 (`anyTags tutor-land-to-battlefield|extra-land|land-ramp`) takes donate, theft, and land destruction. It misses all 12 bounce lands (untagged) and 31 of 48 sacrifice-to-fetch lands (Bant Panorama). Walking Atlas weighs the same as Rampant Growth.
- Payoff #1 (`anyTags landfall`) takes the 29 `landfall-other` cards, five Staffs, and three Gate cards. A pump weighs the same as a token engine.
- 25 `landfall` cards also meet the enabler and count twice.

### 9. Matcher hints

- Setup tags (nonland): `tutor-land-to-battlefield`, `sneak-land`, `play-additional-land`, `multi-land-ramp`, `reanimate-land`, `crucible-of-worlds`, minus `donate-rampant-growth`, `control-changing-effects`, and text `[Ii]ts controller (may search|searches)|their controller may search` (the land goes to the target's controller). That gives 439 cards. Do not drop all `removal-land`: Frenzied Tilling ("Destroy target land. Search your library for a basic land card, put that card onto the battlefield tapped") is real setup. A swap, `[Dd]estroy target land\. Its controller may search`, is setup at 0.5 (Cleansing Wildfire, Geomancer's Gambit, Sandworm, Avengers Disassembled).
- Lands: `Sacrifice this land: Search your library for [^.]*onto the battlefield`; `return a land you control to its owner's hand`.
- Repeatable: `\{T\}[^:]*: (You may )?put a land card from your hand onto the battlefield|additional lands? on each of your turns|play lands from your graveyard` (39 nonland cards; the last part counts only with 3 or more fetch lands). One-shot: `additional land this turn`.
- Payoff: `Whenever (a land|an? (Forest|Island|Mountain|Plains|Swamp)|this land or another land) you control enters`, or a threshold, `[Ii]f you had a land enter|a land entered the battlefield under your control this turn`, minus the tag `landfall-other`. That matches 228 cards (223 nonland), Battlewand Oak, Valakut, the Molten Pinnacle, Field of the Dead, Searing Blaze, and Wandering Troubadour among them. Of the 288 live payoffs it drops the 29 `landfall-other` cards and 31 more, nearly all rightly: five Staffs, three Gate cards, seven "Whenever you play a land or cast a spell" or "play a card" triggers, and cards that play lands from exile or the graveyard.
- Payoff weight, checked in this order on the trigger sentence (with its modes after "choose one"). Over the 228 matches it gives 95 cards at 1, 90 at 0.5, 16 at 0.25, 4 at 0, and 23 that count as setup.
  - a setup card by the tags above, or `quest counter`: setup, not payoff (Khalni Heart Expedition, Aesi, Tyrant of Gyre Strait);
  - `mills?`: 0, a Mill card (Hedron Crab);
  - a threshold with no trigger: 0.25 (Searing Blaze);
  - `gains? [a-z, ]+ until end of turn` with no `\+\d+/\+\d+`: 0.25 (Fledgling Griffin);
  - `create|counters? on|gain \d+ life|draws?|investigate|\{E\}|exile target|each opponent|damage to`: 1 (Zendikar's Roil, Felidar Retreat, Valakut);
  - anything else: 0.5, such as pumps (Steppe Lynx), mana (Lotus Cobra), and self-recursion (Bloodghast).

## Mill (mill)

### 1. The plan

"I mill the opponent every turn, hold off their creatures, and they lose when they cannot draw."

### 2. What it builds up and spends

Cards gone from the opponent's library; the unit is cards milled per use, per turn for engines. Drawing from an empty library loses (704.5b). After the opening hand the library holds 53 cards at 60, 33 at 40, and about 92 per opponent at 100, minus a draw a turn.

### 3. Setup jobs

- **Repeatable engine** (2 at two or more a turn, 1 at one). Hedron Crab: "Whenever a land you control enters, target player mills three cards." Millstone: "{2}, {T}: Target player mills two cards." Also Ruin Crab, Curse of the Bloody Tome, and Consuming Aberration (section 6); one a turn: Codex Shredder, Jace's Erasure.
- **Fed engine** (1; it needs other cards of a type to enter). Sage's Row Denizen: "Whenever another blue creature you control enters, target player mills two cards."
- **Draw-trigger engine** (2, only with card draw). Psychic Corrosion: "Whenever you draw a card, each opponent mills two cards."
- **Big one-shot** (1 at four or more). Tome Scour: "Target player mills five cards." Mind Sculpt: "Target opponent mills seven cards."
- **Small one-shot** (0.5). Thought Scour: "Target player mills two cards."

### 4. Payoff jobs

Mill wins without payoffs; they speed it up or add a threat.

- **Opponent graveyard size** (eight to ten cards there, mid game with three engines). Jace's Phantasm: "+4/+4 as long as an opponent has ten or more cards in their graveyard." Mind Carver, Drown in the Loch.
- **Multipliers** (2, they double setup). Bruvac the Grandiloquent: "they mill twice that many cards instead." Fraying Sanity.
- **A threat that grows.** Wight of Precinct Six: "This creature gets +1/+1 for each creature card in your opponents' graveyards." Nighthawk Scavenger. Neither has `synergy-mill`, so the live Mill matcher misses both. Consuming Aberration grows too, but counts as setup (section 6).

### 5. False friends

- `synergy-mill` for your own library (27 of 91): Laboratory Maniac ("If you would draw a card while your library has no cards in it, you win the game instead."), Crawling Sensation, Narcomoeba.
- `mill-exile` (118 of 434 `mill-opponent` cards): Benthic Infiltrator ("that player exiles the top card of their library"). Counts toward decking, not graveyard payoffs.
- Riders: Didn't Say Please (counter; "Its controller mills three cards."), Winds of Rebuke (bounce; "Each player mills two cards."). Ghoulcaller's Bell ("{T}: Each player mills a card.") mills you too.
- `repeatable-crime` is not a mill tag. It marks a card that can target an opponent again and again: Millstone, Hedron Crab, Codex Shredder, Jace's Erasure, Cathartic Adept, and Phenax have it; Tome Scour does not. On instants and sorceries it marks recastable cards such as Deep Analysis and Ancient Grudge, both with flashback. It sits on 134 `mill-opponent` permanents, of which 77 pass the repeat test, and 59 permanents that pass the test lack it (Ruin Crab, which mills each opponent and targets no one, and Curse of the Bloody Tome). Use the repeat test, not this tag, in either direction.

All of these were checked with the helper.

### 6. Both jobs

Count once. A card that mills two or more every turn on its own is setup, whatever else it does: Consuming Aberration ("Whenever you cast a spell, each opponent reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard", about 2.5 cards a spell) is an engine whose size is a bonus. Otherwise it is a payoff: Vantress Gargoyle ("{T}: Each player mills a card.") is a flier waiting for seven cards; Thieves' Guild Enforcer mills two only when it or another Rogue enters, and its "+2/+1 and has deathtouch" needs eight cards there; Fraying Sanity's X counts only what other cards put in.

### 7. Enough for a decent bulk deck

All columns count copies; Engines are part of Mill cards.

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

### 8. Where the live matchers differ

- Enabler `mill-opponent` (434): no amount or repeat check. 99 mill one or two, 118 exile, 233 also carry `mill-self` and count for Graveyard. Twelve copies that mill two once meet the 60 minimum while milling 24.
- Payoff `synergy-mill` (91): 27 reward only your own library or graveyard. 28 also count as enablers, so they count twice; section 6 settles each once (Consuming Aberration setup, Vantress Gargoyle and Fraying Sanity payoffs). Threats that count opponents' graveyards without `synergy-mill` (Wight of Precinct Six, Nighthawk Scavenger) are missed. Sidisi counts as a mill payoff though it mills itself.
- Minimums: 1 payoff is fine, but the setup bar belongs on milled cards per turn, not a count of 12.

### 9. Matcher hints

- Repeat test: as for Graveyard, without `discard`, plus `(whenever|at the beginning of)[^.\n]*into their graveyard` for reveal-until-a-land engines (Consuming Aberration, Thief of Sanity). With `mill-opponent` on a permanent it passes 139 cards.
- Engine, 2 at two or more a use, 1 at one: a passing permanent whose trigger runs on its own: `\{T\}`, `\}: `, `at the beginning of`, landfall (`whenever a land you control enters`), `whenever you (draw|cast)`.
- Fed engine, 1: `whenever (this creature or )?another [^.]* enters`, attack and combat-damage triggers (34 of the passing permanents). One that also meets the payoff hint is a payoff (Thieves' Guild Enforcer).
- One-shot: an instant or sorcery, or a `when this creature enters` or `dies` trigger; weight by amount.
- Amount: `mills? (a|one|two|three|four|five|six|seven|eight|nine|ten) cards?`; X or half count about 5, until a land about 2.5 (40% lands).
- Exclude: `mill-exile` for graveyard payoffs; `synergy-mill` cards whose text matches `your (library|graveyard)` and not `opponent|defending player|that player|target player|its controller|each player|their|chosen player|a library|a graveyard|all graveyards|a single graveyard` (27, such as Laboratory Maniac). Do not use `repeatable-crime` (section 5).
- Payoff: `synergy-mill` minus that exclusion (64 of 91, including Jace's Phantasm, Mind Carver, Drown in the Loch, Bruvac, Fraying Sanity, Consuming Aberration, and Thieves' Guild Enforcer); `cards-in-graveyard-matter` whose only graveyard words are `opponents'`, `an opponent has`, `its controller's graveyard`, or `defending player has` (Wight of Precinct Six, Nighthawk Scavenger). The earlier `(an opponent|target opponent|defending player)[^.]*graveyard` matched only 25 of 91 and missed Drown in the Loch, Fraying Sanity, and Consuming Aberration.
- Multiplier, 2: `twice that many|that many cards plus|mills? x cards, where x is the number of cards put into` within `synergy-mill` (Bruvac, Fraying Sanity, The Water Crystal).

## Enchantments (enchantments)

### 1. Plan

Play cheap enchantments that do a job on their own (removal Auras, enchantment creatures, Sagas) and let enchantress and constellation cards draw or drain off each one.

### 2. Resource

Enchantments cast (enchantress), entering (constellation, eerie), on the battlefield (count), and leaving (Sagas). Unit: one enchantment cast or entering. An Aura on an opponent's creature is still yours (rule 303.4e). Tokens are created, not cast (111.1), so Role and Glimmer tokens feed constellation and count payoffs, not enchantress.

### 3. Setup jobs

Every enchantment is a unit, so pick ones with a job of their own. Weight 1, 0.5 at 5 mana or more.

- **Removal.** Pacifism (common): "Enchanted creature can't attack or block." Journey to Nowhere (common): "exile target creature."
- **Creatures and Sagas.** Nyxborn Eidolon (common): a 2/1 for {1}{B} with "Bestow {4}{B}". Elspeth's Nightmare (uncommon): a {2}{B} Saga whose first chapter reads "Destroy target creature an opponent controls with power 2 or less." Sagas are sacrificed after their last chapter (704.5s): fine for enters payoffs, poor for count.
- **Token makers**, weight 1, or 2 when repeatable. Glimmerburst (common): "Draw two cards. Create a 1/1 white Glimmer enchantment creature token." God-Favored General (uncommon): "create two 1/1 white Soldier enchantment creature tokens" each time it untaps, for {2}{W}. They feed enters and count payoffs only.

### 4. Payoff jobs

- **Enchantress**, enchantment spells only. Mesa Enchantress (uncommon): "Whenever you cast an enchantment spell, you may draw a card." Generous Visitor (uncommon) adds a +1/+1 counter instead.
- **Constellation and eerie**, one entering most turns. Grim Guardian (common): "each opponent loses 1 life." Setessan Skirmisher (common) gets +1/+1.
- **Count**, three that stay. Ethereal Armor (common): "+1/+1 for each enchantment you control".
- **Leaving**, Sagas or sacrifice. Ashiok's Reaper (uncommon): "Whenever an enchantment you control is put into a graveyard from the battlefield, draw a card."
- **Cost reducers**, half a payoff, the same rule as in Artifacts. Jukai Naturalist (uncommon): "Enchantment spells you cast cost {1} less to cast."

### 5. False friends

`synergy-enchantment` alone carries 140 of 154 bulk payoffs. Checked with the helper:

- Commune with the Gods puts "a creature or enchantment card" into your hand: card selection.
- Cleansing Meditation: "Destroy all enchantments." Anti-synergy.
- Godhunter Octopus attacks only if "defending player controls an enchantment".
- Candy Grapple: bargain takes any token.
- Taken by Nightmares ("If you control an enchantment, scry 2.") and Lagonna-Band Elder: one-enchantment riders, half a payoff at most.
- Southern Air Temple counts Shrines, yet carries `enchantmentfall`.
- `synergy-enchantment-creature` alone carries 10 more. Nyx Infusion (common): "Enchanted creature gets +2/+2 as long as it's an enchantment. Otherwise, it gets -2/-2." Extinguish All Hope: "Destroy all nonenchantment creatures."

### 6. Both jobs

Count once, as payoff when the reward fires per enchantment (Grim Guardian, Ethereal Armor). Cost reducers such as Jukai Naturalist are half a payoff, as Etherium Sculptor is for Artifacts: the reward is mana for each enchantment spell, which needs setup but draws, drains, and grows nothing. Like any payoff that is an enchantment, it still counts toward the enchantments on the table in part 7. Riptide Chimera ("return an enchantment you control to its owner's hand" each upkeep) is a drawback unless the deck has enters effects worth repeating.

### 7. Enough for a decent bulk deck

Copies of every enchantment card (payoffs included) plus enchantment token makers.

| Size | Enchantments (mana value 3 or less) | Payoffs  | Also                             |
| ---- | ----------------------------------- | -------- | -------------------------------- |
| 60   | 14 to 18 (9+)                       | 6 to 8   | 2 to 4 other removal, evasion    |
| 40   | 9 to 12 (6+)                        | 4 to 5   | 1 to 3 other removal             |
| 20   | 6 to 8 (4+)                         | 3 to 4   | enters or cast payoffs, no count |
| 100  | 30 to 40 (15+)                      | 10 to 14 | several draw engines             |

About two to three enchantments per payoff. Count payoffs need three on the table: 18 in 60 give 78% to have seen three by turn 5, 12 in 40 give 79%, 30 in 99 give 77%. Enchantress and constellation want one more enchantment most turns after they land: 14 in 60 show one in the first 12 cards in 97% of games and average 2.8. So count payoffs want the top of the range, and a deck of enters and cast payoffs works from the bottom. A packet's 7 enchantments show one in 94% of paired 40-card games but three in only 35%: enters or cast payoffs, no count. Payoffs follow the shared standard: 6 in 60 (75%), 4 in 40 (78%), 3 or 4 in a packet (67% to 78%), 10 in 99 (74%). Removal Auras and enchantment creatures double as interaction and curve. A payoff commander lets other payoffs drop to 6 to 8.

Type caps: the live caps on noncreature permanents (about 11 at 60, 6 at 40, 3 at 20, 25 at 100) collide with these counts. Only about 7% of mono-color bulk enchantments are creatures (W 33 of 483, U 25 of 449, B 25 of 364, R 20 of 306, G 27 of 345; `node data/review/scratch/g3chk/enccap.ts`), and 39 bulk cards make enchantment tokens. Under the live caps:

- 60: 14 fits, as 11 noncreature enchantments plus 3 enchantment creatures or token makers.
- 40: 9 needs 3 enchantment creatures or token makers beside the 6 noncreature enchantments the cap allows.
- 20: 6 needs 3 beside a cap of 3, while real Enchanted packets run 4 to 6 noncreature enchantments in 12 spells.
- 100: 25 fits; both Commander decks below run 25 noncreature enchantments, at the cap.

A prototype that builds this style should raise the cap for it to about 0.5 of spell slots at 40 and 20, as real packets do, or count removal Auras as removal rather than as permanents. With the live caps, offer Enchantments at 40 and 20 only when the pool has the enchantment creatures and token makers to fill the gap. The cap is in `config/`, so changing it is the owner's call; record it in the report.

Evidence, copies under the part 9 hints (`g3fix/decks-enchantments.txt`):

- Commander "Enduring Enchantments": 42 enchantments (25 noncreature, 20 at 3 or less); 19 payoff cards, 18.5 with its cost reducer at half.
- Commander "Adaptive Enchantment", under Estrid, the Masked: 32 enchantments (25 noncreature); 11 payoffs.
- Jumpstart "Enchanted" packets: 6 to 10 enchantments and token makers, 4 to 6 of them noncreature; 1 to 3 payoffs. "Constellation 1" and "2": 7 and 9, with 6.5 and 4.5 payoffs.
- No 60-card precon in the corpus builds around enchantment payoffs.
- Learned 40-card enchantments plans (885 draft decks): a median 9 live enablers and 4 live payoffs. The live payoffs include the `synergy-enchantment` cards part 8 rejects.
- EDHREC's enchantress page has Sanctum Weaver (66%), Eidolon of Blossoms (57%), and Enchantress's Presence (55%): real decks stack draw engines.

### 8. Where the live matchers differ

- Enabler #1 `types enchantment` is the right resource with no weight: 2,092 bulk cards (10.4%).
- Missed setup: about 39 bulk Role and enchantment token makers (Glimmerburst, Charmed Clothier's "Royal Role token", God-Favored General); `repeatable-enchantment-tokens` is not in the clause. The helper shows Glimmerburst and Charmed Clothier as "enabler: none".
- Payoff #1: 79 of 154 bulk payoffs (51%) pass a strict rule; the rest come through `synergy-enchantment` (140 alone) and `synergy-enchantment-creature` (10 alone).
- Both: 44 bulk enchantments carry a payoff tag, and only 22 are real per-enchantment payoffs under the part 9 hints (Ethereal Armor, Grim Guardian, the constellation creatures, Sphere of Safety). The other 22: 5 Shrines (The Spirit Oasis among them); 4 cost reducers (Jukai Naturalist, Inquisitive Glimmer, Transcendent Envoy, Ballad of the Black Flag); 3 enchantment removal cards (Quiet Disrepair, Arenson's Aura, Teferi's Care); 3 protection or tutor cards (Callaphe, Beloved of the Sea; Alseid of Life's Bounty; Sterling Grove); 4 that care only about enchantment creatures or enchanted creatures (Nyx Herald, Nyx Infusion, Armament of Nyx, Bearer of Memory); 2 that bounce your own enchantment each upkeep (Riptide Chimera, Shimmerwing Chimera); and Vessel of Nascency, card selection.
- Cast and enters payoffs are not told apart. The live matchers count no Role or Glimmer token makers at all, so tokens fed to Mesa Enchantress are a risk only once the part 9 hints add token makers. Part 9 ties them to enters and count payoffs.

### 9. Matcher hints

Patterns run as in Lifegain: reminder text removed, flags `im`.

- Setup: type Enchantment, weight 1, 0.5 at mana value 5 or more; text `create [^.]*\b(role|enchantment[^.]*) tokens?`, weight 1, or 2 with `repeatable-enchantment-tokens`, half on instants and sorceries and at mana value 5 or more.
- Token makers feed enters and count payoffs, not enchantress. When cast payoffs are most of the deck's payoffs, count only enchantment cards toward the floor.
- Payoffs, weight 1. Cast: `whenever you cast an enchantment spell`. Enters: `constellation|eerie|whenever (an|another|one or more) [^.]*enchantments? you control enters?`. Count: `ethereal-armor`, `affinity-for-enchantments`, text `for each (other )?enchantment|number of enchantments you control`. Leaving: `enchantment you control is put into a graveyard`.
- Half payoff, weight 0.5: `cost-reducer-enchantment`; text `if you control an enchantment|as long as you control an enchantment` on a card that is not an enchantment.
- Exclude: `hate-enchantment`, `removal-enchantment`, and `synergy-shrine`, whatever else matches. `synergy-enchantment`, `synergy-enchantment-creature`, `enchantment-engine`, `enchantmentfall`, `impulse-enchantment`, and keyword Bargain admit a card only when a tag or pattern above also matches. The text patterns catch every card that carries `enchantmentfall` or `enchantment-engine` except the Shrines and Tanglespan Lookout, which cares about Auras only (`g3fix/entags.txt`).

Bulk under these hints (`g3fix/bulk.txt`): 2,066 enchantments as setup, 39 token makers, 81 payoffs (6 cast, 39 enters, 12 count, 6 leaving, plus 10 cost reducers and 8 one-enchantment conditions at half).

## Ramp (bigCreatures)

### 1. Plan

Play mana creatures, rocks, and land ramp on turns 1 to 3, then cast six- and seven-mana threats or a big X spell a turn or two early.

### 2. Resource

Mana beyond the land count. A lasting source gives +1 mana every turn; a ritual, Treasure, or sacrifice-for-mana gives +1 to +3 once. One lasting source by turn 3 casts a five-drop on turn 4 and a six-drop on turn 5. A six-drop on turn 4 needs two by turn 3, which most decks miss (section 7).

### 3. Setup jobs

Here repeatable means lasting.

- **Mana creatures** (lasting, weight 1, fragile). Llanowar Elves, Elvish Mystic: "{T}: Add {G}."
- **Mana rocks** (lasting, weight 1). Mind Stone: "{T}: Add {C}." Arcane Signet adds mana only "in your commander's color identity" (rule 903.4f); the builder already drops it below 100.
- **Land ramp** (lasting, weight 1 per land). Rampant Growth; Cultivate, "put one onto the battlefield tapped and the other into your hand"; Wayfarer's Bauble. Explosive Vegetation ("up to two basic land cards, put them onto the battlefield tapped") is setup at 4 mana when the top end is 6+.
- **Cost reducers and cheats** (lasting, weight 0.5 to 1; few exist). Centaur Omenreader: "As long as this creature is tapped, creature spells you cast cost {2} less to cast." Rhonas's Monument: "Green creature spells you cast cost {1} less to cast." Elvish Piper: "{G}, {T}: You may put a creature card from your hand onto the battlefield." The pack has 26 cards whose text makes creature spells cost less (13 common or uncommon) and 28 that put a creature card from hand onto the battlefield (3 common or uncommon).
- **Bursts** (one-shot, 0.25 to 0.5). Dark Ritual: "Add {B}{B}{B}." Blood Pet: "Sacrifice this creature: Add {B}." Big Score: "create two Treasure tokens".
- **Land to hand** (support, 0.25). Civic Wayfinder; Krosan Tusker's cycling.

### 4. Payoff jobs

Each wants about +2 mana by turn 4.

- **Big creatures at 6+** (weight 1). Colossal Dreadmaw: 6/6 "Trample". Pelakka Wurm: 7/7 trample, "you gain 7 life". Ulamog's Crusher: "Annihilator 2".
- **Evasive five-drops** (weight 0.75). Serra Angel, Air Elemental: 4/4 "Flying".
- **X spells and X creatures** (weight 1, also reach). Blaze: "deals X damage to any target". Fireball. Feral Hydra: "enters with X +1/+1 counters". Count them when the pool has them, but do not require them: of eight 60-card ramp and big-creature precons checked (Wicked Big, Stomp, Stomp, Massive Might, Mono Green Amazon, Green, Beasts, Dino Might, Stampede of Beasts), only Stampede of Beasts (2) and Massive Might (1) run any.

### 5. False friends

- The derived `finisher` takes 4-mana 4/4s such as Rumbling Baloth (no text): curve filler, not a ramp payoff. 1,207 creatures qualify at mana value 4.
- Bodies that cannot attack: Carnivorous Plant ("Defender", 4/5), Dark Maze, Deep-Sea Serpent ("can't attack unless defending player controls an Island"). 99 finishers say Defender or can't attack.
- `mana-dork-egg` counts as lasting: Blood Pet, Generator Servant ("{T}, Sacrifice this creature: Add {C}{C}").
- `restricted-mana` needs a text check: Elfhame Druid also has a plain "{T}: Add {G}." and is real.

### 6. Both jobs

A creature that ramps is setup at 3 mana or less and a payoff at 5 or more. Wood Elves (3 mana): "search your library for a Forest card, put that card onto the battlefield". Silverglade Elemental, a 4/4 for 5 with the same text on entering, is a payoff: its Forest comes too late to set anything up. A 4-mana ramp spell is setup when the payoffs cost 6+. Count once.

### 7. Enough

By turn 3 a 60-card deck has seen 9 or 10 cards. With 8 lasting sources it has one by then in 75% to 79% of games, enough for a five-drop on turn 4 or a six-drop on turn 5. Two sources by turn 3, for a six-drop on turn 4, come in only 34% to 40% of games. With 6 sources the odds are 64% to 68% for one and 22% to 26% for two. Plan on jumping one turn, not two.

| Size | Lands    | Lasting setup | Payoffs            |
| ---- | -------- | ------------- | ------------------ |
| 60   | 22 to 24 | 6 to 10       | 6 to 10 (3+ at 6+) |
| 40   | 16 to 17 | 4 to 6        | 4 to 6             |
| 20   | 7 to 8   | 2 to 3        | 2 to 3             |
| 100  | 36 to 38 | 10 to 16      | 12 to 20           |

About one setup per payoff, nearly all lasting. The floor of 6 at 60 is what the stronger ramp precons run: Wicked Big 6, Stomp, Stomp 6, Massive Might 8. Most big-creature precons run 3 to 5 (Green Game Night 4, Beasts 3, Dino Might 3). Those play as midrange with big creatures, which is decent but not Ramp. Their payoffs fit the table: 6 to 10, with 4 to 7 at 6+. At 100, Commander precons built on big creatures hold 5 to 13 lasting sources by the section 9 hint (Eldrazi Unbound 12, Multiverse Reforged 13), and 10 sources show one by turn 3 in about two games in three.

Add 4 to 6 removal or real blockers for turns 2 to 4, and card draw at 100. EDHREC's ramp, big-mana, and stompy pages list mana creatures, rocks, and land ramp at about 9 to 11 per deck; Ghalta, Primal Hunger decks list about 10 cheap ramp pieces and 8 big creatures. A big-creature commander is an always-available payoff: cut 2 or 3 payoffs. A mana commander is one lasting source: cut 2 setup.

### 8. Where the live matchers differ

- Enabler #1 (`derived cheapManaSource`, `manaSourceKind` in `matchers.ts`) counts sacrifice-for-mana and restricted mana as lasting, and its mana value cap of 3 drops Explosive Vegetation.
- It also counts land swaps as land ramp. Cleansing Wildfire and Geomancer's Gambit ("Destroy target land. Its controller may search ...") print "mana source (landRamp)" and meet enabler #1. On your own land they trade a land for a land; on the opponent's they give the land away.
- Payoff #1 (`derived finisher`) is met by about 5,000 nonland cards, 4-mana 4/4s and defenders included, so any pool looks like Ramp. It misses X spells and X creatures (power 0).
- No duals.

### 9. Matcher hints

- Lasting (nonland, mana value 4 or less): tags `mana-dork`, `mana-rock`, `tutor-land-to-battlefield`. Exclude `mana-dork-egg`, `ritual`, `donate-*`, and text `[Ii]ts controller (may search|searches)|their controller may search`, which drops land swaps such as Cleansing Wildfire. Keep other `removal-land` cards: Mwonvuli Acid-Moss searches your own library, and Unstable Obelisk is a rock ("{T}: Add {C}.") with a removal mode. That gives 911 cards. Treat `restricted-mana` as restricted only when every `Add` is followed by `Spend this mana only`.
- Text, lasting (nonland, `m`): `^(?![^:\n]*Sacrifice)[^:\n]*\{T\}[^:\n]*: Add`, a line whose cost has {T} and no Sacrifice. It keeps Mind Stone, Banners, Cluestones, and Lockets, which sacrifice only to draw, and drops Generator Servant. 723 cards. Burst (nonland, `m`): `Sacrifice this [^:]*: Add|^Add \{|create[^.]*Treasure`, 410 cards.
- Cost reducers and cheats: `[Cc]reature spells you cast cost \{\d\} less` (26); `put an? (creature|permanent) card from your hand onto the battlefield` (28).
- Payoff: a creature at mana value 5+ with power 5+, or power 4+ with Flying, Trample, or an enters trigger. Weight 1 at 6+, 0.75 at 5. Mana value 4 and less is not a payoff (section 5). Exclude only the card's own limits: the keyword Defender, or `This creature can't attack( unless| alone|\.| or block)`. So Stormtide Leviathan ("Creatures without flying or islandwalk can't attack") stays. That matches 2,519 creatures, 1,662 at 6+ and 857 at 5; card strength picks among them.
- X: mana cost has `{X}` and text matches `X damage|X \+1/\+1 counters|draws? X|create X`.

## Tappers (tappers)

### 1. Plan

Tap the opponent's blockers each turn with cheap tappers and attack past them, finishing with tap-trigger engines or removal that kills tapped creatures.

### 2. Resource

Opposing creatures tapped when it matters: before your attack or on their turn. Unit: one tap of an untapped opposing creature; a freeze ("doesn't untap", stun counter) counts about 1.5.

### 3. Setup jobs

- **Repeatable tappers** (weight 2). Gideon's Lawkeeper, Goldmeadow Harrier, Blinding Mage: "{W}, {T}: Tap target creature." Ballynock Trapper: "{T}: Tap target creature."
- **Enters tappers** (one-shot with a body, weight 1). Frost Lynx: "tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step." Chillbringer.
- **Tap spells** (one-shot). Single, 0.5: Blustersquall, "Tap target creature you don't control." Several, 1 to 2: Frost Breath, "Tap up to two target creatures"; Sleep, "Tap all creatures target player controls", often the winning turn.

### 4. Payoff jobs

- **Tap-trigger engines** (weight 1; want a tap every turn). Hylda of the Icy Crown: "Whenever you tap an untapped creature an opponent controls, you may pay {1}". Sharae of Numbing Depths: "Whenever you tap one or more untapped creatures your opponents control, draw a card." Verity Circle: "Whenever a creature an opponent controls becomes tapped, if it isn't being declared as an attacker, you may draw a card." Eight cards carry such a trigger. Icewrought Sentry taps on its own and counts as setup (section 6), which leaves 7, 3 of them uncommon (Palliation Accord, Sharae, Solitary Sanctuary).
- **Tapped-only removal** (0.5; removal first). Assassinate: "Destroy target tapped creature." Iron Verdict: "5 damage to target tapped creature". Luminous Rebuke: "costs {3} less to cast if it targets a tapped creature". They hit attackers anyway; a tapper makes them main-phase removal.
- **Tapped-creature counts and bounce** (0.5). Theft of Dreams: "Draw a card for each tapped creature target opponent controls." Galestrike: "Return target tapped creature to its owner's hand. Draw a card." Surrakar Banisher does the same bounce on entering. 11 cards, 8 common or uncommon. Hylda's Crown of Winter's sacrifice ability counts tapped creatures too, but the Crown is setup (section 6).
- **Attackers.** The usual reward in bulk: flyers and power 3+. Not tagged.

### 5. False friends

- Lock Auras tagged `tapper-creature` are removal: Claustrophobia ("doesn't untap during its controller's untap step"), Narcolepsy ("At the beginning of each upkeep, if enchanted creature is untapped, tap it."). 72 tapper cards carry `lockdown-creature`, but Narcolepsy and 11 other tapper-tagged lock Auras do not, so the lock rule in section 9 reads the text.
- Narrow tappers: Kitsune Diviner ("{T}: Tap target Spirit."), Ali Baba (Walls), Rimewind Taskmage ("four or more snow permanents"), Kelpie Guide ("eight or more lands").
- Riders: Stabbing Pain ("-1/-1 ... Tap that creature."), Niveous Wisps, Due Respect ("Permanents enter tapped this turn.").
- `synergy-tapped` rewards your own tapped creatures: Frontline War-Rager ("if you control two or more tapped creatures"), Spider-Man, Web-Slinger.
- `hate-tapped` on lands: Mana Geyser ("for each tapped land your opponents control"), Branded Brawlers.

### 6. Both jobs

If the card's own tap is repeatable and its reward small, it is setup. Hylda's Crown of Winter: "{1}, {T}: Tap target creature"; its sacrifice to draw works once. Icewrought Sentry: on each attack it may pay {1}{U} to "tap target creature an opponent controls", and its reward is "+2/+1 until end of turn". If it taps once on entering and then rewards every tap, it is a payoff: Sharae of Numbing Depths, Solitary Sanctuary. Verity Circle is a payoff; its own tap costs {4}{U}. Count once.

### 7. Enough

With five repeatable tappers in 60 cards, a deck finds one by turn 4 about two games in three.

| Size | Tap sources (repeatable) | Payoffs | Creatures |
| ---- | ------------------------ | ------- | --------- |
| 60   | 8 to 10 (4 to 6)         | 2 to 4  | 14 to 18  |
| 40   | 5 to 7 (3+)              | 1 to 3  | 13 to 16  |
| 20   | 3 to 4 (2)               | 1 to 2  | 7 to 9    |
| 100  | 15 to 20 (8+)            | 4 to 8  | 25 to 30  |

Setup to payoff 3 to 1 or more, since engines need a tap every turn. With no engines in the pool, the deck is White-Blue tempo: tappers, flyers, tapped-only removal, and 3 or more other removal. Hylda decks on EDHREC list about 25 tap cards and 7 payoffs. A payoff commander like Hylda needs only 3 to 5 payoffs in the 99; a tapper commander is one repeatable source always, so add payoffs.

### 8. Where the live matchers differ

- Enabler #1 (`anyTags tapper-creature|freeze-creature`, 703 cards) counts lock Auras, narrow tappers, and riders like a repeatable tapper. 319 carry `repeatable-crime`.
- Payoff #1 (`anyTags hate-tapped|synergy-tapped`, 204 cards): 111 are removal, 46 reward your own tapped creatures, a few are about lands.
- At least 20 cards meet both (Sharae, Solitary Sanctuary, Icewrought Sentry, Verity Circle, Hylda's Crown of Winter).
- Six tap spells and two Assassinates meet the 60-card minimums (6, 2). Attackers are not counted.

### 9. Matcher hints

- Lock is removal, and it is checked first: an Aura (`^Enchant (creature|permanent)`, `m`) whose text has `Enchanted (creature|permanent) doesn't untap|can't become untapped|[Tt]ap enchanted (creature|permanent)|if enchanted creature is untapped, tap it`. 78 cards, Narcolepsy among them. A lock is never a tapper. An Aura that gives your creature a tap ability (Grasp of the Hieromancer) or taps a target on entering (Glaring Aegis) is not a lock.
- Repeatable: `\{T\}[^:]*: Tap target (creature|nonland permanent|permanent)\.`; `tapper-creature` with `repeatable-crime`, minus `lockdown-creature` and `hate-typal`.
- One-shot: `When [^.]* enters, (you may )?tap (or untap )?(it and )?(up to \w+ |X )?target[^.]*(creature|permanent)|When [^.]* enters, tap all [^.]*creatures`, 75 cards after the lock rule (Frost Lynx, Pestermite, Dragon Turtle, Glaring Aegis). Self-taps (Gitaxian Anatomist) and land taps (Gulf Squid, Guild Summit) no longer match. Spells (instant or sorcery): `[Tt]ap (target|up to \w+ target|all) creatures?` minus `creatures? you control`, 122 cards (Blustersquall, Frost Breath, Sleep). The `[Tt]` keeps the pattern case-sensitive, which the Narrow hint needs.
- Freeze, 1.5, only on a card already counted as a tapper above: `(doesn't|don't) untap during (its|their) controllers?'s? next untap|(doesn't|don't) untap during that player's next untap|stun counters?`. Frost Breath ("their controller's next untap step"), Sleep ("that player's next untap step"), and Dragon Turtle match.
- Narrow: `Tap target [A-Z][a-z]+\.` naming a creature type; `Activate only if you control`.
- Engines: `Whenever you tap (an|one or more) untapped creatures? (an opponent controls|your opponents control)|Whenever a creature an opponent controls becomes tapped` (8 cards). A card that also taps on its own counts once: setup when the reward is a one-turn pump (Icewrought Sentry), payoff otherwise (Verity Circle).
- Tapped removal, 0.5: `(Destroy|Exile) target tapped creature|damage to target tapped creature|less to cast if it targets a tapped creature`. Counts and bounce, 0.5: `for each tapped creature (target opponent controls|your opponents control|an opponent controls|defending player controls)|[Rr]eturn target tapped creature` (11 cards). A repeatable tapper that also matches these stays setup (Hylda's Crown of Winter).
- Drop from payoff: `synergy-tapped` unless the text names opponents; `tapped (land|artifact)`, `untapped land`.

## Group hug (groupHug)

### 1. Plan

At 60, 40, and 20: make both players draw more, and hurt the opponent for each card drawn or held. At 100: give everyone cards and lands so nobody attacks you, with cards that give you more than each opponent.

### 2. Builds up and spends

Extra cards the opponent draws (unit: one card) and cards in the opponent's hand; at 100, also lands and mana given away. In a two-player game a gift with no punisher only helps the opponent.

### 3. Setup jobs

- **Repeatable symmetric draw** (weight 2): a trigger, an activated ability with any cost ({T} or mana), or an extra draw in each draw step. Howling Golem (c): "Whenever this creature attacks or blocks, each player draws a card." Sky Crier (c): "{3}{W}: You and target opponent each draw a card." Diviner Spirit (u): "Whenever this creature deals combat damage to a player, you and that player each draw that many cards." Of the 66 repeatable draw gifts among the 432 tagged cards, only 8 are common or uncommon.
- **One-shot draw gifts** (weight 1). Vision Skeins (c): "Each player draws two cards." Soaring Show-Off (c): "When this creature enters, each player draws a card." Two-player wordings count too: Huddle Up (c), "Two target players each draw a card."; Clockwork Fox (c), "you draw two cards and each opponent draws a card"; Bargain (u), "Target opponent draws a card." With a punisher out, these are the best setup at two players.
- **Flexible draw** (weight 0.5). "Target player draws" goes to whoever you pick, so it is a gift only when a punisher is out. Limestone Golem (u): "{2}, Sacrifice this creature: Target player draws a card."
- **Land and mana gifts** (weight 1 at 100, 0 below). Jungle Wayfinder (c): "each player may search their library for a basic land card". Spectral Searchlight (c): "Choose a player. That player adds one mana". Tempt with Discovery (u) gives you an extra land for each opponent who takes one ("For each opponent who searches a library this way, search your library for a land card"), but that reward follows only its own gift, so it is setup here (part 6).

### 4. Payoff jobs

- **Draw punishers**, repeatable. Underworld Dreams (u) and Ob Nixilis, the Hate-Twisted (u): "Whenever an opponent draws a card, [it] deals 1 damage to that player." Other wordings: Spiteful Visions (r), "Whenever a player draws a card, this enchantment deals 1 damage to that player."; Curse of Fool's Wisdom (r), "Whenever enchanted player draws a card, they lose 2 life and you gain 2 life." One punisher with one repeatable setup card out deals about 2 damage a turn (the normal draw plus one extra), so a lone punisher needs about ten turns; full-hand burn and creatures finish. With 4 punishers in 60, one shows by turn 5 in 60% of games and two in only 18%, so plan around one live punisher, not two.
- **Full-hand burn**. Sudden Impact and Storm Seeker (u), one-shot: "equal to the number of cards in that player's hand." Black Vise (u), repeatable: "the number of cards in their hand minus 4." Threshold punishers are repeatable too: Misers' Cage (r), "if that player has five or more cards in hand, this artifact deals 2 damage to that player"; Ebony Owl Netsuke (u) needs seven. All of them need the opponent at 5+ cards first.
- **Draw rewards**, best at 100. Smothering Tithe (r): "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token." It pays off every opponent draw, not only its own gift, so it is a payoff (part 6).

### 5. False friends

Checked tag-listed cards:

- Gift riders: Long River's Pull (u) and Nocturnal Hunger (c) carry both hug tags but are a counterspell and removal ("Gift a card", "Gift a Food"). 24 of the 432 tagged cards are Gift cards.
- Mana riders: An Offer You Can't Refuse (c) carries `donate-mana` but is a counterspell: "Counter target noncreature spell. Its controller creates two Treasure tokens."
- Life for the opponent: Skyshroud Cutter ("you may have each other player gain 5 life") and Fall to Earth ("Exile target creature. Each player gains 3 life.") feed the opponent, not a punisher.
- Costs: Nullmage Advocate's Naturalize costs "Return two target cards from an opponent's graveyard to their hand."
- Draw stax under `draw-hate`: Spirit of the Labyrinth ("Each player can't draw more than one card each turn") stops the setup yet counts as a payoff.

### 6. Both jobs

Payoff if the reward triggers on any opponent draw or hand size: Scrawling Crawler (r), "each player draws a card. Whenever an opponent draws a card, that player loses 1 life."; Spiteful Visions, whose damage fires on every draw, not only on its own extra card. Setup if it rewards only its own gift: Words of Wisdom (c), "You draw two cards, then each other player draws a card."; Tempt with Discovery.

### 7. Enough

| Size | Setup                                       | Payoffs               | Also                               |
| ---- | ------------------------------------------- | --------------------- | ---------------------------------- |
| 60   | 10 (4+ repeatable)                          | 6 to 8 (4+ punishers) | 6 to 8 interaction, tough blockers |
| 40   | 6 to 7                                      | 4 to 5                | 4 to 5 interaction                 |
| 20   | 4 to 5                                      | 3 (2+ punishers)      | 2 interaction                      |
| 100  | 10 to 14 (6+ repeatable), hugging commander | 6 to 10               | 5+ protection                      |

Reasoning: 10 setup copies show one by turn 5 in 91% of games, 7 payoffs in 81%. Punishers are the scarce part: 4 in 60 show one by turn 5 in 60% of games, so full-hand burn fills the rest of the payoff count. At 20, a packet with no punisher only feeds the opponent (part 2), so it needs 2 punishers or group hug is not offered at 20; 3 payoffs in the 40-card deck show one by turn 5 in 67% of games. At 100, the part 9 rules find 14 setup cards in Peace Offering (7 repeatable) and 9 in Stalwart Unity (5 repeatable; Gwafa Hazid and Humble Defector, two gifts the regexes miss, make 11). Each precon's commander gives cards every turn: Ms. Bumbleflower ("Whenever you cast a spell, target opponent draws a card") and Kynaios and Tiro ("each opponent who didn't draws a card"). The live matcher's 18 and 15 enabler hits for these precons also count 5 Gift cards (Peace Offering) and Akroan Horse, Orzhov Advokist, Evolutionary Escalation, and Forbidden Orchard (Stalwart Unity). 12 setup copies in 99 show one by turn 5 in 81% of games, and the commander is there every game; without a hugging commander, use the top of the range. On EDHREC, Howling Mine ("that player draws an additional card") is in 38% of 20,825 group hug decks. The public pools hold two punishers (Kederekt Parasite, Underworld Dreams) and 10 draw gifts (7 repeatable) in 2,455 cards, so offer the style only with 4+ real payoffs, and at 20 only with 2 punishers.

### 8. Where the live matchers differ

- Enabler #1 (`anyTags group-hug|selective-group-hug`) is too broad. Of 432 cards, the part 9 rules find 122 draw gifts (66 repeatable), 10 flexible draws, and 27 land or mana gifts; 47 are Gift riders, costs, draw stax, or life gifts; 226 do other things. About 10 of 25 hits in the public pools give cards.
- Payoff #1 (`anyTags draw-hate`) counts draw stax and misses full-hand burn (`hate-full-hand`). Both precons have zero payoff hits in their 99. Scrawling Crawler counts as both.
- No size check: land and mana gifts count at 60.

### 9. Matcher hints

Test each ability line (split on newlines, flag `m`).

- Giver `G`: `(each player|each other player|each opponent|target opponent|(up to )?two target players|any number of target opponents|you and (target|that|another target|defending) (opponent|player)|defending player)`. Draw `D`: `\bG\b(?:(?!\byou\b)[^.]){0,60}?\b(may )?(each )?draws?\b(?! step)`. The gap stops at a period and at "you", so "each opponent discards a card. For each opponent who can't, you draw a card" is not a gift, and `(?! step)` skips "each player's draw step".
- Repeatable setup: `D` on a trigger line starting `^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)`, where "that player" also counts as a giver; or `D` on an activated line `^([^\n\u2014]*\u2014 )?(?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*:` with any cost; or `/\b(that|each) player draws (an|\w+) additional cards?/i`. This finds Sky Crier, Font of Mythos ("that player draws two additional cards"), Kwain ("{T}: Each player may draw a card"), Temple Bell, and Howling Mine.
- One-shot setup: any other `D` (Huddle Up, Clockwork Fox, Cut a Deal, Bargain). Flexible: `/\btarget player (may )?draws?\b/i`, weight 0.5 (Limestone Golem).
- Land and mana gifts, weight 1 at 100 and 0 at 60/40/20: `/\b(each player|each opponent|each other player|target opponent|that player)\b[^.]{0,30}?\b(may )?(search(es)? their library for [^.]*land|put (a|up to \w+) land cards? from their hand onto the battlefield|play an additional land)|\b(each player|that player|target opponent) adds\b|\b(each player|each opponent|target opponent|you and target opponent)( each)? creates? (a|an|\w+) Treasure|\blands tap for an additional/i`. Read the text, not the `donate-mana` and `donate-rampant-growth` tags: Jungle Wayfinder has neither tag, and An Offer You Can't Refuse has `donate-mana`.
- Not setup, checked first: `/\bGift an? |cumulative upkeep|rather than pay this spell's mana cost, you may have|from an opponent's graveyard to their hand|can't draw|skips? (their|that|your) draw/i`. Life gifts, `/(player|opponent) gains? \d+ life/i`, are not setup unless `D` also matches.
- Payoff: `/whenever (an opponent|a player|enchanted (player|opponent)) draws (a|their \w+) card[^.]*(damage|loses? \d+ life|you (may )?(draw|gain)|create|may pay \{\d\})/i`. It matches 27 cards in the pack, including Spiteful Visions, Phyrexian Tyranny, and Curse of Fool's Wisdom; only Underworld Dreams and Ob Nixilis, the Hate-Twisted are below rare. Hand size: `/(for each card in|number of cards in) (that player's|their|target opponent's|defending player's|enchanted player's|the chosen player's) hand|\b(that|the) player (is your opponent and )?has \w+ or more cards in hand[^.]*(damage|loses? \d+ life)/i`. It matches 32 of the 60 `hate-full-hand` cards, up from 22, including Fevered Visions, Misers' Cage, and Ebony Owl Netsuke.
- Exclude: `/can't draw (more than one card|cards)|skips that draw|\d minus the number of cards/i`.

## Goad (goad)

### 1. Plan

At 60, 40, and 20: force the opponent's creatures to attack into my blockers, drain them for it, and swing past the ones left tapped. At 100: make opponents' creatures attack each other.

### 2. Builds up and spends

Forced attacks by opposing creatures; unit: one creature forced to attack for one turn. A goaded creature "attacks each combat if able and attacks a player other than [you] if able" (rule 701.15b). With one opponent it attacks you and stays tapped through your turn.

### 3. Setup jobs

- **Repeatable or lasting** (weight 2). Taunting Kobold (u): "Whenever this creature attacks, goad target creature an opponent controls." Courtly Provocateur (u): "{T}: Target creature attacks this turn if able." Most forced attacks in bulk do not say "goad": Alluring Siren (u), "{T}: Target creature an opponent controls attacks you this turn if able."; Curse of the Nightly Hunt (u), "Creatures enchanted player controls attack each combat if able."; Trove of Temptation (u), "Each opponent must attack you or a planeswalker you control with at least one creature each combat if able."
- **Pump and goad** (weight 2 at 100; weight 1 at 60/40/20, and outside the lasting floor there). Shiny Impetus (c): "Enchanted creature gets +2/+2 and is goaded." Bloodthirsty Blade (u): "Equipped creature gets +2/+0 and is goaded." At two players there is no "player other than" you to attack (rule 701.15b), so a goaded creature attacks you, and these cards send it in bigger, against the blockers the plan relies on. It does stay tapped on your turn. Put it on a creature your blockers still beat.
- **One-shot** (weight 1). Jeering Homunculus (c): "When this creature enters, you may goad target creature", on a 0/4 body. Coronation of Chaos (c): "Up to three target creatures can't block this turn. Goad them." Imaginary Threats (u): "Creatures target opponent controls attack this turn if able. During that player's next untap step, creatures they control don't untap." Incite War (c), one mode: "Creatures target player controls attack this turn if able."
- **Symmetric** (weight 1 at 100, 0.5 at 60/40/20). Grand Melee (r): "All creatures attack each combat if able." At two players it forces your creatures to attack too.

### 4. Payoff jobs

- **Attack drains**, repeatable. Revenge of Ravens (u): "Whenever a creature attacks you..., that creature's controller loses 1 life and you gain 1 life." Hissing Miasma (u): "Whenever a creature attacks you, its controller loses 1 life." Each wants about one forced attacker a turn.
- **Punish triggers.** Kardur, Doomscourge (u): "Whenever an attacking creature dies, each opponent loses 1 life and you gain 1 life." Vengeful Ancestor (r): "Whenever a goaded creature attacks, it deals 1 damage to its controller."
- **Tap and attack punishers**, repeatable Auras for an opposing creature that another card forces to attack. Insolence (c): "Whenever enchanted creature becomes tapped, this Aura deals 2 damage to that creature's controller." Sinister Possession (c): "Whenever enchanted creature attacks or blocks, its controller loses 2 life." Seizures (c) deals 3 "unless that player pays {3}".
- At two players, blockers do half the work: a forced 2/2 into a 0/4 only costs a turn. Deathtouch, first strike, and toughness 4+ creatures are support.

### 5. False friends

Checked:

- Self-forcing under `force-attacker`: Hellraiser Goblin ("Creatures you control have haste and attack each combat if able"), Uncontrollable Anger ("gets +2/+2 and attacks each combat if able", a friendly Aura).
- One-turn tricks: Boiling Blood ("Target creature attacks this turn if able. Draw a card."), half weight.
- `attacking-opponents-matters` at 60/40/20: Gahiji, Honored One ("Whenever a creature attacks one of your opponents... gets +2/+0") pumps only your own attackers there; Martial Impetus's rider ("each other creature that's attacking one of your opponents gets +1/+1") does nothing.
- Attack taxes: a creature that "can't attack unless a player pays a cost" need not pay (rule 508.1d), so Propaganda ("Creatures can't attack you unless their controller pays {2}") turns goad off at two players.

### 6. Both jobs

Count what the card does every turn. Setup if the reward follows only its own target: Bothersome Quasit ("Whenever you cast a noncreature spell, goad target creature an opponent controls"); the Impetus Auras, including Parasitic Impetus ("Whenever enchanted creature attacks, its controller loses 2 life and you gain 2 life"); and Lust for War, which forces the creature it enchants and deals 3 "Whenever enchanted creature becomes tapped". Their drain makes them self-contained, which suits packets, but it rewards no other card's forced attack, so they never count as payoffs. Payoff if the goad is one-time and the lasting text rewards (Kardur), or the reward fires on any goaded or forced creature (Vengeful Ancestor, Insolence).

### 7. Enough

| Size | Setup                                    | Payoffs | Also                         |
| ---- | ---------------------------------------- | ------- | ---------------------------- |
| 60   | 10 to 12 (6+ lasting, not pump and goad) | 4 to 6  | 8+ good blockers, 4+ removal |
| 40   | 7 to 8                                   | 3 to 4  | 6+ good blockers             |
| 20   | 5, also bodies                           | 2 to 3  | 3+ good blockers             |
| 100  | 15 to 20 (10+ lasting)                   | 5 to 8  | 3 to 5 attack taxes          |

Reasoning: 12 setup copies show one by turn 5 in 95% of games but 5 payoffs only 69%, so blockers carry part of the plan. The pack holds 26 common or uncommon lasting cards that force opposing creatures (Alluring Siren, Curse of the Nightly Hunt, Nettling Imp, Bloodshed Fever), so 6+ lasting at 60 is reachable from a large pool. At 20, 5 setup copies in the 40-card deck show one by turn 5 in 85% of games, and 2 to 3 payoffs show one in 52% to 67%; blockers make up the rest. At 100, the Blame Game and Draconic Dissent precons hold 13 and 20 enabler hits plus a goading commander; on EDHREC's forced-combat page, Disrupt Decorum ("Goad all creatures you don't control") is in 65% of 12,730 possible decks. Nelly Borca ("Whenever Nelly Borca attacks, suspect target creature. Then goad all suspected creatures.") cuts setup to 12 to 15; the line check in part 9 counts it as lasting. The public pools hold one payoff by part 6, Stinging Licid (a tap punisher once it becomes an Aura: "Whenever enchanted creature becomes tapped, this creature deals 2 damage to that creature's controller"), and Parasitic Impetus, which is setup.

### 8. Where the live matchers differ

- Enabler #1 (`anyTags force-attacker`, 164 cards) has no owner check. The part 9 rules sort them as 78 lasting, 10 pump and goad, 48 one-shot, 6 symmetric, 13 that force your own creatures (Hellraiser Goblin, Uncontrollable Anger, Zurgo Helmsmasher), and 9 with no forcing text of their own (granted abilities in quotes, or checks like Keldon Twilight's "if no creatures attacked this turn"). 64 of the 142 that force opposing or all creatures never say "goad", so only text separates them.
- Payoff #1: `synergy-goad` is 9 rare or mythic cards, 8 also tagged `force-attacker`, so they count as both. `attacking-opponents-matters` (28 cards) rewards your own attacks at 60/40/20.
- Missed payoffs: attack drains (`tax-attack` with `opponent-loses-life`), Kardur's trigger (counted only as enabler), and the tap and attack punisher Auras, which carry no tag either clause reads (Insolence, Seizures, Sinister Possession: no enabler or payoff hit). Parasitic Impetus counts only as enabler, which matches part 6.

### 9. Matcher hints

Remove reminder text `/\([^)]*\)/g` and granted abilities in quotes `/"[^"]*"/g`, then split the text into ability lines and each line into sentences.

- Forced attack: `/\bgoad(s|ed)?\b|\battacks?\b[^.,]{0,50}?\bif able|\bmust attack\b/i`. The comma stop keeps "Whenever this creature attacks, target creature ... blocks it this combat if able" out.
- Own creatures, not setup, for a sentence without "goad": `/\b(creatures|\w+s) you control (have [^.]*)?(attack|must attack)|gets \+\d+\/\+\d+[^.]*and attacks each combat if able/i`, or the words before the first "attack" contain none of `/\b(target|opponents?|enchanted|equipped|each|all|creatures|player|those|(that|the) creature)\b/i` (Zurgo, "This creature attacks each combat if able").
- Symmetric: a sentence starting `/^(all creatures|each creature) (attack|attacks|have)\b/i`.
- Lasting, for a force on opposing creatures: the whole line is a trigger, `/^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)\b/i`; or an activated ability whose cost has no sacrifice, `/^([^\n\u2014]*\u2014 )?((?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*|[+−]?\d+):/i`; or a static line on a permanent matching `/each combat|\b(is|are) goaded\b|\bmust attack\b/i` that does not start with When, Until, or During. Testing the line, not the sentence, keeps Nelly Borca lasting. This finds Alluring Siren, Curse of the Nightly Hunt, Trove of Temptation, Nettling Imp, Norritt, Heckling Fiends, Baeloth Barrityl ("are goaded"), and Kang ("are goaded for as long as you control Kang").
- One-shot: any other force on opposing creatures (Incite War, Imaginary Threats, Siren's Call, Suicidal Charge). Instants and sorceries are always one-shot, and one that forces a single creature for one turn counts half (Boiling Blood).
- Pump and goad: `/(enchanted|equipped) creature gets \+\d+\/\+\d+[^.]*(is goaded|attacks each combat)/i`, weight 1 at 60/40/20.
- Payoff: `/whenever (a creature attacks you( or a planeswalker you control)?, (its|that creature's) controller loses|an attacking creature dies|a goaded creature|enchanted creature (attacks|attacks or blocks|becomes tapped)[^.]*(its controller loses|that creature's controller))/i`. It matches 15 cards in the pack, including Insolence, Seizures, and Stinging Licid. A card that also forces its own enchanted creature (Parasitic Impetus, Lust for War, Nettling Curse) is setup (part 6).
- Weight `attacking-opponents-matters` 0 at 60/40/20, 0.5 at 100; `tax-attack` with "pays" 0 at 60/40/20.

## Energy (energy)

### 1. Plan

Collect energy from cards that give it, then spend it on cards that turn it into damage, tokens, counters, or cards.

### 2. Builds up and spends

Energy counters on you; unit: one {E}. They stay until spent ("To pay {E}, a player removes one energy counter from themselves", rule 107.14), so surplus banks across turns.

### 3. Setup jobs

- **One-shot makers** (weight 1, 1.5 at three or more {E}). Attune with Aether (c): "Search your library for a basic land card... You get {E}{E}". Sage of Shaila's Claim (c): "When this creature enters, you get {E}{E}{E}".
- **Repeatable makers** (weight 2). Decoction Module (u): "Whenever a creature you control enters, you get {E}". Empyreal Voyager (u): "deals combat damage to a player, you get that many {E}".
- **Multipliers** (weight 1, and only with 4+ repeatable makers). Izzet Generatorium (u): "If you would get one or more {E} ..., you get that many plus one {E} instead." It makes nothing alone and adds one {E} per gain, so it needs makers that trigger often. Its "{T}: Draw a card. Activate only if you've paid or lost four or more {E} this turn" rewards spending, not making.

### 4. Payoff jobs

- **Repeatable sinks.** Aethertorch Renegade (u): "{T}, Pay {E}{E}: This creature deals 1 damage to target creature." Thriving Rhino (c): "Whenever this creature attacks, you may pay {E}{E}. If you do, put a +1/+1 counter on it." At 2 to 3 a use, each wants about 2 income a turn.
- **Scaling one-shots.** Harnessed Lightning (u) and Galvanic Discharge (c): "you may pay any amount of {E}". They bring 2 or 3 and grow with the bank.
- **Spend only.** Reiterating Bolt (u): its replicate cost is "Pay {E}{E}{E}." Needs makers.
- **Get triggers.** Fabrication Module (u): "Whenever you get one or more {E}, put a +1/+1 counter on target creature you control." Its own "{4}, {T}: You get {E}." feeds it slowly; count it once, as a payoff. Many small gains beat one big one.

### 5. False friends

Checked:

- Mana spends: Aether Hub (u) and Servant of the Conduit (u), "{T}, Pay {E}: Add one mana of any color." Both tags; they are mana.
- One-and-done bodies: Aetherstream Leopard (c) gets "{E}" on entering and "may pay {E}" for +2/+0: a light sink, not setup.
- Cross-theme: `counter-fuel-energy` also makes each spender a Counters payoff (Harnessed Lightning shows "counters (payoff)").
- Hidden makers: Aether Chaser (c) carries only `counter-fuel-energy` yet says "When this creature enters, you get {E}{E}". That income is its own first use, so it is still a payoff (part 6).

### 6. Both jobs

108 of 141 energy cards make and spend. Give each one job:

- **Payoff** if it can spend again and again (an activated cost, an attack or upkeep trigger) and its own income per turn is below one use. One-shot income counts as the first use: Thriving Rhino and Aethertorch Renegade are payoffs. So is repeatable income below one use: Consulate Turret ("{T}: You get {E}" against "{T}, Pay {E}{E}{E}"). A variable spend ("any amount", "one or more", "X") is a payoff too.
- **Setup** if income repeats and the spend is one-time (sacrifice, exhaust), or if income per trigger is above one use.
- **Self-fed** if income per trigger equals one use. Longtusk Cub (u): "Whenever this creature deals combat damage to a player, you get {E}{E}" and "Pay {E}{E}: Put a +1/+1 counter on this creature." Count it once as a payoff, and leave it out of the energy budget on both sides: it neither needs nor supplies energy.
- A spend that only makes mana, or only keeps the card itself (Lathnu Hellion: "sacrifice this creature unless you pay {E}{E}"), does not count.

### 7. Enough

| Size | Setup                    | Payoffs                 | Also                               |
| ---- | ------------------------ | ----------------------- | ---------------------------------- |
| 60   | 8 to 10 (3+ repeatable)  | 8 to 10 (4+ repeatable) | midrange curve, 6+ interaction     |
| 40   | 6                        | 6                       | 4+ interaction                     |
| 20   | 4                        | 4                       | payoffs that bring their first use |
| 100  | 12 to 15 (6+ repeatable) | 10 to 12                | 8+ interaction                     |

Reasoning: about 1:1, since most sinks bring their first 2 or 3 {E}. With 9 makers, 89% of games see one by turn 5 and bank about 5 {E}: two uses of a 2 to 3 cost sink. Budget: one-shot energy plus twice the repeatable income should cover 1.5 times one use of every repeatable sink. On the 60-card Kaladesh precon "Nissa, Nature's Artisan", part 6 gives 8 setup copies (Attune with Aether, Sage of Shaila's Claim, Servant of the Conduit, Empyreal Voyager), 9 payoffs, and 2 self-fed Longtusk Cubs. At 20, 4 makers in the 40-card deck show one by turn 5 in 78% of games, and a payoff that brings its own first use (Thriving Rhino, Aether Chaser) works even when the other packet has no energy. At 100, the Creative Energy and Living Energy precons hold 32 and 24 matcher hits; on EDHREC, Izzet Generatorium is in 83% of 6,536 possible decks. Both precon commanders spend more than they make (Satya: "unless you pay an amount of {E} equal to its mana value"; Saheeli, Radiant Creator: "you may pay {E}{E}{E}"), so add 3 to 4 makers. The public pools hold 10 energy cards in 2,455.

### 8. Where the live matchers differ

- Enabler #1 (`anyTags energy-generator`) and payoff #1 (`anyTags counter-fuel-energy`) overlap on 104 of 141 cards, so 8 two-tag cards meet the 60-card minimums alone. In the precons, 29 of 32 and 20 of 24 hits are both.
- `energy-generator` leaves out Aether Chaser, Thriving Rhino, and similar commons, which carry only `counter-fuel-energy`. Part 6 calls them payoffs, so the effect is right, but by accident: Aethertorch Renegade works the same way and carries both tags.
- Neither clause sees Izzet Generatorium (`energy-increaser`) or Aether Revolt and Territorial Gorger ("Whenever you get one or more {E}"); Fabrication Module counts only as enabler. Mana spends count as both.

### 9. Matcher hints

- Maker `M`: `/\bget ((\{E\})+|an amount of \{E\}|that many \{E\}|\w+ \{E\})/i`. It finds 122 of the 123 `energy-generator` cards, including Reservoir Walker ("you gain 3 life and get {E}{E}{E}"), and skips "Whenever you get one or more {E}".
- Repeatable maker (flag `m`): `/^([^\n\u2014]*\u2014 )?(whenever|at the beginning of|landfall)[^\n]*?, [^\n]*\bget M|^(?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*:[^\n]*\bget M/im`, with `M` the group above. The gain must follow the trigger's comma, so Aether Revolt and Territorial Gorger are not makers.
- Sink: `/\bpay(ing)? (any amount of |an amount of |one or more |x |\w+ )?\{E\}/i`. It finds 121 of the 122 `counter-fuel-energy` cards, including Reiterating Bolt (replicate cost "Pay {E}{E}{E}"), Blaster Hulk ("pay eight {E}") and Territorial Aetherkite ("pay one or more {E}"), Lightning Runner ("you may pay eight {E}. If you pay"), and Sphinx of the Revelation ("{W}{U}{U}, {T}, Pay X {E}:"). The miss, Razorfield Ripper, reads the bank without paying ("where X is the amount of {E} you have").
- Repeatable sink (flag `m`): an activated cost with {E}, `^[^:\n]*\{E\}[^:\n]*:`, or a trigger line, `^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)[^\n]*?, [^\n]*\bpay(ing)? (any amount of |an amount of |one or more |x |\w+ )?\{E\}`. Variable spend: `/pay (any amount of|one or more|an amount of|x) \{E\}|the amount of \{E\} you have/i`.
- Not a sink: `/\{T\}, pay \{E\}: add one mana/i` as the only spend; `/(sacrifice (this \w+|it)|tap this \w+) unless you pay (\{E\})+/i`.
- Get trigger, payoff: `/whenever you get one or more \{E\}/i`. Multiplier: `/if you would get one or more \{E\}/i` (Izzet Generatorium, Aether Refinery), not the `energy-increaser` tag, which also holds general counter doublers such as Winding Constrictor ("If you would get one or more counters, you get that many plus one of each of those kinds of counters instead").
- One job per card, in this order: get trigger, payoff; multiplier, part 3; variable spend, payoff; a spend with no maker, payoff; a maker with no counted spend, setup; one-shot income with a repeatable spend, payoff, or with a one-time spend, setup; repeatable income with a repeatable spend, compare {E} per gain with {E} per use (below: payoff, equal: self-fed, above: setup). Over the 141 energy cards this gives 30 setup, 100 payoffs, 9 self-fed, 1 multiplier, and The Convention Enthusiast with neither. `counter-fuel-energy` means "has a spend", not payoff.

## Group notes

Each group file opened with notes its styles share: where its numbers come from, its odds table, and rules its sections point back to, such as "the top" and "the counting rules". They are kept here as written.

### Tokens, +1/+1 counters, Aristocrats (g1)

Part of the Phase 2 theme guide in `docs/algo-review.md`, for builder prototypes and the automatic deck checks. Judges read the cards and decide for themselves.

**Sources.** Card text, tags, and matcher hits: `npm run review:cards -- "<name>" --style <id>` (pack 2026-11-03). Tag counts: scratch scripts in `data/review/scratch/g1/` over nonland, non-Un cards (`style.ts` and `clauses.ts` for matcher hits, `pat.ts` and `cat.cjs` for text patterns inside a tag, `find.ts` for text searches), with corrections from `data/review/scratch/g1chk/counts.ts`, `counts2.ts`, and `counts4.ts` and `data/review/scratch/g1fix/dts.ts`. Real decks: `node data/review/scratch/g1fix/medians.ts <style> <size> <top>` counts each card once under the counting rules below, with the rough regex jobs of `data/review/scratch/g1/jobs.ts`, over `data/corpus/decks.json` (precons at 100, 60, 20; 17Lands draft decks at 40), keeping the decks `jobs.ts` ranks highest. `node data/review/scratch/g1fix/medians.ts <style> edhrec` takes instead the 100-card precons whose commander is an EDHREC top or new commander for the tag, one deck per commander. Medians are true medians (the mean of the middle two for an even count). Output in `data/review/scratch/g1fix/medians-out.txt`. Draw odds: `node data/review/scratch/g1fix/odds.cjs` (`odds-out.txt`). Hint regexes: `node data/review/scratch/g1fix/hints.ts` (`hints-out.txt`). Live decks: `docs/review/our-builder-themes.md`. EDHREC inclusion: `data/edhrec/pages/tags/{tokens,plus-1-plus-1-counters,aristocrats}.json`.

**Real decks are a scale check, not proof.** The real-deck figures come from this guide's own regex classifier, over decks ranked by that same classifier, so they share the guide's definitions: the "score and yardstick built on the same definitions" trap in `docs/algo-review.md`. The top lists also pull in off-theme decks: Jace, Arcane Strategist among the Counters 60 top 8; Repel the Dark (no outlet) among the Aristocrats 60 top 8; Deep Clue Sea and World Shaper (no outlet) among the Aristocrats 100 top 10. At 40 the sample is the top 100 of 54,000 drafts, an upper bound, not a typical deck. The EDHREC-commander rows at 100 pick decks without the classifier's ranking, but still count them with it. The minimums rest on the draw math below; the real decks only show that the numbers are in the range real decks play.

**Counting rules for all three.**

- **Each card once.** If one half is a rider (one-shot, small, conditional, typal, or one mode of a modal spell), the card is the other job.
- **Duals.** If both halves are real, count the card for the job with more weight. On a tie, count it as payoff, the scarcer job in most decks; a builder short of setup may count a tied card as setup instead, but never as both. Aristocrats breaks ties its own way (its section 6). The real-deck figures use the same rule.
- **Weights.** By default a repeatable engine weighs 2, a one-shot that makes several units 1, and a single unit 0.5. Each style's sections 3 and 4 set its own weights, and those override the default: Counters counts a single counter on one creature as 1 and a mass placer as 1.5, since one counter is its unit; Aristocrats counts one body that dies with value as 1. Payoffs carry weights too, for the tie rule.
- **How the tables count.** Every cell counts copies, and a weight-0.5 copy counts half: ten "creature plus one token" cards are 5 toward the Tokens "Setup 9 to 12", not 10. The engine column of each table (Engines, Growth engines, repeatable Outlets) counts the copies of that job alone and is a floor of its own, so riders and single units can never meet a minimum by themselves.

**Draw math.** By turn 5 a 40, 60, or 99-card deck has seen about 12 cards. At 60, 10 setup cards show one in 91% of games and two in 65%; 6 payoffs show one in 75%. At 40, 6 setup gives 90% and 59%, 4 payoffs 78%. At 99 singleton, 14 setup gives 86% and 53%, 8 payoffs 66%; the commander is one more card that is always there. Engine floors, one copy seen by turn 5 (`odds.cjs`):

| Copies | 40  | 60  | 99  |
| ------ | --- | --- | --- |
| 1      | 30% |     |     |
| 2      | 52% |     |     |
| 3      | 67% | 49% |     |
| 4      | 78% | 60% | 41% |
| 5      | 85% | 69% | 48% |
| 6      |     | 75% | 55% |
| 7      |     | 81% | 61% |

Two kinds of floor follow. An engine the plan cannot run without (the Aristocrats repeatable outlet) gets the count that shows one in about half of games at every size: 2 at 40, 3 at 60, 5 at 99. Engines that one-shot cards can stand in for (token engines, counter growth) get the count that shows one in about 3 games of 5: 3 at 40, 4 at 60, 7 at 99.

**20-card packets.** A 20-card packet is half of a 40-card deck: any two packets of different colors shuffle into a two-color 40-card deck (`SPEC.md`, Deck sizes). By turn 5 a packet has given about 6 of the 12 cards seen, so the 20 rows are about half the 40 rows, with floors rounded up. Copies in one packet show by turn 5 as they would in the 40-card deck: one copy in 30% of games, two in 52%. A packet alone carries half a plan; the full plan shows only when the other packet shares the theme.

**Text prep for every matcher hint (section 9).** Remove reminder text (anything in parentheses), split the oracle text into lines, and drop a leading ability word such as "Enrage" or "Landfall" with the dash after it. Test each line on its own, case-insensitive, so `^` means the start of a line. Keyword lines such as Mobilize, Exploit, Evolve, Afterlife, and Persist then match only their `^` patterns, never their reminder text. "The cost" means the text before the colon on that line. `hints.ts` works this way; `jobs.ts` does too, except that it keeps ability words.

### Graveyard, Mill, Spellslinger (g2)

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

#### Scratch scripts

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

### Lifegain, Artifacts, Enchantments (g3)

Part of the Phase 2 theme guide in `docs/algo-review.md`. Every card named here was printed with `npm run review:cards -- "<name>" --style <id>` (data pack 2026-11-03); quotes come from that output. "Bulk" counts are nonland commons and uncommons (20,085 cards). Counts of the live matchers come from scratch scripts `data/review/scratch/g3-honest.ts`, `g3-themes.ts`, `g3-tagmix.ts`, and `g3-lgsplit.ts`. Counts under the part 9 hints come from `node data/review/scratch/g3fix/hints.ts bulk` (output in `g3fix/bulk.txt`). Precon counts come from `node data/review/scratch/g3fix/hints.ts deck <style> <name>` over `data/corpus/decks.json`, which applies the part 9 hints of each section, weights included (output in `g3fix/decks-*.txt`). Rules cites are from `docs/rules/MagicCompRules.txt`.

**Counting rules.** Count each card once, as part 6 of its section says. The "Enough" tables count copies: "8+ repeatable" means eight repeatable cards, not four cards of weight 2. Toward a floor a card counts 1, a half payoff or a token-making instant or sorcery counts 0.5, and a rider counts 0. The other weights (2 for repeatable, 0.5 at mana value 5 or more) only rank cards inside a job when a builder picks; a prototype may also sum them, but a floor is met by copies. The cheap sub-floors keep a stack of 5-drops from meeting a count. Precon counts below use the same units.

**Odds.** Hypergeometric, 12 cards seen by turn 5 (7 plus 5 draws), from `node data/review/scratch/g3fix/odds.cjs`. Floors aim at one standard for every style: about 75% or better to see one payoff by turn 5, and about 80% or better to see what the payoffs need (one repeatable source, or three artifacts or enchantments for count payoffs). At 99 the commander is one more card, always available. A 20-card packet is shuffled with another packet into 40 cards (`SPEC.md`, Deck sizes), so its odds use a 40-card deck that holds only the packet's copies. Twelve spells cannot meet the 75% standard on every job, so packets aim at about two games in three: 3 copies give 67%, 4 give 78%.

| Copies | 60: one / three | 40 or a packet: one / three | 99: one / three |
| ------ | --------------- | --------------------------- | --------------- |
| 3      | 49% / 1%        | 67% / 2%                    | 32% / 0%        |
| 4      | 60% / 2%        | 78% / 7%                    | 41% / 1%        |
| 6      | 75% / 9%        | 90% / 24%                   | 55% / 2%        |
| 7      | 81% / 14%       | 94% / 35%                   | 61% / 4%        |
| 8      | 85% / 19%       | 96% / 45%                   | 66% / 5%        |
| 10     | 91% / 32%       | 98% / 64%                   | 74% / 10%       |
| 12     | 95% / 45%       | 99% / 79%                   | 81% / 16%       |
| 16     | 98% / 68%       | 100% / 95%                  | 90% / 30%       |
| 18     | 99% / 78%       | 100% / 98%                  | 92% / 38%       |
| 30     | 100% / 99%      | 100% / 100%                 | 99% / 77%       |
| 32     | 100% / 99%      | 100% / 100%                 | 99% / 82%       |

**Type caps.** The live templates cap noncreature permanents at `typeMix.noncreaturePermanentMax` of spell slots (`config/deck-templates.json`): 0.3 at 60, 0.25 at 40 and 20, and 0.4 at 100. `canAdd` in `packages/core/src/builder.ts` enforces it during the theme passes. That is about 11 noncreature permanents at 60, 6 at 40, 3 at 20, and 25 at 100, shared by noncreature artifacts, enchantments, and planeswalkers. Artifacts and Enchantments both run into this cap; see part 7 of each.

### Voltron, Evasion, and Burn (g4)

Three styles from `config/archetypes.json`: `auras` (shown as Voltron), `flyers` (shown as Evasion), and `burn`.

Sources. Card text and matcher hits come from `npm run review:cards -- "<name>" --style <id>` on pack version 2026-11-03; every card named below was printed that way. Counts over the whole pack (Un-sets left out) come from scratch scripts in `data/review/scratch/` (`g4-auras2.cjs`, `g4-flyers.cjs`, `g4-burn.cjs`, `g4-burnpay.cjs`, `g4chk/counts.cjs`, and for the section 9 hints `node data/review/scratch/g4fix/hints.cjs <examples|voltron|evasion|burn>`; the folder is gitignored), so they are approximate text counts. Real decks are counted by this guide's jobs, each card once, with `node data/review/scratch/g4fix/anchors.cjs` over `data/corpus/decks.json`. Draw odds come from `g4-hyper.cjs` and `g4fix/hyper.cjs`: hypergeometric, 12 cards seen by turn 5 and 14 by turn 7. EDHREC figures come from `node data/review/scratch/g4-edhsum.cjs <theme>` and `g4fix/edh.cjs <theme>`: the sum of `num_decks / potential_decks` over the cards a theme page lists. A page lists 370 to 410 cards, which add up to 72 to 82 of a deck's 99 cards, so each figure is a lower bound, but not far off.

Counting. Table ranges are card copies, and each card counts once, for one job (section 6 of each style). Every job has a weight and a repeatable or one-shot label. A setup range also gives a weighted floor in brackets: copies times weight, added up. A deck meets a row only if it meets both, so a pile of one-shot or half-weight cards cannot fill it. Payoff ranges are copies; payoff weights decide which payoffs to keep first.

Sizes. A 20-card deck is a Jumpstart packet: "Half a deck with its own lands. Any two packets shuffle into a 40-card deck." (`config/deck-templates.json`). Its odds are worked out in the shuffled 40, where its theme shows less often, and its rows are set against the corpus Jumpstart packets of the theme.

### Landfall, Ramp, Tappers (g5)

Sources. Card quotes come from `npm run review:cards -- "<name>" --style <id> --json` (data pack 2026-11-03). Tag and text counts come from scratch scripts over `data/packs/cards.json`, un-set cards left out: `node data/review/scratch/g5-landsetup.ts`, `g5-landfall.ts`, `g5-ramp.ts`, `g5-tap.ts`, `g5-count.ts`, `g5-textall.ts`, `g5-overlap.ts`. The section 9 hints, run as written, come from `node data/review/scratch/g5fix/final.ts`; land recursion counts from `g5fix/landrec.ts`, cost reducers and cheats from `g5fix/reduce.ts`. Real-deck counts come from `node --max-old-space-size=4096 data/review/scratch/g5fix/corpus.ts <landfall|ramp> [name pattern] [size]`, which counts each corpus deck with the section 9 hints, and odds from `node data/review/scratch/g5fix/odds.cjs`. EDHREC figures come from `node data/review/scratch/g5-edhrec.ts <page> <style>`: the sum of num_decks / potential_decks over the cards a page lists. Unlisted cards are missing, so each is a lower bound on copies per deck. Weights are rough; a repeatable engine counts about twice a one-shot.

Patterns in section 9 are JavaScript regular expressions over oracle text with reminder text removed. They are case-sensitive; `m` marks the multiline flag.

### Group hug, Goad, and Energy (g6)

Three styles from `config/archetypes.json`: `groupHug`, `goad`, and `energy`.

Sources. Card text and matcher hits come from `npm run review:cards -- "<name>" --style <id>` and `--tag <tag> --limit 0 --json`, pack version 2026-11-03. Tag buckets and text checks come from scratch scripts in `data/review/scratch/` (gitignored): `g6-hug-buckets.mjs` and `g6-energy.mjs` over the `--tag` JSON, `g6-jobs.mjs` over `npm run review:cards -- --file <all of eval/pools> --style <id> --json`, and `g6-precons.mjs` for the Commander precons in `data/corpus/decks.json`. The part 9 regexes were tested with `node data/review/scratch/g6fix/rx2.mjs <hug|hugr|goad|goadr|nogoad|en|ex>` over the tag lists, public pool cards, and precon lists saved in `data/review/scratch/g6chk/`. Draw odds come from `node data/review/scratch/g6fix/hyper.mjs`. EDHREC figures are `num_decks / potential_decks` from `data/edhrec/pages/tags/{group-hug,forced-combat,energy}.json`. Rules come from `docs/rules/MagicCompRules.txt`.

60, 40, and 20-card decks are two-player games; only 100 is multiplayer. All three themes change meaning between the two, so each section says which size a rule is for.

**Counting rules for all three.** Count each card once, for the job part 6 gives it. The numbers in each part 7 table count copies, and a bracketed floor such as "4+ repeatable" counts copies of that kind. Weights from part 3 do not add up to the table numbers: weight 0 means the card does not count, 0.5 counts as half a copy, and 1 and 2 count as one copy each, with weight 2 marking the cards to pick first. So 4 repeatable and 2 one-shot setup cards are 6 copies, short of a floor of 10.

Drawing odds (hypergeometric, 12 cards seen by turn 5; chance to see at least one / at least two copies):

| Copies | 60 cards  | 40 cards  | 99 cards  |
| ------ | --------- | --------- | --------- |
| 2      | 36% / 4%  | 52% / 8%  | 23% / 1%  |
| 3      | 49% / 10% | 67% / 21% | 32% / 4%  |
| 4      | 60% / 18% | 78% / 35% | 41% / 7%  |
| 5      | 69% / 26% | 85% / 48% | 48% / 11% |
| 6      | 75% / 34% | 90% / 59% | 55% / 15% |
| 8      | 85% / 51% | 96% / 77% | 66% / 25% |
| 10     | 91% / 65% | 98% / 89% | 74% / 35% |
| 12     | 95% / 76% | 99% / 95% | 81% / 44% |

**20-card packets.** A packet holds about 8 lands and 12 spells, and it is shuffled into a 40-card deck with another packet that may not share its theme (SPEC.md, "Jumpstart packets"). So a packet's copies use the 40 column. The 20 rows ask the packet alone to show setup by turn 5 in about three games in four (4 copies 78%, 5 copies 85%) and a payoff in about two games in three (3 copies 67%). That is looser than the 60 and 40 rows (about 90%), because the same 12 spells must also hold interaction. Two packets with the same theme reach the 40 row.

### The plain shapes (g7)

Aggro, Midrange, and Control are `composition` styles in `config/archetypes.json`. They have no enabler or payoff matchers and no resource to build up and spend, so this part of the theme guide answers a different question: what makes a plain deck of bulk cards decent?

Sources. Card facts and quotes come from `npm run review:cards -- "<name>" --json`. Counts of cards behind each role gap come from `node data/review/scratch/g7-gaps.mjs`, a scratch script over `data/packs/cards.json` that mirrors the removal and cheap interaction clauses in `config/roles.json`, and from `node data/review/scratch/g7fix.mjs` (output `g7fix.txt`), which also gives exact drawing odds. Hint tests come from `g7fix-removal.mjs` and `g7fix-value.mjs`, and color sources from `node data/review/scratch/g7fix-sources.ts`, which calls the core's own `sourcesNeeded`. Named precons are measured with `node data/review/scratch/g7c-decks.mjs <deck ids>` and `node data/review/scratch/g7fix-decks.mjs <deck ids>` (outputs `g7fix-c-decks.txt` and `g7fix-decks.txt`). All scratch files are in `data/review/scratch/`. Live numbers come from `config/deck-templates.json`, `config/curve-profiles.json`, and the shape entries in `config/archetypes.json`. Curve counts are nonland spells at each mana value, as the curve profiles count them.

Real decks. The plan profiles in `config/learned/plans.json` (medians, turned into card counts with 35, 23, 12, and 61 spell slots) do not describe real Aggro or Control decks. The learner gives a deck a shape only when it matches no theme, and then picks the shape whose curve profile sits closest to the deck's curve (`shapeOf` in `packages/pipeline/src/plans.ts`). It never looks at counters, sweepers, or card draw. So the 27 decks behind the 60-card `control` profile are high-curve decks such as Wild Rush, Dino Might, and Selesnya Conclave, and the 43 behind the 100-card one include Party Time, Eldrazi Unbound, and Merciless Rage. The named Azorius Control (Q05) is labeled `enchantments` and Dimir Control (Q08) `graveyard` (`node data/review/scratch/g7c-shapes.ts`, output `g7fix-shapes.txt`). This guide reads the profiles only as "unthemed decks with this curve", which suits Midrange, and leans on named precons for Aggro and Control:

- Aggro: Mono-Red Aggro (Challenger Q05), Mono White Aggro (Q07), Hazoret Aggro (Q01), Lightning Aggro (Q02).
- Control: Azorius Control (Q05), Dimir Control (Q07, and the Pioneer Challenger Q08), Second Sun Control (Q01), Control Center (Arena Starter Deck, AFR), Gabriel Nassif's Blue-White Anti-Affinity Control (World Championship 2004), and the Commander deck Seize Control (C15).

Named precons are tuned and hold many rares, so they are evidence of what works, not a target.
