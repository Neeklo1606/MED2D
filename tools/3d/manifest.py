"""manifest.json: треугольники, размер, габариты и хэш содержимого каждого GLB (проверка бюджета ТЗ).

    python3 tools/3d/manifest.py <папка_glb>

Без внешних зависимостей: всё берётся из JSON-части GLB (min/max атрибута POSITION по спецификации
обязательны), поэтому работает и со сжатыми meshopt-файлами после tools/3d/optimize.mjs.
Если папка = public/3d/models этого репозитория, дополнительно пишет src/configurator/model-versions.json
({"mannequin_f": "<хэш>"}): сайт запрашивает /3d/models/<имя>.glb?v=<хэш>, и файлы кешируются навсегда.
"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MODELS = REPO / "public" / "3d" / "models"
VERSIONS = REPO / "src" / "configurator" / "model-versions.json"

# нормализованные целые (KHR_mesh_quantization): componentType → делитель
NORM = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


def glb_json(data: bytes) -> dict:
    magic, _, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError("не GLB")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError("нет JSON-чанка")
    return json.loads(data[20:20 + length])


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def node_matrix(n: dict):
    if "matrix" in n:
        m = n["matrix"]  # column-major
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    tx, ty, tz = n.get("translation", [0, 0, 0])
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = n.get("scale", [1, 1, 1])
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
            [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
            [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
            [0, 0, 0, 1]]


def stats(j: dict):
    acc = j.get("accessors", [])
    tris = 0
    lo = [math.inf] * 3
    hi = [-math.inf] * 3

    def visit(i, parent):
        nonlocal tris
        n = j["nodes"][i]
        m = mat_mul(parent, node_matrix(n))
        if "mesh" in n:
            for p in j["meshes"][n["mesh"]]["primitives"]:
                pos = acc[p["attributes"]["POSITION"]]
                count = acc[p["indices"]]["count"] if "indices" in p else pos["count"]
                if p.get("mode", 4) == 4:
                    tris += count // 3
                d = NORM.get(pos["componentType"]) if pos.get("normalized") else None
                a = [max(v / d, -1.0) if d else v for v in pos["min"]]
                b = [max(v / d, -1.0) if d else v for v in pos["max"]]
                for cx in (a[0], b[0]):
                    for cy in (a[1], b[1]):
                        for cz in (a[2], b[2]):
                            w = [m[r][0] * cx + m[r][1] * cy + m[r][2] * cz + m[r][3] for r in range(3)]
                            for k in range(3):
                                lo[k] = min(lo[k], w[k])
                                hi[k] = max(hi[k], w[k])
        for c in n.get("children", []):
            visit(c, m)

    ident = [[1.0 if r == c else 0.0 for c in range(4)] for r in range(4)]
    for s in j.get("scenes", []):
        for i in s.get("nodes", []):
            visit(i, ident)
    return tris, lo, hi


def main():
    d = Path(sys.argv[1]).resolve()
    man = {}
    for f in sorted(d.glob("*.glb")):
        data = f.read_bytes()
        tris, lo, hi = stats(glb_json(data))
        man[f.name] = {"tris": tris, "bytes": len(data), "hash": hashlib.sha256(data).hexdigest()[:10],
                       "min": [round(x, 3) for x in lo], "max": [round(x, 3) for x in hi]}
    (d / "manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False) + "\n")
    for k, v in man.items():
        print(f"{k:28s} {v['tris']:6d} tris {v['bytes'] // 1024:5d} KB  {v['hash']}")
    if d == MODELS.resolve():
        versions = {k[:-4]: v["hash"] for k, v in man.items()}
        VERSIONS.write_text(json.dumps(versions, indent=1) + "\n")
        print(f"версии моделей → {VERSIONS.relative_to(REPO)}")


if __name__ == "__main__":
    main()
