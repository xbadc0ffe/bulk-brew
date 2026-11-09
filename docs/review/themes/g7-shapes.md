# Theme guide: the plain shapes

Aggro, Midrange, and Control are `composition` styles in `config/archetypes.json`. They have no enabler or payoff matchers and no resource to build up and spend, so this part of the theme guide answers a different question: what makes a plain deck of bulk cards decent?

Sources. Card facts and quotes come from `npm run review:cards -- "<name>" --json`. Counts of cards behind each role gap come from `node data/review/scratch/g7-gaps.mjs`, a scratch script over `data/packs/cards.json` that mirrors the removal and cheap interaction clauses in `config/roles.json`, and from `node data/review/scratch/g7fix.mjs` (output `g7fix.txt`), which also gives exact drawing odds. Hint tests come from `g7fix-removal.mjs` and `g7fix-value.mjs`, and color sources from `node data/review/scratch/g7fix-sources.ts`, which calls the core's own `sourcesNeeded`. Named precons are measured with `node data/review/scratch/g7c-decks.mjs <deck ids>` and `node data/review/scratch/g7fix-decks.mjs <deck ids>` (outputs `g7fix-c-decks.txt` and `g7fix-decks.txt`). All scratch files are in `data/review/scratch/`. Live numbers come from `config/deck-templates.json`, `config/curve-profiles.json`, and the shape entries in `config/archetypes.json`. Curve counts are nonland spells at each mana value, as the curve profiles count them.

Real decks. The plan profiles in `config/learned/plans.json` (medians, turned into card counts with 35, 23, 12, and 61 spell slots) do not describe real Aggro or Control decks. The learner gives a deck a shape only when it matches no theme, and then picks the shape whose curve profile sits closest to the deck's curve (`shapeOf` in `packages/pipeline/src/plans.ts`). It never looks at counters, sweepers, or card draw. So the 27 decks behind the 60-card `control` profile are high-curve decks such as Wild Rush, Dino Might, and Selesnya Conclave, and the 43 behind the 100-card one include Party Time, Eldrazi Unbound, and Merciless Rage. The named Azorius Control (Q05) is labeled `enchantments` and Dimir Control (Q08) `graveyard` (`node data/review/scratch/g7c-shapes.ts`, output `g7fix-shapes.txt`). This guide reads the profiles only as "unthemed decks with this curve", which suits Midrange, and leans on named precons for Aggro and Control:

- Aggro: Mono-Red Aggro (Challenger Q05), Mono White Aggro (Q07), Hazoret Aggro (Q01), Lightning Aggro (Q02).
- Control: Azorius Control (Q05), Dimir Control (Q07, and the Pioneer Challenger Q08), Second Sun Control (Q01), Control Center (Arena Starter Deck, AFR), Gabriel Nassif's Blue-White Anti-Affinity Control (World Championship 2004), and the Commander deck Seize Control (C15).

Named precons are tuned and hold many rares, so they are evidence of what works, not a target.

### Judging a plain deck

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

### Aggro (aggro)

**1. Plan.** Play cheap creatures from the first turns, clear or get past blockers, and finish with burn or flyers before the opponent's bigger cards take over.

**2. What it needs.**

- **Attackers at one to three mana.** Power at least equal to mana value, or a keyword that helps attacking: haste, first strike, flying, menace, prowess, an attack trigger. Savannah Lions: a 2/1 for {W} with no text. Raging Goblin: "Haste". Borderland Marauder: "Whenever this creature attacks, it gets +2/+0 until end of turn."
- **A few pump and evasion effects.** "Gets +N/+N", "creatures you control get", "can't block". Brute Force: "Target creature gets +3/+3 until end of turn." Falter: "Creatures without flying can't block this turn."
- **Cheap removal for blockers.** One or two mana, and it must hit a creature. Shock: "deals 2 damage to any target". Disfigure: "Target creature gets -2/-2 until end of turn." Journey to Nowhere: "exile target creature".
- **Reach.** Cheap burn that can hit a player, evasive bodies, or team pump. Lightning Bolt: "deals 3 damage to any target". Suntail Hawk: a 1/1 for {W} with "Flying".

**3. False friends.**

