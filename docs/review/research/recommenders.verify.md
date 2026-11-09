## Fact check: Data-driven card recommenders

Checked 2026-11-08 against the cited sources and the local files. Scratch work is in `data/review/scratch/recommenders-verify/` and `data/review/scratch/recommenders-verify-*.cjs`.

### Verdict

Needs fixes. Most facts hold up: the Krenko average-deck check, the Brainstorm numbers, the FDN game count, the 17Lands metric definitions and licenses, the EDHREC Terms and FAQ quotes, and the MTGA_Draft_17Lands README numbers all match their sources. But the Netrunner paper is misread in a way that changes idea 5, one "only builder" claim is contradicted by our own draft section, a published description of EDHREC's Recs method is missed, and two of the six ideas overstate what the data can show.

### Issues

- **Claim:** Sephton et al. name as a weakness that "rules fire only from the observed cards and are not re-checked as predicted cards are added", and idea 5 borrows "the weakness Sephton et al. name".
  - **Problem:** The paper tests exactly that fix. Its variant a7, "Making confident predictions", adds each predicted card to the observed set and checks all rules again. a7 is the paper's best variant, and the 13% gain is measured from a1 to a7. The paper reports that re-checking helped at higher minimum support and had "almost no effect" at 15 and below. Idea 5 should cite a7 as a tested method with mixed results, not as an open weakness.
  - **Evidence:** https://eprints.whiterose.ac.uk/id/eprint/104807/ (PDF in `data/review/scratch/recommenders/netrunner.txt`): section on a7 ("when we predict a card, we add it to the observed card set and check all rules again"), results G ("positive effect ... at higher values of minimum support, however it has almost no effect at values of 15 and below"), conclusion ("maximum improvement of 13% between the default apriori algorithm (a1) and our optimal modified algorithm (a7)").
  - **Severity:** wrong.

- **Claim:** "Game knowledge (copy limits, spending the influence budget first, separate rules for out-of-faction cards) raised accuracy by up to 13 points", and under Mana "domain rules like that improved it most".
  - **Problem:** The 13% gain is a1 to a7, which also includes rule-size priority (a6) and re-checking (a7), not game knowledge alone. Per-step gains in the paper: duplicates about 5 points, influence priority under 2, influence filtering about 4. Nothing in the paper says domain rules improved it most. The paper also writes "13%", not "13 points".
  - **Evidence:** Same PDF, results sections B to G and the conclusion.
  - **Severity:** misleading.

- **Claim:** MTGA_Draft_17Lands "is the one published builder on 17Lands data we verified".
  - **Problem:** Ryan Saxe's `mtg` repository (Apache-2.0) has a `DeckBuilder` model trained on 17Lands data: a denoising autoencoder that turns a draft pool into a 40-card deck, with a separate head for basics. Our own `draft.md` section verifies and describes it. The recommenders section should cross-reference it rather than call MTGA_Draft_17Lands the only one.
  - **Evidence:** https://github.com/RyanSaxe/mtg (README: "State of the art Magic: the Gathering Draft and DeckBuilder AI"; `mtg/ml/README.md`: "a model for deckbuilding, `DeckBuilder`" fed with 17lands data; `mtg/ml/models.py` docstring: "This algorithm is an Denoising AutoEncoder"). Also `docs/review/research/draft.md`, section "Ryan Saxe's DeckBuilder (17Lands data)".
  - **Severity:** wrong.

- **Claim:** EDHREC Recs is "described only as suggesting 'cards that often see play with the things already in my list'" and "the method is not published".
  - **Problem:** EDHREC's founder described the method publicly in 2015. Version 1 was user-based collaborative filtering with decks as users and cards as items. Version 2 was an offline card-to-card affinity matrix using Jaccard (Tanimoto) similarity: for a deck, it sums the rows of the deck's cards and shows the top scores. The talk also says splitting by color combination weakened themes that span colors. The current method may differ, but saying nothing was published is wrong. Jaccard is symmetric like lift, which supports the section's own point. The 2024 Digital Deckbuilding guide also says Recs work "based on comparisons to similar deck lists", so "described only as" is not accurate either.
  - **Evidence:** Donald Miner, "EDHREC @ Data Science MD", 2015-09-21, https://www.slideshare.net/slideshow/edhrec-data-science-md/53058725. Digital Deckbuilding guide: "The Recs page takes your decklist and produces customized recommendations based on comparisons to similar deck lists."
  - **Severity:** missing.

