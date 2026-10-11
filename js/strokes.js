// Shared stroke format (design doc §2): 4x6 grid, strokes separated by "/", "~" = smooth pass-through point.
const STROKE_TABLE = {
  A: "0,6 2,0 4,6 / 1,3 3,3",
  B: "0,0 0,6 / 0,0 3,0 ~4,1.5 3,3 ~4,4.5 3,6 0,6 / 0,3 3,3",
  C: "4,1 ~2,0 ~0,3 ~2,6 4,5",
  D: "0,0 0,6 2,6 ~4,3 2,0 0,0",
  E: "4,0 0,0 0,6 4,6 / 0,3 3,3",
  F: "4,0 0,0 0,6 / 0,3 3,3",
  G: "4,1 ~2,0 ~0,3 ~2,6 4,5 4,3 2,3",
  H: "0,0 0,6 / 4,0 4,6 / 0,3 4,3",
  I: "2,0 2,6",
  J: "1,0 4,0 / 3,0 3,4.5 ~1.5,6 0,4.5",
  K: "0,0 0,6 / 4,0 0,3 4,6",
  L: "0,0 0,6 4,6",
  M: "0,6 0,0 2,3 4,0 4,6",
  N: "0,6 0,0 4,6 4,0",
  O: "2,0 ~4,1.5 ~4,4.5 2,6 ~0,4.5 ~0,1.5 2,0",
  P: "0,6 0,0 3,0 ~4,1.5 3,3 0,3",
  Q: "2,0 ~4,1.5 ~4,4.5 2,6 ~0,4.5 ~0,1.5 2,0 / 2.5,4.5 4,6",
  R: "0,6 0,0 3,0 ~4,1.5 3,3 0,3 / 2,3 4,6",
  S: "4,1 ~2,0 ~0,1.5 ~2,3 ~4,4.5 ~2,6 0,5",
  T: "0,0 4,0 / 2,0 2,6",
  U: "0,0 0,4 ~2,6 4,4 4,0",
  V: "0,0 2,6 4,0",
  W: "0,0 1,6 2,2 3,6 4,0",
  X: "0,0 4,6 / 4,0 0,6",
  Y: "0,0 2,3 4,0 / 2,3 2,6",
  Z: "0,0 4,0 0,6 4,6",
  "♥": "2,1.5 ~1,0 ~0,1.5 2,6 ~4,1.5 ~3,0 2,1.5",
};

function parseStroke(s, k = 1) {
  return s.trim().split(/\s+/).map(tok => {
    const sm = tok[0] === "~";
    const [x, y] = tok.replace("~", "").split(",").map(Number);
    return { x: x * k, y: y * k, sm };
  });
}

