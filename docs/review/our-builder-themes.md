# Our builder's themes on public pools

Does the Graveyard failure from `docs/algo-review.md` ("Why it strings random cards together") show up in other themes? I built 24 requested-style 60-card decks from the public pools, listed every card the builder counts as setup (enabler) or payoff for the requested style, and read each card's oracle text from the data pack.

Builder 26.0.35 (`c99dc0f`), data pack 2026-11-03, `data/learned.json` attached as the apps do.

## The short answer

Yes. The Graveyard pattern is common, and it is not only about `mill-self`.

- Every one of the 24 decks meets its style's minimums by the builder's own count. Counting only cards that really do the job, 10 of 24 meet the same minimums. That number rests on a few close calls; with the stricter call on each it is 8 (see "How firm the honest count is").
- My verdicts: 9 decks have a working plan, 8 have half a plan, 7 have no plan for the theme they are named after.
- All four Graveyard decks miss the honest minimum. So do both +1/+1 counters decks, all three Aristocrats decks, and two of three Tokens decks. Four of these 11 (Graveyard in blue and green, counters in green, Aristocrats in black) still have half a plan; the other 7 have none.
- Themes whose setup is a card type (Voltron, Spellslinger, Artifacts, Enchantments) mostly work. Their weak spot is payoff tags that are broader than the card. My method counts every card of the type as real setup, so this rests on the payoffs.
- The tags are only half the cause. The builder breaks ties by theme value before strength, and a dual card is worth 2; it fills each learned theme toward a target well above the minimum; and its swaps may not drop a theme card below that target. These turn broad tags into picks (see "What this shows").
- Removal and curves look sane by the builder's own role counts. Mana is not tested here: all 24 decks are one color on basics only, and 8 of them run 25 lands. A failed themed deck usually plays as a plain midrange pile.

| Deck                             | Builder count: setup / payoff (dual) | Setup: real / rider / wrong | Payoff: real / weak / wrong | Honest minimum met | Verdict |
| -------------------------------- | ------------------------------------ | --------------------------- | --------------------------- | ------------------ | ------- |
| Graveyard, bulk-blue U           | 10 / 10 (4)                          | 6 / 2 / 2                   | 1 / 9 / 0                   | no                 | Partial |
| Graveyard, bulk-black B          | 10 / 12 (3)                          | 0 / 9 / 1                   | 6 / 5 / 1                   | no                 | No plan |
| Graveyard, bulk-green G          | 11 / 11 (7)                          | 4 / 0 / 7                   | 6 / 1 / 4                   | no                 | Partial |
| Graveyard, white-bulk W          | 10 / 12 (2)                          | 0 / 10 / 0                  | 9 / 3 / 0                   | no                 | No plan |
| Tokens, white-bulk W             | 20 / 20 (7)                          | 9 / 11 / 0                  | 10 / 9 / 1                  | yes                | Working |
| Tokens, bulk-green G             | 11 / 6 (0)                           | 8 / 2 / 1                   | 0 / 5 / 1                   | no                 | No plan |
| Tokens, bulk-red R               | 8 / 8 (2)                            | 5 / 0 / 3                   | 2 / 2 / 4                   | no                 | No plan |
| +1/+1 counters, bulk-green G     | 19 / 11 (4)                          | 10 / 8 / 1                  | 2 / 4 / 5                   | no                 | Partial |
| +1/+1 counters, bulk-black B     | 16 / 11 (8)                          | 5 / 9 / 2                   | 2 / 6 / 3                   | no                 | No plan |
| Aristocrats, bulk-black B        | 21 / 4 (0)                           | 17 / 4 / 0                  | 1 / 3 / 0                   | no                 | Partial |
| Aristocrats, white-bulk W        | 19 / 4 (2)                           | 12 / 7 / 0                  | 3 / 1 / 0                   | no                 | No plan |
| Aristocrats, bulk-green G        | 10 / 4 (0)                           | 7 / 0 / 3                   | 1 / 3 / 0                   | no                 | No plan |
| Lifegain, white-bulk W           | 15 / 7 (3)                           | 8 / 6 / 1                   | 6 / 1 / 0                   | yes                | Working |
| Lifegain, gold-heavy-black B     | 15 / 4 (0)                           | 4 / 11 / 0                  | 3 / 1 / 0                   | no                 | Partial |
| Spellslinger, bulk-red R         | 19 / 7 (0)                           | 19 / 0 / 0                  | 6 / 1 / 0                   | yes                | Working |
| Spellslinger, bulk-blue U        | 21 / 7 (0)                           | 21 / 0 / 0                  | 4 / 1 / 2                   | no                 | Partial |
| Artifacts, bulk-blue U           | 14 / 11 (3)                          | 14 / 0 / 0                  | 5 / 4 / 2                   | yes                | Partial |
| Artifacts, bulk-red R            | 13 / 11 (3)                          | 13 / 0 / 0                  | 9 / 2 / 0                   | yes                | Working |
| Landfall, bulk-green G           | 12 / 12 (4)                          | 9 / 2 / 1                   | 5 / 7 / 0                   | yes                | Working |
| Landfall, creatures-only-green G | 6 / 6 (1)                            | 3 / 3 / 0                   | 5 / 1 / 0                   | no                 | Partial |
| Enchantments, bulk-green G       | 16 / 7 (1)                           | 16 / 0 / 0                  | 3 / 4 / 0                   | yes                | Working |
| Enchantments, white-bulk W       | 17 / 10 (3)                          | 17 / 0 / 0                  | 6 / 3 / 1                   | yes                | Working |
| Voltron, bulk-red R              | 10 / 6 (0)                           | 10 / 0 / 0                  | 6 / 0 / 0                   | yes                | Working |
| Voltron, white-bulk W            | 12 / 12 (0)                          | 9 / 3 / 0                   | 10 / 2 / 0                  | yes                | Working |

All counts are card copies. "Dual" is copies the builder counts as both setup and payoff. "Honest minimum met" asks whether real setup and real payoff copies each reach the style's own 60-card minimums in `config/archetypes.json`.

## How I judged

One reviewer's read of each card's oracle text against the rest of its deck. The counts are reproducible from the files named below; the judgments are mine and should be rechecked by the Phase 3 panel.

**Setup**

- **Real:** the card's main job builds the theme's resource, in volume or repeatedly. Examples: a looter, a mill-4 creature, a repeatable sacrifice outlet, a card that makes several tokens, a repeatable counter source. For themes defined by card type (Spellslinger, Artifacts, Enchantments, Voltron) every counted card of the type is real by definition, so "no riders" there is an assumption, not a finding; I note the ones that do nothing in their deck. Voltron tutors are not the type and are judged like any other card.
- **Rider:** the card's main job is something else, and it adds a small or one-time amount: removal with surveil 1, a creature with one explore, a 2/2 that surveils when it attacks, removal that gains 2 life. A condition the deck rarely meets also makes it a rider.
- **Wrong:** the card does not build the resource at all, or works against it.

