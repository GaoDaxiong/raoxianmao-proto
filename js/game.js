// 南瓜灯小幽灵 v4 (landscape, floating joystick, lost wisps) — game logic + orchestration. World units: letter grid cell = LS units.
(() => {
"use strict";
const cv = document.getElementById("cv"), ctx = cv.getContext("2d", { alpha: false });
const $ = id => document.getElementById(id);
const stage = document.getElementById("stage");
let W = 844, H = 390, DPR = 1, Z = 220, ROT = false, SAL = 0, SAR = 0;
const COARSE = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
// The game is always landscape. A phone held portrait gets the whole stage rotated 90deg (CSS), and touches are mapped back.
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const iw = window.innerWidth, ih = window.innerHeight;
  ROT = ih > iw && COARSE;
  W = ROT ? ih : iw; H = ROT ? iw : ih;
  stage.style.width = W + "px"; stage.style.height = H + "px";
  stage.style.transform = ROT ? "rotate(90deg) translateY(-100%)" : "none";
  document.body.classList.toggle("rot", ROT);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  Z = Math.min(W / 3.0, H / 1.75);
  const cs = getComputedStyle(document.documentElement), px = v => parseInt(cs.getPropertyValue(v)) || 0;
  SAL = ROT ? px("--sat") : px("--sal"); SAR = ROT ? px("--sab") : px("--sar");
  try { stick.id = null; stick.active = false; act.id = null; act.down = false; } catch (e) {}
}
// client (viewport) px -> stage px
function toStage(cx, cy) { return ROT ? { x: cy, y: H - cx } : { x: cx, y: cy }; }
window.addEventListener("resize", resize); resize();

// ---------- utils ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function resampleFlat(P, n) {
  const m = P.length >> 1, cum = new Float32Array(m); for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + hyp(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
  const L = cum[m - 1], out = new Float32Array(n * 2); let j = 0;
  for (let k = 0; k < n; k++) { const s = L * k / (n - 1); while (j < m - 2 && cum[j + 1] < s) j++; const seg = (cum[j + 1] - cum[j]) || 1, t = clamp((s - cum[j]) / seg, 0, 1); out[k * 2] = lerp(P[j * 2], P[j * 2 + 2], t); out[k * 2 + 1] = lerp(P[j * 2 + 1], P[j * 2 + 3], t); }
  return out;
}
function ptsToFlat(pts) { const a = new Float32Array(pts.length * 2); pts.forEach((p, i) => { a[i * 2] = p.x; a[i * 2 + 1] = p.y; }); return a; }

// ---------- share payload (unchanged format) ----------
const KEY = [121, 97, 114, 110, 99, 97, 116];
function sanitizeWord(w) { return [...(w || "").toUpperCase()].filter(c => /[A-Z ]/.test(c) || c === "♥").join("").replace(/\s+/g, " ").replace(/^ /, "").slice(0, 8); }
function encodeShare(word, msg) {
  const b = new TextEncoder().encode(word + "\n" + msg); let s = "";
  b.forEach((v, i) => s += String.fromCharCode(v ^ KEY[i % KEY.length]));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(c) {
  try {
    let s = c.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    const bin = atob(s), b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ KEY[i % KEY.length];
    const t = new TextDecoder().decode(b), k = t.indexOf("\n");
    const word = sanitizeWord(k >= 0 ? t.slice(0, k) : t).trim(), msg = (k >= 0 ? t.slice(k + 1) : "").slice(0, 60);
    if (!word.replace(/ /g, "")) return null;
    return { word, msg };
  } catch (e) { return null; }
}

// ---------- level generation ----------
const LS = 1.5;
const SPOOL_YARN = [["#ffd3da", "#eea0b0", "#b86c86"], ["#d3eeec", "#94c6c6", "#5a8f99"], ["#e6dbf5", "#bba5dc", "#8a71ad"], ["#fff0c4", "#f0cf7c", "#b98f48"]];
function makePeg(rng, x, y, kind, extra) {
  const p = Object.assign({ x, y, kind, mat: rng() < 0.68 ? 0 : 1, h: 0.17 + rng() * 0.07, moss: rng() < 0.62, grain: [-0.55 + rng() * 0.1, 0.05 + rng() * 0.1, 0.5 + rng() * 0.1], knotX: (rng() - 0.5) * 1.2,
    ph: rng() * 6, fall: rng(), ang: 0, angv: 0, used: false, glowA: 0, rot: rng() * 6, spin: 0, wraps: 0, cool: 0, touch: 0 }, extra);
  p.gr = []; const n = 2 + (rng() * 3 | 0); for (let i = 0; i < n; i++) p.gr.push([(rng() - 0.5) * 0.12, 0.025 + rng() * 0.03, (rng() - 0.5) * 0.02]);
  p.cr = kind === "spool" ? 0.118 : 0.088;
  p.yi = (rng() * SPOOL_YARN.length) | 0; p.yc = SPOOL_YARN[p.yi];
  return p;
}
function buildLevel(ch, idx, seedStr) {
  const letter = compileLetter(ch, LS);
  const rng = mulberry32(hashStr(seedStr + "|" + ch + "|" + idx));
  const M = { x0: -1.8, y0: -2.0, x1: 4 * LS + 1.8, y1: 6 * LS + 2.0 };
  const strokes = letter.strokes;
  const distRoute = (x, y) => { let m = 1e9; for (const s of strokes) { const n = nearestOnStroke(s, x, y, 0, 1e9); if (n.d < m) m = n.d; } return m; };
  const nearestRoute = (x, y) => { let best = null; for (const s of strokes) { const n = nearestOnStroke(s, x, y, 0, 1e9); if (!best || n.d < best.d) best = n; } return best; };
  const pegs = [];
  strokes.forEach((s, si) => s.checks.forEach((c, ci) => {
    const spool = c.kind === "spool";
    const a = pointAtArc(s, Math.max(0, c.arc - 0.3)), b = pointAtArc(s, Math.min(s.L, c.arc + 0.3));
    let ux = a.x - c.x, uy = a.y - c.y, vx = b.x - c.x, vy = b.y - c.y; const lu = hyp(ux, uy) || 1, lv2 = hyp(vx, vy);
    ux /= lu; uy /= lu; let dir, off = spool ? 0.2 : 0.17;
    if (lv2 > 0.05) {
      vx /= lv2; vy /= lv2; const bx = ux + vx, by = uy + vy, bl = hyp(bx, by);
      if (bl > 0.15) { dir = { x: bx / bl, y: by / bl }; const half = Math.acos(clamp(ux * vx + uy * vy, -1, 1)) / 2; off = Math.min(0.45, Math.max(off, 0.15 / Math.max(0.05, Math.sin(half)))); }
    }
    if (!dir) { const sd = (ci % 2 ? 1 : -1); dir = { x: -uy * sd, y: ux * sd }; }
    c.peg = makePeg(rng, c.x + dir.x * off, c.y + dir.y * off, spool ? "spool" : "post", { bell: !spool, real: true, si, ci });
    pegs.push(c.peg);
  }));
  const near = (x, y, r) => pegs.some(p => hyp(p.x - x, p.y - y) < r);
  const starts = strokes.map(s => s.start);
  const nearStart = (x, y, r) => starts.some(p => hyp(p.x - x, p.y - y) < r);
  // pond (kept out of leash reach)
  const ponds = [];
  for (let i = 0; i < 40 && ponds.length < 1; i++) {
    const rx = 0.42 + rng() * 0.3, x = lerp(M.x0 + rx + 0.2, M.x1 - rx - 0.2, rng()), y = lerp(M.y0 + rx + 0.2, M.y1 - rx - 0.2, rng());
    if (distRoute(x, y) < rx + 1.25 || near(x, y, rx + 0.5)) continue;
    const P = { x, y, rx, ry: rx * 0.62, ph: rng() * 6, lilies: [] };
    for (let k = 0; k < 3 + (rng() * 3 | 0); k++) { const a = rng() * 6.28, rr = rng() * 0.7; P.lilies.push({ x: x + Math.cos(a) * rx * rr, y: y + Math.sin(a) * P.ry * rr, r: 0.04 + rng() * 0.03, a: rng() * 6, flower: rng() < 0.3 }); }
    ponds.push(P);
  }
  const inPond = (x, y, m = 0.1) => ponds.some(P => hyp((x - P.x) / (P.rx + m), (y - P.y) / (P.ry + m)) < 1);
  const addDecoy = (x, y) => {
    if (x < M.x0 + 0.35 || x > M.x1 - 0.35 || y < M.y0 + 0.35 || y > M.y1 - 0.35) return;
    const q = nearestRoute(x, y);
    if (q.d < 0.28) { const dx = x - q.x, dy = y - q.y, l = hyp(dx, dy); if (l > 1e-3) { x = q.x + dx / l * 0.28; y = q.y + dy / l * 0.28; } else { x += 0.28; } if (distRoute(x, y) < 0.27) return; }
    if (near(x, y, 0.62) || nearStart(x, y, 0.5) || inPond(x, y, 0.15)) return;
    const spool = rng() < 0.09;
    pegs.push(makePeg(rng, x, y, spool ? "spool" : "post", { bell: !spool && rng() < 0.34, real: false }));
  };
  for (let gx = Math.ceil(M.x0); gx <= M.x1; gx++) for (let gy = Math.ceil(M.y0); gy <= M.y1; gy++) addDecoy(gx + (rng() - 0.5) * 0.3, gy + (rng() - 0.5) * 0.3);
  for (let i = 0; i < 40; i++) addDecoy(lerp(M.x0, M.x1, rng()), lerp(M.y0, M.y1, rng()));
  const last = strokes[strokes.length - 1];
  let basket = null;
  const dirs = [last.endDir, { x: -last.endDir.y, y: last.endDir.x }, { x: last.endDir.y, y: -last.endDir.x }, { x: -last.endDir.x, y: -last.endDir.y }];
  for (const d of dirs) {
    const bx = clamp(last.end.x + d.x * 0.85, M.x0 + 0.5, M.x1 - 0.5), by = clamp(last.end.y + d.y * 0.85, M.y0 + 0.5, M.y1 - 0.5);
    if (distRoute(bx, by) > 0.5 && !near(bx, by, 0.3)) { basket = { x: bx, y: by }; break; }
  }
  if (!basket) basket = { x: last.end.x + 0.85, y: last.end.y };
  const cands = [];
  strokes.forEach(s => s.checks.forEach(c => {
    if (!c.corner) return;
    const a = pointAtArc(s, c.arc - 0.3), b = pointAtArc(s, c.arc + 0.3);
    const bis = { x: (a.x - c.x) + (b.x - c.x), y: (a.y - c.y) + (b.y - c.y) }; const l = hyp(bis.x, bis.y); if (l < 1e-3) return;
    cands.push({ x: c.x + bis.x / l * 1.15, y: c.y + bis.y / l * 1.15, pr: 1 });
  }));
  for (let i = 0; i < 80; i++) cands.push({ x: lerp(-0.6, 4 * LS + 0.6, rng()), y: lerp(-0.6, 6 * LS + 0.6, rng()), pr: 0 });
  const dogs = [];
  cands.sort((a, b) => (b.pr - a.pr) || (rng() - 0.5));
  for (const c of cands) {
    if (dogs.length >= 3) break;
    const dr = distRoute(c.x, c.y);
    if (dr < 1.0 || dr > 1.5) continue;
    if (nearStart(c.x, c.y, 1.0) || hyp(c.x - basket.x, c.y - basket.y) < 1.0 || inPond(c.x, c.y, 0.4)) continue;
    if (dogs.some(d => hyp(d.x - c.x, d.y - c.y) < 2.2)) continue;
    if (pegs.some(p => p.real && hyp(p.x - c.x, p.y - c.y) < 0.5)) continue;
    if (c.x < M.x0 + 0.6 || c.x > M.x1 - 0.6 || c.y < M.y0 + 0.6 || c.y > M.y1 - 0.6) continue;
    dogs.push({ x: c.x, y: c.y, awake: 0, cool: 0, swat: -1, face: rng() < 0.5 ? 1 : -1, ph: rng() * 6 });
  }
  for (let i = pegs.length - 1; i >= 0; i--) {
    const p = pegs[i]; if (p.real) continue;
    if (dogs.some(d => hyp(d.x - p.x, d.y - p.y) < 0.6) || hyp(basket.x - p.x, basket.y - p.y) < 0.5) pegs.splice(i, 1);
  }
  // ----- decor -----
  const area = (M.x1 - M.x0) * (M.y1 - M.y0);
  const decor = { paths: [], ponds, rocks: [], flowers: [], tufts: [], tall: [], bushes: [] };
  { // one meandering dirt path crossing the yard
    const pts = []; let x = lerp(M.x0, M.x1, rng()), y = M.y0 - 1.5, a = Math.PI / 2 + (rng() - 0.5) * 0.6;
    while (y < M.y1 + 1.5 && pts.length < 40) { pts.push({ x, y }); a += (rng() - 0.5) * 0.7; a = clamp(a, 0.7, 2.4); x += Math.cos(a) * 0.6; y += Math.sin(a) * 0.6; }
    const pebbles = []; for (let i = 0; i < pts.length * 6; i++) { const p = pts[(rng() * pts.length) | 0]; pebbles.push({ x: p.x + (rng() - 0.5) * 0.4, y: p.y + (rng() - 0.5) * 0.4, r: 0.008 + rng() * 0.012 }); }
    decor.paths.push({ pts, w: 0.2 + rng() * 0.06, pebbles: pebbles.filter(pb => !inPond(pb.x, pb.y)) });
  }
  const STONES = [["#e6e9df", "#a9b0ae", "#6d7090"], ["#efe5d2", "#b9ad98", "#7a6f80"], ["#dfe6e6", "#9caab0", "#5f6c8a"]];
  for (let i = 0; i < area * 0.3; i++) { const x = lerp(M.x0 - 1, M.x1 + 1, rng()), y = lerp(M.y0 - 1, M.y1 + 1, rng()); if (distRoute(x, y) < 0.25 || inPond(x, y, 0.15) || near(x, y, 0.2)) continue;
    const n = 7, pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283, r = 0.75 + rng() * 0.35; pts.push([Math.cos(a) * r, Math.sin(a) * r * (k < n / 2 ? 0.9 : 1.05)]); }
    decor.rocks.push({ x, y, s: 0.5 + rng() * 1.3, rot: rng() * 6, pts, moss: rng() < 0.45, stone: STONES[(rng() * 3) | 0] }); }
  const FC = [["#ffffff", "#e3dcf0"], ["#ffd2de", "#e9a3b8"], ["#fff3a6", "#e8cf6a"], ["#d9cfff", "#a99be0"], ["#ffffff", "#e3dcf0"], ["#bfe3ff", "#86b7e0"]];
  for (let i = 0; i < area * 0.8; i++) { const cx = lerp(M.x0, M.x1, rng()), cy = lerp(M.y0, M.y1, rng()); if (inPond(cx, cy, 0.1)) continue; const c = FC[(rng() * FC.length) | 0], n = 3 + (rng() * 5 | 0);
    for (let k = 0; k < n; k++) decor.flowers.push({ x: cx + (rng() - 0.5) * 0.35, y: cy + (rng() - 0.5) * 0.25, s: 0.7 + rng() * 0.6, c, r: rng() * 6 }); }
  for (let i = 0; i < area * 9; i++) { const x = lerp(M.x0 - 0.3, M.x1 + 0.3, rng()), y = lerp(M.y0 - 0.3, M.y1 + 0.3, rng()); if (inPond(x, y, 0.05)) continue;
    const b = [], n = 4 + (rng() * 4 | 0); for (let k = 0; k < n; k++) b.push({ dx: (rng() - 0.5) * 0.06, h: 0.045 + rng() * 0.06, a: (rng() - 0.5) * 0.9, w: 0.006 + rng() * 0.004, c: rng() < 0.2 ? 0 : rng() < 0.55 ? 1 : rng() < 0.8 ? 2 : 3 });
    decor.tufts.push({ x, y, s: 0.8 + rng() * 0.6, b }); }
  for (let i = 0; i < area * 0.45; i++) { const x = lerp(M.x0, M.x1, rng()), y = lerp(M.y0, M.y1, rng()); if (inPond(x, y, 0.05)) continue; decor.tall.push({ x, y, h: 0.07 + rng() * 0.06, s: 0.8 + rng() * 0.5, c: FC[(rng() * FC.length) | 0], r: rng() * 6 }); }
  const BC = [["#1f5040", "#3a8350", "#69a952", "#b2d870"], ["#24573f", "#478f4a", "#7fb955", "#c5e07c"], ["#1d4a45", "#2f7a5c", "#5ea463", "#a3d38a"]];
  const bush = (x, y, r) => { const lobes = [], n = 3 + (rng() * 3 | 0); for (let k = 0; k < n; k++) { const a = rng() * 6.28, d = rng() * 0.45; lobes.push([Math.cos(a) * d, Math.sin(a) * d * 0.6 - 0.1, 0.55 + rng() * 0.35]); } lobes.sort((a, b) => a[1] - b[1]); decor.bushes.push({ x, y, r, lobes, c: BC[(rng() * BC.length) | 0], berry: rng() < 0.18 }); };
  for (let ring = 0; ring < 4; ring++) {
    const o = 0.25 + ring * 0.45;
    for (let x = M.x0 - o; x <= M.x1 + o; x += 0.38 + rng() * 0.15) { bush(x, M.y0 - o + (rng() - 0.5) * 0.15, 0.24 + rng() * 0.16 + ring * 0.05); bush(x, M.y1 + o + (rng() - 0.5) * 0.15, 0.24 + rng() * 0.16 + ring * 0.05); }
    for (let y = M.y0 - o; y <= M.y1 + o; y += 0.38 + rng() * 0.15) { bush(M.x0 - o + (rng() - 0.5) * 0.15, y, 0.24 + rng() * 0.16 + ring * 0.05); bush(M.x1 + o + (rng() - 0.5) * 0.15, y, 0.24 + rng() * 0.16 + ring * 0.05); }
  }
  decor.bushes.sort((a, b) => a.y - b.y);
  pegs.sort((a, b) => a.y - b.y);
  const lv = { ch, idx, letter, strokes, pegs, dogs, basket, decor, M, frames: [], snaps: [], seed: hashStr(seedStr + ch + idx) & 0xffff };
  lv.grid = new ColGrid(pegs);
  return lv;
}
function terrainOf(lv) { if (!lv.terrain) lv.terrain = new ART.Terrain(lv); return lv.terrain; }

// ---------- game state ----------
const G = { mode: "start", levels: [], li: 0, word: "I♥U", msg: "", fromShare: false, auto: false, steps: 1, hintShown: {}, t: 0, perf: { n: 0, sum: 0, max: 0, hist: [] } };
let S = null, R = null, WD = null;
const parts = [], waves = [], winds = [];
const input = { down: false, x: 0, y: 0, id: null, keys: {} };
// floating joystick (left) + action button (right); tracked by pointer id so both thumbs work at once
const STICK_R = 60, DEAD = 0.08;
const stick = { id: null, active: false, bx: 0, by: 0, kx: 0, ky: 0, x: 0, y: 0, mag: 0, a: 0, run: false, t: 0 };
const act = { id: null, down: false, flash: 0, queued: 0 };
const bot = { x: 0, y: 0, m: 0 }; // autopilot writes here (same path as the stick)
function btnPos() { const r = 36; return { x: W - SAR - 34 - r, y: H - 30 - r, r }; }
function restBase() { return { x: SAL + 34 + STICK_R + 14, y: H - 34 - STICK_R }; }
function setKnob(x, y) {
  const dx = x - stick.bx, dy = y - stick.by, d = hyp(dx, dy), cl = Math.min(d, STICK_R);
  stick.kx = stick.bx + (d ? dx / d * cl : 0); stick.ky = stick.by + (d ? dy / d * cl : 0);
  const m = clamp((d / STICK_R - DEAD) / (1 - DEAD), 0, 1);
  stick.mag = m; stick.x = d ? dx / d * m : 0; stick.y = d ? dy / d * m : 0; stick.run = m > 0.6;
}
const SEG = 0.05;
function strokeBudget(st) { return st.L * 1.45 + 1.2; }
const hasWisp = p => p.real || p.bell;
function wispPos(p, t) { // hovering above its post / spool
  const k = p.kind === "spool" ? 0.36 : p.h + 0.2;
  return { x: p.x + (p.wdx || 0), y: p.y - k + Math.sin(t * 2.4 + p.ph) * 0.025 + (p.wdy || 0) };
}

function parseHash() {
  const m = location.hash.match(/c=([A-Za-z0-9_-]+)/);
  if (m) { const d = decodeShare(m[1]); if (d) { G.word = d.word; G.msg = d.msg; G.fromShare = true; return; } }
  G.word = "I♥U"; G.msg = ""; G.fromShare = false;
}
function setupLevels() {
  const chars = [...G.word].filter(c => c !== " ");
  G.levels = chars.map((c, i) => buildLevel(c, i, G.word));
}
function hint(text, dur) {
  $("hintText").textContent = text; $("hint").classList.add("show");
  clearTimeout(hint._t); if (dur) hint._t = setTimeout(() => $("hint").classList.remove("show"), dur);
}
function hideHint() { $("hint").classList.remove("show"); }
function hintOnce(key, text, dur) { if (G.hintShown[key]) return; G.hintShown[key] = 1; hint(text, dur); }

function newCat(x, y, dir) {
  const d0 = dir.x < 0 ? -0.4 : 0.4;
  return { x, y, vx: 0, vy: 0, face: "side", flip: dir.x < 0, walk: 0, move: 0, blink: 0, blinkT: 2, sq: 0, sqv: 0, lean: 0, dustT: 0, stepT: 0, moving: false, tilt: 0, slip: 0,
    dir: d0, dirT: d0, lift: 10, tailX: 8, tailW: 0, swing: 0, swingV: 0, pvx: 0, flick: 1, happyT: 0, mood: "", look: 0, lookY: 0, emberT: 0, endX: 0, sp: 0, mdx: d0 < 0 ? -1 : 1, mdy: 0 };
}
function startLevel(i) {
  G.li = i; G.mode = "play";
  const lv = G.levels[i]; lv.frames = []; lv.snaps = [];
  const s0 = lv.strokes[0], cx = s0.start.x, cy = s0.start.y;
  S = { lv, cat: newCat(cx, cy, s0.startDir), si: 0, pen: true, s: 0, ci: 0, hist: [{ s: 0, ci: 0 }], allDone: false, tension: 0, cam: { x: cx, y: cy + 0.2 }, t: 0,
    nearDing: false, spillT: 1.5, clearT: -1, recAcc: 0, anchor: null, ropes: [], knots: [], ringN: 0, gust: 0, windT: 1, ballRoll: -1, hapT: 0, frameN: 0, swatFx: null,
    train: [], canPick: false, near: null, stuckT: 0, bestD: 1e9, tgtKey: "", ffT: 0, chimeT: 0, pickN: 0 };
  S.ropes[0] = new Rope(cx, cy, SEG, strokeBudget(s0));
  lv.dogs.forEach(d => { d.awake = 0; d.cool = 0; d.swat = -1; });
  lv.pegs.forEach(p => { p.ang = 0; p.angv = 0; p.used = false; p.glowA = 0; p.spin = 0; p.wraps = 0; p.cool = 0; p.sink = 0; p.wTaken = false; p.wGone = 0; p.wWig = 0; p.wYawn = 0; p.wdx = 0; p.wdy = 0; });
  parts.length = 0; waves.length = 0; winds.length = 0;
  const T = terrainOf(lv); T.ensureScale(Z * DPR); T.prewarm(S.cam, playZ(), W, H, 0.5);
  if (i === 0) hint(COARSE ? "左手摇杆移动 · 靠近亮起的小鬼火，按右边按钮收集" : "WASD / 方向键移动 · 靠近亮起的小鬼火，按空格收集");
}
function activeTarget() {
  const lv = S.lv;
  if (S.allDone) return { x: lv.basket.x, y: lv.basket.y, type: "basket" };
  if (!S.pen) { const p = lv.strokes[S.si].start; return { x: p.x, y: p.y, type: "ball" }; }
  const c = lv.strokes[S.si].checks[S.ci]; return { x: c.x, y: c.y, type: "check", c, peg: c.peg };
}
function screenPos(x, y, cam, z) { return { x: (x - cam.x) * z + W / 2, y: (y - cam.y) * z + H / 2 }; }
function playZ() { return Z * (0.84 + 0.16 * easeOut(clamp(S.t / 1.1, 0, 1))); }
function panOf(x) { return clamp((screenPos(x, 0, S.cam, playZ()).x - W / 2) / W * 2, -1, 1); }

// ---------- particles ----------
function addP(o) { parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, max: 1, rot: 0, vr: 0, drag: 0 }, o)); if (parts.length > 260) parts.shift(); }
function sparkle(x, y, n, col = "#ffe08a", spd = 0.9) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (0.3 + Math.random()) * spd; addP({ k: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 0.3, g: 0.8, drag: 2.2, life: 0.6 + Math.random() * 0.5, max: 1, r: 0.012 + Math.random() * 0.018, col, rot: Math.random(), vr: 4 }); } }
function notes(x, y, n = 2) { for (let i = 0; i < n; i++) addP({ k: "note", x: x + (Math.random() - 0.5) * 0.2, y: y - 0.25, vx: (Math.random() - 0.5) * 0.3, vy: -0.45, g: -0.1, life: 1.3, max: 1.3, col: "#d99a1e" }); }
// "dust" = little glowing motes that float up (the ghost has no feet to kick up dirt)
function dust(x, y, n = 1, spd = 0.25) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; addP({ k: "dust", x: x + (Math.random() - 0.5) * 0.08, y: y + (Math.random() - 0.5) * 0.03, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.4 - 0.08, g: -0.25, drag: 3, life: 0.6 + Math.random() * 0.4, max: 1, r: 0.012 + Math.random() * 0.012 }); } }
function ember(x, y, sp = 1, a = 1) { addP({ k: "ember", x, y, vx: (Math.random() - 0.5) * 0.14 * sp, vy: -0.1 - Math.random() * 0.16 * sp, g: -0.05, drag: 1.2, life: 0.6 + Math.random() * 0.7, max: 1.3, r: 0.01 + Math.random() * 0.014, rot: Math.random(), a }); }
function textPop(x, y, text, col, size) { addP({ k: "text", x, y, vy: -0.12, life: 1.8, max: 1.8, text, col, size }); }
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.vy += p.g * dt; if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; if (p.life <= 0) parts.splice(i, 1);
  }
  for (let i = waves.length - 1; i >= 0; i--) { waves[i].t += dt; if (waves[i].t > waves[i].dur) waves.splice(i, 1); }
}
function updateWind(dt, cam, z) {
  S.gust = Math.max(0, S.gust - dt * 0.35); S.windT -= dt;
  if (S.windT <= 0) {
    S.windT = 1.0 + Math.random() * 1.8;
    const hw = W / 2 / z, hh = H / 2 / z;
    winds.push({ x: cam.x - hw * 0.9 + Math.random() * hw * 1.2, y: cam.y - hh * 0.8 + Math.random() * hh * 1.6, L: 0.6 + Math.random() * 0.7, ph: Math.random() * 6, dir: Math.random() < 0.5 ? 1 : -1, t: 0, dur: 1.8 + Math.random() * 0.8 });
    if (Math.random() < 0.35) { S.gust = 1; AU.gust();
      for (let i = 0; i < 3; i++) addP({ k: "leaf", x: cam.x - hw + Math.random() * hw, y: cam.y - hh + Math.random() * hh * 2, vx: ART.WIND.x * (0.6 + Math.random() * 0.4), vy: ART.WIND.y * 0.6 + 0.05, life: 3, max: 3, rot: Math.random() * 6, vr: 3 + Math.random() * 3, col: Math.random() < 0.5 ? "#8cc45a" : "#c9d86a" }); }
  }
  for (let i = winds.length - 1; i >= 0; i--) { winds[i].t += dt; if (winds[i].t > winds[i].dur) winds.splice(i, 1); }
}

