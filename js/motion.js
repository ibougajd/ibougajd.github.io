// Scroll choreography. Rules (from motion-design research): every motion has a purpose, entrances
// ease-out in 400–700ms, travel ≤ 30px, stagger ≤ 6 items, reveal once, never hijack the scroll,
// and reduced-motion users get the final state immediately.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const reveals = $$('.reveal');

  // ---------------------------------------------------------------- stagger indices (≤ 6 per row)
  const STAGGER = ['.principles', '.projects', '.case-points', '.kv', '.socials', '.mailer', '.contact-actions', '.hero-cta', '.term-hint'];
  STAGGER.forEach(sel => $$(sel).forEach(list => {
    [...list.children].forEach((el, i) => el.style.setProperty('--i', i % 6));
    list.classList.add('stagger');
  }));

  // big parallax numbers behind each section
  const sections = $$('main > section.section');
  sections.forEach((sec, i) => {
    const n = document.createElement('span');
    n.className = 'sec-num'; n.setAttribute('aria-hidden', 'true');
    n.textContent = String(i + 1).padStart(2, '0');
    sec.prepend(n);
  });

  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-in'));
    $$('.stagger, .diagram, .gitlog').forEach(el => el.classList.add('is-in'));
    $$('.commit').forEach(el => el.classList.add('is-lit'));
    return;
  }
  document.documentElement.classList.add('motion');

  // ---------------------------------------------------------------- text effects
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFXYZ$%&';
  function scramble(el, duration = 750) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    const start = performance.now();
    const jitter = [...final].map(() => Math.random() * 0.35);
    const step = now => {
      const p = clamp((now - start) / duration);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        const done = p >= (i / final.length) * 0.65 + jitter[i];
        out += ch === ' ' || done ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  }
  function typeText(el, speed = 32, delay = 0) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    el.textContent = '';
    el.classList.add('typing');
    let i = 0;
    setTimeout(function tick() {
      el.textContent = final.slice(0, ++i);
      if (i < final.length) setTimeout(tick, speed);
      else setTimeout(() => el.classList.remove('typing'), 900);
    }, delay);
  }
  function countUp(el, to, duration = 700) {
    const start = performance.now();
    const step = now => {
      const p = clamp((now - start) / duration);
      el.textContent = `[${String(Math.round(to * (1 - Math.pow(1 - p, 3)))).padStart(2, '0')}]`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // section headings: wrap the title text so it can be decoded
  $$('.sec-head h2').forEach(h => {
    const node = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const span = document.createElement('span');
    span.className = 'h-text';
    span.textContent = node.textContent;
    h.setAttribute('aria-label', node.textContent.trim());
    span.setAttribute('aria-hidden', 'true');
    node.replaceWith(span);
  });

  // ---------------------------------------------------------------- one-shot entrances
  function enter(el) {
    el.classList.add('is-in');
    if (el.matches('.sec-head')) {
      const h = $('.h-text', el), cmd = $('.sec-cmd', el);
      if (h) setTimeout(() => scramble(h, 800), 180);
      if (cmd) typeText(cmd, 30, 520);
    }
    if (el.matches('.stack-group')) {
      const c = $('[data-count]', el);
      if (c) countUp(c, +c.dataset.count);
    }
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      enter(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .stagger, .diagram, .stack-group').forEach(el => io.observe(el));

  // the terminal introduces itself once when you arrive
  const termInput = $('#term-input'), termForm = $('#term-form');
  if (termInput && termForm) {
    const tio = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      tio.disconnect();
      if (termInput.value || document.activeElement === termInput) return;
      const demo = 'whoami';
      let i = 0;
      setTimeout(function tick() {
        if (document.activeElement === termInput) return;
        termInput.value = demo.slice(0, ++i);
        if (i < demo.length) setTimeout(tick, 110);
        else setTimeout(() => termForm.requestSubmit(), 350);
      }, 700);
    }, { threshold: 0.6 });
    tio.observe($('#term'));
  }

  // ---------------------------------------------------------------- scroll-linked motion (one rAF loop)
  const heroInner = $('.hero-inner'), heroFade = $('#hero-fade'), hud = $('.hud-speed'), hint = $('.scroll-hint');
  const grid = $('#bg-grid');
  const bands = $$('.band-track');
  const nums = $$('.sec-num');
  const gitlog = $('.gitlog'), commits = $$('.commit');
  const route = $('#route'), routeFill = $('#route-fill'), routeCar = $('#route-car'),
        routeLabel = $('#route-label'), routePct = $('#route-pct');
  const stops = $$('[data-stop]');
  const NAMES = { about: 'WHOAMI', work: 'PROJECTS', stack: 'STACK', journey: 'GIT LOG', shell: 'SHELL', contact: 'CONTACT' };

  let gitFill = null;
  if (gitlog) {
    gitFill = document.createElement('span');
    gitFill.className = 'gitlog-fill';
    gitlog.prepend(gitFill);
  }

  // alternating section slides: 01 from the left, 02 from the right, … scrubbed 1:1 with the scroll.
  // Positions are cached (offsetTop ignores transforms) so a frame only writes transforms.
  let tops = [];
  const measure = () => { tops = sections.map(sec => sec.offsetTop); request(); };
  new ResizeObserver(measure).observe(document.body);
  // target x comes straight from the scroll; the drawn x glides toward it (inertia) so wheel
  // ticks become smooth motion instead of jumps. Frame-rate independent smoothing.
  const slideState = sections.map(() => ({ cur: null, target: 0 }));
  const SMOOTH = 6;                                 // higher = snappier, lower = floatier
  let lastSlideTs = 0, gliding = false;
  function slide(y, vh, vw) {
    const mobile = vw < 700;
    const dist = mobile ? vw * 0.5 : vw * 0.8;
    const start = vh, end = vh * 0.02;              // spread the slide over almost a full screen of scroll
    sections.forEach((sec, i) => {
      const p = clamp((start - (tops[i] - y)) / (start - end));
      const e = 0.5 - Math.cos(Math.PI * p) / 2;    // ease-in-out: slow in, glide, slow landing
      slideState[i].target = (i % 2 ? 1 : -1) * (1 - e) * dist;
    });
    if (!gliding) { gliding = true; lastSlideTs = performance.now(); requestAnimationFrame(glide); }
  }
  function glide(now) {
    const dt = Math.min(0.05, (now - lastSlideTs) / 1000);
    lastSlideTs = now;
    const k = 1 - Math.exp(-SMOOTH * dt);
    let moving = false;
    sections.forEach((sec, i) => {
      const st = slideState[i];
      if (st.cur === null) st.cur = st.target;     // first frame: jump straight to position
      else st.cur += (st.target - st.cur) * k;
      if (Math.abs(st.target - st.cur) < 0.5) st.cur = st.target; else moving = true;
      const x = Math.round(st.cur * 10) / 10;
      if (x === st.drawn) return;
      st.drawn = x;
      if (x === 0) { sec.style.transform = ''; sec.classList.remove('is-sliding'); }
      else { sec.classList.add('is-sliding'); sec.style.transform = `translate3d(${x}px, 0, 0)`; }
    });
    if (moving) requestAnimationFrame(glide); else gliding = false;
  }

  let ticking = false, lastLabel = '';
  function frame() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    const docH = document.documentElement.scrollHeight - vh;
    if (tops.length) slide(y, vh, innerWidth);

    // hero hand-off: content lifts away and the scene dims as you leave it
    if (y < vh * 1.2) {
      const p = clamp(y / (vh * 0.75));
      if (heroInner) { heroInner.style.transform = `translate3d(0, ${-y * 0.28}px, 0)`; heroInner.style.opacity = String(1 - p * 1.1); }
      if (heroFade) heroFade.style.opacity = String(p * 0.75);
      if (hud) hud.style.opacity = String(1 - p * 1.6);
      if (hint) hint.style.opacity = String(1 - p * 3);
    }

    // background grid drifts slower than the page (depth)
    if (grid) grid.style.transform = `translate3d(0, ${-((y * 0.3) % 44)}px, 0)`;

    // data-stream ribbons move with the scroll, alternating direction
    bands.forEach((b, i) => {
      const r = b.parentElement.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      const w = b.scrollWidth / 4;
      const off = ((y * 0.45) % w + w) % w;
      b.style.transform = `translate3d(${i % 2 ? off - w : -off}px, 0, 0)`;
    });

    // giant section numbers float at a different depth
    nums.forEach(n => {
      const r = n.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      n.style.transform = `translate3d(0, ${(r.top + r.height / 2 - vh / 2) * -0.18}px, 0)`;
    });

    // git log: the branch line grows with the scroll and lights each commit it reaches
    if (gitlog) {
      const r = gitlog.getBoundingClientRect();
      const reach = vh * 0.62 - r.top;
      gitFill.style.transform = `scaleY(${clamp(reach / r.height)})`;
      commits.forEach(cm => cm.classList.toggle('is-lit', cm.offsetTop + 10 < reach));
    }

    // route rail: a mini car drives between section checkpoints
    if (route && stops.length) {
      const tops = sections.map(s => s.offsetTop - vh * 0.35);
      let idx = -1;
      for (let i = 0; i < tops.length; i++) if (y >= tops[i]) idx = i;
      let p;
      if (idx < 0) p = clamp(y / Math.max(1, tops[0])) * (1 / (tops.length));
      else {
        const next = idx + 1 < tops.length ? tops[idx + 1] : docH;
        p = (idx + 1 + clamp((y - tops[idx]) / Math.max(1, next - tops[idx]))) / (tops.length);
      }
      p = clamp(p);
      routeFill.style.transform = `scaleY(${p})`;
      routeCar.style.top = `${p * 100}%`;
      stops.forEach((s, i) => s.classList.toggle('is-passed', i <= idx));
      const label = idx < 0 ? '00 // START' : `${String(idx + 1).padStart(2, '0')} // ${NAMES[sections[idx].id] || ''}`;
      if (label !== lastLabel) { routeLabel.textContent = label; lastLabel = label; }
      routePct.textContent = `${Math.round((docH > 0 ? y / docH : 0) * 100)}%`;
      route.classList.toggle('is-on', y > vh * 0.5);
    }
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  measure();
  frame();

  // ---------------------------------------------------------------- pointer: spotlight, tilt, magnetic buttons
  if (finePointer) {
    $$('.project, .principle, .case, .profile, .mailer').forEach(card => {
      const tilt = card.matches('.project, .principle');
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, yy = e.clientY - r.top;
        card.style.setProperty('--mx', `${x}px`); card.style.setProperty('--my', `${yy}px`);
        if (tilt) {
          const rx = (yy / r.height - 0.5) * -6, ry = (x / r.width - 0.5) * 6;
          card.style.transition = 'transform .12s ease-out, border-color .25s';
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        }
      });
      card.addEventListener('pointerleave', () => {
        if (!tilt) return;
        card.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1), border-color .25s';
        card.style.transform = '';
      });
    });

    $$('.btn').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.18, dy = (e.clientY - r.top - r.height / 2) * 0.28;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }
})();
