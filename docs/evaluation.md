# Evaluation

How to measure a builder change. How the builder works, and why, is in `docs/builder.md`. Every command here runs offline and gives the same output for the same input. Working data lives in the gitignored `data/review/` and `data/corpus/`; scratch files go in `data/review/scratch/`, never in `packages/*/src`.

## What to run when

| Change                                        | Run                                            | Decides                                         |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Any builder or config change                  | `npm run eval`                                 | regressions; a new baseline when a metric moves |
| Tuning a number against real decks            | `npm run corpus:eval`, train then test         | whether it fits real decks, not just the corpus |
| A builder change that moves decks players see | the blind panel on new held-out pools          | whether it ships                                |
| Beside the panel                              | `npm run review:check`, `npm run review:agree` | sanity gates, never a decent rate               |

## Principles

- Judge with a yardstick that does not share the builder's definitions; a score and a check built on the same definitions agree and say nothing. Theme counts from the rules are never evidence that a builder is better; the panel is.
- Report paired counts on the same requests, not only averages.
- Plain bulk with nothing hidden in it is the real task. A pool that hides a real deck rewards recovering that deck.
- Keep answer keys outside every folder a judge reads.
- Never let one number decide. Every number in a write-up names the command and output file behind it, and is rerun before it is trusted.
- Real decks are evidence, not targets. Precons are a floor, not a ceiling. Never tune to the owner's own lists.
- A median of real decks counted with our own classifier is a scale check, not proof.

## npm run eval

```sh
npm run eval                      # best fit for every pool, size, and color the scan allows, plus two commanders per pool
npm run eval -- --styles          # also every viable style (large files; keep them local)
npm run eval -- --colors pairs    # also every two-color set ("all": one to five colors)
npm run eval -- --dir test-bulk --combine --colors all   # the owner's lists as one pool; results stay there
```

It builds from `eval/pools/*.txt`, scores each deck with `metrics.ts` (table in `eval/README.md`), and exits 1 when a build fails or a deck breaks a hard invariant. `synergy`, `filler`, and `score` are the classic deck score's measures, which grow decks do not build to, so a move in them describes the decks rather than judges them.

**Baselines.** `eval/results/` holds one JSON per committed full best-fit run, `<date>-<commit>.json`. A run prints per-size deltas against the latest earlier full run with the same `--styles` and `--colors`, over the pools both runs have. When a change moves a metric, commit the new file with it and put the deltas in the commit body.

**What a delta means.** The eval is deterministic, so every delta is a real change in the decks, never noise; only build time varies with the machine. "Better" and "worse" say which way a metric moved, not whether the decks improved: that is the panel's question. Compare per-size rows, not the overall row.

## The reference corpus

```sh
npm run corpus:fetch -- --drafts FDN,DSK,BLB,OTJ,MKM,LCI,WOE,MOM,ONE,DMU,DFT,TDM,FIN,EOE,TLA,ECL,TMT,SOS --local test-bulk
npm run corpus:eval                                 # about 20 minutes
npm run corpus:eval -- --sizes 100 --split train    # quick iteration
```

`corpus:fetch` collects official precons (MTGJSON) and Arena draft decks with their records (17Lands) into `data/corpus/decks.json`. `corpus:eval` shuffles each real deck into about 3,000 random bulk cards, builds at its size, and compares; its options are in the script header, and `--rescore <file>` measures an earlier run's builds with the current styles. Results go to `data/corpus/results/`.

