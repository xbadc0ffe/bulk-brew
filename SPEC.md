# Bulk Brew: Project Spec

Source of truth for scope, data, and architecture. Describes what exists and what is decided, not how it came to be. Update it when a decision changes.

## Purpose

Turn a large pool of bulk Magic: The Gathering cards into playable casual decks. The user imports a card list into a pool, picks a deck size and a color, and the app builds the best deck it can from what is available. Accepting a deck saves it and removes its cards from the pool, so the next build uses what is left.

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

| Size | Style               | Notes                                                                                                                   |
| ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 60   | Constructed, casual | Max 4 copies of a card by default.                                                                                      |
| 40   | Limited-style       | Max 4 copies by default.                                                                                                |
| 20   | Jumpstart packet    | Includes its lands. Max 2 copies by default. Any two packets of different colors shuffle into a two-color 40-card deck. |

### Colors

Version 1 builds mono-color decks in all three sizes. Candidate cards are those whose color identity is a subset of the chosen color, so colorless cards are always eligible and gold cards never are. Two-color play comes from pairing two 20-card packets; the app pairs them and exports the combined list. Proper two-color builds with gold cards are a later version. Three or more colors are out of scope.

### Pool flow

1. **Import** decklist text. The app reports how many cards resolved and lists unresolved lines for the user to fix or skip.
2. **Pool** is the single active set of available cards, keyed by oracle id with quantities. It persists on the device between sessions and can be exported as a backup file and restored.
3. **Build** a deck from the pool. The result is a full decklist with an explanation.
4. **Accept** saves the deck and removes its cards from the pool. Discard throws it away. Rebuild tries another style.
5. **Build again** from what is left, until the pool runs out of a color.
6. **Clear pool** and **delete deck** are one action each with a confirmation. Deleting a deck offers to return its cards to the pool.

Basic lands are unlimited by default and need not be imported. Nonbasic lands are always tracked.

### Settings

Defaults live in `config/settings.defaults.json`.

- Max copies per card, per deck size (60: 4, 40: 4, 20: 2).
- Unlimited basics (on).
- Include Un-set and acorn cards (off).
- Show card art (off on first launch, remembered).

### Platforms

- **Web app**: desktop-first, fully static, hosted on GitHub Pages. Works offline after first load.
- **Mobile app**: phone and tablet layouts, developed in a browser, shipped to iOS through Capacitor. Bundles the data pack and config, and can update both over the air.

## Data

### Sources

Scryfall bulk data, downloaded by `scripts/fetch-scryfall-bulk.mjs` into the gitignored `data/raw/`:

- `oracle_cards`: one entry per unique card (oracle id), with the default printing's image id.
- `oracle_tags`: Scryfall Tagger function and synergy tags. About 4,600 tags, 240,000 taggings, 36,000 tagged cards. Tags form a tree through `parent_ids`. Tagging weights are flat in practice (99.7% are "median"), so tags are treated as boolean and any weighting comes from config.
- `rulings`: development reference only. Never bundled. If a card detail view ever shows rulings, they load from Scryfall on demand.

Not used: default cards, all cards, unique artwork, art tags. Imports resolve by name against oracle cards, so per-printing data is not needed.

A local tag overlay in `config/tag-overlay.json` fixes and gap-fills tags at pipeline time.

### Card identity

Everything is keyed on `oracle_id`. Printings, sets, collector numbers, finishes, and languages are ignored for card facts and building. A set code and collector number from an import line are kept only as an art hint on the pool entry.

Name resolution handles full multi-face names ("A // B"), front-face-only names, case, accents, and punctuation. Where one name maps to several oracle ids (36 cases), the paper-legal non-Un-set card wins.

### Data pack

The shipped database is one compact JSON file, gzip-compressed by the host. Shape: `DataPack` in `packages/core/src/types.ts`. Per card: oracle id, name, layout, mana cost, mana value, type line, oracle text, colors, color identity, keywords, power, toughness, loyalty, produced mana, normalized types, derived `entersTapped` and `unset` flags, tags, faces, and the default printing's image id. Measured size with today's data: about 33,400 cards, 18 MB raw, 4.5 MB compressed.

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
4. Write `data/packs/cards.v1.json` and `data/manifest.json` (version, URL, checksum, size, card count).

