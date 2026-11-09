# Check: theme guide for Landfall, Ramp, Tappers

Checked file: `docs/review/themes/g5-landfall-bigcreatures-tappers.md` (data pack 2026-11-03).

## How it was checked

- The odds behind the tables: `node data/review/scratch/g5chk3/odds.cjs`.
- Every example card through the helper, with the style's matchers: `node packages/pipeline/src/review/cards.ts <names> --style landfall|bigCreatures|tappers`. Output in `data/review/scratch/g5chk/landfall.txt`, `ramp.txt`, `tap.txt`.
- Live matcher counts: `node data/review/scratch/g5chk3/counts.ts`, against `config/archetypes.json` and `packages/core/src/matchers.ts`.
- The guide's regular expressions, run as written over the pack: `node data/review/scratch/g5chk3/regex.ts` and `more.ts`.
- Real decks: `node --max-old-space-size=4096 data/review/scratch/g5chk3/corpus.ts <landfall|ramp|tap> [name pattern] [size]`, which counts each deck with the guide's own hint tags and regexes.
- EDHREC figures: the writer's `node data/review/scratch/g5-edhrec.ts tags/landfall landfall`.

## What holds up

- All 86 example cards exist and every quoted piece of oracle text matches the pack.
- All nine sections are present for all three styles, and the file has no em-dashes.
- These live-matcher claims reproduce exactly:
  - Landfall: 21 enablers with `donate-rampant-growth`, 43 with `control-changing-effects`, 25 cards counted as both, 12 untagged bounce lands, 31 of 48 sacrifice-to-fetch lands missed, five Staffs, three Gate cards.
  - Ramp: 5,033 nonland finishers; 1,207 and 99 with the writer's `g5-ramp.ts`; Explosive Vegetation dropped by the mana value cap of 3; Blood Pet and Generator Servant counted as dorks.
  - Tappers: 703 enablers, 319 with `repeatable-crime`, 72 with `lockdown-creature`, 204 payoffs, 46 with `synergy-tapped`, 23 cards counted as both, 8 engine cards (4 uncommon), and the 60-card minimums of 6 and 2.
- The EDHREC landfall figures reproduce: payoffs 14.1, fetch plus bounce lands 6.2, land makers about 15.
- Rule 903.4f says what the guide says about Arcane Signet. The helper confirms the builder leaves it out below 100.
- Against the owner's failure: all three tables need repeatable or lasting setup, so a deck of payoffs with riders would fail them. They are not too loose for 60, 40, or 100.

## Issues

- **Landfall, section 6 (Both jobs).** Claim: "If it only rewards lands, it is a payoff: Khalni Heart Expedition." Problem: by the guide's own test ("If it still makes lands enter, it is setup"), Khalni is setup. Its reward is two lands entering. The section 9 setup tags also class it as setup, and the payoff hint matches it but gives it no weight. Evidence: helper text "Remove three quest counters from this enchantment and sacrifice it: Search your library for up to two basic land cards, put them onto the battlefield tapped". Tags include `multi-land-ramp` and `tutor-land-to-battlefield`. The `regex.ts` weight run gives "matched, no weight". Severity: wrong.

- **Landfall, section 5 (False friends) and section 9 (hints).** Claim: Fledgling Griffin's "gains flying until end of turn" is "a rider". Problem: the payoff hint gives it 0.5, the same as Steppe Lynx, because its sentence contains "until end of turn". The two sections disagree. Evidence: `regex.ts` gives Fledgling Griffin 0.5, Steppe Lynx 0.5, Plated Geopede 0.5. Severity: misleading.

- **Landfall, section 5 (False friends).** Claim: on Path to Exile and Cleansing Wildfire, "Its controller may search', so the opponent gets the land", and "21 setup-tagged cards carry `donate-rampant-growth`". Problem: Cleansing Wildfire can target your own land. Then you get a landfall trigger and draw a card. It also has no `donate-` tag, so the 21 does not cover it. It is caught only by `removal-land`. Evidence: helper text "Destroy target land. Its controller may search ... Draw a card." Tags: no `donate-*`, has `removal-land`. Severity: misleading.

