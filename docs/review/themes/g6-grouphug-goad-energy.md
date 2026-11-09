# Theme guide: Group hug, Goad, and Energy

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

### Group hug (groupHug)

**1. Plan.** At 60, 40, and 20: make both players draw more, and hurt the opponent for each card drawn or held. At 100: give everyone cards and lands so nobody attacks you, with cards that give you more than each opponent.

**2. Builds up and spends.** Extra cards the opponent draws (unit: one card) and cards in the opponent's hand; at 100, also lands and mana given away. In a two-player game a gift with no punisher only helps the opponent.

**3. Setup jobs.**

- **Repeatable symmetric draw** (weight 2): a trigger, an activated ability with any cost ({T} or mana), or an extra draw in each draw step. Howling Golem (c): "Whenever this creature attacks or blocks, each player draws a card." Sky Crier (c): "{3}{W}: You and target opponent each draw a card." Diviner Spirit (u): "Whenever this creature deals combat damage to a player, you and that player each draw that many cards." Of the 66 repeatable draw gifts among the 432 tagged cards, only 8 are common or uncommon.
- **One-shot draw gifts** (weight 1). Vision Skeins (c): "Each player draws two cards." Soaring Show-Off (c): "When this creature enters, each player draws a card." Two-player wordings count too: Huddle Up (c), "Two target players each draw a card."; Clockwork Fox (c), "you draw two cards and each opponent draws a card"; Bargain (u), "Target opponent draws a card." With a punisher out, these are the best setup at two players.
- **Flexible draw** (weight 0.5). "Target player draws" goes to whoever you pick, so it is a gift only when a punisher is out. Limestone Golem (u): "{2}, Sacrifice this creature: Target player draws a card."
- **Land and mana gifts** (weight 1 at 100, 0 below). Jungle Wayfinder (c): "each player may search their library for a basic land card". Spectral Searchlight (c): "Choose a player. That player adds one mana". Tempt with Discovery (u) gives you an extra land for each opponent who takes one ("For each opponent who searches a library this way, search your library for a land card"), but that reward follows only its own gift, so it is setup here (part 6).

**4. Payoff jobs.**

- **Draw punishers**, repeatable. Underworld Dreams (u) and Ob Nixilis, the Hate-Twisted (u): "Whenever an opponent draws a card, [it] deals 1 damage to that player." Other wordings: Spiteful Visions (r), "Whenever a player draws a card, this enchantment deals 1 damage to that player."; Curse of Fool's Wisdom (r), "Whenever enchanted player draws a card, they lose 2 life and you gain 2 life." One punisher with one repeatable setup card out deals about 2 damage a turn (the normal draw plus one extra), so a lone punisher needs about ten turns; full-hand burn and creatures finish. With 4 punishers in 60, one shows by turn 5 in 60% of games and two in only 18%, so plan around one live punisher, not two.
- **Full-hand burn**. Sudden Impact and Storm Seeker (u), one-shot: "equal to the number of cards in that player's hand." Black Vise (u), repeatable: "the number of cards in their hand minus 4." Threshold punishers are repeatable too: Misers' Cage (r), "if that player has five or more cards in hand, this artifact deals 2 damage to that player"; Ebony Owl Netsuke (u) needs seven. All of them need the opponent at 5+ cards first.
- **Draw rewards**, best at 100. Smothering Tithe (r): "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token." It pays off every opponent draw, not only its own gift, so it is a payoff (part 6).

**5. False friends.** Checked tag-listed cards:

- Gift riders: Long River's Pull (u) and Nocturnal Hunger (c) carry both hug tags but are a counterspell and removal ("Gift a card", "Gift a Food"). 24 of the 432 tagged cards are Gift cards.
- Mana riders: An Offer You Can't Refuse (c) carries `donate-mana` but is a counterspell: "Counter target noncreature spell. Its controller creates two Treasure tokens."
- Life for the opponent: Skyshroud Cutter ("you may have each other player gain 5 life") and Fall to Earth ("Exile target creature. Each player gains 3 life.") feed the opponent, not a punisher.
- Costs: Nullmage Advocate's Naturalize costs "Return two target cards from an opponent's graveyard to their hand."
- Draw stax under `draw-hate`: Spirit of the Labyrinth ("Each player can't draw more than one card each turn") stops the setup yet counts as a payoff.