**Payoff**

- **Real:** rewards the resource and scales with it or needs it.
- **Weak:** self-contained (rewards only itself, such as flashback), tiny, or behind a hard condition.
- **Wrong:** does not reward the resource, or undoes it.

**How firm the honest count is**

Each dual card counts once. A card that is real on both sides goes to one side only, the one that lets the deck pass: Born to Drive is either channelled for tokens or cast as the Aura, never both. The cards this affects are Born to Drive, Retreat to Emeria, The Crystal's Chosen, Dawn of Hope, Etherium Sculptor, Poetic Ingenuity, Sanctum Weaver and Michiko's Reign of Truth. The count stays at 10 of 24, but white Lifegain then sits exactly at its setup minimum (8) and green Enchantments exactly at its payoff minimum (3).

Some calls decide a deck's result, and I did not make them evenly:

- White Lifegain reaches 8 of 8 real setup only by counting Envoy of the Ancestors and Abzan Battle Priest as real. Both give lifelink only to modified or countered creatures, often just themselves through outlast. Self-only counter cards are riders in the counters decks.
- Green Landfall reaches 5 of 5 real payoffs with Skyclave Pick-Axe as real and Attercop as weak, though both are pumps per land until end of turn.
- Green Landfall's setup counts 4 Earthbender Ascension and 1 Summon: Fenrir as real, though each puts one basic land onto the battlefield once. Elsewhere one explore or one token on entering is a rider.
- Microscope and Screeching Sliver (tap: surveil 1, or mill 1) are real, while Fear of Surveillance and Starfighter Pilot (surveil 1 on each attack or tap, the same `repeatable-surveil` tag as Microscope) are riders. This one changes no result.

With the stricter call on each, white Lifegain and green Landfall miss the minimum and the count is 8 of 24. Read the headline as 8 to 10.

## Commands

Run from the repo root on 2026-11-08. `node packages/pipeline/src/demo-build.ts` is what `npm run demo:build --` runs.

Scans, to find the styles each pool can build at 60:

```sh
npm run demo:build -- eval/pools/bulk-blue.txt U 60 graveyard
for spec in "bulk-black B" "bulk-blue U" "bulk-green G" "bulk-red R" "white-bulk W" \
  "gold-heavy-black B" "elf-tribe G" "creatures-only-green G"; do
  set -- $spec; node packages/pipeline/src/demo-build.ts eval/pools/$1.txt $2 60
done
```

Each deck, built and inspected (24 pool, color, and style triples, listed in the table above):

```sh
node data/review/scratch/theme-members.ts eval/pools/<pool>.txt <color> 60 <style> \
  data/review/scratch/themes/<pool>-<color>-60-<style>.txt
node packages/pipeline/src/demo-build.ts eval/pools/<pool>.txt <color> 60 <style> \
  > data/review/scratch/themes/<pool>-<color>-60-<style>.demo.txt
awk -f data/review/scratch/compact.awk data/review/scratch/themes/<pool>-<color>-60-<style>.txt
```

Style ids used: `graveyard`, `tokens`, `counters`, `aristocrats`, `lifegain`, `spells`, `artifacts`, `landfall`, `enchantments`, `auras` (Voltron). The decklist and curve in each inspector file match the `demo:build` output byte for byte for all 24 decks, so the inspector builds the same deck.

Setup left in the pools, for the Graveyard decks:

```sh
node data/review/scratch/pool-tags.ts eval/pools/<pool>.txt <color> graveyard \
  loot,rummage,discard-outlet,sacrifice-outlet-creature
node data/review/scratch/pool-tags.ts eval/pools/<pool>.txt <color> graveyard \
  mill-self,graveyard-fuel-self
```

How the builder ranks theme cards and how deep it fills a theme (from the fact check, scratch under `data/review/scratch/verify-themes/`):

```sh
node data/review/scratch/verify-themes/role-cands.ts eval/pools/<pool>.txt <color> 60 <style> <roleId>
node data/review/scratch/verify-themes/theme-cands.ts eval/pools/<pool>.txt <color> 60 <style>
node data/review/scratch/verify-themes/targets.ts
```

Rules checks, by grep in `docs/rules/MagicCompRules.txt`: 701.71 (empower Jace), 701.44 (explore), 701.66 (earthbend), 702.181 (mobilize), 701.68 (blight), 728 (rad counters).

Every style picked is viable at 60 in at least one public pool, so I did not need 40-card builds. All pools scanned show Graveyard as viable except the red one.

**What this sample does not cover.** Read the results with these gaps in mind:

- 60 cards only, one color only, basic lands only, and 10 of the 18 themed styles.
- Viable at 60 but not opened: Evasion (5 pools), Ramp (5), Burn (2), Mill (blue), Tappers and Energy (white).
- Best fit not opened: at 60, gold-heavy-black builds "Black Burn 60", white-bulk "White Artifacts 60" and creatures-only-green "Green +1/+1 counters 60". None of those three pool and style pairs is in the table.
- No 100-card Commander deck, where `commander.ts` picks the commander and the 100-card minimums apply. A tribe can lead only a Commander deck (`demo:build -- eval/pools/elf-tribe.txt G 60 tribal:Elf` falls back to best fit), so the Elf tribe is untested too.

The 60-card scans for all eight pools are in `data/review/scratch/verify-themes/scans/`.

## Graveyard

Minimums at 60: 6 setup, 5 payoffs. Four pools.

### Blue (bulk-blue, U)

19 creatures, 1 planeswalker, 13 instants and sorceries, 2 other, 25 Islands.

Setup (6 real, 2 rider, 2 wrong):

- 2 Fact or Fiction, real: "Put one pile into your hand and the other into your graveyard."
- 2 Winternight Stories, real, dual: "Draw three cards. Then discard two cards unless you discard a creature card."
- 1 Microscope, real but small: "{T}: Surveil 1."
- 1 Screeching Sliver, real but small: All Slivers have "{T}: Target player mills a card."
- 1 Ephara's Dispersal, rider: "Return target creature to its owner's hand. Surveil 2."
- 1 Spyglass Siren, rider: "When this creature enters, create a Map token." (one explore)
- 2 Constrictor Sage, wrong, dual (tag `graveyard-fuel-self`): "{2}{U}, Exile this card from your graveyard: Tap target creature an opponent controls..."

Payoffs (1 real, 9 weak):

- 1 Conspiracy Unraveler, real: "You may collect evidence 10 rather than pay the mana cost for spells you cast."
- 3 Otterball Antics, weak (only itself): "Flashback {3}{U}".
- 2 Ureni's Rebuff, weak (only itself): a bounce spell with harmonize.
- 2 Winternight Stories, weak (only itself): harmonize.
- 2 Constrictor Sage, weak (only itself): renew.