// ---------- events ----------
function ringCheck() {
  const lv = S.lv, st = lv.strokes[S.si], c = st.checks[S.ci], p = c.peg, rope = S.ropes[S.si];
  p.used = true; p.wraps++; p.spin += p.kind === "spool" ? 9 : 0;
  const wp = wispPos(p, G.t), by = wp.y;
  if (p.kind === "spool") AU.creak(panOf(p.x), 1.4);
  AU.ring(S.ringN++); AU.bell(2093, 0.04, panOf(p.x) * 0.5, 0.06, 0.5);
  haptic(22); act.flash = 1;
  p.wTaken = true; S.train.push({ x: wp.x, y: wp.y, ph: p.ph, peg: p, t: 0 }); S.pickN++;
  waves.push({ x: p.x, y: p.y, t: 0, dur: 1.1, r: 0.7, col: "rgba(255,226,140,A)" }, { x: p.x, y: p.y, t: -0.15, dur: 1.1, r: 0.45, col: "rgba(255,255,255,A)" });
  sparkle(wp.x, by, 14); S.cat.happyT = 1.4; S.stuckT = 0; S.bestD = 1e9;
  S.s = c.arc; S.ci++; S.nearDing = false; S.spillT = 1.8;
  if (G.li === 0 && S.si === 0 && S.ci === 1) hideHint();
  if (S.ci >= st.checks.length) {
    rope.tie(p, c.x, c.y); const k = rope.p[rope.p.length - 1];
    S.knots.push({ x: k.x, y: k.y + 0.01, t: 0, si: S.si }); AU.knot(); sparkle(k.x, k.y, 12, "#ffc46a", 0.7); for (let j = 0; j < 6; j++) ember(k.x, k.y, 2.5);
    S.pen = false; S.si++;
    if (S.si >= lv.strokes.length) { S.allDone = true; hintOnce("basket", "把灯火送回大南瓜灯吧", 2600); }
    else { S.ballRoll = 0; hintOnce("ball", "灯线系好啦，去下一根小蜡烛接新的火苗", 2600); }
  } else { rope.pinAt(p, c.x, c.y); S.hist.push({ s: S.s, ci: S.ci }); }
}
function pickUp() {
  const lv = S.lv, st = lv.strokes[S.si]; S.pen = true; S.s = 0; S.ci = 0; S.hist = [{ s: 0, ci: 0 }];
  S.ropes[S.si] = new Rope(st.start.x, st.start.y, SEG, strokeBudget(st));
  AU.pop(); sparkle(st.start.x, st.start.y - 0.12, 12, "#ffcf80", 0.7); for (let j = 0; j < 5; j++) ember(st.start.x, st.start.y - 0.14, 2); S.nearDing = false; S.ballRoll = -1;
}
function swat(d) {
  const lv = S.lv, cat = S.cat, rope = S.ropes[S.si];
  d.cool = 2.8; d.awake = 1.6; d.swat = 0; AU.swat(); AU.grumble(); haptic([30, 40, 30]);
  if (S.hist.length > 1) {
    S.hist.pop(); const peg = rope.unpin();
    if (peg) { peg.used = false; peg.wTaken = false; for (let i = S.train.length - 1; i >= 0; i--) if (S.train[i].peg === peg) { S.train.splice(i, 1); break; } peg.wraps = Math.max(0, peg.wraps - 1); peg.angv -= 6; sparkle(peg.x, peg.y - 0.05, 8, "#ffffff", 0.8); waves.push({ x: peg.x, y: peg.y, t: 0, dur: 0.6, r: 0.3, col: "rgba(255,255,255,A)" }); AU.boing(); }
  }
  const h = S.hist[S.hist.length - 1]; S.s = h.s; S.ci = h.ci;
  const dx = cat.x - d.x, dy = cat.y - d.y, l = hyp(dx, dy) || 1;
  cat.vx = dx / l * 2.2; cat.vy = dy / l * 2.2; cat.sq = -0.12; cat.x += dx / l * 0.12; cat.y += dy / l * 0.12;
  dust(cat.x, cat.y, 5, 0.5); S.nearDing = false;
  textPop(d.x + 0.05 * d.face, d.y - 0.3, "呜…Zzz", "#5a6290", 15);
  hintOnce("dog", "汪！狗狗把灯线拨掉了一截，绕回去吧", 2400);
}
// right-thumb action: pick up the NEXT wisp; anything else gets a harmless reaction
function pressAction() {
  if (G.mode !== "play" || !S || S.clearT >= 0) return;
  act.flash = Math.max(act.flash, 0.35);
  if (S.canPick) { ringCheck(); return; }
  const n = S.near; if (!n) return;
  if (!n.real) { if (!n.wGone) { n.wGone = 0.001; n.wYawn = 1; AU.tone(330, 0.5, { vol: 0.05, slide: 0.6, type: "triangle" }); textPop(n.x, n.y - n.h - 0.4, "呵啊~", "#7d8db0", 13); } }
  else if (!n.wTaken) { n.wWig = 1; AU.tone(520, 0.08, { vol: 0.05, type: "triangle" }); AU.tone(440, 0.1, { vol: 0.04, type: "triangle", when: 0.08 }); textPop(n.x, n.y - n.h - 0.42, "还没轮到我~", "#b57a2a", 13); }
}
function levelClear() {
  S.clearT = 0; AU.clear(); AU.setTension(0); hideHint();
  sparkle(S.lv.basket.x, S.lv.basket.y - 0.15, 22); notes(S.lv.basket.x, S.lv.basket.y - 0.1, 3);
  const lv = S.lv; setTimeout(() => { try { terrainOf(lv).buildFull(); } catch (e) {} }, 650);
}

