"""
Атлас светотени ткани из реального фото модели для 3D-вещи: слева вид спереди, справа сзади.
Яркость нормируется так, что основная ткань ≈ белый, складки, швы и карманы темнее; на сайте
цвет вещи умножается на атлас. Вне маски вещи пиксели заполняются ближайшей тканью (без ореолов кожи и фона).
Рядом пишется JSON: границы вещи по строкам атласа (для раскладки UV в photo_texture.py).

    python3 -I tools/3d/photo_atlas.py <public/photo-model/f> <top|bottom|feet|tshirt> <out.png> <out.json> [height]
(«tshirt» — экспериментальный: спинка верха без кокетки; на сайте не используется, выглядит хуже текущей футболки)
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, KIND, OUT_PNG, OUT_JSON = sys.argv[1:5]
H = int(sys.argv[5]) if len(sys.argv) > 5 else 1024
PAD = 6
DETAIL = 2.2
GAIN = float(__import__('os').environ.get('GAIN', 0.5))


def view(name):
    rgb = np.asarray(Image.open(f"{SRC}/{name}.webp").convert("RGB")).astype(np.float32) / 255
    m = np.asarray(Image.open(f"{SRC}/{name}-{KIND}-mask.png").convert("RGBA"))[..., 3] > 127
    m = ndimage.binary_opening(m, iterations=1)
    rows = np.where(m.any(1))[0]
    cols = np.where(m.any(0))[0]
    r0, r1 = rows[0], rows[-1] + 1
    c0, c1 = max(cols[0] - PAD, 0), min(cols[-1] + 1 + PAD, m.shape[1])
    rgb, m = rgb[r0:r1, c0:c1], m[r0:r1, c0:c1]
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    ref = np.percentile(lum[m], 90)
    shade = np.clip(lum / ref, 0, 1.0)
    # мягче тёмные пятна (ручка, тени под руками), складки остаются
    shade = 1 - (1 - shade) * 0.85
    # строчки и края карманов на фото тонкие: усиливаем мелкие детали, крупные тени чуть глубже
    base = ndimage.gaussian_filter(shade, 4)
    shade = np.clip(base ** 1.25 + DETAIL * (shade - base), 0, 1)
    # заполнение вне маски ближайшей тканью
    idx = ndimage.distance_transform_edt(~m, return_distances=False, return_indices=True)
    shade = shade[idx[0], idx[1]]
    # границы вещи по строкам (сглаженные), в пикселях кадра
    L = np.array([np.where(r)[0][0] if r.any() else np.nan for r in m], np.float32)
    R = np.array([np.where(r)[0][-1] + 1 if r.any() else np.nan for r in m], np.float32)
    ok = ~np.isnan(L)
    xs = np.arange(len(L))
    L = np.interp(xs, xs[ok], L[ok])
    R = np.interp(xs, xs[ok], R[ok])
    L = ndimage.median_filter(L, 9)
    R = ndimage.median_filter(R, 9)
    return shade, L, R


if KIND == "tshirt":
    # гладкая футболка: спинка медицинского верха без кокетки и D-кольца (верх кадра — отражение средней части)
    KIND = "top"
    shade, L, R = view("back")
    cut = int(shade.shape[0] * 0.3)
    shade = shade.copy()
    mid = int(shade.shape[0] * 0.5)  # корпус без рукавов: границы на середине высоты
    a, b = int(L[mid]) + 4, int(R[mid]) - 4
    shade[:cut, a:b] = shade[cut:2 * cut, a:b][::-1]
    views = [(shade, L, R), (shade[:, ::-1].copy(), shade.shape[1] - R, shade.shape[1] - L)]
else:
    views = [view("front"), view("back")]
tiles, meta, x = [], [], 0
for shade, L, R in views:
    h, w = shade.shape
    k = H / h
    W = max(8, int(round(w * k)))
    # калибровка под образцы цвета: светотень × GAIN в линейном пространстве, обратно в sRGB
    lin = np.clip(shade, 0, 1) ** 2.2 * GAIN
    srgb = lin ** (1 / 2.2)
    img = Image.fromarray((srgb * 255).round().astype(np.uint8)).resize((W, H), Image.LANCZOS)
    rows = np.linspace(0, h - 1, H)
    meta.append({"x0": x, "w": W, "L": (np.interp(rows, np.arange(h), L) * k + x).round(2).tolist(),
                 "R": (np.interp(rows, np.arange(h), R) * k + x).round(2).tolist()})
    tiles.append(img)
    x += W
atlas = Image.new("L", (x, H), 255)
ox = 0
for t in tiles:
    atlas.paste(t, (ox, 0))
    ox += t.width
atlas.convert("RGB").save(OUT_PNG)
json.dump({"W": x, "H": H, "views": meta}, open(OUT_JSON, "w"))
print("atlas", KIND, atlas.size)
