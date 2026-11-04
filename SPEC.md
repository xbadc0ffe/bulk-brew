# Bulk Brew: Project Spec

Source of truth for scope, data, and architecture. Describes what exists and what is decided, not how it came to be. Update it when a decision changes.

## Purpose

Turn a large pool of bulk Magic: The Gathering cards into playable casual decks. The user imports a card list into a pool, picks a deck size, colors, and optional styles (or a commander for 100 cards), and the app builds several deck options from what is available, ranked by strength and fit. Accepting a deck saves it and takes its cards out of the pool, so the next build uses what is left. The app calls the pool the Bulk List.

Bulk Brew presents itself as a bulk builder: it makes good decks from what a pile holds. Real decks deserve a person's care; the app does not try to replace that.

The app is self-sufficient: no language model calls at runtime, no developer server, no user data sent anywhere. All judgment lives in data (card facts, tags, config) and a deterministic builder.

Targets: a static client-side web app and an iOS app, built together on one core. Free, open source (MIT).

## Principles

- **Deterministic.** Same pool, settings, config version, and data version give the same deck.
- **Logic as code, judgment as data.** Templates, archetypes, synergy rules, land rules, and weights live in versioned config files so they can be tuned without code changes and shipped to iOS without an App Store release.
- **One core, two shells.** Parser, name resolution, pool, archetype scan, builder, and export live in a platform-free core. The web app and the mobile app are separate interfaces with different layouts on the same core.
- **Deckbuilding is not "lands plus spells".** A deck is a curve, a type mix, role coverage, synergy, and a mana base sized to the spells it holds.
- **Explainable.** Every card in a built deck records why it is there.

## Product

### Deck sizes

| Size | Style               | Notes                                                                                                                                                            |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100  | Commander           | One commander plus 99, singleton (basics exempt). Colors come from the commander. Phase 13.                                                                      |
| 60   | Constructed, casual | Max 4 copies of a card by default.                                                                                                                               |
| 40   | Limited-style       | Max 4 copies by default.                                                                                                                                         |
| 20   | Jumpstart style     | Shown as "20" with a note when selected. Includes its lands. Max 2 copies by default. Any two packets of different colors shuffle into a two-color 40-card deck. |

### Colors

Decks use one to five colors. Mono-color stays the builder's strongest mode; every added color makes a deck harder to build well, and the app says so rather than refusing.

- **60, 40, 20**: a card is a candidate when every mana symbol in its costs and rules text can be paid by the deck's colors (hybrid symbols when either half fits), so hybrid cards work in mono decks. Colorless cards are always eligible. Phase 10.
- **100**: candidates are cards whose color identity fits inside the commander's, as the format requires.
- Multi-color decks have a main color (may hold double pips), secondary colors (single pips), and optionally a light splash (a few single-pip cards costing three or more). Colored source counts per color come from a probability target in config: the chance to cast each spell on curve given the land drops were made.
- Two-color play also comes from pairing two 20-card packets; pairing stays as a mode.

### Pool flow

1. **Import** decklist text or a collection CSV (ManaBox, Moxfield, Deckbox, or any CSV with name and quantity columns), pasted or from a file. Import is a subpage of the Bulk List. The text is checked live as it is typed: matched cards and colors, and each unmatched line, which can be renamed, swapped for a suggestion, or skipped. Import adds the matched cards to the pool; lines that did not match stay in the box.
2. **Pool** is the single active set of available cards, keyed by oracle id with quantities. It persists on the device between sessions and can be exported as a backup file and restored.
3. **Build** from the pool. The Build page shows deck options ranked by strength (see Build options); opening one shows the full decklist with an explanation.
4. **Accept** (after a confirmation) saves the deck and takes its cards out of the pool (the `committed` flag). **Reject** drops the result and returns to the form with every choice kept. **Export** copies or downloads the list. A result survives moving between screens until it is accepted or rejected.
5. **Build again** from what is left, until the pool runs out of a color.
6. **Clear pool** and **delete deck** are one action each with a confirmation. **Disassemble** returns a deck's cards to the pool and deletes it; delete without returning is in the deck's menu. Accepting is refused, with a count, when the pool no longer holds all of the deck's cards.
7. **Pair** two 20-card packets of different colors from a packet's view: a what-if preview of the combined 40-card deck, and **Merge**, which replaces both packets with one deck (packets still in the pool are taken out of it first).