// ---------- update ----------
function flickAt(t) { return 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3)); }
// floating ghost: bob, lean into motion, tail wisp trails behind, lantern swings on its handle
function animCat(cat, dt, mvx, mvy, tension) {
  const idt = 1 / Math.max(dt, 1e-4), vx = mvx * idt, vy = mvy * idt, sp = hyp(vx, vy), moving = sp > 0.12;
  const prevMove = cat.move;
  cat.move += ((moving ? clamp(sp / 1.6, 0.35, 1) : 0) - cat.move) * Math.min(1, dt * 10);
  if (prevMove < 0.3 && cat.move >= 0.3) cat.sqv -= 1.6; // stretch on take-off
  if (prevMove > 0.3 && cat.move <= 0.3) cat.sqv += 1.8; // squash on stop
  cat.sqv += (-cat.sq * 320 - cat.sqv * 13) * dt; cat.sq += cat.sqv * dt; cat.sq = clamp(cat.sq, -0.16, 0.16);
  if (moving && Math.abs(vx) > 0.12) cat.dirT = clamp(vx / 1.3, -1, 1);
  cat.dir += (cat.dirT - cat.dir) * Math.min(1, dt * 14); cat.flip = cat.dir < 0;
  const leanT = clamp(vx * 0.085, -0.2, 0.2) * cat.move + (tension > 0.2 ? Math.sign(cat.dir || 1) * 0.22 * tension + Math.sin(G.t * 20) * 0.03 * tension : 0);
  cat.lean += (leanT - cat.lean) * Math.min(1, dt * 12);
  const tailT = moving && Math.abs(vx) > 0.25 ? -Math.sign(vx) * clamp(8 + Math.abs(vx) * 3, 8, 15) : (cat.tailX < 0 ? -10 : 10);
  cat.tailX += (tailT - cat.tailX) * Math.min(1, dt * 4); cat.tailW = Math.sin(G.t * 3.2) * 2 + Math.sin(G.t * 1.7 + 1) * 1.1;
  const liftT = 10 + Math.sin(G.t * 2.2) * 1.8 + cat.move * 1.5 - tension * 3;
  cat.lift += (liftT - cat.lift) * Math.min(1, dt * 6);
  const ax = clamp((vx - cat.pvx) * idt, -40, 40); cat.pvx = vx;
  cat.swingV += (-46 * cat.swing - 3.2 * cat.swingV + ax * 0.06 + Math.sin(G.t * 1.8) * 0.5) * dt; cat.swing = clamp(cat.swing + cat.swingV * dt, -0.6, 0.6);
  cat.flick = flickAt(G.t) * (tension > 0.3 ? 0.75 + 0.25 * Math.abs(Math.sin(G.t * 29)) : 1);
  cat.happyT = Math.max(0, (cat.happyT || 0) - dt);
  cat.mood = cat.happyT > 0 ? "happy" : tension > 0.35 ? "worried" : "";
  cat.look += (cat.dir * 1.3 - cat.look) * Math.min(1, dt * 8); cat.lookY += (clamp(vy * 0.5, -1.2, 1.0) - cat.lookY) * Math.min(1, dt * 6);
  cat.blinkT -= dt; if (cat.blinkT < 0) { cat.blinkT = 2 + Math.random() * 3.5; cat.blinkS = 0; }
  if (cat.blinkS != null) { cat.blinkS += dt; cat.blink = Math.sin(clamp(cat.blinkS / 0.16, 0, 1) * Math.PI); if (cat.blinkS > 0.16) { cat.blinkS = null; cat.blink = 0; } }
  cat.endX = ART.lanX(cat.dir);
  cat.moving = moving;
  return sp;
}
// test autopilot: decides a stick vector + when to press the action button (feeds the same input path as a thumb)
function botWant() {
  const lv = S.lv, cat = S.cat; let t = G.target;
  if (!t) {
    t = activeTarget();
    if (S.pen) { const st = lv.strokes[S.si], c = st.checks[S.ci];
      if (S.canPick) return { x: 0, y: 0, m: 0, press: true };
      t = pointAtArc(st, Math.min(S.s + 0.6, c.arc));
      const qa = nearestOnStroke(st, cat.x, cat.y, Math.max(0, S.s - 0.5), c.arc); if (qa && qa.d > 0.32) t = qa; }
  }
  const dx = t.x - cat.x, dy = t.y - cat.y, d = hyp(dx, dy);
  return d > 0.03 ? { x: dx / d, y: dy / d, m: clamp(d * 2.5, 0.35, 1), press: false } : { x: 0, y: 0, m: 0, press: false };
}
function autopilot() { const w = botWant(); const m = w.m; bot.x = w.x * m; bot.y = w.y * m; bot.m = m; if (w.press) act.queued = 1; }
function updatePlay(dt) {
  const lv = S.lv, cat = S.cat, M = lv.M;
  S.t += dt; G.t += dt;
  if (S.clearT >= 0) {
    S.clearT += dt;
    const ox = cat.x, oy = cat.y;
    cat.x = lerp(cat.x, lv.basket.x, Math.min(1, dt * 6)); cat.y = lerp(cat.y, lv.basket.y + 0.08, Math.min(1, dt * 6));
    animCat(cat, dt, cat.x - ox, cat.y - oy, 0);
    updateParts(dt); stepRopes(dt); record(dt);
    if (S.clearT > 1.3) { if (G.li + 1 < G.levels.length) startLevel(G.li + 1); else startReveal(); }
    return;
  }
  const z = playZ();
  // ---- input -> analog vector (stick / keys / autopilot); applied this same frame, no smoothing ----
  if (G.auto || G.target) autopilot();
  let ix = 0, iy = 0, im = 0;
  if (G.auto || G.target) { ix = bot.x; iy = bot.y; im = bot.m; }
  if (stick.active && stick.mag > 0) { ix = stick.x; iy = stick.y; im = stick.mag; }
  else if (!G.auto && !G.target) { const k = input.keys; const kx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0), ky = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0), l = hyp(kx, ky); if (l) { ix = kx / l; iy = ky / l; im = 1; } }
  if (act.queued) { act.queued = 0; pressAction(); }
  // ---- Genshin-style locomotion: speed from deflection (walk <60%, run above), snappy accel/decel, near-instant turning ----
  const WALK = 1.2, RUN = 2.5, ACC = RUN / 0.1, DEC = RUN / 0.06;
  const tgtSp = im <= 0 ? 0 : im < 0.6 ? WALK * (0.4 + 0.6 * im / 0.6) : lerp(WALK, RUN, (im - 0.6) / 0.4);
  if (im > 0) {
    const il = hyp(ix, iy) || 1, ux = ix / il, uy = iy / il, dot = ux * cat.mdx + uy * cat.mdy;
    if (cat.sp < 0.05 || dot < -0.3) { cat.mdx = ux; cat.mdy = uy; }
    else { const k = 1 - Math.exp(-dt * 30), mx = lerp(cat.mdx, ux, k), my = lerp(cat.mdy, uy, k), ml = hyp(mx, my) || 1; cat.mdx = mx / ml; cat.mdy = my / ml; }
  }
  cat.sp = tgtSp > cat.sp ? Math.min(tgtSp, cat.sp + ACC * dt) : Math.max(tgtSp, cat.sp - DEC * dt);
  let nx = cat.x + cat.mdx * cat.sp * dt, ny = cat.y + cat.mdy * cat.sp * dt, tension = 0;
  S.anchor = null;
  if (S.pen) { // off-route: no yank. Moving further away gets progressively slower (stops ~1.2 off the route); coming back is free.
    const st = lv.strokes[S.si], c = st.checks[S.ci], aMax = Math.min(st.L, c.arc + 0.3);
    const TOL = 0.42, HARD = 1.2;
    const q0 = nearestOnStroke(st, cat.x, cat.y, 0, aMax), q = nearestOnStroke(st, nx, ny, 0, aMax);
    if (q.d > TOL) {
      tension = Math.min(1, (q.d - TOL) / (HARD - TOL));
      const f = q.d > q0.d ? Math.pow(Math.max(0, 1 - tension), 1.4) : 1 - 0.25 * tension;
      nx = cat.x + (nx - cat.x) * f; ny = cat.y + (ny - cat.y) * f;
      S.anchor = q;
    }
  }
  // soft push around decoy posts (never real ones, never a wall)
  for (const p of lv.grid.near(nx, ny)) { if (p.real) continue; const dx = nx - p.x, dy = ny - p.y, d = hyp(dx, dy), r = p.cr + 0.06; if (d < r && d > 1e-4) { nx = p.x + dx / d * r; ny = p.y + dy / d * r; } }
  nx = clamp(nx, M.x0 + 0.15, M.x1 - 0.15); ny = clamp(ny, M.y0 + 0.15, M.y1 - 0.15);
  const mvx = nx - cat.x, mvy = ny - cat.y;
  cat.x = nx; cat.y = ny; cat.vx = mvx / Math.max(dt, 1e-4); cat.vy = mvy / Math.max(dt, 1e-4);
  S.tension += (tension - S.tension) * Math.min(1, dt * 10);
  const sp = animCat(cat, dt, mvx, mvy, S.tension);
  AU.setTension(S.tension > 0.12 ? S.tension : 0);
  if (S.tension > 0.35) hintOnce("tension", "灯线快不够了…往回飘一飘", 2200);
  S.hapT -= dt; if (S.tension > 0.45 && S.hapT <= 0) { S.hapT = 0.4; haptic(12); }
  cat.dustT -= dt;
  if ((sp > 0.9 || S.tension > 0.4) && cat.dustT <= 0) { cat.dustT = S.tension > 0.4 ? 0.07 : sp > 1.8 ? 0.06 : 0.12; dust(cat.x - (cat.vx > 0 ? 0.08 : -0.08), cat.y + 0.01, S.tension > 0.4 ? 2 : 1, S.tension > 0.4 ? 0.35 : 0.18); }
  // spark trail behind the lantern + embers drifting off the newest thread
  cat.emberT -= dt * (0.6 + sp * 2.2 + S.tension * 5);
  if (cat.emberT <= 0) { cat.emberT = 0.18; const lx = cat.x + ART.lanX(cat.dir) * ART.GK, ly = cat.y - (cat.lift + 6) * ART.GK; ember(lx - cat.vx * 0.03, ly, 1, 0.9); }
  if (S.pen) { const r = S.ropes[S.si], n = r ? r.p.length : 0;
    if (n > 6 && Math.random() < dt * (3 + 22 * S.tension)) { const q = r.p[n - 2 - ((Math.random() * Math.min(n - 3, 32)) | 0)]; ember(q.x, q.y - 0.008, S.tension > 0.3 ? 1.6 : 0.7, 0.8); } }
  cat.stepT -= dt * sp; if (cat.stepT < 0) { cat.stepT = 0.28; AU.step(); }

  // ---- validation (route progress & ordered bell checkpoints) ----
  if (S.pen) {
    const st = lv.strokes[S.si], c = st.checks[S.ci];
    const q = nearestOnStroke(st, cat.x, cat.y, Math.max(0, S.s - 0.5), c.arc);
    if (q && q.d < 0.5) S.s = Math.max(S.s, q.arc);
    S.canPick = Math.min(hyp(cat.x - c.x, cat.y - c.y), hyp(cat.x - c.peg.x, cat.y - c.peg.y)) < 0.5 && S.s >= c.arc - 0.75;
  } else if (!S.allDone) {
    const b = lv.strokes[S.si].start; if (hyp(cat.x - b.x, cat.y - b.y) < 0.42) pickUp();
  } else if (hyp(cat.x - lv.basket.x, cat.y - lv.basket.y) < 0.45) levelClear();

  if (!S.pen || S.allDone) S.canPick = false;
  // nearest other wisp in reach (for decoy yawns / "not yet" wiggles)
  S.near = null; { let bd = 0.5; for (const p of lv.grid.near(cat.x, cat.y)) { if (!hasWisp(p) || p.wTaken || p.wGone) continue; const d = hyp(cat.x - p.x, cat.y - p.y); if (d < bd) { bd = d; S.near = p; } } }
  stepRopes(dt);
  const rope = S.pen ? S.ropes[S.si] : null;
  for (const d of lv.dogs) {
    d.cool -= dt; d.awake = Math.max(0, d.awake - dt); if (d.swat >= 0) { d.swat += dt * 2.6; if (d.swat > 1) d.swat = -1; }
    if (!S.pen || d.cool > 0) continue;
    let hit = hyp(cat.x - d.x, cat.y - d.y) < 0.42;
    if (!hit && rope && cat.moving && hyp(cat.x - d.x, cat.y - d.y) < 1.6) { // yarn dragged straight across the dog = a wrong shortcut
      const a = rope.p[rope.lastPin()], bx = cat.x - a.x, by = cat.y - a.y, L2 = bx * bx + by * by || 1e-6, u = clamp(((d.x - a.x) * bx + (d.y - a.y) * by) / L2, 0, 1);
      hit = hyp(a.x + bx * u - d.x, a.y + by * u - d.y) < 0.22 && rope.tension > 0.3; }
    if (hit) swat(d);
  }
  // ---- props ----
  const at = activeTarget();
  for (const p of lv.pegs) {
    if (p.wWig > 0) p.wWig = Math.max(0, p.wWig - dt * 1.4);
    if (p.wGone > 0 && p.wGone < 1) { p.wGone = Math.min(1, p.wGone + dt * 0.45); p.wYawn = Math.max(0, 1 - p.wGone * 2.5); p.wdx = Math.sin(p.ph) * p.wGone * 1.4; p.wdy = -p.wGone * 1.1; }
    if (p.kind === "spool") {
      let target = 0;
      if (p.touch || (at.peg === p && hyp(cat.x - p.x, cat.y - p.y) < 0.7)) { const rx = cat.x - p.x, ry = cat.y - p.y, r2 = Math.max(0.04, rx * rx + ry * ry); target = clamp((rx * cat.vy - ry * cat.vx) / r2, -12, 12) * (p.touch ? 1 : 0.4); }
      p.spin += (target - p.spin) * Math.min(1, dt * (target ? 6 : 1.2)); p.rot += p.spin * dt;
      if (Math.abs(p.spin) > 2.5) AU.creak(panOf(p.x), Math.min(1, Math.abs(p.spin) / 8));
    }
    p.touch = 0; p.cool = Math.max(0, p.cool - dt);
    const isT = at.peg === p, dd = hyp(cat.x - p.x, cat.y - p.y);
    p.glowA += ((isT ? (0.45 + 0.55 * clamp((2.6 - dd) / 1.4, 0, 1)) : 0) - p.glowA) * Math.min(1, dt * 4);

  }
  for (const k of S.knots) k.t += dt;
  if (S.ballRoll >= 0) S.ballRoll += dt;
  const da = hyp(cat.x - at.x, cat.y - at.y), pan = panOf(at.x);
  if (da < 1.6 && !S.nearDing) { S.nearDing = true; if (at.type === "check") AU.ding(pan * 0.6); else AU.softDing(pan * 0.6); }
  if (da > 2.3) S.nearDing = false;
  // soft chimes speed up as you close in on the next wisp
  S.chimeT -= dt; if (at.type === "check" && da < 1.3 && S.chimeT <= 0) { S.chimeT = 0.35 + da * 0.9; AU.bell(1760 + (1.3 - da) * 500, 0.02 + (1.3 - da) * 0.02, pan * 0.6, 0, 0.4); }
  if (S.canPick) hintOnce("pick", COARSE ? "小鬼火在等你！按右下角的按钮收集它" : "小鬼火在等你！按空格收集它", 2600);
  // stuck detection -> firefly hint
  const key = at.type + S.si + "." + S.ci; if (key !== S.tgtKey) { S.tgtKey = key; S.bestD = da; S.stuckT = 0; }
  if (da < S.bestD - 0.15) { S.bestD = da; S.stuckT = 0; } else S.stuckT += dt;
  if (S.stuckT > 8) S.ffT += dt; else S.ffT = 0;
  if (S.ffT > 0) { const per = 3.6, u = 0.5 - 0.5 * Math.cos(S.ffT / per * 6.283), src = at.peg ? wispPos(at.peg, G.t) : at;
    S.ff = { x: lerp(src.x, cat.x, u) + Math.sin(S.ffT * 4.1) * 0.08, y: lerp(src.y, cat.y - 0.3, u) + Math.sin(S.ffT * 5.3) * 0.06 };
    if (Math.random() < dt * 14) addP({ k: "dust", x: S.ff.x, y: S.ff.y, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1, g: 0, drag: 2, life: 0.7, max: 0.7, r: 0.02 }); }
  // collected wisps trail behind the ghost in a little train
  { let px = cat.x - cat.mdx * 0.12, py = cat.y - 0.2 - cat.mdy * 0.06;
    for (let i = 0; i < S.train.length; i++) { const w = S.train[i]; w.t += dt; const dx = w.x - px, dy = w.y - py, d = hyp(dx, dy) || 1e-6, gap = i ? 0.14 : 0.16;
      const tx = px + dx / d * gap, ty = py + dy / d * gap, k = 1 - Math.exp(-dt * (w.t < 0.6 ? 6 : 12)); w.x += (tx - w.x) * k; w.y += (ty - w.y) * k; px = w.x; py = w.y; } }
  act.flash = Math.max(0, act.flash - dt * 2.5);
  const spt = screenPos(at.x, at.y, S.cam, z), off = spt.x < 0 || spt.x > W || spt.y < 0 || spt.y > H;
  S.spillT -= dt; if (off && S.spillT <= 0) { S.spillT = 2.6; AU.softDing(pan); }
  // camera: critically-damped follow with look-ahead toward motion and the next guide
  const dl = Math.max(da, 0.001), lead = Math.min(0.34, da * 0.18);
  const tx = cat.x + cat.vx * 0.28 + (at.x - cat.x) / dl * lead * 0.6, ty = cat.y + cat.vy * 0.2 + (at.y - cat.y) / dl * lead * 0.6 - 0.12;
  const kc = 1 - Math.exp(-dt * 5); S.cam.x += (tx - S.cam.x) * kc; S.cam.y += (ty - S.cam.y) * kc;
  updateParts(dt); updateWind(dt, S.cam, z); record(dt);
}
function ropeEnd(cat) { return { x: cat.x + ART.lanX(cat.dir || 0) * ART.GK, y: cat.y - 0.004 }; }
function stepRopes(dt) {
  const e = ropeEnd(S.cat);
  S.ropes.forEach((r, i) => { if (!r) return; if (r.attached) r.step(dt, e.x, e.y, S.lv.grid); else if ((r.settle = (r.settle ?? 1.5) - dt) > 0) r.step(dt, 0, 0, S.lv.grid); });
}
function record(dt) {
  S.recAcc += dt; const lv = S.lv, c = S.cat;
  while (S.recAcc >= 1 / 30) {
    S.recAcc -= 1 / 30;
    lv.frames.push([c.x, c.y, S.cam.x, S.cam.y, S.si, S.ci, S.pen ? 1 : 0, 0, 0, c.walk, S.allDone ? 1 : 0, S.s, c.dir, c.move]);
    if ((lv.frames.length - 1) % 3 === 0) lv.snaps.push({ f: lv.frames.length - 1, r: S.ropes.map(r => { if (!r) return null; if (!r.attached && r.settle <= 0) return r._snap || (r._snap = r.snapshot()); return r.snapshot(); }) });
  }
}

