# Передача проекта MEDFORM: Сергею

Дата: 19.11.2026. От: Никита (neeklo.studio).

## Что передаём

| Что | Где |
|---|---|
| Репозиторий | https://github.com/Neeklo1606/MED2D, рабочая ветка `claude/festive-clarke-rnf8vy` (доступ для GitHub `Osmanovvv` выдаёт Никита) |
| ТЗ для разработчика | `docs/dev-spec.md` |
| Стейдж | https://med.neeklo.ru |
| ТЗ для программиста | `docs/tz.md` |
| Макет | Figma, страница «Конфигуратор итог»: https://www.figma.com/design/9fKr0pDLkGKPchDhW34P8a/Medform?node-id=42-2 (доступ выдаёт Никита) |
| 3D-заготовки | `public/3d/models/*.glb` (16 файлов: манекены Ж/М + 7 вещей на каждый), `manifest.json` с габаритами и треугольниками |
| Спецификация для 3D-художника | `docs/tz.md`, раздел «Спецификация для 3D-художника» |
| Что уже сделано | `CHANGELOG.md`, статусы критериев: `docs/audit.md`, план: `docs/plan.md` |
| Открытые вопросы | `docs/blockers.md` |
| Деплой | `docs/deploy-stage1.md` |

## Как запустить
```bash
git clone -b claude/festive-clarke-rnf8vy https://github.com/Neeklo1606/MED2D.git medform && cd medform
pnpm install && cp .env.example .env
docker compose up -d postgres            # или свой PostgreSQL 16
export DATABASE_URL=postgres://medform:change-me@localhost:5432/medform
pnpm dev                                  # http://localhost:3000/catalog
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Для `pnpm dev` с compose-базой пробросьте порт postgres (`ports: ["127.0.0.1:5432:5432"]`) или запустите свой PostgreSQL.

## Что уже работает
- `/catalog`: 3D-конфигуратор (react-three-fiber) на заготовках: слоты, перекраска материала `fabric`, Ж/М, вращение, зум, ссылка на образ, 2D-режим, мобильная раскладка.
- `/cart`, `/checkout`, `/order/[token]`: корзина с пересчётом на сервере, оформление заявки, страница заявки по секретному токену.
- БД PostgreSQL + Drizzle, миграции и сиды при старте, очередь уведомлений, провайдеры оплаты/доставки `none`/`mock`.

## Правила
- Тексты интерфейса только через реестр `src/content/registry.ts` (`getField`), тест проверяет, что все ключи существуют.
- Деньги в копейках, цены на клиенте не используются для расчёта заказа.
- Финальные GLB заменяют заготовки под теми же именами; основной материал `fabric` (белый), фурнитура `trim`.
- Новые зависимости согласовывать.

## Вопрос Сергею
Когда сможешь показать первую версию 3D (финальные или промежуточные модели на сайте, хотя бы анорак + джоггеры на Ж-манекене)? Назови дату и что войдёт в показ.
