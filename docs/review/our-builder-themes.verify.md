# Verification: our builder's themes on public pools

Skeptical check of `docs/review/our-builder-themes.md` against the code at `c99dc0f` (26.0.35), the data pack 2026-11-03, and the scratch outputs in `data/review/scratch/themes/`. Run on 2026-11-08.

## What I reproduced

These hold up. I checked each one myself.

- **Builder counts.** Every "setup / payoff (dual)" figure in the table matches the `copies:` line of its inspector file in `data/review/scratch/themes/`.
- **Inner sums.** Every real / rider / wrong split adds up to the builder count, and so do the rider and dual totals in "What this shows" (Graveyard 21 of 41, Lifegain 17 of 30, +1/+1 counters 17 of 35, Tokens 13 of 39, Aristocrats 11 of 50, Landfall 5 of 18; duals 16, 12, 9, 6, 5, 4, 3, 2).
- **Verdict counts.** 10 honest passes and 9 / 8 / 7 verdicts follow from the table.
- **Same decks as `demo:build`.** For all 24 decks, the decklist, curve, roles and notes in the inspector file match the `demo:build` file exactly (awk diff over all 24). Rebuilding four decks at HEAD (green Graveyard, white Tokens, black counters, gold-heavy-black Lifegain) gave identical output.
- **Minimums.** The 60-card minimums quoted for each style match `config/archetypes.json`.
- **Matcher clauses.** `theme-members.ts` tests `clauseMatches` per clause, which agrees with `cardMatches` in `candidates.ts:91-92`.
- **Tag claims.**
  - All 10 wrong Graveyard setup copies match E0 through `graveyard-fuel-self`: 2 Constrictor Sage, 1 Unwilling Ingredient, 3 Barishi, 3 Sylvan Hierophant, 1 Mother Bear.
  - 6 of the 8 wrong counter payoffs come through `counters-matter`; the other 2 are Iron Monger, through `gives-pp-counters-to-all`.
  - `keyword-anthem` covers Blur Sliver, Heart Sliver and Maze Rusher.
  - Capenna Express and Gilded Goose match through the sacrifice-outlet tags.
  - `synergy-artifact` covers Reality Ripple, and `synergy-enchantment` covers Southern Air Temple.
- **Cause 2 on the blue pool.** `pool-tags.ts` shows Riptide Survivor, Teferi's Imp, Stern Lesson, Rousing Read and Trickster Mage as `[--]`.
- **Scans.** Re-run on all eight pools at 60 (`data/review/scratch/verify-themes/scans/`): every requested style is `ok`, and Graveyard is viable everywhere except bulk-red.
- **Removal.** Below the target of 7 in exactly 5 decks (black counters 6, blue Artifacts 6, creatures-only Landfall 5, gold-heavy-black Lifegain 6, white Lifegain 6), with a minimum of 5.
- **Rules.** The cited rules exist with the stated meaning: 701.71a, 701.44, 701.66a, 702.181a, 701.68a and 728.1.

## Issues

- **Claim:** "Barishi's 'why' says Big threat, so I cannot say dual counting picked it, only that the theme count did not object."
  - **Problem:** The code does say. Every pass picks with `pickBest`. After the curve gap check, its first tiebreak is `themeTagHits`, ahead of strength: `builder.ts:689-694` and `config/builder-weights.json` `tiebreaks: [themeTagHits, strength, lowerMv, name]`. A card's theme value is 1 for an enabler, 1 for a payoff, and 2 for a dual card (`builder.ts:1374`). So theme membership picks cards even inside role passes, and the "why" label only names the pass.
  - **Evidence:** `node data/review/scratch/verify-themes/role-cands.ts eval/pools/bulk-green.txt G 60 graveyard finisher`:
    - Barishi (strength 3.58, theme 2) beats Bag End Porter (3.63, 0) and Kyoshi Warrior Exemplars (3.60, 0) in bucket 4.
    - In the early-creature pass, 3 Sylvan Hierophant (3.55, theme 2) rank ahead of Circle of the Land Druid (3.74, theme 1). That is dual counting picking a "wrong" card over real setup, and it explains "1 of 3 Circle" directly.
    - In blue, Constrictor Sage (2.99, theme 2) is the "Big threat" over Summon: Valefor (7.38), Smirking Spelljacker (5.77) and Djinn of Wishes (3.94) in the same bucket.
  - **Severity:** wrong.

