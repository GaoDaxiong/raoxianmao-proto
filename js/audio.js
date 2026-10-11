// Tiny WebAudio sound kit, all synthesized. Starts after first user gesture.
const AU = {
  ctx: null, master: null, tens: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    // continuous tension hum
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = 80; f.type = "lowpass"; f.frequency.value = 380; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
    this.tens = { o, g };
  },
  _out(pan) {
    const ctx = this.ctx;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.master); return p; }
    return this.master;
  },
  tone(freq, dur, { type = "sine", vol = 0.2, pan = 0, attack = 0.005, when = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._out(pan)); o.start(t); o.stop(t + dur + 0.05);
  },
  bell(base, vol = 0.18, pan = 0, when = 0, long = 1) {
    [[1, 1], [2.76, 0.4], [5.4, 0.18]].forEach(([m, v]) => this.tone(base * m, (1.4 / m + 0.2) * long, { vol: vol * v, pan, when }));
  },
  ding(pan = 0) { this.bell(1568, 0.16, pan); },
  softDing(pan = 0) { this.bell(1568, 0.05, pan, 0, 0.7); },
  ring(n = 0) { const notes = [1047, 1175, 1319, 1568, 1760, 2093]; this.bell(notes[n % notes.length], 0.2, 0, 0, 1.6); },
  clack() { this.tone(320, 0.08, { type: "square", vol: 0.04 }); this.tone(190, 0.06, { type: "triangle", vol: 0.05, when: 0.02 }); },
  pop() { this.tone(500, 0.12, { vol: 0.15, slide: 2.2 }); },
  knot() { this.tone(260, 0.09, { type: "triangle", vol: 0.2 }); this.tone(390, 0.12, { type: "triangle", vol: 0.15, when: 0.08 }); },
  swat() { this.tone(180, 0.18, { type: "square", vol: 0.08, slide: 0.5 }); this.tone(140, 0.22, { type: "sawtooth", vol: 0.06, when: 0.1, slide: 0.6 }); },
  woof() { this.tone(260, 0.12, { type: "sawtooth", vol: 0.07, slide: 0.6 }); },
  clear() { [1047, 1319, 1568, 2093].forEach((f, i) => this.bell(f, 0.14, 0, i * 0.09, 1.2)); },
  snap() { this.tone(110, 0.5, { type: "triangle", vol: 0.3, slide: 3.5 }); this.tone(660, 0.35, { vol: 0.08, when: 0.05, slide: 0.7 }); },
  rewind(dur) { if (!this.ctx) return; for (let i = 0; i < dur * 14; i++) this.tone(900 - (i % 7) * 70, 0.05, { type: "square", vol: 0.025, when: i / 14 }); },
  whoosh() { this.tone(200, 1.0, { type: "sine", vol: 0.08, slide: 4, attack: 0.4 }); },
  reveal() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(f, 0.13, 0, i * 0.16, 1.5)); },
  setTension(t) {
    if (!this.tens) return;
    const now = this.ctx.currentTime;
    this.tens.g.gain.setTargetAtTime(t * 0.07, now, 0.05);
    this.tens.o.frequency.setTargetAtTime(70 + 70 * t, now, 0.05);
  },
};
