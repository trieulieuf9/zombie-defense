// The map: five floating-island zones joined by bridges (and a teleporter), decoration, walkable areas, obstacle collision.
import * as THREE from 'three';
import { state } from './state.js';
import { mergeParts, vcMat, groundTexture, softBlobs, clamp } from './util.js';
import { PADS } from './defs.js';

// Zone rectangles are the area an entity CENTRE may occupy (the slab is 2 units bigger on every side).
export const ZONES = [
  { id: 1, name: 'The Safe Clearing', cx: 0, cz: 0, hx: 28, hz: 28, sky: 0x9fd8f0, hemi: 0x6a8a5a },
  { id: 2, name: 'The Overgrown Forest', cx: 76, cz: 0, hx: 28, hz: 28, sky: 0x9fd8f0, hemi: 0x4a7a54 },
  { id: 3, name: 'Abandoned Highway & Scrapyard', cx: 152, cz: 0, hx: 28, hz: 28, sky: 0xd8b890, hemi: 0x8a7a66 },
  { id: 4, name: 'Bio-Lab Ruins', cx: 228, cz: 0, hx: 28, hz: 28, sky: 0x88cdb6, hemi: 0x4a8a82 },
  { id: 5, name: 'The Necropolis Citadel', cx: 304, cz: 0, hx: 28, hz: 28, sky: 0x5a4474, hemi: 0x4a3a62 },
];
// Rope/road bridges. `unlock` = index into state.zoneUnlocked that makes the bridge walkable.
export const BRIDGES = [
  { x0: 27, x1: 49, hz: 3.4, unlock: 1, color: 0xb5864a },
  { x0: 103, x1: 125, hz: 3.4, unlock: 2, color: 0x8a8f96 },
  { x0: 179, x1: 201, hz: 3.4, unlock: 3, color: 0x7d9a98 },
];
export const CORE = { x: 0, z: 0 };
export const TELE_A = { x: 249, z: 0 }, TELE_B = { x: 285, z: 0 };   // zone 4 <-> zone 5

function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function paintTexture(kind, R) {
  const px = 1024, c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
  const base = { road: '#55585e', lab: '#79b3aa', necro: '#3b2f4c' }[kind];
  g.fillStyle = base; g.fillRect(0, 0, px, px);
  softBlobs(g, px, 60, 'rgba(0,0,0,1)', 40, 130, 0.22, R); softBlobs(g, px, 50, 'rgba(255,255,255,1)', 40, 130, 0.09, R);
  if (kind === 'lab') {
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * px / 4, 0); g.lineTo(i * px / 4, px); g.moveTo(0, i * px / 4); g.lineTo(px, i * px / 4); g.stroke(); }
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(120,255,120,.25)'; g.beginPath(); g.arc(R() * px, R() * px, 10 + R() * 22, 0, 6.3); g.fill(); }
  } else if (kind === 'road') {
    g.strokeStyle = 'rgba(20,20,20,.55)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { let x = R() * px, y = R() * px; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  } else {
    g.strokeStyle = 'rgba(255,70,110,.5)'; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) { let x = R() * px, y = R() * px; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 70; y += (R() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * px / 4, 0); g.lineTo(i * px / 4, px); g.moveTo(0, i * px / 4); g.lineTo(px, i * px / 4); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(7, 7);
  return t;
}

