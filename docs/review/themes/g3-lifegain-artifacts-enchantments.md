# Theme guide: Lifegain, Artifacts, Enchantments

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

### Lifegain (lifegain)

**1. Plan.** Gain a little life several times a turn with lifelink creatures and Soul Warden effects, and let cards like Ajani's Pridemate grow or drain each time.

**2. Resource.** Life-gain events, not life points: each source that gains life is one event (rules 119.9, 702.15e). A repeatable source makes about one a turn, a one-shot card one in total. Only "that much", amount, and threshold payoffs care about the amount. Increasers ("you gain that much life plus 1 instead") raise the amount of each event, not the number of events.

**3. Setup jobs.**

- **Lifelink bodies**, repeatable, weight 2. Healer's Hawk (common): "Flying / Lifelink". Vampire Nighthawk (uncommon): "Flying / Deathtouch / Lifelink".
- **Trigger gainers**, repeatable, weight 2. Soul Warden (common): "Whenever another creature enters, you gain 1 life." Basilica Screecher (common): "Extort".
- **Granters and Food engines**, repeatable, weight 2. Lifelink (common): "Enchanted creature has lifelink." Eager Trufflesnout (uncommon): "Whenever this creature deals combat damage to a player, create a Food token."
- **One-shot gainers**, weight 1, 0.5 at mana value 5 or more. Lone Missionary (common): "When this creature enters, you gain 4 life." Revitalize (common): "You gain 3 life. Draw a card." Enters and dies gains on creatures belong here.
- **Riders**, weight 0. A gain on removal or a counterspell (a Food included), or a one-turn lifelink grant on an instant or sorcery. Fell the Pheasant (common): "deals 5 damage to target creature with flying. Create a Food token."

**4. Payoff jobs.**

- **Per event**, the core. Ajani's Pridemate (uncommon) and Celestial Unicorn (common): "Whenever you gain life, put a +1/+1 counter on this creature." Marauding Blight-Priest (common): "each opponent loses 1 life." Wax-Wane Witness (common): "Whenever you gain or lose life during your turn, this creature gets +1/+0 until end of turn."
- **Once a turn.** Bloombrute (uncommon): "draw a card. This ability triggers only once each turn." Ulna Alley Shopkeep (common): "This creature gets +2/+0 as long as you gained life this turn." Foolish Fate (uncommon), "Destroy target creature." with an Infusion rider, is half a payoff: the removal works without the theme.
- **Threshold.** Griffin Aerie (uncommon): "if you gained 3 or more life this turn". Needs a 3-power lifelinker or two sources.
- **Amount.** Sanguine Bond (uncommon): "target opponent loses that much life." Nightmare's Thirst (uncommon): "Target creature gets -X/-X until end of turn, where X is the amount of life you gained this turn."
- **Increasers**, half a payoff. Angel of Vitality and Honor Troll (uncommon): "If you would gain life, you gain that much life plus 1 instead." They help amount and threshold payoffs and do nothing for per-event ones. They make no events, so they are never setup.
- **Life total**, half a payoff. Twinblade Paladin (uncommon): "As long as you have 25 or more life". Slow from 20 life; always on from Commander's 40 (rule 903.7), so at 100 the clause is free and is not a payoff. Count the card by its other text: Twinblade Paladin also reads "Whenever you gain life, put a +1/+1 counter on this creature", so it stays a per-event payoff at every size.

**5. False friends.** Checked with the helper.

- `lifegain` marks any gain. Swords to Plowshares: "Its controller gains life" (the opponent; `opponent-lifegain`). Moment of Craving: removal plus "You gain 2 life." Anodet Lurker: "When this creature dies, you gain 3 life", a one-shot at mana value 5. Bake into a Pie: removal plus one Food.
- `gives-lifelink` on one-turn grants: Archon's Glory, lifelink "until end of turn" if bargained.
- `synergy-lifelink`: Thunderous Orator copies lifelink among eight keywords (`keyword-soup`) and counts as both.
- `lifegain-matters` on the wrong player: Kavu Predator, "Whenever an opponent gains life".
- Food reminder text: every Food maker reads "{2}, {T}, Sacrifice this token: You gain 3 life." A text search that does not drop reminder text calls Bake into a Pie a repeatable gainer.

