// Real 3D towers for the 2D drive's skyline. The model is sliced into its separate towers once; then, for each
// district, scene.js asks for a far and a near strip and this file renders them from the towers (turned,
// stretched and spaced at random, lit by that district's sun, windows tinted its colour) into a flat image
// that tiles seamlessly. scene.js scrolls those images exactly like its old drawn buildings, so the 3D costs
// nothing per frame. If anything fails, the drawn buildings stay.
// Model: "Low Poly Night City Building Skyline" by 99.Miles (Sketchfab), CC BY 4.0, unmodified file — credited in the footer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL = 'assets/models/skyline.glb?v=20261015i';
const root = document.documentElement;
const weak = navigator.connection?.saveData === true
  || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2)
  || /[?&]lite(?:[=&]|$)/.test(location.search);

async function main() {
  if (!root.classList.contains('drive') || weak) return;

  const gltf = await new GLTFLoader().loadAsync(MODEL);
  let src = null;
  gltf.scene.traverse(o => { if (o.isMesh && !src) src = o; });
  if (!src) throw new Error('skyline model has no mesh');
  const towers = sliceTowers(src.geometry);
  if (towers.length < 4) throw new Error('could not find the towers in the skyline model');
  const tallest = Math.max(...towers.map(t => t.height));

  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const baseMat = src.material;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'clearcoatMap', 'clearcoatNormalMap']) if (baseMat[k]) baseMat[k].anisotropy = aniso;
  baseMat.side = THREE.DoubleSide;     // the model has inward-facing faces: single-sided would leave holes
  const mats = { far: baseMat.clone(), near: baseMat.clone() };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  camera.position.z = 2500;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, .6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  const fill = new THREE.DirectionalLight(0x9fb8ff, .35);
  scene.add(hemi, sun, fill, sun.target, fill.target);
  const holder = new THREE.Group();
  scene.add(holder);

  const rgb = s => new THREE.Color(...s.split(',').map(n => +n / 255));
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // p: { index, far, th, tileW, tileH, ground (y of the horizon inside the tile), minH, maxH (px), dpr, sunSide (+1 right / -1 left), seed }
  function tile(p) {
    const r = rng(p.seed * 7919 + (p.far ? 3 : 5));
    const th = p.th, mat = p.far ? mats.far : mats.near;
    // windows: the photo-lit facades, nudged toward the district's window colour
    mat.emissive.copy(new THREE.Color(1, 1, 1).lerp(rgb(th.win), .5)).multiplyScalar(p.far ? .75 : 1.15);
    mat.color.setScalar(p.far ? .55 : .8);
    hemi.color.set(th.sky[1]); hemi.groundColor.set(th.sky[0]); hemi.intensity = p.far ? .5 : .7;
    sun.color.set(th.glow); sun.intensity = p.far ? 1.6 : 2.4;
    fill.intensity = p.far ? .2 : .35;

    renderer.setPixelRatio(p.dpr);
    renderer.setSize(p.tileW, p.tileH, false);
    camera.left = 0; camera.right = p.tileW; camera.top = 0; camera.bottom = -p.tileH;
    camera.updateProjectionMatrix();
    sun.position.set(p.tileW / 2 + p.sunSide * 3000, -p.ground + 1200, -2500);
    sun.target.position.set(p.tileW / 2, -p.ground, 0);
    fill.position.set(p.tileW / 2, -p.ground + 800, 3000);
    fill.target.position.set(p.tileW / 2, -p.ground, 0);

    // scale so the tallest tower reaches the layer's top height; shorter towers keep their natural height
    const unit = p.maxH / tallest;
    const signs = [];
    holder.clear();
    // landmarks (the tallest towers) at most once per strip, and never the same tower twice within four
    const ranked = towers.map((t, i) => i).sort((a, b) => towers[b].height - towers[a].height);
    const landmarks = new Set(ranked.slice(0, 2));
    let landmarkUsed = false;
    const recent = [];
    let x = r() * 30;
    while (x < p.tileW) {
      let pick, tries = 0;
      do { pick = Math.floor(r() * towers.length); tries++; }
      while (tries < 30 && (recent.includes(pick) || (landmarks.has(pick) && landmarkUsed)));
      if (landmarks.has(pick)) landmarkUsed = true;
      recent.push(pick); if (recent.length > 4) recent.shift();
      const t = towers[pick];
      const stretch = .9 + r() * .2;
      const sc = unit * (.8 + r() * .2);
      const yaw = (r() < .5 ? -1 : 1) * (.25 + r() * .45);
      const halfW = Math.max(t.w, t.d) * sc * .6;
      const depth = (r() - .5) * 400;
      const place = cx => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(t.geo, mat);
        m.rotation.x = -Math.PI / 2;                       // the model is Z-up
        m.position.set(-t.cx, -t.base, t.cy);
        g.add(m);
        g.scale.set(sc, sc * stretch, sc);
        g.rotation.y = yaw;
        g.position.set(cx, -p.ground, depth);
        holder.add(g);
      };
      place(x);
      if (x - halfW < 0) place(x + p.tileW);              // wrap so the strip tiles without a seam
      if (x + halfW > p.tileW) place(x - p.tileW);
      const hPx = t.height * sc * stretch;
      if (hPx > p.minH * .8 && r() < .5) signs.push({ x, y: p.ground - hPx, h: hPx, antenna: r() < .45, k: Math.floor(r() * 1000) });
      x += halfW * (1.1 + r() * .7);
    }
    renderer.render(scene, camera);

    const out = document.createElement('canvas');
    out.width = Math.round(p.tileW * p.dpr); out.height = Math.round(p.tileH * p.dpr);
    const g = out.getContext('2d');
    g.drawImage(glCanvas, 0, 0, out.width, out.height);
    // atmosphere: the far row sinks into the sky's haze, both fade a little toward their feet
    g.globalCompositeOperation = 'source-atop';
    const haze = g.createLinearGradient(0, 0, 0, out.height);
    const low = th.sky[2];
    haze.addColorStop(0, hexA(low, p.far ? .35 : .08));
    haze.addColorStop(1, hexA(low, p.far ? .55 : .2));
    g.fillStyle = haze; g.fillRect(0, 0, out.width, out.height);
    return { canvas: out, signs };
  }

  window.city3d = { tile };
  window.scene?.rebuildCity?.();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// one mesh: ~13 towers plus their rooftop pieces (caps, rails, signs). Group every piece with the tower under it.
