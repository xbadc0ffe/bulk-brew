# Deck rubric

Score each deck from 1 to 5 on six axes. A person or Claude can score a decklist by hand; the automatic metrics in `npm run eval` approximate the same axes with numbers, so use this rubric to calibrate what the numbers mean and to judge what they cannot see, such as whether the cards are actually good.

## Curve

1. Most spells cost four or more, or almost everything costs one. The deck either stumbles early or runs out of gas.
2. Lopsided: a big hole at two or three, or a top end the land count cannot support.
3. Playable. One bucket is clearly over or under the profile, the rest are close.
4. Within a card or two of the profile in every bucket for its archetype.
5. On profile, with the cheap end made of cards that still matter later.

Automatic: `curveDeviation` is the sum of bucket differences beyond the template tolerance; 0 to 2 reads as 4 or 5, above 6 reads as 1 or 2.

## Type mix

1. Almost no creatures in a deck that needs them, or no spells at all in a deck that has them in the pool.
2. Outside the archetype's bounds by a wide margin.
3. One bound missed slightly; the deck can still play its plan.
4. Inside the bounds.
5. Inside the bounds and the noncreature cards each earn their slot.

Automatic: `typeMixOk` and the three shares.

## Role coverage

1. No removal and no way to close a game.
2. Two or more roles below their minimum.
3. One role below its minimum, the rest at or above.
4. Every minimum met, most targets met.
5. Every target met with cards that fill the role well, not just by tag.

Automatic: `rolesBelowMin`, `rolesBelowTarget`, and the per-role counts.

## Synergy

1. A pile of unrelated cards; the chosen archetype has no enablers or no payoffs in the deck.
2. A theme is named but fewer than a handful of cards support it.
3. The theme is visible with a few enablers and payoffs that work together.
4. Most spells touch the theme or a role; the deck does one thing well.
5. Enablers and payoffs are balanced and the deck has a clear game plan a new player could explain.

Automatic: `synergyPairs` and `synergyDensity` (weighted pairs per spell); `filler` counts cards picked for no role or theme.

## Mana base

1. Land count far off the formula, or lands that cannot cast the spells.
2. Count is right but several lands enter tapped for no reason, or too many colorless lands.
3. Count inside the clamp; basics plus a sensible nonbasic or two.
4. Count matches the formula for the curve and mana sources; nonbasics all produce the deck color or add real utility.
5. As 4, and the cheap mana sources and curve make the count feel right in play.

Automatic: `lands`, `landsInClamp`, `nonbasics`, `averageMv`, and the land line in the deck explanation.

## Playability

1. Uncastable cards, illegal copies, or an off-color card.
2. Legal but the deck will not do anything most games.
3. Legal and functional; wins some games against another bulk deck.
4. Plays smoothly; a reasonable person would sleeve it up.
5. The best deck this pool could make for the size.

Automatic: `castable`, `copyLimitOk`, `colorLegal`, `exactSize`. The rest is judgment.

## Scoring a run

Pick a few decks from the latest results file, build them with `npm run demo:build`, and score them here. Compare with the automatic numbers for the same decks; if they disagree often, the metrics or the config need work, not the rubric.