export function createWorld(scene) {
  const R = rng(1337);
  const rr = (a, b) => a + R() * (b - a);
  const group = new THREE.Group(); scene.add(group);
  const obstacles = [];
  const addObstacle = (x, z, r) => { const o = { x, z, r }; obstacles.push(o); return o; };
  const removeObstacle = o => { const i = obstacles.indexOf(o); if (i >= 0) obstacles.splice(i, 1); };

  // ---- water under everything -----------------------------------------------------------------------------------
  const wc = document.createElement('canvas'); wc.width = wc.height = 128;
  { const g = wc.getContext('2d'); g.fillStyle = '#2f9bc6'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const x = R() * 128, y = R() * 128; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 6, x + 28, y); g.stroke(); } }
  const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(110, 40); wtex.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 560), new THREE.MeshLambertMaterial({ map: wtex }));
  water.rotation.x = -Math.PI / 2; water.position.set(160, -2.6, 0); water.receiveShadow = true; group.add(water);

  // ---- island slabs -----------------------------------------------------------------------------------------------
  const dirt = new THREE.MeshLambertMaterial({ color: 0x8a5a36 }), dirt2 = new THREE.MeshLambertMaterial({ color: 0x6e4527 });
  const rock = new THREE.MeshLambertMaterial({ color: 0x6a6a72 }), rock2 = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const plum = new THREE.MeshLambertMaterial({ color: 0x3a2c4a }), plum2 = new THREE.MeshLambertMaterial({ color: 0x241a32 });
  const sides = [[dirt, dirt2], [dirt, dirt2], [rock, rock2], [rock, rock2], [plum, plum2]];
  const t1 = groundTexture('#86c95a', '#6fb54a', '#9bdc6e'); t1.repeat.set(7, 7);
  const t2 = groundTexture('#4f9a58', '#3e8449', '#63ad66'); t2.repeat.set(7, 7);
  const texs = [t1, t2, paintTexture('road', R), paintTexture('lab', R), paintTexture('necro', R)];
  ZONES.forEach((q, i) => {
    const top = new THREE.MeshLambertMaterial({ map: texs[i] });
    const m = new THREE.Mesh(new THREE.BoxGeometry((q.hx + 2) * 2, 3, (q.hz + 2) * 2), [sides[i][0], sides[i][0], top, sides[i][1], sides[i][0], sides[i][0]]);
    m.position.set(q.cx, -1.5, q.cz); m.receiveShadow = true; group.add(m);
  });

  // paths + the base plaza
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xc9b68a }), plazaMat = new THREE.MeshLambertMaterial({ color: 0xa9a59a });
  function flat(w, d, x, z, mat, y = 0.03) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m; }
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.1, 28), plazaMat); plaza.position.set(0, 0.04, 0); plaza.receiveShadow = true; group.add(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.0, 40), new THREE.MeshBasicMaterial({ color: 0x7a766c })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; group.add(ring);
  flat(21, 4, 17.5, 0, pathMat);
  flat(4, 40, 0, 0, pathMat, 0.025);
  flat(56, 4, 76, 0, pathMat, 0.03);

  // ---- decor geometries ----------------------------------------------------------------------------------------------
  const treeGeo = mergeParts([
    { t: 'cyl', s: [0.22, 0.3, 1.0, 6], p: [0, 0.5, 0], c: 0x7a4a26 },
    { t: 'cone', s: [1.3, 1.7, 7], p: [0, 1.7, 0], c: 0x2f8f43 }, { t: 'cone', s: [1.0, 1.5, 7], p: [0, 2.6, 0], c: 0x3aa34e }, { t: 'cone', s: [0.65, 1.2, 7], p: [0, 3.4, 0], c: 0x46b95a },
  ]);
  const rockGeo = mergeParts([{ t: 'oct', s: [1.0], p: [0, 0.55, 0], r: [0.3, 0.6, 0.2], c: 0x9a9a9a }, { t: 'oct', s: [0.6], p: [0.8, 0.3, 0.4], r: [0.5, 0.1, 0.4], c: 0x8a8a8a }]);
  const tuftGeo = mergeParts([{ t: 'cone', s: [0.18, 0.45, 4], p: [0, 0.22, 0], c: 0xffffff }, { t: 'cone', s: [0.14, 0.35, 4], p: [0.15, 0.17, 0.05], c: 0xdddddd }]);
  const flowerGeo = mergeParts([{ t: 'cyl', s: [0.03, 0.03, 0.4, 4], p: [0, 0.2, 0], c: 0x3c9a3c }, { t: 'sph', s: [0.13], p: [0, 0.45, 0], c: 0xffffff }]);
  const carGeo = mergeParts([
    { t: 'box', s: [2.0, 0.75, 4.2], p: [0, 0.7, 0], c: 0xffffff }, { t: 'box', s: [1.7, 0.6, 2.0], p: [0, 1.35, -0.25], c: 0x9fb4c0 },
    { t: 'box', s: [0.3, 0.5, 0.5], p: [-1.0, 0.3, 1.3], c: 0x222222 }, { t: 'box', s: [0.3, 0.5, 0.5], p: [1.0, 0.3, 1.3], c: 0x222222 },
    { t: 'box', s: [0.3, 0.5, 0.5], p: [-1.0, 0.3, -1.3], c: 0x222222 }, { t: 'box', s: [0.3, 0.5, 0.5], p: [1.0, 0.3, -1.3], c: 0x222222 },
  ]);
  const barrierGeo = mergeParts([{ t: 'box', s: [0.9, 0.9, 2.8], p: [0, 0.45, 0], c: 0xc9c9c0 }, { t: 'box', s: [0.92, 0.2, 2.8], p: [0, 0.8, 0], c: 0xe0552e }, { t: 'box', s: [0.5, 0.25, 2.8], p: [0, 0.12, 0], c: 0xa8a8a0 }]);
  const barrelGeo = mergeParts([{ t: 'cyl', s: [0.45, 0.45, 1.0, 8], p: [0, 0.5, 0], c: 0xe0702a }, { t: 'cyl', s: [0.47, 0.47, 0.12, 8], p: [0, 0.5, 0], c: 0x8a3a12 }]);
  const scrapGeo = mergeParts([
    { t: 'box', s: [1.6, 0.9, 1.4], p: [0, 0.45, 0], r: [0, 0.4, 0], c: 0x8a6a4a }, { t: 'box', s: [1.2, 0.8, 1.1], p: [0.5, 1.2, 0.2], r: [0.1, 0.9, 0.2], c: 0x6a7078 },
    { t: 'box', s: [0.3, 1.8, 0.3], p: [-0.5, 1.2, 0.3], r: [0.2, 0, 0.3], c: 0xa0522d }, { t: 'box', s: [1.0, 0.6, 0.9], p: [-0.6, 0.3, -0.7], r: [0, 0.2, 0], c: 0x7a5a3a },
  ]);
  const podBase = mergeParts([{ t: 'cyl', s: [1.2, 1.35, 0.5, 10], p: [0, 0.25, 0], c: 0x4a5560 }, { t: 'cyl', s: [1.1, 1.1, 0.25, 10], p: [0, 3.3, 0], c: 0x4a5560 }]);
  const podGlass = new THREE.CylinderGeometry(0.95, 0.95, 2.8, 10); podGlass.translate(0, 1.9, 0);
  const wallGeo = mergeParts([{ t: 'box', s: [5.0, 2.6, 0.6], p: [0, 1.3, 0], c: 0xcfd8d6 }, { t: 'box', s: [1.4, 0.8, 0.62], p: [-1.4, 2.4, 0], c: 0x9aa6a4 }, { t: 'box', s: [5.2, 0.2, 0.7], p: [0, 0.1, 0], c: 0x7d8a88 }]);
  const puddleGeo = new THREE.CircleGeometry(1.5, 14); puddleGeo.rotateX(-Math.PI / 2);
  const tombGeo = mergeParts([{ t: 'box', s: [0.9, 1.1, 0.35], p: [0, 0.55, 0], c: 0x8a8795 }, { t: 'cyl', s: [0.45, 0.45, 0.35, 8], p: [0, 1.1, 0], r: [Math.PI / 2, 0, 0], c: 0x8a8795 }, { t: 'box', s: [1.2, 0.15, 0.7], p: [0, 0.07, 0], c: 0x5a5866 }]);
  const deadTreeGeo = mergeParts([
    { t: 'cyl', s: [0.12, 0.3, 3.2, 5], p: [0, 1.6, 0], c: 0x3a2e2a }, { t: 'box', s: [0.12, 1.4, 0.12], p: [0.5, 2.9, 0], r: [0, 0, -0.8], c: 0x3a2e2a },
    { t: 'box', s: [0.1, 1.2, 0.1], p: [-0.45, 2.6, 0.1], r: [0.2, 0, 0.9], c: 0x3a2e2a }, { t: 'box', s: [0.1, 1.0, 0.1], p: [0.1, 3.3, -0.3], r: [-0.8, 0, 0.1], c: 0x3a2e2a },
  ]);
  const pillarGeo = mergeParts([{ t: 'box', s: [1.8, 0.5, 1.8], p: [0, 0.25, 0], c: 0x5a5470 }, { t: 'cyl', s: [0.6, 0.7, 4.4, 8], p: [0, 2.7, 0], c: 0x7a7494 }, { t: 'box', s: [1.7, 0.45, 1.7], p: [0, 5.1, 0], c: 0x5a5470 }, { t: 'sph', s: [0.28], p: [0, 5.6, 0], c: 0xff4d7a }]);
  const citadelGeo = (() => {
    const parts = [{ t: 'box', s: [6, 7, 38], p: [0, 3.5, 0], c: 0x2d2540 }, { t: 'box', s: [7, 0.8, 38.5], p: [0, 7.3, 0], c: 0x3b3055 }];
    for (const z of [-16, -8, 8, 16]) { parts.push({ t: 'cyl', s: [2.6, 3.0, 12, 8], p: [-1.2, 6, z], c: 0x3b3055 }, { t: 'cone', s: [3.4, 4.5, 8], p: [-1.2, 14.2, z], c: 0x6a2a7a }, { t: 'box', s: [0.3, 1.4, 0.9], p: [-4.3, 7, z], c: 0xffc24d }); }
    parts.push({ t: 'box', s: [0.4, 5, 5], p: [-3.1, 2.5, 0], c: 0x120d1c }, { t: 'box', s: [0.45, 0.8, 4], p: [-3.2, 6, 0], c: 0xff4d7a });
    return mergeParts(parts);
  })();

  const postGeo = new THREE.BoxGeometry(0.28, 1.1, 0.28), railGeo = new THREE.BoxGeometry(2.6, 0.16, 0.12);
  const woodMat = new THREE.MeshLambertMaterial({ color: 0xa8743f }), metalMat = new THREE.MeshLambertMaterial({ color: 0x7a8088 }), boneMat = new THREE.MeshLambertMaterial({ color: 0x6a5a7a });
  const white = vcMat();

  const dummy = new THREE.Object3D(), col = new THREE.Color();
  function inst(geo, mat, list, shadows = true) {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((d, i) => {
      dummy.position.set(d.x, d.y || 0, d.z); dummy.rotation.set(0, d.ry || 0, 0); dummy.scale.set(d.sx || d.s || 1, d.sy || d.s || 1, d.sz || d.s || 1); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); if (d.col !== undefined) m.setColorAt(i, col.set(d.col));
    });
    m.castShadow = shadows; m.receiveShadow = false; group.add(m); return m;
  }
  const nearPad = (x, z, d) => PADS.some(p => Math.abs(p.x - x) < d && Math.abs(p.z - z) < d) || (Math.abs(x - TELE_A.x) < d && Math.abs(z) < d) || (Math.abs(x - TELE_B.x) < d && Math.abs(z) < d);

  // ---- fences ---------------------------------------------------------------------------------------------------------
  const openW = [false, true, true, true, false], openE = [true, true, true, false, false];
  const fenceMats = [woodMat, woodMat, metalMat, metalMat, boneMat];
  ZONES.forEach((zn, zi) => {
    const posts = [], rails = [];
    const L = zn.hx + 1.4, seg = 2.6;
    for (let s = -L; s <= L + 0.01; s += seg) {
      for (const side of ['n', 's', 'e', 'w']) {
        let x, z, ry = 0;
        if (side === 'n') { x = zn.cx + s; z = zn.cz - L; } else if (side === 's') { x = zn.cx + s; z = zn.cz + L; }
        else if (side === 'e') { x = zn.cx + L; z = zn.cz + s; ry = Math.PI / 2; } else { x = zn.cx - L; z = zn.cz + s; ry = Math.PI / 2; }
        if ((side === 'e' && openE[zi] && Math.abs(z) < 5.2) || (side === 'w' && openW[zi] && Math.abs(z) < 5.2)) continue;
        if (zi === 4 && side === 'e') continue;   // the citadel closes the east side
        posts.push({ x, y: 0.55, z });
        rails.push({ x: x + (ry ? 0 : seg / 2), y: 0.9, z: z + (ry ? seg / 2 : 0), ry }, { x: x + (ry ? 0 : seg / 2), y: 0.5, z: z + (ry ? seg / 2 : 0), ry });
      }
    }
    inst(postGeo, fenceMats[zi], posts); inst(railGeo, fenceMats[zi], rails, false);
  });

  // ---- zones 1 & 2: trees, rocks, tufts -----------------------------------------------------------------------------------
  const trees = [], rocks = [], tufts = [], flowers = [];
  function treeRim(zn, skipEast, skipWest) {
    const L = zn.hx + 1.9;
    for (let s = -L; s <= L; s += rr(1.8, 3.2)) {
      for (const side of ['n', 's', 'e', 'w']) {
        let x, z;
        if (side === 'n') { x = zn.cx + s; z = zn.cz - L - rr(0, 0.4); } else if (side === 's') { x = zn.cx + s; z = zn.cz + L + rr(0, 0.4); }
        else if (side === 'e') { x = zn.cx + L + rr(0, 0.4); z = zn.cz + s; } else { x = zn.cx - L - rr(0, 0.4); z = zn.cz + s; }
        if ((side === 'e' && skipEast && Math.abs(z) < 6) || (side === 'w' && skipWest && Math.abs(z) < 6)) continue;
        trees.push({ x, z, s: rr(0.9, 1.3), ry: rr(0, 6), col: [0xffffff, 0xeaffea, 0xf2ffd8][Math.floor(R() * 3)] });
      }
    }
  }
  const z1 = ZONES[0], z2 = ZONES[1];
  treeRim(z1, true, false); treeRim(z2, true, true);
  const free1 = (x, z) => Math.hypot(x, z) > 9.5 && Math.abs(z) > 3.2 && Math.abs(x) > 3.2 && !nearPad(x, z, 5);
  for (let i = 0; i < 9; i++) { let x, z, k = 0; do { x = rr(-26, 26); z = rr(-26, 26); k++; } while (!free1(x, z) && k < 20); rocks.push({ x, z, s: rr(0.7, 1.3), ry: rr(0, 6) }); addObstacle(x, z, 0.9); }
  for (let i = 0; i < 220; i++) { const x = rr(-27, 27), z = rr(-27, 27); if (Math.hypot(x, z) < 8.5) continue; tufts.push({ x, z, s: rr(0.8, 1.6), ry: rr(0, 6), col: [0x5aa83a, 0x6dbb45, 0x4f9a35][i % 3] }); }
  for (let i = 0; i < 70; i++) { const x = rr(-27, 27), z = rr(-27, 27); if (Math.hypot(x, z) < 9) continue; flowers.push({ x, z, s: rr(0.8, 1.2), col: [0xffe14d, 0xff8ab8, 0xffffff, 0xff7a4d][i % 4] }); }
  for (let i = 0; i < 26; i++) {
    let x, z, k = 0;
    do { x = z2.cx + rr(-26, 26); z = rr(-26, 26); k++; } while ((Math.abs(z) < 4.5 || x > z2.cx + 22 || nearPad(x, z, 5)) && k < 40);
    const sc = rr(0.7, 1.0); trees.push({ x, z, s: sc, ry: rr(0, 6), col: 0xffffff }); addObstacle(x, z, 0.95 * sc);
  }
  for (let i = 0; i < 8; i++) { const x = z2.cx + rr(-24, 24), z = rr(-24, 24); if (Math.abs(z) < 5 || nearPad(x, z, 4.5)) continue; rocks.push({ x, z, s: rr(0.8, 1.4), ry: rr(0, 6) }); addObstacle(x, z, 1.0); }
  for (let i = 0; i < 160; i++) { const x = z2.cx + rr(-27, 27), z = rr(-27, 27); tufts.push({ x, z, s: rr(0.9, 1.8), ry: rr(0, 6), col: [0x2f7a3a, 0x3c8c46, 0x4a9d50][i % 3] }); }
  for (let i = 0; i < 40; i++) { const x = z2.cx + rr(-27, 27), z = rr(-27, 27); flowers.push({ x, z, s: rr(0.8, 1.1), col: [0xc58aff, 0xffffff, 0x8affd9][i % 3] }); }
  inst(treeGeo, white, trees); inst(rockGeo, white, rocks); inst(tuftGeo, white, tufts, false); inst(flowerGeo, white, flowers, false);

  // scatter helper for the later zones: random free spot inside a zone, off the main lane and the pads
  function spots(zi, n, margin, lane, avoidD, minGap = 0) {
    const zn = ZONES[zi], out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 40) {
      const x = zn.cx + rr(-zn.hx + margin, zn.hx - margin), z = rr(-zn.hz + margin, zn.hz - margin);
      if (Math.abs(z) < lane || nearPad(x, z, avoidD)) continue;
      if (minGap && out.some(o => (o.x - x) ** 2 + (o.z - z) ** 2 < minGap * minGap)) continue;
      out.push({ x, z });
    }
    return out;
  }

  // ---- zone 3: highway & scrapyard ------------------------------------------------------------------------------------------
  {
    const zi = 2, zn = ZONES[zi];
    const cars = spots(zi, 14, 3, 3.5, 5, 6).map(p => ({ ...p, ry: rr(0, 6), col: [0xc0392b, 0x2e86c1, 0xd4ac0d, 0xe8e8e8, 0x27ae60][Math.floor(R() * 5)] }));
    cars.forEach(c => addObstacle(c.x, c.z, 1.6));
    const bars = spots(zi, 12, 3, 4, 4, 5).map(p => ({ ...p, ry: Math.floor(R() * 2) * Math.PI / 2 + rr(-0.2, 0.2) })); bars.forEach(b => addObstacle(b.x, b.z, 1.0));
    const barrels = spots(zi, 22, 2, 3, 4, 3).map(p => ({ ...p, ry: rr(0, 6) })); barrels.forEach(b => addObstacle(b.x, b.z, 0.5));
    const piles = spots(zi, 8, 4, 5, 5, 7).map(p => ({ ...p, ry: rr(0, 6), s: rr(1, 1.4) })); piles.forEach(p => addObstacle(p.x, p.z, 1.5 * p.s));
    inst(carGeo, white, cars); inst(barrierGeo, white, bars); inst(barrelGeo, white, barrels); inst(scrapGeo, white, piles);
    const dashes = []; for (let x = zn.cx - 26; x <= zn.cx + 26; x += 6) dashes.push({ x, y: 0.04, z: 0 });
    inst(new THREE.BoxGeometry(2.6, 0.02, 0.28), new THREE.MeshBasicMaterial({ color: 0xf2d14a }), dashes, false);
    const edge = []; for (let x = zn.cx - 27; x <= zn.cx + 27; x += 4) edge.push({ x, y: 0.04, z: -11 }, { x, y: 0.04, z: 11 });
    inst(new THREE.BoxGeometry(2.0, 0.02, 0.2), new THREE.MeshBasicMaterial({ color: 0xdcdcdc }), edge, false);
  }
  // ---- zone 4: bio-lab ruins ------------------------------------------------------------------------------------------------------
  {
    const zi = 3;
    const pods = spots(zi, 9, 3, 4, 5, 7).map(p => ({ ...p, ry: 0 })); pods.forEach(p => addObstacle(p.x, p.z, 1.3));
    const walls = spots(zi, 10, 3, 4.5, 5, 7).map(p => ({ ...p, ry: Math.floor(R() * 2) * Math.PI / 2 + rr(-0.2, 0.2) }));
    walls.forEach(w => { const c = Math.cos(w.ry), s = Math.sin(w.ry); for (const k of [-1.7, 0, 1.7]) addObstacle(w.x + c * k, w.z - s * k, 0.8); });
    const puddles = spots(zi, 14, 2, 0, 3).map(p => ({ ...p, y: 0.05, s: rr(0.7, 1.6) }));
    inst(podBase, white, pods);
    if (pods.length) {
      const glass = new THREE.InstancedMesh(podGlass, new THREE.MeshLambertMaterial({ color: 0x7dffcf, emissive: 0x2bbf8a, transparent: true, opacity: 0.55, depthWrite: false }), pods.length);
      pods.forEach((p, i) => { dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); glass.setMatrixAt(i, dummy.matrix); }); group.add(glass);
    }
    inst(wallGeo, white, walls);
    inst(puddleGeo, new THREE.MeshBasicMaterial({ color: 0x8aff4a, transparent: true, opacity: 0.5, depthWrite: false }), puddles, false);
  }
  // ---- zone 5: necropolis ------------------------------------------------------------------------------------------------------------
  {
    const zi = 4, zn = ZONES[zi];
    const tombs = spots(zi, 46, 2, 0, 3.5, 2.6).map(p => ({ ...p, ry: rr(-0.3, 0.3) })); tombs.forEach(t => addObstacle(t.x, t.z, 0.55));
    const dead = spots(zi, 16, 3, 3.5, 5, 5).map(p => ({ ...p, ry: rr(0, 6), s: rr(0.9, 1.4) })); dead.forEach(t => addObstacle(t.x, t.z, 0.5));
    const pillars = []; for (const x of [zn.cx - 18, zn.cx - 6, zn.cx + 6, zn.cx + 18]) for (const z of [-21, 21]) pillars.push({ x, z }); pillars.forEach(p => addObstacle(p.x, p.z, 1.0));
    inst(tombGeo, white, tombs); inst(deadTreeGeo, white, dead); inst(pillarGeo, white, pillars);
    const cx = zn.cx + zn.hx + 0.5;
    const cit = new THREE.Mesh(citadelGeo, vcMat()); cit.position.set(cx, 0, 0); cit.castShadow = true; group.add(cit);
    for (let z = -17; z <= 17; z += 4.2) addObstacle(cx - 1, z, 2.4);
  }

  // ---- bridges ---------------------------------------------------------------------------------------------------------------------------
  const bridgeObjs = BRIDGES.map(b => {
    const grp = new THREE.Group(); group.add(grp);
    const plankMat = new THREE.MeshLambertMaterial({ color: b.color });
    const nPl = 22, plLen = (b.x1 - b.x0 + 3.5) / nPl, planks = [], rails = [];
    for (let i = 0; i < nPl; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(plLen * 0.88, 0.3, b.hz * 2 + 0.6), plankMat);
      p.position.set(b.x0 - 1.75 + (i + 0.5) * plLen, -0.12, 0); p.castShadow = p.receiveShadow = true; p.scale.y = 0.001; p.visible = false; grp.add(p); planks.push(p);
    }
    for (const zs of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 3, 0.16, 0.16), woodMat); r.position.set((b.x0 + b.x1) / 2, 0.95, zs * (b.hz + 0.35)); r.visible = false; grp.add(r); rails.push(r);
      for (let x = b.x0; x <= b.x1 + 0.1; x += 3.6) { const p = new THREE.Mesh(postGeo, woodMat); p.position.set(x, 0.55, zs * (b.hz + 0.35)); p.visible = false; grp.add(p); rails.push(p); }
    }
    return { planks, rails, t: -1, built: false };
  });

  // ---- walkable areas ---------------------------------------------------------------------------------------------
  const rects = [];
  ZONES.forEach((q, i) => rects.push({ x0: q.cx - q.hx, x1: q.cx + q.hx, z0: q.cz - q.hz, z1: q.cz + q.hz, on: () => !!state.zoneUnlocked[i] }));
  BRIDGES.forEach(b => rects.push({ x0: b.x0 - 2, x1: b.x1 + 2, z0: -b.hz, z1: b.hz, on: () => !!state.zoneUnlocked[b.unlock] }));   // overlaps both zone rects by > 2r: no seam
  function walkable(x, z, r = 0) {
    for (const q of rects) if (q.on() && x >= q.x0 + r && x <= q.x1 - r && z >= q.z0 + r && z <= q.z1 - r) return true;
    return false;
  }
  function resolve(e, r) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i], dx = e.x - o.x, dz = e.z - o.z, rad = o.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rad * rad) {
        const d = Math.sqrt(d2) || 0.0001, k = (rad - d) / d;
        const nx = e.x + dx * k, nz = e.z + dz * k;
        if (walkable(nx, nz, r * 0.5)) { e.x = nx; e.z = nz; }
      }
    }
  }
  function move(e, dx, dz, r) {
    const nx = e.x + dx; if (walkable(nx, e.z, r)) e.x = nx;
    const nz = e.z + dz; if (walkable(e.x, nz, r)) e.z = nz;
    resolve(e, r);
  }
  function zoneAt(x) { let best = 0, bd = 1e9; for (let i = 0; i < ZONES.length; i++) { const d = Math.abs(x - ZONES[i].cx); if (d < bd) { bd = d; best = i; } } return best; }
  function inZone(i, x, z, m = 0) { const q = ZONES[i]; return Math.abs(x - q.cx) <= q.hx + m && Math.abs(z - q.cz) <= q.hz + m; }

  function showBridge(i, instant) {
    const b = bridgeObjs[i]; if (!b) return; b.built = true;
    if (instant) { b.planks.forEach(p => { p.visible = true; p.scale.y = 1; }); b.rails.forEach(r => (r.visible = true)); b.t = -1; } else b.t = 0;
  }

  const tmp = { x: 0, z: 0 };
  function update(dt, t) {
    wtex.offset.x = (t * 0.012) % 1; wtex.offset.y = (t * 0.006) % 1;
    for (const b of bridgeObjs) {
      if (b.t < 0) continue;
      b.t += dt; let all = true;
      b.planks.forEach((p, i) => {
        const k = clamp((b.t - i * 0.07) / 0.25, 0, 1);
        if (k > 0) { p.visible = true; p.scale.y = k < 1 ? 0.2 + 1.3 * Math.sin(k * Math.PI * 0.5) * (1 - k * 0.4) : 1; if (k < 1) all = false; } else all = false;
      });
      if (b.t > b.planks.length * 0.07 + 0.3) b.rails.forEach(r => (r.visible = true));
      if (all) { b.t = -1; b.planks.forEach(p => (p.scale.y = 1)); }
    }
  }
  /** Random point inside a zone, at least minDist away from (ax, az), off solids. */
  function randomSpot(zi, margin, ax, az, minDist, minCore = 0) {
    const q = ZONES[zi];
    for (let k = 0; k < 24; k++) {
      tmp.x = q.cx + (Math.random() * 2 - 1) * (q.hx - margin); tmp.z = q.cz + (Math.random() * 2 - 1) * (q.hz - margin);
      if ((tmp.x - ax) ** 2 + (tmp.z - az) ** 2 < minDist * minDist) continue;
      if (minCore && tmp.x * tmp.x + tmp.z * tmp.z < minCore * minCore) continue;
      let bad = false;
      for (const o of obstacles) if ((tmp.x - o.x) ** 2 + (tmp.z - o.z) ** 2 < (o.r + 0.9) ** 2) { bad = true; break; }
      if (!bad) return tmp;
    }
    return null;
  }

  const api = { group, ZONES, BRIDGES, rects, obstacles, addObstacle, removeObstacle, walkable, move, resolve, zoneAt, inZone, showBridge, update, randomSpot, fences: [] };
  /** Zombie-only solids (player fences): push `e` out of them and return the fence piece it is leaning on, if any. */
  api.resolveFences = function (e, r) {
    const list = api.fences; let hit = null;
    for (let i = 0; i < list.length; i++) {
      const f = list[i], dx = e.x - f.x, dz = e.z - f.z, rad = f.r + r, d2 = dx * dx + dz * dz;
      if (d2 < (rad + 0.3) * (rad + 0.3)) {
        hit = f;
        if (d2 < rad * rad) { const d = Math.sqrt(d2) || 0.0001, k = (rad - d) / d; e.x += dx * k; e.z += dz * k; }
      }
    }
    return hit;
  };
  return api;
}
