# Theme guide: Tokens, +1/+1 counters, Aristocrats

Part of the Phase 2 theme guide in `docs/algo-review.md`, for builder prototypes and the automatic deck checks. Judges read the cards and decide for themselves.

**Sources.** Card text, tags, and matcher hits: `npm run review:cards -- "<name>" --style <id>` (pack 2026-11-03). Tag counts: scratch scripts in `data/review/scratch/g1/` over nonland, non-Un cards (`style.ts` and `clauses.ts` for matcher hits, `pat.ts` and `cat.cjs` for text patterns inside a tag, `find.ts` for text searches), with corrections from `data/review/scratch/g1chk/counts.ts`, `counts2.ts`, and `counts4.ts` and `data/review/scratch/g1fix/dts.ts`. Real decks: `node data/review/scratch/g1fix/medians.ts <style> <size> <top>` counts each card once under the counting rules below, with the rough regex jobs of `data/review/scratch/g1/jobs.ts`, over `data/corpus/decks.json` (precons at 100, 60, 20; 17Lands draft decks at 40), keeping the decks `jobs.ts` ranks highest. `node data/review/scratch/g1fix/medians.ts <style> edhrec` takes instead the 100-card precons whose commander is an EDHREC top or new commander for the tag, one deck per commander. Medians are true medians (the mean of the middle two for an even count). Output in `data/review/scratch/g1fix/medians-out.txt`. Draw odds: `node data/review/scratch/g1fix/odds.cjs` (`odds-out.txt`). Hint regexes: `node data/review/scratch/g1fix/hints.ts` (`hints-out.txt`). Live decks: `docs/review/our-builder-themes.md`. EDHREC inclusion: `data/edhrec/pages/tags/{tokens,plus-1-plus-1-counters,aristocrats}.json`.

**Real decks are a scale check, not proof.** The real-deck figures come from this guide's own regex classifier, over decks ranked by that same classifier, so they share the guide's definitions: the "score and yardstick built on the same definitions" trap in `docs/algo-review.md`. The top lists also pull in off-theme decks: Jace, Arcane Strategist among the Counters 60 top 8; Repel the Dark (no outlet) among the Aristocrats 60 top 8; Deep Clue Sea and World Shaper (no outlet) among the Aristocrats 100 top 10. At 40 the sample is the top 100 of 54,000 drafts, an upper bound, not a typical deck. The EDHREC-commander rows at 100 pick decks without the classifier's ranking, but still count them with it. The minimums rest on the draw math below; the real decks only show that the numbers are in the range real decks play.

**Counting rules for all three.**

- **Each card once.** If one half is a rider (one-shot, small, conditional, typal, or one mode of a modal spell), the card is the other job.
- **Duals.** If both halves are real, count the card for the job with more weight. On a tie, count it as payoff, the scarcer job in most decks; a builder short of setup may count a tied card as setup instead, but never as both. Aristocrats breaks ties its own way (its section 6). The real-deck figures use the same rule.
- **Weights.** By default a repeatable engine weighs 2, a one-shot that makes several units 1, and a single unit 0.5. Each style's sections 3 and 4 set its own weights, and those override the default: Counters counts a single counter on one creature as 1 and a mass placer as 1.5, since one counter is its unit; Aristocrats counts one body that dies with value as 1. Payoffs carry weights too, for the tie rule.
- **How the tables count.** Every cell counts copies, and a weight-0.5 copy counts half: ten "creature plus one token" cards are 5 toward the Tokens "Setup 9 to 12", not 10. The engine column of each table (Engines, Growth engines, repeatable Outlets) counts the copies of that job alone and is a floor of its own, so riders and single units can never meet a minimum by themselves.

**Draw math.** By turn 5 a 40, 60, or 99-card deck has seen about 12 cards. At 60, 10 setup cards show one in 91% of games and two in 65%; 6 payoffs show one in 75%. At 40, 6 setup gives 90% and 59%, 4 payoffs 78%. At 99 singleton, 14 setup gives 86% and 53%, 8 payoffs 66%; the commander is one more card that is always there. Engine floors, one copy seen by turn 5 (`odds.cjs`):

| Copies | 40  | 60  | 99  |
| ------ | --- | --- | --- |
| 1      | 30% |     |     |
| 2      | 52% |     |     |
| 3      | 67% | 49% |     |
| 4      | 78% | 60% | 41% |
| 5      | 85% | 69% | 48% |
| 6      |     | 75% | 55% |
| 7      |     | 81% | 61% |

Two kinds of floor follow. An engine the plan cannot run without (the Aristocrats repeatable outlet) gets the count that shows one in about half of games at every size: 2 at 40, 3 at 60, 5 at 99. Engines that one-shot cards can stand in for (token engines, counter growth) get the count that shows one in about 3 games of 5: 3 at 40, 4 at 60, 7 at 99.

