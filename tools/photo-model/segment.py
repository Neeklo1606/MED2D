import sys, json
from PIL import Image, ImageFilter
import numpy as np
src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
im = np.array(img).astype(float) / 255
r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
mx = im[..., :3].max(2); mn = im[..., :3].min(2)
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
d = np.maximum(mx - mn, 1e-6)
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
warm = (h < 50) | (h > 345)
skin_raw = ((((h >= 6) & (h < 50)) & (s > 0.12)) | (warm & (s > 0.17))) & (a > 0.5)
# Морфологическое открытие: убираем мелкие «островки кожи» в тенях складок ткани
sk = Image.fromarray((skin_raw * 255).astype(np.uint8))
sk = sk.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(13))
opened = np.array(sk) > 127
near = np.array(Image.fromarray((opened * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17))) > 127
skin = (opened & skin_raw) | (opened & (s > 0.08) & (h >= 6) & (h < 50)) | (warm & (s > 0.17) & (a > 0.5) & near)
H, W = a.shape
ys = np.arange(H)[:, None].repeat(W, 1); xs = np.arange(W)[None, :].repeat(H, 0)
views = {"front": (0, 448, 581, 1092, 232), "back": (448, 896, 607, 1110, 236)}
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
meta = {}
for name, (x0, x1, hem, shoe, neck) in views.items():
    inview = (xs >= x0) & (xs < x1) & (a > 0.02)
    cloth = inview & ~skin
    parts = {
        "top": cloth & (ys < hem) & (ys >= neck),
        "bottom": cloth & (ys >= hem) & (ys < shoe),
        "feet": cloth & (ys >= shoe),
    }
    sub = slice(None), slice(x0, x1)
    base = img.crop((x0, 0, x1, H))
    base.save(f"{out}/{name}.webp", quality=90, method=6)
    meta[name] = {"w": x1 - x0, "h": H}
    for p, m in parts.items():
        m = m[sub]
        # мягкий край маски
        ma = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        ma = np.minimum(np.array(ma).astype(float) / 255, a[sub])
        L = lum[sub]
        ref = np.percentile(L[m], 92) if m.any() else 1
        shade = np.clip(L / ref, 0, 1.15)
        sh = np.clip(shade, 0, 1)
        # слой тени: серый по яркости, альфа = маска
        rgba = np.dstack([sh, sh, sh, ma])
        Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(f"{out}/{name}-{p}-shade.webp", quality=88, method=6, lossless=False)
        mask = np.dstack([np.ones_like(ma)] * 3 + [ma])
        Image.fromarray((mask * 255).astype(np.uint8), "RGBA").save(f"{out}/{name}-{p}-mask.png", optimize=True)
json.dump(meta, open(f"{out}/meta.json", "w"))
print(meta)
