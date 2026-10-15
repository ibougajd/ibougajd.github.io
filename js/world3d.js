// The night drive in 3D: a WebGL city on a wet elevated highway, built entirely from code (no models,
// no textures, no video). Same contract as the 2D drive in scene2d.js:
//   window.scene = { stop, animated, accent(i), sunAt(i), boost(s), set(i), step(i, dur, onProgress) }
// Every section is a district with its own palette. Moving between them the car U-turns down a ramp to
// the next level while the city re-lights. Parked in a district, a projector arm on the car beams the
// section's panel into the night.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const wrapMod = (v, m) => ((v % m) + m) % m;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

// one palette per district (sRGB hex; the shaders get them in linear light):
// 0 start · 1 whoami · 2 projects · 3 stack · 4 git log · 5 shell · 6 contact
const THEMES = [
  { ui: '#05d9e8', glow: '#ff2a6d', top: '#0d1630', mid: '#3f2952', low: '#ac5159', hor: '#ff8e43', sunA: '#ff7224', sunB: '#ffd87c', cloud: '#ff8733',
    fog: '#2a1838', fogSun: '#fa954b', win: '#ffc88a', neon: '#5ee6ff', neon2: '#ff5ab4', lamp: '#5fe0ff' },
  { ui: '#d300c5', glow: '#d300c5', top: '#120a2a', mid: '#3e1a5a', low: '#9a3f9e', hor: '#e06bff', sunA: '#e01fd0', sunB: '#ffc6ec', cloud: '#e766ff',
    fog: '#2a1236', fogSun: '#e070ff', win: '#ffd2a0', neon: '#ff5ae0', neon2: '#9a7cff', lamp: '#ff7ae0' },
  { ui: '#05d9e8', glow: '#05d9e8', top: '#06142a', mid: '#123a55', low: '#2f7f94', hor: '#4fe3ff', sunA: '#14c8e6', sunB: '#e6fbff', cloud: '#5fdcff',
    fog: '#0e2a38', fogSun: '#4fd0f0', win: '#c8ecff', neon: '#3fe4ff', neon2: '#5a8cff', lamp: '#5fe0ff' },
  { ui: '#8fe3a8', glow: '#8fe3a8', top: '#061a12', mid: '#12402c', low: '#3a8a5e', hor: '#78ffaa', sunA: '#2fd27a', sunB: '#e0ffe9', cloud: '#8dffb8',
    fog: '#0e2a1a', fogSun: '#5ee09a', win: '#c8ffd8', neon: '#8fe3a8', neon2: '#3fe0cc', lamp: '#7dffc0' },
  { ui: '#e3c88f', glow: '#e3a35f', top: '#1a1008', mid: '#4a2c14', low: '#b0663a', hor: '#ffae52', sunA: '#ff8a2a', sunB: '#fff1c4', cloud: '#ffb05a',
    fog: '#33200e', fogSun: '#ffa050', win: '#ffd49a', neon: '#f0d29a', neon2: '#ff8a55', lamp: '#ffc880' },
  { ui: '#2bd96a', glow: '#2bd96a', top: '#020a05', mid: '#0a2a14', low: '#226a3a', hor: '#3cff80', sunA: '#22c060', sunB: '#c8ffd8', cloud: '#4cff90',
    fog: '#08200e', fogSun: '#3cd070', win: '#a8ffc4', neon: '#3ce07a', neon2: '#c4ff6e', lamp: '#6dff9e' },
  { ui: '#ffb36e', glow: '#ffb36e', top: '#141235', mid: '#4a2a60', low: '#d0607a', hor: '#ffb87a', sunA: '#ff7a3d', sunB: '#fff6d5', cloud: '#ffb07a',
    fog: '#3a2440', fogSun: '#ffa070', win: '#ffd8a0', neon: '#ffb87a', neon2: '#ff4a80', lamp: '#ffc49a' }
];
// HDR gain per colour role, so suns, clouds and neon are bright enough to bloom
const GAIN = { hor: 1.25, sunA: 2, sunB: 2, cloud: 2 };
const KEYS = ['top', 'mid', 'low', 'hor', 'sunA', 'sunB', 'cloud', 'fog', 'fogSun', 'win', 'neon', 'neon2', 'lamp'];
const PAL = THEMES.map(th => Object.fromEntries(KEYS.map(k => [k, new THREE.Color(th[k]).multiplyScalar(GAIN[k] || 1)])));
const facingOf = i => (i % 2 ? -1 : 1);

