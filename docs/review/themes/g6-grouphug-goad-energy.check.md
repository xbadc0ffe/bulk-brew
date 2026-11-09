# Check: theme guide for Group hug, Goad, and Energy

Checked file: `docs/review/themes/g6-grouphug-goad-energy.md`.

Method. Every example card went through `npm run review:cards -- <names> --style <id>` (pack 2026-11-03). Tag lists came from `node packages/pipeline/src/review/cards.ts --tag <tag> --limit 0 --json`. The guide's regular expressions were run against the example cards and against whole tag lists with `data/review/scratch/g6chk/rx.mjs` (modes `ex`, `tags`, `hugsetup`, `goad`, `en`). Draw odds: `data/review/scratch/g6chk/hyper.mjs`. Precon counts: the writer's precon lists in `data/review/scratch/` run through the helper with `--compact`. EDHREC rates were read from `data/edhrec/pages/tags/*.json`. Rules from `docs/rules/MagicCompRules.txt`.

## What holds up

- The file is complete. Each style has all nine parts, in order. No em-dashes.
- All 59 named cards exist. Quoted oracle text and rarities match the pack.
- Live-matcher claims match `config/archetypes.json`:
  - groupHug: enabler `anyTags group-hug|selective-group-hug`, payoff `anyTags draw-hate`;
  - goad: enabler `anyTags force-attacker`, payoff `anyTags synergy-goad|attacking-opponents-matters`;
  - energy: enabler `anyTags energy-generator`, payoff `anyTags counter-fuel-energy`, 60-card minimums 8 and 5.
- The helper confirms each claimed hit and miss:
  - Sudden Impact, Storm Seeker, and Black Vise: payoff none.
  - Spirit of the Labyrinth: payoff #1 via `draw-hate`.
  - Scrawling Crawler and Vengeful Ancestor: both.
  - Kardur: enabler only. Revenge of Ravens and Hissing Miasma: none.
  - Gahiji: payoff via `attacking-opponents-matters`.
  - Aether Chaser and Thriving Rhino: payoff only.
  - Izzet Generatorium, Aether Revolt, and Territorial Gorger: none.
  - Fabrication Module: enabler only.
- These counts reproduce:
  - group hug: 432 tagged cards, 24 of them Gift cards;
  - goad: 164 `force-attacker` cards, 9 `synergy-goad` cards (all rare or mythic, 8 also `force-attacker`), 28 `attacking-opponents-matters` cards;
  - energy: 141 cards, 104 with both tags;
  - precons: 18 and 15 enabler hits with zero payoffs (group hug), 13 and 20 (goad), 32 and 24 with 29 and 20 both (energy).
- The draw odds reproduce: 10 of 60 gives 91.3%, 7 of 60 gives 80.9%, 12 of 60 gives 95.0%, 5 of 60 gives 68.6%, 9 of 60 gives 88.7%.
- The EDHREC rates reproduce: Howling Mine 7866/20825 (37.8%), Disrupt Decorum 8287/12730 (65.1%), Izzet Generatorium 5454/6536 (83.4%).
- The rules citations are quoted correctly: 701.15b (goad), 508.1d ("that player is not required to pay that cost"), 107.14 (energy).
- The public pool claims hold: about 10 of 25 hug hits give cards; there are two draw punishers (Kederekt Parasite, Underworld Dreams); the only goad drain is Parasitic Impetus; there are 10 energy cards.

## Issues

### Group hug

- **Claim:** the repeatable-setup regex covers "{T} ... you and target opponent each draw", and Sky Crier is a repeatable example.
  - **Problem:** Sky Crier's ability costs mana, not {T}, so the regex sorts the guide's own repeatable example as one-shot.
  - **Evidence:** helper text "{3}{W}: You and target opponent each draw a card." In `rx.mjs ex`, Sky Crier hits only `one`. Font of Mythos ("that player draws two additional cards") and Kwain ("{T}: Each player may draw a card") hit neither setup regex.
  - **Severity:** wrong.
- **Claim:** the one-shot setup regex is `(each player draws|each other player (may )?draws?|you and (target|that) opponent each draw)`.
  - **Problem:** it misses common and uncommon cards that make the opponent draw, which are the best setup at two players with a punisher out. Phrasings it skips: "each opponent draws", "target opponent draws", "two target players each draw", "you and that player each draw".
  - **Evidence:** `rx.mjs hugsetup` finds 140 `group-hug` cards that mention drawing but hit neither setup regex. Among them:
    - Huddle Up (c): "Two target players each draw a card."
    - Clockwork Fox (c): "each opponent draws a card"
    - Cut a Deal (u)
    - Diviner Spirit (u): "you and that player each draw that many cards"
    - Bargain (u)
    - Limestone Golem (u)
    - Donatello's Science Lesson (u)

    The regexes catch 18 repeatable and 43 one-shot cards, against the guide's own count of 87 draw-givers.

  - **Severity:** missing.
