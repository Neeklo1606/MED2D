"""
Ткань 3D-вещи из реального фото: UV раскладываются проекцией спереди и сзади (по нормали грани)
с подгонкой силуэта по строкам: высота вещи ↔ строки маски на фото, ширина 3D-силуэта на этой высоте ↔
ширина вещи на фото. Атлас из photo_atlas.py ставится базовым цветом материала `fabric`; цвет вершин (AO)
убирается — светотень уже в фото. Цвет на сайте по-прежнему задаётся материалом (умножение).

    blender -b --factory-startup --python tools/3d/photo_texture.py -- <in.glb> <out.glb> <atlas.png> <atlas.json>
"""
import json
import sys

import bmesh
import bpy
import numpy as np

SRC, DST, PNG, JS = sys.argv[sys.argv.index("--") + 1:][:4]
A = json.load(open(JS))
W, H = A["W"], A["H"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if o.parent:
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

fab = [o for o in meshes if any(m and m.name == "fabric" for m in o.data.materials)]
assert fab, "нет материала fabric"
co = np.concatenate([np.array([v.co[:] for v in o.data.vertices]) for o in fab])
zmin, zmax = co[:, 2].min(), co[:, 2].max()
# 3D-силуэт спереди: левая/правая граница по высоте (бины), сглаженный
NB = 200
bins = np.clip(((zmax - co[:, 2]) / (zmax - zmin) * (NB - 1)).astype(int), 0, NB - 1)
l3 = np.full(NB, np.nan)
r3 = np.full(NB, np.nan)
for b in range(NB):
    s = co[bins == b, 0]
    if len(s):
        l3[b], r3[b] = s.min(), s.max()
ok = ~np.isnan(l3)
xs = np.arange(NB)
l3 = np.interp(xs, xs[ok], l3[ok])
r3 = np.interp(xs, xs[ok], r3[ok])
k = np.ones(7) / 7
l3 = np.convolve(np.pad(l3, 3, mode="edge"), k, "valid")
r3 = np.convolve(np.pad(r3, 3, mode="edge"), k, "valid")


def dtw_map(a, b):
    """Монотонное сопоставление профилей ширины a (3D, NB) → b (фото, NB): индекс b для каждого a."""
    n, m = len(a), len(b)
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(max(1, i - 40), min(m, i + 40) + 1):  # окно: вещь не «уезжает» больше чем на 20 %
            c = abs(a[i - 1] - b[j - 1])
            D[i, j] = c + min(D[i - 1, j - 1], D[i - 1, j] + 0.002, D[i, j - 1] + 0.002)
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        k = np.argmin([D[i - 1, j - 1], D[i - 1, j], D[i, j - 1]])
        i, j = (i - 1, j - 1) if k == 0 else (i - 1, j) if k == 1 else (i, j - 1)
    out = np.zeros(n)
    cnt = np.zeros(n)
    for i, j in path:
        out[i] += j
        cnt[i] += 1
    out = out / np.maximum(cnt, 1)
    return np.convolve(np.pad(out, 4, mode="edge"), np.ones(9) / 9, "valid")


def sleeve_end(w):
    """Строка конца рукава: самое резкое сужение силуэта в верхних 3/4 вещи (нет рукавов — None)."""
    n = len(w)
    d = np.convolve(np.diff(w), np.ones(5) / 5, "same")
    i = int(np.argmin(d[int(n * 0.1):int(n * 0.75)])) + int(n * 0.1)
    return i if d[i] < -0.02 else None


w3 = (r3 - l3) / (r3 - l3).max()
s3 = sleeve_end(w3)
ROWMAP = []
for vw in A["views"]:
    wp = np.array(vw["R"]) - np.array(vw["L"])
    wp = np.interp(np.linspace(0, H - 1, NB), np.arange(H), wp)
    wp = wp / wp.max()
    sp = sleeve_end(wp)
    if s3 is not None and sp is not None:
        ROWMAP.append(np.interp(xs, [0, s3, NB - 1], [0, sp, NB - 1]) / (NB - 1) * (H - 1))
    else:
        ROWMAP.append(xs / (NB - 1) * (H - 1))
    print("SLEEVE", s3, sp)


def uv_of(p, view):
    t = (zmax - p[2]) / (zmax - zmin)
    b = t * (NB - 1)
    l, r = np.interp(b, xs, l3), np.interp(b, xs, r3)
    s = (p[0] - l) / max(r - l, 1e-6)
    s = min(max(s, 0.0), 1.0)
    vw = A["views"][view]
    row = float(np.interp(b, xs, ROWMAP[view]))
    L = np.interp(row, np.arange(H), vw["L"])
    R = np.interp(row, np.arange(H), vw["R"])
    # спереди камера смотрит на −Y: правая сторона кадра = +X; сзади — зеркально
    u = L + s * (R - L) if view == 0 else R - s * (R - L)
    return (u / W, 1 - row / (H - 1))


img = bpy.data.images.load(PNG)
img.name = "photo_" + __import__("os").path.splitext(__import__("os").path.basename(PNG))[0]  # optimize.mjs: ≤ 2048 px
img.colorspace_settings.name = "sRGB"
for o in fab:
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        view = 0 if f.normal.y <= 0 else 1
        for lp in f.loops:
            lp[uvl].uv = uv_of(lp.vert.co, view)
    bm.to_mesh(me)
    bm.free()
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    mat = next(m for m in me.materials if m and m.name == "fabric")
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    for lk in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(lk)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    # плетение из карты нормалей идёт по UV: на новой раскладке оно лишнее, складки уже в фото
    nrm = bsdf.inputs["Normal"]
    for lk in list(nrm.links):
        nt.links.remove(lk)

bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_yup=True, export_apply=True,
                          export_vertex_color="NONE", export_image_format="AUTO", export_materials="EXPORT")
print("PHOTO_TEXTURED", DST)