// ---------- rendering ----------
function viewRect(cam, z) { return { x0: cam.x - W / 2 / z, x1: cam.x + W / 2 / z, y0: cam.y - H / 2 / z, y1: cam.y + H / 2 / z }; }
const inV = (x, y, v, m = 0.4) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m * 1.6;
function flatLen(P) { let L = 0; for (let i = 2; i < P.length; i += 2) L += hyp(P[i] - P[i - 2], P[i + 1] - P[i - 1]); return L; }
// V: {cat, cam, z, si, ci, pen, allDone, ropes, live, fx}
function renderWorld(lv, V) {
  const t = G.t, fx = V.fx || {}, cam = V.cam, z = V.z, T = terrainOf(lv);
  T.ensureScale(Z * DPR);
  T.draw(ctx, cam, z, W, H, DPR, V.live ? 3 : 6);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
  const v = viewRect(cam, z), D = lv.decor, far = z < Z * 0.6;
  const gust = S && S.lv === lv ? S.gust : 0;
  if (!far) { ART.drawTufts(ctx, D, v, t, gust); ART.drawTallFlowers(ctx, D, v, t, gust); }
  for (const w of waves) ART.drawRingWave(ctx, w);
  const sink = fx.pegFall || 0;
  // at = current guide
  let at = null;
  if (!fx.reveal) {
    if (V.allDone) at = { x: lv.basket.x, y: lv.basket.y, type: "basket" };
    else if (!V.pen) { const p = lv.strokes[V.si].start; at = { x: p.x, y: p.y, type: "ball" }; }
    else { const c = lv.strokes[V.si].checks[V.ci]; at = { x: c.x, y: c.y, type: "check", peg: c.peg }; }
  }
  const da = at ? hyp(V.cat.x - at.x, V.cat.y - at.y) : 9;
  const glowA = at ? (0.45 + 0.55 * clamp((2.6 - da) / 1.4, 0, 1)) * (0.85 + 0.15 * Math.sin(t * 5)) : 0;
  const red = fx.red || 0;
  // yarn on the ground (under props); during the reveal it is drawn on top instead
  // the lantern's warm light pool on the grass
  if (!fx.hideCat && !fx.dark) ART.drawLampPool(ctx, V.cat.x + ART.lanX(V.anim.dir || 0) * ART.GK, V.cat.y, V.anim.flick == null ? 1 : V.anim.flick, 1 - (fx.catFade || 0));
  if (!fx.dark) drawRopes(lv, V, fx);
  // y-sorted props
  const items = [];
  const used = p => V.live ? p.used : p.real && (p.si < V.si || (p.si === V.si && p.ci < V.ci) || V.allDone);
  for (const p of lv.pegs) {
    if (!inV(p.x, p.y, v)) continue;
    const s = sink > 0 ? clamp(sink * 1.7 - p.fall * 0.7, 0, 1) : 0; if (s >= 1) continue;
    items.push([p.y, () => {
      const u = used(p), isT = at && at.peg === p, wr = V.live ? p.wraps : (u ? 1 : 0);
      if (p.kind === "spool") ART.drawSpool(ctx, p, { sink: s, glow: isT ? glowA : 0, rot: p.rot, spin: V.live ? p.spin : 0, wrapped: wr, red });
      else {
        ART.drawPost(ctx, p, { sink: s, wrapped: wr, red });
      }
      if (hasWisp(p) && !u && !fx.reveal && s <= 0 && !(V.live && p.wGone >= 1)) {
        const wp = wispPos(p, t), g = isT ? glowA : 0;
        let x = wp.x, y = wp.y, state = isT ? "next" : p.real ? "wait" : "decoy";
        if (isT) { const r = 0.05 + 0.03 * g; x += Math.cos(t * 3.2 + p.ph) * r; y += Math.sin(t * 3.2 + p.ph) * r * 0.55; } // circles in place
        ART.drawWisp(ctx, x, y, { state, glow: g, t, ph: p.ph, s: isT ? 1 + 0.15 * g : 0.85, a: V.live && p.wGone ? 1 - p.wGone : 1, wig: V.live ? p.wWig : 0, yawn: V.live ? p.wYawn : 0, happy: isT && V.live && S.canPick });
      }
    }]);
  }
  const hideProps = clamp(sink * 2, 0, 1);
  if (hideProps < 1) {
    for (const d of lv.dogs) if (inV(d.x, d.y, v)) items.push([d.y, () => { ctx.globalAlpha = 1 - hideProps; ART.drawDog(ctx, V.live ? d : { ...d, awake: 0, swat: -1 }, t); ctx.globalAlpha = 1;
      if (!V.live || d.awake <= 0) { const k = (t * 0.45 + d.ph) % 1; ART.bubble(ctx, d.x + 0.16 * d.face + k * 0.06, d.y - 0.28 - k * 0.14, z, "z", (1 - k) * (1 - hideProps) * 0.9, "#5a6aa0", 12 + k * 6); }
      else if (d.awake > 1.0) ART.bubble(ctx, d.x + 0.1 * d.face, d.y - 0.42, z, "!", 1, "#e0503f", 22); }]);
    // yarn balls at stroke starts
    for (let si = 0; si < lv.strokes.length; si++) {
      const st = lv.strokes[si], b = st.start; if (!inV(b.x, b.y, v)) continue;
      const P = V.ropes[si];
      // stroke start = a little pumpkin candle the thread is lit from (wax melts as the thread is paid out)
      if (P) { const rem = clamp(1 - flatLen(P) / strokeBudget(st), 0.12, 1); items.push([b.y - 0.01, () => { ctx.globalAlpha = 1 - hideProps; ART.drawCandle(ctx, b.x, b.y, t, { melt: rem, lit: 1 }); ctx.globalAlpha = 1; }]); }
      else if (si === V.si && !V.pen && !V.allDone) {
        const rl = V.live && S.ballRoll >= 0 ? S.ballRoll : 0, roll = Math.sin(rl * 5) * Math.exp(-rl * 0.6) * 0.03;
        items.push([b.y, () => ART.drawCandle(ctx, b.x + roll, b.y, t, { glow: glowA, bounce: Math.abs(Math.sin(t * 3)) * 0.012, lit: 1 })]);
      }
    }
    if (V.allDone || (fx.reveal && false)) items.push([lv.basket.y, () => ART.drawBigPumpkin(ctx, lv.basket, t, at && at.type === "basket" ? glowA : 0)]);
  }
  if (V.live && S.train.length) S.train.forEach((w, i) => items.push([w.y + 0.2, () => ART.drawWisp(ctx, w.x, w.y + Math.sin(t * 3 + i) * 0.015, { state: "train", glow: 0.4, t, ph: w.ph, s: 0.75 })]));
  if (!fx.hideCat) items.push([V.cat.y + 0.001, () => { ctx.globalAlpha = 1 - (fx.catFade || 0); ART.drawGhost(ctx, V.cat.x, V.cat.y, V.anim, V.anim.k); ctx.globalAlpha = 1;
    if (V.live && S.tension > 0.3) ART.strain(ctx, V.cat.x + (V.anim.dir < 0 ? -0.14 : 0.14), V.cat.y - 0.33, S.tension, G.t, V.anim.dir < 0); }]);
  // dust under everything else
  for (const p of parts) if (p.k === "dust") ART.drawParticle(ctx, p, z);
  items.sort((a, b) => a[0] - b[0]); for (const it of items) it[1]();
  // knots
  for (let si = 0; si < lv.strokes.length; si++) {
    const P = V.ropes[si]; if (!P || !(si < V.si || V.allDone)) continue;
    const kn = V.live ? S.knots.find(k => k.si === si) : null, n = P.length;
    if (!fx.dark) ART.drawTie(ctx, P[n - 2], P[n - 1], kn ? kn.t * 2.5 : 1, red > 0.5 ? 1 : 0);
  }
  for (const p of parts) if (p.k !== "dust") ART.drawParticle(ctx, p, z);
  if (V.live && S.ffT > 0 && S.ff) ART.drawFirefly(ctx, S.ff.x, S.ff.y, t, clamp(S.ffT / 0.6, 0, 1));
  if (!far) for (const w of winds) ART.drawWindStreak(ctx, w);
  ART.drawCloudShadows(ctx, v, t, T.B);
  // reveal: dusk falls, the yarn glows red above everything
  if (fx.dark) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(14,16,40,${fx.dark * 0.95})`); g.addColorStop(0.5, `rgba(38,30,70,${fx.dark * 0.93})`); g.addColorStop(0.85, `rgba(92,48,82,${fx.dark * 0.9})`); g.addColorStop(1, `rgba(170,84,88,${fx.dark * 0.88})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
    drawRopes(lv, V, fx);
    for (const p of parts) if (p.k === "spark") ART.drawParticle(ctx, p, z);
  }
  return at;
}
function drawRopes(lv, V, fx) {
  const red = fx.red || 0, glow = fx.glow || 0, w = lerp(Math.max(0.014, 1.6 / V.z), Math.max(0.06, 6.5 / V.z), red);
  if (glow > 0 && fx.snap != null) { // bloom
    ctx.globalCompositeOperation = "lighter";
    for (const st of lv.strokes) for (let a = 0; a <= st.L; a += 0.35) { const p = pointAtArc(st, a); ART.spr(ctx, ART.SPR.lamp, p.x, p.y, 0.8, 0.8, 0.2 * glow); }
    ctx.globalCompositeOperation = "source-over";
  }
  for (let si = 0; si < lv.strokes.length; si++) {
    let P = V.ropes[si]; if (!P || P.length < 4) continue;
    if (fx.snap != null) {
      const N = 90, a = resampleFlat(P, N), c = lv._canon || (lv._canon = []);
      if (!c[si]) c[si] = resampleFlat(ptsToFlat(lv.strokes[si].pts), N);
      const s = fx.snap, e = s <= 0 ? 0 : 1 - Math.exp(-7 * s) * Math.cos(11 * s);
      P = new Float32Array(N * 2); for (let i = 0; i < N * 2; i++) P[i] = lerp(a[i], c[si][i], e);
    }
    const live = V.live && S.ropes[si] && S.ropes[si].attached;
    ART.drawEmber(ctx, P, { litTo: live ? S.ropes[si].lastPin() : 0, w, lit: red, glow, t: G.t, tension: live ? Math.max(S.tension, S.ropes[si].tension * 0.4) : 0, vibFrom: live ? S.ropes[si].lastPin() : 0, live, boost: fx.boost || 0, seg: fx.snap != null ? 0.1 : SEG });
  }
}
function ropesNow() { return S.ropes.map(r => r ? r.snapshot() : null); }
function drawSpill(at, cam, z) {
  const sp = screenPos(at.x, at.y, cam, z), m = 14;
  if (sp.x > m && sp.x < W - m && sp.y > m && sp.y < H - m) return;
  const cx = W / 2, cy = H / 2, dx = sp.x - cx, dy = sp.y - cy;
  const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
  const ex = cx + dx * s, ey = cy + dy * s, t = G.t, l = hyp(dx, dy) || 1;
  ctx.globalCompositeOperation = "lighter";
  const pu = 0.75 + 0.25 * Math.sin(t * 2.6), horiz = Math.abs(ex - cx) / (W / 2) > Math.abs(ey - cy) / (H / 2);
  for (let i = 0; i < 2; i++) ART.spr(ctx, ART.SPR.glow, ex, ey, (horiz ? 70 : 170) * pu, (horiz ? 170 : 70) * pu, 0.9 * pu);
  ART.spr(ctx, ART.SPR.glowW, ex, ey, (horiz ? 26 : 60) * pu, (horiz ? 60 : 26) * pu, 0.45 * pu);
  ctx.globalCompositeOperation = "source-over";
}
let SAT = 0;
function drawHUD() {
  const lv = S.lv, t = G.t, top = 14 + SAT;
  let rem = 0;
  const rope = S.pen ? S.ropes[S.si] : null;
  if (rope) rem = clamp(1 - rope.length() / rope.budget, 0, 1);
  const shake = S.tension > 0.15 ? Math.sin(t * 55) * 4 * S.tension : 0;
  const cx = 44 + SAL + shake, cy = top + 30, R0 = 27;
  ctx.save();
  ART.shadow(ctx, cx + 1, cy + 5, R0 + 8, R0 + 6, 0.35);
  ctx.fillStyle = "rgba(255,252,244,.86)"; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "rgba(170,130,70,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R0 - 3.5, 0, 6.283); ctx.stroke();
  if (S.pen || S.allDone) {
    const shown = S.allDone ? 0 : rem;
    ctx.lineCap = "round"; ctx.lineWidth = 4.5; ctx.strokeStyle = "rgba(90,70,40,.12)"; ctx.beginPath(); ctx.arc(cx, cy, R0 + 5, 0, 6.283); ctx.stroke();
    const low = S.tension > 0.3;
    ctx.strokeStyle = low ? `rgb(${240},${100 + 50 * Math.sin(t * 12)},50)` : "#f09a3a"; ctx.beginPath(); ctx.arc(cx, cy, R0 + 5, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.max(0.001, shown)); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R0 + 5, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.max(0.001, shown)); ctx.stroke();
    ART.drawHUDCandle(ctx, cx, cy, S.allDone ? 0.15 : rem, t, low, false);
  } else {
    ART.drawHUDCandle(ctx, cx, cy, 0, t, false, true);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = "#c9a56b"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, 12 + Math.sin(t * 4) * 1.5, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // level pips (diamonds)
  const n = G.levels.length, gap = 20, x0 = W / 2 - (n - 1) * gap / 2, py = top + 12;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, s = i === G.li ? 6.5 : 5;
    ctx.save(); ctx.translate(x, py); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < G.li ? "#f0b64a" : i === G.li ? "rgba(255,252,240,.95)" : "rgba(255,252,240,.45)";
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 4; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.shadowBlur = 0;
    if (i === G.li) { ctx.strokeStyle = "#e6a83a"; ctx.lineWidth = 1.4; ctx.strokeRect(-s / 2 - 2.5, -s / 2 - 2.5, s + 5, s + 5); }
    ctx.restore();
  }
}
function drawControls(dt) {
  if (G.mode !== "play" || !S || S.clearT >= 0) return;
  // joystick: floating while touched, faint resting hint otherwise
  stick.a += ((stick.active ? 1 : COARSE ? 0.42 : 0) - stick.a) * Math.min(1, dt * (stick.active ? 30 : 8));
  if (!stick.active) { const r = restBase(); stick.bx += (r.x - stick.bx) * Math.min(1, dt * 10); stick.by += (r.y - stick.by) * Math.min(1, dt * 10);
    stick.kx += (stick.bx - stick.kx) * Math.min(1, dt * 22); stick.ky += (stick.by - stick.ky) * Math.min(1, dt * 22); } // knob springs back
  ART.drawStick(ctx, { bx: stick.bx, by: stick.by, kx: stick.kx, ky: stick.ky, R: STICK_R, mag: stick.mag, a: stick.a, active: stick.active, run: stick.run }, G.t);
  const b = btnPos(), st = S.canPick ? "on" : S.near ? "soft" : "off";
  if (COARSE || S.canPick) ART.drawActionBtn(ctx, { x: b.x, y: b.y, r: b.r, state: st, press: act.down, flash: act.flash }, G.t);
}
function catAnimFromFrame(f, t) {
  const dir = +f[12] || 0, mv = f[13] || 0;
  return { t, dir, move: mv, flip: dir < 0, blink: 0, lift: 10 + Math.sin(t * 2.2) * 1.8 + mv * 1.5, tailX: mv > 0.3 && Math.abs(dir) > 0.2 ? -Math.sign(dir) * 12 : 10, tailW: Math.sin(t * 3.2) * 2,
    swing: Math.sin(t * 1.8) * 0.1, flick: flickAt(t), lean: dir * mv * 0.12, look: dir * 1.3, sq: 0, carry: !!f[6], endX: ART.lanX(dir), mood: "" };
}

