# Streak Lab

Turn photos into pixel-streak art for Instagram. Pull pixels straight up, around a centre point, or out of any edge you draw, grade the result in two tones with grain, then export a full-size photo, a carousel or a Reel.

**Live: [jamies.dev/streak-lab](https://jamies.dev/streak-lab/)**

![Streak Lab on a computer, with edge streaks drawn along a mountain ridge](docs/screenshot.jpg)

Everything runs in your browser. Photos are never uploaded anywhere.

## How to use it

1. **Choose a photo.** You can also drop one onto the page or paste one on a computer.
2. **Pick a mode** on the Streaks tab:
   - **Vertical**: tap or drag on the photo to set the line the streaks rise from.
   - **Radial**: tap or drag to set the centre of the rings.
   - **Edge**: drag along a ridge, treetop, outline or the rim of the moon. Then pick a Direction. The white ticks show which way the streaks will go.
3. **Shape the streaks** with Length, Threshold (how bright a pixel must be to streak), Randomness and Band width. Use **Shuffle streaks** to try a new random pattern.
4. **Protect** (red paint) keeps the subject sharp. **Erase** removes protect paint and cuts away parts of edges. Hold **Before** to compare with the original.
5. **Colour**: set the three duotone colours or start from a palette, then adjust strength and grain.
6. **Looks**: render 4 variations and tap one to use it, or save the current settings as a named look so a whole series matches.
7. **Export**:
   - **Full size** at the photo's original resolution, as JPEG or PNG. Photos over 16 megapixels are saved as PNG.
   - **Instagram carousel**: 1080 × 1350 slides showing the finished photo, the original, your edges, and two variations if you want them.
   - **Reel**: a 7-second, 1080 × 1920 silent video in which the streaks grow or wipe across. Safari and Chrome record MP4. Browsers that only record WebM say so.

**Zoom**: pinch, scroll, or use the + and − buttons. Two fingers move the photo. Turn on **Pan** to move it with one finger or the mouse.

**Shortcuts on a computer**: Ctrl/⌘ Z undoes the last edge. Hold `\` to see the original.

### Install it on your phone

- **iPhone or iPad**: open the site in Safari, tap Share, then **Add to Home Screen**.
- **Android**: in Chrome, open the menu and tap **Install app** or **Add to Home screen**.

Saving uses the share sheet where the browser supports it, so you can send images and Reels straight to Photos or Instagram. Elsewhere it downloads the files.

<img src="docs/screenshot-phone.jpg" alt="Streak Lab on a phone: the photo stays pinned at the top while the controls scroll below it" width="300">

## Development

It's a single static `index.html` with no framework, no build step and no dependencies apart from a Google Font. To run it locally, serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` straight from disk also works, but the web app manifest needs a server.

| File | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles and script |
| `manifest.webmanifest` | Lets the app be installed to a home screen |
| `icons/` | Favicon, Apple touch icon and app icons |
| `og-image.png` | Preview image for links shared on social media |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

The site is published with GitHub Pages from the root of the `main` branch. Because the `cijamie.github.io` user site uses the custom domain `jamies.dev`, the app is served at `https://jamies.dev/streak-lab/`.

## Licence

[MIT](LICENSE)
