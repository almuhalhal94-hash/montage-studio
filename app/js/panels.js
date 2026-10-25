// اللوحات الجانبية ولوحة الخصائص
import { h, rangeField, selectField, textField, colorField, toggleField, pillsField, toast, fmtSec, fmtPct } from './dom.js';
import { newClip, newText, newAudio, TEXT_PRESETS, STYLES, applyStyle, layoutClips, projectDuration, audioLength, clipLength, fmtTime, clamp } from './model.js';
import { TRANSITIONS, MOTIONS, FITS, FILTERS } from './renderer.js';
import { TEXT_ANIMS, TEXT_BOXES, TEXT_DECOS, FONTS } from './textfx.js';
import { fixTransitions } from './timeline.js';
import { captionsFromText, captionsFromWords } from './captions.js';
import { transcribe } from './export.js';

const I = {
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>',
  audio: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sel: '<path d="M4 4l7 17 2-7 7-2z"/>',
};
const svg = (p) => h('span', { html: `<svg viewBox="0 0 24 24">${p}</svg>`, style: { display: 'contents' } });

export class Panels {
  constructor(app) {
    this.app = app;
    this.tab = 'media';
    this.body = document.getElementById('tabBody');
    this.insp = document.getElementById('inspector');
    this._self = false;
    const { store, media } = app;
    store.on((reason) => {
      if (reason === 'select' || reason === 'load') { this.renderInspector(); this.renderTab(); return; }
      if (this._self) { this._self = false; return; }
      this.renderInspector();
      if (['trans', 'audio', 'media'].includes(this.tab)) this.renderTab();
    });
    media.onChange(() => this.tab === 'media' && this.renderTab());
    document.getElementById('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (b) this.show(b.dataset.tab);
    });
  }

  upd(fn, key) { this._self = true; this.app.store.update(fn, key); }

  show(tab) {
    this.tab = tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    this.renderTab();
  }

  renderTab() {
    const scroll = this.body.scrollTop;
    this.body.innerHTML = '';
    const fn = { media: this.mediaTab, text: this.textTab, trans: this.transTab, audio: this.audioTab, style: this.styleTab }[this.tab];
    this.body.append(...[].concat(fn.call(this)).filter(Boolean));
    this.body.scrollTop = scroll;
  }

  // ---------- الوسائط ----------
  mediaTab() {
    const { media, store } = this.app;
    const list = media.list();
    const used = new Set([...store.project.clips.map((c) => c.mediaId), ...store.project.audio.map((a) => a.mediaId)]);
    const visual = list.filter((m) => m.type !== 'audio');
    const sounds = list.filter((m) => m.type === 'audio');
    const card = (m) => {
      const el = h('div', {
        class: 'mcard' + (m.type === 'audio' ? ' audio' : ''), title: m.name,
        style: m.thumb ? { backgroundImage: `url(${m.thumb})` } : {},
        onclick: () => this.addMedia(m),
      });
      if (m.type === 'audio') el.append(svg(I.audio), h('span', {}, m.name));
      if (m.type !== 'image') el.append(h('span', { class: 'badge' }, fmtTime(m.duration, false)));
      if (used.has(m.id)) el.append(h('i', { class: 'used', title: 'مستخدم في المشروع' }));
      el.append(h('button', {
        class: 'x', title: 'حذف من المكتبة', 'aria-label': 'حذف',
        onclick: (e) => { e.stopPropagation(); this.removeMedia(m); },
      }, svg(I.x)));
      return el;
    };
    return [
      h('div', { class: 'sec' },
        h('div', { class: 'dropzone', onclick: () => document.getElementById('fileInput').click() },
          svg(I.upload), h('b', {}, 'ارفع صوراً وفيديوهات وأصوات'), h('small', {}, 'اضغط للاختيار أو اسحب الملفات وأفلتها هنا'))),
      visual.length ? h('div', { class: 'sec' },
        h('h3', {}, h('span', { class: 'grow' }, `صور ومقاطع (${visual.length})`),
          h('button', { class: 'chip', onclick: () => this.addAll(visual.filter((m) => !used.has(m.id))) }, 'أضف غير المستخدم')),
        h('div', { class: 'media-grid' }, visual.map(card))) : null,
      sounds.length ? h('div', { class: 'sec' }, h('h3', {}, `ملفات صوتية (${sounds.length})`), h('div', { class: 'media-grid' }, sounds.map(card))) : null,
      !list.length ? h('p', { class: 'hint' }, 'كل ملفاتك تبقى على جهازك داخل المتصفح — لا يُرفع شي لأي خادم. ', h('br'), 'اضغط على أي ملف لإضافته للخط الزمني.') :
        h('p', { class: 'hint' }, 'اضغط على الملف لإضافته. الصور والمقاطع تنضاف بعد المشهد المحدد أو في النهاية.'),
    ];
  }

  addMedia(m) {
    const { store, player } = this.app;
    if (m.type === 'audio') return this.askAudioRole(m);
    const sel = store.sel?.kind === 'clip' ? store.project.clips.findIndex((c) => c.id === store.sel.id) : -1;
    const clip = newClip(m, store.project.clips.length);
    if (store.project.defaultTr && store.project.clips.length) clip.transition = { ...store.project.defaultTr };
    if (store.project.defaultImageDur && m.type === 'image') clip.dur = store.project.defaultImageDur;
    if (store.project.defaultFilter) clip.filter = store.project.defaultFilter;
    this.upd((p) => {
      if (sel >= 0) p.clips.splice(sel + 1, 0, clip); else p.clips.push(clip);
      fixTransitions(p);
    });
    store.select('clip', clip.id);
    const L = layoutClips(store.project).find((x) => x.clip.id === clip.id);
    if (L) player.seek(L.start + 0.05);
    this.app.timeline.autoFit && this.app.timeline.fit();
    toast('أُضيف للخط الزمني');
  }

  addAll(items) {
    if (!items.length) return toast('كل الملفات مستخدمة');
    const { store } = this.app;
    this.upd((p) => {
      for (const m of items) {
        const c = newClip(m, p.clips.length);
        if (p.defaultTr && p.clips.length) c.transition = { ...p.defaultTr };
        if (p.defaultImageDur && m.type === 'image') c.dur = p.defaultImageDur;
        if (p.defaultFilter) c.filter = p.defaultFilter;
        p.clips.push(c);
      }
      fixTransitions(p);
    });
    this.app.timeline.fit();
    store.emit('change');
    toast(`أُضيف ${items.length} ملف`);
  }

  askAudioRole(m) {
    const { store, player } = this.app;
    const add = (role) => {
      this.app.closeModal();
      const a = newAudio(m, role, role === 'bg' ? 0 : player.t);
      const total = projectDuration(store.project);
      if (role === 'bg' && total > 0) {
        if (m.duration < total) { a.loop = true; a.dur = total; }
        else { a.out = Math.min(m.duration, total); }
      }
      this.upd((p) => p.audio.push(a));
      store.select('audio', a.id);
      toast(role === 'bg' ? 'أُضيفت الخلفية الصوتية' : 'أُضيف التعليق الصوتي');
    };
    this.app.openModal(h('div', {},
      h('h2', {}, 'وين أضيف هالصوت؟'),
      h('p', { class: 'sub' }, m.name),
      h('div', { class: 'opt-grid' },
        h('button', { class: 'opt', onclick: () => add('voice') }, h('b', {}, '🎙️ تعليق صوتي'), h('small', {}, 'كلامك أو شرحك — يبدأ عند المؤشر، والخلفية تنخفض تلقائياً تحته')),
        h('button', { class: 'opt', onclick: () => add('bg') }, h('b', {}, '🎧 خلفية صوتية'), h('small', {}, 'نشيد بدون إيقاع أو أذكار — يمتد على كامل الفيديو بهدوء'))),
    ));
  }

  async removeMedia(m) {
    const { store, media } = this.app;
    const usedBy = store.project.clips.filter((c) => c.mediaId === m.id).length + store.project.audio.filter((a) => a.mediaId === m.id).length;
    if (usedBy && !confirm(`هذا الملف مستخدم ${usedBy} مرة في المشروع. حذفه يشيله من الخط الزمني كذلك. متأكد؟`)) return;
    this.upd((p) => {
      p.clips = p.clips.filter((c) => c.mediaId !== m.id);
      p.audio = p.audio.filter((a) => a.mediaId !== m.id);
      fixTransitions(p);
    });
    store.fixSel();
    await media.remove(m.id);
    store.emit('change');
  }

  // ---------- النصوص ----------
  textTab() {
    const { store, player, server } = this.app;
    const presets = h('div', { class: 'preset-grid' }, Object.entries(TEXT_PRESETS).map(([k, p]) =>
      h('button', { class: 'preset', onclick: () => this.addText(k) },
        h('span', { class: 'pv', style: { fontFamily: `"${p.font}"`, fontWeight: p.weight, color: p.box === 'pill' ? p.accent : p.color } }, p.label),
        h('small', {}, TEXT_ANIMS[p.anim]))));

    // كابشن من نص
    const voices = store.project.audio.filter((a) => a.role === 'voice');
    const ranges = { all: 'على كامل الفيديو', here: 'من المؤشر إلى النهاية' };
    voices.forEach((v, i) => { ranges[v.id] = `على التعليق الصوتي ${i + 1}`; });
    const st = { text: '', per: '4', range: voices[0]?.id || 'all', style: 'caption' };
    const ta = textField({ label: 'اكتب أو الصق الكلام', multiline: true, placeholder: 'كل جملة تتوزع تلقائياً على الوقت…', value: '', onInput: (v) => { st.text = v; } });
    const gen = () => {
      if (!st.text.trim()) return toast('اكتب النص أولاً');
      const total = projectDuration(store.project);
      let start = 0, end = total;
      if (st.range === 'here') start = player.t;
      else if (st.range !== 'all') { const v = voices.find((x) => x.id === st.range); start = v.start; end = v.start + audioLength(v); }
      if (end - start < 0.5) return toast('المدة قصيرة — أضف مشاهد أو صوتاً أولاً');
      const items = captionsFromText(st.text, { start, end, perLine: +st.per, preset: st.style });
      this.upd((p) => p.texts.push(...items));
      store.emit('change');
      toast(`أُضيف ${items.length} سطر كابشن`);
    };
    const manual = h('div', { class: 'sec' },
      h('h3', {}, 'كابشن من نص مكتوب'),
      ta,
      h('div', { class: 'row' },
        selectField({ label: 'كلمات بالسطر', options: { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 8: '8' }, value: st.per, onChange: (v) => { st.per = v; } }),
        selectField({ label: 'الشكل', options: { caption: 'كاريوكي', highlight: 'تلوين الكلمة', pill: 'بخلفية', subtitle: 'هادئ' }, value: st.style, onChange: (v) => { st.style = v; } })),
      selectField({ label: 'التوزيع', options: ranges, value: st.range, onChange: (v) => { st.range = v; } }),
      h('button', { class: 'btn block', onclick: gen }, 'وزّع الكابشن على الوقت'));

    // كابشن تلقائي
    const sources = [];
    voices.forEach((v, i) => sources.push({ key: v.id, label: `التعليق الصوتي ${i + 1}`, kind: 'audio', obj: v }));
    layoutClips(store.project).forEach((L, i) => {
      if (L.clip.type === 'video' && !L.clip.muted && this.app.media.get(L.clip.mediaId)?.hasAudio) sources.push({ key: L.clip.id, label: `صوت المشهد ${i + 1}`, kind: 'clip', obj: L.clip, L });
    });
    let auto;
    if (server?.whisper) {
      const st2 = { src: sources[0]?.key, per: '4', style: 'caption' };
      auto = h('div', { class: 'sec' },
        h('h3', {}, '✨ كابشن تلقائي بتوقيت الكلمة'),
        sources.length ? [
          selectField({ label: 'من أي صوت؟', options: Object.fromEntries(sources.map((s) => [s.key, s.label])), value: st2.src, onChange: (v) => { st2.src = v; } }),
          h('div', { class: 'row' },
            selectField({ label: 'كلمات بالسطر', options: { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }, value: st2.per, onChange: (v) => { st2.per = v; } }),
            selectField({ label: 'الشكل', options: { caption: 'كاريوكي', highlight: 'تلوين الكلمة', pill: 'بخلفية', subtitle: 'هادئ' }, value: st2.style, onChange: (v) => { st2.style = v; } })),
          h('button', { class: 'btn primary block', onclick: (e) => this.autoCaptions(sources.find((s) => s.key === st2.src), +st2.per, st2.style, e.currentTarget) }, 'فرّغ الكلام واصنع الكابشن'),
        ] : h('p', { class: 'hint' }, 'أضف تعليقاً صوتياً أو مقطعاً فيه كلام أولاً.'));
    } else {
      auto = h('div', { class: 'sec' }, h('h3', {}, '✨ كابشن تلقائي بتوقيت الكلمة'),
        h('div', { class: 'callout' }, 'يحتاج ', h('b', {}, 'الخادم المحلي'), ' على جهازك مع Whisper المجاني — يفرّغ كلامك العربي ويضبط توقيت كل كلمة. التعليمات في قائمة المشروع ← «التصدير الاحترافي».'));
    }
    return [h('div', { class: 'sec' }, h('h3', {}, 'أضف نصاً متحركاً'), presets), auto, manual];
  }

  addText(key) {
    const { store, player } = this.app;
    const t = newText(key, player.t);
    const total = projectDuration(store.project);
    if (total > 0 && t.start + t.dur > total) t.start = Math.max(0, total - t.dur);
    this.upd((p) => p.texts.push(t));
    store.select('text', t.id);
    player.seek(t.start + Math.min(1.2, t.dur / 2));
    this.app.openSheet?.('inspector');
  }

  async autoCaptions(src, per, style, btn) {
    if (!src) return;
    const { media, store } = this.app;
    const mediaId = src.obj.mediaId;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'جاري التفريغ… (قد ياخذ دقيقة)';
    try {
      const res = await transcribe(media.blob(mediaId), media.get(mediaId)?.name);
      let offset, from, to, rate = 1;
      if (src.kind === 'audio') { offset = src.obj.start - src.obj.in; from = src.obj.in; to = src.obj.in + audioLength(src.obj); }
      else { rate = src.obj.speed || 1; offset = src.L.start; from = src.obj.in; to = src.obj.out; }
      const words = res.words.filter((w) => w.s >= from - 0.05 && w.e <= to + 0.05)
        .map((w) => ({ w: w.w, s: offset + (src.kind === 'clip' ? (w.s - from) / rate : w.s), e: offset + (src.kind === 'clip' ? (w.e - from) / rate : w.e) }));
      if (!words.length) throw new Error('ما لقيت كلام واضح في هذا الصوت');
      const items = captionsFromWords(words, { perLine: per, preset: style });
      this.upd((p) => p.texts.push(...items));
      store.emit('change');
      toast(`تم ✓ ${items.length} سطر بتوقيت الكلمة`);
    } catch (e) {
      toast('تعذر التفريغ: ' + e.message, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // ---------- الانتقالات ----------
  transTab() {
    const { store } = this.app;
    const p = store.project;
    const selClip = store.sel?.kind === 'clip' ? p.clips.find((c) => c.id === store.sel.id) : null;
    const selIdx = selClip ? p.clips.indexOf(selClip) : -1;
    const target = selIdx > 0 ? 'one' : 'all';
    const cur = target === 'one' ? selClip.transition : (p.defaultTr || p.clips[1]?.transition || { type: 'fade', dur: 0.6 });
    const apply = (patch) => {
      this.upd((pp) => {
        if (target === 'one') { const c = pp.clips.find((x) => x.id === selClip.id); c.transition = { ...c.transition, ...patch }; }
        else {
          pp.defaultTr = { ...(pp.defaultTr || { type: 'fade', dur: 0.6 }), ...patch };
          pp.clips.forEach((c, i) => { if (i > 0) c.transition = { ...c.transition, ...patch }; });
        }
      }, 'trdur');
      if (patch.type) this.renderTab();
    };
    const demoAnim = (k) => (k.startsWith('push') ? 't-slide-r' : `t-${k}`);
    return [
      h('div', { class: 'callout' + (target === 'one' ? ' ok' : '') }, target === 'one'
        ? [h('b', {}, `الانتقال الداخل للمشهد ${selIdx + 1}`), ' — اختر مشهداً آخر أو ألغِ التحديد للتطبيق على الكل.']
        : [h('b', {}, 'يطبّق على كل المشاهد'), ' — حدّد مشهداً من الخط الزمني لتغيير انتقاله وحده.']),
      h('div', { class: 'sec', style: { marginTop: '14px' } },
        rangeField({ label: 'مدة الانتقال', min: 0.2, max: 2, step: 0.1, value: cur.dur || 0.6, fmt: fmtSec, onInput: (v) => apply({ dur: v }) }),
        h('div', { class: 'trans-grid' }, Object.entries(TRANSITIONS).map(([k, label]) =>
          h('button', { class: 'tcard' + (cur.type === k ? ' on' : ''), onclick: () => apply({ type: k, dur: k === 'none' ? 0 : (cur.dur || 0.6) }) },
            h('div', { class: 'demo', style: { '--anim': demoAnim(k) } }), label)))),
      h('button', { class: 'btn block', onclick: () => this.varied() }, '🎲 انتقالات متنوعة لكل المشاهد'),
    ];
  }

  varied() {
    const pool = ['fade', 'zoom', 'slide-l', 'wipe-l', 'blur', 'circle', 'push-r', 'black'];
    this.upd((p) => p.clips.forEach((c, i) => { if (i > 0) c.transition = { type: pool[(i - 1) % pool.length], dur: c.transition?.dur || 0.6 }; }));
    this.renderTab();
    toast('تم توزيع انتقالات متنوعة');
  }

  // ---------- الصوت ----------
  audioTab() {
    const { store, media } = this.app;
    const p = store.project;
    const s = p.settings;
    const set = (k) => (v) => this.upd((pp) => { pp.settings[k] = v; }, 'set:' + k);
    const items = p.audio.map((a) => {
      const m = media.get(a.mediaId);
      return h('button', {
        class: 'btn block ghost', style: { justifyContent: 'flex-start', marginBottom: '6px', borderColor: store.sel?.id === a.id ? 'var(--accent)' : '' },
        onclick: () => { store.select('audio', a.id); this.app.player.seek(a.start); },
      }, a.role === 'bg' ? '🎧' : '🎙️', h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, m?.name || 'ملف مفقود'), h('small', { style: { marginInlineStart: 'auto', color: 'var(--dim)' } }, fmtTime(audioLength(a), false)));
    });
    return [
      h('div', { class: 'sec' },
        h('button', { class: 'btn block', onclick: () => document.getElementById('fileInput').click() }, svg(I.upload), 'ارفع ملفاً صوتياً'),
        h('p', { class: 'hint' }, 'الخلفية الصوتية: نشيد بدون إيقاع أو أذكار بصوت هادئ.')),
      items.length ? h('div', { class: 'sec' }, h('h3', {}, 'الأصوات في المشروع'), items) : null,
      h('div', { class: 'sec' }, h('h3', {}, 'الميكس'),
        toggleField({ label: 'خفض الخلفية وقت الكلام', hint: 'تنخفض تلقائياً تحت التعليق الصوتي', checked: s.ducking, onChange: (v) => { set('ducking')(v); this.renderTab(); } }),
        s.ducking ? rangeField({ label: 'مستوى الخلفية أثناء الكلام', min: 0, max: 0.6, step: 0.02, value: s.duckLevel, fmt: fmtPct, onInput: set('duckLevel') }) : null,
        s.ducking ? toggleField({ label: 'اعتبر صوت المقاطع كلاماً', hint: 'تنخفض الخلفية تحت صوت الفيديوهات أيضاً', checked: s.duckClipAudio, onChange: set('duckClipAudio') }) : null,
        toggleField({ label: 'صوت انتقال ناعم', hint: 'نفَس هواء خفيف عند كل انتقال (بدون إيقاع)', checked: s.whoosh, onChange: set('whoosh') }),
        toggleField({ label: 'توحيد مستوى الصوت', hint: 'يرفع الصوت الضعيف ويمنع التشويش عند التصدير', checked: s.normalize, onChange: set('normalize') })),
    ];
  }

  // ---------- القوالب ----------
  styleTab() {
    const { store } = this.app;
    const p = store.project;
    const apply = (k) => {
      this.upd((pp) => applyStyle(pp, k));
      this.renderTab();
      toast(`طُبّق قالب «${STYLES[k].name}»`);
    };
    const bg = p.audio.find((a) => a.role === 'bg');
    const fitToAudio = () => {
      const target = audioLength(bg) + bg.start;
      this.upd((pp) => {
        const imgs = pp.clips.filter((c) => c.type === 'image');
        const fixed = pp.clips.filter((c) => c.type !== 'image').reduce((s, c) => s + clipLength(c), 0);
        const trs = layoutClips(pp).reduce((s, L) => s + L.tr, 0);
        if (!imgs.length) return;
        const each = clamp((target - fixed + trs) / imgs.length, 0.6, 30);
        imgs.forEach((c) => { c.dur = +each.toFixed(2); });
      });
      this.app.timeline.fit();
      toast('تمت مطابقة مدة الصور مع الخلفية الصوتية');
    };
    return [
      h('div', { class: 'sec' }, h('h3', {}, 'قالب المونتاج (يطبّق على كل المشاهد)'),
        h('div', { class: 'preset-grid' }, Object.entries(STYLES).map(([k, S]) =>
          h('button', { class: 'preset' + (p.styleKey === k ? ' on' : ''), onclick: () => apply(k) }, h('b', {}, S.name), h('small', {}, S.desc))))),
      h('div', { class: 'sec' }, h('h3', {}, 'مونتاج تلقائي'),
        bg ? h('button', { class: 'btn block', onclick: fitToAudio }, '⏱️ طابق مدة الصور مع الخلفية الصوتية')
          : h('p', { class: 'hint' }, 'أضف خلفية صوتية، وأوزّع مدة الصور عليها تلقائياً.')),
      h('div', { class: 'sec' }, h('h3', {}, 'إعدادات المشروع'),
        colorField({ label: 'لون الخلفية', value: p.bg, swatches: ['#000000', '#ffffff', '#0d1b2a', '#1f3b2d', '#2b1d0e', '#f5efe0'], onChange: (v) => this.upd((pp) => { pp.bg = v; }, 'bg') }),
        toggleField({ label: 'إطار داكن ناعم (فينيت)', checked: p.vignette, onChange: (v) => this.upd((pp) => { pp.vignette = v; }) })),
    ];
  }

  // ---------- الخصائص ----------
  renderInspector() {
    const { store } = this.app;
    const it = store.selected();
    const scroll = this.insp.scrollTop;
    this.insp.innerHTML = '';
    if (!it) this.insp.append(this.projectInfo());
    else if (store.sel.kind === 'clip') this.insp.append(...this.clipInsp(it).filter(Boolean));
    else if (store.sel.kind === 'text') this.insp.append(...this.textInsp(it).filter(Boolean));
    else this.insp.append(...this.audioInsp(it).filter(Boolean));
    this.insp.scrollTop = scroll;
    document.querySelector('#mobileNav [data-sheet="inspector"]')?.classList.toggle('on', !!it);
  }

  projectInfo() {
    const p = this.app.store.project;
    const dur = projectDuration(p);
    return h('div', { class: 'empty-insp' },
      svg(I.sel),
      h('div', {}, h('b', {}, p.name)),
      h('div', {}, `${p.clips.length} مشهد · ${p.texts.length} نص · ${p.audio.length} صوت`),
      h('div', {}, `المدة ${fmtTime(dur)}`),
      h('hr', { class: 'sep' }),
      h('div', { class: 'hint', style: { textAlign: 'start' } },
        h('b', {}, 'اختصارات: '), h('br'),
        'مسافة: تشغيل/إيقاف', h('br'), 'S: قص عند المؤشر', h('br'), 'D: تكرار', h('br'), 'Delete: حذف', h('br'), '← →: فريم · Shift: ثانية', h('br'), 'Ctrl+Z: تراجع'));
  }

  title(thumb, name, sub) {
    return h('div', { class: 'insp-title' }, h('div', { class: 'thumb', style: thumb ? { backgroundImage: `url(${thumb})` } : {} }), h('div', {}, h('b', {}, name), h('small', {}, sub)));
  }

  clipInsp(c) {
    const { media, store } = this.app;
    const m = media.get(c.mediaId);
    const idx = store.project.clips.indexOf(c);
    const set = (k, key) => (v) => this.upd((p) => { const x = p.clips.find((y) => y.id === c.id); if (x) x[k] = v; }, key || `c:${c.id}:${k}`);
    const els = [this.title(m?.thumb, `المشهد ${idx + 1}`, m ? `${m.type === 'video' ? 'فيديو' : 'صورة'} · ${m.name}` : 'ملف مفقود')];
    if (c.type === 'video') {
      const md = m?.duration || c.out;
      els.push(
        rangeField({ label: 'البداية من المقطع', min: 0, max: md, step: 0.05, value: c.in, fmt: fmtSec, onInput: (v) => { set('in')(Math.min(v, c.out - 0.2)); this.app.player.seek(layoutClips(store.project)[idx].start); } }),
        rangeField({ label: 'النهاية', min: 0, max: md, step: 0.05, value: c.out, fmt: fmtSec, onInput: (v) => set('out')(Math.max(v, c.in + 0.2)) }),
        pillsField({ label: 'السرعة', options: { 0.5: '0.5×', 0.75: '0.75×', 1: '1×', 1.5: '1.5×', 2: '2×' }, value: c.speed, onChange: (v) => set('speed')(+v) }),
        rangeField({ label: 'صوت المقطع', min: 0, max: 2, step: 0.05, value: c.volume, fmt: fmtPct, onInput: set('volume') }),
        toggleField({ label: 'كتم صوت المقطع', checked: c.muted, onChange: set('muted') }));
    } else {
      els.push(rangeField({ label: 'مدة الصورة', min: 0.5, max: 15, step: 0.1, value: c.dur, fmt: fmtSec, onInput: set('dur') }));
    }
    els.push(
      pillsField({ label: 'الملاءمة', options: FITS, value: c.fit, onChange: set('fit') }),
      selectField({ label: 'الحركة', options: MOTIONS, value: c.motion, onChange: set('motion') }),
      rangeField({ label: 'تكبير', min: 1, max: 2, step: 0.01, value: c.zoom || 1, fmt: fmtPct, onInput: set('zoom') }),
      pillsField({ label: 'الفلتر', options: Object.fromEntries(Object.entries(FILTERS).map(([k, v]) => [k, v.label])), value: c.filter, onChange: set('filter') }));
    if (idx > 0) {
      els.push(h('hr', { class: 'sep' }),
        selectField({ label: 'الانتقال الداخل لهذا المشهد', options: TRANSITIONS, value: c.transition?.type || 'none', onChange: (v) => this.upd((p) => { const x = p.clips.find((y) => y.id === c.id); x.transition = { type: v, dur: v === 'none' ? 0 : (x.transition?.dur || 0.6) }; this.renderInspector(); }) }),
        c.transition?.type !== 'none' ? rangeField({ label: 'مدة الانتقال', min: 0.2, max: 2, step: 0.1, value: c.transition?.dur || 0.6, fmt: fmtSec, onInput: (v) => this.upd((p) => { const x = p.clips.find((y) => y.id === c.id); x.transition = { ...x.transition, dur: v }; }, `c:${c.id}:trd`) }) : null);
    }
    els.push(h('hr', { class: 'sep' }), h('div', { class: 'btn-row' },
      h('button', { class: 'btn', disabled: idx >= store.project.clips.length - 1, onclick: () => this.moveClip(c.id, 1) }, '← بعده'),
      h('button', { class: 'btn', disabled: idx === 0, onclick: () => this.moveClip(c.id, -1) }, 'قبله →')));
    return els;
  }

  moveClip(id, d) {
    this.upd((p) => {
      const i = p.clips.findIndex((c) => c.id === id);
      const j = i + d;
      if (j < 0 || j >= p.clips.length) return;
      [p.clips[i], p.clips[j]] = [p.clips[j], p.clips[i]];
      fixTransitions(p);
    });
    this.app.store.emit('change');
    this.renderInspector();
  }

  textInsp(t) {
    const set = (k, key) => (v) => this.upd((p) => { const x = p.texts.find((y) => y.id === t.id); if (x) { x[k] = v; if (k === 'text') x.words = null; } }, key || `t:${t.id}:${k}`);
    const fontOpts = Object.fromEntries(FONTS.map((f) => [f, f]));
    return [
      this.title(null, 'نص متحرك', TEXT_PRESETS[t.preset]?.label || ''),
      textField({ label: 'النص', value: t.text, multiline: true, onInput: set('text'), dir: 'auto' }),
      textField({ label: 'سطر فرعي (اختياري)', value: t.sub || '', onInput: set('sub'), dir: 'auto' }),
      selectField({ label: 'الحركة', options: TEXT_ANIMS, value: t.anim, onChange: set('anim') }),
      selectField({ label: 'الخط', options: fontOpts, value: t.font, onChange: (v) => { set('font')(v); document.fonts?.load(`${t.weight} 40px "${v}"`).then(() => this.app.player.invalidate()); } }),
      pillsField({ label: 'السماكة', options: { 500: 'عادي', 700: 'عريض', 800: 'أعرض', 900: 'أسود' }, value: t.weight, onChange: (v) => set('weight')(+v) }),
      rangeField({ label: 'الحجم', min: 0.025, max: 0.2, step: 0.002, value: t.size, fmt: (v) => Math.round(v * 1000), onInput: set('size') }),
      colorField({ label: 'لون النص', value: t.color, onChange: set('color') }),
      colorField({ label: 'لون التمييز', value: t.accent, onChange: set('accent') }),
      pillsField({ label: 'الموضع', options: { 0.14: 'أعلى', 0.3: 'ثلث علوي', 0.5: 'وسط', 0.7: 'ثلث سفلي', 0.84: 'أسفل' }, value: '', onChange: (v) => { set('y')(+v); this.renderInspector(); } }),
      rangeField({ label: 'الموضع الرأسي', min: 0.05, max: 0.95, step: 0.005, value: t.y, fmt: fmtPct, onInput: set('y') }),
      rangeField({ label: 'عرض النص', min: 0.4, max: 0.96, step: 0.01, value: t.width || 0.86, fmt: fmtPct, onInput: set('width') }),
      selectField({ label: 'الخلفية', options: TEXT_BOXES, value: t.box, onChange: (v) => { set('box')(v); this.renderInspector(); } }),
      t.box !== 'none' ? colorField({ label: 'لون الخلفية', value: t.boxColor, onChange: set('boxColor') }) : null,
      selectField({ label: 'زخرفة', options: TEXT_DECOS, value: t.deco, onChange: set('deco') }),
      toggleField({ label: 'حد حول الحروف', checked: t.stroke, onChange: set('stroke') }),
      toggleField({ label: 'ظل', checked: t.shadow, onChange: set('shadow') }),
      toggleField({ label: 'يختفي بنعومة في النهاية', checked: t.out !== 'none', onChange: (v) => set('out')(v ? 'fade' : 'none') }),
      h('hr', { class: 'sep' }),
      rangeField({ label: 'يبدأ عند', min: 0, max: Math.max(projectDuration(this.app.store.project), t.start + 1), step: 0.05, value: t.start, fmt: fmtSec, onInput: set('start') }),
      rangeField({ label: 'المدة', min: 0.3, max: 20, step: 0.05, value: t.dur, fmt: fmtSec, onInput: (v) => { set('dur')(v); } }),
      h('button', { class: 'btn block', onclick: () => this.applyTextStyleAll(t) }, 'طبّق هذا الشكل على كل النصوص المشابهة'),
    ];
  }

  applyTextStyleAll(t) {
    const keys = ['font', 'weight', 'size', 'color', 'accent', 'anim', 'box', 'boxColor', 'deco', 'stroke', 'shadow', 'y', 'width', 'out'];
    let n = 0;
    this.upd((p) => p.texts.forEach((x) => {
      if (x.id === t.id || x.preset !== t.preset) return;
      for (const k of keys) x[k] = t[k];
      n++;
    }));
    this.app.store.emit('change');
    toast(n ? `تم تطبيق الشكل على ${n} نص` : 'ما فيه نصوص مشابهة');
  }

  audioInsp(a) {
    const { media, store } = this.app;
    const m = media.get(a.mediaId);
    const set = (k) => (v) => this.upd((p) => { const x = p.audio.find((y) => y.id === a.id); if (x) x[k] = v; }, `a:${a.id}:${k}`);
    const total = projectDuration(store.project);
    return [
      this.title(null, a.role === 'bg' ? '🎧 خلفية صوتية' : '🎙️ تعليق صوتي', m?.name || ''),
      pillsField({ label: 'النوع', options: { voice: 'تعليق صوتي', bg: 'خلفية' }, value: a.role, onChange: (v) => { set('role')(v); this.app.store.emit('change'); } }),
      rangeField({ label: 'مستوى الصوت', min: 0, max: 2, step: 0.02, value: a.volume, fmt: fmtPct, onInput: set('volume') }),
      rangeField({ label: 'دخول تدريجي', min: 0, max: 6, step: 0.1, value: a.fadeIn, fmt: fmtSec, onInput: set('fadeIn') }),
      rangeField({ label: 'خروج تدريجي', min: 0, max: 6, step: 0.1, value: a.fadeOut, fmt: fmtSec, onInput: set('fadeOut') }),
      rangeField({ label: 'يبدأ عند', min: 0, max: Math.max(total, a.start + 1), step: 0.05, value: a.start, fmt: fmtSec, onInput: set('start') }),
      toggleField({
        label: 'تكرار حتى نهاية الفيديو', hint: 'للخلفية الأقصر من الفيديو', checked: a.loop,
        onChange: (v) => this.upd((p) => {
          const x = p.audio.find((y) => y.id === a.id);
          x.loop = v;
          if (v) x.dur = Math.max(audioLength({ ...x, loop: false }), total - x.start);
          this.renderInspector();
        }),
      }),
      h('button', {
        class: 'btn block', onclick: () => this.upd((p) => {
          const x = p.audio.find((y) => y.id === a.id);
          x.start = 0;
          const need = total;
          if (!total) return;
          if (x.out - x.in >= need) { x.loop = false; x.out = x.in + need; } else { x.loop = true; x.dur = need; }
          this.renderInspector();
          store.emit('change');
        }),
      }, '↔ مدّه على كامل الفيديو'),
    ];
  }
}

