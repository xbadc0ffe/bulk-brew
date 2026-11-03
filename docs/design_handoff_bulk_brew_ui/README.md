# Handoff: Bulk Brew interface (web and iPhone)

## Overview

Interface design for Bulk Brew (`xbadc0ffe/bulk-brew`). Players import a list of bulk Magic: The Gathering cards into a pool, see which archetypes each color can support, build mono-color 60, 40 or 20-card decks from the pool, then save, export and disassemble them. The design covers every screen in `docs/DESIGN_BRIEF.md` for the desktop web app (`apps/web`, left sidebar) and the iPhone app (`apps/mobile`, bottom tabs), plus a theme system: grey and the five Magic colors (W U B R G), each in light and dark.

## About the design files

`Bulk Brew UI.dc.html` is a design reference made in HTML, not production code. Open it in a browser with `support.js` beside it. It is a pan-and-zoom canvas with one row per screen.

Recreate the designs in the existing codebase with its own stack and patterns: React 19 and Tailwind 4, screens in `apps/web/src` and `apps/mobile/src`, shared pieces in `packages/ui`. Do not copy the inline styles or the design runtime. Per `docs/DESIGN_BRIEF.md`, keep the five screen ids (`import`, `pool`, `build`, `decks`, `settings`) and do not change `packages/core`. Follow the repo's `CLAUDE.md`: ask before adding a dependency or changing a config or settings format, and keep `npm run check` green at the end of each phase.

Every mockup has a badge id (1a to 1k, 2a) used below. Desktop frames are 1180×740 and iPhone frames 390×780. Frame borders, rounded frame corners and the fake status bar are presentation only. The design file's tweak props (`theme`, `accent`, `showArt`, `density`) preview the themes, card art and row density.

## Fidelity

High fidelity, static. Layout, type scale, spacing, color tokens and copy are final; match them closely with Tailwind utilities and the tokens in `tokens.css`. The mocks are not clickable, so behavior is described below. Card names, counts, archetype results and dates are sample data. Real values come from the core types in `packages/core/src/types.ts` (`Pool`, `ScanReport`, `ArchetypeReport`, `Deck`, `BuildExplanation`, `Settings`).

## What to build

