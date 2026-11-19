# Выкладка первого этапа на med.neeklo.ru: пошагово

Дата проверки: 19.11.2026. Что выкладываем: 3D-конфигуратор, корзина, оформление заявки, PostgreSQL (коммит в ветке `claude/festive-clarke-rnf8vy`).

## Что проверено (GitHub Actions, workflow `Check staging server`)

| Проверка | Результат |
|---|---|
| DNS `med.neeklo.ru` | A-запись `31.192.111.33` есть |
| Порт 22 (SSH) | открыт, `OpenSSH_9.6p1 Ubuntu-3ubuntu13.20` (Ubuntu 24.04), ключи хоста rsa/ecdsa/ed25519 |
| Порты 80 и 443 | открыты, отвечает nginx |
| `http://med.neeklo.ru` | пустой ответ: для поддомена нет сайта в nginx, срабатывает сервер по умолчанию |
| `https://med.neeklo.ru` | сертификата для поддомена нет |

Вывод: сервер готов к выкладке, не хватает только SSH-ключа в секретах GitHub. Сайт для поддомена и сертификат создаст скрипт `deploy/bootstrap.sh`.

Повторить проверку: GitHub → Actions → «Check staging server» → Run workflow.

## Шаг 1. Ключ для деплоя (Никита, 5 минут)

На своём Mac:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/medform_deploy -N "" -C "medform-deploy"
ssh-copy-id -i ~/.ssh/medform_deploy.pub root@31.192.111.33     # или свой пользователь с sudo
ssh -i ~/.ssh/medform_deploy root@31.192.111.33 'echo ok'      # должно вывести ok
```

## Шаг 2. Разведка сервера (Никита, 2 минуты, ничего не меняет)

```bash
ssh -i ~/.ssh/medform_deploy root@31.192.111.33 '
  command -v nginx && nginx -v; systemctl is-active nginx;
  ls /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null;
  command -v docker && docker --version; docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null;
  ss -ltnp | grep -E ":(80|443|3010) ";
  df -h / | tail -1; free -h | head -2'
```
Что должно быть:
- nginx установлен на самом сервере (не в Docker) и активен. Если nginx в Docker, остановиться и прислать вывод: скрипт в этом случае сам остановится на предпроверке.
- Порт 3010 свободен. Если занят, в шаге 3 задать секрет `APP_PORT` (и поправить порт в `deploy/nginx-med.neeklo.ru.conf`).
- Свободно на диске не меньше 3 ГБ, памяти не меньше 1 ГБ.

## Шаг 3. Секреты в GitHub (Никита, 2 минуты)

https://github.com/Neeklo1606/MED2D/settings/secrets/actions → New repository secret:

| Секрет | Значение |
|---|---|
| `STAGING_SSH_HOST` | `31.192.111.33` |
| `STAGING_SSH_USER` | `root` (или пользователь с sudo без пароля) |
| `STAGING_SSH_KEY` | содержимое `~/.ssh/medform_deploy` целиком, с `-----BEGIN` и `-----END` |
| `STAGING_SSH_PORT` | только если SSH не на 22 |

## Шаг 4. Запуск деплоя (агент или Никита)

GitHub → Actions → «Deploy staging (med.neeklo.ru)» → Run workflow (ветка `claude/festive-clarke-rnf8vy`), или любой пуш в эту ветку.

Что делает workflow (10-15 минут на первый раз):
1. Собирает Docker-образ сайта на GitHub, скачивает `postgres:16-alpine`, упаковывает оба в `medform-app.tar.gz`: серверу не нужен доступ к Docker Hub и npm.
2. Копирует архив, `docker-compose.yml`, `.env.example` и `deploy/` в `/opt/medform`.
3. Запускает `deploy/bootstrap.sh`:
   - предпроверка: nginx на хосте, порт 3010 свободен, место на диске;
   - ставит Docker, если его нет;
   - создаёт `/opt/medform/.env` со случайным паролем базы (только при первом запуске, дальше не трогает);
   - загружает образы, поднимает `postgres` и `app`, ждёт `/api/health`;
   - добавляет сайт `med.neeklo.ru` в nginx (при ошибке `nginx -t` откатывает), выпускает сертификат Let's Encrypt через certbot;
   - проверяет `https://med.neeklo.ru/api/health`.
4. Смоук снаружи: health и заголовок `X-Robots-Tag: noindex`.

## Шаг 5. Приёмка (Никита, 10 минут)

- [ ] https://med.neeklo.ru открывается с замком, плашка «Тестовая версия сайта» видна
- [ ] https://med.neeklo.ru/api/health отвечает `{"status":"ok","database":"ok"}`
- [ ] `curl -sI https://med.neeklo.ru | grep -i x-robots` показывает `noindex, nofollow`
- [ ] С телефона: `/catalog` → надеть вещи, сменить цвет, повернуть модель → «Добавить образ» → корзина → оформление → заявка с номером MF-00001
- [ ] Сайт ставится на экран телефона («На экран Домой» в Safari, «Установить» в Chrome)
- [ ] Остальные сайты на этом nginx работают как раньше

## Если что-то пошло не так

| Симптом | Что делать |
|---|---|
| Workflow пишет `secrets are not set, deploy skipped` | не добавлены секреты (шаг 3) |
| `Permission denied (publickey)` | ключ не в `authorized_keys` или в секрет вставлен `.pub` вместо приватного |
| Предпроверка: `nginx не установлен на хосте` | nginx в Docker: прислать вывод шага 2, настроим прокси иначе |
| `nginx -t failed, rolling back` | конфиг откатан, сайты не пострадали; прислать лог workflow |
| certbot не выпустил сертификат | проверить, что `http://med.neeklo.ru/.well-known/acme-challenge/` доходит до этого сервера (нет ли CDN/прокси перед ним) |
| `App health check failed` | на сервере: `cd /opt/medform && docker compose logs --tail=200 app postgres` |

Откат: `cd /opt/medform && docker compose down` (данные базы в volume `pgdata` сохраняются), сайт в nginx: `rm /etc/nginx/sites-enabled/med.neeklo.ru && nginx -s reload`.

## После выкладки
- Обновления: каждый пуш в ветку выкладывается сам.
- Telegram-бот (шаг 8 плана): в `/opt/medform/.env` добавить `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET`, chat id задаётся в админке.
- Бэкапы БД и мониторинг: этап 10 плана.