- **Claim:** Idea 1, "Directional counts to separate setup from payoff", using association-rule confidence because lift is symmetric.
  - **Problem:** For one pair of cards, the two confidences only reflect popularity. conf(A to B) divided by conf(B to A) always equals P(B) divided by P(A). So directional confidence adds nothing about which card feeds which beyond how common each card is. The idea's body (decks holding at least k separate setup cards, against the base rate) is a set-level test that could help, but it needs setup and payoff labels from somewhere else, such as the theme guide. Co-occurrence alone cannot "separate" setup from payoff. The title and summary should say it tests whether a labeled payoff needs labeled setup.
  - **Evidence:** The definitions in Sephton et al. (support = count(X and Y)/N, confidence = count(X and Y)/count(X)) give the identity directly.
  - **Severity:** misleading.

- **Claim:** Idea 2 says to split the pair win-rate comparison "by `num_turns` and the skill bucket to blunt the game-length and skill biases".
  - **Problem:** Game length is affected by the cards drawn and by who wins, so splitting by it conditions on something that happens after the cards are drawn. The cited paper names this kind of "post-treatment conditioning" as a source of bias in 17Lands data. Splitting by turns can create bias as well as remove it. The idea should say so and suggest checks, such as on-play splits or comparing the same pair across sets. It also calls the result "independent of our matchers", but the setup and payoff tags still come from our matchers or the theme guide.
  - **Evidence:** Ramos, arXiv:2604.18314, abstract ("despite substantial confounding, selection effects, and post-treatment conditioning") and section 3.1 (drawing a card "is confounded with variables such as the number of turns in the game").
  - **Severity:** misleading.

- **Claim:** "The paper: GIH WR and IIH are associations, not causes."
  - **Problem:** That is half the paper. Its thesis is that these associational numbers are still causally informative for pick decisions, which it calls "embarrassingly causal". Citing it only as a caveat misstates its conclusion.
  - **Evidence:** https://arxiv.org/abs/2604.18314 abstract and section 4.1 ("this quality bestows confidence that even purely associational data ... are causally informative").
  - **Severity:** misleading.

- **Claim:** "Ramos et al., 2026".
  - **Problem:** The paper has one author, Mark Louie F. Ramos. arXiv lists "Ph.D" as a second author because it parsed the degree as a name. Write "Ramos, 2026".
  - **Evidence:** arXiv page metadata: `citation_author` "Ramos, Mark Louie F." and "D, Ph."; the PDF title block names only Ramos.
  - **Severity:** wrong.

- **Claim:** The EDHREC Terms forbid copying, republishing, a competing site, and automated queries. Only derived numbers may ship.
  - **Problem:** It leaves out clause (b), "you shall not change, make derivative works of, ... any part of the Site". That clause bears most directly on shipping numbers derived from EDHREC pages. The owner's exception in `SPEC.md` covers this as an owner decision, but the section should name the clause so the owner sees exactly what the exception overrides.
  - **Evidence:** https://edhrec.com/terms (Effective date: August 06, 2024), Certain Restrictions (b).
  - **Severity:** missing.

- **Claim:** Sierkovitz blog post: "No license stated that we saw."
  - **Problem:** The page footer says "Some rights reserved." with a tooltip: "Except where otherwise noted, the blog posts on this site are licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) License by the author."
  - **Evidence:** https://blog.17lands.com/posts/using-win-rate-data/ footer (saved as `data/review/scratch/recommenders-verify/blog.html`).
  - **Severity:** wrong.

- **Claim:** "Moxfield: we found no public description of how it recommends."
  - **Problem:** Moxfield's public wiki says it "fully integrated EDHREC right into the deck building experience" and that users "can view recommendations on our site", with Commander data sent daily to EDHREC. So its recommendations come from EDHREC, like Archidekt's. The wiki is undated and may be old.
  - **Evidence:** https://github.com/moxfield/moxfield-public/wiki/Features.
  - **Severity:** missing.

