"""
Шаг 2 пайплайна реалистичных моделей MEDFORM: одежда по реальной фигуре.

Берёт тело из tools/3d/mh_body.py (body_<g>.npz: вершины, треугольники, зоны) и строит каждую вещь
объёмом на воксельной сетке:
  1. зона тела, которую закрывает вещь (торс, плечи, ноги...), раздувается на свободу кроя;
  2. «драпировка»: ткань свисает вниз от самых выступающих мест (грудь, лопатки, бёдра), как под весом;
  3. вычитаются части тела, которые остаются снаружи (предплечья у подола, шея), режутся проймы,
     вырез, подол; резинки собираются с мелкими складками;
  4. поверхность строится marching cubes, упрощается в бюджет ТЗ, накладные детали (карманы, клапаны,
     манжеты, пуговицы) добавляются отдельными слоями.
Результат: <out>/parts_<g>.npz со всеми вещами (вершины, треугольники, UV, материал fabric/trim);
сборку GLB с текстурой ткани и запечённым AO делает tools/3d/assemble.py.

    python3 tools/3d/garments.py <work_dir> f
"""
import sys
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

WORK, G = Path(sys.argv[1]), sys.argv[2]
ONLY = set(sys.argv[3:])
STEP = 0.004
d = np.load(WORK / f"body_{G}.npz")
BV, BF, ZONE, SIDE, HAIR = d["V"], d["F"], d["zone"], d["side"], d["hair"]
ZN = list(d["zones"])
H = BV[:, 1].max()
# лицевые кости MakeHuman иногда «владеют» вершинами груди: всё ниже шеи с зоной head → chest
_neck_lo = BV[ZONE == ZN.index("neck"), 1].min()
ZONE = ZONE.copy()
ZONE[(ZONE == ZN.index("head")) & (BV[:, 1] < _neck_lo)] = ZN.index("chest")
S = H / 1.68  # масштаб относительно женской модели (все отметки заданы для 1.68 м)


def zid(*names):
    return [ZN.index(n) for n in names]


# ---------- воксельная сетка и тело ----------
LO = BV.min(0) - 0.12
HI = BV.max(0) + 0.12
LO[1] = -0.01
SHAPE = np.ceil((HI - LO) / STEP).astype(int)
axes = [LO[i] + STEP * (np.arange(SHAPE[i]) + 0.5) for i in range(3)]
X, Y, Z = np.meshgrid(*axes, indexing="ij")


def surface_points(V, F, spacing):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
    n = np.maximum(1, np.ceil(area / (spacing ** 2) * 2)).astype(int)
    idx = np.repeat(np.arange(len(F)), n)
    r1, r2 = np.random.rand(len(idx)), np.random.rand(len(idx))
    flip = r1 + r2 > 1
    r1[flip], r2[flip] = 1 - r1[flip], 1 - r2[flip]
    pts = a[idx] + r1[:, None] * (b - a)[idx] + r2[:, None] * (c - a)[idx]
    return np.vstack([pts, V]), np.concatenate([idx, -np.ones(len(V), int)])


np.random.seed(7)
pts, _ = surface_points(BV, BF, STEP * 0.5)
ijk = np.clip(((pts - LO) / STEP).astype(int), 0, SHAPE - 1)
shell = np.zeros(SHAPE, bool)
shell[tuple(ijk.T)] = True
shell = ndimage.binary_dilation(shell, iterations=1)
inside = ndimage.binary_fill_holes(shell)
tree = cKDTree(BV)
cells = np.argwhere(inside)
_, nn = tree.query(LO + STEP * (cells + 0.5))
LABEL = np.full(SHAPE, -1, np.int8)
LABEL[tuple(cells.T)] = ZONE[nn]
SIDEV = np.zeros(SHAPE, np.int8)
SIDEV[tuple(cells.T)] = SIDE[nn]
print("grid", SHAPE, "inside voxels", len(cells))


def region(names, side=None):
    m = np.isin(LABEL, zid(*names))
    if side is not None:
        m &= SIDEV == side
    return m


def sdf(mask):
    """Знаковое расстояние до области (м): снаружи +, внутри −."""
    out = ndimage.distance_transform_edt(~mask) * STEP
    inn = ndimage.distance_transform_edt(mask) * STEP
    return out - inn


