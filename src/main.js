// Zombie Yard — scene setup, camera, game loop, HUD, settings and auto-save.
import * as THREE from 'three';
import { state, load, save, wipe, carried, capacity, weapon, speed } from './state.js';
import { clamp, damp, fmtTime } from './util.js';
import { input, pollInput } from './input.js';
import { ensure as ensureAudio, sfx } from './audio.js';
import { createFx } from './fx.js';
import { createWorld, ZONES, TELE_B } from './world.js';
import { createItems } from './items.js';
import { createPlayer } from './player.js';
import { createProjectiles } from './projectiles.js';
import { createZombies } from './zombies.js';
import { createBuildings } from './buildings.js';
import { createFences } from './fences.js';
import { PADS } from './defs.js';

const $ = id => document.getElementById(id);
const hadSave = load();

// ---- renderer / scene / camera ----------------------------------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = state.settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8f0);
scene.fog = new THREE.Fog(0x9fd8f0, 70, 190);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6a8a5a, 1.0));
const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 110; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

let drs = 1, W = 1, H = 1;
function viewSize() { return { w: W, h: H }; }
function dprCap() { return state.settings.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2); }
function resize() {
  const r = canvas.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  renderer.setPixelRatio(dprCap() * drs);
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// ---- HUD ------------------------------------------------------------------------------------------------------------------
const hud = {
  toast(text, cls = '') {
    const box = $('toasts');
    const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 3300);
  },
  flashHurt() { const h = $('hurt'); h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 80); },
};

// ---- build the game ---------------------------------------------------------------------------------------------------------
const game = { scene, camera, renderer, hud, lastPad: null, save: () => { if (!resetting) save(); } };
let resetting = false;
game.endless = {
  active: false, score: 0, time: 0, justDied: false,
  get best() { return state.endless.best; },
  add(n) { if (this.active) this.score += n; },
  start() {
    this.active = true; this.score = 0; this.time = 0; this.justDied = false;
    hud.toast('♾️ Endless Survival! The horde never stops. Stay alive!', 'bad'); sfx.horn(); game.fx.addShake(0.4);
  },
  end(reason) {
    if (!this.active) return;
    this.active = false;
    const sc = Math.floor(this.score), rec = sc > state.endless.best;
    if (rec) { state.endless.best = sc; state.endless.bestTime = Math.floor(this.time); }
    state.endless.runs++;
    hud.toast(`${rec ? '🏆 New best! ' : ''}Endless run over: ${sc} points in ${fmtTime(this.time)}`, rec ? 'gold' : 'good');
    this.justDied = reason === 'died'; sfx.win(); game.save();
  },
  toggle() { this.active ? this.end('stopped') : this.start(); },
};
game.respawnPoint = () => { const e = game.endless; if (e.justDied && state.zoneUnlocked[4]) { e.justDied = false; return { x: TELE_B.x + 3.6, z: 0 }; } return { x: 0, z: 12 }; };
game.fx = createFx(scene, camera, viewSize);
game.world = createWorld(scene);
game.items = createItems(scene, game.fx);
game.player = createPlayer(scene, game);
game.projectiles = createProjectiles(scene, game);
game.zombies = createZombies(scene, game);
game.fences = createFences(scene, game);
game.buildings = createBuildings(scene, game);
game.player.x = 0; game.player.z = 13;
game.zombies.initialFill();

