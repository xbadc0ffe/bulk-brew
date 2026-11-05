# Builder review: do our decks work?

## Status

Not started. The session that runs this brief keeps this section current: what is done, what is running, what it found, and where each result lives.

## How to start

Open a Fable session in this repo and say:

> Read docs/algo-review.md and carry out the review. Use workflows and Opus agents as it describes.

That sentence is the owner's opt-in to multi-agent orchestration (the Workflow tool needs it in the owner's own words).

## The question

Bulk Brew builds decks from a pile of bulk cards. The owner looked at the decks it builds today and found Graveyard decks with graveyard payoffs but no real way to fill the graveyard. They hold payoffs that happen to mill one card, removal with "surveil 1", and no looters, discard outlets, or self-mill engines. That is a pile of cards that mention the graveyard, not a Graveyard deck.

The goal is decks that work. A themed deck has cards that set something up and cards that pay off on that setup, in amounts that make the plan happen in a real game. It also has the mana, curve, and interaction to survive until then. Matching real decks is not the goal. Real decks are useful evidence of what works, but resemblance to them is a diagnostic, not a target. It is fine for Graveyard to top a pool's builds, as long as the Graveyard decks work.

This session does a fundamental review:

1. **How our builder decides,** end to end, and where it strings random cards together.
2. **What makes each theme work,** written down precisely enough to measure.
3. **How to measure "this deck works"** in ways that do not share the builder's flaws.
4. **Other ways to build decks:** published and open-source approaches, plus prototypes of the most promising, all run on the same pools.
5. **A comparison** of our builder, its earlier version, the alternatives, and anchor decks, with a recommendation for what to build next.

This session does not change the live builder. It produces the review, the measuring tools, the prototypes, and a recommendation. The owner decides what ships.

## What we know already

### The builder today (26.0.34)

The builder lives in `packages/core/src` and is configured by `config/`. It is deterministic, has no network access, and runs on the device: web and an iOS app, so phone speed matters. In outline:

- **Candidates and facts.** `candidates.ts` and `matchers.ts`: every card in the pool gets facts such as roles, theme enabler and payoff membership, strength, and curve bucket. These come from Scryfall Tagger tags, `config/tag-overlay.json`, and the matchers in `config/archetypes.json` and `config/roles.json`.
- **Scan.** `scan.ts`: which styles a pool can build, from enabler and payoff counts against per-size minimums.
- **Plan choice.** `plan.ts`: at 100, 60, and 20 cards, best fit scores each viable plan with
  - a prior from real decks;
  - the lift of the pool's theme cards over random bulk;
  - how well the pool fills the theme to what real decks run;
  - a weight calibrated by `npm run learn:build`.

  It builds the top three themes plus the plain shapes (Aggro, Midrange, Control). At 40 cards, best fit keeps the older hand-set way.

- **Fill and swap.** `builder.ts`: passes fill roles (removal, card advantage, and so on), the theme to its learned target, and the curve. A local search then swaps cards to raise an objective. That objective adds up:
  - card strength;
  - plan fit, learned card pairs, and combos (`select.ts`);
  - hand-written synergy rules at a quarter weight (`config/synergy-rules.json`);
  - a penalty for drifting outside the middle half of real decks' makeup.
- **Mana.** `lands.ts` and `colors.ts`: land count, nonbasics, and color sources.
- **Card strength.** `strength.ts` and `config/card-strength.json`: hand-set points for popularity, stats, keywords, and effects.
- **Deck score.** At 100, 60, and 20 cards: closeness to real decks of the plan (0.7), card strength (0.15), and castability (0.15). It ranks the Build page options (`options.ts`) and the Analyze pane (`best-decks.ts`).
- **Learned data.**
  - `config/learned/plans.json`: plan profiles, calibrated weights, and bulk shares.
  - `config/learned/tags.json`: tag fit per style and tag pairs.
  - `data/learned.json`: card fit, commander plans, card pairs, and combos.

  These are built from the reference corpus, EDHREC, and Commander Spellbook. See `docs/learned-builder.md`; its status section has the numbers for each shipped phase.

### Why it strings random cards together (found 2026-11-05)

Checked on the Graveyard style with 60-card builds from the owner's bulk. A Blue Graveyard deck counted 10 setup cards and 11 payoffs:

- Seven of the 10 setup copies were payoff cards with a small mill or loot rider.
- The other three were removal or a big creature with a one-time surveil.
- Its real setup cards, two looting sorceries and a loot-and-draw instant, did not count at all.

The causes:

