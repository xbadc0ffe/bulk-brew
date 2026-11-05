# Learned deck building

A brief for the next builder sessions. The owner approved the direction on 2026-11-05. The goal is to rewrite how Bulk Brew builds decks so it learns how real decks are put together, instead of hand-tuning the current builder's numbers. Commander comes first. The same learned data shapes 60, 40, and 20-card decks with less weight.

## Read first

- `CLAUDE.md`: rules, working style, decision authority.
- `SPEC.md`: Builder, Commander, Evaluation (the "Reference corpus" bullet), Decisions.
- `docs/corpus-tuning.md`: the previous brief, with the status and numbers of what shipped.
- `docs/todo.md`: the first Builder follow-up and the notes under it.
- `eval/README.md` ("Reference corpus") and `data/corpus/report.md` (local, rebuilt 2026-11-05 with the live config).
- `docs/guides/archetypes.md`, `commander.md`, `deck-shapes.md`, `card-strength.md`: how the current builder decides.

## Why a rewrite

The 2026-11-05 tuning session (`docs/corpus-tuning.md`, status at its top) changed numbers inside the current builder. Deck shapes moved toward real decks: lands, ramp, and curve. The builder still did not pick a real deck's plan more often, apart from Commander training decks, which did not hold on held-out ones. What it showed:

- **Good stuff plus a minimum theme.** The builder fills a theme only to its minimum, then fills the rest by card strength and by synergy pairs counted across every theme. Decks come out as loose piles of mini-themes, not one plan.
- **Hand-written judgment.** Synergy rules, card strength points, and style matchers are written by hand from Scryfall Tagger tags. Some tags are broad: Graveyard counts every looter and discard outlet, so it looks deep in any pool.
- **The score checks the builder against itself.** Our builds score 85 to 95 and real decks 45 to 60 on our own deck score, so it cannot tell a good deck from a bad one.
- **A weak yardstick.** "Style match" uses the same loose matchers, so a change that over-builds Graveyard looked like a gain (26.0.29, reverted in 26.0.30). Small held-out samples (19 Commander decks) swing by 5 to 10 points.

## Owner decisions

- **Keep every current style.** They are real, common deck styles and the builder will build them. Learned plans add new styles; a bigger list has no downside, because the Build page only shows styles the pool can build.
- **Config format may change.** New learned data files and new config shapes are approved.
- **EDHREC and Commander Spellbook** are wanted as sources (see below), at full weight for Commander and less for 60, 40, and 20. EDHREC's terms forbid scripted access without written permission, so it waits for that; the builder must work well on our own corpus without it.
- Still ask before: adding a dependency, changing the data pack schema, editing `ATTRIBUTION.md` or `LICENSE`, and publishing a data release (CLAUDE.md).

## Owner to-dos before the data phase

1. Email contact@edhrec.com for permission to fetch and ship derived numbers (see the EDHREC section for what to ask). One message can cover Commander Spellbook, which the same company runs; its maintainers are also on Discord.
2. Approve credit lines for `ATTRIBUTION.md` and the About screens once a source is in.
3. Decide between the `stream-json` dependency and a small hand-written streaming reader for the Spellbook file.
4. Approve the data pack schema change if combos or card-pair data go into the pack (or choose a separate learned data file served beside it).

## Data sources

### Already local

- **Reference corpus** (`data/corpus/decks.json`, gitignored, from `npm run corpus:fetch`): 188 Commander precons and local lists, about 280 preconstructed 60-card decks, 510 Jumpstart packets, and 54,000 Arena draft decks with win and loss records from 18 sets. See `eval/README.md`.
- **Scryfall** oracle cards, Tagger tags, popularity rank, and Commander legality, in the data pack.

### EDHREC

Checked 2026-11-05. **Not usable until EDHREC gives written permission.**

- **Terms.** https://edhrec.com/terms (Space Cow Media, effective 2024-08-06) license the site "solely for your own personal, noncommercial use", forbid copying, distributing, or making derivative works of it, and forbid "software or automated agents or scripts … to generate automated searches, requests, or queries to the Site." Nothing allows open-source reuse, and there is no data program. SPEC's rule is that sources whose terms forbid automated access are not used, so a fetch script and shipped EDHREC numbers both need permission first. Contact: contact@edhrec.com.
- **What it would give.** No official API; the site's own JSON lives at `https://json.edhrec.com/pages/...` (commanders, cards, average decks, tags/themes, combos). Commander pages list cards with `num_decks`, `potential_decks` (inclusion is the ratio), `synergy` (share of the commander's decks minus share of its color identity's decks), and `lift` (P(A and B) over P(A)·P(B) with the color identity as the base; EDHREC is moving from synergy to lift: https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era). Card ids are Scryfall printing ids, which map to oracle ids through `default_cards`. Its decks come from Moxfield and Archidekt. Commander only; theme and card-pair signals would carry over to 60, 40, and 20 at a lower weight, with a singleton multiplayer bias.
- **Allowed today.** Scryfall's `edhrec_rank` (EDHREC popularity, under Scryfall's terms) is already in the data pack and the card strength score. Linking to EDHREC pages is fine.
- **Not fallbacks.** Archidekt's terms have the same automation and noncommercial clauses. Moxfield has no public API and its terms did not load; assume no.
- **Ask the owner to send** (the builder must not contact them itself): a request to fetch commander, card, and theme pages once a week at a stated slow rate with a named User-Agent, and to ship derived per-card and per-commander numbers (lift, inclusion, theme counts, no deck lists) in Bulk Brew's MIT data files, with their preferred credit line. Space Cow Media also runs Commander Spellbook, so one message can cover both.

