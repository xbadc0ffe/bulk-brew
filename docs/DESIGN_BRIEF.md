# Bulk Brew: Design Brief

For the interface design pass. Everything under the interface is shared and already specified in `SPEC.md`; this brief covers what people see and do.

The design pass is done (milestone 7b), followed by an owner review. Where the shipped app differs from this brief, `SPEC.md` wins. Most notably: the pool is shown as the Bulk List, with Import as its subpage; a fresh build offers Accept (with a confirmation), Reject, and Export instead of Try another style and Discard; and two packets pair from a packet's view, with a Merge that replaces them. The design handoff that guided the pass, with the unbuilt alternates, is in `docs/design_handoff_bulk_brew_ui/`.

## The product in one paragraph

A Magic: The Gathering player has a box of bulk cards. They paste a list of those cards into Bulk Brew, pick a deck size and a color, and get a playable mono-color deck built from what they own, with a short explanation of why it works. They accept it, the cards leave the pool, and they build the next one. Decks come in 60, 40, and 20-card sizes; two 20-card packets combine into a two-color 40-card deck, like the Jumpstart product. Everything runs on the device with no account.

## Audience and tone

Casual and kitchen-table players, people who draft a lot and have piles of commons and uncommons, parents and friends building starter decks, and anyone who wants to turn bulk into games. Assume they know what a mana curve is but not what a "role quota" is. Tone is friendly and plain. User-facing copy uses no em-dashes.

## Two apps, one core

| App    | Where it runs                                                 | Layout intent                                                                                                      |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Web    | Desktop browser, GitHub Pages; also usable on a phone browser | Multi-pane. Pool list beside card detail; build settings beside the result; keyboard friendly.                     |
| Mobile | iPhone and iPad through Capacitor                             | Phone: single column with a bottom tab bar and sheets. iPad: split view, pool list plus detail, build plus result. |

Both are React 19 with Tailwind 4. Shared presentational pieces live in `packages/ui`; app-specific layouts live in `apps/web/src` and `apps/mobile/src`. The five screen ids in each app's `App.tsx` (import, pool, build, decks, settings) are the information architecture; keep them. Do not change `packages/core`.

Both apps support light and dark mode. No external fonts, CDNs, or trackers; everything is bundled. Mana and card symbols are Scryfall's symbol images, bundled with the apps.

### Look

- Web sidebar: square tiles with a simple outline icon over the label (Bulk List: two stacks of cards with a third in front, seen from an angle; Build: three fanned cards; Decks: one stack; Settings: a gear; About: an info mark), all drawn at about the same size. The app name, version, and a large app icon sit at the bottom.
- The app icon comes in a light and a dark version; the sidebar and the browser tab show the one for the current mode.
- Labels with a detail line under them are bold, and the detail line is not; section labels are bold too.
- Light themes: colored text is dark, box fills are close to white with a faint tint of the theme color. Dark themes: the background and sidebar are very dark, boxes are lighter, colored text is light.
- Outlines of boxes, buttons, tiles, fields, and tag bubbles are two pixels. Faint separators between list rows stay at one pixel. Fixed-height rows leave room for a whole bubble, so none is cut.

## Screens

### Import

- A text area for pasted decklists. On the web, text files dropped on the box, or chosen from the link in its empty-state hint, go below what is already there, several at once; mobile offers paste from clipboard and a file picker.
- Live feedback while typing: lines read, total cards, unreadable lines.
- A choice: add to the pool or replace the pool.
- After import: a resolution report. Resolved count, and an unresolved list where each line can be fixed with suggestions ("did you mean") or skipped.
- Help text showing the accepted formats: `4 Lightning Bolt`, `4x Lightning Bolt`, `4 Lightning Bolt (M10) 146`.

### Pool

- Summary header: total cards, cards per color, and a teaser of which colors can build which deck sizes.
- A list (or grid when art is on) of cards with quantity, name, mana cost, type, and color. Thousands of rows are normal, so the list must be virtualized and searchable.
- Filters: color, type, mana value, text search. Sort by name, mana value, color, quantity.
- Card detail: image when art is on, oracle text, type line, tags in plain language ("removal", "makes tokens"). Edit quantity, remove.
- Actions: Select to remove several cards. Export, backup, and clearing live on Settings.
- Analyze (web): a blue button with a soft glow opens a pane under the list. Recommended decks for Commander, 60, 40, and 20 (five each, name and colors only, found by a background search that keeps going while the pane is open, with a max colors per deck choice under the heading); picking one opens it on the Build page. Then a color pie with a legend and a second pie counting multicolor cards in each of their colors, spells by color and mana value with color rows that chart picked colors as bars, and shaded by-color tables for card types, roles, creature types, and subtypes.
- Empty state that leads to Import.