**20-card packets.** A 20-card packet is half of a 40-card deck: any two packets of different colors shuffle into a two-color 40-card deck (`SPEC.md`, Deck sizes). By turn 5 a packet has given about 6 of the 12 cards seen, so the 20 rows are about half the 40 rows, with floors rounded up. Copies in one packet show by turn 5 as they would in the 40-card deck: one copy in 30% of games, two in 52%. A packet alone carries half a plan; the full plan shows only when the other packet shares the theme.

**Text prep for every matcher hint (section 9).** Remove reminder text (anything in parentheses), split the oracle text into lines, and drop a leading ability word such as "Enrage" or "Landfall" with the dash after it. Test each line on its own, case-insensitive, so `^` means the start of a line. Keyword lines such as Mobilize, Exploit, Evolve, Afterlife, and Persist then match only their `^` patterns, never their reminder text. "The cost" means the text before the colon on that line. `hints.ts` works this way; `jobs.ts` does too, except that it keeps ability words.

### Tokens (tokens)

**1. Plan.** Make lots of small creatures, then make them all bigger or turn each one into damage.

**2. Resource.** Creature tokens that stay on the battlefield, counted in bodies.

**3. Setup jobs.**

- **Engine** (weight 2): "create ... creature token" after "{T}:", a mana cost and colon, "At the beginning of", or a "Whenever" the deck meets each turn. Selesnya Guildmage: "{3}{G}: Create a 1/1 green Saproling creature token." Squirrel Nest: 'Enchanted land has "{T}: Create a 1/1 green Squirrel creature token."' An engine fed by another resource (life gained, energy, a nontoken death, spells cast) weighs 1, since it runs only when the deck supplies that resource.
- **Burst** (one-shot, two or more tokens, weight 1). Raise the Alarm: "Create two 1/1 white Soldier creature tokens." Drey Keeper: "When this creature enters, create two 1/1 green Squirrel creature tokens." Dark Salvation: "Target player creates X 2/2 black Zombie creature tokens, then up to one target creature gets -1/-1 until end of turn for each Zombie that player controls." Aimed at yourself, it is X Zombies plus removal.
- **Creature plus one token** (weight 0.5): filler, not setup alone. It counts half in the table.
- Temporary tokens (sacrificed at the next end step) halve the weight: they attack or feed Aristocrats but never build a board.

**4. Payoff jobs.**

- **Lasting anthem** (weight 2, 3+ creatures). Gaea's Anthem: "Creatures you control get +1/+1." Scarce in bulk: a text search found about six non-typal ones at common or uncommon.
- **Enters trigger** (weight 2, wants an engine). Impact Tremors: "Whenever a creature you control enters, this enchantment deals 1 damage to each opponent." Corpse Knight: "each opponent loses 1 life".
- **Team pump**, the finisher (weight 1, 4+ attackers). Overrun: "Creatures you control get +3/+3 and gain trample until end of turn."
- **Count scaler** (weight 1, 3+). Coordinated Maneuver: "deals damage equal to the number of creatures you control".
- **Tap for value** (weight 0.5). Convoke and "tap untapped creatures" costs turn spare bodies into mana or effects. Stoke the Flames: "Convoke" and "Stoke the Flames deals 4 damage to any target." Siege Zombie: "Tap three untapped creatures you control: Each opponent loses 1 life." Good in a token deck, but not its plan, so they count half. The pack has 104 convoke cards (`g1chk/broad.ts`).

A payoff that needs one token (Seasoned Warrenguard: "attacks while you control a token") is weak.

**5. False friends.** From the `repeatable-creature-tokens`, `multiple-bodies`, `anthem`, `keyword-anthem`, and `creature-count-matters` listings:

- Temporary tokens: Dragonback Lancer (Mobilize 1, "Sacrifice it at the beginning of the next end step"), Thatcher Revolt. Good Aristocrats fodder, no board.
- Fed by another resource (weight 1 at most): Griffin Aerie ("if you gained 3 or more life this turn"), Anafenza, Unyielding Lineage ("another nontoken creature you control dies"), Field of Souls ("Whenever a nontoken creature is put into your graveyard from the battlefield"), Aether Chaser ("you may pay {E}{E}. If you do, create a 1/1 colorless Servo artifact creature token", and it brings only two energy itself).
- Not tokens, or not yours: Badgermole (earthbend), Invading Manticore (amass grows one Army), Mogg Infestation ("Destroy all creatures target player controls. For each creature that died this way, that player creates two 1/1 red Goblin creature tokens."), a one-sided wipe that gives the opponent the Goblins. "Target player creates" alone is yours: Dark Salvation is setup (section 3).
- Narrow payoffs: Valley Questcaller ("Other Rabbits, Bats, Birds, and Mice"), Bebop, Warthog Warrior ("Rhinos you control have menace."), Absolute Grace ("All creatures have protection from black."), Drove of Elves ("the number of green permanents you control").
- Anti-payoffs: Always Watching ("Nontoken creatures you control get +1/+1"), Thraben Watcher. Wipes that grow with the board: Blasphemous Act ("This spell costs {1} less to cast for each creature on the battlefield." and "Blasphemous Act deals 13 damage to each creature.") is a `creature-count-matters` payoff that kills the token board.

