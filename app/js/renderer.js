// الراسم: يرسم أي لحظة في الفيديو كدالة نقية من الزمن (نفس الراسم للمعاينة والتصدير)
import { layoutClips, dims } from './model.js';
import { drawText, ease } from './textfx.js';

export const TRANSITIONS = {
  none: 'قطع مباشر', fade: 'تلاشي', black: 'عبر الأسود', white: 'وميض أبيض', zoom: 'زوم',
  'slide-r': 'انزلاق لليمين', 'slide-l': 'انزلاق لليسار', 'slide-u': 'انزلاق للأعلى', 'push-r': 'دفع لليمين',
  'wipe-r': 'مسح لليمين', 'wipe-l': 'مسح لليسار', circle: 'دائرة', blur: 'ضبابي', spin: 'دوران',
};
export const MOTIONS = {
  auto: 'تلقائي (كين برنز)', none: 'ثابت', 'zoom-in': 'تقريب بطيء', 'zoom-out': 'إبعاد بطيء',
  'pan-r': 'تحريك لليمين', 'pan-l': 'تحريك لليسار', 'pan-u': 'تحريك للأعلى', 'pan-d': 'تحريك للأسفل',
};
export const FITS = { auto: 'تلقائي', cover: 'ملء الشاشة', blur: 'كامل مع خلفية ضبابية', contain: 'كامل مع خلفية' };
export const FILTERS = {
  none: { label: 'بدون', css: 'none' },
  warm: { label: 'دافئ', css: 'sepia(0.18) saturate(1.15) brightness(1.03)' },
  cool: { label: 'بارد', css: 'saturate(0.95) hue-rotate(-10deg) brightness(1.02)' },
  vivid: { label: 'حيوي', css: 'saturate(1.35) contrast(1.08)' },
  cinematic: { label: 'سينمائي', css: 'contrast(1.12) saturate(0.88) brightness(0.96)' },
  soft: { label: 'ناعم', css: 'brightness(1.05) contrast(0.92) saturate(0.95)' },
  bw: { label: 'أبيض وأسود', css: 'grayscale(1) contrast(1.1)' },
  gold: { label: 'ذهبي', css: 'sepia(0.4) saturate(1.2) contrast(1.05)' },
};
const AUTO_MOTIONS = ['zoom-in', 'pan-l', 'zoom-out', 'pan-r', 'pan-u'];

let FILTER_OK = null;
export function filterSupported() {
  if (FILTER_OK !== null) return FILTER_OK;
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.filter = 'blur(2px)';
    FILTER_OK = c.filter === 'blur(2px)';
  } catch { FILTER_OK = false; }
  return FILTER_OK;
}

// أي مقاطع فيديو مطلوبة في اللحظة t وبأي زمن من المصدر
export function framePlan(project, t, layout = layoutClips(project)) {
  const need = [];
  for (const L of layout) {
    if (L.clip.type !== 'video') continue;
    if (t >= L.start - 1e-6 && t < L.end) {
      const lt = t - L.start;
      need.push({ clipId: L.clip.id, time: Math.min(L.clip.out - 0.001, L.clip.in + lt * (L.clip.speed || 1)) });
    }
  }
  return need;
}

export class Renderer {
  // sources(clip) => { el, w, h } أو null
  constructor(sources) {
    this.sources = sources;
    this.small = document.createElement('canvas');
    this.small.width = 48; this.small.height = 48;
    this.sctx = this.small.getContext('2d');
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');
  }

