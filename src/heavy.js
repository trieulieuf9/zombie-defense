// Late-game structures: gates/doors, refinery (meat -> energy), flame turrets, tesla coils, laser walls, AI gunners,
// teleporters, ion generators and the Orbital Ion Cannon. Created by buildings.js; `build()` is called when a pad level completes.
import * as THREE from 'three';
import { state } from './state.js';
import { mergeParts, vcMat, limbMaterial, limbDepth, setLimb, rnd, damp, angLerp, clamp, TAU } from './util.js';
import { soldierGeo } from './models.js';
import { sfx } from './audio.js';
import { TELE_A, TELE_B } from './world.js';

export function createHeavy(scene, game, ctx) {
  const { matLam, group } = ctx;
  const world = game.world, fx = game.fx, items = game.items;
  const glow = c => new THREE.MeshBasicMaterial({ color: c });

  // ===========================================================================================================
  // Beams: thin glowing boxes between two points (lightning, lasers, the ion beam). Re-added every frame.
  // ===========================================================================================================
  const MAXBEAM = 260;
  const beamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXBEAM);
  beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beamMesh.frustumCulled = false; beamMesh.count = 0; beamMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(beamMesh);
  const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bd = new THREE.Vector3(), _fw = new THREE.Vector3(0, 0, 1), _bc = new THREE.Color();
  let nb = 0;
  function beam(x0, y0, z0, x1, y1, z1, th, color) {
    if (nb >= MAXBEAM) return;
    _bd.set(x1 - x0, y1 - y0, z1 - z0); const len = _bd.length(); if (len < 0.01) return;
    _bd.multiplyScalar(1 / len); _bq.setFromUnitVectors(_fw, _bd);
    _bm.compose(_bp.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), _bq, _bs.set(th, th, len));
    beamMesh.setMatrixAt(nb, _bm); beamMesh.setColorAt(nb, _bc.set(color)); nb++;
  }
  function bolt(x0, y0, z0, x1, y1, z1, th, color, segs = 5, jit = 0.5) {
    let px = x0, py = y0, pz = z0;
    for (let i = 1; i <= segs; i++) {
      const k = i / segs, last = i === segs;
      const nx = last ? x1 : x0 + (x1 - x0) * k + rnd(-jit, jit), ny = last ? y1 : y0 + (y1 - y0) * k + rnd(-jit, jit) * 0.6, nz = last ? z1 : z0 + (z1 - z0) * k + rnd(-jit, jit);
      beam(px, py, pz, nx, ny, nz, th, color); px = nx; py = ny; pz = nz;
    }
  }

  // ===========================================================================================================
  // Gates / blast doors
  // ===========================================================================================================
  const gates = {};
  function makeGate(key, x, style) {
    const g = new THREE.Group(); g.position.set(x, 0, 0); group.add(g);
    const steel = style === 'steel';
    const pillar = mergeParts([{ t: 'box', s: [1.3, 5, 1.3], p: [0, 2.5, 0], c: steel ? 0x59626e : 0x7a808c }, { t: 'box', s: [1.6, 0.4, 1.6], p: [0, 5.1, 0], c: steel ? 0x3a424c : 0x59606b }]);
    for (const zs of [-1, 1]) { const p = new THREE.Mesh(pillar, matLam); p.position.z = zs * 3.9; p.castShadow = true; g.add(p); }
    const beamM = new THREE.Mesh(mergeParts([{ t: 'box', s: [1.3, 0.8, 9.2], p: [0, 5.2, 0], c: steel ? 0x3a424c : 0x59606b }, { t: 'box', s: [0.2, 0.6, 3.6], p: [0.7, 5.2, 0], c: steel ? 0xff4d3a : 0xffe14d }]), matLam); beamM.castShadow = true; g.add(beamM);
    const leafGeo = mergeParts(steel
      ? [{ t: 'box', s: [0.45, 4.2, 3.4], p: [0, 2.1, -1.7], c: 0x6a7078 }, { t: 'box', s: [0.5, 0.5, 3.4], p: [0, 3.4, -1.7], c: 0xe0b020 }, { t: 'box', s: [0.5, 0.5, 3.4], p: [0, 1.0, -1.7], c: 0xe0b020 }, { t: 'box', s: [0.55, 0.3, 0.3], p: [0, 2.1, -3.2], c: 0xff4d3a }]
      : [{ t: 'box', s: [0.4, 4.2, 3.4], p: [0, 2.1, -1.7], c: 0x8a5a36 }, { t: 'box', s: [0.46, 0.35, 3.4], p: [0, 3.3, -1.7], c: 0x59606b }, { t: 'box', s: [0.46, 0.35, 3.4], p: [0, 1.0, -1.7], c: 0x59606b }, { t: 'box', s: [0.5, 0.25, 0.25], p: [0, 2.1, -3.2], c: 0xffe14d }]);
    const leaves = [];
    for (const zs of [-1, 1]) { const piv = new THREE.Group(); piv.position.z = zs * 3.3; const l = new THREE.Mesh(leafGeo, matLam); l.castShadow = true; l.scale.z = -zs; piv.add(l); g.add(piv); leaves.push({ piv, zs }); }
    gates[key] = { g, leaves, open: false, k: 0 };
  }
  makeGate('gate3', 104.4, 'wood');
  makeGate('door', 180.4, 'steel');
  function setGate(key, open, instant) {
    const gt = gates[key]; gt.open = open; if (instant && open) { gt.k = 1; gt.leaves.forEach(l => (l.piv.rotation.y = l.zs * 1.7)); }
  }

  // ===========================================================================================================
  // Refinery (meat -> energy cells)
  // ===========================================================================================================
  const refGeo = mergeParts([
    { t: 'box', s: [4.6, 2.6, 3.4], p: [0, 1.3, 0], c: 0x8a8f96 }, { t: 'box', s: [4.8, 0.3, 3.6], p: [0, 2.7, 0], c: 0x5a6068 },
    { t: 'cyl', s: [1.0, 1.0, 3.6, 10], p: [-2.9, 1.8, -0.6], c: 0xd9822b }, { t: 'cyl', s: [1.05, 1.05, 0.25, 10], p: [-2.9, 3.7, -0.6], c: 0x7a4a14 },
    { t: 'cyl', s: [0.8, 0.8, 3.0, 10], p: [2.9, 1.5, -0.6], c: 0x3a8ac0 }, { t: 'cyl', s: [0.85, 0.85, 0.25, 10], p: [2.9, 3.1, -0.6], c: 0x1f4a70 },
    { t: 'cyl', s: [0.35, 0.5, 4.2, 8], p: [1.2, 4.7, -0.8], c: 0x6a4a3a }, { t: 'cyl', s: [0.42, 0.42, 0.2, 8], p: [1.2, 6.8, -0.8], c: 0x2a2a2a },
    { t: 'box', s: [0.25, 0.25, 3.0], p: [-1.2, 2.2, 1.9], c: 0x4a4a52 }, { t: 'box', s: [1.4, 1.0, 0.12], p: [0, 1.4, 1.75], c: 0x2a3a2a }, { t: 'box', s: [1.0, 0.6, 0.14], p: [0, 1.5, 1.78], c: 0x6aff8a },
  ]);
  const refinery = { built: false, x: 0, z: 0, mesh: null, pending: 0, ob: null, smoke: 0, pulse: 0 };
  function buildRefinery(pad, instant) {
    refinery.built = true; refinery.x = pad.x; refinery.z = pad.z;
    const m = new THREE.Mesh(refGeo, matLam); m.position.set(pad.x, 0, pad.z); m.castShadow = m.receiveShadow = true; group.add(m); refinery.mesh = m;
    refinery.ob = world.addObstacle(pad.x, pad.z, 3.0);
    if (!instant) m.scale.setScalar(0.01); refinery.spawnT = instant ? 1 : 0;
  }
  /** Called by buildings.js every frame the player stands on the converter pad. */
  function convert(dt, pad, stand) {
    if (!refinery.built) return;
    pad.acc += dt * (4 + Math.min(14, stand * 8));
    while (pad.acc >= 1) {
      pad.acc -= 1;
      if (state.carry.meat <= 0 || state.energy >= 999) { pad.acc = 0; break; }
      state.carry.meat--;
      const from = items.stackTop(game.player, { x: 0, y: 0, z: 0 });
      items.flyToPad('meat', { x: from.x, y: from.y + 0.2, z: from.z }, { x: refinery.x, z: refinery.z + 1.7 }, () => {
        refinery.pending++; refinery.pulse = 1;
        if (refinery.pending >= 2) {
          refinery.pending = 0; state.energy = Math.min(999, state.energy + 1);
          fx.text(refinery.x, 4.2, refinery.z, '+1 ⚡', '#7fe9ff', 1.1); fx.burst(refinery.x, 3, refinery.z + 1.7, 5, 0x7fe9ff, 4, 0.9, 0.5, 5); sfx.upgrade();
        }
      });
      sfx.deposit();
    }
  }

  // ===========================================================================================================
  // Flame turrets
  // ===========================================================================================================
  const flameBase = mergeParts([{ t: 'cyl', s: [1.0, 1.15, 0.5, 10], p: [0, 0.25, 0], c: 0x4a4048 }, { t: 'cyl', s: [0.55, 0.55, 1.5, 10], p: [0, 1.25, -0.55], c: 0xc0392b }, { t: 'cyl', s: [0.58, 0.58, 0.18, 10], p: [0, 2.05, -0.55], c: 0x7a1f14 }, { t: 'cyl', s: [0.4, 0.5, 0.5, 8], p: [0, 0.7, 0], c: 0x6b727c }]);
  const flameHead = mergeParts([{ t: 'box', s: [0.8, 0.6, 0.9], p: [0, 0, 0], c: 0xd9822b }, { t: 'cyl', s: [0.17, 0.2, 1.3, 8], p: [0, 0, 1.0], r: [Math.PI / 2, 0, 0], c: 0x2a2a2a }, { t: 'sph', s: [0.17], p: [0, 0, 1.7], c: 0xffa733 }]);
  const flames = [];
  function addFlame(pad, instant) {
    const base = new THREE.Mesh(flameBase, matLam), head = new THREE.Mesh(flameHead, matLam);
    base.position.set(pad.x, 0, pad.z); head.position.set(pad.x, 1.25, pad.z); base.castShadow = head.castShadow = true; group.add(base); group.add(head);
    const t = { x: pad.x, z: pad.z, base, head, yaw: 0, cd: 0, firing: 0, range: 9, ob: world.addObstacle(pad.x, pad.z, 1.0), spawnT: instant ? 1 : 0 };
    if (!instant) { base.scale.setScalar(0.01); head.scale.setScalar(0.01); }
    flames.push(t);
  }
  function updateFlame(t, dt) {
    if (t.spawnT < 1) { t.spawnT = Math.min(1, t.spawnT + dt * 3); const k = 1 - Math.pow(1 - t.spawnT, 3); t.base.scale.setScalar(0.01 + k); t.head.scale.setScalar(0.01 + k); }
    t.cd -= dt;
    const z = game.zombies.nearest(t.x, t.z, t.range);
    t.firing = Math.max(0, t.firing - dt);
    if (z) {
      const want = Math.atan2(z.x - t.x, z.z - t.z);
      t.yaw = angLerp(t.yaw, want, 1 - Math.exp(-10 * dt));
      if (t.cd <= 0) {
        t.cd = 0.12; t.firing = 0.2;
        const sx = Math.sin(t.yaw), cz = Math.cos(t.yaw);
        for (const q of game.zombies.list.slice()) {
          const dx = q.x - t.x, dz = q.z - t.z, d = Math.hypot(dx, dz);
          if (d > t.range + q.r) continue;
          const a = Math.atan2(dx, dz);
          if (Math.abs(Math.atan2(Math.sin(a - t.yaw), Math.cos(a - t.yaw))) < 0.5 + q.r / Math.max(2, d)) game.zombies.hit(q, 7 + state.weaponLvl * 0.4, 0, 0, 'flame');
        }
        fx.spray(t.x + sx * 1.9, 1.25, t.z + cz * 1.9, sx, cz, 5, Math.random() < 0.5 ? 0xff8a2a : 0xffd24a, 11, 0.22, 0.5, 1.5);
        sfx.flame();
      }
    }
    t.head.rotation.y = t.yaw;
  }

  // ===========================================================================================================
  // Tesla coils
  // ===========================================================================================================
  const teslaBase = mergeParts([
    { t: 'box', s: [1.8, 0.45, 1.8], p: [0, 0.22, 0], c: 0x4a5058 }, { t: 'cyl', s: [0.5, 0.65, 3.3, 8], p: [0, 2.1, 0], c: 0x8a9098 },
    { t: 'cyl', s: [0.85, 0.85, 0.14, 10], p: [0, 1.2, 0], c: 0xc8782a }, { t: 'cyl', s: [0.8, 0.8, 0.14, 10], p: [0, 2.0, 0], c: 0xc8782a }, { t: 'cyl', s: [0.75, 0.75, 0.14, 10], p: [0, 2.8, 0], c: 0xc8782a },
    { t: 'cyl', s: [0.35, 0.5, 0.4, 8], p: [0, 3.9, 0], c: 0x4a5058 },
  ]);
  const orbGeo = new THREE.SphereGeometry(0.55, 12, 8);
  const teslas = [], bolts = [];
  function addTesla(pad, instant) {
    const base = new THREE.Mesh(teslaBase, matLam); base.position.set(pad.x, 0, pad.z); base.castShadow = true; group.add(base);
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0x7fe9ff })); orb.position.set(pad.x, 4.4, pad.z); group.add(orb);
    const t = { x: pad.x, z: pad.z, base, orb, cd: rnd(0, 1), range: 12.5, ob: world.addObstacle(pad.x, pad.z, 1.1), spawnT: instant ? 1 : 0, ph: rnd(0, 6) };
    if (!instant) { base.scale.setScalar(0.01); orb.scale.setScalar(0.01); }
    teslas.push(t);
  }
  function updateTesla(t, dt, time) {
    if (t.spawnT < 1) { t.spawnT = Math.min(1, t.spawnT + dt * 3); const k = 1 - Math.pow(1 - t.spawnT, 3); t.base.scale.setScalar(0.01 + k); t.orb.scale.setScalar(0.01 + k); }
    t.cd -= dt;
    t.orb.scale.setScalar(1 + Math.sin(time * 9 + t.ph) * 0.12);
    const first = t.cd <= 0 ? game.zombies.nearest(t.x, t.z, t.range) : null;
    if (first) {
      t.cd = 1.15;
      const chain = [first]; let last = first;
      for (let k = 0; k < 3; k++) {
        let best = null, bd = 6.5 * 6.5;
        for (const q of game.zombies.list) { if (chain.includes(q)) continue; const d = (q.x - last.x) ** 2 + (q.z - last.z) ** 2; if (d < bd) { bd = d; best = q; } }
        if (!best) break; chain.push(best); last = best;
      }
      const pts = [{ x: t.x, y: 4.4, z: t.z }, ...chain.map(q => ({ x: q.x, y: 1.3 * (q.sc || 1), z: q.z }))];
      bolts.push({ pts, ttl: 0.22 });
      for (const q of chain) game.zombies.hit(q, 38 + state.weaponLvl * 2, 0, 0, 'tesla');
      sfx.zap();
    }
  }

  // ===========================================================================================================
  // Laser walls
  // ===========================================================================================================
  const lasers = [];
  const postGeo = mergeParts([{ t: 'box', s: [0.5, 2.4, 0.5], p: [0, 1.2, 0], c: 0x4a5058 }, { t: 'box', s: [0.7, 0.25, 0.7], p: [0, 2.5, 0], c: 0xff3a3a }]);
  function addLaser(pad, instant) {
    const hl = 4.5, a = new THREE.Mesh(postGeo, matLam), b = new THREE.Mesh(postGeo, matLam);
    a.position.set(pad.x, 0, pad.z - hl); b.position.set(pad.x, 0, pad.z + hl); a.castShadow = b.castShadow = true; group.add(a); group.add(b);
    const l = { x: pad.x, z0: pad.z - hl, z1: pad.z + hl, a, b, cd: 0, obs: [world.addObstacle(pad.x, pad.z - hl, 0.5), world.addObstacle(pad.x, pad.z + hl, 0.5)], spawnT: instant ? 1 : 0 };
    if (!instant) { a.scale.setScalar(0.01); b.scale.setScalar(0.01); }
    lasers.push(l);
  }
  function updateLaser(l, dt, time) {
    if (l.spawnT < 1) { l.spawnT = Math.min(1, l.spawnT + dt * 3); const k = 1 - Math.pow(1 - l.spawnT, 3); l.a.scale.setScalar(0.01 + k); l.b.scale.setScalar(0.01 + k); return; }
    const fl = 0.85 + Math.sin(time * 40) * 0.15;
    beam(l.x, 0.9, l.z0, l.x, 0.9, l.z1, 0.1 * fl, 0xff3a3a); beam(l.x, 1.7, l.z0, l.x, 1.7, l.z1, 0.1 * fl, 0xff6a5a);
    l.cd -= dt;
    if (l.cd <= 0) {
      l.cd = 0.12; let hits = 0;
      for (const q of game.zombies.list.slice()) {
        if (Math.abs(q.x - l.x) < 0.7 + q.r && q.z > l.z0 - 0.3 && q.z < l.z1 + 0.3) { game.zombies.hit(q, 9 + state.weaponLvl * 0.5, 0, 0, 'laser'); hits++; fx.burst(q.x, 1.0, q.z, 1, 0xff6a5a, 3, 0.5, 0.25, 3); }
      }
      if (hits) sfx.laser();
    }
  }

  // ===========================================================================================================
  // AI gunner squad
  // ===========================================================================================================
  const soldierG = soldierGeo();
  const soldiers = [];
  function addSoldier(instant) {
    const root = new THREE.Group(); const smat = limbMaterial(); const body = new THREE.Mesh(soldierG, smat); body.castShadow = true; body.customDepthMaterial = limbDepth(smat); root.add(body); root.rotation.order = 'YXZ'; root.scale.setScalar(1.05); group.add(root);
    const pl = game.player, idx = soldiers.length;
    const s = { x: pl.x + rnd(-2, 2), z: pl.z + rnd(1, 3), vx: 0, vz: 0, yaw: 0, r: 0.5, cd: rnd(0, 0.4), t: rnd(0, 6), root, idx, shoot: 0, mat: smat, ph: 0 };
    root.position.set(s.x, 0, s.z); soldiers.push(s);
    if (!instant) fx.burst(s.x, 1, s.z, 10, 0x9dff9d, 5, 1, 0.6, 5);
  }
  function updateSoldier(s, dt) {
    const pl = game.player; s.t += dt; s.cd -= dt; s.shoot = Math.max(0, s.shoot - dt);
    const n = soldiers.length, a = s.idx * TAU / Math.max(1, n) + s.t * 0.15 + Math.PI, R = 3.4;
    const tx = pl.x + Math.cos(a) * R, tz = pl.z + Math.sin(a) * R;
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d > 45) { s.x = pl.x + 2; s.z = pl.z + 2; }
    const z = game.zombies.nearest(s.x, s.z, 11);
    const sp = z ? Math.min(d * 2.2, 3) : Math.min(d * 3, 9.5);
    s.vx = damp(s.vx, d > 0.4 ? dx / d * sp : 0, 8, dt); s.vz = damp(s.vz, d > 0.4 ? dz / d * sp : 0, 8, dt);
    world.move(s, s.vx * dt, s.vz * dt, s.r);
    let face = Math.atan2(s.vx, s.vz), moving = Math.hypot(s.vx, s.vz) > 0.5;
    if (z) {
      face = Math.atan2(z.x - s.x, z.z - s.z);
      if (s.cd <= 0 && Math.abs(Math.atan2(Math.sin(face - s.yaw), Math.cos(face - s.yaw))) < 0.35) {
        s.cd = 0.3; s.shoot = 0.1;
        game.projectiles.fire({ x: s.x + Math.sin(face) * 0.9, z: s.z + Math.cos(face) * 0.9, angle: face + rnd(-0.05, 0.05), dmg: 4.5 + state.weaponLvl * 0.7, speed: 34, range: 12, kind: 'gunner', y: 1.1, ap: 0.2 });
        fx.burst(s.x + Math.sin(face), 1.15, s.z + Math.cos(face), 1, 0xffe27a, 2, 0.5, 0.15, 1); sfx.turret();
      }
    }
    if (moving || z) s.yaw = angLerp(s.yaw, face, 1 - Math.exp(-14 * dt));
    s.root.position.set(s.x, Math.abs(Math.sin(s.t * 12)) * 0.1 * (moving ? 1 : 0), s.z);
    s.root.rotation.set(moving ? 0.1 : 0, s.yaw, 0);
    const spd = Math.hypot(s.vx, s.vz); s.ph += dt * (3 + spd * 1.5); setLimb(s.mat, s.ph, 0.8 * Math.min(1, spd / 3), 0, 0);
  }

  // ===========================================================================================================
  // Teleporters (zone 4 <-> zone 5)
  // ===========================================================================================================
  const portals = [];
  const portalBase = mergeParts([{ t: 'cyl', s: [2.2, 2.4, 0.3, 16], p: [0, 0.15, 0], c: 0x3a3a5a }, { t: 'cyl', s: [1.6, 1.6, 0.12, 16], p: [0, 0.34, 0], c: 0x7fe9ff }]);
  const ringGeo = new THREE.TorusGeometry(1.8, 0.22, 8, 24);
  function addPortal(at, exit) {
    const g = new THREE.Group(); g.position.set(at.x, 0, at.z); group.add(g);
    const b = new THREE.Mesh(portalBase, matLam); b.castShadow = true; g.add(b);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9a7dff })); ring.position.y = 2.2; ring.rotation.y = Math.PI / 2; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); disc.position.y = 2.2; disc.rotation.y = Math.PI / 2; g.add(disc);
    portals.push({ at, exit, g, ring, disc, ph: rnd(0, 6) });
  }
  function buildTeleporter(instant) {
    if (portals.length) return;
    addPortal(TELE_A, { x: TELE_B.x + 3.6, z: 0 });
    addPortal(TELE_B, { x: TELE_A.x - 3.6, z: 0 });
    if (!instant) { sfx.teleport(); fx.burst(TELE_A.x, 2, 0, 24, 0x9a7dff, 7, 1.2, 0.9, 7); }
  }
  let teleCd = 0;
  function updatePortals(dt, time) {
    teleCd -= dt;
    for (const p of portals) {
      p.ring.rotation.z += dt * 1.6; p.disc.material.opacity = 0.35 + Math.sin(time * 4 + p.ph) * 0.12; p.ring.scale.setScalar(1 + Math.sin(time * 3 + p.ph) * 0.03);
      const pl = game.player;
      if (pl.alive && teleCd <= 0 && (pl.x - p.at.x) ** 2 + (pl.z - p.at.z) ** 2 < 1.7 * 1.7) {
        fx.burst(pl.x, 1, pl.z, 16, 0x9a7dff, 6, 1, 0.6, 5);
        pl.x = p.exit.x; pl.z = p.exit.z; pl.vx = pl.vz = 0; teleCd = 2.2; game.camSnap = true;
        fx.burst(pl.x, 1, pl.z, 16, 0x7fe9ff, 6, 1, 0.6, 5); sfx.teleport(); fx.addShake(0.25);
        for (const s of soldiers) { s.x = pl.x + rnd(-2, 2); s.z = pl.z + rnd(-2, 2); }
      }
    }
  }

  // ===========================================================================================================
  // Ion generators + Orbital Ion Cannon
  // ===========================================================================================================
  const genBase = mergeParts([{ t: 'cyl', s: [1.4, 1.6, 0.6, 10], p: [0, 0.3, 0], c: 0x3a3a52 }, { t: 'cyl', s: [0.35, 0.35, 3.0, 8], p: [0, 2.1, 0], c: 0x5a5a7a }, { t: 'cyl', s: [0.9, 0.9, 0.3, 10], p: [0, 3.7, 0], c: 0x3a3a52 }, { t: 'box', s: [0.3, 1.2, 0.3], p: [1.1, 1.0, 0], c: 0x7fe9ff }, { t: 'box', s: [0.3, 1.2, 0.3], p: [-1.1, 1.0, 0], c: 0x7fe9ff }]);
  const gens = [];
  function addGen(pad, instant) {
    const base = new THREE.Mesh(genBase, matLam); base.position.set(pad.x, 0, pad.z); base.castShadow = true; group.add(base);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x7fe9ff })); orb.position.set(pad.x, 4.7, pad.z); group.add(orb);
    const g = { x: pad.x, z: pad.z, base, orb, ph: rnd(0, 6), spawnT: instant ? 1 : 0, ob: world.addObstacle(pad.x, pad.z, 1.5) };
    if (!instant) { base.scale.setScalar(0.01); orb.scale.setScalar(0.01); }
    gens.push(g);
  }
  const ion = { built: false, x: 0, z: 0, cd: 20, maxCd: 40, strikes: [], rings: [], parts: null, spin: 0, spawnT: 1 };
  const ionBase = mergeParts([
    { t: 'cyl', s: [3.8, 4.2, 0.8, 16], p: [0, 0.4, 0], c: 0x2a2a3e }, { t: 'cyl', s: [3.0, 3.4, 0.6, 16], p: [0, 1.1, 0], c: 0x3a3a52 },
    { t: 'cyl', s: [1.0, 1.4, 7.5, 10], p: [0, 5.0, 0], c: 0x5a5a7a }, { t: 'cyl', s: [1.3, 1.3, 0.5, 10], p: [0, 9.0, 0], c: 0x2a2a3e },
    ...[[3.1, 0], [-3.1, 0], [0, 3.1], [0, -3.1]].map(([x, z]) => ({ t: 'box', s: [0.7, 3.6, 0.7], p: [x, 2.6, z], c: 0x4a4a68 })),
  ]);
  function buildIon(pad, instant) {
    ion.built = true; ion.x = pad.x; ion.z = pad.z; ion.cd = 25;
    const m = new THREE.Mesh(ionBase, matLam); m.position.set(pad.x, 0, pad.z); m.castShadow = true; group.add(m); ion.mesh = m;
    ion.orb = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), new THREE.MeshBasicMaterial({ color: 0xbfe9ff })); ion.orb.position.set(pad.x, 10.2, pad.z); group.add(ion.orb);
    ion.ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0x7fe9ff })); ion.ring.position.set(pad.x, 7.6, pad.z); ion.ring.rotation.x = Math.PI / 2; group.add(ion.ring);
    ion.ob = world.addObstacle(pad.x, pad.z, 3.6);
    if (!instant) { m.scale.setScalar(0.01); ion.spawnT = 0; fx.burst(pad.x, 3, pad.z, 40, 0x7fe9ff, 10, 1.4, 1.0, 10); }
    for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.14; r.visible = false; scene.add(r); ion.rings.push(r); }
  }
  function ionTargets() {
    const out = [];
    for (const q of game.zombies.list) {
      if (!q.alive || q.rise < 0.5) continue;
      if (q.x > 268 || q.isWave) out.push(q);
    }
    out.sort((a, b) => (b.def.boss ? 1e5 : b.maxHp) - (a.def.boss ? 1e5 : a.maxHp));
    return out;
  }
  function updateIon(dt, time) {
    if (!ion.built) return;
    if (ion.spawnT < 1) { ion.spawnT = Math.min(1, ion.spawnT + dt * 1.5); ion.mesh.scale.setScalar(0.01 + (1 - Math.pow(1 - ion.spawnT, 3))); }
    ion.spin += dt; ion.ring.rotation.z = ion.spin * 2; ion.ring.position.y = 7.6 + Math.sin(time * 2) * 0.3; ion.orb.scale.setScalar(1 + Math.sin(time * 6) * 0.1 + Math.max(0, 1 - ion.cd / 3) * 0.4);
    // charging beams from the generators
    const nGen = gens.length;
    for (const g of gens) { g.orb.rotation.y += dt * 2; g.orb.position.y = 4.7 + Math.sin(time * 3 + g.ph) * 0.15; if (nGen >= 4 && g.spawnT >= 1) bolt(g.x, 4.7, g.z, ion.x, 9.8, ion.z, 0.07, 0x7fe9ff, 4, 0.5); }
    ion.cd -= dt;
    if (ion.cd <= 0) {
      const tg = ionTargets();
      if (!tg.length) ion.cd = 3;
      else {
        ion.cd = ion.maxCd;
        const n = Math.min(10, tg.length), seen = [];
        for (let i = 0; i < n; i++) { const q = tg[i]; if (seen.some(s => (s.x - q.x) ** 2 + (s.z - q.z) ** 2 < 25)) continue; seen.push({ x: q.x, z: q.z }); }
        ion.strikes = seen.map((s, i) => ({ x: s.x, z: s.z, t: -i * 0.22, state: 0, ttl: 0 }));
        game.hud.toast('☄️ Orbital Ion Cannon firing!', 'gold'); sfx.ion(); fx.addShake(0.4);
      }
    }
    // strikes: telegraph ring, then beam
    let ri = 0;
    for (let i = ion.strikes.length - 1; i >= 0; i--) {
      const s = ion.strikes[i]; s.t += dt;
      if (s.t < 0) continue;
      if (s.state === 0) {
        const r = ion.rings[ri++]; if (r) { r.visible = true; r.position.x = s.x; r.position.z = s.z; const k = clamp(s.t / 0.7, 0, 1); r.scale.set(4.4 * (0.5 + 0.5 * k), 4.4 * (0.5 + 0.5 * k), 1); r.material.opacity = 0.3 + 0.6 * k; }
        if (s.t >= 0.7) { s.state = 1; s.ttl = 0.4; game.zombies.areaHit(s.x, s.z, 4.4, 650, 'ion'); fx.burst(s.x, 1, s.z, 30, 0xbfe9ff, 12, 1.4, 0.8, 9); fx.addShake(0.5); sfx.boom(); }
      } else {
        s.ttl -= dt; const w = 1.2 * (s.ttl / 0.4) + 0.3;
        beam(s.x, 70, s.z, s.x, 0, s.z, w * 1.8, 0x7fe9ff); beam(s.x, 70, s.z, s.x, 0, s.z, w, 0xffffff);
        if (s.ttl <= 0) ion.strikes.splice(i, 1);
      }
    }
    for (let k = ri; k < ion.rings.length; k++) ion.rings[k].visible = false;
  }

  // ===========================================================================================================
  // build / update entry points
  // ===========================================================================================================
  function build(kind, pad, instant) {
    switch (kind) {
      case 'refinery': buildRefinery(pad, instant); if (!instant) game.hud.toast('🏭 Refinery online! Stand on its input pad to turn 🥩 into ⚡', 'gold'); return true;
      case 'flame': addFlame(pad, instant); return true;
      case 'tesla': addTesla(pad, instant); return true;
      case 'laser': addLaser(pad, instant); return true;
      case 'squad': if (!instant) { state.gunners += 2; addSoldier(false); addSoldier(false); game.hud.toast('🪖 Gunner squad reporting! They follow you and shoot', 'good'); } return true;
      case 'gen': addGen(pad, instant); return true;
      case 'ion': buildIon(pad, instant); if (!instant) game.hud.toast('☄️ Ion Cannon ready! Endless Survival unlocked', 'gold'); return true;
      case 'teleporter':
        state.zoneUnlocked[4] = true; buildTeleporter(instant);
        if (!instant) game.hud.toast('🌀 Teleporter online! Step into it to reach the Necropolis', 'gold');
        return true;
      case 'gate': state.zoneUnlocked[2] = true; setGate('gate3', true, instant); world.showBridge(1, instant); if (!instant) { game.hud.toast('🚪 The gate is open! The Abandoned Highway awaits', 'gold'); sfx.unlock(); } return true;
      case 'door': state.zoneUnlocked[3] = true; setGate('door', true, instant); world.showBridge(2, instant); if (!instant) { game.hud.toast('🚪 Blast door open! The Bio-Lab Ruins awaits', 'gold'); sfx.unlock(); } return true;
    }
    return false;
  }
  function restoreSoldiers() { for (let i = 0; i < Math.min(state.gunners, 8); i++) addSoldier(true); }

  function update(dt, time) {
    nb = 0;
    for (const t of flames) updateFlame(t, dt);
    for (const t of teslas) updateTesla(t, dt, time);
    for (const l of lasers) updateLaser(l, dt, time);
    for (const s of soldiers) updateSoldier(s, dt);
    for (const g of gens) { if (g.spawnT < 1) { g.spawnT = Math.min(1, g.spawnT + dt * 3); const k = 0.01 + (1 - Math.pow(1 - g.spawnT, 3)); g.base.scale.setScalar(k); g.orb.scale.setScalar(k); } }
    updateIon(dt, time);
    updatePortals(dt, time);
    for (const gt of Object.values(gates)) if (gt.open && gt.k < 1) { gt.k = Math.min(1, gt.k + dt * 0.8); gt.leaves.forEach(l => (l.piv.rotation.y = l.zs * gt.k * 1.7)); }
    if (refinery.built) {
      if (refinery.spawnT < 1) { refinery.spawnT = Math.min(1, refinery.spawnT + dt * 2.5); refinery.mesh.scale.setScalar(0.01 + (1 - Math.pow(1 - refinery.spawnT, 3))); }
      refinery.smoke -= dt; refinery.pulse = Math.max(0, refinery.pulse - dt * 3);
      if (refinery.smoke <= 0) { refinery.smoke = 0.35; fx.burst(refinery.x + 1.2, 7, refinery.z - 0.8, 1, 0x9a9a9a, 0.8, 1.4, 1.2, 1.5); }
    }
    // lightning bolts (short-lived)
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.ttl -= dt;
      for (let k = 0; k + 1 < b.pts.length; k++) { const a = b.pts[k], c = b.pts[k + 1]; bolt(a.x, a.y, a.z, c.x, c.y, c.z, 0.13, 0xbff4ff, 5, 0.45); bolt(a.x, a.y, a.z, c.x, c.y, c.z, 0.05, 0xffffff, 4, 0.25); }
      if (b.ttl <= 0) bolts.splice(i, 1);
    }
    beamMesh.count = nb; beamMesh.instanceMatrix.needsUpdate = true; if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true;
  }

  const defenseIn = zi => flames.some(t => world.zoneAt(t.x) === zi) || teslas.some(t => world.zoneAt(t.x) === zi) || lasers.some(t => world.zoneAt(t.x) === zi) || (ion.built && zi === 4) || (soldiers.length > 0 && game.player && world.zoneAt(game.player.x) === zi);
  return { build, update, convert, defenseIn, restoreSoldiers, refinery, ion, soldiers, setGate, gates, buildTeleporter };
}
