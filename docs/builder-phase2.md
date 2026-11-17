# Builder phases 2 to 4, the card fixes before them, and two display changes

One long session, nine steps, one at a time and in order. Written 2026-11-16 after the owner's review of a black 60-card deck on the live site.

## Status

Not started. The session that runs this brief keeps this section current: which step is done, what is running, what it found, and where each result lives. Add one entry per step with its commits, eval deltas, and panel result.

## How to start

Open a session in this repo and say:

> Read docs/builder-phase2.md and carry out the brief, one step at a time and in order. Use workflows and agents as it describes.

That sentence is the owner's opt-in to multi-agent orchestration. The session runs unattended. The owner tries the live site afterwards and reviews nothing before then, so never plan an owner deck review and never stop to ask a question this brief already answers.

## Why this work

The owner asked for the best 60-card black deck and got "Black Evasion 60" from the classic builder. Findings, all confirmed in the code and the data pack:

- **The default deck still comes from the classic builder.** `buildDeck` (`packages/core/src/builder.ts`) sends a request to the seed-and-grow builder (`grow.ts`) only when the player picks a style by name (`growBuilds`). Best fit, the Build page's option list with no style picked (`planOptions` in `options.ts`), the Analyze pane (`best-decks.ts`), 20-card packets, secondary styles, and tribes all use `buildClassic` with the matchers in `config/archetypes.json`. Phase 1 left it that way on purpose, because the grow builder's plan picker leaned to Control and never picked Aggro. The owner now wants the classic builder gone from every path the new one can serve.
- **Old matchers call anything with an anthem tag an Evasion payoff.** Lo and Li, Twin Tutors (lifelink for Nobles) and Crashing Drawbridge (haste) carry `keyword-anthem`, which `archetypes.json` counts as a payoff for the `flyers` style. The theme rules already exclude both.
- **Neither rule set has real Evasion payoffs.** An evasion deck is paid off by "deals combat damage to a player" triggers. The pack has a `saboteur` tag (Yathan Tombguard and Rapacious Guest carry it) and nothing reads it. The `flyers` rules in `config/theme-rules.json` list only flyer lords and anthems as payoffs and have no payoff floor.
- **Cards that need something else get full credit.** Roles come from tags with no check of the card's condition. Yathan Tombguard is "Card advantage" (`draw-engine`) though it needs creatures with counters. Dawnhand Eulogist is a "Big threat" (`isFinisher`: mana value 4, power 3, evasive) though its text needs an Elf in the graveyard. Tragedy Feaster sacrifices a permanent each turn without lifegain and only pays the small `drawback` penalty. The pack marks these needs (`typal-elf`, `typal-dragon`, `counters-matter`, `lifegain-matters`, `synergy-artifact`), but no builder asks whether the deck supplies them.
- **Tapped nonbasic lands replace Swamps in a mono-black deck.** `scoreNonbasic` in `lands.ts` gives +2.0 for making a deck color, -1.5 for entering tapped, +1.0 for a `utility-land` tag, and takes a land at 0.5 or more (`config/land-rules.json`). Uncharted Haven and Command Bridge score exactly 0.5; Dakmor Salvage scores 1.5; Great Arashin City always enters tapped in mono-black. Nothing compares the land with the basic it replaces. Both builders share this code, so the owner's named-style deck had the same seven bad lands.
- **Replace does not offer a basic land for a nonbasic.** `replacementOptions` in `replace.ts` skips basics (`f.basic`). Basics live in `deck.basics`, not in the card list.

## Read first

- `CLAUDE.md`, `SPEC.md` "Builder" and "Decisions", `docs/todo.md` "Builder follow-ups".
- `docs/builder-phase1.md`: the Status section (what shipped, the panel table) and "The loop", "Ship rule", and "Pitfalls", which this brief reuses.
- `docs/review/report.md`: "What the code explains", "What to build next" (phases 2 to 4), "Open bugs found along the way", "Known biases".
- `docs/review/runner.md`, `requests.md`, `judging.md`, `rubric.md`, `checks.md`: the panel tooling.
- `docs/review/theme-rules.md` and `docs/review/themes.md` "How to count".
- Code: `packages/core/src/grow.ts` (`chooseBestFit`, `meanQuality`, `rankPlains`, `growBuilds`, `buildGrowDeck`), `builder.ts` (`buildDeck`, `buildClassic`), `options.ts`, `best-decks.ts`, `lands.ts`, `replace.ts`, `scan.ts`, `theme-rules.ts`.

## Owner decisions

