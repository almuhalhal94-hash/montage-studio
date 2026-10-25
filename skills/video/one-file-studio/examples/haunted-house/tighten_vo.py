"""Close the long whisper pauses: any silence over 0.30 s becomes 0.16 s (soft fades), lead/tail trimmed. Then align words."""
import subprocess, numpy as np, json, os, sys
SR = 48000
PICK = {'hA': 'hA_t3', 'hB': 'hB2_t3', 'hC': 'hC2_t2', 'nocam': 'nocam2_t1', 'onefile': 'onefile2_t3', 'every': 'every_t3', 'pitch': 'pitch2_t3'}
def load(p): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-af', 'highpass=f=70', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout, np.float32).copy()
os.makedirs('assets/vo/tight', exist_ok=True); out = {}
for lid, take in PICK.items():
    x = load(f'assets/vo/takes/{take}.mp3'); hop = int(.01 * SR)
    env = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)]); db = 20 * np.log10(env + 1e-9)
    thr = max(-48, db.max() - 38); voiced = db > thr
    on = np.where(voiced)[0]; a, b = on[0], on[-1]
    segs, i = [], a
    while i <= b:                                   # walk voiced/silent runs
        j = i
        while j <= b and voiced[j] == voiced[i]: j += 1
        segs.append((voiced[i], i, j)); i = j
    pieces = []
    for v, s, e in segs:
        n = e - s
        if v or n * .01 <= .30: pieces.append(x[s * hop:e * hop])
        else:
            keep = int(.16 * SR); seg = x[s * hop:e * hop]; h = keep // 2
            y = np.concatenate([seg[:h] * np.linspace(1, 0, h), seg[-h:] * np.linspace(0, 1, h)]); pieces.append(y)
    y = np.concatenate([np.zeros(int(.02 * SR), np.float32)] + pieces)
    p = f'assets/vo/tight/{lid}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', p], input=y.astype(np.float32).tobytes(), check=True)
    out[lid] = round(len(y) / SR, 2); print(lid, take, 'raw', round(len(x) / SR, 2), '-> tight', out[lid])
json.dump(out, open('plan/vo_tight_durations.json', 'w'))
