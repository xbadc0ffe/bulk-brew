# Data

| Path            | Contents                                                                 | In git |
| --------------- | ------------------------------------------------------------------------ | ------ |
| `raw/`          | Scryfall bulk files downloaded by `npm run data:fetch`.                  | no     |
| `packs/`        | Data packs built by `npm run data:build`.                                | no     |
| `manifest.json` | Pinned pointer to the published data pack: version, URL, checksum, size. | yes    |

Published packs live as GitHub release assets tagged `data-YYYY-MM-DD`. A weekly workflow refreshes the raw files, rebuilds the pack, and opens a pull request that bumps `manifest.json` when the card data changed. The web app and the iOS app both read the manifest to find the pack.

Scryfall asks that bulk files be fetched no more than once a day, so the fetch script skips files whose `updated_at` is unchanged.
