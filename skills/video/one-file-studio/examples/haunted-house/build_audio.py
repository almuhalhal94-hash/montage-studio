"""Haunted house sound: the whisper on top, every scare and move with its own sound, a drone under the house, a music box
under the pitch. python3 build_audio.py N  (N = hook 1..3) -> assets/mix/mix_hN.wav. Master -14 LUFS, TP <= -2.4 pre-AAC."""
import json, os, re, subprocess, sys, numpy as np
N = int(sys.argv[1]); SR = 48000
D = json.loads(open(f'src/data_h{N}.js').read().split('=', 1)[1].strip().rstrip(';'))
C, AT, WD = D['cut'], D['at'], D['words']; DUR = C['dur']; NS = int(DUR * SR)
ws = lambda line, i: [w for w in WD if w['line'] == line][i]['s']; we = lambda line, i: [w for w in WD if w['line'] == line][i]['e']
def load(p, af=None): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p] + (['-af', af] if af else []) + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout, np.float32).reshape(-1, 2).copy()
def filt(x, af): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-af', af, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], input=x.astype(np.float32).tobytes(), capture_output=True).stdout, np.float32).reshape(-1, 2).copy()
db = lambda v: 10 ** (v / 20); pk = lambda x, d: x * db(d) / (np.abs(x).max() + 1e-9)
def lufs(x):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'], input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode()
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', s)[-1])
def put(buf, x, at, g=1.0, fin=.005, fout=.02):
    x = x.copy() * g; a, b = min(len(x), int(fin * SR)), min(len(x), int(fout * SR))
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None]
    i = int(round(at * SR))
    if i < 0: x, i = x[-i:], 0
    j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i]
def loop(x, n): return np.concatenate([x] * (1 + n // len(x)))[:n]
S = lambda n: load(f'assets/sfx/{n}.mp3')                     # every sound: scripts/sfx_gen.py plan/sfx.json
vo, bed, fx = (np.zeros((NS, 2), np.float32) for _ in range(3))

# ---- the whisper ----
for line, lid in (('hook', D['hookId']), ('nocam', 'nocam'), ('onefile', 'onefile'), ('every', 'every'), ('pitch', 'pitch')):
    x = load(f'assets/vo/tight/{lid}.wav', 'highpass=f=80,acompressor=threshold=-24dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:45:0.12')
    x = x * db(-17 - lufs(x)); put(vo, x, AT[line], fout=.08)

# ---- 0-1.12: black, the scare, a dead-silent beat ----
put(fx, pk(S('heartbeat'), -9), .02); put(fx, pk(S('heartbeat'), -12), C['s0'] - .14)
put(fx, pk(S('jump_stinger'), -.5), C['s0'] - .01); put(fx, pk(S('scream_whoosh'), -3), C['s0'] + .02); put(fx, pk(S('boom_low'), -4), C['s0'])
fx[int(C['s1'] * SR):int((C['hook'] - .02) * SR)] *= np.linspace(1, 0, int((C['hook'] - .02) * SR) - int(C['s1'] * SR))[:, None] ** 4
# ---- the house ----
dr = S('drone'); put(bed, pk(loop(dr, int((C['pitch'] - C['hook']) * SR)), -14), C['hook'], fin=.6, fout=.3)
wi = S('wind_howl'); put(bed, pk(loop(wi, int((C['hall'] - C['hook'] + .3) * SR)), -16), C['hook'], fin=.4, fout=.5)
put(fx, pk(S('gate_creak'), -12), C['hook'] + .25); put(fx, pk(S('thunder'), -5), C['hook'] + 1.58)
put(fx, pk(S('door_creak'), -8), C['door'] + .15); put(fx, pk(S('crow'), -12), C['door'] + 1.1)
put(fx, pk(S('chandelier'), -14), C['hall'] + .1); put(fx, pk(S('whispers'), -15), C['hall'] + .6, fin=.4, fout=.4)
put(fx, pk(S('floor_creak'), -11), C['cor'] + .05)
for k, t in enumerate(np.cumsum([.62, .55, .48, .4, .34, .28, .24])):                 # the heart speeds up down the corridor
    if C['cor'] + t < C['fig'] - .05: put(fx, pk(S('heartbeat'), -14 + k * 1.0), C['cor'] + t - .45)
put(fx, pk(S('rush'), -2), C['fig'] + .05); put(fx, pk(S('candles_out'), -8), C['fig'] + .25); put(fx, pk(S('jump_stinger'), -2), C['blk'] - .32); put(fx, pk(S('boom_low'), -5), C['blk'] - .2)
fx[int(C['blk'] * SR):int(C['tw'] * SR)] *= 0; bed[int(C['blk'] * SR):int(C['tw'] * SR)] *= 0
# ---- twist ----
put(fx, pk(S('glitch'), -8), C['tw']); put(fx, pk(S('hit_tick'), -13), C['tw'] + .02); put(fx, pk(S('card_swish'), -15), C['tw'] + .22)
put(fx, pk(S('typing_fast')[:int(.6 * SR)], -20), C['tw'] + .5); put(fx, pk(S('bloop'), -16), C['tw'] + 1.0); put(fx, pk(S('success'), -17), C['tw'] + 1.2)
# ---- pitch ----
mb = S('music_box'); put(bed, pk(loop(mb, int((DUR - C['pitch']) * SR)), -17), C['pitch'], fin=.3, fout=.6)
put(bed, pk(loop(dr, int((DUR - C['pitch']) * SR)), -22), C['pitch'], fin=.5, fout=.6)
FOL = ws('pitch', 11) + .1
put(fx, pk(S('whip'), -14), ws('pitch', 6) - .15); put(fx, pk(S('shimmer_swell'), -18), ws('pitch', 9) - .1)
put(fx, pk(S('follow_click'), -8), FOL); put(fx, pk(S('dm_ding'), -12), ws('pitch', 15) - .05)
tick = S('hit_tick')[:int(.12 * SR)]; B0, B1 = ws('pitch', 21), we('pitch', 25) + .1
for k in range(12): put(fx, pk(filt(tick, f'asetrate={int(SR * 2 ** (k / 12))},aresample={SR}'), -16 + k * .4), B0 + (B1 - B0) * (k / 11) ** .8)
put(fx, pk(S('stamp'), -9), ws('pitch', 28) - .02)
put(fx, pk(S('whispers'), -14), DUR - .8, fin=.2, fout=.2); put(fx, pk(S('boom_low'), -9), DUR - .72)

mix = vo + bed + fx; mix[-int(.3 * SR):] *= np.linspace(1, 0, int(.3 * SR))[:, None]
os.makedirs('assets/mix', exist_ok=True); pre, out = f'assets/mix/pre_h{N}.wav', f'assets/mix/mix_h{N}.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_f32le', pre], input=mix.astype(np.float32).tobytes(), check=True)
def meas(p):
    s = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', s)[-1]), float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', s)[-1])
I0, _ = meas(pre); gain, ceil = -14.0 - I0, -2.0
for _ in range(10):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pre, '-af', f'volume={gain:.2f}dB,alimiter=limit={db(ceil):.4f}:attack=2:release=60:level=disabled', '-ar', str(SR), '-c:a', 'pcm_s24le', out], check=True)
    I1, TP1 = meas(out)
    if TP1 > -2.4: ceil -= .4; continue
    if abs(I1 + 14) <= .1: break
    gain += -14.0 - I1
print(f'H{N}: {I0:.1f} -> {I1:.1f} LUFS, TP {TP1:.1f}  dur {DUR}')
