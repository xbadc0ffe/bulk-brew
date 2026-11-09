# Anchors

The judging panel is checked on decks whose answer we know before its scores are trusted (`docs/algo-review.md`, Phase 3, "Judging"). There are two anchors, and both are stored as the same `ReviewDeck` files as every builder version (`docs/review/runner.md`):

- **Random piles**, version `random`, which should fail.
- **Real decks** from the corpus, version `real`, which should pass.

Code: `packages/pipeline/src/review/algos/random.ts` and `packages/pipeline/src/review/anchors.ts`. Tests: `packages/pipeline/test/review-anchors.test.ts`.

## Random piles

`random` is a registered builder version, so it runs through the runner like any other:

```sh
npm run review:build -- --version random --pool eval/pools/bulk-black.txt --colors B --size 60
npm run review:build -- --version random --pool eval/pools/elf-tribe.txt --commander Lathril --size 100
```

In a jobs file, use `"version": "random"`. Files land in `data/review/decks/random/`, named as the runner names every deck.

### The recipe

1. **Commander, at 100 cards.** It must be in the pool, able to be a commander, and have at least one color. The deck's colors are its color identity. It goes first in `cards` with `why: "Commander"`, and in `deck.commander`, as the `head` adapter records it.
2. **Eligible cards.** The current builder's own candidate list (`listCandidates` in the core) decides what is legal. It leaves out:
   - Un-set cards, unless the settings allow them;
   - rarities the settings leave out;
   - cards banned or not legal in Commander, at 100 cards;
   - cards that need a commander, below 100 cards;
   - cards with a `{C}` pip, which basics cannot pay;
   - basic lands.

   It also caps copies at what the pool holds and the settings' `maxCopies` (4 at 60 and 40, 2 at 20) or one at 100 (more for "any number of cards named" cards). On top of that, the pile keeps only nonland cards, plus modal cards with a land back, whose color identity is inside the requested colors. This is stricter than the builder's castability rule below 100 cards: a hybrid card with a color outside the deck stays out.

3. **The draw.** Mulberry32 (`rng` in `corpus.ts`), seeded with `hash32('review:random:' + seed)`, shuffles the eligible cards (sorted by oracle id first) with Fisher-Yates. Each card then gets a quantity from 1 to its allowed copies, uniformly. The spells are the first copies of that shuffled list, the last card cut short when needed. There is no synergy, no roles, and no curve.
4. **Land count.** The builder's land formula from `config/deck-templates.json` (`planLandCount` in the core):
   - take spells for the size minus `baseLands` (38 at 100, 25 at 60, 17 at 40, 8 at 20);
   - apply the formula to them: base plus slope times (average mana value minus reference), minus credits for cheap mana sources, clamped to the template's range;
   - take the spells again for the count it gives.

   A pile therefore runs 35 to 40 lands at 100, 20 to 27 at 60, 15 to 18 at 40, and 7 to 9 at 20, as the builder would aim for the same spells.

5. **Basics only.** No nonbasic lands. The basics split over the colors in proportion to the colored pips in the spells' casting costs (the core's `pipDemand`: a hybrid pip goes to the first deck color it names, a Phyrexian pip to none), the commander included. The split is by largest remainder, ties in WUBRG order. Every color with a pip gets at least one basic. With no pips at all, the requested colors share evenly.
6. **Too small a pool.** When the eligible copies cannot fill the spell slots, the version throws `BuildError`, and the runner records "could not build".

Every drawn card has `why: "random"`. The deck is named "Random pile" with archetype `none`. `explanation` holds the eligible card and copy counts, the land plan, and the pip totals. Same pool, request, and seed give the same pile; build time is a few milliseconds.

### Checked on 2026-11-08

| Command (`npm run review:build -- --version random ...`)                 | Result                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `--pool eval/pools/bulk-black.txt --colors B --size 60 --twice --print`  | 60 cards, 24 distinct spells, 24 Swamps; second build identical                  |
| the same with `--seed 2`                                                 | 21 distinct spells, only 3 shared with seed 1; 24 Swamps; identical twice        |
| `--pool eval/pools/elf-tribe.txt --commander Lathril --size 100 --twice` | 100 cards, singleton, Lathril first; 39 lands (22 Swamp, 17 Forest)              |
| `--pool eval/pools/white-bulk.txt --colors W --size 40 --twice`          | 40 cards, 17 Plains; identical twice                                             |
| `--pool eval/pools/bulk-red.txt --colors R --size 20 --twice --print`    | 20 cards, 8 Mountains, at most 2 copies; identical twice                         |
| `--pool eval/pools/tiny-blue.txt --colors U --size 60`                   | Could not build: 28 eligible spell copies, a 60-card pile with 25 lands needs 35 |

## Real decks

```sh
npm run review:anchors [-- --out data/review/decks] [--per-size <n>] [--keys data/review/keys/anchors.json] [--force]
```

