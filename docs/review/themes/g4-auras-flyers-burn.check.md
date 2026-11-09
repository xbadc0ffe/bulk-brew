# Check: theme guide for Voltron, Evasion, and Burn

Checked file: `docs/review/themes/g4-auras-flyers-burn.md`.

## How I checked

- Every card the guide names (75 cards) went through `node packages/pipeline/src/review/cards.ts <names> --style <id>`. Output is in `data/review/scratch/g4chk/auras.txt`, `flyers.txt`, and `burn.txt`. All 75 were found, every quote matches the oracle text, and every live matcher result the guide states matches the helper.
- The draw odds were recomputed with `node data/review/scratch/g4chk/hyper.cjs`. Every figure reproduces: 80.1%, 85.3%, 68.4%, 77.6%, 68.6%, 57.4%, and 70.0%.
- The colleague's count scripts (`g4-auras2.cjs`, `g4-flyers.cjs`, `g4-burn.cjs`, `g4-burnpay.cjs`) and `g4-edhsum.cjs` were rerun. I recounted on my own with `g4chk/counts.cjs`, `auras.cjs`, `auras2.cjs`, `fly.cjs`, `burn.cjs`, `burn2.cjs`, and `burn3.cjs`.
- Every hint regex was run against the guide's own example cards with `node data/review/scratch/g4chk/regex.cjs`, and against the whole pack with the scripts above.
- Anchor decks from `data/corpus/decks.json` were counted by the guide's own job definitions with `node data/review/scratch/g4chk/anchors.cjs`, and listed with `node data/review/scratch/g4chk/list.cjs <deck id>`.
- The rule citations were checked against `docs/rules/MagicCompRules.txt`: 301.5c, 303.4c, 702.89a, and 702.18a all say what the guide says.

## What held up

- The structure is complete: each style has sections 1 to 9 in order, and nothing is cut off.
- These config claims are right:
  - Nimbus Naiad and Gods Willing meet no `auras` clause.
  - Arcane Flight and Cobbled Wings meet no `flyers` clause.
  - Levitation and Archetype of Imagination count as payoffs via `keyword-anthem`.
  - Firebrand Archer, Kessig Flamebreather, and Coruscation Mage are burn enablers only.
  - The "Both" lists are right: Stoneforge Mystic, Lizard Blades, Daybreak Coronet, Light-Paws, Empyrean Eagle, Watcher of the Spheres, Guttersnipe, Thermo-Alchemist, and Electrostatic Field.
  - The burn payoffs are the Spellslinger payoffs minus `synergy-noncreature`.
- These counts reproduce: 911 and 145 Auras; 627 Equipment; 43 bestow; 47 `synergy-modified`; 128 `heroic` cards, 45 with the keyword; 46 `exalted`; 72, 108, and 158 in the Evasion section; 1,751 and 547 burn enablers; 659 burn payoffs; 16 and 133 among those; 310 and 157 for `synergy-noncreature`.
- The EDHREC figures reproduce: 5.4 Auras, 7.3 Equipment, 17.5, 13.6, Swiftfoot Boots at 36 to 65%, 13.8, 3.5, 2.3 against 3.6, and 15 to 22%.
- The Voltron verdict in `our-builder-themes.md` (lines 42 and 43, both "Working") is quoted correctly.

## Issues

### Voltron (auras)

- **Payoff regexes miss the guide's own examples.**
  - Claim (section 9): `/as long as (this creature|it) is (enchanted|equipped)/` and `/Whenever you cast an? (Aura|Equipment)/` find payoffs.
  - Problem: the first is case-sensitive, so it misses Armed Assailant, the guide's own example. Its text is "As long as this creature is equipped". Neither regex matches Light-Paws, which section 7 names as an engine.
  - Evidence: `regex.cjs` prints "Armed Assailant -" and "Light-Paws, Emperor's Voice -". The helper shows Light-Paws reads "Whenever an Aura you control enters, if you cast it".
  - Severity: wrong.
