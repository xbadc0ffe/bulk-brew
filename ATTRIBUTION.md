# Attribution

## Wizards of the Coast

Bulk Brew is unofficial Fan Content permitted under the Fan Content Policy. Not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.

Magic: The Gathering, card names, card text, mana symbols, and card images are property of Wizards of the Coast. This project does not sell or paywall any of them.

The Comprehensive Rules are used as development reference only and are not redistributed.

## Scryfall

Card data comes from [Scryfall](https://scryfall.com) bulk data files, and function tags come from [Scryfall Tagger](https://tagger.scryfall.com), a community project. Card images are loaded from Scryfall's image host on demand, directly by the user's device, and are shown unmodified. Mana and card symbol images are Scryfall's symbol files, bundled with the apps.

Scryfall is not affiliated with Bulk Brew and does not endorse it. Scryfall's data is used under its [API terms](https://scryfall.com/docs/api): it is free for Magic software, carries no fee to the user, and this project adds value beyond repackaging the data.

## 17Lands and MTGJSON

How Bulk Brew builds decks is tuned by studying real decks with developer-side scripts (`npm run corpus:fetch`): Arena draft decks and their results from [17Lands](https://www.17lands.com) public datasets, and the official preconstructed deck lists published by [MTGJSON](https://mtgjson.com). Thank you to both projects.

- Data from 17Lands.com, used under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/) (CC BY 4.0). Only statistics learned from it, such as land counts and curve shapes, reach the builder's config; no draft deck data ships in the apps.
- MTGJSON is free and open source under the MIT License. Its deck files are read for statistics only and are not redistributed.

Neither project is affiliated with Bulk Brew or endorses it.

## EDHREC and Commander Spellbook

The builder also learns from [EDHREC](https://edhrec.com), which shows what Commander players put in their decks for each commander and theme, and from [Commander Spellbook](https://commanderspellbook.com), the community database of Magic combos. Thank you to both projects.

- EDHREC's pages are read developer-side, at a gentle rate and cached, by `npm run edhrec:fetch` for this personal, non-commercial, open-source project. Only derived, rounded numbers (which plans a commander's decks run, how much more a commander's or a theme's decks play a card) reach the apps in `data/learned.json`; no EDHREC page or card list ships.
- Commander Spellbook's bulk combo file, made for third parties, is read developer-side by `npm run spellbook:fetch` and `npm run learn:build`. The apps carry only each combo's card ids, result ids, color identity, bracket tag, legality, and variant id, so a deck can link to its page at commanderspellbook.com for the steps.

Neither project is affiliated with Bulk Brew or endorses it.

## In the apps

Both apps show these notices on their About screen.
