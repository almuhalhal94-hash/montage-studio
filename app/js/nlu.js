// الفاهم المدمج: يحوّل الأوامر العربية المعتادة إلى أفعال — بدون إنترنت ولا مفتاح
const ORD = { 'الاول': 1, 'اول': 1, 'الثاني': 2, 'ثاني': 2, 'الثالث': 3, 'ثالث': 3, 'الرابع': 4, 'رابع': 4, 'الخامس': 5, 'خامس': 5, 'السادس': 6, 'سادس': 6, 'السابع': 7, 'سابع': 7, 'الثامن': 8, 'ثامن': 8, 'التاسع': 9, 'تاسع': 9, 'العاشر': 10, 'عاشر': 10 };
const VERBS = 'شيل|احذف|امسح|اشطب|خل|خلي|خليه|خليها|خله|خلها|حط|حطه|اضف|ضيف|حرك|غير|اجعل|سو|سوي|كتم|اكتم|سرع|بطي|قدم|اخر|انقل|طبق|كبر|صغر|رجع|تراجع|شغل|وقف|مد|طول|قصر|اكتب|كرر|طابق|حول|نزل|ارفع|وطي|علي|زود';

export function norm(s) {
  return String(s)
    .replace(/[ً-ْـٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[،؛]/g, ',')
    .replace(/\s+/g, ' ').trim();
}

const has = (s, re) => new RegExp(re).test(s);
const word = (re) => `(?:^| )(?:${re})(?= |$)`;

function splitCommands(orig) {
  // نفصل الأوامر المركبة: «شيل الثاني وخل الانتقالات تلاشي ثم شغله»
  const parts = [];
  for (const chunk of orig.split(/[,.\n]|(?:\s+ثم\s+)|(?:\s+وبعدين\s+)|(?:\s+وبعد كذا\s+)/)) {
    const n = norm(chunk);
    if (!n) continue;
    // تقسيم عند «و + فعل»
    const words = chunk.trim().split(/\s+/);
    let cur = [];
    for (const w of words) {
      const nw = norm(w);
      if (cur.length && new RegExp(`^و(?:${VERBS})`).test(nw) && !/^(وقف|ورا|وسط)/.test(nw)) {
        parts.push(cur.join(' '));
        cur = [w.replace(/^و/, '')];
      } else cur.push(w);
    }
    if (cur.length) parts.push(cur.join(' '));
  }
  return parts;
}

function targetOf(s, { plural = 'all' } = {}) {
  const num = (x) => (x == null ? null : ORD[x] ?? (/^\d+$/.test(x) ? +x : null));
  const ordRe = '(\\d+(?!\\s*(?:ث|ثاني|ثوان|sec|%))|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|اول|ثاني|ثالث|رابع|خامس|الاخير|اخير)';
  let m;
  if (has(s, 'كل صوره|كل الصور|كل صور')) return 'images';
  if ((m = s.match(new RegExp(`(?:المشهد|مشهد|المقطع|مقطع|اللقطه|لقطه|الشريحه|رقم)\\s*(?:رقم\\s*)?${ordRe}`)))) return /اخير/.test(m[1]) ? 'clip:last' : `clip:${num(m[1])}`;
  if ((m = s.match(new RegExp(`(?:الصوره|صوره)\\s*(?:رقم\\s*)?${ordRe}`)))) return /اخير/.test(m[1]) ? 'image:last' : `image:${num(m[1])}`;
  if ((m = s.match(new RegExp(`(?:الفيديو|فيديو)\\s*(?:رقم\\s*)?${ordRe}`)))) return /اخير/.test(m[1]) ? 'video:last' : `video:${num(m[1])}`;
  if ((m = s.match(new RegExp(`${ordRe}\\s*(?:مشهد|مقطع|صوره|فيديو)`)))) return `clip:${num(m[1]) || 1}`;
  if (has(s, 'اخر مشهد|المشهد الاخير|الاخير')) return 'clip:last';
  if ((m = s.match(/(?:^| )(الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)(?= |$)/)) && !has(s, 'الدرس|عنوان')) return `clip:${ORD[m[1]]}`;
  if (has(s, 'اول مشهد|المشهد الاول|البدايه')) return null;
  if (has(s, '(كل|جميع) الصور|الصور كلها|الصور كلهم|على الصور') || /(^| )الصور( |$)/.test(s)) return 'images';
  if (has(s, '(كل|جميع) (الفيديوهات|المقاطع|الفيديو)|الفيديوهات|المقاطع كلها')) return 'videos';
  if (has(s, '(^| )(كل|جميع|الكل|كلها|كلهم|كامل)( |$)|الانتقالات|المشاهد')) return plural;
  if (has(s, 'هذا|هذي|هذه|هاذا|المحدد|اللي محدد|هنا|الحين')) return 'selected';
  return null;
}

const TR = [
  ['none', 'بدون انتقال|قطع مباشر|بلا انتقال|شيل الانتقال|بدون انتقالات|شيل الانتقالات|قطع عادي'],
  ['fade', 'تلاشي|ذوبان|يذوب|fade|ناعم'],
  ['zoom', 'زوم|تقريب'],
  ['slide-l', 'انزلاق|سلايد|ينزلق|يسحب'],
  ['push-r', 'دفع|يدفع'],
  ['wipe-l', 'مسح|ممسوح'],
  ['circle', 'دائر|دايره'],
  ['blur', 'ضباب|بلور|blur'],
  ['spin', 'دوران|يلف|لف'],
  ['black', 'اسود|سواد|عتمه|الاسود'],
  ['white', 'ابيض|وميض|فلاش'],
];
const FILTER = [
  ['none', 'بدون فلتر|شيل الفلتر|الوان اصليه|الالوان الاصليه|بدون الوان'],
  ['bw', 'ابيض واسود|ابيض و اسود|اسود وابيض|رمادي|بدون الوان'],
  ['warm', 'دافي|دافئ|دفا'],
  ['cool', 'بارد|برود'],
  ['gold', 'ذهبي'],
  ['soft', 'ناعم'],
  ['cinematic', 'سينمائي|سينما'],
  ['vivid', 'حيوي|زاهي|مشبع'],
];
const COLORS = { 'احمر': '#ff4d4d', 'اصفر': '#f5c451', 'ذهبي': '#e3b65c', 'ابيض': '#ffffff', 'اسود': '#111111', 'ازرق': '#4da3ff', 'اخضر': '#2ecc71', 'بنفسجي': '#8b7bff', 'وردي': '#ff7ab6', 'برتقالي': '#ff9f43', 'سماوي': '#5ee6c4' };

function secs(s) {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:ث|ثانيه|ثواني|ثوان|ثانيتين|sec)/) || s.match(/(ثانيتين|ثانيه وحده|نص ثانيه)/);
  if (!m) return null;
  if (m[1] === 'ثانيتين') return 2;
  if (m[1] === 'ثانيه وحده') return 1;
  if (m[1] === 'نص ثانيه') return 0.5;
  return +m[1];
}

