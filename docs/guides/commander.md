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
| Lands             | 35  | 38     | The land formula starts at 38 and moves with the curve; a long game wants its land drops. |
| Ramp              | 7   | 8      | Lands plus ramp near 45 to 47 keeps the deck casting its bigger spells on time.           |
| Card advantage    | 8   | 12     | Multiplayer games run long; a deck that draws keeps up. Cantrips and looting count.       |
| Removal           | 6   | 8      | Answers for the threats three opponents bring.                                            |
| Sweepers          | 1   | 3      | Fewer in a go-wide deck, which loses more to its own sweepers.                            |
| Finishers         | 2   | 4      | Overruns, extra combats, other ways to win, and threats big enough for 40 life.           |
| Cheap interaction | 2   | 3      | Tricks and protection at two mana or less.                                                |
| Early creatures   | 3   | 5      | Plays on the first turns.                                                                 |

The numbers follow official Commander precons: 38 lands and 8 ramp in the middle, 14 card advantage (11 to 17 for the middle half), and about 8 removal, 3 finishers, 3 cheap interaction, and 5 early creatures. Lands come before ramp because a land cannot be removed or traded off. The targets sit at or a little above the precon middle for draw and at it for the rest, since strong removal and cheap creatures come in on their own strength anyway. The rest goes to the theme. Creatures sit between 25% and 60% of the spells, set by the style. The curve (`commander` profile) is fuller at five and up than a 60-card deck's, because the games last longer.

The land formula gives small credits for cheap mana sources (0.1 to 0.2 each): the base of 38 already assumes about eight ramp pieces. The clamp is 35 to 40.

The commander counts as one card toward each role it fills (`commander.roleCredit`), the same as any card in the 99, so the deck still works when the commander is off the table. Best fit adds up to 15 points (`commander.styleBonus`) to the styles the commander itself rewards, the most specific one most: the style with the fewest payoffs among the pool's cards gets all 15, and one with n times as many payoffs gets 15/n². A rare payoff marks the commander's own plan, so Hylda of the Icy Crown, which rewards tapped creatures, +1/+1 counters, and wide boards, leans toward Tappers. Styles the commander only feeds get nothing. Fifteen points is worth a little less than running the plan once more past its minimums (see the deck score in [Card strength](card-strength.md)), so the commander's own style wins over another theme unless that one runs well over half again as deep. On the reference precons this put the deck on the precon's own style about 63% of the time, against about 50% at 5 points; the squared falloff gave the same match as a plain 1/n while keeping Hylda on Tappers. The deck notes say when the bonus decided it.

A tribe can be the primary style of a Commander deck when the commander's own text names the type (Tagger `typal-<type>` on the commander, as for The Ur-Dragon, Reaper King, or Lathril). It needs twice the secondary tribe counts, 28 members and 4 cards that reward the type, as a secondary theme needs half of a primary's; tribal precons run 20 to 41 members, about 27 in the middle. A tribe the commander names counts as a style it rewards, and its members and payoffs count as synergy pairs, since no synergy rule covers a tribe.

Styles need more cards at 100: their 60-card pool minimums times 1.6 (`commander.minimumScale`), unless a style lists its own.

## Choosing a commander

The Build page lists every commander in the bulk list in three tiers:

- **Top**: rewards a style the pool can build (its own text is a payoff of that style, or it rewards a creature type the pool has), sits on a deep pool (at least 120 distinct cards in its colors, `commander.deepPool`), costs two to five, and, at three colors or more, the pool holds lands that make two or more of its colors (at least three per color past the first). On a big pool, top is kept to the best quarter.
- **Good**: can build a deck and rewards or feeds a style, or sits on a deep pool, but misses something top needs (or falls outside the best quarter).
- **Possible**: everything else that can be a commander.

Each entry says why: how many cards fit its colors, which styles it rewards or feeds, and what holds it back (cost, fixing). Unchecked rarities leave commanders out of the list, the same as any other card.

Picked colors narrow the list to commanders whose colors all come from them, the ones using every picked color first. A picked primary archetype keeps the commanders that lead it: a synergy style counts when the commander's own text rewards or feeds it, a tribe when the commander names it, and Aggro, Midrange, and Control suit any commander. The list then asks whether the bulk list can build that style under each one. If the scan of the commander's colors says no, the answer is no; otherwise the app builds the deck and checks that it kept the style and reached the style's enabler and payoff minimums for 100 cards. The scan alone misses some: on a test pool of 5,300 cards, 9 of 63 Ramp commanders passed the scan but their builds fell short.

## Power level

Bulk Brew builds casual decks from bulk and does not filter Game Changers: a bulk list rarely holds many, and when it does, the player can decide.
