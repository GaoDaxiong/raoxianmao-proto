// 团绒 v6 — app shell: forced landscape, Genshin-style floating joystick, Jump + ability Action buttons, hints, zone banners, rewind → zoom → "I ❤ U" reveal.
(() => {
"use strict";
const TR = window.TR;
const cv = document.getElementById("cv"), ctx = cv.getContext("2d", { alpha: false });
const $ = id => document.getElementById(id), stage = $("stage");
let W = 844, H = 390, DPR = 1, Z = 57, ROT = false, SAL = 0, SAR = 0;
const COARSE = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const iw = innerWidth, ih = innerHeight; ROT = ih > iw && COARSE;
  W = ROT ? ih : iw; H = ROT ? iw : ih;
  stage.style.width = W + "px"; stage.style.height = H + "px";
  stage.style.transform = ROT ? "rotate(90deg) translateY(-100%)" : "none";
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  Z = H / 6.8; // 团绒 ≈ 52px tall on a 390px-high phone (v5: 37px)
  const cs = getComputedStyle(document.documentElement), px = v => parseInt(cs.getPropertyValue(v)) || 0;
  SAL = ROT ? px("--sat") : px("--sal"); SAR = ROT ? px("--sab") : px("--sar");
  stick.id = null; stick.active = false; stick.x = stick.y = stick.mag = 0; for (const b of BTN) { b.id = null; b.down = false; }
}
const toStage = (cx, cy) => ROT ? { x: cy, y: H - cx } : { x: cx, y: cy };
// ---------- share (same #c= format as v1-v5) ----------
const KEY = [121, 97, 114, 110, 99, 97, 116];
function encodeShare(word, msg) { const b = new TextEncoder().encode(word + "\n" + msg); let s = ""; b.forEach((v, i) => s += String.fromCharCode(v ^ KEY[i % KEY.length])); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function decodeShare(c) { try { let s = c.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ KEY[i % KEY.length]; const t = new TextDecoder().decode(b), k = t.indexOf("\n"); return { word: (k >= 0 ? t.slice(0, k) : t).slice(0, 8), msg: (k >= 0 ? t.slice(k + 1) : "").slice(0, 60) }; } catch (e) { return null; } }
// ---------- input ----------
const STICK_R = 58, DEAD = .12;
const stick = { id: null, active: false, bx: 0, by: 0, kx: 0, ky: 0, x: 0, y: 0, mag: 0 };
const BTN = [{ k: "jump", id: null, down: false, q: 0, r: 42 }, { k: "act", id: null, down: false, q: 0, r: 34 }];
function btnPos() { const j = BTN[0], a = BTN[1]; j.x = W - SAR - 76; j.y = H - 78; a.x = j.x - 96; a.y = H - 52; return BTN; }
const keys = {};
function setKnob(x, y) { const dx = x - stick.bx, dy = y - stick.by, d = hyp(dx, dy), cl = Math.min(d, STICK_R); stick.kx = stick.bx + (d ? dx / d * cl : 0); stick.ky = stick.by + (d ? dy / d * cl : 0); const m = clamp((d / STICK_R - DEAD) / (1 - DEAD), 0, 1); stick.mag = m; stick.x = d ? dx / d * m : 0; stick.y = d ? dy / d * m : 0; }
function onDown(e) {
  AU.init(); const p = toStage(e.clientX, e.clientY);
  if (G.mode === "play") { btnPos();
    if (stick.id == null && p.x < W * .45) { stick.id = e.pointerId; stick.active = true; stick.bx = clamp(p.x, SAL + STICK_R + 6, W * .45); stick.by = clamp(p.y, STICK_R + 6, H - STICK_R - 6); setKnob(p.x, p.y); }
    else if (p.x >= W * .45) { const [j, a] = BTN, b = hyp(p.x - a.x, p.y - a.y) < a.r * 1.7 && hyp(p.x - a.x, p.y - a.y) < hyp(p.x - j.x, p.y - j.y) ? a : j;
      if (b.id == null) { b.id = e.pointerId; b.down = true; b.q = 1; if (navigator.vibrate) try { navigator.vibrate(6); } catch (_) {} } } }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
}
function onMove(e) { if (e.pointerId === stick.id) { const p = toStage(e.clientX, e.clientY); setKnob(p.x, p.y); } e.preventDefault(); }
function onUp(e) { if (e.pointerId === stick.id) { stick.id = null; stick.active = false; stick.mag = stick.x = stick.y = 0; } for (const b of BTN) if (e.pointerId === b.id) { b.id = null; b.down = false; } }
cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
document.addEventListener("touchmove", e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
const JK = ["z", "k", " ", "w", "ArrowUp"], AK = ["x", "j", "Shift"];
addEventListener("keydown", e => { AU.init(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (!e.repeat) { if (JK.includes(k)) BTN[0].q = 1; if (AK.includes(k)) BTN[1].q = 1; } keys[k] = true; if (k.startsWith("Arrow") || k === " ") e.preventDefault(); });
addEventListener("keyup", e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
function readInput() {
  if (G.botDrive) { const b = TR.botStep(S) || { x: 0 }; return { x: b.x || 0, y: b.y || 0, jd: !!b.j, jq: !!b.jq, aq: !!b.aq }; }
  let x = stick.x, y = stick.y;
  if (keys.ArrowLeft || keys.a) x = -1; if (keys.ArrowRight || keys.d) x = 1; if (keys.ArrowDown || keys.s) y = 1;
  const inp = { x, y, jd: BTN[0].down || JK.some(k => keys[k]), jq: !!BTN[0].q, aq: !!BTN[1].q }; BTN[0].q = BTN[1].q = 0; return inp;
}
// ---------- state / events ----------
const G = { mode: "start", t: 0, msg: "", word: "I♥U", fromShare: false, botDrive: false, steps: 1, banner: null, playT: 0 };
let S = null, cam = { x: 0, y: 0 };
function hint(text, dur) { if (!text) { $("hint").classList.remove("show"); return; } $("hintText").textContent = text; $("hint").classList.add("show"); clearTimeout(hint._t); hint._t = setTimeout(() => $("hint").classList.remove("show"), dur || 3000); }
TR.on = (ev, a, b) => {
  if (ev === "hint") hint(a, b);
  else if (ev === "zone") { G.banner = { z: a, t: 0 }; AU.clear && AU.clear(); }
  else if (ev === "ability") { const A = TR.ABIL[a]; G.abFlash = { ab: a, t: 0 }; }
  else if (ev === "goal") { G.goalT = 0; }
};
const AUmap = {
  jump: () => AU.tone(520, .12, { type: "triangle", vol: .07, slide: 1.6 }), spring: n => AU.tone(380 + (n || 0) * 120, .2, { type: "triangle", vol: .09, slide: 2.2 }),
  land: () => AU.noise(.08, { freq: 900, q: 1, vol: .05 }), hurt: () => AU.tone(330, .2, { type: "triangle", vol: .08, slide: .6 }), puff: () => AU.noise(.25, { freq: 1400, q: .8, vol: .07, slide: .4 }),
  drill: () => { AU.noise(.5, { freq: 500, q: 2, vol: .08, slide: .5 }); AU.tone(160, .4, { type: "sawtooth", vol: .03, slide: .6 }); }, thud: () => AU.noise(.12, { freq: 300, q: 1, vol: .08, brown: true }),
  flare: () => { AU.bell(2093, .05, 0, 0, .5); AU.noise(.3, { freq: 3000, q: .7, vol: .04 }); }, shatter: () => { AU.noise(.3, { freq: 4200, q: 2, vol: .08 }); AU.bell(2637, .04, 0, .02, .4); },
  dash: () => AU.noise(.22, { freq: 900, q: .7, vol: .08, slide: 2.5 }), slam: () => AU.tone(500, .2, { type: "triangle", vol: .06, slide: .4 }), boing: () => AU.boing(),
  ring: () => { AU.bell(1319, .09, 0, 0, 1.2); AU.bell(1760, .06, 0, .06, 1); }, windbell: () => AU.clear(), whoosh: () => AU.whoosh(), bosspop: () => { AU.pop(); AU.reveal(); },
  wisp: n => AU.bell(1568 + ((n || 0) % 5) * 120, .045, 0, 0, .7, .4), ability: () => AU.clear(), gem: () => AU.reveal(), stone: n => AU.bell(784 * Math.pow(1.26, n || 0), .08, 0, 0, .9), wrong: () => AU.tone(220, .3, { type: "triangle", vol: .07, slide: .7 }),
  gate: () => { AU.clunk(); AU.knot(); }, flip: () => AU.creak && AU.creak(0, .6), glint: () => AU.softDing(), geyser: () => AU.noise(1.3, { freq: 700, q: .5, vol: .06, slide: 1.8, attack: .1 }), bud: () => AU.ding(),
  clunk: () => AU.clunk(), clack: () => AU.noise(.05, { freq: 2000, q: 2, vol: .04 }), bonk: () => AU.tone(150, .3, { type: "square", vol: .05, slide: .6 }), crack: () => AU.noise(.15, { freq: 5000, q: 3, vol: .03 }),
  sneeze: () => { AU.tone(600, .1, { vol: .05, slide: .5 }); AU.noise(.3, { freq: 2200, q: .6, vol: .07 }); }, caw: () => AU.tone(700, .12, { type: "sawtooth", vol: .03, slide: .7 }),
  sneak: () => AU.tone(900, .08, { vol: .04, slide: 1.3 }), steal: () => AU.tone(1200, .15, { vol: .05, slide: .5 }), jumpsmall: () => AU.tone(800, .08, { vol: .04, slide: 1.4 }), fogpuff: () => AU.noise(.4, { freq: 400, q: .6, vol: .04 }), goal: () => AU.clear(),
};
TR.sfx = (n, a) => { if (G.silent) return; const f = AUmap[n]; if (f) try { f(a); } catch (e) {} };
// ---------- play loop ----------
function updatePlay(dt) {
  const inp = readInput(), p = S.p;
  TR.update(dt, inp); G.playT += dt;
  // character anim
  const sp = p.ground ? Math.abs(p.gs) : 0; p.walk += sp * dt * 2.2;
  p.sqv += (-(p.sq - 1) * 160 - p.sqv * 12) * dt; p.sq += p.sqv * dt * 6; p.sq = clamp(p.sq, .65, 1.4); if (!p.ground) p.sq = lerp(p.sq, 1 + clamp(-p.vy * .012, -.12, .12), .1);
  const earT = p.glide ? (S.ab === "umb" ? 1.2 : 1) : 0; p.earV += ((earT - p.ear) * 90 - p.earV * 11) * dt; p.ear += p.earV * dt;
  p.blink -= dt; if (p.blink < -.12) p.blink = 1.5 + Math.random() * 3; p.puffT -= dt;
  if (p.ground && sp > 5 && Math.random() < dt * 8) TR.fx("dust", p.x - p.face * .2, p.y + .45, 1);
  if (!S.hints.ctl && S.t > .5) { S.hints.ctl = 1; hint(COARSE ? "左手摇杆走 · 右手「跳」（按住滑翔）· 小按钮用耳朵的本领" : "方向键走 · Z/空格 跳（按住滑翔）· X 用耳朵的本领", 4200); }
  // camera: close follow + look-ahead keeps the letter hidden
  const lx = clamp(p.vx * .2, -2, 2), ly = clamp(p.vy * .14, -1.2, 1.8), k = 1 - Math.exp(-dt * (p.inCart ? 5 : 7));
  cam.x = lerp(cam.x, p.x + lx, k); cam.y = lerp(cam.y, p.y + ly - .4, k);
  if (G.banner) G.banner.t += dt; if (G.abFlash) G.abFlash.t += dt;
  if (S.done) { G.goalT = (G.goalT || 0) + dt; p.happy = 1; if (G.goalT > 1.2) startReveal(); }
}
// ---------- HUD + controls ----------
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); const x = SAL + 18, y = 26;
  ctx.fillStyle = "rgba(255,252,244,.84)"; roundRect(x - 6, y - 16, 104, 32, 16); ctx.fill();
  const g = ctx.createRadialGradient(x + 12, y, 0, x + 12, y, 12); g.addColorStop(0, "#fff"); g.addColorStop(.4, "rgba(160,215,245,.8)"); g.addColorStop(1, "rgba(160,215,245,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 12, y, 12, 0, 7); ctx.fill();
  ctx.fillStyle = "#4e5a66"; ctx.font = "700 15px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(S.got + " / " + S.total, x + 30, y + 1);
  if (S.gems) { ctx.fillStyle = "rgba(255,252,244,.84)"; roundRect(x + 104, y - 16, 62, 32, 16); ctx.fill(); ctx.fillStyle = "#8fb8ee"; ctx.beginPath(); ctx.arc(x + 122, y, 8, 0, 7); ctx.fill(); ctx.fillStyle = "#4e5a66"; ctx.fillText(S.gems + "/" + S.gemTotal, x + 134, y + 1); }
  if (S.ab) { const A = TR.ABIL[S.ab], ax = x + (S.gems ? 172 : 104); ctx.fillStyle = "rgba(255,252,244,.84)"; roundRect(ax, y - 16, 84, 32, 16); ctx.fill(); ctx.fillStyle = A.col; ctx.beginPath(); ctx.arc(ax + 16, y, 11, 0, 7); ctx.fill(); TR.abilityIcon(ctx, S.ab, ax + 16, y, 10, A.col2 === "#e8a93a" ? "#8a5a10" : "#3c4a5a"); ctx.fillStyle = "#4e5a66"; ctx.font = "700 13px sans-serif"; ctx.fillText(A.name, ax + 33, y + 1); }
  // zone banner
  const B = G.banner; if (B && B.t < 3) { const a = Math.min(1, B.t * 2, (3 - B.t) * 1.5); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,252,244,.9)"; ctx.font = "600 12px sans-serif"; ctx.fillText(B.z.sub + "", W / 2, H * .22 - 18);
    ctx.font = "900 28px sans-serif"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(40,50,60,.35)"; ctx.strokeText(B.z.name, W / 2, H * .22 + 8); ctx.fillStyle = "#fffdf4"; ctx.fillText(B.z.name, W / 2, H * .22 + 8);
    ctx.fillStyle = "rgba(255,250,232,.8)"; ctx.fillRect(W / 2 - 70, H * .22 + 30, 140, 1.5); ctx.globalAlpha = 1; ctx.textAlign = "left"; }
}
function drawControls() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); btnPos();
  const bx = stick.active ? stick.bx : SAL + 40 + STICK_R, by = stick.active ? stick.by : H - 40 - STICK_R;
  ctx.globalAlpha = stick.active ? .9 : .38;
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.stroke();
  if (stick.active && stick.mag > 0) { const a = Math.atan2(stick.y, stick.x); ctx.strokeStyle = "rgba(200,235,255,.95)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by, STICK_R - 3, a - .5, a + .5); ctx.stroke(); }
  const kx = stick.active ? stick.kx : bx, ky = stick.active ? stick.ky : by;
  ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(kx, ky, 24, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(158,195,234,.6)"; ctx.beginPath(); ctx.arc(kx, ky, 12, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  const A = S.ab ? TR.ABIL[S.ab] : null, flash = G.abFlash && G.abFlash.t < 1.2 ? 1 - G.abFlash.t / 1.2 : 0;
  for (const b of BTN) {
    const act = b.k === "act"; ctx.globalAlpha = b.down ? 1 : .8;
    ctx.fillStyle = b.down ? "rgba(220,240,255,.95)" : act && A ? A.col + "cc" : "rgba(255,255,255,.55)"; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (b.down ? .93 : 1), 0, 7); ctx.fill(); ctx.stroke();
    if (act && flash > 0) { ctx.strokeStyle = `rgba(255,255,255,${flash})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 + (1 - flash) * 14, 0, 7); ctx.stroke(); }
    if (act && S.p.cool > 0) { ctx.fillStyle = "rgba(60,70,90,.18)"; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + S.p.cool * 10); ctx.fill(); }
    ctx.fillStyle = "#3f5670"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (act) { TR.abilityIcon(ctx, S.ab, b.x, b.y - 6, 13, "#3f5670"); ctx.font = "800 12px sans-serif"; ctx.fillText(A ? A.btn : "风", b.x, b.y + 16); }
    else { ctx.font = "800 17px sans-serif"; ctx.fillText(S.p.inCart ? "跳" : S.p.glide ? "滑翔" : "跳", b.x, b.y + 1); }
    ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}
// ---------- reveal ----------
let RV = null;
function revealPath() {
  const T = S.trail.filter(q => !q.side), out = [];
  if (!T.length) return out; let acc = 0; out.push({ x: T[0].x, y: T[0].y });
  for (let i = 1; i < T.length; i++) { const a = T[i - 1], b = T[i], d = hyp(b.x - a.x, b.y - a.y); if (d > 6) { out.push({ x: b.x, y: b.y }); continue; } acc += d; while (acc >= .25) { acc -= .25; const k = 1 - acc / (d || 1); out.push({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }); } }
  let P = out; for (let pass = 0; pass < 3; pass++) { const N = P.length, w = 22, Q = []; for (let i = 0; i < N; i++) { let x = 0, y = 0, n = 0; for (let k = Math.max(0, i - w); k <= Math.min(N - 1, i + w); k++) { x += P[k].x; y += P[k].y; n++; } Q.push({ x: x / n, y: y / n }); } Q[0] = P[0]; Q[N - 1] = P[N - 1]; P = Q; }
  return P;
}
function startReveal() {
  G.mode = "reveal"; hint(""); const T = S.trail; RV = { t: 0, head: T.length - 1, cam: { x: cam.x, y: cam.y }, z: Z, rewind: 2.4, sp: [] };
  RV.path = revealPath(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of RV.path) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  RV.bbox = [x0, y0, x1, y1]; RV.zf = Math.min(W * .62 / (x1 - x0), H * .62 / (y1 - y0)); AU.rewind && AU.rewind(2.2); S.p.happy = 1;
}
function updateReveal(dt) {
  RV.t += dt; G.t += dt; const T = S.trail, n = T.length, t = RV.t, tr = RV.rewind, P = RV.path;
  if (t < tr) { const k = ease(t / tr), i = Math.floor((1 - k) * (n - 1)); RV.head = i; RV.cam.x = lerp(RV.cam.x, T[i].x, .2); RV.cam.y = lerp(RV.cam.y, T[i].y, .2); RV.z = Z * lerp(1, .5, k); }
  else if (t < tr + 2) { const k = ease((t - tr) / 2), b = RV.bbox; RV.head = 0; if (!RV.ws) { RV.ws = 1; AU.whoosh(); } RV.cam.x = lerp(T[0].x, (b[0] + b[2]) / 2, k); RV.cam.y = lerp(T[0].y, (b[1] + b[3]) / 2 + (b[3] - b[1]) * .12, k); RV.z = lerp(Z * .5, RV.zf, k); }
  else if (!RV.lit) { RV.lit = 1; AU.reveal(); }
  if (RV.lit) { RV.draw = Math.min(P.length, (RV.draw || 0) + P.length * dt / 1.8); if (Math.random() < dt * 30) { const q = P[(Math.random() * Math.min(P.length, RV.draw)) | 0]; RV.sp.push({ x: q.x, y: q.y, t: 0 }); } }
  for (let i = RV.sp.length - 1; i >= 0; i--) { RV.sp[i].t += dt; RV.sp[i].y -= dt * .8; if (RV.sp[i].t > 1.2) RV.sp.splice(i, 1); }
  if (RV.lit && RV.draw >= P.length && !RV.msg) { RV.msg = 1; showWord(); }
}
function drawPath(c, P, alpha, upto, width, glow) { const n = upto == null ? P.length : Math.floor(upto); if (n < 2) return; c.lineCap = "round"; c.lineJoin = "round";
  if (glow) { c.strokeStyle = `rgba(158,215,255,${alpha * .35})`; c.lineWidth = width * 3.2; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(P[i].x, P[i].y) : c.moveTo(P[i].x, P[i].y); c.stroke(); }
  c.strokeStyle = glow ? `rgba(240,250,255,${alpha})` : `rgba(255,255,255,${alpha})`; c.lineWidth = width; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(P[i].x, P[i].y) : c.moveTo(P[i].x, P[i].y); c.stroke(); }
function renderReveal(dt) {
  const z = RV.z, T = S.trail;
  TR.renderWorld(ctx, S, RV.cam, z, { t: G.t, dt, trail: false, hero: RV.t < RV.rewind + .3, reveal: c => {
    if (RV.t < RV.rewind) { drawPath(c, T, .35, null, .12, false); const i = RV.head; c.fillStyle = "#fff"; c.beginPath(); c.arc(T[i].x, T[i].y, .3, 0, 7); c.fill(); }
    else if (!RV.lit) drawPath(c, T, .3, null, 1.4 / z, false);
    else { c.fillStyle = `rgba(20,40,60,${Math.min(.5, (RV.t - RV.rewind - 2) * .3)})`; c.fillRect(-60, -60, 220, 220); drawPath(c, T, .18, null, 1.2 / z, false); drawPath(c, RV.path, 1, RV.draw, 8 / z, true);
      for (const s of RV.sp) { const a = Math.sin(s.t / 1.2 * Math.PI); c.fillStyle = `rgba(230,248,255,${a})`; c.beginPath(); c.arc(s.x, s.y, (.18 * a + .05) * 3, 0, 7); c.fill(); } }
  } }, W, H, DPR, Z);
  if (RV.t >= RV.rewind + .3) { const p = S.p, g = S.L.goal, s = { ...p, x: g.x, y: g.y, ground: 1, gn: { x: 0, y: -1 }, happy: 1, ear: Math.sin(G.t * 3) * .3 + .3, face: -1, sq: 1 + Math.sin(G.t * 5) * .04, hurt: 0 };
    ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - RV.cam.x * z), DPR * (H / 2 - RV.cam.y * z)); TR.drawTuan(ctx, s, G.t, Math.max(1, 2.4 * Z / z * .4), S.ab); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
}
function showWord() {
  G.mode = "word"; $("word").classList.add("show");
  $("msg").innerHTML = '<span class="big">I <span class="hrt">❤</span> U</span>' + (G.msg ? "<br>" + G.msg.replace(/[<>&]/g, "") : "");
  const mm = Math.floor(G.playT / 60), ss = Math.floor(G.playT % 60);
  $("from").textContent = (G.fromShare ? "团绒跑过的路，悄悄写成了这个字母" : "你刚刚跑过的路，就是这个 U");
  $("stats").innerHTML = `<span>光点 <b>${S.got}</b>/${S.total}</span><span>隐藏蓝绒球 <b>${S.gems}</b>/${S.gemTotal}</span><span>用时 <b>${mm}:${String(ss).padStart(2, "0")}</b></span>`;
  setTimeout(() => $("wordBtns").classList.add("show"), 1200);
}
// ---------- flow ----------
function startPlay() { S = TR.newGame("U"); TR.buildEdges(S.L); G.mode = "play"; G.t = 0; G.playT = 0; G.goalT = 0; RV = null; cam.x = S.p.x + 2; cam.y = S.p.y; TR.R.bgW = {}; $("word").classList.remove("show"); $("wordBtns").classList.remove("show"); hint(""); }
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
let last = performance.now(), fpsA = 60;
function frame(now) {
  const rdt = Math.min(.05, (now - last) / 1000); last = now; fpsA = lerp(fpsA, 1 / Math.max(rdt, .001), .05); const dt = rdt;
  try {
    if (G.mode === "play") { for (let k = 0; k < (G.steps || 1); k++) { G.t += dt; updatePlay(dt); if (G.mode !== "play") break; } }
    else if (G.mode === "reveal") updateReveal(dt);
    else if (G.mode === "word" || G.mode === "custom") { G.t += dt; if (RV) { RV.sp.length < 40 && Math.random() < dt * 20 && RV.sp.push({ ...RV.path[(Math.random() * RV.path.length) | 0], t: 0 }); for (let i = RV.sp.length - 1; i >= 0; i--) { RV.sp[i].t += dt; if (RV.sp[i].t > 1.2) RV.sp.splice(i, 1); } } }
    else G.t += dt;
    if (G.overview) { const o = G.overview; TR.renderWorld(ctx, S, { x: o.x, y: o.y }, o.z, { t: G.t, dt, trail: true, hero: true, reveal: () => {}, snapBg: true }, W, H, DPR, Z); }
    else if (G.mode === "play") { TR.renderWorld(ctx, S, cam, Z, { t: G.t, dt }, W, H, DPR, Z); drawHUD(); drawControls(); }
    else if (RV) renderReveal(dt);
    else { S.p.blink -= dt; if (S.p.blink < -.12) S.p.blink = 2 + Math.random() * 2; S.p.ear = Math.sin(G.t * 1.3) * .08; TR.renderWorld(ctx, S, { x: S.p.x + 3.4, y: S.p.y + .2 }, Z * 1.1, { t: G.t, dt, snapBg: true }, W, H, DPR, Z); }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
window.__game = {
  G, get S() { return S; }, get RV() { return RV; }, W: () => W, H: () => H, get stick() { return stick; }, BTN, get cam() { return cam; }, get fps() { return fpsA; },
  btnPos() { btnPos(); return BTN.map(b => ({ k: b.k, x: b.x, y: b.y, r: b.r })); }, toClient(x, y) { return ROT ? { x: H - y, y: x } : { x, y }; }, get rot() { return ROT; },
  start() { $("startBtn").click(); }, botOn(v) { G.botDrive = !!v; TR.botReset && TR.botReset(); }, botPlan() { return S && G.mode === "play" ? TR.botStep(S, true) : null; }, encodeShare, decodeShare,
  set steps(v) { G.steps = v; }, overview(x, y, z) { G.overview = x == null ? null : { x, y, z }; }, teleport(x, y, ab) { S.p.x = x; S.p.y = y; S.p.vx = S.p.vy = 0; S.p.ground = null; S.p.carry = null; if (ab !== undefined) S.ab = ab; cam.x = x; cam.y = y; TR.syncRoute && TR.syncRoute(); }, TR,
};
addEventListener("resize", resize); resize();
TR.initArt(ctx); parseHash(); S = TR.newGame("U"); TR.buildEdges(S.L); TR.R.bgW = {};
if (G.fromShare) { $("startSub").textContent = "有人给你做了一个小关卡"; $("startSub2").textContent = G.msg ? "跑到终点，TA 有一句话要对你说" : "跑到终点有个小惊喜"; }
$("start").classList.add("show");
requestAnimationFrame(frame);
})();
