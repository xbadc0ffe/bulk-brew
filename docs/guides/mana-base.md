# Mana base

How many lands a deck runs and which nonbasics make the cut. Feeds the `landFormula` in `config/deck-templates.json` and `config/land-rules.json`.

## The land formula

A fixed land count is wrong for half the decks. A deck full of two-drops floods on 24 lands; a deck of five-drops with no ramp stumbles on 22. The formula starts from a base, moves with the average mana value of the spells, and gives credit for cheap mana sources, fitted to how land counts scale with curve in practice:

```
lands = round(clamp(base + slope * (averageMv - referenceMv) - credits, min, max))
```

Average mana value is over nonland spells, with zero-cost spells counted at their printed cost. Credits are summed per card:

| Source                             | 60   | 40   | 20   |
| ---------------------------------- | ---- | ---- | ---- |
| Mana rock costing 2 or less        | 0.50 | 0.35 | 0.20 |
| Mana rock costing 3                | 0.30 | 0.20 | 0.10 |
| Mana creature costing 2 or less    | 0.40 | 0.30 | 0.15 |
| Mana creature costing 3            | 0.25 | 0.20 | 0.10 |
| Land fetch spell costing 3 or less | 0.50 | 0.35 | 0.20 |
| Modal card with a land face        | 0.60 | 0.50 | 0.30 |

Dorks earn less than rocks because they die to removal and cannot attack when tapped for mana. A dork still counts as a one- or two-drop creature in the curve.

| Size | Base | Reference mv | Slope | Clamp    |
| ---- | ---- | ------------ | ----- | -------- |
| 60   | 25   | 2.9          | 2.0   | 20 to 27 |
| 40   | 17   | 3.0          | 1.3   | 15 to 18 |
| 20   | 8    | 2.6          | 0.7   | 7 to 9   |

Worked examples:

- 60-card midrange, average mv 2.6, two one-drop dorks: 25 + 2.0 × (2.6 − 2.9) − 0.8 = 23.6, so 24 lands.
- 60-card control, average mv 3.4, no ramp: 25 + 2.0 × 0.5 = 26 lands.
- 40-card aggro, average mv 2.5: 17 + 1.3 × (−0.5) = 16.35, so 16 lands.
- 40-card midrange, average mv 3.1, one cheap dork: 17 + 0.13 − 0.3 = 16.83, so 17 lands.
- 20-card packet, average mv 2.4: 8 − 0.14 = 7.86, so 8 lands. A packet averaging 3.5 gets 9.

Preconstructed 60-card decks run 25 lands in the middle (24 to 25 for the middle half) at an average cost of about 3.0, and builds from a base of 24 came out one to two lands short of them, so the base is 25.

The builder picks spells first with the base count reserved, computes the formula on what it chose, then adjusts the spell count if the land count moved. Rounding is to the nearest whole number, halves up.

## Basics

Basics are unlimited by default, so the user never imports them. The deck lists them by color name from `land-rules.json`. With unlimited basics off, the pool's basic count caps the deck and the builder reports a shortfall.

## Nonbasic lands

In a one-color deck a nonbasic takes the place of a basic, so it is scored against that basic, which scores 0. Making the deck's color, or any color, gains nothing over a basic. Entering tapped costs nothing: a dual land that enters tapped stays out because its second color does nothing here, not because it is tapped, and a tapped land that does something is judged on what it does. The other costs count:

| Factor                                                              | Score         |
| ------------------------------------------------------------------- | ------------- |
| Pays life each time it taps for the deck color (painlands)          | −1.0 per life |
| A drawback (Tagger `drawback`, or sacrificing a land to play it)    | −1.0          |
| Makes only mana of other colors                                     | −2.0          |
| Makes only colorless mana                                           | −0.5          |
| An ability that works in this deck                                  | +1.0          |
| An ability the deck's plan uses (its theme job, or `mono.planTags`) | +2.0          |

