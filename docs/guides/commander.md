# Commander

How the builder makes a 100-card Commander deck from a bulk list, and why the numbers are what they are. Feeds the `100` template in `config/deck-templates.json`, the `commander` curve profile, and the `commander` block of `config/builder-weights.json`.

## The rules the builder enforces

From the Comprehensive Rules, section 903:

- The commander is a legendary creature card, Vehicle, or Spacecraft with power and toughness, or a card whose text says it can be your commander. A card that is a creature everywhere but the battlefield counts as a creature card. Cards banned or not legal in Commander are never offered, as the commander or in the 99.
- The deck is exactly 100 cards, the commander included.
- One copy of each card, except basic lands and cards whose text allows more ("any number of cards named", "up to seven cards named").
- Every card's color identity fits inside the commander's. Identity counts mana symbols in costs and rules text (not reminder text), color indicators, and both faces of two-faced cards; Scryfall's color identity already does this.

Partner, Background, and similar pairs, and colorless commanders, are not supported yet.

## The 99

| Part              | Min | Target | Why                                                                                       |
| ----------------- | --- | ------ | ----------------------------------------------------------------------------------------- |
| Lands             | 35  | 37     | The land formula starts at 37 and moves with the curve; a long game wants its land drops. |
| Ramp              | 8   | 10     | Lands plus ramp near 45 to 47 keeps the deck casting its bigger spells on time.           |
| Card advantage    | 7   | 10     | Multiplayer games run long; a deck that draws keeps up. Cantrips are smoothing, not draw. |
| Removal           | 6   | 9      | Answers for the threats three opponents bring.                                            |
| Sweepers          | 1   | 3      | Fewer in a go-wide deck, which loses more to its own sweepers.                            |
| Finishers         | 3   | 6      | Big bodies, evasive threats, and planeswalkers that end the game.                         |
| Cheap interaction | 2   | 4      | Tricks and protection at two mana or less.                                                |
| Early creatures   | 3   | 6      | Plays on the first turns.                                                                 |

The rest goes to the theme. Creatures sit between 25% and 60% of the spells, set by the style. The curve (`commander` profile) is fuller at five and up than a 60-card deck's, because the games last longer.

The land formula gives small credits for cheap mana sources (0.1 to 0.2 each): the base of 37 already assumes about ten ramp pieces. The clamp is 35 to 40.

The commander counts as one card toward each role it fills (`commander.roleCredit`), the same as any card in the 99, so the deck still works when the commander is off the table. Best fit adds 5 points (`commander.styleBonus`) to styles the commander itself enables or rewards, so a tokens commander leans toward a tokens deck; the deck notes say when that bonus decided it.

Styles need more cards at 100: their 60-card pool minimums times 1.6 (`commander.minimumScale`), unless a style lists its own.

## Choosing a commander

The Build page lists every commander in the bulk list in three tiers:

- **Top**: rewards a style the pool can build (its own text is a payoff of that style, or it rewards a creature type the pool has), sits on a deep pool (at least 120 distinct cards in its colors, `commander.deepPool`), costs two to five, and, at three colors or more, the pool holds lands that make two or more of its colors (at least three per color past the first). On a big pool, top is kept to the best quarter.
- **Good**: can build a deck and rewards or feeds a style, or sits on a deep pool, but misses something top needs (or falls outside the best quarter).
- **Possible**: everything else that can be a commander.

Each entry says why: how many cards fit its colors, which styles it rewards or feeds, and what holds it back (cost, fixing). Unchecked rarities leave commanders out of the list, the same as any other card.

## Power level

Bulk Brew builds casual decks from bulk and does not filter Game Changers: a bulk list rarely holds many, and when it does, the player can decide.
