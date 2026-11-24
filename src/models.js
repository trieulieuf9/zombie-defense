// Character models. Each model is ONE merged mesh (one draw call) whose legs and arms are tagged with a pivot, so the
// vertex shader (see limbMaterial in util.js) can swing them: walking legs, groaning arms, raised arms for a slam.
import { mergeParts } from './util.js';

/** A leg: thigh + shoe, swinging around the hip. side = +1 / -1 (opposite legs swing in opposite directions). */
function leg(side, x, { w = 0.3, h = 0.7, d = 0.34, c = 0x2b3a67, shoe = 0x3a2a1c, foot = 0.16 } = {}) {
  const limb = { kind: 'leg', side, pivot: [x, h, 0] };
  return [
    { t: 'box', s: [w, h, d], p: [x, h / 2, 0], c, limb },
    { t: 'box', s: [w + 0.05, foot, d + 0.2], p: [x, foot / 2, 0.08], c: shoe, limb },
  ];
}
/** An arm reaching forward (zombie style) or hanging down. Swings around the shoulder. */
function arm(side, x, y, { len = 0.7, w = 0.22, c = 0x9bd05a, hand = null, down = false, z0 = 0.1, swing = true } = {}) {
  const limb = swing ? { kind: 'arm', side, pivot: [x, y, z0] } : undefined;
  const parts = [];
  if (down) {
    parts.push({ t: 'box', s: [w, len, w], p: [x, y - len / 2, z0], c, limb });
    if (hand !== null) parts.push({ t: 'sph', s: [w * 0.75], p: [x, y - len - 0.02, z0], c: hand, limb });
  } else {
    parts.push({ t: 'box', s: [w, w, len], p: [x, y, z0 + len / 2], c, limb });
    if (hand !== null) parts.push({ t: 'sph', s: [w * 0.75], p: [x, y, z0 + len + 0.02], c: hand, limb });
  }
  return parts;
}
const eyes = (y, z, c, s = 0.12, dx = 0.13) => [{ t: 'sph', s: [s * 0.55], p: [-dx, y, z], c }, { t: 'sph', s: [s * 0.55], p: [dx, y, z], c }];

export function playerParts() {
  const skin = 0xf2c59c;
  return [
    ...leg(1, -0.2, { c: 0x2b3a67, shoe: 0x4a2f1a }), ...leg(-1, 0.2, { c: 0x2b3a67, shoe: 0x4a2f1a }),
    { t: 'box', s: [0.88, 0.16, 0.54], p: [0, 0.76, 0], c: 0x2a2a2a }, { t: 'box', s: [0.14, 0.18, 0.04], p: [0, 0.76, 0.28], c: 0xe0b020 },
    { t: 'box', s: [0.86, 0.85, 0.52], p: [0, 1.17, 0], c: 0x3d7de0 },
    { t: 'box', s: [0.2, 0.9, 0.1], p: [0.22, 1.18, 0.0], r: [0, 0, 0.0], c: 0x8a5a2a },       // quiver strap (back)
    { t: 'cyl', s: [0.13, 0.13, 0.8, 8], p: [0.25, 1.35, -0.34], r: [0.35, 0, 0], c: 0x7a4a24 },  // quiver
    { t: 'box', s: [0.04, 0.4, 0.04], p: [0.22, 1.85, -0.5], c: 0xd9b98a }, { t: 'box', s: [0.04, 0.4, 0.04], p: [0.3, 1.82, -0.5], c: 0xd9b98a }, { t: 'box', s: [0.14, 0.1, 0.1], p: [0.26, 2.04, -0.5], c: 0xe0453a },
    { t: 'cyl', s: [0.17, 0.2, 0.14, 10], p: [0, 1.66, 0], c: skin },
    { t: 'sph', s: [0.35], p: [0, 1.9, 0], sc: [1, 1, 0.96], c: skin },
    ...eyes(1.93, 0.3, 0x222222, 0.13), { t: 'sph', s: [0.06], p: [0, 1.85, 0.34], c: 0xe0a07a },
    { t: 'box', s: [0.66, 0.2, 0.64], p: [0, 2.12, -0.02], c: 0xe5483a }, { t: 'box', s: [0.62, 0.08, 0.32], p: [0, 2.02, 0.4], c: 0xc93a2e },
    { t: 'box', s: [0.22, 0.22, 0.6], p: [-0.5, 1.15, 0.38], c: 0x3d7de0 }, { t: 'box', s: [0.22, 0.22, 0.6], p: [0.5, 1.15, 0.38], c: 0x3d7de0 },
    { t: 'sph', s: [0.15], p: [-0.5, 1.15, 0.72], c: skin }, { t: 'sph', s: [0.15], p: [0.5, 1.15, 0.72], c: skin },
  ];
}

