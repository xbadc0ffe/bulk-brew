## Auto-build in digital card games, and deck-building research

Several digital card games offer a button that finishes a deck: Hearthstone, Marvel Snap, Yu-Gi-Oh! Master Duel and Duel Links, Shadowverse, and Pokémon TCG Pocket. MTG Arena has none for constructed decks, and searches found none in four other games. Few say how their button works; Blizzard is the exception. Two older designs, Hearthstone's Deck Recipes and Magic Duels' Deck Wizard, start from a themed plan instead. The research splits in two: deck search by simulating games, and cheaper scoring by rules or by how often cards appear together in real decks.

Nearly everything here works inside a card set designed for the game, where every card is meant to be playable and millions of games show which decks are good. A bulk pool is the opposite: thousands of mostly weak cards and no play data for most of them. A score that rates single cards with no setup-and-payoff term invites the owner's Graveyard failure, payoffs without enablers. An independent Hearthstone test found such decks, though it cannot say which part of the builder chose them. Each idea at the end says whether a source shows it or it is our own. Claims were checked on 2026-11-08 and corrected after a fact check the same day; secondary sources are marked.

### Hearthstone: Smart Deck Builder ("Complete My Deck")

**What and where.** Blizzard's in-client deck completer, described by data scientist Tian Ding in [Developer Insights: Smart Deck Builder](https://hearthstone.blizzard.com/en-us/news/22938500/developer-insights-smart-deck-builder) (28 March 2019); [Patch 14.0](https://hearthstone.wiki.gg/wiki/Patch_14.0.0.29933) (4 April 2019) extended it. The player gives a class, any chosen cards, and their collection; it returns a 30-card Standard deck of owned cards.

**Plan.** The first layer, the "meta layer", clusters popular decks ("millions of variations of decks") into archetypes such as "Secret Hunter" or "Dragon Priest". Then, "combined with other mathematical solutions, the algorithm then dynamically fills your deck until the deck is full", or hands over to the second layer. Sub-layers pick different meta decks by player rank. The post does not say how the cluster is chosen, or whether cards are placed one at a time or in groups. From an empty deck, repeated requests give different decks.

**Cards.** The meta layer fills toward a popular deck of the matched archetype, so setup and payoff probably arrive together. That is our reading: Blizzard never says the layer copies or places packages. If the collection cannot fill 30 cards that way, a "back-fill layer" adds, one at a time, the card with the best per-class "card power": its win-rate impact, how its cost fits an unfilled slot, and penalties such as a full cost bucket. Card power "changes dynamically based on the deck's current composition", yet it is computed "without considering unique synergies and combo potential".

