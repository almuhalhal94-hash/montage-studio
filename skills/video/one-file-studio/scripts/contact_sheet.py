#!/usr/bin/env python3
"""One File Studio: contact sheet of stills (labels = file names, e.g. t9.50).

Usage:  python3 scripts/contact_sheet.py cache/stills cache/sheet [--cols 4] [--width 480] [--per 16]
Writes cache/sheet_1.jpg, cache/sheet_2.jpg, ... Open them and look at every frame."""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; arg = lambda k, v: int(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else v
cols, wid, per = arg('--cols', 4), arg('--width', 480), arg('--per', 16)
key = lambda p: (0, float(os.path.basename(p)[1:].rsplit('.', 1)[0])) if os.path.basename(p).startswith('t') else (1, os.path.basename(p))
fs = sorted(glob.glob(d + '/*.jpg') + glob.glob(d + '/*.png'), key=key)
for k in range(0, len(fs), per):
    chunk = fs[k:k + per]; ims = [Image.open(f).convert('RGB') for f in chunk]; hh = max(int(im.size[1] * wid / im.size[0]) for im in ims)
    S = Image.new('RGB', (cols * wid, hh * ((len(ims) + cols - 1) // cols)), 'black'); D = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(chunk, ims)):
        im = im.resize((wid, int(im.size[1] * wid / im.size[0]))); x, y = (i % cols) * wid, (i // cols) * hh; S.paste(im, (x, y))
        D.rectangle([x, y, x + 86, y + 18], fill='black'); D.text((x + 4, y + 3), os.path.basename(f).rsplit('.', 1)[0], fill='yellow')
    S.save(f'{out}_{k // per + 1}.jpg', quality=85); print(f'{out}_{k // per + 1}.jpg')
