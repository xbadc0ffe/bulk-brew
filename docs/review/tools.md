# Review tools

Developer tools for the builder review (`docs/algo-review.md`). They read the data pack and `config/`, run offline, and give the same output for the same input.

## Card helper

`npm run review:cards` prints what the data pack says about a card and what the live builder's matchers make of it. Use it instead of card text from memory. It needs the data pack in `data/packs/cards.json` (run `npm run data:pull` if it is missing).

### Usage

```sh
npm run review:cards -- "Llanowar Elves" "Thraben Inspector"
npm run review:cards -- caa02547-66e3-4e27-a2d3-5e94f3e7a069
npm run review:cards -- "Insectile Aberration"
npm run review:cards -- --file eval/pools/bulk-black.txt
npm run review:cards -- --tag mill-self --limit 0 --compact
npm run -s review:cards -- "Faithless Looting" --style graveyard --json > looting.json
```

Without `-s`, `npm run` prints its own two header lines on stdout, which breaks JSON read from a pipe or file. Running `node packages/pipeline/src/review/cards.ts` directly also avoids them.

Cards come from any mix of these sources, printed in this order:

- **Names and oracle ids** as plain arguments. A name can be the full name, a "Front // Back" name, or the name of either face of a two-faced, split, or adventure card. Un-set cards are found only when no other card has the name. An unknown name prints the closest names on stderr.
- **`--file <list.txt>`**: every card in a decklist file, in any format the app imports. Each card appears once with its copies summed, in the order the file first lists it. Lines that match no card are listed on stderr. As in the app with Un-sets off, a decklist line never finds an Un-set card. A relative path is read from the repo root, since `npm run` starts there.
- **`--tag <slug>`**: every card with that tag (Scryfall Tagger slugs plus `config/tag-overlay.json`, as the pack ships them), sorted by name. When no card has the tag, it lists tags that contain the text.

Options:

| Flag           | What it does                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--limit <n>`  | How many `--tag` cards to show. Default 50; `0` shows all.                                                                                                                                   |
| `--style <id>` | Also show which of that style's enabler and payoff clauses each card meets, by number, with the tags that hit. Style ids are the `id` fields in `config/archetypes.json` that have matchers. |
| `--json`       | Print one JSON array with the same fields as the text.                                                                                                                                       |
| `--compact`    | One line per card: name, cost, type, identity, power and toughness, roles, styles, strength, and why the builder leaves it out, if it does.                                                  |
| `--help`       | Print the usage.                                                                                                                                                                             |

Counts and problems go to stderr, so stdout stays clean for `--json` (with `npm run -s`). The exit code is 0 when every card was found, 1 when a name, decklist line, or tag found nothing, and 2 for a bad option or style, a missing `--file`, or a missing data pack. Aggro, Midrange, and Control are shape styles with no matchers, so `--style aggro` is an error that lists the styles that have them.

### What it prints

For each card: name, copies (from `--file`), mana cost and mana value, layout, type line, colors and color identity, power and toughness or loyalty, oracle text in full (one block per face for multi-face cards), keywords, rarity, Commander popularity rank, Game Changer, the mana a permanent produces and whether a land enters tapped, tags, the roles it meets in `config/roles.json`, the styles in `config/archetypes.json` it counts toward as enabler and/or payoff, the synergy rules in `config/synergy-rules.json` it serves, derived facts (finisher, evasive, mana source), and its strength with the parts that make it up.

Roles, styles, rules, and derived facts come from the core's `factsFor`, and strength from the core's `cardStrength`, so they are exactly what the builder sees. Clause checks for `--style` use the core's `clauseMatches`. Learned data does not affect any of these, so the helper does not load it.

Reading the output:

- **Left out.** The builder never sees some cards, whatever their roles say. A "builder leaves it out" line (`leftOut` in JSON) gives the reasons, from the color-independent checks of the core's `listCandidates` under default settings: Un-set cards, cards banned or not legal in Commander (100-card decks only), cards whose text mentions a commander (60, 40, and 20-card decks), cards with `{C}` in their cost, and basic lands (the mana base adds them). The default rarity filter keeps every rarity. Color fit is not checked, since it depends on the deck.
- **Costs and types of multi-face cards.** The text shows each face's cost when more than one face has one, as `{1}{R} // {1}{U}` for Fire // Ice. The JSON `manaCost` is the pack's card-level cost, the front face's; `faces` hold each. Matchers test `types` (in JSON, and as "matcher types" in the text of multi-face cards): the front face's types, plus the back face's on modal double-faced cards. So Bonecrusher Giant is only a creature to the matchers, while Emeria's Call is a sorcery and a land. Keywords are the whole card's, so Delver of Secrets is evasive through its back face.
- **Strength.** The parts add to the base in `config/card-strength.json` (3), clamped to 0 through 10. The scan counts a theme card as strong at `themeMinStrength` (3) or more. Strength is not the whole of a card's value to the live builder: where learned plans are on (20, 60, and 100 cards in the current config), it adds learned fit, pair, and combo value per card, and counts the hand-written synergy rules at a reduced weight. The helper shows none of that.
- **Tribes.** Tribal styles (`tribal:Elf`) are not in `config/archetypes.json`, so `styles` never lists them and `--style` does not take them. The builder counts a tribe member by the front face's creature types or Changeling, and a tribe payoff by the `typal-<type>` tag, both visible in the output.

