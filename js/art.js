// 绕线猫 v2 — painterly cel-shaded rendering kit (Canvas 2D). All assets are procedural & original.
const ART = (() => {
"use strict";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function rng32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// ---------- noise ----------
function h2(ix, iy, s) { let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm(x, y, s, o = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return v / n; }
// ---------- color helpers ----------
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function ramp(stops, t) { t = clamp(t, 0, 1); for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (t - t0) / (t1 - t0 || 1); return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)]; } return stops[stops.length - 1][1]; }
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function mix(c1, c2, t) { const a = typeof c1 === "string" ? hex(c1) : c1, b = typeof c2 === "string" ? hex(c2) : c2; return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
const GRASS = [[0, hex("#2f6650")], [0.22, hex("#448652")], [0.42, hex("#68a650")], [0.6, hex("#8dbf54")], [0.78, hex("#b6d25e")], [1, hex("#dfe486")]];
const WIND = { x: Math.cos(-0.35), y: Math.sin(-0.35) };
// ---------- cached sprites ----------
function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function radialSprite(stops, size = 128) {
  const c = canvas(size, size), g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const SPR = {
  shadow: radialSprite([[0, "rgba(24,38,58,.55)"], [0.5, "rgba(24,38,58,.32)"], [1, "rgba(24,38,58,0)"]]),
  glow: radialSprite([[0, "rgba(255,226,140,1)"], [0.25, "rgba(255,210,110,.55)"], [0.6, "rgba(255,190,90,.15)"], [1, "rgba(255,190,90,0)"]]),
  glowW: radialSprite([[0, "rgba(255,255,240,1)"], [0.3, "rgba(255,250,220,.4)"], [1, "rgba(255,250,220,0)"]]),
  glowR: radialSprite([[0, "rgba(255,120,100,1)"], [0.3, "rgba(255,80,70,.45)"], [1, "rgba(255,60,60,0)"]]),
  cloud: (() => { const c = canvas(256, 256), g = c.getContext("2d"); const r = rng32(7);
    for (let i = 0; i < 7; i++) { const x = 70 + r() * 116, y = 70 + r() * 116, rr = 40 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, "rgba(30,40,90,.5)"); gr.addColorStop(1, "rgba(30,40,90,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } return c; })(),
};
function spr(ctx, s, x, y, rx, ry, a = 1) { if (a <= 0) return; ctx.globalAlpha = a; ctx.drawImage(s, x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = 1; }
function shadow(ctx, x, y, rx, ry, a = 1) { spr(ctx, SPR.shadow, x, y, rx, ry, a); }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); }
// cel-shade an already-built path: base fill, then shadow & light shapes clipped inside, soft edge
function cel(ctx, pathFn, base, light, shade, lx, ly, sx, sy, edge) {
  pathFn(); ctx.fillStyle = base; ctx.fill();
  ctx.save(); pathFn(); ctx.clip();
  if (shade) { ctx.fillStyle = shade; sx(); ctx.fill(); }
  if (light) { ctx.fillStyle = light; lx(); ctx.fill(); }
  ctx.restore();
  if (edge) { pathFn(); ctx.strokeStyle = edge; ctx.lineWidth = ly; ctx.stroke(); }
}
function celEll(ctx, x, y, rx, ry, base, light, shade, edge, ew = 0, rot = 0, lo = 0.35, so = 0.4) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ell(ctx, 0, 0, rx, ry); ctx.fillStyle = base; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, rx, ry); ctx.clip();
  if (shade) { ctx.fillStyle = shade; ctx.beginPath(); ctx.rect(-rx * 2, -ry * 2, rx * 4, ry * 4); ctx.moveTo(-rx * so * 0.45 + rx * 1.02, -ry * so * 0.6); ctx.ellipse(-rx * so * 0.45, -ry * so * 0.6, rx * 1.02, ry * 0.98, 0, 0, TAU); ctx.fill("evenodd"); }
  if (light) { ctx.fillStyle = light; ell(ctx, -rx * lo, -ry * lo, rx * 0.55, ry * 0.5); ctx.fill(); }
  ctx.restore();
  if (edge) { ell(ctx, 0, 0, rx, ry); ctx.strokeStyle = edge; ctx.lineWidth = ew; ctx.stroke(); }
  ctx.restore();
}
// crescent shade helper: fill area of ellipse (cx,cy,rx,ry) NOT covered by ellipse shifted by (ox,oy)
function crescent(ctx, cx, cy, rx, ry, ox, oy, k = 1.0) {
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.moveTo(cx + ox + rx * k, cy + oy); ctx.ellipse(cx + ox, cy + oy, rx * k, ry * k, 0, 0, TAU, true); ctx.fill();
}

// ================= TERRAIN =================
const CHUNK_PX = 512, MAX_CHUNKS = 44;
let chunkCount = 0; const allChunks = new Map(); // global LRU: key -> {tc, key}
class Terrain {
  constructor(lv) {
    this.lv = lv; const M = lv.M; this.seed = lv.seed | 0;
    this.B = { x0: M.x0 - 2.6, y0: M.y0 - 2.8, x1: M.x1 + 2.6, y1: M.y1 + 2.8 };
    const NK = (this.NK = 20), B = this.B, w = Math.ceil((B.x1 - B.x0) * NK) + 1, h = Math.ceil((B.y1 - B.y0) * NK) + 1;
    this.nw = w; this.nh = h; this.vmap = new Float32Array(w * h);
    const c = canvas(w, h), g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data, s = this.seed;
    const forest = hex("#244a3e"), teal = hex("#3e8a78"), warm = hex("#e6d877");
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = B.x0 + i / NK, y = B.y0 + j / NK;
      const n1 = fbm(x * 0.28, y * 0.28, s, 3), n2 = fbm(x * 1.1 + 9, y * 1.1, s + 5, 3), n3 = vnoise(x * 3.3, y * 3.3, s + 9);
      let v = 0.45 * n1 + 0.4 * n2 + 0.15 * n3; v = clamp((v - 0.5) * 2.3 + 0.56, 0, 1);
      v = lerp(v, Math.round(v * 6) / 6, 0.3); // slight cel banding
      // sun from top-left
      v = clamp(v + 0.06 - 0.05 * ((x - M.x0) / (M.x1 - M.x0) + (y - M.y0) / (M.y1 - M.y0)) * 0.5, 0, 1);
      // outside the yard: darker woodland floor
      const ox = Math.max(M.x0 - x, x - M.x1, 0), oy = Math.max(M.y0 - y, y - M.y1, 0), out = clamp(Math.hypot(ox, oy) / 1.2, 0, 1);
      let col = ramp(GRASS, v * (1 - out * 0.55));
      const hue = fbm(x * 0.5 + 40, y * 0.5, s + 3, 2);
      col = mix(col, teal, clamp((0.45 - hue) * 1.4, 0, 0.35));
      col = mix(col, warm, clamp((hue - 0.62) * 1.5, 0, 0.25) * v);
      col = mix(col, forest, out * 0.7);
      this.vmap[j * w + i] = v * (1 - out);
      const k = (j * w + i) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0); this.noise = c;
    this.scale = 0; this.chunks = new Map(); this.full = null; this.id = Terrain._id = (Terrain._id || 0) + 1;
  }
  v(x, y) { const i = clamp(Math.round((x - this.B.x0) * this.NK), 0, this.nw - 1), j = clamp(Math.round((y - this.B.y0) * this.NK), 0, this.nh - 1); return this.vmap[j * this.nw + i]; }
  ensureScale(s) { if (Math.abs(s - this.scale) > 1e-6) { this.dropChunks(); this.scale = s; } }
  dropChunks() { for (const k of this.chunks.keys()) { allChunks.delete(this.id + ":" + k); chunkCount--; } this.chunks.clear(); }
  chunk(i, j, make) {
    const k = i + "," + j; let c = this.chunks.get(k);
    const gk = this.id + ":" + k;
    if (c) { allChunks.delete(gk); allChunks.set(gk, { tc: this, k }); return c; }
    if (!make) return null;
    const cw = CHUNK_PX / this.scale;
    c = canvas(CHUNK_PX, CHUNK_PX); const g = c.getContext("2d");
    this.drawRegion(g, i * cw, j * cw, (i + 1) * cw, (j + 1) * cw, this.scale, 2);
    this.chunks.set(k, c); allChunks.set(gk, { tc: this, k }); chunkCount++;
    while (chunkCount > MAX_CHUNKS) { const [ok, ov] = allChunks.entries().next().value; allChunks.delete(ok); if (ov.tc.chunks.delete(ov.k)) chunkCount--; }
    return c;
  }
  // draw ground for the current view. budget = max chunks to build this frame.
  draw(ctx, cam, z, W, H, DPR, budget = 99) {
    const useFull = z < this.scale / DPR * 0.62 && this.full;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const k = z * DPR, ox = W * DPR / 2 - cam.x * k, oy = H * DPR / 2 - cam.y * k;
    ctx.fillStyle = "#244a3e"; ctx.fillRect(0, 0, W * DPR, H * DPR);
    if (useFull) {
      const f = this.full, B = this.B;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(f, ox + B.x0 * k, oy + B.y0 * k, (B.x1 - B.x0) * k, (B.y1 - B.y0) * k);
      return 0;
    }
    const cw = CHUNK_PX / this.scale;
    const vx0 = cam.x - W / 2 / z, vx1 = cam.x + W / 2 / z, vy0 = cam.y - H / 2 / z, vy1 = cam.y + H / 2 / z;
    let built = 0;
    for (let j = Math.floor(vy0 / cw); j <= Math.floor(vy1 / cw); j++) for (let i = Math.floor(vx0 / cw); i <= Math.floor(vx1 / cw); i++) {
      let c = this.chunk(i, j, false);
      if (!c && built < budget) { c = this.chunk(i, j, true); built++; }
      const x0 = Math.round(ox + i * cw * k), x1 = Math.round(ox + (i + 1) * cw * k), y0 = Math.round(oy + j * cw * k), y1 = Math.round(oy + (j + 1) * cw * k);
      if (c) ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
      else if (this.full) { const B = this.B, f = this.full, fs = f.width / (B.x1 - B.x0); ctx.drawImage(f, (i * cw - B.x0) * fs, (j * cw - B.y0) * fs, cw * fs, cw * fs, x0, y0, x1 - x0, y1 - y0); }
      else { ctx.drawImage(this.noise, (i * cw - this.B.x0) * this.NK, (j * cw - this.B.y0) * this.NK, cw * this.NK, cw * this.NK, x0, y0, x1 - x0, y1 - y0); }
    }
    return built;
  }
  prewarm(cam, z, W, H, margin = 0.6) {
    const cw = CHUNK_PX / this.scale;
    const vx0 = cam.x - W / 2 / z - margin, vx1 = cam.x + W / 2 / z + margin, vy0 = cam.y - H / 2 / z - margin, vy1 = cam.y + H / 2 / z + margin;
    for (let j = Math.floor(vy0 / cw); j <= Math.floor(vy1 / cw); j++) for (let i = Math.floor(vx0 / cw); i <= Math.floor(vx1 / cw); i++) this.chunk(i, j, true);
  }
  buildFull(maxPx = 1700) {
    if (this.full) return this.full;
    const B = this.B, s = maxPx / Math.max(B.x1 - B.x0, B.y1 - B.y0);
    const c = canvas((B.x1 - B.x0) * s, (B.y1 - B.y0) * s), g = c.getContext("2d");
    this.drawRegion(g, B.x0, B.y0, B.x1, B.y1, s, 1);
    return (this.full = c);
  }
  drawRegion(g, x0, y0, x1, y1, s, lod) {
    const B = this.B, NK = this.NK, D = this.lv.decor, seed = this.seed;
    g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    g.fillStyle = "#244a3e"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(this.noise, 0, 0, this.nw, this.nh, B.x0, B.y0, this.nw / NK, this.nh / NK);
    const m = 0.35, inR = (x, y, r) => x + r > x0 - m && x - r < x1 + m && y + r > y0 - m && y - r < y1 + m;
    // painterly dabs (cell-seeded so chunks agree on overlaps)
    const CS = 0.5;
    for (let cy = Math.floor((y0 - 0.3) / CS); cy <= Math.floor((y1 + 0.3) / CS); cy++) for (let cx = Math.floor((x0 - 0.3) / CS); cx <= Math.floor((x1 + 0.3) / CS); cx++) {
      const r = rng32(cx * 92821 ^ cy * 68917 ^ seed);
      for (let i = 0; i < (lod > 1 ? 9 : 5); i++) {
        const x = (cx + r()) * CS, y = (cy + r()) * CS, v = this.v(x, y), L = r() < 0.5 + (v - 0.5) * 0.6;
        const sz = 0.05 + r() * 0.13;
        g.fillStyle = L ? `rgba(225,240,150,${0.07 + r() * 0.08})` : `rgba(20,70,60,${0.07 + r() * 0.08})`;
        ell(g, x, y, sz * 1.9, sz * 0.55, -0.35 + (r() - 0.5) * 0.5); g.fill();
      }
    }
    // dirt path
    for (const P of D.paths) {
      if (!P.pts.some(p => inR(p.x, p.y, 0.6))) continue;
      const path = () => { g.beginPath(); g.moveTo(P.pts[0].x, P.pts[0].y); for (let i = 1; i < P.pts.length - 1; i++) { const a = P.pts[i], b = P.pts[i + 1]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } const l = P.pts[P.pts.length - 1]; g.lineTo(l.x, l.y); };
      g.lineCap = "round"; g.lineJoin = "round";
      path(); g.strokeStyle = "rgba(60,70,40,.25)"; g.lineWidth = P.w + 0.07; g.stroke();
      path(); g.strokeStyle = "#b99d6b"; g.lineWidth = P.w + 0.02; g.stroke();
      path(); g.strokeStyle = "#d9c08a"; g.lineWidth = P.w * 0.82; g.stroke();
      g.save(); g.translate(-0.015, -0.02); path(); g.strokeStyle = "rgba(246,230,180,.6)"; g.lineWidth = P.w * 0.4; g.stroke(); g.restore();
      for (const pb of P.pebbles) { if (!inR(pb.x, pb.y, 0.05)) continue; g.fillStyle = "#a08a64"; ell(g, pb.x + 0.004, pb.y + 0.004, pb.r, pb.r * 0.7); g.fill(); g.fillStyle = "#efe2bf"; ell(g, pb.x, pb.y, pb.r, pb.r * 0.7); g.fill(); }
    }
    // pond
    for (const P of D.ponds) {
      if (!inR(P.x, P.y, P.rx + 0.3)) continue;
      const blob = (k, dx = 0, dy = 0) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, w = 1 + 0.08 * Math.sin(a * 3 + P.ph) + 0.05 * Math.sin(a * 5 + P.ph * 2); const x = P.x + dx + Math.cos(a) * P.rx * k * w, y = P.y + dy + Math.sin(a) * P.ry * k * w; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
      blob(1.16, 0.02, 0.03); g.fillStyle = "rgba(40,60,40,.25)"; g.fill();
      blob(1.12); g.fillStyle = "#cdb983"; g.fill();
      blob(1.04); g.fillStyle = "#7fb29a"; g.fill();
      const gr = g.createRadialGradient(P.x - P.rx * 0.2, P.y - P.ry * 0.3, 0, P.x, P.y, P.rx);
      gr.addColorStop(0, "#3d93a6"); gr.addColorStop(0.7, "#2f7891"); gr.addColorStop(1, "#46a0a2");
      blob(0.96); g.fillStyle = gr; g.fill();
      g.save(); blob(0.96); g.clip();
      g.fillStyle = "rgba(20,50,90,.35)"; blob(0.96, 0.06, 0.08); g.fill();
      g.strokeStyle = "rgba(220,250,245,.35)"; g.lineWidth = 0.012;
      for (let i = 0; i < 6; i++) { const yy = P.y - P.ry * 0.6 + i * P.ry * 0.25; g.beginPath(); g.moveTo(P.x - P.rx * 0.5 + i * 0.03, yy); g.lineTo(P.x - P.rx * 0.2 + i * 0.05, yy); g.stroke(); }
      g.restore();
      for (const L of P.lilies) {
        g.fillStyle = "rgba(10,40,50,.3)"; ell(g, L.x + 0.01, L.y + 0.012, L.r, L.r * 0.6); g.fill();
        g.fillStyle = "#5c9c4c"; g.beginPath(); g.ellipse(L.x, L.y, L.r, L.r * 0.6, 0, L.a + 0.3, L.a + TAU - 0.3); g.lineTo(L.x, L.y); g.closePath(); g.fill();
        g.fillStyle = "#86c060"; g.beginPath(); g.ellipse(L.x - L.r * 0.15, L.y - L.r * 0.12, L.r * 0.6, L.r * 0.35, 0, L.a + 0.4, L.a + TAU - 0.4); g.lineTo(L.x - L.r * 0.15, L.y - L.r * 0.12); g.closePath(); g.fill();
        if (L.flower) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.fillStyle = k % 2 ? "#f6b9c9" : "#fde3ea"; ell(g, L.x + Math.cos(a) * 0.018, L.y - 0.01 + Math.sin(a) * 0.011, 0.016, 0.009, a); g.fill(); } g.fillStyle = "#f7d35a"; ell(g, L.x, L.y - 0.012, 0.008, 0.006); g.fill(); }
      }
    }
    // tufts base shadow (the animated blades are drawn live)
    for (const t of D.tufts) { if (!inR(t.x, t.y, 0.1)) continue; g.fillStyle = "rgba(20,50,45,.22)"; ell(g, t.x + 0.01, t.y + 0.004, 0.05 * t.s, 0.016 * t.s); g.fill(); }
    // short grass blades (static carpet)
    if (lod > 1) {
      const tiers = [[], [], []], GC = 0.25;
      for (let cy = Math.floor((y0 - 0.1) / GC); cy <= Math.floor((y1 + 0.1) / GC); cy++) for (let cx = Math.floor((x0 - 0.1) / GC); cx <= Math.floor((x1 + 0.1) / GC); cx++) {
        const r = rng32(cx * 15731 ^ cy * 789221 ^ (seed * 31));
        for (let i = 0; i < 34; i++) {
          const x = (cx + r()) * GC, y = (cy + r()) * GC; if (x < x0 - 0.1 || x > x1 + 0.1 || y < y0 - 0.1 || y > y1 + 0.1) { r(); r(); r(); continue; }
          const v = this.v(x, y), q = r(), h = 0.014 + r() * r() * 0.05, a = -0.3 + (r() - 0.5) * 1.1;
          const ti = q < v * 0.55 ? 2 : q < 0.72 ? 1 : 0; tiers[ti].push(x, y, h, a);
        }
      }
      const cols = ["rgba(28,78,62,.38)", "rgba(96,156,78,.5)", "rgba(214,232,136,.62)"];
      for (let ti = 0; ti < 3; ti++) {
        const T = tiers[ti]; g.beginPath();
        for (let i = 0; i < T.length; i += 4) { const x = T[i], y = T[i + 1], h = T[i + 2], a = T[i + 3], tx = x + Math.sin(a) * h, ty = y - Math.cos(a) * h; g.moveTo(x - 0.0045, y); g.quadraticCurveTo(x + Math.sin(a) * h * 0.15, y - h * 0.6, tx, ty); g.quadraticCurveTo(x + Math.sin(a) * h * 0.3, y - h * 0.5, x + 0.0045, y); }
        g.fillStyle = cols[ti]; g.fill();
      }
    }
    // clover & small flowers (static)
    for (const f of D.flowers) {
      if (!inR(f.x, f.y, 0.05)) continue; const sz = 0.017 * f.s;
      g.fillStyle = "rgba(20,50,40,.25)"; ell(g, f.x + 0.006, f.y + 0.008, sz * 1.6, sz * 0.8); g.fill();
      for (let k = 0; k < 5; k++) { const a = f.r + k * TAU / 5, px = f.x + Math.cos(a) * sz * 0.85, py = f.y + Math.sin(a) * sz * 0.6;
        g.fillStyle = f.c[0]; ell(g, px, py, sz * 0.62, sz * 0.5); g.fill(); g.fillStyle = f.c[1]; ell(g, px + sz * 0.15, py + sz * 0.15, sz * 0.4, sz * 0.3); g.fill(); }
      g.fillStyle = "#f2c64a"; ell(g, f.x, f.y, sz * 0.38, sz * 0.32); g.fill(); g.fillStyle = "#fff3b0"; ell(g, f.x - sz * 0.1, f.y - sz * 0.1, sz * 0.15, sz * 0.12); g.fill();
    }
    // rocks: cel-shaded with contact shadow + moss
    for (const k of D.rocks) { if (!inR(k.x, k.y, k.s * 0.2)) continue; drawRock(g, k); }
    // border bushes (y-sorted list)
    for (const b of D.bushes) { if (!inR(b.x, b.y, b.r * 1.6)) continue; drawBush(g, b); }
  }
}
function drawRock(g, k) {
  const s = k.s * 0.06, pts = k.pts;
  g.save(); g.translate(k.x, k.y); g.rotate(k.rot * 0.2);
  shadow(g, s * 0.25, s * 0.35, s * 1.6, s * 0.7, 0.9);
  const path = (sc = 1, dy = 0) => { g.beginPath(); pts.forEach((p, i) => { const x = p[0] * s * sc, y = p[1] * s * 0.75 * sc + dy; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  path(); g.fillStyle = k.stone[1]; g.fill();
  g.save(); path(); g.clip();
  g.fillStyle = k.stone[2]; g.beginPath(); g.rect(-s * 2, -s * 2, s * 4, s * 4); g.moveTo(s * 0.8, -s * 0.25); g.ellipse(-s * 0.2, -s * 0.25, s, s * 0.75, 0, 0, TAU, true); g.fill();
  g.fillStyle = k.stone[0]; ell(g, -s * 0.35, -s * 0.45, s * 0.55, s * 0.32, -0.3); g.fill();
  if (k.moss) { g.fillStyle = "#6f9d45"; ell(g, -s * 0.1, -s * 0.62, s * 0.7, s * 0.3); g.fill(); g.fillStyle = "#a3c95e"; ell(g, -s * 0.3, -s * 0.7, s * 0.3, s * 0.12); g.fill(); }
  g.restore();
  g.restore();
}
function drawBush(g, b) {
  const r = b.r;
  shadow(g, b.x + r * 0.35, b.y + r * 0.35, r * 1.5, r * 0.8, 0.9);
  for (const l of b.lobes) celEll(g, b.x + l[0] * r, b.y + l[1] * r, l[2] * r, l[2] * r * 0.9, b.c[1], b.c[2], b.c[0], null);
  for (const l of b.lobes) { g.fillStyle = b.c[3]; ell(g, b.x + (l[0] - l[2] * 0.4) * r, b.y + (l[1] - l[2] * 0.45) * r, l[2] * r * 0.32, l[2] * r * 0.2, -0.5); g.fill(); }
  if (b.berry) for (let i = 0; i < 4; i++) { g.fillStyle = "#e0505a"; ell(g, b.x + Math.cos(i * 2.1 + b.r * 9) * r * 0.5, b.y + Math.sin(i * 2.1) * r * 0.35, r * 0.07, r * 0.07); g.fill(); g.fillStyle = "#ffd0c8"; ell(g, b.x + Math.cos(i * 2.1 + b.r * 9) * r * 0.5 - r * 0.02, b.y + Math.sin(i * 2.1) * r * 0.35 - r * 0.02, r * 0.02, r * 0.02); g.fill(); }
}

// ================= LIVE WORLD LAYER =================
function windAt(x, y, t, gust) { return Math.sin(t * 1.25 + x * 0.9 + y * 0.45) * 0.16 + Math.sin(t * 2.3 + x * 2.1) * 0.05 + gust * (0.35 + 0.25 * Math.sin(t * 3.1 - (x * WIND.x + y * WIND.y) * 1.6)); }
const TUFT_COLS = ["#2f6b4e", "#5f9f4f", "#9cc75a", "#d3e07f"];
function drawTufts(ctx, D, v, t, gust) {
  const paths = [[], [], [], []];
  for (const tf of D.tufts) {
    if (tf.x < v.x0 - 0.1 || tf.x > v.x1 + 0.1 || tf.y < v.y0 - 0.05 || tf.y > v.y1 + 0.2) continue;
    const w = windAt(tf.x, tf.y, t, gust);
    for (const b of tf.b) paths[b.c].push(tf.x + b.dx, tf.y, b.h * tf.s, b.a + w * (0.6 + b.h * 6), b.w);
  }
  for (let c = 0; c < 4; c++) {
    const P = paths[c]; if (!P.length) continue; ctx.beginPath();
    for (let i = 0; i < P.length; i += 5) {
      const x = P[i], y = P[i + 1], h = P[i + 2], a = P[i + 3], w = P[i + 4];
      const tx = x + Math.sin(a) * h, ty = y - Math.cos(a) * h, mx = x + Math.sin(a * 0.5) * h * 0.55, my = y - h * 0.55;
      ctx.moveTo(x - w, y); ctx.quadraticCurveTo(mx - w * 0.3, my, tx, ty); ctx.quadraticCurveTo(mx + w * 0.3, my, x + w, y);
    }
    ctx.fillStyle = TUFT_COLS[c]; ctx.fill();
  }
}
function drawTallFlowers(ctx, D, v, t, gust) {
  for (const f of D.tall) {
    if (f.x < v.x0 - 0.1 || f.x > v.x1 + 0.1 || f.y < v.y0 - 0.05 || f.y > v.y1 + 0.2) continue;
    const w = windAt(f.x, f.y, t, gust) * 0.8, tx = f.x + Math.sin(w) * f.h, ty = f.y - Math.cos(w) * f.h;
    ctx.fillStyle = "rgba(20,50,40,.22)"; ell(ctx, f.x + 0.012, f.y + 0.004, 0.02, 0.007); ctx.fill();
    ctx.strokeStyle = "#4f8a43"; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x, f.y - f.h * 0.5, tx, ty); ctx.stroke();
    ctx.fillStyle = "#6aa64e"; ell(ctx, f.x + Math.sin(w) * f.h * 0.4 + 0.012, f.y - f.h * 0.4, 0.014, 0.006, -0.5); ctx.fill();
    const s = f.s * 0.022;
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + f.r, px = tx + Math.cos(a) * s * 0.8, py = ty + Math.sin(a) * s * 0.55; ctx.fillStyle = f.c[0]; ell(ctx, px, py, s * 0.6, s * 0.45); ctx.fill(); }
    ctx.fillStyle = f.c[1]; ell(ctx, tx + s * 0.3, ty + s * 0.3, s * 0.55, s * 0.3); ctx.fill();
    ctx.fillStyle = "#f4c84a"; ell(ctx, tx, ty, s * 0.35, s * 0.28); ctx.fill();
  }
}
// BotW-style wind line: long gentle S that curls at its head
function windPath(sw, u) {
  const L = sw.L, x = sw.x + WIND.x * u * L - WIND.y * Math.sin(u * 4 + sw.ph) * 0.06, y = sw.y + WIND.y * u * L + WIND.x * Math.sin(u * 4 + sw.ph) * 0.06;
  const cu = (u - 0.78) / 0.22; if (cu > 0) { const a = cu * TAU * 0.9, r = 0.07 * (1 - cu * 0.4); return { x: x + (Math.sin(a) * r) * sw.dir, y: y - (1 - Math.cos(a)) * r }; }
  return { x, y };
}
function drawWindStreak(ctx, sw) {
  const life = sw.t / sw.dur; if (life >= 1) return;
  const head = Math.min(1, life * 1.35), tail = Math.max(0, head - 0.42), alpha = Math.sin(Math.PI * life) * 0.55;
  const N = 22; let prev = windPath(sw, tail);
  ctx.lineCap = "round";
  for (let i = 1; i <= N; i++) {
    const u = tail + (head - tail) * i / N, p = windPath(sw, u), k = i / N;
    ctx.strokeStyle = `rgba(255,255,250,${alpha * Math.sin(Math.PI * k)})`; ctx.lineWidth = 0.004 + 0.009 * Math.sin(Math.PI * k);
    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); prev = p;
  }
}
function drawRingWave(ctx, w) {
  const k = w.t / w.dur; if (k >= 1) return;
  const r = 0.08 + k * w.r, a = (1 - k) * (1 - k);
  ctx.strokeStyle = w.col.replace("A", (a * 0.9).toFixed(3)); ctx.lineWidth = 0.02 * (1 - k) + 0.004;
  ell(ctx, w.x, w.y, r, r * 0.5); ctx.stroke();
  if (k < 0.6) { ctx.strokeStyle = w.col.replace("A", (a * 0.4).toFixed(3)); ell(ctx, w.x, w.y, r * 0.7, r * 0.35); ctx.stroke(); }
}

