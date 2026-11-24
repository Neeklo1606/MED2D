"""
Стилизация моделей под витринный манекен (Blender 4.2, после tools/3d/decode.mjs):
  * манекен: без глаз, бровей, ресниц и волос; голова сглажена до гладкой формы без черт лица,
    кисти и стопы смягчены; матовый однотонный материал `mannequin` вместо текстуры кожи;
  * одежда: ткань (`fabric`) сглажена Laplacian-сглаживанием с сохранением объёма — уходят
    бугры воксельной сетки и рваные края подола/манжет; нормали пересчитаны; AO в цвете вершин,
    материалы и фурнитура (`trim`) без изменений.

    blender -b --factory-startup --python tools/3d/stylize.py -- <in.glb> <out.glb> [mannequin|<сила 0..3>]
"""
import sys

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = args[0], args[1]
MODE = args[2] if len(args) > 2 else "1"
AO_GAMMA = float(args[3]) if len(args) > 3 else 1.6

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]

# применить трансформы узлов (квантование вынесло масштаб в узлы), чтобы сглаживание шло в метрах
for o in meshes:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if o.parent:
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def smooth_normals(o):
    me = o.data
    if me.has_custom_normals:
        bpy.context.view_layer.objects.active = o
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in me.polygons:
        p.use_smooth = True


def weld(o, dist=1e-5):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(o.data)
    bm.free()


def add_smooth(o, group, iters, factor=0.5, volume=True, lam=0.6):
    if volume:
        m = o.modifiers.new("lap", "LAPLACIANSMOOTH")
        m.iterations = iters
        m.lambda_factor = lam
        m.lambda_border = lam
        m.use_volume_preserve = True
        m.use_normalized = True
    else:
        m = o.modifiers.new("sm", "SMOOTH")
        m.iterations = iters
        m.factor = factor
    if group:
        m.vertex_group = group
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def ramp(x, a, b):
    return 0.0 if x <= a else 1.0 if x >= b else (x - a) / (b - a)


