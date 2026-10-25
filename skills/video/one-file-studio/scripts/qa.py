#!/usr/bin/env python3
"""One File Studio: QA a finished video.

Usage:  python3 scripts/qa.py out/<name>.mp4
Reports streams, duration, integrated loudness (target -14 LUFS) and true peak (<= -1.5 dBTP), near-black frames
(confirm they are deliberate), identical consecutive frames (stalls), and writes contact sheets (1 frame per second)
to out/sheets/<name>_<n>.jpg."""
import os; LANG = os.environ.get('OFS_LANG', 'ar'); WMODEL = os.environ.get('OFS_WHISPER') or ('distil-large-v3' if LANG == 'en' else 'large-v3-turbo')   # Talal's copy: Arabic by default
import os, re, sys, subprocess, numpy as np
try:
    from PIL import Image, ImageDraw
except ImportError: Image = None            # the voice venv has no Pillow: sheets are skipped there
V = sys.argv[1]; name = os.path.splitext(os.path.basename(V))[0]
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels', '-show_entries', 'format=duration', '-of', 'compact', V], capture_output=True, text=True).stdout.strip())
s = subprocess.run(['ffmpeg', '-hide_banner', '-i', V, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', s); P = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', s)
if not I or not P: print('loudness: no audio measured')
elif float(I[-1]) < -60: print(f'loudness {float(I[-1]):.1f} LUFS (silent track)')
else: print(f'loudness {float(I[-1]):.1f} LUFS | true peak {float(P[-1]):.1f} dBTP' + ('' if -15 <= float(I[-1]) <= -13 and float(P[-1]) <= -1.5 else '   <-- check'))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', V, '-vf', 'scale=64:36,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 36 * 64).astype(np.int16); fps = 30.0
r = re.findall(r'r_frame_rate=(\d+)/(\d+)', subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'compact', V], capture_output=True, text=True).stdout)
if r: fps = int(r[0][0]) / int(r[0][1])
luma = fr.mean(1); same = [i for i in range(1, len(fr)) if np.abs(fr[i] - fr[i - 1]).max() == 0]
print(f'frames {len(fr)} | mean luma min/max {luma.min():.1f} {luma.max():.1f}')
print('near-black frames (luma < 8):', [round(i / fps, 2) for i in np.nonzero(luma < 8)[0]][:30])
print(f'identical consecutive frames: {len(same)}', [round(i / fps, 2) for i in same][:20])
os.makedirs('out/sheets', exist_ok=True); dur = len(fr) / fps; T = [t + .5 for t in range(int(dur))] if Image else []; per = 36
for k in range(0, len(T), per):
    tiles = []
    for t in T[k:k + per]:
        p = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', V, '-frames:v', '1', '-vf', 'scale=320:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
        if p:
            import io; im = Image.open(io.BytesIO(p)).convert('RGB'); ImageDraw.Draw(im).text((4, 2), f'{t:.1f}', fill='yellow'); tiles.append(im)
    if not tiles: continue
    w, h = tiles[0].size; cols = 6; S = Image.new('RGB', (w * cols, h * ((len(tiles) + cols - 1) // cols)))
    for i, im in enumerate(tiles): S.paste(im, ((i % cols) * w, (i // cols) * h))
    S.save(f'out/sheets/{name}_{k // per}.jpg', quality=85)
print(f'sheets: out/sheets/{name}_*.jpg' if Image else 'sheets: skipped (no Pillow in this Python)')
# ---- intelligibility: does the FINAL mix still say the script? (music and crowds can turn "skill" into "scale") ----
if '--script' in sys.argv:
    import json, difflib
    words = json.load(open(sys.argv[sys.argv.index('--script') + 1]))
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print('intelligibility: skipped (faster_whisper missing: run qa.py with the venv that has it)'); sys.exit(0)
    a = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', V, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).copy()
    from textnorm import tokens
    m = WhisperModel('small', compute_type='int8'); bad = []
    for line in dict.fromkeys(w['line'] for w in words):          # each line on its own clip (whole-file passes drop words at random)
        lw = [w for w in words if w['line'] == line]; t0, t1 = max(0, lw[0]['s'] - .35), lw[-1]['e'] + .35
        clip = np.concatenate([np.zeros(4000, np.float32), a[int(t0 * 16000):int(t1 * 16000)]])
        got = tokens(' '.join(w.word for sg in m.transcribe(clip, word_timestamps=True, language=LANG)[0] for w in sg.words)); want = tokens(' '.join(w['w'] for w in lw))
        sm = difflib.SequenceMatcher(None, want, got); r = sm.ratio()
        miss = []
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'delete': miss += want[i1:i2]
            elif op == 'replace':                                  # invented names ("VYRA" heard as "virah") pass on spelling similarity
                for k, i in enumerate(range(i1, i2)):
                    h = got[j1 + k] if j1 + k < j2 else ''
                    if difflib.SequenceMatcher(None, want[i], h).ratio() < .6: miss.append(want[i])
        if miss: bad.append(line)
        print(f'  {line:10s} {r:.2f}  heard: {" ".join(got)[:70]}' + (f'   <-- misheard: {", ".join(miss)}' if miss else ''))
    print('intelligibility:', 'OK' if not bad else f'CHECK {bad} (raise the voice / duck the bed under those words, then re-mix)')
