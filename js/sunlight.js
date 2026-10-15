// Sunlight on the text: every block in the open district is backlit by that district's sun.
// For each block we take the point nearest the sun, then hand CSS the direction to the sun
// (--lx/--ly, a unit vector) and how strongly it's lit (--li, 0..1). CSS draws the rim and glow.
// Runs on arrival, panel scroll and resize only, never per frame.
(() => {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('drive')) return;

  const TEXT = 'h1, h2, h3, h4, p, li, dt, dd, blockquote, .sec-bar, .panel-bar, .project-bar, .c-meta, .case-path, .tile span, .field span, .btn, .chip-cmd, .project-link, .sn-hint, .sn-to';
  const AMBIENT = .12;          // even far from the sun the edges catch a little light
  let stage = null, sun = null, queued = false;

  function light() {
    queued = false;
    if (!stage || !sun) return;
    const vh = innerHeight;
    for (const el of stage.querySelectorAll(TEXT)) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh) continue;
      // nearest point of the block to the sun's centre (a long line is lit hardest at its sunny end)
      const px = Math.max(r.left, Math.min(sun.x, r.right));
      const py = Math.max(r.top, Math.min(sun.y, r.bottom));
      let dx = sun.x - px, dy = sun.y - py;
      if (!dx && !dy) { dx = sun.x - (r.left + r.right) / 2; dy = sun.y - (r.top + r.bottom) / 2; }
      const d = Math.hypot(dx, dy) || 1;
      // full strength over the disc, fading out over a few sun radii
      const near = Math.max(0, 1 - Math.max(0, d - sun.r * .3) / (sun.r * 3.4));
      const li = AMBIENT + (1 - AMBIENT) * Math.pow(near, 1.6);
      if (!el.hasAttribute('data-lit')) el.setAttribute('data-lit', '');
      el.style.setProperty('--lx', (dx / d).toFixed(3));
      el.style.setProperty('--ly', (dy / d).toFixed(3));
      el.style.setProperty('--li', li.toFixed(3));
    }
  }
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(light); } };

  function enter(index, el) {
    stage = el;
    sun = window.scene?.sunAt?.(index) || null;
    if (sun) root.style.setProperty('--sun-rgb', sun.rgb);
    request();
    setTimeout(request, 750);     // again once the panel has finished sliding in
  }

  document.addEventListener('stage:enter', e => enter(e.detail.index, e.detail.el));
  document.addEventListener('scroll', e => { if (stage && stage.contains(e.target)) request(); }, { capture: true, passive: true });
  addEventListener('resize', () => {
    // the scene recomputes its layout on resize; read the sun after it has
    requestAnimationFrame(() => { if (stage && window.drive) { sun = window.scene?.sunAt?.(window.drive.index) || null; request(); } });
  });

  // the background (3D or 2D) loads after this file: light the text once it knows where its sun is
  document.addEventListener('scene:ready', () => {
    const el = document.querySelector('main > .stage.is-active');
    if (el && window.drive) enter(window.drive.index, el);
  });

  // drive.js announced the first district before this file loaded
  const first = document.querySelector('main > .stage.is-active');
  if (first && window.drive) enter(window.drive.index, first);
})();
