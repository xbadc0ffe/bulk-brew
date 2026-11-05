# Card strength and deck score

How the builder tells a good card from a weak one, and a good deck from a weaker one. Feeds `config/card-strength.json` and the `deckScore` and `bestFit` blocks of `config/builder-weights.json`.

## Card strength

A score from 0 to 10, computed from card data alone. It starts at a base of 3 and adds or subtracts:

| Part               | Rule                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Popularity         | Up to +2 from Scryfall's popularity rank (1 minus rank over 33,000). Unranked cards get a small share.                               |
| Stats for its cost | Creatures only: power plus toughness against twice the mana value (at least 2), 0.35 per point, between -2 and +2. Star stats skip.  |
| Keywords           | Creatures only, capped at +2: flying 1, double strike 1.2, indestructible 0.9, deathtouch 0.8, hexproof 0.7, defender -1, and so on. |
| Effects            | Tag-based, capped at +3.5: removal +2, sweepers +2, card draw +1 to +1.5, token makers, mana sources +0.4, anthems, counterspells.   |
| Removal quality    | Exile +0.4; hits any nonland permanent +0.5; only hits attackers or blockers -0.8.                                                   |
| Weak alone         | Auras and equipment that only add stats or keywords -0.8; a drawback tag -0.4.                                                       |
| Speed and cost     | Instants +0.3; noncreature spells gain up to 0.6 for being cheap and lose up to 1 for costing more than three.                       |
| Colored pips       | -0.2 per colored pip beyond the first.                                                                                               |
| Planeswalker       | +1.5.                                                                                                                                |

Why these rules:

- A card is a slot first. A plain body is rarely worth it; a body with an effect is close to two cards in one.
- Flexible beats narrow. Removal that answers anything outranks removal that needs the creature to be attacking. Instant speed and fewer colored pips make a card easier to use.
- Ramp is a job, not a strength. Real 60, 40, and 20-card decks hold about as many mana sources as random bulk does, and at +0.8 builds carried one to three more than the reference decks, so mana sources add only 0.4; a Commander deck asks for its ramp through the ramp role.
- Cheap matters. Most removal and most threats in casual play are cheap, so a cheap card that does its job beats a slightly better expensive one.
- Popularity is a signal, not the answer. It comes from Commander play, so it favors multiplayer value cards and knows little about limited-only cards. It breaks up the middle of bulk without overruling what the card does.
- Strength is context-free on purpose. A card that is weak alone can still make a themed deck: the theme passes and theme hits pull it in. The theme pass fills its minimums from theme cards scoring at least `themeMinStrength` (3) first, and the scan ranks themes by how many such cards they have, so a theme made of cards that are dead on their own ranks low. Weaker theme cards still count when nothing better is left; the bar is a preference, not a rule.

The builder uses strength as the main tiebreak after theme hits, and the objective adds 0.3 per strength point per copy, so the local search swaps weak picks for strong ones when the curve and roles allow.

## Deck score

A score from 0 to 100 for a finished deck, used to rank styles against each other and deck options on the Build page. The deck's plan leads; the rest is a minor tiebreak, because a pile of strong cards is not a deck that works.

| Part        | Weight | Scale                                                                                                                                                                                                                                                                                          |
| ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan        | 0.60   | The style's enablers and payoffs as multiples of its minimums, the scarcer of the two; three times the minimums (or as many as the spell slots hold) scores 1. Aggro, Midrange, and Control have no plan of their own and score their rule pairs per spell instead, three per spell scoring 1. |
| Castability | 0.30   | Share of spells the mana base casts on curve (multi-color decks).                                                                                                                                                                                                                              |
| Strength    | 0.05   | Average card strength, 3 maps to 0 and 7 to 1.                                                                                                                                                                                                                                                 |
| Roles       | 0.05   | Share of each role target met, averaged over roles.                                                                                                                                                                                                                                            |
| Curve       | 0.10   | Curve misses beyond tolerance; misses equal to the spell slots score 0.                                                                                                                                                                                                                        |
| Type mix    | 0.05   | Cards outside the type bounds, scaled the same way.                                                                                                                                                                                                                                            |

Why: counting every synergy rule's enabler and payoff pairs rewards a pile of loosely related themes, and scored that way no reference deck ever rated as high as a build from bulk, because real decks go deep on one plan. Counting only the chosen style's own cards, against its minimums, rewards the deck that commits. Full credit sits at three times the minimums so the deepest plan in the pool wins best fit; at the minimums every viable style ties and the choice falls to small differences. Real decks miss our role targets and curve more often than builds do, so those weigh less and the curve allows twice the misses it did. Under a commander, the styles it rewards get up to 15 points (`commander.styleBonus`, see [Commander](commander.md)), a little less than running the plan once more past its minimums.

## Best fit

The archetype scan measures how deep a theme runs in the pool, not how good its deck will be: a color full of flyers always looks deep in flyers. So best fit builds the best deck it can for every viable style, scores each, and keeps the highest. The deck notes name the styles it compared. On the Build page (phase 11) the same builds become the ranked list of options.