function compileStroke(P) {
  const n = P.length;
  const isSm = i => i > 0 && i < n - 1 && P[i].sm;
  const segStraight = i => i >= 0 && i < n - 1 && !isSm(i) && !isSm(i + 1);
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const len = v => Math.hypot(v.x, v.y);
  function tangent(i, seg, atStart) {
    const a = P[seg], b = P[seg + 1], L = len(sub(b, a));
    if (isSm(i)) { const d = sub(P[i + 1], P[i - 1]); return { x: d.x / 2, y: d.y / 2 }; }
    const other = atStart ? i - 1 : i;
    if (segStraight(other)) { const d = sub(P[other + 1], P[other]); const l = len(d) || 1; return { x: d.x / l * L, y: d.y / l * L }; }
    return sub(b, a);
  }
  const pts = [], arc = [], curved = [], vIdx = [];
  let acc = 0;
  const push = (x, y, c) => {
    if (pts.length) { const p = pts[pts.length - 1]; acc += Math.hypot(x - p.x, y - p.y); }
    pts.push({ x, y }); arc.push(acc); curved.push(c);
  };
  push(P[0].x, P[0].y, false); vIdx.push(0);
  for (let i = 0; i < n - 1; i++) {
    const A = P[i], B = P[i + 1], L = len(sub(B, A));
    if (segStraight(i)) {
      const steps = Math.max(1, Math.ceil(L / 0.05));
      for (let k = 1; k <= steps; k++) { const t = k / steps; push(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t, false); }
    } else {
      const mA = tangent(i, i, true), mB = tangent(i + 1, i, false);
      const steps = Math.max(8, Math.ceil(L * 30));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        push(h00 * A.x + h10 * mA.x + h01 * B.x + h11 * mB.x, h00 * A.y + h10 * mA.y + h01 * B.y + h11 * mB.y, true);
      }
    }
    vIdx.push(pts.length - 1);
  }
  const total = acc;
  // checkpoints: sharp corners + end, then fill long gaps
  const raw = [];
  for (let v = 1; v < n - 1; v++) {
    if (isSm(v)) continue;
    const k = vIdx[v];
    const a = pts[Math.max(0, k - 2)], b = pts[k], c = pts[Math.min(pts.length - 1, k + 2)];
    const d1 = Math.atan2(b.y - a.y, b.x - a.x), d2 = Math.atan2(c.y - b.y, c.x - b.x);
    let turn = Math.abs(d2 - d1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn > 0.45) raw.push({ arc: arc[k], kind: "bell", corner: true });
  }
  raw.push({ arc: total, kind: "bell", end: true });
  const checks = [];
  let prev = 0;
  for (const c of raw) {
    const gap = c.arc - prev;
    if (gap > 2.0) {
      const k = Math.ceil(gap / 1.7);
      for (let j = 1; j < k; j++) checks.push({ arc: prev + gap * j / k, kind: "mid" });
    }
    checks.push(c); prev = c.arc;
  }
  const out = checks.filter(c => c.end || c.arc > 0.5);
  const merged = [];
  for (const c of out) {
    if (merged.length && c.arc - merged[merged.length - 1].arc < 0.45) merged[merged.length - 1] = c; else merged.push(c);
  }
  const st = { pts, arc, curved, L: total, checks: merged, src: P };
  for (const c of merged) {
    const p = pointAtArc(st, c.arc); c.x = p.x; c.y = p.y;
    if (c.kind === "mid") c.kind = curved[p.i] ? "spool" : "bell";
  }
  const p0 = pts[0], p1 = pts[Math.min(3, pts.length - 1)], pe = pts[pts.length - 1], pe0 = pts[Math.max(0, pts.length - 4)];
  st.start = { x: p0.x, y: p0.y }; st.end = { x: pe.x, y: pe.y };
  st.startDir = norm(p1.x - p0.x, p1.y - p0.y); st.endDir = norm(pe.x - pe0.x, pe.y - pe0.y);
  return st;
}
function norm(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

function pointAtArc(st, a) {
  const arc = st.arc; let lo = 0, hi = arc.length - 1;
  if (a <= 0) return { x: st.pts[0].x, y: st.pts[0].y, i: 0 };
  if (a >= arc[hi]) return { x: st.pts[hi].x, y: st.pts[hi].y, i: hi };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arc[m] < a) lo = m; else hi = m; }
  const t = (a - arc[lo]) / ((arc[hi] - arc[lo]) || 1);
  return { x: st.pts[lo].x + (st.pts[hi].x - st.pts[lo].x) * t, y: st.pts[lo].y + (st.pts[hi].y - st.pts[lo].y) * t, i: hi };
}

function nearestOnStroke(st, x, y, a0, a1) {
  let best = 1e9, bi = -1;
  const P = st.pts, A = st.arc;
  for (let i = 0; i < P.length; i++) {
    const a = A[i]; if (a < a0) continue; if (a > a1) break;
    const dx = P[i].x - x, dy = P[i].y - y, d = dx * dx + dy * dy;
    if (d < best) { best = d; bi = i; }
  }
  if (bi < 0) return null;
  return { i: bi, d: Math.sqrt(best), x: P[bi].x, y: P[bi].y, arc: A[bi] };
}

const _letterCache = {};
function compileLetter(ch, k = 1) {
  const key = ch + "@" + k;
  if (_letterCache[key]) return _letterCache[key];
  const def = STROKE_TABLE[ch];
  if (!def) throw new Error("no stroke for " + ch);
  const strokes = def.split("/").map(t => compileStroke(parseStroke(t, k)));
  return (_letterCache[key] = { ch, strokes, k });
}
