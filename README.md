# Bulk Brew

Turn a pile of bulk Magic: The Gathering cards into playable decks.

Paste in your bulk, pick a deck size and a color, and Bulk Brew builds the best mono-color deck it can from what you own. Accept the deck and its cards leave the pool, so you can build the next one from what is left. Decks come in three sizes: 60 cards, 40 cards, and 20-card Jumpstart packets that pair into two-color 40-card decks.

Everything runs on your device. There is no account, no server, and nothing you import ever leaves your browser or phone.

**Status:** early development. The repo layout, core types, and decklist parser exist. The data pipeline, deck builder, and real interfaces are being built phase by phase; see [SPEC.md](SPEC.md) for the plan and the decisions behind it.

## How it works

1. **Import** a decklist or collection export in the usual text formats, such as `4 Lightning Bolt (M10) 146`.
2. **Pool**: every card you imported, matched against a local card database built from Scryfall data.
3. **Build**: choose 60, 40, or 20 cards and a color. The builder picks an archetype your pool supports, fills role quotas and a mana curve, and sizes the mana base from the curve and the cheap mana sources it chose.
4. **Accept** the deck to save it and remove its cards from the pool, or discard it and try another style.
5. **Export** any saved deck as plain decklist text.

Card art is optional and off by default. When on, images load from Scryfall as you browse; nothing is bundled.

## Running it

Requires Node 24 or newer.

```sh
npm install
npm run dev          # web app at http://localhost:5173
npm run dev:mobile   # phone and tablet app at http://localhost:5174
npm run check        # typecheck, lint, format check, tests, build
```

Card data is not committed. To build it locally:

```sh
npm run data:fetch   # downloads Scryfall bulk files into data/raw/ (about 40 MB)
npm run data:build   # builds the card data pack into data/packs/
npm run rules:fetch  # optional: Comprehensive Rules text for development reference
```

## Repository layout

| Path                | What lives there                                                                  |
| ------------------- | --------------------------------------------------------------------------------- |
| `packages/core`     | Platform-free logic: types, parsing, name resolution, pool, scan, builder, export |
| `packages/ui`       | Shared React pieces used by both apps                                             |
| `packages/pipeline` | Developer-side pipeline from Scryfall bulk files to the card data pack            |
| `apps/web`          | Desktop-first web app, deployed to GitHub Pages                                   |
| `apps/mobile`       | Phone and tablet app, shipped to iOS through Capacitor                            |
| `config/`           | Deck templates, archetypes, roles, land rules: all tunable without code changes   |
| `data/`             | Pinned manifest of the published data pack; raw downloads are gitignored          |
| `docs/`             | Design brief, deckbuilding guides, reference notes                                |
| `eval/`             | Fixed test pools and the rubric used to judge deck quality                        |
| `scripts/`          | Download scripts for Scryfall bulk data and the Comprehensive Rules               |

## License and attribution

Code, configuration, and guides are released under the [MIT License](LICENSE).

Bulk Brew is unofficial Fan Content permitted under the Fan Content Policy. Not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. Card data and images come from [Scryfall](https://scryfall.com), which is not affiliated with this project. See [ATTRIBUTION.md](ATTRIBUTION.md).
