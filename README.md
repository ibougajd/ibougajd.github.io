# ilyass@1337 — portfolio

My personal site: a cyberpunk HUD in the same style as my GitHub profile, with a live night-city highway in the hero
(hold <kbd>Space</kbd> or <kbd>→</kbd> to boost the car), a working terminal, and a <kbd>Ctrl</kbd>+<kbd>K</kbd> command palette.

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
index.html            all sections
404.html              terminal-style "command not found" page
css/style.css         design tokens, HUD panels, layout
js/scene.js           hero canvas: city, sun, highway, car (pauses off-screen, respects reduced motion)
js/main.js            boot sequence, nav, terminal commands, command palette, filters, contact form
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

## Deploy (GitHub Pages)

Push the contents of this folder to the root of a repo and enable Pages, e.g. replace the contents of
`ibougajd.github.io`. Once the final domain is known, make `og:image` in `index.html` an absolute URL
(e.g. `https://ibougajd.github.io/assets/og.png`) so link previews work everywhere.