Basic lands are unlimited by default and need not be imported; imported basics are kept as pasted. The Unlimited basic lands switch lives on the Build form. Nonbasic lands are always tracked.

The Bulk List filters by color, type, subtype, mana value (a comparison and a value), short tags, and subtags, sorts by any column, can select several cards to remove at once, and can open the pool analysis under the list. Short tags ("Removal", "Draw", "+1/+1") come from `config/display-tags.json`; subtags are the config's role and style labels; the card detail also lists the raw Scryfall tags.

### Settings

Defaults live in `config/settings.defaults.json`.

- Max copies per card, per deck size (60: 4, 40: 4, 20: 2), set on the Build form under the deck size. 100 is always singleton.
- Unlimited basics (on), set on the Build form.
- Rarities the builder may use (all four by default), set on the Build form. Basic lands and cards with no known rarity are never filtered out.
- Include Un-set and acorn cards (off).
- Show card art (off on first launch, remembered).
- Appearance: light, dark, or system, and a theme color (grey or one of the five colors). This is a device preference kept in `localStorage` so it applies before first paint; it is not part of `Settings` and not in backups.

### Platforms

- **Web app**: desktop-first, fully static, hosted on GitHub Pages. Works offline after first load.
- **Mobile app**: phone and tablet layouts, developed in a browser, shipped to iOS through Capacitor. Bundles the data pack and config, and can update both over the air.

## Data

### Sources

Scryfall bulk data, downloaded by `scripts/fetch-scryfall-bulk.mjs` into the gitignored `data/raw/`:

- `oracle_cards`: one entry per unique card (oracle id), with the default printing's image id.
- `oracle_tags`: Scryfall Tagger function and synergy tags. About 4,600 tags, 240,000 taggings, 36,000 tagged cards. Tags form a tree through `parent_ids`. Tagging weights are flat in practice (99.7% are "median"), so tags are treated as boolean and any weighting comes from config.
- `rulings`: development reference only. Never bundled. If a card detail view ever shows rulings, they load from Scryfall on demand.

- `default_cards`: one entry per printing, read only to find each card's lowest rarity across its paper printings. Nothing per printing is shipped.

Not used: all cards, unique artwork, art tags. Imports resolve by name against oracle cards.

A local tag overlay in `config/tag-overlay.json` fixes and gap-fills tags at pipeline time.

### Card identity

Everything is keyed on `oracle_id`. Printings, sets, collector numbers, finishes, and languages are ignored for card facts and building. A set code and collector number from an import line are kept only as an art hint on the pool entry.

Name resolution handles full multi-face names ("A // B"), front-face-only names, case, accents, and punctuation. Where one name maps to several oracle ids, the non-Un-set card wins.

### Data pack

The shipped database is one compact JSON file, gzip-compressed by the host. Shape: `DataPack` in `packages/core/src/types.ts`. Per card: oracle id, name, layout, mana cost, mana value, type line, oracle text, colors, color identity, keywords, power, toughness, loyalty, produced mana, normalized types, derived `entersTapped` and `unset` flags, tags, faces, and the default printing's image id. The 2026-11-02 pack holds 34,168 cards: 23 MB raw, 5.4 MB compressed.

Schema 2 (phase 9) adds Commander legality (banned or not legal), the Game Changer flag, Scryfall's popularity rank (one signal in the card strength score), and rarity. Rarity is the lowest rarity among the card's paper printings, the way rarity-based formats count it (special and bonus stored as rare); when the printings file is missing, the default printing's rarity stands in. The core reads schema 1 and 2 during the move, treating the new fields as absent in schema 1. Decks record `CardIndex.dataVersion`, the pack date plus the schema from 2 on, so packs of different schemas never share a data version.

The pack is served under one fixed name, `data/cards.json`, and the service worker answers from its cache first. So every release of the core must read the previous schema as well as the current one: a returning user may load the old cached pack once before the new one arrives.

JSON was chosen over SQLite because the data is small, loads with one fetch, needs no WebAssembly on the web, and decodes natively in Swift if the iOS app ever goes native.

### Filters and edge cases