**6. Both jobs.** Payoff if the reward triggers on any opponent draw or hand size: Scrawling Crawler (r), "each player draws a card. Whenever an opponent draws a card, that player loses 1 life."; Spiteful Visions, whose damage fires on every draw, not only on its own extra card. Setup if it rewards only its own gift: Words of Wisdom (c), "You draw two cards, then each other player draws a card."; Tempt with Discovery.

**7. Enough.**

| Size | Setup                                       | Payoffs               | Also                               |
| ---- | ------------------------------------------- | --------------------- | ---------------------------------- |
| 60   | 10 (4+ repeatable)                          | 6 to 8 (4+ punishers) | 6 to 8 interaction, tough blockers |
| 40   | 6 to 7                                      | 4 to 5                | 4 to 5 interaction                 |
| 20   | 4 to 5                                      | 3 (2+ punishers)      | 2 interaction                      |
| 100  | 10 to 14 (6+ repeatable), hugging commander | 6 to 10               | 5+ protection                      |

Reasoning: 10 setup copies show one by turn 5 in 91% of games, 7 payoffs in 81%. Punishers are the scarce part: 4 in 60 show one by turn 5 in 60% of games, so full-hand burn fills the rest of the payoff count. At 20, a packet with no punisher only feeds the opponent (part 2), so it needs 2 punishers or group hug is not offered at 20; 3 payoffs in the 40-card deck show one by turn 5 in 67% of games. At 100, the part 9 rules find 14 setup cards in Peace Offering (7 repeatable) and 9 in Stalwart Unity (5 repeatable; Gwafa Hazid and Humble Defector, two gifts the regexes miss, make 11). Each precon's commander gives cards every turn: Ms. Bumbleflower ("Whenever you cast a spell, target opponent draws a card") and Kynaios and Tiro ("each opponent who didn't draws a card"). The live matcher's 18 and 15 enabler hits for these precons also count 5 Gift cards (Peace Offering) and Akroan Horse, Orzhov Advokist, Evolutionary Escalation, and Forbidden Orchard (Stalwart Unity). 12 setup copies in 99 show one by turn 5 in 81% of games, and the commander is there every game; without a hugging commander, use the top of the range. On EDHREC, Howling Mine ("that player draws an additional card") is in 38% of 20,825 group hug decks. The public pools hold two punishers (Kederekt Parasite, Underworld Dreams) and 10 draw gifts (7 repeatable) in 2,455 cards, so offer the style only with 4+ real payoffs, and at 20 only with 2 punishers.

**8. Where the live matchers differ.**

- Enabler #1 (`anyTags group-hug|selective-group-hug`) is too broad. Of 432 cards, the part 9 rules find 122 draw gifts (66 repeatable), 10 flexible draws, and 27 land or mana gifts; 47 are Gift riders, costs, draw stax, or life gifts; 226 do other things. About 10 of 25 hits in the public pools give cards.
- Payoff #1 (`anyTags draw-hate`) counts draw stax and misses full-hand burn (`hate-full-hand`). Both precons have zero payoff hits in their 99. Scrawling Crawler counts as both.
- No size check: land and mana gifts count at 60.

**9. Matcher hints.** Test each ability line (split on newlines, flag `m`).

