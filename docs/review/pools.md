# Test pools

The pools every builder version is tested on in Phase 3 of the builder review (`docs/algo-review.md`). All of them are made by one command, the same way every time:

```sh
npm run review:pools                     # writes only pools that are missing
npm run review:pools -- --force          # rewrites every pool
```

Flags: `--out <dir>` (default `data/review/pools`), `--only plain|theme|public|owner`, `--plain <n>` (plain pools, default 30), `--copies <n>` (copies per plain pool, default 3000), `--extra <n>` (theme copies per theme pool, default 120), `--seed-prefix <p>` (a new set of seeds, below), `--force`. Everything below uses the defaults.

The output is gitignored. Running the command twice gives byte-identical files (checked with sha256 over all 105 files after a `--force` rerun and after a plain rerun). The data pack, the config, and the EDHREC pages in `data/edhrec/` decide the cards, so a new pack, config, or page fetch can change the pools; the seeds never change. Each pool records the data pack and config versions that made it, and the command warns when pools on disk came from another pack or config: rerun with `--force` then, so the index and `themes.json` match the pools.

The code is `packages/pipeline/src/review/pools.ts`; the pure parts are tested in `packages/pipeline/test/review-pools.test.ts`.

## Files

- `data/review/pools/<kind>/<name>.json`: one pool.
- `data/review/pools/index.json`: one line per pool on disk.
- `data/review/pools/themes.json`: the theme candidate counts in the table below.

A pool file:

```json
{
  "id": "theme-graveyard-01",
  "kind": "theme",
  "recipe": "plain-01 [...] plus 120 copies from 3639 graveyard cards (...)",
  "seed": 2208568744,
  "dataVersion": "2026-11-03.s2",
  "configVersion": "t5.c4.r2.a10...",
  "cards": [["<oracle id>", 2], ...],
  "added": [["<oracle id>", 1], ...]
}
```

- `kind` is `plain`, `theme`, `public`, or `owner`.
- `cards` is every copy in the pool as `[oracle id, copies]`, sorted by id.
- `added` appears on theme pools only: the theme copies drawn on top of the plain base, also sorted by id. They are already counted in `cards`.
- `seed` is the seed of the draw that made the pool (the theme draw for theme pools), and 0 for fixed lists.
- `dataVersion` and `configVersion` are the data pack and config the pool was made with.

An index entry has `id`, `kind`, `path` (relative to the index), `copies`, `distinct`, and `colors`: copies whose color identity is exactly W, U, B, R, or G, plus `multi` (two or more colors) and `colorless`. Lands count too.

## How many

| Kind   | Pools | Folder    |
| ------ | ----: | --------- |
| plain  |    30 | `plain/`  |
| theme  |    54 | `theme/`  |
| public |    11 | `public/` |
| owner  |     8 | `owner/`  |

## Plain bulk: the main test

Recipe: `noisePool(noiseSource(index), hash32('review:plain:' + n), 3000)` for n = 1 to 30, from `packages/pipeline/src/corpus.ts`. Files `plain/plain-01.json` to `plain/plain-30.json`, ids `plain-01` to `plain-30`.

- `noiseSource` holds every card a bulk box can hold: no Un-set cards, no cards that are not legal in Commander, no basic lands, and only cards with a known rarity (the lowest rarity among their paper printings).
- `noisePool` picks a rarity for each draw (55% common, 30% uncommon, 12% rare, 3% mythic), then a card of that rarity, then 1 to 3 copies of a common, 1 to 2 of an uncommon, or 1 of a rare or mythic, until it has 3,000 copies.
- Nothing is hidden in them: no real deck, no theme.

Over the 30 pools (from `data/review/pools/index.json`):

| Measure                        | Median | Lowest | Highest |
| ------------------------------ | -----: | -----: | ------: |
| Distinct cards                 |   1706 |   1671 |    1767 |
| White copies                   |    489 |    414 |     534 |
| Blue copies                    |  480.5 |    423 |     551 |
| Black copies                   |    484 |    440 |     538 |
| Red copies                     |    482 |    411 |     583 |
| Green copies                   |    471 |    412 |     523 |
| Multicolor copies              |    374 |    310 |     436 |
| Colorless copies (incl. lands) |  224.5 |    175 |     248 |

## Theme-rich bulk

