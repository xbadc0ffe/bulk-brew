# Hand-built reference decks

Eight decks built by hand from public pools, as a careful player would build from a box of bulk. They are a reference for the blind panel and the report, not a candidate: the app has no agent and no network, so they cannot ship. They show what the same cards can give and which choices the algorithms miss.

Date: 2026-11-08. Data pack 2026-11-03.s2.

## Method

- **Pools and requests.** Public pools only, from `data/review/pools/public/` (the JSON forms of `eval/pools/*.txt`, so the deck files carry the same pool ids and hashes as every other version's). The eight requests were set by the review coordinator.
- **Reading the cards.** Each pool was printed with the card helper, `npm run -s review:cards -- --file eval/pools/<pool>.txt --json`, and filtered to the deck's colors by `data/review/scratch/hand/list.mjs` (gitignored). Choices rest on the oracle text only. The helper's roles, styles, and strength were not read while building; they were looked up afterwards, for the notes below, to see where the builders' view differs.
- **Sizing.** Themed decks follow the setup and payoff ranges in `docs/review/themes.md`, counting each card once at its job's weight. Plain decks follow the Aggro, Midrange, and Control tables there. Land counts follow the same tables: 22 to 24 at 60, 17 at 40, 8 at 20, 35 plus 15 mana sources at 100. Copy limits are 4 at 60 and 40, 2 at 20, and 1 at 100, within what the pool holds.
- **Files.** `node data/review/scratch/hand/write-decks.ts` turns the lists in `data/review/scratch/hand/specs.json` into `ReviewDeck` files in `data/review/decks/hand/`, named as the runner names them, with `version: 'hand'`, `request.seed: 0`, and `buildMs: 0`. It uses the runner's own `loadPool`, `resolveRequest`, and `deckFileName`, and stops on any card the pool does not hold in that number.
- **Checks.** `npm run -s review:check -- --decks data/review/decks/hand --out data/review/scratch/hand/checks --force`. The results went to scratch so the shared summary in `data/review/checks/` was not replaced. All eight decks are legal and raise no flag. The theme rules file does not exist yet, so the check gives no theme counts; the counts below are by hand, from the guide's weights.
- **Comparisons.** Where a note says what `head` or `head-web` built, it reads the stored deck for the same request in `data/review/decks/head/` or `head-web/` (seed 1). There is no stored `head` deck for `gold-heavy-black` WB 60 or for Lathril on `public-elf-tribe`; for Lathril the note uses `head/elf-tribe-BG-100-tribal-Elf-lathril-blade-of-the-elves-s1.json`, built from the same cards in `eval/pools/elf-tribe.txt`.

| Deck                                | File in `data/review/decks/hand/`                                       | Check                                               |
| ----------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| `bulk-blue` U 60, Graveyard         | `public-bulk-blue-U-60-graveyard-s0.json`                               | No flags. 23 lands plus a spell-land (formula 25).  |
| `bulk-black` B 60, best fit         | `public-bulk-black-B-60-bestfit-s0.json`                                | No flags. 24 lands (formula 26), castability 1.0.   |
| `bulk-green` G 60, best fit         | `public-bulk-green-G-60-bestfit-s0.json`                                | No flags. 22 lands plus 4 spell-lands (formula 21). |
| `white-bulk` W 60, Tokens           | `public-white-bulk-W-60-tokens-s0.json`                                 | No flags. 24 lands (formula 25).                    |
| `bulk-red` R 40, best fit           | `public-bulk-red-R-40-bestfit-s0.json`                                  | No flags. 17 lands (formula 17).                    |
| `gold-heavy-black` WB 60, best fit  | `public-gold-heavy-black-WB-60-bestfit-s0.json`                         | No flags. 23 lands (formula 24), castability 0.97.  |
| `elf-tribe` 100, Lathril, Elf tribe | `public-elf-tribe-BG-100-tribal-Elf-lathril-blade-of-the-elves-s0.json` | No flags. 35 lands (formula 37), castability 0.89.  |
| `bulk-blue` U 20, best fit          | `public-bulk-blue-U-20-bestfit-s0.json`                                 | No flags. 8 lands (formula 8).                      |

## 1. `bulk-blue` U 60, Graveyard

**Plan.** Fill the graveyard with Jace's self-mill, draw-and-discard spells, and a few tap-every-turn engines, then win with Conspiracy Unraveler, Makeshift Mauler, and Torrential Gearhulk, which feed on it, behind counterspells and flyers.

**List.** 37 spells, 23 Island.

- Setup: 3 Jace, the Perfected Mind; 3 Winternight Stories; 2 Fact or Fiction; 2 Riptide Survivor; 2 Stern Lesson; 1 Screeching Sliver; 1 Codex Shredder; 1 Trickster Mage.
- Payoffs: 2 Conspiracy Unraveler; 2 Torrential Gearhulk; 1 Makeshift Mauler; 3 Otterball Antics; 2 Constrictor Sage.
- Interaction: 3 Mana Drain; 2 Rangers of Ithilien; 1 Man-o'-War; 1 Sink into Stupor // Soporific Springs.
- Other creatures: 3 Geyser Drake; 1 Vexing Gull; 1 True-Name Nemesis.

**Counts by the guide.** Setup weight 17 in 15 copies: Jace 2 each (its minus two mills three and draws, and a planeswalker does it again a turn later; minus X mills three times X), Winternight Stories, Fact or Fiction, and Riptide Survivor 1 each, Stern Lesson 0.5, and the three tap engines 1 each. Six repeatable copies. Payoff weight 7.5 in 10 copies: Unraveler, Gearhulk, and Mauler 1 each, Otterball Antics and Constrictor Sage 0.5 each. About 2.3 setup per payoff, above the guide's 1.5.

**Notes.**

- The setup is separate cards. No payoff counts as setup, and nothing counts for a one-card rider.
- Discard targets are chosen: Otterball Antics (flashback), Winternight Stories (harmonize), and Constrictor Sage (renew) are good cards to loot away, and Gearhulk recasts Mana Drain or Fact or Fiction from the graveyard.
- Conspiracy Unraveler is a 7-drop. Its ability works only once it is on the battlefield, so two copies, not three; the second can then be cast by exiling graveyard cards.
- Left out: Ruin Crab and Sphinx's Tutelage (they mill the opponent, the wrong graveyard), Ephara's Dispersal (surveil 2 is a rider on a bounce spell), Microscope (surveil 1 a turn for two mana, and its second ability does nothing here), Teferi's Imp (loots every other turn on a 1/1), and the artifact cards (La Forge, Etherium Sculptor), which have no artifacts to help.

**Choices an algorithm may miss.**

- Jace, the Perfected Mind. Three copies, the best self-mill in the pool, and the live matchers do count it as an enabler (strength 7.17), yet `head` left all three out of its Blue Graveyard deck while playing Ruin Crab and Ephara's Dispersal.
- Trickster Mage as a discard outlet. Its text is "{U}, {T}, Discard a card: tap or untap target", which the live graveyard matchers do not count.
- True-Name Nemesis and Rangers of Ithilien. Protection from the opponent and stealing a creature meet no role in `config/roles.json`; their strengths (3.40 and 3.41) are under the pack median, so the check's dead-card proxy lists them. They are two of the best cards in the pool.

## 2. `bulk-black` B 60, best fit

**Plan.** Black Midrange: trade early with lifelink and deathtouch creatures, kill the opponent's threats with plenty of cheap removal, and win with Vampire flyers and Summon: Primal Odin.

**List.** 36 spells, 24 Swamp.

- Creatures: 3 Salt Vampire; 3 Skirsdag Flayer; 2 Vampire Interloper; 3 Vampire Nighthawk; 4 Graveyard Trespasser // Graveyard Glutton; 1 Manor Guardian; 1 Blade Juggler; 1 Phyrexian Obliterator; 3 Sengir Nosferatu; 2 Bloodlord of Vaasgoth; 2 Summon: Primal Odin.
- Removal: 3 Disfigure; 3 Reaver Ambush; 4 Grim Bounty.
- Card advantage: 1 Pact of the Serpent.

**Counts.** 25 creatures, 10 removal spells plus Skirsdag Flayer's repeatable kill and Odin's chapter I, 4 card advantage (Pact naming Vampire, with 13 Vampires; Blade Juggler; Odin's chapter III twice), and 8 cards at five or more. Curve 1 / 2 / 3 / 4 / 5+: 3 / 8 / 12 / 5 / 8.

**Notes.**

- Why Midrange. No theme in the pool has both halves. Aristocrats has outlets (Dockside Chef, Phyrexian Vault, Voracious Null) but its payoffs are 1/1s that grow (Mortician Beetle) or a level-up Class. Counters rests on Festercreep, a 0/0 with one counter. The pool's best cards are removal and efficient creatures, which is what Midrange wants.
- Vampires are a light second layer: Bloodlord of Vaasgoth gives each Vampire spell bloodthirst 3, and the flyers turn on bloodthirst.
- Left out: Day of Black Sun (kills our own board), Death's Shadow (a 13/13 that needs our life low), Pact of the Serpent beyond one copy, and the vanilla 2/2s.

**Choices an algorithm may miss.**

- Choosing the plain deck. `head` built +1/+1 counters around 4 Festercreep and 2 Cruel Sadist, and `head-web` built Graveyard with 2 Mephitic Vapors and 2 Hymn of the Faller. Neither plays Vampire Nighthawk, Disfigure, or Reaver Ambush, and `head` plays no Grim Bounty.
- Vampire Nighthawk and Grim Bounty in full numbers: a judge reads them as the deck's backbone.
- Skirsdag Flayer can sacrifice itself ("Sacrifice a Human"; it is a Human Cleric), so it is removal even with no other Human.

## 3. `bulk-green` G 60, best fit

**Plan.** Green Midrange: mana creatures into efficient big creatures (Steel Leaf Champion, Rushwood Elemental, Thornling, Tyrranax Atrocity), with fight spells and deathtouch blockers as removal and Nylea giving the team trample.

**List.** 38 spells, 22 Forest.

- Mana: 1 Mox Emerald; 1 Birds of Paradise; 2 Noxious Newt; 1 Paradise Druid.
- Early creatures: 1 Werewolf Pack Leader; 3 Attercop; 2 Blooming Stinger; 3 Jewel-Eyed Cobra; 2 Hooded Brawler.
- Threats: 3 Steel Leaf Champion; 3 Boon Satyr; 2 Nylea, God of the Hunt; 3 Rushwood Elemental; 2 Thornling; 2 Tyrranax Atrocity.
- Removal: 4 Bridgeworks Battle // Tanglespan Bridgeworks; 3 Wild Instincts.

**Counts.** 28 creatures plus Nylea, 7 fight spells, 10 deathtouch bodies, 5 mana sources besides lands. Curve 0-1 / 2 / 3 / 4 / 5: 2 / 9 / 15 / 5 / 7. The four Bridgeworks Battles are lands when needed, so the deck has 26 land cards in all.

**Notes.**

- Every fight spell has a big body to fight with, and the deathtouch creatures make fights and blocks one-sided.
- Nylea counts devotion: Rushwood Elemental alone gives five green pips, so she is usually a 6/6.
- Left out: the enchantment package (Nexus Wardens, Verduran Enchantress, Bonds of Mortality), Myojin of Towering Might (8 mana), the fog effects, and the narrow cards (Gaea's Avenger, Hum of the Radix).

**Choices an algorithm may miss.**

- Steel Leaf Champion: a 5/4 for three that small creatures cannot block. It meets no role and no style, so neither `head` (Enchantments) nor `head-web` (Aggro) plays it.
- Rushwood Elemental scores 2.68, with 0.8 taken off for its five green pips; in a one-color deck the pips cost nothing, and it grows every turn.
- Counting a spell-land as part land, part spell, so 22 Forests are enough.

## 4. `white-bulk` W 60, Tokens

**Plan.** Make a wide board of 1/1s with token engines and bursts, pump the team, and use removal that grows with the number of creatures.

**List.** 36 spells, 24 Plains.

- Setup, engines: 2 Dawn of Hope; 2 Retreat to Emeria; 2 Emeria Angel; 1 Clachan Festival.
- Setup, bursts: 3 Hop to It; 2 Gather the White Lotus; 2 Carrot Cake; 2 Honored Knight-Captain (one token, counted half).
- Payoffs: 1 Glorious Anthem; 1 Valor in Akros; 3 Warren Elder; 1 Rabbit Response; 1 Starry-Eyed Skyrider; 2 Mentor of the Meek.
- Removal: 4 Banishing Light; 3 Slash of Light; 2 Thraben Charm; 2 Shire Shirriff.

**Counts by the guide.** Setup 15 copies with the half rule, 7 of them engines (the guide asks 9 to 12, 4 engines). Payoffs: 9 copies of anthem, enters-trigger, team-pump, and draw payoffs, plus 7 removal spells that count creatures or eat a token. Curve 2 / 3 / 4 / 5: 16 / 12 / 6 / 2.

**Notes.**

- The engines need mana or land drops, so 24 lands; Dawn of Hope, Warren Elder, Clachan Festival, and Retreat to Emeria all use spare mana and land drops late.
- Rabbits tie it together: Hop to It and Carrot Cake make Rabbits, Warren Elder is one, and Rabbit Response scries with one.
- Left out: Dragonback Lancer and Dalkovan Packbeasts (their tokens are sacrificed at end of turn), Seasoned Warrenguard (wants only one token), Gwaihir (needs 3 life gained a turn), Fumigate and Phyrexian Rebirth (kill our board), and Gideon's Phalanx at seven mana.

**Choices an algorithm may miss.**

- Banishing Light. The pool holds eight; `head`'s Tokens deck plays none (its removal is one or two each of Coordinated Maneuver, Shire Shirriff, Thraben Charm, Emergency Eject, and Trostani's Judgment).
- Hop to It and Glorious Anthem, an honest burst and the only lasting anthem; `head` plays neither, but plays four Dragonback Lancer, whose tokens leave each turn.
- Mentor of the Meek is a token payoff (it draws when a small creature enters) that no live token matcher sees.

## 5. `bulk-red` R 40, best fit

**Plan.** Red Midrange for Limited: good two- and three-drops, cheap burn to clear blockers, and Skyship Stalker and Draconic Visitor to finish in the air.

**List.** 23 spells, 17 Mountain.

- Creatures: 2 Scuzzback Scrounger; 2 Skilled Battlecarver; 2 Mudbrawler Cohort; 1 Breeches, Eager Pillager; 2 Longhorn Sharpshooter; 1 Prodigal Pyromancer; 1 Lamplight Phoenix; 3 Skyship Stalker; 2 Draconic Visitor.
- Removal: 2 Wild Slash; 1 Thunder Salvo; 2 Staggershock; 2 Nahiri's Warcrafting.

**Counts.** 16 creatures, 7 removal spells plus a pinger and Longhorn Sharpshooter's plot damage, 6 flyers or evasive threats. Curve 1 / 2 / 3 / 4 / 5: 2 / 7 / 9 / 3 / 2.

**Notes.**

- Staggershock is two removal spells (rebound), and Nahiri's Warcrafting kills almost anything for three.
- A small bonus, not a plan: Scuzzback Scrounger and Breeches make Treasure, and with Draconic Visitor out each Treasure becomes a 5/5 flying Dragon.
- Left out: the artifact payoffs (Poetic Ingenuity, Scrap Welder) with too few artifacts, the Slivers, land destruction, and cards that hurt us (Ruinous Minotaur, Custody Battle).

**Choices an algorithm may miss.**

- `head` and `head-web` both built the same Artifacts deck: 3 Poetic Ingenuity with one artifact spell (Tablet of Discovery), so the payoff almost never triggers. A payoff needs its resource in the deck.
- Skyship Stalker: four in the pool, a 3/3 flyer that pumps itself, the best Limited card here. Neither plays it.
- Burn that hits creatures (Staggershock, Wild Slash, Nahiri's Warcrafting) over Duel Tactics and Self-Destruct.

## 6. `gold-heavy-black` WB 60, best fit

**Plan.** White-Black Midrange: mostly black removal and value creatures, with white for the strongest gold cards (Benalish Sleeper's edict, Ruthless Lawbringer, Oath of Kaya, Zealous Persecution, Shroudstomper).

**List.** 37 spells, 15 Swamp, 8 Plains.

- Creatures: 3 Glint-Sleeve Siphoner; 2 Dark Confidant; 1 Gifted Aetherborn; 3 Benalish Sleeper; 1 Thrill-Kill Assassin; 3 Gravelighter; 1 Ruthless Lawbringer; 1 Vault Plunderer; 1 Rotlung Reanimator; 2 Demonlord of Ashmouth; 2 Orzhov Racketeers; 1 Regal Bloodlord; 2 Shroudstomper.
- Removal: 3 Bloodchief's Thirst; 3 Fell; 2 Moment of Craving; 2 Foolish Fate; 1 Cruel Alliance; 1 Oath of Kaya; 1 Zealous Persecution.
- Mana: 1 Talisman of Hierarchy.

**Counts.** 23 creatures, 13 removal spells plus 6 edict creatures (Benalish Sleeper kicked, Gravelighter when nothing died), card advantage from Dark Confidant, Glint-Sleeve Siphoner, Vault Plunderer, and Shroudstomper. Sources: 16 black (with the Talisman) and 9 white. Curve 1 / 2 / 3 / 4 / 5+: 3 / 17 / 10 / 2 / 5.

**Notes.**

- White is a second color for one-pip cards at three mana or more, plus Shroudstomper at seven. Nine white sources cast one-pip three-drops at about 85% by the guide's table.
- Sacrifice fodder for Demonlord of Ashmouth and Ruthless Lawbringer comes from Rotlung Reanimator and Orzhov Racketeers, which leave tokens.
- Left out: the red and blue gold cards, Demonic Attorney (an ante card), the discard spells, and Shatter Assumptions.

**Choices an algorithm may miss.**

- Deciding white is worth it. The pool has no mono-white card; the case for white rests on a few gold cards, and it costs early black sources.
- Benalish Sleeper is a white two-drop whose point is the black kicker; a builder that reads only its color sees a 3/1.
- Keeping the 2-pip black cards (Gifted Aetherborn, Demonlord of Ashmouth) few once the mana is split.

## 7. `elf-tribe` 100, Lathril, Blade of the Elves, Elf tribe

**Plan.** Elves: mana Elves ramp into lords and token makers, Elf payoffs turn a wide board into damage and cards, and Lathril's "tap ten untapped Elves" drain or an End-Raze Forerunners attack ends it.

**List.** Commander, 64 spells, 12 nonbasic lands, 15 Forest, 8 Swamp.

- Commander: Lathril, Blade of the Elves.
- Mana (15): Elvish Mystic; Jaspera Sentinel; Joraga Treespeaker; Leaf Gilder; Quirion Elves; Elvish Archdruid; Llanowar Tribe; Marwyn, the Nurturer; Wood Elves; Farhaven Elf; Elvish Rejuvenator; Canopy Tactician; Wirewood Channeler; Sol Ring; Arcane Signet.
- Lords and Elf payoffs (12): Imperious Perfect; Dwynen, Gilt-Leaf Daen; Elderfang Venom; Timberwatch Elf; Abomination of Llanowar; Imaryll, Elfhame Elite; Jagged-Scar Archers; Shaman of the Pack; Skemfar Shadowsage; Voice of the Woods; End-Raze Forerunners; Harald, King of Skemfar.
- Token makers (8): Lys Alana Huntmaster; Wirewood Hivemaster; Dwynen's Elite; Elvish Promenade; Elven Ambush; Wolverine Riders; Eyeblight Cullers; Prowess of the Fair.
- Card advantage and recursion (12): Beast Whisperer; Miara, Thorn of the Glade; Sylvan Messenger; Masked Admirers; Voice of Many; Shessra, Death's Whisper; Twinblade Assassins; Moldervine Reclamation; Bounty of Skemfar; Elderfang Ritualist; Golgari Findbroker; Return Upon the Tide.
- Removal (14): Putrefy; Casualties of War; Binding the Old Gods; Poison the Cup; Hour of Defeat; Blood Curdle; Eyeblight Massacre; Kindred Dominance; Polukranos, Unchained; Ruthless Winnower; Lys Alana Scarblade; Poison-Tip Archer; Skyfisher Spider; Reclamation Sage.
- Other (3): Numa, Joraga Chieftain; Cultivator of Blades; Tyvar, Jubilant Brawler.
- Lands (12 nonbasic): Command Tower; Path of Ancestry; Llanowar Wastes; Foul Orchard; Golgari Guildgate; Jungle Hollow; Subterranean Cavern; Golgari Rot Farm; Skemfar Elderhall; Unclaimed Territory; Myriad Landscape; Wirewood Lodge.

**Counts.** 44 Elves with Lathril, 8 token makers, 4 lords, 14 removal including two one-sided sweepers, 12 card advantage and recursion, 35 lands plus 15 other mana sources. Sources: 24 green, 16 black, plus the any-color Elves.

**Notes.**

- The sweepers spare our board: Eyeblight Massacre hits non-Elves, Kindred Dominance names Elf, and Ruthless Winnower makes each player sacrifice a non-Elf every upkeep. Only three of our creatures are not Elves.
- Tyvar lets mana Elves and Lathril tap the turn they arrive.
- 35 lands, two under the formula, because 13 Elves and two rocks make mana; the check's castability is 0.89.
- Left out: the off-plan non-Elf creatures (Camellia, Altanak, Barbtooth Wurm), slow or symmetric cards (Darksteel Reactor, Mesmeric Orb, Tergrid's Shadow, Living Plane), and Maestros Theater, which finds only a Swamp here.

**Choices an algorithm may miss.**

- Sol Ring and cheap black removal (Putrefy, Poison the Cup, Hour of Defeat): `head`'s Lathril Elf deck from the same cards plays none of them, but plays Darksteel Reactor, Mesmeric Orb, and Soul-Guide Lantern.
- The one-sided sweepers. A rule that drops "destroy all creatures" or counts sweepers as risky in a creature deck would lose the best ones here.
- A Commander mana base with ramp: fewer lands when a third of the deck makes mana.

## 8. `bulk-blue` U 20, best fit

**Plan.** Blue Evasion as a half packet: three-mana flyers and True-Name Nemesis, with bounce on bodies and one counterspell.

**List.** 12 spells, 8 Island.

- Creatures: 2 Geyser Drake; 2 Vexing Gull; 1 True-Name Nemesis; 1 Man-o'-War; 1 Rangers of Ithilien; 1 Djinn of Wishes; 1 Summon: Valefor.
- Spells: 1 Mana Drain; 1 Snapback; 1 Stern Lesson.

**Counts.** 9 creatures, 6 of them flyers and one that the opponent cannot block or target; 5 interaction (Mana Drain, Snapback, Man-o'-War, Rangers, Valefor); 1 card advantage. Curve 2 / 3 / 4 / 5: 2 / 7 / 1 / 2.

**Notes.**

- A packet is half a deck, so it carries the plan in a few strong copies: two of each flyer, one of each removal body.
- Left out: the graveyard package (needs more cards than a packet holds), the Slivers, and conditional counters (Unified Will, Second Guess).

**Choices an algorithm may miss.**

- True-Name Nemesis and Rangers of Ithilien again, which the dead-card proxy lists.
- Removal on bodies (Man-o'-War, Rangers, Summon: Valefor) as the packet's interaction, rather than more bounce spells.
- `head` built Artifacts here (2 Etherium Sculptor, Idol of Oblivion, Map to Lorthos's Temple) and `head-web` built Tokens (Endless Evil, Poppet Stitcher); neither has a working engine in 12 spells.

## What the hand decks suggest

- **Setup is measured by how much and how often it fills, and it must be in the deck.** The Blue Graveyard deck's best enabler was a counted, high-strength card that the live deck still dropped, while cards that mill the opponent got in. The red Artifacts deck played three payoffs for one artifact.
- **Card quality hides from the role tags.** True-Name Nemesis, Rangers of Ithilien, and Steel Leaf Champion meet no role and score under the pack median, yet each is among the best cards in its pool. Plain removal such as Banishing Light also lost to theme cards in the Tokens deck.
- **A plain deck of the pool's best cards is often the best fit.** On `bulk-black`, `bulk-green`, and `bulk-red`, a Midrange deck uses the removal and efficient creatures the pool is rich in, where the stored best fits chose a thin theme.