Both gains need a land whose color identity fits the deck, since an ability that asks for another color's mana does nothing there, and an ability the card needs reader finds earned in the deck (Trenzalore Clocktower's needs a Time Lord). Text that does nothing a basic does not is not an ability: fetching a basic land (a fetch land, a Panorama, landcycling), a rainbow or storage land's own mana (Gemstone Mine's counters, Aether Hub's energy, Bottomless Vault's storage counters), making every land a Swamp (Urborg, Tomb of Yawgmoth), keeping the land safe (Indestructible), returning it to hand, a cost such as a painland's damage, and "no maximum hand size", which matters in Commander only. The plan gain needs an ability the land keeps, which does a setup or payoff job of the deck's style in `theme-rules.json` (Secluded Starforge's tokens for Tokens) or has one of its `mono.planTags` (Rogue's Passage's "can't be blocked" for Evasion): a one-time "When this land enters, surveil 1" is a rider, not a plan, while Dakmor Salvage's dredge works every turn. A colorless land costs the deck a source of its color, so only the plan gain pays for it: Rogue's Passage in Evasion, Eden in Graveyard, a creature land such as Mutavault in Aggro, Midrange, or Control (`creatureland`, or text that makes the land a creature, so Treetop Village counts too), an artifact land such as Darksteel Citadel in Artifacts (a land with no ability does a style's job by its types), and not Reliquary Tower or Ghost Quarter in a deck without such a plan. A land gets in only at 0.25 or more, that is, when it is better than the basic. So Realm of Koh makes Spirit tokens that are hard to block, +1.0, Bojuka Bog exiles a graveyard as it enters, +1.0, and Treetop Village is a utility land in any deck and a plan land in Aggro. A dual land or a land that only picks a color (a Gate, Shimmerdrift Vale), a painland with a small upside, or a land whose ability needs a plan the deck does not have stays out. Dakmor Salvage is +1.0 for its dredge, and +2.0 in a Graveyard deck, where dredge feeds the plan. Lands whose mana depends on a draft (Paliano, the High City) never enter a mana base.

**Conditional tapped lands.** The card data marks a land as entering tapped whenever its text says so, conditions and all, so the builder reads the condition against the deck. "Unless you control a Swamp" (or a basic land) reads as almost never tapped (15%) when the deck runs Swamps and always tapped when it does not. Conditions on land counts read against a typical game's land drops (6 at 60 and 40 cards, 7 in Commander, 4 at 20): "unless you control two or more other lands" is tapped on the first two of them, "two or fewer other lands" from the fourth on. "Unless you have two or more opponents" is untapped in Commander only. "You may pay 2 life" is a life cost instead of a tapped land. "You may reveal a Swamp card" is tapped 30% of the time when the deck runs Swamps. A condition the builder does not know reads as always tapped. The numbers are `landRules.entering`.

Nonbasics take at most 40% of the land count, and colorless-only lands are capped at 2 in 60 cards, 1 in 40, none in a 20-card half, and 4 in Commander (`mono.maxColorlessOnly`), because a mono-color deck that cannot cast its spells on time loses to its own mana base. Within the allowed share the highest scores go in, on a tie the land less likely to enter tapped first, then the more played one, and basics fill the rest.

In Replace, a basic of a color a nonbasic land makes is a valid replacement for it, and in a one-color deck it ranks above any land worse than it.

## Multi-color decks

A deck of two to five colors has a main color (the one its candidates lean on most) and secondary colors; a color carrying less than 35% of the main color's weight is a splash (`landRules.colors.splashShare`).

The colors are access, not a quota. Nothing splits the spells evenly between them: the builder picks for the style and the curve, the castability costs below push it toward the main color, and the lands follow the pips the chosen spells ask for. The per-color minimum is a floor so that a deck named for a color holds some of it, not a target.

**Picking spells.** Spells that strain the mana lose card strength points while the builder picks (`builderWeights.castability`): each pip of a secondary color costs 0.25, a double pip of one 0.75 more, and a secondary pip on a one- or two-drop 0.4 more. Splash pips cost 0.6 each, with 2 more for a double pip and 1 more for an early play. Each color must also hold at least 4, 3, or 2 spells in a 60, 40, or 20-card deck, and 8 in a Commander deck (`minCardsPerColor`).

**How many sources a color wants.** For every spell, the builder works out how many lands of that color it needs to cast the spell on curve, given the deck made its land drops. The target chance is 90% for the main color, 85% for secondary colors, and 75% for a splash (`castChance`). The want is the fewest sources that do this for a share of the color's spell copies (`sourceCover`): 80% at 60 cards, 55% at 40, 65% in Commander, and all of them at 20. The most demanding few may wait a turn, as they do in real decks. A Commander deck's commander counts as one of its copies.

The shares are fitted to the reference corpus by `npm run sources:fit`, on the train split: real multi-color decks from 2015 on (the selection `corpus:eval` uses), each measured by its worst color, the commander among its spells. Each share is the strictest, in steps of 0.05, at which the median deck falls short in none of its colors. When the most demanding spell set the want, the median deck fell 2 sources short at 60, 3 at 40, and 11 in Commander, and 82%, 96%, and 100% of them were short. With the fitted shares, 35%, 49%, and 40% are (test split: 29%, 49%, and 35%). The 20-card packets already met the old rule (25% short), so 20 keeps it. Older 60-card precons run fewer sources: counting every year, 0.65 would be needed at 60.

The share counts whole copies, rounded up, so a color with two copies covers both. The math is a hypergeometric draw over the deck, the lands, and the sources; some values at 90%, on the play:

| Deck               | One pip turn 1 | One pip turn 2 | One pip turn 3 | Two pips turn 2 | Two pips turn 3 | Two pips turn 4 |
| ------------------ | -------------- | -------------- | -------------- | --------------- | --------------- | --------------- |
| 60 cards, 24 lands | 15             | 13             | 11             | 20              | 17              | 15              |
| 40 cards, 17 lands | 10             | 9              | 7              | 14              | 12              | 10              |

So two colors work on basics when double pips stay in the main color, and three or more colors need fixing or a light splash.

**Which lands count.** A land is a source of a color when it taps for that color directly: from its basic land types, or from an ability that costs only {T} (life payments are fine) and does not limit what the mana may be spent on. Filter lands ("{1}, {T}: Add one mana of any color"), restricted mana, mana that costs a sacrifice ("{T}, Sacrifice this land: Add one mana of any color"), and mana that depends on other permanents ("any color among legendary permanents you control") do not count. Mana that is "Activate only if you control a Swamp or a Mountain" counts when the deck runs one of those basics. A land that fetches a basic counts for every deck color it can find, but only once the deck holds a basic of that color, and only in multi-color decks; a mono-color deck does not use it, since a basic does the same job without the slow turn. Lands and rocks that work only with a commander (Command Tower, Arcane Signet) are never candidates outside Commander.

**Choosing lands.** Nonbasics score +2 for making a deck color, +1.5 for each further deck color, and +1 for a utility ability; entering tapped costs only 0.5 in a multi-color deck, where fixing is worth a slow turn, times the chance it enters tapped read as above (so a check land of the deck's colors costs almost nothing). Lands scoring below 0.5 stay out. Nonbasics may take up to 60%, 70%, 75%, or 80% of the lands for two to five colors, and lands that enter tapped (fetch lands included) at most 25%, 35%, 40%, or 45%, each copy counting its chance to enter tapped. Basics then go one at a time to the color furthest below its want; once every color has what it wants, to the color furthest below what all of its copies need (the split as it was before the want was fitted to real decks); and once every color has that, by colored pips. The deck notes list each color's sources and say when a color is stretched.

## Modal cards with a land face

A modal double-faced card whose back is a land counts as a land in the mana base and still sits in the spell curve. It earns the credit above because it is a land when needed and a spell when not. Transforming cards do not get this treatment; their back face is never cast.
