# Card needs: coverage over the pack

Written by `npm run needs:report` (packages/pipeline/src/needs-report.ts). Pack 2026-11-03, 34168 cards; config t5.c4.r2.a10.s8.l4.w12.k2.h4.n1.q1lddk1e.p1wyug0e.g1hono2u. The full unparsed work list is in `data/review/needs/unparsed.md` (not committed).

## Abilities

| Cards                              | Abilities | Parsed cleanly | Share |
| ---------------------------------- | --------- | -------------- | ----- |
| Whole pack                         | 64396     | 62625          | 97.2% |
| Without Un-sets                    | 61827     | 60291          | 97.5% |
| Commons and uncommons (no Un-sets) | 35734     | 35207          | 98.5% |

1670 cards have an unparsed ability. Why abilities were left unparsed (the first reason in each):

| Reason           | Abilities |
| ---------------- | --------- |
| unread type      | 385       |
| condition        | 346       |
| unread card type | 277       |
| trigger          | 199       |
| unread counters  | 159       |
| unread graveyard | 91        |
| cost             | 68        |
| unread tokens    | 56        |
| unread sacrifice | 39        |
| unread commander | 31        |
| unread number of | 29        |
| unread instead   | 23        |
| unread life      | 21        |
| unread energy    | 18        |
| unread discard   | 12        |
| unread devotion  | 9         |
| unread power     | 8         |

655 conditions, trigger events, and cost parts no template reads name no resource word or type, so the reader takes them as game state (`resourceWords` in config/card-needs.json). The most common:

| Read as game state                                                        | Cards | Commons and uncommons |
| ------------------------------------------------------------------------- | ----- | --------------------- |
| `cost: exile it`                                                          | 7     | 0                     |
| `condition: if its mana value was N or less`                              | 6     | 6                     |
| `condition: if you have the initiative`                                   | 6     | 5                     |
| `condition: if you roll a N`                                              | 6     | 3                     |
| `condition: if you have fewer than N cards in hand`                       | 6     | 0                     |
| `condition: if a permanent you controlled left the battlefield this turn` | 5     | 5                     |
| `condition: if a creature card was exiled this way`                       | 5     | 4                     |
| `condition: if no N does`                                                 | 5     | 4                     |

Top unparsed shapes (names, numbers, types, and mana symbols normalized):

| Shape                                                                           | Cards | Commons and uncommons | Examples                                                               |
| ------------------------------------------------------------------------------- | ----- | --------------------- | ---------------------------------------------------------------------- |
| `unread type: … TYPE ….`                                                        | 7     | 1                     | Earl of Squirrel; Hivestone; Rin and Seri, Inseparabler                |
| `unread graveyard: Once during … … from your graveyard.`                        | 7     | 0                     | Danitha, New Benalia's Light; Edgar, Master Machinist; Gisa and Geralf |
| `unread type: it assembles a TYPE.`                                             | 6     | 6                     | Garbage Elemental; Joyride Rigger; Overt Operative                     |
| `trigger: a time counter is removed from ~ while it's exiled`                   | 6     | 0                     | Aeon Chronicler; Benalish Commander; Detritivore                       |
| `trigger: enchanted TYPE is put into a graveyard`                               | 5     | 5                     | Genju of the Cedars; Genju of the Falls; Genju of the Fens             |
| `trigger: the fourth plan counter is put on ~`                                  | 5     | 5                     | Claim the Kingdom; Death to Our Enemies; Political Triumph             |
| `unread card type: Commander enchantment`                                       | 5     | 5                     | Taught by Bruce Tarl; Taught by Narset; Taught by Serra                |
| `unread commander: Spell commander`                                             | 5     | 5                     | Clear, the Mind; Gather, the Townsfolk; Lava, Axe                      |
| `condition: if a spell or ability an opponent controls causes you to discard ~` | 5     | 2                     | Dodecapod; Loxodon Smiter; Nullhide Ferox                              |
| `condition: if a TYPE was beheld`                                               | 4     | 4                     | Dispelling Exhale; Hyperion's Atomic Vision; Osseous Exhale            |
| `unread type: Return … TYPE you control to their owner's hand.`                 | 4     | 4                     | Barrel Down Sokenzan; Charge Across the Araba; Plow Through Reito      |
| `unread instead: Excess damage … to … instead.`                                 | 4     | 3                     | Flame Spill; Gandalf's Sanction; Pigment Storm                         |
| `condition: if a card left your graveyard this turn`                            | 4     | 2                     | Gau, Feral Youth; Living History; Primary Research                     |
| `condition: if a land card was milled this way`                                 | 4     | 2                     | Loafing Giant; Locke, Treasure Hunter; Lorehold Excavation             |
| `unread card type: … and sorcery spells.`                                       | 4     | 2                     | Abstract Paintmage; Daxiver, Izzet Electromancer; Resonating Lute      |

