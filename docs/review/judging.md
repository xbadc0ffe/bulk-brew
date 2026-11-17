# Judging tools

The blind panel in Phase 3 of the builder review (`docs/algo-review.md`) works through two commands:

- `npm run review:packets` samples stored decks and writes one packet file per judge task, plus an answer key the judges never see.
- `npm run review:collate` checks the judges' answers, joins them with the key, and writes the tables the report needs.

Neither command uses the network. The code is `packages/pipeline/src/review/packets.ts` and `collate.ts`; the tests are `packages/pipeline/test/review-judging.test.ts`. The rubric the judges follow is `docs/review/rubric.md`.

## Making a batch

```sh
npm run review:packets -- --batch <name> --quota 2 --pairs 40 --two-judges 0.25
npm run review:packets -- --batch <name> --plan data/review/scratch/plan.json --pairs 40
```

| Flag               | Meaning                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--batch <name>`   | Required. Letters, digits, dots, dashes, and underscores. Names the packet folder, the key, the judgments folder, and the results. Judges see it, so name no version in it.    |
| `--quota <n>`      | Draw n decks per version, per size, per pool kind. Give this or `--plan`, not both.                                                                                            |
| `--plan <file>`    | A sampling plan (below). Paths are relative to the repo root.                                                                                                                  |
| `--decks <spec>`   | A folder (searched recursively for `.json`), one file, or a glob with `*`, `**`, `?`, and `{a,b}`. Default `data/review/decks`. Quote globs so the shell does not expand them. |
| `--also <spec>`    | More deck files, as `--decks` reads them, such as anchors or hand-built decks outside a `--decks` glob. Repeat it for more. A file found twice counts once. Kept in the key.   |
| `--seed <n>`       | Whole number, default 1. Every draw and every shuffle comes from it.                                                                                                           |
| `--pairs <n>`      | Pair packets to make, default 0.                                                                                                                                               |
| `--two-judges <x>` | Share of each version's single packets copied for a second judge, from 0 to 1. Default 0.25.                                                                                   |
| `--anchors <n>`    | Anchor decks per anchor version (`random`, `real`) and size, drawn seeded. Default 25.                                                                                         |
| `--no-anchors`     | The same as `--anchors 0`: no anchor decks unless the plan asks for them.                                                                                                      |
| `--out <dir>`      | Packet root, default `data/review/packets`.                                                                                                                                    |
| `--force`          | Replace a batch of the same name. Without it, an existing batch is never overwritten.                                                                                          |

### Which decks

- Every file that is not a review deck (no `version`, `request`, `deck`, and `pool`) is skipped and noted in the key.
- A deck file with `error` set is never drawn. It counts as **declined**: the version could not build that request. The key's `inventory` records, per version, size, requested style, and pool kind, how many of all the deck files the spec found were built and how many declined. Collation recounts them from the deck files (below).
- **Another style built counts as declined.** When a request names a style and the deck's `deck.archetype` is not that style, the version answered a different question, such as a Graveyard request built as Midrange. Ids compare whole, so `tribal:Elf` must come back as `tribal:Elf`. A best-fit request has no style and never counts. Such a deck can still be drawn, but the inventory counts it as declined, with the number of them in `substituted`, and collation leaves its judgment out (below). The reason: the rubric lets a plain deck be decent whatever was asked for, so a substituted deck could otherwise pass as a decent build of the theme (`docs/review/shortlist.md`, objection 5).
- **Anchors.** For each anchor version (`random`, `real`) and each size, `--anchors` decks (25 by default) are drawn without replacement, in quota and plan mode alike; a size with fewer gives all it has, and the key notes the shortfall. Before the cap, every anchor joined: on 2026-11-08 `data/review/decks/random/` held 2,963 piles, and `--quota 2` gave 3,131 anchor decks beside 34 builder decks. With `--no-anchors`, plan entries can still sample anchors, such as `{ "version": "random", "size": 60, "kinds": ["plain"], "count": 10 }`.
- **Quota.** For each version (anchors aside), each size, and each pool kind, n decks are drawn without replacement. A group with fewer than n decks gives all it has, and the key notes the shortfall.
- **Plan.** A JSON array; each entry draws `count` decks that match it, without replacement across entries:

  ```json
  [
    { "version": "head", "size": 60, "kinds": ["plain", "theme"], "count": 40 },
    { "version": "head", "size": 60, "styles": ["graveyard", "tokens"], "count": 10 },
    { "version": "proto-a", "count": 30 }
  ]
  ```

  `version` and `count` are required. `size`, `kinds`, and `styles` narrow the match when given. A style is the requested style id, or `bestfit` for a best fit request. Five more fields narrow or steer an entry:
  - `poolPrefix`: the pool id must start with it, such as `"h1-"` for one seed prefix's pools (`docs/review/pools.md`).
  - `substituted`: `true` takes only decks built in another style than the one requested (such as a note-and-nearest deck), `false` only decks that kept it. Best fit never substitutes, so it counts as kept. Absent takes any.
  - `sameAs`: the number (from 1) of an earlier entry. This entry first takes its own version's decks for the requests that entry drew, in the order it drew them: the same pool (id and cards), size, colors, style, secondary, and commander, with the seed ignored so a one-seed version matches either `random` pile. A deck of this version that declined the request has nothing to draw, and one built in another style is passed over unless the entry asks for `substituted: true`, since collation would set its judgment aside. The entry takes the earlier entry's `size`, `kinds`, `styles`, and `poolPrefix` unless it gives its own, so its top-up and the pairs drawn from the plan stay on the same pools. Its other fields still filter, and `count` caps it. Then it tops up at random to `count`. The key's notes say, per such entry, how many of the earlier entry's requests matched, how many found a declined deck, a deck in another style, or no deck left to draw, and how many more came at random. This makes paired singles: two versions judged on the same requests.
  - `spread`: `true` spreads the entry's own draw over pools and colors instead of drawing uniformly (the spread draw, below). On a `sameAs` entry it applies only to the top-up.
  - `requests`: a jobs file from `review:requests`, such as `"data/review/jobs-h2/main-head.json"` (fixed picks, below). Not with `sameAs`.

  ```json
  [
    {
      "version": "head",
      "poolPrefix": "h1-",
      "size": 60,
      "styles": ["graveyard", "tokens"],
      "count": 40
    },
    { "version": "v26.0.35", "sameAs": 1, "count": 40 },
    { "version": "head", "poolPrefix": "h1-", "substituted": true, "count": 10 }
  ]
  ```

- **The spread draw** (`spreadPicks` in `packets.ts`). The candidates (an entry's matching decks, or with `requests` the requests of a jobs file), sorted, are shuffled with the seed text `review:packets:<seed>:plan:<entry index from 0>`, as a uniform draw would be. Then the picks are made one at a time: each takes the first candidate left in that order whose pool has the fewest picks so far, and among those, whose most-picked color letter has the fewest picks so far. The letters are the requested colors (W, U, B, R, G; a request with no colors counts as C), so a two-color request counts by the more-picked of its two. Decks the entry already took through `sameAs` count as picks. So every pool is picked once before any pool twice, the colors stay level within each round, and the first few picks already cover different pools and colors. Only the pool and the requested colors count: never the style or the colors a version built.

- **Fixed picks.** An entry with `requests` draws requests, not decks: the jobs file's requests that match the entry (`size`, `kinds`, `styles`, and `poolPrefix`, read from the job's deck file name, which starts with the pool id), one per request with the seed aside, sorted, then `count` of them, spread or uniform. No version's decks enter the choice, so what any version built or declined cannot move it. For each picked request the entry takes its own version's deck (the same pool file, size, colors, style, secondary, and commander). A `sameAs` entry naming it takes the first `count` of the same picked requests, in pick order, and its own version's deck for each. A picked request a version declined, answered with another style, or has no deck file for gets no packet and nothing in its place: the key's `picks` records it (per entry, version, and request: `packet`, `declined`, `another style`, or `missing`, with the deck file, the style built, and the packet id), and collation counts it as not decent. The key's notes give the counts per entry. The review:requests job files hold the same requests for every version, so any version's file serves.

- **Pool kind** comes from where the pool file lives: `data/review/pools/<kind>/` gives `plain`, `theme`, `tribe`, `public`, or `owner`; `eval/pools/` is `public`; `test-bulk/` is `owner`; anything else is `other`.

Draws use `hash32` and `rng` from `packages/pipeline/src/corpus.ts` with seed text such as `review:packets:<seed>:quota:<version>|<size>|<kind>` and `review:packets:<seed>:anchors:<version>|<size>`, over files sorted by path. The same deck files and flags give byte-identical packets and key.

### Pairs

A pair packet shows decks A and B of the same size, built by two different versions. Anchor versions never join pairs, declined builds never do either, and each deck joins at most one pair. Pairs are drawn from the same scope as the singles: every non-anchor deck under `--quota`, or the decks that match a plan entry. The tool looks in three steps and moves on only when the earlier step runs out:

1. the same pool and the same request (colors, style, secondary, commander, seed): the head-to-head the report needs. The two decks get the same input, so they stay paired when a best fit builds fewer colors than were asked for; the packet then shows each deck's colors;
2. the same pool and size, and the same built colors;
3. the same size and built colors.

Built colors are `deck.colors`, or the request's colors in deck files built before that field existed.

Within a step, version pairs take turns, so each pair of versions gets a share. A seeded coin per pair decides which deck is A. The key records the step as `match`.

### Two judges

`--two-judges 0.25` copies a seeded quarter of each version's single packets (rounded per version), so the agreement table covers every version alike and not mostly anchors. Each copy gets its own number in the same shuffled numbering as every other single packet, so a judge cannot tell a copy from an original. The copy's key entry has `duplicateOf`, the id of the first packet.

## Files

```
data/review/packets/<batch>/p-0001.md ...      one deck each
data/review/packets/<batch>/pair-0001.md ...   decks A and B each
data/review/packets/<batch>/index.json         [{ "id", "kind": "single" | "pair" }]
data/review/packets/<batch>/PROMPT.md          what each judge is given
data/review/keys/<batch>.json                  the answer key
data/review/judgments/<batch>/<id>.json        one answer per packet, written by the judge
data/review/results/<batch>.json and .md       the collation
```

Everything is under `data/review/`, which is gitignored.

### The packet

Packet numbers are a seeded shuffle, so the number says nothing about the version, pool, or request. A single packet holds:

- a header: size, the deck's own colors (`deck.colors`, or the request's in older files), the requested style, and the commander at 100 cards;
- the deck list grouped by type (Commander, Creatures, Planeswalkers, Instants, Sorceries, Artifacts, Enchantments, Battles, Lands), with copies and a count per group, basics included;
- `## Cards`: one block per distinct card, sorted by name, with copies, mana cost and mana value, type line, power and toughness or loyalty, keywords, and the oracle text. Two-faced, split, and adventure cards show each face's name, cost, type, stats, and text.

