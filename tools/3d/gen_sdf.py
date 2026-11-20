"""
Генератор 3D-заготовок MEDFORM: гладкий манекен и одежда по фигуре.

Тело задаётся полем расстояний (SDF): эллипсоиды и конусы с плавным объединением,
сетка строится marching cubes (scikit-image), упрощается до бюджета из ТЗ и
сохраняется в GLB. Одежда = «раздутое» тело, обрезанное по зоне вещи, плюс детали
(V-вырез, карманы, манжеты), поэтому садится по фигуре.

Оси и единицы как в ТЗ: метры, Y вверх, лицом к +Z, стопы на Y = 0.
Материал ткани `fabric` (белый, цвет задаёт сайт), манекен `mannequin`.

    python tools/3d/gen_sdf.py public/3d/models
"""
import json
import sys
from pathlib import Path

import numpy as np
import trimesh
from skimage.filters import gaussian
from skimage.measure import marching_cubes

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public/3d/models")
STEP = 0.0045  # шаг сетки, м
BUDGET = {"mannequin": 30000, "garment": 20000}

# ---------- примитивы SDF ----------

def ellipsoid(p, c, r):
    q = (p - c) / r
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / r, axis=-1)
    return np.where(k1 > 0, k0 * (k0 - 1.0) / np.maximum(k1, 1e-9), -r.min())


def cone_capsule(p, a, b, ra, rb):
    """Капсула с разными радиусами на концах (конус со сферами)."""
    ba = b - a
    t = np.clip(((p - a) @ ba) / (ba @ ba), 0, 1)[..., None]
    r = ra + (rb - ra) * t[..., 0]
    return np.linalg.norm(p - (a + t * ba), axis=-1) - r


def box(p, c, h, rounding=0.0):
    q = np.abs(p - c) - h + rounding
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - rounding


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def mirror(p):
    q = p.copy()
    q[..., 0] = np.abs(q[..., 0])
    return q

# ---------- тело ----------

def body_params(g):
    if g == "f":
        return dict(H=1.0, sh=0.165, chest=(0.135, 0.12, 0.095), waist=(0.115, 0.1, 0.08), hips=(0.165, 0.11, 0.105), bust=True, arm=0.036, leg=0.07)
    return dict(H=1.07, sh=0.19, chest=(0.16, 0.13, 0.105), waist=(0.135, 0.11, 0.09), hips=(0.155, 0.1, 0.1), bust=False, arm=0.042, leg=0.075)


def joints(g):
    P = body_params(g)
    H = P["H"]
    s = lambda x, y, z: np.array([x, y * H, z])
    sh = P["sh"]
    return P, {
        "head": s(0, 1.555, 0.0), "neck_a": s(0, 1.40, -0.005), "neck_b": s(0, 1.49, 0.0),
        "chest": s(0, 1.255, 0.0), "waist": s(0, 1.06, 0.0), "hips": s(0, 0.92, -0.005),
        # лёгкая A-поза: руки отведены, чтобы не пересекаться с бёдрами и одеждой
        "shoulder": s(sh, 1.36, -0.005), "elbow": s(sh + 0.075, 1.085, -0.025),
        "wrist": s(sh + 0.13, 0.84, 0.005), "hand": s(sh + 0.145, 0.77, 0.015),
        "hip": s(0.088, 0.88, 0.0), "knee": s(0.092, 0.485, 0.012), "ankle": s(0.09, 0.075, -0.01),
        "foot": s(0.09, 0.035, 0.045),
    }


def parts(p, g):
    """SDF частей тела по отдельности: одежда строится только от нужных частей."""
    P, J = joints(g)
    H = P["H"]
    m = mirror(p)
    head = ellipsoid(p, J["head"], np.array([0.072, 0.1, 0.088]) * [1, H, 1])
    neck = cone_capsule(p, J["neck_a"], J["neck_b"], 0.05 * H, 0.043 * H)
    torso = ellipsoid(p, J["chest"], np.array(P["chest"]) * [1, H, 1])
    torso = smin(torso, ellipsoid(p, J["waist"], np.array(P["waist"]) * [1, H, 1]), 0.08)
    torso = smin(torso, ellipsoid(p, J["hips"], np.array(P["hips"]) * [1, H, 1]), 0.07)
    torso = smin(torso, cone_capsule(m, np.array([0.0, 1.355 * H, -0.01]), J["shoulder"], 0.06, 0.05), 0.05)
    if P["bust"]:
        torso = smin(torso, ellipsoid(m, np.array([0.068, 1.235, 0.062]), np.array([0.062, 0.058, 0.055])), 0.04)
    torso = smin(torso, ellipsoid(m, np.array([0.068, 0.885 * H, -0.06]), np.array([0.085, 0.085, 0.07])), 0.05)
    a = P["arm"]
    upper = cone_capsule(m, J["shoulder"], J["elbow"], a * 1.15, a * 0.92)
    fore = smin(cone_capsule(m, J["elbow"], J["wrist"], a * 0.9, a * 0.66), ellipsoid(m, J["hand"], np.array([0.024, 0.062, 0.038]) * [1, H, 1]), 0.02)
    L = P["leg"]
    leg = cone_capsule(m, J["hip"], J["knee"], L, L * 0.68)
    leg = smin(leg, cone_capsule(m, J["knee"], J["ankle"], L * 0.66, L * 0.42), 0.03)
    foot = ellipsoid(m, J["foot"], np.array([0.038, 0.032, 0.105]))
    return P, J, dict(head=head, neck=neck, torso=torso, upper=upper, fore=fore, leg=leg, foot=foot)