def drape(mask, length):
    """Ткань свисает вниз: воксель занят, если занят любой воксель выше в пределах length."""
    n = max(1, int(length / STEP))
    # maximum_filter1d по оси Y, окно смотрит только вверх
    return ndimage.maximum_filter1d(mask.astype(np.uint8), size=n, axis=1, origin=-(n // 2)).astype(bool)


def axis_of(names, side):
    """Ось части тела: (верхняя точка, нижняя точка) по вершинам зоны."""
    m = np.isin(ZONE, zid(*names)) & (SIDE == side)
    P = BV[m]
    c = P.mean(0)
    u, s, vt = np.linalg.svd(P - c)
    a = vt[0] if vt[0][1] < 0 else -vt[0]   # вниз
    t = (P - c) @ a
    return c + a * t.min(), c + a * t.max(), a


# ---------- сборка поверхности ----------
OUTPARTS = {}


def mesh_from(occ, sigma, cuts=(), budget=15500, name="", keep_all=False):
    """occ → гладкая поверхность; cuts: функции c(P) (>0 = срезать) для открытых краёв."""
    f = ndimage.gaussian_filter(occ.astype(np.float32), sigma / STEP)
    v, fc, _, _ = marching_cubes(f, 0.5, spacing=(STEP,) * 3)
    v += LO + STEP / 2
    m = trimesh.Trimesh(v, fc[:, ::-1], process=True)  # нормали наружу
    # убираем «крышки» по линиям среза (проймы, вырез, подол становятся открытыми краями)
    cen, nrm = m.triangles_center, m.face_normals
    kill = np.zeros(len(m.faces), bool)
    for c in cuts:
        kill |= as_cut(c).cap(cen, nrm, sigma)
    m.update_faces(~kill)
    m.remove_unreferenced_vertices()
    # оставляем самую большую связную часть (мелкие ошмётки от вычитаний)
    parts = m.split(only_watertight=False)
    if keep_all:
        m = trimesh.util.concatenate([p for p in parts if len(p.faces) > 400])
    else:
        m = max(parts, key=lambda p: len(p.faces))
    if len(m.faces) > budget:
        vv, ff = fast_simplification.simplify(m.vertices, m.faces, 1 - budget / len(m.faces))
        m = trimesh.Trimesh(vv, ff, process=True)
    trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=6)
    print(f"  {name}: {len(m.faces)} tris")
    return m


class Cut:
    """Срез: fn(P) > 0 — отрезать; where(P) — где срез действует; normal — нормаль «крышки» для удаления."""

    def __init__(self, fn, where=None, normal=None):
        self.fn, self.where, self.normal = fn, where, normal

    def outside(self, P):
        o = self.fn(P) > 0
        return o & self.where(P) if self.where is not None else o

    def cap(self, cen, nrm, sigma):
        k = self.fn(cen) > -sigma * 0.9
        if self.where is not None:
            k &= self.where(cen)
        if self.normal is not None:
            k &= nrm @ np.asarray(self.normal, float) > 0.45
        return k


def as_cut(c):
    return c if isinstance(c, Cut) else Cut(c)


def cut_plane(p0, n):
    p0, n = np.asarray(p0, float), np.asarray(n, float) / np.linalg.norm(n)
    return lambda P: (P - p0) @ n


def cut_masked(c, cond):
    return lambda P: np.where(cond(P), c(P), -1.0)


def apply_cuts(occ, cuts):
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    keep = np.ones(len(P), bool)
    for c in cuts:
        keep &= ~as_cut(c).outside(P)
    return occ & keep.reshape(occ.shape)


def patch(m, select, offset, name, mat="fabric", shrink=0.0):
    """Накладная деталь: копия участка поверхности, отодвинутая наружу (карманы, клапаны, лацканы)."""
    cen = m.triangles_center
    keepf = select(cen) & (m.face_normals @ np.array([0, 0, 1.0]) > -2)
    if not keepf.any():
        return None
    sub = m.submesh([np.where(keepf)[0]], append=True)
    sub.vertices += sub.vertex_normals * offset
    return sub


def rect_patch(m, axis, sign, u0, u1, v0, v1, offset, n=(24, 24), shape=None, uv_fn=None):
    """Ровная накладная деталь: сетка в прямоугольнике (u,v), спроецированная на поверхность вещи вдоль оси.
    axis=2 (спереди, u=x, v=y) или axis=0 (сбоку, u=z, v=y); sign — с какой стороны (+1/−1)."""
    V, N = m.vertices, m.vertex_normals
    ua = 0 if axis == 2 else 2
    face = (N[:, axis] * sign > 0.2) & (V[:, axis] * sign > 0)
    P = V[face]
    tree = cKDTree(P[:, [ua, 1]])
    us, vs = np.linspace(u0, u1, n[0]), np.linspace(v0, v1, n[1])
    U, Vv = np.meshgrid(us, vs, indexing="ij")
    if uv_fn is not None:
        U, Vv = uv_fn(*np.meshgrid(np.linspace(0, 1, n[0]), np.linspace(0, 1, n[1]), indexing="ij"))
    if shape is not None:
        lo, hi = shape(Vv)
        U = lo + (U - u0) / (u1 - u0) * (hi - lo)
    q = np.stack([U.ravel(), Vv.ravel()], 1)
    dist, idx = tree.query(q, k=8)
    w = 1 / (dist + 1e-4)
    depth = (P[idx, axis] * w).sum(1) / w.sum(1)
    nrm = (N[face][idx] * w[..., None]).sum(1) / w.sum(1)[:, None]
    nrm /= np.linalg.norm(nrm, axis=1)[:, None]
    pts = np.zeros((len(q), 3))
    pts[:, ua], pts[:, 1], pts[:, axis] = q[:, 0], q[:, 1], depth
    pts += nrm * offset
    faces = []
    for i in range(n[0] - 1):
        for j in range(n[1] - 1):
            a, b, c, d_ = i * n[1] + j, (i + 1) * n[1] + j, (i + 1) * n[1] + j + 1, i * n[1] + j + 1
            faces += [(a, b, c), (a, c, d_)] if (axis == 2) == (sign > 0) else [(a, c, b), (a, d_, c)]
    pm = trimesh.Trimesh(pts, np.array(faces), process=False)
    trimesh.smoothing.filter_laplacian(pm, iterations=2, volume_constraint=False)
    return pm


def edge_shade(m, dark=0.7, rings=1):
    """Затемнение по открытым краям (строчка, тень под краем кармана) — множитель к AO в цвете вершин."""
    sh = np.ones(len(m.vertices), np.float32)
    try:
        b = trimesh.grouping.group_rows(m.edges_sorted, require_count=1)
    except Exception:
        return sh
    if len(b) == 0:
        return sh
    edge_v = np.unique(m.edges_sorted[b])
    sh[edge_v] = dark
    cur = set(edge_v.tolist())
    nb = m.vertex_neighbors
    for r in range(rings):
        nxt = set()
        for v in cur:
            nxt.update(nb[v])
        nxt -= cur
        idx = np.array(sorted(nxt), int)
        if len(idx):
            sh[idx] = np.minimum(sh[idx], dark + (1 - dark) * (r + 1) / (rings + 1))
        cur |= nxt
    return sh


def add(name, mesh, mat="fabric", dark=0.82, lines=()):
    """lines: функции P → расстояние до линии строчки (м); строчка = узкая тёмная полоса в AO."""
    sh = edge_shade(mesh, dark) if mat == "fabric" else np.ones(len(mesh.vertices), np.float32)
    for fn in lines:
        dd = fn(np.asarray(mesh.vertices))
        sh *= 1 - 0.3 * np.exp(-(dd / 0.0028) ** 2)
    OUTPARTS.setdefault(name, []).append((mesh, mat, sh))


def ring_gather(P, center, n=34, amp=0.004):
    th = np.arctan2(P[:, 0] - center[0], P[:, 2] - center[2])
    return amp * np.sin(th * n)


TORSO = ("chest", "belly", "pelvis")
L_UP, R_UP = axis_of(("upperarm",), 1), axis_of(("upperarm",), -1)
L_LO, R_LO = axis_of(("lowerarm",), 1), axis_of(("lowerarm",), -1)
neck_pts = BV[ZONE == ZN.index("neck")]
NECK_Y = neck_pts[:, 1].min()
NECK_C = neck_pts.mean(0)
SH_Y = BV[ZONE == ZN.index("upperarm")][:, 1].max()
CROTCH_Y = 0.80 * S
WAIST_Y = (1.035 if G == "f" else 1.08) * S
HIP_Y = 0.90 * S
KNEE_Y = 0.49 * S

GP = np.stack([X, Y, Z], -1)


def field_eval(fn):
    return fn(GP.reshape(-1, 3)).reshape(X.shape)


_tv = BV[np.isin(ZONE, zid("chest", "belly", "pelvis"))]
_bins = np.arange(0, H + 0.02, 0.02)
_tw = np.array([np.abs(_tv[(np.abs(_tv[:, 1] - y) < 0.03), 0]).max() if (np.abs(_tv[:, 1] - y) < 0.03).any() else 0.0 for y in _bins])


def torso_halfwidth(y):
    return np.interp(y, _bins, _tw)


SD_ARM = sdf(region(("upperarm", "lowerarm", "hand")))
SD_TOR = sdf(region(("chest", "belly", "pelvis", "upperleg", "neck")))
ARMPIT_Y = SH_Y - 0.075 * S


def sample(field, P):
    idx = ((P - LO) / STEP - 0.5).T
    return ndimage.map_coordinates(field, idx, order=1, mode="nearest")


def axis_dist(P, axis):
    a0, a1, a = axis
    t = np.clip((P - a0) @ a, -0.15, np.linalg.norm(a1 - a0) + 0.15)
    return np.linalg.norm(P - (a0 + t[:, None] * a), axis=1)


def sleeve_cut(axis, frac, side, r=0.1):
    """Конец рукава: плоскость поперёк оси руки, действует только у руки; крышка с нормалью вдоль оси."""
    a0, a1, a = axis
    p0 = a0 + (a1 - a0) * frac
    return Cut(cut_plane(p0, a), lambda P: (axis_dist(P, axis) < r) & (P[:, 0] * side > 0), a)


def sleeves(axes_by_side, frac, loose, regions=("upperarm",)):
    """Рукава отдельными трубами вокруг руки до линии среза."""
    occ = np.zeros(SHAPE, bool)
    cuts = []
    for side, ax in axes_by_side:
        sd = sdf(region(regions, side))
        c = sleeve_cut(ax, frac, side)
        o = (sd < loose)
        o = apply_cuts(o, [Cut(c.fn, lambda P, side=side: P[:, 0] * side > 0)])
        occ |= o
        cuts.append(c)
    return occ, cuts


# ---------- верх (анорак): оверсайз, V-вырез, спущенное плечо, короткий рукав с отворотом, резинка по низу ----------
def build_top(kind="anorak"):
    print(kind)
    torso = region(TORSO) | (region(("upperleg",)) & (Y > HIP_Y - 0.06 * S))
    loose = 0.032 if kind == "anorak" else 0.022
    sd_t = sdf(torso)
    occ = sd_t < loose
    occ = drape(occ, 0.22 * S) & (sd_t < 0.09) | occ
    # канал под руку ниже подмышки: полочка не заходит в рукав и не режет руку
    occ &= ~((SD_ARM < 0.012) | ((SD_ARM < SD_TOR) & (Y < ARMPIT_Y)))
    frac = 0.62 if kind == "anorak" else 0.55
    sl, sl_cuts = sleeves(((1, L_UP), (-1, R_UP)), frac, loose * 0.9)
    occ |= sl
    # спущенное плечо: мост между торсом и рукавом
    occ |= (np.minimum(sd_t, SD_ARM) < loose) & (Y > ARMPIT_Y - 0.01) & (Y < SH_Y - 0.005)
    # предплечья, кисти, шея и голова остаются снаружи
    outside = region(("lowerarm", "hand", "head", "neck"))
    occ &= ~(sdf(outside) < 0.012)
    hem = (0.86 if kind == "anorak" else 0.84) * S
    if kind == "anorak":
        # резинка: в полосе 7 см над подолом ткань собирается к телу с мелкими складками
        band = (Y > hem) & (Y < hem + 0.09 * S)
        ramp = np.clip((Y - hem - 0.035 * S) / (0.055 * S), 0, 1) ** 1.5
        lim = 0.008 + ramp * 0.06 + field_eval(lambda P: ring_gather(P, (0, 0, 0.02), 40, 0.0035))
        occ &= ~(band & (sd_t > lim))
    # вырез
    if kind == "anorak":
        vy = NECK_Y - 0.135 * S
        neck_cut = lambda P: np.where(P[:, 2] > NECK_C[2] - 0.01,  # noqa: E731
                                      P[:, 1] - (vy + 1.25 * np.abs(P[:, 0] - NECK_C[0])),
                                      P[:, 1] - (NECK_Y + 0.025 * S))
    else:
        neck_cut = lambda P: P[:, 1] - (NECK_Y + 0.01 + 18 * ((P[:, 0] - NECK_C[0]) ** 2 + 0.4 * (P[:, 2] - NECK_C[2]) ** 2))  # noqa: E731
    neck = Cut(neck_cut, lambda P: (np.abs(P[:, 0]) < 0.13 * S) & (P[:, 1] > NECK_Y - 0.2 * S))
    hem_cut = Cut(cut_plane((0, hem, 0), (0, -1, 0)), None, (0, -1, 0))
    cuts = [hem_cut, neck]
    occ = apply_cuts(occ, cuts)
    cuts += sl_cuts
    m = mesh_from(occ, 0.007, cuts, name=kind)
    lines = []
    if kind == "anorak":
        lines.append(lambda P: np.abs(P[:, 1] - (hem + 0.04 * S)) + (P[:, 1] > hem + 0.07 * S))
    for ax, sd_ in ((L_UP, 1), (R_UP, -1)):
        a0, a1, a = ax
        p0 = a0 + (a1 - a0) * frac - a * (0.045 * S if kind == "anorak" else 0.022 * S)
        lines.append(lambda P, p0=p0, a=a, ax=ax, sd_=sd_: np.abs((P - p0) @ a) + 1.0 * ((axis_dist(P, ax) > 0.1) | (P[:, 0] * sd_ < 0)))
    lines.append(lambda P: np.abs(np.abs(P[:, 0]) - torso_halfwidth(P[:, 1]) - 0.025) + 1.0 * (np.abs(P[:, 2] - 0.0) > 0.03))  # боковые швы
    add(f"top_{kind}", m, lines=lines)
    global TOP_OCC
    if kind == "anorak":
        TOP_OCC = occ
    if kind == "anorak":
        front = lambda P: P[:, 2] > 0.02  # noqa: E731
        # нагрудный карман (на левой стороне груди модели = +X), ручка в кармане (trim)
        cx = 0.085 * S
        ch = NECK_Y - 0.12 * S
        add("top_anorak", rect_patch(m, 2, 1, cx - 0.055 * S, cx + 0.055 * S, ch - 0.13 * S, ch, 0.003), dark=0.7, lines=[])
        # карман-кенгуру: трапеция над резинкой (боковые входы скошены)
        ky0, ky1 = hem + 0.075 * S, hem + 0.205 * S
        add("top_anorak", rect_patch(m, 2, 1, -0.15 * S, 0.15 * S, ky0, ky1, 0.0035, n=(40, 20),
                                     shape=lambda v: (-0.15 * S + (v - ky0) * 0.45, 0.15 * S - (v - ky0) * 0.45)), dark=0.68)
        # отворот рукава
        for ax, s in ((L_UP, 1), (R_UP, -1)):
            a0, a1, a = ax
            p0 = a0 + (a1 - a0) * 0.62
            cuff = lambda P, p0=p0, a=a, s=s, ax=ax: ((P - p0) @ a > -0.045 * S) & (axis_dist(P, ax) < 0.1) & (P[:, 0] * s > 0)  # noqa: E731
            pk = patch(m, cuff, 0.005, "cuff")
            if pk is not None:
                add("top_anorak", pk)
        # ручка в нагрудном кармане
        pen = trimesh.creation.cylinder(radius=0.0045, height=0.07, sections=12)
        pen.apply_translation((cx + 0.03 * S, ch + 0.005, 0))
        zfront = m.vertices[(np.abs(m.vertices[:, 0] - (cx + 0.03 * S)) < 0.01) & (np.abs(m.vertices[:, 1] - ch) < 0.01) & (m.vertices[:, 2] > 0), 2]
        if len(zfront):
            pen.apply_translation((0, 0, zfront.max() - 0.002))
            add("top_anorak", pen, "trim")
    return occ


# ---------- брюки: широкие прямые, карго, пояс на резинке ----------
def build_pants():
    print("joggers")
    occ = np.zeros(SHAPE, bool)
    pel = region(TORSO) & (Y < WAIST_Y + 0.02)
    sd_p = sdf(pel)
    for s in (1, -1):
        leg = region(("upperleg", "lowerleg"), s) | (region(("foot",), s) & (Y > 0.07 * S))
        sd = sdf(leg | (pel & (X * s > -0.005)))
        o = sd < 0.024
        hang = drape((sdf(leg) < 0.024) & (Y < HIP_Y), 0.75 * S) & (sd < 0.07) & (X * s > 0.006)
        o |= hang                                            # штанина прямая и широкая, висит от бедра
        occ |= o
    occ &= ~((np.abs(X) < 0.011) & (Y < CROTCH_Y - 0.025 * S))  # шаговый шов: штанины раздельные
    # пояс на резинке: последние 4 см стянуты к телу со складками
    band = Y > WAIST_Y - 0.045 * S
    lim = 0.012 + field_eval(lambda P: ring_gather(P, (0, 0, 0), 44, 0.003))
    occ &= ~(band & (sd_p > lim) & (Y > CROTCH_Y + 0.05))
    hem_y = 0.035 * S
    cuts = [Cut(cut_plane((0, WAIST_Y, 0), (0, 1, 0)), None, (0, 1, 0)), Cut(cut_plane((0, hem_y, 0), (0, -1, 0)), None, (0, -1, 0))]
    occ = apply_cuts(occ, cuts)
    # штанины чуть «ломаются» на обуви: небольшое расширение у низа
    m = mesh_from(occ, 0.0065, cuts, name="joggers")
    add("bottom_joggers", m, lines=[lambda P: np.abs(P[:, 1] - (WAIST_Y - 0.045 * S)) + (P[:, 1] < WAIST_Y - 0.07 * S),
                                    lambda P: np.abs(P[:, 1] - 0.065 * S) + (P[:, 1] > 0.09 * S)])
    # карманы-карго на боковой стороне бедра + клапан, косые передние карманы
    for sgn in (1, -1):
        add("bottom_joggers", rect_patch(m, 0, sgn, -0.065 * S, 0.075 * S, 0.50 * S, 0.655 * S, 0.006, n=(24, 26)), dark=0.62)
        add("bottom_joggers", rect_patch(m, 0, sgn, -0.07 * S, 0.08 * S, 0.62 * S, 0.668 * S, 0.011, n=(24, 10)), dark=0.55)
        x0, x1 = (0.07 * S, 0.16 * S)
        lo, hi = (x0, x1) if sgn > 0 else (-x1, -x0)
        add("bottom_joggers", rect_patch(m, 2, 1, lo, hi, WAIST_Y - 0.15 * S, WAIST_Y - 0.06 * S, 0.0025, n=(16, 16),
                                         shape=(lambda v, lo=lo, hi=hi, sgn=sgn: (lo + (np.maximum(0, (v - (WAIST_Y - 0.15 * S)) * 0.8) if sgn < 0 else 0), hi - (np.maximum(0, (v - (WAIST_Y - 0.15 * S)) * 0.8) if sgn > 0 else 0)))), dark=0.66)
    return occ


# ---------- халат: до колена, длинный рукав, лацканы, пуговицы, накладные карманы ----------
def build_coat(top_occ, pants_occ):
    print("halat")
    up = region(TORSO) | (region(("upperleg",)) & (Y > KNEE_Y + 0.12 * S))
    sd = sdf(up)
    occ = sd < 0.036
    occ = drape(occ, 0.55 * S) & (sd < 0.075) & (Y > 0.36 * S) | occ
    for o in (top_occ, pants_occ):
        if o is not None:
            occ |= ndimage.binary_dilation(o & (Y > 0.4 * S) & ~((SD_ARM < SD_TOR) & (Y < ARMPIT_Y) & (Y > HIP_Y + 0.05 * S)), iterations=2)
            if o is pants_occ:
                occ |= ndimage.binary_dilation(o & (Y > 0.45 * S) & (Y < HIP_Y), iterations=4)
    occ &= ~(((SD_ARM < 0.02) | ((SD_ARM < SD_TOR) & (Y < ARMPIT_Y))) & (Y > HIP_Y + 0.05 * S))
    sl, sl_cuts = sleeves(((1, L_LO), (-1, R_LO)), 0.86, 0.034, ("upperarm", "lowerarm"))
    if top_occ is not None:
        sl |= ndimage.binary_dilation(top_occ & (SD_ARM < SD_TOR), iterations=2) & (SD_ARM < 0.07)
    occ |= sl
    occ |= (np.minimum(sd, SD_ARM) < 0.04) & (Y > ARMPIT_Y - 0.01) & (Y < SH_Y + 0.01)
    occ &= ~(sdf(region(("head",))) < 0.01)
    hem = 0.47 * S
    vy = NECK_Y - 0.25 * S
    neck_cut = Cut(lambda P: np.where(P[:, 2] > NECK_C[2] - 0.02, P[:, 1] - (vy + 1.6 * np.abs(P[:, 0])), P[:, 1] - (NECK_Y + 0.035 * S)),
                   lambda P: (np.abs(P[:, 0]) < 0.15 * S) & (P[:, 1] > NECK_Y - 0.4 * S))
    cuts = [Cut(cut_plane((0, hem, 0), (0, -1, 0)), None, (0, -1, 0)), neck_cut]
    occ = apply_cuts(occ, cuts)
    cuts += sl_cuts
    m = mesh_from(occ, 0.008, cuts, budget=15000, name="halat")
    add("coat_halat", m)
    cen, nz = m.triangles_center, m.face_normals[:, 2]
    front = (cen[:, 2] > 0.03) & (nz > 0.25)
    # лацканы вдоль выреза
    top_y = NECK_Y + 0.015
    for sg in (1, -1):
        def lap_uv(s_, t_, sg=sg):
            y = vy + 0.01 + s_ * (top_y - vy - 0.01)
            x_edge = sg * ((y - vy) / 1.6 + 0.004)
            w = 0.058 * S * (0.3 + 0.7 * np.clip(s_, 0, 1) ** 0.7) * (1 - 0.3 * np.clip((s_ - 0.88) / 0.12, 0, 1))
            return x_edge + sg * t_ * w, y
        add("coat_halat", rect_patch(m, 2, 1, 0, 1, 0, 1, 0.0045, n=(28, 10), uv_fn=lap_uv), dark=0.72)
    # планка застёжки
    add("coat_halat", rect_patch(m, 2, 1, -0.017 * S, 0.017 * S, hem + 0.01, vy - 0.005, 0.002, n=(6, 60)), dark=0.85)
    # планка застёжки и пуговицы
    zf = lambda x, y: m.vertices[(np.abs(m.vertices[:, 0] - x) < 0.012) & (np.abs(m.vertices[:, 1] - y) < 0.012) & (m.vertices[:, 2] > 0), 2]  # noqa: E731
    for y in np.linspace(vy - 0.02, hem + 0.12 * S, 5):
        z = zf(0.0, y)
        if len(z):
            b = trimesh.creation.cylinder(radius=0.0085, height=0.004, sections=20)
            b.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, (1, 0, 0)))
            b.apply_translation((0.0, y, z.max() + 0.002))
            add("coat_halat", b, "trim")
    # накладные карманы: два нижних и нагрудный
    for x0, y0, y1, w in ((0.11, hem + 0.13 * S, hem + 0.30 * S, 0.075), (-0.11, hem + 0.13 * S, hem + 0.30 * S, 0.075),
                          (0.115, NECK_Y - 0.27 * S, NECK_Y - 0.185 * S, 0.048)):
        add("coat_halat", rect_patch(m, 2, 1, (x0 - w) * S, (x0 + w) * S, y0, y1, 0.004), dark=0.7)


