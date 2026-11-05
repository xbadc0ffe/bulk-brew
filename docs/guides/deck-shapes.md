# Deck shapes

What a playable casual deck looks like at each size: how many lands, how the spells spread across mana values, how many creatures, and which jobs must be covered. Feeds `config/deck-templates.json`, `config/curve-profiles.json`, and `config/builder-weights.json`.

## The three sizes

| Size | Style              | Base lands | Spells | Max copies | Notes                                                 |
| ---- | ------------------ | ---------- | ------ | ---------- | ----------------------------------------------------- |
| 100  | Commander          | 38         | 61     | 1          | One commander plus 99; see [Commander](commander.md). |
| 60   | Casual constructed | 25         | 35     | 4          | The classic kitchen-table deck.                       |
| 40   | Limited style      | 17         | 23     | 4          | Shaped like a draft deck: creature heavy, simple.     |
| 20   | Jumpstart packet   | 8          | 12     | 2          | Half a deck. Two packets of different colors combine. |

Base lands are the starting point. The land formula in [Mana base](mana-base.md) moves the count up for a slow curve and down for cheap mana sources.

## Curve profiles

Each profile is the share of nonland spells at mana value 1, 2, 3, 4, 5, 6, and 7 or more. The builder multiplies by the spell count and rounds, so a 35-spell midrange deck wants about 4, 11, 9, 6, 3, 1, and 1.

| Profile   | 1    | 2    | 3    | 4    | 5    | 6    | 7+   | Used by                             |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ----------------------------------- |
| aggro     | 0.22 | 0.36 | 0.28 | 0.09 | 0.04 | 0.01 | 0.00 | Aggro, spells matter, auras, flyers |
| midrange  | 0.12 | 0.31 | 0.25 | 0.16 | 0.10 | 0.04 | 0.02 | Midrange and most synergy themes    |
| control   | 0.06 | 0.20 | 0.24 | 0.20 | 0.14 | 0.09 | 0.07 | Control                             |
| jumpstart | 0.14 | 0.30 | 0.28 | 0.17 | 0.08 | 0.03 | 0.00 | Every 20-card packet                |
| ramp      | 0.06 | 0.28 | 0.18 | 0.14 | 0.17 | 0.11 | 0.06 | Ramp                                |
| commander | 0.08 | 0.20 | 0.24 | 0.20 | 0.13 | 0.09 | 0.06 | Every 100-card Commander deck       |

Why these shapes: a two-drop is the most important slot in any deck, so every profile peaks at two or three. Aggro front-loads because it wants to spend all its mana every turn from turn one, and keeps only about one spell in seven at four or more: its noncreature spells should clear blockers, pump, or protect rather than wait in hand. Ramp has two peaks: cheap mana sources at two, then the threats they power out at five and six, with a thin middle. Control shifts weight to four and above because it plans to survive to the late game and win with fewer, bigger cards. The midrange shape follows real decks: preconstructed 60-card decks and draft decks both put about a third of their spells at two and fewer than one in six at five or more, for an average cost near 3.0, and in draft decks more two-drops and less top end go slightly with winning. Zero-cost spells count in the one slot. The tolerance of one card per bucket (`tolerances.curve`) means the builder does not chase exact counts.

## Type mix

Shares of nonland spells. A deck outside these bounds plays badly even with a good curve.

| Size | Creatures  | Instants and sorceries | Noncreature permanents |
| ---- | ---------- | ---------------------- | ---------------------- |
| 60   | 55% to 75% | at least 10%           | at most 30%            |
| 40   | 50% to 70% | at least 10%           | at most 25%            |
| 20   | 55% to 80% | at least 8%            | at most 25%            |

Preconstructed 60-card decks are about 64% creatures and draft decks about 61%, so the 60-card floor is 55% and the 40-card bounds sit around the middle of the draft decks. Composition archetypes override these: aggro wants 60% to 80% creatures, control 25% to 50% with at least a quarter instants and sorceries. The spells-matter theme sits in between on purpose.

## Role quotas

Jobs a deck must cover regardless of theme. Each has a minimum the builder treats as a hard shortfall and a target it tries to reach. Definitions live in `config/roles.json`; counts for the midrange baseline:

| Role             | 60 min / target | 40 min / target | 20 min / target | What counts                                                  |
| ---------------- | --------------- | --------------- | --------------- | ------------------------------------------------------------ |
| removal          | 4 / 7           | 3 / 5           | 1 / 2           | Spot removal, creature removal, planeswalker removal         |
| cardAdvantage    | 2 / 4           | 1 / 3           | 0 / 1           | Draw, cantrips, loot and rummage, draw engines               |
| cheapInteraction | 2 / 4           | 1 / 3           | 1 / 2           | Tricks, protection, counters, cheap removal at two or less   |
| finisher         | 2 / 4           | 2 / 3           | 1 / 2           | Big threats: big bodies, big flyers, planeswalkers (derived) |
| ramp             | 0 / 1           | 0 / 0           | 0 / 0           | Dorks, rocks, land fetchers costing three or less            |
| earlyCreature    | 4 / 8           | 3 / 6           | 2 / 3           | Creatures costing one or two                                 |

Real 60, 40, and 20-card decks play almost no ramp (a median of none), so the templates ask for at most one and the Ramp style for more. A sweeper role exists but only control asks for it. Evasive threat is defined for the flyers theme and future quotas.

## How the builder weighs it

`builder-weights.json` says what matters when choices conflict: a missing role minimum costs twice what a curve bucket miss costs, synergy density is worth one and a half times a curve miss, and a plain theme hit a third. Each copy also adds 0.3 per point of card strength (see [Card strength](card-strength.md)), so swaps prefer stronger cards when the shape allows. Ties break on theme tag hits, then card strength, then lower mana value, then name, so the same pool always gives the same deck.

## Copy limits

The deck limit (4 for 60 and 40, 2 for 20) is a setting and never broken. Under it, the builder prefers fewer copies of cards that are bad in multiples: legendary cards at most 2, because a second copy on the battlefield is dead, and cards costing six or more at most 2, because several in an opening hand sit uncast. Both live in `copyCaps` per template. They are guidelines: when the bulk list runs out of other cards, the last filler pass goes above them up to the deck limit, and the deck notes say so.