Earlier decisions still hold (`docs/builder-phase1.md`, "Owner decisions"): best fit means the best deck with no target style mix; the other buildable styles stay in the list; a style the pool cannot support gets a note and the nearest deck; speed only has to stay well short of minutes.

New, 2026-11-16:

- The classic builder should not stay in the project where the new builder can do the job. Each phase below moves a path over; step 7 removes what is left unused.
- In a one-color deck, a nonbasic land must be better than the basic it replaces.
- A basic land is a valid replacement for a nonbasic land.
- A card that needs a tribe, lifegain, counters, or artifacts to do its job gets credit for that job only in a deck that supplies it.
- Learned plan data (default chosen for this unattended run): retire it for every path the grow builder serves. Do not relearn it. Keep the files while any classic path still reads them.

## Approvals

These cover the "stop and ask" items in `CLAUDE.md` for this work.

- `packages/core`, `config/`, `packages/ui`, and both apps may change.
- Config format additions, each included in the config version and documented in `config/README.md`: new keys in `config/land-rules.json` for step 1; a way to state card needs for step 2 (new keys in `config/theme-rules.json` or a new file `config/card-needs.json`, whichever is cleaner); new Evasion payoff jobs and floors in `theme-rules.json`; picker constants in `config/builder-weights.json`; tribes and 20-card floors in `theme-rules.json` for step 5. Removing config that nothing reads any more is approved in step 7 only.
- Multi-agent orchestration: agents for implementation and review, the Workflow tool for judging fan-out, worktrees under `.claude/worktrees` for agents that write code in parallel (junction the data folders in, detach them before removal).
- Judging budget: about 15 million tokens each for step 3 and step 5, one main round and one re-check at most per step. No panel for the other steps. If a usage limit pauses a workflow, resume it; do not start it again.
- No new dependencies. No data pack schema change. Never touch `LICENSE`, `ATTRIBUTION.md`, `gh release`, or the data refresh workflow.
- Commits with the global git email, never overridden; on a GH007 push error, stop and tell the owner.

## How every step runs

1. One agent implements the step. A fresh agent reviews the diff for bugs and for anything that only flatters a test. The coordinator runs the commands itself before trusting a number.
2. `npm run check` green. After any builder or config change, `npm run eval` and compare per-size deltas with the baseline in `eval/results/`; commit the new baseline with the change and record the deltas in Status.
3. Browser check: build the web app, run `npm run smoke` locally (default, plus the variants in `CLAUDE.md` that the step touches).
4. Commit. Bump the version in its own commit (a shipped change bumps the minor; root, web, mobile, and ui share it).
5. Push, wait for the Pages deploy, and run `npm run smoke -- https://xbadc0ffe.github.io/bulk-brew/`. The owner only tests the live site, so a step is not done until the live smoke passes.
6. Update `SPEC.md` (Builder, Decisions, Milestones), `config/README.md`, `docs/guides/` where a definition changed, `docs/todo.md` (remove finished items, add what the step left open), and this file's Status.

Push only green, usable states. If a step is blocked or fails its ship rule, do not ship it: leave the app on the last good state, write what happened in Status and `docs/todo.md`, and go on to the next step that does not depend on it. Steps 8 and 9 depend on nothing else.

The owner's own lists in `test-bulk/` stay local. The session may build from them to check a fix (`npm run demo:build -- test-bulk/b.txt B 60 flyers`), but never commits them or their decks. Note that `b.txt` alone has no nonbasic lands; the owner's pool also holds `test-bulk/l.txt`.

## Step 1: lands that are worse than a basic, and basics in Replace

**Goal.** A mono-color deck never plays a land that is worse than its basic. A player can swap a nonbasic land for a basic.

**Build.**

- In `lands.ts`, score a nonbasic against the basic it would replace. In a one-color deck, making the deck's color is worth nothing over a basic, "any color" is worth nothing, and entering tapped is a pure cost, so a land gets in only on an ability worth more than its costs. Put the numbers in `config/land-rules.json` (for example a mono-color section beside `colors`), not in code. Multi-color scoring keeps its present behavior unless a case below shows a bug.
- "Enters tapped unless you control X" must be read against the deck: Great Arashin City (Forest or Plains) is always tapped in mono-black; Realm of Koh (a basic land) is almost never tapped. Check how `entersTapped` is set for such lands in the pack and handle the conditional ones from their text. This is the open question in `docs/todo.md` about conditional tapped lands; do not change the pack schema.
- A `utility-land` tag alone is not enough. Dakmor Salvage (dredge) helps only a Graveyard plan; Eumidian Hatchery costs 1 life per tap for a small upside. Give utility credit only when the ability does something for this deck, or when the land costs nothing against a basic.
- Paliano, the High City (report, "Open bugs") must not enter a mana base.
- In `replace.ts`, when the card being replaced is a nonbasic land, offer the basic of each deck color the land could make (for a mono-color deck, the one basic). Taking it raises `deck.basics` and follows the same source-count bookkeeping as `followSwap`. Respect the pool's basics tracking setting if basics are counted. Show it in the web Replace list like any other option.