# ---------- головные уборы ----------
hair_ijk = np.clip(((HAIR - LO) / STEP).astype(int), 0, SHAPE - 1)
HAIRM = np.zeros(SHAPE, bool)
HAIRM[tuple(hair_ijk.T)] = True
HAIRM = ndimage.binary_closing(ndimage.binary_dilation(HAIRM, iterations=1), iterations=2)
HEAD_TOP = BV[:, 1].max()
head_pts = BV[ZONE == ZN.index("head")]
HEAD_C = np.array([0.0, HEAD_TOP - 0.11 * S, head_pts[:, 2].mean() - 0.005])


def build_cap(kind):
    print(kind)
    head = region(("head",)) | (HAIRM & (Y > HEAD_TOP - 0.2 * S))
    sd = sdf(head)
    if kind == "cap":
        occ = sd < 0.011
        # шапочка: от верха лба, над ушами, сзади ниже затылка; небольшой объём сверху
        brow = HEAD_TOP - 0.072 * S
        cut = lambda P: (brow - 0.05 * np.clip(-(P[:, 2] - HEAD_C[2]) / 0.1, 0, 1) * S) - P[:, 1]  # noqa: E731
        occ |= (sd < 0.019) & (Y > HEAD_TOP - 0.045 * S)
    else:
        occ = sd < 0.012
        brow = HEAD_TOP - 0.07 * S
        cut = lambda P: (brow - 0.025 * np.clip(-(P[:, 2] - HEAD_C[2]) / 0.1, 0, 1) * S) - P[:, 1]  # noqa: E731
    occ = apply_cuts(occ, [cut])
    m = mesh_from(occ, 0.006, [cut], budget=9000, name=kind)
    add(f"head_{kind}", m)
    cen = m.triangles_center
    if kind == "dokerka":
        # отворот трикотажной шапки
        lo = cen[:, 1] - (brow - 0.025 * np.clip(-(cen[:, 2] - HEAD_C[2]) / 0.1, 0, 1) * S)
        sel = lo < 0.045 * S
        p = m.submesh([np.where(sel)[0]], append=True)
        p.vertices += p.vertex_normals * 0.006
        add("head_dokerka", p, dark=0.72)
    else:
        # завязки сзади
        back = m.vertices[m.vertices[:, 2] < HEAD_C[2] - 0.06]
        if len(back):
            b = back[np.argmin(back[:, 1])]
            for dx, ang in ((-0.012, 0.25), (0.012, -0.25)):
                t = trimesh.creation.box((0.012, 0.09, 0.002))
                t.apply_transform(trimesh.transformations.rotation_matrix(ang, (0, 0, 1)))
                t.apply_translation((b[0] + dx * 2, b[1] - 0.04, b[2] - 0.004))
                add("head_cap", t)


