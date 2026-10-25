#!/usr/bin/env python3
"""One File Studio: voice takes, one ElevenLabs request per line per model (v4 + v3 by default), several takes each.

Usage:  python3 scripts/tts_takes.py plan/lines.json [--out assets/vo/takes]
lines.json:
  {"voice_id": "<id>", "takes": 3, "models": ["eleven_v4", "eleven_v3"], "stability": 0.45, "style": 0.3, "speed": 1.0,
   "lines": [{"id": "hook", "text": "[curious] This taco truck... had no name. [pause] No logo. [sighs] Nothing."}, ...]}
On v3 a " [short pause]" is appended so the model never clips the last word (v4 ends cleanly without it).
Writes <out>/<id>_<m>t<k>.mp3 (m = v4, v3, ...) and <out>/takes.json. Neither model wins every line (10/12: v4 is far more
expressive but sometimes whispers short lines), so record both and let score_takes.py pick by numbers. Needs ELEVENLABS_API_KEY in the environment (load .env first)."""
import os, sys, json, time, urllib.request
cfg = json.load(open(sys.argv[1])); out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'assets/vo/takes'
os.makedirs(out, exist_ok=True); key = os.environ.get('ELEVENLABS_API_KEY') or sys.exit('ELEVENLABS_API_KEY is not set (set -a; . ./.env; set +a)')
vs = {'stability': cfg.get('stability', 0.45), 'similarity_boost': cfg.get('similarity', 0.8), 'style': cfg.get('style', 0.3), 'use_speaker_boost': True, 'speed': cfg.get('speed', 1.0)}
log, sent = [], 0
MODELS = cfg.get('models') or [cfg.get('model', 'eleven_v4')]
for line in cfg['lines']:
  for model in line.get('models', MODELS):
    tag = model.replace('eleven_', '').replace('multilingual_', 'm')
    for k in range(1, cfg.get('takes', 3) + 1):
        p = f"{out}/{line['id']}_{tag}t{k}.mp3"
        st = {**vs, **line.get('settings', {})}
        if model.startswith('eleven_v4'): st = {kk: st[kk] for kk in ('stability', 'similarity_boost') if kk in st}   # v4 takes only these two
        body = json.dumps({'text': line['text'] + ('' if model.startswith('eleven_v4') else ' [short pause]'), 'model_id': model, 'voice_settings': st}).encode()
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{line.get('voice_id', cfg['voice_id'])}?output_format=mp3_44100_128",
                                     data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as r: open(p, 'wb').write(r.read())
                break
            except Exception as e: print('retry', line['id'], model, k, str(e)[:120]); time.sleep(3)
        else: sys.exit(f'failed: {line["id"]} {model} take {k}')
        sent += len(line['text']); log.append({'file': p, 'line': line['id'], 'model': model, 'voice_id': line.get('voice_id', cfg['voice_id']), 'text': line['text']})
        print(line['id'], tag, k, os.path.getsize(p), 'bytes')
json.dump(log, open(f'{out}/takes.json', 'w'), indent=1, ensure_ascii=False)
print(f'{len(log)} takes, {sent} characters -> {out}/takes.json')
