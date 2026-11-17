# Card needs: coverage over the pack

Written by `npm run needs:report` (packages/pipeline/src/needs-report.ts). Pack 2026-11-03, 34168 cards; config t5.c4.r2.a10.s8.l4.w12.k2.h5.n3.qdi9pv.p1wyug0e.g1hono2u. The full unparsed work list is in `data/review/needs/unparsed.md` (not committed).

## Abilities

| Cards                              | Abilities | Parsed cleanly | Share | No game-state fallback | Share |
| ---------------------------------- | --------- | -------------- | ----- | ---------------------- | ----- |
| Whole pack                         | 64396     | 62601          | 97.2% | 61331                  | 95.2% |
| Without Un-sets                    | 61827     | 60280          | 97.5% | 59192                  | 95.7% |
| Commons and uncommons (no Un-sets) | 35734     | 35221          | 98.6% | 34758                  | 97.3% |

Parsed cleanly: every part of the ability was read, by a template or by the game-state fallback. No game-state fallback: every part was read by a template that names what it reads.

1696 cards have an unparsed ability. Why abilities were left unparsed (the first reason in each):

| Reason                  | Abilities |
| ----------------------- | --------- |
| condition               | 433       |
| unread type             | 349       |
| unread card type        | 262       |
| trigger                 | 226       |
| unread counters         | 157       |
| unread graveyard        | 90        |
| cost                    | 58        |
| unread tokens           | 53        |
| unread commander        | 32        |
| unread number of        | 27        |
| unread life             | 20        |
| unread instead          | 19        |
| unread sacrifice        | 19        |
| unread energy           | 12        |
| unread discard          | 12        |
| unread devotion         | 9         |
| unread qualifier kicked | 9         |
| unread power            | 8         |

1392 conditions, trigger events, and cost parts no template reads name no resource word or type, so the reader takes them as game state (`resourceWords` in config/card-needs.json). The most common:

| Read as game state                                                         | Cards | Commons and uncommons |
| -------------------------------------------------------------------------- | ----- | --------------------- |
| `condition: if: you would draw a card`                                     | 18    | 0                     |
| `condition: if: a creature dealt damage this way would die this turn`      | 14    | 8                     |
| `condition: if: a creature an opponent controls would die`                 | 10    | 1                     |
| `condition: unless: their controller pays {M} for each of those creatures` | 9     | 5                     |
| `condition: if: ~ would enter`                                             | 9     | 0                     |
| `condition: if you don't put the card into your hand`                      | 8     | 6                     |
| `trigger: a player taps a land for mana`                                   | 8     | 1                     |
| `trigger: a player cycles a card`                                          | 7     | 7                     |

Top unparsed shapes (names, numbers, types, and mana symbols normalized):

| Shape                                                                           | Cards | Commons and uncommons | Examples                                                                               |
| ------------------------------------------------------------------------------- | ----- | --------------------- | -------------------------------------------------------------------------------------- |
| `trigger: a source you control deals noncombat damage to an opponent`           | 7     | 3                     | Asgardian Inspiration; Chandra's Incinerator; Chandra's Pyreling                       |
| `unread type: … TYPE ….`                                                        | 7     | 1                     | Earl of Squirrel; Hivestone; Rin and Seri, Inseparabler                                |
| `unread graveyard: Once during … … from your graveyard.`                        | 7     | 0                     | Danitha, New Benalia's Light; Edgar, Master Machinist; Gisa and Geralf                 |
| `unread type: it assembles a TYPE.`                                             | 6     | 6                     | Garbage Elemental; Joyride Rigger; Overt Operative                                     |
| `trigger: a time counter is removed from ~ while it's exiled`                   | 6     | 0                     | Aeon Chronicler; Benalish Commander; Detritivore                                       |
| `trigger: enchanted TYPE is put into a graveyard`                               | 5     | 5                     | Genju of the Cedars; Genju of the Falls; Genju of the Fens                             |
| `trigger: the fourth plan counter is put on ~`                                  | 5     | 5                     | Claim the Kingdom; Death to Our Enemies; Political Triumph                             |
| `unread card type: Commander enchantment`                                       | 5     | 5                     | Taught by Bruce Tarl; Taught by Narset; Taught by Serra                                |
| `unread commander: Spell commander`                                             | 5     | 5                     | Clear, the Mind; Gather, the Townsfolk; Lava, Axe                                      |
| `condition: if a spell or ability an opponent controls causes you to discard ~` | 5     | 2                     | Dodecapod; Loxodon Smiter; Nullhide Ferox                                              |
| `unread type: Return … TYPE you control to their owner's hand.`                 | 4     | 4                     | Barrel Down Sokenzan; Charge Across the Araba; Plow Through Reito                      |
| `condition: if a card left your graveyard this turn`                            | 4     | 2                     | Gau, Feral Youth; Living History; Primary Research                                     |
| `unread type: ~ …, TYPE, TYPE, and TYPE.`                                       | 4     | 2                     | Burakos, Party Leader; Stonework Packbeast; Tajuru Paragon                             |
| `unread graveyard: Cards in graveyards can't be the ….`                         | 4     | 1                     | Dennick, Pious Apprentice // Dennick, Pious Apparition; Ground Seal; Silent Gravestone |
| `unread tokens: …, … … plus an additional TYPE token.`                          | 4     | 1                     | Jolene, the Plunder Queen; Tippy-Toe, Terrific Partner; Worldwalker Helm               |