- **Landfall, section 9 (Payoff hint).** Claim: payoff is `Whenever a land you control enters`, and "In that sentence ... `If you had a land enter` 0.25". Problems:
  - The 0.25 tier can never fire. A sentence picked for "Whenever a land you control enters" cannot hold "If you had a land enter". Searing Blaze, the guide's own threshold example, gets no match.
  - The regex misses 78 of the 288 live payoffs. Some of those are right to drop: 12 trigger only on opponents' lands and 8 on any player's. But it also misses 15 basic-type triggers (Battlewand Oak, Koth, Fire of Resistance, Valakut, the Molten Pinnacle, Roiling Canopy), 5 "If you had a land enter" spells, and Field of the Dead.
  - Rewards outside the list get no weight: mana (Lotus Cobra, which section 6 names as a payoff), quest counters (Khalni), and mill (Hedron Crab).
  - The guide never mentions the `landfall-other` tag. It is a clean exclusion: it sits on 29 of the live payoffs, Polluted Bonds and Burgeoning among them.

  Evidence: `regex.ts` shows "If you had a land enter 5 | Groundswell; Mysteries of the Deep; Rest for the Weary; Searing Blaze; Tomb Hex" and "basic type you control enters 15". It gives Searing Blaze "none" and Lotus Cobra "matched, no weight". `counts.ts` shows "landfall-other tag 29". Severity: wrong.

- **Landfall, section 7 (Enough).** Claim: "A 60-card deck sees 12 to 13 cards by turn 5." Problem: 7 cards plus 4 draws on the play is 11, and plus 5 on the draw is 12. Evidence: arithmetic. The 40-card figure of "about 30%" (11 or 12 of 40) is right. Severity: wrong.

- **Landfall, section 7 (Enough), 60, 40, 100.** Claim: nonland setup 6 to 8 with 2+ repeatable, and payoffs with 5+ lasting, at 60. At 40, 1+ repeatable and 3+ lasting. At 100, 4+ repeatable. Problem: no landfall precon or Jumpstart packet in the corpus meets the repeatable bar. Few meet the lasting bar, since real landfall decks lean on pumps. The guide also says "payoffs never starve" because land drops feed them, so it argues against such a strict setup bar. Evidence, counted with the guide's own hint tags and regexes (`corpus.ts landfall`):
  - Zendikar's Rage (Intro Pack 60): setup 3, repeatable 0, payoffs 14, lasting 3.
  - Zendikar (Duel Deck 60): 5, 0, 9, 2.
  - Savage Lands (Arena Starter 60): 5, 0, 7, 1.
  - Land's Wrath (Commander 100): setup 16, repeatable 1, payoffs 16, lasting 6.
  - Six Landfall Jumpstart packets: repeatable 0 in every one.

  EDHREC's 4.6 extra-drop cards per deck are a tuned-deck lower bound, not a bulk bar. Severity: unsupported.

