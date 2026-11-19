# Bulk Brew: Design Brief

The screens and flows as built. Scope, data, and architecture are in `SPEC.md`; open design work is in `docs/todo.md`.

## The product in one paragraph

A Magic: The Gathering player has a box of bulk cards. They paste a list of those cards into Bulk Brew, pick a deck size and colors, and get ranked deck options built from what they own, each with a short explanation of why it works. They accept one, the cards leave the bulk list (or stay, if they choose), and they build the next. Decks come in 60, 40, and 20 cards in one to five colors, and 100-card Commander; two 20-card packets merge into one 40-card deck. Everything runs on the device with no account.

## Audience and tone

Casual and kitchen-table players, people who draft a lot and have piles of commons and uncommons, parents and friends building starter decks. Assume they know what a mana curve is but not what a "role quota" is. Tone is friendly and plain. User-facing copy uses no em-dashes.

## Two apps today

| App    | Where it runs                                               | State                                                              |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Web    | Desktop and phone browsers, GitHub Pages                    | The full product. The only app that is deployed and smoke-tested.  |
| Mobile | Development only (`npm run dev:mobile`), no iOS project yet | A phone layout of the earlier product; see "Web only today" below. |

Both are React 19 with Tailwind 4 on `packages/core`. Shared components, hooks, and the design tokens (`packages/ui/src/theme.css`) live in `packages/ui`; layouts live in `apps/web/src` and `apps/mobile/src`. The web app is becoming the one app: it has a phone layout below 768 px (see "Phone layout (web app)"), Capacitor will wrap it for iOS, and the Mobile app is being retired.

Web screen ids (`apps/web/src/nav.ts`): import, pool, build, decks, settings, about. Import is a subpage of the Bulk List (id `pool`). Mobile has import, pool, build, decks, settings; its pool has a Cards and an Analysis view, and About is a page inside Settings.

### Web only today

- 100-card Commander and the commander list (phones offer 60, 40, and 20).
- The ranked deck options list (phones build one deck) and the secondary archetype.
- Replace a card in a fresh build.
- The Analyze pane with recommended decks and charts (phones show a per-color archetype table).
- Bulk List column sorting and Select to remove; Decks filters, search, and sort.
- Colored deck actions, the Remove dialog, and click to rename (phones use a Disassemble button, a line in the Export sheet, and a browser prompt).
- Export and restore by part, Theme color, and Text size (phones have a full backup only and follow the system text size).
- Installable and offline through a service worker.

### Look

- Light and dark mode, six theme colors, and a text size setting (90 to 140%). No external fonts, CDNs, or trackers. Mana and card symbols are Scryfall's symbol images, bundled.
- Web sidebar: square tiles with an outline icon over the label (Bulk List, Build, Decks, Settings, About). The app name, version, and app icon sit at the bottom. Below 768 px the sidebar becomes a top bar of pills that scrolls sideways.
- The app icon has a light and a dark version; the sidebar and browser tab show the one for the current mode.
- Labels with a detail line under them are bold and the detail line is not; section labels are bold.
- Light themes: colored text is dark, box fills are near white with a faint tint of the theme color. Dark themes: background and sidebar are very dark, boxes lighter, colored text light.
- Outlines of boxes, buttons, tiles, fields, and tag bubbles are two pixels; separators between list rows are one. Fixed-height rows leave room for a whole bubble.
- Action colors are fixed: Accept green, Back and Remove red, Analyze blue, Export grey.

### Phone layout (web app)

Below 768 px the web app keeps its colors and type and changes shape. Everything here is about that width unless it says otherwise.