// ---- camera follow ------------------------------------------------------------------------------------------------------------
const focus = new THREE.Vector3(0, 0, 13), _sh = new THREE.Vector3();
focus.set(game.player.x, 0, game.player.z);
const _sky = new THREE.Color(), _hemi = new THREE.Color(), hemiLight = scene.children.find(o => o.isHemisphereLight);
function applyTheme(dt, snap) {
  const zn = ZONES[game.world.zoneAt(focus.x)], k = snap ? 1 : 1 - Math.exp(-1.6 * dt);
  _sky.set(zn.sky); scene.background.lerp(_sky, k); scene.fog.color.copy(scene.background);
  if (hemiLight) { _hemi.set(zn.hemi); hemiLight.groundColor.lerp(_hemi, k); }
}
const ZOOM = 1.28;                                    // >1 = camera further away (see more of the map)
function updateCamera(dt, snap) {
  const p = game.player, aspect = camera.aspect;
  const fit = clamp(1.3 / aspect, 1, 1.75);           // portrait iPad: pull back so the width still fits
  const hgt = 23 * ZOOM * fit, dep = 15 * ZOOM * fit;
  const k = snap ? 1 : 1 - Math.exp(-7 * dt);
  focus.x += (p.x + p.vx * 0.22 - focus.x) * k; focus.z += (p.z + p.vz * 0.22 - focus.z) * k;
  game.fx.shakeOffset(_sh);
  camera.position.set(focus.x + _sh.x, hgt + _sh.y, focus.z + dep + _sh.z);
  camera.lookAt(focus.x + _sh.x * 0.5, 0, focus.z + _sh.z * 0.5);
  camera.updateMatrixWorld();
  applyTheme(dt, snap);
  sun.position.set(focus.x - 14, 30, focus.z + 10); sun.target.position.set(focus.x, 0, focus.z);
}
updateCamera(0, true);