**Must hold** (unit tests with pack cards, and a build from `test-bulk/b.txt` plus `test-bulk/l.txt`):

- Mono-black 60: no Uncharted Haven, Command Bridge, Dakmor Salvage (outside a Graveyard plan), or Great Arashin City. Realm of Koh may stay.
- A two-color deck still takes its dual and rainbow lands as before; eval multi-color pools do not lose fixing.
- Replacing a nonbasic land lists a basic; accepting it keeps the deck at its size and the land count unchanged.

**Ship.** Eval deltas explained (nonbasic counts will drop in mono-color decks; nothing else should move much). No panel.

## Step 2: card needs, and real Evasion payoffs

**Goal.** A card whose job depends on something the deck lacks does not get credit for that job, and a card that punishes the deck without support stays out. Evasion decks get payoffs that reward connecting.

**Build: card needs.**

- Define a small set of needs as config. Each need has: how to recognize a dependent card (tags plus oracle text, as the theme rules do), what in a deck supplies it, how much supply is enough per deck size, and what the card loses when the need is unmet. Start with these, since the pack already tags them: a creature type (`typal-<type>` with text that conditions on the type), lifegain (`lifegain-matters`, "if you gained life", "unless you gained life"), counters on your creatures (`counters-matter`, "with a counter on it"), artifacts (`synergy-artifact`, `artifact-count-matters`), cards in a graveyard by type. Reuse the theme rules' setup jobs as the supply definitions where they exist (Lifegain setup feeds a lifegain need) so there is one definition of "lifegain source".
- Separate the dependent part from the rest of the card. A body with flying stays an evasive attacker whatever its rider needs. What an unmet need removes is the role or theme job that the conditional text earns, plus a strength penalty; a card whose unmet condition actively hurts (Tragedy Feaster) is excluded outright.
- Apply it in the grow builder as a gate beside the payoff gate (`gateOpen`, `fed`): a card with an unmet need cannot fill a role slot or a theme slot on that credit, and cannot enter as filler on strength the condition supplies. Check the finished deck once more and swap out anything left unsupported. Apply the same credit rule in the role and reason labels, so the deck view never says "Card advantage" for a card that cannot draw in this deck. Where the classic builder still runs, apply the gate there too if it is a small change; otherwise it leaves with the classic paths in steps 3 to 7.
- Do not invent card facts. Every example and test reads the card's text and tags from the pack.

**Must hold** (in a mono-black 60 with no Elves, Dragons, Nobles, Lessons, counters theme, or lifegain plan):

| Card                                    | Expected                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Lo and Li, Twin Tutors                  | no role, no theme job; not picked                                      |
| Crashing Drawbridge                     | not an Evasion payoff (a role elsewhere is fine)                       |
| Yathan Tombguard                        | an evasive attacker, not Card advantage                                |
| Dawnhand Eulogist                       | a 3/3 menace body only; not a Big threat on its conditional text       |
| Tragedy Feaster                         | not picked without enough lifegain supply                              |
| Starlit Soothsayer                      | stays an evasive attacker (its rider also triggers on life loss)       |
| Shilgengar, Sire of Famine              | stays an evasive threat (a 6/6 flyer; the Angel text is a bonus)       |
| Caustic Exhale                          | stays removal, costed as two mana without a Dragon                     |
| Foggy Swamp Visions, Scavenger's Talent | not picked for Evasion; they belong to Graveyard and Aristocrats plans |

And the reverse: in a deck that does supply the need (the Elf pool `eval/pools/elf-tribe.txt`, a lifegain build), the same kind of card keeps its credit.

**Build: Evasion payoffs.**

- Add payoff jobs to `flyers` in `theme-rules.json`: a team trigger ("whenever one or more creatures you control deal combat damage to a player", weight 2), and a self trigger on an evasive creature ("whenever this creature deals combat damage to a player", weight 1). A card that is both setup and payoff counts once, as the rules already require.
- Measure before adding a payoff floor: run `npm run theme:bulk` and check how many pools keep Evasion viable. Add a modest floor only if Evasion stays buildable about as often as today; otherwise leave the floor out and let the payoffs be pulled in above the floors. Record the choice and the counts.
- Rerun `npm run theme:bulk` after the rules edit and commit the new `config/theme-bulk.json`.