- Giver `G`: `(each player|each other player|each opponent|target opponent|(up to )?two target players|any number of target opponents|you and (target|that|another target|defending) (opponent|player)|defending player)`. Draw `D`: `\bG\b(?:(?!\byou\b)[^.]){0,60}?\b(may )?(each )?draws?\b(?! step)`. The gap stops at a period and at "you", so "each opponent discards a card. For each opponent who can't, you draw a card" is not a gift, and `(?! step)` skips "each player's draw step".
- Repeatable setup: `D` on a trigger line starting `^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)`, where "that player" also counts as a giver; or `D` on an activated line `^([^\n\u2014]*\u2014 )?(?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*:` with any cost; or `/\b(that|each) player draws (an|\w+) additional cards?/i`. This finds Sky Crier, Font of Mythos ("that player draws two additional cards"), Kwain ("{T}: Each player may draw a card"), Temple Bell, and Howling Mine.
- One-shot setup: any other `D` (Huddle Up, Clockwork Fox, Cut a Deal, Bargain). Flexible: `/\btarget player (may )?draws?\b/i`, weight 0.5 (Limestone Golem).
- Land and mana gifts, weight 1 at 100 and 0 at 60/40/20: `/\b(each player|each opponent|each other player|target opponent|that player)\b[^.]{0,30}?\b(may )?(search(es)? their library for [^.]*land|put (a|up to \w+) land cards? from their hand onto the battlefield|play an additional land)|\b(each player|that player|target opponent) adds\b|\b(each player|each opponent|target opponent|you and target opponent)( each)? creates? (a|an|\w+) Treasure|\blands tap for an additional/i`. Read the text, not the `donate-mana` and `donate-rampant-growth` tags: Jungle Wayfinder has neither tag, and An Offer You Can't Refuse has `donate-mana`.
- Not setup, checked first: `/\bGift an? |cumulative upkeep|rather than pay this spell's mana cost, you may have|from an opponent's graveyard to their hand|can't draw|skips? (their|that|your) draw/i`. Life gifts, `/(player|opponent) gains? \d+ life/i`, are not setup unless `D` also matches.
- Payoff: `/whenever (an opponent|a player|enchanted (player|opponent)) draws (a|their \w+) card[^.]*(damage|loses? \d+ life|you (may )?(draw|gain)|create|may pay \{\d\})/i`. It matches 27 cards in the pack, including Spiteful Visions, Phyrexian Tyranny, and Curse of Fool's Wisdom; only Underworld Dreams and Ob Nixilis, the Hate-Twisted are below rare. Hand size: `/(for each card in|number of cards in) (that player's|their|target opponent's|defending player's|enchanted player's|the chosen player's) hand|\b(that|the) player (is your opponent and )?has \w+ or more cards in hand[^.]*(damage|loses? \d+ life)/i`. It matches 32 of the 60 `hate-full-hand` cards, up from 22, including Fevered Visions, Misers' Cage, and Ebony Owl Netsuke.
- Exclude: `/can't draw (more than one card|cards)|skips that draw|\d minus the number of cards/i`.

### Goad (goad)

**1. Plan.** At 60, 40, and 20: force the opponent's creatures to attack into my blockers, drain them for it, and swing past the ones left tapped. At 100: make opponents' creatures attack each other.

**2. Builds up and spends.** Forced attacks by opposing creatures; unit: one creature forced to attack for one turn. A goaded creature "attacks each combat if able and attacks a player other than [you] if able" (rule 701.15b). With one opponent it attacks you and stays tapped through your turn.

**3. Setup jobs.**

- **Repeatable or lasting** (weight 2). Taunting Kobold (u): "Whenever this creature attacks, goad target creature an opponent controls." Courtly Provocateur (u): "{T}: Target creature attacks this turn if able." Most forced attacks in bulk do not say "goad": Alluring Siren (u), "{T}: Target creature an opponent controls attacks you this turn if able."; Curse of the Nightly Hunt (u), "Creatures enchanted player controls attack each combat if able."; Trove of Temptation (u), "Each opponent must attack you or a planeswalker you control with at least one creature each combat if able."
- **Pump and goad** (weight 2 at 100; weight 1 at 60/40/20, and outside the lasting floor there). Shiny Impetus (c): "Enchanted creature gets +2/+2 and is goaded." Bloodthirsty Blade (u): "Equipped creature gets +2/+0 and is goaded." At two players there is no "player other than" you to attack (rule 701.15b), so a goaded creature attacks you, and these cards send it in bigger, against the blockers the plan relies on. It does stay tapped on your turn. Put it on a creature your blockers still beat.
- **One-shot** (weight 1). Jeering Homunculus (c): "When this creature enters, you may goad target creature", on a 0/4 body. Coronation of Chaos (c): "Up to three target creatures can't block this turn. Goad them." Imaginary Threats (u): "Creatures target opponent controls attack this turn if able. During that player's next untap step, creatures they control don't untap." Incite War (c), one mode: "Creatures target player controls attack this turn if able."
- **Symmetric** (weight 1 at 100, 0.5 at 60/40/20). Grand Melee (r): "All creatures attack each combat if able." At two players it forces your creatures to attack too.

**4. Payoff jobs.**