Not counted, though real: 2 Riptide Survivor ("When this creature is turned face up, discard two cards, then draw three cards."), 1 Teferi's Imp ("Whenever this creature phases out, discard a card."), 1 Torrential Gearhulk ("you may cast target instant card from your graveyard"). The pool also held 2 Stern Lesson ("Draw two cards, then discard a card."), 2 Rousing Read, and 1 Trickster Mage, none of which count.

Plays: 8 removal, all bounce or tuck. Curve peaks at 2 and 3. Wins with small fliers, Torrential Gearhulk, Conspiracy Unraveler.

**Verdict: partial.** The best Graveyard setup of the four, but the payoffs are flashback-style cards that need no setup and do not scale. Plays as a blue tempo deck.

### Black (bulk-black, B)

22 creatures, 10 sorceries, 4 other, 24 Swamps.

Setup (0 real, 9 rider, 1 wrong):

- 2 Hymn of the Faller, rider: "Surveil 1, then you draw a card and lose 1 life."
- 2 Mephitic Vapors, rider: "All creatures get -1/-1 until end of turn. Surveil 2."
- 2 Eyeblight Cullers, rider: a 5-drop; "When this creature dies, create three 1/1 green Elf Warrior creature tokens, then mill three cards."
- 1 Sanctum Lurker, rider: "When this creature enters, empower Jace 1." (a Jace token with "[-1]: Surveil 1", rule 701.71a)
- 2 Souls of the Lost, rider, dual: "As an additional cost to cast this spell, discard a card or sacrifice a permanent."
- 1 Unwilling Ingredient, wrong, dual (`graveyard-fuel-self`): "{2}{B}, Exile this card from your graveyard: You draw a card and you lose 1 life."

Payoffs (6 real, 5 weak, 1 wrong):

- 1 Beacon of Unrest, real: "Put target artifact or creature card from a graveyard onto the battlefield under your control."
- 1 Echoing Return, real: "Return target creature card and all other cards with the same name as that card from your graveyard to your hand."
- 2 Graveblade Marauder, real: "loses life equal to the number of creature cards in your graveyard."
- 2 Souls of the Lost, real but small: power "equal to the number of permanent cards in your graveyard".
- 1 Unforgiving One, weak: reanimates only up to "the number of modified creatures you control".
- 2 Demonic Vigor, weak: "When enchanted creature dies, return that card to its owner's hand."
- 1 Retrofitted Transmogrant, 1 Unwilling Ingredient, weak (only themselves).
- 1 Graveyard Trespasser, wrong: "exile up to one target card from a graveyard." A hate card.

Plays: 10 removal (Grim Bounty x3, Summon: Primal Odin x2, Skirsdag Flayer x2 and more). Fine curve. Wins with Phyrexian Obliterator and Odin.

**Verdict: no plan.** Not one card fills the graveyard as its main job. Plays as black removal midrange that sometimes recurs a creature.

### Green (bulk-green, G)

21 creatures, 12 instants and sorceries, 5 other, 22 lands.

Setup (4 real, 0 rider, 7 wrong):

- 1 Cache Grab, real: "Mill four cards. You may put a permanent card from among the cards milled this way into your hand."
- 1 Circle of the Land Druid, real: "When this creature enters, you may mill four cards."
- 2 Pothole Mole, real: "When this creature enters, mill three cards..."
- 3 Barishi, wrong, dual (`graveyard-fuel-self`): "When this creature dies, exile it, then shuffle all creature cards from your graveyard into your library."
- 3 Sylvan Hierophant, wrong as setup, dual: "When this creature dies, exile it, then return another target creature card from your graveyard to your hand."
- 1 Mother Bear, wrong as setup, dual: "{3}{G}{G}, Exile this card from your graveyard: Create two 2/2 green Bear creature tokens."

Payoffs (6 real, 1 weak, 4 wrong):

- 2 Chainweb Aracnir, real: escape by "Exile four other cards from your graveyard."
- 1 Soul Swallower, real: "if there are four or more card types among cards in your graveyard, put three +1/+1 counters on this creature."
- 3 Sylvan Hierophant, real: returns another creature card.
- 1 Mother Bear, weak (only itself).
- 3 Barishi, wrong: empties the graveyard of creatures.
- 1 Renewing Touch, wrong: "Shuffle any number of target creature cards from your graveyard into your library."

Not counted, though real: 1 Wildest Dreams ("Return X target cards from your graveyard to your hand."). The pool holds 3 Circle of the Land Druid; the deck plays 1, and 3 Barishi (picked as "Big threat"). Dual counting picked them: see cause 3 below.

Plays: 7 removal (fight spells). 22 lands plus 5 cheap mana sources. Wins with Barishi, Tyrranax Atrocity, and Nylea, which is a creature only at devotion to green 5 or more.

**Verdict: partial.** Both halves exist in small numbers, then 3 Barishi and Renewing Touch shuffle the graveyard away.

### White (white-bulk, W)

20 creatures, 12 instants and sorceries, 3 other, 25 Plains.

Setup (0 real, 10 rider):

- 3 Fear of Surveillance: "Whenever this creature attacks, surveil 1."
- 2 Starfighter Pilot: "Whenever this creature becomes tapped, surveil 1."
- 2 Owlin Historian (dual), 1 Shore Lurker: "When this creature enters, surveil 1."
- 1 Kinjalli's Dawnrunner: "When this creature enters, it explores."
- 1 Unsettling Twins: manifest dread, one card to the graveyard.

Payoffs (9 real, 3 weak):

- 3 Jolted Awake, real but small: returns a creature only if you can pay its mana value in energy, after getting two.
- 2 Dusk // Dawn, real: "Return all creature cards with power 2 or less from your graveyard to your hand."
- 1 Phoenix Down, 1 Rescue Skiff, 1 Savior of the Small, 1 Scout for Survivors, real: each returns a creature card from your graveyard.
- 2 Owlin Historian, weak: "Whenever one or more cards leave your graveyard, this creature gets +1/+1 until end of turn."
- 1 Starfall Invocation, weak: a wrath that returns one of the creatures it killed.

Plays: 8 removal. Fine curve. Wins with fliers.

**Verdict: no plan.** This is the owner's failure exactly: the counted setup is ten riders (eight surveil 1, one explore, one manifest dread), and the recursion runs only on creatures that die in combat.

### Pool or builder?

The four failures have different causes, and a fix to the builder alone would not mend all of them.

