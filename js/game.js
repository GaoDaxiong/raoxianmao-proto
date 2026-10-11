// 绕线猫 M1 prototype — canvas game. World units = letter grid cells (letter occupies 0..4 x 0..6).
(() => {
"use strict";
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
const $ = id => document.getElementById(id);
let W = 390, H = 844, DPR = 1, Z = 240;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  Z = Math.min(W / 1.6, H / 3.1);
}
window.addEventListener("resize", resize); resize();

// ---------- utils ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
function mixColor(c1, c2, t) { const p = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; const a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`; }
function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [{ x: pts[0].x, y: pts[0].y }]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = hyp(b.x - a.x, b.y - a.y); if (L === 0) continue;
    let d = step - carry;
    while (d <= L) { out.push({ x: a.x + (b.x - a.x) * d / L, y: a.y + (b.y - a.y) * d / L }); d += step; }
    carry = L - (d - step);
  }
  const l = pts[pts.length - 1]; out.push({ x: l.x, y: l.y });
  return out;
}
function resampleN(pts, n) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += hyp(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (L === 0 || n < 2) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
  const r = resample(pts, L / (n - 1)); while (r.length > n) r.splice(r.length - 2, 1); while (r.length < n) r.push({ ...r[r.length - 1] });
  return r;
}

// ---------- share payload ----------
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
const LS = 1.5; // world units per letter-grid cell (bigger letter => less of it fits on one screen)
function buildLevel(ch, idx, seedStr) {
  const letter = compileLetter(ch, LS);
  const rng = mulberry32(hashStr(seedStr + "|" + ch + "|" + idx));
  const M = { x0: -1.8, y0: -2.0, x1: 4 * LS + 1.8, y1: 6 * LS + 2.0 };
  const strokes = letter.strokes;
  const distRoute = (x, y) => { let m = 1e9; for (const s of strokes) { const n = nearestOnStroke(s, x, y, 0, 1e9); if (n.d < m) m = n.d; } return m; };
  const pegs = [];
  strokes.forEach((s, si) => s.checks.forEach((c, ci) => {
    c.peg = { x: c.x, y: c.y, kind: c.kind === "spool" ? "spool" : "stump", bell: c.kind !== "spool", real: true, si, ci, fall: rng(), ph: rng() * 6 };
    pegs.push(c.peg);
  }));
  const near = (x, y, r) => pegs.some(p => hyp(p.x - x, p.y - y) < r);
  const starts = strokes.map(s => s.start);
  const nearStart = (x, y, r) => starts.some(p => hyp(p.x - x, p.y - y) < r);
  const addDecoy = (x, y) => {
    if (x < M.x0 + 0.35 || x > M.x1 - 0.35 || y < M.y0 + 0.35 || y > M.y1 - 0.35) return;
    if (near(x, y, 0.62) || nearStart(x, y, 0.5)) return;
    const spool = rng() < 0.09;
    pegs.push({ x, y, kind: spool ? "spool" : "stump", bell: !spool && rng() < 0.34, real: false, fall: rng(), ph: rng() * 6 });
  };
  for (let gx = Math.ceil(M.x0); gx <= M.x1; gx++) for (let gy = Math.ceil(M.y0); gy <= M.y1; gy++) addDecoy(gx + (rng() - 0.5) * 0.3, gy + (rng() - 0.5) * 0.3);
  for (let i = 0; i < 40; i++) addDecoy(lerp(M.x0, M.x1, rng()), lerp(M.y0, M.y1, rng()));
  // basket after the last stroke
  const last = strokes[strokes.length - 1];
  let basket = null;
  const dirs = [last.endDir, { x: -last.endDir.y, y: last.endDir.x }, { x: last.endDir.y, y: -last.endDir.x }, { x: -last.endDir.x, y: -last.endDir.y }];
  for (const d of dirs) {
    const bx = clamp(last.end.x + d.x * 0.85, M.x0 + 0.5, M.x1 - 0.5), by = clamp(last.end.y + d.y * 0.85, M.y0 + 0.5, M.y1 - 0.5);
    if (distRoute(bx, by) > 0.5) { basket = { x: bx, y: by }; break; }
  }
  if (!basket) basket = { x: last.end.x + 0.85, y: last.end.y };
  // sleeping dogs on wrong shortcuts (inside corners / off-route but close)
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
    if (nearStart(c.x, c.y, 1.0) || hyp(c.x - basket.x, c.y - basket.y) < 1.0) continue;
    if (dogs.some(d => hyp(d.x - c.x, d.y - c.y) < 2.2)) continue;
    if (c.x < M.x0 + 0.6 || c.x > M.x1 - 0.6 || c.y < M.y0 + 0.6 || c.y > M.y1 - 0.6) continue;
    dogs.push({ x: c.x, y: c.y, awake: 0, cool: 0, face: rng() < 0.5 ? 1 : -1 });
  }
  for (let i = pegs.length - 1; i >= 0; i--) {
    const p = pegs[i]; if (p.real) continue;
    if (dogs.some(d => hyp(d.x - p.x, d.y - p.y) < 0.55) || hyp(basket.x - p.x, basket.y - p.y) < 0.5) pegs.splice(i, 1);
  }
  pegs.sort((a, b) => a.y - b.y);
  // decor
  const area = (M.x1 - M.x0) * (M.y1 - M.y0);
  const decor = { tufts: [], flowers: [], stones: [], patches: [], hedge: [] };
  for (let i = 0; i < area * 10; i++) decor.tufts.push({ x: lerp(M.x0, M.x1, rng()), y: lerp(M.y0, M.y1, rng()), s: 0.6 + rng() * 0.6, c: rng() < 0.5 ? 0 : 1 });
  const fcols = ["#ffffff", "#ffd6e0", "#fff3a6", "#e8d9ff", "#ffffff"];
  for (let i = 0; i < area * 1.8; i++) decor.flowers.push({ x: lerp(M.x0, M.x1, rng()), y: lerp(M.y0, M.y1, rng()), s: 0.7 + rng() * 0.6, c: fcols[(rng() * fcols.length) | 0], r: rng() * 6 });
  for (let i = 0; i < area * 0.3; i++) decor.stones.push({ x: lerp(M.x0, M.x1, rng()), y: lerp(M.y0, M.y1, rng()), s: 0.5 + rng() * 0.8 });
  for (let i = 0; i < area * 0.7; i++) decor.patches.push({ x: lerp(M.x0, M.x1, rng()), y: lerp(M.y0, M.y1, rng()), r: 0.4 + rng() * 0.9, l: rng() < 0.5 });
  const per = (x, y) => decor.hedge.push({ x, y, r: 0.28 + rng() * 0.2, c: rng() });
  for (let x = M.x0; x <= M.x1; x += 0.32) { per(x, M.y0 - 0.12); per(x, M.y1 + 0.12); }
  for (let y = M.y0; y <= M.y1; y += 0.32) { per(M.x0 - 0.12, y); per(M.x1 + 0.12, y); }
  return { ch, idx, letter, strokes, pegs, dogs, basket, decor, M, frames: [], trail: [] };
}

// ---------- game state ----------
const G = { mode: "start", levels: [], li: 0, word: "I♥U", msg: "", fromShare: false, auto: false, steps: 1, hintShown: {}, ringCount: 0 };
let S = null, R = null, WD = null;
const parts = [];
const input = { down: false, x: 0, y: 0, id: null, keys: {} };

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
  $("hintText").textContent = text; $("hint").style.opacity = 1;
  clearTimeout(hint._t); if (dur) hint._t = setTimeout(() => $("hint").style.opacity = 0, dur);
}
function hideHint() { $("hint").style.opacity = 0; }
function hintOnce(key, text, dur) { if (G.hintShown[key]) return; G.hintShown[key] = 1; hint(text, dur); }

function startLevel(i) {
  G.li = i; G.mode = "play";
  const lv = G.levels[i]; lv.frames = []; lv.trail = [];
  const s0 = lv.strokes[0];
  const cx = s0.start.x, cy = s0.start.y;
  S = { lv, cat: { x: cx, y: cy, vx: 0, vy: 0, dir: Math.atan2(s0.startDir.y, s0.startDir.x), walk: 0, moving: false },
    si: 0, pen: true, s: 0, ci: 0, hist: [{ trailN: 0, s: 0, ci: 0 }], allDone: false, tension: 0, cam: { x: cx, y: cy }, t: 0,
    nearDing: false, spillT: 1.5, clearT: -1, recAcc: 0, anchor: null };
  lv.trail.push({ x: cx, y: cy, si: 0 });
  lv.dogs.forEach(d => { d.awake = 0; d.cool = 0; });
  lv.pegs.forEach(p => { p.sway = 0; p.flash = 0; p.cool = 0; });
  parts.length = 0;
  if (i === 0) hint("拖动屏幕，带小猫去找会响的铃铛");
}

function activeTarget() {
  const lv = S.lv;
  if (S.allDone) return { x: lv.basket.x, y: lv.basket.y, type: "basket" };
  if (!S.pen) { const p = lv.strokes[S.si].start; return { x: p.x, y: p.y, type: "ball" }; }
  const c = lv.strokes[S.si].checks[S.ci]; return { x: c.x, y: c.y, type: "check", c };
}
function screenPos(x, y, cam, z) { return { x: (x - cam.x) * z + W / 2, y: (y - cam.y) * z + H / 2 }; }
function playZ() { return Z * (0.84 + 0.16 * easeOut(clamp(S.t / 1.1, 0, 1))); }

function burst(x, y, col, n = 10, note = false) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.4 + Math.random() * 0.9; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 1, col, note: false }); }
  if (note) for (let i = 0; i < 2; i++) parts.push({ x: x + (Math.random() - 0.5) * 0.2, y: y - 0.2, vx: (Math.random() - 0.5) * 0.4, vy: -0.7, life: 1.4, col: "#e6a817", note: true });
}

function ringCheck() {
  const lv = S.lv, st = lv.strokes[S.si], c = st.checks[S.ci];
  c.peg.sway = 1; c.peg.flash = 1;
  AU.ring(G.ringCount++); burst(c.x, c.y - 0.15, "#ffd75e", 12, true);
  S.s = c.arc; S.ci++; S.nearDing = false; S.spillT = 1.8;
  if (G.li === 0 && S.si === 0 && S.ci === 1) hint("", 1);
  if (S.ci >= st.checks.length) {
    AU.knot(); S.pen = false; S.si++;
    if (S.si >= lv.strokes.length) { S.allDone = true; hintOnce("basket", "把线头送回毛线篮吧", 2600); }
    else hintOnce("ball", "小猫打了个结，去找新的毛线团", 2600);
  } else S.hist.push({ trailN: lv.trail.length, s: S.s, ci: S.ci });
}
function pickUp() {
  const lv = S.lv; S.pen = true; S.s = 0; S.ci = 0; S.hist = [{ trailN: lv.trail.length, s: 0, ci: 0 }];
  const p = lv.strokes[S.si].start; lv.trail.push({ x: p.x, y: p.y, si: S.si });
  AU.pop(); burst(p.x, p.y, "#fff4dc", 10); S.nearDing = false;
}
function swat(d) {
  const lv = S.lv, cat = S.cat;
  d.cool = 2.6; d.awake = 1.5; AU.woof(); AU.swat();
  if (S.hist.length > 1) S.hist.pop();
  const h = S.hist[S.hist.length - 1];
  lv.trail.length = Math.max(1, h.trailN); S.s = h.s; S.ci = h.ci;
  const dx = cat.x - d.x, dy = cat.y - d.y, l = hyp(dx, dy) || 1;
  cat.x += dx / l * 0.35; cat.y += dy / l * 0.35; cat.vx = 0; cat.vy = 0;
  burst(cat.x, cat.y, "#ffffff", 8); S.nearDing = false;
  hintOnce("dog", "汪！线被狗狗拨掉了一截", 2200);
}
function levelClear() {
  S.clearT = 0; AU.clear(); AU.setTension(0); hideHint();
  burst(S.lv.basket.x, S.lv.basket.y, "#ffd75e", 18, true);
}

function updatePlay(dt) {
  const lv = S.lv, cat = S.cat, M = lv.M;
  S.t += dt;
  if (S.clearT >= 0) {
    S.clearT += dt;
    cat.x = lerp(cat.x, lv.basket.x, Math.min(1, dt * 6)); cat.y = lerp(cat.y, lv.basket.y - 0.05, Math.min(1, dt * 6));
    updateParts(dt); record(dt, true);
    if (S.clearT > 1.3) { if (G.li + 1 < G.levels.length) startLevel(G.li + 1); else startReveal(); }
    return;
  }
  const z = playZ(), MAXV = 2.4;
  let vx = 0, vy = 0;
  if (G.auto || G.target) {
    let t = G.target;
    if (!t) {
      const at = activeTarget(); t = at;
      if (S.pen) { const st = lv.strokes[S.si], c = st.checks[S.ci]; const p = pointAtArc(st, Math.min(S.s + 0.6, c.arc)); t = p; }
    }
    const dx = t.x - cat.x, dy = t.y - cat.y, d = hyp(dx, dy);
    if (d > 0.02) { const sp = Math.min(MAXV, d * 8); vx = dx / d * sp; vy = dy / d * sp; }
  } else if (input.down) {
    const tx = S.cam.x + (input.x - W / 2) / z, ty = S.cam.y + (input.y - 78 - H / 2) / z;
    const dx = tx - cat.x, dy = ty - cat.y, d = hyp(dx, dy);
    if (d > 0.07) { const sp = Math.min(MAXV, (d - 0.05) * 5); vx = dx / d * sp; vy = dy / d * sp; }
  } else {
    const k = input.keys; let kx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0), ky = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
    const l = hyp(kx, ky); if (l) { vx = kx / l * MAXV; vy = ky / l * MAXV; }
  }
  cat.vx += (vx - cat.vx) * Math.min(1, dt * 14); cat.vy += (vy - cat.vy) * Math.min(1, dt * 14);
  let nx = cat.x + cat.vx * dt, ny = cat.y + cat.vy * dt, tension = 0;
  S.anchor = null;
  if (S.pen) {
    const st = lv.strokes[S.si], c = st.checks[S.ci], aMax = Math.min(st.L, c.arc + 0.3);
    const TOL = 0.42, HARD = 1.15;
    const q0 = nearestOnStroke(st, cat.x, cat.y, 0, aMax), q = nearestOnStroke(st, nx, ny, 0, aMax);
    if (q.d > TOL) {
      tension = Math.min(1, (q.d - TOL) / (HARD - TOL));
      if (q.d > q0.d) { const f = 1 - 0.82 * tension; nx = cat.x + (nx - cat.x) * f; ny = cat.y + (ny - cat.y) * f; }
      const k = Math.min(1, dt * 5 * tension); nx += (q.x - nx) * k; ny += (q.y - ny) * k;
      const q2 = nearestOnStroke(st, nx, ny, 0, aMax);
      if (q2.d > HARD && q2.d > q0.d) { const r = HARD / q2.d; nx = q2.x + (nx - q2.x) * r; ny = q2.y + (ny - q2.y) * r; }
      S.anchor = q;
    }
  }
  nx = clamp(nx, M.x0 + 0.15, M.x1 - 0.15); ny = clamp(ny, M.y0 + 0.15, M.y1 - 0.15);
  const mvx = nx - cat.x, mvy = ny - cat.y, mv = hyp(mvx, mvy);
  if (mv > 0.0008) { cat.dir = lerpAngle(cat.dir, Math.atan2(mvy, mvx), Math.min(1, dt * 12)); cat.walk += mv * 9; cat.moving = true; } else cat.moving = false;
  cat.x = nx; cat.y = ny;
  S.tension += (tension - S.tension) * Math.min(1, dt * 10);
  AU.setTension(S.tension > 0.12 ? S.tension : 0);
  if (S.tension > 0.35) hintOnce("tension", "线不够长了…往回走走看", 2200);

  if (S.pen) {
    const st = lv.strokes[S.si], c = st.checks[S.ci];
    const q = nearestOnStroke(st, cat.x, cat.y, Math.max(0, S.s - 0.5), c.arc);
    if (q && q.d < 0.5) S.s = Math.max(S.s, q.arc);
    if (hyp(cat.x - c.x, cat.y - c.y) < 0.42 && S.s >= c.arc - 0.75) ringCheck();
    const tr = lv.trail, lp = tr[tr.length - 1];
    if (S.pen && (!lp || lp.si !== S.si || hyp(lp.x - cat.x, lp.y - cat.y) > 0.035)) tr.push({ x: cat.x, y: cat.y, si: S.si });
  } else if (!S.allDone) {
    const b = lv.strokes[S.si].start; if (hyp(cat.x - b.x, cat.y - b.y) < 0.42) pickUp();
  } else if (hyp(cat.x - lv.basket.x, cat.y - lv.basket.y) < 0.45) levelClear();

  for (const d of lv.dogs) {
    d.cool -= dt; d.awake = Math.max(0, d.awake - dt);
    if (S.pen && d.cool <= 0 && hyp(cat.x - d.x, cat.y - d.y) < 0.42) swat(d);
  }
  const at = activeTarget();
  for (const p of lv.pegs) {
    p.sway = (p.sway || 0) * Math.exp(-dt * 2.5); p.flash = Math.max(0, (p.flash || 0) - dt); p.cool = Math.max(0, (p.cool || 0) - dt);
    if (p.bell && !(at.c && at.c.peg === p) && p.cool <= 0 && hyp(cat.x - p.x, cat.y - p.y) < 0.3) { p.cool = 1.2; p.sway = 0.35; AU.clack(); }
  }
  const da = hyp(cat.x - at.x, cat.y - at.y);
  const sp = screenPos(at.x, at.y, S.cam, z), pan = clamp((sp.x - W / 2) / W * 2, -1, 1);
  if (da < 1.6 && !S.nearDing) { S.nearDing = true; if (at.type === "check") AU.ding(pan * 0.6); else AU.softDing(pan * 0.6); }
  if (da > 2.3) S.nearDing = false;
  const off = sp.x < 0 || sp.x > W || sp.y < 0 || sp.y > H;
  S.spillT -= dt; if (off && S.spillT <= 0) { S.spillT = 2.6; AU.softDing(pan); }
  // camera: follow with lead toward motion + active guide
  const dl = Math.max(da, 0.001), lead = Math.min(0.32, da * 0.18);
  const cx = cat.x + cat.vx * 0.16 + (at.x - cat.x) / dl * lead, cy = cat.y + cat.vy * 0.16 + (at.y - cat.y) / dl * lead;
  const kc = 1 - Math.exp(-dt * 5); S.cam.x += (cx - S.cam.x) * kc; S.cam.y += (cy - S.cam.y) * kc;
  updateParts(dt); record(dt, false);
}
function record(dt) {
  S.recAcc += dt; const lv = S.lv, c = S.cat;
  while (S.recAcc >= 1 / 30) { S.recAcc -= 1 / 30; lv.frames.push([c.x, c.y, S.cam.x, S.cam.y, S.si, S.ci, S.pen ? 1 : 0, lv.trail.length, c.dir, c.walk, S.allDone ? 1 : 0, S.s]); }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.note ? -0.2 : 1.2) * dt; p.life -= dt * 1.2; if (p.life <= 0) parts.splice(i, 1); }
}

// ---------- drawing ----------
function inView(x, y, v, m = 0.5) { return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m; }

function drawGround(lv, v) {
  const M = lv.M, d = lv.decor;
  ctx.fillStyle = "#8fc177"; ctx.fillRect(v.x0 - 1, v.y0 - 1, v.x1 - v.x0 + 2, v.y1 - v.y0 + 2);
  ctx.fillStyle = "#c5e7a7"; ctx.fillRect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
  for (const p of d.patches) { if (!inView(p.x, p.y, v, p.r)) continue; ctx.fillStyle = p.l ? "rgba(230,248,200,.22)" : "rgba(150,200,120,.12)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, 6.283); ctx.fill(); }
  for (const p of d.stones) { if (!inView(p.x, p.y, v)) continue; ctx.fillStyle = "#d9dccf"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.05 * p.s, 0.035 * p.s, 0, 0, 6.283); ctx.fill(); }
  ctx.lineCap = "round";
  for (let c = 0; c < 2; c++) {
    ctx.strokeStyle = c ? "#93c97a" : "#a9d68e"; ctx.lineWidth = 0.018; ctx.beginPath();
    for (const t of d.tufts) { if (t.c !== c || !inView(t.x, t.y, v)) continue; const s = 0.06 * t.s;
      ctx.moveTo(t.x - s * 0.5, t.y); ctx.lineTo(t.x - s * 0.8, t.y - s); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - s * 1.2); ctx.moveTo(t.x + s * 0.5, t.y); ctx.lineTo(t.x + s * 0.8, t.y - s); }
    ctx.stroke();
  }
  for (const f of d.flowers) {
    if (!inView(f.x, f.y, v)) continue; const s = 0.028 * f.s;
    ctx.fillStyle = f.c; for (let k = 0; k < 5; k++) { const a = f.r + k * 1.2566; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * s, f.y + Math.sin(a) * s, s * 0.75, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = "#f6c94a"; ctx.beginPath(); ctx.arc(f.x, f.y, s * 0.55, 0, 6.283); ctx.fill();
  }
  for (const h of d.hedge) { if (!inView(h.x, h.y, v, 0.6)) continue; ctx.fillStyle = h.c < 0.33 ? "#76ad62" : h.c < 0.66 ? "#83b96c" : "#6fa35b"; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.283); ctx.fill(); }
}

function drawBell(x, y, rot, gold, glow, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0.05, 0, 0, 0.05, 0.6);
    g.addColorStop(0, `rgba(255,214,90,${0.8 * glow})`); g.addColorStop(0.35, `rgba(255,220,120,${0.35 * glow})`); g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0.05, 0.6, 0, 6.283); ctx.fill();
    ctx.strokeStyle = `rgba(255,200,80,${0.6 * glow})`; ctx.lineWidth = 0.012;
    const k = (t * 1.2) % 1; ctx.beginPath(); ctx.arc(0, 0.06, 0.12 + k * 0.3, 0, 6.283); ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = gold ? "#a77a1c" : "#6f757b"; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0, -0.02); ctx.lineTo(0, 0.02); ctx.stroke();
  ctx.fillStyle = gold ? "#f7c948" : "#a9afb5";
  ctx.beginPath(); ctx.moveTo(-0.06, 0.1); ctx.quadraticCurveTo(-0.055, 0.02, 0, 0.015); ctx.quadraticCurveTo(0.055, 0.02, 0.06, 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = gold ? "#fbe08a" : "#c8cdd2"; ctx.beginPath(); ctx.ellipse(-0.018, 0.05, 0.012, 0.025, 0.2, 0, 6.283); ctx.fill();
  ctx.fillStyle = gold ? "#c9961f" : "#7d8389"; ctx.beginPath(); ctx.ellipse(0, 0.1, 0.065, 0.016, 0, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0.115, 0.016, 0, 6.283); ctx.fill();
  ctx.restore();
}

function drawPeg(p, active, glow, t, fall) {
  let a = 1, sy = 1, rot = 0;
  if (fall > 0) { const f = clamp(fall * 1.7 - p.fall * 0.7, 0, 1); a = 1 - f; sy = 1 - f * 0.7; rot = f * 0.6 * (p.fall < 0.5 ? -1 : 1); if (a <= 0) return; }
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(rot); ctx.scale(1, sy);
  ctx.fillStyle = "rgba(60,90,40,.18)"; ctx.beginPath(); ctx.ellipse(0.03, 0.01, 0.11, 0.05, 0, 0, 6.283); ctx.fill();
  if (p.kind === "spool") {
    ctx.fillStyle = "#c69c72"; ctx.beginPath(); ctx.ellipse(0, 0, 0.12, 0.055, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = active ? "#f0b7c9" : "#c9b6e4"; ctx.fillRect(-0.085, -0.17, 0.17, 0.17);
    ctx.strokeStyle = active ? "#e597ad" : "#b39dd6"; ctx.lineWidth = 0.01;
    const sh = active ? (t * 0.25) % 0.03 : 0;
    for (let k = -0.15 + sh; k < 0; k += 0.03) { ctx.beginPath(); ctx.moveTo(-0.085, k); ctx.lineTo(0.085, k + 0.012); ctx.stroke(); }
    ctx.fillStyle = "#d9b48a"; ctx.beginPath(); ctx.ellipse(0, -0.17, 0.12, 0.055, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = "#b88b5e"; ctx.beginPath(); ctx.ellipse(0, -0.17, 0.03, 0.014, 0, 0, 6.283); ctx.fill();
    if (glow > 0) { const g = ctx.createRadialGradient(0, -0.08, 0, 0, -0.08, 0.45); g.addColorStop(0, `rgba(255,200,150,${0.5 * glow})`); g.addColorStop(1, "rgba(255,200,150,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -0.08, 0.45, 0, 6.283); ctx.fill(); }
  } else {
    ctx.fillStyle = "#a8774c"; ctx.beginPath(); ctx.moveTo(-0.075, -0.14); ctx.lineTo(-0.075, 0); ctx.ellipse(0, 0, 0.075, 0.035, 0, Math.PI, 0, true); ctx.lineTo(0.075, -0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#93653d"; ctx.fillRect(-0.03, -0.12, 0.012, 0.1); ctx.fillRect(0.03, -0.1, 0.01, 0.08);
    ctx.fillStyle = "#e3c08f"; ctx.beginPath(); ctx.ellipse(0, -0.14, 0.075, 0.035, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "#c79e6a"; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.ellipse(0, -0.14, 0.04, 0.018, 0, 0, 6.283); ctx.stroke();
    if (p.bell) {
      const sw = (p.sway || 0) * Math.sin(t * 13 + p.ph) * 0.6 + (active ? Math.sin(t * 9) * 0.25 * glow : 0);
      drawBell(0.085, -0.11, sw, active, glow, t);
    }
  }
  ctx.restore();
}

function drawBall(x, y, r, t, glow) {
  if (glow > 0) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4); g.addColorStop(0, `rgba(255,230,160,${0.6 * glow})`); g.addColorStop(1, "rgba(255,230,160,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = "rgba(60,90,40,.2)"; ctx.beginPath(); ctx.ellipse(x + 0.02, y + r * 0.8, r, r * 0.4, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#fbf1df"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "#e3d2b4"; ctx.lineWidth = r * 0.12;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + r * 0.7, y - r * 0.2 + k * r * 0.3, r * (0.6 + k * 0.15), 2.3, 3.9); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x - r * 0.6, y + r * 0.5, r * 0.8, 4.8, 6.0); ctx.stroke();
}

function drawDog(d, t, wag) {
  ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.face, 1);
  const awake = d.awake > 0;
  ctx.fillStyle = "rgba(60,90,40,.2)"; ctx.beginPath(); ctx.ellipse(0, 0.06, 0.26, 0.09, 0, 0, 6.283); ctx.fill();
  const tw = Math.sin(t * (wag > 0 ? 14 : 2)) * (0.15 + wag * 0.5);
  ctx.strokeStyle = "#f4efe7"; ctx.lineWidth = 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-0.18, 0); ctx.quadraticCurveTo(-0.28, -0.02 + tw * 0.1, -0.3, -0.08 + tw * 0.2); ctx.stroke();
  ctx.fillStyle = "#fbf8f2"; ctx.beginPath(); ctx.ellipse(0, 0, 0.2, 0.1, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#e9c9a0"; ctx.beginPath(); ctx.ellipse(-0.04, -0.03, 0.06, 0.04, 0.3, 0, 6.283); ctx.fill();
  const hy = awake ? -0.1 : -0.01;
  ctx.fillStyle = "#fbf8f2"; ctx.beginPath(); ctx.arc(0.18, hy, 0.085, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#c99a6b"; ctx.beginPath(); ctx.ellipse(0.13, hy - 0.04, 0.035, 0.06, 0.5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.23, hy - 0.05, 0.03, 0.055, -0.4, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#3a2c25"; ctx.beginPath(); ctx.arc(0.255, hy + 0.01, 0.014, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "#3a2c25"; ctx.lineWidth = 0.01;
  if (awake) { ctx.beginPath(); ctx.arc(0.19, hy - 0.01, 0.012, 0, 6.283); ctx.fillStyle = "#3a2c25"; ctx.fill();
    const sw = Math.sin((1.5 - d.awake) * 10) * 0.6; ctx.fillStyle = "#fbf8f2"; ctx.save(); ctx.translate(0.12, 0.02); ctx.rotate(-0.8 + sw); ctx.beginPath(); ctx.ellipse(0.08, 0, 0.07, 0.03, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
  else { ctx.beginPath(); ctx.arc(0.19, hy - 0.005, 0.014, 0.2, 2.9); ctx.stroke(); }
  ctx.fillStyle = "#fbf8f2"; ctx.beginPath(); ctx.ellipse(0.12, 0.07, 0.05, 0.025, 0, 0, 6.283); ctx.fill();
  ctx.restore();
  if (!awake) { ctx.fillStyle = "rgba(90,110,140,.7)"; ctx.font = "bold 0.1px sans-serif"; const k = (t * 0.5) % 1; ctx.globalAlpha = 1 - k; ctx.fillText("z", d.x + 0.2 * d.face, d.y - 0.15 - k * 0.2); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = "#e0503f"; ctx.font = "bold 0.16px sans-serif"; ctx.fillText("!", d.x + 0.2 * d.face, d.y - 0.22); }
}

function drawBasket(b, t, glow) {
  if (glow > 0) { const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 0.6); g.addColorStop(0, `rgba(255,230,160,${0.6 * glow})`); g.addColorStop(1, "rgba(255,230,160,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 0.6, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = "rgba(60,90,40,.22)"; ctx.beginPath(); ctx.ellipse(b.x + 0.02, b.y + 0.06, 0.24, 0.09, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#c98f55"; ctx.beginPath(); ctx.moveTo(b.x - 0.22, b.y - 0.06); ctx.quadraticCurveTo(b.x - 0.2, b.y + 0.1, b.x, b.y + 0.1); ctx.quadraticCurveTo(b.x + 0.2, b.y + 0.1, b.x + 0.22, b.y - 0.06); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#a8703d"; ctx.lineWidth = 0.012; for (let k = -0.16; k <= 0.16; k += 0.06) { ctx.beginPath(); ctx.moveTo(b.x + k, b.y - 0.05); ctx.lineTo(b.x + k * 0.8, b.y + 0.09); ctx.stroke(); }
  ctx.fillStyle = "#8a5a33"; ctx.beginPath(); ctx.ellipse(b.x, b.y - 0.06, 0.22, 0.07, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#f6e8cf"; ctx.beginPath(); ctx.arc(b.x - 0.07, b.y - 0.08, 0.05, 0, 6.283); ctx.arc(b.x + 0.06, b.y - 0.09, 0.045, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#f2b8c6"; ctx.beginPath(); ctx.arc(b.x + 0.01, b.y - 0.1, 0.04, 0, 6.283); ctx.fill();
}

function drawCat(x, y, dir, walk, moving, carry, tension) {
  const bob = moving ? Math.abs(Math.sin(walk)) * 0.025 : 0;
  ctx.fillStyle = "rgba(60,90,40,.22)"; ctx.beginPath(); ctx.ellipse(x, y + 0.04, 0.16, 0.08, 0, 0, 6.283); ctx.fill();
  ctx.save(); ctx.translate(x, y - bob); ctx.rotate(dir + (tension || 0) * Math.sin(walk * 3) * 0.08);
  const sc = 1 + (moving ? Math.sin(walk * 2) * 0.03 : 0); ctx.scale(sc, 1 / sc);
  // tail
  const tw = Math.sin(walk * 0.7 + performance.now() / 400) * 0.5;
  ctx.strokeStyle = "#f2a052"; ctx.lineWidth = 0.045; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-0.14, 0); ctx.quadraticCurveTo(-0.26, tw * 0.1, -0.29, 0.08 * tw + 0.06); ctx.stroke();
  // paws
  const ph = moving ? Math.sin(walk) * 0.04 : 0;
  ctx.fillStyle = "#fff5ea";
  [[0.09, 0.085, ph], [0.09, -0.085, -ph], [-0.08, 0.085, -ph], [-0.08, -0.085, ph]].forEach(([px, py, o]) => { ctx.beginPath(); ctx.ellipse(px + o, py, 0.035, 0.028, 0, 0, 6.283); ctx.fill(); });
  // body
  ctx.fillStyle = "#f5a54e"; ctx.beginPath(); ctx.ellipse(-0.01, 0, 0.16, 0.105, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "#de7f30"; ctx.lineWidth = 0.022;
  for (const sx of [-0.09, -0.03, 0.03]) { ctx.beginPath(); ctx.moveTo(sx, -0.09); ctx.quadraticCurveTo(sx + 0.02, 0, sx, 0.09); ctx.stroke(); }
  // head
  ctx.fillStyle = "#f5a54e";
  ctx.beginPath(); ctx.moveTo(0.17, -0.05); ctx.lineTo(0.27, -0.1); ctx.lineTo(0.22, -0.01); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.17, 0.05); ctx.lineTo(0.27, 0.1); ctx.lineTo(0.22, 0.01); ctx.fill();
  ctx.beginPath(); ctx.arc(0.16, 0, 0.09, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#f7b7a3"; ctx.beginPath(); ctx.moveTo(0.2, -0.055); ctx.lineTo(0.245, -0.08); ctx.lineTo(0.215, -0.03); ctx.fill(); ctx.beginPath(); ctx.moveTo(0.2, 0.055); ctx.lineTo(0.245, 0.08); ctx.lineTo(0.215, 0.03); ctx.fill();
  ctx.fillStyle = "#de7f30"; ctx.beginPath(); ctx.ellipse(0.15, 0, 0.035, 0.012, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#fff5ea"; ctx.beginPath(); ctx.ellipse(0.22, 0, 0.035, 0.045, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#3b2a22"; ctx.beginPath(); ctx.arc(0.2, -0.04, 0.012, 0, 6.283); ctx.arc(0.2, 0.04, 0.012, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#ec8a8a"; ctx.beginPath(); ctx.arc(0.245, 0, 0.011, 0, 6.283); ctx.fill();
  if (carry) { ctx.fillStyle = "#fbf1df"; ctx.beginPath(); ctx.arc(0.265, 0.035, 0.022, 0, 6.283); ctx.fill(); }
  ctx.restore();
}

function slackPts(pts, si) {
  const r = resample(pts, 0.04), n = r.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = r[Math.max(0, i - 2)], b = r[Math.min(n - 1, i + 2)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = hyp(tx, ty) || 1; tx /= l; ty /= l;
    const ph = i + si * 37;
    let off = 0.15 * Math.sin(ph * 0.13 + si) + 0.08 * Math.sin(ph * 0.41 + 1.7) + 0.04 * Math.sin(ph * 1.1), fwd = 0;
    const LP = 58, LL = 24, m = (ph + 13) % LP, cyc = (ph / LP) | 0;
    if (m < LL) { const ang = m / LL * 6.283, rr = 0.15 + 0.06 * ((cyc * 7919) % 3) / 2; fwd -= rr * Math.sin(ang) * 1.5; off += rr * (1 - Math.cos(ang)) * ((cyc % 2) ? 1 : -1); }
    const e = Math.min(1, i / 10, (n - 1 - i) / 10);
    out.push({ x: r[i].x + (-ty * off + tx * fwd) * e, y: r[i].y + (tx * off + ty * fwd) * e });
  }
  return out;
}
function strokePath(p) { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length - 1; i++) { const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2; ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my); } const l = p[p.length - 1]; ctx.lineTo(l.x, l.y); }
function trailGroups(lv, n) {
  const g = {}; const tr = lv.trail; n = Math.min(n, tr.length);
  for (let i = 0; i < n; i++) { const p = tr[i]; (g[p.si] = g[p.si] || []).push(p); }
  return g;
}
function drawYarn(lv, st, fx) {
  const groups = trailGroups(lv, st.trailN);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const k in groups) {
    const pts = groups[k]; if (pts.length < 2) continue;
    let p = slackPts(pts, +k);
    const s = fx.snap;
    if (s >= 0) {
      const canon = resampleN(lv.strokes[+k].pts, p.length);
      const e = s <= 0 ? 0 : 1 - Math.exp(-7 * s) * Math.cos(11 * s);
      p = p.map((q, i) => ({ x: lerp(q.x, canon[i].x, e), y: lerp(q.y, canon[i].y, e) }));
    }
    const red = fx.red || 0;
    const w = lerp(0.045, 0.1, red);
    strokePath(p); ctx.strokeStyle = red > 0 ? `rgba(120,20,20,${0.25 + red * 0.2})` : "rgba(140,110,80,.45)"; ctx.lineWidth = w + 0.022; ctx.stroke();
    strokePath(p); ctx.strokeStyle = mixColor("#fbf3e3", "#e8413a", red); ctx.lineWidth = w; ctx.stroke();
    if (red > 0.5) { strokePath(p); ctx.strokeStyle = `rgba(255,150,130,${(red - 0.5)})`; ctx.lineWidth = w * 0.3; ctx.stroke(); }
  }
}

function viewRect(cam, z) { return { x0: cam.x - W / 2 / z, x1: cam.x + W / 2 / z, y0: cam.y - H / 2 / z, y1: cam.y + H / 2 / z }; }

function renderWorld(lv, st, cam, z, fx) {
  const t = performance.now() / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const v = viewRect(cam, z);
  drawGround(lv, v);
  const cat = st.cat;
  let at = null;
  if (st.allDone) at = { x: lv.basket.x, y: lv.basket.y, type: "basket" };
  else if (!st.pen) { const p = lv.strokes[st.si].start; at = { x: p.x, y: p.y, type: "ball" }; }
  else { const c = lv.strokes[st.si].checks[st.ci]; at = { x: c.x, y: c.y, type: "check", c }; }
  const da = hyp(cat.x - at.x, cat.y - at.y);
  const glowA = fx.reveal ? 0 : (0.45 + 0.55 * clamp((2.6 - da) / 1.4, 0, 1)) * (0.85 + 0.15 * Math.sin(t * 5));
  const fall = fx.pegFall || 0;
  // pegs above cat line drawn first, others after cat for a hint of depth
  const drawPegs = (below) => {
    for (const p of lv.pegs) {
      if ((p.y > cat.y) !== below) continue;
      if (!inView(p.x, p.y, v)) continue;
      const active = at.c && at.c.peg === p;
      drawPeg(p, active, active ? glowA : 0, t, fall);
    }
  };
  drawPegs(false);
  if (fall < 1) {
    const fa = 1 - clamp(fall * 2, 0, 1);
    ctx.globalAlpha = fa;
    for (const d of lv.dogs) if (inView(d.x, d.y, v)) drawDog(d, t, fx.reveal ? 0 : clamp((1.4 - hyp(cat.x - d.x, cat.y - d.y)) / 0.6, 0, 1));
    if (!st.pen && !st.allDone) { const p = lv.strokes[st.si].start; drawBall(p.x, p.y - Math.abs(Math.sin(t * 3)) * 0.04, 0.12, t, glowA); }
    if (st.allDone) drawBasket(lv.basket, t, glowA);
    ctx.globalAlpha = 1;
  }
  if (!fx.dark) drawYarn(lv, st, fx);
  if (fx.live && S.anchor && S.tension > 0.1) {
    const a = S.anchor, tr = Math.sin(t * 70) * 0.01 * S.tension;
    ctx.strokeStyle = `rgba(255,248,235,${0.5 + S.tension * 0.5})`; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(cat.x + tr, cat.y - tr); ctx.stroke();
  }
  if (!fx.hideCat) drawCat(cat.x, cat.y, cat.dir, cat.walk, cat.moving, st.pen, fx.live ? S.tension : 0);
  drawPegs(true);
  if (fx.live) for (const p of parts) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    if (p.note) { ctx.fillStyle = p.col; ctx.font = "bold 0.16px sans-serif"; ctx.fillText("♪", p.x, p.y); }
    else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 0.025, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (fx.dark) {
    ctx.fillStyle = `rgba(28,20,34,${fx.dark * 0.92})`; ctx.fillRect(v.x0 - 1, v.y0 - 1, v.x1 - v.x0 + 2, v.y1 - v.y0 + 2);
    drawYarn(lv, st, fx);
  }
  ctx.restore();
  return at;
}

function drawSpill(at, cam, z) {
  const sp = screenPos(at.x, at.y, cam, z), m = 14;
  if (sp.x > m && sp.x < W - m && sp.y > m && sp.y < H - m) return;
  const cx = W / 2, cy = H / 2, dx = sp.x - cx, dy = sp.y - cy;
  const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
  const ex = cx + dx * s, ey = cy + dy * s, t = performance.now() / 1000;
  const r = 70 + Math.sin(t * 4) * 8;
  const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
  g.addColorStop(0, "rgba(255,214,110,.55)"); g.addColorStop(1, "rgba(255,214,110,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, r, 0, 6.283); ctx.fill();
  ctx.fillStyle = "rgba(200,140,20,.8)"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
  const k = (t * 0.8) % 1; ctx.globalAlpha = 1 - k;
  ctx.fillText("♪", ex - dx * s * 0.0 - Math.sign(dx) * 22 * (dx * s !== 0 ? Math.abs(dx) / hyp(dx, dy) : 0), ey - Math.sign(dy) * 22 * Math.abs(dy) / hyp(dx, dy) - k * 10);
  ctx.globalAlpha = 1; ctx.textAlign = "left";
}

function drawHUD() {
  const lv = S.lv, t = performance.now() / 1000;
  const top = 18 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sat")) || 0);
  let rem = 0;
  if (S.pen) { const st = lv.strokes[S.si]; rem = 1 - (S.s / st.L) * 0.82; }
  const shake = S.tension > 0.15 ? Math.sin(t * 55) * 4 * S.tension : 0;
  const cx = 38 + shake, cy = top + 24;
  ctx.fillStyle = "rgba(255,250,240,.75)"; ctx.beginPath(); ctx.arc(38, cy, 26, 0, 6.283); ctx.fill();
  if (S.pen || S.allDone) {
    const r = S.allDone ? 5 : 7 + 14 * rem;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 / Z, 1 / Z); ctx.restore();
    ctx.fillStyle = "#fbf1df"; ctx.strokeStyle = "#dcc6a3"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + r * 0.6, cy - r * 0.2, r * 0.7, 2.3, 3.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + r * 0.7, cy + r * 0.2, r * 0.9, 2.4, 3.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.7, cy + r * 0.7); ctx.quadraticCurveTo(cx + r + 6, cy + r + 2, cx + r + 10, cy + r - 4); ctx.stroke();
  } else {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "#c9b28d"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(38, cy, 12 + Math.sin(t * 4) * 1.5, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
  }
  // level dots
  const n = G.levels.length, gap = 16, x0 = W / 2 - (n - 1) * gap / 2;
  for (let i = 0; i < n; i++) { ctx.fillStyle = i < G.li ? "#f29a5b" : i === G.li ? "#fff7ec" : "rgba(255,250,240,.5)"; ctx.beginPath(); ctx.arc(x0 + i * gap, top + 8, i === G.li ? 5 : 4, 0, 6.283); ctx.fill(); }
}

function drawFinger() {
  if (!input.down || G.mode !== "play" || G.auto) return;
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(input.x, input.y, 24, 0, 6.283); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(input.x, input.y - 78, 4, 0, 6.283); ctx.fill();
}

// ---------- reveal ----------
function frameState(lv, i) {
  const f = lv.frames[clamp(i | 0, 0, lv.frames.length - 1)];
  return { st: { cat: { x: f[0], y: f[1], dir: f[8], walk: f[9], moving: true }, si: f[4], ci: f[5], pen: !!f[6], trailN: f[7], allDone: !!f[10], s: f[11] }, cam: { x: f[2], y: f[3] } };
}
function fullZ() { return Math.min(W * 0.84 / (4 * LS + 1.2), H * 0.62 / (6 * LS + 1.2)); }
function startReveal() {
  G.mode = "rewind"; hideHint(); AU.setTension(0);
  const durs = G.levels.map(lv => clamp(lv.frames.length / 30 * 0.2, 0.6, 1.2));
  R = { t: 0, phase: "freeze", li: G.levels.length - 1, durs };
  ["start", "word", "custom"].forEach(id => $(id).classList.remove("show"));
}
function updateReveal(dt) {
  R.t += dt * (input.down ? 2 : 1);
  if (R.phase === "freeze" && R.t > 0.5) { R.phase = "rewind"; R.t = 0; AU.rewind(R.durs.reduce((a, b) => a + b, 0)); }
  else if (R.phase === "rewind" && R.t > R.durs[R.li]) { R.t = 0; if (R.li > 0) R.li--; else { R.phase = "pull"; AU.whoosh(); } }
  else if (R.phase === "pull" && R.t > 1.3) { R.phase = "replay"; R.t = 0; }
  else if (R.phase === "replay" && R.t > 1.6) { R.phase = "snap"; R.t = 0; AU.snap(); setTimeout(() => AU.reveal && R && R.phase === "snap" && AU.bell(784, 0.1), 250); }
  else if (R.phase === "snap" && R.t > 2.6) { R.phase = "xfade"; R.t = 0; }
  else if (R.phase === "xfade" && R.t > 0.6) {
    R.t = 0; if (R.li + 1 < G.levels.length) { R.li++; R.phase = "pull"; AU.whoosh(); } else startWord();
  }
}
function renderReveal() {
  const lv = G.levels[R.li], n = lv.frames.length;
  let idx = n - 1, cam, z = Z, fx = { reveal: true }, st;
  if (R.phase === "freeze") { ({ st, cam } = frameState(lv, n - 1)); }
  else if (R.phase === "rewind") { idx = (1 - R.t / R.durs[R.li]) * (n - 1); ({ st, cam } = frameState(lv, idx)); fx.reveal = false; }
  else {
    const f0 = frameState(lv, 0), full = { x: 2 * LS, y: 3 * LS + 0.1 }, fz = fullZ();
    if (R.phase === "pull") { const e = ease(clamp(R.t / 1.3, 0, 1)); st = f0.st; cam = { x: lerp(f0.cam.x, full.x, e), y: lerp(f0.cam.y, full.y, e) }; z = Z * Math.pow(fz / Z, e); }
    else {
      cam = full; z = fz;
      if (R.phase === "replay") st = frameState(lv, (R.t / 1.6) * (n - 1)).st;
      else {
        st = frameState(lv, n - 1).st;
        const t = R.phase === "snap" ? R.t : 2.6;
        fx.snap = clamp(t / 0.9, 0, 1) * 0.9 + (t > 0.9 ? Math.min(1, t - 0.9) * 0.1 : 0);
        fx.snap = t; fx.red = clamp(t / 0.45, 0, 1); fx.pegFall = clamp((t - 0.15) / 1.3, 0, 1); fx.dark = clamp((t - 0.3) / 1.0, 0, 1);
        fx.hideCat = fx.dark > 0.6;
        z = fz * (1 + 0.06 * ease(clamp((t - 0.3) / 1.6, 0, 1)));
      }
    }
  }
  renderWorld(lv, st, cam, z, fx);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (R.phase === "rewind" || R.phase === "freeze") {
    if (R.phase === "rewind") {
      ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "rgba(128,128,128,.75)"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255,255,255,.06)"; for (let y = (performance.now() / 20) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 2);
      const t = performance.now() / 1000; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 10);
      const x = W - 76, y = 56;
      ctx.fillStyle = "rgba(30,25,35,.45)"; ctx.beginPath(); ctx.arc(x + 21, y, 34, 0, 6.283); ctx.fill();
      ctx.fillStyle = "#fff";
      for (const o of [0, 22]) { ctx.beginPath(); ctx.moveTo(x + o, y); ctx.lineTo(x + o + 20, y - 14); ctx.lineTo(x + o + 20, y + 14); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  if (R.phase === "xfade") { const a = R.t < 0.3 ? R.t / 0.3 : 1 - (R.t - 0.3) / 0.3; ctx.fillStyle = `rgba(28,20,34,${clamp(R.t / 0.3, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
  if (R.phase === "pull" && R.li > 0 && R.t < 0.3) { ctx.fillStyle = `rgba(28,20,34,${1 - R.t / 0.3})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- word screen ----------
function startWord() {
  G.mode = "word"; WD = { t: 0, typed: 0 }; AU.reveal();
  $("msg").textContent = ""; $("from").textContent = ""; $("wordBtns").style.opacity = 0;
  $("makeBtn").textContent = G.fromShare ? "回赠 TA 一个词" : "我也写一个";
  $("word").classList.add("show");
}
function wordLayout() {
  const chars = [...G.word];
  const rows = [chars];
  if (chars.length > 5) { let k = Math.ceil(chars.length / 2); const sp = chars.indexOf(" ", 2); if (sp > 0 && sp < chars.length - 1) k = sp; rows.splice(0, 1, chars.slice(0, k), chars.slice(k).filter((c, i) => !(i === 0 && c === " "))); }
  const rw = r => r.reduce((a, c, i) => a + (c === " " ? 2.4 : 4) + (i ? 1.6 : 0), 0);
  const maxW = Math.max(...rows.map(rw));
  const s = Math.min(W * 0.84 / maxW, H * 0.42 / (rows.length * 6 + (rows.length - 1) * 2.2));
  const out = []; let gi = 0;
  const totalH = (rows.length * 6 + (rows.length - 1) * 2.2) * s, y0 = H * 0.36 - totalH / 2;
  rows.forEach((r, ri) => { let x = W / 2 - rw(r) * s / 2; r.forEach((c, i) => { if (i) x += 1.6 * s; if (c !== " ") out.push({ c, x, y: y0 + ri * 8.2 * s, s, gi: gi++ }); x += (c === " " ? 2.4 : 4) * s; }); });
  return out;
}
function renderWord(dt) {
  WD.t += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2d2236"); g.addColorStop(1, "#16101c"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t = WD.t;
  ctx.fillStyle = "rgba(255,230,200,.5)";
  for (let i = 0; i < 40; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 37.3) * 0.5 + 0.5) * H, a = 0.3 + 0.3 * Math.sin(t * 2 + i); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  const L = wordLayout(); let lastBox = null;
  for (const it of L) {
    const appear = clamp((t - 0.2 - it.gi * 0.35) / 0.6, 0, 1); if (appear <= 0) continue;
    const bounce = 1 + Math.sin(appear * Math.PI) * 0.15 + (it.c === "♥" && appear >= 1 ? Math.max(0, Math.sin((t - it.gi * 0.35 - 0.8) * 7)) * 0.06 * Math.max(0, 1 - (t - 2.5) / 3) : 0);
    const letter = compileLetter(it.c), s = it.s * easeOut(appear) * bounce;
    const cx = it.x + 2 * it.s, cy = it.y + 3 * it.s;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-2, -3); ctx.globalAlpha = appear;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowColor = "rgba(255,80,70,.6)"; ctx.shadowBlur = 14;
    for (const st of letter.strokes) {
      strokePath(st.pts); ctx.strokeStyle = "#e8413a"; ctx.lineWidth = 0.42; ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const st of letter.strokes) { strokePath(st.pts); ctx.strokeStyle = "rgba(255,160,140,.6)"; ctx.lineWidth = 0.12; ctx.stroke();
      ctx.fillStyle = "#c62f2a"; for (const p of [st.start, st.end]) { ctx.beginPath(); ctx.arc(p.x, p.y, 0.3, 0, 6.283); ctx.fill(); } }
    ctx.restore(); ctx.globalAlpha = 1;
    lastBox = it;
  }
  // sleeping cat next to the word
  const catA = clamp((t - 0.4 - L.length * 0.35) / 0.8, 0, 1);
  if (lastBox && catA > 0) {
    const cs = Math.min(150, W * 0.36);
    ctx.save(); ctx.globalAlpha = catA; ctx.translate(W / 2, lastBox.y + 6 * lastBox.s + 46); ctx.scale(cs, cs);
    ctx.fillStyle = "#f5a54e"; ctx.beginPath(); ctx.ellipse(0, 0, 0.2, 0.12, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = "#f5a54e"; ctx.lineWidth = 0.05; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0.02, 0.2, 0.2, 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0.15, -0.02, 0.09, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.1, -0.08); ctx.lineTo(0.12, -0.17); ctx.lineTo(0.17, -0.1); ctx.fill(); ctx.beginPath(); ctx.moveTo(0.18, -0.1); ctx.lineTo(0.24, -0.15); ctx.lineTo(0.235, -0.06); ctx.fill();
    ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.arc(0.14, -0.02, 0.018, 0.3, 2.8); ctx.stroke(); ctx.beginPath(); ctx.arc(0.2, -0.015, 0.018, 0.3, 2.8); ctx.stroke();
    ctx.strokeStyle = "#de7f30"; ctx.lineWidth = 0.02; for (const sx of [-0.1, -0.03, 0.04]) { ctx.beginPath(); ctx.moveTo(sx, -0.1); ctx.quadraticCurveTo(sx - 0.02, 0, sx, 0.1); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,240,220,.8)"; ctx.font = "bold 0.09px sans-serif"; const k = (t * 0.4) % 1; ctx.globalAlpha = catA * (1 - k); ctx.fillText("z", 0.28 + k * 0.08, -0.15 - k * 0.15);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  const doneLetters = 0.2 + L.length * 0.35 + 0.9;
  const msg = G.msg || (G.fromShare ? "" : "这是小猫替你绕出来的字");
  if (t > doneLetters) {
    const n = Math.min([...msg].length, Math.floor((t - doneLetters) * 12));
    if (n !== WD.typed) { WD.typed = n; $("msg").textContent = [...msg].slice(0, n).join(""); if (n % 2 === 1) AU.tone(1200, 0.03, { vol: 0.03 }); }
    if (t > doneLetters + [...msg].length / 12 + 0.8) $("wordBtns").style.opacity = 1;
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
$("genBtn").addEventListener("click", () => { const l = currentLink(); if (!l) return; $("link").value = l; $("linkBox").style.display = "block"; });
function toast(t) { const el = $("toast"); el.textContent = t; el.style.display = "block"; clearTimeout(toast._t); toast._t = setTimeout(() => el.style.display = "none", 1600); }
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

// ---------- start ----------
function showStart() {
  G.mode = "start"; $("start").classList.add("show");
  const n = G.levels.length;
  if (G.fromShare) { $("startSub").textContent = `有人给你做了个小游戏，一共 ${n} 关`; $("startSub2").textContent = G.msg ? "通关以后，TA 有一句话要对你说" : "通关以后有个小惊喜"; }
  else { $("startSub").textContent = "小猫在院子里玩毛线"; $("startSub2").textContent = `一共 ${n} 关，玩完有个小惊喜`; }
}
$("startBtn").addEventListener("click", () => { AU.init(); $("start").classList.remove("show"); startLevel(0); });

// ---------- input ----------
cv.addEventListener("pointerdown", e => { AU.init(); input.down = true; input.id = e.pointerId; input.x = e.clientX; input.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
cv.addEventListener("pointermove", e => { if (input.down && e.pointerId === input.id) { input.x = e.clientX; input.y = e.clientY; } e.preventDefault(); });
const up = e => { if (e.pointerId === input.id) input.down = false; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
document.addEventListener("touchmove", e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
window.addEventListener("keydown", e => { AU.init(); input.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
window.addEventListener("keyup", e => { input.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    for (let k = 0; k < (G.steps || 1); k++) {
      if (G.mode === "play") updatePlay(dt);
      else if (G.mode === "rewind") updateReveal(dt);
    }
    if (G.mode === "play") {
      const z = playZ();
      const at = renderWorld(S.lv, { cat: S.cat, si: S.si, ci: S.ci, pen: S.pen, trailN: S.lv.trail.length, allDone: S.allDone, s: S.s }, S.cam, z, { live: true });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (S.clearT < 0) drawSpill(at, S.cam, z);
      drawHUD(); drawFinger();
      if (S.clearT > 0.6) { ctx.fillStyle = `rgba(253,246,233,${clamp((S.clearT - 0.6) / 0.6, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
      if (S.t < 0.5 && G.li > 0) { ctx.fillStyle = `rgba(253,246,233,${1 - S.t / 0.5})`; ctx.fillRect(0, 0, W, H); }
    } else if (G.mode === "rewind") renderReveal();
    else if (G.mode === "word") renderWord(dt);
    else if (G.mode === "start" && G.levels.length) {
      const lv = G.levels[0], p = lv.strokes[0].start;
      renderWorld(lv, { cat: { x: p.x, y: p.y, dir: 0, walk: 0, moving: false }, si: 0, ci: 0, pen: true, trailN: 0, allDone: false, s: 0 }, { x: p.x, y: p.y }, Z, { reveal: true });
    }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

// test hooks
window.__game = {
  G, get S() { return S; }, get R() { return R; },
  set auto(v) { G.auto = v; }, get auto() { return G.auto; },
  set steps(v) { G.steps = v; }, get steps() { return G.steps; },
  setTarget(x, y) { G.target = x == null ? null : { x, y }; },
  start() { $("startBtn").click(); },
  encodeShare, decodeShare, buildLevel, routeDist(x, y) { const lv = S.lv; return Math.min(...lv.strokes.map(s => nearestOnStroke(s, x, y, 0, 1e9).d)); },
};

parseHash(); setupLevels(); showStart();
requestAnimationFrame(frame);
})();