A pair packet has the same header (with each deck's colors when they differ, and the requested style only on a same-request pair, below), a list for Deck A and one for Deck B, and one card block per distinct card in either deck, with copies in each ("Copies: A 4, B 0").

**The requested style.** The line after Colors tells the judge what was asked for, in the config's words: `- Requested style: Graveyard. Fill the graveyard, then bring things back or get paid for what is in it.`, the label and description from `config/archetypes.json`. A tribe reads `- Requested style: Elf tribe. Elf creatures and the cards that reward them.` A best-fit request reads `- Requested style: none (the builder picked)`. A same-request pair shows its request's line, the "none" line for best fit; other pairs may hold decks asked for different things, so they show no style line. The pair answer has no style question, and the rubric tells the judge to pick by the bar as if no style were shown. The line comes from `request.style` alone, never from what the version built: not `deck.archetype`, the deck's name, or a secondary style. The judge answers whether the deck is a decent deck of that style (`docs/review/rubric.md`, "The requested style").

Lands are shown the same way for every version. A plain basic a version lists among its cards joins the basics, and a name listed twice shows once with its copies added. Builders never play snow basics, so in a `real` deck they would stand out: when no card in the deck reads snow ("snow" or `{S}` in its text or cost), each snow basic shows as the plain basic of its type, which plays the same. A deck that reads snow keeps them, since its payoffs need them. Wastes and Snow-Covered Wastes stay as they are. In the 170 `real` decks of 2026-11-08, one deck has snow basics, and it reads snow.

Card facts come from the data pack's `CardIndex`, copied field by field (`packetCard` in `packets.ts`). The renderer reads only the deck's card ids and copies, its basics, the request's size, colors, and style, and the commander. So a packet never shows anything that gives a version or an anchor away (the list in `docs/review/anchors.md`): not `version`, `versionNotes`, the pool (`id`, `source`, `hash`), `deck.name`, `archetype`, the secondary style, any `why`, `explanation`, or the deck's file name. Nor does it show anything the builder thinks of a card: no tags, roles, styles, strength, rarity, or popularity rank. The tests check each of these fields with a marker string. A card missing from the pack shows "Text missing from the data pack." so the judge can say so.

### The key

`data/review/keys/<batch>.json` sits outside the packet folder. It holds:

- `options`: the flags, including the plan, the seed, and `also` when given;
- `dataVersion` and `rubricHash` (FNV-1a of the rubric text the prompt carried);
- `packets`: for every packet id, either
  - a single: `{ kind: "single", file, version, pool: { id, source, kind }, request, archetype, copies, duplicateOf?, styleShown }`, where `archetype` is the style the version built and `styleShown` the requested style the packet showed (null for none), or
  - a pair: `{ kind: "pair", pair: { A, B, match }, styleShown? }`, where A and B have the same fields as a single and `styleShown` is set on same-request pairs only;
- `inventory`: built and declined counts, and `substituted`, the declined decks that built another style (above);
- `picks`, for plans with `requests` entries: every picked request per entry and version, and what became of it (fixed picks, above);
- `notes`: shortfalls and skipped files.

`copies` maps each card name in the packet to its copies. Collation reads dead copies and checks card names from it, so a deck file rebuilt later cannot change a batch's results.

## Running the judges

`PROMPT.md` holds the full rubric, then the task: read `data/review/packets/<batch>/{{packetId}}.md`, answer only with the rubric's JSON shape (the one-deck shape for `p-` packets, the pair shape for `pair-` packets), and write it to `data/review/judgments/<batch>/{{packetId}}.json`. It tells judges never to open `data/review/keys/`, other packets, other judgments, the decks, the card data, or any repo tool (the card tools show the builder's view).

