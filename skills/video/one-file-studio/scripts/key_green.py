#!/usr/bin/env python3
"""One File Studio: key a green-screen screen out of a photo and find its exact corners.

Usage:  python3 scripts/key_green.py assets/images/phone.jpg   ->  assets/images/phone_fg.png + corners printed
Soft key on greenness (g - max(r, b)), green spill removed at the edges. Corners come from straight lines fitted to the
four edges of the keyed region and intersected (robust to rounded corners). Put your UI behind the PNG at those corners:
fingers and thumbs that overlap the screen stay in front automatically."""
import sys, numpy as np
from PIL import Image
src = sys.argv[1]; im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
r, g, b = im[..., 0], im[..., 1], im[..., 2]; gm = g - np.maximum(r, b)
a = 1 - np.clip((gm - .18) / (.42 - .18), 0, 1); g2 = np.where(gm > 0, np.minimum(g, np.maximum(r, b) + .02), g)
out = src.rsplit('.', 1)[0] + '_fg.png'; Image.fromarray((np.dstack([r, g2, b, a]) * 255).astype(np.uint8)).save(out)
m = gm > .3; ys, xs = np.nonzero(m)
if not len(xs): sys.exit('no green found')
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); hx, hy = (x1 - x0) * .2, (y1 - y0) * .2
Lp, Rp, Tp, Bp = [], [], [], []
for y in range(int(y0 + hy), int(y1 - hy)):
    row = np.nonzero(m[y])[0]
    if len(row): Lp.append((y, row.min())); Rp.append((y, row.max()))
for x in range(int(x0 + hx), int(x1 - hx)):
    col = np.nonzero(m[:, x])[0]
    if len(col): Tp.append((x, col.min())); Bp.append((x, col.max()))
fit = lambda P: np.polyfit([p[0] for p in P], [p[1] for p in P], 1)
lA, rA, tA, bA = fit(Lp), fit(Rp), fit(Tp), fit(Bp)
def inter(v, h):
    a1, b1 = v; c1, d1 = h; y = (c1 * b1 + d1) / (1 - c1 * a1); return round(float(a1 * y + b1), 1), round(float(y), 1)
Q = [inter(lA, tA), inter(rA, tA), inter(rA, bA), inter(lA, bA)]
print(out); print('screen corners TL, TR, BR, BL (px):', Q)
