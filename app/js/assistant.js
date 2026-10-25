// المساعد: تكتب أو تتكلم، وينفّذ الأوامر على المشروع
import { h, toast } from './dom.js';
import { parseCommand } from './nlu.js';
import { runActions, describeProject, ACTION_DOCS } from './actions.js';

const KEY_STORE = 'montage.geminiKey';
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
const setKey = (v) => { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch {} };

const SYSTEM = `أنت «مساعد المونتاج» داخل تطبيق مونتاج عربي يستخدمه معلم (أ. طلال) لا يعرف المونتاج.
يكلمك بالعربي أو باللهجة الخليجية، وأنت تحوّل طلبه إلى أفعال JSON ينفذها التطبيق.
أرجع دائماً JSON فقط بهذا الشكل: {"reply":"رد قصير ودود باللهجة الخليجية","actions":[...]}
- استخدم فقط الأفعال والقيم المذكورة أدناه. لا تخترع أفعالاً.
- «هذا/هذي/المحدد» = "selected". إذا ما فيه تحديد ولم يذكر رقماً استخدم "current".
- الترقيم يبدأ من 1 بالترتيب الظاهر في حالة المشروع.
- إذا كان الطلب غامضاً فعلاً، اسأله سؤالاً قصيراً في reply واجعل actions فارغة.
- إذا طلب شيئاً غير ممكن، قل له بصراحة واقترح البديل الأقرب.
- لا تقترح موسيقى أو إيقاعاً؛ الخلفية الصوتية عنده نشيد بدون إيقاع أو أذكار.
- للطلبات العامة («سوّه احترافي»، «خله حلو») اختر قالباً مناسباً مع حركة للصور وانتقالات، واشرح باختصار ما فعلت.
${ACTION_DOCS}`;

async function askGemini(key, command, context, history) {
  const contents = [...history, { role: 'user', parts: [{ text: `حالة المشروع الآن:\n${context}\n\nطلب المستخدم: ${command}` }] }];
  let lastErr;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    }).catch((e) => { lastErr = e; return null; });
    if (!r) continue;
    if (r.status === 404) { lastErr = new Error('model'); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || `HTTP ${r.status}`;
      if (r.status === 400 && /API key/i.test(msg)) throw new Error('KEY');
      if (r.status === 403) throw new Error('KEY');
      if (r.status === 429) throw new Error('QUOTA');
      lastErr = new Error(msg);
      continue;
    }
    const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('رد غير مفهوم');
    return JSON.parse(m[0]);
  }
  throw lastErr || new Error('تعذر الاتصال');
}

const EXAMPLES = [
  'خلّه سينمائي', 'خل كل الانتقالات تلاشي', 'حرّك الصور ببطء', 'شيل المشهد الثاني',
  'هذا الفيديو خلّه صوت بس', 'حط عنوان في البداية: الدرس الأول', 'خل كل صورة 3 ثواني', 'نزّل صوت الخلفية',
];

export class Assistant {
  constructor(app) {
    this.app = app;
    this.history = [];
    this.busy = false;
    this.build();
  }