- **The Aura setup regex drops the guide's own both-jobs example.**
  - Claim (section 6): Daybreak Coronet is setup. Section 9 recognizes Aura setup with `/^Enchant creature( you control)?$/m`.
  - Problem: Daybreak Coronet reads "Enchant creature with another Aura attached to it", so the anchored regex rejects it. It also rejects 2 "Enchant creature or Vehicle" Auras.
  - Evidence: `regex.cjs` matches Daybreak Coronet on `auraBuff` only. `auras.cjs` finds 11 friendly Auras missed this way: 8 plain "Enchant creature", 2 "creature or Vehicle", and 1 "creature with another Aura attached to it".
  - Severity: misleading.
- **The setup hint lets in two of the guide's own false friends.**
  - Claim: section 5 calls Skullclamp a sacrifice engine and Lightning Greaves an anti-Aura card. Section 9 counts Equipment as repeatable setup by `/Equipped creature (gets \+|has)/`.
  - Problem: both cards pass that regex ("gets +1/-1", "has haste and shroud"), and section 9 gives no exclusion for them.
  - Evidence: `regex.cjs` gives Skullclamp `equipBuff` and Lightning Greaves `equipBuff`.
  - Severity: misleading.
- **Goad and self-sacrifice Auras are a missing false friend.**
  - Claim: section 5 covers hostile Auras.
  - Problem: Auras that are meant for an opponent's creature pass the section 9 setup hint. Examples: the goad Impetus cycle, Furor of the Bitten, Uncontrollable Anger, and Necrotic Plague ("Enchanted creature has 'At the beginning of your upkeep, sacrifice this creature.'").
  - Evidence: `auras2.cjs` finds 19 of the 473 setup-hint Auras with hostile phrasing. Examples: Acquired Mutation, Coercive Impetus, Psychic Impetus, Predatory Impetus, Redemption Arc, and Necrotic Plague.
  - Severity: missing.
- **Down-weighting non-keyword `heroic` drops Valiant.**
  - Claim (sections 5 and 9): down-weight `heroic` without the keyword, citing Flowerfoot Swordmaster.
  - Problem: all 10 Valiant cards carry `heroic`. Most are real targeting payoffs, and Valiant fires on abilities too, so equip triggers it while Heroic does not. Examples: Heartfire Hero ("put a +1/+1 counter"), Seedglaive Mentor, Emberheart Challenger, and Veteran Guardmouse. Flowerfoot is the weak one.
  - Evidence: `counts.cjs` prints "Valiant keyword 10 of which heroic tag 10". The Valiant listing (`node -e` over the pack) shows the trigger text.
  - Severity: misleading.
- **The carrier hint ignores the Evasion section's exclusions.**
  - Claim (section 9): carriers are Hexproof, Double strike, or derived evasive at mana value 3 or less.
  - Problem: derived evasive includes defenders and power-0 bodies, which the guide's own Evasion section rejects. Angelic Wall, Ornithopter, and Birds of Paradise would count as Voltron carriers.
  - Evidence: `g4-flyers.cjs` finds 72 that cannot attack and 108 at power 0.
  - Severity: misleading.
- **The 40-card row does not fit in 40 cards.**
  - Claim (section 7): 8-9 attachments, 15 creatures, 3-4 removal.
  - Problem: `deck-templates.json` gives 40-card decks 17 base lands, which leaves 23 other slots. The row needs 8 + 15 + 3 = 26 at least. The 60-card row fits (32 to 40 against about 36).
  - Evidence: template 40 has `baseLands 17`.
  - Severity: misleading.
- **The reasoning and the table use different carrier counts.**
  - Claim: the 60-card row asks for "8-10, 4+ carriers". The reasoning says "8 carriers show one in 85%".
  - Problem: with the table's minimum of 4 carriers, the odds fall to 60%.
  - Evidence: `hyper.cjs` prints "4 in 60, >=1 in 12: 60.1%".
  - Severity: misleading.
- **"At least 83 more are hostile" is not reproduced.**
  - Claim (section 8): at least 83 more of the Auras are hostile.
  - Problem: the cited script prints 222 hostile-tagged Auras. The guide's own exclusions catch 66.
  - Evidence: `g4-auras2.cjs` prints "hostile-tagged enchant-creature 222". `auras.cjs` prints "enchant creature hostile by doc exclusions 66".
  - Severity: unsupported.
