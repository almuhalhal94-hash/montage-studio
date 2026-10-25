// حالة المشروع: تعديل، تراجع/إعادة، حفظ تلقائي في المتصفح
import { newProject } from './model.js';
import { kvGet, kvSet } from './media.js';

const KEY = 'project:current';

export class Store {
  constructor() {
    this.project = newProject();
    this.past = [];
    this.future = [];
    this.sel = null; // {kind:'clip'|'text'|'audio', id}
    this.listeners = new Set();
    this._lastKey = null;
    this._lastAt = 0;
    this._saveT = 0;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(reason) { for (const f of this.listeners) f(reason); }

  async load() {
    const saved = await kvGet(KEY);
    if (saved && saved.version === 1) {
      const base = newProject();
      this.project = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } };
    }
    this.emit('load');
  }

  save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => kvSet(KEY, JSON.parse(JSON.stringify(this.project))), 500);
  }

  // key: يدمج التعديلات المتتالية (مثل سحب شريط) في خطوة تراجع واحدة
  update(fn, key = null) {
    const now = performance.now();
    const merge = key && key === this._lastKey && now - this._lastAt < 1200;
    if (!merge) {
      this.past.push(JSON.stringify(this.project));
      if (this.past.length > 120) this.past.shift();
      this.future = [];
    }
    this._lastKey = key;
    this._lastAt = now;
    fn(this.project);
    this.save();
    this.emit('change');
  }

  replace(project) {
    this.past.push(JSON.stringify(this.project));
    this.future = [];
    this.project = project;
    this.sel = null;
    this.save();
    this.emit('load');
  }

  undo() {
    if (!this.past.length) return;
    this.future.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.past.pop());
    this._lastKey = null;
    this.fixSel();
    this.save();
    this.emit('change');
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.future.pop());
    this._lastKey = null;
    this.fixSel();
    this.save();
    this.emit('change');
  }

  select(kind, id) {
    this.sel = kind ? { kind, id } : null;
    this.emit('select');
  }

  selected() {
    if (!this.sel) return null;
    const p = this.project;
    const list = this.sel.kind === 'clip' ? p.clips : this.sel.kind === 'text' ? p.texts : p.audio;
    return list.find((x) => x.id === this.sel.id) || null;
  }

  fixSel() { if (this.sel && !this.selected()) this.sel = null; }
}
