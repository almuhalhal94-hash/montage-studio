// التصدير: MP4 حقيقي (H.264) من المتصفح عبر WebCodecs، أو احترافي عبر الخادم المحلي، أو تسجيل احتياطي
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { layoutClips, projectDuration, dims } from './model.js';
import { Renderer, framePlan } from './renderer.js';
import { renderMix, audioBufferToWav, buildMix } from './audio.js';
import { loadFonts } from './textfx.js';

function seekVideo(el, time) {
  return new Promise((res) => {
    if (el.readyState >= 2 && Math.abs(el.currentTime - time) < 0.0005) return res();
    let done = false;
    const fin = () => { if (done) return; done = true; el.removeEventListener('seeked', fin); res(); };
    el.addEventListener('seeked', fin);
    setTimeout(fin, 3000);
    el.currentTime = time;
  });
}

class FrameSource {
  constructor(media, project) {
    this.media = media;
    this.project = project;
    this.videos = new Map();
    this.renderer = new Renderer((clip) => this.source(clip));
  }
  async prepare() {
    for (const c of this.project.clips) {
      if (c.type === 'image') { await this.media.decodeImage(c.mediaId); continue; }
      const el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.preload = 'auto';
      el.src = this.media.url(c.mediaId);
      await new Promise((res) => { el.onloadeddata = res; el.onerror = res; setTimeout(res, 15000); });
      this.videos.set(c.id, el);
    }
    await loadFonts(this.project);
  }
  source(clip) {
    if (clip.type === 'image') { const img = this.media.images.get(clip.mediaId); return img ? { el: img, w: img.width, h: img.height } : null; }
    const v = this.videos.get(clip.id);
    return v && v.readyState >= 2 ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  }
  async frame(ctx, t, scale, layout) {
    for (const n of framePlan(this.project, t, layout)) await seekVideo(this.videos.get(n.clipId), n.time);
    this.renderer.draw(ctx, this.project, t, { scale, layout });
  }
  dispose() { for (const v of this.videos.values()) { v.removeAttribute('src'); v.load(); } }
}

const pickAvc = async (w, h, fps, bitrate) => {
  for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0033', 'avc1.42003e', 'avc1.42E028']) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch {}
  }
  return null;
};
const pickAudio = async (sr) => {
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: sr, numberOfChannels: 2, bitrate: 192000 };
    try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux }; } catch {}
  }
  return null;
};

export async function exportCapabilities() {
  const caps = { webcodecs: false, audio: null };
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return caps;
  caps.webcodecs = !!(await pickAvc(1080, 1920, 30, 8e6));
  if (typeof AudioEncoder !== 'undefined') caps.audio = (await pickAudio(48000))?.mux || null;
  return caps;
}

// ---- تصدير المتصفح (أسرع من الزمن الحقيقي وبدقة الفريم) ----
export async function exportBrowser(project, media, { scale = 1, fps = 30, quality = 'high', onProgress, signal }) {
  const { w, h } = dims(project, scale);
  const dur = projectDuration(project);
  const total = Math.max(1, Math.round(dur * fps));
  const bitrate = Math.min(20e6, Math.round((quality === 'high' ? 0.22 : 0.13) * w * h * fps));
  const vcfg = await pickAvc(w, h, fps, bitrate);
  if (!vcfg) throw new Error('NO_WEBCODECS');

  onProgress?.(0, 'تجهيز الصوت…');
  const mixBuf = await renderMix(project, media, 48000);
  const acfg = typeof AudioEncoder !== 'undefined' ? await pickAudio(48000) : null;
  if (!acfg) throw new Error('NO_AUDIO_ENCODER');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: w, height: h, frameRate: fps },
    audio: { codec: acfg.mux, sampleRate: 48000, numberOfChannels: 2 },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let encErr = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { encErr = e; } });
  aenc.configure(acfg.cfg);

  // الصوت
  const sr = 48000, chunk = 4800;
  const L = mixBuf.getChannelData(0), R = mixBuf.numberOfChannels > 1 ? mixBuf.getChannelData(1) : L;
  const audioLen = Math.min(mixBuf.length, Math.round(total / fps * sr));
  for (let i = 0; i < audioLen; i += chunk) {
    const n = Math.min(chunk, audioLen - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / sr * 1e6), data });
    aenc.encode(ad);
    ad.close();
  }

  // الصورة
  const fs = new FrameSource(media, project);
  onProgress?.(0, 'تجهيز المقاطع…');
  await fs.prepare();
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const layout = layoutClips(project);
  const t0 = performance.now();
  try {
    for (let f = 0; f < total; f++) {
      if (signal?.aborted) throw new Error('ABORT');
      if (encErr) throw encErr;
      await fs.frame(ctx, f / fps, scale, layout);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (f % 5 === 0) {
        const el = (performance.now() - t0) / 1000;
        const eta = f > 10 ? (el / f) * (total - f) : null;
        onProgress?.(f / total, 'جاري التصدير…', eta);
      }
    }
    onProgress?.(1, 'إنهاء الملف…');
    await venc.flush();
    await aenc.flush();
    muxer.finalize();
  } finally {
    fs.dispose();
    try { venc.close(); } catch {}
    try { aenc.close(); } catch {}
  }
  return new Blob([target.buffer], { type: 'video/mp4' });
}

