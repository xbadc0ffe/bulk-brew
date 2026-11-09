# Check: theme guide for Lifegain, Artifacts, Enchantments

A skeptical check of `docs/review/themes/g3-lifegain-artifacts-enchantments.md`. Card facts come from `npm run review:cards` (`node packages/pipeline/src/review/cards.ts`), data pack 2026-11-03. Scratch scripts and their output are in `data/review/scratch/g3chk/`: `lg1.txt`, `lg2.txt`, `ar1.txt`, `en1.txt` (helper output), `counts.ts`, `regex.ts`, `probe.ts`, `odds.cjs`, `odds20.cjs`, `enccap.ts`, `kw.ts`. Precon counts reuse the writer's `data/review/scratch/g3-decks.ts`.

## What holds up

- All three sections are complete. Each has the nine parts in order.
- Every example card exists and its quoted text matches the helper (about 70 cards across `lg1.txt`, `lg2.txt`, `ar1.txt`, `en1.txt`). Rarities match too.
- Every live-matcher claim matches the helper's clause output and `config/archetypes.json`.
- The bulk counts reproduce (`node data/review/scratch/g3-honest.ts`, `counts.ts`): 1,548 / 738 / 201 lifegain enablers, 72 of 94 payoffs, 28 duals; 657 / 248 / 455 / 56 artifact payoffs, 206 duals, 310 token makers; 2,092 enchantments, 79 of 154 payoffs, 140 through `synergy-enchantment` alone, 39 token makers, 44 duals.
- The quoted odds are right (`odds.cjs`): 85.3%, 80.9%, 74.9%, 77.6%, 79.3%, 81.6%.
- The rules cites are right: 119.9, 702.15e, 903.7, 111.10, 303.4e, 111.1, 704.5s.
- The EDHREC shares are right (`data/edhrec/pages/tags/*.json`): Soul Warden 25,506 of 64,534 decks; Etherium Sculptor 33,644 of 66,589; Sanctum Weaver 21,911 of 33,016.
- The learned-plan medians are right (`config/learned/plans.json`, sizes.40): 0.391 × 23 = 9 enablers and 0.174 × 23 = 4 payoffs.

The problems are in the matcher hints and the "enough" numbers.

## Issues

### Lifegain

- **Claim:** repeatable setup text `at the beginning of [^.]*you gain`. **Problem:** it also matches "you gained", so threshold payoffs count as repeatable setup, which double counts them. **Evidence:** `regex.ts` finds 14 bulk cards that hit only through "you gained", including Griffin Aerie ("At the beginning of your end step, if you gained 3 or more life this turn, create..."), Indulging Patrician, Lone Rider, Regal Bloodlord, and Angelic Accord. **Severity: wrong.**

- **Claim:** repeatable setup text `\{t\}[^:]*: [^.]*you gain`. **Problem:** it matches the Food reminder text "{2}, {T}, Sacrifice this token: You gain 3 life." So any card that makes one Food counts as a repeatable gainer, including the guide's own false friend Bake into a Pie. This is the Graveyard failure again: removal with a rider counted as an engine. **Evidence:** 82 bulk cards hit only inside parentheses, 29 of them instants, sorceries, or removal. Overall, the five repeatable regexes add 99 cards beyond the tag rule; 20 are removal (Bake into a Pie, Fell the Pheasant, Food Coma, Feed the Cauldron) and 9 are payoffs (Griffin Aerie, Cat Collector, Regal Bloodlord). A black deck of Food removal plus threshold payoffs would pass "8+ repeatable". **Severity: wrong.**

- **Claim:** once-a-turn payoff text `first time each turn|only once each turn|if you gained life this turn`. **Problem:** the first two alternatives say nothing about life. **Evidence:** 194 bulk cards match with no life gain in their text (Abzan Devotee, Academy Wall, Akki Avalanchers). **Severity: wrong.**