- Five-mana 3/3s: Battle Hurda ({4}{W}, "First strike"), Venser's Sliver ({5}, no text). Bad-rate vanillas such as Gray Ogre ({2}{R} 2/2, no text).
- Creatures that cannot attack. Wall of Wood: "Defender (This creature can't attack.)" The live early creature role counts it.
- Defensive cards. Accorder's Shield: "Equipped creature gets +0/+3 and has vigilance."
- Sweepers that hit both sides. Pyroclasm: "deals 2 damage to each creature".
- Lava Axe ({4}{R}): "deals 5 damage to target player or planeswalker". Late, and useless against a blocker, yet the live removal role counts it.

**4. Enough for a decent bulk deck.**

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

**5. Where the live templates differ.**

- The `aggro` curve profile and the land formula (about 24 lands at an average cost of 2.4) fit.
- Removal 3/5 (min/target) at 60 and 2/4 at 40 is low. Unthemed decks with an aggro curve play a median 7 and 5, the named aggro decks 6 to 19 removal that hits creatures, and cheap burn is removal and reach. Set 5/7 and 3/5, counting only cards that hit creatures.
- `finisher` min 1 asks for a four-mana body with four power. Aggro wins with reach; count that instead.
- `earlyCreature` counts walls, so the 10/14 quota can be met by creatures that cannot attack.
- At 100 aggro has no overrides: it inherits sweeper min 1, which kills its own board, and the Commander curve, about 9 cards at six or more. Add overrides with sweeper 0 and a lower curve.

**6. Matcher hints.**

- Attacker: creature, mana value 3 or less, no `Defender` keyword, and power at least its mana value or a keyword in Haste, First strike, Double strike, Flying, Menace, Prowess, or the tag `attack-trigger`. Needs code twice. Matchers have no power condition. They also cannot exclude a keyword (`anyKeywords` only requires one), and no `defender` tag exists. `excludeTags: ["drawback"]` drops 309 of 310 Defender creatures but also 603 cheap creatures with other drawbacks, and `excludeTypeLine: ["Wall"]` misses the 154 Defender creatures that are not Walls (`g7fix.txt`). A keyword exclusion in the matcher schema is a config format change, which needs the owner's approval.
- Vanillas: test for empty oracle text, not for no tags. Savannah Lions has no tags, but Gray Ogre carries `cycle-lea-red-escalate` and Craw Wurm `meme`. The strength part "stats for its cost" judges them.
- Pump: `giant-growth` or `enlarge` (471 cards; Brute Force has both). Not `combat-trick`, which also covers removal and life tricks: Disfigure ("Target creature gets -2/-2 until end of turn.") and Healing Salve carry it, and 160 of its 1,384 cards give -N by the text test `gets? -\d`. Team pump: `power-boost-to-all`, `trumpet-blast`, `anthem`, `overrun`. Evasion: `gives-evasion`, `prevent-blocker`, `prevent-mass-blockers`.
- Reach: `burn-player` without `sweeper`, noncreature, `maxMv: 3` (537 cards). The cap drops Lava Axe and the other 178 noncreature matches at five or more, such as Aether Charge and Arc Blade. Add the derived `evasiveCreature` at mana value 4 or less, and team pump.
- Exclude: `Defender` (needs code, as above), `fog`, `sweeper` without `sweeper-one-sided` (Pyroclasm has no `symmetrical` tag), and creatures at mana value 5 or more with power 3 or less (needs code: no power test).

### Midrange (midrange)

**1. Plan.** Trade well early with creatures that bring extra value, remove the opponent's best threats, then win with a few bigger threats the opponent cannot match.

**2. What it needs.**

- **Efficient creatures with value.** Good stats for the cost, or a body plus "When this creature enters, draw a card", "destroy", or "return". Watchwolf (uncommon): a 3/3 for {G}{W} with no text. Thraben Inspector: "When this creature enters, investigate." Man-o'-War: "When this creature enters, return target creature to its owner's hand."
- **Removal.** Unconditional or close: "Destroy target creature", "exile target creature", damage to any target, "-N/-N", "can't attack or block", fight. Murder: "Destroy target creature." Doom Blade: "Destroy target nonblack creature." Prey Upon: "Target creature you control fights target creature you don't control."
- **A little card advantage.** Cards that net a card. Night's Whisper: "You draw two cards and lose 2 life." Divination: "Draw two cards." Mulldrifter: "When this creature enters, draw two cards."
- **A top end that wins.** Four to six mana threats that beat bulk blockers: four or more power with flying, trample, haste, or an enters effect. Serra Angel: a 4/4 for five with "Flying" and "Vigilance". Charging Monstrosaur (uncommon): a 5/5 with "Trample, haste".

