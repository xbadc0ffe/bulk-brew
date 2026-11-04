# Bulk Brew

Turn a pile of bulk Magic: The Gathering cards into playable decks.

Paste in your bulk, pick a deck size and one or more colors, and Bulk Brew builds the best decks it can from what you own, ranked side by side. Accept a deck and its cards leave your bulk list, so you can build the next one from what is left. Decks come in four sizes: 100-card Commander decks led by a commander from your list, 60 cards, 40 cards, and 20-card Jumpstart packets that pair into 40-card decks.

Everything runs on your device. There is no account, no server, and nothing you import ever leaves your browser or phone.

**Try it:** https://xbadc0ffe.github.io/bulk-brew/

**Status:** working v1. Import decklists or ManaBox, Moxfield, and Deckbox CSV exports, keep a bulk list you can filter, sort, and analyze (with the strongest decks it can build at every size), build decks of 60, 40, or 20 cards in one to five colors, or 100-card Commander decks, from ranked options with a primary and secondary style and a rarity filter, each with an explanation, accept them to take their cards out of the list, export or copy decklists, pair and merge two packets, back everything up to a file, and browse card details with optional art. Light, dark, and six theme colors. The web app works offline once loaded. The phone layout builds a single deck for now; the iOS app comes later. See [SPEC.md](SPEC.md) for the plan and the decisions behind it.

## How it works

1. **Import** a decklist such as `4 Lightning Bolt (M10) 146`, or a ManaBox, Moxfield, or Deckbox CSV export.
2. **Bulk List**: every card you imported, matched against a local card database built from Scryfall data.
3. **Build**: choose 100, 60, 40, or 20 cards and one or more colors, or a commander for 100. Deck options build one by one, strongest first. Each picks a style your pool supports, fills role quotas and a mana curve, and sizes the mana base from the curve and the cheap mana sources it chose.
4. **Accept** an option to save it and take its cards out of your bulk list, or go back to the options and pick another.
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