It reports recall, plan recall (the share of the deck's theme cards the build used), profile distance from real decks of the plan, style match as decks gained and lost, self fail, and ours and real pairs for lands, mana value, and creatures. `score` and `ref ahead` read the classic deck score, so they are empty for grow decks.

**Train and test.** One deck in five is the test split (`splitOf` in `corpus.ts`). Tune on `--split train`; keep a change only if `--split test` is not worse, and record both per size in the commit body. Draft win correlations are under 0.07 either way, so they are tiebreakers, never reasons for a big change.

**corpus:panel** (`--a <old.json> --b <new.json>`, then `--tally <dir>`) pairs builds of the same real decks from two results files for fresh agents. It shows each build's style label and its plan's real-deck profile and cites `eval/rubric.md`, so it is a secondary check, not the blind panel.

**sources:fit** prints how far real multi-color decks fall short of each candidate `landRules.colors.sourceCover`, per size and split, and the strictest cover at which the median train deck is short in no color. `--dev` lists what the configured covers move on the development pools.

## The blind panel

A builder change that moves decks a player sees ships on the panel: fresh agents judge decks blind, by `eval/panel-rubric.md`, on pools nobody looked at while building.

1. Make held-out pools with a new seed prefix (`review:pools`).
2. Write the requests every version gets (`review:requests`).
3. Build every version on them, plus the anchors (`review:build`, `review:anchors`).
4. Draw a batch from a sampling plan (`review:packets`).
5. Judge the calibration packets and check the anchors; then judge the rest.
6. Collate (`review:collate`) and read the rows the ship rule names.

### Pools

```sh
npm run review:pools -- --seed-prefix <p> --plain 12 [--themes 1 --rotate-themes] [--tribes 6]
```

- **plain:** `noisePool` over every card a bulk box can hold, 3,000 copies at 55% common, 30% uncommon, 12% rare, 3% mythic. Nothing is hidden in them; this is the main test.
- **theme:** a plain base plus 120 copies of one style's matcher and EDHREC theme-page cards. `--themes <n>` per style; `--rotate-themes` spreads styles over the bases.
- **tribe:** a base of its own plus 120 copies of one creature type's cards and each commander that names it; `--tribes <n>` takes the top types by commanders times members.
- **public:** `eval/pools/*.txt`. **owner:** `test-bulk/*.txt`, local only, printed as counts only.

A prefix changes the seed text (`hash32('review:<prefix>:plain:' + n)`), giving a new set made the same way; a pool kind is refused as a prefix. Reruns are byte-identical. Pools record the pack and config that made them, and the command warns on a mismatch.

| Set   | Pools                                   | Made with                                                | Use            |
| ----- | --------------------------------------- | -------------------------------------------------------- | -------------- |
| none  | `plain-01` to `plain-10`, theme, public | `review:pools`                                           | development    |
| none  | `plain-11` to `plain-30`                | `review:pools`                                           | held out, used |
| `h1`  | 12 plain, 54 theme                      | `--seed-prefix h1 --plain 12`                            | held out, used |
| `h2`  | 12 plain, 18 theme                      | `--seed-prefix h2 --plain 12 --themes 1 --rotate-themes` | held out, used |
| `h3`  | 12 plain, 6 tribe                       | `--seed-prefix h3 --plain 12 --themes 0 --tribes 6`      | held out, used |
| `d5a` | 5 plain, in `data/review/pools/d5a/`    |                                                          | development    |
| `d5b` | 12 plain, 6 tribe                       | `--seed-prefix d5b --plain 12 --themes 0 --tribes 6`     | development    |

**The held-out rule.** While building, never open, print, or summarize a held-out pool (h1, h2, h3, and any new set) beyond its file name and card count, and leave its `themes-<p>.json` and `tribes-<p>.json` unread. Never tune on a set a panel has used; each new panel takes a new prefix. A tool that must run on held-out pools during a step, such as `review:agree`, prints counts and style ids only.

### Requests

```sh
npm run review:requests -- --prefix h3 --sizes 100,20 --versions head,shipped,shipped-web,random --bestfit --tribe-versions head,shipped --two-color-sizes 20 --commanders 3 --out data/review/jobs-h3
```

The same rules for every version:

1. **Colors.** Below 100, every mono color; a public pool takes the colors its first comment line names; plain pools add the ten two-color pairs at `--two-color-sizes` (default 60,40). At 100, the commander's identity.
2. **Styles.** Best fit, every style the current scan calls viable (shapes first), and a theme pool's enriched style. `--bestfit` asks for best fit only and drops color sets the scan cannot build.
3. **Commanders.** The first `--commanders` (2) of the core's commander list, partners and commanders short of cards left out; when neither pick on a theme pool has the theme's best color, the second gives way to one that does. A tribe pool asks for its tribe under the first `--tribe-commanders` (4) that name it.
4. **Seeds and versions.** Seed 1, but 1 and 2 for `random`. The `--bestfit-only` versions (default `head-web,random`) get best fit alone; `--tribe-versions` adds the tribe requests for them.
5. **Order.** 60 then 100 in `main-<version>.json`, 40 then 20 in `small-<version>.json`; then pool kind, pool, colors, style, seed.

A job adds `reason` (`bestfit`, `shape`, `viable`, `enriched`, `tribe`), `slice`, `commanderName`, and `deck` (the file the runner writes) to the runner's fields. Keep job files as written during a round: their commanders and scans come from the core that wrote them.

### Versions and the runner

`packages/pipeline/src/review/versions.ts` registers `head` (the current `buildDeck`), `head-web` (the web Build page's first option, from `deckOptionSearch`), `shipped` and `shipped-web` (the same two at another commit), and `random`. `real` decks come from `review:anchors`.

A version is a `BuilderVersion` (`version.ts`): a `BuildContext` in, a `BuiltDeck` out. It throws the core's `BuildError` to decline, and must give the same deck for the same pool, request, and seed, with no network and no clock. To add one, write `algos/<name>.ts` default-exporting a `BuilderVersion` whose `id` is the name, and add a line to `REGISTRY`.

```sh
npm run review:build -- --pool eval/pools/bulk-red.txt --colors R [--size 60] [--version head] [--style <id>] [--secondary <id>] [--commander Lathril] [--seed 1] [--twice] [--print]
npm run review:build -- --jobs data/review/jobs-h3/small-head.json [--force] [--out data/review/decks]
npm run review:build -- --jobs data/review/jobs-h3/small-head.json --compare head-web
```

Decks are stored as `data/review/decks/<version>/<pool>-<colors>-<size>-<style or bestfit>[+<secondary>][-<commander>]-s<seed>.json`, with characters Windows forbids as dashes (`tribal-Elf`). A batch skips a job whose file holds the same pool, request, data pack, and version notes. `head` notes a hash of `packages/core/src` and the config, `shipped` the worktree's commit, so a changed core or a moved worktree rebuilds without `--force`. `--twice` checks determinism. `--compare` builds both versions in memory and lists requests whose cards, basics, or decline differ (exit 1): it proves best fit and the web's first option are one deck.

### The shipped worktree

`shipped` and `shipped-web` load another commit's core, its config (through that commit's own `loadConfigDir`), its settings, and its `data/learned.json`, on the current data pack. Older builders run only through this worktree runner.

```sh
git worktree add --detach ../bulk-brew-shipped <commit>
git -C ../bulk-brew-shipped checkout --detach <commit>
```

- The path comes from `REVIEW_WORKTREE_SHIPPED`, default `../bulk-brew-shipped`. From a worktree under `.claude/worktrees/`, set it to the full path.
- It needs no `npm install`: a resolve hook sends the worktree's core imports to its own core.
- The adapter refuses uncommitted changes to tracked files, a loaded file not tracked at that commit, another data pack schema, and a config that fails that core's `validateConfig`.
- Its requests are written out in `algos/shipped-core.ts` (`toShippedBuildRequest`, `toShippedOptionsRequest`); update them when the commit's requests differ.
- Older baselines: 26.0.30 is `97757fa` (before the learned data), 26.0.35 is `e8b05fa` (the last before seed and grow). Decks stored under `v26.0.30` and `v26.0.35` keep those folder names.

### Anchors and calibration

- **Random piles** (`random`): spells drawn uniformly from the cards the builder could legally use in the colors, basics split by pips, lands by the builder's formula. They should fail.
- **Real decks** (`npm run review:anchors`, version `real`): 40 one-commander Commander precons over release years, 40 60-card precons over kinds, 60 draft decks with 7 or more wins in at most 9 games over sets, 30 Jumpstart packets over products, each size seeded with `hash32('review:real:' + size)`. Never the owner's lists, two-commander precons, or 40-card precons. Colors below 100 come from the pips the spells must pay. They should pass.
- **Hand-built decks** in `data/review/decks/hand/` can join a batch through `--also` as an upper reference.

Judge the anchors first. Most random piles must fail and most real decks pass; if not, fix the rubric before trusting any other table. Panels so far judged random piles decent 0% to 33% of the time and real decks 92% to 100%.

### Sampling a batch

```sh
npm run review:packets -- --batch <name> --plan data/review/plans/<name>.json --decks "data/review/decks/*/h3-*.json" --also data/review/decks/real --pairs 0 --two-judges 0 --no-anchors
```

Flags: `--batch` (judges see it, so name no version in it), `--quota <n>` or `--plan <file>`, `--decks` and a repeatable `--also`, `--seed 1`, `--pairs 0`, `--two-judges 0.25` (the share copied for a second judge), `--anchors 25` or `--no-anchors`, and `--force` to replace a batch.

A plan is a JSON array of entries. Each needs `version` and `count`, and narrows with `size`, `kinds`, `styles` (`bestfit` for best fit), `poolPrefix`, and `substituted`. Three fields steer it:

- `requests`: a jobs file. The entry draws requests, not decks, so nothing a version built or declined moves the pick. A picked request a version declined, built in another style, or has no deck for gets no packet and counts as not decent.
- `sameAs`: an earlier entry's number. This version's decks for the same requests, in pick order: paired singles.
- `spread`: every pool once before any pool twice, with the color letters level.

```json
[
  {
    "version": "head",
    "size": 20,
    "requests": "data/review/jobs-h3/small-head.json",
    "poolPrefix": "h3-",
    "styles": ["bestfit"],
    "spread": true,
    "count": 40
  },
  { "version": "shipped", "size": 20, "sameAs": 1, "count": 40 },
  { "version": "shipped-web", "size": 20, "sameAs": 1, "count": 8 },
  { "version": "random", "size": 20, "poolPrefix": "h3-", "count": 2 },
  { "version": "real", "size": 20, "count": 3 }
]
```

A deck built in another style than requested counts as declined: the rubric lets a plain deck be decent whatever was asked for, so it could otherwise pass as the theme.

A packet shows the size, the deck's colors, the requested style in the config's words, the commander, and each card's cost, type, stats, and oracle text. It hides the version, pool, deck name, archetype, every `why`, the explanation, the file name, and everything the builder thinks of a card (tags, roles, styles, strength, rarity, rank). Packet numbers are a seeded shuffle; the same decks and flags give byte-identical packets and key.

### Judging

`data/review/packets/<batch>/PROMPT.md` holds the whole rubric and the task. For each id in `index.json`, give one fresh agent the prompt with `{{packetId}}` filled in; it reads only its packet and writes `data/review/judgments/<batch>/<id>.json`. The coordinator lists the calibration ids from the key, which no judge reads:

```sh
node -e "const k=require('./data/review/keys/<batch>.json');console.log(JSON.stringify(Object.keys(k.packets).filter(id=>['random','real'].includes(k.packets[id].version))))"
```

A judge reads about 2 tokens per byte of prompt and packet: about 42,000 tokens for a 20-card packet, 81,000 for a 100-card one. Plan one main round and at most one re-check, within about 15 million tokens per panel.

`eval/panel-rubric.md` is pasted whole into every prompt, and `collate.ts` enforces its answer shape, failure values, and consistency rules: change its wording only together with `collate.ts`.

### Collating

```sh
npm run review:collate -- --batch <name> [--decks <spec>] [--also <spec>]... [--out data/review/results]
```

An error (bad JSON, a missing key, a `decent` that does not match the score) makes an answer invalid and lists it for a rerun; a warning (a name not in the deck) is listed and the answer counts. Output: `data/review/results/<batch>.json` and `.md`. The rows to read:

- **Picked requests:** per version, size, and request kind (themed, shape, best fit), decent out of every picked request, with declined, another style, and no deck counted as not decent. Then **On the requests every version took**, per size and pooled: read a small sample, such as 8 to 12 web first options per size, on the pooled "all" row. Then the style each version built per request, where a style-mix skew shows.
- **Anchors**, **Agreement** (decks judged twice), and **Head to head** per match step (`same-request`, `same-pool`, `same-colors`), never pooled.

### Ship rules and noise

Noise on a decent rate: about 20 points at 40 judged decks per cell, 25 to 30 at about 20, 35 to 40 at about 12. Judge at least 40 first options per version and size; read smaller cells paired (20 tribe requests give a band of about 30 points).

- **Best fit and first options:** at each size the new first option is decent at least as often as the shipped core best fit, within the noise, and clearly not below the shipped web first option; the other viable styles are still listed; no style is shut out by a scoring artifact (Aggro must win a plainly aggressive pool).
- **Requested themed styles:** decent more often than shipped by more than the noise; the rate over all requests, declines and nearest decks counted as not decent, not lower; decent of its style more often; the other styles still listed.
- A size or request kind that fails stays on its present path; the sizes that pass ship.

**Style mix** (the owner's rule, 2026-11-11). Best fit means the best deck. There is no target mix: Aggro and Midrange being common from bulk is fine, as long as the other buildable styles stay in the list. A skew caused by a scoring artifact, such as a loose matcher or a score that rewards one style's cards, is a regression. A skew that reflects what the bulk builds best is fine. The mix is reported, not gated; the style-mix blockers `corpus:eval` prints predate this rule and are prompts to look, not a gate.

## review:check

```sh
npm run review:check                                     # every deck under data/review/decks
npm run review:check -- --decks "data/review/decks/*/h3-*.json"
npm run review:check -- --decks data/review/decks/head --rebuild
```

Other flags: `--out`, `--force` (otherwise a stored result is reused while the deck's `builtAt` and the stamp match), and `--rules <file>`. The stamp is the checker version (5) with the pack, config, and theme rules versions. Results go to `data/review/checks/<version>/`, with a summary of that run's decks only.

Seven checks: legality (size, copies, colors, illegal cards, the commander), mana (land count, sources per color against `colorWants`, castability), curve, interaction and threats (a proxy from the builder's own roles), theme counts from `config/theme-rules.json`, determinism and build time, and dead cards (a proxy). Flags: `size`, `copies`, `colors`, `illegal-card`, `lands-low`, `lands-high`, `sources-short`, `curve-top-heavy`, `curve-flat`, `no-removal`, `no-threat`, `theme-no-setup`, `theme-no-payoff`, `theme-unbalanced`, `nondeterministic`, `slow`. Every threshold is in `THRESHOLDS` in `check.ts`.

The thresholds were set so the 170 real-deck anchors mostly pass. `sources-short` reads castability below 0.6, not the `colorWants` gap, which still leaves 35% to 49% of real multi-color decks short and so stays a reported number. Never tune the checks to a builder; recheck them against the anchors and the panel. They are sanity gates, never a decent rate: random piles raised no flag in 87% of 60-card decks. `head-web` times the whole option search, so it is `slow` by design.

## review:agree

```sh
npm run review:agree -- --dev     # eval/pools, plain-01 to plain-10, unprefixed theme pools
npm run review:agree -- [--sizes 60,40,20,100] [--commanders 2] <pool files...>
```

On best fit's requests per pool, it checks that the scan, the Analyze pane, the Build page, and the builder name the same viable styles, that each can be built, and that each deck's views show the setup and payoff counts its builder counted. It prints counts and style ids only, so it can run on held-out pools, and exits 1 on any disagreement.

## Card and deck diagnostics

```sh
npm run review:cards -- "Faithless Looting" --style graveyard
npm run -s review:cards -- --tag mill-self --limit 0 --json > mill-self.json
npm run needs:report
npm run needs:decks -- --label <name> [--pools <substring>]
```

- `review:cards` prints a card's facts from the data pack and the core's view of it (roles, the classic style matchers, strength, why the builder leaves it out); `--file` and `--compact` also work. Use it instead of card text from memory. It does not show theme rule jobs or card needs.
- `needs:report` measures the card needs reader over the pack and writes the committed `eval/needs-coverage.md` plus `data/review/needs/unparsed.md`. Rerun it after a card needs change.
- `needs:decks` builds best fit, each viable theme, and the shapes on the eval pools and `plain-01` to `plain-10`, and counts unsupported cards and roles below minimum per builder.

## Files

```text
data/review/pools/<kind>/<id>.json      pools, plus index.json, themes-<p>.json, tribes-<p>.json
data/review/jobs-<p>/                    main-<version>.json, small-<version>.json, index.json
data/review/decks/<version>/             one ReviewDeck per build
data/review/plans/<batch>.json           sampling plans
data/review/packets/<batch>/             p-0001.md, pair-0001.md, index.json, PROMPT.md
data/review/keys/<batch>.json            answer keys, never read by a judge
data/review/judgments/<batch>/<id>.json  one answer per packet
data/review/results/<batch>.json, .md    collations
data/review/checks/                      review:check results
```

Batch names already used: `calib`, `main`, `small`, `tooltest`, `phase1`, `phase2`, `phase3`.
