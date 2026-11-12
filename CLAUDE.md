# CLAUDE.md

Bulk Brew: bulk Magic cards in, playable decks out: 60, 40, and 20 cards in one to five colors, and 100-card Commander. Web app and iOS app on one TypeScript core. Open source, MIT.

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
- Every push to main deploys the web app, and the user tries the live site between steps. Push only green, usable states; label any unfinished screen with what is coming.
- For multi-step phases the user likes a loop: one agent implements, a fresh agent reviews the diff, then verify in the browser before committing.

## Decision authority

Stop and ask before: adding a dependency, changing the data pack schema, changing a config file format, or changing anything in `ATTRIBUTION.md` or `LICENSE`. Routine judgment calls inside the agreed scope do not need a question.

## Hard invariants

- Cards are keyed on Scryfall `oracle_id`. Sets and printings exist only as art hints.
- The builder is deterministic: same pool, settings, config version, and data version give the same deck.
- The core has no DOM, Node, or network access.
- No user data ever leaves the device. The only network calls are Scryfall images, the optional set-specific art lookup, and the data pack and learned data downloads.
- Scryfall images are never cropped, distorted, recolored, or watermarked.
- Raw Scryfall bulk files and the Comprehensive Rules are never committed.

## Do not invent

Card facts, rules text, and tag meanings come from the data files and `docs/rules/`, not from memory. Search the rules text on demand; never load it wholesale.

## Conventions

- User-facing text: plain language, no em-dashes.
- Comments are short and say why, not what.
- Commit messages: a plain title in the imperative, optional body. Bump `version` in `package.json` in its own commit when a shipped change lands.
- Versions are `<year>.<major>.<minor>`: the two-digit year the version was made, a major that only grows (it never resets with the year), and a minor that resets with each major. A shipped change bumps the minor; the owner decides when the major moves. The root, web, mobile, and ui packages share the version.
- Line endings LF, two-space indent, single quotes (Prettier enforces).

## Running and verifying

```sh
npm run check            # the single gate: typecheck, lint, format, test, build
npm run data:pull        # pinned card data pack into data/packs and each app's public/data
npm run dev              # web app on 5173
npm run dev:mobile       # mobile app on 5174
npm run data:fetch       # Scryfall bulk files into data/raw/ (at most daily)
npm run data:build       # rebuild the card data pack from data/raw/
npm run symbols:fetch    # Scryfall symbol images into packages/ui/src/symbols (only when new symbols appear)
npm run config:check     # validate config/ and print role and archetype match counts
npm run demo:build -- <pool.txt> <W|U|B|R|G> [60|40|20] [style]
npm run eval             # score decks from every pool in eval/pools; exits 1 on failures
npm run corpus:eval      # build every reference deck from bulk plus its cards (about 20 minutes)
npm run corpus:panel -- --a <old.json> --b <new.json>   # blind review packets from two corpus:eval runs
npm run edhrec:fetch     # EDHREC pages into data/edhrec/ (one request per second, at most weekly)
npm run spellbook:fetch  # Commander Spellbook's combo file into data/spellbook/
npm run learn:build      # learned data: config/learned/ and data/learned.json
npm run theme:bulk       # config/theme-bulk.json, the bulk baseline; rerun after a theme rules edit or a new data pack
```

After any builder or config change, run `npm run eval` and compare the per-size deltas with the committed baseline in `eval/results/`.

Browser check of the real app (headless Edge or Chrome):

```sh
npm run build -w @bulk-brew/web
npx -w @bulk-brew/web vite preview --port 4173 --strictPort   # in the background
npm run smoke                                                  # or: npm run smoke -- https://xbadc0ffe.github.io/bulk-brew/
```

The smoke test imports `eval/pools/white-bulk.txt`, opens the strongest deck option, accepts it, and checks the Bulk List and Decks screens. Environment variables pick other paths: `SMOKE_COLORS=White,Blue`, `SMOKE_STYLE` and `SMOKE_SECONDARY` for the style drop-downs, and `SMOKE_SIZE=100` with `SMOKE_COMMANDER=<part of a name>` for Commander. It also checks that `data/learned.json` loads and that About credits its sources. The Commander tribe check runs the Elf pool: `SMOKE_SIZE=100 SMOKE_COMMANDER=Lathril SMOKE_STYLE='Elf tribe' npm run smoke -- <url> eval/pools/elf-tribe.txt`. Screenshots land in `.smoke/` (gitignored).

## Environment notes

- Development is on Windows with Git Bash and PowerShell. iOS builds run on the user's Mac mini with Xcode.
- Git Bash rewrites arguments that look like paths: run the Pages build locally with `MSYS_NO_PATHCONV=1 BASE_PATH=/bulk-brew/ npm run build -w @bulk-brew/web`.
- Shell heredocs that contain backticks fail to parse in Claude Code's Bash tool here. Write such files with the file tools instead.
- Publishing a data release (`gh release create`) may need the user to run it; the weekly workflow normally does it.

## Session start

Read `SPEC.md` "Milestones" and `docs/todo.md` to find the current phase, then continue from there. If `data/packs/` is empty, run `npm run data:pull` first.