### Build

Settings on the left, deck options on the right (desktop; phones keep a single build until parity).

- Deck size: 100 (Commander), 60, 40, 20, with one line describing the selected size. Phones offer 60, 40, and 20 until parity.
- In order: a rarities drop-down with a checkbox per rarity, max copies per card (at 100, the stepper held at 1), and infinite basics.
- Colors: five toggles, any number picked, each showing how many cards of that color the pool has. At 100 they filter the commander list instead and count the commanders with each color; once a commander is picked they show its colors, with a line saying the colors come from the commander and that changing a setting returns to the commander list.
- Primary archetype drop-down: best fit by default, then the archetypes any subset of the picked colors can build, with viability labels; near misses show what is missing and cannot be picked. Secondary archetype drop-down, unlocked by a primary archetype.
- Options: cards ranked strongest first in as many columns as fit, each with the deck's name and description, a color wheel with each color's share, the mana curve, copies per card type, role coverage, a mana warning when a color is stretched, and the top synergy. No strength number is shown. They arrive one by one with a progress line; picking one opens the deck view with Accept (green), Back (red), and Export (grey). Accept asks Confirm and remove the cards, Confirm and keep them in the bulk list, or Decline.
- Commander (100): before a commander is picked, the right side lists the commanders in the pool in tiers (top, good, possible) as card-shaped tiles: the card's text laid out like a card, or its image when card art is on, then the deck it leads, the pool cards in its colors, and its mana. Picked colors narrow the list. A picked primary archetype keeps the commanders that lead it and regroups them as Can build, Checking your bulk list, and Not enough cards, with a progress line while tiles move between groups. The picked commander stays in a pane to the right of its deck options, with a red Change Commander button the size of Accept and Back. Changing any build setting while a commander is picked returns to the commander list.
- Empty and failure states: no colors picked; no commanders in the pool; no commanders in the picked colors or leading the picked archetype; no decks meet the settings, each with a Clear settings button where there is something to clear.

### Deck result and deck view

The same view serves a fresh build and a saved deck.

- Decklist grouped by type with counts; basics listed by color. Mana costs shown as symbols.
- Mana curve as a small bar chart. Land count with its reasoning in one line ("24 lands: average cost 2.9, 3 cheap mana sources").
- Explanation panel: archetype and what it does, role coverage against targets (removal 6 of 6, card draw 3 of 4) led by the archetype's own cards (Voltron enablers 13 of 13), key synergies in plain words, notes.
- Each card can reveal "why this card": the role or synergy slot it filled, or that it is filler.
- Actions on a fresh build: Accept (saves and removes cards from the pool), Try another style, Discard, Export, Copy.
- Actions on a saved deck: click the name to rename it; Export, a popup with Copy as text, Download .txt, or Cancel; a red Remove that asks Delete (cards stay out of the pool), Disassemble (cards go back), or Cancel.
- A badge shows whether the deck's cards were removed from the pool.

### Decks

- List of saved decks: name, size, color, archetype, date, committed badge.
- Open a deck in the deck view.
- Pair packets: pick two 20-card packets of different colors and export the combined 40-card list.
- Empty state that leads to Build.

### Settings

- Include Un-set cards. Show card art. Copy limits and basics are set on Build. Labels are bold; the detail line under them is not. Switches are large without making rows taller.
- Card data: version date, and on mobile a "check for card updates" action with progress and result.
- Your data: Export asks Mass export (Bulk list, Decks, Both, Cancel), then JSON or TXT; Restore from backup asks Bulk list, Decks, or Both, then the file; reset settings to defaults; a red Clear all data (confirm).
- About: app version, the Fan Content and Scryfall notices from `ATTRIBUTION.md`, license, link to the repo.

## Flows