- Exclude non-playable layouts (tokens, emblems, art series, planes, schemes, vanguards, and similar), oversized cards, and Alchemy digital-only designs. The oracle file lists one printing per card and sometimes picks a digital printing of a real paper card, so a printing's paper flag is not used as a filter.
- Un-set and acorn cards stay in the pack flagged `unset` and are excluded by default.
- Multi-face cards: a modal double-faced card with a land face counts as both a land and a spell; split and adventure cards carry multiple costs; transforming cards use the front face for cost and color.
- X spells, hybrid, and Phyrexian mana are handled in mana value and castability logic.

### Pipeline

`npm run data:build` runs `packages/pipeline` under Node 24:

1. Read the raw bulk files.
2. Filter, trim, normalize, derive fields.
3. Join Tagger tags and the local overlay.
4. Write `data/packs/cards.json`, its gzip (the release asset, named with the schema, such as `cards.v2.json.gz`), and `data/packs/manifest.json` (version, URL, checksum, size, card count), and copy the pack into each app's `public/data/` for local development.

Tests cover the edge cases above with fixture cards.

### Publishing and updates

- Raw bulk files and built packs are never committed. The repo pins `data/manifest.json`.
- A weekly GitHub Actions workflow fetches the bulk files, rebuilds the pack, and when the data date changed, publishes the pack as a release asset tagged `data-YYYY-MM-DD`, commits the manifest bump to main, and triggers the web deploy.
- The web deploy downloads the pinned pack with `npm run data:pull`, verifies its checksum, and serves it from the site's own origin as `data/cards.json`, compressed in transit by the host. The browser caches it; a new deploy brings the new pack.
- The iOS app bundles the pack and config at build time and offers "check for card updates", which downloads a newer pack and config from GitHub. Apple permits data updates; code changes still need an App Store release. No user data is sent.

## Images

- One default image per card, the printing Scryfall's oracle file chose. The pack stores the printing id; `imageUrl()` builds the URL.
- Images load on demand from Scryfall's image host, directly from the user's device, and are cached there. Only cards in the pool and in decks are ever loaded, and nothing is requested while the art setting is off.
- When an import line carried a set code (and collector number), the pool entry keeps it and the card detail shows that printing, falling back to the default image and then to text. List thumbnails use the default image. Set codes affect nothing else.
- Card art is off by default. Everything works as text without images.
- Images are never cropped, distorted, recolored, or watermarked.
- A "download images for my pool" action for full offline use is a later version.

## Config

Versioned data files in `config/`, typed and validated by `packages/core/src/config.ts`. See `config/README.md` for the file list. In short: deck templates per size (land formula constants, default curve profile, type mix, role quotas, tolerances), curve profiles, role definitions as matchers over Tagger tags, keywords, types, and derived facts, synergy and composition archetypes, synergy rules, land rules, builder weights, settings defaults, and the tag overlay. Initial values come from the guides in `docs/guides/`, which the user reviews. `npm run config:check` validates the bundle against the data pack.

## Archetype scan

Scan the pool and report, per color set and per deck size, which archetypes are viable, with enabler and payoff counts (synergy archetypes) or role and curve counts (composition archetypes), plus how close near-misses are. The builder uses the scan as its seed step and the Build screen shows it to guide the style choice.

A deck is possible when the pool has enough spells for the slots and at least half of those slots can be cards of the deck colors (`MIN_COLORED_SHARE`); colorless cards fit every color but cannot make a color's deck on their own. A multi-color deck also needs `minCardsPerColor` spells of each of its colors. Cards with a {C} pip are excluded, since basics cannot pay for them. Every theme card counts toward viability; only theme cards at or above the card strength bar (`themeMinStrength`) count toward the margin, so a theme made of weak cards ranks low without being ruled out. The Build screen shows colored counts on the color buttons and the reason a color is unavailable.

## Builder

### Inputs

Pool, deck size, colors, optional primary and secondary style, commander (100 only), settings, config version, data version.

### Steps