1. **Setup is defined by broad tags.** A Graveyard enabler is any card tagged `mill-self`, which covers anything that mills its controller at all, including surveil 1 on a removal spell. Nothing measures how much a card fills the graveyard or how often. Tags such as `repeatable-surveil` and `repeatable-loot` exist but go unused.
2. **Real setup was excluded.** Looters, rummagers, discard outlets, and sacrifice outlets count only when the same card is also a graveyard payoff. This rule was tightened to stop "any looter makes a Graveyard deck", but it kept the riders and threw out the engines.
3. **Dual cards count twice.** A card that is both enabler and payoff counts for both, so minimums and learned targets are met by payoffs with riders. Nothing requires separate setup cards or a balance between setup and payoff.
4. **The learned data inherits the flaw.** Real decks' profiles were counted with the same matchers, so "real Graveyard decks run 10 enablers" is satisfied by riders. Learned tag fit scores any `mill-self` card the same.
5. **The ranking shares the flaw.** The deck score measures closeness to real decks using the same loose counts. A score and a yardstick that share a flaw hide it.

Every style counts setup and payoff this way. Expect the same problem in Counters, Tokens, Spells, Aristocrats, Lifegain, and the rest until shown otherwise.

### What the last two sessions learned

- Best fit among close styles is noisy: one synergy rule once flipped 55% of 40-card best fits. Judge with paired counts (decks gained and lost), not averages alone.
- Recalibrating the plan choice (`learn:build`) shifts the style mix on its own. Compare other changes on a fixed calibration.
- Card strength changes traded theme cards for generically strong cards. That may be right or wrong. Only a measure of whether the deck works can say.
- Planted-deck pools (a real deck shuffled into 3,000 bulk cards) reward recovering the planted deck. Building a working deck from plain bulk is a different task and needs its own pools.
- Blind review answer keys must live outside the packet folders the reviewers read.
- Small test splits swing by three decks or so. Report counts, not just shares.
- One session judged a phase by a single number and skipped the blind review. Never let one proxy decide.

## Owner decisions and approvals

The owner approved the following for this review. They cover the "stop and ask" items in `CLAUDE.md` for this work.

- **Multi-agent orchestration.** The Fable session coordinates and Opus agents do the work: analysis, labeling, research, implementation, review, and judging. Use the Agent tool with `model: "opus"` for every agent, the Workflow tool for large fan-outs, and `isolation: "worktree"` for agents that write code in parallel. Heavy use is expected. If a workflow size setting caps a fan-out, run it in batches.
- **Web research** into how other deck builders and draft bots work: papers, documentation, and open-source code read for ideas. Never copy code from another project into this MIT repo; reimplement ideas and credit them in the report. Check and record each project's license.
- **New tooling** under `packages/pipeline/src/review/`, with `npm run review:*` scripts, and gitignored output in `data/review/` (add it to `.gitignore`). Reports go in `docs/review/` and are committed.
- **Prototype builders** live in `packages/pipeline/src/review/algos/`. They may import from `@bulk-brew/core` but must not change it.
- **No changes** to `packages/core`, `config/`, the apps, or the learned data files. Bugs found in them go to `docs/todo.md` and the report.
- **No new dependencies.** If an approach needs a solver or library, prototype without it, or record it as a recommendation with its cost.
- **Never** run `gh release`, never run the "Refresh card data" workflow, never touch `LICENSE` or `ATTRIBUTION.md`, and never change the data pack schema.
- **Commits** use the global git email (`info@badc0ffe.net`), never overridden. On a GH007 push error, stop and tell the owner. Commit as you go with `npm run check` green. Push at the end; review commits do not change the app.
- **Privacy.** The owner's bulk lists in `test-bulk/` are personal and gitignored. Results from them stay in `data/review/`. Committed examples come from public pools: `eval/pools` and corpus noise pools.

## Ground rules for every agent

- **Card text comes from data, never from memory.** Agents read oracle text, types, costs, and tags from `data/packs/cards.json` through a helper the session builds first (see Phase 2). Rules questions are answered from `docs/rules/MagicCompRules.txt`, searched with grep, never loaded whole. If `data/packs/` is empty, run `npm run data:pull`; if the rules file is missing, run `npm run rules:fetch`.
- **Determinism.** Every tool and prototype that could ship takes a seed and gives the same result for the same input.
- **Reproducibility.** Every number in a report names the command and output file that produced it.
- **Scratch files** go in a gitignored folder (`data/review/scratch/`), never in `packages/*/src`, where they break `npm run check`.
- **Windows.** Development is on Windows with Git Bash and PowerShell.
  - Shell heredocs that contain backticks fail in the Bash tool; write such files with the file tools.
  - Git Bash rewrites arguments that look like paths; set `MSYS_NO_PATHCONV=1` where needed.