**6. Both jobs.** Goblin Surprise (pump or two Goblins) and Drey Keeper (a Squirrel-only pump rider) are setup. Selesnya Guildmage is real on both sides and counts once, as setup: its engine weighs 2, its team pump 1.

**7. Enough.** Setup and payoffs count copies with the half rule; engines are the weight-2 copies. Real decks: setup / engines / payoffs, counted the same way.

| Size | Setup    | Engines  | Payoffs | Real decks                                                                    |
| ---- | -------- | -------- | ------- | ----------------------------------------------------------------------------- |
| 60   | 9 to 12  | 4+ (60%) | 6 to 8  | 9.25 / 4.5 / 6.5, top 8 precons                                               |
| 40   | 6 to 8   | 3+ (67%) | 4 to 5  | 6 / 3 / 5, top 100 drafts                                                     |
| 20   | 3 to 4   | 2 (52%)  | 2       | 3.5 / 2 / 2, top 8 Jumpstart                                                  |
| 100  | 14 to 18 | 7+ (61%) | 8 to 12 | 14.75 / 9.5 / 6.75, top 10 precons; 13 / 5 / 4.5, 13 EDHREC-commander precons |

The setup floors show one setup card by turn 5 in about 9 games of 10 (9 at 60: 89%; 6 at 40: 90%; 14 at 99: 86%). With single tokens counted half, the 60 floor moved from 10 to 9, near the top precons' median of 9.25. The engine floors are the "3 games of 5" kind, since bursts stand in for engines: the 40 floor moved from 2 to 3 and the 100 floor from 8 to 7 to match the 60 one. The 100 payoff floor asks for more than the precons play by this count (6.75 and 4.5), because 8 payoffs in 99 already show one by turn 5 in only 66% of games, against 75% for 6 at 60. Several EDHREC-commander precons hold few token payoffs by this count (Vampiric Bloodlust 1, Undead Unleashed 2, Multiverse Reforged 2). About 3 setup to 2 payoffs, plus cheap creatures and 5 to 8 removal at 60. An engine commander (Emmara, Soul of the Accord: "Whenever Emmara becomes tapped, create a 1/1 white Soldier creature token with lifelink.") cuts setup by 3 or 4; spend the slots on payoffs. EDHREC token decks favor enters and token triggers: Impact Tremors 29%, Mirkwood Bats ("Whenever you create or sacrifice a token, each opponent loses 1 life.") 29%.

**8. Where the live matchers differ.** Enablers: `anyTags repeatable-creature-tokens|multiple-bodies`. Payoffs: eight tags.

- No weights: Raise the Alarm equals Selesnya Guildmage.
- `repeatable-creature-tokens` (1,412 enablers) includes 91 `temporary-token` cards (109 across both enabler tags) and engines that need energy, life gain, a nontoken death, or spells. `multiple-bodies` (881) holds about 280 cards that put one token beside a creature (a rough text count finds 278), plus earthbend, amass, manifest, offspring, and 28 `donate-token` cards (61 across both enabler tags).
- `power-boost-to-all` (1,206 payoffs, 449 by it alone): about 360 one-turn pumps and many lords; 633 payoffs carry `typal`. `keyword-anthem` (513, 395 alone) is mostly narrow or symmetric. `creature-count-matters` (321) counts colors, snow, and lands, and holds wipes that scale with the creature count, such as Blasphemous Act. 48 payoffs say "nontoken".
- Missed: enters triggers (Impact Tremors, Corpse Knight, Molten Gatekeeper; tags `impact-effect`, `creaturefall`) and tap-for-value cards.
- 384 cards count as both.
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 3 at 40, 8 and 4 at 60. There is no 100 entry: Commander takes the 60 minimums times 1.6, rounded up (`builderWeights.commander.minimumScale`), so 13 and 7. They count unweighted copies, and a dual counts on both sides. For best fit the scan also asks for the lower quarter of real decks (`learned.quartileMinimums`); a picked style keeps these hand-set ones. This guide asks for as much or more at every size, counted more strictly: at 60, 9 setup with single tokens counted half, 4 of them engines, and 6 payoffs counted apart from setup.