// ---------- reveal ----------
function snapAt(lv, idx) {
  const S2 = lv.snaps; if (!S2.length) return [];
  let lo = 0, hi = S2.length - 1; if (S2[hi].f <= idx) return S2[hi].r;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S2[m].f <= idx) lo = m; else hi = m; }
  return S2[lo].r;
}
function frameView(lv, i) {
  const n = lv.frames.length, f = lv.frames[clamp(i | 0, 0, n - 1)];
  return { cat: { x: f[0], y: f[1] }, anim: catAnimFromFrame(f, G.t), cam: { x: f[2], y: f[3] }, si: f[4], ci: f[5], pen: !!f[6], allDone: !!f[10], ropes: snapAt(lv, i | 0) };
}
function finalRopes(lv) { return lv.snaps.length ? lv.snaps[lv.snaps.length - 1].r : []; }
function fullZ() { return Math.min(W * 0.84 / (4 * LS + 1.2), H * 0.84 / (6 * LS + 1.2)); }
function startReveal() {
  G.mode = "rewind"; hideHint(); AU.setTension(0); AU.musicLevel(0.5);
  const durs = G.levels.map(lv => clamp(lv.frames.length / 30 * 0.2, 0.6, 1.2));
  R = { t: 0, phase: "freeze", li: G.levels.length - 1, durs };
  parts.length = 0; waves.length = 0; winds.length = 0;
  ["start", "word", "custom"].forEach(id => $(id).classList.remove("show"));
}
function updateReveal(dt) {
  R.t += dt * (input.down ? 2 : 1); G.t += dt;
  if (R.phase === "freeze" && R.t > 0.5) { R.phase = "rewind"; R.t = 0; AU.rewind(R.durs.reduce((a, b) => a + b, 0)); }
  else if (R.phase === "rewind" && R.t > R.durs[R.li]) { R.t = 0; if (R.li > 0) R.li--; else { terrainOf(G.levels[0]).buildFull(); R.phase = "pull"; AU.whoosh(); } }
  else if (R.phase === "pull" && R.t > 1.4) { R.phase = "replay"; R.t = 0; }
  else if (R.phase === "replay" && R.t > 1.6) { R.phase = "snap"; R.t = 0; AU.snap(); setTimeout(() => R && R.phase === "snap" && AU.sink(), 200); setTimeout(() => R && R.phase === "snap" && AU.bell(784, 0.1), 300); haptic(40); }
  else if (R.phase === "snap" && R.t > 2.8) { R.phase = "xfade"; R.t = 0; }
  else if (R.phase === "xfade" && R.t > 0.6) {
    R.t = 0; if (R.li + 1 < G.levels.length) { R.li++; terrainOf(G.levels[R.li]).buildFull(); R.phase = "pull"; AU.whoosh(); } else startWord();
  }
  if (R.phase === "snap") { // sparkles along the glowing letter
    const lv = G.levels[R.li], st = lv.strokes[(Math.random() * lv.strokes.length) | 0];
    if (R.t > 0.4 && Math.random() < dt * 30) { const p = pointAtArc(st, Math.random() * st.L); sparkle(p.x, p.y, 1, Math.random() < 0.5 ? "#ffe2b0" : "#ffb0a0", 0.3); }
    if (R.t < 1.6 && Math.random() < dt * 25) { const p = lv.pegs[(Math.random() * lv.pegs.length) | 0]; dust(p.x, p.y, 1, 0.3); }
    updateParts(dt);
  }
}
// collected wisps fly out of the ghost's train and line up along the letter, igniting it
function drawRevealWisps(lv, V, t) {
  const z = V.z, cam = V.cam; ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
  const tot = lv.strokes.reduce((a, s) => a + s.L, 0), n = lv.strokes.reduce((a, s) => a + s.checks.length, 0);
  if (!R.arr) R.arr = {};
  let k = 0;
  lv.strokes.forEach((st, si) => {
    const m = Math.max(1, Math.round(n * st.L / tot));
    for (let j = 0; j < m; j++, k++) {
      const tp = pointAtArc(st, st.L * (j + 0.5) / m), u = clamp((t - 0.1 - k * 0.1) / 0.8, 0, 1), e = ease(u);
      const sx = V.cat.x - 0.1 * (k % 3), sy = V.cat.y - 0.3 - 0.06 * k;
      const x = lerp(sx, tp.x, e), y = lerp(sy, tp.y, e) - Math.sin(e * Math.PI) * 0.6;
      if (u >= 1 && !R.arr[R.li + ":" + k]) { R.arr[R.li + ":" + k] = 1; sparkle(tp.x, tp.y, 6, "#ffe2a0", 0.5); AU.bell(1319 + k * 90, 0.03, 0, 0, 0.4); }
      ART.drawWisp(ctx, x, y + (u >= 1 ? Math.sin(G.t * 3 + k) * 0.03 : 0), { state: "train", glow: u >= 1 ? 1 : 0.5, t: G.t, ph: k, s: 3.2 * (u >= 1 ? 1 - 0.25 * clamp((t - 1.6) / 1, 0, 1) : 1) });
    }
  });
}
function renderReveal() {
  const lv = G.levels[R.li], n = lv.frames.length;
  let V, fx = { reveal: true };
  if (R.phase === "freeze") { V = frameView(lv, n - 1); V.z = Z; }
  else if (R.phase === "rewind") { V = frameView(lv, (1 - R.t / R.durs[R.li]) * (n - 1)); V.z = Z; fx.reveal = false; }
  else {
    const f0 = frameView(lv, 0), full = { x: 2 * LS, y: 3 * LS + 0.1 }, fz = fullZ();
    if (R.phase === "pull") { const e = ease(clamp(R.t / 1.4, 0, 1)); V = f0; V.cam = { x: lerp(f0.cam.x, full.x, e), y: lerp(f0.cam.y, full.y, e) }; V.z = Z * Math.pow(fz / Z, e); fx.boost = 0.2 * e; }
    else {
      if (R.phase === "replay") { V = frameView(lv, (R.t / 1.6) * (n - 1)); fx.boost = 0.25 + 0.6 * clamp(R.t / 1.6, 0, 1); } // embers reignite along the path
      else {
        V = frameView(lv, n - 1); V.ropes = finalRopes(lv);
        const t = R.phase === "snap" ? R.t : 2.8;
        fx.snap = t; fx.red = clamp((t - 0.3) / 0.8, 0, 1); fx.glow = clamp((t - 0.7) / 0.9, 0, 1) * (0.85 + 0.15 * Math.sin(G.t * 3)); fx.wisps = t;
        fx.pegFall = clamp((t - 0.15) / 1.3, 0, 1); fx.dark = clamp((t - 0.3) / 1.0, 0, 1);
        fx.catFade = clamp((t - 0.4) / 0.5, 0, 1); fx.hideCat = fx.catFade >= 1;
      }
      V.cam = full; V.z = fz * (R.phase === "snap" || R.phase === "xfade" ? 1 + 0.05 * ease(clamp(((R.phase === "snap" ? R.t : 2.8) - 0.3) / 1.8, 0, 1)) : 1);
    }
  }
  V.fx = fx; V.live = false;
  renderWorld(lv, V);
  if (fx.wisps != null) drawRevealWisps(lv, V, fx.wisps);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!fx.dark) ctx.drawImage(ART.postOverlay(W, H, DPR), 0, 0, W, H);
  else { // stars in the dusk
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 37.3) * 0.5 + 0.5) * H * 0.6, a = (0.3 + 0.4 * Math.sin(G.t * 2 + i)) * fx.dark; ART.spr(ctx, ART.SPR.glowW, x, y, 3, 3, a); }
    ctx.globalCompositeOperation = "source-over";
  }
  if (R.phase === "rewind" || R.phase === "freeze") {
    if (R.phase === "rewind") {
      ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "rgba(128,128,128,.7)"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(60,80,120,.12)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.05)"; for (let y = (performance.now() / 18) % 5; y < H; y += 5) ctx.fillRect(0, y, W, 1.5);
      const t = G.t; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 10);
      const x = 52, y = 58 + SAT;
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "#fff";
      for (const o of [-14, 2]) { ctx.beginPath(); ctx.moveTo(x + o, y); ctx.lineTo(x + o + 13, y - 10); ctx.lineTo(x + o + 13, y + 10); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  if (R.phase === "xfade") { ctx.fillStyle = `rgba(22,20,40,${clamp(R.t / 0.3, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  if (R.phase === "pull" && R.li > 0 && R.t < 0.3) { ctx.fillStyle = `rgba(22,20,40,${1 - R.t / 0.3})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- word screen ----------
function startWord() {
  G.mode = "word"; WD = { t: 0, typed: 0, sp: [] }; AU.reveal(); AU.musicLevel(0.8);
  $("msg").textContent = ""; $("from").textContent = ""; $("wordBtns").classList.remove("show");
  $("makeBtn").textContent = G.fromShare ? "回赠 TA 一个词" : "我也写一个";
  $("word").classList.add("show");
}
function wordLayout() {
  const chars = [...G.word];
  const rows = [chars];
  if (chars.length > 5) { let k = Math.ceil(chars.length / 2); const sp = chars.indexOf(" ", 2); if (sp > 0 && sp < chars.length - 1) k = sp; rows.splice(0, 1, chars.slice(0, k), chars.slice(k).filter((c, i) => !(i === 0 && c === " "))); }
  const rw = r => r.reduce((a, c, i) => a + (c === " " ? 2.4 : 4) + (i ? 1.6 : 0), 0);
  const maxW = Math.max(...rows.map(rw));
  const s = Math.min(W * 0.8 / maxW, H * 0.5 / (rows.length * 6 + (rows.length - 1) * 2.2));
  const out = []; let gi = 0;
  const totalH = (rows.length * 6 + (rows.length - 1) * 2.2) * s, y0 = H * 0.33 - totalH / 2;
  rows.forEach((r, ri) => { let x = W / 2 - rw(r) * s / 2; r.forEach((c, i) => { if (i) x += 1.6 * s; if (c !== " ") out.push({ c, x, y: y0 + ri * 8.2 * s, s, gi: gi++ }); x += (c === " " ? 2.4 : 4) * s; }); });
  return out;
}
let _sky = null;
function skyCanvas() {
  const key = W + "x" + H + DPR; if (_sky && _sky.key === key) return _sky.c;
  const c = document.createElement("canvas"); c.width = W * DPR; c.height = H * DPR; const g = c.getContext("2d"); g.scale(DPR, DPR);
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#121530"); gr.addColorStop(0.45, "#2b2652"); gr.addColorStop(0.75, "#6b3c63"); gr.addColorStop(0.9, "#c2666a"); gr.addColorStop(1, "#e89a72");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = ART.rng32(5);
  for (let i = 0; i < 140; i++) { const y = r() * H * 0.7, a = (1 - y / (H * 0.7)) * (0.3 + r() * 0.6); g.fillStyle = `rgba(255,250,235,${a})`; g.beginPath(); g.arc(r() * W, y, r() * 1.1 + 0.3, 0, 6.283); g.fill(); }
  // far hills
  const hill = (base, amp, col, seed) => { const rr = ART.rng32(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.012 + seed)) - rr() * 3); g.lineTo(W, H); g.closePath(); g.fill(); };
  hill(H * 0.86, 40, "#3a2f55", 2); hill(H * 0.9, 30, "#24304a", 5);
  g.fillStyle = "#18263a"; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.93); g.quadraticCurveTo(W * 0.5, H * 0.87, W, H * 0.93); g.lineTo(W, H); g.fill();
  _sky = { key, c }; return c;
}
function renderWord(dt) {
  WD.t += dt; G.t += dt;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(skyCanvas(), 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const t = WD.t;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 18; i++) { const x = (Math.sin(i * 51.3 + t * 0.1) * 0.5 + 0.5) * W, y = H * 0.6 + Math.sin(i * 13.1 + t * 0.4) * H * 0.18, a = 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.5 + i * 2)); ART.spr(ctx, ART.SPR.glow, x, y, 9, 9, a * 0.6); }
  ctx.globalCompositeOperation = "source-over";
  const L = wordLayout(); let lastBox = null;
  for (const it of L) {
    const appear = clamp((t - 0.2 - it.gi * 0.35) / 0.6, 0, 1); if (appear <= 0) continue;
    const bounce = 1 + Math.sin(appear * Math.PI) * 0.15 + (it.c === "♥" && appear >= 1 ? Math.max(0, Math.sin((t - it.gi * 0.35 - 0.8) * 7)) * 0.06 * Math.max(0, 1 - (t - 2.5) / 3) : 0);
    const letter = compileLetter(it.c), s = it.s * easeOut(appear) * bounce;
    const cx = it.x + 2 * it.s, cy = it.y + 3 * it.s;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-2, -3); ctx.globalAlpha = appear;
    ctx.globalCompositeOperation = "lighter";
    for (const st of letter.strokes) for (let a = 0; a <= st.L; a += 0.5) { const p = pointAtArc(st, a); ART.spr(ctx, ART.SPR.lamp, p.x, p.y, 1.8, 1.8, 0.24 * appear); }
    ctx.globalCompositeOperation = "source-over";
    for (const st of letter.strokes) ART.drawEmber(ctx, ptsToFlat(st.pts), { w: 0.42, lit: 1, glow: 0.9 + 0.1 * Math.sin(t * 2.5 + it.gi), t });
    for (const st of letter.strokes) ART.drawTie(ctx, st.end.x, st.end.y, 1, 1, 10);
    ctx.restore(); ctx.globalAlpha = 1;
    if (appear >= 1 && Math.random() < dt * 6) { const st = letter.strokes[(Math.random() * letter.strokes.length) | 0], p = st.pts[(Math.random() * st.pts.length) | 0]; WD.sp.push({ x: cx + (p.x - 2) * it.s, y: cy + (p.y - 3) * it.s, t: 0, s: 3 + Math.random() * 5 }); }
    lastBox = it;
  }
  for (let i = WD.sp.length - 1; i >= 0; i--) { const p = WD.sp[i]; p.t += dt; if (p.t > 1.2) { WD.sp.splice(i, 1); continue; } const a = Math.sin(p.t / 1.2 * Math.PI); ctx.fillStyle = `rgba(255,236,200,${a})`; ART.star(ctx, p.x, p.y - p.t * 8, p.s * a, 0.2, p.t); }
  const catA = clamp((t - 0.4 - L.length * 0.35) / 0.8, 0, 1);
  if (catA > 0) { const gs = Math.min(1.3, H / 290), gy = H * 0.965, gx = W * 0.87; ctx.globalAlpha = catA; ART.drawSleepingGhost(ctx, gx, gy, gs, t); ctx.globalAlpha = 1; ART.bubble(ctx, gx + 22 * gs, gy - 64 * gs - ((t * 0.4) % 1) * 14, 1, "z", catA * (1 - (t * 0.4) % 1), "#ffe7c4", 14); }
  const doneLetters = 0.2 + L.length * 0.35 + 0.9;
  const msg = G.msg || (G.fromShare ? "" : "这是小幽灵替你点亮的字");
  if (t > doneLetters) {
    const n = Math.min([...msg].length, Math.floor((t - doneLetters) * 12));
    if (n !== WD.typed) { WD.typed = n; $("msg").textContent = [...msg].slice(0, n).join(""); if (n % 2 === 1) AU.tone(1200, 0.03, { vol: 0.03 }); }
    if (t > doneLetters + [...msg].length / 12 + 0.8) $("wordBtns").classList.add("show");
  }
}

