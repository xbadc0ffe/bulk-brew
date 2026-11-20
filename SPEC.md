# Bulk Brew: Project Spec

Source of truth for scope, data, and architecture. Describes what exists and what is decided, not how it came to be. Update it when a decision changes. How the builder works and why is in `docs/builder.md`; how to measure a builder change is in `docs/evaluation.md`; the screens as built are in `docs/DESIGN_BRIEF.md`.

## Purpose

Turn a large pool of bulk Magic: The Gathering cards into playable casual decks. The user imports a card list into a pool, picks a deck size, colors, and optional styles (or a commander for 100 cards), and the app builds several deck options from what is available, ranked by strength and fit. Accepting a deck saves it and takes its cards out of the pool, so the next build uses what is left. The app calls the pool the Bulk List.

Bulk Brew presents itself as a bulk builder: it makes good decks from what a pile holds. Real decks deserve a person's care; the app does not try to replace that.

The app is self-sufficient: no language model calls at runtime, no developer server, no user data sent anywhere. All judgment lives in data (card facts, tags, config) and a deterministic builder.

Targets: a static client-side web app and an iOS app, built together on one core. Free, open source (MIT).

## Principles

- **Deterministic.** Same pool, settings, config version, and data version give the same deck.
- **Logic as code, judgment as data.** Templates, theme rules, card needs, land rules, and weights live in versioned config files so they can be tuned without code changes and shipped to iOS without an App Store release.
- **One core, two shells.** Parser, name resolution, pool, scan, builder, and export live in a platform-free core. The web app and the mobile app are separate interfaces with different layouts on the same core.
- **Deckbuilding is not "lands plus spells".** A deck is a curve, a type mix, role coverage, synergy, and a mana base sized to the spells it holds.
- **Explainable.** Every card in a built deck records why it is there.

## Product

### Deck sizes

- **100, Commander**: one commander plus 99, singleton (basics exempt). Colors come from the commander.
- **60, constructed casual**: max 4 copies of a card by default.
- **40, limited style**: max 4 copies by default.
- **20, Jumpstart style**: shown as "20" with a note when selected. Includes its lands. Max 2 copies by default. Any two packets of different colors shuffle into a two-color 40-card deck.

### Colors

Decks use one to five colors. Mono-color stays the builder's strongest mode; every added color makes a deck harder to build well, and the app says so rather than refusing.

A color gives access to its cards, not a share of the deck. The builder takes the cards that best serve the style from any picked color, with no even split: the deck leans on its main color, the others bring what they add, a thin color is a light splash whose cards join only on their own merit, and at 60, 40, and 20 a picked color may be left out (options try every subset). A deck is named for the colors its spells use. Only the classic builder keeps a few spells of each picked color (`minCardsPerColor`). A Commander deck stays inside its commander's colors but need not use them evenly.

- **60, 40, 20**: a card is a candidate when every mana symbol in its costs and rules text can be paid by the deck's colors (hybrid symbols when either half fits), so hybrid cards work in mono decks. Colorless cards are always eligible.
- **100**: candidates are cards whose color identity fits inside the commander's, as the format requires.
- Colored source counts come from a cast-on-curve chance, met for a share of each color's spell copies per size (`landRules.colors.sourceCover`, fitted on the reference corpus by `npm run sources:fit`).
- Two-color play also comes from pairing two 20-card packets; pairing stays as a mode.

### Pool flow

1. **Import** decklist text or a collection CSV (ManaBox, Moxfield, Deckbox, or any CSV with name and quantity columns), pasted or from a file, on a subpage of the Bulk List. The text is checked live: matched cards and colors, and each unmatched line, which can be renamed, swapped for a suggestion, or skipped. Import adds the matched cards; lines that did not match stay in the box.
2. **Pool**: the single active set of available cards, keyed by oracle id with quantities, kept on the device and exported and restored from Settings.
3. **Build** from the pool: deck options ranked by strength (see Build options); opening one shows the decklist with an explanation.
4. **Accept** saves the deck and takes its cards out of the pool (the `committed` flag), or keeps them there; **Reject** returns to the form with every choice kept; **Export** copies or downloads the list (see Decisions, result actions). A result survives moving between screens until it is accepted or rejected. Before Accept, any card but the commander and basics can be **replaced** (see Replace); leaving the result asks before it drops the swaps.
5. **Build again** from what is left, until the pool runs out of a color.
6. **Remove cards** with Select on the Bulk List; Settings clears everything. A saved deck's **Remove** asks Delete (the pool stays as it is) or Disassemble (its cards return to the pool, then it is deleted); a deck whose cards never left the pool only offers Delete. A deck's name renames on click. Accepting a kept deck later is refused, with a count, when the pool no longer holds all its cards.
7. **Pair** two 20-card packets of different colors from a packet's view: a what-if preview of the combined 40-card deck, and **Merge**, which replaces both packets with one deck (packets still in the pool are taken out of it first).

Basic lands are unlimited by default (the Infinite basics switch on the Build form) and need not be imported; imported basics are kept as pasted. Nonbasic lands are always tracked.