- **White: the pool lacks setup.** Nothing in white-bulk matches as Graveyard setup beyond surveil 1, explore and manifest dread. Possessed Goat and Splitskin Doll discard but do not count. The scan still calls 16 rider copies viable.
- **Black: little mill, and real setup left out.** The pool's only mill engine is 2 Morgue Thrull ("Sacrifice this creature: Mill three cards."). It counts as an enabler, but at strength 2.61 it sits below `themeMinStrength` 3, and the theme fill takes strong cards first (`builder.ts:755-764`). Riders are strong because their main job is removal or draw. Eyeblight Cullers (2.62) also sits below the bar and did make the deck, so the bar is not the whole story. The pool also holds 7 repeatable sacrifice outlets (3 Phyrexian Vault, 3 Dockside Chef, 1 Culling Dais) that put creature cards in the graveyard for Beacon of Unrest, Echoing Return and Graveblade Marauder. The Graveyard matchers do not count them (cause 2), and the deck plays none. The scan calls 14 rider-heavy copies viable.
- **Blue: real payoffs are thin in the pool.** Real setup is there. Real payoffs are 3 Conspiracy Unraveler (two allowed by the 60-card copy cap for cards of mana value 6 or more), 1 Makeshift Mauler and the 2 uncounted Torrential Gearhulk, so at most 5 copies against a minimum of 5. The deck plays 1 Unraveler and 1 Gearhulk and fills the rest with flashback cards.
- **Green: the builder skipped real setup.** The pool holds 6 real setup copies (3 Circle of the Land Druid, 2 Pothole Mole, 1 Cache Grab), enough with the deck's 6 real payoffs to meet the minimum. The deck plays 1 Circle and 3 Sylvan Hierophant, which outrank it on theme value (cause 3).

Commands: `node data/review/scratch/pool-tags.ts eval/pools/<pool>.txt <color> graveyard loot,rummage,discard-outlet,mill-self,graveyard-fuel-self,sacrifice-outlet-creature` and `node data/review/scratch/verify-themes/theme-cands.ts eval/pools/<pool>.txt <color> 60 graveyard`.

## Tokens

Minimums at 60: 8 setup, 4 payoffs.

### White (white-bulk, W)

21 creatures, 9 instants and sorceries, 5 enchantments, 25 Plains.

Setup (9 real, 11 rider):

- Real: 2 Anafenza, Unyielding Lineage (a token or counters "Whenever another nontoken creature you control dies"), 1 Dalkovan Packbeasts (Mobilize 3), 2 Dawn of Hope ("{3}{W}: Create a 1/1 white Soldier creature token with lifelink."), 1 Muster the Departed (dual), 1 Retreat to Emeria (dual), 1 The Crystal's Chosen (dual, "Create four 1/1 colorless Hero creature tokens."), 1 Born to Drive (dual, channel for two Pilot tokens).
- Rider: 4 Dragonback Lancer (Mobilize 1: one token, sacrificed at end step), 2 Gwaihir (a Bird only "if you gained 3 or more life this turn"), 1 Dion (dual, one Knight on enter), 1 Toby (dual, one 4/4 that "can't attack or block alone"), 1 Flowerfoot Swordmaster (dual, one offspring copy), 1 Rally the Monastery (one mode of three), 1 Sunset Revelry (tokens only "If an opponent controls more creatures than you").

Payoffs (10 real, 9 weak, 1 wrong):

- Real: 2 Coordinated Maneuver ("damage equal to the number of creatures you control"), 1 Thraben Charm ("twice the number of creatures you control"), 2 Shire Shirriff ("you may sacrifice a token. When you do, exile target creature"), 1 Starry-Eyed Skyrider ("Attacking tokens you control have flying."), 1 Retreat to Emeria, 1 The Crystal's Chosen, 1 Duty Beyond Death ("Put a +1/+1 counter on each creature you control."), 1 Born to Drive.
- Weak: 2 Seasoned Warrenguard, 1 Sunpearl Kirin, 1 Trostani's Judgment, 1 Muster the Departed, 1 Toby, 1 Dion, 1 Envoy of the Ancestors ("Modified creatures you control have lifelink."), 1 Valley Questcaller ("Other Rabbits, Bats, Birds, and Mice you control get +1/+1."; it pumps the 2 Seasoned Warrenguard, Flowerfoot Swordmaster, Gwaihir and Gwaihir's 3/3 Bird tokens, a tribe bonus more than a token payoff).
- Wrong: 1 Flowerfoot Swordmaster ("Mice you control get +1/+0"; only itself and its offspring copy are Mice).

Plays: 9 removal, most of it cheap. Wins with fliers and a wide board.

**Verdict: working.** Half the token makers are one-off or temporary, but the payoffs are cheap removal that counts creatures, so the plan shows up.

### Green (bulk-green, G)

21 creatures, 12 instants and sorceries, 7 enchantments, 20 lands plus 10 cheap mana sources.

Setup (8 real, 2 rider, 1 wrong):

- Real: 3 Dancing from Dark to Dawn ("Whenever a land you control enters, create a 2/2 green Bear creature token."), 2 Hatchery Sliver (replicate on itself), 2 Mother Bear (two Bears from the graveyard), 1 Scurry Oak.
- Rider: 1 Broodhatch Nantuko (tokens only when dealt damage), 1 Chatterstorm (one Squirrel plus storm, in a creature deck).
- Wrong: 1 Rampage of the Clans: "Destroy all artifacts and enchantments. For each permanent destroyed this way, its controller creates a 3/3..." The deck runs 7 enchantments.

Payoffs (0 real, 5 weak, 1 wrong):

- Weak: 3 Kyoshi Warrior Exemplars (team pump only "if you control eight or more lands", with 20 lands), 2 Nylea ("Other creatures you control have trample.").
- Wrong: 1 Bushmaster ("Each other creature you control with a +1/+1 counter on it has deathtouch.").

**Verdict: no plan.** Green stompy with some Bears and no reason to go wide.

### Red (bulk-red, R)

18 creatures, 13 instants and sorceries, 4 other, 25 Mountains.

Setup (5 real, 0 rider, 3 wrong):

- Real: 2 Draconic Visitor ("If one or more artifact tokens would be created under your control, that many 5/5 red Dragon creature tokens with flying are created instead."), 1 Skyline Despot (a Dragon each upkeep while monarch), 2 Thatcher Revolt ("Create three 1/1 red Human creature tokens with haste. Sacrifice those tokens...").
- Wrong: 3 Poetic Ingenuity ("Whenever you cast an artifact spell, create a 3/1 red Dinosaur"). The deck has one artifact spell.

Payoffs (2 real, 2 weak, 4 wrong):

- Real: 1 Goblin Wardriver (battle cry), 1 How to Start a Riot ("Creatures target player controls get +2/+0").
- Weak: 2 Draconic Visitor.
- Wrong: 1 Blur Sliver and 1 Heart Sliver (haste for Slivers), 2 Maze Rusher ("Multicolored creatures you control have haste." in a mono-red deck). All via `keyword-anthem`.

**Verdict: no plan for tokens.** Red removal midrange (11 removal). Draconic Visitor with the uncounted Treasure makers (Scuzzback Scrounger, Breeches) is a real engine, but not the one the theme count asked for.

## +1/+1 counters

Minimums at 60: 8 setup, 3 payoffs.

### Green (bulk-green, G)

Setup (10 real, 8 rider, 1 wrong):