## Cards

The most severe kind among a card's abilities (an unparsed ability counts as a need). 2914 cards supply some need of their own.

| Cards | need | bonus | drawback | unconditional |
| ----- | ---- | ----- | -------- | ------------- |
| 34168 | 9463 | 642   | 224      | 23839         |

Resource references by family and kind (an alternative counts once per resource):

| Family                    | Refs | need | bonus | drawback |
| ------------------------- | ---- | ---- | ----- | -------- |
| tribe                     | 2524 | 2314 | 158   | 52       |
| type                      | 1669 | 1456 | 172   | 41       |
| counters                  | 1127 | 1091 | 29    | 7        |
| color                     | 867  | 867  | 0     | 0        |
| subtype                   | 818  | 741  | 66    | 11       |
| land                      | 778  | 577  | 87    | 114      |
| graveyard:any             | 704  | 556  | 128   | 20       |
| graveyard:creature        | 676  | 655  | 21    | 0        |
| spells                    | 352  | 318  | 33    | 1        |
| tokens                    | 261  | 257  | 4     | 0        |
| lifegain                  | 219  | 204  | 14    | 1        |
| cast:noncreature          | 207  | 200  | 5     | 2        |
| graveyard:instant-sorcery | 204  | 173  | 31    | 0        |
| cast:tribe                | 185  | 180  | 5     | 0        |
| discard                   | 144  | 80   | 64    | 0        |
| commander                 | 139  | 113  | 26    | 0        |
| power                     | 133  | 115  | 13    | 5        |
| cast:subtype              | 132  | 103  | 29    | 0        |
| keyword                   | 128  | 121  | 7     | 0        |
| energy                    | 116  | 111  | 0     | 5        |
| creatures                 | 116  | 102  | 11    | 3        |
| graveyard:artifact        | 113  | 110  | 3     | 0        |
| graveyard:tribe           | 109  | 108  | 1     | 0        |
| graveyard:land            | 98   | 90   | 8     | 0        |
| cast:artifact             | 81   | 80   | 1     | 0        |
| graveyard:subtype         | 73   | 68   | 3     | 2        |
| devotion                  | 54   | 29   | 3     | 22       |
| graveyard:enchantment     | 54   | 53   | 1     | 0        |
| cast:enchantment          | 28   | 28   | 0     | 0        |
| cast:historic             | 26   | 26   | 0     | 0        |
| lifeloss                  | 20   | 20   | 0     | 0        |
| cast:legendary            | 17   | 16   | 1     | 0        |
| graveyard:planeswalker    | 16   | 14   | 2     | 0        |
| graveyard:legendary       | 14   | 14   | 0     | 0        |
| cast:planeswalker         | 11   | 11   | 0     | 0        |
| format                    | 10   | 0    | 0     | 10       |
| graveyard:historic        | 8    | 6    | 1     | 1        |
| cast:land                 | 8    | 7    | 1     | 0        |
| cast:commander            | 6    | 6    | 0     | 0        |
| graveyard:battle          | 3    | 3    | 0     | 0        |
| cast:power                | 3    | 3    | 0     | 0        |
| cast:keyword              | 2    | 2    | 0     | 0        |
| cast:counters             | 2    | 2    | 0     | 0        |
| graveyard:snow            | 2    | 2    | 0     | 0        |
| sacrifice                 | 2    | 2    | 0     | 0        |
| graveyard:keyword         | 1    | 1    | 0     | 0        |
| cast:snow                 | 1    | 1    | 0     | 0        |
| death                     | 1    | 1    | 0     | 0        |

## Credits

Role credits (cards the roles.json matchers give the role, Un-sets left out) by the kind of the clause that earns them; untied means no clause matched the role pattern, so the credit depends on every need the card has:

