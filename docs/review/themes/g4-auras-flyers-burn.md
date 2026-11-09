# Theme guide: Voltron, Evasion, and Burn

Three styles from `config/archetypes.json`: `auras` (shown as Voltron), `flyers` (shown as Evasion), and `burn`.

Sources. Card text and matcher hits come from `npm run review:cards -- "<name>" --style <id>` on pack version 2026-11-03; every card named below was printed that way. Counts over the whole pack (Un-sets left out) come from scratch scripts in `data/review/scratch/` (`g4-auras2.cjs`, `g4-flyers.cjs`, `g4-burn.cjs`, `g4-burnpay.cjs`, `g4chk/counts.cjs`, and for the section 9 hints `node data/review/scratch/g4fix/hints.cjs <examples|voltron|evasion|burn>`; the folder is gitignored), so they are approximate text counts. Real decks are counted by this guide's jobs, each card once, with `node data/review/scratch/g4fix/anchors.cjs` over `data/corpus/decks.json`. Draw odds come from `g4-hyper.cjs` and `g4fix/hyper.cjs`: hypergeometric, 12 cards seen by turn 5 and 14 by turn 7. EDHREC figures come from `node data/review/scratch/g4-edhsum.cjs <theme>` and `g4fix/edh.cjs <theme>`: the sum of `num_decks / potential_decks` over the cards a theme page lists. A page lists 370 to 410 cards, which add up to 72 to 82 of a deck's 99 cards, so each figure is a lower bound, but not far off.

Counting. Table ranges are card copies, and each card counts once, for one job (section 6 of each style). Every job has a weight and a repeatable or one-shot label. A setup range also gives a weighted floor in brackets: copies times weight, added up. A deck meets a row only if it meets both, so a pile of one-shot or half-weight cards cannot fill it. Payoff ranges are copies; payoff weights decide which payoffs to keep first.

Sizes. A 20-card deck is a Jumpstart packet: "Half a deck with its own lands. Any two packets shuffle into a 40-card deck." (`config/deck-templates.json`). Its odds are worked out in the shuffled 40, where its theme shows less often, and its rows are set against the corpus Jumpstart packets of the theme.

### Voltron (auras)

**1. Plan.** Suit up one or two creatures that are hard to block or kill, and hit hard.

**2. Builds up and spends.** Attachments on your creatures, one per card. Equipment stays when its creature dies (rule 301.5c), so it is repeatable. An Aura dies with its creature (303.4c) unless it returns or has umbra armor (702.89a). Carriers are what get spent.

**3. Setup jobs.**

- **Buff Auras** (one-shot, weight 1): an Aura that enchants a creature and makes it bigger, evasive, or harder to kill. Holy Strength: "gets +1/+2". Ethereal Armor: "+1/+1 for each enchantment you control". Aqueous Form: "Enchanted creature can't be blocked." Steel of the Godhead: "As long as enchanted creature is white, it gets +1/+1 and has lifelink."
- **Sticky Auras** (repeatable, weight 1.5): umbra armor, return to hand, bestow. Rancor: "return it to its owner's hand". Hyena Umbra: "+1/+1 and has first strike. Umbra armor". Nimbus Naiad has bestow.
- **Equipment** (repeatable, weight 2). Bonesplitter: "Equipped creature gets +2/+0. Equip {1}". Vulshok Morningstar: "+2/+2".
- **Finders** (one-shot, weight 1). Heliod's Pilgrim: "search your library for an Aura card".

**4. Payoff jobs.**

- **Carriers** (repeatable, weight 1), the main payoff in bulk: hexproof, evasive, or double strike bodies at one to three mana that can attack. Gladecover Scout: "Hexproof". Silhana Ledgewalker adds "can't be blocked except by creatures with flying". A power-0 body counts half, since it does nothing until suited up (Ornithopter: "Flying", 0/2). A defender is never a carrier (Angelic Wall: "Defender (This creature can't attack.)"). Needs 6+ attachments.
- **Cast, enter, and target engines** (repeatable, weight 2). Kor Spiritdancer (rare): "Whenever you cast an Aura spell, you may draw a card." Light-Paws, Emperor's Voice: "Whenever an Aura you control enters, if you cast it, you may search your library for an Aura card". Heroic, as on Favored Hoplite: "Whenever you cast a spell that targets this creature". Valiant reads "a spell or ability you control", so equip abilities trigger it too: Heartfire Hero, "put a +1/+1 counter on it". Need ten or more attachments and tricks.
- **Equipped bonuses** (repeatable, weight 1). Armed Assailant: "As long as this creature is equipped, it gets +2/+0 and has menace." Needs four or more Equipment.