- **Attack drains**, repeatable. Revenge of Ravens (u): "Whenever a creature attacks you..., that creature's controller loses 1 life and you gain 1 life." Hissing Miasma (u): "Whenever a creature attacks you, its controller loses 1 life." Each wants about one forced attacker a turn.
- **Punish triggers.** Kardur, Doomscourge (u): "Whenever an attacking creature dies, each opponent loses 1 life and you gain 1 life." Vengeful Ancestor (r): "Whenever a goaded creature attacks, it deals 1 damage to its controller."
- **Tap and attack punishers**, repeatable Auras for an opposing creature that another card forces to attack. Insolence (c): "Whenever enchanted creature becomes tapped, this Aura deals 2 damage to that creature's controller." Sinister Possession (c): "Whenever enchanted creature attacks or blocks, its controller loses 2 life." Seizures (c) deals 3 "unless that player pays {3}".
- At two players, blockers do half the work: a forced 2/2 into a 0/4 only costs a turn. Deathtouch, first strike, and toughness 4+ creatures are support.

**5. False friends.** Checked:

- Self-forcing under `force-attacker`: Hellraiser Goblin ("Creatures you control have haste and attack each combat if able"), Uncontrollable Anger ("gets +2/+2 and attacks each combat if able", a friendly Aura).
- One-turn tricks: Boiling Blood ("Target creature attacks this turn if able. Draw a card."), half weight.
- `attacking-opponents-matters` at 60/40/20: Gahiji, Honored One ("Whenever a creature attacks one of your opponents... gets +2/+0") pumps only your own attackers there; Martial Impetus's rider ("each other creature that's attacking one of your opponents gets +1/+1") does nothing.
- Attack taxes: a creature that "can't attack unless a player pays a cost" need not pay (rule 508.1d), so Propaganda ("Creatures can't attack you unless their controller pays {2}") turns goad off at two players.

**6. Both jobs.** Count what the card does every turn. Setup if the reward follows only its own target: Bothersome Quasit ("Whenever you cast a noncreature spell, goad target creature an opponent controls"); the Impetus Auras, including Parasitic Impetus ("Whenever enchanted creature attacks, its controller loses 2 life and you gain 2 life"); and Lust for War, which forces the creature it enchants and deals 3 "Whenever enchanted creature becomes tapped". Their drain makes them self-contained, which suits packets, but it rewards no other card's forced attack, so they never count as payoffs. Payoff if the goad is one-time and the lasting text rewards (Kardur), or the reward fires on any goaded or forced creature (Vengeful Ancestor, Insolence).

**7. Enough.**

| Size | Setup                                    | Payoffs | Also                         |
| ---- | ---------------------------------------- | ------- | ---------------------------- |
| 60   | 10 to 12 (6+ lasting, not pump and goad) | 4 to 6  | 8+ good blockers, 4+ removal |
| 40   | 7 to 8                                   | 3 to 4  | 6+ good blockers             |
| 20   | 5, also bodies                           | 2 to 3  | 3+ good blockers             |
| 100  | 15 to 20 (10+ lasting)                   | 5 to 8  | 3 to 5 attack taxes          |

Reasoning: 12 setup copies show one by turn 5 in 95% of games but 5 payoffs only 69%, so blockers carry part of the plan. The pack holds 26 common or uncommon lasting cards that force opposing creatures (Alluring Siren, Curse of the Nightly Hunt, Nettling Imp, Bloodshed Fever), so 6+ lasting at 60 is reachable from a large pool. At 20, 5 setup copies in the 40-card deck show one by turn 5 in 85% of games, and 2 to 3 payoffs show one in 52% to 67%; blockers make up the rest. At 100, the Blame Game and Draconic Dissent precons hold 13 and 20 enabler hits plus a goading commander; on EDHREC's forced-combat page, Disrupt Decorum ("Goad all creatures you don't control") is in 65% of 12,730 possible decks. Nelly Borca ("Whenever Nelly Borca attacks, suspect target creature. Then goad all suspected creatures.") cuts setup to 12 to 15; the line check in part 9 counts it as lasting. The public pools hold one payoff by part 6, Stinging Licid (a tap punisher once it becomes an Aura: "Whenever enchanted creature becomes tapped, this creature deals 2 damage to that creature's controller"), and Parasitic Impetus, which is setup.

**8. Where the live matchers differ.**

