# Judging rubric: decent bulk decks

Each packet holds one deck, or two labeled A and B for a pair: size, colors, the requested style (in a pair, only when both decks were built for the same request), commander if any, and every card with its copies, cost, type line, power and toughness or loyalty, and oracle text (every face of a two-faced card), lands included. The deck's name is removed. Judge whether each is a decent bulk deck, not whether it is a good deck.

## The bar

A decent bulk deck:

- has a plan a player could explain in a sentence;
- runs setup cards and payoff cards that feed each other, in numbers that make the plan show up in most games;
- can cast its spells: a sensible curve, land count, and color sources;
- has some interaction and something that wins the game;
- has few cards that do nothing for the plan or the game.

It does not need to be the best deck its cards could make, full of strong or rare cards, or a copy of a known deck.

A deck is not worse for using commons, uncommons, or old cards. It is worse for not doing its thing. A plain Aggro, Midrange, or Control deck built from reasonable cards, with a working curve and some interaction, is decent with no theme at all. A themed deck whose theme lacks real setup or real payoff is not decent, even if every card mentions the theme.

Score from 1 to 5, where 3 means decent.

- **5.** Clearly does its thing: the plan shows up almost every game, curve and mana are smooth, and almost every card pulls its weight. Still bulk.
- **4.** Decent with room to spare: the plan shows up in most games and the flaws are minor.
- **3.** Decent: an explainable plan that shows up in most games, castable spells, some interaction, a way to win, few dead cards. Clear flaws are allowed.
- **2.** Close but not decent: the plan is thinly fed, or one serious flaw (mana, curve, interaction, no way to win, many dead cards) loses many games.
- **1.** A pile: no plan, a theme in name only, or spells it cannot cast.

`decent` is true exactly when the score is 3 or higher.

## The questions

Answer in this order.

### 1. Plan

Write the plan in one sentence, such as "Go wide with small creatures, then pump the team" or "Fill the graveyard with looters and self-mill, then grow creatures that count it." If no sentence fits, write "no clear plan".

Infer the plan from what the cards do: what the payoffs count or reward ("for each", "whenever") and what several cards produce. Shared words are not a plan: five cards that mention the graveyard in unrelated ways are not a graveyard deck.

When many cards ask for one resource, the deck is themed; judge that theme, and do not rescue it by calling it Midrange. A few payoffs in a deck that plays well without them are a bonus, not a theme. When the cards ask for nothing in particular, the plan is a shape: attack early (Aggro), trade and win with bigger threats (Midrange), answer threats and win late (Control), or repeat one action, such as burning or milling the opponent. A shape is a plan only when most spells serve it. A deck whose cards point in many unrelated directions has no clear plan, whatever its curve; do not call it Midrange.

### 2. Setup and payoff

A themed plan builds a resource and spends it. Setup builds it: fills the graveyard, makes tokens, adds counters, gains life, casts many spells, keeps artifacts around, plays many creatures of one type, or provides creatures to sacrifice. Payoff turns the resource into damage, cards, or board.

Read oracle text honestly:

- A one-off "surveil 1" or "mill one card" rider on a removal spell or a payoff is not setup. Leave it out.
- A card that does both jobs counts once, as whichever job it mostly does.
- A token maker that makes one token once is weak setup.
- Repeatable effects count more than one-shots, for setup and payoff alike: a creature that loots every turn is strong; a spell that mills three once is weak.
- Weigh what each payoff needs: one that wants seven cards in the graveyard needs far more setup than one that wants a single creature card.
- Normal play makes a little of most resources: creatures die, spells resolve, and lands are played. That is background, not setup. A payoff that background feeds every turn, such as one that rewards each land you play, still counts as fed.

Then ask: in a typical game, how often does this deck have a payoff and enough resource for it by turn 4 or 5? That question decides `enough_setup` and `enough_payoff`, not a tally. As a guide only, a decent themed deck usually has about this much real setup and payoff, counting copies, with strong setup worth about two weak pieces:

| Size | Setup        | Payoff   | What it buys                                              |
| ---- | ------------ | -------- | --------------------------------------------------------- |
| 60   | about 10     | about 6  | both by turn 5 in about two games of three                |
| 40   | about 6      | about 4  | both by turn 5 in about two games of three                |
| 20   | about 3 or 4 | about 2  | both by turn 5 in about a third of games of the paired 40 |
| 100  | about 15     | about 10 | both by turn 6 or 7 in most games                         |