Until permission arrives, Commander card synergy comes from our own corpus: card-pair and tag-pair lift over the 188 Commander precons and lists (thin, so lean on tags more than single cards), the 54,000 draft decks for 40 cards, and the precons for 60 and 20.

### Commander Spellbook

Checked 2026-11-05 (sources linked). Usable, with permission worth asking for.

- **Access.** A bulk file made for third parties: https://json.commanderspellbook.com/variants.json.gz (31.5 MB gzipped, 714 MB raw, refreshed every two hours). The live API (https://backend.commanderspellbook.com/, docs at https://spacecowmedia.github.io/commander-spellbook-backend/api.html) asks for at most 80 requests a minute, a named User-Agent, and not to export the whole dataset through it; the bulk file is the intended route ("fetch it on a schedule of your own and read it locally"). robots.txt allows everything.
- **Data.** 118,894 combos ("variants"); 4,046 use two cards and 54,698 use three or fewer. Each lists its cards by Scryfall `oracleId` with zone and `mustBeCommander`, template requirements (`requires`), results (`produces`, with a status where S means a standalone, game-impacting result), color identity, mana needed, popularity, a power bracket tag (R Ruthless, S Spicy, P Powerful, O Oddball, C Core, E Exhibition, B Banned), and legality for 16 formats. Every non-Commander format is marked legal only when the combo needs no commander and all its cards are legal, so `legalities.vintage` is a ready filter for 60, 40, and 20-card decks (almost every combo of three or fewer cards passes).
- **Terms.** The backend and site code are MIT; the docs ask users to credit Commander Spellbook and link to https://commanderspellbook.com. There is no license or terms page for the combo data itself (community-submitted), and nothing on commercial use. Its `popularity` field comes from EDHREC, so leave it out. Before shipping, ask the maintainers for permission (Discord: https://discord.gg/DkAyVJG) and get the owner's approval for the `ATTRIBUTION.md` and About screen credit.
- **What to keep.** Combos with three or fewer cards, no `requires` templates, status OK or Example, not spoilers, and at least one standalone result from a list in config (win the game, infinite damage, infinite mana, and similar). Ship only oracle ids, result ids, identity, bracket tag, legality bits, and the variant id, pinned by the file's timestamp so builds stay deterministic. Leave out descriptions, prerequisites text, prices, and popularity; a deck view could link to `commanderspellbook.com/combo/<id>` for the steps. Estimated at about 1 MB raw before compression (not measured).
- **How to use it.** Commander: `legalities.commander`, a `mustBeCommander` card only when it is the commander, and the bracket tag to keep casual decks casual. 60, 40, and 20: `legalities.vintage`, two-card combos first, a small weight. Some "infinite" results still need a third card to win (infinite colorless mana with nothing to spend it on).
- **Pitfalls.** The raw file is too big for `JSON.parse`: a streaming parser is needed (the `stream-json` package is a new dependency, so ask, or write a small one). Combos in the data pack change its schema (ask). Variant ids can change; the file's `aliases` array maps old ids to new ones.
- **Prior art.** CubeCobra streams the same file in a scheduled job (`packages/jobs/src/update_combos.ts`); the open-source Manafoundry deck generator groups combos by color identity in a Lambda; grimorio downloads it beside Scryfall's oracle file at build time.

## What to learn

A developer-side script (say `npm run learn:build`) turns the sources into learned data the core reads. Everything it writes is aggregate numbers keyed by Scryfall oracle id or tag, never a third party's deck lists.

