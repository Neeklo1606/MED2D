# MEDFORM: интернет-магазин медицинской одежды

Стейдж: https://med.neeklo.ru (закрыт от индексации). Исполнитель: neeklo.studio.

## Быстрый старт
```bash
pnpm install
cp .env.example .env
# локальная БД (или docker compose up postgres)
export DATABASE_URL=postgres://medform:medform@localhost:5432/medform
pnpm dev            # http://localhost:3000, миграции и сиды применятся при старте
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Как в docker
```bash
cp .env.example .env   # задать POSTGRES_PASSWORD
docker compose up -d --build
curl localhost:3010/api/health   # {"status":"ok","database":"ok"}
```

## Структура
- `src/app` страницы (App Router), `src/app/api/health` health-check
- `src/configurator/` 3D-конфигуратор, `src/shop/` корзина и оформление, `src/server/` БД, заявки, провайдеры
- `src/features/app-feel/` отклик, переходы, PWA (см. `docs/adr/0001-app-feel-pwa.md`)
- `src/content/registry.ts` реестр редактируемых полей (`getField`)
- `src/styles/tokens.css` дизайн-токены
- `docs/` план, спецификация конфигуратора, токены, блокеры, аудит, деплой
- `deploy/` nginx/Caddy конфиги, скрипт выкладки
- `artifacts/<этап>/` скриншоты 375/1440

## Документы
[ТЗ заказчика](docs/tz.md) · [ТЗ разработчика](docs/dev-spec.md) · [Отчёт этапа 1](docs/report-2026-11-20.md) · [План](docs/plan.md) · [Конфигуратор](docs/configurator-spec.md) · [Токены](docs/design-tokens.md) · [Блокеры](docs/blockers.md) · [Аудит](docs/audit.md) · [Деплой этапа 1](docs/deploy-stage1.md) · [Передача Сергею](docs/handoff-sergey.md)