For each themed style in `config/archetypes.json` (every style except Aggro, Midrange, and Control: 18 styles), three pools: plain pool n (n = 1, 2, 3) plus 120 copies of that theme's cards. Files `theme/<style>-01.json` to `theme/<style>-03.json`, ids `theme-<style>-01` and so on. Each has 3,120 copies.

The extras are drawn by `noisePool` itself over the theme's candidate cards with seed `hash32('review:theme:' + style + ':' + n)`, so they keep the bulk rarity shares and copy limits. When a rarity has no candidates, that rarity borrows the next rarer rarity's cards (mythic borrows rare) and keeps its own share and copy limit. No style needed this with the current pack.

A style's candidate cards are the cards in `noiseSource` (so the same exclusions as plain bulk) that are spells and either:

- **matcher cards:** the style's enabler or payoff matchers accept them. This is `factsFor(...).enablerOf` and `.payoffOf` from `@bulk-brew/core`, the same facts `scan.ts` counts; like the scan, only spells count; or
- **EDHREC cards:** they appear on the style's EDHREC theme pages in `data/edhrec/pages/tags/`. The pages per style are the ones `EDHREC_THEMES` in `packages/pipeline/src/learn-build.ts` maps to it. Commander lists are skipped, names resolve through the card index, and only cards with a positive EDHREC synergy count, so format staples such as Sol Ring stay out.

Tappers has no EDHREC page in that mapping, so its pools use the matcher cards alone.

Counts from `npm run review:pools` (also in `data/review/pools/themes.json`). "Added by EDHREC" is EDHREC cards the matchers do not accept. "Already in base" is copies of candidate cards in plain pools 1, 2, and 3 before the 120 extras.

| Style (label)         | Matcher cards | EDHREC pages                                         | EDHREC cards | Added by EDHREC | Candidates | Common / uncommon / rare / mythic | Already in base |
| --------------------- | ------------: | ---------------------------------------------------- | -----------: | --------------: | ---------: | --------------------------------- | --------------- |
| tokens (Tokens)       |          3826 | tokens, go-wide, populate                            |          287 |             152 |       3978 | 579 / 1167 / 1705 / 527           | 254 / 263 / 256 |
| counters (+1/+1)      |          3890 | plus-1-plus-1-counters, counters-matter, proliferate |          387 |             210 |       4100 | 955 / 1284 / 1474 / 387           | 324 / 293 / 325 |
| aristocrats           |          4453 | aristocrats, sacrifice                               |          288 |             165 |       4618 | 968 / 1333 / 1815 / 502           | 360 / 368 / 332 |
| graveyard             |          3465 | reanimator, graveyard, self-mill, dredge             |          328 |             174 |       3639 | 950 / 1044 / 1305 / 340           | 313 / 268 / 297 |
| spells (Spellslinger) |          7791 | spellslinger, prowess, storm, spell-copy             |          506 |             184 |       7975 | 3147 / 2377 / 2196 / 255          | 749 / 860 / 862 |
| lifegain              |          2533 | lifegain                                             |          241 |             121 |       2654 | 813 / 841 / 763 / 237             | 235 / 257 / 266 |
| artifacts             |          4743 | artifacts, affinity                                  |          326 |             106 |       4849 | 1191 / 1539 / 1787 / 332          | 356 / 433 / 399 |
| auras (Voltron)       |          2195 | voltron, equipment, auras                            |          446 |             241 |       2436 | 853 / 811 / 641 / 131             | 229 / 267 / 236 |
| flyers (Evasion)      |          4643 | flying, unblockable                                  |          415 |             289 |       4932 | 1219 / 1382 / 1802 / 529          | 433 / 370 / 444 |
| burn                  |          2302 | burn, pingers                                        |          308 |             229 |       2531 | 633 / 775 / 891 / 232             | 230 / 183 / 266 |
| landfall              |           840 | landfall, lands-matter                               |          220 |              89 |        929 | 174 / 253 / 377 / 125             | 71 / 50 / 84    |
| mill                  |           490 | mill                                                 |          232 |             171 |        661 | 128 / 168 / 295 / 70              | 48 / 40 / 43    |
| enchantments          |          3789 | enchantress                                          |          147 |              32 |       3821 | 944 / 1251 / 1481 / 145           | 312 / 280 / 311 |
| bigCreatures (Ramp)   |          5716 | ramp, big-mana, stompy                               |          375 |             252 |       5968 | 1402 / 1445 / 2200 / 921          | 397 / 406 / 440 |
| tappers               |           855 | none                                                 |            0 |               0 |        855 | 345 / 282 / 184 / 44              | 70 / 84 / 79    |
| groupHug (Group hug)  |           442 | group-hug                                            |          199 |             113 |        555 | 55 / 99 / 362 / 39                | 27 / 37 / 25    |
| goad                  |           176 | forced-combat                                        |          237 |             185 |        361 | 64 / 106 / 159 / 32               | 30 / 39 / 20    |
| energy                |           137 | energy                                               |          178 |              86 |        223 | 49 / 64 / 89 / 21                 | 20 / 22 / 20    |