**9. Matcher hints.** Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Engine: a line matching `(\{T\}|\}|^at the beginning of|^whenever)[^.]*create[^.]*creature tokens?` (also inside `has "..."`) whose cost does not sacrifice, exile, or discard the card itself, or a `^(mobilize|myriad)\b` line. The cost check drops Twitching Doll ("{T}, Sacrifice this creature: Create a 2/2 green Spider creature token with reach for each counter on this creature."), a one-shot. Weight 1 when the line also matches `if you gained|pay \{E\}|nontoken|whenever you cast` (Griffin Aerie, Field of Souls) or the tokens are temporary. Use `repeatable-creature-tokens` only to find candidates, never to count: the tag keeps Griffin Aerie, Anafenza, and Aether Chaser. Aether Chaser fails the text rule, since the sentence ends after "pay {E}{E}"; it makes one Servo from its own energy, so that loss is fine.
- Burst: `creates? (two|three|four|five|x|that many)[^.]*creature tokens` on a line that is not an engine.
- Temporary: `sacrifice (it|them|those tokens) at the beginning of the next end step|^mobilize\b` halves the weight.
- Not yours: `(its controller|that player|each opponent|target opponent|each other player|their controller) creates?` (Mogg Infestation). "Target player creates" counts as yours.
- Payoffs: `anthem` minus `typal`; `(^|\. )(other )?creatures you control get \+\d+/\+\d+` without `until end of turn` (lasting anthem) or with it (team pump); `whenever (a|another|one or more)( other)? (creatures?|creature tokens?|tokens?)( you control)? enters?|whenever you create (a|one or more)` (enters trigger, which now takes "Whenever one or more other creatures you control enter", 12 cards by `g1chk/broad.ts`); `overrun`; `(number of|for each) (other )?creatures? you control(?! with)` (count scaler, which now takes "for each other creature you control" and drops the Counters payoffs Inspiring Call and Armorcraft Judge, "for each creature you control with a +1/+1 counter on it"); `^convoke\b|^tap (two|three|four|five|x) untapped creatures you control` (tap for value).
- Drop payoffs with `nontoken` or `opponent controls`, typal lords, `keyword-anthem` without `creatures you control have`, and `creature-count-matters` cards tagged `sweeper`.

### +1/+1 counters (counters)

**1. Plan.** Put +1/+1 counters on several creatures, then play cards that reward creatures with counters.

**2. Resource.** +1/+1 counters, counted as counters placed and as creatures carrying one. Most payoffs say "each creature you control with a +1/+1 counter on it", so several carriers beat one big creature. Real decks get carriers three ways: spreaders, many self-growers (adapt, outlast, evolve), or many single placers (bolster).

**3. Setup jobs.**

- **Spreader** (repeatable, other creatures, weight 2). Loxodon Battle Priest: "At the beginning of combat on your turn, put a +1/+1 counter on another target creature you control." Dragon Blood: "{3}, {T}: Put a +1/+1 counter on target creature." Bellowing Aegisaur puts one on each other creature you control whenever it is dealt damage.
- **Mass placer** (one-shot, weight 1.5). Pledge of Unity: "Put a +1/+1 counter on each creature you control." Myojin of Towering Might: "Remove an indestructible counter from Myojin of Towering Might: Distribute eight +1/+1 counters among any number of target creatures you control." It does so once, and only when cast from hand ("enters with an indestructible counter on it if you cast it from your hand").
- **Single placer** (one-shot, weight 1). Battlegrowth: "Put a +1/+1 counter on target creature." Aven Tactician: "When this creature enters, bolster 1."
- **Self-grower** (weight 1). Scurry Oak (evolve), Gnoll Hunter, adapt and outlast creatures.
- **Enters with counters** (weight 0.5). Endless One: "This creature enters with X +1/+1 counters on it." Wren's Run Hydra also enters with X counters, but its Reinforce ability, used from your hand instead of casting it, puts X counters on target creature, so it is a single placer (1).

**4. Payoff jobs.**

- **Counter lord** (weight 2, 3+ carriers). Abzan Falconer: "Each creature you control with a +1/+1 counter on it has flying."
- **Cash-in** (weight 1, 3+). Inspiring Call: "Draw a card for each creature you control with a +1/+1 counter on it." Armorcraft Judge does it on enter.
- **Damage trigger** (weight 2, 2+). Bred for the Hunt: "Whenever a creature you control with a +1/+1 counter on it deals combat damage to a player, you may draw a card."
- **Multiplier** (weight 2, needs setup). Kami of Whispered Hopes, Conclave Mentor ("that many plus one +1/+1 counters"), Corpsejack Menace ("twice that many"), Thrummingbird ("proliferate" on combat damage).

