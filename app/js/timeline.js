// الخط الزمني: سحب وترتيب وقص — باللمس أو الفأرة
import { layoutClips, projectDuration, audioLength, fmtTime, clamp } from './model.js';
import { waveformURL } from './media.js';

const TRACKS = [
  { key: 'clips', label: 'المشاهد', icon: '🎞️' },
  { key: 'texts', label: 'النصوص', icon: '✍️' },
  { key: 'voice', label: 'التعليق الصوتي', icon: '🎙️' },
  { key: 'bg', label: 'الخلفية الصوتية', icon: '🎧' },
];

export class Timeline {
  constructor(root, store, player, media) {
    this.root = root;
    this.store = store;
    this.player = player;
    this.media = media;
    this.pps = 60;
    this.autoFit = true;
    this.drag = null;
    this.waveCache = new Map();
    root.innerHTML = `
      <div class="tl-heads"><div class="tl-head ruler-head"></div>${TRACKS.map((t) => `<div class="tl-head" data-track="${t.key}"><span>${t.icon}</span><b>${t.label}</b></div>`).join('')}</div>
      <div class="tl-scroll"><div class="tl-inner">
        <div class="tl-ruler"></div>
        ${TRACKS.map((t) => `<div class="tl-track" data-track="${t.key}"></div>`).join('')}
        <div class="tl-playhead"><i></i></div>
        <div class="tl-insert"></div>
      </div></div>`;
    this.scroll = root.querySelector('.tl-scroll');
    this.inner = root.querySelector('.tl-inner');
    this.ruler = root.querySelector('.tl-ruler');
    this.head = root.querySelector('.tl-playhead');
    this.insert = root.querySelector('.tl-insert');
    this.tracks = Object.fromEntries(TRACKS.map((t) => [t.key, root.querySelector(`.tl-track[data-track="${t.key}"]`)]));
    this.heads = Object.fromEntries(TRACKS.map((t) => [t.key, root.querySelector(`.tl-head[data-track="${t.key}"]`)]));

    this.bindScrub();
    this.bindItems();
    store.on(() => this.render());
    player.on((t) => this.updateHead(t));
    media.onChange(() => this.render());
    new ResizeObserver(() => { if (this.autoFit) this.fit(); }).observe(this.scroll);
  }

  fit() {
    const dur = Math.max(5, projectDuration(this.store.project));
    const w = this.scroll.clientWidth - 40;
    if (w > 50) this.pps = clamp(w / dur, 4, 400);
    this.render();
  }

  setZoom(pps) {
    this.autoFit = false;
    const center = (this.scroll.scrollLeft + this.scroll.clientWidth / 2) / this.pps;
    this.pps = clamp(pps, 4, 400);
    this.render();
    this.scroll.scrollLeft = center * this.pps - this.scroll.clientWidth / 2;
  }

  x(t) { return 16 + t * this.pps; }
  t(x) { return Math.max(0, (x - 16) / this.pps); }