export function start(canvas) {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 3000);
  const restCam = new THREE.PerspectiveCamera(38, 1, .1, 3000);   // the camera without sway, for layout maths
  const CAM = new THREE.Vector3(0, 2.2, 16);
  const LOOK = new THREE.Vector3(0, 8, -100);
  for (const c of [camera, restCam]) { c.position.copy(CAM); c.lookAt(LOOK); }

  const SUN_Y = 128, SUN_Z = -950, SUN_R = 112, SUN_X = 300;
  const sunXFor = f => (f > 0 ? SUN_X : -SUN_X);

  // ------------------------------------------------------------------ uniforms
  const T = Object.fromEntries(KEYS.map(k => [k, { value: new THREE.Color() }]));
  const shared = {
    uTime: { value: 0 },
    uCamPos: { value: CAM.clone() },
    uSunDir: { value: new THREE.Vector3() },
    uFogDensity: { value: 1 / 620 },
    uWin: T.win, uNeon: T.neon, uNeon2: T.neon2, uLamp: T.lamp, uFogBase: T.fog, uFogSun: T.fogSun
  };

  const NOISE = /* glsl */`
    float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
    float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
      return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
  `;
  const FOG = /* glsl */`
    uniform vec3 uCamPos; uniform vec3 uSunDir; uniform float uFogDensity; uniform vec3 uFogBase; uniform vec3 uFogSun;
    vec3 fogTint(vec3 dir) {
      float s = max(dot(dir, uSunDir), 0.);
      float low = 1. - clamp(dir.y * 3.5, 0., 1.);
      vec3 base = mix(uFogBase, uFogBase * 3. + uFogSun * .05, low);
      return mix(base, uFogSun * .9, pow(s, 6.) * low);
    }
    vec3 applyFog(vec3 col, vec3 wp, float k) {
      vec3 d = wp - uCamPos; float dist = length(d);
      float f = 1. - exp(-dist * uFogDensity);
      return mix(col, fogTint(d / dist), clamp(f * k, 0., 1.));
    }
  `;
  // moves an instance along x so the world loops forever while the car stays put
  const WRAP = /* glsl */`
    uniform float uOffset; uniform float uSpan;
    vec4 wrapped(vec3 p) {
      vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.);
      float cx = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).x;
      wp.x += mod(cx - uOffset + uSpan * .5, uSpan) - uSpan * .5 - cx;
      return wp;
    }
  `;

  // ------------------------------------------------------------------ materials
  function buildingMaterial(band) {
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, ...band.u, uCell: { value: band.cell }, uDensity: { value: band.density }, uBright: { value: band.bright } },
      vertexShader: /* glsl */`
        ${WRAP}
        attribute float aSeed; attribute vec3 aTint;
        varying vec3 vLocal; varying vec3 vN; varying vec3 vWorld; varying float vSeed; varying vec3 vScale; varying vec3 vTint;
        void main() {
          vec3 scale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec4 wp = wrapped(position);
          vLocal = position * scale; vN = normal; vWorld = wp.xyz; vSeed = aSeed; vScale = scale; vTint = aTint;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec2 uCell; uniform float uDensity; uniform float uBright;
        uniform vec3 uWin; uniform vec3 uNeon; uniform vec3 uNeon2;
        ${NOISE}
        ${FOG}
        varying vec3 vLocal; varying vec3 vN; varying vec3 vWorld; varying float vSeed; varying vec3 vScale; varying vec3 vTint;
        void main() {
          vec3 n = normalize(vN);
          float H = vScale.y, y = vLocal.y, h01 = clamp(y / H, 0., 1.);
          float side = step(.5, abs(n.x)), top = step(.5, n.y);
          float u = mix(vLocal.x, vLocal.z, side);
          // facade: near-black glass, catching a little sky high up and the sun on the sunny side
          vec3 col = vTint * (.005 + .028 * h01 * h01);
          col *= mix(1., .55, side);
          float rim = max(dot(n, normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.);
          col += uFogSun * rim * smoothstep(.55, 1., h01) * .16;
          // windows: a grid in the building's own coordinates, so it never slides as the world loops
          vec2 gp = vec2(u, y) / uCell;
          vec2 id = floor(gp), f = fract(gp);
          vec2 w = fwidth(gp) + 1e-4;
          float mx = smoothstep(.2 - w.x, .2 + w.x, f.x) * (1. - smoothstep(.8 - w.x, .8 + w.x, f.x));
          float my = smoothstep(.24 - w.y, .24 + w.y, f.y) * (1. - smoothstep(.76 - w.y, .76 + w.y, f.y));
          float seed = floor(abs(vSeed) + .5);   // whole numbers: a fractional seed would shimmer through the hash
          float bldDensity = uDensity * mix(.35, 1.25, hash11(seed * 3.7));
          float floorOff = step(hash21(vec2(id.y, seed * 13.1)), .18);
          float r = hash21(id + seed * 17.3);
          float lit = step(r, bldDensity) * (1. - floorOff);
          float flick = step(hash21(id * 1.7 + seed), .03);
          lit *= mix(1., step(.35, fract(uTime * .23 + r * 9.)), flick);
          float pick = hash21(id.yx + seed * 5.1);
          vec3 wc = pick < .62 ? uWin : pick < .8 ? uNeon : pick < .9 ? uNeon2 : vec3(.92, .95, 1.);
          vec3 win = wc * (.55 + 1.1 * hash21(id + 4.2)) * lit * mx * my;
          float px = max(w.x, w.y);
          win = mix(win, uWin * bldDensity * .22, smoothstep(.3, .75, px));   // finer than a pixel: average glow
          col += win * uBright * step(0., vSeed) * (1. - top) * step(1.2, H - y);
          float cap = smoothstep(H - .3, H - .05, y) * (1. - top) * step(.72, hash11(seed * 9.1));
          col += mix(uNeon, uNeon2, step(.5, hash11(seed * 2.3))) * cap * 1.4;
          gl_FragColor = vec4(applyFog(col, vWorld, .7), 1.);
        }`
    });
  }

  // kinds: 0 neon strip · 1 billboard · 2 aircraft light · 3 fixed colour · 4 themed road light · 5 lamp head
  function glowMaterial(u, fade = { value: 1 }) {
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, ...u, uFade: fade },
      vertexShader: /* glsl */`
        ${WRAP}
        attribute vec3 aColor; attribute float aKind; attribute float aSeed; attribute float aPick; attribute float aBright;
        varying vec2 vUv; varying vec3 vColor; varying float vKind; varying float vSeed; varying float vPick; varying float vBright; varying vec3 vWorld;
        void main() {
          vec4 wp = wrapped(position);
          vUv = uv; vColor = aColor; vKind = aKind; vSeed = aSeed; vPick = aPick; vBright = aBright; vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uWin; uniform vec3 uNeon; uniform vec3 uNeon2; uniform vec3 uLamp; uniform float uFade;
        ${NOISE}
        ${FOG}
        varying vec2 vUv; varying vec3 vColor; varying float vKind; varying float vSeed; varying float vPick; varying float vBright; varying vec3 vWorld;
        void main() {
          vec3 themed = (vPick < .5 ? uNeon : vPick < .85 ? uNeon2 : uWin) * vBright;
          vec3 c = vColor;
          float k = 1., sd = floor(vSeed + .5);
          if (vKind < .5) {
            c = themed;
            k = (.85 + .15 * sin(uTime * 3. + sd * .37)) * step(.04, hash21(vec2(floor(uTime * 9.), sd * 1.3)));
          } else if (vKind < 1.5) {
            vec2 uv = vUv;
            float frame = 1. - step(.07, uv.x) * step(uv.x, .93) * step(.12, uv.y) * step(uv.y, .88);
            vec2 g = vec2(floor(uv.x * 9.), floor(uv.y * 3.));
            float glyph = step(.45, hash21(g + sd * .71)) * step(.2, fract(uv.y * 3.)) * step(fract(uv.y * 3.), .8) * step(.12, uv.x) * step(uv.x, .88);
            float on = step(.06, hash21(vec2(floor(uTime * 6.), sd * .53)));
            c = mix(vec3(.02, .015, .03), themed, max(frame, glyph * .85) * on);
          } else if (vKind < 2.5) {
            k = step(.55, fract(uTime * .5 + sd * .013)) * 1.6;
          } else if (vKind > 4.5) {
            c = uLamp * vBright;
          } else if (vKind > 3.5) {
            c = (vPick < .75 ? uNeon : uNeon2) * vBright;
          }
          gl_FragColor = vec4(applyFog(c * k, vWorld, .55) * uFade, uFade);
        }`
    });
  }

  function solidMaterial(u, fade) {
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, ...u, uFade: fade || { value: 1 } },
      transparent: !!fade,
      vertexShader: /* glsl */`
        ${WRAP}
        attribute vec3 aColor;
        varying vec3 vN; varying vec3 vWorld; varying vec3 vColor;
        void main() { vec4 wp = wrapped(position); vN = normal; vWorld = wp.xyz; vColor = aColor; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`
        uniform float uFade;
        ${FOG}
        varying vec3 vN; varying vec3 vWorld; varying vec3 vColor;
        void main() {
          vec3 n = normalize(vN);
          vec3 col = vColor * (.35 + .65 * max(n.y, 0.)) + uFogSun * max(dot(n, normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.) * .05;
          gl_FragColor = vec4(applyFog(col, vWorld, 1.), uFade);
        }`
    });
  }

  function beamMaterial(u, fade, strength) {
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, ...u, uFade: fade, uStrength: { value: strength } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        ${WRAP}
        varying vec3 vN; varying vec3 vView; varying float vH;
        void main() {
          vec4 wp = wrapped(position);
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz); vH = uv.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uLamp; uniform float uStrength; uniform float uFade;
        varying vec3 vN; varying vec3 vView; varying float vH;
        void main() {
          float edge = abs(dot(normalize(vN), normalize(vView)));
          gl_FragColor = vec4(uLamp * pow(edge, 2.2) * (.15 + .85 * pow(vH, 1.6)) * uStrength * uFade, 1.);
        }`
    });
  }

  function poolMaterial(u, fade, strength) {
    return new THREE.ShaderMaterial({
      uniforms: { ...shared, ...u, uFade: fade, uStrength: { value: strength } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`${WRAP} varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * wrapped(position); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uLamp; uniform float uStrength; uniform float uFade; varying vec2 vUv;
        void main() { float d = length((vUv - .5) * vec2(1., 1.6)) * 2.; gl_FragColor = vec4(uLamp * pow(max(1. - d, 0.), 2.2) * uStrength * uFade, 1.); }`
    });
  }

  // ------------------------------------------------------------------ looping instanced geometry
  const loops = [];
  const loop = span => { const l = { span, u: { uOffset: { value: 0 }, uSpan: { value: span } } }; loops.push(l); return l; };
  function instanced(geometry, material, items, attrs = {}, parent = scene) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1));
      mesh.setMatrixAt(i, m);
    });
    for (const [name, size] of Object.entries(attrs)) {
      const arr = new Float32Array(items.length * size);
      items.forEach((it, i) => { const v = it[name] ?? 0; if (size === 1) arr[i] = v; else arr.set(v, i * size); });
      geometry.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
    }
    mesh.frustumCulled = false;   // the vertex shader moves instances, CPU bounds would lie
    parent.add(mesh);
    return mesh;
  }
  const GLOW_ATTRS = { aColor: 3, aKind: 1, aSeed: 1, aPick: 1, aBright: 1 };

  const rand = (() => { let s = 1337; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const rr = (a, b) => a + (b - a) * rand();
  const seedInt = () => Math.floor(rr(1, 999));

  // ------------------------------------------------------------------ city: four depth bands
  const BANDS = [
    { z: [-85, -120], D: 118, h: [5, 15], w: [4.5, 10], d: [5, 9], cell: [.85, 1.1], density: .5, bright: 1.15, signs: true, tint: [.35, .3, .6] },
    { z: [-170, -235], D: 218, h: [10, 26], w: [6, 13], d: [7, 12], cell: [1.15, 1.45], density: .46, bright: 1.05, signs: true, tint: [.35, .28, .55] },
    { z: [-300, -385], D: 358, h: [16, 40], w: [8, 17], d: [9, 15], cell: [1.6, 2.0], density: .38, bright: .95, signs: false, tint: [.4, .25, .45] },
    { z: [-480, -565], D: 538, h: [22, 54], w: [11, 22], d: [11, 18], cell: [2.3, 2.9], density: .22, bright: .8, signs: false, tint: [.45, .22, .38] }
  ];
  for (const B of BANDS) {
    const span = Math.round(2.4 * B.D + 2 * B.w[1]);
    const L = loop(span);
    const base = -(B.D * 0.11) - 6;
    const blds = [], glows = [];
    let x = -span / 2;
    while (x < span / 2) {
      const w = rr(...B.w), h = rr(...B.h) * (rand() < .14 ? rr(1.5, 2.5) : rr(.75, 1.15)), d = rr(...B.d);
      const z = rr(B.z[0], B.z[1]), seed = seedInt();
      const tint = B.tint.map(c => c * rr(.7, 1.2));
      const total = h - base, front = z + d / 2 + .06;
      blds.push({ x: x + w / 2, y: base, z, sx: w, sy: total, sz: d, aSeed: seed, aTint: tint });
      if (rand() < .35) blds.push({ x: x + w / 2, y: h, z, sx: w * .62, sy: rr(2, 7), sz: d * .62, aSeed: seed, aTint: tint });
      if (rand() < (h > B.h[1] * 1.3 ? .7 : .05)) {
        const sh = rr(4, 12) * (B.D / 200 + .3);
        blds.push({ x: x + w / 2, y: h, z, sx: .5 + B.D / 400, sy: sh, sz: .5 + B.D / 400, aSeed: -seed, aTint: tint });
        glows.push({ x: x + w / 2, y: h + sh + .4, z: z + .4, sx: .7 + B.D / 300, sy: .7 + B.D / 300, aColor: [2.2, .25, .2], aKind: 2, aSeed: seedInt() });
      }
      if (rand() < (B.signs ? .42 : .14)) {
        const sh2 = h * rr(.35, .9);
        glows.push({ x: x + rr(.1, .9) * w, y: h - sh2 / 2 - rr(0, h * .1), z: front, sx: .22 + B.D / 900, sy: sh2, aKind: 0, aSeed: seedInt(), aPick: rand(), aBright: rr(1.8, 2.6) });
      }
      if (B.signs && rand() < .3) {
        const sw = Math.min(w * .75, rr(2.5, 5) * (B.D / 140));
        glows.push({ x: x + w / 2, y: rr(Math.min(3, h * .5), Math.max(3.5, h * .7)), z: front + .02, sx: sw, sy: sw * rr(.3, .5), aKind: 1, aSeed: seedInt(), aPick: rand(), aBright: rr(1.8, 2.4) });
      }
      x += w + rr(-.3, 1.6) * (B.D / 200);
    }
    instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), buildingMaterial({ ...B, u: L.u, cell: new THREE.Vector2(...B.cell) }), blds, { aSeed: 1, aTint: 3 });
    if (glows.length) instanced(new THREE.PlaneGeometry(1, 1), glowMaterial(L.u), glows, GLOW_ATTRS);
  }
  // haze between the bands sells the depth (tinted by the district's fog)
  const hazes = [];
  for (const [z, y0, y1, k, a] of [[-140, -30, 12, 2.2, .28], [-260, -45, 26, 3, .3], [-430, -70, 40, 4.5, .34]]) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: a } }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor, pow(1. - vUv.y, 1.8) * uAlpha); }'
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4000, y1 - y0), mat);
    m.position.set(0, (y0 + y1) / 2, z);
    scene.add(m);
    hazes.push({ mat, k });
  }

  // the ground the city stands on: dark, fogged towards the horizon (hides the tower bases when the road moves)
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `${FOG} varying vec3 vWorld; void main(){ gl_FragColor = vec4(applyFog(vec3(.006, .006, .01), vWorld, 1.), 1.); }`
    }));
    ground.position.set(0, -8, -700);
    scene.add(ground);
  }

  // ------------------------------------------------------------------ sky
  const skyU = {
    uTime: shared.uTime, uSun: { value: new THREE.Vector3(SUN_X, SUN_Y, SUN_R) }, uCloudT: { value: 0 },
    uTop: T.top, uMid: T.mid, uLow: T.low, uHor: T.hor, uSunA: T.sunA, uSunB: T.sunB, uCloudCol: T.cloud
  };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(5200, 2200), new THREE.ShaderMaterial({
    uniforms: skyU, depthWrite: false,
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform float uCloudT;
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uHor; uniform vec3 uSunA; uniform vec3 uSunB; uniform vec3 uCloudCol;
      ${NOISE}
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xy; float y = p.y;
        float sunSide = exp(-abs(p.x - uSun.x) / 520.);
        vec3 col = mix(uLow * mix(.55, 1., sunSide), uMid, smoothstep(40., 330., y));
        col = mix(col, uTop, smoothstep(330., 820., y));
        col += uHor * exp(-max(y - 25., 0.) / 75.) * (.25 + .75 * sunSide);
        vec2 sc = floor(p / 5.);
        col += step(.9975, hash21(sc)) * smoothstep(380., 720., y) * vec3(.8, .85, 1.) * (.55 + .45 * sin(uTime * 2. + hash21(sc) * 40.));
        vec2 sp = p - uSun.xy; float d = length(sp), r = uSun.z;
        float disc = 1. - smoothstep(r - 1.2, r + 1.2, d);
        float k = clamp((sp.y + r) / (2. * r), 0., 1.);
        vec3 sunCol = mix(uSunA, uSunB, smoothstep(.1, .95, k));
        float sy = (uSun.y - p.y) / r;
        disc *= 1. - step(.05, sy) * step(fract(sy * 6. + .3), mix(.08, .5, clamp(sy, 0., 1.)));
        col += uSunA * .75 * exp(-max(d - r, 0.) / 60.) * .7;
        vec2 q = vec2(p.x * .0021 + uCloudT * .0035, p.y * .0072);
        q += vec2(fbm(q * 1.7 + uCloudT * .008), fbm(q * 1.3 - 3.1)) * .65;
        float band = smoothstep(120., 230., y) * (1. - smoothstep(640., 860., y));
        float dens = smoothstep(.44, .76, fbm(q * 2.2)) * band;
        vec2 toSun = normalize(uSun.xy - p);
        float dens2 = smoothstep(.44, .76, fbm((q + toSun * vec2(.035, .02)) * 2.2)) * band;
        float lit = clamp(dens - dens2 + .2, 0., 1.);
        float prox = exp(-length(uSun.xy - p) / 560.);
        vec3 cloud = mix(uTop * .6 + vec3(.01), uCloudCol, clamp(lit * 1.1 + prox * .8, 0., 1.) * (.35 + .65 * sunSide));
        col = mix(col, sunCol, disc * (1. - dens * .8));
        col = mix(col, cloud, dens * .93);
        gl_FragColor = vec4(col, 1.);
      }`
  }));
  sky.position.set(0, 400, -960);
  sky.renderOrder = -1;
  scene.add(sky);

  // ------------------------------------------------------------------ the highway (one group, so a level can move and fade as a whole)
  const road = new THREE.Group();
  scene.add(road);
  const roadFade = { value: 1 };
  const reflector = new Reflector(new THREE.PlaneGeometry(900, 14), {
    textureWidth: 512, textureHeight: 512, clipBias: .003, multisample: 0,
    shader: {
      name: 'WetRoad',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uRoad: { value: 0 }, uRefl: { value: 1 }, uFade: { value: 1 } },
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main() { vUv = textureMatrix * vec4(position, 1.); vec4 wp = modelMatrix * vec4(position, 1.); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uRoad; uniform float uRefl; uniform float uFade;
        varying vec4 vUv; varying vec3 vWorld;
        ${NOISE}
        void main() {
          vec2 p = vec2(vWorld.x + uRoad, vWorld.z);
          float wet = smoothstep(.38, .7, fbm(p * vec2(.07, .3)));
          vec2 ripple = vec2(vnoise(p * vec2(2.5, 9.) + uTime * .8), vnoise(p * vec2(2.5, 9.) + 9.1 - uTime * .7)) - .5;
          vec2 uv = vUv.xy / vUv.w + ripple * vec2(.0025, .004) * mix(1., .4, wet);
          float spread = mix(.011, .0035, wet);
          vec3 refl = vec3(0.); float ws = 0.;
          for (int i = -7; i <= 7; i++) { float w = exp(-float(i * i) / 22.); refl += texture2D(tDiffuse, uv + vec2(0., float(i) * spread)).rgb * w; ws += w; }
          refl /= ws;
          vec3 asphalt = vec3(.010, .011, .016) * (.6 + .8 * vnoise(p * 4.));
          gl_FragColor = vec4(asphalt + refl * mix(.42, .9, wet) * uRefl, uFade);
        }`
    }
  });
  reflector.material.transparent = true;
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0, 2.5);
  road.add(reflector);

  const fadeables = [];   // standard materials of the road, faded with it
  const metal = new THREE.MeshStandardMaterial({ color: 0x07080d, metalness: .6, roughness: .5, envMapIntensity: .2, transparent: true });
  fadeables.push(metal);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(900, .9, .35), metal);
  wall.position.set(0, .45, -4.75);
  road.add(wall);
  const wallTopMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true });
  fadeables.push(wallTopMat);
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(900, .05, .06), wallTopMat);
  wallTop.position.set(0, .92, -4.56);
  road.add(wallTop);

  const roadLoop = loop(180);
  const dashes = [];
  for (let x = -90; x < 90; x += 9) {
    dashes.push({ x, y: .012, z: -1.7, sx: 3.2, sy: .14, rx: -Math.PI / 2, aColor: [.9, .95, 1.1], aKind: 3 });
    dashes.push({ x: x + 4.5, y: .012, z: 1.9, sx: 3.2, sy: .14, rx: -Math.PI / 2, aColor: [.9, .95, 1.1], aKind: 3 });
  }
  for (let x = -90; x < 90; x += 6) dashes.push({ x, y: .45, z: -4.56, sx: 1.6, sy: .07, aKind: 4, aPick: .9, aBright: 2.4 });
  instanced(new THREE.PlaneGeometry(1, 1), glowMaterial(roadLoop.u, roadFade), dashes, GLOW_ATTRS, road);

  const lampLoop = loop(96);
  const LAMP_Y = 8.6, LAMP_Z = -3.0, LAMPS = [-48, -24, 0, 24];
  instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), solidMaterial(lampLoop.u, roadFade),
    LAMPS.flatMap(x => [
      { x, y: 0, z: -5.2, sx: .18, sy: LAMP_Y + .2, sz: .18, aColor: [.03, .035, .05] },
      { x, y: LAMP_Y, z: -4.1, sx: .14, sy: .14, sz: 2.4, aColor: [.03, .035, .05] }
    ]), { aColor: 3 }, road);
  instanced(new THREE.PlaneGeometry(1, 1), glowMaterial(lampLoop.u, roadFade),
    LAMPS.map(x => ({ x, y: LAMP_Y - .1, z: LAMP_Z, sx: 1.1, sy: .14, aKind: 5, aBright: 4.5 })), GLOW_ATTRS, road);
  const lampBeam = beamMaterial(lampLoop.u, roadFade, .3), lampPool = poolMaterial(lampLoop.u, roadFade, .5);
  instanced(new THREE.ConeGeometry(3.2, LAMP_Y, 32, 1, true), lampBeam, LAMPS.map(x => ({ x, y: LAMP_Y / 2 - .1, z: LAMP_Z })), {}, road);
  instanced(new THREE.PlaneGeometry(1, 1), lampPool, LAMPS.map(x => ({ x, y: .02, z: LAMP_Z + .4, sx: 7, sy: 5.5, rx: -Math.PI / 2 })), {}, road);

  const railLoop = loop(60);
  const posts = [], railLights = [];
  for (let x = -30; x < 30; x += 6) posts.push({ x, y: -1, z: 11, sx: .16, sy: 2.25, sz: .16, aColor: [.025, .028, .04] });
  for (let x = -30; x < 30; x += 4) railLights.push({ x, y: 1.205, z: 11.06, sx: 3.2, sy: .03, aKind: 4, aPick: x % 12 === 0 ? .9 : .2, aBright: 1.3 });
  instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), solidMaterial(railLoop.u, roadFade), posts, { aColor: 3 }, road);
  instanced(new THREE.PlaneGeometry(1, 1), glowMaterial(railLoop.u, roadFade), railLights, GLOW_ATTRS, road);
  for (const [y, h] of [[1.16, .06], [.62, .05]]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(900, h, .1), metal);
    beam.position.set(0, y, 11.05);
    road.add(beam);
  }

  // oncoming traffic on the far lane
  const traffic = [];
  {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090b12, metalness: .6, roughness: .35, transparent: true });
    const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 5, 5.5), transparent: true });
    const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, .3, .35), transparent: true });
    fadeables.push(bodyMat, head, tail);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, .75, 1.7), bodyMat); b.position.y = .62; g.add(b);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, .5, 1.5), bodyMat); cab.position.set(.2, 1.2, 0); g.add(cab);
      for (const z of [.55, -.55]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .32), head); h.position.set(-2.12, .7, z); g.add(h);
        const t = new THREE.Mesh(new THREE.BoxGeometry(.06, .1, .32), tail); t.position.set(2.12, .72, z); g.add(t);
      }
      g.position.set(-60 + i * 60, 0, -3.1);
      road.add(g);
      traffic.push({ g, v: rr(18, 26) });
    }
  }

  // the hairpin ramp between levels (only visible while driving between districts)
  const ramp = new THREE.Group();
  {
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x080a10, metalness: .5, roughness: .45, transparent: true });
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true });
    const dashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.25, 1.35), transparent: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, .3, 3.4), slabMat); slab.position.y = -.15; ramp.add(slab);
    for (const z of [1.62, -1.62]) { const e = new THREE.Mesh(new THREE.BoxGeometry(1, .06, .06), edgeMat); e.position.set(0, .03, z); ramp.add(e); }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1, .01, .1), dashMat); dash.position.y = .01; ramp.add(dash);
    ramp.userData = { slabMat, edgeMat, dashMat };
    ramp.visible = false;
    scene.add(ramp);
  }

  // ------------------------------------------------------------------ the car (profile extruded from the 2D car)
  const K = .0106;
  const P = (x, y) => [(x - 217) * K, -y * K];
  function carShape() {
    const s = new THREE.Shape();
    s.moveTo(...P(10, -38)); s.lineTo(...P(2, -58)); s.lineTo(...P(4, -78)); s.lineTo(...P(62, -84));
    s.quadraticCurveTo(...P(102, -88), ...P(130, -110)); s.lineTo(...P(196, -116));
    s.quadraticCurveTo(...P(236, -113), ...P(288, -84)); s.lineTo(...P(400, -72));
    s.quadraticCurveTo(...P(426, -68), ...P(434, -54)); s.lineTo(...P(430, -42)); s.lineTo(...P(418, -36));
    s.lineTo(...P(386, -36)); s.absarc(...P(338, -34), 48 * K, 0, Math.PI, false);
    s.lineTo(...P(144, -37)); s.absarc(...P(96, -34), 48 * K, 0, Math.PI, false);
    s.lineTo(...P(10, -38));
    return s;
  }
  function windowShape() {
    const s = new THREE.Shape();
    s.moveTo(...P(136, -106)); s.lineTo(...P(194, -112)); s.quadraticCurveTo(...P(228, -110), ...P(276, -86));
    s.lineTo(...P(120, -86)); s.quadraticCurveTo(...P(126, -98), ...P(136, -106));
    return s;
  }
  const car = new THREE.Group();
  car.rotation.order = 'YZX';     // yaw first, then pitch about the car's own axis
  const WIDTH = 1.8;
  const CYAN = new THREE.Color(.12, 1.25, 1.7), PINK = new THREE.Color(1.8, .14, .75);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x080a10, metalness: .65, roughness: .35 });
  {
    car.add(new THREE.Mesh(
      new THREE.ExtrudeGeometry(carShape(), { depth: WIDTH, bevelEnabled: true, bevelThickness: .07, bevelSize: .05, bevelSegments: 4, curveSegments: 24 }).translate(0, 0, -WIDTH / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x030406, metalness: .55, roughness: .34, clearcoat: .45, clearcoatRoughness: .12, envMapIntensity: .22 })));
    car.add(new THREE.Mesh(
      new THREE.ExtrudeGeometry(windowShape(), { depth: WIDTH + .16, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -(WIDTH + .16) / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x0a2830, emissive: 0x05303a, metalness: .9, roughness: .08, clearcoat: 1 })));
    const tube = (pts, color, r) => {
      const curve = new THREE.CatmullRomCurve3(pts, pts.length > 2, 'centripetal', .2);
      car.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 4), r, 6, pts.length > 2), new THREE.MeshBasicMaterial({ color })));
    };
    // neon on both flanks: the car shows either side as it zigzags
    for (const side of [1, -1]) {
      const zs = side * (WIDTH / 2 + .075);
      tube(carShape().getPoints(18).map(p => new THREE.Vector3(p.x, p.y, zs)), CYAN, .011);
      tube([new THREE.Vector3(...P(20, -60), zs + side * .004), new THREE.Vector3(...P(420, -56), zs + side * .004)], PINK, .013);
      tube(windowShape().getPoints(10).map(p => new THREE.Vector3(p.x, p.y, zs + side * .09)), new THREE.Color(.1, .7, .95), .007);
    }
    const lamp = (x0, y0, x1, y1, color) => {
      const [ax, ay] = P(x0, y0), [bx, by] = P(x1, y1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(bx - ax), Math.abs(by - ay), WIDTH + .1), new THREE.MeshBasicMaterial({ color }));
      m.position.set((ax + bx) / 2, (ay + by) / 2, 0); car.add(m);
    };
    lamp(1, -72, 9, -64, new THREE.Color(5, .35, .35));
    lamp(424, -66, 435, -60, new THREE.Color(5, 6, 6.5));
    for (const x of [22, 46]) {
      const [px, py] = P(x, -86);
      for (const z of [.55, -.55]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .06), darkMetal); post.position.set(px, py, z); car.add(post); }
    }
    const [wx, wy] = P(29, -96);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(.72, .045, WIDTH + .1), darkMetal); wing.position.set(wx, wy, 0); car.add(wing);
    const [hx, hy] = P(434, -63);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 32, 1, true).translate(0, -4.5, 0).rotateZ(Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(.35, .85, 1) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = uv.y; vec4 wp = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 uColor; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uColor * pow(e, 2.) * pow(vH, 2.) * .55, 1.); }'
    }));
    beam.position.set(hx, hy - .05, 0); car.add(beam);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ vec2 d = (vUv - .5) * vec2(1., 2.1); float a = pow(max(1. - length(d) * 1.9, 0.), 1.7) * (.85 + .15 * sin(uTime * 3.)); gl_FragColor = vec4(vec3(1.5, .12, 1.25) * a, 1.); }'
    }));
    under.position.y = -.04; car.add(under);
  }
  // light trails and nitro flame behind the car
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uLen: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float a = pow(vUv.x, 2.2) * (1. - abs(vUv.y - .5) * 2.); gl_FragColor = vec4(vec3(2.4, .25, .45) * a, 1.); }'
  });
  const trails = [];
  for (const z of [.6, -.6]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1, .07).translate(-.5, 0, 0), trailMat);
    const [tx, ty] = P(1, -68);
    t.position.set(tx, ty, z); car.add(t); trails.push(t);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.12, 1, 16, 1, true).translate(0, -.5, 0).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 2.2, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  { const [fx, fy] = P(4, -48); flame.position.set(fx, fy, 0); car.add(flame); }

  const wheels = [];
  {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: .85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x0c1218, metalness: .8, roughness: .3 });
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(.12, 1.3, 1.7) });
    const spokeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, .7, .75) });
    const hubMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, .3, 1.4) });
    for (const x of [96, 338]) {
      const [px, py] = P(x, -34);
      for (const zs of [1, -1]) {
        const wheel = new THREE.Group();
        wheel.position.set(px, py, zs * (WIDTH / 2 - .1));
        wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .34, 32).rotateX(Math.PI / 2), tireMat));
        const face = new THREE.Group();
        face.position.z = zs * .175;
        face.add(new THREE.Mesh(new THREE.CircleGeometry(.31, 32), rimMat));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.24, .016, 8, 48), ringMat); ring.position.z = .01; face.add(ring);
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, .01), spokeMat);
          const a = i / 5 * Math.PI * 2;
          spoke.position.set(Math.cos(a) * .13, Math.sin(a) * .13, .012); spoke.rotation.z = a; face.add(spoke);
        }
        const hub = new THREE.Mesh(new THREE.CircleGeometry(.04, 16), hubMat); hub.position.z = .014; face.add(hub);
        if (zs < 0) face.rotation.y = Math.PI;
        wheel.add(face); car.add(wheel); wheels.push(wheel);
      }
    }
  }

  // projector arm on the rear deck: turret → shoulder → upper arm → elbow → forearm → head with a lens
  const arm = {};
  {
    const ringMat = new THREE.MeshBasicMaterial({ color: CYAN });
    const joint = r => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(r, .012, 6, 24), ringMat); t.rotation.y = Math.PI / 2; g.add(new THREE.Mesh(new THREE.SphereGeometry(r * .8, 16, 12), darkMetal), t); return g; };
    const [mx, my] = P(165, -114);
    arm.mount = new THREE.Group(); arm.mount.position.set(mx, my - .02, 0); car.add(arm.mount);
    arm.turret = new THREE.Group(); arm.mount.add(arm.turret);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .12, 20), darkMetal); base.position.y = .06; arm.turret.add(base);
    arm.shoulder = joint(.09); arm.shoulder.position.y = .16; arm.turret.add(arm.shoulder);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(1.05, .09, .1), darkMetal); upper.position.x = .52; arm.shoulder.add(upper);
    const upperNeon = new THREE.Mesh(new THREE.BoxGeometry(.9, .012, .012), ringMat); upperNeon.position.set(.52, .05, 0); arm.shoulder.add(upperNeon);
    arm.elbow = joint(.075); arm.elbow.position.x = 1.05; arm.shoulder.add(arm.elbow);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(.9, .075, .085), darkMetal); fore.position.x = .45; arm.elbow.add(fore);
    arm.wrist = new THREE.Group(); arm.wrist.position.x = .92; arm.elbow.add(arm.wrist);
    arm.head = new THREE.Group(); arm.wrist.add(arm.head);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .3), darkMetal); arm.head.add(housing);
    arm.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color() });
    arm.lens = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .04, 24).rotateX(Math.PI / 2), arm.lensMat);
    arm.lens.position.z = .16; arm.head.add(arm.lens);
    arm.pose = { yaw: Math.PI, sh: .08, el: -2.7 };
  }
  car.position.set(4.2, .07, 0);
  scene.add(car);

  // flying cars between the towers
  const flyers = [];
  {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0c14, metalness: .7, roughness: .3 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.scale.setScalar(rr(1.4, 2.4));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, .32, .6), bodyMat));
      const dir = rand() < .5 ? 1 : -1;
      const light = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .62), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.4, 4.6) }));
      light.position.x = .8 * dir; g.add(light);
      const trail = new THREE.Mesh(new THREE.PlaneGeometry(9, .12), new THREE.ShaderMaterial({
        uniforms: { uColor: rand() < .5 ? T.neon : T.neon2, uDir: { value: dir } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uDir; varying vec2 vUv; void main(){ float t = uDir > 0. ? vUv.x : 1. - vUv.x; gl_FragColor = vec4(uColor * 1.6 * pow(t, 3.) * (1. - abs(vUv.y - .5) * 2.), 1.); }'
      }));
      trail.position.x = -dir * 5.3; g.add(trail);
      const z = rr(-120, -300), D = CAM.z - z;
      g.position.set(rr(-1, 1) * D * .8, rr(22, 48) * (D / 140 + .25), z);
      scene.add(g);
      flyers.push({ g, v: dir * rr(30, 60), span: 2.4 * D });
    }
  }

  // ------------------------------------------------------------------ light
  scene.add(new THREE.HemisphereLight(0x553a7a, 0x07060c, .7));
  const sunLight = new THREE.DirectionalLight(0xff7a3a, 3.2);
  scene.add(sunLight);
  const sweep = new THREE.PointLight(0x3fdcff, 60, 22, 2);
  scene.add(sweep);
  const belly = new THREE.PointLight(0xff2ad8, 8, 4, 2);
  scene.add(belly);
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = vP.y; float sun = pow(max(dot(vP, normalize(vec3(.28, .08, -1.))), 0.), 18.);
        vec3 c = mix(vec3(.5, .12, .14), vec3(.03, .02, .07), smoothstep(-.05, .45, h));
        c = mix(c, vec3(.01, .01, .02), smoothstep(0., -.4, h));
        gl_FragColor = vec4(c + vec3(1.2, .4, .08) * sun, 1.); }`
    })));
    const strip = (color, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    strip(new THREE.Color(.4, 3, 4), 0, 30, 10, 40, 1.5);
    strip(new THREE.Color(4, .4, 2.4), -35, 6, -20, 3, 12);
    strip(new THREE.Color(.4, 3, 4), 30, 4, 20, 2, 10);
    scene.environment = pmrem.fromScene(env, .02).texture;
  }

  // ------------------------------------------------------------------ projector beam (screen space, drawn before bloom so it glows)
  const overlay = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const beamGeo = new THREE.BufferGeometry();
  const BEAM_V = 3 * (6 + 8);
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEAM_V * 3), 3));
  beamGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BEAM_V * 4), 4));
  const beamMesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  beamMesh.frustumCulled = false;
  overlay.add(beamMesh);

  // ------------------------------------------------------------------ post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const overlayPass = new RenderPass(overlay, ortho);
  overlayPass.clear = false;
  composer.addPass(overlayPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .62, .42, .9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - .5; vec2 off = c * dot(c, c) * .012;
        vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        col *= mix(.55, 1., smoothstep(.62, .12, length(c * vec2(1., .9))));
        col += (h(vUv * 1000. + fract(uTime) * 91.) - .5) * .022;
        gl_FragColor = vec4(col, 1.);
      }`
  });
  composer.addPass(lens);

  // ------------------------------------------------------------------ layout
  let W = 1, H = 1, CX = 4.2, narrow = false;
  const mobile = matchMedia('(pointer: coarse)').matches;
  const v3 = new THREE.Vector3();
  const toScreen = (v, cam = camera) => { v3.copy(v).project(cam); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H }; };

  function resize() {
    W = Math.max(320, innerWidth); H = Math.max(320, innerHeight);
    const aspect = W / H;
    narrow = W <= 900;
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr);
    composer.setSize(W, H);
    const fov = Math.max(38, 2 * Math.atan((aspect < 1 ? .29 : .36) / aspect) * 180 / Math.PI);
    for (const c of [camera, restCam]) { c.fov = fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    // portrait: tilt the camera up until the road sits low on the screen (the panel needs the top)
    LOOK.y = 8;
    if (aspect < 1) {
      let lo = 8, hi = 80;
      for (let i = 0; i < 24; i++) {
        LOOK.y = (lo + hi) / 2;
        restCam.lookAt(LOOK); restCam.updateMatrixWorld();
        v3.set(0, .6, 0).project(restCam);
        if (v3.y > -.5) lo = LOOK.y; else hi = LOOK.y;
      }
    }
    restCam.lookAt(LOOK); restCam.updateMatrixWorld();
    ortho.right = W; ortho.top = H; ortho.updateProjectionMatrix();
    CX = aspect < 1 ? 0 : 4.2;
    const rs = mobile ? .35 : .5;
    reflector.getRenderTarget().setSize(Math.round(W * dpr * rs), Math.round(H * dpr * rs));
    layoutVars();
    if (trans) trans.R = rampGeometry();
    requestRender(300);
  }

  // where the panels may go: beside the car on wide screens, above it otherwise (same contract as the 2D drive)
  function layoutVars() {
    restCam.updateMatrixWorld();
    const pts = [];
    for (const x of [CX - 2.35, CX + 2.35]) for (const y of [0, 1.45]) for (const z of [-1, 1]) pts.push(toScreen(new THREE.Vector3(x, y, z), restCam));
    const rear = Math.min(...pts.map(p => p.x));
    const carTop = Math.min(...pts.map(p => p.y));
    const wallTop = toScreen(new THREE.Vector3(0, .95, -4.6), restCam).y;
    const gutter = clamp(W * .04, 16, 40);
    const rail = W > 1240 ? 104 : gutter;
    const side = !narrow && rear - gutter - 24 >= 600;
    let clear = side ? H - wallTop + 14 : H - carTop + 10;
    if (H < 520) clear = 60;
    root.dataset.layout = side ? 'side' : 'stack';
    root.style.setProperty('--road-clear', `${Math.round(clear)}px`);
    root.style.setProperty('--panel-r', `${Math.round(rail)}px`);
    root.style.setProperty('--panel-w', `${Math.round(side ? Math.min(960, rear - gutter - 24) : W - gutter - rail)}px`);
    root.style.setProperty('--panel-w-r', `${Math.round(side ? Math.min(960, rear - rail - 24) : W - gutter - rail)}px`);
  }

  // ------------------------------------------------------------------ the zigzag
  let stop = 0, trans = null;
  const L_DROP = () => (narrow ? 3.4 : 4.5);
  // in the upper level's frame, as if it drove right: car → ramp top (P1) → ramp foot (P2) → car on the level below
  function rampGeometry() {
    const x0 = CX, x3 = -CX;
    const xA = narrow ? 3.4 : CX + 3.6, xB = narrow ? .9 : .5;
    const L = L_DROP();
    const l1 = xA - x0, l2 = Math.hypot(xA - xB, L), l3 = xB - x3;
    return { x0, xA, xB, x3, L, l1, l2, l3, T: l1 + l2 + l3, ang: Math.atan2(L, xA - xB) };
  }
  function pathAt(R, q) {
    const d = q * R.T, w = .08 * R.T, c1 = R.l1, c2 = R.l1 + R.l2;
    let x, u;
    if (d <= c1) { x = R.x0 + d; u = 0; }
    else if (d <= c2) { u = (d - c1) / R.l2; x = lerp(R.xA, R.xB, u); }
    else { x = R.xB - (d - c2); u = 1; }
    const turn = smooth(c1 - w, c1 + w, d);
    return {
      x, u, yaw: Math.PI * turn,
      onRamp: smooth(c1 - .1 * R.T, c1 - .01 * R.T, d) * (1 - smooth(c2, c2 + .05 * R.T, d)),
      z: -1.6 * Math.sin(Math.PI * turn),                      // the U-turn swings out away from the camera
      pitch: -R.ang * smooth(c1 - w * .3, c1 + w, d) * (1 - smooth(c2 - w, c2 + w * .3, d))
    };
  }

  // ------------------------------------------------------------------ panel hologram helpers
  const raycaster = new THREE.Raycaster();
  const holoPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.3);   // z = .3: aim in the car's own plane, so the arm reads in profile
  function activePanel() { return document.querySelector('main > .stage.is-active .stage-panel.panel'); }
  // the panel's four corners on screen, including its CSS 3D tilt (stage perspective + rotate)
  function panelQuad(panel) {
    const w = panel.offsetWidth, h = panel.offsetHeight, stage = panel.parentElement;
    if (!w || !stage) return null;
    const cs = getComputedStyle(panel);
    let axis = 'y', deg = 0;
    if (cs.rotate && cs.rotate !== 'none') {
      const m = /(-?[\d.]+)deg/.exec(cs.rotate);
      deg = m ? +m[1] : 0;
      axis = /^x\b|^1 0 0/.test(cs.rotate) ? 'x' : 'y';
    }
    const Pp = parseFloat(getComputedStyle(stage).perspective) || 0;
    const ox = stage.clientWidth / 2, oy = stage.clientHeight / 2;
    const cx = panel.offsetLeft + w / 2, cy = panel.offsetTop + h / 2, th = deg * Math.PI / 180;
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([dx, dy]) => {
      let x = dx, y = dy, z = 0;
      if (axis === 'y') { x = dx * Math.cos(th); z = -dx * Math.sin(th); } else { y = dy * Math.cos(th); z = dy * Math.sin(th); }
      const s = Pp ? Pp / (Pp - z) : 1;
      return { x: ox + (cx + x - ox) * s, y: oy + (cy + y - oy) * s };
    });
  }

  // ------------------------------------------------------------------ theme
  const tmp = new THREE.Color();
  let sunX = SUN_X;
  function applyTheme(a, b, k) {
    for (const key of KEYS) T[key].value.lerpColors(PAL[a][key], PAL[b][key], k);
    wallTopMat.color.copy(T.neon.value).multiplyScalar(2.2);
    ramp.userData.edgeMat.color.copy(T.neon.value).multiplyScalar(2.4);
    sunLight.color.copy(T.sunA.value).multiplyScalar(.28);
    sweep.color.copy(T.lamp.value);
    arm.lensMat.color.copy(T.neon.value).multiplyScalar(3);
    for (const h of hazes) h.mat.uniforms.uColor.value.copy(T.fog.value).multiplyScalar(h.k);
  }
  function placeSun(x) {
    sunX = x;
    skyU.uSun.value.set(x, SUN_Y, SUN_R);
    const sp = new THREE.Vector3(x, SUN_Y, SUN_Z);
    shared.uSunDir.value.copy(sp).sub(CAM).normalize();
    sunLight.position.copy(sp).multiplyScalar(.1);
  }

  // ------------------------------------------------------------------ motion state
  let running = false, rafId = 0, lastTs = 0, renderUntil = 0;
  let t = 0, travel = 0, spin = 0, cloudT = 0;
  let speed = 26, boostHeld = false, pulse = 0, lastSpeed = 26;
  let worldFacing = 1, roadFacingShown = 1;
  let arrivedAt = performance.now(), deploy = 0;
  const reduce = () => reduceMotion.matches;

  function setFacing(f) {
    if (f === roadFacingShown) return;
    roadFacingShown = f;
    for (const c of traffic) { c.g.position.x = -c.g.position.x; c.g.rotation.y = f > 0 ? 0 : Math.PI; }
  }

  // everything that depends on where we are: at rest in a district, or somewhere on the ramp
  function pose(dt) {
    if (!trans) {
      const f = facingOf(stop);
      worldFacing = f;
      setFacing(f);
      road.position.y = 0;
      roadFade.value = 1;
      reflector.material.uniforms.uRefl.value = damp(reflector.material.uniforms.uRefl.value, 1, 5, dt || 1);
      ramp.visible = false;
      car.position.x = f * CX;
      car.position.z = Math.sin(t * .23) * .15;
      car.rotation.y = f > 0 ? 0 : Math.PI;
      car.rotation.z = clamp(-(speed - lastSpeed) / Math.max(dt, .016) * .0025, -.03, .03);
      placeSun(sunXFor(f));
      return;
    }
    const { lo, R } = trans;
    const q = trans.down ? easeInOut(trans.p) : 1 - easeInOut(trans.p);
    const fl = facingOf(lo);
    const p = pathAt(R, q);
    const L = R.L;
    const upper = p.u < .5;
    worldFacing = upper ? fl : -fl;
    setFacing(worldFacing);
    road.position.y = upper ? L * p.u : L * p.u - L;
    roadFade.value = upper ? 1 - smooth(0, .25, p.u) : smooth(.7, 1, p.u);
    reflector.material.uniforms.uRefl.value = roadFade.value * roadFade.value;
    for (const m of fadeables) m.opacity = roadFade.value;
    // the ramp, in the upper level's frame (mirrored when that level drives left)
    const top = new THREE.Vector3(fl * R.xA, L * p.u, 0), foot = new THREE.Vector3(fl * R.xB, L * p.u - L, 0);
    const rampA = p.onRamp;
    ramp.visible = rampA > .01;
    ramp.position.copy(top).add(foot).multiplyScalar(.5);
    ramp.scale.x = top.distanceTo(foot) + .6;
    ramp.rotation.z = Math.atan2(foot.y - top.y, foot.x - top.x);
    for (const m of Object.values(ramp.userData)) m.opacity = rampA;
    // the car rides the path; the camera stays level with it
    car.position.x = fl * p.x;
    car.position.z = p.z;
    car.rotation.y = (fl > 0 ? 0 : Math.PI) + p.yaw;
    car.rotation.z = p.pitch;
    const mix = smooth(.2, .8, q);
    applyTheme(lo, lo + 1, mix);
    placeSun(lerp(sunXFor(fl), sunXFor(-fl), smooth(.1, .9, q)));
  }

  function aimArm(dt) {
    const panel = !trans && stop > 0 ? activePanel() : null;
    const want = panel && performance.now() - arrivedAt > 450 ? 1 : 0;
    deploy = reduce() ? want : damp(deploy, want, want ? 3.2 : 7, dt);
    let target = { yaw: Math.PI, sh: .08, el: -2.7 };
    let quad = null, apex = null, near = null, far = null;
    if (panel) quad = panelQuad(panel);
    if (quad) {
      car.updateMatrixWorld(true);
      const lensWorld = arm.lens.getWorldPosition(new THREE.Vector3());
      apex = toScreen(lensWorld);
      const xs = quad.map(c => c.x);
      if (apex.x > Math.max(...xs)) { near = [quad[1], quad[2]]; far = [quad[0], quad[3]]; }
      else if (apex.x < Math.min(...xs)) { near = [quad[0], quad[3]]; far = [quad[1], quad[2]]; }
      else { near = [quad[3], quad[2]]; far = [quad[0], quad[1]]; }
      // aim the head at the near edge's middle, lifted into the scene just behind the car
      const mid = { x: (near[0].x + near[1].x) / 2, y: (near[0].y + near[1].y) / 2 };
      raycaster.setFromCamera(new THREE.Vector2(mid.x / W * 2 - 1, 1 - mid.y / H * 2), camera);
      const hit = raycaster.ray.intersectPlane(holoPlane, new THREE.Vector3());
      if (hit) {
        const local = arm.turret.parent.worldToLocal(hit.clone());
        const dx = local.x, dz = local.z, dy = local.y - .16;
        const yaw = Math.atan2(-dz, dx), up = Math.atan2(dy, Math.hypot(dx, dz));
        target = { yaw, sh: clamp(up + .7, .35, 1.5), el: -1.05, hit };
      }
    }
    // blend joints between stowed and aimed (yaw takes the short way round)
    const P0 = { yaw: Math.PI, sh: .08, el: -2.7 };
    const goal = { yaw: target.yaw, sh: lerp(P0.sh, target.sh, deploy), el: lerp(P0.el, target.el, deploy) };
    let dyaw = Math.atan2(Math.sin(goal.yaw - arm.pose.yaw), Math.cos(goal.yaw - arm.pose.yaw));
    if (deploy < .02) dyaw = Math.atan2(Math.sin(P0.yaw - arm.pose.yaw), Math.cos(P0.yaw - arm.pose.yaw));
    const rate = reduce() ? 1e3 : 6;
    arm.pose.yaw += dyaw * (1 - Math.exp(-rate * dt));
    arm.pose.sh = damp(arm.pose.sh, goal.sh, rate, dt);
    arm.pose.el = damp(arm.pose.el, goal.el, rate, dt);
    arm.turret.rotation.y = arm.pose.yaw;
    arm.shoulder.rotation.z = arm.pose.sh;
    arm.elbow.rotation.z = arm.pose.el;
    car.updateMatrixWorld(true);
    if (target.hit && deploy > .05) arm.head.lookAt(target.hit);
    else arm.head.rotation.set(0, Math.PI / 2, 0);
    // the beam: apex at the lens, a bright core onto the near edge, faint sides to the far edge, four rays
    const alpha = smooth(.75, 1, deploy) * (.9 + .1 * Math.sin(t * 37) * Math.sin(t * 13));
    const pos = beamGeo.attributes.position.array, col = beamGeo.attributes.color.array;
    pos.fill(0); col.fill(0);
    if (alpha > .01 && quad && apex) {
      car.updateMatrixWorld(true);
      apex = toScreen(arm.lens.getWorldPosition(new THREE.Vector3()));
      const c = T.neon.value;
      let vi = 0;
      const vert = (pt, a) => {
        pos[vi * 3] = pt.x; pos[vi * 3 + 1] = H - pt.y; pos[vi * 3 + 2] = 0;
        col[vi * 4] = c.r; col[vi * 4 + 1] = c.g; col[vi * 4 + 2] = c.b; col[vi * 4 + 3] = a * alpha;
        vi++;
      };
      const tri = (a, b, cc, aa, ab, ac) => { vert(a, aa); vert(b, ab); vert(cc, ac); };
      tri(apex, near[0], near[1], .55, .2, .2);                 // core onto the near edge
      tri(apex, near[0], far[0], .3, .12, .05);                // the cone's sides spread over the panel
      tri(apex, near[1], far[1], .3, .12, .05);
      tri(apex, far[0], far[1], .12, .04, .04);
      tri(near[0], far[0], far[1], .06, .02, .02);              // the projected light washing the panel
      tri(near[0], far[1], near[1], .06, .02, .06);
      for (const corner of [...near, ...far]) {
        const dx = corner.x - apex.x, dy = corner.y - apex.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len, wA = 1.6, wC = .6;
        const a1 = { x: apex.x + nx * wA, y: apex.y + ny * wA }, a2 = { x: apex.x - nx * wA, y: apex.y - ny * wA };
        const c1 = { x: corner.x + nx * wC, y: corner.y + ny * wC }, c2 = { x: corner.x - nx * wC, y: corner.y - ny * wC };
        const ra = near.includes(corner) ? .6 : .3;
        tri(a1, a2, c1, ra, ra, ra * .4); tri(a2, c2, c1, ra, ra * .4, ra * .4);
      }
    }
    beamGeo.attributes.position.needsUpdate = true;
    beamGeo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------------ frame
  const speedo = document.getElementById('speedo'), speedoBar = document.getElementById('speedo-bar'), gear = document.getElementById('gear');
  let hudT = 0;
  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    const now = ts || performance.now();
    const dt = Math.min(.05, (now - (lastTs || now)) / 1000);
    lastTs = now;
    const moving = running && !reduce();
    if (!moving && now > renderUntil && !trans) return;   // reduced motion: draw only when something changed
    const step = moving ? dt : 0;
    t += step;
    pulse = Math.max(0, pulse - step);
    let bump = 0, cruise = 1;
    if (trans) {
      trans.p = Math.min(1, trans.p + dt / trans.dur);
      bump = Math.sin(Math.PI * trans.p);
      cruise = 1 - smooth(0, .18, trans.p) * (1 - smooth(.82, 1, trans.p));
    }
    lastSpeed = speed;
    const base = 26, target = (boostHeld || pulse > 0 ? base * 2.6 : base) + bump * 18;
    speed = damp(speed, target, target > speed ? 1.6 : 1.1, step || dt);
    travel += speed * step * cruise * worldFacing;
    spin += speed * step * (trans && !trans.down ? -1 : 1);
    cloudT += step;
    shared.uTime.value = t;
    skyU.uCloudT.value = cloudT;
    reflector.material.uniforms.uTime.value = t;
    reflector.material.uniforms.uRoad.value = wrapMod(travel, 1000);
    lens.uniforms.uTime.value = t;
    for (const l of loops) l.u.uOffset.value = wrapMod(travel, l.span);

    pose(step || dt);
    car.position.y = .07 + (moving ? Math.sin(t * 9.3) * .006 + Math.sin(t * 2.1) * .004 : 0);
    for (const w of wheels) w.rotation.z = -spin / .43;
    const boostAmt = clamp((speed - 34) / 30);
    for (const tr of trails) tr.scale.x = 2.5 + boostAmt * 6;
    flame.visible = boostAmt > .05; flame.scale.set(1, .6 + boostAmt * 1.4 * (.8 + .2 * Math.sin(t * 60)), 1);
    belly.position.set(car.position.x, .25, car.position.z + .6);

    // the nearest streetlight sweeps over the car
    const off = lampLoop.u.uOffset.value;
    let best = 0, bestD = Infinity;
    for (const x0 of LAMPS) { const x = wrapMod(x0 - off + 48, 96) - 48, d = Math.abs(x - car.position.x); if (d < bestD) { bestD = d; best = x; } }
    sweep.position.set(best, road.position.y + LAMP_Y - .3, LAMP_Z);
    sweep.intensity = 60 * roadFade.value;

    for (const c of traffic) {
      c.g.position.x -= (speed + c.v) * step * worldFacing;
      if (c.g.position.x * worldFacing < -90) { c.g.position.x += 180 * worldFacing + rr(0, 40) * worldFacing; c.v = rr(18, 26); }
    }
    for (const f of flyers) {
      f.g.position.x += (f.v - speed * worldFacing) * step;
      const half = f.span / 2;
      if (f.g.position.x < -half) f.g.position.x += f.span;
      if (f.g.position.x > half) f.g.position.x -= f.span;
    }

    const sway = moving ? 1 : 0;
    const dip = trans ? -.35 * Math.sin(Math.PI * trans.p) : 0;
    camera.position.set(CAM.x + Math.sin(t * .11) * .35 * sway, CAM.y + Math.sin(t * .37) * .04 * sway + dip, CAM.z);
    camera.fov = restCam.fov + (trans ? 3 * Math.sin(Math.PI * trans.p) : 0) + boostAmt * 4;
    camera.updateProjectionMatrix();
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    shared.uCamPos.value.copy(camera.position);

    aimArm(step || dt);
    composer.render();

    if (trans) {
      const tr = trans;
      tr.onProgress?.(tr.p);
      if (tr.p >= 1) finish();
    }
    hudT += dt;
    if (speedo && hudT > .08) {
      hudT = 0;
      const kmh = Math.round(speed * 3.6);
      speedo.textContent = String(kmh).padStart(3, '0');
      if (speedoBar) speedoBar.style.transform = `scaleX(${Math.min(1, kmh / 260)})`;
      if (gear) gear.textContent = trans && !trans.down ? 'R' : 'D';
    }
  }
  function finish() {
    const tr = trans;
    trans = null;
    stop = tr.to;
    applyTheme(stop, stop, 0);
    for (const m of fadeables) m.opacity = 1;
    tr.resolve();
  }
  const requestRender = ms => { renderUntil = Math.max(renderUntil, performance.now() + ms); };
  function loopStart() { if (rafId) return; running = true; lastTs = 0; rafId = requestAnimationFrame(frame); }
  function loopStop() { running = false; cancelAnimationFrame(rafId); rafId = 0; }
  function land() {
    if (!trans) return;
    const tr = trans; trans = null; stop = tr.to;
    applyTheme(stop, stop, 0);
    for (const m of fadeables) m.opacity = 1;
    tr.onProgress?.(1); tr.resolve();
  }

  // ------------------------------------------------------------------ input (boost)
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
  document.addEventListener('stage:enter', () => { arrivedAt = performance.now(); requestRender(1500); });
  document.addEventListener('pointerover', e => { if (e.target instanceof Element && e.target.closest('.stage-panel')) requestRender(1200); }, { passive: true });
  document.addEventListener('pointerout', e => { if (e.target instanceof Element && e.target.closest('.stage-panel')) requestRender(1200); }, { passive: true });
  document.addEventListener('scroll', () => requestRender(200), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { loopStop(); land(); } else loopStart(); });
  addEventListener('resize', resize);

  // ------------------------------------------------------------------ the contract shared with drive.js, sunlight.js and main.js
  const sunScreen = i => {
    restCam.updateMatrixWorld();
    const c = new THREE.Vector3(sunXFor(facingOf(i)), SUN_Y, SUN_Z);
    const a = toScreen(c, restCam), b = toScreen(c.clone().add(new THREE.Vector3(SUN_R, 0, 0)), restCam);
    return { x: a.x, y: a.y, r: Math.abs(b.x - a.x) };
  };
  window.scene = {
    kind: '3d',
    get stop() { return stop; },
    get animated() { return running && !reduce() && !document.hidden; },
    accent: i => THEMES[i]?.ui,
    sunAt(i) {
      const th = THEMES[i];
      if (!th) return null;
      const n = parseInt(th.glow.slice(1), 16);
      return { ...sunScreen(i), rgb: `${n >> 16} ${(n >> 8) & 255} ${n & 255}` };
    },
    boost(seconds = 2.5) { pulse = seconds; },
    set(i) {
      if (!THEMES[i]) return;
      land();
      stop = i;
      applyTheme(i, i, 0);
      requestRender(600);
    },
    // one level down (i = stop + 1) or back up (i = stop - 1); resolves once the car has landed
    step(i, dur = 1.7, onProgress) {
      if (trans || !THEMES[i] || Math.abs(i - stop) !== 1) return Promise.resolve();
      return new Promise(resolve => {
        if (!this.animated) {
          stop = i; applyTheme(i, i, 0); requestRender(600);
          onProgress?.(1); resolve(); return;
        }
        const down = i > stop;
        trans = { lo: down ? stop : i, to: i, down, p: 0, dur, R: rampGeometry(), onProgress, resolve };
      });
    }
  };

  resize();
  stop = Math.max(0, window.drive?.index ?? 0);
  applyTheme(stop, stop, 0);
  placeSun(sunXFor(facingOf(stop)));
  loopStart();
  requestRender(1000);
  document.dispatchEvent(new CustomEvent('scene:ready', { detail: { kind: '3d' } }));
  return window.scene;
}