- **Claim:** "EDHREC needs hundreds of thousands of decklists."
  - **Problem:** This understates the scale by about ten times. The deck counts on our 1,110 cached commander pages sum to about 6.6 million. Krenko alone has 45,162 decks.
  - **Evidence:** Sum of `container.json_dict.card.num_decks` over `data/edhrec/pages/commanders/*.json` = 6,641,670 (script `data/review/scratch/recommenders-verify-lift.cjs` and the inline node run in this check). Krenko: `num_decks` 45162 in `data/review/scratch/recommenders/avg_krenko.json`.
  - **Severity:** misleading.

- **Claim:** "Lift is symmetric, so it cannot tell setup from payoff: a popular payoff with a mill rider scores as well as a real looter."
  - **Problem:** The first half is correct. The second half is an illustration with no measurement behind it. On theme pages, lift compares a card with the theme, not with a looter, and no pair was checked. Either show an example from `data/edhrec/pages/tags/graveyard.json` or soften it to "can score as well as".
  - **Evidence:** No source or local count is cited for it.
  - **Severity:** unsupported.

- **Claim:** Local numbers (Krenko cutoffs, Brainstorm on Abaddon, FDN 791,159 games, corpus counts).
  - **Problem:** The brief requires that "every number in a report names the command and output file that produced it". The numbers check out (see below), but none names its command. Add the one-line command or script for each.
  - **Evidence:** `docs/algo-review.md`, "Ground rules for every agent", Reproducibility.
  - **Severity:** missing.

- **Claim:** "We hold the full game data for 18 sets."
  - **Problem:** Only the Premier Draft game files are local (`game_data_public.<SET>.PremierDraft.csv.gz`). 17Lands also publishes other event types, plus draft and replay data. Say "the Premier Draft game data".
  - **Evidence:** `ls data/corpus/raw/` shows 18 PremierDraft game files and no draft or replay files.
  - **Severity:** misleading.

- **Missing idea:** pairs of draft pool and finished deck.
  - **Problem:** The game files carry `sideboard_<card>` next to `deck_<card>`. In a draft, the sideboard is the rest of the pool, so each row shows what a human kept from a given pool. That is the closest public analogue of building from bulk, and it is local. The section lists the sideboard column but not this use. `draft.md` covers it (its idea 3), so a cross-reference is enough.
  - **Evidence:** FDN header (checked); `docs/review/research/draft.md`, Ideas 3.
  - **Severity:** missing.

- **Claim:** Idea 4, a potential-decks denominator, presented as new.
  - **Problem:** Half of it already exists. `learn-build.ts` computes 40-card corpus lift within one set, so draft cards are compared only with decks from their own set. What is new is restricting by colors and by release date at 60, 100, and 20. Say that.
  - **Evidence:** `packages/pipeline/src/learn-build.ts`, the corpus lift loop (comment: "at 40 within one set, so a set's main archetype does not lift every card printed in it").
  - **Severity:** misleading.

- **Claim:** MTGA_Draft_17Lands: "We did not read the code, so its speed and determinism are unverified." Mana: "Lands: 16, 17, or 18."
  - **Problem:** This is easy to settle. `src/card_logic.py` imports no random module and builds by sorting and greedy fill, plus a small recursive search for the creature curve, so it is deterministic and fast. The mana entry also leaves out that it splashes a color for highly rated cards and adds nonbasic lands by win rate. Its ratings are per color pair, not per set. `draft.md` already states these points.
  - **Evidence:** https://github.com/bstaple1/MTGA_Draft_17Lands `src/card_logic.py` (functions `suggest_deck`, `build_deck`, `card_cmc_search`, `color_splash`; read for facts only, nothing copied). README example of per-color-pair win rates.
  - **Severity:** missing.

- **Claim:** "Commander pages in `data/edhrec/` now show 'High Lift Cards'."
  - **Problem:** It holds for 1,106 of 1,113 commander pages. Seven, including Atraxa, Praetors' Voice and Yasmin Khan, have no High Lift section. The lift article (2025-12-15) also said lift had not yet replaced synergy on commander pages. The cache shows it has since, but the section could note that the switch came after the article.
  - **Evidence:** `data/review/scratch/recommenders-verify-lift2.cjs` output. Lift article: replacing synergy on commander pages "hasn't been done yet".
  - **Severity:** misleading (minor).

