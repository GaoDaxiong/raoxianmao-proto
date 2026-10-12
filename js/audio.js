// 绕线猫 v2 — synthesized sound kit (WebAudio, no samples). Starts after first user gesture.
const AU = {
  ctx: null, master: null, bus: null, wet: null, tens: null, muted: false, musicOn: false,
  _lastCreak: 0, _lastClunk: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = (this.ctx = new C());
    this.muted = localStorage.getItem("rxm_mute") === "1";
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(comp);
    this.bus = ctx.createGain(); this.bus.connect(this.master);
    // reverb send (generated impulse)
    const conv = ctx.createConvolver(), len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    conv.buffer = ir; this.wet = ctx.createGain(); this.wet.gain.value = 0.32; this.wet.connect(conv); conv.connect(this.master);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); let b = 0;
    for (let i = 0; i < nd.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = b * 3.5; }
    this.brown = nb;
    const wb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wb;
    // taut-string tension hum
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 90; f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 3; g.gain.value = 0;
    lfo.frequency.value = 9; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency); lfo.start();
    o.connect(f); f.connect(g); g.connect(this.bus); o.start();
    this.tens = { o, g };
    this._wind(); this._music();
  },
  setMuted(m) {
    this.muted = m; localStorage.setItem("rxm_mute", m ? "1" : "0");
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  },
  _out(pan, wet = 0) {
    const ctx = this.ctx; let node = this.bus;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.bus); node = p; }
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; s.connect(this.wet); const sp = ctx.createGain(); sp.connect(node); sp.connect(s); return sp; }
    return node;
  },
  tone(freq, dur, { type = "sine", vol = 0.2, pan = 0, attack = 0.005, when = 0, slide = 0, wet = 0, detune = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._out(pan, wet)); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, { freq = 1000, q = 1, vol = 0.1, when = 0, type = "bandpass", slide = 0, attack = 0.005, brown = false, pan = 0, wet = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = brown ? this.brown : this.white; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this._out(pan, wet)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  // Bell: inharmonic partials (hum, prime, tierce, quint, nominal...) with slight beating pairs.
  bell(base, vol = 0.18, pan = 0, when = 0, long = 1, wet = 0.5) {
    const P = [[0.5, 0.35, 2.2], [1, 1, 1.6], [1.19, 0.45, 1.1], [1.5, 0.3, 0.9], [2.0, 0.55, 0.8], [2.51, 0.25, 0.55], [3.01, 0.18, 0.4], [4.07, 0.1, 0.28]];
    P.forEach(([m, v, d]) => {
      if (base * m > 15000) return;
      this.tone(base * m, d * long, { vol: vol * v * 0.6, pan, when, wet, attack: 0.002 });
      this.tone(base * m, d * long * 0.9, { vol: vol * v * 0.35, pan, when, wet, attack: 0.002, detune: 4 + m * 2 });
    });
    this.noise(0.04, { freq: base * 3, q: 2, vol: vol * 0.25, when, pan });
  },
  ding(pan = 0) { this.bell(1568, 0.07, pan, 0, 0.8); },
  softDing(pan = 0) { this.bell(1760, 0.035, pan, 0, 0.6); },
  ring(n = 0) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const semi = scale[Math.min(n, scale.length - 1)], f = 784 * Math.pow(2, semi / 12);
    this.bell(f, 0.2, 0, 0, 1.4, 0.7);
    this.bell(f * 2, 0.05, 0, 0.06, 0.8, 0.8);
  },
  clunk(pan = 0) {
    const n = performance.now(); if (n - this._lastClunk < 250) return; this._lastClunk = n;
    this.tone(150, 0.16, { type: "triangle", vol: 0.12, slide: 0.55, pan });
    this.tone(410, 0.07, { type: "square", vol: 0.018, pan });
    this.noise(0.09, { freq: 700, q: 4, vol: 0.06, pan });
  },
  creak(pan = 0, amt = 1) {
    const n = performance.now(); if (n - this._lastCreak < 420) return; this._lastCreak = n;
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 70 + Math.random() * 25; l.frequency.value = 26 + Math.random() * 10; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency);
    f.type = "bandpass"; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1500, t + 0.25); f.Q.value = 9;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * amt, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(f); f.connect(g); g.connect(this._out(pan)); o.start(t); l.start(t); o.stop(t + 0.35); l.stop(t + 0.35);
  },
  pop() { this.tone(420, 0.14, { vol: 0.14, slide: 2.4 }); this.noise(0.05, { freq: 2500, q: 1, vol: 0.04 }); },
  boing() { this.tone(300, 0.35, { vol: 0.1, slide: 1.9, type: "triangle" }); this.tone(600, 0.25, { vol: 0.04, slide: 0.6, when: 0.05 }); },
  knot() { this.tone(330, 0.1, { type: "triangle", vol: 0.16 }); this.tone(495, 0.14, { type: "triangle", vol: 0.13, when: 0.08 }); this.noise(0.06, { freq: 1800, q: 2, vol: 0.05, when: 0.16 }); this.tone(880, 0.12, { vol: 0.08, when: 0.17, slide: 1.5 }); },
  swat() { this.noise(0.22, { freq: 600, q: 0.8, vol: 0.12, slide: 3 }); this.tone(220, 0.12, { type: "triangle", vol: 0.1, slide: 0.6, when: 0.12 }); },
  grumble() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + 0.2;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(85, t + 0.7);
    l.frequency.value = 18; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency);
    f.type = "lowpass"; f.frequency.value = 420; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(f); f.connect(g); g.connect(this.bus); o.start(t); l.start(t); o.stop(t + 0.8); l.stop(t + 0.8);
  },
  woof() { this.tone(300, 0.1, { type: "sawtooth", vol: 0.05, slide: 0.65 }); },
  step() { this.noise(0.05, { freq: 900 + Math.random() * 400, q: 1.5, vol: 0.012 }); },
  clear() { [1047, 1319, 1568, 2093].forEach((f, i) => this.bell(f, 0.12, 0, i * 0.1, 1.1)); },
  snap() { this.tone(110, 0.5, { type: "triangle", vol: 0.28, slide: 3.5 }); this.tone(660, 0.35, { vol: 0.08, when: 0.05, slide: 0.7 }); this.noise(0.3, { freq: 3000, q: 0.7, vol: 0.06, slide: 0.3 }); },
  rewind(dur) { if (!this.ctx) return; for (let i = 0; i < dur * 14; i++) this.tone(900 - (i % 7) * 70, 0.05, { type: "square", vol: 0.018, when: i / 14 }); this.noise(dur, { freq: 2000, q: 0.5, vol: 0.03, slide: 0.4, attack: 0.1 }); },
  whoosh() { this.noise(1.2, { freq: 300, q: 0.8, vol: 0.1, slide: 6, attack: 0.5 }); this.tone(200, 1.0, { vol: 0.05, slide: 4, attack: 0.4 }); },
  sink() { this.noise(0.6, { freq: 200, q: 0.7, vol: 0.08, brown: true, type: "lowpass" }); },
  reveal() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(f, 0.12, 0, i * 0.16, 1.5, 0.8)); },
  setTension(t) {
    if (!this.tens) return;
    const now = this.ctx.currentTime;
    this.tens.g.gain.setTargetAtTime(t * 0.06, now, 0.05);
    this.tens.o.frequency.setTargetAtTime(80 + 90 * t, now, 0.05);
  },
  // soft wind ambience: brown noise through a slowly breathing band-pass
  _wind() {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 450; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.07; lg.gain.value = 0.035; l.connect(lg); lg.connect(g.gain);
    const l2 = ctx.createOscillator(), lg2 = ctx.createGain(); l2.frequency.value = 0.11; lg2.gain.value = 250; l2.connect(lg2); lg2.connect(f.frequency);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(); l.start(); l2.start();
    this.windG = g;
  },
  gust() { this.noise(2.2, { freq: 380, q: 0.6, vol: 0.05, slide: 2.2, attack: 0.8, brown: true }); },
  // gentle pad + plucked pentatonic melody, scheduled with lookahead
  _music() {
    const ctx = this.ctx; this.musicG = ctx.createGain(); this.musicG.gain.value = 0.9; this.musicG.connect(this.bus);
    const mw = ctx.createGain(); mw.gain.value = 0.6; this.musicG.connect(mw); mw.connect(this.wet);
    const chords = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]];
    const pent = [72, 74, 76, 79, 81, 84, 86, 88];
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const BAR = 4.0; let next = ctx.currentTime + 0.3, bar = 0;
    const pad = (notes, t) => notes.forEach((m, i) => {
      [0, 7].forEach(dt => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = i === 0 ? "sine" : "triangle"; o.frequency.value = hz(m); o.detune.value = dt - 3;
        f.type = "lowpass"; f.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i === 0 ? 0.03 : 0.013, t + 1.4); g.gain.setValueAtTime(i === 0 ? 0.03 : 0.013, t + BAR - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + BAR + 0.8);
        o.connect(f); f.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + BAR + 0.9);
      });
    });
    const pluck = (m, t, v) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "triangle"; o2.type = "sine"; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2;
      f.type = "lowpass"; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicG); o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
    };
    let last = 3;
    const tick = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 0.6) {
        const ch = chords[bar % chords.length]; pad(ch, next);
        for (let b = 0; b < 8; b++) {
          if (Math.random() < (b % 2 ? 0.22 : 0.45)) {
            last = Math.max(0, Math.min(pent.length - 1, last + ((Math.random() * 5) | 0) - 2));
            pluck(pent[last], next + b * BAR / 8 + (Math.random() - 0.5) * 0.02, 0.022 + Math.random() * 0.012);
          }
        }
        next += BAR; bar++;
      }
    };
    tick(); this._mt = setInterval(tick, 200);
  },
  musicLevel(v) { if (this.musicG) this.musicG.gain.setTargetAtTime(v, this.ctx.currentTime, 0.5); },
};
function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
