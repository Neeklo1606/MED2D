#!/usr/bin/env bash
# Выполняется НА СЕРВЕРЕ. Запуск с компьютера, где есть SSH-доступ:
#   ssh root@31.192.111.33 'bash -s' < deploy/remote-install.sh
# или без клона репозитория:
#   curl -fsSL https://raw.githubusercontent.com/Neeklo1606/MED2D/claude/festive-clarke-rnf8vy/deploy/remote-install.sh | ssh root@31.192.111.33 'bash -s'
set -euo pipefail
BRANCH="${BRANCH:-claude/festive-clarke-rnf8vy}"
DIR=/opt/medform
command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  mkdir -p "$DIR" && git clone -b "$BRANCH" https://github.com/Neeklo1606/MED2D.git "$DIR"
fi
rm -f "$DIR/medform-app.tar.gz"   # собрать из исходников этой версии
APP_VERSION="$(git -C "$DIR" rev-parse --short HEAD)" bash "$DIR/deploy/bootstrap.sh"
