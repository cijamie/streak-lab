# Streak Lab

A photo editor for pixel-streak art. Pull pixels into streaks (straight, radial, swirling, out of edges or along paths), add light and motion effects, grade the result in two tones with grain, then export a full-size photo, an Instagram carousel or a video.

**Live: [jamies.dev/streak-lab](https://jamies.dev/streak-lab/)**

![Streak Lab on a computer: the Masks tab, with Protect, a linear mask and its tools](docs/screenshot.jpg)

Everything runs in your browser. Photos are never uploaded anywhere.

## How to use it

Streak Lab works like a photo editor:
- **The photo** sits in the middle.
- **Seven tabs** run along the top of the panel on a computer, or the bottom of the screen on a phone. Each tab is one step of the edit and brings only the tools that make sense for it, so tapping the photo never changes something you didn't mean to.

| Tab | What it's for | Tools on the photo |
| --- | --- | --- |
| **Crop** | Shape (Free, Original, 4:5, 1:1, 9:16, 16:9, 3:2, 5:4), rotate, flip, straighten. The full photo is kept, so you can change it later | Drag the corners or the frame |
| **Adjust** | Exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, vibrance, saturation, a tone curve, vignette and sharpening, applied before the streaks | Hand |
| **Streaks** | Layers, each one Linear, Radial, Swirl, Edge or Path, with its own sliders, opacity, blend mode and optional mask. Edge layers can snap to outlines or auto-trace the horizon | Line or Centre (tap) or Draw (edges and paths), Erase edges, Hand |
| **Masks** | **Protect** keeps your subject free of streaks. Linear, radial, brush, subject (AI) and sky masks can brighten, cool or saturate an area, limit a streak layer, or limit the duotone | Brush, Subject (tap), Erase for Protect; Draw or Paint for the selected mask |
| **Effects** | Echo trails, slit-scan, zoom/spin blur, halation, bloom, light leak, lens flare, risograph, dither, topographic lines, datamosh | Hand |
| **Grade** | Duotone colours or a palette, strength, grain, and where the duotone applies | Hand |
| **Looks** | Starter looks previewed on your photo, variations, saved looks, copy and paste settings | Hand |

The badges on Masks and Effects show how many are in use. **Undo and redo** cover everything. Your photo and edit are saved on the device, so a reload picks up where you left off, on the same tab.

### Open a photo

- **Open** a photo, tap **Try a sample**, or pick up a recent edit from the start screen. On a computer you can also drop or paste a photo.
- **HEIC photos** from an iPhone are converted automatically in browsers that can't open them.
- **The Library** keeps every photo you've edited on this device, with its edits.

### Export

- **Photo:**
  - Full resolution, cropped, as JPEG or PNG. Photos over 16 megapixels are saved as PNG.
  - Optionally keeps the camera data (EXIF), with orientation reset.
- **Carousel:**
  - 1080 × 1350 slides: finished, original, your edges and masks drawn on, then two variations.
- **Video:**
  - Eight animations, including stop-motion streaks, breathing loops and beat cuts.
  - Sizes 9:16, 4:5 or 1:1, at 5–15 seconds. Silent, so you can add music in Instagram.
- **Signature:**
  - Your own text in one of four styles, at a chosen corner, size and opacity, on photos, slides and videos.
- **Batch:**
  - In the Library, select several photos to paste the same settings onto all of them, or export them all at full size.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Ctrl/⌘ Z, Ctrl/⌘ Shift Z | Undo, redo |
| C / A / M / F / G | Crop, Adjust, Masks, Effects and Grade tabs |
| P | Streaks tab, place tool |
| B / S / E / D / H | Brush, Subject, Erase, Draw and Hand, when the tab has them |
| Hold Space | Hand tool while held |
| Hold `\` | Show the original |
| `[` `]` | Smaller or larger brush |
| 0 | Fit the photo to the screen |
| Ctrl/⌘ E | Export |
| Ctrl/⌘ Shift C / V | Copy / paste settings |
| L | Library |
| Enter (while cropping) | Finish the crop |

### Install it on your phone

- **iPhone or iPad**: open the site in Safari, tap Share, then **Add to Home Screen**.
- **Android**: in Chrome, open the menu and tap **Install app** or **Add to Home screen**.

Saving uses the share sheet where the browser supports it, so you can send images and Reels straight to Photos or Instagram. Elsewhere it downloads the files.

<img src="docs/screenshot-phone.jpg" alt="Streak Lab on a phone: the photo, the Protect tools, and the tab bar" width="300">

## Development

It's a single static page with no framework, no build step and no dependencies apart from a Google Font. The subject finder and the HEIC converter are loaded from public CDNs the first time they're used. To run it locally, serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` straight from disk also works, but the web app manifest needs a server.

| File | Purpose |
| --- | --- |
| `index.html` | The page: markup, styles and the editor's interface code |
| `engine.js` | The image pipeline: adjustments, streaks, masks and effects, as pure functions |
| `worker.js` | Renders the editing preview in the background so sliders stay smooth |
| `manifest.webmanifest` | Lets the app be installed to a home screen |
| `icons/` | Favicon, Apple touch icon and app icons |
| `og-image.png` | Preview image for links shared on social media |
| `sw.js` | Service worker that caches the app for offline use |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

The site is published with GitHub Pages from the root of the `main` branch. Because the `cijamie.github.io` user site uses the custom domain `jamies.dev`, the app is served at `https://jamies.dev/streak-lab/`.

## Licence

[MIT](LICENSE)
