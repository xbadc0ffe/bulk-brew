# Deckbuilding guides

The reasoning behind the numbers in `config/`. Each guide names the config file and keys it feeds, so a change in one place can be mirrored in the other. The user reviews and tunes these; the builder only reads config.

| Guide                             | Feeds                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| [Deck shapes](deck-shapes.md)     | `deck-templates.json`, `curve-profiles.json`, `builder-weights.json` |
| [Colors](colors.md)               | Which archetypes to expect per color; `archetypes.json` color limits |
| [Archetypes](archetypes.md)       | `archetypes.json`, `roles.json`, `synergy-rules.json`                |
| [Mana base](mana-base.md)         | `deck-templates.json` land formula, `land-rules.json`, castability   |
| [Jumpstart packets](jumpstart.md) | The 20-card template and curve profile                               |
| [Commander](commander.md)         | The `100` template, `commander` curve profile and builder weights    |
| [Card strength](card-strength.md) | `card-strength.json`, `builder-weights.json` deck score and best fit |

Run `npm run config:check` after editing config. It validates the files, confirms every tag exists in the current data pack, and prints how many cards each role and archetype matches per color.
