// Picks the background: the 3D night drive (world3d.js, WebGL) or the original 2D drive (scene2d.js) for
// devices that can't or shouldn't run 3D: no WebGL, data saver, very little memory, the 3D library failing
// to load, or ?lite in the address. Either one ends up as window.scene and announces itself with 'scene:ready'.
const V = '20261015c';
const canvas = document.getElementById('scene');

function load2D() {
  if (window.scene) return;
  // a canvas that tried WebGL can't be reused for 2D: swap in a fresh one
  const old = document.getElementById('scene');
  if (old) { const fresh = old.cloneNode(false); old.replaceWith(fresh); }
  const s = document.createElement('script');
  s.src = `js/scene2d.js?v=${V}`;
  document.head.append(s);
}
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
const lite = /[?&]lite(?:[=&]|$)/.test(location.search)
  || navigator.connection?.saveData === true
  || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2);

if (canvas && document.documentElement.classList.contains('drive')) {
  if (lite || !hasWebGL()) load2D();
  else {
    import(`./world3d.js?v=${V}`)
      .then(m => m.start(canvas))
      .catch(err => { console.warn('3D drive unavailable, using the 2D drive:', err); load2D(); });
  }
}
