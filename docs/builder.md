# The deck builder

How the builder works today and why its complex parts are the way they are. The code is the authority and config holds the numbers (`config/README.md` describes each key); this file holds the reasons. The review notes, prototypes, and phase briefs it replaces are kept at the git tag `pre-audit`.

## Which builder runs

`buildDeck` in `builder.ts` asks `growBuilds` in `grow.ts` whether the seed-and-grow builder takes a request. It does when the request has no secondary style and is best fit, a plain shape (Aggro, Midrange, Control), a theme the rules give floors at that size, or a tribe at 100. That is every size, 20-card packets and a commander's tribes included, and its picker score ranks best fit, the Build page options, and the Analyze pane everywhere.

The classic builder (`buildClassic`: fill passes over the `archetypes.json` matchers, then a swap search) still builds:

- any request with a secondary style, a tribe as the secondary included. The grow builder has no notion of a secondary style, so this is the only live path from the web app.
- at 60, 40, and 100, a plain shape the grow builder cannot fill on a thin pool (`planResult`) and best fit when no plan fills at all (`bestFit`), both without learned data (`withoutLearned`). No eval pool reaches this. At 20 a thin packet pads with lands or is refused (`classicFallback`).
- a tribe below 100 or a style id the rules do not know, which the apps never send.

`explanation.builder` records which ran. `grow.ts` imports 11 helpers from `builder.ts`, and a saved classic deck still shows the matcher counts its builder counted (`styleCounts`, read when the builder is not `grow`). The `objective`, `tiebreaks`, `localSearch`, `deckScore`, `bestFit`, `secondary`, `castability`, `learned`, and `combos` blocks of `builder-weights.json` serve only the classic path.

## Seed and grow

The grow builder builds the way a person does: check the plan against honest counts, seed the payoffs the pool supports, grow setup to what they demand, fill the roles, fill the curve slot by slot, then build the mana. Candidates are walked in card id order and ties go to strength, then id.

Each spell (`growContext`) gets its job for each themed style, kept only where the pool can pay for the job's needs (`poolJobs`); a value, card strength times cast chance on curve, leaving out effects no deck from the pool earns and pricing an "or pay" cost in mana when the pool lacks the resource; and a quality among peers `q`, its value over the mean of the pool's best `max(2, round(slots / 7))` copies of the same mana value and kind (creature or not). Strength grows with mana value, so cards compare across slots by `q`, never by raw strength.

For a theme:

1. Take the floor alternative the pool meets best (`bestFloor`). The pool margin is the smaller of the setup and payoff sides, each the smallest have over need; a theme is a plan at margin 1 or more.
2. Seed payoffs to the payoff floors (`themeCoreOnce`), times `grow.richSeed` when the pool holds twice its floors on both sides. Each pick maximises the share of shortfall it closes, times `q`, times room (`grow.fullSlot` when its curve slot is already at target).
3. Grow setup to the setup floors, scaled by how far the seeded payoffs went past theirs, then drop seeded payoffs the setup cannot cover. A first try takes only jobs the deck so far pays for (the theme's own resources taken as met); a second takes jobs the pool could pay for and leaves the rest to the final check.
4. Fill each role to its minimum, a card competing only within its role and only on a role it earns in this deck (`fillRoles`).
5. Fill the curve (`fillCurve`): the slot furthest below its target takes its best card, creatures first while below the creature share, inside the type caps.
6. Size the lands with `planLandCount`, trim or refill curve copies (never setup whose loss uncovers a payoff) for up to three rounds, then `chooseManaBase`. The count must sit inside the template range, at most 2 over the formula at 60 and 100 and 1 at 40; a packet pads with lands.
7. Check the finished deck (`settle`, below).

A plain shape skips steps 1 to 3 and takes creatures first to `grow.creatureFill` of the way through its creature range; a theme keeps the minimum and leaves the rest to its own cards.

**The payoff gate** (`gateOpen`) holds in every step after the theme core:

- A payoff of the plan enters only when the setup already in the deck covers it at the floors' ratio (8 setup weight per 6 payoff weight for Graveyard at 60; one per one without a payoff floor). A card counts once, so it never covers its own need.
- A payoff of another style at `grow.offPlanGateWeight` or more needs that style's setup in the deck, unless it is setup for the plan, earns a spell role (removal, sweeper, card advantage, cheap interaction, ramp), or is a creature whose payoff job needs nothing (a flying carrier for Voltron, a big body for Ramp).
- Setup of a style marked `setupNeedsPayoff` (Mill, Group hug, Energy) needs a payoff of its style in the deck and stays within the ratio. Before this rule, opponent mill (Ruin Crab) entered Graveyard decks as early creatures.

**The finished-deck check** (`settle`). The deck's supply, lands included, can differ from the running one the picks saw, so every spell is checked again. First `feedNeeds` feeds a theme card whose job the pool pays for but the deck does not (the loose try's cards, and the commander's own job when the floors need it). Each unmet gate (a drawback, a required cost such as Goblin Grenade's Goblin) and each unmet need of the clause closest to holding takes the best pool card that supplies it: one alternative at a time (Valduk's "each Aura and Equipment attached" takes Equipment or Auras, not some of each), as many copies as the need asks ("four or more Wizards" asks 14 at 100), and more copies of the card itself when it supplies its own need. Each supplier replaces a curve copy (other plans' cards first, the weakest first) or a role pick above its minimum, never the card, one of its suppliers, or a copy another card's needs hold on; a role minimum yields only when the deck is short of its floors without the job and nothing else can go, as in a 20-card packet. The feed is kept only when the card then earns its job and the floors are no worse; otherwise it is undone. Then, for up to three rounds, a copy the deck does not support, or whose recorded reason it does not earn, goes for the best card for the same slot (the same role or theme side, else its curve slot), keeping the size and land count. A supported role card whose role nothing else can fill stays as a curve card; any other copy with no replacement stays and counts as unsupported. Last, the floors are counted as the finished deck earns them, nothing taken as met: a theme the deck cannot pay for is short and the request gets the nearest deck, never "minimums met".

