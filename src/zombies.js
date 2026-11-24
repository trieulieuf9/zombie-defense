// Zombie types, AI, pooling, population control and the 90-second base-defence hordes.
import * as THREE from 'three';
import { state } from './state.js';
import { mergeParts, vcMat, limbMaterial, limbDepth, setLimb, rnd, rndi, pick, damp, angLerp, clamp, TAU } from './util.js';
import { CORE } from './world.js';
import { zombieGeo } from './models.js';
import { sfx } from './audio.js';

const TYPES = {
  shambler: { hp: 10, speed: 2.1, dmg: 8, atkRate: 1.1, range: 1.5, r: 0.65, drop: [1, 1], aggro: 13, pool: 44, color: 0x9bd05a },
  runner: { hp: 8, speed: 5.0, dmg: 7, atkRate: 0.9, range: 1.4, r: 0.55, drop: [2, 2], aggro: 17, pool: 36, color: 0xc44a3a },
  riot: { hp: 42, speed: 2.0, dmg: 15, atkRate: 1.2, range: 1.6, r: 0.78, drop: [4, 4], scrap: [1, 1], aggro: 14, pool: 30, color: 0x5a6a8a, armor: 0.55, score: 25 },
  brute: { hp: 260, speed: 2.7, dmg: 30, atkRate: 1.5, range: 2.4, r: 1.2, scale: 1.6, drop: [15, 15], scrap: [5, 5], aggro: 18, pool: 8, color: 0x9a6a4a, armor: 0.25, slam: { r: 3.8, dmg: 22, every: 5, wind: 0.85 }, mini: true, score: 150 },
  swarm: { hp: 4, speed: 5.8, dmg: 3, atkRate: 0.6, range: 0.9, r: 0.38, drop: [1, 1], dropChance: 0.5, aggro: 19, pool: 48, color: 0x7fff3a, score: 3 },
  titan: { hp: 1100, speed: 2.2, dmg: 45, atkRate: 1.8, range: 3.2, r: 1.9, scale: 2.6, drop: [40, 40], scrap: [15, 15], aggro: 34, pool: 3, color: 0x7a3a8a, armor: 0.35, slam: { r: 6.5, dmg: 35, every: 6, wind: 1.1 }, boss: true, score: 800 },
  spitter: { hp: 12, speed: 2.3, dmg: 11, atkRate: 2.7, range: 1.4, r: 0.72, drop: [2, 2], aggro: 16, pool: 18, color: 0x8a5ac0, ranged: true, shoot: 12.5, keep: 8 },
};