**Ship.** Check and eval green, the table above passing as tests, the guide examples in `docs/review/themes.md` unchanged except where a need explains the change. No panel; step 3's panel judges the result.

## Step 3: phase 2, one plan picker

**Goal.** One ranking picks best fit, the Build page's first option, and the Analyze pane's decks, at 60, 100, and 40, and the grow builder builds every one of them. After this step the default deck a player sees never comes from the classic builder at those sizes.

**Build.**

- Start from `chooseBestFit` in `grow.ts`, which already scores every plan (margin, richness over plain bulk, mean quality) and is not wired in.
- Fix the quality measure (`meanQuality`) so the many cheap creatures an Aggro deck needs are not penalized. Aggro never winning on plain pools is a scoring artifact and a blocker. Report the style mix on the eval and development pools before and after; the mix is reported, not gated.
- A theme must beat the best plain shape by a clear margin, set in `builder-weights.json`, not by richness noise (richness near 1.15 on plain bulk is sampling noise).
- More than floors: the phase 1 panel found a deck that meets the rules' floors is a decent deck of its style only 40% to 60% of the time, failing on dead cards and thin payoffs. Let the picker's score see the finished deck: unmet needs from step 2 (should be zero), payoff depth against setup, setup beyond the bare floor, removal and creature counts against the shape's template. A known case to fix here: grow's Control plays far fewer creatures than a real control deck (10 against 18 at black 60).
- Routing: `buildDeck` with no style goes to the grow builder at 60, 100, and 40 and builds the picker's first plan. `planOptions` and `best-decks.ts` plan from the rules' viability (`scan.rules`) and rank built decks with the same score, so the first option is the best fit and the other viable styles follow in rank order. One score, one place.
- What may stay classic after this step, each recorded in the explanation and in Status: 20-card packets (step 5), tribes (step 5), and requests with a secondary style. Try secondary styles in the grow builder (the secondary as a second, smaller set of floors); if that is not clean, leave it and say so.
- Fix the Analyze bug in `docs/todo.md`: a Commander deck opened from Analyze must not land on an empty options screen.
- Keep the build deterministic and keep the options search well short of minutes; report build times per size.

**Judge.** A blind panel as in `docs/builder-phase1.md` "The loop": new held-out pools (a new seed prefix; never tune on them or look at them while building), today's shipped version as a runner version from a worktree, random piles as the floor, calibration first. At 60, 100, and 40: at least 40 judged first options per version and size on the same requests.

**Ship rule.** At each size the new first option is judged decent at least as often as the shipped core best fit, within the noise (about 20 points at 40 decks), and clearly not below the shipped web first option; the other viable styles are still in the list; no style is shut out by a scoring artifact (Aggro must be picked for pools that are plainly aggressive). If a size fails, keep that size on its present path and ship the sizes that pass.

## Step 4: phase 3, matcher cleanup

**Goal.** One set of definitions. Everything the player sees agrees with what the builder counted.

**Build.**

- Find every reader of the `archetypes.json` enabler and payoff matchers: the scan's old viability, `styleCounts` behind the option cards' theme bars, the Analyze pane's counts, the deck view's reason labels, the display tags' `styles`, the deck score's theme features, the hand synergy rules, and the learned plan priors and targets. For each, move it to the theme rules or delete it with its last caller.
- The app's style list, counts, bars, and "why" labels come from the rules: setup and payoff jobs with the rule's job text ("evasive attacker, power 2 or more"), in plain language.
- Fix the rule findings listed in `docs/todo.md` and the report (surveil 1 on removal as graveyard setup, `counters-matter` on charge and energy counters, Sphinx's Tutelage, Soulcipher Board's label, the nine Auras that enchant a player counted for Voltron) where the rules still have them.
- Retire the learned plan data for grow paths (owner decision above). Leave `npm run learn:build` working for whatever still reads its output.
- `rules.viable` on the scan should also say whether the size can be built at all, and pass the commander to `growViability`, so the apps stop combining fields by hand.

**Ship rule.** On the eval pools and the step 3 panel pools, the scan, the Analyze pane, the option cards, and the builder agree on which styles are viable and on each deck's setup and payoff counts (a test that fails on any disagreement). Any change that moves best fit is checked against step 3's panel decks: rebuild them and confirm the picks are unchanged or explain each change. No new panel.

## Step 5: phase 4, 20-card halves and Commander

**Goal.** The grow builder serves 20-card packets and every Commander request, tribes included.

