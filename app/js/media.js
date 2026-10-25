// الوسائط: الحفظ في IndexedDB، الاستيراد، الصور المصغّرة، فك الصوت، الموجة
import { uid } from './model.js';

const DB_NAME = 'montage-studio';
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k)).catch(() => null);
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)).catch(() => null);
const putMedia = (m) => tx('media', 'readwrite', (s) => s.put(m));
const delMedia = (id) => tx('media', 'readwrite', (s) => s.delete(id));
const allMedia = () => tx('media', 'readonly', (s) => s.getAll()).catch(() => []);

let actx = null;
export function audioCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

export class MediaLibrary {
  constructor() {
    this.items = new Map();     // id -> record (بدون الملف)
    this.blobs = new Map();     // id -> Blob
    this.urls = new Map();      // id -> objectURL
    this.images = new Map();    // id -> ImageBitmap | HTMLImageElement
    this.audio = new Map();     // id -> Promise<AudioBuffer|null>
    this.peaks = new Map();     // id -> Float32Array
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { for (const f of this.listeners) f(); }

  async load() {
    const recs = await allMedia();
    for (const r of recs) {
      const { blob, ...meta } = r;
      this.items.set(r.id, meta);
      this.blobs.set(r.id, blob);
    }
    await Promise.all(recs.filter((r) => r.type === 'image').map((r) => this.decodeImage(r.id).catch(() => null)));
    this.emit();
  }

  list() { return [...this.items.values()].sort((a, b) => a.added - b.added); }
  get(id) { return this.items.get(id); }
  blob(id) { return this.blobs.get(id); }
  url(id) {
    if (!this.urls.has(id) && this.blobs.has(id)) this.urls.set(id, URL.createObjectURL(this.blobs.get(id)));
    return this.urls.get(id);
  }

  async import(files, onProgress) {
    const added = [];
    let i = 0;
    for (const f of files) {
      i++;
      onProgress?.(i, files.length, f.name);
      const type = f.type.startsWith('image') ? 'image' : f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio'
        : /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name) ? 'video' : /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(f.name) ? 'audio'
          : /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name) ? 'image' : null;
      if (!type) continue;
      const id = uid('m');
      const rec = { id, name: f.name, type, mime: f.type, size: f.size, added: Date.now() + i, duration: 0, w: 0, h: 0, thumb: '', hasAudio: false };
      this.blobs.set(id, f);
      try {
        if (type === 'image') {
          const img = await this.decodeImage(id);
          rec.w = img.width; rec.h = img.height;
          rec.thumb = thumbFrom(img, img.width, img.height);
        } else if (type === 'video') {
          Object.assign(rec, await probeVideo(this.url(id)));
          const buf = await this.decodeAudio(id, true);
          rec.hasAudio = !!buf;
        } else {
          const buf = await this.decodeAudio(id, true);
          if (!buf) throw new Error('تعذر قراءة الملف الصوتي');
          rec.duration = buf.duration;
        }
      } catch (err) {
        console.warn('import failed', f.name, err);
        this.blobs.delete(id);
        continue;
      }
      this.items.set(id, rec);
      await putMedia({ ...rec, blob: f }).catch((e) => console.warn('storage', e));
      added.push(rec);
    }
    this.emit();
    return added;
  }

  async remove(id) {
    this.items.delete(id);
    this.blobs.delete(id);
    if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id));
    this.urls.delete(id);
    this.images.delete(id);
    this.audio.delete(id);
    this.peaks.delete(id);
    await delMedia(id);
    this.emit();
  }

  async clear() {
    for (const id of [...this.items.keys()]) await this.remove(id);
  }

  async decodeImage(id) {
    if (this.images.has(id)) return this.images.get(id);
    const blob = this.blobs.get(id);
    let img;
    try {
      img = await createImageBitmap(blob);
      const max = 2600;
      if (Math.max(img.width, img.height) > max) {
        const k = max / Math.max(img.width, img.height);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        img.close?.();
        img = await createImageBitmap(c);
      }
    } catch {
      img = await new Promise((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = this.url(id);
      });
    }
    this.images.set(id, img);
    return img;
  }

  decodeAudio(id, quiet = false) {
    if (this.audio.has(id)) return this.audio.get(id);
    const p = (async () => {
      try {
        const ab = await this.blobs.get(id).arrayBuffer();
        const buf = await new Promise((res, rej) => {
          const r = audioCtx().decodeAudioData(ab, res, rej);
          if (r && r.then) r.then(res, rej);
        });
        this.peaks.set(id, computePeaks(buf));
        return buf;
      } catch (e) {
        if (!quiet) console.warn('decodeAudio', e);
        return null;
      }
    })();
    this.audio.set(id, p);
    return p;
  }
}

function thumbFrom(src, w, h, size = 240) {
  const k = size / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

function probeVideo(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = url;
    let done = false;
    const fail = () => { if (!done) { done = true; rej(new Error('تعذر قراءة الفيديو')); } };
    v.onerror = fail;
    setTimeout(fail, 20000);
    v.onloadedmetadata = () => {
      const dur = v.duration;
      v.currentTime = Math.min(0.5, dur / 3);
    };
    v.onseeked = () => {
      if (done) return;
      done = true;
      res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: thumbFrom(v, v.videoWidth, v.videoHeight) });
      v.removeAttribute('src'); v.load();
    };
  });
}

function computePeaks(buf, n = 2000) {
  const ch = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / n));
  const out = new Float32Array(Math.ceil(ch.length / step));
  for (let i = 0, k = 0; i < ch.length; i += step, k++) {
    let m = 0;
    for (let j = i; j < Math.min(ch.length, i + step); j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
    out[k] = m;
  }
  return out;
}

export function waveformURL(peaks, from, to, total, width, height, color = 'rgba(255,255,255,0.75)') {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.min(4000, Math.round(width)));
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = color;
  const a = Math.floor((from / total) * peaks.length);
  const b = Math.max(a + 1, Math.floor((to / total) * peaks.length));
  for (let x = 0; x < c.width; x++) {
    const i0 = a + Math.floor((x / c.width) * (b - a));
    const i1 = a + Math.floor(((x + 1) / c.width) * (b - a));
    let m = 0;
    for (let i = i0; i <= i1 && i < peaks.length; i++) m = Math.max(m, peaks[i]);
    const hh = Math.max(1, m * height * 0.95);
    g.fillRect(x, (height - hh) / 2, 1, hh);
  }
  return c.toDataURL();
}
