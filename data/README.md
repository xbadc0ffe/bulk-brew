# Data

| Path            | Contents                                                                  | In git |
| --------------- | ------------------------------------------------------------------------- | ------ |
| `raw/`          | Scryfall bulk files downloaded by `npm run data:fetch`.                   | no     |
| `packs/`        | Data packs from `npm run data:build` or `npm run data:pull`.              | no     |
| `manifest.json` | Pinned pointer to the published data pack: version, URL, checksum, size.  | yes    |
| `learned.json`  | Card-level learned data from `npm run learn:build`; the apps serve it.    | yes    |
| `corpus/`       | Reference decks and eval results from the `corpus:*` scripts.             | no     |
| `edhrec/`       | EDHREC pages cached by `npm run edhrec:fetch` (refetched at most weekly). | no     |
| `spellbook/`    | Commander Spellbook's combo file from `npm run spellbook:fetch`.          | no     |

Published packs live as GitHub release assets tagged `data-YYYY-MM-DD`. A weekly workflow refreshes the raw files, rebuilds the pack, publishes it, commits the `manifest.json` bump, and redeploys the web app. `npm run data:pull` downloads the pinned pack and installs it under each app's `public/data/` for local development and for the deploy build.

Scryfall asks that bulk files be fetched no more than once a day, so the fetch script skips files whose `updated_at` is unchanged.

`learned.json` holds what the builder learned from real decks for cards the data covers well: how much each card fits each style, the plans each commander's decks run and the cards they play more than other decks of their colors, card pairs from draft decks, and combos. It is rebuilt with `npm run learn:build` (after `corpus:fetch`, `edhrec:fetch`, and `spellbook:fetch`) and committed. `data:pull` and `data:build` copy it beside the pack in each app's `public/data/`. The tag and style level part lives in `config/learned/`.