A commander that is itself repeatable setup or payoff is always available, so its deck needs less of that job.

For a plain shape with no resource to build, leave `setup` and `payoff` empty, set both `enough_` fields to true, and judge the deck on its plays.

### 3. Plays

- **Curve.** Are there plays on turns one to three, roughly a quarter or more of the spells at two mana or less, and not too many cards at five or more for the land count?
- **Mana.** Is the land count right for the curve and size, and does each color have enough sources? A light second color works with fewer sources if its cards are few and not needed early; early cards with two of its symbols are a problem.
- **Interaction.** Count removal, counterspells, bounce, tappers, sweepers, fogs, combat tricks that win a fight, and creatures built to stop attackers (deathtouch, reach, high toughness). Ordinary creatures do not count just for blocking. Use `none` only when there is nothing.
- **A way to win.** Evasive or large threats, a wide board with a pump, drain or burn to the face, a combo, mill, or commander damage. `thin` means one or two threats that are easy to answer.

### 4. Dead cards

Count the cards, copies included, that do nothing for the plan or the game, and list their names.

- A mediocre creature that attacks and blocks is filler, not dead.
- A card that needs a resource the deck never makes is dead: an artifact payoff in a deck with two artifacts.
- A hoser against a strategy the deck cannot expect to face is dead.
- A card the deck's lands cannot cast is dead.

### 5. Decent or not

Give the score and a two-sentence reason: what the deck does, and what most helps or hurts it.

## The requested style

The packet says what style was asked for, such as "Requested style: Graveyard." with a line on what that style does, or "Requested style: none (the builder picked)". It is what someone asked for, not a claim about the deck: infer the plan from the cards as above, and give `decent`, the score, and the failures exactly as you would without it.

After judging the deck by the bar, answer one more question: is this a decent deck of the requested style? That means a decent deck whose plan is that style, played with real setup and payoff for it, judged by the same honest counting as question 2. For Aggro, Midrange, or Control, it means a decent deck whose plan is that shape. A decent plain deck asked for as Graveyard is not a decent Graveyard deck, and neither is a deck with a few graveyard cards that plays as Midrange. A deck that is not decent is never a decent deck of its style. Give `decent_of_style` and a one-sentence `style_reason`. When the packet shows no requested style, `decent_of_style` is null and `style_reason` is an empty string.

## Size notes

- **100 (Commander).** One copy of each card except basics. The plan should work with the commander. Games are multiplayer and slower, so judge by turn 6 or 7. About 38 lands is normal (35 to 40), plus some ramp. Expect more interaction and card advantage than at 60, since threats come from three opponents, and a way to win against three opponents at 40 life.
- **60.** Up to four copies, so consistency matters: four of a key setup card beat four different weak ones. 22 to 26 lands is normal.
- **40.** Limited-style decks. Two colors are common, 16 to 18 lands is normal, and creatures and tricks dominate. The plan is often just a good curve of creatures plus removal, and that is decent.
- **20.** A half deck, usually one color, that shuffles together with any packet of another color into a 40-card deck. 7 to 9 lands is normal. The other half brings its own plan, so this half's theme must work from its own cards, and its other cards must still play when the theme does not show up. Judge the half for a coherent plan of its own and a low curve. One or two interaction cards and a couple of threats are enough; do not demand a full deck's interaction or setup counts.

## The pair question

For two decks of the same size and colors, perhaps with different plans, pick the better one by the same bar, or `tie`, with a one-line reason. Prefer the deck that better meets the bar: a plan, setup and payoff that feed each other, a curve and mana that cast it, interaction, a way to win, and few dead cards. Card strength counts only through those: a stronger card that also serves the plan is a real edge, a stronger card that serves no plan is not. A plain deck that works beats a themed deck that does not. A requested style line, when a pair shows one, does not change the pick: choose by the bar as if no style were shown. The order is random; do not favor A or B.

## Anchors

Decks in a batch come from many sources, good and bad. Judge every deck by the bar above in the same way, and do not try to guess where a deck came from. The worked examples below are the only calibration.

## Method rules

- Read every card's oracle text in the packet. Never recall a card from memory or assume what it does from its name.
- If a card's text is missing from the packet, say so in `reason` and do not guess at it.
- Do not look up the deck or its cards anywhere.
- Do not guess which builder made the deck.
- Judge each deck on its own; compare decks only in pairs.
- Write plainly.
- Answer with one JSON object in exactly the shape below: valid JSON, no extra keys, nothing before or after it.