| Role              | Cards | need | bonus | drawback | unconditional | untied |
| ----------------- | ----- | ---- | ----- | -------- | ------------- | ------ |
| removal           | 4706  | 510  | 2     | 2        | 3742          | 450    |
| sweeper           | 839   | 71   | 1     | 0        | 680           | 87     |
| cardAdvantage     | 4962  | 883  | 2     | 0        | 3916          | 161    |
| cheapInteraction  | 2365  | 132  | 2     | 1        | 2021          | 209    |
| finisher          | 5036  | 0    | 0     | 0        | 5036          | 0      |
| commanderFinisher | 1574  | 0    | 0     | 0        | 1574          | 0      |
| ramp              | 813   | 101  | 0     | 0        | 636           | 76     |
| earlyCreature     | 4864  | 0    | 0     | 0        | 4864          | 0      |
| evasiveThreat     | 3839  | 45   | 0     | 8        | 3779          | 7      |

Theme credits (the theme rules at 60 cards, each card once per style):

| Credit              | Cards | need | bonus | drawback | unconditional | untied |
| ------------------- | ----- | ---- | ----- | -------- | ------------- | ------ |
| aristocrats:payoff  | 359   | 37   | 0     | 0        | 297           | 25     |
| aristocrats:setup   | 2682  | 567  | 6     | 1        | 2108          | 0      |
| artifacts:payoff    | 453   | 299  | 87    | 1        | 43            | 23     |
| artifacts:setup     | 4440  | 125  | 0     | 0        | 4312          | 3      |
| auras:payoff        | 1612  | 56   | 12    | 7        | 1534          | 3      |
| auras:setup         | 1165  | 76   | 1     | 0        | 1088          | 0      |
| bigCreatures:payoff | 2917  | 74   | 3     | 0        | 2840          | 0      |
| bigCreatures:setup  | 1542  | 193  | 1     | 0        | 1113          | 235    |
| burn:payoff         | 269   | 167  | 0     | 0        | 101           | 1      |
| burn:setup          | 747   | 84   | 1     | 0        | 662           | 0      |
| counters:payoff     | 250   | 196  | 9     | 0        | 28            | 17     |
| counters:setup      | 2339  | 510  | 1     | 0        | 1738          | 90     |
| enchantments:payoff | 128   | 108  | 8     | 0        | 0             | 12     |
| enchantments:setup  | 3679  | 4    | 0     | 0        | 3675          | 0      |
| energy:payoff       | 112   | 67   | 0     | 0        | 45            | 0      |
| energy:setup        | 31    | 10   | 0     | 0        | 21            | 0      |
| flyers:payoff       | 87    | 35   | 1     | 0        | 51            | 0      |
| flyers:setup        | 3971  | 60   | 0     | 8        | 3903          | 0      |
| goad:payoff         | 11    | 0    | 0     | 0        | 11            | 0      |
| goad:setup          | 147   | 16   | 0     | 0        | 131           | 0      |
| graveyard:payoff    | 2082  | 1019 | 99    | 15       | 623           | 326    |
| graveyard:setup     | 2083  | 217  | 5     | 5        | 1726          | 130    |
| groupHug:payoff     | 65    | 0    | 0     | 0        | 65            | 0      |
| groupHug:setup      | 287   | 21   | 1     | 0        | 265           | 0      |
| landfall:payoff     | 209   | 21   | 0     | 0        | 188           | 0      |
| landfall:setup      | 504   | 98   | 1     | 0        | 337           | 68     |
| lifegain:payoff     | 195   | 172  | 12    | 0        | 11            | 0      |
| lifegain:setup      | 1980  | 377  | 1     | 0        | 1597          | 5      |
| mill:payoff         | 65    | 12   | 0     | 0        | 53            | 0      |
| mill:setup          | 243   | 33   | 1     | 0        | 209           | 0      |
| spells:payoff       | 462   | 349  | 1     | 0        | 107           | 5      |
| spells:setup        | 7438  | 62   | 2     | 0        | 7369          | 5      |
| tappers:payoff      | 70    | 3    | 0     | 0        | 67            | 0      |
| tappers:setup       | 444   | 12   | 0     | 0        | 219           | 213    |
| tokens:payoff       | 768   | 73   | 1     | 0        | 684           | 10     |
| tokens:setup        | 1629  | 414  | 5     | 1        | 1209          | 0      |

## Tag cross-check

