// 团绒 v6 — route bot for tests/attract: picks the furthest route node whose region contains 团绒 and returns stick/button intent.
// Output: { x: -1..1 stick, j: hold jump, jq: new jump press, aq: action press }. Decisions use sim time so it works at any poll rate.
(function (root) {
"use strict";
const TR = root.TR;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), hyp = Math.hypot;
let B = { lastJq: -9, lastAq: -9, prevJ: false, mem: {} };
TR.botReset = () => { B = { lastJq: -9, lastAq: -9, prevJ: false, mem: {} }; };
let S, p, o;
const go = (tx, tol, gain) => { const dx = tx - p.x; o.x = Math.abs(dx) < (tol || .12) ? 0 : clamp(dx * (gain || 1.6), -1, 1); return Math.abs(dx) < (tol || .12) + .1; };
const jump = () => { o.j = true; if (S.t - B.lastJq > .28 && (p.ground || p.coyote > 0 || p.inCart)) { o.jq = true; B.lastJq = S.t; } };
const act = () => { if (S.t - B.lastAq > .32 && p.cool <= 0) { o.aq = true; B.lastAq = S.t; } };
const hold = () => { o.j = true; };
const up = () => { if (!p.ground && p.vy < 0) o.j = true; }; // keep holding during the rise for full jump height
const mod = (a, m) => ((a % m) + m) % m;
const plat = (x0, y) => S.L.plats.find(q => Math.abs(q.x0 - x0) < .05 && Math.abs(q.y - y) < .05);
const onPlat = q => p.ground === q;
const flatLeft = q => { const u = mod(S.t + q.phase, q.period); return q.period - .8 - u; }; // seconds of flat time left (negative = flipped)
const N = [];
const node = (id, r, f, c) => N.push({ id, r, f, c });
// ---- forest canyon ----
node("start", [-3, -12, 19, 1.4], () => { go(10.5); });
node("F2", [2, -1, 18, 2.4], () => { if (S.ab !== "drill") { go(14.6); return; } if (go(6, .4) && p.ground) act(); });
node("F3", [2, 3, 17.5, 6.6], () => { // pass the sleepy mushroom
  const m = S.L.shrooms[0], u = mod(S.t + m.phase, m.period);
  if (p.x < 7.4 && p.ground) { if (u < 1.2 || m.stun > 0) { go(16); } else { o.x = 0; if (p.x > 6.4) go(6); } return; }
  go(15.6); if (p.ground && p.x > 8.4 && p.x < 9.6) jump(); up();
});
node("F4", [2.5, 7.6, 17.5, 11], () => {
  if (!B.mem.room1) { if (S.L.gems[0].got) { B.mem.room1 = 1; } else { go(-4); if (p.ground && p.x < 9.4 && p.x > 8.6 && p.vx < 0) {} return; } }
  if (p.x < 11.5) { go(12.5); return; } if (p.ground) act(); go(13);
});
node("room1", [-6, 7.6, 3.2, 11.2], () => { if (!S.L.gems[0].got) go(-4); else { B.mem.room1 = 1; go(12.5); } });
node("F5", [2.5, 12.4, 17.5, 19], () => {
  const balls = S.L.spikes[0].balls; let danger = false;
  for (const b of balls) { const dx = p.x - b.x; if (dx > -.3 && dx < 2.6 && Math.abs(b.y - p.y) < 1.4) danger = true; }
  if (p.x < 5.4 && p.ground) { act(); o.x = 0; return; }
  go(4.4, .3); if (danger && p.ground) jump(); up();
});
node("F6", [2.5, 19, 17.5, 26.8], () => {
  const P1 = plat(7.3, 23), u = mod(S.t, 3.2);
  if (p.ground && p.y < 24.7 && p.x > 14.9) { act(); go(16); return; }
  if (p.ground && p.x < 6.6 && !p.ground.kind) { if (u > .3 && u < 1.2) go(16); else go(5.6, .2); return; } // wait for the flip wave, then just run
  if (p.ground) { go(16); return; }
  if (p.y > 25 && p.x < 15) { const P = [plat(12.9, 24), plat(10.1, 23.5), P1].find(q => flatLeft(q) > .6 && Math.abs((q.x0 + q.x1) / 2 - p.x) < 3.5); go(P ? (P.x0 + P.x1) / 2 : 4.5); return; }
  go(p.y < 22.6 ? 5 : 16);
});
// ---- glow cave ----
node("C1", [3, 26.8, 17.5, 36.5], () => {
  if (S.ab !== "lamp") { go(15.6); return; }
  const P = [plat(10, 33.6), plat(7, 33.4), plat(4, 33.6)];
  if (p.ground && !p.ground.kind) { go(9); if (p.x < 13.6) jump(); up(); return; }
  if (onPlat(P[0])) { go(6); if (p.x < 10.4) jump(); up(); return; }
  if (onPlat(P[1])) { go(3.6); if (p.x < 7.4) jump(); up(); return; }
  if (onPlat(P[2])) { go(3.4); return; }
  if (p.y > 34.5 && p.x > 4.8) { go(p.x > 9 ? 10.7 : p.x > 6 ? 7.7 : 4.7); return; }
  go(p.x > 11.6 ? 10.7 : p.x > 8.6 ? 7.7 : p.x > 5.6 ? 4.7 : 3.6); up();
}, () => S.p.y < 36.5);
node("C2", [2.5, 36.5, 13.1, 42.6], () => {
  const ice = S.L.solids.find(s => s.id === "ice1");
  if (p.x < 4.9 && p.y < 39) { go(3.8); return; }
  if (!ice.broken) { if (go(10.3, .3)) act(); return; }
  go(15);
});
node("C3fall", [12.4, 34.4, 17.5, 47.6], () => { go(14.6); });
node("C3", [3, 46.6, 17.5, 52.9], () => {
  const P = [plat(9.8, 49.3), plat(6.8, 50.1), plat(3.8, 50.9)];
  for (const c of S.L.crows) if ((c.st === "dive" || c.st === "stalk") && hyp(c.x - p.x, c.y - p.y) < 3.2) act();
  if (p.ground && !p.ground.kind) { go(9); if (p.x < 13.4) jump(); return; }
  if (onPlat(P[0])) { go(6); if (p.x < 10.2) jump(); return; }
  if (onPlat(P[1])) { go(3.6); if (p.x < 7.2) jump(); return; }
  if (onPlat(P[2])) { go(3.4); return; }
  if (p.y > 51.4 && p.x > 5.6) { go(p.x > 9 ? 10.5 : p.x > 6 ? 7.5 : 4.5); return; }
  go(p.x > 11.2 ? 10.5 : p.x > 8.2 ? 7.5 : p.x > 5.2 ? 4.5 : 4.1);
});
node("icePlug", [2.5, 52.9, 6, 57], () => { const ice = S.L.solids.find(s => s.id === "ice2"); go(4.1); if (!ice.broken && p.ground) act(); });
node("station", [2.5, 57, 13, 66.2], () => { go(10.2); });
node("cart", [-5, 57, 60, 92], () => {
  const C = S.cart, R = S.L.rail; if (!p.inCart) { go(10.2); return; }
  for (const [a, b] of R.sg) { if (C.s > a - .9 - C.v * .06 && C.s < a + .2 && C.hop <= 0.001) { jump(); } }
}, () => S.p.inCart || (S.cart && S.cart.st !== "done" && S.p.x < 44));
// ---- spring garden ----
node("Ga", [44, 73, 66.2, 85], () => {
  if (S.ab !== "umb") { go(56.8); return; }
  const D = S.L.buds[0], u = mod(S.t + D.phase, D.period);
  if (p.x < 59) { if ((u < D.open - .55 && D.openAmt > .5) || p.x > 58.7 && u < D.open - .2) go(62); else go(57.9, .2); return; }
  if (p.x < 61.2) { go(63.9); return; }
  const G = S.L.geysers[0];
  if (p.ground) { go(63.9, .25); if (G.on && mod(S.t + G.phase, G.period) < G.period - .9) jump(); return; }
  hold(); go(p.y < 67 ? 70 : 63.9, .25);
}, () => S.p.y > 73.5 || S.p.x < 61.5);
node("Gb", [52, 59, 80.5, 74.3], () => {
  const th = S.L.thieves[0];
  if (th.carry && !B.mem.gaveUp) { go(th.x, .1, 3); if (p.ground && th.vy < 0 && Math.abs(th.x - p.x) < 2.5) jump(); up(); if (!B.mem.chase) B.mem.chase = S.t; if (S.t - B.mem.chase > 12) B.mem.gaveUp = 1; return; }
  B.mem.chase = 0;
  if (p.y < 66 && p.x < 76.3 && !p.ground) { hold(); go(70); return; } // gliding off the geyser top
  if (p.x < 76.6 && p.y > 66) { go(78); if (p.ground && p.x > 75.6) jump(); up(); return; }
  hold(); go(p.y < 56.2 ? 74.6 : 78, .2);
});
node("Gc", [62, 46.6, 80.5, 59.8], () => {
  const D2 = S.L.buds[1], D3 = S.L.buds[2], G = S.L.geysers[1];
  if (!p.ground) { if (p.x > 76) { hold(); go(74.6); return; } if (p.x < 67.7) { hold(); go(p.y < 47 ? 70 : 65); return; } go(p.x > 72 ? 74.6 : 70.6); return; }
  if (p.x > 72) { const u = mod(S.t + D2.phase, D2.period); if (D2.openAmt > .5 && u < .55) go(65); else go(74.8, .2); return; }
  if (p.x > 67.7) { if (D3.openAmt > .5) go(65); else go(70.6, .2); return; }
  go(65, .3); if (G.on && mod(S.t + G.phase, G.period) < G.period - .8) jump();
});
// ---- windmill cliffs ----
node("T1", [62, 36.3, 78, 45.2], () => {
  if (S.ab !== "spring") { go(71.6); return; }
  if (p.ground && p.y > 44) { go(76); if (p.x > 72.8) jump(); up(); return; }
  if (p.ground && p.x > 74.4) { go(75.7, .2); if (Math.abs(p.vx) < .5) act(); return; }
  go(75.8); up();
}, () => S.p.y < 45.2 && S.p.y > 37);
node("T2", [62, 28.4, 78, 36.2], () => {
  const st = n => S.L.plats.find(q => q.kind === "stone" && q.n === n), set = S.L.stoneSets[0];
  if (set.done) { if (onPlat(st(3)) || (p.ground && p.x < 66.4)) { go(64.8, .15); if (p.ground && Math.abs(p.vx) < .8) act(); return; } if (!p.ground && p.y < 29) { go(68); return; } go(64.8, .15); if (p.ground && Math.abs(p.vx) < .8) act(); return; }
  if (set.prog === 0) { go(70.2, .3); if (p.ground && p.ground.kind === "wood" && Math.abs(p.x - 70.2) < .9) jump(); up(); return; }
  if (set.prog === 1) { go(73.2, .3); if (onPlat(st(1)) && p.x > 70.4) jump(); if (p.ground && p.ground.kind === "wood" && Math.abs(p.x - 73.2) < .8) jump(); up(); return; }
  // prog 2: go under stone 3 and super-bounce (lands on it from above)
  if (p.ground && p.x < 66.4 && p.ground.kind === "wood") { go(64.8, .15); if (Math.abs(p.vx) < .8) act(); return; }
  go(64.8, .15);
}, () => S.p.y < 36.3 && S.p.y > 28.4);
node("R3", [62, 16.2, 78, 27.2], () => {
  const P = [null, plat(69.6, 24.4), plat(73.6, 21.6), plat(68.6, 19.0)], cx = [70.6, 70.6, 74.6, 69.6, 69.4];
  if (p.ground) { B.mem.r3 = p.y > 26 ? 0 : P.indexOf(p.ground); if (B.mem.r3 < 0) B.mem.r3 = 0; }
  const i = B.mem.r3 || 0, nxt = P[i + 1], tx = cx[i + 1];
  if (p.ground) { if (i === 0 && p.x < 66.8) { go(68.5); return; } if (i > 0 && nxt && flatLeft(nxt) <= .45) { go((P[i].x0 + P[i].x1) / 2, .2); return; } go(tx, .3); const u = mod(S.t, 2.8); if ((i > 0 ? true : Math.abs(p.x - tx) < 1.5 && (u > 2.45 || u < .35)) && (!nxt || flatLeft(nxt) > .45)) jump(); up(); return; }
  go(tx, .25); up();
});
node("R4", [62, 9.9, 78, 16.2], () => {
  if (p.ground && p.ground.kind === "wood") { go(64.2, .25); if (p.x < 64.8) jump(); up(); return; }
  if (!p.ground && p.y > 13 && p.x < 66.4) { go(67); up(); return; }
  const balls = S.L.spikes[1].balls; let danger = false; for (const b of balls) { const dx = b.x - p.x; if (dx > -.2 && dx < 2.6 && Math.abs(b.y - p.y) < 1.4) danger = true; }
  const m = S.L.shrooms[1], dm = m.x - p.x;
  if (p.ground && p.x > 74.2) { go(74.6, .15); if (Math.abs(p.vx) < .8) act(); return; }
  go(74.6); if (p.ground && (danger || (dm > .6 && dm < 1.6))) jump(); up();
});
// ---- fog summit boss ----
node("arena", [55, -12, 86, 9.9], () => {
  const L = S.L, F = L.fog, bells = L.bells, Bs = S.boss;
  if (p.y > 8.7) { go(p.x > 74.8 ? 78.5 : 71); up(); return; }
  if (S.ab !== "bell") { go(79.2); return; }
  for (const f of Bs.puffs) if (hyp(f.x - p.x, f.y - p.y) < 2.4) act();
  const ringAt = (b, tx) => { if (hyp(b.x - p.x, b.y - p.y) < TR.PH.ringR) { act(); o.x = 0; return true; } go(tx, .3); return false; };
  const st = [[76.5, 6.3], [72.5, 4.1], [68.5, 1.9], [64.5, -.3], [69.5, -2.5], [66.5, -4.7], [68.4, -6.9]].map(([x, y]) => plat(x, y));
  const on = i => onPlat(st[i]), cx = i => (st[i].x0 + st[i].x1) / 2;
  const hop = (i, j, dir) => { B.mem.aT = j; go(cx(j) + dir * .4, .3); if (p.ground && Math.abs(p.x - (cx(i) + dir * .7)) < .9) jump(); up(); };
  if (!F[0].cleared) { ringAt(bells[0], 80.4); return; }
  if (p.ground && p.y > 7.5) { B.mem.aT = 0; if (p.x < 72.5) { go(66); return; } go(77.4, .3); if (p.x < 79.5 && p.x > 76) jump(); up(); return; }
  if (on(0)) { hop(0, 1, -1); return; }
  if (on(1)) { hop(1, 2, -1); return; }
  if (on(2)) { if (!F[1].cleared) { ringAt(bells[1], 69); return; } hop(2, 3, -1); return; }
  if (on(3)) { hop(3, 4, 1); return; }
  if (on(4)) { if (!F[2].cleared) { ringAt(bells[2], 71.6); return; } hop(4, 5, -1); return; }
  if (!Bs.dead && F[2].cleared && (on(4) || on(5))) { const want = Bs.perch === 2 ? 4 : 5, inRange = hyp(Bs.x - p.x, Bs.y - p.y) < TR.PH.ringR + 1.5;
    if (on(want)) { go(clamp(Bs.x, st[want].x0 + .5, st[want].x1 - .5), .4); if (inRange && Bs.inv <= 0) act(); return; }
    if (inRange && Bs.inv <= 0) { act(); return; }
    if (want === 4) { B.mem.aT = 4; go(71.5, .3); return; } hop(4, 5, -1); return; }
  if (on(5)) { if (!Bs.dead) { o.x = 0; go(68.4, .4); if (hyp(Bs.x - p.x, Bs.y - p.y) < TR.PH.ringR + 1.6) act(); return; } B.mem.aT = 6; go(70.5, .3); if (p.ground) jump(); up(); return; }
  if (on(6)) { go(70.5, .2); return; }
  // airborne or fell: steer toward the next platform up
  if (!p.ground && B.mem.aT != null && p.y < 7.6) { go(cx(B.mem.aT), .2); up(); return; }
  if (!p.ground) { let best = null; for (let i = 0; i < 7; i++) { const q = st[i]; if (!TR.platOn(q)) continue; if (q.y > p.y - .2) { if (!best || q.y < best.y) best = q; } } if (best) go((best.x0 + best.x1) / 2, .3); up(); return; }
  go(70);
});
TR.botNodes = N;
TR.botStep = function (s, peek) {
  S = s; p = S.p; o = { x: 0, y: 0, j: false, jq: false, aq: false };
  let nd = null; for (let i = N.length - 1; i >= 0; i--) { const n = N[i]; if (TR.inR(n.r, p.x, p.y) && (!n.c || n.c())) { nd = n; break; } }
  if (nd) { o.node = nd.id; nd.f(); }
  if (!peek) { if (o.j && !B.prevJ && !o.jq && (p.ground || p.coyote > 0) && S.t - B.lastJq > .28) { o.jq = true; B.lastJq = S.t; } B.prevJ = o.j; }
  return o;
};
})(typeof window !== "undefined" ? window : globalThis);