# ---------- сабо ----------
def build_sabo():
    print("sabo")
    occ = np.zeros(SHAPE, bool)
    for s in (1, -1):
        foot = region(("foot",), s) & (Y < 0.1 * S)
        sd = sdf(foot)
        pts = BV[(ZONE == ZN.index("foot")) & (SIDE == s)]
        zmin, zmax = pts[:, 2].min(), pts[:, 2].max()
        upper = (sd < 0.014) & (Z > zmin + 0.085 * S)               # объёмный мысок, пятка открыта
        upper &= Y < 0.088 * S
        foot_print = ndimage.binary_dilation(foot & (Y < 0.03), iterations=5)
        sole = (sd < 0.012) | drape(foot_print, 0.02) | foot_print
        sole &= Y < 0.03
        so = upper | sole
        # ремешок за пяткой
        cx = pts[:, 0].mean()
        rr = np.sqrt((X - cx) ** 2 / 1.0 + (Z - (zmin + 0.065 * S)) ** 2)
        strap = (np.abs(rr - 0.055 * S) < 0.006) & (np.abs(Y - 0.045 * S) < 0.009) & (Z < zmin + 0.07 * S)
        so |= strap & ~(sd < 0.003)
        # вентиляционные отверстия сверху на мыске
        for i in range(-2, 3):
            for j in range(3):
                hx = cx + i * 0.018 * S
                hz = zmax - 0.03 * S - j * 0.025 * S + (i % 2) * 0.012 * S
                hole = ((X - hx) ** 2 + (Z - hz) ** 2 < (0.0062 * S) ** 2) & (Y > 0.045)
                so &= ~hole
        so &= ~(sd < 0.002)
        occ |= so
    m = mesh_from(occ, 0.0035, [], budget=17000, name="sabo", keep_all=True)
    add("feet_sabo", m)


