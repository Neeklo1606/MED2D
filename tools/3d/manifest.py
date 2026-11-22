"""manifest.json: треугольники, размер и габариты каждого GLB (проверка бюджета ТЗ)."""
import json
import sys
from pathlib import Path

import trimesh

d = Path(sys.argv[1])
man = {}
for f in sorted(d.glob("*.glb")):
    s = trimesh.load(f, force="scene")
    b = s.bounds
    man[f.name] = {"tris": int(sum(len(g.faces) for g in s.geometry.values())), "bytes": f.stat().st_size,
                   "min": [round(float(x), 3) for x in b[0]], "max": [round(float(x), 3) for x in b[1]]}
(d / "manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False))
for k, v in man.items():
    print(f"{k:28s} {v['tris']:6d} tris {v['bytes'] // 1024:5d} KB")