function buildGeo(type) {
  if (type === 'riot') return mergeParts([
    { t: 'box', s: [0.32, 0.7, 0.36], p: [-0.2, 0.35, 0], c: 0x33384a }, { t: 'box', s: [0.32, 0.7, 0.36], p: [0.2, 0.35, 0], c: 0x33384a },
    { t: 'box', s: [0.98, 0.95, 0.6], p: [0, 1.15, 0], c: 0x4a5878 }, { t: 'box', s: [0.7, 0.4, 0.1], p: [0, 1.25, 0.32], c: 0x2f3a52 },
    { t: 'box', s: [0.56, 0.52, 0.54], p: [0, 1.88, 0.02], c: 0x9bd05a }, { t: 'box', s: [0.7, 0.3, 0.66], p: [0, 2.12, 0], c: 0x2a3550 },
    { t: 'box', s: [0.5, 0.18, 0.08], p: [0, 1.95, 0.32], c: 0x8fd0ff },
    { t: 'box', s: [1.0, 1.35, 0.14], p: [0, 1.15, 0.78], c: 0x3a4a6a }, { t: 'box', s: [1.0, 0.18, 0.16], p: [0, 1.55, 0.78], c: 0xe0b020 },
    { t: 'box', s: [0.22, 0.22, 0.6], p: [-0.55, 1.2, 0.45], c: 0x9bd05a }, { t: 'box', s: [0.22, 0.22, 0.6], p: [0.55, 1.2, 0.45], c: 0x9bd05a },
  ]);
  if (type === 'brute') return mergeParts([
    { t: 'box', s: [0.4, 0.8, 0.45], p: [-0.35, 0.4, 0], c: 0x5a4a3a }, { t: 'box', s: [0.4, 0.8, 0.45], p: [0.35, 0.4, 0], c: 0x5a4a3a },
    { t: 'box', s: [1.5, 1.25, 0.95], p: [0, 1.4, -0.05], c: 0x8a6a4a }, { t: 'sph', s: [0.35], p: [-0.5, 1.55, 0.45], c: 0xd96a8a }, { t: 'sph', s: [0.28], p: [0.45, 1.0, 0.45], c: 0xd96a8a },
    { t: 'box', s: [0.55, 0.5, 0.55], p: [0, 2.25, 0.2], c: 0x9bd05a }, { t: 'box', s: [0.12, 0.1, 0.08], p: [-0.14, 2.3, 0.5], c: 0xfff23a }, { t: 'box', s: [0.12, 0.1, 0.08], p: [0.14, 2.3, 0.5], c: 0xfff23a },
    { t: 'box', s: [0.55, 0.5, 1.1], p: [-1.0, 1.1, 0.5], c: 0x9bd05a }, { t: 'box', s: [0.55, 0.5, 1.1], p: [1.0, 1.1, 0.5], c: 0x9bd05a },
    { t: 'cone', s: [0.2, 0.7, 5], p: [-0.4, 2.2, -0.5], r: [-0.5, 0, 0], c: 0xe8dcc0 }, { t: 'cone', s: [0.2, 0.7, 5], p: [0.4, 2.2, -0.5], r: [-0.5, 0, 0], c: 0xe8dcc0 }, { t: 'cone', s: [0.22, 0.8, 5], p: [0, 2.3, -0.55], r: [-0.5, 0, 0], c: 0xe8dcc0 },
  ]);
  if (type === 'swarm') return mergeParts([
    { t: 'sph', s: [0.34], p: [0, 0.34, 0], c: 0x7fff3a }, { t: 'sph', s: [0.22], p: [0, 0.4, 0.3], c: 0x4fc01a },
    { t: 'box', s: [0.08, 0.08, 0.06], p: [-0.1, 0.5, 0.48], c: 0xff3a2a }, { t: 'box', s: [0.08, 0.08, 0.06], p: [0.1, 0.5, 0.48], c: 0xff3a2a },
    { t: 'box', s: [0.7, 0.05, 0.05], p: [0, 0.12, 0.15], r: [0, 0.5, 0], c: 0x2a3a1a }, { t: 'box', s: [0.7, 0.05, 0.05], p: [0, 0.12, -0.1], r: [0, -0.5, 0], c: 0x2a3a1a }, { t: 'box', s: [0.7, 0.05, 0.05], p: [0, 0.12, 0.0], c: 0x2a3a1a },
  ]);
  if (type === 'titan') return mergeParts([
    { t: 'box', s: [0.45, 0.9, 0.5], p: [-0.4, 0.45, 0], c: 0x3a2a4a }, { t: 'box', s: [0.45, 0.9, 0.5], p: [0.4, 0.45, 0], c: 0x3a2a4a },
    { t: 'box', s: [1.7, 1.4, 1.0], p: [0, 1.6, 0], c: 0x4a2a5a }, { t: 'box', s: [0.9, 0.12, 0.1], p: [0, 1.7, 0.52], c: 0xff4d7a }, { t: 'box', s: [0.12, 0.8, 0.1], p: [0.2, 1.5, 0.52], c: 0xff4d7a },
    { t: 'box', s: [0.7, 0.6, 0.65], p: [0, 2.65, 0.15], c: 0x9a8aa8 }, { t: 'box', s: [0.16, 0.14, 0.1], p: [-0.17, 2.7, 0.5], c: 0xffe14d }, { t: 'box', s: [0.16, 0.14, 0.1], p: [0.17, 2.7, 0.5], c: 0xffe14d },
    { t: 'cone', s: [0.14, 0.9, 5], p: [-0.38, 3.2, 0.1], r: [0, 0, 0.35], c: 0xe8dcc0 }, { t: 'cone', s: [0.14, 0.9, 5], p: [0.38, 3.2, 0.1], r: [0, 0, -0.35], c: 0xe8dcc0 },
    { t: 'box', s: [0.6, 0.6, 1.3], p: [-1.15, 1.2, 0.5], c: 0x7a6a88 }, { t: 'box', s: [0.6, 0.6, 1.3], p: [1.15, 1.2, 0.5], c: 0x7a6a88 },
    { t: 'box', s: [0.7, 0.3, 0.7], p: [-1.15, 0.55, 1.1], c: 0x4a3a5a }, { t: 'box', s: [0.7, 0.3, 0.7], p: [1.15, 0.55, 1.1], c: 0x4a3a5a },
  ]);
  if (type === 'shambler') return mergeParts([
    { t: 'box', s: [0.3, 0.7, 0.34], p: [-0.2, 0.35, 0], c: 0x4a4a58 }, { t: 'box', s: [0.3, 0.7, 0.34], p: [0.2, 0.35, 0], c: 0x4a4a58 },
    { t: 'box', s: [0.88, 0.9, 0.52], p: [0, 1.13, 0], c: 0x7a6a55 }, { t: 'box', s: [0.3, 0.3, 0.1], p: [0.2, 1.0, 0.27], c: 0x9a8a72 },
    { t: 'box', s: [0.6, 0.56, 0.56], p: [0, 1.87, 0.02], c: 0x9bd05a }, { t: 'box', s: [0.62, 0.14, 0.58], p: [0, 2.12, 0], c: 0x5a4a38 },
    { t: 'box', s: [0.12, 0.12, 0.08], p: [-0.14, 1.9, 0.31], c: 0xe83a2a }, { t: 'box', s: [0.12, 0.12, 0.08], p: [0.14, 1.9, 0.31], c: 0xe83a2a },
    { t: 'box', s: [0.28, 0.07, 0.06], p: [0, 1.68, 0.31], c: 0x3a2a1a },
    { t: 'box', s: [0.22, 0.24, 0.78], p: [-0.52, 1.28, 0.5], c: 0x9bd05a }, { t: 'box', s: [0.22, 0.24, 0.78], p: [0.52, 1.28, 0.5], c: 0x9bd05a },
  ]);
  if (type === 'runner') return mergeParts([
    { t: 'box', s: [0.26, 0.75, 0.3], p: [-0.18, 0.37, 0], c: 0x33333d }, { t: 'box', s: [0.26, 0.75, 0.3], p: [0.18, 0.37, 0], c: 0x33333d },
    { t: 'box', s: [0.72, 0.85, 0.42], p: [0, 1.15, 0], c: 0xc44a3a }, { t: 'box', s: [0.74, 0.2, 0.44], p: [0, 0.85, 0], c: 0x6a2a22 },
    { t: 'box', s: [0.52, 0.5, 0.5], p: [0, 1.8, 0.1], c: 0xb5e06a },
    { t: 'box', s: [0.1, 0.1, 0.08], p: [-0.12, 1.84, 0.37], c: 0xfff23a }, { t: 'box', s: [0.1, 0.1, 0.08], p: [0.12, 1.84, 0.37], c: 0xfff23a },
    { t: 'box', s: [0.3, 0.1, 0.06], p: [0, 1.64, 0.36], c: 0x4a1a1a },
    { t: 'box', s: [0.18, 0.2, 0.8], p: [-0.46, 1.32, 0.52], c: 0xb5e06a }, { t: 'box', s: [0.18, 0.2, 0.8], p: [0.46, 1.32, 0.52], c: 0xb5e06a },
  ]);
  return mergeParts([   // spitter
    { t: 'box', s: [0.34, 0.6, 0.36], p: [-0.28, 0.3, 0], c: 0x3a3252 }, { t: 'box', s: [0.34, 0.6, 0.36], p: [0.28, 0.3, 0], c: 0x3a3252 },
    { t: 'box', s: [1.1, 0.95, 0.85], p: [0, 1.08, 0], c: 0x7a5aa8 }, { t: 'sph', s: [0.5], p: [0, 1.05, 0.42], c: 0xc8ff3a },
    { t: 'box', s: [0.5, 0.46, 0.5], p: [0, 1.82, 0.1], c: 0x8fc050 }, { t: 'box', s: [0.12, 0.12, 0.08], p: [-0.12, 1.86, 0.37], c: 0xffee33 }, { t: 'box', s: [0.12, 0.12, 0.08], p: [0.12, 1.86, 0.37], c: 0xffee33 },
    { t: 'box', s: [0.3, 0.16, 0.1], p: [0, 1.66, 0.36], c: 0x274a12 },
    { t: 'box', s: [0.24, 0.7, 0.28], p: [-0.7, 1.05, 0.15], c: 0x8fc050 }, { t: 'box', s: [0.24, 0.7, 0.28], p: [0.7, 1.05, 0.15], c: 0x8fc050 },
  ]);
}