  draw(ctx, project, t, opts = {}) {
    const { w: W, h: H } = dims(project);
    const scale = opts.scale || 1;
    const layout = opts.layout || layoutClips(project);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = project.bg || '#000';
    ctx.fillRect(0, 0, W, H);

    const active = layout.filter((L) => t >= L.start - 1e-6 && t < L.end);
    if (!active.length && layout.length && t >= layout[layout.length - 1].end - 1e-6) {
      active.push(layout[layout.length - 1]);
    }
    if (active.length === 1) {
      this.drawClip(ctx, project, active[0], t, W, H);
    } else if (active.length >= 2) {
      const A = active[active.length - 2];
      const B = active[active.length - 1];
      const p = B.tr > 0 ? Math.min(1, Math.max(0, (t - B.start) / B.tr)) : 1;
      this.transition(ctx, project, A, B, t, p, W, H, B.clip.transition?.type || 'fade');
    }

    if (project.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const fOk = filterSupported();
    for (const tx of project.texts) {
      if (t >= tx.start && t <= tx.start + tx.dur) drawText(ctx, tx, t - tx.start, W, H, { filterOk: fOk });
    }
    if (opts.safeZones) this.safeZones(ctx, project, W, H);
    ctx.restore();
  }

  drawClip(ctx, project, L, t, W, H) {
    const c = L.clip;
    const src = this.sources(c);
    if (!src || !src.w) return;
    const lt = t - L.start;
    const p = Math.min(1, Math.max(0, lt / L.len));
    const srcAR = src.w / src.h;
    const dstAR = W / H;
    let fit = c.fit || 'auto';
    if (fit === 'auto') fit = Math.abs(srcAR - dstAR) / dstAR > 0.4 ? 'blur' : 'cover';

    let motion = c.motion || 'none';
    if (motion === 'auto') motion = AUTO_MOTIONS[L.index % AUTO_MOTIONS.length];
    const e = ease.inOut(p);
    let s = c.zoom || 1, dx = 0, dy = 0;
    const amp = 0.1;
    if (motion === 'zoom-in') s *= 1 + amp * e;
    if (motion === 'zoom-out') s *= 1 + amp * (1 - e);
    if (motion.startsWith('pan')) s *= 1 + amp;
    const pan = (e - 0.5) * amp;
    if (motion === 'pan-r') dx = pan;
    if (motion === 'pan-l') dx = -pan;
    if (motion === 'pan-u') dy = -pan;
    if (motion === 'pan-d') dy = pan;

    const fOk = filterSupported();
    const filt = FILTERS[c.filter]?.css || 'none';

    if (fit === 'blur' || fit === 'contain') {
      // خلفية: صورة مصغّرة مكبّرة = ضبابية ناعمة تعمل على كل المتصفحات
      if (fit === 'blur') {
        const sc = this.sctx;
        const k = Math.max(48 / src.w, 48 / src.h);
        sc.clearRect(0, 0, 48, 48);
        sc.drawImage(src.el, (48 - src.w * k) / 2, (48 - src.h * k) / 2, src.w * k, src.h * k);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const bs = 1.15;
        ctx.drawImage(this.small, -W * (bs - 1) / 2, -H * (bs - 1) / 2, W * bs, H * bs);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      const k = Math.min(W / src.w, H / src.h) * s;
      const dw = src.w * k, dh = src.h * k;
      ctx.save();
      if (fOk && filt !== 'none') ctx.filter = filt;
      ctx.drawImage(src.el, (W - dw) / 2 + dx * W, (H - dh) / 2 + dy * H, dw, dh);
      ctx.restore();
    } else {
      const k = Math.max(W / src.w, H / src.h) * s;
      const dw = src.w * k, dh = src.h * k;
      let x = (W - dw) / 2 + dx * W;
      let y = (H - dh) / 2 + dy * H;
      x = Math.min(0, Math.max(W - dw, x));
      y = Math.min(0, Math.max(H - dh, y));
      ctx.save();
      if (fOk && filt !== 'none') ctx.filter = filt;
      ctx.drawImage(src.el, x, y, dw, dh);
      ctx.restore();
    }
  }

  transition(ctx, project, A, B, t, p, W, H, type) {
    const e = ease.inOut(p);
    const dA = () => this.drawClip(ctx, project, A, t, W, H);
    const dB = () => this.drawClip(ctx, project, B, t, W, H);
    const withT = (fn, alpha, tx = 0, ty = 0, sc = 1, rot = 0) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2 + tx, H / 2 + ty);
      if (rot) ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -H / 2);
      fn();
      ctx.restore();
    };
    switch (type) {
      case 'fade': dA(); withT(dB, e); break;
      case 'black':
      case 'white': {
        const col = type === 'black' ? '#000' : '#fff';
        if (p < 0.5) dA(); else dB();
        ctx.save();
        ctx.globalAlpha = 1 - Math.abs(p - 0.5) * 2;
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        break;
      }
      case 'zoom': withT(dA, 1 - e, 0, 0, 1 + e * 0.35); withT(dB, e, 0, 0, 0.85 + 0.15 * e); break;
      case 'slide-r': dA(); withT(dB, 1, -(1 - e) * W); break;
      case 'slide-l': dA(); withT(dB, 1, (1 - e) * W); break;
      case 'slide-u': dA(); withT(dB, 1, 0, (1 - e) * H); break;
      case 'push-r': withT(dA, 1, e * W); withT(dB, 1, -(1 - e) * W); break;
      case 'wipe-r':
      case 'wipe-l': {
        dA();
        ctx.save();
        ctx.beginPath();
        if (type === 'wipe-r') ctx.rect(0, 0, W * e, H); else ctx.rect(W * (1 - e), 0, W * e, H);
        ctx.clip();
        dB();
        ctx.restore();
        break;
      }
      case 'circle': {
        dA();
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2);
        ctx.clip();
        dB();
        ctx.restore();
        break;
      }
      case 'blur': {
        if (!filterSupported()) { dA(); withT(dB, e); break; }
        const b = Math.sin(p * Math.PI) * 28;
        ctx.save(); ctx.filter = `blur(${b.toFixed(1)}px)`; dA(); ctx.restore();
        ctx.save(); ctx.globalAlpha = e; ctx.filter = `blur(${b.toFixed(1)}px)`; dB(); ctx.restore();
        break;
      }
      case 'spin': withT(dA, 1 - e, 0, 0, 1 + e * 0.3, e * 0.6); withT(dB, e, 0, 0, 1.3 - 0.3 * e, -(1 - e) * 0.6); break;
      default: dB();
    }
  }

  safeZones(ctx, project, W, H) {
    if (project.aspect !== '9:16') return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,60,60,0.18)';
    ctx.fillRect(0, 0, W, H * 0.12);
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.fillRect(W * 0.86, H * 0.45, W * 0.14, H * 0.33);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 3;
    ctx.strokeRect(W * 0.06, H * 0.12, W * 0.8, H * 0.66);
    ctx.restore();
  }
}