**5. False friends.**

- Hostile Auras the six excluded tags miss: Dwindle ("gets -6/-0", tag `shrink`), Frogify ("loses all abilities", `humble`), Cast into Darkness ("can't block", `prevent-blocker`).
- Auras made for an opponent's creature. Goad: Coercive Impetus ("gets +1/+1 and is goaded") and the rest of the Impetus cycle. Slow death: Necrotic Plague ("Enchanted creature has 'At the beginning of your upkeep, sacrifice this creature.'"). A forced attack alone is fine in a deck that attacks anyway: Furor of the Bitten ("gets +2/+2 and attacks each combat if able") stays setup.
- Wild Growth: "Enchant land". Ramp.
- Skullclamp ("gets +1/-1", "Whenever equipped creature dies, draw two cards") is a sacrifice engine. Lightning Greaves gives shroud (702.18a), and Auras and equip both target (702.6a: "Attach this permanent to target creature you control"), so it blocks your other attachments. Swiftfoot Boots gives hexproof instead and is fine.
- Payoff #1's tags pull in cards that pay nothing off. All 47 `synergy-modified` cards also carry `synergy-aura` and `synergy-equipment`, and enter through those: Ambitious Assault is a team pump with a draw rider. Fumble (`synergy-aura`, `synergy-equipment`) is removal that steals attachments. `exalted` makes Ignoble Hierarch, a mana creature, a payoff.
- `heroic` covers 128 cards. The 45 with Heroic and the 10 with Valiant are payoffs, though Flowerfoot Swordmaster's Valiant only gives "Mice you control get +1/+0". The other 73 are mixed: Angelic Cub grows when targeted, while Cephalid Aristocrat only mills ("Whenever this creature becomes the target of a spell or ability, mill two cards").

**6. Both jobs.** Count what the card is on the battlefield. An Aura or Equipment is setup even with a payoff rider (Daybreak Coronet: "Enchant creature with another Aura attached to it"). A creature is a payoff (Lizard Blades: "Double strike", plus reconfigure). A tutor is setup, except Light-Paws: it finds Auras only when you cast one, so it is a payoff engine.

**7. Enough for a decent deck.**

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

**8. Where the live matchers differ.**