- **Claim:** The causes are all about matchers and tags (causes 1 to 3 plus "new" failure types).
  - **Problem:** The document never mentions the builder mechanisms that turn broad tags into picks:
    - the theme tiebreak above;
    - the objective's `themeHit` term, 0.3 per theme value, so a dual card scores twice (`builder.ts:524`);
    - the swap guard that forbids removing a theme card while the count is below the larger of the minimum and the learned target (`builder.ts:1001-1013`, `1436-1441`);
    - the learned fill target `fillThemeTarget` (`builder.ts:787-808`, `fillToTarget: true`);
    - the synergy rules, which reuse the same broad tags (`tokens-pump` is identical to the Tokens matchers, and the `graveyard` rule counts `mill-self` and `graveyard-fuel-self`).

    These explain counts far above the minimums. The blue Spellslinger deck took all 7 payoffs in the pool, Ichormoon Gauntlet and Map to Lorthos's Temple among them, because the learned target is 13 payoffs.

  - **Evidence:** `node data/review/scratch/verify-themes/targets.ts` gives these learned targets at 60:

    | Style        | Enablers | Payoffs |
    | ------------ | -------- | ------- |
    | Graveyard    | 8        | 10      |
    | Spellslinger | 19       | 13      |
    | Counters     | 16       | 6       |
    | Lifegain     | 13       | 4       |
    | Artifacts    | 14       | 11      |
    | Enchantments | 17       | 8       |

    The blue Spellslinger scan shows payoffs 7/5, and the deck holds all 7.

  - **Severity:** missing.

- **Claim:** "Cause 4, inherited flaws: not tested here."
  - **Problem:** It can be confirmed from the code without new runs. The learned deck score that ranks options uses plan closeness (`builder.ts:1172-1189`). Two of its features, `theme enablers` and `theme payoffs`, are `t.pe / spells` and `t.pp / spells` (`builder.ts:1103-1104`). These are the same matchers, with dual cards counted on both sides. The learned profile penalty uses the same tallies (`builder.ts:534-535`).
  - **Severity:** missing.

- **Claim:** The Graveyard verdicts treat all four failures alike.
  - **Problem:** The document does not separate a pool that lacks real setup from a builder that skipped it. In the white pool, nothing outside surveil 1, explore and manifest dread matches as setup (plus Possessed Goat and Splitskin Doll, which do not count). The black pool's only volume setup is 2 Morgue Thrull ("Sacrifice this creature: Mill three cards."), which the builder counts as an enabler but left out: its strength of 2.61 is below `themeMinStrength` 3. The fill takes strong theme cards first (`builder.ts:755-764`), and riders are strong because their main job is removal or draw. So black and white are mostly scan failures: the scan calls 14 and 16 rider copies viable. Blue and green are selection failures.
  - **Evidence:** `node data/review/scratch/pool-tags.ts eval/pools/{bulk-black,white-bulk}.txt <c> graveyard loot,rummage,discard-outlet,mill-self,graveyard-fuel-self`; `node data/review/scratch/verify-themes/theme-cands.ts eval/pools/bulk-black.txt B 60 graveyard`.
  - **Severity:** missing.

- **Claim:** Tato Farmer is a "wrong" landfall payoff ("you may get two rad counters", which mills you and costs life), listed under anti-synergy.
  - **Problem:** This misreads the card. Rule 728.1: rad counters mill at your precombat main phase. You lose life and remove a counter only for nonland cards. Tato Farmer's second ability puts "target land card in a graveyard that was milled this turn onto the battlefield", which is another landfall trigger. The rad counters are optional, and they feed the card's own land engine. Weak or self-contained at worst, not anti-synergy.
  - **Evidence:** `data/packs/cards.json` Tato Farmer oracle text; `docs/rules/MagicCompRules.txt` 728.1.
  - **Severity:** wrong.

