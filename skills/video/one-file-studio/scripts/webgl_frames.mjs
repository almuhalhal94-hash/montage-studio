#!/usr/bin/env node
// One File Studio: render a three.js layer to transparent PNG frames.
// Full Chrome for Testing on the GPU (the headless shell only has software WebGL). The page renders into a canvas and the
// pixels are read back, so frame timing never depends on the browser's own paint loop. The page must define window.renderAt(t) returning
// canvas.toDataURL('image/png'), and set window.__ready = true when loaded.
//
//   node scripts/webgl_frames.mjs --page src/three/scene.html --from 34.3 --to 42.6 --fps 30 --out cache/three
//   node scripts/webgl_frames.mjs --page src/three/scene.html --times 35,36.2,38 --out cache/three_test
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const page = path.resolve(opt('page', 'src/three/scene.html')), out = opt('out', 'cache/three'), fps = +opt('fps', 30);
const times = opt('times', '') ? opt('times', '').split(',').map(Number) : null;
const from = +opt('from', 0), to = +opt('to', 1);

function findChrome() {
  if (process.env.CHROME_GL) return process.env.CHROME_GL;
  const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright'), path.join(os.homedir(), 'AppData/Local/ms-playwright')];
  const cands = ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-win64/chrome.exe', 'chrome-win/chrome.exe'];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter(x => /^chromium-\d+$/.test(x)).sort().reverse())
      for (const c of cands) { const p = path.join(r, d, c); if (fs.existsSync(p)) return p; }
  }
  throw new Error('Chrome for Testing not found: run `npx playwright install chromium` or set CHROME_GL=/path');
}

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ofs-gl-'));
const ch = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--allow-file-access-from-files', '--no-first-run', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const pf = path.join(prof, 'DevToolsActivePort'); for (let i = 0; i < 200 && !fs.existsSync(pf); i++) await new Promise(r => setTimeout(r, 50));
const [port, wsPath] = fs.readFileSync(pf, 'utf8').trim().split('\n'); const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(r => { const k = ++id; pend.set(k, r); ws.send(JSON.stringify({ id: k, method, params, sessionId })); });
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' }); const s = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
await send('Runtime.enable', {}, s); await send('Page.navigate', { url: pathToFileURL(page).href }, s);
let st; for (let i = 0; i < 300; i++) { st = (await send('Runtime.evaluate', { expression: 'JSON.stringify({r: window.__ready || false, e: window.__err || null})', returnByValue: true }, s)).result.result.value; if (JSON.parse(st).r) break; await new Promise(r => setTimeout(r, 100)); }
const S = JSON.parse(st); if (S.e) { console.error('PAGE ERROR', S.e); ch.kill('SIGKILL'); process.exit(2); }
const T = times || Array.from({ length: Math.round((to - from) * fps) + 1 }, (_, f) => from + f / fps);
const t0 = Date.now();
for (let f = 0; f < T.length; f++) {
  const r = await send('Runtime.evaluate', { expression: `renderAt(${T[f].toFixed(6)})`, returnByValue: true }, s);
  if (r.result.exceptionDetails) { console.error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); ch.kill('SIGKILL'); process.exit(3); }
  fs.writeFileSync(path.join(out, (times ? 't' + T[f].toFixed(2) : String(f).padStart(5, '0')) + '.png'), Buffer.from(r.result.result.value.split(',')[1], 'base64'));
}
console.log(`webgl: ${T.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
ch.kill('SIGKILL'); process.exit(0);