- Enabler #2 (`typeLineAny Aura` minus six tags) counts 911 Auras, and 145 of them enchant no creature. Of the 766 that enchant a creature, the section 9 exclusions catch 68 by tag or text and 14 more that goad, phase out, or kill their creature (`g4fix/hints.cjs voltron`). `g4-auras2.cjs` finds 222 with a hostile tag such as `removal`, though some of those are buffs with a damage rider. The section 9 setup hint keeps 513.
- Missed setup: 43 bestow creatures (no "Aura" in the type line) and heroic's targeted tricks (Gods Willing).
- Enabler #1 counts all 627 Equipment alike, Skullclamp and Lightning Greaves included, and never weighs Equipment above one-shot Auras.
- Payoff #1 takes `synergy-aura` and `synergy-equipment` (and with them all 47 `synergy-modified` cards and removal such as Fumble), all 128 `heroic` cards (73 with neither Heroic nor Valiant), and `exalted` (46). Payoff #2 misses evasive carriers.
- Both: Stoneforge Mystic (enabler #3, payoff #1), Lizard Blades (#1, #2), Daybreak Coronet, Light-Paws.
- `our-builder-themes.md` rated both Voltron decks it checked as working.

**9. Matcher hints.** Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: an Aura whose enchant line names a creature, `/^Enchant [^\n]*\bcreature\b/m` (this takes "creature you control", "creature or Vehicle", Daybreak Coronet's line, and reminder text), with `/(Enchanted (creature|permanent)|enchanted (creature|permanent) is [^,.]*, it) (gets \+|has|gains|can't be blocked)/`. Equipment with `/Equipped creature (gets \+|has|gains)/`. Repeatable: Equipment; sticky: keywords `Bestow` or `Umbra armor`, or `/return (it|this card) to its owner's hand/i`.
- Exclude Auras: tags `shrink`, `humble`, `prevent-blocker`; `/Enchanted (creature|permanent) (gets -\d|can't (attack|block)|doesn't untap|loses all abilities)/`; Auras for an opponent's creature, `/is goaded|sacrifice this (creature|permanent)|has phasing\.|enchanted creature's controller (loses|sacrifices)/i`. Exclude Equipment: `/Equipped creature gets \+\d+\/-\d[\s\S]*Whenever equipped creature dies|Equipped creature has [^.]*\bshroud\b/` (Skullclamp, Lightning Greaves, Neurok Stealthsuit, General's Kabuto: 4 of 540).
- Payoffs: `/Whenever you cast an? (Aura|Equipment)/i`, `/Whenever an? (Aura|Equipment) (you control )?(enters|becomes attached)/i` (Light-Paws), `/for each (Aura|Equipment)[^.]*attached/i`, `/as long as (this creature|it) is (enchanted|equipped)/i` (Armed Assailant), keywords `Heroic` and `Valiant`. They hit 72 permanents. Carriers: a creature at mana value 3 or less with Hexproof, Double strike, or derived evasive, without Defender or `/can't attack/`; power 0 counts half.
- Down-weight: `synergy-modified`, `exalted`, `heroic` without Heroic or Valiant (unless the text grows the creature when targeted), payoffs tagged `removal`.

### Evasion (flyers)

**1. Plan.** Play creatures the opponent cannot block, mostly flyers, make them bigger, and save removal for theirs.

**2. Builds up and spends.** Evasive power attacking each turn. Unit: one evasive creature that can attack; power 2 or more counts in full, power 1 half, power 0 or defender nothing. Variable power (`*`) counts in full. Payoffs multiply it. The setup cards are the win, so the deck is mostly setup, and payoffs help but are not needed.

**3. Setup jobs.**

- **Evasive attackers** (repeatable, weight 2 at power 2+ or `*` power, 1 at power 1): Flying, Menace, Shadow, Fear, Intimidate, Skulk, Horsemanship, "This creature can't be blocked", or fake flying ("can't be blocked except by creatures with flying", tag `fake-flying`), without Defender. Wind Drake: a 2/2 "Flying" for three. Mist Raven: "Flying" and an enters bounce. Skyhunter Skirmisher: "Flying, double strike". Crackling Drake ("\*/4", "Flying") grows with your instants and sorceries.
- **Landwalk and conditional unblockable** (repeatable, half the attacker weight): they work only against some opponents. Bog Raiders: "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)".
- **Granters.** Repeatable (weight 2): Levitation ("Creatures you control have flying."), Pegasus Courser ("another target attacking creature gains flying until end of turn", on each attack). One creature at a time (weight 1): Arcane Flight ("+1/+1 and has flying"), Cobbled Wings. One-turn tricks are tricks, and an enters trigger that grants flying until end of turn is a rider.

**4. Payoff jobs.**

- **Flyer lords** (repeatable, weight 2). Favorable Winds: "Creatures you control with flying get +1/+1." Empyrean Eagle: "Other creatures you control with flying get +1/+1." Spirit of the Spires gives +0/+1: weak, weight 1. Lords want 10+ flyers in 60.
- **Lasting anthems** (repeatable, weight 1). Glorious Anthem: "Creatures you control get +1/+1." Not specific to flyers.
- **Flyer triggers and discounts** (repeatable, weight 1). Watcher of the Spheres: "Creature spells with flying you cast cost {1} less", and it grows when another flyer enters. Wants 10+ flyers.

**5. False friends.**

- Non-attackers in the derived enabler: Angelic Wall ("Defender, Flying"), Ornithopter (0/2), Birds of Paradise (0/1, "{T}: Add one mana of any color").
- Conditional `unblockable`. Bouncing Beebles: "can't be blocked as long as defending player controls an artifact."
- `synergy-flying` mixes in flyer hate and riders. Earthquake ("each creature without flying and each player") and Moat ("Creatures without flying can't attack") are interaction that spares your flyers. Lofty Denial only improves "If you control a creature with flying".
- Flyer hate that names flyers without "you control": Gravity Well ("Whenever a creature with flying attacks, it loses flying until end of turn") and Ezuri's Archers ("Whenever this creature blocks a creature with flying, this creature gets +3/+0"). A flyer payoff rewards flyers you control.
- `anthem` and `keyword-anthem`: Goblin King ("Other Goblins get +1/+1 and have mountainwalk"), Intangible Virtue ("Creature tokens you control"), A Tale for the Ages ("Enchanted creatures you control"), Gate Hound (vigilance "as long as this creature is enchanted"), and keyword-only anthems such as Temur Ascendancy ("Creatures you control have haste").
- `gives-flying` and `gives-evasion` cover 936 permanents, with one-turn grants, typal lords, and landwalk among them (Goblin King again).

**6. Both jobs.** An evasive lord (Empyrean Eagle) is a payoff: its body is one flyer, its text pays off the rest. A granter on an evasive body (Pegasus Courser) is setup, counted once, as a granter.

**7. Enough for a decent deck.**

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

**8. Where the live matchers differ.**

- Enabler #1 (`derived evasiveCreature`) counts 72 that cannot attack, 108 power-0 bodies, and 158 conditional `unblockable` cards, and weighs a 1/1 like a 4/4. Of the 108, 31 have `*` power, which the core reads as 0 (`powerValue` in `matchers.ts`), so Crackling Drake and Battle Squadron ("power and toughness are each equal to the number of creatures you control") look like Ornithopter (`g4chk/counts.cjs`).
- It misses 127 landwalk creatures and the 8 tagged `fake-flying`, such as Silhana Ledgewalker.
- Granters are missed: Arcane Flight and Cobbled Wings meet no flyers clause; Levitation and Archetype of Imagination ("Creatures you control have flying") count as payoffs via `keyword-anthem` (payoff #2).
- Payoff #1 (`synergy-flying`, 102 cards without Un-sets): 34 match the section 9 payoff hint; 16 mention "without flying", mostly sweepers and locks; 7 are "if you control a creature with flying" riders.
- Payoff #2 (957 anthem permanents): 427 carry the `typal` tag. Of the other 530, 79 are team stat anthems or flyer lords by the section 9 hint, 275 grant keywords only (no `anthem` tag), and 32 pump only tokens, enchanted, or equipped creatures.
- Both: flying lords and discounts (Empyrean Eagle, Watcher of the Spheres).

Counts without a script named are from `g4fix/hints.cjs evasion`.

**9. Matcher hints.** Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: derived evasive or tag `fake-flying`, power 1+ or `*` power, no Defender, no `/can't attack/`, weighted by power. `unblockable` counts in full only with `/This creature can't be blocked\.?$/m`; `/can't be blocked (as long as|if|this turn)/` and landwalk keywords count half.
- Granters: tag `gives-flying` on a permanent without tag `typal`, and the grant must last: `/(Enchanted|Equipped) creature [^.]*\b(has|gains) [^.]*flying|creatures you control (have|gain) flying(?! until)/i`, or on each attack or tap, `/(Whenever [^,]*attacks|\{T\}[^:]*:)[^.]*gains flying/i`. This keeps 188 of the 936 permanents the two tags cover.
- Payoffs: `/creatures you control with flying get \+/i`, `/(whenever|for each)[^.]*creatures? you control with flying/i`, `/spells with flying you cast cost/i`, `/^(Other )?creatures you control get \+\d/im` on permanents. The first three hit 32 permanents, none of them flyer hate.
- Exclude from payoffs: `/without flying/i` (interaction), `/if you control a creature with flying/i` (rider), tag `typal`, `/(creature tokens|enchanted creatures|equipped creatures) you control/i`, keyword-only anthems (setup if they grant flying).

### Burn (burn)

**1. Plan.** Attack early with cheap creatures, then point burn at the opponent for the last 6 to 10 life, helped by creatures that ping each turn or grow or ping when you cast spells.

**2. Builds up and spends.** Damage to the opponent: 20 life, or 40 per opponent in Commander. Unit: points of damage or life loss to a player; the style's colors are red and black, and black's drain does the same job. Payoffs feed on a second resource, noncreature spells cast. A burn spell makes both; a burn creature only damage.

**3. Setup jobs.**

- **Burn spells that can hit a player** (one-shot, weight 1): instant or sorcery with "damage to any target", "target player or planeswalker", or "each opponent", X and variable damage, or life loss. Lightning Bolt: "3 damage to any target". Shock: "2 damage to any target". Lava Spike: "3 damage to target player or planeswalker". Fireball: "X damage divided evenly, rounded down, among any number of targets". Fling: "damage equal to the sacrificed creature's power to any target". Black: Sovereign's Bite, "Target player loses 3 life and you gain 3 life".
- **Repeatable damage** (weight 2): a permanent that hits a player every turn on its own. Prodigal Pyromancer: "{T}: This creature deals 1 damage to any target." Goblin Fireslinger: the same, to "target player or planeswalker". Punishers that fire on the opponent's own actions count here too: Underworld Dreams, "Whenever an opponent draws a card, this enchantment deals 1 damage to that player." A pinger that can hit only creatures is removal: Aven Archer, "2 damage to target attacking or blocking creature".
- **One-shot damage on a body** (weight 0.5). Viashino Pyromancer: "When this creature enters, it deals 2 damage to target player". Goblin Arsonist: "When this creature dies, you may have it deal 1 damage to any target." Fire Imp ("2 damage to target creature") is removal.

**4. Payoff jobs.**

- **Spells into damage** (repeatable, weight 2), the best. Guttersnipe: "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent." Firebrand Archer and Kessig Flamebreather: "Whenever you cast a noncreature spell, this creature deals 1 damage to each opponent."
- **Prowess and spell pumps** (repeatable, weight 1: the damage must get through in combat). Monastery Swiftspear: "Haste, Prowess". Kiln Fiend: "+3/+0" per instant or sorcery. Runaway Steam-Kin: "Whenever you cast a red spell, if this creature has fewer than three +1/+1 counters on it, put a +1/+1 counter on this creature." They need one- and two-mana spells.
- Each payoff wants two or more spells cast while it lives.

**5. False friends.**

- Face damage as a rider or the opponent's choice: Chandra's Outrage ("2 damage to that creature's controller"), Agonizing Demise (only "If this spell was kicked"), Blazing Salvo ("unless that creature's controller has Blazing Salvo deal 5 damage to them").
- Symmetric sweepers: Earthquake hits "each player", you too.
- Face damage on another theme's trigger. Impact Tremors ("Whenever a creature you control enters, this enchantment deals 1 damage to each opponent") needs a creature or token engine, Scourge of Valkas ("Whenever this creature or another Dragon you control enters") needs Dragons, and Mayhem Devil ("Whenever a player sacrifices a permanent") needs sacrifices. The live enabler counts them via `burn-player`; `g4-burn.cjs` finds 228 such permanents. They are Burn setup only when the deck runs that engine.
- Pingers and enters triggers that hit only creatures: Aven Archer, Fire Imp, Chaos Maw ("deals 3 damage to each other creature").
- Burn creatures do not feed prowess.
- Spell payoffs with no damage: Augur of Bolas ("look at the top three cards... instant or sorcery"), graveyard counts (Ghitu Lavarunner: "As long as there are two or more instant and/or sorcery cards in your graveyard"), cost reducers. Those are Spellslinger.

**6. Both jobs.** A card that deals damage when you cast spells (Guttersnipe, Electrostatic Field) is a payoff: it does nothing without spells. A pinger is setup, even when spells untap it: Thermo-Alchemist ("{T}: This creature deals 1 damage to each opponent. Whenever you cast an instant or sorcery spell, untap this creature.") and Cinder Pyromancer count once, as repeatable damage, since the tap works with no spells.

**7. Enough for a decent deck.**

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

**8. Where the live matchers differ.**

- The enabler (`burn-player|burn-any`, not land) counts 1,751 cards; only 547 are instants or sorceries, so most never feed the payoffs. The section 9 setup hint keeps 392 of the 547; the other 155 hit a player only as a rider (33), through "each player" (53), or not at all. It also misses the 58 drain spells.
- It counts one-shot bodies (Viashino Pyromancer) the same as pingers, and pingers that hit only creatures: of 187 `pinger` permanents with a tap damage ability, 138 can hit a player. It also counts the 228 face-damage triggers of other themes.
- Payoff #1 misses `synergy-noncreature`: 157 of its 310 cards meet no live payoff clause, and Firebrand Archer, Kessig Flamebreather, and Coruscation Mage count only as enablers. The tag is too broad to add: the section 9 payoff hint catches 154 of its 310 cards, and most of the rest are quest counters, cost reducers, and cards like Brazen Bluff.
- The payoff clauses are Spellslinger's: of 659 cards, only about 16 turn a cast into damage and 133 into a pump; 94 care about the graveyard, 31 make tokens, and some reduce costs (Goblin Electromancer). They miss the 8 "Whenever you cast a red spell" payoffs, such as Runaway Steam-Kin.
- Both: Guttersnipe, Thermo-Alchemist, Electrostatic Field.

Counts without a script named are from `g4fix/hints.cjs burn` and `g4chk/counts.cjs`.

**9. Matcher hints.** Checked on every example above with `g4fix/hints.cjs examples`.

- Setup: instant or sorcery with `/damage (equal to [^.]*? )?to (any (other )?target|target player|target opponent|each opponent)|divided (evenly|as you choose)[^.]* among|Choose any target|any number of targets|each of (up to )?(one or )?\w+ targets|(target player|target opponent|each opponent) loses (\d+|X) life/i`.
- Rider: `/damage to that creature's controller|unless that creature's controller|If this spell was kicked/i`. `/each player/i` is interaction.
- Repeatable: a permanent with `/\{T\}[^:]*: [^.]*deals? (\d+|X) damage to [^.]*(any target|player|opponent)/i`. Punishers: `/Whenever (an opponent|a player) [^,.]*, [^.]*(deals? \d+ damage to (that player|each opponent)|that player loses \d+ life)/i` (53 permanents). One that hits only opponents counts at every size; one that names "a player" hits you too and counts only at 100.
- One-shot: a creature with `/When [^.]*(enters|dies)[^.]*deals? (\d+|X) damage to [^.]*(any target|player|opponent)/`. "deals?" takes Goblin Arsonist's "have it deal", and "When " with its space leaves out "Whenever" triggers.
- Other engines: a `burn-player` permanent whose damage trigger needs creatures entering, sacrifices, or a creature type counts only with that engine in the deck.
- Payoffs: keyword Prowess; tag `prowess-like`; `/Whenever you cast (or copy )?(an instant or sorcery|a noncreature|an instant|a sorcery|a red) spell[^.]*(deals? (\d+|X) damage|loses \d+ life|gets \+|put a \+1\/\+1 counter|untap)/i`, which also takes magecraft's "cast or copy". Not tag `synergy-noncreature`. A pinger that spells untap is repeatable setup, not a payoff (section 6).
- Exclude from payoffs: `/(instant|sorcery) cards? in your graveyard/i`, tag `impulse-instant`, cost reducers without damage. Tokens on cast count half.
- Limit, for all three styles: the `[^.]*` parts stop at the first period, so a name with a period hides a payoff. Black Waltz No. 3 ("Whenever you cast a noncreature spell, Black Waltz No. 3 deals 2 damage to each opponent") fails the payoff hint. A hint is a first pass; the examples and false friends above are the test.
