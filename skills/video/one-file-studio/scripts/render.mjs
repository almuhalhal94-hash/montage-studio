#!/usr/bin/env node
// One File Studio: deterministic frame renderer.
// Loads a composition page in Chrome's headless shell over the DevTools protocol, waits for window.__ready, then for each
// frame calls window.renderFrame(t) and captures the viewport. No npm dependencies (Node 22+ has WebSocket built in).
//
//   node scripts/render.mjs --page src/index.html --from 0 --to 42.6 --fps 30 --out cache/frames --jpg [--quality 93] [--workers 4]
//   node scripts/render.mjs --page src/index.html --times 0.4,1.6,9.5 --out cache/stills --jpg        (stills, any order)
//   node scripts/render.mjs --page src/index.html --dump plan/anchors.json                            (A.K anchors + duration)
//   --w 1920 --h 1080 (default) · --w 1080 --h 1920 for vertical · --scale 0.5 for fast previews
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), fps = +opt('fps', 30), scale = +opt('scale', 1), from = +opt('from', 0), to = +opt('to', 1);
const out = opt('out', 'cache/frames'), jpg = a.includes('--jpg'), quality = +opt('quality', 92), workers = Math.max(1, +opt('workers', 3));
const page = path.resolve(opt('page', 'src/index.html')), dump = opt('dump', ''), pre = opt('pre', '');
const times = opt('times', '') ? opt('times', '').split(',').map(Number) : null;
const n = times ? times.length : Math.max(1, Math.round((to - from) * fps));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright'), path.join(os.homedir(), 'AppData/Local/ms-playwright')];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter(x => x.startsWith('chromium_headless_shell')).sort().reverse()) {
      for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64', 'chrome-headless-shell-win64']) {
        const p = path.join(r, d, sub, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  throw new Error('chrome-headless-shell not found: run `npx playwright install chromium-headless-shell` or set CHROME=/path');
}

if (!dump) fs.mkdirSync(out, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ofs-render-'));
const chrome = spawn(findChrome(), ['--headless', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--allow-file-access-from-files',
  '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-gpu-vsync',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  `--window-size=${W},${H}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', () => {});
const portFile = path.join(prof, 'DevToolsActivePort');
for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await new Promise(r => setTimeout(r, 50));
const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const k = ++id; pending.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method, params, sessionId })); });
const evaluate = async (s, expression, awaitPromise = false) => (await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, s));

async function worker(w) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: scale, mobile: false }, s);
  await send('Page.navigate', { url: pathToFileURL(page).href }, s);
  for (let i = 0; i < 600; i++) { const r = await evaluate(s, 'window.__ready === true'); if (r.result.value) break; await new Promise(r => setTimeout(r, 50)); }
  const err = (await evaluate(s, 'window.__err || null')).result.value;
  if (err) throw new Error('PAGE ERROR: ' + err);
  if (pre) await evaluate(s, pre, true);
  if (dump) {
    if (w === 0) { const r = await evaluate(s, 'JSON.stringify({K: (window.A || {}).K || {}, dur: ((window.A || {}).D || window.DATA || {}).dur || 0})');
      fs.mkdirSync(path.dirname(path.resolve(dump)), { recursive: true }); fs.writeFileSync(dump, r.result.value); console.log('anchors ->', dump); }
    return;
  }
  for (let f = w; f < n; f += workers) {
    const t = times ? times[f] : from + f / fps;
    const r = await send('Runtime.evaluate', { expression: `window.renderFrame(${t.toFixed(6)})`, awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw new Error(`frame ${f} t=${t}: ` + JSON.stringify(r.exceptionDetails).slice(0, 600));
    const shot = await send('Page.captureScreenshot', jpg ? { format: 'jpeg', quality, optimizeForSpeed: true } : { format: 'png', optimizeForSpeed: true }, s);
    const name = times ? 't' + t.toFixed(2) : String(f).padStart(5, '0');
    fs.writeFileSync(path.join(out, name + (jpg ? '.jpg' : '.png')), Buffer.from(shot.data, 'base64'));
  }
}
const t0 = Date.now();
try { await Promise.all(Array.from({ length: dump ? 1 : Math.min(workers, n) }, (_, w) => worker(w))); }
catch (e) { console.error(String(e.message || e)); chrome.kill('SIGKILL'); process.exit(1); }
chrome.kill('SIGKILL');
if (!dump) console.log(`rendered ${n} frames ${times ? '(stills)' : `${from}s-${to}s`} @${fps}fps ${W}x${H} in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
process.exit(0);
