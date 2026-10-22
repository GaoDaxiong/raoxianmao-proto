// 团绒 v6 — simulation: physics, ear abilities, mechanisms, enemies, boss. No DOM; runs headless in Node for level tests.
(function (root) {
"use strict";
const TR = root.TR;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
const SFX = (n, ...a) => { if (TR.sfx) TR.sfx(n, ...a); };
const ON = (n, ...a) => { if (TR.on) TR.on(n, ...a); };
const inR = (r, x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
TR.inR = inR;
const PH = TR.PH = { g: 36, maxFall: 15, jumpV: 13.4, run: 7.4, walk: 3.8, gAcc: 95, gDec: 150, aAcc: 60, glideFall: 3.2, umbFall: 1.0, coyote: .11, buffer: .13, r: .45,
  springV: [15.8, 17.6, 19.2], slamV: 21.5, lampR: 3.6, flareR: 7, ringR: 3.8 };
TR.ABIL = {
  drill: { name: "钻耳", btn: "钻", col: "#d9a35b", col2: "#a86e2e" },
  lamp: { name: "灯耳", btn: "灯", col: "#ffd76a", col2: "#e8a93a" },
  umb: { name: "伞耳", btn: "伞", col: "#8fe3c8", col2: "#3fae95" },
  spring: { name: "弹耳", btn: "弹", col: "#b6e36a", col2: "#6fae3a" },
  bell: { name: "铃耳", btn: "铃", col: "#a9b8ff", col2: "#6f7fd8" },
};
// ---------- geometry ----------
function sdBox(x, y, b) { const hx = (b[2] - b[0]) / 2, hy = (b[3] - b[1]) / 2, dx = Math.abs(x - (b[0] + hx)) - hx, dy = Math.abs(y - (b[1] + hy)) - hy; return hyp(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); }
function sdPoly(x, y, v) {
  let d = (x - v[0][0]) ** 2 + (y - v[0][1]) ** 2, s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1], wx = x - v[i][0], wy = y - v[i][1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t; d = Math.min(d, bx * bx + by * by);
    const c1 = y >= v[i][1], c2 = y < v[j][1], c3 = ex * wy > ey * wx; if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
const sdShape = (s, x, y) => s.k === "box" ? sdBox(x, y, s.b) : sdPoly(x, y, s.pts);
function bbox(s) { if (s.k === "box") return s.b.slice(); let a = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of s.pts) { a[0] = Math.min(a[0], x); a[1] = Math.min(a[1], y); a[2] = Math.max(a[2], x); a[3] = Math.max(a[3], y); } return a; }
const CS = 4, GX = -40, GY = -60, GW = 50, GH = 50;
function prep(L) {
  L.grid = []; for (let i = 0; i < GW * GH; i++) L.grid.push({ air: [], sol: [] });
  const ins = (s, key, m) => { const b = s.bb; for (let ix = Math.floor((b[0] - m - GX) / CS); ix <= Math.floor((b[2] + m - GX) / CS); ix++) for (let iy = Math.floor((b[1] - m - GY) / CS); iy <= Math.floor((b[3] + m - GY) / CS); iy++) if (ix >= 0 && iy >= 0 && ix < GW && iy < GH) L.grid[ix * GH + iy][key].push(s); };
  for (const s of L.air) { s.bb = bbox(s); ins(s, "air", 2.5); }
  for (const s of L.solids) { s.bb = bbox(s); ins(s, "sol", 2.5); }
  // rail in arc-length coordinates
  if (L.rail) { const P = L.rail.pts, S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); L.rail.s = S; L.rail.len = S[S.length - 1];
    const sAtX = x => { for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const k = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return S[i - 1] + k * (S[i] - S[i - 1]); } return L.rail.len; };
    L.rail.sg = L.rail.gaps.map(([a, b]) => [sAtX(a), sAtX(b)]); }
  return L;
}
function railAt(R, s) { const P = R.pts, S = R.s; s = clamp(s, 0, R.len); let i = 1; while (i < P.length - 1 && S[i] < s) i++; const k = (s - S[i - 1]) / (S[i] - S[i - 1] || 1), x = lerp(P[i - 1][0], P[i][0], k), y = lerp(P[i - 1][1], P[i][1], k), dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], l = hyp(dx, dy) || 1; return { x, y, tx: dx / l, ty: dy / l }; }
TR.railAt = railAt;
let S = null;
function solidOn(s, drill) {
  switch (s.mat) { case "soft": return !drill; case "ice": return !s.broken; case "bud": return s.shut; case "gate": return !s.open; default: return true; }
}
function sdf(x, y, drill) {
  const ix = Math.floor((x - GX) / CS), iy = Math.floor((y - GY) / CS); if (ix < 0 || iy < 0 || ix >= GW || iy >= GH) return -3;
  const c = S.L.grid[ix * GH + iy]; let d = -3;
  for (const s of c.air) { const e = -sdShape(s, x, y); if (e > d) d = e; }
  for (const s of c.sol) { if (!solidOn(s, drill)) continue; const e = sdShape(s, x, y); if (e < d) d = e; }
  return d;
}
function grad(x, y, drill) { const e = .01, gx = sdf(x + e, y, drill) - sdf(x - e, y, drill), gy = sdf(x, y + e, drill) - sdf(x, y - e, drill), l = hyp(gx, gy) || 1; return { x: gx / l, y: gy / l }; }
TR.sdfRaw = (x, y, drill) => sdf(x, y, drill);
function platOn(q) {
  switch (q.kind) { case "flip": return q.flat; case "light": return q.lit > 0; case "fog": return !!S.L.fog[q.chunk] && S.L.fog[q.chunk].cleared; case "nest": return S.boss && S.boss.dead; default: return true; }
}
TR.platOn = q => platOn(q);
// ---------- state ----------
function newGame(letter) {
  const L = prep(TR.buildLevel(letter || "U"));
  for (const w of L.wisps) { w.got = 0; w.ph = (w.x * 7.3 + w.y * 3.1) % 6.28; }
  for (const w of L.abilityWisps) { w.got = 0; w.ph = 0; w.rt = 0; }
  for (const g of L.gems) g.got = 0;
  for (const q of L.plats) { q.lit = 0; q.flat = true; q.on = false; q.sh = 0; }
  for (const f of L.fog) { f.cleared = false; f.a = 1; }
  for (const b of L.bells) { b.rung = false; b.sw = 0; }
  for (const s of L.solids) { if (s.mat === "bud") { s.shut = true; s.openAmt = 0; } if (s.mat === "gate") { s.open = false; s.oa = 0; } if (s.mat === "ice") { s.broken = false; } }
  for (const i of L.icicles) { i.st = "hang"; i.t = 0; i.fy = i.y; i.vy = 0; }
  for (const m of L.shrooms) { m.stun = 0; m.sq = 0; m.st = "sleep"; }
  for (const c of L.crows) { c.hx = c.x; c.hy = c.y; c.st = "perch"; c.t = 0; c.vx = c.vy = 0; c.ang = 0; }
  for (const th of L.thieves) { th.st = "idle"; th.t = 0; th.vx = 0; th.vy = 0; th.fy = th.y; th.carry = 0; th.face = -1; th.hx = th.x; }
  for (const sp of L.spikes) { sp.t = sp.phase; sp.balls = []; }
  const cart = L.rail ? { s: 1.4, v: 0, hop: 0, hv: 0, st: "park", bt: 0 } : null;
  const boss = L.boss ? { ...L.boss, st: "hide", t: 0, puffT: 2.5, puffs: [], hurtT: 0, dead: false, popT: 0, hits: 0, hp: 3, inv: 0, perch: 0 } : null;
  S = { L, t: 0, ab: null, got: 0, total: L.wisps.length, gems: 0, gemTotal: L.gems.length, cart, boss, fx: [], trail: [], tAcc: 0, done: false, hints: {}, zone: null, flare: null, ring: null, drops: 0, lost: 0, stats: { hurt: 0, steals: 0 },
    p: { x: L.start.x, y: L.start.y, vx: 0, vy: 0, gs: 0, ground: null, gn: { x: 0, y: -1 }, coyote: 0, buf: 0, abuf: 0, jumping: false, jumping0: false, glide: false, face: 1, sq: 1, sqv: 0,
      blink: 2, ear: 0, earV: 0, walk: 0, drop: 0, puffT: 0, airPuff: 1, hurt: 0, landT: 0, drill: 0, drillT: 0, slam: 0, chain: 0, chainT: 0, dash: 0, dashUsed: false, cool: 0, inCart: false, room: false, spin: 0 } };
  S.follow = []; // trailing wisp positions (render)
  return S;
}
TR.newGame = newGame;
TR.getS = () => S;
// ---------- player ----------
function plat(p, nx, ny) {
  for (const q of S.L.plats) {
    if (!platOn(q)) continue;
    if (p.vy >= 0 && p.drop <= 0 && p.y + PH.r <= q.y + .04 && ny + PH.r >= q.y && nx > q.x0 - .25 && nx < q.x1 + .25) return q;
  }
  return null;
}
function hurt(dirx, why) {
  const p = S.p; if (p.hurt > 0 || p.inCart || S.done) return;
  p.vx = (dirx || -p.face) * 7.5; p.vy = -7.5; p.gs = 0; p.ground = null; p.hurt = 1.1; p.drill = 0; p.slam = 0; p.dash = 0; p.sqv = -.5; p.jumping = false; p.jumping0 = true;
  S.stats.hurt++; SFX("hurt"); dropWisps(2, p.x, p.y);
  if (why && !S.hints["h_" + why]) { S.hints["h_" + why] = 1; }
}
TR.hurt = hurt;
function dropWisps(n, x, y) {
  const k = Math.min(n, S.got); S.got -= k;
  for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i - (k - 1) / 2) * 1.1; S.L.wisps.push({ x, y, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, drop: 1, t: 0, got: 0, ph: Math.random() * 6 }); }
  if (k) ON("drop", k);
}
function step(h, inp) {
  const p = S.p, L = S.L, r = PH.r, ab = S.ab;
  p.coyote -= h; p.buf -= h; p.drop -= h; p.hurt -= h; p.landT -= h; p.cool -= h; p.chainT -= h; if (p.dash > 0) p.dash -= h;
  if (p.inCart) { cartStep(h, inp); return; }
  // environment
  let wx = 0, gey = null, cur = null;
  for (const w of L.winds) if (inR(w.r, p.x, p.y)) wx += w.vx;
  for (const c of L.currents) if (inR(c.r, p.x, p.y)) cur = c;
  for (const g of L.geysers) if (g.on && p.x > g.x0 - .2 && p.x < g.x1 + .2 && p.y < g.base + .3 && p.y > g.topNow - .6) gey = g;
  const umb = ab === "umb", spring = ab === "spring";
  const runV = umb && !p.ground ? 8.4 : PH.run;
  const ax = Math.abs(inp.x) < .08 ? 0 : Math.sign(inp.x) * (Math.abs(inp.x) < .55 ? PH.walk + (runV - PH.walk) * (Math.abs(inp.x) - .08) / .47 * .5 : runV);
  if (ax) p.face = Math.sign(ax);
  const target = ax + wx;
  if (p.ground) {
    if (ax && Math.sign(ax) !== Math.sign(p.gs) && p.gs) p.gs = 0;
    const a = target === 0 || Math.abs(target) < Math.abs(p.gs) ? PH.gDec : PH.gAcc;
    p.gs = p.gs < target ? Math.min(target, p.gs + a * h) : Math.max(target, p.gs - a * h);
    if (p.dash > 0) p.gs = p.dashDir * 12;
    const t = { x: -p.gn.y, y: p.gn.x }; p.vx = t.x * p.gs; p.vy = t.y * p.gs;
    const k = p.ground.kind; if (inp.y > .6 && p.buf > 0 && k && k !== "ledge" && k !== "nest" && k !== "stone") { p.drop = .25; p.ground = null; p.buf = 0; }
  } else {
    if (ax && Math.sign(ax) !== Math.sign(p.vx) && Math.abs(p.vx) > 1 && !wx && p.dash <= 0) p.vx *= .5;
    const a = PH.aAcc * (ax ? 1 : .55);
    if (p.dash > 0) p.vx = p.dashDir * 12; else p.vx = p.vx < target ? Math.min(target, p.vx + a * h) : Math.max(target, p.vx - a * h);
    let g = PH.g;
    if (p.jumping && !inp.jd && p.vy < 0) { p.vy *= .5; p.jumping = false; }
    p.glide = inp.jd && (p.vy > -1 || !!gey || !!cur) && !p.jumping0 && !p.drill && !p.slam;
    if (p.vy >= 0) p.jumping0 = false;
    if (gey) { const tv = umb && p.glide ? -10 : -12.5; p.vy = lerp(p.vy, tv, 1 - Math.exp(-h * 7)); g = 0; if (p.y < g.topNow + .8 && p.vy < 0) p.vy *= .9; }
    if (cur) { if (umb && p.glide) { p.vy = lerp(p.vy, cur.vy, 1 - Math.exp(-h * 5)); p.vx = lerp(p.vx, cur.vx + ax * .6, 1 - Math.exp(-h * 2)); g = 0; } else g *= .85; }
    if (p.drill > 0) { p.vy = 11; p.vx = clamp(p.vx, -2.5, 2.5); g = 0; }
    if (p.slam) { p.vy = 21; p.vx *= .9; g = 0; }
    if (p.dash > 0) { p.vy = Math.min(p.vy, .4); g = 0; }
    p.vy += g * h;
    if (p.glide && !gey && !cur) p.vy = Math.min(p.vy, umb ? PH.umbFall : PH.glideFall);
    p.vy = Math.min(p.vy, p.drill > 0 || p.slam ? 22 : PH.maxFall);
  }
  // jump (coyote + buffer). spring ears: higher, chained when re-jumping right after landing
  if (p.buf > 0 && (p.ground || p.coyote > 0) && !(inp.y > .6 && p.ground && p.ground.kind && p.ground.kind !== "ledge" && p.ground.kind !== "nest" && p.ground.kind !== "stone")) {
    let v = PH.jumpV; if (spring) { p.chain = p.chainT > 0 ? Math.min(2, p.chain + 1) : 0; v = PH.springV[p.chain]; }
    p.vy = -v; p.ground = null; p.coyote = 0; p.buf = 0; p.jumping = true; p.jumping0 = true; p.sqv = .5; p.drill = 0;
    SFX(spring ? "spring" : "jump", p.chain); fx("dust", p.x, p.y + r, 4);
  }
  if (p.abuf > 0) { p.abuf = 0; action(); }
  // integrate
  const drill = p.drill > 0;
  let nx = p.x + p.vx * h, ny = p.y + p.vy * h;
  const was = p.ground; let land = drill ? null : plat(p, nx, ny);
  if (land) { ny = land.y - r; p.vy = 0; p.ground = land; p.gn = { x: 0, y: -1 }; if (!was) p.gs = p.vx; }
  p.x = nx; p.y = ny;
  let grounded = !!land, gn = land ? { x: 0, y: -1 } : null;
  for (let it = 0; it < 4; it++) {
    const d = sdf(p.x, p.y, drill); if (d >= r) break;
    const n = grad(p.x, p.y, drill); p.x += n.x * (r - d); p.y += n.y * (r - d);
    const vn = p.vx * n.x + p.vy * n.y; if (vn < 0) { p.vx -= n.x * vn; p.vy -= n.y * vn; }
    if (n.y < -.55) { grounded = true; gn = n; } else if (p.ground && Math.abs(n.x) > .7 && p.gs * n.x < 0) p.gs = 0;
  }
  if (!grounded && was && !p.jumping0 && p.vy > -1 && !p.slam && !drill) {
    if (was.kind) { if (platOn(was) && p.x > was.x0 - .25 && p.x < was.x1 + .25) { p.y = was.y - r; grounded = true; gn = { x: 0, y: -1 }; land = was; } }
    else { let tot = 0; for (let k = 0; k < 3; k++) { const d = sdf(p.x, p.y) - r; if (d > .001 && tot + d < .45) { p.y += d; tot += d; } } if (sdf(p.x, p.y) - r < .02) { const n = grad(p.x, p.y); if (n.y < -.55) { grounded = true; gn = n; } } }
  }
  if (grounded && p.slam) { // slam -> big bounce
    p.slam = 0; p.vy = -PH.slamV; p.ground = null; p.jumping = false; p.jumping0 = true; p.sqv = -.9; p.chainT = .2; p.chain = 1; grounded = false; SFX("boing"); fx("ring", p.x, p.y + r, 1); fx("dust", p.x, p.y + r, 8);
    if (land && land.kind === "stone") stoneStep(land);
  }
  if (grounded && drill) { if (sdf(p.x, p.y, false) >= r - .05) { p.drill = 0; fx("dust", p.x, p.y + r, 6); SFX("thud"); } else grounded = false; }
  if (grounded) {
    if (!was) { onLand(p, land); const t = { x: -gn.y, y: gn.x }; p.gs = p.vx * t.x + p.vy * t.y; }
    p.ground = land || { surf: 1 }; p.gn = gn; p.coyote = PH.coyote; p.jumping = p.jumping0 = false; p.glide = false; p.airPuff = 1; p.dashUsed = false;
    if (!land) { const t = { x: -gn.y, y: gn.x }; p.vy = t.y * p.gs; }
  } else { if (was) p.coyote = PH.coyote; p.ground = null; }
  if (p.drill > 0) { p.drillT += h; p.spin += h * 30; if (p.drillT > 2.2 && sdf(p.x, p.y, false) >= r) p.drill = 0; if (Math.random() < h * 40 && sdf(p.x, p.y + .6, false) < .1) fx("soil", p.x, p.y + .4, 1); }
  // hazards (brambles bounce you up)
  for (const z of L.hazards) if (p.x > z.b[0] - .3 && p.x < z.b[2] + .3 && p.y + r > z.b[1] && p.y - r < z.b[3]) { if (p.hurt <= 0) hurt(p.x < (z.b[0] + z.b[2]) / 2 ? -.3 : .3, "bramble"); p.vy = -17; p.ground = null; p.jumping0 = true; p.y = Math.min(p.y, z.b[1] - r); }
  // trail
  S.tAcc += h; if (S.tAcc > 1 / 30) { S.tAcc = 0; const l = S.trail[S.trail.length - 1]; if (!l || hyp(l.x - p.x, l.y - p.y) > .06) S.trail.push({ x: p.x, y: p.y, t: S.t, side: p.room ? 1 : 0 }); }
}
function onLand(p, land) {
  const v = p.vy; if (v > 4) { p.sqv = -Math.min(.9, v / 14); fx("dust", p.x, p.y + PH.r, 6); SFX("land", v); }
  p.landT = .15; if (S.ab === "spring") p.chainT = .16;
  if (land && land.kind === "stone") stoneStep(land);
}
function stoneStep(q) {
  const set = S.L.stoneSets.find(s => s.id === q.set); if (!set || set.done) return;
  if (q.on) return;
  if (q.n === set.prog + 1) { q.on = true; set.prog++; SFX("stone", set.prog); fx("spark", q.x0 + .8, q.y - .2, 10);
    if (set.prog === set.n) { set.done = true; const g = S.L.gates.find(g => g.id === set.gate); if (g) g.open = true; SFX("gate"); ON("hint", "咔——石门打开了！", 2200); } }
  else { for (const s of S.L.plats) if (s.set === set.id) s.on = false; set.prog = 0; SFX("wrong"); ON("hint", "顺序不对，石头又暗了…从 ● 开始", 2200);
    if (q.n === 1) { q.on = true; set.prog = 1; } }
}
// ---------- abilities ----------
function action() {
  const p = S.p, L = S.L, ab = S.ab;
  if (p.cool > 0) return;
  if (!ab) { p.puffT = .35; SFX("puff"); fx("puff", p.x + p.face * .5, p.y, p.face); if (!p.ground && p.airPuff) { p.airPuff = 0; p.vy = Math.min(p.vy, -4.5); p.jumping = false; } p.cool = .25;
    for (const m of L.shrooms) if (hyp(m.x - p.x, m.y - .6 - p.y) < 2.6) m.stun = 2.5; return; }
  if (ab === "drill") { p.drill = 1; p.drillT = 0; p.slam = 0; p.ground = null; p.jumping = false; p.cool = .2; SFX("drill"); return; }
  if (ab === "lamp") { p.cool = .55; S.flare = { x: p.x, y: p.y, t: 0 }; SFX("flare");
    for (const s of L.solids) if (s.mat === "ice" && !s.broken && sdShape(s, p.x, p.y) < PH.ringR - .3) { s.broken = true; SFX("shatter"); for (let i = 0; i < 12; i++) fx("ice", (s.b[0] + s.b[2]) / 2, lerp(s.b[1], s.b[3], i / 11), 1); ON("broke", s.id); }
    for (const i of L.icicles) if ((i.st === "hang" || i.st === "shake") && hyp(i.x - p.x, i.y + .6 - p.y) < 4.2) { i.st = "gone"; i.t = 0; fx("ice", i.x, i.y + .6, 8); }
    for (const c of L.crows) if (hyp(c.x - p.x, c.y - p.y) < PH.flareR && c.st !== "rest") { c.st = "flee"; c.t = 0; }
    for (const q of L.plats) if (q.kind === "light" && hyp((q.x0 + q.x1) / 2 - p.x, q.y - p.y) < PH.flareR) q.lit = Math.max(q.lit, 8);
    return; }
  if (ab === "umb") { if (!p.ground && p.dashUsed) return; p.dash = .2; p.dashDir = p.face; p.dashUsed = !p.ground; p.cool = .35; p.jumping = false; SFX("dash"); fx("puff", p.x - p.face * .4, p.y, -p.face); return; }
  if (ab === "spring") { p.cool = .3; if (p.ground) { p.vy = -8.5; p.ground = null; p.jumping = false; p.jumping0 = true; p.slamAt = 1; SFX("jump"); } else { p.slam = 1; p.drill = 0; p.jumping = false; SFX("slam"); } return; }
  if (ab === "bell") { p.cool = .45; S.ring = { x: p.x, y: p.y, t: 0 }; SFX("ring");
    for (const b of L.bells) if (!b.rung && hyp(b.x - p.x, b.y - p.y) < PH.ringR + .3) ringBell(b);
    for (const m of L.shrooms) if (hyp(m.x - p.x, m.y - .6 - p.y) < PH.ringR + .5) m.stun = 4;
    for (const th of L.thieves) if (hyp(th.x - p.x, th.y - .4 - p.y) < PH.ringR + .5) stunThief(th);
    for (const c of L.crows) if (hyp(c.x - p.x, c.y - p.y) < PH.ringR + 1) { c.st = "flee"; c.t = 0; }
    for (const sp of L.spikes) for (const b of sp.balls) if (hyp(b.x - p.x, b.y - p.y) < PH.ringR) { b.dead = 1; fx("spark", b.x, b.y, 6); }
    const B = S.boss; if (B) { for (const f of B.puffs) if (hyp(f.x - p.x, f.y - p.y) < PH.ringR + .8) f.dead = 1;
      if (!B.dead && L.fog.every(f => f.cleared) && B.inv <= 0 && hyp(B.x - p.x, B.y - p.y) < PH.ringR + 1.8 && --B.hp > 0) { B.hurtT = 1; B.inv = 1.4; B.perch = B.perch === 0 ? 1 : 2; SFX("windbell"); for (let i = 0; i < 12; i++) fx("cloud", B.x, B.y, 1);
        ON("hint", B.hp === 2 ? "大雾怪晕乎乎地飘走了——追上去再摇铃！" : "最后一下！它躲到右边去了", 2600); }
      else if (!B.dead && L.fog.every(f => f.cleared) && B.inv <= 0 && B.hp <= 0 && hyp(B.x - p.x, B.y - p.y) < PH.ringR + 1.8) { B.dead = true; B.popT = 0; SFX("bosspop"); ON("bossdead"); ON("hint", "大雾怪“噗”地散成了小云朵——终点出现啦！", 3200); for (let i = 0; i < 30; i++) fx("cloud", B.x, B.y, 1); }
      else if (!B.dead && hyp(B.x - p.x, B.y - p.y) < PH.ringR + 1.8) { B.hurtT = .6; } }
    return; }
}
function ringBell(b) {
  b.rung = true; b.sw = 1; SFX("windbell"); const f = S.L.fog[b.chunk]; if (f && !f.cleared) { f.cleared = true; SFX("whoosh"); for (let i = 0; i < 24; i++) fx("wind", lerp(f.b[0], f.b[2], Math.random()), lerp(f.b[1], f.b[3], Math.random()), 1); }
  const B = S.boss; if (B) { B.hurtT = .8; B.hits++; }
  const left = S.L.fog.filter(f => !f.cleared).length;
  ON("hint", left ? `风铃响了，雾散开一块！还剩 ${left} 块雾` : "雾全散了！靠近大雾怪，再摇一次铃！", 2600); ON("bell", b.chunk);
}
function stunThief(th) { if (th.carry) { th.carry = 0; S.L.wisps.push({ x: th.x, y: th.y - .6, vx: 0, vy: -3, drop: 1, t: 0, got: 0, ph: 0 }); } th.st = "dizzy"; th.t = 0; }
// ---------- minecart ----------
function cartStep(h, inp) {
  const p = S.p, C = S.cart, R = S.L.rail;
  if (C.st === "bonk") { C.bt += h; C.hop = Math.max(-1.2, C.hop - h * 3); if (C.bt > .7) { C.st = "ride"; C.s = Math.max(1.4, C.bonkS - 3.5); C.v = 4.5; C.hop = 0; C.hv = 0; } }
  else {
    const q = railAt(R, C.s); C.v = clamp(C.v + (26 * q.ty - .25 * C.v) * h, 4.8, 12.5); C.s += C.v * h;
    if (p.buf > 0 && C.hop <= 0.001) { C.hv = 8.6; p.buf = 0; SFX("jump"); p.sqv = .5; }
    if (C.hop > 0 || C.hv > 0) { C.hv -= 30 * h; C.hop += C.hv * h; if (C.hop <= 0) { C.hop = 0; C.hv = 0; SFX("clack"); } }
    for (const [a, b] of R.sg) if (C.s > a + .3 && C.s < b && C.hop < .25) { C.st = "bonk"; C.bt = 0; C.bonkS = a; SFX("bonk"); ON("hint", "断轨了！快到缺口时按「跳」", 2200); S.stats.hurt++; break; }
    if (C.s >= R.len - .2) { // eject at the end bumper
      const e = railAt(R, R.len); p.inCart = false; C.st = "done"; p.x = e.x + .4; p.y = e.y - 1.2; p.vx = 6; p.vy = -8; p.ground = null; p.jumping0 = true; SFX("clunk"); ON("hint", "", 0); return; }
  }
  const q = railAt(R, C.s), nx = q.ty, ny = -q.tx;
  C.x = q.x + nx * (.42 + C.hop); C.y = q.y + ny * (.42 + C.hop); C.ang = Math.atan2(q.ty, q.tx);
  p.x = C.x + nx * .55; p.y = C.y + ny * .55; p.vx = q.tx * C.v; p.vy = q.ty * C.v; p.face = 1; p.ground = null;
  S.tAcc += h; if (S.tAcc > 1 / 30) { S.tAcc = 0; S.trail.push({ x: p.x, y: p.y, t: S.t, side: 0 }); }
}
// ---------- per-frame world update ----------
function fx(k, x, y, n, a) { if (S.fx.length > 260) return; for (let i = 0; i < n; i++) { const r = Math.random, ang = r() * 6.283; S.fx.push({ k, x: x + (r() - .5) * .3, y, vx: k === "puff" ? (n === 1 ? 0 : 0) + (a || 0) : Math.cos(ang) * (k === "cloud" ? 3 : 2) * r(), vy: k === "dust" ? -r() * 1.2 : Math.sin(ang) * 2 * r() - (k === "soil" ? 2 : 0), t: 0, r: r() * 6 }); } }
TR.fx = (...a) => fx(...a);
function update(dt, inp) {
  const p = S.p, L = S.L;
  if (inp.jq) p.buf = PH.buffer; if (inp.aq) p.abuf = 1;
  // spring: ground-tap hop turns into a slam at the apex
  if (p.slamAt && !p.ground && p.vy > -1) { p.slamAt = 0; if (S.ab === "spring") { p.slam = 1; SFX("slam"); } }
  if (p.ground) p.slamAt = 0;
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { S.t += h; step(h, inp); if (S.done) break; }
  world(dt);
}
TR.update = update;
function world(dt) {
  const p = S.p, L = S.L, t = S.t;
  // zones + rooms + tips
  let z = null; for (const zz of L.zones) if (inR(zz.r, p.x, p.y)) { z = zz; break; }
  if (z && z !== S.zone) { S.zone = z; ON("zone", z); }
  p.room = L.rooms.some(r => inR(r.b, p.x, p.y));
  for (const tp of L.tips) if (!S.hints[tp.id] && inR(tp.r, p.x, p.y)) { S.hints[tp.id] = 1; ON("hint", tp.text, 3600); }
  for (const w of L.winds) if (inR(w.r, p.x, p.y) && !S.hints["w" + w.r[0]]) { S.hints["w" + w.r[0]] = 1; ON("hint", "呼——逆风太大，这边走不通", 2000); }
  // flip planks
  for (const q of L.plats) if (q.kind === "flip") { const u = ((t + q.phase) % q.period + q.period) % q.period, P = q.period; const wasFlat = q.flat;
    q.flat = u < P - .8; q.sh = u > P - 1.25 && u < P - .8 ? 1 : 0; q.rot = u < P - .8 ? 0 : Math.min(1, (u - (P - .8)) / .15) * (u > P - .15 ? (P - u) / .15 : 1);
    if (wasFlat && !q.flat) { SFX("flip"); if (p.ground === q) p.ground = null; } }
  // light platforms
  const lamp = S.ab === "lamp";
  for (const q of L.plats) if (q.kind === "light") { q.lit = Math.max(0, q.lit - dt); if (lamp && hyp((q.x0 + q.x1) / 2 - p.x, q.y - p.y) < PH.lampR + .4) { if (q.lit < .05) SFX("glint"); q.lit = Math.max(q.lit, 1.0); } if (p.ground === q) q.lit = Math.max(q.lit, .6); }
  // geysers
  for (const g of L.geysers) { const u = ((t + g.phase) % g.period + g.period) % g.period, e0 = g.period - g.erupt; const was = g.on;
    g.on = u >= e0; g.warn = u >= e0 - .7 && u < e0; g.topNow = g.on ? lerp(g.base, g.top, Math.min(1, (u - e0) / .3)) : g.base; if (g.on && !was) SFX("geyser"); }
  // bud doors
  for (const s of L.solids) if (s.mat === "bud") { const u = ((t + s.phase) % s.period + s.period) % s.period, want = u < s.open; const wasShut = s.shut;
    const inside = p.x > s.b[0] - .45 && p.x < s.b[2] + .45 && p.y > s.b[1] - .45 && p.y < s.b[3] + .45;
    s.openAmt = clamp(s.openAmt + (want || (inside && s.openAmt > .3) ? dt * 6 : -dt * 4), 0, 1); s.shut = s.openAmt < .45; if (wasShut && !s.shut) SFX("bud"); }
  for (const g of L.gates) g.oa = clamp(g.oa + (g.open ? dt * 1.5 : -dt), 0, 1);
  // wisps
  for (const w of L.wisps) { if (w.got) continue;
    if (w.drop) { w.t += dt; w.x += w.vx * dt; w.y += w.vy * dt; w.vx *= Math.exp(-dt * 2.5); w.vy *= Math.exp(-dt * 2.5); if (sdf(w.x, w.y) < .3) { const n = grad(w.x, w.y); w.x += n.x * .05; w.y += n.y * .05; w.vx *= -.3; w.vy *= -.3; } if (w.t < .5) continue; }
    if (w.fog != null && !L.fog[w.fog].cleared) continue;
    if (hyp(p.x - w.x, p.y - w.y) < .85) { w.got = 1; S.got++; SFX("wisp", S.got); fx("spark", w.x, w.y, 8); } }
  for (const w of L.abilityWisps) { if (w.got) { if (S.ab !== w.ab) { w.rt += dt; if (w.rt > 4) { w.got = 0; w.rt = 0; } } continue; }
    if (hyp(p.x - w.x, p.y - w.y) < .95) { w.got = 1; w.rt = 0; const prev = S.ab; S.ab = w.ab; p.drill = 0; p.slam = 0; SFX("ability", w.ab); fx("spark", w.x, w.y, 16); ON("ability", w.ab, prev); } }
  for (const g of L.gems) if (!g.got && hyp(p.x - g.x, p.y - g.y) < .9) { g.got = 1; S.gems++; SFX("gem"); fx("spark", g.x, g.y, 14); ON("hint", `找到隐藏的蓝绒球！（${S.gems}/${S.gemTotal}）`, 2400); }
  // minecart boarding
  const C = S.cart; if (C && C.st === "park" && !p.inCart) { const q = railAt(L.rail, C.s); C.x = q.x; C.y = q.y - .42; C.ang = 0; if (hyp(p.x - C.x, p.y - C.y) < 1.2) { p.inCart = true; C.st = "ride"; C.v = 3; p.drill = 0; SFX("clunk"); } }
  // icicles
  for (const i of L.icicles) { i.t += dt;
    if (i.st === "hang" && Math.abs(p.x - i.x) < 1.4 && p.y > i.y && p.y - i.y < 4.5) { i.st = "shake"; i.t = 0; SFX("crack"); }
    else if (i.st === "shake" && i.t > .42) { i.st = "fall"; i.vy = 0; }
    else if (i.st === "fall") { i.vy += 40 * dt; i.fy += i.vy * dt; if (hyp(p.x - i.x, p.y - (i.fy + .5)) < .75) hurt(Math.sign(p.x - i.x) || 1, "icicle"); if (sdf(i.x, i.fy + 1) < 0) { i.st = "gone"; i.t = 0; SFX("shatter"); fx("ice", i.x, i.fy + .9, 10); } }
    else if (i.st === "gone" && i.t > 3.5 && Math.abs(p.x - i.x) > 2) { i.st = "hang"; i.fy = i.y; } }
  // spike balls
  for (const sp of L.spikes) { sp.t += dt; const near = hyp(p.x - sp.x, p.y - sp.y) < 14;
    if (sp.t > sp.every && near) { sp.t = 0; sp.balls.push({ x: sp.x, y: sp.y, vx: sp.dir * 1.5, vy: 0, life: 0, rot: 0 }); }
    for (const b of sp.balls) { b.life += dt; const k = 4, hh = dt / k;
      for (let s = 0; s < k; s++) { b.vy += 30 * hh; b.x += b.vx * hh; b.y += b.vy * hh; const d = sdf(b.x, b.y); if (d < .4) { const n = grad(b.x, b.y); b.x += n.x * (.4 - d); b.y += n.y * (.4 - d); const vn = b.vx * n.x + b.vy * n.y; if (vn < 0) { b.vx -= n.x * vn * 1.15; b.vy -= n.y * vn * 1.15; } b.vx += (-n.y * 0 + n.x) * 0; b.onG = 1; } }
      b.vx = clamp(b.vx, -5.5, 5.5); b.rot += b.vx * dt / .4;
      if (hyp(p.x - b.x, p.y - b.y) < .8) { hurt(Math.sign(p.x - b.x) || sp.dir, "spike"); }
      if (b.life > sp.life || b.y > sp.y + 7) { b.dead = 1; fx("dust", b.x, b.y, 5); } }
    sp.balls = sp.balls.filter(b => !b.dead); }
  // sleepy mushrooms
  for (const m of L.shrooms) { m.stun = Math.max(0, m.stun - dt); const u = ((t + m.phase) % m.period + m.period) % m.period, P = m.period;
    const st = m.stun > 0 ? "sleep" : u < P - 1.1 ? "sleep" : u < P - .35 ? "inhale" : "sneeze"; if (st === "sneeze" && m.st !== "sneeze") { SFX("sneeze"); for (let i = 0; i < 10; i++) S.fx.push({ k: "spore", x: m.x + m.face * .6, y: m.y - .8, vx: m.face * (3 + Math.random() * 3), vy: (Math.random() - .5) * 2, t: 0, r: 0 }); }
    m.st = st; m.sq = st === "inhale" ? (u - (P - 1.1)) / .75 : st === "sneeze" ? -.4 : m.sq * .9;
    const dx = (p.x - m.x) * m.face, dy = p.y - (m.y - .7);
    if (st === "sneeze" && dx > .3 && dx < 3.8 && Math.abs(dy) < 1.4) hurt(m.face, "sneeze");
    if (hyp(p.x - m.x, p.y - (m.y - .75)) < 1.05) { if (p.vy > 0 && p.y < m.y - 1.1) { p.vy = -11; p.ground = null; p.jumping0 = true; m.sq = -.6; SFX("boing"); } else if (p.hurt <= 0) hurt(Math.sign(p.x - m.x) || 1, "shroom"); } }
  // shadow crows (only stir while you're in the dark)
  const dark = S.zone && S.zone.dark;
  for (const c of L.crows) { c.t += dt; const dx = p.x - c.x, dy = p.y - c.y, d = hyp(dx, dy);
    if (c.st === "perch") { c.x = lerp(c.x, c.hx, dt * 3); c.y = lerp(c.y, c.hy, dt * 3); if (dark && d < 7 && !p.inCart) { c.st = "stalk"; c.t = 0; SFX("caw"); } }
    else if (c.st === "stalk") { c.ang += dt * 1.3; const tx = p.x + Math.cos(c.ang) * 3.6, ty = p.y - 2 + Math.sin(c.ang) * 1.2; c.x = lerp(c.x, tx, dt * 2.2); c.y = lerp(c.y, ty, dt * 2.2); if (c.t > 2.4) { c.st = "dive"; c.t = 0; c.vx = dx / (d || 1) * 8.5; c.vy = dy / (d || 1) * 8.5; SFX("caw"); } if (d > 12) c.st = "perch"; }
    else if (c.st === "dive") { const slow = lamp && d < PH.lampR ? .45 : 1; c.x += c.vx * dt * slow; c.y += c.vy * dt * slow; if (d < .75) { hurt(Math.sign(c.vx) || 1, "crow"); c.st = "stalk"; c.t = 0; } if (c.t > .9) { c.st = "stalk"; c.t = 0; } }
    else if (c.st === "flee") { c.x += (c.x - p.x > 0 ? 1 : -1) * 7 * dt; c.y -= 6 * dt; if (c.t > 1.3) { c.st = "rest"; c.t = 0; c.x = c.hx; c.y = c.hy - 6; } }
    else if (c.st === "rest") { c.x = lerp(c.x, c.hx, dt * 2); c.y = lerp(c.y, c.hy, dt * 2); if (c.t > 7) { c.st = "perch"; c.t = 0; } } }
  // light-thief
  for (const th of L.thieves) { th.t += dt; const dx = p.x - th.x, d = hyp(dx, p.y - (th.fy - .4));
    if (th.st === "idle") { th.x += Math.sin(th.t * .8) * dt * 1.2; if (d < 5.5 && S.got > 0 && !p.inCart) { th.st = "steal"; th.t = 0; SFX("sneak"); } }
    else if (th.st === "steal") { th.face = Math.sign(dx) || 1; th.x += th.face * 5.2 * dt; if (d < .9) { if (S.got > 0) { S.got--; th.carry = 1; S.stats.steals++; SFX("steal"); ON("hint", "光点被偷了！追上去拿回来", 2200); } th.st = "flee"; th.t = 0; } if (th.t > 3) { th.st = "idle"; } }
    else if (th.st === "flee") { const away = -(Math.sign(dx) || 1); th.face = away; th.x += away * 5.6 * dt;
      if ((th.x <= th.x0 + .3 || th.x >= th.x1 - .3) && d < 2.4 && th.vy === 0 && th.y >= th.fy) { th.vy = -11; th.jx = -away * 7.5; SFX("jumpsmall"); }
      if (d < .95 && th.carry) { th.carry = 0; S.got++; SFX("wisp", S.got); fx("spark", th.x, th.y - .4, 10); ON("hint", "拿回来啦！", 1400); th.st = "dizzy"; th.t = 0; } }
    else if (th.st === "dizzy") { if (th.t > 2.5) { th.st = "sulk"; th.t = 0; } }
    else if (th.st === "sulk") { if (th.t > 9) { th.st = "idle"; th.t = 0; } }
    if (th.vy !== 0 || th.y < th.fy) { th.vy += 30 * dt; th.y += th.vy * dt; th.x += (th.jx || 0) * dt; if (th.y >= th.fy) { th.y = th.fy; th.vy = 0; th.jx = 0; } }
    th.x = clamp(th.x, th.x0, th.x1); }
  // boss + fog
  for (const f of L.fog) f.a = clamp(f.a + (f.cleared ? -dt * .9 : dt), 0, 1);
  const B = S.boss; if (B) { B.t += dt; B.hurtT = Math.max(0, B.hurtT - dt);
    if (B.dead) { B.popT += dt; }
    else { const inArena = p.y < 9 && p.x > 55;
      B.inv = Math.max(0, B.inv - dt);
      const allClear = L.fog.every(f => f.cleared), PER = [[B.hx, B.hy], [B.hx - 4.7, B.hy + 2.3], [B.hx + 6, B.hy + 4]];
      const tx = (allClear ? PER[B.perch][0] : B.hx) + Math.sin(B.t * .5) * (allClear ? .8 : 2), ty = (allClear ? PER[B.perch][1] : B.hy) + Math.sin(B.t * .9) * .5;
      const k = 1 - Math.exp(-dt * 2.2); B.x += (tx - B.x) * k; B.y += (ty - B.y) * k;
      if (inArena && S.ab === "bell") { B.puffT -= dt; if (B.puffT <= 0) { B.puffT = 3.4 - B.hits * .3 - (3 - B.hp) * .35; const a = Math.atan2(p.y - B.y, p.x - B.x); B.puffs.push({ x: B.x + Math.cos(a) * 1.4, y: B.y + Math.sin(a) * 1.4, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, t: 0 }); SFX("fogpuff"); } } }
    for (const f of B.puffs) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (hyp(f.x - p.x, f.y - p.y) < .9) { f.dead = 1; if (p.hurt <= 0) { const k = S.got; hurt(Math.sign(f.vx) || 1, "fog"); } } if (f.t > 5) f.dead = 1; }
    B.puffs = B.puffs.filter(f => !f.dead); }
  for (const b of L.bells) b.sw = Math.max(0, b.sw - dt * .6);
  // goal
  if (!S.done && L.goal && inR(L.goal.box, p.x, p.y) && (!B || B.dead)) { S.done = true; SFX("goal"); ON("goal"); }
  if (S.flare) { S.flare.t += dt; if (S.flare.t > .7) S.flare = null; }
  if (S.ring) { S.ring.t += dt; if (S.ring.t > .6) S.ring = null; }
  // trailing wisps (follow chain, for the "lights behind you")
  const nF = Math.min(S.got, 7); while (S.follow.length < nF) S.follow.push({ x: p.x, y: p.y }); S.follow.length = nF;
  let px = p.x - p.face * .3, py = p.y - .2; for (const f of S.follow) { const k = 1 - Math.exp(-dt * 9); f.x = lerp(f.x, px, k); f.y = lerp(f.y, py, k); px = f.x - p.face * .1; py = f.y; }
  // fx
  for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === "ice" || f.k === "soil" || f.k === "chip") f.vy += 18 * dt; if (f.k === "spore" || f.k === "wind" || f.k === "cloud") { f.vx *= Math.exp(-dt * 1.5); f.vy *= Math.exp(-dt * 1.5); }
    const life = { dust: .6, spark: .6, puff: .5, ring: .5, soil: .8, ice: 1, spore: 1.1, wind: 1.4, cloud: 1.8, fluff: 1.2 }[f.k] || .8; if (f.t > life) S.fx.splice(i, 1); }
}
TR.sdShape = sdShape; TR.GRID = { CS, GX, GY, GW, GH };
TR.sim = { sdf: (x, y, d) => sdf(x, y, d), grad, railAt, hurt, platOn };
})(typeof window !== "undefined" ? window : globalThis);