| Flag             | Meaning                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--out <dir>`    | The decks folder, as for the runner. Files go to `<dir>/real/`. Default `data/review/decks`.                                  |
| `--per-size <n>` | Sample `n` decks at every size instead of the defaults below. The same seeds apply, so a smaller sample is a different draw.  |
| `--keys <file>`  | Where the answer key goes. Default `data/review/keys/anchors.json`.                                                           |
| `--force`        | Rewrite files that exist, and remove files in `real/` that are not in this selection. Without it, both are kept and reported. |

It reads `data/corpus/decks.json` once (run `npm run corpus:fetch` if it is missing) and the data pack once, for card names. It takes about two seconds.

### Selection

Every size uses its own seed, `hash32('review:real:' + size)`, through the same Mulberry32 generator. The sample spreads over groups: the candidates are sorted by corpus id, grouped, each group shuffled, the group order shuffled, and then one deck is taken from each group in turn until the sample is full. So no group gets a second deck before every group has one, and the corpus file's order never matters.

| Size | Candidates                                                                                               | Sample | Spread over   |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| 100  | Precons whose kind contains "Commander", with exactly one commander                                      | 40     | release years |
| 60   | Every 60-card precon                                                                                     | 40     | kinds         |
| 40   | 17Lands draft decks with at least 7 wins in at most 9 games; 6 wins if that gives too few for the sample | 60     | sets          |
| 20   | Precons whose kind contains "Jumpstart"                                                                  | 30     | products      |

Never used:

- the owner's local lists (source `local`, 5 at 100), which are private;
- Commander precons with two commanders (5): the review files hold one commander;
- 40-card precons (Starter Deck 4, Theme Deck 37, Welcome Deck 10): at 40 cards the anchor is the winning draft decks.

### What the corpus gave (data 2026-11-03.s2)

| Size | Candidates | Written | Kinds                                                        | Spread of the sample                                        |
| ---- | ---------- | ------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 100  | 195        | 40      | Commander Deck 193, MTGO Commander Deck 2                    | 16 release years from 2009 to 2026, 2 or 3 each             |
| 60   | 680        | 40      | 21 kinds, listed below                                       | 2 of each kind; 1 of Advanced Deck and of Modern Event Deck |
| 40   | 5,192      | 60      | Draft (7 of 9: 2,674; 7 of 8: 1,815; 7 of 7: 702; 8 of 9: 1) | 18 sets, 3 or 4 each                                        |
| 20   | 510        | 30      | Jumpstart                                                    | 7 products: JMP, J22, J25, FDN, CLU, TLE, MSH; 4 or 5 each  |

The 7-win bar gave far more than 60 draft decks, so it was not lowered.

The 60-card kinds, with candidates: Advanced Deck 12, Arena Starter Deck 91, Arena Starter Kit 8, Challenger Deck 22, Clash Pack 9, Duel Deck 52, Duel Of The Planeswalkers Deck 5, Enhanced Deck 20, Event Deck 26, Game Night Deck 15, Guild Kit 10, Intro Pack 124, Modern Event Deck 1, Pioneer Challenger Deck 8, Planeswalker Deck 41, Premium Deck 3, Pro Tour Deck 7, Spellslinger Starter Kit 4, Starter Kit 12, Theme Deck 179, World Championship Deck 31. Spreading over kinds means the sample holds a few tuned tournament decks (World Championship, Pro Tour, Challenger) beside casual precons; they should pass all the more.

Every card in the corpus resolves in the current pack, and every written deck has exactly its size.

### The files

Each real deck is a `ReviewDeck`:

- `version`: `real`.
- `versionNotes`: the kind, the product name, the release date, and for draft decks the wins and games, for example `Draft, "BLB draft 4b4ec235", 7 wins in 7 games`.
- `pool`: `id` is the corpus id (such as `precon:AbzanArmor_TDC`), `source` is `corpus`, `hash` is the deck list's hash as the runner computes it, `cards` the deck's copies.
- `request`: the deck's size; the commander at 100; `seed: 0`; and the colors, which judges see:
  - at 100, the commander's color identity;
  - below 100, the colors the spells must pay, by `deckColors` in `corpus.ts` (the rule `corpus:eval` uses for these decks: every plain colored pip, and a hybrid card's first color only when none of its colors is in yet), kept to the colors some land in the deck makes when that leaves any.

  Color identity would overstate them: on data 2026-11-03.s2 it listed 29 of the 130 decks below 100 with an extra color, such as the mono-red Premium Deck Fire and Lightning as WRG for its hybrid cards. The land rule then narrows three decks: two W/R Karlov Manor draft decks that cast green and blue cards face down by disguise, and a W/B Eldraine draft deck with a blue adventure half. No listed color lacks a land that makes it.

- `deck`: `name` is the product or draft name, `archetype` is `none`. The five plain basics (by the names in `config/land-rules.json`) go to `basics`; snow basics and Wastes stay in `cards`. At 100 the commander is first in `cards` with `why: "Commander"`, and in `deck.commander`.
- `buildMs` 0, `explanation` with the corpus id, kind, name, release date or record, and the corpus data version.

File names follow the runner's pattern, with the corpus id made safe for Windows as the pool name, for example `real/precon-AbzanArmor_TDC-WBG-100-bestfit-felothar-the-steadfast-s0.json` and `real/draft-BLB-4b4ec23578df494ca46fb22c571da833-0-WUB-40-bestfit-s0.json`.

## Telling anchors from builds

- By `version` in the file: `random` or `real`. They also sit in their own folders, `data/review/decks/random/` and `data/review/decks/real/`.
- The answer key, `data/review/keys/anchors.json`, lists every real deck file with its corpus id, kind, name, release date or record, size, colors, commander, and `expect: "pass"`. It states the rule for random piles (every file with version `random`, expected to fail), since the runner writes those. It also records the candidate counts and seeds per size.
- Judges must not see what gives an anchor away. Anything that builds judge packets has to drop `version`, `versionNotes`, `pool`, `deck.name`, `archetype`, every `why`, `explanation`, and the file name, and keep only the cards, the basics, the size, and the colors (and the commander at 100).
