#!/usr/bin/env node
// One File Studio: record a live website scrolling, the way a person would: full Chrome on the GPU (WebGL sites work), real mouse-wheel
// events (smooth-scroll libraries respond), the compositor's own frames via a DevTools screencast. Frames + timestamps
// become a constant-frame-rate MP4.
//   node scripts/site_film.mjs <url> <out.mp4> [--w 1440] [--h 900] [--wait 10] [--dur 8] [--speed 520] [--fps 30]
//        [--delay 0.6] (seconds to hold before scrolling)  [--mobile] (390x844 at 3x, touch)
// Never click through age gates, consent or 'enter' screens on someone else's site; pick sites that open straight in.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const [url, out] = a;
const W = +opt('w', 1440), H = +opt('h', 900), wait = +opt('wait', 10), dur = +opt('dur', 8), speed = +opt('speed', 520), fps = +opt('fps', 30), delay = +opt('delay', .6);
const mobile = a.includes('--mobile'), dpr = +opt('dpr', mobile ? 3 : 1);
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

const bin = findChrome();
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
const ch = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--ignore-gpu-blocklist', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', `--window-size=${W},${H + 240}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
ch.stderr.on('data', () => {});
const pf = path.join(prof, 'DevToolsActivePort'); for (let i = 0; i < 200 && !fs.existsSync(pf); i++) await new Promise(r => setTimeout(r, 50));
const [port, wsPath] = fs.readFileSync(pf, 'utf8').trim().split('\n');
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(), handlers = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) handlers.forEach(h => h(m)); };
const send = (method, params = {}, sessionId) => new Promise(r => { const k = ++id; pend.set(k, r); ws.send(JSON.stringify({ id: k, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
const s = (await send('Target.attachToTarget', { targetId: t, flatten: true })).result.sessionId;
await send('Page.enable', {}, s);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile }, s);
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, s);
await send('Page.navigate', { url }, s);
await sleep(wait * 1000);
const HIDE = `(() => { const kill = () => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el);
    if ((cs.position === 'fixed' || cs.position === 'sticky') && /cookie|consent|privacy|gdpr/i.test(el.innerText || '') && el.innerText.length < 900) el.style.setProperty('display', 'none', 'important'); } };
  kill(); setInterval(kill, 500); return [innerWidth, innerHeight, devicePixelRatio]; })()`;
await send('Runtime.evaluate', { expression: HIDE, returnByValue: true }, s);   // cookie/consent overlays hidden with CSS: no consent choice is made
// move the mouse into the page (hover effects, custom cursors) before recording
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: W / 2, y: H / 2 }, s);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-frames-')); const frames = [];
handlers.push(async m => {
  if (m.method !== 'Page.screencastFrame' || m.sessionId !== s) return;
  const f = path.join(tmp, `${String(frames.length).padStart(5, '0')}.jpg`);
  fs.writeFileSync(f, Buffer.from(m.params.data, 'base64')); frames.push({ f, ts: m.params.metadata.timestamp, md: m.params.metadata });
  send('Page.screencastFrameAck', { sessionId: m.params.sessionId }, s);
});
await send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: W * dpr, maxHeight: (H + 400) * dpr, everyNthFrame: 1 }, s);
const t0 = Date.now(); await sleep(delay * 1000);
// wheel: 60 small notches a second; the page's own smooth scroll (if any) eases between them
const step = speed / 60; let alive = true;
const wheel = (async () => { while (alive) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: step }, s); await sleep(1000 / 60); } })();
while (Date.now() - t0 < (delay + dur) * 1000) await sleep(50);
alive = false; await wheel; await send('Page.stopScreencast', {}, s); await sleep(300);
// constant frame rate: for each output tick, the latest frame at or before it
const ts0 = frames[0].ts, n = Math.round((delay + dur) * fps); const list = [];
for (let k = 0, j = 0; k < n; k++) { const tt = ts0 + k / fps; while (j + 1 < frames.length && frames[j + 1].ts <= tt) j++; list.push(frames[j].f); }
const lf = path.join(tmp, 'list.txt'); fs.writeFileSync(lf, list.map(f => `file '${f}'\nduration ${1 / fps}`).join('\n') + `\nfile '${list[list.length - 1]}'\n`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-vf', `fps=${fps},crop=${W * dpr}:${H * dpr}:0:0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', out]);
const span = frames[frames.length - 1].ts - ts0;
console.log(`${path.basename(out)}: ${frames.length} captured frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps real) -> ${n} frames @${fps}`);
ch.kill(); process.exit(0);
