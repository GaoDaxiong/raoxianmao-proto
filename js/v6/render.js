// 团绒 v6 — renderer: cel-shaded zone themes, procedural rock tiles, 团绒 with five ear forms, mechanisms, enemies, boss, darkness & fog.
(function (root) {
"use strict";
const TR = root.TR;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const THEME = {
  forest: { rock: ["#b7a07c", "#a28a67", "#c9b48f", "#7f6a4e"], top: "#6fae4a", top2: "#9ad06a", blade: "#b9e07f", edge: "#5b4a36", sky: ["#86c8ec", "#d6eef0", "#f3f0dc"], hills: ["#a9c5d8", "#97bcc4", "#86b48e"], trees: "#5f9467" },
  cave: { rock: ["#4f5d78", "#435069", "#64739a", "#2d3650"], top: "#4f9c8f", top2: "#7cc7b4", blade: "#9fe3cf", edge: "#1f2638", sky: ["#141b2c", "#1d2740", "#26324d"], hills: ["#222c45", "#29355a", "#303e66"], trees: "#1b2237" },
  garden: { rock: ["#a7b79f", "#93a48c", "#bfcdb6", "#6c7d68"], top: "#58b06a", top2: "#8bd88a", blade: "#b4ee9c", edge: "#4c5a48", sky: ["#8fd9e8", "#c9f0ea", "#eefbf0"], hills: ["#9bd2cf", "#7fc1b0", "#69ad8f"], trees: "#4f9a74" },
  windmill: { rock: ["#c9a46d", "#b58f59", "#dcbb86", "#8b6a3e"], top: "#b9b84e", top2: "#dbd774", blade: "#efe79a", edge: "#6d5332", sky: ["#8fc6ea", "#f6e2b4", "#fbd99a"], hills: ["#b9c4d6", "#c8b98f", "#b7a868"], trees: "#8c8a4a" },
  summit: { rock: ["#d3d8e6", "#bfc6d9", "#e8ecf6", "#8d96b4"], top: "#f4f6ff", top2: "#ffffff", blade: "#ffffff", edge: "#7d86a6", sky: ["#9fb2ec", "#d5ddf7", "#f3f5ff"], hills: ["#c4cdf0", "#d6dcf6", "#e6eafb"], trees: "#c3cbe9" },
};
TR.THEME = THEME;
const R = TR.R = { pats: {}, edges: null, bgW: {}, dark: null };
// ---------- procedural rock tiles (128px = 4 world units) ----------
function makePattern(ctx, th, key) {
  const N = 256, cv = document.createElement("canvas"); cv.width = cv.height = N; const c = cv.getContext("2d"), r = rng(key.length * 97 + 13);
  c.fillStyle = th.rock[0]; c.fillRect(0, 0, N, N);
  const wrap = (f) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { c.save(); c.translate(ox, oy); f(); c.restore(); } };
  // big cel-shaded blocks (lit top-left face + shadow bottom-right)
  for (let i = 0; i < 13; i++) { const x = r() * N, y = r() * N, w = 60 + r() * 70, h = 34 + r() * 40, k = r();
    wrap(() => { c.beginPath(); const pts = []; for (let j = 0; j < 7; j++) { const a = j / 7 * 6.283 + r() * .3; pts.push([x + Math.cos(a) * w / 2 * (0.8 + r() * .3), y + Math.sin(a) * h / 2 * (0.8 + r() * .3)]); }
      c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.closePath();
      c.fillStyle = k < .5 ? th.rock[1] : th.rock[0]; c.fill(); c.save(); c.clip(); c.fillStyle = th.rock[2]; c.globalAlpha = .45; c.beginPath(); c.ellipse(x - w * .2, y - h * .26, w * .38, h * .22, -.15, 0, 7); c.fill(); c.globalAlpha = 1; c.restore();
      c.strokeStyle = th.rock[3]; c.globalAlpha = .28; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1; }); }
  // cracks
  c.strokeStyle = th.rock[3]; c.globalAlpha = .22; c.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) { let x = r() * N, y = r() * N; wrap(() => { c.beginPath(); c.moveTo(x, y); let xx = x, yy = y; for (let k = 0; k < 4; k++) { xx += (r() - .5) * 18; yy += r() * 12; c.lineTo(xx, yy); } c.stroke(); }); }
  // speckles
  c.globalAlpha = 1; for (let i = 0; i < 90; i++) { const x = r() * N, y = r() * N; c.fillStyle = r() < .5 ? th.rock[3] : th.rock[2]; c.globalAlpha = .2; c.fillRect(x, y, 1.6 + r() * 1.6, 1.4 + r()); }
  c.globalAlpha = 1;
  if (key === "cave") for (let i = 0; i < 5; i++) { const x = r() * N, y = r() * N; c.fillStyle = "rgba(120,220,230,.5)"; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 3, y); c.lineTo(x, y + 4); c.lineTo(x - 3, y); c.fill(); }
  if (key === "garden" || key === "forest") for (let i = 0; i < 6; i++) { const x = r() * N, y = r() * N; c.fillStyle = "rgba(110,170,80,.35)"; c.beginPath(); c.ellipse(x, y, 7 + r() * 6, 3 + r() * 2, 0, 0, 7); c.fill(); }
  const pat = ctx.createPattern(cv, "repeat"); if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix([1 / 32, 0, 0, 1 / 32, 0, 0]));
  return pat;
}
function soilPattern(ctx) {
  const N = 64, cv = document.createElement("canvas"); cv.width = cv.height = N; const c = cv.getContext("2d"), r = rng(5);
  c.fillStyle = "#8a6440"; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 40; i++) { c.fillStyle = r() < .5 ? "#6f4e30" : "#a47a50"; c.beginPath(); c.arc(r() * N, r() * N, 1 + r() * 2.4, 0, 7); c.fill(); }
  c.strokeStyle = "#5a3e26"; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); const x = r() * N; c.moveTo(x, 0); c.quadraticCurveTo(x + 8, 30, x - 4, N); c.stroke(); }
  const pat = ctx.createPattern(cv, "repeat"); if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix([1 / 32, 0, 0, 1 / 32, 0, 0])); return pat;
}
TR.initArt = function (ctx) { for (const k in THEME) R.pats[k] = makePattern(ctx, THEME[k], k); R.soil = soilPattern(ctx); R.dark = document.createElement("canvas"); R.darkC = R.dark.getContext("2d"); };
// ---------- static edges (floors / ceilings / walls), precomputed once per level ----------
function zoneOf(L, x, y) { for (const z of L.zones) if (TR.inR(z.r, x, y)) return z.id; return "forest"; }
TR.zoneOf = zoneOf;
function sdStatic(L, x, y) {
  const G = TR.GRID, ix = Math.floor((x - G.GX) / G.CS), iy = Math.floor((y - G.GY) / G.CS); if (ix < 0 || iy < 0 || ix >= G.GW || iy >= G.GH) return -3;
  const c = L.grid[ix * G.GH + iy]; let d = -3; for (const s of c.air) { const e = -TR.sdShape(s, x, y); if (e > d) d = e; }
  for (const s of c.sol) if (s.mat === "rock") { const e = TR.sdShape(s, x, y); if (e < d) d = e; } return d;
}
TR.sdStatic = sdStatic;
function buildEdges(L) {
  const runs = [];
  const edgesOf = s => { const P = s.k === "box" ? [[s.b[0], s.b[1]], [s.b[2], s.b[1]], [s.b[2], s.b[3]], [s.b[0], s.b[3]]] : s.pts; const out = []; for (let i = 0; i < P.length; i++) out.push([P[i], P[(i + 1) % P.length]]); return out; };
  const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
  const handle = (s, isAir) => {
    const P = s.k === "box" ? [[s.b[0], s.b[1]], [s.b[2], s.b[1]], [s.b[2], s.b[3]], [s.b[0], s.b[3]]] : s.pts, cw = area(P) > 0; // y-down: >0 means clockwise on screen
    for (const [a, b] of edgesOf(s)) {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = hyp(dx, dy); if (len < .05) continue;
      let nx = dy / len, ny = -dx / len; if (!cw) { nx = -nx; ny = -ny; } // outward normal of the shape
      if (isAir) { nx = -nx; ny = -ny; } // normal pointing into the air
      const n = Math.max(2, Math.ceil(len / .3)); let cur = null;
      for (let i = 0; i <= n; i++) { const x = a[0] + dx * i / n, y = a[1] + dy * i / n;
        const ok = sdStatic(L, x + nx * .22, y + ny * .22) > .08 && sdStatic(L, x - nx * .22, y - ny * .22) < -.05;
        if (ok) { if (!cur) { cur = { pts: [], nx, ny, type: ny < -.6 ? "floor" : ny > .6 ? "ceil" : "wall", z: zoneOf(L, x + nx, y + ny) }; runs.push(cur); } cur.pts.push([x, y]); if (cur.pts.length > 26) { cur = { pts: [[x, y]], nx, ny, type: cur.type, z: cur.z }; runs.push(cur); } }
        else cur = null; }
    }
  };
  for (const s of L.air) handle(s, true);
  for (const s of L.solids) if (s.mat === "rock") handle(s, false);
  for (const r of runs) { let a = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of r.pts) { a[0] = Math.min(a[0], x); a[1] = Math.min(a[1], y); a[2] = Math.max(a[2], x); a[3] = Math.max(a[3], y); } r.bb = a; r.seed = (a[0] * 13.1 + a[1] * 7.7) % 1; }
  return runs.filter(r => r.pts.length > 1);
}
TR.buildEdges = L => (R.edges = buildEdges(L));
// fog blobs
function fogBlobs(f) { const r = rng(Math.floor(f.b[1] * 10 + 999)), out = []; const w = f.b[2] - f.b[0], h = f.b[3] - f.b[1]; for (let i = 0; i < w * h / 2.6; i++) out.push({ x: f.b[0] + r() * w, y: f.b[1] + r() * h, r: .9 + r() * 1.5, ph: r() * 6 }); return out; }
// ---------- helpers ----------
const vis = (bb, V, m) => bb[2] > V[0] - m && bb[0] < V[2] + m && bb[3] > V[1] - m && bb[1] < V[3] + m;
function pathShape(c, s) { c.beginPath(); if (s.k === "box") c.rect(s.b[0], s.b[1], s.b[2] - s.b[0], s.b[3] - s.b[1]); else { c.moveTo(s.pts[0][0], s.pts[0][1]); for (const q of s.pts) c.lineTo(q[0], q[1]); c.closePath(); } }
// ---------- backgrounds (screen space) ----------
function drawBg(c, th, cam, t, W, H, Z, alpha) {
  const T = THEME[th]; c.globalAlpha = alpha;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.sky[0]); g.addColorStop(.62, T.sky[1]); g.addColorStop(1, T.sky[2]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const layer = (k, base, amp, freq, col, seed, snow) => { const off = cam.x * Z * k, yb = H * base - (cam.y % 200) * Z * k * .12;
    c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W + 8; x += 10) { const u = (x + off) * freq; c.lineTo(x, yb - amp * (Math.sin(u + seed) * .5 + Math.sin(u * 2.3 + seed * 2) * .25 + Math.sin(u * .41 + seed) * .6)); } c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
    if (snow) { c.save(); c.clip(); c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(0, 0, W, yb - amp * .6); c.restore(); } };
  if (th === "cave") {
    c.fillStyle = "rgba(120,200,220,.05)"; for (let i = 0; i < 5; i++) { const x = ((i * 240 - cam.x * Z * .05) % (W + 240) + W + 240) % (W + 240) - 120; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x - 60, H); c.lineTo(x - 120, H); c.fill(); }
    layer(.06, .5, 60, .006, T.hills[0], 2); layer(.12, .72, 50, .01, T.hills[1], 4); layer(.2, .92, 40, .015, T.hills[2], 6);
    // hanging stalactite silhouettes + glowing crystals
    const off = cam.x * Z * .25; c.fillStyle = "#151b2b"; for (let i = -1; i < W / 50 + 2; i++) { const x = i * 50 - (off % 50), s = 30 + Math.abs(Math.sin((i + Math.floor(off / 50)) * 1.7)) * 70; c.beginPath(); c.moveTo(x - 14, 0); c.lineTo(x, s); c.lineTo(x + 14, 0); c.fill(); }
    for (let i = 0; i < 9; i++) { const x = ((i * 113 - cam.x * Z * .18) % W + W) % W, y = H * (.55 + (i % 3) * .12) - (cam.y % 50) * 2; const a = .35 + Math.sin(t * 1.5 + i) * .2; c.fillStyle = `rgba(120,230,220,${a})`; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.fill(); }
  } else {
    const sg = c.createRadialGradient(W * .78, H * .12, 0, W * .78, H * .12, H * .9); sg.addColorStop(0, th === "windmill" ? "rgba(255,240,200,.95)" : "rgba(255,250,225,.9)"); sg.addColorStop(.25, "rgba(255,246,210,.3)"); sg.addColorStop(1, "rgba(255,246,210,0)"); c.fillStyle = sg; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.75)"; for (let i = 0; i < 6; i++) { const x = ((i * 260 - cam.x * Z * .03 + t * 6) % (W + 300) + W + 300) % (W + 300) - 150, y = H * (.12 + (i % 3) * .08); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + k * 30, y + Math.sin(k) * 6, 40, 16, 0, 0, 7); c.fill(); } }
    if (th === "summit") {
      layer(.04, .78, 30, .006, "#e9edfb", 1); c.fillStyle = "#ffffff"; for (let i = 0; i < 14; i++) { const x = ((i * 90 - cam.x * Z * .1 + t * 4) % (W + 200) + W + 200) % (W + 200) - 100; c.beginPath(); c.ellipse(x, H * .86 + Math.sin(i) * 8, 70, 26, 0, 0, 7); c.fill(); }
      c.fillStyle = "#b7c2ea"; for (let i = 0; i < 3; i++) { const x = ((i * 380 - cam.x * Z * .08) % (W + 400) + W + 400) % (W + 400) - 200, y = H * (.4 + i * .1); c.beginPath(); c.moveTo(x - 50, y); c.lineTo(x + 50, y); c.lineTo(x + 20, y + 40); c.lineTo(x - 10, y + 30); c.fill(); c.fillStyle = "#eef1ff"; c.fillRect(x - 50, y - 6, 100, 7); c.fillStyle = "#b7c2ea"; }
    } else {
      layer(.04, .55, 70, .004, T.hills[0], 1, th !== "garden"); layer(.09, .68, 50, .007, T.hills[1], 3); layer(.18, .8, 40, .011, T.hills[2], 5);
      if (th === "windmill") { for (let i = 0; i < 4; i++) { const x = ((i * 300 - cam.x * Z * .14) % (W + 300) + W + 300) % (W + 300) - 150, y = H * .66; c.fillStyle = "#9d8a62"; c.fillRect(x - 6, y - 50, 12, 50); c.save(); c.translate(x, y - 50); c.rotate(t * .8 + i); c.fillStyle = "#efe0bd"; for (let k = 0; k < 4; k++) { c.rotate(1.5708); c.fillRect(-3, 0, 6, 40); c.fillRect(1, 8, 12, 30); } c.restore(); } }
      if (th === "garden") { c.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 3; i++) { const x = ((i * 330 - cam.x * Z * .12) % (W + 300) + W + 300) % (W + 300) - 150; c.fillRect(x, 0, 18 + i * 6, H * .8); } }
      const off = cam.x * Z * .3, yb = H * .9; c.fillStyle = T.trees;
      for (let i = -2; i < W / 34 + 3; i++) { const x = i * 34 - (off % 34), s = 18 + Math.abs(Math.sin((i + Math.floor(off / 34)) * 2.1)) * 18; c.beginPath(); c.ellipse(x, yb - s, s * .55, s, 0, 0, 7); c.fill(); }
      c.fillRect(0, yb - 4, W, H);
    }
    c.save(); c.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const x = W * (.55 + i * .12) + Math.sin(t * .2 + i) * 20; c.fillStyle = "rgba(255,248,220,.04)"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 0); c.lineTo(x - 140, H); c.lineTo(x - 260, H); c.fill(); } c.restore();
  }
  c.globalAlpha = 1;
}
// ---------- edges ----------
function strokeRun(c, r, off) { const P = r.pts; c.beginPath(); for (let i = 0; i < P.length; i++) { const x = P[i][0] - r.nx * off, y = P[i][1] - r.ny * off; i ? c.lineTo(x, y) : c.moveTo(x, y); } }
function drawEdgeBands(c, V) { // ambient-occlusion band + rim on the rock side
  c.lineCap = "round"; c.lineJoin = "round";
  for (const r of R.edges) { if (!vis(r.bb, V, 1)) continue; const T = THEME[r.z];
    c.strokeStyle = T.edge; c.globalAlpha = .42; c.lineWidth = .9; strokeRun(c, r, .45); c.stroke();
    c.globalAlpha = .9; c.lineWidth = .12; c.strokeStyle = r.type === "floor" ? T.rock[2] : T.rock[3]; strokeRun(c, r, .06); c.stroke(); }
  c.globalAlpha = 1;
}
function drawEdgeDeco(c, V, t) {
  for (const r of R.edges) { if (!vis(r.bb, V, 1)) continue; const T = THEME[r.z], P = r.pts;
    if (r.type === "floor") {
      c.beginPath(); c.moveTo(P[0][0], P[0][1] + .3); for (const q of P) c.lineTo(q[0], q[1] + .3 + Math.sin(q[0] * 5.1) * .06); for (let i = P.length - 1; i >= 0; i--) c.lineTo(P[i][0], P[i][1] - .05); c.closePath();
      c.fillStyle = T.top; c.fill();
      c.strokeStyle = T.top2; c.lineWidth = .12; c.beginPath(); c.moveTo(P[0][0], P[0][1] - .02); for (const q of P) c.lineTo(q[0], q[1] - .02); c.stroke();
      c.fillStyle = T.blade; for (let i = 0; i < P.length; i++) { const [x, y] = P[i], hgt = .2 + Math.abs(Math.sin(x * 12.7)) * .28, sw = Math.sin(t * 1.6 + x * .8) * .06; if (r.z === "summit") { if (i % 3 === 0) { c.beginPath(); c.arc(x, y - .05, .18 + Math.abs(Math.sin(x * 3)) * .12, 0, 7); c.fill(); } continue; } if (r.z === "cave" && i % 4) continue; c.beginPath(); c.moveTo(x - .06, y); c.quadraticCurveTo(x + sw * .5, y - hgt * .6, x + sw, y - hgt); c.quadraticCurveTo(x + sw * .5 + .02, y - hgt * .5, x + .06, y); c.fill(); }
      if (r.z === "garden" || r.z === "forest") for (let i = 2; i < P.length; i += 7) { const [x, y] = P[i], col = (x * 3.3 % 1) < .5 ? "#fff6d8" : (x * 7.1 % 1) < .5 ? "#c9e0ff" : "#ffe28a"; c.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k * 1.256 + x; c.beginPath(); c.arc(x + Math.cos(a) * .07, y - .32 + Math.sin(a) * .07, .055, 0, 7); c.fill(); } c.fillStyle = "#f2c94c"; c.beginPath(); c.arc(x, y - .32, .04, 0, 7); c.fill(); }
      if (r.z === "cave") for (let i = 1; i < P.length; i += 5) { const [x, y] = P[i], a = .5 + Math.sin(t * 2 + x) * .3; c.fillStyle = `rgba(140,240,220,${a})`; c.beginPath(); c.ellipse(x, y - .12, .1, .14, 0, 0, 7); c.fill(); }
    } else if (r.type === "ceil") {
      c.fillStyle = "rgba(30,25,20,.25)"; c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (const q of P) c.lineTo(q[0], q[1]); for (let i = P.length - 1; i >= 0; i--) c.lineTo(P[i][0], P[i][1] + .18); c.fill();
      for (let i = 0; i < P.length; i += 3) { const [x, y] = P[i], L = .4 + Math.abs(Math.sin(x * 3.3)) * 1.1;
        if (r.z === "cave") { c.fillStyle = THEME.cave.rock[1]; c.beginPath(); c.moveTo(x - .14, y); c.lineTo(x, y + L * .8); c.lineTo(x + .14, y); c.fill(); }
        else if (r.z === "summit") { c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(x, y + .1, .2, 0, 7); c.fill(); }
        else { c.strokeStyle = r.z === "windmill" ? "#a39a4a" : "#5f9a4a"; c.lineWidth = .06; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(t + x) * .12, y + L / 2, x, y + L); c.stroke(); c.fillStyle = r.z === "windmill" ? "#cfc66a" : "#86c06a"; c.beginPath(); c.ellipse(x + .06, y + L, .09, .05, .5, 0, 7); c.fill(); } }
    } else { c.strokeStyle = "rgba(255,245,220,.3)"; c.lineWidth = .1; strokeRun(c, r, -.02); c.stroke(); }
  }
}
// ---------- 团绒 ----------
const COL = { fur: "#E6E4E2", furS: "#C9C5C2", furD: "#A9A4A1", line: "#6f6764", tip: "#9EC3EA", tipD: "#6f9fd0", eye: "#4a2c1c", eye2: "#8a5434" };
function drawTuan(c, p, t, s, ab) {
  s = s || 1; const A = ab ? TR.ABIL[ab] : null;
  const sq = p.sq || 1, f = p.face || 1, gl = clamp(p.ear || 0, -.2, 1.25);
  c.save(); c.translate(p.x, p.y + .45); c.scale(s / Math.sqrt(sq), s * sq); c.translate(0, -.45);
  const tilt = p.ground && p.gn ? clamp((p.gs || 0) * .012, -.1, .1) + Math.atan2(p.gn.x, -p.gn.y) * .5 : clamp((p.vx || 0) * .02, -.15, .15);
  c.rotate(tilt + (p.drill > 0 ? Math.sin(p.spin || 0) * .25 : 0));
  const Rr = .45, flap = Math.sin(t * 13) * .12 * gl;
  const tipC = A ? A.col : COL.tip, tipD = A ? A.col2 : COL.tipD;
  const drawEar = (side) => {
    c.save(); c.translate(side * .2, -.3);
    let a = side * (lerp(.32, 1.62, gl) + flap) + (p.ground ? Math.sin(p.walk * 3) * .05 * side : (!gl ? clamp(p.vy * .025, -.3, .25) * side : 0)) + Math.sin(t * 1.7 + side) * .03;
    if (ab === "drill") a = side * (p.drill > 0 ? -2.6 : .12) + Math.sin(t * 2 + side) * .03; // drill ears point up (or down while drilling)
    if (ab === "spring") a = side * (.18 + Math.sin(t * 3 + side) * .05 + (p.ground ? 0 : clamp(-p.vy * .02, -.2, .3)));
    c.rotate(-a);
    let Lh = lerp(.62, .82, gl), w = lerp(.17, .22, gl);
    if (ab === "drill") { Lh = .72; w = .2; c.rotate(Math.PI); c.translate(0, .1);
      c.beginPath(); c.moveTo(-w, 0); c.lineTo(0, Lh); c.lineTo(w, 0); c.closePath(); c.fillStyle = COL.fur; c.fill(); c.save(); c.clip();
      c.strokeStyle = A.col2; c.lineWidth = .07; for (let k = 0; k < 5; k++) { const yy = ((k * .17 + (p.drill > 0 ? t * 3 : t * .3)) % .85); c.beginPath(); c.moveTo(-w, yy); c.lineTo(w, yy + .12); c.stroke(); }
      c.fillStyle = A.col; c.fillRect(-w, Lh * .62, w * 2, Lh); c.restore(); c.lineWidth = .03; c.strokeStyle = COL.line; c.beginPath(); c.moveTo(-w, 0); c.lineTo(0, Lh); c.lineTo(w, 0); c.stroke(); c.restore(); return; }
    if (ab === "spring") { // coiled ear
      c.strokeStyle = COL.furS; c.lineWidth = .16; c.lineCap = "round"; c.beginPath(); c.moveTo(0, 0); const coils = 4, Ls = .5 + (p.ground ? 0 : .15) + (p.landT > 0 ? -.12 : 0);
      for (let k = 0; k <= coils * 6; k++) { const u = k / (coils * 6); c.lineTo(Math.sin(u * coils * 6.283) * .13, u * Ls); } c.stroke();
      c.strokeStyle = COL.fur; c.lineWidth = .1; c.stroke();
      c.fillStyle = A.col; c.beginPath(); c.arc(0, Ls + .08, .12, 0, 7); c.fill(); c.lineWidth = .03; c.strokeStyle = COL.line; c.stroke(); c.restore(); return; }
    if (ab === "umb") { Lh = lerp(.66, .9, gl); w = lerp(.2, .34, gl); }
    c.beginPath(); c.moveTo(-w * .55, 0); c.bezierCurveTo(-w * 1.2, Lh * .5, -w * .7, Lh, 0, Lh + .02); c.bezierCurveTo(w * .7, Lh, w * 1.2, Lh * .5, w * .55, 0); c.closePath();
    c.fillStyle = COL.fur; c.fill(); c.save(); c.clip();
    c.fillStyle = COL.furS; c.fillRect(side * w * .1, -.1, w * 2, Lh * 1.3);
    c.fillStyle = "#F4F1EE"; c.beginPath(); c.ellipse(-side * w * .1, Lh * .45, w * .32, Lh * .3, 0, 0, 7); c.fill();
    c.fillStyle = tipC; c.fillRect(-w * 2, Lh * (ab === "umb" ? .55 : .7), w * 4, Lh); c.fillStyle = tipD; c.fillRect(side * w * .15, Lh * (ab === "umb" ? .55 : .7), w * 2, Lh);
    if (ab === "umb") { c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = .025; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(0, .05); c.lineTo(k * w * .8, Lh); c.stroke(); } }
    c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(-w * 2, Lh * .7, w * 4, .025);
    c.restore(); c.lineWidth = .03; c.strokeStyle = COL.line; c.stroke();
    if (ab === "lamp") { const gx = 0, gy = Lh + .06, gg = c.createRadialGradient(gx, gy, 0, gx, gy, .45); gg.addColorStop(0, "rgba(255,240,170,.9)"); gg.addColorStop(1, "rgba(255,220,120,0)"); c.fillStyle = gg; c.beginPath(); c.arc(gx, gy, .45, 0, 7); c.fill(); c.fillStyle = "#fff4c4"; c.beginPath(); c.arc(gx, gy, .1, 0, 7); c.fill(); }
    if (ab === "bell") { c.translate(0, Lh + .02); c.rotate(Math.sin(t * 6 + side) * .25); c.fillStyle = "#e9c46a"; c.beginPath(); c.moveTo(-.11, .14); c.quadraticCurveTo(-.12, -.02, 0, -.04); c.quadraticCurveTo(.12, -.02, .11, .14); c.closePath(); c.fill(); c.lineWidth = .025; c.strokeStyle = "#8a6a2a"; c.stroke(); c.fillStyle = "#8a6a2a"; c.beginPath(); c.arc(0, .15, .035, 0, 7); c.fill(); c.fillStyle = A.col; c.fillRect(-.12, -.06, .24, .04); }
    c.restore();
  };
  const behind = gl > .4 && ab !== "drill" && ab !== "spring";
  if (behind) { drawEar(-1); drawEar(1); }
  // tail
  c.save(); c.translate(-f * .41, .14 + Math.sin(t * 4) * .015);
  c.beginPath(); c.arc(0, 0, .13, 0, 7); c.fillStyle = COL.fur; c.fill(); c.lineWidth = .028; c.strokeStyle = COL.line; c.stroke();
  c.beginPath(); c.arc(-f * .04, .02, .075, 0, 7); c.fillStyle = tipC; c.fill(); c.restore();
  // fuzzy body
  c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = Rr * (1 + .035 * Math.sin(a * 11 + 1.3) + .015 * Math.sin(a * 23)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .96; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
  c.fillStyle = COL.furS; c.fill(); c.save(); c.clip();
  c.fillStyle = COL.fur; c.beginPath(); c.arc(-.07, -.07, Rr * .93, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,.75)"; c.beginPath(); c.ellipse(-.17, -.24, .14, .07, -.5, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 7; i++) { const a = -2.4 + i * .3; c.beginPath(); c.arc(Math.cos(a) * Rr * .86, Math.sin(a) * Rr * .86, .03, 0, 7); c.fill(); }
  { const g = c.createLinearGradient(0, .1, 0, Rr); g.addColorStop(0, "rgba(120,140,170,0)"); g.addColorStop(1, "rgba(120,140,170,.16)"); c.fillStyle = g; c.fillRect(-Rr, .1, Rr * 2, Rr); }
  c.restore(); c.lineWidth = .032; c.strokeStyle = COL.line; c.stroke();
  // feet: two soft bean paws tucked under the front of the body (no outline ring)
  const wk = p.ground ? Math.sin(p.walk * 3) : 0, air = p.ground ? 0 : 1;
  for (const sd of [-1, 1]) { const fx = sd * .16 + f * .05 + wk * .07 * sd, fy = Rr * .93 - Math.max(0, wk * sd) * .06 + air * .02;
    c.beginPath(); c.ellipse(fx, fy, .12, .075, 0, 0, 7); c.fillStyle = "#E4E0DC"; c.fill();
    c.beginPath(); c.ellipse(fx, fy, .12, .075, 0, .15, Math.PI - .15); c.lineWidth = .026; c.strokeStyle = COL.line; c.stroke();
    c.fillStyle = "rgba(255,255,255,.6)"; c.beginPath(); c.ellipse(fx - .02, fy - .025, .06, .022, 0, 0, 7); c.fill();
    c.strokeStyle = "rgba(111,103,100,.6)"; c.lineWidth = .018; c.beginPath(); c.moveTo(fx - .035, fy + .02); c.lineTo(fx - .035, fy + .06); c.moveTo(fx + .035, fy + .02); c.lineTo(fx + .035, fy + .06); c.stroke(); }
  // face
  const ex = f * .07, blink = p.blink < 0, happy = p.happy || 0, ouch = p.hurt > .5;
  for (const sd of [-1, 1]) {
    const x = ex + sd * .155, y = -.03;
    if (ouch) { c.beginPath(); c.moveTo(x - .05, y - .04); c.lineTo(x + .05, y + .01); c.moveTo(x - .05, y + .04); c.lineTo(x + .05, y - .01); c.lineWidth = .035; c.strokeStyle = COL.eye; c.lineCap = "round"; c.stroke(); continue; }
    if (blink || happy) { c.beginPath(); c.arc(x, y + .02, .06, Math.PI * 1.1, Math.PI * 1.9); c.lineWidth = .035; c.strokeStyle = COL.eye; c.lineCap = "round"; c.stroke(); continue; }
    c.beginPath(); c.ellipse(x, y, .085, .112, 0, 0, 7); c.fillStyle = COL.eye; c.fill();
    c.save(); c.clip(); c.fillStyle = COL.eye2; c.beginPath(); c.ellipse(x, y + .075, .08, .06, 0, 0, 7); c.fill(); c.restore();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(x - .028 + f * .01, y - .045, .034, 0, 7); c.fill(); c.beginPath(); c.arc(x + .03, y + .04, .015, 0, 7); c.fill();
  }
  c.fillStyle = "rgba(158,195,234,.28)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(ex + sd * .25, .1, .06, .03, 0, 0, 7); c.fill(); }
  c.beginPath(); const my = .11; if (p.puffT > 0 || ouch) { c.ellipse(ex + f * .02, my + .01, .03, .035, 0, 0, 7); c.fillStyle = COL.eye; c.fill(); }
  else { c.moveTo(ex - .04, my); c.quadraticCurveTo(ex - .02, my + .03, ex, my + .005); c.quadraticCurveTo(ex + .02, my + .03, ex + .04, my); c.lineWidth = .024; c.strokeStyle = "#5a3a2e"; c.lineCap = "round"; c.stroke(); }
  if (!behind) { drawEar(-1); drawEar(1); }
  c.restore();
}
TR.drawTuan = drawTuan;
// ---------- small art ----------
function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace("A", a)); g.addColorStop(1, col.replace("A", 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function drawWisp(c, w, t) { const bob = Math.sin(t * 2.2 + w.ph) * .1, x = w.x, y = w.y + bob; glow(c, x, y, .6, "rgba(190,230,250,A)", .55); c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, .1 + Math.sin(t * 7 + w.ph) * .015, 0, 7); c.fill(); }
function abilityIcon(c, ab, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col || "#4e5a66"; c.fillStyle = col || "#4e5a66"; c.lineWidth = .14; c.lineCap = "round"; c.lineJoin = "round";
  if (ab === "drill") { c.beginPath(); c.moveTo(-.45, -.5); c.lineTo(.45, -.5); c.lineTo(0, .6); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-.3, -.2); c.lineTo(.3, -.05); c.moveTo(-.17, .12); c.lineTo(.17, .25); c.stroke(); }
  else if (ab === "lamp") { c.beginPath(); c.arc(0, -.1, .38, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-.15, .38); c.lineTo(.15, .38); c.moveTo(-.1, .55); c.lineTo(.1, .55); c.stroke(); for (let k = 0; k < 5; k++) { const a = -2.6 + k * .55; c.beginPath(); c.moveTo(Math.cos(a) * .55, -.1 + Math.sin(a) * .55); c.lineTo(Math.cos(a) * .72, -.1 + Math.sin(a) * .72); c.stroke(); } }
  else if (ab === "umb") { c.beginPath(); c.moveTo(-.65, .05); c.quadraticCurveTo(0, -.85, .65, .05); c.quadraticCurveTo(.43, -.1, .22, .05); c.quadraticCurveTo(0, -.1, -.22, .05); c.quadraticCurveTo(-.43, -.1, -.65, .05); c.stroke(); c.beginPath(); c.moveTo(0, -.05); c.lineTo(0, .55); c.quadraticCurveTo(0, .7, -.15, .62); c.stroke(); }
  else if (ab === "spring") { c.beginPath(); c.moveTo(-.4, .6); c.lineTo(.4, .6); c.stroke(); c.beginPath(); for (let k = 0; k <= 24; k++) { const u = k / 24; c.lineTo(Math.sin(u * 4 * 6.283) * .3, .5 - u * 1.0); } c.stroke(); c.beginPath(); c.moveTo(-.4, -.55); c.lineTo(.4, -.55); c.stroke(); }
  else if (ab === "bell") { c.beginPath(); c.moveTo(-.45, .35); c.quadraticCurveTo(-.45, -.45, 0, -.5); c.quadraticCurveTo(.45, -.45, .45, .35); c.closePath(); c.stroke(); c.beginPath(); c.arc(0, .5, .1, 0, 7); c.fill(); c.beginPath(); c.moveTo(-.65, -.1); c.quadraticCurveTo(-.8, .1, -.65, .3); c.moveTo(.65, -.1); c.quadraticCurveTo(.8, .1, .65, .3); c.stroke(); }
  else { c.beginPath(); c.moveTo(-.55, -.2); c.quadraticCurveTo(.1, -.35, .4, -.1); c.moveTo(-.55, .1); c.quadraticCurveTo(.2, 0, .55, .25); c.moveTo(-.4, .4); c.quadraticCurveTo(0, .35, .2, .5); c.stroke(); }
  c.restore();
}
TR.abilityIcon = abilityIcon;
function drawAbWisp(c, w, t) { const A = TR.ABIL[w.ab], bob = Math.sin(t * 2.2) * .12, x = w.x, y = w.y + bob;
  glow(c, x, y, 1.15, A.col.replace("#", "") && hexA(A.col), .65); c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, .3, 0, 7); c.fill(); c.lineWidth = .06; c.strokeStyle = A.col2; c.stroke();
  abilityIcon(c, w.ab, x, y, .32, A.col2);
  c.strokeStyle = A.col; c.lineWidth = .05; for (let i = 0; i < 6; i++) { const a = t * 1.2 + i * 1.047; c.beginPath(); c.arc(x + Math.cos(a) * .55, y + Math.sin(a) * .55, .05, 0, 7); c.stroke(); } }