// ---- HUD update -------------------------------------------------------------------------------------------------------------------
const el = { meatTxt: $('meatTxt'), meatBar: $('meatBar'), hpBar: $('hpBar'), zoneTxt: $('zoneTxt'), waveTxt: $('waveTxt'), wavePill: $('wavePill'), coreWrap: $('coreBarWrap'), coreBar: $('coreBar'), resPill: $('resPill'), scrapTxt: $('scrapTxt'), energyTxt: $('energyTxt'), ionTxt: $('ionTxt'), bossWrap: $('bossWrap'), bossName: $('bossName'), bossFill: $('bossFill'), endPill: $('endlessPill'), endTxt: $('endlessTxt'), obj: $('objective'), objTxt: $('objTxt'), guide: $('guide') };
let lastHud = 0, lastObj = '';
function updateHud(dt) {
  const p = game.player;
  const c = carried(), cap = capacity();
  el.meatTxt.textContent = `${c}/${cap}`;
  el.meatBar.style.width = (c / cap * 100) + '%';
  el.meatTxt.style.color = c >= cap ? '#ffd24a' : '#fff';
  el.hpBar.style.width = (p.hp / p.maxHp * 100) + '%';
  const px = p.x;
  { const zi = game.world.zoneAt(px), q = ZONES[zi]; el.zoneTxt.textContent = Math.abs(px - q.cx) <= q.hx + 1 ? q.name : 'The Bridge'; }
  // extra resources
  const showRes = state.zoneUnlocked[2] || state.carry.scrap > 0 || state.energy > 0;
  el.resPill.style.display = showRes ? 'flex' : 'none';
  if (showRes) {
    el.scrapTxt.textContent = state.carry.scrap; el.energyTxt.textContent = state.energy;
    const ion = game.buildings.heavy.ion; el.ionTxt.textContent = ion.built ? `☄️ ${Math.max(0, Math.ceil(ion.cd))}s` : '';
  }
  // boss bar
  const boss = game.zombies.boss();
  if (boss) { el.bossWrap.style.display = 'block'; el.bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; el.bossName.textContent = '💀 Zombie Titan'; } else el.bossWrap.style.display = 'none';
  // endless
  const E = game.endless;
  if (E.active) { el.endPill.style.display = 'flex'; el.endTxt.textContent = `♾️ ${Math.floor(E.score)} · ${fmtTime(E.time)} · best ${Math.max(E.best, Math.floor(E.score))}`; } else el.endPill.style.display = 'none';
  const w = game.zombies.wave;
  if (w.active) {
    el.waveTxt.textContent = `🧟 Wave ${w.num}: ${Math.max(0, w.left)} left`; el.wavePill.classList.add('alert');
    el.coreWrap.style.display = 'block'; el.coreBar.style.width = (game.buildings.core.hp / game.buildings.core.maxHp * 100) + '%';
  } else {
    el.waveTxt.textContent = `🧟 Horde in ${fmtTime(w.timer)}`; el.wavePill.classList.toggle('alert', w.timer <= 10); el.coreWrap.style.display = 'none';
  }
  // objective + guide arrow (every few frames is plenty)
  lastHud -= dt;
  if (lastHud <= 0) {
    lastHud = 0.15;
    const o = game.buildings.objective();
    if (o.text !== lastObj) { lastObj = o.text; el.objTxt.textContent = o.text; }
    el.obj.classList.add('show');
    game._objPad = o.pad;
  }
  const op = game._objPad;
  if (op && carried() > 0) {
    const s = game.fx.project(op.x, 1, op.z);
    const { w: vw, h: vh } = viewSize();
    if (s) {
      const m = 46, off = s.x < m || s.x > vw - m || s.y < m + 40 || s.y > vh - m;
      if (off) {
        const cx = vw / 2, cy = vh / 2, dx = s.x - cx, dy = s.y - cy;
        const k = Math.min((vw / 2 - m) / Math.abs(dx || 1e-3), (vh / 2 - m - 20) / Math.abs(dy || 1e-3));
        el.guide.style.left = (cx + dx * k) + 'px'; el.guide.style.top = (cy + dy * k) + 'px';
        el.guide.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`; el.guide.classList.add('show');
      } else el.guide.classList.remove('show');
    } else el.guide.classList.remove('show');
  } else el.guide.classList.remove('show');
}

// ---- settings / stats modals --------------------------------------------------------------------------------------------------------
let modalOpen = false;
const setModal = (id, open) => { $(id).classList.toggle('hidden', !open); modalOpen = !$('settings').classList.contains('hidden') || !$('stats').classList.contains('hidden'); if (modalOpen) { input.x = input.z = 0; } };
function refreshToggles() {
  const s = state.settings;
  const set = (id, on, a = 'ON', b = 'OFF') => { const e = $(id); e.textContent = on ? a : b; e.classList.toggle('on', on); };
  set('optSound', s.sound); set('optWake', s.wake); set('optQuality', s.quality !== 'low', 'High', 'Low');
}
function renderStats() {
  const w = weapon(), t = state.playTime, rows = [
    ['Backpack', `${capacity()} items (Lv ${state.packLvl + 1})`], ['Bow', `${w.name} Lv ${w.lvl} — ${w.dmg}${w.pellets > 1 ? '×' + w.pellets : ''} dmg, ${w.rate.toFixed(1)}/s`], ['Move speed', `${speed().toFixed(1)} (boots Lv ${state.bootsLvl})`],
    ['Zombies killed', state.kills], ['Meat collected', state.totalMeat], ['Hordes beaten', `${state.wavesCleared} (next: wave ${state.waveNum + 1})`],
    ['Zones unlocked', state.zoneUnlocked.filter(Boolean).length + ' / 5'], ['Energy cells', state.energy], ['Armor vest', `Lv ${state.vestLvl} (${100 + 25 * state.vestLvl} HP)`], ['Gun turrets', game.buildings.turretCount(-1)], ['Collector bots', game.buildings.bots.length], ['AI gunners', state.gunners], ['Endless best', `${state.endless.best} pts (${state.endless.runs} runs)`], ['Times overrun', state.deaths],
    ['Play time', `${Math.floor(t / 3600)}h ${Math.floor(t / 60) % 60}m`],
  ];
  $('statsBody').innerHTML = rows.map(r => `<div class="row stat"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}
$('btnSettings').addEventListener('click', () => { ensureAudio(); sfx.tap(); refreshToggles(); setModal('settings', true); });
$('closeSettings').addEventListener('click', () => { sfx.tap(); setModal('settings', false); resetBtn(false); });
$('btnStats').addEventListener('click', () => { ensureAudio(); sfx.tap(); renderStats(); setModal('stats', true); });
$('closeStats').addEventListener('click', () => { sfx.tap(); setModal('stats', false); });
$('optSound').addEventListener('click', () => { state.settings.sound = !state.settings.sound; ensureAudio(); sfx.tap(); refreshToggles(); save(); });
$('optWake').addEventListener('click', () => { state.settings.wake = !state.settings.wake; refreshToggles(); save(); state.settings.wake ? requestWake() : releaseWake(); });
$('optQuality').addEventListener('click', () => {
  state.settings.quality = state.settings.quality === 'low' ? 'high' : 'low';
  renderer.shadowMap.enabled = state.settings.quality !== 'low'; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  drs = 1; resize(); refreshToggles(); save();
});
$('btnSaveNow').addEventListener('click', () => { const ok = save(); const b = $('btnSaveNow'); b.textContent = ok ? 'Saved ✓' : 'Failed'; setTimeout(() => (b.textContent = 'Save now'), 1200); });
let resetArmed = false, resetTimer = 0;
function resetBtn(armed) { resetArmed = armed; const b = $('btnReset'); b.textContent = armed ? 'Tap again to erase!' : 'Reset Save'; clearTimeout(resetTimer); if (armed) resetTimer = setTimeout(() => resetBtn(false), 3500); }
$('btnReset').addEventListener('click', () => {
  if (!resetArmed) { resetBtn(true); return; }
  resetting = true; wipe(); location.reload();
});

// ---- wake lock (keep the iPad awake while playing) -----------------------------------------------------------------------------------------
let wake = null;
async function requestWake() { try { if (state.settings.wake && 'wakeLock' in navigator && !wake && !document.hidden) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } } catch (e) { wake = null; } }
function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }

// ---- audio unlock on the first touch ----------------------------------------------------------------------------------------------------------
['pointerdown', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, () => { ensureAudio(); requestWake(); }, { passive: true }));