# ---------- аксессуары ----------
def build_lanyard():
    print("lanyard")
    neck = BV[ZONE == ZN.index("neck")]
    y0 = NECK_Y + 0.01
    cz = NECK_C[2] - 0.005
    rx, rz = np.ptp(neck[:, 0]) / 2 + 0.012, np.ptp(neck[:, 2]) / 2 + 0.018
    chest = BV[np.isin(ZONE, zid(*TORSO)) & (np.abs(BV[:, 0]) < 0.04)]
    def zfront(y):
        if TOP_OCC is not None:
            j = int((y - LO[1]) / STEP)
            col = TOP_OCC[:, j, :] & (np.abs(axes[0])[:, None] < 0.035)
            if col.any():
                return axes[2][np.where(col.any(0))[0].max()] + 0.006
        c = chest[np.abs(chest[:, 1] - y) < 0.02]
        return (c[:, 2].max() if len(c) else 0.12) + 0.028
    tip = np.array([0.0, NECK_Y - 0.30 * S, zfront(NECK_Y - 0.30 * S)])
    path = []
    for t in np.linspace(-np.pi * 0.62, np.pi * 0.62, 40):  # вокруг шеи сзади
        path.append((rx * np.sin(t), y0 - 0.01 * np.cos(t), cz - rz * np.cos(t)))
    left = np.array(path[-1])
    right = np.array(path[0])
    for a, sgn in ((left, 1), (right, -1)):
        pass
    def strand(a, b, n=24):
        out = []
        for t in np.linspace(0, 1, n):
            p = a + (b - a) * t
            p[2] = max(p[2], zfront(p[1]) if p[1] < NECK_Y - 0.02 else p[2])
            out.append(p)
        return out
    full = strand(tip.copy(), right)[::-1][:-1] + [np.array(p) for p in path] + strand(left, tip.copy())[1:]
    full = np.array(full)
    # лента: прямоугольное сечение 15 × 1.5 мм вдоль пути
    verts, faces = [], []
    w, th = 0.0075, 0.001
    for i, p in enumerate(full):
        tng = full[min(i + 1, len(full) - 1)] - full[max(i - 1, 0)]
        tng /= np.linalg.norm(tng)
        outw = np.array([p[0], 0, p[2] - cz])
        outw -= tng * (outw @ tng)
        nrm = outw / (np.linalg.norm(outw) + 1e-9)
        bin_ = np.cross(tng, nrm)
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(p + bin_ * w * sx + nrm * th * sy)
    for i in range(len(full) - 1):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces += [(a, b, b + 4), (a, b + 4, a + 4)]
    add("acc_lanyard", trimesh.Trimesh(np.array(verts), np.array(faces)))
    # карабин и бейдж (trim)
    clip = trimesh.creation.torus(0.009, 0.0022)
    clip.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, (0, 1, 0)))
    clip.apply_translation(tip + (0, -0.012, 0.002))
    add("acc_lanyard", clip, "trim")
    card = trimesh.creation.box((0.056, 0.086, 0.003))
    card.apply_translation(tip + (0, -0.072, 0.004))
    add("acc_lanyard", card, "trim")


