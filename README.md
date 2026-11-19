# MEDFORM: интернет-магазин медицинской одежды

Стейдж: https://med.neeklo.ru (закрыт от индексации). Исполнитель: neeklo.studio.

## Быстрый старт
```bash
pnpm install
cp .env.example .env
pnpm dev            # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Структура
- `src/app` страницы (App Router), `src/app/api/health` health-check
- `src/content/registry.ts` реестр редактируемых полей (`getField`)
- `src/styles/tokens.css` дизайн-токены
- `docs/` план, спецификация конфигуратора, токены, блокеры, аудит, деплой
- `deploy/` nginx/Caddy конфиги, скрипт выкладки
- `artifacts/<этап>/` скриншоты 375/1440

## Документы
[ТЗ](docs/tz.md) · [План](docs/plan.md) · [Конфигуратор](docs/configurator-spec.md) · [Токены](docs/design-tokens.md) · [Блокеры](docs/blockers.md) · [Аудит](docs/audit.md) · [Деплой](docs/deploy.md)
