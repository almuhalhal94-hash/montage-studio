// أدوات بناء الواجهة
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

export function rangeField({ label, min, max, step = 0.01, value, fmt = (v) => v, onInput }) {
  const out = h('output', {}, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); onInput(v); });
  return h('div', { class: 'field' }, h('label', {}, h('span', {}, label), out), inp);
}

export function selectField({ label, options, value, onChange }) {
  const sel = h('select', { class: 'input' }, ...Object.entries(options).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));
  sel.addEventListener('change', () => onChange(sel.value));
  return h('div', { class: 'field' }, h('label', {}, label), sel);
}

export function textField({ label, value, multiline = false, placeholder = '', onInput, dir }) {
  const inp = multiline ? h('textarea', { class: 'input', placeholder, rows: 3, dir }) : h('input', { class: 'input', value, placeholder, dir });
  inp.value = value ?? '';
  inp.addEventListener('input', () => onInput(inp.value));
  return h('div', { class: 'field' }, h('label', {}, label), inp);
}

const SWATCHES = ['#ffffff', '#111111', '#f5c451', '#5ee6c4', '#8b7bff', '#ff6b6b', '#4da3ff', '#e3b65c', '#1f7a5c', '#fff8e7'];
export function colorField({ label, value, onChange, swatches = SWATCHES }) {
  const wrap = h('div', { class: 'color' });
  const pick = h('input', { type: 'color', value: value || '#ffffff', title: 'لون مخصص' });
  const mark = (v) => wrap.querySelectorAll('.sw').forEach((s) => s.classList.toggle('on', s.dataset.c.toLowerCase() === (v || '').toLowerCase()));
  for (const c of swatches) {
    wrap.append(h('button', { class: 'sw', style: { background: c }, 'data-c': c, title: c, 'aria-label': c, onclick: () => { pick.value = c; mark(c); onChange(c); } }));
  }
  pick.addEventListener('input', () => { mark(pick.value); onChange(pick.value); });
  wrap.append(pick);
  mark(value);
  return h('div', { class: 'field' }, h('div', { class: 'lbl' }, label), wrap);
}

export function toggleField({ label, hint, checked, onChange }) {
  const inp = h('input', { type: 'checkbox', checked: !!checked });
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label', { class: 'toggle' }, h('span', {}, label, hint ? h('small', {}, hint) : null), inp);
}

export function pillsField({ label, options, value, onChange }) {
  const wrap = h('div', { class: 'pills' });
  for (const [k, v] of Object.entries(options)) {
    const b = h('button', { class: k === String(value) ? 'on' : '', onclick: () => { wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(k); } }, v);
    wrap.append(b);
  }
  return h('div', { class: 'field' }, label ? h('div', { class: 'lbl' }, label) : null, wrap);
}

let toastT = 0;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), ms);
}

export function icon(path) {
  return h('span', { html: `<svg viewBox="0 0 24 24">${path}</svg>`, style: { display: 'contents' } });
}

export const fmtSec = (v) => `${(+v).toFixed(1)} ث`;
export const fmtPct = (v) => `${Math.round(v * 100)}%`;