Above the floors the plan's setup, and payoffs the setup covers, keep a pull in the role and curve fills (`planPull`). A thin pool relaxes the curve fill in order (`RELAXATIONS`): the type mix, the usual copy counts, the gate on other themes' cards, then the card needs rule. The plan's own payoff gate never relaxes.

A style the player asked for (`requireStyle`) that the pool cannot support gets a plain note and the nearest deck: the first style of its `kin` list the pool can build, else best fit, which never holds the short style (`explanation.nearest`). Without `requireStyle` it is refused, so a list drops it. Styles show as Short down to `grow.nearMargin` of their floors.

## Why seed and grow

The classic builder counted setup and payoff with yes-or-no tag matchers. Riders counted as setup (21 of 41 counted setup copies in Graveyard decks, 17 of 30 in Lifegain, 17 of 35 in Counters); looters and sacrifice outlets were left out; a card that did both counted twice, on both sides and in the first tiebreak; nothing gated a payoff on its setup; and most off-plan cards came in through the swap search. All 24 requested 60-card decks checked met its own minimums, 8 to 10 an honest count. The deck score and the learned data counted with the same matchers, so they could not see it. Better search cannot fix wrong counts, so the fix went into the definitions and the fill order, and the grow builder has no swap search.

A blind panel of judges reading card text alone decided it. Over all four sizes the classic builder was decent 62% of the time, seed and grow 88%, and the classic code with honest counting (A') also 88%. Seed and grow won on theme fidelity (the judges' plan named the requested theme for 26 of 29 of its themed decks, against 14), speed (two to twelve times faster), and carrying no inherited filler or swap search. Seed and grow on the old matchers was decent 86% of the time, but the judges listed no setup for 15 of its 20 themed decks: the structure earns "decent", and the honest rules make a themed deck play its theme. At its first ship, themed requests were decent 98% against 57% at 100, 78% against 50% at 60, and 75% against 20% at 40.