if MODE == "mannequin":
    body = None
    for o in list(meshes):
        mats = [m.name for m in o.data.materials if m]
        if any(n.startswith("skin_") for n in mats):  # глаза, брови, ресницы, волосы
            bpy.data.objects.remove(o)
        elif "skin" in mats:
            body = o
        elif "base" in mats:  # базовое бельё: у витринного манекена его нет
            bpy.data.objects.remove(o)
    assert body is not None, "нет тела (материал skin)"
    weld(body)
    vs = body.data.vertices
    zs = [v.co.z for v in vs]
    zmin, zmax = min(zs), max(zs)
    h = zmax - zmin
    # зоны: голова (выше подбородка), кисти (ниже бёдер и далеко от оси), стопы
    head = body.vertex_groups.new(name="head")
    hands = body.vertex_groups.new(name="hands")
    feet = body.vertex_groups.new(name="feet")
    for v in vs:
        z = (v.co.z - zmin) / h
        r = abs(v.co.x)
        wh = ramp(z, 0.855, 0.885)
        if wh:
            head.add([v.index], wh, "REPLACE")
        wk = ramp(r, 0.17 * h / 1.68, 0.21 * h / 1.68) * (1 - ramp(z, 0.50, 0.56))
        if wk:
            hands.add([v.index], wk, "REPLACE")
        wf = 1 - ramp(z, 0.035, 0.065)
        if wf:
            feet.add([v.index], wf, "REPLACE")
    # голова: каждая точка у подбородка проецируется на гладкое «яйцо» витринного манекена
    # (оси по габаритам исходной головы, к подбородку сужается), выше всё заменяется цельной головой
    vs = body.data.vertices
    top = zmax
    chin = zmin + 0.872 * h
    hv = [v.co for v in vs if v.co.z > chin + 0.02 * h and abs(v.co.x) < 0.09 * h / 1.68]
    cx = 0.0
    cy = sum(c.y for c in hv) / len(hv)
    c_ax = (top - (chin - 0.018 * h)) / 2  # низ головы чуть ниже подбородка: перекрывает губы
    cz = top - c_ax
    a_ax = max(abs(c.x) for c in hv if c.z > cz) * 0.97
    b_ax = (max(c.y for c in hv) - min(c.y for c in hv)) / 2 * 0.95
    cy = (max(c.y for c in hv) + min(c.y for c in hv)) / 2

    def egg_r(d):
        lo, hi = 0.0, 3.0
        for _ in range(40):
            m = (lo + hi) / 2
            q = d * m
            t = max(0.0, min(1.0, -q.z / c_ax))
            sx = a_ax * (1 - 0.22 * t * t)
            sy = b_ax * (1 - 0.12 * t * t)
            if (q.x / sx) ** 2 + (q.y / sy) ** 2 + (q.z / c_ax) ** 2 < 1:
                lo = m
            else:
                hi = m
        return lo

    ctr = Vector((cx, cy, cz))
    for v in vs:
        w = ramp(v.co.z, chin - 0.03 * h, chin + 0.01 * h)
        if not w:
            continue
        d = v.co - ctr
        if d.length < 1e-6:
            continue
        p = ctr + d * (egg_r(d) * 0.965)  # чуть внутри «яйца»: его перекроет отдельная гладкая голова
        v.co = v.co.lerp(p, w)
    add_smooth(body, "head", 6, volume=False, factor=0.5)
    # остатки глазниц и рта выше подбородка удаляются, вместо них — цельная гладкая голова
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > chin + 0.035 * h], context="VERTS")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=40, radius=1.0)
    for v in bm.verts:
        d = v.co.normalized()
        v.co = ctr + d * egg_r(d)
    egg = bpy.data.meshes.new("head")
    bm.to_mesh(egg)
    bm.free()
    eo = bpy.data.objects.new("head", egg)
    bpy.context.scene.collection.objects.link(eo)
    bpy.ops.object.select_all(action="DESELECT")
    eo.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    # грудь: убрать мелкие анатомические детали, форма остаётся
    chest = body.vertex_groups.new(name="chest")
    for v in body.data.vertices:
        z = (v.co.z - zmin) / h
        w = ramp(z, 0.64, 0.67) * (1 - ramp(z, 0.77, 0.80)) * (1 - ramp(abs(v.co.x), 0.13, 0.16))
        if w:
            chest.add([v.index], w, "REPLACE")
    add_smooth(body, "chest", 15, volume=False, factor=0.7)
    add_smooth(body, "hands", 12, volume=False, factor=0.6)
    add_smooth(body, "feet", 25, volume=False, factor=0.8)
    add_smooth(body, None, 2, volume=False, factor=0.3)  # лёгкая общая полировка поверхности
    smooth_normals(body)
    # матовый «витринный» материал: тёплый светло-серый, без текстур
    mat = bpy.data.materials.new("mannequin")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.50, 0.46, 0.42, 1.0)  # ≈ #BCB4AC в sRGB
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Metallic"].default_value = 0.0
    body.data.materials.clear()
    body.data.materials.append(mat)
    body.data.uv_layers.clear() if hasattr(body.data.uv_layers, "clear") else None
else:
    k = float(MODE)
    for o in meshes:
        mats = [m.name for m in o.data.materials if m]
        if "fabric" not in mats or k <= 0:
            continue
        # ткань — тонкие двойные слои: сварка швов и мягкое сглаживание без коррекции объёма
        weld(o)
        add_smooth(o, None, max(1, round(3 * k)), volume=False, factor=0.5)
        smooth_normals(o)
        # AO складок в цвете вершин контрастнее: складки, карманы и швы читаются объёмом
        for ca in o.data.color_attributes:
            for d in ca.data:
                c = d.color
                d.color = (c[0] ** AO_GAMMA, c[1] ** AO_GAMMA, c[2] ** AO_GAMMA, c[3])

bpy.ops.export_scene.gltf(
    filepath=DST,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_image_format="AUTO",
    export_materials="EXPORT",
)
print("STYLIZED", DST)
