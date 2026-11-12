# Archetypes

Two kinds of deck identity. Composition archetypes are about shape: curve and role mix. Synergy archetypes are about a theme: enablers that set something up and payoffs that reward it. Feeds `config/archetypes.json`, `config/roles.json`, and `config/synergy-rules.json`.

## How matching works

Roles, enablers, payoffs, and synergy rules are all matchers: a list of clauses, where a card matches when any clause matches and every condition inside the clause holds. Conditions are Tagger tags (any of, all of, none of), Scryfall keywords, normalized card types, words in the type line (or words it must not have), mana value bounds, and a few derived facts tags cannot express: big threat (`finisher`), Commander finisher, cheap mana source, evasive creature, modal land face, basic land, nonbasic land, vanilla body.

Tagger tags are inherited: a card tagged `spot-removal` also carries `removal`, so broad and narrow tags both work. Tag weights are ignored because nearly all taggings share the same weight.

## Composition archetypes

| Id       | Curve    | What changes                                                                                      |
| -------- | -------- | ------------------------------------------------------------------------------------------------- |
| aggro    | aggro    | 10 to 14 early creatures in 60, more cheap interaction, less card advantage, 60% to 80% creatures |
| midrange | midrange | The template defaults                                                                             |
| control  | control  | 6 to 10 removal, 1 to 2 sweepers, 4 to 7 card advantage, 25% to 50% creatures                     |

Midrange is the fallback when no synergy theme is viable.

## Synergy archetypes

The app shows each archetype by its label; four labels differ from the id: spells is Spellslinger, auras is Voltron, flyers is Evasion, and bigCreatures is Ramp.

Minimums are enabler and payoff counts the pool must hold for the theme to be viable at each size. They sit a little above what the finished deck needs so the builder has choices.

| Id           | Enablers                                                                                                             | Payoffs                                                                                                                               | 60 / 40 / 20 minimums (enablers, payoffs) |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| tokens       | Token makers, one-shot multiple bodies                                                                               | Anthems, team pump, creature-count payoffs, overrun                                                                                   | 8,4 / 5,3 / 3,1                           |
| counters     | Cards that place +1/+1 counters                                                                                      | Counters-matter, proliferate                                                                                                          | 8,3 / 5,2 / 3,1                           |
| aristocrats  | Sacrifice outlets; tokens and death-trigger fodder                                                                   | Blood Artist effects, sacrifice payoffs, death triggers for others                                                                    | 8,4 / 5,2 / 3,1                           |
| graveyard    | Self-mill, cards that want to be in the graveyard, and looters or discard outlets that also care about the graveyard | Recursion, reanimation, graveyard-count payoffs, cards that leave or exile from the graveyard, threshold, undergrowth, delve, unearth | 6,5 / 4,3 / 2,2                           |
| spells       | Instants and sorceries                                                                                               | Prowess keyword, spell-cast triggers, magecraft                                                                                       | 14,5 / 9,3 / 5,2                          |
| lifegain     | Life gain, lifelink                                                                                                  | Lifegain-matters, Pridemate effects                                                                                                   | 8,3 / 5,2 / 3,1 (white, black, green)     |
| artifacts    | Artifacts and artifact token makers                                                                                  | Artifact synergy, artifact count, affinity                                                                                            | 10,4 / 6,2 / 3,1                          |
| auras        | Equipment, Auras that help your side, and cards that find or act as them                                             | Aura and equipment synergy, heroic, exalted, equip and aura cost reducers, hexproof and double strike creatures                       | 8,4 / 5,2 / 3,1                           |
| flyers       | Evasive creatures (derived)                                                                                          | Lasting anthems and cards that reward flyers                                                                                          | 10,3 / 7,2 / 4,1                          |
| bigCreatures | Cheap mana sources (derived)                                                                                         | Big threats (derived)                                                                                                                 | 6,5 / 4,3 / 2,2                           |
| burn         | Burn that can hit a player                                                                                           | Spell-cast payoffs and prowess                                                                                                        | 10,2 / 7,1 / 4,1 (red, black)             |
| landfall     | Land fetching, extra land drops, land ramp                                                                           | Landfall cards                                                                                                                        | 6,5 / 4,3 / 2,2                           |
| mill         | Cards that mill the opponent                                                                                         | Cards that reward milling                                                                                                             | 12,1 / 8,1 / 5,1 (blue, black)            |
| enchantments | Enchantments                                                                                                         | Enchantment payoffs and engines                                                                                                       | 10,3 / 6,2 / 3,1                          |
| tappers      | Creatures and spells that tap or freeze creatures                                                                    | Cards that punish or reward tapped creatures                                                                                          | 6,2 / 4,1 / 2,1                           |
| groupHug     | Cards that give every player cards or mana                                                                           | Cards that profit when opponents draw                                                                                                 | 6,2 / 4,1 / 2,1                           |
| goad         | Goad and other forced attacks                                                                                        | Goad payoffs, cards that care about attacking opponents                                                                               | 6,3 / 4,2 / 2,1                           |
| energy       | Cards that give you energy                                                                                           | Cards that spend energy                                                                                                               | 8,5 / 5,3 / 3,2                           |