- **Fumble is filed under the wrong tag.**
  - Claim: section 5 names Fumble under the `synergy-modified` false friends. Section 8 says "Payoff #1 counts `synergy-modified`".
  - Problem: Fumble carries `synergy-aura` and `synergy-equipment`, not `synergy-modified`. Payoff #1 has no `synergy-modified` clause; those cards enter through the aura and equipment tags.
  - Evidence: the helper's tags for Fumble, and the payoff #1 clause in `config/archetypes.json`.
  - Severity: misleading.

### Evasion (flyers)

- **The anthem regex misses the guide's own example.**
  - Claim (section 9): payoffs include `/^(Other )?creatures you control get \+\d/m`.
  - Problem: there is no `i` flag, so "Creatures you control get +1/+1" (Glorious Anthem, section 4's example) fails. Only lords that start "Other creatures" match.
  - Evidence: `regex.cjs` prints "Glorious Anthem -". `fly.cjs` finds 26 of the 957 anthem permanents match as written, and 74 with `/i`.
  - Severity: wrong.
- **The exclusion regexes miss all three of their own examples.**
  - Claim: `/if you control a creature with flying/` excludes Lofty Denial, and `/(creature tokens|enchanted creatures|equipped creatures) you control/` excludes Intangible Virtue and A Tale for the Ages.
  - Problem: the card texts start "If you control", "Creature tokens you control", and "Enchanted creatures you control". The case-sensitive regexes match none of them.
  - Evidence: `regex.cjs` gives "-" for Lofty Denial, Intangible Virtue, and A Tale for the Ages.
  - Severity: wrong.
- **The flyer trigger regex counts flyer hate as payoffs.**
  - Claim: `/(whenever|for each)[^.]*creatures? (you control )?with flying/i` finds flyer payoffs.
  - Problem: "you control" is optional, so cards that punish or block flyers match. The `without flying` exclusion catches none of them.
  - Evidence: `fly.cjs` finds 19 of 48 hits on permanents are hate, anti-flyer blockers, or self-animators: Gravity Well, Raking Canopy, Ezuri's Archers, Frostweb Spider, Palazzo Archers, Angel's Tomb, Halcyon Glaze, and others.
  - Severity: misleading.
- **The granter tags are far too broad.**
  - Claim (section 9): granters are tags `gives-flying` and `gives-evasion` on permanents.
  - Problem: these tags cover 936 permanents. 541 have only `gives-evasion`, 216 are one-turn grants, 145 are typal, and 36 grant landwalk. Goblin King, a section 5 false friend, is one of them. Section 3 tells team, repeatable, and one-creature granters apart; the hint does not.
  - Evidence: `fly.cjs` and the helper's tags for Goblin King.
  - Severity: misleading.
- **"Power 0" hides variable-power flyers.**
  - Claim: section 8 counts 108 power-0 bodies, and the setup hint keeps power 1+.
  - Problem: 31 of the 108 have `*` power, which the core reads as 0 (`powerValue`). The hint would drop Crackling Drake, Enigma Drake, Battle Squadron, and similar cards.
  - Evidence: `counts.cjs` prints "power0 nondefender 108 of which star power 31".
  - Severity: misleading.
- **The 60-card row is above every flyer precon in the corpus.**
  - Claim (section 7): 14-18 evasive attackers and 3-5 payoffs at 60.
  - Problem: by the guide's own definitions, Wings of Light has 12 attackers and 1 payoff, Take to the Sky has 12 and 2, and Sky Patrol has 10 and 0. None meets either column. Section 2 says the setup cards are the win, yet the row requires 3-5 payoffs.
  - Evidence: `anchors.cjs`.
  - Severity: unsupported.
- **The EDHREC "lasting anthems" figure uses the tag the guide distrusts.**
  - Claim: EDHREC's flying page shows "5.6 lasting anthems per deck".
  - Problem: the figure comes from the broad `anthem|keyword-anthem` category that section 8 criticizes. Its top cards are Temur Ascendancy ("Creatures you control have haste") and Call the Spirit Dragons ("Dragons you control have indestructible"). Stat anthems by text add about 1.2 copies.
  - Evidence: `g4-edhsum.cjs flying` (anthemPermanent), plus a split by text: "team or flyer stat anthem 1.2 other 4.4".
  - Severity: misleading.
- **The anthem breakdown figures have no source.**
  - Claim (section 8): about 215 team-wide stat anthems, 240 typal lords, 166 keyword-only, and 23 token-only; `synergy-flying` has 103 cards.
  - Problem: no listed script prints these figures. Simple recounts give 261 stat anthems, 434 keyword-anthem cards without an `anthem` tag, and 11 with "creature tokens you control get". `synergy-flying` has 102 cards without Un-sets (103 with them).
  - Evidence: `counts.cjs`, plus the inline anthem split.
  - Severity: unsupported.
- **Landwalk and fake flying are missing from the setup list.**
  - Claim: section 3 lists the evasive keywords.
  - Problem: landwalk (127 creatures) and "can't be blocked except by creatures with flying" (8, tagged `fake-flying`) are left out. The core does not count them either, and section 8 does not mention them.
  - Evidence: `node -e` count over the pack.
  - Severity: missing.

### Burn (burn)

- **The setup regex misses common face burn.**
  - Claim (section 9): instant or sorcery with `/damage to (any target|...)|divided (evenly|as you choose) among/i`.
  - Problem: it misses X and variable spells.
    - Fireball: "divided evenly, rounded down, among".
    - Fling and Gravitic Punch: "damage equal to ... to any target".
    - Erratic Explosion and Comet Storm: "Choose any target".
    - Crackle with Power and Furious Reprisal: "each of X targets".
  - Evidence: `burn2.cjs` finds 29 of the 184 non-matching burn spells can hit a player. Fireball is in Fire and Lightning.
  - Severity: wrong.
- **The damage-on-a-body regexes miss and over-match.**
  - Claim: repeatable damage is tag `pinger` with `/\{T\}[^:]*: [^.]*deals \d+ damage/`, and one-shot damage is `/When [^.]*(enters|dies)[^.]*deals \d+ damage/`.
  - Problem: the one-shot regex misses Goblin Arsonist, the guide's own example, which says "have it deal". Neither regex requires the damage to reach a player.
  - Evidence:
    - `regex.cjs` shows Goblin Arsonist without `oneShot`. `burn2.cjs` finds 10 cards with that phrasing.
    - `burn3.cjs` finds 50 of 189 pinger matches hit only creatures, such as Aven Archer and Blood Cultist.
    - It also finds 32 of 131 one-shot matches hit only creatures or you, such as Fire Imp, Chaos Maw, and Electric Eel.
  - Severity: wrong.
- **The payoff hint adds the tag section 8 calls mostly non-payoffs.**
  - Claim (section 9): payoffs include tag `synergy-noncreature`.
  - Problem: section 8 says 157 of its 310 cards are not payoffs. Of the 310, 130 are already caught by Prowess or `prowess-like`, 22 deal damage, drain, or pump on cast, and 158 do neither (quest counters, cost reducers, Brazen Bluff). The regex also misses payoffs from anchor decks: "Whenever you cast a red spell" (Runaway Steam-Kin, Cinder Pyromancer) and Magecraft's "cast or copy".
  - Evidence: inline `node -e` breakdown, `counts.cjs`, and `list.cjs` on Lightning Aggro and Fire and Lightning.
  - Severity: misleading.
- **No real 60-card burn deck meets the 60-card row.**
  - Claim (section 7): 12-16 burn spells, 2-4 repeatable, and 6-8 payoffs.
  - Problem, by the guide's own definitions:
    - Fire and Lightning (Premium Deck) has 0 payoffs.
    - Lightning Aggro (Challenger) has 0 payoffs. Its spell creatures are Runaway Steam-Kin, a "red spell" trigger, and Ghitu Lavarunner, which section 9 excludes as a graveyard count.
    - Mono-Red Burn (Pioneer Challenger) has 8 payoffs but 0 repeatable.
    - Section 1 calls the payoffs a help, yet the row requires 6-8.
  - Evidence: `anchors.cjs` and `list.cjs`.
  - Severity: unsupported.
- **The 100-card row is not backed by the cited EDHREC evidence.**
  - Claim (section 7): 8-12 repeatable damage sources, backed by "listed burn permanents ... add 3.5 copies per deck".
  - Problem:
    - Tap pingers are 0.12 of those copies. Cast-trigger payoffs are 1.63, and other triggers are 1.81: Niv-Mizzet, Mayhem Devil, Impact Tremors, Underworld Dreams, Spiteful Visions, Manabarbs, and Roiling Vortex.
    - Commander burn's real repeatable engines are punishers and other-engine triggers, which the guide never names. The black half of the style (`colors: R, B`) is not discussed either.
    - The column also changes unit at 100, from burn spells to "instants and sorceries".
  - Evidence: `g4-edhsum.cjs burn`, plus a split of the burn page by text: "tap pingers 0.12 cast triggers 1.63 other triggers 1.81".
  - Severity: unsupported.
- **Face damage from other engines is a missing false friend.**
  - Claim: section 5 lists the burn false friends.
  - Problem: the live enabler counts permanents that deal face damage on another theme's trigger. Impact Tremors ("Whenever a creature you control enters") and Scourge of Valkas (Dragon enters) are burn enablers. The colleague's own script counts 228 such permanents, and the guide does not mention them.
  - Evidence: helper output for both cards ("enabler: #1 ... via burn-player"), and `g4-burn.cjs` prints "permanent triggers to face 228".
  - Severity: missing.
- **The both-jobs rule leaves Thermo-Alchemist undecided.**
  - Claim (section 6): a card that deals damage when you cast spells is a payoff, and a pinger is setup.
  - Problem: Thermo-Alchemist is both, a "{T}: 1 damage to each opponent" pinger that untaps on each instant or sorcery. Section 8 lists it under "Both" but never says which single job it counts as.
  - Evidence: helper text for Thermo-Alchemist.
  - Severity: misleading.

### All three styles

- **Payoff jobs lack weights and labels, and the tables ignore the setup weights.**
  - Claim: section 3 gives setup weights (1, 1.5, 2, and 0.5).
  - Problem: no payoff job in any style has a weight or a repeatable or one-shot label. Section 7 counts plain copies ("Table ranges are card copies"), so the setup weights affect nothing and no weighted threshold is given.
  - Evidence: sections 4 and 7 of each style.
  - Severity: missing.
- **The 20-card rows have no reasoning and are above real packets.**
  - Claim: the 20-card rows. The stated reasoning covers only 60 and 40 cards.
  - Problem: a 20-card deck is a Jumpstart packet: "Half a deck with its own lands. Any two packets shuffle into a 40-card deck." (`deck-templates.json`). In the shuffled 40, Voltron's 4-5 attachments show two by turn 5 in only 35 to 48% of games. The Voltron and Burn rows are above every Jumpstart packet of the theme in the corpus. The Evasion packets (4-6 attackers) roughly meet theirs.
  - Evidence:
    - `hyper.cjs`: "4 in 40, >=2 in 12: 34.6%", "5 in 40: 47.7%".
    - Voltron packets in `anchors.cjs`: Enchanted (eight packets) have 2-4 attachments, Equipped has 2, and Swordmaster has 3.
    - Burn packets: Lightning (1) and (2) have 1 face-burn spell each, and Burning has 2.
  - Severity: unsupported.

## Does it pass the bad-deck test?

The tables count each card once by its job. With the hints fixed, they would reject the analog of the owner's Graveyard deck: payoffs with riders, removal with a face rider, and attachments that do nothing. As written, the hints let several false friends back in:

- Skullclamp and Lightning Greaves as repeatable attachments.
- Creature-only pingers as repeatable burn.
- `synergy-noncreature` non-payoffs as burn payoffs.
- Flyer hate as flyer payoffs.
- Any `gives-evasion` permanent as a granter.

Separately, the Burn and Evasion rows are stricter than real decks: they would fail Fire and Lightning, Lightning Aggro, and every flyer precon.

## Verdict

**needs-fixes.** The card facts, live-config claims, draw odds, rule citations, and most counts are right. The regex hints have concrete bugs: case sensitivity and missed phrasings make them fail on the guide's own examples. Several tag hints are over-broad. Some numbers rest on reasoning that does not hold: the 40-card Voltron slots, the burn payoff and Commander rows, and the 20-card rows.
