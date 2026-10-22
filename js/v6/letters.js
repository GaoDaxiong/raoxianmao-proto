// 团绒 v6 — letter recipes. Each letter = ordered strokes; each stroke = a themed segment generator + the ear ability it teaches.
// World units: 1 ≈ 团绒's diameter. y points down. Generators write into a Builder (pure data, no DOM) so the sim can run headless.
(function (root) {
"use strict";
const TR = root.TR || (root.TR = {});

// ---------- builder ----------
function Builder() {
  const B = { air: [], solids: [], plats: [], hazards: [], winds: [], currents: [], geysers: [], buds: [], stoneSets: [], gates: [],
    rail: null, spikes: [], thieves: [], shrooms: [], crows: [], icicles: [], wisps: [], gems: [], rooms: [], bells: [], fog: [],
    boss: null, tips: [], lanterns: [], props: [], start: null, goal: null, zones: [], abilityWisps: [] };
  B.airBox = (x0, y0, x1, y1, o) => { const s = { k: "box", b: [x0, y0, x1, y1], ...(o || {}) }; B.air.push(s); return s; };
  B.airPoly = (pts, o) => { const s = { k: "poly", pts, ...(o || {}) }; B.air.push(s); return s; };
  B.box = (x0, y0, x1, y1, mat, o) => { const s = { k: "box", b: [x0, y0, x1, y1], mat: mat || "rock", ...(o || {}) }; B.solids.push(s); return s; };
  B.poly = (pts, mat, o) => { const s = { k: "poly", pts, mat: mat || "rock", ...(o || {}) }; B.solids.push(s); return s; };
  B.plat = (x0, x1, y, kind, o) => { const q = { x0, x1, y, kind: kind || "plank", ...(o || {}) }; B.plats.push(q); return q; };
  B.wisp = (x, y, ab) => { const w = { x, y, ab: ab || null }; (ab ? B.abilityWisps : B.wisps).push(w); return w; };
  B.line = (x0, y0, x1, y1, n) => { for (let i = 0; i <= n; i++) B.wisp(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); };
  B.tip = (r, text, id) => B.tips.push({ r, text, id: id || text });
  return B;
}
TR.Builder = Builder;

// ---------- segment generators (stroke pieces). o = frame origin so a piece can be re-used for other letters. ----------
const SEG = {};
// DOWN stroke, forest canyon, teaches 钻耳 (drill): soft-soil plugs, sleepy mushroom, spike-ball slope, flipping planks over brambles.
SEG.forestCanyon = (B, o) => {
  const X = v => o.x + v, Y = v => o.y + v;
  B.zones.push({ id: "forest", name: "森林峡谷", sub: "第一章", r: [X(-12), Y(-40), X(30), Y(28.5)] });
  B.airBox(X(1), Y(-30), X(19), Y(-6));                 // sky over the starting cliff
  B.airBox(X(3), Y(-8), X(17), Y(30));                  // the canyon
  B.start = { x: X(4.6), y: Y(-6.4) - .45 };
  B.box(X(-2), Y(-6.4), X(8.6), Y(-4.6), "rock", { grass: 1 });
  B.props.push({ k: "sign", x: X(2.6), y: Y(-6.4) });
  // F2: hard right half + soft plug on the left
  B.box(X(9), Y(2), X(17.5), Y(3.2)); B.box(X(2.5), Y(2), X(9.02), Y(3.6), "soft");
  B.wisp(X(14.4), Y(1.1), "drill");
  B.tip([X(9), Y(-1), X(17), Y(2)], "钻耳！站在松软的土上点「钻」，螺旋钻下去", "drill");
  // fake branch: tunnel to the right with headwind
  B.airBox(X(15.5), Y(3.4), X(27), Y(6.5)); B.winds.push({ r: [X(17), Y(3.4), X(27), Y(6.5)], vx: -12 });
  // F3: sleepy mushroom
  B.box(X(2.5), Y(6.5), X(14), Y(7.6));
  B.shrooms.push({ x: X(10.6), y: Y(6.5), face: -1, period: 3.4, phase: .6 });
  B.tip([X(3), Y(3.6), X(9), Y(6.5)], "瞌睡菇打喷嚏会把你吹飞，等它睡着再跳过去", "shroom");
  // hidden room 1 (fake wall on the left)
  B.airBox(X(-5), Y(8.6), X(4.5), Y(11)); B.rooms.push({ b: [X(-5), Y(8.6), X(3), Y(11)], wall: [X(-.6), Y(8.6), X(3), Y(11)] });
  B.gems.push({ x: X(-3.2), y: Y(10.2) }); B.wisp(X(-1.2), Y(10.2)); B.wisp(X(.6), Y(10.2));
  // F4: soft on the right (where you land), hard on the left
  B.box(X(2.5), Y(11), X(8.52), Y(12.2)); B.box(X(8.5), Y(11), X(17.5), Y(12.6), "soft");
  // F5: slope with rolling spike balls, soft at the top-left end
  B.poly([[X(6), Y(15.8)], [X(15), Y(17.6)], [X(17.5), Y(17.6)], [X(17.5), Y(19.4)], [X(6), Y(19.4)]]);
  B.poly([[X(2.5), Y(15.1)], [X(6.03), Y(15.806)], [X(6.03), Y(19.4)], [X(2.5), Y(19.4)]], "soft");
  B.spikes.push({ x: X(6.8), y: Y(15.0), every: 2.7, phase: .4, life: 6, dir: 1 });
  B.tip([X(8), Y(12.6), X(17), Y(17)], "刺栗球滚下来了！跳过它们，爬到坡顶再钻下去", "spike");
  // F6: flipping planks over a bramble bed, soft exit on the right
  B.box(X(2.5), Y(23), X(6.5), Y(24.2), "rock", { grass: 1 });
  B.plat(X(7.3), X(9.3), Y(23), "flip", { period: 3.2, phase: 0 });
  B.plat(X(10.1), X(12.1), Y(23.5), "flip", { period: 3.2, phase: -.35 });
  B.plat(X(12.9), X(14.7), Y(24.0), "flip", { period: 3.2, phase: -.7 });
  B.box(X(14.9), Y(24.6), X(17.5), Y(25.8), "soft");
  B.box(X(2.5), Y(27.4), X(15), Y(30.5)); B.hazards.push({ b: [X(2.5), Y(26.9), X(15), Y(27.6)], k: "bramble" });
  B.tip([X(2.5), Y(19.5), X(7), Y(23)], "木板会翻转——看它抖一抖就快跳！", "flip");
  // guiding wisps
  B.line(X(7), Y(-7.3), X(7.8), Y(-7.3), 1); B.line(X(10.5), Y(-2), X(11), Y(.8), 2); B.line(X(5), Y(4.5), X(6.5), Y(5.5), 1);
  B.line(X(8.5), Y(5.4), X(12.5), Y(5.4), 2); B.line(X(15.5), Y(8), X(15.5), Y(10), 2); B.line(X(12), Y(14), X(9.5), Y(14.6), 2);
  B.line(X(8), Y(20), X(5), Y(21.5), 2); B.line(X(8.3), Y(22.1), X(13.8), Y(23.1), 3); B.wisp(X(16), Y(23.6));
};
// DOWN stroke continued, glow cave, teaches 灯耳 (lamp): hidden light platforms, icicles, shadow crows, then a minecart along the bottom arc.
SEG.glowCave = (B, o) => {
  const X = v => o.x + v, Y = v => o.y + v;
  B.zones.push({ id: "cave", name: "萤光洞窟", sub: "第二章", r: [X(-12), Y(28.5), X(44), Y(100)], dark: 1 });
  B.airBox(X(3), Y(28), X(17), Y(68.5));
  // fake branch to the left
  B.airBox(X(-7), Y(31), X(4.5), Y(33.2)); B.winds.push({ r: [X(-7), Y(31), X(3), Y(33.2)], vx: 12 });
  // C1: lamp + hidden platforms over brambles
  B.box(X(13), Y(33.2), X(17.5), Y(34.4), "rock", { moss: 1 });
  B.wisp(X(15.4), Y(32.3), "lamp");
  B.tip([X(12.5), Y(29), X(17), Y(33.2)], "灯耳！发光的耳朵能照出藏在黑暗里的台阶", "lamp");
  B.box(X(4.8), Y(36.6), X(13.2), Y(39.5)); B.hazards.push({ b: [X(4.8), Y(36.1), X(13.2), Y(36.8)], k: "bramble" });
  B.plat(X(10), X(11.4), Y(33.6), "light"); B.plat(X(7), X(8.4), Y(33.4), "light"); B.plat(X(4), X(5.4), Y(33.6), "light");
  // C2: tunnel with falling icicles and an icicle curtain
  B.box(X(2.5), Y(42.5), X(13), Y(46.6));
  B.icicles.push({ x: X(7.6), y: Y(39.5) }, { x: X(9.7), y: Y(39.5) });
  B.box(X(11.2), Y(39.4), X(12.4), Y(42.55), "ice", { id: "ice1" });
  B.tip([X(5), Y(39.5), X(11), Y(42.5)], "冰柱挡路——点「灯」闪一下，把它震碎", "ice");
  // C3: hidden platforms + shadow crows, ice plug, then the mine station
  B.box(X(12.8), Y(47.5), X(17.5), Y(48.7), "rock", { moss: 1 });
  B.plat(X(9.8), X(11.2), Y(49.3), "light"); B.plat(X(6.8), X(8.2), Y(50.1), "light"); B.plat(X(3.8), X(5.2), Y(50.9), "light");
  B.box(X(5.6), Y(53.4), X(18.5), Y(56)); B.hazards.push({ b: [X(5.6), Y(52.9), X(18.5), Y(53.6)], k: "bramble" });
  B.crows.push({ x: X(8.5), y: Y(47.4) }, { x: X(14.5), y: Y(51.2) });
  B.tip([X(12.8), Y(44), X(17), Y(47.5)], "影鸦怕光！它扑过来时点「灯」吓跑它", "crow");
  B.box(X(2.5), Y(56.6), X(5.7), Y(57.6), "ice", { id: "ice2" });
  B.box(X(2.5), Y(66), X(12), Y(69.5), "rock", { moss: 1 });
  B.lanterns.push({ x: X(4.2), y: Y(64.2) }, { x: X(18), y: Y(72) }, { x: X(26), y: Y(81) }, { x: X(36), y: Y(86) }, { x: X(46), y: Y(84.5) });
  B.tip([X(3), Y(58), X(12), Y(66)], "矿车！跳上去，在断轨前按「跳」", "cart");
  // the bottom arc: carved annulus around (40,50); the rail rides it.
  const cx = X(40), cy = Y(50), ri = 24, ro = 37.5;
  for (let a = -0.05; a < 2.1; a += .15) {
    const a0 = a - .05, a1 = a + .2, P = (r, f) => [cx - r * Math.cos(f), cy + r * Math.sin(f)];
    B.airPoly([P(ri, a0), P(ro, a0), P(ro, a1), P(ri, a1)]);
  }
  const pts = [[X(8.6), Y(65.4)], [X(11), Y(65.4)], [X(12.6), Y(67.6)], [X(13.8), Y(71)]];
  for (let f = .8; f <= 1.93; f += .03) pts.push([cx - 35.5 * Math.cos(f), cy + 35.5 * Math.sin(f)]);
  B.rail = { pts, gaps: [[1.17, 1.235], [1.52, 1.585], [1.7, 1.765]].map(([a, b]) => [cx - 35.5 * Math.cos(a), cx - 35.5 * Math.cos(b)]) };
  for (const [a, b] of [[1.17, 1.235], [1.52, 1.585], [1.7, 1.765]]) for (let k = 0; k <= 2; k++) { const f = a + (b - a) * k / 2; B.wisp(cx - 33.6 * Math.cos(f), cy + 33.6 * Math.sin(f) - .6 - (k === 1 ? .4 : 0)); }
  B.line(X(15.4), Y(36.5), X(15.4), Y(40), 2); B.line(X(10.7), Y(32.4), X(4.7), Y(32.4), 2); B.line(X(4), Y(36), X(4), Y(39.5), 2);
  B.line(X(6), Y(41.6), X(10.5), Y(41.6), 2); B.line(X(14.5), Y(43.5), X(14.5), Y(46.5), 1); B.line(X(10.5), Y(48.4), X(4.5), Y(50), 2);
  B.line(X(4), Y(59), X(4), Y(63), 2);
};
// ARC (bottom-right), spring garden, teaches 伞耳 (umbrella): long glide, geysers, rhythmic flower-bud doors, rising currents, light-thief.
SEG.springGarden = (B, o) => {
  const X = v => o.x + v, Y = v => o.y + v;
  B.zones.push({ id: "garden", name: "泉水庭院", sub: "第三章", r: [X(44), Y(46), X(90), Y(100)] });
  B.airBox(X(44), Y(73), X(66), Y(84.6));                 // G-a
  B.airBox(X(52), Y(60), X(80), Y(74.2));                 // G-b
  B.airBox(X(62), Y(46), X(80), Y(61.5));                 // G-c
  B.box(X(44), Y(71.5), X(61.5), Y(74.5), "rock", { grass: 1 });
  B.box(X(59), Y(72), X(61), Y(81.6));
  B.buds.push(B.box(X(59.15), Y(81.6), X(60.85), Y(84.65), "bud", { period: 3.2, open: 1.5, phase: 0 }));
  B.wisp(X(56.6), Y(83.7), "umb");
  B.tip([X(46), Y(78), X(58), Y(84.6)], "伞耳！按住「跳」慢慢飘；点「伞」在空中冲刺", "umb");
  B.tip([X(56), Y(78), X(59), Y(84.6)], "花苞门跟着节拍开合——「叮」一声就冲过去", "bud");
  B.geysers.push({ x0: X(62.6), x1: X(65.2), base: Y(84.6), top: Y(63.2), period: 3.6, phase: 0, erupt: 1.7 });
  B.tip([X(61), Y(76), X(66), Y(84.6)], "间歇泉喷发时站上去，按住「跳」乘着水柱上升", "geyser");
  // hidden room 2
  B.airBox(X(43), Y(64), X(53.5), Y(71.6)); B.rooms.push({ b: [X(43), Y(64), X(52), Y(71.6)], wall: [X(50.6), Y(64), X(52), Y(71.5)] });
  B.gems.push({ x: X(45.5), y: Y(70.8) }); B.wisp(X(47.5), Y(70.8)); B.wisp(X(49.3), Y(70.8));
  // G-b: thief on the right floor, rising current in the right pocket
  B.thieves.push({ x: X(72), y: Y(74.2), x0: X(66.6), x1: X(75.6) });
  B.tip([X(65.5), Y(66), X(73), Y(74.2)], "偷光小狸会叼走你身后的光点，追上它就能拿回来", "thief");
  B.box(X(56), Y(59.5), X(76.2), Y(62.5), "rock", { grass: 1 });
  B.box(X(73.6), Y(46.5), X(80.5), Y(53));
  B.currents.push({ r: [X(76.4), Y(53.4), X(79.6), Y(74.2)], vx: 0, vy: -8.5 });
  B.tip([X(74), Y(66), X(79.6), Y(74.2)], "风柱！张开伞耳（按住「跳」）就能乘风上去", "current");
  // G-c: two quick bud doors in a row, then a geyser up into the tower
  B.box(X(72.2), Y(46.5), X(73.6), Y(57)); B.buds.push(B.box(X(72.3), Y(57), X(73.5), Y(59.55), "bud", { period: 2.4, open: 1.1, phase: 0 }));
  B.box(X(67.6), Y(46.5), X(69), Y(57)); B.buds.push(B.box(X(67.7), Y(57), X(68.9), Y(59.55), "bud", { period: 2.4, open: 1.1, phase: -.8 }));
  B.geysers.push({ x0: X(63.4), x1: X(66.6), base: Y(59.5), top: Y(40.6), period: 3.0, phase: .4, erupt: 1.5 });
  B.line(X(52), Y(82.6), X(55.5), Y(82.6), 2); B.line(X(62.2), Y(83.6), X(63.9), Y(80), 1); B.line(X(63.9), Y(77), X(63.9), Y(67), 3);
  B.line(X(67), Y(71), X(71), Y(73.3), 2); B.line(X(78), Y(70), X(78), Y(57), 4); B.line(X(75), Y(58.6), X(70.8), Y(58.6), 2);
  B.line(X(65), Y(55.5), X(65), Y(48), 3);
};
// UP stroke, windmill cliffs, teaches 弹耳 (spring): high jumps, slam-bounce, ordered stepping stones, flip planks, spike ramp.
SEG.windmillCliffs = (B, o) => {
  const X = v => o.x + v, Y = v => o.y + v;
  B.zones.push({ id: "windmill", name: "风车山巅", sub: "第四章", r: [X(50), Y(8.5), X(95), Y(46)] });
  B.airBox(X(63), Y(-3.5), X(77), Y(52));
  B.plat(X(63), X(77), Y(45), "wood");
  B.wisp(X(71.6), Y(44.1), "spring");
  B.tip([X(66), Y(40), X(77), Y(45)], "弹耳！跳得更高；空中点「弹」砸下去，再高高弹起", "spring");
  B.box(X(74.4), Y(41.9), X(77.5), Y(42.9), "rock", { grass: 1 });
  B.plat(X(63), X(77), Y(36), "wood");
  // ordered stepping stones open the stone hatch above
  const set = { id: "s1", n: 3, prog: 0, gate: "g1" }; B.stoneSets.push(set);
  B.plat(X(69.4), X(71), Y(34.2), "stone", { set: "s1", n: 1 });
  B.plat(X(72.4), X(74), Y(32.2), "stone", { set: "s1", n: 2 });
  B.plat(X(64), X(65.6), Y(31.4), "stone", { set: "s1", n: 3 });
  B.tip([X(63), Y(31), X(77), Y(36)], "发光石：按 ●→●●→●●● 的顺序踩，石门就开", "stone");
  B.box(X(66.6), Y(27), X(77.5), Y(28.4), "rock", { grass: 1 });
  B.gates.push(B.box(X(62.5), Y(27.1), X(66.62), Y(28.3), "gate", { id: "g1" }));
  // windmill sails as flipping planks
  B.plat(X(69.6), X(71.6), Y(24.4), "flip", { period: 2.8, phase: 0 });
  B.plat(X(73.6), X(75.6), Y(21.6), "flip", { period: 2.8, phase: -.9 });
  B.plat(X(68.6), X(70.6), Y(19.0), "flip", { period: 2.8, phase: -1.8 });
  B.plat(X(63), X(77), Y(16), "wood");
  // spike ramp + sneezy mushroom at the top, hole to the summit on the right
  B.poly([[X(65.5), Y(13.6)], [X(75.2), Y(11.6)], [X(75.2), Y(12.5)], [X(65.5), Y(14.5)]]);
  B.spikes.push({ x: X(74.6), y: Y(11.0), every: 2.4, phase: 0, life: 5, dir: -1 });
  B.shrooms.push({ x: X(69.5), y: Y(12.78), face: -1, period: 3.0, phase: 1.6 });
  B.box(X(62.5), Y(8.5), X(72.5), Y(10)); B.box(X(77), Y(8.5), X(90), Y(10.5));
  B.airBox(X(75.5), Y(13.8), X(87), Y(16)); B.winds.push({ r: [X(77), Y(13.8), X(87), Y(16)], vx: -12 });
  B.airBox(X(55), Y(12.6), X(64.5), Y(16)); B.rooms.push({ b: [X(55), Y(12.6), X(63), Y(16)], wall: [X(61.2), Y(12.6), X(63), Y(16)] });
  B.gems.push({ x: X(57), y: Y(15.3) }); B.wisp(X(59), Y(15.3)); B.wisp(X(60.6), Y(15.3));
  B.props.push({ k: "windmill", x: X(84), y: Y(30), s: 1 }, { k: "windmill", x: X(58), y: Y(22), s: .8 });
  B.line(X(75.5), Y(40.5), X(75.5), Y(37.4), 2); B.wisp(X(70.2), Y(33.2)); B.wisp(X(73.2), Y(31.2)); B.wisp(X(64.8), Y(30.4));
  B.line(X(64.8), Y(28.5), X(64.8), Y(26), 1); B.wisp(X(70.6), Y(23.4)); B.wisp(X(74.6), Y(20.6)); B.wisp(X(69.6), Y(18));
  B.line(X(67), Y(12.4), X(73.5), Y(11.1), 3); B.line(X(74.8), Y(10.6), X(74.8), Y(8), 1);
};
// TOP of the up stroke, cloud courtyard boss: the Big Fog Monster hides the end of the stroke; wind-bells blow the fog away.
SEG.fogSummit = (B, o) => {
  const X = v => o.x + v, Y = v => o.y + v;
  B.zones.push({ id: "summit", name: "云顶庭院", sub: "终章", r: [X(50), Y(-40), X(95), Y(8.5)] });
  B.airBox(X(55), Y(-24), X(85), Y(8.5));
  B.plat(X(72.4), X(77.1), Y(8.5), "cloud"); // one-way cloud lid: bounce up through it, never fall back down
  B.wisp(X(79), Y(7.7), "bell");
  B.tip([X(72), Y(3), X(84), Y(8.5)], "铃耳！点「铃」摇响风铃，把大雾怪的雾吹散", "bell");
  B.fog.push({ b: [X(61), Y(.6), X(79.5), Y(6.8)] }, { b: [X(61), Y(-4.4), X(79.5), Y(.6)] }, { b: [X(61), Y(-12), X(79.5), Y(-4.4)] });
  B.bells.push({ x: X(81.4), y: Y(6.4), chunk: 0 }, { x: X(66), y: Y(.7), chunk: 1 }, { x: X(74.2), y: Y(-3.4), chunk: 2 });
  B.plat(X(76.5), X(79), Y(6.3), "fog", { chunk: 0 }); B.plat(X(72.5), X(75), Y(4.1), "fog", { chunk: 0 }); B.plat(X(68.5), X(71), Y(1.9), "fog", { chunk: 0 });
  B.plat(X(64.5), X(67), Y(-.3), "fog", { chunk: 1 }); B.plat(X(69.5), X(72), Y(-2.5), "fog", { chunk: 1 });
  B.plat(X(66.5), X(69), Y(-4.7), "fog", { chunk: 2 });
  B.plat(X(68.4), X(72.6), Y(-6.9), "nest", { chunk: 3 });
  B.boss = { x: X(69.5), y: Y(-8.8), hx: X(69.5), hy: Y(-8.8) };
  B.goal = { x: X(70.5), y: Y(-7.35), box: [X(68.4), Y(-10), X(72.6), Y(-6.85)] };
  B.props.push({ k: "pillar", x: X(57.5), y: Y(8.5) }, { k: "pillar", x: X(83), y: Y(8.5) }, { k: "post", x: X(81.4), y: Y(8.5) });
  for (let c = 0; c < 3; c++) B.fog[c].wisps = [];
  const fw = (c, x, y) => { const w = B.wisp(x, y); w.fog = c; };
  fw(0, X(77.8), Y(5.3)); fw(0, X(73.8), Y(3.1)); fw(0, X(69.8), Y(.9)); fw(1, X(65.8), Y(-1.3)); fw(1, X(70.8), Y(-3.5)); fw(2, X(67.8), Y(-5.7));
};
// stubs used by the I / L recipes (layout only, not tuned yet)
SEG.longGlide = (B, o) => { const X = v => o.x + v, Y = v => o.y + v; B.zones.push({ id: "glide", name: "长风原野", sub: "", r: [X(0), Y(-10), X(70), Y(14)] }); B.airBox(X(0), Y(-10), X(70), Y(8)); B.box(X(0), Y(8), X(70), Y(10), "rock", { grass: 1 }); };

// ---------- letter recipes: stroke -> segment generator + theme + ability ----------
TR.LETTERS = {
  U: { playable: true, size: [72, 95],
    strokes: [
      { dir: "down", path: [[10, -7], [10, 50]], segs: [{ gen: "forestCanyon", theme: "forest", ability: "drill" }, { gen: "glowCave", theme: "cave", ability: "lamp" }] },
      { dir: "arc", path: [[10, 50], [40, 85], [70, 50]], segs: [{ gen: "glowCave", theme: "cave", ability: "lamp", part: "minecart" }, { gen: "springGarden", theme: "garden", ability: "umb" }] },
      { dir: "up", path: [[70, 50], [70, -7]], segs: [{ gen: "windmillCliffs", theme: "windmill", ability: "spring" }, { gen: "fogSummit", theme: "summit", ability: "bell", boss: "fog" }] },
    ] },
  I: { playable: false, note: "drill-heavy: one long down stroke",
    strokes: [{ dir: "down", path: [[10, -7], [10, 80]], segs: [{ gen: "forestCanyon", theme: "forest", ability: "drill" }, { gen: "glowCave", theme: "cave", ability: "drill" }] }] },
  L: { playable: false, note: "drill down, then a long umbrella glide to the right",
    strokes: [{ dir: "down", path: [[10, -7], [10, 60]], segs: [{ gen: "forestCanyon", theme: "forest", ability: "drill" }] },
      { dir: "right", path: [[10, 60], [70, 60]], segs: [{ gen: "longGlide", theme: "glide", ability: "umb" }] }] },
};
TR.SEG = SEG;
TR.buildLevel = function (letter) {
  const R = TR.LETTERS[letter || "U"]; if (!R || !R.playable) throw new Error("letter not playable yet: " + letter);
  const B = Builder(), done = new Set();
  for (const s of R.strokes) for (const g of s.segs) { if (done.has(g.gen)) continue; done.add(g.gen); SEG[g.gen](B, { x: 0, y: 0 }); }
  B.letter = letter || "U"; return B;
};
})(typeof window !== "undefined" ? window : globalThis);
