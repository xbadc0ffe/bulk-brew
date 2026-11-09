# Check: Tokens, +1/+1 counters, Aristocrats theme guide

A skeptical check of `docs/review/themes/g1-tokens-counters-aristocrats.md`.

**How it was checked.** Every example card was run through the card helper with its style. The output is in `data/review/scratch/g1chk/` (`tokens.txt`, `counters.txt`, `aristo.txt`, `all.json`). Counts were redone with `counts.ts` through `counts4.ts`, `broad.ts`, `anthem.ts`, and `mass.ts`, and the draw odds with `hyper.cjs`. The hint regexes were tried as written with `regex.cjs`, using the `i` flag, with the `m` flag shown separately. All of these live in that folder.

## What holds up

- All three styles have all nine parts, in order. Nothing is cut off.
- All 90 example cards exist. Every quoted oracle text matches the pack.
- The live clauses in section 8 match `config/archetypes.json` exactly (the Tokens payoff clause has eight tags).
- Most section 8 counts reproduce: 1,412; 881; 1,206 and 449; 633; 513 and 395; 321; 48; 384; 3,247; 2,159 and 703; 1,262 and 755; 699; 2,878 and 1,084; 299; 41.
- Every "Real decks" median except Aristocrats at 100 matches `data/review/scratch/g1/jobs-out.txt`.
- The draw odds are right at 12 cards seen: 91% and 65%, 75%, 90% and 59%, 78%, 86% and 53%, 66%, 49% and 69%.
- The rules cites are right: 700.4, 111.7, 704.5q, 702.93a.
- All seven EDHREC rates reproduce from `data/edhrec/pages/tags/`: Impact Tremors 29.2%, Mirkwood Bats 28.9%, Kami of Whispered Hopes 29.4%, Corpsejack Menace 27.5%, Pitiless Plunderer 43.2%, Ashnod's Altar 41.0%, Goblin Bombardment 35.2%.
- The claim that "the green deck reached 8 enablers with no outlet" is right. Its only "outlets" sacrifice a Treasure or a Food (`our-builder-themes.md`, Aristocrats, Green).

## Issues

- **Counters, section 7, "Spreaders or mass 3+" at 60.** Problem: none of the eight precons that back this row meets it. The "Real decks" figure in that column (1) counts only weight-2 repeatable spreaders (`setupRep` in `jobs.ts`), so mass placers are left out of the comparison. Evidence: `node data/review/scratch/g1chk/mass.ts` gives spreaders plus mass of 0 for Simic Domination, Simic Combine, and Abzan Siege, 1 for Jace, Arcane Strategist, Simic, and Dangerous, and 2 for Growing Hunger and Massed Ranks. The same gap appears at 100: real 3 against a minimum of 5+. Either the minimum is too strict for outlast and self-grower decks such as Abzan Siege, or the classifier misses setup. The guide does not say which. Severity: **wrong**.

- **Counters, section 5, Myojin of Towering Might as an "other counters" false friend.** Problem: the card is real setup. Its text reads "Remove an indestructible counter from Myojin of Towering Might: Distribute eight +1/+1 counters among any number of target creatures you control." That makes it a one-shot mass placer. Only its payoff hit (`counters-matter`, from the indestructible counter) is false. Evidence: helper, `counters` enabler #1 via `gives-pp-counters, gains-pp-counters`. Severity: **wrong**.

- **Tokens, section 8, the 109 `temporary-token` and 61 `donate-token` counts.** Problem: each is pinned on one tag but counted across both enabler tags. Evidence: `counts.ts` and `counts2.ts`. Only 91 `repeatable-creature-tokens` enablers carry `temporary-token`; 109 is the total across all Tokens enablers. Only 28 `multiple-bodies` enablers carry `donate-token`; 61 is the total across all Tokens enablers. Also, "`multiple-bodies` (881) is mostly one token on a creature (about 260)" is not "mostly": 260 is under a third (a rough text count gives 278 of 881). Severity: **wrong**.