// ---- game loop ---------------------------------------------------------------------------------------------------------------------------------
let last = performance.now(), saveT = 0, tTotal = 0, frameErrs = 0, avg = 16.7, drsT = 0, started = false;
function tick(dt) {
  tTotal += dt;
  pollInput();
  const p = game.player;
  p.update(dt, input);
  updateCamera(dt);
  game.zombies.update(dt);
  game.buildings.update(dt, tTotal);
  game.projectiles.update(dt);
  game.items.update(dt, p);
  game.world.update(dt, tTotal);
  game.fx.update(dt);
  if (game.camSnap) { game.camSnap = false; updateCamera(0, true); }
  if (game.endless.active) { game.endless.time += dt; game.endless.score += dt * 1.5; }
  updateHud(dt);
  state.playTime += dt;
  saveT += dt; if (saveT >= 5) { saveT = 0; game.save(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05);
  // adaptive resolution: drop the render scale if the iPad can't hold ~45 fps, creep back up when it has headroom
  avg += (dt * 1000 - avg) * 0.05; drsT += dt;
  if (drsT > 1.5 && !modalOpen) {
    drsT = 0;
    if (avg > 24 && drs > 0.62) { drs = Math.max(0.62, drs - 0.12); resize(); }
    else if (avg < 15 && drs < 1) { drs = Math.min(1, drs + 0.06); resize(); }
  }
  try {
    if (!window.__paused && !modalOpen && !document.hidden) tick(dt);
    renderer.render(scene, camera);
    if (!started) { started = true; const b = $('boot'); b.classList.add('gone'); setTimeout(() => b.remove(), 600); if (!hadSave) hud.toast('Shoot zombies, collect 🥩, stand on glowing pads to build!', 'gold'); }
  } catch (e) { if (frameErrs++ < 3) console.error(e); }
}
requestAnimationFrame(frame);

canvas.addEventListener('webglcontextlost', e => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden) { game.save(); releaseWake(); } else { last = performance.now(); ensureAudio(); requestWake(); } });
window.addEventListener('pagehide', () => game.save());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// handy for testing in a desktop browser console (and for the bot runs)
window.__dbg = { game, state, THREE, tick, PADS, input, updateCamera, resize, get drs() { return drs; } };
