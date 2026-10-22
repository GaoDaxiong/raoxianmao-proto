// v6.1 browser tests: everything through REAL CDP touch events (no in-page botDrive).
const { chromium } = require('playwright-core');
const SH = process.env.SH || '/workspace/letter-game/proto/shots_v6/', BASE = process.env.BASE || 'http://127.0.0.1:8766/?v=6.1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const only = process.argv[2] || 'all';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200); const cdp = await ctx.newCDPSession(p);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => __game.start()); await sleep(400);
  const btn = await ev(() => __game.btnPos()); const J = btn[0], A = btn[1];
  const base = { x: 160, y: 300 };
  // touch helper: id1 stick, id2 jump, id3 action
  const T = { stick: false, jump: false };
  async function touches(type, list) { const tp = []; for (const [id, q] of list) { const c = await ev(([x, y]) => __game.toClient(x, y), [q.x, q.y]); tp.push({ x: c.x, y: c.y, id, radiusX: 6, radiusY: 6 }); } await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: tp }); }
  const cur = new Map();
  async function down(id, q) { cur.set(id, q); await touches('touchStart', [...cur]); }
  async function move(id, q) { cur.set(id, q); await touches('touchMove', [...cur]); }
  async function up(id) { const q = cur.get(id); if (!q) return; cur.delete(id); const c = await ev(([x, y]) => __game.toClient(x, y), [q.x, q.y]); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: c.x, y: c.y, id }] }); }
  async function stick(x) { if (!cur.has(1)) await down(1, { ...base }); await move(1, { x: base.x + x * 55, y: base.y }); }
  async function jump(on) { if (on && !cur.has(2)) await down(2, { x: J.x + 6, y: J.y - 4 }); else if (!on && cur.has(2)) await up(2); }
  async function tapAct() { await down(3, { x: A.x, y: A.y }); await sleep(35); await up(3); }
  async function releaseAll() { for (const id of [...cur.keys()]) await up(id); }
  const state = () => ev(() => { const s = __game.S, p = s.p; return { m: __game.G.mode, x: p.x, y: p.y, g: !!p.ground, gk: p.ground && p.ground.kind, vy: p.vy, ab: s.ab, z: s.zone && s.zone.name, t: s.t, fog: s.L.fog.filter(f => f.cleared).length, dead: s.boss && s.boss.dead, carry: !!p.carry, carries: s.rs.carries, arrow: s.rs.arrow, cart: p.inCart, done: s.done, got: s.got, cool: p.cool, plan: __game.botPlan() }; });
  const R = {};
  // ===== 1. the user's stuck spot: summit floor with bell ears, short taps only =====
  if (only === 'all' || only === 'spot') {
    await ev(() => __game.teleport(79.3, 7.9, 'bell')); await sleep(900);
    await p.screenshot({ path: SH + '17-v61-summit-before-ring.png' });
    let s = await state(); await tapAct(); await sleep(600); s = await state();
    const rung = s.fog >= 1; await sleep(900);
    await p.screenshot({ path: SH + '18-v61-summit-steps-fixed.png' });
    // climb A,B,C,D with SHORT taps (hold <=150ms), stick toward the next step
    const steps = await ev(() => __game.S.L.plats.filter(q => q.kind === 'fog' && q.chunk === 0).map(q => ({ x0: q.x0, x1: q.x1, y: q.y })));
    let k = 0, t0 = Date.now(), taps = 0, falls = 0;
    while (Date.now() - t0 < 25000 && k < steps.length) {
      s = await state(); const q = steps[k], cx = (q.x0 + q.x1) / 2;
      if (s.g) { let on = -1; steps.forEach((r, i) => { if (Math.abs(s.y + .45 - r.y) < .1 && s.x > r.x0 - .3 && s.x < r.x1 + .3) on = i; }); if (on + 1 !== k) { k = on + 1; if (on < 0) falls++; continue; } }
      const dx = cx - s.x; await stick(Math.max(-1, Math.min(1, dx * 1.2)));
      if (s.g && Math.abs(dx) < 2.6) { await jump(true); await sleep(140); const m = await state(); await jump(false); taps++; if (process.env.DBG) console.log('tap', k, s.x.toFixed(2), s.y.toFixed(2), '-> after140', m.x.toFixed(2), m.y.toFixed(2)); for (let w = 0; w < 25; w++) { const a = await state(); await stick(Math.max(-1, Math.min(1, (cx - a.x) * 1.5))); if (a.g && w > 2) break; await sleep(20); } }
      await sleep(30);
    }
    await releaseAll(); s = await state();
    R.spot = { rung, reachedSteps: k + '/' + steps.length, taps, fellBackToFloor: falls, onStep: s.gk, y: +s.y.toFixed(2), carries: s.carries };
    console.log('USER SPOT (short taps ≤140ms):', JSON.stringify(R.spot));
    await p.screenshot({ path: SH + '19-v61-climbed-with-short-taps.png' });
  }
  // ===== 2. stuck helper: keep pushing into a wall on the summit floor =====
  if (only === 'all' || only === 'helper') {
    await ev(() => { __game.G.mode = 'start'; __game.start(); }); await sleep(400);
    await ev(() => __game.teleport(83.5, 7.9, 'bell')); await sleep(600);
    let s, t0 = Date.now(), arrowAt = null, carryAt = null;
    await stick(1);
    while (Date.now() - t0 < 30000) { s = await state(); await move(1, { x: base.x + 55 + (Date.now() % 600 < 300 ? 0 : 3), y: base.y });
      if (s.arrow && arrowAt == null) { arrowAt = (Date.now() - t0) / 1000; await sleep(200); await p.screenshot({ path: SH + '20-v61-helper-arrow.png' }); }
      if (s.carry && carryAt == null) { carryAt = (Date.now() - t0) / 1000; await sleep(500); await p.screenshot({ path: SH + '21-v61-helper-wind-to-bell.png' }); await tapAct(); }
      if (carryAt != null && !s.carry && s.fog >= 1) break; await sleep(60); }
    await releaseAll(); s = await state();
    R.helper = { arrowAfter_s: arrowAt, carryAfter_s: carryAt, fogClearedAfterTap: s.fog };
    console.log('STUCK HELPER:', JSON.stringify(R.helper));
  }
  // ===== 3. whole level, start to finish, every input a real CDP touch =====
  if (only === 'all' || only === 'full') {
    await ev(() => { __game.G.mode = 'start'; __game.start(); }); await sleep(500);
    let jDown = false, t0 = Date.now(), lastLog = 0, s;
    await stick(0);
    while (Date.now() - t0 < 400000) {
      s = await state(); if (s.m !== 'play') break;
      if (Date.now() - lastLog > 10000) { lastLog = Date.now(); console.log('  t', s.t.toFixed(1), s.z, s.x.toFixed(1), s.y.toFixed(1), 'ab', s.ab, 'carries', s.carries); }
      const pl = s.plan || { x: 0 };
      await move(1, { x: base.x + (pl.x || 0) * 55, y: base.y });
      if (pl.aq) await tapAct();
      if (pl.j) { if (!jDown) { await jump(true); jDown = true; } } else if (jDown) { await jump(false); jDown = false; }
      await sleep(8);
    }
    await releaseAll(); s = await state();
    R.full = { finished: s.m !== 'play', mode: s.m, simTime: +s.t.toFixed(1), wallTime: Math.round((Date.now() - t0) / 1000), carries: s.carries, wisps: s.got };
    console.log('FULL LEVEL via real touch:', JSON.stringify(R.full));
    if (R.full.finished) { await p.waitForFunction(() => __game.G.mode === 'word', null, { timeout: 25000 }); await sleep(1500); await p.screenshot({ path: SH + '22-v61-touch-run-reveal.png' }); }
  }
  // ===== 4. summit with a no-solver "human" policy (random wandering, follows the helper arrow, taps 铃 when it points at a bell) =====
  if (only === 'all' || only === 'human') {
    await ev(() => { __game.G.mode = 'start'; __game.start(); }); await sleep(400);
    await ev(() => __game.teleport(74, 7.9, 'bell')); await sleep(500);
    let s, t0 = Date.now(), rnd = { t: 0 }, seed = 7; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (Date.now() - t0 < 300000) {
      s = await state(); if (s.m !== 'play') break;
      if ((rnd.t -= 1) <= 0) rnd = { x: rr() * 2 - 1, j: rr() < .45, hold: 100 + rr() * 400, t: 4 + Math.floor(rr() * 20), a: rr() < .3 };
      let x = rnd.x; const Aw = s.arrow || (s.carry ? { x: s.x, y: s.y, bell: 1 } : null);
      if (Aw) x = Math.max(-1, Math.min(1, (Aw.x - s.x) * 2));
      await stick(x);
      if ((Aw && Aw.bell) || (rnd.a && rr() < .2)) await tapAct();
      if (s.g && (rnd.j || (Aw && Aw.y < s.y - .5)) && rr() < .5) { await jump(true); await sleep(rnd.hold); await jump(false); }
      await sleep(40);
    }
    await releaseAll(); s = await state();
    R.human = { finished: s.m !== 'play', simTime: +(s.t).toFixed(1), carries: s.carries, wallTime: Math.round((Date.now() - t0) / 1000) };
    console.log('SUMMIT no-solver human policy:', JSON.stringify(R.human));
  }
  console.log('console errors:', errs.length ? errs : 'none');
  await b.close();
})();
