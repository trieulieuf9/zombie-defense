// Pure data: every build pad in the game.
// costs[i] = price of level i+1 (length = max level). A cost is a number (meat) or { m: meat, s: scrap, e: energy cells }.
// kind decides what happens when a level completes (see buildings.js / heavy.js). req = pad ids that must be fully built first.
// zone = index into ZONES (0..4). base = display offset for the level text. names[i] = custom title for level i.
// action pads (convert / endless) have no cost: standing on them does something.
export const PADS = [
  // ---- Zone 1: The Safe Clearing ---------------------------------------------------------------------------------
  { id: 'turret1', kind: 'turret', zone: 0, x: -9, z: -9, name: 'Machine Gun', icon: '🔫', costs: [15], req: [], hint: 'Shoots zombies for you' },
  { id: 'pack', kind: 'pack', zone: 0, x: -13, z: 9, name: 'Backpack', icon: '🎒', costs: [20, 35, 55, 80, 115, 160], req: ['turret1'], hint: '+5 carry capacity' },
  { id: 'turret2', kind: 'turret', zone: 0, x: 9, z: -9, name: 'Machine Gun', icon: '🔫', costs: [30], req: ['turret1'], hint: 'Shoots zombies for you' },
  { id: 'weapon', kind: 'weapon', zone: 0, x: 13, z: 9, name: 'Bow Upgrade', icon: '🏹', costs: [25, 45, 70, 100, 140, 190], req: ['turret1'], hint: '+arrow damage, +fire rate' },
  { id: 'bridge', kind: 'bridge', zone: 0, x: 21, z: 0, name: 'Bridge to Zone 2', icon: '🌉', costs: [50], req: ['turret1'], hint: 'Unlocks the Overgrown Forest' },
  { id: 'fenceS', kind: 'fence', arc: 0, zone: 0, x: 0, z: 16.5, name: 'South Fence', icon: '🚧', costs: [40, 110, 260], req: ['turret2'], hint: 'Zombies must chew through it' },
  { id: 'fenceW', kind: 'fence', arc: 1, zone: 0, x: -17.5, z: -2.5, name: 'West Fence', icon: '🚧', costs: [40, 110, 260], req: ['turret2'], hint: 'Zombies must chew through it' },
  { id: 'fenceN', kind: 'fence', arc: 2, zone: 0, x: 3.5, z: -16.5, name: 'North Fence', icon: '🚧', costs: [40, 110, 260], req: ['turret2'], hint: 'Zombies must chew through it' },
  // ---- Zone 2: The Overgrown Forest ------------------------------------------------------------------------------
  { id: 'hut', kind: 'hut', zone: 1, x: 55, z: -12, name: 'Collector Hut', icon: '🏠', costs: [60], req: ['bridge'], hint: 'Spawns a bot that fetches meat' },
  { id: 'hire', kind: 'hire', zone: 1, x: 55, z: 12, name: 'Hire Collector', icon: '🤖', costs: [40, 70, 110], req: ['hut'], hint: '+1 collector bot' },
  { id: 'sniper1', kind: 'sniper', zone: 1, x: 68, z: -16, name: 'Sniper Turret', icon: '🎯', costs: [90], req: ['hut'], hint: 'Long range, hits hard' },
  { id: 'sniper2', kind: 'sniper', zone: 1, x: 68, z: 16, name: 'Sniper Turret', icon: '🎯', costs: [120], req: ['sniper1'], hint: 'Long range, hits hard' },
  { id: 'boots', kind: 'boots', zone: 1, x: 66, z: 8, name: 'Speed Boots', icon: '👟', costs: [40, 90, 160], req: ['bridge'], hint: '+12% move speed' },
  { id: 'spike1', kind: 'spikes', zone: 1, x: 80, z: -9, name: 'Spike Trap', icon: '⚠️', costs: [35], req: ['hut'], hint: 'Hurts zombies walking over it' },
  { id: 'spike2', kind: 'spikes', zone: 1, x: 80, z: 9, name: 'Spike Trap', icon: '⚠️', costs: [35], req: ['spike1'], hint: 'Hurts zombies walking over it' },
  { id: 'spike3', kind: 'spikes', zone: 1, x: 90, z: 0, name: 'Spike Trap', icon: '⚠️', costs: [45], req: ['spike2'], hint: 'Hurts zombies walking over it' },
  { id: 'gate3', kind: 'gate', zone: 1, x: 98, z: 0, name: 'Gate to Zone 3', icon: '🚪', costs: [200], req: ['sniper1'], hint: 'Opens the Abandoned Highway' },
  // ---- Zone 3: Abandoned Highway & Scrapyard -----------------------------------------------------------------------
  { id: 'refinery', kind: 'refinery', zone: 2, x: 134, z: -13, name: 'Meat Refinery', icon: '🏭', costs: [{ m: 120, s: 8 }], req: ['gate3'], hint: 'Turns 🥩 into ⚡ energy cells' },
  { id: 'convert', kind: 'convert', action: true, zone: 2, x: 134, z: -4.5, name: 'Refinery Input', icon: '⚡', costs: [], req: ['refinery'], hint: 'Stand here: 2 🥩 → 1 ⚡' },
  { id: 'pack2', kind: 'pack', zone: 2, x: 134, z: 13, base: 6, name: 'Backpack', icon: '🎒', costs: [{ m: 250, s: 10 }, { m: 350, s: 15 }, { m: 480, s: 25 }, { m: 650, s: 40 }], req: ['gate3'], hint: '+5 carry capacity' },
  { id: 'vest', kind: 'vest', zone: 2, x: 143, z: 0, name: 'Armor Vest', icon: '🦺', costs: [{ m: 200, s: 15 }, { m: 320, s: 25 }, { m: 480, s: 40 }, { m: 700, s: 60 }], req: ['gate3'], hint: '+25 max health' },
  { id: 'weapon2', kind: 'weapon', zone: 2, x: 148, z: 14, base: 6, name: 'Bow Upgrade', icon: '🏹', costs: [{ m: 300, s: 12 }, { m: 420, s: 20 }, { m: 580, s: 30 }, { m: 800, s: 45 }], req: ['gate3'], hint: '+arrow damage, +fire rate' },
  { id: 'flame1', kind: 'flame', zone: 2, x: 146, z: -14, name: 'Flame Turret', icon: '🔥', costs: [{ m: 180, s: 15, e: 6 }], req: ['refinery'], hint: 'Burns everything in front' },
  { id: 'flame2', kind: 'flame', zone: 2, x: 160, z: -14, name: 'Flame Turret', icon: '🔥', costs: [{ m: 260, s: 25, e: 10 }], req: ['flame1'], hint: 'Burns everything in front' },
  { id: 'flame3', kind: 'flame', zone: 2, x: 162, z: 14, name: 'Flame Turret', icon: '🔥', costs: [{ m: 340, s: 35, e: 14 }], req: ['flame2'], hint: 'Burns everything in front' },
  { id: 'squad', kind: 'squad', zone: 2, x: 154, z: 0, name: 'Gunner Squad', icon: '🪖', costs: [{ m: 150, s: 10 }, { m: 260, s: 20 }], req: ['gate3'], hint: '+2 AI soldiers that follow you' },
  { id: 'door', kind: 'door', zone: 2, x: 170, z: 0, name: 'Blast Door to Zone 4', icon: '🚪', costs: [{ m: 500, s: 30 }], req: ['flame1'], hint: 'Opens the Bio-Lab Ruins' },
  // ---- Zone 4: Bio-Lab Ruins ---------------------------------------------------------------------------------------
  { id: 'evolve', kind: 'evolve', zone: 3, x: 210, z: -12, name: 'Bow Evolution', icon: '🧬', costs: [{ m: 250, s: 20 }, { m: 600, s: 50 }, { m: 1300, s: 90, e: 20 }], names: ['Evolve: Multishot Bow', 'Evolve: Rapid Longbow', 'Evolve: Enchanted Bow'], req: ['door'], hint: 'A whole new bow' },
  { id: 'tesla1', kind: 'tesla', zone: 3, x: 222, z: -16, name: 'Tesla Coil', icon: '⚡', costs: [{ m: 400, s: 30, e: 20 }], req: ['door'], hint: 'Chain lightning' },
  { id: 'tesla2', kind: 'tesla', zone: 3, x: 222, z: 16, name: 'Tesla Coil', icon: '⚡', costs: [{ m: 500, s: 40, e: 25 }], req: ['tesla1'], hint: 'Chain lightning' },
  { id: 'tesla3', kind: 'tesla', zone: 3, x: 242, z: -15, name: 'Tesla Coil', icon: '⚡', costs: [{ m: 600, s: 50, e: 30 }], req: ['tesla2'], hint: 'Chain lightning' },
  { id: 'laser1', kind: 'laser', zone: 3, x: 234, z: -9, name: 'Laser Wall', icon: '🔴', costs: [{ m: 350, s: 40, e: 18 }], req: ['tesla1'], hint: 'Slices anything crossing it' },
  { id: 'laser2', kind: 'laser', zone: 3, x: 234, z: 9, name: 'Laser Wall', icon: '🔴', costs: [{ m: 450, s: 50, e: 22 }], req: ['laser1'], hint: 'Slices anything crossing it' },
  { id: 'teleporter', kind: 'teleporter', zone: 3, x: 249, z: 0, name: 'Teleporter to Zone 5', icon: '🌀', costs: [{ m: 1500, s: 100 }], req: ['tesla1'], hint: 'Opens the Necropolis' },
  // ---- Zone 5: The Necropolis Citadel ------------------------------------------------------------------------------
  { id: 'gen1', kind: 'gen', zone: 4, x: 294, z: -14, name: 'Ion Generator 1/4', icon: '🔋', costs: [{ m: 800, s: 50, e: 30 }], req: ['teleporter'], hint: 'Powers the Ion Cannon' },
  { id: 'gen2', kind: 'gen', zone: 4, x: 294, z: 14, name: 'Ion Generator 2/4', icon: '🔋', costs: [{ m: 1000, s: 60, e: 40 }], req: ['gen1'], hint: 'Powers the Ion Cannon' },
  { id: 'gen3', kind: 'gen', zone: 4, x: 314, z: -14, name: 'Ion Generator 3/4', icon: '🔋', costs: [{ m: 1200, s: 70, e: 50 }], req: ['gen2'], hint: 'Powers the Ion Cannon' },
  { id: 'gen4', kind: 'gen', zone: 4, x: 314, z: 14, name: 'Ion Generator 4/4', icon: '🔋', costs: [{ m: 1400, s: 80, e: 60 }], req: ['gen3'], hint: 'Powers the Ion Cannon' },
  { id: 'ion', kind: 'ion', zone: 4, x: 304, z: 0, name: 'Orbital Ion Cannon', icon: '☄️', costs: [{ m: 2500, s: 150, e: 100 }], req: ['gen1', 'gen2', 'gen3', 'gen4'], hint: 'Wipes out hordes from orbit' },
  { id: 'endless', kind: 'endless', action: true, zone: 4, x: 320, z: 0, name: 'Endless Survival', icon: '♾️', costs: [], req: ['ion'], hint: 'Stand here to start / end a run' },
];
export const padDef = id => PADS.find(p => p.id === id);
export const PAD_HALF = 2.2;            // pad is a 4.4 x 4.4 square

/** Normalised cost of level `lvl` (0-based): { m, s, e } */
export function needOf(def, lvl) {
  const c = def.costs[Math.min(lvl, def.costs.length - 1)];
  if (c === undefined) return { m: 0, s: 0, e: 0 };
  if (typeof c === 'number') return { m: c, s: 0, e: 0 };
  return { m: c.m || 0, s: c.s || 0, e: c.e || 0 };
}
