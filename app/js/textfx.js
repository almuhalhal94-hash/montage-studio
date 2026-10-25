// النصوص العربية المتحركة: تخطيط الكلمات من اليمين لليسار، الحركات، الزخارف

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export const ease = {
  out: (p) => 1 - Math.pow(1 - p, 3),
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  bounce: (p) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};
const c01 = (v) => Math.min(1, Math.max(0, v));

export const TEXT_ANIMS = {
  words: 'كلمة كلمة', karaoke: 'كاريوكي', highlight: 'تلوين الكلمة', rise: 'صعود', pop: 'قفزة',
  fade: 'ظهور', blur: 'ضبابي', wipe: 'مسح', drop: 'سقوط', typewriter: 'آلة كاتبة', none: 'بدون',
};
export const TEXT_BOXES = { none: 'بدون', pill: 'خلفية لكل سطر', block: 'بطاقة', bar: 'شريط سفلي' };
export const TEXT_DECOS = { none: 'بدون', lines: 'خطوط', star: 'نجمة إسلامية', frame: 'إطار زوايا' };
export const FONTS = ['Cairo', 'Tajawal', 'Amiri', 'El Messiri', 'Reem Kufi', 'Readex Pro', 'Noto Kufi Arabic', 'Lalezar', 'Marhey', 'Changa', 'Aref Ruqaa'];

const fontStr = (it, px) => `${it.weight || 700} ${px}px "${it.font || 'Cairo'}", "Cairo", sans-serif`;

function layout(ctx, text, maxW, rtl) {
  const paras = String(text || '').split('\n');
  const space = ctx.measureText(' ').width;
  const lines = [];
  let gi = 0;
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = [];
    let curW = 0;
    const flush = () => { if (cur.length) lines.push({ words: cur, width: curW }); cur = []; curW = 0; };
    for (const w of words) {
      const ww = ctx.measureText(w).width;
      const add = cur.length ? space + ww : ww;
      if (cur.length && curW + add > maxW) flush();
      cur.push({ w, width: ww, i: gi++ });
      curW += cur.length > 1 ? space + ww : ww;
    }
    flush();
  }
  for (const ln of lines) {
    let acc = 0;
    for (const wd of ln.words) {
      wd.x = rtl ? ln.width - acc - wd.width : acc;
      acc += wd.width + space;
    }
  }
  return lines;
}