def body_sdf(p, g):
    _, _, b = parts(p, g)
    d = smin(b["head"], b["neck"], 0.03)
    d = smin(d, b["torso"], 0.05)
    d = smin(d, smin(b["upper"], b["fore"], 0.02), 0.025)
    return smin(d, smin(b["leg"], b["foot"], 0.03), 0.04)

# ---------- одежда ----------

def flat_pocket(p, c, h):
    """Накладной карман: тонкая пластина, почти заподлицо с тканью."""
    return box(p, c, h, 0.004)


def garment_sdf(p, g, kind):
    P, J, b = parts(p, g)
    H = P["H"]
    m = mirror(p)
    y = p[..., 1]
    torso, upper, fore, leg = b["torso"], b["upper"], b["fore"], b["leg"]
    if kind in ("top_anorak", "top_tshirt"):
        loose = 0.032 if kind == "top_anorak" else 0.02
        # оверсайз: торс раздут и слегка «спрямлён» к подолу
        shell = smin(torso - loose, ellipsoid(p, J["waist"] + [0, -0.02, 0], np.array([P["chest"][0] + loose, 0.2, P["chest"][2] + loose * 0.8]) * [1, H, 1]), 0.08)
        frac = 0.62 if kind == "top_anorak" else 0.48
        cut = J["shoulder"] + (J["elbow"] - J["shoulder"]) * frac
        n = (J["elbow"] - J["shoulder"]); n = n / np.linalg.norm(n)
        sleeve = smax(upper - (loose + 0.012), (m - cut) @ n, 0.006)
        d = smin(shell, sleeve, 0.04)
        hem = (0.845 if kind == "top_anorak" else 0.87) * H
        d = smax(d, hem - y, 0.008)
        d = smax(d, y - 1.43 * H, 0.012)
        if kind == "top_anorak":
            v = (y - 1.3 * H) * 0.8 - np.abs(p[..., 0])
            d = smax(d, np.minimum(v, p[..., 2] - 0.02), 0.006)
            front = P["waist"][2] + loose + 0.012
            d = smin(d, flat_pocket(p, np.array([0, 0.965 * H, front]), np.array([0.1, 0.055, 0.006])), 0.004)
            d = smin(d, flat_pocket(p, np.array([-0.068, 1.235 * H, P["chest"][2] + loose + 0.004]), np.array([0.036, 0.042, 0.004])), 0.003)
        return d
    if kind == "coat_halat":
        skirt = cone_capsule(p, J["hips"] + [0, 0.05, 0], J["knee"] * [0, 1, 0] + [0, 0.02, 0], P["hips"][0] + 0.05, P["hips"][0] + 0.09)
        shell = smin(torso - 0.042, skirt, 0.1)
        sleeve = smin(upper - 0.05, fore - 0.045, 0.03)
        n = (J["wrist"] - J["elbow"]); n = n / np.linalg.norm(n)
        sleeve = smax(sleeve, (m - (J["wrist"] - n * 0.05)) @ n, 0.006)
        d = smin(shell, sleeve, 0.05)
        d = smax(d, 0.52 * H - y, 0.01)
        d = smax(d, y - 1.45 * H, 0.012)
        lapel = (y - 1.27 * H) * 0.28 - np.abs(p[..., 0])
        d = smax(d, np.minimum(lapel, p[..., 2] - 0.03), 0.006)
        return d
    if kind == "bottom_joggers":
        straight = cone_capsule(m, J["hip"] + [0.008, 0.02, 0], J["ankle"] + [0.004, 0.035, 0.005], 0.1 * H, 0.08)
        hips = ellipsoid(p, J["hips"] + [0, 0.025, 0], np.array([P["hips"][0] + 0.03, 0.13, P["hips"][2] + 0.03]) * [1, H, 1])
        d = smin(smin(straight, hips, 0.05), smin(torso, leg, 0.05) - 0.028, 0.03)
        d = smax(d, y - 0.99 * H, 0.008)
        d = smax(d, 0.06 * H - y, 0.008)
        gap = box(p, np.array([0, 0.33 * H, 0]), np.array([0.008, 0.38 * H, 0.3]))  # разделение штанин
        d = smax(d, -gap, 0.012)
        side = 0.088 + 0.1 * H + 0.004
        return smin(d, flat_pocket(m, np.array([side, 0.6 * H, 0.0]), np.array([0.006, 0.07, 0.055])), 0.004)
    if kind == "head_cap":
        cap = ellipsoid(p, J["head"] + [0, 0.012, -0.004], np.array([0.082, 0.104, 0.097]) * [1, H, 1])
        return smax(cap, (J["head"][1] + 0.01) - y, 0.01)
    if kind == "head_dokerka":
        cap = ellipsoid(p, J["head"] + [0, 0.035, -0.012], np.array([0.088, 0.112, 0.1]) * [1, H, 1])
        d = smax(cap, (J["head"][1] - 0.002) - y, 0.01)
        band = smax(cone_capsule(p, J["head"] + [0, 0.0, -0.004], J["head"] + [0, 0.03, -0.004], 0.088, 0.088), (J["head"][1] - 0.002) - y, 0.005)
        return smin(d, band, 0.01)
    if kind == "feet_sabo":
        upperpart = ellipsoid(m, J["foot"] + [0, 0.008, 0.008], np.array([0.05, 0.048, 0.122]))
        sole = ellipsoid(m, J["foot"] * [1, 0, 1] + [0, 0.006, 0.008], np.array([0.054, 0.016, 0.128]))
        d = smin(upperpart, sole, 0.012)
        d = smax(d, y - 0.082, 0.008)
        heel = ellipsoid(m, J["ankle"] + [0, 0.03, -0.03], np.array([0.045, 0.055, 0.05]))
        return smax(d, -heel, 0.012)
    raise ValueError(kind)

