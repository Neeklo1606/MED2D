#!/usr/bin/env bash
# Полная идемпотентная выкладка стейджа на сервер. Запускается из каталога
# проекта (/opt/medform), куда CI уже положил medform-app.tar.gz и конфиги.
# Делает: Docker (если нет) → загрузка образа → запуск → nginx → SSL → смоук.
set -euo pipefail

DOMAIN="${DOMAIN:-med.neeklo.ru}"
APP_PORT="${APP_PORT:-3010}"
CERT_EMAIL="${CERT_EMAIL:-}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
cd "$(dirname "$0")/.."

log() { echo "==> $*"; }

# 0. Предпроверка: ничего не трогаем, если сервер устроен не так, как ожидаем
log "Preflight"
if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx не установлен на хосте. Порты 80/443 занимает:" >&2
  ($SUDO ss -ltnp 2>/dev/null || true) | grep -E ':(80|443) ' >&2 || true
  echo "Остановлено: нужен ручной разбор (возможно, nginx в Docker). См. docs/deploy-stage1.md, шаг 2." >&2
  exit 2
fi
if ($SUDO ss -ltnp 2>/dev/null || true) | grep -q ":${APP_PORT} " && ! $SUDO docker ps --format '{{.Names}}' 2>/dev/null | grep -q medform; then
  echo "Порт ${APP_PORT} уже занят другим процессом. Задайте APP_PORT=другой_порт." >&2
  exit 2
fi
df -h / | tail -1 | awk '{print "disk free: "$4}'

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker.io docker-compose-v2 || $SUDO apt-get install -y docker.io docker-compose-plugin
  $SUDO systemctl enable --now docker
fi
if $SUDO docker compose version >/dev/null 2>&1; then COMPOSE="$SUDO docker compose"; else COMPOSE="$SUDO docker-compose"; fi

# 2. Образ и запуск
if [ ! -f .env ]; then
  log "Creating .env from .env.example with a random database password"
  cp .env.example .env
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
  chmod 600 .env
fi
if [ -f medform-app.tar.gz ]; then
  log "Loading prebuilt image"
  $SUDO docker load -i medform-app.tar.gz
else
  log "No prebuilt image, building on the server"
  $COMPOSE build
fi
export APP_VERSION="${APP_VERSION:-manual}" APP_PORT
$COMPOSE up -d --no-build --remove-orphans
for i in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1 && { log "App healthy"; break; }
  [ "$i" = 30 ] && { $COMPOSE logs --tail=100 app; echo "App health check failed" >&2; exit 1; }
  sleep 2
done
$SUDO docker image prune -f >/dev/null || true

# 3. nginx + SSL
if [ -d /etc/nginx/sites-available ]; then
  CONF=/etc/nginx/sites-available/$DOMAIN; LINK=/etc/nginx/sites-enabled/$DOMAIN
else
  CONF=/etc/nginx/conf.d/$DOMAIN.conf; LINK=""
fi
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem

apply_conf() {  # $1 = файл конфига; при ошибке откат
  local backup=""; [ -f "$CONF" ] && { backup=$(mktemp); $SUDO cp "$CONF" "$backup"; }
  $SUDO cp "$1" "$CONF"
  [ -n "$LINK" ] && $SUDO ln -sf "$CONF" "$LINK"
  if $SUDO nginx -t; then $SUDO systemctl reload nginx || $SUDO nginx -s reload
  else
    echo "nginx -t failed, rolling back" >&2
    if [ -n "$backup" ]; then $SUDO cp "$backup" "$CONF"; else $SUDO rm -f "$CONF" ${LINK:+"$LINK"}; fi
    exit 1
  fi
}

if ! $SUDO test -f "$CERT"; then
  log "Issuing certificate for $DOMAIN"
  $SUDO mkdir -p /var/www/certbot
  sed -n '1,/^}/p' deploy/nginx-med.neeklo.ru.conf | sed "s/med.neeklo.ru/$DOMAIN/g" > /tmp/medform-http.conf
  apply_conf /tmp/medform-http.conf
  command -v certbot >/dev/null 2>&1 || $SUDO apt-get install -y certbot
  if [ -n "$CERT_EMAIL" ]; then EMAIL_ARG=(-m "$CERT_EMAIL"); else EMAIL_ARG=(--register-unsafely-without-email); fi
  $SUDO certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos "${EMAIL_ARG[@]}"
fi

log "Applying full nginx config"
sed "s/med.neeklo.ru/$DOMAIN/g; s/127.0.0.1:3010/127.0.0.1:$APP_PORT/g" deploy/nginx-med.neeklo.ru.conf > /tmp/medform-full.conf
apply_conf /tmp/medform-full.conf

# 4. Смоук
sleep 1
curl -fsS "https://$DOMAIN/api/health" && echo && log "Deployed: https://$DOMAIN"
