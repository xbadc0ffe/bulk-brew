# iOS app: brief for the Mac session

The next piece of work, ahead of the rest of `docs/todo.md`. It runs on the owner's Mac mini with Xcode, in a session that starts from a fresh clone and knows nothing of earlier sessions. Delete this file's "Steps" as they are done, and fold what remains into `SPEC.md` and `docs/todo.md` when the app runs on the phone.

## Goal

The web app (`apps/web`) running on the owner's iPhone as an installed app, wrapped by Capacitor. Same screens, same code: the phone layout below 768 px is the app (SPEC "Decisions"). First on the owner's own phone from Xcode; TestFlight comes after.

`apps/mobile` is an older separate phone app. Do not build on it. Its only useful part is the icons in `apps/mobile/resources/`.

## Decisions

Settled, so the session can start without asking:

- Dependencies: `@capacitor/core`, `@capacitor/ios`, and `@capacitor/cli` in `apps/web` are approved (the owner agreed to Capacitor around the web app on 2026-11-19). Any further plugin, such as Filesystem or Share, is a new dependency: ask first, as CLAUDE.md says.
- The name under the icon: Bulk Brew.
- Bundle identifier: `net.badc0ffe.bulkbrew`, after the owner's site. It cannot change once the app is in the App Store, so say it to the owner once, when creating the project, in case they want another.
- Lowest iOS version: whatever the current Capacitor sets by default. The dark app icon shows on iOS 18 and later; older phones show the light one.
- First goal: the app on the owner's own iPhone, run from Xcode. TestFlight is later.

Only the owner can do this one, in Xcode: pick the signing team under Signing & Capabilities. A free Apple ID works for their own phone (the app must be re-run from Xcode every seven days); TestFlight and the App Store need the paid Apple Developer Program.

## State of the repo

- `npm run check` is the gate. The web app is live at https://xbadc0ffe.github.io/bulk-brew/ and every push to main deploys it, so push only green, usable states.
- The card data is not in git. `npm run data:pull` downloads the pinned pack into `data/packs` and `apps/web/public/data/` (`cards.json`, `learned.json`). The iOS build bundles whatever is in `apps/web/public/data/`, so pull before building.
- The web build takes its base path from `BASE_PATH` (default `/`). The Pages build uses `/bulk-brew/`; the iOS build must use `/`.
- `.gitignore` has iOS lines for `apps/mobile/ios/`; change them to wherever the project lands (`apps/web/ios/`).
- Node 24 or later.

## Steps

1. Clone, `npm install`, `npm run data:pull`, `npm run check`.
2. Add Capacitor to `apps/web`, a `capacitor.config.ts` (`webDir: 'dist'`, the bundle identifier, the name), and `npx cap add ios`. Commit the generated `ios/` project without Pods, DerivedData, and user state.
3. Root scripts, so the owner has one command each: build the web app for iOS and copy it in (`cap sync ios`), and open Xcode (`cap open ios`). Add them to CLAUDE.md's command list.
4. Icons: put `apps/mobile/resources/app-icon-light.png` and `app-icon-dark.png` in the AppIcon set (Any and Dark), as that folder's README says, then move the folder out of `apps/mobile`.
5. Run it in the simulator, then on the phone, and go through "Check on the device".
6. Fix what the checks find. Each new plugin is a new dependency: ask first.
7. Update `SPEC.md` (Platforms, Runtime, Status), `docs/DESIGN_BRIEF.md`, the README, and `docs/todo.md`; bump the version in its own commit.

## Check on the device

Known risks, most likely first. None has been tried in a WebView yet.

- The service worker (`apps/web/src/main.tsx`, `public/sw.js`) is for the browser. In the app everything is bundled, so it should not register there; check `Capacitor.isNativePlatform()` or a build flag.
- Saving files: Export, Backup, and deck .txt downloads use a blob link (`packages/ui/src/util/files.ts`), which a WKWebView most likely ignores. The fix is the Filesystem and Share plugins. Restore and Import use a file input, which should work.
- Storage: the bulk list, decks, and settings are in IndexedDB (`packages/ui/src/storage/kv.ts`). Confirm they survive closing the app, restarting the phone, and installing a new build over the old one.
- Copy to clipboard in the Export dialog.
- Links on About must open in Safari, not inside the app.
- Card images come from Scryfall over the network; the no-art setting must still work in airplane mode.
- Safe areas: the tabs must clear the notch and the sheets and the deck action bar must clear the home bar (`viewport-fit=cover` and the `env(safe-area-inset-*)` padding are already there). Set the status bar style for light and dark mode.
- The bottom sheet (`packages/ui/src/components/Sheet.tsx`): drag down to close, swipe left and right between cards, scrolling inside it, and no rubber-banding of the page behind. It was only ever tried in an emulated browser.
- The sheet adds a history entry so a browser's Back closes it (`packages/ui/src/components/overlay.ts`). The app has no Back; make sure the edge swipe does nothing odd.
- Text fields are 16 px so iOS does not zoom on focus; check the search box, the import box, and the filter search.
- The keyboard must not cover the field being typed in, on Import and in the Filters sheet.
- Text size: the Settings choice scales the app. Decide with the owner whether the app should also follow the system text size.
- Speed: Analyze and the deck options run in web workers; time them on the phone with a large bulk list.

Later, not now: over-the-air data updates (the app only has the bundled pack until then; SPEC "Publishing and updates"), TestFlight, App Store listing and privacy answers (no data leaves the device).

## How the owner works

- Short replies: the answer first, in a few plain lines. No em-dashes in anything a user reads.
- A question is not a go-ahead. Routine choices inside agreed scope need no question.
- Commit when a step is green; plain imperative titles. Commit as `info@badc0ffe.net`; check `git config user.email` on the Mac before the first commit.
- The owner tries each step for real, on the phone or the live site, before calling it done. Say what was and was not run.