// ================= PROPS =================
const PAL = {
  wood: ["#e3b77a", "#b07a4a", "#6d4b52", "#f6d9a6"], stone: ["#d3d8cf", "#9da5a8", "#636888", "#eef1e6"],
  brass: ["#fff6cf", "#ffd76a", "#e0a636", "#a7652c", "#73432f"], used: ["#efe6cc", "#d7c595", "#b29a69", "#86704f", "#5e4c3c"], iron: ["#eef0f2", "#c2c7cc", "#959ba3", "#686d78", "#4a4d59"],
};
const _grads = {};
function hGrad(ctx, key, x0, x1, stops) {
  if (_grads[key]) return _grads[key];
  const g = ctx.createLinearGradient(x0, 0, x1, 0); stops.forEach(([o, c]) => g.addColorStop(o, c)); return (_grads[key] = g);
}
function celStops(c, rim) { return [[0, c[0]], [0.06, rim || c[0]], [0.12, c[0]], [0.36, c[0]], [0.4, c[1]], [0.68, c[1]], [0.72, c[2]], [1, c[2]]]; }
// a post (wood or stone), origin at base center. o: {sink, wrapped, knot, t}
function drawPost(ctx, p, o) {
  const r = 0.066, ry = r * 0.42, h = p.h, wood = p.mat === 0, C = wood ? PAL.wood : PAL.stone;
  ctx.save(); ctx.translate(p.x, p.y);
  shadow(ctx, 0.025, 0.012, 0.13, 0.055, 0.85 * (1 - (o.sink || 0)));
  if (o.sink) { ctx.beginPath(); ctx.rect(-0.5, -0.8, 1, 0.8 + ry); ctx.clip(); ctx.translate(0, o.sink * (h + 0.1)); }
  // body
  ctx.beginPath(); ctx.moveTo(-r, -h); ctx.lineTo(-r, 0); ctx.ellipse(0, 0, r, ry, 0, Math.PI, 0, true); ctx.lineTo(r, -h); ctx.closePath();
  ctx.fillStyle = hGrad(ctx, "post" + p.mat, -r, r, celStops(C, C[3])); ctx.fill();
  if (wood) {
    ctx.strokeStyle = "rgba(80,48,36,.35)"; ctx.lineWidth = 0.005; ctx.beginPath();
    for (const gx of p.grain) { ctx.moveTo(gx * r, -h + 0.02); ctx.bezierCurveTo(gx * r + 0.006, -h * 0.6, gx * r - 0.006, -h * 0.35, gx * r + 0.002, -0.01); }
    ctx.stroke();
    ctx.fillStyle = "rgba(60,36,30,.5)"; ell(ctx, p.knotX * r, -h * 0.45, 0.008, 0.012); ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(60,64,90,.35)"; ctx.lineWidth = 0.005; ctx.beginPath(); ctx.moveTo(-r * 0.3, -h); ctx.lineTo(-r * 0.15, -h * 0.6); ctx.lineTo(-r * 0.35, -h * 0.3); ctx.moveTo(r * 0.5, -h * 0.8); ctx.lineTo(r * 0.35, -h * 0.55); ctx.stroke();
    ctx.fillStyle = "rgba(40,44,80,.22)"; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, r, ry, 0, 0, Math.PI); ctx.lineTo(-r, -h * 0.5 - 0.006); ctx.ellipse(0, -h * 0.5 - 0.006, r, ry, 0, Math.PI, 0, true); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.ellipse(0, -h * 0.5 - 0.01, r, ry, 0, Math.PI * 0.55, Math.PI * 0.95); ctx.stroke();
    ctx.fillStyle = "rgba(70,74,110,.35)"; for (const [cx, cy, cr] of [[-0.03, -h * 0.75, 0.007], [0.035, -h * 0.3, 0.009], [-0.012, -h * 0.2, 0.005]]) { ell(ctx, cx, cy, cr, cr * 0.8); ctx.fill(); }
  }
  // AO band at the ground
  ctx.fillStyle = "rgba(20,30,40,.25)"; ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, Math.PI, 0, true); ctx.ellipse(0, -0.02, r, ry, 0, 0, Math.PI, false); ctx.fill();
  // top
  ell(ctx, 0, -h, r, ry); ctx.fillStyle = wood ? "#e9c891" : "#dfe3dc"; ctx.fill();
  if (!wood) { ctx.strokeStyle = "rgba(120,125,150,.6)"; ctx.lineWidth = 0.005; ell(ctx, 0, -h + 0.002, r * 0.82, ry * 0.8); ctx.stroke(); }
  ctx.strokeStyle = wood ? "rgba(255,240,200,.8)" : "rgba(255,255,255,.85)"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.ellipse(0, -h, r, ry, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  if (wood) { ctx.strokeStyle = "rgba(160,110,60,.6)"; ctx.lineWidth = 0.004; ell(ctx, 0.004, -h, r * 0.6, ry * 0.6); ctx.stroke(); ell(ctx, 0.004, -h, r * 0.28, ry * 0.28); ctx.stroke(); }
  // moss cap
  if (p.moss) {
    ctx.fillStyle = "#5f8f3e"; ctx.beginPath(); ctx.ellipse(-r * 0.25, -h + ry * 0.1, r * 0.8, ry * 0.95, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#5f8f3e"; ell(ctx, -r * 0.75, -h + 0.03, 0.014, 0.03); ctx.fill();
    ctx.fillStyle = "#8dbb52"; ell(ctx, -r * 0.35, -h - ry * 0.12, r * 0.55, ry * 0.6); ctx.fill();
    ctx.fillStyle = "#c4dd78"; ell(ctx, -r * 0.5, -h - ry * 0.3, r * 0.22, ry * 0.22); ctx.fill();
  }
  // rope wraps around the base (front half)
  if (o.wrapped) {
    for (let k = 0; k < Math.min(2, o.wrapped); k++) {
      const yy = -0.018 - k * 0.016;
      ctx.strokeStyle = o.red ? "#9d1f1f" : "#bba684"; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.ellipse(0, yy, r + 0.006, ry + 0.004, 0, 0.05, Math.PI - 0.05); ctx.stroke();
      ctx.strokeStyle = o.red ? "#e8463c" : "#f3e7cd"; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.ellipse(0, yy, r + 0.006, ry + 0.004, 0, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.strokeStyle = o.red ? "rgba(255,170,150,.7)" : "rgba(255,255,255,.7)"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.ellipse(0, yy - 0.004, r + 0.004, ry, 0, 0.5, 1.6); ctx.stroke();
    }
  }
  // front grass around base
  if (p.gr) { ctx.fillStyle = "#5c9a4c"; ctx.beginPath(); for (const b of p.gr) { ctx.moveTo(b[0] - 0.006, ry * 0.8); ctx.quadraticCurveTo(b[0], ry * 0.8 - b[1] * 0.6, b[0] + b[2], ry * 0.8 - b[1]); ctx.quadraticCurveTo(b[0] + 0.002, ry * 0.8 - b[1] * 0.5, b[0] + 0.006, ry * 0.8); } ctx.fill(); }
  ctx.restore();
}
// brass bell hanging from a bracket on the post. st: 'live' | 'used' | 'fake'
function drawBell(ctx, p, o) {
  const r = 0.066, h = p.h, C = o.state === "live" ? PAL.brass : o.state === "used" ? PAL.used : PAL.iron;
  ctx.save(); ctx.translate(p.x, p.y);
  if (o.sink) { ctx.beginPath(); ctx.rect(-0.5, -0.8, 1, 0.8 + 0.03); ctx.clip(); ctx.translate(0, o.sink * (h + 0.2)); }
  const px = r + 0.06, py = -h + 0.03;
  // bracket
  ctx.lineCap = "round";
  ctx.strokeStyle = "#5a3a2e"; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(r * 0.2, -h + 0.028); ctx.lineTo(px + 0.012, py - 0.006); ctx.stroke();
  ctx.strokeStyle = "#a8774c"; ctx.lineWidth = 0.013; ctx.beginPath(); ctx.moveTo(r * 0.2, -h + 0.024); ctx.lineTo(px + 0.012, py - 0.009); ctx.stroke();
  ctx.strokeStyle = "rgba(255,220,170,.6)"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(r * 0.3, -h + 0.02); ctx.lineTo(px + 0.006, py - 0.013); ctx.stroke();
  // glow
  if (o.glow > 0) {
    ctx.globalCompositeOperation = "lighter";
    spr(ctx, SPR.glow, px, py + 0.05, 0.34 * (0.85 + 0.15 * o.glow), 0.3, 0.55 * o.glow);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.translate(px, py); ctx.rotate(o.ang || 0); ctx.scale(1.45, 1.45);
  ctx.strokeStyle = "#4a3a30"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(0, -0.004); ctx.lineTo(0, 0.01); ctx.stroke();
  ctx.fillStyle = C[3]; ell(ctx, 0, 0.008, 0.008, 0.006); ctx.fill();
  // clapper (lags behind the swing)
  ctx.fillStyle = C[4]; ell(ctx, -Math.sin(o.ang || 0) * 0.012, 0.082, 0.009, 0.009); ctx.fill();
  const body = () => { ctx.beginPath(); ctx.moveTo(-0.017, 0.012); ctx.bezierCurveTo(-0.03, 0.014, -0.026, 0.05, -0.044, 0.072); ctx.quadraticCurveTo(0, 0.082, 0.044, 0.072); ctx.bezierCurveTo(0.026, 0.05, 0.03, 0.014, 0.017, 0.012); ctx.quadraticCurveTo(0, 0.006, -0.017, 0.012); ctx.closePath(); };
  body(); ctx.fillStyle = hGrad(ctx, "bell" + o.state, -0.044, 0.044, [[0, C[1]], [0.2, C[1]], [0.22, C[0]], [0.3, C[0]], [0.32, C[2]], [0.62, C[2]], [0.65, C[3]], [0.88, C[3]], [0.9, C[4]], [1, C[4]]]); ctx.fill();
  // lip
  ctx.strokeStyle = C[3]; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.ellipse(0, 0.072, 0.044, 0.011, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = C[1]; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.ellipse(0, 0.07, 0.042, 0.009, 0, Math.PI * 0.55, Math.PI * 0.95); ctx.stroke();
  // band
  ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 0.003; ctx.beginPath(); ctx.moveTo(-0.033, 0.055); ctx.quadraticCurveTo(0, 0.061, 0.033, 0.055); ctx.stroke();
  // specular glint
  if (o.state === "live") {
    const tw = 0.5 + 0.5 * Math.sin(o.t * 3 + p.ph), s = 0.012 + 0.012 * tw * (0.4 + (o.glow || 0));
    ctx.fillStyle = "rgba(255,255,255,.95)"; star(ctx, -0.018, 0.034, s, 0.25);
  }
  ctx.restore();
}
function star(ctx, x, y, s, k = 0.28, rot = 0) {
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? s * k : s; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill();
}
// wooden reel (spool) that spins about its vertical axis: o.rot = angle
function drawSpool(ctx, p, o) {
  const R = 0.098, ry = R * 0.42, cr = 0.06, h = 0.13, C = PAL.wood, Y = p.yc;
  ctx.save(); ctx.translate(p.x, p.y);
  shadow(ctx, 0.03, 0.015, 0.17, 0.07, 0.85 * (1 - (o.sink || 0)));
  if (o.sink) { ctx.beginPath(); ctx.rect(-0.5, -0.8, 1, 0.8 + ry); ctx.clip(); ctx.translate(0, o.sink * (h + 0.1)); }
  if (o.glow > 0) { ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.glow, 0, -h * 0.5, 0.36, 0.3, 0.38 * o.glow); ctx.globalCompositeOperation = "source-over"; }
  const slab = (y, th) => {
    ctx.beginPath(); ctx.moveTo(-R, y - th); ctx.lineTo(-R, y); ctx.ellipse(0, y, R, ry, 0, Math.PI, 0, true); ctx.lineTo(R, y - th); ctx.closePath();
    ctx.fillStyle = hGrad(ctx, "spoolslab", -R, R, celStops(C, C[3])); ctx.fill();
    ell(ctx, 0, y - th, R, ry); ctx.fillStyle = "#e7c38c"; ctx.fill();
  };
  slab(0, 0.022);
  // core with wound yarn
  const y0 = -0.022, y1 = -h + 0.02;
  ctx.beginPath(); ctx.moveTo(-cr, y1); ctx.lineTo(-cr, y0); ctx.ellipse(0, y0, cr, cr * 0.42, 0, Math.PI, 0, true); ctx.lineTo(cr, y1); ctx.closePath();
  ctx.fillStyle = hGrad(ctx, "core" + p.yi, -cr, cr, [[0, Y[0]], [0.36, Y[0]], [0.4, Y[1]], [0.7, Y[1]], [0.74, Y[2]], [1, Y[2]]]); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(90,50,60,.25)"; ctx.lineWidth = 0.004; ctx.beginPath();
  const off = ((o.rot || 0) * cr) % 0.016;
  for (let k = -cr - 0.04; k < cr + 0.04; k += 0.016) { const x = k + off; ctx.moveTo(x - 0.02, y0 + 0.004); ctx.lineTo(x + 0.02, y1 - 0.004); }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(-cr * 0.55, y0); ctx.lineTo(-cr * 0.55, y1); ctx.stroke();
  ctx.restore();
  slab(-h + 0.022, 0.022);
  // top face: centre hole + 3 holes that spin
  const ty = -h;
  ctx.strokeStyle = "rgba(150,100,55,.55)"; ctx.lineWidth = 0.004; ell(ctx, 0, ty, R * 0.75, ry * 0.75); ctx.stroke();
  ctx.fillStyle = "#5a3a2a"; ell(ctx, 0, ty, 0.014, 0.007); ctx.fill();
  for (let k = 0; k < 3; k++) {
    const a = (o.rot || 0) + k * TAU / 3, hx = Math.cos(a) * R * 0.5, hy = ty + Math.sin(a) * ry * 0.5;
    ctx.fillStyle = "#7a5034"; ell(ctx, hx, hy, 0.011, 0.0055); ctx.fill(); ctx.fillStyle = "#3e2a20"; ell(ctx, hx + 0.002, hy + 0.001, 0.008, 0.004); ctx.fill();
  }
  // spin streak when fast
  const sp = Math.min(1, Math.abs(o.spin || 0) / 8);
  if (sp > 0.1) { ctx.strokeStyle = `rgba(255,250,230,${sp * 0.7})`; ctx.lineWidth = 0.005; ctx.beginPath(); ctx.ellipse(0, ty, R * 0.92, ry * 0.92, 0, (o.rot || 0), (o.rot || 0) + 1.2 * Math.sign(o.spin)); ctx.stroke(); }
  if (o.wrapped) { ctx.strokeStyle = o.red ? "#e8463c" : "#f3e7cd"; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.ellipse(0, -0.06, cr + 0.008, cr * 0.42 + 0.004, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
  ctx.restore();
}
// yarn ball (cel shaded sphere + winding arcs)
function drawBall(ctx, x, y, r, t, o = {}) {
  ctx.save(); ctx.translate(x, y);
  shadow(ctx, r * 0.2, r * 0.75, r * 1.5, r * 0.6, 0.9);
  if (o.glow > 0) { ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.glow, 0, -r * 0.2, r * 4.2, r * 3.6, 0.5 * o.glow); ctx.globalCompositeOperation = "source-over"; }
  ctx.translate(0, -r * 0.85);
  const col = o.red ? ["#ff9a86", "#e8463c", "#a02626"] : ["#fffaf0", "#f1e3c6", "#c9b2a4"];
  ell(ctx, 0, 0, r, r); ctx.fillStyle = col[1]; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, r, r); ctx.clip();
  ctx.fillStyle = col[2]; crescent(ctx, 0, 0, r, r, -r * 0.3, -r * 0.35);
  ctx.strokeStyle = o.red ? "rgba(130,20,20,.6)" : "rgba(160,130,100,.55)"; ctx.lineWidth = r * 0.09;
  const rot = o.rot || 0;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(0, 0, r * (0.95 - k * 0.04), r * (0.25 + k * 0.12), rot + k * 0.62, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.fillStyle = col[0]; ell(ctx, -r * 0.38, -r * 0.42, r * 0.3, r * 0.2, -0.6); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function drawKnot(ctx, x, y, k, red) {
  const s = 0.02 * (1 + Math.sin(Math.min(1, k) * Math.PI) * 0.6);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = red ? "#b52a26" : "#d9c6a2"; ell(ctx, 0, 0, s * 1.2, s); ctx.fill();
  ctx.strokeStyle = red ? "#e8463c" : "#f6ecd6"; ctx.lineWidth = s * 0.55; ctx.lineCap = "round";
  ctx.beginPath(); ctx.ellipse(-s * 0.7, -s * 0.2, s * 0.8, s * 0.5, -0.6, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(s * 0.7, -s * 0.2, s * 0.8, s * 0.5, 0.6, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.4, s * 1.2, s * 1.4, s * 1.8); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.4, s * 1.4, -s * 0.9, s * 2); ctx.stroke();
  ctx.restore();
}

// ================= YARN =================
let _nx = new Float32Array(1024), _ny = new Float32Array(1024), _q = new Float32Array(2048);
function yarnPath(ctx, P, n, off) {
  const X = i => P[i * 2] + _nx[i] * off, Y = i => P[i * 2 + 1] + _ny[i] * off;
  ctx.beginPath(); ctx.moveTo(X(0), Y(0));
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
  ctx.lineTo(X(n - 1), Y(n - 1));
}
// P: flat [x,y,...]; opt: {w, red, tension, vibFrom, t, glow, alpha}
function drawYarn(ctx, P, opt = {}) {
  let n = P.length >> 1; if (n < 2) return;
  if (_nx.length < n) { _nx = new Float32Array(n * 2); _ny = new Float32Array(n * 2); }
  if (_q.length < n * 2) _q = new Float32Array(n * 4);
  const w = opt.w || 0.032, red = opt.red || 0, t = opt.t || 0;
  // vibration of the taut free section
  let Q = P;
  if (opt.tension > 0.05) {
    Q = _q; for (let i = 0; i < n * 2; i++) Q[i] = P[i];
    const from = opt.vibFrom || 0, amp = 0.008 * opt.tension;
    for (let i = from + 1; i < n - 1; i++) { const a = P[i * 2 + 2] - P[i * 2 - 2], b = P[i * 2 + 3] - P[i * 2 - 1], l = Math.hypot(a, b) || 1, s = Math.sin(i * 1.3 - t * 70) * amp * Math.sin(Math.PI * (i - from) / (n - from)); Q[i * 2] += -b / l * s; Q[i * 2 + 1] += a / l * s; }
  }
  for (let i = 0; i < n; i++) { const a = Q[Math.min(n - 1, i + 1) * 2] - Q[Math.max(0, i - 1) * 2], b = Q[Math.min(n - 1, i + 1) * 2 + 1] - Q[Math.max(0, i - 1) * 2 + 1], l = Math.hypot(a, b) || 1; _nx[i] = -b / l; _ny[i] = a / l; }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const al = opt.alpha == null ? 1 : opt.alpha; ctx.globalAlpha = al;
  if (opt.glow > 0) {
    ctx.globalCompositeOperation = "lighter";
    [[4.2, 0.07], [2.6, 0.13], [1.7, 0.22]].forEach(([k, a]) => { yarnPath(ctx, Q, n, 0); ctx.strokeStyle = `rgba(255,${70 + 40 * (1 - red)},60,${a * opt.glow})`; ctx.lineWidth = w * k; ctx.stroke(); });
    ctx.globalCompositeOperation = "source-over";
  }
  // contact shadow on the grass
  if (!opt.noShadow) { ctx.save(); ctx.translate(0.008, 0.012); yarnPath(ctx, Q, n, 0); ctx.strokeStyle = `rgba(16,40,40,${0.28 * (1 - red * 0.6)})`; ctx.lineWidth = w * 1.25; ctx.stroke(); ctx.restore(); }
  const ten = Math.min(1, opt.tension || 0);
  const base = red ? rgb(mix(mix("#efe2c6", "#fff4dc", ten), "#df3a30", red)) : rgb(mix("#efe2c6", "#fff6e2", ten));
  const dark = rgb(mix(mix("#c9b08c", "#d7bf96", ten), "#9a1d20", red)), lite = rgb(mix("#fffdf6", "#ff9c86", red));
  yarnPath(ctx, Q, n, 0); ctx.strokeStyle = dark; ctx.lineWidth = w; ctx.stroke();
  yarnPath(ctx, Q, n, 0); ctx.strokeStyle = base; ctx.lineWidth = w * 0.78; ctx.stroke();
  // twisted plies: alternating dashes offset to each side
  const per = w * 1.25;
  ctx.setLineDash([per * 0.5, per * 0.5]);
  ctx.lineDashOffset = 0; yarnPath(ctx, Q, n, -w * 0.17); ctx.strokeStyle = lite; ctx.lineWidth = w * 0.24; ctx.stroke();
  ctx.lineDashOffset = per * 0.5; yarnPath(ctx, Q, n, w * 0.2); ctx.strokeStyle = dark; ctx.globalAlpha = al * 0.7; ctx.lineWidth = w * 0.22; ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = al;
  // fuzz
  if (!opt.noFuzz) {
    ctx.strokeStyle = red ? "rgba(255,170,150,.55)" : "rgba(255,250,235,.6)"; ctx.lineWidth = w * 0.08; ctx.beginPath();
    for (let i = 3; i < n - 1; i += 5) { const s = ((i * 7919) % 13) / 13 - 0.5, x = Q[i * 2], y = Q[i * 2 + 1]; ctx.moveTo(x + _nx[i] * w * 0.4, y + _ny[i] * w * 0.4); ctx.lineTo(x + _nx[i] * w * (0.75 + s * 0.3) + _ny[i] * w * s, y + _ny[i] * w * (0.75 + s * 0.3) - _nx[i] * w * s); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ================= CREATURES =================
const CAT = { o: "#f49a45", ol: "#ffc47c", os: "#c9653f", st: "#cf6a2c", w: "#fff7ec", ws: "#dccbd3", pink: "#f59a9a", eye: "#2c1c18", edge: "rgba(110,46,26,.5)" };
function catEar(ctx, x, y, rot, s, inner, back) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-4.4 * s, 1.5); ctx.quadraticCurveTo(-2.2 * s, -6 * s, 0, -8.2 * s); ctx.quadraticCurveTo(2.4 * s, -5.5 * s, 4.4 * s, 1.5); ctx.closePath();
  ctx.fillStyle = back ? CAT.os : CAT.o; ctx.fill(); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.8; ctx.stroke();
  if (inner) { ctx.beginPath(); ctx.moveTo(-2.4 * s, 0.8); ctx.quadraticCurveTo(-1 * s, -4.4 * s, 0.1, -5.8 * s); ctx.quadraticCurveTo(1.4 * s, -3.6 * s, 2.4 * s, 0.8); ctx.closePath(); ctx.fillStyle = "#f7b2a6"; ctx.fill(); }
  else { ctx.fillStyle = "rgba(255,210,150,.55)"; ctx.beginPath(); ctx.moveTo(-3.6 * s, 0.5); ctx.quadraticCurveTo(-2 * s, -5 * s, -0.4, -7.2 * s); ctx.lineTo(-1.2 * s, 0.5); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function catEye(ctx, x, y, rx, ry, blink, look = 0) {
  if (blink > 0.85) { ctx.strokeStyle = CAT.eye; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y - ry * 0.2, rx * 1.1, 0.3, Math.PI - 0.3); ctx.stroke(); return; }
  const k = 1 - blink;
  ctx.fillStyle = CAT.eye; ell(ctx, x, y, rx, ry * k); ctx.fill();
  ctx.fillStyle = "#6a3a1e"; ell(ctx, x, y + ry * 0.35 * k, rx * 0.75, ry * 0.45 * k); ctx.fill();
  ctx.fillStyle = "#fff"; ell(ctx, x + rx * 0.3 + look, y - ry * 0.38 * k, rx * 0.42, ry * 0.3 * k); ctx.fill();
  ell(ctx, x - rx * 0.35, y + ry * 0.35 * k, rx * 0.16, ry * 0.12 * k); ctx.fill();
}
function catLeg(ctx, hx, hy, fx, fy, col, paw) {
  ctx.strokeStyle = col; ctx.lineWidth = 5.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + fx) / 2 + 0.6, (hy + fy) / 2, fx, fy - 1.6); ctx.stroke();
  ctx.fillStyle = paw; ell(ctx, fx + 0.6, fy - 1.2, 3.3, 2.2); ctx.fill();
  ctx.strokeStyle = "rgba(110,60,50,.35)"; ctx.lineWidth = 0.5; ell(ctx, fx + 0.6, fy - 1.2, 3.3, 2.2); ctx.stroke();
}
function catTail(ctx, bx, by, sway, curl, front) {
  const ex = bx - 9 + sway * 7, ey = by - 18 - curl * 2;
  ctx.lineCap = "round";
  const path = () => { ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx - 9, by + 1, bx - 13 + sway * 2, by - 9, ex, ey); };
  path(); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 6.4; ctx.stroke();
  path(); ctx.strokeStyle = CAT.o; ctx.lineWidth = 5.2; ctx.stroke();
  ctx.save(); path(); ctx.strokeStyle = CAT.ol; ctx.lineWidth = 1.2; ctx.translate(-1.2, -0.8); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 2.2; ctx.beginPath();
  for (const u of [0.45, 0.68, 0.88]) { const x = bx + (ex - bx) * u - 2 * Math.sin(u * 3), y = by + (ey - by) * u; ctx.moveTo(x - 2.3, y + 0.8); ctx.lineTo(x + 2.3, y - 0.8); }
  ctx.stroke();
  ctx.fillStyle = CAT.st; ell(ctx, ex, ey, 2.6, 2.4); ctx.fill();
}
// A: {face:'side'|'front'|'back', flip, walk, move(0..1), t, blink, ear, tail, sq, lean, carry, bob, sleep}
function drawCat(ctx, x, y, A) {
  const k = 0.0095;
  ctx.save(); ctx.translate(x, y);
  const bob = A.move * Math.abs(Math.sin(A.walk)) * 1.6 * k;
  shadow(ctx, 0.012, 0.004, 0.16 * (1 - bob * 4), 0.05, 0.95);
  ctx.scale(k, k); ctx.rotate(A.lean || 0); ctx.scale(1 + (A.sq || 0), 1 - (A.sq || 0));
  if (A.face === "side") catSide(ctx, A, -bob / k);
  else if (A.face === "front") catFront(ctx, A, -bob / k);
  else catBack(ctx, A, -bob / k);
  ctx.restore();
}
function catSide(ctx, A, b) {
  if (A.flip) ctx.scale(-1, 1);
  const m = A.move, ph = A.walk, br = 1 + Math.sin(A.t * 2.2) * 0.02 * (1 - m);
  const legF = (hx, p, far) => catLeg(ctx, hx, -8 + b, hx + Math.sin(p) * 5.5 * m, -Math.max(0, Math.cos(p)) * 3.2 * m, far ? CAT.os : CAT.o, far ? CAT.ws : CAT.w);
  legF(-8.5, ph + Math.PI, true); legF(7.5, ph, true);
  catTail(ctx, -11, -15 + b, A.tail, m);
  legF(-10.5, ph, false); legF(5.5, ph + Math.PI, false);
  // body
  ctx.save(); ctx.translate(0, -13.5 + b); ctx.scale(1, br);
  ell(ctx, 0, 0, 14.5, 8.8); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 14.5, 8.8); ctx.clip();
  ctx.fillStyle = CAT.w; ell(ctx, 3, 7, 12, 4.8); ctx.fill();
  ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.85; crescent(ctx, 0, 0, 14.5, 8.8, -2.5, -3.2); ctx.globalAlpha = 1;
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.beginPath();
  for (const sx of [-8, -3, 2]) { ctx.moveTo(sx - 1, -9.5); ctx.quadraticCurveTo(sx + 1.8, -5, sx + 0.5, -1.5); }
  ctx.stroke();
  ctx.fillStyle = CAT.ol; ell(ctx, -3, -6.2, 8, 2.2, -0.08); ctx.fill();
  ctx.restore();
  ell(ctx, 0, 0, 14.5, 8.8); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.restore();
  // chest fluff
  ctx.fillStyle = CAT.w; ctx.beginPath(); ctx.ellipse(10.5, -11 + b, 4.6, 5.6, -0.3, 0, TAU); ctx.fill();
  // head
  ctx.save(); ctx.translate(12.5, -23.5 + b * 1.15); ctx.rotate(A.tilt || 0);
  catEar(ctx, -5, -6.2, -0.32 + (A.ear || 0) * 0.3, 1, false, true);
  catEar(ctx, 3.6, -7.4, 0.18 - (A.ear2 || 0) * 0.25, 1, true, false);
  ell(ctx, 0, 0, 10.8, 9.4); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 10.8, 9.4); ctx.clip();
  ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.8; crescent(ctx, 0, 0, 10.8, 9.4, -2.2, -2.8); ctx.globalAlpha = 1;
  ctx.fillStyle = CAT.w; ell(ctx, 5.2, 3.4, 5.6, 4.2); ctx.fill(); ell(ctx, -1, 5.5, 5, 3.4); ctx.fill();
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 1.7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-2.2, -5.6); ctx.moveTo(0.2, -9.4); ctx.lineTo(0.5, -6); ctx.moveTo(3.2, -8.8); ctx.lineTo(2.8, -5.8); ctx.moveTo(-10, -1); ctx.lineTo(-7, -0.5); ctx.moveTo(-10, 2); ctx.lineTo(-7.2, 1.6); ctx.stroke();
  ctx.fillStyle = CAT.ol; ell(ctx, -3.5, -5.2, 4.2, 2, -0.3); ctx.fill();
  ctx.restore();
  ell(ctx, 0, 0, 10.8, 9.4); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke();
  catEye(ctx, 4.4, -0.8, 2.1, 2.9, A.blink, 0.2);
  catEye(ctx, -1.6, -1.0, 1.6, 2.6, A.blink, 0.1);
  ctx.fillStyle = "rgba(245,120,120,.45)"; ell(ctx, 1.2, 3.3, 2.1, 1.2); ctx.fill();
  ctx.fillStyle = "#e8787c"; ctx.beginPath(); ctx.moveTo(8.6, 1.4); ctx.lineTo(10.2, 1.0); ctx.lineTo(9.6, 2.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#7a3a2a"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(9.4, 2.6); ctx.quadraticCurveTo(8.8, 4.2, 7.6, 3.8); ctx.moveTo(9.4, 2.6); ctx.quadraticCurveTo(9.8, 4.2, 10.6, 3.6); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(8, 3.2); ctx.lineTo(14, 2.2); ctx.moveTo(8, 3.9); ctx.lineTo(13.6, 4.4); ctx.stroke();
  if (A.carry) { ctx.strokeStyle = A.carryRed ? "#e0392f" : "#f1e2c4"; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(9, 4.4); ctx.quadraticCurveTo(10.5, 8, 7.5, 10.5 + Math.sin(A.t * 6) * 0.8); ctx.stroke(); ctx.fillStyle = "#f6ead2"; ell(ctx, 9.6, 4.6, 1.6, 1.3); ctx.fill(); }
  ctx.restore();
}
function catFront(ctx, A, b) {
  const m = A.move, ph = A.walk, br = 1 + Math.sin(A.t * 2.2) * 0.02 * (1 - m);
  // tail behind
  ctx.save(); ctx.translate(2, 0); catTail(ctx, 6, -10 + b, -A.tail * 0.6 - 0.4, m); ctx.restore();
  ctx.fillStyle = CAT.ws; ell(ctx, -7.2, -1.6, 3.2, 2.2); ctx.fill(); ell(ctx, 7.2, -1.6, 3.2, 2.2); ctx.fill();
  ctx.save(); ctx.translate(0, -12 + b); ctx.scale(1, br);
  ell(ctx, 0, 0, 10.6, 9.4); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 10.6, 9.4); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.85; crescent(ctx, 0, 0, 10.6, 9.4, -2.4, -2.6); ctx.globalAlpha = 1;
  ctx.fillStyle = CAT.w; ell(ctx, 0, 1.5, 6.2, 7.5); ctx.fill(); ctx.fillStyle = CAT.ws; ell(ctx, 2.2, 4, 4, 4.5); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore(); ell(ctx, 0, 0, 10.6, 9.4); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore();
  for (const [lx, p] of [[-4.4, ph], [4.4, ph + Math.PI]]) { const lift = Math.max(0, Math.sin(p)) * 2.8 * m; catLeg(ctx, lx, -7 + b, lx, -lift + 0.5, CAT.o, CAT.w); }
  ctx.save(); ctx.translate(0, -25 + b * 1.15); ctx.rotate(A.tilt || 0);
  catEar(ctx, -7.2, -5.6, -0.42 + (A.ear || 0) * 0.3, 1, true); catEar(ctx, 7.2, -5.6, 0.42 - (A.ear2 || 0) * 0.3, 1, true);
  ell(ctx, 0, 0, 11.8, 10); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 11.8, 10); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.8; crescent(ctx, 0, 0, 11.8, 10, -2, -2.8); ctx.globalAlpha = 1;
  ctx.fillStyle = CAT.w; ell(ctx, -3, 4.4, 4.6, 3.8); ctx.fill(); ell(ctx, 3, 4.4, 4.6, 3.8); ctx.fill();
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 1.7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-2.6, -9.6); ctx.lineTo(-2, -6.4); ctx.moveTo(0, -10); ctx.lineTo(0, -6.6); ctx.moveTo(2.6, -9.6); ctx.lineTo(2, -6.4); ctx.moveTo(-11.5, 0); ctx.lineTo(-8.6, 0.3); ctx.moveTo(11.5, 0); ctx.lineTo(8.6, 0.3); ctx.stroke();
  ctx.fillStyle = CAT.ol; ell(ctx, -4.5, -5.5, 4.4, 2, -0.25); ctx.fill();
  ctx.restore(); ell(ctx, 0, 0, 11.8, 10); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke();
  catEye(ctx, -4.4, -0.6, 2.2, 3, A.blink, 0); catEye(ctx, 4.4, -0.6, 2.2, 3, A.blink, 0);
  ctx.fillStyle = "rgba(245,120,120,.45)"; ell(ctx, -7, 3, 2.2, 1.3); ctx.fill(); ell(ctx, 7, 3, 2.2, 1.3); ctx.fill();
  ctx.fillStyle = "#e8787c"; ctx.beginPath(); ctx.moveTo(-1.3, 2.2); ctx.lineTo(1.3, 2.2); ctx.lineTo(0, 3.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#7a3a2a"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 3.6); ctx.quadraticCurveTo(-0.6, 5.2, -2, 4.8); ctx.moveTo(0, 3.6); ctx.quadraticCurveTo(0.6, 5.2, 2, 4.8); ctx.stroke();
  if (A.carry) { ctx.strokeStyle = "#f1e2c4"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(1, 5.4); ctx.quadraticCurveTo(3, 9, 1.5, 12 + Math.sin(A.t * 6)); ctx.stroke(); ctx.fillStyle = "#f6ead2"; ell(ctx, 0.8, 5.6, 1.7, 1.3); ctx.fill(); }
  ctx.restore();
}
function catBack(ctx, A, b) {
  const m = A.move, ph = A.walk, br = 1 + Math.sin(A.t * 2.2) * 0.02 * (1 - m);
  for (const [lx, p] of [[-5, ph], [5, ph + Math.PI]]) { const lift = Math.max(0, Math.sin(p)) * 2.8 * m; catLeg(ctx, lx, -6 + b, lx, -lift + 0.5, CAT.os, CAT.ws); }
  ctx.save(); ctx.translate(0, -13 + b); ctx.scale(1, br);
  ell(ctx, 0, 0, 10.8, 9.6); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 10.8, 9.6); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.85; crescent(ctx, 0, 0, 10.8, 9.6, -2.4, -3); ctx.globalAlpha = 1;
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.beginPath();
  for (const sy of [-5, -1, 3]) { ctx.moveTo(-8, sy); ctx.quadraticCurveTo(-3, sy - 2.2, -1, sy - 1); ctx.moveTo(8, sy); ctx.quadraticCurveTo(3, sy - 2.2, 1, sy - 1); }
  ctx.stroke(); ctx.fillStyle = CAT.ol; ell(ctx, -3.5, -5.5, 5, 2.2, -0.2); ctx.fill();
  ctx.restore(); ell(ctx, 0, 0, 10.8, 9.6); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(0, -25.5 + b * 1.15); ctx.rotate(A.tilt || 0);
  catEar(ctx, -7, -5.4, -0.42 + (A.ear || 0) * 0.3, 1, false, true); catEar(ctx, 7, -5.4, 0.42 - (A.ear2 || 0) * 0.3, 1, false, true);
  ell(ctx, 0, 0, 11.6, 9.8); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 11.6, 9.8); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.8; crescent(ctx, 0, 0, 11.6, 9.8, -2, -3); ctx.globalAlpha = 1;
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 1.9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-3, -8.5); ctx.lineTo(-2.4, -2); ctx.moveTo(0, -9.4); ctx.lineTo(0, -1.4); ctx.moveTo(3, -8.5); ctx.lineTo(2.4, -2); ctx.stroke();
  ctx.fillStyle = CAT.ol; ell(ctx, -4.5, -5.2, 4.4, 2, -0.3); ctx.fill();
  ctx.restore(); ell(ctx, 0, 0, 11.6, 9.8); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.restore();
  // tail in front, swaying
  const s = A.tail;
  ctx.lineCap = "round";
  const tp = () => { ctx.beginPath(); ctx.moveTo(0, -5 + b); ctx.bezierCurveTo(1 + s * 3, 2 + b, 4 + s * 8, -6 + b, 3 + s * 10, -16 + b); };
  tp(); ctx.strokeStyle = CAT.edge; ctx.lineWidth = 6.2; ctx.stroke(); tp(); ctx.strokeStyle = CAT.o; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = CAT.st; ell(ctx, 3 + s * 10, -16 + b, 2.6, 2.6); ctx.fill();
}
// curled sleeping cat (reveal screen)
function drawSleepingCat(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const br = 1 + Math.sin(t * 1.6) * 0.025;
  shadow(ctx, 0, 2, 22, 5, 0.6);
  ctx.save(); ctx.scale(1, br);
  ell(ctx, 0, -8, 17, 9.5); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, -8, 17, 9.5); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.85; crescent(ctx, 0, -8, 17, 9.5, -3, -3.5); ctx.globalAlpha = 1;
  ctx.strokeStyle = CAT.st; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.beginPath(); for (const sx of [-9, -4, 1]) { ctx.moveTo(sx - 1, -17); ctx.quadraticCurveTo(sx + 2, -12, sx + 0.5, -8); } ctx.stroke();
  ctx.fillStyle = CAT.ol; ell(ctx, -4, -14, 9, 2.4); ctx.fill(); ctx.restore();
  ctx.restore();
  // tail wrapped around front
  ctx.lineCap = "round"; ctx.strokeStyle = CAT.o; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-15, -6); ctx.quadraticCurveTo(-14, 2, 0, 1); ctx.quadraticCurveTo(8, 0.5, 11 + Math.sin(t * 1.2) * 1.2, -2); ctx.stroke();
  ctx.fillStyle = CAT.st; ell(ctx, 11 + Math.sin(t * 1.2) * 1.2, -2, 2.6, 2.4); ctx.fill();
  // head resting
  ctx.save(); ctx.translate(12, -9);
  catEar(ctx, -5, -6, -0.5, 0.95, false, true); catEar(ctx, 3.5, -7, 0.25, 0.95, true);
  ell(ctx, 0, 0, 10, 8.6); ctx.fillStyle = CAT.o; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 10, 8.6); ctx.clip(); ctx.fillStyle = CAT.os; ctx.globalAlpha = 0.8; crescent(ctx, 0, 0, 10, 8.6, -2, -2.5); ctx.globalAlpha = 1; ctx.fillStyle = CAT.w; ell(ctx, 3.5, 4, 5.4, 3.6); ctx.fill(); ctx.restore();
  ctx.strokeStyle = CAT.eye; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-1.2, 0, 1.8, 0.3, Math.PI - 0.3); ctx.moveTo(6.2, -0.2); ctx.arc(4.4, -0.2, 1.8, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.fillStyle = "rgba(245,120,120,.5)"; ell(ctx, 0, 3, 2, 1.1); ctx.fill();
  ctx.fillStyle = "#e8787c"; ell(ctx, 5.6, 2.2, 1, 0.8); ctx.fill();
  ctx.restore();
  ctx.restore();
}
const DOG = { b: "#f8f1e4", l: "#fffaf2", s: "#d6c8d2", tan: "#e2a970", tanS: "#b97c58", eye: "#2a1d18", edge: "rgba(90,70,80,.45)" };
// sleeping dog (curled, facing +x). d: {x,y,face,awake(0..1.5),swat(0..1),t}
function drawDog(ctx, d, t, near) {
  const k = 0.0098, aw = clamp(d.awake / 0.4, 0, 1), sw = d.swat || 0;
  ctx.save(); ctx.translate(d.x, d.y);
  shadow(ctx, 0.01, 0.006, 0.26, 0.07, 0.95);
  ctx.scale(k * d.face, k);
  const br = 1 + Math.sin(t * 1.7 + d.ph) * 0.03 * (1 - aw);
  // tail curled
  ctx.lineCap = "round"; ctx.strokeStyle = DOG.edge; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-19, -6); ctx.quadraticCurveTo(-24, 4, -8, 4); ctx.stroke();
  ctx.strokeStyle = DOG.b; ctx.lineWidth = 6.8; ctx.stroke(); ctx.strokeStyle = DOG.tan; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, -2); ctx.quadraticCurveTo(-22, 2, -17, 3.5); ctx.stroke();
  // body
  ctx.save(); ctx.translate(-2, -10); ctx.scale(1, br);
  ell(ctx, 0, 0, 21, 11.5); ctx.fillStyle = DOG.b; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 21, 11.5); ctx.clip();
  ctx.fillStyle = DOG.tan; ell(ctx, -4, -6.5, 16, 7.5); ctx.fill(); ctx.fillStyle = DOG.tanS; ctx.globalAlpha = 0.6; ell(ctx, -1, -3.5, 15, 3); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = DOG.s; ctx.globalAlpha = 0.75; crescent(ctx, 0, 0, 21, 11.5, -3, -4); ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,240,215,.6)"; ell(ctx, -7, -8.5, 8, 2.2, -0.1); ctx.fill();
  ctx.restore(); ell(ctx, 0, 0, 21, 11.5); ctx.strokeStyle = DOG.edge; ctx.lineWidth = 0.9; ctx.stroke();
  // haunch
  celEll(ctx, -11, 1, 8.5, 6.5, DOG.b, DOG.l, DOG.s, DOG.edge, 0.8);
  ctx.restore();
  // paws (one swats)
  const pa = sw > 0 ? Math.sin(sw * Math.PI) : 0;
  ctx.save(); ctx.translate(13, -3); ctx.rotate(-pa * 1.4); ctx.translate(pa * 6, -pa * 4);
  celEll(ctx, 0, 0, 5, 3.2, DOG.b, DOG.l, DOG.s, DOG.edge, 0.7);
  ctx.strokeStyle = "rgba(120,90,90,.6)"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(2.5, -1.8); ctx.lineTo(3, 1); ctx.moveTo(4, -1.5); ctx.lineTo(4.3, 0.8); ctx.stroke();
  ctx.restore();
  if (pa > 0.2) { ctx.strokeStyle = `rgba(255,255,255,${pa * 0.9})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(13, -3, 14, -1.9, -0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(13, -3, 10, -1.7, -0.7); ctx.stroke(); }
  celEll(ctx, 18, -1, 4.6, 3, DOG.b, DOG.l, DOG.s, DOG.edge, 0.7);
  // head
  const hy = -10 - aw * 8;
  ctx.save(); ctx.translate(15, hy); ctx.rotate(-aw * 0.15 + Math.sin(t * 1.7 + d.ph) * 0.02);
  // ears
  ctx.fillStyle = DOG.tanS; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.quadraticCurveTo(-10, -12 - aw * 3, -3, -10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = DOG.tan; ctx.beginPath(); ctx.moveTo(-1, -6); ctx.quadraticCurveTo(1, -15 - aw * 3, 5, -8); ctx.closePath(); ctx.fill();
  ell(ctx, 0, 0, 10, 8.4); ctx.fillStyle = DOG.b; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, 10, 8.4); ctx.clip(); ctx.fillStyle = DOG.tan; ell(ctx, -2, -5, 9, 5); ctx.fill(); ctx.fillStyle = DOG.s; ctx.globalAlpha = 0.7; crescent(ctx, 0, 0, 10, 8.4, -2, -2.5); ctx.globalAlpha = 1; ctx.restore();
  ell(ctx, 0, 0, 10, 8.4); ctx.strokeStyle = DOG.edge; ctx.lineWidth = 0.8; ctx.stroke();
  celEll(ctx, 7, 2.5, 5.6, 4, DOG.b, DOG.l, DOG.s, DOG.edge, 0.7);
  ctx.fillStyle = DOG.eye; ell(ctx, 11.6, 1.2, 1.7, 1.3); ctx.fill(); ctx.fillStyle = "#fff"; ell(ctx, 11.1, 0.7, 0.5, 0.4); ctx.fill();
  if (aw > 0.3) { ctx.fillStyle = DOG.eye; ell(ctx, 2.5, -1.5, 1.6, 2); ctx.fill(); ell(ctx, 7, -2, 1.3, 1.8); ctx.fill(); ctx.fillStyle = "#fff"; ell(ctx, 3, -2.2, 0.6, 0.6); ctx.fill(); }
  else { ctx.strokeStyle = DOG.eye; ctx.lineWidth = 0.9; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(2.6, -1.5, 2, 0.4, Math.PI - 0.4); ctx.moveTo(8.6, -2); ctx.arc(7, -2, 1.6, 0.4, Math.PI - 0.4); ctx.stroke(); }
  ctx.fillStyle = "rgba(240,140,140,.45)"; ell(ctx, 1, 3, 2, 1.2); ctx.fill();
  if (aw > 0.3) { ctx.strokeStyle = DOG.eye; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(7, 5); ctx.quadraticCurveTo(9, 4, 11, 5.2); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
// text bubble in screen pixels at world point
function bubble(ctx, x, y, z, text, a, col = "#4b4f6b", size = 15) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / z, 1 / z); ctx.globalAlpha = a;
  ctx.font = `800 ${size}px "PingFang SC","Noto Sans CJK SC",system-ui,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineJoin = "round"; ctx.strokeText(text, 0, 0); ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawBasket(ctx, b, t, glow) {
  ctx.save(); ctx.translate(b.x, b.y);
  shadow(ctx, 0.03, 0.03, 0.3, 0.09, 1);
  if (glow > 0) { ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.glow, 0, -0.08, 0.5, 0.4, 0.5 * glow); ctx.globalCompositeOperation = "source-over"; }
  const rx = 0.2, ry = 0.075, top = -0.12;
  ell(ctx, 0, top, rx, ry); ctx.fillStyle = "#4f3322"; ctx.fill();
  celEll(ctx, -0.07, top - 0.01, 0.06, 0.055, "#f2a6b4", "#ffd6de", "#c9748a", null);
  celEll(ctx, 0.07, top - 0.015, 0.055, 0.05, "#9fd0cf", "#d9f1ee", "#5e9aa3", null);
  celEll(ctx, 0.005, top + 0.02, 0.055, 0.05, "#fbf0d8", "#ffffff", "#cdb7a6", null);
  // body
  const body = () => { ctx.beginPath(); ctx.moveTo(-rx, top); ctx.bezierCurveTo(-rx, -0.02, -rx * 0.75, 0.02, 0, 0.02); ctx.bezierCurveTo(rx * 0.75, 0.02, rx, -0.02, rx, top); ctx.ellipse(0, top, rx, ry, 0, 0, Math.PI, false); ctx.closePath(); };
  body(); ctx.fillStyle = hGrad(ctx, "basket", -rx, rx, [[0, "#e0a964"], [0.35, "#e0a964"], [0.4, "#c18245"], [0.72, "#c18245"], [0.76, "#8e5a3a"], [1, "#8e5a3a"]]); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.strokeStyle = "rgba(90,50,30,.45)"; ctx.lineWidth = 0.006; ctx.beginPath();
  for (let i = -6; i <= 6; i++) { const x = i * 0.032; ctx.moveTo(x, top); ctx.quadraticCurveTo(x * 1.05, -0.04, x * 0.8, 0.03); } ctx.stroke();
  for (let r = 0; r < 4; r++) { const yy = top + 0.03 + r * 0.03; for (let i = -7; i <= 7; i++) { const x = i * 0.032 + (r % 2) * 0.016; ctx.fillStyle = (i + r) % 2 ? "rgba(255,220,160,.35)" : "rgba(80,40,20,.18)"; ell(ctx, x, yy + Math.abs(x) * 0.15, 0.014, 0.008); ctx.fill(); } }
  ctx.restore();
  ctx.lineWidth = 0.028; ctx.strokeStyle = "#a96f3c"; ctx.beginPath(); ctx.ellipse(0, top, rx, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.lineWidth = 0.01; ctx.strokeStyle = "#f2c784"; ctx.beginPath(); ctx.ellipse(0, top - 0.006, rx - 0.004, ry - 0.004, 0, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.lineWidth = 0.02; ctx.strokeStyle = "#8e5a3a"; ctx.beginPath(); ctx.ellipse(0, top, rx, ry, 0, Math.PI, TAU); ctx.stroke();
  ctx.restore();
}
function strain(ctx, x, y, k, t, flip) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * k})`; ctx.lineWidth = 0.01; ctx.lineCap = "round";
  const j = Math.sin(t * 40) * 0.006;
  ctx.beginPath(); ctx.moveTo(0.0, -0.02 + j); ctx.lineTo(0.05, -0.05 + j); ctx.moveTo(0.012, 0.02); ctx.lineTo(0.07, 0.01 - j); ctx.moveTo(0.0, 0.055); ctx.lineTo(0.05, 0.07 + j); ctx.stroke();
  // sweat drop
  const d = (t * 1.6) % 1; ctx.globalAlpha = 1 - d;
  ctx.fillStyle = "#bfe6ff"; ctx.beginPath(); ctx.moveTo(-0.06, -0.06 + d * 0.06); ctx.quadraticCurveTo(-0.035, -0.02 + d * 0.06, -0.06, -0.01 + d * 0.06); ctx.quadraticCurveTo(-0.085, -0.02 + d * 0.06, -0.06, -0.06 + d * 0.06); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}
// ================= PARTICLES =================
function drawParticle(ctx, p, z) {
  const a = clamp(p.life / (p.max || 1), 0, 1);
  if (p.k === "dust") { const r = p.r * (1.6 - a * 0.6); ctx.globalAlpha = a * 0.7; ctx.fillStyle = "#e9dcbf"; ell(ctx, p.x, p.y, r, r * 0.75); ctx.fill(); ctx.fillStyle = "#fff8e6"; ell(ctx, p.x - r * 0.25, p.y - r * 0.25, r * 0.5, r * 0.35); ctx.fill(); ctx.globalAlpha = 1; }
  else if (p.k === "spark") { ctx.globalAlpha = a; ctx.fillStyle = p.col; star(ctx, p.x, p.y, p.r * (0.5 + a * 0.5), 0.22, p.rot); ctx.globalAlpha = 1; }
  else if (p.k === "note") bubble(ctx, p.x, p.y, z, "♪", a, p.col, 20);
  else if (p.k === "leaf") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.col; ell(ctx, 0, 0, 0.022, 0.009); ctx.fill(); ctx.fillStyle = "rgba(255,255,220,.5)"; ell(ctx, -0.004, -0.003, 0.012, 0.003); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  else if (p.k === "fluff") { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.rot, p.rot + 2); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (p.k === "text") bubble(ctx, p.x, p.y - (1 - a) * 0.12, z, p.text, Math.min(1, a * 2), p.col, p.size || 15);
}
// ================= SCREEN OVERLAYS =================
let _post = null;
function postOverlay(W, H, DPR) {
  const key = W + "x" + H + "@" + DPR; if (_post && _post.key === key) return _post.c;
  const c = canvas(W * DPR, H * DPR), g = c.getContext("2d"); g.scale(DPR, DPR);
  let gr = g.createRadialGradient(-W * 0.2, -H * 0.15, 0, -W * 0.2, -H * 0.15, H * 1.0);
  gr.addColorStop(0, "rgba(255,236,170,.30)"); gr.addColorStop(0.5, "rgba(255,225,160,.10)"); gr.addColorStop(1, "rgba(255,225,160,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(0, H * 0.5, W, H); gr.addColorStop(0, "rgba(50,60,130,0)"); gr.addColorStop(1, "rgba(50,60,130,.1)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.42, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
  gr.addColorStop(0, "rgba(20,30,45,0)"); gr.addColorStop(1, "rgba(16,26,40,.34)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  _post = { key, c }; return c;
}
const motes = [];
function drawMotes(ctx, W, H, t, dt, cam, z, amount = 1) {
  if (!motes.length) for (let i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), ph: Math.random() * 6, d: 0.3 + Math.random() * 0.7 });
  ctx.globalCompositeOperation = "lighter";
  for (const m of motes) {
    m.y -= dt * 0.012 * m.d; m.x += dt * 0.008 * m.d; if (m.y < -0.05) m.y += 1.1; if (m.x > 1.05) m.x -= 1.1;
    const px = ((m.x * W - cam.x * z * 0.15 * m.d) % W + W) % W + Math.sin(t * 0.7 + m.ph) * 12, py = ((m.y * H - cam.y * z * 0.15 * m.d) % H + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + m.ph * 3), r = 6 * m.s;
    spr(ctx, SPR.glowW, px, py, r, r, (0.25 + 0.4 * tw) * amount * m.d);
  }
  ctx.globalCompositeOperation = "source-over";
}
function drawCloudShadows(ctx, v, t, B) {
  for (let i = 0; i < 4; i++) {
    const span = (B.x1 - B.x0) + 6, x = B.x0 - 3 + ((t * 0.05 + i * 0.27 * span + i * 3.1) % span), y = B.y0 + ((i * 3.7 + 1.3) % (B.y1 - B.y0)) + Math.sin(t * 0.02 + i) * 0.5;
    const r = 1.6 + (i % 2) * 0.7; if (x + r < v.x0 || x - r > v.x1 || y + r < v.y0 || y - r > v.y1) continue;
    spr(ctx, SPR.cloud, x, y, r * 1.3, r, 0.42);
  }
}
return { strain, Terrain, drawTufts, drawTallFlowers, drawWindStreak, drawRingWave, drawPost, drawBell, drawSpool, drawBall, drawKnot, drawYarn, drawCat, drawSleepingCat, drawDog, drawBasket, drawParticle, bubble, postOverlay, drawMotes, drawCloudShadows, shadow, spr, SPR, star, rng32, fbm, vnoise, ell, celEll, WIND, windAt };
})();