# ---------- сетка ----------

BOUNDS = {
    "mannequin": ((-0.36, 0.0, -0.2), (0.36, 1.82, 0.22)),
    "top_anorak": ((-0.36, 0.8, -0.22), (0.36, 1.6, 0.24)),
    "top_tshirt": ((-0.36, 0.8, -0.22), (0.36, 1.6, 0.24)),
    "coat_halat": ((-0.4, 0.45, -0.25), (0.4, 1.62, 0.27)),
    "bottom_joggers": ((-0.3, 0.0, -0.2), (0.3, 1.1, 0.2)),
    "head_cap": ((-0.12, 1.5, -0.13), (0.12, 1.86, 0.13)),
    "head_dokerka": ((-0.13, 1.48, -0.14), (0.13, 1.9, 0.14)),
    "feet_sabo": ((-0.18, -0.01, -0.12), (0.18, 0.12, 0.2)),
}


def build(g, kind):
    lo, hi = BOUNDS[kind]
    H = body_params(g)["H"]
    lo = np.array(lo) * [1.08 if g == "m" else 1, H, 1]
    hi = np.array(hi) * [1.08 if g == "m" else 1, H, 1]
    axes = [np.arange(lo[i], hi[i] + STEP, STEP) for i in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing="ij")
    P = np.stack([X, Y, Z], -1)
    d = np.empty(X.shape, np.float32)
    for i in range(X.shape[0]):  # по слоям, чтобы не выйти за память
        d[i] = body_sdf(P[i], g) if kind == "mannequin" else garment_sdf(P[i], g, kind)
    # сглаживаем само поле, а не сетку: сглаживание сетки после marching cubes даёт иглы
    d = gaussian(d, sigma=1.0, preserve_range=True).astype(np.float32)
    verts, faces, _, _ = marching_cubes(d, 0.0, spacing=(STEP, STEP, STEP))
    verts += lo
    mesh = trimesh.Trimesh(verts, faces[:, ::-1], process=True)
    budget = BUDGET["mannequin" if kind == "mannequin" else "garment"]
    if len(mesh.faces) > budget:
        mesh = mesh.simplify_quadric_decimation(face_count=budget)
    mesh.fix_normals()
    return mesh


def export(mesh, name, material, path):
    color = [0.93, 0.93, 0.93, 1.0] if material == "mannequin" else [1, 1, 1, 1]
    mat = trimesh.visual.material.PBRMaterial(name=material, baseColorFactor=color, roughnessFactor=0.85 if material == "fabric" else 0.55, metallicFactor=0.0, doubleSided=True)
    mesh.visual = trimesh.visual.TextureVisuals(material=mat)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    path.write_bytes(scene.export(file_type="glb"))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    kinds = ["mannequin", "top_anorak", "top_tshirt", "coat_halat", "bottom_joggers", "head_cap", "head_dokerka", "feet_sabo"]
    only = set(sys.argv[2:])
    for g in ("f", "m"):
        for k in kinds:
            if only and k not in only:
                continue
            mesh = build(g, k)
            f = OUT / f"{k}_{g}.glb"
            export(mesh, k, "mannequin" if k == "mannequin" else "fabric", f)
            manifest[f.name] = {"tris": int(len(mesh.faces)), "bytes": f.stat().st_size, "min": mesh.bounds[0].round(3).tolist(), "max": mesh.bounds[1].round(3).tolist()}
            print(f.name, manifest[f.name]["tris"], manifest[f.name]["bytes"])
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
