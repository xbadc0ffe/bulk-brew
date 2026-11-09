# Theme guide: Landfall, Ramp, Tappers

Sources. Card quotes come from `npm run review:cards -- "<name>" --style <id> --json` (data pack 2026-11-03). Tag and text counts come from scratch scripts over `data/packs/cards.json`, un-set cards left out: `node data/review/scratch/g5-landsetup.ts`, `g5-landfall.ts`, `g5-ramp.ts`, `g5-tap.ts`, `g5-count.ts`, `g5-textall.ts`, `g5-overlap.ts`. The section 9 hints, run as written, come from `node data/review/scratch/g5fix/final.ts`; land recursion counts from `g5fix/landrec.ts`, cost reducers and cheats from `g5fix/reduce.ts`. Real-deck counts come from `node --max-old-space-size=4096 data/review/scratch/g5fix/corpus.ts <landfall|ramp> [name pattern] [size]`, which counts each corpus deck with the section 9 hints, and odds from `node data/review/scratch/g5fix/odds.cjs`. EDHREC figures come from `node data/review/scratch/g5-edhrec.ts <page> <style>`: the sum of num_decks / potential_decks over the cards a page lists. Unlisted cards are missing, so each is a lower bound on copies per deck. Weights are rough; a repeatable engine counts about twice a one-shot.

Patterns in section 9 are JavaScript regular expressions over oracle text with reminder text removed. They are case-sensitive; `m` marks the multiline flag.

### Landfall (landfall)

**1. Plan.** Make a land drop every turn, add extra lands with fetch lands and ramp, and let permanents that trigger on each land build tokens, counters, life, or damage.

**2. Resource.** Lands entering under your control; one land is one trigger. Plain land drops give about one a turn. Setup adds a second or third.

**3. Setup jobs.**

- **Fetch and bounce lands** (one-shot, weight 1, no spell slot). Evolving Wilds: "Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped", two triggers from one drop. Simic Growth Chamber: "return a land you control to its owner's hand", to replay it.
- **Land ramp** (one-shot, weight 1 per land). Rampant Growth: "put that card onto the battlefield tapped". Harrow: "sacrifice a land ... put them onto the battlefield", two triggers.
- **One-shot extra drop** (weight 0.5 to 1; needs a land in hand). Explore: "You may play an additional land this turn." Growth Spiral.
- **Repeatable engines** (weight 2). Walking Atlas, Sakura-Tribe Scout: "{T}: You may put a land card from your hand onto the battlefield."
- **Land recursion** (mostly Commander). Crucible of Worlds: "You may play lands from your graveyard." It replaces the land drop rather than adding one, so it is repeatable setup (weight 2) only with 3 or more fetch lands, which it replays for two triggers every turn; without them it is support. Returning lands to the battlefield is one-shot (weight 1 per land): Quarry Beetle, "return target land card from your graveyard to the battlefield"; Splendid Reclamation, "Return all land cards from your graveyard to the battlefield tapped." Few are cheap: 21 nonland cards carry `crucible-of-worlds` (1 common or uncommon) and 68 carry `reanimate-land` (12). EDHREC's landfall page lists about 3.5 per deck.

Land to hand (Civic Wayfinder; Groundskeeper, "Return target basic land card from your graveyard to your hand") and card draw are support, not setup.

**4. Payoff jobs.** All fire on a normal land drop, so payoffs never starve; setup decides how hard they hit.

- **Lasting reward** (weight 1). Zendikar's Roil: "create a 2/2 green Elemental creature token". Prowling Felidar: "put a +1/+1 counter on this creature". Grazing Gladehart: "gain 2 life". Worth a card after two or three lands.
- **One-turn rewards** (weight 0.5). Steppe Lynx, Plated Geopede: "+2/+2 until end of turn". Good only when attacking after a land. Mana is a one-turn reward too: Lotus Cobra, "add one mana of any color".
- **Riders and thresholds** (0.25). Searing Blaze: "If you had a land enter the battlefield under your control this turn". Fledgling Griffin: "gains flying until end of turn", a keyword for one turn.

**5. False friends.**

