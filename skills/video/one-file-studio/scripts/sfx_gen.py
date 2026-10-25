#!/usr/bin/env python3
"""One File Studio: generate sound effects to order (ElevenLabs sound generation).

Usage:  python3 scripts/sfx_gen.py plan/sfx.json [--out assets/sfx]
sfx.json: [{"name": "sizzle", "text": "Close-up sizzle of steak on a hot charcoal grill, crisp crackling", "seconds": 1.6}, ...]
seconds must be >= 0.5 (shorter returns HTTP 400; trim in the mix). Prints each file's peak and mean so near-silent
results can be regenerated. Needs ELEVENLABS_API_KEY."""
import os, sys, json, time, subprocess, urllib.request
L = json.load(open(sys.argv[1])); out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'assets/sfx'
os.makedirs(out, exist_ok=True); key = os.environ.get('ELEVENLABS_API_KEY') or sys.exit('ELEVENLABS_API_KEY is not set')
for fx in L:
    p = f"{out}/{fx['name']}.mp3"; secs = max(.5, float(fx.get('seconds', 1.0)))
    body = json.dumps({'text': fx['text'], 'duration_seconds': secs, 'prompt_influence': fx.get('influence', .55)}).encode()
    req = urllib.request.Request('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r: open(p, 'wb').write(r.read())
            break
        except Exception as e: print('retry', fx['name'], str(e)[:120]); time.sleep(3)
    else: print('FAILED', fx['name']); continue
    s = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    peak = next((l.split(':')[-1].strip() for l in s.splitlines() if 'max_volume' in l), '?'); mean = next((l.split(':')[-1].strip() for l in s.splitlines() if 'mean_volume' in l), '?')
    print(f"{fx['name']:16s} peak {peak:>9s} mean {mean:>9s}")
json.dump(L, open(f'{out}/prompts.json', 'w'), indent=1)
