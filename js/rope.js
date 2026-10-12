// 绕线猫 v2 — verlet yarn rope. One Rope per stroke. Particle 0 is pinned at the yarn ball; the last particle
// follows the cat's mouth. Yarn is paid out at the cat end; posts/spools are circle colliders the rope wraps around.
// Ringing a bell pins the rope to that post (so it visibly stays wrapped). The sim is for feel only:
// route validation lives in game.js and never depends on rope state.
class Rope {
  constructor(x, y, seg, budget) {
    this.seg = seg; this.budget = budget;
    this.p = [this._pt(x, y, true), this._pt(x, y, false)];
    this.pins = [0];            // indices of pinned particles (stack; 0 = yarn ball)
    this.pinPeg = [null];       // peg each pin is wrapped around
    this.attached = true; this.relaxT = 0; this.tension = 0; this.done = false; this.slip = 0;
  }
  _pt(x, y, pin) { return { x, y, px: x, py: y, pin }; }
  length() { return (this.p.length - 1) * this.seg; }
  lastPin() { return this.pins[this.pins.length - 1]; }
  activeLength() { return (this.p.length - 1 - this.lastPin()) * this.seg; }
  step(dt, ex, ey, grid, opt = {}) {
    const P = this.p, n0 = P.length;
    if (this.attached) {
      const e = P[P.length - 1]; e.x = ex; e.y = ey; e.px = ex; e.py = ey; e.pin = true;
      // pay out yarn at the cat end
      for (let k = 0; k < 6; k++) {
        const n = P.length, a = P[n - 2], b = P[n - 1];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d <= this.seg * 1.05 || this.length() >= this.budget) break;
        const j = (Math.random() - 0.5) * this.seg * 0.35;
        const nx = a.x + dx / d * this.seg - dy / d * j, ny = a.y + dy / d * this.seg + dx / d * j;
        P.splice(n - 1, 0, this._pt(nx, ny, false));
      }
      // auto-reel excess slack in the free section (keeps it from tangling / emptying the ball)
      const lp = P[this.lastPin()], D = Math.hypot(ex - lp.x, ey - lp.y), La = this.activeLength();
      if (La > 2.6 * D + 1.0) this.relaxT = 0.6;
      if (La > 1.45 * D + 0.45 && P.length - 2 > this.lastPin()) P.splice(P.length - 2, 1);
      if (this.relaxT > 0 && P.length - 2 > this.lastPin()) P.splice(P.length - 2, 1);
    }
    this.relaxT = Math.max(0, this.relaxT - dt);
    const sub = 2, h = dt / sub, damp = Math.pow(0.02, h); // heavy ground friction
    const lp = this.lastPin();
    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < P.length; i++) {
        const q = P[i]; if (q.pin) continue;
        const vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp;
        q.px = q.x; q.py = q.y; q.x += vx; q.y += vy;
      }
      for (let it = 0; it < 10; it++) {
        const rest = this.seg;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1]; if (a.pin && b.pin) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
          if (d < rest * 0.98 && it > 2) continue; // rope: resists stretch, not compression (mostly)
          const diff = (d - rest) / d, wa = a.pin ? 0 : b.pin ? 1 : 0.5, wb = b.pin ? 0 : a.pin ? 1 : 0.5;
          a.x += dx * diff * wa; a.y += dy * diff * wa; b.x -= dx * diff * wb; b.y -= dy * diff * wb;
        }
        if (it % 2 === 1 && grid) this._collide(grid, this.relaxT > 0 ? lp : P.length);
      }
    }
    // tension = how stretched the free section is
    const e = P[P.length - 1], l = P[lp];
    const D = Math.hypot(e.x - l.x, e.y - l.y), La = this.activeLength();
    this.tension = La > 0.05 ? Math.max(0, Math.min(1, (D / La - 0.85) / 0.15)) : 0;
  }
  _collide(grid, upto) {
    const P = this.p;
    for (let i = 1; i < Math.min(upto, P.length); i++) {
      const q = P[i]; if (q.pin) continue;
      const cs = grid.near(q.x, q.y);
      for (let k = 0; k < cs.length; k++) {
        const c = cs[k], dx = q.x - c.x, dy = q.y - c.y, r = c.cr, d2 = dx * dx + dy * dy;
        if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6; q.x = c.x + dx / d * r; q.y = c.y + dy / d * r; c.touch = 1; }
      }
      // segment midpoint test (prevents slipping through between particles)
      if (i < P.length - 1) {
        const b = P[i + 1], mx = (q.x + b.x) / 2, my = (q.y + b.y) / 2;
        for (let k = 0; k < cs.length; k++) {
          const c = cs[k], dx = mx - c.x, dy = my - c.y, r = c.cr, d2 = dx * dx + dy * dy;
          if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, push = r - d, ux = dx / d * push, uy = dy / d * push;
            q.x += ux; q.y += uy; if (!b.pin) { b.x += ux; b.y += uy; } c.touch = 1; }
        }
      }
    }
  }
  // wrap & pin the rope around a post (on the side facing `tx,ty`)
  pinAt(peg, tx, ty) {
    const P = this.p, lp = this.lastPin();
    let dx = tx - peg.x, dy = ty - peg.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const px = peg.x + dx * peg.cr, py = peg.y + dy * peg.cr;
    let bi = -1, bd = 1e9;
    for (let i = lp + 1; i < P.length - 1; i++) { const e = Math.hypot(P[i].x - px, P[i].y - py); if (e < bd) { bd = e; bi = i; } }
    if (bi < 0 || bd > 0.6) { P.splice(P.length - 1, 0, this._pt(px, py, true)); bi = P.length - 2; }
    const q = P[bi]; q.x = q.px = px; q.y = q.py = py; q.pin = true;
    this.pins.push(bi); this.pinPeg.push(peg);
    return bi;
  }
  // a dog swat: the last wrap pops off its post with a bounce
  unpin() {
    if (this.pins.length <= 1) return null;
    const i = this.pins.pop(), peg = this.pinPeg.pop(); const P = this.p; P[i].pin = false;
    const lp = this.lastPin();
    for (let k = lp + 1; k < P.length - 1; k++) {
      const q = P[k], a = Math.sin(k * 1.7) * 0.5 + 0.5, f = Math.sin(Math.PI * (k - lp) / (P.length - lp)) ;
      q.px = q.x - (Math.cos(k) * 0.05 + (q.x - peg.x) * 0.25) * f * a; q.py = q.y - (Math.sin(k) * 0.05 + (q.y - peg.y) * 0.25) * f * a;
    }
    return peg;
  }
  // finish the stroke: tie off at a post
  tie(peg, tx, ty) {
    const i = this.pinAt(peg, tx, ty);
    this.p.length = i + 1; this.attached = false; this.done = true;
  }
  snapshot(stride = 1) {
    const P = this.p, n = Math.ceil(P.length / stride) + 1, a = new Float32Array(n * 2); let k = 0;
    for (let i = 0; i < P.length; i += stride) { a[k++] = P[i].x; a[k++] = P[i].y; }
    const l = P[P.length - 1]; a[k++] = l.x; a[k++] = l.y;
    return k === a.length ? a : a.slice(0, k);
  }
}
// uniform grid of circle colliders
class ColGrid {
  constructor(items, cell = 0.5) { this.cell = cell; this.m = new Map(); this.empty = [];
    for (const c of items) { const r = c.cr; for (let gx = Math.floor((c.x - r) / cell); gx <= Math.floor((c.x + r) / cell); gx++) for (let gy = Math.floor((c.y - r) / cell); gy <= Math.floor((c.y + r) / cell); gy++) { const k = gx * 7919 + gy; if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(c); } } }
  near(x, y) { return this.m.get(Math.floor(x / this.cell) * 7919 + Math.floor(y / this.cell)) || this.empty; }
}