The coordinator:

1. reads `index.json` for the packet ids;
2. for each id, gives one Opus judge the text of `PROMPT.md` with `{{packetId}}` replaced by the id;
3. runs collation when the answers are in, and reruns judges for packets listed as invalid or unanswered.

## Collating

```sh
npm run review:collate -- --batch <name> [--decks <folder or glob>] [--also <folder or glob>]... [--out data/review/results]
```

It counts built and declined decks over every deck file under `--decks` and `--also` (default: the specs the batch was drawn from, recorded in the key; each flag given replaces the key's), per version, size, and requested style, whether or not a deck was sampled. Keep `--also` to anchors and hand-built decks: a builder version's files found there join its counts like any other, so a glob that reaches its development pools would change its declines. A deck built in another style than its request named counts as declined there, as in the key (above). When no deck file is found there, it uses the key's inventory instead. The report says which it used. Rows are given only for versions the batch knew.

**Another style built.** A judged deck whose key entry has a requested style and an `archetype` that differs from it is a declined request, not a built deck, in every table: its judgment is left out of the decent rates, scores, dead copies, failures, anchors, and examples, and a pair that holds it is left out of head to head (the report gives the number). The rubric lets a plain deck be decent whatever was asked for, so without this a Graveyard request answered with a fair Midrange deck would count as a decent Graveyard build. Its judgment still counts toward judge agreement, which measures the judges, not the request. Keys made before `archetype` was recorded have none, and their decks never count as substitutes; make such a batch again with `--force` to apply the rule.

It reads every `data/review/judgments/<batch>/*.json`, takes the packet id from the file name, and checks each answer:

- **Errors** make an answer invalid; it is listed with the reasons and left out. They are: not JSON, an unknown packet id, a missing or extra key, a wrong type or value, a `decent` that does not match the score (decent means 3 or more), an empty `failures`, an unknown failure value, `none` next to another failure, a `decent_of_style` that is not true or false when the packet showed a requested style or not null when it showed none (the key's `styleShown` says which), or a `style_reason` that is not a string. Keys made before packets showed the style have no `styleShown`; their answers keep the old shape, and the two style fields are extra keys there. A JSON object wrapped in a code fence is read, with a warning.
- **Warnings** break one of the rubric's consistency rules; the answer still counts. They are: `no-plan` without the plan "no clear plan" or the reverse; `no-plan` with an `enough_` field true; an `enough_` field false without its failure; `interaction` none without `no-interaction`; `win` none without `no-win`; a score above 2 with a plan, setup, or payoff failure; a card named more than once across setup, payoff, and dead; a name that is not in the deck (a face's name is accepted); dead copies at or above the rubric's bar without `dead-cards`; `decent_of_style` true for a deck that is not decent (the tables count it as not decent of its style, since the rubric makes that a decent deck first); and an empty `style_reason` with a shown style, or a filled one without.

Each deck counts once, with its first packet's answer, or the copy's answer when the first is missing or invalid. Copies otherwise feed only the agreement table.

The results, in `data/review/results/<batch>.json` and `.md`:

- **Picked requests,** for a key with `picks`: per version, size, and request kind (`themed`, `shape`, `bestfit`, as in the request kind table below, so a tribe request never pools with best fit), over every request the plan picked for it: picked, judged, "Decent, all picked" (decent out of the picked requests, a declined request, a deck in another style, or a request with no deck file counting as not decent; packets without a valid answer yet are left out), mean score, and the counts of declined, another style, no deck, and unanswered. Then the same rate on the requests every version took and has a verdict on, per size and pooled over the sizes, so a version judged on 12 requests per size compares with the others on those same requests. Then the styles each version built on its picked requests, per version, size, and kind (`declined` and `no deck` included), and per size a table of each picked request with what each version made of it: the style built and the verdict with its score, `declined`, `no deck`, or `unanswered`. This is where a style-mix skew shows: the versions are side by side on the same requests.
- **By version and size,** and **by version and requested style** (`bestfit` for best fit): decks judged; two decent rates side by side, over judged built decks and over all requests (a declined request counts as not decent: the first rate times built / (built + declined)); two rates of decent decks of the requested style, "Of style, built" over judged built decks whose packet showed a style (`decentOfStyle` of `styleJudged`) and "Of style, all requests" over every styled request, a declined or substituted one counting as not decent of its style (the first rate times the styled requests' built share); mean score; mean dead copies (from the judges' dead lists and the packet's copies); the failures histogram; and declined out of all deck files for the row, with how many of the declined built another style. Best fit rows have no style rates, and batches made before the style line show "-" there.
- **By version, size, and request kind:** the same columns per version and size, split into themed requests (a synergy style), shapes (Aggro, Midrange, or Control by name), and best fit. The ship rule in `docs/builder-phase1.md` reads the themed rows.
- **Built another style:** per version, the styled requests in the deck files, how many the version answered with another style (each counted as declined above), how many judged decks were set aside for it, and how many of those the judges found decent all the same (`setAsideDecent`): how good the nearest deck was, kept apart from the request it missed.
- **Anchors:** for `random` and `real`, the share scored 3 or more, and whether the panel failed most random piles and passed most real decks. If it did not, fix the rubric before trusting the other tables.
- **Agreement:** for decks judged twice, how often the two judges agreed on `decent`, the share of equal scores, and the mean score difference.
- **Head to head:** per pair of versions and per match step (`same-request`, `same-pool`, `same-colors`), from the first version's side (alphabetical), wins, losses, ties, and the win share with a tie as half, pooled over which deck was A. Steps are never pooled: only `same-request` rows compare two versions on the same pool and request. Declined builds never enter pairs, so a version skips the comparisons on requests it declines; the report says so beside the table. Pairs with a deck that built another style are left out and counted. An order check counts how often A, B, or a tie was picked, over every valid pair answer.
- **Example decks:** per version and size, the highest scored and the two lowest scored decks from public and plain pools, with the judge's plan, reason, the style answer and `style_reason` when the batch asked it, dead cards, and failures. Owner pools are never quoted.
- Invalid answers, answers with warnings, and unanswered packets.

From a script, `collate(key, answers, counts?)` returns the same tables as data (counts from the key's inventory unless `counts` is given), `collateFromDisk(batch, { decks, also })` reads the files first, and `renderCollation` writes the Markdown. `makeBatch` builds a batch in memory; pass `styles: styleTexts(config.archetypes.archetypes)` for the config's words in the style line, as the command does.

## Builder phase 2, step 3: the plan

Step 3 (`docs/builder-phase2.md`) judges the new first option, built by one plan picker, against the shipped builder's core best fit and its web first option, at 60, 100, and 40, on the held-out `h2-` pools and their best-fit requests (`docs/review/pools.md`, `docs/review/requests.md`). The plan is `data/review/plans/phase2.json`:

| Entry | Version       | Size | Draws                                                     | Packets |
| ----: | ------------- | ---: | --------------------------------------------------------- | ------: |
|     1 | `head`        |   60 | 40 best-fit requests from `main-head.json`, spread        |      40 |
|     2 | `shipped`     |   60 | `sameAs` 1: the same 40 requests                          |      40 |
|     3 | `shipped-web` |   60 | `sameAs` 1: the first 12 of them                          |      12 |
|   4-6 | the same      |  100 | as 1 to 3                                                 |      92 |
|   7-9 | the same      |   40 | as 1 to 3                                                 |      92 |
| 10-12 | `random`      | each | 2 piles on `h2-` pools, uniform                           |       6 |
| 13-15 | `real`        | each | 3 real decks, uniform                                     |       9 |
|       |               |      | per size 92 builder decks and 5 calibration decks; in all |     291 |

**The selection rule.** At each size, the 40 requests are fixed picks (above): the spread draw over the best-fit requests on the `h2-` pools in `data/review/jobs-h2/main-head.json` (60 and 100) or `small-head.json` (40), with the batch seed 1, before and apart from any build. That gives 30 pools, every pool once and ten pools twice, with the color letters level. All three versions are judged on those requests: `shipped` on the same 40, `shipped-web` on the first 12 in pick order, which are on 12 different pools with level colors. A version that declines a picked request, or has no deck for it, gets no packet for it and is counted as not decent there; nothing is drawn in its place. A dry run with stand-in decks for every `h2-` job gave 291 packets: at 60, 40 requests on all 30 pools, at most 2 per pool, 13 of them two-color, letters W 11, U 11, B 10, R 10, G 11; at 40, 10 two-color and 10 of each letter; at 100, all 30 pools, at most 2 per pool; `shipped-web` 12 requests on 12 pools at every size. The "Picked requests" tables of the collation give each version's rate over all 40 (or 12) picked requests and the style each version built on each.

**The web first option is judged on fewer decks.** The brief asks for at least 40 judged first options per version and size. The plan judges 40 per size for `head` and `shipped`, but 12 per size for `shipped-web` (36 over the three sizes), to stay near the judging budget of about 15 million tokens for step 3. So the ship rule's "clearly not below the shipped web first option" is read on the pooled 36 `shipped-web` decks against `head`'s decks on the same 36 requests (the "all" row of the collation's "On the requests every version took"), not per size; the per-size rows for `shipped-web` are too small to read alone.

No pairs and no second copies: at about 55,000 tokens a packet, 291 packets are about 16 million tokens. Calibration first: judge the 15 `random` and `real` packets, check the anchors (most random piles fail, most real decks pass), then the 276 builder packets.

The builds, from the repo root, once `../bulk-brew-shipped` is at the shipped commit (`docs/review/runner.md`). The runner rebuilds a deck file whose version notes differ from the version's own, so decks from an older core (`head` notes a hash of `packages/core/src`) or an older worktree commit (`shipped` notes the commit) are built again without `--force`:

```sh
npm run review:build -- --jobs data/review/jobs-h2/main-shipped.json
npm run review:build -- --jobs data/review/jobs-h2/small-shipped.json
npm run review:build -- --jobs data/review/jobs-h2/main-shipped-web.json
npm run review:build -- --jobs data/review/jobs-h2/small-shipped-web.json
npm run review:build -- --jobs data/review/jobs-h2/main-random.json
npm run review:build -- --jobs data/review/jobs-h2/small-random.json
npm run review:build -- --jobs data/review/jobs-h2/main-head.json
npm run review:build -- --jobs data/review/jobs-h2/small-head.json
```

After step 3, `head`'s best fit and the web's first option must be the same deck. This check builds both on every request, in memory, and lists any request where the cards, the basics, or a decline differ (it exits with 1 then); it judges nothing:

```sh
npm run review:build -- --jobs data/review/jobs-h2/main-head.json --compare head-web
npm run review:build -- --jobs data/review/jobs-h2/small-head.json --compare head-web
```

Then the batch and its collation:

```sh
npm run review:packets -- --batch phase2 --plan data/review/plans/phase2.json --decks "data/review/decks/*/h2-*.json" --also data/review/decks/real --pairs 0 --two-judges 0 --no-anchors
npm run review:collate -- --batch phase2
```

The calibration packet ids, from the key (read by the coordinator, never by a judge):

```sh
node -e "const k=require('./data/review/keys/phase2.json');console.log(JSON.stringify(Object.keys(k.packets).filter(id=>['random','real'].includes(k.packets[id].version))))"
```

## Builder phase 2, step 5: the plan

Step 5 (`docs/builder-phase2.md`) judges the new first option at 20 and 100 cards, and tribe requests at 100, against the shipped builder's core best fit and web first option, with step 3's method and ship rule, on the held-out `h3-` pools (12 plain, 6 tribe; `docs/review/pools.md`) and their requests (`docs/review/requests.md`, "h3"). The plan is `data/review/plans/phase3.json`:

| Entry | Version       | Size | Draws                                                                         | Packets |
| ----: | ------------- | ---: | ----------------------------------------------------------------------------- | ------: |
|     1 | `head`        |   20 | 40 best-fit requests from `small-head.json`, spread                           |      40 |
|     2 | `shipped`     |   20 | `sameAs` 1: the same 40 requests                                              |      40 |
|     3 | `shipped-web` |   20 | `sameAs` 1: the first 8 of them                                               |       8 |
|   4-6 | the same      |  100 | best fit from `main-head.json`, as 1 to 3                                     |      88 |
|     7 | `head`        |  100 | 20 tribe requests from `main-head.json` (tribe pools, the six tribes), spread |      20 |
|     8 | `shipped`     |  100 | `sameAs` 7: the same 20 requests                                              |      20 |
|  9-10 | `random`      | each | 2 piles on `h3-` pools, uniform                                               |       4 |
| 11-12 | `real`        | each | 3 real decks, uniform                                                         |       6 |
|       |               |      | 93 packets at 20 (5 calibration), 133 at 100 (5 calibration); in all          |     226 |

**The selection.** Fixed picks with the batch seed 1, as for step 3. A dry run with a stand-in deck for every `head`, `shipped`, and `shipped-web` job in `data/review/jobs-h3/`, the `random` piles of a check build, and the real decks on disk took every plan entry in full (226 packets, no request declined or missing):

- at 20, 40 of the 210 best-fit requests on all 18 pools, at most 3 per pool, 13 on tribe pools, 13 two-color, letters W 11, U 11, B 10, R 11, G 10; `shipped-web` takes the first 8, on 8 pools;
- at 100, 40 of the 54 best-fit requests on all 18 pools, at most 3 per pool, 12 on tribe pools, 21 two-color; `shipped-web` 8 on 8 pools;
- tribe requests, 20 of the 24 on the 6 tribe pools: Human 3, Warrior 4, Wizard 3, Spirit 4, Elf 3, Dragon 3.

Real decks on disk: 30 at 20 and 40 at 100. The `random` jobs build all 528 piles at 20 and 100 (checked into a scratch folder).

**Below 40 per version and size.** The brief asks for at least 40 judged first options per version and size. The plan judges 40 per size for `head` and `shipped` on best fit, and departs from that three ways, to stay near the budget of about 15 million tokens:

- `shipped-web`: 8 per size, 16 in all. "Clearly not below the shipped web first option" is read on the pooled 16 against `head` on the same 16 requests (the "all" row of "On the requests every version took"), as step 3 read its 36.
- Tribe requests: 20 per version, `head` and `shipped` on the same 20, read on their own (the collation's `themed` rows at 100). The tribe pools hold 24 such requests; `shipped-web` takes none, since a web first option for a named style is the core's deck.
- Best fit at 100 comes from three commanders per pool, not two: two would give 36 requests, short of 40.

**Tokens.** Phase 2 (step 3's batch) took about 17.7 million tokens for 291 packets, 60,800 each, on packets of 14,100 bytes on average beside a 16,255-byte `PROMPT.md`. Taking a judge's tokens as proportional to what it reads, prompt plus packet, gives 2.0 tokens per byte read. Packet sizes by size: 24,100 bytes at 100 (phase 2's), and 4,800 at 20 (`head`'s 431 best fits at 20 on development pools, rendered; real decks 4,300, random piles 3,300).

| Packets                  | Count | Tokens each | Tokens |
| ------------------------ | ----: | ----------: | -----: |
| 20, builders             |    88 |      42,300 |  3.72M |
| 20, calibration          |     5 |      40,000 |  0.20M |
| 100, best fit and tribes |   128 |      81,000 | 10.37M |
| 100, calibration         |     5 |      76,000 |  0.38M |
| In all                   |   226 |             | 14.67M |

At a flat 60,800 a packet it is 13.7 million; with tokens proportional to the packet alone, 15.7 million. Nothing was cut.

The builds, from the repo root. First move the shipped worktree to the last commit shipped before step 5's builder changes (26.0.41 is `acaefe6`; a later one if step 4 ships first). The core's `BuildRequest` and options request at 26.0.41 have the same fields as at 26.0.40, so `shipped-core.ts` needs no change for it; check again for a later commit.

```sh
git -C ../bulk-brew-shipped checkout --detach <shipped commit>
npm run review:build -- --jobs data/review/jobs-h3/small-random.json
npm run review:build -- --jobs data/review/jobs-h3/main-random.json
npm run review:build -- --jobs data/review/jobs-h3/small-shipped.json
npm run review:build -- --jobs data/review/jobs-h3/main-shipped.json
npm run review:build -- --jobs data/review/jobs-h3/small-shipped-web.json
npm run review:build -- --jobs data/review/jobs-h3/main-shipped-web.json
npm run review:build -- --jobs data/review/jobs-h3/small-head.json
npm run review:build -- --jobs data/review/jobs-h3/main-head.json
```

Once step 5 routes 20 cards and Commander to the grow builder, `head`'s best fit and the web's first option should be the same deck; this lists any request where they differ (exit code 1) and judges nothing:

```sh
npm run review:build -- --jobs data/review/jobs-h3/small-head.json --compare head-web
npm run review:build -- --jobs data/review/jobs-h3/main-head.json --compare head-web
```

Then the batch and its collation. Judge the 10 calibration packets first and check the anchors (most random piles fail, most real decks pass), then the 216 builder packets:

```sh
npm run review:packets -- --batch phase3 --plan data/review/plans/phase3.json --decks "data/review/decks/*/h3-*.json" --also data/review/decks/real --pairs 0 --two-judges 0 --no-anchors
node -e "const k=require('./data/review/keys/phase3.json');console.log(JSON.stringify(Object.keys(k.packets).filter(id=>['random','real'].includes(k.packets[id].version))))"
npm run review:collate -- --batch phase3
```

## Check run

On 2026-11-08, from the decks on disk then (9 `head`, 6 `head-web`, 3 `v26.0.30`, 5 `random`, 170 `real`):

```sh
npm run review:packets -- --batch tooltest --quota 2 --pairs 2 --two-judges 0.5 --force
npm run review:collate -- --batch tooltest
```

- The batch held 286 packets:
  - 189 decks: every anchor, plus the quota draw;
  - 95 copies for second judges;
  - 2 same-request pairs, `head` against `v26.0.30` and `head` against `head-web`.
- A second run gave byte-identical packets, index, and prompt.
- A scan of every packet for each deck's name, pool, file name, and version notes found only coincidences: deck names that are also card names or words, such as a Jumpstart deck named after its planeswalker.
- Two hand-written answers, one deck and one pair, collated with no invalid files and no warnings.
