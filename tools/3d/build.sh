#!/usr/bin/env bash
# Полная сборка реалистичных 3D-моделей MEDFORM.
#   BLENDER=/path/to/blender PY=/path/to/venv/python tools/3d/build.sh <work_dir> [f m]
# Требования: Blender 4.2 + аддон MPFB2 с ассетами MakeHuman (CC0), Python с numpy scipy scikit-image
# trimesh fast-simplification pillow. Результат копируется в public/3d/models.
set -euo pipefail
WORK=${1:?work dir}; shift
GENDERS=${*:-f m}
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
DST=$REPO/public/3d/models
mkdir -p "$WORK/glb"
for g in $GENDERS; do
  "$BLENDER" -b --factory-startup --python "$HERE/mh_body.py" -- "$g" "$WORK" | grep -E "DONE|Error" || true
  "$PY" "$HERE/garments.py" "$WORK" "$g"
  "$BLENDER" -b --factory-startup --python "$HERE/assemble.py" -- "$WORK" "$g" "$WORK/glb" | grep -E "EXPORTED|Error" || true
  "$PY" "$HERE/glb_fix.py" "$WORK/glb/mannequin_$g.glb" "$WORK/glb/mannequin_$g.glb"
done
cp "$WORK"/glb/*.glb "$DST"/
"$PY" "$HERE/manifest.py" "$DST"
