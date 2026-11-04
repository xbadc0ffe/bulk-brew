# iOS app icons

The home-screen icon in two versions, 1024 by 1024, full square and without
transparency (iOS rounds the corners itself):

- `app-icon-light.png`: the default icon, for light mode.
- `app-icon-dark.png`: the dark version, for dark mode (iOS 18 and later).

In Xcode, open the AppIcon set in `Assets.xcassets`, set Appearances to "Any,
Dark", and drop the light file in the Any slot and the dark file in the Dark
slot. The SVG files are the sources; they match `apps/web/public/icon-light.svg`
and `apps/web/public/icon.svg` apart from the rounded corners. To redraw a PNG,
open its SVG in a browser at 1024 by 1024 and save a screenshot.
