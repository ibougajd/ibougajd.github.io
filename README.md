# ilyass@1337 — portfolio

My personal site: a cyberpunk HUD in the same style as my GitHub profile, built as one night drive.
The window never scrolls. Every section is a district on a zigzag highway: scroll (or swipe, or press ↓) and the car
runs to the end of its level, U-turns down a ramp to the next one, and the new district rolls in with its own colors.
A panel that holds more than fits scrolls first; the car only drives on once you reach its edge.
Hold <kbd>Space</kbd> or <kbd>→</kbd> to boost. There's also a working terminal and a <kbd>Ctrl</kbd>+<kbd>K</kbd> command palette.

Static HTML/CSS/JS — no framework, no build step.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Open it through a server rather than `file://` — the icon sprite (`assets/icons.svg`) is loaded with `<use href>`,
which browsers block on `file://`.

## Structure

```
index.html            all sections, each one a <section class="stage"> (a district)
404.html              terminal-style "command not found" page
css/style.css         design tokens, HUD panels, layout; "DRIVE MODE" at the end is the fixed-window layout
js/scene.js           the drive: per-district themes (THEMES), city, highway, ramps, car — canvas, no assets
js/car3d.js           the car as a 3D model (three.js) drawn over the 2D drive; falls back to the drawn car
js/city3d.js          renders each district's skyline strips from 3D towers once; falls back to the drawn buildings
js/drive.js           district controller: wheel / swipe / keys / links → drives, panel-first scrolling, minimap, URL hash
js/main.js            boot sequence, terminal commands, command palette, filters, contact form
js/motion.js          panel entrances, git log fill, card tilt
assets/models/        cyberpunk-car.glb (22 MB) and skyline.glb (10 MB), the original files at full resolution
assets/icons.svg      logo sprite built from Simple Icons
assets/og.png         social preview image
tools/build-icons.py  rebuilds the sprite — add a slug to SLUGS and re-run
tools/og.html         template for og.png (serve the site, screenshot at 1200×630)
```

## Editing content

- **Projects** — `index.html`, `#work` section (one `<li class="project">` per project, `data-cat` drives the filters).
- **Stack** — the `STACK` array in `js/main.js`.
- **Terminal commands** — the `COMMANDS` object in `js/main.js`.
- **CV** — replace `assets/ilyass-bougajdi-cv.pdf`.
- **Contact form** — posts to Formspree (`action` on `#mailer`).
- **District look** — colors, skyline height and neon sign words per district: the `THEMES` array in `js/scene.js`
  (same order as the sections in `index.html`).

Deep links work: `/#work`, `/#contact`, … start the drive in that district. With reduced motion the car parks and
districts switch instantly; without JavaScript the page falls back to a normal scrolling page.

## Deploy (GitHub Pages)

This folder is the `ibougajd.github.io` repo: push to `main` and Pages serves it from the root (`.nojekyll` skips
Jekyll). After changing CSS/JS, bump the `?v=` query on the `<link>`/`<script>` tags in `index.html` so visitors
don't get a stale cached copy.

## Credits

3D car: [“Cyberpunk car”](https://sketchfab.com/3d-models/cyberpunk-car-b4301ff99d214d16a7a43708a5866bf0) by
[4d_Bob](https://sketchfab.com/3d_Bob), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Used unmodified.

Skyline towers: [“Low Poly Night City Building Skyline”](https://sketchfab.com/3d-models/low-poly-night-city-building-skyline-b0035b8713b048bb8ddf311ee67c28c8)
by [99.Miles](https://sketchfab.com/99.Miles), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Used unmodified.

Both credits also appear in the site footer and must stay there while the models are used.
