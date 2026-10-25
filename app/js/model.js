// نموذج المشروع: الأبعاد، القيم الافتراضية، وحساب مواقع المشاهد على الخط الزمني

export const ASPECTS = {
  '9:16': { w: 1080, h: 1920, label: 'ريلز' },
  '16:9': { w: 1920, h: 1080, label: 'دروس' },
  '1:1': { w: 1080, h: 1080, label: 'مربع' },
  '4:5': { w: 1080, h: 1350, label: 'منشور' },
};

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function newProject() {
  return {
    version: 1,
    name: 'مشروع جديد',
    aspect: '9:16',
    fps: 30,
    bg: '#000000',
    vignette: false,
    clips: [],
    texts: [],
    audio: [],
    settings: {
      ducking: true,        // خفض الخلفية وقت الكلام
      duckLevel: 0.22,      // مستوى الخلفية أثناء الكلام
      duckClipAudio: true,  // اعتبر صوت المقاطع كلاماً
      whoosh: false,        // صوت انتقال ناعم
      normalize: true,      // توحيد مستوى الصوت
      safeZones: false,
    },
  };
}

export function newClip(media, index = 0) {
  const isVideo = media.type === 'video';
  return {
    id: uid('clip'),
    mediaId: media.id,
    type: media.type,
    in: 0,
    out: isVideo ? media.duration : 0,
    dur: isVideo ? media.duration : 3,
    speed: 1,
    fit: 'auto',
    motion: isVideo ? 'none' : 'auto',
    filter: 'none',
    volume: 1,
    muted: false,
    zoom: 1,
    transition: index === 0 ? { type: 'none', dur: 0 } : { type: 'fade', dur: 0.6 },
  };
}

export const TEXT_PRESETS = {
  title: {
    label: 'عنوان رئيسي', text: 'عنوان رئيسي', sub: '', font: 'Cairo', weight: 800, size: 0.095,
    color: '#ffffff', accent: '#f5c451', anim: 'words', box: 'none', deco: 'lines', y: 0.42, stroke: false, shadow: true, dur: 3,
  },
  subtitle: {
    label: 'عنوان مع سطر فرعي', text: 'العنوان هنا', sub: 'سطر فرعي توضيحي', font: 'Tajawal', weight: 800, size: 0.08,
    color: '#ffffff', accent: '#5ee6c4', anim: 'rise', box: 'none', deco: 'none', y: 0.45, stroke: false, shadow: true, dur: 3,
  },
  caption: {
    label: 'كابشن', text: 'اكتب الكلام هنا', sub: '', font: 'Tajawal', weight: 800, size: 0.078,
    color: '#ffffff', accent: '#f5c451', anim: 'karaoke', box: 'none', deco: 'none', y: 0.7, stroke: true, shadow: true, dur: 2.5,
  },
  highlight: {
    label: 'كابشن تيك توك', text: 'كل كلمة تتلوّن', sub: '', font: 'Cairo', weight: 900, size: 0.08,
    color: '#ffffff', accent: '#7c5cff', anim: 'highlight', box: 'none', deco: 'none', y: 0.7, stroke: true, shadow: true, dur: 2.5,
  },
  lower: {
    label: 'شريط سفلي', text: 'أ. طلال المهلهل', sub: 'معلم التربية الإسلامية', font: 'Tajawal', weight: 800, size: 0.05,
    color: '#ffffff', accent: '#f5c451', anim: 'wipe', box: 'bar', deco: 'none', y: 0.82, stroke: false, shadow: false, dur: 4,
  },
  quote: {
    label: 'آية / اقتباس', text: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾', sub: 'سورة طه - ١١٤', font: 'Amiri', weight: 700, size: 0.085,
    color: '#fff8e7', accent: '#e3b65c', anim: 'blur', box: 'none', deco: 'star', y: 0.47, stroke: false, shadow: true, dur: 5,
  },
  card: {
    label: 'بطاقة افتتاحية', text: 'الدرس الأول', sub: 'التربية الإسلامية', font: 'El Messiri', weight: 700, size: 0.1,
    color: '#ffffff', accent: '#5ee6c4', anim: 'drop', box: 'block', deco: 'frame', y: 0.46, stroke: false, shadow: true, dur: 3.5,
  },
  pill: {
    label: 'نص بخلفية', text: 'نص بارز بخلفية', sub: '', font: 'Readex Pro', weight: 700, size: 0.058,
    color: '#111111', accent: '#f5c451', anim: 'pop', box: 'pill', boxColor: '#ffffff', deco: 'none', y: 0.2, stroke: false, shadow: false, dur: 3,
  },
};

