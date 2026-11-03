# CLAUDE.md

Bulk Brew: bulk Magic cards in, playable mono-color 60/40/20-card decks out. Web app and iOS app on one TypeScript core. Open source, MIT.

## Authority

- `SPEC.md` is the source of truth for scope, data, and architecture. Read it before changing behavior; update it when a decision changes.
- `config/` holds every tunable number and rule. Logic lives in `packages/core`; judgment lives in config.
- `docs/DESIGN_BRIEF.md` describes screens and flows for the design pass.
- `docs/todo.md` is the one ranked backlog. Open items go there, not into code comments.

## Tech stack

TypeScript 6, npm workspaces, Node 24 (scripts run `.ts` directly, so core and pipeline use erasable syntax only). React 19 + Vite 8 + Tailwind 4 for both apps. Vitest for tests. ESLint + Prettier. GitHub Pages for the web app, Capacitor for iOS.

## Working style

- One phase at a time, each ending with `npm run check` green.
- Read source first, configs second. Investigate the root cause before patching a symptom.
- Minimal focused changes. No drive-by refactoring, no premature abstraction.
- Do not claim something works without running it.
- Be succinct. A question is not a go-ahead.
- Commit when a step passes `npm run check`. Push at the end of a phase or when asked.

## Decision authority

Stop and ask before: adding a dependency, changing the data pack schema, changing a config file format, or changing anything in `ATTRIBUTION.md` or `LICENSE`. Routine judgment calls inside the agreed scope do not need a question.

## Hard invariants

- Cards are keyed on Scryfall `oracle_id`. Sets and printings exist only as art hints.
- The builder is deterministic: same pool, settings, config version, and data version give the same deck.
- The core has no DOM, Node, or network access.
- No user data ever leaves the device. The only network calls are Scryfall images, the optional set-specific art lookup, and the data pack download.
- Scryfall images are never cropped, distorted, recolored, or watermarked.
- Raw Scryfall bulk files and the Comprehensive Rules are never committed.

## Do not invent

Card facts, rules text, and tag meanings come from the data files and `docs/rules/`, not from memory. Search the rules text on demand; never load it wholesale.

## Conventions

- User-facing text: plain language, no em-dashes.
- Comments are short and say why, not what.
- Commit messages: a plain title in the imperative, optional body. Bump `version` in `package.json` in its own commit when a shipped change lands.
- Line endings LF, two-space indent, single quotes (Prettier enforces).

## Running and verifying

```sh
npm run check            # the single gate: typecheck, lint, format, test, build
npm run dev              # web app
npm run dev:mobile       # mobile app
npm run data:fetch       # Scryfall bulk files into data/raw/
npm run data:build       # card data pack
```

## Session start

Read `SPEC.md` "Milestones" and `docs/todo.md` to find the current phase, then continue from there.