The Bulk List filters by color, type, subtype, mana value, short tags, and subtags, sorts by any column, selects cards to remove, and opens the Analyze pane under the list. Short tags come from `config/display-tags.json`; subtags are the config's role and style labels; the card detail also lists the raw Scryfall tags. A card detail opened from a deck shows only the roles, styles, and short tags the card earns in that deck, by the card needs reader against the deck's supply (`packages/core/src/deck-credits.ts`).

**Replace** (web, a fresh build only; `packages/core/src/replace.ts`) lists pool cards that fit the build, a spell for a spell and a land for a land, closest first: shared jobs the deck counts (only where earned), then card strength, mana value, and creature or not; lands by the land rules. A nonbasic land can also give way to a basic of a deck color it makes. The swap labels the new card "Swapped in for" the old one and updates the explanation. Saved decks are not edited.

### Settings

Defaults live in `config/settings.defaults.json`.

- Max copies per card, per deck size (60: 4, 40: 4, 20: 2), on the Build form under the deck size (the phone app still lists them in Settings). 100 is always singleton, the stepper held at 1.
- Infinite basics (on) and rarities the builder may use (all four by default), on the Build form. Basic lands and cards with no known rarity are never filtered out.
- Include Un-set and acorn cards (off). Show card art (off on first launch, remembered).
- Export and restore (web) by part: Bulk list, Decks, or Both. JSON is a backup (Both adds the settings); TXT is plain card lists that import back (`collectionText`). Restore replaces only the chosen part and refuses a file without it. The phone app still exports and restores everything.
- Appearance: light, dark, or system (the default), a theme color (grey or one of the five colors), and a text size (90 to 140%) that scales the layout, since sizes are in rem; in the iOS app it multiplies the system text size, and the product stays within 90 to 140%. Kept in `localStorage`, not in `Settings` or backups.

### Platforms

- **Web app**: fully static, hosted on GitHub Pages. Works offline after first load. One set of screens serves every width: the desktop layout from 768 px, and a phone layout below it (folder tabs, two-line card rows, bottom sheets; see `docs/DESIGN_BRIEF.md`).
- **iOS app**: the web app wrapped by Capacitor, bundling the data pack and config and updating both over the air (not built yet; see Status). `apps/mobile`, an earlier separate phone app, is being retired and gets no new work.

## Screens

### Build options

Settings on the left, deck options on the right.

- **Settings**, in this order: deck size, rarities, max copies, infinite basics, colors (one or more), primary archetype, secondary archetype. Both archetypes default to best fit. The primary list comes from the scan's `rules`: a theme Viable, or Short with what the pool lacks down to `grow.nearMargin` of the floors (both pickable), and a plain shape Viable wherever the size can be built. The secondary unlocks once a primary is picked and lists only archetypes the scan says can be supported alongside it.
- **Options** show a title and description, a color wheel, the mana curve, card types, role coverage, and mana notes. A score ranks them but is never shown. Without a secondary style it is the plan picker's score plus `buildOptions.allColorsBonus` for an option built for every picked color, so the first option is `buildDeck`'s best fit for the same request, card for card. With a secondary style it is the classic deck score plus that bonus and `buildOptions.secondaryBonus` for meeting the secondary style.
- **Fit**: every option uses only picked colors (any non-empty subset) and is built for a picked primary style (`requireStyle`), answered as the Builder section says: the nearest deck with its note, shown on the card and in the deck view, or with a secondary style a failure. When no deck can be built, the right side says so, with the lacks sentence when there is one, and offers Clear settings inline. An option that missed its secondary style is marked. Styles and colors that were not picked never appear.
- **Plans**: with no style picked, each color subset plans what best fit compares there (the themes the rules call viable, the three plain shapes always, and under a commander the tribes it names). The full set of picked colors is planned first, so best fit is always among the options; the smaller sets share what is left of `buildOptions.maxBuilds`. With a secondary style, each subset plans the styles the scan calls viable, in turn.
- **Generation**: each option is built from the full pool, one at a time in a Web Worker (`deckOptionSearch` in `packages/core/src/options.ts`), and appears as it finishes, re-sorted by rank. At most `buildOptions.maxOptions` show; one that shares most of its cards (`duplicateShare`) with a stronger one of the same style is dropped (with a secondary style, of any style); without a picked primary at most `maxPerStyle` share a style. Leaving the screen pauses the work; settings and finished options survive it.

### Commander list (100)