Tests cover the edge cases above with fixture cards.

### Publishing and updates

- Raw bulk files and built packs are never committed. The repo pins `data/manifest.json`.
- A weekly GitHub Actions workflow fetches the bulk files, rebuilds the pack, and when the data date changed, publishes the pack as a release asset tagged `data-YYYY-MM-DD`, commits the manifest bump to main, and triggers the web deploy.
- The web deploy downloads the pinned pack with `npm run data:pull`, verifies its checksum, and serves it from the site's own origin as `data/cards.v1.json`, compressed in transit by the host. The browser caches it; a new deploy brings the new pack.
- The iOS app bundles the pack and config at build time and offers "check for card updates", which downloads a newer pack and config from GitHub. Apple permits data updates; code changes still need an App Store release. No user data is sent.

## Images

- One default image per card, the printing Scryfall's oracle file chose. The pack stores the printing id; `imageUrl()` builds the URL.
- Images load on demand from Scryfall's image host, directly from the user's device, and are cached there. Only cards in the pool and in decks are ever loaded.
- When an import line carried a set code (and collector number), the pool entry keeps it and the art toggle shows that printing, falling back to the default. Set codes affect nothing else.
- Card art is off by default. Everything works as text without images.
- Images are never cropped, distorted, recolored, or watermarked.
- A "download images for my pool" action for full offline use is a later version.

## Config

Versioned data files in `config/`, typed and validated by `packages/core/src/config.ts`. See `config/README.md` for the file list. In short: deck templates per size (land formula constants, default curve profile, type mix, role quotas, tolerances), curve profiles, role definitions as matchers over Tagger tags, keywords, types, and derived facts, synergy and composition archetypes, synergy rules, land rules, builder weights, settings defaults, and the tag overlay. Initial values come from the guides in `docs/guides/`, which the user reviews. `npm run config:check` validates the bundle against the data pack.

## Archetype scan

Scan the pool and report, per color and per deck size, which archetypes are viable, with enabler and payoff counts (synergy archetypes) or role and curve counts (composition archetypes), plus how close near-misses are. The builder uses the scan as its seed step and the Build screen shows it to guide the style choice.

## Builder

### Inputs

Pool, deck size, color, optional style preference, settings, config version, data version.

### Steps

1. **Candidates**: pool cards whose color identity fits, honoring the Un-set setting and copy limits.
2. **Archetype**: the preferred style if viable, else the strongest viable one from the scan.
3. **Reserve lands**: start from the template's base land count so the spell count is known.
4. **Fill spells** in passes with per-type caps so no category floods the deck: role quotas, then curve and type mix, then synergy density, then filler by tiebreaks.
5. **Size the mana base** from the spells actually chosen: a base count per size, raised by average mana value, lowered per cheap mana source, clamped to a range. A rock or dork costing two or less earns full credit, a three-cost one half credit, and dorks slightly less than rocks because they die to removal. Dorks still count as one-drop creatures in the curve. If the land count moved, adjust the spell count and re-fill the difference.
6. **Improve** with local search: swap moves that raise the objective.
7. **Nonbasics and basics** per land rules.

Constants live in `config/deck-templates.json` and are explained in `docs/guides/deck-shapes.md`.

### Objective

Template fit (curve deviation, type mix, role quotas) plus synergy density. No card quality score in version 1. Tiebreaks: theme tag hits, then creature stats per mana.

### Output

A deck with cards grouped by type, basics by color, and a `BuildExplanation`: archetype, curve, role counts against targets, land reasoning, key synergies, notes. Each card also carries provenance (which role or synergy slot it filled, or filler), shown as "why this card" in the deck view and used for debugging.

### Modes

- **Best cards** (version 1): each build takes the best available cards from the current pool.
- **Batch balanced** (later): several decks from one pool, holding back the stronger deck until deck-level scores are within tolerance.

## Jumpstart packets

