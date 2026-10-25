// نقطة البداية: ربط الواجهة بالمحرك
import { ASPECTS, layoutClips, projectDuration, fmtTime, uid, clipLength, newProject, dims } from './model.js';
import { MediaLibrary } from './media.js';
import { Store } from './store.js';
import { Player } from './player.js';
import { Timeline, fixTransitions } from './timeline.js';
import { Panels } from './panels.js';
import { h, toast } from './dom.js';
import { exportCapabilities, exportBrowser, exportRecorder, exportPro, serverHealth } from './export.js';
import { loadFonts } from './textfx.js';
import { Assistant } from './assistant.js';

const $ = (s) => document.querySelector(s);

class App {
  async init() {
    this.media = new MediaLibrary();
    this.store = new Store();
    this.player = new Player($('#preview'), this.media, () => this.store.project);
    this.timeline = new Timeline($('#timeline'), this.store, this.player, this.media);
    this.panels = new Panels(this);
    this.server = null;
    this.assistant = new Assistant(this);

    this.bindTop();
    this.bindTransport();
    this.bindFiles();
    this.bindKeys();
    this.bindMobile();

    await Promise.all([this.media.load(), this.store.load()]);
    this.store.on((reason) => this.onChange(reason));
    this.onChange('load');
    this.panels.show('media');
    this.timeline.fit();
    new ResizeObserver(() => this.player.resize()).observe($('#previewWrap'));
    this.player.resize();
    document.fonts?.ready.then(() => this.player.invalidate());

    serverHealth().then((s) => {
      this.server = s;
      if (s) { toast('متصل بالخادم المحلي ✓ التصدير الاحترافي جاهز'); this.panels.renderTab(); }
    });
    if (!this.media.list().length) setTimeout(() => toast('أهلاً! ابدأ برفع صورك ومقاطعك من «الوسائط»', 4000), 600);
  }

  onChange(reason) {
    const p = this.store.project;
    this.player.gc(p);
    if (reason === 'load') { $('#projName').value = p.name; this.renderAspect(); this.player.resize(); }
    $('#timeTotal').textContent = fmtTime(projectDuration(p));
    $('#undoBtn').disabled = !this.store.past.length;
    $('#redoBtn').disabled = !this.store.future.length;
    loadFonts(p).then(() => this.player.invalidate());
    this.player.invalidate();
    if (this.player.t > projectDuration(p)) this.player.seek(projectDuration(p));
  }

  renderAspect() {
    const seg = $('#aspectSeg');
    seg.innerHTML = '';
    for (const [k, a] of Object.entries(ASPECTS)) {
      const r = a.w / a.h;
      const iw = r >= 1 ? 16 : Math.round(16 * r), ih = r >= 1 ? Math.round(16 / r) : 16;
      seg.append(h('button', {
        class: this.store.project.aspect === k ? 'on' : '', title: `${k} ${a.label}`,
        onclick: () => { this.store.update((p) => { p.aspect = k; }); this.renderAspect(); this.player.resize(); },
      }, h('i', { style: { width: iw + 'px', height: ih + 'px' } }), h('span', {}, k)));
    }
  }