- Commander candidates from the pool are listed by tier as card-shaped tiles, with the deck each leads. Picking one keeps it in a pane beside its options; changing any build setting returns to the list.
- **Colors** filter the list: a commander shows when all its colors are picked (none picked shows every one), and those using every picked color come first. Once a commander is picked, the buttons show its colors.
- **Primary archetype** works before a commander is picked: its choices are the styles the listed commanders lead (a style the theme rules give the commander's own text a job for, or a tribe it names; the plain shapes suit every commander). Picking one groups the commanders that lead it as Can build, Checking, and Not enough cards, each checked by its own scan and then a full build in the background (`commanderCanBuild`: the deck must come back as the style, not as a nearest deck).
- Picked colors and styles stay when a commander is picked, changed, or accepted, and when switching sizes.

### Analyze pane

The Analyze button on the Bulk List opens the pane under the list (web; the phone layout shows a per-color archetype table with the pool's counts against the rules' floors).

- **Recommended decks**: the strongest decks found so far for Commander, 60, 40, and 20, five each, from the whole pool (two decks can share cards), filtered by Max colors per deck (one to five, two by default). The score is not shown. Picking one opens it on the Build page like a deck option.
- **Search** (`bestDeckSearch` in `packages/core/src/best-decks.ts`): at 60, 40, and 20 every color set plans what best fit compares there, most promising first and fewer colors first in each turn; at 100 it builds best fit under every commander with enough cards for the 99. Results rank by the plan picker's score, as deck options with no picked colors, at most two per style, near copies dropped, each commander keeping its deck. Each color limit keeps its own list.
- **Background**: a Web Worker on only the pool's cards and basics (`poolPack`), equal time per size, paused while the pane is closed, restarted when the pool or build settings change.
- **Breakdown** (`poolStats`), in copies: color pies, spells by color and mana value, card types, roles, creature types, and subtypes by color. Rarity, sets, and prices are left out: they do not change which deck to build.

## Commander

- **Legality**: the commander must be allowed by the format (a legendary creature card, Vehicle, or Spacecraft with power and toughness, or text that says it can be your commander). Cards banned or not legal in Commander stay out of the commander list and the 99. Every card fits inside the commander's color identity. Singleton except basics and cards whose text allows more.
- **Tiers**: top, good, and possible (see `docs/guides/commander.md`), ranked by how many pool cards fit its identity, whether its own text rewards a style the pool supports or a creature type it holds, its mana value, and its colors against the fixing in the pool. Partner and Background pairs and colorless commanders are not supported yet.
- **Template**: 35 to 40 lands (38 to start), 8 ramp, 12 card advantage (draw, cantrips, and looting), 8 removal, 3 sweepers, 4 finishers, and the rest for the theme, so lands plus ramp land near 45 to 47, as in the official precons. Every Commander deck uses the `commander` curve profile. Numbers live in `deck-templates.json` and the `commander` block of `builder-weights.json`.
- **Tribes**: a commander whose text names a creature type (its Tagger `typal-<type>` tag and a payoff job in the tribe rules) can lead that tribe. A tribe a commander does not name, or one asked for below 100, is refused.

## Jumpstart packets

A 20-card packet includes its lands (about 8) and is built so that any two packets of different colors shuffle into a playable 40-card deck: a lower curve, a self-contained theme, no cards that need the other color. Packets use the `jumpstart` curve profile.

- A spell is a candidate only when the packet can cast it as half of a 40-card deck (`halfCast` in the 20-card template, `halfCastable` in `candidates.ts`): with its own 8 lands, split evenly among its colors, as the only sources of its colors in a 16-land deck, it needs a 0.3 chance by turn 10 on the play to have seen its mana value in lands and its pips in its own lands. A split, adventure, or modal card counts by its cheapest face, a prototype card by its cheaper cost. In a one-color packet every spell of mana value 8 or more goes.
- The theme rules count no payoff at 20 that counts a resource or waits for a threshold, and Spellslinger's packet floor asks for 4 setup with its 3 payoffs, so a packet's theme works from its own cards.

## Data

### Sources

Scryfall bulk data, downloaded by `scripts/fetch-scryfall-bulk.mjs` into the gitignored `data/raw/`:

- `oracle_cards`: one entry per unique card (oracle id), with the default printing's image id.
- `oracle_tags`: Scryfall Tagger function and synergy tags. About 4,600 tags, 240,000 taggings, 36,000 tagged cards. Tags form a tree through `parent_ids`. Tagging weights are flat in practice (99.7% are "median"), so tags are treated as boolean and any weighting comes from config.
- `default_cards`: one entry per printing, read only for each card's lowest paper rarity and its flavor names. Nothing per printing is shipped.
- `rulings`: development reference only, never bundled. If a card detail ever shows rulings, they load from Scryfall on demand.

Not used: all cards, unique artwork, art tags. Imports resolve by name against oracle cards. A local tag overlay in `config/tag-overlay.json` fixes and gap-fills tags at pipeline time.

### Card identity

Everything is keyed on `oracle_id`. Printings, sets, collector numbers, finishes, and languages are ignored for card facts and building. A set code and collector number from an import line are kept only as an art hint on the pool entry.

Name resolution handles full multi-face names ("A // B"), front-face-only names, case, accents, punctuation, and the flavor names some printings carry. Where one name maps to several oracle ids, the non-Un-set card wins; a real card name always wins over another card's flavor name.

### Data pack

One compact JSON file, gzip-compressed by the host. Shape: `DataPack` in `packages/core/src/types.ts`. Per card: oracle id, name, layout, mana cost, mana value, type line, oracle text, colors, color identity, keywords, power, toughness, loyalty, produced mana, normalized types, derived `entersTapped` and `unset` flags, tags, faces, the default printing's image id, Commander legality, the Game Changer flag, Scryfall's popularity rank (one signal in card strength), rarity (the lowest among paper printings, special and bonus stored as rare), and optional flavor names. `data/manifest.json` pins the current pack: 2026-11-16, schema 2, 34,177 cards, 5.6 MB compressed.

- Decks record `CardIndex.dataVersion`, the pack date plus the schema from 2 on, so packs of different schemas never share a data version.
- The pack is served under one fixed name, `data/cards.json`, and the service worker answers from its cache first. So every release of the core reads the previous schema as well as the current one (today 1 and 2): a returning user may load the old cached pack once before the new one arrives.
- JSON was chosen over SQLite because the data is small, loads with one fetch, needs no WebAssembly on the web, and decodes natively in Swift if the iOS app ever goes native.

### Filters and edge cases

- Exclude non-playable layouts (tokens, emblems, art series, planes, schemes, vanguards, and similar), oversized cards, and Alchemy digital-only designs. The oracle file sometimes picks a digital printing of a real paper card, so a printing's paper flag is not used as a filter.
- Un-set and acorn cards stay in the pack flagged `unset` and are excluded by default.
- Multi-face cards: a modal double-faced card with a land face counts as both a land and a spell; split and adventure cards carry multiple costs; transforming cards use the front face for cost and color.
- X spells, hybrid, and Phyrexian mana are handled in mana value and castability logic.

### Pipeline

`npm run data:build` runs `packages/pipeline` under Node 24: read the raw bulk files; filter, trim, normalize, and derive fields; join Tagger tags and the overlay; write `data/packs/cards.json`, its gzip (the release asset, named with the schema, such as `cards.v2.json.gz`), and `data/packs/manifest.json` (version, URL, checksum, size, card count), and copy the pack into each app's `public/data/`. Tests cover the edge cases above with fixture cards.

### Learned data

`npm run learn:build` learns from real decks: the reference corpus's train split (never the owner's local lists), EDHREC's pages (`npm run edhrec:fetch`), and Commander Spellbook's combo file (`npm run spellbook:fetch`). Everything it writes is aggregate, rounded numbers keyed by oracle id, tag, or style.

