// Floating virtual joystick (touch / mouse) + WASD / arrow keys. Output: input.x, input.z in -1..1 (world axes: screen-up = -z).
export const input = { x: 0, z: 0, active: false, anyTouch: false };

const joy = document.getElementById('joy');
const base = document.getElementById('joyBase');
const knob = document.getElementById('joyKnob');
const RADIUS = 55;
let pid = null, ox = 0, oy = 0;
const keys = new Set();

function ignore(target) { return !!(target && target.closest && target.closest('button, .modal, #boot')); }

function begin(e) {
  if (pid !== null || ignore(e.target)) return;
  pid = e.pointerId; ox = e.clientX; oy = e.clientY;
  base.style.left = knob.style.left = ox + 'px';
  base.style.top = knob.style.top = oy + 'px';
  joy.classList.add('on'); input.anyTouch = true;
  try { document.getElementById('game').setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
}
function move(e) {
  if (e.pointerId !== pid) return;
  let dx = e.clientX - ox, dy = e.clientY - oy;
  const len = Math.hypot(dx, dy);
  const k = len > RADIUS ? RADIUS / len : 1;
  knob.style.left = (ox + dx * k) + 'px'; knob.style.top = (oy + dy * k) + 'px';
  const m = Math.min(1, len / RADIUS);
  const dead = m < 0.12 ? 0 : (m - 0.12) / 0.88;
  input.x = len > 0 ? (dx / len) * dead : 0; input.z = len > 0 ? (dy / len) * dead : 0;
  e.preventDefault();
}
export function joyReset() {
  pid = null; input.x = input.z = 0; joy.classList.remove('on');
}
function end(e) { if (e.pointerId === pid) joyReset(); }

const canvas = document.getElementById('game');
window.addEventListener('pointerdown', begin, { passive: false });
window.addEventListener('pointermove', move, { passive: false });
window.addEventListener('pointerup', end);
window.addEventListener('pointercancel', end);
canvas.addEventListener('lostpointercapture', end);
window.addEventListener('blur', () => { keys.clear(); joyReset(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); joyReset(); } });

// Stop Safari gestures: pinch-zoom, double-tap zoom, context menu, pull-to-refresh, text selection.
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => { if (!(e.target && e.target.closest && e.target.closest('input'))) e.preventDefault(); });
document.addEventListener('touchmove', e => { if (!(e.target.closest && e.target.closest('.modal'))) e.preventDefault(); }, { passive: false });
let lastTap = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTap < 350 && !ignore(e.target)) e.preventDefault(); lastTap = n; }, { passive: false });

const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
window.addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (k) { keys.add(k); e.preventDefault(); } });
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });

/** Call once per frame. Keyboard overrides only while the joystick is idle. */
export function pollInput() {
  if (pid === null) {
    let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), z = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    const l = Math.hypot(x, z);
    if (l > 0) { x /= l; z /= l; }
    if (!window.__botInput) { input.x = x; input.z = z; }
  }
  input.active = Math.abs(input.x) + Math.abs(input.z) > 0.01;
}
