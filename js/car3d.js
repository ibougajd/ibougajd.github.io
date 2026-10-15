// The car as a real 3D model, drawn in its own transparent layer exactly where the 2D drive (scene.js)
// puts its car. scene.js keeps the world, light trails, headlight beam and underglow, and hands this file
// the car's position, heading, tilt and wheel travel every frame; this file draws the body, spins the
// wheels and lights it in the colours of the district. If anything fails, the drawn 2D car stays.
// Model: "Cyberpunk car" by 4d_Bob (Sketchfab), CC BY 4.0, textures resized — credited in the footer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL = 'assets/models/cyberpunk-car.glb?v=20261015e';
const LENGTH_2D = 434;        // the 2D car's length in its own units (scene.js draws it 434 long, pivot at 215)
const GROUND_2D = 6;          // tyre bottom sits this far below the 2D pivot, in the same units
const VIEW_YAW = .2;          // turn the nose a little toward the viewer: reads as 3D, not a cut-out
const VIEW_PITCH = .1;        // and look down on it slightly, so the roof catches light

const root = document.documentElement;
const weak = navigator.connection?.saveData === true
  || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2)
  || /[?&]lite(?:[=&]|$)/.test(location.search);

async function main() {
  if (!root.classList.contains('drive') || weak) return;
  const base = document.getElementById('scene');
  if (!base) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'car3d';
  canvas.setAttribute('aria-hidden', 'true');
  base.after(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // pixel-space camera: x right, y up (screen y is negated), so positions come straight from the 2D drive
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -6000, 6000);
  camera.position.z = 3000;

  const gltf = await new GLTFLoader().loadAsync(MODEL);
  let src = null;
  gltf.scene.traverse(o => { if (o.isMesh && !src) src = o; });
  if (!src) throw new Error('car model has no mesh');
  const material = src.material;
  material.emissiveIntensity = Math.min(material.emissiveIntensity || 1, 4);
  material.envMapIntensity = .9;

  // ------------------------------------------------------------------ split the wheels out of the single mesh
  const geo = src.geometry;
  const { body, wheels } = splitWheels(geo);
  const carModel = new THREE.Group();                     // raw geometry: cm, y up, nose toward +z (the file's node matrices turn it 180°; we use the mesh alone)
  const bodyGeo = geo.clone(); bodyGeo.setIndex(body);
  carModel.add(new THREE.Mesh(bodyGeo, material));
  const wheelPivots = wheels.map(w => {
    const g = geo.clone(); g.setIndex(w.index);
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(-w.center.x, -w.center.y, -w.center.z);
    const pivot = new THREE.Group();
    pivot.position.copy(w.center);
    pivot.add(mesh);
    carModel.add(pivot);
    return { pivot, radius: w.radius };
  });
  for (const m of carModel.children) m.traverse?.(o => { if (o.isMesh) o.frustumCulled = false; });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const modelLen = bb.max.z - bb.min.z, modelMidZ = (bb.max.z + bb.min.z) / 2;

  // outer: screen position + screen-plane tilt · view: look down a little · heading: U-turns · scaled: cm → px
  const outer = new THREE.Group(), view = new THREE.Group(), heading = new THREE.Group(), scaled = new THREE.Group();
  view.rotation.x = VIEW_PITCH;
  scaled.add(carModel);
  carModel.position.z = -modelMidZ;
  heading.add(scaled); view.add(heading); outer.add(view);
  scene.add(outer);

  // ------------------------------------------------------------------ light: the district paints the car
  const hemi = new THREE.HemisphereLight(0x6a5a9a, 0x080610, 1.1);
  const sun = new THREE.DirectionalLight(0xff7a3a, 2.6);       // the district's sun, low and behind
  const rim = new THREE.DirectionalLight(0x05d9e8, 2.4);       // neon from the far side of the road
  const fill = new THREE.DirectionalLight(0xbfd8ff, .55);      // the street in front of the camera
  const under = new THREE.PointLight(0xd300c5, 6, 0, 0);       // the underglow scene.js draws on the road
  for (const l of [sun, rim, fill]) { l.target = outer; scene.add(l); }
  scene.add(hemi, under);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envFor = -1;
  function environment(glow, accent) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uGlow: { value: glow }, uAccent: { value: accent } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform vec3 uGlow; uniform vec3 uAccent; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 c = mix(uGlow * .5, vec3(.02, .015, .05), smoothstep(-.05, .5, h));
          c = mix(c, vec3(.01, .01, .02), smoothstep(0., -.5, h));
          c += uGlow * 2.5 * pow(max(dot(vP, normalize(vec3(-.6, .1, -1.))), 0.), 14.);
          c += uAccent * 1.8 * smoothstep(.97, 1., 1. - abs(h - .35) * 6.) * step(0., vP.z);
          gl_FragColor = vec4(c, 1.);
        }`
    })));
    const old = scene.environment;
    scene.environment = pmrem.fromScene(env, .02).texture;
    old?.dispose();
  }

  const colorCache = new Map();
  const colorsOf = i => {
    if (!colorCache.has(i)) {
      const s = window.scene?.sunAt?.(i);
      const glow = s ? new THREE.Color(...s.rgb.split(' ').map(n => +n / 255)) : new THREE.Color(0xff2a6d);
      const accent = new THREE.Color(window.scene?.accent?.(i) || '#05d9e8');
      colorCache.set(i, { glow: glow.convertSRGBToLinear(), accent: accent.convertSRGBToLinear() });
    }
    return colorCache.get(i);
  };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();

  // ------------------------------------------------------------------ sizing
  let W = 1, H = 1;
  function resize() {
    const r = base.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(base);
  resize();

  // ------------------------------------------------------------------ per frame, called by scene.js
  let shownAt = 0;
  function frame(c) {
    // c: { x, y, flip, tilt, k, spin, a, b, mix, sunX, sunY }
    if (!shownAt) { shownAt = performance.now(); canvas.classList.add('is-on'); }
    const sc = LENGTH_2D * c.k / modelLen;
    scaled.scale.setScalar(sc);
    scaled.position.y = -GROUND_2D * c.k;
    outer.position.set(c.x, -c.y, 0);
    outer.rotation.z = -c.tilt;
    // flip runs 1 → -1 through a U-turn: turn the model through the same half circle
    const angle = Math.acos(Math.max(-1, Math.min(1, c.flip)));
    heading.rotation.y = (Math.PI / 2 - VIEW_YAW) - angle * (Math.PI - 2 * VIEW_YAW) / Math.PI;
    for (const w of wheelPivots) w.pivot.rotation.x = c.spin / (w.radius * sc);

    // lights follow the district (blended while driving between two)
    const A = colorsOf(c.a), B = colorsOf(c.b);
    tmpA.lerpColors(A.glow, B.glow, c.mix); tmpB.lerpColors(A.accent, B.accent, c.mix);
    sun.color.copy(tmpA);
    rim.color.copy(tmpB);
    const key = c.mix < .5 ? c.a : c.b;
    if (key !== envFor) { envFor = key; const C = colorsOf(key); environment(C.glow, C.accent); }
    const toSun = Math.sign((c.sunX ?? c.x) - c.x) || 1;
    sun.position.set(c.x + toSun * 900, -c.y + 500, -900);
    rim.position.set(c.x - toSun * 700, -c.y + 300, -1200);
    fill.position.set(c.x, -c.y + 600, 1600);
    under.position.set(c.x, -c.y - 4 * c.k, 60);
    under.distance = 260 * c.k;

    renderer.render(scene, camera);
    // the drawn car keeps showing while this one fades in, then steps aside
    return performance.now() - shownAt > 520;
  }

  window.car3d = { frame };
  window.scene?.redraw?.();
  setTimeout(() => window.scene?.redraw?.(), 600);
}

// one mesh, 44 parts: tyres, rims and brake discs are separate pieces. Group them by wheel.
function splitWheels(geo) {
  const pos = geo.attributes.position.array, idx = geo.index.array, nv = pos.length / 3;
  const weld = new Int32Array(nv), keys = new Map();
  for (let i = 0; i < nv; i++) {
    const k = `${pos[i * 3].toFixed(1)},${pos[i * 3 + 1].toFixed(1)},${pos[i * 3 + 2].toFixed(1)}`;
    if (!keys.has(k)) keys.set(k, keys.size);
    weld[i] = keys.get(k);
  }
  const par = Int32Array.from({ length: keys.size }, (_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(weld[idx[t]]), b = find(weld[idx[t + 1]]), c = find(weld[idx[t + 2]]);
    par[b] = a; par[find(c)] = a;
  }
  const comp = new Int32Array(nv), boxes = new Map();
  for (let i = 0; i < nv; i++) {
    const r = find(weld[i]); comp[i] = r;
    let b = boxes.get(r);
    if (!b) boxes.set(r, b = new THREE.Box3());
    b.expandByPoint(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  }
  const size = new THREE.Vector3(), mid = new THREE.Vector3();
  const tyres = [];
  for (const [r, b] of boxes) {
    b.getSize(size);
    if (size.y > 70 && size.x < 45 && Math.abs(size.y - size.z) < 8) tyres.push({ r, center: b.getCenter(new THREE.Vector3()), radius: size.y / 2 });
  }
  const owner = new Map();         // component → wheel index
  for (const [r, b] of boxes) {
    b.getSize(size); b.getCenter(mid);
    if (size.y < 50 || size.x > 45 || Math.abs(size.y - size.z) > 8) continue;    // round, thin, wheel-sized
    let best = -1, bestD = 60;
    tyres.forEach((t, i) => { const d = mid.distanceTo(t.center); if (d < bestD) { bestD = d; best = i; } });
    if (best >= 0) owner.set(r, best);
  }
  const body = [], wheels = tyres.map(t => ({ center: t.center, radius: t.radius, index: [] }));
  for (let t = 0; t < idx.length; t += 3) {
    const w = owner.get(comp[idx[t]]);
    (w === undefined ? body : wheels[w].index).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return { body, wheels };
}

main().catch(err => console.warn('3D car unavailable, keeping the drawn car:', err));