export function createZombies(scene, game) {
  const geos = {}, pools = {}, list = [];
  const world = game.world, fx = game.fx;
  for (const k of Object.keys(TYPES)) {
    geos[k] = k === 'swarm' ? buildGeo(k) : zombieGeo(k); pools[k] = [];
    for (let i = 0; i < TYPES[k].pool; i++) {
      const mat = k === 'swarm' ? vcMat() : limbMaterial();
      const mesh = new THREE.Mesh(geos[k], mat); mesh.castShadow = true; mesh.visible = false;
      if (mat.userData.limb) mesh.customDepthMaterial = limbDepth(mat);
      const root = new THREE.Group(); root.add(mesh); root.visible = false; root.rotation.order = 'YXZ'; scene.add(root);
      let ring = null;
      if (TYPES[k].slam) { ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; ring.visible = false; scene.add(ring); }
      pools[k].push({ type: k, def: TYPES[k], root, mesh, mat, ring, alive: false, x: 0, z: 0, vx: 0, vz: 0, r: TYPES[k].r, sc: TYPES[k].scale || 1 });
    }
  }

  const wave = { active: false, total: 0, left: 0, queue: 0, spawnT: 0, timer: state.waveTimer, num: state.waveNum, failed: false, warned: false };
  const zdata = [{ t: 0 }, { t: 0 }, { t: 0 }, { t: 0 }, { t: 0 }];
  let aliveCount = 0;

  function hpMul() { return Math.min(3.2, 1 + 0.07 * state.waveNum + (state.zoneUnlocked[1] ? 0.15 : 0) + (game.endless.active ? Math.min(2, game.endless.time / 240) : 0)); }

  function spawn(type, x, z, isWave = false, home = 0) {
    const p = pools[type].find(o => !o.alive);
    if (!p) return null;
    const d = p.def;
    p.alive = true; p.x = x; p.z = z; p.vx = p.vz = 0; p.yaw = rnd(0, TAU); p.hp = p.maxHp = Math.round(d.hp * hpMul());
    p.atkCd = rnd(0.2, 0.8); p.wanderT = 0; p.wanderA = rnd(0, TAU); p.flash = 0; p.hitT = 0; p.rise = 0; p.t = rnd(0, 6); p.isWave = isWave; p.home = home; p.stunT = 0; p.shootCd = rnd(1, 2.5); p.slamCd = rnd(1.5, 3); p.windup = 0; if (p.ring) p.ring.visible = false;
    p.speedMul = rnd(0.9, 1.15) * (isWave ? 1.15 : 1);
    p.mat.color.setRGB(rnd(0.82, 1), rnd(0.82, 1), rnd(0.82, 1));
    p.root.visible = p.mesh.visible = true; p.root.position.set(x, 0, z); p.root.scale.setScalar(0.01);
    list.push(p); aliveCount++;
    if (d.boss) { game.hud.toast('💀 A Zombie Titan approaches!', 'bad'); sfx.roar(); fx.addShake(0.5); }
    return p;
  }
  function release(p) {
    p.alive = false; p.root.visible = p.mesh.visible = false; if (p.ring) p.ring.visible = false;
    const i = list.indexOf(p); if (i >= 0) list.splice(i, 1);
    aliveCount--;
  }

  function kill(p, byTurret) {
    const d = p.def;
    let n = rndi(d.drop[0], d.drop[1]);
    if (d.dropChance && Math.random() > d.dropChance) n = 0;
    for (let i = 0; i < n; i++) game.items.spawnDrop('meat', p.x, p.z, 3.5 + (d.boss ? 4 : 0));
    if (d.scrap) { const sn = rndi(d.scrap[0], d.scrap[1]); for (let i = 0; i < sn; i++) game.items.spawnDrop('scrap', p.x, p.z, 3.5 + (d.boss ? 4 : 0)); }
    if (d.mini || d.boss) { fx.burst(p.x, 1.5, p.z, 26, d.color, 9, 1.4, 0.9, 8); fx.addShake(d.boss ? 0.9 : 0.4); sfx.boom(); }
    if (game.endless.active) game.endless.add(d.score || 5);
    fx.burst(p.x, 1.1, p.z, p.type === 'swarm' ? 4 : 9, d.color, 6, 1, 0.55, 6);
    fx.burst(p.x, 1.0, p.z, 4, 0x6a1a14, 4, 0.8, 0.5, 4);
    state.kills++; state.totalMeat += n;
    if (p.ring) p.ring.visible = false;
    sfx.kill();
    if (p.isWave) { wave.left--; }
    release(p);
  }

  const KIND_AP = { flame: 1, tesla: 1, laser: 1, ion: 1, magic: 1, sniper: 0.7, trap: 0.5 };
  function hit(p, dmg, dx, dz, kind, ap) {
    if (!p.alive) return;
    const arm = p.def.armor || 0, pierce = ap || KIND_AP[kind] || 0;
    const raw = dmg; dmg = dmg * (1 - arm * (1 - pierce));
    p.hp -= dmg; p.flash = 1; p.hitT = 0.18;
    const big = p.def.boss ? 0.15 : p.def.mini ? 0.4 : 1;
    const kb = (kind === 'sniper' ? 5 : 2.4) * big;
    p.vx += dx * kb; p.vz += dz * kb;
    const sc = p.sc > 1 ? 1.3 : 1;
    fx.text(p.x, 2.5 * p.sc, p.z, String(Math.max(1, Math.round(dmg))), dmg < raw * 0.7 ? '#9fb0c8' : dmg >= 20 ? '#ffd24a' : '#ffffff', (dmg >= 20 ? 1.25 : 1) * sc);
    sfx.hit();
    if (p.hp <= 0) kill(p, kind !== 'player');
  }

  function nearest(x, z, range) {
    let best = null, bd = range * range;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.rise < 0.4) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function areaHit(x, z, r, dmg, kind = 'trap') {
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < (r + p.r) ** 2) { hit(p, dmg, 0, 0, kind); n++; }
    }
    return n;
  }

  // ---- population ---------------------------------------------------------------------------------------------------
  const TARGET = [0, 15, 16, 18, 20];
  function targetCount(zi) {
    if (zi === 0) return 10 + Math.min(6, Math.floor(state.waveNum / 2)) + Math.min(3, game.buildings.turretCount(0));
    const E = game.endless;
    return TARGET[zi] + (E.active && zi === 4 ? 8 + Math.min(14, Math.floor(E.time / 25)) : 0);
  }
  function homeCount(zi) { let n = 0; for (const p of list) if (p.home === zi && !p.isWave) n++; return n; }
  function countType(t) { let n = 0; for (const p of list) if (p.type === t) n++; return n; }
  function pickType(zi) {
    const r = Math.random(), E = game.endless;
    if (zi === 0) return 'shambler';
    if (zi === 1) return r < 0.62 ? 'runner' : r < 0.95 ? 'spitter' : 'shambler';
    if (zi === 2) return r < 0.5 ? 'riot' : r < 0.75 ? 'runner' : r < 0.9 ? 'shambler' : 'spitter';
    if (zi === 3) return r < 0.35 ? 'swarm' : r < 0.55 ? 'riot' : r < 0.75 ? 'spitter' : r < 0.9 ? 'runner' : (countType('brute') < 2 ? 'brute' : 'riot');
    const bw = E.active ? 0.2 : 0.12;
    return r < 0.28 ? 'riot' : r < 0.48 ? 'runner' : r < 0.62 ? 'spitter' : r < 0.78 ? 'swarm' : r < 0.78 + bw ? (countType('brute') < (E.active ? 4 : 3) ? 'brute' : 'riot') : 'shambler';
  }
  function spawnTyped(type, s, zi) {
    if (type === 'swarm') { for (let k = 0; k < 7; k++) spawn('swarm', s.x + rnd(-1.8, 1.8), s.z + rnd(-1.8, 1.8), false, zi); }
    else spawn(type, s.x, s.z, false, zi);
  }
  let titanT = 30;
  function fill(dt) {
    const pl = game.player, pz = world.zoneAt(pl.x), E = game.endless;
    for (let zi = 0; zi < 5; zi++) {
      if (!state.zoneUnlocked[zi]) continue;
      const here = pz === zi, def = game.buildings.hasDefense(zi);
      if (!here && !def && zi !== 0) continue;
      const zd = zdata[zi] || (zdata[zi] = { t: 0 });
      zd.t -= dt;
      if (zd.t > 0 || aliveCount > 95) continue;
      if (homeCount(zi) >= targetCount(zi)) continue;
      zd.t = (zi === 4 ? (E.active ? 0.45 : 0.8) : 1.0) * (here ? 1 : 2.2);
      const s = world.randomSpot(zi, 3, pl.x, pl.z, here ? 17 : 6, zi === 0 ? 11 : 0);
      if (s) spawnTyped(pickType(zi), s, zi);
    }
    // zombie titans haunt the Necropolis
    if (pz === 4 && state.zoneUnlocked[4]) {
      titanT -= dt;
      if (titanT <= 0) {
        const cap = E.active ? 2 : 1;
        if (countType('titan') < cap) { const s = world.randomSpot(4, 5, pl.x, pl.z, 20); if (s) spawn('titan', s.x, s.z, false, 4); }
        titanT = E.active ? 55 : 85;
      }
    } else titanT = Math.min(titanT, 40);
  }

  // ---- waves --------------------------------------------------------------------------------------------------------
  function startWave() {
    state.waveNum++; wave.num = state.waveNum;
    wave.active = true; wave.failed = false;
    wave.total = Math.min(46, 6 + Math.round(state.waveNum * 3.2)); wave.left = wave.total; wave.queue = wave.total; wave.spawnT = 0;
    game.hud.toast(`🧟 Wave ${wave.num}! Defend the core!`, 'bad');
    sfx.horn(); fx.addShake(0.4);
    game.buildings.core.hp = Math.max(game.buildings.core.hp, game.buildings.core.maxHp * 0.6);
  }
  function spawnWaveOne() {
    // from the west / north / south edges of zone 1
    const side = pick(['w', 'n', 's', 'w']); const q = world.ZONES[0], m = 26.5;
    let x, z;
    if (side === 'w') { x = -m; z = rnd(-m, m); } else if (side === 'n') { x = rnd(-m, 20); z = -m; } else { x = rnd(-m, 20); z = m; }
    const n = state.waveNum, r = Math.random();
    let type = n >= 3 && r < Math.min(0.4, 0.1 + n * 0.04) ? 'runner' : 'shambler';
    if (state.zoneUnlocked[2] && Math.random() < Math.min(0.35, 0.05 + n * 0.02)) type = 'riot';
    if (state.zoneUnlocked[3] && n >= 12 && Math.random() < 0.06 && countType('brute') < 2) type = 'brute';
    const p = spawn(type, x, z, true, 0);
    if (!p) { wave.left--; wave.total--; }
  }
  function endWave(failed) {
    wave.active = false; state.waveTimer = wave.timer = 90; wave.warned = false;
    if (failed) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].isWave) { fx.burst(list[i].x, 1, list[i].z, 5, 0x9bd05a, 4); release(list[i]); }
      wave.queue = 0;
    } else {
      state.wavesCleared++;
      const bonus = 10 + state.waveNum * 5;
      for (let i = 0; i < bonus; i++) game.items.spawnDrop('meat', CORE.x + rnd(-3, 3), CORE.z + rnd(-3, 3), 7, 2.5);
      game.hud.toast(`✅ Wave ${wave.num} cleared! +${bonus} meat`, 'good');
      sfx.win();
    }
  }

  const _tgt = { x: 0, z: 0 };
  function update(dt) {
    // waves
    if (!wave.active) {
      wave.timer -= dt; state.waveTimer = wave.timer;
      if (wave.timer <= 10 && !wave.warned) { wave.warned = true; game.hud.toast('⚠️ Horde incoming in 10 seconds!', 'bad'); sfx.deny(); }
      if (wave.timer <= 0) startWave();
    } else {
      if (wave.queue > 0) {
        wave.spawnT -= dt;
        if (wave.spawnT <= 0) { wave.spawnT = 0.28; wave.queue--; spawnWaveOne(); }
      }
      if (game.buildings.core.hp <= 0) { game.buildings.coreFailed(); endWave(true); }
      else if (wave.left <= 0 && wave.queue <= 0) endWave(false);
    }
    fill(dt);

    const pl = game.player, core = game.buildings.core;
    const pz = world.zoneAt(pl.x);

    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i], d = p.def;
      p.t += dt; p.atkCd -= dt; if (p.slamCd > 0) p.slamCd -= dt; p.flash = Math.max(0, p.flash - dt * 6); p.hitT = Math.max(0, p.hitT - dt);
      p.rise = Math.min(1, p.rise + dt * 2.6);

      // decide the goal
      const dpx = pl.x - p.x, dpz = pl.z - p.z, dp = Math.hypot(dpx, dpz);
      let mode = 'wander', gx = 0, gz = 0, tgtR = 0;
      const sameZone = pz === p.home || p.isWave;
      if (p.isWave) {
        if (pl.alive && dp < 5.5) { mode = 'player'; gx = pl.x; gz = pl.z; tgtR = pl.r; }
        else { mode = 'core'; gx = CORE.x; gz = CORE.z; tgtR = 2.2; }
      } else if (pl.alive && sameZone && dp < d.aggro) { mode = 'player'; gx = pl.x; gz = pl.z; tgtR = pl.r; }

      let dirx = 0, dirz = 0, spd = d.speed * p.speedMul;
      if (mode === 'wander') {
        p.wanderT -= dt;
        if (p.wanderT <= 0) { p.wanderT = rnd(1.5, 4); p.wanderA = rnd(0, TAU); if (Math.random() < 0.3) p.wanderT = -1; }
        // drift back toward the home zone's middle if near its edge
        const q = world.ZONES[p.home];
        let ex = 0, ez = 0;
        if (Math.abs(p.x - q.cx) > q.hx - 3) ex = -Math.sign(p.x - q.cx);
        if (Math.abs(p.z - q.cz) > q.hz - 3) ez = -Math.sign(p.z - q.cz);
        if (ex || ez) { dirx = ex; dirz = ez; } else if (p.wanderT > 0.5) { dirx = Math.sin(p.wanderA); dirz = Math.cos(p.wanderA); }
        spd *= 0.4;
      } else {
        const dx = gx - p.x, dz = gz - p.z, dist = Math.hypot(dx, dz) || 1;
        dirx = dx / dist; dirz = dz / dist;
        const reach = d.range + tgtR + p.r * 0.5;
        if (d.ranged) {
          // keep distance and lob goo
          const want = mode === 'core' ? 9 : d.keep;
          if (dist < want - 1.5) { dirx = -dirx; dirz = -dirz; spd *= 0.8; }
          else if (dist < want + 1.5) { spd = 0; }
          p.shootCd -= dt;
          if (dist < d.shoot && p.shootCd <= 0 && p.rise >= 1) {
            p.shootCd = d.atkRate * rnd(0.9, 1.3);
            const lead = mode === 'player' ? 0.45 : 0;
            game.projectiles.spit(p.x + dirx * 0.6, p.z + dirz * 0.6, gx + (mode === 'player' ? pl.vx * lead : 0), gz + (mode === 'player' ? pl.vz * lead : 0), d.dmg);
            sfx.spit(); p.hitT = 0.12;
          }
        } else if (d.slam && p.rise >= 1 && (p.windup > 0 || (p.slamCd <= 0 && dist < d.slam.r * 0.95 + tgtR))) {
          // ground slam: telegraph, then area damage
          spd = 0;
          if (p.windup <= 0) { p.windup = d.slam.wind; if (d.boss) sfx.roar(); }
          p.windup -= dt;
          if (p.ring) { p.ring.visible = true; const k = 1 - Math.max(0, p.windup) / d.slam.wind; p.ring.position.x = p.x; p.ring.position.z = p.z; p.ring.scale.set(d.slam.r * (0.35 + 0.65 * k), d.slam.r * (0.35 + 0.65 * k), 1); p.ring.material.opacity = 0.3 + 0.5 * k; }
          if (p.windup <= 0) {
            p.windup = 0; p.slamCd = d.slam.every; if (p.ring) p.ring.visible = false;
            if (game.fences) game.fences.damageNear(p.x, p.z, d.slam.r, d.slam.dmg * 4);
            sfx.slam(); fx.addShake(d.boss ? 0.8 : 0.45); fx.burst(p.x, 0.4, p.z, 18, 0xb09070, d.slam.r * 1.6, 1.2, 0.6, 3);
            if (pl.alive && (pl.x - p.x) ** 2 + (pl.z - p.z) ** 2 < (d.slam.r + pl.r) ** 2) pl.hurt(d.slam.dmg);
            if ((CORE.x - p.x) ** 2 + (CORE.z - p.z) ** 2 < (d.slam.r + 2.4) ** 2) core.damage(d.slam.dmg * 1.5);
          }
        } else if (dist < reach) {
          spd = 0;
          if (p.atkCd <= 0 && p.rise >= 1) {
            p.atkCd = d.atkRate;
            if (mode === 'player') pl.hurt(d.dmg); else core.damage(d.dmg * 1.4);
            p.hitT = 0.2; p.lunge = 0.2;
          }
        } else if (dist < reach + 1.2) spd *= 0.5;
      }

      // velocity, knock-back, collisions
      if (p.stunT > 0) { p.stunT -= dt; spd = 0; }
      p.vx = damp(p.vx, dirx * spd, 7, dt); p.vz = damp(p.vz, dirz * spd, 7, dt);
      world.move(p, p.vx * dt, p.vz * dt, p.r * 0.8);
      if (game.fences) {   // player-built fences stop zombies: the ones pushing toward a target chew on the fence
        const fence = world.resolveFences(p, p.r * 0.85);
        if (fence && mode !== 'wander' && !d.ranged && p.atkCd <= 0 && p.rise >= 1) { p.atkCd = d.atkRate; game.fences.damage(fence, d.dmg * (d.slam ? 2.5 : 1)); p.hitT = 0.2; p.lunge = 0.2; }
      }

      // pose
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0.4) p.yaw = angLerp(p.yaw, Math.atan2(p.vx, p.vz), 1 - Math.exp(-9 * dt));
      else if (mode !== 'wander') p.yaw = angLerp(p.yaw, Math.atan2(gx - p.x, gz - p.z), 1 - Math.exp(-9 * dt));
      const bob = Math.abs(Math.sin(p.t * (3 + sp * 1.7))) * (0.06 + Math.min(0.12, sp * 0.03));
      const k = p.rise < 1 ? 0.2 + 0.8 * p.rise : 1;
      const sq = 1 - p.hitT * 0.8;
      p.lunge = Math.max(0, (p.lunge || 0) - dt);
      p.root.position.set(p.x, bob * p.sc - (1 - p.rise) * 1.2 * p.sc, p.z);
      p.root.rotation.set(sp > 0.4 || p.lunge ? (p.type === 'runner' || p.type === 'swarm' ? 0.28 : 0.1) + p.lunge * 1.2 : 0, p.yaw, Math.sin(p.t * (3 + sp * 1.7)) * 0.09 * Math.min(1, sp));
      const ks = k * p.sc; p.root.scale.set(ks * (1 + p.hitT * 0.5), ks * sq, ks * (1 + p.hitT * 0.5));
      p.mat.emissive.setRGB(p.flash, p.flash, p.flash);
      if (p.mat.userData.limb) {
        // walk cycle: phase advances with ground speed; legs swing, arms sway (and rise for a slam wind-up)
        p.ph = (p.ph || 0) + dt * (2.5 + sp * 1.9);
        const wspd = Math.min(1, sp / 2.2), big = d.boss ? 0.55 : d.mini ? 0.7 : 1;
        let armOff = 0;
        if (d.slam && p.windup > 0) armOff = -2.3 * (1 - Math.max(0, p.windup) / d.slam.wind);
        else if (p.lunge > 0) armOff = -0.5 * (p.lunge / 0.2);
        setLimb(p.mat, p.ph, (0.2 + 0.7 * wspd) * big * (sp > 0.25 ? 1 : 0.15), p.type === 'riot' || p.type === 'spitter' ? 0.2 : 0.18 + 0.12 * wspd, armOff);
      }

      if (p.hp < p.maxHp && p.rise >= 1 && !d.boss) fx.bar(p.x, 2.9 * p.sc, p.z, p.hp / p.maxHp);
    }

    // soft separation so they don't stack into one blob
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j], dx = b.x - a.x, dz = b.z - a.z, rr = (a.r + b.r) * 0.9;
        if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5 / d;
          if (world.walkable(a.x - dx * push, a.z - dz * push, a.r * 0.8)) { a.x -= dx * push; a.z -= dz * push; }
          if (world.walkable(b.x + dx * push, b.z + dz * push, b.r * 0.8)) { b.x += dx * push; b.z += dz * push; }
        }
      }
    }
  }

  function clearAll() { for (let i = list.length - 1; i >= 0; i--) release(list[i]); wave.active = false; wave.queue = 0; }
  const boss = () => { for (const p of list) if (p.def.boss && p.alive) return p; return null; };
  function initialFill() {
    const pl = game.player;
    for (let i = 0; i < 7; i++) { const s = world.randomSpot(0, 3, pl.x, pl.z, 11, 11); if (s) spawn('shambler', s.x, s.z, false, 0); }
  }

  return { list, spawn, hit, nearest, areaHit, update, wave, clearAll, initialFill, boss, TYPES, get alive() { return aliveCount; } };
}