def build_shopper():
    """Шопер стоит на полу рядом с моделью: мягкая ткань, две ручки-дуги."""
    print("shopper")
    feet = BV[ZONE == ZN.index("foot")]
    x0 = feet[:, 0].max() + 0.2
    w, h, dpt = 0.38, 0.40, 0.10
    body = trimesh.creation.box((w, h, dpt))
    for _ in range(4):
        body = body.subdivide()
    v = body.vertices.copy()
    u, t = 2 * v[:, 0] / w, 2 * v[:, 1] / h          # −1..1
    # мягкие углы и чуть «осевший» верх
    v[:, 2] *= 1 - 0.55 * np.clip(t, 0, 1) ** 2      # к верху сумка сплющивается
    v[:, 2] *= 0.75 + 0.25 * (1 - u ** 8)
    v[:, 1] -= 0.012 * (1 - u ** 2) * (t > 0.98)
    v[:, 0] *= 1 - 0.04 * (1 - t) / 2
    body.vertices = v
    body.apply_translation((0, h / 2 + 0.002, 0))
    parts = [body]
    for zz in (dpt * 0.22, -dpt * 0.22):
        arc = trimesh.creation.torus(0.085, 0.0075, major_sections=40, minor_sections=10)
        # оставляем верхнюю половину тора — дуга ручки
        keep = arc.triangles_center[:, 1] > -0.002
        arc.update_faces(keep)
        arc.remove_unreferenced_vertices()
        arc.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, (1, 0, 0)))
        arc.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0)))
        arc.vertices[:, 1] *= 1.6
        arc.apply_translation((0, h - 0.004, zz))
        parts.append(arc)
    bag = trimesh.util.concatenate(parts)
    bag.apply_transform(trimesh.transformations.rotation_matrix(0.5, (0, 1, 0)))
    bag.apply_translation((x0, 0, 0.06))
    add("acc_shopper", bag, dark=0.9)


