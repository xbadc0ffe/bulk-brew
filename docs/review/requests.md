# Test requests

The builds every version makes in Phase 3 of the builder review (`docs/algo-review.md`). One command writes them as job files for the runner (`docs/review/runner.md`), the same way every time, so every version gets exactly the same requests:

```sh
npm run review:requests                  # the default scope below
npm run review:requests -- --force       # replace job files made with another scope, pack, or config
```

The code is `packages/pipeline/src/review/requests.ts`; the pure parts are tested in `packages/pipeline/test/review-requests.test.ts`. It reads the pools from `data/review/pools/` (`docs/review/pools.md`), so run `npm run review:pools` first.

## Flags

| Flag                   | Default                         | Meaning                                                                              |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `--pools <kinds>`      | `plain,theme,public`            | Pool kinds, from `plain`, `theme`, `public`, `owner`. Owner pools only when asked.   |
| `--plain <n>`          | all 30                          | Only the first n plain pools, by id.                                                 |
| `--sizes <list>`       | `60,100,40,20`                  | Deck sizes.                                                                          |
| `--versions <ids>`     | `head,head-web,v26.0.30,random` | One pair of job files per version. Prototypes are added here by name.                |
| `--bestfit-only <ids>` | `head-web,random`               | Versions that get only the best-fit requests. `none` turns it off.                   |
| `--two-color`          | on                              | The two-color slice on plain pools at 60 and 40 (rule 1). `--no-two-color` drops it. |
| `--out <dir>`          | `data/review/jobs`              | Output folder.                                                                       |
| `--force`              | off                             | Replace job files that exist with other jobs.                                        |

The command needs no network and reads no clock. The data pack, the config, and the pools decide the requests, so a new pack or config can change them; `index.json` records the data and config versions.

## The rules

### 1. Colors per pool

Below 100 cards:

- **Plain, theme, and owner pools:** every mono color, W, U, B, R, and G, one request set each.
- **Public pools:** the colors named in the first comment line of the pool's source file in `eval/pools/` (the pool's `recipe`), read up to its first colon or full stop: the words white, blue, black, red, green, whole words, so "mono-white" counts. All colors named there form one color set. When it names none, the pool's largest mono color by copies (from `data/review/pools/index.json`, ties in WUBRG order). `eval/README.md` names no colors per pool, so the comments decide.

| Public pool          | Colors | From                                              |
| -------------------- | ------ | ------------------------------------------------- |
| bulk-black           | B      | "Synthetic black bulk pool"                       |
| bulk-blue            | U      | "Synthetic blue bulk pool"                        |
| bulk-green           | G      | "Synthetic green bulk pool"                       |
| bulk-red             | R      | "Synthetic red bulk pool"                         |
| creatures-only-green | G      | "Creature-only green pool"                        |
| elf-tribe            | G      | no color named; green is largest (307)            |
| gold-heavy-black     | B      | "Black pool padded with gold and off-color cards" |
| lands-blue           | U      | "Blue pool with a dozen nonbasic lands"           |
| thin-red             | R      | "Thin red pool"                                   |
| tiny-blue            | U      | "Tiny blue pool"                                  |
| white-bulk           | W      | "Mono-white bulk pool used as a builder fixture"  |

**The two-color slice.** Plain pools at 60 and 40 cards also get every two-color pair, each in WUBRG order: WU, WB, WR, WG, UB, UR, UG, BR, BG, RG. Each pair gets the same styles as a mono color (rule 2), and every job from it carries `"slice": "two-color"`. The jobs go in the same main and small files as the rest, so one batch builds them. Every other request is mono-color below 100 cards, so without the slice a version that handles two colors well or badly would never show it. `--no-two-color` leaves the slice out.

At 100 cards the colors are the commander's color identity (rule 3).

### 2. Styles per pool, color, and size

For each pool, color set, and size:

