// Panel choreography. Every motion has a purpose, entrances ease out in 400–700ms, travel ≤ 30px,
// stagger ≤ 6 items, reveal once, and reduced-motion users get the final state immediately.
// Districts that aren't on screen are display:none, so IntersectionObserver fires as the car arrives
// and again as you scroll a panel.
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

  // ---------------------------------------------------------------- git log: the branch grows as you scroll its panel
  const gitlog = $('.gitlog'), commits = $$('.commit');
  if (gitlog) {
    const fill = document.createElement('span');
    fill.className = 'gitlog-fill';
    gitlog.prepend(fill);
    const scroller = gitlog.closest('.stage-scroll');
    let queued = false;
    const grow = () => {
      queued = false;
      const r = gitlog.getBoundingClientRect();
      if (!r.height) return;
      const box = scroller ? scroller.getBoundingClientRect() : { top: 0, height: innerHeight };
      const reach = box.top + box.height * 0.7 - r.top;
      fill.style.transform = `scaleY(${clamp(reach / r.height)})`;
      commits.forEach(cm => cm.classList.toggle('is-lit', cm.offsetTop + 10 < reach));
    };
    const request = () => { if (!queued) { queued = true; requestAnimationFrame(grow); } };
    (scroller || window).addEventListener('scroll', request, { passive: true });
    document.addEventListener('stage:enter', e => { if (e.detail.el.contains(gitlog)) setTimeout(request, 80); });
    addEventListener('resize', request);
    request();
  }

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
