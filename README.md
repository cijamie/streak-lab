# Streak Lab

A photo editor for pixel-streak art. Pull pixels into streaks (straight, radial, swirling, out of edges or along paths), add light and motion effects, grade the result in two tones with grain, then export a full-size photo, an Instagram carousel or a video.

**Live: [jamies.dev/streak-lab](https://jamies.dev/streak-lab/)**

![Streak Lab on a computer: the photo with streak layers, the tool rail, and the panels with starter looks](docs/screenshot.jpg)

Everything runs in your browser. Photos are never uploaded anywhere.

## How to use it

Streak Lab works like a photo editor:
- **The photo** sits in the middle.
- **Tools** are on the left, or along the bottom on a phone.
- **Panels** are on the right, or behind the tabs at the bottom on a phone.

### Open a photo

- **Open** a photo, tap **Try a sample**, or pick up a recent edit from the start screen. On a computer you can also drop or paste a photo.
- **HEIC photos** from an iPhone are converted automatically in browsers that can't open them.
- **The Library** keeps every photo you've edited on this device, with its edits.

### Tools

| Tool | Key | What it does |
| --- | --- | --- |
| Line / Centre / Edge / Path | P | Places the streaks for the selected layer: tap for Linear, Radial and Swirl, draw for Edge and Path |
| Protect | B | Keeps parts sharp. **Brush** paints; **Tap subject** uses an on-device AI model (Google's MediaPipe) to find a person, animal or object |
| Erase | E | Removes protect paint and cuts away parts of edges |
| Mask | M | Draws or reshapes the selected mask |
| Crop | C | Crops (Free, Original, 4:5, 1:1, 9:16, 16:9, 3:2), rotates, flips and straightens. The full photo is kept, so you can change the crop later |
| Hand | H or hold Space | Moves the photo when zoomed in |

### Panels

- **Light & colour:**
  - **Light:** exposure, contrast, highlights, shadows, whites, blacks.
  - **Colour:** temperature, tint, vibrance, saturation.
  - **Tone curve:** five points you drag up or down.
  - **Finish:** vignette and sharpening.
  - These apply before the streaks, so they also change which areas streak.
- **Streaks:** up to four **layers**, each with its own mode, opacity and blend mode (Normal, Lighten, Screen, Darken). A layer can be limited to a mask.
  - **Linear:** streaks pull out of a line, up, down, left or right.
  - **Radial:** rings around a centre point.
  - **Swirl:** bright areas trail around a centre, like star trails.
  - **Edge:** streaks grow out of edges you draw.
    - **Snap to outlines** pulls a rough line onto the real outline.
    - **Auto-trace horizon** finds the skyline in one tap.
    - **Edge overlap** lets streaks reach back over the edge and fade in.
  - **Path:** a ribbon of colour smeared along a curve you draw.
  - **Pixel sort** (Linear and Radial): sort by brightness, hue or saturation, within a brightness range.
- **Effects:** each has an on/off switch and its own sliders.
  - **Motion:**
    - **Echo trails:** fading copies of your protected subject or a mask.
    - **Slit-scan:** wave, shear or melt.
    - **Zoom & spin blur.**
  - **Light:**
    - **Halation:** a film-style red glow around highlights.
    - **Bloom on streaks.**
    - **Light leak.**
    - **Lens flare.**
  - **Texture:**
    - **Risograph:** your duotone printed as two misregistered inks in dots.
    - **Dither:** Atkinson or grid patterns, over the whole photo or only the streaks.
    - **Topographic lines.**
  - **Glitch:**
    - **Datamosh.**
- **Masks:** linear gradient, radial, brush, subject (AI, tap to select) and sky (found from the horizon). Each mask can:
  - apply its own exposure, contrast, highlights, shadows, temperature, tint and saturation;
  - limit a streak layer (Streaks › Only inside);
  - limit the duotone (Colour › Apply).
  - Masks can be inverted and feathered.
- **Colour:** three duotone colours or a palette, strength, grain, and where the duotone applies.
- **Looks:**
  - **Starter looks,** previewed on your photo.
  - **Variations** of your edit.
  - **Saved looks.**
  - **Copy and paste settings,** with or without edges, masks and crop.

**Undo and redo** cover everything above. Your current photo and edit are saved on the device, so a reload picks up where you left off.

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
| P / B / E / M / C / H | Place, Protect, Erase, Mask, Crop and Hand tools |
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

<img src="docs/screenshot-phone.jpg" alt="Streak Lab on a phone: the photo on top, tools below it, and the Effects panel" width="300">

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
