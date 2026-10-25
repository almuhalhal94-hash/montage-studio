// مشغل المعاينة: مزامنة الفيديو والصوت مع الراسم
import { layoutClips, projectDuration, dims } from './model.js';
import { Renderer, framePlan } from './renderer.js';
import { buildMix } from './audio.js';
import { audioCtx } from './media.js';

export class Player {
  constructor(canvas, media, getProject) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.media = media;
    this.getProject = getProject;
    this.videos = new Map(); // clipId -> {el, mediaId}
    this.t = 0;
    this.playing = false;
    this.mix = null;
    this.listeners = new Set();
    this.renderer = new Renderer((clip) => this.source(clip));
    this.safeZones = false;
    this._raf = 0;
    this._dirty = true;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  on(fn) { this.listeners.add(fn); }
  emit() { for (const f of this.listeners) f(this.t, this.playing); }

  source(clip) {
    if (clip.type === 'image') {
      const img = this.media.images.get(clip.mediaId);
      if (!img) { this.media.decodeImage(clip.mediaId).then(() => this.invalidate()).catch(() => {}); return null; }
      return { el: img, w: img.width, h: img.height };
    }
    const v = this.video(clip);
    if (!v || v.readyState < 2) return null;
    return { el: v, w: v.videoWidth, h: v.videoHeight };
  }

  video(clip) {
    let rec = this.videos.get(clip.id);
    if (rec && rec.mediaId !== clip.mediaId) { rec.el.removeAttribute('src'); rec = null; }
    if (!rec) {
      const url = this.media.url(clip.mediaId);
      if (!url) return null;
      const el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.preload = 'auto';
      el.setAttribute('playsinline', ''); el.setAttribute('muted', '');
      el.src = url;
      el.addEventListener('seeked', () => this.invalidate());
      el.addEventListener('loadeddata', () => this.invalidate());
      rec = { el, mediaId: clip.mediaId };
      this.videos.set(clip.id, rec);
    }
    return rec.el;
  }

  // يحذف مشغلات المشاهد المحذوفة
  gc(project) {
    const ids = new Set(project.clips.map((c) => c.id));
    for (const [id, rec] of this.videos) if (!ids.has(id)) { rec.el.pause(); rec.el.removeAttribute('src'); rec.el.load(); this.videos.delete(id); }
  }

  invalidate() { this._dirty = true; }

  resize() {
    const p = this.getProject();
    const { w, h } = dims(p);
    const wrap = this.canvas.parentElement;
    const cs = getComputedStyle(wrap);
    const bw = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const bh = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const k = Math.min(bw / w, bh / h);
    const cssW = Math.max(40, Math.floor(w * k));
    const cssH = Math.max(40, Math.floor(h * k));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    const scale = Math.min(1, (cssW * dpr) / w);
    this.canvas.width = Math.round(w * scale);
    this.canvas.height = Math.round(h * scale);
    this.scale = scale;
    this.invalidate();
  }

  duration() { return projectDuration(this.getProject()); }

  async play() {
    const p = this.getProject();
    const dur = this.duration();
    if (dur <= 0) return;
    if (this.t >= dur - 0.05) this.t = 0;
    const ac = audioCtx();
    if (ac.state !== 'running') await ac.resume().catch(() => {});
    this.mix?.stop();
    this.playing = true;
    this.startT = this.t;
    this.startCtx = ac.currentTime + 10;
    const token = (this._token = (this._token || 0) + 1);
    const mix = await buildMix(ac, p, this.media, { from: this.t, to: dur });
    if (token !== this._token || !this.playing) { mix.stop(); return; }
    this.mix = mix;
    this.startCtx = this.mix.base;
    this.emit();
  }

  pause() {
    this._token = (this._token || 0) + 1;
    this.playing = false;
    this.mix?.stop();
    this.mix = null;
    for (const { el } of this.videos.values()) el.pause();
    this.emit();
    this.invalidate();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t) {
    const was = this.playing;
    if (was) this.pause();
    this.t = Math.max(0, Math.min(t, this.duration()));
    this.syncVideos(false);
    this.invalidate();
    this.emit();
    if (was) this.play();
  }

  syncVideos(playing) {
    const p = this.getProject();
    const layout = layoutClips(p);
    const need = new Map(framePlan(p, this.t, layout).map((n) => [n.clipId, n.time]));
    // تجهيز المشهد التالي قبل وصوله
    for (const L of layout) {
      if (L.clip.type === 'video' && !need.has(L.clip.id) && L.start > this.t && L.start - this.t < 1.2) {
        const v = this.video(L.clip);
        if (v && Math.abs(v.currentTime - L.clip.in) > 0.05 && !v.seeking) v.currentTime = L.clip.in;
      }
    }
    for (const L of layout) {
      const c = L.clip;
      if (c.type !== 'video') continue;
      const v = this.video(c);
      if (!v) continue;
      if (!need.has(c.id)) { if (!v.paused) v.pause(); continue; }
      const target = need.get(c.id);
      if (playing) {
        v.playbackRate = c.speed || 1;
        if (Math.abs(v.currentTime - target) > 0.25 && !v.seeking) v.currentTime = target;
        if (v.paused) v.play().catch(() => {});
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - target) > 0.02 && !v.seeking) v.currentTime = target;
      }
    }
  }

  tick() {
    const p = this.getProject();
    if (this.playing) {
      const ac = audioCtx();
      this.t = this.startT + Math.max(0, ac.currentTime - this.startCtx);
      const dur = this.duration();
      if (this.t >= dur) { this.t = dur; this.pause(); }
      this.syncVideos(true);
      this._dirty = true;
      this.emit();
    }
    if (!this._dirty) return;
    this._dirty = false;
    this.renderer.draw(this.ctx, p, this.t, { scale: this.scale || 0.5, safeZones: this.safeZones });
  }
}