export function soldierParts() {
  const skin = 0xf2c59c;
  return [
    ...leg(1, -0.18, { w: 0.28, h: 0.66, d: 0.32, c: 0x3a4a2a, shoe: 0x2a2a22 }), ...leg(-1, 0.18, { w: 0.28, h: 0.66, d: 0.32, c: 0x3a4a2a, shoe: 0x2a2a22 }),
    { t: 'box', s: [0.8, 0.82, 0.5], p: [0, 1.05, 0], c: 0x5a7a3a }, { t: 'box', s: [0.82, 0.14, 0.52], p: [0, 0.68, 0], c: 0x2a2a22 }, { t: 'box', s: [0.5, 0.4, 0.1], p: [0, 1.1, 0.28], c: 0x4a6a2a },
    { t: 'sph', s: [0.28], p: [0, 1.66, 0], c: skin }, ...eyes(1.68, 0.24, 0x222222, 0.11, 0.11),
    { t: 'sph', s: [0.34], p: [0, 1.85, -0.02], sc: [1, 0.7, 1], c: 0x3a4a2a }, { t: 'box', s: [0.62, 0.07, 0.62], p: [0, 1.78, 0], c: 0x3a4a2a },
    { t: 'box', s: [0.2, 0.2, 0.5], p: [-0.45, 1.05, 0.34], c: 0x5a7a3a }, { t: 'box', s: [0.2, 0.2, 0.5], p: [0.45, 1.05, 0.34], c: 0x5a7a3a },
    { t: 'sph', s: [0.13], p: [-0.45, 1.05, 0.62], c: skin }, { t: 'sph', s: [0.13], p: [0.45, 1.05, 0.62], c: skin },
    { t: 'box', s: [0.14, 0.2, 0.9], p: [0, 1.1, 0.72], c: 0x22262b },
  ];
}

export function botParts() {
  return [
    ...leg(1, -0.2, { w: 0.26, h: 0.5, d: 0.3, c: 0x2b4a6a, shoe: 0x1f3550, foot: 0.12 }), ...leg(-1, 0.2, { w: 0.26, h: 0.5, d: 0.3, c: 0x2b4a6a, shoe: 0x1f3550, foot: 0.12 }),
    { t: 'box', s: [0.72, 0.8, 0.56], p: [0, 0.9, 0], c: 0x3a9be0 }, { t: 'sph', s: [0.4], p: [0, 1.58, 0], c: 0xf4f4f4 }, { t: 'box', s: [0.46, 0.14, 0.1], p: [0, 1.6, 0.34], c: 0x1a2a3a },
    { t: 'sph', s: [0.07], p: [-0.12, 1.6, 0.4], c: 0x7fe9ff }, { t: 'sph', s: [0.07], p: [0.12, 1.6, 0.4], c: 0x7fe9ff },
    { t: 'cyl', s: [0.03, 0.03, 0.4, 4], p: [0, 2.08, 0], c: 0x444444 }, { t: 'sph', s: [0.09], p: [0, 2.3, 0], c: 0xff4d4d },
    { t: 'box', s: [0.8, 0.9, 0.3], p: [0, 0.92, -0.42], c: 0xffd24a },
    ...arm(-1, -0.46, 1.15, { len: 0.5, w: 0.16, c: 0x3a9be0, hand: 0xf4f4f4, down: true, z0: 0 }), ...arm(1, 0.46, 1.15, { len: 0.5, w: 0.16, c: 0x3a9be0, hand: 0xf4f4f4, down: true, z0: 0 }),
  ];
}

