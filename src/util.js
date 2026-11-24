import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export function angLerp(a, b, t) {
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

/**
 * Merge a list of coloured primitives into ONE BufferGeometry with vertex colours (one draw call per model).
 * part = { t:'box'|'cyl'|'cone'|'sph'|'oct', s:[...size], p:[x,y,z], r:[rx,ry,rz], c:0xRRGGBB }
 *   box: s=[w,h,d]   cyl: s=[radiusTop,radiusBottom,h,segments]   cone: s=[r,h,segments]   sph: s=[r]   oct: s=[r]
 */
export function mergeParts(parts) {
  const pos = [], nor = [], col = [], limbA = [], pivA = [];
  let anyLimb = false;
  const color = new THREE.Color();
  for (const part of parts) {
    const s = part.s;
    let g;
    switch (part.t) {
      case 'cyl': g = new THREE.CylinderGeometry(s[0], s[1], s[2], Math.max(s[3] || 10, 10)); break;
      case 'cone': g = new THREE.ConeGeometry(s[0], s[1], Math.max(s[2] || 10, 10)); break;
      case 'sph': g = new THREE.SphereGeometry(s[0], 14, 10); break;
      case 'oct': g = new THREE.OctahedronGeometry(s[0], 1); break;
      default: g = roundedBox(s[0], s[1], s[2], part.rad !== undefined ? part.rad : Math.min(0.38 * Math.min(s[0], s[1], s[2]), 0.28));
    }
    if (part.sc) g.scale(part.sc[0], part.sc[1], part.sc[2]);
    const p = part.p || [0, 0, 0], r = part.r || [0, 0, 0];
    _q.setFromEuler(_e.set(r[0], r[1], r[2]));
    _m.compose(_p.set(p[0], p[1], p[2]), _q, _s);
    g.applyMatrix4(_m);
    const ng = g.index ? g.toNonIndexed() : g;
    const pa = ng.attributes.position.array, na = ng.attributes.normal.array;
    color.set(part.c === undefined ? 0xffffff : part.c);
    for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
    const nv = pa.length / 3;
    for (let i = 0; i < nv; i++) col.push(color.r, color.g, color.b);
    const L = part.limb;
    if (L) anyLimb = true;
    for (let i = 0; i < nv; i++) { limbA.push(L ? (L.kind === 'leg' ? 1 : 2) * L.side : 0); pivA.push(L ? L.pivot[0] : 0, L ? L.pivot[1] : 0, L ? L.pivot[2] : 0); }
    g.dispose(); if (ng !== g) ng.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (anyLimb) { geo.setAttribute('aLimb', new THREE.Float32BufferAttribute(limbA, 1)); geo.setAttribute('aPivot', new THREE.Float32BufferAttribute(pivA, 3)); }
  geo.computeBoundingSphere();
  return geo;
}

/** A box with rounded edges and smooth normals (3x3 vertices per face is enough for a soft "toy plastic" look). */
export function roundedBox(w, h, d, r) {
  if (r <= 0.0001) return new THREE.BoxGeometry(w, h, d);
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = clamp(v.x, -hx, hx), cy = clamp(v.y, -hy, hy), cz = clamp(v.z, -hz, hz);
    n.set(v.x - cx, v.y - cy, v.z - cz);
    if (n.lengthSq() > 1e-10) { n.normalize(); v.set(cx, cy, cz).addScaledVector(n, r); pos.setXYZ(i, v.x, v.y, v.z); nor.setXYZ(i, n.x, n.y, n.z); }
  }
  return g;
}

/** Parts for a bow standing in the YZ plane: a "C" whose belly points at the target (+z), with the string behind it. */
export function bowParts({ x = 0, y = 1.2, z = 0.9, R = 0.62, span = 1.15, th = 0.07, color = 0x8a5a2a, tip = null, string = 0xf2efe6 }) {
  const parts = [], N = 8, pts = [];
  for (let i = 0; i <= N; i++) { const a = -span + (2 * span * i) / N; pts.push([y + R * Math.sin(a), z - R * (1 - Math.cos(a)) * 0.9]); }
  for (let i = 0; i < N; i++) {
    const [y0, z0] = pts[i], [y1, z1] = pts[i + 1], dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz);
    parts.push({ t: 'box', s: [th, th, len + 0.03], p: [x, (y0 + y1) / 2, (z0 + z1) / 2], r: [-Math.atan2(dy, dz), 0, 0], c: i === N / 2 - 1 || i === N / 2 ? 0x4a2f16 : color, rad: th * 0.45 });
  }
  const top = pts[N], bot = pts[0];
  if (tip !== null) { parts.push({ t: 'sph', s: [th * 0.9], p: [x, top[0], top[1]], c: tip }, { t: 'sph', s: [th * 0.9], p: [x, bot[0], bot[1]], c: tip }); }
  parts.push({ t: 'box', s: [0.015, top[0] - bot[0], 0.015], p: [x, (top[0] + bot[0]) / 2, top[1]], c: string, sharp: true, rad: 0 });
  return parts;
}

