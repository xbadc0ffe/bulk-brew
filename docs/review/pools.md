# Test pools

The pools every builder version is tested on in Phase 3 of the builder review (`docs/algo-review.md`). All of them are made by one command, the same way every time:

```sh
npm run review:pools                     # writes only pools that are missing
npm run review:pools -- --force          # rewrites every pool
```

Flags: `--out <dir>` (default `data/review/pools`), `--only plain|theme|tribe|public|owner`, `--plain <n>` (plain pools, default 30), `--copies <n>` (copies per plain pool, default 3000), `--extra <n>` (theme or tribe copies per pool, default 120), `--themes <n>` (theme pools per style, default 3; 0 makes none and leaves the theme counts alone), `--rotate-themes` (spread the theme pools over the plain bases, below), `--tribes <n>` (tribe pools, default 0, below), `--seed-prefix <p>` (a new set of seeds, below), `--force`. Everything below uses the defaults.

The output is gitignored. Running the command twice gives byte-identical files (checked with sha256 over all 105 files after a `--force` rerun and after a plain rerun). The data pack, the config, and the EDHREC pages in `data/edhrec/` decide the cards, so a new pack, config, or page fetch can change the pools; the seeds never change. Each pool records the data pack and config versions that made it, and the command warns when pools on disk came from another pack or config: rerun with `--force` then, so the index and `themes.json` match the pools.

The code is `packages/pipeline/src/review/pools.ts`; the pure parts are tested in `packages/pipeline/test/review-pools.test.ts`.

## Files

- `data/review/pools/<kind>/<name>.json`: one pool.
- `data/review/pools/index.json`: one line per pool on disk.
- `data/review/pools/themes.json`: the theme candidate counts in the table below.
- `data/review/pools/tribes.json` (or `tribes-<prefix>.json`): the tribe table, from the pack (below).

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

- `kind` is `plain`, `theme`, `tribe`, `public`, or `owner`.
- `tribe`, on tribe pools only: the creature type, as the core names it in `tribal:<Type>`.
- `cards` is every copy in the pool as `[oracle id, copies]`, sorted by id.
- `added` appears on theme and tribe pools only: the copies drawn or added on top of the plain base, also sorted by id. They are already counted in `cards`.
- `seed` is the seed of the draw that made the pool (the theme draw for theme pools), and 0 for fixed lists.
- `dataVersion` and `configVersion` are the data pack and config the pool was made with.

An index entry has `id`, `kind`, `path` (relative to the index), `copies`, `distinct`, and `colors`: copies whose color identity is exactly W, U, B, R, or G, plus `multi` (two or more colors) and `colorless`. Lands count too.

## How many

| Kind   | Pools | Folder    |
| ------ | ----: | --------- |
| plain  |    30 | `plain/`  |
| theme  |    54 | `theme/`  |
| tribe  |     0 | `tribe/`  |
| public |    11 | `public/` |
| owner  |     8 | `owner/`  |

The seed prefix sets (below) add `h1` (12 plain, 54 theme), `h2` (12 plain, 18 theme), `h3` (12 plain, 6 tribe), and the development set `d5b` (12 plain, 6 tribe).

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

## Tribe-rich bulk

`--tribes <n>` makes n tribe pools, one per creature type, so tribe requests at 100 cards have real candidates. None exist without a prefix; the `h3` and `d5b` sets have six each (below).

**Which types.** Over the cards a bulk box can hold (`noiseSource`), the tool counts for every creature type a spell has (`tribeTable` in `pools.ts`):

- **commanders** that name it: cards that can be a commander, have a color, are not partners (the request rules drop those, `docs/review/requests.md` rule 3), and carry the type's Tagger tag `typal-<type>`, the tag the core's `commanderTribes` reads;
- **members**: spells of the type (`creatureTypes` from the core, changelings aside);
- **named by**: spells with the tag, members or not.

Types rank by commanders times members, then by name, and the first n are picked. A two-word type stays whole: the Comprehensive Rules (205.3m) name one, Time Lord, so "Time Lord Doctor" is a Time Lord and a Doctor, and `typal-time-lord` is its tag. When the first n hold no two-word type and a commander names one, it takes the last place. With the current pack none does: five cards carry `typal-time-lord`, none of them a commander, and The Sixth Doctor's "Time Lord's Prerogative" is an ability word without the tag. A tag that is no creature type, such as `typal-goblin-orc`, names nothing.

