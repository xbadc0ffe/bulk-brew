# Data

| Path            | Contents                                                                 | In git |
| --------------- | ------------------------------------------------------------------------ | ------ |
| `raw/`          | Scryfall bulk files downloaded by `npm run data:fetch`.                  | no     |
| `packs/`        | Data packs built by `npm run data:build`.                                | no     |
| `manifest.json` | Pinned pointer to the published data pack: version, URL, checksum, size. | yes    |

Published packs live as GitHub release assets tagged `data-YYYY-MM-DD`. A weekly workflow refreshes the raw files, rebuilds the pack, publishes it, commits the `manifest.json` bump, and redeploys the web app. `npm run data:pull` downloads the pinned pack and installs it under each app's `public/data/` for local development and for the deploy build.

Scryfall asks that bulk files be fetched no more than once a day, so the fetch script skips files whose `updated_at` is unchanged.