## Cards

The most severe kind among a card's abilities (an unparsed ability counts as a need). 3079 cards supply some need of their own.

| Cards | need | bonus | drawback | unconditional |
| ----- | ---- | ----- | -------- | ------------- |
| 34168 | 9278 | 765   | 219      | 23906         |

Resource references by family and kind (an alternative counts once per resource):

| Family                    | Refs | need | bonus | drawback |
| ------------------------- | ---- | ---- | ----- | -------- |
| tribe                     | 2634 | 2374 | 206   | 54       |
| type                      | 1664 | 1447 | 180   | 37       |
| counters                  | 1274 | 1212 | 51    | 11       |
| subtype                   | 802  | 713  | 80    | 9        |
| land                      | 786  | 562  | 111   | 113      |
| graveyard:creature        | 727  | 692  | 35    | 0        |
| graveyard:any             | 686  | 546  | 124   | 16       |
| colored                   | 463  | 425  | 37    | 1        |
| spells                    | 372  | 363  | 9     | 0        |
| cast:noncreature          | 222  | 212  | 9     | 1        |
| lifegain                  | 219  | 200  | 18    | 1        |
| graveyard:instant-sorcery | 207  | 182  | 25    | 0        |
| tokens                    | 205  | 201  | 4     | 0        |
| cast:tribe                | 196  | 196  | 0     | 0        |
| death                     | 164  | 164  | 0     | 0        |
| commander                 | 163  | 136  | 27    | 0        |
| discard                   | 146  | 82   | 64    | 0        |
| cast:subtype              | 133  | 106  | 27    | 0        |
| power                     | 130  | 113  | 12    | 5        |
| keyword                   | 123  | 114  | 9     | 0        |
| energy                    | 118  | 113  | 0     | 5        |
| graveyard:artifact        | 114  | 110  | 4     | 0        |
| graveyard:tribe           | 113  | 107  | 6     | 0        |
| graveyard:land            | 110  | 98   | 12    | 0        |
| cast:artifact             | 85   | 85   | 0     | 0        |
| graveyard:subtype         | 74   | 68   | 4     | 2        |
| sacrifice                 | 64   | 63   | 1     | 0        |
| devotion                  | 57   | 30   | 5     | 22       |
| graveyard:enchantment     | 54   | 53   | 1     | 0        |
| creatures                 | 44   | 39   | 3     | 2        |
| cast:mv                   | 43   | 43   | 0     | 0        |
| cast:enchantment          | 29   | 28   | 1     | 0        |
| action                    | 29   | 29   | 0     | 0        |
| cast:historic             | 26   | 26   | 0     | 0        |
| domain                    | 26   | 23   | 3     | 0        |
| graveyard:colored         | 20   | 20   | 0     | 0        |
| experience                | 17   | 14   | 3     | 0        |
| cast:legendary            | 17   | 17   | 0     | 0        |
| lifeloss                  | 17   | 16   | 1     | 0        |
| graveyard:planeswalker    | 15   | 14   | 1     | 0        |
| graveyard:legendary       | 14   | 14   | 0     | 0        |
| cast:kicked               | 12   | 12   | 0     | 0        |
| format                    | 10   | 0    | 0     | 10       |
| graveyard:historic        | 8    | 6    | 1     | 1        |
| cast:planeswalker         | 8    | 7    | 1     | 0        |
| cast:land                 | 8    | 7    | 1     | 0        |
| cast:commander            | 6    | 6    | 0     | 0        |
| exile                     | 5    | 5    | 0     | 0        |
| cast:counters             | 4    | 4    | 0     | 0        |
| cast:keyword              | 3    | 3    | 0     | 0        |
| graveyard:battle          | 3    | 3    | 0     | 0        |
| cast:power                | 3    | 3    | 0     | 0        |
| graveyard:snow            | 2    | 2    | 0     | 0        |
| color                     | 1    | 1    | 0     | 0        |
| graveyard:keyword         | 1    | 1    | 0     | 0        |
| cast:snow                 | 1    | 1    | 0     | 0        |
| cast:experience           | 1    | 1    | 0     | 0        |

