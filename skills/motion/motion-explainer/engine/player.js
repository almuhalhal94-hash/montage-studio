/* Motion explainer engine: a scene spec becomes a timeline, painted as SVG.
   Every frame is a pure function of time, so play, pause, scrub, skip and
   step all share one code path. No dependencies; works from file://.
   Scene format: REFERENCE.md. */
(function () {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
const Q = new URLSearchParams(location.search);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- lint sink: `motion check` reads it through --dump-dom ---------- */
const lintEl = document.createElement('pre');
lintEl.id = 'lint';
lintEl.hidden = true;
(document.body || document.documentElement).appendChild(lintEl);
const lint = line => { lintEl.textContent += line + '\n'; };
document.addEventListener('securitypolicyviolation', ev => lint(`error csp: blocked ${ev.violatedDirective} ${ev.blockedURI || ''}`));
window.addEventListener('error', ev => {
  lint(`error js: ${ev.message} (line ${ev.lineno})`);
  fatal(`${ev.message}\nline ${ev.lineno}`);
});

function fatal(msg) {
  const d = document.createElement('div');
  d.id = 'fatal';
  d.textContent = 'This explainer failed to load:\n\n' + msg;
  document.body.appendChild(d);
}

/* ---------- themes ---------- */
const THEMES = {
  dark: {
    bg: '#0b0b0c', panel: '#141416', fg: '#ededf0', dim: '#8b8b95', line: '#2c2c31', grid: '#1f1f23', fill: .16,
    tones: { plain: '#636369', muted: '#48484e', accent: '#0a84ff', ok: '#32d74b', warn: '#ffd60a', bad: '#ff453a',
             info: '#bf5af2', teal: '#64d2ff', orange: '#ff9f0a', pink: '#ff375f' },
  },
  light: {
    bg: '#f5f5f7', panel: '#ffffff', fg: '#1d1d1f', dim: '#6e6e73', line: '#d2d2d7', grid: '#e2e2e7', fill: .11,
    tones: { plain: '#a1a1a6', muted: '#c7c7cc', accent: '#0071e3', ok: '#248a3d', warn: '#b57600', bad: '#d70015',
             info: '#8944ab', teal: '#0a84a8', orange: '#c93400', pink: '#d30f45' },
  },
  hud: {
    bg: '#08090b', panel: '#101216', fg: '#f2efe9', dim: '#8a8f98', line: '#262a31', grid: '#16191e', fill: .15, hud: true,
    tones: { plain: '#5c6068', muted: '#3d4148', accent: '#ff4f1f', ok: '#4ade80', warn: '#fbbf24', bad: '#ff3b30',
             info: '#c084fc', teal: '#22d3ee', orange: '#ff8a3d', pink: '#ff4d8d' },
  },
};
for (const th of Object.values(THEMES)) { th.tones.fg = th.fg; th.tones.dim = th.dim; }

const hexCache = new Map();
function hex(c) {
  let v = hexCache.get(c);
  if (v) return v;
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  v = [n >> 16 & 255, n >> 8 & 255, n & 255];
  hexCache.set(c, v);
  return v;
}
function rgb(th, v) {
  if (Array.isArray(v)) return mix(rgb(th, v[0]), rgb(th, v[1]), v[2]);
  if (th.tones[v]) return hex(th.tones[v]);
  return typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v) ? hex(v) : hex(th.tones.plain);
}
const mix = (a, b, p) => a.map((x, i) => x + (b[i] - x) * p);
const css = (c, a) => a == null ? `rgb(${c.map(Math.round)})` : `rgba(${c.map(Math.round)},${a})`;
const isPlain = v => v == null || v === 'plain' || v === 'muted' || v === 'fg' || v === 'dim';

/* ---------- math ---------- */
const EASE = {
  linear: p => p,
  inOut: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  back: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  bounce: p => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) { const q = p - 1.5 / d; return n * q * q + .75; }
    if (p < 2.5 / d) { const q = p - 2.25 / d; return n * q * q + .9375; }
    const q = p - 2.625 / d;
    return n * q * q + .984375;
  },
  elastic: p => p <= 0 || p >= 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI / 3)) + 1,
  anticipate: p => {
    const c = 1.70158 * 1.525;
    return p < .5 ? Math.pow(2 * p, 2) * ((c + 1) * 2 * p - c) / 2 : (Math.pow(2 * p - 2, 2) * ((c + 1) * (p * 2 - 2) + c) + 2) / 2;
  },
};
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = (a, b, v) => { const p = clamp01((v - a) / (b - a)); return p * p * (3 - 2 * p); };
const lerp = (a, b, p) => a + (b - a) * p;
const TAU = Math.PI * 2;
const list = v => v == null || v === false ? [] : Array.isArray(v) ? v : [v];
// ' Did you mean 'x'?' for a typo within two edits of a known name, else ''.
function near(word, names) {
  const w = String(word), dist = (a, b) => {
    let row = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length];
  };
  let best = null, bd = 3;
  for (const n of names) { const d = dist(w.toLowerCase(), String(n).toLowerCase()); if (d < bd && d < w.length) { best = n; bd = d; } }
  return best == null ? '' : ` Did you mean '${best}'?`;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const union = rs => rs.reduce((u, r) => [Math.min(u[0], r[0]), Math.min(u[1], r[1]), Math.max(u[2], r[2]), Math.max(u[3], r[3])]);
const hits = (a, b) => a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2;
const inside = (a, b) => a[0] <= b[0] + 1 && a[1] <= b[1] + 1 && a[2] >= b[2] - 1 && a[3] >= b[3] - 1; // a contains b