- **Claim:** the payoff hint is `/whenever an opponent draws/i`, plus `hate-full-hand` with `/number of cards in (that player's|their) hand/i`.
  - **Problem:** it misses punishers worded "whenever a player draws" or "whenever enchanted player draws", and threshold hand punishers.
  - **Evidence:** in `rx.mjs tags`, 26 `draw-hate` cards hit neither the payoff nor the exclude regex. They include:
    - Spiteful Visions: "Whenever a player draws a card, this enchantment deals 1 damage to that player."
    - Phyrexian Tyranny
    - Curse of Fool's Wisdom

    Only 22 of 60 `hate-full-hand` cards match the hand regex. It misses Fevered Visions ("has four or more cards in hand, ... deals 2 damage"), Misers' Cage, and Ebony Owl Netsuke (u).

  - **Severity:** missing.
- **Claim:** the "Enough" table at 20 asks for "2 to 3 [payoffs], or skip".
  - **Problem:** this contradicts part 2 ("In a two-player game a gift with no punisher only helps the opponent") and part 7 ("offer the style only with 4+ real payoffs"). A packet that skips payoffs is the failure this review exists to stop.
  - **Evidence:** guide parts 2 and 7. SPEC.md says a 20-card packet is played against an opponent inside a 40-card deck.
  - **Severity:** wrong.
- **Claim:** at 100, "15 to 18 (half repeatable)" setup, supported by the Peace Offering and Stalwart Unity precons holding 18 and 15 enabler hits.
  - **Problem:** those counts come from the matcher the guide itself calls too broad. Under the guide's own setup definition (draw or land and mana gifts), the precons hold about 11 to 12 setup cards, 5 to 7 of them repeatable. The precons would fail the guide's 100-card bar.
  - **Evidence:** `pchug.mjs` over the helper JSON. Peace Offering's 18 include five Gift cards (Octomancer, Wear Down, Perch Protection, Peerless Recycling, Long River's Pull), which part 5 calls false friends. Stalwart Unity's 15 include Akroan Horse, Orzhov Advokist, Evolutionary Escalation, and Forbidden Orchard. The guide's regexes find only 2 repeatable and 2 one-shot setup cards in Peace Offering.
  - **Severity:** unsupported.
- **Claim:** part 4 says "two [punishers] should be live", and the table asks for 4+ punishers at 60.
  - **Problem:** with 4 punishers in 60 cards and 12 cards seen by turn 5, two show up in only 17.5% of games, and one in 60%. The table does not deliver what the reasoning asks for.
  - **Evidence:** `hyper.mjs`: P(at least 2 of 4 in 12 from 60) = 17.5%; P(at least 1) = 60.1%.
  - **Severity:** misleading.
- **Claim:** part 4 lists Tempt with Discovery as a payoff ("Asymmetric gifts, 100 only").
  - **Problem:** part 6 says a card is "Setup if it rewards only its own gift". Tempt with Discovery rewards only its own gift, so by the guide's own rule it is setup.
  - **Evidence:** helper text "For each opponent who searches a library this way, search your library for a land card". Live enabler #1 via `group-hug`.
  - **Severity:** misleading.
- **Claim:** land and mana gifts get weight 1 at 100 and 0 below; the hint gives weight 0 at 60/40/20 for `donate-mana` and `donate-rampant-growth`.
  - **Problem:** no hint recognizes a land gift at 100, and the guide's own example carries neither tag.
  - **Evidence:** Jungle Wayfinder's tags are `flavors-of-vanilla, group-hug, symmetrical, triggered-ability, tutor, tutor-land, tutor-land-basic, ...`, with no `donate-*`. It hits none of the regexes in `rx.mjs ex`.
  - **Severity:** missing.

### Goad

