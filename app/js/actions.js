// محرك أوامر المساعد: أفعال محددة ينفذها على المشروع (خطوة تراجع واحدة لكل أمر)
import { layoutClips, projectDuration, audioLength, newText, newAudio, STYLES, applyStyle, TEXT_PRESETS, ASPECTS, clamp, uid } from './model.js';
import { TRANSITIONS, MOTIONS, FILTERS } from './renderer.js';
import { TEXT_ANIMS, FONTS } from './textfx.js';
import { fixTransitions } from './timeline.js';

const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ordName = (n) => ORD[n] || String(n);

// وصف المشروع للذكاء الاصطناعي
export function describeProject(app) {
  const { store, media, player } = app;
  const p = store.project;
  const layout = layoutClips(p);
  const sel = store.sel;
  const lines = [];
  lines.push(`المقاس: ${p.aspect} · المدة: ${projectDuration(p, layout).toFixed(1)}ث · المؤشر عند ${player.t.toFixed(1)}ث · القالب: ${p.styleKey || 'بدون'}`);
  let img = 0, vid = 0;
  lines.push('المشاهد:');
  layout.forEach((L, i) => {
    const c = L.clip;
    const m = media.get(c.mediaId);
    const kindN = c.type === 'video' ? `فيديو ${++vid}` : `صورة ${++img}`;
    const here = player.t >= L.start && player.t < L.end ? ' ←عند المؤشر' : '';
    const s = sel?.id === c.id ? ' ★محدد' : '';
    lines.push(`  clip:${i + 1} (${kindN}) "${m?.name || '?'}" من ${L.start.toFixed(1)} إلى ${L.end.toFixed(1)}ث · انتقال داخل:${c.transition?.type} · حركة:${c.motion} · فلتر:${c.filter} · ملاءمة:${c.fit}${c.type === 'video' ? ` · سرعة:${c.speed} · صوت:${c.muted ? 'مكتوم' : c.volume}` : ''}${s}${here}`);
  });
  if (!layout.length) lines.push('  (لا يوجد)');
  lines.push('النصوص:');
  p.texts.forEach((t, i) => lines.push(`  text:${i + 1} "${t.text.slice(0, 40)}" من ${t.start.toFixed(1)} لمدة ${t.dur.toFixed(1)}ث · قالب:${t.preset} · حركة:${t.anim}${sel?.id === t.id ? ' ★محدد' : ''}`));
  if (!p.texts.length) lines.push('  (لا يوجد)');
  lines.push('الأصوات:');
  p.audio.forEach((a, i) => lines.push(`  audio:${i + 1} ${a.role === 'bg' ? 'خلفية' : 'تعليق صوتي'} "${media.get(a.mediaId)?.name || '?'}" من ${a.start.toFixed(1)} لمدة ${audioLength(a).toFixed(1)}ث · مستوى:${a.volume}${sel?.id === a.id ? ' ★محدد' : ''}`));
  if (!p.audio.length) lines.push('  (لا يوجد)');
  lines.push(`الميكس: خفض الخلفية وقت الكلام=${p.settings.ducking} · صوت انتقال=${p.settings.whoosh}`);
  return lines.join('\n');
}