// توقيت الكلمات: من Whisper إن وجد، وإلا توزيع بحسب طول الكلمة
function wordTimes(item, count, dur) {
  if (Array.isArray(item.words) && item.words.length === count) return item.words;
  const tokens = String(item.text || '').split(/\s+/).filter(Boolean);
  const anim = item.anim;
  if (anim === 'karaoke' || anim === 'highlight') {
    const total = tokens.reduce((s, w) => s + w.length + 1, 0) || 1;
    const span = Math.max(0.2, dur - 0.15);
    let acc = 0;
    return tokens.map((w) => { const s = (acc / total) * span; acc += w.length + 1; return { s, e: (acc / total) * span }; });
  }
  const step = Math.min(0.14, (dur * 0.45) / Math.max(1, count));
  return tokens.map((_, i) => ({ s: i * step, e: i * step + 0.4 }));
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function star8(ctx, cx, cy, r, rot, progress) {
  // نجمة ثمانية (خاتم سليمان) من مربعين متداخلين
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 === 0 ? r : r * 0.72;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const n = Math.max(1, Math.floor(pts.length * progress));
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k <= n; k++) ctx.lineTo(pts[k % 16][0], pts[k % 16][1]);
  if (progress >= 1) ctx.closePath();
  ctx.stroke();
  if (progress >= 1) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawText(ctx, item, lt, W, H, opts = {}) {
  const dur = Math.max(0.1, item.dur);
  if (lt < 0 || lt > dur) return;
  const base = Math.min(W, H);
  const px = Math.round((item.size || 0.07) * base);
  const rtl = ARABIC.test(item.text || '');
  ctx.save();
  ctx.font = fontStr(item, px);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  const maxW = (item.width || 0.86) * W;
  const lines = layout(ctx, item.text, maxW, rtl);
  const lineH = px * 1.38;
  const subPx = Math.round(px * 0.5);
  const hasSub = !!(item.sub && item.sub.trim());
  const blockH = lines.length * lineH + (hasSub ? subPx * 1.7 : 0);
  const cx = (item.x ?? 0.5) * W;
  const cy = (item.y ?? 0.5) * H;
  const top = cy - blockH / 2;
  const blockW = Math.max(...lines.map((l) => l.width), 1);

  // دخول وخروج للكتلة كاملة
  const anim = item.anim || 'fade';
  const pin = c01(lt / 0.45);
  const outT = item.out === 'none' ? 1 : c01((dur - lt) / 0.3);
  let alpha = outT;
  let ty = (1 - outT) * -px * 0.25;
  let scale = 1;
  if (anim === 'fade') alpha *= ease.out(pin);
  if (anim === 'rise') { alpha *= ease.out(pin); ty += (1 - ease.out(pin)) * px * 0.7; }
  if (anim === 'pop') { const e = ease.back(c01(lt / 0.4)); scale = 0.55 + 0.45 * e; alpha *= c01(lt / 0.15); }
  if (anim === 'blur') alpha *= ease.out(c01(lt / 0.7));

  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + ty);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  if (anim === 'blur' && opts.filterOk) {
    const b = (1 - ease.out(c01(lt / 0.8))) * px * 0.25;
    if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`;
  }

  const accent = item.accent || '#f5c451';
  const pad = px * 0.35;

  // الخلفيات
  if (item.box === 'block') {
    const p = ease.out(c01(lt / 0.5));
    const bw = (blockW + pad * 4) * (0.85 + 0.15 * p);
    const bh = blockH + pad * 2.4;
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.fillStyle = hexA(item.boxColor || '#000000', 0.55);
    roundRect(ctx, cx - bw / 2, top - pad * 1.2, bw, bh, px * 0.35);
    ctx.fill();
    ctx.restore();
  }
  if (item.box === 'bar') {
    const p = ease.out(c01(lt / 0.55));
    const bw = (blockW + pad * 3) * p;
    const bh = blockH + pad * 1.6;
    const right = cx + (blockW + pad * 3) / 2;
    ctx.save();
    ctx.fillStyle = hexA(item.boxColor || '#000000', 0.62);
    if (rtl) roundRect(ctx, right - bw, top - pad * 0.8, bw, bh, px * 0.18);
    else roundRect(ctx, cx - (blockW + pad * 3) / 2, top - pad * 0.8, bw, bh, px * 0.18);
    ctx.fill();
    ctx.fillStyle = accent;
    const barX = rtl ? right - px * 0.12 : cx - (blockW + pad * 3) / 2;
    ctx.fillRect(barX, top - pad * 0.8, px * 0.12, bh * ease.out(c01(lt / 0.35)));
    ctx.restore();
  }

  // الزخارف
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineCap = 'round';
  if (item.deco === 'lines') {
    const p = ease.inOut(c01((lt - 0.1) / 0.7));
    const lw = Math.min(blockW * 0.5, W * 0.3) * p;
    ctx.lineWidth = Math.max(2, px * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - lw, top - px * 0.35); ctx.lineTo(cx + lw, top - px * 0.35);
    ctx.moveTo(cx - lw, top + blockH + px * 0.05); ctx.lineTo(cx + lw, top + blockH + px * 0.05);
    ctx.stroke();
  }
  if (item.deco === 'star') {
    ctx.lineWidth = Math.max(2, px * 0.05);
    const p = ease.out(c01(lt / 1.1));
    star8(ctx, cx, top - px * 0.95, px * 0.55, lt * 0.25, p);
  }
  if (item.deco === 'frame') {
    const p = ease.out(c01((lt - 0.15) / 0.6));
    const fw = blockW / 2 + pad * 2.6;
    const fh = blockH / 2 + pad * 1.9;
    const mid = top + blockH / 2;
    const arm = px * 0.7 * p;
    ctx.lineWidth = Math.max(2, px * 0.06);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + sx * fw;
      const y = mid + sy * fh;
      ctx.moveTo(x - sx * arm, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * arm);
    }
    ctx.stroke();
  }
  ctx.restore();

  // الكلمات
  const allWords = lines.flatMap((l) => l.words);
  const times = wordTimes(item, allWords.length, dur);
  const strokeW = px * 0.13;
  let activeIdx = -1;
  if (anim === 'karaoke' || anim === 'highlight') {
    for (let k = 0; k < times.length; k++) if (lt >= times[k].s) activeIdx = k;
  }
  const wipeP = anim === 'wipe' ? ease.inOut(c01(lt / 0.7)) : 1;

  lines.forEach((ln, li) => {
    const baseY = top + li * lineH + px * 1.02;
    const left = cx - ln.width / 2;
    if (item.box === 'pill') {
      const p = ease.out(c01(lt / 0.4));
      ctx.save();
      ctx.globalAlpha *= p;
      ctx.fillStyle = item.boxColor || '#ffffff';
      roundRect(ctx, left - pad, baseY - px * 1.0, ln.width + pad * 2, px * 1.32, px * 0.28);
      ctx.fill();
      ctx.restore();
    }
    if (anim === 'wipe') {
      ctx.save();
      ctx.beginPath();
      const ww = (ln.width + pad * 2) * wipeP;
      if (rtl) ctx.rect(left + ln.width + pad - ww, baseY - lineH, ww, lineH * 1.3);
      else ctx.rect(left - pad, baseY - lineH, ww, lineH * 1.3);
      ctx.clip();
    }
    for (const wd of ln.words) {
      const tm = times[wd.i] || { s: 0, e: dur };
      let wa = 1, wy = 0, ws = 1;
      let color = item.color || '#ffffff';
      if (anim === 'words') {
        const p = c01((lt - tm.s) / 0.35);
        wa = ease.out(p); wy = (1 - ease.out(p)) * px * 0.45;
      } else if (anim === 'drop') {
        const p = c01((lt - tm.s * 1.4) / 0.6);
        wa = c01(p * 3); wy = -(1 - ease.bounce(p)) * px * 1.4;
      } else if (anim === 'typewriter') {
        wa = lt >= tm.s * 1.3 ? 1 : 0;
      } else if (anim === 'karaoke') {
        if (wd.i === activeIdx) { color = accent; ws = 1 + 0.1 * (1 - c01((lt - tm.s) / 0.25)); }
        else if (wd.i > activeIdx) wa = 0.55;
      } else if (anim === 'highlight') {
        if (wd.i > activeIdx) wa = 0.5;
      }
      if (wa <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha *= wa;
      const wx = left + wd.x;
      const wcx = wx + wd.width / 2;
      ctx.translate(wcx, baseY - px * 0.35 + wy);
      ctx.scale(ws, ws);
      ctx.translate(-wcx, -(baseY - px * 0.35));
      if (anim === 'highlight' && wd.i === activeIdx) {
        const p = ease.back(c01((lt - tm.s) / 0.22));
        ctx.save();
        ctx.fillStyle = accent;
        const hw = (wd.width + px * 0.36) * (0.7 + 0.3 * p);
        roundRect(ctx, wcx - hw / 2, baseY - px * 0.98, hw, px * 1.26, px * 0.22);
        ctx.fill();
        ctx.restore();
      }
      if (item.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.05; }
      if (item.stroke) {
        ctx.lineWidth = strokeW; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(wd.w, wx, baseY);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = color;
      ctx.fillText(wd.w, wx, baseY);
      ctx.restore();
    }
    if (anim === 'wipe') ctx.restore();
  });

  // السطر الفرعي
  if (hasSub) {
    const p = ease.out(c01((lt - 0.3) / 0.5));
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.font = fontStr({ ...item, weight: 500 }, subPx);
    ctx.textAlign = 'center';
    ctx.direction = ARABIC.test(item.sub) ? 'rtl' : 'ltr';
    if (item.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = subPx * 0.3; }
    ctx.fillStyle = item.box === 'pill' ? item.color : (item.box === 'bar' ? accent : hexA(item.color || '#ffffff', 0.85));
    ctx.fillText(item.sub, cx, top + lines.length * lineH + subPx * 1.25 + (1 - p) * subPx * 0.5);
    ctx.restore();
  }
  ctx.restore();
}

export function fontsOf(project) {
  const set = new Set(['Cairo']);
  for (const t of project.texts) set.add(`${t.weight || 700}|${t.font || 'Cairo'}`);
  return [...set];
}

export async function loadFonts(project) {
  if (!document.fonts) return;
  const jobs = [];
  for (const t of project.texts) {
    jobs.push(document.fonts.load(`${t.weight || 700} 40px "${t.font || 'Cairo'}"`, t.text || 'ا'));
    if (t.sub) jobs.push(document.fonts.load(`500 40px "${t.font || 'Cairo'}"`, t.sub));
  }
  await Promise.allSettled(jobs);
}