A 20-card packet includes its lands (about 8) and is built so that any two packets of different colors shuffle into a playable 40-card deck: a lower curve, a self-contained theme, no cards that need the other color. The Decks screen pairs two saved packets and exports the combined list.

## Evaluation

- Fixed test pools in `eval/pools/`, each exercising something specific.
- A written rubric in `eval/rubric.md`: curve, type mix, role coverage, synergy, mana base, playability.
- A dev-side script builds every pool with every setting, scores the decks, and records results in `eval/results/` so config changes can be compared over time.
- Claude reviews decks against the rubric as a development aid, not as ground truth. The user calibrates on a sample.

## Architecture

npm workspaces monorepo, TypeScript throughout.

| Package               | Role                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@bulk-brew/core`     | Types, decklist parser, name resolution, pool, scan, builder, export. Pure, unit-tested, no DOM or Node APIs. |
| `@bulk-brew/ui`       | Shared React pieces: mana symbols, card rows, deck lists.                                                     |
| `@bulk-brew/pipeline` | Developer-side data pipeline.                                                                                 |
| `@bulk-brew/web`      | Desktop-first React app. Static build deployed to GitHub Pages.                                               |
| `@bulk-brew/mobile`   | Phone and tablet React app. Wrapped by Capacitor for iOS.                                                     |

- **Storage**: pool, decks, and settings in IndexedDB on the web and in app storage on iOS, behind one storage interface. Backup is a JSON file export and import.
- **Offline**: the web app is a progressive web app with the data pack cached; the iOS app bundles everything.
- **iOS**: Capacitor wraps the mobile app's static build. Builds run on the user's Mac mini with Xcode and ship through TestFlight and the App Store.

## Compliance

- Scryfall data is free for Magic software. Credit Scryfall, never paywall its data, never imply endorsement, and add value beyond repackaging.
- Wizards' Fan Content Policy governs card names, text, and images. Both apps carry the Fan Content notice on their About screen. See `ATTRIBUTION.md`.
- Scryfall API requests carry a descriptive User-Agent and Accept header where the platform allows it, and are spaced at least 100 ms apart. Bulk files are fetched at most daily.
- Image and data requests go from the user's device, never through a developer server.

## Milestones

| Phase | Deliverable                                                                               | Status |
| ----- | ----------------------------------------------------------------------------------------- | ------ |
| 1     | Repo bootstrap: monorepo, license, docs, download scripts, CI, Pages deploy, design brief | done   |
| 2     | Data pipeline: pack, manifest, edge-case tests, weekly refresh workflow                   | done   |
| 3     | Core: pack loader, name resolution, pool model with import report and backup              | mostly |
| 4     | Guides and config v1: templates, roles, archetypes, synergy and land rules                | done   |
| 5     | Archetype scan and builder v1: mono-color, all sizes, explanations, packet pairing        | next   |
| 6     | Evaluation harness: test pools, rubric, results tracking                                  |        |
| 7     | Web app: full flow, art toggle, storage, offline, design pass applied                     |        |
| 8     | iOS app: Capacitor project, bundled data, over-the-air data updates, TestFlight           |        |
| 9     | Later: two-color builds, batch balanced mode, quality score, offline image download       |        |

## Decisions

Resolved questions, kept so they are not reopened by accident.

- Core language: TypeScript. UI: React 19, Vite, Tailwind. Tests: Vitest. Package manager: npm.
- iOS: a separate mobile interface on the shared core, wrapped by Capacitor. Not a Swift port, not a responsive single app.
- Database: JSON data pack, not SQLite.
- Data distribution: release assets plus a pinned manifest, not committed packs.
- Rulings: never bundled.
- Pools: one active pool. Multiple named pools are not planned.
- Deleting a deck: offers to return its cards to the pool.
- Copy limits: 4 for 60 and 40, 2 for 20, adjustable.
- Un-set cards: excluded by default, toggle in settings.
- Land count: formula from curve and cheap mana sources, not a fixed number.
- Colors: mono only in version 1; two-color via packet pairing; never three.
- Name: Bulk Brew, repo `bulk-brew`. An unrelated dormant repo shares the name; not a concern.
