"""
Превью моделей: импортирует GLB, красит ткань и рендерит вид спереди, сбоку и сзади в один PNG (Cycles, CPU).

    blender -b --factory-startup --python tools/3d/preview.py -- out.png mannequin_f.glb top_anorak_f.glb:#E5B2BB ...
"""
import math
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
out, files = args[0], args[1:]
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)


def hex2lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


for f in files:
    path, _, color = f.partition(":")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in set(bpy.data.objects) - before:
        if o.type == "MESH" and color:
            for m in o.data.materials:
                if m and m.name.startswith("fabric"):
                    nt = m.node_tree
                    bc = nt.nodes["Principled BSDF"].inputs["Base Color"]
                    bc.default_value = hex2lin(color)
                    if o.data.color_attributes:
                        ca = nt.nodes.new("ShaderNodeVertexColor")
                        ca.layer_name = o.data.color_attributes[0].name
                        src = ca.outputs["Color"]
                        mix = nt.nodes.new("ShaderNodeMixRGB")
                        mix.blend_type = "MULTIPLY"
                        mix.inputs[0].default_value = 1
                        mix.inputs[2].default_value = hex2lin(color)
                        nt.links.new(src, mix.inputs[1])
                        nt.links.new(mix.outputs[0], bc)

s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.samples = 24
s.cycles.use_denoising = True
s.render.resolution_x, s.render.resolution_y = 420, 760
s.render.film_transparent = False
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.85, 0.86, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
s.world = w
for loc, e in (((2, -3, 3), 3.0), ((-3, -1, 2), 1.2), ((0, 3, 2.5), 1.5)):
    L = bpy.data.objects.new("l", bpy.data.lights.new("l", "SUN"))
    L.data.energy = e
    L.rotation_euler = (0, 0, 0)
    s.collection.objects.link(L)
    d = -__import__("mathutils").Vector(loc)
    L.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
s.collection.objects.link(cam)
s.camera = cam
cam.data.lens = 85
import os  # noqa: E402

tiles = []
for i, az in enumerate((0, 90, 180)):
    a = math.radians(az)
    cam.location = (7.2 * math.sin(a), -7.2 * math.cos(a), 0.92)
    cam.rotation_euler = (math.radians(90), 0, a)
    p = f"{out}.{i}.png"
    s.render.filepath = p
    bpy.ops.render.render(write_still=True)
    tiles.append(p)
img = [bpy.data.images.load(p) for p in tiles]
W, H = s.render.resolution_x, s.render.resolution_y
outimg = bpy.data.images.new("o", W * 3, H)
import numpy as np  # noqa: E402

px = np.zeros((H, W * 3, 4), np.float32)
for i, im in enumerate(img):
    px[:, i * W:(i + 1) * W] = np.array(im.pixels[:]).reshape(H, W, 4)
outimg.pixels = px.ravel()
outimg.filepath_raw = out
outimg.file_format = "PNG"
outimg.save()
for p in tiles:
    os.remove(p)