Every theme card counts toward viability. Theme cards with a card strength of at least 3 (see [Card strength](card-strength.md)) count toward the scan margin that ranks themes, and the theme pass fills its minimums from them first, using weaker theme cards only when it runs out. Ramp uses the two-peaked ramp curve.

The reference corpus (`npm run corpus:learn`, section 3) found the last four in several Commander precons each: tappers (Hylda of the Icy Crown), group hug (Ms. Bumbleflower, Kynaios and Tiro), goad (Firkraag, Nelly Borca), and energy (Satya, Saheeli). Their minimums let those decks meet them. Only Tappers has a synergy rule: every rule counts in every deck's score, and the group hug, goad, and energy rules changed the best-fit style of more than half the 40-card draft decks with no gain in style match, so those three wait for a deck score that counts the chosen plan's own pairs. Discard and madness, group slug, casting from exile, and landfall payoffs that count lands were tried and left out: discard and the land counters pulled decks off their plan, and too few precons meet the other two.

With the learned plans (`config/learned/`), a theme fills toward the median of its real decks, not only to the minimum, and best fit only picks a theme on its own when the pool holds at least what the lower quarter of those decks do. A style the player picks keeps the hand-set minimums, so the Build page offers as many styles as before. The reference measures (`corpus:eval`) also keep the hand-set minimums, so their yardstick does not move with the builder.

Three styles were tightened against what their real decks play, since random bulk met them too easily:

- Graveyard counted every looter and discard outlet, which any blue or red deck holds. A looter now counts only when it also cares about the graveyard (flashback, reanimation, graveyard counts).
- Goad counted combat manipulation as a payoff, which is mostly the goad cards themselves, so one card filled both halves.
- Group hug counted every card that rewards drawing, your own draws included. Its payoffs are now cards that profit when opponents draw.

Notes from the tag scan:

- One-shot token makers like Raise the Alarm carry `multiple-bodies`, not a token tag, so both are enablers.
- Tagger has no tag for "whenever a creature you control dies" alone. The aristocrats payoff uses `death-trigger` minus `death-trigger-self`, plus `blood-artist-ability`, which catches Zulaport Cutthroat even though it also triggers on itself.
- Prowess creatures are found by keyword because the tag for it covers only a handful of cards.
- Auras and equipment have no reliable tag, so the enabler is the type line. Auras that pacify, lock down, exile, steal, shrink, or tax an opposing creature (`pacifism`, `lockdown-creature`, `banish`, `control-changing-effects`, `removal-toughness`, `ransom`) are removal, not Voltron; that also drops Cartouche of Ambition, a friendly aura with a shrinking trigger. Curses enchant a player, so the Aura clause leaves out type lines with Curse (`excludeTypeLine`), and the tutor clause leaves out cards that fetch a Curse (`tutor-aura-curse`). Type line words read the front face only, so a friendly Aura with a Curse back face (Radiant Grace) stays in and a creature with an Aura back face does not count. Nine Auras enchant a player without the Curse subtype (Archnemesis, Paradox Haze, and others) and still count; no tag marks them. Enchantment-matters payoffs belong to Enchantments, not Voltron.
- Evasion payoffs leave out combat tricks that grant flying and one-turn team pumps: those help any creature deck and made Evasion look deep in every white pool.