// ---------- customize ----------
function openCustom() {
  G.mode = "custom"; $("word").classList.remove("show"); $("custom").classList.add("show");
  $("linkBox").style.display = "none"; $("wErr").textContent = "";
}
$("wIn").addEventListener("input", () => { const el = $("wIn"); const v = sanitizeWord(el.value); if (v !== el.value) el.value = v; $("linkBox").style.display = "none"; });
$("heartBtn").addEventListener("click", () => { const el = $("wIn"); if ([...el.value].length < 8) el.value = sanitizeWord(el.value + "♥"); $("linkBox").style.display = "none"; });
$("mIn").addEventListener("input", () => { $("mCnt").textContent = [...$("mIn").value].length; $("linkBox").style.display = "none"; });
function currentLink() {
  const w = sanitizeWord($("wIn").value).trim(), m = $("mIn").value.trim().slice(0, 40);
  if (!w.replace(/ /g, "")) { $("wErr").textContent = "先写一个词吧（字母或 ♥）"; return null; }
  $("wErr").textContent = "";
  return location.origin + location.pathname + "#c=" + encodeShare(w, m);
}
$("genBtn").addEventListener("click", () => { const l = currentLink(); if (!l) return; $("link").value = l; $("linkBox").style.display = "block"; try { $("linkBox").scrollIntoView({ block: "nearest" }); } catch (e) {} AU.init(); AU.softDing(); });
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 1600); }
$("copyBtn").addEventListener("click", async () => {
  const l = $("link").value; let ok = false;
  try { await navigator.clipboard.writeText(l); ok = true; } catch (e) {}
  if (!ok) { const el = $("link"); el.removeAttribute("readonly"); el.select(); el.setSelectionRange(0, 99999); try { ok = document.execCommand("copy"); } catch (e) {} el.setAttribute("readonly", ""); }
  toast(ok ? "已复制，发给 TA 吧" : "请长按链接手动复制");
});
$("tryBtn").addEventListener("click", () => { const l = $("link").value; if (!l) return; location.hash = l.split("#")[1]; });
$("backBtn").addEventListener("click", () => { $("custom").classList.remove("show"); if (WD) { G.mode = "word"; $("word").classList.add("show"); } else showStart(); });
$("makeBtn").addEventListener("click", openCustom);
$("replayBtn").addEventListener("click", () => { $("word").classList.remove("show"); startReveal(); });
window.addEventListener("hashchange", () => location.reload());
function syncMute() { $("muteBtn").classList.toggle("off", AU.muted); }
$("muteBtn").addEventListener("click", e => { e.stopPropagation(); AU.init(); AU.setMuted(!AU.muted); syncMute(); });
AU.muted = localStorage.getItem("rxm_mute") === "1"; syncMute();