- Real: 1 Dancing from Dark to Dawn ("put X +1/+1 counters on target creature you control, where X is that spell's mana value"), 2 Earthbender Ascension, 2 Forcemage Advocate ("Put a +1/+1 counter on target creature." as a tap ability), 2 Myojin of Towering Might (dual, "Distribute eight +1/+1 counters"), 1 Awakening of Vitu-Ghazi, 1 Wren's Run Hydra, 1 Scurry Oak (dual).
- Rider: 1 Battlegrowth (one counter), 2 Chainweb Aracnir (counters only when it escapes), 1 Fertilid (dual, two counters it spends on land searches), 2 Gnoll Hunter (pack tactics), 1 Soul Swallower (delirium), 1 Strength of Will (a trick).
- Wrong: 1 Ajani's Comrade ("if you control an Ajani planeswalker"; the deck has none).

Payoffs (2 real, 4 weak, 5 wrong):

- Real: 1 Bushmaster, 1 Scurry Oak ("Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 green Squirrel").
- Weak: 3 Laid to Rest ("Whenever a creature you control with a +1/+1 counter on it dies, you gain 2 life."), 1 Fertilid.
- Wrong, all via `counters-matter`, which covers any kind of counter: 1 Gavel of the Righteous (charge counters on itself), 2 Twitching Doll (nest counters on itself), 2 Myojin of Towering Might (an indestructible counter).

**Verdict: partial.** Plenty of counters, almost nothing that cares. Plays as green stompy with 7 fight spells.

### Black (bulk-black, B)

Setup (5 real, 9 rider, 2 wrong):

- Real: 2 Cruel Sadist (dual, "{B}, {T}, Pay 1 life: Put a +1/+1 counter on this creature."), 1 Strength Bobblehead, 2 Voracious Null.
- Rider: 4 Festercreep (dual, "This creature enters with a +1/+1 counter on it."), 2 Bloodlord of Vaasgoth (bloodthirst 3 on itself), 1 Endling (undying), 1 Lightless Evangel, 1 Retrofitted Transmogrant.
- Wrong: 2 Iron Monger (dual, "Whenever a creature you control connives..."; nothing in the deck connives).

Payoffs (2 real, 6 weak, 3 wrong):

- Real: 2 Delta Bloodflies ("if you control a creature with a counter on it, each opponent loses 1 life").
- Weak (only themselves): 4 Festercreep ("Remove a +1/+1 counter from this creature: All other creatures get -1/-1"), 2 Cruel Sadist.
- Wrong: 1 Chthonian Nightmare (energy counters), 2 Iron Monger.

**Verdict: no plan.** Half the setup copies are dual cards that only feed themselves.

## Aristocrats

Minimums at 60: 8 setup, 4 payoffs. Setup is one count with one minimum that lumps sacrifice outlets (enabler clause 0 in `config/archetypes.json`) and fodder (clause 1: token makers, `multiple-bodies`, creatures with their own death trigger). A deck can meet "setup" with fodder alone and no outlet.

### Black (bulk-black, B)

Setup (17 real, 4 rider):

- Real outlets: 3 Phyrexian Vault ("{2}, {T}, Sacrifice a creature: Draw a card."), 2 Dockside Chef, 1 Culling Dais, 2 Skirsdag Flayer (Humans only), 2 Chthonian Nightmare (sorcery speed, needs energy).
- Real fodder: 2 Eyeblight Cullers, 2 Death's-Head Buzzard, 2 Dark Salvation, 1 Endling.
- Rider: 2 Minister of Pain (exploit once), 2 Souls of the Lost (a sacrifice as a casting cost).

Payoffs (1 real, 3 weak):

- Real: 1 Lightless Evangel ("Whenever you sacrifice another creature or artifact, put a +1/+1 counter on this creature.").
- Weak: 2 Malefic Scythe (soul counters when the equipped creature dies), 1 Phyrexian Vivisector ("Whenever a creature you control dies, scry 1.").

**Verdict: partial.** A real engine that turns creatures into cards, with 11 removal. The draw outlets are the deck's real payoff, but they count only as setup, so the builder sees 4 payoffs where there is nothing that drains or grows.

### White (white-bulk, W)

Setup (12 real, 7 rider):

- Real fodder: 3 Curious Farm Animals ("When this creature dies, you gain 3 life."), 2 Anafenza (dual), 1 Archon of Justice, 2 Dawn of Hope, 1 Murder Investigation, 1 Muster the Departed.
- Real outlet, the only repeatable one: 2 Vengeful Villagers ("Whenever this creature attacks... you may sacrifice an artifact or creature.").
- Rider: 1 Duty Beyond Death (a sacrifice as a cost), 1 Dion, 1 Essence Channeler, 2 Gwaihir, 1 Rally the Monastery, 1 Reluctant Role Model.

Payoffs (3 real, 1 weak):

- Real: 2 Anafenza, 1 G'raha Tia ("Whenever one or more other creatures and/or artifacts you control die, draw a card.").
- Weak: 1 Carrot Cake (cares only about sacrificing itself).

**Verdict: no plan.** Lots of fodder and no way to sacrifice it except on attack. Plays as white removal midrange (12 removal).

### Green (bulk-green, G)

Setup (7 real, 0 rider, 3 wrong):

- Real fodder only: 3 Dancing from Dark to Dawn, 2 Hatchery Sliver, 2 Sylvan Hierophant.
- Wrong: 1 Capenna Express ("Sacrifice a Treasure: This Vehicle becomes an artifact creature"), 1 Gilded Goose ("{T}, Sacrifice a Food: Add one mana"), 1 Barishi.

Payoffs (1 real, 3 weak): 1 Gardenize (mana from creature deaths), 3 Laid to Rest.

**Verdict: no plan.** The deck has no way to sacrifice a creature at all. The outlet tags matched Treasure and Food outlets, and the fodder alone met the setup minimum. White came close to the same: its only repeatable outlet is 2 Vengeful Villagers, on attack.

## Lifegain

Minimums at 60: 8 setup, 3 payoffs.

### White (white-bulk, W)

Setup (8 real, 6 rider, 1 wrong):

- Real: 1 Danitha Capashen (lifelink), 2 Dawn of Hope (dual, lifelink tokens), 1 Lifecreed Duo ("Whenever another creature you control enters, you gain 1 life."), 1 Gilraen, 1 Abzan Battle Priest, 1 Envoy of the Ancestors, 1 Reluctant Role Model.
- Rider: 3 Sonar Strike (removal; "You gain 3 life if you control a Bat." The deck has five Bats), 1 Curious Farm Animals, 1 Momo, Playful Pet, 1 Field-Tested Frying Pan (dual, one Food).
- Wrong: 1 Aang ("Whenever you cast a Lesson spell, Aang gains lifelink"; no Lessons in the deck).

