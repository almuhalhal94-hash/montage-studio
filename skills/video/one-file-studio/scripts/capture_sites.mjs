#!/usr/bin/env node
// One File Studio: full-page phone captures of live sites, for phone walls and site showcases.
// 390 css px wide at 2x, reduced motion on (every scroll reveal in its final state), the page scrolled end to end first so
// lazy images load. Writes assets/images/sites/<name>.jpg.
//   node scripts/capture_sites.mjs https://a.example.com/=a file:///path/mock.html=b [--maxh 7000]
// No npm dependencies (Node 22+). Uses chrome-headless-shell from the Playwright cache, or CHROME=/path.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const a = process.argv.slice(2), maxh = +(a.includes('--maxh') ? a[a.indexOf('--maxh') + 1] : 7000);
const jobs = a.filter(x => x.includes('=') && /^(https?|file):/.test(x)).map(x => { const i = x.lastIndexOf('='); return { url: x.slice(0, i), name: x.slice(i + 1) }; });
const out = 'assets/images/sites'; fs.mkdirSync(out, { recursive: true });
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

const bin = findChrome();
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ofs-cap-'));
const chrome = spawn(bin, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', () => {});
const pf = path.join(prof, 'DevToolsActivePort');
for (let i = 0; i < 200 && !fs.existsSync(pf); i++) await new Promise(r => setTimeout(r, 50));
const [port, wsPath] = fs.readFileSync(pf, 'utf8').trim().split('\n');
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.j(new Error(JSON.stringify(m.error))) : p.r(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((r, j) => { const k = ++id; pend.set(k, { r, j }); ws.send(JSON.stringify({ id: k, method, params, sessionId })); });
const ev = async (s, expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s)).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const { url, name } of jobs) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, s);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, s);
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, s);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, s);
  await send('Page.navigate', { url }, s);
  await sleep(3500);
  // scroll end to end so lazy images and on-enter content load, then back to the top
  await ev(s, `(async () => { const H = Math.min(document.documentElement.scrollHeight, ${maxh}); for (let y = 0; y <= H; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 600));
    await Promise.all([...document.images].map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 4000); }))); return 1; })()`);
  const h = Math.min(await ev(s, 'document.documentElement.scrollHeight'), maxh);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: h, scale: 1 } }, s);
  fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(shot.data, 'base64'));
  const blank = await ev(s, `[...document.images].filter(im => im.getBoundingClientRect().top < ${maxh} && !(im.complete && im.naturalWidth)).length`);
  console.log(name, 'css height', h, 'unloaded images', blank);
  await send('Target.closeTarget', { targetId });
}
chrome.kill(); process.exit(0);
