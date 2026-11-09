# Review runner

`npm run review:build` builds any builder version on any pool through one interface and stores each deck as one JSON file in `data/review/decks/` (gitignored). Every version in the review (the current builder, the builder at 26.0.30, and the prototypes) runs through it, so decks are stored and compared the same way.

Code: `packages/pipeline/src/review/`.

- `version.ts`: the interface.
- `versions.ts`: the registry.
- `algos/head.ts`: the current builder.
- `algos/v26-0-30.ts`: the builder before the learned work.
- `build.ts`: the runner and its in-process API.

## The interface

A version gets a `BuildContext` and returns a `BuiltDeck`.

`BuildContext`:

- `pool`: the pool, as the core's `Pool` (oracle id to quantity).
- `request`: the `ReviewRequest`.
  - `size`: 100, 60, 40, or 20.
  - `colors`: in WUBRG order. At 100 cards these are the commander's color identity.
  - `style`: a style id from `config/archetypes.json`, or `tribal:<Type>` under a commander. Absent means best fit.
  - `secondary`: a second style id or `tribal:<Type>`, used only with a style.
  - `commander`: the commander's oracle id, at 100 cards.
  - `seed`: a whole number.
- `index`: the current data pack (`CardIndex`) with `data/learned.json` attached.
- `config`: the current `config/`, with `config/learned/`.
- `settings`: `config/settings.defaults.json`.
- `root`: the repo root, for versions that read files of their own.

Prototypes may ignore `config` and use their own tables. Every version in a run shares the `config`, `settings`, and pool, so the runner freezes them: a version that writes to them throws instead of changing later builds.

`BuiltDeck`:

- `name`, and `archetype` (the style id it built).
- `colors`: optional, the colors the deck was built in. Without it the runner records the request's.
- `commander`: the oracle id, at 100 cards.
- `cards`: `{ id, qty, why? }` for spells and nonbasic lands, keyed on oracle id. At 100 cards the commander is one of them, as in the core.
- `basics`: basic land counts by color.
- `explanation`: optional, anything the version wants to keep.

When the pool cannot make the request, throw the core's `BuildError` (from `@bulk-brew/core`) with a plain message. The runner records it in the deck file. Any other error counts as a crash.

`BuilderVersion` has `id`, `label`, `notes`, `build(ctx)`, and an optional `prepare(ctx)`. The runner calls `prepare` once per run, before the first build and outside the build time. Use it for slow setup, such as loading an old core or precomputing tables. A string it returns is added to the notes in every deck file, for example the config version it loaded.

`ReviewDeck`, the file the runner writes:

- `version` and `versionNotes`.
- `pool`:
  - `id`: a JSON pool's `id` (such as `public-bulk-black` from `review:pools`), else the file's base name.
  - `source`: the file, relative to the repo root.
  - `hash`: FNV-1a of the sorted `[oracle id, qty]` pairs, as 8 hex digits.
  - `cards`: the number of copies.
