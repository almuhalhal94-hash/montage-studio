#!/usr/bin/env python3
"""One File Studio: assemble the narration from the chosen takes and write the timing every scene reads.

Usage:  python3 scripts/vo_assemble.py plan/vo.json
vo.json:
  {"takes": "assets/vo/takes/takes.json",
   "order": ["hook", "gave", "built"],
   "pick": {"hook": "t3", "gave": "t1"},          # take suffix per line
   "gap_before": {"hook": 1.25, "gave": 0.45},    # seconds of picture before each line (first = start time)
   "cap": {"hook": 0.4},                          # longest quiet pause kept inside a line (default 0.35)
   "tempo": {"gave": 1.08},                       # pitch-preserving speed-up per line (default 1.0)
   "gain": {"reveal": -2},                        # dB per line after leveling
   "level": -19,                                  # speech level (dBFS RMS of active samples)
   "out": "assets/vo/narration.wav", "words": "plan/vo_words.json", "lines": "plan/vo_lines.json"}
Per line: script words forced onto the transcript timings, cut where the sound really ends (30 ms of sustained energy,
ignoring the file's last 80 ms where encoders leave a click), quiet runs inside the line shortened to `cap`, tempo,
leveling. Prints the timeline."""
import os; LANG = os.environ.get('OFS_LANG', 'ar'); WMODEL = os.environ.get('OFS_WHISPER') or ('distil-large-v3' if LANG == 'en' else 'large-v3-turbo')   # Talal's copy: Arabic by default
import sys, json, re, subprocess, difflib, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
C = json.load(open(sys.argv[1])); SR = 48000; hop = int(.01 * SR)
TK = json.load(open(C['takes'])); TAKES = {}
for t in TK:
    if t['file'].endswith(f"{t['line']}_{C['pick'].get(t['line'], 't1')}.mp3"): TAKES[t['line']] = t