**3. False friends.**

- Big vanillas at a poor rate. Craw Wurm ({4}{G}{G} 6/4, no text) counts as a big threat today. Hill Giant ({3}{R} 3/3, no text) is filler.
- Color hosers. Pyroblast: "Counter target spell if it's blue" or "Destroy target permanent if it's blue". It scores 9.37, above every other card checked here (Lightning Bolt: 7.89), and counts as removal and cheap interaction, yet it is blank against most opponents. Circle of Protection: Red ("a red source of your choice") is just as narrow for a judge, but it meets no live role and scores 4.05, so the builder has no reason to pick it.
- Removal that cannot hit a creature. Lava Spike: "deals 3 damage to target player or planeswalker". It meets the live removal role.
- Bounce counted as removal. Unsummon: "Return target creature to its owner's hand." It meets `removal` and `cheapInteraction` at strength 7.73, above Murder (7.05), because bounce cards carry `removal-creature`. A bounce spell spends a card to delay one threat. 217 noncreature cards meet the removal role through bounce alone (`g7fix-removal.txt`). Bounce on a body is fine: Man-o'-War is a value creature, not removal.
- Narrow removal that is not color hate. Plummet: "Destroy target creature with flying." It meets `removal` and `cheapInteraction` at strength 6.8, and it is not `single-minded-color-hate`, so dropping that tag keeps it. 105 removal-role cards carry `hate-flying`. One is fine; it does not count as unconditional removal.
- Many combat tricks. Giant Growth ("Target creature gets +3/+3 until end of turn.") is fine as one or two, but tricks are not removal.

**4. Enough for a decent bulk deck.**

| Size | Lands    | Creatures | Removal                  | Card advantage         | Top end | Curve 1 / 2 / 3 / 4 / 5+           |
| ---- | -------- | --------- | ------------------------ | ---------------------- | ------- | ---------------------------------- |
| 60   | 24 to 25 | 18 to 24  | 6 to 9                   | 3 to 5                 | 3 to 5  | 2-4 / 10-12 / 8-10 / 5-7 / 4-6     |
| 40   | 17       | 14 to 17  | 4 to 6                   | 2 to 3                 | 2 to 4  | 1-3 / 6-8 / 5-6 / 3-4 / 2-4        |
| 20   | 8        | 7 to 9    | 2 to 3                   | 1                      | 1 to 2  | 1-2 / 3-4 / 3 / 2 / 1-2            |
| 100  | 36 to 38 | 26 to 32  | 8 to 10, 1 to 2 sweepers | 10 to 14, ramp 8 to 10 | 4 to 6  | 3-5 / 13-17 / 14-17 / 9-12 / 10-14 |

