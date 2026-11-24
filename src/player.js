// The survivor: movement, auto-attack, hurt/respawn, and the visible attack-range ring.
import * as THREE from 'three';
import { state, speed, weapon, carried } from './state.js';
import { mergeParts, bowParts, vcMat, limbMaterial, limbDepth, setLimb, angLerp, damp, clamp, rnd } from './util.js';
import { playerGeo } from './models.js';
import { sfx } from './audio.js';

export function createPlayer(scene, game) {
  const mat = limbMaterial(), matPlain = vcMat();
  const body = new THREE.Mesh(playerGeo(), mat); body.castShadow = true; body.customDepthMaterial = limbDepth(mat);
  const root = new THREE.Group(); root.add(body); scene.add(root);
  // one bow model per weapon tier (wooden, multishot, rapid longbow, enchanted)
  const nocked = (ry = 0, x = -0.2, shaft = 0xd9b98a, head = 0xdde2e8) => [
    { t: 'box', s: [0.05, 0.05, 1.25], p: [x + Math.sin(ry) * 0.6, 1.2, 0.95 + Math.cos(ry) * 0.05], r: [0, ry, 0], c: shaft, rad: 0.02 },
    { t: 'cone', s: [0.08, 0.24, 10], p: [x + Math.sin(ry) * 1.3, 1.2, 0.95 + Math.cos(ry) * 0.6], r: [Math.PI / 2, ry, 0], c: head },
  ];
  const bowGeos = [
    mergeParts([...bowParts({ x: -0.2, y: 1.2, z: 1.0, R: 0.62, span: 1.15, th: 0.075, color: 0x9a6a3a }), ...nocked()]),
    mergeParts([...bowParts({ x: -0.2, y: 1.2, z: 1.0, R: 0.68, span: 1.2, th: 0.09, color: 0x3a8a4a, tip: 0xffd24a }), ...nocked(0), ...nocked(0.22), ...nocked(-0.22)]),
    mergeParts([...bowParts({ x: -0.2, y: 1.25, z: 1.0, R: 0.85, span: 1.2, th: 0.07, color: 0xc8a050, tip: 0xff6a3a }), ...nocked(0, -0.2, 0xe8d8b0, 0xffb347)]),
    mergeParts([...bowParts({ x: -0.2, y: 1.25, z: 1.0, R: 0.75, span: 1.25, th: 0.09, color: 0x6a3aaa, tip: 0x7fe9ff }), { t: 'sph', s: [0.13], p: [-0.2, 1.25, 1.02], c: 0xff5cf4 }, ...nocked(0, -0.2, 0xff8cff, 0xffffff)]),
  ];
  const guns = bowGeos.map(g => { const m = new THREE.Mesh(g, matPlain); m.castShadow = true; m.visible = false; root.add(m); return m; });
  let gunShown = -1;

  const ringGeo = new THREE.RingGeometry(0.97, 1.0, 64);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; scene.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.07, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.07; scene.add(disc);
  root.rotation.order = 'YXZ';

  const p = {
    x: 0, z: 14, vx: 0, vz: 0, yaw: Math.PI, hp: 100, maxHp: 100, alive: true, walkT: 0, moving: 0, r: 0.55,
    pickupR: 3.1, cd: 0, hurtT: 0, sinceHurt: 99, inv: 0, recoil: 0, target: null, lastRange: 0, root,
    hurt(dmg) {
      if (!p.alive || p.inv > 0) return;
      p.hp -= dmg; p.hurtT = 0.25; p.sinceHurt = 0;
      sfx.hurt(); game.fx.addShake(0.35); game.fx.text(p.x, 2.6, p.z, '-' + Math.round(dmg), '#ff6a5a', 1.1);
      game.hud.flashHurt();
      if (p.hp <= 0) p.die();
    },
    die() {
      p.alive = false; p.hp = 0; state.deaths++;
      if (game.endless.active) game.endless.end('died');
      const lost = Math.min(80, Math.floor(carried() * 0.5));
      let left = lost;
      const take = t => { const n = Math.min(left, state.carry[t]); state.carry[t] -= n; left -= n; };
      take('meat'); take('scrap');
      sfx.die(); game.fx.burst(p.x, 1, p.z, 22, 0xe5483a, 7, 1.2, 0.8, 6); game.fx.addShake(0.8);
      game.hud.toast(`You were overrun! Lost ${lost} items. Respawning…`, 'bad');
      root.visible = false; p.respawnT = 2.2;
    },
    respawn() {
      const at = game.respawnPoint(); p.alive = true; p.hp = p.maxHp; p.x = at.x; p.z = at.z; p.vx = p.vz = 0; p.inv = 2.5; root.visible = true; p.yaw = Math.PI; game.camSnap = true;
      game.fx.burst(p.x, 1, p.z, 16, 0x7dff8a, 5, 1, 0.7, 6);
    },
  };

  const _tmp = { x: 0, z: 0 };
  p.update = function (dt, input) {
    if (!p.alive) {
      p.respawnT -= dt; if (p.respawnT <= 0) p.respawn();
      return;
    }
    p.maxHp = 100 + 25 * state.vestLvl;
    p.sinceHurt += dt; p.inv = Math.max(0, p.inv - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.sinceHurt > 4 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 6 * dt);

    // movement
    const sp = speed();
    const tvx = input.x * sp, tvz = input.z * sp;
    p.vx = damp(p.vx, tvx, 14, dt); p.vz = damp(p.vz, tvz, 14, dt);
    const sv = Math.hypot(p.vx, p.vz);
    game.world.move(p, p.vx * dt, p.vz * dt, p.r);
    p.moving = clamp(sv / 5, 0, 1);
    p.walkT += dt * (4 + sv * 1.1);

    // auto attack the nearest zombie inside the ring
    const w = weapon();
    p.lastRange = w.range; p.pickupR = w.range;     // auto-collect meat out to the same distance as the attack ring
    p.cd -= dt; p.recoil = Math.max(0, p.recoil - dt * 6);
    if (gunShown !== w.tier) { guns.forEach((g, i) => (g.visible = i === w.tier)); gunShown = w.tier; }
    const tz = game.zombies.nearest(p.x, p.z, w.range);
    p.target = tz;
    let faceAng = null;
    if (tz) {
      faceAng = Math.atan2(tz.x - p.x, tz.z - p.z);
      if (p.cd <= 0) {
        const ang = Math.atan2(tz.x - p.x, tz.z - p.z) + rnd(-0.04, 0.04);
        for (let k = 0; k < w.pellets; k++) {
          const a = k === 0 && w.pellets === 1 ? ang : ang + (w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * w.spread + rnd(-0.04, 0.04) : 0);
          game.projectiles.fire({ x: p.x + Math.sin(a) * 1.0, z: p.z + Math.cos(a) * 1.0, angle: a, dmg: w.dmg, speed: w.speed * (w.pellets > 1 ? rnd(0.85, 1.1) : 1), range: w.range + 1.5, kind: w.kind, y: 1.2, ap: w.ap, pierce: w.pierce });
        }
        p.cd = 1 / w.rate; p.recoil = 1;
        (w.tier === 1 ? sfx.bowMulti : w.tier === 2 ? sfx.bowRapid : w.tier === 3 ? sfx.plasma : sfx.bow)();
        if (w.tier === 3) game.fx.burst(p.x + Math.sin(ang) * 1.3, 1.25, p.z + Math.cos(ang) * 1.3, 4, 0xff5cf4, 3, 0.6, 0.25, 1);
      }
    } else if (sv > 0.5) faceAng = Math.atan2(p.vx, p.vz);
    if (faceAng !== null) p.yaw = angLerp(p.yaw, faceAng, 1 - Math.exp(-(tz ? 22 : 14) * dt));

    // pose
    const bob = Math.abs(Math.sin(p.walkT)) * 0.12 * p.moving;
    root.position.set(p.x, bob, p.z);
    root.rotation.set(0, p.yaw, 0);
    const squash = 1 - p.recoil * 0.05;
    root.scale.set(1 + p.recoil * 0.03, squash, 1 + p.recoil * 0.03);
    root.rotation.x = p.moving * 0.12 + p.recoil * -0.05;
    root.rotation.z = Math.sin(p.walkT) * 0.06 * p.moving;
    const blink = p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0;
    root.visible = !blink;
    mat.emissive.setRGB(p.hurtT * 3, p.hurtT * 0.3, p.hurtT * 0.3);
    setLimb(mat, p.walkT, 0.85 * p.moving, 0, 0);

    // ring follows the feet
    ring.position.x = disc.position.x = p.x; ring.position.z = disc.position.z = p.z;
    const rs = w.range; ring.scale.set(rs, rs, 1); disc.scale.set(rs, rs, 1);
    ring.material.opacity = tz ? 0.8 : 0.45;
  };
  p.setInvisibleRing = v => { ring.visible = disc.visible = v; };
  return p;
}
