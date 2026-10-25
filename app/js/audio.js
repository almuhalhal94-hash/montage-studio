// الصوت: نفس الميكس للمعاينة والتصدير — صوت المقاطع، التعليق، الخلفية مع خفض تلقائي وقت الكلام
import { layoutClips, audioLength, projectDuration } from './model.js';

// فترات الكلام (لخفض الخلفية تحتها)
export function speechIntervals(project, media, layout = layoutClips(project)) {
  const iv = [];
  for (const a of project.audio) if (a.role === 'voice') iv.push([a.start, a.start + audioLength(a)]);
  if (project.settings.duckClipAudio) {
    for (const L of layout) {
      const c = L.clip;
      if (c.type === 'video' && !c.muted && c.volume > 0.05 && media.get(c.mediaId)?.hasAudio) iv.push([L.start, L.end]);
    }
  }
  iv.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const [s, e] of iv) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 0.9) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

let noiseBuf = null;
function whooshBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.7);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const env = Math.sin(Math.PI * Math.pow(p, 0.7)) ** 2;
    last = last * 0.86 + (Math.random() * 2 - 1) * 0.14; // ضجيج ناعم (بدون أي إيقاع)
    d[i] = last * env * 1.6;
  }
  return noiseBuf;
}

// يبني الميكس على أي AudioContext (عادي أو Offline). from = بداية التشغيل بالثواني
export async function buildMix(ctx, project, media, { from = 0, to = null, dest = null } = {}) {
  const layout = layoutClips(project);
  const total = to ?? projectDuration(project, layout);
  // فك كل الملفات أولاً حتى تكون الجدولة دقيقة
  const ids = new Set();
  for (const L of layout) if (L.clip.type === 'video' && !L.clip.muted) ids.add(L.clip.mediaId);
  for (const a of project.audio) ids.add(a.mediaId);
  const bufs = new Map();
  await Promise.all([...ids].map(async (id) => bufs.set(id, await media.decodeAudio(id, true))));
  const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const base = ctx.currentTime + (isOffline ? 0 : 0.06);
  const nodes = [];
  const s = project.settings;

  const master = ctx.createGain();
  master.gain.value = 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.12;
  master.connect(limiter);
  limiter.connect(dest || ctx.destination);
  nodes.push(master, limiter);

  const voiceBus = ctx.createGain();
  voiceBus.connect(master);
  const bgBus = ctx.createGain();
  bgBus.connect(master);
  nodes.push(voiceBus, bgBus);

  // خفض الخلفية
  if (s.ducking) {
    const g = bgBus.gain;
    const lvl = s.duckLevel ?? 0.22;
    const at = (t) => base + Math.max(0, t - from);
    g.setValueAtTime(1, base);
    for (const [a, b] of speechIntervals(project, media, layout)) {
      if (b < from) continue;
      const startT = Math.max(a - 0.25, from);
      if (a - 0.25 > from) g.setValueAtTime(1, at(a - 0.25));
      g.linearRampToValueAtTime(lvl, at(Math.max(a, startT)) + 0.001);
      g.setValueAtTime(lvl, at(b));
      g.linearRampToValueAtTime(1, at(b + 0.6));
    }
  }

  const play = (buffer, { when, offset, length, gain, rate = 1, bus, fadeIn = 0, fadeOut = 0, loop = false, srcIn = 0, srcOut = null }) => {
    const end = when + length;
    if (end <= from || when >= total) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    if (loop) { src.loop = true; src.loopStart = srcIn; src.loopEnd = srcOut ?? buffer.duration; }
    const g = ctx.createGain();
    src.connect(g); g.connect(bus);
    const skip = Math.max(0, from - when);
    let off = offset + skip * rate;
    if (loop) { const span = (srcOut ?? buffer.duration) - srcIn; off = srcIn + ((off - srcIn) % span); }
    const startAt = base + Math.max(0, when - from);
    const playLen = Math.min(end, total) - Math.max(when, from);
    const tt = (x) => base + (x - from);
    g.gain.setValueAtTime(0, startAt);
    // تلاشي داخل وخارج
    const fi = Math.max(0.01, fadeIn);
    const fo = Math.max(0.01, fadeOut);
    const vAt = (x) => {
      let v = gain;
      if (x - when < fi) v *= Math.max(0, (x - when) / fi);
      if (end - x < fo) v *= Math.max(0, (end - x) / fo);
      return v;
    };
    const t0 = Math.max(when, from);
    g.gain.setValueAtTime(vAt(t0), tt(t0));
    if (when + fi > t0) g.gain.linearRampToValueAtTime(gain, tt(when + fi));
    if (end - fo > t0) g.gain.setValueAtTime(vAt(Math.max(t0, end - fo)), tt(Math.max(t0, end - fo)));
    g.gain.linearRampToValueAtTime(0, tt(end));
    src.start(startAt, off, loop ? undefined : playLen * rate + 0.01);
    if (loop) src.stop(startAt + playLen);
    nodes.push(src, g);
  };

  // صوت المقاطع
  for (const L of layout) {
    const c = L.clip;
    if (c.type !== 'video' || c.muted || c.volume <= 0) continue;
    const buf = bufs.get(c.mediaId);
    if (!buf) continue;
    const nextTr = layout[L.index + 1]?.tr || 0;
    play(buf, { when: L.start, offset: c.in, length: L.len, gain: c.volume, rate: c.speed || 1, bus: voiceBus, fadeIn: Math.max(0.02, L.tr), fadeOut: Math.max(0.02, nextTr) });
  }
  // التعليق والخلفية
  for (const a of project.audio) {
    const buf = bufs.get(a.mediaId);
    if (!buf) continue;
    play(buf, {
      when: a.start, offset: a.in, length: audioLength(a), gain: a.volume, bus: a.role === 'bg' ? bgBus : voiceBus,
      fadeIn: a.fadeIn, fadeOut: a.fadeOut, loop: a.loop, srcIn: a.in, srcOut: a.out,
    });
  }
  // صوت الانتقال
  if (s.whoosh) {
    const wb = whooshBuffer(ctx);
    for (const L of layout) {
      if (!L.tr || L.clip.transition?.type === 'none') continue;
      const when = L.start + L.tr / 2 - 0.35;
      play(wb, { when, offset: 0, length: wb.duration, gain: 0.32, bus: voiceBus });
    }
  }
  return {
    base,
    stop() {
      for (const n of nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} }
    },
  };
}

// ميكس كامل في الذاكرة (للتصدير) مع توحيد مستوى الصوت
export async function renderMix(project, media, sampleRate = 48000) {
  const dur = projectDuration(project);
  const len = Math.max(1, Math.ceil(dur * sampleRate));
  const off = new OfflineAudioContext(2, len, sampleRate);
  await buildMix(off, project, media, { from: 0, to: dur });
  const buf = await off.startRendering();
  if (project.settings.normalize) normalize(buf);
  return buf;
}

// تقريب لـ -14 LUFS عبر RMS مع سقف للذروة
function normalize(buf) {
  let sum = 0, n = 0, peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i += 2) { const v = d[i]; sum += v * v; n++; const a = Math.abs(v); if (a > peak) peak = a; }
  }
  if (!n || peak < 1e-4) return;
  const rms = Math.sqrt(sum / n);
  const targetRms = Math.pow(10, -16 / 20);
  let k = targetRms / Math.max(rms, 1e-6);
  k = Math.min(k, 0.97 / peak, 8);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
}

export function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const out = new ArrayBuffer(44 + len * ch * 2);
  const v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data');
  v.setUint32(40, len * ch * 2, true);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([out], { type: 'audio/wav' });
}
