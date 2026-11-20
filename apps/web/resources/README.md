# iOS app icons

The home-screen icon in two versions, 1024 by 1024, full square and without
transparency (iOS rounds the corners itself):

- `app-icon-light.png`: the default icon, for light mode.
- `app-icon-dark.png`: the dark version, for dark mode (iOS 18 and later).

Copies of both are in the iOS AppIcon set
(`apps/web/ios/App/App/Assets.xcassets/AppIcon.appiconset/`) as
`AppIcon-light.png` (Any) and `AppIcon-dark.png` (Dark). After redrawing one,
copy it there again.

The SVG files are the sources. They match `apps/web/public/icon-light.svg` and
`apps/web/public/icon.svg`, except that the web icons have rounded corners and
the light web icon has a thin border. To redraw a PNG, render its SVG with a
headless Chromium browser, which gives exactly 1024 by 1024 RGB with no alpha
channel (a window screenshot on a Retina Mac comes out at 2048 and with alpha,
which App Store Connect rejects). From this folder, with an HTML page that shows
the SVG at 1024 by 1024 pixels:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,1024 \
  --screenshot=app-icon-light.png page.html
```

## Launch screen

`launch-logo-light.svg` and `launch-logo-dark.svg` are the flask alone, on a
transparent background, for the iOS launch screen. Their PNGs are in
`apps/web/ios/App/App/Assets.xcassets/LaunchLogo.imageset/` at 256 and 384
pixels (128 points at 2x and 3x), with transparency. The background behind them
is the `LaunchBackground` color set, which matches the page background of the
grey theme (`--bg` in `packages/ui/src/theme.css`) in light and dark; change
both together. Any renderer that keeps the alpha channel will do, for example a
few lines of Swift that draw the SVG through `NSImage` into an
`NSBitmapImageRep`.
