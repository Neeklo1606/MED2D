"""
Доводка GLB манекена для веба (после экспорта из Blender):
  * режимы прозрачности: кожа и глаза непрозрачные, брови/ресницы/волосы с alphaTest (MASK),
    иначе three.js сортирует прозрачные слои и лицо «просвечивает»;
  * текстуры: кожа и глаза в JPEG, волосы/брови в PNG с альфой, уменьшение до бюджета.

    python3 tools/3d/glb_fix.py in.glb out.glb
"""
import io
import json
import struct
import sys

from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
raw = open(SRC, "rb").read()
jlen = struct.unpack("<I", raw[12:16])[0]
j = json.loads(raw[20:20 + jlen])
bin_off = 20 + jlen + 8
blob = raw[bin_off:]


def view_bytes(i):
    v = j["bufferViews"][i]
    o = v.get("byteOffset", 0)
    return blob[o:o + v["byteLength"]]


views = [view_bytes(i) for i in range(len(j["bufferViews"]))]

# какие текстуры у каких материалов
tex_of_mat = {}
for m in j.get("materials", []):
    t = m.get("pbrMetallicRoughness", {}).get("baseColorTexture")
    if t is not None:
        tex_of_mat[m["name"]] = j["textures"][t["index"]]["source"]

for m in j.get("materials", []):
    n = m["name"]
    if n in ("skin", "skin_low-poly", "skin_high-poly") or not n.startswith("skin"):
        m.pop("alphaMode", None)
        m["doubleSided"] = n not in ("skin",)
    else:
        m["alphaMode"] = "MASK"
        m["alphaCutoff"] = 0.35 if "ponytail" in n or "short" in n or "bob" in n else 0.5
        m["doubleSided"] = True

for name, img_i in tex_of_mat.items():
    img = j["images"][img_i]
    im = Image.open(io.BytesIO(views[img["bufferView"]]))
    opaque = name in ("skin", "skin_low-poly", "skin_high-poly")
    size = 1024 if name == "skin" else (256 if "poly" in name else 512)
    if max(im.size) > size:
        im = im.resize((size, int(size * im.size[1] / im.size[0])), Image.LANCZOS)
    buf = io.BytesIO()
    if opaque:
        im.convert("RGB").save(buf, "JPEG", quality=84, optimize=True)
        img["mimeType"] = "image/jpeg"
    else:
        im.convert("RGBA").save(buf, "PNG", optimize=True)
        img["mimeType"] = "image/png"
    views[img["bufferView"]] = buf.getvalue()

out = bytearray()
for i, b in enumerate(views):
    while len(out) % 4:
        out.append(0)
    j["bufferViews"][i]["byteOffset"] = len(out)
    j["bufferViews"][i]["byteLength"] = len(b)
    out += b
while len(out) % 4:
    out.append(0)
j["buffers"] = [{"byteLength": len(out)}]
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(out)
with open(DST, "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, total))
    f.write(struct.pack("<I4s", len(js), b"JSON") + js)
    f.write(struct.pack("<I4s", len(out), b"BIN\x00") + bytes(out))
print(DST, total // 1024, "KB")
