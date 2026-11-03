# Jumpstart packets

A 20-card packet is half a deck with its own lands. Any two packets of different colors shuffle into a two-color 40-card deck without further work. Feeds the 20-card template in `config/deck-templates.json` and the `jumpstart` curve profile.

## Shape

| Part   | Count | Why                                                                                               |
| ------ | ----- | ------------------------------------------------------------------------------------------------- |
| Lands  | 8     | Two packets give 16 lands in 40 cards, which is right for a low curve. The formula allows 7 to 9. |
| Spells | 12    | Enough to carry a theme without filler.                                                           |
| Copies | 2 max | Variety over consistency; the packet is shuffled with a stranger.                                 |

Official Jumpstart packets run 7 or 8 lands and 12 or 13 spells, which is where these numbers come from.

## Curve

The `jumpstart` profile is 14% ones, 30% twos, 28% threes, 17% fours, 8% fives, 3% sixes, and nothing at seven. On 12 spells that is about 2, 4, 3, 2, 1, 0. The curve stays low because the other packet may be slower, and because 16 lands in 40 cards does not support many five-drops. The land formula's reference average is 2.6 for this size.

## Self-contained

Every card in a packet must work with only the packet's own color. The builder already restricts candidates to that color's identity plus colorless cards, so no gold cards or off-color activations sneak in. Themes are chosen with lower minimums (for example 3 token makers and 1 payoff), and the role quotas ask for at least one removal spell, one cheap trick, one finisher, and two early creatures, so the packet stands on its own when paired with anything.

## Pairing

The Decks screen combines two saved packets into one 40-card list. Only packets of different colors pair; two packets of the same color would just be a 40-card mono deck with 16 lands, which the 40-card template handles better. The combined export lists both packets' cards and basics together.
