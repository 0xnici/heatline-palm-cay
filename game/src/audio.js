// audio.js — every sound in Palm Cay is synthesized with WebAudio:
// engine hum that follows your speed, the two-tone siren, gunshots,
// pickups, gulls and a soft coastal pad underneath it all. No files.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;
let padStarted = false;

export function audioReady() { return !!ctx; }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// Must be called from a user gesture at least once.
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  startPad();
}

function env(gain, t0, a, peak, d) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, type, a, d, peak, when = 0, slideTo = null) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + a + d);
  env(g, t0, a, peak, d);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}

function noise(dur, peak, filterFreq, when = 0, type = 'lowpass') {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  env(g, t0, 0.005, peak, dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

function startPad() {
  if (!ctx || padStarted) return;
  padStarted = true;
  // A slow warm chord, barely there: two detuned triangles through a
  // lowpass, breathing on an LFO.
  const g = ctx.createGain(); g.gain.value = 0.035;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  for (const freq of [130.81, 196.0, 261.63]) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = freq;
    o.detune.value = Math.random() * 8 - 4;
    o.connect(f); o.start();
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.014;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  f.connect(g); g.connect(master); lfo.start();
}

export function sfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shot': noise(0.11, 0.5, 2600, 0, 'highpass'); tone(150, 'square', 0.004, 0.07, 0.22, 0, 60); break;
    case 'shotFar': noise(0.09, 0.16, 1200, 0, 'highpass'); break;
    case 'melee': noise(0.08, 0.3, 500); break;
    case 'hit': tone(220, 'sine', 0.005, 0.09, 0.25, 0, 110); break;
    case 'crash': noise(0.22, 0.42, 700); tone(90, 'sine', 0.01, 0.18, 0.3, 0, 45); break;
    case 'pickup': tone(880, 'sine', 0.01, 0.09, 0.2); tone(1318, 'sine', 0.01, 0.14, 0.18, 0.07); break;
    case 'cash': tone(1046, 'triangle', 0.01, 0.08, 0.2); tone(1568, 'triangle', 0.01, 0.16, 0.2, 0.06); break;
    case 'door': tone(180, 'sine', 0.01, 0.1, 0.2, 0, 120); break;
    case 'busted': tone(392, 'square', 0.02, 0.16, 0.16); tone(311, 'square', 0.02, 0.3, 0.16, 0.15); break;
    case 'wasted': tone(220, 'sawtooth', 0.03, 0.5, 0.14, 0, 55); break;
    case 'job': tone(659, 'triangle', 0.01, 0.1, 0.2); tone(784, 'triangle', 0.01, 0.1, 0.2, 0.09); tone(1046, 'triangle', 0.01, 0.22, 0.22, 0.18); break;
    case 'gull': tone(1250 + Math.random() * 250, 'sine', 0.03, 0.16, 0.045, 0, 900); break;
    case 'step': noise(0.03, 0.05, 900); break;
  }
}

// Continuous engine voice while driving; speedRatio 0..1.
export function engineSound(on, speedRatio, dt) {
  if (!ctx) return;
  if (on && !engineNodes) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0.0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(); o2.start();
    engineNodes = { o, o2, f, g };
  }
  if (!engineNodes) return;
  const t = ctx.currentTime;
  if (on) {
    const fr = 55 + speedRatio * 165;
    engineNodes.o.frequency.setTargetAtTime(fr, t, 0.06);
    engineNodes.o2.frequency.setTargetAtTime(fr * 0.5 + 2, t, 0.06);
    engineNodes.f.frequency.setTargetAtTime(280 + speedRatio * 900, t, 0.1);
    engineNodes.g.gain.setTargetAtTime(muted ? 0 : 0.055 + speedRatio * 0.05, t, 0.09);
  } else {
    engineNodes.g.gain.setTargetAtTime(0, t, 0.08);
    if (engineNodes.g.gain.value < 0.002) {
      try { engineNodes.o.stop(); engineNodes.o2.stop(); } catch { /* already stopped */ }
      engineNodes = null;
    }
  }
}

// Two-tone siren while any police car is near and active.
export function sirenSound(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0.0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.85;
    const lfoG = ctx.createGain(); lfoG.gain.value = 130;
    o.frequency.value = 830;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(g); g.connect(master);
    o.start(); lfo.start();
    sirenNodes = { o, g, lfo };
  }
  if (!sirenNodes) return;
  const t = ctx.currentTime;
  if (on) sirenNodes.g.gain.setTargetAtTime(muted ? 0 : 0.028, t, 0.2);
  else {
    sirenNodes.g.gain.setTargetAtTime(0, t, 0.15);
    if (sirenNodes.g.gain.value < 0.002) {
      try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
      sirenNodes = null;
    }
  }
}
