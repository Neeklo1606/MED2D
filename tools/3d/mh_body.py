"""
Шаг 1 пайплайна реалистичных моделей MEDFORM (запуск внутри Blender 4.2 с аддоном MPFB2).

Собирает человека из базовой сетки MakeHuman (CC0): макро-параметры фигуры, кожа, глаза, брови,
ресницы, волосы; ставит стандартный риг, опускает руки в естественную позу (как на фото модели),
запекает позу в сетку и сохраняет:
  * <out>/body_<g>.glb  : манекен с кожей, волосами и нейтральным базовым бельём (без одежды);
  * <out>/body_<g>.npz  : вершины и треугольники тела в координатах glTF (м, Y вверх, лицом к +Z),
                          зона каждой вершины (по доминирующей кости) и положения суставов.
Одежду по этим данным строит tools/3d/garments.py.

    blender -b --factory-startup --python tools/3d/mh_body.py -- f <out_dir>
"""
import math
import os
import sys

import addon_utils
import bpy
import numpy as np
from mathutils import Matrix, Vector

G, OUT = sys.argv[-2], sys.argv[-1]
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402

DATA = os.path.expanduser("~/.config/blender/4.2/extensions/.user/user_default/mpfb/data/")
HEIGHT = {"f": 1.68, "m": 1.80}[G]

# Фигура ближе к фото заказчика: стройная молодая женщина / подтянутый молодой мужчина.
PRESET = {
    "f": dict(gender=0.0, age=0.5, muscle=0.5, weight=0.42, height=0.6, proportions=0.85, cupsize=0.42, firmness=0.6,
              skin="young_caucasian_female/young_caucasian_female.mhmat", hair="ponytail01/ponytail01.mhclo",
              brows="eyebrow001/eyebrow001.mhclo"),
    "m": dict(gender=1.0, age=0.5, muscle=0.58, weight=0.48, height=0.65, proportions=0.8, cupsize=0.5, firmness=0.5,
              skin="young_caucasian_male/young_caucasian_male.mhmat", hair="short02/short02.mhclo",
              brows="eyebrow002/eyebrow002.mhclo"),
}[G]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

macro = TargetService.get_default_macro_info_dict()
for k in ("gender", "age", "muscle", "weight", "height", "proportions", "cupsize", "firmness"):
    macro[k] = PRESET[k]
macro["race"] = {"caucasian": 1.0, "asian": 0.0, "african": 0.0}
human = HumanService.create_human(macro_detail_dict=macro, scale=0.1)
HumanService.set_character_skin(DATA + "skins/" + PRESET["skin"], human, skin_type="GAMEENGINE")
rig = HumanService.add_builtin_rig(human, "default", import_weights=True)
parts = {}
for path, kind in [("eyes/low-poly/low-poly.mhclo", "Eyes"), ("eyebrows/" + PRESET["brows"], "Eyebrows"),
                   ("eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes"), ("hair/" + PRESET["hair"], "Hair")]:
    parts[kind] = HumanService.add_mhclo_asset(DATA + path, human, asset_type=kind, subdiv_levels=0,
                                               material_type="GAMEENGINE", set_up_rigging=True)

# ---------- поза: руки опущены вдоль тела, чуть согнуты в локтях ----------
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")


def rotate_world(bone, axis, deg):
    """Поворот кости вокруг мировой оси ("X"/"Y"/"Z") или вокруг собственной оси кости ("ROLL")."""
    pb = rig.pose.bones[bone]
    head = pb.head.copy()
    ax = (pb.tail - pb.head).normalized() if axis == "ROLL" else axis
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, ax) @ Matrix.Translation(-head)
    pb.matrix = R @ pb.matrix
    bpy.context.view_layer.update()


ROLL = float(os.environ.get("MH_ROLL", "0"))


def aim(bone, d):
    """Повернуть кость так, чтобы она смотрела в мировом направлении d (Blender: -Y вперёд, Z вверх)."""
    pb = rig.pose.bones[bone]
    c = (pb.tail - pb.head).normalized()
    q = c.rotation_difference(Vector(d).normalized())
    head = pb.head.copy()
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()


