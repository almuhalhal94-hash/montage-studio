// One File Studio engine: one paused GSAP timeline, word-anchored timing, kinetic type, cameras, per-frame drawers.
// Every scene builds once; renderFrame(t) (boot.js) seeks the timeline and runs the drawers, so any frame renders alone.
(function () {
  const D = window.DATA, W = (D.size || [1920, 1080])[0], H = (D.size || [1920, 1080])[1];
  const A = window.A = { D, W, H, drawers: [], builders: [], K: {} };
  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  A.TL = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', immediateRender: false } });
  const TL = A.TL;
  // ---- time comes from the voice ----
  A.wi = (line, i) => { const ws = D.words.filter(x => x.line === line); const w = ws[i < 0 ? ws.length + i : i]; if (!w) throw new Error(`no word ${line}[${i}]`); return w; };
  A.ws = (line, i) => A.wi(line, i).s;
  A.we = (line, i) => A.wi(line, i).e;
  // ---- elements ----
  A.el = (html, parent) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const e = d.firstElementChild;
    (typeof parent === 'string' ? A.$(parent) : parent || A.$('#scenes')).appendChild(e); return e; };
  A.split = el => { const out = []; const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) { const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(p => { if (!p) return; if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p)); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); out.push(s); } });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c); });
    walk(el); return out; };
  A.chars = el => { const t = el.textContent; el.textContent = ''; return [...t].map(ch => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; if (ch === ' ') s.style.width = '.28em'; el.appendChild(s); return s; }); };
  // ---- scenes on/off and entrances (from-states are applied at build time so nothing shows early) ----
  A.on = (el, t, dur = 0) => dur ? TL.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur, ease: 'power1.out' }, t) : TL.set(el, { autoAlpha: 1 }, Math.max(t, 0.0001));
  A.off = (el, t, dur = 0) => dur ? TL.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: dur, ease: 'power1.in' }, t) : TL.set(el, { autoAlpha: 0 }, t);
  A.enter = (el, from, to, t) => { gsap.set(el, from); return TL.fromTo(el, from, to, t); };
  A.blurIn = (els, t, o = {}) => { [].concat(els).forEach((e, i) => { const fr = { opacity: 0, y: o.y ?? 14, filter: `blur(${o.blur ?? 9}px)` }; if (o.scale) fr.scale = o.scale;
      gsap.set(e, fr); const to = { opacity: 1, y: 0, filter: 'blur(0px)', duration: Math.max(o.dur ?? .5, .3), ease: o.ease || 'power2.out' }; if (o.scale) to.scale = 1;
      TL.fromTo(e, fr, to, Array.isArray(t) ? t[i] : t + i * (o.stagger ?? 0)); }); };
  A.blurOut = (els, t, o = {}) => [].concat(els).forEach((e, i) => TL.fromTo(e, { opacity: 1, filter: 'blur(0px)', y: 0 }, { opacity: 0, filter: `blur(${o.blur ?? 14}px)`, y: o.y ?? -10, duration: o.dur ?? .24, ease: 'power2.in' }, t + i * (o.stagger ?? 0)));
  A.sync = (spans, line, first = 0, lead = .14, o = {}) => { const ws = D.words.filter(x => x.line === line).slice(first); A.blurIn(spans, spans.map((s, i) => Math.max(.0001, ws[i].s - lead)), o); };
  // ---- captions: one VO line at a time, word-synced, lower third, keyword colored ----
  A.caption = (line, o = {}) => { const words = D.words.filter(x => x.line === line);
    const show = w => (/^[A-Z]{3,}[.!?,]*$/.test(w) && !(o.keep || []).includes(w)) ? w.toLowerCase() : w;   // spoken CAPS emphasis -> normal case on screen
    const c = A.el(`<div class="cap nw">${words.map((w, i) => `<span class="w${(o.hl || []).includes(i) ? ' hl' : ''}">${show(w.w)}</span>`).join(' ')}</div>`, '#hud');
    if (o.top) c.style.top = o.top + 'px';
    const sp = A.$$('.w', c); A.blurIn(sp, sp.map((s, i) => Math.max(.0001, words[i].s - .1)), { dur: .32, y: 8, blur: 6 });
    TL.to(c, { opacity: 0, filter: 'blur(6px)', duration: .22, ease: 'power2.in' }, o.until ?? (words[words.length - 1].e + .35)); return c; };
  // ---- homography: matrix3d that maps a w x h box onto quad [TL, TR, BR, BL] ----
  A.quad = (w, h, Q) => {
    const adj = m => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
    const mm = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]; c.push(s); } return c; };
    const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
    const basis = p => { const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; const v = mv(adj(m), [p[3][0], p[3][1], 1]); return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); };
    const s = basis([[0, 0], [w, 0], [0, h], [w, h]]), d = basis([Q[0], Q[1], Q[3], Q[2]]); const M = mm(d, adj(s)); const T = M.map(x => x / M[8]);
    return `matrix3d(${[T[0], T[3], 0, T[6], T[1], T[4], 0, T[7], 0, 0, 1, 0, T[2], T[5], 0, T[8]].map(x => +x.toFixed(9)).join(',')})`; };
  // ---- a big photo as a stage with a camera: A.stage(el, photoW, photoH) then A.photoCam(el, {z, x, y}) (z = 1 is cover-fit) ----
  A.stage = (el, pw, ph) => { Object.assign(el.style, { position: 'absolute', width: pw + 'px', height: ph + 'px', left: (W - pw) / 2 + 'px', top: (H - ph) / 2 + 'px', transformOrigin: '50% 50%' });
    el.dataset.fit = Math.max(W / pw, H / ph); return el; };
  A.photoCam = (el, c) => { el.style.transform = `translate(${(c.x || 0).toFixed(2)}px, ${(c.y || 0).toFixed(2)}px) scale(${(+el.dataset.fit * (c.z || 1)).toFixed(5)})`; };
  // ---- deterministic random, typing, particles ----
  A.seed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  A.typer = (el, text, t0, t1, o = {}) => { const r = A.seed(o.seed || 7), n = text.length, w = [...text].map(ch => (ch === ' ' ? 1.5 : /[.,]/.test(ch) ? 2.2 : 1) * (.7 + r() * .6));
    const tot = w.reduce((a, b) => a + b, 0), cum = [0]; w.forEach(x => cum.push(cum[cum.length - 1] + x / tot)); let last = -1;
    A.addDraw(t => { let k = 0; if (t >= t1) k = n; else if (t > t0) { const p = (t - t0) / (t1 - t0); while (k < n && cum[k + 1] <= p) k++; }
      if (k !== last) { el.textContent = text.slice(0, k); last = k; }
      if (o.caret) o.caret.style.opacity = (t > (o.caretFrom ?? t0 - .6) && t < (o.caretTo ?? t1 + .8)) ? ((t > t0 && t < t1) ? 1 : (Math.floor(t * 2.2) % 2 ? 0 : 1)) : 0; });
    return cum.map(c => t0 + c * (t1 - t0)); };
  A.embers = (canvas, o = {}) => { const cx = canvas.getContext('2d'); canvas.width = W; canvas.height = H; const r = A.seed(o.seed || 3), life = o.life || 2.2;
    const P = Array.from({ length: o.n || 80 }, () => ({ x: r(), y: r(), born: r() * life, vx: (r() - .5) * 60, vy: -(80 + r() * 160), s: 1 + r() * 2.6, f: r() * 6.28, h: r() }));
    return (t, box, k = 1, dir = 1) => { cx.clearRect(0, 0, W, H); if (k <= 0) return; cx.globalCompositeOperation = 'lighter';
      P.forEach(p => { const age = ((t * dir - p.born) % life + life) % life, u = age / life; const x = box.x + p.x * box.w + p.vx * age + Math.sin(age * 3 + p.f) * 14, y = box.y + p.y * box.h + p.vy * age;
        const a = Math.sin(Math.PI * u) * k, rad = p.s * (1 - u * .5); const g = cx.createRadialGradient(x, y, 0, x, y, rad * 4);
        g.addColorStop(0, `rgba(255,${190 + p.h * 50 | 0},${110 + p.h * 60 | 0},${a})`); g.addColorStop(.35, `rgba(255,${110 + p.h * 40 | 0},30,${a * .45})`); g.addColorStop(1, 'rgba(255,80,20,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rad * 4, 0, 6.283); cx.fill(); });
      cx.globalCompositeOperation = 'source-over'; }; };
  // ---- footage inside a scene: frames from assets/clips/<name>/fNNN.jpg (ffmpeg, at the comp fps) on one <img> ----
  // schedule = [{c: 'name', n: frames, t0, t1, from}]; the last entry whose t0 has passed plays; it holds its last frame after t1
  A.clipPlayer = (img, schedule, fps = 30) => { let cur = '';
    A.addDraw(t => { let e = schedule[0]; for (const s of schedule) if (t >= s.t0) e = s;
      const i = Math.min(e.n - 1, Math.max(0, Math.floor(Math.max(0, Math.min(t, e.t1) - e.t0) * fps + 1e-6) + (e.from || 0)));
      const src = `../assets/clips/${e.c}/f${String(i + 1).padStart(3, '0')}.jpg`;
      if (src === cur) return; cur = src; img.src = src; return img.decode().catch(() => {}); }); };
  // drawers run every frame after the timeline seek; they must set their state for EVERY t (stills render out of order)
  A.addDraw = f => A.drawers.push(f);
  A.build = f => A.builders.push(f);
  // ---- film grain: 4 seeded tiles, one per frame ----
  const gc = A.$('#grain'), gx = gc.getContext('2d'); gc.width = W / 2; gc.height = H / 2;
  const tiles = [0, 1, 2, 3].map(k => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const im = x.createImageData(256, 256); const r = A.seed(1000 + k);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - .5) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; });
  A.addDraw(t => { gx.fillStyle = gx.createPattern(tiles[Math.round(t * 30) % 4], 'repeat'); gx.fillRect(0, 0, gc.width, gc.height); });
})();