export const ACTION_DOCS = `
الأهداف (target):
"selected" العنصر المحدد · "current" المشهد عند المؤشر · "all" كل المشاهد · "images" كل الصور · "videos" كل الفيديوهات
"clip:N" المشهد رقم N · "clip:first" · "clip:last" · "image:N" الصورة رقم N · "video:N" الفيديو رقم N
"text:N" · "text:all" · "audio:N" · "voice" كل التعليقات الصوتية · "bg" الخلفيات الصوتية

الأفعال (actions) — مصفوفة JSON:
{"type":"delete","target":T}
{"type":"transition","target":T,"kind":${JSON.stringify(Object.keys(TRANSITIONS))},"dur":ثواني} (target يعني الانتقال الداخل لذلك المشهد؛ "all" للكل)
{"type":"style","name":${JSON.stringify(Object.keys(STYLES))}} (calm=درس هادئ، reel=ريل حيوي، cinema=سينمائي، story=قصة ووثائقي، clean=بدون تأثيرات)
{"type":"clip","target":T,"set":{"motion":${JSON.stringify(Object.keys(MOTIONS))},"filter":${JSON.stringify(Object.keys(FILTERS))},"fit":["auto","cover","blur","contain"],"zoom":1-2,"speed":0.25-4,"volume":0-2,"muted":bool,"dur":ثواني للصورة}}
{"type":"to_audio","target":T,"role":"voice"|"bg"} يحوّل فيديو إلى صوت فقط (يختفي من المشاهد ويبقى صوته في نفس الوقت)
{"type":"move","target":T,"to":رقم|"first"|"last"}
{"type":"text_add","text":"...","sub":"سطر فرعي","preset":${JSON.stringify(Object.keys(TEXT_PRESETS))},"at":ثواني|"start"|"end"|"current","dur":ثواني}
{"type":"text","target":T,"set":{"text","sub","font":${JSON.stringify(FONTS)},"color":"#hex","accent":"#hex","size":0.03-0.2,"y":0-1,"anim":${JSON.stringify(Object.keys(TEXT_ANIMS))},"start","dur"}}
{"type":"audio","target":T,"set":{"volume":0-2,"fadeIn":ث,"fadeOut":ث,"loop":bool,"start":ث,"role":"voice"|"bg"}}
{"type":"stretch_audio","target":T} يمدّ الصوت على كامل الفيديو
{"type":"project","set":{"aspect":${JSON.stringify(Object.keys(ASPECTS))},"vignette":bool,"bg":"#hex"}}
{"type":"mix","set":{"ducking":bool,"duckLevel":0-0.6,"whoosh":bool,"normalize":bool}}
{"type":"fit_audio"} يوزّع مدة الصور لتطابق طول الخلفية الصوتية
{"type":"split"} قص عند المؤشر · {"type":"duplicate","target":T}
{"type":"undo"} · {"type":"redo"} · {"type":"play"} · {"type":"pause"} · {"type":"seek","t":ثواني} · {"type":"export"}
`;

function resolve(app, target, kind) {
  const { store, player } = app;
  const p = store.project;
  const sel = store.sel;
  target = String(target || 'selected').trim();
  if (kind === 'text' || target.startsWith('text')) {
    if (target === 'text:all' || target === 'all') return p.texts;
    const m = target.match(/text:(\d+|last|first)/);
    if (m) return [m[1] === 'last' ? p.texts[p.texts.length - 1] : m[1] === 'first' ? p.texts[0] : p.texts[+m[1] - 1]].filter(Boolean);
    if (sel?.kind === 'text') return p.texts.filter((t) => t.id === sel.id);
    const here = p.texts.filter((t) => player.t >= t.start && player.t <= t.start + t.dur);
    return here.length ? here : p.texts.length === 1 ? p.texts : [];
  }
  if (kind === 'audio' || target.startsWith('audio') || target === 'voice' || target === 'bg') {
    if (target === 'voice' || target === 'bg') return p.audio.filter((a) => a.role === target);
    if (target === 'audio:all' || target === 'all') return p.audio;
    const m = target.match(/audio:(\d+|last|first)/);
    if (m) return [m[1] === 'last' ? p.audio[p.audio.length - 1] : m[1] === 'first' ? p.audio[0] : p.audio[+m[1] - 1]].filter(Boolean);
    if (sel?.kind === 'audio') return p.audio.filter((a) => a.id === sel.id);
    return p.audio.filter((a) => a.role === 'bg').slice(0, 1);
  }
  const clips = p.clips;
  if (target === 'all') return clips;
  if (target === 'images') return clips.filter((c) => c.type === 'image');
  if (target === 'videos') return clips.filter((c) => c.type === 'video');
  let m = target.match(/^clip:(\d+|last|first)$/);
  if (m) return [m[1] === 'last' ? clips[clips.length - 1] : m[1] === 'first' ? clips[0] : clips[+m[1] - 1]].filter(Boolean);
  m = target.match(/^(image|video):(\d+|last|first)$/);
  if (m) {
    const list = clips.filter((c) => c.type === m[1]);
    return [m[2] === 'last' ? list[list.length - 1] : m[2] === 'first' ? list[0] : list[+m[2] - 1]].filter(Boolean);
  }
  if (target === 'selected' && sel?.kind === 'clip') return clips.filter((c) => c.id === sel.id);
  // "current" أو لا يوجد تحديد: المشهد عند المؤشر
  const L = layoutClips(p).filter((x) => player.t >= x.start && player.t < x.end).pop();
  return L ? [L.clip] : [];
}

