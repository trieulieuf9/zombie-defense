// Everything you can build: the base core, glowing drop pads (parabolic meat transfer), turrets, spike traps,
// stations, the collector hut + bots, the bridge and the zone-3 gate. All state lives in `state.pads[id] = {lvl, prog}`.
import * as THREE from 'three';
import { state, carried, capacity, padLvl, padProg, padSp, padEp, TIER_NAMES } from './state.js';
import { PADS, PAD_HALF, padDef, needOf } from './defs.js';
import { createHeavy } from './heavy.js';
import { botGeo } from './models.js';
import { CORE } from './world.js';
import { mergeParts, bowParts, vcMat, limbMaterial, limbDepth, setLimb, rnd, clamp, damp, angLerp, TAU } from './util.js';
import { sfx } from './audio.js';

const KIND_COLOR = { turret: 0x4dd0ff, sniper: 0x7fe9ff, pack: 0x7dff8a, weapon: 0xffd24a, boots: 0xff9a4d, bridge: 0xffe14d, hut: 0xc58aff, hire: 0xc58aff, spikes: 0xff6a5a, gate: 0xffe14d, refinery: 0xff9a3d, convert: 0x7fe9ff, flame: 0xff7a2a, squad: 0x9dff9d, door: 0xff6a5a, evolve: 0xff5cf4, tesla: 0x7fe9ff, laser: 0xff4d4d, teleporter: 0x9a7dff, gen: 0x7fe9ff, ion: 0xbfe9ff, endless: 0xff4d7a, vest: 0x9dd0ff, fence: 0xc89a5a };
const flat = (geo) => geo;

