// Pooled bullets (player, turrets, snipers) and the toxic spitter's lobbed goo. Both are InstancedMeshes.
import * as THREE from 'three';
import { rnd, mergeParts } from './util.js';

const MAXB = 140, MAXS = 30;

export function createProjectiles(scene, game) {
  const bGeo = new THREE.BoxGeometry(0.13, 0.13, 0.8);
  const bMesh = new THREE.InstancedMesh(bGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXB);
  bMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bMesh.frustumCulled = false; bMesh.count = 0; bMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(bMesh);
  // arrows (the player's shots): shaft + steel head + red fletching, unlit so they pop against any ground
  const arrowGeo = mergeParts([
    { t: 'box', s: [0.07, 0.07, 1.1], p: [0, 0, 0], c: 0xd9b98a, rad: 0.03 },
    { t: 'cone', s: [0.11, 0.32, 10], p: [0, 0, 0.7], r: [Math.PI / 2, 0, 0], c: 0xe4e8ee },
    { t: 'box', s: [0.34, 0.02, 0.26], p: [0, 0, -0.45], c: 0xe0453a, rad: 0 }, { t: 'box', s: [0.02, 0.34, 0.26], p: [0, 0, -0.45], c: 0xe0453a, rad: 0 },
  ]);
  const aMesh = new THREE.InstancedMesh(arrowGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), MAXB);
  aMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); aMesh.frustumCulled = false; aMesh.count = 0; aMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  scene.add(aMesh);
  const ARROW = { arrow: 0xffffff, multi: 0xd8ffd8, rapid: 0xfff0b8, magic: 0xff8cff };
  const sGeo = new THREE.SphereGeometry(0.34, 8, 6);
  const sMesh = new THREE.InstancedMesh(sGeo, new THREE.MeshLambertMaterial({ color: 0x9cff3a, emissive: 0x3a8a10 }), MAXS);
  sMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sMesh.frustumCulled = false; sMesh.count = 0;
  scene.add(sMesh);

  const COLORS = { player: 0xfff2a0, turret: 0xffb347, sniper: 0x7fe9ff, rifle: 0xffe066, plasma: 0xff5cf4, gunner: 0x9dff9d };
  const bullets = [], goo = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

  function fire(o) {
    if (bullets.length >= MAXB) bullets.shift();
    bullets.push({
      x: o.x, z: o.z, y: o.y || 1.1, dx: Math.sin(o.angle), dz: Math.cos(o.angle), speed: o.speed || 30, dmg: o.dmg, left: o.range || 10,
      kind: o.kind || 'player', pierce: o.pierce || 0, ap: o.ap || 0, angle: o.angle, hit: null, fly: 0, hitSet: o.pierce ? [] : null,
    });
  }
  function spit(x, z, tx, tz, dmg) {
    if (goo.length >= MAXS) goo.shift();
    const d = Math.hypot(tx - x, tz - z), T = Math.max(0.45, d / 10);
    goo.push({ x0: x, z0: z, x1: tx, z1: tz, t: 0, T, dmg });
  }

  function update(dt) {
    const zs = game.zombies.list;
    let n = 0;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      let remain = b.speed * dt, dead = false;
      while (remain > 0 && !dead) {
        const step = Math.min(remain, 0.6); remain -= step;
        b.x += b.dx * step; b.z += b.dz * step; b.left -= step; b.fly += step;
        for (let k = 0; k < zs.length; k++) {
          const z = zs[k];
          if (!z.alive || (b.hitSet && b.hitSet.indexOf(z) >= 0)) continue;
          const rr = z.r + 0.28;
          if ((z.x - b.x) ** 2 + (z.z - b.z) ** 2 < rr * rr) {
            game.zombies.hit(z, b.dmg, b.dx, b.dz, b.kind, b.ap);
            if (ARROW[b.kind] !== undefined) game.fx.burst(z.x, 1.2, z.z, b.kind === 'magic' ? 4 : 2, b.kind === 'magic' ? 0xff5cf4 : 0xc8a070, 3, 0.55, 0.28, 2);
            if (b.pierce > 0) { b.pierce--; b.hitSet.push(z); } else { dead = true; break; }
          }
        }
        if (b.left <= 0) dead = true;
      }
      if (dead) { bullets.splice(i, 1); continue; }
    }
    let na = 0;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      _q.setFromAxisAngle(_up, b.angle);
      const tint = ARROW[b.kind];
      if (tint !== undefined) {
        const sc = b.kind === 'magic' ? 1.5 : b.kind === 'rapid' ? 1.15 : 1, lift = b.y + Math.sin(Math.min(1, b.fly / 14) * Math.PI) * 0.25;
        _s.set(sc, sc, sc); _m.compose(_p.set(b.x, lift, b.z), _q, _s);
        aMesh.setMatrixAt(na, _m); aMesh.setColorAt(na, _c.set(tint)); na++;
      } else {
        _s.set(1, 1, b.kind === 'sniper' ? 2.2 : 1);
        _m.compose(_p.set(b.x, b.y, b.z), _q, _s);
        bMesh.setMatrixAt(n, _m); bMesh.setColorAt(n, _c.set(COLORS[b.kind] || 0xffffff)); n++;
      }
    }
    aMesh.count = na; aMesh.instanceMatrix.needsUpdate = true; if (aMesh.instanceColor) aMesh.instanceColor.needsUpdate = true;
    bMesh.count = n; bMesh.instanceMatrix.needsUpdate = true; if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;

    // goo
    let g = 0;
    for (let i = goo.length - 1; i >= 0; i--) {
      const s = goo[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.T);
      if (k >= 1) {
        goo.splice(i, 1);
        game.fx.burst(s.x1, 0.3, s.z1, 10, 0x9cff3a, 4, 1, 0.5, 4);
        const pl = game.player;
        if (pl.alive && (pl.x - s.x1) ** 2 + (pl.z - s.z1) ** 2 < 1.9 * 1.9) pl.hurt(s.dmg);
        game.buildings.hitCoreAt(s.x1, s.z1, 2.6, s.dmg);
        continue;
      }
      const x = s.x0 + (s.x1 - s.x0) * k, z = s.z0 + (s.z1 - s.z0) * k, y = 1.2 + 3 * 4 * k * (1 - k) - k * 0.9;
      _m.compose(_p.set(x, y, z), _q.identity(), _s.set(1, 1, 1));
      sMesh.setMatrixAt(g++, _m);
    }
    sMesh.count = g; sMesh.instanceMatrix.needsUpdate = true;
  }
  /** Where goo is about to land (for the red warning marks) */
  return { fire, spit, update, bullets, goo, clear() { bullets.length = 0; goo.length = 0; } };
}