## Credits

Role credits (cards the roles.json matchers give the role, Un-sets left out) by the kind of the clause that earns them; untied means no clause matched the role pattern, so the credit depends on every need the card has:

| Role              | Cards | need | bonus | drawback | unconditional | untied |
| ----------------- | ----- | ---- | ----- | -------- | ------------- | ------ |
| removal           | 4706  | 468  | 20    | 2        | 3769          | 447    |
| sweeper           | 839   | 68   | 4     | 0        | 680           | 87     |
| cardAdvantage     | 4962  | 907  | 2     | 0        | 3892          | 161    |
| cheapInteraction  | 2365  | 106  | 8     | 1        | 2041          | 209    |
| finisher          | 5036  | 0    | 0     | 0        | 5036          | 0      |
| commanderFinisher | 1574  | 0    | 0     | 0        | 1574          | 0      |
| ramp              | 813   | 88   | 0     | 0        | 649           | 76     |
| earlyCreature     | 4864  | 0    | 0     | 0        | 4864          | 0      |
| evasiveThreat     | 3839  | 51   | 0     | 0        | 3781          | 7      |

Theme credits (the theme rules at 60 cards, each card once per style):

| Credit              | Cards | need | bonus | drawback | unconditional | untied |
| ------------------- | ----- | ---- | ----- | -------- | ------------- | ------ |
| aristocrats:payoff  | 359   | 147  | 0     | 0        | 187           | 25     |
| aristocrats:setup   | 2682  | 529  | 14    | 1        | 2138          | 0      |
| artifacts:payoff    | 453   | 310  | 77    | 1        | 42            | 23     |
| artifacts:setup     | 4440  | 125  | 4     | 0        | 4308          | 3      |
| auras:payoff        | 1612  | 63   | 12    | 0        | 1534          | 3      |
| auras:setup         | 1165  | 71   | 4     | 0        | 1090          | 0      |
| bigCreatures:payoff | 2917  | 68   | 3     | 0        | 2846          | 0      |
| bigCreatures:setup  | 1542  | 183  | 1     | 0        | 1123          | 235    |
| burn:payoff         | 269   | 173  | 3     | 0        | 92            | 1      |
| burn:setup          | 747   | 70   | 6     | 0        | 671           | 0      |
| counters:payoff     | 250   | 202  | 7     | 0        | 24            | 17     |
| counters:setup      | 2339  | 513  | 22    | 0        | 1714          | 90     |
| enchantments:payoff | 128   | 109  | 6     | 0        | 1             | 12     |
| enchantments:setup  | 3679  | 4    | 0     | 0        | 3675          | 0      |
| energy:payoff       | 112   | 66   | 0     | 0        | 46            | 0      |
| energy:setup        | 31    | 5    | 0     | 0        | 26            | 0      |
| flyers:payoff       | 150   | 32   | 1     | 0        | 117           | 0      |
| flyers:setup        | 3959  | 61   | 1     | 0        | 3897          | 0      |
| goad:payoff         | 11    | 0    | 0     | 0        | 11            | 0      |
| goad:setup          | 147   | 15   | 0     | 1        | 131           | 0      |
| graveyard:payoff    | 2082  | 1044 | 74    | 13       | 625           | 326    |
| graveyard:setup     | 2083  | 196  | 2     | 5        | 1750          | 130    |
| groupHug:payoff     | 65    | 1    | 0     | 0        | 64            | 0      |
| groupHug:setup      | 287   | 19   | 1     | 0        | 267           | 0      |
| landfall:payoff     | 209   | 19   | 0     | 0        | 190           | 0      |
| landfall:setup      | 504   | 92   | 1     | 0        | 343           | 68     |
| lifegain:payoff     | 195   | 178  | 5     | 0        | 12            | 0      |
| lifegain:setup      | 1980  | 401  | 3     | 0        | 1571          | 5      |
| mill:payoff         | 65    | 12   | 0     | 0        | 53            | 0      |
| mill:setup          | 243   | 35   | 0     | 0        | 208           | 0      |
| spells:payoff       | 462   | 346  | 3     | 0        | 108           | 5      |
| spells:setup        | 7438  | 64   | 0     | 0        | 7369          | 5      |
| tappers:payoff      | 70    | 1    | 1     | 0        | 68            | 0      |
| tappers:setup       | 444   | 6    | 0     | 0        | 225           | 213    |
| tokens:payoff       | 768   | 63   | 10    | 0        | 685           | 10     |
| tokens:setup        | 1629  | 404  | 13    | 1        | 1211          | 0      |