- **User-facing text** (anything the app shows) stays plain language with no em-dashes. Reports should be plain too.

## How the coordinator works

The Fable session plans, splits work, launches agents, checks their output, and integrates. It does little analysis itself.

- **One task, one agent.** Each agent gets a narrow, self-contained task. Its prompt states:
  - the context it needs (this brief's relevant sections, file paths, definitions);
  - the exact inputs;
  - the method;
  - the output file and its format (JSON schema or Markdown outline);
  - what it must not touch;
  - a short reply format, for example "reply with the output path and three lines of findings".

  Agents start without this conversation's context, so give them the why as well as the what.

- **Parallel by default.** Launch independent agents together, in batches of six to ten, or as a Workflow when there are dozens. Agents write results to files. The coordinator reads the files and summaries, not agent transcripts.
- **Verify everything.**
  - Every analysis or spec gets a second, fresh Opus agent that tries to prove it wrong.
  - Every code change gets a fresh reviewer agent on the diff.
  - The coordinator runs the commands itself before trusting a number.
  - For labels, measure agreement between two independent agents on a sample.
- **Blind judging.** Review panels never learn which builder made which deck. Shuffle order, strip names, and keep answer keys in `data/review/keys/`, outside packet folders.
- **Keep a log.** Append a short entry to `docs/review/log.md` for each step: what ran, where the output is, and what it showed. Update this brief's Status section at the end of each phase.

## Phases

Work through the phases in order. Each ends with its outputs written and reviewed, `npm run check` green, and a commit.

### Phase 1: Map the builder

Six to eight Opus agents (read-only, Explore or general-purpose) each map one part and write a section of `docs/review/algo-map.md`:

1. Candidates, facts, matchers, and the tag overlay.
2. Scan and viability.
3. Plan choice, best fit, and calibration (`plan.ts`, `calibrate.ts`, `learn-build.ts`).
4. Fill passes and swap search (`builder.ts`).
5. Learned selection and synergy rules (`select.ts`, `synergy-rules.json`).
6. Card strength, deck score, options, and Analyze.
7. Mana base and color handling.
8. Commander specifics: the commander's pull, tribes, the 99, and EDHREC commander data.

For each part, the section covers:

- what it decides and with which inputs;
- every number that steers it (config key, or hard-coded with `file:line`);
- how a theme's setup and payoff enter it;
- where a card can get in for a reason unrelated to how the deck plays.

A reviewer agent then checks the map against the code and the coordinator merges it. The map ends with a list of suspected "random card" entry points, each with a concrete example built with `npm run demo:build` on a public pool.

### Phase 2: What makes each theme work

**Tools first.** Build `npm run review:cards`. Given names, ids, or a tag, it prints each card's oracle text, type, cost, colors, tags, and which current matchers it meets. Every later agent uses it.

**Theme specs.** One Opus agent per style writes `docs/review/themes/<style>.md`. That covers all 18 synergy styles in `config/archetypes.json`, tribal (creature types), and the three plain shapes. Each spec covers:

- **The resource.** What the theme builds up and spends: cards in graveyard, tokens, counters, life gained, spells cast, artifacts, sacrifice fodder, landfall triggers, and so on.
- **Setup jobs.** Card functions that create the resource, with:
  - how to recognize them from oracle text and tags;
  - how to weigh them by amount and repetition (mill 4 every turn is not surveil 1 once);
  - common false friends (riders, symmetric effects, one-off triggers).
- **Payoff jobs.** Card functions that turn the resource into an advantage, with thresholds where they exist (threshold, delve, undergrowth counts).
- **Support jobs** that protect or connect the plan. Aristocrats, for example, needs fodder, outlets, and death payoffs as three separate parts.
- **What "works" means in numbers.**
  - How much setup per payoff at 60, 40, 20, and 100 cards.
  - How many of each the deck needs.
  - By which turn the plan should be online most games.
  - What a card that is both setup and payoff counts as.
- **Evidence.** Real decks that run the theme: precons and draft winners from `data/corpus/decks.json`, with their setup and payoff counts. Also rules references where mechanics matter, such as how delve or threshold count, from the Comprehensive Rules.
- **Known traps** in the current matchers for this theme.

A second Opus agent reviews each spec against the card data and the rules. The coordinator resolves disagreements.

### Phase 3: Card labels and the matcher audit

The theme specs become labels that measure decks independently of the builder's matchers.

- **Label set.** Label the cards that matter for the comparison:
  - every card in every deck built in Phases 5 and 6;
  - a stratified sample of each style's candidates: cards its matchers accept, and cards with related tags its matchers reject.

  Opus agents label in batches of about 80 cards, one style per batch, using the spec and `review:cards`. Each label records: role (setup, payoff, both, support, none), weight 0 to 3 for how much it moves the plan, whether it repeats, and one line of why. Write JSON lines to `data/review/labels/<style>.jsonl`.

- **Agreement.** A second agent labels 10% of each style blind. Report agreement per style. Where agreement is low, fix the spec and relabel, rather than averaging.
- **Matcher audit.** For each style, write `docs/review/matchers.md`:
  - precision: of the cards our matchers call setup or payoff, the share the labels agree with;
  - recall: of the cards labeled setup or payoff, the share our matchers catch;
  - the worst false positives and misses, with oracle text.

  The same audit covers the `config/roles.json` roles, since removal or card advantage tagged too broadly also fills decks with cards that do not do the job.

### Phase 4: Measures of a working deck

Build `npm run review:measure`. It scores any decklist for a named plan with:

1. **Function counts** from the labels: weighted setup, weighted payoff, and their ratio, each card counted once, against the theme spec's numbers. It also counts cards that do no job for the plan and are not strong generic cards (dead cards).
2. **Goldfish simulation.** A seeded solitaire model, many games per deck. It draws, plays a land a turn, and casts what the mana allows by a simple priority. Labels drive the theme's resource: setup adds to it, and payoffs count as live once their threshold is met. Measure:
   - the turn the plan comes online (a live payoff with its setup behind it);
   - the share of games where it is online by turn 5 (turn 6 at 100 cards);
   - mana screw and flood rates;
   - spells cast on curve.

   This is a model, not the rules of Magic. Keep it small, document what it ignores, and test it on decks whose answer is obvious.

3. **Mana and curve:** the existing castability and curve checks.
4. **Resemblance**, kept as diagnostics only: style mix, profile distance, and plan recall from `npm run corpus:eval`.

Then extend the blind panel (`corpus-panel.ts` or a new `review:panel`):

- **Rubric.** Rewrite it around function, in `docs/review/rubric.md`:
  - Does the deck have a plan a player could explain?
  - Does it have setup and payoff that feed each other?
  - Will the plan come together in most games?
  - Which cards are dead?
  - Would you rather play it than the other deck?

  Judges give pairwise picks and absolute scores, and name the dead cards.

- **Anchors.** Calibrate the measures and the judges with anchors that have known answers:
  - real precons and winning 17Lands draft decks (strong);
  - random piles in the same colors with a legal mana base (weak);
  - a "good stuff" pile of the strongest cards in the colors with no theme;
  - a deck built by hand by an Opus agent from the same pool (see Phase 6).

  A measure or judge that cannot put the strong anchors above the random piles is broken; fix it before using it.

Exit check: on the anchors, the function measures, the goldfish model, and the panel agree on the order. Where they disagree, find out why and write it down.

### Phase 5: Pools and baselines

**Pool sets,** with seeds and recipes in `docs/review/pools.md`:

- **Plain bulk:** 30 seeded 3,000-card samples from the corpus noise source (`noiseSource` in `packages/pipeline/src/corpus.ts`), with no planted deck. This is the main test: make a working deck from what is there.
- **Rich pools:** plain bulk plus a doubled share of one theme's cards, for each major theme. These test whether a builder finds and finishes a plan when it exists.
- **Planted pools:** a sample of `corpus:eval` pools, to keep the recall diagnostic.
- **Public fixed pools:** `eval/pools/*.txt`.
- **The owner's bulk:** `test-bulk/*.txt`, local only, results in `data/review/`.

**Requests.** 60 and 100 cards first, then 40 and 20. For each pool, build best fit plus each viable style requested by name, so every theme gets compared even when it is not the top pick. At 100 cards, pick commanders from the pool by a fixed, documented rule.

**Baselines:**

- the current builder (HEAD);
- the builder before the learned work (version 26.0.30, run from a git worktree on the same pools);
- the anchors from Phase 4.

Store every built deck with its algorithm, pool, request, and seed in `data/review/decks/`.

### Phase 6: Other algorithms

**Research.** Three or four Opus agents survey how other systems build decks and pick cards, and write `docs/review/research.md` with sources, licenses, and what each approach would need from our data. Look at:

- open-source Magic engines with automatic deck building, such as Forge;
- draft bot and cube tools, such as CubeCobra and published draft-bot research;
- data-driven recommenders: EDHREC's synergy score, 17Lands pick orders and win rates;
- general methods for building a set under constraints: local search, simulated annealing, genetic algorithms, integer programming, and co-occurrence models such as card embeddings.

Verify claims about other projects from their own docs or code; do not repeat them from memory.

**Prototypes.** Each prototype is an Opus agent's job in its own worktree, behind one shared interface (`build(pool, request, seed) -> deck`) defined by the coordinator first. Candidates, at least five:

1. **The current builder with honest theme counting.** Labels or spec-based weights for setup and payoff, each card counted once, and a setup-to-payoff balance. This tells us how much of the gap is definitions rather than the algorithm.
2. **Seed and grow, the way people build.** Pick the payoffs the pool supports best, add setup in proportion to what those payoffs need, then interaction and card advantage, then fill the curve, then the mana.
3. **Resource accounting with local search.** Each card produces or consumes the theme's resource. Search (annealing or similar, seeded) for the deck that keeps payoffs fed, under curve, role, and mana constraints.
4. **Goldfish-fitness search.** Use the Phase 4 simulator as the fitness function, starting from another builder's deck.
5. **Co-occurrence.** Grow a deck around a core using what real decks play together (corpus decks, EDHREC pages, the learned pairs).
6. **Pick order, for 40 cards.** Build like a draft deck from 17Lands-style card ratings learned from the corpus's draft decks and their wins.
7. **An Opus agent building by hand, as a reference only.** Give the agent the pool's candidates in the deck's colors (via `review:cards`) and the theme specs, and ask it to build the best deck it can. It cannot ship because the app has no network, but it shows how much better a careful builder does and which choices the algorithms miss. Use a sample of pools, not all.

For each prototype, record:

- build time per deck (the app runs on phones; the current builder takes about 90 ms for a synthetic 100-card build);
- whether it is deterministic;
- what data it needs;
- how much code it would take to ship.

A reviewer agent checks each prototype for bugs and for peeking at evaluation labels it should not see. Labels used by a builder and labels used to judge it must come from separate labeling passes, or the measure shares the builder's view.

### Phase 7: Compare

Run every algorithm on every pool set and request, then measure:

- function counts, goldfish results, mana, and curve for every deck;
- resemblance diagnostics for every deck;
- blind panels on a stratified sample. Every algorithm pair at 60 and 100 cards, at least 20 pairs per pair-up, with anchors mixed in. Report the win share and the judges' agreement.

Break results down by theme and size; an algorithm that wins on average but fails Graveyard is not a winner. Report paired counts, not only means. For each algorithm, include three or four decks that show its typical result, with each card's label and the dead cards marked, from public pools only.

### Phase 8: Report and recommendation

Write `docs/review/report.md`. Lead with plain answers:

1. **Do our decks work?** Per theme and size, by the function measures, the goldfish model, and the panel, with numbers.
2. **Where does our builder go wrong,** in order of impact, each tied to the map and an example deck.
3. **Which approach builds decks that work best,** by how much, at what cost in speed, code, and data, and how sure we are.
4. **What to build next:** a phased plan for the next session, with ship rules built on these measures instead of resemblance, and what each phase needs from the owner.

Also:

- add open items to `docs/todo.md`;
- update this brief's Status section;
- if the session has the Artifact tool, publish the report as a private Artifact page so the owner can read it on any device (no owner pool data in it);
- end the session with a short plain summary that leads with the answer to question 1.

## Pitfalls to avoid

- A score and a yardstick built on the same definitions agree with each other and tell you nothing. Keep the labels and measures independent of whatever builder they judge.
- Tags are hints, not truth: `mill-self` covers surveil 1. Read the oracle text.
- A card that is both setup and payoff must not count as both.
- Real decks are evidence of what works, not a target. A deck can work and look unusual.
- Plain shapes (Aggro, Midrange, Control) work too when built well. Do not judge them by theme measures.
- Precons and draft decks are floors, not ceilings. The owner's eight Moxfield decks are never a tuning target.
- Best fit is noisy among close styles. Requested-style builds compare themes more fairly.
- Full corpus runs take about 20 minutes per pass. Use `--sizes`, `--limit`, and small pool sets while iterating, then confirm on the full sets.
- Do not trust a number you have not reproduced, and do not let a single number decide anything.
