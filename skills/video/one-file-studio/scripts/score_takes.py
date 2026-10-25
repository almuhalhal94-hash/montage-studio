#!/usr/bin/env python3
"""One File Studio: score voice takes by numbers, not vibes.

Usage:  python3 scripts/score_takes.py assets/vo/takes/takes.json
Per take: match (script vs transcript), tail (quiet seconds after the last sound; < 0.12 = clipped, reject),
pitch (semitone std = expressiveness), swing (dB range between words), voiced (share of voiced frames; whispers are low),
speech (first word to last). Writes scores.json next to takes.json and prints the best take per line."""
import os; LANG = os.environ.get('OFS_LANG', 'ar'); WMODEL = os.environ.get('OFS_WHISPER') or ('distil-large-v3' if LANG == 'en' else 'large-v3-turbo')   # Talal's copy: Arabic by default
import sys, json, re, subprocess, difflib, numpy as np, librosa
from faster_whisper import WhisperModel
T = json.load(open(sys.argv[1])); m = WhisperModel(WMODEL, device='cpu', compute_type='int8')
from textnorm import tokens as norm
def load16(p): return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout, np.float32).copy()
out = []
for t in T:
    y = load16(t['file']); segs, _ = m.transcribe(t['file'], word_timestamps=True, language=LANG, beam_size=5); W = [w for s in segs for w in s.words]
    match = difflib.SequenceMatcher(None, norm(t['text']), norm(' '.join(w.word for w in W))).ratio()
    env = np.array([np.sqrt((y[i:i + 160] ** 2).mean()) for i in range(0, len(y) - 160, 160)]); on = np.nonzero(env > env.max() * .03)[0]
    tail = len(y) / 16000 - on[-1] * .01 if len(on) else 0
    f0, vf, _ = librosa.pyin(y, fmin=70, fmax=420, sr=16000, frame_length=1024, hop_length=256); f = f0[~np.isnan(f0)]
    pitch = float(np.std(12 * np.log2(f / np.median(f)))) if len(f) > 10 else 0.0
    e = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]; k = min(len(e), len(vf)); sp = e[:k] > np.percentile(e[:k], 40)
    voiced = float(vf[:k][sp].mean()) if sp.any() else 0.0
    wl = [20 * np.log10(np.sqrt((y[int(w.start * 16000):int(w.end * 16000)] ** 2).mean()) + 1e-9) for w in W if w.end - w.start > .08]
    swing = float(np.percentile(wl, 90) - np.percentile(wl, 10)) if len(wl) > 2 else 0.0
    speech = (W[-1].end - W[0].start) if W else 0.0
    Sp = np.abs(librosa.stft(y, n_fft=1024)) ** 2; fr = librosa.fft_frequencies(sr=16000, n_fft=1024); act = Sp.sum(0) > np.percentile(Sp.sum(0), 60)
    body = float(Sp[(fr > 80) & (fr < 400)][:, act].sum() / (Sp[fr > 2000][:, act].sum() + 1e-9))   # voiced speech ~2-12 (dry deadpan reads ~2), a real whisper ~0.2-1.2
    r = {**t, 'match': round(match, 3), 'tail': round(tail, 2), 'pitch': round(pitch, 2), 'swing': round(swing, 1), 'voiced': round(voiced, 2), 'speech': round(speech, 2), 'body': round(body, 2), 'asr': ' '.join(w.word.strip() for w in W)}
    out.append(r); print(f"{t['line']:8s} {t['file'].split('/')[-1]:14s} match {match:.2f} tail {tail:4.2f}s pitch {pitch:5.2f} swing {swing:4.1f}dB voiced {voiced:.2f} body {body:5.2f} speech {speech:4.2f}s{'  WHISPERED' if body < 1.5 else ''} | {r['asr'][:70]}")
json.dump(out, open(sys.argv[1].replace('takes.json', 'scores.json'), 'w'), indent=1, ensure_ascii=False)
print('\nbest per line (match 1, tail >= 0.12, not whispered unless asked; whispers: lowest voiced; else highest pitch + swing/3):')
for line in dict.fromkeys(r['line'] for r in out):
    whisper = '[whisper' in next(r for r in out if r['line'] == line)['text']
    ok = [r for r in out if r['line'] == line and r['match'] >= .99 and r['tail'] >= .12 and (whisper or r['body'] >= 1.5)]   # an unwanted whisper is a reject
    if not ok: print(f'  {line:8s} NO CLEAN TAKE, regenerate (try the other model, drop the style tag, raise stability)'); continue
    best = min(ok, key=lambda r: (r['voiced'], r['speech'])) if whisper else max(ok, key=lambda r: (r['pitch'] + r['swing'] / 3, -r['speech']))
    print(f"  {line:8s} {best['file'].split('/')[-1]}")