- Enabler #1 (`anyTags force-attacker`, 164 cards) has no owner check. The part 9 rules sort them as 78 lasting, 10 pump and goad, 48 one-shot, 6 symmetric, 13 that force your own creatures (Hellraiser Goblin, Uncontrollable Anger, Zurgo Helmsmasher), and 9 with no forcing text of their own (granted abilities in quotes, or checks like Keldon Twilight's "if no creatures attacked this turn"). 64 of the 142 that force opposing or all creatures never say "goad", so only text separates them.
- Payoff #1: `synergy-goad` is 9 rare or mythic cards, 8 also tagged `force-attacker`, so they count as both. `attacking-opponents-matters` (28 cards) rewards your own attacks at 60/40/20.
- Missed payoffs: attack drains (`tax-attack` with `opponent-loses-life`), Kardur's trigger (counted only as enabler), and the tap and attack punisher Auras, which carry no tag either clause reads (Insolence, Seizures, Sinister Possession: no enabler or payoff hit). Parasitic Impetus counts only as enabler, which matches part 6.

**9. Matcher hints.** Remove reminder text `/\([^)]*\)/g` and granted abilities in quotes `/"[^"]*"/g`, then split the text into ability lines and each line into sentences.

- Forced attack: `/\bgoad(s|ed)?\b|\battacks?\b[^.,]{0,50}?\bif able|\bmust attack\b/i`. The comma stop keeps "Whenever this creature attacks, target creature ... blocks it this combat if able" out.
- Own creatures, not setup, for a sentence without "goad": `/\b(creatures|\w+s) you control (have [^.]*)?(attack|must attack)|gets \+\d+\/\+\d+[^.]*and attacks each combat if able/i`, or the words before the first "attack" contain none of `/\b(target|opponents?|enchanted|equipped|each|all|creatures|player|those|(that|the) creature)\b/i` (Zurgo, "This creature attacks each combat if able").
- Symmetric: a sentence starting `/^(all creatures|each creature) (attack|attacks|have)\b/i`.
- Lasting, for a force on opposing creatures: the whole line is a trigger, `/^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)\b/i`; or an activated ability whose cost has no sacrifice, `/^([^\n\u2014]*\u2014 )?((?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*|[+−]?\d+):/i`; or a static line on a permanent matching `/each combat|\b(is|are) goaded\b|\bmust attack\b/i` that does not start with When, Until, or During. Testing the line, not the sentence, keeps Nelly Borca lasting. This finds Alluring Siren, Curse of the Nightly Hunt, Trove of Temptation, Nettling Imp, Norritt, Heckling Fiends, Baeloth Barrityl ("are goaded"), and Kang ("are goaded for as long as you control Kang").
- One-shot: any other force on opposing creatures (Incite War, Imaginary Threats, Siren's Call, Suicidal Charge). Instants and sorceries are always one-shot, and one that forces a single creature for one turn counts half (Boiling Blood).
- Pump and goad: `/(enchanted|equipped) creature gets \+\d+\/\+\d+[^.]*(is goaded|attacks each combat)/i`, weight 1 at 60/40/20.
- Payoff: `/whenever (a creature attacks you( or a planeswalker you control)?, (its|that creature's) controller loses|an attacking creature dies|a goaded creature|enchanted creature (attacks|attacks or blocks|becomes tapped)[^.]*(its controller loses|that creature's controller))/i`. It matches 15 cards in the pack, including Insolence, Seizures, and Stinging Licid. A card that also forces its own enchanted creature (Parasitic Impetus, Lust for War, Nettling Curse) is setup (part 6).
- Weight `attacking-opponents-matters` 0 at 60/40/20, 0.5 at 100; `tax-attack` with "pays" 0 at 60/40/20.

### Energy (energy)

**1. Plan.** Collect energy from cards that give it, then spend it on cards that turn it into damage, tokens, counters, or cards.

**2. Builds up and spends.** Energy counters on you; unit: one {E}. They stay until spent ("To pay {E}, a player removes one energy counter from themselves", rule 107.14), so surplus banks across turns.

**3. Setup jobs.**

- **One-shot makers** (weight 1, 1.5 at three or more {E}). Attune with Aether (c): "Search your library for a basic land card... You get {E}{E}". Sage of Shaila's Claim (c): "When this creature enters, you get {E}{E}{E}".
- **Repeatable makers** (weight 2). Decoction Module (u): "Whenever a creature you control enters, you get {E}". Empyreal Voyager (u): "deals combat damage to a player, you get that many {E}".
- **Multipliers** (weight 1, and only with 4+ repeatable makers). Izzet Generatorium (u): "If you would get one or more {E} ..., you get that many plus one {E} instead." It makes nothing alone and adds one {E} per gain, so it needs makers that trigger often. Its "{T}: Draw a card. Activate only if you've paid or lost four or more {E} this turn" rewards spending, not making.

**4. Payoff jobs.**

- **Repeatable sinks.** Aethertorch Renegade (u): "{T}, Pay {E}{E}: This creature deals 1 damage to target creature." Thriving Rhino (c): "Whenever this creature attacks, you may pay {E}{E}. If you do, put a +1/+1 counter on it." At 2 to 3 a use, each wants about 2 income a turn.
- **Scaling one-shots.** Harnessed Lightning (u) and Galvanic Discharge (c): "you may pay any amount of {E}". They bring 2 or 3 and grow with the bank.
- **Spend only.** Reiterating Bolt (u): its replicate cost is "Pay {E}{E}{E}." Needs makers.
- **Get triggers.** Fabrication Module (u): "Whenever you get one or more {E}, put a +1/+1 counter on target creature you control." Its own "{4}, {T}: You get {E}." feeds it slowly; count it once, as a payoff. Many small gains beat one big one.

**5. False friends.** Checked:

- Mana spends: Aether Hub (u) and Servant of the Conduit (u), "{T}, Pay {E}: Add one mana of any color." Both tags; they are mana.
- One-and-done bodies: Aetherstream Leopard (c) gets "{E}" on entering and "may pay {E}" for +2/+0: a light sink, not setup.
- Cross-theme: `counter-fuel-energy` also makes each spender a Counters payoff (Harnessed Lightning shows "counters (payoff)").
- Hidden makers: Aether Chaser (c) carries only `counter-fuel-energy` yet says "When this creature enters, you get {E}{E}". That income is its own first use, so it is still a payoff (part 6).

**6. Both jobs.** 108 of 141 energy cards make and spend. Give each one job:

- **Payoff** if it can spend again and again (an activated cost, an attack or upkeep trigger) and its own income per turn is below one use. One-shot income counts as the first use: Thriving Rhino and Aethertorch Renegade are payoffs. So is repeatable income below one use: Consulate Turret ("{T}: You get {E}" against "{T}, Pay {E}{E}{E}"). A variable spend ("any amount", "one or more", "X") is a payoff too.
- **Setup** if income repeats and the spend is one-time (sacrifice, exhaust), or if income per trigger is above one use.
- **Self-fed** if income per trigger equals one use. Longtusk Cub (u): "Whenever this creature deals combat damage to a player, you get {E}{E}" and "Pay {E}{E}: Put a +1/+1 counter on this creature." Count it once as a payoff, and leave it out of the energy budget on both sides: it neither needs nor supplies energy.
- A spend that only makes mana, or only keeps the card itself (Lathnu Hellion: "sacrifice this creature unless you pay {E}{E}"), does not count.

**7. Enough.**

| Size | Setup                    | Payoffs                 | Also                               |
| ---- | ------------------------ | ----------------------- | ---------------------------------- |
| 60   | 8 to 10 (3+ repeatable)  | 8 to 10 (4+ repeatable) | midrange curve, 6+ interaction     |
| 40   | 6                        | 6                       | 4+ interaction                     |
| 20   | 4                        | 4                       | payoffs that bring their first use |
| 100  | 12 to 15 (6+ repeatable) | 10 to 12                | 8+ interaction                     |

Reasoning: about 1:1, since most sinks bring their first 2 or 3 {E}. With 9 makers, 89% of games see one by turn 5 and bank about 5 {E}: two uses of a 2 to 3 cost sink. Budget: one-shot energy plus twice the repeatable income should cover 1.5 times one use of every repeatable sink. On the 60-card Kaladesh precon "Nissa, Nature's Artisan", part 6 gives 8 setup copies (Attune with Aether, Sage of Shaila's Claim, Servant of the Conduit, Empyreal Voyager), 9 payoffs, and 2 self-fed Longtusk Cubs. At 20, 4 makers in the 40-card deck show one by turn 5 in 78% of games, and a payoff that brings its own first use (Thriving Rhino, Aether Chaser) works even when the other packet has no energy. At 100, the Creative Energy and Living Energy precons hold 32 and 24 matcher hits; on EDHREC, Izzet Generatorium is in 83% of 6,536 possible decks. Both precon commanders spend more than they make (Satya: "unless you pay an amount of {E} equal to its mana value"; Saheeli, Radiant Creator: "you may pay {E}{E}{E}"), so add 3 to 4 makers. The public pools hold 10 energy cards in 2,455.

**8. Where the live matchers differ.**

- Enabler #1 (`anyTags energy-generator`) and payoff #1 (`anyTags counter-fuel-energy`) overlap on 104 of 141 cards, so 8 two-tag cards meet the 60-card minimums alone. In the precons, 29 of 32 and 20 of 24 hits are both.
- `energy-generator` leaves out Aether Chaser, Thriving Rhino, and similar commons, which carry only `counter-fuel-energy`. Part 6 calls them payoffs, so the effect is right, but by accident: Aethertorch Renegade works the same way and carries both tags.
- Neither clause sees Izzet Generatorium (`energy-increaser`) or Aether Revolt and Territorial Gorger ("Whenever you get one or more {E}"); Fabrication Module counts only as enabler. Mana spends count as both.

**9. Matcher hints.**

- Maker `M`: `/\bget ((\{E\})+|an amount of \{E\}|that many \{E\}|\w+ \{E\})/i`. It finds 122 of the 123 `energy-generator` cards, including Reservoir Walker ("you gain 3 life and get {E}{E}{E}"), and skips "Whenever you get one or more {E}".
- Repeatable maker (flag `m`): `/^([^\n\u2014]*\u2014 )?(whenever|at the beginning of|landfall)[^\n]*?, [^\n]*\bget M|^(?![^:\n]*\bsacrifice\b)[^:\n]*\}[^:\n]*:[^\n]*\bget M/im`, with `M` the group above. The gain must follow the trigger's comma, so Aether Revolt and Territorial Gorger are not makers.
- Sink: `/\bpay(ing)? (any amount of |an amount of |one or more |x |\w+ )?\{E\}/i`. It finds 121 of the 122 `counter-fuel-energy` cards, including Reiterating Bolt (replicate cost "Pay {E}{E}{E}"), Blaster Hulk ("pay eight {E}") and Territorial Aetherkite ("pay one or more {E}"), Lightning Runner ("you may pay eight {E}. If you pay"), and Sphinx of the Revelation ("{W}{U}{U}, {T}, Pay X {E}:"). The miss, Razorfield Ripper, reads the bank without paying ("where X is the amount of {E} you have").
- Repeatable sink (flag `m`): an activated cost with {E}, `^[^:\n]*\{E\}[^:\n]*:`, or a trigger line, `^([^\n\u2014]*\u2014 )?(whenever|at the beginning of)[^\n]*?, [^\n]*\bpay(ing)? (any amount of |an amount of |one or more |x |\w+ )?\{E\}`. Variable spend: `/pay (any amount of|one or more|an amount of|x) \{E\}|the amount of \{E\} you have/i`.
- Not a sink: `/\{T\}, pay \{E\}: add one mana/i` as the only spend; `/(sacrifice (this \w+|it)|tap this \w+) unless you pay (\{E\})+/i`.
- Get trigger, payoff: `/whenever you get one or more \{E\}/i`. Multiplier: `/if you would get one or more \{E\}/i` (Izzet Generatorium, Aether Refinery), not the `energy-increaser` tag, which also holds general counter doublers such as Winding Constrictor ("If you would get one or more counters, you get that many plus one of each of those kinds of counters instead").
- One job per card, in this order: get trigger, payoff; multiplier, part 3; variable spend, payoff; a spend with no maker, payoff; a maker with no counted spend, setup; one-shot income with a repeatable spend, payoff, or with a one-time spend, setup; repeatable income with a repeatable spend, compare {E} per gain with {E} per use (below: payoff, equal: self-fed, above: setup). Over the 141 energy cards this gives 30 setup, 100 payoffs, 9 self-fed, 1 multiplier, and The Convention Enthusiast with neither. `counter-fuel-energy` means "has a spend", not payoff.
