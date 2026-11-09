# Fact check: games.md (auto-build in digital card games)

Checked 2026-11-08 against the cited sources, opened directly (WebFetch, or curl and pdftotext into `data/review/scratch/games-verify/`). Every page and PDF named below was read for this check.

## Verdict

**Needs fixes.** Most quotes, dates, numbers, and licenses check out. But two of the eight "ideas worth borrowing" rest on readings the sources do not support, and one rests on a guess about which part of Blizzard's builder failed:

- Idea 1 ("packages first", credited to Blizzard): Blizzard never says the meta layer places packages.
- Idea 2 (credited to the Hearthstone Top Decks test): the test cannot tell which layer failed.
- Idea 6 (core cards from clusters, credited to Betley et al.): the clean clusters come from how the contest decks were made, not from real decks.

The section also skips several auto-build features that matter more to us than Master Duel or Duel Links. One is an official Magic game's archetype wizard. Another builds 20-card decks.

The ideas can stay, but each one should say whether it is an idea of our own or something a source shows.

## Issues

### Wrong

- **Claim:** Betley and others "found archetypes by clustering 400 decks".
  **Problem:** They clustered the training and test decks together: 400 training plus 200 test, about 600. The cluster sizes they report add up to about 600 (ten clusters of 47 or 48, one of 96, and 25 unassigned).
  **Evidence:** https://annals-csis.org/Volume_15/drp/pdf/362.pdf. The abstract says "Train and test decks were clustered by DBSCAN". The setup describes 400 training decks and "200 test decks".
  **Severity:** wrong.

### Misleading

- **Claim:** Betley's clustering "gave archetypes with 5 to 10 near-universal cards. On the corpus, this would define themes without broad tags" (Cards section and idea 6).
  **Problem:** The contest decks were made by randomly changing 13 seed decks. Each cluster is one seed deck plus noise, so a core of near-universal cards is built in. The clusters also fall almost exactly along Hearthstone hero classes, and class cards cannot cross classes. Neither result says anything about a real corpus like our precons and 17Lands draft decks, where two draft decks share few exact cards. The idea may still be worth testing, but the paper is not evidence for it.
  **Evidence:**
  - https://annals-csis.org/Volume_15/drp/pdf/386.pdf (Janusz et al., the AAIA'18 overview): "The decks were created by randomly mutating a set of 13 deck archetypes" taken from human ladder play, "12 top-rated archetypes and one group of decks consisting of only basic cards".
  - https://annals-csis.org/Volume_15/drp/pdf/362.pdf: the 11 clusters are "2 different clusters for Paladin and Warlock heroes; 1 cluster for each other hero". Its conclusion says the authors' question was whether the decks "were generated randomly or followed the pattern of human players decks".
    **Severity:** misleading.

- **Claim:** "The meta layer copies a package from real decks, so setup and payoff arrive together", and idea 1, "Hearthstone's meta layer places whole packages copied from real decks". The summary says it "copies whole archetype packages".
  **Problem:** Blizzard never says the meta layer copies packages or places cards in groups. The post says the clusters are used, "combined with other mathematical solutions", and the algorithm "dynamically fills your deck until the deck is full". "Package" is the author's reading. Idea 1 may be a good idea, but it should be labelled as ours, not credited to Blizzard.
  **Evidence:** https://hearthstone.blizzard.com/en-us/news/22938500/developer-insights-smart-deck-builder (Tian Ding, 28 March 2019): "Utilizing this clustering information, combined with other mathematical solutions, the algorithm then dynamically fills your deck until the deck is full, or the second 'back-fill' layer is triggered."
  **Severity:** misleading.

- **Claim:** Q-DeckRec "scores a deck with 300 simulated matches, about 5 seconds". The summary says "one evaluation is 300 simulated games (~5 s)".
  **Problem:** The 5 seconds is on a 56-core server, with the matches spread over all cores. On one core it is closer to several minutes. The 0.38 seconds of wall time per request comes from the same server. The conclusion ("not usable on a phone") holds even more strongly, but the number understates the cost.
  **Evidence:** https://arxiv.org/abs/1806.09771, Section IV of the full PDF:
  - "All experiments run on a powerful server with Intel E5 2680 CPU's @ 2.40 GHz (56 logical CPU cores)."
  - Parallelization includes "match simulations evenly spread on all cores when evaluating f".
  - Each call "returns a win rate based on 300 simulated matches, which on average takes 5 seconds".
    **Severity:** misleading.