**5. False friends.** From the `counters-matter`, `gains-pp-counters`, and `gives-pp-counters` listings:

- Other counters: Aether Chaser ("you get {E}{E}"), Gavel of the Righteous ("a charge counter"), Twitching Doll ("a nest counter"). Myojin of Towering Might is a false payoff only: its indestructible counter trips `counters-matter`, but its eight +1/+1 counters are real setup (section 3).
- Self-contained: Festercreep ("Remove a +1/+1 counter from this creature: All other creatures get -1/-1 until end of turn.", which kills your own small creatures), Fertilid, Academy Elite. Each enters with counters only to spend them on itself.
- Missing condition: Ajani's Comrade ("if you control an Ajani planeswalker").
- Hidden cost: Forcemage Advocate ("{T}: Return target card from an opponent's graveyard to their hand. Put a +1/+1 counter on target creature."). Each use hands the opponent a card (tag `group-hug`), so it is a spreader at weight 1, not 2.
- Rider: Enduring Victory ("Destroy target attacking or blocking creature. Bolster 1.").
- Weak payoff: Laid to Rest ("you gain 2 life"), weight 0.5.
- Anti-synergy: +1/+1 and -1/-1 counters cancel (rule 704.5q); undying returns only a creature that "had no +1/+1 counters on it" (702.93a).

**6. Both jobs.** Outlast lords (Abzan Falconer, Ainok Bond-Kin, Tuskguard Captain) and enter-plus-lord creatures (Duskshell Crawler, Pridemalkin) are payoffs: the lord weighs 2, the self-growth 1. Mass placers are setup. Training Regimen is real on both sides.

**7. Enough.** Setup and payoffs count copies with the half rule. Growth engines are spreaders, mass placers, and self-growers: the cards that grow a creature more than once, or several creatures at once. Real decks: setup / spreaders and mass / growth engines / payoffs.

| Size | Setup    | Growth engines         | Payoffs | Real decks                                                                         |
| ---- | -------- | ---------------------- | ------- | ---------------------------------------------------------------------------------- |
| 60   | 10 to 12 | 4+ (60%), or setup 13+ | 5 to 7  | 12 / 1 / 6 / 8, top 8 precons                                                      |
| 40   | 6 to 8   | 3+ (67%), or setup 9+  | 3 to 4  | 6 / 1.5 / 3 / 3, top 100 drafts                                                    |
| 20   | 3 to 4   | 2 (52%), or setup 5+   | 2       | 5.5 / 1 / 2.5 / 3, top 8 Jumpstart                                                 |
| 100  | 14 to 18 | 7+ (61%), or setup 22+ | 8 to 12 | 13.25 / 3 / 9.5 / 9.5, top 10 precons; 8 / 1 / 6 / 5.5, 9 EDHREC-commander precons |

Why these numbers:

- The old floor of 3 spreaders or mass placers at 60 failed every top precon: they run 0 to 2 (median 1), and the old real-deck figure counted only repeatable spreaders. Spreaders are the best growth engines, but not the only way to get carriers. Adapt and outlast decks (Simic Combine, Abzan Siege) play many creatures that grow themselves, and the bolster deck Massed Ranks plays many single placers. So the floor counts growth engines of any kind.
- The growth floors are the "3 games of 5" kind. A deck with fewer can pass on a deep setup count instead: without engines each setup card makes about one carrier, and the counter lords want 3. 13 setup in 60 put about 2.6 setup cards in the 12 seen by turn 5 (12 x 13 / 60), as do 9 in 40 and 22 in 99; a packet takes half the 40 count.
- Of the top 8 precons at 60, six pass. Growing Hunger and Simic Domination fall just short on setup (9 each).
- At 100 the setup range moved from 16 to 20 down to 14 to 18, the Tokens range, since weight-0.5 cards now count half; the top precons sit at 13.25. Several EDHREC-commander precons hold little +1/+1 setup by this count (Calling All Angels 3, Swell the Host 4.5, Vampiric Bloodlust 5), so that sample runs low.

About 2 setup to 1 payoff. Counters live on creatures: 16 or more at 60, plus removal and trample or evasion. A spreading commander (Leinore, Autumn Sovereign: "At the beginning of combat on your turn, put a +1/+1 counter on up to one target creature you control.") cuts setup by 3 or 4. EDHREC counters decks rank multipliers high: Kami of Whispered Hopes 29%, Corpsejack Menace 27%.

**8. Where the live matchers differ.** Enablers: `anyTags gives-pp-counters|gains-pp-counters|repeatable-pp-counters`. Payoffs: `counters-matter|pp-counters-matter|repeatable-proliferate|pseudo-proliferate|gives-pp-counters-to-all`.

