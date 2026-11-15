# Деплой стейджа на med.neeklo.ru

Факт на 15.11.2026: DNS `med.neeklo.ru → 31.192.111.33` уже есть. На сервере работает nginx, для `med.neeklo.ru` нет сертификата (TLS: `unrecognized name`), сайт не открывается.

## Автоматически (рекомендуется)
1. GitHub → репозиторий → Settings → Secrets and variables → Actions → New repository secret:
   `STAGING_SSH_HOST=31.192.111.33`, `STAGING_SSH_USER=<пользователь с sudo или root>`, `STAGING_SSH_KEY=<приватный ключ>`, при нестандартном порте `STAGING_SSH_PORT`.
2. Actions → "Deploy staging" → Re-run (или любой пуш в `main` / рабочую ветку).
Workflow собирает образ на GitHub, копирует его на сервер в `/opt/medform` и запускает `deploy/bootstrap.sh`: ставит Docker при отсутствии, поднимает приложение на 127.0.0.1:3010, создаёт nginx-конфиг, выпускает сертификат Let's Encrypt, проверяет `https://med.neeklo.ru/api/health`. При ошибке `nginx -t` конфиг откатывается.

## Вручную (один раз, на сервере)
```bash
# 1. Docker и код
sudo mkdir -p /opt/medform && sudo chown $USER /opt/medform
git clone https://github.com/neeklo1606/med2d.git /opt/medform
cd /opt/medform && cp .env.example .env   # проверить APP_URL, INDEXING_ENABLED=false

# 2. Приложение (слушает 127.0.0.1:3010)
BRANCH=main bash deploy/deploy.sh          # или BRANCH=claude/festive-clarke-rnf8vy до мерджа

# 3. Сертификат и nginx
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d med.neeklo.ru   # или --nginx
sudo cp deploy/nginx-med.neeklo.ru.conf /etc/nginx/sites-available/med.neeklo.ru
sudo ln -sf /etc/nginx/sites-available/med.neeklo.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. Смоук
curl -fsS https://med.neeklo.ru/api/health
curl -sI https://med.neeklo.ru | grep -i x-robots-tag
```
Если certbot по webroot не проходит из-за блока 443 без сертификата: сначала включить только `server { listen 80 }` из конфига, выпустить сертификат, затем весь файл.

## Обновления
- Вручную: `cd /opt/medform && bash deploy/deploy.sh`.
- Автоматически: добавить в GitHub (Settings → Secrets → Actions) `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`. Workflow `deploy-staging.yml` выкладывает `main` при пуше и по кнопке (Run workflow, можно указать ветку).

## Переезд на домен заказчика
1. DNS домена заказчика на тот же сервер, сертификат, копия nginx-конфига с новым `server_name`.
2. `.env`: `APP_URL=https://<домен>`, `INDEXING_ENABLED=true` (после заполнения реквизитов), убрать `X-Robots-Tag` из nginx для нового домена.
3. В конфиге med.neeklo.ru: `return 301 https://<домен>$request_uri;`.
Код не меняется. Подробно на этапе 10 в `docs/domain-migration.md`.
