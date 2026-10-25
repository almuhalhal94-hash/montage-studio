#!/usr/bin/env python3
"""One File Studio: voice processing + a sound on every move + beds, mastered to -14 LUFS / <= -1.5 dBTP.

Usage:  python3 scripts/mix.py plan/mix.json
mix.json:
  {"anchors": "plan/anchors.json", "words": "plan/vo_words.json", "lines": "plan/vo_lines.json",
   "voice": "assets/vo/narration.wav", "voice_gain": 1.0,
   "echo_line": "hook",                    # first-line echo (send closes after the line, tail gone before the next line)
   "air_lines": ["reveal", "video"],       # whisper lines get extra air
   "sfx_dirs": ["assets/sfx"],
   "cues": [["K.flare + .02", "ignite", -11, 0.9], ["w('built', 5) - .08", "impact_deep", -15], ["0", "boom", -11, 1.2, 0.0]],
   "beds": [{"sfx": "amb_night", "spans": [["0", "K.cut1 + .05"]], "level": -33}],
   "dur": "dur", "out": "assets/mix/mix.wav"}
Cue = [time expression, effect name, peak dBFS, max seconds (optional), pan -1..1 (optional)].
Time expressions may use K.<anchor> (from anchors.json), dur, w(line, i) = word start, we(line, i) = word end.
Writes premaster.wav next to out, then the mastered file. Prints speech vs effects levels."""
import os, re, sys, json, types, subprocess, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
C = json.load(open(sys.argv[1])); SR = 48000
A = json.load(open(C.get('anchors', 'plan/anchors.json'))); W = json.load(open(C.get('words', 'plan/vo_words.json'))); L = json.load(open(C.get('lines', 'plan/vo_lines.json')))
K = types.SimpleNamespace(**A.get('K', {}))   # attribute access; any anchor name works (pop, items...)
dur = float(A.get('dur') or 0) or max(l['end'] for l in L) + 3
def w(line, i): ws = [x for x in W if x['line'] == line]; return ws[i]['s']
def we(line, i): ws = [x for x in W if x['line'] == line]; return ws[i]['e']
T = lambda expr: float(eval(str(expr), {'__builtins__': {}}, {'K': K, 'dur': dur, 'w': w, 'we': we, 'max': max, 'min': min}))
DUR = T(C.get('dur', 'dur')); N = int((DUR + .5) * SR); db = lambda x: 10 ** (x / 20)
def load(p, ch=2, af=None):
    a = ['-af', af] if af else []
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, *a, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True).stdout, np.float32).reshape(-1, ch).copy()
def path(name):
    for d in C.get('sfx_dirs', ['assets/sfx']):
        for ext in ('mp3', 'wav'):
            if os.path.exists(f'{d}/{name}.{ext}'): return f'{d}/{name}.{ext}'
    sys.exit(f'effect not found: {name}')
# ---- voice: chain, whisper air, first-line echo ----
NARR = 'highpass=f=80,equalizer=f=280:t=q:w=1.0:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.2,highshelf=f=9500:g=2,deesser=i=0.35,acompressor=threshold=-21dB:ratio=3:attack=5:release=120:makeup=3.5'
AIR = NARR.replace('highshelf=f=9500:g=2', 'highshelf=f=8000:g=4.5').replace('threshold=-21dB', 'threshold=-24dB').replace('makeup=3.5', 'makeup=5')
v = load(C['voice'], 1, NARR)[:, 0]; v = np.pad(v, (0, max(0, N - len(v))))[:N]
if C.get('air_lines'):
    va = load(C['voice'], 1, AIR)[:, 0]; va = np.pad(va, (0, max(0, N - len(va))))[:N]; k = np.zeros(N, np.float32)
    for l in L:
        if l['id'] in C['air_lines']: k[int(l['start'] * SR):int(l['end'] * SR)] = 1
    k = np.convolve(k, np.ones(2400) / 2400, mode='same'); v = v * (1 - k) + va * k
