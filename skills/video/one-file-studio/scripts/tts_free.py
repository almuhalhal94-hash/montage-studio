#!/usr/bin/env python3
"""One File Studio (Talal's copy): free voice takes with Microsoft Edge neural voices (edge-tts). No key, no account.

Usage:  python3 scripts/tts_free.py plan/lines.json [--out assets/vo/takes]
lines.json:
  {"voices": {"fahed": "ar-KW-FahedNeural", "hamed": "ar-SA-HamedNeural"}, "default": "fahed", "takes": 3,
   "rate": "-5%", "pitch": "+0Hz",
   "lines": [{"id": "hook", "speaker": "fahed", "text": "السلام عليكم يا شباب..."},
             {"id": "reply", "speaker": "hamed", "text": "وعليكم السلام...", "rate": "+0%"}]}
Dialogue: give each line a "speaker". Edge voices are deterministic, so the takes vary pace and pitch slightly
(take 1 as set, take 2 a bit slower and lower, take 3 a bit faster and higher); score_takes.py picks by numbers.
No [tone tags]: these voices ignore them, so they are stripped. Emotion comes from punctuation: commas, "..." , "!" and "؟".
Writes <out>/<id>_e<k>.mp3 and <out>/takes.json (same format the rest of the pipeline reads). Needs: pip install edge-tts.
Behind a proxy with its own CA, set SSL_CERT_FILE to the CA bundle."""
import os, re, sys, json, time, asyncio
if os.environ.get('SSL_CERT_FILE'):
    import certifi; certifi.where = lambda: os.environ['SSL_CERT_FILE']
import edge_tts
cfg = json.load(open(sys.argv[1])); out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'assets/vo/takes'
os.makedirs(out, exist_ok=True)
V = cfg.get('voices') or {'fahed': 'ar-KW-FahedNeural'}; D = cfg.get('default') or next(iter(V))
def shift(v, d, unit):
    n = int(re.sub(r'[^-+\d]', '', v) or 0) + d; return f"{'+' if n >= 0 else ''}{n}{unit}"
VAR = [(0, 0), (-6, -4), (6, 4)]
async def say(text, voice, rate, pitch, path): await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(path)
log = []
for line in cfg['lines']:
    spk = line.get('speaker', D); voice = V.get(spk, spk); text = re.sub(r'\[[^\]]*\]', '', line['text']).strip()
    rate = line.get('rate', cfg.get('rate', '+0%')); pitch = line.get('pitch', cfg.get('pitch', '+0Hz'))
    for k in range(1, int(cfg.get('takes', 3)) + 1):
        dr, dp = VAR[(k - 1) % 3]; p = f"{out}/{line['id']}_e{k}.mp3"
        r, pt = shift(rate, dr, '%'), shift(pitch, dp, 'Hz')
        for attempt in range(3):
            try: asyncio.run(say(text, voice, r, pt, p)); break
            except Exception as e: print('retry', line['id'], k, str(e)[:120]); time.sleep(3)
        else: sys.exit(f'failed: {line["id"]} take {k}')
        log.append({'file': p, 'line': line['id'], 'model': 'edge', 'speaker': spk, 'voice_id': voice, 'rate': r, 'pitch': pt, 'text': text})
        print(f"{line['id']:10s} {spk:8s} e{k} {r:>5s} {pt:>6s} {os.path.getsize(p)} bytes")
json.dump(log, open(f'{out}/takes.json', 'w'), indent=1, ensure_ascii=False)
print(f'{len(log)} takes -> {out}/takes.json')