- `tutor-land-to-battlefield` on Path to Exile: "Its controller may search", so the opponent gets the land. 21 setup-tagged cards carry `donate-rampant-growth`. Cleansing Wildfire is different and has no `donate-` tag: "Destroy target land. Its controller may search ... Draw a card." Aimed at your own land it trades a land for a tapped basic: one extra trigger and a card, but no extra land. Count it as setup worth 0.5, like half a fetch land, and never as Ramp.
- `land-ramp` on Annex: "You control enchanted land." It never enters; 43 setup-tagged cards carry `control-changing-effects`.
- `landfall` on Polluted Bonds ("a land an opponent controls enters"), Staff of the Wild Magus ("Forest you control enters, you gain 1 life"), and Hedron Crab, whose "target player mills three cards" pays off Mill. The `landfall-other` tag marks triggers on other players' lands or any player's: 29 live payoffs carry it, Polluted Bonds and Ankh of Mishra ("Whenever a land enters") among them.

**6. Both jobs.** Ask what the card does with no other setup. If it still makes lands enter, it is setup: Burgeoning, "Whenever an opponent plays a land, you may put a land card from your hand onto the battlefield"; Khalni Heart Expedition, whose quest ends "Search your library for up to two basic land cards, put them onto the battlefield tapped" (slow land ramp, weight 1). If it only rewards lands, it is a payoff: Lotus Cobra. Count once.

**7. Enough.** By turn 5 a deck has seen 11 cards on the play and 12 on the draw (7 plus 4 or 5 draws). In multiplayer Commander nobody skips the first draw (rule 103.8c), so 12. That is about a fifth of 60 cards, 30% of 40, and 12% of 100.

| Size | Lands (fetch or bounce) | Nonland setup | Payoffs (lasting) |
| ---- | ----------------------- | ------------- | ----------------- |
| 60   | 25 to 27 (2 to 4)       | 3 to 6        | 8 to 12 (2+)      |
| 40   | 17 to 18 (1 to 2)       | 2 to 4        | 5 to 8 (1+)       |
| 20   | 8 to 9 (0 to 1)         | 1 to 3        | 5 to 7 (1+)       |
| 100  | 38 to 42 (4 to 8)       | 10 to 15      | 13 to 17 (4+)     |