Meeting the floors gave a decent deck of the style only 40% to 60% of the time, so the floors are necessary, not enough, and the picker also scores depth and the finished deck. Decks built by hand from card text showed that setup counts by volume (2.3 setup per payoff in a Blue Graveyard deck, against the guide's 1.5) and that a plain deck of the pool's best cards is often the best fit.

## Theme rules

`config/theme-rules.json` (rules version 9) holds, for 18 themed styles, setup and payoff jobs read from oracle text with reminder text removed, type lines, tags, keywords, mana value, and power, with weights, exclusions, and floors per size, plus one tribe style per creature type.

### Counting

- A card counts once, as the job it mostly does; a rule's `priority` settles a card that meets both. If one half is a rider, the card is the other job.
- A rider counts nothing: a small one-time bonus on a card that does another job, such as surveil 1 on removal or a Food on a burn spell.
- Repeatable setup weighs about twice a one-shot.
- Floors count units (each copy's weight capped at 1), weight (copies times weight), or copies of repeatable jobs. Each floor is the low end of the theme guide's range in that unit, and "X engines, or Y setup" became two alternatives.
- A tag starts a rule but rarely ends it: most tag rules also check the text.

### The odds standard

Every floor rests on draw odds with about 12 cards seen by turn 5 (7 plus 5 draws) at every size, so the 99-card figures are a little stricter than a turn 6 or 7 check.

- A setup floor shows a setup card by turn 5 in about 9 games of 10.
- A payoff floor shows a payoff in about 3 of 4: 6 in 60 gives 75%, 4 in 40 gives 78%, 10 in 99 gives 74%.
- An engine the plan cannot run without shows in about half of games: 2, 3, and 5 copies at 40, 60, and 99. An engine that one-shots can stand in for shows in about 3 of 5: 3, 4, and 7.
- A 20-card packet is half of a shuffled 40-card deck, so it uses the 40-card odds with only its own copies and aims at about 2 games in 3 (3 copies 67%, 4 copies 78%). Its theme must work from its own cards.

Real decks show only that the floors sit in the range real decks play: counted with the guide's own classifier, their medians are a scale check, not proof. The floors are stricter than many precons (of those named for their theme, 22% of Tokens, 30% of Counters, and 61% of Graveyard meet them, and 15% of winning draft decks meet their best theme). That is on purpose: Bulk Brew names a deck for its theme, so the deck must deliver it, and a bulk builder only counts where a designer checked each payoff.

### Per style

Floors at 60: S setup units, Sw setup weight, R repeatable copies, P payoff units, Pw payoff weight.

**Tokens** (S 9, R 4, P 6, or S 12, P 6). 9 setup shows one in 89% of games. Bursts stand in for engines, so the engine floor is the 3-in-5 kind and the S 12 alternative passes a deck of bursts. Temporary tokens, fed engines, and a creature with one token count half. "Target player creates" is yours; a wipe that hands the opponent tokens is not. Typal lords, "nontoken" payoffs, and wipes that scale with the board (Blasphemous Act) pay nothing off.

**+1/+1 counters** (S 10, R 4, P 5, or S 13, P 5). The engine floor takes any growth engine (spreader, mass placer, self-grower): a floor of spreaders and mass placers failed every top precon, which run 0 to 2. Without engines each setup card makes about one carrier and the lords want 3; 13 in 60 puts about 2.6 in the cards seen, hence the alternative. `counters-matter` counts only with +1/+1 or proliferate in the text. Cards that spend their own counters (Festercreep) and unmet conditions (Ajani's Comrade) are false friends; outlast lords are payoffs.

**Aristocrats** (S 12, R 3, P 4: 4 outlets plus 8 fodder). No repeatable outlet, no deck: the outlet floor shows one in about half of games. Top draft decks run one, but a deck named Aristocrats must deliver the plan, so a pool short of outlets builds Tokens (its `kin`) or a plain shape. Outlet beats payoff beats fodder. Outlets for lands or artifacts, symmetric edicts, typal outlets, and scry riders are false friends; morbid is a 0.5 payoff because the real Morbid packets build on it.

**Graveyard** (Sw 8, R 2, Pw 6). The minimum is about the designed-deck median and the guide's 10 to 12 target is stricter on purpose: designed decks feed creature payoffs through trades a count cannot see, and the failure to stop is a pile of payoffs whose setup is riders. A looter on a permanent weighs 2, or 0.5 when its loot costs 4 mana or more (Sphinx's Tutelage). Graveyard hate, cards that use the graveyard up (Constrictor Sage), and counts of opponents' graveyards (Mill payoffs) are false friends. A body that needs a full graveyard is a payoff (Splinterfright); otherwise a card that fills three or more, or every turn, is setup.

**Spellslinger** (S 15, P 6). Every instant and sorcery is setup, 1 at mana value 2 or less down to 0.25 at 5, plus 0.25 for a cantrip and 0.5 for flashback; 15 units stands in for the guide's 18 to 22 spells with 12 cheap. Payoffs are permanents: a spell that rewards spells fires once, so it is setup. Restricted mana and flash grants are false friends.

**Lifegain** (S 10, R 8, P 6). Count events, not life points: 8 repeatable sources in 60 show one in 85% of games. Gains on removal, gains for the opponent, and one-turn lifelink count nothing, and with reminder text removed no Food maker reads as a repeatable gainer. Payoffs beat setup (Oloro), but a lifelinker whose reward only improves itself stays setup (Lone Rider). Increasers and life-total clauses are half payoffs; a life-total clause counts nothing at 100, where 40 life keeps it always on.

**Artifacts** (S 10, P 6) and **Enchantments** (S 8, P 6). The guide counts sources with the payoffs among them (16 and 14); a card counts once, so setup is that minus the payoff floor. Count payoffs need three on the table: 18 sources in 60 have seen three by turn 5 in 78% of games, 16 in 68%, so a deck near the floor leans on enters, cast, and sacrifice payoffs. Cost reducers are half payoffs; a one-artifact condition on an artifact is setup. The `affinity` parent tag, cards that only target an artifact, enchantment removal, and Shrines are false friends.

**Voltron** (S 12, Sw 18, P 8). The weighted floor stands in for "about half repeatable": Equipment 2, sticky Auras 1.5, buff Auras 1. 13 attachments show two by turn 5 in 80% of games; 8 carriers and payoffs show one in 85%, 4 carriers alone in 60%. Hostile Auras, Skullclamp-style Equipment, and Equipment that grants shroud (it blocks your other attachments) are left out. An attachment is setup, a creature a payoff. Carriers are broad (any cheap evasive or hexproof creature), so cheap flyers can meet the payoff floor.

**Evasion** (S 10, Sw 17, no payoff floor). The deck wants two evasive attackers by turn 5: 12 in 60 give 76% of games, 10 give 65%. Power 2 or more weighs 2, power 1 weighs 1, power 0 and defenders nothing; landwalk counts half. Bulk has too few payoffs for a floor: 1, 1, and 3 at 60, 40, and 100 would cut the viable color requests from 60, 60, and 48 to 20, 20, and 1. A team combat damage trigger is a weight-2 payoff, read only at a line's start so granted quotes never count; an evasive creature's own trigger is a weight-1 payoff, which works only with `grow.payoffPull`. An evasive lord is a payoff.

**Burn** (S 10, Sw 14, R+P 4). Cheap creatures deal the first 8 to 10 damage, so the deck wants three or four burn spells by turn 6 or 7. A pinger landing on turn 2 or 3 deals 4 or 5 by turn 7, more than a burn spell, so it weighs 2; a one-shot body 0.5. A weighted 14 works about like 14 burn spells, which show three in 14 cards 70% of the time (10 alone, 43%). Pingers and payoffs stand in for each other, hence one floor. Face damage as a rider, "each player" damage, and damage on another theme's engine (Impact Tremors) are no setup; symmetric punishers count only at 100.

**Landfall** (S 5, P 5). Every land drop feeds the payoffs, so they set the bar: 8 in 60 shows one in 82% to 85% of games. The floor counts units (lasting 1, one-turn 0.5, thresholds 0.25), so the guide's lowest case, 2 lasting and 6 one-turn copies, is 5. A packet carries its theme alone (P 3 at 20). Ramp that gives the opponent the land and triggers on other players' lands are false friends; a card that makes lands enter on its own is setup.

**Mill** (S 12, R 6, P 2). A rough race at 60 decks the opponent on turn 16, 14, 13, and 12 with 5, 7, 8, and 10 engines beside 6 one-shots; more than 8 gains little. Real decks run about 5 to 7 per 60, and the floor sits a little above them as a margin for a builder that only counts. Payoffs for your own library, riders on counters and bounce, and symmetric mill are false friends.

**Ramp** (S 6, R 6, P 6). With 8 lasting sources one shows by turn 3 in 75% to 79% of games, two in only 34% to 40%: plan on jumping one turn. 6 is what the stronger ramp precons run; big-creature precons with 3 to 5 play as midrange. A mana value 4 creature is never a payoff (curve filler); payoffs are 6-drops with power 5 or more, or 4 with flying, trample, or an enters trigger, and five-drops at 0.75. Rituals, mana eggs, and restricted mana are left out. A creature that ramps is setup at 3 mana or less and a payoff at 5 or more.

**Tappers** (S 8, R 4, P 2). Engines want a tap every turn, so about 3 setup per payoff; five repeatable tappers in 60 find one by turn 4 about two games in three. Lock Auras are removal and excluded.

**Group hug** (S 10, R 4, P 6, Pw 10). At two players a gift without a punisher only helps the opponent; at 100 the style means cards and lands for everyone, so land and mana gifts count only there. With 4 punishers in 60 one shows by turn 5 in 60% of games and two in 18%: plan around one live punisher. Pw 10 with P 6 asks for at least four weight-2 punishers. Gift riders, life gifts, and draw stax are false friends.

**Goad** (S 10, R 6, P 4). At two players a goaded creature attacks you, so blockers carry part of the plan, and pump-and-goad Auras, which send it in bigger, weigh 1 below 100 and stay out of the lasting floor. 12 setup show one by turn 5 in 95% of games, 5 payoffs only 69%. Self-forcing cards and attack taxes are false friends; a card whose reward follows only its own target is setup.

**Energy** (S 8, R 3, P 8, Pw 12). About one maker per sink, since most sinks bring their first 2 or 3 energy; 9 makers show one in 89% of games. 108 of 141 energy cards make and spend, so each gets one job in a set order (get trigger, multiplier, variable spend, sink, maker). Pw 12 with P 8 asks for at least four repeatable sinks.

**Tribes** (100 only: S 20, P 10). The floors stand in for the classic builder's 28 members and 4 payoffs, with each card counted once and payoffs at the Tokens and Artifacts level. Setup: creatures of the type, changelings (CR 702.73a), creatures whose own text makes them every type, and makers of creature tokens of the type or with changeling. A payoff needs the type's Tagger tag and text that names the type, not as "non-Elf" or only in a token: lords 2, other rewards 1. A lord of the type counts once, as a payoff, and supplies the others (`payoffSupplies`). "Time Lord" stays whole.

**Plain shapes** have no rules: a plain deck with a working curve, enough interaction, and a way to win is decent.

### What the rules cannot say

- A commander that does a job lowers that job's floor in the guide; the rules count it as one card, so decks built around their commander read short.
- Deck-dependent weights (entomb and creature cycling when reanimating) and the Aristocrats value-outlet rule (each value outlet lowers the payoff floor by one) are not encoded.
- Sub-floors have no floor key: cheap Artifacts and Enchantments sources, lasting Landfall payoffs (approximated by units), punishers (by payoff weight), Evasion attackers at power 2 or more.
- Patterns cannot strip abilities granted in quotes (Goad, Group hug).
- Tappers, Mill, Group hug, Goad, and Energy have one to four named real decks, so their floors rest on the draw math alone.

## Card needs

`card-needs.ts` reads each card's text into what every ability depends on, with the vocabulary and templates in `config/card-needs.json` and the parsing in code. The owner's rule (2026-11-16): a card earns a job only in a deck that supplies what the job depends on, decided by an automated reader with no one in the loop. Agents do not tag cards.

Tags cannot decide it. About 15,000 cards carry a tag hinting at a dependency, but `typal` sits on Lo and Li (useless without Nobles or Lessons), Shilgengar (an Angel bonus), and Caustic Exhale (cheaper with a Dragon) alike. So the reader splits text into abilities by shape, and each resource an ability names gets a place (condition, trigger, cost, selection, count, replacement) and a kind fixed by its template: a need, a bonus ("instead", "or pay"), a drawback (an "unless" over an effect that harms its owner), or unconditional (always the body and keywords). A card can supply its own need.

The grow builder gives a role or theme credit only where the deck meets its needs (a theme's own resources, `themeResources`, taken as met while the core seeds payoffs ahead of their setup), keeps out cards with unmet drawbacks, and counts the commander's jobs only while its needs hold. The scan counts only jobs the pool can pay for, and a spell supplies only where every deck of the request can hold it (`holdable`). The finished deck is fed and checked again (`feedNeeds` and `settle`, under Seed and grow). Land utility and land entry read the same reader.

It was checked on 317 cards whose expectations an agent wrote from their text without seeing the reader. The first comparison agreed on 85% and found 119 reader errors, all fixed as templates; now 636 of 638 abilities agree. Policy calls made then: a count with no threshold needs nothing; an "or pay" cost is priced at its mana value plus N without the resource; a credit earned only in a bonus branch is gated like a need. Unsupported copies per deck fell from 0.82 to 0 at 60, 0.54 to 0 at 40, and 0.99 to 0 at 100.

## The plan picker

`pickScore` scores the finished deck of every plan, and the same number ranks best fit, the Build page options, and the Analyze pane, so the first option is best fit card for card. The plans are the three plain shapes, always, and each theme with a pool margin of 1 or more, a commander's tribes among them. The score, with `picker.*` and `grow.*` constants:

```
score = quality * fit * clean * cast^castWeight * (1 - colorCost)^(colors - 1)
theme:  score *= margin * richness * depth * lead / themeMargin
margin   = min(1, poolMargin / marginFull)
richness = min over sides (setup, and payoff where the floors ask for it) of
           r = pool / expected;  r > 1 becomes max(1, r - richnessZ / sqrt(distinct cards expected));
           capped at richnessCap; 1 when no baseline is bundled
depth    = 1 - depthWeight * (1 - deep(setup)) - depthWeight * (1 - deep(payoff)),
           deep(x) = clamp((have / floor - 1) / (depthFull - 1), 0, 1)
lead     = 1 + (commanderPlan - 1) * textShare * min(1, payoff weight), else 1
```

The color term is 1 under a commander, whose colors are not a choice. The score rounds to `scoreStep`, and ties go to Midrange, Aggro, Control, then themes by id (`planOrder`). Best fit's notes name the plans it compared in order; the scores stay internal (`explanation.pick`).

- **Quality** is rank for rank within mana value and kind, so a deck that plays the best cards of each slot scores 1 however many it needs. Comparing every copy with the slot's top five had kept Aggro out of all 50 plain-pool best fits at 60.
- **Fit** counts role minimums, curve slots, and the creature count, not role targets: the fill builds to minimums, and small targets are easier to reach.
- **Clean** is the share of supported spell copies; **cast** the share of spells, commander included, the mana casts on curve from the sources it records per color (1 in one color). Quality is measured within one color set's pool, which grows with each color, so cast and `colorCost` keep more colors from ranking up on equal cards ("mono stays the strongest mode").
- **Richness** is the smaller side over plain bulk of the same colors (`config/theme-bulk.json`, every common and uncommon weighted equally). On 3,000-card pools every two-sided theme met its floors with room, and margin alone gave Ramp 43 of 62 best fits. Plain bulk reads 1.3 to 1.8 by chance where few theme cards are expected, so a side counts above 1 only past its noise. A theme with no payoff floor reads setup alone; a tribe reads its type's own baseline, and a type no commander in the pack names has none (richness 1).
- **Depth** charges a deck left at its bare floors, which often plays thin.
- **Lead** counts only a theme the commander's own job pays off (see Commander and tribes).

On held-out pools the first option was decent against the shipped core best fit 100% to 63% at 100, 90% to 78% at 60, and 90% to 57% at 40. Best fit is a plain shape about 90% of the time, mostly Midrange by the tie rule. The owner's rule: best fit means the best deck with no target mix, so the mix is reported, not gated, and only a skew from a scoring artifact is a regression.

## Lands

**One color** (`landRules.mono`). A nonbasic is scored against the basic it replaces. The owner's rule (2026-11-16, refined 2026-11-18): only a land that adds nothing for the deck is worse than a basic, and entering tapped is no cost in itself (`nonbasic.entersTapped` 0). A tapped dual stays out because its second color, all its tapped entry pays for, gains nothing in one color. The score, against a basic at 0:

- Making the deck's color, or any color, gains nothing.
- Costs: the chance to enter tapped times `nonbasic.entersTapped` (0), life paid to enter untapped (`mono.lifeToEnter`, never more than the tapped cost, so nothing today) or per tap (`mono.lifePerTap`), a tagged drawback (`mono.drawback`), and making no deck color (`mono.noDeckColor`).
- Gains: `nonbasic.utility` for an ability the card needs reader finds earned in the deck, its needs met by the deck's spells (Trenzalore Clocktower needs a Time Lord). On a land of the deck's color this also counts what the land does as it enters and what a mana ability does beyond its mana (Arena of Glory's haste). `mono.planUtility` for a lasting ability (not an enters trigger such as surveil 1) that does a setup or payoff job of the deck's style or has one of `mono.planTags`: a creature land for Aggro, Midrange, and Control, `mill-self` for Graveyard, evasion granters for Evasion. A land with no ability does a style's job by its types (an artifact land in Artifacts).
- A colorless land costs the deck a source of its color (`mono.colorlessOnly`), gains only on the plan, and is capped per size (`mono.maxColorlessOnly`).
- In: above `mono.minScore`. Ties go to the land less likely to enter tapped, then the more played.

`NO_USE` in `card-needs.ts` lists text that does nothing a basic does not, so it is no ability: searching for a land or landcycling, and a fetch when the land dies (that is making mana); making every land a basic type; a Planet's Station line (its station abilities count on their own); Indestructible, hexproof, or shroud; returning the land to hand, giving it to an opponent, or sacrificing it; a painland's damage; a rainbow or storage land's own mana (its counters, energy, chosen color, "instead add", a Gate's second color, Tarnation Vista's one color for {1}); opening-hand text; and no maximum hand size. Draft-only lands (Paliano, the High City) never enter a mana base. Multi-color decks still read the utility tag alone.

**Entering tapped** (`landEntryReading` in `card-needs.ts`, `landEntry` in `lands.ts`). The pack marks a land `entersTapped` whenever its text says so, conditions and all. The reader turns the condition into the resources it names and the game state it checks, and `landEntry` holds it against the deck with the weights in `landRules.entering`: a basic land type against the basics of the deck's colors; a tribe, a Jace, or a legendary creature against the deck's spells (a tribe style counts its type, a commander counts as a legendary creature); "two or more opponents" as untapped in Commander only; land counts and low life as game state; "pay 2 life" as a life cost instead. A land never meets its own condition, and a condition the reader cannot read stays always tapped. "Activate only if" mana conditions are read the same way, and the same chance feeds the multi-color tapped cap. On the 2026-11-03 pack, of 680 lands marked tapped, 502 always are, 150 are conditional shapes read from the text, and 28 unknown shapes stay tapped.

**Several colors** (`colorWants` in `lands.ts`). A color's source want is the fewest sources that cast `colors.sourceCover` of its spell copies on curve; the most demanding copies past that share may wait a turn. `npm run sources:fit` fitted the share on the corpus train split: the strictest value, in steps of 0.05, at which the median real multi-color deck from 2015 on is short in none of its colors (per deck its worst color, the commander counted). Decks short in some color fell from 82% to 35% at 60 (test 29%), 96% to 49% at 40 (test 49%), and 100% to 40% at 100 (test 35%). Counting every year at 60 would need 0.65, since older precons run fewer sources. 20 keeps 1: the corpus has only 23 multi-color 20-card decks, and the median one met the old rule. Basics go first to colors below their want, then below what every copy needs, then by pips.

## Commander and tribes

- The commander counts once toward a theme job (`grow.commanderCredit`), in the scan, the plans, and the deck views. Its tribe job counts toward the pool's floors only where its needs are the type itself (`commanderJobs`).
- Its lead (`commanderLead`) applies only to a theme its own job pays off: up to `grow.commanderPlan`, by the share of its text abilities (keyword lines aside) that do the theme's work, times its payoff weight up to 1. Lathril leads its Elf tribe in full and Evasion (its own combat damage trigger, half its text) by half; Danitha Capashen's half-weight cost reducer leads Voltron, Enchantments, and Artifacts each by half; Toby leads Tokens in full. A pull that followed how rare a theme's payoffs were in the pool said nothing about what the commander is for; the classic path still uses it (`commanderPull`).
- **Tribe mechanics.** The rules' top-level `tribes` is written once with placeholders (`{type}`, `{plural}`, `{types}`, `{slug}`), and the core reads it as the style `tribal:<Type>` for any type the card needs vocabulary names (`themeStyleOf`). A commander names a tribe when it carries the type's Tagger tag and the rules give it a payoff job for the type (`namedTribes`); those tribes join the request's themes after the rules' own, for the scan (`leadTribes`), the commander list's leads, the Build page options, best fit, and the deck views, all counted the same way. A tribe payoff counts only where the deck supplies the type, the type being the tribe's own resource while the theme core seeds. `theme-bulk.json` holds a baseline for each of the 135 types the pack's commanders name. A tribe the commander does not name is refused, and the classic builder refuses one asked for by name below 100.
- On held-out pools tribe requests were decent 16 of 20 against 20 of 20 for the classic builder, inside the band of about 30 points at 20 requests. All four misses were nearest decks where the tribe missed its floors, and every tribe built was judged decent. The tribe floors were set before that panel and are not tuned.

## 20-card packets

- **Half cast** (`halfCast` in the 20-card template, `halfCastable` in `candidates.ts`). A spell is a candidate only if, as half of a 40-card deck with 16 lands and its own 8 lands split evenly among its colors as the only sources, it has 0.3 chance or more to have seen its mana value in lands and its pips by turn 10. In one color everything at mana value 7 or less stays except five pips of one color, or four on a seven-drop, and everything at 8 or more goes. Ulamog or Kozilek sat dead in 6 of the prototype's 12 halves on 8 lands; official packets play mana value 8 or more in 0.26% of their spells. Best fits holding such a card fell from 137 to 0.
- **Rules at 20** (version 8): no payoff that counts a resource or waits for a threshold counts, since a packet shuffled into 40 rarely holds three artifacts or a full graveyard. Spellslinger asks 4 setup with its 3 payoffs: at 5 the theme took 87% of a packet's spells and missed 0.63 role minimums, at 4 it missed 0.04.
- A packet without a secondary style never reaches the classic builder: a thin pool pads with lands, and a request no plan fills is refused.
- On held-out pools the first option at 20 was decent 39 of 40 against 78% shipped.

## The classic builder

What `buildClassic` still does for secondary styles, and for the thin-pool fallbacks without learned data:

1. **Candidates and plan.** The same candidates; the old scan (`scanCandidates`, the `archetypes.json` enabler and payoff matchers against per-size minimums, at 100 a style's own minimums or else the 60 ones times `commander.minimumScale`) says which styles are viable. A picked primary style is built if viable. A secondary style needs a primary: a second theme must reach `secondary.minimumShare` of its minimums, a shape can only follow a themed primary, and a tribe needs the `secondary.tribal` members and payoffs.
2. **Best fit** (only when no style was built). With learned plans at the size, `planScores` (`plan.ts`) scores each viable theme by how often real decks of the size run it (under a commander also its EDHREC plan shares, at `learned.commanderShare`), how much more of the theme the pool holds than bulk, and whether the pool fills it to what real decks play; shapes score by curve closeness. The best `learned.candidates` themes and the viable shapes are built, ranked by plan score plus `deckScoreWeight` times the deck score. Only a secondary style with no primary reaches this, which the apps never send. Without learned data, best fit builds every viable style and keeps the highest deck score, a style the commander rewards getting up to `commander.styleBonus` (`commanderPull`).
3. **Fill** from the template's base land count, in passes under type caps: role minimums, the theme's enablers and payoffs to their minimums, each color's minimum (`landRules.colors.minCardsPerColor`, multi-color only), role targets, the theme toward its learned target, type mix minimums, curve, then filler that may ignore the caps. Candidates order by a curve bucket still below target, then the `tiebreaks` list (`themeTagHits`, strength, lower mana value, name), then id.
4. **Lands** from the land formula; trim or refill until the count is stable.
5. **Local search** (`localSearch`, `maxPasses` and `maxSwapsPerPass`): swap a chosen card for an unchosen one while the objective improves, never below the minimums the fill reached for either style; then refit the lands and validate.

The **objective** (`builderWeights.objective`) subtracts curve deviation beyond tolerance, type mix deviation, and role shortfall (a missed minimum counts twice, a missed target once), and adds synergy pairs from `synergy-rules.json` (at `learned.selection.rules` when learned selection runs), the learned plan fit, pairs, and combos (`select.ts`), `themeHit` per theme hit, and card strength less cast penalties. With learned plans, each copy of a role or card type outside the middle half of real decks of the plan, and each theme card above it, costs `learned.profileWeight`.

The **deck score** (`builderWeights.deckScore`, 0 to 100) weighs synergy 0.6, castability 0.3, strength 0.15, roles 0.1, curve 0.1, and type mix 0.05; with learned plans it is closeness to real decks of the plan (0.7) with strength and castability (0.15 each). It ranks secondary-style options, plus `buildOptions.allColorsBonus` and `secondaryBonus`. It rewards strong cards together, which is not a deck that works, so it stays internal.

The grow builder sets no per-color card floor: only this fill reads `minCardsPerColor`, and the scan asks only for one spell of each color.

## Learned data

`npm run learn:build` writes `config/learned/` (plan profiles per style and size, tag fit, tag pairs) and `data/learned.json` (combos, card plan fit, card pairs) from the reference corpus (MTGJSON precons, 17Lands draft decks), EDHREC pages fetched developer-side, and Commander Spellbook's combo file. Spellbook's file is read with a small streaming reader of our own; a combo is kept when it uses three or fewer cards, has no template requirements, has status OK or Example, and has a standalone result in `builderWeights.combos.results`.

Only the classic builder reads it, so today it shapes secondary-style decks alone, and only at 100, 60, and 20 (`learned.plan[size].use` is off at 40): `select.ts` (plan fit, pairs, combos, at `learned.selection` weights), the learned fill targets and profile cost, and the learned deck score. `planScores` in `plan.ts` is not reachable from the apps; `calibrate.ts` in the pipeline is its caller. `builderWeights.combos.weight` is validated but never read. No grow path reads any of it (owner decision 2026-11-16: retired for grow paths, not relearned), though `configVersion` still includes the learned versions.

It was retired rather than relearned because it counted real decks with the old matchers and inherited their riders: its Graveyard tag fit rated `mill-self` 4.88 against `loot` 1.98. It had fixed a real skew (Artifacts in 27% of 60-card builds against 5% of real decks). The 17Lands decks hold only 5,195 distinct cards, so card-level learning from drafts reaches little of bulk.

## Constants

The `grow` block of `builder-weights.json`:

| Key                 | Value | Where it came from                                                                                        |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `marginFull`        | 1.5   | Set from the theme guide's reasoning, not fitted.                                                         |
| `richnessCap`       | 2     | The same; applied after the `richnessZ` cut.                                                              |
| `richSeed`          | 1.25  | The same. At packet floors of 2 to 5 it rounds up hard (a named Lifegain packet: 10.5 theme cards of 12). |
| `commanderCredit`   | 1     | The rules count a commander as one card.                                                                  |
| `commanderPlan`     | 1.25  | The most a commander leads a theme, scaled by its text share and payoff weight.                           |
| `offPlanGateWeight` | 1     | A payoff that does little without its resource stays out of decks that lack it, plain ones included.      |
| `fullSlot`          | 0.5   | An Elf tribe deck picked by quality alone came out curve-flat.                                            |
| `setupPull`         | 0.25  | The guide's targets sit above its minimums: 0.25 added 0.23 setup units per theme deck, 0.5 added 0.45.   |
| `setupTarget`       | 1.5   | Where both pulls fade out, from the guide's targets over its minimums (Graveyard 10 to 12 against 8).     |
| `payoffPull`        | 0.5   | Named Evasion 60 decks held an own-trigger payoff in 23 of 60 at 0.5, 11 at 0.25, 26 at 0.75.             |
| `creatureFill`      | 0.5   | The middle of the range: Control holds about 14 creatures at 60, not the 10 its minimum gave.             |
| `nearMargin`        | 0.5   | A style with half its floors is Short: offered, and answered with a note and the nearest deck.            |

The `picker` block:

| Key           | Value | Where it came from                                                                    |
| ------------- | ----- | ------------------------------------------------------------------------------------- |
| `themeMargin` | 1.2   | A theme must beat the plain deck the same pool makes by a clear margin, not by noise. |
| `richnessZ`   | 1.65  | The one-sided 95% level, not fitted to a mix.                                         |
| `depthFull`   | 1.5   | A side counts as deep at this multiple of its floor.                                  |
| `depthWeight` | 0.1   | The share of the score a theme gives up per side left at its bare floor.              |
| `castWeight`  | 1     | Counts the cast share as the chance it is.                                            |
| `colorCost`   | 0.1   | Keeps one color the strongest mode across color sets.                                 |
| `scoreStep`   | 0.01  | Below it the parts do not tell decks apart.                                           |

Hard-coded in `grow.ts`: a pool is rich at 2 times its floors on both sides, the peer level takes `max(2, round(slots / 7))` copies, and the land slack over the formula is 2 at 60 and 100 and 1 at 40.

## Tried and dropped

- **Prototype A'**: the classic builder with each card counted once, a payoff gate in every pass, and in one variant plan-first ordering, package moves, and tabu memory. It tied seed and grow on decent rate and lost the rest: its copied filler and swap search still added off-plan singles, setup stopped at the floor (145 of 182 styled 60-card decks within 15% of it), best fit leaned to shapes at 60 (83 and 122 of 161) and to Ramp at 100 (14 of 38), and theme fidelity was 14 of 29. Lessons kept: the gate must cover lands (payoff lands such as Cabal Pit and Gaea's Cradle entered unfed in 16 of 732 decks), type caps can hold a theme under its floor, and a swap search needs a guard on each color's minimum.
- **Ruled out early**: integer programming (a solver dependency, no time bound), genetic search and game simulation (no rules engine on the device, far too slow), learned pick models (tens of megabytes, draft-era cards only), co-occurrence as the builder (symmetric, so it cannot say which card feeds which), random dropout (not deterministic), and the best deck per cell of plan and curve (no target mix). A config-only fix to the classic builder was impossible: its matcher clauses read tags, never oracle text.
- **A commander's job counted three times** (the guide's "trade 3 or 4 setup for payoffs"): dropped, since the rules count a commander once.
- **Evasion's own trigger as a payoff with no pull**: decks holding a trigger card fell from 21 of 60 to 4.
- **A pool count of only what every deck of a style supplies**: moved best fit on 71 development requests.
- **Other basic splits**: by pips right past the want, the mean on-curve cast chance fell (0.984 to 0.982 at 40). Each basic to the color where one more source casts the most copies raised it 0.3 to 0.4 points but moved 10% to 20% of best-fit styles through the picker's near ties (Aggro 122 to 66 of 2,000 at 40); it waits for a picker the last few basics cannot flip.
- **A lower splash chance** (0.9, 0.9, 0.6 by role fit draft decks better): left alone because `castChance` also drives the classic castability score.
- **Learned plans at 40**: the panel preferred the old builds 9 to 1 (one Graveyard deck ran three Stone Docents and two flashback spells), and blending the old score back brought back the old skew (Artifacts 29% of builds against 10% of real decks).
- **A Drain style**: only 1 or 2 real decks at 100, 60, and 20 met it, and best fit never built it.
- **Card quality recalibration** from real decks' traits and 17Lands win rates: builds moved closer to real decks' makeup, but plan recall fell at every size as generically strong cards pushed out theme cards.
- **Other styles tried on the corpus**: Discard and madness (pulled graveyard Commander decks off their plan), group slug and casting from exile (too few precons meet any version), Landfall payoffs that count lands (too broad).
- **Synergy rules for Group hug, Goad, and Energy**: changed the best-fit style of 55% of 40-card draft decks, since every rule counted in every deck's score.
- **A Graveyard over-build** looked like a gain on the matcher-based style match and was reverted (26.0.29, undone in 26.0.30).
