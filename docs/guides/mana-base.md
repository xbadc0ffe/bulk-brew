# Mana base

How many lands a deck runs and which nonbasics make the cut. Feeds the `landFormula` in `config/deck-templates.json` and `config/land-rules.json`.

## The land formula

A fixed land count is wrong for half the decks. A deck full of two-drops floods on 24 lands; a deck of five-drops with no ramp stumbles on 22. The formula starts from a base, moves with the average mana value of the spells, and gives credit for cheap mana sources, in the spirit of Frank Karsten's regression analyses:

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
| 60   | 24   | 2.9          | 2.0   | 20 to 27 |
| 40   | 17   | 3.0          | 1.3   | 15 to 18 |
| 20   | 8    | 2.6          | 0.7   | 7 to 9   |

Worked examples:

- 60-card midrange, average mv 2.6, two one-drop dorks: 24 + 2.0 × (2.6 − 2.9) − 0.8 = 22.6, so 23 lands.
- 60-card control, average mv 3.4, no ramp: 24 + 2.0 × 0.5 = 25 lands.
- 40-card aggro, average mv 2.5: 17 + 1.3 × (−0.5) = 16.35, so 16 lands.
- 40-card midrange, average mv 3.1, one cheap dork: 17 + 0.13 − 0.3 = 16.83, so 17 lands.
- 20-card packet, average mv 2.4: 8 − 0.14 = 7.86, so 8 lands. A packet averaging 3.5 gets 9.

The builder picks spells first with the base count reserved, computes the formula on what it chose, then adjusts the spell count if the land count moved. Rounding is to the nearest whole number, halves up.

## Basics

Basics are unlimited by default, so the user never imports them. The deck lists them by color name from `land-rules.json`. With unlimited basics off, the pool's basic count caps the deck and the builder reports a shortfall.

## Nonbasic lands

Every nonbasic in the pool that fits the color is scored:

| Factor                                        | Score |
| --------------------------------------------- | ----- |
| Produces the deck's color                     | +2.0  |
| Produces only colorless mana                  | −1.0  |
| Enters tapped                                 | −1.5  |
| Has a utility ability (Tagger `utility-land`) | +1.0  |

Lands scoring below 0.5 stay out. Nonbasics take at most 40% of the land count, and colorless-only lands are capped at 4, 2, and 1 by size, because a mono-color deck that cannot cast its spells on time loses to its own mana base. Within the allowed share the highest scores go in and basics fill the rest.

## Modal cards with a land face

A modal double-faced card whose back is a land counts as a land in the mana base and still sits in the spell curve. It earns the credit above because it is a land when needed and a spell when not. Transforming cards do not get this treatment; their back face is never cast.
