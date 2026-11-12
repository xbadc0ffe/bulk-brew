# Builder phase 1: seed and grow for requested styles

## Status

Started 2026-11-11 (overnight session). The session that runs this brief keeps this section current: what is done, what is running, what it found, and where each result lives.

- **Findings before coding.** Sphinx's Tutelage counts as weight-2 Graveyard setup because its `repeatable-loot` tag meets the "looter on a permanent" rule, though its loot costs six mana; the fix is a cost check on that rule. Ruin Crab is not a Graveyard job at all (the rules read it as Mill setup); it entered through the early-creature role, so the fix is a rule flag, `setupNeedsPayoff`, on Mill, Group hug, and Energy, which the builder's gate applies to off-plan setup.
- **Done: the rules as config** (commits 7da6416 and 6b3b382, reviewed). `config/theme-rules.json` is rules version 3 with three new style keys: `kin` (the nearest styles that share the resource), `setupNeedsPayoff` (Mill, Group hug, Energy), and `lacks` (a plain phrase per floor). The core loads and validates it (`packages/core/src/theme-rules.ts`); it is in the config version as `h3`. `npm run theme:bulk` writes `config/theme-bulk.json`, the bulk baseline (version `1w1e1xl`, pack 2026-11-03, 2.2 s), in the config version as `q`. The looter fix: a loot activation costing four mana or more no longer counts as a weight-2 looter; nine cards move to 0.5 (Sphinx's Tutelage among them), all 708 guide examples unchanged.
- **Done: review tooling** (commit be6b71a, merged as e36fb67, review pending). `review:pools --seed-prefix`, `review:requests --prefix`, the `v26.0.35` runner version (today's builder from a worktree at `../bulk-brew-26.0.35`, identical to `head` before this phase on three builds), packets that tell the judge the requested style, the `decent_of_style` answer and its collation columns, paired-singles sampling (`sameAs`, `poolPrefix`, `substituted`, `--also`).
- **Running.** The builder port into the core (`packages/core/src/grow.ts`; requested themed styles and the three shapes at 60, 100, and 40 when the player asked for the style; note and nearest; rules viability on the scan).
- **Next.** The apps (style list from the rules, the note in both apps), docs, eval, push and smoke, then the panel: new `h1-` pools, requests for `head` and `v26.0.35` at 60, 100, and 40, about 370 packets.

## How to start

Open a Fable session in this repo and say:

> Read docs/builder-phase1.md and carry out the brief. Use workflows and Opus agents as it describes.

That sentence is the owner's opt-in to multi-agent orchestration. The session runs unattended overnight; the owner tries the live site in the morning and reviews nothing before then.

## The goal

Ship the first phase of `docs/review/report.md`: the seed-and-grow builder (prototype `b-grow`) becomes the app's builder for requested themed styles and for the three plain shapes at 60, 100, and 40 cards. Themed decks should play their theme, with real setup behind every payoff, and a request the pool cannot support should say why and offer the nearest thing instead of a pile of riders.

Not in this phase: best fit at 60 and 100 (today's stays), 20-card packets (today's builder stays), the Analyze pane beyond its style list, and the plan picker (Phase 2).

## Read first

- `docs/review/report.md`: "In short", "The surprising result", "Which version to build on", "What to build next" (Phase 1 and the owner decisions), "Known biases".
- `docs/review/proto-b.md` and `packages/pipeline/src/review/algos/b/`: the prototype, its known weaknesses, and its reviewer's notes.
- `docs/review/theme-rules.md`, `packages/pipeline/src/review/theme-rules.json` and `theme-rules.ts`: the rules, their format, and their calibration.
- `docs/review/themes.md` "How to count" and the Graveyard, Tokens, Counters, and Aristocrats sections.
- `docs/review/runner.md`, `requests.md`, `judging.md`, `rubric.md`, `checks.md`: the test tooling this phase reuses.
- `docs/review/log.md`: the biases found in the test design, so the new round avoids them.
- `CLAUDE.md`, `SPEC.md` "Builder" and "Decisions".

## Owner decisions, made 2026-11-11

- The theme rules become a new config file. Its format may read oracle text and type lines with regular expressions.
- A requested style the pool cannot support: show a note that says what the pool lacks, then build the nearest thing that can be built, labelled for what it is.
- Best fit means the best deck. No target mix of styles. Aggro and Midrange being common from bulk is fine. The other buildable styles stay in the list below the first option.
- Speed is not a goal in itself. A build must stay well short of minutes; slower than that means a bad algorithm.

## Approvals

These cover the "stop and ask" items in `CLAUDE.md` for this work.

- `packages/core`, `config/`, and the apps may change. A new config file `config/theme-rules.json` is approved, and the config version must include it so saved decks record what built them.
- Multi-agent orchestration: Opus agents for implementation, review, and judging; the Workflow tool for the judging fan-out; worktrees for agents that write code in parallel.
- No new dependencies. No data pack schema change. Never touch `LICENSE`, `ATTRIBUTION.md`, `gh release`, or the data refresh workflow.
- Commits with the global git email, never overridden; on a GH007 push error, stop and tell the owner. Every push deploys the web app, so push only green, usable states, and label any unfinished screen with what is coming.
- Judging budget: about 25 million tokens for the whole phase. One main judging round and one re-check at most. If the usage limit pauses a workflow, resume it; do not start it again.

## What to build

1. **The rules as config.** Move the theme rules to `config/theme-rules.json` with a loader in the core (no Node, no filesystem) and validation in `validateConfig`. Fix the two rule findings first: Sphinx's Tutelage counted as Graveyard setup, and opponent mill (Ruin Crab) entering a self-mill deck. Keep the pipeline's `theme-rules.ts` reading the same file so the review checks stay in step.
2. **B's bulk baseline** (each style's expected count per color class over the pack, 3.1 s to compute) ships as computed data built by the pipeline beside the learned files, never computed on the device.
3. **The builder.** Port `algos/b/` into the core as the builder for requested themed styles and for Aggro, Midrange, and Control by name, at 60, 100, and 40. Keep it deterministic: same pool, settings, config version, and data version give the same deck. Handle what the prototype skipped: a commander counts once, as the rules say; requests with a secondary style or a tribe keep today's builder unless B handles them cleanly, and the explanation records which builder ran; copy limits, Un-sets, rarity filters, and Commander legality as today.
4. **Note and nearest.** When a requested style misses the rules' floors, `buildDeck` returns the nearest buildable deck with a plain note: what the pool lacks in a sentence a player understands ("no repeatable way to fill the graveyard"), and what was built instead. Nearest means the closest viable style that uses the same resource, else best fit. The deck is named for what it is. Both apps show the note; the Build page's style list comes from the rules' viability.
5. **Tests and gates.** Unit tests for the loader, the count-once rule, the payoff gate, the nearest rule, and determinism. `npm run check` green at every commit. `npm run eval` run and its deltas recorded against the committed baseline; `npm run smoke` against the live site after the push.
6. **Docs.** `SPEC.md` ("Builder", "Decisions"), `config/README.md`, `docs/guides/archetypes.md` where the definitions changed, and `docs/todo.md`. Bump the version in its own commit when the change ships.

## The loop

One agent implements a step in a worktree. A fresh agent reviews the diff for bugs and for anything that only flatters the test. The coordinator runs the commands before trusting a number. Then the panel:

- **Pools.** New plain seeds (add a seed prefix flag to `review:pools`; the old `plain-01` to `plain-30` were development pools) and theme pools on bases no agent has built on. The owner's pools stay local.
- **Versions.** Today's core (`head`), the new core builder as a runner version, and the random piles as a floor.
- **Judging.** Blind packets as before, with one change the report asks for: the judge is told the requested style and also answers whether the deck is a decent deck of that style. Judges open only the prompt and their packet. Calibrate on random piles and real decks first.
- **Collate** with `review:collate` and compare on the same requests, with declines and note-and-nearest substitutions counted and shown.

## Ship rule

The new builder ships when, on the held-out pools and at each of 60, 100, and 40:

- its themed decks are judged decent more often than today's by more than the noise (about 20 points at 40 judged decks per cell);
- with note and nearest in place, its rate over all requests is not below today's;
- the judges name its themed decks as decent decks of their style more often than today's;
- the other viable styles still appear in the Build page's list.

The style mix is reported, not gated. Theme counts from the rules are never evidence that the new builder is better; the panel is. Build time is reported per size and only has to stay well short of minutes.

## Pitfalls

- Do not tune the builder to the judging pools, and do not look at the held-out pools while building.
- A card that is both setup and payoff counts once. A rider is not setup. A payoff never enters unfed.
- B's quality measure penalizes cheap creatures, so Aggro by name must still come out as an Aggro deck; check it.
- Keep the judges independent: they never see the builder's roles, styles, or strength.
- Do not change best fit at 60 and 100 or any 20-card build in this phase, even if it looks easy.
- Plain language in everything the app shows, no em-dashes. Keep the owner's summary short and lead with the answer.