## Secondary styles

A deck can add a secondary style to its primary one. The primary style still sets the theme and, for a themed primary, the shape; the secondary adds to it:

- **A second theme** needs half its usual minimums (`builderWeights.secondary.minimumShare`). Its cards fill after the primary theme's, count half as much toward theme hits (`themeHitShare`), and the swaps may not take it below those minimums.
- **A shape** (aggro, midrange, control) can follow a themed primary where the shape itself is viable. Its curve, type mix, and role targets go over the primary's (20-card packets keep the packet curve), so "Tokens with Aggro" is a low, creature-heavy tokens deck. Two shapes do not combine.
- **A tribe** is a creature type with at least 14, 8, 5, or 3 members (100, 60, 40, 20 cards, changelings counting for every type) and 2, 2, 1, or 1 cards that reward the type (Tagger `typal-<type>` tags). A type with no such cards is not offered. Bulk holds plenty of bodies of the common types but few cards that reward them, so a tribe works best layered on a real theme. The exception is a Commander deck whose commander names the tribe: there the tribe can be the primary style (see [Commander](commander.md)).

The scan lists secondary choices for each primary, with near misses that show what is missing. A deck that could not reach its secondary minimums says so in its notes, and on the Build page the option is marked.

## Synergy rules

`synergy-rules.json` turns the same enabler and payoff pairs into weights the objective uses when counting how many enabler-payoff pairs a deck holds, plus a few cross-theme pairs: tokens feed sacrifice outlets (0.7), hexproof creatures like auras (0.6), haste granters like finishers (0.3). Weights above one are reserved for pairs that should dominate; none do today.

## Theme rules for requested styles

A style the player asks for at 60, 100, or 40 cards is built by the seed-and-grow builder (SPEC "Requested styles"), which reads `config/theme-rules.json` instead of the matchers above. The rules came out of the builder review's theme guide (`docs/review/themes.md`, the reasoning per style in `docs/review/theme-rules.md`) and differ from the matchers in three ways: a card counts once, as setup or as payoff, never both; a rider counts as nothing (surveil 1 on a removal spell is not Graveyard setup, a Food on a burn spell is not Lifegain setup); and setup is weighted, repeatable setup about twice a one-shot, with floors per size in those units. Each style also carries `kin` (the styles that share its resource, which the builder falls back to when the pool cannot support it), `setupNeedsPayoff` (Mill, Group hug, Energy: setup that does nothing without its payoffs, kept out of other themes' decks), and `lacks` (the plain phrases the apps show for a missed floor). Edit the file, then run `npm run config:check` and `npm run theme:bulk`. The matchers in `archetypes.json` still drive the scan's old viability, best fit, secondary styles, tribes, and the Analyze pane until builder phase 3 (`docs/review/report.md`).

## Roles

See [Deck shapes](deck-shapes.md) for quotas. Definitions worth knowing:

- Removal is anything tagged as answering a creature or planeswalker, minus sweepers: destroy, exile, burn, pacify, bounce. Artifact, enchantment, and land destruction do not count.
- Cheap interaction is instants or cheap noncreature spells at two mana or less that trick, protect, counter, freeze, bounce, or remove.
- Big threat (role id `finisher`) is derived: power four or more at cost four or more, an evasive power three at cost four or more, or a planeswalker costing four or more. The Ramp style's payoffs use it too.
- Finisher (role id `commanderFinisher`, the 100-card template only) is an overrun, an extra combat, or another way to win by tag, or derived: a planeswalker costing five or more, power seven or more, an evasive or trampling five or more, or an evasive double striker with three or more.
- Ramp is derived: a nonland mana dork, mana rock, or land fetcher costing three or less. The same test feeds the land formula.
