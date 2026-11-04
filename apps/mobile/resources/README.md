# iOS app icons

The home-screen icon in two versions, 1024 by 1024, full square and without
transparency (iOS rounds the corners itself):

- `app-icon-light.png`: the default icon, for light mode.
- `app-icon-dark.png`: the dark version, for dark mode (iOS 18 and later).

In Xcode, open the AppIcon set in `Assets.xcassets`, set Appearances to "Any,
Dark", and drop the light file in the Any slot and the dark file in the Dark
slot.

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