Payoffs (6 real, 1 weak): 2 Dawn of Hope ("Whenever you gain life, you may pay {2}. If you do, draw a card."), 1 Essence Channeler, 1 Field-Tested Frying Pan, 2 Gwaihir; weak 1 Star Charter ("if you gained or lost life this turn").

**Verdict: working.**

### Black (gold-heavy-black, B)

Setup (4 real, 11 rider):

- Real: 1 Gifted Aetherborn ("Deathtouch, lifelink"), 1 Thirsting Shade, 1 Scrounger of Souls, 1 Melancholic Poet.
- Rider: 3 Moment of Craving ("Target creature gets -2/-2 until end of turn. You gain 2 life."), 2 Mire Triton, 1 Virtue of Persistence (its adventure gains 2), 1 Vicious Rumors, 1 Blessing of Belzenlok (lifelink only on a legendary), 1 Silverquill Pledgemage, 1 Raven Eagle (needs a second draw each turn), 1 Valley Rotcaller ("the number of other Squirrels, Bats, Lizards, and Rats you control"; the deck has one).

Payoffs (3 real, 1 weak): 1 Starscape Cleric ("Whenever you gain life, each opponent loses 1 life."), 2 Gollum, Obsessed Stalker; weak 1 Foolish Fate (an Infusion rider on removal).

**Verdict: partial.** The Graveyard pattern on Lifegain: 11 of 15 setup copies are riders, mostly on removal. Unlike surveil 1, a rider gain still triggers Starscape Cleric once, so the deck limps rather than fails.

## Spellslinger

Minimums at 60: 14 setup, 5 payoffs. Setup is every instant and sorcery, so it cannot be a rider.

### Red (bulk-red, R)

Setup: 19 instants and sorceries, mostly cheap removal. Two do little beyond triggering payoffs: 3 Telim'Tor's Edict ("Exile target permanent you own or control.") and 2 Involuntary Employment.

Payoffs (6 real, 1 weak): 3 Chandra's Emberling ("Whenever you cast a noncreature spell, put a +1/+1 counter on this creature."), 2 Tome Shredder, 1 Pompous Battlemage (prowess); weak 1 Tablet of Discovery (mana for instants and sorceries).

Plays: 12 removal, average cost 2.3, only 2 finishers against a target of 4.

**Verdict: working,** though short on a closer.

### Blue (bulk-blue, U)

Setup: 21 instants and sorceries, mostly bounce and counters. Narrow ones: 2 Flusterstorm ("Counter target instant or sorcery spell unless its controller pays {1}."), 1 Narset's Reversal.

Payoffs (4 real, 1 weak, 2 wrong):

- Real: 1 Poppet Stitcher ("Whenever you cast an instant or sorcery spell, create a 2/2 black Zombie creature token with decayed."), 1 Soulblade Djinn, 2 Torrential Gearhulk.
- Weak: 1 Starfleet Spanner Jockey (a defender that can attack after a noncreature spell).
- Wrong: 1 Ichormoon Gauntlet ("choose a counter on target permanent. Put an additional counter of that kind"; the deck has no planeswalker and almost no counters), 1 Map to Lorthos's Temple (its quest needs a Merfolk; the deck has none).

**Verdict: partial.** Blue control with few payoffs. Playable, but the theme is thin.

## Artifacts

Minimums at 60: 10 setup, 4 payoffs. Setup is every artifact plus repeatable artifact token makers.

### Blue (bulk-blue, U)

Setup: 14 artifacts. Several do little here: 3 Idol of Oblivion ("{T}: Draw a card. Activate only if you created a token this turn." with one token maker), 1 H.M.S. Bounty (searches for a Whale), 1 Ichormoon Gauntlet, 1 Codex Shredder.

Payoffs (5 real, 4 weak, 2 wrong):

- Real: 3 Etherium Sculptor (dual, "Artifact spells you cast cost {1} less to cast."), 2 Workshop Elders ("Artifact creatures you control have flying." and animates an artifact with four counters, at 7 mana).
- Weak: 1 La Forge, 1 Map to Lorthos's Temple, 1 Mightstone's Animation, 1 Sentinel of the Pearl Trident.
- Wrong: 2 Reality Ripple ("Target artifact, creature, or land phases out."), tagged `synergy-artifact` because it can target an artifact.

**Verdict: partial.** Meets the honest minimum, but the plan only arrives with a 7-mana creature.

### Red (bulk-red, R)

Setup: 13. Real Treasure engines: 2 Scuzzback Scrounger (a Treasure each turn after blight 1), 2 Breeches, 3 Poetic Ingenuity (dual). Plus 2 Fiendlash, Kree Sentinel, Strength-Testing Hammer, Tablet of Discovery, and Ring of Thune (vigilance only; its counter needs a white creature).

Payoffs (9 real, 2 weak):

- Real: 2 Draconic Visitor (each Treasure becomes a 5/5 flier), 3 Poetic Ingenuity ("Whenever you cast an artifact spell, create a 3/1 red Dinosaur creature token."), 2 Goblin Tomb Raider ("As long as you control an artifact, this creature gets +1/+0 and has haste."), 1 Destructive Digger, 1 Scrap Welder.
- Weak: 2 Bladegraft Aspirant (cheaper Equipment).

**Verdict: working.** Scuzzback Scrounger plus Draconic Visitor turns a Treasure a turn into a 5/5 flier.

## Landfall

Minimums at 60: 6 setup, 5 payoffs.

### Green (bulk-green, G)

Setup (9 real, 2 rider, 1 wrong):

