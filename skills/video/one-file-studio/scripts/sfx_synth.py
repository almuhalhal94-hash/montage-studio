#!/usr/bin/env python3
"""One File Studio (Talal's copy): sound effects synthesized in code. Free, offline, and never musical
(no melodies, no instruments, no rhythmic patterns: each effect is one physical event).

Usage:  python3 scripts/sfx_synth.py plan/sfx.json [--out assets/sfx]
sfx.json: [{"name": "whoosh_in", "kind": "whoosh", "seconds": 0.6}, {"name": "tap", "kind": "click"}, ...]
kinds: whoosh, swish, click, tick, pop, thud, boom, impact, riser, heartbeat, typing, sparkle, glitch, paper, room
Optional per effect: "seconds", "gain" (dB), "pitch" (0.5-2, darker/brighter), "pan" (-1..1 for stereo).
Natural or place sounds (wind, rain, door, crowd, birds) are not synthesized: download them free from Pixabay
(pixabay.com/sound-effects, no attribution needed) into assets/sfx/<name>.mp3 and list them with "kind": "file".
Prints each file's peak and mean like the original sfx_gen.py."""
import os, sys, json, subprocess, numpy as np, soundfile as sf
SR = 44100; rng = np.random.default_rng(7)
L = json.load(open(sys.argv[1])); out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'assets/sfx'
os.makedirs(out, exist_ok=True)
def t(s): return np.arange(int(SR * s)) / SR
def noise(n): return rng.standard_normal(n)
def lp(x, a):  # one-pole low-pass, a in (0,1): smaller = darker; a may be an array (sweep)
    y = np.empty_like(x); z = 0.0; a = np.broadcast_to(a, x.shape)
    for i in range(len(x)): z += a[i] * (x[i] - z); y[i] = z
    return y
def hp(x, a): return x - lp(x, a)
def env(n, att, rel, curve=3):
    a = int(n * att); e = np.ones(n); e[:a] = np.linspace(0, 1, max(a, 1)) ** 2
    e[a:] = np.linspace(1, 0, n - a) ** curve if rel else 1; return e
def fade(x, ms=4):
    k = int(SR * ms / 1000); x[:k] *= np.linspace(0, 1, k); x[-k:] *= np.linspace(1, 0, k); return x
def body(f0, f1, s, decay):  # pitched body of a single hit (a drum-like thud is one event, never a pattern)
    tt = t(s); ph = 2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(tt))) / SR; return np.sin(ph) * np.exp(-tt / decay)
def make(k, s, p):
    n = int(SR * s)
    if k in ('whoosh', 'swish'):
        x = noise(n); sw = np.geomspace(.02 * p, .35 * p, n) if k == 'whoosh' else np.geomspace(.08 * p, .6 * p, n)
        sw = np.minimum(sw, .95); e = np.sin(np.pi * np.linspace(0, 1, n)) ** (2 if k == 'whoosh' else 3)
        return hp(lp(x, sw), .01) * e
    if k == 'click': s = min(s, .05); x = noise(int(SR * s)) * np.exp(-t(s) / .003); return hp(x, .4 * p) + .3 * body(2400 * p, 1800 * p, s, .004)
    if k == 'tick': s = min(s, .04); return body(3200 * p, 3000 * p, s, .006) * .8 + hp(noise(int(SR * s)), .5) * np.exp(-t(s) / .002) * .4
    if k == 'pop': s = min(s, .18); return body(900 * p, 300 * p, s, .035)
    if k == 'thud': s = min(s, .4); return body(140 * p, 55 * p, s, .07) + lp(noise(int(SR * s)), .05) * np.exp(-t(s) / .02) * .6
    if k == 'boom': s = max(s, .8); return body(70 * p, 32 * p, s, .45) + lp(noise(int(SR * s)), .01) * np.exp(-t(s) / .3) * 1.5
    if k == 'impact': s = max(s, .5); return body(110 * p, 40 * p, s, .18) + hp(noise(int(SR * s)), .3) * np.exp(-t(s) / .015) * .7 + lp(noise(int(SR * s)), .03) * np.exp(-t(s) / .25)
    if k == 'riser': x = lp(noise(n), np.geomspace(.01 * p, .5 * p, n).clip(0, .95)); return hp(x, .02) * np.linspace(0, 1, n) ** 2.2
    if k == 'heartbeat':
        s = max(s, .9); x = np.zeros(int(SR * s)); a = body(60 * p, 40 * p, .25, .06); b = a * .7
        x[:len(a)] += a; o = int(SR * .28); x[o:o + len(b)] += b; return x
    if k == 'typing':
        x = np.zeros(n); i = 0
        while i < n - 2000: c = make('click', .03, p * rng.uniform(.8, 1.2)) * rng.uniform(.5, 1); x[i:i + len(c)] += c; i += int(SR * rng.uniform(.06, .17))
        return x
    if k == 'sparkle':
        x = np.zeros(n)
        for _ in range(int(14 * s)):
            f = rng.uniform(5000, 9000) * p; d = rng.uniform(.04, .12); g = body(f, f, d, d / 4) * rng.uniform(.2, .6); i = rng.integers(0, max(1, n - len(g))); x[i:i + len(g)] += g
        return x * env(n, .1, True, 1.5)
    if k == 'glitch':
        s = min(s, .3); m = int(SR * s); x = noise(m); blk = int(SR * .012)
        for i in range(0, m, blk): x[i:i + blk] *= rng.choice([0, .3, 1])
        return lp(x, .5) * .8
    if k == 'paper': return hp(lp(noise(n), .5), .1) * np.abs(lp(noise(n), .002)) * 6 * env(n, .15, True, 2)
    if k == 'room': return lp(noise(n), .004) * 3
    raise SystemExit(f'unknown kind: {k}')
for fx in L:
    p = f"{out}/{fx['name']}.mp3"
    if fx.get('kind') == 'file':
        print(f"{fx['name']:16s} {'present' if os.path.exists(p) else 'MISSING: download from pixabay.com/sound-effects'}"); continue
    x = make(fx.get('kind', fx['name']), float(fx.get('seconds', .5)), float(fx.get('pitch', 1)))
    x = fade(x / (np.abs(x).max() + 1e-9) * 10 ** (fx.get('gain', -1) / 20))
    pan = float(fx.get('pan', 0)); st = np.stack([x * min(1, 1 - pan), x * min(1, 1 + pan)], 1)
    w = p[:-4] + '.wav'; sf.write(w, st, SR)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-b:a', '192k', p], check=True); os.remove(w)
    s = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = next((l.split(':')[-1].strip() for l in s.splitlines() if 'max_volume' in l), '?'); mean = next((l.split(':')[-1].strip() for l in s.splitlines() if 'mean_volume' in l), '?')
    print(f"{fx['name']:16s} peak {peak:>9s} mean {mean:>9s}")
json.dump(L, open(f'{out}/prompts.json', 'w'), indent=1)