- **Claim:** setup hints are lasting `(whenever|at the beginning of)[^.]*\bgoad\b|\{T\}[^:]*: target creature[^.]*attacks this turn if able|(enchanted|equipped) creature[^.]*is goaded`, one-shot `\bgoad\b`, and `attacks this turn if able` on an instant.
  - **Problem:** forced attacks without the word "goad" are almost all missed, even though part 8 says "only text separates" them. 65 of 164 `force-attacker` cards match none of the four goad regexes, including many bulk cards that force opposing creatures.
  - **Evidence:** `rx.mjs goad` finds 39 lasting, 34 one-shot, 18 "attacks this turn", 8 not-setup, and 65 none. The misses include:
    - Alluring Siren (u): "{T}: Target creature an opponent controls attacks you this turn if able."
    - Curse of the Nightly Hunt (u)
    - Incite War (c)
    - Imaginary Threats (u)
    - Siren's Call (u)
    - Suicidal Charge (c)
    - Trove of Temptation (u)
    - Seeker of Slaanesh (u)
    - Walking Desecration (u)
    - Angler Turtle
    - Baeloth Barrityl ("are goaded")
    - Kang ("are goaded for as long as you control Kang")

    The instant-only rule also drops repeatable {T} creatures such as Nettling Imp, Norritt, and Heckling Fiends ("target non-Wall creature").

  - **Severity:** missing.
- **Claim:** the payoff hint is `/whenever (a creature attacks you[^.]*loses|an attacking creature dies|a goaded creature)/i`, and Parasitic Impetus is a "missed payoff" (part 8) and "one drain" (part 7).
  - **Problem:** the regex does not match Parasitic Impetus, or the tap-punisher Auras that pair with forced attacks.
  - **Evidence:** in `rx.mjs ex`, Parasitic Impetus hits only `rep`. Its text is "Whenever enchanted creature attacks, its controller loses 2 life". `grep.mjs` finds Lust for War (u, forces attacks and "deals 3 damage to that creature's controller" when tapped), Insolence (c), and Seizures (c), none of which the regex matches.
  - **Severity:** missing.
- **Claim:** part 6 says the Impetus Auras are setup ("Setup if the reward follows only its own target"), while parts 7 and 8 treat Parasitic Impetus's rider as a drain and a missed payoff.
  - **Problem:** the guide contradicts itself on the only goad drain in the public pools, so a programmer cannot tell which way to count it.
  - **Evidence:** guide parts 6, 7, and 8.
  - **Severity:** misleading.
- **Claim:** Shiny Impetus is lasting setup at weight 2, with no size caveat, under a 60/40/20 plan to "force the opponent's creatures to attack into my blockers". The "6+ lasting" floor at 60 leans on such cards.
  - **Problem:** at two players the goaded creature can attack only you (701.15b), and these cards pump it, which works against the blocking plan. The guide flags Uncontrollable Anger as a friendly Aura but gives no two-player caveat for Auras and Equipment that grow an opposing attacker.
  - **Evidence:**
    - Shiny Impetus: "Enchanted creature gets +2/+2 and is goaded."
    - Parasitic Impetus: "+2/+2 and is goaded".
    - Bloodthirsty Blade (u): "Equipped creature gets +2/+0 and is goaded". It hits the lasting regex.
  - **Severity:** misleading.
- **Claim:** Nelly Borca "cuts setup to 12 to 15" because it goads on every attack.
  - **Problem:** the lasting regex sees Nelly as one-shot, because a period splits "Whenever Nelly Borca attacks, suspect target creature." from "Then goad all suspected creatures."
  - **Evidence:** `rx.mjs ex`: Nelly Borca hits `one` only.
  - **Severity:** misleading.

### Energy

- **Claim:** the sink regex is `pay (any amount|one or more|an amount) of \{E\}|(^|\n)(\{T\}, )?pay [^:\n]*\{E\}[^:\n]*:|you may pay (\{E\})+\. (if|when) you do`. Reiterating Bolt is a "spend only" payoff.
  - **Problem:** the regex misses the guide's own example. The "one or more" branch can never match, because oracle text says "pay one or more {E}" with no "of". The regex also misses costs that follow a mana cost, keyword costs, and "If you pay".
  - **Evidence:** `rx.mjs en` finds 24 of 122 `counter-fuel-energy` cards unmatched:
    - Reiterating Bolt: the replicate line starts with "Replicate" before "Pay {E}{E}{E}".
    - Territorial Aetherkite, Rampaging Aetherhood, Localized Destruction, Blaster Hulk: "you may pay one or more {E}".
    - Lightning Runner: "you may pay eight {E}. If you pay".
    - Sphinx of the Revelation: "{W}{U}{U}, {T}, Pay X {E}: Draw X cards."
    - Salvation Colossus: unearth for eight {E}.
  - **Severity:** wrong.
