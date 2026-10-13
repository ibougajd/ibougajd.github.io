// Drive mode: the window never scrolls. Wheel, swipe, keys and links move the car between districts
// (the stages). A district's panel scrolls first; only once it hits its edge does the car drive on.
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

  let gesture = { used: false, acc: 0 }, lastWheel = 0;
  addEventListener('wheel', e => {
    if (e.ctrlKey || blocked(e.target)) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (!dy || Math.abs(dy) < Math.abs(e.deltaX)) return;
    const now = performance.now(), dir = Math.sign(dy);
    if (now - lastWheel > 180) gesture = { used: false, acc: 0 };
    lastWheel = now;
    // content first: let the panel (or a scroller inside it) take the wheel
    if (scrollerFor(e.target, dir)) { gesture.used = true; return; }
    e.preventDefault();
    const sc = scrollerOf(cur);
    if (!inPanel(e.target) && sc && canScroll(sc, dir)) { sc.scrollTop += dy; gesture.used = true; return; }
    if (busy || now < lockUntil) { gesture.used = true; return; }
    if (gesture.used) return;
    if (Math.sign(gesture.acc) !== dir) gesture.acc = 0;
    gesture.acc += dy;
    if (Math.abs(gesture.acc) >= 40) { gesture.used = true; go(cur + dir); }
  }, { passive: false });

  let touch = null;
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || blocked(e.target)) { touch = null; return; }
    const p = e.touches[0];
    // swipes on the panel only drive once the panel is already at that edge; swipes on the road always drive
    const edge = dir => !inPanel(e.target) || !scrollerFor(e.target, dir);
    touch = { x: p.clientX, y: p.clientY, t: performance.now(), next: edge(1), prev: edge(-1) };
  }, { passive: true });
  addEventListener('touchend', e => {
    const T = touch; touch = null;
    if (!T || busy || performance.now() < lockUntil) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - T.x, dy = T.y - p.clientY;
    if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx) * 1.3 || performance.now() - T.t > 900) return;
    const dir = dy > 0 ? 1 : -1;
    if (dir > 0 ? T.next : T.prev) go(cur + dir);
  }, { passive: true });

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
    if (!busy && !e.repeat) go(cur + dir);
  });

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
