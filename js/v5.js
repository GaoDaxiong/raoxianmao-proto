// 团绒 v5 — side-scrolling platformer; the route secretly spells "U". World units: 1 ≈ 团绒 diameter. y points down.
(() => {
"use strict";
const cv = document.getElementById("cv"), ctx = cv.getContext("2d", { alpha: false });
const $ = id => document.getElementById(id), stage = $("stage");
let W = 844, H = 390, DPR = 1, Z = 40, ROT = false, SAL = 0, SAR = 0;
const COARSE = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const iw = innerWidth, ih = innerHeight; ROT = ih > iw && COARSE;
  W = ROT ? ih : iw; H = ROT ? iw : ih;
  stage.style.width = W + "px"; stage.style.height = H + "px";
  stage.style.transform = ROT ? "rotate(90deg) translateY(-100%)" : "none";
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  Z = H / 9.6;
  const cs = getComputedStyle(document.documentElement), px = v => parseInt(cs.getPropertyValue(v)) || 0;
  SAL = ROT ? px("--sat") : px("--sal"); SAR = ROT ? px("--sab") : px("--sar");
  stick.id = null; stick.active = false; stick.x = stick.y = stick.mag = 0; for (const b of BTN) { b.id = null; b.down = false; }
}
const toStage = (cx, cy) => ROT ? { x: cy, y: H - cx } : { x: cx, y: cy };

// ---------- share (same #c= format as v1-v4) ----------
const KEY = [121, 97, 114, 110, 99, 97, 116];
function encodeShare(word, msg) { const b = new TextEncoder().encode(word + "\n" + msg); let s = ""; b.forEach((v, i) => s += String.fromCharCode(v ^ KEY[i % KEY.length])); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function decodeShare(c) { try { let s = c.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ KEY[i % KEY.length]; const t = new TextDecoder().decode(b), k = t.indexOf("\n"); return { word: (k >= 0 ? t.slice(0, k) : t).slice(0, 8), msg: (k >= 0 ? t.slice(k + 1) : "").slice(0, 60) }; } catch (e) { return null; } }

// ---------- level: the "U" valley ----------
const F = x => 42 + 11 * Math.sin(Math.PI * (x - 9) / 43);          // valley floor (bottom curve of the U)
const FP = x => 11 * Math.PI / 43 * Math.cos(Math.PI * (x - 9) / 43);
const Gc = x => F(x) - 8;                                           // underside of the inner rock (valley ceiling)
const WALLS = [[-20, -40, 7, 17], [-20, 17, 1, 21], [-20, 21, 7, 80],                         // left cliff, with a fake cave (y17-21)
  [54, -40, 80, 4], [62, 4, 80, 8], [54, 8, 80, 35], [66, 35, 80, 40], [54, 40, 80, 80]];     // right cliff, fake ledge (y4-8) + fake tunnel (y35-40)
const DOOR = [42.6, 39.5, 43.4, 50.5];
const START = { x: 8.6, y: 2 - .45 };
const GOAL = { x: 48.6, y: 1, box: [46, -6, 54, 2.2] };
function freshLevel() {
  return {
    plats: [ { x0: 7, x1: 10.5, y: 2, kind: "ledge" }, { x0: 10.5, x1: 13.6, y: 9, kind: "plank" }, { x0: 8.8, x1: 12.2, y: 15, kind: "crumble", t: -1, gone: 0 },
      { x0: 10, x1: 13.2, y: 28, kind: "plank" }, { x0: 50.6, x1: 54, y: 22, kind: "plank" }, { x0: 46, x1: 51, y: 1, kind: "nest" } ],
    shrooms: [ { x: 50, y: F(50), v: 21, sq: 0 }, { x: 52.6, y: 22, v: 22.5, sq: 0 } ],
    updrafts: [ [46.4, 19.6, 53.6, 41.5], [46.4, -1.5, 53.6, 16.2] ],
    winds: [ { r: [1, 17, 7, 21], vx: 11, fake: 1 }, { r: [54, 4, 62, 8], vx: -12, fake: 1 }, { r: [54, 35, 66, 40], vx: -12, fake: 1 } ],
    bat: { hx: 24, x: 24, y: 50.2, stun: 0, vx: 0, vy: 0, t: 0 },
    sw: { x: 30.5, on: false, t: 0 }, door: { open: 0, closed: true },
    wisps: [], vines: [ [12.6, 28, 4.5], [8.4, 15, 3], [47, 22, 5] ],
  };
}
function addWisps(L) {
  const w = (x, y, ab) => L.wisps.push({ x, y, ab: ab || null, got: 0, ph: Math.random() * 6 });
  w(10.2, 4.6); w(12.2, 7.4, "glide"); w(11.4, 12); w(10.4, 18.5); w(11, 23.5); w(11.6, 26.5); w(12.2, 32); w(11.6, 36.5);
  for (let x = 14; x <= 44; x += 3.4) w(x, F(x) - 1.1 - (Math.abs(x - 30.5) < 2 ? 0 : 0.4));
  w(48.6, F(48.6) - 1.4, "hop"); w(50, 36); w(50, 31); w(50, 26); w(52.6, 18.8); w(50.6, 12.5); w(49.6, 8); w(49.2, 4.2);
}
function sdBox(x, y, b) { const hx = (b[2] - b[0]) / 2, hy = (b[3] - b[1]) / 2, dx = Math.abs(x - (b[0] + hx)) - hx, dy = Math.abs(y - (b[1] + hy)) - hy; return hyp(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); }
function sdf(x, y) {
  let d = 1e9; for (const b of WALLS) d = Math.min(d, sdBox(x, y, b));
  const n = Math.sqrt(1 + FP(x) ** 2);
  d = Math.min(d, Math.max((F(x) - y) / n, 6 - x, x - 55));
  d = Math.min(d, Math.max(15 - x, x - 46, (y - Gc(x)) / n, -30 - y));
  if (S && S.L.door.closed) d = Math.min(d, sdBox(x, y, DOOR));
  return d;
}
function grad(x, y) { const e = .01, gx = sdf(x + e, y) - sdf(x - e, y), gy = sdf(x, y + e) - sdf(x, y - e), l = hyp(gx, gy) || 1; return { x: gx / l, y: gy / l }; }
const inR = (r, x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3];

// ---------- input ----------
const STICK_R = 58, DEAD = .12;
const stick = { id: null, active: false, bx: 0, by: 0, kx: 0, ky: 0, x: 0, y: 0, mag: 0 };
const BTN = [ { k: "jump", id: null, down: false, q: 0, r: 40 }, { k: "act", id: null, down: false, q: 0, r: 30 } ];
function btnPos() { const j = BTN[0], a = BTN[1]; j.x = W - SAR - 74; j.y = H - 74; a.x = j.x - 92; a.y = H - 50; return BTN; }
const keys = {};
function setKnob(x, y) {
  const dx = x - stick.bx, dy = y - stick.by, d = hyp(dx, dy), cl = Math.min(d, STICK_R);
  stick.kx = stick.bx + (d ? dx / d * cl : 0); stick.ky = stick.by + (d ? dy / d * cl : 0);
  const m = clamp((d / STICK_R - DEAD) / (1 - DEAD), 0, 1); stick.mag = m; stick.x = d ? dx / d * m : 0; stick.y = d ? dy / d * m : 0;
}
function onDown(e) {
  AU.init(); const p = toStage(e.clientX, e.clientY);
  if (G.mode === "play") {
    btnPos();
    if (stick.id == null && p.x < W * .45) { stick.id = e.pointerId; stick.active = true; stick.bx = clamp(p.x, SAL + STICK_R + 6, W * .45); stick.by = clamp(p.y, STICK_R + 6, H - STICK_R - 6); setKnob(p.x, p.y); }
    else if (p.x >= W * .45) { // generous: nearest button wins anywhere on the right side
      const [j, a] = BTN, b = hyp(p.x - a.x, p.y - a.y) < a.r * 1.7 && hyp(p.x - a.x, p.y - a.y) < hyp(p.x - j.x, p.y - j.y) ? a : j;
      if (b.id == null) { b.id = e.pointerId; b.down = true; b.q = 1; if (navigator.vibrate) try { navigator.vibrate(6); } catch (_) {} }
    }
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
}
function onMove(e) { if (e.pointerId === stick.id) { const p = toStage(e.clientX, e.clientY); setKnob(p.x, p.y); } e.preventDefault(); }
function onUp(e) {
  if (e.pointerId === stick.id) { stick.id = null; stick.active = false; stick.mag = stick.x = stick.y = 0; }
  for (const b of BTN) if (e.pointerId === b.id) { b.id = null; b.down = false; }
}
cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
document.addEventListener("touchmove", e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
const JK = ["z", "k", " ", "w", "ArrowUp"], AK = ["x", "j", "Shift"];
addEventListener("keydown", e => { AU.init(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (!e.repeat) { if (JK.includes(k)) BTN[0].q = 1; if (AK.includes(k)) BTN[1].q = 1; } keys[k] = true; if (k.startsWith("Arrow") || k === " ") e.preventDefault(); });
addEventListener("keyup", e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
function readInput() {
  let x = stick.x, y = stick.y;
  if (keys.ArrowLeft || keys.a) x = -1; if (keys.ArrowRight || keys.d) x = 1; if (keys.ArrowDown || keys.s) y = 1;
  const jd = BTN[0].down || JK.some(k => keys[k]), ad = BTN[1].down || AK.some(k => keys[k]);
  if (G.botDrive && G.bot) { const b = G.bot; x = b.x; y = b.y || 0; if (b.jq) BTN[0].q = 1; if (b.aq) BTN[1].q = 1; b.jq = b.aq = 0; return { x, y, jd: b.j, ad: false }; }
  return { x, y, jd, ad };
}

// ---------- state ----------
const G = { mode: "start", t: 0, msg: "", word: "I♥U", fromShare: false, bot: null, steps: 1 };
let S = null;
const PH = { g: 36, maxFall: 15, jumpV: 13.4, run: 7.4, walk: 3.8, gAcc: 95, gDec: 150, aAcc: 60, glideFall: 2.5, glideFallL: 1.05, upV: 6.4, coyote: .11, buffer: .13, r: .45 };
function newState() {
  const L = freshLevel(); addWisps(L);
  return { L, t: 0, p: { x: START.x, y: START.y, vx: 0, vy: 0, gs: 0, ground: null, gn: { x: 0, y: -1 }, coyote: 0, buf: 0, abuf: 0, jumping: false, glide: false, face: 1, sq: 1, sqv: 0,
    blink: 2, ear: 0, earV: 0, walk: 0, drop: 0, puffT: 0, airPuff: 1, hops: 0, hurt: 0, landT: 0 },
    cam: { x: START.x + 2, y: START.y - .4 }, trail: [], tAcc: 0, got: 0, ab: { glide: 0, hop: 0 }, fx: [], puffs: [], done: false, goalT: 0, hintT: 0, hints: {} };
}
function hint(text, dur) { $("hintText").textContent = text; $("hint").classList.add("show"); clearTimeout(hint._t); if (dur) hint._t = setTimeout(() => $("hint").classList.remove("show"), dur); }

// ---------- physics ----------
function plat(p, nx, ny) { // one-way landing
  for (const q of S.L.plats) {
    if (q.gone) continue;
    if (p.vy >= 0 && p.drop <= 0 && p.y + PH.r <= q.y + .03 && ny + PH.r >= q.y && nx > q.x0 - .25 && nx < q.x1 + .25) return q;
  }
  return null;
}
function step(h, inp) {
  const p = S.p, L = S.L, r = PH.r;
  // timers
  p.coyote -= h; p.buf -= h; p.drop -= h; p.hurt -= h; p.landT -= h;
  for (const k in S.ab) S.ab[k] = Math.max(0, S.ab[k] - h);
  // wind / updraft
  let wx = 0, inUp = false;
  for (const w of L.winds) if (inR(w.r, p.x, p.y)) wx += w.vx;
  for (const u of L.updrafts) if (inR(u, p.x, p.y)) inUp = true;
  const ax = Math.abs(inp.x) < .08 ? 0 : Math.sign(inp.x) * (Math.abs(inp.x) < .55 ? PH.walk + (PH.run - PH.walk) * (Math.abs(inp.x) - .08) / .47 * .5 : PH.run);
  if (ax) p.face = Math.sign(ax);
  const target = ax + wx;
  if (p.ground) {
    // ground run along the surface tangent; turning is instant, release stops within ~3 frames
    if (ax && Math.sign(ax) !== Math.sign(p.gs) && p.gs) p.gs = 0;
    const a = target === 0 || Math.abs(target) < Math.abs(p.gs) ? PH.gDec : PH.gAcc;
    p.gs = p.gs < target ? Math.min(target, p.gs + a * h) : Math.max(target, p.gs - a * h);
    const t = { x: -p.gn.y, y: p.gn.x }; p.vx = t.x * p.gs; p.vy = t.y * p.gs;
    if (inp.y > .6 && p.buf > 0 && p.ground.kind && p.ground.kind !== "ledge" && p.ground.kind !== "nest") { p.drop = .25; p.ground = null; p.buf = 0; }
  } else {
    if (ax && Math.sign(ax) !== Math.sign(p.vx) && Math.abs(p.vx) > 1 && !wx) p.vx *= .5;
    const a = PH.aAcc * (ax ? 1 : .55);
    p.vx = p.vx < target ? Math.min(target, p.vx + a * h) : Math.max(target, p.vx - a * h);
    let g = PH.g;
    if (p.jumping && !inp.jd && p.vy < 0) { p.vy *= .5; p.jumping = false; }
    p.glide = inp.jd && (p.vy > -1 || inUp) && !p.jumping0;
    if (p.vy >= 0) p.jumping0 = false;
    if (inUp) { if (p.glide) { p.vy = lerp(p.vy, -PH.upV, 1 - Math.exp(-h * 3.2)); g = 0; } else g *= .45; }
    p.vy += g * h;
    if (p.glide && !inUp) p.vy = Math.min(p.vy, S.ab.glide > 0 ? PH.glideFallL : PH.glideFall);
    p.vy = Math.min(p.vy, PH.maxFall);
  }
  if (inp.jd && p.vy > 0 && !p.ground) p.jumping0 = false;
  // jump (coyote + buffer)
  if (p.buf > 0 && (p.ground || p.coyote > 0) && !(inp.y > .6 && p.ground && p.ground.kind && p.ground.kind !== "ledge" && p.ground.kind !== "nest")) {
    p.vx = p.ground ? p.vx : p.vx; p.vy = -PH.jumpV; p.ground = null; p.coyote = 0; p.buf = 0; p.jumping = true; p.jumping0 = true; p.sqv = .5; AU.tone(520, .12, { type: "triangle", vol: .07, slide: 1.6 }); dust(p.x, p.y + r, 4);
  } else if (p.buf > 0 && !p.ground && S.ab.hop > 0 && p.hops > 0) { p.vy = -10.5; p.hops--; p.buf = 0; p.jumping = true; p.jumping0 = true; p.sqv = .4; p.earV -= 12; AU.tone(700, .1, { vol: .06, slide: 1.4 }); puffFx(p.x, p.y + .4, 0, 1); }
  // action: wind puff
  if (p.abuf > 0) { p.abuf = 0; doPuff(); }
  // integrate
  const ox = p.x, oy = p.y; let nx = p.x + p.vx * h, ny = p.y + p.vy * h;
  const was = p.ground; let land = plat(p, nx, ny);
  if (land) { ny = land.y - r; if (!was) onLand(p); p.vy = 0; p.ground = land; p.gn = { x: 0, y: -1 }; if (!was) p.gs = p.vx; }
  p.x = nx; p.y = ny;
  let grounded = !!land, gn = land ? { x: 0, y: -1 } : null;
  for (let it = 0; it < 4; it++) {
    const d = sdf(p.x, p.y); if (d >= r) break;
    const n = grad(p.x, p.y); p.x += n.x * (r - d); p.y += n.y * (r - d);
    const vn = p.vx * n.x + p.vy * n.y; if (vn < 0) { p.vx -= n.x * vn; p.vy -= n.y * vn; }
    if (n.y < -.55) { grounded = true; gn = n; } else if (p.ground && Math.abs(n.x) > .7 && p.gs * n.x < 0) p.gs = 0;
  }
  // keep feet glued when running over convex curves / downhill
  if (!grounded && was && !p.jumping0 && p.vy > -1) {
    if (was.kind) { if (was.gone || p.x < was.x0 - .25 || p.x > was.x1 + .25) {} else { p.y = was.y - r; grounded = true; gn = { x: 0, y: -1 }; land = was; } }
    else { let tot = 0; for (let k = 0; k < 3; k++) { const d = sdf(p.x, p.y) - r; if (d > .001 && tot + d < .45) { p.y += d; tot += d; } } if (sdf(p.x, p.y) - r < .02) { const n = grad(p.x, p.y); if (n.y < -.55) { grounded = true; gn = n; } } }
  }
  if (grounded) {
    if (!was) { onLand(p); const t = { x: -gn.y, y: gn.x }; p.gs = p.vx * t.x + p.vy * t.y; }
    p.ground = land || { surf: 1 }; p.gn = gn; p.coyote = PH.coyote; p.jumping = p.jumping0 = false; p.glide = false; p.airPuff = 1; p.hops = 3;
    if (!land) { const t = { x: -gn.y, y: gn.x }; p.vy = t.y * p.gs; }
  } else { if (was) p.coyote = PH.coyote; p.ground = null; }
  // crumbling plank
  for (const q of L.plats) if (q.kind === "crumble") {
    if (p.ground === q && q.t < 0) { q.t = 0; AU.creak && AU.creak(0, .8); }
    if (q.t >= 0 && !q.gone) { q.t += h; if (q.t > .55) { q.gone = 1; q.gt = 0; if (p.ground === q) p.ground = null; AU.clunk && AU.clunk(0); for (let i = 0; i < 7; i++) S.fx.push({ k: "chip", x: lerp(q.x0, q.x1, i / 6), y: q.y, vx: (Math.random() - .5) * 2, vy: -1 - Math.random() * 2, t: 0, r: Math.random() * 6 }); } }
    if (q.gone) { q.gt += h; if (q.gt > 3.2 && hyp(p.x - (q.x0 + q.x1) / 2, p.y - q.y) > 2) { q.gone = 0; q.t = -1; } }
  }
  // bounce mushrooms
  for (const m of L.shrooms) if (p.vy >= -.5 && Math.abs(p.x - m.x) < .95 && p.y + r > m.y - 1.45 && p.y + r < m.y + .15) {
    p.vy = -m.v; p.ground = null; p.jumping = false; p.jumping0 = true; p.sqv = .7; m.sq = 1; p.hops = 3; p.airPuff = 1; AU.boing(); p.y = Math.min(p.y, m.y - 1 - r);
  }
  // bat (gentle: bump, never kills)
  const B = L.bat; if (p.hurt <= 0 && B.stun <= 0 && hyp(p.x - B.x, p.y - B.y) < r + .42) { const dx = p.x - B.x || -1; p.vx = Math.sign(dx) * 6; p.vy = -6; p.gs = 0; p.ground = null; p.hurt = .8; p.sqv = -.4; AU.tone(330, .15, { type: "triangle", vol: .06, slide: .7 }); hint("小蝙蝠在打瞌睡，按「风」把它吹开～", 2600); }
  // switch flower + gate
  if (!L.sw.on && Math.abs(p.x - L.sw.x) < 1 && p.y + r > F(L.sw.x) - 1.3) pressSwitch();
  // wisps
  for (const w of L.wisps) if (!w.got && hyp(p.x - w.x, p.y - w.y) < .85) {
    w.got = 1; S.got++; AU.bell(1568 + (S.got % 5) * 120, .05, 0, 0, .7, .4);
    for (let i = 0; i < 8; i++) S.fx.push({ k: "spark", x: w.x, y: w.y, vx: Math.cos(i) * 2.4, vy: Math.sin(i) * 2.4, t: 0 });
    if (w.ab === "glide") { S.ab.glide = 14; hint("蒲公英绒毛！耳朵滑翔更久了（按住跳跃）", 3000); AU.clear(); }
    if (w.ab === "hop") { S.ab.hop = 18; p.hops = 3; hint("风铃草之力：空中还能再扑腾 3 下！", 3000); AU.clear(); }
  }
  // goal
  if (!S.done && inR(GOAL.box, p.x, p.y)) { S.done = true; S.goalT = 0; AU.clear(); hint("到啦！", 1200); }
  // trail
  S.tAcc += h; if (S.tAcc > 1 / 30) { S.tAcc = 0; const l = S.trail[S.trail.length - 1]; if (!l || hyp(l.x - p.x, l.y - p.y) > .06) S.trail.push({ x: p.x, y: p.y, t: S.t }); }
}
function onLand(p) { const v = p.vy; if (v > 4) { p.sqv = -Math.min(.9, v / 14); dust(p.x, p.y + PH.r, 6); AU.noise(.08, { freq: 900, q: 1, vol: .05 }); } p.landT = .15; }
function pressSwitch() { const L = S.L; L.sw.on = true; L.sw.t = 0; AU.knot(); hint("咔哒——远处的藤门打开了", 2600); }
function doPuff() {
  const p = S.p, L = S.L; p.puffT = .35; AU.noise(.25, { freq: 1400, q: .8, vol: .07, slide: .4 }); puffFx(p.x + p.face * .5, p.y, p.face, 0);
  const B = L.bat; if (hyp(B.x - (p.x + p.face * 1.2), B.y - p.y) < 2.6) { B.stun = 4; B.vx = p.face * 5; B.vy = -4; AU.tone(880, .2, { vol: .05, slide: 1.5 }); }
  if (!L.sw.on && hyp(L.sw.x - p.x, F(L.sw.x) - p.y) < 2.2) pressSwitch();
  if (!p.ground && p.airPuff) { p.airPuff = 0; p.vy = Math.min(p.vy, -4.5); p.jumping = false; }
}
function dust(x, y, n) { for (let i = 0; i < n; i++) S.fx.push({ k: "dust", x: x + (Math.random() - .5) * .5, y, vx: (Math.random() - .5) * 3, vy: -Math.random() * 1.2, t: 0 }); }
function puffFx(x, y, dir, down) { for (let i = 0; i < 6; i++) S.puffs.push({ x, y, vx: dir * (5 + Math.random() * 3) + (Math.random() - .5), vy: down ? 3 + Math.random() * 2 : (Math.random() - .5) * 2, t: 0, s: .2 + Math.random() * .15 }); }

function updatePlay(dt) {
  if (G.botDrive) botStep();
  const inp = readInput(), p = S.p;
  if (BTN[0].q) { p.buf = PH.buffer; BTN[0].q = 0; }
  if (BTN[1].q) { p.abuf = 1; BTN[1].q = 0; }
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { S.t += h; step(h, inp); if (S.done) break; }
  const L = S.L;
  // bat drift
  const B = L.bat; B.t += dt;
  if (B.stun > 0) { B.stun -= dt; B.x += B.vx * dt; B.y += B.vy * dt; B.vx *= .96; B.vy *= .96; B.y = Math.max(B.y, Gc(B.x) + .6); }
  else { const tx = B.hx + Math.sin(B.t * .45) * 3, ty = 50.2 + Math.sin(B.t * 1.6) * .5; B.x = lerp(B.x, tx, 1 - Math.exp(-dt * 1.5)); B.y = lerp(B.y, ty, 1 - Math.exp(-dt * 1.5)); }
  if (L.sw.on) { L.door.open = Math.min(1, L.door.open + dt * .8); if (L.door.open > .55) L.door.closed = false; }
  for (const m of L.shrooms) m.sq = Math.max(0, m.sq - dt * 3);
  // character anim
  const sp = p.ground ? Math.abs(p.gs) : 0;
  p.walk += sp * dt * 2.2;
  p.sqv += (-(p.sq - 1) * 160 - p.sqv * 12) * dt; p.sq += p.sqv * dt * 6; p.sq = clamp(p.sq, .65, 1.4);
  if (!p.ground) p.sq = lerp(p.sq, 1 + clamp(-p.vy * .012, -.12, .12), .1);
  const earT = p.glide ? 1 : 0; p.earV += ((earT - p.ear) * 90 - p.earV * 11) * dt; p.ear += p.earV * dt;
  p.blink -= dt; if (p.blink < -.12) p.blink = 1.5 + Math.random() * 3;
  p.puffT -= dt;
  if (p.ground && sp > 5 && Math.random() < dt * 8) dust(p.x - p.face * .2, p.y + PH.r, 1);
  if (p.glide && Math.random() < dt * 20) S.fx.push({ k: "fluff", x: p.x + (Math.random() - .5) * 1.4, y: p.y - .2, vx: -p.vx * .2, vy: .4, t: 0 });
  // tutorial hints
  if (!S.hints.a && S.t > .6) { S.hints.a = 1; hint(COARSE ? "左手摇杆走 · 右手「跳」，按住可以耳朵滑翔" : "方向键走 · Z/空格 跳（按住滑翔）· X 吹风", 4200); }
  if (!S.hints.b && p.y > 38 && p.x < 20) { S.hints.b = 1; hint("顺着山谷跑下去～", 2200); }
  if (!S.hints.c && p.x > 46 && p.y > 30) { S.hints.c = 1; hint("踩蘑菇弹起来，进上升气流后按住「跳」滑翔！", 3200); }
  if (!L.sw.on && p.x > 41.4 && !S.hints.d) { S.hints.d = 1; hint("藤门关着……回山谷最低处踩一下发光的花", 3000); }
  for (const w of L.winds) if (inR(w.r, p.x, p.y) && !S.hints["w" + w.vx]) { S.hints["w" + w.vx] = 1; hint("呼——风太大了，这边走不通", 2000); }
  // camera: close follow with gentle look-ahead (keeps the letter hidden)
  const lx = clamp(p.vx * .18, -1.6, 1.6), ly = clamp(p.vy * .14, -1.2, 1.6);
  const c = S.cam, k = 1 - Math.exp(-dt * 7);
  c.x = lerp(c.x, p.x + lx, k); c.y = lerp(c.y, p.y + ly - .3, k);
  fxStep(dt);
  if (S.done) { S.goalT += dt; if (S.goalT > 1.1) startReveal(); }
}
function fxStep(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === "chip") f.vy += 20 * dt; if (f.k === "fluff") f.vx *= .98; if (f.t > (f.k === "fluff" ? 1.2 : f.k === "chip" ? 1.5 : .6)) S.fx.splice(i, 1); }
  for (let i = S.puffs.length - 1; i >= 0; i--) { const f = S.puffs[i]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .92; f.vy *= .92; if (f.t > .5) S.puffs.splice(i, 1); }
}

// ---------- art ----------
const COL = { fur: "#E6E4E2", furS: "#C9C5C2", furD: "#A9A4A1", line: "#6f6764", tip: "#9EC3EA", tipD: "#6f9fd0", eye: "#4a2c1c", eye2: "#8a5434" };
function drawTuan(c, p, t, s) {
  s = s || 1;
  const sq = p.sq || 1, f = p.face || 1, gl = clamp(p.ear || 0, -.2, 1.25);
  c.save(); c.translate(p.x, p.y + PH.r); c.scale(s / Math.sqrt(sq), s * sq); c.translate(0, -PH.r);
  const tilt = p.ground ? clamp((p.gs || 0) * .012, -.1, .1) + Math.atan2(p.gn ? p.gn.x : 0, -(p.gn ? p.gn.y : -1)) * .5 : clamp((p.vx || 0) * .02, -.15, .15);
  c.rotate(tilt);
  const R = .45, flap = Math.sin(t * 13) * .12 * gl;
  // ears (behind when gliding)
  const drawEar = (side, front) => {
    c.save(); c.translate(side * .2, -.3);
    const a = side * (lerp(.32, 1.62, gl) + flap) + (p.ground ? Math.sin(p.walk * 3) * .05 * side : (!gl ? clamp(p.vy * .025, -.3, .25) * side : 0)) + Math.sin(t * 1.7 + side) * .03;
    c.rotate(-a);
    const Lh = lerp(.62, .82, gl), w = lerp(.17, .22, gl);
    c.beginPath(); c.moveTo(-w * .55, 0); c.bezierCurveTo(-w * 1.2, Lh * .5, -w * .7, Lh, 0, Lh + .02); c.bezierCurveTo(w * .7, Lh, w * 1.2, Lh * .5, w * .55, 0); c.closePath();
    c.fillStyle = COL.fur; c.fill(); c.save(); c.clip();
    c.fillStyle = COL.furS; c.fillRect(side * w * .1, -.1, w * 2, Lh * 1.3);
    c.fillStyle = "#F4F1EE"; c.beginPath(); c.ellipse(-side * w * .1, Lh * .45, w * .32, Lh * .3, 0, 0, 7); c.fill();
    c.fillStyle = COL.tip; c.fillRect(-w * 2, Lh * .7, w * 4, Lh); c.fillStyle = COL.tipD; c.fillRect(side * w * .15, Lh * .7, w * 2, Lh);
    c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(-w * 2, Lh * .7, w * 4, .025);
    c.restore(); c.lineWidth = .03; c.strokeStyle = COL.line; c.stroke(); c.restore();
  };
  if (gl > .4) { drawEar(-1); drawEar(1); }
  // tail
  c.save(); c.translate(-f * .41, .14 + Math.sin(t * 4) * .015);
  c.beginPath(); c.arc(0, 0, .13, 0, 7); c.fillStyle = COL.fur; c.fill(); c.lineWidth = .028; c.strokeStyle = COL.line; c.stroke();
  c.beginPath(); c.arc(-f * .04, .02, .075, 0, 7); c.fillStyle = COL.tip; c.fill(); c.restore();
  // feet
  const wk = p.ground ? Math.sin(p.walk * 3) : 0, air = p.ground ? 0 : 1;
  for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * .17 + f * .03 + wk * .08 * sd, .41 - Math.max(0, wk * sd) * .06 - air * .03, .12, .075, 0, 0, 7); c.fillStyle = "#D6D2CF"; c.fill(); c.lineWidth = .028; c.strokeStyle = COL.line; c.stroke(); }
  // fuzzy body
  c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = R * (1 + .035 * Math.sin(a * 11 + 1.3) + .015 * Math.sin(a * 23)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .96; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
  c.fillStyle = COL.furS; c.fill(); c.save(); c.clip();
  c.fillStyle = COL.fur; c.beginPath(); c.arc(-.07, -.07, R * .93, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,.75)"; c.beginPath(); c.ellipse(-.17, -.24, .14, .07, -.5, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 7; i++) { const a = -2.4 + i * .3; c.beginPath(); c.arc(Math.cos(a) * R * .86, Math.sin(a) * R * .86, .03, 0, 7); c.fill(); }
  c.fillStyle = "rgba(120,140,170,.18)"; c.beginPath(); c.ellipse(0, .38, .4, .14, 0, 0, 7); c.fill();
  c.restore(); c.lineWidth = .032; c.strokeStyle = COL.line; c.stroke();
  // face
  const ex = f * .07, blink = p.blink < 0, happy = p.happy || 0;
  for (const sd of [-1, 1]) {
    const x = ex + sd * .155, y = -.03;
    if (blink || happy) { c.beginPath(); c.arc(x, y + .02, .06, Math.PI * 1.1, Math.PI * 1.9); c.lineWidth = .035; c.strokeStyle = COL.eye; c.lineCap = "round"; c.stroke(); continue; }
    c.beginPath(); c.ellipse(x, y, .085, .112, 0, 0, 7); c.fillStyle = COL.eye; c.fill();
    c.save(); c.clip(); c.fillStyle = COL.eye2; c.beginPath(); c.ellipse(x, y + .075, .08, .06, 0, 0, 7); c.fill(); c.restore();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(x - .028 + f * .01, y - .045, .034, 0, 7); c.fill(); c.beginPath(); c.arc(x + .03, y + .04, .015, 0, 7); c.fill();
  }
  c.fillStyle = "rgba(158,195,234,.28)"; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(ex + sd * .25, .1, .06, .03, 0, 0, 7); c.fill(); }
  c.beginPath(); const my = .11; if (p.puffT > 0) { c.ellipse(ex + f * .02, my + .01, .03, .035, 0, 0, 7); c.fillStyle = COL.eye; c.fill(); }
  else { c.moveTo(ex - .04, my); c.quadraticCurveTo(ex - .02, my + .03, ex, my + .005); c.quadraticCurveTo(ex + .02, my + .03, ex + .04, my); c.lineWidth = .024; c.strokeStyle = "#5a3a2e"; c.lineCap = "round"; c.stroke(); }
  if (gl <= .4) { drawEar(-1); drawEar(1); }
  c.restore();
}
function drawWisp(c, w, t) {
  const bob = Math.sin(t * 2.2 + w.ph) * .1, x = w.x, y = w.y + bob, ab = !!w.ab;
  const g = c.createRadialGradient(x, y, 0, x, y, ab ? .9 : .6);
  g.addColorStop(0, ab ? "rgba(250,255,205,.95)" : "rgba(235,250,255,.9)"); g.addColorStop(.35, ab ? "rgba(214,240,140,.45)" : "rgba(160,215,245,.35)"); g.addColorStop(1, "rgba(160,215,245,0)");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, ab ? .9 : .6, 0, 7); c.fill();
  c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, .1 + Math.sin(t * 7 + w.ph) * .015, 0, 7); c.fill();
  if (ab) { c.strokeStyle = "rgba(255,255,230,.8)"; c.lineWidth = .03; for (let i = 0; i < 6; i++) { const a = t * .8 + i * 1.047; c.beginPath(); c.moveTo(x + Math.cos(a) * .16, y + Math.sin(a) * .16); c.lineTo(x + Math.cos(a) * .32, y + Math.sin(a) * .32); c.stroke(); c.beginPath(); c.arc(x + Math.cos(a) * .35, y + Math.sin(a) * .35, .035, 0, 7); c.fill(); } }
}
function drawBat(c, B, t) {
  c.save(); c.translate(B.x, B.y); const fl = Math.sin(t * (B.stun > 0 ? 18 : 6)) * .5;
  for (const sd of [-1, 1]) { c.save(); c.scale(sd, 1); c.rotate(-fl * .6); c.beginPath(); c.moveTo(.2, -.05); c.quadraticCurveTo(.6, -.45, .85, -.1); c.quadraticCurveTo(.7, -.05, .65, .08); c.quadraticCurveTo(.5, 0, .42, .12); c.quadraticCurveTo(.3, .05, .2, .12); c.closePath(); c.fillStyle = "#5d6684"; c.fill(); c.strokeStyle = "#3b4058"; c.lineWidth = .03; c.stroke(); c.restore(); }
  c.beginPath(); c.arc(0, 0, .32, 0, 7); c.fillStyle = "#717a99"; c.fill(); c.strokeStyle = "#3b4058"; c.lineWidth = .03; c.stroke();
  c.fillStyle = "#8a93b0"; c.beginPath(); c.ellipse(-.06, -.1, .16, .1, -.4, 0, 7); c.fill();
  for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * .12, -.26); c.lineTo(sd * .2, -.44); c.lineTo(sd * .26, -.22); c.fillStyle = "#717a99"; c.fill(); }
  c.strokeStyle = "#2b2b3a"; c.lineWidth = .035; c.lineCap = "round";
  for (const sd of [-1, 1]) { c.beginPath(); if (B.stun > 0) { c.moveTo(sd * .14 - .04, -.02); c.lineTo(sd * .14 + .04, .04); c.moveTo(sd * .14 + .04, -.02); c.lineTo(sd * .14 - .04, .04); } else c.arc(sd * .12, .0, .045, .2, Math.PI - .2); c.stroke(); }
  if (B.stun <= 0) { c.fillStyle = "rgba(255,255,255,.8)"; c.font = "bold .3px sans-serif"; c.fillText("z", .3, -.4 - (t * .5 % 1) * .3); }
  c.restore();
}
function drawShroom(c, m, t) {
  const sq = m.sq; c.save(); c.translate(m.x, m.y); c.scale(1 + sq * .25, 1 - sq * .3);
  c.fillStyle = "#efe6cf"; c.strokeStyle = "#6b5a44"; c.lineWidth = .04;
  c.beginPath(); c.moveTo(-.22, 0); c.quadraticCurveTo(-.26, -.4, -.16, -.6); c.lineTo(.16, -.6); c.quadraticCurveTo(.26, -.4, .22, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-.95, -.55); c.quadraticCurveTo(-.9, -1.3, 0, -1.35); c.quadraticCurveTo(.9, -1.3, .95, -.55); c.quadraticCurveTo(0, -.38, -.95, -.55); c.fillStyle = "#3fa3a0"; c.fill(); c.stroke();
  c.save(); c.clip(); c.fillStyle = "#2c7f86"; c.beginPath(); c.ellipse(.35, -.55, .9, .35, 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-.35, -1.12, .35, .1, -.3, 0, 7); c.fill(); c.restore();
  c.fillStyle = "#f6f1df"; for (const [x, y, r] of [[-.5, -.85, .12], [.1, -1.1, .1], [.5, -.8, .13], [-.1, -.75, .07]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.restore();
}
// world deco (precomputed)
const DECO = (() => {
  const R = rng(7), d = { grass: [], flowers: [], rocks: [], strata: [] };
  for (let x = 6.5; x < 54.5; x += .32) d.grass.push({ x, y: F(x), h: .25 + R() * .35, l: R() < .5 });
  for (let i = 0; i < 26; i++) { const x = 8 + R() * 45; d.flowers.push({ x, y: F(x), c: R() < .5 ? "#fff6d8" : R() < .5 ? "#c9e0ff" : "#ffe28a", s: .7 + R() * .5 }); }
  for (let i = 0; i < 60; i++) d.rocks.push({ x: R(), y: R(), r: .15 + R() * .4 });
  for (let i = 0; i < 300; i++) d.strata.push({ y: i * 1.35 - 45 + R() * .5, a: R() * .5 });
  return d;
})();
function rockFill(c, path, x0, y0, x1, y1, light) {
  c.save(); path(); c.clip();
  const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, light === 1 ? "#c8b596" : "#a99577"); g.addColorStop(1, light === 1 ? "#a6916f" : "#8c7a60");
  c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = "rgba(90,70,50,.22)"; c.lineWidth = .06;
  for (const s of DECO.strata) if (s.y > y0 - 1 && s.y < y1 + 1) { c.beginPath(); c.moveTo(x0, s.y); for (let x = x0; x < x1; x += 1.5) c.lineTo(x, s.y + Math.sin(x * .7 + s.a * 9) * .18); c.stroke(); }
  c.fillStyle = "rgba(255,240,210,.18)"; for (let y = Math.floor(y0); y < y1; y += 3) c.fillRect(x0, y + .3, x1 - x0, .08);
  c.restore();
}
function drawTerrain(c, cam, z) {
  const vx0 = cam.x - W / 2 / z - 2, vx1 = cam.x + W / 2 / z + 2, vy0 = cam.y - H / 2 / z - 2, vy1 = cam.y + H / 2 / z + 2;
  // walls
  for (const b of WALLS) {
    const x0 = Math.max(b[0], vx0), x1 = Math.min(b[2], vx1), y0 = Math.max(b[1], vy0), y1 = Math.min(b[3], vy1); if (x0 >= x1 || y0 >= y1) continue;
    rockFill(c, () => { c.beginPath(); c.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); }, x0, y0, x1, y1, b[0] < 10 ? 1 : 0);
    // cel edge bands on faces looking into the level
    c.fillStyle = "rgba(255,245,220,.35)"; if (b[2] < 30) c.fillRect(b[2] - .18, y0, .18, y1 - y0); else c.fillRect(b[0], y0, .12, y1 - y0);
    c.fillStyle = "rgba(60,45,30,.25)"; if (b[2] < 30) c.fillRect(b[2] - .45, y0, .12, y1 - y0); else c.fillRect(b[0] + .12, y0, .3, y1 - y0);
    // grassy lip on exposed tops
    if (b[1] > vy0 - 1 && b[1] < vy1 && b[1] > -39) grassStrip(c, Math.max(b[0], vx0), Math.min(b[2], vx1), () => b[1]);
    if (b[3] < 70 && b[3] > vy0) { c.fillStyle = "rgba(50,40,30,.35)"; c.fillRect(x0, b[3] - .25, x1 - x0, .25); hangVines(c, x0, x1, b[3]); }
  }
  // inner rock (inside of the U)
  if (vx1 > 15 && vx0 < 46) {
    const path = () => { c.beginPath(); c.moveTo(15, -30); c.lineTo(46, -30); for (let x = 46; x >= 15; x -= .5) c.lineTo(x, Gc(x)); c.closePath(); };
    rockFill(c, path, Math.max(15, vx0), Math.max(-30, vy0), Math.min(46, vx1), Math.min(48, vy1), 0);
    c.save(); path(); c.clip(); c.fillStyle = "rgba(255,245,220,.3)"; c.fillRect(15, vy0, .16, vy1 - vy0); c.fillStyle = "rgba(60,45,30,.25)"; c.fillRect(45.6, vy0, .4, vy1 - vy0);
    c.strokeStyle = "rgba(40,32,24,.35)"; c.lineWidth = .6; c.beginPath(); for (let x = 15; x <= 46; x += .5) c.lineTo(x, Gc(x)); c.stroke(); c.restore();
    for (let x = Math.max(15.5, Math.floor(vx0)); x < Math.min(46, vx1); x += .9) { const y = Gc(x), L = .4 + ((x * 7.3) % 1) * 1.1; c.strokeStyle = "#5f9a4a"; c.lineWidth = .07; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(G.t + x) * .1, y + L / 2, x + .05, y + L); c.stroke(); c.fillStyle = "#86c06a"; c.beginPath(); c.arc(x + .05, y + L, .07, 0, 7); c.fill(); }
  }
  // valley floor
  if (vy1 > 38) {
    c.beginPath(); c.moveTo(6, 80); for (let x = 6; x <= 55; x += .4) c.lineTo(x, F(x)); c.lineTo(55, 80); c.closePath();
    const g = c.createLinearGradient(0, 40, 0, 60); g.addColorStop(0, "#9b8460"); g.addColorStop(1, "#6f5c44"); c.fillStyle = g; c.fill();
    c.save(); c.clip(); c.fillStyle = "rgba(60,45,30,.25)"; for (const r of DECO.rocks) { const x = 6 + r.x * 49, y = F(x) + 1 + r.y * 6; c.beginPath(); c.ellipse(x, y, r.r, r.r * .6, 0, 0, 7); c.fill(); } c.restore();
    grassStrip(c, Math.max(6, vx0), Math.min(55, vx1), F);
    for (const f of DECO.flowers) if (f.x > vx0 && f.x < vx1) { const y = f.y - .05; c.strokeStyle = "#4f8a3c"; c.lineWidth = .04; c.beginPath(); c.moveTo(f.x, y); c.lineTo(f.x, y - .35 * f.s); c.stroke(); c.fillStyle = f.c; for (let i = 0; i < 5; i++) { const a = i * 1.256 + f.x; c.beginPath(); c.arc(f.x + Math.cos(a) * .07 * f.s, y - .35 * f.s + Math.sin(a) * .07 * f.s, .055 * f.s, 0, 7); c.fill(); } c.fillStyle = "#f2c94c"; c.beginPath(); c.arc(f.x, y - .35 * f.s, .04, 0, 7); c.fill(); }
  }
}
function grassStrip(c, x0, x1, fy) {
  if (x1 <= x0) return;
  c.beginPath(); c.moveTo(x0, fy(x0) + .32); for (let x = x0; x <= x1 + .01; x += .3) c.lineTo(x, fy(Math.min(x, x1)) + .32 + Math.sin(x * 5.1) * .06);
  for (let x = x1; x >= x0 - .01; x -= .3) c.lineTo(x, fy(Math.max(x, x0)) - .04); c.closePath();
  c.fillStyle = "#6fae4a"; c.fill();
  c.beginPath(); for (let x = x0; x <= x1; x += .3) { const y = fy(x); c.moveTo(x, y); c.lineTo(x, y - .08); } c.strokeStyle = "#9ad06a"; c.lineWidth = .3; c.stroke();
  c.fillStyle = "#b9e07f"; for (let x = Math.ceil(x0 * 3) / 3; x < x1; x += .33) { const y = fy(x), h = .22 + Math.abs(Math.sin(x * 12.7)) * .3, sw = Math.sin(G.t * 1.6 + x * .8) * .06; c.beginPath(); c.moveTo(x - .06, y); c.quadraticCurveTo(x + sw * .5, y - h * .6, x + sw, y - h); c.quadraticCurveTo(x + sw * .5 + .02, y - h * .5, x + .06, y); c.fill(); }
  c.fillStyle = "rgba(40,70,30,.25)"; c.beginPath(); c.moveTo(x0, fy(x0) + .32); for (let x = x0; x <= x1; x += .3) c.lineTo(x, fy(x) + .32 + Math.sin(x * 5.1) * .06); for (let x = x1; x >= x0; x -= .3) c.lineTo(x, fy(x) + .2); c.closePath(); c.fill();
}
function hangVines(c, x0, x1, y) { for (let x = Math.ceil(x0); x < x1; x += 1.3) { const L = .5 + Math.abs(Math.sin(x * 3.3)) * 1.2; c.strokeStyle = "#5f9a4a"; c.lineWidth = .06; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(G.t + x) * .12, y + L / 2, x, y + L); c.stroke(); } }
function drawPlats(c, t) {
  for (const q of S.L.plats) {
    if (q.gone) continue;
    const sh = q.kind === "crumble" && q.t >= 0 ? Math.sin(q.t * 70) * .05 : 0;
    c.save(); c.translate(sh, 0);
    if (q.kind === "nest") { // goal nest: woven twigs with a flag of blue cloth
      c.fillStyle = "#a0784c"; c.beginPath(); c.moveTo(q.x0, q.y); c.quadraticCurveTo((q.x0 + q.x1) / 2, q.y + 1, q.x1, q.y); c.closePath(); c.fill();
      c.strokeStyle = "#7a5634"; c.lineWidth = .07; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(q.x0 + i * .3, q.y + .1); c.quadraticCurveTo((q.x0 + q.x1) / 2, q.y + .7 - i * .05, q.x1 - i * .3, q.y + .1); c.stroke(); }
      c.fillStyle = "#cfe3a8"; c.fillRect(q.x0, q.y - .08, q.x1 - q.x0, .12);
      c.strokeStyle = "#6b4a2c"; c.lineWidth = .08; c.beginPath(); c.moveTo(q.x1 - .4, q.y); c.lineTo(q.x1 - .4, q.y - 2); c.stroke();
      c.fillStyle = COL.tip; c.beginPath(); c.moveTo(q.x1 - .4, q.y - 2); c.quadraticCurveTo(q.x1 + .3, q.y - 1.85 + Math.sin(t * 3) * .1, q.x1 + .5, q.y - 1.6); c.lineTo(q.x1 - .4, q.y - 1.3); c.fill();
    } else if (q.kind === "ledge") { c.fillStyle = "#a99577"; c.fillRect(q.x0, q.y, q.x1 - q.x0, .7); grassStrip(c, q.x0, q.x1, () => q.y); }
    else {
      c.fillStyle = q.kind === "crumble" ? "#b98c5a" : "#a57a4a"; c.strokeStyle = "#6a4a2a"; c.lineWidth = .05;
      const n = Math.round((q.x1 - q.x0) / .55); for (let i = 0; i < n; i++) { const x = q.x0 + i * (q.x1 - q.x0) / n; c.beginPath(); c.rect(x + .02, q.y + (i % 2) * .02, (q.x1 - q.x0) / n - .04, .26); c.fill(); c.stroke(); }
      if (q.kind === "crumble") { c.strokeStyle = "rgba(60,40,20,.6)"; c.beginPath(); c.moveTo(q.x0 + .8, q.y); c.lineTo(q.x0 + 1, q.y + .26); c.moveTo(q.x1 - 1.1, q.y); c.lineTo(q.x1 - .9, q.y + .14); c.stroke(); }
      c.fillStyle = "#86c06a"; c.fillRect(q.x0, q.y - .03, q.x1 - q.x0, .06);
      c.strokeStyle = "#7c6a4c"; c.lineWidth = .04; c.beginPath(); c.moveTo(q.x0 + .2, q.y + .26); c.lineTo(q.x0 + .2, q.y + .7); c.moveTo(q.x1 - .2, q.y + .26); c.lineTo(q.x1 - .2, q.y + .7); c.stroke();
    }
    c.restore();
  }
  for (const [x, y, L] of S.L.vines) { c.strokeStyle = "#4f8a3c"; c.lineWidth = .07; c.beginPath(); c.moveTo(x, y + .2); for (let k = 0; k <= 10; k++) c.lineTo(x + Math.sin(k * .9 + t * 1.2) * .1, y + .2 + L * k / 10); c.stroke(); c.fillStyle = "#86c06a"; for (let k = 1; k <= 10; k += 1.5) { c.beginPath(); c.ellipse(x + Math.sin(k * .9 + t * 1.2) * .1 + .1, y + .2 + L * k / 10, .12, .06, .5, 0, 7); c.fill(); } }
}
function drawAir(c, t, cam, z) {
  const L = S.L;
  for (const u of L.updrafts) { if (u[3] < cam.y - 8 || u[1] > cam.y + 8) continue;
    const g = c.createLinearGradient(u[0], 0, u[2], 0); g.addColorStop(0, "rgba(220,245,255,0)"); g.addColorStop(.5, "rgba(220,245,255,.16)"); g.addColorStop(1, "rgba(220,245,255,0)"); c.fillStyle = g; c.fillRect(u[0], u[1], u[2] - u[0], u[3] - u[1]);
    c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = .05; c.lineCap = "round";
    for (let i = 0; i < 14; i++) { const x = u[0] + .5 + (i * 2.71 % (u[2] - u[0] - 1)), y = u[3] - ((t * 4 + i * 3.3) % (u[3] - u[1])); if (Math.abs(y - cam.y) > 7) continue; c.beginPath(); c.moveTo(x + Math.sin(y + t) * .2, y); c.quadraticCurveTo(x + Math.sin(y + t + 1) * .3, y - .5, x, y - 1.1); c.stroke(); }
    c.fillStyle = "#a8d68a"; for (let i = 0; i < 5; i++) { const y = u[3] - ((t * 3 + i * 5.1) % (u[3] - u[1])), x = (u[0] + u[2]) / 2 + Math.sin(t * 1.3 + i * 2) * 2.2; c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.beginPath(); c.ellipse(0, 0, .14, .06, 0, 0, 7); c.fill(); c.restore(); } }
  for (const w of L.winds) { const r = w.r; if (Math.abs((r[1] + r[3]) / 2 - cam.y) > 9) continue; c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = .05;
    for (let i = 0; i < 9; i++) { const len = r[2] - r[0], x = w.vx > 0 ? r[0] + ((t * 6 + i * 1.7) % len) : r[2] - ((t * 6 + i * 1.7) % len), y = r[1] + .4 + (i * .73 % (r[3] - r[1] - .8)); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - Math.sign(w.vx) * .5, y - .1, x - Math.sign(w.vx) * 1.1, y + Math.sin(t * 3 + i) * .1); c.stroke(); } }
  // switch flower + vine gate
  const sw = L.sw, sy = F(sw.x); c.fillStyle = "#9a8a72"; c.beginPath(); c.ellipse(sw.x, sy + .05, .7, .22, 0, 0, 7); c.fill(); c.strokeStyle = "#4f8a3c"; c.lineWidth = .07; c.beginPath(); c.moveTo(sw.x, sy); c.lineTo(sw.x, sy - (sw.on ? .55 : .8)); c.stroke();
  const fy = sy - (sw.on ? .6 : .85); c.fillStyle = sw.on ? "#bfe8ff" : "#7fb0d8"; for (let i = 0; i < 6; i++) { const a = i * 1.047 + (sw.on ? t : 0); c.beginPath(); c.ellipse(sw.x + Math.cos(a) * .17, fy + Math.sin(a) * .12, .13, .08, a, 0, 7); c.fill(); } c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(sw.x, fy, .08, 0, 7); c.fill();
  if (!sw.on) { c.fillStyle = `rgba(190,230,255,${.25 + Math.sin(t * 3) * .15})`; c.beginPath(); c.arc(sw.x, fy, .55, 0, 7); c.fill(); }
  if (L.door.open < 1) { const o = L.door.open, d = DOOR; c.save(); c.beginPath(); c.rect(d[0] - .3, Gc(43) - .2, 1.6, F(43) - Gc(43) + .2); c.clip(); c.translate(0, -o * 9);
    c.fillStyle = "#7a5634"; c.fillRect(d[0], d[1], d[2] - d[0], d[3] - d[1]); c.strokeStyle = "#4f8a3c"; c.lineWidth = .1; for (let y = d[1]; y < d[3]; y += .6) { c.beginPath(); c.moveTo(d[0] - .1, y); c.quadraticCurveTo(43, y + .3, d[2] + .1, y); c.stroke(); }
    c.fillStyle = "#7fb0d8"; c.beginPath(); c.arc(43, (d[1] + d[3]) / 2 + 1.5, .2, 0, 7); c.fill(); c.restore(); }
}
// parallax sky / BotW-ish layered backdrop
function drawSky(cam, t) {
  const depth = clamp((cam.y - 30) / 20, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, depth > .5 ? "#7fbde0" : "#86c8ec"); g.addColorStop(.62, "#d6eef0"); g.addColorStop(1, "#f3f0dc"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sg = ctx.createRadialGradient(W * .78, H * .12, 0, W * .78, H * .12, H * .9); sg.addColorStop(0, "rgba(255,250,225,.9)"); sg.addColorStop(.25, "rgba(255,246,210,.35)"); sg.addColorStop(1, "rgba(255,246,210,0)"); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  const layer = (k, base, amp, freq, col, snow, seed) => {
    const off = cam.x * Z * k, yb = H * base - (cam.y - 25) * Z * k * .35;
    ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 8; x += 8) { const u = (x + off) * freq; const y = yb - amp * (Math.sin(u + seed) * .5 + Math.sin(u * 2.3 + seed * 2) * .25 + Math.sin(u * .41 + seed) * .6); ctx.lineTo(x, y); } ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    if (snow) { ctx.save(); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(0, 0, W, yb - amp * .6); ctx.restore(); }
  };
  ctx.fillStyle = "rgba(255,255,255,.75)"; for (let i = 0; i < 6; i++) { const x = ((i * 260 - cam.x * Z * .03 + t * 6) % (W + 300) + W + 300) % (W + 300) - 150, y = H * (.12 + (i % 3) * .08) - (cam.y - 25) * Z * .01; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * 30, y + Math.sin(k) * 6, 40, 16, 0, 0, 7); ctx.fill(); } }
  layer(.04, .55, 70, .004, "#a9c5d8", true, 1);
  layer(.09, .68, 50, .007, "#97bcc4", false, 3);
  layer(.18, .8, 40, .011, "#86b48e", false, 5);
  // tree line
  const off = cam.x * Z * .3, yb = H * .9 - (cam.y - 25) * Z * .1; ctx.fillStyle = "#5f9467";
  for (let i = -2; i < W / 34 + 3; i++) { const x = i * 34 - (off % 34), s = 18 + Math.abs(Math.sin((i + Math.floor(off / 34)) * 2.1)) * 18; ctx.beginPath(); ctx.ellipse(x, yb - s, s * .55, s, 0, 0, 7); ctx.fill(); }
  ctx.fillRect(0, yb - 4, W, H);
  // god rays
  ctx.save(); ctx.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const x = W * (.55 + i * .12) + Math.sin(t * .2 + i) * 20; ctx.fillStyle = "rgba(255,248,220,.045)"; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x - 140, H); ctx.lineTo(x - 260, H); ctx.fill(); } ctx.restore();
  if (depth > 0) { ctx.fillStyle = `rgba(60,110,120,${depth * .18})`; ctx.fillRect(0, 0, W, H); }
}
function drawTrail(c, alpha, upto, width, glow) {
  const T = glow && S.trailS ? S.trailS : S.trail, n = upto == null ? T.length : Math.floor(upto); if (n < 2) return;
  c.lineCap = "round"; c.lineJoin = "round";
  if (glow) { c.strokeStyle = `rgba(158,215,255,${alpha * .35})`; c.lineWidth = width * 3.2; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(T[i].x, T[i].y) : c.moveTo(T[i].x, T[i].y); c.stroke(); }
  c.strokeStyle = glow ? `rgba(240,250,255,${alpha})` : `rgba(255,255,255,${alpha})`; c.lineWidth = width; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(T[i].x, T[i].y) : c.moveTo(T[i].x, T[i].y); c.stroke();
}
function renderWorld(cam, z, opt) {
  opt = opt || {};
  drawSky(cam, G.t);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
  const t = G.t;
  drawAir(ctx, t, cam, z);
  drawTerrain(ctx, cam, z);
  drawPlats(ctx, t);
  for (const m of S.L.shrooms) drawShroom(ctx, m, t);
  if (opt.trail !== false) { // dim, short-lived footprint trail during play
    const T = S.trail, n = T.length; ctx.lineCap = "round"; ctx.lineWidth = .09;
    for (let i = Math.max(1, n - 90); i < n; i++) { const a = (1 - (n - i) / 90) * .22; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(T[i - 1].x, T[i - 1].y + .2); ctx.lineTo(T[i].x, T[i].y + .2); ctx.stroke(); }
  }
  if (opt.reveal) opt.reveal(ctx);
  for (const w of S.L.wisps) if (!w.got) drawWisp(ctx, w, t);
  drawBat(ctx, S.L.bat, t);
  for (const f of S.puffs) { const a = 1 - f.t / .5; ctx.fillStyle = `rgba(255,255,255,${a * .8})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (1 + f.t * 2), 0, 7); ctx.fill(); }
  if (opt.hero !== false) {
    const p = S.p; ctx.fillStyle = "rgba(40,60,40,.2)"; if (p.ground) { ctx.beginPath(); ctx.ellipse(p.x, p.y + PH.r, .38, .08, 0, 0, 7); ctx.fill(); }
    if (S.ab.glide > 0 || S.ab.hop > 0) { const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 1.1); gg.addColorStop(0, S.ab.glide > 0 ? "rgba(250,255,210,.35)" : "rgba(190,225,255,.35)"); gg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, 7); ctx.fill(); }
    if (p.hurt > 0 && Math.floor(p.hurt * 14) % 2) ctx.globalAlpha = .55;
    drawTuan(ctx, p, t); ctx.globalAlpha = 1;
  }
  for (const f of S.fx) {
    if (f.k === "dust") { const a = 1 - f.t / .6; ctx.fillStyle = `rgba(245,240,225,${a * .7})`; ctx.beginPath(); ctx.arc(f.x, f.y, .08 + f.t * .25, 0, 7); ctx.fill(); }
    else if (f.k === "spark") { const a = 1 - f.t / .6; ctx.fillStyle = `rgba(230,250,255,${a})`; ctx.beginPath(); ctx.arc(f.x, f.y, .07, 0, 7); ctx.fill(); }
    else if (f.k === "fluff") { const a = 1 - f.t / 1.2; ctx.strokeStyle = `rgba(255,255,255,${a * .8})`; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(f.x - .07, f.y); ctx.lineTo(f.x + .07, f.y); ctx.moveTo(f.x, f.y - .07); ctx.lineTo(f.x, f.y + .07); ctx.stroke(); }
    else if (f.k === "chip") { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r + f.t * 6); ctx.fillStyle = "#b98c5a"; ctx.fillRect(-.2, -.08, .4, .16); ctx.restore(); }
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // vignette + motes
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(20,40,40,.28)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,235,.6)"; for (let i = 0; i < 18; i++) { const x = ((i * 97.3 + t * 9 - cam.x * z * .6) % W + W) % W, y = ((i * 53.1 + Math.sin(t * .5 + i) * 20 - cam.y * z * .6) % H + H) % H; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .5, 0, 7); ctx.fill(); }
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const x = SAL + 18, y = 26; ctx.fillStyle = "rgba(255,252,244,.82)"; roundRect(x - 6, y - 16, 96, 32, 16); ctx.fill();
  const g = ctx.createRadialGradient(x + 12, y, 0, x + 12, y, 12); g.addColorStop(0, "#fff"); g.addColorStop(.4, "rgba(160,215,245,.8)"); g.addColorStop(1, "rgba(160,215,245,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 12, y, 12, 0, 7); ctx.fill();
  ctx.fillStyle = "#4e5a66"; ctx.font = "700 15px sans-serif"; ctx.textBaseline = "middle"; ctx.fillText(S.got + " / " + S.L.wisps.length, x + 30, y + 1);
  let ax = x + 100; for (const [k, lab, col] of [["glide", "蒲公英", "#e8f59a"], ["hop", "风铃草", "#bfe0ff"]]) if (S.ab[k] > 0) { ctx.fillStyle = "rgba(255,252,244,.82)"; roundRect(ax, y - 16, 92, 32, 16); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax + 16, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#4e5a66"; ctx.font = "600 12px sans-serif"; ctx.fillText(lab + " " + Math.ceil(S.ab[k]) + "s", ax + 30, y + 1); ax += 98; }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawControls() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); btnPos();
  const bx = stick.active ? stick.bx : SAL + 40 + STICK_R, by = stick.active ? stick.by : H - 40 - STICK_R;
  ctx.globalAlpha = stick.active ? .9 : .38;
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.stroke();
  if (stick.active && stick.mag > 0) { const a = Math.atan2(stick.y, stick.x); ctx.strokeStyle = "rgba(200,235,255,.95)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by, STICK_R - 3, a - .5, a + .5); ctx.stroke(); }
  const kx = stick.active ? stick.kx : bx, ky = stick.active ? stick.ky : by;
  ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(kx, ky, 24, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(158,195,234,.6)"; ctx.beginPath(); ctx.arc(kx, ky, 12, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  for (const b of BTN) {
    ctx.globalAlpha = b.down ? 1 : .75; ctx.fillStyle = b.down ? "rgba(220,240,255,.95)" : "rgba(255,255,255,.55)"; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (b.down ? .93 : 1), 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4e6a86"; ctx.font = `800 ${b.k === "jump" ? 17 : 14}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.k === "jump" ? (S.p.glide ? "滑翔" : "跳") : "风", b.x, b.y + 1); ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}

