#!/usr/bin/env bash
# Запускается на сервере из каталога проекта (по умолчанию /opt/medform).
set -euo pipefail
cd "${APP_DIR:-/opt/medform}"
git fetch --prune origin
git checkout -B "${BRANCH:-main}" "origin/${BRANCH:-main}"
export APP_VERSION="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker image prune -f >/dev/null
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT:-3010}/api/health" >/dev/null; then echo "healthy: $APP_VERSION"; exit 0; fi
  sleep 2
done
echo "health check failed" >&2; docker compose logs --tail=100 app; exit 1