1. **First run**: empty pool, Import is the obvious first step, then Build, then Accept, then Build again.
2. **Unresolved cards**: the report lists them; the user fixes names inline or skips; the pool updates.
3. **Build loop**: build, review the explanation, accept or rebuild with another style, repeat until the color runs dry. The Build screen should make it clear what is left.
4. **Delete deck**: confirm, with the option to return the cards to the pool.
5. **Pair packets**: choose two packets, see the combined list, export.
6. **Card data update** (mobile): check, download, apply, show the new version date.
7. **Backup and restore**: export a file, import it later on another device.

## Data the interface consumes

All types are in `packages/core/src/types.ts`.

- `CardRecord`: name, mana cost, mana value, type line, oracle text, colors, types, tags, image id.
- `Pool` and `PoolEntry`: card id, quantity, optional printing hint for art.
- `Deck` and `DeckCard`: cards, basics by color, archetype, committed flag.
- `BuildExplanation`: archetype, curve, roles with have and want, land reasoning, synergies, notes.
- `ScanReport` and `ArchetypeReport`: per color and size, which archetypes are viable and how close the near-misses are.
- `Settings`: copy limits, basics, Un-sets, art.

Image URLs come from `imageUrl()` and `printingImageUrl()` in `packages/core/src/images.ts`.

## Constraints

- Card art is off by default and everything must work as text. Art, when on, loads from Scryfall on demand and must be shown whole and unchanged: no cropping, recoloring, or marks drawn into it. The only thing laid over a card is the small turn-over button on a two-sided card's right edge, away from the artist credit and copyright line. Clicking the art in the card detail opens it full screen, where the wheel, + and − buttons, or a pinch zoom it and a drag moves it. Art crops, if ever used, need the artist name beside them.
- No user data leaves the device. There is no sign-in and no sync.
- Pools can hold thousands of cards; lists must stay fast.
- Color is never the only signal; pair it with mana symbols or labels. Meet contrast guidelines in both themes. Mobile tap targets are at least 44 points and text respects the system text size.
- The deck view is also the builder's debugging output, so the explanation must be able to show more detail without clutter, for example behind a disclosure.

## Deliverables

- Layouts and components for both apps, as React and Tailwind code in the paths above, or as mockups the implementation can follow.
- A small design token set (colors, spacing, type) in each app's `index.css`.
- Empty, loading, and error states for each screen.
- Mana symbol treatment and the color palette for the five colors plus colorless.

## What exists today

A plain, functional interface already implements every screen above, so the design pass restyles working code rather than inventing flows. In both apps:

- Import: paste or choose a file; decklists and ManaBox, Moxfield, and Deckbox CSV exports are detected automatically; a resolution report with suggestions.
- Pool: color filters, type, subtype, mana value, and tag filters, search, sort (name, mana value, color, quantity), header counts, quantity buttons, Select to remove cards. Card art opens full screen on click; a two-sided card has a turn-over button over the art's right edge. Tags show as bubbles; the web table only renders rows near the viewport for large pools.
- Build (desktop): settings beside ranked deck options; an option opens the deck view with Accept, Back, and Export. Phones: size, colors, archetype list, Build, then the deck view.
- Deck view: cards grouped by type, mana symbols, optional "why each card is here", curve bars, land reasoning, roles, synergies, notes.
- Decks: list, open, rename by clicking the name, export, Remove (Delete or Disassemble), pair two packets with Copy.
- Settings: Un-sets, card art, appearance, export (bulk list, decks, or both, as JSON or TXT) and restore (bulk list, decks, or both), reset settings, clear all data, card data version, About with the attribution notices.
- Card detail: opened from any card row. Web shows a right-hand panel; phones show a full-screen sheet; tablets show a side panel. With art on, lists show small thumbnails and the detail shows the whole card.
- Mobile shell: bottom tab bar on phones; from 768 px a side rail, and Build shows the form beside the result.
- Web app: installable, works offline after the first load through a service worker.

Shared pieces live in `packages/ui` (card detail, card image, deck view, curve bars, hooks). Screens live in `apps/web/src` and `apps/mobile/src`.

Not built yet, though described above: the add-or-replace choice on Import, a grid view with art on Pool, and the mobile "check for card updates" action (phase 8). Design them; the logic will follow.