# ---------- базовое бельё (часть манекена) ----------
def build_base():
    print("base layer")
    tor = region(TORSO) | region(("upperleg",))
    sd = sdf(tor)
    occ = sd < 0.0055
    cuts = [cut_plane((0, 0.745 * S, 0), (0, -1, 0))]
    if G == "f":
        gap = lambda P: np.where((P[:, 1] > WAIST_Y - 0.005) & (P[:, 1] < 1.125 * S), 1.0, -1.0)  # noqa: E731
        top = lambda P: P[:, 1] - 1.29 * S  # noqa: E731
        cuts += [gap, top]
    else:
        cuts += [lambda P: P[:, 1] - (WAIST_Y + 0.005)]
    occ &= ~(sdf(region(("hand", "lowerarm", "upperarm"))) < 0.006)
    occ &= ~((sdf(region(("neck", "head"))) < 0.006) & (Y > NECK_Y - 0.03))
    occ = apply_cuts(occ, cuts)
    f = ndimage.gaussian_filter(occ.astype(np.float32), 0.004 / STEP)
    v, fc, _, _ = marching_cubes(f, 0.5, spacing=(STEP,) * 3)
    v += LO + STEP / 2
    m = trimesh.Trimesh(v, fc[:, ::-1], process=True)
    cen = m.triangles_center
    kill = np.zeros(len(m.faces), bool)
    for c in cuts:
        kill |= c(cen) > -0.003
    m.update_faces(~kill)
    m.remove_unreferenced_vertices()
    vv, ff = fast_simplification.simplify(m.vertices, m.faces, max(0.0, 1 - 6000 / len(m.faces)))
    m = trimesh.Trimesh(vv, ff)
    trimesh.smoothing.filter_taubin(m, iterations=8)
    add("base_layer", m, "trim")