// ---------- start ----------
function showStart() {
  G.mode = "start"; $("start").classList.add("show");
  const n = G.levels.length;
  if (G.fromShare) { $("startSub").textContent = `有人给你做了个小游戏，一共 ${n} 关`; $("startSub2").textContent = G.msg ? "通关以后，TA 有一句话要对你说" : "通关以后有个小惊喜"; }
  else { $("startSub").textContent = "小幽灵提着南瓜灯，去接迷路的小鬼火回家"; $("startSub2").textContent = `一共 ${n} 关 · 玩完有个小惊喜`; }
}
function goLandscape() {
  if (!COARSE) return;
  try {
    const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock("landscape").catch(() => {}); } catch (e) {} };
    if (rq && !document.fullscreenElement) { const r = rq.call(el, { navigationUI: "hide" }); if (r && r.then) r.then(lock, () => {}); else lock(); } else lock();
  } catch (e) {}
}
$("startBtn").addEventListener("click", () => { AU.init(); goLandscape(); $("start").classList.remove("show"); startLevel(0); });
let titleCat = null;
function renderTitle(dt) {
  G.t += dt;
  const lv = G.levels[0], p = lv.strokes[0].start;
  if (!titleCat) titleCat = Object.assign(newCat(p.x - 0.4, p.y + 0.03, { x: 1, y: 0 }), {});
  const c = titleCat; animCat(c, dt, 0, 0, 0); c.t = G.t; c.carry = false; c.k = ART.GK * 1.45; c.dirT = 0.45;
  if (!c.happyT && Math.sin(G.t * 0.5) > 0.97) c.happyT = 1.2; // little smile now and then
  const cam = { x: c.x - W * 0.2 / (Z * 1.05) + Math.sin(G.t * 0.12) * 0.08, y: p.y - 0.3 + Math.cos(G.t * 0.1) * 0.05 };
  const fakeS = S; S = S || { lv, gust: 0 };
  if (!winds.length || Math.random() < dt * 0.6) { if (winds.length < 4) winds.push({ x: cam.x - 0.9 + Math.random() * 1.2, y: cam.y - 1.2 + Math.random() * 2.2, L: 0.6 + Math.random() * 0.6, ph: Math.random() * 6, dir: Math.random() < 0.5 ? 1 : -1, t: 0, dur: 2.2 }); }
  for (let i = winds.length - 1; i >= 0; i--) { winds[i].t += dt; if (winds[i].t > winds[i].dur) winds.splice(i, 1); }
  renderWorld(lv, { cat: c, anim: c, cam, z: Z * 1.05, si: 0, ci: 0, pen: false, allDone: false, ropes: [], live: false, fx: { reveal: true } });
  S = fakeS;
  { const z = Z * 1.05; ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
    ART.drawWisp(ctx, c.x + 0.55 + Math.sin(G.t * 0.9) * 0.08, c.y - 0.62 + Math.sin(G.t * 1.7) * 0.05, { state: "train", glow: 0.6, t: G.t, ph: 1, s: 1.1 });
    ART.drawWisp(ctx, c.x + 0.85 + Math.sin(G.t * 0.7 + 2) * 0.06, c.y - 0.2 + Math.sin(G.t * 1.3 + 1) * 0.05, { state: "next", glow: 0.3, t: G.t, ph: 2, s: 0.9 });
    ART.drawWisp(ctx, c.x - 0.75, c.y - 0.05 + Math.sin(G.t * 1.1) * 0.03, { state: "decoy", t: G.t, ph: 3, s: 0.8 }); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.drawImage(ART.postOverlay(W, H, DPR), 0, 0, W, H);
  ART.drawMotes(ctx, W, H, G.t, dt, cam, Z, 1.2);
}

// ---------- input ----------
function onDown(e) {
  AU.init(); const p = toStage(e.clientX, e.clientY);
  input.down = true; input.id = e.pointerId;
  if (G.mode === "play") {
    const b = btnPos();
    if (stick.id == null && p.x < W * 0.45) { // floating stick spawns under the thumb
      stick.id = e.pointerId; stick.active = true;
      stick.bx = clamp(p.x, SAL + STICK_R + 8, W * 0.45); stick.by = clamp(p.y, STICK_R + 8, H - STICK_R - 8);
      setKnob(p.x, p.y); haptic(8);
    } else if (act.id == null && p.x > W * 0.55 && hyp(p.x - b.x, p.y - b.y) < b.r * 2.2) { act.id = e.pointerId; act.down = true; act.queued = 1; }
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
}
function onMove(e) {
  if (e.pointerId === stick.id) { const p = toStage(e.clientX, e.clientY); setKnob(p.x, p.y); }
  e.preventDefault();
}
function onUp(e) {
  if (e.pointerId === input.id) input.down = false;
  if (e.pointerId === stick.id) { stick.id = null; stick.active = false; stick.mag = 0; stick.x = stick.y = 0; stick.run = false; }
  if (e.pointerId === act.id) { act.id = null; act.down = false; }
}
cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
document.addEventListener("touchmove", e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
window.addEventListener("keydown", e => { AU.init(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === " " && !e.repeat && G.mode === "play") { act.queued = 1; e.preventDefault(); } input.keys[k] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
window.addEventListener("keyup", e => { input.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const rawDt = (now - last) / 1000, dt = Math.min(0.05, rawDt); last = now;
  const t0 = performance.now();
  try {
    for (let k = 0; k < (G.steps || 1); k++) {
      if (G.mode === "play") updatePlay(dt);
      else if (G.mode === "rewind") updateReveal(dt);
    }
    if (G.mode === "play") {
      const z = playZ(), cat = S.cat; cat.t = G.t; cat.carry = S.pen;
      const at = renderWorld(S.lv, { cat, anim: cat, cam: S.cam, z, si: S.si, ci: S.ci, pen: S.pen, allDone: S.allDone, ropes: ropesNow(), live: true, fx: {} });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.drawImage(ART.postOverlay(W, H, DPR), 0, 0, W, H);
      ART.drawMotes(ctx, W, H, G.t, dt, S.cam, z, 1);
      if (S.clearT < 0 && at) drawSpill(at, S.cam, z);
      drawHUD(); drawControls(dt);
      if (S.clearT > 0.6) { ctx.fillStyle = `rgba(253,246,228,${clamp((S.clearT - 0.6) / 0.6, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
      if (S.t < 0.5 && G.li > 0) { ctx.fillStyle = `rgba(253,246,228,${1 - S.t / 0.5})`; ctx.fillRect(0, 0, W, H); }
      const ft = performance.now() - t0; const P = G.perf; P.n++; P.sum += rawDt; P.max = Math.max(P.max, rawDt); P.cpu = (P.cpu || 0) + ft;
    } else if (G.mode === "rewind") renderReveal();
    else if (G.mode === "word" || G.mode === "custom") renderWord(dt);
    else if (G.mode === "start" && G.levels.length) renderTitle(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

// test hooks
window.__game = {
  G, get S() { return S; }, get R() { return R; },
  set auto(v) { G.auto = v; }, get auto() { return G.auto; },
  set steps(v) { G.steps = v; }, get steps() { return G.steps; },
  setTarget(x, y) { G.target = x == null ? null : { x, y }; },
  botWant() { return G.mode === "play" && S && S.clearT < 0 ? botWant() : null; },
  get stick() { return stick; }, get act() { return act; }, get rot() { return ROT; }, get W() { return W; }, get H() { return H; },
  btnPos() { return btnPos(); }, toClient(x, y) { return ROT ? { x: H - y, y: x } : { x, y }; }, pressAction() { act.queued = 1; },
  start() { $("startBtn").click(); },
  encodeShare, decodeShare, buildLevel, routeDist(x, y) { const lv = S.lv; return Math.min(...lv.strokes.map(s => nearestOnStroke(s, x, y, 0, 1e9).d)); },
  screenOf(x, y) { const z = G.mode === "play" ? playZ() : Z; return screenPos(x, y, S.cam, z); },
  perfReset() { G.perf = { n: 0, sum: 0, max: 0, cpu: 0 }; }, get perf() { return G.perf; },
};

SAT = ROT ? 0 : (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sat")) || 0);
parseHash(); setupLevels(); showStart();
{ const lv = G.levels[0], T = terrainOf(lv), p = lv.strokes[0].start; T.ensureScale(Z * DPR); T.prewarm({ x: p.x - 0.4 - W * 0.2 / (Z * 1.05), y: p.y - 0.3 }, Z * 1.05, W, H, 0.3); }
requestAnimationFrame(frame);
})();
