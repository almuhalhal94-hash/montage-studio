// صناعة الكابشن: من نص مكتوب (توزيع على الوقت) أو من كلمات Whisper بتوقيتها
import { newText } from './model.js';

const BREAK = /[.!؟?،,؛:]$/;

export function captionsFromText(text, { start, end, perLine = 4, preset = 'caption' }) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= perLine || BREAK.test(w)) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  const weight = (ln) => ln.join(' ').length + 4;
  const total = lines.reduce((s, ln) => s + weight(ln), 0) || 1;
  const span = end - start;
  let t = start;
  return lines.map((ln) => {
    const d = (weight(ln) / total) * span;
    const item = newText(preset, t);
    item.text = ln.join(' ');
    item.sub = '';
    item.dur = Math.max(0.4, d - 0.02);
    item.out = 'none';
    if (preset === 'subtitle') { item.y = 0.8; item.size = 0.055; item.anim = 'fade'; }
    t += d;
    return item;
  });
}

export function captionsFromWords(words, { perLine = 4, preset = 'caption' }) {
  const lines = [];
  let cur = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
    if (cur.length && (cur.length >= perLine || gap > 0.7)) { lines.push(cur); cur = []; }
    cur.push(w);
    if (BREAK.test(w.w)) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  return lines.map((ln, i) => {
    const s = ln[0].s;
    const next = lines[i + 1]?.[0].s;
    let e = ln[ln.length - 1].e + 0.25;
    if (next != null) e = Math.min(e, next - 0.01);
    const item = newText(preset, Math.max(0, s));
    item.text = ln.map((w) => w.w).join(' ');
    item.sub = '';
    item.dur = Math.max(0.3, e - s);
    item.out = 'none';
    item.words = ln.map((w) => ({ s: w.s - s, e: w.e - s }));
    if (preset === 'subtitle') { item.y = 0.8; item.size = 0.055; item.anim = 'words'; }
    return item;
  });
}
