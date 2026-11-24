#!/usr/bin/env bash
# Стилизация готовых моделей сайта под витринный манекен (см. stylize.py) и обратное сжатие.
#   BLENDER=/path/to/blender GT=~/.npm/_npx/<hash> tools/3d/stylize.sh <work_dir>
# GT — папка npx-кеша с @gltf-transform/core, extensions и meshoptimizer
# (появляется после `npx -y @gltf-transform/cli@4.5.1 --help`).
# Повторный запуск на уже стилизованных файлах не нужен: исходники берутся из git (коммит до стилизации).
set -euo pipefail
WORK=${1:?work dir}
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
DST=$REPO/public/3d/models
mkdir -p "$WORK/dec" "$WORK/out"
node "$HERE/decode.mjs" "$DST" "$WORK/dec"
for f in "$WORK"/dec/*.glb; do
  n=$(basename "$f" .glb)
  case "$n" in
    mannequin_*) mode=mannequin ;;
    acc_*) mode=0 ;;          # шнурок и шопер: тонкие детали, без сглаживания
    feet_*) mode=0.5 ;;       # сабо: сохранить перфорацию
    *) mode=1 ;;
  esac
  "$BLENDER" -b --factory-startup --python "$HERE/stylize.py" -- "$f" "$WORK/out/$n.glb" "$mode" | grep -E "STYLIZED|Error" || true
done
cp "$WORK"/out/*.glb "$DST"/
node "$HERE/optimize.mjs" "$DST"
python3 "$HERE/manifest.py" "$DST"
