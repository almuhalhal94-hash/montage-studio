#!/usr/bin/env node
// One File Studio: website QA by script (then look with your own eyes).
//   node scripts/site_check.mjs <url | path/to/index.html> [--widths 375,390,1440] [--containers ".wrap,.container"] [--out cache/site]
// At each width it forces reveals and eager images, then reports:
//  - elements escaping their CONTAINER (not the viewport: body{overflow-x:hidden} hides real overruns)
//  - broken images, images missing an alt attribute (alt="" is fine for decoration)
//  - tel: links visible in the first screen (and their height), h1 count, em dashes in visible text
// and saves a full-page screenshot per width. Validate it once: run it on a deliberately broken copy and make sure it fails.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const target = a.find(x => !x.startsWith('--') && !a[a.indexOf(x) - 1]?.startsWith('--')) || 'site/index.html';
const url = /^https?:/.test(target) ? target : pathToFileURL(path.resolve(target)).href;
const widths = opt('widths', '375,390,1440').split(',').map(Number), containers = opt('containers', '.wrap,.container'), out = opt('out', 'cache/site');
fs.mkdirSync(out, { recursive: true });
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const r of [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright'), path.join(os.homedir(), 'AppData/Local/ms-playwright')]) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter(x => x.startsWith('chromium_headless_shell')).sort().reverse())
      for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64', 'chrome-headless-shell-win64']) {
        const p = path.join(r, d, sub, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  }
  throw new Error('chrome-headless-shell not found: npx playwright install chromium-headless-shell');
}
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ofs-site-'));
const ch = spawn(findChrome(), ['--headless', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--allow-file-access-from-files', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const pf = path.join(prof, 'DevToolsActivePort'); for (let i = 0; i < 200 && !fs.existsSync(pf); i++) await new Promise(r => setTimeout(r, 50));
const [port, wsPath] = fs.readFileSync(pf, 'utf8').trim().split('\n'); const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(r => { const k = ++id; pend.set(k, r); ws.send(JSON.stringify({ id: k, method, params, sessionId })); });
const evalv = async (s, expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s)).result.result.value;
const CHECK = `(async () => {
  const st = document.createElement('style'); st.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(st);
  document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; });
  document.querySelectorAll('[class*="reveal"],[data-reveal],.fade,.rise').forEach(e => e.classList.add('in','on','is-visible','revealed','visible'));
  for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0);
  await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return p; } return null; };
  const over = [];
  document.querySelectorAll(${JSON.stringify(containers)}).forEach(w => { const wb = w.getBoundingClientRect();
    w.querySelectorAll('*').forEach(el => { const b = el.getBoundingClientRect(); if (!b.width || b.left < -900) return;
      const c = clipped(el); if (c && c !== w && w.contains(c)) return;
      const d = Math.max(b.right - wb.right, wb.left - b.left); if (d > 3) over.push((el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '')).slice(0, 80) + ' +' + Math.round(d) + 'px'); }); });
  const tels = [...document.querySelectorAll('a[href^="tel:"]')], first = tels.filter(t => { const b = t.getBoundingClientRect(); return b.width > 0 && b.top < innerHeight && b.bottom > 0; });
  return { overflow: [...new Set(over)].slice(0, 25), brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src).slice(0, 10),
    imgNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length, h1: document.querySelectorAll('h1').length, telTotal: tels.length,
    telFirstScreen: first.length, telMinHeight: first.length ? Math.round(Math.min(...first.map(t => t.getBoundingClientRect().height))) : 0,
    emDashes: (document.body.innerText.match(/\\u2014/g) || []).length, title: document.title.length, description: (document.querySelector('meta[name=description]') || {}).content?.length || 0,
    pageWidth: document.documentElement.scrollWidth };
})()`;
const report = {};
for (const w of widths) {
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' }); const s = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: w < 768 ? 812 : 900, deviceScaleFactor: w < 768 ? 2 : 1, mobile: w < 768 }, s);
  await send('Page.navigate', { url }, s); await new Promise(r => setTimeout(r, 2500));
  const r = await evalv(s, CHECK); report[w] = r;
  const shot = (await send('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true }, s)).result;
  if (shot) fs.writeFileSync(path.join(out, `full_${w}.jpg`), Buffer.from(shot.data, 'base64'));
  const bad = r.overflow.length || r.brokenImages.length || r.h1 !== 1 || r.emDashes || (w < 768 && (!r.telFirstScreen || r.telMinHeight < 44));
  console.log(`${String(w).padStart(5)} px  ${bad ? 'CHECK' : 'ok   '}  overflow ${r.overflow.length}  broken img ${r.brokenImages.length}  no-alt ${r.imgNoAlt}  h1 ${r.h1}  tel ${r.telTotal} (first screen ${r.telFirstScreen}, min ${r.telMinHeight}px)  em dashes ${r.emDashes}  title ${r.title}  desc ${r.description}`);
  r.overflow.forEach(o => console.log('        overflow:', o));
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1)); console.log('screens + report ->', out);
ch.kill('SIGKILL'); process.exit(0);
