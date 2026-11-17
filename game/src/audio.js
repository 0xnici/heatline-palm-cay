// Synthesized WebAudio sound: no files, no network. One small synth voice per
// effect (engine hum, siren, gunshot, punch, pickup, jingles) plus a lazy
// two-bar music loop. Everything is created on first user gesture; M mutes.
export function createAudio() {
  let ctx = null; let master = null; let muted = false;
  let engineOsc = null; let engineGain = null; let sirenOsc = null; let sirenGain = null;
  let musicTimer = 0; let musicStep = 0;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    } catch { return false; }
    return true;
  }
  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq = 1200) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  const NOTES = [262, 330, 392, 330, 294, 349, 440, 349];
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
    shot() { noise(0.12, 0.5, 900); tone(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.4, 300); tone(90, 0.09, 'sine', 0.4, 45); },
    hit() { tone(120, 0.15, 'sawtooth', 0.3, 60); },
    crash() { noise(0.3, 0.55, 500); tone(70, 0.25, 'square', 0.3, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.3); tone(990, 0.14, 'sine', 0.3, 0, 0.08); },
    cash() { tone(880, 0.07, 'triangle', 0.3); tone(1174, 0.1, 'triangle', 0.3, 0, 0.06); tone(1568, 0.16, 'triangle', 0.3, 0, 0.12); },
    door() { tone(220, 0.08, 'square', 0.2, 160); },
    sirenOn() {
      if (!ensure() || sirenOsc) return;
      sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle'; sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    },
    engine(speedRatio, dt) {
      if (!ctx) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth'; engineGain.gain.value = 0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master); engineOsc.start();
      }
      const target = speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0;
      engineOsc.frequency.value = 55 + speedRatio * 130;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      void dt;
    },
    siren(active, t) {
      if (!ctx || !sirenOsc) { if (active) this.sirenOn(); return; }
      sirenOsc.frequency.value = 700 + Math.sin(t * 5.2) * 220;
      sirenGain.gain.setTargetAtTime(active && !muted ? 0.035 : 0, ctx.currentTime, 0.1);
    },
    jingle(win) {
      const seq = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      seq.forEach((n, i) => tone(n, 0.22, 'triangle', 0.32, 0, i * 0.11));
    },
    music(dt, playing) {
      if (!ctx || muted || !playing) return;
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 0.24;
        const n = NOTES[musicStep % NOTES.length]; musicStep += 1;
        tone(n / 2, 0.3, 'triangle', 0.10);
        if (musicStep % 2 === 0) tone(n, 0.2, 'sine', 0.05);
      }
    },
  };
}
