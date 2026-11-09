# Builder review: decent decks from bulk

## Status

In progress since 2026-11-08. The session that runs this brief keeps this section current: what is done, what is running, what it found, and where each result lives. The step-by-step record is `docs/review/log.md`.

- Phase 1 done, not yet committed: `docs/review/research.md` (five families plus our builder, every claim checked by a second agent, notes in `docs/review/research/*.verify.md`), `docs/review/our-builder.md`, `docs/review/our-builder-themes.md`, `docs/review/shortlist.md` with `shortlist-objections.md`. Final prototypes: `a-objective` and `a-search` (the current builder's code with an honest supply-and-demand objective, plus a search variant) and `b-grow` and `b-oldrules` (seed and grow, with and without the theme rules).
- Phase 2 groundwork done and reviewed: `review:cards`, `review:build` (head, head-web, v26.0.30, random), `review:pools` (103 pools), `review:anchors` (170 real decks), `review:requests` (73,141 jobs), `review:check`, `review:packets`, `review:collate`, `docs/review/rubric.md`, `docs/review/themes.md` (21 styles). In flight when the session's usage limit hit: `theme-rules.json` with its calibration against real decks, the hand-built reference decks, and the build of the new shape and two-color jobs.
- Next: commit Phase 1 and the groundwork after `npm run check`; build the four prototypes against `theme-rules.json` (develop on plain-01 to plain-10 and the public pools only); run them on the jobs; make judging batches; calibrate the panel on the anchors; collate; write `docs/review/report.md`. `docs/review/log.md` has the step-by-step record.

## How to start

Open a Fable session in this repo and say:

> Read docs/algo-review.md and carry out the review. Use workflows and Opus agents as it describes.

That sentence is the owner's opt-in to multi-agent orchestration (the Workflow tool needs it in the owner's own words).

## The goal

Bulk Brew builds decks from a pile of bulk cards. These are bulk decks, not perfect decks. Nobody expects a tuned deck from cards that were sitting in a box. But each deck should be decent, not a pile of random cards that happen to share a word.

The owner found Graveyard decks with graveyard payoffs and no real way to fill the graveyard. They held payoffs that happen to mill one card, removal with "surveil 1", and no looters, discard outlets, or self-mill engines. That is the failure this review is about.

**A decent bulk deck:**

- has a plan a player could explain in a sentence;
- runs setup cards and payoff cards that feed each other, in numbers that make the plan show up in most games;
- can cast its spells: a sensible curve, land count, and color sources;
- has some interaction (removal, blockers, counters) and something that wins the game;
- has few cards that do nothing for the plan or the game.

**A decent bulk deck does not need to be:**

- the best deck the pool could make;
- full of strong or rare cards;
- a copy of a real deck. Real decks are evidence of what works, not a target.

A plain Aggro, Midrange, or Control deck built from good cards with a working curve counts as decent too. A themed deck that names a theme but lacks the setup or the payoff does not. It is fine for one theme, such as Graveyard, to top a pool's builds when the pool is rich in it, as long as those decks are decent.

## The plan

1. **Review other algorithms.** How other deck builders, draft bots, and recommenders build decks, with a short description of ours alongside them.
2. **Build a few new algorithms** of our own, from what the review finds.
3. **Test every version end to end** on the same pools: the current builder, the one before the learned work, and the new ones.
4. **Compare and recommend** which to ship next.

This session does not change the live builder. It produces the review, the prototypes, the test results, and a recommendation. The owner decides what ships.

## What we know already

### Our builder today (26.0.34)

It lives in `packages/core/src` and is configured by `config/`. It is deterministic, has no network access, and runs on the device: web and an iOS app, so phone speed matters. A synthetic 100-card build takes about 90 ms on desktop, and the Build page builds several decks per request. In outline:

- **Cards and facts.** `candidates.ts` and `matchers.ts` give every pool card its roles, theme enabler and payoff membership, strength, and curve bucket. These come from Scryfall Tagger tags, `config/tag-overlay.json`, and the matchers in `config/archetypes.json` (18 themed styles plus the Aggro, Midrange, and Control shapes) and `config/roles.json`.
- **Which plans the pool can build.** `scan.ts` compares enabler and payoff counts with per-size minimums.
- **Which plan to build.** `plan.ts` scores plans from real decks' priors, how much of the theme the pool holds above random bulk, and calibrated weights. Best fit builds the top few.
- **Building.** `builder.ts`: passes fill roles (removal, card advantage, and so on), the theme to a target learned from real decks, and the curve. A swap search then raises an objective made of:
  - card strength (`strength.ts`, `config/card-strength.json`);
  - plan fit, learned card pairs, and combos (`select.ts`);
  - hand-written synergy rules (`config/synergy-rules.json`);
  - a penalty for drifting from real decks' makeup.
