# Learned deck building

A brief for the next builder session, written 2026-11-05. The owner approved the direction and every decision below. The session runs unattended: the owner starts it, goes to sleep, and checks the live site in the morning. It needs no input from the owner, and the owner reviews nothing until then.

The goal is a smarter, more dynamic deck builder. Today the builder runs fixed passes with hand-set numbers and ends up with "good stuff plus a minimum theme". The new builder learns from real decks how each plan is put together. It then adapts its plan, how deep it goes, and its card choices to each pool and commander. Commander comes first. The same learned data shapes 60, 40, and 20-card decks with less weight.

## Read first

- `CLAUDE.md`: rules and working style. The approvals below cover its "stop and ask" items for this work.
- `SPEC.md`: Builder, Commander, Evaluation (the "Reference corpus" bullet), Decisions.
- `docs/corpus-tuning.md`: the previous brief, with the status and numbers of what shipped.
- `docs/todo.md`: the first Builder follow-up and the notes under it.
- `eval/README.md` ("Reference corpus") and `data/corpus/report.md` (local, rebuilt 2026-11-05 with the live config).
- `docs/guides/archetypes.md`, `commander.md`, `deck-shapes.md`, `card-strength.md`: how the current builder decides.

## Why a rewrite

The 2026-11-05 tuning session changed numbers inside the current builder. Deck shapes moved toward real decks (lands, ramp, curve), but the builder did not pick a real deck's plan more often. What it showed:

- **Good stuff plus a minimum theme.** The builder fills a theme only to its minimum, then fills the rest by card strength and by synergy pairs counted across every theme. Decks come out as loose piles of mini-themes, not one plan.
- **Hand-written judgment.** Synergy rules, card strength points, and style matchers are written by hand from Scryfall Tagger tags. Some tags are broad: Graveyard counts every looter and discard outlet, so it looks deep in any pool.
- **The score checks the builder against itself.** Our builds score 85 to 95 and real decks 45 to 60 on our own deck score, so the score cannot tell a good deck from a bad one.
- **A weak yardstick.** "Style match" uses the same loose matchers. A change that over-built Graveyard looked like a gain, and was reverted (26.0.29, undone in 26.0.30). The owner sees Graveyard as a rare style; building it a third of the time was wrong. Small held-out samples (19 Commander decks) also swing by 5 to 10 points.

## Owner decisions and approvals

These were given on 2026-11-05 and cover the "stop and ask" items in CLAUDE.md for this work.

- **Keep every current style.** They are real, common deck styles and the builder keeps building them. Learned plans add new styles. A bigger list costs nothing, because the Build page only shows styles the pool can build.
- **Config format may change,** including new config files and new shapes.
- **New learned data file approved:** `data/learned.json` (below), served beside the card data. Prefer it to changing the data pack schema. If a schema change still turns out necessary, it is approved too, as long as the core keeps reading the previous schema.
- **Sources approved:**
  - **EDHREC**, developer-side. This is a personal, non-commercial, open-source project, and the data is used for learning.
  - **Commander Spellbook.** It asks only for credit, so crediting it is enough.
- **Credit new sources where current ones are credited:** `ATTRIBUTION.md` and the About screens of both apps, next to 17Lands and MTGJSON. No further approval needed.
- **No new dependencies.** The Spellbook file is read with a small streaming reader we write ourselves (see below).
- **Still off limits:** `LICENSE`; publishing a data release (`gh release`); running the "Refresh card data" workflow. The weekly run handles data releases.

## Data sources

### Already local