- **Claim:** Lone Missionary is a one-shot gainer, weight 1 (part 3). **Problem:** the hint's "rider" regex `^when [^.]*(enters|dies)[^.]*you gain` matches it, along with 202 bulk cards. The hints never say what weight a rider gets. They also do not say that every pattern needs the case-insensitive flag (oracle text reads "Whenever" and "{T}") or that `^` needs multiline mode. **Severity: misleading.**

- **Claim:** the payoff hints (`pridemate`, `lifegain-to-damage`, three regexes). **Problem:** they drop `lifegain-matters` and miss real payoff wordings. **Evidence:** `regex.ts` finds 8 bulk payoffs that no hint catches:
  - "as long as you gained life this turn", the Infusion statics on Ulna Alley Shopkeep, Tenured Concocter, and Thornfist Striker;
  - "Whenever you gain or lose life during your turn" (Wax-Wane Witness);
  - "the amount of life you gained this turn" (Fortifying Draught, Nightmare's Thirst).

  Life-gain increasers ("you gain that much life plus 1 instead": Angel of Vitality, Honor Troll) are not discussed. **Severity: missing.**

- **Claim:** "Exclude `life-total-matters-self` at 100". **Problem:** it drops whole cards whose main job still works at 40 life. **Evidence:** Twinblade Paladin, the guide's own example, carries `pridemate` and reads "Whenever you gain life, put a +1/+1 counter on this creature." Angel of Vitality and Honor Troll lose their increaser the same way (`probe.ts`). Ignore the 25-life clause, not the card. **Severity: misleading.**

- **Claim:** "About two setup per payoff", with 6 to 8 payoffs at 60. **Problem:** real lifegain decks run close to 1:1 or heavier on payoffs, and two WotC 60-card decks miss the guide's setup floors. **Evidence:** from `g3-decks.ts` (setup : payoffs):
  - Commander "Witherbloom Witchcraft", which the guide cites: 21 : 18;
  - Theme Deck "Lifegain": 11 : 19, under the 12 floor;
  - Arena Starter "Lifeline": 14 : 14, with 7 repeatable, under 8+;
  - "Life Skills": 20 : 10;
  - Jumpstart "Healers (1)" to "(4)": 7 or 8 : 4.

  Learned 40-card lifegain plans (937 decks) have a median 0.13 × 23 = 3 live payoffs, under the 40 floor of 4. **Severity: unsupported.**

- **Claim:** Oloro, Ageless Ascetic is a "setup commander". **Problem:** by part 6's own rule it is a payoff too. **Evidence:** its text says "Whenever you gain life, you may pay {1}. If you do, draw a card and each opponent loses 1 life." The helper lists it as enabler and payoff (`lifegain-matters`, `lifegain-to-damage`). **Severity: misleading.**

### Artifacts

- **Claim:** 60: 18 to 20 setup (10+ at 3 or less, 2+ repeatable); 40: 11 to 13. Evidence: "Myr of Mirrodin" 16 and 6; draft median 9 and 4. **Problem:** the guide's own evidence falls below its floors. The cause is count-once: artifact payoffs (Frogmite, Etherium Sculptor, metalcraft artifact creatures) leave the setup count, yet they are artifacts that count toward "three on the table". The 78% odds should count every artifact. **Evidence:**
  - Intro Pack "Myr of Mirrodin": 16 setup and 0 repeatable, under both 18 and 2+.
  - Intro Pack "Metalcraft": 21 live artifacts, but 11 setup and 22 payoffs by the guide's rule.
  - Learned 40-card artifacts plans (4,868 decks): median 9 live enablers, 75th percentile 0.478 × 23 = 11. Most real draft decks miss 11 to 13.

  **Severity: unsupported.**

- **Claim:** Court Homunculus is setup (part 6). **Problem:** the hint "Half payoff: `as long as you control (an|another) artifact`" matches its text "+1/+1 as long as you control another artifact", and it is an artifact. The hints never say the half payoff applies only to non-artifacts. **Evidence:** `regex.ts` shows Court Homunculus as "AR half". **Severity: misleading.**

- **Claim:** `cost-reducer-artifact` is a payoff (Etherium Sculptor, part 6 and the hints), while `cost-reducer-enchantment` is setup because it "adds casts, not rewards" (Jukai Naturalist). **Problem:** the same job gets opposite classifications, and no reason is given. **Evidence:** part 6 of each section; part 9 of each section. **Severity: misleading.**

- **Claim:** part 8 lists the payoff leaks as `synergy-artifact` and `affinity`. **Problem:** the live tag `synergy-artifact-creature` is never discussed, and the hints neither keep nor exclude it. **Evidence:** `counts.ts` finds 50 bulk payoffs that hit only through it. They include Akron Legionnaire, whose text is a drawback ("Except for creatures named Akron Legionnaire and artifact creatures, creatures you control can't attack"), and Abuna Acolyte (damage prevention). In Enchantments, `synergy-enchantment-creature` alone carries 10 (Armament of Nyx, Nyx Infusion). **Severity: missing.**

- **Claim:** setup is "type Artifact, weight 1". **Problem:** artifact lands are never mentioned. They are common bulk cards, they meet the live enabler, they take no spell slot, and the cited Commander count includes them. **Evidence:** the helper gives Seat of the Synod and Treasure Vault "artifacts: enabler #1". In "Urza's Iron Alliance", 7 of the 39 setup cards are artifact lands (Ancient Den, Seat of the Synod, Vault of Whispers, Darksteel Citadel, three Bridges), leaving 32 without them. **Severity: missing.**

- **Claim:** setup token regex `investigate|fabricate \d|create [^.]*(treasure|clue|food|thopter|servo|powerstone|map|blood)[^.]*token|artifact creature token`. **Problem:** it misses some artifact token makers and some count payoffs. **Evidence:** 44 bulk token makers are missed: Incubate (Beamsaw Prospector, Converter Beast, Compleated Huntmaster, Blighted Burgeoning), plus Gold, Junk, and Lander tokens. The writer's own `g3-honest.ts` includes `gold|junk|lander`, so the "310" count came from a different regex than the hint. The count payoff regex `for each artifact you control` misses "for each artifact and/or enchantment you control" (All That Glitters). **Severity: missing.**

### Enchantments

- **Claim:** 60: 16 to 20 enchantments; 40: 10 to 12; 20: 6 to 8. **Problem:** these counts collide with the template caps in `config/deck-templates.json`, and the guide does not mention them. `typeMix.noncreaturePermanentMax` is 0.3 at 60 and 0.25 at 40 and 20, applied to spell slots by `canAdd` in `packages/core/src/builder.ts` (lines 574 to 578). That allows about 11 noncreature permanents at 60, 6 at 40, and 3 at 20. Only about 7% of bulk enchantments are creatures. **Evidence:** `enccap.ts` counts mono-color enchantment creatures as W 33 of 483, U 25 of 449, B 25 of 364, R 20 of 306, and G 27 of 345. A 12-slot packet cannot hold 6 to 8 enchantments under a cap of 3. Real Jumpstart "Enchanted" packets run 6 to 10. The guide should say whether the cap must rise for this style or the targets must drop. **Severity: missing.**

- **Claim:** part 2 says tokens feed constellation but not enchantress. Part 8 says "Role tokens feeding Mesa Enchantress would look fine." **Problem:** under the live matchers, Role token makers are not enablers at all (Glimmerburst and Charmed Clothier: "enabler none"), so that risk exists only in the new hints. Yet the hints count token makers as setup weight 1 or 2 and never tie them to enters payoffs only. Artifacts has the same gap: tokens feed enters and count payoffs but not cast payoffs (Embersmith, Poetic Ingenuity), and the hints treat them alike. **Severity: missing.**

- **Claim:** "44 bulk enchantments carry a payoff tag, mostly real." **Problem:** only about half are real per-enchantment payoffs. **Evidence:** `probe.ts` lists the 44. About 22 are real (Ethereal Armor, Grim Guardian, the constellation creatures, Sphere of Safety). The rest are:
  - 4 Shrines;
  - 4 cost reducers the guide calls setup (Jukai Naturalist, Inquisitive Glimmer, Transcendent Envoy, Ballad of the Black Flag);
  - 3 enchantment removal (Arenson's Aura, Quiet Disrepair, Teferi's Care);
  - protection (Alseid of Life's Bounty, Callaphe);
  - enchantment-creature conditions (Armament of Nyx, Nyx Infusion, Nyx Herald, Bearer of Memory);
  - a drawback (Riptide Chimera).

  **Severity: misleading.**

- **Claim:** Ajani Fells the Godsire is a setup example. **Problem:** it costs {3}{W}{W} (mana value 5), so the guide's own rule gives it weight 0.5. It is also a Saga, which part 3 calls poor for count. **Severity: misleading.**

### All three styles

- **Claim:** the "Enough" tables. **Problem:** they never say whether the numbers are copies or weighted units, though the sections assign weights (2 for repeatable, 0.5 at mana value 5+, half for riders). With weight 2, "8+ repeatable" could mean 4 cards. The cheap and repeatable sub-floors appear only at 60 for Artifacts, so at 40, 20, and 100 a stack of 5+ mana artifacts meets the count. **Evidence:** g1 says "Copies" and g2 says "setup copies"; g3 says neither. **Severity: missing.**

- **Claim:** the header says "Odds assume 12 cards seen by turn 5", and the 20-card rows follow. **Problem:** a 20-card deck is a Jumpstart packet shuffled with another into 40 (`SPEC.md` line 32; `deck-templates.json` "Half a deck with its own lands"), so 12 of 20 is the wrong model. In real play the 20-card floors are well under the 78% to 85% standard used for the other sizes, and no 20-card reasoning is given. The "no metalcraft" and "no count" notes are right but unexplained. **Evidence:** `odds20.cjs`, for one packet inside 40 cards:
  - 3 repeatable lifegain cards: 67% to see one;
  - 2 payoffs: 52%;
  - 7 artifacts: 35% to hold three by turn 5.

  **Severity: missing.**

- **Claim:** "Precon counts come from `g3-decks.ts` ... using the rules in each Matcher hints list." **Problem:** the script's rules differ from the hints. **Evidence:**
  - Lifegain payoffs use `lifegain-matters`, which the hints omit, so Witherbloom's 18 includes Essence Pulse, which no hint catches.
  - Enchantment payoffs include `cost-reducer-enchantment`, so Jukai Naturalist is among Enduring Enchantments' 20.
  - Artifact setup counts artifact lands.
  - No script applies the 0.5 weight at mana value 5+.

  **Severity: misleading.**

- **Claim:** the payoff floors. **Problem:** the turn-5 standard is not applied evenly. **Evidence:** `odds.cjs`: 7 lifegain payoffs in 60 give 81% to see one, but 5 enchantment payoffs in 60 give 69%, 3 in 40 give 67%, and 8 lifegain payoffs in 99 give 66%. **Severity: misleading.**

## Verdict

**needs-fixes.** The card facts, live-matcher findings, counts, odds, rules, and EDHREC figures all check out. Fix these before a builder or judge uses the guide:

- The lifegain hint regexes admit Food-rider removal and threshold payoffs as repeatable setup, which rebuilds the Graveyard failure.
- The once-a-turn regex matches 194 unrelated cards.
- The artifact and enchantment floors sit above the guide's own real-deck evidence, because count-once drops type-matching payoffs from the artifact count.
- The enchantment counts cannot fit under the template's cap of noncreature permanents.
- The tables do not say whether their numbers are copies or weighted units.
- The 20-card numbers ignore Jumpstart pairing.