- Folder tabs across the top in place of the sidebar: Bulk List, Build, Decks with their counts, then Settings and About as icons. The open tab is the page's color and joins the page.
- Sheets (`packages/ui/src/components/Sheet.tsx`): a panel rolls up from the bottom over a dimmed page, with a handle. The handle, the dimmed area, a drag down, Escape, and the phone's Back all close it, and its content scrolls inside it. A card (below 1024 px), the Bulk List's filters, its sort and select, and Analyze each open in one. On an open card a swipe left or right, or the arrows beside the handle, moves to the next or previous card of the list or deck and goes around the ends.
- Bulk List: the totals and Import; a row of color tiles, the symbol over a short count (exact to 999, then 1.2k, 1.2m), where the symbol filters and the count shows the exact number in a bubble; one toolbar row with search, a Filters button that carries the number of filters on, a Sort and select button, and Analyze. Cards take two lines (count and name, then cost and type) while the list is narrower than 640 px at the chosen text size.
- Deck options: tighter cards with a larger name, a smaller color wheel and curve, and card types and roles as two columns of names and counts.
- Deck view: one scrolling page. The name and details are centered and scroll away; card types and roles come first, then the cards, then the details. The actions (Accept, Back, Export, and a saved deck's) stay in a bar at the bottom.
- Buttons and fields are at least 44 px tall on touch screens, fields use 16 px text so iOS does not zoom, and safe-area insets keep the tabs and sheets clear of the notch and home bar.
- About shows the maker's logo on top and the app's icon beside the name, since a phone has no sidebar to carry the icon.
- Not done yet: Decks is still the desktop table, and Settings, Import, the Build form, and the dialogs are the desktop layout squeezed.

### Phone layout (mobile app)

- A four-tab bar (Bulk List, Build, Decks, Settings) with outline icons, filled when active. From 768 px a text side rail replaces it, with a 320 px card detail side panel.
- Top-level screens have a large title with an optional trailing action. Pushed screens (Import, a build result, a deck) cover the content and have a back label.
- Grouped lists with rows at least 44 points tall. The primary action is a full-width button in a bottom bar.
- Sheets for filters, export, and card detail. Decks rows swipe for Export and Disassemble.
- Safe-area insets on every edge that touches the screen, and text follows the system text size.

## Screens

### Import

- A text area for pasted lists. On the web, text files dropped on the box or chosen from its hint go below what is already there, several at once. Mobile has paste and a file picker.
- Decklists and ManaBox, Moxfield, and Deckbox CSV exports are detected automatically. Help text shows the formats: `4 Lightning Bolt`, `4x Lightning Bolt`, `4 Lightning Bolt (M10) 146`.
- Every line is checked while typing. Lines that did not match are listed, and each can be edited, take a "Did you mean" suggestion, or be skipped (Skip all for the lot).
- Import adds the matched cards to the bulk list; unmatched lines stay in the box. There is no replace-the-list choice.

### Bulk List

- Header: total cards, and color buttons with counts that act as filters.
- A table of cards with quantity, name, mana cost, type, subtype, and tags as bubbles. Thousands of rows are normal, so only rows near the viewport render. With art on, rows show small thumbnails.
- Filters: color, type, subtype, a mana value comparison, tags and subtags, text search, and Clear filters. The web sorts by any column header; the phone picks from fixed orders.
- Card detail: image when art is on, oracle text, type line, tags in plain language. Edit quantity, remove. On the web it is a right-hand panel, and below 1024 px a sheet that rolls up from the bottom; on the Mobile app a full-screen sheet.
- Select (web) removes several cards at once. Export, backup, and clearing live on Settings on the web; the phone still has them on this screen.
- Analyze (web): a blue button opens a pane under the list. Recommended decks for Commander, 60, 40, and 20 (five each, found by a background search, with a max colors per deck choice); picking one opens it on Build. Then a color pie and a second pie counting multicolor cards in each color, spells by color and mana value, and by-color tables for card types, roles, creature types, and subtypes.
- Empty state that leads to Import.

### Build

Settings on the left, deck options on the right (web). The phone has size, colors, an archetype list, Build, then the deck view.

- Deck size: 100 (Commander), 60, 40, 20, with one line describing the selected size.
- Then a rarities drop-down with a checkbox per rarity, max copies per card (held at 1 at 100), and infinite basics.
- Colors: five toggles, any number picked, each showing how many cards of that color the bulk list has. At 100 they filter the commander list; once a commander is picked they show its colors.
- Primary archetype: best fit by default, then the archetypes the picked colors can build. Each is Viable, Short (can be picked; builds the nearest deck with a note), or a near miss that says what is missing and cannot be picked. Secondary archetype unlocks once a primary one is picked.
- Options: cards ranked strongest first, each with the deck's name and description, a color wheel, the mana curve, copies per card type, role coverage, a mana warning when a color is stretched, the top synergy, and the nearest-deck note when there is one. No strength number is shown. They arrive one by one with a progress line.
- Commander (100): before a commander is picked, the right side lists the commanders in the bulk list in tiers (top, good, possible) as card-shaped tiles with the deck each leads. Picked colors narrow the list. A picked primary archetype regroups them as Can build, Checking your bulk list, and Not enough cards. The picked commander stays in a pane beside its deck options with a red Change Commander button. Changing any build setting returns to the commander list.
- Empty and failure states: no colors picked; no commanders; no decks meet the settings, each with a Clear settings button where there is something to clear.

### Deck view

The same view serves a fresh build and a saved deck.

- Decklist grouped by type with counts; basics by color; mana costs as symbols. Each card can show why it is there.
- Mana curve bars and the land count with its reasoning in one line.
- Details: archetype and what it does, role coverage against targets led by the archetype's own cards, key synergies in plain words, notes. On the web the details pane can widen to half the screen and show more.
- Fresh build: Accept (asks Confirm and remove the cards, Confirm and keep them in the bulk list, or Decline), Back to the options, and Export (Copy as text, Download .txt, Cancel).
- Replace (web, fresh builds): the card detail's Replace this card opens a picker of bulk list cards that fit the deck, closest matches first, each with the jobs it shares with the card going out. Leaving a deck with replaced cards asks Discard your changes? first.
- Saved deck: click the name to rename it; Export; a red Remove that asks Delete or Disassemble (cards go back) for an accepted deck, and Delete for a kept one. A kept deck shows a "Cards in bulk list" badge and a green Accept. A packet has Pair with.
- In a deck view the card detail opens over the deck details, below the header, so the actions stay in view. Below 1024 px it is a bottom sheet.

### Decks

- A list of saved decks with name, size, colors, archetype, and date. On the web: color, size, and archetype filters, search, sortable columns, and Export and Remove on each row.
- Pairing starts from a packet's view: pick another packet, see the combined deck as a preview, then Merge into one deck, which replaces both packets.
- Empty state that leads to Build.

### Settings and About

- Include Un-set and acorn cards. Show card art. Appearance (Light, Dark, System), Theme color, Text size. The phone also has Max copies here.
- Your data (web): Export asks Bulk list, Decks, or Both, then JSON or TXT; Restore from backup asks the same, then the file; Reset settings; a red Clear all data.
- About (its own sidebar screen on the web, a page in Settings on the phone): version, repo link, card data version, and the Fan Content, Scryfall, and learned data notices from `ATTRIBUTION.md`.

## Flows

1. **First run**: empty bulk list, Import, then Build, pick an option, Accept, Build again.
2. **Unmatched lines**: fix names inline, take a suggestion, or skip; Import adds what matched.
3. **Build loop**: pick settings, open an option, read the details, Accept or go Back to the options.
4. **Replace**: swap cards in a fresh build before accepting it.
5. **Commander**: pick 100, pick a commander from the list, then an option.
6. **Analyze to Build**: open a recommended deck from the Analyze pane on the Build page.
7. **Keep, then accept later**: a kept deck leaves its cards in the bulk list until it is accepted.
8. **Remove a deck**: Delete, or Disassemble to return the cards.
9. **Pair packets**: preview two packets together, then Merge.
10. **Backup and restore**: export a file, restore it later or on another device.

Types the interface reads are in `packages/core/src/types.ts`; shared hooks and components are exported from `packages/ui/src/index.ts`.

## Constraints

- Card art is off by default and everything must work as text. Art loads from Scryfall on demand and is shown whole and unchanged: no cropping, recoloring, or marks drawn into it. The only thing laid over a card is the small turn-over button on a two-sided card's right edge, away from the artist credit and copyright line. Clicking the art opens it full screen with zoom and drag.
- No user data leaves the device. There is no sign-in and no sync.
- Bulk lists can hold thousands of cards; lists must stay fast.
- Color is never the only signal; pair it with mana symbols or labels. Meet contrast guidelines in both themes. Touch targets are at least 44 points on phones.
- The deck view is also the builder's debugging output, so the details must be able to show more without clutter.

## Not built

- A grid view with art on the Bulk List (a design grouped by mana value is noted in `docs/todo.md`).
- An add-or-replace choice on Import.
- The over-the-air card data update on iOS.