TOP_OCC = None
want = lambda n: not ONLY or n in ONLY  # noqa: E731
top_occ = build_top("anorak") if want("top_anorak") or want("coat_halat") else None
if want("top_tshirt"):
    build_top("tshirt")
pants_occ = build_pants() if want("bottom_joggers") or want("coat_halat") else None
if want("coat_halat"):
    build_coat(top_occ, pants_occ)
if want("head_cap"):
    build_cap("cap")
if want("head_dokerka"):
    build_cap("dokerka")
if want("feet_sabo"):
    build_sabo()
if want("acc_lanyard"):
    build_lanyard()
if want("acc_shopper"):
    build_shopper()
if want("base_layer"):
    build_base()

out = {}
for name, lst in OUTPARTS.items():
    for i, (m, mat, shade) in enumerate(lst):
        V = np.asarray(m.vertices, np.float32)
        # UV: цилиндрическая развёртка в метрах (текстура ткани тайлится по 4 см)
        th = np.arctan2(V[:, 0], V[:, 2] - 0.02)
        Fc = np.asarray(m.faces, np.int32).copy()
        # шов развёртки сзади: треугольники через шов получают копии вершин со сдвигом на период
        tf = th[Fc]
        bad = (tf.max(1) - tf.min(1)) > np.pi
        if bad.any():
            idx = np.unique(Fc[bad][th[Fc[bad]] < 0])
            remap = {int(k): len(V) + j for j, k in enumerate(idx)}
            V = np.vstack([V, V[idx]])
            shade = np.concatenate([shade, shade[idx]])
            th = np.concatenate([th, th[idx] + 2 * np.pi])
            for f in np.where(bad)[0]:
                Fc[f] = [remap.get(int(k), k) if th[k] < 0 else k for k in Fc[f]]
        uv = np.stack([th * 0.16, V[:, 1]], 1) / 0.04
        out[f"{name}|{i}|{mat}|V"] = V
        out[f"{name}|{i}|{mat}|F"] = Fc
        out[f"{name}|{i}|{mat}|UV"] = uv.astype(np.float32)
        out[f"{name}|{i}|{mat}|SH"] = shade.astype(np.float32)
dst = WORK / (f"parts_{G}.npz" if not ONLY else f"parts_{G}_{'_'.join(sorted(ONLY))}.npz")
np.savez_compressed(dst, **out)
print("saved", dst, len(out) // 3, "parts")