- 6677 cards carry a dependency tag (`lifegain-matters`, `counters-matter`, `typal-*`, `synergy-*`, `*-matter(s)`) but the reader finds no reference at all: `synergy-*` 2739, `*-matter(s)` 4132, `typal-*` 511, `lifegain-matters` 29, `counters-matter` 220.
- 1239 cards have a need the reader finds (not self-supplied) and carry no such tag; by family: color 332, graveyard:creature 288, land 124, graveyard:any 117, type 113, graveyard:artifact 43, graveyard:instant-sorcery 43, graveyard:land 41, counters 39, subtype 31, graveyard:enchantment 26, spells 22.

Top tags on cards the reader calls unconditional:

| Tag                    | Cards | Commons and uncommons | Examples                                                                                       |
| ---------------------- | ----- | --------------------- | ---------------------------------------------------------------------------------------------- |
| power-matters          | 930   | 525                   | Abyssal Hunter; Access Tunnel; Adaptive Snapjaw                                                |
| attacking-matters      | 734   | 418                   | Accorder Paladin; Adeline, Resplendent Cathar; Admiral's Order                                 |
| mana-value-matters     | 474   | 202                   | Aang, at the Crossroads // Aang, Destined Savior; Abundant Maw; Accelerated Mutation           |
| typal-creature         | 394   | 240                   | Accursed Duneyard; Adaptive Automaton; Aether Shockwave                                        |
| lands-matter           | 312   | 169                   | Admonition Angel; Adventuring Gear; Aesi, Tyrant of Gyre Strait                                |
| name-matters           | 260   | 124                   | 1996 World Champion; Academic Probation; Accumulated Knowledge                                 |
| hand-size-matters      | 239   | 94                    | Adamaro, First to Desire; Akki Underling; Alrund, God of the Cosmos // Hakka, Whispering Raven |
| counters-matter        | 220   | 126                   | Afiya Grove; Ambitious Augmenter; Ammit Eternal                                                |
| creature-count-matters | 203   | 104                   | Adeline, Resplendent Cathar; Advice from the Fae; Ajani, Wise Counselor                        |
| synergy-artifact       | 199   | 128                   | A Realm Reborn; Aang and Katara; Aang's Iceberg                                                |

Top needs on cards with no dependency tag:

| First need                           | Cards | Commons and uncommons | Examples                                                                        |
| ------------------------------------ | ----- | --------------------- | ------------------------------------------------------------------------------- |
| selection: graveyard:creature        | 244   | 155                   | Adun Oakenshield; Aid the Fallen; Altar of Bhaal // Bone Offering               |
| selection: graveyard:any             | 89    | 56                    | Acolyte of Affliction; Aegis Sculptor; Aether Helix                             |
| cost: color:R                        | 66    | 58                    | Akroan Phalanx; Angelfire Crusader; Atarka Monument                             |
| cost: color:W                        | 65    | 54                    | Abzan Banner; Aegis Automaton; Auriok Replica                                   |
| cost: color:B                        | 63    | 58                    | Archers' Parapet; Armorer Guildmage; Augmenting Automaton                       |
| cost: color:U                        | 61    | 53                    | Aether Spellbomb; Agent of Horizons; Ana Disciple                               |
| cost: color:G                        | 53    | 50                    | Aerie Mystics; Bant Battlemage; Beast Walkers                                   |
| selection: graveyard:instant-sorcery | 41    | 36                    | Anarchist; Archaeomancer; Ardent Dustspeaker                                    |
| selection: type:artifact             | 41    | 30                    | Animating Faerie // Bring to Life; Arms Race; Ashe, Princess of Dalmasca        |
| selection: graveyard:land            | 37    | 16                    | Aftermath Analyst; Altanak, the Thrice-Called; Carnivorous Cultivator // Enroot |

## Lands that enter tapped

Lands the pack marks `entersTapped` (Un-sets left out): how `landEntry` in lands.ts reads them in a deck of the land's own colors (conditional when its chance to enter tapped is below 1 at 60 or 100 cards) against how the reader reads the tapped line.

| landEntry     | Reader                        | Lands |
| ------------- | ----------------------------- | ----- |
| always tapped | a condition naming a resource | 34    |
| always tapped | a condition on game state     | 10    |
| always tapped | always tapped                 | 491   |
| conditional   | a condition naming a resource | 66    |
| conditional   | a condition on game state     | 68    |

## Speed

Reading: 231 ms per 1,000 cards (7.9 s for the pack, fresh cache). Credits: 74463 role and theme credits in 6.3 s.