- **Counters, section 8, "2,713 of 3,247 enablers never put a counter on another creature".** Problem: this does not reproduce. Evidence: a strict text count (`counts4.ts`) finds 1,003 enablers that put a +1/+1 counter on a target, another, or each creature, or that bolster or support, which leaves 2,244 that never do. The writer's own `jobs.ts` classifier (`counts3.ts`) finds 1,007 with a placing job on others or a one-shot placing job. The point that most enablers do not spread still stands. The number does not. Severity: **unsupported**.

- **Aristocrats, section 7, the 100 row.** Problem: it names two hand-picked precons (Power Hungry, Witherbloom) instead of the median the same run computed, and does not say why. Evidence: `node data/review/scratch/g1/jobs.ts decks 100 aristocrats 10` gives a median of outlets 3 (repeatable 2), fodder 11, payoffs 6. By that median, real precons fail "6 to 10 (4+)". The 40 row has the same problem: real drafts show 1 (1) outlets against a minimum of "2 to 3". Severity: **misleading**.

- **Aristocrats, section 7, "Fodder should outnumber outlets and payoffs together".** Problem: the guide's own table breaks this rule at every size, and so does one of the decks it cites. Evidence: at 60 the table asks for fodder 8 to 12 against outlets plus payoffs of 8 to 12. At 100 it is 12 to 16 against 12 to 20. Power Hungry has 10 fodder against 12 outlets plus 7 payoffs. Severity: **wrong**.

- **Aristocrats and Counters, section 7, the minimums at 40 against the draw math.** Problem: the 40 rows are much looser than the 60 rows, against the guide's own "No repeatable outlet, no deck". Evidence (`hyper.cjs`, 12 cards seen):

  | Size | Minimum                         | Seen by turn 5 |
  | ---- | ------------------------------- | -------------- |
  | 40   | 1 repeatable outlet or spreader | 30% of games   |
  | 60   | 3                               | 49% of games   |
  | 100  | 4 repeatable outlets            | 41% of games   |

  The 40 rows match the draft medians, not the stated reasoning. Severity: **misleading**.

- **All three, sections 7 and 9, draw math at 20.** Problem: the reasoning ("about 12 cards seen by turn 5") does not fit a 20-card packet. Per `SPEC.md`, a packet is shuffled with another into a 40-card deck, so about 6 of its own cards are seen by turn 5. The 20-card numbers come out at half of the 40-card ones, which works, but the guide never says that this is the reasoning. Severity: **missing**.

- **Aristocrats, sections 4, 6 and 8, how value outlets count.** Problem: the guide criticizes the live matcher for what its own rule does. Section 8 says "Value outlets count only as setup, so a deck of draw outlets reads as payoff-starved". Section 6 sets "Outlet beats payoff", so Phyrexian Vault and Goblin Bombardment count only as outlets under the guide too. Section 4 says "two or three carry a deck with few drain cards", yet the table still asks for 4 to 6 payoffs. No rule tells a programmer how to credit them. Severity: **misleading**.

- **All three, the counting rules and the tables.** Problem: the weights vary by style, and only one table says how weights apply. The opening rule gives an engine 2, several units 1, and a single unit 0.5. Counters then gives a single placer 1 (Battlegrowth puts one counter on one creature) and a mass placer 1.5. Aristocrats gives fodder 1 (Doomed Traveler makes one token). Only Counters says "weight-0.5 cards count half". The Tokens table counts "Copies", so 10 "creature plus one token" cards (weight 0.5, "filler, not setup alone") may or may not meet "Setup 10 to 12". This is the same rider-meets-minimum gap the review exists to close; the "Engines 4+" column is the only guard. The real-deck medians also count duals as "the job with more weight, ties to payoff" (`jobs.ts`), not the "job the deck is short of" the opening rule states. Severity: **misleading**.