- Primary layouts: 1a Import, 1b Pool, 1d Analysis, 1f Build, 1g Result, 1i Decks, 1j Settings, each with its iPhone version beside it. Desktop navigation is the left sidebar.
- Alternates, kept for reference until the owner picks: 1c Pool grouped by mana value with art on (a good model for the brief's art grid mode), 1e Analysis as an all-colors matrix for one deck size, 1h Result with the explanation above the list, 1k a desktop top bar instead of the sidebar.
- 2a shows all 12 themes.

Suggested order, one phase per `npm run check`:

1. Tokens, theme switching and mana pips.
2. Web shell, Pool and Import.
3. Analysis.
4. Build and Result.
5. Decks and Settings.
6. Mobile app.

## Theme system (2a)

- `<html data-mode="light|dark" data-theme="grey|W|U|B|R|G">`. Default: grey, light.
- Settings › Appearance: Light, Dark, System. System follows `prefers-color-scheme`, updates live, and sets `data-mode`.
- Settings › Theme color: Grey, White, Blue, Black, Red, Green. Independent of mode, so 12 combinations. Colorless is not a theme.
- Light themes are soft pastel surfaces with a saturated ink of the same hue. Dark themes have tinted surfaces with a light, saturated ink.
- Mana pip colors change with mode only, never with the theme color.
- Set `color-scheme` to match the mode so native controls and scrollbars follow (done in `tokens.css`).
- Apply both attributes before first paint to avoid a flash.
- `tokens.css` holds every value, ready for `apps/web/src/index.css` and `apps/mobile/src/index.css`, including a Tailwind `@theme inline` block so utilities like `bg-surface`, `text-fg-2`, `border-line`, `bg-ink text-on-ink` and `bg-pip-u` work.

## Global layout

### Desktop web

- Root: flex row, full viewport height, `canvas` background.
- Sidebar: 200px wide, `surface-2` fill, 1px right border `line`, padding 18px 12px, items stacked with a 2px gap.
  - "Bulk Brew" 15px/600, padding 4px 10px 16px.
  - Items in order: Pool, Import (indented), Analysis (indented), Build, Decks, Settings. 13px, padding 7px 10px, radius 6px, `fg-1`. Indented items: padding 6px 10px 6px 22px.
  - Active item: `ink` fill, `on-ink` text. When Import or Analysis is active, Pool shows in `ink` at weight 500 with no fill.
  - Footer pinned to the bottom: 11px `fg-3`, line-height 1.5, two lines: "Card data 2026-10-28" and "2,184 cards in pool". Keep the existing loading and error text here.
- Main pane: flex 1, min-width 0. Page title 20px/600. Usual padding 22px 32px (Pool list 22px 24px).
- Right panels: Pool card detail 300px, Result explanation 320px. Both `surface` with a 1px left border `line`.
- Narrower windows (not designed): below about 1024px, open the detail panel as an overlay; below 768px use the phone layout.

### iPhone

- Top: large title 22px/700 at left, optional trailing text action at 15px (Pool: "Import"; Decks: "Pair packets"). Pushed screens use a centered 16px/600 title, a back label at 15px `fg-1` ("‹ Pool"), and an optional trailing action.
- Tab bar: Pool, Build, Decks, Settings in four equal columns; `surface-2` fill, 1px top border `line`, 49pt of content plus the home indicator inset (mock: 84px total, padding 8px 8px 24px). Label 10.5px. Active: `ink`, weight 600, filled icon. Inactive: `fg-2`, outline icon. The 22px squares in the mock are icon placeholders; use small inline SVGs.
- Content side padding 16px. Grouped lists: `surface`, 1px `line`, radius 10px, rows at least 44px.
- Primary action: full width, 48px tall, radius 12px, `ink` fill, `on-ink` text, 15px/500. On pushed screens it sits in a bottom bar (padding 12px 16px 34px); above the tab bar it uses padding 8px 16px 10px.
- Import and Analysis live under Pool: Pool has a "Cards | Analysis" segmented control under the title, and the "Import" action pushes the Import screen.
- Card detail opens as a full-screen sheet (existing behavior).
- Sizes are for the default Dynamic Type size; honor the system text size (brief requirement).
- iPad (not designed): the mobile app's existing side rail from 768px can reuse the desktop layouts.

## Shared components

- **Mana pip** (restyle `packages/ui/src/ManaCost.tsx` and replace the placeholder `.mana` rules in `apps/web/src/index.css`): circle, 1px border `fg-3`, centered letter at weight 700. Sizes: 16px with a 9px letter (default), 15px with 8.5px (deck lists), 14px with 8px (phone color counts), 18 to 24px with 10 to 11px (color pickers, deck headers). Fills: `pip-w`, `pip-u`, `pip-b`, `pip-r`, `pip-g`, each with its `-fg` letter color. Generic and colorless symbols (`{2}`, `{X}`, `{C}`): `surface-2` fill, `fg-1` letter. Hybrid and Phyrexian symbols were not designed; keep the current fallback. The letter is always shown, so color is never the only signal.
- **Segmented control**: 1px `line-strong` border, radius 6px (phone 8px), segments divided by 1px `line-strong`. Desktop 12.5 to 13px, padding 6px 12px, or equal-width segments with 8px vertical padding when full width. Phone 13px, equal width, 7 to 9px vertical padding. Selected: `ink` fill, `on-ink` text. Unselected: `surface` fill, `fg-1` text.
- **Toggle**: desktop track 32×18, radius 9px, knob 14px inset 2px; phone track 40×24, knob 20px. On: `ink` track, knob right. Off: `line-strong` track, knob left. Knob `surface`.
- **Stepper**: "− | 4 | +" in a 1px `line-strong` box, radius 6px, dividers `line-strong`. Value mono 13px `ink`; − and + at 14px `fg-1`. Padding 3 to 5px vertical, 10 to 12px horizontal.
- **Buttons**. Primary: `ink` fill, `on-ink` text, 13px/500, padding 7px 16px, radius 6px. Secondary: `surface` fill, 1px `line-strong`, `ink` text, 13px, padding 7px 12px, radius 6px. Small secondary (inside rows): 12 to 12.5px, padding 5px 10px, radius 5px. Quiet: text only, `fg-1` or `fg-2`. Links: underlined `ink`.
- **Search field**: `surface`, 1px `line-strong`, radius 6px (phone 8px), padding 7px 10px (phone 9px 12px), 13px (phone 14px), placeholder `fg-3`.
- **Filter chip**: 12.5px, padding 6px 10px, radius 6px, 1px `line-strong`, `surface` fill, `fg-1` text, trailing "▾". Applied: `ink` fill and border, `on-ink` text, label includes the value and "✕" ("Type: Creature ✕").
- **Tag and badge**: 11.5px, padding 3px 8px (badge 2px 8px), radius 4px, `surface-2` fill, `fg-1` text.
- **Section label**: 11px uppercase, letter-spacing 0.04em, `fg-2`.
- **Table header**: 11px uppercase, letter-spacing 0.04em, `fg-2`, 1px bottom border `line`.
- **Row divider**: 1px `surface-2` (lighter than `line`). Selected row: `surface-2` fill.
- **Quantity**: mono 12px `fg-1`, tabular numbers.
- **Viability**: an 8px dot with a 1px `fg-2` border plus a label, never the dot alone. Viable: `ink` dot, label "Viable" in `ink`. Near miss: `fg-3` dot, label "Near miss" in `ink`. Not enough: hollow (`surface`) dot, label in `fg-3`. A detail line below at 11.5px `fg-2`: supporting counts when viable ("14 makers · 6 payoffs"), what is missing when near ("needs 3 more payoffs").
- **Mana curve chart**: buckets 0, 1, 2, 3, 4, 5, 6+. Equal-width bars, gap 6px (phone 5px), chart height 72px (phone 44px), `bar` fill, 2px top corners, height proportional to the tallest bucket. Desktop shows the count above each bar (10.5px `fg-1`); mana values sit below (10 to 10.5px `fg-2`).
- **Role bar**: grid of label (80px, `fg-1`), track (6px tall, radius 3px, `line` fill) and value (44px, mono 12px, right-aligned, "4/6"); 10px gap. Fill `ink`, width have/want capped at 100%.
- **Card thumbnail** (Show card art on): the Scryfall small image at a fixed height (30px in desktop rows, 42px in 1c, 86px in the detail header), width auto, radius 2 to 4px, `object-fit: contain`. Never crop, recolor or overlay the image.

## Screens

### 1a Import (Pool › Import)

Desktop: two equal columns, the left with a 1px right border `line`. Both padded 28px 32px with a 14px gap.

Left:
- "Import" title.
- Help, 13px `fg-1`, line-height 1.5: "Paste a decklist or collection export, or drop a text file. Accepted lines:" then three code chips (mono 12px, `surface-2`, padding 1px 5px, radius 3px): `4 Lightning Bolt`, `4x Lightning Bolt`, `4 Lightning Bolt (M10) 146`. CSV exports from ManaBox, Moxfield and Deckbox keep working as today.
- Paste box: fills the remaining height. `surface`, 1px `line-strong`, radius 8px, padding 12px 14px, mono 12.5px, line-height 1.7.
- Drop zone: 1px dashed `line-strong`, radius 8px, padding 14px, centered 13px `fg-2`: "Drop a .txt file here, or choose a file" ("choose a file" underlined `ink`; opens the picker with today's accept list).
- Footer row: live count at left, 12.5px `fg-1`: "14 lines · 46 cards · 0 unreadable". At right: segmented "Add to pool | Replace pool" and primary "Import".

Right, "Resolution report":
- Three stats, numbers 28px/600 with letter-spacing -0.02em, captions 12px `fg-2`: "43" cards resolved, "3" unresolved lines, "18" basics, not stored. The second and third numbers are `fg-1`.
- Section label "Unresolved", then a list in a `surface` box (1px `line`, radius 8px). Row grid: 34px quantity, flexible middle, auto actions; gap 12px; padding 10px 14px. The middle holds an editable text field with the raw name (1px `line-strong`, radius 5px, padding 5px 9px, 13px) and below it "Did you mean Grizzly Bears?" (12px `fg-1`, the suggestion underlined in `ink` and clickable). Actions: small secondary "Use suggestion" and quiet "Skip".
- Bottom right: secondary "Skip all unresolved", primary "Add 43 cards to pool".

iPhone: pushed from Pool ("‹ Pool", "Import", trailing "Paste" for the clipboard). Paste box 170px tall, radius 10px. Live count. Full-width "Add to pool | Replace pool". Stats at 22px with 11.5px captions ("resolved", "unresolved", "basics"). Unresolved rows stack: quantity and a 14px text field (padding 7px 10px, radius 6px), then "Did you mean …?" with "Use" (weight 500) and "Skip" (`fg-2`) at right. Bottom bar: primary "Add 43 cards to pool".

Behavior: the count updates while typing. "Import" resolves the text and fills the report. Editing a name re-resolves that line on Enter or blur; "Use suggestion" swaps the name; "Skip" drops the line. The final button adds the resolved cards. With "Replace pool" selected, label it "Replace pool with 43 cards" and confirm first. The current code adds immediately and reports afterwards; the design previews before adding.

### 1b Pool

Desktop: list column (flex 1, 1px right border) plus the 300px detail panel.

Header (padding 22px 24px 0, 14px gap):
- "Pool" with "2,184 cards · 1,312 unique" (13px `fg-1`). At right: "Unlimited basic lands" (12.5px `fg-1`) and a toggle; it is the same value as the Settings toggle.
- Color counts: W U B R G C pips (16px), each followed by its count, 12.5px `fg-1`, 18px apart.
- Filter bar: search field (flex 1, placeholder "Search name or text"), chips "Color ▾", "Type ▾" (shown applied as "Type: Creature ✕"), "Mana value ▾", "Tags ▾", and a quiet "Sort: Name ▾".

Table: columns 40px Qty, 1fr Name, 110px Cost, 190px Type, 1fr Tags; 12px gap; 24px side padding; header 12px below the filter bar. Rows 32px (density compact 28px, comfortable 44px; 38px with art on), 13px. Name weight 500, truncated with an ellipsis. Type `fg-1`, truncated. Tags 12px `fg-2`, comma-separated plain-language tags. The selected row has a `surface-2` fill. With art on, a 22×30 thumbnail sits before the name with an 8px gap. Keep the list virtualized (`useWindowedRows`).

Footer bar (padding 8px 24px, top border `line`, 12px `fg-2`): "Showing 612 creatures of 1,312 unique" at left; "Export pool · Backup · Clear pool" at right as quiet actions (Clear pool confirms).

Detail panel (padding 22px, 14px gap):
- Name 16px/600 (line-height 1.25), type line 12.5px `fg-1` ("Creature — Human Soldier · 1/2"; the dash is Scryfall data), mana pips. With art on, the whole card image (62×86 here; larger is fine) sits left of the name.
- Oracle text 13px, line-height 1.55, with a top border `line` and 12px top padding.
- Tags as tag chips ("makes tokens", "card draw", "artifact synergy").
- "Quantity" (13px `fg-1`) with a stepper, top border, 14px top padding.
- "In saved decks: 1 (Tokens, 40)" 12.5px `fg-2`.
- Bottom: full-width secondary "Remove from pool" (text `fg-1`).

iPhone: large title "Pool" with trailing "Import"; "Cards | Analysis" segmented (padding 0 16px 10px); color counts (14px pips, 12px counts, 10px apart); search field plus a "Filters · 1" button that opens a sheet with Color, Type, Mana value, Tags, Sort and the Unlimited basic lands toggle (sheet not drawn); a meta line 11.5px `fg-2` ("2,184 cards · 1,312 unique" left, "Name ▾" sort right). Rows on `surface`, at least 48px: 28px quantity, name (14px/500) over type (11.5px `fg-2`), pips at right; 10px gap. Tap opens the detail sheet.

1c (alternate): grouped by mana value. Group headers are 11px uppercase `fg-2` bars on `surface-2` with top and bottom borders ("Mana value 2" left, "7 cards" right). Rows: 30×42 thumbnail, 40px quantity, name over type, 90px cost, tags. Applied filter chip "Green ✕" and a "Group: Mana value ▾" chip.

### 1d Analysis (Pool › Analysis)

Desktop (padding 22px 32px, 16px gap):
- "Pool analysis" with "Scanned 2,184 cards · just now" at right (12.5px `fg-2`).
- Color tabs: pip, color name and candidate count (12px `fg-3`); 13px, padding 8px 14px 10px. Active tab: 2px `ink` bottom border, `ink` text. Inactive: `fg-1`. The tab row has a 1px bottom border `line`.
- Summary line, 13px `fg-1`, items 24px apart: "White · 402 candidates incl. 100 colorless", "Can build: 60, 40, 20" (sizes in `ink`, weight 500), "Creatures 188 · Removal 31 · Draw 14 · Ramp 2".
- Table on `surface` (1px `line`, radius 8px). Columns 1.3fr Archetype, then 1fr each for "60 cards", "40 cards", "20 Jumpstart". Header padding 9px 18px; rows at least 54px, padding 0 18px. Archetype cell: name 13.5px/500 over a description at 12px `fg-2` ("Go wide and pump the team"). Size cells: viability dot and label, then the detail line.
- Legend (12px `fg-2`): the three dot states with "Viable", "Near miss, what is missing shown", "Not enough cards". At right, the link "Build white →", which opens Build with that color selected.

Data: `ScanReport` and `ArchetypeReport` per color and size. If the report has no role totals for the summary line, drop that item.

iPhone: under the "Cards | Analysis" control, five equal color tiles (gap 6px, padding 8px 0, radius 8px; 18px pip over an 11px count). Selected tile: `surface` fill, 1px `ink` border; others: 1px `line`, no fill. A 12.5px summary ("White · 402 candidates · can build 60, 40, 20"). Rows on `surface`, padding 10px 16px: archetype name 14px/500 at left, three dots labeled 60, 40, 20 at right (11.5px `fg-1`, 10px apart), and a 12px `fg-2` note below ("Near miss at 60: needs 3 more payoffs.").

1e (alternate): one size at a time (segmented 60 | 40 | 20 at top right), archetypes as rows and the five colors as columns, each cell with dot, label and a short detail.

### 1f Build settings

Desktop: a 400px settings column (`surface`, 1px right border, padding 22px 24px, 20px gap) beside the result area. Before a build, the result area shows a centered 13px `fg-2` note: "Your deck appears here." and "White has 402 candidates and builds all three sizes."

- "Deck size": full-width segmented "60 | 40 | 20 Jumpstart", then one 12px `fg-2` line describing the size ("Casual constructed. Up to 4 copies of a card." for 60; write the 40 and 20 lines in the same voice).
- "Color": five tiles in a grid with a 6px gap. Tile: padding 10px 4px 8px, radius 6px, 22px pip, name 12px/500, status 10.5px `fg-2` with candidates and buildable sizes ("402 · 60/40/20"). Selected: 1px `ink` border, `surface` fill. Others: 1px `line`, no fill. Not drawn: a color that cannot build the selected size is dimmed to 55% and not selectable, and its status says so.
- "Style": radio list in a bordered box (radius 6px). Row grid: 16px radio, name 13px/500 over an 11.5px `fg-2` description, state 11px `fg-1` at right; padding 9px 12px; dividers `surface-2`. First row "Best fit" ("Let the builder pick the strongest style"), selected by default. Then viable archetypes for the chosen color and size ("Tokens", "Aggro", state "Viable"), then near misses at 55% opacity with what is missing as the description ("Needs 3 more payoffs", state "Near miss"). Near misses are not selectable. Radio: 14px circle, 1.5px `ink` border; selected fills `ink` with a 2px `surface` inner ring.
- "Max copies per card" (13px `fg-1`) with a stepper; defaults come from settings (60: 4, 40: 4, 20: 2).
- Primary button pinned to the bottom: full width, 40px tall, 14px/500, radius 6px, label built from the choices ("Build 60-card white deck").

iPhone: large title "Build"; the same sections stacked with a 16px gap: size control (radius 8px, padding 9px) and its helper line, color tiles (24px pips, 11px status, radius 8px), max copies row, then the style list (rows at least 44px, padding 8px 12px). Primary "Build 60-card white deck" sits above the tab bar. The result opens as a pushed screen.

Behavior: changing size or color refreshes tile statuses and the style list. Building takes under a couple of seconds; show "Building…" on the disabled button meanwhile.

### 1g Build result (also the saved deck view)

Desktop:
- Header bar (padding 16px 28px, bottom border `line`, `surface`): 20px pip, deck name 17px/600 ("White Tokens"), meta 12.5px `fg-1` ("60 cards · 24 lands · max 4 copies"), link "Edit settings" (12px `fg-1`, underlined; back to 1f with the settings kept). Actions at right, 8px apart: quiet "Remove from pool", secondary "Rebuild", secondary "Export ▾" (menu: Copy as text, Download .txt), primary "Save deck".
- Decklist (padding 20px 28px): type groups in a two-column grid (column gap 32px). Group header: 11px uppercase `fg-2` name with the count at right, 5px bottom padding, 1px bottom border `line`; 16px between groups. Card rows 26px: 22px mono quantity, name 13px followed by a why note (11.5px `fg-3`, 8px left margin: "token maker", "payoff", "removal", "filler"), pips (15px) at right. Groups: Creatures, Instants and sorceries, Enchantments and artifacts, Lands (basics as "23 Plains").
- Explanation panel (320px, padding 20px 22px, 18px gap, 13px):
  - "Archetype": name 14px/600, description `fg-1`, line-height 1.5.
  - "Mana curve": the chart, then the land reasoning in 12px `fg-1` ("24 lands: average cost 2.6, 2 cheap mana sources.").
  - "Roles": Removal 4/6, Card draw 3/4, Ramp 2/2, Finishers 3/2.
  - "Key synergies": one short paragraph each, 2px left rule `line-strong`, 10px left padding, line-height 1.45.
  - Bottom: "Show builder notes" (12px `fg-2`, underlined) expands `BuildExplanation.notes`, the debugging detail the brief asks to keep behind a disclosure.

iPhone: pushed screen ("‹ Build", "White Tokens", trailing "Export"). Meta chips (12px `fg-1` on `surface-2`, padding 4px 8px, radius 4px): "60 cards", "24 lands", "Tokens", "Still in pool". Segmented "Cards | Why it works"; the second tab stacks archetype, curve, roles, synergies and notes. Cards tab: a 44px curve, then groups with `surface-2` header bars (11px uppercase) and rows of at least 40px (22px quantity, name 14px over the why note at 11px `fg-3`, pips). Bottom bar: secondary "Rebuild" and primary "Save deck" (widths 1 : 1.4), 48px, radius 12px. "Remove from pool" was not drawn on iPhone; put it in the Export menu or a "…" menu.

Saved deck view: same layout. Actions per the brief: rename, export, copy, disassemble or delete. The badge shows whether the deck's cards left the pool.

### 1i Decks

Desktop (padding 22px 32px, 16px gap):
- "Decks" with "6 saved · 3 packets" (13px `fg-1`). At right: secondary "Pair packets", primary "New deck" (goes to Build).
- Table on `surface` (1px `line`, radius 8px). Columns: 28px color pip (18px), 1.6fr Name (13px/500), 70px Size (mono 12px `fg-1`), 1fr Archetype (`fg-1`), 120px Saved (12.5px `fg-2`: "Today", "Yesterday", "Oct 30"), 120px Pool (badge "Cards removed" or "Still in pool"), 220px actions ("Open" in `ink`, then "Export" and "Disassemble" in `fg-1`, 14px apart, right-aligned). Rows 44px, padding 0 18px, gap 12px.
- Note below (12.5px `fg-2`): "Disassemble deletes the deck and returns its cards to the pool. Delete without returning is under the deck's menu."

iPhone: large title "Decks" with trailing "Pair packets". Rows of at least 60px on `surface`: 20px pip, name 15px/500 over meta 12px `fg-2` ("60 · Tokens · Today"), badge (11px, padding 2px 7px) and a "›" chevron (18px `fg-3`). Swipe left for Export and Disassemble; the hint "Swipe a deck left to export or disassemble." sits below the list (12px `fg-2`).

Behavior: Disassemble confirms, returns the cards to the pool if they were removed, then deletes the deck. Pair packets (not drawn) follows the brief: pick two 20-card packets of different colors, see the combined 40-card list, copy or export it.

### 1j Settings

Desktop: two columns (1fr 1fr; 20px row gap, 40px column gap), padding 22px 32px, 13px text. Groups are `surface` boxes (1px `line`, radius 8px) with rows padded 11px 16px and `surface-2` dividers; secondary text inside rows is 11.5px `fg-2`.

Left column:
- "Building": "Max copies, 60-card" 4, "Max copies, 40-card" 4, "Max copies, 20-card packet" 2 (small mono fields: 1px `line-strong`, radius 5px, padding 3px 10px, 12.5px); "Unlimited basic lands" toggle on, "Basics need not be imported"; "Include Un-set and acorn cards" toggle off.
- "Display": "Show card art" toggle off, "Loads images from Scryfall as you browse"; "Appearance" segmented "Light | Dark | System" (12px, padding 3px 10px); "Theme color", "Tints the whole app toward one color", six 20px swatches 6px apart (Grey, White, Blue, Black, Red, Green). The selected swatch has a 2px `ink` ring; the others a 1px `line-strong` border. Mock swatch fills: grey uses `fg-2`; W `oklch(0.86 0.02 85)`, U `oklch(0.78 0.05 245)`, B `oklch(0.55 0.04 305)`, R `oklch(0.72 0.06 25)`, G `oklch(0.68 0.06 150)`. Give each swatch an accessible name.

Right column:
- "Card data": "Scryfall oracle cards · v1" over "2026-10-28 · 33,412 cards · 4.5 MB", small secondary "Check for updates". Real values come from the data pack.
- "Backup": "Export backup" ("Pool, decks and settings as one file") with "Export"; "Restore from backup" with "Choose file"; "Clear all data" (`fg-1`) with "Clear", which confirms.
- "About" (12.5px `fg-1`, line-height 1.6, 8px between paragraphs): "Bulk Brew 0.1.0 · MIT License · Source on GitHub" (link underlined), then the Fan Content Policy and Scryfall notices. Take the notice wording from `ATTRIBUTION.md`, which is the source of truth; do not edit that file.

iPhone: grouped lists with 11px uppercase labels and 12px gaps. "Building": Max copies ("60: 4 · 40: 4 · 20: 2 ›" 13px `fg-2`, pushes a screen with three steppers), Unlimited basic lands, Include Un-set cards, Show card art (40×24 toggles). "Card data": "Scryfall data v1" over "2026-10-28 · 33,412 cards", then "Check for card updates ›" (with progress and result, per the brief). "Backup": Export backup ›, Restore from backup ›, Clear all data. "About": the notices at 12px `fg-1`, line-height 1.55. Appearance and Theme color were not drawn on iPhone; add a "Display" group with an "Appearance ›" row that pushes a screen with the same segmented control and swatches.

Settings apply immediately; there is no Save button. Use one label for the Un-set setting on both platforms.

### 1k Navigation alternate

A 48px top bar on `surface` with a bottom border: "Bulk Brew" (15px/600), then tabs Pool, Build, Decks, Settings (13px, padding 0 12px; active has a 2px `ink` underline and weight 500), and at right "2,184 cards · data 2026-10-28" (12px `fg-3`). Pool uses a "Cards | Analysis | Import" segmented control next to its title.

## Interactions and behavior

- Desktop nav: sidebar items switch screens. Import keeps screen id `import`; Analysis is a sub-view of `pool` (for example `poolView: 'cards' | 'analysis'`), so the five ids stay.
- Pool: clicking a row selects it and fills the detail panel. The stepper edits quantity; "Remove from pool" removes every copy. Filters: Color (W U B R G, colorless, multicolor), Type, Mana value (0 to 6+), Tags (plain-language labels from `CardRecord.tags`); several can apply at once. Sort: name, mana value, color, quantity (`POOL_SORTS`).
- Analysis: tabs switch color; "Build {color} →" opens Build with that color.
- Result: Rebuild runs the builder with another style (today's "Try another style"); the builder is deterministic, so the same settings give the same deck. "Edit settings" returns to the form.
- Decks: Open shows the deck in the 1g layout.
- Confirmations: Replace pool, Clear pool, Clear all data, Restore from backup, Disassemble.
- Keyboard (desktop, suggested, not drawn): "/" focuses search, arrow keys move the row selection, Enter opens detail, Escape closes it.
- Hover and focus (not drawn, suggested): rows and secondary buttons hover to `surface-2`; primary buttons at 90% opacity; a visible 2px `ink` focus ring with a 2px offset on every control.

## States not designed yet

The brief asks for empty, loading and error states on every screen. None are drawn. Minimal suggestions in the same style, to confirm with the owner:
- Empty pool: centered 13px `fg-2` text ("Your pool is empty. Import a list to start.") and a primary "Import". Empty decks: the same pattern with "Build a deck".
- Card data loading: sidebar footer "Loading card data"; lists show a short `fg-2` line in place of rows.
- Card data error: the existing message at the top of the screen, `ink` text on `surface-2`, with a retry action.
- Import with nothing resolved, Build with no viable style, restore failure: inline 13px messages next to the action.

## State management

Existing: `useAppState()` provides `index`, `pool`, `pack`, `settings`, `decks`, `detail` and `config`; `useImport` and `useWindowedRows` already cover import and list windowing. New UI state:
- `poolView`: 'cards' | 'analysis'. Pool filters: search, colors[], types[], manaValues[], tags[], sort. Selected card id (the existing `detail` store).
- Analysis: selected color (and size for 1e).
- Import: text, mode ('add' | 'replace'), report, per-line edits and skips.
- Build form: size (60 | 40 | 20), color, style ('best' or an archetype id), maxCopies. Build result: `Deck` plus `BuildExplanation`, saved or not, committed or not.
- Appearance: mode ('light' | 'dark' | 'system') and theme ('grey' | 'W' | 'U' | 'B' | 'R' | 'G'). See open decisions for where to store it.

## Design tokens

### Color roles

CSS variable, then the Tailwind color name from `tokens.css`:
- `--bg` (`canvas`): app background, main panes.
- `--surface` (`surface`): tables, inputs, panels, unselected segments, toggle knobs.
- `--surface2` (`surface-2`): sidebar, tab bar, selected row, group headers, tags, row dividers.
- `--border` (`line`): panel and table borders, role-bar track.
- `--border2` (`line-strong`): inputs, buttons, segmented controls, drop zone, off toggle track.
- `--ink` (`ink`): primary text, primary button fill, selected states, viable dot, role-bar fill.
- `--on-ink` (`on-ink`): text on `ink`.
- `--text1` (`fg-1`): secondary text: type lines, meta, unselected controls.
- `--text2` (`fg-2`): labels, captions, section labels.
- `--text3` (`fg-3`): placeholders, disabled text, pip outlines, near-miss dot.
- `--bar` (`bar`): mana curve bars.
- `--pip-w`, `--pip-u`, `--pip-b`, `--pip-r`, `--pip-g` and their `-fg` letters (`pip-w`, `pip-w-fg`…): mana symbols. They change with mode only.

### Values

Use the oklch values in CSS. Hex values are sRGB conversions for reference and for native code later.

#### Light

| Token | Grey | White | Blue | Black | Red | Green |
| --- | --- | --- | --- | --- | --- | --- |
| `--bg` (canvas) | `#f0f0f0`<br>0.955 0 0 | `#faefd6`<br>0.955 0.035 88 | `#d6f5ff`<br>0.955 0.045 240 | `#f3ecff`<br>0.955 0.03 300 | `#ffe4dd`<br>0.955 0.05 30 | `#dcf9e1`<br>0.955 0.045 150 |
| `--surface` (surface) | `#fafafa`<br>0.985 0 0 | `#fffaed`<br>0.985 0.018 88 | `#edfdff`<br>0.985 0.022 240 | `#fbf8ff`<br>0.985 0.015 300 | `#fff4f0`<br>0.985 0.025 30 | `#f0fff2`<br>0.985 0.022 150 |
| `--surface2` (surface-2) | `#e6e6e6`<br>0.925 0 0 | `#f2e5c7`<br>0.925 0.042 88 | `#c7ecff`<br>0.925 0.054 240 | `#eae1fb`<br>0.925 0.036 300 | `#ffd8cf`<br>0.925 0.06 30 | `#cef1d4`<br>0.925 0.054 150 |
| `--border` (line) | `#d4d4d4`<br>0.87 0 0 | `#dfd3b8`<br>0.87 0.039 88 | `#b7d9f2`<br>0.87 0.05 240 | `#d7d0e7`<br>0.87 0.033 300 | `#f6c8bf`<br>0.87 0.055 30 | `#bedec3`<br>0.87 0.05 150 |
| `--border2` (line-strong) | `#b7b7b7`<br>0.78 0 0 | `#c1b79f`<br>0.78 0.035 88 | `#9ebcd2`<br>0.78 0.045 240 | `#bab3c8`<br>0.78 0.03 300 | `#d6aca5`<br>0.78 0.05 30 | `#a4c0a8`<br>0.78 0.045 150 |
| `--ink` (ink) | `#484848`<br>0.4 0 0 | `#5f4a0c`<br>0.42 0.08 88 | `#004d8a`<br>0.4 0.14 240 | `#4f3b71`<br>0.4 0.09 300 | `#8a0700`<br>0.4 0.16 30 | `#005a1c`<br>0.4 0.13 150 |
| `--on-ink` (on-ink) | `#fafafa`<br>0.985 0 0 | `#fffaed`<br>0.985 0.018 88 | `#edfdff`<br>0.985 0.022 240 | `#fbf8ff`<br>0.985 0.015 300 | `#fff4f0`<br>0.985 0.025 30 | `#f0fff2`<br>0.985 0.022 150 |
| `--text1` (fg-1) | `#484848`<br>0.4 0 0 | `#504732`<br>0.4 0.035 88 | `#314b5e`<br>0.4 0.045 240 | `#4a4456`<br>0.4 0.03 300 | `#603d38`<br>0.4 0.05 30 | `#364f3b`<br>0.4 0.045 150 |
| `--text2` (fg-2) | `#636363`<br>0.5 0 0 | `#6b624f`<br>0.5 0.032 88 | `#4e6779`<br>0.5 0.041 240 | `#656071`<br>0.5 0.027 300 | `#7b5a54`<br>0.5 0.045 30 | `#536a57`<br>0.5 0.041 150 |
| `--text3` (fg-3) | `#868686`<br>0.62 0 0 | `#8d8673`<br>0.62 0.028 88 | `#738a9a`<br>0.62 0.036 240 | `#888393`<br>0.62 0.024 300 | `#9d7e78`<br>0.62 0.04 30 | `#778d7b`<br>0.62 0.036 150 |
| `--bar` (bar) | `#808080`<br>0.6 0 0 | `#8e7f59`<br>0.6 0.056 88 | `#4388b5`<br>0.6 0.098 240 | `#8678a1`<br>0.6 0.063 300 | `#ba6457`<br>0.6 0.112 30 | `#569063`<br>0.6 0.091 150 |

#### Dark

| Token | Grey | White | Blue | Black | Red | Green |
| --- | --- | --- | --- | --- | --- | --- |
| `--bg` (canvas) | `#1f1f1f`<br>0.24 0 0 | `#281e03`<br>0.24 0.045 88 | `#00223d`<br>0.24 0.07 240 | `#231933`<br>0.24 0.05 300 | `#3d0a05`<br>0.24 0.08 30 | `#00280b`<br>0.24 0.07 150 |
| `--surface` (surface) | `#2a2a2a`<br>0.285 0 0 | `#33290d`<br>0.285 0.045 88 | `#002d49`<br>0.285 0.07 240 | `#2e243f`<br>0.285 0.05 300 | `#4a1710`<br>0.285 0.08 30 | `#083316`<br>0.285 0.07 150 |
| `--surface2` (surface-2) | `#353535`<br>0.33 0 0 | `#403414`<br>0.33 0.05 88 | `#003959`<br>0.33 0.077 240 | `#3a2f4d`<br>0.33 0.055 300 | `#5a2018`<br>0.33 0.088 30 | `#10401f`<br>0.33 0.077 150 |
| `--border` (line) | `#454545`<br>0.39 0 0 | `#4f4428`<br>0.39 0.045 88 | `#1c4967`<br>0.39 0.07 240 | `#493f5c`<br>0.39 0.05 300 | `#69332a`<br>0.39 0.08 30 | `#264f30`<br>0.39 0.07 150 |
| `--border2` (line-strong) | `#5d5d5d`<br>0.48 0 0 | `#685c40`<br>0.48 0.045 88 | `#366381`<br>0.48 0.07 240 | `#625776`<br>0.48 0.05 300 | `#854b42`<br>0.48 0.08 30 | `#3f6948`<br>0.48 0.07 150 |
| `--ink` (ink) | `#c4c4c4`<br>0.82 0 0 | `#dac288`<br>0.82 0.08 88 | `#63cfff`<br>0.82 0.14 240 | `#c6b1f0`<br>0.8 0.09 300 | `#ff9985`<br>0.82 0.16 30 | `#83dc97`<br>0.82 0.13 150 |
| `--on-ink` (on-ink) | `#1b1b1b`<br>0.22 0 0 | `#231900`<br>0.22 0.045 88 | `#001d37`<br>0.22 0.07 240 | `#1e142e`<br>0.22 0.05 300 | `#370502`<br>0.22 0.08 30 | `#002307`<br>0.22 0.07 150 |
| `--text1` (fg-1) | `#cacaca`<br>0.84 0 0 | `#cfcabe`<br>0.84 0.018 88 | `#bbcddb`<br>0.84 0.028 240 | `#ccc8d6`<br>0.84 0.02 300 | `#dfc3be`<br>0.84 0.032 30 | `#bed0c1`<br>0.84 0.028 150 |
| `--text2` (fg-2) | `#ababab`<br>0.74 0 0 | `#b1aa9b`<br>0.74 0.022 88 | `#98aebf`<br>0.74 0.035 240 | `#ada8b9`<br>0.74 0.025 300 | `#c3a29c`<br>0.74 0.04 30 | `#9cb19f`<br>0.74 0.035 150 |
| `--text3` (fg-3) | `#868686`<br>0.62 0 0 | `#8d8674`<br>0.62 0.027 88 | `#708a9d`<br>0.62 0.042 240 | `#898296`<br>0.62 0.03 300 | `#a17c75`<br>0.62 0.048 30 | `#758e79`<br>0.62 0.042 150 |
| `--bar` (bar) | `#929292`<br>0.66 0 0 | `#a1916b`<br>0.66 0.056 88 | `#559ac8`<br>0.66 0.098 240 | `#988ab4`<br>0.66 0.063 300 | `#ce7769`<br>0.66 0.112 30 | `#68a274`<br>0.66 0.091 150 |

#### Mana pips

| Pip | Light fill | Light letter | Dark fill | Dark letter |
| --- | --- | --- | --- | --- |
| W | `#fdf5df`<br>0.97 0.03 90 | `#494230`<br>0.38 0.03 90 | `#f1e7ce`<br>0.93 0.035 90 | `#322e22`<br>0.3 0.02 90 |
| U | `#a8d8fb`<br>0.86 0.07 240 | `#003151`<br>0.3 0.08 240 | `#5eade2`<br>0.72 0.11 240 | `#001321`<br>0.18 0.04 240 |
| B | `#4b435a`<br>0.4 0.04 300 | `#f3f0f8`<br>0.96 0.01 300 | `#514765`<br>0.42 0.05 300 | `#ede8f7`<br>0.94 0.02 300 |
| R | `#f7a597`<br>0.8 0.1 30 | `#5b1810`<br>0.32 0.1 30 | `#df6a59`<br>0.66 0.15 30 | `#1b0604`<br>0.16 0.04 30 |
| G | `#8ec899`<br>0.78 0.09 150 | `#063215`<br>0.28 0.07 150 | `#4a9a5e`<br>0.62 0.12 150 | `#011205`<br>0.16 0.04 150 |

Generic and colorless pips use `surface-2` with an `fg-1` letter.

### Contrast

WCAG contrast ratios computed from the values above. "low" marks text pairs under 4.5:1.

| Theme | ink on canvas | ink on surface | fg-1 on surface | fg-1 on surface-2 | fg-2 on surface | fg-3 on surface | on-ink on ink |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grey light | 8.1 | 8.8 | 8.8 | 7.4 | 5.7 | 3.5 low | 8.8 |
| White light | 7.5 | 8.1 | 8.8 | 7.4 | 5.7 | 3.5 low | 8.1 |
| Blue light | 7.6 | 8.3 | 8.7 | 7.3 | 5.7 | 3.5 low | 8.3 |
| Black light | 8.3 | 9.1 | 8.9 | 7.4 | 5.8 | 3.5 low | 9.1 |
| Red light | 8.3 | 9.3 | 8.7 | 7.2 | 5.7 | 3.4 low | 9.3 |
| Green light | 7.6 | 8.2 | 8.7 | 7.4 | 5.7 | 3.5 low | 8.2 |
| Grey dark | 9.4 | 8.2 | 8.8 | 7.5 | 6.2 | 3.9 low | 9.9 |
| White dark | 9.4 | 8.2 | 8.8 | 7.5 | 6.2 | 3.9 low | 9.9 |
| Blue dark | 9.2 | 8.1 | 8.7 | 7.4 | 6.2 | 3.9 low | 9.7 |
| Black dark | 8.7 | 7.6 | 8.9 | 7.6 | 6.3 | 4.0 low | 9.1 |
| Red dark | 8.1 | 7.1 | 9.0 | 7.7 | 6.3 | 4.0 low | 8.5 |
| Green dark | 9.7 | 8.4 | 8.7 | 7.3 | 6.2 | 3.9 low | 10.2 |

| Pip letter on fill | W | U | B | R | G |
| --- | --- | --- | --- | --- | --- |
| Light | 9.2 | 8.8 | 8.3 | 6.8 | 7.4 |
| Dark | 11.1 | 7.7 | 7.2 | 5.9 | 5.6 |

### Known issues to resolve

- `fg-3` is under 4.5:1 on `surface`, yet the mock uses it for some readable text: the per-card why notes in the result, the sidebar footer, color tab counts in Analysis, and "Not enough" labels. Use `fg-2` there, or raise `fg-3` contrast. Placeholders, disabled controls and pip outlines can stay `fg-3`.
- `ink` and `fg-1` have the same lightness in light mode (identical in grey light), and `fg-1` is slightly lighter than `ink` in dark mode, so primary and secondary text differ by weight and hue more than by tone. If that reads flat in code, split `ink` into a text color and an accent color; that changes the look, so check with the owner first.
- The iPhone About text in the mock is shortened. Use the full notices from `ATTRIBUTION.md` on both platforms.

### Typography

System fonts only (no external fonts, per the brief).
- Sans: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`
- Mono (quantities, paste box, stepper values, code chips): `ui-monospace, Menlo, monospace`

| Use | Size / weight |
| --- | --- |
| Import stats | 28px / 600, letter-spacing -0.02em (phone 22px) |
| Phone large title | 22px / 700 |
| Desktop page title | 20px / 600 |
| Result deck name | 17px / 600 |
| Detail card name, phone nav title | 16px / 600 |
| Sidebar app name | 15px / 600 |
| Phone buttons, nav actions, deck names | 15px (primary and names 500) |
| Phone rows, search | 14px (card names 500) |
| Analysis archetype names | 13.5px / 500 |
| Desktop body, rows, buttons | 13px (card and deck names 500, primary buttons 500) |
| Secondary text, paste box | 12.5px |
| Captions, tag columns, quantities | 12px |
| Descriptions, tags, small captions | 11.5px |
| Section labels, table headers | 11px uppercase, letter-spacing 0.04em |
| Sidebar footer | 11px |
| Phone tab labels | 10.5px (active 600) |
| Pip letters | 9px / 700 on 16px pips |

Line heights: normal unless noted. Help text 1.5, oracle text 1.55, About 1.6, paste box 1.7, synergies 1.45.

### Spacing, radii, borders

- Spacing in px: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32.
- Radii: 2px thumbnails and bar tops; 3px code chips; 4px tags and badges; 5px small fields and row buttons; 6px buttons, inputs, segmented controls, nav items and tiles; 8px boxes and tables (phone segmented controls, tiles and search); 10px phone groups and paste box; 12px phone primary buttons. Pips and dots are circles.
- Borders: 1px everywhere; 1.5px radio outline; 2px active tab underline, synergy rule and selected swatch ring.
- Shadows: none.

## Assets

None to bundle. Tab and menu icons in the mocks are placeholders; draw small inline SVGs (no icon library without asking). Card images load from Scryfall through `imageUrl()` and `printingImageUrl()` in `packages/core/src/images.ts`. Mana symbols are CSS circles with letters.

## Files

- `Bulk Brew UI.dc.html`: all mockups. Open in a browser with `support.js` beside it.
- `support.js`: runtime for the design file only; not for the app.
- `tokens.css`: theme tokens and the Tailwind mapping for `apps/web/src/index.css` and `apps/mobile/src/index.css`.

## Where the designs land in the repo

| Design | Repo files |
| --- | --- |
| Shell, sidebar, tab bar | `apps/web/src/App.tsx` (`Shell`), the mobile shell in `apps/mobile/src` |
| Tokens, themes, pips | `apps/web/src/index.css`, `apps/mobile/src/index.css`, `packages/ui/src/ManaCost.tsx` |
| 1a Import | `ImportScreen` in `apps/web/src/screens.tsx` |
| 1b Pool and detail | `PoolScreen` in `apps/web/src/screens.tsx`; `CardDetail`, `CardImage` in `packages/ui` |
| 1d Analysis | new Pool sub-view reading `ScanReport` |
| 1f, 1g Build and Result | `apps/web/src/screens/BuildScreen.tsx`; deck view and curve bars in `packages/ui` |
| 1i Decks | `apps/web/src/screens/DecksScreen.tsx` |
| 1j Settings | `apps/web/src/screens/SettingsScreen.tsx` |

The mobile app mirrors these in `apps/mobile/src`.

## Open decisions for the owner

1. Result actions. The design has separate "Save deck" and "Remove from pool" actions, per the owner's brief for this design, while today's code has Accept (save and remove) and Discard. Suggested: Save keeps the deck with its cards still in the pool; Remove from pool saves it if needed and removes its cards (the `committed` flag); drop Discard, since leaving the screen discards an unsaved build.
2. Where appearance lives. Mode and theme color are new settings. Storing them in the app's key-value store avoids touching `packages/core` and `config/settings.defaults.json`; adding them to `Settings` changes a settings format, which `CLAUDE.md` says to ask about first.
3. Which alternates (1c, 1e, 1h, 1k), if any, replace the primaries.
4. Empty, loading and error states (see above).
