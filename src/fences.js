// Buyable fences: three arcs (south / west / north) around the base. Your survivor hops over them, zombies have to chew
// through them. Each arc has 3 tiers: wooden fence -> reinforced fence -> stone wall. Broken pieces grow back after a wave.
import * as THREE from 'three';
import { mergeParts, vcMat, rnd } from './util.js';

export const FENCE_R = 21;                       // ring radius around the core
export const FENCE_ARCS = [                      // angles in degrees, x = cos, z = sin (so 90 = south)
  { name: 'South', from: 45, to: 135 },
  { name: 'West', from: 135, to: 225 },
  { name: 'North', from: 225, to: 315 },
];
const PER_ARC = 15, SEG_LEN = 2.2;
const HP = [0, 120, 320, 800];

export function createFences(scene, game) {
  const world = game.world, fx = game.fx;
  const group = new THREE.Group(); scene.add(group);
  const mat = vcMat();

  const geos = [null,
    mergeParts([   // 1: wooden fence
      { t: 'box', s: [0.26, 1.3, 0.26], p: [-0.95, 0.65, 0], c: 0xa8743f }, { t: 'box', s: [0.26, 1.3, 0.26], p: [0.95, 0.65, 0], c: 0xa8743f },
      { t: 'box', s: [2.2, 0.16, 0.12], p: [0, 1.0, 0], c: 0xc08a50 }, { t: 'box', s: [2.2, 0.16, 0.12], p: [0, 0.55, 0], c: 0xc08a50 },
      { t: 'cone', s: [0.17, 0.3, 6], p: [-0.95, 1.45, 0], c: 0xa8743f }, { t: 'cone', s: [0.17, 0.3, 6], p: [0.95, 1.45, 0], c: 0xa8743f },
    ]),
    mergeParts([   // 2: reinforced (planks + iron bands + spikes)
      { t: 'box', s: [0.36, 1.7, 0.36], p: [-0.9, 0.85, 0], c: 0x7a5530 }, { t: 'box', s: [0.36, 1.7, 0.36], p: [0.9, 0.85, 0], c: 0x7a5530 },
      { t: 'box', s: [2.2, 1.3, 0.2], p: [0, 0.75, 0], c: 0x9a6c3c }, { t: 'box', s: [2.25, 0.14, 0.26], p: [0, 1.05, 0], c: 0x4a5058 }, { t: 'box', s: [2.25, 0.14, 0.26], p: [0, 0.4, 0], c: 0x4a5058 },
      ...[-0.6, -0.2, 0.2, 0.6].map(x => ({ t: 'cone', s: [0.11, 0.5, 6], p: [x, 1.6, 0], c: 0xb8bec6 })),
      { t: 'sph', s: [0.2], p: [-0.9, 1.78, 0], c: 0x4a5058 }, { t: 'sph', s: [0.2], p: [0.9, 1.78, 0], c: 0x4a5058 },
    ]),
    mergeParts([   // 3: stone wall with battlements
      { t: 'box', s: [2.3, 1.6, 0.8], p: [0, 0.8, 0], c: 0x8e929c, rad: 0.12 }, { t: 'box', s: [2.35, 0.25, 0.9], p: [0, 0.12, 0], c: 0x6e727c },
      { t: 'box', s: [0.55, 0.45, 0.8], p: [-0.8, 1.8, 0], c: 0x9a9ea8 }, { t: 'box', s: [0.55, 0.45, 0.8], p: [0, 1.8, 0], c: 0x9a9ea8 }, { t: 'box', s: [0.55, 0.45, 0.8], p: [0.8, 1.8, 0], c: 0x9a9ea8 },
      { t: 'box', s: [0.7, 0.12, 0.84], p: [-0.4, 1.0, 0], c: 0x7a7e88 }, { t: 'box', s: [0.7, 0.12, 0.84], p: [0.4, 1.3, 0], c: 0x7a7e88 },
    ]),
  ];

  const segs = [];
  FENCE_ARCS.forEach((arc, ai) => {
    for (let i = 0; i < PER_ARC; i++) {
      const th = (arc.from + (i + 0.5) * (arc.to - arc.from) / PER_ARC) * Math.PI / 180;
      const x = Math.cos(th) * FENCE_R, z = Math.sin(th) * FENCE_R;
      const mesh = new THREE.Mesh(geos[1], mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
      mesh.position.set(x, 0, z); mesh.rotation.y = Math.atan2(-Math.cos(th), -Math.sin(th));
      group.add(mesh);
      segs.push({ arc: ai, x, z, r: 1.3, mesh, tier: 0, hp: 0, maxHp: 0, alive: false, respawn: 0, pop: 1, hitT: 0, sinceHit: 99 });
    }
  });
  const solids = [];                        // the segments currently blocking zombies (world.fences)
  world.fences = solids;

  function activate(s) { s.alive = true; s.hp = s.maxHp; s.mesh.visible = true; if (solids.indexOf(s) < 0) solids.push(s); }
  function setTier(arc, tier, instant) {
    for (const s of segs) {
      if (s.arc !== arc) continue;
      s.tier = tier; s.maxHp = HP[tier]; s.mesh.geometry = geos[tier];
      activate(s);
      if (!instant) { s.pop = 0; s.mesh.scale.setScalar(0.01); fx.burst(s.x, 0.8, s.z, 3, 0xc8a070, 4, 0.8, 0.5, 4); }
    }
  }
  function damage(s, n) {
    if (!s.alive) return;
    s.hp -= n; s.hitT = 0.18; s.sinceHit = 0;
    fx.burst(s.x, 1.0, s.z, 2, 0xc8a070, 3, 0.6, 0.35, 3);
    if (s.hp <= 0) {
      s.alive = false; s.mesh.visible = false; s.respawn = 16;
      const i = solids.indexOf(s); if (i >= 0) solids.splice(i, 1);
      fx.burst(s.x, 1.0, s.z, 14, s.tier === 3 ? 0x8e929c : 0xa8743f, 7, 1.2, 0.8, 6); fx.addShake(0.12);
    }
  }
  /** Area damage (slams) */
  function damageNear(x, z, r, n) { for (const s of segs) if (s.alive && (s.x - x) ** 2 + (s.z - z) ** 2 < (r + s.r) ** 2) damage(s, n); }

  function update(dt) {
    const waving = game.zombies.wave.active;
    const pl = game.player;
    for (const s of segs) {
      if (s.tier === 0) continue;
      if (s.alive) {
        s.sinceHit += dt;
        if (!waving && s.sinceHit > 6 && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + 14 * dt);   // mends itself once left alone
        if (s.pop < 1) { s.pop = Math.min(1, s.pop + dt * 3.5); s.mesh.scale.setScalar(0.01 + (1 - Math.pow(1 - s.pop, 3)) * (1 + Math.sin(s.pop * Math.PI) * 0.15)); }
        else if (s.hitT > 0) { s.hitT -= dt; const k = 1 + Math.sin(s.hitT * 40) * 0.05; s.mesh.scale.set(k, 1 - (1 - k) * 0.5, k); }
        else if (s.mesh.scale.x !== 1) s.mesh.scale.setScalar(1);
        if (s.hp < s.maxHp && (s.x - pl.x) ** 2 + (s.z - pl.z) ** 2 < 28 * 28) fx.bar(s.x, 2.4, s.z, s.hp / s.maxHp);
      } else if (!waving) {
        s.respawn -= dt;
        if (s.respawn <= 0) { activate(s); s.pop = 0; s.mesh.scale.setScalar(0.01); fx.burst(s.x, 0.8, s.z, 4, 0xc8a070, 4, 0.8, 0.5, 4); }
      }
    }
  }
  return { segs, setTier, damage, damageNear, update, solids };
}