- **Claim:** "Jump In! uses the paper Jumpstart design".
  **Problem:** Neither cited source says this, and the Arena page shows a different structure:
  - Each listed packet holds about 12 cards (spells plus one nonbasic land), and many slots are filled at random from a short list of alternates (for example, one removal slot is Final Vengeance or Murder, 50% each).
  - The client adds the basic lands itself.
  - Paper Jumpstart packets are fixed 20-card lists with their own basics.
    **Evidence:** https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-duskmourn-house-of-horror (24 September 2024):
  - "pick two packets and play a combined deck with added basic lands"
  - The packet lists ("Sacrifice Packet", "Survival Packet") are each followed by a "Variability" table that gives each alternate card's chance of appearing.
    **Severity:** misleading.

- **Claim:** Idea 5: pair two cores, "the second's colors bounded by the first, as Jump In! does".
  **Problem:** When the first packet is one color, Arena bounds only the multicolor options. The monocolor second options can be any color. Monocolor options are kept inside the first packet's colors only when the first packet has two or three colors.
  **Evidence:** Same Jump In! page:
  - "If your first packet selection has one color, there will always be at least one monocolor option and at least one multicolor option. All multicolor options will contain the color of the first packet selection."
  - "No monocolor option will be outside of the first packet selection's colors" appears only in the two-color and three-color rules.
    **Severity:** misleading.

- **Claim:** "Most digital card games offer a button that finishes a deck."
  **Problem:** The section's own survey contradicts it. It finds auto-build in five games (Hearthstone, Marvel Snap, Master Duel, Duel Links, Shadowverse) and none in five others (Arena, Legends of Runeterra, Gwent, Eternal, Pokemon TCG Live).
  **Evidence:** games.md, lines 3 and 39 to 43.
  **Severity:** misleading (wording).

### Unsupported

- **Claim:** "An independent test found exactly that failure" (the back-fill ignoring synergy). The summary says "An independent 2019 test of the back-fill". Idea 2 says "The back-fill produced payoffs with no enablers".
  **Problem:** The test reports what decks came out, not which layer made them. It was published 13 days before Blizzard first explained the two layers, and it never mentions them. Some of the failures it reports clearly come from the meta layer: off-meta seeds were pulled into known archetypes, and a Mech Paladin request came back as Secret Paladin. Blaming the back-fill is a plausible guess, not a finding. The lesson itself (keep the setup and payoff link in any fallback) still stands as our own.
  **Evidence:** https://www.hearthstonetopdecks.com/complete-my-deck-how-good-is-netdecking-within-the-hearthstone-client/ (Old Guardian, 15 March 2019):
  - Grand Archivist "but there were no spells" (a budget Druid build).
  - Lesser Emerald Spellstone in a Hunter deck "that had no Secrets".
  - Electra Stormsurge with "no other cards that synergize with Electra".
  - The page says nothing about layers. Blizzard's post is dated 28 March 2019.
    **Severity:** unsupported.

- **Claim:** The summary: "Marvel Snap and Master Duel also complete decks from live play statistics. They work only when the seed fits a known popular shell".
  **Problem:** No source tests Master Duel's Auto-Build. The only description, from Game8, says it is "based on the Decks of players around the world", which means decklists, not live play statistics. The "known shell" limit is shown only for Marvel Snap. The body text is careful here; the summary is not.
  **Evidence:** https://game8.co/games/Yu-Gi-Oh-Master-Duel/archives/483223 ("November 7 2024 Server Maintenance Notes and Version 2.1.0 Update"): "automatically generate a Deck with the help of AI, based on the Decks of players around the world". It gives no performance claims.
  **Severity:** unsupported.

- **Claim:** "Hand-written quality-assurance rules apply across both layers", and the bucket cap is "about 10".
  **Problem:** These are small wording issues:
  - Blizzard says "many quality assurance rules" and does not say how they were made. "Hand-written" is a reasonable reading but not stated.
  - The cap is exactly 10 cards, not "about 10".
    **Evidence:** Blizzard post: "we've also implemented many quality assurance rules within these two deck-creation layers", and "If there are already 10 cards in any specific mana-cost bucket, we are reluctant to add any more cards in that cost range".
    **Severity:** unsupported (minor).

### Missing

