// Visual effects: particle bursts (instanced), floating damage numbers + HP bars (pooled DOM), screen shake.
import * as THREE from 'three';
import { rnd, TAU } from './util.js';

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export function createFx(scene, camera, getSize) {
  // ---- particles ----------------------------------------------------------------------------------------------
  const MAXP = 320;
  const pgeo = new THREE.IcosahedronGeometry(0.15, 1);
  const pmat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pmesh = new THREE.InstancedMesh(pgeo, pmat, MAXP);
  pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pmesh.frustumCulled = false; pmesh.count = 0;
  pmesh.setColorAt(0, _c.set(0xffffff));
  scene.add(pmesh);
  const parts = [];
  for (let i = 0; i < MAXP; i++) parts.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grav: 18, r: 0, g: 0, b: 0 });
  let pcount = 0;

  function burst(x, y, z, n, color, speed = 6, size = 1, life = 0.6, up = 5) {
    _c.set(color);
    for (let k = 0; k < n; k++) {
      let p = null;
      for (let j = 0; j < MAXP; j++) { const c = parts[(pcount + j) % MAXP]; if (!c.on) { p = c; pcount = (pcount + j + 1) % MAXP; break; } }
      if (!p) return;
      const a = rnd(0, TAU), s = rnd(0.3, 1) * speed;
      p.on = true; p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = rnd(0.3, 1) * up;
      p.life = p.max = life * rnd(0.7, 1.2); p.size = size * rnd(0.6, 1.2); p.grav = 18;
      p.r = _c.r; p.g = _c.g; p.b = _c.b;
    }
  }

  /** Directed spray (flames, sparks): n particles along (dx,dz) with some spread. */
  function spray(x, y, z, dx, dz, n, color, speed = 9, spread = 0.35, life = 0.4, size = 1.2) {
    _c.set(color);
    const base = Math.atan2(dx, dz);
    for (let k = 0; k < n; k++) {
      let p = null;
      for (let j = 0; j < MAXP; j++) { const c = parts[(pcount + j) % MAXP]; if (!c.on) { p = c; pcount = (pcount + j + 1) % MAXP; break; } }
      if (!p) return;
      const a = base + rnd(-spread, spread), s = rnd(0.6, 1) * speed;
      p.on = true; p.x = x; p.y = y; p.z = z; p.vx = Math.sin(a) * s; p.vz = Math.cos(a) * s; p.vy = rnd(-0.5, 1.5);
      p.life = p.max = life * rnd(0.7, 1.2); p.size = size * rnd(0.6, 1.2); p.grav = -1.5;
      p.r = _c.r; p.g = _c.g; p.b = _c.b;
    }
  }

  // ---- floating text + hp bars (DOM) ----------------------------------------------------------------------------
  const layer = document.getElementById('fxlayer');
  const texts = [];
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('div'); el.className = 'ft'; layer.appendChild(el);
    texts.push({ el, on: false, x: 0, y: 0, z: 0, t: 0, dur: 0.8, sc: 1 });
  }
  let ti = 0;
  function text(x, y, z, str, color = '#fff', scale = 1, dur = 0.8) {
    const o = texts[ti]; ti = (ti + 1) % texts.length;
    o.on = true; o.x = x + rnd(-0.3, 0.3); o.y = y; o.z = z; o.t = 0; o.dur = dur; o.sc = scale;
    o.el.textContent = str; o.el.style.color = color; o.el.style.display = 'block';
  }

  const bars = [];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement('div'); el.className = 'hb'; const f = document.createElement('i'); el.appendChild(f); layer.appendChild(el);
    bars.push({ el, f, used: false });
  }
  /** Ask for an hp bar slot this frame. Call bar(x,y,z,frac) for each entity that should show one. */
  let bi = 0;
  function bar(x, y, z, frac) {
    if (bi >= bars.length) return;
    const b = bars[bi++];
    const s = project(x, y, z);
    if (!s) return;
    b.used = true;
    b.el.style.display = 'block';
    b.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`;
    b.f.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    b.f.style.background = frac > 0.5 ? '#6bff5a' : frac > 0.25 ? '#ffd24a' : '#ff5a4a';
  }

  const sp = { x: 0, y: 0 };
  function project(x, y, z) {
    _v.set(x, y, z).project(camera);
    if (_v.z > 1) return null;
    const { w, h } = getSize();
    sp.x = (_v.x * 0.5 + 0.5) * w; sp.y = (-_v.y * 0.5 + 0.5) * h;
    return sp;
  }

  // ---- shake ------------------------------------------------------------------------------------------------------
  let shake = 0;
  const addShake = a => { shake = Math.min(1.2, Math.max(shake, a)); };

  function update(dt) {
    // particles
    let n = 0;
    for (let i = 0; i < MAXP; i++) {
      const p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      const k = Math.min(1, p.life / p.max * 1.6) * p.size;
      _s.set(k, k, k); _p.set(p.x, p.y, p.z);
      _m.compose(_p, _q, _s);
      pmesh.setMatrixAt(n, _m);
      _c.setRGB(p.r, p.g, p.b); pmesh.setColorAt(n, _c);
      n++;
    }
    pmesh.count = n;
    pmesh.instanceMatrix.needsUpdate = true;
    if (pmesh.instanceColor) pmesh.instanceColor.needsUpdate = true;

    // floating texts
    for (const o of texts) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= o.dur) { o.on = false; o.el.style.display = 'none'; continue; }
      const s = project(o.x, o.y + o.t * 2.2, o.z);
      if (!s) { o.el.style.display = 'none'; continue; }
      const k = o.t / o.dur, pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
      o.el.style.display = 'block';
      o.el.style.opacity = k > 0.6 ? String(1 - (k - 0.6) / 0.4) : '1';
      o.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-50%) scale(${(pop * o.sc).toFixed(2)})`;
    }
    // hp bars: hide the ones not requested this frame
    for (let i = bi; i < bars.length; i++) if (bars[i].used) { bars[i].used = false; bars[i].el.style.display = 'none'; }
    bi = 0;
    shake = Math.max(0, shake - dt * 2.8);
  }

  function shakeOffset(out) {
    if (shake <= 0.01) { out.set(0, 0, 0); return out; }
    const a = shake * shake * 0.55;
    out.set(rnd(-a, a), rnd(-a, a) * 0.6, rnd(-a, a));
    return out;
  }

  return { burst, spray, text, bar, update, addShake, shakeOffset, project };
}