- **All three, section 7, real-deck evidence.** Problem: the medians are not independent evidence. They come from the writer's own regex classifier, over decks ranked by that same classifier. The top lists pull in off-theme decks. Evidence: Jace, Arcane Strategist among the counters 60 top 8; Repel the Dark with 0 outlets among the aristocrats 60 top 8; Deep Clue Sea and World Shaper with 0 outlets among the aristocrats 100 top 10. At 40 the sample is the top 100 of 54,000 drafts, an upper bound rather than a typical deck. This is the "score and yardstick built on the same definitions" trap in `docs/algo-review.md`. Severity: **misleading**.

- **Aristocrats, section 5, Field of Souls as "anti-synergy".** Problem: its text reads "Whenever a nontoken creature is put into your graveyard from the battlefield, create a 1/1 white Spirit creature token with flying." Each nontoken sacrifice makes new fodder. It only ignores token deaths. It does not hurt the deck the way Death's-Head Buzzard ("all creatures get -1/-1") does. Evidence: helper, `aristocrats` enabler #2 and payoff #2. Severity: **misleading**.

- **Aristocrats, section 5, Endling as "not fodder (a mana sink)".** Problem: its text includes "{B}: This creature gains undying until end of turn", so one copy dies twice for {B}. That is weak fodder, not "not fodder". Evidence: helper text. `our-builder-themes.md` (Aristocrats, Black) lists the same card as "Real fodder". Severity: **misleading**.

- **Tokens, sections 5 and 9, Dark Salvation and the "not yours" hint.** Problem: Dark Salvation reads "Target player creates X 2/2 black Zombie creature tokens, then up to one target creature gets -1/-1 until end of turn for each Zombie that player controls." Targeting yourself gives you X Zombies and removal, so it is your token maker. The hint `(target player|its controller|each opponent) creates?` drops every "target player creates" card. It also leaves out "that player" and "target opponent", which `jobs.ts` includes. Severity: **misleading**.

- **Counters, section 3, Forcemage Advocate as a weight-2 spreader.** Problem: the "..." in the quote hides a real cost. The full ability is "{T}: Return target card from an opponent's graveyard to their hand. Put a +1/+1 counter on target creature." Each use gives the opponent a card (tagged `group-hug`). The guide's own spreader regex also misses this card (see the next issue). Severity: **misleading**.

- **Counters, section 9, the spreader regex.** Problem: it fails on the guide's own examples in both directions. Evidence (`regex.cjs`): Forcemage Advocate does not match, because the period after "to their hand." ends `[^.]*` before "Put". Wren's Run Hydra does match as a weight-2 spreader, through its one-shot "Reinforce X" ability ("{X}{G}{G}, Discard this card: Put X +1/+1 counters on target creature"). The guide gives that card 0.5 as "enters with counters". Severity: **wrong**.

- **Tokens, section 9, the engine and payoff hints.** Problems, from `regex.cjs`:
  - The engine regex matches Twitching Doll ("{T}, Sacrifice this creature: Create a 2/2 green Spider creature token ... for each counter", a one-shot).
  - The engine regex also matches Griffin Aerie and Field of Souls. The tag rule (`repeatable-creature-tokens` minus `temporary-token` and `donate-token`) keeps Griffin Aerie, Anafenza, and Aether Chaser. Section 8 itself flags "engines that need energy, life gain, or spells", but no hint removes them.
  - The count regex `for each creature you control` matches the counters payoffs Inspiring Call and Armorcraft Judge ("for each creature you control with a +1/+1 counter").
  - The enters-trigger regex misses "Whenever one or more ... creatures ... enter" (12 cards pack-wide, from `broad.ts`), which `jobs.ts` includes. The count regex misses "for each other creature you control" (22 cards).

  Severity: **misleading**.