function hexA(h) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},A)`; }
function drawGem(c, g, t) { const y = g.y + Math.sin(t * 2) * .1; glow(c, g.x, y, .9, "rgba(150,200,255,A)", .5); c.fillStyle = "#8fb8ee"; c.beginPath(); c.arc(g.x, y, .3, 0, 7); c.fill(); c.strokeStyle = "#5f86c4"; c.lineWidth = .04; for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(g.x, y, .3, .12 + Math.abs(k) * .1, k * .7, 0, 7); c.stroke(); } c.fillStyle = "rgba(255,255,255,.8)"; c.beginPath(); c.arc(g.x - .1, y - .1, .07, 0, 7); c.fill(); }
function drawShroom(c, m, t) {
  const sq = m.sq || 0; c.save(); c.translate(m.x, m.y); const inh = m.st === "inhale" ? sq : 0, snz = m.st === "sneeze";
  c.scale(1 + inh * .25 - (snz ? .1 : 0), 1 + inh * .12 + (snz ? .1 : 0));
  c.fillStyle = "#efe6cf"; c.strokeStyle = "#6b5a44"; c.lineWidth = .04;
  c.beginPath(); c.moveTo(-.28, 0); c.quadraticCurveTo(-.32, -.4, -.2, -.65); c.lineTo(.2, -.65); c.quadraticCurveTo(.32, -.4, .28, 0); c.closePath(); c.fill(); c.stroke();
  // face on the stem
  const f = m.face; c.strokeStyle = "#4a3a2a"; c.lineWidth = .035; c.lineCap = "round";
  for (const sd of [-1, 1]) { const x = sd * .09 + f * .05; c.beginPath(); if (snz) { c.moveTo(x - .04, -.4); c.lineTo(x + .04, -.36); } else if (m.st === "sleep") c.arc(x, -.4, .035, .2, Math.PI - .2); else { c.arc(x, -.39, .03, 0, 7); } c.stroke(); }
  if (snz) { c.fillStyle = "#4a3a2a"; c.beginPath(); c.ellipse(f * .08, -.22, .05, .06, 0, 0, 7); c.fill(); }
  c.beginPath(); c.moveTo(-1.05, -.6); c.quadraticCurveTo(-1, -1.45, 0, -1.5); c.quadraticCurveTo(1, -1.45, 1.05, -.6); c.quadraticCurveTo(0, -.42, -1.05, -.6); c.fillStyle = "#4fa7a0"; c.fill(); c.strokeStyle = "#2f6b66"; c.lineWidth = .045; c.stroke();
  c.save(); c.clip(); c.fillStyle = "#3a8a86"; c.beginPath(); c.ellipse(.38, -.6, 1, .38, 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-.38, -1.24, .38, .1, -.3, 0, 7); c.fill(); c.restore();
  c.fillStyle = "#f6f1df"; for (const [x, y, r] of [[-.55, -.95, .13], [.1, -1.22, .11], [.55, -.88, .14], [-.12, -.82, .08]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.restore();
  if (m.st === "sleep") { c.fillStyle = "rgba(255,255,255,.85)"; c.font = "bold .34px sans-serif"; const k = (t * .5) % 1; c.globalAlpha = 1 - k; c.fillText("z", m.x + .6, m.y - 1.6 - k * .6); c.globalAlpha = 1; }
  if (m.st === "inhale") { c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = .04; for (let i = 0; i < 3; i++) { const k = (t * 3 + i / 3) % 1, x = m.x + m.face * (2.2 - k * 1.6); c.beginPath(); c.moveTo(x, m.y - .9 + (i - 1) * .3); c.lineTo(x + m.face * .3, m.y - .9 + (i - 1) * .3); c.stroke(); } }
}
function drawSpike(c, b, t) { c.save(); c.translate(b.x, b.y); c.rotate(b.rot);
  c.fillStyle = "#8a5a32"; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(Math.cos(a - .18) * .3, Math.sin(a - .18) * .3); c.lineTo(Math.cos(a) * .52, Math.sin(a) * .52); c.lineTo(Math.cos(a + .18) * .3, Math.sin(a + .18) * .3); c.fill(); }
  c.beginPath(); c.arc(0, 0, .34, 0, 7); c.fillStyle = "#b07a44"; c.fill(); c.strokeStyle = "#6a4426"; c.lineWidth = .035; c.stroke(); c.restore();
  c.fillStyle = "#3b2414"; for (const sd of [-1, 1]) { c.beginPath(); c.arc(b.x + sd * .1, b.y - .03, .04, 0, 7); c.fill(); } c.fillStyle = "rgba(255,170,150,.0)"; }
function drawCrow(c, cr, t) { const d = cr.st === "dive", fl = Math.sin(t * (d ? 20 : 8)) * .5; c.save(); c.translate(cr.x, cr.y); const face = (TR.getS().p.x > cr.x) ? 1 : -1; c.scale(face, 1);
  glow(c, 0, 0, 1.1, "rgba(40,20,70,A)", .35);
  for (const sd of [-1, 1]) { c.save(); c.rotate(sd * (.3 + fl * .6)); c.beginPath(); c.moveTo(0, -.05); c.quadraticCurveTo(sd * .1 - .6, -.5, -.95, -.1); c.quadraticCurveTo(-.6, .05, -.1, .1); c.fillStyle = "#2a2340"; c.fill(); c.restore(); }
  c.beginPath(); c.ellipse(0, 0, .42, .34, 0, 0, 7); c.fillStyle = "#3a3158"; c.fill(); c.strokeStyle = "#1a1528"; c.lineWidth = .03; c.stroke();
  c.fillStyle = "#e7c86a"; c.beginPath(); c.moveTo(.36, -.02); c.lineTo(.6, .05); c.lineTo(.36, .1); c.fill();
  c.fillStyle = cr.st === "flee" || cr.st === "rest" ? "#fff" : "#ffd76a"; c.beginPath(); c.arc(.18, -.08, .07, 0, 7); c.fill(); c.restore(); }
function drawThief(c, th, t) { c.save(); c.translate(th.x, th.y); c.scale(th.face || 1, 1); const run = th.st === "flee" || th.st === "steal", bob = run ? Math.abs(Math.sin(t * 16)) * .08 : 0;
  // bushy striped tail
  c.save(); c.translate(-.35, -.45 - bob); c.rotate(-.6 + Math.sin(t * (run ? 14 : 3)) * .2); c.beginPath(); c.ellipse(-.3, -.1, .42, .2, -.3, 0, 7); c.fillStyle = "#4b5b8a"; c.fill(); c.save(); c.clip(); c.fillStyle = "#e9e4da"; for (let k = 0; k < 3; k++) c.fillRect(-.7 + k * .26, -.5, .1, 1); c.restore(); c.restore();
  c.beginPath(); c.ellipse(0, -.42 - bob, .42, .34, 0, 0, 7); c.fillStyle = "#56679b"; c.fill(); c.strokeStyle = "#2f3a60"; c.lineWidth = .03; c.stroke();
  c.fillStyle = "#e9e4da"; c.beginPath(); c.ellipse(.2, -.32 - bob, .2, .14, 0, 0, 7); c.fill();
  c.fillStyle = "#2a2f4a"; c.beginPath(); c.ellipse(.15, -.5 - bob, .26, .08, 0, 0, 7); c.fill(); // mask
  c.fillStyle = th.st === "dizzy" ? "#fff" : "#ffe08a"; for (const x of [.06, .26]) { c.beginPath(); c.arc(x, -.5 - bob, .04, 0, 7); c.fill(); }
  for (const x of [-.12, .12]) { c.beginPath(); c.moveTo(x - .08, -.7 - bob); c.lineTo(x, -.9 - bob); c.lineTo(x + .08, -.7 - bob); c.fillStyle = "#56679b"; c.fill(); }
  c.restore();
  if (th.carry) { glow(c, th.x - (th.face || 1) * .5, th.y - .9, .5, "rgba(200,240,255,A)", .7); c.fillStyle = "#fff"; c.beginPath(); c.arc(th.x - (th.face || 1) * .5, th.y - .9, .1, 0, 7); c.fill(); }
  if (th.st === "dizzy") { c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = .04; c.beginPath(); c.ellipse(th.x, th.y - 1.05, .3, .1, 0, 0, 7); c.stroke(); }
  if (th.st === "sulk") { c.fillStyle = "rgba(255,255,255,.8)"; c.font = "bold .3px sans-serif"; c.fillText("z", th.x + .3, th.y - 1 - (t * .5 % 1) * .3); } }
function drawIcicle(c, i, t) { if (i.st === "gone") return; const sh = i.st === "shake" ? Math.sin(t * 60) * .05 : 0, y = i.st === "fall" ? i.fy : i.y;
  c.fillStyle = "rgba(200,235,255,.9)"; c.strokeStyle = "#7fb2d8"; c.lineWidth = .04; c.beginPath(); c.moveTo(i.x - .28 + sh, y); c.lineTo(i.x + sh, y + 1.2); c.lineTo(i.x + .28 + sh, y); c.closePath(); c.fill(); c.stroke(); c.fillStyle = "rgba(255,255,255,.8)"; c.fillRect(i.x - .12 + sh, y + .05, .05, .5); }
function drawBell(c, b, t) { const sw = Math.sin(t * 9) * b.sw * .6 + Math.sin(t * 1.3 + b.x) * .05; c.save(); c.translate(b.x, b.y - .9);
  c.strokeStyle = "#8a6a4a"; c.lineWidth = .05; c.beginPath(); c.moveTo(-.5, 0); c.lineTo(.5, 0); c.stroke(); c.rotate(sw);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, .2); c.stroke();
  c.beginPath(); c.moveTo(-.34, .85); c.quadraticCurveTo(-.36, .22, 0, .2); c.quadraticCurveTo(.36, .22, .34, .85); c.closePath(); c.fillStyle = b.rung ? "#f3d98a" : "#c9b3ff"; c.fill(); c.strokeStyle = "#6f5aa8"; c.lineWidth = .04; c.stroke();
  c.fillStyle = "#6f5aa8"; c.beginPath(); c.arc(0, .9, .08, 0, 7); c.fill();
  c.strokeStyle = "#9ec3ea"; c.lineWidth = .06; c.beginPath(); c.moveTo(0, .95); c.quadraticCurveTo(.15 + Math.sin(t * 3) * .1, 1.3, .05, 1.6); c.stroke(); c.restore();
  if (!b.rung) { const a = .3 + Math.sin(t * 3) * .2; glow(c, b.x, b.y - .3, 1.2, "rgba(200,190,255,A)", a); } }
function drawLantern(c, l, t) { c.strokeStyle = "#5a4a3a"; c.lineWidth = .05; c.beginPath(); c.moveTo(l.x, l.y - 1.2); c.lineTo(l.x, l.y - .3); c.stroke(); glow(c, l.x, l.y, 1.6, "rgba(255,210,120,A)", .45 + Math.sin(t * 5 + l.x) * .05); c.fillStyle = "#ffcf7a"; c.fillRect(l.x - .18, l.y - .3, .36, .5); c.strokeStyle = "#6b4a2c"; c.strokeRect(l.x - .18, l.y - .3, .36, .5); }
function drawBoss(c, B, t, L) {
  if (B.dead && B.popT > 2) return;
  if (!B.dead && L.fog.every(f => f.cleared)) for (let i = 0; i < 3; i++) { c.fillStyle = i < B.hp ? "#a9b8ff" : "rgba(90,100,140,.35)"; c.beginPath(); c.arc(B.x - .6 + i * .6, B.y - 2.6, .18, 0, 7); c.fill(); } const k = B.dead ? Math.max(0, 1 - B.popT / 2) : 1, hurt = B.hurtT > 0 ? Math.sin(B.hurtT * 30) * .08 : 0;
  const sz = (1.9 - B.hits * .2 - (3 - (B.hp == null ? 3 : B.hp)) * .12) * (B.dead ? 1 + B.popT * .6 : 1);
  c.save(); c.globalAlpha = k; c.translate(B.x, B.y); c.scale(sz * (1 + hurt), sz * (1 - hurt));
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + t * .3; c.fillStyle = i % 2 ? "#e3e7f4" : "#d3d9ec"; c.beginPath(); c.arc(Math.cos(a) * .75, Math.sin(a) * .5, .55 + Math.sin(t * 2 + i) * .04, 0, 7); c.fill(); }
  c.fillStyle = "#eef1fa"; c.beginPath(); c.ellipse(0, 0, 1, .78, 0, 0, 7); c.fill();
  const sleepy = !L.fog.every(f => f.cleared); c.strokeStyle = "#5a6488"; c.lineWidth = .07; c.lineCap = "round";
  for (const sd of [-1, 1]) { c.beginPath(); if (B.hurtT > 0 || B.dead) { c.moveTo(sd * .3 - .1, -.12); c.lineTo(sd * .3 + .1, -.02); c.moveTo(sd * .3 + .1, -.12); c.lineTo(sd * .3 - .1, -.02); } else if (sleepy) c.arc(sd * .3, -.1, .1, .2, Math.PI - .2); else { c.fillStyle = "#5a6488"; c.arc(sd * .3, -.08, .09, 0, 7); c.fill(); } c.stroke(); }
  c.fillStyle = "rgba(158,195,234,.45)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * .5, .1, .12, .06, 0, 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(0, .22, .12, B.puffT < .6 ? .14 : .06, 0, 0, 7); c.fillStyle = "#5a6488"; c.fill();
  c.restore(); c.globalAlpha = 1;
  for (const f of B.puffs) { const a = Math.min(1, (5 - f.t)); c.globalAlpha = a; c.fillStyle = "#dfe4f3"; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(f.x + Math.cos(i * 1.6 + t) * .22, f.y + Math.sin(i * 1.6 + t) * .18, .32, 0, 7); c.fill(); } c.fillStyle = "#7a84a8"; c.beginPath(); c.arc(f.x - .1, f.y - .05, .04, 0, 7); c.arc(f.x + .1, f.y - .05, .04, 0, 7); c.fill(); c.globalAlpha = 1; }
}
function drawProp(c, pr, t) {
  if (pr.k === "sign") { c.fillStyle = "#8a6a44"; c.fillRect(pr.x - .05, pr.y - 1.1, .1, 1.1); c.fillStyle = "#c9a26a"; c.beginPath(); c.moveTo(pr.x - .5, pr.y - 1.15); c.lineTo(pr.x + .55, pr.y - 1.15); c.lineTo(pr.x + .75, pr.y - .95); c.lineTo(pr.x + .55, pr.y - .75); c.lineTo(pr.x - .5, pr.y - .75); c.fill(); c.strokeStyle = "#6b4a2c"; c.lineWidth = .04; c.stroke(); }
  else if (pr.k === "windmill") { const s = pr.s; c.save(); c.translate(pr.x, pr.y); c.scale(s, s); c.fillStyle = "#e9dcc0"; c.beginPath(); c.moveTo(-1.2, 6); c.lineTo(-.7, -1); c.lineTo(.7, -1); c.lineTo(1.2, 6); c.fill(); c.fillStyle = "#b55f3a"; c.beginPath(); c.moveTo(-1, -1); c.lineTo(0, -2.2); c.lineTo(1, -1); c.fill(); c.translate(0, -1.3); c.rotate(t * .9); for (let k = 0; k < 4; k++) { c.rotate(1.5708); c.fillStyle = "#8a6a44"; c.fillRect(-.07, 0, .14, 3.6); c.fillStyle = "rgba(255,248,230,.9)"; c.fillRect(.1, .6, .9, 2.8); } c.fillStyle = "#6b4a2c"; c.beginPath(); c.arc(0, 0, .2, 0, 7); c.fill(); c.restore(); }
  else if (pr.k === "pillar") { c.fillStyle = "#e8ecf6"; c.fillRect(pr.x - .5, pr.y - 6, 1, 6); c.fillStyle = "#c9cfe2"; c.fillRect(pr.x + .15, pr.y - 6, .35, 6); c.fillStyle = "#f6f8ff"; c.fillRect(pr.x - .7, pr.y - 6.4, 1.4, .45); }
  else if (pr.k === "post") { c.fillStyle = "#b9a58a"; c.fillRect(pr.x - .07, pr.y - 3.1, .14, 3.1); c.fillRect(pr.x - .5, pr.y - 3.1, 1, .1); }
}
function drawPlat(c, q, t) {
  const L = TR.getS().L;
  if (q.kind === "light") { const a = clamp(q.lit / .5, 0, 1); if (a <= 0.01) { c.strokeStyle = "rgba(140,220,230,.08)"; c.lineWidth = .04; c.strokeRect(q.x0, q.y, q.x1 - q.x0, .3); return; }
    c.globalAlpha = a; glow(c, (q.x0 + q.x1) / 2, q.y + .1, 1.4, "rgba(150,240,230,A)", .35); c.fillStyle = "#9eeadf"; c.beginPath(); c.moveTo(q.x0, q.y); c.lineTo(q.x1, q.y); c.lineTo(q.x1 - .2, q.y + .35); c.lineTo(q.x0 + .2, q.y + .35); c.closePath(); c.fill(); c.strokeStyle = "#4fb5aa"; c.lineWidth = .04; c.stroke(); c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(q.x0 + .1, q.y + .03, q.x1 - q.x0 - .2, .05); c.globalAlpha = 1; return; }
  if (q.kind === "fog") { if (!TR.platOn(q)) return; const f = L.fog[q.chunk], a = 1 - f.a; c.globalAlpha = clamp(a * 1.5, 0, 1); c.fillStyle = "#f5f7ff"; for (let x = q.x0 + .3; x < q.x1; x += .55) { c.beginPath(); c.arc(x, q.y + .15, .32, 0, 7); c.fill(); } c.fillStyle = "#cdd4ec"; c.fillRect(q.x0 + .1, q.y + .3, q.x1 - q.x0 - .2, .12); c.globalAlpha = 1; return; }
  if (q.kind === "nest") { if (!TR.platOn(q)) return; c.fillStyle = "#a0784c"; c.beginPath(); c.moveTo(q.x0, q.y); c.quadraticCurveTo((q.x0 + q.x1) / 2, q.y + 1, q.x1, q.y); c.closePath(); c.fill(); c.strokeStyle = "#7a5634"; c.lineWidth = .07; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(q.x0 + i * .3, q.y + .1); c.quadraticCurveTo((q.x0 + q.x1) / 2, q.y + .7 - i * .05, q.x1 - i * .3, q.y + .1); c.stroke(); } c.fillStyle = "#cfe3a8"; c.fillRect(q.x0, q.y - .08, q.x1 - q.x0, .12);
    c.strokeStyle = "#6b4a2c"; c.lineWidth = .08; c.beginPath(); c.moveTo(q.x1 - .4, q.y); c.lineTo(q.x1 - .4, q.y - 2); c.stroke(); c.fillStyle = COL.tip; c.beginPath(); c.moveTo(q.x1 - .4, q.y - 2); c.quadraticCurveTo(q.x1 + .3, q.y - 1.85 + Math.sin(t * 3) * .1, q.x1 + .5, q.y - 1.6); c.lineTo(q.x1 - .4, q.y - 1.3); c.fill(); return; }
  if (q.kind === "cloud") { c.fillStyle = "rgba(255,255,255,.92)"; for (let x = q.x0 + .25; x < q.x1; x += .5) { c.beginPath(); c.arc(x, q.y + .18 + Math.sin(x * 3 + t) * .04, .3, 0, 7); c.fill(); } c.fillStyle = "rgba(200,210,240,.6)"; c.fillRect(q.x0 + .1, q.y + .3, q.x1 - q.x0 - .2, .1); return; }
  if (q.kind === "stone") { const cx = (q.x0 + q.x1) / 2; if (q.on) glow(c, cx, q.y, 1.4, "rgba(255,230,140,A)", .55); else glow(c, cx, q.y, 1, "rgba(200,230,255,A)", .25 + Math.sin(t * 2 + q.n) * .1);
    c.fillStyle = q.on ? "#f3dc8e" : "#c3c9cf"; c.beginPath(); c.ellipse(cx, q.y + .2, (q.x1 - q.x0) / 2, .32, 0, 0, 7); c.fill(); c.strokeStyle = "#6f7680"; c.lineWidth = .04; c.stroke();
    c.fillStyle = q.on ? "#fff8d8" : "#8fd3ff"; for (let k = 0; k < q.n; k++) { c.beginPath(); c.arc(cx + (k - (q.n - 1) / 2) * .28, q.y + .14, .08, 0, 7); c.fill(); } return; }
  if (q.kind === "flip") { const cx = (q.x0 + q.x1) / 2, sh = q.sh ? Math.sin(t * 70) * .04 : 0; c.save(); c.translate(cx + sh, q.y + .13); c.scale(1, Math.cos((q.rot || 0) * Math.PI / 2)); c.fillStyle = "#c48d55"; c.strokeStyle = "#6a4a2a"; c.lineWidth = .05; c.beginPath(); c.rect(-(q.x1 - q.x0) / 2, -.13, q.x1 - q.x0, .26); c.fill(); c.stroke(); c.fillStyle = "#86c06a"; c.fillRect(-(q.x1 - q.x0) / 2, -.16, q.x1 - q.x0, .05); c.restore();
    c.fillStyle = "#6a4a2a"; c.beginPath(); c.arc(cx, q.y + .13, .08, 0, 7); c.fill(); if (q.sh) { c.fillStyle = "rgba(255,255,255,.8)"; c.font = "bold .35px sans-serif"; c.fillText("!", cx - .05, q.y - .3); } return; }
  // plank / wood beams
  const wood = q.kind === "wood"; c.fillStyle = wood ? "#b48a58" : "#a57a4a"; c.strokeStyle = "#6a4a2a"; c.lineWidth = .05;
  const n = Math.max(1, Math.round((q.x1 - q.x0) / .7)); for (let i = 0; i < n; i++) { const x = q.x0 + i * (q.x1 - q.x0) / n; c.beginPath(); c.rect(x + .02, q.y + (i % 2) * .02, (q.x1 - q.x0) / n - .04, .28); c.fill(); c.stroke(); }
  c.fillStyle = wood ? "#d9b07a" : "#86c06a"; c.fillRect(q.x0, q.y - .03, q.x1 - q.x0, .06);
}
function drawSolid(c, s, t) {
  if (s.mat === "soft") { pathShape(c, s); c.fillStyle = R.soil; c.fill(); c.strokeStyle = "#5a3e26"; c.lineWidth = .06; c.stroke();
    const P = s.k === "box" ? [[s.b[0], s.b[1]], [s.b[2], s.b[1]]] : [s.pts[0], s.pts[1]]; c.fillStyle = "#b08356"; for (let i = 0; i <= 10; i++) { const x = lerp(P[0][0], P[1][0], i / 10), y = lerp(P[0][1], P[1][1], i / 10); c.beginPath(); c.arc(x, y, .14, 0, 7); c.fill(); }
    c.strokeStyle = "rgba(255,230,190,.35)"; c.lineWidth = .04; for (let i = 1; i < 6; i++) { const x = lerp(P[0][0], P[1][0], i / 6), y = lerp(P[0][1], P[1][1], i / 6); c.beginPath(); c.moveTo(x - .15, y + .3); c.lineTo(x, y + .45); c.lineTo(x + .15, y + .3); c.stroke(); } return; }
  if (s.mat === "ice") { if (s.broken) return; const b = s.b, w = b[2] - b[0]; if (b[3] - b[1] < 1.5) { c.fillStyle = "rgba(190,230,255,.85)"; c.fillRect(b[0], b[1], w, b[3] - b[1]); c.strokeStyle = "#7fb2d8"; c.lineWidth = .05; c.strokeRect(b[0], b[1], w, b[3] - b[1]); c.strokeStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.moveTo(b[0] + .3, b[1] + .2); c.lineTo(b[0] + .9, b[3] - .2); c.stroke(); return; }
    for (let k = 0; k < 4; k++) { const x = b[0] + w * (k + .5) / 4, L = (b[3] - b[1]) * (k % 2 ? .95 : 1.02); c.fillStyle = "rgba(195,232,255,.88)"; c.strokeStyle = "#7fb2d8"; c.lineWidth = .04; c.beginPath(); c.moveTo(x - w / 4 - .05, b[1]); c.lineTo(x, b[1] + L); c.lineTo(x + w / 4 + .05, b[1]); c.closePath(); c.fill(); c.stroke(); }
    glow(c, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 1.6, "rgba(170,220,255,A)", .25); return; }
  if (s.mat === "bud") { const b = s.b, cx = (b[0] + b[2]) / 2, h = b[3] - b[1], o = s.openAmt;
    c.save(); c.translate(cx, b[3]);
    for (const sd of [-1, 1]) { c.save(); c.rotate(sd * o * 1.15); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * .95, -h * .45, sd * .05, -h - .2); c.quadraticCurveTo(sd * .2, -h * .5, 0, 0); c.fillStyle = sd < 0 ? "#6fc3d6" : "#8fd6e3"; c.fill(); c.strokeStyle = "#3f8aa0"; c.lineWidth = .05; c.stroke(); c.restore(); }
    c.fillStyle = "#4f9c5a"; c.beginPath(); c.ellipse(0, -.1, .6, .2, 0, 0, 7); c.fill();
    if (o > .5) { glow(c, 0, -h * .5, 1, "rgba(255,250,200,A)", .5); } c.restore(); return; }
  if (s.mat === "gate") { const b = s.b, o = (TR.getS().L.gates.find(g => g === s) || s).oa || 0; c.save(); c.beginPath(); c.rect(b[0] - .1, b[1] - .5, b[2] - b[0] + .2, b[3] - b[1] + 1); c.clip(); c.translate(-(b[2] - b[0]) * o, 0); c.fillStyle = "#9aa3ad"; c.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); c.strokeStyle = "#5d6570"; c.lineWidth = .06; c.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    c.fillStyle = "#8fd3ff"; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(b[0] + (b[2] - b[0]) * k / 4, (b[1] + b[3]) / 2, .1, 0, 7); c.fill(); } c.restore(); return; }
}
function drawBramble(c, z, t) { const b = z.b; c.strokeStyle = "#4f6a3a"; c.lineWidth = .1; for (let x = b[0]; x < b[2]; x += .9) { c.beginPath(); c.moveTo(x, b[3]); c.quadraticCurveTo(x + .5, b[1] - .3, x + 1.1, b[3]); c.stroke(); }
  c.fillStyle = "#7d4a6a"; for (let x = b[0] + .2; x < b[2]; x += .45) { const y = b[1] + .1 + Math.sin(x * 7) * .12; c.beginPath(); c.moveTo(x - .08, y + .1); c.lineTo(x, y - .14); c.lineTo(x + .08, y + .1); c.fill(); }
  c.fillStyle = "#5f86c4"; for (let x = b[0] + .6; x < b[2]; x += 1.7) { c.beginPath(); c.arc(x, b[1] + .2, .1, 0, 7); c.fill(); } }
function drawGeyser(c, g, t) { const cx = (g.x0 + g.x1) / 2, w = g.x1 - g.x0;
  c.fillStyle = "#7f8f8a"; c.beginPath(); c.ellipse(cx, g.base, w * .62, .3, 0, 0, 7); c.fill(); c.fillStyle = "#5fc8e0"; c.beginPath(); c.ellipse(cx, g.base - .05, w * .45, .16, 0, 0, 7); c.fill();
  if (g.warn) { for (let i = 0; i < 4; i++) { const k = (t * 3 + i * .25) % 1; c.fillStyle = `rgba(220,250,255,${1 - k})`; c.beginPath(); c.arc(cx + Math.sin(i * 2.3) * w * .3, g.base - .2 - k * 1.2, .1 + k * .1, 0, 7); c.fill(); } }
  // top marker: where the jet will stop (the hint v5 lacked)
  c.strokeStyle = g.on ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.35)"; c.lineWidth = .06; c.setLineDash([.25, .2]); c.beginPath(); c.ellipse(cx, g.top + .2, w * .55, .18, 0, 0, 7); c.stroke(); c.setLineDash([]);
  if (!g.on) { c.fillStyle = "rgba(255,255,255,.45)"; for (let k = 0; k < 2; k++) { const y = g.top + .9 + k * .45; c.beginPath(); c.moveTo(cx - .25, y + .2); c.lineTo(cx, y); c.lineTo(cx + .25, y + .2); c.lineWidth = .07; c.strokeStyle = "rgba(255,255,255,.4)"; c.stroke(); } return; }
  const top = g.topNow, gr = c.createLinearGradient(g.x0, 0, g.x1, 0); gr.addColorStop(0, "rgba(140,220,245,.35)"); gr.addColorStop(.5, "rgba(230,250,255,.85)"); gr.addColorStop(1, "rgba(140,220,245,.35)");
  c.fillStyle = gr; c.beginPath(); c.moveTo(g.x0 + .2, g.base); for (let y = g.base; y > top; y -= .5) c.lineTo(g.x0 + .1 + Math.sin(y * 2 + t * 12) * .12, y); c.lineTo(cx, top - .4); for (let y = top; y < g.base; y += .5) c.lineTo(g.x1 - .1 + Math.sin(y * 2 + t * 12 + 1) * .12, y); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.9)"; for (let i = 0; i < 7; i++) { const a = t * 4 + i; c.beginPath(); c.arc(cx + Math.cos(a) * w * .5, top + Math.sin(a * 1.3) * .25, .25, 0, 7); c.fill(); }
}
function drawCurrent(c, cu, t, V) { const r = cu.r; if (!vis(r, V, 2)) return; const w = r[2] - r[0];
  const g = c.createLinearGradient(r[0], 0, r[2], 0); g.addColorStop(0, "rgba(220,245,255,0)"); g.addColorStop(.5, "rgba(220,250,240,.18)"); g.addColorStop(1, "rgba(220,245,255,0)"); c.fillStyle = g; c.fillRect(r[0], r[1], w, r[3] - r[1]);
  c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = .05; c.lineCap = "round";
  for (let i = 0; i < 16; i++) { const x = r[0] + .4 + (i * 1.37 % (w - .8)), y = r[3] - ((t * 5 + i * 2.3) % (r[3] - r[1])); c.beginPath(); c.moveTo(x + Math.sin(y + t) * .2, y); c.quadraticCurveTo(x + Math.sin(y + t + 1) * .3, y - .5, x, y - 1.1); c.stroke(); }
  c.fillStyle = "#a8d68a"; for (let i = 0; i < 6; i++) { const y = r[3] - ((t * 3.5 + i * 3.1) % (r[3] - r[1])), x = (r[0] + r[2]) / 2 + Math.sin(t * 1.3 + i * 2) * w * .35; c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.beginPath(); c.ellipse(0, 0, .14, .06, 0, 0, 7); c.fill(); c.restore(); }
  // top-of-current hint: leaves gather and swirl where the lift ends, plus a soft dashed cap
  c.strokeStyle = "rgba(255,255,255,.6)"; c.setLineDash([.25, .2]); c.lineWidth = .06; c.beginPath(); c.ellipse((r[0] + r[2]) / 2, r[1] + .3, w * .5, .25, 0, 0, 7); c.stroke(); c.setLineDash([]);
  for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.256; c.fillStyle = "#cfe8a0"; c.beginPath(); c.ellipse((r[0] + r[2]) / 2 + Math.cos(a) * w * .4, r[1] + .3 + Math.sin(a) * .25, .12, .05, a, 0, 7); c.fill(); } }
function drawWind(c, w, t, V) { const r = w.r; if (!vis(r, V, 2)) return; c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = .05;
  for (let i = 0; i < 9; i++) { const len = r[2] - r[0], x = w.vx > 0 ? r[0] + ((t * 6 + i * 1.7) % len) : r[2] - ((t * 6 + i * 1.7) % len), y = r[1] + .4 + (i * .73 % (r[3] - r[1] - .8)); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - Math.sign(w.vx) * .5, y - .1, x - Math.sign(w.vx) * 1.1, y + Math.sin(t * 3 + i) * .1); c.stroke(); } }
function drawRail(c, Lr, C, t, V) { const P = Lr.pts;
  c.strokeStyle = "#5a4430"; c.lineWidth = .14; c.lineCap = "round";
  // ties
  for (let s = 0; s < Lr.len; s += .6) { const q = TR.railAt(Lr, s); if (q.x < V[0] - 1 || q.x > V[2] + 1 || q.y < V[1] - 1 || q.y > V[3] + 1) continue; if (Lr.sg.some(([a, b]) => s > a && s < b)) continue; c.strokeStyle = "#6b4f34"; c.lineWidth = .12; c.beginPath(); c.moveTo(q.x + q.ty * .05 - q.tx * 0, q.y - q.tx * .05); c.lineTo(q.x - q.ty * .35, q.y + q.tx * .35); c.stroke(); }
  c.strokeStyle = "#9aa0a8"; c.lineWidth = .08; let open = false; c.beginPath();
  for (let s = 0; s <= Lr.len; s += .3) { const q = TR.railAt(Lr, s), gap = Lr.sg.some(([a, b]) => s > a && s < b); if (gap) { open = false; continue; } if (!open) { c.moveTo(q.x, q.y); open = true; } else c.lineTo(q.x, q.y); }
  c.stroke();
  // trestles to the floor
  c.strokeStyle = "rgba(90,70,50,.6)"; c.lineWidth = .1; for (let s = 2; s < Lr.len; s += 3) { const q = TR.railAt(Lr, s); if (q.x < V[0] - 1 || q.x > V[2] + 1) continue; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.ty * 2.2, q.y + q.tx * 2.2); c.stroke(); }
  if (C) { c.save(); c.translate(C.x, C.y); c.rotate(C.ang || 0); c.fillStyle = "#8a5a3a"; c.beginPath(); c.moveTo(-.75, -.45); c.lineTo(.75, -.45); c.lineTo(.6, .25); c.lineTo(-.6, .25); c.closePath(); c.fill(); c.strokeStyle = "#4a3020"; c.lineWidth = .05; c.stroke(); c.fillStyle = "#c9a26a"; c.fillRect(-.75, -.5, 1.5, .1);
    c.fillStyle = "#3a3a44"; for (const x of [-.4, .4]) { c.beginPath(); c.arc(x, .3, .16, 0, 7); c.fill(); } c.restore(); } }
// ---------- world render ----------
TR.renderWorld = function (ctx, S, cam, z, opt, W, H, DPR, Zbase) {
  opt = opt || {}; const L = S.L, t = opt.t || 0, p = S.p;
  const V = [cam.x - W / 2 / z, cam.y - H / 2 / z, cam.x + W / 2 / z, cam.y + H / 2 / z];
  const zc = TR.zoneOf(L, cam.x, cam.y);
  // background blend weights
  const bw = R.bgW; for (const k in THEME) bw[k] = bw[k] == null ? (k === zc ? 1 : 0) : bw[k]; const dtb = opt.dt || .016; for (const k in THEME) bw[k] = clamp(bw[k] + (k === zc ? dtb * 1.2 : -dtb * 1.2), 0, 1); if (opt.snapBg) for (const k in THEME) bw[k] = k === zc ? 1 : 0;
  const toW = () => ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
  // 1. rock everywhere
  toW(); ctx.fillStyle = R.pats[zc]; ctx.fillRect(V[0] - 1, V[1] - 1, V[2] - V[0] + 2, V[3] - V[1] + 2);
  drawEdgeBands(ctx, V);
  // 2. sky / cave backdrop seen through the carved air
  ctx.save(); ctx.beginPath(); for (const s of L.air) if (vis(s.bb, V, 0)) { if (s.k === "box") ctx.rect(s.b[0], s.b[1], s.b[2] - s.b[0], s.b[3] - s.b[1]); else { ctx.moveTo(s.pts[0][0], s.pts[0][1]); for (const q of s.pts) ctx.lineTo(q[0], q[1]); ctx.closePath(); } } ctx.clip();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); let first = true; const order = Object.keys(THEME).sort((a, b) => bw[b] - bw[a]);
  for (const k of order) { if (bw[k] < .01) continue; drawBg(ctx, k, cam, t, W, H, Zbase || z, first ? 1 : bw[k]); first = false; }
  ctx.restore(); toW();
  // 3. hidden-room walls (look like rock until you are inside)
  for (const r of L.rooms) { if (!vis(r.wall, V, 1)) continue; const inside = p.room && TR.inR(r.b, p.x, p.y); r.a = clamp((r.a == null ? 1 : r.a) + (inside ? -opt.dt * 3 : opt.dt * 3), .25, 1); if (opt.reveal) r.a = 1; ctx.globalAlpha = r.a; ctx.fillStyle = R.pats[TR.zoneOf(L, r.wall[0], r.wall[1])]; ctx.fillRect(r.wall[0], r.wall[1], r.wall[2] - r.wall[0], r.wall[3] - r.wall[1]); ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(r.wall[0], r.wall[1], .25, r.wall[3] - r.wall[1]); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(60,40,30,.35)"; ctx.lineWidth = .05; ctx.beginPath(); const mx = (r.wall[0] + r.wall[2]) / 2, my = (r.wall[1] + r.wall[3]) / 2; ctx.moveTo(mx - .3, my - .6); ctx.lineTo(mx + .1, my); ctx.lineTo(mx - .2, my + .5); ctx.stroke(); }
  // 4. props behind
  for (const pr of L.props) if (pr.x > V[0] - 6 && pr.x < V[2] + 6 && pr.y > V[1] - 8 && pr.y < V[3] + 8) drawProp(ctx, pr, t);
  for (const cu of L.currents) drawCurrent(ctx, cu, t, V);
  for (const w of L.winds) drawWind(ctx, w, t, V);
  for (const g of L.geysers) if (g.x1 > V[0] - 2 && g.x0 < V[2] + 2 && g.base > V[1] - 2 && g.top < V[3] + 2) drawGeyser(ctx, g, t);
  // 5. solids
  for (const s of L.solids) { if (!vis(s.bb, V, .5)) continue; if (s.mat === "rock") { pathShape(ctx, s); ctx.fillStyle = R.pats[TR.zoneOf(L, (s.bb[0] + s.bb[2]) / 2, s.bb[1] + .5)]; ctx.fill(); } else drawSolid(ctx, s, t); }
  drawEdgeDeco(ctx, V, t);
  for (const z2 of L.hazards) if (vis(z2.b, V, 1)) drawBramble(ctx, z2, t);
  if (L.rail) drawRail(ctx, L.rail, S.cart && S.cart.x != null ? S.cart : null, t, V);
  for (const l of L.lanterns) if (l.x > V[0] - 2 && l.x < V[2] + 2 && l.y > V[1] - 2 && l.y < V[3] + 2) drawLantern(ctx, l, t);
  for (const q of L.plats) if (q.x1 > V[0] - 1 && q.x0 < V[2] + 1 && q.y > V[1] - 3 && q.y < V[3] + 2) drawPlat(ctx, q, t);
  for (const b of L.bells) if (Math.abs(b.x - cam.x) < V[2] - V[0] && Math.abs(b.y - cam.y) < V[3] - V[1]) drawBell(ctx, b, t);
  for (const i of L.icicles) if (Math.abs(i.x - cam.x) < 12) drawIcicle(ctx, i, t);
  for (const m of L.shrooms) if (Math.abs(m.x - cam.x) < 12 && Math.abs(m.y - cam.y) < 9) drawShroom(ctx, m, t);
  // trail (dim, short-lived)
  if (opt.trail !== false) { const T = S.trail, n = T.length; ctx.lineCap = "round"; ctx.lineWidth = .09;
    for (let i = Math.max(1, n - 90); i < n; i++) { const a = (1 - (n - i) / 90) * .2; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(T[i - 1].x, T[i - 1].y + .2); ctx.lineTo(T[i].x, T[i].y + .2); ctx.stroke(); } }
  if (opt.reveal) opt.reveal(ctx);
  for (const w of L.wisps) if (!w.got && (w.fog == null || L.fog[w.fog].cleared) && w.x > V[0] - 1 && w.x < V[2] + 1 && w.y > V[1] - 1 && w.y < V[3] + 1) drawWisp(ctx, w, t);
  for (const w of L.abilityWisps) if (!w.got && w.x > V[0] - 2 && w.x < V[2] + 2 && w.y > V[1] - 2 && w.y < V[3] + 2) drawAbWisp(ctx, w, t);
  for (const g of L.gems) if (!g.got && g.x > V[0] - 2 && g.x < V[2] + 2) drawGem(ctx, g, t);
  for (const sp of L.spikes) for (const b of sp.balls) drawSpike(ctx, b, t);
  for (const th of L.thieves) if (Math.abs(th.x - cam.x) < 14) drawThief(ctx, th, t);
  for (const cr of L.crows) if (Math.abs(cr.x - cam.x) < 14 && Math.abs(cr.y - cam.y) < 10) drawCrow(ctx, cr, t);
  if (S.boss && Math.abs(S.boss.y - cam.y) < 14) drawBoss(ctx, S.boss, t, L);
  // hero + trailing lights
  if (opt.hero !== false) {
    for (let i = S.follow.length - 1; i >= 0; i--) { const f = S.follow[i]; const a = .55 - i * .05; glow(ctx, f.x, f.y + Math.sin(t * 3 + i) * .08, .32, "rgba(200,240,255,A)", a); ctx.fillStyle = `rgba(255,255,255,${a + .3})`; ctx.beginPath(); ctx.arc(f.x, f.y + Math.sin(t * 3 + i) * .08, .06, 0, 7); ctx.fill(); }
    ctx.fillStyle = "rgba(40,60,40,.2)"; if (p.ground) { ctx.beginPath(); ctx.ellipse(p.x, p.y + .45, .38, .08, 0, 0, 7); ctx.fill(); }
    if (S.ab) { const A = TR.ABIL[S.ab]; glow(ctx, p.x, p.y, 1.1, hexA(A.col), .22); }
    if (p.hurt > 0 && Math.floor(p.hurt * 14) % 2) ctx.globalAlpha = .55;
    drawTuan(ctx, p, t, 1, S.ab); ctx.globalAlpha = 1;
    if (S.flare) { const k = S.flare.t / .7; ctx.strokeStyle = `rgba(255,235,160,${1 - k})`; ctx.lineWidth = .15; ctx.beginPath(); ctx.arc(S.flare.x, S.flare.y, .5 + k * 6.5, 0, 7); ctx.stroke(); glow(ctx, S.flare.x, S.flare.y, 4 * (1 - k) + .5, "rgba(255,240,180,A)", .5 * (1 - k)); }
    if (S.ring) { const k = S.ring.t / .6; for (let j = 0; j < 2; j++) { const kk = clamp(k - j * .2, 0, 1); ctx.strokeStyle = `rgba(200,200,255,${(1 - kk) * .8})`; ctx.lineWidth = .1; ctx.beginPath(); ctx.arc(S.ring.x, S.ring.y, .4 + kk * 3.6, 0, 7); ctx.stroke(); } }
  }
  for (const f of S.fx) {
    const life = { dust: .6, spark: .6, puff: .5, ring: .5, soil: .8, ice: 1, spore: 1.1, wind: 1.4, cloud: 1.8, fluff: 1.2 }[f.k] || .8, a = 1 - f.t / life;
    if (f.k === "dust") { ctx.fillStyle = `rgba(245,240,225,${a * .7})`; ctx.beginPath(); ctx.arc(f.x, f.y, .08 + f.t * .25, 0, 7); ctx.fill(); }
    else if (f.k === "spark") { ctx.fillStyle = `rgba(230,250,255,${a})`; ctx.beginPath(); ctx.arc(f.x, f.y, .07, 0, 7); ctx.fill(); }
    else if (f.k === "puff") { ctx.fillStyle = `rgba(255,255,255,${a * .8})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t * 4, f.y, .25 * (1 + f.t * 2), 0, 7); ctx.fill(); }
    else if (f.k === "ring") { ctx.strokeStyle = `rgba(220,255,200,${a})`; ctx.lineWidth = .08; ctx.beginPath(); ctx.ellipse(f.x, f.y, .4 + f.t * 4, .1 + f.t * .8, 0, 0, 7); ctx.stroke(); }
    else if (f.k === "soil") { ctx.fillStyle = `rgba(150,100,60,${a})`; ctx.fillRect(f.x - .06, f.y - .06, .12, .12); }
    else if (f.k === "ice") { ctx.fillStyle = `rgba(210,240,255,${a})`; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r + f.t * 5); ctx.fillRect(-.1, -.04, .2, .08); ctx.restore(); }
    else if (f.k === "spore") { ctx.fillStyle = `rgba(220,240,190,${a * .8})`; ctx.beginPath(); ctx.arc(f.x, f.y, .12 + f.t * .3, 0, 7); ctx.fill(); }
    else if (f.k === "wind") { ctx.strokeStyle = `rgba(255,255,255,${a * .8})`; ctx.lineWidth = .06; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + .5, f.y - .3, f.x + 1.2, f.y); ctx.stroke(); }
    else if (f.k === "cloud") { ctx.fillStyle = `rgba(240,244,255,${a * .9})`; ctx.beginPath(); ctx.arc(f.x, f.y, .3 + f.t * .3, 0, 7); ctx.fill(); }
  }
  // fog of the summit
  for (const f of L.fog) { if (f.a <= .01 || !vis(f.b, V, 3)) continue; f.blobs = f.blobs || fogBlobs(f); ctx.globalAlpha = f.a * .93;
    for (const b of f.blobs) { ctx.fillStyle = "#e4e8f5"; ctx.beginPath(); ctx.arc(b.x + Math.sin(t * .5 + b.ph) * .3 + (1 - f.a) * 6, b.y + Math.cos(t * .4 + b.ph) * .2, b.r, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#f4f6fd"; for (const b of f.blobs) { ctx.beginPath(); ctx.arc(b.x + Math.sin(t * .5 + b.ph) * .3 - .2 + (1 - f.a) * 6, b.y - .25, b.r * .6, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // darkness (cave): half-res mask with soft light holes
  const zp = TR.zoneOf(L, cam.x, cam.y), dz = L.zones.find(q => q.id === zp);
  let dk = dz && dz.dark && !opt.reveal ? (cam.y > 58 ? .6 : .88) : 0; R.dkA = lerp(R.dkA || 0, dk, opt.snapBg ? 1 : .05); dk = R.dkA;
  if (dk > .02) { const mw = Math.ceil(W / 2), mh = Math.ceil(H / 2), D = R.dark, dc = R.darkC; if (D.width !== mw || D.height !== mh) { D.width = mw; D.height = mh; }
    dc.globalCompositeOperation = "source-over"; dc.clearRect(0, 0, mw, mh); dc.fillStyle = `rgba(6,8,22,${dk})`; dc.fillRect(0, 0, mw, mh); dc.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, a) => { const sx = (W / 2 + (x - cam.x) * z) / 2, sy = (H / 2 + (y - cam.y) * z) / 2, rr = r * z / 2; if (sx < -rr || sy < -rr || sx > mw + rr || sy > mh + rr) return; const g = dc.createRadialGradient(sx, sy, rr * .25, sx, sy, rr); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); dc.fillStyle = g; dc.beginPath(); dc.arc(sx, sy, rr, 0, 7); dc.fill(); };
    hole(p.x, p.y, S.ab === "lamp" ? PHr() : 2.4, 1);
    if (S.flare) hole(S.flare.x, S.flare.y, 2 + S.flare.t * 9, 1 - S.flare.t / .7);
    for (const l of L.lanterns) hole(l.x, l.y, 3.2, .85);
    for (const q of L.plats) if (q.kind === "light" && q.lit > 0) hole((q.x0 + q.x1) / 2, q.y, 1.8, clamp(q.lit, 0, 1) * .8);
    for (const w of L.abilityWisps) if (!w.got) hole(w.x, w.y, 2.2, .8);
    for (const w of L.wisps) if (!w.got && Math.abs(w.x - cam.x) < 10 && Math.abs(w.y - cam.y) < 6) hole(w.x, w.y, .9, .5);
    if (S.cart && S.cart.x != null) hole(S.cart.x, S.cart.y, 2.5, .7);
    ctx.drawImage(D, 0, 0, W, H); }
  // vignette + motes
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(20,40,40,.26)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = zc === "cave" ? "rgba(150,240,230,.5)" : "rgba(255,255,235,.6)"; for (let i = 0; i < 16; i++) { const x = ((i * 97.3 + t * 9 - cam.x * z * .6) % W + W) % W, y = ((i * 53.1 + Math.sin(t * .5 + i) * 20 - cam.y * z * .6) % H + H) % H; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .5, 0, 7); ctx.fill(); }
};
const PHr = () => TR.PH.lampR + .8;
})(typeof window !== "undefined" ? window : globalThis);