1. **Best fit** (no style), always. Reason `bestfit`.
2. **Every style the current core's scan calls viable,** in config order. Below 100 cards the scan is `scanPool(pool, index, config, settings, size, colors)` with `config/settings.defaults.json`. The runner requests a style with `requireStyle`, so a version must build it or decline; it never gets a best fit in its place.
   - **The shapes,** Aggro, Midrange, and Control (`kind: "composition"` in `config/archetypes.json`). Reason `shape`. They are the plain baseline a themed deck must beat (`docs/review/shortlist.md`, objection 3). They come first, as in the config.
   - **The themed styles** (`kind: "synergy"`): every other style. Reason `viable`.
3. **Theme pools only: the pool's enriched style** (the `<style>` in `theme-<style>-NN`), when step 2 did not already list it. Reason `enriched`. It is requested in every color set, even where the config limits the style's colors (burn is red and black, lifegain white, black, and green, mill blue and black), so the current builder declines those by definition. When the enriched style is viable it appears once, with reason `viable`; the pool id says which style was enriched.

Notes:

- Picking styles with the current scan favors the current builder's definitions of a theme. A prototype with its own definitions may be able to build a style the scan rules out, and is never asked to.
- A version that declines a request (the core's `BuildError`) is recorded in the deck file as an error: the pool could not make that request. It counts as "could not build", not as a bad deck.
- A version that answers a styled request with another style (its `deck.archetype` is not the requested id) is counted as declined too, when judging is collated (`docs/review/judging.md`).

### 3. Commanders at 100

1. List the pool's commanders with the core's `commanderCandidates(pool, index, config, settings)`, the list the Build page shows before any color or style is picked. Its order: tier (top, good, possible), then score, highest first, then name. Colorless commanders are already left out by the core.
2. Drop partners: any card with the keyword Partner, Partner with, Friends forever, Choose a background, or Doctor's companion. The core builds with one commander only.
3. Drop commanders the core marks as short of cards for the 99 (`enough` false), as the Build page's deck options do.
4. Sort what is left by tier, then score, then name (code-unit order). This is the core's own order; the sort only makes the tie break explicit.
5. Take the first two.
6. **Theme pools:** find the enriched style's best color. Scan the pool at 100 in each mono color; the best color is the one whose scan counts the most enabler plus payoff copies for the enriched style, among the style's own colors when the config limits them, ties in WUBRG order. If neither of the two picks has that color in its identity, the first commander in places 3 to 10 of the sorted list that has it takes the second place. If none of the first ten has it, the two picks stand.

For each picked commander, request best fit, every viable shape and themed style, the commander's viable tribes (`tribal:<Type>`, the core's `primaryTribes`), and for theme pools the enriched style as in rule 2. The viable styles come from the scan the builder itself makes: `scanCandidates` over the commander's colors at 100 with the commander removed from the candidates.

Notes:

- The Build page offers a style under a commander only when the commander's text supports it (`commanderSuits`). These requests do not filter by that, so some ask for a theme the commander does not care about; the builder still accepts any style its scan allows.
- On the default run, 17 theme pools swap their second commander for the theme's color, and `public-thin-red` and `public-tiny-blue` get no 100-card requests (no commander with enough cards). `public-elf-tribe` picks Camellia, the Seedmiser and Abomination of Llanowar, not Lathril, by the core's order; the Elf tribe is requested under Abomination of Llanowar.

### 4. Sizes, versions, and seeds

