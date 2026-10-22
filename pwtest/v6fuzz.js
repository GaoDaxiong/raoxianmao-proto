// Softlock fuzz for chapters 4-5 (and the user's stuck spot). Headless, fast.
global.TR = {}; const D = '/workspace/letter-game/proto/js/v6/';
for (const f of ['letters.js', 'route_U.js', 'sim.js', 'bot.js']) require(D + f);
TR.on = () => {};
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// starting states: [name, x, y, ability, fogCleared]
const STARTS = { full: [4.6, -6.85, null, 0], ch4: [66, 44.4, null, 0], ch4spring: [66, 44.4, 'spring', 0], summitBell: [79, 8.0, 'bell', 0], summitRung: [79, 8.0, 'bell', 1], summitNoAb: [74, 8.0, 'spring', 0], midFog: [69.6, 2.0, 'bell', 1] };
function setup(st) { const S = TR.newGame('U'); TR.botReset(); const [x, y, ab, fc] = STARTS[st]; S.p.x = x; S.p.y = y; S.ab = ab; S.t = 50;
  for (let i = 0; i < fc; i++) { S.L.fog[i].cleared = true; S.L.bells[i].rung = true; }
  // progress index = nearest checkpoint
  let bi = 0, bd = 1e9; S.route.forEach((c, i) => { const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd && c[2] <= fc) { bd = d; bi = i; } }); S.rs.i = S.rs.max = bi; return S; }
function run(st, mode, seed, maxT) {
  const R = rng(seed), S = setup(st); let held = 0, panic = 0, pin = null, lag = [], hurtT = 2 + R() * 6, rnd = { x: 0, j: 0, t: 0 };
  for (let f = 0; f < maxT * 60 && !S.done; f++) {
    let b = TR.botStep(S), inp;
    if (mode === 'solver') inp = { x: b.x, jd: b.j, jq: b.jq, aq: b.aq };
    else if (mode === 'shorthop') { held = b.j ? held + 1 / 60 : 0; inp = { x: b.x, jd: b.j && held < .16, jq: b.jq, aq: b.aq }; }
    else if (mode === 'sloppy') { // reaction lag, early releases, random panic bursts, random knockbacks
      lag.push({ x: b.x, jd: b.j, jq: b.jq, aq: b.aq }); const d = Math.floor(R() * 5); inp = lag.length > d ? lag.shift() : { x: 0 };
      if (inp.jd && R() < .01) inp.jd = false; if (R() < .002) lag.length = 0; if (R() < .004) inp.aq = true;
      if (panic > 0) { panic -= 1 / 60; if (!pin || R() < .05) pin = { x: R() * 2 - 1, jd: R() < .5, jq: R() < .1, aq: R() < .05 }; inp = pin; } else if (R() < .003) panic = 1 + R() * 3;
      hurtT -= 1 / 60; if (hurtT < 0) { hurtT = 4 + R() * 10; TR.hurt(R() < .5 ? -1 : 1, 'fuzz'); }
    } else { // 'human': no solver at all — wanders randomly, follows the helper arrow when it shows
      rnd.t -= 1 / 60; if (rnd.t <= 0) { rnd = { x: R() * 2 - 1, j: R() < .45, hold: .1 + R() * .5, t: .4 + R() * 1.6, a: R() < .25 }; rnd.jt = 0; }
      const A = S.rs.arrow || (S.p.carry && S.p.carry.bell ? { x: S.p.x, y: S.p.y, bell: 1 } : null); let x = rnd.x, jq = false, jd = false, aq = false;
      if (A) { x = Math.max(-1, Math.min(1, (A.x - S.p.x) * 2)); if (A.y < S.p.y - .5 && S.p.ground && R() < .05) jq = true; if (A.bell && R() < .08) aq = true; }
      if (rnd.j) { rnd.jt += 1 / 60; if (rnd.jt < 1 / 60 + 1e-9 && S.p.ground) jq = true; jd = rnd.jt < rnd.hold; } else if (R() < .02) jq = true;
      if (rnd.a && R() < .03) aq = true; inp = { x, jd: jd || jq, jq, aq };
    }
    TR.update(1 / 60, { x: inp.x || 0, y: 0, jd: !!inp.jd, jq: !!inp.jq, aq: !!inp.aq });
  }
  return { hurt: S.stats.hurt, fog: S.L.fog.filter(f=>f.cleared).length, hp: S.boss.hp, done: S.done, t: S.t - 50, carries: S.rs.carries, pos: [S.p.x.toFixed(1), S.p.y.toFixed(1)], ab: S.ab, cp: S.rs.i };
}
const only = process.argv[2];
const plan = [['summitBell', 'shorthop', 1], ['summitRung', 'shorthop', 1], ['summitBell', 'solver', 1], ['ch4spring', 'solver', 1], ['ch4', 'solver', 1], ['summitNoAb', 'solver', 1], ['midFog', 'shorthop', 1]];
for (const st of ['ch4', 'summitBell', 'summitRung', 'summitNoAb', 'midFog']) for (let s = 1; s <= (+process.argv[3] || 12); s++) plan.push([st, 'sloppy', s]);
for (const st of ['ch4', 'summitBell']) for (let s = 1; s <= (+process.argv[4] || 4); s++) plan.push([st, 'human', 100 + s]);
for (let s = 1; s <= (+process.argv[5] || 0); s++) { plan.push(['full', 'sloppy', 200 + s]); plan.push(['full', 'human', 300 + s]); }
let fail = 0; const sum = {};
for (const [st, mode, seed] of plan) { if (only && only !== 'all' && mode !== only) continue;
  const r = run(st, mode, seed, st === 'full' ? 3000 : mode === 'human' ? 1500 : 400); const k = st + '/' + mode; sum[k] = sum[k] || { n: 0, ok: 0, t: [], c: [] }; sum[k].n++; if (r.done) sum[k].ok++; else { fail++; console.log('FAIL', k, seed, JSON.stringify(r)); } sum[k].t.push(r.t); sum[k].c.push(r.carries); }
for (const [k, v] of Object.entries(sum)) console.log(k.padEnd(24), `${v.ok}/${v.n} finished`, 'time(s)', Math.round(Math.min(...v.t)) + '–' + Math.round(Math.max(...v.t)), 'carries', Math.min(...v.c) + '–' + Math.max(...v.c));
console.log(fail ? `FAILURES: ${fail}` : 'ALL FINISHED');
