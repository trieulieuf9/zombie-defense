// Procedural Web Audio sound effects (no audio files). Starts on the first touch (iOS rule).
import { state } from './state.js';

let ctx = null, master = null, noiseBuf = null;
const forcedMute = /[?&]mute=1/.test(location.search);
const last = {};   // per-sound rate limit

export function ensure() {
  if (forcedMute) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }   // iOS may report 'interrupted'
  } catch (e) { return null; }
  return ctx;
}
const on = () => !forcedMute && ctx && state.settings.sound && ctx.state === 'running';
const gate = (k, ms) => { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, hp = 800, delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}

let pickCombo = 0, pickT = 0;
export const sfx = {
  shoot() { if (!on() || !gate('shoot', 60)) return; tone('square', 720, 240, 0.07, 0.10); noise(0.04, 0.08, 2500); },
  turret() { if (!on() || !gate('turret', 70)) return; tone('square', 420, 150, 0.06, 0.06); },
  sniper() { if (!on() || !gate('sniper', 120)) return; tone('sawtooth', 300, 50, 0.22, 0.14); noise(0.12, 0.12, 400); },
  spit() { if (!on() || !gate('spit', 150)) return; tone('sine', 300, 700, 0.14, 0.12); },
  hit() { if (!on() || !gate('hit', 45)) return; noise(0.05, 0.12, 1200); },
  kill() { if (!on() || !gate('kill', 50)) return; tone('sine', 380, 900, 0.1, 0.16); tone('triangle', 160, 70, 0.14, 0.12); },
  pickup() {
    if (!on() || !gate('pickup', 35)) return;
    const n = performance.now(); pickCombo = n - pickT < 450 ? Math.min(pickCombo + 1, 14) : 0; pickT = n;
    tone('sine', 520 * Math.pow(1.06, pickCombo), 700 * Math.pow(1.06, pickCombo), 0.07, 0.13);
  },
  deposit() { if (!on() || !gate('deposit', 40)) return; tone('triangle', 300, 380, 0.06, 0.12); },
  build() { if (!on()) return; [0, 4, 7, 12].forEach((s, i) => tone('triangle', 440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), 0.22, 0.2, i * 0.07)); },
  upgrade() { if (!on()) return; [0, 7, 12, 16].forEach((s, i) => tone('square', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 0.16, 0.1, i * 0.06)); },
  unlock() { if (!on()) return; [0, 4, 7, 12, 16, 19].forEach((s, i) => tone('triangle', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 0.3, 0.2, i * 0.09)); },
  horn() { if (!on()) return; tone('sawtooth', 110, 98, 1.0, 0.22); tone('sawtooth', 165, 147, 1.0, 0.12); },
  win() { if (!on()) return; [0, 4, 7, 12].forEach((s, i) => tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.25, 0.2, i * 0.1)); },
  hurt() { if (!on() || !gate('hurt', 150)) return; tone('square', 170, 55, 0.2, 0.2); noise(0.08, 0.2, 300); },
  coreHit() { if (!on() || !gate('core', 250)) return; tone('sawtooth', 90, 50, 0.2, 0.18); },
  die() { if (!on()) return; tone('sawtooth', 300, 40, 0.7, 0.25); },
  deny() { if (!on() || !gate('deny', 200)) return; tone('square', 200, 150, 0.1, 0.12); },
  tap() { if (!on()) return; tone('triangle', 500, 650, 0.06, 0.15); },
  bow() { if (!on() || !gate('bow', 60)) return; tone('triangle', 330, 150, 0.09, 0.14); noise(0.07, 0.07, 2600); },
  bowMulti() { if (!on() || !gate('bowm', 100)) return; tone('triangle', 280, 110, 0.12, 0.18); tone('triangle', 360, 140, 0.1, 0.1, 0.02); noise(0.1, 0.1, 2200); },
  bowRapid() { if (!on() || !gate('bowr', 45)) return; tone('triangle', 520, 220, 0.06, 0.1); noise(0.05, 0.06, 3200); },
  flame() { if (!on() || !gate('flame', 110)) return; noise(0.14, 0.09, 500); },
  zap() { if (!on() || !gate('zap', 90)) return; tone('sawtooth', 900, 120, 0.16, 0.12); noise(0.08, 0.1, 3000); },
  laser() { if (!on() || !gate('laser', 200)) return; tone('square', 1200, 900, 0.08, 0.05); },
  ion() { if (!on()) return; tone('sawtooth', 1400, 60, 0.9, 0.22); tone('sine', 90, 35, 1.1, 0.3); noise(0.6, 0.2, 150); },
  teleport() { if (!on()) return; tone('sine', 200, 1400, 0.5, 0.2); tone('triangle', 1400, 300, 0.5, 0.12, 0.25); },
  roar() { if (!on() || !gate('roar', 400)) return; tone('sawtooth', 90, 45, 0.9, 0.25); tone('square', 60, 40, 0.9, 0.12); noise(0.5, 0.1, 120); },
  slam() { if (!on() || !gate('slam', 150)) return; tone('sine', 110, 30, 0.35, 0.3); noise(0.25, 0.18, 120); },
  plasma() { if (!on() || !gate('plasma', 80)) return; tone('sawtooth', 220, 880, 0.14, 0.12); tone('sine', 900, 300, 0.2, 0.1); },
  rifle() { if (!on() || !gate('rifle', 50)) return; tone('square', 520, 160, 0.05, 0.08); noise(0.03, 0.08, 2000); },
  shotgun() { if (!on() || !gate('shotgun', 100)) return; tone('sawtooth', 200, 50, 0.16, 0.2); noise(0.14, 0.2, 400); },
  boom() { if (!on() || !gate('boom', 80)) return; tone('sine', 120, 40, 0.3, 0.25); noise(0.2, 0.15, 200); },
};