- About 2,240 of 3,247 enablers never put a +1/+1 counter on another creature: a strict text count finds 1,003 that do (`g1chk/counts4.ts`), and the `jobs.ts` classifier 1,007 (`g1chk/counts3.ts`). `gains-pp-counters` (2,159, 703 alone) is self-growth and "enters with".
- `counters-matter` (1,262 payoffs, 755 alone) covers every counter kind: 605 payoffs count only through it and never mention +1/+1.
- `gives-pp-counters-to-all` sits in the payoff clause, so mass placers count as both.
- 66 payoffs only remove a +1/+1 counter "from this creature".
- 699 cards count as both, the most of these styles; top 60-card precons show 11 both copies (`g1/jobs-out.txt`).
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 2 at 40, 8 and 3 at 60, and 13 and 5 at 100 (the 60 minimums times 1.6, rounded up). This guide asks for more: at 60, 10 setup with enters-with cards counted half, 4 growth engines, and 5 payoffs counted apart from setup.

**9. Matcher hints.** Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Spreader (2): a repeatable line (it starts with `at the beginning of` or `whenever`, or its cost holds `{T}` or a mana symbol) that matches `put (a|an|one|two|x) \+1/\+1 counters? on (another|target|each|up to)` anywhere on the line, and whose cost does not discard, sacrifice, or exile the card. Matching the whole line, not one sentence, catches Forcemage Advocate (then weight 1 for its hidden cost). Removing reminder text drops Wren's Run Hydra's Reinforce ("Discard this card: Put X +1/+1 counters on target creature"); the cost check drops it too if reminder text is kept. Dropping the ability word lets Bellowing Aegisaur match.
- Mass (1.5): `distribute [^.]*\+1/\+1 counters|put (a|an|one|two|x) \+1/\+1 counters? on each (other )?creature you control` on a line that is not repeatable (Pledge of Unity, Myojin of Towering Might). `gives-pp-counters-to-all` is setup, not payoff.
- Single (1): `put (a|an|one|two) \+1/\+1 counters? on (target|up to)|\bbolster \d|^support \d`; 0.5 on a card tagged `removal`.
- Self (1): `^(evolve|outlast|training)\b|\badapt \d`. Use `gains-pp-counters` without `gives-pp-counters` only when no other line matched, the card does not spend its own counters, and it is not tagged `synergy-pw-specific` (Ajani's Comrade).
- Enters with (0.5): `enters with [^.]*\+1/\+1 counters? on it`, but 0 when a cost on the card matches `remove [^:]*\+1/\+1 counters? from (this creature|it)` (Festercreep, Fertilid, Academy Elite).
- Payoffs: `pp-counters-matter` minus `remove [^:]*counters? from (this creature|it)`; `counter-increaser`, `counter-doubler`, `repeatable-proliferate`; `creatures? you control with (a|one or more) \+1/\+1 counters?`, weight 0.5 when the line ends in `you gain \d+ life` or `scry 1` (Laid to Rest).
- Keep `counters-matter` only when the text says `+1/+1` or `proliferate`.

### Aristocrats (aristocrats)

**1. Plan.** Play creatures that are happy to die, sacrifice them when it suits you, and drain the opponent or draw with each death.

**2. Resource.** Creature deaths you cause, one per sacrifice. Each needs a body (fodder) and a way to spend it on demand (an outlet). "Dies" means put into a graveyard from the battlefield (rule 700.4), so sacrificed tokens trigger death payoffs before they cease to exist (111.7).

**3. Setup jobs.** Two jobs; the deck needs both.

- **Repeatable outlet** (weight 2; best with no mana and no tap). Viscera Seer: "Sacrifice a creature: Scry 1." Goblin Bombardment: "Sacrifice a creature: This enchantment deals 1 damage to any target." Phyrexian Vault ("{2}, {T}, Sacrifice a creature: Draw a card.") works once a turn. A **value outlet** is one whose effect pays off each death by itself, with damage, life loss, or a card: Goblin Bombardment and Phyrexian Vault are; Viscera Seer's scry 1 is not.
- **One-shot outlet** (weight 0.5). Village Rites, Bone Splinters: "As an additional cost to cast this spell, sacrifice a creature." Minister of Pain (exploit).
- **Fodder** (weight 1; token engines 2). Doomed Traveler: "When this creature dies, create a 1/1 white Spirit creature token with flying." Nested Shambler, Raise the Alarm, Kozilek's Predator, temporary tokens. Any death trigger with value counts, "you may" ones included: Byway Courier ("When this creature dies, investigate."), Injector Crocodile ("When this creature dies, incubate 3."). So do creatures that die twice or leave a body: Kitchen Finks (persist), Young Wolf (undying), Imperious Oligarch (afterlife 1).
- **Self-recurring fodder** (weight 1). Reassembling Skeleton: "{1}{B}: Return this card from your graveyard to the battlefield tapped." It comes back to die again. No live tag or matcher finds it.

**4. Payoff jobs.** Each wants about five deaths a game, so a repeatable outlet.

- **Drain** (weight 2). Zulaport Cutthroat: "Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life." Blood Artist, Bastion of Remembrance.
- **Value** (weight 2). Pitiless Plunderer: "Whenever another creature you control dies, create a Treasure token." Morbid Opportunist: "draw a card. This ability triggers only once each turn."
- **Sacrifice trigger** (weight 2). Lightless Evangel: "Whenever you sacrifice another creature or artifact, put a +1/+1 counter on this creature."
- A trigger on nontoken deaths only weighs 1; a scry 1 rider 0.5.

**Value outlets and the payoff count.** A value outlet counts once, as an outlet. Each one in the deck lowers the payoff minimum by one, down to half of it: at 60, two Goblin Bombardments let 2 payoffs do instead of 4. This credits outlets that pay off by themselves without counting any card twice.

**5. False friends.** From the `free-sacrifice-outlet`, `sacrifice-outlet-creature`, `death-trigger`, and `death-trigger-self` listings:

- Other permanents: Akki Avalanchers ("Sacrifice a land:"), Atog ("Sacrifice an artifact:").
- Symmetric edicts: Barter in Blood ("Each player sacrifices two creatures of their choice."), Abyssal Gatekeeper.
- Typal: Skirsdag Flayer ("Sacrifice a Human:"), Fodder Launch ("As an additional cost to cast this spell, sacrifice a Goblin.").
- One creature: Malefic Scythe ("Whenever equipped creature dies"), Elephant Guide ("When enchanted creature dies").
- Rider: Phyrexian Vivisector ("Whenever a creature you control dies, scry 1.").
- Anti-synergy: Death's-Head Buzzard ("all creatures get -1/-1 until end of turn" kills your 1/1s).
- Half the job: Field of Souls ("Whenever a nontoken creature is put into your graveyard from the battlefield, create a 1/1 white Spirit creature token with flying.") turns each nontoken death into new fodder but ignores token deaths. Count it as fodder (a token engine fed by your own deaths, weight 1), not as a payoff, though the live matcher counts it as both.
- Not fodder: Chromatic Star (an artifact: "When this artifact is put into a graveyard from the battlefield, draw a card.").
- Weak fodder (weight 0.5): Endling ("{B}: This creature gains undying until end of turn.") dies twice only with {B} open, and costs four mana first.

**6. Both jobs.** Outlet beats payoff beats fodder, whatever the weights: Body Dropper (outlet plus sacrifice trigger) is an outlet. Zulaport Cutthroat and Bastion of Remembrance are payoffs. A value outlet is still only an outlet; the value-outlet rule in section 4 credits its payoff side through the payoff minimum.

**7. Enough.** Outlets count every outlet copy, one-shots at half; the number in brackets is the repeatable ones alone. Fodder and payoffs count copies with the half rule. Real decks: repeatable outlets / one-shot outlets / fodder / payoffs, counted the same way, with outlets first as in section 6.

| Size | Outlets (repeatable) | Fodder   | Payoffs | Real decks                                                                    |
| ---- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------- |
| 60   | 4 to 6 (3+, 49%)     | 8 to 12  | 4 to 6  | 4 / 2 / 9 / 3.5, top 8 precons                                                |
| 40   | 3 to 4 (2+, 52%)     | 5 to 7   | 3 to 4  | 1 / 0 / 4.5 / 3, top 100 drafts                                               |
| 20   | 1 to 2 (1+, 30%)     | 3        | 2       | 1 / 1 / 2.5 / 2, top 8 Jumpstart                                              |
| 100  | 6 to 10 (5+, 48%)    | 10 to 14 | 6 to 10 | 2.5 / 1 / 9.5 / 7, top 10 precons; 5 / 1 / 11 / 6, 8 EDHREC-commander precons |

Why these numbers:

- **No repeatable outlet, no deck.** Each outlet floor shows one by turn 5 in about half of games. The 40 floor moved from 1 to 2: one copy shows in only 30% of games, against 49% for 3 at 60. The 100 floor moved from 4 (41%) to 5 (48%). A 20-card packet holds half of the 40 floor, rounded up.
- **Some real decks fall short, on purpose.** The top draft decks run one repeatable outlet: drafters take what the packs offer, and with one copy the outlet shows by turn 5 in only 30% of games. Bulk Brew names the deck Aristocrats, so it must deliver the plan; a pool short of outlets should build Tokens or a plain shape instead. At 100 the classifier's top 10 includes decks with 0 to 3 repeatable outlets (Squirreled Away 3, Hail, Caesar 1, Deep Clue Sea 0, World Shaper 0), while the precons led by EDHREC aristocrats commanders run a median of 5, the floor.
- **Fodder is the largest of the three jobs** at every size in the table. It need not outnumber outlets and payoffs together: payoff creatures and plain creatures die too. Power Hungry runs more repeatable outlets (12) than fodder (8.5) because its commander supplies the bodies. Prossh, Skyraider of Kher: "When you cast this spell, create X 0/1 red Kobold creature tokens named Kobolds of Kher Keep, where X is the amount of mana spent to cast it." and "Sacrifice another creature: Prossh gets +1/+0 until end of turn."
- An outlet commander such as Prossh is always there, so the 99 needs only 3 to 5 outlets (2+ repeatable).
- The 100 fodder range moved from 12 to 16 down to 10 to 14, to the real precons' 9.5 to 11.

Add removal (Goblin Bombardment is both) and cheap creatures. EDHREC aristocrats decks: Ashnod's Altar ("Sacrifice a creature: Add {C}{C}.") 41%, Goblin Bombardment 35%, Pitiless Plunderer 43%.

**8. Where the live matchers differ.** Enablers: #1 `sacrifice-outlet-creature|repeatable-sacrifice-outlet|free-sacrifice-outlet`, #2 `repeatable-creature-tokens|multiple-bodies|death-trigger-self`. Payoffs: #1 `blood-artist-ability|sacrifice-matters|your-sacrifice-matters`, #2 `death-trigger` with exclusions.

- Outlets and fodder share one count: 2,878 cards meet only #2, 1,084 only #1. A deck reaches 8 enablers with no outlet; the green deck in `our-builder-themes.md` did.
- #1: 299 cards sacrifice only lands, artifacts, Food, or Treasure (`repeatable-sacrifice-outlet`, `free-sacrifice-outlet`). `sacrifice-outlet-creature` adds about 111 additional-cost spells, 24 exploit cards, and about 46 "each player sacrifices" edicts.
- #2 inherits every Tokens enabler; `death-trigger-self` adds 68 noncreatures (63 through it alone, `g1fix/dts.ts`). Self-recurring creatures such as Reassembling Skeleton meet neither clause.
- Payoff #2 counts 41 Aura and Equipment death triggers, scry riders, and nontoken-only triggers.
- Value outlets count only as enablers while the payoff minimum stays, so a deck of draw and damage outlets reads as payoff-starved. Section 4 lowers the payoff minimum instead.
- Live minimums (`config/archetypes.json`): 3 enablers and 1 payoff at 20, 5 and 2 at 40, 8 and 4 at 60, and 13 and 7 at 100 (the 60 minimums times 1.6, rounded up). Enablers mix outlets and fodder, so a deck meets them with no outlet at all. This guide asks for three separate counts: at 60, 4 outlets (3 repeatable), 8 fodder, and 4 payoffs.

**9. Matcher hints.** Text prep as at the top. Checked on the guide's examples with `hints.ts`.

- Outlet (2): the cost matches `sacrifice (a|another) (other )?(nontoken )?(creature|artifact or creature|creature or artifact|permanent)`. Use `free-sacrifice-outlet` only with `sacrifice-outlet-creature`; exclude `mutual-sacrifice`. It is a value outlet when the effect after the colon matches `deals? \d+ damage|draw a card|loses? \d+ life|each opponent loses`.
- One-shot outlet (0.5): `as an additional cost to cast this spell, sacrifice (a|an|one or more|two|x) (creature|artifact or creature|creature or artifact|permanent)|^exploit\b|^casualty \d|^emerge\b|^when this creature enters, you may sacrifice (a|another) creature`. Naming what is sacrificed drops Crop Rotation ("sacrifice a land"), Forge Armor ("sacrifice an artifact"), and Fodder Launch ("sacrifice a Goblin", typal). 165 cards match.
- Fodder (1): a creature with a line matching `^when this creature (enters or )?dies, (?!all creatures|each creature|each player)` or `^(afterlife|persist|undying)\b`. The lookahead drops Death's-Head Buzzard and symmetric death edicts. Of 803 creatures tagged `death-trigger-self`, it matches 564; the old hint matched 241.
- Self-recurring fodder (1): a creature with `return this card from your graveyard to the battlefield` (80 creatures).
- Token fodder: the Tokens setup jobs, `temporary-token` included.
- Payoffs: `blood-artist-ability`, `your-sacrifice-matters`; `whenever (this creature or )?(a|another|one or more)( other)? creatures?( you control)? dies?` without `enchanted|equipped`, weight 1 with `nontoken`, 0.5 when the only effect is scry 1.
- Report outlets, fodder, and payoffs as three numbers; fodder never stands in for outlets.