**6. Both jobs.** If the reward reads "whenever you gain life", scales, or checks a total, it is a payoff (Indulging Patrician, Cat Collector). Oloro, Ageless Ascetic gains life ("At the beginning of your upkeep, you gain 2 life.") but also reads "Whenever you gain life, you may pay {1}. If you do, draw a card and each opponent loses 1 life.": a payoff. If the card makes its own events and the reward only improves itself, it is setup: Lone Rider is a 1/1 with "First strike, lifelink" that transforms after 3 life in a turn.

**7. Enough for a decent bulk deck.** Copies, riders left out.

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

**8. Where the live matchers differ.**

- Enabler #1 `anyTags lifegain` takes 1,548 bulk cards (7.7%), so almost any white, black, or green pool meets the minimum of 8. Only 738 (48%) are repeatable; 201 are removal with a gain rider. `our-builder-themes.md` found 11 of 15 setup copies were riders in its black deck.
- No weight: Revitalize counts like Soul Warden; `opponent-lifegain` counts as setup.
- Payoff #1 is mostly right (72 of 94 pass a strict rule); `synergy-lifelink` and `hate-lifegain` slip in. 28 bulk cards count as both (Bloombrute).

**9. Matcher hints.** Every pattern runs on oracle text with reminder text (anything in parentheses) removed, case-insensitive, with `^` matching each line start (flags `im`). Removing reminder text keeps Food's "Sacrifice this token: You gain 3 life." out of every pattern.