function sliceTowers(geo) {
  const pos = geo.attributes.position.array, idx = geo.index.array, nv = pos.length / 3;
  const weld = new Int32Array(nv), keys = new Map();
  for (let i = 0; i < nv; i++) {
    const k = `${pos[i * 3].toFixed(3)},${pos[i * 3 + 1].toFixed(3)},${pos[i * 3 + 2].toFixed(3)}`;
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
  const towers = [];
  for (const [r, b] of boxes) {
    b.getSize(size);
    if (size.z > 3.5 && Math.min(size.x, size.y) > 1.5) towers.push({ r, box: b.clone() });
  }
  const owner = new Map();
  for (const [r, b] of boxes) {
    const own = towers.findIndex(t => t.r === r);
    if (own >= 0) { owner.set(r, own); continue; }
    b.getCenter(mid);
    const i = towers.findIndex(t => mid.x > t.box.min.x - .3 && mid.x < t.box.max.x + .3 && mid.y > t.box.min.y - .3 && mid.y < t.box.max.y + .3);
    if (i >= 0) { owner.set(r, i); towers[i].box.union(b); }
  }
  const lists = towers.map(() => []);
  for (let t = 0; t < idx.length; t += 3) {
    const w = owner.get(comp[idx[t]]);
    if (w !== undefined) lists[w].push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return towers.map((t, i) => {
    const g = new THREE.BufferGeometry();          // shares the model's vertex data, own index
    for (const [k, v] of Object.entries(geo.attributes)) g.setAttribute(k, v);
    g.setIndex(lists[i]);
    const b = t.box;
    return {
      geo: g,
      cx: (b.min.x + b.max.x) / 2, cy: (b.min.y + b.max.y) / 2, base: b.min.z,
      height: b.max.z - b.min.z, w: b.max.x - b.min.x, d: b.max.y - b.min.y
    };
  });
}

main().catch(err => console.warn('3D skyline unavailable, keeping the drawn buildings:', err));