A way to win is the top end: three to five threats at 60 that a bulk creature cannot block well. Reasoning: unthemed decks with a midrange curve (the learner's `midrange` profile, 79 decks at 60) sit close to these numbers (removal 7, early creatures 8 or 9, about 23 creatures, 25 lands at 60); bulk midrange fails on card quality, not counts. Count only removal that meets the removal hint below.

Colors. Two colors work. At 60, 13 sources of the main color cast its two-drops at 90%, and 11 of the second cast one-pip two-drops at 85% (9 and 8 at 40). Keep two-pip cards in the main color, at three mana or more (16 to 17 sources).

**5. Where the live templates differ.**

- Midrange is the template default, and its counts sit near real decks. The gaps are in what counts.
- The removal quota accepts face-only burn (166 cards meet the removal role with no `removal-creature` tag), color hosers (58 cards tagged `single-minded-color-hate` meet removal or cheap interaction), bounce alone (217 noncreature cards), and flyer-only removal (68 noncreature removal-role cards with `hate-flying`).
- `finisher` accepts expensive vanillas. Prefer evasion, trample, haste, or value.
- `cardAdvantage` counts noncreature cantrips, which only replace themselves, the same as draw-two spells.
- At 100 the template asks removal 6/8 and card advantage 8/12. The 8 unthemed Commander decks with a midrange curve play about 10 and 16. Raise the targets to 9 and 14.

**6. Matcher hints.**

- Value creature: a creature whose own enters trigger draws, investigates, removes, or returns a card. Needs code: matchers have no text test. Test each line of the text, with reminder text stripped, against `^When(ever)? (this creature|[A-Z][^,.]*?) enters[^,.]*?, (you may )?(draw|investigate|destroy|exile|return|target player draws|it deals \d+ damage to (any target|target creature)|target creature (an opponent controls )?gets -)`, and drop cards that match `return (a|another|target) [^.]*?you control to its owner's hand`. It finds 642 creatures (`g7fix-value.txt`): Thraben Inspector, Man-o'-War, Mulldrifter, Ravenous Chupacabra, Gravedigger, Aven Interrupter, and Annex Sentry pass. Kor Skyfisher ("return a permanent you control to its owner's hand"), Bloated Toad, and Avian Oddity fail.
- The tag version is looser. `virtual-vanilla` or `virtual-french-vanilla` plus `pure-draw`, `removal-creature`, or `recursion-creature` matches 663 cards: 21 are not creatures (Carrion Cruiser, Fell Gravship), and 56 creatures have no enters, dies, or leaves trigger (Bloated Toad and Avian Oddity, through cycling). It also misses 226 creatures the text test finds. If used, add `types: ["creature"]`.
- Gravedigger meets both and is also a light Graveyard payoff (0.5 in the Graveyard guide). That is fine in a plain deck, because the failed-theme check in "Judging a plain deck" runs first.
- Efficient body: power plus toughness at least twice the mana value at three mana or less, power 1 or more, and no `Defender`. Needs code: no power or toughness test and no keyword exclusion. Without the Defender test, 157 Defender creatures at three or less pass; Wall of Wood (0/3 for {G}) scores 3 against a bar of 2.
- Top end: derived `finisher` with `evasiveCreature`, Trample, Haste, or the enters test above; rank a vanilla `finisher` last. Of 3,234 creatures at four to six mana with power 4 or more, 1,319 have Flying, Trample, Haste, Menace, or the enters test.
- Removal: two clauses, so bounce counts only next to another kind of removal. First `{ allTags: ["removal-creature"], excludeTags: ["removal-bounce", "sweeper", "single-minded-color-hate"] }`; then `{ allTags: ["removal-creature", "removal-bounce"], anyTags: ["removal-destroy", "removal-exile", "removal-burn", "removal-toughness", "removal-sacrifice", "removal-fight", "removal-tuck", "pacifism", "lockdown"], excludeTags: ["sweeper", "single-minded-color-hate"] }`. It keeps Murder, Doom Blade, Pacifism, Claustrophobia, Journey to Nowhere, Prey Upon, and Disfigure, and drops Unsummon, Pyroblast, Lava Spike, and all 217 bounce-only cards. It keeps Plummet, so rank cards with `hate-flying` (67 noncreature matches) below unconditional removal and count at most two.

### Control (control)

**1. Plan.** Answer threats one at a time or several at once, draw more cards than the opponent, and win late with a few finishers.

**2. What it needs.**

- **Interaction to survive.** Spot removal, counterspells in blue, and blockers. Doom Blade: "Destroy target nonblack creature." Counterspell: "Counter target spell." for {U}{U}. Wall of Omens (uncommon): a 0/4 with "Defender" and "When this creature enters, draw a card."
- **Card advantage.** Cards that net a card, or a body plus a card. Compulsive Research: "Target player draws three cards. Then that player discards two cards unless they discard a land card." Phyrexian Rager: "you draw a card and you lose 1 life".
- **Sweepers where the colors allow.** "Each creature", "All creatures get -N/-N". One-color common and uncommon sweepers are mostly black (88) and red (100). White has 7 and blue 8; white's are mostly rare (131 rare or mythic). Green has 20, but 17 hit only flyers, such as Hurricane. Drown in Sorrow: "All creatures get -2/-2 until end of turn." Electrickery: "deals 1 damage to target creature you don't control", with overload for each one.
- **A few finishers.** Threats that win alone once the board is clear, ideally flyers. Air Elemental (uncommon): a 4/4 for five with "Flying". Serra Angel: "Flying" and "Vigilance", so it attacks and still blocks.

**3. False friends.**

- Cheap attackers with no late use: Goblin Piker ({1}{R} 2/1, no text).
- Fog: "Prevent all combat damage that would be dealt this turn." One turn for one card.
- Life with no card. Healing Salve: "Target player gains 3 life". It counts as cheap interaction today, through its `combat-trick` tag. Of the 54 cheap-interaction cards that gain life and carry no removal tag, 22 are life or prevention alone like it (Healing Grace, Candles' Glow). The other 32 are pump tricks with a lifelink or life rider, such as Give In to Violence ("Target creature gets +2/+2 and gains lifelink until end of turn.").
- Bounce and narrow removal, as in Midrange. Unsummon spends a card to delay one threat, which costs Control the card it is trying to gain. Plummet answers only flyers.
- Narrow hosers. Deathgrip: "{B}{B}: Counter target green spell."
- Expensive vanillas. Enormous Baloth ({6}{G} 7/7, no text) can be chump-blocked each turn.
- Noncreature cantrips. Opt ("Scry 1." and "Draw a card.") nets no card.

**4. Enough for a decent bulk deck.**

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

**5. Where the live templates differ.**

- Sweeper min 1 at 60 marks Control not viable in a pool with no sweeper, likely in white, blue, or green pools, whose one-color common and uncommon sweepers number 7, 8, and 20 (17 of green's hit only flyers). A white pool with rares may have one. Make it min 0, target 2, in black and red.
- Of 420 noncreature counterspells (Un-sets removed), 231 cost three or more. 207 of those miss the removal role, and 166 meet no role at all, Cancel ("Counter target spell.") among them. The other 41 count through `cardAdvantage` (39, such as Contradict: "Counter target spell." and "Draw a card."), `ramp` (1), or `sweeper` (1). Source: `node packages/pipeline/src/review/cards.ts --tag counterspell --limit 0 --json`, saved as `g7fix-counter.json`. Count counters up to three mana as interaction.
- The 50% creature cap (about 17, 11, and 6) fits the named decks, which play 1 to 16. Keep it. A higher cap overlaps Midrange's live floor (55% at 60, 50% at 40), the style mix the owner treats as a blocker. What the creatures do matters more: prefer the defensive bodies and bodies that draw in the hints.
- The curve puts about 6 cards at six or more at 60 (16% of 35); the named control decks play 3 to 7, median 4. Move share from 7+ to three and four.
- The land formula gives about 27 at the profile's average cost of 3.7; the named control decks play 25 to 28, so it fits.
- `cardAdvantage` 4/7 can be met with cantrips.
- At 100 Control has no overrides and takes the template's removal 6/8, sweeper 1/3, and card advantage 8/12, the same as Midrange. Seize Control plays 7 removal, 4 sweepers, and 15 net card advantage. Add 7/10, 2/4, and 10/14, a first guess from one named deck.

**6. Matcher hints.**

- Interaction: removal by the Midrange removal hint (no bounce alone, no `single-minded-color-hate`), noncreature `counterspell` up to mana value 3, and `sweeper` with `removal-creature`.
- Net card advantage: `burst-draw`, `draw-engine`, `repeatable-card-advantage`, or `pure-draw` without `cantrip`. A `cantrip` counts in full on a creature (Wall of Omens), half on an instant or sorcery.
- Defensive body: `Defender` with toughness 4 or more, or `freeze`, `damage-prevention-self`, or `Lifelink`. Toughness needs code.
- Finisher: derived `finisher` with `evasiveCreature`, or a planeswalker; `commanderFinisher` at 100.
- Exclude: `fog`. Life tricks need no exclusion: the interaction hint above never counts `combat-trick` or `lifegain`, so Healing Salve is already out.