1. **Candidates**: pool cards that fit the colors (see Colors), honoring the Un-set setting and copy limits, and excluding cards with a {C} pip. Guidelines from `docs/guides/` (2 copies of legendary and six-plus cards, type caps, the theme strength bar) shape the passes but bend in the last filler passes when the pool runs out of other cards. Magic rules and the user's settings (copy limit, colors, rarities) never bend.
2. **Archetype**: the preferred style if viable. Best fit builds every viable style and keeps the one whose finished deck scores highest; the scan margin alone measures how deep a theme is, not how strong its deck is.
3. **Reserve lands**: start from the template's base land count so the spell count is known.
4. **Fill spells** in passes with per-type caps so no category floods the deck: role minimums, theme enablers and payoffs to their minimums, each color's minimum (multi-color), role targets, type mix minimums, curve fill toward the profile, then filler. Multi-color decks first pick a main color and mark weak colors as splashes; spells that ask a lot of a secondary or splash color lose strength points while picking (see `docs/guides/mana-base.md`). The last filler pass ignores type caps so a creature-only pool still fills the deck.
5. **Size the mana base** from the spells actually chosen: a base count per size, raised by average mana value, lowered per cheap mana source, clamped to a range. Credits per source kind and cost are in the template; dorks earn slightly less than rocks because they die to removal, and dorks still count as creatures in the curve. If the land count moved, trim the least important picks or re-fill, until the count is stable.
6. **Improve** with bounded local search: swap a chosen card for an unchosen candidate when the objective improves, then re-fit the land count again.
7. **Nonbasics and basics** per land rules. Multi-color decks size each color's sources from what its spells need to cast on curve and split the basics to match.
8. **Validate**: exact size, copy limits, color identity, land count inside the clamp.

Constants live in `config/deck-templates.json` and are explained in `docs/guides/deck-shapes.md`.

### Objective

Template fit (curve deviation, type mix, role quotas, with minimums weighing more than targets) plus synergy density, scaled by the chosen archetype's synergy weight. Candidate ordering first prefers cards that fill a curve bucket still below target, then follows the tiebreak list in `builder-weights.json`, then card id.

Phase 9 adds a **card strength score** and a **deck score**. Card strength is computed from card data with weights in config: an effect on a body beats a vanilla body, broad and instant-speed removal beats narrow removal, fewer colored pips is better, value on entering or dying and protection keywords count, buff-only auras and equipment count little outside their theme, and Scryfall's popularity rank adds a signal. It joins the objective and replaces stats per mana as the main tiebreak. The deck score is led by synergy density (0.6), with card strength, role coverage, curve fit, type mix, and (multi-color) castability as minor tiebreaks, because those cannot see how well cards work together. It ranks archetypes for best fit and options on the Build page.

### Output

A deck with cards grouped by type, basics by color, and a `BuildExplanation`: archetype, curve, role counts against targets, land reasoning, key synergies, notes. Each card also carries provenance (which role or synergy slot it filled, or filler), shown as "why this card" in the deck view and used for debugging.

### Modes

- **Best cards**: each build takes the best available cards from the current pool.
- **Batch balanced** (later): several decks from one pool, holding back the stronger deck until deck-level scores are within tolerance.

## Build options (phase 11)

The Build page has settings on the left and deck options on the right.

- **Settings**: deck size (100, 60, 40, 20); under it max copies per card, rarities (a drop-down with a checkbox for common, uncommon, rare, and mythic, all on by default), and unlimited basics; then colors (one or more), primary style, and secondary style. Both styles are drop-downs that default to best fit and show viable and near-miss labels as the Style choice does today. The secondary style unlocks once a primary style is picked and lists only styles that can be supported alongside it.
- **Options**: larger cards on the right, one per deck option, with the deck's colors, styles, a strength rating, and a short summary (curve, creature and spell counts, mana notes). Ranked by deck score plus a bonus for using every picked color (and, from phase 12, for meeting the secondary style), so a much stronger option that drops a color can still lead (`buildOptions` in builder-weights.json).
- **Fit**: options stay inside the request but need not use all of it. Every option uses only picked colors (any non-empty subset). A picked primary style is required: every option honors it, and when no deck can, the right side says that no decks meet the settings and offers a Clear settings button (inline, not a popup). The secondary style is best effort, and an option that could not meet it is marked as such. An option that uses everything picked ranks above an equally strong one that drops something. Styles and colors that were not picked never appear.
- **Generation**: options are ideas, each built from the full pool, so one option's cards stay available to the next. They build one at a time, one per browser tick so the page stays responsive, and appear as they finish, re-sorted by rank, with a progress indicator while work remains. Builds take turns across the color subsets, so smaller color sets get built too. The count is capped in config, an option that shares most of its cards with a stronger one is dropped, and without a picked primary style at most two options share a style. Opening an option or leaving the Build screen pauses the work; returning resumes it. Settings and finished options survive moving between screens.
- **Commander (100)**: singleton is forced. The right side first lists commander candidates from the pool by tier. Picking one shows it at the top of the right side with a clear button beside it, and options build under it; clearing returns to the commander list.

