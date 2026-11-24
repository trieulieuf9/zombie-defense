// Single source of truth for everything that gets saved, plus the derived player stats.
export const SAVE_KEY = 'zombie-yard-save-v1';

function defaults() {
  return {
    v: 1,
    carry: { meat: 0, scrap: 0 },
    packLvl: 0, weaponLvl: 0, bootsLvl: 0, vestLvl: 0,
    pads: {},                       // id -> { lvl, prog (meat), sp (scrap), ep (energy) }
    zoneUnlocked: [true, false, false, false, false],
    bots: 0, energy: 0, weaponTier: 0, gunners: 0,
    endless: { best: 0, bestTime: 0, runs: 0 },
    waveNum: 0, waveTimer: 90,
    kills: 0, totalMeat: 0, playTime: 0, deaths: 0, wavesCleared: 0,
    coreHp: -1,
    settings: { sound: true, quality: 'high', wake: true },
  };
}

export const state = defaults();

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || s.v !== 1) return false;
    const d = defaults();
    const num = (v, dv, lo = 0, hi = 1e9) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dv);
    state.carry = { meat: Math.floor(num(s.carry && s.carry.meat, 0)), scrap: Math.floor(num(s.carry && s.carry.scrap, 0)) };
    state.packLvl = Math.floor(num(s.packLvl, 0, 0, 50));
    state.weaponLvl = Math.floor(num(s.weaponLvl, 0, 0, 50));
    state.bootsLvl = Math.floor(num(s.bootsLvl, 0, 0, 50)); state.vestLvl = Math.floor(num(s.vestLvl, 0, 0, 20));
    state.pads = {};
    if (s.pads && typeof s.pads === 'object') for (const k of Object.keys(s.pads)) {
      const p = s.pads[k];
      if (p && typeof p === 'object') state.pads[k] = { lvl: Math.floor(num(p.lvl, 0, 0, 99)), prog: Math.floor(num(p.prog, 0, 0, 1e6)), sp: Math.floor(num(p.sp, 0, 0, 1e6)), ep: Math.floor(num(p.ep, 0, 0, 1e6)) };
    }
    state.zoneUnlocked = d.zoneUnlocked.map((v, i) => (i === 0 ? true : !!(s.zoneUnlocked && s.zoneUnlocked[i])));
    state.bots = Math.floor(num(s.bots, 0, 0, 12));
    state.energy = Math.floor(num(s.energy, 0, 0, 999)); state.weaponTier = Math.floor(num(s.weaponTier, 0, 0, 3)); state.gunners = Math.floor(num(s.gunners, 0, 0, 8));
    const en = s.endless && typeof s.endless === 'object' ? s.endless : {};
    state.endless = { best: Math.floor(num(en.best, 0)), bestTime: Math.floor(num(en.bestTime, 0)), runs: Math.floor(num(en.runs, 0)) };
    state.waveNum = Math.floor(num(s.waveNum, 0, 0, 9999));
    state.waveTimer = num(s.waveTimer, 90, 0, 600);
    state.kills = Math.floor(num(s.kills, 0)); state.totalMeat = Math.floor(num(s.totalMeat, 0));
    state.playTime = num(s.playTime, 0); state.deaths = Math.floor(num(s.deaths, 0)); state.wavesCleared = Math.floor(num(s.wavesCleared, 0));
    state.coreHp = num(s.coreHp, -1, -1, 1e6);
    state.settings = Object.assign(d.settings, s.settings && typeof s.settings === 'object' ? s.settings : {});
    // never carry more than the backpack holds
    const cap = capacity();
    state.carry.meat = Math.min(state.carry.meat, cap);
    state.carry.scrap = Math.min(state.carry.scrap, Math.max(0, cap - state.carry.meat));
    return true;
  } catch (e) { return false; }
}

let lastSave = '';
export function save() {
  try {
    const json = JSON.stringify(state);
    if (json === lastSave) return true;
    localStorage.setItem(SAVE_KEY, json); lastSave = json; return true;
  } catch (e) { return false; }
}
export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  lastSave = '';
}

// ---- derived stats -------------------------------------------------------------------------------------------------
export const carried = () => state.carry.meat + state.carry.scrap;
export const capacity = () => 10 + 5 * state.packLvl;
export const speed = () => 7.2 * (1 + 0.12 * state.bootsLvl);
export const TIER_NAMES = ['Wooden Bow', 'Multishot Bow', 'Rapid Longbow', 'Enchanted Bow'];
const TIERS = [
  { dmg: 5, rate: 2.2, rg: 0.4, range: 6.5, speed: 30, pellets: 1, spread: 0.04, ap: 0, pierce: 0, kind: 'arrow' },
  { dmg: 4, rate: 1.3, rg: 0.12, range: 6.5, speed: 28, pellets: 5, spread: 0.6, ap: 0.1, pierce: 0, kind: 'multi' },
  { dmg: 6, rate: 5.0, rg: 0.5, range: 9.5, speed: 42, pellets: 1, spread: 0.06, ap: 0.35, pierce: 0, kind: 'rapid' },
  { dmg: 40, rate: 1.4, rg: 0.1, range: 10.5, speed: 26, pellets: 1, spread: 0, ap: 1, pierce: 4, kind: 'magic' },
];
export function weapon() {
  const l = state.weaponLvl, t = TIERS[Math.min(state.weaponTier, 3)];
  return {
    name: TIER_NAMES[Math.min(state.weaponTier, 3)], tier: state.weaponTier, lvl: l + 1,
    dmg: Math.round(t.dmg * (1 + 0.4 * l)),
    rate: t.rate + t.rg * l,        // shots / second
    range: t.range + 0.35 * Math.min(l, 6), speed: t.speed, pellets: t.pellets, spread: t.spread, ap: t.ap, pierce: t.pierce, kind: t.kind,
  };
}
export const padLvl = id => (state.pads[id] ? state.pads[id].lvl : 0);
export const padProg = id => (state.pads[id] ? state.pads[id].prog : 0);
export const padSp = id => (state.pads[id] ? state.pads[id].sp || 0 : 0);
export const padEp = id => (state.pads[id] ? state.pads[id].ep || 0 : 0);