SCRIPT = {k: re.sub(r'\[[^\]]*\]\s*', '', t['text']).strip() for k, t in TAKES.items()}
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower().replace('fifty', '50'))
def load(p, tempo=1.0):
    af = ['-af', f'atempo={tempo}'] if tempo != 1.0 else []
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, *af, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout, np.float32).copy()
def force(script, words):
    sw = script.split(); a = [norm(x) for x in sw]; b = [norm(w['w']) for w in words]; out = [None] * len(sw)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): out[i1 + k] = (words[j1 + k]['s'], words[j1 + k]['e'])
        elif tag == 'replace' and j2 > j1:
            s, e = words[j1]['s'], words[j2 - 1]['e']; n = i2 - i1
            for k in range(n): out[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    for i in range(len(out)):
        if out[i] is None:
            prev = next((out[j][1] for j in range(i - 1, -1, -1) if out[j]), 0.0); nxt = next((out[j][0] for j in range(i + 1, len(out)) if out[j]), prev + .3)
            out[i] = (prev, max(prev + .05, nxt - .02))
    return [{'w': w, 's': s, 'e': e} for w, (s, e) in zip(sw, out)], difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()
m = WhisperModel(WMODEL, device='cpu', compute_type='int8')
narr = np.zeros(int(300 * SR), np.float32); words_out, lines_out = [], []; t = 0.0
for i, lid in enumerate(C['order']):
    tk = TAKES[lid]; segs, _ = m.transcribe(tk['file'], word_timestamps=True, language=LANG, beam_size=5)
    asr = [{'w': w.word.strip(), 's': w.start, 'e': w.end} for s in segs for w in s.words]
    w, score = force(SCRIPT[lid], asr); tp = C.get('tempo', {}).get(lid, 1.0); y = load(tk['file'], tp); w = [{**x, 's': x['s'] / tp, 'e': x['e'] / tp} for x in w]
    env = np.array([np.sqrt((y[j:j + hop] ** 2).mean()) for j in range(0, len(y) - hop, hop)]); on = env[:-8] > env.max() * .03
    on3 = on[:-2] & on[1:-1] & on[2:]; aud_end = (np.nonzero(on3)[0][-1] + 2) * .01 if on3.any() else w[-1]['e']
    s0 = max(0.0, w[0]['s'] - .08); e0 = min(len(y) / SR, max(w[-1]['e'] + .3, aud_end + .14))
    seg = y[int(s0 * SR):int(e0 * SR)].copy(); w = [{**x, 's': x['s'] - s0, 'e': x['e'] - s0} for x in w]
    cap = C.get('cap', {}).get(lid, .35); env = np.array([np.sqrt((seg[j:j + hop] ** 2).mean()) for j in range(0, len(seg), hop)]); thr = env.max() * .03
    for k in range(len(w) - 2, -1, -1):
        q = [j for j in range(int(w[k]['e'] * 100), min(int(w[k + 1]['s'] * 100), len(env))) if env[j] < thr]
        runs, run = [], []
        for j in q:
            if run and j != run[-1] + 1: runs.append(run); run = []
            run.append(j)
        if run: runs.append(run)
        if not runs: continue
        r = max(runs, key=len); L = len(r) / 100 - cap
        if L <= .02: continue
        c0 = int((r[0] / 100 + cap / 2) * SR); c1 = c0 + int(L * SR); xf = int(.01 * SR)
        seg = np.concatenate([seg[:c0], seg[c0:c0 + xf] * np.linspace(1, 0, xf) + seg[c1:c1 + xf] * np.linspace(0, 1, xf), seg[c1 + xf:]])
        for j in range(k + 1, len(w)): w[j] = {**w[j], 's': w[j]['s'] - L, 'e': w[j]['e'] - L}
    # second pass: a quiet run longer than cap anywhere between the first and last word (the aligner sometimes stretches a
    # word over a pause, hiding silence inside its span) is cut to cap; word times after the cut move back
    while True:
        env = np.array([np.sqrt((seg[j:j + hop] ** 2).mean()) for j in range(0, len(seg), hop)]); qq = env < thr
        i0, i1 = int(w[0]['s'] * 100) + 5, int(w[-1]['e'] * 100) - 5; best = None; j = i0
        while j < i1:
            if qq[j]:
                k = j
                while k < i1 and qq[k]: k += 1
                if (k - j) / 100 > cap + .02 and (best is None or k - j > best[1] - best[0]): best = (j, k)
                j = k
            else: j += 1
        if not best: break
        L = (best[1] - best[0]) / 100 - cap; c0 = int((best[0] / 100 + cap / 2) * SR); c1 = c0 + int(L * SR); xf = int(.01 * SR); tc = c0 / SR
        seg = np.concatenate([seg[:c0], seg[c0:c0 + xf] * np.linspace(1, 0, xf) + seg[c1:c1 + xf] * np.linspace(0, 1, xf), seg[c1 + xf:]])
        w = [{**x, 's': x['s'] - (L if x['s'] >= tc else 0), 'e': x['e'] - (L if x['e'] > tc else 0)} for x in w]
    env = np.array([np.sqrt((seg[j:j + hop] ** 2).mean()) for j in range(0, len(seg), hop)]); run = longest = 0
    for v in (env[int(w[0]['e'] * 100):int(w[-1]['s'] * 100)] < thr): run = run + 1 if v else 0; longest = max(longest, run)
    fi, fo = int(.006 * SR), int(.05 * SR); seg[:fi] *= np.linspace(0, 1, fi); seg[-fo:] *= np.linspace(1, 0, fo) ** 2
    act = seg[np.abs(seg) > np.abs(seg).max() * .05]; g = C.get('level', -19) - 20 * np.log10(np.sqrt((act ** 2).mean()) + 1e-9) + C.get('gain', {}).get(lid, 0)
    seg *= 10 ** (g / 20)
    gap = C.get('gap_before', {}).get(lid, .4); at = gap if i == 0 else t + gap
    o = int(at * SR); narr[o:o + len(seg)] += seg
    for x in w: words_out.append({'w': x['w'], 's': round(x['s'] + at, 3), 'e': round(x['e'] + at, 3), 'line': lid})
    lines_out.append({'id': lid, 'start': round(at, 3), 'end': round(at + len(seg) / SR, 3), 'src': tk['file'], 'match': round(score, 3), 'longest_pause': longest / 100, 'text': SCRIPT[lid]})
    t = at + len(seg) / SR
end = t + .05; narr = narr[:int(end * SR)]
sf.write(C.get('out', 'assets/vo/narration.wav'), narr, SR, subtype='PCM_24')
json.dump(words_out, open(C.get('words', 'plan/vo_words.json'), 'w'), indent=0); json.dump(lines_out, open(C.get('lines', 'plan/vo_lines.json'), 'w'), indent=1)
for l in lines_out: print(f"{l['id']:8s} {l['start']:6.2f}-{l['end']:6.2f}  match {l['match']:.2f}  longest pause {l['longest_pause']:.2f}s | {l['text'][:60]}")
print('narration', round(end, 2), 's')
