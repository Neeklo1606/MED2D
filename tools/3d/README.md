# 3D-модели MEDFORM: реалистичные люди и одежда по фото изделий

Пайплайн собирает 18 GLB в `public/3d/models` (Ж/М × манекен + 8 вещей) и фото товаров в `public/products`.

| Шаг | Скрипт | Что делает |
|---|---|---|
| 1 | `mh_body.py` (Blender 4.2 + MPFB2) | Человек из базовой сетки MakeHuman (CC0): фигура, кожа, глаза, брови, ресницы, волосы; риг, руки вдоль тела; рост по ТЗ (Ж 1,68 м, М 1,80 м); `body_<g>.npz` с зонами тела для одежды |
| 2 | `garments.py` (Python) | Одежда объёмом на воксельной сетке по реальной фигуре: свобода кроя, драпировка под весом ткани, проймы и вырезы, резинки со сборкой, накладные карманы, клапаны, отвороты, лацканы, пуговицы, строчки |
| 3 | `assemble.py` (Blender) | Материалы `fabric` (белый × AO складок в цвете вершин × карта нормалей саржи) и `trim`; AO запекается Cycles вместе с телом; базовое бельё в манекене |
| 4 | `glb_fix.py` | Режимы прозрачности кожи/волос для three.js, текстуры в JPEG/PNG до бюджета |
| 5 | `manifest.py` | `manifest.json`: треугольники, размер, габариты |
| 6 | `thumbs.mjs` + `thumbs_pack.py` | Фото товаров без тела (тень + маска ткани), сайт перекрашивает их CSS |

Вещи по фото изделий: верх (оверсайз, V-вырез, спущенное плечо, рукав с отворотом, нагрудный карман с ручкой,
карман-кенгуру, резинка по низу), брюки (широкие прямые, карго с клапанами, косые карманы, пояс на резинке),
футболка, халат (до колена, лацканы, пуговицы, три накладных кармана), шапочка с завязками, докерка с отворотом,
сабо (перфорация, ремешок), шнурок с карабином и бейджем, шопер.

## Сборка

```bash
# Blender 4.2 LTS + MPFB2 (github.com/makehumancommunity/mpfb2, src/mpfb → ~/.config/blender/4.2/extensions/user_default/mpfb)
# ассеты MakeHuman CC0: http://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
#   распаковать в ~/.config/blender/4.2/extensions/.user/user_default/mpfb/data/
python3 -m venv .venv && .venv/bin/pip install numpy scipy scikit-image trimesh fast-simplification pillow
BLENDER=/path/to/blender PY=.venv/bin/python tools/3d/build.sh /tmp/medform-3d f m      # около 6 минут
```

Просмотр как на сайте (three.js, тот же свет):

```bash
python3 tools/3d/serve.py public/3d/models &
node tools/3d/shot.mjs "g=f&items=top_anorak:E5B2BB,bottom_joggers:E5B2BB&az=0,60,180" out.png
```

Фото товаров:

```bash
python3 tools/3d/serve.py public/3d/models &
node tools/3d/thumbs.mjs /tmp/thumbs && .venv/bin/python tools/3d/thumbs_pack.py /tmp/thumbs public/products
```

Лицензии: базовая сетка, кожа, волосы, глаза MakeHuman (CC0); код MPFB2 (GPL) используется только как инструмент
сборки и в сайт не попадает. Финальные модели художника по-прежнему заменяют файлы под теми же именами.
