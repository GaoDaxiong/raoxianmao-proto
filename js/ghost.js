// 南瓜灯小幽灵 v3 — procedural cel-shaded pumpkin-hat ghost + jack-o'-lantern + ember thread. Extends ART.
(() => {
"use strict";
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const { ell, spr, SPR } = ART;
function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function radial(stops, size = 128) { const c = cv(size, size), g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; }
SPR.lamp = radial([[0, "rgba(255,170,90,.8)"], [0.25, "rgba(255,140,70,.45)"], [0.6, "rgba(240,110,50,.12)"], [1, "rgba(230,100,40,0)"]]);
SPR.flame = radial([[0, "rgba(255,250,215,1)"], [0.18, "rgba(255,214,120,.85)"], [0.45, "rgba(255,150,50,.32)"], [1, "rgba(255,110,30,0)"]]);
SPR.pool = radial([[0, "rgba(255,170,70,.95)"], [0.3, "rgba(255,150,60,.6)"], [0.65, "rgba(255,130,50,.2)"], [1, "rgba(255,120,40,0)"]]);
SPR.halo = radial([[0, "rgba(255,248,232,.85)"], [0.45, "rgba(255,240,220,.3)"], [1, "rgba(255,236,210,0)"]]);
SPR.ember = radial([[0, "rgba(255,240,190,1)"], [0.25, "rgba(255,180,80,.75)"], [0.6, "rgba(255,120,40,.2)"], [1, "rgba(255,100,30,0)"]], 64);

const C = { base: "#fdf7ec", shade: "#f1e4d6", deep: "#e3d0c1", lite: "#fffefa", edge: "rgba(186,138,112,.5)", cheek: "rgba(246,140,120,.32)",
  eye: "#2a150d", iris: "#9a5228", iris2: "#e09a50", mouth: "#6c2416", tongue: "#f07c74",
  pk: "#f38b2f", pkL: "#ffb860", pkD: "#cc5e1e", pkDD: "#9e4417", stem: "#6b4a2a", leaf: "#6f9c3f", leafL: "#9cc35a",
  brass: "#c98c3c", brassL: "#f0c070", brassD: "#7a4a22" };
// offscreen buffer for the body (lets the tail fade out and the outline sit only on the outside)
let OB = null, OG = null;
const BX0 = -32, BY0 = -38, BW = 64, BH = 62;
function bodyPaths(g, tx, wv, each) {
  // head, two fluffy cheek tufts, round belly with a tail wisp curling out to one side (mirrored by sign of tx)
  g.beginPath(); g.ellipse(0, -9.6, 14.4, 11.4, 0, 0, TAU); each();
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 13.4, -6.4); g.quadraticCurveTo(s * 16.2, -4.8, s * 14.6, -2.4); g.quadraticCurveTo(s * 15.6, -1.0, s * 12.8, 0.9); g.closePath(); each(); }
  const sd = tx < 0 ? -1 : 1, T = Math.max(7, Math.abs(tx)), X = v => v * sd;
  g.beginPath(); g.moveTo(X(-12.8), -4);
  g.bezierCurveTo(X(-13.2), 3.5, X(-11.2), 11, X(-5.2), 14.2);
  g.bezierCurveTo(X(0.5), 17.4, X(T * 0.62), 19.6 + wv * 0.3, X(T + 1.5), 14.6 + wv);
  g.bezierCurveTo(X(T + 2.6), 12.6 + wv, X(T + 1.2), 10.6 + wv * 0.6, X(T - 0.4), 11.8 + wv * 0.5);
  g.bezierCurveTo(X(T * 0.6), 13.4, X(T * 0.4), 11.4, X(9.6), 9.2);
  g.bezierCurveTo(X(12.2), 6, X(13.2), 1, X(12.8), -4);
  g.closePath(); each();
}
function eye(g, x, y, rx, ry, blink, A) {
  const mood = A.mood || "";
  if (mood === "happy" || mood === "sleepy" || blink > 0.86) {
    g.strokeStyle = C.eye; g.lineWidth = 1.15; g.lineCap = "round"; g.beginPath();
    if (mood === "happy") g.arc(x, y + ry * 0.35, rx * 0.95, Math.PI * 1.15, Math.PI * 1.85); // ^ ^
    else g.arc(x, y - ry * 0.15, rx * 0.95, Math.PI * 0.15, Math.PI * 0.85);                   // ‿ ‿
    g.stroke();
    if (mood === "sleepy") { g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + rx * 0.85, y + ry * 0.25); g.lineTo(x + rx * 1.15, y + ry * 0.05); g.stroke(); }
    return;
  }
  const k = 1 - blink, Ry = ry * k;
  g.save(); g.translate(x, y);
  g.fillStyle = C.eye; ell(g, 0, 0, rx, Ry); g.fill();
  g.save(); ell(g, 0, 0, rx, Ry); g.clip();
  g.fillStyle = C.iris; ell(g, 0, Ry * 0.55, rx * 0.9, Ry * 0.72); g.fill();
  g.fillStyle = C.iris2; ell(g, 0.1, Ry * 0.92, rx * 0.62, Ry * 0.4); g.fill();
  g.restore();
  g.strokeStyle = "#160a05"; g.lineWidth = 0.7; g.beginPath(); g.ellipse(0, 0, rx, Ry, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  const lx = (A.look || 0) * 0.35;
  g.fillStyle = "#fff"; ell(g, rx * 0.3 + lx, -Ry * 0.36, rx * 0.4, Ry * 0.3, -0.3); g.fill();
  ell(g, -rx * 0.38 + lx, Ry * 0.42, rx * 0.17, Ry * 0.14); g.fill();
  g.fillStyle = "rgba(255,255,255,.75)"; ell(g, -rx * 0.05 + lx, Ry * 0.62, rx * 0.09, Ry * 0.07); g.fill();
  g.restore();
}
function hat(g, A) {
  g.save(); g.translate(3.8, -19.3); g.rotate(0.24 + (A.hatW || 0)); g.scale(0.95, 0.95);
  g.lineCap = "round";
  // stem with a curly vine and two leaves
  g.strokeStyle = C.stem; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-0.2, -4.0); g.quadraticCurveTo(0.2, -7.6, 3.0, -8.8); g.stroke();
  g.strokeStyle = "#a07444"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-0.6, -4.4); g.quadraticCurveTo(-0.2, -7.0, 2.4, -8.5); g.stroke();
  g.strokeStyle = "#5a7a34"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(5.5, -3.6); g.bezierCurveTo(9.4, -4.6, 10.6, -1.0, 8.6, -0.2); g.bezierCurveTo(7.4, 0.3, 7.0, -1.2, 8.2, -1.5); g.stroke();
  const leaf = (x, y, r, sz) => { g.save(); g.translate(x, y); g.rotate(r); g.scale(sz, sz); g.fillStyle = C.leaf; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2.6, -2.8, 6.0, -1.2); g.quadraticCurveTo(3.4, 1.8, 0, 0); g.fill();
    g.fillStyle = C.leafL; g.beginPath(); g.moveTo(0.5, -0.2); g.quadraticCurveTo(2.8, -2.2, 5.4, -1.2); g.quadraticCurveTo(2.8, -0.6, 0.5, -0.2); g.fill(); g.restore(); };
  leaf(1.4, -4.6, -0.25, 1); leaf(1.0, -4.2, 0.55, 0.8);
  // pumpkin lobes (back to front), squat & wide
  const lobe = (x, rx, ry, c, l) => { g.fillStyle = c; ell(g, x, 0, rx, ry); g.fill(); if (l) { g.fillStyle = l; ell(g, x - rx * 0.3, -ry * 0.42, rx * 0.38, ry * 0.3, -0.3); g.fill(); } };
  lobe(-7.0, 4.2, 4.1, C.pkD); lobe(7.0, 4.2, 4.1, C.pkDD);
  lobe(-3.9, 4.5, 4.7, C.pk, C.pkL); lobe(3.9, 4.5, 4.7, C.pkD);
  lobe(0, 4.2, 4.9, C.pk, C.pkL);
  g.strokeStyle = "rgba(150,60,20,.5)"; g.lineWidth = 0.55; g.beginPath();
  for (const x of [-2.2, 2.2, -5.6, 5.6]) { g.moveTo(x, -3.7); g.quadraticCurveTo(x + x * 0.12, 0, x, 3.7); } g.stroke();
  // tiny cute face
  g.fillStyle = "#4a1c0c"; ell(g, -2.0, -0.5, 0.8, 0.95); g.fill(); ell(g, 2.0, -0.5, 0.8, 0.95); g.fill();
  g.strokeStyle = "#4a1c0c"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1.3, 1.5); g.quadraticCurveTo(-0.65, 2.4, 0, 1.6); g.quadraticCurveTo(0.65, 2.4, 1.3, 1.5); g.stroke();
  // little white flower
  g.save(); g.translate(5.8, -2.4);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - 0.3; g.fillStyle = i % 2 ? "#fff6f0" : "#ffffff"; ell(g, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 1.2, 0.85, a); g.fill(); }
  g.fillStyle = "#f2b63c"; ell(g, 0, 0, 0.72, 0.72); g.fill();
  g.restore();
  g.restore();
}
function renderBody(A, p) {
  const w = Math.ceil(BW * p), h = Math.ceil(BH * p);
  if (!OB) { OB = cv(w, h); OG = OB.getContext("2d"); }
  if (OB.width < w || OB.height < h || OB.width > w * 1.6) { OB.width = w; OB.height = h; }
  const g = OG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.clearRect(0, 0, OB.width, OB.height);
  g.setTransform(p, 0, 0, p, -BX0 * p, -BY0 * p);
  const tx = A.tailX, wv = A.tailW || 0;
  g.fillStyle = C.base; bodyPaths(g, tx, wv, () => g.fill());
  g.globalCompositeOperation = "source-atop";
  // cel shade: everything outside a top-left lit blob
  g.fillStyle = C.shade; g.beginPath(); g.rect(BX0, BY0, BW, BH); g.ellipse(-3.4, -8.5, 15.6, 21.5, 0, 0, TAU, true); g.fill();
  g.fillStyle = C.deep; g.beginPath(); g.rect(BX0, BY0, BW, BH); g.ellipse(-2.2, -6, 17.2, 25, 0, 0, TAU, true); g.fill();
  // soft occlusion under the head
  
  // soft top-left sheen + fur flicks
  g.fillStyle = C.lite; ell(g, -5.5, -16.2, 5.6, 3.4, -0.45); g.fill();
  g.strokeStyle = "rgba(200,170,150,.55)"; g.lineWidth = 0.5; g.lineCap = "round"; g.beginPath();
  g.moveTo(-6, 9.5); g.quadraticCurveTo(-4.6, 11.5, -5.4, 13.2); g.moveTo(-2, -20.2); g.quadraticCurveTo(-0.6, -21.4, 0.8, -21); g.stroke();
  // warm bounce from the lantern
  const lx = A.lanX || 0, fl = A.flick == null ? 1 : A.flick;
  const gr = g.createRadialGradient(lx, 10, 0, lx, 10, 15); gr.addColorStop(0, `rgba(255,180,96,${0.32 * fl})`); gr.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(lx, 10, 15, 0, TAU); g.fill();
  g.globalCompositeOperation = "source-over";
  // face
  const look = A.look || 0, ly = A.lookY || 0, ex = 5.7, ey = -8.4 + ly;
  g.fillStyle = C.cheek; for (const sx of [-1, 1]) { ell(g, sx * 9.0 + look * 0.5, -3.9 + ly * 0.5, 3.4, 2.1); g.fill(); ell(g, sx * 9.0 + look * 0.5, -3.9 + ly * 0.5, 2.3, 1.4); g.fill(); }
  eye(g, -ex + look, ey, 3.4, 3.95, A.blink || 0, A); eye(g, ex + look, ey, 3.4, 3.95, A.blink || 0, A);
  const mood = A.mood || "", mx = look * 0.8, my = -4.0 + ly * 0.7;
  if (mood === "worried") {
    g.strokeStyle = "rgba(150,100,80,.85)"; g.lineWidth = 0.75; g.lineCap = "round"; g.beginPath();
    g.moveTo(-7.4 + look, ey - 5.2); g.lineTo(-3.2 + look, ey - 6.4); g.moveTo(7.4 + look, ey - 5.2); g.lineTo(3.2 + look, ey - 6.4); g.stroke();
    g.fillStyle = C.mouth; ell(g, mx, my + 0.4, 1.05, 1.25); g.fill();
  } else if (mood === "sleepy") {
    g.strokeStyle = C.mouth; g.lineWidth = 0.7; g.lineCap = "round"; g.beginPath(); g.moveTo(mx - 1.2, my); g.quadraticCurveTo(mx, my + 1.1, mx + 1.2, my); g.stroke();
  } else {
    const W2 = mood === "happy" ? 2.5 : 1.85, D = mood === "happy" ? 3.9 : 3.0;
    g.fillStyle = C.mouth; g.beginPath(); g.moveTo(mx - W2, my - 0.6); g.quadraticCurveTo(mx, my - 0.1, mx + W2, my - 0.6); g.quadraticCurveTo(mx + W2 * 0.7, my + D, mx, my + D * 0.92); g.quadraticCurveTo(mx - W2 * 0.7, my + D, mx - W2, my - 0.6); g.fill();
    g.save(); g.clip(); g.fillStyle = C.tongue; ell(g, mx, my + D * 0.95, W2 * 0.7, D * 0.42); g.fill(); g.restore();
  }
  // hat (with contact shadow on the head)
  g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(196,156,134,.4)"; ell(g, 3.6, -17.6, 9.6, 3.4, 0.24); g.fill();
  g.globalCompositeOperation = "source-over"; hat(g, A);
  // outline only on the outside
  g.globalCompositeOperation = "destination-over"; g.strokeStyle = C.edge; g.lineWidth = 1.2; g.lineJoin = "round"; bodyPaths(g, tx, wv, () => g.stroke());
  // tail tip dissolves into mist
  g.globalCompositeOperation = "destination-out";
  { const sd = tx < 0 ? -1 : 1, T = Math.max(7, Math.abs(tx)), fx = sd * (T + 1.5), fy = 14 + wv, fg = g.createRadialGradient(fx, fy, 0, fx, fy, 11);
    fg.addColorStop(0, "rgba(0,0,0,.85)"); fg.addColorStop(0.45, "rgba(0,0,0,.4)"); fg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = fg; g.fillRect(fx - 12, fy - 12, 24, 24); }
  g.globalCompositeOperation = "source-over";
  return OB;
}
function lantern(ctx, A, fl) {
  // origin = handle top (held). Swinging.
  ctx.save(); ctx.rotate(A.swing || 0);
  ctx.lineCap = "round";
  ctx.strokeStyle = C.brassD; ctx.lineWidth = 1.0; ctx.beginPath(); ctx.arc(0, 3.6, 3.2, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
  ctx.strokeStyle = C.brassL; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.arc(0, 3.4, 3.1, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
  // cap
  ctx.fillStyle = C.brassD; ctx.beginPath(); ctx.ellipse(0, 6.0, 4.2, 3.0, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.brass; ctx.beginPath(); ctx.ellipse(-0.4, 5.9, 3.4, 2.5, 0, Math.PI, Math.PI * 1.75); ctx.lineTo(-0.4, 5.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.brassD; ell(ctx, 0, 6.1, 4.6, 0.8); ctx.fill();
  ctx.fillStyle = C.brassL; ell(ctx, 0, 2.7, 1.0, 0.85); ctx.fill(); ell(ctx, -1.6, 4.4, 0.9, 0.45, -0.5); ctx.fill();
  // glowing jack-o'-lantern body
  const cy = 10.4;
  ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.flame, 0, cy, 11 * (0.9 + 0.1 * fl), 11 * (0.9 + 0.1 * fl), 0.42 * fl); ctx.globalCompositeOperation = "source-over";
  const lobe = (x, rx, ry, c) => { ctx.fillStyle = c; ell(ctx, x, cy, rx, ry); ctx.fill(); };
  lobe(-3.2, 3.6, 4.7, "#e8741f"); lobe(3.2, 3.6, 4.7, "#d9621a"); lobe(0, 3.6, 5.0, "#f7962f");
  ctx.fillStyle = `rgba(255,214,120,${0.55 + 0.25 * fl})`; ell(ctx, -1.6, cy - 2.4, 2.4, 1.4, -0.3); ctx.fill();
  ctx.strokeStyle = "rgba(160,60,15,.6)"; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(-1.6, cy - 4.4); ctx.quadraticCurveTo(-2.2, cy, -1.6, cy + 4.4); ctx.moveTo(1.6, cy - 4.4); ctx.quadraticCurveTo(2.2, cy, 1.6, cy + 4.4); ctx.stroke();
  // carved face glowing
  const fc = `rgb(255,${226 + 20 * fl | 0},${120 + 60 * fl | 0})`;
  ctx.fillStyle = "#7a2a08";
  const face = () => { ctx.beginPath(); ctx.moveTo(-2.9, cy - 0.6); ctx.lineTo(-1.1, cy - 0.6); ctx.lineTo(-2.0, cy - 2.4); ctx.closePath(); ctx.moveTo(1.1, cy - 0.6); ctx.lineTo(2.9, cy - 0.6); ctx.lineTo(2.0, cy - 2.4); ctx.closePath();
    ctx.moveTo(-2.8, cy + 0.9); ctx.quadraticCurveTo(0, cy + 4.1, 2.8, cy + 0.9); ctx.lineTo(1.4, cy + 1.6); ctx.lineTo(0.7, cy + 1.1); ctx.lineTo(0, cy + 1.8); ctx.lineTo(-0.7, cy + 1.1); ctx.lineTo(-1.4, cy + 1.6); ctx.closePath(); };
  ctx.save(); ctx.translate(0.25, 0.25); face(); ctx.fill(); ctx.restore();
  face(); ctx.fillStyle = fc; ctx.fill();
  // brass base
  ctx.fillStyle = C.brassD; ell(ctx, 0, cy + 5.0, 3.6, 1.1); ctx.fill(); ctx.fillStyle = C.brass; ell(ctx, -0.4, cy + 4.7, 2.8, 0.7); ctx.fill();
  ctx.restore();
}
function hand(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = "rgba(186,138,112,.45)"; ell(ctx, 0, 0, r * 1.25 + 0.4, r * 0.85 + 0.4); ctx.fill();
  ctx.fillStyle = C.base; ell(ctx, 0, 0, r * 1.25, r * 0.85); ctx.fill();
  ctx.fillStyle = C.shade; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0.15, Math.PI - 0.15); ctx.fill();
  ctx.fillStyle = C.base; ell(ctx, -r * 0.2, -r * 0.15, r * 1.0, r * 0.6); ctx.fill();
  ctx.restore();
}
// alpha-aware sprite (ART.spr resets globalAlpha to 1)
function sp(ctx, s, x, y, rx, ry, a) { if (a <= 0) return; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(s, x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = ga; }
function add(ctx, s, x, y, rx, ry, a) { const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter"; sp(ctx, s, x, y, rx, ry, a); ctx.globalCompositeOperation = op; }
// A: {t, lift, dir(-1..1), sq, lean, blink, mood, look, lookY, tailX, tailW, swing, flick, carry, endX, glow, noShadow}
const GK = 0.0079;
const lanX = dir => clamp(dir * 2.4, -1, 1) * 4.2;
function drawGhost(ctx, x, y, A, k = GK) {
  const m = ctx.getTransform(), p = Math.max(1, Math.hypot(m.a, m.b) * k * 1.05);
  const lift = A.lift == null ? 10 : A.lift, fl = A.flick == null ? 1 : A.flick, dir = A.dir || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  if (!A.noShadow) sp(ctx, SPR.shadow, 1.2, 0.5, 14 - lift * 0.35, 4.2 - lift * 0.1, 0.62 - lift * 0.012);
  A.lanX = lanX(dir);
  const img = renderBody(A, p);
  ctx.translate(0, -lift - 22); ctx.rotate(A.lean || 0); ctx.scale(1 + (A.sq || 0), 1 - (A.sq || 0));
  add(ctx, SPR.halo, 0, -4, 25, 27, 0.2 * (A.glow == null ? 1 : A.glow));
  ctx.drawImage(img, 0, 0, BW * p, BH * p, BX0, BY0, BW, BH);
  const hx = A.lanX, hy = 2.6;
  if (A.carry) { // glowing ember thread from the lantern down to the ground
    const sw = A.swing || 0, bx = hx - Math.sin(sw) * 15.6, by = hy + Math.cos(sw) * 15.6, gx = (A.endX || 0), gy = lift + 22;
    ctx.lineCap = "round";
    const sx = (A.tailX || 0) * 0.35; // slack bows back like the tail
    ctx.strokeStyle = `rgba(255,150,60,${0.13 * fl})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx + sx, by + (gy - by) * 0.45, gx + sx * 0.6, gy - 1, gx, gy); ctx.stroke();
    ctx.strokeStyle = `rgba(255,206,140,${0.32 * fl})`; ctx.lineWidth = 0.4; ctx.stroke();
  }
  ctx.save(); ctx.translate(hx, hy); lantern(ctx, A, fl); ctx.restore();
  { const sd = hx < 0 ? 1 : (hx > 0 ? -1 : 1); hand(ctx, hx - sd * 0.3, hy + 0.2, 1.75, -sd * 0.5); hand(ctx, hx + sd * 4.4, hy + 5.4, 1.6, sd * 0.9); }
  ctx.restore();
}
// ground light pool (draw before props, additive)
function drawLampPool(ctx, x, y, fl, a = 1) {
  const k = 0.94 + 0.06 * fl, ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = ga * a * (0.5 + 0.15 * fl); ctx.drawImage(SPR.pool, x - 0.7 * k, y + 0.01 - 0.4 * k, 1.4 * k, 0.8 * k);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
  add(ctx, SPR.lamp, x, y + 0.01, 0.36 * k, 0.2 * k, 0.1 * a * (0.8 + 0.2 * fl));
}

// ================= EMBER THREAD =================
let _nx = new Float32Array(1024), _ny = new Float32Array(1024), _q = new Float32Array(2048);
function smoothPath(ctx, Q, n, i0 = 0, i1 = n - 1) {
  ctx.beginPath(); ctx.moveTo(Q[i0 * 2], Q[i0 * 2 + 1]);
  for (let i = i0 + 1; i < i1; i++) ctx.quadraticCurveTo(Q[i * 2], Q[i * 2 + 1], (Q[i * 2] + Q[i * 2 + 2]) / 2, (Q[i * 2 + 1] + Q[i * 2 + 3]) / 2);
  ctx.lineTo(Q[i1 * 2], Q[i1 * 2 + 1]);
}
// P flat [x,y..]. opt: {w, lit(0..1 reveal glow), glow, t, tension, vibFrom, live, boost, seg}
function drawEmber(ctx, P, opt = {}) {
  const n = P.length >> 1; if (n < 2) return;
  if (_q.length < n * 2) _q = new Float32Array(n * 4);
  const w = opt.w || 0.014, lit = clamp(opt.lit || 0, 0, 1), t = opt.t || 0, ten = Math.min(1, opt.tension || 0), seg = opt.seg || 0.05;
  let Q = P;
  if (ten > 0.05 && lit < 1) { // taut free section shivers
    Q = _q; for (let i = 0; i < n * 2; i++) Q[i] = P[i];
    const from = opt.vibFrom || 0, amp = 0.006 * ten;
    for (let i = from + 1; i < n - 1; i++) { const a = P[i * 2 + 2] - P[i * 2 - 2], b = P[i * 2 + 3] - P[i * 2 - 1], l = Math.hypot(a, b) || 1, s = Math.sin(i * 1.3 - t * 70) * amp * Math.sin(Math.PI * (i - from) / (n - from)); Q[i * 2] += -b / l * s; Q[i * 2 + 1] += a / l * s; }
  }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const ga = ctx.globalAlpha;
  if (lit < 1) { // dim smoky-amber thread; old parts fade, so the shape never reads during play
    const dim = 1 - lit, boost = opt.boost || 0, CH = 6;
    const flick = ten > 0.3 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 31) * Math.sin(t * 17 + 1)) : 1;
    for (let i0 = 0; i0 < n - 1; i0 += CH) {
      const i1 = Math.min(n - 1, i0 + CH), d = (n - 1 - (i0 + i1) / 2) * seg;
      let a = opt.live ? 0.08 + 0.34 * Math.exp(-d / 1.1) : 0.085;
      a = lerp(a, 0.42, boost);
      if (ten > 0.3 && opt.live && d < 3) a = Math.min(0.9, a * (1 + ten * 1.4) * flick);
      a *= dim;
      ctx.beginPath(); ctx.moveTo(Q[i0 * 2], Q[i0 * 2 + 1]); for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(Q[i * 2], Q[i * 2 + 1]);
      ctx.globalAlpha = ga * a * 0.55; ctx.strokeStyle = "#7a5038"; ctx.lineWidth = w * 1.9; ctx.stroke();
      ctx.globalAlpha = ga * a; ctx.strokeStyle = ten > 0.3 && opt.live ? "#ffc070" : "#f0a560"; ctx.lineWidth = w * 0.62; ctx.stroke();
    }
    // a few live embers glinting along the newest part
    if (opt.live || boost > 0) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = n - 2; i > 0 && (n - 1 - i) * seg < (boost ? 99 : 1.6); i -= 5) {
        const tw = Math.sin(t * 5 + i * 2.39) * 0.5 + 0.5; if (tw < 0.55) continue;
        const d = (n - 1 - i) * seg, a = (boost ? 0.5 : Math.exp(-d / 0.8)) * (tw - 0.55) * 2.2 * dim;
        ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(SPR.ember, Q[i * 2] - w * 1.8, Q[i * 2 + 1] - w * 1.8, w * 3.6, w * 3.6);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = ga;
  }
  if (lit > 0) { // reignited: bright orange-gold glowing line
    const g = (opt.glow == null ? 1 : opt.glow) * lit;
    ctx.globalCompositeOperation = "lighter";
    [[4.4, 0.06], [2.7, 0.12], [1.7, 0.2]].forEach(([k, a]) => { smoothPath(ctx, Q, n); ctx.globalAlpha = ga * a * g; ctx.strokeStyle = "rgb(255,138,40)"; ctx.lineWidth = w * k; ctx.stroke(); });
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = ga * lit;
    smoothPath(ctx, Q, n); ctx.strokeStyle = "#f07a22"; ctx.lineWidth = w; ctx.stroke();
    smoothPath(ctx, Q, n); ctx.strokeStyle = "#ffc25a"; ctx.lineWidth = w * 0.62; ctx.stroke();
    smoothPath(ctx, Q, n); ctx.strokeStyle = "#fff6d8"; ctx.lineWidth = w * 0.26; ctx.stroke();
    ctx.globalAlpha = ga;
  }
}
// ember tie-off node (end of a stroke). k: 0..1 pop animation
function drawTie(ctx, x, y, k, lit, s = 1) {
  const r = 0.016 * s, pop = Math.sin(Math.min(1, k) * Math.PI);
  add(ctx, SPR.ember, x, y, r * (3 + pop * 4 + lit * 2), r * (3 + pop * 4 + lit * 2), 0.35 + 0.5 * lit + pop * 0.6);
  ctx.fillStyle = lit ? "#fff3c8" : "#ffcf86"; ell(ctx, x, y, r * 0.55, r * 0.55); ctx.fill();
  if (k < 1) { ctx.strokeStyle = `rgba(255,214,140,${pop})`; ctx.lineWidth = r * 0.35; ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3, r0 = r * (1 + k * 2), r1 = r * (1.8 + k * 3.4); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.7); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.7); } ctx.stroke(); }
}

// ================= PUMPKINS & CANDLES =================
function pumpkin(ctx, rx, ry, face, lightA, t) {
  const lobe = (x, lrx, lry, c) => { ctx.fillStyle = c; ell(ctx, x, 0, lrx, lry); ctx.fill(); };
  lobe(-rx * 0.62, rx * 0.44, ry * 0.86, C.pkD); lobe(rx * 0.62, rx * 0.44, ry * 0.86, C.pkDD);
  lobe(-rx * 0.33, rx * 0.48, ry * 0.97, C.pk); lobe(rx * 0.33, rx * 0.48, ry * 0.97, C.pkD);
  lobe(0, rx * 0.44, ry, C.pk);
  ctx.fillStyle = "rgba(255,200,120,.75)"; ell(ctx, -rx * 0.42, -ry * 0.5, rx * 0.2, ry * 0.2, -0.4); ctx.fill();
  ctx.strokeStyle = "rgba(150,60,20,.5)"; ctx.lineWidth = rx * 0.045; ctx.beginPath();
  for (const k of [-0.22, 0.22, -0.55, 0.55]) { ctx.moveTo(rx * k, -ry * 0.82); ctx.quadraticCurveTo(rx * k * 1.15, 0, rx * k, ry * 0.82); } ctx.stroke();
  if (face) {
    const f = `rgba(255,${210 + 30 * lightA | 0},${110 + 60 * lightA | 0},1)`, dk = "#5a2208";
    const shape = () => { ctx.beginPath();
      ctx.moveTo(-rx * 0.46, -ry * 0.08); ctx.lineTo(-rx * 0.14, -ry * 0.08); ctx.lineTo(-rx * 0.3, -ry * 0.42); ctx.closePath();
      ctx.moveTo(rx * 0.14, -ry * 0.08); ctx.lineTo(rx * 0.46, -ry * 0.08); ctx.lineTo(rx * 0.3, -ry * 0.42); ctx.closePath();
      ctx.moveTo(-rx * 0.48, ry * 0.18); ctx.quadraticCurveTo(0, ry * 0.85, rx * 0.48, ry * 0.18); ctx.lineTo(rx * 0.24, ry * 0.32); ctx.lineTo(rx * 0.12, ry * 0.22); ctx.lineTo(0, ry * 0.36); ctx.lineTo(-rx * 0.12, ry * 0.22); ctx.lineTo(-rx * 0.24, ry * 0.32); ctx.closePath(); };
    ctx.fillStyle = dk; shape(); ctx.fill();
    if (lightA > 0) { ctx.save(); ctx.translate(rx * 0.03, ry * 0.05); ctx.globalAlpha *= lightA; ctx.fillStyle = f; shape(); ctx.fill(); ctx.restore(); }
  }
  // stem
  ctx.fillStyle = C.stem; ctx.beginPath(); ctx.moveTo(-rx * 0.08, -ry * 0.85); ctx.quadraticCurveTo(-rx * 0.06, -ry * 1.3, rx * 0.12, -ry * 1.42); ctx.lineTo(rx * 0.16, -ry * 1.28); ctx.quadraticCurveTo(rx * 0.06, -ry * 1.18, rx * 0.1, -ry * 0.85); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.moveTo(rx * 0.06, -ry * 0.92); ctx.quadraticCurveTo(rx * 0.4, -ry * 1.4, rx * 0.66, -ry * 1.05); ctx.quadraticCurveTo(rx * 0.36, -ry * 0.82, rx * 0.06, -ry * 0.92); ctx.fill();
}
function flame(ctx, x, y, s, t, a = 1) {
  const f = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1), sw = Math.sin(t * 5.1) * 0.12;
  add(ctx, SPR.flame, x, y - s * 0.6, s * 3.2 * f, s * 3.4 * f, 0.75 * a);
  ctx.save(); ctx.translate(x, y); ctx.rotate(sw); ctx.scale(1, f);
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  ctx.fillStyle = "#ff9a2a"; ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.bezierCurveTo(s * 0.75, -s * 0.6, s * 0.7, 0, 0, s * 0.15); ctx.bezierCurveTo(-s * 0.7, 0, -s * 0.75, -s * 0.6, 0, -s * 1.6); ctx.fill();
  ctx.fillStyle = "#fff1b0"; ctx.beginPath(); ctx.moveTo(0, -s * 1.05); ctx.bezierCurveTo(s * 0.4, -s * 0.4, s * 0.38, 0, 0, s * 0.05); ctx.bezierCurveTo(-s * 0.38, 0, -s * 0.4, -s * 0.4, 0, -s * 1.05); ctx.fill();
  ctx.globalAlpha = ga; ctx.restore();
}
// stroke start: a little carved pumpkin with a candle. o: {glow, melt(0..1 wax left), lit, bounce}
function drawCandle(ctx, x, y, t, o = {}) {
  const rx = 0.07, ry = 0.052, melt = o.melt == null ? 1 : o.melt, lit = o.lit == null ? 1 : o.lit;
  ctx.save(); ctx.translate(x, y);
  sp(ctx, SPR.shadow, 0.012, 0.004, rx * 1.5, ry * 0.7, 0.8);
  if (lit) add(ctx, SPR.lamp, 0, 0, 0.3 + 0.12 * (o.glow || 0), 0.18 + 0.07 * (o.glow || 0), 0.22 + 0.4 * (o.glow || 0));
  ctx.translate(0, -ry - (o.bounce || 0));
  pumpkin(ctx, rx, ry, true, lit ? 0.8 + 0.2 * Math.sin(t * 9) : 0, t);
  // candle on top
  const ch = 0.012 + 0.05 * melt, cw = 0.013, top = -ry * 0.9 - ch;
  ctx.fillStyle = "#e9dcc4"; ctx.fillRect(-cw, top, cw * 2, ch);
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(-cw, top, cw * 1.1, ch);
  ell(ctx, 0, top, cw, cw * 0.38); ctx.fillStyle = "#fffdf6"; ctx.fill();
  ctx.fillStyle = "#fffaf0"; ell(ctx, cw * 0.55, top + 0.008, 0.004, 0.009); ctx.fill();
  ctx.strokeStyle = "#3a2a20"; ctx.lineWidth = 0.003; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, top - 0.008); ctx.stroke();
  if (lit) flame(ctx, 0, top - 0.008, 0.013 * (1 + 0.5 * (o.glow || 0)), t + x * 3, lit);
  ctx.restore();
}
// level goal: big jack-o'-lantern
function drawBigPumpkin(ctx, b, t, glow) {
  ctx.save(); ctx.translate(b.x, b.y);
  sp(ctx, SPR.shadow, 0.03, 0.02, 0.3, 0.09, 1);
  const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  add(ctx, SPR.lamp, 0, 0, 0.55, 0.32, 0.35 + 0.35 * glow);
  ctx.translate(0, -0.12);
  add(ctx, SPR.flame, 0, 0, 0.32 * f, 0.3 * f, 0.25 + 0.4 * glow);
  pumpkin(ctx, 0.19, 0.13, true, f, t);
  ctx.restore();
}
// HUD gauge in screen px: candle that melts as the thread budget is used
function drawHUDCandle(ctx, cx, cy, rem, t, low, idle) {
  const h = idle ? 6 : 5 + 19 * rem, w = 6.5, base = cy + 15;
  ctx.fillStyle = "#c98c3c"; ell(ctx, cx, base, 13, 3.6); ctx.fill(); ctx.fillStyle = "#f0c070"; ell(ctx, cx, base - 1, 11, 2.6); ctx.fill();
  ctx.fillStyle = "#e9dcc4"; ctx.fillRect(cx - w, base - 1 - h, w * 2, h);
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(cx - w, base - 1 - h, w * 1.1, h);
  ctx.fillStyle = "#fffdf6"; ell(ctx, cx, base - 1 - h, w, 2); ctx.fill();
  ctx.fillStyle = "#fffaf0"; ell(ctx, cx + 3.5, base - h + 3, 1.6, 3.2); ctx.fill();
  ctx.strokeStyle = "#3a2a20"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(cx, base - 1 - h); ctx.lineTo(cx, base - 4 - h); ctx.stroke();
  if (!idle) flame(ctx, cx, base - 4 - h, low ? 4.8 + Math.sin(t * 40) * 1.4 : 5.0, t, 1);
}
// word screen: sleepy ghost resting by its lantern (screen px; s = px per ghost unit)
function drawSleepingGhost(ctx, x, y, s, t) {
  const A = { t, lift: 3 + Math.sin(t * 1.4) * 1.2, dir: 0, mood: "sleepy", tailX: 12 + Math.sin(t * 0.9) * 1.5, tailW: Math.sin(t * 1.7) * 1.5, swing: Math.sin(t * 1.1) * 0.06, flick: 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5), lean: -0.12 + Math.sin(t * 1.4) * 0.02, sq: Math.sin(t * 1.4) * 0.015, glow: 1.3 };
  add(ctx, SPR.lamp, x, y, 70 * s / 2, 22 * s / 2, 0.5);
  drawGhost(ctx, x, y, A, s);
}
// particles: glowing motes + embers
const baseParticle = ART.drawParticle;
function drawParticle(ctx, p, z) {
  const a = clamp(p.life / (p.max || 1), 0, 1);
  if (p.k === "dust") { const r = p.r * (1.2 + (1 - a) * 0.8); add(ctx, SPR.ember, p.x, p.y, r * 1.6, r * 1.6, a * 0.75); ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#fff0c8"; ell(ctx, p.x, p.y, r * 0.22, r * 0.22); ctx.fill(); ctx.globalAlpha = 1; }
  else if (p.k === "ember") { const tw = 0.7 + 0.3 * Math.sin(p.life * 30 + p.rot * 9); add(ctx, SPR.ember, p.x, p.y, p.r, p.r, Math.min(1, a * 1.6) * tw * (p.a || 1)); }
  else baseParticle(ctx, p, z);
}
Object.assign(ART, { drawGhost, drawLampPool, drawEmber, drawTie, drawCandle, drawBigPumpkin, drawHUDCandle, drawSleepingGhost, drawParticle, flame, GK, lanX, GHOSTC: C });
})();