- 60 and 100 are the main set, `main-<version>.json`. 40 and 20 are the second set, `small-<version>.json`.
- One pair of files per version in `--versions`. Default `head`, `head-web`, `v26.0.30`, and `random`.
- Seed 1 for every job, except `random`, which gets seeds 1 and 2: two piles per request, so the panel's calibration has more random decks.
- `--bestfit-only` holds two versions by default, which get only the `bestfit` jobs:
  - `head-web` (the web Build page's first option) differs from `head` only for best-fit requests and equals it for requested styles.
  - `random` ignores the style, so a styled request would only repeat the same draw. Two seeds of best-fit piles per pool and color (4,158 piles with the two-color slice) are enough for the panel's calibration.
  - Both get the two-color slice's best-fit requests, so `head-web` is tested on choosing a plan in two colors too.
- A version not yet registered in `versions.ts` still gets its files; the command says so, and the runner reports those jobs as bad until the version exists.

### 5. Order

Jobs run size by size (60, then 100 in the main set; 40, then 20 in the second set), so a run cut short covers whole sizes first. Within a size: pool kind (plain, theme, public, owner), pool id, color set (the mono colors in WUBRG order, then on plain pools at 60 and 40 the two-color pairs in the order of rule 1; at 100: the commanders in pick order), then the styles in the order of rule 2, then seed.

## Files

All gitignored, in `data/review/jobs/`:

- `main-<version>.json` and `small-<version>.json`: an array of jobs, one per line.
- `index.json`: the data and config versions, the scope (with `twoColor`), and one entry per job file with `file`, `set`, `version`, `bestfitOnly` (when set), `sizes`, `jobs`, and `estimateSeconds`. The Phase 3 run loops over `files`.

A job is the runner's format plus fields the runner ignores:

```json
{
  "version": "head",
  "pool": "data/review/pools/public/elf-tribe.json",
  "colors": "BG",
  "size": 100,
  "style": "tribal:Elf",
  "commander": "<oracle id>",
  "commanderName": "Abomination of Llanowar",
  "seed": 1,
  "reason": "viable",
  "deck": "head/public-elf-tribe-BG-100-tribal-Elf-abomination-of-llanowar-s1.json"
}
```

- `reason`: `bestfit`, `shape`, `viable`, or `enriched`, as in rule 2.
- `slice`: `two-color` on the two-color slice's jobs (rule 1), absent on every other job. For example `{"version":"head","pool":"data/review/pools/plain/plain-01.json","colors":"WU","size":60,"seed":1,"reason":"bestfit","slice":"two-color","deck":"head/plain-01-WU-60-bestfit-s1.json"}`.
- `commanderName`: for people reading the file; the runner uses the oracle id.
- `deck`: the deck file the runner writes for this job, relative to its output folder, from the runner's own `deckFileName` and `loadPool` (pool ids are the pool files' own ids, such as `public-bulk-black`). Phase 3 scripts join decks to reasons through it.

Run a file with:

```sh
npm run review:build -- --jobs data/review/jobs/main-head.json
```

A second run with the same scope, pack, and config writes nothing: the files come out byte-identical (checked with a run into another folder and `cmp`). When a job file exists with other jobs, the command lists it and stops without writing anything; pass `--force` to replace it. Decks already built stay in `data/review/decks/` under their own names.

## Counts and time

The default run on 2026-11-08, data `2026-11-03.s2`, config `t5.c4.r2.a10.s8.l3.w11.k2.p1wyug0e.g1hono2u`: 95 pools (30 plain, 54 theme, 11 public), 33,452 requests per full version (2,079 best fit, 6,149 shape, 25,027 viable, 197 enriched), of which 10,538 are the two-color slice; a best-fit-only version gets the 2,079 best-fit requests, 600 of them two-color. Before the shapes and the slice were added it was 18,565.

```sh
npm run review:requests -- --force
```

The Shape and Two-color columns call out jobs that are also counted under Plain, Theme, and Public.