- **Claim:** Archidekt's Recs tab "sends the deck to EDHREC and shows EDHREC's suggestions."
  - **Problem:** This is supported only by the 2019 partnership post. The 2024 guide says the Recs tab exists in Archidekt but does not say where its suggestions come from. Present tense with a 2019 source should be hedged.
  - **Evidence:** https://edhrec.com/articles/archidekt-and-edhrec-announce-partnership (2019-04-08: "Clicking this will send off the cards in the current deck to EDHREC"). The Digital Deckbuilding guide (2024-04-17) does not name the source.
  - **Severity:** unsupported (minor).

- **Possible omission (minor):** DeckCheck's beta integration of "Recommander" (April 2026), described as collaborative filtering over Commander decklists. No method details are public, so a one-line mention in "Deck sites" is enough.
  - **Evidence:** https://deckcheck.co/blog/deckcheck-x-recommander.
  - **Severity:** missing.

### Checked and sound

- EDHREC data sources: Archidekt, Moxfield, and Scryfall (How to Use EDHREC, John Sherwood, 2025-06-03).
- FAQ definition of potential decks: commander, color identity, and the dates both cards were first previewed.
- FAQ theme wording, quoted exactly: "not scientific", "fiddling with some counts", "defined individually", no single formula.
- Lift article: Julia Maddalena, 2025-12-15. Synergy is asymmetric, lift is symmetric, and synergy is being retired over bad scores for pairs with ubiquitous cards.
- Guide definition of synergy as commander inclusion minus inclusion in eligible decks: John Sherwood, 2024-04-17.
- EDHREC Terms: effective 2024-08-06; personal, noncommercial license; no copying or republishing; no similar or competitive site; no "automated searches, requests, or queries".
- The owner's 2026-11-05 exception is in `SPEC.md`.
- Brainstorm on Abaddon the Despoiler: 4,472 of 6,791 decks, synergy 0.49, lift 3.93.
- EDHREC cache counts: 1,110 commander pages, 3 commander theme pages, 160 theme pages.
- Krenko average deck: type counts equal the cached commander page (31, 7, 8, 12, 6, 35; 30 Mountains). The least-included creature kept is at 31.7% and the most-included creature left out at 30.4%. The same cutoff pattern also holds for instants (28.6 kept, 24.3 out), sorceries (33.3, 32.0), and enchantments (28.7, 26.9).
- Looters do appear on the graveyard theme page (Faithless Looting at 50%).
- 17Lands metric definitions (ALSA, ATA, GP, OH, GD, GIH, GNS, IIH), the IWD to IIH rename on 2025-08-01, and all three stated caveats match the site's script bundle.
- 17Lands public datasets are CC BY 4.0 "unless otherwise noted". The usage guidelines require credit, discourage API scraping, and point to the data dumps.
- 18 local game files. FDN has 791,159 games. The columns are as listed, and there are no draft data files.
- Corpus counts: 54,000 draft decks; 200, 680, and 510 precons. There are also 51 precons at 40, which the section omits.
- The phase 7 quote and result are in `docs/todo.md`.
- Blog post: Sierkovitz, 2021-04-27, updated 2026-06-03, and each of its five caveats.
- arXiv 2604.18314 is CC BY 4.0.
- MTGA_Draft_17Lands: MIT; unmaintained since June 2023; archived 2025-08-23; the deck suggester, its requirements, the ChannelFireball land note, the GIH WR rating, and "will NOT identify card synergies" all match the README.
- Sephton et al.: authors, venue, 6,000 NetrunnerDB lists, confidence formula, 59% from 5 cards, and the White Rose copyright notice.
- Scryfall syntax: EDHREC rank filter and sort, and oracle tags that "describe the function of the card".
- TappedOut suggestion engine: 2014-09-08, no method given.
- No code is copied. There are no code blocks or em-dashes, and quotes are short phrases.