- `request`: the resolved `ReviewRequest`.
- `deck`: `name`, `archetype`, `colors` (the built deck's own, WUBRG order), `commander`, `cards` (each with `id`, `name`, `qty`, `why`), and `basics`. Every card carries its name, so judges can read a deck without the pack. Files built before 2026-11-08 have no `colors`; readers then use `request.colors` (`deckColorsOf` in `version.ts`).
- `buildMs`, and `explanation` when the version gave one.
- `error`, when the version threw a `BuildError`. The deck is then empty.
- `builtAt` and `dataVersion`.

## Adding a version

1. Write `packages/pipeline/src/review/algos/<name>.ts`. It must default-export a `BuilderVersion` whose `id` is the name you will register.
2. Add one line to `REGISTRY` in `versions.ts`:

   ```ts
   'my-proto': () => import('./algos/my-proto.ts'),
   ```

Versions load lazily, so a broken prototype does not stop the others.

A version must:

- give the same deck for the same pool, request, and seed;
- use no network and no clock.

Import from `@bulk-brew/core` as needed, but do not change it. `algos/head.ts` exports `toBuildRequest` and `toBuiltDeck`, for prototypes that wrap the current `buildDeck`.

## Running

The flags for one build:

```sh
npm run review:build -- --pool eval/pools/bulk-black.txt --colors B [flags]
```

| Flag                 | Meaning                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--version <id>`     | `head` (default), `v26.0.30`, or a registered prototype                                                                                                                                         |
| `--pool <file>`      | A decklist text file, or a JSON pool `{ "id": "...", "cards": [[oracleId, qty], ...] }`. Paths are relative to the repo root.                                                                   |
| `--colors <letters>` | WUBRG letters in any order, such as `B` or `UB`. Required below 100 cards. At 100 cards, leave it out or give the commander's identity.                                                         |
| `--size <n>`         | 60 (default), 40, 20, or 100                                                                                                                                                                    |
| `--style <id>`       | A style id. The style must be built: a pool that cannot build it gives an error, never a best fit in its place. Without it, the version builds its best fit.                                    |
| `--secondary <id>`   | A second style id, or `tribal:<Type>`                                                                                                                                                           |
| `--commander <text>` | Required at 100 cards. A full name, an oracle id, or part of a name that matches only one possible commander in the pool, such as `Lathril`. It must be in the pool and able to be a commander. |
| `--seed <n>`         | Whole number, default 1. Recorded even by versions that ignore it.                                                                                                                              |
| `--out <dir>`        | Output folder, default `data/review/decks`                                                                                                                                                      |
| `--twice`            | Build again in the same process and report whether the two decks match: card ids, quantities, basics, commander, name, archetype, and error.                                                    |
| `--print`            | Print the deck list, grouped by type, after the build line.                                                                                                                                     |

A single build always rebuilds and overwrites its file. It exits with 1 when the build fails or `--twice` finds a difference, and with 2 on a bad argument.

The flags for a batch:

```sh
npm run review:build -- --jobs data/review/jobs.json [--force] [--out <dir>]
```

The jobs file is an array of `{ version, pool, colors, size, style?, secondary?, commander?, seed? }`. `colors` is a string such as `"UB"`, or an array.

- Jobs run in order.
- The pack, the config, each pool, and each version load once per run.
- A job whose file holds the same build (the same pool file, pool cards, request, and data pack) is skipped unless `--force` is given. A stale or unreadable file is rebuilt. A file holding another pool's build under the same name stops the job as a bad job.
- Each job prints one line: the version, pool, request, then the style built and the build time, or the error.
- A summary line closes the run.
- A `BuildError` is recorded in the job's file and counts as "could not build".
- An unknown version, a missing pool file, a bad request, or a crash is reported and writes no file, so a rerun retries it. The exit code is 1 when any job did that.

From a script, use the in-process API in `build.ts`:

- `createContext({ outDir?, force? })` loads everything once.
- `runJob(job, ctx)` returns `{ file, deck, skipped }`.
- `planJob`, `buildReviewDeck`, `loadPool`, `deckDifferences`, `deckText`, and `deckFileName` are the pieces it uses.

## File names

```
<outDir>/<version>/<pool>-<colors>-<size>-<style>[+<secondary>][-<commander>]-s<seed>.json
```

- `pool`: the pool id (see `pool.id` above).
- `colors`: WUBRG letters.
- `style`: the style id, or `bestfit`.
- `secondary`: added after a `+` when given.
- `commander`: the commander's name in lower case with dashes, at most 40 characters.

Characters that Windows does not allow in file names become dashes. For example, `tribal:Elf` becomes `tribal-Elf`.

Examples:

- `head/bulk-black-B-60-bestfit-s1.json`
- `head/bulk-black-B-60-graveyard-s1.json`
- `head/elf-tribe-BG-100-tribal-Elf+aristocrats-lathril-blade-of-the-elves-s1.json`

The same pool, request, and seed give the same file. Only `builtAt` and `buildMs` differ between runs.

## What head builds

`head` calls `buildDeck` as `demo:build` and the iOS app's Build button do, with the current `config/` and `config/learned/`, `data/learned.json` (the file `data:pull` ships to the live site), and `config/settings.defaults.json`. Its best fit is identical to `demo:build`'s, card for card, on `bulk-red` R 60.

- A requested style adds `requireStyle`, as the web Build page does for a picked style. The iOS Build button builds the best fit instead when the style falls short.
- Best fit is `buildDeck`'s own best fit, which ranks styles by learned plan score. The web Build page never asks for it. It builds every viable style for each subset of the picked colors and lists them by deck score, so its first option can be another deck. On 2026-11-08, the head best fit was not the web's first option on any of six public pools (`bulk-red`, `bulk-black`, `white-bulk`, and `bulk-blue` at 60, `bulk-green` at 40, `elf-tribe` under Lathril). It was the second to ninth option on four and missing on two. The script, run with `node`, is `data/review/scratch/web-options.ts`.

## head-web

`head-web` records the deck a web user opens: the first option on the Build page. It exists because the web never calls `buildDeck` for a best fit (see above), and the review judges what users see. Code: `algos/head-web.ts`.

- It runs `deckOptionSearch` from the current core with the request `useDeckOptions` sends to the Build page worker: size, colors, the default settings, a requested style as `primary`, the secondary (only with a style, since the page offers one only after a primary), and the commander. A commander fixes the colors to its identity, as on the web.
- The worker gets only the pool's cards and the basics, with the learned data trimmed to them (`workerCards`: `poolPack` and `trimLearned`); `head-web` searches the full index. On 2026-11-08 the two gave identical option lists, same keys, ranks, cards, and basics, on seven requests: `bulk-red` R 60, `bulk-black` B 60, `bulk-green` G 40, `white-bulk` W 20, `elf-tribe` BG 60, `gold-heavy-black` WB 60, and `elf-tribe` 100 under Lathril (`node data/review/scratch/rev-anchors/reduced-pack.ts`).
- The deck is `options[0]`, the first card in the page's list once the search finishes; the page shows the options in that order. Without a style, it can use fewer colors than were picked; the request keeps the picked colors, and the deck's own are in `deck.colors` (and `explanation.web.colors`). Fixed on 2026-11-08: `deckText` (`--print`), the judge packets, pair matching, and the legality and mana checks read `deck.colors`, so `white-bulk` WU 60, a mono-white deck, now prints as "White". Files built before then have no `deck.colors` and still show the picked colors. The request plan asks for one color below 100, where this does not happen.
- With no colors, as under a colorless commander, the page shows no options, so `head-web` declines.
- A requested style gives the same deck and core explanation as `head` when only one color is picked (checked on `bulk-red` R 60 artifacts and `elf-tribe` under Lathril, `tribal:Elf`). With two or more colors, the first option can be a deck in fewer of them.
- No options throws a `BuildError` with the web's message, recorded as a declined build.
- `buildMs` is the whole search, which is what the user waits for. `explanation` is the core's explanation of the chosen deck plus `web`:
  - `key`, `style`, and `colors` of the chosen option;
  - `rank`, its rank score (deck score plus the bonuses for every picked color and a met secondary);
  - `optionCount`, `planned`, `built`, and `options` (each option's key and rank, in the order shown);
  - `planMs` (scans and the plan) and `deckMs` (the chosen deck's own build).

Measured on 2026-11-08 on the development desktop, one `--twice` run each, the first build in its process and then the repeat:

| Request                               | head-web           | head           | head-web picks (head picks)              |
| ------------------------------------- | ------------------ | -------------- | ---------------------------------------- |
| `bulk-red` R 60                       | 234 ms, 139 ms     | 165 ms, 93 ms  | midrange, option 1 of 8 (artifacts, 2nd) |
| `bulk-green` G 40                     | 193 ms, 151 ms     | 146 ms, 74 ms  | aggro, 1 of 2 (landfall, not shown)      |
| `elf-tribe` 100 under Lathril         | 1,419 ms, 1,097 ms | 937 ms, 562 ms | tokens, 1 of 6 (`tribal:Elf`, 2nd)       |
| `elf-tribe` BG 60                     | 1,143 ms           | not run        | BG counters, 1 of 12 from 31 builds      |
| `bulk-red` R 60 artifacts             | 86 ms, 42 ms       | 58 ms, 28 ms   | the same deck                            |
| `elf-tribe` 100 Lathril, `tribal:Elf` | 214 ms             | 173 ms         | the same deck                            |

Each build of a best fit costs about 15 to 160 ms, so the search grows with the number of planned builds: 10 to 13 for one color, 31 for two.

## The 26.0.30 worktree

The `v26.0.30` version runs the 26.0.30 core and `config/` from a git worktree, on the current data pack.

- The worktree's path comes from `REVIEW_WORKTREE_26_0_30`. The default is `../bulk-brew-26.0.30`, next to the repo.
- Create it from the repo root with:

  ```sh
  git worktree add --detach ../bulk-brew-26.0.30 97757faa61eaa876021d9544b0ef131ead3d7cf6
  ```

  That commit is "Bump version to 26.0.30".

- The adapter imports the old core at run time from a `file://` URL, so `tsc` and CI never need the worktree.
- It reads the old `config/` file by file, as the old `loadConfigDir` did. That config has no learned files.
- It stops with a clear message when:
  - the worktree is missing;
  - the pack's schema differs from the old core's `DATA_SCHEMA_VERSION` (2 for both today).
- The old `buildDeck(request, pool, index, config)` and `BuildRequest` match the current ones, apart from fields the current core added: `learnedVersion` on decks and `closeness` in scores. The adapter maps every field explicitly.
- The adapter turns the old core's own `BuildError` into the current one.

## Build times

Measured on 2026-11-08 on the development desktop (Windows, Node 24), in one batch run after the first build. The command:

```sh
npm run review:build -- --jobs data/review/scratch/jobs-timing.json --out data/review/scratch/timing --force
```

The jobs file holds 20 jobs per version:

- `bulk-black` B, `bulk-blue` U, `bulk-green` G, `bulk-red` R, and `white-bulk` W, each at 60, 40, and 20, best fit, seed 1;
- `elf-tribe` at 100 under Lathril (seeds 1 to 3), Imaryll, and Dwynen.

`buildMs` is the median, with the range in brackets:

| Size | head                | v26.0.30            |
| ---- | ------------------- | ------------------- |
| 60   | 86 ms (73 to 222)   | 79 ms (63 to 335)   |
| 40   | 67 ms (45 to 195)   | 62 ms (44 to 186)   |
| 20   | 41 ms (37 to 79)    | 34 ms (28 to 104)   |
| 100  | 459 ms (125 to 543) | 402 ms (104 to 433) |

- The slowest 60, 40, and 20-card builds come from `white-bulk`, the largest of these pools (785 cards; the others hold about 300).
- At 100 cards, the two-color Lathril builds take 460 to 540 ms with head and 400 to 430 ms with v26.0.30. The mono-green commanders take about 125 ms and 105 ms.
- The first build in a process runs about twice as slow while Node warms up. A single `head` build of `bulk-black` B 60 took 272 ms, and the repeat from `--twice` took 103 ms.
- Loading the pack, learned data, and config takes about 0.4 s per run, outside these times.
- A rerun by a second reviewer the same day gave medians within about 10 ms of these at every size.
- The 3,000-card review pools build slower: `plain-01` UR 60 took 397 ms with head and 467 ms with v26.0.30, in one run.