  render() {
    const p = this.store.project;
    const layout = layoutClips(p);
    const dur = projectDuration(p, layout);
    const width = Math.max(this.scroll.clientWidth, this.x(dur) + 240);
    this.inner.style.width = width + 'px';
    this.renderRuler(width);
    const sel = this.store.sel;

    // المشاهد
    const ct = this.tracks.clips;
    ct.innerHTML = '';
    for (const L of layout) {
      const c = L.clip;
      const m = this.media.get(c.mediaId);
      const el = document.createElement('div');
      el.className = 'tl-item clip' + (sel?.id === c.id ? ' sel' : '') + (m ? '' : ' missing');
      el.dataset.kind = 'clip'; el.dataset.id = c.id;
      el.style.left = this.x(L.start) + 'px';
      el.style.width = Math.max(6, L.len * this.pps) + 'px';
      if (m?.thumb) el.style.backgroundImage = `url(${m.thumb})`;
      el.innerHTML = `<span class="cap">${c.type === 'video' ? '▶' : '🖼'} ${L.len.toFixed(1)}ث</span><i class="h l" data-h="l"></i><i class="h r" data-h="r"></i>`;
      ct.appendChild(el);
      if (L.tr > 0) {
        const tr = document.createElement('div');
        tr.className = 'tl-trans';
        tr.title = 'انتقال';
        tr.dataset.kind = 'clip'; tr.dataset.id = c.id;
        tr.style.left = this.x(L.start + L.tr / 2) + 'px';
        ct.appendChild(tr);
      }
    }
    if (!layout.length) ct.innerHTML = '<div class="tl-empty">ارفع صوراً أو فيديو من «الوسائط» وستظهر هنا</div>';

    // النصوص (بمسارات فرعية عند التداخل)
    const tt = this.tracks.texts;
    tt.innerHTML = '';
    const lanes = [];
    const sorted = [...p.texts].sort((a, b) => a.start - b.start);
    for (const tx of sorted) {
      let lane = lanes.findIndex((end) => end <= tx.start + 0.01);
      if (lane < 0) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = tx.start + tx.dur;
      const el = document.createElement('div');
      el.className = 'tl-item text' + (sel?.id === tx.id ? ' sel' : '');
      el.dataset.kind = 'text'; el.dataset.id = tx.id;
      el.style.left = this.x(tx.start) + 'px';
      el.style.width = Math.max(6, tx.dur * this.pps) + 'px';
      el.style.top = 4 + lane * 30 + 'px';
      el.innerHTML = `<span class="cap"></span><i class="h l" data-h="l"></i><i class="h r" data-h="r"></i>`;
      el.querySelector('.cap').textContent = tx.text.replace(/\n/g, ' ');
      tt.appendChild(el);
    }
    const textH = Math.max(1, lanes.length) * 30 + 8;
    tt.style.height = textH + 'px';
    this.heads.texts.style.height = textH + 'px';

    // الصوت
    for (const role of ['voice', 'bg']) {
      const tr = this.tracks[role];
      tr.innerHTML = '';
      for (const a of p.audio.filter((x) => x.role === role)) {
        const m = this.media.get(a.mediaId);
        const len = audioLength(a);
        const el = document.createElement('div');
        el.className = `tl-item audio ${role}` + (sel?.id === a.id ? ' sel' : '');
        el.dataset.kind = 'audio'; el.dataset.id = a.id;
        el.style.left = this.x(a.start) + 'px';
        el.style.width = Math.max(6, len * this.pps) + 'px';
        const peaks = this.media.peaks.get(a.mediaId);
        if (peaks && m) {
          const key = `${a.id}|${a.in}|${a.out}|${a.loop}|${Math.round(len * this.pps)}`;
          let url = this.waveCache.get(key);
          if (!url) {
            const span = a.out - a.in;
            url = waveformURL(peaks, a.in, a.out, m.duration, Math.min(len, span) * this.pps, 36);
            this.waveCache.set(key, url);
            if (this.waveCache.size > 200) this.waveCache.delete(this.waveCache.keys().next().value);
          }
          el.style.backgroundImage = `url(${url})`;
          el.style.backgroundSize = a.loop ? `${(a.out - a.in) * this.pps}px 100%` : '100% 100%';
        } else if (m) {
          this.media.decodeAudio(a.mediaId, true).then(() => this.render());
        }
        el.innerHTML = `<span class="cap"></span><i class="h l" data-h="l"></i><i class="h r" data-h="r"></i>`;
        el.querySelector('.cap').textContent = (a.loop ? '🔁 ' : '') + (m?.name || 'ملف مفقود');
        tr.appendChild(el);
      }
    }
    this.updateHead(this.player.t);
  }

  renderRuler(width) {
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    const step = steps.find((s) => s * this.pps >= 54) || 300;
    let html = '';
    for (let s = 0; this.x(s) < width; s += step) {
      html += `<span style="left:${this.x(s)}px">${fmtTime(s, step < 1)}</span>`;
    }
    this.ruler.innerHTML = html;
  }