function extractQuoted(orig) {
  const q = orig.match(/[«"“'](.+?)[»"”']/) || orig.match(/[:：]\s*(.+)$/);
  return q ? q[1].trim() : null;
}

function parseOne(orig) {
  const s = norm(orig);
  const T = (o) => targetOf(s, o);
  const fitT = () => { const t = T(); return !t ? (has(s, word('الصور')) ? 'images' : 'selected') : t; };
  const acts = [];

  // تراجع / إعادة / تشغيل / تصدير
  if (/^(تراجع|رجع زي ما كان|رجعه زي ما كان|الغ|الغي|ارجع|رجعها)( (عن )?(اخر|التعديل|الامر)\S*)?$/.test(s) || has(s, '^تراجع')) return [{ type: 'undo' }];
  if (/^(اعد|رجع التعديل|redo)/.test(s)) return [{ type: 'redo' }];
  if (/^(شغل|شغله|شغلها|شغل الفيديو|عرض|اعرض|خلني اشوف|ورني)$/.test(s) || /^(شغل|ورني) (الفيديو|المونتاج|من البدايه)/.test(s)) {
    return has(s, 'البدايه') ? [{ type: 'seek', t: 0 }, { type: 'play' }] : [{ type: 'play' }];
  }
  if (/^(وقف|ايقاف|اوقف|استوب|وقفه)$/.test(s)) return [{ type: 'pause' }];
  if (has(s, 'صدر|تصدير|نزل الفيديو|حمل الفيديو|طلع الفيديو')) return [{ type: 'export' }];
  if (has(s, '^(قص|اقسم|قسم)( هنا| عند المؤشر| المشهد)?$')) return [{ type: 'split' }];

  // فيديو → صوت فقط
  if (has(s, 'صوت بس|صوت فقط|مجرد صوت|صوته بس|بس صوته|صوت بدون صوره|بدون صوره|بدون فيديو|لا يطلع|لا تعرض|لا تخليه يطلع|اخفي الفيديو|خلي صوته')) {
    let t = T();
    if (has(s, 'هذا|هذي|هذه|المحدد')) t = 'selected';
    else if (!t || t === 'all' || t === 'images') t = has(s, 'الفيديوهات|كل الفيديو') ? 'videos' : 'selected';
    return [{ type: 'to_audio', target: t, role: has(s, 'خلفيه|نشيد') ? 'bg' : 'voice' }];
  }

  // الصوت: الخلفية والتعليق
  const audioTarget = has(s, 'الخلفيه|النشيد|الاناشيد|خلفيه صوتيه') ? 'bg' : has(s, 'التعليق|صوتي|كلامي|تسجيلي') ? 'voice' : null;
  if (audioTarget && !has(s, 'خلفيه ضبابيه|لون الخلفيه')) {
    if (has(s, 'على (كامل|طول) (الفيديو|المونتاج)|مده على|مد |طوله|طولها') && !has(s, 'الصور')) return [{ type: 'stretch_audio', target: audioTarget }];
    if (has(s, 'وقت الكلام|تحت الكلام|لما اتكلم')) return [{ type: 'mix', set: { ducking: !has(s, 'لا تنزل|بدون'), duckLevel: 0.2 } }];
    if (has(s, 'ارفع|علي|زود|اعلى|عالي')) return [{ type: 'audio', target: audioTarget, set: { volMul: 1.4 } }];
    if (has(s, 'نزل|وطي|خفض|قلل|اهدا|هادي|واطي|اوطي')) return [{ type: 'audio', target: audioTarget, set: { volMul: 0.6 } }];
    if (has(s, 'كتم|اكتم|بدون صوت|اسكت')) return [{ type: 'audio', target: audioTarget, set: { volume: 0 } }];
    if (has(s, 'شيل|احذف|امسح')) return [{ type: 'delete', target: audioTarget }];
    if (has(s, 'تدريج|بهدوء|يدخل')) return [{ type: 'audio', target: audioTarget, set: { fadeIn: 2, fadeOut: 2.5 } }];
  }
  if (has(s, 'طابق|على طول (الصوت|الخلفيه|النشيد)|مده الصور على')) return [{ type: 'fit_audio' }];
  if (has(s, 'صوت (ال)?انتقال|ووش|whoosh')) return [{ type: 'mix', set: { whoosh: !has(s, 'شيل|بدون|لا|الغ|اوقف') } }];

  // كتم صوت الفيديو
  if (has(s, 'اكتم|كتم|بدون صوت|بلا صوت|شيل الصوت|اسكت|امسح الصوت')) {
    let t = T() || 'selected';
    if (t === 'all') t = 'videos';
    return [{ type: 'clip', target: t, set: { muted: true } }];
  }
  if (has(s, 'رجع الصوت|شغل الصوت|خل الصوت|فك الكتم')) return [{ type: 'clip', target: T() || 'selected', set: { muted: false } }];

  // المقاس
  const asp = has(s, 'ريلز|طولي|ستوري|تيك توك|تيكتوك|9[:/]16|عمودي') ? '9:16' : has(s, 'عرضي|يوتيوب|16[:/]9|افقي|بالعرض') ? '16:9' : has(s, 'مربع|1[:/]1') ? '1:1' : has(s, '4[:/]5') ? '4:5' : null;
  if (asp && has(s, 'مقاس|خله|خلي|حوله|حولي|اجعل|سو|غير|ابي|ابغى|^ريلز|^يوتيوب|^مربع')) return [{ type: 'project', set: { aspect: asp } }];

  // النصوص
  const isText = has(s, word('عنوان|العنوان|نص|النص|النصوص|كتابه|الكتابه|كابشن|الكابشن|ايه|الايه|اقتباس|اسمي|اكتب|الخط'));
  if (has(s, '^(اكتب|حط|اضف|ضيف|ابي|ابغى|سو)') && isText && !has(s, '^(حط|اضف|ضيف) (انتقال|فلتر|حركه)')) {
    const preset = has(s, 'كابشن|ترجمه') ? 'caption' : has(s, word('ايه|الايه|اقتباس|حديث')) ? 'quote' : has(s, 'اسمي|شريط|اسم') ? 'lower' : has(s, 'بطاقه|افتتاح|مقدمه') ? 'card' : 'title';
    let text = extractQuoted(orig);
    if (!text) {
      const m = orig.match(/(?:عنوان|عنوانا|نصاً|نص|كتابة|كتابه|كابشن|آية|اية|اقتباس|اسمي|اسم)\s+(?:يقول\s+|فيه\s+|مكتوب\s+)?(.+)$/);
      text = m ? m[1] : null;
    }
    if (text) text = text.replace(/\s*(في|ب|على)\s*(ال)?(بداي[ةه]|نهاي[ةه]|آخر|اخر|أول|اول)\s*(ال)?(فيديو|مونتاج)?\s*$/, '').trim();
    const at = has(s, 'البدايه|بالبدايه|اول الفيديو|في البدايه|مقدمه') ? 'start' : has(s, 'النهايه|بالنهايه|اخر الفيديو|الختام|خاتمه') ? 'end' : 'current';
    const dur = secs(s);
    return [{ type: 'text_add', text: text || undefined, preset, at, ...(dur ? { dur } : {}) }];
  }
  if (isText && !has(s, 'انتقال')) {
    const t = T({ plural: 'text:all' }) || 'selected';
    const tt = t.startsWith('clip:') ? t.replace('clip', 'text') : t === 'all' || t === 'images' ? 'text:all' : t;
    const set = {};
    const nt = extractQuoted(orig);
    if (nt && has(s, 'غير|خل|عدل|بدل')) set.text = nt;
    if (has(s, 'كبر')) set.sizeMul = 1.25;
    if (has(s, 'صغر')) set.sizeMul = 0.8;
    for (const [k, v] of Object.entries(COLORS)) if (s.includes(k)) { set.color = v; break; }
    if (has(s, 'فوق|اعلى|بالاعلى')) set.y = 0.16;
    else if (has(s, 'الوسط|بالنص|في النص|وسط')) set.y = 0.5;
    else if (has(s, 'تحت|اسفل|بالاسفل|تحتي')) set.y = 0.82;
    const d = secs(s);
    if (d) set.dur = d;
    if (has(s, 'كلمه كلمه')) set.anim = 'words';
    if (has(s, 'كاريوكي|تتلون')) set.anim = 'karaoke';
    if (has(s, 'يطيح|سقوط')) set.anim = 'drop';
    if (has(s, 'يقفز|قفزه|نط')) set.anim = 'pop';
    if (has(s, 'شيل|احذف|امسح')) return [{ type: 'delete', target: tt === 'selected' ? 'selected' : tt }];
    if (Object.keys(set).length) return [{ type: 'text', target: tt, set }];
  }

  // الحذف
  if (has(s, '^(شيل|احذف|امسح|اشطب|ازل|شيلي|احذفه|شيله|شيلها|احذفها)') && !has(s, 'الحركه|الفلتر|الانتقال|الصوت|الزوم|الاطار')) {
    return [{ type: 'delete', target: T() || 'selected' }];
  }

  // الإطار الداكن
  if (has(s, 'اطار داكن|فينيت|حواف داكنه|ظل على الاطراف')) return [{ type: 'project', set: { vignette: !has(s, 'شيل|بدون|الغ') } }];

  // النقل
  if (has(s, '^(قدم|اخر|انقل|حط|رجع) (المشهد|الصوره|الفيديو|هذا|هذي)') || has(s, '^(قدمه|اخره|انقله)')) {
    const t = T() || 'selected';
    let to = null;
    if (has(s, 'البدايه|اول|الاول|قبل الكل')) to = 'first';
    if (has(s, 'النهايه|الاخير|اخر|بعد الكل')) to = 'last';
    const m = s.match(/(?:مكان|رقم|بعد|قبل|الى|ل)\s*(?:المشهد\s*)?(\d+|الثاني|الثالث|الرابع|الخامس|السادس)/);
    if (m) to = ORD[m[1]] ?? +m[1];
    if (to == null && has(s, '^قدم')) return [{ type: 'move', target: t, to: 'first' }];
    if (to == null && has(s, '^اخر')) return [{ type: 'move', target: t, to: 'last' }];
    if (to != null) return [{ type: 'move', target: t, to }];
  }
  if (has(s, '^(كرر|كرره|كررها|نسخ|انسخ|دبل)')) return [{ type: 'duplicate', target: T() || 'selected' }];

  // الملاءمة والتكبير
  if (has(s, 'ملء الشاشه|املا الشاشه|كامل الشاشه|ملي الشاشه|عبي الشاشه|فل سكرين')) return [{ type: 'clip', target: fitT(), set: { fit: 'cover' } }];
  if (has(s, 'لا تقص|بدون قص|كامله|خلفيه ضبابيه|تبان كامله|يبان كامل')) return [{ type: 'clip', target: fitT(), set: { fit: 'blur' } }];

  // القوالب والفلاتر
  const filterCtx = has(s, 'فلتر|لون|الوان|الالوان');
  const explicit = T();
  const clipTarget = explicit && explicit !== 'all' ? explicit : null;
  const style = has(s, 'سينمائي|سينما') ? 'cinema' : has(s, word('هادي|هاديه|درس|تعليمي|الدرس')) ? 'calm' : has(s, word('حيوي|ريل|حماسي|حماس')) ? 'reel' : has(s, word('قصه|القصه|وثائقي|حكايه')) ? 'story' : has(s, 'بدون تاثيرات|بدون مؤثرات|' + word('عادي|خام')) ? 'clean' : null;
  if (style && !filterCtx && !clipTarget && !has(s, 'انتقال')) return [{ type: 'style', name: style }];
  if (filterCtx || clipTarget) {
    const f = FILTER.find(([, re]) => has(s, re));
    if (f) return [{ type: 'clip', target: clipTarget || (explicit === 'all' ? 'all' : filterCtx && !explicit ? 'all' : 'selected'), set: { filter: f[0] } }];
  }

  // الانتقالات
  const trCtx = has(s, 'انتقال|تلاشي|ذوبان|يذوب|انزلاق|سلايد|وميض|فلاش|يدخل|يطلع|بين المشاهد|بين الصور');
  if (trCtx) {
    if (has(s, 'متنوع|منوع|مختلف|عشوائي|كل واحد شكل')) {
      return [{ type: 'transition', target: 'all', kind: 'varied' }];
    }
    const k = TR.find(([, re]) => has(s, re));
    let dur = secs(s);
    if (!dur && has(s, 'اسرع|سريع')) dur = 0.35;
    if (!dur && has(s, 'ابطا|ابطئ|بطي|اطول|هادي')) dur = 1.2;
    let t = T() || (has(s, 'هذا|هذي|المحدد') ? 'selected' : 'all');
    const btw = s.match(/بين (?:المشهد |الصوره |الفيديو )?(\S+) و\s*(?:المشهد |الصوره |الفيديو )?(\S+)/);
    if (btw) { const a = ORD[btw[1]] ?? +btw[1], b = ORD[btw[2]] ?? +btw[2]; if (a && b) t = `clip:${Math.max(a, b)}`; }
    if (k || dur) return [{ type: 'transition', target: t, ...(k ? { kind: k[0] } : {}), ...(dur ? { dur } : {}) }];
  }


  // الحركة
  if (has(s, 'حرك|حركه|كين برنز|زوم بطي|تتحرك|يتحرك|ثابت|ثابته')) {
    let t = T() || (has(s, 'الصور') ? 'images' : 'selected');
    let motion = 'zoom-in';
    if (has(s, 'ثابت|بدون حركه|شيل الحركه|وقف الحركه|لا تحرك|بلا حركه')) motion = 'none';
    else if (has(s, 'بعد|ابعاد|زوم اوت|يبعد|للخلف')) motion = 'zoom-out';
    else if (has(s, 'يمين')) motion = 'pan-r';
    else if (has(s, 'يسار')) motion = 'pan-l';
    else if (has(s, 'فوق|للاعلى|اعلى')) motion = 'pan-u';
    else if (has(s, 'تحت|للاسفل|اسفل')) motion = 'pan-d';
    else if (t === 'images' || t === 'all') motion = 'auto';
    return [{ type: 'clip', target: t, set: { motion } }];
  }

  // السرعة
  if (has(s, 'سرع|اسرع|سريع|بطي|ابطا|ابطئ|سلو|بطء|بطيء')) {
    let t = T() || 'selected';
    if (t === 'all') t = 'videos';
    const fast = has(s, 'سرع|اسرع|سريع') && !has(s, 'بطي|ابطا|سلو');
    const speed = fast ? (has(s, 'شوي|شوية|قليل') ? 1.5 : 2) : (has(s, 'شوي|شوية|قليل') ? 0.75 : 0.5);
    return [{ type: 'clip', target: t, set: { speed, durMul: fast ? 0.67 : 1.5 } }];
  }

  // التكبير
  if (has(s, '^(كبر|قرب|زوم)')) return [{ type: 'clip', target: T() || 'selected', set: { zoom: 1.3 } }];
  if (has(s, '^(صغر|رجع الحجم)')) return [{ type: 'clip', target: T() || 'selected', set: { zoom: 1 } }];

  // المدة
  const d = secs(s);
  if (d && has(s, 'مده|مدت|خل|خلي|طول|ثانيه|ثواني')) {
    let t = T() || (has(s, 'الصور|كل صوره|كل الصور') ? 'images' : 'selected');
    if (t === 'all') t = 'images';
    return [{ type: 'clip', target: t, set: { dur: d } }];
  }
  if (has(s, '^(طول|طوله|طولها|اطول)')) return [{ type: 'clip', target: T() || 'selected', set: { durMul: 1.5 } }];
  if (has(s, '^(قصر|قصره|قصرها|اقصر)')) return [{ type: 'clip', target: T() || 'selected', set: { durMul: 0.67 } }];

  // فلتر بدون تحديد
  const f = FILTER.find(([, re]) => has(s, re));
  if (f && filterCtx) return [{ type: 'clip', target: 'all', set: { filter: f[0] } }];
  if (style) return [{ type: 'style', name: style }];
  return acts.length ? acts : null;
}

export function parseCommand(text) {
  const parts = splitCommands(text);
  const actions = [];
  const unknown = [];
  for (const p of parts) {
    const a = parseOne(p);
    if (a) actions.push(...a); else unknown.push(p);
  }
  return { actions, unknown };
}