// ---------- reveal ----------
let R = null;
function startReveal() {
  G.mode = "reveal"; $("hint").classList.remove("show");
  const T = S.trail; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of T) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const zf = Math.min(W * .7 / (x1 - x0), H * .6 / (y1 - y0));
  R = { head: T.length - 1, t: 0, bbox: [x0, y0, x1, y1], zf, cam: { x: S.cam.x, y: S.cam.y }, z: Z, rewind: 2.4, sp: [] };
  S.trailS = T.map((q, i) => { let x = 0, y = 0, n = 0; for (let k = Math.max(0, i - 6); k <= Math.min(T.length - 1, i + 6); k++) { x += T[k].x; y += T[k].y; n++; } return { x: x / n, y: y / n }; });
  AU.rewind(2.2); S.p.happy = 1;
}
function updateReveal(dt) {
  if (!R) return; R.t += dt; G.t += dt; const T = S.trail, n = T.length;
  const t = R.t, tr = R.rewind;
  if (t < tr) { const k = ease(t / tr), i = Math.floor((1 - k) * (n - 1)); R.head = i; R.cam.x = lerp(R.cam.x, T[i].x, .2); R.cam.y = lerp(R.cam.y, T[i].y, .2); R.z = Z * lerp(1, .55, k); }
  else if (t < tr + 1.8) { const k = ease((t - tr) / 1.8), b = R.bbox; R.head = 0; if (!R.ws) { R.ws = 1; AU.whoosh(); }
    R.cam.x = lerp(T[0].x, (b[0] + b[2]) / 2, k); R.cam.y = lerp(T[0].y, (b[1] + b[3]) / 2 + (b[3] - b[1]) * .2, k); R.z = lerp(Z * .55, R.zf, k); }
  else if (!R.lit) { R.lit = 1; AU.reveal(); }
  if (R.lit) { R.draw = Math.min(n, (R.draw || 0) + n * dt / 1.6); if (Math.random() < dt * 30 && n) { const q = T[(Math.random() * Math.min(n, R.draw)) | 0]; R.sp.push({ x: q.x, y: q.y, t: 0 }); } }
  for (let i = R.sp.length - 1; i >= 0; i--) { R.sp[i].t += dt; R.sp[i].y -= dt * .8; if (R.sp[i].t > 1.2) R.sp.splice(i, 1); }
  if (R.lit && R.draw >= n && !R.msg) { R.msg = 1; showWord(); }
}
function renderReveal() {
  const z = R.z, T = S.trail;
  renderWorld(R.cam, z, { trail: false, hero: R.t < R.rewind + .3, reveal: c => {
    if (R.t < R.rewind) { drawTrail(c, .35, null, .12, false); const i = R.head; c.fillStyle = "#fff"; c.beginPath(); c.arc(T[i].x, T[i].y, .3, 0, 7); c.fill(); }
    else if (!R.lit) drawTrail(c, .35, null, .14 / (z / Z), false);
    else { c.fillStyle = `rgba(20,40,60,${Math.min(.45, (R.t - R.rewind - 1.8) * .3)})`; c.fillRect(-50, -60, 200, 200); drawTrail(c, .25, null, .14 / (z / Z), false); drawTrail(c, 1, R.draw, 7 / z, true); for (const s of R.sp) { const a = Math.sin(s.t / 1.2 * Math.PI); c.fillStyle = `rgba(230,248,255,${a})`; c.beginPath(); c.arc(s.x, s.y, .18 * a + .05, 0, 7); c.fill(); } }
  } });
  // the hero now waits at the goal and looks happy; draw her small on top during the zoom-out
  if (R.t >= R.rewind + .3) { const p = S.p, s = { ...p, x: GOAL.x, y: GOAL.y - PH.r, ground: 1, gn: { x: 0, y: -1 }, happy: 1, ear: Math.sin(G.t * 3) * .3 + .3, face: -1, sq: 1 + Math.sin(G.t * 5) * .04 };
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - R.cam.x * z), DPR * (H / 2 - R.cam.y * z)); drawTuan(ctx, s, G.t, Math.max(1, 2.2 * Z / z * .45)); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
}
function showWord() {
  G.mode = "word"; $("word").classList.add("show");
  $("msg").innerHTML = '<span class="big">I <span class="hrt">❤</span> U</span>' + (G.msg ? "<br>" + G.msg.replace(/[<>&]/g, "") : "");
  $("from").textContent = G.fromShare ? "团绒跑过的路，悄悄写成了这个字母" : "你刚刚跑过的路，就是这个 U";
  setTimeout(() => $("wordBtns").classList.add("show"), 1200);
}

