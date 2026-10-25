#!/usr/bin/env python3
"""One File Studio: download chosen images (e.g. Pinterest originals) and log them.

Usage:  python3 scripts/fetch_images.py picks.json assets/images/pinterest [--min 1600] [--rights test-only]
picks.json: [{"orig": "https://i.pinimg.com/originals/...jpg", "pin": "https://www.pinterest.com/pin/...", "alt": "...", "name": "truck_night"}]
Keeps images whose long side is >= --min px, names them by "name" (or a counter), converts to RGB JPEG q92, and adds
each to credits.json with source, size and rights ("test-only" = direction and unposted test cuts; "publishable" once cleared).
Then LOOK at every image; captions and alt text are not the image."""
import os, sys, json, io, urllib.request
from PIL import Image
picks = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
mn = int(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 1600
rights = sys.argv[sys.argv.index('--rights') + 1] if '--rights' in sys.argv else 'test-only'
man = json.load(open('credits.json')) if os.path.exists('credits.json') else {'assets': []}
kept = 0
for i, p in enumerate(picks):
    url = p['orig']; name = p.get('name') or f'img_{i:02d}'
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
        im = Image.open(io.BytesIO(data))
    except Exception as e:
        alt = url.replace('/originals/', '/736x/')
        try: data = urllib.request.urlopen(urllib.request.Request(alt, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read(); im = Image.open(io.BytesIO(data)); url = alt
        except Exception: print('skip (download failed)', name, str(e)[:80]); continue
    w, h = im.size
    if max(w, h) < mn: print(f'skip (too small {w}x{h})', name); continue
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im.convert('RGBA'), mask=im.convert('RGBA').split()[-1]); im = bg
    path = f'{out}/{name}.jpg'; im.convert('RGB').save(path, quality=92); kept += 1
    man['assets'].append({'path': path, 'source': url, 'page': p.get('pin', ''), 'alt': p.get('alt', ''), 'size': [w, h], 'rights': rights})
    print(f'kept {name} {w}x{h}')
json.dump(man, open('credits.json', 'w'), indent=1)
print(f'{kept}/{len(picks)} kept -> {out} (logged in credits.json, rights={rights})')