| Version  | Size | Plain | Theme | Public | Total | Shape | Two-color |                    Time |
| -------- | ---: | ----: | ----: | -----: | ----: | ----: | --------: | ----------------------: |
| head     |   60 |  7244 |  4014 |    104 | 11362 |  2166 |      5076 |                18.9 min |
| head     |  100 |   820 |  1509 |     73 |  2402 |   507 |         0 |                20.0 min |
| head     |   40 |  7839 |  4407 |    122 | 12368 |  2187 |      5462 |                14.4 min |
| head     |   20 |  2543 |  4634 |    143 |  7320 |  1289 |         0 |                 6.1 min |
| head     |  all |       |       |        | 33452 |  6149 |     10538 |                59.5 min |
| head-web |   60 |   450 |   270 |     11 |   731 |     0 |       300 |                 1.2 min |
| head-web |  100 |    60 |   108 |     18 |   186 |     0 |         0 |                 1.6 min |
| head-web |   40 |   450 |   270 |     11 |   731 |     0 |       300 |                    51 s |
| head-web |   20 |   150 |   270 |     11 |   431 |     0 |         0 |                    22 s |
| head-web |  all |       |       |        |  2079 |     0 |       600 | 4.0 min (best fit only) |
| v26.0.30 |   60 |  7244 |  4014 |    104 | 11362 |  2166 |      5076 |                18.9 min |
| v26.0.30 |  100 |   820 |  1509 |     73 |  2402 |   507 |         0 |                20.0 min |
| v26.0.30 |   40 |  7839 |  4407 |    122 | 12368 |  2187 |      5462 |                14.4 min |
| v26.0.30 |   20 |  2543 |  4634 |    143 |  7320 |  1289 |         0 |                 6.1 min |
| v26.0.30 |  all |       |       |        | 33452 |  6149 |     10538 |                59.5 min |
| random   |   60 |   900 |   540 |     22 |  1462 |     0 |       600 |                 2.4 min |
| random   |  100 |   120 |   216 |     36 |   372 |     0 |         0 |                 3.1 min |
| random   |   40 |   900 |   540 |     22 |  1462 |     0 |       600 |                 1.7 min |
| random   |   20 |   300 |   540 |     22 |   862 |     0 |         0 |                    43 s |
| random   |  all |       |       |        |  4158 |     0 |      1200 | 8.0 min (best fit only) |
| all      |  all | 40222 | 31882 |   1037 | 73141 | 12298 |     22876 |               130.9 min |

Time is an estimate: 0.1 s per job at 60, 0.07 s at 40, 0.05 s at 20, and 0.5 s at 100, from the runner's measured medians (`docs/review/runner.md`), plus about 0.4 s of loading per run. Per version, the main set takes about 39 minutes for `head` and `v26.0.30`, 2.8 for `head-web`, and 5.5 for `random`; the second set about 21, 1.2, and 2.4 minutes. Per full version, the two-color slice is about 15 of the 59.5 minutes and the shapes about 11. The medians come from mono-color builds; a two-color pool offers about twice the candidates, so the slice may take longer than this. Prototypes that build more slowly than the current core take longer.

Where the jobs come from, per full version:

| Size | Colors    | Best fit | Shape | Viable | Enriched | Total |
| ---: | --------- | -------: | ----: | -----: | -------: | ----: |
|   60 | mono      |      431 |  1266 |   4525 |       64 |  6286 |
|   60 | two-color |      300 |   900 |   3876 |        0 |  5076 |
|  100 | commander |      186 |   507 |   1676 |       33 |  2402 |
|   40 | mono      |      431 |  1287 |   5135 |       53 |  6906 |
|   40 | two-color |      300 |   900 |   4262 |        0 |  5462 |
|   20 | mono      |      431 |  1289 |   5553 |       47 |  7320 |

Shapes by style (all sizes): Aggro 2,057, Midrange 2,057, Control 2,035; the scan calls them viable for nearly every pool and color. Two-color requests per pair range from 1,019 (WG) to 1,100 (UB).

Enriched requests by style (all sizes): goad 41, group hug 40, mill 30, burn 29, lifegain 20, spells 14, tappers 6, enchantments 5, aristocrats 4, landfall 3, energy 3, auras 1, flyers 1. Burn, lifegain, and mill include the colors their config rules out.

The generation itself takes about a minute (mostly listing commanders on the 3,000-card pools). A smaller check:

```sh
npm run review:requests -- --plain 2 --pools plain,public --out data/review/scratch/jobs-test
```