- **Missing entry: Magic Duels' Deck Wizard** (Stainless Games for Wizards, 2015, iOS and PC; official support ended 2019). This is an official Magic game with an archetype-first deck wizard, the closest thing in this family to what Bulk Brew does. Secondary sources describe it this way:
  - the player picks a common archetype;
  - it suggests cards in stages and steers toward two colors;
  - it scores the deck on "speed, strength, control, and synergy";
  - it reportedly does not watch card costs.

  This is directly relevant (a plan first, then staged setup) and is absent from the section.
  **Evidence:**
  - https://www.pocketgamer.com/magic-duels-origins/how-to-get-started-with-magic-duels-origins-our-beginners-guide/ (Matt Thrower, 8 July 2015):
    - "pick a common deck archetype and will then suggest cards to fit that archetype"
    - "It even does it in stages"
    - "The Deck Wizard tries to steer you toward two colours"
    - "One thing the Deck Wizard doesn't do is watch the cost of your cards"
  - https://geekdad.com/2015/07/magic-ios/ (14 July 2015): "the app will automatically score your deck based on speed, strength, control, and synergy".

  **Severity:** missing.

- **Missing entry: Hearthstone Deck Recipes** (March 2016). Each class gets three designer-made lists, two of them themed "around certain card types or mechanics". Missing cards are swapped in from the player's collection with "Suggest a Card". This is the hand-designed themed template, filled from what the player owns, and it sits between Jumpstart (idea 5) and the Smart Deck Builder.
  **Evidence:** https://hearthstone.blizzard.com/en-us/blog/20056279 (8 March 2016):
  - "Three are available for each class, including one classic recipe, and two themed recipes."
  - "Themed recipes revolve around certain card types or mechanics."
  - "Suggest a Card" "will help you replace it with a card from your collection".

  **Severity:** missing.

- **Missing entry: Pokemon TCG Pocket's Auto-build.** The section lists Pokemon TCG Live as having no auto-build, but skips Pocket (2024). By guide accounts, Pocket auto-builds a 20-card deck from owned cards after the player picks energy types. That is our 20-card size, on a phone.
  **Evidence:** Search results from third-party guides (GameWith, PokemonGoHub, Digital Trends) all describe "Auto-build" filling a deck from owned cards after choosing energy types. No official page was found, so mark it as a secondary source.
  **Severity:** missing.

- **Missing detail: Arena's land algorithms.**
  - Jump In!'s basics are "balanced for the costs and activated abilities on the spells in your packets", which is an automatic mana base worth noting for `lands.ts`.
  - Its per-slot random alternates are a real, shipped slot template, which supports idea 5 directly.
  - The Suggest Lands guide, which the section says it saw only as a search result, was opened for this check. It says the button is on by default, adds only basics by color makeup, defaults to 24 lands in Constructed and 17 in Limited, and turns off when the player edits lands. It is still a community source.

  **Evidence:**
  - Jump In! page above ("Lands" section).
  - https://sites.google.com/view/asap-bg-to-mtga/using-arena: the guide says Suggest Lands defaults to 24 lands total in Constructed and 17 in Limited, is "turned on by default, and turns off if you alter lands yourself".

  **Severity:** missing.

- **Missing detail: Blizzard's card power is re-scored as the deck fills.** Idea 7 credits re-scoring after each pick only to Stiegler. Blizzard's back-fill does the same ("changes dynamically based on the deck's current composition") and still ignores synergy. So re-scoring helps only if the score includes a setup and payoff term. That is worth saying next to idea 7.
  **Evidence:** Blizzard post: "This number is not a constant and changes dynamically based on the deck's current composition."
  **Severity:** missing.

