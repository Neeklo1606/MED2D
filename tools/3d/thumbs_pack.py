"""PNG из thumbs.mjs → public/products/<slug>.webp (тень, с альфой) и <slug>-mask.webp (только ткань)."""
import sys
from pathlib import Path

from PIL import Image

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for f in sorted(src.glob("*.png")):
    im = Image.open(f).convert("RGBA")
    if f.stem.endswith("-mask"):
        a = im.getchannel("A")
        out = Image.new("RGBA", im.size, (0, 0, 0, 0))
        out.putalpha(a)
        out.save(dst / f"{f.stem}.webp", "WEBP", quality=80, method=6)
    else:
        # растягиваем тон: светлые места ткани → белые (цвет на сайте не «сереет»), складки контрастнее
        import numpy as np
        a = np.asarray(im).astype(np.float32)
        al = a[..., 3] > 8
        lum = a[..., :3].mean(-1)
        lo, hi = np.percentile(lum[al], 2), np.percentile(lum[al], 97)
        k = np.clip((a[..., :3] - lo) / max(hi - lo, 1), 0, 1) ** 1.15
        a[..., :3] = (0.28 + 0.72 * k) * 255
        Image.fromarray(a.astype(np.uint8), "RGBA").save(dst / f"{f.stem}.webp", "WEBP", quality=86, method=6)
    print(f.stem, (dst / f"{f.stem}.webp").stat().st_size // 1024, "KB")