From `npm run review:pools` on pack `2026-11-03.s2` (also in `tribes-h3.json`, which holds pack counts only):

| Type    | Commanders | Members | Named by | Picked |
| ------- | ---------: | ------: | -------: | ------ |
| Human   |         26 |    4482 |      102 | yes    |
| Warrior |         18 |    1243 |       99 | yes    |
| Wizard  |         18 |    1187 |      114 | yes    |
| Spirit  |         23 |     671 |      127 | yes    |
| Elf     |         22 |     678 |      117 | yes    |
| Dragon  |         34 |     420 |      120 | yes    |
| Zombie  |         17 |     604 |      118 |        |
| Rogue   |         17 |     577 |       91 |        |
| Goblin  |         16 |     523 |      122 |        |
| Hero    |         27 |     297 |       42 |        |
| Soldier |          7 |    1078 |       48 |        |
| Cleric  |         11 |     655 |       75 |        |

**The pool.** The k-th picked type (k from 1) sits on plain base `--plain` + k, a base no plain pool uses, so each tribe pool has a base of its own. On top of it:

- `--extra` copies (120) drawn by `noisePool` with seed `hash32('review:tribe:<Type>:<base>')` (with a prefix, `review:<prefix>:tribe:...`) over the type's candidates: spells of the type, changelings (every creature type, CR 702.73a), and spells whose tags name the type, lords among them. The naming commanders are left out of the draw. An empty rarity borrows as theme pools do;
- one copy of each commander that names the type.

Files `tribe/<type>-NN.json`, ids `tribe-<type>-NN` (with a prefix, `tribe/h3-elf-17.json` and `h3-tribe-elf-17`), the type in lower case with dashes, kind `tribe`, the type in the `tribe` field. The recipe names the base, the candidate counts, the seed text, and how many commanders were added.

## Seed prefixes: new pools for a new round

