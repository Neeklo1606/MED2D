"""
Шаг 3 пайплайна: сборка GLB для сайта (Blender 4.2).

Читает parts_<g>.npz (tools/3d/garments.py) и mannequin_<g>.glb (tools/3d/mh_body.py):
  * материал `fabric`: белый базовый цвет × запечённое AO в цвете вершин × тайловая карта нормалей
    саржевого плетения, поэтому сайт перекрашивает вещь через material.color без потери складок;
  * материал `trim`: фурнитура (пуговицы, ручка, бейдж), не перекрашивается;
  * AO запекается Cycles с телом в сцене (складки у пояса, подмышками, под карманами);
  * базовое бельё добавляется в манекен.
Выход: <out>/<model>_<g>.glb и mannequin_<g>.glb.

    blender -b --factory-startup --python tools/3d/assemble.py -- <work_dir> f <out_dir>
"""
import os
import sys

import bpy
import numpy as np

WORK, G, OUT = sys.argv[-3], sys.argv[-2], sys.argv[-1]
parts = np.load(os.path.join(WORK, f"parts_{G}.npz"))

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 160

# ---------- тело для запекания AO ----------
bpy.ops.import_scene.gltf(filepath=os.path.join(WORK, f"mannequin_{G}.glb"))
body_objs = [o for o in bpy.data.objects if o.type == "MESH"]


# ---------- карта нормалей ткани (саржа 2/2), 256 px, тайл 4 см ----------
def weave_normal(n=256, threads=24):
    y, x = np.mgrid[0:n, 0:n] / n * threads
    h = 0.5 + 0.5 * np.sin(2 * np.pi * x) * np.sign(np.sin(np.pi * (np.floor(x) + np.floor(y)) / 2 + 0.3))
    h += 0.35 * np.sin(2 * np.pi * (x + y) / 2)
    h = (h - h.min()) / np.ptp(h)
    gy, gx = np.gradient(h)
    k = 1.2
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    img = bpy.data.images.new("fabric_normal", n, n, alpha=False)
    px = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5, np.ones_like(h)], -1)
    img.pixels = px.astype(np.float32).ravel()
    img.colorspace_settings.name = "Non-Color"
    img.file_format = "PNG"
    img.pack()
    return img


NORMAL = weave_normal()


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    if name == "fabric":
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "ao"
        nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = NORMAL
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        bsdf.inputs["Roughness"].default_value = 0.88
    else:
        bsdf.inputs["Base Color"].default_value = (0.82, 0.83, 0.85, 1)
        bsdf.inputs["Roughness"].default_value = 0.35
        bsdf.inputs["Metallic"].default_value = 0.0
    return m


def make_obj(name, V, F, UV, mat):
    # glTF (Y вверх, лицом к +Z) → Blender (Z вверх, лицом к −Y)
    Vb = np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1)
    me = bpy.data.meshes.new(name)
    me.from_pydata(Vb.tolist(), [], F.tolist())
    uvl = me.uv_layers.new(name="UVMap")
    loops = np.zeros(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", loops)
    uvl.data.foreach_set("uv", UV[loops].ravel())
    me.shade_smooth() if hasattr(me, "shade_smooth") else None
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(material(mat))
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


garments = {}
for key in parts.files:
    name, i, mat, kind = key.split("|")
    if kind != "V":
        continue
    pre = f"{name}|{i}|{mat}|"
    ob = make_obj(f"{name}.{i}", parts[pre + "V"], parts[pre + "F"], parts[pre + "UV"], mat)
    if pre + "SH" in parts.files:
        sh = ob.data.attributes.new("shade", "FLOAT", "POINT")
        sh.data.foreach_set("value", parts[pre + "SH"])
    garments.setdefault(name, []).append(ob)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def bake_ao(ob, occluders):
    for o in bpy.data.objects:
        o.hide_render = o not in occluders and o is not ob
    if "ao" not in ob.data.color_attributes:
        ob.data.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
    ob.data.color_attributes.active_color = ob.data.color_attributes["ao"]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    scene.render.bake.target = "VERTEX_COLORS"
    scene.world = scene.world or bpy.data.worlds.new("w")
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    # мягче и светлее: ткань не должна темнеть сильнее 45 %
    ca = ob.data.color_attributes["ao"]
    c = np.zeros(len(ca.data) * 4, np.float32)
    ca.data.foreach_get("color", c)
    c = c.reshape(-1, 4)
    print("  AO", ob.name, "mean", float(c[:, :3].mean()), "min", float(c[:, :3].min()))
    c[:, :3] = 0.66 + 0.34 * np.clip(c[:, :3], 0, 1) ** 0.8
    if "shade" in ob.data.attributes:
        sv = np.zeros(len(ob.data.vertices), np.float32)
        ob.data.attributes["shade"].data.foreach_get("value", sv)
        loops = np.zeros(len(ob.data.loops), np.int32)
        ob.data.loops.foreach_get("vertex_index", loops)
        c[:, :3] *= sv[loops][:, None]
    ca.data.foreach_set("color", c.ravel())


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_render = False
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_image_format="AUTO", export_draco_mesh_compression_enable=False,
                              export_vertex_color="MATERIAL", export_all_vertex_colors=False)


for name, objs in garments.items():
    fabric = [o for o in objs if o.data.materials[0].name == "fabric"]
    trim = [o for o in objs if o.data.materials[0].name != "fabric"]
    main = join(fabric, name) if fabric else None
    tr = join(trim, name + "_trim") if trim else None
    if main and name != "base_layer":
        bake_ao(main, body_objs)
    if tr and main:
        tr.parent = main
    if name == "base_layer":
        continue
    export([o for o in (main, tr) if o], os.path.join(OUT, f"{name}_{G}.glb"))
    print("EXPORTED", name, sum(len(o.data.polygons) for o in (main, tr) if o))
    for o in (main, tr):
        if o:
            o.hide_render = True
            o.hide_set(True)

if "base_layer" in garments:
    base = bpy.data.objects.get("base_layer_trim") or bpy.data.objects.get("base_layer")
    base.data.materials.clear()
    m = bpy.data.materials.new("base")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.11, 0.115, 0.13, 1)
    b.inputs["Roughness"].default_value = 0.8
    base.data.materials.append(m)
    base.hide_set(False)
    export(body_objs + [base], os.path.join(OUT, f"mannequin_{G}.glb"))
    print("EXPORTED mannequin with base layer")