- **Tag and style level**, in `config/learned/` (about 100 KB): each style's profile per size from its real decks, theme shares in random bulk, the tags each style's decks favor, and tag pairs. Versions are content hashes and join `configVersion()`.
- **Card level**, `data/learned.json` (committed, about 1.6 MB): per-card plan fit, the plans and cards of each commander EDHREC covers, card pairs from draft decks, and combos of three cards or fewer. The apps load it beside the card data; the core treats it as optional.
- **Who reads it**: only the classic builder, for requests that reach it directly (a secondary style), at the sizes `builderWeights.learned.plan[size].use` turns on (100, 60, and 20). The grow builder, and the classic builder as a grow request's fallback, read none of it. Classic decks record its version as `learnedVersion`. It is not relearned (see Decisions).

### Publishing and updates

- Raw bulk files and built packs are never committed. The repo pins `data/manifest.json`.
- A weekly GitHub Actions workflow fetches the bulk files, rebuilds the pack, and when the data date changed, publishes it as a release asset tagged `data-YYYY-MM-DD`, commits the manifest bump to main, and triggers the web deploy.
- The web deploy downloads the pinned pack with `npm run data:pull`, verifies its checksum, and serves it from the site's own origin as `data/cards.json`. `data:pull` and `data:build` also install the committed `data/learned.json`. The browser caches both; a new deploy brings the new pack.
- The iOS app is to bundle the pack at build time and update it by itself: on opening, at most once a day, it checks for a newer pack and learned data, downloads them in the background, and uses them from the next launch, with no button to press (the owner's call, 2026-11-19). It keeps the bundled pack when offline or when a download fails its checksum, and takes only a pack whose schema it understands. Apple permits data updates; code and config changes still need an App Store release. No user data is sent.

## Images

- One default image per card, the printing Scryfall's oracle file chose. The pack stores the printing id; `imageUrl()` builds the URL.
- Images load on demand from Scryfall's image host, directly from the user's device, and are cached there. Only cards in the pool and in decks are ever loaded, and nothing is requested while the art setting is off.
- When an import line carried a set code (and collector number), the card detail shows that printing, falling back to the default image and then to text. List thumbnails use the default image. Set codes affect nothing else.
- A card printed on two sides shows its front with a turn-over button for the back; the card detail's art opens full screen with zoom (`packages/ui/src/data/zoom.ts`).
- Card art is off by default. Everything works as text without images.
- Images are never cropped, distorted, recolored, or watermarked.
- A "download images for my pool" action for full offline use is a later version.

## Config

Versioned data files in `config/`, typed and validated by `packages/core/src/config.ts`; `config/README.md` lists them and their formats. In short: deck templates per size (land formula, curve profile, type mix, role quotas, the packet cast rule), curve profiles, roles as matchers over Tagger tags, keywords, types, and derived facts, the theme rules (setup and payoff jobs and floors per style, and the tribe rules), card needs, card strength, land rules, builder weights, the bulk theme baseline (`theme-bulk.json`, from `npm run theme:bulk`), the classic builder's archetype matchers and synergy rules, display tags, settings defaults, the tag overlay, and the learned data. Initial values come from the guides in `docs/guides/`. `npm run config:check` validates the bundle against the data pack.

## Archetype scan

Scan the pool and report, per color set and deck size, which styles are viable, with the pool's counts against their floors. The Build page, the commander list, and the Analyze pane read it, and the builder plans from the same counts.

- **Possible**: a size can be built when the pool has enough spells for the slots left at the template's most lands (`minSpells`) and, at 60, 40, and 20, at least half of the base spell slots can be cards of the deck colors (`MIN_COLORED_SHARE`), with at least one spell of each color; at 100 the commander's identity sets the colors, so the color checks do not apply. Cards with a {C} pip are excluded, since basics cannot pay for them.
- **`rules`** (`growViability`) is the one field the apps read, on every style at every size: `viable` (false when the size cannot be built), `floors` (the pool's counts for the floor alternative it meets best, exactly as the builder counts the pool), and a sentence saying what the pool lacks. A plain shape is viable wherever the size can be built.
- A theme card counts only when the pool could meet its needs and drawbacks (a pool-level supply over the request's candidates, lands included, a spell supplying only when every deck of the request can hold it, nothing taken as met). A plain shape's role counts include only cards that could earn the role in that pool.
- **Under a commander** the commander leads rather than counting as one of the 99, its own theme job counts once (`grow.commanderCredit`), and the scan also reports each tribe its text names (`leadTribes`) in the same shape as `rules`.
- **Old fields** (`viable`, enabler and payoff counts from the `archetypes.json` matchers) stay for the classic builder's secondary styles.
- `npm run review:agree` (and a test on fixtures) checks that the scan, both plan lists, and the builder agree on styles and pool counts, and that each deck shows what its builder counted.

## Builder

This section is the contract. How each step works, the constants, and what was tried and dropped are in `docs/builder.md`.

### Inputs

Pool, deck size, colors (at 100 the commander, whose identity sets them), optional primary style, optional secondary style, whether the player asked for the style (`requireStyle`), settings, config version, data version. The same inputs give the same deck (`buildDeck` in `packages/core/src/builder.ts`). Each build takes the best available cards from the current pool; batch balanced mode is later.

Candidates are the pool cards that fit the colors (see Colors), honoring the Un-set setting, rarities, and copy limits, and excluding cards with a {C} pip and, at 20, spells a packet cannot cast. Deckbuilding guidelines (fewer copies of legendary and expensive cards, type caps) bend when a thin pool runs out of other cards; Magic rules and the user's settings never bend.

### What a request gets

- **Best fit** (no style): every plan the request can build is built, and the finished deck with the highest plan picker score wins. The plans are the three plain shapes (Aggro, Midrange, Control, always), each theme the rules call viable, and under a commander each tribe it names. Its notes name the plans compared, in order.
- **A style the player asked for** (`requireStyle`): the style when the pool meets its floors. Otherwise a **note** saying in plain words what the pool lacks, and the **nearest deck**: the first viable style in the rules' `kin` list for it (styles that share its resource), else best fit, which never holds the short style. The deck is named for what it is and records the request in `explanation.nearest`. Floors are counted as the finished deck earns them, so a theme the deck cannot pay for gets the note, never "minimums met".
- **A style as one plan of a list** (a Build page option or an Analyze deck, no `requireStyle`): built as best fit would build it, or refused with what the pool lacks, so the list drops it.
- **A secondary style**: built by the classic builder, best effort, with `explanation.secondary` saying whether it was met. A primary style the pool falls short of fails instead of building another.
- **Refused**: a `BuildError` with a plain-language message when the pool cannot make a deck of the size and colors.

### Which builder runs

- **The grow builder** (seed and grow, `packages/core/src/grow.ts`) builds every request without a secondary style, at every size: best fit, themes, plain shapes, 20-card packets, and at 100 the tribes a commander names.
- **The classic builder** (`buildClassic` in `builder.ts`) builds every request with a secondary style, at any size, a tribe as the secondary among them. At 60, 40, and 100 it is also the fallback, without the learned data (`withoutLearned`), for a plain shape the grow builder cannot fill on a thin pool (by name or as a plan of best fit) and for best fit when no plan fills. At 20 there is no fallback: a thin packet pads with lands up to the template's range, or is refused. A tribe asked for below 100 and an unknown style id also reach it and are refused; the apps send neither.
- `explanation.builder` records which one ran. The classic builder stays only while requests reach it (see Decisions).

### The grow builder in short

- It reads the theme rules (`config/theme-rules.json`): for each themed style, setup and payoff jobs over oracle text, type lines, tags, and keywords, each card counted once as the job it mostly does, a rider counted as nothing, and floors per size that a decent deck of the style needs. Tribes are themes of the same rules, one per creature type, with floors at 100 only.
- It seeds the style's payoffs to the payoff floor, grows the setup they need, fills roles to their minimums and the curve slot by slot behind a payoff gate, then sizes the lands and the mana base. Plain shapes run the same steps without a theme. Constants live in `builderWeights.grow`.
- **Card needs**: the card needs reader (`packages/core/src/card-needs.ts`, `config/card-needs.json`) reads each card's text into what its abilities depend on; the builder gates every pick on what the deck supplies and checks the finished deck once more. `npm run needs:decks` counts unsupported cards per deck.
- **Plan picker** (`pickScore` in `grow.ts`, `builderWeights.picker`): one score ranks the finished deck of every plan, whatever built it, for best fit, the Build page's options without a secondary style, and the Analyze pane. It weighs card quality within each mana value, role and curve fit, supported copies, castability, and a cost per extra color; a theme also weighs its margin, its richness over plain bulk beyond chance (`config/theme-bulk.json`), its depth, and the commander's lead, and must beat a plain shape by `picker.themeMargin`. Ties go to Midrange, Aggro, Control, then the themes by id. The score stays internal (`explanation.pick`).

### Mana base

- **Land count**: a base count per size, raised by average mana value, lowered per cheap mana source, clamped to the template's range (`landFormula`).
- **One color**: a nonbasic land enters only when it beats the basic it replaces on what it does for the deck (`landRules.mono`): an ability earned in the deck counts against life, drawbacks, and making no deck color, more when a lasting ability does the style's theme job; entering tapped costs nothing in itself; colorless lands gain only on the plan and are capped per size.
- **Several colors**: the main color, secondary colors, and a light splash come from the spells' pips (`landRules.colors.splashShare`); each color's sources come from what its spells need to cast on curve (`castChance`, `sourceCover`), and the basics split to match. How a land enters is read against the deck (`landEntry`).
- Lands whose mana depends on a draft never enter a mana base.

### Output

A deck with cards grouped by type, basics by color, and a `BuildExplanation`: archetype, the builder that ran, the picker's score and the plans compared (`pick`, internal), curve, role counts against targets, land reasoning, key synergies, notes, and the nearest-deck record. Each card carries provenance (the role or theme slot it filled, or filler), shown as "why this card"; a reason the card does not earn in its deck is left out.

- A grow deck records each floor of its theme alternative with the builder's count (`explanation.theme`, such as "Voltron setup cards 13/12"). The deck views count it again from the saved deck, each card's job once, only where earned, the commander once (`deckStyleRows`), and under a commander also its tribes (`deckTribes`). Its key synergies are the themes the deck earns both setup and payoff for. It carries no classic deck score.
- A classic deck (secondary styles, and older saved decks) shows the `archetypes.json` enablers and payoffs against their minimums (`styleCounts`), each card counted only where earned, and the synergy rules' lines.
- The Roles bars count each spell under the roles it earns in the deck (`deckRoleCounts`), against the targets the build recorded.

## Evaluation

- `npm run eval` builds every pool in `eval/pools/` at every size and color the scan allows, plus best fit under the two most promising commanders of each pool, scores the decks with automatic metrics, writes `eval/results/<date>-<sha>.json`, and shows per-size deltas against the previous run. It exits 1 on any build failure or broken invariant. The current baseline is `eval/results/2026-11-19-73b7090.json`.
- `npm run corpus:eval` builds reference decks from seeded random bulk (`npm run corpus:fetch` collects them into the gitignored `data/corpus/`; one deck in five is a held-out test split) and is the tool for tuning.
- Builder changes ship on a blind panel of agents judging held-out pools (see Decisions).

What to run when, the metrics, the panel, and the ship rules are in `docs/evaluation.md`.

## Architecture

npm workspaces monorepo, TypeScript throughout. Packages:

- `@bulk-brew/core`: types, decklist parser, name resolution, pool, scan, builder, export. Pure, unit-tested, no DOM or Node APIs.
- `@bulk-brew/ui`: shared React pieces and hooks: storage, pack and config loading, pool, decks, settings, build flow, card detail, deck view.
- `@bulk-brew/pipeline`: developer-side data pipeline, evaluation, and review tools.
- `@bulk-brew/web`: the React app for desktop and phone, a static build deployed to GitHub Pages and to be wrapped by Capacitor for iOS.
- `@bulk-brew/mobile`: the earlier separate phone app, kept only until the iOS project wraps the web app.

Runtime:

- **Storage**: pool, decks, and settings in IndexedDB behind one key-value interface (`packages/ui/src/storage/kv.ts`). On iOS the same store runs in the WebView unless the iOS work moves it to native storage (see `docs/todo.md`). Backup is a JSON file export and import; restore writes the restored keys in one transaction.
- **Offline**: the web app is an installable progressive web app. Its service worker precaches the app shell and built assets per deploy and keeps the data pack in a separate cache that survives deploys. The iOS app bundles everything and registers no service worker.
- **iOS**: Capacitor wraps the web app's static build. Builds run on the user's Mac mini with Xcode and ship through TestFlight and the App Store. The home-screen icon comes in a light and a dark version (`apps/web/resources/`, copied into the AppIcon set as Any and Dark), matching the web app's icon, which follows light and dark mode.

## Compliance

- Scryfall data is free for Magic software. Credit Scryfall, never paywall its data, never imply endorsement, and add value beyond repackaging.
- Wizards' Fan Content Policy governs card names, text, and images. Both apps carry the Fan Content notice on their About screen. See `ATTRIBUTION.md`.
- Scryfall API requests carry a descriptive User-Agent and Accept header where the platform allows it, and are spaced at least 100 ms apart. Bulk files are fetched at most daily.
- Image and data requests go from the user's device, never through a developer server.
- The privacy policy is `apps/web/public/privacy.html` (on the site at `/privacy.html`), linked from About. Keep it true to the code when network use changes.
- 17Lands public draft data (CC BY 4.0) and MTGJSON's preconstructed deck lists (MIT) tune the builder through developer-side scripts. Both are credited and thanked on the About screen of both apps and in `ATTRIBUTION.md`; no deck data from either ships.
- EDHREC is read developer-side by `npm run edhrec:fetch`: one request per second with a named User-Agent, every answer cached under `data/edhrec/` (gitignored) and refetched at most weekly. Only derived, rounded numbers reach the apps. Commander Spellbook's bulk file, made for third parties, is downloaded at most weekly; the apps carry each combo's cards, results, bracket tag, legality, and variant id. Both are credited on the About screens and in `ATTRIBUTION.md`.

## Status

Version 26.0.56. Ranked open items are in `docs/todo.md`.

**Built**

- Web app on GitHub Pages, offline after first load: import with a live check, the Bulk List with filters and the Analyze pane, ranked deck options at 100, 60, 40, and 20 cards in one to five colors, the commander list, Replace, Accept or keep, Decks with packet pairing and Merge, backup and restore by part, appearance and text size, About with the credits.
- Phone layout of the web app, in progress: the Bulk List, the card, filter, sort, and Analyze sheets, the deck options, and the deck view are done; Decks, Settings, Import, and the dialogs still use the desktop layout squeezed.
- Data pipeline, weekly data refresh and release, learned data, reference corpus tools.
- Builder: the grow builder (theme rules, card needs reader, plan picker, one-color land rules) for every request without a secondary style; the classic builder for secondary styles.
- Evaluation: `npm run eval`, `corpus:eval`, and the blind panel tooling.

**Next**: the rest of the phone layout, then the iOS app (a Capacitor project around the web app with the bundled data pack and config, over-the-air data updates, TestFlight), then removing `apps/mobile`.

**Later**: retire the classic builder by building secondary styles in the grow builder, batch balanced mode, image download for offline use.

## Decisions

Resolved questions, kept so they are not reopened by accident.

### Platform and data

- Core language: TypeScript. UI: React 19, Vite, Tailwind. Tests: Vitest. Package manager: npm.
- iOS: the web app, responsive down to phone width, wrapped by Capacitor. Not a Swift port, and not a second set of screens (decided 2026-11-19; it replaced a separate mobile interface, which had fallen behind the web app).
- Database: a JSON data pack, not SQLite (see Data pack).
- Data distribution: release assets plus a pinned manifest, not committed packs (see Publishing and updates).
- Rulings: never bundled.
- Name: Bulk Brew, repo `bulk-brew`. An unrelated dormant repo shares the name; not a concern.
- Deckbuilding guidance from outside material is restated in our own words in `docs/guides/` and config, with no source names in the repo.
- Reference decks for tuning come from sources that allow automated download: MTGJSON's preconstructed decks (MIT) and 17lands' public draft data. Their names appear in the corpus fetch script and in the credits (the About screen and `ATTRIBUTION.md`), as Scryfall's do. Sites whose terms forbid automated access are not used, with one exception the owner decided on 2026-11-05: EDHREC, fetched developer-side at a gentle rate for learning in this personal, non-commercial, open-source project, credited with the other sources, with only derived numbers reaching the app. Commander Spellbook asks only for credit. Config learns numbers from the corpus; no third-party deck data ships in the app.
- Game Changers are not filtered out; bulk rarely holds many.

### Pool, decks, and settings

- Pools: one active pool. Multiple named pools are not planned.
- Copy limits: 4 for 60 and 40, 2 for 20, adjustable. 100 is singleton, not adjustable.
- Un-set cards: excluded by default, toggle in settings.
- Removing a deck asks Delete or Disassemble; only Disassemble returns its cards. A committed deck records `basicsTaken` when basics were tracked at commit time, so the return does not depend on the current setting. Pairing packets is a what-if view from a packet; Merge replaces both packets with one 40-card deck, whose basics return on disassembly only if both packets took them.
- Result actions: Accept (green) asks Confirm and remove the cards from the bulk list, Confirm and keep them there, or Decline; Back (red); Export (grey), there and on Decks, asks Copy as text, Download .txt, or Cancel. A kept deck (`committed: false`) shows "Cards in bulk list" on Decks and can be accepted later. Build in the sidebar while a built deck is open works like Back.
- Replace offers a basic land for a nonbasic land (owner decision, 2026-11-16). Its ranking weights are constants in `replace.ts`, not config: they only order a list the player picks from, and the builder never reads them.
- Appearance lives in `localStorage`, outside `Settings` and backups, so it applies before first paint and no settings format changed.
- The Analyze pane's search and the Build page's options each run in a Web Worker on a pack of only the pool's cards and basics, so no screen stalls on a build. The commander list's archetype checks still build on the main thread, one per tick.

### Display

- The app says archetype where the code and config say style (`style`, `secondary`, styleBonus). Labels can change freely; ids stay, so saved decks and eval results keep working.
- Deck scores stay internal: no strength number on screen or in builder notes, since raw scores invite the wrong comparisons. A score ranks options; it is not a measure of power.
- The deck list groups cards by exact type (creatures, planeswalkers, instants, sorceries, artifacts, enchantments, battles, lands), the same groups the Card types breakdown counts. A Commander deck lists its commander first in a group of its own; Card types still counts it under its type.
- Card detail in a deck view (a fresh build, a saved deck, a packet pairing) opens over the deck details, below the deck's header, so Accept, Back, and Export stay in view; a click on any header button closes it. The Bulk List keeps its own panel.
- Short display tags live in `config/display-tags.json`, matched with the roles' matcher format plus role and style references. They are for showing and filtering only; the builder never reads them, so they are not part of the config version a deck records.
- Plain-language card tags are the config's role and style labels, not raw Scryfall tags; the raw tags stay behind a disclosure.
- Near miss is a display label only: not viable, the size is buildable, and at most 3 cards short in total (`NEAR_MISS_SHORTFALL` in `packages/ui/src/data/analysis.ts`). The builder never reads it.

### Deckbuilding rules

- Land count: a formula from the curve and cheap mana sources, not a fixed number, so the mana base fits the spells the deck holds.
- Colors: one to five colors in every size; mono stays the strongest mode; more colors are allowed even though they build worse. Packet pairing stays.
- Finisher means a card that can end a Commander game at 40 life: an overrun, an extra combat, another way to win, a planeswalker costing five or more, a creature with seven or more power, an evasive or trampling one with five or more, or an evasive double striker. Only the 100-card template asks for finishers. The 60, 40, and 20-card templates ask for big threats (big bodies, big flyers, planeswalkers), the role id `finisher` kept so saved decks still read.
- One-color lands: only a land that adds nothing for the deck is worse than a basic. Entering tapped is no cost in itself; a dual that enters tapped stays out of a one-color deck because its second color does nothing there. Owner decisions, 2026-11-18.
- Tribes: a tribe is the primary style only under a commander whose own text names it (see Commander), as a theme of the rules with floors of 20 setup and 10 payoff cards at 100; elsewhere it is a secondary style. A secondary style needs a primary style; a second theme needs half its minimums, a shape can only follow a themed primary, and a tribe needs members and type payoffs (`builderWeights.secondary`, the classic builder's counts).
- Styles are kept: new styles are added beside the current ones, never replace them. The Build page only shows styles the pool can build, so a longer list costs nothing.
- The theme rules are a config file (`config/theme-rules.json`) that may read oracle text and type lines with regular expressions; a card counts once, as setup or as payoff, and a rider counts as nothing, because tags alone counted riders as setup and dual cards twice. Owner decision, 2026-11-11.
- A card gets credit for a job (a role, a theme job, strength, a land's utility, its place in a deck) only in a deck that supplies what that job depends on, for every card and every kind of dependency. An automated reader decides it from the card's rules text, which is strict and templated; the vocabulary and templates are config, the parsing is code, and it runs over every new set with no one in the loop. Agents do not tag cards, and no per-card data is written by hand except the few stubborn cards in `config/tag-overlay.json`. Owner decision, 2026-11-16.
- The commander counts once toward each role and theme job it does, as the rules count it, so the deck still works when the commander is off the table.
- 20-card packets: a packet is half of a 40-card deck, so a spell it cannot cast there is no candidate, and its theme works from its own cards (see Jumpstart packets), as the theme guide's 20-card rows say.

### The builder

- A requested style the pool cannot support gets a note that says what the pool lacks in plain words and then the nearest deck that can be built, labelled for what it is: never a best fit in disguise and never a bare error. `requireStyle` on a request means the player asked for the style. Owner decision, 2026-11-11.
- Best fit means the best deck. There is no target mix of styles; Aggro and Midrange being common from bulk is fine, and the other viable styles stay in the Build page's list below the first option. Owner decision, 2026-11-11.
- The best-fit style mix is reported, not gated. A skew that comes from a scoring artifact (such as a quality measure that penalizes the cheap creatures Aggro needs) is still a regression to fix.
- Speed is not a goal in itself. A build must stay well short of minutes; slower than that means a bad algorithm. Owner decision, 2026-11-11.
- One set of definitions: everything the grow builder serves, and everything the player sees of it (scan counts, style pickers, commander leads, Roles bars, reasons, Replace's jobs, key synergies, card tags), reads the theme rules, counted as the builder counts them. The `archetypes.json` matchers stay only for the classic builder's path.
- One plan picker: one score ranks the finished deck of every plan at every size, so best fit, the Build page's first option, and the Analyze pane agree card for card. A theme must beat the best plain shape by `picker.themeMargin`, not by richness noise.
- The classic builder stays only while requests reach it (secondary styles, and a thin pool's plain shape at 60, 40, and 100). It should not stay where the grow builder can do the job; once those requests move over, it goes with its swap search, the `archetypes.json` matchers, and the learned plan files. Owner decision, 2026-11-16.
- Learned plan data is retired for every grow path and every plan best fit compares, a commander's tribes included, and is not relearned; the files stay while the classic secondary styles read them. Owner decision, 2026-11-16.
- Builder changes ship on a blind panel of agents judging held-out pools (`docs/evaluation.md`), never on the builder's own counts. Theme counts from the rules are never evidence that a builder is better.
- Held-out pools are never opened, listed, or tuned on while building; only the panel reads them, and checks that print counts and style ids alone.