## The answer shape

One deck:

```text
{
  "plan": string,
  "setup": [{ "card": string, "job": string, "strength": "strong" | "weak" }],
  "payoff": [{ "card": string, "job": string, "strength": "strong" | "weak" }],
  "enough_setup": boolean,
  "enough_payoff": boolean,
  "curve": "good" | "ok" | "poor",
  "mana": "good" | "ok" | "poor",
  "interaction": "good" | "ok" | "poor" | "none",
  "win": "clear" | "thin" | "none",
  "dead": [string],
  "decent": boolean,
  "score": 1 | 2 | 3 | 4 | 5,
  "reason": string,
  "decent_of_style": boolean | null,
  "style_reason": string,
  "failures": [failure]
}
```

A pair packet gets only this answer, with no style question, whatever style line it shows:

```text
{ "better": "A" | "B" | "tie", "reason": string }
```

Name each distinct card at most once across `setup`, `payoff`, and `dead`, spelled as in the packet; the program reads copy counts from the deck list. `job` is a few words, such as "loots every turn".

`failures` lists every problem that applies, for decent decks too. The final report counts these values:

- `no-plan`: no plan a player could explain in a sentence.
- `no-setup`: the plan needs a resource and almost nothing real builds it.
- `thin-setup`: some real setup, too little for the plan to show up in most games.
- `no-payoff`: the deck builds a resource and almost nothing spends it.
- `thin-payoff`: some payoffs, too few to show up in most games.
- `bad-curve`: too few early plays, or more expensive cards than the lands support.
- `bad-mana`: the land count or color sources will often leave spells uncast.
- `no-interaction`: nothing, or almost nothing, stops an opposing threat.
- `no-win`: no credible way to finish a game.
- `dead-cards`: dead copies are more than about one spell in ten: 4 or more at 60, 3 or more at 40, 2 or more at 20, 7 or more at 100.
- `none`: nothing above applies; use it alone.

Keep the fields consistent. `no-plan` goes with the plan "no clear plan" and both `enough_` fields false. Otherwise a false `enough_setup` goes with `no-setup` or `thin-setup`, and a false `enough_payoff` with `no-payoff` or `thin-payoff`. `interaction` "none" goes with `no-interaction`, and `win` "none" with `no-win`. A deck with `no-plan` or any setup or payoff failure misses its plan in most games, so it scores 2 or less. `decent_of_style` is true only when `decent` is true, a boolean whenever the packet shows a requested style, and null when it shows none; `style_reason` is empty exactly when `decent_of_style` is null.

## Worked examples

**A themed deck that is decent.** A 60-card two-color deck. Setup: four copies of a two-mana looter creature, three copies of a three-mana creature that mills two cards each time it attacks, and two sorceries that mill four and put a creature from among them into your hand. Payoff: four three-mana creatures that get +1/+1 for each creature card in your graveyard, and two five-mana spells that return a creature from your graveyard to the battlefield. It also runs five removal spells, sixteen plain creatures, and 24 lands split 14 and 10. The looters and attackers fill the graveyard every turn, so the growing creatures are large by turn 4 or 5 in most games. One expensive creature is filler. Score 4: the plan is fed and shows up in most games.

**A themed deck that fails on setup.** A 60-card deck where every card mentions the graveyard. Its payoffs are creatures that grow with cards in your graveyard, a reanimation spell, and spells with flashback. Its "setup" is a removal spell with surveil 1, a big creature that surveils two when it enters, and payoff creatures that mill one card when they enter. There is no looter, no discard outlet, and no repeatable mill. Counted honestly, it has almost no setup, so the growing creatures stay small and the reanimation spell has nothing to return until late. Score 2 with `no-setup`: the theme is in the text, not in the games.

**A plain aggro deck that is decent.** A 40-card two-color deck with 17 lands split 9 and 8. Sixteen creatures, most at two or three mana, several with flying or first strike; four burn spells that hit creatures or players; two combat tricks; and one spell that pumps the team for a turn. Nothing builds a resource, so setup and payoff are empty and both `enough_` fields are true. The curve starts on turn two, the mana fits, the burn is removal and reach, and the flyers close games. Score 3: no theme, but it does its thing. Asked for as Aggro, it is a decent deck of its style; asked for as Tokens, it is not.
