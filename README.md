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
js/scene3d.js         picks the background: the 3D drive, or the 2D one on weak devices / ?lite
js/world3d.js         the 3D drive (three.js, WebGL): city, wet road, ramps, car, projector arm — all code, no assets
js/scene2d.js         the 2D drive (canvas), the fallback; per-district looks in its THEMES
js/drive.js           district controller: wheel / swipe / keys / links → drives, panel-first scrolling, minimap, URL hash
js/main.js            boot sequence, terminal commands, command palette, filters, contact form
js/motion.js          panel entrances, git log fill, card tilt
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
- **District look** — colors per district: the `THEMES` array in `js/world3d.js` (3D) and in `js/scene2d.js` (2D),
  same order as the sections in `index.html`. Panel hover-light colors: `--lamp-a` / `--lamp-b` in `css/style.css`.

Add `?lite` to the address to see the 2D version. Deep links work: `/#work`, `/#contact`, … start the drive in that district. With reduced motion the car parks and
districts switch instantly; without JavaScript the page falls back to a normal scrolling page.

## Deploy (GitHub Pages)

This folder is the `ibougajd.github.io` repo: push to `main` and Pages serves it from the root (`.nojekyll` skips
Jekyll). After changing CSS/JS, bump the `?v=` query on the `<link>`/`<script>` tags in `index.html` so visitors
don't get a stale cached copy.