- **Claim:** "Themes defined by card type (Spellslinger, Artifacts, Enchantments, Voltron) have no riders."
  - **Problem:** The document's own table contradicts it. The white Voltron deck counts 3 rider setup copies: 2 Honored Knight-Captain and 1 Relic Seeker, matched by E2 `tutor-artifact-equipment`. Those riders are also left out of the rider shares in "What this shows". For the other three themes, the method makes every counted card real by definition ("How I judged", line 52), so "no riders" is an assumption, not a finding.
  - **Severity:** misleading.

- **Claim:** "Black and white count no real setup at all: 9 of 10 and 10 of 10 setup copies are surveil or explore riders" (summary); "ten surveil-1 riders" (white verdict).
  - **Problem:** The black riders include 2 Eyeblight Cullers, which mill three on death, and 2 Souls of the Lost, a discard-or-sacrifice additional cost matched by E2 (`discard-outlet` with `cards-in-graveyard-matter`). The black deck has no explore. Only 5 of its 9 rider copies surveil. The white riders are 8 surveil 1, 1 explore and 1 manifest dread.
  - **Evidence:** `data/review/scratch/themes/bulk-black-B-60-graveyard.txt`, `white-bulk-W-60-graveyard.txt`.
  - **Severity:** misleading.

- **Claim:** "Counting only cards that really do the job, 10 of 24 meet the same minimums."
  - **Problem 1, uneven calls.** Several decks pass exactly at the threshold, on calls the document makes differently elsewhere:
    - White Lifegain reaches 8 of 8 setup only by counting Envoy of the Ancestors and Abzan Battle Priest as real. Both give lifelink only to modified or countered creatures, and mostly themselves through outlast. Self-only counter cards are riders in the counters decks.
    - Green Landfall reaches 5 of 5 payoffs with Skyclave Pick-Axe as real but Attercop as weak. Both are temporary pumps per land.
    - Its setup counts 4 Earthbender Ascension and Summon: Fenrir as real, though each fetches one basic land once. Elsewhere one explore, one Map or one token on entering is a rider.
    - Microscope and Screeching Sliver (tap: surveil 1 or mill 1) are real, while Fear of Surveillance and Starfighter Pilot (surveil 1 on each attack or tap, the same `repeatable-surveil` tag) are riders.

    Flipping any one call at a threshold changes the headline count.

  - **Problem 2, dual cards on both sides.** The honest count credits a dual card to both setup and payoff, against the brief's pitfall. Born to Drive is either channelled for tokens or cast as the payoff Aura, never both. The same applies to Retreat to Emeria, The Crystal's Chosen, Dawn of Hope, Etherium Sculptor, Poetic Ingenuity, Sanctum Weaver and Michiko's Reign of Truth. Recounting with each card assigned once still gives 10 of 24, so the number survives, but the method should say so.
  - **Severity:** misleading.

- **Claim:** "Failures are plan failures, not mana or interaction failures."
  - **Problem:** Not supported by the sample.
    - All 24 decks are one color with basics only (`0 nonbasic` in every land note), so color sources are never tested.
    - Land counts are not examined: 8 decks run 25 lands at an average cost of 2.7 to 3.1 with 0 or 1 cheap mana sources.
    - "Interaction" is the builder's own removal role tag, the same kind of tag count the document distrusts for themes. For example, Skirsdag Flayer counts as removal but needs a Human to sacrifice.
  - **Evidence:** the `note: N lands` lines in `data/review/scratch/themes/*.demo.txt`.
  - **Severity:** unsupported.

- **Claim:** "card conditions are never checked against the deck, so 13 counted copies cannot work."
  - **Problem:** Partly overstated.
    - The code does check a few conditions: `needsCommander` (`matchers.ts:181`), `{C}` pips (`candidates.ts:198`) and archetype colors (`scan.ts:104`). It does not check type or tribe conditions on theme cards.
    - "Cannot work" is too strong for some entries. Poetic Ingenuity triggers once a turn after Tablet of Discovery, and Blur Sliver and Heart Sliver give haste to each other.
    - The list misses Nylea, God of the Hunt. Nylea is "not a creature" below devotion 5, yet it counts as a finisher in green decks, and the green Graveyard section lists it as a win condition.
  - **Severity:** misleading.