## Tag cross-check

- 6207 cards carry a dependency tag (`lifegain-matters`, `counters-matter`, `typal-*`, `synergy-*`, `*-matter(s)`) but the reader finds no reference at all: `synergy-*` 2348, `*-matter(s)` 4065, `typal-*` 455, `lifegain-matters` 30, `counters-matter` 159.
- 997 cards have a need the reader finds (not self-supplied) and carry no such tag; by family: graveyard:creature 283, type 139, graveyard:any 120, land 98, death 69, counters 44, graveyard:artifact 41, graveyard:instant-sorcery 41, subtype 33, graveyard:land 32, spells 27, graveyard:enchantment 26.

Top tags on cards the reader calls unconditional:

| Tag                    | Cards | Commons and uncommons | Examples                                                                                       |
| ---------------------- | ----- | --------------------- | ---------------------------------------------------------------------------------------------- |
| power-matters          | 939   | 529                   | Abyssal Hunter; Access Tunnel; Adaptive Snapjaw                                                |
| attacking-matters      | 758   | 431                   | Accorder Paladin; Adeline, Resplendent Cathar; Admiral's Order                                 |
| mana-value-matters     | 449   | 187                   | Aang, at the Crossroads // Aang, Destined Savior; Abundant Maw; Accelerated Mutation           |
| typal-creature         | 347   | 207                   | Accursed Duneyard; Adaptive Automaton; Aether Shockwave                                        |
| lands-matter           | 303   | 167                   | Admonition Angel; Adventuring Gear; Aesi, Tyrant of Gyre Strait                                |
| name-matters           | 285   | 122                   | 1996 World Champion; Academic Probation; Accumulated Knowledge                                 |
| hand-size-matters      | 236   | 94                    | Adamaro, First to Desire; Akki Underling; Alrund, God of the Cosmos // Hakka, Whispering Raven |
| creature-count-matters | 208   | 107                   | Adeline, Resplendent Cathar; Advice from the Fae; Ajani, Wise Counselor                        |
| synergy-artifact       | 195   | 127                   | A Realm Reborn; Aang and Katara; Aang's Iceberg                                                |
| synergy-blocker-self   | 174   | 137                   | Abomination; Abu Ja'far; Aether Membrane                                                       |

Top needs on cards with no dependency tag:

| First need                           | Cards | Commons and uncommons | Examples                                                                   |
| ------------------------------------ | ----- | --------------------- | -------------------------------------------------------------------------- |
| selection: graveyard:creature        | 227   | 145                   | Adun Oakenshield; Aid the Fallen; Altar of Bhaal // Bone Offering          |
| selection: graveyard:any             | 84    | 51                    | Aegis Sculptor; Aether Helix; Auroral Procession                           |
| trigger: death                       | 69    | 29                    | Abzan Ascendancy; Agent Venom; Anafenza, Unyielding Lineage                |
| selection: graveyard:instant-sorcery | 39    | 35                    | Anarchist; Archaeomancer; Ardent Dustspeaker                               |
| selection: type:artifact             | 34    | 24                    | Animating Faerie // Bring to Life; Arms Race; Ashe, Princess of Dalmasca   |
| selection: counters:any              | 30    | 27                    | Adaptive Sporesinger; Atomize; Blightbelly Rat                             |
| selection: graveyard:land            | 28    | 8                     | Altanak, the Thrice-Called; Carnivorous Cultivator // Enroot; Cartographer |
| cost: graveyard:creature             | 26    | 14                    | Ashnod, Flesh Mechanist; Back from the Brink; Balduvian Dead               |
| cost: type:snow                      | 25    | 21                    | Adarkar Windform; Ascendant Spirit; Boreal Centaur                         |
| selection: graveyard:artifact        | 24    | 19                    | Archaeomender; Argivian Restoration; Bringer of the White Dawn             |

## Lands that enter tapped

Lands the pack marks `entersTapped` (Un-sets left out): how `landEntry` in lands.ts reads them in a deck of the land's own colors (conditional when its chance to enter tapped is below 1 at 60 or 100 cards) against how the reader reads the tapped line.

| landEntry     | Reader                        | Lands |
| ------------- | ----------------------------- | ----- |
| always tapped | a condition naming a resource | 33    |
| always tapped | a condition on game state     | 10    |
| always tapped | always tapped                 | 491   |
| conditional   | a condition naming a resource | 67    |
| conditional   | a condition on game state     | 68    |

## Speed

Reading: 261 ms per 1,000 cards (8.9 s for the pack, fresh cache). Credits: 74514 role and theme credits in 7.1 s.
