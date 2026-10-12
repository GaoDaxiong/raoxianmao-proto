// 南瓜灯小幽灵 v4 — lost will-o'-wisps (迷路的小鬼火) + touch controls art (joystick, action button).
(() => {
"use strict";
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const { spr, SPR, ell } = ART;
function radial(stops, size = 96) { const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; }
const WS = {
  warm: radial([[0, "rgba(255,236,170,1)"], [0.22, "rgba(255,196,110,.6)"], [0.55, "rgba(255,150,70,.16)"], [1, "rgba(255,140,60,0)"]]),
  cool: radial([[0, "rgba(200,215,255,.9)"], [0.3, "rgba(150,170,230,.35)"], [1, "rgba(120,140,220,0)"]]),
  fly: radial([[0, "rgba(240,255,190,1)"], [0.3, "rgba(200,255,120,.5)"], [1, "rgba(160,240,90,0)"]]),
};
const PALW = { body: ["#fffbe6", "#ffd879", "#ff9f45"], cool: ["#eef2ff", "#aebce6", "#7486bf"] };
// o: {state:'next'|'wait'|'decoy'|'train'|'icon', glow:0..1, t, ph, s, a, wig, yawn, happy}
function drawWisp(ctx, x, y, o) {
  const t = o.t || 0, ph = o.ph || 0, s = (o.s || 1) * 0.085, a = o.a == null ? 1 : o.a;
  const cool = o.state === "decoy", sleepy = cool || o.state === "wait";
  const P = cool ? PALW.cool : PALW.body, gl = clamp(o.glow || 0, 0, 1);
  const wig = o.wig || 0, sway = Math.sin(t * 7 + ph) * 0.25 + Math.sin(wig * 30) * wig * 0.5;
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y);
  // aura
  ctx.globalCompositeOperation = "lighter";
  const auraA = cool ? 0.22 : o.state === "wait" ? 0.32 : 0.45 + 0.5 * gl;
  const auraR = s * (cool ? 2.4 : 2.8 + 2.2 * gl) * (1 + 0.06 * Math.sin(t * 5 + ph));
  spr(ctx, cool ? WS.cool : WS.warm, 0, 0, auraR, auraR, auraA * a);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = a * (cool ? 0.7 : 1);
  ctx.rotate(sway * 0.35);
  const sq = 1 + Math.sin(t * 4 + ph) * 0.05 + (o.yawn || 0) * 0.12;
  ctx.scale(s / sq, s * sq);
  // flame body: round bottom, flickering tip
  const tip = Math.sin(t * 9 + ph) * 0.18 + sway * 0.4;
  const body = () => { ctx.beginPath(); ctx.moveTo(0, 1); ctx.bezierCurveTo(-0.95, 1, -1.05, 0.05, -0.62, -0.42); ctx.quadraticCurveTo(-0.3, -0.85, tip, -1.75);
    ctx.quadraticCurveTo(0.25 + tip * 0.3, -0.9, 0.62, -0.42); ctx.bezierCurveTo(1.05, 0.05, 0.95, 1, 0, 1); ctx.closePath(); };
  body(); const gr = ctx.createRadialGradient(-0.15, 0.25, 0.05, 0, 0.1, 1.5); gr.addColorStop(0, P[0]); gr.addColorStop(0.45, P[1]); gr.addColorStop(1, P[2]); ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 0.09; ctx.strokeStyle = cool ? "rgba(70,80,130,.45)" : "rgba(170,80,30,.45)"; ctx.stroke();
  // inner highlight
  ctx.fillStyle = "rgba(255,255,255,.55)"; ell(ctx, -0.35, -0.05, 0.16, 0.28, -0.4); ctx.fill();
  // face
  const ey = 0.32, ex = 0.32;
  ctx.strokeStyle = ctx.fillStyle = cool ? "#3e4670" : "#5a2a14"; ctx.lineCap = "round"; ctx.lineWidth = 0.12;
  if (o.yawn > 0.05) { // yawn: closed eyes + open mouth
    ctx.beginPath(); ctx.arc(-ex, ey, 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(ex, ey, 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ell(ctx, 0, 0.66, 0.12, 0.16 * o.yawn + 0.04); ctx.fill();
  } else if (sleepy) {
    ctx.beginPath(); ctx.moveTo(-ex - 0.13, ey + 0.04); ctx.quadraticCurveTo(-ex, ey + 0.13, -ex + 0.13, ey + 0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - 0.13, ey + 0.04); ctx.quadraticCurveTo(ex, ey + 0.13, ex + 0.13, ey + 0.04); ctx.stroke();
  } else if (o.state === "train" || o.happy) {
    ctx.beginPath(); ctx.arc(-ex, ey + 0.08, 0.12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(ex, ey + 0.08, 0.12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  } else {
    const bl = (Math.sin(t * 0.9 + ph * 3) > 0.985) ? 0.15 : 1;
    ell(ctx, -ex, ey, 0.1, 0.15 * bl); ctx.fill(); ell(ctx, ex, ey, 0.1, 0.15 * bl); ctx.fill();
    ctx.fillStyle = "#fff"; ell(ctx, -ex + 0.03, ey - 0.05, 0.035, 0.035); ctx.fill(); ell(ctx, ex + 0.03, ey - 0.05, 0.035, 0.035); ctx.fill();
  }
  if (!cool) { ctx.fillStyle = "rgba(255,120,110,.45)"; ell(ctx, -0.58, 0.55, 0.15, 0.09); ctx.fill(); ell(ctx, 0.58, 0.55, 0.15, 0.09); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawFirefly(ctx, x, y, t, a = 1) {
  ctx.globalCompositeOperation = "lighter";
  spr(ctx, WS.fly, x, y, 0.2, 0.2, 0.9 * a * (0.7 + 0.3 * Math.sin(t * 13)));
  spr(ctx, WS.fly, x, y, 0.07, 0.07, a);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = a; ctx.fillStyle = "#f6ffd0"; ell(ctx, x, y, 0.02, 0.02); ctx.fill(); ctx.globalAlpha = 1;
}
// ---------- screen-space controls ----------
function drawStick(ctx, st, t) {
  // st: {bx,by,kx,ky,R,mag,a,active,run}
  const a = st.a; if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(st.bx, st.by, st.R * 0.2, st.bx, st.by, st.R * 1.15);
  g.addColorStop(0, "rgba(255,250,236,.10)"); g.addColorStop(0.8, "rgba(255,250,236,.20)"); g.addColorStop(1, "rgba(255,250,236,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(st.bx, st.by, st.R * 1.15, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,248,230,.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.bx, st.by, st.R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(255,248,230,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(st.bx, st.by, st.R * 0.6, 0, TAU); ctx.stroke(); // walk/run ring
  if (st.active && st.mag > 0) { // direction arc
    const ang = Math.atan2(st.ky - st.by, st.kx - st.bx), w = 0.55 + 0.25 * (1 - st.mag);
    ctx.lineCap = "round"; ctx.lineWidth = 5; ctx.strokeStyle = st.run ? "rgba(255,170,80,.95)" : "rgba(255,226,150,.85)";
    ctx.shadowColor = "rgba(255,180,90,.9)"; ctx.shadowBlur = 10;
    ctx.globalAlpha = a * (0.45 + 0.55 * st.mag); ctx.beginPath(); ctx.arc(st.bx, st.by, st.R + 1, ang - w, ang + w); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = a;
  }
  // knob
  const kr = 25;
  ctx.shadowColor = "rgba(20,30,30,.35)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  const kg = ctx.createRadialGradient(st.kx - 7, st.ky - 8, 2, st.kx, st.ky, kr);
  if (st.active) { kg.addColorStop(0, "rgba(255,252,240,.95)"); kg.addColorStop(0.55, "rgba(250,226,176,.92)"); kg.addColorStop(1, st.run ? "rgba(246,160,80,.95)" : "rgba(236,196,120,.95)"); }
  else { kg.addColorStop(0, "rgba(255,255,250,.75)"); kg.addColorStop(1, "rgba(230,220,200,.55)"); }
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(st.kx, st.ky, kr, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.kx, st.ky, kr - 1, 0, TAU); ctx.stroke();
  if (st.active) { ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.glow, st.kx, st.ky, kr * 1.6, kr * 1.6, 0.12 + 0.12 * st.mag); ctx.globalCompositeOperation = "source-over"; }
  ctx.restore();
}
function drawActionBtn(ctx, b, t) {
  // b: {x,y,r,state:'off'|'on'|'soft', press, flash}
  const on = b.state === "on", soft = b.state === "soft";
  const pulse = on ? 1 + 0.06 * Math.sin(t * 7) : 1, r = b.r * pulse * (b.press ? 0.92 : 1);
  ctx.save();
  if (on) { // expanding halo rings
    ctx.globalCompositeOperation = "lighter";
    spr(ctx, SPR.glow, b.x, b.y, r * 2.3, r * 2.3, 0.55 + 0.2 * Math.sin(t * 7));
    for (let i = 0; i < 2; i++) { const k = (t * 0.9 + i * 0.5) % 1; ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = "#ffd690"; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(b.x, b.y, r * (1 + k * 0.7), 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  ctx.shadowColor = "rgba(20,30,30,.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, r * 0.1, b.x, b.y, r);
  if (on) { g.addColorStop(0, "#fff6dc"); g.addColorStop(0.55, "#ffc766"); g.addColorStop(1, "#e47f2c"); }
  else { g.addColorStop(0, soft ? "rgba(255,250,236,.72)" : "rgba(255,250,236,.5)"); g.addColorStop(1, soft ? "rgba(190,180,170,.55)" : "rgba(150,150,150,.38)"); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = on ? "rgba(255,255,240,.95)" : "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(b.x, b.y, r - 1.5, 0, TAU); ctx.stroke();
  // wisp icon (drawn in px space)
  ctx.translate(b.x, b.y + r * 0.08);
  const k = r / 0.36; ctx.scale(k, k);
  drawWisp(ctx, 0, 0, { state: on ? "next" : "icon", glow: on ? 1 : 0, t, ph: 0, s: 1.3, a: on ? 1 : soft ? 0.75 : 0.5, happy: on });
  ctx.restore();
  if (b.flash > 0) { ctx.globalCompositeOperation = "lighter"; spr(ctx, SPR.glowW, b.x, b.y, r * (1.5 + (1 - b.flash)), r * (1.5 + (1 - b.flash)), b.flash * 0.8); ctx.globalCompositeOperation = "source-over"; }
}
Object.assign(ART, { drawWisp, drawFirefly, drawStick, drawActionBtn, WS });
})();