export function zombieParts(type) {
  switch (type) {
    case 'runner': {
      const skin = 0xb5e06a;
      return [
        ...leg(1, -0.18, { w: 0.26, h: 0.75, d: 0.3, c: 0x33333d, shoe: 0x22222a }), ...leg(-1, 0.18, { w: 0.26, h: 0.75, d: 0.3, c: 0x33333d, shoe: 0x22222a }),
        { t: 'box', s: [0.74, 0.2, 0.44], p: [0, 0.86, 0], c: 0x6a2a22 }, { t: 'box', s: [0.72, 0.85, 0.42], p: [0, 1.2, 0], c: 0xc44a3a },
        { t: 'cyl', s: [0.14, 0.17, 0.2, 8], p: [0, 1.68, 0.05], c: skin }, { t: 'sph', s: [0.31], p: [0, 1.88, 0.1], sc: [1, 0.95, 1], c: skin },
        ...eyes(1.9, 0.33, 0xfff23a, 0.11, 0.12), { t: 'box', s: [0.3, 0.07, 0.06], p: [0, 1.7, 0.36], c: 0x4a1a1a },
        { t: 'sph', s: [0.34], p: [0, 2.0, 0.0], sc: [1, 0.55, 1], c: 0x2a1a12 },
        ...arm(1, -0.46, 1.38, { len: 0.8, w: 0.18, c: skin, hand: skin }), ...arm(-1, 0.46, 1.38, { len: 0.8, w: 0.18, c: skin, hand: skin }),
      ];
    }
    case 'spitter': {
      const skin = 0x8fc050;
      return [
        ...leg(1, -0.28, { w: 0.34, h: 0.6, d: 0.36, c: 0x3a3252, shoe: 0x2a2238 }), ...leg(-1, 0.28, { w: 0.34, h: 0.6, d: 0.36, c: 0x3a3252, shoe: 0x2a2238 }),
        { t: 'sph', s: [0.62], p: [0, 1.12, 0], sc: [1.0, 0.85, 0.85], c: 0x7a5aa8 }, { t: 'sph', s: [0.5], p: [0, 1.05, 0.36], c: 0xc8ff3a },
        { t: 'sph', s: [0.28], p: [0, 1.85, 0.1], c: skin }, ...eyes(1.88, 0.34, 0xffee33, 0.12, 0.12), { t: 'box', s: [0.3, 0.14, 0.1], p: [0, 1.68, 0.34], c: 0x274a12 },
        { t: 'sph', s: [0.12], p: [0.2, 2.1, 0.1], c: 0xc8ff3a },
        ...arm(1, -0.72, 1.35, { len: 0.75, w: 0.24, c: skin, hand: skin, down: true, z0: 0.15 }), ...arm(-1, 0.72, 1.35, { len: 0.75, w: 0.24, c: skin, hand: skin, down: true, z0: 0.15 }),
      ];
    }
    case 'riot': {
      const skin = 0x9bd05a;
      return [
        ...leg(1, -0.2, { w: 0.32, h: 0.7, d: 0.36, c: 0x33384a, shoe: 0x1a1d28 }), ...leg(-1, 0.2, { w: 0.32, h: 0.7, d: 0.36, c: 0x33384a, shoe: 0x1a1d28 }),
        { t: 'box', s: [0.98, 0.95, 0.6], p: [0, 1.17, 0], c: 0x4a5878 }, { t: 'box', s: [0.7, 0.4, 0.1], p: [0, 1.27, 0.32], c: 0x2f3a52 },
        { t: 'sph', s: [0.29], p: [0, 1.9, 0.02], c: skin }, { t: 'sph', s: [0.37], p: [0, 2.06, 0], sc: [1, 0.75, 1], c: 0x2a3550 }, { t: 'box', s: [0.52, 0.18, 0.08], p: [0, 1.95, 0.3], c: 0x8fd0ff },
        { t: 'box', s: [1.0, 1.35, 0.14], p: [0, 1.15, 0.78], c: 0x3a4a6a }, { t: 'box', s: [1.0, 0.18, 0.16], p: [0, 1.55, 0.78], c: 0xe0b020 }, { t: 'box', s: [0.16, 1.1, 0.16], p: [0, 1.1, 0.8], c: 0xe0b020 },
        { t: 'box', s: [0.22, 0.22, 0.6], p: [-0.55, 1.2, 0.45], c: skin }, { t: 'box', s: [0.22, 0.22, 0.6], p: [0.55, 1.2, 0.45], c: skin },
      ];
    }
    case 'brute': {
      const skin = 0x9bd05a;
      return [
        ...leg(1, -0.35, { w: 0.42, h: 0.8, d: 0.46, c: 0x5a4a3a, shoe: 0x3a2a1c, foot: 0.2 }), ...leg(-1, 0.35, { w: 0.42, h: 0.8, d: 0.46, c: 0x5a4a3a, shoe: 0x3a2a1c, foot: 0.2 }),
        { t: 'sph', s: [0.85], p: [0, 1.5, -0.05], sc: [1.0, 0.8, 0.8], c: 0x8a6a4a }, { t: 'sph', s: [0.35], p: [-0.5, 1.55, 0.45], c: 0xd96a8a }, { t: 'sph', s: [0.28], p: [0.45, 1.0, 0.45], c: 0xd96a8a },
        { t: 'sph', s: [0.3], p: [0, 2.25, 0.2], c: skin }, ...eyes(2.3, 0.46, 0xfff23a, 0.13, 0.13),
        { t: 'cone', s: [0.2, 0.7, 6], p: [-0.4, 2.2, -0.5], r: [-0.5, 0, 0], c: 0xe8dcc0 }, { t: 'cone', s: [0.2, 0.7, 6], p: [0.4, 2.2, -0.5], r: [-0.5, 0, 0], c: 0xe8dcc0 }, { t: 'cone', s: [0.22, 0.8, 6], p: [0, 2.3, -0.55], r: [-0.5, 0, 0], c: 0xe8dcc0 },
        ...arm(1, -1.0, 1.55, { len: 1.2, w: 0.5, c: skin, hand: 0xb8e070, down: false, z0: 0.0 }), ...arm(-1, 1.0, 1.55, { len: 1.2, w: 0.5, c: skin, hand: 0xb8e070, down: false, z0: 0.0 }),
      ];
    }
    case 'titan': {
      const skin = 0x9a8aa8;
      return [
        ...leg(1, -0.4, { w: 0.46, h: 0.9, d: 0.5, c: 0x3a2a4a, shoe: 0x241a30, foot: 0.22 }), ...leg(-1, 0.4, { w: 0.46, h: 0.9, d: 0.5, c: 0x3a2a4a, shoe: 0x241a30, foot: 0.22 }),
        { t: 'sph', s: [0.95], p: [0, 1.65, 0], sc: [1.0, 0.8, 0.75], c: 0x4a2a5a }, { t: 'box', s: [0.9, 0.12, 0.1], p: [0, 1.75, 0.6], c: 0xff4d7a }, { t: 'box', s: [0.12, 0.8, 0.1], p: [0.2, 1.55, 0.6], c: 0xff4d7a }, { t: 'box', s: [0.12, 0.6, 0.1], p: [-0.25, 1.45, 0.6], r: [0, 0, 0.5], c: 0xff4d7a },
        { t: 'sph', s: [0.38], p: [0, 2.65, 0.15], c: skin }, ...eyes(2.7, 0.5, 0xffe14d, 0.16, 0.17),
        { t: 'cone', s: [0.14, 0.9, 6], p: [-0.38, 3.2, 0.1], r: [0, 0, 0.35], c: 0xe8dcc0 }, { t: 'cone', s: [0.14, 0.9, 6], p: [0.38, 3.2, 0.1], r: [0, 0, -0.35], c: 0xe8dcc0 },
        { t: 'sph', s: [0.5], p: [-1.15, 2.1, 0.0], c: 0x7a6a88 }, { t: 'sph', s: [0.5], p: [1.15, 2.1, 0.0], c: 0x7a6a88 },
        ...arm(1, -1.15, 1.9, { len: 1.5, w: 0.62, c: 0x7a6a88, hand: 0x4a3a5a, down: true, z0: 0.0 }), ...arm(-1, 1.15, 1.9, { len: 1.5, w: 0.62, c: 0x7a6a88, hand: 0x4a3a5a, down: true, z0: 0.0 }),
      ];
    }
    default: {   // shambler
      const skin = 0x9bd05a;
      return [
        ...leg(1, -0.2, { w: 0.3, h: 0.7, d: 0.34, c: 0x4a4a58, shoe: 0x2a2a30 }), ...leg(-1, 0.2, { w: 0.3, h: 0.7, d: 0.34, c: 0x4a4a58, shoe: 0x2a2a30 }),
        { t: 'box', s: [0.88, 0.9, 0.52], p: [0, 1.15, 0], c: 0x7a6a55 }, { t: 'box', s: [0.3, 0.3, 0.1], p: [0.2, 1.0, 0.27], c: 0x9a8a72 }, { t: 'box', s: [0.5, 0.1, 0.1], p: [-0.1, 1.4, 0.27], c: 0xcfc6a8, rad: 0.02 },
        { t: 'cyl', s: [0.14, 0.18, 0.16, 8], p: [0, 1.66, 0.05], c: skin }, { t: 'sph', s: [0.31], p: [0, 1.9, 0.04], c: skin },
        ...eyes(1.92, 0.3, 0xe83a2a, 0.12, 0.13), { t: 'box', s: [0.28, 0.07, 0.06], p: [0, 1.7, 0.31], c: 0x3a2a1a },
        { t: 'sph', s: [0.33], p: [0, 2.07, -0.02], sc: [1, 0.55, 1], c: 0x3a2a1a },
        ...arm(1, -0.52, 1.3, { len: 0.78, w: 0.2, c: skin, hand: skin }), ...arm(-1, 0.52, 1.3, { len: 0.78, w: 0.2, c: skin, hand: skin }),
      ];
    }
  }
}

export const playerGeo = () => mergeParts(playerParts());
export const soldierGeo = () => mergeParts(soldierParts());
export const botGeo = () => mergeParts(botParts());
export const zombieGeo = type => mergeParts(zombieParts(type));