export function newText(presetKey = 'title', start = 0) {
  const p = TEXT_PRESETS[presetKey] || TEXT_PRESETS.title;
  const { label, ...rest } = p;
  return { id: uid('txt'), preset: presetKey, start, x: 0.5, width: 0.86, boxColor: '#000000', out: 'fade', words: null, ...rest };
}

export function newAudio(media, role = 'bg', start = 0) {
  return {
    id: uid('aud'), mediaId: media.id, role, start,
    in: 0, out: media.duration, dur: media.duration,
    volume: role === 'bg' ? 0.5 : 1,
    fadeIn: role === 'bg' ? 1.5 : 0, fadeOut: role === 'bg' ? 2 : 0,
    loop: false,
  };
}

// مدة المشهد على الخط الزمني (بعد السرعة)
export function clipLength(c) {
  if (c.type === 'video') return Math.max(0.1, (c.out - c.in) / (c.speed || 1));
  return Math.max(0.1, c.dur);
}

// يحسب بداية ونهاية كل مشهد مع تداخل الانتقالات
export function layoutClips(project) {
  const out = [];
  let end = 0;
  project.clips.forEach((c, i) => {
    const len = clipLength(c);
    let tr = 0;
    if (i > 0 && c.transition && c.transition.type !== 'none') {
      const prevLen = out[i - 1].len;
      tr = Math.min(c.transition.dur || 0, len * 0.5, prevLen * 0.5);
    }
    const start = Math.max(0, end - tr);
    out.push({ clip: c, index: i, start, end: start + len, len, tr });
    end = start + len;
  });
  return out;
}

export function audioLength(a) {
  return a.loop ? a.dur : Math.max(0.05, a.out - a.in);
}

export function projectDuration(project, layout = layoutClips(project)) {
  let d = layout.length ? layout[layout.length - 1].end : 0;
  for (const t of project.texts) d = Math.max(d, t.start + t.dur);
  if (!layout.length) for (const a of project.audio) d = Math.max(d, a.start + audioLength(a));
  return Math.max(d, 0);
}

export function dims(project, scale = 1) {
  const a = ASPECTS[project.aspect] || ASPECTS['9:16'];
  const even = (v) => Math.max(2, Math.round(v * scale / 2) * 2);
  return { w: even(a.w), h: even(a.h) };
}

export const fmtTime = (s, ms = true) => {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const ss = ms ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return `${m}:${ss}`;
};

// قوالب المونتاج الجاهزة
export const STYLES = {
  calm: { name: 'درس هادئ', desc: 'تلاشي ناعم، حركة بطيئة، 4 ثوانٍ للصورة', tr: { type: 'fade', dur: 0.8 }, motion: 'auto', filter: 'none', dur: 4, vignette: false },
  reel: { name: 'ريل حيوي', desc: 'انتقالات سريعة متنوعة، زوم، 2 ثانية للصورة', tr: { type: 'zoom', dur: 0.4 }, mix: ['zoom', 'slide-l', 'wipe-l', 'push-r', 'circle'], motion: 'zoom-in', filter: 'vivid', dur: 2, vignette: false, whoosh: true },
  cinema: { name: 'سينمائي', desc: 'عبور بالأسود، ألوان سينمائية، إطار داكن', tr: { type: 'black', dur: 1 }, motion: 'auto', filter: 'cinematic', dur: 4.5, vignette: true },
  story: { name: 'قصة ووثائقي', desc: 'انتقال ضبابي، لون ذهبي دافئ، حركة كين برنز', tr: { type: 'blur', dur: 1 }, motion: 'auto', filter: 'gold', dur: 5, vignette: true },
  clean: { name: 'بدون تأثيرات', desc: 'قطع مباشر وألوان أصلية', tr: { type: 'none', dur: 0 }, motion: 'none', filter: 'none', dur: 3, vignette: false },
};

export function applyStyle(p, k) {
  const S = STYLES[k];
  if (!S) return false;
  p.styleKey = k;
  p.defaultTr = { ...S.tr };
  p.defaultImageDur = S.dur;
  p.defaultFilter = S.filter;
  p.vignette = S.vignette;
  if (S.whoosh != null) p.settings.whoosh = S.whoosh;
  p.clips.forEach((c, i) => {
    if (i > 0) c.transition = S.mix ? { type: S.mix[(i - 1) % S.mix.length], dur: S.tr.dur } : { ...S.tr };
    if (c.type === 'image') { c.dur = S.dur; c.motion = S.motion; }
    c.filter = S.filter;
  });
  return true;
}