const clipLabel = (p, c) => `المشهد ${ordName(p.clips.indexOf(c) + 1)}`;

// ينفّذ مجموعة أفعال كخطوة تراجع واحدة. يرجع رسائل ما تم
export function runActions(app, actions) {
  const { store, player, media } = app;
  const done = [];
  const fail = [];
  const after = [];
  const list = (Array.isArray(actions) ? actions : [actions]).filter(Boolean);
  if (!list.length) return { done, fail: ['ما فهمت المطلوب'] };

  const editing = list.filter((a) => !['undo', 'redo', 'play', 'pause', 'seek', 'export', 'split'].includes(a.type));
  if (editing.length) {
    store.update((p) => {
      for (const a of editing) {
        try { exec(a, p); } catch (e) { fail.push(e.message); }
      }
      fixTransitions(p);
    });
    store.fixSel();
  }
  for (const a of list) {
    if (a.type === 'undo') { store.undo(); done.push('تراجعت عن آخر تعديل'); }
    if (a.type === 'redo') { store.redo(); done.push('أعدت التعديل'); }
    if (a.type === 'split') { app.split(); done.push('قصصت عند المؤشر'); }
    if (a.type === 'play') after.push(() => player.play());
    if (a.type === 'pause') after.push(() => player.pause());
    if (a.type === 'seek') after.push(() => player.seek(+a.t || 0));
    if (a.type === 'export') after.push(() => app.exportDialog());
  }
  after.forEach((f) => f());
  app.timeline.autoFit && app.timeline.fit();
  return { done, fail };

  function exec(a, p) {
    const need = (arr, what) => { if (!arr.length) throw new Error(`ما لقيت ${what}`); return arr; };
    switch (a.type) {
      case 'delete': {
        const t = String(a.target || 'selected');
        if (t.startsWith('text')) { const xs = need(resolve(app, t, 'text'), 'النص'); p.texts = p.texts.filter((x) => !xs.includes(x)); done.push(`حذفت ${xs.length > 1 ? xs.length + ' نصوص' : 'النص'}`); break; }
        if (t.startsWith('audio') || t === 'voice' || t === 'bg') { const xs = need(resolve(app, t, 'audio'), 'الصوت'); p.audio = p.audio.filter((x) => !xs.includes(x)); done.push('حذفت الصوت'); break; }
        if (t === 'selected' && store.sel && store.sel.kind !== 'clip') return exec({ ...a, target: store.sel.kind === 'text' ? `text:${p.texts.findIndex((x) => x.id === store.sel.id) + 1}` : `audio:${p.audio.findIndex((x) => x.id === store.sel.id) + 1}` }, p);
        const xs = need(resolve(app, t), 'المشهد');
        const names = xs.map((c) => clipLabel(p, c));
        p.clips = p.clips.filter((c) => !xs.includes(c));
        done.push(xs.length > 2 ? `حذفت ${xs.length} مشاهد` : `حذفت ${names.join(' و')}`);
        break;
      }
      case 'transition': {
        if (a.kind === 'varied') {
          const pool = ['fade', 'zoom', 'slide-l', 'wipe-l', 'blur', 'circle', 'push-r', 'black'];
          p.clips.forEach((c, i) => { if (i > 0) c.transition = { type: pool[(i - 1) % pool.length], dur: c.transition?.dur || 0.6 }; });
          done.push('وزّعت انتقالات متنوعة على كل المشاهد');
          break;
        }
        const kind = TRANSITIONS[a.kind] ? a.kind : null;
        const t = a.target || 'all';
        let xs = t === 'all' ? p.clips.slice(1) : need(resolve(app, t), 'المشهد');
        xs = xs.filter((c) => p.clips.indexOf(c) > 0);
        if (!xs.length) throw new Error('المشهد الأول ما له انتقال داخل — اختر مشهداً بعده');
        for (const c of xs) c.transition = { type: kind || c.transition?.type || 'fade', dur: kind === 'none' ? 0 : clamp(+a.dur || c.transition?.dur || 0.6, 0.2, 2) };
        if (t === 'all') p.defaultTr = { ...xs[0].transition };
        done.push(`${kind ? 'الانتقال صار «' + TRANSITIONS[kind] + '»' : 'عدّلت مدة الانتقال'} ${t === 'all' ? 'لكل المشاهد' : 'لـ' + xs.map((c) => clipLabel(p, c)).join(' و')}`);
        break;
      }
      case 'style':
        if (!applyStyle(p, a.name)) throw new Error('ما أعرف هذا القالب');
        done.push(`طبّقت قالب «${STYLES[a.name].name}»`);
        break;
      case 'clip': {
        const set = a.set || {};
        let xs = resolve(app, a.target);
        if (set.muted != null || set.speed != null || set.volume != null) {
          xs = xs.filter((c) => c.type === 'video');
          const vids = p.clips.filter((c) => c.type === 'video');
          if (!xs.length && vids.length === 1) xs = vids;
          if (!xs.length) throw new Error(vids.length ? 'حدّد الفيديو المقصود أو قل رقمه (مثلاً: الفيديو الثاني)' : 'ما فيه فيديو في المشروع');
        }
        need(xs, 'المشهد');
        const msgs = [];
        for (const c of xs) {
          if (set.motion && MOTIONS[set.motion]) c.motion = set.motion;
          if (set.filter && FILTERS[set.filter]) c.filter = set.filter;
          if (set.fit && ['auto', 'cover', 'blur', 'contain'].includes(set.fit)) c.fit = set.fit;
          if (set.zoom != null) c.zoom = clamp(+set.zoom, 1, 2);
          if (c.type === 'video') {
            if (set.speed != null) c.speed = clamp(+set.speed, 0.25, 4);
            if (set.volume != null) c.volume = clamp(+set.volume, 0, 2);
            if (set.muted != null) c.muted = !!set.muted;
          } else if (set.dur != null) c.dur = clamp(+set.dur, 0.3, 60);
          else if (set.durMul != null) c.dur = clamp(c.dur * set.durMul, 0.3, 60);
        }
        if (set.motion) msgs.push(`الحركة: ${MOTIONS[set.motion]}`);
        if (set.filter) msgs.push(`الفلتر: ${FILTERS[set.filter]?.label}`);
        if (set.fit) msgs.push(set.fit === 'cover' ? 'ملء الشاشة' : 'الصورة كاملة');
        if (set.zoom != null) msgs.push(`التكبير ${Math.round(set.zoom * 100)}%`);
        if (set.speed != null) msgs.push(`السرعة ${set.speed}×`);
        if (set.muted != null) msgs.push(set.muted ? 'كتمت الصوت' : 'رجّعت الصوت');
        if (set.volume != null) msgs.push(`مستوى الصوت ${Math.round(set.volume * 100)}%`);
        if (set.dur != null) msgs.push(`المدة ${(+set.dur).toFixed(1)} ث`);
        if (set.durMul != null && set.speed == null) msgs.push(set.durMul > 1 ? 'طوّلت المدة' : 'قصّرت المدة');
        done.push(`${xs.length === p.clips.length && xs.length > 1 ? 'كل المشاهد' : xs.length > 2 ? xs.length + ' مشاهد' : xs.map((c) => clipLabel(p, c)).join(' و')}: ${msgs.join('، ') || 'تم'}`);
        break;
      }
      case 'to_audio': {
        let xs = resolve(app, a.target).filter((c) => c.type === 'video');
        const vids = p.clips.filter((c) => c.type === 'video');
        if (!xs.length && vids.length === 1) xs = vids;
        if (!xs.length) throw new Error(vids.length ? 'حدّد الفيديو المقصود أو قل رقمه (مثلاً: الفيديو الثاني)' : 'ما فيه فيديو في المشروع');
        const layout = layoutClips(p);
        for (const c of xs) {
          const m = media.get(c.mediaId);
          if (!m?.hasAudio) throw new Error('هذا الفيديو ما فيه صوت');
          const L = layout.find((x) => x.clip === c);
          const au = newAudio(m, a.role === 'bg' ? 'bg' : 'voice', L.start);
          au.in = c.in; au.out = c.out; au.volume = c.volume ?? 1;
          au.fadeIn = 0.2; au.fadeOut = 0.4;
          p.audio.push(au);
        }
        p.clips = p.clips.filter((c) => !xs.includes(c));
        done.push(`حوّلت ${xs.length > 1 ? xs.length + ' فيديوهات' : 'الفيديو'} إلى ${a.role === 'bg' ? 'خلفية صوتية' : 'صوت فقط'}، واختفى من المشاهد`);
        break;
      }
      case 'move': {
        const [c] = need(resolve(app, a.target), 'المشهد');
        const from = p.clips.indexOf(c);
        let to = a.to === 'first' ? 0 : a.to === 'last' ? p.clips.length - 1 : clamp((+a.to || 1) - 1, 0, p.clips.length - 1);
        p.clips.splice(from, 1);
        p.clips.splice(to, 0, c);
        done.push(`نقلت المشهد ليصير ${ordName(to + 1)}`);
        break;
      }
      case 'text_add': {
        const preset = TEXT_PRESETS[a.preset] ? a.preset : 'title';
        const total = projectDuration(p);
        const t = newText(preset, 0);
        if (a.text) t.text = String(a.text);
        if (a.sub != null) t.sub = String(a.sub);
        if (a.dur) t.dur = clamp(+a.dur, 0.3, 60);
        const at = a.at ?? 'current';
        t.start = at === 'start' ? 0 : at === 'end' ? Math.max(0, total - t.dur) : at === 'current' ? player.t : Math.max(0, +at || 0);
        if (total > 0 && t.start + t.dur > total && at !== 'end') t.start = Math.max(0, total - t.dur);
        p.texts.push(t);
        store.sel = { kind: 'text', id: t.id };
        done.push(`أضفت «${t.text}» عند ${t.start.toFixed(1)} ث`);
        after.push(() => player.seek(t.start + Math.min(1.2, t.dur / 2)));
        break;
      }
      case 'text': {
        const xs = need(resolve(app, a.target, 'text'), 'النص');
        const set = a.set || {};
        for (const t of xs) {
          for (const k of ['text', 'sub', 'color', 'accent', 'boxColor']) if (set[k] != null) t[k] = String(set[k]);
          if (set.font && FONTS.includes(set.font)) t.font = set.font;
          if (set.anim && TEXT_ANIMS[set.anim]) t.anim = set.anim;
          if (set.size != null) t.size = clamp(+set.size, 0.02, 0.25);
          if (set.sizeMul != null) t.size = clamp(t.size * set.sizeMul, 0.02, 0.25);
          if (set.y != null) t.y = clamp(+set.y, 0.04, 0.96);
          if (set.start != null) t.start = Math.max(0, +set.start);
          if (set.dur != null) t.dur = clamp(+set.dur, 0.3, 60);
          if (set.text != null) t.words = null;
        }
        done.push(`عدّلت ${xs.length > 1 ? xs.length + ' نصوص' : 'النص'}${set.sizeMul ? (set.sizeMul > 1 ? ' (كبّرت الخط)' : ' (صغّرت الخط)') : ''}${set.y != null ? ' (غيّرت المكان)' : ''}${set.color ? ' (غيّرت اللون)' : ''}`);
        break;
      }
      case 'audio': {
        const xs = need(resolve(app, a.target, 'audio'), 'الصوت');
        const set = a.set || {};
        for (const x of xs) {
          if (set.volume != null) x.volume = clamp(+set.volume, 0, 2);
          if (set.volMul != null) x.volume = clamp(x.volume * set.volMul, 0, 2);
          if (set.fadeIn != null) x.fadeIn = clamp(+set.fadeIn, 0, 10);
          if (set.fadeOut != null) x.fadeOut = clamp(+set.fadeOut, 0, 10);
          if (set.start != null) x.start = Math.max(0, +set.start);
          if (set.role === 'voice' || set.role === 'bg') x.role = set.role;
          if (set.loop != null) { x.loop = !!set.loop; if (x.loop) x.dur = Math.max(x.out - x.in, projectDuration(p) - x.start); }
        }
        done.push(set.volMul ? (set.volMul > 1 ? 'رفعت الصوت' : 'خفضت الصوت') + ` (${Math.round(xs[0].volume * 100)}%)` : `عدّلت الصوت${set.volume != null ? ` (المستوى ${Math.round(set.volume * 100)}%)` : ''}`);
        break;
      }
      case 'stretch_audio': {
        const xs = need(resolve(app, a.target || 'bg', 'audio'), 'الصوت');
        const total = projectDuration({ ...p, audio: [] });
        if (!total) throw new Error('أضف مشاهد أولاً');
        for (const x of xs) { x.start = 0; if (x.out - x.in >= total) { x.loop = false; x.out = x.in + total; } else { x.loop = true; x.dur = total; } }
        done.push('مدّيت الصوت على كامل الفيديو');
        break;
      }
      case 'project': {
        const set = a.set || {};
        if (set.aspect && ASPECTS[set.aspect]) { p.aspect = set.aspect; after.push(() => { app.renderAspect(); player.resize(); }); done.push(`المقاس صار ${set.aspect}`); }
        if (set.vignette != null) { p.vignette = !!set.vignette; done.push(set.vignette ? 'أضفت إطاراً داكناً' : 'شلت الإطار الداكن'); }
        if (set.bg) { p.bg = set.bg; done.push('غيّرت لون الخلفية'); }
        break;
      }
      case 'mix': {
        const set = a.set || {};
        for (const k of ['ducking', 'whoosh', 'normalize', 'duckClipAudio']) if (set[k] != null) p.settings[k] = !!set[k];
        if (set.duckLevel != null) p.settings.duckLevel = clamp(+set.duckLevel, 0, 0.6);
        done.push('عدّلت إعدادات الصوت');
        break;
      }
      case 'fit_audio': {
        const bg = p.audio.find((x) => x.role === 'bg');
        if (!bg) throw new Error('ما فيه خلفية صوتية');
        const imgs = p.clips.filter((c) => c.type === 'image');
        if (!imgs.length) throw new Error('ما فيه صور');
        const fixed = p.clips.filter((c) => c.type !== 'image').reduce((s, c) => s + (c.out - c.in) / (c.speed || 1), 0);
        const trs = layoutClips(p).reduce((s, L) => s + L.tr, 0);
        const each = clamp((bg.start + audioLength(bg) - fixed + trs) / imgs.length, 0.6, 30);
        imgs.forEach((c) => { c.dur = +each.toFixed(2); });
        done.push(`ضبطت كل صورة على ${each.toFixed(1)} ث لتطابق الخلفية`);
        break;
      }
      case 'duplicate': {
        const xs = need(resolve(app, a.target), 'المشهد');
        for (const c of xs) { const d = JSON.parse(JSON.stringify(c)); d.id = uid('clip'); p.clips.splice(p.clips.indexOf(c) + 1, 0, d); }
        done.push('كررت المشهد');
        break;
      }
      default:
        throw new Error(`فعل غير معروف: ${a.type}`);
    }
  }
}