export function createBuildings(scene, game) {
  const world = game.world, fx = game.fx, items = game.items;
  const matLam = vcMat();
  const group = new THREE.Group(); scene.add(group);
  const heavy = createHeavy(scene, game, { matLam, group });

  // =============================================================================================================
  // Core (the base the hordes attack)
  // =============================================================================================================
  const core = { x: CORE.x, z: CORE.z, hp: 600, maxHp: 600, hitT: 0, regen: true };
  const coreRoot = new THREE.Group(); group.add(coreRoot);
  const platGeo = mergeParts([
    { t: 'cyl', s: [3.2, 3.5, 0.5, 20], p: [0, 0.25, 0], c: 0x6d7480 }, { t: 'cyl', s: [2.5, 2.8, 0.4, 20], p: [0, 0.7, 0], c: 0x8a93a1 },
    { t: 'box', s: [0.5, 1.6, 0.5], p: [2.4, 1.2, 0], c: 0x59606b }, { t: 'box', s: [0.5, 1.6, 0.5], p: [-2.4, 1.2, 0], c: 0x59606b },
    { t: 'box', s: [0.5, 1.6, 0.5], p: [0, 1.2, 2.4], c: 0x59606b }, { t: 'box', s: [0.5, 1.6, 0.5], p: [0, 1.2, -2.4], c: 0x59606b },
  ]);
  const plat = new THREE.Mesh(platGeo, matLam); plat.castShadow = plat.receiveShadow = true; coreRoot.add(plat);
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0x4cc8ff, emissive: 0x1a78c8 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.15), crystalMat); crystal.scale.y = 1.5; crystal.position.y = 3.0; crystal.castShadow = true; coreRoot.add(crystal);
  const glow = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.1, 40), new THREE.MeshBasicMaterial({ color: 0x4cc8ff, transparent: true, opacity: 0.5, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.12; coreRoot.add(glow);
  world.addObstacle(CORE.x, CORE.z, 2.6);
  core.damage = function (n) {
    if (core.hp <= 0) return;
    core.hp = Math.max(0, core.hp - n); core.hitT = 0.25; sfx.coreHit(); fx.addShake(0.15);
    fx.text(core.x + rnd(-1, 1), 4.6, core.z, '-' + Math.round(n), '#ff8a7a', 0.9);
  };
  function hitCoreAt(x, z, r, dmg) { if ((x - core.x) ** 2 + (z - core.z) ** 2 < (r + 2.4) ** 2) core.damage(dmg); }
  function coreFailed() {
    const lost = Math.min(40, Math.floor(carried() * 0.3));
    let left = lost;
    for (const t of ['meat', 'scrap']) { const n = Math.min(left, state.carry[t]); state.carry[t] -= n; left -= n; }
    core.hp = core.maxHp * 0.5; fx.burst(core.x, 2, core.z, 30, 0x4cc8ff, 9, 1.4, 0.9, 8); fx.addShake(0.9);
    game.hud.toast(`💥 The core was overrun! The horde fled. Lost ${lost} carried items.`, 'bad'); sfx.die();
  }
  function recalcCore() { const ratio = core.maxHp > 0 ? core.hp / core.maxHp : 1; core.maxHp = 600 + 120 * turretCount(0); core.hp = clamp(core.hp, 0, core.maxHp) ; if (ratio > 0.999) core.hp = core.maxHp; }

  // =============================================================================================================
  // Pads
  // =============================================================================================================
  const frameGeo = mergeParts([
    { t: 'box', s: [4.6, 0.06, 0.22], p: [0, 0, -2.3], c: 0xffffff }, { t: 'box', s: [4.6, 0.06, 0.22], p: [0, 0, 2.3], c: 0xffffff },
    { t: 'box', s: [0.22, 0.06, 4.6], p: [-2.3, 0, 0], c: 0xffffff }, { t: 'box', s: [0.22, 0.06, 4.6], p: [2.3, 0, 0], c: 0xffffff },
  ]);
  const fillGeo = new THREE.PlaneGeometry(PAD_HALF * 2, PAD_HALF * 2); fillGeo.translate(0, PAD_HALF, 0);
  const baseGeo = new THREE.PlaneGeometry(PAD_HALF * 2, PAD_HALF * 2);

  const pads = [];
  for (const def of PADS) {
    const color = KIND_COLOR[def.kind] || 0xffffff;
    const g = new THREE.Group(); g.position.set(def.x, 0.05, def.z); group.add(g); g.visible = false;
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ vertexColors: true, color, transparent: true, opacity: 0.95 })); g.add(frame);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })); base.rotation.x = -Math.PI / 2; g.add(base);
    const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.set(0, 0.02, PAD_HALF); fill.scale.y = 0.0001; g.add(fill);
    const cv = document.createElement('canvas'); cv.width = 448; cv.height = 192;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); spr.scale.set(5.6, 2.4, 1); spr.position.set(0, 3.2, 0); spr.renderOrder = 20; g.add(spr);
    pads.push({ def, id: def.id, x: def.x, z: def.z, group: g, frame, base, fill, cv, tex, spr, visible: false, done: false, fl: { m: 0, s: 0, e: 0 }, stand: 0, acc: 0, key: '', pulse: rnd(0, 6), prop: null, cool: false });
  }
  const padById = id => pads.find(p => p.id === id);
  const isBuilt = id => { const d = padDef(id); return !d.action && padLvl(id) >= d.costs.length; };

  function padVisible(p) {
    if (!state.zoneUnlocked[p.def.zone]) return false;
    if (isBuilt(p.id)) return false;
    return p.def.req.every(isBuilt);
  }
  const needOf2 = p => needOf(p.def, padLvl(p.id));
  const progOf = p => ({ m: padProg(p.id), s: padSp(p.id), e: padEp(p.id) });
  const remT = (p, t) => needOf2(p)[t] - progOf(p)[t] - p.fl[t];
  const remaining = p => remT(p, 'm');            // meat still missing (collector bots only carry meat)
  const ICON = { m: '🥩', s: '🔩', e: '⚡' };

  const FONT = '-apple-system, Helvetica, Arial, sans-serif';
  function drawLabel(p) {
    const def = p.def, lvl = padLvl(p.id), max = def.costs.length;
    let key, title, sub, subColor = '#c8e6c0', big;
    if (def.action) {
      const E = game.endless;
      key = `a|${state.energy}|${E.active}|${E.best}|${Math.floor(E.score / 20)}`;
      title = `${def.icon} ${def.name}`;
      if (def.kind === 'convert') { sub = def.hint; big = `${state.energy} ⚡ banked`; }
      else { sub = E.active ? 'Run in progress — stand here to end it' : `Best score: ${E.best}`; big = E.active ? `Score ${Math.floor(E.score)}` : 'Stand here to start'; }
    } else {
      const need = needOf2(p), prog = progOf(p);
      key = `${lvl}|${prog.m}|${prog.s}|${prog.e}|${p.fl.m}|${p.fl.s}|${p.fl.e}`;
      title = def.names ? def.names[Math.min(lvl, def.names.length - 1)] : def.name;
      if (!def.names) title = `${def.icon} ${title}`;
      if (max > 1 && !def.names) { sub = `Level ${lvl + 1 + (def.base || 0)} / ${max + (def.base || 0)}`; subColor = '#ffe14d'; } else sub = def.hint;
      const parts = [];
      for (const t of ['m', 's', 'e']) if (need[t] > 0) parts.push(`${prog[t] + p.fl[t]}/${need[t]} ${ICON[t]}`);
      big = parts.join('  ');
      p._bigSize = parts.length >= 3 ? 30 : parts.length === 2 ? 38 : 52;
    }
    if (key === p.key) return; p.key = key;
    const g = p.cv.getContext('2d'), W = p.cv.width, H = p.cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(12,22,12,0.8)'; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5;
    g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 28); g.fill(); g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
    g.font = `800 ${title.length > 22 ? 30 : 36}px ${FONT}`; g.fillText(title, W / 2, 56);
    g.font = `700 ${sub.length > 30 ? 22 : 26}px ${FONT}`; g.fillStyle = subColor; g.fillText(sub, W / 2, 92);
    g.fillStyle = '#fff'; g.font = `900 ${p._bigSize || 44}px ${FONT}`; g.fillText(big, W / 2, 150);
    p.tex.needsUpdate = true;
  }

  // --- structure factories ---------------------------------------------------------------------------------------
  const structures = [];     // updated each frame
  const turrets = [];
  const traps = [];
  const bots = [];
  let hut = null;

  const mgBase = mergeParts([{ t: 'cyl', s: [0.95, 1.1, 0.55, 12], p: [0, 0.27, 0], c: 0x4a5058 }, { t: 'cyl', s: [0.4, 0.5, 0.6, 8], p: [0, 0.85, 0], c: 0x6b727c }]);
  const mgHead = mergeParts([
    { t: 'box', s: [0.9, 0.62, 0.95], p: [0, 0, 0], c: 0x2fb3d6 }, { t: 'box', s: [0.95, 0.15, 1.0], p: [0, 0.4, 0], c: 0x1f8aa8 },
    { t: 'box', s: [0.16, 0.16, 1.15], p: [-0.2, 0.05, 0.95], c: 0x22262b }, { t: 'box', s: [0.16, 0.16, 1.15], p: [0.2, 0.05, 0.95], c: 0x22262b },
    { t: 'box', s: [0.5, 0.3, 0.3], p: [0, 0.32, -0.55], c: 0xd6a02f },
  ]);
  const snBase = mergeParts([
    { t: 'cyl', s: [1.0, 1.2, 0.5, 10], p: [0, 0.25, 0], c: 0x4a5058 },
    { t: 'box', s: [0.22, 3.2, 0.22], p: [-0.65, 2.0, -0.65], c: 0x7a5530 }, { t: 'box', s: [0.22, 3.2, 0.22], p: [0.65, 2.0, -0.65], c: 0x7a5530 },
    { t: 'box', s: [0.22, 3.2, 0.22], p: [-0.65, 2.0, 0.65], c: 0x7a5530 }, { t: 'box', s: [0.22, 3.2, 0.22], p: [0.65, 2.0, 0.65], c: 0x7a5530 },
    { t: 'box', s: [1.8, 0.2, 1.8], p: [0, 3.7, 0], c: 0x9a6c3c }, { t: 'box', s: [0.1, 0.9, 1.9], p: [-0.9, 4.15, 0], c: 0x7a5530 }, { t: 'box', s: [0.1, 0.9, 1.9], p: [0.9, 4.15, 0], c: 0x7a5530 },
  ]);
  const snHead = mergeParts([
    { t: 'box', s: [0.6, 0.5, 1.2], p: [0, 0, 0], c: 0x3d4a3a }, { t: 'box', s: [0.14, 0.14, 2.6], p: [0, 0.05, 1.7], c: 0x22262b },
    { t: 'box', s: [0.2, 0.2, 0.5], p: [0, 0.35, 0.2], c: 0x7fe9ff }, { t: 'box', s: [0.3, 0.3, 0.3], p: [0, 0.02, 3.0], c: 0x22262b },
  ]);

  function addTurret(kind, x, z, instant) {
    const sniper = kind === 'sniper';
    const base = new THREE.Mesh(sniper ? snBase : mgBase, matLam); base.position.set(x, 0, z); base.castShadow = true; group.add(base);
    const head = new THREE.Mesh(sniper ? snHead : mgHead, matLam); head.position.set(x, sniper ? 4.2 : 1.35, z); head.castShadow = true; group.add(head);
    const t = { kind, x, z, head, base, yaw: 0, cd: rnd(0, 0.5), recoil: 0, range: sniper ? 27 : 12, rate: sniper ? 0.75 : 4.2, zone: world.zoneAt(x), ob: world.addObstacle(x, z, sniper ? 1.2 : 1.0), muzzleY: sniper ? 4.3 : 1.45, spawnT: instant ? 1 : 0 };
    turrets.push(t);
    if (!instant) { base.scale.setScalar(0.01); head.scale.setScalar(0.01); }
    t.base0 = base; t.head0 = head;
    return t;
  }
  function updateTurret(t, dt) {
    if (t.spawnT < 1) { t.spawnT = Math.min(1, t.spawnT + dt * 3); const k = 1 - Math.pow(1 - t.spawnT, 3); const s = 0.01 + k * (1 + Math.sin(k * Math.PI) * 0.15); t.base0.scale.setScalar(s); t.head0.scale.setScalar(s); }
    t.cd -= dt; t.recoil = Math.max(0, t.recoil - dt * 8);
    const z = game.zombies.nearest(t.x, t.z, t.range);
    if (z) {
      const want = Math.atan2(z.x - t.x, z.z - t.z);
      t.yaw = angLerp(t.yaw, want, 1 - Math.exp(-14 * dt));
      if (t.cd <= 0 && Math.abs(Math.atan2(Math.sin(want - t.yaw), Math.cos(want - t.yaw))) < 0.25) {
        t.cd = 1 / t.rate; t.recoil = 1;
        const sn = t.kind === 'sniper';
        game.projectiles.fire({ x: t.x + Math.sin(t.yaw) * (sn ? 3.2 : 1.8), z: t.z + Math.cos(t.yaw) * (sn ? 3.2 : 1.8), y: t.muzzleY, angle: t.yaw + (sn ? 0 : rnd(-0.05, 0.05)), dmg: sn ? 26 + state.weaponLvl * 2 : 3.2 + state.weaponLvl * 0.6, speed: sn ? 70 : 34, range: t.range + 2, kind: sn ? 'sniper' : 'turret', pierce: sn ? 2 : 0 });
        sn ? sfx.sniper() : sfx.turret();
        fx.burst(t.x + Math.sin(t.yaw) * (sn ? 3.2 : 1.8), t.muzzleY, t.z + Math.cos(t.yaw) * (sn ? 3.2 : 1.8), sn ? 4 : 2, 0xffd37a, 3, 0.7, 0.2, 1);
      }
    }
    t.head.rotation.y = t.yaw;
    const rc = t.recoil * (t.kind === 'sniper' ? 0.45 : 0.18);
    t.head.position.set(t.x - Math.sin(t.yaw) * rc, t.head.position.y, t.z - Math.cos(t.yaw) * rc);
  }

  // spike traps
  const spikeBase = mergeParts([{ t: 'box', s: [3.4, 0.14, 3.4], p: [0, 0.07, 0], c: 0x4a4048 }]);
  const spikeTeeth = (() => { const parts = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) parts.push({ t: 'cone', s: [0.26, 0.9, 5], p: [i * 1.0, 0.45, j * 1.0], c: 0xd9dde3 }); return mergeParts(parts); })();
  function addTrap(x, z, instant) {
    const b = new THREE.Mesh(spikeBase, matLam); b.position.set(x, 0, z); b.receiveShadow = true; group.add(b);
    const s = new THREE.Mesh(spikeTeeth, matLam); s.position.set(x, 0.1, z); s.scale.y = 0.35; s.castShadow = true; group.add(s);
    const t = { x, z, b, s, cd: 0, up: 0, spawnT: instant ? 1 : 0 };
    traps.push(t); return t;
  }
  function updateTrap(t, dt) {
    t.cd -= dt;
    if (t.spawnT < 1) { t.spawnT += dt * 3; t.b.scale.setScalar(Math.min(1, t.spawnT)); }
    let near = false;
    for (const z of game.zombies.list) if (Math.abs(z.x - t.x) < 1.9 && Math.abs(z.z - t.z) < 1.9) { near = true; break; }
    t.up = damp(t.up, near ? 1 : 0, near ? 18 : 6, dt);
    t.s.scale.y = 0.3 + t.up * 0.9;
    if (near && t.cd <= 0) {
      t.cd = 0.4;
      let n = 0;
      for (const z of game.zombies.list.slice()) if (Math.abs(z.x - t.x) < 1.9 && Math.abs(z.z - t.z) < 1.9) { game.zombies.hit(z, 5 + state.weaponLvl, 0, 0, 'trap'); n++; }
      if (n) fx.burst(t.x, 0.5, t.z, 3, 0xff6a5a, 3, 0.6, 0.3, 3);
    }
  }

  // collector hut + bots
  const hutGeo = mergeParts([
    { t: 'box', s: [3.4, 2.2, 3.0], p: [0, 1.1, 0], c: 0xd9b27a }, { t: 'box', s: [3.5, 0.2, 3.1], p: [0, 0.1, 0], c: 0x8a6a3a },
    { t: 'cone', s: [3.2, 1.8, 4], p: [0, 3.1, 0], r: [0, Math.PI / 4, 0], c: 0xc8553a }, { t: 'box', s: [0.9, 1.5, 0.12], p: [0, 0.75, 1.52], c: 0x5a3a1c },
    { t: 'box', s: [0.8, 0.7, 0.12], p: [-1.0, 1.4, 1.52], c: 0x8fd8ff }, { t: 'box', s: [0.8, 0.7, 0.12], p: [1.0, 1.4, 1.52], c: 0x8fd8ff },
    { t: 'box', s: [1.0, 0.7, 0.1], p: [0, 2.35, 1.56], c: 0xffe14d },
  ]);
  function addHut(x, z, instant) {
    const m = new THREE.Mesh(hutGeo, matLam); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; group.add(m);
    hut = { x, z, m, spawnT: instant ? 1 : 0, ob: world.addObstacle(x, z, 2.3) };
    if (!instant) m.scale.setScalar(0.01);
  }
  const botG = botGeo();
  const cargoGeo = new THREE.BoxGeometry(0.34, 0.2, 0.26), cargoMat = new THREE.MeshLambertMaterial({ color: 0xd9453d });
  const BOT_CAP = 5;
  function addBot(instant) {
    const root = new THREE.Group(); const bmat = limbMaterial(); const body = new THREE.Mesh(botG, bmat); body.castShadow = true; body.customDepthMaterial = limbDepth(bmat); root.add(body);
    const cargo = [];
    for (let i = 0; i < BOT_CAP; i++) { const c = new THREE.Mesh(cargoGeo, cargoMat); c.position.set(((i % 2) - 0.5) * 0.4, 1.05 + Math.floor(i / 2) * 0.22, -0.7); c.visible = false; root.add(c); cargo.push(c); }
    root.rotation.order = 'YXZ'; group.add(root);
    const sx = hut ? hut.x : 56, sz = hut ? hut.z + 2.4 : -9;
    const b = { x: sx + rnd(-0.8, 0.8), z: sz + rnd(0, 1.2), yaw: 0, state: 'idle', target: null, pad: null, carry: 0, t: rnd(0, 3), root, cargo, scan: rnd(0, 0.5), dropT: 0, vx: 0, vz: 0, r: 0.45, wait: 0, mat: bmat, ph: 0 };
    root.position.set(b.x, 0, b.z);
    bots.push(b); return b;
  }
  const zoneOfX = x => (x < 28 ? 0 : x < 48 ? 1 : 2);
  const _wp = { x: 0, z: 0 };
  function waypoint(bx, bz, tx, tz) {
    const sb = zoneOfX(bx), st = zoneOfX(tx);
    if (sb === st) { _wp.x = tx; _wp.z = tz; }
    else if (sb < st) { _wp.x = sb === 0 ? 31 : 50; _wp.z = 0; }
    else { _wp.x = sb === 2 ? 46 : 26; _wp.z = 0; }
    return _wp;
  }
  function stepBot(b, tx, tz, dt, speed = 6.6) {
    const w = waypoint(b.x, b.z, tx, tz);
    const dx = w.x - b.x, dz = w.z - b.z, d = Math.hypot(dx, dz) || 1;
    const ts = Math.min(speed, d / Math.max(dt, 0.001));
    b.vx = damp(b.vx, dx / d * ts, 10, dt); b.vz = damp(b.vz, dz / d * ts, 10, dt);
    world.move(b, b.vx * dt, b.vz * dt, b.r);
    return Math.hypot(tx - b.x, tz - b.z);
  }
  function validPad(p) { return p.visible && !p.done && !p.def.action && p.x < 108 && remaining(p) > 0; }
  function botTargetPad(b) {
    const lp = game.lastPad ? padById(game.lastPad) : null;
    if (lp && validPad(lp)) return lp;
    let best = null, bd = 1e9;
    for (const p of pads) if (validPad(p)) { const d = Math.abs(p.x - b.x) + Math.abs(p.z - b.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function unclaimedDrop(b, range) {
    let best = null, bd = range * range;
    for (const d of items.drops) {
      if (d.claimed || d.air || d.type !== 'meat' || d.x < 46 || d.x > 108) continue;   // collectors work the forest, not the base
      const q = (d.x - b.x) ** 2 + (d.z - b.z) ** 2;
      if (q < bd) { bd = q; best = d; }
    }
    return best;
  }
  function updateBot(b, dt) {
    b.t += dt; b.scan -= dt;
    const cap = BOT_CAP;
    if (b.state === 'idle') {
      const home = hut || { x: 56, z: -9 };
      if (b.scan <= 0) {
        b.scan = 0.35;
        if (b.carry < cap) {
          const d = unclaimedDrop(b, 70);
          if (d) { d.claimed = b; b.target = d; b.state = 'seek'; }
        }
        if (b.state === 'idle' && b.carry > 0) { b.state = 'deliver'; b.pad = null; }
      }
      if (b.state === 'idle') { const d = Math.hypot(home.x - b.x, home.z + 3 - b.z); if (d > 3) stepBot(b, home.x + (b.t % 3) - 1.5, home.z + 3, dt, 4); else { b.vx = damp(b.vx, 0, 8, dt); b.vz = damp(b.vz, 0, 8, dt); } }
    } else if (b.state === 'seek') {
      const d = b.target;
      if (!d || items.drops.indexOf(d) < 0) { b.target = null; b.state = 'idle'; }
      else {
        const dist = stepBot(b, d.x, d.z, dt);
        if (dist < 1.1) {
          items.takeDrop(d); b.carry++; b.target = null; sfx.pickup();
          fx.burst(b.x, 1, b.z, 3, 0xff8a7a, 3, 0.6, 0.3, 3);
          const nx = b.carry < cap ? unclaimedDrop(b, 6) : null;
          if (nx) { nx.claimed = b; b.target = nx; } else { b.state = 'deliver'; b.pad = null; }
        }
      }
    } else if (b.state === 'deliver') {
      if (b.carry <= 0) { b.state = 'idle'; }
      else {
        if (!b.pad || !validPad(b.pad)) b.pad = botTargetPad(b);
        if (!b.pad) { b.state = 'idle'; b.scan = 1.0; }
        else {
          const dist = stepBot(b, b.pad.x, b.pad.z, dt);
          if (dist < 2.0) {
            b.dropT -= dt;
            if (b.dropT <= 0 && remaining(b.pad) > 0) {
              b.dropT = 0.1; b.carry--; b.pad.fl.m++;
              const pad = b.pad;
              items.flyToPad('meat', { x: b.x, y: 1.4, z: b.z }, pad, () => arrive(pad, 'm'));
              sfx.deposit();
            }
            if (b.carry <= 0 || remaining(b.pad) <= 0) { if (b.carry > 0) b.pad = null; else b.state = 'idle'; }
          }
        }
      }
    }
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.5) b.yaw = angLerp(b.yaw, Math.atan2(b.vx, b.vz), 1 - Math.exp(-12 * dt));
    b.root.position.set(b.x, Math.abs(Math.sin(b.t * 12)) * 0.12 * Math.min(1, sp / 3), b.z);
    b.root.rotation.set(Math.min(0.2, sp * 0.03), b.yaw, 0);
    for (let i = 0; i < BOT_CAP; i++) b.cargo[i].visible = i < b.carry;
    b.ph += dt * (4 + sp * 1.6); setLimb(b.mat, b.ph, 0.9 * Math.min(1, sp / 3), 0.5 * Math.min(1, sp / 3), 0);
  }

  // station props (pack / weapon / boots) standing next to their pad
  const stationGeos = {
    pack: mergeParts([{ t: 'box', s: [1.8, 1.0, 1.3], p: [0, 0.5, 0], c: 0x8a6a3a }, { t: 'box', s: [1.2, 1.5, 0.8], p: [0, 1.75, 0], c: 0x3f9a4a }, { t: 'box', s: [1.0, 0.5, 0.25], p: [0, 1.5, 0.5], c: 0x2f7a3a }, { t: 'box', s: [1.0, 0.25, 0.8], p: [0, 2.6, 0], c: 0x2f7a3a }]),
    weapon: mergeParts([{ t: 'box', s: [1.8, 0.8, 1.2], p: [0, 0.4, 0], c: 0x7a5530 }, { t: 'box', s: [2.2, 0.25, 1.5], p: [0, 0.92, 0], c: 0x9a6c3c },
      ...bowParts({ x: 0, y: 2.1, z: 0.3, R: 0.9, span: 1.1, th: 0.1, color: 0xc89a5a, tip: 0xffd24a }),
      { t: 'cyl', s: [0.2, 0.24, 0.9, 10], p: [0.85, 1.5, -0.2], c: 0x8a4a2a }, { t: 'box', s: [0.05, 0.5, 0.05], p: [0.8, 2.15, -0.2], c: 0xc8a070 }, { t: 'box', s: [0.05, 0.5, 0.05], p: [0.9, 2.1, -0.15], c: 0xc8a070 }, { t: 'box', s: [0.18, 0.12, 0.18], p: [0.85, 2.0, -0.2], c: 0xe0453a }]),
    boots: mergeParts([{ t: 'box', s: [2.0, 0.3, 1.0], p: [0, 0.6, 0], c: 0x7a5530 }, { t: 'box', s: [0.2, 0.6, 0.2], p: [-0.9, 0.3, 0], c: 0x7a5530 }, { t: 'box', s: [0.2, 0.6, 0.2], p: [0.9, 0.3, 0], c: 0x7a5530 }, { t: 'box', s: [0.55, 0.7, 0.4], p: [-0.45, 1.1, 0], c: 0xff9a4d }, { t: 'box', s: [0.8, 0.3, 0.45], p: [-0.35, 0.85, 0.25], c: 0xff9a4d }, { t: 'box', s: [0.55, 0.7, 0.4], p: [0.45, 1.1, 0], c: 0xff9a4d }, { t: 'box', s: [0.8, 0.3, 0.45], p: [0.55, 0.85, 0.25], c: 0xff9a4d }]),
    vest: mergeParts([{ t: 'box', s: [0.3, 2.4, 0.3], p: [0, 1.2, 0], c: 0x7a5530 }, { t: 'box', s: [1.8, 0.2, 0.3], p: [0, 2.2, 0], c: 0x7a5530 }, { t: 'box', s: [1.3, 1.4, 0.6], p: [0, 1.5, 0.1], c: 0x5a7a9a }, { t: 'box', s: [1.0, 0.5, 0.64], p: [0, 1.7, 0.12], c: 0x9dd0ff }, { t: 'box', s: [1.8, 0.3, 1.4], p: [0, 0.15, 0], c: 0x4a4f58 }]),
    evolve: mergeParts([{ t: 'box', s: [2.2, 0.7, 1.3], p: [0, 0.35, 0], c: 0x4a5560 }, { t: 'cyl', s: [0.4, 0.4, 2.0, 8], p: [-0.6, 1.7, 0], c: 0x7fe9ff }, { t: 'cyl', s: [0.4, 0.4, 2.0, 8], p: [0.6, 1.7, 0], c: 0xc58aff }, { t: 'box', s: [2.0, 0.2, 1.0], p: [0, 2.8, 0], c: 0x4a5560 }]),
  };
  for (const p of pads) {
    const g = stationGeos[p.def.kind];
    if (!g) continue;
    const m = new THREE.Mesh(g, matLam); m.position.set(p.x, 0, p.z - 3.7); m.castShadow = m.receiveShadow = true; m.visible = false; group.add(m); p.prop = m;
  }

  // --- effects of completing a level ---------------------------------------------------------------------------------
  const QUIET = ['bridge', 'gate', 'door', 'teleporter', 'refinery', 'ion', 'squad', 'evolve'];   // these toast for themselves
  function applyLevel(p, instant) {
    const lvl = padLvl(p.id), k = p.def.kind;
    switch (k) {
      case 'turret': addTurret('mg', p.x, p.z, instant); break;
      case 'sniper': addTurret('sniper', p.x, p.z, instant); break;
      case 'spikes': addTrap(p.x, p.z, instant); break;
      case 'hut': addHut(p.x, p.z, instant); if (!instant) { state.bots = Math.max(state.bots, 1); addBot(); } break;
      case 'hire': if (!instant) { state.bots++; addBot(); } break;
      case 'pack': if (!instant) { state.packLvl++; game.hud.toast(`🎒 Backpack Lv ${state.packLvl + 1}: capacity ${capacity()}`, 'good'); } break;
      case 'weapon': if (!instant) { state.weaponLvl++; game.hud.toast('🏹 Bow upgraded! Arrows hit harder and fly faster', 'good'); } break;
      case 'boots': if (!instant) { state.bootsLvl++; game.hud.toast(`👟 Speed Boots Lv ${state.bootsLvl}`, 'good'); } break;
      case 'vest': if (!instant) { state.vestLvl++; game.player.hp = 100 + 25 * state.vestLvl; game.hud.toast(`🦺 Armor Vest Lv ${state.vestLvl}: max health ${100 + 25 * state.vestLvl}`, 'good'); } break;
      case 'fence': game.fences.setTier(p.def.arc, lvl, instant); if (!instant) game.hud.toast(`🚧 ${p.def.name}: ${['', 'wooden fence', 'reinforced fence', 'stone wall'][lvl]}! Zombies have to chew through it`, 'good'); break;
      case 'evolve': if (!instant) { state.weaponTier = Math.min(3, state.weaponTier + 1); game.hud.toast(`🧬 Bow evolved: ${TIER_NAMES[state.weaponTier]}!`, 'gold'); sfx.unlock(); fx.burst(game.player.x, 1.5, game.player.z, 30, 0xff5cf4, 9, 1.2, 0.9, 8); } break;
      case 'bridge': state.zoneUnlocked[1] = true; world.showBridge(0, instant); if (!instant) { game.hud.toast('🌉 Bridge built! The Overgrown Forest is open', 'gold'); sfx.unlock(); } break;
      default: heavy.build(k, p, instant);
    }
    if (instant) return;
    fx.burst(p.x, 1, p.z, 28, KIND_COLOR[k] || 0xffffff, 8, 1.2, 0.8, 8);
    fx.addShake(0.25);
    if (!QUIET.includes(k)) { game.hud.toast(`${p.def.icon} ${p.def.name} ${p.def.costs.length > 1 ? 'Lv ' + (lvl + (p.def.base || 0)) : 'built'}!`, 'good'); sfx.build(); }
    if (k === 'pack' || k === 'weapon' || k === 'boots' || k === 'vest') sfx.upgrade();
    if (k === 'squad' || k === 'refinery' || k === 'ion') sfx.build();
    recalcCore();
  }
  function arrive(p, t) {
    p.fl[t] = Math.max(0, p.fl[t] - 1);
    const st = state.pads[p.id] || (state.pads[p.id] = { lvl: 0, prog: 0, sp: 0, ep: 0 });
    if (t === 'm') st.prog++; else if (t === 's') st.sp = (st.sp || 0) + 1; else st.ep = (st.ep || 0) + 1;
    fx.burst(p.x, 0.6, p.z, 1, t === 'e' ? 0x7fe9ff : t === 's' ? 0xb0bac6 : 0xff8a7a, 2, 0.5, 0.25, 2);
    const need = needOf2(p);
    if (st.prog >= need.m && (st.sp || 0) >= need.s && (st.ep || 0) >= need.e) {
      st.lvl++; st.prog = 0; st.sp = 0; st.ep = 0;
      applyLevel(p, false);
      p.key = '';
      game.save();
    }
  }

  // --- pad update ------------------------------------------------------------------------------------------------------
  const FLY = { m: 'meat', s: 'scrap', e: 'energy' };
  function updatePads(dt, t) {
    const pl = game.player;
    for (const p of pads) {
      const vis = padVisible(p);
      if (vis !== p.visible) { p.visible = vis; p.group.visible = vis; p.key = ''; }
      p.done = isBuilt(p.id);
      if (p.prop) p.prop.visible = state.zoneUnlocked[p.def.zone] && p.def.req.every(isBuilt);
      if (!vis) { p.stand = 0; continue; }
      drawLabel(p);
      const on = pl.alive && Math.abs(pl.x - p.x) < PAD_HALF && Math.abs(pl.z - p.z) < PAD_HALF;
      p.pulse += dt * (on ? 8 : 3);
      const sc = 1 + Math.sin(p.pulse) * (on ? 0.04 : 0.025);
      p.frame.scale.set(sc, 1, sc);
      p.spr.position.y = 3.2 + Math.sin(p.pulse * 0.7) * 0.12;
      p.base.material.opacity = on ? 0.4 : 0.22;
      if (p.def.action) {
        // action pads: the refinery converter and the endless-mode switch
        if (on) {
          p.stand += dt;
          if (p.def.kind === 'convert') { if (p.stand > 0.28) heavy.convert(dt, p, p.stand - 0.28); p.fill.scale.y = 0.0001; }
          else { p.fill.scale.y = Math.max(0.0001, Math.min(1, p.stand / 1.2)); if (p.stand > 1.2 && !p.cool) { p.cool = true; game.endless.toggle(); p.key = ''; } }
        } else { p.stand = 0; p.acc = 0; p.cool = false; p.fill.scale.y = 0.0001; }
        continue;
      }
      const need = needOf2(p), prog = progOf(p);
      const tot = need.m + need.s + need.e, got = prog.m + prog.s + prog.e + p.fl.m + p.fl.s + p.fl.e;
      p.fill.scale.y = Math.max(0.0001, got / Math.max(1, tot));
      if (on) {
        p.stand += dt;
        if (p.stand > 0.28) {
          p.acc += dt * (7 + Math.min(34, (p.stand - 0.28) * 16));
          while (p.acc >= 1) {
            p.acc -= 1;
            let type = null;
            if (remT(p, 'm') > 0 && state.carry.meat > 0) type = 'm';
            else if (remT(p, 's') > 0 && state.carry.scrap > 0) type = 's';
            else if (remT(p, 'e') > 0 && state.energy > 0) type = 'e';
            if (!type) { p.acc = 0; break; }
            if (type === 'm') state.carry.meat--; else if (type === 's') state.carry.scrap--; else state.energy--;
            p.fl[type]++; game.lastPad = p.id;
            const from = items.stackTop(pl, { x: 0, y: 0, z: 0 });
            items.flyToPad(FLY[type], { x: from.x, y: from.y + 0.2, z: from.z }, p, () => arrive(p, type));
            sfx.deposit();
          }
        }
      } else { p.stand = 0; p.acc = 0; }
    }
  }

  // --- main update ---------------------------------------------------------------------------------------------------------
  function update(dt, t) {
    updatePads(dt, t);
    for (const tu of turrets) updateTurret(tu, dt);
    for (const tr of traps) updateTrap(tr, dt);
    for (const b of bots) updateBot(b, dt);
    heavy.update(dt, t); game.fences.update(dt);
    if (hut && hut.spawnT < 1) { hut.spawnT = Math.min(1, hut.spawnT + dt * 2.5); const k = 1 - Math.pow(1 - hut.spawnT, 3); hut.m.scale.setScalar(0.01 + k * (1 + Math.sin(k * Math.PI) * 0.12)); }

    // core
    core.hitT = Math.max(0, core.hitT - dt);
    crystal.rotation.y += dt * 0.9; crystal.position.y = 3.0 + Math.sin(t * 2) * 0.15;
    const k = core.hp / core.maxHp;
    crystalMat.emissive.setRGB(0.1 + core.hitT * 3, 0.45 * k, 0.78 * k); crystalMat.color.setRGB(0.3 + (1 - k) * 0.7, 0.78 * k, 1 * k + 0.1);
    glow.material.opacity = 0.35 + 0.15 * Math.sin(t * 3); glow.scale.setScalar(1 + core.hitT * 0.3);
    if (!game.zombies.wave.active && core.hp < core.maxHp) core.hp = Math.min(core.maxHp, core.hp + 18 * dt);
    if (core.hp < core.maxHp || game.zombies.wave.active) fx.bar(core.x, 5.6, core.z, core.hp / core.maxHp);
    state.coreHp = core.hp;
  }

  // --- queries used by other systems / HUD ---------------------------------------------------------------------------------
  function turretCount(zi) { let n = 0; for (const t of turrets) if (zi < 0 || t.zone === zi) n++; return n; }
  function hasDefense(zi) { return turrets.some(t => t.zone === zi) || traps.some(t => world.zoneAt(t.x) === zi) || heavy.defenseIn(zi); }
  const ORDER = ['turret1', 'pack', 'turret2', 'weapon', 'bridge', 'hut', 'sniper1', 'hire', 'boots', 'spike1', 'sniper2', 'spike2', 'spike3', 'gate3',
    'refinery', 'flame1', 'vest', 'pack2', 'weapon2', 'squad', 'door', 'tesla1', 'evolve', 'laser1', 'tesla2', 'laser2', 'tesla3', 'flame2', 'flame3', 'teleporter',
    'gen1', 'gen2', 'gen3', 'gen4', 'ion', 'endless', 'fenceS', 'fenceW', 'fenceN'];
  function objective() {
    for (const id of ORDER) {
      const p = padById(id);
      if (!p || !p.visible || p.done) continue;
      if (p.def.action) return { text: p.def.kind === 'endless' ? '♾️ Stand on the glowing pad to start Endless Survival' : '', pad: p };
      const need = needOf2(p), prog = progOf(p);
      const miss = t => need[t] - prog[t] - p.fl[t];
      const have = { m: state.carry.meat, s: state.carry.scrap, e: state.energy };
      const cost = ['m', 's', 'e'].filter(t => need[t] > 0).map(t => `${prog[t] + p.fl[t]}/${need[t]} ${ICON[t]}`).join('  ');
      const name = p.def.names ? p.def.names[Math.min(padLvl(p.id), p.def.names.length - 1)] : p.def.name;
      // energy comes from the refinery
      if (miss('e') > 0 && have.e < miss('e') && padById('convert') && padById('convert').visible) {
        return { text: have.m > 0 ? '⚡ Stand on the Refinery input pad to turn 🥩 into energy cells' : `Collect 🥩, then convert it to ⚡ for: ${name}`, pad: have.m > 0 ? padById('convert') : p };
      }
      const canGive = (miss('m') > 0 && have.m > 0) || (miss('s') > 0 && have.s > 0) || (miss('e') > 0 && have.e > 0);
      if (canGive) return { text: `Stand on the glowing pad: ${name} (${cost})`, pad: p };
      const lack = miss('s') > 0 && have.s === 0 ? '🔩 scrap (dropped by armored zombies)' : '🥩 meat';
      const first = state.kills < 3 && padLvl('turret1') === 0;
      return { text: first ? 'Shoot zombies and walk over the 🥩 they drop' : `Collect ${lack} to build: ${name} (${cost})`, pad: carried() > 0 ? p : null };
    }
    return { text: state.endless.runs > 0 ? '♾️ Beat your Endless Survival best!' : 'Everything is built! Try Endless Survival at the far end of the Necropolis', pad: null };
  }

  // --- restore a saved game -------------------------------------------------------------------------------------------------
  const HEAVY_KINDS = ['refinery', 'flame', 'tesla', 'laser', 'gen', 'ion', 'teleporter', 'gate', 'door'];
  function restore() {
    if (state.zoneUnlocked[1]) world.showBridge(0, true);
    for (const p of pads) {
      const lvl = padLvl(p.id);
      if (lvl <= 0) continue;
      if (['turret', 'sniper', 'spikes', 'hut', 'fence'].includes(p.def.kind)) applyLevel(p, true);
      else if (HEAVY_KINDS.includes(p.def.kind)) heavy.build(p.def.kind, p, true);
    }
    heavy.restoreSoldiers();
    const n = Math.min(state.bots, 6);
    for (let i = 0; i < n; i++) addBot(true);
    core.maxHp = 600 + 120 * turretCount(0);
    core.hp = state.coreHp > 0 ? Math.min(state.coreHp, core.maxHp) : core.maxHp;
    for (const p of pads) { p.visible = padVisible(p); p.group.visible = p.visible; }
  }

  restore();
  return { core, pads, update, turretCount, hasDefense, objective, hitCoreAt, coreFailed, padById, bots, turrets, restore, padVisible, heavy };
}