// ---------- flow ----------
function startPlay() { S = newState(); G.mode = "play"; G.t = 0; R = null; $("word").classList.remove("show"); $("wordBtns").classList.remove("show"); }
function parseHash() { const m = location.hash.match(/c=([A-Za-z0-9_-]+)/); if (m) { const d = decodeShare(m[1]); if (d) { G.word = d.word; G.msg = d.msg; G.fromShare = true; } } }
function goLandscape() { if (!COARSE) return; try { const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen; const lock = () => { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }; if (rq && !document.fullscreenElement) { const r = rq.call(el, { navigationUI: "hide" }); if (r && r.then) r.then(lock, () => {}); else lock(); } else lock(); } catch (e) {} }
$("startBtn").addEventListener("click", () => { AU.init(); goLandscape(); $("start").classList.remove("show"); startPlay(); });
$("replayBtn").addEventListener("click", () => { $("word").classList.remove("show"); $("wordBtns").classList.remove("show"); startReveal(); });
$("againBtn").addEventListener("click", () => startPlay());
$("makeBtn").addEventListener("click", () => { G.mode = "custom"; $("word").classList.remove("show"); $("custom").classList.add("show"); $("linkBox").style.display = "none"; });
$("mIn").addEventListener("input", () => { $("mCnt").textContent = [...$("mIn").value].length; $("linkBox").style.display = "none"; });
$("genBtn").addEventListener("click", () => { const m = $("mIn").value.trim().slice(0, 40); $("link").value = location.origin + location.pathname + "#c=" + encodeShare("I♥U", m); $("linkBox").style.display = "block"; AU.init(); AU.softDing(); });
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 1600); }
$("copyBtn").addEventListener("click", async () => { const l = $("link").value; let ok = false; try { await navigator.clipboard.writeText(l); ok = true; } catch (e) {} if (!ok) { const el = $("link"); el.removeAttribute("readonly"); el.select(); try { ok = document.execCommand("copy"); } catch (e) {} el.setAttribute("readonly", ""); } toast(ok ? "已复制，发给 TA 吧" : "请长按链接手动复制"); });
$("tryBtn").addEventListener("click", () => { const l = $("link").value; if (l) location.hash = l.split("#")[1]; });
$("backBtn").addEventListener("click", () => { $("custom").classList.remove("show"); G.mode = "word"; $("word").classList.add("show"); });
addEventListener("hashchange", () => location.reload());
function syncMute() { $("muteBtn").classList.toggle("off", AU.muted); }
$("muteBtn").addEventListener("click", e => { e.stopPropagation(); AU.init(); AU.setMuted(!AU.muted); syncMute(); });
AU.muted = localStorage.getItem("rxm_mute") === "1"; syncMute();

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  try {
    if (G.mode === "play") { for (let k = 0; k < (G.steps || 1); k++) { G.t += dt; updatePlay(dt); if (G.mode !== "play") break; } }
    else if (G.mode === "reveal") updateReveal(dt);
    else if (G.mode === "word" || G.mode === "custom") { G.t += dt; if (R) { R.sp.length < 40 && Math.random() < dt * 20 && R.sp.push({ ...S.trail[(Math.random() * S.trail.length) | 0], t: 0 }); for (let i = R.sp.length - 1; i >= 0; i--) { R.sp[i].t += dt; if (R.sp[i].t > 1.2) R.sp.splice(i, 1); } } }
    else { G.t += dt; }
    if (G.mode === "play") { renderWorld(S.cam, Z); drawHUD(); drawControls(); }
    else if (R) renderReveal();
    else { // title: idle 团绒 on the start ledge
      S.p.blink -= dt; if (S.p.blink < -.12) S.p.blink = 2 + Math.random() * 2; S.p.ear = Math.sin(G.t * 1.3) * .08;
      renderWorld({ x: START.x + 3.2, y: START.y + .6 }, Z * 1.15);
    }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
// ---------- bot (tests / attract) ----------
function botStep() {
  if (!S || G.mode !== "play") return null;
  const p = S.p, L = S.L, b = G.bot || (G.bot = { x: 0, y: 0, j: false });
  let tx = null, j = false;
  if (p.x < 16 && p.y < 39) { // descend the left shaft, touching the planks on the way
    const q = p.ground && p.ground.kind;
    if (q && p.ground.y === 9) tx = 9.4; else if (q === "crumble") tx = 10.4; else if (q && p.ground.y === 28) tx = 14.2;
    else tx = p.y < 8.9 ? 12 : p.y < 14.9 ? 10.4 : p.y < 27.9 ? 11.4 : 11.6;
    j = !p.ground && p.vy > 0 && p.y > 35; // glide down the last part
  } else if (p.x < 46.3) {
    tx = L.sw.on ? 60 : L.sw.x; const B = L.bat; if (B.stun <= 0 && B.x - p.x < 3.2 && B.x > p.x - .5 && !b.cool) { b.aq = 1; b.cool = .4; }
  } else {
    if (p.y > 21.4) { tx = 49.8; j = !p.ground && p.y < 41; }
    else if (p.y > 16) { tx = 52.6; j = false; }
    else { tx = 49.6; j = true; }
  }
  if (b.cool) b.cool = Math.max(0, b.cool - 1 / 60);
  const dx = tx - p.x; b.x = Math.abs(dx) < .15 ? 0 : clamp(dx * 1.4, -1, 1); b.j = j; if (j && !b.prevJ) b.jq = 1; b.prevJ = j;
  const out = { x: b.x, j: b.j, jq: b.jq, aq: b.aq }; if (!G.botDrive) b.jq = b.aq = 0; return out;
}
window.__game = {
  G, get S() { return S; }, get R() { return R; }, W: () => W, H: () => H, get stick() { return stick; }, BTN,
  btnPos() { btnPos(); return BTN.map(b => ({ k: b.k, x: b.x, y: b.y, r: b.r })); }, toClient(x, y) { return ROT ? { x: H - y, y: x } : { x, y }; }, get rot() { return ROT; },
  start() { $("startBtn").click(); }, botStep, botOn(v) { G.botDrive = !!v; G.bot = { x: 0, y: 0, j: false }; }, encodeShare, decodeShare,
  set steps(v) { G.steps = v; }, sdf, F,
};
addEventListener("resize", resize); resize();
parseHash(); S = newState();
if (G.fromShare) { $("startSub").textContent = "有人给你做了一个小关卡"; $("startSub2").textContent = G.msg ? "跑到终点，TA 有一句话要对你说" : "跑到终点有个小惊喜"; }
$("start").classList.add("show");
requestAnimationFrame(frame);
})();