// ---- تسجيل احتياطي بالزمن الحقيقي (للمتصفحات بدون WebCodecs) ----
export async function exportRecorder(project, media, { scale = 1, fps = 30, onProgress, signal }) {
  const { w, h } = dims(project, scale);
  const dur = projectDuration(project);
  const fs = new FrameSource(media, project);
  await fs.prepare();
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const stream = canvas.captureStream(fps);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const mimeType = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.round(0.16 * w * h * fps) });
  const parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const layout = layoutClips(project);
  // الفيديوهات تتشغل فعلياً هنا
  const mix = await buildMix(ac, project, media, { from: 0, to: dur, dest });
  rec.start(500);
  const startAt = mix.base;
  await new Promise((resolve) => {
    const step = () => {
      const t = ac.currentTime - startAt;
      if (signal?.aborted || t >= dur) return resolve();
      const need = new Map(framePlan(project, Math.max(0, t), layout).map((n) => [n.clipId, n.time]));
      for (const [id, v] of fs.videos) {
        if (need.has(id)) {
          const c = project.clips.find((x) => x.id === id);
          v.playbackRate = c.speed || 1;
          if (Math.abs(v.currentTime - need.get(id)) > 0.2) v.currentTime = need.get(id);
          if (v.paused) v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
      fs.renderer.draw(ctx, project, Math.max(0, t), { scale, layout });
      onProgress?.(Math.max(0, t) / dur, 'تسجيل بالزمن الحقيقي…', dur - t);
      requestAnimationFrame(step);
    };
    step();
  });
  await new Promise((r) => { rec.onstop = r; rec.stop(); });
  mix.stop();
  fs.dispose();
  ac.close();
  if (signal?.aborted) throw new Error('ABORT');
  const type = mimeType.split(';')[0] || 'video/webm';
  return new Blob(parts, { type });
}

// ---- التصدير الاحترافي عبر الخادم المحلي ----
export async function serverHealth() {
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch { return null; }
}

export async function exportPro(project, media, { scale = 1, fps = 30, onProgress, signal }) {
  const { w, h } = dims(project, scale);
  const dur = projectDuration(project);
  const total = Math.max(1, Math.round(dur * fps));
  onProgress?.(0, 'تجهيز الصوت…');
  const mixBuf = await renderMix(project, media, 48000);
  const wav = audioBufferToWav(mixBuf);
  const job = await (await fetch('api/job', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ w, h, fps, frames: total, name: project.name }),
  })).json();
  if (!job.id) throw new Error(job.error || 'تعذر بدء التصدير');
  onProgress?.(0, 'ضبط مستوى الصوت (-14 LUFS)…');
  const ra = await fetch(`api/job/${job.id}/audio`, { method: 'POST', body: wav });
  if (!ra.ok) throw new Error('تعذر رفع الصوت');

  const fs = new FrameSource(media, project);
  onProgress?.(0, 'تجهيز المقاطع…');
  await fs.prepare();
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const layout = layoutClips(project);
  const t0 = performance.now();
  try {
    let batch = [];
    const send = async () => {
      if (!batch.length) return;
      const body = new Blob(batch.flatMap((b) => [new Uint32Array([b.size]), b]));
      batch = [];
      const r = await fetch(`api/job/${job.id}/frames`, { method: 'POST', body });
      if (!r.ok) throw new Error('انقطع الاتصال بالخادم المحلي');
    };
    for (let f = 0; f < total; f++) {
      if (signal?.aborted) throw new Error('ABORT');
      await fs.frame(ctx, f / fps, scale, layout);
      batch.push(await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.96)));
      if (batch.length >= 8) await send();
      if (f % 5 === 0) {
        const el = (performance.now() - t0) / 1000;
        onProgress?.(f / total, 'تصدير احترافي…', f > 10 ? (el / f) * (total - f) : null);
      }
    }
    await send();
  } catch (e) {
    fetch(`api/job/${job.id}/cancel`, { method: 'POST' }).catch(() => {});
    throw e;
  } finally {
    fs.dispose();
  }
  onProgress?.(1, 'الترميز النهائي بجودة عالية…');
  const fin = await (await fetch(`api/job/${job.id}/finish`, { method: 'POST' })).json();
  if (!fin.ok) throw new Error(fin.error || 'فشل الترميز');
  const blob = await (await fetch(`api/job/${job.id}/result`)).blob();
  return { blob, savedTo: fin.path };
}

export async function transcribe(blob, name) {
  const r = await fetch('api/transcribe?name=' + encodeURIComponent(name || 'audio'), { method: 'POST', body: blob });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'تعذر التفريغ');
  return j;
}
