# Theme rules: the guide as data

**Now in the app's config.** The file lives at `config/theme-rules.json` as rules version 3, loaded and checked by the core (`packages/core/src/theme-rules.ts`); the review tools read the same file, and commands below that name the old path take the new one. Two fixes: a card whose only loot or rummage line is an activation costing four mana or more (generic mana plus colored, hybrid, and colorless pips; `{X}` counts as nothing) is no longer a Graveyard looter, so nine cards count 0.5, not 2, Sphinx's Tutelage ({5}{U}) and Research Assistant ({3}{U}) among them; and Mill is marked `setupNeedsPayoff`, so the builder can keep opponent mill such as Ruin Crab (already Mill setup and no Graveyard job here) out of other themes. Three style keys are new: `kin` (styles that use the same resource, nearest first), `setupNeedsPayoff` (Mill, Group hug, Energy), and `lacks` (for each floor the minimums use, what the pool lacks when it is missed, in plain words). All 708 example cards still land where the guide puts them.

`config/theme-rules.json` (until version 3, `packages/pipeline/src/review/theme-rules.json`) turns the theme guide (`docs/review/themes.md`) into rules a program can apply: for each of the 18 themed styles, the setup jobs, the payoff jobs, the false friends, and the minimums a decent bulk deck needs at 60, 40, 20, and 100 cards. The deck checker (`npm run review:check`, `docs/review/checks.md`) reads it automatically, and the builder prototypes use it to count setup and payoff honestly, each card once.

Rules version 2, data pack 2026-11-03, written 2026-11-08; the calibration below measured it, and version 3 changes only what the note above says. Aggro, Midrange, and Control have no rules: they are plain shapes with nothing to set up or pay off.

## What the file can say

`docs/review/checks.md` ("The rules file format") describes the base format: rules with `job`, `weight`, `anyTags`, `allTags`, `text`, `notText`, and `repeatable`, and an `exclude` list. The guide's hints needed more than tags and text, so `theme-rules.ts` gained these, all optional and checked when the file loads (an unknown key or a bad value stops the run with every problem named):