vo = np.stack([v, v], 1) * db(C.get('voice_gain', 1.0))
if C.get('echo_line'):
    ln = next(l for l in L if l['id'] == C['echo_line']); wl = [x for x in W if x['line'] == ln['id']]; t_close = wl[-1]['e'] + .05
    nxt = min([l['start'] for l in L if l['start'] > ln['start']] + [t_close + 1.0])
    send = np.zeros(N, np.float32); send[int(ln['start'] * SR):int(t_close * SR)] = 1; f = int(.25 * SR); i0 = int(t_close * SR); send[i0:i0 + f] = np.linspace(1, 0, f)
    rng = np.random.default_rng(7); n = int(2.6 * SR); tt = np.arange(n) / SR; ir = []
    for ch in range(2):
        x = rng.standard_normal(n) * np.exp(-6.91 * tt / 2.2); x[:int(.045 * SR)] = 0; x = sosfilt(butter(2, 6500, 'lp', fs=SR, output='sos'), x); ir.append(x / np.sqrt((x ** 2).sum()))
    hp = sosfilt(butter(2, 300, 'hp', fs=SR, output='sos'), v * send); wet = np.stack([fftconvolve(hp, ir[c])[:N] for c in range(2)], 1)
    a0, a1 = int(ln['start'] * SR), int(t_close * SR); wet *= np.sqrt((v[a0:a1] ** 2).mean() + 1e-12) / (np.sqrt((wet[a0:a1] ** 2).mean()) + 1e-12) * .55
    fade = np.clip((max(nxt, t_close + .3) - np.arange(N) / SR) / .35, 0, 1).astype(np.float32); vo += wet * fade[:, None]
# ---- effects ----
sfx = np.zeros((N, 2), np.float32); cache = {}; lp = butter(2, 11000, 'lp', fs=SR, output='sos')
for cue in sorted(C.get('cues', []), key=lambda c: T(c[0])):
    t, name, pk = T(cue[0]), cue[1], cue[2]; cap = cue[3] if len(cue) > 3 and cue[3] else None; pan = cue[4] if len(cue) > 4 else 0.0
    if name not in cache: cache[name] = sosfilt(lp, load(path(name)), axis=0).astype(np.float32)
    x = cache[name].copy()
    if cap: x = x[:max(int(.05 * SR), int(cap * SR))]
    f = min(len(x), int(.04 * SR)); x[-f:] *= np.linspace(1, 0, f)[:, None]; x *= db(pk) / (np.abs(x).max() + 1e-9)
    if pan: x[:, 0] *= np.sqrt((1 - pan) / 2) * 1.414; x[:, 1] *= np.sqrt((1 + pan) / 2) * 1.414
    a = int(max(0, t) * SR); b = min(N, a + len(x)); sfx[a:b] += x[:b - a]
for bed in C.get('beds', []):
    x = load(path(bed['sfx'])); x *= db(bed.get('level', -33)) / (np.sqrt((x ** 2).mean()) + 1e-9)
    for s0, s1 in bed['spans']:
        a, b = int(T(s0) * SR), min(N, int(T(s1) * SR)); n = b - a
        if n <= 0: continue
        y = np.tile(x, (n // len(x) + 1, 1))[:n].copy(); f = min(n // 2, int(.35 * SR)); y[:f] *= np.linspace(0, 1, f)[:, None]; y[-f:] *= np.linspace(1, 0, f)[:, None]; sfx[a:b] += y
mix = vo + sfx; e = int(DUR * SR); fo = int(.5 * SR); mix[e - fo:e] *= np.linspace(1, 0, fo)[:, None]; mix = mix[:e]
out = C.get('out', 'assets/mix/mix.wav'); os.makedirs(os.path.dirname(out) or '.', exist_ok=True); pre = os.path.join(os.path.dirname(out) or '.', 'premaster.wav')
sf.write(pre, mix, SR, subtype='FLOAT')
def meas(p):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', s)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', s)[-1])
I, _ = meas(pre); g = -14.0 - I
for ceil in (-2.0, -2.4, -2.8, -3.2, -3.6, -4.0):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pre, '-af', f'volume={g:.2f}dB,alimiter=limit={db(ceil):.4f}:attack=2:release=50:level=disabled', '-ar', str(SR), '-c:a', 'pcm_s24le', out])
    I2, TP2 = meas(out)
    if TP2 <= -1.5: break
m, _ = sf.read(out); mm = m.mean(1); win = int(.4 * SR); spk = np.zeros(len(mm), bool)
for x in W: spk[int(x['s'] * SR):int(x['e'] * SR)] = True
rms = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
R = [(rms(mm[i:i + win]), spk[i:i + win].mean()) for i in range(0, len(mm) - win, win)]
sp = [r for r, f in R if f > .6]; gp = [r for r, f in R if f < .05 and r > -60]
print(f"{len(C.get('cues', []))} cues | {I2:.1f} LUFS, true peak {TP2:.1f} dBTP, {DUR:.2f} s | speech median {np.median(sp):.1f} dBFS, between lines median {np.median(gp) if gp else float('nan'):.1f}, loudest {max(gp) if gp else float('nan'):.1f}")