- **Reference corpus** (`data/corpus/decks.json`, gitignored, from `npm run corpus:fetch`): 188 Commander precons and local lists, about 280 preconstructed 60-card decks, 510 Jumpstart packets, and 54,000 Arena draft decks with win and loss records from 18 sets. See `eval/README.md`.
- **Scryfall** oracle cards, Tagger tags, popularity rank (EDHREC's rank, through Scryfall), and Commander legality, in the data pack. `data/raw/default_cards.jsonl.gz` maps printing ids to oracle ids.

### EDHREC

Checked 2026-11-05. Commander only. It has no official API; the site's own JSON lives at `https://json.edhrec.com/pages/...`.

- **Pages that matter:**
  - Commanders: `/pages/commanders/<slug>.json`, plus theme variants `/pages/commanders/<slug>/<theme>.json`.
  - Themes and tags: `/pages/tags.json` and `/pages/tags/<slug>.json`.
  - Average decks: `/pages/average-decks/<slug>.json`.
  - Combos: `/pages/combos/<slug>.json`.
- **Response shape:** card lists sit in `container.json_dict.cardlists[].cardviews[]`. Each card has `num_decks`, `potential_decks` (inclusion is the ratio), `synergy`, and `lift`. Synergy is the share of the commander's decks running the card, minus its color identity's share. Lift is P(A and B) over P(A)·P(B), with the color identity as the base. EDHREC is moving from synergy to lift: https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era.
- **Card ids** are Scryfall printing ids; map them to oracle ids through `default_cards`.
- **Slugs:** lowercase, diacritics stripped, `'` and `,` dropped, other punctuation dropped, spaces to `-`. A missing page answers 403.
- **Fetch politely:**
  - At most one request per second, with a named User-Agent (`bulk-brew/<version> (+https://github.com/xbadc0ffe/bulk-brew)`).
  - Cache every response under `data/edhrec/` (gitignored), and refetch at most weekly.
  - Fetch the theme pages that match our styles or candidate new styles.
  - Fetch commander pages for the 1,000 most-played commanders by EDHREC rank plus every commander in the corpus, and their theme variants only where a theme is large.
- **What to learn:**
  - Each commander's plan shares (which themes its decks run, how much).
  - Each theme's card and tag profile at 100.
  - A card's fit to a commander and to a plan.
- **What reaches the app:** derived, rounded numbers keyed by oracle id, tag, or style, never EDHREC's pages or card lists as such.
- **Weight:** full at 100. Theme-level signals carry over to 60, 40, and 20 at a lower weight set in config, because EDHREC's decks are singleton and multiplayer.

### Commander Spellbook

Checked 2026-11-05.

- **Access.** A bulk file made for third parties: https://json.commanderspellbook.com/variants.json.gz. It is 31.5 MB gzipped and 714 MB raw, refreshed every two hours, shaped `{timestamp, version, variants[], aliases[]}`. Use the file, not the live API, which asks not to be used for a full export. Credit "Commander Spellbook" with a link to https://commanderspellbook.com.
- **Data.**
  - **Size:** 118,894 combos ("variants"); 4,046 use two cards, 54,698 use three or fewer.
  - **Cards:** each combo lists its cards by Scryfall `oracleId`, with zone and `mustBeCommander`.
  - **Other fields:** template requirements (`requires`), results (`produces`; status S means a standalone, game-impacting result), color identity, mana needed, a power bracket tag (R Ruthless, S Spicy, P Powerful, O Oddball, C Core, E Exhibition, B Banned), and legality in 16 formats.
  - **Non-Commander legality:** a combo is legal outside Commander only when it needs no commander and all its cards are legal there. That makes `legalities.vintage` a ready filter for 60, 40, and 20-card decks; almost every combo of three or fewer cards passes.
- **Reading the file.** It is too big to load in one piece (`JSON.parse` fails on files this size). Write a small streaming reader in `packages/pipeline`:
  - Unzip with Node's built-in `zlib`.
  - Walk the text, counting braces and brackets, and skip over strings.
  - Hand each object inside `variants` to `JSON.parse` one at a time.
  - It is about 60 lines and needs no new package. Test it on a small fixture with nested objects and escaped quotes in strings.
- **Keep** a combo when it:
  - uses three or fewer cards;
  - has no `requires` templates (they cannot be matched to cards);
  - has status OK or Example and is not a spoiler;
  - has at least one standalone result from a list in config (win the game, infinite damage, infinite mana, infinite tokens, and similar).
- **Ship** only oracle ids, result ids, identity, bracket tag, legality bits, and the variant id, pinned by the file's `timestamp` so builds stay deterministic. Leave out descriptions, prerequisites text, prices, and the popularity field. A deck view can link to `https://commanderspellbook.com/combo/<id>` for the steps. Variant ids can change; the file's `aliases` array maps old ids to new ones.
- **How to use it.**
  - **Commander:** filter on `legalities.commander`. Count a `mustBeCommander` card only when it is the commander. Use the bracket tag to keep casual decks casual: prefer Core, Oddball, Powerful, and Spicy, and treat Ruthless as a bonus only when the pool clearly supports it.
  - **60, 40, and 20:** filter on `legalities.vintage`, take two-card combos first, and give combos a small weight.
  - **Watch for:** some "infinite" results still need a third card to win, such as infinite colorless mana with nothing to spend it on.
- **Prior art.** CubeCobra streams the same file in a scheduled job (`packages/jobs/src/update_combos.ts`); the Manafoundry deck generator groups combos by color identity.

## Where learned data lives

- **`config/learned/`** holds small, tag-level and style-level data: plan profiles, tag lift, commander plan shares, per-size weights. It is bundled with the app like the rest of config, so keep it under about 200 KB. Each file has a `version`, and the version joins `configVersion()`, so decks record what they were built with.
- **`data/learned.json`** holds card-level data: combos, per-card plan fit, and card-pair signals for cards the data covers well.
  - Keep it under about 3 MB raw.
  - Generate it with the learning script and commit it.
  - Copy it into each app's `public/data/`, like the card data, and load it with the card data; the service worker caches it.
  - The core takes it as an optional input. Without it, the builder falls back to the tag-level data, so a missing file never breaks a build.
  - Record its version on built decks, beside the data version.

## What to learn

A developer-side script (`npm run learn:build`) turns the sources into the learned data. Everything it writes is aggregate numbers keyed by oracle id, tag, or style.

1. **Plan profiles per style and size.** For each style, current and new, look at the real decks that run it. Record:
   - how many enablers and payoffs they hold;
   - which roles and card types they run;
   - their curve, creature share, and lands.

   Each style gets a learned target and a spread (the middle half) in place of today's single minimums, and its own shape. Sources: corpus decks at each size, and EDHREC theme pages for Commander.

2. **Tighter style definitions.** Check each style's matchers against what its real decks play, and tighten broad ones. Graveyard should need cards that care about the graveyard, not just any looter; Landfall, Goad, and Group hug payoffs are also loose.
3. **New styles.** Group the reference decks and EDHREC themes by what their cards do, and look for common plans none of our styles covers. A new style needs:
   - a clear enabler and payoff structure;
   - enough decks behind it: ten precons, a few hundred draft decks, or a large EDHREC theme;
   - a plain-language label.

   The 2026-11-05 trials (Discard, group slug, cast from exile) are a starting list; see `data/corpus/report.md`, sections 3 and 4.

4. **Card fit per plan.** For each style, which tags, and cards where the data covers them, real decks of that style play more than random bulk does. What counts is the lift over the pool, not the raw count: Graveyard cards are common everywhere, so only an unusual concentration should count.
5. **Card pairs.** Which tags, and well-covered cards, real decks play together more than chance, measured as lift. Use the corpus at all sizes and EDHREC at 100. This replaces "every synergy rule's pairs" in the objective; keep the hand-written rules only as a fallback for cards no data covers.
6. **Commander plans.** For each commander EDHREC covers, the plans its decks run and how often. Combine them with the commander's own text (current matchers and tribes) and the combos it is part of.
7. **Combos** from Commander Spellbook, filtered as above.
8. **Card quality.** Which card traits real decks pick over random bulk (report section 5). For draft-era cards, add 17Lands card win rates if its public data has them (CC BY 4.0, already credited). This recalibrates `card-strength.json` instead of hand-set points.

## How the new builder builds

Keep:

- the deterministic core;
- the candidates and color rules;
- the land formula and mana base;
- the template machinery (roles, curve, type mix);
- the step 1 to 3 results of the last session.

Change how a deck chooses and fills its plan:

1. **Choose the plan.** For each style the pool can build, see how well the pool's best cards for it match the style's learned profile, weighed by lift over the pool, so a theme made of common cards does not win by default.
   - Under a commander, the commander's plan shares from EDHREC and its text lead.
   - Keep the graded commander pull from 2026-11-05, and tune its weight against the new score.
2. **Fill to a real deck's density.** Fill the plan toward its learned target, not its minimum, within the size's role and curve limits.
3. **Pick cards that fit the plan and each other.** A candidate's value comes from:
   - its fit to the plan (learned tag and card lift);
   - its synergy with cards already chosen (learned pairs; EDHREC fit at 100);
   - combo completion (Spellbook);
   - card quality.

   The template acts as constraints. The weights per size live in config: EDHREC and combos count fully at 100 and less at 60, 40, and 20. The choice should react to the pool: a pool deep in one plan builds that plan tightly, a thin pool falls back to a broader deck.

4. **Score finished decks by closeness to real decks of their plan,** not by the builder's own checks. Use profile distance to the plan's real decks, with card quality and castability as small parts. Best fit and the Build page options rank by this score.

## How to judge it

The session judges its own work. It never asks the owner to review decks. Every change reports, per size and per split (train, test):

- **Style mix.** The share of builds per style, next to the share of reference decks per style.
  - A blocker: any style above 25% of builds at a size, or above 1.5 times its reference share.
  - Use the tightened matchers for both sides, and EDHREC theme counts as an independent check at 100.
- **Profile distance.** How far each build's makeup (theme cards, roles, curve, types) sits from real decks of the same plan.
- **Plan recall.** With a reference deck mixed into random bulk, the share of that deck's plan cards the build uses.
- **Style match,** reported as a paired count: decks gained and lost against the previous run, never an average alone. Best fit among close styles is noisy: one synergy rule changed the pick for 55% of 40-card decks.
- **A blind review panel.** For each size, fresh agents read 10 builds from the previous version and 10 from the new one, without knowing which is which. They rate each against `eval/rubric.md` and against real decks of the same plan: is the plan clear, is it deep enough, does it play. Report the share where the new build wins. This is a sanity check beside the numbers, not a target.
- **Existing gates:** `npm run check`, `npm run eval` against the committed baseline (no failures), and the smoke tests on the local build and the live site, including a Commander tribe build (see "Running it" for the pool).

A phase ships only when:

- the style mix has no blocker;
- profile distance improves on train and does not get worse on test;
- plan recall does not drop;
- the review panel favors the new build or calls it even;
- the gates are green.

If a phase cannot meet that after real effort, revert it, record why in `docs/todo.md`, and go on to the next phase that does not depend on it.

## Phases

1. **Measure first.** Add style mix, profile distance, and plan recall to `npm run corpus:eval`, and build the review panel script. No builder change. Record the current builder's numbers as the baseline.
2. **Data.**
   - The learning script over the corpus: plan profiles, tag lift, card pairs.
   - The EDHREC fetch.
   - The Spellbook fetch with the streaming reader.
   - The two learned data files, and the core reading and validating them.
   - Credits in `ATTRIBUTION.md` and the About screens.
3. **Tighter styles, learned plan profiles, and plan choice.** Fill to learned targets. Measure at all sizes, Commander first.
4. **Learned card selection.** Plan fit, learned pairs, combos, EDHREC fit, per-size weights.
5. **Learned deck score.** Profile distance, ranking best fit and the Build page options.
6. **New styles** found in the data, each with its label, a learned profile, and a check that it builds from bulk.
7. **Card quality** recalibration.

## Running it

- **Work through every phase without stopping.** For each phase:
  1. Implement it.
  2. Have a fresh agent review the diff.
  3. Run the measurements.
  4. Check it in the browser.
  5. Commit.
  6. Push when the phase passes.
- **Use subagents freely.** Run data fetching, analysis, and review panels in parallel. Time is not a constraint; run full corpus evaluations, not only quick slices, before deciding.
- **Push only green, usable states,** with any unfinished screen labeled. Every push deploys the live site the owner tries in the morning.
- **Versions:** bump `version` in the root, web, mobile, and ui `package.json` files in its own commit for each shipped phase (from 26.0.30).
- **Commit email:** use the owner's git email from the global config (`info@badc0ffe.net`), and never override it.
- **Morning report.** Leave a short status section at the top of this brief, and end with a short report that leads with the plain outcome. Say what got better, with numbers, what the owner will see on the site, and what was reverted and why.
- **Local only:** the corpus (`data/corpus/`), the EDHREC cache (`data/edhrec/`), and the Spellbook download (`data/spellbook/`) are gitignored. `data/learned.json` is committed.
- **Tribe smoke pool:** the Commander tribe smoke test needs a pool with a tribal commander. Build one from the corpus (for example the Elven Empire precon plus 1,500 random cards), and save it as `eval/pools/elf-tribe.txt` with a comment line saying what it exercises.

## Pitfalls from the 2026-11-05 session

- A score and a yardstick that share a flaw hide it. Check the style mix on every change.
- Synergy rules count for every deck, so a rule for one style changes others' builds.
- Precons are a floor, not a ceiling. The owner's 8 Moxfield decks are never a tuning target.
- Full corpus runs take about 20 minutes. Iterate with `--sizes`, `--limit`, and the train split, then confirm on the full run and the test split.
- Recompute "before" numbers with the current style list whenever styles change.