- Real: 3 Rites of Flourishing ("Each player may play an additional land on each of their turns."), 4 Earthbender Ascension (dual, one land on enter), 1 Fertilid, 1 Summon: Fenrir.
- Rider: 1 Migratory Greathorn (only when it mutates), 1 Rampant Rejuvenator (lands when it dies).
- Wrong: 1 Loam Dweller ("Whenever you cast a Spirit or Arcane spell"; it is the deck's only Spirit).

Payoffs (5 real, 7 weak): 4 Dancing from Dark to Dawn (a Bear per land), 1 Skyclave Pick-Axe (+2/+2); weak 3 Attercop (+1/+1 until end of turn), 4 Earthbender Ascension (slow quest).

Two calls here are close: Earthbender Ascension and Summon: Fenrir put one basic land onto the battlefield once, and Skyclave Pick-Axe is a temporary pump per land like Attercop. Calling them rider and weak drops this deck below both honest minimums (see "How firm the honest count is").

**Verdict: working,** and slow. Landfall payoffs also fire on normal land drops, so thin setup hurts less here than in Graveyard.

### Green (creatures-only-green, G)

37 creatures, 23 lands. The pool is creatures only by design.

Setup (3 real, 3 rider): real 2 Oashra Cultivator ("Sacrifice this creature: Search your library for a basic land card, put it onto the battlefield tapped"), 1 Aftermath Analyst; rider 2 Bramble Familiar (a mana creature; its adventure may put a milled land onto the battlefield), 1 Tato Farmer (dual).

Payoffs (5 real, 1 weak): 2 Undergrowth Champion, 1 Boughside Wanderers, 2 Ancient Greenwarden ("You may play lands from your graveyard." and landfall triggers of your permanents trigger an additional time); weak 1 Tato Farmer. Tato Farmer's landfall gives you two rad counters if you choose. Under rule 728.1 they mill you at your precombat main phase, and you lose 1 life and remove a counter only for each nonland card milled. Its tap ability puts a land card milled this turn onto the battlefield, another landfall trigger. So the rad counters feed its own land engine: self-contained, not anti-synergy.

Plays: no cheap interaction (0 of 4), 5 removal.

**Verdict: partial.** Meets the builder's minimums exactly, mostly by accident of creature tags.

## Enchantments

Minimums at 60: 10 setup, 3 payoffs. Setup is every enchantment.

### Green (bulk-green, G)

Setup: 16 enchantments, all real for this theme (3 Bonds of Mortality, 3 Dancing from Dark to Dawn, 2 Nylea, 2 Seal of Strength, and others).

Payoffs (3 real, 4 weak): 2 Verduran Enchantress ("Whenever you cast an enchantment spell, you may draw a card."), 1 Sanctum Weaver (dual, mana equal to "the number of enchantments you control"); weak 4 Nexus Wardens ("Whenever an enchantment you control enters, you gain 2 life.").

**Verdict: working,** at low power.

### White (white-bulk, W)

Setup: 17 enchantments, including removal (3 Banishing Light, 1 Static Prison).

Payoffs (6 real, 3 weak, 1 wrong):

- Real: 3 Optimistic Scavenger ("Whenever an enchantment you control enters..., put a +1/+1 counter on target creature."), 1 Blessed Spirits, 1 Ghostly Dancers ("create a 3/1 white Spirit creature token with flying"), 1 Michiko's Reign of Truth.
- Weak: 1 Cult Healer, 1 Harvestguard Alseids, 1 Danitha Capashen (cheaper Auras and Equipment).
- Wrong: 1 Southern Air Temple (counters "where X is the number of Shrines you control").

**Verdict: working.**

## Voltron

Minimums at 60: 8 setup, 4 payoffs. Setup is every Equipment and non-removal Aura, plus Equipment and Aura tutors and `pseudo-equipment` cards (`config/archetypes.json`, `auras` enabler clause 2).

### Red (bulk-red, R)

Setup: 10 real (3 Samurai's Katana, 2 Dwarven Hammer, 2 Fiendlash, 2 Coral Sword, 1 Tilonalli's Crown).

Payoffs: 6 real (3 Dwarven Mauler, "Equip abilities you activate that target this creature cost {2} less to activate."; 2 Bladegraft Aspirant; 1 Myr Adapter, "+1/+1 for each Equipment attached to it").

**Verdict: working.** 13 removal as well.

### White (white-bulk, W)

Setup (9 real, 3 rider): 2 Ethereal Armor, 2 Paladin's Arms, 2 White Mage's Staff, 2 Field-Tested Frying Pan, 1 Crystal Fragments; rider 2 Honored Knight-Captain (an Equipment tutor at six mana and a sacrifice), 1 Relic Seeker (a tutor on renown).

Payoffs (10 real, 2 weak): 4 Slash of Light ("damage equal to the number of creatures you control plus the number of Equipment you control"), Adelbert Steiner, Danitha Capashen, Envoy of the Ancestors, Master Piandao, Shrike Force (double strike), Weapons Vendor; weak 1 Guardian of the Forgotten, 1 Flowerfoot Swordmaster (tagged `heroic`: valiant triggers when an equip or Aura targets it, and it pumps Mice, which here means only itself and its offspring copy).

**Verdict: working.**

## What this shows

**Cause 1, broad tags count riders as setup: generalizes.** Rider copies among counted setup: Graveyard 21 of 41, Lifegain 17 of 30, +1/+1 counters 17 of 35, Tokens 13 of 39, Aristocrats 11 of 50, Landfall 5 of 18, Voltron 3 of 22. The shapes repeat: removal that gains 2 life (`lifegain`), a creature that makes one token on entering (`multiple-bodies`), a creature that makes one temporary attacker (Mobilize 1, through `repeatable-creature-tokens`), a creature that puts a counter only on itself (`gains-pp-counters`), a one-shot exploit or sacrifice-as-cost (`sacrifice-outlet-creature`), an Equipment tutor at six mana or behind renown (`tutor-artifact-equipment`). For Spellslinger, Artifacts and Enchantments my method makes every counted card real, so it cannot find riders there.

**A wider version of cause 1: tags that mean something else.** Every one of the 10 wrong Graveyard setup copies comes from `graveyard-fuel-self`, which marks cards that use themselves up from the graveyard (renew, a self-exile cost) or empty it (Barishi). It is counted as setup. On the payoff side, `counters-matter` matches charge, nest, energy, and indestructible counters (8 of 22 counter payoffs are wrong, 6 of them through this tag); `keyword-anthem` matches haste for Slivers or multicolored creatures; `synergy-artifact` matches a spell that can target an artifact; the Aristocrats outlet tags match Treasure and Food outlets; `synergy-enchantment` matches a Shrine card.

**Cause 2, real setup left out: confirmed for Graveyard, mirrored in Aristocrats.** In the blue pool, loot and discard cards (Riptide Survivor, Teferi's Imp, Stern Lesson, Rousing Read, Trickster Mage) do not count; the builder played some of them for card advantage. In the black pool, 7 repeatable sacrifice outlets that fill the graveyard with creature cards do not count either, and the Graveyard deck plays none of them. In Aristocrats, the draw outlets that are that deck's real payoff count only as setup, so a deck with one real payoff reports four. I did not check every other theme for left-out setup.

**Cause 3, dual counting: generalizes.** Dual copies: Graveyard 16, +1/+1 counters 12, Tokens 9, Artifacts 6, Landfall 5, Enchantments 4, Lifegain 3, Aristocrats 2. In the failing themes the duals are mostly self-contained loops (Festercreep, Cruel Sadist, Barishi, Mother Bear, Constrictor Sage) that count twice and feed nothing else. In the healthy themes the duals are fine (Etherium Sculptor, Poetic Ingenuity, Sanctum Weaver). Dual counting also picks cards inside the role passes. Every pass picks with `pickBest`, which after the curve gap check breaks ties first by theme value and only then by strength (`builder.ts:689-694`; `tiebreaks: [themeTagHits, strength, lowerMv, name]` in `config/builder-weights.json`). Theme value is 1 for an enabler, 1 for a payoff and 2 for a dual card (`builder.ts:1374`). The "why" label only names the pass. From `verify-themes/role-cands.ts`:

- Green finisher pass: Barishi (strength 3.58, theme value 2) beats Bag End Porter (3.63, 0) and Kyoshi Warrior Exemplars (3.60, 0) at mana value 4. That is how 3 Barishi became "Big threat".
- Green early-creature pass: 3 Sylvan Hierophant (3.55, value 2) rank ahead of Circle of the Land Druid (3.74, value 1). That explains why the deck plays only 1 of 3 Circle, real setup lost to a "wrong" dual card.
- Blue finisher pass: Constrictor Sage (2.99, value 2) is the "Big threat" over Summon: Valefor (7.38), Smirking Spelljacker (5.77) and Djinn of Wishes (3.94) at the same mana value.

**The builder turns broad tags into picks.** The matchers decide which cards count; these code paths then push the counted cards in and keep them:

- the theme tiebreak above;
- the swap objective's `themeHit` term, 0.3 per point of theme value, the same weight as a point of card strength, so a dual card is worth 0.6 (`builder.ts:524`, `config/builder-weights.json`);
- the learned fill, `fillThemeTarget`, which fills the theme past its minimum toward a target learned from real decks (`builder.ts:787-808`, `fillToTarget: true`);
- the swap guard, which forbids a swap that takes a theme card out while the count is below the larger of the minimum and the learned target (`builder.ts:1001-1013`, `1436-1441`);
- the hand-written synergy rules, which reuse the same broad tags: `tokens-pump` is identical to the Tokens matchers, and the `graveyard` rule counts `mill-self` and `graveyard-fuel-self` as enablers. With learned data attached they count at a quarter weight (`rules: 0.25`).

The learned targets at 60, for 35 or 36 spell slots (24 or 25 lands), from `verify-themes/targets.ts`:

| Style        | Minimums: enablers / payoffs | Learned target: enablers / payoffs |
| ------------ | ---------------------------- | ---------------------------------- |
| Graveyard    | 6 / 5                        | 8 / 10                             |
| Spellslinger | 14 / 5                       | 19 / 13                            |
| Counters     | 8 / 3                        | 16 / 6                             |
| Lifegain     | 8 / 3                        | 13 / 4                             |
| Artifacts    | 10 / 4                       | 13 to 14 / 10 to 11                |
| Enchantments | 10 / 3                       | 17 / 7 to 8                        |

Tokens, Aristocrats, Voltron and Landfall have no learned target, so only their minimums apply. These targets explain counts far above the minimums. The blue Spellslinger deck took all 7 payoffs the scan found in the pool, Ichormoon Gauntlet and Map to Lorthos's Temple among them, because its target is 13 or more. The blue Graveyard deck holds exactly 10 payoffs, its target, so the swap guard blocks any swap that would take out a payoff such as Constrictor Sage for a non-payoff.

**New: a theme card's type or tribe condition is not checked against the deck.** The code does check a few conditions: it drops cards that need a commander outside Commander (`needsCommander`, `matchers.ts:181`), cards with `{C}` pips (`candidates.ts:198`), and styles outside their colors (`scan.ts:104`). It does not check what a theme card needs from the rest of the deck. 10 counted copies cannot do their counted job in their deck: Ajani's Comrade with no Ajani, Aang with no Lessons, 2 Iron Monger with nothing that connives, Loam Dweller with no other Spirits, 2 Maze Rusher in mono red, Blur Sliver and Heart Sliver as token payoffs (they give haste to each other, but the deck makes no Sliver tokens), Map to Lorthos's Temple with no Merfolk. 3 Poetic Ingenuity can do theirs at most once, when the deck's one artifact spell, Tablet of Discovery, is cast. Role picks have the same gap: Nylea, God of the Hunt is not a creature below devotion to green 5, yet it fills the finisher role in the green Graveyard and Tokens decks.

**New: anti-synergy counts as theme.** Barishi (x3) and Renewing Touch shuffle the graveyard away yet count as Graveyard cards. Rampage of the Clans counts as a token maker in a deck with 7 enchantments it would destroy.

**New: self-contained payoffs.** 9 of 10 blue Graveyard payoffs are flashback, harmonize, or renew cards that need no setup and do not scale. Self-counter cards fill the counters payoff slots the same way.

**Cause 4, inherited flaws: confirmed from the code, not by new runs.**

- The viability scan passes all 24 decks, including the 14 that miss the honest minimum, because it counts the same way.
- With learned data attached, the deck score that ranks the options is mostly closeness to real decks of the plan (`builder.ts:1172-1189`). Two of its features, `theme enablers` and `theme payoffs`, are the deck's enabler and payoff copies over its spells (`builder.ts:1103-1104`). These are the same matchers, with dual cards counted on both sides (`builder.ts:418-419`).
- The learned profile penalty in the swap objective uses the same tallies (`builder.ts:534-535`).

**Healthy themes.** Voltron (both), Artifacts in red, Enchantments (both), Spellslinger in red, Lifegain and Tokens in the large white pool, and Landfall in bulk-green. What they share: setup is a card type, lands entering, or an explicit "whenever you cast" or "create a token" effect, and payoffs read "for each", "whenever you cast" or "whenever a land enters". Themes that need an engine (Graveyard, Aristocrats, +1/+1 counters) fail most, and Tokens fails in the small pools.

**What this sample cannot rule out.** It does not show that the failures are only plan failures:

- Color sources are never tested. All 24 decks are one color with basics only (`0 nonbasic` in every land note).
- Land counts were not examined. 8 decks run 25 lands at an average cost of 2.7 to 3.1 with 0 or 1 cheap mana sources; the green decks run 20 to 23 lands with many mana creatures.
- "Interaction" here is the builder's own removal role tag, the same kind of tag count this document distrusts for themes. By that count removal meets the 60-card target of 7 in 19 of 24 decks and is never below 5, and only the creatures-only pool lacks cheap interaction. I did not read the removal the way I read the theme cards. For example, Skirsdag Flayer counts as removal, but each use costs four mana, a tap and a Human, often itself.
- Curves peak at 2 and 3.

The `note: N lands` lines are in `data/review/scratch/themes/*.demo.txt`.

## Scratch files

All gitignored, under `data/review/scratch/`:

- `theme-members.ts`: builds a requested-style deck the way `demo:build` does, then prints each card's mana value, type line, oracle text, tags, and which enabler and payoff clauses of the style it meets.
- `compact.awk`: a short view of an inspector file, with theme cards in full and other cards on one line each.
- `pool-tags.ts`: lists a pool's cards in a deck's colors that carry given tags, with their membership for one style.
- `themes/<pool>-<color>-60-<style>.txt`: inspector output for each of the 24 decks. `themes/*.demo.txt`: the matching `demo:build` output.
- `verify-themes/` (from the fact check): `role-cands.ts` lists a role's candidates with strength, curve bucket and theme value; `theme-cands.ts` lists a pool's enablers and payoffs for one style with strength; `targets.ts` prints the minimums and learned theme targets; `scans/` holds the 60-card scans of all eight pools.