What this means for testing:

- For the twelve broad styles the matchers accept 2,200 to 7,800 cards, the same broad definitions the review questions, and plain bulk already holds about 180 to 860 copies of them. The 120 extras are a modest bump there and are mostly cards with a theme word, not a planned mix of setup and payoff.
- For the six narrow styles (landfall, mill, tappers, group hug, goad, energy) the extras multiply the theme's copies by about 2.4 to 7, so these pools test whether a builder finishes a plan it could not reach in plain bulk.
- Extras follow the theme's own color mix across all colors, so a one- or two-color request sees only part of the 120.
- Goad takes about half its candidates from EDHREC (185 of 361) and energy about two in five (86 of 223), so their extras lean on EDHREC's view of the theme.

## Seed prefixes: new pools for a new round

`plain-01` to `plain-30` and the theme pools on them were development pools for the prototypes, so a later round needs pools no one has built on. A seed prefix (letters and digits) makes a new set the same way:

```sh
npm run review:pools -- --seed-prefix h1
```

- Plain pools `h1-plain-01` to `h1-plain-30`, in `plain/h1-plain-NN.json`, from `hash32('review:h1:plain:' + n)`.
- Theme pools `h1-theme-<style>-01` to `-03`, in `theme/h1-<style>-NN.json`, each on `h1-plain-NN` (n = 1 to 3) with extras from `hash32('review:h1:theme:' + style + ':' + n)`.
- The recipes name the prefix, such as `noisePool(noiseSource(index), hash32('review:h1:plain:1'), 3000)`.
- `--only plain|theme` and `--plain <n>` work as without a prefix. Public and owner pools have no seed, so a prefixed run leaves them alone, and `--only public` or `--only owner` with a prefix is an error.
- The theme candidate counts go to `themes-h1.json`, so `themes.json` stays the first set's.
- The index lists every pool on disk, prefixed or not. `npm run review:requests -- --prefix h1` picks one set (`docs/review/requests.md`).

Without the flag, the files are byte-identical to the ones before it existed: on 2026-11-11 a rerun into another folder matched all 30 plain, 54 theme, and 11 public files and `themes.json`.

## Public fixed pools

Every `eval/pools/*.txt`, read with `parseDecklist` and `resolveLines` from `@bulk-brew/core` (default options, so Un-set cards stay unresolved), duplicates summed. Files `public/<name>.json`, ids `public-<name>`, `kind: "public"`, seed 0, recipe the source path. Every line resolved.

| Pool                 | Copies | Distinct | Unresolved lines |
| -------------------- | -----: | -------: | ---------------: |
| bulk-black           |    305 |      150 |                0 |
| bulk-blue            |    289 |      150 |                0 |
| bulk-green           |    298 |      150 |                0 |
| bulk-red             |    293 |      150 |                0 |
| creatures-only-green |    246 |      120 |                0 |
| elf-tribe            |   1600 |      928 |                0 |
| gold-heavy-black     |    480 |      240 |                0 |
| lands-blue           |    289 |      152 |                0 |
| thin-red             |     61 |       40 |                0 |
| tiny-blue            |     34 |       20 |                0 |
| white-bulk           |    785 |      422 |                0 |

## The owner's bulk

Every `test-bulk/*.txt` when that folder exists, read the same way as the public pools, to `owner/<name>.json` with `kind: "owner"`. These lists are personal: they and every result from them stay in `data/review/`, and the command prints only counts for them. Eight owner pools exist locally.