**Build: 20 cards.**

- Keep cards a half cannot cast out of an 8-land half (a ten-mana card was dead in half of the prototype's 20-card builds).
- Floors of their own at 20 in `theme-rules.json`, so a theme works from its own dozen spells and the rest of the half still plays when the theme does not show (the rubric's bar for halves).
- Packet pairing keeps working as today.

**Build: Commander.**

- A commander that does a job counts once (`grow.commanderCredit`), and the scan and builder agree on it.
- Tribes in the rules: a tribe is a theme whose setup is creatures of the type and whose payoffs are that type's lords and typal payoffs, generated per type rather than hand-written. Multi-word types ("Time Lord") must not split. A tribe the commander names leads its options as today.
- The per-color source rule (`colorWants` in `colors.ts`) is far stricter than real decks (median shortfall 3 sources at 60 and 40, 11 for multi-color Commander precons). Recalibrate it against the reference corpus with `npm run corpus:eval` train and test splits, not by eye.
- The commander pull should follow how central a style is to the commander's own text, not how rare the payoffs are in the pool (`docs/todo.md`, Toby and Danitha).

**Judge and ship rule.** Step 3's panel method and ship rule at 20 and 100, including tribe requests at 100 (run the Elf smoke check in `CLAUDE.md` too). A size or request kind that fails stays on its present path.

## Step 6: a second attempt at anything left behind

If steps 3 to 5 left a size or request kind on the classic builder because it failed a ship rule, make one more attempt here with what the panels showed, under the same ship rule and within what is left of the judging budget. Otherwise go straight on.

## Step 7: retire the classic builder

**Goal.** No dead builder in the project.

- List every request that still reaches `buildClassic`. If none does, delete it and everything only it used: the swap search, the old plan choice, the matchers in `archetypes.json` that nothing reads (keep the style ids, labels, and descriptions that saved decks and the app use), the learned plan files and their build steps if nothing reads them, and the tests and docs that describe them. Saved decks must still open; config versions recorded on old decks must still display.
- If something still needs it, do not delete it. Write in Status and `docs/todo.md` exactly which requests remain and why, and make sure the deck's explanation names the builder that ran.
- `npm run eval`, `npm run corpus:eval` if any measured path changed, and the full smoke set on the live site.

## Step 8: bigger group headings on the deck screen

The headings above each card group (CREATURES, INSTANTS, and so on) and their counts are too small. Desktop uses `ui.sectionLabel` in `packages/ui/src/styles.ts` (11px); the phone list in `packages/ui/src/components/DeckParts.tsx` uses 0.6875rem. Raise both by about two steps (around 13px) with the count at the same size. `ui.sectionLabel` is shared, so check where else it is used and either accept the larger size there or give the deck groups their own style. Check the desktop and `SMOKE_WIDTH=420` layouts for wrapping. Ship on its own.

## Step 9: a text size setting

A text size control on the Settings page that scales the whole app's text.

- Store it in `Appearance` (`packages/ui/src/data/useAppearance.ts`, key `bulk-brew.appearance`), default 100%, with a few steps (for example 90%, 100%, 110%, 125%, 140%). Older stored values without the field read as 100%.
- Most text sizes are fixed pixel classes (`text-[13px]`, about 230 uses), so changing the root font size alone does nothing today. Recommended: convert the pixel text classes to rem mechanically (13px becomes 0.8125rem), then set the root font size from the setting. Tailwind spacing is already rem, so padding grows with the text and layouts stay in proportion. Card images are never distorted: they may grow or stay, but keep their aspect ratio.
- Check every screen at the smallest and largest step, wide and at 420 pixels, for clipped text and broken rows; fix what breaks.
- Web Settings first. Add the same control to the mobile Settings screen if it is a small change; otherwise add a mobile parity line to `docs/todo.md`.
- Plain label, such as "Text size". No em-dashes.

## Pitfalls

- Do not tune the builder to the judging pools, and do not look at held-out pools while building. Theme counts from the rules are never evidence that a builder is better; the panel is.
- Judges never see the builder's roles, styles, or strength. They are told the requested style and answer whether the deck is a decent deck of that style.
- A card that is both setup and payoff counts once. A rider is not setup. A payoff never enters unfed. A need that is unmet earns nothing.
- A style skew caused by a scoring artifact is a regression. A skew that reflects what the bulk builds best is fine.
- Card facts come from the pack and `docs/rules/`, never from memory.
- Every push deploys. Never push a state where a screen is half moved between builders without a label saying what is coming.
- Keep the final summary short: lead with what shipped and what did not, then one line per step.