- **Mana.** `lands.ts` and `colors.ts`.
- **Ranking.** A deck score ranks the Build page options (`options.ts`) and the Analyze pane (`best-decks.ts`).
- **Learned data.** `config/learned/` and `data/learned.json`, from the reference corpus, EDHREC, and Commander Spellbook. See `docs/learned-builder.md`.

### Why it strings random cards together (found 2026-11-05)

Checked on Graveyard with 60-card builds from the owner's bulk. A Blue Graveyard deck counted 10 setup cards and 11 payoffs:

- Seven of the 10 setup copies were payoff cards with a small mill or loot rider.
- The other three were removal or a big creature with a one-time surveil.
- Its real setup cards, two looting sorceries and a loot-and-draw instant, did not count at all.

The causes:

1. **Setup is defined by broad tags.** `mill-self` covers anything that mills its controller at all, including surveil 1 on a removal spell. Nothing measures how much or how often a card fills the graveyard.
2. **Real setup was excluded.** Looters, rummagers, discard outlets, and sacrifice outlets count only when the same card is also a graveyard payoff.
3. **Dual cards count twice.** A card that is both enabler and payoff counts for both, so payoffs with riders meet the setup minimums. Nothing asks for separate setup cards or a balance between setup and payoff.
4. **The learned data and the deck score inherit the flaw,** because they count real decks and our decks with the same matchers.

Every style counts setup and payoff this way, so expect the same problem in other themes until shown otherwise.

### Lessons from the last two sessions

- A score and a yardstick built on the same definitions agree with each other and tell you nothing. Judge decks with something independent of the builder.
- Best fit among close styles is noisy. Compare themes with requested-style builds, and report paired counts (decks gained and lost), not only averages.
- Card strength changes traded theme cards for generically strong cards. Whether that is better is a question for the judges, not for a resemblance number.
- Pools made by hiding a real deck in 3,000 bulk cards reward recovering that deck. Plain bulk with nothing hidden is the real task.
- Blind review answer keys must live outside the folders reviewers read.
- Never let one number decide.

## Owner decisions and approvals

The owner approved the following for this review. They cover the "stop and ask" items in `CLAUDE.md` for this work.

- **Multi-agent orchestration.** The Fable session coordinates and Opus agents do the work: research, implementation, review, and judging. Use the Agent tool with `model: "opus"` for every agent, the Workflow tool for large fan-outs, and `isolation: "worktree"` for agents that write code in parallel. Heavy use is expected. If a workflow size setting caps a fan-out, run it in batches.
- **Web research** into how other deck builders and draft bots work: papers, documentation, and open-source code read for ideas. Never copy code from another project into this MIT repo; reimplement ideas and credit them in the report. Check and record each project's license.
- **New tooling and prototypes** under `packages/pipeline/src/review/`, with `npm run review:*` scripts, and gitignored output in `data/review/` (add it to `.gitignore`). Reports go in `docs/review/` and are committed. Prototypes may import from `@bulk-brew/core` but must not change it.
- **No changes** to `packages/core`, `config/`, the apps, or the learned data files. Bugs found there go to `docs/todo.md` and the report.
- **No new dependencies.** If an approach needs a solver or library, prototype without it, or record it as a recommendation with its cost.
- **Never** run `gh release`, never run the "Refresh card data" workflow, never touch `LICENSE` or `ATTRIBUTION.md`, and never change the data pack schema.
- **Commits** use the global git email (`info@badc0ffe.net`), never overridden. On a GH007 push error, stop and tell the owner. Commit as you go with `npm run check` green. Push at the end; review commits do not change the app.
- **Privacy.** The owner's bulk lists in `test-bulk/` are personal and gitignored. Results from them stay in `data/review/`. Committed examples come from public pools: `eval/pools` and corpus noise pools.

## Ground rules for every agent

- **Card text comes from data, never from memory.** Agents read oracle text, types, costs, and tags from `data/packs/cards.json`, through the card helper built in Phase 2. Rules questions are answered from `docs/rules/MagicCompRules.txt`, searched with grep, never loaded whole. If `data/packs/` is empty, run `npm run data:pull`; if the rules file is missing, run `npm run rules:fetch`.
- **Determinism.** Every builder that could ship takes a seed and gives the same deck for the same pool, request, and seed.
- **Reproducibility.** Every number in a report names the command and output file that produced it.
- **Scratch files** go in `data/review/scratch/`, never in `packages/*/src`, where they break `npm run check`.
- **Windows.** Development is on Windows with Git Bash and PowerShell.
  - Shell heredocs that contain backticks fail in the Bash tool; write such files with the file tools.
  - Git Bash rewrites arguments that look like paths; set `MSYS_NO_PATHCONV=1` where needed.
- **Plain language** in reports and anything the app shows, with no em-dashes.

## How the coordinator works

