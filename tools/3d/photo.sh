#!/usr/bin/env bash
# Ткань с реального фото модели на 3D-верх и 3D-брюки (Ж и М), затем сжатие и manifest.
#   BLENDER=/path/to/blender GT=~/.npm/_npx/<hash> tools/3d/photo.sh <work_dir>
# Запускать после stylize.sh на файлах сайта, у которых ещё нет фото-ткани (повтор берёт исходники из git).
set -euo pipefail
WORK=${1:?work dir}
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
DST=$REPO/public/3d/models
PHOTO=$REPO/public/photo-model/f
mkdir -p "$WORK/dec" "$WORK/out"
node "$HERE/decode.mjs" "$DST" "$WORK/dec"
for pair in "top_anorak top" "bottom_joggers bottom"; do
  set -- $pair
  python3 -I "$HERE/photo_atlas.py" "$PHOTO" "$2" "$WORK/photo_$2.png" "$WORK/$2.json" 1024
  for g in f m; do
    "$BLENDER" -b --factory-startup --python "$HERE/photo_texture.py" -- \
      "$WORK/dec/$1_$g.glb" "$WORK/out/$1_$g.glb" "$WORK/photo_$2.png" "$WORK/$2.json" | grep -E "PHOTO_TEXTURED|Error" || true
  done
done
cp "$WORK"/out/*.glb "$DST"/
node "$HERE/optimize.mjs" "$DST"
python3 "$HERE/manifest.py" "$DST"