`plain-01` to `plain-30` and the theme pools on them were development pools for the prototypes, so a later round needs pools no one has built on. A seed prefix (letters and digits, and not a pool kind: `plain`, `theme`, `public`, and `owner` are refused in any case, since the first round's ids start with them) makes a new set the same way:

```sh
npm run review:pools -- --seed-prefix h1
```

- Plain pools `h1-plain-01` to `h1-plain-30`, in `plain/h1-plain-NN.json`, from `hash32('review:h1:plain:' + n)`.
- Theme pools `h1-theme-<style>-01` to `-03`, in `theme/h1-<style>-NN.json`, each on `h1-plain-NN` (n = 1 to 3) with extras from `hash32('review:h1:theme:' + style + ':' + n)`.
- Tribe pools, with `--tribes`, `h1-tribe-<type>-NN` in `tribe/h1-<type>-NN.json`, with extras from `hash32('review:h1:tribe:' + type + ':' + n)`, and their counts in `tribes-h1.json`.
- The recipes name the prefix, such as `noisePool(noiseSource(index), hash32('review:h1:plain:1'), 3000)`.
- `--only plain|theme|tribe` and `--plain <n>` work as without a prefix. Public and owner pools have no seed, so a prefixed run leaves them alone, and `--only public` or `--only owner` with a prefix is an error.
- The theme candidate counts go to `themes-h1.json`, so `themes.json` stays the first set's.
- The index lists every pool on disk, prefixed or not. `npm run review:requests -- --prefix h1` picks one set (`docs/review/requests.md`).

Without the flag, the files are byte-identical to the ones before it existed: on 2026-11-11 a rerun into another folder matched all 30 plain, 54 theme, and 11 public files and `themes.json`.

**Theme pools per style and their bases.** `--themes <n>` makes n theme pools per style instead of 3. They sit on plain bases 1 to n, as above, unless `--rotate-themes` is given: then the k-th style in config order (k from 0) takes bases k + 1 to k + n, wrapping over the `--plain` bases, so one pool per style spreads the styles over every base instead of stacking them on the first. A pool's id, file, and seed text keep its base number (`h2-theme-counters-02`, `theme/h2-counters-02.json`, `hash32('review:h2:theme:counters:2')`), and its recipe names the base. With `--rotate-themes`, `--themes` may not exceed `--plain`, since two pools of one style on one base would share an id. Without either flag nothing changes.

### h1: builder phase 1

12 plain pools and 54 theme pools (18 styles on `h1-plain-01` to `-03`), made on 2026-11-11 for the panel of `docs/builder-phase1.md`; `--seed-prefix h1 --plain 12` makes this set.

### h2: builder phase 2, step 3

Held out for the plan picker's panel (`docs/builder-phase2.md`, step 3). Nobody may open, print, or summarize these pools beyond their file names and card counts while building; the command's theme table and `themes-h2.json` count cards in the bases, so leave them unread too. Made on 2026-11-17 with data pack `2026-11-03.s2` and config `t5.c4.r2.a10.s8.l4.w12.k2.h5.n2.qdi9pv.p1wyug0e.g1hono2u`, with the EDHREC pages in `data/edhrec/` as for the first rounds:

```sh
npm run review:pools -- --seed-prefix h2 --plain 12 --themes 1 --rotate-themes
```

- Seed prefix `h2`: plain pools from `hash32('review:h2:plain:' + n)`, theme extras from `hash32('review:h2:theme:' + style + ':' + base)`.
- 12 plain pools, `plain/h2-plain-01.json` to `h2-plain-12.json`, 3,000 copies each.
- 18 theme pools, one per themed style (the 18 synergy styles of `config/archetypes.json`, the same styles `config/theme-rules.json` describes), 3,120 copies each, on rotated bases: `theme/h2-tokens-01`, `counters-02`, `aristocrats-03`, `graveyard-04`, `spells-05`, `lifegain-06`, `artifacts-07`, `auras-08`, `flyers-09`, `burn-10`, `landfall-11`, `mill-12`, `enchantments-01`, `bigCreatures-02`, `tappers-03`, `groupHug-04`, `goad-05`, `energy-06` (each `.json`).
- 30 pools in all, 92,160 copies.

### h3: builder phase 2, step 5

Held out for the panel of step 5 (`docs/builder-phase2.md`: 20-card packets and Commander, tribes included). The same rule as h2: nobody may open, print, or summarize these pools beyond their file names and card counts while building, and `tribes-h3.json` and the command's tribe table hold pack counts only. Made on 2026-11-17 with data pack `2026-11-03.s2` and config `t5.c4.r2.a10.s8.l4.w13.k2.h6.n3.qpscuep.p1wyug0e.g1hono2u` (26.0.41):

```sh
npm run review:pools -- --seed-prefix h3 --plain 12 --themes 0 --tribes 6
```

- Seed prefix `h3`: plain pools from `hash32('review:h3:plain:' + n)`, tribe extras from `hash32('review:h3:tribe:' + type + ':' + base)`.
- 12 plain pools, `plain/h3-plain-01.json` to `h3-plain-12.json`, 3,000 copies each.
- No theme pools.
- 6 tribe pools on bases 13 to 18, each 3,000 base copies plus 120 extras plus one copy of each naming commander: `tribe/h3-human-13` (3,146 copies), `warrior-14` (3,138), `wizard-15` (3,138), `spirit-16` (3,143), `elf-17` (3,142), `dragon-18` (3,154) (each `.json`).
- 18 pools in all, 54,861 copies. A second run into another folder gave byte-identical files.

### d5b: development tribe pools for step 5

Development data for tribes on the grow builder (step 5), not held out: built on, measured, and read while building. Made on 2026-11-17 with data pack `2026-11-03.s2` and the theme rules version 8 work:

```sh
npm run review:pools -- --seed-prefix d5b --plain 12 --themes 0 --tribes 6
npm run review:requests -- --prefix d5b --sizes 100 --versions head,head-web --bestfit --tribe-versions head,head-web --commanders 2 --out data/review/jobs-d5b
```

- 12 plain pools `plain/d5b-plain-01.json` to `d5b-plain-12.json`, and 6 tribe pools on bases 13 to 18, the same types as h3 on other seeds: `tribe/d5b-human-13`, `warrior-14`, `wizard-15`, `spirit-16`, `elf-17`, `dragon-18` (each `.json`).
- Jobs in `data/review/jobs-d5b/`: per version 60 at 100 cards, best fit under each pool's first two commanders (36) and each tribe pool's tribe under the first four commanders that name it and can build it (24).

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