  bindTop() {
    $('#projName').addEventListener('input', (e) => this.store.update((p) => { p.name = e.target.value || 'مشروع'; }, 'name'));
    $('#undoBtn').onclick = () => this.store.undo();
    $('#redoBtn').onclick = () => this.store.redo();
    $('#exportBtn').onclick = () => this.exportDialog();
    $('#menuBtn').onclick = () => this.menuDialog();
    $('#modalX').onclick = () => this.closeModal();
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !this._busy) this.closeModal(); });
  }

  bindTransport() {
    const pl = this.player;
    $('#playBtn').onclick = () => pl.toggle();
    $('#toStart').onclick = () => pl.seek(0);
    $('#stepBack').onclick = () => pl.seek(pl.t - 1 / this.store.project.fps);
    $('#stepFwd').onclick = () => pl.seek(pl.t + 1 / this.store.project.fps);
    $('#safeBtn').onclick = (e) => { pl.safeZones = !pl.safeZones; e.currentTarget.classList.toggle('on', pl.safeZones); pl.invalidate(); if (pl.safeZones && this.store.project.aspect !== '9:16') toast('مناطق الأمان تظهر بمقاس 9:16 فقط'); };
    $('#fullBtn').onclick = () => { const el = $('#previewWrap'); document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.(); };
    $('#preview').addEventListener('click', () => pl.toggle());
    pl.on((t, playing) => {
      $('#timeNow').textContent = fmtTime(t);
      document.body.classList.toggle('playing', playing);
    });
    $('#splitBtn').onclick = () => this.split();
    $('#dupBtn').onclick = () => this.duplicate();
    $('#delBtn').onclick = () => this.remove();
    $('#zoomIn').onclick = () => this.timeline.setZoom(this.timeline.pps * 1.4);
    $('#zoomOut').onclick = () => this.timeline.setZoom(this.timeline.pps / 1.4);
    $('#zoomFit').onclick = () => { this.timeline.autoFit = true; this.timeline.fit(); };
  }

  bindFiles() {
    const input = $('#fileInput');
    input.addEventListener('change', () => { this.importFiles([...input.files]); input.value = ''; });
    let depth = 0;
    window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; document.body.classList.add('dragover'); } });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragover'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      document.body.classList.remove('dragover');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) this.importFiles(files);
    });
  }

  async importFiles(files) {
    if (!files.length) return;
    const before = this.store.project.clips.length;
    const added = await this.media.import(files, (i, n, name) => toast(`جاري الاستيراد ${i}/${n}: ${name}`, 60000));
    const skipped = files.length - added.length;
    if (!added.length) return toast('ما قدرت أقرأ الملفات — جرّب صيغة أخرى (JPG, PNG, MP4, MP3, M4A, WAV)', 5000);
    // الصور والمقاطع تنضاف مباشرة للخط الزمني، والصوت نسأل عنه
    const visual = added.filter((m) => m.type !== 'audio');
    if (visual.length) this.panels.addAll(visual);
    const sounds = added.filter((m) => m.type === 'audio');
    if (sounds.length === 1) this.panels.askAudioRole(sounds[0]);
    toast(`تم استيراد ${added.length} ملف` + (skipped ? ` (تعذر ${skipped})` : ''));
    if (!before && visual.length) this.player.seek(0);
    this.panels.show('media');
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select') || !$('#modal').hidden) return;
      const pl = this.player;
      const k = e.key;
      const mod = e.ctrlKey || e.metaKey;
      if (k === ' ') { e.preventDefault(); pl.toggle(); }
      else if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.store.redo() : this.store.undo(); }
      else if (mod && k.toLowerCase() === 'y') { e.preventDefault(); this.store.redo(); }
      else if (k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault();
        const d = (e.shiftKey ? 1 : 1 / this.store.project.fps) * (k === 'ArrowRight' ? 1 : -1);
        pl.seek(pl.t + d);
      } else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.remove(); }
      else if (k.toLowerCase() === 's' && !mod) this.split();
      else if (k.toLowerCase() === 'd' && !mod) this.duplicate();
      else if (k === 'Home') pl.seek(0);
      else if (k === 'End') pl.seek(projectDuration(this.store.project));
      else if (k === 'Escape') this.store.select(null);
    });
  }

  bindMobile() {
    const panel = $('#panel'), insp = $('#inspector'), back = $('#sheetBackdrop');
    this.openSheet = (name) => {
      if (window.innerWidth > 900) return;
      const cur = this._sheet;
      panel.classList.remove('open'); insp.classList.remove('open');
      document.querySelectorAll('#mobileNav button').forEach((b) => b.classList.remove('active'));
      if (!name || cur === name) { this._sheet = null; back.classList.remove('show'); return; }
      this._sheet = name;
      if (name === 'inspector') insp.classList.add('open');
      else { this.panels.show(name); panel.classList.add('open'); }
      back.classList.add('show');
    };
    $('#mobileNav').addEventListener('click', (e) => { const b = e.target.closest('button[data-sheet]'); if (b) this.openSheet(b.dataset.sheet); });
    back.addEventListener('click', () => this.openSheet(null));
  }

  // ---------- عمليات التحرير ----------
  split() {
    const { store, player } = this;
    const t = player.t;
    const sel = store.sel;
    const p = store.project;
    if (sel?.kind === 'text' || sel?.kind === 'audio') {
      const list = sel.kind === 'text' ? p.texts : p.audio;
      const it = list.find((x) => x.id === sel.id);
      const len = sel.kind === 'text' ? it.dur : (it.loop ? it.dur : it.out - it.in);
      if (t <= it.start + 0.1 || t >= it.start + len - 0.1) return toast('ضع المؤشر داخل العنصر المحدد للقص');
      store.update((pp) => {
        const L = (sel.kind === 'text' ? pp.texts : pp.audio);
        const a = L.find((x) => x.id === sel.id);
        const b = JSON.parse(JSON.stringify(a));
        b.id = uid(sel.kind === 'text' ? 'txt' : 'aud');
        const cut = t - a.start;
        if (sel.kind === 'text') { b.start = t; b.dur = a.dur - cut; a.dur = cut; a.words = null; b.words = null; }
        else if (a.loop) { b.start = t; b.dur = a.dur - cut; a.dur = cut; }
        else { b.start = t; b.in = a.in + cut; a.out = a.in + cut; a.fadeOut = 0; b.fadeIn = 0; }
        L.push(b);
      });
      return toast('تم القص');
    }
    const layout = layoutClips(p);
    const L = layout.find((x) => t > x.start + 0.15 && t < x.end - 0.15 && (!sel || sel.kind !== 'clip' || x.clip.id === sel.id)) || layout.find((x) => t > x.start + 0.15 && t < x.end - 0.15);
    if (!L) return toast('ضع المؤشر داخل مشهد للقص');
    store.update((pp) => {
      const i = pp.clips.findIndex((c) => c.id === L.clip.id);
      const a = pp.clips[i];
      const b = JSON.parse(JSON.stringify(a));
      b.id = uid('clip');
      b.transition = { type: 'none', dur: 0 };
      const lt = t - L.start;
      if (a.type === 'video') { const cut = a.in + lt * (a.speed || 1); a.out = cut; b.in = cut; }
      else { b.dur = a.dur - lt; a.dur = lt; if (a.motion === 'auto') { a.motion = 'zoom-in'; b.motion = 'zoom-in'; } }
      pp.clips.splice(i + 1, 0, b);
    });
    toast('تم القص');
  }

  duplicate() {
    const { store } = this;
    const sel = store.sel;
    if (!sel) return toast('حدّد عنصراً أولاً');
    store.update((p) => {
      const list = sel.kind === 'clip' ? p.clips : sel.kind === 'text' ? p.texts : p.audio;
      const i = list.findIndex((x) => x.id === sel.id);
      const c = JSON.parse(JSON.stringify(list[i]));
      c.id = uid(sel.kind);
      if (sel.kind === 'clip') { list.splice(i + 1, 0, c); fixTransitions(p); if (!c.transition || c.transition.type === 'none') c.transition = { ...(p.defaultTr || { type: 'fade', dur: 0.6 }) }; }
      else { c.start += sel.kind === 'text' ? c.dur : (c.loop ? c.dur : c.out - c.in); list.push(c); }
      store.sel = { kind: sel.kind, id: c.id };
    });
    toast('تم التكرار');
  }

  remove() {
    const { store } = this;
    const sel = store.sel;
    if (!sel) return;
    store.update((p) => {
      if (sel.kind === 'clip') { p.clips = p.clips.filter((c) => c.id !== sel.id); fixTransitions(p); }
      if (sel.kind === 'text') p.texts = p.texts.filter((c) => c.id !== sel.id);
      if (sel.kind === 'audio') p.audio = p.audio.filter((c) => c.id !== sel.id);
    });
    store.select(null);
  }

  // ---------- النوافذ ----------
  openModal(content) {
    $('#modalBody').innerHTML = '';
    $('#modalBody').append(content);
    $('#modal').hidden = false;
  }
  closeModal() {
    if (this._busy) return;
    $('#modal').hidden = true;
    $('#modalBody').innerHTML = '';
    if (this._resultURL) { URL.revokeObjectURL(this._resultURL); this._resultURL = null; }
  }

  menuDialog() {
    const local = h('div', { class: 'callout' + (this.server ? ' ok' : '') },
      this.server ? [h('b', {}, '✓ متصل بالخادم المحلي. '), `ffmpeg جاهز${this.server.whisper ? '، وWhisper جاهز للكابشن التلقائي' : '، وWhisper غير مثبت (اختياري)'}.`]
        : [h('b', {}, 'التصدير الاحترافي والكابشن التلقائي: '), 'شغّل الخادم المحلي على جهازك ثم افتح الرابط اللي يطبعه. التعليمات في ملف ', h('b', {}, 'app/local/README.md'), ' بالمستودع.']);
    this.openModal(h('div', {},
      h('h2', {}, 'المشروع'),
      h('p', { class: 'sub' }, 'كل شي محفوظ تلقائياً في متصفحك.'),
      h('div', { class: 'menu-list' },
        h('button', { class: 'btn', onclick: () => { if (confirm('تبدأ مشروعاً جديداً؟ المشروع الحالي ينمسح (ملفاتك تبقى في المكتبة).')) { this.store.replace(newProject()); this.player.seek(0); this.closeModal(); this.timeline.fit(); } } }, '✨ مشروع جديد'),
        h('button', { class: 'btn', onclick: () => this.saveProjectFile() }, '💾 حفظ ملف المشروع (بدون الوسائط)'),
        h('button', { class: 'btn', onclick: () => this.openProjectFile() }, '📂 فتح ملف مشروع'),
        h('button', { class: 'btn', onclick: async () => { if (confirm('تمسح كل الملفات من مكتبة المتصفح؟')) { this.store.replace(newProject()); await this.media.clear(); this.closeModal(); } } }, '🧹 مسح المكتبة والمشروع')),
      h('hr', { class: 'sep' }), local));
  }

  saveProjectFile() {
    const p = this.store.project;
    const names = Object.fromEntries(this.media.list().map((m) => [m.id, m.name]));
    const blob = new Blob([JSON.stringify({ ...p, mediaNames: names }, null, 2)], { type: 'application/json' });
    download(blob, `${p.name || 'montage'}.montage.json`);
  }

  openProjectFile() {
    const inp = $('#projInput');
    inp.onchange = async () => {
      const f = inp.files[0];
      inp.value = '';
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        if (j.version !== 1 || !Array.isArray(j.clips)) throw new Error();
        // نربط الملفات بالاسم إن اختلفت المعرفات
        const byName = new Map(this.media.list().map((m) => [m.name, m.id]));
        const map = (id) => (this.media.get(id) ? id : byName.get(j.mediaNames?.[id]) || id);
        j.clips.forEach((c) => { c.mediaId = map(c.mediaId); });
        j.audio.forEach((a) => { a.mediaId = map(a.mediaId); });
        delete j.mediaNames;
        const missing = [...j.clips, ...j.audio].filter((x) => !this.media.get(x.mediaId)).length;
        this.store.replace({ ...newProject(), ...j });
        this.closeModal();
        this.timeline.fit();
        toast(missing ? `فُتح المشروع — ${missing} عنصر يحتاج رفع ملفاته بنفس الأسماء` : 'فُتح المشروع ✓', 5000);
      } catch { toast('الملف غير صالح'); }
    };
    inp.click();
  }

  async exportDialog() {
    const p = this.store.project;
    const dur = projectDuration(p);
    if (!p.clips.length || dur <= 0) return toast('أضف مشاهد أولاً');
    const missing = [...p.clips, ...p.audio].filter((x) => !this.media.get(x.mediaId));
    if (missing.length) return toast('فيه عناصر ملفاتها مفقودة — احذفها أو ارفع ملفاتها');
    this.player.pause();
    const caps = await exportCapabilities();
    const methods = {
      browser: { ok: caps.webcodecs && !!caps.audio, name: 'من المتصفح', desc: 'MP4 بدقة الفريم وأسرع من الزمن الحقيقي — مجاني على أي جهاز' },
      pro: { ok: !!this.server, name: 'احترافي (جهازك)', desc: this.server ? 'ffmpeg بأعلى جودة + صوت مضبوط على -14 LUFS' : 'يحتاج تشغيل الخادم المحلي على جهازك' },
      record: { ok: !!window.MediaRecorder, name: 'تسجيل مباشر', desc: 'احتياطي للمتصفحات القديمة — يأخذ نفس مدة الفيديو' },
    };
    const st = {
      method: this.server ? 'pro' : methods.browser.ok ? 'browser' : 'record',
      res: '1', fps: String(p.fps || 30), quality: 'high',
    };
    const { w, h: hh } = dims(p);
    const opt = (group, key, title, desc, ok = true) => {
      const b = h('button', { class: 'opt' + (st[group] === key ? ' on' : ''), disabled: !ok, onclick: () => { st[group] = key; b.parentElement.querySelectorAll('.opt').forEach((x) => x.classList.remove('on')); b.classList.add('on'); } }, h('b', {}, title), h('small', {}, desc));
      return b;
    };
    const go = h('button', { class: 'btn primary block', onclick: () => this.runExport(st) }, 'ابدأ التصدير');
    this.openModal(h('div', {},
      h('h2', {}, 'تصدير الفيديو'),
      h('p', { class: 'sub' }, `${p.aspect} · ${fmtTime(dur)} · ${p.clips.length} مشهد · ${p.texts.length} نص`),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'الطريقة'), h('div', { class: 'opt-grid' }, Object.entries(methods).map(([k, m]) => opt('method', k, m.name, m.desc, m.ok)))),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'الدقة'), h('div', { class: 'opt-grid' },
        opt('res', '1', `كاملة ${w}×${hh}`, 'أفضل جودة للنشر'),
        opt('res', '0.6667', `متوسطة ${Math.round(w * 2 / 3)}×${Math.round(hh * 2 / 3)}`, 'أسرع وأصغر حجماً'))),
      h('div', { class: 'field' }, h('div', { class: 'lbl' }, 'عدد الفريمات'), h('div', { class: 'opt-grid' },
        opt('fps', '30', '30 فريم', 'المعتاد للريلز والدروس'),
        opt('fps', '60', '60 فريم', 'حركة أنعم — ضعف الوقت'))),
      go));
  }

  async runExport(st) {
    const p = JSON.parse(JSON.stringify(this.store.project));
    const scale = parseFloat(st.res);
    const fps = parseInt(st.fps, 10);
    const ctrl = new AbortController();
    const bar = h('i');
    const msg = h('span', {}, 'تجهيز…');
    const eta = h('span', {}, '');
    this._busy = true;
    $('#modalX').hidden = true;
    this.openModal(h('div', {},
      h('h2', {}, 'جاري التصدير'),
      h('p', { class: 'sub' }, 'خلّ الصفحة مفتوحة حتى ينتهي. ' + (st.method === 'record' ? 'هذه الطريقة تشغّل الفيديو كاملاً.' : '')),
      h('div', { class: 'progress' }, bar),
      h('div', { class: 'prog-line' }, msg, eta),
      h('button', { class: 'btn block', style: { marginTop: '18px' }, onclick: () => ctrl.abort() }, 'إلغاء')));
    const onProgress = (f, m, sec) => {
      bar.style.width = (f * 100).toFixed(1) + '%';
      if (m) msg.textContent = `${m} ${Math.round(f * 100)}%`;
      eta.textContent = sec != null && isFinite(sec) ? `متبقي ~${fmtTime(sec, false)}` : '';
    };
    const t0 = performance.now();
    let blob, savedTo = null;
    try {
      const opts = { scale, fps, onProgress, signal: ctrl.signal, quality: st.quality };
      if (st.method === 'pro') ({ blob, savedTo } = await exportPro(p, this.media, opts));
      else if (st.method === 'browser') blob = await exportBrowser(p, this.media, opts);
      else blob = await exportRecorder(p, this.media, opts);
    } catch (e) {
      this._busy = false;
      $('#modalX').hidden = false;
      if (e.message === 'ABORT') { this.closeModal(); return toast('أُلغي التصدير'); }
      console.error(e);
      const hint = e.message === 'NO_AUDIO_ENCODER' || e.message === 'NO_WEBCODECS'
        ? 'متصفحك ما يدعم الترميز السريع — جرّب «تسجيل مباشر» أو استخدم كروم/إيدج.' : e.message;
      this.openModal(h('div', {}, h('h2', {}, 'تعذر التصدير'), h('p', { class: 'sub' }, hint),
        h('button', { class: 'btn block', onclick: () => this.exportDialog() }, 'رجوع')));
      return;
    }
    this._busy = false;
    $('#modalX').hidden = false;
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    const name = `${(p.name || 'montage').replace(/[\\/:*?"<>|]/g, '')}-${p.aspect.replace(':', 'x')}.${ext}`;
    const url = URL.createObjectURL(blob);
    this._resultURL = url;
    const file = new File([blob], name, { type: blob.type });
    const canShare = navigator.canShare?.({ files: [file] });
    const took = (performance.now() - t0) / 1000;
    this.openModal(h('div', {},
      h('h2', {}, 'جاهز ✓'),
      h('p', { class: 'sub' }, `${name} · ${(blob.size / 1048576).toFixed(1)} م.ب · خلال ${fmtTime(took, false)}` + (savedTo ? ` · محفوظ في ${savedTo}` : '')),
      h('video', { class: 'result-video', src: url, controls: true, playsinline: true }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: () => download(blob, name) }, 'تحميل الفيديو'),
        canShare ? h('button', { class: 'btn', onclick: () => navigator.share({ files: [file], title: p.name }).catch(() => {}) }, 'مشاركة') : null)));
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

const app = new App();
window.montage = app;
app.init().catch((e) => { console.error(e); toast('حدث خطأ أثناء التشغيل: ' + e.message, 8000); });
