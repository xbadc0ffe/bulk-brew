# iOS app: brief for the Mac session

The next piece of work, ahead of the rest of `docs/todo.md`. It runs on the owner's Mac mini with Xcode, in a session that starts from a fresh clone and knows nothing of earlier sessions. Delete this file's "Steps" as they are done, and fold what remains into `SPEC.md` and `docs/todo.md` when the app runs on the phone.

## Goal

The web app (`apps/web`) running on the owner's iPhone as an installed app, wrapped by Capacitor. Same screens, same code: the phone layout below 768 px is the app (SPEC "Decisions"). It reaches the owner's phone through TestFlight.

`apps/mobile` is an older separate phone app. Do not build on it. The icons it had are now in `apps/web/resources/`.

## Decisions

Settled, so the session can start without asking:

- Dependencies: `@capacitor/core`, `@capacitor/ios`, and `@capacitor/cli` in `apps/web` are approved (the owner agreed to Capacitor around the web app on 2026-11-19). The owner also approved `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/haptics`, and `@capacitor/app`, now in use. Any further plugin is a new dependency: ask first, as CLAUDE.md says.
- The name under the icon: Bulk Brew.
- Bundle identifier: `com.badc0ffe.bulkbrew`, in the same form as Pull State (`com.badc0ffe.pullstate`). The owner confirmed it on 2026-11-19. It cannot change once the app is in the App Store.
- Lowest iOS version: whatever the current Capacitor sets by default. The dark app icon shows on iOS 18 and later; older phones show the light one.
- The phone gets the app through TestFlight, not from Xcode: the Mac mini is headless and the owner has no physical access to it. To upload, run `npm run ios`, then `ship "App" <version>` from `apps/web/ios/App` (it pulls, archives, signs with the App Store Connect API key, and uploads). The App Store Connect record (Bulk Brew, SKU `bulkbrew`) and the bundle ID exist since 2026-11-19.

Signing uses team ZWS3TP3W3Z, set in the project.

## State of the repo

- `npm run check` is the gate. The web app is live at https://xbadc0ffe.github.io/bulk-brew/ and every push to main deploys it, so push only green, usable states.
- The card data is not in git. `npm run data:pull` downloads the pinned pack into `data/packs` and `apps/web/public/data/` (`cards.json`, `learned.json`). The iOS build bundles whatever is in `apps/web/public/data/`, so pull before building.
- The web build takes its base path from `BASE_PATH` (default `/`). The Pages build uses `/bulk-brew/`; the iOS build must use `/`.
- Node 24 or later.

## Steps

1. Install it on the phone from TestFlight and go through "Check on the device". (It runs in the simulator, checked headless with `simctl`.)
2. Fix what the checks find. Each new plugin is a new dependency: ask first.
3. Update `SPEC.md` (Platforms, Runtime, Status), `docs/DESIGN_BRIEF.md`, the README, and `docs/todo.md`; bump the version in its own commit.

## Check on the device

Known risks, most likely first. None has been tried in a WebView yet.

Settled in the simulator: the launch screen, no service worker in the app, the status bar following the Appearance setting, the system text size, the share sheet for exports (iPhone, and centered on iPad), Bulk Brew offered as a target in the share sheet, and opening a .txt (into Import) or a backup .json (into the Restore question) from a file URL, both on a cold start and while the app is open. Still to see on the phone: the long-press and bounce behavior (`html.native` in `apps/web/src/index.css`) and the text size following a change made in Control Center while the app is open.

- Files: save an export to Files, AirDrop or mail one, and close the share sheet without choosing (no message should appear). Share a .txt, a ManaBox .csv, and a backup from Files or Mail into Bulk Brew. Restore and Import's "choose files" use a file input: check the picker opens and the right files are not greyed out.
- Haptics: a tap on Accept, on a successful Import, and a lighter one on Replace; nothing on ordinary taps.
- Storage: the bulk list, decks, and settings are in IndexedDB (`packages/ui/src/storage/kv.ts`). Confirm they survive closing the app, restarting the phone, and installing a new build over the old one.
- Copy to clipboard in the Export dialog. The page is a secure context in the app and `navigator.clipboard` exists; a copy outside a tap is refused, as it should be, and the copy from the tap could not be driven headless.
- Links on About must open in Safari, not inside the app. Capacitor's navigation handler (`WebViewDelegationHandler.swift`) hands every top-level or new-window link outside the app, `mailto:` included, to the system; try one on the phone.
- Card images come from Scryfall over the network; the no-art setting must still work in airplane mode.
- Safe areas: the tabs must clear the notch and the sheets and the deck action bar must clear the home bar (`viewport-fit=cover` and the `env(safe-area-inset-*)` padding are already there).
- The bottom sheet (`packages/ui/src/components/Sheet.tsx`): drag down to close, swipe left and right between cards, scrolling inside it, and no rubber-banding of the page behind. It was only ever tried in an emulated browser.
- The sheet adds a history entry so a browser's Back closes it (`packages/ui/src/components/overlay.ts`). The app has no Back; make sure the edge swipe does nothing odd.
- Text fields are 16 px so iOS does not zoom on focus; check the search box, the import box, and the filter search.
- The keyboard must not cover the field being typed in, on Import and in the Filters sheet.
- Speed: Analyze and the deck options run in web workers; time them on the phone with a large bulk list.
- Card data updates (SPEC "Publishing and updates"): settled in the simulator against a local copy of the site (download, checksum refusal, unknown schema, stale and broken downloads, one check a day, superseding). The live site serves a manifest only once this work is pushed. On the phone, after the next weekly data refresh: open the app, then close it in the app switcher, start it again, and see the new date on About; check that a launch with no connection opens normally and that the download leaves the app responsive.
- iPad: the sidebar clears the status bar in portrait (simulator); try landscape and Split View.

## Later

App Store listing and privacy answers (no data leaves the device). The privacy policy for the listing is `apps/web/public/privacy.html`, served at https://xbadc0ffe.github.io/bulk-brew/privacy.html.

## How the owner works

- Short replies: the answer first, in a few plain lines. No em-dashes in anything a user reads.
- A question is not a go-ahead. Routine choices inside agreed scope need no question.
- Commit when a step is green; plain imperative titles. Commit as `info@badc0ffe.net`; check `git config user.email` on the Mac before the first commit.
- The owner tries each step for real, on the phone or the live site, before calling it done. Say what was and was not run.