  updateHead(t) {
    this.head.style.transform = `translateX(${this.x(t)}px)`;
    if (this.player.playing) {
      const x = this.x(t);
      const sl = this.scroll.scrollLeft;
      if (x > sl + this.scroll.clientWidth - 40 || x < sl) this.scroll.scrollLeft = x - 60;
    }
  }

  localX(e) {
    const r = this.inner.getBoundingClientRect();
    return e.clientX - r.left;
  }

  bindScrub() {
    const start = (e) => {
      if (e.target.closest('.tl-item, .tl-trans')) return;
      if (e.pointerType === 'touch' && !e.target.closest('.tl-ruler')) {
        // اللمس على مساحة فارغة: نترك التمرير الأفقي، ونقفز للنقطة عند النقرة فقط
        const x0 = e.clientX, y0 = e.clientY;
        const up = (ev) => {
          window.removeEventListener('pointerup', up);
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) { this.store.select(null); this.player.seek(this.t(this.localX(ev))); }
        };
        window.addEventListener('pointerup', up);
        return;
      }
      e.preventDefault();
      if (!e.target.closest('.tl-ruler')) this.store.select(null);
      this.player.seek(this.t(this.localX(e)));
      const move = (ev) => this.player.seek(this.t(this.localX(ev)));
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    this.inner.addEventListener('pointerdown', start);
  }

  snapPoints(excludeId) {
    const p = this.store.project;
    const pts = [0, this.player.t];
    for (const L of layoutClips(p)) { pts.push(L.start, L.end); }
    for (const t of p.texts) if (t.id !== excludeId) pts.push(t.start, t.start + t.dur);
    for (const a of p.audio) if (a.id !== excludeId) pts.push(a.start, a.start + audioLength(a));
    return pts;
  }