- **Claim:** the repeatable-maker regex is `((whenever|at the beginning of|landfall)[^.]*you get[^.]*\{E\}|\{T\}[^:]*: you get \{E\})`, at weight 2.
  - **Problem:** it also matches "Whenever you get one or more {E}" payoffs, so cards that make no energy count as weight-2 repeatable makers as well as payoffs.
  - **Evidence:** in `rx.mjs ex`, Aether Revolt and Territorial Gorger hit `rep,pay`. Their only energy text is "Whenever you get one or more {E}, ...". Fabrication Module and Brotherhood Scribe hit `rep,pay` the same way.
  - **Severity:** wrong.
- **Claim:** the hints say "Setup is `energy-generator` or the maker regex; `counter-fuel-energy` means 'has a spend', not payoff". Part 8 says `energy-generator` "misses" Aether Chaser and Thriving Rhino.
  - **Problem:** this contradicts parts 4 and 6, which make Thriving Rhino a repeatable sink and say a card with one-shot income and a repeatable spend is a payoff. As written, the hints count almost every maker-with-sink card as both, which is the double count part 8 criticizes.
  - **Evidence:** in `rx.mjs ex`, the maker regex hits Thriving Rhino, Aether Chaser, Aethertorch Renegade, Harnessed Lightning, Galvanic Discharge, and Consulate Turret, and each also hits `sink`. On the 60-card Kaladesh precon "Nissa, Nature's Artisan", the hints give 19 setup, 11 payoffs, and 11 both (`deckcls.mjs`). Section 6's rule gives about 8 to 10 setup and 9 to 11 payoffs.
  - **Severity:** misleading.
- **Claim:** Izzet Generatorium is a "Repeatable maker (weight 2)", and the hint says "Tag `energy-increaser`: weight 2".
  - **Problem:** Generatorium makes no energy on its own; it adds one to each gain, and its draw is a reward for spending 4+ in a turn. The tag also covers general counter doublers that are not energy cards.
  - **Evidence:** `energy-increaser` holds Aether Refinery, Innkeeper's Talent, Izzet Generatorium, Lae'zel, Vorinclex, and Winding Constrictor. Winding Constrictor: "If you would get one or more counters, you get that many plus one ... instead". Innkeeper's Talent doubles counters only at level 3.
  - **Severity:** misleading.
- **Claim:** part 6's rule: "Payoff if it can spend again and again ... and its own income per turn is below one use ... Setup if income repeats and the spend is one-time".
  - **Problem:** a card whose income repeats and matches its repeatable spend fits neither branch.
  - **Evidence:** Longtusk Cub, 2 copies in the Nissa precon and 4 in Counter Surge: "Whenever this creature deals combat damage to a player, you get {E}{E}" and "Pay {E}{E}: Put a +1/+1 counter".
  - **Severity:** misleading.

### All three styles

- **Claim:** part 3 gives setup and payoff weights (2 repeatable, 1 one-shot, half for one-turn tricks), and the "Enough" tables give plain counts such as "10 (4+ repeatable)".
  - **Problem:** the guide never says whether a table number is copies or weighted sum. The reasoning ("10 setup copies show one by turn 5") reads as copies, which leaves the weights unused. A programmer cannot tell whether 4 repeatable plus 2 one-shot cards (weight 10) meets a floor of 10.
  - **Evidence:** guide parts 3 and 7 for each style.
  - **Severity:** misleading.
- **Claim:** the 20-card rows: hug 3 to 4 and 2 to 3, goad 4 and 1 to 2, energy 3 and 3.
  - **Problem:** no reasoning is given for 20. A 20-card packet is half of a shuffled 40-card deck (SPEC.md, "Jumpstart packets"), so on the guide's turn-5 metric these numbers are far looser than the 60 and 40 rows.
  - **Evidence:** `hyper.mjs`: in 40 cards with 12 seen, 3 copies give 66.8%, 2 give 51.5%, and 1 gives 30.0%. Compare 91% for 10 copies in 60 cards.
  - **Severity:** unsupported.

## Verdict

needs-fixes.

The research is careful: examples, counts, rules, precon and EDHREC figures all reproduce. But the matcher hints a programmer would copy have concrete bugs:

- the energy sink regex misses its own example and has a dead branch;
- the repeatable-maker regex counts get-triggers as makers;
- the hug repeatable regex misses Sky Crier;
- the goad regexes miss most forced attacks that don't use the word "goad".

The energy hints also reintroduce the double count the guide warns about. Group hug at 20 ("or skip") contradicts the guide's own rule, and the 100-card hug numbers rest on the broad matcher.