// ---- animated limbs ------------------------------------------------------------------------------------------------------
// Legs/arms are tagged in the geometry (aLimb = +-1 leg, +-2 arm, aPivot = joint). The vertex shader swings them about the X
// axis, so a whole character stays ONE mesh / ONE draw call. Uniforms live on material.userData.limb.
const LIMB_DECL = 'attribute float aLimb; attribute vec3 aPivot; uniform float uPhase; uniform float uAmp; uniform float uArm; uniform float uArmOff;\n';
const LIMB_ANGLE = `float limbK = abs(aLimb); float limbAng = 0.0;
  if (limbK > 0.5) { float sd = sign(aLimb); limbAng = limbK < 1.5 ? uAmp * sin(uPhase) * sd : uArmOff - uArm * sin(uPhase) * sd; }
  float limbC = cos(limbAng), limbS = sin(limbAng);\n`;
const LIMB_POS = 'if (limbK > 0.5) { vec2 pv = transformed.yz - aPivot.yz; transformed.yz = aPivot.yz + vec2(limbC * pv.x - limbS * pv.y, limbS * pv.x + limbC * pv.y); }\n';
export function limbMaterial(extra) {
  const u = { uPhase: { value: 0 }, uAmp: { value: 0 }, uArm: { value: 0 }, uArmOff: { value: 0 } };
  const m = vcMat(extra); m.userData.limb = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = LIMB_DECL + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + LIMB_ANGLE + 'if (limbK > 0.5) { objectNormal.yz = vec2(limbC * objectNormal.y - limbS * objectNormal.z, limbS * objectNormal.y + limbC * objectNormal.z); }')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LIMB_POS);
  };
  m.customProgramCacheKey = () => 'limb-lambert';
  return m;
}
/** Depth material for shadows that follows the same limb swing. Attach with mesh.customDepthMaterial. */
export function limbDepth(mat) {
  const u = mat.userData.limb;
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = LIMB_DECL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + LIMB_ANGLE + LIMB_POS);
  };
  d.customProgramCacheKey = () => 'limb-depth';
  return d;
}
export function setLimb(mat, phase, amp, arm, armOff = 0) {
  const u = mat.userData.limb; if (!u) return;
  u.uPhase.value = phase; u.uAmp.value = amp; u.uArm.value = arm; u.uArmOff.value = armOff;
}

export const vcMat = (extra) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, extra));

/** Tiled, painted ground texture (cheap "hyper-casual" grass). */
export function groundTexture(base, dark, light, tiles = 16, px = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, px, px);
  softBlobs(g, px, 70, dark, 40, 120, 0.5); softBlobs(g, px, 70, light, 40, 120, 0.4);
  g.globalAlpha = 0.28; g.strokeStyle = light; g.lineWidth = 2.5; g.lineCap = 'round';
  for (let i = 0; i < 520; i++) { const x = Math.random() * px, y = Math.random() * px; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - 8 - Math.random() * 8); g.stroke(); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/** Soft round blotches (wrap around the edges so the texture tiles without seams). */
export function softBlobs(g, px, n, color, rmin, rmax, alpha, rand = Math.random) {
  for (let i = 0; i < n; i++) {
    const x = rand() * px, y = rand() * px, r = rmin + rand() * (rmax - rmin);
    for (const ox of [-px, 0, px]) for (const oy of [-px, 0, px]) {
      if (x + ox + r < 0 || x + ox - r > px || y + oy + r < 0 || y + oy - r > px) continue;
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  g.globalAlpha = 1;
}
