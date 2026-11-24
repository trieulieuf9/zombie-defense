// Resource items: ground drops, the wobbly stack on the player's back, and arcs flying into build pads.
// Everything is drawn with one InstancedMesh per resource type (meat / scrap), so hundreds of items cost two draw calls.
import * as THREE from 'three';
import { state, carried, capacity } from './state.js';
import { mergeParts, vcMat, rnd, clamp } from './util.js';
import { sfx } from './audio.js';

const MAX = 700;
const GROUND_Y = 0.22;
const TYPES = ['meat', 'scrap', 'energy'];
const STACKED = ['meat', 'scrap'];            // only these are carried on the back

export function createItems(scene, fx) {
  const geos = {
    meat: mergeParts([
      { t: 'box', s: [0.52, 0.2, 0.38], p: [0, 0, 0], c: 0xd9453d },
      { t: 'box', s: [0.34, 0.04, 0.22], p: [0, 0.1, 0], c: 0xf5a095 },
      { t: 'cyl', s: [0.06, 0.06, 0.34, 6], p: [0.36, 0, 0], r: [0, 0, Math.PI / 2], c: 0xf4ecdd },
      { t: 'sph', s: [0.09], p: [0.54, 0, 0.05], c: 0xf4ecdd },
    ]),
    scrap: mergeParts([
      { t: 'box', s: [0.42, 0.14, 0.42], p: [0, 0, 0], c: 0x8e99a6 },
      { t: 'box', s: [0.42, 0.14, 0.42], p: [0, 0.01, 0], r: [0, Math.PI / 4, 0], c: 0xaab4c0 },
      { t: 'cyl', s: [0.09, 0.09, 0.18, 8], p: [0, 0.05, 0], c: 0x4a525c },
    ]),
    energy: mergeParts([
      { t: 'cyl', s: [0.17, 0.17, 0.5, 8], p: [0, 0, 0], r: [0, 0, Math.PI / 2], c: 0x7fe9ff }, { t: 'cyl', s: [0.19, 0.19, 0.1, 8], p: [0.2, 0, 0], r: [0, 0, Math.PI / 2], c: 0xffffff }, { t: 'cyl', s: [0.19, 0.19, 0.1, 8], p: [-0.2, 0, 0], r: [0, 0, Math.PI / 2], c: 0x3a8aa8 },
    ]),
  };
  const meshes = {};
  for (const t of TYPES) {
    const m = new THREE.InstancedMesh(geos[t], vcMat(), MAX);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.castShadow = true;
    scene.add(m); meshes[t] = m;
  }
  const counts = { meat: 0, scrap: 0, energy: 0 };

  const drops = [];                  // on the ground (or in the air for a moment)
  const flights = [];                // in transit
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0), _fw = new THREE.Vector3(0, 0, 1);
  const lag = { x: 0, z: 0 };

  function put(type, x, y, z, yaw, scale = 1, tilt = 0) {
    if (counts[type] >= MAX) return;
    _q.setFromAxisAngle(_up, yaw);
    if (tilt) _q.multiply(_qt.setFromAxisAngle(_fw, tilt));
    _s.set(scale, scale, scale);
    _m.compose(_p.set(x, y, z), _q, _s);
    meshes[type].setMatrixAt(counts[type]++, _m);
  }

  function spawnDrop(type, x, z, speed = 4, y = 1.0) {
    if (drops.length > 420) drops.shift();
    const a = rnd(0, Math.PI * 2), s = rnd(0.4, 1) * speed;
    drops.push({ type, x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rnd(4, 7), age: 0, life: 80, yaw: rnd(0, 6.28), claimed: null, air: true });
  }

  // where the n-th item of the player's stack sits (world coords)
  function slotPos(k, player, out) {
    const layer = (k / 4) | 0, slot = k % 4;
    const lx = slot % 2 ? 0.22 : -0.22, lz = -0.62 + (slot < 2 ? -0.14 : 0.14);
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    // local (lx, lz): forward = (sin, cos), right = (cos, -sin)
    const wob = layer * 0.035;
    out.x = player.x + lx * cy + lz * sy + lag.x * wob * 6;
    out.z = player.z - lx * sy + lz * cy + lag.z * wob * 6;
    out.y = 0.85 + layer * 0.2 + Math.abs(Math.sin(player.walkT * 2 + layer * 0.5)) * 0.04 * player.moving;
    return out;
  }
  const _o = { x: 0, y: 0, z: 0 };
  const stackTop = (player, out) => slotPos(Math.max(0, carried() - 1), player, out);

  function flyToPad(type, from, pad, onArrive) {
    flights.push({ kind: 'pad', type, sx: from.x, sy: from.y, sz: from.z, pad, t: 0, dur: 0.42, onArrive, yaw: rnd(0, 6) });
  }
  function takeDrop(d) {
    const i = drops.indexOf(d); if (i >= 0) drops.splice(i, 1);
  }

  function update(dt, player) {
    counts.meat = counts.scrap = counts.energy = 0;
    // lag for the wobbly stack: lean away from the movement direction
    lag.x += (-player.vx * 0.06 - lag.x) * Math.min(1, dt * 7);
    lag.z += (-player.vz * 0.06 - lag.z) * Math.min(1, dt * 7);

    // drops: physics + pickup
    const full = carried() >= capacity();
    const reach = player.pickupR;
    let got = 0, pend = 0;
    for (const f of flights) if (f.kind === 'player') pend++;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      if (d.air) {
        d.vy -= 22 * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt;
        if (d.y <= GROUND_Y) { d.y = GROUND_Y; d.air = false; }
      }
      if (d.age > d.life) { drops.splice(i, 1); continue; }
      if (!d.air && !d.claimed && !full && got < 4 && d.age > 0.25 && carried() < capacity()) {
        const dx = player.x - d.x, dz = player.z - d.z;
        if (dx * dx + dz * dz < reach * reach && player.alive) {
          drops.splice(i, 1);
          flights.push({ kind: 'player', type: d.type, sx: d.x, sy: d.y, sz: d.z, t: 0, dur: 0.26, yaw: d.yaw });
          state.carry[d.type]++; got++; pend++;
          sfx.pickup();
          continue;
        }
      }
      const bob = d.air ? 0 : Math.sin(d.age * 3 + d.x) * 0.05;
      const blink = d.life - d.age < 8 && Math.floor(d.age * 6) % 2 === 0 ? 0.6 : 1;
      put(d.type, d.x, d.y + bob, d.z, d.yaw + d.age * 0.5, blink);
    }

    // flights
    let inflightToPlayer = { meat: 0, scrap: 0, energy: 0 };
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt;
      const k = clamp(f.t / f.dur, 0, 1);
      let tx, ty, tz;
      if (f.kind === 'player') {
        inflightToPlayer[f.type]++;
        stackTop(player, _o); tx = _o.x; ty = _o.y + 0.2; tz = _o.z;
      } else { tx = f.pad.x; ty = 0.5; tz = f.pad.z; }
      const arc = f.kind === 'player' ? 1.4 : 3.0;
      const x = f.sx + (tx - f.sx) * k, z = f.sz + (tz - f.sz) * k;
      const y = f.sy + (ty - f.sy) * k + arc * 4 * k * (1 - k);
      put(f.type, x, y, z, f.yaw + f.t * 8, 1);
      if (k >= 1) {
        flights.splice(i, 1);
        if (f.kind === 'pad' && f.onArrive) f.onArrive(f);
      }
    }

    // the stack on the back (items still flying in are not drawn yet)
    let idx = 0;
    for (const t of STACKED) {
      const n = Math.max(0, state.carry[t] - inflightToPlayer[t]);
      for (let j = 0; j < n; j++, idx++) {
        slotPos(idx, player, _o);
        put(t, _o.x, _o.y, _o.z, player.yaw, 1, lag.x * 0.2);
      }
    }
    for (const t of TYPES) {
      meshes[t].count = counts[t];
      meshes[t].instanceMatrix.needsUpdate = true;
    }
  }

  function clearAll() { drops.length = 0; flights.length = 0; }
  return { drops, flights, spawnDrop, takeDrop, flyToPad, stackTop, slotPos, update, clearAll, lag };
}