- **Landfall, section 7 (Enough), 100 and lands.** Claim: 100 cards wants 37 to 38 lands and 10 to 14 payoffs. 60 cards wants 24 to 25 lands. Problems:
  - Scaling: the payoff range grows less than the deck does. 10 payoffs in 100 shows 1.15 by turn 5, against 1.53 for 8 in 60. Meanwhile setup doubles.
  - The note that a payoff commander "frees 3 or 4 payoff slots" implies the table assumes no payoff commander. That makes the 100 payoffs look too low.
  - Real landfall decks run more lands than the table: Commander landfall precons run 37 to 44 (Reap the Tides 44, Nature's Vengeance 43, Tricky Terrain 44), and the 60-card landfall precons run 25 to 27.
  - EDHREC's lower bound is 14.1 payoffs, the top of the guide's range.

  Evidence: `node data/review/scratch/g5chk3/odds.cjs` and `corpus.ts landfall "" 100`. Severity: misleading.

- **Landfall, section 7 (Enough), 20.** Claim: a 20-card packet wants 3 to 4 payoffs. Problem: every real Landfall Jumpstart packet holds 5 to 8. The guide gives no reasoning for 20. The template says a packet is half of a 40-card deck ("Any two packets shuffle into a 40-card deck"), so 3 payoffs means 3 in 40, which shows one by turn 5 only 63% to 67% of the time (`odds.cjs`). Evidence: `corpus.ts landfall "^(Landfall|Lands)"` shows Landfall 1: 8 payoffs, Landfall 2: 7, Landfall (1): 6, Landfall (2): 5, Landfall (3): 6, Landfall (4): 8. Template text is from `config/deck-templates.json`. Severity: unsupported.

- **Landfall, section 3 (Setup jobs).** Omission: land recursion is not covered, though it is a common setup job, mostly in Commander: playing lands from the graveyard with fetch lands, and returning lands to the battlefield. Evidence: 65 cards in the pack, 28 of them common or uncommon (Crucible of Worlds, Ancient Greenwarden, Conduit of Worlds, Splendid Reclamation; `more.ts`). EDHREC's landfall page puts land recursion at 3.5 cards per deck (`g5-edhrec.ts`). Severity: missing.

- **Ramp, section 6 (Both jobs).** Claim: "A creature that ramps is setup at 3 mana or less (Wood Elves) and a payoff at 5 or more (Pelakka Wurm)." Problem: Pelakka Wurm does not ramp, so it is no example of a ramping creature. Evidence: helper text "Trample ... When this creature enters, you gain 7 life. When this creature dies, draw a card." It has no mana or land text. Severity: wrong.

- **Ramp, section 9 (Lasting tag hint).** Claim: lasting setup is "`mana-dork`, `mana-rock`, and `tutor-land-to-battlefield` at mana value 4 or less", minus egg, ritual, and donate. Problems:
  - It does not say nonland. As written it counts 24 lands, Evolving Wilds and Fabled Passage among them.
  - It keeps land-neutral land destruction such as Cleansing Wildfire, Geomancer's Gambit, and Unstable Obelisk. The live matcher counts Cleansing Wildfire as land ramp too, and section 8 does not say so.

  Evidence: `regex.ts` shows "lasting by hint (any type) 940 of which lands 24" and "removal-land among lasting Cleansing Wildfire; ... Geomancer's Gambit; ... Unstable Obelisk". For Cleansing Wildfire the helper prints "derived: mana source (landRamp)" and "bigCreatures (enabler)". Severity: misleading.

- **Ramp, section 9 (Lasting text hint).** Claim: `\{T\}(, [^:]*)?: Add` without `Sacrifice`. Problems:
  - "Without Sacrifice" does not say where. Read as the whole card text, it drops 122 nonland sources, Mind Stone (the guide's own lasting example) and every Banner, Cluestone, and Locket among them. Only "no Sacrifice in the cost before the colon" works.
  - The regex also matches every land (1,056).
  - The burst regex `^Add \{` needs the multiline flag for cards where Add is not the first line.

  Evidence: `regex.ts` shows "lasting text nonland 790 with Sacrifice anywhere in text 122 e.g. Abzan Banner; ... Azorius Cluestone; Azorius Locket" and "lasting text, lands hit 1056". Mind Stone's text is "{T}: Add {C}. {1}, {T}, Sacrifice this artifact: Draw a card." Severity: misleading.

- **Ramp, section 9 (Payoff hint).** Claim: exclude `Defender|can't attack`. Problem: this drops big creatures whose "can't attack" is about other creatures, Stormtide Leviathan (an 8-mana 8/8) among them. The hint also leaves weights out. The prose gives 1 at 6+ and 0.75 for evasive five-drops, and "Mana value 4 weighs 0.25" contradicts "creature at 5+ mana" in the same bullet. Evidence: `regex.ts` shows "excluded by 'can't attack' though about others 14 Akron Legionnaire; Angelic Arbiter; Blazing Archon; ... Stormtide Leviathan". The hint as written matches 2,503 creatures. Severity: misleading.

- **Ramp, section 7 (Enough), 60.** Claim: 8 to 11 lasting setup and "1 to 2 X" payoffs. Problem: no ramp or big-creature precon at 60 in the corpus reaches 8 lasting sources, and almost none run an X spell. The payoff side does match real decks. Evidence (`corpus.ts ramp`, lasting / payoffs (6+, X)):
  - Wicked Big: 6 / 8 (4, 0).
  - Stomp, Stomp: 6 / 1.
  - Mono Green Amazon: 5 / 6 (5, 0).
  - Green (Game Night): 4 / 9 (7, 0).
  - Dino Might: 3 / 7 (5, 0).
  - Beasts: 3 / 8 (5, 0).
  - Stampede of Beasts: 3 / 7 (4, 2).

  At 100, Eldrazi Unbound (12 / 17) does fit the table. The guide's own goal is a six-drop on turn 4, which needs two lasting sources by turn 3. Even with 8 to 11 sources that happens in only 34% to 59% of games (`odds.cjs`), which the section does not say. Severity: unsupported.

- **Ramp, section 3 (Setup jobs).** Omission: creature cost reducers and effects that put a creature from hand onto the battlefield are both ways to land big threats early. Neither is mentioned. Evidence: 26 cards with "creature spells you cast cost {N} less", 13 of them common or uncommon, and 28 cards that put a creature from hand onto the battlefield, Elvish Piper among them (`more.ts`). The counts are small, so this is a minor gap. Severity: missing.

- **Tappers, sections 4 and 6.** Claim: section 4 lists Icewrought Sentry as a tap-trigger engine, a payoff. Section 6 says "If the card's own tap is repeatable and its reward small, it is setup: ... Icewrought Sentry." Problem: one card gets two jobs, which breaks the guide's own count-once rule. Evidence: helper text "Whenever this creature attacks, you may pay {1}{U}. When you do, tap target creature an opponent controls. Whenever you tap an untapped creature an opponent controls, this creature gets +2/+1 until end of turn." The engine regex in section 9 also matches it. Severity: misleading.

- **Tappers, section 9 (Tap spells hint).** Claim: spells with `tap (target|up to \w+ target|all) creatures?`. Problem: the lowercase `tap` misses the guide's own examples, which begin "Tap": Blustersquall, Frost Breath, Sleep. Adding a case-insensitive flag fixes it but breaks the Narrow hint `Tap target [A-Z][a-z]+\.`, which needs case. The hints must state their flags. The writer's own scripts (`g5-count.ts`) ran with the `i` flag. Evidence: `regex.ts` shows "tap spells regex (case-sensitive) 56", "(i) 140", "Blustersquall false true", "Frost Breath false true", "Sleep false true". Severity: wrong.

- **Tappers, section 9 (Freeze hint).** Claim: freeze is `doesn't untap during its controller's next untap step|stun counter`. Problem: it misses the guide's own freeze examples, Frost Breath ("Those creatures don't untap during their controller's next untap step") and Sleep ("don't untap during that player's next untap step"). Evidence: `regex.ts` shows "freeze regex 174 Frost Breath false Sleep false". Severity: wrong.

- **Tappers, section 9 (One-shot hint).** Claim: `When [^.]* enters, (you may )?tap`. Problem: too broad. Of 132 matches, only about 62 tap an opposing or targeted creature. The rest:
  - About 30 lock Auras ("When this Aura enters, tap enchanted creature": Claustrophobia, Charmed Sleep, Encase in Ice).
  - Self-taps: Gitaxian Anatomist, "you may tap it"; Jaddi Lifestrider, "tap any number of untapped creatures you control".
  - Taps of lands and Gates: Gulf Squid, Curse of Marit Lage, Guild Summit.

  The lock rule can remove the Auras only if the hint says it takes precedence, and it does not. Evidence: `more.ts` shows "one-shot hits 132 opposing/target creature 62" with the list. For Claustrophobia, `regex.ts` gives "one-shot true lock true". Severity: misleading.

- **Tappers, section 5 (False friends).** Claim: "Lock Auras tagged `tapper-creature` are removal: Claustrophobia ..., Narcolepsy. 72 tapper cards carry `lockdown-creature`." Problem: Narcolepsy has no `lockdown-creature` tag, and the lock regex `Enchanted creature doesn't untap|can't become untapped` does not match it either. So neither exclusion in section 9 catches it. It drops out only because it lacks `repeatable-crime`. Evidence: the helper's tags for Narcolepsy are "intervening-if-clause, removal, removal-creature, tapper, tapper-creature, triggered-ability". Its text is "At the beginning of each upkeep, if enchanted creature is untapped, tap it." `regex.ts` gives "Narcolepsy: lock regex false tag lockdown-creature false". Severity: misleading.

- **Tappers, section 4 and section 9 (Payoff hints).** Omission: two kinds of tapped-creature payoff are not covered. One counts the opponent's tapped creatures ("for each tapped creature your opponents control", the sacrifice ability of Hylda's Crown of Winter). The other bounces a tapped creature (Harbinger of the Tides). The tapped-removal regex covers only destroy, exile, and damage. Evidence: the writer's own `g5-tap.ts` lists "massTapped 14" and "staticOppTapped 11 | Harbinger of the Tides; ... Impetuous Protege". The guide uses neither group. Severity: missing.

## Verdict

needs-fixes. The card facts and the live-matcher numbers are accurate, and the tables are strict enough to reject the owner's failure. But several matcher hints do not work as written: the case of "Tap", the freeze wording, the landfall payoff wording, and "without Sacrifice". The both-jobs examples contradict the guide's own rules (Khalni Heart Expedition, Pelakka Wurm, Icewrought Sentry). The Landfall and Ramp setup bars are stricter than every real precon of those themes in the corpus.