- **All three, section 9, flags, anchors, and reminder text.** Problem: the hints use `^` but never say whether to match line by line (the `m` flag) or whether to strip reminder text first, and the results depend on both. Evidence (`regex.cjs`):
  - Scurry Oak matches the token engine regex only with `m`.
  - Scurry Oak matches the enters-trigger payoff regex only through its evolve reminder text.
  - Dragonback Lancer matches "temporary" only through its Mobilize reminder text. With reminder text stripped, only `^mobilize` with `m` catches it.
  - Minister of Pain's `^exploit` and Conclave Mentor's fodder line need `m`.

  `jobs.ts` strips parenthesized text and splits lines, but the guide does not say so. Severity: **missing**.

- **Counters, section 9, false friends left in.** Problem: the "Self" hint (`gains-pp-counters` without `gives-pp-counters`, and "enters with" at 0.5) counts several section 5 false friends as setup. Evidence (`regex.cjs`): Festercreep, Fertilid, and Academy Elite match `enters with ... +1/+1 counter`. Ajani's Comrade carries `gains-pp-counters` and `repeatable-pp-counters`, but not `gives-pp-counters`. The payoff regex also keeps Laid to Rest, which section 5 calls a weak payoff. Severity: **missing**.

- **Aristocrats, sections 3 and 9, fodder coverage.** Problem: the fodder hint `^when this creature dies, (create|draw|return|you gain|each opponent|it deals)` is too narrow.
  - It drops afterlife, persist, and undying creatures that the live tag counts: Imperious Oligarch, Kitchen Finks, and Young Wolf all fail it, raw or with reminder text stripped (`fodder.json`). `jobs.ts` includes `^(undying|persist|afterlife)`.
  - Among 817 `death-trigger-self` creatures, it matches 236 and misses 259 other "When this creature dies, ..." lines. 57 of those start "you may", and others investigate or incubate (Byway Courier, Injector Crocodile).
  - Self-recurring fodder is missing from the guide entirely. Reassembling Skeleton ("{1}{B}: Return this card from your graveyard to the battlefield tapped.") matches neither the live matcher nor the hint.

  Severity: **missing**.

- **Aristocrats, section 9, the one-shot outlet regex.** Problem: `as an additional cost to cast this spell, sacrifice` does not check what is sacrificed. Evidence (`broad.ts`): 20 of the 129 matches sacrifice no creature, such as Crop Rotation ("sacrifice a land"), Forge Armor ("sacrifice an artifact"), and Fodder Launch ("sacrifice a Goblin"). It also misses emerge and "When this creature enters, you may sacrifice", which `jobs.ts` covers. Severity: **misleading**.

- **Tokens, section 5, `creature-count-matters` false friends.** Problem: section 8 says this tag "counts colors, snow, lands" but leaves out board wipes that scale with creature count. Evidence: a tag sample includes Blasphemous Act ("costs {1} less to cast for each creature on the battlefield ... deals 13 damage to each creature"), which kills the token board. Severity: **missing**.

- **Tokens, section 4, convoke as a payoff.** Problem: convoke and "tap untapped creatures" payoffs are not in the guide. `jobs.ts` scores convoke at 0.5, and the pack has 104 convoke cards (`broad.ts`), many of them common. Severity: **missing**.

- **All three, section 8, live minimums.** Problem: the guide never compares its tables with the live minimums. `config/archetypes.json` sets Tokens 8 enablers and 4 payoffs at 60, Counters 8 and 3, and Aristocrats 8 and 4. It has entries for 20, 40, and 60 only, none for 100. A programmer cannot see how far the proposal moves from today. Severity: **missing**.

## Verdict

**Needs fixes.** The card facts, live clauses, EDHREC rates, rule cites, and draw odds are accurate, and most counts reproduce. Several things must change before a builder uses the guide:

- the Counters 60 minimum, which no reference precon meets;
- Myojin of Towering Might, which is setup, not a false friend;
- the two misattributed Tokens tag counts;
- the Aristocrats contradictions on fodder and value outlets;
- several hint regexes that misfire on the guide's own examples.