An [independent test](https://www.hearthstonetopdecks.com/complete-my-deck-how-good-is-netdecking-within-the-hearthstone-client/) (Old Guardian, 15 March 2019) found decks with payoffs and no enablers: Grand Archivist "but there were no spells", Lesser Emerald Spellstone in a deck "that had no Secrets", and Electra Stormsurge with no cards that synergize with her. The tester summed it up as cards "it considered powerful, but which could not function without synergy cards that were not present in the decks". The test came out two weeks before Blizzard described the two layers and does not say which layer chose these cards. The synergy-blind back-fill is a plausible cause, not a finding. Other failures point at the meta side: off-meta seeds were pulled toward known archetypes, and every attempt at a Mech Paladin came back as Odd Paladin or Secret Paladin.

**Mana, curve, interaction.** Hearthstone has no lands, so mana is only the curve. The back-fill is reluctant to add a card to a cost bucket that already holds 10 cards unless it is "significantly better than the alternatives". Blizzard also mentions "many quality assurance rules" within both layers, without saying how they were made; the example given is avoiding two-cost cards when Prince Keleseth is in the deck. Interaction is not mentioned.

**Data.** Ranked decklists in volume, plus per-card win-rate impact; Patch 14.0 says it needs "some time" after a set launches to gather data. Bulk Brew has decklists (1,441 precons and 54,000 17Lands draft decks with wins and games in `data/corpus/decks.json`, plus EDHREC pages) but no per-card win rates for constructed or Commander play.

**Speed, determinism, license.** Speed and where it runs are not stated (unverified). Not deterministic from an empty deck, by design. Proprietary; ideas only.

**Bulk on a phone.** A bulk pool rarely holds most of any known deck, so most builds would fall to the back-fill, the layer that ignores synergy. Our lesson: every layer that adds cards, including the fallback, must keep setup and payoff together.

### Hearthstone: Deck Recipes

**What and where.** Added in March 2016, per Blizzard's [Let's Get Brewing with Deck Recipes!](https://hearthstone.blizzard.com/en-us/blog/20056279) (8 March 2016). Each class has three designer-made lists: one "classic" recipe of Basic and Classic cards, and two "themed" recipes.

**Plan and cards.** Themed recipes "revolve around certain card types or mechanics" and "generally promote synergy between the cards included in the recipe". Examples are a Hunter deck built on Trap spells and a Shaman Murloc deck. The plan and the setup-to-payoff balance are the designer's. Missing cards are greyed out; clicking one opens "Suggest a Card", which "will help you replace it with a card from your collection". The post does not say how the substitute is chosen.

**Mana, data, speed, license.** Curve and interaction come with the hand-made list. No play data is named. How substitutes are picked, and how fast, is not stated. Proprietary.

**Bulk on a phone.** This is a hand-designed themed template filled from what the player owns, between Jumpstart's packets and the Smart Deck Builder. Each recipe assumes the player owns most of it, which a bulk pool rarely does, so the substitute step would carry most of the load.

### Marvel Snap: Deck Builder autofill

**What and where.** Second Dinner added autofill in the 5 December 2023 patch. The patch notes, as quoted by [Marvel Snap Zone](https://marvelsnapzone.com/autofill-deck-builder-guide/) (guide by "den", published 14 December 2023), say the builder "analyzes vast amounts of Data and Statistics from Live Games, taking your collection into account", and that its data "is updated regularly". The player picks 1 to 11 cards; it fills the 12-card deck.

**Plan and cards.** It appears to complete a known popular shell. The reviewer found it good when the seed fits "a popular shell of the metagame" from the last patch; otherwise it drops lone cards into shells they do not help. Asked for several cards, it builds around one, "typically the first", and ignores the rest.

**Mana, data, license, bulk fit.** Curve handling is not documented. Speed, and whether the same request gives the same deck, are not documented either. It needs live match statistics, which Bulk Brew lacks. Proprietary. Same limit as Hearthstone's meta layer: it works only where play data already defines the deck.

### Other games: Master Duel, Duel Links, Shadowverse, Pokémon TCG Pocket

These have auto-build buttons with almost no public method.

- **Yu-Gi-Oh! Master Duel** added Auto-Build in version 2.1.0 (7 November 2024). [Game8](https://game8.co/games/Yu-Gi-Oh-Master-Duel/archives/483223) says it generates a deck "with the help of AI, based on the Decks of players around the world". That points to decklists, not match statistics. "Build New Deck" makes one "completely at random"; "Add rest of the cards to this Deck" completes around chosen cards. No source tests how good its decks are (secondary source; Konami's own notice not found).
- **Yu-Gi-Oh! Duel Links**: Konami's [guide](https://www.konami.com/yugioh/duel_links/en/guide/) says "Create Auto-Deck" "will build a Deck for you". No method given.
- **Shadowverse**: the [official help](https://shadowverse.com/help) says: "Select a class character and a deck will be automatically created with the cards you own", a 40-card deck. After buying a prebuilt deck, "you are given the option to automatically create a full deck" from those cards plus the collection, a seed-completion mode. No method given. The page covers the original Shadowverse.
- **Pokémon TCG Pocket** (2024): a [Digital Trends guide](https://digitaltrends.com/gaming/best-tips-on-making-a-good-deck-pokemon-trading-card-game-pocket) (31 October 2024) says auto-build creates a deck "based on the Pokémon types of your choosing", and that it "won't always create the perfect deck" (secondary source; no official description found). Decks are 20 cards, per the [official Pokémon guide](https://www.pokemon.com/uk/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket). That is our 20-card size, on a phone.

**Bulk fit.** With no method published, only the interface carries over: build from scratch, complete around chosen cards, or, as in Pocket, let the player pick types first. Master Duel's reliance on players' decklists has the same limit as Hearthstone's meta layer.

Searches found no documented auto-build in Legends of Runeterra, Gwent, Eternal, or Pokémon TCG Live (absence not proven).

### Magic Duels: Deck Wizard

**What and where.** Magic Duels: Origins (Wizards of the Coast, July 2015, reviewed on iPhone and iPad) has a Deck Wizard. It is the one official Magic game in this survey that builds around an archetype. Only press guides describe it (secondary sources).

**Plan.** The player picks "a common deck archetype", such as Magical Armour (pumping creatures) or Control the Sky (flyers), per [Pocket Gamer](https://www.pocketgamer.com/magic-duels-origins/how-to-get-started-with-magic-duels-origins-our-beginners-guide/) (Matt Thrower, 8 July 2015). The plan comes first, then the cards.

**Cards.** The wizard "will then suggest cards to fit that archetype", and "It even does it in stages, so you can get a sense of how the suggested cards should work together". It "tries to steer you toward two colours". [GeekDad](https://geekdad.com/2015/07/magic-ios/) (14 July 2015) says the app scores a built deck "based on speed, strength, control, and synergy", and that a wizard deck cannot be edited outside the wizard once built. What each stage adds, and how the four scores are computed, is not described.

**Mana, curve, interaction.** "One thing the Deck Wizard doesn't do is watch the cost of your cards", per Pocket Gamer. Lands and interaction are not described.

**Data, speed, determinism, license.** Not described. Proprietary.

**Bulk on a phone.** The closest match to our flow: pick a plan, then add cards in stages. Stages could put setup before payoff, but that is our reading; the sources do not say what the stages hold. Its known gap, ignoring cost, is one a curve pass covers.

### MTG Arena: Jump In!, lands, and Quick Draft bots

**What and where.** I found no constructed auto-build in Arena. Jump In! is a pick-two-packets event much like paper Jumpstart, though neither source below links the two and the packets differ. Doug Beyer describes the paper design in [Behind the Scenes of Designing Jumpstart](https://magic.wizards.com/en/news/card-preview/behind-scenes-designing-jumpstart-2020-06-17) (17 June 2020). The [Duskmourn Jump In! update](https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-duskmourn-house-of-horror) (24 September 2024) gives Arena's event rules and packet lists.

**Plan.** The player picks one of three hand-designed themed packets, then one of three more, and plays "a combined deck with added basic lands". Second-packet options depend on the first, but only partly. For a one-color first pick, "All multicolor options will contain the color of the first packet selection"; monocolor options can be any color. Only after a two- or three-color first pick does the page say "No monocolor option will be outside of the first packet selection's colors". The plan is whatever the designers built into each packet.

**Cards.** Paper packets are "like miniature 20-card theme decks", each with "a flavorful theme and a mechanical heart". Each holds "lands and creatures, ways to interact with your opponent, powerhouse cards to help you close out the game, and a sensible mana curve", so any two packets make a complete deck. Some paper themes come in up to four variant lists that keep "the same general flavor, mana curve, and game plan". Setup and payoff fit because a designer put both in the same packet. In Beyer's words, "if you want to ease the load on the player, you have to put that load on the design work."

Arena's Duskmourn packets are smaller. Each lists 12 cards, and only 4 of the 10 include a land (packet lists checked against `data/packs/cards.json`). Each packet then has a "Variability" table: three or four slots draw one of two or three alternates at stated odds, for example Final Vengeance or Murder at 50% each. That is a shipped slot template: the slot holds a role, and the card in it varies.

**Mana, curve, interaction.** The sample paper Predatory packet has 8 lands (six Forests, a themed Forest, a Thriving land) and 7 creatures. Arena instead adds basics itself, "balanced for the costs and activated abilities on the spells in your packets", plus dual lands "in the colors appropriate to your deck", which are counted before the basics. Outside Jump In!, Arena's Suggest Lands button adjusts lands by the deck's color makeup, adding only basics, with 24 lands in Constructed and 17 in Limited by default. It is on by default and turns off when the player edits lands, per a [community guide](https://sites.google.com/view/asap-bg-to-mtga/using-arena) (community source).

**Draft bots.** [State of the Formats 2026](https://magic.wizards.com/en/news/mtg-arena/state-of-the-formats-2026) (Dave Finseth, 11 September 2026) says Wizards gathers "data on card picks" for a few days after a set launches to update the Quick Draft algorithm. The method is not described.

**Data, determinism, license, bulk fit.** Hand-designed packets and human pick data. Alternate slots are drawn at stated odds, so the same two packets can give different decks: not deterministic. How the basics are balanced is not described. Proprietary. The template is cheap and phone-friendly, but a bulk builder must fill it from weak cards itself.

### Research: deck search with a game simulator

**What and where.** Four papers search for decks by playing simulated games:

- García-Sánchez and others, [Evolutionary deckbuilding in Hearthstone](https://iris.polito.it/handle/11583/2666239) (CIG 2016): a genetic algorithm scored by simulated games against human-made decks. Abstract only.
- Chen and others, [Q-DeckRec](https://arxiv.org/abs/1806.09771) (CIG 2018): learns a card-swap search policy so new requests need no simulation.
- Fontaine and others, [MAP-Elites with Sliding Boundaries](https://arxiv.org/abs/1904.10656) (GECCO 2019): keeps the best deck per cell of a behavior grid.
- Kowalski and Miernik, [Arena deckbuilding using active genes](https://arxiv.org/abs/2001.01326) (CEC 2020): evolves draft policies for Legends of Code and Magic.

Fontaine and others cite two more:

- Bhatt and others, Exploring the Hearthstone deck space (FDG 2018): per Fontaine and others, evolves starter decks "by evaluating decks against a single AI opponent". Not read.
- Bjørke and Fludal, [Deckbuilding in Magic: The Gathering Using a Genetic Algorithm](https://hdl.handle.net/11250/2462429) (NTNU master's thesis, 2017), the one Magic-specific work found. The abstract describes "a system for automatic card selection using a genetic algorithm", judged by "an expert analysis". Fontaine and others group it with the evolutionary work above. How it scores a deck is unverified: the record was read, but the full-text download was refused.

**Plan.** None is chosen from the cards. Q-DeckRec targets one opponent deck. In MAP-Elites the play style (aggro or control) is set by the simulated player's heuristic, and decks are spread over two axes: average mana cost and its variance.

**Cards.** Synergy appears only through simulated win rate. Nothing models setup and payoff. Kowalski and Miernik represent a draft policy as one value per card (160 cards) and state that ignoring earlier picks removes "taking to account card synergies or controlling a mana curve".

**Mana, curve, interaction.** Left to the simulator, apart from the MAP-Elites curve axes.

**Data.** A full rules simulator with an AI player: [MetaStone](https://github.com/demilich1/metastone) (GPL-2.0) for Q-DeckRec, [SabberStone](https://github.com/HearthSim/SabberStone) (AGPL-3.0) for MAP-Elites. Bulk Brew has no simulator.

**Speed, determinism, license.** All Q-DeckRec timings come from a 56-core server, with "match simulations evenly spread on all cores". On it, scoring a deck with 300 simulated matches takes about 5 seconds; on one core that would be a few minutes (our estimate from the paper's wall and CPU times). A 25-minute genetic search used 15.9 CPU hours. After three days of training, Q-DeckRec solved a request in 0.38 seconds wall time (9.63 CPU seconds). MAP-Elites ran 10,000 evaluations of 200 games each on a 500-node cluster. All are stochastic. The pools were small and designed: 312 Warrior cards, each forced to two copies, in Q-DeckRec; 171 cards per class in MAP-Elites. Papers: arXiv non-exclusive license or IEEE/ACM copyright; the thesis is under copyright per the NTNU record. The MAP-Elites code, [EvoSabber](https://github.com/tehqin/EvoSabber), has no license on GitHub, so no reuse.

**Bulk on a phone.** Not usable: no simulator, and orders of magnitude too slow.

### Research: scoring without simulation

**What and where.** Stiegler and others, [Hearthstone deck-construction with a utility system](https://research-portal.uws.ac.uk/en/publications/hearthstone-deck-construction-with-a-utility-system/) (SKIMA 2016, DOI 10.1109/SKIMA.2016.7916192), abstract only. Betley, Sztyber and Witkowski, [Predicting winrate of Hearthstone decks using their archetypes](https://annals-csis.org/Volume_15/drp/pdf/362.pdf) (FedCSIS 2018), open PDF. Their decks came from the AAIA'18 data mining contest, described by Janusz and others in [Toward an Intelligent HS Deck Advisor](https://annals-csis.org/Volume_15/drp/pdf/386.pdf) (FedCSIS 2018 position papers).

**Plan.** Stiegler's abstract lists "strategic deck parameters" among its metrics; how a plan is chosen is unverified. Betley and others clustered the contest's training and test decks together, about 600 (400 training, 200 test), with a simple distance, (30 minus shared cards) divided by 30, using DBSCAN. The 11 clusters fall along hero classes (two each for Paladin and Warlock, one for each other class), with 25 decks left out. Each cluster had 5 to 10 cards that "appeared in almost every deck", such as a set of Murloc minions in one Paladin cluster.

Those clean clusters are built into the data. The contest decks "were created by randomly mutating a set of 13 deck archetypes" (12 top-rated ladder archetypes and one group of basic-card decks), per Janusz and others. So each cluster is roughly one seed deck plus noise. The authors asked whether the decks were random or "followed the pattern of human players decks", not how to find themes in real decks.

**Cards.** Stiegler's utility combines cost effectiveness, mana curve, card synergies, strategic parameters, and community popularity. It builds from scratch or fills holes in a deck skeleton; it was tested on holes in esports decks. Fontaine and others describe it as adding the highest-utility card, then recomputing the rest of the pool. How synergy is defined is unverified. Betley and others measured "card pair connection strength" from 2,821 popular decks. It is the quotient of how often two cards appear together and how often they appear at all (exact formula not given), averaged over all pairs in a deck. They used it to predict win rate, not to build.

**Mana, curve, interaction.** Stiegler has a curve metric. Betley and others count one-mana cards added or removed against the archetype deck.

**Data.** Popular decklists and card popularity. Bulk Brew has these: the corpus, EDHREC pages, and Spellbook combos.

**Speed, determinism, license.** Greedy fill with re-scoring is cheap and deterministic with fixed tie-breaks. No code was seen for either. Stiegler: IEEE; the FedCSIS pages state no license.

**Bulk on a phone.** The best fit in this family. The catch is sparsity: most bulk cards appear in few real decks, so pair counts are thin outside commons from recent draft sets. Betley's clusters say nothing about how well clustering works on decks that are not mutations of a few seeds, such as our precons and draft decks.

### Ideas worth borrowing

Each idea says whether a source shows it or it is our own, prompted by a source.

1. **Packages first, single cards last.** Ours. Mine setup-and-payoff packages from the corpus and EDHREC, place them as units, then fill. Prompted by Blizzard's two layers: the meta layer fills toward a popular archetype deck, and the back-fill scores cards alone without synergy. Blizzard does not say the meta layer places packages.
2. **The fallback keeps the dependency.** Ours. A payoff may enter only when enough separate enablers are already in, counted apart from the payoff. Prompted by the Hearthstone Top Decks test, which found payoffs such as Grand Archivist with no spells; it does not say which layer chose them.
3. **Small conditional rules.** Shown by Blizzard: its quality-assurance rules ("with Prince Keleseth, avoid two-cost cards") are if-this-then-require-or-avoid checks. Using a short per-theme list to catch dead payoffs is ours.
4. **Soft caps per cost bucket.** Shown by Blizzard's back-fill: refuse a card for a cost bucket that already holds 10 cards unless it is clearly better than the alternatives. A cheap curve control for greedy fill.
5. **A slot template for half-decks.** Shown by Jumpstart and Jump In!. Each paper packet holds lands, creatures, interaction, finishers, and a curve, with theme support and payoff inside it, and Arena's packets fill some slots from listed alternates. Building 20-card themed cores to a slot template and pairing two for 40 cards is ours. If the second core's colors should depend on the first, note that Jump In! bounds only the multicolor options after a one-color first pick (Beyer 2020; Arena Jump In! update 2024).
6. **Core cards from simple clusters.** Ours, untested. Clustering decks by shared-card count might define themes on the corpus without broad tags like `mill-self`. Betley and others found 5 to 10 near-universal cards per cluster, but their decks were mutations of 13 seed decks, so that result is not evidence the idea works on real decks (Betley, Sztyber and Witkowski 2018; Janusz and others 2018).
7. **Re-score after every pick, with a synergy term.** Shown by Stiegler and others 2016 (as described by Fontaine and others 2019) and by Blizzard's back-fill. Recomputing each remaining card's value after every addition lets an enabler's value rise once payoffs are in, and the reverse. Blizzard's card power also "changes dynamically based on the deck's current composition" yet ignores synergy, so re-scoring helps only if the score has a setup-and-payoff term.
8. **Diversity across curve cells.** Shown by Fontaine and others 2019 with a simulator: keep the best deck per cell of average cost and cost spread, not one overall best, to offer different shapes. Using it with a cheap scorer instead is ours.
9. **Plan first, then cards in stages.** Shown by Magic Duels' Deck Wizard and Hearthstone's Deck Recipes: the player picks an archetype or a themed recipe before any card is chosen, and the Deck Wizard suggests cards in stages. What the stages hold is not documented; ordering them setup before payoff is ours.
10. **Basics from the spells.** Shown by Jump In!: Arena balances basics "for the costs and activated abilities on the spells in your packets", after counting nonbasics. Worth comparing with `lands.ts` (Arena Jump In! update 2024).

### Sources

All read 2026-11-08.

- Blizzard, Developer Insights: Smart Deck Builder, https://hearthstone.blizzard.com/en-us/news/22938500/developer-insights-smart-deck-builder. Proprietary; no license stated.
- Blizzard, Let's Get Brewing with Deck Recipes!, https://hearthstone.blizzard.com/en-us/blog/20056279. Proprietary; no license stated.
- Hearthstone Wiki, Patch 14.0.0.29933, https://hearthstone.wiki.gg/wiki/Patch_14.0.0.29933. CC BY-NC-SA 4.0 unless otherwise noted, per the page footer; ideas only.
- Hearthstone Top Decks, Complete My Deck test, https://www.hearthstonetopdecks.com/complete-my-deck-how-good-is-netdecking-within-the-hearthstone-client/. No license stated.
- Marvel Snap Zone, Autofill Deck Builder Guide, https://marvelsnapzone.com/autofill-deck-builder-guide/. No license stated.
- Game8, Master Duel update page, https://game8.co/games/Yu-Gi-Oh-Master-Duel/archives/483223. No license stated.
- Konami, Duel Links guide, https://www.konami.com/yugioh/duel_links/en/guide/. Proprietary.
- Cygames, Shadowverse help, https://shadowverse.com/help. Proprietary.
- Digital Trends, How to make a good deck in Pokémon Trading Card Game Pocket, https://digitaltrends.com/gaming/best-tips-on-making-a-good-deck-pokemon-trading-card-game-pocket. No license stated.
- The Pokémon Company, Learn How to Build a Deck in Pokémon TCG Pocket, https://www.pokemon.com/uk/strategy/learn-how-to-build-a-deck-in-pokemon-tcg-pocket. Proprietary.
- Pocket Gamer, Magic Duels: Origins beginner's guide, https://www.pocketgamer.com/magic-duels-origins/how-to-get-started-with-magic-duels-origins-our-beginners-guide/. No license stated.
- GeekDad, Magic Duels on iOS, https://geekdad.com/2015/07/magic-ios/. No license stated.
- Wizards of the Coast, Behind the Scenes of Designing Jumpstart, https://magic.wizards.com/en/news/card-preview/behind-scenes-designing-jumpstart-2020-06-17. Proprietary.
- Wizards of the Coast, Jump In! Packets Update for Duskmourn, https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-duskmourn-house-of-horror. Proprietary.
- Wizards of the Coast, MTG Arena State of the Formats 2026, https://magic.wizards.com/en/news/mtg-arena/state-of-the-formats-2026. Proprietary.
- ASAP Beginner's Guide to MTG Arena, https://sites.google.com/view/asap-bg-to-mtga/using-arena. Community source; no license stated.
- García-Sánchez and others, Evolutionary deckbuilding in Hearthstone, IRIS record https://iris.polito.it/handle/11583/2666239. All rights reserved per the record.
- Chen and others, Q-DeckRec, https://arxiv.org/abs/1806.09771 (full PDF read). arXiv non-exclusive distribution license 1.0.
- Fontaine and others, MAP-Elites with Sliding Boundaries, https://arxiv.org/abs/1904.10656 (full PDF read). arXiv non-exclusive distribution license 1.0; ACM copyright in the PDF.
- Kowalski and Miernik, Arena Deckbuilding using Active Genes, https://arxiv.org/abs/2001.01326 (full PDF read). arXiv non-exclusive distribution license 1.0.
- Bhatt and others, Exploring the Hearthstone deck space, FDG 2018. Not read; cited from Fontaine and others.
- Bjørke and Fludal, Deckbuilding in Magic: The Gathering Using a Genetic Algorithm, https://hdl.handle.net/11250/2462429 (record and abstract only; full text refused). Copyright act per the NTNU record.
- Stiegler and others, Hearthstone deck-construction with a utility system, https://research-portal.uws.ac.uk/en/publications/hearthstone-deck-construction-with-a-utility-system/ (abstract only). IEEE; license not shown.
- Betley, Sztyber and Witkowski, Predicting winrate of Hearthstone decks using their archetypes, https://annals-csis.org/Volume_15/drp/pdf/362.pdf (full PDF read). No license stated.
- Janusz and others, Toward an Intelligent HS Deck Advisor: Lessons Learned from AAIA'18 Data Mining Competition, https://annals-csis.org/Volume_15/drp/pdf/386.pdf (deck-origin passage read). No license stated.
- EvoSabber, https://github.com/tehqin/EvoSabber. No license (GitHub API).
- SabberStone, https://github.com/HearthSim/SabberStone. AGPL-3.0 (GitHub API).
- MetaStone, https://github.com/demilich1/metastone. GPL-2.0 (GitHub API).