## Commander (phase 13)

- **Legality**: the commander must be allowed by the format (legendary creature or text that says it can be your commander; partner and background pairs later) and not banned. Every card fits inside the commander's color identity. Singleton except basics and cards whose text allows any number.
- **Candidates and tiers**: ranked by how many pool cards fit its identity, whether its own text matches a style the pool supports, its mana value, its colors against the fixing in the pool, and tribal fit when it names a creature type. Game Changers are allowed; bulk rarely holds many.
- **Template**: about 37 lands, 10 ramp, 10 card draw (cantrips do not count), 8 to 9 targeted removal with some that hit artifacts and enchantments, 3 sweepers, and the rest for the theme; lands plus ramp at least 45; ramp should cost less than the commander. The commander counts toward the roles it fills, and the deck must still work without it. Numbers live in `deck-templates.json`.

## Jumpstart packets

A 20-card packet includes its lands (about 8) and is built so that any two packets of different colors shuffle into a playable 40-card deck: a lower curve, a self-contained theme, no cards that need the other color. Packets always use the template's `jumpstart` curve profile, whatever the archetype. The Decks screen pairs two saved packets and exports the combined list.

## Evaluation

- Fixed test pools in `eval/pools/`, each exercising something specific.
- A written rubric in `eval/rubric.md`: curve, type mix, role coverage, synergy, mana base, playability.
- `npm run eval` builds every pool at every size and color the scan allows, scores the decks with automatic metrics (size and copy invariants, land count against the formula clamp, curve deviation, type mix, role coverage, synergy density, filler, castability, build time), writes `eval/results/<date>-<sha>.json`, prints a summary per pool and per size, and shows per-size deltas against the previous full run. It exits 1 on any build failure or broken invariant. `npm run eval:pools` regenerates the synthetic pools from a fixed seed. An on-demand GitHub Actions workflow runs the same suite.
- Committed baselines in `eval/results/` are full best-fit runs: `2026-11-03-fe5b028.json` (schema 1 pack, margin-based best fit) and `2026-11-04-74cbcae.json` (schema 2 pack, card strength and best fit by building). Compare new runs with the latest.
- Claude reviews decks against the rubric as a development aid, not as ground truth. The user calibrates on a sample.

## Architecture

npm workspaces monorepo, TypeScript throughout.