| Key                       | Where | Meaning                                                                                                                                                                                                                                         |
| ------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notTags`                 | rule  | The card has none of these tags.                                                                                                                                                                                                                |
| `types`, `notTypes`       | rule  | The card has at least one of, or none of, these types (the core's matcher types: creature, instant, sorcery, enchantment, artifact, planeswalker, battle, land, kindred).                                                                       |
| `typeLine`                | rule  | A regular expression over the type line, such as `\\bEquipment\\b`.                                                                                                                                                                             |
| `minMv`, `maxMv`          | rule  | Mana value bounds.                                                                                                                                                                                                                              |
| `minPower`, `maxPower`    | rule  | Power bounds. A variable power such as `*` passes a minimum and fails a maximum; a card without power fails both.                                                                                                                               |
| `keywords`, `notKeywords` | rule  | The card has at least one of, or none of, these keywords (any case).                                                                                                                                                                            |
| `sizes`                   | rule  | The rule applies only at these deck sizes, for jobs the guide weighs differently in Commander.                                                                                                                                                  |
| `priority`                | rule  | Decides a card that meets a setup and a payoff job: the side whose matching rules reach the higher priority wins; at equal priority the old rule holds (setup when its best weight is higher, else payoff). This encodes each "both jobs" part. |
| `minimums`                | style | Per size (`"20"`, `"40"`, `"60"`, `"100"`), a set of floors, or a list of alternative sets of which one must be met.                                                                                                                            |

A rule needs at least one positive condition: `anyTags`, `allTags`, `text`, `types`, `typeLine`, or `keywords`.

Floors in `minimums`:

| Floor                | Counts                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `setup`              | Setup units: copies, each counting its weight capped at 1, so a 0.5 job counts half and a rider (excluded) nothing. |
| `setupWeight`        | Setup weight: copies times weight.                                                                                  |
| `repeatable`         | Copies of setup jobs marked `repeatable`, which mark the cards each style's engine or repeatable floor counts.      |
| `payoff`             | Payoff units, as for setup.                                                                                         |
| `payoffWeight`       | Payoff weight.                                                                                                      |
| `repeatableOrPayoff` | Repeatable setup copies plus payoff units, for Burn, where pingers and payoffs stand in for each other.             |

`countTheme(cards, style, size?)` now also returns `size`, `setupUnits`, `payoffUnits`, and `minimums` (`{ size, met, short }`, where `short` lists each floor missed for the alternative that came closest). Without a size it takes the size nearest the copies counted, so pass every card of the deck, basics and the commander included, as the checker does. `checkMinimums` and `nearestThemeSize` are exported for the prototypes. Every checker result therefore says whether the deck meets its style's minimums, without any change to `check.ts`. Tests: `packages/pipeline/test/review-theme-rules.test.ts`.

The format has no place for notes, so the reasons behind each rule live in this document.

## How the rules were derived

Six agents, one per group of the guide (g1 to g6), each took their group's styles and wrote rules from parts 3 (setup jobs), 4 (payoff jobs), 5 (false friends), 6 (both jobs), and 9 (matcher hints), starting from the patterns the guide writers had already tested in their scratch scripts (`g1fix/hints.ts`, `g2fix4/*.ts`, `g3fix/hints.ts`, `g4fix/hints.cjs`, `g5fix/final.ts`, `g6fix/rx2.mjs`). The drafts were merged (`node data/review/scratch/tr/merge.ts`) and then adjusted after calibration (`node data/review/scratch/tr/adjust.mjs`, see Adjustments).

Shared choices:

- **Text prep.** Rules read oracle text with reminder text removed, case-insensitive and multiline, so `^` starts a line. Patterns use `[^.\n]` so one match cannot run across two abilities. A leading ability word such as "Landfall" and its dash is allowed with `^([^\n\u2014]*\u2014 )?` (`\u2014` is the dash, escaped in JSON). An activated cost is the text before the colon on its line, `^[^:\n]*\{T\}[^:\n]*:`.
- **Weights** are the guide's. Repeatable setup is about 2, one-shot setup 1, small one-shots 0.5, riders excluded or 0.5 where the guide says so. Payoffs carry the weights of part 4, which mostly encode how much resource each needs.
- **Tags as hints.** A tag starts a rule but rarely ends it: most tag rules also carry `text`, `notText`, or `notTags`, as the guide's false friends demand (`mill-self` alone, for instance, never makes a card setup).
- **Exclusions per job.** Most false friends are kept out of one job with `notText` or `notTags`. The style's `exclude` list, which removes a card from both jobs, is used only where the guide says a card is neither: Graveyard (`restock`), Lifegain (`hate-lifegain`, `keyword-soup`, drawback creatures, lands), and Tappers (lock Auras, which are removal).
- **Both jobs** are settled with `priority`, as each style's part 6 says. Aristocrats: outlet over payoff over fodder. Graveyard: real setup (weight 1 or more) over payoffs, but a payoff whose body needs a full graveyard (`lhurgoyf`, `cda-power`, `restricted-attacker`) over everything. Lifegain and Artifacts and Enchantments: payoffs over setup, so Oloro, Bloombrute, Etherium Sculptor, and Jukai Naturalist count as payoffs, while a weight-0 marker rule keeps Lone Rider as setup. Energy: the guide's one-job order (get trigger, multiplier, variable spend, sink, maker) as descending priorities.
- **Minimums** are the lower end of each part 7 range in the unit the table counts. Where a table gives "X+ engines, or setup Y+" (Counters), the floors are two alternatives. Where a table counts sources that include payoffs (Artifacts, Enchantments), the setup floor is the source floor minus the payoff floor, since a card counts once.

### Per style

Floors: S setup units, Sw setup weight, R repeatable copies, P payoff units, Pw payoff weight, R+P repeatable plus payoff.

| Style        | 60                          | 40                        | 20                        | 100                         |
| ------------ | --------------------------- | ------------------------- | ------------------------- | --------------------------- |
| tokens       | S 9, R 4, P 6 or S 12, P 6  | S 6, R 3, P 4 or S 8, P 4 | S 3, R 2, P 2 or S 4, P 2 | S 14, R 7, P 8 or S 18, P 8 |
| counters     | S 10, R 4, P 5 or S 13, P 5 | S 6, R 3, P 3 or S 9, P 3 | S 3, R 2, P 2 or S 5, P 2 | S 14, R 7, P 8 or S 22, P 8 |
| aristocrats  | S 12, R 3, P 4              | S 8, R 2, P 3             | S 4, R 1, P 2             | S 16, R 5, P 6              |
| graveyard    | Sw 8, R 2, Pw 6             | Sw 5, R 1, Pw 4           | Sw 3, Pw 2                | Sw 14, R 6, Pw 10           |
| spells       | S 15, P 6                   | S 9, P 5                  | S 3, P 3                  | S 24, P 8                   |
| lifegain     | S 10, R 8, P 6              | S 7, R 5, P 4             | S 5, R 3, P 3             | S 16, R 12, P 10            |
| artifacts    | S 10, P 6                   | S 6, P 4                  | S 4, P 3                  | S 20, P 10                  |
| auras        | S 12, Sw 18, P 8            | S 7, Sw 11, P 5           | S 2, Sw 4, P 1            | S 18, Sw 30, P 8            |
| flyers       | S 10, Sw 17                 | S 9, Sw 14                | S 4, Sw 6                 | S 18, Sw 30                 |
| burn         | S 10, Sw 14, R+P 4          | S 7, Sw 10, R+P 3         | S 2, Sw 4, R+P 3          | S 3, Sw 12, R+P 6           |
| landfall     | S 5, P 5                    | S 3, P 3                  | S 1, P 3                  | S 14, P 8.5                 |
| mill         | S 12, R 6, P 2              | S 8, R 4, P 1             | S 6, R 4                  | S 16, R 8, P 3              |
| enchantments | S 8, P 6                    | S 5, P 4                  | S 3, P 3                  | S 20, P 10                  |
| bigCreatures | S 6, R 6, P 6               | S 4, R 4, P 4             | S 2, R 2, P 2             | S 10, R 10, P 12            |
| tappers      | S 8, R 4, P 2               | S 5, R 3, P 1             | S 3, R 2, P 1             | S 15, R 8, P 4              |
| groupHug     | S 10, R 4, P 6, Pw 10       | S 6, P 4                  | S 4, P 3, Pw 5            | S 10, R 6, P 6              |
| goad         | S 10, R 6, P 4              | S 7, P 3                  | S 5, P 2                  | S 15, R 10, P 5             |
| energy       | S 8, R 3, P 8, Pw 12        | S 6, P 6                  | S 4, P 4                  | S 12, R 6, P 10             |

- **Tokens.** Setup: engines (a token-making line after `{T}`, a mana cost, "at the beginning of", or "whenever"; Mobilize and Myriad) at 2, engines fed by another resource or making temporary tokens at 1, bursts of two or more at 1 (temporary 0.5), a creature plus one token at 0.5. Payoffs: lasting anthems and enters triggers at 2, team pump, count scalers, and lasting keyword anthems at 1, convoke and tap-for-value at 0.5. Repeatable marks engines. Typal lords, `nontoken` and "opponent controls" payoffs, and sweepers that scale with creatures are left out per job.
- **+1/+1 counters.** Setup: spreaders 2 (1 with the hidden cost Forcemage Advocate has), mass placers 1.5, single placers 1 (0.5 on removal), self-growers 1 (evolve, outlast, training, adapt, and `gains-pp-counters` without any other job, not on cards that spend their own counters or need a planeswalker), one-time self-growth and "enters with" counters 0.5. Repeatable marks growth engines: spreaders, mass placers, self-growers, as the table counts them. Payoffs: counter lords, damage triggers, and multipliers 2, cash-ins and "+1/+1" rewards 1, small rewards 0.5. `counters-matter` counts only when the text names +1/+1 counters or proliferate.
- **Aristocrats.** Setup is outlets plus fodder: repeatable and value outlets 2 (repeatable), one-shot outlets 0.5, token engines 2, fed token engines and bursts 1, creatures with a death trigger with value (persist, undying, afterlife included) and self-recurring creatures 1, a creature plus one token and weak fodder 0.5. Payoffs: drain, value, and sacrifice triggers 2, nontoken-only 1, scry riders 0.5, and morbid 0.5 (added in calibration). The value-outlet rule of part 4, which lowers the payoff floor by one per value outlet, is not encoded.
- **Graveyard.** Setup: looters and rummagers on a permanent, Dredge, and self-mill of two or more every turn at 2; one a turn, tap-cost discard, free discard and free sacrifice outlets at 1; loot spells with flashback 1.5; big one-shot self-mill, entomb, two-card loot spells, and "mill two on enters and dies" at 1; one-card loots, cycling, one-shot sacrifice or discard, attack-triggered self-mill of one, and "mill two once" on a creature with no other job at 0.5. Riders (surveil 1 or 2 and small mill on removal, counters, bounce, and draw spells) match nothing. Payoffs: reanimation, graveyard counts, delve and escape, and graveyard-exile costs at 1; regrowth, self-recursion, and flashback at 0.5. The "when reanimating" upgrades (entomb 1.5, cycling a creature 1) need the deck, so the rules use the weights without them.
- **Spellslinger.** Setup is every instant and sorcery, weighted by mana value (1 at 2 or less, 0.75 at 3, 0.5 at 4, 0.25 at 5 or more) plus 0.25 for a cantrip and 0.5 for casting from the graveyard; Adventure spells 0.75; cost reducers 2; spell regrowth 1. Payoffs are permanents: cast triggers and Prowess 1, instant and sorcery graveyard counts 1, density checks 0.5, minus restricted mana, impulse draw, and flash grants. The table counts spells and cheap spells as two columns; the setup floor in units approximates both (15 at 60: about 12 cheap spells and a few dearer ones).
- **Lifegain.** Setup: lifelink creatures and repeatable gainers 2 (1 at mana value 5 or more), one-shot gainers 1 (0.5 at 5 or more); gains on removal or counterspells, one-turn lifelink, and gifts to the opponent match nothing. Payoffs: per event, once a turn, threshold, and amount at 1; removal with a lifegain clause, increasers, and life-total clauses at 0.5, the last only below 100 (`sizes`).
- **Artifacts.** Setup: every artifact card 1 (0.5 at mana value 5 or more), artifact lands 1, artifact token makers 1 (half on instants, sorceries, and at 5 or more), repeatable token makers 2. Payoffs: count, enters, cast, and sacrifice payoffs 1; cost reducers and one-artifact conditions on a non-artifact 0.5. `hate-artifact` never pays off.
- **Voltron.** Setup: Equipment 2 and sticky Auras (umbra armor, bestow, return to hand) 1.5, both repeatable; buff Auras that enchant a creature 1, with hostile Auras (shrink, humble, prevent-blocker, can't attack or block, goaded, slow death) left out; Aura and Equipment finders 1; Skullclamp-style and shroud-granting Equipment left out. Payoffs: cast and enter engines, Heroic, and Valiant 2; carriers (creatures at mana value 3 or less with hexproof, double strike, or evasion, power 1 or more, no Defender) and equipped or enchanted bonuses 1; power-0 carriers 0.5.
- **Evasion.** Setup: evasive attackers (Flying, Menace, Shadow, Fear, Intimidate, Skulk, Horsemanship, fake flying, "can't be blocked") at 2 with power 2 or more or variable power, 1 at power 1; landwalk and conditional unblockable at half that; lasting team flying granters and attack or tap granters 2, flying Auras and Equipment 1, all repeatable. Defenders, "can't attack", and power 0 never count. Payoffs: flyer lords 2, lasting anthems, flyer triggers, and discounts 1, without typal or flyer hate. Payoffs are not required.
- **Burn.** Setup: instants and sorceries that can hit a player 1 (riders and "each player" left out), pingers that reach a player and punishers on opponents' actions 2 (repeatable), punishers that name "a player" only at 100, enters or dies damage on a creature 0.5. Payoffs: spells into damage 2; Prowess, prowess-like, and spell pumps 1; tokens on cast 0.5. Cards whose damage needs another theme's engine (Impact Tremors) are not Burn setup.
- **Landfall.** Setup: land ramp, extra land drops, land recursion (tags, minus donate and theft) 1; fetch and bounce lands 1; repeatable "put a land from hand" engines 2; land swaps on your own land 0.5. Payoffs: lasting rewards per land 1, one-turn rewards 0.5, one-turn keywords and thresholds 0.25, without `landfall-other`; a card that also makes lands enter is setup.
- **Mill.** Setup: engines that mill an opponent two or more a turn 2, one a turn 1, fed engines (another creature enters, attacks, damage, "mills that many") 1, all repeatable; big one-shots 1, small ones 0.5, riders on counters, removal, and bounce left out. Payoffs: `synergy-mill` that rewards the opponent's library or graveyard, opponents' graveyard counts 1, multipliers 2.
- **Enchantments.** Setup: every enchantment 1 (0.5 at 5 or more), enchantment and Role token makers 1, repeatable ones 2. Payoffs: enchantress, constellation and eerie, count, and leaving payoffs 1; cost reducers and one-enchantment conditions 0.5; enchantment hate, enchantment removal, and Shrines never pay off.
- **Ramp.** Setup (nonland, mana value 4 or less): mana creatures, rocks, and land ramp 1, and tap-for-mana lines without a sacrifice 1, all lasting (repeatable); creature cheats 1 and creature cost reducers 0.5, lasting; one-shot bursts and basic land to hand 0.25. Rituals, mana eggs, restricted mana, and donate cards left out. Payoffs: creatures at 6 or more with power 5 or more, or power 4 with Flying, Trample, or an enters trigger, 1; the same at mana value 5, 0.75; X spells and X creatures 1. Defenders and "can't attack" never count; mana value 4 and less is never a payoff.
- **Tappers.** Setup: repeatable tappers 2, enters tappers 1 (1.5 with freeze), tap spells 0.5 for one creature and 1 for several (1.5 times with freeze). Lock Auras are excluded as removal. Payoffs: tap-trigger engines 1, tapped-only removal and tapped counts or bounce 0.5.
- **Group hug.** Setup: repeatable symmetric draw 2, one-shot draw gifts 1, flexible "target player draws" 0.5, land and mana gifts 1 only at 100. Gift riders, cumulative upkeep, draw stax, and life gifts left out. Payoffs: draw punishers and repeatable full-hand punishers 2, one-shot full-hand burn 1. The "4+ punishers" sub-floor is approximated with payoff weight (Pw 10 with P 6 at 60 means at least four weight-2 punishers).
- **Goad.** Setup: lasting forcers (trigger, activated, static) 2, repeatable; pump and goad 2 at 100 (repeatable) and 1 below; one-shot forcers 1, one-turn tricks on one creature 0.5; symmetric forcers 1 at 100 and 0.5 below. Forcing your own creatures never counts. Payoffs: attack drains and punish triggers 1, and `attacking-opponents-matters` 0.5 at 100 only. Granted abilities in quotes cannot be stripped as the guide's prep does, so a few such cards may match.
- **Energy.** One job per card in the guide's order: get triggers and variable spends are payoffs, the multiplier is setup, sinks with an activated or triggered spend are payoffs (2 when repeatable), makers without a counted spend are setup (repeatable 2, three or more {E} 1.5, else 1). Mana-only spends do not count. Over the energy cards this gives 31 setup and 112 payoffs at 60; the guide's split is 30 setup, 100 payoffs, 9 self-fed (counted here as payoffs, as part 6 says), and 1 multiplier. The 60 floor Pw 12 with P 8 asks for at least four repeatable sinks.

### Checked on the guide's example cards

Every example card each section names (setup jobs, payoff jobs, false friends, both-jobs cards) was put in a list with the job the guide gives it, and the rules were fixed until all matched: 708 of 708 (tokens, counters, aristocrats 115; graveyard, spells, mill 114; lifegain, artifacts, enchantments 109; Voltron, Evasion, Burn 120; Landfall, Ramp, Tappers 127; Group hug, Goad, Energy 123). The lists include the owner's failure cases: Price of Fame, Ephara's Dispersal, and Hymn of the Faller are neither Graveyard job; Merfolk Looter, Careful Study, Faithless Looting, and Wild Mongrel are setup.

```sh
node data/review/scratch/tr/tool.ts packages/pipeline/src/review/theme-rules.json examples data/review/scratch/tr/g1-expect.json
```

(and `g2` to `g6`). `tool.ts ... card <style> <name>` shows which rules a card meets; `show <style> <job>` samples a job's cards.

## Matches in the whole pack

Every card in the pack except Un-sets (32,895), at size 60, each card once (`node data/review/scratch/tr/tool.ts <rules> counts --size 60`, output `data/review/scratch/tr/counts60.out`; `--size 100` in `counts100.out`). "Excluded" are cards an exclude rule removed from a job they met.

| Style        | Setup | Payoff | Excluded | Largest setup jobs                                                                                                        | Largest payoff jobs                                                                 |
| ------------ | ----- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| tokens       | 1,629 | 768    | 0        | token engine 720; burst 471; creature plus one token 232; fed engine 200                                                  | enters trigger 188; team pump 166; count scaler 151; tap for value 106              |
| counters     | 2,339 | 250    | 0        | self-grower 844; grows itself once 696; spreader 350; single placer 211                                                   | rewards counters 91; multiplier 90; counter lord 34                                 |
| aristocrats  | 2,682 | 359    | 0        | token engine fodder 739; death-trigger fodder 616; burst 486; repeatable outlet 236; one-shot outlet 157; value outlet 67 | drain or value 146; morbid 117; nontoken only 51                                    |
| graveyard    | 2,083 | 2,082  | 65       | cycling 326; big self-mill 308; looter on a permanent 300; one-shot sacrifice or discard 280; one-card loot 246           | self-recursion or flashback 553; graveyard count 522; reanimation 462; regrowth 277 |
| spells       | 7,438 | 462    | 0        | instants and sorceries at 2 or less 2,685; at 3 1,439; at 5+ 1,388; at 4 1,026                                            | cast trigger 343; prowess 83                                                        |
| lifegain     | 1,980 | 195    | 109      | repeatable gainer 987; one-shot gainer 669; lifelink body 324                                                             | per event 74; once a turn 39; amount 27                                             |
| artifacts    | 4,440 | 453    | 0        | artifact 3,465; repeatable token maker 499; token maker 476                                                               | count 224; enters 79; sacrifice 70                                                  |
| auras        | 1,165 | 1,612  | 0        | Equipment 536; buff Aura 536; bestow 39                                                                                   | carrier 1,433; power-0 carrier 57; Heroic or Valiant 55                             |
| flyers       | 3,971 | 87     | 0        | evasive, power 2+ 2,898; evasive, power 1 562; conditional unblockable 159                                                | lasting anthem 58; flyer trigger 16; flyer lord 13                                  |
| burn         | 747   | 269    | 0        | burn spell 472; pinger 158; one-shot body 84; punisher 33                                                                 | prowess 89; prowess-like 79; spells into damage 43                                  |
| landfall     | 504   | 209    | 0        | land ramp or extra drop 409; fetch land 48; land engine 31; bounce land 12                                                | one-turn reward 96; lasting reward 98                                               |
| mill         | 243   | 65     | 0        | small one-shot 62; engine 2+ 57; fed engine 61; big one-shot 46; engine 1 17                                              | rewards milled opponents 58; opponents' graveyard count 4; multiplier 3             |
| enchantments | 3,679 | 128    | 0        | enchantment 3,618; token makers 61                                                                                        | constellation or enters 60; enchantress 19; count 19                                |
| bigCreatures | 1,542 | 2,917  | 0        | lasting mana or land ramp 790; one-shot burst 428; land to hand 182                                                       | big creature at 6+ 1,402; five-drop 533; X spell 327                                |
| tappers      | 444   | 70     | 0        | repeatable tapper 281; enters tappers 71; tap spells 92                                                                   | tapped-only removal 55; tapped counts 8; tap-trigger engine 7                       |
| groupHug     | 287   | 65     | 0        | flexible draw 101; one-shot gift 98; repeatable draw 88                                                                   | draw punisher 27; repeatable full-hand 25; one-shot full-hand 13                    |
| goad         | 147   | 11     | 0        | one-shot forcer 48; lasting forcers 80; pump and goad 11                                                                  | attack drain or punisher 11                                                         |
| energy       | 31    | 112    | 0        | one-shot maker 26; repeatable maker 4; multiplier 1                                                                       | repeatable sink 84; variable spend 21                                               |

At 100 the size-bound rules change Burn setup (+20 symmetric punishers), Goad payoffs (+23 attacking-opponents rewards), Group hug setup (+42 land and mana gifts), and Lifegain (10 fewer payoffs: life-total clauses count nothing at 100).

The large counts are the ones the guide defines as large: every instant and sorcery is Spellslinger setup, every artifact and every enchantment is a source, every evasive creature is Evasion setup, every big creature is a Ramp payoff, and every cheap evasive or hexproof creature is a Voltron carrier. These matter less than they look, because each also has a payoff side or a weight that the minimums read. Two are broad enough to watch: Aristocrats fodder (about 2,200 cards, since any death trigger with value and any token maker is fodder by the guide) and Voltron carriers (1,433), which let a pile of cheap flyers meet the Voltron payoff floor.

## Calibration against real decks

### The anchor decks

The 170 real anchors in `data/review/decks/real` (40 Commander precons, 40 60-card precons, 60 winning draft decks, 30 Jumpstart packets; `docs/review/anchors.md`) were checked with `npm run review:check -- --decks data/review/decks/real --force` (rules version 2 in every stamp) and counted for every style with `node data/review/scratch/tr/calib.ts <rules> anchors` (output `data/review/scratch/tr/anchors.out`).

- 40 of the 170 meet at least one style's minimums: most often Evasion (11), Graveyard (7), Ramp (5), Artifacts (5), Burn (4).
- Best style by weighted count (setup weight plus payoff weight): Spellslinger 33, Evasion 27, Artifacts 22, Aristocrats 16, Ramp 14, Graveyard 12, Tokens 12. Weighted counts favor the broad styles, so they are a poor way to name a deck's theme. Best style by fit (how close a deck comes to every floor of its size): Evasion 48, Ramp 34, Graveyard 18, Tokens 13.
- For contrast, 183 of the 4,163 random piles in `data/review/decks/random` meet a style (4.4%; `random.out`): mostly Voltron at 20 (55), Evasion (103 across sizes), and Ramp (20). The Voltron 20 row (two attachments, one carrier) is easy to meet by chance.

The anchors' checker results carry no theme verdict, since a real deck's archetype is `none`; the per-style counts come from the scratch script.

### Real decks that name a theme

From `data/corpus/decks.json`, every precon whose name names the theme (patterns in `data/review/scratch/tr/named.json`: "Grave", "Reanimat", "Boneyard" for Graveyard, and so on, plus the decks the guide itself cites as evidence), at its own size. Draft decks carry no theme in their names, so winning draft decks (7 or more wins in at most 9 games, 5,192) were given the style they fit best, when they come at least halfway to every floor of that style (2,647 do). Command: `node data/review/scratch/tr/calib.ts <rules> corpus`, output `data/review/scratch/tr/corpus.out`.

A name can misfire ("Armed and Dangerous" is a Clash Pack with no attachment, "Line of Fire" has one burn spell), so named decks holding under a third of the setup floor were set aside: 24 deck and style pairs, listed as `DROPPED` in the output. Most are clear misfires (Izzet Gizmometry, Unraveling Mind, Psychic Labyrinth, Stampeding Hordes, the four Heavily Armored packets, Deep Freeze Advanced). Three are themed decks that simply lack setup and would fail anyway: Graveyard Bash (no graveyard setup, 3 payoff weight), Forest's Might and Mono-Green Stompy (big creatures, no ramp, which the guide calls midrange), and the burn packet Lightning (1), which the guide also counts as missing its row.

| Style        | Named real decks (by size)         | Meet minimums | Median setup units / payoff units, 60 (or main size) | Winning drafts, best fit: meet / n |
| ------------ | ---------------------------------- | ------------- | ---------------------------------------------------- | ---------------------------------- |
| tokens       | 9 (100: 2, 60: 7)                  | 2 (22%)       | 8.5 / 5.5                                            | 0 / 67                             |
| counters     | 10 (100: 3, 60: 5, 20: 2)          | 3 (30%)       | 10.5 / 6                                             | 3 / 54                             |
| aristocrats  | 8 (100: 2, 60: 4, 20: 2)           | 4 (50%)       | 13.75 / 3.75                                         | 0 / 24                             |
| graveyard    | 23 (100: 5, 60: 8, 20: 10)         | 14 (61%)      | 8 weight / 9 weight                                  | 56 / 374                           |
| spells       | 16 (100: 2, 60: 7, 40: 1, 20: 6)   | 8 (50%)       | 18.75 / 6.5                                          | 37 / 187                           |
| lifegain     | 12 (100: 2, 60: 4, 40: 1, 20: 5)   | 6 (50%)       | 13 / 10                                              | 11 / 55                            |
| artifacts    | 34 (100: 7, 60: 10, 20: 17)        | 13 (38%)      | 18.75 / 5                                            | 95 / 328                           |
| auras        | 9 (100: 2, 60: 4, 20: 3)           | 4 (44%)       | 9.5 / 7                                              | 2 / 29                             |
| flyers       | 33 (100: 4, 60: 10, 40: 2, 20: 17) | 22 (67%)      | 9.5 / 0.5                                            | 92 / 830                           |
| burn         | 6 (60: 3, 40: 1, 20: 2)            | 4 (67%)       | 17 / 4                                               | 0 / 14                             |
| landfall     | 14 (100: 5, 60: 3, 20: 6)          | 9 (64%)       | 7 / 5.75                                             | 20 / 37                            |
| mill         | 2 (60: 1, 20: 1)                   | 1 (50%)       | 7.5 / 3                                              | none                               |
| enchantments | 16 (100: 3, 60: 4, 20: 9)          | 6 (38%)       | 12 / 1                                               | 53 / 131                           |
| bigCreatures | 23 (100: 3, 60: 17, 40: 1, 20: 2)  | 7 (30%)       | 4 / 5.5                                              | 32 / 512                           |
| tappers      | 1 (60: 1)                          | 0             | 3 / 0                                                | 0 / 5                              |
| groupHug     | 2 (100: 2)                         | 0             | 12.5 / 0.5 (at 100)                                  | none                               |
| goad         | 2 (100: 2)                         | 0             | 14.5 / 1.25 (at 100)                                 | none                               |
| energy       | 4 (100: 3, 60: 1)                  | 0             | 8 / 11                                               | none                               |

The output also has a row per style and size for precons by best fit, as a second view; it tells the same story.

Winning draft decks mostly miss (401 of the 2,647 that lean on a theme meet its minimums, 15%). That is expected: drafters take what the packs offer, and the guide's 40 rows describe a deck that names a theme and delivers it, while most winning drafts win on card quality with a light theme. Their medians sit just under the 40 floors (Graveyard 4.5 setup weight against 5, Evasion 6 attackers against 9). They are not a reason to lower the 40 rows.

### Reading the misses

For each theme whose named decks mostly miss, the section of `themes.md` was re-read and the misses looked at card by card (`calib.ts <rules> deck "<name>" <style>`):

- **Tokens** (22%). The engine floor was the main miss. March of the Multitudes, a tuned Modern deck, runs 12 bursts (Lingering Souls, Spectral Procession, Raise the Alarm) and no engine. The guide's own reasoning says bursts stand in for engines (g1 notes, "Two kinds of floor"), and the Counters table already has an "or setup" alternative for the same reason. Adjusted (1 below). The other misses are real: Saproling Swarm has one payoff, Will of the Masses 8 setup, Strength in Numbers 6 to 8.5.
- **Counters** (30%). Rules count as the guide does: Simic Domination and Growing Hunger fall just short on setup, as the guide reports ("9 each" by its count, 8 by these rules). The Commander names misfire or run low, as the guide notes for Swell the Host. Kept.
- **Voltron** (44%). The rules count every Aura and Equipment in these decks; the Arena and Intro decks just run 8 to 10 attachments against the guide's 12 (Auras of Majesty 9, Weapons and Wards 10 with no carrier). The guide's floor rests on draw odds (two attachments by turn 5 in 80% of games) and its one cited 60-card deck, Orzhov Auras, passes. Both Commander precons miss only on carriers, because the commander is the carrier, which a count cannot credit. Kept.
- **Artifacts and Enchantments** (38% each). The misses are payoffs: artifact piles such as the Tinker and Wildfire championship decks and the Treasure packets run few or no artifact payoffs, and the "Enchanted" packets 1 or 2 enchantment payoffs. The guide reports the same ("a packet that names the theme should hold 3"; "No 60-card precon in the corpus builds around enchantment payoffs"). Kept.
- **Ramp** (30%). Most big-creature precons run 3 or 4 lasting ramp pieces. The guide expects this ("Those play as midrange with big creatures, which is decent but not Ramp"), and the three it names as real ramp decks, Wicked Big, Massive Might, and Stomp, Stomp, run 6 to 8. Stomp, Stomp misses on payoffs: its big bodies cost 4, which part 5 rules out. Kept.
- **Landfall.** The draft counted payoffs in units (one-turn rewards half) against floors the guide wrote in copies with a lasting sub-floor, so Zendikar and the guide's own evidence fell short. Converted (4 below). After it 64% meet, all six Landfall packets included; the Commander "lands" precons still miss on landfall payoffs, which the guide's 100 row takes from EDHREC lists.
- **Mill** (1 of 2). The rules missed "target player mills that many cards" on a trigger, so the Milling packet lost two engines. Fixed (2 below); the packet now meets its row. Dimir Dementia still misses with 4 engines against 6: the guide sets the floor "a little more" than real decks on purpose. Kept.
- **Aristocrats** (50%). The Morbid packets had no payoff at all: they pay off deaths with morbid cards (Wakedancer, Morkrut Banshee, Reaper from the Abyss), a job the guide does not list. Added at 0.5 (3 below); Morbid 2 now meets its row, Morbid 1 misses setup by half a card.
- **Graveyard** (61%). Four of the eight 60-card named decks pass, close to the guide's "three of the seven"; all ten Jumpstart packets pass; the Commander precons miss, as the guide expects ("the row follows the EDHREC lists"). Kept. One rule fixed while checking the built decks (5 below).
- **Energy, Group hug, Goad** (0 of 4, 2, 2). Every named deck is a Commander precon or the one Kaladesh Planeswalker Deck, and every miss is on the job the commander does. The guide says so for each: "Both precon commanders spend more than they make, so add 3 to 4 makers" (Energy at 100, 7 to 8 makers against 12); each hug precon's commander "gives cards every turn" and both have 0 or 1 payoffs; both goad precons rely on a goading commander and hold 1 to 1.5 payoffs. With two decks each and a commander the count cannot credit, the evidence is too thin to move the guide's numbers. The 60-card Energy deck misses by one repeatable maker. Kept; see Limits.
- **Spellslinger, Lifegain, Evasion, Burn** (50% to 67%). Misses are near the floors (Izzet League 14.5 of 15 setup, the Healers packets 2.5 of 3 payoffs, the flyer decks 7 to 9 attackers of 10) or decks that are not really the theme (the two Spellslinger Starter Kits hold no spell payoff). Kept.

## Adjustments

All in `data/review/scratch/tr/adjust.mjs`, applied after merging the drafts; every example card still lands where the guide puts it.

1. **Tokens: an "or setup" alternative.** Each size also passes with the top of the guide's setup range and no engine floor: 12 at 60, 8 at 40, 4 at 20, 18 at 100, with the same payoff floor. Reason: bursts stand in for engines (g1 notes), as Counters' table already allows. Effect: March of the Multitudes passes; no Tokens deck that misses on payoffs passes.
2. **Mill: "mills that many" engines.** A new setup rule, fed engine at 1, repeatable: an opponent-mill card whose trigger mills "that many" (Towering-Wave Mystic, Belltower Sphinx, Mindcrank; 7 cards counted). The guide's amount pattern lists only numbers. Also, every Mill amount pattern accepts "mill" as well as "mills", so "you may have target player mill a card" (Jace's Erasure, a guide example) counts.
3. **Aristocrats: morbid.** A payoff at 0.5 for the `morbid` tag (117 cards counted): one death this turn, a light payoff like Landfall's thresholds. Not in the guide; added because both real Morbid packets are built on it.
4. **Landfall: payoff floors in units.** The guide's "8 to 12 (2+ lasting)" at 60 counts copies. In units (lasting 1, one-turn 0.5) its lowest case, 2 lasting and 6 one-turn, is 5. So P 5 at 60, 3 at 40 (5 copies, 1 lasting), 3 at 20 (5, 1), 8.5 at 100 (13, 4). This is a unit conversion, not a looser rule.
5. **Graveyard: "becomes tapped" is an attack trigger.** Starfighter Pilot ("Whenever this creature becomes tapped, surveil 1") counted as a repeatable engine; it fires on attack or a tap cost, so it now counts like Fear of Surveillance, 0.5 and not repeatable. `docs/review/our-builder-themes.md` calls both riders.

Version 1 was the merged draft; version 2 has these changes. Changing the version recomputes every stored check.

## The owner's bad Graveyard deck

The deck the owner found was built from his own bulk, which stays private. The public pools show the same failure, so the head builder (26.0.35) and the builder before the learned work (26.0.30) built Graveyard decks from them:

```sh
npm run review:build -- --version head --pool eval/pools/bulk-blue.txt --colors U --size 60 --style graveyard
npm run review:check -- --decks data/review/decks/head/bulk-blue-U-60-graveyard-s1.json ... --force --out data/review/scratch/tr/gy-check
```

| Deck                 | Setup weight | Repeatable | Payoff weight | Minimums (Sw 8, R 2, Pw 6)       | Checker theme flags             |
| -------------------- | ------------ | ---------- | ------------- | -------------------------------- | ------------------------------- |
| head, bulk-blue U    | 12           | 4          | 3.5           | fails: payoff weight             | theme-no-payoff                 |
| head, white-bulk W   | 3            | 0          | 8.5           | fails: setup, repeatable         | theme-no-setup                  |
| head, bulk-black B   | 2.5          | 0          | 7.5           | fails: setup, repeatable         | theme-no-setup                  |
| head, bulk-green G   | 4            | 0          | 4.5           | fails: setup, repeatable, payoff | theme-no-setup, theme-no-payoff |
| 26.0.30, bulk-blue U | 6            | 1          | 1             | fails: all three                 | theme-no-setup, theme-no-payoff |

All five fail the Graveyard minimums.

- The white and black decks are the owner's failure: payoffs (Jolted Awake, Dusk // Dawn, Graveblade Marauder, Souls of the Lost) and setup that is riders. Fear of Surveillance and Starfighter Pilot count 0.5 each, Hymn of the Faller, Mephitic Vapors, and Price of Fame count nothing, so the setup weight is 3 and 2.5 against 8.
- Today's blue deck is a different deck from the one the owner saw: it now holds real setup (Teferi's Imp and Sphinx's Tutelage as looters, Winternight Stories, Riptide Survivor, Fact or Fiction) and fails on payoffs instead, which are flashback cards worth 0.5 each. That matches the verdict in `docs/review/our-builder-themes.md`: "real setup, payoffs thin, plays as a blue tempo deck".
- The checker's theme flags now read these minimums (`docs/review/checks.md`, Flags). On their old placeholder thresholds (weighted setup 3 and 2 payoff copies at 60) they passed both blue decks and called the white and green decks merely unbalanced.

## Limits

- **Commander credit.** A commander that does a job (Oloro, Light-Paws, a goading or hugging commander, Prossh as an outlet) lowers that job's floor in the guide. The count sees the commander as one card, so Commander decks built around one read short. This explains most Commander misses above.
- **Deck-aware weights.** "When reanimating" (Graveyard entomb and cycling upgrades), "when the deck has creature payoffs" (sacrifice outlets as Graveyard setup), and the Aristocrats value-outlet reduction of the payoff floor need the rest of the deck; the rules use the plain weights.
- **Sub-floors with no floor key:** cheap sources (Artifacts and Enchantments at mana value 3 or less), lasting Landfall payoffs (approximated by units), punishers (approximated by payoff weight), "7+ at power 2+" for Evasion, and "count only artifact cards when cast payoffs dominate".
- **Text prep.** Rules cannot strip granted abilities in quotes or split sentences, as the Goad and Group hug hints do; `[^."\n]` classes and `notText` approximate it.
- **Small samples.** Tappers, Mill, Group hug, Goad, and Energy have one to four named real decks. Their minimums rest on the guide's draw math, not on real decks.
- **The checker.** Its theme flags (`theme-no-setup`, `theme-no-payoff`, `theme-unbalanced`) read the minimums verdict since checker version 3; the placeholders in `THRESHOLDS` apply only to a style without minimums. `docs/review/checks.md` describes the base rules format; this document describes the additions.

## Reproduce

```sh
node data/review/scratch/tr/merge.ts 1                      # drafts g1..g6 into theme-rules.json
node data/review/scratch/tr/adjust.mjs                      # calibration adjustments
npx prettier --write packages/pipeline/src/review/theme-rules.json
node data/review/scratch/tr/tool.ts packages/pipeline/src/review/theme-rules.json counts --size 60
node data/review/scratch/tr/calib.ts packages/pipeline/src/review/theme-rules.json anchors
node data/review/scratch/tr/calib.ts packages/pipeline/src/review/theme-rules.json anchors data/review/decks/random
node data/review/scratch/tr/calib.ts packages/pipeline/src/review/theme-rules.json corpus
npm run review:check -- --decks data/review/decks/real --force
```

Then set `version` to the next number. Scratch files are gitignored; the JSON, `theme-rules.ts`, its tests, and this document are the record.