  build() {
    const fab = h('button', { class: 'ai-fab', title: 'المساعد — قل له وش تبي ( / )', 'aria-label': 'المساعد', onclick: () => this.toggle() },
      h('span', { html: '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>', style: { display: 'contents' } }),
      h('b', {}, 'المساعد'));
    document.getElementById('previewWrap').append(fab);

    this.list = h('div', { class: 'ai-list' });
    this.input = h('textarea', { class: 'ai-input', rows: 1, placeholder: 'قل وش تبي… مثل: خلّه سينمائي', dir: 'auto' });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      e.stopPropagation();
    });
    this.input.addEventListener('input', () => { this.input.style.height = 'auto'; this.input.style.height = Math.min(120, this.input.scrollHeight) + 'px'; });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.mic = SR ? h('button', { class: 'ai-mic', title: 'تكلّم', 'aria-label': 'تكلّم', onclick: () => this.listen() },
      h('span', { html: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>', style: { display: 'contents' } })) : null;
    const sendBtn = h('button', { class: 'ai-send', 'aria-label': 'إرسال', onclick: () => this.send() },
      h('span', { html: '<svg viewBox="0 0 24 24"><path d="M20 4L3 11l7 2 2 7z"/></svg>', style: { display: 'contents' } }));
    this.status = h('small', {});
    this.panel = h('section', { class: 'ai-panel', hidden: true },
      h('header', {},
        h('div', {}, h('b', {}, '✨ المساعد'), this.status),
        h('button', { class: 'icon-btn sm', title: 'الإعدادات', onclick: () => this.settings() }, h('span', { html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>', style: { display: 'contents' } })),
        h('button', { class: 'icon-btn sm', title: 'إغلاق', onclick: () => this.toggle(false) }, h('span', { html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', style: { display: 'contents' } }))),
      this.list,
      h('div', { class: 'ai-compose' }, this.mic, this.input, sendBtn));
    document.body.append(this.panel);
    this.updateStatus();
    this.welcome();
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.closest('input, textarea, select') && document.getElementById('modal').hidden) { e.preventDefault(); this.toggle(true); }
    });
  }

  updateStatus() {
    this.status.textContent = getKey() ? 'Gemini ✓ يفهم أي صياغة' : 'الوضع المدمج (بدون إنترنت)';
  }

  toggle(open = this.panel.hidden) {
    this.panel.hidden = !open;
    document.body.classList.toggle('ai-open', open);
    if (open) setTimeout(() => this.input.focus(), 50);
    setTimeout(() => this.app.player.resize(), 30);
  }

  welcome() {
    this.list.innerHTML = '';
    this.msg('bot', 'هلا أستاذ طلال 👋 قل لي وش تبي أسوي في المونتاج، بالكتابة أو بالمايك. كل أمر تقدر تتراجع عنه.');
    this.list.append(h('div', { class: 'ai-chips' }, EXAMPLES.map((e) => h('button', { class: 'chip', onclick: () => { this.input.value = e; this.send(); } }, e))));
  }

  msg(who, text, extra) {
    const el = h('div', { class: `ai-msg ${who}` }, h('div', { class: 'bubble' }, text), extra || null);
    this.list.append(el);
    this.list.scrollTop = this.list.scrollHeight;
    return el;
  }

  async send(textArg) {
    const text = (textArg ?? this.input.value).trim();
    if (!text || this.busy) return;
    this.input.value = '';
    this.input.style.height = 'auto';
    this.list.querySelector('.ai-chips')?.remove();
    this.msg('me', text);
    this.busy = true;
    const thinking = this.msg('bot', '…');
    thinking.classList.add('thinking');
    let actions = [];
    let reply = '';
    let unknown = [];
    const key = getKey();
    try {
      if (key) {
        try {
          const res = await askGemini(key, text, describeProject(this.app), this.history.slice(-8));
          actions = Array.isArray(res.actions) ? res.actions : [];
          reply = res.reply || '';
          this.history.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: JSON.stringify(res) }] });
        } catch (e) {
          const why = e.message === 'KEY' ? 'المفتاح غير صحيح — راجعه من الإعدادات ⚙️' : e.message === 'QUOTA' ? 'وصلت حد Gemini المجاني مؤقتاً' : 'ما قدرت أوصل لـ Gemini';
          ({ actions, unknown } = parseCommand(text));
          reply = `(${why} — استخدمت الوضع المدمج)`;
        }
      } else {
        ({ actions, unknown } = parseCommand(text));
      }
      thinking.remove();
      const { done, fail } = actions.length ? runActions(this.app, actions) : { done: [], fail: [] };
      const lines = [];
      if (reply) lines.push(reply);
      if (done.length) lines.push(done.map((d) => '✓ ' + d).join('\n'));
      if (fail.length) lines.push(fail.map((f) => '⚠️ ' + f).join('\n'));
      if (unknown.length) {
        lines.push(`ما فهمت: «${unknown.join('»، «')}»`);
        if (!key) lines.push('جرّب صياغة أبسط مثل الأمثلة، أو فعّل Gemini المجاني من ⚙️ عشان أفهم أي كلام.');
      }
      if (!lines.length) lines.push('ما فهمت الطلب — وضّح لي أكثر.');
      const editing = done.length && actions.some((a) => !['undo', 'redo', 'play', 'pause', 'seek', 'export'].includes(a.type));
      const extra = editing ? h('div', { class: 'ai-actions' },
        h('button', { class: 'chip', onclick: (e) => { this.app.store.undo(); e.currentTarget.disabled = true; e.currentTarget.textContent = 'تم التراجع'; } }, '↶ تراجع'),
        h('button', { class: 'chip', onclick: () => { this.app.player.seek(0); this.app.player.play(); } }, '▶ شغّل')) : null;
      this.msg('bot', lines.join('\n'), extra);
    } catch (e) {
      thinking.remove();
      this.msg('bot', '⚠️ صار خطأ: ' + e.message);
    } finally {
      this.busy = false;
    }
  }

  listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (this.rec) { this.rec.stop(); return; }
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;
    this.rec = rec;
    this.mic.classList.add('on');
    let final = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      this.input.value = (final + ' ' + interim).trim();
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast('اسمح للموقع باستخدام المايك من إعدادات المتصفح', 4000);
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('تعذر التعرف على الصوت', 3000);
    };
    rec.onend = () => {
      this.mic.classList.remove('on');
      this.rec = null;
      if (final.trim()) this.send(final.trim());
    };
    try { rec.start(); } catch { this.mic.classList.remove('on'); this.rec = null; }
  }

  settings() {
    const inp = h('input', { class: 'input', type: 'password', placeholder: 'الصق المفتاح هنا (يبدأ بـ AIza…)', value: getKey(), dir: 'ltr' });
    const test = h('p', { class: 'hint' }, '');
    this.app.openModal(h('div', {},
      h('h2', {}, 'تفعيل Gemini المجاني'),
      h('p', { class: 'sub' }, 'يخلّي المساعد يفهم أي صياغة بلهجتك. مجاني من قوقل ويُحفظ في متصفحك فقط.'),
      h('ol', { class: 'steps' },
        h('li', {}, 'افتح ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener' }, 'aistudio.google.com/apikey'), ' وسجّل دخولك بحساب قوقل.'),
        h('li', {}, 'اضغط ', h('b', {}, 'Create API key'), ' (إنشاء مفتاح).'),
        h('li', {}, 'انسخ المفتاح والصقه تحت، ثم اضغط حفظ.')),
      h('div', { class: 'field' }, inp),
      test,
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'btn primary', onclick: async (e) => {
            const v = inp.value.trim();
            if (!v) return;
            e.currentTarget.disabled = true;
            test.textContent = 'أجرّب المفتاح…';
            try {
              await askGemini(v, 'اختبار: رد بـ {"reply":"تمام","actions":[]}', '(مشروع فارغ)', []);
              setKey(v);
              this.updateStatus();
              this.app.closeModal();
              toast('تم تفعيل Gemini ✓');
              this.msg('bot', 'تم ✓ الحين أفهم أي صياغة. جرّب تقول لي طلبك بكلامك العادي.');
            } catch (err) {
              test.textContent = err.message === 'KEY' ? '⚠️ المفتاح غير صحيح — تأكد إنك نسخته كامل.' : err.message === 'QUOTA' ? '⚠️ المفتاح صحيح لكن الحد المجاني مستنفد مؤقتاً — جرّب بعد دقيقة.' : '⚠️ ما قدرت أتصل: ' + err.message;
            } finally { e.currentTarget.disabled = false; }
          },
        }, 'حفظ وتجربة'),
        getKey() ? h('button', { class: 'btn', onclick: () => { setKey(''); this.updateStatus(); this.app.closeModal(); toast('رجعنا للوضع المدمج'); } }, 'إزالة المفتاح') : null),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'بدون مفتاح؟ المساعد يشتغل بالوضع المدمج ويفهم الأوامر المعتادة.')));
  }
}