OUTW = {"f": 0.27, "m": 0.27}[G]   # отведение плеча от вертикали (рад)
for side, s in (("L", 1), ("R", -1)):
    up = (s * math.sin(OUTW), 0.04, -math.cos(OUTW))
    fore = (s * 0.2, -0.14, -1.0)
    for b in ("upperarm01", "upperarm02"):
        aim(f"{b}.{side}", up)
    for b in ("lowerarm01", "lowerarm02"):
        aim(f"{b}.{side}", fore)
    rotate_world(f"lowerarm01.{side}", "ROLL", s * ROLL)
bpy.ops.object.mode_set(mode="OBJECT")


def bake(obj):
    """Применить фигуру, маску хелперов и позу: получить статичную сетку с группами вершин."""
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    obj.modifiers.clear()
    if obj.data.shape_keys:
        obj.shape_key_clear()
    old = obj.data
    obj.data = mesh
    bpy.data.meshes.remove(old)


meshes = [human] + list(parts.values())
for o in meshes:
    bake(o)
bpy.data.objects.remove(rig)

# ---------- масштаб до роста из ТЗ, стопы на 0 ----------
zs = np.array([v.co.z for v in human.data.vertices])
k = HEIGHT / (zs.max() - zs.min())
for o in meshes:
    o.matrix_world = Matrix.Scale(k, 4) @ Matrix.Translation((0, 0, -zs.min())) @ o.matrix_world
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------- зоны тела по доминирующей кости ----------
ZONES = ["head", "neck", "chest", "belly", "pelvis", "upperarm", "lowerarm", "hand", "upperleg", "lowerleg", "foot"]


def zone_of(bone):
    b = bone.split(".")[0]
    if b.startswith(("upperarm", "shoulder", "clavicle")):
        return "upperarm" if b.startswith("upperarm") else "chest"
    if b.startswith("lowerarm"):
        return "lowerarm"
    if b.startswith(("wrist", "metacarpal", "finger", "thumb")):
        return "hand"
    if b.startswith("upperleg"):
        return "upperleg"
    if b.startswith("lowerleg"):
        return "lowerleg"
    if b.startswith(("foot", "toe")):
        return "foot"
    if b in ("spine04", "spine05", "spine03", "breast"):
        return "chest"
    if b in ("spine01", "spine02"):
        return "belly"
    if b in ("pelvis", "root"):
        return "pelvis"
    if b.startswith("neck"):
        return "neck"
    return "head"


me = human.data
names = {g.index: g.name for g in human.vertex_groups}
zone = np.zeros(len(me.vertices), np.int8)
side = np.zeros(len(me.vertices), np.int8)
for v in me.vertices:
    best, bw = None, 0.0
    for ge in v.groups:
        n = names[ge.group]
        if ge.weight > bw and not n.startswith(("helper", "joint", "body", "Left", "Right", "Mid", "Hide")):
            best, bw = n, ge.weight
    zone[v.index] = ZONES.index(zone_of(best)) if best else 0
    side[v.index] = 1 if best and best.endswith(".L") else (-1 if best and best.endswith(".R") else 0)


def to_gltf(a):
    a = np.asarray(a, np.float64)
    return np.stack([a[:, 0], a[:, 2], -a[:, 1]], 1)


V = to_gltf([v.co for v in me.vertices])
me.calc_loop_triangles()
F = np.array([t.vertices[:] for t in me.loop_triangles], np.int32)
hair = parts["Hair"].data
H = to_gltf([v.co for v in hair.vertices])
np.savez_compressed(os.path.join(OUT, f"body_{G}.npz"), V=V, F=F, zone=zone, side=side, zones=np.array(ZONES), hair=H)

# ---------- текстуры в бюджет: 1024 px JPEG ----------
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, int(1024 * img.size[1] / img.size[0]))

# Упрощаем тело до бюджета (≈24 тыс. треугольников), остальное мелочь.
dec = human.modifiers.new("dec", "DECIMATE")
dec.ratio = 0.62
bpy.context.view_layer.objects.active = human
bpy.ops.object.modifier_apply(modifier="dec")

for o in bpy.data.objects:
    o.select_set(o.type == "MESH")
for o in bpy.data.objects:
    if o.type == "MESH":
        for m in o.data.materials:
            if m and m.name != "trim":
                m.name = "skin_" + o.name.split(".")[-1] if o is not human else "skin"
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"mannequin_{G}.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_image_format="JPEG", export_jpeg_quality=82,
                          export_draco_mesh_compression_enable=False, export_skins=False, export_animations=False,
                          export_morph=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"body_{G}.blend"))
print("DONE", G, "height", HEIGHT, "tris", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
