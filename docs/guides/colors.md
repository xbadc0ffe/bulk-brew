# Colors

What each color does well in a mono-color bulk deck, and which themes to expect. Counts come from `npm run config:check` over the current data pack (mono-color cards only) and guide the archetype color limits in `config/archetypes.json`.

## White

Strong at going wide and pumping the team. The deepest token payoffs of any color (about 600 cards), the most anthems, the most combat tricks and protection, and plenty of cheap creatures. Removal is decent (pacifism effects, exile, small sweepers) but card draw is thin. Natural themes: tokens, flyers, auras and equipment, lifegain, aggro.

## Blue

Card draw, bounce, counterspells, and flyers. The best spells-matter payoffs together with red, the most evasive creatures, and the most self-mill for graveyard themes. Removal is mostly bounce and freeze, so a blue deck wins through evasion and card quality rather than killing things. Natural themes: flyers, spells matter, artifacts, control.

## Black

Removal and recursion. The most creature removal after red, the deepest sacrifice outlets and death payoffs (aristocrats is a black theme first), and the most graveyard payoffs. Lifegain payoffs exist through drain effects. Natural themes: aristocrats, graveyard, lifegain, midrange, control.

## Red

Burn and haste. The most removal of any color, almost all of it damage based, the best spells-matter payoffs alongside blue, and token makers that attack right away. Card advantage comes from impulsive draw and rummaging. Finishers are big dragons and haste threats. Natural themes: aggro, spells matter, tokens, aristocrats.

## Green

Ramp and big creatures. Ten times the mana dorks of any other color, the most +1/+1 counter cards, the biggest finishers, and the most pump. Removal is fight and bite effects plus artifact and enchantment hate. Natural themes: ramp into big creatures, counters, tokens, midrange.

## Colorless

Artifacts fit any deck. Colorless creatures, mana rocks, and equipment are always candidates, but they cannot carry a color on their own: the scan requires at least half of a deck's spell slots to be cards of the deck color (`MIN_COLORED_SHARE` in `packages/core/src/scan.ts`). Cards with a {C} pip in their cost, such as Eldrazi that need colorless mana specifically, are never candidates, because a deck of basics cannot pay for them. Lands that make only colorless mana are limited by `land-rules.json`.

## Where themes do not work

The config limits lifegain to white, black, and green because blue and red have almost no life gain. Other themes stay open to every color and simply fail the viability scan when the pool is thin; the Build screen shows what is missing.