The Fable session plans, splits work, launches agents, checks their output, and integrates. It does little research or coding itself.

- **One task, one agent.** Each agent gets a narrow, self-contained task. Its prompt states:
  - the context it needs (this brief's relevant sections, file paths, definitions);
  - the exact inputs;
  - the method;
  - the output file and its format;
  - what it must not touch;
  - a short reply format, for example "reply with the output path and three lines of findings".

  Agents start without this conversation's context, so give them the why as well as the what.

- **Parallel by default.** Launch independent agents together, in batches of six to ten, or as a Workflow when there are dozens. Agents write results to files. The coordinator reads the files and summaries, not agent transcripts.
- **Verify everything.**
  - Every research write-up and design gets a second, fresh Opus agent that tries to prove it wrong.
  - Every prototype gets a fresh reviewer agent on its code.
  - The coordinator runs the commands itself before trusting a number.
- **Blind judging.** Judges never learn which version built a deck. Shuffle order, strip names, and keep answer keys in `data/review/keys/`, outside the folders judges read.
- **Keep a log.** Append a short entry to `docs/review/log.md` for each step: what ran, where the output is, and what it showed. Update this brief's Status section at the end of each phase.

## Phases

Work through the phases in order. Each ends with its outputs written and reviewed, `npm run check` green, and a commit.

### Phase 1: Review other algorithms

**Research.** Four to six Opus agents, each on one family, write a section of `docs/review/research.md`. Families:

- open-source Magic engines that build decks automatically, such as Forge;
- cube and draft tools and their bots, such as CubeCobra, and published draft-bot research;
- data-driven recommenders: EDHREC's synergy score and average decks, 17Lands pick orders and win rates;
- auto-build features in digital card games, from their public descriptions;
- general methods for choosing a set of items under constraints: greedy fill, local search, simulated annealing, genetic algorithms, integer programming, and co-occurrence models such as card embeddings.

For each approach, record:

- how it picks a plan or archetype;
- how it picks cards, and whether it makes setup and payoff fit together or only counts theme cards;
- how it handles mana, curve, and interaction;
- what data it needs, and whether we have it (the corpus, EDHREC pages, Commander Spellbook, 17Lands draft decks with wins, Scryfall tags and oracle text);
- speed, determinism, and license;
- how well it suits bulk pools on a phone.

Verify claims about other projects from their own docs or code; do not repeat them from memory.

**Our builder, as one more entry.** One or two Opus agents read `packages/core/src` and write `docs/review/our-builder.md` in the same format: how it picks a plan and cards, and where a card can get in for a reason unrelated to how the deck plays. Start from the Graveyard finding above and check two or three other themes the same way, with `npm run demo:build` on public pools.

**Shortlist.** The coordinator picks three to five approaches to build, with reasons, in `docs/review/shortlist.md`. A fresh Opus agent argues against the shortlist before it is final. Prefer approaches that make setup and payoff fit together, run fast, and use data we have.

### Phase 2: Build new algorithms

**Shared groundwork first,** built and reviewed before any prototype starts:

- **Card helper.** `npm run review:cards`: given names, ids, or a tag, it prints each card's oracle text, type, cost, colors, tags, and which current matchers it meets.
- **Theme guide.** `docs/review/themes.md`, one short section per style, written by Opus agents (one per few styles) and checked by a reviewer. Each section covers:
  - what the theme builds up and spends: cards in graveyard, tokens, counters, life gained, spells cast, artifacts, sacrifice fodder, and so on;
  - which card jobs set it up and which pay it off, how to tell them apart in oracle text, and common false friends such as one-off riders;
  - what is enough for a decent bulk deck at 60, 40, 20, and 100 cards: roughly how much setup per payoff, and how many of each.

  Keep it practical. It is a builder's and a judge's guide, not an encyclopedia.

- **One interface.** `build(pool, request, seed) -> deck`, plus a runner that builds any version on any pool and stores the deck with its version, pool, request, and seed in `data/review/decks/`.
- **Adapters** for the current builder (HEAD) and the builder before the learned work (version 26.0.30, run from a git worktree), so both run through the same runner.

**Prototypes.** Each shortlisted approach is one Opus agent's job, in its own worktree under `packages/pipeline/src/review/algos/`. Unless Phase 1 finds better ones, start from these:

1. **The current builder with honest theme counting.** It defines setup and payoff by the theme guide, counts each card once, weighs setup by how much and how often it feeds the plan, and asks for a sensible balance of setup and payoff. This shows how much of the problem is definitions rather than the algorithm.
2. **Seed and grow, the way people build.** Pick the payoffs the pool supports best, add setup in proportion to what those payoffs need, then interaction and card advantage, then fill the curve, then build the mana.
3. **Resource accounting with local search.** Each card produces or consumes the theme's resource. A seeded search looks for the deck that keeps its payoffs fed, under curve, role, and mana limits.
4. **One approach from the research,** for example co-occurrence from real decks, or a pick-order build at 40 cards from the 17Lands draft decks and their wins.

Each prototype must:

- build 60, 40, 20, and 100-card decks, or say which sizes it skips and why;
- be deterministic, use no network, and add no dependencies;
- report its build time per deck.

A fresh reviewer agent checks each prototype's code for bugs and for shortcuts that only make it look good on the tests.

**A reference, not a candidate.** For a sample of pools, an Opus agent builds decks by hand from the pool's cards, using the card helper and the theme guide. This shows what a careful builder gets from the same bulk and which choices the algorithms miss. It cannot ship: the app has no network.

### Phase 3: Test end to end

**Pools,** with seeds and recipes in `docs/review/pools.md`:

- **Plain bulk:** 30 seeded 3,000-card samples from the corpus noise source (`noiseSource` in `packages/pipeline/src/corpus.ts`), with no real deck hidden in them. This is the main test.
- **Theme-rich bulk:** plain bulk plus extra cards of one theme, for each major theme. These test whether a builder finishes a plan when the pool has one.
- **Public fixed pools:** `eval/pools/*.txt`.
- **The owner's bulk:** `test-bulk/*.txt`, local only.

**Requests.** 60 and 100 cards first, then 40 and 20. For each pool, build best fit plus each style the pool can support, requested by name, so every theme gets compared even when it is not the top pick. At 100 cards, pick commanders from the pool by a fixed, documented rule.

**Versions.** The current builder, the builder before the learned work, every prototype, and two anchors with known answers:

- random piles in the same colors with a legal mana base, which should fail;
- real precons and winning 17Lands draft decks from `data/corpus/decks.json`, which should pass.

The hand-built reference decks join the comparison for the pools that have them.

**Judging.** The main judge is a blind panel of Opus agents with a rubric for a decent bulk deck, in `docs/review/rubric.md`. For each deck, a judge answers:

- **Decent or not,** by the definition in "The goal".
- **Plan:** what the deck is trying to do, in one sentence, or "no clear plan".
- **Setup and payoff:** which cards set the plan up and which pay off, and whether there is enough of each.
- **Plays:** curve, mana, interaction, a way to win.
- **Dead cards:** cards that do nothing for the plan or the game.
- **A score from 1 to 5,** where 3 is decent.

Judges also pick the better deck in blind pairs. Two judges score every deck in a sample, so the report can show how often they agree. The judges read oracle text through the card helper, never from memory. The rubric must tell them the bar: decent from bulk, not perfect. A deck is not worse for using commons; it is worse for not doing its thing.

Cheap automatic checks run on every deck and back up the panel:

- legality, deck size, copy limits, and colors;
- castability, curve, and land count, using the existing checks;
- setup and payoff counts from the theme guide, counting each card once;
- build time and determinism (build twice, compare).

A simple goldfish simulation is optional. It plays each deck alone for many seeded games and records how often the plan comes online by turn 5. Build it only if the panel and the automatic checks disagree in ways that need settling.

Before trusting the panel, check it on the anchors. Judges must fail most random piles and pass most real decks. If they do not, fix the rubric first.

### Phase 4: Compare and recommend

Write `docs/review/report.md`. Lead with plain answers:

1. **How often does each version build a decent deck?** By size and theme, with counts. Include the head-to-head win share from the paired judging.
2. **Why decks fail,** per version: no real setup, too few payoffs, bad mana, no interaction, dead cards. Give two or three example decks per version from public pools, with the judges' notes.
3. **Which version to build on,** at what cost in speed, code, and data, and how sure we are.
4. **What to build next:** a phased plan for the next session. Ship rules for each phase should rest on the decent rate and the panel, with resemblance to real decks as a diagnostic only. Say what each phase needs from the owner.

Then:

- add open items to `docs/todo.md`;
- update this brief's Status section;
- if the session has the Artifact tool, publish the report as a private Artifact page so the owner can read it on any device, with no owner pool data in it;
- end the session with a short plain summary that leads with the answer to question 1.

## Pitfalls to avoid

- Tags are hints, not truth: `mill-self` covers surveil 1. Read the oracle text.
- A card that is both setup and payoff must not count as both.
- Keep the judges independent of every builder. Builders use the theme guide; judges read the cards and decide for themselves.
- Do not grade bulk decks against tuned decks. Decent is the bar.
- Plain shapes (Aggro, Midrange, Control) can be decent too. Do not fail them for lacking a theme.
- Best fit is noisy among close styles. Requested-style builds compare themes more fairly.
- A prototype that wins by being slow, nondeterministic, or tuned to the test pools is not a winner.
- Precons and draft decks are anchors and evidence, not targets. The owner's eight Moxfield decks are never a tuning target.
- Do not trust a number you have not reproduced, and do not let a single number decide anything.