  snap(t, pts) {
    const tol = 9 / this.pps;
    let best = t, bd = tol;
    for (const s of pts) { const d = Math.abs(s - t); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  bindItems() {
    this.inner.addEventListener('pointerdown', (e) => {
      const item = e.target.closest('.tl-item, .tl-trans');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const kind = item.dataset.kind, id = item.dataset.id;
      const handle = e.target.dataset.h || null;
      this.store.select(kind, id);
      const p = this.store.project;
      const obj = (kind === 'clip' ? p.clips : kind === 'text' ? p.texts : p.audio).find((x) => x.id === id);
      if (!obj || item.classList.contains('tl-trans')) return;
      const orig = JSON.parse(JSON.stringify(obj));
      const x0 = e.clientX;
      const pts = this.snapPoints(id);
      let moved = false;
      const key = `drag:${id}:${Date.now()}`;
      const move = (ev) => {
        const dxp = ev.clientX - x0;
        if (!moved && Math.abs(dxp) < 5) return;
        moved = true;
        const dx = dxp / this.pps;
        if (kind === 'clip') this.dragClip(id, orig, handle, dx, key, ev);
        else if (kind === 'text') this.dragText(id, orig, handle, dx, key, pts);
        else this.dragAudio(id, orig, handle, dx, key, pts);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (kind === 'clip' && moved && !handle) this.dropClip(id, orig, (ev.clientX - x0) / this.pps);
        this.insert.style.display = 'none';
        if (!moved && kind !== 'clip') {
          const o = (kind === 'text' ? this.store.project.texts : this.store.project.audio).find((x) => x.id === id);
          if (o && (this.player.t < o.start || this.player.t > o.start + (o.dur || audioLength(o)))) this.player.seek(o.start + 0.01);
        }
        if (!moved && kind === 'clip') {
          const L = layoutClips(this.store.project).find((x) => x.clip.id === id);
          if (L && (this.player.t < L.start || this.player.t >= L.end)) this.player.seek(L.start + Math.min(0.5, L.len / 2));
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  dragClip(id, o, handle, dx, key, ev) {
    if (!handle) {
      // نقل: نحرك العنصر بصرياً ونعرض مكان الإدراج
      const el = this.inner.querySelector(`.tl-item.clip[data-id="${id}"]`);
      if (el) { el.style.transform = `translateX(${dx * this.pps}px)`; el.classList.add('dragging'); }
      const idx = this.dropIndex(id, dx);
      const layout = layoutClips(this.store.project).filter((L) => L.clip.id !== id);
      const at = idx < layout.length ? layout[idx].start : (layout.length ? layout[layout.length - 1].end : 0);
      this.insert.style.display = 'block';
      this.insert.style.transform = `translateX(${this.x(at)}px)`;
      return;
    }
    const m = this.media.get(o.mediaId);
    this.store.update((p) => {
      const c = p.clips.find((x) => x.id === id);
      if (!c) return;
      const sp = c.speed || 1;
      if (c.type === 'video') {
        if (handle === 'l') c.in = clamp(o.in + dx * sp, 0, c.out - 0.2);
        else c.out = clamp(o.out + dx * sp, c.in + 0.2, m?.duration ?? o.out);
      } else {
        c.dur = Math.max(0.3, handle === 'l' ? o.dur - dx : o.dur + dx);
      }
    }, key);
  }

  dropIndex(id, dx) {
    const layout = layoutClips(this.store.project);
    const me = layout.find((L) => L.clip.id === id);
    const center = (me.start + me.end) / 2 + dx;
    const others = layout.filter((L) => L.clip.id !== id);
    return others.filter((L) => (L.start + L.end) / 2 < center).length;
  }

  dropClip(id, o, dx) {
    const idx = this.dropIndex(id, dx);
    const cur = this.store.project.clips.findIndex((c) => c.id === id);
    if (idx === cur) { this.render(); return; }
    this.store.update((p) => {
      const c = p.clips.splice(p.clips.findIndex((x) => x.id === id), 1)[0];
      p.clips.splice(idx, 0, c);
      fixTransitions(p);
    });
  }

  dragText(id, o, handle, dx, key, pts) {
    this.store.update((p) => {
      const t = p.texts.find((x) => x.id === id);
      if (!t) return;
      if (!handle) {
        let s = Math.max(0, o.start + dx);
        const s1 = this.snap(s, pts), s2 = this.snap(s + o.dur, pts) - o.dur;
        s = Math.abs(s1 - s) <= Math.abs(s2 - s) ? s1 : s2;
        t.start = Math.max(0, s);
      } else if (handle === 'l') {
        const end = o.start + o.dur;
        const s = clamp(this.snap(o.start + dx, pts), 0, end - 0.2);
        t.start = s; t.dur = end - s;
        if (t.words) t.words = null;
      } else {
        t.dur = Math.max(0.2, this.snap(o.start + o.dur + dx, pts) - o.start);
        if (t.words) t.words = null;
      }
    }, key);
  }

  dragAudio(id, o, handle, dx, key, pts) {
    const m = this.media.get(o.mediaId);
    this.store.update((p) => {
      const a = p.audio.find((x) => x.id === id);
      if (!a) return;
      if (!handle) {
        a.start = Math.max(0, this.snap(o.start + dx, pts));
      } else if (handle === 'l') {
        if (a.loop) {
          const end = o.start + o.dur;
          a.start = clamp(this.snap(o.start + dx, pts), 0, end - 0.3);
          a.dur = end - a.start;
        } else {
          const d = clamp(dx, -Math.min(o.in, o.start), o.out - o.in - 0.3);
          a.in = o.in + d; a.start = o.start + d;
        }
      } else if (a.loop) {
        a.dur = Math.max(0.3, this.snap(o.start + o.dur + dx, pts) - o.start);
      } else {
        const end = this.snap(o.start + (o.out - o.in) + dx, pts);
        a.out = clamp(o.in + (end - o.start), o.in + 0.3, m?.duration ?? o.out);
      }
    }, key);
  }
}

export function fixTransitions(p) {
  p.clips.forEach((c, i) => {
    if (i === 0) {
      if (c.transition && c.transition.type !== 'none') c._prevTr = c.transition;
      c.transition = { type: 'none', dur: 0 };
      c._first = true;
    } else if (c._first || !c.transition) {
      c.transition = c._prevTr || { ...(p.defaultTr || { type: 'fade', dur: 0.6 }) };
      delete c._first; delete c._prevTr;
    }
  });
}
