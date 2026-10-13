// Hero scene — the night-city highway from my desktop wallpaper, live in the browser.
// Hold SPACE / → (or the BOOST button) to floor it; scrolling also pushes the speed up.
(() => {
  'use strict';

  const cv = document.getElementById('scene');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const C = {
    main: '#aacfd1', bright: '#e6fbfc', dim: '#5f8588', line: '#2f4a4d',
    red: '#ff4d6d', pink: '#ff2a6d', magenta: '#d300c5', cyan: '#05d9e8'
  };
  const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', Menlo, monospace";
  const TAU = Math.PI * 2;
  const frac = x => x - Math.floor(x);

  let W = 0, H = 0, s = 1, DPR = 1;
  const G = {};
  const layers = {};

  // motion state
  let t = 0, dist = 0, oncoming = 0;
  let speed = 1, boostHeld = false, scrollKick = 0, pulse = 0;
  let mouse = 0, mouseTarget = 0;
  let running = false, onScreen = true, rafId = 0, lastTs = 0;

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
    G.carX = wide ? W * 0.64 : W * 0.5;
  }

  function buildSky() {
    const [c, g] = offscreen(W, H);
    const grd = g.createLinearGradient(0, 0, 0, G.horizon);
    grd.addColorStop(0, '#03070a'); grd.addColorStop(0.55, '#071419'); grd.addColorStop(1, '#16101f');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
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

  function buildSun() {
    const R = G.sunR, pad = R * 0.6;
    const [c, g] = offscreen(2 * (R + pad), 2 * (R + pad));
    const x = R + pad, y = R + pad;
    const sg = g.createLinearGradient(0, y - R, 0, y + R);
    sg.addColorStop(0, '#ffd36e'); sg.addColorStop(0.45, '#ff2a6d'); sg.addColorStop(1, '#5b10b8');
    g.shadowColor = '#ff2a6d'; g.shadowBlur = R * 0.35;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = sg; g.fill();
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) g.fillRect(x - R, y + R * (0.05 + i * 0.11), 2 * R, (1 + i * 0.012 * R / 6) * Math.max(1, R / 120));
    g.globalCompositeOperation = 'source-over';
    return { canvas: c, size: 2 * (R + pad), pad };
  }

  function buildCity(seed, tileW, minH, maxH, base, col, edge, winA, pinkChance) {
    const [c, g] = offscreen(tileW, H);
    const r = rng(seed);
    const signs = [];
    let x = 0;
    const k = Math.max(s, 0.55);
    while (x < tileW) {
      const w = Math.min(Math.round((50 + r() * 110) * k), tileW - x);
      const bh = Math.round(H * (minH + r() * (maxH - minH)));
      const top = base - bh;
      g.fillStyle = col; g.fillRect(x, top, w, bh);
      g.fillStyle = edge; g.fillRect(x, top, w, 1);
      if (r() < 0.35) {
        g.fillStyle = col; g.fillRect(x + w * 0.25, top - 18 * k, w * 0.5, 18 * k);
        g.fillStyle = edge; g.fillRect(x + w * 0.25, top - 18 * k, w * 0.5, 1);
      }
      const ww = 3 * k, wh = 5 * k, gx = 9 * k, gy = 11 * k;
      for (let wy = top + 10 * k; wy < base - 8 * k; wy += gy) {
        for (let wx = x + 6 * k; wx < x + w - 6 * k; wx += gx) {
          const v = r();
          if (v < 0.42) {
            g.fillStyle = v < pinkChance ? `rgba(255,42,109,${winA})` : `rgba(170,207,209,${winA * (0.4 + r() * 0.6)})`;
            g.fillRect(wx, wy, ww, wh);
          }
        }
      }
      if (r() < 0.55) signs.push({ x: x + w / 2, y: top, h: bh, antenna: r() < 0.5, k: Math.floor(r() * 1000) });
      x += w + Math.round(r() * 14 * k);
    }
    return { canvas: c, signs, w: tileW };
  }

  function buildFloor() {
    const [c, g] = offscreen(W, H - G.deck);
    const h = H - G.deck;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b0716'); grd.addColorStop(1, '#05090b');
    g.fillStyle = grd; g.fillRect(0, 0, W, h);
    g.strokeStyle = 'rgba(211,0,197,0.32)'; g.lineWidth = 1;
    const vx = W / 2;
    for (let i = -40; i <= 40; i++) {
      g.beginPath(); g.moveTo(vx + i * 10 * s, 0); g.lineTo(vx + i * 150 * s, h); g.stroke();
    }
    return c;
  }

  function resize() {
    const rect = cv.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(400, Math.round(rect.height));
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    s = Math.min(H / 1080, W / 1100) * 1.05;
    layout();
    layers.sky = buildSky();
    layers.sun = buildSun();
    layers.floor = buildFloor();
    layers.far = buildCity(11, Math.round(1600 * Math.max(s, 0.5)), 0.12, 0.32, G.horizon, '#08121a', 'rgba(170,207,209,0.25)', 0.35, 0.05);
    layers.near = buildCity(29, Math.round(1300 * Math.max(s, 0.5)), 0.16, 0.44, G.horizon + 4 * s, '#050b0f', 'rgba(5,217,232,0.5)', 0.7, 0.12);
    if (!running) draw();
  }

  // ------------------------------------------------------------ drawing
  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; }

  function drawSky() {
    ctx.drawImage(layers.sky, 0, 0, W, H);
    const { sunX, sunY, sunR: R } = G;
    const px = sunX - mouse * 10;
    const sun = layers.sun;
    ctx.drawImage(sun.canvas, px - sun.size / 2, sunY - sun.size / 2, sun.size, sun.size);
    // HUD rings
    ctx.save(); ctx.translate(px, sunY);
    ctx.lineWidth = Math.max(1.5, 3 * s); ctx.strokeStyle = 'rgba(170,207,209,0.5)';
    ctx.rotate(t * 0.25);
    for (const [a0, a1] of [[0, 0.9], [1.3, 2.2], [2.8, 3.5], [4.1, 5.6]]) { ctx.beginPath(); ctx.arc(0, 0, R * 1.32, a0, a1); ctx.stroke(); }
    ctx.rotate(-t * 0.5);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(170,207,209,0.32)';
    for (const [a0, a1] of [[0.4, 1.9], [2.4, 3.0], [3.6, 5.9]]) { ctx.beginPath(); ctx.arc(0, 0, R * 1.2, a0, a1); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(px, sunY);
    for (let a = 0; a < 120; a += 1) {
      const ang = a / 120 * TAU, long = a % 10 === 0;
      const r0 = R * (long ? 1.42 : 1.45), r1 = R * 1.5;
      ctx.strokeStyle = long ? 'rgba(170,207,209,0.55)' : 'rgba(95,133,136,0.3)';
      ctx.lineWidth = long ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  const SIGNS = ['KUBECTL APPLY', '1337', 'GITOPS', 'DEVOPS', '99.98%', 'NO DOWNTIME', 'DEPLOY', 'K8S', 'TERRAFORM', 'GRAFANA'];
  function drawCity(layer, parallax, mouseShift, withSigns) {
    const off = frac((dist * parallax) / layer.w) * layer.w + mouse * mouseShift;
    for (let x = -off - layer.w; x < W; x += layer.w) ctx.drawImage(layer.canvas, Math.round(x), 0, layer.w, H);
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
          const label = SIGNS[sg.k % SIGNS.length];
          const on = hash(Math.floor(t * 12) + sg.k) > 0.05;
          const col = (sg.k >> 1) % 2 ? C.pink : C.cyan;
          const fs = Math.round(13 * k);
          ctx.font = `700 ${fs}px ${MONO}`;
          const tw = ctx.measureText(label).width + 16 * k, bh = 24 * k;
          const by = sg.y + 30 * k;
          ctx.fillStyle = 'rgba(5,9,11,0.85)'; ctx.fillRect(sx - tw / 2, by, tw, bh);
          if (on) {
            glow(col, 14);
            ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(sx - tw / 2, by, tw, bh);
            ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, sx, by + bh * 0.7);
            noGlow();
          }
        }
      }
    }
  }

  function drawRoad() {
    const sp = 600 * s;
    // streetlights
    for (let x = -frac(dist / sp) * sp; x < W + sp; x += sp) {
      const top = G.roadFar - 190 * s;
      ctx.fillStyle = '#0d1a1f'; ctx.fillRect(x, top, 4 * s, G.roadFar - top); ctx.fillRect(x, top, 46 * s, 4 * s);
      const lg = ctx.createLinearGradient(0, top, 0, G.roadNear);
      lg.addColorStop(0, 'rgba(5,217,232,0.26)'); lg.addColorStop(1, 'rgba(5,217,232,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(x + 36 * s, top + 4 * s); ctx.lineTo(x + 56 * s, top + 4 * s);
      ctx.lineTo(x + 130 * s, G.roadNear); ctx.lineTo(x - 30 * s, G.roadNear); ctx.closePath(); ctx.fill();
      glow(C.cyan, 16); ctx.fillStyle = C.bright; ctx.fillRect(x + 34 * s, top + 3 * s, 22 * s, 4 * s); noGlow();
    }
    ctx.fillStyle = '#081217'; ctx.fillRect(0, G.roadFar - 16 * s, W, 16 * s);
    ctx.fillStyle = 'rgba(170,207,209,0.5)'; ctx.fillRect(0, G.roadFar - 16 * s, W, 1);
    const rg = ctx.createLinearGradient(0, G.roadFar, 0, G.roadNear);
    rg.addColorStop(0, '#0a1115'); rg.addColorStop(1, '#05080a');
    ctx.fillStyle = rg; ctx.fillRect(0, G.roadFar, W, G.roadNear - G.roadFar);
    const ds = 120 * s, mid = (G.roadFar + G.roadNear) / 2 - 6 * s;
    ctx.fillStyle = 'rgba(170,207,209,0.55)';
    for (let x = -frac(dist / ds) * ds; x < W; x += ds) ctx.fillRect(x, mid, 56 * s, Math.max(1.5, 2.5 * s));
    glow(C.cyan, 8); ctx.fillStyle = C.cyan; ctx.fillRect(0, G.roadNear, W, Math.max(1.5, 2 * s)); noGlow();
    ctx.fillStyle = '#071014'; ctx.fillRect(0, G.roadNear + 2 * s, W, G.deck - G.roadNear - 2 * s);
    ctx.fillStyle = 'rgba(255,42,109,0.8)';
    const rs = 40 * s;
    for (let x = -frac(dist / rs) * rs; x < W; x += rs) ctx.fillRect(x, G.roadNear + 9 * s, 10 * s, 3 * s);
    ctx.drawImage(layers.floor, 0, G.deck, W, H - G.deck);
    ctx.strokeStyle = 'rgba(211,0,197,0.32)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const p = frac(i / 10 + dist / (sp * 3));
      const y = G.deck + (H - G.deck) * p * p;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = '#060c10';
    for (let x = -frac(dist / sp) * sp + 200 * s; x < W + sp; x += sp) {
      ctx.fillRect(x, G.deck, 30 * s, H - G.deck);
      ctx.fillStyle = 'rgba(5,217,232,0.22)'; ctx.fillRect(x, G.deck, 2, H - G.deck); ctx.fillStyle = '#060c10';
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

  const BODY = new Path2D('M10,-38 L2,-58 L4,-78 L62,-84 Q102,-88 130,-110 L196,-116 Q236,-113 288,-84 L400,-72 Q426,-68 434,-54 L430,-42 L418,-36 Z');
  const WIN = new Path2D('M136,-106 L194,-112 Q228,-110 276,-86 L120,-86 Q126,-98 136,-106 Z');

  function drawCar(accel) {
    const k = 1.18 * s;
    const bob = Math.sin(t * 13) * 0.8 * s * (0.6 + speed * 0.3);
    const x0 = G.carX - 215 * k, y0 = G.lane + bob;
    const boostAmt = Math.max(0, Math.min(1, (speed - 1.2) / 2));
    // light trails
    const trail = 420 + boostAmt * 380;
    for (const [yy, col] of [[-68, '255,77,109'], [-58, '255,42,109']]) {
      const lg = ctx.createLinearGradient(x0 - trail * k, 0, x0, 0);
      lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(1, `rgba(${col},0.85)`);
      ctx.fillStyle = lg; ctx.fillRect(x0 - trail * k, y0 + yy * k, trail * k + 2, 3 * k);
    }
    // speed lines
    ctx.strokeStyle = `rgba(170,207,209,${0.15 + boostAmt * 0.35})`; ctx.lineWidth = 1;
    const nLines = 6 + Math.round(boostAmt * 8);
    for (let i = 0; i < nLines; i++) {
      const p = frac(dist / (900 * k) + i / nLines);
      const lx = x0 + 380 * k - p * 900 * k, ly = y0 - (14 + (i * 37 % 100)) * k;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - (120 + boostAmt * 160) * k, ly); ctx.stroke();
    }
    ctx.save();
    ctx.translate(x0 + 215 * k, y0); ctx.rotate(Math.max(-0.03, Math.min(0.03, -accel * 0.012))); ctx.translate(-215 * k, 0);
    ctx.scale(k, k);
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
    ctx.font = `700 11px ${MONO}`; ctx.fillStyle = C.bright; ctx.textAlign = 'center'; ctx.fillText('1337', 160, -66);
    glow(C.cyan, 18); ctx.fillStyle = C.bright; ctx.fillRect(416, -67, 16, 5); noGlow();
    glow(C.red, 18); ctx.fillStyle = C.red; ctx.fillRect(2, -72, 12, 7); noGlow();
    // wheels
    const a0 = dist / (33 * k);
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
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawCity(layers.far, 0.12, 20, false);
    drawCity(layers.near, 0.25, 36, true);
    drawRoad();
    drawTraffic();
    drawCar(accel);
    drawRain();
  }

  // ------------------------------------------------------------ loop + input
  const speedo = document.getElementById('speedo');
  const speedoBar = document.getElementById('speedo-bar');
  let speedoTimer = 0;

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;
    if (!dt) return;
    t += dt;
    scrollKick *= Math.pow(0.12, dt);
    pulse = Math.max(0, pulse - dt);
    const target = (boostHeld || pulse > 0 ? 3.2 : 1) + Math.min(1.6, scrollKick);
    speed += (target - speed) * Math.min(1, dt * (target > speed ? 2.2 : 1.2));
    dist += 400 * s * speed * dt;
    oncoming += dt * (0.12 + speed * 0.06);
    mouse += (mouseTarget - mouse) * Math.min(1, dt * 3);
    draw(dt);
    speedoTimer += dt;
    if (speedo && speedoTimer > 0.08) {
      speedoTimer = 0;
      const kmh = Math.round(speed * 88);
      speedo.textContent = String(kmh).padStart(3, '0');
      if (speedoBar) speedoBar.style.transform = `scaleX(${Math.min(1, kmh / 420)})`;
    }
  }

  function start() {
    if (running || reduceMotion.matches || !onScreen || document.hidden) return;
    running = true; lastTs = 0; rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  new ResizeObserver(() => resize()).observe(cv);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? start() : stop(); }, { threshold: 0.02 }).observe(cv);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { stop(); draw(); } else start(); });

  const isTyping = e => e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]');
  addEventListener('keydown', e => {
    if (isTyping(e) || !onScreen) return;
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

  let lastY = scrollY;
  addEventListener('scroll', () => {
    const dy = Math.abs(scrollY - lastY); lastY = scrollY;
    scrollKick = Math.min(2, scrollKick + dy / 400);
  }, { passive: true });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouseTarget = e.clientX / innerWidth - 0.5; }, { passive: true });

  // used by the terminal's `boost` command
  window.scene = { boost(seconds = 2.5) { pulse = seconds; start(); } };

  resize();
  start();
})();