Example:

```text
$ npm run review:cards -- "Stitcher's Supplier" --style graveyard
Stitcher's Supplier  {B}  mv 1
  id: 7fd61a18-6e4f-40c5-aa00-3d101ec1ec82  layout: normal
  type: Creature — Zombie  1/1
  colors: B  identity: B  rarity: uncommon  rank: 615
  text:
    When this creature enters or dies, mill three cards. (Put the top three cards of your library into your graveyard.)
  keywords: Mill
  tags: death-trigger, death-trigger-self, life-and-death-trigger-self, mill, mill-self, triggered-ability
  roles: earlyCreature
  styles: aristocrats (enabler), graveyard (enabler)
  synergy rules: aristocrats-fodder (enabler), graveyard (enabler)
  strength: 4.96 (popularity +1.96)
  graveyard matchers met:
    enabler: #1 [anyTags mill-self|graveyard-fuel-self] via mill-self
    payoff: none
```

The same card with `--compact`:

```text
Stitcher's Supplier | {B} mv 1 | Creature — Zombie | B | 1/1 | roles: earlyCreature | styles: aristocrats (enabler), graveyard (enabler) | strength 4.96 | graveyard: enabler #1, payoff no
```

### The module

`packages/pipeline/src/review/card-facts.ts` holds the reusable part; `cards.ts` is a thin command line around it. Other review tools (judges, theme checks, deck checks) should import from it.

- `loadReviewContext({ learned? })` loads the pack, a `CardIndex`, the validated config, and the default settings once, and returns them with the repo `root`. Pass `learned: true` to attach `data/learned.json` as the apps do; only deck building needs it.
- `cardFacts(card, config, index, { style?, qty? })` returns a `CardFactsSheet`: a plain object with every field above, ready for `JSON.stringify` or a prompt. Optional fields are absent, never `undefined`. With `style`, it adds `styleCheck`.
- `formatCardFacts(sheet, { compact? })` turns a sheet into the text above.
- `findCard(index, query)` finds a card by oracle id, full name, or face name.
- `cardsWithTag(index, tag)` returns every card with a tag, sorted by name, then id.
- `cardsFromDecklist(index, text)` returns `{ cards: { card, qty }[], unresolved }` for decklist text.
- `synergyStyle(config, id)` returns the style with matchers, or an error message that names the valid ids.
- `checkStyle(card, style)` returns which enabler and payoff clauses the card meets, with the tags that hit.
- `describeClause(clause)` writes one matcher clause in short words.
- `leftOutBy(card)` lists why the builder's candidate list leaves a card out under default settings.
- `similarTags(index, text)` lists tags that contain some text.
