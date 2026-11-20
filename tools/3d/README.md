# Генератор 3D-заготовок

`gen_sdf.py` строит манекены Ж/М и одежду по ТЗ (метры, Y вверх, лицом к +Z, стопы на Y=0, материалы `fabric`/`mannequin`), сохраняет GLB и `manifest.json` в `public/3d/models`.

```bash
python3 -m venv .venv && .venv/bin/pip install scikit-image trimesh fast-simplification numpy
.venv/bin/python tools/3d/gen_sdf.py public/3d/models            # все 16 файлов (около минуты)
.venv/bin/python tools/3d/gen_sdf.py public/3d/models coat_halat # одна вещь
```

Это заготовки для разработки; финальные модели художника заменяют файлы под теми же именами.