- **Claim:** Aristocrats failures are explained by outlet tags matching Treasure and Food.
  - **Problem:** The structural cause goes unnamed. `config/archetypes.json` Aristocrats enablers lump outlets (clause 0) and fodder (clause 1) into one count with one minimum. A deck can meet "setup" with fodder alone, which is what happened in the green deck (10 setup, no creature sacrifice outlet) and almost in the white one.
  - **Severity:** missing.

- **Claim:** The 24 decks show how the builder's themes behave.
  - **Problem:** Coverage gaps:
    - 60 cards only, one color only, 10 of 18 themed styles.
    - Viable but untested: Evasion (5 pools), Ramp (5), Burn (2), Mill (blue), Tappers and Energy (white), and the Elf tribe in elf-tribe.
    - Best fit for gold-heavy-black at 60 is "Black Burn 60", a theme the document never opens.
    - No 100-card Commander deck, where `commander.ts` leads and the minimum scale change how theme cards enter.
  - **Evidence:** re-run scans in `data/review/scratch/verify-themes/scans/*.txt`.
  - **Severity:** missing.

- **Claim:** Short answer: "All four Graveyard decks fail. So do both +1/+1 counters decks, all three Aristocrats decks". Healthy list in the summary and in "Healthy themes".
  - **Problem:** "Fail" means "honest minimum not met", yet 4 of those 9 decks (Graveyard blue and green, counters green, Aristocrats black) carry the verdict Partial, not No plan. The healthy list names 8 decks while 9 are rated working; green Landfall is missing.
  - **Severity:** misleading.

- **Claim:** Individual "wrong" payoffs: Valley Questcaller (white Tokens), Flowerfoot Swordmaster (white Voltron), and Ancient Greenwarden as "weak" (creatures-only Landfall).
  - **Problem:**
    - Valley Questcaller pumps the deck's 2 Seasoned Warrenguard, Flowerfoot Swordmaster and the 3/3 Bird tokens from 2 Gwaihir. That makes it weak, not wrong.
    - Flowerfoot's valiant triggers on equip or Aura targeting and pumps itself (a Mouse). That makes it self-only, not wrong.
    - Ancient Greenwarden doubles every landfall trigger and plays lands from the graveyard. That reads as a real payoff.

    None of these changes an honest-minimum result.

  - **Severity:** misleading.

- **Claim:** Rider examples "(`multiple-bodies`, Mobilize)", and "Setup is every Equipment and non-removal Aura, plus Equipment tutors."
  - **Problem:** Dragonback Lancer's Mobilize 1 matches through `repeatable-creature-tokens`, not `multiple-bodies`. The Voltron enablers also include Aura tutors and `pseudo-equipment` (archetypes.json `auras` E2).
  - **Severity:** misleading (minor).

## Verdict

**Needs fixes.** The numbers are reproducible and the tag findings are right. The main gap is that the document reads only the matchers. It misses the code paths that make broad tags pick cards: the theme tiebreak, the dual theme value of 2, the swap guard, the learned fill targets and the synergy rules. Those turn its "cannot say" on Barishi into a confirmed dual-counting effect. Cause 4 is also confirmable from the code. The document should:

- fix the Tato Farmer and summary wording;
- separate pool shortages from selection failures in the Graveyard results;
- state that the honest count rests on threshold calls, and count each dual card once.

## Scratch used

Under `data/review/scratch/verify-themes/` (gitignored):

- `role-cands.ts`: role candidates with strength and theme value.
- `theme-cands.ts`: a pool's enablers and payoffs for one style, with strength.
- `targets.ts`: learned theme targets.
- `show.cjs`: oracle text and tags from `data/packs/cards.json`.
- `scans/`: re-run 60-card scans.
- `re-*.txt`: rebuilt decks.