function fit(r, pad, W, H) {
  const x0 = r[0] - pad, y0 = r[1] - pad, x1 = r[2] + pad, y1 = r[3] + pad;
  let w = Math.max(x1 - x0, W / 10), h = Math.max(y1 - y0, H / 10);
  if (w / h > W / H) h = w * H / W; else w = h * W / H;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

/* ---------- text measuring (canvas, so lint and paint agree) ---------- */
const mctx = document.createElement('canvas').getContext('2d');
function textW(s, size, weight, mono) {
  mctx.font = `${weight || 400} ${size}px ${mono ? MONO : SANS}`;
  return mctx.measureText(s).width;
}
const wrapCache = new Map();
function wrap(str, maxw, size, weight, mono) {
  const key = [str, maxw, size, weight, mono].join('|');
  let out = wrapCache.get(key);
  if (out) return out;
  out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const cand = line ? line + ' ' + word : word;
      if (!line || textW(cand, size, weight, mono) <= maxw) line = cand;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  wrapCache.set(key, out);
  return out;
}
const widest = (lines, size, weight, mono) => Math.max(0, ...lines.map(l => textW(l, size, weight, mono)));

/* ---------- elements ---------- */
const LAYER = { zone: 0, frame: 0, particles: 0, arrow: 1, box: 2, circle: 2, code: 2, icon: 2, chart: 2, note: 3, text: 3, title: 3 };
// Arrows normally sit under boxes; zoomed-in arrows sit with the boxes, so they draw over the box they are inside.
const layerOf = e => e.layer ?? (e.type === 'arrow' && e.minZoom ? 2 : LAYER[e.type]);
const ENTRY = { box: 'pop', circle: 'pop', arrow: 'draw', text: 'up', note: 'up', zone: 'fade', code: 'fade', icon: 'pop',
  title: 'words', frame: 'fade', chart: 'grow', particles: 'fade' };
const KINETIC = new Set(['type', 'words', 'scramble']);
const CONTAINERS = new Set(['zone', 'frame']);
const KINDS = { chart: ['bar', 'line', 'spark'], frame: ['window', 'terminal', 'browser', 'phone'], particles: ['drift', 'rise', 'burst'] };

function norm(d) {
  const e = Object.assign({}, d), t = e.type;
  if (t === 'box') { e.w = e.w ?? 200; e.h = e.h ?? 90; e.shape = e.shape || 'rect'; e.size = e.size || 22; }
  if (t === 'circle') e.r = e.r ?? 44;
  if (t === 'zone') { e.w = e.w ?? 600; e.h = e.h ?? 400; }
  if (t === 'code') {
    e.lines = e.lines || []; e.size = e.size || 17; e.lh = e.size * 1.65; e.head = e.title ? 34 : 0;
    e.w = e.w ?? 560; e.h = e.h ?? e.head + e.lines.length * e.lh + 28;
  }
  if (t === 'note') { e.w = e.w ?? 320; e.size = e.size || 17; }
  if (t === 'text') { e.size = e.size || 24; e.weight = e.weight || (e.size >= 34 ? 700 : 500); e.align = e.align || 'middle'; }
  if (t === 'arrow') e.width = e.width || 2.5;
  if (t === 'icon') { e.size = e.size || 48; e.w = e.h = e.size; }
  if (t === 'title') { e.size = e.size || 64; e.weight = e.weight || 800; e.align = e.align || 'start'; }
  if (t === 'frame') {
    e.kind = e.kind || 'window';
    e.w = e.w ?? (e.kind === 'phone' ? 300 : 640); e.h = e.h ?? (e.kind === 'phone' ? 600 : 400);
    e.lines = e.lines || []; e.size = e.size || 16; e.mono = e.mono ?? (e.kind === 'terminal' || e.kind === 'window');
  }
  if (t === 'chart') { e.kind = e.kind || 'bar'; e.w = e.w ?? 440; e.h = e.h ?? 260; e.data = e.data || []; e.labels = e.labels || []; }
  if (t === 'particles') { e.w = e.w ?? 600; e.h = e.h ?? 400; e.n = e.n || 40; e.mode = e.mode || 'drift'; e.size = e.size || 2.5; e.speed = e.speed ?? 1; }
  e.tone = e.tone || (t === 'text' || t === 'icon' ? 'fg' : t === 'zone' ? 'muted' : t === 'title' || t === 'chart' || t === 'particles' ? 'accent' : 'plain');
  return e;
}

// Shown string: a numeric `value` (tweened) wins over the static label.
function shown(e, s) {
  if (s.value != null) return (e.fmt || '{}').replace('{}', Number(s.value).toFixed(e.decimals || 0));
  return e.type === 'text' || e.type === 'note' || e.type === 'title' ? (s.text ?? s.label) : s.label;
}

function measure(e, s) {
  const str = shown(e, s) ?? '';
  if (e.type === 'title') {
    const T = titleLayout(e, str);
    return { w: T.w, h: T.h };
  }
  if (e.type === 'text') {
    const L = wrap(str, e.maxw || 1e9, e.size, e.weight, e.mono);
    return { w: widest(L, e.size, e.weight, e.mono), h: L.length * e.size * 1.25 };
  }
  const L = wrap(str, s.w - 36, e.size, 400), T = noteTitle(e, s);
  return { w: s.w, h: 30 + (T.length ? T.length * e.size * 1.35 + 4 : 0) + L.length * e.size * 1.45 };
}

// Kicker (small caps), big lines, then an accent bar; shared by measure, lint and paint.
function titleLayout(e, str) {
  const L = wrap(str, e.maxw || 1e9, e.size, e.weight), lh = e.size * 1.08, ks = Math.max(12, e.size * .26);
  const kick = e.kicker ? String(e.kicker).toUpperCase() : '', kh = kick ? ks * 1.9 : 0, bar = Math.max(4, e.size * .085);
  const tw = widest(L, e.size, e.weight), w = Math.max(tw, kick ? textW(kick, ks, 700) + kick.length * ks * .18 : 0);
  return { L, lh, ks, kick, kh, bar, tw, w, h: kh + L.length * lh + bar * 3 };
}

function frameTop(e) {
  return (e.kind === 'phone' ? 50 : 36) + 14;
}

// Same id, same sequence: particles sit in the same places on every frame and in screenshots.
function seeded(str) {
  let a = 2166136261;
  for (const ch of String(str)) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/';
const ICONSTYLE = { fill: 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// Bold, so it wraps at a different point than the body text.
function noteTitle(e, s) {
  return e.title ? wrap(e.title, s.w - 36, e.size, 700) : [];
}

function boxText(e, s) {
  const label = shown(e, s);
  const circ = e.type === 'circle';
  const maxw = circ ? s.r * 1.7 : e.shape === 'diamond' ? s.w * .6 : e.shape === 'pill' ? s.w - s.h * .5 : s.w - 28;
  const size = circ ? (e.size || Math.min(26, s.r * .62)) : e.size;
  const L = label == null || label === '' ? [] : wrap(String(label), maxw, size, 600);
  const ss = e.subSize || (circ ? 15 : Math.round(size * .68 * 10) / 10);
  const SB = s.sub ? wrap(String(s.sub), circ ? 220 : maxw, ss, 400) : [];
  const iconH = s.icon && !circ ? 40 : 0, lh = size * 1.2, sh = ss * 1.3, gap = L.length && SB.length ? size * .22 : 0;
  const total = iconH + L.length * lh + (circ ? 0 : gap + SB.length * sh);
  return { L, SB, size, ss, maxw, iconH, lh, sh, gap, total, key: [label, s.sub, s.icon, maxw, size].join('\u0001') };
}

function bbox(e, s, S) {
  if (e.type === 'arrow') {
    const a = endPt(e.from, S), b = endPt(e.to, S);
    return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
  }
  const y = s.y + (s.oy || 0);
  if (e.type === 'circle') return [s.x - s.r, y - s.r, s.x + s.r, y + s.r];
  if (e.type === 'text' || e.type === 'title') {
    const x0 = e.align === 'start' ? s.x : e.align === 'end' ? s.x - s.w : s.x - s.w / 2;
    return [x0, y - s.h / 2, x0 + s.w, y + s.h / 2];
  }
  return [s.x - s.w / 2, y - s.h / 2, s.x + s.w / 2, y + s.h / 2];
}
function endPt(ref, S) {
  if (Array.isArray(ref)) return { x: ref[0], y: ref[1] };
  const s = S[ref];
  return s ? { x: s.x, y: s.y + (s.oy || 0) } : { x: 0, y: 0 };
}

/* ---------- flow packets: their route, and hand-offs through components ---------- */
const FLOW_TAIL = .45;  // seconds a landing ripple and glow last after a flow ends
const center = (e, s, S) => { const r = bbox(e, s, S); return { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2 }; };
const lerpPt = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
// [where the packet starts, where it lands]: element ids, or arrays for free points.
function flowEnds(f, by) {
  const a = by[f.edges[0]], z = by[f.edges[f.edges.length - 1]];
  return f.reverse ? [z.to, a.from] : [a.from, z.to];
}
// The path a packet rides: each arrow, plus a short pass through every component two arrows share,
// so a multi-arrow flow goes in and out of the box instead of jumping across it.
function flowRoute(f, S, by) {
  const E = f.reverse ? f.edges.slice().reverse() : f.edges, segs = [];
  for (let i = 0; i < E.length; i++) {
    const e = by[E[i]], ge = edgeGeom(e, S, by);
    if (!ge) return null;
    const G = f.reverse ? { p0: ge.p2, c: ge.c, p2: ge.p0 } : ge;
    const via = i && (f.reverse ? by[E[i - 1]].from : by[E[i - 1]].to), start = f.reverse ? e.to : e.from;
    if (i && via === start && by[start] && S[start]) {
      const a = segs[segs.length - 1].end, b = G.p0, c = center(by[start], S[start], S);
      const cc = { x: 2 * c.x - (a.x + b.x) / 2, y: 2 * c.y - (a.y + b.y) / 2 };  // the curve passes through the center
      segs.push({ w: .5, node: start, from: a, at: k => bez({ p0: a, c: cc, p2: b }, k) });
    }
    segs.push({ w: 1, at: k => bez(G, k), end: G.p2 });
  }
  return segs;
}
// A point on the route at u in 0..1; inside a component it carries the node, its progress k and how far in it is.
function routeAt(segs, u) {
  let x = clamp01(u) * segs.reduce((n, sg) => n + sg.w, 0);
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (x <= sg.w + 1e-9 || i === segs.length - 1) {
      const k = clamp01(x / sg.w), pt = sg.at(k);
      return sg.node ? { x: pt.x, y: pt.y, node: sg.node, from: sg.from, k, inside: Math.min(1, k * 4, (1 - k) * 4) } : { x: pt.x, y: pt.y, inside: 0 };
    }
    x -= sg.w;
  }
}
// Two flows in a row through the same component share one packet: it waits inside between them.
function linkFlows(fx, by) {
  const flows = fx.filter(f => f.k === 'flow' && f.count === 1).sort((a, b) => a.t0 - b.t0);
  for (const b of flows) {
    const start = flowEnds(b, by)[0];
    if (typeof start !== 'string' || !by[start]) continue;
    const a = flows.filter(f => f !== b && !f.next && f.t0 < b.t0 && flowEnds(f, by)[1] === start && f.t1 <= b.t0 + .05 && b.t0 - f.t1 <= 2.5).pop();
    if (!a) continue;
    // Short gaps borrow a little time from both flows, so the pass through the component never snaps.
    const pad = Math.max(0, (.5 - (b.t0 - a.t1)) / 2);
    Object.assign(a, { next: b, cut: a.t1 - pad });
    Object.assign(b, { prev: a, cut: b.t0 + pad });
    fx.push({ k: 'hold', node: start, a, b, t0: a.t1 - pad, t1: b.t0 + pad, tone: a.tone });
  }
}

/* ---------- arrows: quadratic curves clipped to their end shapes ---------- */
function anchor(ref, S, by, off) {
  if (Array.isArray(ref)) return { x: ref[0], y: ref[1], k: 'pt' };
  const s = S[ref], e = by[ref];
  if (!s || !e) return null;
  if (off) return { x: s.x + off[0], y: s.y + (s.oy || 0) + off[1], k: 'pt' };
  if (e.type === 'text' || e.type === 'title') {
    const r = bbox(e, s, S);
    return { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: r[2] - r[0], h: r[3] - r[1], k: 'rect' };
  }
  const k = e.type === 'circle' ? 'circle' : e.shape === 'diamond' ? 'diamond' : 'rect';
  return { x: s.x, y: s.y + (s.oy || 0), w: s.w, h: s.h, r: s.r, k };
}
function edgeOf(A, dx, dy, gap) {
  if (!dx && !dy) return { x: A.x, y: A.y };
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  let t = 0;
  if (A.k === 'circle') t = A.r;
  else if (A.k === 'diamond') t = 1 / (Math.abs(ux) / (A.w / 2) + Math.abs(uy) / (A.h / 2));
  else if (A.k === 'rect') t = Math.min(ux ? A.w / 2 / Math.abs(ux) : 1e9, uy ? A.h / 2 / Math.abs(uy) : 1e9);
  if (A.k !== 'pt') t += gap;
  return { x: A.x + ux * t, y: A.y + uy * t };
}
function edgeGeom(e, S, by) {
  const A = anchor(e.from, S, by, e.fromOffset), B = anchor(e.to, S, by, e.toOffset);
  if (!A || !B) return null;
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, bend = e.bend || 0;
  let c = { x: (A.x + B.x) / 2 - dy * bend * .5, y: (A.y + B.y) / 2 + dx * bend * .5 };
  const gap = e.gap ?? 8;
  const p0 = edgeOf(A, c.x - A.x, c.y - A.y, gap), p2 = edgeOf(B, c.x - B.x, c.y - B.y, gap);
  if (!bend) c = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  return { p0, c, p2, len };
}
const bez = (g, u) => { const v = 1 - u; return { x: v * v * g.p0.x + 2 * v * u * g.c.x + u * u * g.p2.x, y: v * v * g.p0.y + 2 * v * u * g.c.y + u * u * g.p2.y }; };
const bezD = (g, u) => ({ x: 2 * (1 - u) * (g.c.x - g.p0.x) + 2 * u * (g.p2.x - g.c.x), y: 2 * (1 - u) * (g.c.y - g.p0.y) + 2 * u * (g.p2.y - g.c.y) });
const unit = d => { const L = Math.hypot(d.x, d.y) || 1; return { x: d.x / L, y: d.y / L }; };
function labelRect(e, g, label) {
  const ls = e.labelSize || 14, m = bez(g, e.labelAt ?? .5), w = textW(String(label), ls, 500) + ls * 1.4;
  return [m.x - w / 2, m.y - ls * .93, m.x + w / 2, m.y + ls * .93];
}

/* ---------- compile: spec -> tweens + transient effects + steps ---------- */
const VERBS = ['show', 'hide', 'set', 'move', 'highlight', 'unhighlight', 'focus', 'unfocus', 'flow', 'pulse', 'camera', 'swap', 'line', 'wait'];
const TIMING = new Set(['at', 'with', 'dur', 'ease', 'stagger', 'fx']);
const NUMP = ['x', 'y', 'w', 'h', 'r', 'value', 'alpha', 'mark', 'typed'];
const DISCP = ['label', 'sub', 'text', 'icon', 'name'];
const BACKDROPS = ['dots', 'grid', 'glow', 'none'];
const DUR = { show: .6, hide: .45, set: .7, move: .8, highlight: .4, unhighlight: .35, focus: .5, unfocus: .5, flow: 1.2, pulse: .9, camera: 1.2, swap: .9, line: .35 };

function compile(spec) {
  const issues = [];
  const say = (lvl, step, msg) => issues.push({ lvl, step, msg });
  const [W, H] = spec.size || [1600, 900];
  const els = [], by = {};
  for (const d of spec.elements || []) {
    if (!d || !d.id) { say('error', 0, 'an element has no id'); continue; }
    if (by[d.id]) { say('error', 0, `duplicate id '${d.id}'`); continue; }
    if (!(d.type in LAYER)) { say('error', 0, `'${d.id}': unknown type '${d.type}'.${near(d.type, Object.keys(LAYER)) || ` Use ${Object.keys(LAYER).join(', ')}.`}`); continue; }
    if (d.id === 'all' || d.id === 'canvas') { say('error', 0, `'${d.id}' is a reserved id`); continue; }
    const e = norm(d);
    els.push(e);
    by[e.id] = e;
  }
  for (const e of els) {
    if (e.type !== 'arrow') continue;
    for (const end of [e.from, e.to]) if (!Array.isArray(end) && !by[end]) say('error', 0, `arrow '${e.id}': unknown endpoint '${end}'.${near(end, Object.keys(by))}`);
  }
  for (const e of els) {
    if (e.type === 'icon' && !MOTION_ICONS[e.name]) say('error', 0, `icon '${e.id}': unknown name '${e.name}'.${near(e.name, Object.keys(MOTION_ICONS)) || ' See REFERENCE.md, Icons.'}`);
    else if (e.type === 'box' && /^[a-z][a-z0-9-]+$/.test(e.icon || '') && !MOTION_ICONS[e.icon]) {
      say('warn', 0, `'${e.id}': '${e.icon}' is not a known icon, so it is drawn as text`);
    }
    if (e.type === 'chart' && !e.data.length) say('error', 0, `chart '${e.id}' has no data`);
    const kinds = KINDS[e.type], kind = e.type === 'particles' ? e.mode : e.kind;
    if (kinds && !kinds.includes(kind)) say('warn', 0, `${e.type} '${e.id}': unknown ${e.type === 'particles' ? 'mode' : 'kind'} '${kind}' (use ${kinds.join(', ')})`);
  }
  if (spec.backdrop && !BACKDROPS.includes(spec.backdrop)) say('warn', 0, `unknown backdrop '${spec.backdrop}' (use ${BACKDROPS.join(', ')})`);

  const init = { $cam: { x: 0, y: 0, w: W, h: H } };
  for (const e of els) {
    init[e.id] = {
      x: e.x || 0, y: e.y || 0, w: e.w || 0, h: e.h || 0, r: e.r || 0, op: e.on ? 1 : 0, alpha: e.alpha ?? 1,
      hl: 0, dim: 0, oy: 0, cur: e.cur || 0, value: e.value, tone: e.tone, hlTone: 'accent',
      label: e.label, sub: e.sub, text: e.text, icon: e.icon, name: e.name, fx: e.fx || ENTRY[e.type],
      mark: e.mark || 0, typed: e.typed ?? 1, data: e.data && e.data.slice(),
    };
    if (e.type === 'text' || e.type === 'note' || e.type === 'title') Object.assign(init[e.id], measure(e, init[e.id]));
    if (e.type === 'chart') e.top = Math.max(1e-9, ...e.data);
  }

  const cur = {};
  for (const id in init) cur[id] = Object.assign({}, init[id]);
  const tweens = [], fx = [], steps = [];
  const sets = voiceSets(), voice = sets && Object.fromEntries(Object.keys(sets).map(n => [n, []]));
  let si = 0;
  const tw = (id, p, b, t0, t1, k = 'num', e = 'inOut', amp) => {
    if (!EASE[e]) { say('warn', si + 1, `unknown ease '${e}'.${near(e, Object.keys(EASE)) || ` Use ${Object.keys(EASE).join(', ')}.`}`); e = 'inOut'; }
    tweens.push({ id, p, a: cur[id][p] ?? b, b, t0, t1, k, e, amp });
    cur[id][p] = b;
  };
  const known = id => {
    if (by[id]) return true;
    say('error', si + 1, `unknown id '${id}'.${near(id, Object.keys(by))}`);
    return false;
  };
  const ids = v => list(v).filter(known);
  const bb = id => bbox(by[id], cur[id], cur);
  const remeasure = (id, s, d) => {
    const e = by[id];
    if (e.type !== 'text' && e.type !== 'note' && e.type !== 'title') return;
    const m = measure(e, cur[id]);
    tw(id, 'w', m.w, s, s + d, 'disc');
    tw(id, 'h', m.h, s, s + d, 'disc');
  };

  const EMIT = {
    show(a, s) {
      const L = ids(a.show), st = a.stagger ?? (L.length > 1 ? .08 : 0);
      let span = 0;
      L.forEach((id, i) => {
        const t = s + i * st, f = a.fx || by[id].fx || ENTRY[by[id].type], d = a.dur ?? entryDur(f, shown(by[id], cur[id]));
        tw(id, 'fx', f, t, t, 'disc');
        tw(id, 'op', 1, t, t + d, 'num', 'linear');
        span = Math.max(span, i * st + d);
      });
      return span;
    },
    hide(a, s) {
      const L = ids(a.hide), st = a.stagger ?? 0, d = a.dur ?? DUR.hide;
      L.forEach((id, i) => {
        const t = s + i * st;
        tw(id, 'fx', a.fx || 'fade', t, t, 'disc');
        tw(id, 'op', 0, t, t + d, 'num', 'linear');
      });
      return L.length ? (L.length - 1) * st + d : 0;
    },
    set(a, s) {
      const d = a.dur ?? DUR.set;
      for (const id of ids(a.set)) {
        for (const p of Object.keys(a)) {
          if (p === 'set' || TIMING.has(p)) continue;
          if (p === 'data' && by[id].type === 'chart') {
            const v = list(a.data);
            if (v.length !== by[id].data.length) { say('error', si + 1, `set: chart '${id}' has ${by[id].data.length} values, data has ${v.length}`); continue; }
            tw(id, 'data', v.slice(), s, s + d, 'arr', a.ease || 'inOut');
            by[id].top = Math.max(by[id].top, ...v);
          } else if (NUMP.includes(p)) { tw(id, p, a[p], s, s + d, 'num', a.ease || 'inOut'); if (p === 'value') remeasure(id, s, d); }
          else if (p === 'tone') tw(id, 'tone', a[p], s, s + d, 'col');
          else if (DISCP.includes(p)) {
            if (p === 'name' && by[id].type === 'icon' && !MOTION_ICONS[a[p]]) say('error', si + 1, `set: icon '${id}': unknown name '${a[p]}'`);
            else if (p === 'icon' && by[id].type === 'box' && /^[a-z][a-z0-9-]+$/.test(a[p] || '') && !MOTION_ICONS[a[p]]) {
              say('warn', si + 1, `set: '${id}': '${a[p]}' is not a known icon, so it is drawn as text`);
            }
            tw(id, p, a[p], s, s + d, 'disc');
            remeasure(id, s, d);
          }
          else say('warn', si + 1, `set: unknown property '${p}' (allowed: ${NUMP.concat('tone', 'data', DISCP).join(', ')})`);
        }
      }
      return d;
    },
    move(a, s) {
      const d = a.dur ?? DUR.move, m = a.move;
      const targets = m && typeof m === 'object' && !Array.isArray(m) ? Object.entries(m).filter(([id]) => known(id)) : ids(m).map(id => [id, a]);
      for (const [id, o] of targets) {
        const c = cur[id];
        let x = o.x ?? c.x, y = o.y ?? c.y;
        if (o.to != null && known(o.to)) { x = cur[o.to].x; y = cur[o.to].y; }
        x += o.dx || 0;
        y += o.dy || 0;
        if (x !== c.x) tw(id, 'x', x, s, s + d, 'num', a.ease || 'inOut');
        if (y !== c.y) tw(id, 'y', y, s, s + d, 'num', a.ease || 'inOut');
      }
      return d;
    },
    highlight(a, s) {
      const d = a.dur ?? DUR.highlight;
      for (const id of ids(a.highlight)) {
        tw(id, 'hlTone', a.tone || (isPlain(cur[id].tone) ? 'accent' : cur[id].tone), s, s + d, 'col');
        tw(id, 'hl', 1, s, s + d);
      }
      return d;
    },
    unhighlight(a, s) {
      const d = a.dur ?? DUR.unhighlight;
      const L = a.unhighlight === '*' || a.unhighlight === true ? els.filter(e => cur[e.id].hl > 0).map(e => e.id) : ids(a.unhighlight);
      for (const id of L) tw(id, 'hl', 0, s, s + d);
      return d;
    },
    focus(a, s) {
      if (a.focus == null || a.focus === false) return EMIT.unfocus(a, s);
      const d = a.dur ?? DUR.focus, F = new Set(ids(a.focus));
      for (const e of els) if (e.type === 'arrow' && F.has(e.from) && F.has(e.to)) F.add(e.id);
      for (const e of els) {
        const want = F.has(e.id) ? 0 : 1;
        if (cur[e.id].dim !== want) tw(e.id, 'dim', want, s, s + d);
      }
      return d;
    },
    unfocus(a, s) {
      const d = a.dur ?? DUR.unfocus;
      for (const e of els) if (cur[e.id].dim !== 0) tw(e.id, 'dim', 0, s, s + d);
      return d;
    },
    flow(a, s) {
      const L = ids(a.flow).filter(id => by[id].type === 'arrow' || (say('error', si + 1, `flow: '${id}' is not an arrow`), false));
      if (!L.length) return 0;
      for (const id of L) if (cur[id].op < .5) say('warn', si + 1, `flow on '${id}', which is hidden at that moment`);
      const d = a.dur ?? (L.length === 1 ? DUR.flow : .75 * L.length);
      const tone = a.tone || (isPlain(cur[L[0]].tone) ? 'accent' : cur[L[0]].tone);
      fx.push({ k: 'flow', edges: L, t0: s, t1: s + d, tone, label: a.label, count: Math.max(1, a.count || 1), reverse: !!a.reverse });
      return d;
    },
    pulse(a, s) {
      const d = a.dur ?? DUR.pulse;
      for (const id of ids(a.pulse)) fx.push({ k: 'pulse', id, t0: s, t1: s + d, tone: a.tone || (isPlain(cur[id].tone) ? 'accent' : cur[id].tone) });
      return d;
    },
    camera(a, s) {
      const d = a.dur ?? DUR.camera, v = a.camera;
      let r;
      if (v === 'canvas') r = { x: 0, y: 0, w: W, h: H };
      else if (v && typeof v === 'object' && !Array.isArray(v)) {
        const z = v.zoom || 1;
        r = { x: (v.x ?? W / 2) - W / z / 2, y: (v.y ?? H / 2) - H / z / 2, w: W / z, h: H / z };
      } else {
        const L = v === 'all' ? els.filter(e => cur[e.id].op > .5 && !e.minZoom).map(e => e.id) : ids(v);
        if (!L.length) return 0;
        r = fit(union(L.map(bb)), a.pad ?? 60, W, H);
      }
      for (const p of ['x', 'y', 'w', 'h']) tw('$cam', p, r[p], s, s + d, 'num', a.ease || 'inOut');
      return d;
    },
    swap(a, s) {
      const [p, q] = list(a.swap);
      if (!known(p) || !known(q)) return 0;
      const d = a.dur ?? DUR.swap, A = Object.assign({}, cur[p]), B = Object.assign({}, cur[q]);
      const amp = a.arc ?? Math.min(90, Math.hypot(A.x - B.x, A.y - B.y) * .35 + 20);
      tw(p, 'x', B.x, s, s + d); tw(p, 'y', B.y, s, s + d);
      tw(q, 'x', A.x, s, s + d); tw(q, 'y', A.y, s, s + d);
      tw(p, 'oy', 0, s, s + d, 'arc', 'inOut', -amp);
      tw(q, 'oy', 0, s, s + d, 'arc', 'inOut', amp);
      return d;
    },
    line(a, s) {
      const d = a.dur ?? DUR.line;
      for (const id of ids(a.line)) tw(id, 'cur', a.n ?? 0, s, s + d);
      return d;
    },
    wait(a) { return +a.wait || 0; },
  };

  let T = 0;
  (spec.steps || []).forEach((st, k) => {
    si = k;
    const t0 = T;
    let gS = T, gE = T, end = T;
    for (const a of list(st.do)) {
      const vs = VERBS.filter(v => v in a);
      if (vs.length !== 1) {
        const typo = Object.keys(a).map(key => near(key, VERBS)).find(Boolean);
        say('error', k + 1, vs.length ? `one verb per action, got ${vs.join(' + ')}` : `action without a verb: ${JSON.stringify(a)}.${typo || ` Verbs: ${VERBS.join(', ')}.`}`);
        continue;
      }
      const s = a.at != null ? t0 + a.at : a.with ? gS : gE;
      const span = EMIT[vs[0]](a, s);
      if (a.with || a.at != null) { gS = s; gE = Math.max(gE, s + span); } else { gS = s; gE = s + span; }
      end = Math.max(end, s + span);
    }
    if (!st.title) say('warn', k + 1, 'step has no title');
    const words = (st.say || '').split(/\s+/).filter(Boolean).length;
    if (words > 60) say('warn', k + 1, `narration is ${words} words; split the step (aim for <= 40)`);
    // Every voice must fit the step, so it holds for the longest fresh clip.
    let dur = 0, stale = false;
    for (const n in voice) {
      const clip = sets[n][k], fresh = clip && clip.say === (st.say || '') ? clip : null;
      if (clip && !fresh) stale = true;
      voice[n].push(fresh);
      if (fresh) dur = Math.max(dur, fresh.dur);
    }
    if (stale) say('warn', k + 1, 'voice clip is out of date (narration changed); run motion voice again');
    const spoken = dur ? (REDUCE ? end : t0) + dur + .4 - end : 0;
    // Narrated steps move on when the voice ends; the reading-time guess is only for silent ones.
    const read = dur ? 0 : Math.min(9, Math.max(1.2, words / 3.2 + .8 - (end - t0) * .6));
    const hold = Math.max(.3, spoken, st.hold ?? read);
    steps.push({ title: st.title || `Step ${k + 1}`, say: st.say || '', t0, rest: end, t1: end + hold });
    T = end + hold;
  });
  if (!steps.length) say('error', 0, 'scene has no steps');
  for (const n in voice) {
    if (sets[n].length !== steps.length) say('warn', 0, `voice has ${sets[n].length} clips for ${steps.length} steps; run motion voice again`);
    if (!voice[n].some(Boolean)) delete voice[n];
  }
  linkFlows(fx, by);
  return { W, H, els, by, init, tweens, fx, steps, total: T, issues, title: spec.title || 'Explainer',
    voice: voice && Object.keys(voice).length ? voice : null, backdrop: spec.backdrop || 'dots' };
}

// Kinetic text takes as long as its length needs; everything else uses the show default.
function entryDur(fx, str) {
  const text = String(str ?? '');
  if (fx === 'type' || fx === 'scramble') return Math.min(4, Math.max(.6, text.length * .035));
  if (fx === 'words') return Math.min(3, Math.max(.6, text.split(/\s+/).filter(Boolean).length * .14));
  return DUR.show;
}

// Kokoro ids read as names in the picker: ef_dora -> Dora, af_heart -> Heart.
const voiceName = n => n.replace(/^[a-z][fm]_/, '').replace(/^./, c => c.toUpperCase());

// `motion voice` embeds Motion.voice = { voiceName: [one clip per step] }; a bare array is one unnamed voice.
function voiceSets() {
  const v = window.Motion && window.Motion.voice;
  return Array.isArray(v) ? { voice: v } : v && typeof v === 'object' ? v : null;
}

// A clip starts with its step; with reduced motion the playhead skips to rest, so it starts there.
function voiceAt(s) {
  return REDUCE ? s.rest : s.t0;
}

function stateAt(C, t) {
  const S = {};
  for (const id in C.init) S[id] = Object.assign({}, C.init[id]);
  for (const w of C.tweens) {
    if (t < w.t0) continue;
    const s = S[w.id];
    if (t >= w.t1) { s[w.p] = w.b; continue; }
    const p = (t - w.t0) / (w.t1 - w.t0);
    if (w.k === 'num') s[w.p] = lerp(w.a, w.b, EASE[w.e](p));
    else if (w.k === 'col') s[w.p] = [w.a, w.b, EASE.inOut(p)];
    else if (w.k === 'arc') s[w.p] = w.amp * Math.sin(Math.PI * EASE.inOut(p));
    else if (w.k === 'arr') s[w.p] = w.b.map((v, i) => lerp((w.a || [])[i] ?? 0, v, EASE[w.e](p)));
    else s[w.p] = p < .5 ? w.a : w.b;
  }
  return S;
}

/* ---------- lint: layout problems at every step's resting state ---------- */
function lintLayout(C) {
  const { els, by, W, H, steps } = C, seen = new Set();
  steps.forEach((st, k) => {
    const warn = msg => { if (!seen.has(msg)) { seen.add(msg); C.issues.push({ lvl: 'warn', step: k + 1, msg }); } };
    const S = stateAt(C, st.rest);
    const on = els.filter(e => S[e.id].op > .5 && S[e.id].alpha > .05);
    const solid = e => e.type !== 'arrow' && e.type !== 'particles';
    const box = e => ({ e, r: bbox(e, S[e.id], S) });
    const vis = on.filter(e => !e.minZoom), boxes = vis.filter(solid).map(box);
    for (const { e, r } of boxes) if (r[0] < -2 || r[1] < -2 || r[2] > W + 2 || r[3] > H + 2) warn(`'${e.id}' sticks out of the ${W}x${H} canvas`);
    // Text has to fit its box at any zoom, so insides that only appear zoomed in are checked too.
    for (const e of on.filter(solid)) fitText(e, S[e.id], warn);
    for (const { e: z, r: zr } of boxes) {
      if (z.type !== 'zone' || !S[z.id].label || (z.labelMaxZoom && z.labelMaxZoom < 1)) continue;
      const lab = String(S[z.id].label).toUpperCase(), lw = textW(lab, 13, 700) + .12 * 13 * lab.length;
      const lr = [zr[0] + 16, zr[1] + 9, zr[0] + 20 + lw, zr[1] + 35];
      for (const { e: o, r } of boxes) if (o !== z && o.type !== 'zone' && inside(zr, r) && hits(lr, r)) warn(`label of zone '${z.id}' is covered by '${o.id}'`);
    }
    const order = new Map(els.map((e, i) => [e.id, i]));
    const above = (a, b) => layerOf(a) > layerOf(b) || (layerOf(a) === layerOf(b) && order.get(a.id) > order.get(b.id));
    lintScene(boxes, vis.filter(e => e.type === 'arrow'), S, by, warn, above);
    // Zoomed-in insides: each belongs to the smallest canvas element around its center, must stay inside it,
    // and is checked against the other insides of that element as if it were its own small canvas.
    const groups = new Map();
    for (const it of on.filter(e => e.minZoom && solid(e)).map(box)) {
      const cx = (it.r[0] + it.r[2]) / 2, cy = (it.r[1] + it.r[3]) / 2;
      const home = boxes.filter(b => b.e.type !== 'text' && b.r[0] < cx && cx < b.r[2] && b.r[1] < cy && cy < b.r[3])
        .sort((a, b) => (a.r[2] - a.r[0]) * (a.r[3] - a.r[1]) - (b.r[2] - b.r[0]) * (b.r[3] - b.r[1]))[0];
      if (!home) continue;
      if (!inside([home.r[0] + 2, home.r[1] + 2, home.r[2] - 2, home.r[3] - 2], it.r)) warn(`'${it.e.id}' sticks out of '${home.e.id}', the element it sits in`);
      if (!groups.has(home.e.id)) groups.set(home.e.id, []);
      groups.get(home.e.id).push(it);
    }
    for (const [hid, items] of groups) {
      const ids = new Set(items.map(i => i.e.id)), home = by[hid];
      const arrows = on.filter(e => e.minZoom && e.type === 'arrow' && [e.from, e.to].some(x => ids.has(x)));
      for (const a of arrows) if (!CONTAINERS.has(home.type) && !above(a, home)) warn(hidden(a, home));
      lintScene(items, arrows, S, by, warn, above);
    }
  });
}

const hidden = (a, o) => `arrow '${a.id}' is drawn under '${o.id}', which hides it; declare it after '${o.id}' or give it layer: ${layerOf(o) + 1}`;
// Overlaps, elements straddling a container, and arrows through or under boxes, for one set of things seen together.
function lintScene(boxes, arrows, S, by, warn, above) {
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (!hits(A.r, B.r) || inside(A.r, B.r) || inside(B.r, A.r)) continue;
    const za = CONTAINERS.has(A.e.type), zb = CONTAINERS.has(B.e.type), Z = za ? A : B;
    warn(za || zb ? `'${(za ? B : A).e.id}' straddles the edge of ${Z.e.type} '${Z.e.id}'` : `'${A.e.id}' overlaps '${B.e.id}'`);
  }
  for (const e of arrows) {
    for (const end of [e.from, e.to]) if (!Array.isArray(end) && S[end] && S[end].op < .5) warn(`arrow '${e.id}' is visible but its end '${end}' is hidden`);
    const g = edgeGeom(e, S, by);
    if (!g) continue;
    const ends = [e.from, e.to].filter(x => !Array.isArray(x) && by[x]).map(x => bbox(by[x], S[x], S));
    const lr = S[e.id].label ? labelRect(e, g, S[e.id].label) : null;
    for (const { e: o, r } of boxes) {
      if (o.type === 'zone' || o.id === e.from || o.id === e.to) continue;
      if (ends.length === 2 && ends.every(er => inside(r, er)) && !CONTAINERS.has(o.type) && !above(e, o)) { warn(hidden(e, o)); continue; }
      if (ends.some(er => inside(r, er) || inside(er, r))) continue;
      if (e.head === false) { if (lr && hits(lr, r)) warn(`label of line '${e.id}' collides with '${o.id}'`); continue; }
      const m = Math.min(6, (r[2] - r[0]) / 4, (r[3] - r[1]) / 4), sh = [r[0] + m, r[1] + m, r[2] - m, r[3] - m];
      for (let u = .08; u < .93; u += .06) {
        const p = bez(g, u);
        if (p.x > sh[0] && p.x < sh[2] && p.y > sh[1] && p.y < sh[3]) { warn(`arrow '${e.id}' passes through '${o.id}'`); break; }
      }
      if (lr && hits(lr, r)) warn(`label of arrow '${e.id}' collides with '${o.id}'`);
    }
  }
}

function fitText(e, s, warn) {
  if ((e.type === 'box' || e.type === 'circle') && shown(e, s) == null && !s.sub && !s.icon) return;
  if (e.type === 'box') {
    const b = boxText(e, s), room = e.shape === 'diamond' ? s.h * .62 : s.h - 10;
    if (b.total > room) warn(`text in '${e.id}' needs ${Math.ceil(b.total + 10)}px of height, box has ${Math.round(s.h)}`);
    if (widest(b.L, b.size, 600) > b.maxw + 4 || widest(b.SB, b.ss, 400) > b.maxw + 4) warn(`a word in '${e.id}' is wider than the box`);
  } else if (e.type === 'circle') {
    const b = boxText(e, s);
    if (b.L.length > 2 || widest(b.L, b.size, 600) > s.r * 1.85) warn(`label of circle '${e.id}' does not fit in r=${s.r}`);
  } else if (e.type === 'code') {
    const w = widest(e.lines, e.size, 400, true);
    if (w > s.w - 64) warn(`code '${e.id}' needs w >= ${Math.ceil(w + 64)}`);
    if (e.head + e.lines.length * e.lh + 20 > s.h) warn(`code '${e.id}' needs h >= ${Math.ceil(e.head + e.lines.length * e.lh + 28)}`);
  } else if (e.type === 'frame') {
    const room = s.w - 36, wide = e.lines.find(l => textW(String(l), e.size, 400, e.mono) > room);
    if (wide != null) warn(`a line in frame '${e.id}' is wider than the frame: "${String(wide).slice(0, 40)}"`);
    if (frameTop(e) + e.lines.length * e.size * 1.6 + 16 > s.h) warn(`frame '${e.id}' needs h >= ${Math.ceil(frameTop(e) + e.lines.length * e.size * 1.6 + 24)}`);
  } else if (e.type === 'note') {
    const L = wrap(shown(e, s) || '', s.w - 36, e.size, 400);
    if (widest(L, e.size, 400) > s.w - 30) warn(`a word in note '${e.id}' is wider than the note`);
    if (widest(noteTitle(e, s), e.size, 700) > s.w - 30) warn(`a word in the title of note '${e.id}' is wider than the note`);
  }
}

/* ---------- Stage: paints one compiled scene into one <svg> ---------- */
let uidSeq = 0;
function mk(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function roundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
}
function shapePath(shape, w, h, radius) {
  const x = -w / 2, y = -h / 2;
  if (shape === 'diamond') return `M0,${y}L${w / 2},0L0,${h / 2}L${x},0Z`;
  if (shape === 'db') {
    const ry = Math.min(16, h * .14);
    return `M${x},${y + ry}A${w / 2},${ry} 0 0 1 ${w / 2},${y + ry}V${h / 2 - ry}A${w / 2},${ry} 0 0 1 ${x},${h / 2 - ry}Z` +
           `M${x},${y + ry}A${w / 2},${ry} 0 0 0 ${w / 2},${y + ry}`;
  }
  return roundRect(x, y, w, h, shape === 'pill' ? h / 2 : radius ?? 14);
}
function setLines(textEl, lines, y0, lh, x) {
  textEl.textContent = '';
  lines.forEach((ln, i) => { mk('tspan', { x: x || 0, y: y0 + i * lh }, textEl).textContent = ln; });
}

// Text entry effects 'type', 'words' and 'scramble' run while the element's show tween is in progress.
function kinetic(n, el, L, y0, lh, x, s, t) {
  const o = clamp01(s.op), fx = KINETIC.has(s.fx) && o < 1 ? s.fx : '';
  const N = L.reduce((k, l) => k + l.length, 0), done = Math.floor(N * o);
  if (fx === 'words') {
    const wk = L.join('\n') + '|' + y0;
    if (n.wk !== wk) {
      n.wk = wk;
      n.lk = null;
      el.textContent = '';
      n.words = [];
      L.forEach((ln, i) => {
        const line = mk('tspan', { x: x || 0, y: y0 + i * lh }, el), parts = ln.split(' ');
        parts.forEach((w, j) => { const sp = mk('tspan', {}, line); sp.textContent = w + (j < parts.length - 1 ? ' ' : ''); n.words.push(sp); });
      });
    }
    n.words.forEach((sp, i) => sp.setAttribute('opacity', clamp01(o * n.words.length * 1.25 - i).toFixed(3)));
    return;
  }
  n.wk = null;
  const key = L.join('\n') + '|' + y0 + '|' + fx + (fx === 'type' ? done : fx === 'scramble' ? done + '.' + Math.floor(t * 24) : '');
  if (n.lk === key) return;
  n.lk = key;
  if (!fx) return setLines(el, L, y0, lh, x);
  let left = done, caret = -1;
  const out = L.map((ln, li) => {
    const keep = left;
    left -= ln.length;
    if (fx === 'type') {
      if (caret < 0 && keep < ln.length) caret = li;
      return ln.slice(0, Math.max(0, keep));
    }
    return ln.split('').map((ch, i) => i < keep || ch === ' ' ? ch : GLYPHS[((Math.imul(i + li * 97 + 1, 2654435761) ^ (Math.floor(t * 24) * 40503)) >>> 0) % GLYPHS.length]).join('');
  });
  if (fx === 'type') out[caret < 0 ? out.length - 1 : caret] += '\u258d';
  setLines(el, out, y0, lh, x);
}

// Highlighter behind text: `set: id, mark: 1` sweeps it in.
function markRect(rect, s, e, L, lh, th, yTop) {
  const m = clamp01(s.mark || 0);
  if (m <= 0) { rect.setAttribute('width', 0); return; }
  const w = widest(L, e.size, e.weight, e.mono), h = L.length * lh, x0 = e.align === 'start' ? 0 : e.align === 'end' ? -w : -w / 2;
  rect.setAttribute('x', x0 - 6);
  rect.setAttribute('y', (yTop ?? -h / 2) - 2);
  rect.setAttribute('height', h + 4);
  rect.setAttribute('width', (w + 12) * EASE.out(m));
  rect.setAttribute('fill', css(rgb(th, e.markTone || 'warn'), .3));
}

class Stage {
  constructor(svg, C, theme) {
    this.svg = svg; this.C = C; this.th = theme; this.uid = ++uidSeq;
    this.build();
  }
  setTheme(theme) { this.th = theme; this.build(); }
  build() {
    const { svg, C, th, uid } = this, W = C.W, H = C.H;
    svg.textContent = '';
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const defs = mk('defs', {}, svg);
    const f = mk('filter', { id: `glow${uid}`, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
    mk('feGaussianBlur', { stdDeviation: 5, result: 'b' }, f);
    const fm = mk('feMerge', {}, f);
    mk('feMergeNode', { in: 'b' }, fm);
    mk('feMergeNode', { in: 'SourceGraphic' }, fm);
    // Flow packets are tiny next to the blur, so their glow needs a much larger filter region or it clips to a square.
    const fd = mk('filter', { id: `glowd${uid}`, x: '-500%', y: '-500%', width: '1100%', height: '1100%' }, defs);
    mk('feGaussianBlur', { stdDeviation: 5, result: 'b' }, fd);
    const fdm = mk('feMerge', {}, fd);
    mk('feMergeNode', { in: 'b' }, fdm);
    mk('feMergeNode', { in: 'SourceGraphic' }, fdm);
    this.glowDot = `url(#glowd${uid})`;
    const bd = C.backdrop, big = { x: -2 * W, y: -2 * H, width: 5 * W, height: 5 * H };
    if (bd === 'glow') {
      const rg = mk('radialGradient', { id: `bg${uid}`, cx: W / 2, cy: H / 2, r: Math.max(W, H) * .7, gradientUnits: 'userSpaceOnUse' }, defs);
      mk('stop', { offset: 0, 'stop-color': th.tones.accent, 'stop-opacity': .16 }, rg);
      mk('stop', { offset: 1, 'stop-color': th.bg, 'stop-opacity': 0 }, rg);
      mk('rect', Object.assign({ fill: `url(#bg${uid})` }, big), svg);
    }
    if (bd === 'dots' || bd === 'glow') {
      const pat = mk('pattern', { id: `dots${uid}`, width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
      mk('circle', { cx: 20, cy: 20, r: 1.3, fill: th.grid }, pat);
      mk('rect', Object.assign({ fill: `url(#dots${uid})` }, big), svg);
    } else if (bd === 'grid') {
      const pat = mk('pattern', { id: `grid${uid}`, width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
      mk('path', { d: 'M40 0H0V40', fill: 'none', stroke: th.grid, 'stroke-width': 1 }, pat);
      mk('rect', Object.assign({ fill: `url(#grid${uid})` }, big), svg);
    }
    this.layers = [0, 1, 2, 3].map(() => mk('g', {}, svg));
    this.gfx = mk('g', { 'pointer-events': 'none' }, svg);
    this.glow = `url(#glow${uid})`;
    this.nodes = {};
    for (const e of C.els) this.nodes[e.id] = this.make(e, mk('g', { 'data-id': e.id, display: 'none' }, this.layers[layerOf(e)]));
  }
  make(e, g) {
    const th = this.th, n = { g };
    const text = (attrs) => mk('text', Object.assign({ 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: th.fg, 'font-family': SANS }, attrs), g);
    if (e.type === 'box' || e.type === 'circle') {
      n.hl = mk(e.type === 'circle' ? 'circle' : 'path', { fill: 'none', 'stroke-width': 3, filter: this.glow }, g);
      n.body = mk(e.type === 'circle' ? 'circle' : 'path', { 'stroke-width': 1.6 }, g);
      n.icon = text({ 'font-size': 30 });
      n.iconp = mk('path', ICONSTYLE, g);
      n.lab = text({ 'font-weight': 600 });
      n.sub = text({ 'font-size': 15, fill: th.dim });
    } else if (e.type === 'zone') {
      n.body = mk('path', { 'stroke-width': 1.4, 'stroke-dasharray': '6 6' }, g);
      n.lab = text({ 'text-anchor': 'start', 'font-size': 13, 'font-weight': 700, 'letter-spacing': '.12em' });
    } else if (e.type === 'text') {
      n.mark = mk('rect', { rx: 4 }, g);
      n.lab = text({ 'text-anchor': e.align, 'font-size': e.size, 'font-weight': e.weight, 'font-family': e.mono ? MONO : SANS });
    } else if (e.type === 'title') {
      n.mark = mk('rect', { rx: 6 }, g);
      n.kick = text({ 'text-anchor': e.align, 'font-weight': 700, 'letter-spacing': '.18em' });
      n.lab = text({ 'text-anchor': e.align, 'font-size': e.size, 'font-weight': e.weight, 'letter-spacing': '-.02em' });
      n.bar = mk('rect', { rx: 3 }, g);
    } else if (e.type === 'icon') {
      n.hl = mk('circle', { r: e.size * .72, fill: 'none', 'stroke-width': 3, filter: this.glow }, g);
      n.iconp = mk('path', Object.assign({ transform: `translate(${-e.size / 2},${-e.size / 2}) scale(${e.size / 24})` }, ICONSTYLE), g);
      n.lab = text({ 'font-size': Math.max(13, e.size * .3), 'font-weight': 600 });
    } else if (e.type === 'frame') {
      n.body = mk('path', { 'stroke-width': 1.4 }, g);
      n.head = mk('path', {}, g);
      n.dots = ['#ff5f57', '#febc2e', '#28c840'].map(c => mk('circle', { r: 5.5, fill: c }, g));
      n.url = mk('rect', { rx: 11, height: 22 }, g);
      n.title = text({ 'font-size': 13, fill: th.dim, 'font-family': e.kind === 'browser' ? SANS : MONO });
      n.notch = mk('rect', { rx: 12, height: 24 }, g);
      n.lines = mk('text', { 'text-anchor': 'start', 'dominant-baseline': 'central', 'font-size': e.size, 'font-family': e.mono ? MONO : SANS, class: 'pre' }, g);
      n.caret = mk('rect', { width: e.size * .55, height: e.size * 1.15, rx: 1 }, g);
    } else if (e.type === 'chart') {
      n.axis = mk('path', { 'stroke-width': 1.2, fill: 'none', stroke: th.line }, g);
      n.area = mk('path', { stroke: 'none' }, g);
      n.line = mk('path', { fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      n.bars = e.data.map(() => mk('rect', { rx: 4 }, g));
      n.pts = e.data.map(() => mk('circle', { r: 4.5 }, g));
      n.vals = e.data.map(() => text({ 'font-size': 13, 'font-weight': 600 }));
      n.xl = e.data.map(() => text({ 'font-size': 13, fill: th.dim }));
    } else if (e.type === 'particles') {
      const rnd = seeded(e.id);
      n.pts = Array.from({ length: e.n }, () => ({ x: (rnd() - .5) * e.w, y: (rnd() - .5) * e.h, ph: rnd() * 6.283,
        sp: .5 + rnd(), sz: .5 + rnd(), a: rnd() * 6.283, el: mk('circle', {}, g) }));
    } else if (e.type === 'note') {
      n.body = mk('path', { 'stroke-width': 1.2 }, g);
      n.bar = mk('rect', { width: 4, rx: 2 }, g);
      n.title = text({ 'text-anchor': 'start', 'font-size': e.size, 'font-weight': 700 });
      n.lab = text({ 'text-anchor': 'start', 'font-size': e.size });
    } else if (e.type === 'code') {
      n.body = mk('path', { 'stroke-width': 1.2, fill: th.panel, stroke: th.line }, g);
      n.bar = mk('rect', { rx: 5 }, g);
      n.mark = mk('rect', { width: 3, rx: 1.5 }, g);
      if (e.title) n.title = text({ 'text-anchor': 'start', 'font-size': 13, 'font-weight': 600, fill: th.dim, 'font-family': MONO });
      n.lines = e.lines.map((ln, i) => {
        text({ 'text-anchor': 'end', 'font-size': e.size * .8, fill: th.dim, 'font-family': MONO, opacity: .6 }).textContent = i + 1;
        const t = text({ 'text-anchor': 'start', 'font-size': e.size, 'font-family': MONO, class: 'pre' });
        t.textContent = ln;
        return t;
      });
    } else if (e.type === 'arrow') {
      n.glowp = mk('path', { fill: 'none', 'stroke-linecap': 'round', filter: this.glow }, g);
      n.path = mk('path', { fill: 'none', 'stroke-linecap': 'round' }, g);
      n.head = mk('path', {}, g);
      n.lg = mk('g', {}, g);
      const ls = e.labelSize || 14;
      n.lrect = mk('rect', { height: ls * 1.86, rx: ls * .93, fill: th.bg, 'stroke-width': ls / 14 }, n.lg);
      n.ltext = mk('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': ls, 'font-weight': 500, fill: th.fg, 'font-family': SANS }, n.lg);
    }
    if (e.glow) for (const k of ['body', 'lab', 'iconp', 'line']) if (n[k]) n[k].setAttribute('filter', this.glow);
    if (e.glow && n.bars) n.bars.forEach(b => b.setAttribute('filter', this.glow));
    return n;
  }
  alpha(e, s, z) {
    const o = clamp01(s.op);
    let a = s.fx === 'pop' ? Math.min(1, o * 1.7) : s.fx === 'draw' || s.fx === 'grow' ? Math.min(1, o * 4)
      : s.fx === 'bounce' ? Math.min(1, o * 2.5) : KINETIC.has(s.fx) ? (o > 0 ? 1 : 0) : EASE.out(o);
    a *= s.alpha * (1 - .82 * s.dim);
    if (e.minZoom) a *= smooth(e.minZoom * .75, e.minZoom, z);
    if (e.maxZoom) a *= 1 - smooth(e.maxZoom, e.maxZoom * 1.33, z);
    return a;
  }
  paint(t, cam) {
    const C = this.C, S = stateAt(C, t), c = cam || S.$cam, z = C.W / c.w;
    this.svg.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
    for (const e of C.els) {
      const n = this.nodes[e.id], s = S[e.id], a = this.alpha(e, s, z);
      if (a < .004) { if (n.vis !== false) { n.g.setAttribute('display', 'none'); n.vis = false; } continue; }
      if (n.vis !== true) { n.g.removeAttribute('display'); n.vis = true; }
      n.g.setAttribute('opacity', a.toFixed(3));
      if (e.type === 'arrow') this.arrow(e, n, s, S);
      else this.shape(e, n, s, z, t);
    }
    this.effects(t, S);
    return S;
  }
  shape(e, n, s, z, t) {
    const th = this.th, o = clamp01(s.op), tc = rgb(th, s.tone);
    let dx = 0, dy = 0, sc = 1, sx = null, sy = null;
    if (s.fx === 'pop') sc = .55 + .45 * EASE.back(o);
    else if (s.fx === 'bounce') { const k = EASE.bounce(o), q = Math.sin(o * Math.PI); sx = k * (1 + .16 * q); sy = k * (1 - .1 * q); }
    else if (s.fx === 'zoom') sc = 1.6 - .6 * EASE.out(o);
    else if (s.fx === 'up') dy = (1 - EASE.out(o)) * 36;
    else if (s.fx === 'down') dy = -(1 - EASE.out(o)) * 36;
    else if (s.fx === 'left') dx = -(1 - EASE.out(o)) * 48;
    else if (s.fx === 'right') dx = (1 - EASE.out(o)) * 48;
    n.g.setAttribute('transform', `translate(${s.x + dx},${s.y + s.oy + dy}) scale(${sx ?? sc},${sy ?? sc})`);
    const bg = hex(th.bg);
    if (e.type === 'box' || e.type === 'circle') {
      const circ = e.type === 'circle';
      const key = circ ? s.r : s.w + ',' + s.h;
      if (n.key !== key) {
        n.key = key;
        if (circ) { n.body.setAttribute('r', s.r); n.hl.setAttribute('r', s.r + 6); }
        else { n.body.setAttribute('d', shapePath(e.shape, s.w, s.h, e.radius)); n.hl.setAttribute('d', shapePath(e.shape, s.w + 12, s.h + 12, e.radius == null ? null : e.radius + 6)); }
      }
      n.body.setAttribute('fill', css(mix(bg, tc, th.fill + .1 * s.hl)));
      n.body.setAttribute('stroke', css(tc));
      n.hl.setAttribute('stroke', css(rgb(th, s.hlTone)));
      n.hl.setAttribute('opacity', s.hl.toFixed(3));
      const b = boxText(e, s);
      if (n.lk !== b.key) {
        n.lk = b.key;
        let y = -b.total / 2;
        const named = !circ && s.icon && MOTION_ICONS[s.icon];
        n.icon.textContent = circ || named ? '' : (s.icon || '');
        n.icon.setAttribute('y', y + b.iconH / 2);
        n.iconp.setAttribute('d', named || '');
        if (named) n.iconp.setAttribute('transform', `translate(-15,${y + b.iconH / 2 - 15}) scale(1.25)`);
        y += b.iconH;
        n.lab.setAttribute('font-size', b.size);
        setLines(n.lab, b.L, y + b.lh / 2, b.lh);
        y += b.L.length * b.lh + b.gap;
        n.sub.setAttribute('font-size', b.ss);
        setLines(n.sub, b.SB, circ ? s.r + 20 : y + b.sh / 2, b.sh);
      }
      n.iconp.setAttribute('stroke', css(isPlain(s.tone) ? hex(th.fg) : tc));
    } else if (e.type === 'zone') {
      const key = s.w + ',' + s.h;
      if (n.key !== key) { n.key = key; n.body.setAttribute('d', roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 18)); }
      n.body.setAttribute('fill', css(mix(bg, tc, .07)));
      n.body.setAttribute('stroke', css(tc));
      n.lab.setAttribute('fill', css(isPlain(s.tone) ? hex(th.dim) : tc));
      n.lab.setAttribute('x', -s.w / 2 + 18);
      n.lab.setAttribute('y', -s.h / 2 + 22);
      n.lab.textContent = String(s.label || '').toUpperCase();
    } else if (e.type === 'text') {
      const str = shown(e, s) ?? '', lh = e.size * 1.25;
      const L = wrap(str, e.maxw || 1e9, e.size, e.weight, e.mono);
      kinetic(n, n.lab, L, -(L.length - 1) * lh / 2, lh, 0, s, t);
      n.lab.setAttribute('fill', css(tc));
      markRect(n.mark, s, e, L, lh, th);
    } else if (e.type === 'title') {
      const T = titleLayout(e, shown(e, s) ?? ''), top = -s.h / 2, ty = top + T.kh;
      n.kick.setAttribute('font-size', T.ks);
      n.kick.setAttribute('y', top + T.ks * .8);
      n.kick.setAttribute('fill', css(tc));
      if (n.kick.textContent !== T.kick) n.kick.textContent = T.kick;
      kinetic(n, n.lab, T.L, ty + T.lh / 2, T.lh, 0, s, t);
      n.lab.setAttribute('fill', css(hex(th.fg)));
      markRect(n.mark, s, e, T.L, T.lh, th, ty);
      const bw = Math.min(T.tw, e.size * 2.4) * (o < 1 ? EASE.out(clamp01((o - .25) / .75)) : 1);
      n.bar.setAttribute('x', e.align === 'start' ? 0 : e.align === 'end' ? -bw : -bw / 2);
      n.bar.setAttribute('y', ty + T.L.length * T.lh + T.bar * .9);
      n.bar.setAttribute('height', T.bar);
      n.bar.setAttribute('width', Math.max(0, bw));
      n.bar.setAttribute('fill', css(tc));
    } else if (e.type === 'icon') {
      if (n.nk !== s.name) { n.nk = s.name; n.iconp.setAttribute('d', MOTION_ICONS[s.name] || ''); }
      n.iconp.setAttribute('stroke', css(tc));
      n.hl.setAttribute('stroke', css(rgb(th, s.hlTone)));
      n.hl.setAttribute('opacity', s.hl.toFixed(3));
      const lab = s.label == null ? '' : String(s.label);
      if (n.lab.textContent !== lab) n.lab.textContent = lab;
      n.lab.setAttribute('y', e.size / 2 + Math.max(13, e.size * .3) * .9 + 6);
      n.lab.setAttribute('fill', css(hex(th.fg)));
    } else if (e.type === 'frame') {
      this.frame(e, n, s, t, tc, bg);
    } else if (e.type === 'chart') {
      this.chart(e, n, s, tc, bg);
    } else if (e.type === 'particles') {
      const tt = REDUCE ? 0 : t, R = Math.min(s.w, s.h) / 2, col = css(tc);
      for (const p of n.pts) {
        let x = p.x, y = p.y, a = .3 + .5 * (.5 + .5 * Math.sin(tt * 1.7 * p.sp + p.ph));
        if (e.mode === 'drift') { x += Math.sin(tt * .6 * p.sp * e.speed + p.ph) * 22; y += Math.cos(tt * .45 * p.sp * e.speed + p.ph) * 16; }
        else if (e.mode === 'rise') { y = ((p.y + s.h / 2 - tt * 34 * p.sp * e.speed) % s.h + s.h) % s.h - s.h / 2; x += Math.sin(tt * .8 + p.ph) * 10; }
        else if (e.mode === 'burst') { const d = EASE.out(o) * R * (.35 + .65 * (p.sz - .5)); x = Math.cos(p.a) * d; y = Math.sin(p.a) * d; a = o < 1 ? (1 - o) * .95 : 0; }
        p.el.setAttribute('cx', x.toFixed(1));
        p.el.setAttribute('cy', y.toFixed(1));
        p.el.setAttribute('r', (e.size * p.sz).toFixed(2));
        p.el.setAttribute('fill', col);
        p.el.setAttribute('opacity', a.toFixed(3));
      }
    } else if (e.type === 'note') {
      const L = wrap(shown(e, s) || '', s.w - 36, e.size, 400), T = noteTitle(e, s);
      const key = T.join('\n') + '\u0001' + L.join('\n') + s.w + s.h;
      if (n.lk !== key) {
        n.lk = key;
        n.body.setAttribute('d', roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 10));
        n.bar.setAttribute('x', -s.w / 2 + 8);
        n.bar.setAttribute('y', -s.h / 2 + 10);
        n.bar.setAttribute('height', s.h - 20);
        let y = -s.h / 2 + 15 + e.size * .7;
        setLines(n.title, T, y, e.size * 1.35, -s.w / 2 + 22);
        if (T.length) y += T.length * e.size * 1.35 + 4;
        setLines(n.lab, L, y, e.size * 1.45, -s.w / 2 + 22);
      }
      n.body.setAttribute('fill', css(mix(bg, tc, isPlain(s.tone) ? .06 : .1)));
      n.body.setAttribute('stroke', css(mix(bg, tc, .55)));
      n.bar.setAttribute('fill', css(tc));
      n.title.setAttribute('fill', css(isPlain(s.tone) ? hex(th.fg) : tc));
    } else if (e.type === 'code') {
      const x0 = -s.w / 2, y0 = -s.h / 2 + 14 + e.head;
      if (n.key !== s.w + ',' + s.h) {
        n.key = s.w + ',' + s.h;
        n.body.setAttribute('d', roundRect(x0, -s.h / 2, s.w, s.h, 12));
        if (n.title) { n.title.textContent = e.title; n.title.setAttribute('x', x0 + 18); n.title.setAttribute('y', -s.h / 2 + 20); }
        const kids = n.g.querySelectorAll('text');
        let i = n.title ? 1 : 0;
        for (let k = 0; k < e.lines.length; k++) {
          const yy = y0 + (k + .5) * e.lh;
          kids[i].setAttribute('x', x0 + 34); kids[i].setAttribute('y', yy);
          kids[i + 1].setAttribute('x', x0 + 46); kids[i + 1].setAttribute('y', yy);
          i += 2;
        }
      }
      const ac = rgb(th, isPlain(s.tone) ? 'accent' : s.tone), c = Math.max(1, s.cur);
      n.bar.setAttribute('x', x0 + 6); n.bar.setAttribute('width', s.w - 12);
      n.bar.setAttribute('y', y0 + (c - 1) * e.lh); n.bar.setAttribute('height', e.lh);
      n.bar.setAttribute('fill', css(ac, .16 * clamp01(s.cur)));
      n.mark.setAttribute('x', x0 + 6); n.mark.setAttribute('y', y0 + (c - 1) * e.lh + 3);
      n.mark.setAttribute('height', e.lh - 6); n.mark.setAttribute('fill', css(ac, clamp01(s.cur)));
    }
    if (e.labelMaxZoom) {
      const la = (1 - smooth(e.labelMaxZoom, e.labelMaxZoom * 1.33, z)).toFixed(3);
      for (const t of [n.icon, n.lab, n.sub, n.title]) if (t) t.setAttribute('opacity', la);
    }
  }
  frame(e, n, s, t, tc, bg) {
    const th = this.th, x0 = -s.w / 2, y0 = -s.h / 2, phone = e.kind === 'phone', R = phone ? 40 : 12, bar = phone ? 0 : 36;
    const fg = hex(th.fg), lightBg = bg[0] + bg[1] + bg[2] > 384;
    const panel = e.kind !== 'terminal' ? hex(th.panel) : lightBg ? mix(hex(th.panel), fg, .04) : mix(bg, [0, 0, 0], .35);
    if (n.key !== s.w + ',' + s.h) {
      n.key = s.w + ',' + s.h;
      n.body.setAttribute('d', roundRect(x0, y0, s.w, s.h, R));
      n.head.setAttribute('d', bar ? `M${x0},${y0 + bar}V${y0 + R}A${R},${R} 0 0 1 ${x0 + R},${y0}H${x0 + s.w - R}A${R},${R} 0 0 1 ${x0 + s.w},${y0 + R}V${y0 + bar}Z` : '');
      n.dots.forEach((d, i) => {
        d.setAttribute('cx', x0 + 20 + i * 18);
        d.setAttribute('cy', y0 + bar / 2);
        d.setAttribute('display', bar ? 'inline' : 'none');
      });
      const browser = e.kind === 'browser';
      n.url.setAttribute('display', browser ? 'inline' : 'none');
      n.url.setAttribute('x', x0 + 80);
      n.url.setAttribute('y', y0 + 7);
      n.url.setAttribute('width', Math.max(0, s.w - 100));
      n.title.setAttribute('text-anchor', browser ? 'start' : 'middle');
      n.title.setAttribute('x', browser ? x0 + 94 : 0);
      n.title.setAttribute('y', y0 + (phone ? 64 : bar / 2));
      n.title.textContent = e.title || '';
      n.notch.setAttribute('display', phone ? 'inline' : 'none');
      n.notch.setAttribute('width', s.w * .34);
      n.notch.setAttribute('x', -s.w * .17);
      n.notch.setAttribute('y', y0 + 12);
      n.tk = null;
    }
    n.body.setAttribute('fill', css(panel));
    n.body.setAttribute('stroke', css(mix(hex(th.line), tc, isPlain(s.tone) ? 0 : .6)));
    n.head.setAttribute('fill', css(mix(panel, fg, .05)));
    n.url.setAttribute('fill', css(mix(panel, fg, .08)));
    n.notch.setAttribute('fill', css(bg));
    const lh = e.size * 1.6, top = y0 + frameTop(e), N = e.lines.reduce((k, l) => k + String(l).length, 0);
    const typed = clamp01(s.typed), shown = Math.round(N * typed), accent = css(rgb(th, isPlain(s.tone) ? 'accent' : s.tone));
    if (n.tk !== shown) {
      n.tk = shown;
      n.lines.textContent = '';
      let left = shown;
      n.end = { x: x0 + 18, y: top + lh / 2 };
      e.lines.forEach((raw, i) => {
        const ln = String(raw), part = ln.slice(0, Math.max(0, left)), y = top + i * lh + lh / 2;
        left -= ln.length;
        const row = mk('tspan', { x: x0 + 18, y }, n.lines);
        if (part.startsWith('$ ')) {
          mk('tspan', { fill: accent }, row).textContent = '$ ';
          mk('tspan', { fill: css(fg) }, row).textContent = part.slice(2);
        } else {
          mk('tspan', { fill: th.dim }, row).textContent = part;
        }
        if (part.length) n.end = { x: x0 + 18 + textW(part, e.size, 400, e.mono), y };
      });
    }
    const typing = typed > 0 && typed < 1, blink = e.kind === 'terminal' && typed >= 1 && Math.floor((REDUCE ? 0 : t) * 2.2) % 2 === 0;
    n.caret.setAttribute('display', typing || blink ? 'inline' : 'none');
    n.caret.setAttribute('x', n.end.x + 2);
    n.caret.setAttribute('y', n.end.y - e.size * .58);
    n.caret.setAttribute('fill', accent);
  }
  chart(e, n, s, tc, bg) {
    const th = this.th, D = s.data || [], k = D.length, spark = e.kind === 'spark', o = clamp01(s.op);
    const x0 = -s.w / 2, y0 = -s.h / 2, padB = spark ? 4 : 28, padT = spark ? 4 : 24, padX = spark ? 4 : 14;
    const plotW = s.w - padX * 2, plotH = s.h - padB - padT, base = y0 + s.h - padB, max = e.max ?? e.top * 1.1;
    const grow = s.fx === 'grow' && o < 1 ? o : 1, fg = css(hex(th.fg));
    const fmt = v => (e.fmt || '{}').replace('{}', Number(v).toFixed(e.decimals || 0));
    n.axis.setAttribute('d', spark ? '' : `M${x0 + padX},${base}H${x0 + s.w - padX}`);
    const hide = el => el.setAttribute('display', 'none'), show = el => el.setAttribute('display', 'inline');
    if (e.kind === 'bar') {
      const slot = plotW / Math.max(1, k), bw = slot * .62;
      hide(n.line); hide(n.area);
      D.forEach((v, i) => {
        const gi = EASE.out(clamp01(grow * 1.4 - i * .4 / Math.max(1, k))), hh = Math.max(0, v / max) * plotH * gi, cx = x0 + padX + slot * (i + .5);
        const b = n.bars[i], val = n.vals[i], xl = n.xl[i];
        if (!b) return;
        show(b); hide(n.pts[i]);
        b.setAttribute('x', cx - bw / 2); b.setAttribute('y', base - hh); b.setAttribute('width', bw); b.setAttribute('height', hh);
        b.setAttribute('fill', css(mix(bg, tc, .85)));
        val.setAttribute('x', cx); val.setAttribute('y', base - hh - 12); val.setAttribute('fill', fg);
        val.setAttribute('opacity', e.values === false ? 0 : smooth(.7, 1, gi).toFixed(3));
        val.textContent = fmt(v);
        xl.setAttribute('x', cx); xl.setAttribute('y', base + 16); xl.textContent = e.labels[i] ?? '';
      });
      return;
    }
    const P = D.map((v, i) => ({ x: x0 + padX + (k === 1 ? plotW / 2 : plotW * i / (k - 1)), y: base - Math.max(0, v / max) * plotH }));
    let len = 0;
    for (let i = 1; i < P.length; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    show(n.line);
    n.line.setAttribute('d', P.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''));
    n.line.setAttribute('stroke', css(tc));
    n.line.setAttribute('stroke-dasharray', `${(len * EASE.inOut(grow)).toFixed(1)} ${len.toFixed(1)}`);
    if (spark || !P.length) hide(n.area);
    else {
      show(n.area);
      n.area.setAttribute('d', `M${P[0].x},${base}` + P.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('') + `L${P[P.length - 1].x},${base}Z`);
      n.area.setAttribute('fill', css(tc, .12 * grow));
    }
    D.forEach((v, i) => {
      const reached = k === 1 || i / (k - 1) <= grow + 1e-6;
      hide(n.bars[i]);
      if (spark) { hide(n.pts[i]); n.vals[i].textContent = ''; n.xl[i].textContent = ''; return; }
      show(n.pts[i]);
      n.pts[i].setAttribute('cx', P[i].x); n.pts[i].setAttribute('cy', P[i].y);
      n.pts[i].setAttribute('fill', css(tc)); n.pts[i].setAttribute('opacity', reached ? 1 : 0);
      n.vals[i].setAttribute('x', P[i].x); n.vals[i].setAttribute('y', P[i].y - 16); n.vals[i].setAttribute('fill', fg);
      n.vals[i].setAttribute('opacity', e.values && reached ? 1 : 0);
      n.vals[i].textContent = fmt(v);
      n.xl[i].setAttribute('x', P[i].x); n.xl[i].setAttribute('y', base + 16); n.xl[i].textContent = e.labels[i] ?? '';
    });
  }
  arrow(e, n, s, S) {
    const th = this.th, g = edgeGeom(e, S, this.C.by);
    if (!g) { n.g.setAttribute('display', 'none'); n.vis = false; return; }
    const q = s.fx === 'draw' ? EASE.inOut(clamp01(s.op)) : 1;
    const wdt = e.width + s.hl * 1.5, hl = e.head === false ? 0 : 4 + wdt * 3.2;
    const u1 = unit(bezD(g, 1)), u0 = unit(bezD(g, 0));
    const G = {
      p0: e.both ? { x: g.p0.x + u0.x * hl * .7, y: g.p0.y + u0.y * hl * .7 } : g.p0,
      c: g.c,
      p2: { x: g.p2.x - u1.x * hl * .7, y: g.p2.y - u1.y * hl * .7 },
    };
    const end = bez(G, q), cq = { x: lerp(G.p0.x, G.c.x, q), y: lerp(G.p0.y, G.c.y, q) };
    const d = `M${G.p0.x},${G.p0.y}Q${cq.x},${cq.y} ${end.x},${end.y}`;
    const col = css(mix(rgb(th, s.tone), rgb(th, s.hlTone), s.hl));
    for (const p of [n.path, n.glowp]) p.setAttribute('d', d);
    n.path.setAttribute('stroke', col);
    n.path.setAttribute('stroke-width', wdt);
    n.path.setAttribute('stroke-dasharray', e.dashed ? '9 7' : 'none');
    n.glowp.setAttribute('stroke', col);
    n.glowp.setAttribute('stroke-width', wdt + 2);
    n.glowp.setAttribute('opacity', Math.max(s.hl * .8, e.glow ? .55 : 0).toFixed(3));
    const head = (tip, u) => {
      const b = { x: tip.x - u.x * hl, y: tip.y - u.y * hl }, nx = -u.y * hl * .48, ny = u.x * hl * .48;
      return `M${tip.x},${tip.y}L${b.x + nx},${b.y + ny}L${b.x - nx},${b.y - ny}Z`;
    };
    const uq = unit(bezD(G, q));
    let hd = q > .04 && hl ? head({ x: end.x + uq.x * hl * .7, y: end.y + uq.y * hl * .7 }, uq) : '';
    if (e.both && hl) hd += head(g.p0, { x: -u0.x, y: -u0.y });
    n.head.setAttribute('d', hd);
    n.head.setAttribute('fill', col);
    if (s.label) {
      const r = labelRect(e, g, s.label);
      n.lg.setAttribute('opacity', smooth(.55, 1, q).toFixed(3));
      n.lrect.setAttribute('x', r[0]); n.lrect.setAttribute('y', r[1]); n.lrect.setAttribute('width', r[2] - r[0]);
      n.lrect.setAttribute('stroke', css(rgb(th, s.tone), .7));
      n.ltext.setAttribute('x', (r[0] + r[2]) / 2); n.ltext.setAttribute('y', (r[1] + r[3]) / 2);
      if (n.ltext.textContent !== String(s.label)) n.ltext.textContent = s.label;
    } else n.lg.setAttribute('opacity', 0);
  }
  effects(t, S) {
    const g = this.gfx, th = this.th, C = this.C;
    g.textContent = '';
    if (REDUCE) return;
    for (const f of C.fx) {
      const tail = f.k === 'flow' && !f.next ? FLOW_TAIL : 0;
      if (t < f.t0 || t > f.t1 + tail) continue;
      const p = clamp01((t - f.t0) / (f.t1 - f.t0)), col = css(rgb(th, f.tone));
      if (f.k === 'pulse') {
        const e = C.by[f.id], s = S[f.id], k = EASE.out(p);
        if (!e || !s) continue;
        const r = bbox(e, s, S), grow = 6 + 28 * k, a = (1 - p) * .9;
        if (e.type === 'circle') mk('circle', { cx: s.x, cy: s.y + s.oy, r: s.r + grow, fill: 'none', stroke: col, 'stroke-width': 3 * (1 - p) + 1, opacity: a }, g);
        else mk('path', { d: roundRect(r[0] - grow, r[1] - grow, r[2] - r[0] + 2 * grow, r[3] - r[1] + 2 * grow, 14 + grow), fill: 'none', stroke: col, 'stroke-width': 3 * (1 - p) + 1, opacity: a }, g);
      } else if (f.k === 'hold') this.hold(f, t, S, col);
      else this.flow(f, t, p, S, col);
    }
  }
  // The outline of a component a packet is passing through: a soft glow, and a ring that fills with progress,
  // clockwise from where the packet came in.
  outline(id, S, col, progress, glow, from) {
    const e = this.C.by[id], s = S[id], pad = 5;
    if (!e || !s || s.op < .05) return;
    const r = bbox(e, s, S), cy = s.y + (s.oy || 0);
    let f0 = 0;  // where `from` sits along the outline, 0..1 from its start (top-left corner; leftmost point of a circle)
    if (from && e.type === 'circle') f0 = (((Math.atan2(from.y - cy, from.x - s.x) - Math.PI) % TAU) + TAU) % TAU / TAU;
    else if (from) {
      const w = r[2] - r[0], h = r[3] - r[1], P = 2 * (w + h), x = clamp01((from.x - r[0]) / w) * w, y = clamp01((from.y - r[1]) / h) * h;
      const side = [y, w - x, h - y, x].indexOf(Math.min(y, w - x, h - y, x));
      f0 = [x, w + y, w + h + (w - x), 2 * w + h + (h - y)][side] / P;
    }
    const k = Math.min(progress, 1), over = f0 + k - 1;
    const dash = over > 0 ? `${over.toFixed(4)} ${(f0 - over).toFixed(4)} ${(1 - f0).toFixed(4)} 1` : `0 ${f0.toFixed(4)} ${k.toFixed(4)} 1`;
    const d = e.type === 'circle'
      ? `M${s.x - s.r - pad},${cy}a${s.r + pad},${s.r + pad} 0 1 1 ${2 * (s.r + pad)},0a${s.r + pad},${s.r + pad} 0 1 1 ${-2 * (s.r + pad)},0`
      : roundRect(r[0] - pad, r[1] - pad, r[2] - r[0] + 2 * pad, r[3] - r[1] + 2 * pad, (e.shape === 'pill' ? (r[3] - r[1]) / 2 : e.radius ?? 14) + pad);
    if (glow > .01) mk('path', { d, fill: 'none', stroke: col, 'stroke-width': 7, opacity: glow.toFixed(3), filter: this.glow }, this.gfx);
    if (progress > .002) mk('path', { d, fill: 'none', stroke: col, 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': dash, 'stroke-linecap': 'round', opacity: .95 }, this.gfx);
  }
  packet(pt, k0, col, scale, op) {
    mk('circle', { cx: pt.x, cy: pt.y, r: 9 * k0 * scale, fill: col, opacity: op, filter: this.glowDot }, this.gfx);
    mk('circle', { cx: pt.x, cy: pt.y, r: 3.6 * k0 * scale, fill: '#fff', opacity: op }, this.gfx);
  }
  flow(f, t, p, S, col) {
    const g = this.gfx, th = this.th, C = this.C, segs = flowRoute(f, S, C.by);
    if (!segs) return;
    const e0 = C.by[f.edges[0]], k0 = e0.width / 2.5, ls = 13 * (e0.labelSize || 14) / 14;
    if (t > f.t1) {
      // Landed: a ripple where it went in, and the component glows, then both fade.
      const q = (t - f.t1) / FLOW_TAIL, end = routeAt(segs, 1), node = flowEnds(f, C.by)[1];
      mk('circle', { cx: end.x, cy: end.y, r: (5 + 18 * EASE.out(q)) * k0, fill: 'none', stroke: col, 'stroke-width': 2, opacity: (.8 * (1 - q)).toFixed(3) }, g);
      if (typeof node === 'string') this.outline(node, S, col, 0, .5 * (1 - q));
      return;
    }
    // While handed to a hold, that hold draws the packet.
    if ((f.prev && t < f.cut) || (f.next && t > f.cut)) return;
    const sp = Math.min(.22, .9 / f.count);
    for (let j = 0; j < f.count; j++) {
      const pj = p * (1 + sp * (f.count - 1)) - j * sp;
      if (pj < 0 || pj > 1) continue;
      const pt = routeAt(segs, pj);
      // It pops out of where it starts and shrinks into where it lands, unless a hold carries it on.
      const born = f.prev ? 1 : .35 + .65 * EASE.out(clamp01(pj / .1));
      const land = f.next ? 1 : 1 - .7 * EASE.in(clamp01((pj - .86) / .14));
      const scale = born * land * (1 - .4 * pt.inside);
      const op = Math.min(1, f.prev ? 1 : pj * 30, f.next ? 1 : (1 - pj) * 40) * (1 - .45 * pt.inside);
      if (pt.node) this.outline(pt.node, S, col, pt.k, .35 * pt.inside, pt.from);
      if (!f.prev && j === 0 && pj < .14) {
        const q = pj / .14, s0 = routeAt(segs, 0);
        mk('circle', { cx: s0.x, cy: s0.y, r: (5 + 16 * EASE.out(q)) * k0, fill: 'none', stroke: col, 'stroke-width': 2, opacity: (.7 * (1 - q)).toFixed(3) }, g);
      }
      for (let k = 3; k >= 1; k--) {
        const tp = routeAt(segs, Math.max(0, pj - k * .02));
        mk('circle', { cx: tp.x, cy: tp.y, r: (6 - k) * k0 * scale, fill: col, opacity: op * (.4 - k * .1) * (1 - pt.inside) }, g);
      }
      this.packet(pt, k0, col, scale, op);
      if (f.label && j === 0) {
        const w = textW(String(f.label), ls, 600) + ls * 1.2, lo = op * (1 - pt.inside);
        mk('rect', { x: pt.x - w / 2, y: pt.y - ls * 3.1, width: w, height: ls * 1.7, rx: ls * .85, fill: col, opacity: lo }, g);
        mk('text', { x: pt.x, y: pt.y - ls * 2.25, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': ls, 'font-weight': 600, fill: th.bg, 'font-family': SANS, opacity: lo }, g).textContent = f.label;
      }
    }
  }
  // Between two linked flows the packet glides into the component, waits while its outline fills, and glides out.
  hold(f, t, S, col) {
    const C = this.C, e = C.by[f.node], s = S[f.node];
    const ra = flowRoute(f.a, S, C.by), rb = flowRoute(f.b, S, C.by);
    if (!e || !s || !ra || !rb) return;
    const pin = routeAt(ra, (f.t0 - f.a.t0) / (f.a.t1 - f.a.t0)), pout = routeAt(rb, (f.t1 - f.b.t0) / (f.b.t1 - f.b.t0));
    const c = center(e, s, S), d = f.t1 - f.t0, gl = Math.min(.35, d / 2), x = t - f.t0;
    let pt = c, inside = 1;
    if (x < gl) { inside = EASE.inOut(x / gl); pt = lerpPt(pin, c, inside); }
    else if (x > d - gl) { inside = EASE.inOut((d - x) / gl); pt = lerpPt(pout, c, inside); }
    this.outline(f.node, S, col, clamp01(x / d), .35 * inside, pin);
    const k0 = C.by[f.a.edges[0]].width / 2.5, breathe = 1 + .08 * Math.sin(x * 7) * inside;
    this.packet(pt, k0, col, (1 - .4 * inside) * breathe, 1 - .45 * inside);
  }
}

/* ---------- Player: the app around one Stage ---------- */
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2.4v14H6zM19 5.5v13L9.5 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M15.6 5H18v14h-2.4zM5 5.5v13L14.5 12z"/></svg>',
  fit: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM4 15h2v3h3v2H4zm14 0h2v5h-5v-2h3z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>',
};
const RATES = [.5, .75, 1, 1.5, 2];

class Player {
  constructor(C, spec, theme) {
    Object.assign(this, { C, spec, theme, home: [theme, spec.theme].find(v => v !== 'light' && THEMES[v]) || 'dark', t: 0, playing: false, until: Infinity, rate: 1, stepMode: false, k: -1, ucam: null, utgt: null, release: false, dirty: true });
    this.muted = false;
    this.voices = C.voice && Object.fromEntries(Object.entries(C.voice).map(([n, set]) =>
      [n, set.map(c => c && { dur: c.dur, el: Object.assign(new Audio(c.src), { preload: 'auto' }) })]));
    // `voice` is the clip list being played; the picker swaps it.
    this.voice = this.voices ? Object.values(this.voices)[0] : null;
    if (this.voice) {
      // requestAnimationFrame stops in a background tab; stop the voice with it.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        this.pause();
        this.voice.forEach(c => c?.el.pause());
      });
    }
    this.still = Q.has('still');
    this.dom();
    this.stage = new Stage(this.$('#svg'), C, THEMES[theme]);
    this.$('#bcast').hidden = !THEMES[theme].hud;
    const S = C.steps;
    if (this.still) {
      document.body.classList.add('still');
      if (Q.has('bare')) document.body.classList.add('bare');
      const n = Math.min(S.length, Math.max(1, parseInt(Q.get('still'), 10) || S.length));
      this.t = Q.has('at') ? Math.min(S[n - 1].t1, S[n - 1].t0 + (+Q.get('at') || 0)) : S[n - 1].rest;
      this.hideIntro();
    } else {
      const h = parseInt(location.hash.slice(1), 10);
      if (h >= 1 && h <= S.length) { this.t = S[h - 1].rest; this.hideIntro(); }
      if (Q.has('t')) { this.seek(+Q.get('t')); this.hideIntro(); }
      if (Q.has('autoplay')) this.play();
    }
    this.render();
    if (!this.still) { this.bind(); this.loop(); }
  }
  $(sel) { return document.querySelector(sel); }
  dom() {
    const { C, spec } = this;
    document.body.insertAdjacentHTML('afterbegin', `
<div id="app">
  <div id="stage">
    <svg id="svg" xmlns="${NS}"></svg>
    <div id="bcast" hidden><i class="cnr tl"></i><i class="cnr tr"></i><i class="cnr bl"></i><i class="cnr br"></i>
      <div class="lbl tl"><b class="rec">&#9679;</b> <span id="bcStep"></span></div><div class="lbl tr" id="bcNum"></div>
      <div class="lbl bl" id="bcTime"></div><div class="lbl br" id="bcTitle"></div></div>
    <div id="intro"><div class="card">
      <div class="eyebrow">${esc(spec.eyebrow || 'Explainer')}</div>
      <h1>${esc(C.title)}</h1>
      ${spec.subtitle ? `<p>${md(spec.subtitle)}</p>` : ''}
      <div class="meta">${C.steps.length} steps · ${fmtT(C.total)}</div>
      <div class="row"><button class="primary" data-go="play">${ICON.play} Play</button><button data-go="next">Step through</button></div>
      <div class="keys"><kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> step · scroll to zoom · drag to pan · <kbd>?</kbd> all keys</div>
    </div></div>
    <div id="hud"><span id="zoomv">100%</span><button id="follow" hidden title="Back to the scripted camera (0)">Follow camera</button></div>
    <aside id="chap" hidden><div class="dh">Chapters</div><ol>${C.steps.map((s, i) => `<li data-k="${i}"><span>${i + 1}</span>${esc(s.title)}<em>${fmtT(s.t0)}</em></li>`).join('')}</ol></aside>
    <div id="help" hidden><div class="card"><h2>Keys</h2><table>
      <tr><td><kbd>Space</kbd> <kbd>K</kbd></td><td>Play / pause</td></tr>
      <tr><td><kbd>→</kbd> <kbd>L</kbd></td><td>Next step (finishes the current animation first)</td></tr>
      <tr><td><kbd>←</kbd> <kbd>J</kbd></td><td>Previous step</td></tr>
      <tr><td><kbd>Home</kbd> <kbd>End</kbd></td><td>Start / end</td></tr>
      <tr><td><kbd>S</kbd></td><td>Step mode: pause after every step</td></tr>
      ${this.voice ? '<tr><td><kbd>V</kbd></td><td>Voice on / off</td></tr>' : ''}
      <tr><td><kbd>[</kbd> <kbd>]</kbd></td><td>Slower / faster</td></tr>
      <tr><td><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></td><td>Zoom in / out / follow the scripted camera</td></tr>
      <tr><td>Scroll · pinch · drag</td><td>Zoom at the pointer · pan</td></tr>
      <tr><td>Double-click</td><td>Zoom into a component (background: fit)</td></tr>
      <tr><td><kbd>O</kbd> <kbd>C</kbd> <kbd>T</kbd> <kbd>F</kbd></td><td>Chapters · captions · light/dark · full screen</td></tr>
    </table><p>The address bar keeps the step (<code>#3</code>), so a reload or a shared link lands on the same step.</p></div></div>
    <button id="lintb" hidden></button>
  </div>
  <div id="cap"><div class="ct"><span id="capn"></span><b id="capt"></b></div><div id="caps"></div></div>
  <div id="bar">
    <button id="bPrev" title="Previous step (←)">${ICON.prev}</button>
    <button id="bPlay" class="primary" title="Play / pause (Space)">${ICON.play}</button>
    <button id="bNext" title="Next step (→)">${ICON.next}</button>
    <div id="tl">${C.steps.map(() => '<div class="seg"><i></i></div>').join('')}<div id="tip" hidden></div></div>
    <span id="time"></span>
    <button id="bRate" class="txt" title="Speed ([ and ])">1×</button>
    ${this.voice ? '<button id="bVoice" class="txt" title="Voice on / off (V)">Voice on</button>' : ''}
    ${this.voices && Object.keys(this.voices).length > 1 ? `<select id="sVoice" title="Narrator voice">${Object.keys(this.voices).map(n => `<option value="${esc(n)}">${esc(voiceName(n))}</option>`).join('')}</select>` : ''}
    <button id="bStep" class="txt" title="Pause after every step (S)">Step mode</button>
    <span class="sep"></span>
    <button id="bZo" class="txt" title="Zoom out (−)">−</button>
    <button id="bFit" title="Fit / follow the camera (0)">${ICON.fit}</button>
    <button id="bZi" class="txt" title="Zoom in (+)">+</button>
    <span class="sep"></span>
    <button id="bChap" title="Chapters (O)">${ICON.list}</button>
    <button id="bHelp" class="txt" title="Keys (?)">?</button>
  </div>
</div>`);
    this.svg = this.$('#svg');
    this.segs = [...document.querySelectorAll('.seg')];
    this.segs.forEach((g, i) => { g.style.flexGrow = (C.steps[i].t1 - C.steps[i].t0).toFixed(3); });
    const issues = C.issues;
    if (issues.length) {
      const b = this.$('#lintb');
      b.hidden = false;
      b.textContent = `⚠ ${issues.length} authoring issue${issues.length > 1 ? 's' : ''}`;
      b.title = issues.map(i => `step ${i.step}: ${i.msg}`).join('\n');
    }
  }
  toggleVoice() {
    if (!this.voice) return;
    this.muted = !this.muted;
    this.$('#bVoice').textContent = this.muted ? 'Voice off' : 'Voice on';
    if (this.playing && this.until !== Infinity) {
      this.until = this.stepMode ? this.nextStop() : Math.max(this.t, this.stopOf(this.idx(this.t)));
    }
  }
  setVoice(name) {
    if (!this.voices?.[name]) return;
    this.voice.forEach(c => c?.el.pause());
    this.voice = this.voices[name];
    if (this.playing && this.until !== Infinity) {
      this.until = this.stepMode ? this.nextStop() : Math.max(this.t, this.stopOf(this.idx(this.t)));
    }
  }
  // Keeps the current step's clip at the playhead; every other clip stays paused.
  syncVoice() {
    if (!this.voice) return;
    const k = this.idx(this.t), off = this.t - voiceAt(this.C.steps[k]), clip = this.voice[k];
    this.voice.forEach((c, i) => { if (c && i !== k && !c.el.paused) c.el.pause(); });
    if (!clip) return;
    if (!this.playing || this.muted || off < 0 || off >= clip.dur) { if (!clip.el.paused) clip.el.pause(); return; }
    clip.el.playbackRate = this.rate;
    if (Math.abs(clip.el.currentTime - off) > .3) clip.el.currentTime = off;
    if (clip.el.paused) clip.el.play().catch(() => {});
  }
  idx(t) {
    const S = this.C.steps;
    for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].t0 - 1e-6) return i;
    return 0;
  }
  // Where stepping through step k pauses: after its narration if it has one, else at its rest.
  stopOf(k) {
    const s = this.C.steps[k];
    if (!this.voice?.[k] || this.muted) return s.rest;
    return Math.max(s.rest, Math.min(s.t1, voiceAt(s) + this.voice[k].dur));
  }
  nextStop() {
    for (let k = 0; k < this.C.steps.length; k++) if (this.stopOf(k) > this.t + 1e-3) return this.stopOf(k);
    return this.C.total;
  }
  seek(t) { this.t = Math.max(0, Math.min(this.C.total, t)); this.dirty = true; }
  play(until = Infinity) {
    this.hideIntro();
    if (this.t >= this.C.total - 1e-3) this.t = 0;
    this.until = this.stepMode ? Math.min(until, this.nextStop()) : until;
    this.playing = true;
    this.dirty = true;
  }
  pause() { this.playing = false; this.dirty = true; }
  toggle() { this.playing ? this.pause() : this.play(); }
  next() {
    this.hideIntro();
    const S = this.C.steps, e = 1e-3, k = this.idx(this.t), s = S[k];
    if (this.t < s.rest - e) {
      if (!this.playing && this.t <= s.t0 + e) this.play(this.stopOf(k));
      else this.seek(s.rest);
      return;
    }
    if (k + 1 >= S.length) { this.seek(this.C.total); this.pause(); return; }
    const cont = this.playing && this.until === Infinity;
    this.seek(S[k + 1].t0);
    if (!cont) this.play(this.stopOf(k + 1));
  }
  prev() {
    this.hideIntro();
    const k = this.idx(this.t);
    this.seek(k > 0 ? this.C.steps[k - 1].rest : 0);
    if (this.playing && this.until !== Infinity) this.pause();
  }
  playStep(k) {
    this.hideIntro();
    const cont = this.playing && this.until === Infinity;
    this.seek(this.C.steps[k].t0);
    if (!cont) this.play(this.stopOf(k));
  }
  toggleStep() {
    this.stepMode = !this.stepMode;
    if (this.playing) this.until = this.stepMode ? this.nextStop() : Infinity;
    this.dirty = true;
  }
  speed(dir) {
    const i = RATES.indexOf(this.rate);
    this.rate = RATES[Math.max(0, Math.min(RATES.length - 1, i + dir))];
    this.dirty = true;
  }
  hideIntro() { const n = this.$('#intro'); if (n) n.classList.add('gone'); }

  /* camera: scripted (timeline) unless the user zooms or pans */
  cam() { return this.ucam || this.S.$cam; }
  clampCam(c) {
    const { W, H } = this.C, w = Math.max(W / 12, Math.min(W * 3, c.w)), h = w * H / W;
    return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h };
  }
  setU(target, instant) {
    if (!this.ucam) this.ucam = Object.assign({}, this.S.$cam);
    this.utgt = this.clampCam(target);
    this.release = false;
    if (instant) this.ucam = Object.assign({}, this.utgt);
    this.dirty = true;
  }
  zoomBy(f, px, py) {
    const c = this.utgt || this.cam();
    px = px ?? c.x + c.w / 2;
    py = py ?? c.y + c.h / 2;
    this.setU({ x: px - (px - c.x) / f, y: py - (py - c.y) / f, w: c.w / f, h: c.h / f });
  }
  fitView() { if (this.ucam) { this.release = true; this.dirty = true; } }
  toSvg(cx, cy) {
    const p = this.svg.createSVGPoint();
    p.x = cx; p.y = cy;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  bind() {
    const $ = s => this.$(s);
    $('#bPlay').onclick = () => this.toggle();
    $('#bNext').onclick = () => this.next();
    $('#bPrev').onclick = () => this.prev();
    $('#bRate').onclick = () => { const i = RATES.indexOf(this.rate); this.rate = RATES[(i + 1) % RATES.length]; this.dirty = true; };
    if (this.voice) $('#bVoice').onclick = () => this.toggleVoice();
    // Blur after a pick so the arrow keys step the explainer again instead of changing the voice.
    if ($('#sVoice')) $('#sVoice').onchange = ev => { this.setVoice(ev.target.value); ev.target.blur(); };
    $('#bStep').onclick = () => this.toggleStep();
    $('#bZi').onclick = () => this.zoomBy(1.4);
    $('#bZo').onclick = () => this.zoomBy(1 / 1.4);
    $('#bFit').onclick = $('#follow').onclick = () => this.fitView();
    $('#bChap').onclick = () => { $('#chap').hidden = !$('#chap').hidden; };
    $('#bHelp').onclick = () => { $('#help').hidden = !$('#help').hidden; };
    $('#help').onclick = ev => { if (ev.target.id === 'help') $('#help').hidden = true; };
    $('#lintb').onclick = () => alert($('#lintb').title);
    $('#intro').onclick = ev => {
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go === 'next') this.next(); else this.play();
    };
    $('#chap').onclick = ev => { const li = ev.target.closest('li'); if (li) this.playStep(+li.dataset.k); };

    // timeline scrub + hover tip
    const tl = $('#tl'), tip = $('#tip');
    const at = x => {
      for (let k = 0; k < this.segs.length; k++) {
        const r = this.segs[k].getBoundingClientRect();
        if (x <= r.right + 1.5 || k === this.segs.length - 1) {
          const s = this.C.steps[k];
          return { k, t: s.t0 + clamp01((x - r.left) / r.width) * (s.t1 - s.t0) };
        }
      }
      return { k: 0, t: 0 };
    };
    let scrub = null;
    tl.onpointerdown = ev => {
      try { tl.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic events have no capturable pointer */ }
      scrub = { was: this.playing };
      this.pause();
      this.hideIntro();
      this.seek(at(ev.clientX).t);
    };
    tl.onpointermove = ev => {
      const a = at(ev.clientX), r = tl.getBoundingClientRect();
      tip.hidden = false;
      tip.textContent = `${a.k + 1}. ${this.C.steps[a.k].title}`;
      tip.style.left = Math.max(60, Math.min(r.width - 60, ev.clientX - r.left)) + 'px';
      if (scrub) this.seek(a.t);
    };
    tl.onpointerup = () => { if (scrub && scrub.was) this.play(); scrub = null; };
    tl.onpointerleave = () => { tip.hidden = true; };

    // zoom + pan on the stage
    const svg = this.svg, stage = $('#stage');
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      const p = this.toSvg(ev.clientX, ev.clientY);
      this.zoomBy(Math.exp(-ev.deltaY * (ev.ctrlKey ? .012 : .0022)), p.x, p.y);
    }, { passive: false });
    let drag = null;
    svg.onpointerdown = ev => {
      if (ev.button !== 0) return;
      try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic events have no capturable pointer */ }
      drag = { x: ev.clientX, y: ev.clientY, cam: Object.assign({}, this.utgt || this.cam()), upp: 1 / svg.getScreenCTM().a, moved: false };
    };
    svg.onpointermove = ev => {
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      stage.classList.add('panning');
      this.setU({ x: drag.cam.x - dx * drag.upp, y: drag.cam.y - dy * drag.upp, w: drag.cam.w, h: drag.cam.h }, true);
    };
    svg.onpointerup = () => { drag = null; stage.classList.remove('panning'); };
    svg.ondblclick = ev => {
      const n = ev.target.closest('[data-id]'), e = n && this.C.by[n.dataset.id];
      if (!e) return this.fitView();
      this.setU(fit(bbox(e, this.S[e.id], this.S), 70, this.C.W, this.C.H));
    };

    // Mouse clicks must not leave focus on a button, or Space would toggle twice.
    document.querySelectorAll('#app button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    addEventListener('keydown', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if ((ev.key === ' ' || ev.key === 'Enter') && ev.target.closest && ev.target.closest('button')) return;
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const act = {
        ' ': () => this.toggle(), k: () => this.toggle(),
        ArrowRight: () => this.next(), l: () => this.next(), PageDown: () => this.next(),
        ArrowLeft: () => this.prev(), j: () => this.prev(), PageUp: () => this.prev(),
        Home: () => { this.hideIntro(); this.seek(0); }, End: () => { this.hideIntro(); this.seek(this.C.total); this.pause(); },
        s: () => this.toggleStep(), '[': () => this.speed(-1), ']': () => this.speed(1), v: () => this.toggleVoice(),
        '+': () => this.zoomBy(1.4), '=': () => this.zoomBy(1.4), '-': () => this.zoomBy(1 / 1.4), '_': () => this.zoomBy(1 / 1.4), '0': () => this.fitView(),
        o: () => { $('#chap').hidden = !$('#chap').hidden; },
        c: () => { $('#cap').hidden = !$('#cap').hidden; },
        t: () => this.flipTheme(),
        f: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(),
        '?': () => { $('#help').hidden = !$('#help').hidden; }, h: () => { $('#help').hidden = !$('#help').hidden; },
        Escape: () => { $('#help').hidden = true; $('#chap').hidden = true; },
      }[k];
      if (!act) return;
      ev.preventDefault();
      act();
    });
  }
  flipTheme() {
    this.theme = this.theme === 'light' ? this.home : 'light';
    document.documentElement.dataset.theme = this.theme;
    this.stage.setTheme(THEMES[this.theme]);
    this.$('#bcast').hidden = !THEMES[this.theme].hud;
    this.dirty = true;
  }
  loop() {
    let last = performance.now();
    const frame = now => {
      this.tick(Math.min(.1, (now - last) / 1000));
      last = now;
      if (this.dirty) { this.dirty = false; this.render(); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  tick(dt) {
    if (this.playing) {
      let t = this.t + dt * this.rate;
      if (REDUCE) { const s = this.C.steps[this.idx(t)]; if (t > s.t0 && t < s.rest) t = s.rest; }
      if (t >= this.until) { t = this.until; this.playing = false; }
      if (t >= this.C.total) { t = this.C.total; this.playing = false; }
      this.t = t;
      this.dirty = true;
    }
    this.syncVoice();
    if (this.ucam) {
      if (this.release) this.utgt = Object.assign({}, this.S.$cam);
      const a = 1 - Math.exp(-dt * 12);
      let moving = false;
      for (const p of ['x', 'y', 'w', 'h']) {
        const d = this.utgt[p] - this.ucam[p];
        if (Math.abs(d) > .05) { this.ucam[p] += d * a; moving = true; } else this.ucam[p] = this.utgt[p];
      }
      if (this.release && !moving) { this.ucam = this.utgt = null; this.release = false; }
      this.dirty = true;
    }
  }
  render() {
    this.S = this.stage.paint(this.t, this.ucam);
    const k = this.idx(this.t), C = this.C;
    if (k !== this.k) {
      this.k = k;
      const s = C.steps[k], cap = this.$('#cap');
      this.$('#capn').textContent = `${k + 1} / ${C.steps.length}`;
      this.$('#capt').textContent = s.title;
      this.$('#caps').innerHTML = md(s.say);
      cap.classList.remove('in');
      void cap.offsetWidth;
      cap.classList.add('in');
      document.querySelectorAll('#chap li').forEach((li, i) => li.classList.toggle('cur', i === k));
      if (!this.still) history.replaceState(null, '', '#' + (k + 1));
    }
    if (THEMES[this.theme].hud) {
      const f = Math.floor(this.t * 30), pad = v => String(v).padStart(2, '0');
      this.$('#bcTime').textContent = `${pad(Math.floor(f / 108000))}:${pad(Math.floor(f / 1800) % 60)}:${pad(Math.floor(f / 30) % 60)}:${pad(f % 30)}`;
      this.$('#bcStep').textContent = C.steps[k].title;
      this.$('#bcNum').textContent = `STEP ${pad(k + 1)} / ${pad(C.steps.length)}`;
      this.$('#bcTitle').textContent = C.title;
    }
    if (this.still) return;
    const end = this.t >= C.total - 1e-3;
    this.$('#bPlay').innerHTML = this.playing ? ICON.pause : end ? ICON.replay : ICON.play;
    this.$('#time').textContent = `${fmtT(this.t)} / ${fmtT(C.total)}`;
    this.$('#bRate').textContent = `${this.rate}×`;
    this.$('#bStep').classList.toggle('on', this.stepMode);
    C.steps.forEach((s, i) => {
      const seg = this.segs[i];
      seg.firstChild.style.width = (clamp01((this.t - s.t0) / (s.t1 - s.t0)) * 100).toFixed(2) + '%';
      seg.classList.toggle('cur', i === k);
    });
    const c = this.cam();
    this.$('#zoomv').textContent = Math.round(C.W / c.w * 100) + '%';
    this.$('#follow').hidden = !this.ucam || this.release;
  }
}

/* ---------- contact sheet: every step's resting state on one page ---------- */
function sheet(C, theme) {
  document.body.classList.add('sheet');
  const n = C.steps.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const root = document.createElement('div');
  root.id = 'sheet';
  root.style.setProperty('--cols', cols);
  root.innerHTML = `<h1>${esc(C.title)} <span>${n} steps · ${fmtT(C.total)}</span></h1>`;
  document.body.prepend(root);
  C.steps.forEach((st, k) => {
    const card = document.createElement('div');
    card.className = 'sc';
    card.innerHTML = `<svg xmlns="${NS}"></svg><div class="cc"><b>${k + 1} · ${esc(st.title)}</b> ${md(st.say)}</div>`;
    root.appendChild(card);
    card.firstChild.style.aspectRatio = `${C.W} / ${C.H}`;
    new Stage(card.firstChild, C, THEMES[theme]).paint(st.rest);
  });
  lint(`sheet-height ${Math.ceil(document.documentElement.scrollHeight)}`);
}

/* ---------- boot ---------- */
let booted = false;
function scene(spec) {
  const go = () => {
    if (booted) return;
    booted = true;
    try {
      const C = compile(spec);
      lintLayout(C);
      lint('motion-lint 1');
      lint(`size ${C.W} ${C.H}`);
      lint(`steps ${C.steps.length}`);
      lint(`duration ${C.total.toFixed(1)}`);
      for (const [n, set] of Object.entries(C.voice || {})) {
        const clips = set.filter(Boolean);
        lint(`voice ${clips.length} clips ${clips.reduce((t, c) => t + c.dur, 0).toFixed(1)}${n === 'voice' ? '' : ` ${n}`}`);
      }
      for (const i of C.issues.slice().sort((a, b) => (a.lvl === 'error' ? 0 : 1) - (b.lvl === 'error' ? 0 : 1) || a.step - b.step)) {
        lint(`${i.lvl} ${i.step ? `step ${i.step}: ` : ''}${i.msg}`);
      }
      const want = Q.get('theme') || spec.theme || 'dark', theme = THEMES[want] ? want : 'dark';
      if (theme !== want) lint(`warn unknown theme '${want}' (use ${Object.keys(THEMES).join(', ')})`);
      document.documentElement.dataset.theme = theme;
      document.title = C.title;
      if (!C.steps.length) return fatal('The scene has no steps. Add at least one { title, say, do: [...] }.');
      if (Q.has('sheet')) return sheet(C, theme);
      Motion.player = new Player(C, spec, theme);
    } catch (err) {
      lint(`error boot: ${err.message}`);
      fatal(err.stack || err.message);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
}
addEventListener('load', () => { if (!booted) lint('error no Motion.scene({...}) call ran'); });

window.Motion = { scene, compile, stateAt, version: 1 };
})();
