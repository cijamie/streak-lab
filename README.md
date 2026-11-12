# Streak Lab

Four photo tools for light, motion and pixels. **Streak Lab** is a photo editor for pixel-streak art, **Portals** swaps a square between two photos, and **Pulse** and **Flow** turn one photo into a seamless video loop. Pull pixels into streaks (straight, radial, swirling, out of edges or along paths), add light and motion effects, grade the result in two tones with grain, then export a full-size photo, an Instagram carousel or a video.

**Live: [jamies.dev/streak-lab](https://jamies.dev/streak-lab/)**

![Streak Lab on a computer: the Masks tab, with Protect, a linear mask and its tools](docs/screenshot.jpg)

Everything runs in your browser. Photos are never uploaded anywhere.

## The dashboard

The start screen lets you choose a tool, and shows your recent Streak Lab edits so you can pick up where you left off. Tap the logo in either tool to come back to it. If you reload in the middle of an edit, it reopens where you were.

## Portals

[jamies.dev/streak-lab/portals.html](https://jamies.dev/streak-lab/portals.html)

Portals puts photos in windows on each other. Pick a style:

| Style | Photos | What it does |
| --- | --- | --- |
| **Split window** | 4 | Two photos fill the frame side by side (or top and bottom); a window across the seam holds the other two |
| **Swap squares** | 2 | The same square is cut out of both photos and swapped, so each shows a piece of the other |
| **Cross split** | 2 | The two photos sit side by side, and a window across the seam shows each one on the other's side |
| **Window** | 2 | One photo inside a window on another |

1. **Choose photos**, or try the sample photos. For Split window, **Auto-arrange** puts even textures (sand, sea, grass) behind and scenes in the window, choosing the order with the most colour contrast between each window half and the background behind it. **Shuffle** tries other orders.
2. **Shape:**
   - **Swap squares:** Stacked 4:5, Side by side, Story 9:16, or a two-slide Carousel.
   - **Other styles:** 4:5, 1:1 or 9:16.
3. **Style the window:**
   - **Size**, and **shape** (square, rounded, or circle for Swap squares).
   - **Border**, with its colour, and an optional **soft shadow**.
4. **Frame each part:**
   - **Drag a part** of the preview to reframe it, and scroll or use the slider to zoom it.
   - **Swap squares:** drag the window to move it; "Same spot in both photos" keeps the two windows lined up.
5. **Save** at 1080 or 2160 wide, or tap **Edit the result in Streak Lab** to add streaks, effects or a grade.

Your last photos and settings are kept on the device. For a carousel like the ones on Instagram, make several and post them together.

## Pulse and Flow

[jamies.dev/streak-lab/pulse.html](https://jamies.dev/streak-lab/pulse.html) · [jamies.dev/streak-lab/flow.html](https://jamies.dev/streak-lab/flow.html)

Two related series for one idea: the photograph stays recognisable, but its movement shows a feeling the camera alone couldn't capture.

**Pulse: a photograph with a pulse.** Tap the thing whose presence changes the space, like an empty chair, a lit window or a distant figure. A quiet disturbance spreads from it, echoes and settles back into the photograph. The thing itself stays still (the *still zone*); only the space around it moves.

| Movement | What it does |
| --- | --- |
| **Ripple** | A soft wave spreads out, sometimes with a weaker, slightly different echo |
| **Breathing** | The space slowly expands and contracts |
| **Tension** | Straight lines bow toward the source, hold, then release |
| **Aftershock** | One clear disturbance, then smaller echoes |
| **Interrupted** | The pulse starts, hesitates, then carries on |
| **Directional** | The pulse travels one way, down a hallway or along a road |

**Flow: the world flows around one detail.** Tap the one thing the photograph refuses to lose. It stays perfectly still while everything else stretches into a slow current and returns. Use the oval, or let an on-device AI model find its exact outline.

| Movement | What it does |
| --- | --- |
| **The anchor** | The surroundings part around the subject like a current around a stone |
| **The last detail** | Everything else stretches into bands, softens toward colour and pulls apart in patches |
| **Resistance** | The stretching creeps up to the subject's edge, slows, and retreats |

How they work:
- **Personality:** Each loop gets its own randomised personality, described in words: when the pulses come, how strong and uneven they are, which areas move first, where the longest trails form and how unevenly things return. The subject and the main direction stay yours. **New personality** rolls another one; **Unpredictability** sets how far it can vary.
- **Shared settings:** The **Look** (None, Muted, Night, Mono or Faded, plus grain), the **shape** and the **loop length** (6–12 s) are shared between the two tools, so a series matches.
- **Make the other version:** This button opens the same photo in the other tool: the source of the pulse becomes what stays still.
- **Export:** **Make video** records one seamless loop at 1080 wide. It starts and ends on the untouched photo. **Save this frame** saves a still.

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
| `index.html` | The dashboard and the Streak Lab editor |
| `portals.html` | Portals, the two-photo square swap |
| `pulse.html`, `flow.html` | Pulse and Flow, the two video-loop tools |
| `living.js`, `living.css` | Shared code for Pulse and Flow: WebGL shaders, personalities, recording |
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
