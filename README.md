# Bulk Brew

Turn a pile of bulk Magic: The Gathering cards into playable decks.

Paste in your bulk, pick a deck size and a color, and Bulk Brew builds the best mono-color deck it can from what you own. Accept the deck and its cards leave the pool, so you can build the next one from what is left. Decks come in three sizes: 60 cards, 40 cards, and 20-card Jumpstart packets that pair into two-color 40-card decks.

Everything runs on your device. There is no account, no server, and nothing you import ever leaves your browser or phone.

**Try it:** https://xbadc0ffe.github.io/bulk-brew/

**Status:** working v1. Import decklists or ManaBox, Moxfield, and Deckbox CSV exports, keep a pool, build 60, 40, or 20-card mono-color decks with an explanation, accept them to remove their cards from the pool, export or copy decklists, pair two packets, back everything up to a file, and browse card details with optional art. The web app works offline once loaded. Styling is a plain placeholder until the design pass; the iOS app is next. See [SPEC.md](SPEC.md) for the plan and the decisions behind it.

## How it works

1. **Import** a decklist such as `4 Lightning Bolt (M10) 146`, or a ManaBox, Moxfield, or Deckbox CSV export.
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

Card data is not committed. The apps need it before `npm run dev` shows anything:

```sh
npm run data:pull    # quickest: download the pinned, published card data pack
npm run data:fetch   # or: download Scryfall bulk files into data/raw/ (about 40 MB)
npm run data:build   #     and build the card data pack yourself
npm run rules:fetch  # optional: Comprehensive Rules text for development reference
```

Developer tools:

```sh
npm run config:check                                   # validate config/ against the card data
npm run demo:build -- eval/pools/white-bulk.txt W 60   # build one deck from a pool file and print it
npm run eval                                           # build and score decks from every fixture pool
npm run smoke                                          # browser test of the full flow (see CLAUDE.md)
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
| `eval/`             | Fixture pools, the deck quality rubric, and committed evaluation baselines        |
| `scripts/`          | Data download and pull scripts, rules download, browser smoke test                |

## License and attribution

Code, configuration, and guides are released under the [MIT License](LICENSE).

Bulk Brew is unofficial Fan Content permitted under the Fan Content Policy. Not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. Card data and images come from [Scryfall](https://scryfall.com), which is not affiliated with this project. See [ATTRIBUTION.md](ATTRIBUTION.md).