- **Missing research:** The simulator section omits three papers:
  - **Bjorke and Fludal 2017**, "Deckbuilding in Magic: The Gathering Using a Genetic Algorithm" (NTNU master's thesis). It is the one Magic-specific paper in this family.
  - **Bhatt et al. 2018**, "Exploring the Hearthstone deck space" (FDG).
  - **Janusz et al. 2018**, the AAIA'18 overview. It explains where Betley's decks came from.

  These omissions are unlikely to change the conclusion (simulation is too slow for a phone), but the Magic thesis should at least be named.
  **Evidence:** Fontaine et al., https://arxiv.org/abs/1904.10656, related work and references [3], [4], [29]: "Similar approaches proved successful for the deckbuilding game Magic: The Gathering [4]".
  **Severity:** missing.

- **Missing format fields.** The brief asks every entry to cover plan, cards, mana and curve and interaction, data, speed and determinism and license, and bulk fit. Some entries skip fields:
  - Marvel Snap has no speed or determinism line.
  - Jump In! never says that packet offers and alternate slots are random, so the result is not deterministic.
  - The Master Duel, Duel Links, and Shadowverse group has no bulk-fit line.

  Shadowverse's help page also has an option the section omits: it can auto-complete a full deck from a bought prebuilt deck plus the player's collection. That is a seed-completion mode.
  **Evidence:**
  - games.md lines 23 to 53.
  - https://shadowverse.com/help/: "Automatically create a deck of 40 cards from your collection", and after buying a prebuilt deck "you are given the option to automatically create a full deck".

  **Severity:** missing (minor).

- **Resolved unverified item: the wiki license.** The hearthstone.wiki.gg page footer says "Creative Commons Attribution-Non-Commercial-ShareAlike 4.0 License unless otherwise noted". The sources list says "not checked" and should say this instead. Ideas only either way.
  **Evidence:** https://hearthstone.wiki.gg/wiki/Patch_14.0.0.29933 (footer).
  **Severity:** missing (minor).

## Confirmed as written

Each of these was checked against the source named and holds:

- **Blizzard post** (Tian Ding, 28 March 2019):
  - the "millions of variations of decks" quote and the archetype examples;
  - sub-layers by rank, with no rule given for choosing a cluster;
  - card power is per class and made of win-rate contribution and mana-cost bucket;
  - the "unique synergies and combo potential" quote and "significantly better than the alternatives";
  - the Prince Keleseth rule;
  - different decks on repeated empty requests;
  - nothing stated about speed or where it runs.
- **Patch 14.0** (4 April 2019): one-click completion and the "some time" after Rise of Shadows quote.
- **Hearthstone Top Decks test:** date and author, plus the Grand Archivist, Spellstone, Electra, and Mech Paladin examples.
- **Marvel Snap Zone guide:**
  - author "den", published 14 December 2023, autofill in the 5 December 2023 patch;
  - the patch note quotes and the 1 to 11 cards;
  - "a popular shell of the metagame in place when the last patch happened";
  - "typically the first one".
- **Master Duel** (Game8, version 2.1.0, 7 November 2024): the AI quote and the two modes. Konami's own notice was not found.
- **Duel Links:** Konami guide quote.
- **Shadowverse:** help page quote; the page covers the original Shadowverse.
- **Beyer 2020 Jumpstart article:**
  - the "miniature 20-card theme decks", "mechanical heart", "lands and creatures..." and "ease the load" quotes;
  - the sample Predatory packet has 8 lands (6 Forest, Predatory Forest, Thriving Grove) and 7 creatures.
- **State of the Formats 2026** (Dave Finseth, 11 September 2026): the "data on card picks" quote. No method given.
- **Q-DeckRec:**
  - 300 matches per evaluation;
  - GA at 25 min wall time and 15.9 CPU hours;
  - 0.38 seconds wall and 9.63 seconds CPU per request;
  - 1 to 3 days of training;
  - 312 Warrior cards, every card forced to two copies;
  - MetaStone; card replacement actions; one opponent deck.
- **MAP-Elites:**
  - 171 cards per class;
  - behavior axes of average mana and mana variance;
  - 200 games per evaluation, 10,000 evaluations, 500 CPU nodes;
  - aggro or control set by the playing heuristic;
  - Fontaine's one-sentence description of Stiegler's greedy re-scoring.
- **Kowalski and Miernik:** 160 cards, one value per card, and the "taking to account card synergies or controlling a mana curve" quote.
- **Garcia-Sanchez 2016:** CIG 2016, "human-made decks", IRIS rights reserved, no full text.
- **Stiegler 2016:** the abstract's five metrics, scratch and hole-filling modes, the esports hole test, and the DOI.
- **Betley 2018:**
  - the distance (30 minus shared cards) over 30, and DBSCAN;
  - 5 to 10 near-universal cards, with the Murloc Paladin example;
  - 2,821 popular decks and the pair "quotient" (exact form not given);
  - pair strength averaged over the deck;
  - the one-mana add or remove feature;
  - no license on the paper page.
- **Licenses:**
  - SabberStone is AGPL-3.0, MetaStone GPL-2.0, and EvoSabber has none (checked with the GitHub API);
  - all three arXiv papers use the non-exclusive distribution license 1.0, and the GECCO PDF carries an ACM notice.
- **Local data:** `data/corpus/decks.json` holds 1,441 precons and 54,000 draft decks, each with `wins` and `games` (checked with node).
- **No copied code:** the section contains no code and no quote longer than a sentence. No em-dashes.
