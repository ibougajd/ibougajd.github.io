// The whole site is one night drive. Every section is a district on a zigzag highway: even levels
// run right, odd levels run left. Moving on, the car runs to the end of its level, U-turns down a
// ramp to the next level and the camera follows it while the new district fades in. The window never
// scrolls — only the world moves. Hold SPACE / → (or the BOOST button) to floor it.
(() => {
  'use strict';

  const cv = document.getElementById('scene');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const C = {
    main: '#aacfd1', bright: '#e6fbfc', dim: '#5f8588', line: '#2f4a4d',
    red: '#ff4d6d', pink: '#ff2a6d', magenta: '#d300c5', cyan: '#05d9e8'
  };
  const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', Menlo, monospace";
  const TAU = Math.PI * 2;
  const frac = x => x - Math.floor(x);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // one district per stop: 0 start · 1 whoami · 2 projects · 3 stack · 4 git log · 5 shell · 6 contact
  const THEMES = [
    { ui: '#05d9e8', sky: ['#03070a', '#071419', '#16101f'], sun: ['#ffd36e', '#ff2a6d', '#5b10b8'], glow: '#ff2a6d',
      far: ['#08121a', 'rgba(170,207,209,0.25)'], near: ['#050b0f', 'rgba(5,217,232,0.5)'],
      win: '170,207,209', hot: '255,42,109', hotFar: 0.05, hotNear: 0.12, accent: '5,217,232', floor: '211,0,197',
      signA: C.pink, signB: C.cyan, hFar: [0.12, 0.32], hNear: [0.16, 0.44],
      signs: ['KUBECTL APPLY', '1337', 'GITOPS', 'DEVOPS', '99.98%', 'NO DOWNTIME', 'DEPLOY', 'K8S', 'TERRAFORM', 'GRAFANA'] },
    { ui: '#d300c5', sky: ['#05030a', '#140821', '#2b0f2e'], sun: ['#ffc2e0', '#d300c5', '#3a0a6b'], glow: '#d300c5',
      far: ['#120a1d', 'rgba(211,0,197,0.25)'], near: ['#0a0612', 'rgba(255,42,109,0.45)'],
      win: '227,200,143', hot: '211,0,197', hotFar: 0.06, hotNear: 0.14, accent: '211,0,197', floor: '211,0,197',
      signA: C.magenta, signB: C.pink, hFar: [0.1, 0.26], hNear: [0.12, 0.34],
      signs: ['WHOAMI', '1337', 'UM6P', 'MARRAKESH', 'HELLO WORLD', '42 NETWORK', 'C → K8S', 'DEVOPS'] },
    { ui: '#05d9e8', sky: ['#010608', '#04141b', '#0b1e26'], sun: ['#e6fbfc', '#05d9e8', '#0b4a6e'], glow: '#05d9e8',
      far: ['#071620', 'rgba(5,217,232,0.3)'], near: ['#03090d', 'rgba(5,217,232,0.6)'],
      win: '170,207,209', hot: '5,217,232', hotFar: 0.08, hotNear: 0.16, accent: '5,217,232', floor: '5,217,232',
      signA: C.cyan, signB: C.bright, hFar: [0.16, 0.38], hNear: [0.2, 0.52],
      signs: ['FT_TRANSCENDENCE', 'ARGOCD', 'HELM', 'GHCR', 'TRAEFIK', 'INCEPTION', 'FT_IRC', 'MINISHELL', 'CUB3D', 'SO_LONG'] },
    { ui: '#8fe3a8', sky: ['#010503', '#03120a', '#0a1c12'], sun: ['#e0ffe9', '#8fe3a8', '#0e5a3c'], glow: '#8fe3a8',
      far: ['#06130c', 'rgba(143,227,168,0.25)'], near: ['#020905', 'rgba(143,227,168,0.5)'],
      win: '143,227,168', hot: '5,217,232', hotFar: 0.1, hotNear: 0.18, accent: '143,227,168', floor: '143,227,168',
      signA: '#8fe3a8', signB: C.cyan, hFar: [0.14, 0.3], hNear: [0.18, 0.4], led: true,
      signs: ['KUBERNETES', 'TERRAFORM', 'PROMETHEUS', 'GRAFANA', 'DOCKER', 'NGINX', 'HELM', 'POSTGRES', 'LINUX'] },
    { ui: '#e3c88f', sky: ['#060402', '#170f05', '#2a160a'], sun: ['#fff1c4', '#e3c88f', '#a2441b'], glow: '#e3a35f',
      far: ['#150f08', 'rgba(227,200,143,0.25)'], near: ['#0a0704', 'rgba(227,200,143,0.5)'],
      win: '227,200,143', hot: '255,77,109', hotFar: 0.05, hotNear: 0.1, accent: '227,200,143', floor: '227,160,95',
      signA: '#e3c88f', signB: C.red, hFar: [0.1, 0.28], hNear: [0.14, 0.38],
      signs: ['GIT LOG', 'HEAD → MAIN', 'V0.0.1', 'COMMON CORE', '2023', '2024', '2026', 'INIT', 'MERGE'] },
    { ui: '#2bd96a', sky: ['#000000', '#010603', '#020c05'], sun: ['#c8ffd8', '#2bd96a', '#06391a'], glow: '#2bd96a',
      far: ['#03100a', 'rgba(43,217,106,0.25)'], near: ['#010503', 'rgba(43,217,106,0.55)'],
      win: '43,217,106', hot: '230,251,252', hotFar: 0.04, hotNear: 0.08, accent: '43,217,106', floor: '43,217,106',
      signA: '#2bd96a', signB: '#8fe3a8', hFar: [0.12, 0.3], hNear: [0.16, 0.42], led: true,
      signs: ['$ SSH', 'ZSH', 'SUDO HIRE-ME', 'LS -LA', 'NEOFETCH', 'EXIT 0', '~/', 'KUBECTL'] },
    { ui: '#ffb36e', sky: ['#0b0a1f', '#35173f', '#b03a52'], sun: ['#fff6d5', '#ffb36e', '#ff2a6d'], glow: '#ffb36e',
      far: ['#1d1024', 'rgba(255,179,110,0.3)'], near: ['#0e0812', 'rgba(255,42,109,0.5)'],
      win: '255,211,110', hot: '255,42,109', hotFar: 0.08, hotNear: 0.14, accent: '255,179,110', floor: '255,107,107',
      signA: '#ffb36e', signB: C.pink, hFar: [0.1, 0.28], hNear: [0.14, 0.38],
      signs: ['SAY HI', 'HIRE ME', 'OPEN TO WORK', 'INBOX OPEN', 'LINKEDIN', 'GITHUB', '@1337', 'CV.PDF'] }
  ];
  const facingOf = i => (i % 2 ? -1 : 1);

  let W = 0, H = 0, s = 1, DPR = 1;
  const G = {};
  let stars = null;
  const cache = new Map();              // district index → its pre-rendered layers

  // motion state
  let t = 0, dist = 0, spin = 0, oncoming = 0;
  let speed = 1, boostHeld = false, pulse = 0;
  let mouse = 0, mouseTarget = 0;
  let running = false, rafId = 0, lastTs = 0;
  let stop = 0, trans = null;

  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
  }
  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const g = c.getContext('2d'); g.scale(DPR, DPR);
    return [c, g];
  }
  const idle = window.requestIdleCallback ? fn => requestIdleCallback(fn, { timeout: 1200 }) : fn => setTimeout(fn, 200);

  // ------------------------------------------------------------ layout
  function layout() {
    const wide = W > 900;
    G.horizon = H * 0.74;
    G.roadFar = H * 0.745;
    G.roadNear = H * 0.825;
    G.lane = H * 0.81;
    G.farLane = H * 0.768;
    G.deck = G.roadNear + 20 * s;
    G.sunX = wide ? W * 0.7 : W * 0.5;
    G.sunY = H * 0.47;
    G.sunR = Math.min(H * 0.19, W * 0.3);
    G.carX = wide ? W * 0.7 : W * 0.5;

    // tell the page where the panels may go: beside the car on wide screens, above it otherwise
    const k = 1.18 * s;
    const gutter = clamp(W * 0.04, 16, 40);
    const rail = W > 1240 ? 104 : gutter;   // room for the minimap
    const rear = G.carX - 215 * k;
    const side = W > 900 && rear - gutter - 24 >= 600;
    let clear = side ? H - (G.roadFar - 16 * s) + 14 : H - (G.lane - 130 * k) + 10;
    if (H < 520) clear = 60;
    root.dataset.layout = side ? 'side' : 'stack';
    root.style.setProperty('--road-clear', `${Math.round(clear)}px`);
    root.style.setProperty('--panel-r', `${Math.round(rail)}px`);
    root.style.setProperty('--panel-w', `${Math.round(side ? Math.min(960, rear - gutter - 24) : W - gutter - rail)}px`);
    root.style.setProperty('--panel-w-r', `${Math.round(side ? Math.min(960, rear - rail - 24) : W - gutter - rail)}px`);
  }

  function buildStars() {
    const [c, g] = offscreen(W, G.horizon);
    g.strokeStyle = 'rgba(47,74,77,0.16)'; g.lineWidth = 1;
    const step = 44 * Math.max(s, 0.6);
    for (let x = 0; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, G.horizon); g.stroke(); }
    for (let y = 0; y < G.horizon; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const r = rng(7);
    for (let i = 0; i < 220 * W / 1920 + 40; i++) {
      g.fillStyle = `rgba(230,251,252,${0.12 + r() * 0.45})`;
      const sz = r() < 0.1 ? 2 : 1;
      g.fillRect(r() * W, r() * G.horizon * 0.8, sz, sz);
    }
    return c;
  }

  function buildSun(th) {
    const R = G.sunR, pad = R * 0.6;
    const [c, g] = offscreen(2 * (R + pad), 2 * (R + pad));
    const x = R + pad, y = R + pad;
    const sg = g.createLinearGradient(0, y - R, 0, y + R);
    sg.addColorStop(0, th.sun[0]); sg.addColorStop(0.45, th.sun[1]); sg.addColorStop(1, th.sun[2]);
    g.shadowColor = th.glow; g.shadowBlur = R * 0.35;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = sg; g.fill();
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) g.fillRect(x - R, y + R * (0.05 + i * 0.11), 2 * R, (1 + i * 0.012 * R / 6) * Math.max(1, R / 120));
    g.globalCompositeOperation = 'source-over';
    return { canvas: c, size: 2 * (R + pad) };
  }

  // a tile of skyline, cropped to the strip the buildings actually occupy
  function buildCity(th, far, seed) {
    const k = Math.max(s, 0.55);
    const [minH, maxH] = far ? th.hFar : th.hNear;
    const base = far ? G.horizon : G.horizon + 4 * s;
    const tileW = Math.round((far ? 1600 : 1300) * Math.max(s, 0.5));
    const top = Math.max(0, Math.floor(base - H * maxH - 40 * k));
    const [c, g] = offscreen(tileW, base - top + 2);
    g.translate(0, -top);
    const r = rng(seed);
    const [col, edge] = far ? th.far : th.near;
    const winA = far ? 0.35 : 0.7, hotChance = far ? th.hotFar : th.hotNear;
    const signs = [];
    let x = 0;
    while (x < tileW) {
      const w = Math.min(Math.round((50 + r() * 110) * k), tileW - x);
      const bh = Math.round(H * (minH + r() * (maxH - minH)));
      const bt = base - bh;
      g.fillStyle = col; g.fillRect(x, bt, w, bh);
      g.fillStyle = edge; g.fillRect(x, bt, w, 1);
      if (r() < 0.35) {
        g.fillStyle = col; g.fillRect(x + w * 0.25, bt - 18 * k, w * 0.5, 18 * k);
        g.fillStyle = edge; g.fillRect(x + w * 0.25, bt - 18 * k, w * 0.5, 1);
      }
      const [ww, wh, gx, gy, fill] = th.led ? [2 * k, 2 * k, 6 * k, 7 * k, 0.5] : [3 * k, 5 * k, 9 * k, 11 * k, 0.42];
      for (let wy = bt + 10 * k; wy < base - 8 * k; wy += gy) {
        for (let wx = x + 6 * k; wx < x + w - 6 * k; wx += gx) {
          const v = r();
          if (v < fill) {
            g.fillStyle = v < hotChance ? `rgba(${th.hot},${winA})` : `rgba(${th.win},${winA * (0.4 + r() * 0.6)})`;
            g.fillRect(wx, wy, ww, wh);
          }
        }
      }
      if (r() < 0.55) signs.push({ x: x + w / 2, y: bt, h: bh, antenna: r() < 0.5, k: Math.floor(r() * 1000) });
      x += w + Math.round(r() * 14 * k);
    }
    return { canvas: c, signs, w: tileW, top, h: base - top + 2 };
  }

  function buildFloor(th) {
    const h = H - G.deck;
    const [c, g] = offscreen(W, h);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b0716'); grd.addColorStop(1, '#05090b');
    g.fillStyle = grd; g.fillRect(0, 0, W, h);
    g.strokeStyle = `rgba(${th.floor},0.32)`; g.lineWidth = 1;
    const vx = W / 2;
    for (let i = -40; i <= 40; i++) {
      g.beginPath(); g.moveTo(vx + i * 10 * s, 0); g.lineTo(vx + i * 150 * s, h); g.stroke();
    }
    return c;
  }

  function layersFor(i) {
    let L = cache.get(i);
    if (!L) {
      const th = THEMES[i];
      L = { sun: buildSun(th), far: buildCity(th, true, 11 + i * 101), near: buildCity(th, false, 29 + i * 101), floor: buildFloor(th) };
      cache.set(i, L);
    }
    return L;
  }
  function prune() {
    for (const i of cache.keys()) if (Math.abs(i - stop) > 1) cache.delete(i);
  }
  function prefetch() {
    idle(() => { for (const i of [stop + 1, stop - 1]) if (THEMES[i] && W) layersFor(i); });
  }

  function resize() {
    const rect = cv.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(320, Math.round(rect.height));
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    s = Math.min(H / 1080, W / 1100) * 1.05;
    layout();
    cache.clear();
    stars = buildStars();
    if (trans) trans.R = rampGeometry();
    if (!running) draw();
    prefetch();
  }

  // ------------------------------------------------------------ the zigzag
  // Geometry of the ramp from level `lo` down to `lo + 1`, in lo's frame as if it drove right
  // (mirrored at draw time when it drives left). P0 car → P1 ramp top → P2 ramp foot → P3 car.
  function rampGeometry() {
    const wide = W > 900;
    const x0 = G.carX, x3 = W - G.carX;
    const xA = wide ? x0 + W * 0.14 : W * 0.82;
    const xB = wide ? W * 0.5 : W * 0.56;
    const L = clamp((xA - xB) * 1.2, H * 0.2, H * 0.42);
    const l1 = xA - x0, l2 = Math.hypot(xA - xB, L), l3 = xB - x3;
    return { x0, xA, xB, x3, L, l1, l2, l3, T: l1 + l2 + l3, ang: Math.atan2(L, xA - xB) };
  }

  function pathAt(R, q) {
    const d = q * R.T, w = 0.07 * R.T, c1 = R.l1, c2 = R.l1 + R.l2;
    let x, y;
    if (d <= c1) { x = R.x0 + d; y = G.lane; }
    else if (d <= c2) { const u = (d - c1) / R.l2; x = lerp(R.xA, R.xB, u); y = G.lane + R.L * u; }
    else { x = R.xB - (d - c2); y = G.lane + R.L; }
    const flip = d < c1 - w ? 1 : d > c1 + w ? -1 : Math.cos(Math.PI * (d - (c1 - w)) / (2 * w));
    const tilt = -R.ang * smooth(c1 - w, c1 + w, d) * (1 - smooth(c2 - w, c2 + w, d));
    return { x, y, flip, tilt };
  }

  const sunXFor = f => (f > 0 ? G.sunX : W - G.sunX);

  // everything the frame needs, at rest or mid-ramp
  function view() {
    if (!trans) {
      const f = facingOf(stop);
      return {
        a: stop, b: stop, mix: 0, sunX: sunXFor(f), ramp: null,
        levels: [{ i: stop, y: 0, city: 1, road: 1 }],
        car: { x: f > 0 ? G.carX : W - G.carX, flip: f, tilt: 0 }
      };
    }
    const { lo, R } = trans;
    const q = trans.down ? easeInOut(trans.p) : 1 - easeInOut(trans.p);
    const fl = facingOf(lo);
    const P = pathAt(R, q);
    const shift = G.lane - P.y;
    return {
      a: lo, b: lo + 1, mix: smooth(0.2, 0.8, q),
      sunX: lerp(sunXFor(fl), sunXFor(-fl), smooth(0.1, 0.9, q)),
      levels: [
        { i: lo, y: shift, city: 1 - smooth(0.3, 0.7, q), road: 1 - smooth(0.8, 1, q) },
        { i: lo + 1, y: shift + R.L, city: smooth(0.3, 0.7, q), road: smooth(0, 0.15, q) }
      ],
      ramp: { y: shift, f: fl, a: smooth(0, 0.12, q) * (1 - smooth(0.88, 1, q)) },
      car: { x: fl > 0 ? P.x : W - P.x, flip: P.flip * fl, tilt: P.tilt * fl }
    };
  }

  // ------------------------------------------------------------ drawing
  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; }

  function paintSky(cols, a) {
    const g = ctx.createLinearGradient(0, 0, 0, G.horizon);
    g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]);
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }

  function drawSky(v) {
    paintSky(THEMES[v.a].sky, 1);
    if (v.mix > 0.002) paintSky(THEMES[v.b].sky, v.mix);
    ctx.drawImage(stars, 0, 0, W, G.horizon);
    const R = G.sunR, px = v.sunX - mouse * 10, sy = G.sunY;
    for (const [i, a] of [[v.a, 1 - v.mix], [v.b, v.mix]]) {
      if (a < 0.01) continue;
      const sun = layersFor(i).sun;
      ctx.globalAlpha = a;
      ctx.drawImage(sun.canvas, px - sun.size / 2, sy - sun.size / 2, sun.size, sun.size);
    }
    ctx.globalAlpha = 1;
    // HUD rings
    ctx.save(); ctx.translate(px, sy);
    ctx.lineWidth = Math.max(1.5, 3 * s); ctx.strokeStyle = 'rgba(170,207,209,0.5)';
    ctx.rotate(t * 0.25);
    for (const [a0, a1] of [[0, 0.9], [1.3, 2.2], [2.8, 3.5], [4.1, 5.6]]) { ctx.beginPath(); ctx.arc(0, 0, R * 1.32, a0, a1); ctx.stroke(); }
    ctx.rotate(-t * 0.5);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(170,207,209,0.32)';
    for (const [a0, a1] of [[0.4, 1.9], [2.4, 3.0], [3.6, 5.9]]) { ctx.beginPath(); ctx.arc(0, 0, R * 1.2, a0, a1); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(px, sy);
    for (let a = 0; a < 120; a += 1) {
      const ang = a / 120 * TAU, long = a % 10 === 0;
      const r0 = R * (long ? 1.42 : 1.45), r1 = R * 1.5;
      ctx.strokeStyle = long ? 'rgba(170,207,209,0.55)' : 'rgba(95,133,136,0.3)';
      ctx.lineWidth = long ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloor(v) {
    for (const [i, a] of [[v.a, 1], [v.b, v.mix]]) {
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(layersFor(i).floor, 0, G.deck, W, H - G.deck);
      ctx.strokeStyle = `rgba(${THEMES[i].floor},0.32)`; ctx.lineWidth = 1;
      for (let n = 0; n < 10; n++) {
        const p = frac(n / 10 + dist / (600 * s * 3));
        const y = G.deck + (H - G.deck) * p * p;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // run fn inside a level's frame: shifted by the camera, mirrored when that level drives left
  function inLevel(lv, alpha, fn) {
    const f = facingOf(lv.i);
    ctx.save();
    ctx.translate(0, lv.y);
    if (f < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = alpha;
    fn(THEMES[lv.i], layersFor(lv.i), f);
    ctx.restore();
  }

  function drawCity(layer, th, parallax, mouseShift, withSigns, f) {
    const off = frac((dist * parallax) / layer.w) * layer.w + mouse * mouseShift * f;
    for (let x = -off - layer.w; x < W; x += layer.w) ctx.drawImage(layer.canvas, Math.round(x), layer.top, layer.w, layer.h);
    if (!withSigns) return;
    const k = Math.max(s, 0.55);
    for (let x0 = -off - layer.w; x0 < W; x0 += layer.w) {
      for (const sg of layer.signs) {
        const sx = x0 + sg.x;
        if (sx < -150 || sx > W + 150) continue;
        if (sg.antenna) {
          ctx.fillStyle = C.dim; ctx.fillRect(sx - 1, sg.y - 34 * k, 2, 34 * k);
          if (frac(t * 0.5 + sg.k / 1000) < 0.5) {
            glow(C.red, 10); ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.arc(sx, sg.y - 36 * k, 2.5 * k, 0, TAU); ctx.fill(); noGlow();
          }
        }
        if (sg.k % 2 === 0 && sg.h > 110 * k) {
          const label = th.signs[sg.k % th.signs.length];
          const on = hash(Math.floor(t * 12) + sg.k) > 0.05;
          const col = (sg.k >> 1) % 2 ? th.signA : th.signB;
          const fs = Math.round(13 * k);
          ctx.font = `700 ${fs}px ${MONO}`;
          const tw = ctx.measureText(label).width + 16 * k, bh = 24 * k;
          const by = sg.y + 30 * k;
          ctx.fillStyle = 'rgba(5,9,11,0.85)'; ctx.fillRect(sx - tw / 2, by, tw, bh);
          if (on) {
            glow(col, 14);
            ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(sx - tw / 2, by, tw, bh);
            // signs stay readable on levels that are drawn mirrored
            ctx.save(); ctx.translate(sx, by + bh * 0.7); ctx.scale(f, 1);
            ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, 0, 0);
            ctx.restore();
            noGlow();
          }
        }
      }
    }
  }

  function drawRoad(th) {
    const sp = 600 * s, acc = th.accent;
    // streetlights
    for (let x = -frac(dist / sp) * sp; x < W + sp; x += sp) {
      const top = G.roadFar - 190 * s;
      ctx.fillStyle = '#0d1a1f'; ctx.fillRect(x, top, 4 * s, G.roadFar - top); ctx.fillRect(x, top, 46 * s, 4 * s);
      const lg = ctx.createLinearGradient(0, top, 0, G.roadNear);
      lg.addColorStop(0, `rgba(${acc},0.26)`); lg.addColorStop(1, `rgba(${acc},0)`);
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(x + 36 * s, top + 4 * s); ctx.lineTo(x + 56 * s, top + 4 * s);
      ctx.lineTo(x + 130 * s, G.roadNear); ctx.lineTo(x - 30 * s, G.roadNear); ctx.closePath(); ctx.fill();
      glow(`rgb(${acc})`, 16); ctx.fillStyle = C.bright; ctx.fillRect(x + 34 * s, top + 3 * s, 22 * s, 4 * s); noGlow();
    }
    ctx.fillStyle = '#081217'; ctx.fillRect(0, G.roadFar - 16 * s, W, 16 * s);
    ctx.fillStyle = 'rgba(170,207,209,0.5)'; ctx.fillRect(0, G.roadFar - 16 * s, W, 1);
    const rg = ctx.createLinearGradient(0, G.roadFar, 0, G.roadNear);
    rg.addColorStop(0, '#0a1115'); rg.addColorStop(1, '#05080a');
    ctx.fillStyle = rg; ctx.fillRect(0, G.roadFar, W, G.roadNear - G.roadFar);
    const ds = 120 * s, mid = (G.roadFar + G.roadNear) / 2 - 6 * s;
    ctx.fillStyle = 'rgba(170,207,209,0.55)';
    for (let x = -frac(dist / ds) * ds; x < W; x += ds) ctx.fillRect(x, mid, 56 * s, Math.max(1.5, 2.5 * s));
    glow(`rgb(${acc})`, 8); ctx.fillStyle = `rgb(${acc})`; ctx.fillRect(0, G.roadNear, W, Math.max(1.5, 2 * s)); noGlow();
    ctx.fillStyle = '#071014'; ctx.fillRect(0, G.roadNear + 2 * s, W, G.deck - G.roadNear - 2 * s);
    ctx.fillStyle = `rgba(${th.hot},0.8)`;
    const rs = 40 * s;
    for (let x = -frac(dist / rs) * rs; x < W; x += rs) ctx.fillRect(x, G.roadNear + 9 * s, 10 * s, 3 * s);
    // the deck stands on pillars, so a level can float above the one below it
    for (let x = -frac(dist / sp) * sp + 200 * s; x < W + sp; x += sp) {
      ctx.fillStyle = '#060c10'; ctx.fillRect(x, G.deck, 30 * s, H);
      ctx.fillStyle = `rgba(${acc},0.22)`; ctx.fillRect(x, G.deck, 2, H);
    }
  }

  function drawTraffic() {
    for (let i = 0; i < 4; i++) {
      const p = frac(oncoming + i / 4 + 0.13 * i);
      const x = W + 300 * s - p * (W + 900 * s);
      const y = G.farLane;
      const lg = ctx.createLinearGradient(x, 0, x + 260 * s, 0);
      lg.addColorStop(0, 'rgba(230,251,252,0.9)'); lg.addColorStop(1, 'rgba(230,251,252,0)');
      ctx.fillStyle = lg; ctx.fillRect(x, y - 2 * s, 260 * s, 3 * s);
      ctx.fillStyle = '#0a1418'; ctx.fillRect(x + 6 * s, y - 16 * s, 70 * s, 14 * s);
      glow(C.bright, 10); ctx.fillStyle = C.bright; ctx.fillRect(x, y - 8 * s, 6 * s, 3 * s); noGlow();
    }
  }

  // the hairpin ramp down to the next level, drawn in the upper level's frame
  function drawRamp(th, R) {
    const yA = G.lane, yB = G.lane + R.L;
    const top = G.roadFar - 16 * s - G.lane, bot = G.deck - G.lane;
    ctx.fillStyle = '#060c10';
    for (let i = 1; i < 4; i++) {
      const u = i / 4;
      ctx.fillRect(lerp(R.xA, R.xB, u) - 12 * s, lerp(yA, yB, u) + bot, 24 * s, H);
    }
    const slab = ctx.createLinearGradient(0, yA + top, 0, yB + bot);
    slab.addColorStop(0, '#0a1115'); slab.addColorStop(1, '#05080a');
    ctx.fillStyle = slab;
    ctx.beginPath();
    ctx.moveTo(R.xA, yA + top); ctx.lineTo(R.xB, yB + top); ctx.lineTo(R.xB, yB + bot); ctx.lineTo(R.xA, yA + bot);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.strokeStyle = 'rgba(170,207,209,0.5)';
    ctx.beginPath(); ctx.moveTo(R.xA, yA + top); ctx.lineTo(R.xB, yB + top); ctx.stroke();
    glow(`rgb(${th.accent})`, 10); ctx.strokeStyle = `rgb(${th.accent})`;
    ctx.beginPath(); ctx.moveTo(R.xA, yA + bot - 18 * s); ctx.lineTo(R.xB, yB + bot - 18 * s); ctx.stroke(); noGlow();
    ctx.strokeStyle = 'rgba(170,207,209,0.55)'; ctx.setLineDash([40 * s, 50 * s]);
    ctx.beginPath(); ctx.moveTo(R.xA, yA - 6 * s); ctx.lineTo(R.xB, yB - 6 * s); ctx.stroke();
    ctx.setLineDash([]);
  }

  const BODY = new Path2D('M10,-38 L2,-58 L4,-78 L62,-84 Q102,-88 130,-110 L196,-116 Q236,-113 288,-84 L400,-72 Q426,-68 434,-54 L430,-42 L418,-36 Z');
  const WIN = new Path2D('M136,-106 L194,-112 Q228,-110 276,-86 L120,-86 Q126,-98 136,-106 Z');

  function drawCar(car, accel, v) {
    const k = 1.18 * s;
    const dir = car.flip < 0 ? -1 : 1;
    const bob = Math.sin(t * 13) * 0.8 * s * (0.6 + speed * 0.3);
    const boostAmt = Math.max(0, Math.min(1, (speed - 1.2) / 2));
    const tilt = car.tilt + clamp(-accel * 0.012, -0.03, 0.03) * dir;
    ctx.save();
    ctx.translate(car.x, G.lane + bob);
    ctx.rotate(tilt);
    ctx.scale(car.flip * k, k);
    ctx.translate(-215, 0);
    // light trails
    const trail = 420 + boostAmt * 380;
    for (const [yy, col] of [[-68, '255,77,109'], [-58, '255,42,109']]) {
      const lg = ctx.createLinearGradient(-trail, 0, 0, 0);
      lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(1, `rgba(${col},0.85)`);
      ctx.fillStyle = lg; ctx.fillRect(-trail, yy, trail + 2 / k, 3);
    }
    // speed lines
    ctx.strokeStyle = `rgba(170,207,209,${0.15 + boostAmt * 0.35})`; ctx.lineWidth = 1 / k;
    const nLines = 6 + Math.round(boostAmt * 8);
    for (let i = 0; i < nLines; i++) {
      const p = frac(spin / (900 * k) + i / nLines);
      const lx = 380 - p * 900, ly = -(14 + (i * 37 % 100));
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - (120 + boostAmt * 160), ly); ctx.stroke();
    }
    // headlight beam
    const bg = ctx.createLinearGradient(430, 0, 900, 0);
    bg.addColorStop(0, 'rgba(5,217,232,0.35)'); bg.addColorStop(1, 'rgba(5,217,232,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(430, -66); ctx.lineTo(900, -128); ctx.lineTo(900, 10); ctx.lineTo(430, -58); ctx.closePath(); ctx.fill();
    // underglow
    glow(C.magenta, 30); ctx.fillStyle = `rgba(211,0,197,${0.55 + 0.25 * Math.sin(t * 3) + boostAmt * 0.2})`;
    ctx.beginPath(); ctx.ellipse(215, 2, 200, 6, 0, 0, TAU); ctx.fill(); noGlow();
    // nitro flame
    if (boostAmt > 0.02) {
      const fl = (40 + 50 * boostAmt) * (0.75 + 0.25 * hash(Math.floor(t * 30)));
      const fg = ctx.createLinearGradient(4 - fl, 0, 4, 0);
      fg.addColorStop(0, 'rgba(5,217,232,0)'); fg.addColorStop(0.5, 'rgba(255,42,109,0.8)'); fg.addColorStop(1, 'rgba(230,251,252,0.95)');
      glow(C.pink, 20); ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(6, -50); ctx.lineTo(4 - fl, -46); ctx.lineTo(6, -42); ctx.closePath(); ctx.fill(); noGlow();
    }
    // the 3D model (car3d.js) draws the body when it's loaded; trails, beam and underglow stay here
    if (window.car3d?.frame({ x: car.x, y: G.lane + bob, flip: car.flip, tilt, k, spin, a: v.a, b: v.b, mix: v.mix, sunX: v.sunX })) { ctx.restore(); return; }
    // body
    const bgd = ctx.createLinearGradient(0, -116, 0, -38);
    bgd.addColorStop(0, '#173038'); bgd.addColorStop(1, '#05090b');
    ctx.fillStyle = bgd; ctx.fill(BODY);
    glow(C.cyan, 10); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6; ctx.stroke(BODY); noGlow();
    // spoiler
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(22, -76); ctx.lineTo(18, -92); ctx.moveTo(46, -78); ctx.lineTo(44, -93); ctx.stroke();
    ctx.fillStyle = '#0b161b'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, -91); ctx.lineTo(62, -95); ctx.lineTo(60, -99); ctx.lineTo(-2, -97); ctx.closePath(); ctx.fill();
    glow(C.cyan, 8); ctx.stroke(); noGlow();
    // window + details
    const wg = ctx.createLinearGradient(120, -110, 280, -86);
    wg.addColorStop(0, 'rgba(5,217,232,0.15)'); wg.addColorStop(1, 'rgba(5,217,232,0.45)');
    ctx.fillStyle = wg; ctx.fill(WIN); ctx.strokeStyle = C.main; ctx.lineWidth = 1; ctx.stroke(WIN);
    ctx.beginPath(); ctx.moveTo(198, -111); ctx.lineTo(194, -86); ctx.stroke();
    ctx.strokeStyle = 'rgba(170,207,209,0.5)';
    ctx.beginPath(); ctx.moveTo(204, -84); ctx.lineTo(212, -44); ctx.stroke();
    glow(C.pink, 12); ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, -60); ctx.lineTo(420, -56); ctx.stroke(); noGlow();
    ctx.save(); ctx.translate(160, -66); ctx.scale(dir, 1);
    ctx.font = `700 11px ${MONO}`; ctx.fillStyle = C.bright; ctx.textAlign = 'center'; ctx.fillText('1337', 0, 0);
    ctx.restore();
    glow(C.cyan, 18); ctx.fillStyle = C.bright; ctx.fillRect(416, -67, 16, 5); noGlow();
    glow(C.red, 18); ctx.fillStyle = C.red; ctx.fillRect(2, -72, 12, 7); noGlow();
    // wheels
    const a0 = spin / (33 * k);
    for (const wx of [96, 338]) {
      ctx.fillStyle = '#020405';
      ctx.beginPath(); ctx.arc(wx, -34, 40, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(wx, -34, 33, 0, TAU); ctx.fillStyle = '#0a0f12'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#1b2f33'; ctx.stroke();
      ctx.beginPath(); ctx.arc(wx, -34, 22, 0, TAU); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = C.main; ctx.lineWidth = 2.2;
      for (let i = 0; i < 5; i++) {
        const a = a0 + i * TAU / 5;
        ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 5, -34 + Math.sin(a) * 5); ctx.lineTo(wx + Math.cos(a) * 21, -34 + Math.sin(a) * 21); ctx.stroke();
      }
      ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(wx, -34, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawRain() {
    const n = Math.round(150 * W / 1920 + 30);
    const r = rng(99);
    ctx.strokeStyle = 'rgba(170,207,209,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const slant = 0.18 + (speed - 1) * 0.08;
    for (let i = 0; i < n; i++) {
      const x0 = r() * W * 1.3, ph = r(), v = 0.55 + r() * 0.35, len = (14 + r() * 18) * Math.max(s, 0.6);
      const p = frac(ph + t * v);
      const y = -40 + p * (H + 80), x = x0 - p * H * slant;
      ctx.moveTo(x, y); ctx.lineTo(x - len * slant, y + len);
    }
    ctx.stroke();
  }

  let lastSpeed = 1;
  function draw(dt = 0) {
    const accel = dt > 0 ? (speed - lastSpeed) / dt : 0;
    lastSpeed = speed;
    const v = view();
    drawSky(v);
    drawFloor(v);
    for (const lv of v.levels) if (lv.city > 0.01) inLevel(lv, lv.city, (th, L, f) => {
      drawCity(L.far, th, 0.12, 20, false, f);
      drawCity(L.near, th, 0.25, 36, true, f);
    });
    for (const lv of v.levels) if (lv.road > 0.01) inLevel(lv, lv.road, th => { drawRoad(th); drawTraffic(); });
    if (v.ramp && v.ramp.a > 0.01) {
      ctx.save();
      ctx.translate(0, v.ramp.y);
      if (v.ramp.f < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.globalAlpha = v.ramp.a;
      drawRamp(THEMES[v.a], trans.R);
      ctx.restore();
    }
    drawCar(v.car, accel, v);
    drawRain();
  }

  // ------------------------------------------------------------ loop + input
  const speedo = document.getElementById('speedo');
  const speedoBar = document.getElementById('speedo-bar');
  const gear = document.getElementById('gear');
  let speedoTimer = 0;

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;
    if (!dt) return;
    t += dt;
    pulse = Math.max(0, pulse - dt);
    let bump = 0, cruise = 1;
    if (trans) {
      trans.p = Math.min(1, trans.p + dt / trans.dur);
      bump = Math.sin(Math.PI * trans.p);
      // the camera stops panning while the car itself drives through the frame
      cruise = 1 - smooth(0, 0.18, trans.p) * (1 - smooth(0.82, 1, trans.p));
    }
    const target = (boostHeld || pulse > 0 ? 3.2 : 1) + bump * 1.4;
    speed += (target - speed) * Math.min(1, dt * (target > speed ? 2.2 : 1.2));
    dist += 400 * s * speed * dt * cruise;
    spin += 400 * s * speed * dt;
    oncoming += dt * (0.12 + speed * 0.06);
    mouse += (mouseTarget - mouse) * Math.min(1, dt * 3);
    draw(dt);
    if (trans) {
      const tr = trans;
      tr.onProgress?.(tr.p);
      if (tr.p >= 1) { stop = tr.to; trans = null; prune(); prefetch(); tr.resolve(); }
    }
    speedoTimer += dt;
    if (speedo && speedoTimer > 0.08) {
      speedoTimer = 0;
      const kmh = Math.round(speed * 88);
      speedo.textContent = String(kmh).padStart(3, '0');
      if (speedoBar) speedoBar.style.transform = `scaleX(${Math.min(1, kmh / 420)})`;
      if (gear) gear.textContent = trans && !trans.down ? 'R' : 'D';
    }
  }

  function start() {
    if (running || reduceMotion.matches || document.hidden) return;
    running = true; lastTs = 0; rafId = requestAnimationFrame(frame);
  }
  function stopLoop() { running = false; cancelAnimationFrame(rafId); }
  // a ramp in flight can't wait for frames that will never come: land it
  function land() {
    if (!trans) return;
    const tr = trans;
    trans = null; stop = tr.to; prune();
    tr.onProgress?.(1); tr.resolve();
  }

  new ResizeObserver(() => resize()).observe(cv);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopLoop(); land(); } else start();
  });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { stopLoop(); land(); draw(); } else start(); });

  const isControl = e => e.target instanceof Element && e.target.closest('input, textarea, select, button, a, summary, [contenteditable]');
  addEventListener('keydown', e => {
    if (isControl(e)) return;
    if (e.code === 'Space' || e.key === 'ArrowRight') { boostHeld = true; if (e.code === 'Space') e.preventDefault(); }
  });
  addEventListener('keyup', e => { if (e.code === 'Space' || e.key === 'ArrowRight') boostHeld = false; });
  addEventListener('blur', () => { boostHeld = false; });

  const boostBtn = document.getElementById('boost');
  if (boostBtn) {
    const on = e => { e.preventDefault(); boostHeld = true; boostBtn.classList.add('is-on'); };
    const off = () => { boostHeld = false; boostBtn.classList.remove('is-on'); };
    boostBtn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => boostBtn.addEventListener(ev, off));
    boostBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulse = 1.5; } });
  }

  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouseTarget = e.clientX / innerWidth - 0.5; }, { passive: true });

  // driven by drive.js (stage changes) and the terminal's `boost` command
  window.scene = {
    get stop() { return stop; },
    get animated() { return running; },
    accent: i => THEMES[i]?.ui,
    // where a district's sun sits in the viewport (the canvas fills it), and its color as "r g b"
    sunAt(i) {
      const th = THEMES[i];
      if (!th || !W) return null;
      const n = parseInt(th.glow.slice(1), 16);
      return { x: sunXFor(facingOf(i)), y: G.sunY, r: G.sunR, rgb: `${n >> 16} ${(n >> 8) & 255} ${n & 255}` };
    },
    boost(seconds = 2.5) { pulse = seconds; start(); },
    redraw() { if (!running) draw(); },
    set(i) {
      if (!THEMES[i]) return;
      land(); stop = i; prune();
      if (!running) draw();
      prefetch();
    },
    // one level down (i = stop + 1) or back up (i = stop - 1); resolves when the car has landed
    step(i, dur = 1.6, onProgress) {
      if (trans || !THEMES[i] || Math.abs(i - stop) !== 1) return Promise.resolve();
      return new Promise(resolve => {
        if (!running) {
          stop = i; prune(); draw(); prefetch();
          onProgress?.(1); resolve(); return;
        }
        const down = i > stop;
        layersFor(i);
        trans = { lo: down ? stop : i, to: i, down, p: 0, dur, R: rampGeometry(), onProgress, resolve };
      });
    }
  };

  resize();
  start();
})();
