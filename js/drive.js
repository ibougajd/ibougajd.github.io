// Drive mode: the window never scrolls. Wheel, swipe, keys and links move the car between districts
// (the stages). A district's text scrolls first; driving on takes a deliberate pull past its end.
// One gesture = one district, so trackpad momentum can't fling you across the whole city.
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => [...r.querySelectorAll(sel)];
  const stages = $$('main > .stage');
  if (!root.classList.contains('drive') || !stages.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ids = stages.map(s => s.id);
  const names = stages.map(s => s.dataset.name);
  const last = stages.length - 1;
  const pad = i => String(i).padStart(2, '0');
  const scrollerOf = i => $('.stage-scroll', stages[i]);
  const ALIAS = { '': 0, home: 0, projects: 'work' };
  const indexOf = id => {
    const a = ALIAS[id];
    if (typeof a === 'number') return a;
    return ids.indexOf(a || id);
  };

  let cur = 0, busy = false, queued = null, lockUntil = 0;
  const waiting = [];

  // ------------------------------------------------------------ dashboard
  const topbar = $('#topbar'), progress = $('#progress'), live = $('#drive-live');
  const navLinks = $$('[data-nav]');
  const dcNo = $('#dc-no'), dcName = $('#dc-name'), dcPrev = $('#dc-prev'), dcNext = $('#dc-next');
  const card = $('#district'), cardNo = $('#district-no'), cardName = $('#district-name');
  const rail = $('#route'), railLine = $('#route-line'), railFill = $('#route-fill'), railCar = $('#route-car'),
        railPct = $('#route-pct');
  const railStops = $$('.route-stops li', rail || document);
  const accent = i => window.scene?.accent?.(i) || '#05d9e8';

  // the minimap is the same zigzag the car drives: alternate sides, top to bottom
  const pts = stages.map((_, i) => [i % 2 ? 80 : 20, (i / last) * 100]);
  if (railLine) railLine.setAttribute('points', pts.map(p => p.join(',')).join(' '));
  railStops.forEach((li, i) => { if (pts[i]) { li.style.left = `${pts[i][0]}%`; li.style.top = `${pts[i][1]}%`; } });

  function setPos(x) {
    x = Math.max(0, Math.min(last, x));
    if (progress) progress.style.transform = `scaleX(${x / last})`;
    if (!railFill) return;
    const i = Math.min(last - 1, Math.floor(x)), u = x - i;
    const a = pts[i], b = pts[i + 1];
    const here = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    railFill.setAttribute('points', [...pts.slice(0, i + 1), here].map(p => p.join(',')).join(' '));
    const w = rail.clientWidth, h = rail.clientHeight;
    const ang = Math.atan2((b[1] - a[1]) * h, (b[0] - a[0]) * w) * 180 / Math.PI;
    railCar.style.left = `${here[0]}%`; railCar.style.top = `${here[1]}%`;
    railCar.style.transform = `translate(-50%, -50%) rotate(${ang}deg)`;
  }

  function chrome(i) {
    root.style.setProperty('--district', accent(i));
    topbar?.classList.toggle('is-scrolled', i > 0);
    navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.nav === ids[i]));
    railStops.forEach((li, j) => {
      const a = li.firstElementChild;
      a.classList.toggle('is-passed', j <= i);
      a.classList.toggle('is-here', j === i);
      if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (railPct) railPct.textContent = `LVL ${i}/${last}`;
    if (dcNo) { dcNo.textContent = pad(i); dcName.textContent = names[i]; }
    if (dcPrev) dcPrev.disabled = i === 0;
    if (dcNext) dcNext.disabled = i === last;
  }

  function showCard(i) {
    if (!card) return;
    cardNo.textContent = pad(i); cardName.textContent = names[i];
    card.style.setProperty('--dc', accent(i));
  }

  // ------------------------------------------------------------ stages
  function leave(i, animated) {
    const st = stages[i];
    st.classList.remove('is-active', 'is-entering');
    st.setAttribute('inert', '');
    if (!animated) return;
    st.classList.add('is-leaving');
    setTimeout(() => st.classList.remove('is-leaving'), 460);
  }

  function arrive(i, animated) {
    const st = stages[i];
    stages.forEach((s, j) => { if (j !== i) { s.classList.remove('is-active', 'is-entering'); s.setAttribute('inert', ''); } });
    st.removeAttribute('inert');
    st.classList.remove('is-leaving');
    st.classList.add('is-active');
    if (animated) { st.classList.remove('is-entering'); void st.offsetWidth; st.classList.add('is-entering'); }
    chrome(i);
    const sc = scrollerOf(i);
    if (sc) sc.scrollTop = 0;
    // focus fell out of the district we just left: keep keyboard and screen-reader users with the car
    const ae = document.activeElement;
    if (sc && (!ae || ae === document.body || ae.closest('[inert]'))) sc.focus({ preventScroll: true });
    if (live) live.textContent = `${st.dataset.title} — district ${i} of ${last}`;
    const url = i === 0 ? location.pathname + location.search : `#${ids[i]}`;
    try { history.replaceState(null, '', url); } catch { /* sandboxed */ }
    document.dispatchEvent(new CustomEvent('stage:enter', { detail: { index: i, id: ids[i], el: st } }));
  }

  async function travel(from, to) {
    const scene = window.scene;
    const animated = !!(scene && scene.animated && !reduce);
    const dir = Math.sign(to - from), n = Math.abs(to - from);
    const per = n === 1 ? 1.7 : Math.max(0.55, 2.4 / n);
    leave(from, animated);
    let shown = false;
    for (let k = 1; k <= n; k++) {
      const next = from + dir * k, final = k === n;
      if (animated) showCard(next);
      const onProgress = p => {
        setPos(next - dir * (1 - p));
        card?.classList.toggle('is-on', animated && p > 0.1 && p < 0.64);
        if (final && !shown && p >= 0.72) { shown = true; arrive(to, animated); }
      };
      if (scene) await scene.step(next, per, onProgress);
      cur = next;
    }
    card?.classList.remove('is-on');
    if (!shown) arrive(to, animated);
    setPos(to);
  }

  // drive to a district (index or id); resolves once the car has parked there
  async function go(target) {
    if (typeof target === 'string') target = indexOf(target);
    if (!(target >= 0 && target <= last)) return;
    if (busy) { queued = target; return new Promise(r => waiting.push(r)); }
    if (target === cur) return;
    busy = true;
    try {
      while (target !== null && target !== cur) {
        await travel(cur, target);
        target = queued; queued = null;
      }
    } finally {
      busy = false;
      lockUntil = performance.now() + 250;
      waiting.splice(0).forEach(r => r());
    }
  }

  // "keep going" prompt at the end of every panel
  stages.forEach((st, i) => {
    const sc = scrollerOf(i);
    if (!sc || i === 0) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'stage-next';
    b.innerHTML = i < last
      ? `<span class="sn-hint">keep scrolling to drive on</span><span class="sn-to">${pad(i + 1)} // ${names[i + 1]}</span>`
      : `<span class="sn-hint">end of the road</span><span class="sn-to">back to ${pad(0)} // ${names[0]}</span>`;
    b.addEventListener('click', () => go(i < last ? i + 1 : 0));
    sc.append(b);
  });

  // ------------------------------------------------------------ input
  const isTyping = el => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable]');
  const blocked = target => root.classList.contains('booting') || !$('#palette')?.hidden || (target instanceof Element && !!target.closest('.palette'));
  const canScroll = (el, dir) => (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 1);

  // the nearest scroller between the target and the panel that can still move this way
  function scrollerFor(target, dir) {
    const sc = scrollerOf(cur);
    for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
      if (el === sc) return canScroll(sc, dir) ? sc : null;
      if (el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY) && canScroll(el, dir)) return el;
    }
    return null;
  }
  const inPanel = target => target instanceof Element && !!target.closest('.stage');

  // Leaving a district is a deliberate pull past the end of its text, never a side effect of reading:
  //  - a gesture that scrolled the text can't drive, even if it carries on past the end
  //  - right after the text stops at its edge there's a short settle time before pulling counts
  //  - then you keep scrolling ~3 wheel notches (or one firm swipe) while a meter fills; let go and it drains
  const SETTLE = 450;                                   // ms the text must sit still at its edge
  const pullMeter = $('#pull'), pullFill = $('#pull-fill'), pullLabel = $('#pull-label');
  let pull = 0, pullDir = 0, pullTouched = 0, pullHold = 260, draining = false;
  let settledAt = performance.now();                    // last time the open panel moved (or the district opened)
  document.addEventListener('scroll', e => { if (e.target === scrollerOf(cur)) settledAt = performance.now(); }, { capture: true, passive: true });
  document.addEventListener('stage:enter', () => { settledAt = performance.now(); setPull(0, 0); });

  const nothingToRead = () => { const sc = scrollerOf(cur); return !sc || sc.scrollHeight <= sc.clientHeight + 2; };
  const settled = (ms = SETTLE) => nothingToRead() || performance.now() - settledAt >= ms;

  function setPull(dir, value) {
    if (dir && !(cur + dir >= 0 && cur + dir <= last)) value = 0;   // no road that way
    pull = Math.max(0, Math.min(1, value));
    pullDir = pull ? dir : 0;
    if (!pullMeter) return;
    pullMeter.classList.toggle('is-on', pull > 0);
    if (pull > 0) {
      const to = cur + dir;
      const verb = pullHold > 1000 && pull >= .5 ? 'swipe again' : 'keep scrolling';
      pullLabel.textContent = dir > 0 ? `${verb} · ${pad(to)} // ${names[to]}` : `${verb} · back to ${pad(to)} // ${names[to]}`;
      pullMeter.dataset.dir = dir > 0 ? 'down' : 'up';
    }
    pullFill.style.transform = `scaleX(${pull})`;
  }
  // pull drains back to empty once you stop pushing
  function drain() {
    if (draining) return;
    draining = true;
    let lastT = performance.now();
    const tick = now => {
      const dt = (now - lastT) / 1000; lastT = now;
      if (now - pullTouched > pullHold && pull > 0) setPull(pullDir, pull - dt * 1.6);
      if (pull > 0) requestAnimationFrame(tick); else draining = false;
    };
    requestAnimationFrame(tick);
  }
  function addPull(dir, amount) {
    pullTouched = performance.now(); pullHold = 260;
    setPull(dir, (pullDir === dir ? pull : 0) + amount);
    if (pull >= 1) { setPull(0, 0); go(cur + dir); return true; }
    drain();
    return false;
  }

  let gesture = { used: false, read: false }, lastWheel = 0;
  addEventListener('wheel', e => {
    if (e.ctrlKey || blocked(e.target)) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (!dy || Math.abs(dy) < Math.abs(e.deltaX)) return;
    const now = performance.now(), dir = Math.sign(dy);
    if (now - lastWheel > 200) gesture = { used: false, read: false };
    lastWheel = now;
    // content first: let the panel (or a scroller inside it) take the wheel
    if (scrollerFor(e.target, dir)) { gesture.read = true; setPull(0, 0); return; }
    e.preventDefault();
    const sc = scrollerOf(cur);
    if (!inPanel(e.target) && sc && canScroll(sc, dir)) { sc.scrollTop += dy; gesture.read = true; setPull(0, 0); return; }
    if (busy || now < lockUntil) { gesture.used = true; return; }
    if (gesture.read) { settledAt = now; return; }   // still the reading flick: the settle time starts when it ends
    if (gesture.used || !settled()) return;
    // a short panel (or the start screen) has nothing to read, so one notch is enough there
    const per = nothingToRead() ? 90 : 330;
    if (addPull(dir, Math.min(Math.abs(dy), 160) / per)) gesture.used = true;
  }, { passive: false });

  // Touch: a flick that ends at the bottom is too easy to repeat by accident, so at the end of the text
  // the first swipe only half-fills the meter (it stays up a few seconds) and a second swipe drives on.
  // On the road below the text there's nothing to read: one swipe drives.
  let touch = null;
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || blocked(e.target) || busy) { touch = null; return; }
    const p = e.touches[0], onText = inPanel(e.target);
    const calm = settled(650);
    if (onText && !calm) settledAt = performance.now();   // still flicking through the text: the pause starts over
    const edge = dir => !onText || (!scrollerFor(e.target, dir) && calm);
    touch = { x: p.clientX, y: p.clientY, onText, base: pull, baseDir: pullDir, 1: edge(1), '-1': edge(-1) };
  }, { passive: true });
  const touchTarget = (T, dir) => (T.baseDir === dir ? T.base : 0) + (T.onText ? .5 : 1);
  addEventListener('touchmove', e => {
    const T = touch;
    if (!T) return;
    const p = e.touches[0];
    const dx = p.clientX - T.x, dy = T.y - p.clientY, dir = dy > 0 ? 1 : -1;
    if (!T[dir] || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    const from = T.baseDir === dir ? T.base : 0;
    pullTouched = performance.now(); pullHold = 2500;
    setPull(dir, from + (touchTarget(T, dir) - from) * Math.min(1, Math.max(0, Math.abs(dy) - 20) / 90));   // the meter follows your finger
  }, { passive: true });
  addEventListener('touchend', e => {
    const T = touch; touch = null;
    if (!T) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - T.x, dy = T.y - p.clientY, dir = dy > 0 ? 1 : -1;
    const counts = T[dir] && Math.abs(dy) >= 60 && Math.abs(dy) >= Math.abs(dx) * 1.3;
    if (!counts) {
      if (T.onText) settledAt = performance.now();        // the pause is measured from when the finger lifts
      setPull(T.baseDir, T.base); drain(); return;
    }
    const total = touchTarget(T, dir);
    if (total >= 1 && !busy && performance.now() >= lockUntil) { setPull(0, 0); go(cur + dir); return; }
    pullTouched = performance.now(); pullHold = 2500;      // half full: one more swipe drives on
    setPull(dir, Math.min(total, .5));
    drain();
  }, { passive: true });
  addEventListener('touchcancel', () => { touch = null; drain(); }, { passive: true });

  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || blocked(e.target) || isTyping(e.target)) return;
    let dir = 0, page = false;
    switch (e.key) {
      case 'ArrowDown': dir = 1; break;
      case 'ArrowUp': dir = -1; break;
      case 'PageDown': dir = 1; page = true; break;
      case 'PageUp': dir = -1; page = true; break;
      case 'Home': e.preventDefault(); go(0); return;
      case 'End': e.preventDefault(); go(last); return;
      default: return;
    }
    const inner = scrollerFor(document.activeElement, dir);
    const sc = scrollerOf(cur);
    if (inner && inner !== sc) return;   // a nested scroller (the terminal) handles its own keys
    e.preventDefault();
    if (sc && canScroll(sc, dir)) {
      sc.scrollBy({ top: dir * (page ? sc.clientHeight * 0.85 : 90), behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    // at the edge: two presses drive on (held keys never do)
    if (!busy && !e.repeat && settled()) addPull(dir, nothingToRead() ? 1 : .55);
  });

  // panel lamp: the light inside a panel opens from (and follows) the pointer; on touch it switches on while
  // you're reading and fades a moment after your finger lifts (CSS draws it: .stage-panel::before)
  for (const panel of $$('.stage-panel.panel')) {
    const aim = (x, y) => {
      const r = panel.getBoundingClientRect();
      panel.style.setProperty('--mx', `${x - r.left}px`);
      panel.style.setProperty('--my', `${y - r.top}px`);
    };
    panel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY); });
    panel.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY); }, { passive: true });
    let off = 0;
    panel.addEventListener('touchstart', e => {
      aim(e.touches[0].clientX, e.touches[0].clientY);
      clearTimeout(off);
      panel.classList.add('is-lit');
    }, { passive: true });
    panel.addEventListener('touchend', () => { clearTimeout(off); off = setTimeout(() => panel.classList.remove('is-lit'), 2500); }, { passive: true });
  }

  dcPrev?.addEventListener('click', () => go(cur - 1));
  dcNext?.addEventListener('click', () => go(cur + 1));

  // in-page links drive instead of jumping
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (id === 'main') { e.preventDefault(); scrollerOf(cur)?.focus(); return; }
    const i = indexOf(id);
    if (i < 0) return;
    e.preventDefault();
    go(i);
  });
  addEventListener('hashchange', () => {
    const i = indexOf(location.hash.slice(1));
    if (i >= 0 && i !== cur) go(i);
  });

  addEventListener('resize', () => setPos(cur));
  // the background loads asynchronously (3D, or the 2D fallback): when it's ready, put it where we are
  document.addEventListener('scene:ready', () => { window.scene?.set?.(cur); chrome(cur); });

  // ------------------------------------------------------------ start where the URL says
  cur = Math.max(0, indexOf(location.hash.slice(1)));
  window.scene?.set(cur);
  stages.forEach((s, j) => { if (j !== cur) s.setAttribute('inert', ''); });
  stages[cur].classList.add('is-active');
  chrome(cur);
  setPos(cur);
  document.dispatchEvent(new CustomEvent('stage:enter', { detail: { index: cur, id: ids[cur], el: stages[cur] } }));

  window.drive = { go, get index() { return cur; }, get id() { return ids[cur]; } };
})();