- **Payoffs set the bar**, since land drops feed them. 8 in 60 shows one by turn 5 in 82% to 85% of games; 5 in 40 gives the same, and 13 in 100 gives 80% to 83%. The 60-card landfall precons hold 7 to 14 by the section 9 hint (Savage Lands 7, the Zendikar duel deck 8, Zendikar's Rage 14).
- **A packet carries its theme alone.** Any two packets shuffle into a 40-card deck, often with a packet of another theme. So a packet needs the 40-card payoff count by itself: 5 payoffs in 40 cards show one by turn 5 in 82% to 85% of games, 3 only in 63% to 67%. The six Landfall Jumpstart packets hold 5 to 8.
- **Setup multiplies.** Count fetch and bounce lands with it: 6 to 10 in all at 60 shows one or two by turn 5, so a turn or two triggers twice. The 60-card landfall precons hold 7 to 9 in all (Zendikar's Rage 4 lands and 3 spells, the Zendikar duel deck 2 and 5, Savage Lands 4 and 5).
- **Repeatable setup is welcome, not required.** No 60-card landfall precon or Landfall Jumpstart packet in the corpus runs one (one packet has Ancient Greenwarden, but with a single fetch land), and the Commander lands precons run 1 to 4.
- **Lasting payoffs** keep the plan alive when the board stalls, since pumps pay only on attacks. The 60-card precons hold 1 to 5. A pool with none builds a landfall aggro deck instead: low curve and 16 or more creatures.
- **Lands.** Each land is a trigger, so landfall runs a land or two above the usual: the 60-card landfall precons run 26 to 27, the Commander lands precons 37 to 44 (most 40 to 44), and the Jumpstart packets 8 to 9.
- **Commander.** The 100 row assumes no payoff commander. Setup there: the lands precons run 10 to 20 nonland setup. EDHREC's landfall page lists about 15 land makers, 6 fetch or bounce lands, and 14.1 payoffs per deck, all lower bounds. A payoff commander (Tatyova, Benthic Druid: "gain 1 life and draw a card") frees 3 or 4 payoff slots for setup; an extra-drop commander (Azusa, Lost but Seeking) replaces repeatable setup.

Add 4 to 6 removal at 60 and creatures to carry counters.

**8. Where the live matchers differ.**

- Lands never count: `countCopies` (`scan.ts`) counts spells only, and `lands.ts` picks fetch lands for color.
- Enabler #1 (`anyTags tutor-land-to-battlefield|extra-land|land-ramp`) takes donate, theft, and land destruction. It misses all 12 bounce lands (untagged) and 31 of 48 sacrifice-to-fetch lands (Bant Panorama). Walking Atlas weighs the same as Rampant Growth.
- Payoff #1 (`anyTags landfall`) takes the 29 `landfall-other` cards, five Staffs, and three Gate cards. A pump weighs the same as a token engine.
- 25 `landfall` cards also meet the enabler and count twice.

**9. Matcher hints.**

- Setup tags (nonland): `tutor-land-to-battlefield`, `sneak-land`, `play-additional-land`, `multi-land-ramp`, `reanimate-land`, `crucible-of-worlds`, minus `donate-rampant-growth`, `control-changing-effects`, and text `[Ii]ts controller (may search|searches)|their controller may search` (the land goes to the target's controller). That gives 439 cards. Do not drop all `removal-land`: Frenzied Tilling ("Destroy target land. Search your library for a basic land card, put that card onto the battlefield tapped") is real setup. A swap, `[Dd]estroy target land\. Its controller may search`, is setup at 0.5 (Cleansing Wildfire, Geomancer's Gambit, Sandworm, Avengers Disassembled).
- Lands: `Sacrifice this land: Search your library for [^.]*onto the battlefield`; `return a land you control to its owner's hand`.
- Repeatable: `\{T\}[^:]*: (You may )?put a land card from your hand onto the battlefield|additional lands? on each of your turns|play lands from your graveyard` (39 nonland cards; the last part counts only with 3 or more fetch lands). One-shot: `additional land this turn`.
- Payoff: `Whenever (a land|an? (Forest|Island|Mountain|Plains|Swamp)|this land or another land) you control enters`, or a threshold, `[Ii]f you had a land enter|a land entered the battlefield under your control this turn`, minus the tag `landfall-other`. That matches 228 cards (223 nonland), Battlewand Oak, Valakut, the Molten Pinnacle, Field of the Dead, Searing Blaze, and Wandering Troubadour among them. Of the 288 live payoffs it drops the 29 `landfall-other` cards and 31 more, nearly all rightly: five Staffs, three Gate cards, seven "Whenever you play a land or cast a spell" or "play a card" triggers, and cards that play lands from exile or the graveyard.
- Payoff weight, checked in this order on the trigger sentence (with its modes after "choose one"). Over the 228 matches it gives 95 cards at 1, 90 at 0.5, 16 at 0.25, 4 at 0, and 23 that count as setup.
  - a setup card by the tags above, or `quest counter`: setup, not payoff (Khalni Heart Expedition, Aesi, Tyrant of Gyre Strait);
  - `mills?`: 0, a Mill card (Hedron Crab);
  - a threshold with no trigger: 0.25 (Searing Blaze);
  - `gains? [a-z, ]+ until end of turn` with no `\+\d+/\+\d+`: 0.25 (Fledgling Griffin);
  - `create|counters? on|gain \d+ life|draws?|investigate|\{E\}|exile target|each opponent|damage to`: 1 (Zendikar's Roil, Felidar Retreat, Valakut);
  - anything else: 0.5, such as pumps (Steppe Lynx), mana (Lotus Cobra), and self-recursion (Bloodghast).

### Ramp (bigCreatures)

**1. Plan.** Play mana creatures, rocks, and land ramp on turns 1 to 3, then cast six- and seven-mana threats or a big X spell a turn or two early.

**2. Resource.** Mana beyond the land count. A lasting source gives +1 mana every turn; a ritual, Treasure, or sacrifice-for-mana gives +1 to +3 once. One lasting source by turn 3 casts a five-drop on turn 4 and a six-drop on turn 5. A six-drop on turn 4 needs two by turn 3, which most decks miss (section 7).

**3. Setup jobs.** Here repeatable means lasting.

- **Mana creatures** (lasting, weight 1, fragile). Llanowar Elves, Elvish Mystic: "{T}: Add {G}."
- **Mana rocks** (lasting, weight 1). Mind Stone: "{T}: Add {C}." Arcane Signet adds mana only "in your commander's color identity" (rule 903.4f); the builder already drops it below 100.
- **Land ramp** (lasting, weight 1 per land). Rampant Growth; Cultivate, "put one onto the battlefield tapped and the other into your hand"; Wayfarer's Bauble. Explosive Vegetation ("up to two basic land cards, put them onto the battlefield tapped") is setup at 4 mana when the top end is 6+.
- **Cost reducers and cheats** (lasting, weight 0.5 to 1; few exist). Centaur Omenreader: "As long as this creature is tapped, creature spells you cast cost {2} less to cast." Rhonas's Monument: "Green creature spells you cast cost {1} less to cast." Elvish Piper: "{G}, {T}: You may put a creature card from your hand onto the battlefield." The pack has 26 cards whose text makes creature spells cost less (13 common or uncommon) and 28 that put a creature card from hand onto the battlefield (3 common or uncommon).
- **Bursts** (one-shot, 0.25 to 0.5). Dark Ritual: "Add {B}{B}{B}." Blood Pet: "Sacrifice this creature: Add {B}." Big Score: "create two Treasure tokens".
- **Land to hand** (support, 0.25). Civic Wayfinder; Krosan Tusker's cycling.

**4. Payoff jobs.** Each wants about +2 mana by turn 4.

- **Big creatures at 6+** (weight 1). Colossal Dreadmaw: 6/6 "Trample". Pelakka Wurm: 7/7 trample, "you gain 7 life". Ulamog's Crusher: "Annihilator 2".
- **Evasive five-drops** (weight 0.75). Serra Angel, Air Elemental: 4/4 "Flying".
- **X spells and X creatures** (weight 1, also reach). Blaze: "deals X damage to any target". Fireball. Feral Hydra: "enters with X +1/+1 counters". Count them when the pool has them, but do not require them: of eight 60-card ramp and big-creature precons checked (Wicked Big, Stomp, Stomp, Massive Might, Mono Green Amazon, Green, Beasts, Dino Might, Stampede of Beasts), only Stampede of Beasts (2) and Massive Might (1) run any.

**5. False friends.**

- The derived `finisher` takes 4-mana 4/4s such as Rumbling Baloth (no text): curve filler, not a ramp payoff. 1,207 creatures qualify at mana value 4.
- Bodies that cannot attack: Carnivorous Plant ("Defender", 4/5), Dark Maze, Deep-Sea Serpent ("can't attack unless defending player controls an Island"). 99 finishers say Defender or can't attack.
- `mana-dork-egg` counts as lasting: Blood Pet, Generator Servant ("{T}, Sacrifice this creature: Add {C}{C}").
- `restricted-mana` needs a text check: Elfhame Druid also has a plain "{T}: Add {G}." and is real.

**6. Both jobs.** A creature that ramps is setup at 3 mana or less and a payoff at 5 or more. Wood Elves (3 mana): "search your library for a Forest card, put that card onto the battlefield". Silverglade Elemental, a 4/4 for 5 with the same text on entering, is a payoff: its Forest comes too late to set anything up. A 4-mana ramp spell is setup when the payoffs cost 6+. Count once.

**7. Enough.** By turn 3 a 60-card deck has seen 9 or 10 cards. With 8 lasting sources it has one by then in 75% to 79% of games, enough for a five-drop on turn 4 or a six-drop on turn 5. Two sources by turn 3, for a six-drop on turn 4, come in only 34% to 40% of games. With 6 sources the odds are 64% to 68% for one and 22% to 26% for two. Plan on jumping one turn, not two.

| Size | Lands    | Lasting setup | Payoffs            |
| ---- | -------- | ------------- | ------------------ |
| 60   | 22 to 24 | 6 to 10       | 6 to 10 (3+ at 6+) |
| 40   | 16 to 17 | 4 to 6        | 4 to 6             |
| 20   | 7 to 8   | 2 to 3        | 2 to 3             |
| 100  | 36 to 38 | 10 to 16      | 12 to 20           |

About one setup per payoff, nearly all lasting. The floor of 6 at 60 is what the stronger ramp precons run: Wicked Big 6, Stomp, Stomp 6, Massive Might 8. Most big-creature precons run 3 to 5 (Green Game Night 4, Beasts 3, Dino Might 3). Those play as midrange with big creatures, which is decent but not Ramp. Their payoffs fit the table: 6 to 10, with 4 to 7 at 6+. At 100, Commander precons built on big creatures hold 5 to 13 lasting sources by the section 9 hint (Eldrazi Unbound 12, Multiverse Reforged 13), and 10 sources show one by turn 3 in about two games in three.

Add 4 to 6 removal or real blockers for turns 2 to 4, and card draw at 100. EDHREC's ramp, big-mana, and stompy pages list mana creatures, rocks, and land ramp at about 9 to 11 per deck; Ghalta, Primal Hunger decks list about 10 cheap ramp pieces and 8 big creatures. A big-creature commander is an always-available payoff: cut 2 or 3 payoffs. A mana commander is one lasting source: cut 2 setup.

**8. Where the live matchers differ.**

- Enabler #1 (`derived cheapManaSource`, `manaSourceKind` in `matchers.ts`) counts sacrifice-for-mana and restricted mana as lasting, and its mana value cap of 3 drops Explosive Vegetation.
- It also counts land swaps as land ramp. Cleansing Wildfire and Geomancer's Gambit ("Destroy target land. Its controller may search ...") print "mana source (landRamp)" and meet enabler #1. On your own land they trade a land for a land; on the opponent's they give the land away.
- Payoff #1 (`derived finisher`) is met by about 5,000 nonland cards, 4-mana 4/4s and defenders included, so any pool looks like Ramp. It misses X spells and X creatures (power 0).
- No duals.

**9. Matcher hints.**

- Lasting (nonland, mana value 4 or less): tags `mana-dork`, `mana-rock`, `tutor-land-to-battlefield`. Exclude `mana-dork-egg`, `ritual`, `donate-*`, and text `[Ii]ts controller (may search|searches)|their controller may search`, which drops land swaps such as Cleansing Wildfire. Keep other `removal-land` cards: Mwonvuli Acid-Moss searches your own library, and Unstable Obelisk is a rock ("{T}: Add {C}.") with a removal mode. That gives 911 cards. Treat `restricted-mana` as restricted only when every `Add` is followed by `Spend this mana only`.
- Text, lasting (nonland, `m`): `^(?![^:\n]*Sacrifice)[^:\n]*\{T\}[^:\n]*: Add`, a line whose cost has {T} and no Sacrifice. It keeps Mind Stone, Banners, Cluestones, and Lockets, which sacrifice only to draw, and drops Generator Servant. 723 cards. Burst (nonland, `m`): `Sacrifice this [^:]*: Add|^Add \{|create[^.]*Treasure`, 410 cards.
- Cost reducers and cheats: `[Cc]reature spells you cast cost \{\d\} less` (26); `put an? (creature|permanent) card from your hand onto the battlefield` (28).
- Payoff: a creature at mana value 5+ with power 5+, or power 4+ with Flying, Trample, or an enters trigger. Weight 1 at 6+, 0.75 at 5. Mana value 4 and less is not a payoff (section 5). Exclude only the card's own limits: the keyword Defender, or `This creature can't attack( unless| alone|\.| or block)`. So Stormtide Leviathan ("Creatures without flying or islandwalk can't attack") stays. That matches 2,519 creatures, 1,662 at 6+ and 857 at 5; card strength picks among them.
- X: mana cost has `{X}` and text matches `X damage|X \+1/\+1 counters|draws? X|create X`.

### Tappers (tappers)

**1. Plan.** Tap the opponent's blockers each turn with cheap tappers and attack past them, finishing with tap-trigger engines or removal that kills tapped creatures.

**2. Resource.** Opposing creatures tapped when it matters: before your attack or on their turn. Unit: one tap of an untapped opposing creature; a freeze ("doesn't untap", stun counter) counts about 1.5.

**3. Setup jobs.**

- **Repeatable tappers** (weight 2). Gideon's Lawkeeper, Goldmeadow Harrier, Blinding Mage: "{W}, {T}: Tap target creature." Ballynock Trapper: "{T}: Tap target creature."
- **Enters tappers** (one-shot with a body, weight 1). Frost Lynx: "tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step." Chillbringer.
- **Tap spells** (one-shot). Single, 0.5: Blustersquall, "Tap target creature you don't control." Several, 1 to 2: Frost Breath, "Tap up to two target creatures"; Sleep, "Tap all creatures target player controls", often the winning turn.

**4. Payoff jobs.**

- **Tap-trigger engines** (weight 1; want a tap every turn). Hylda of the Icy Crown: "Whenever you tap an untapped creature an opponent controls, you may pay {1}". Sharae of Numbing Depths: "Whenever you tap one or more untapped creatures your opponents control, draw a card." Verity Circle: "Whenever a creature an opponent controls becomes tapped, if it isn't being declared as an attacker, you may draw a card." Eight cards carry such a trigger. Icewrought Sentry taps on its own and counts as setup (section 6), which leaves 7, 3 of them uncommon (Palliation Accord, Sharae, Solitary Sanctuary).
- **Tapped-only removal** (0.5; removal first). Assassinate: "Destroy target tapped creature." Iron Verdict: "5 damage to target tapped creature". Luminous Rebuke: "costs {3} less to cast if it targets a tapped creature". They hit attackers anyway; a tapper makes them main-phase removal.
- **Tapped-creature counts and bounce** (0.5). Theft of Dreams: "Draw a card for each tapped creature target opponent controls." Galestrike: "Return target tapped creature to its owner's hand. Draw a card." Surrakar Banisher does the same bounce on entering. 11 cards, 8 common or uncommon. Hylda's Crown of Winter's sacrifice ability counts tapped creatures too, but the Crown is setup (section 6).
- **Attackers.** The usual reward in bulk: flyers and power 3+. Not tagged.

**5. False friends.**

- Lock Auras tagged `tapper-creature` are removal: Claustrophobia ("doesn't untap during its controller's untap step"), Narcolepsy ("At the beginning of each upkeep, if enchanted creature is untapped, tap it."). 72 tapper cards carry `lockdown-creature`, but Narcolepsy and 11 other tapper-tagged lock Auras do not, so the lock rule in section 9 reads the text.
- Narrow tappers: Kitsune Diviner ("{T}: Tap target Spirit."), Ali Baba (Walls), Rimewind Taskmage ("four or more snow permanents"), Kelpie Guide ("eight or more lands").
- Riders: Stabbing Pain ("-1/-1 ... Tap that creature."), Niveous Wisps, Due Respect ("Permanents enter tapped this turn.").
- `synergy-tapped` rewards your own tapped creatures: Frontline War-Rager ("if you control two or more tapped creatures"), Spider-Man, Web-Slinger.
- `hate-tapped` on lands: Mana Geyser ("for each tapped land your opponents control"), Branded Brawlers.

**6. Both jobs.** If the card's own tap is repeatable and its reward small, it is setup. Hylda's Crown of Winter: "{1}, {T}: Tap target creature"; its sacrifice to draw works once. Icewrought Sentry: on each attack it may pay {1}{U} to "tap target creature an opponent controls", and its reward is "+2/+1 until end of turn". If it taps once on entering and then rewards every tap, it is a payoff: Sharae of Numbing Depths, Solitary Sanctuary. Verity Circle is a payoff; its own tap costs {4}{U}. Count once.

**7. Enough.** With five repeatable tappers in 60 cards, a deck finds one by turn 4 about two games in three.

| Size | Tap sources (repeatable) | Payoffs | Creatures |
| ---- | ------------------------ | ------- | --------- |
| 60   | 8 to 10 (4 to 6)         | 2 to 4  | 14 to 18  |
| 40   | 5 to 7 (3+)              | 1 to 3  | 13 to 16  |
| 20   | 3 to 4 (2)               | 1 to 2  | 7 to 9    |
| 100  | 15 to 20 (8+)            | 4 to 8  | 25 to 30  |

Setup to payoff 3 to 1 or more, since engines need a tap every turn. With no engines in the pool, the deck is White-Blue tempo: tappers, flyers, tapped-only removal, and 3 or more other removal. Hylda decks on EDHREC list about 25 tap cards and 7 payoffs. A payoff commander like Hylda needs only 3 to 5 payoffs in the 99; a tapper commander is one repeatable source always, so add payoffs.

**8. Where the live matchers differ.**

- Enabler #1 (`anyTags tapper-creature|freeze-creature`, 703 cards) counts lock Auras, narrow tappers, and riders like a repeatable tapper. 319 carry `repeatable-crime`.
- Payoff #1 (`anyTags hate-tapped|synergy-tapped`, 204 cards): 111 are removal, 46 reward your own tapped creatures, a few are about lands.
- At least 20 cards meet both (Sharae, Solitary Sanctuary, Icewrought Sentry, Verity Circle, Hylda's Crown of Winter).
- Six tap spells and two Assassinates meet the 60-card minimums (6, 2). Attackers are not counted.

**9. Matcher hints.**

- Lock is removal, and it is checked first: an Aura (`^Enchant (creature|permanent)`, `m`) whose text has `Enchanted (creature|permanent) doesn't untap|can't become untapped|[Tt]ap enchanted (creature|permanent)|if enchanted creature is untapped, tap it`. 78 cards, Narcolepsy among them. A lock is never a tapper. An Aura that gives your creature a tap ability (Grasp of the Hieromancer) or taps a target on entering (Glaring Aegis) is not a lock.
- Repeatable: `\{T\}[^:]*: Tap target (creature|nonland permanent|permanent)\.`; `tapper-creature` with `repeatable-crime`, minus `lockdown-creature` and `hate-typal`.
- One-shot: `When [^.]* enters, (you may )?tap (or untap )?(it and )?(up to \w+ |X )?target[^.]*(creature|permanent)|When [^.]* enters, tap all [^.]*creatures`, 75 cards after the lock rule (Frost Lynx, Pestermite, Dragon Turtle, Glaring Aegis). Self-taps (Gitaxian Anatomist) and land taps (Gulf Squid, Guild Summit) no longer match. Spells (instant or sorcery): `[Tt]ap (target|up to \w+ target|all) creatures?` minus `creatures? you control`, 122 cards (Blustersquall, Frost Breath, Sleep). The `[Tt]` keeps the pattern case-sensitive, which the Narrow hint needs.
- Freeze, 1.5, only on a card already counted as a tapper above: `(doesn't|don't) untap during (its|their) controllers?'s? next untap|(doesn't|don't) untap during that player's next untap|stun counters?`. Frost Breath ("their controller's next untap step"), Sleep ("that player's next untap step"), and Dragon Turtle match.
- Narrow: `Tap target [A-Z][a-z]+\.` naming a creature type; `Activate only if you control`.
- Engines: `Whenever you tap (an|one or more) untapped creatures? (an opponent controls|your opponents control)|Whenever a creature an opponent controls becomes tapped` (8 cards). A card that also taps on its own counts once: setup when the reward is a one-turn pump (Icewrought Sentry), payoff otherwise (Verity Circle).
- Tapped removal, 0.5: `(Destroy|Exile) target tapped creature|damage to target tapped creature|less to cast if it targets a tapped creature`. Counts and bounce, 0.5: `for each tapped creature (target opponent controls|your opponents control|an opponent controls|defending player controls)|[Rr]eturn target tapped creature` (11 cards). A repeatable tapper that also matches these stays setup (Hylda's Crown of Winter).
- Drop from payoff: `synergy-tapped` unless the text names opponents; `tapped (land|artifact)`, `untapped land`.
