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

The `jumpstart` profile is 14% ones, 30% twos, 28% threes, 17% fours, 8% fives, 3% sixes, and nothing at seven. On 12 spells that is about 2, 4, 3, 2, 1, 0. The curve stays low because the other packet may be slower, and because 16 lands in 40 cards does not support many five-drops. The land formula's reference average is 2.6 for this size. Every packet uses this profile, whatever its archetype, so an aggro packet and a control packet still curve out together.

## Castable

A packet never holds a spell it cannot cast once shuffled with another packet (`halfCast` in the template). In the 40-card deck its 8 lands are the only sources of its color, and 16 lands make the mana value. By turn 10, a long game for two packets, a seven-drop with one or two pips of its color has about 47% to be castable, a card asking four pips of one color at four mana 40%, an eight-drop 23%, and a ten-drop 2%. The rule keeps a spell with at least 30%: in a one-color packet everything at seven or less but five pips of one color (or four on a seven-drop), and nothing at eight or more. A packet of two colors splits its 8 lands between them, so it keeps fewer cards with several pips of one color; a hybrid pip counts for either color, and a prototype card counts at its cheaper cost. Official Jumpstart packets play a seven-drop in 77 of 510 packets and an eight-drop or more in 16, half of those cards making themselves cheaper.

## Self-contained

Every card in a packet must work with only the packet's own color. The builder already restricts candidates to that color's identity plus colorless cards, so no gold cards or off-color activations sneak in. Themes are chosen with lower minimums (for example 3 token makers and 1 payoff), and the role quotas ask for at least one removal spell, one cheap trick, one big threat, and two early creatures, so the packet stands on its own when paired with anything.

## Pairing

The Decks screen combines two saved packets into one 40-card list. Only packets of different colors pair; two packets of the same color would just be a 40-card mono deck with 16 lands, which the 40-card template handles better. The combined export lists both packets' cards and basics together.