- Repeatable setup, weight 2 (1 at mana value 5 or more): `repeatable-lifegain`, or keyword Lifelink on a creature, or, on a permanent only, text `whenever [^.]*you (may )?gain (\d+|x|that much) life`, `at the beginning of [^.]*you gain (\d+|x) life`, `\{t\}(?![^:]*sacrifice)[^:]*: [^.]*you gain[^.]*\.(?! (shuffle|exile) this)`, `\bextort\b`, `(enchanted|equipped) creature has lifelink`; minus `opponent-lifegain`. "You gain (\d+|x) life" leaves out "you gained", so threshold payoffs do not count as setup. On an instant or sorcery a "whenever" gain lasts one turn (Death Frenzy: "Whenever a creature dies this turn, you gain 1 life."), so it is a one-shot at most. Elixir of Immortality ("{2}, {T}: You gain 5 life. Shuffle this artifact and your graveyard into their owner's library.") is one-shot too.
- One-shot, weight 1 (0.5 at mana value 5 or more): `lifegain` that is not repeatable. Enters and dies gains land here (Lone Missionary).
- Rider, weight 0: `lifegain` with `removal` or `counterspell` (Moment of Craving, Bake into a Pie, Fell the Pheasant); `lifelink until end of turn` on an instant or sorcery with no other gain (Archon's Glory); `(its controller|each player) gains` with no "you gain".
- Payoffs, weight 1: `pridemate`, `lifegain-to-damage`; text `whenever you gain life|whenever you gain or lose life` (per event); `you gain life for the first time each turn|(if|as long as) you gained (or lost )?life this turn`, or "whenever you gain life" with `only once each turn` (once a turn); `gained \d+ or more life` (threshold); `amount of life you('ve)? gained this turn|whenever you gain life[^.]*that much` (amount). `lifegain-matters` alone is not enough: take it only with one of these texts, which drops Kavu Predator.
- Half payoffs, weight 0.5: any payoff above that also carries `removal` (Foolish Fate, Nightmare's Thirst); `lifegain-increaser` (Angel of Vitality); text `you have \d+ or more life|more life than (an|each|that) (opponent|player)` (life total), except at 100, where the clause counts zero and the card counts by its other text.
- Count once: a card that is repeatable setup and whose payoff text only improves itself (`transform`, "this creature gets", "counter on this creature", with no drain, draw, or token) stays setup (Lone Rider). Every other card that meets a payoff rule is a payoff (Oloro, Bloombrute).
- Exclude: `hate-lifegain`; `keyword-soup` (Thunderous Orator); `drawback` unless the card also carries `pridemate` or `lifegain-to-damage`. That keeps Wall of Limbs and Starscape Cleric and drops Lurking Roper, whose "Whenever you gain life, untap this creature." only undoes its own drawback.

Bulk under these hints (`g3fix/bulk.txt`): 706 repeatable, 556 one-shot, 221 riders, 88 payoffs. No card is repeatable through text alone. The earlier patterns added 99 cards beyond the tags, 20 of them removal (Fell the Pheasant, Food Coma) and 9 payoffs (Griffin Aerie, Cat Collector), through Food reminder text and "you gained". The earlier once-a-turn pattern took "first time each turn" and "only once each turn" with no life in sight and matched 194 unrelated cards; now all 28 once-a-turn payoffs mention life. The 8 payoffs the earlier patterns missed now match (Ulna Alley Shopkeep, Wax-Wane Witness, Nightmare's Thirst).

### Artifacts (artifacts)

**1. Plan.** Fill the board with cheap artifacts and artifact tokens, then let cards that count, trigger on, or sacrifice them take over.

**2. Resource.** Artifacts you control. Units: one on the battlefield (count payoffs), one entering (tokens and lands count), one artifact spell cast (tokens and lands do not), one to sacrifice. Treasure, Clue, and Food are artifact tokens (rule 111.10) that leave when used. Artifact lands are artifacts that enter and stay, but they are played, not cast.

**3. Setup jobs.**

- **Cheap artifacts that stay**, weight 1, mana value 3 or less. Ornithopter (common): "Flying" for {0}. Iron Myr (common): "{T}: Add {R}." 5-drops rank at half.
- **Artifact lands**, weight 1, no spell slot. Seat of the Synod (common): "{T}: Add {U}." They feed count, enters, and sacrifice payoffs, not cast payoffs. Take them in place of basics when the pool has them in the deck's colors.
- **One-shot token makers**, weight 1, half on instants and sorceries and at mana value 5 or more. Thraben Inspector (common): "When this creature enters, investigate." Aviation Pioneer (common): "create a 1/1 colorless Thopter artifact creature token with flying." Beamsaw Prospector (common): "When this creature dies, create a Lander token."
- **Repeatable token makers**, weight 2. Flamewright (uncommon): "{1}, {T}: Create a 1/1 colorless Construct artifact creature token". Floodhound (common): "{3}, {T}: Investigate."

**4. Payoff jobs.**

- **Count**, three artifacts by turn 4 or 5. Carapace Forger (common): "+2/+2 as long as you control three or more artifacts." Frogmite and Thoughtcast (common): "Affinity for artifacts". Chief of the Foundry (uncommon): "Other artifact creatures you control get +1/+1."
- **Enters**, about one a turn. Reckless Fireweaver (common): "Whenever an artifact you control enters, this creature deals 1 damage to each opponent."
- **Cast**, artifact cards only. Embersmith (uncommon): "Whenever you cast an artifact spell, you may pay {1}."
- **Cost reducers**, half a payoff, the same rule as in Enchantments. Etherium Sculptor (common): "Artifact spells you cast cost {1} less to cast." The reward is mana for each artifact spell, which needs the setup but draws, drains, and grows nothing.
- **Sacrifice**, spare Treasure or Thopters. Atog (common): "Sacrifice an artifact: This creature gets +2/+2 until end of turn."
- **One-artifact conditions**, half a payoff, on a card that is not an artifact. Aeronaut Tinkerer (common): "flying as long as you control an artifact."

**5. False friends.** Checked with the helper.

- `affinity` is the parent of every "costs less for each X" tag. Cryptic Serpent ("for each instant and sorcery card in your graveyard"), Daybreak Chimera (devotion), and Deadly Alliance (party) count as artifact payoffs.
- `synergy-artifact`: Drooling Ogre changes hands "Whenever a player casts an artifact spell"; Desperate Castaways "can't attack unless you control an artifact"; Acolyte of Aclazotz sacrifices "another creature or artifact"; Benevolent River Spirit's waterbend taps "artifacts and creatures"; Reality Ripple only targets one.
- `synergy-artifact-creature`: Arcbound Worker is an artifact with "Modular 1", so setup; Abuna Acolyte prevents damage to "target artifact creature"; Whipflare "deals 2 damage to each nonartifact creature."
- Bargain: Candy Grapple may sacrifice "an artifact, enchantment, or token", so it is a payoff for three themes.
- Token riders: Ancestors' Aid is a pump spell that adds "Create a Treasure token". Half weight at most.

**6. Both jobs.** Count once. A reward that scales or triggers is a payoff (Frogmite, Embersmith); a cost reducer is half a payoff (Etherium Sculptor). A reward that needs a single artifact is setup when the card is itself an artifact: Court Homunculus (common), "+1/+1 as long as you control another artifact", is an artifact creature, so the half-payoff rule skips it. Whirler Rogue (uncommon), which makes "two 1/1 colorless Thopter artifact creature tokens", is setup. Counting once only splits the jobs. An artifact payoff is still an artifact on the table, so the source counts in part 7 include it.

**7. Enough for a decent bulk deck.** Sources are copies of every artifact card (payoffs and artifact lands included) plus token makers.

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

**8. Where the live matchers differ.**

- Enabler #1 `types artifact` is the right resource with no weight: 6-mana Archive Arbiter counts like Ornithopter. It does count artifact lands: the helper shows Seat of the Synod meeting enabler #1.
- Missed setup: 332 bulk non-artifact token makers under the part 9 pattern (Thraben Inspector, Ambitious Aetherborn's "Fabricate 1", Beamsaw Prospector's Lander). Only `repeatable-artifact-tokens` admits them; Whirler Rogue counts only as payoff.
- Payoff #1 is the weak spot: 248 of 657 bulk payoffs (38%) pass a strict rule. 455 hit only through `synergy-artifact`, 56 only through `affinity`, and 50 only through `synergy-artifact-creature`: Modular artifact creatures (Arcbound Worker), damage prevention (Abuna Acolyte), one-sided sweepers (Whipflare). The part 9 hints keep 7 of those 50, mostly lords and counts (Chief of the Foundry, Collective Drone).
- Both: 206 bulk artifacts carry a payoff tag. Cast triggers are not checked against the deck (`our-builder-themes.md`: Poetic Ingenuity beside one artifact spell).

**9. Matcher hints.** Patterns run as in Lifegain: reminder text removed, flags `im`. Removing reminder text keeps Bargain's "sacrifice an artifact" out of the sacrifice pattern.

- Setup: type Artifact on a nonland card, weight 1, 0.5 at mana value 5 or more; artifact lands, weight 1; `repeatable-artifact-tokens`, weight 2; text `investigate|fabricate \d|incubate|create [^.]*\b(treasure|clue|food|blood|powerstone|map|gold|junk|lander|mutagen|vibranium)\b[^.]*tokens?|artifact (creature )?tokens?`, minus `its controller creates|gift a|(target|each) opponent creates|that player creates`; half weight on instants and sorceries and at mana value 5 or more. The token names are every token whose reminder text in the pack says it is an artifact (`node data/review/scratch/g3fix/tokens.cjs`).
- Tokens and lands feed count, enters, and sacrifice payoffs, not cast payoffs. When cast payoffs are most of the deck's payoffs, count only artifact cards toward the floor.
- Payoffs, weight 1. Count: `artifact-count-matters`, `metalcraft`, `affinity-for-artifacts`, `improvise`, text `for each artifact (and\/or [a-z]+ )?you control|(two|three) or more artifacts|number of artifacts you control|artifact creatures you control get|number of artifact creatures you control`. Enters: `artifactfall`, text `whenever (an|another|one or more) [^.]*artifacts? you control enters?`. Cast: `whenever you cast an artifact spell`. Sacrifice: `sacrifice an artifact[:,]|sacrifice (two|three) artifacts|whenever you sacrifice an artifact`.
- Half payoff, weight 0.5: `cost-reducer-artifact`; text `as long as you control (an|another) artifact|if you control an artifact` on a card that is not an artifact. On an artifact the same text is setup (Court Homunculus).
- Exclude: `hate-artifact`. `synergy-artifact`, `synergy-artifact-creature`, `synergy-historic`, `affinity` without `affinity-for-artifacts`, and keyword Bargain admit a card only when a tag or pattern above also matches.

Bulk under these hints (`g3fix/bulk.txt`): 2,053 artifacts as setup, 332 non-artifact one-shot token makers, 161 repeatable token makers, 248 payoffs (109 count, 53 enters, 10 cast, 34 sacrifice, plus 13 cost reducers and 29 one-artifact conditions at half).

### Enchantments (enchantments)

**1. Plan.** Play cheap enchantments that do a job on their own (removal Auras, enchantment creatures, Sagas) and let enchantress and constellation cards draw or drain off each one.

**2. Resource.** Enchantments cast (enchantress), entering (constellation, eerie), on the battlefield (count), and leaving (Sagas). Unit: one enchantment cast or entering. An Aura on an opponent's creature is still yours (rule 303.4e). Tokens are created, not cast (111.1), so Role and Glimmer tokens feed constellation and count payoffs, not enchantress.

**3. Setup jobs.** Every enchantment is a unit, so pick ones with a job of their own. Weight 1, 0.5 at 5 mana or more.

- **Removal.** Pacifism (common): "Enchanted creature can't attack or block." Journey to Nowhere (common): "exile target creature."
- **Creatures and Sagas.** Nyxborn Eidolon (common): a 2/1 for {1}{B} with "Bestow {4}{B}". Elspeth's Nightmare (uncommon): a {2}{B} Saga whose first chapter reads "Destroy target creature an opponent controls with power 2 or less." Sagas are sacrificed after their last chapter (704.5s): fine for enters payoffs, poor for count.
- **Token makers**, weight 1, or 2 when repeatable. Glimmerburst (common): "Draw two cards. Create a 1/1 white Glimmer enchantment creature token." God-Favored General (uncommon): "create two 1/1 white Soldier enchantment creature tokens" each time it untaps, for {2}{W}. They feed enters and count payoffs only.

**4. Payoff jobs.**

- **Enchantress**, enchantment spells only. Mesa Enchantress (uncommon): "Whenever you cast an enchantment spell, you may draw a card." Generous Visitor (uncommon) adds a +1/+1 counter instead.
- **Constellation and eerie**, one entering most turns. Grim Guardian (common): "each opponent loses 1 life." Setessan Skirmisher (common) gets +1/+1.
- **Count**, three that stay. Ethereal Armor (common): "+1/+1 for each enchantment you control".
- **Leaving**, Sagas or sacrifice. Ashiok's Reaper (uncommon): "Whenever an enchantment you control is put into a graveyard from the battlefield, draw a card."
- **Cost reducers**, half a payoff, the same rule as in Artifacts. Jukai Naturalist (uncommon): "Enchantment spells you cast cost {1} less to cast."

**5. False friends.** `synergy-enchantment` alone carries 140 of 154 bulk payoffs. Checked with the helper:

- Commune with the Gods puts "a creature or enchantment card" into your hand: card selection.
- Cleansing Meditation: "Destroy all enchantments." Anti-synergy.
- Godhunter Octopus attacks only if "defending player controls an enchantment".
- Candy Grapple: bargain takes any token.
- Taken by Nightmares ("If you control an enchantment, scry 2.") and Lagonna-Band Elder: one-enchantment riders, half a payoff at most.
- Southern Air Temple counts Shrines, yet carries `enchantmentfall`.
- `synergy-enchantment-creature` alone carries 10 more. Nyx Infusion (common): "Enchanted creature gets +2/+2 as long as it's an enchantment. Otherwise, it gets -2/-2." Extinguish All Hope: "Destroy all nonenchantment creatures."

**6. Both jobs.** Count once, as payoff when the reward fires per enchantment (Grim Guardian, Ethereal Armor). Cost reducers such as Jukai Naturalist are half a payoff, as Etherium Sculptor is for Artifacts: the reward is mana for each enchantment spell, which needs setup but draws, drains, and grows nothing. Like any payoff that is an enchantment, it still counts toward the enchantments on the table in part 7. Riptide Chimera ("return an enchantment you control to its owner's hand" each upkeep) is a drawback unless the deck has enters effects worth repeating.

**7. Enough for a decent bulk deck.** Copies of every enchantment card (payoffs included) plus enchantment token makers.

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

**8. Where the live matchers differ.**

- Enabler #1 `types enchantment` is the right resource with no weight: 2,092 bulk cards (10.4%).
- Missed setup: about 39 bulk Role and enchantment token makers (Glimmerburst, Charmed Clothier's "Royal Role token", God-Favored General); `repeatable-enchantment-tokens` is not in the clause. The helper shows Glimmerburst and Charmed Clothier as "enabler: none".
- Payoff #1: 79 of 154 bulk payoffs (51%) pass a strict rule; the rest come through `synergy-enchantment` (140 alone) and `synergy-enchantment-creature` (10 alone).
- Both: 44 bulk enchantments carry a payoff tag, and only 22 are real per-enchantment payoffs under the part 9 hints (Ethereal Armor, Grim Guardian, the constellation creatures, Sphere of Safety). The other 22: 5 Shrines (The Spirit Oasis among them); 4 cost reducers (Jukai Naturalist, Inquisitive Glimmer, Transcendent Envoy, Ballad of the Black Flag); 3 enchantment removal cards (Quiet Disrepair, Arenson's Aura, Teferi's Care); 3 protection or tutor cards (Callaphe, Beloved of the Sea; Alseid of Life's Bounty; Sterling Grove); 4 that care only about enchantment creatures or enchanted creatures (Nyx Herald, Nyx Infusion, Armament of Nyx, Bearer of Memory); 2 that bounce your own enchantment each upkeep (Riptide Chimera, Shimmerwing Chimera); and Vessel of Nascency, card selection.
- Cast and enters payoffs are not told apart. The live matchers count no Role or Glimmer token makers at all, so tokens fed to Mesa Enchantress are a risk only once the part 9 hints add token makers. Part 9 ties them to enters and count payoffs.

**9. Matcher hints.** Patterns run as in Lifegain: reminder text removed, flags `im`.

- Setup: type Enchantment, weight 1, 0.5 at mana value 5 or more; text `create [^.]*\b(role|enchantment[^.]*) tokens?`, weight 1, or 2 with `repeatable-enchantment-tokens`, half on instants and sorceries and at mana value 5 or more.
- Token makers feed enters and count payoffs, not enchantress. When cast payoffs are most of the deck's payoffs, count only enchantment cards toward the floor.
- Payoffs, weight 1. Cast: `whenever you cast an enchantment spell`. Enters: `constellation|eerie|whenever (an|another|one or more) [^.]*enchantments? you control enters?`. Count: `ethereal-armor`, `affinity-for-enchantments`, text `for each (other )?enchantment|number of enchantments you control`. Leaving: `enchantment you control is put into a graveyard`.
- Half payoff, weight 0.5: `cost-reducer-enchantment`; text `if you control an enchantment|as long as you control an enchantment` on a card that is not an enchantment.
- Exclude: `hate-enchantment`, `removal-enchantment`, and `synergy-shrine`, whatever else matches. `synergy-enchantment`, `synergy-enchantment-creature`, `enchantment-engine`, `enchantmentfall`, `impulse-enchantment`, and keyword Bargain admit a card only when a tag or pattern above also matches. The text patterns catch every card that carries `enchantmentfall` or `enchantment-engine` except the Shrines and Tanglespan Lookout, which cares about Auras only (`g3fix/entags.txt`).

Bulk under these hints (`g3fix/bulk.txt`): 2,066 enchantments as setup, 39 token makers, 81 payoffs (6 cast, 39 enters, 12 count, 6 leaving, plus 10 cost reducers and 8 one-enchantment conditions at half).