| Package               | Role                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@bulk-brew/core`     | Types, decklist parser, name resolution, pool, scan, builder, export. Pure, unit-tested, no DOM or Node APIs.               |
| `@bulk-brew/ui`       | Shared React pieces and hooks: storage, pack and config loading, pool, decks, settings, build flow, card detail, deck view. |
| `@bulk-brew/pipeline` | Developer-side data pipeline.                                                                                               |
| `@bulk-brew/web`      | Desktop-first React app. Static build deployed to GitHub Pages.                                                             |
| `@bulk-brew/mobile`   | Phone and tablet React app. Wrapped by Capacitor for iOS.                                                                   |

- **Storage**: pool, decks, and settings in IndexedDB behind one key-value interface (`packages/ui/src/storage/kv.ts`). On iOS the same store runs in the WebView unless phase 8 moves it to native storage. Backup is a JSON file export and import; restore writes all keys in one transaction.
- **Offline**: the web app is an installable progressive web app. Its service worker precaches the app shell and built assets per deploy and keeps the data pack in a separate cache that survives deploys. The iOS app bundles everything.
- **iOS**: Capacitor wraps the mobile app's static build. Builds run on the user's Mac mini with Xcode and ship through TestFlight and the App Store.

## Compliance

- Scryfall data is free for Magic software. Credit Scryfall, never paywall its data, never imply endorsement, and add value beyond repackaging.
- Wizards' Fan Content Policy governs card names, text, and images. Both apps carry the Fan Content notice on their About screen. See `ATTRIBUTION.md`.
- Scryfall API requests carry a descriptive User-Agent and Accept header where the platform allows it, and are spaced at least 100 ms apart. Bulk files are fetched at most daily.
- Image and data requests go from the user's device, never through a developer server.

## Milestones

| Phase | Deliverable                                                                                                     | Status                            |
| ----- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1     | Repo bootstrap: monorepo, license, docs, download scripts, CI, Pages deploy, design brief                       | done                              |
| 2     | Data pipeline: pack, manifest, edge-case tests, weekly refresh workflow                                         | done                              |
| 3     | Core: pack loader, name resolution, pool model with import report and backup                                    | done                              |
| 4     | Guides and config v1: templates, roles, archetypes, synergy and land rules                                      | done                              |
| 5     | Archetype scan and builder v1: mono-color, all sizes, explanations, packet pairing                              | done                              |
| 6     | Evaluation harness: test pools, rubric, results tracking                                                        | done                              |
| 7     | Web app: full flow, card detail and art, backup, CSV import, offline, mobile layouts                            | done                              |
| 7b    | Design pass: Claude Design restyles both apps from `docs/DESIGN_BRIEF.md`                                       | done                              |
| 8     | iOS app: Capacitor project, bundled data, over-the-air data updates, TestFlight                                 | on hold until the owner starts it |
| 9     | Deck strength: data pack schema 2, card strength and deck scores, best fit by building, guide-based config pass | done                              |
| 10    | Colors: one to five colors, castability candidates, pip-based mana bases, fixing, saved deck migration          | done                              |
| 11    | Build page: settings left, ranked deck options right, background worker, state kept                             | done                              |
| 12    | Styles: primary and secondary styles, tribal as a secondary style, new styles                                   | next                              |
| 13    | Commander: 100-card singleton, commander candidates and tiers, commander-anchored builds                        |                                   |
| Later | Batch balanced mode, offline image download                                                                     |                                   |

## Decisions

Resolved questions, kept so they are not reopened by accident.

- Core language: TypeScript. UI: React 19, Vite, Tailwind. Tests: Vitest. Package manager: npm.
- iOS: a separate mobile interface on the shared core, wrapped by Capacitor. Not a Swift port, not a responsive single app.
- Database: JSON data pack, not SQLite.
- Data distribution: release assets plus a pinned manifest, not committed packs.
- Rulings: never bundled.
- Pools: one active pool. Multiple named pools are not planned.
- Deleting a deck: offers to return its cards to the pool. A committed deck records `basicsTaken` when basics were tracked at commit time, so the return does not depend on the current setting.
- Copy limits: 4 for 60 and 40, 2 for 20, adjustable. 100 is singleton, not adjustable.
- Un-set cards: excluded by default, toggle in settings.
- Land count: formula from curve and cheap mana sources, not a fixed number.
- Colors: one to five colors in every size; mono stays the strongest mode; more colors are allowed even though they build worse. Packet pairing stays.
- Deckbuilding guidance from outside material is restated in our own words in `docs/guides/` and config, with no source names in the repo.
- Game Changers are not filtered out.
- Tribal is a secondary style, not a primary one.
- A secondary style needs a primary style.
- Name: Bulk Brew, repo `bulk-brew`. An unrelated dormant repo shares the name; not a concern.
- Result actions: Accept (with a confirmation), Reject, and Export. A short-lived Save deck and Remove from pool pair from the design pass was dropped after owner review; decks saved without accepting show "Not accepted" and can still be accepted.
- Short display tags live in `config/display-tags.json`, matched with the same matcher format as roles plus role and style references. They are for showing and filtering only; the builder never reads them, so they are not part of the config version a deck records.
- Pairing packets is a what-if view from a packet; Merge replaces both packets with one 40-card deck. Basics return on disassembly only if both packets took them.
- Appearance lives in `localStorage`, outside `Settings` and backups, so no settings format changed.
- Near miss is a display label only: not viable, the size is buildable, and at most 3 cards short in total (`NEAR_MISS_SHORTFALL` in `packages/ui/src/data/analysis.ts`). The builder never reads it.
- Plain-language card tags are the config's role labels and style (archetype) labels, not raw Scryfall tags; the raw tags stay behind a disclosure.
