#!/usr/bin/env python3
"""One File Studio: check the first 3 seconds of any video, where a reel is won or lost.

Usage:  python3 scripts/hook_check.py out/a.mp4 [out/b.mp4 ...]   (run it with the Python that has faster_whisper for the word timing)
Per video:
  frame0   detail of the very first frame (luma spread + edge density). A blank or near-blank frame 0 is a thumbnail you can't use.
  move     how much the picture changes in the first 0.5 s (a frozen open reads as a still).
  cuts3    picture changes over 25% in the first 3 s (energy).
  sound    when the first sound passes -40 dBFS, and the first second's loudness vs the whole video.
  word1    when the first spoken word starts (faster-whisper + VAD on the first 4 s; reads up to ~0.25 s early). The bar is 1.3 s or earlier.
Flags: FRAME0_BLANK, STATIC_OPEN, LATE_SOUND, QUIET_OPEN, SLOW_FIRST_WORD. Exit 1 if any video is flagged."""
import os; LANG = os.environ.get('OFS_LANG', 'ar'); WMODEL = os.environ.get('OFS_WHISPER') or ('distil-large-v3' if LANG == 'en' else 'large-v3-turbo')   # Talal's copy: Arabic by default
import sys, subprocess, re, numpy as np
def frames(v, t=3.0, w=160, h=90):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', str(t), '-i', v, '-vf', f'fps=30,scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
def audio(v, t=None):
    a = ['ffmpeg', '-v', 'error'] + (['-t', str(t)] if t else []) + ['-i', v, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(a, capture_output=True).stdout, np.float32)
def lufs(v, t=None):
    a = ['ffmpeg', '-hide_banner'] + (['-t', str(t)] if t else []) + ['-i', v, '-af', 'ebur128', '-f', 'null', '-']
    s = subprocess.run(a, capture_output=True, text=True).stderr; m = re.findall(r'I:\s+(-?[\d.]+) LUFS', s); return float(m[-1]) if m else -99
try:
    from faster_whisper import WhisperModel; M = WhisperModel('small', compute_type='int8')
except ImportError: M = None
bad = 0
print(f"{'video':44s} {'frame0':>7s} {'move':>6s} {'cuts3':>5s} {'sound':>6s} {'open dB':>8s} {'word1':>6s}  flags")
for v in sys.argv[1:]:
    F = frames(v); f0 = F[0]
    detail = float(f0.std()) + 4 * float(np.abs(np.diff(f0, axis=1)).mean())
    move = float(np.abs(F[min(15, len(F) - 1)] - F[0]).mean()); d = np.abs(np.diff(F, axis=0)).mean((1, 2)); cuts = int((d > 25).sum())
    a = audio(v, 3); env = np.array([np.sqrt((a[i:i + 160] ** 2).mean()) for i in range(0, len(a) - 160, 160)]); db = 20 * np.log10(env + 1e-9)
    s0 = float(np.argmax(db > -40) * .01) if (db > -40).any() else 9.9
    open_vs = lufs(v, 1.0) - lufs(v)
    w1 = None
    if M:
        segs, _ = M.transcribe(audio(v, 4), word_timestamps=True, language=LANG, vad_filter=True); ws = [w for sg in segs for w in sg.words]; w1 = ws[0].start if ws else None   # without VAD, any sound before the voice snaps word 1 to 0.00 s
    fl = []
    if detail < 12: fl.append('FRAME0_BLANK')
    if move < 2.5 and cuts == 0: fl.append('STATIC_OPEN')
    if s0 > .4: fl.append('LATE_SOUND')
    if open_vs < -8: fl.append('QUIET_OPEN')
    if w1 is not None and w1 > 1.3: fl.append('SLOW_FIRST_WORD')
    bad += bool(fl); name = v.split('/')[-1][:44]
    print(f"{name:44s} {detail:7.1f} {move:6.1f} {cuts:5d} {s0:5.2f}s {open_vs:+7.1f} {('%.2fs' % w1) if w1 is not None else '  n/a':>6s}  {' '.join(fl) or 'ok'}")
sys.exit(1 if bad else 0)