1. **Plan profiles per style and size.** For each style, current and new, the real decks that run it: how many enablers and payoffs, which roles and card types, the curve, creature share, and lands. This replaces the single minimums with a learned target and a spread (middle half), and it gives each style its own shape. Sources: corpus decks that meet the style at each size; for Commander also EDHREC theme pages once permitted.
2. **New styles.** Group the reference decks by what their cards do (tag profiles) and look for common plans none of our styles covers. A new style needs a clear enabler and payoff structure and enough decks behind it (start with ten precons or a few hundred draft decks), plus a plain-language label. The 2026-11-05 trials (Discard, group slug, cast from exile) are a starting list; see `data/corpus/report.md`, sections 3 and 4.
3. **Card fit per plan.** For each style, which tags (and, where the data covers it, which cards) real decks of that style play more than random bulk does. The lift over the pool matters, not the raw count: Graveyard cards are common everywhere, so only an unusual concentration should count.
4. **Card pairs.** Which tags (and well-covered cards) real decks play together more than chance, as lift, from the corpus at all sizes, and from EDHREC card lift for Commander once permitted. This replaces "every synergy rule's pairs" in the objective. Keep the hand-written rules only as a fallback for cards no data covers.
5. **Combos.** From Commander Spellbook: small combos of cards that win or form a strong engine, with the cards each needs.
6. **Card quality.** Which card traits real decks pick over random bulk (report section 5), and, for draft-era cards, 17Lands card win rates if its public data allows. This recalibrates `card-strength.json` instead of hand-set points.

## How the new builder builds

Keep the deterministic core, the candidates and color rules, the land formula and mana base, the template machinery (roles, curve, type mix), and the step 1 to 3 results. Change how a deck chooses and fills its plan:

1. **Choose the plan.** Score each style the pool can build by how well the pool's best cards for it match the style's learned profile, weighed by lift over the pool, so a theme made of common cards does not win by default. Under a commander, add the commander's own plans: its text (current matchers and tribes), its EDHREC themes once permitted, and combos it is part of. Keep the graded commander pull from step 2.
2. **Fill to a real deck's density.** Fill the plan toward its learned target, not its minimum, within the size's role and curve limits.
3. **Pick cards that fit the plan and each other.** Each candidate's value is its fit to the plan (learned tag lift), its synergy with cards already chosen (learned pairs; EDHREC lift at 100 once permitted), combo completion (Spellbook), and card quality, with the template as constraints. Weights per size: EDHREC and combos at full weight at 100 and smaller at 60, 40, and 20, all in config.
4. **Score finished decks by closeness to real decks of their plan,** not by the builder's own checks: profile distance to the plan's real decks, plus card quality and castability as small parts. Calibrate the weights with the owner's side-by-side picks.

## How to judge it

Style match alone is not enough. Every change reports, per size and per split:

- **Style mix:** the share of builds per style next to the share of reference decks per style. A style well above its real share is a regression, whatever else improves.
- **Profile distance:** how far each build's makeup (theme cards, roles, curve, types) is from real decks of the same plan.
- **Plan recall:** with a reference deck mixed into random bulk, the share of that deck's plan cards the build uses.
- **Owner picks:** a small page shows two builds from one pool side by side; the owner picks the better one. About 50 picks calibrate the deck score and confirm the direction. Build this first.
- **Paired counts, not averages:** report decks gained and lost against the previous run. Best fit among close styles is noisy; one synergy rule changed the pick for 55% of 40-card decks.
- The existing gates stay: `npm run check`, `npm run eval` against the committed baseline, and the smoke tests on the live site.

## Phases

Each phase ends with `npm run check` green, a pushed, usable live site, and a report to the owner that leads with the plain outcome.

1. **Judge first.** The owner side-by-side page (developer-side, in the repo or as an artifact), and the new eval reports: style mix, profile distance, plan recall. No builder change.
2. **Data.** The learned data script over the corpus (plan profiles, tag lift, card pairs) and its file format, read and validated by the core. A Commander Spellbook fetch, cached in `data/` (gitignored), once the owner has approved the credit and the maintainers have answered. EDHREC only after written permission. Attribution drafted for the owner to approve.
3. **Learned plan profiles and plan choice.** Profiles for the current styles, lift-based plan choice, fill to learned targets. Measure on all sizes; Commander first.
4. **Learned card selection.** Plan fit, learned pairs, combos, EDHREC lift once permitted, per-size weights.
5. **Learned deck score.** Profile distance, calibrated on the owner's picks.
6. **New styles** found in the data, each with its label, matchers or learned profile, and a check that it is buildable from bulk.
7. **Card quality** recalibration.

## Pitfalls from the 2026-11-05 session

- A score and a yardstick that share a flaw hide it. Check the style mix on every change.
- Synergy rules count for every deck, so a rule for one style changes others' builds.
- Precons are a floor, not a ceiling, and the owner's 8 Moxfield decks are never a tuning target.
- Full corpus runs take about 20 minutes; use `--sizes`, `--limit`, and the train split to iterate, then confirm on the full run and the test split.
- Recompute "before" numbers with the current style list whenever styles change.
- Commit with the owner's git email from the global config; never override it.
