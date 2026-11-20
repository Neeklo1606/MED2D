# MEDFORM: ТЗ для разработчика (состояние после этапа 1)

Дата: 20.11.2026. Исходное ТЗ заказчика: `docs/tz.md`. Здесь: как устроен код сейчас и что делать на этапах 2-5.

Стейдж: https://med.neeklo.ru. Рабочая ветка: `claude/festive-clarke-rnf8vy` (пуш в неё = деплой на стейдж). Свою работу ведите в ветках `feat/*` и присылайте pull request в рабочую ветку.

## 1. Архитектура

| Слой | Решение | Где |
|---|---|---|
| Фреймворк | Next.js 16 (App Router), TypeScript strict, Node 22, pnpm 10 | `src/app` |
| Стили | Tailwind 4 + CSS-переменные токенов, шрифты self-hosted | `src/styles/tokens.css`, `public/fonts` |
| 3D | three 0.170, @react-three/fiber 9, @react-three/drei 10, GLB без Draco | `src/configurator/renderers/ThreeRenderer.tsx` |
| Состояние | Zustand: образ (`useLook`), корзина с persist (`useCart`), тосты | `src/configurator/store.ts` |
| Валидация | Zod, общие схемы клиента и сервера | `src/lib/checkout.ts` |
| БД | PostgreSQL 16 + Drizzle; миграции и сиды при старте сервера (`src/instrumentation.ts`) | `src/server/db`, `drizzle/` |
| Провайдеры | `PaymentProvider`, `DeliveryProvider`: `none`, `mock` (env `PAYMENTS_PROVIDER`, `DELIVERY_PROVIDER`) | `src/server/providers` |
| Контент | реестр полей, `getField(id)`; сейчас значения по умолчанию, с этапа 2 из таблицы `content_field` | `src/content/registry.ts` |
| App-feel / PWA | pressed-состояния, вход страниц, полоса загрузки, manifest, service worker (`NEXT_PUBLIC_SW=off` выключает) | `src/features/app-feel`, `public/sw.js`, ADR `docs/adr/0001-app-feel-pwa.md` |
| Инфраструктура | Docker Compose (`app` + `postgres`), nginx на хосте, Let's Encrypt, GitHub Actions | `Dockerfile`, `docker-compose.yml`, `deploy/`, `.github/workflows` |

### Маршруты
| Маршрут | Назначение |
|---|---|
| `/` | главная (черновик, вёрстка на этапе 4) |
| `/catalog` | 3D-конфигуратор + сетка товаров с фильтрами |
| `/product/[slug]` | карточка товара с 3D-превью |
| `/cart`, `/checkout`, `/order/[token]` | корзина, оформление, страница заявки по секретному токену |
| `/legal/[doc]` | заглушки: offer, privacy, consent, cookies, requisites |
| `/offline` | офлайн-страница PWA |
| `POST /api/cart/quote` | пересчёт корзины и варианты доставки |
| `POST /api/orders` | создание заявки (Zod, honeypot, лимит 5 за 10 минут с IP) |
| `GET /api/health` | состояние приложения и БД |

### Конфигуратор
- Модели: `public/3d/models/{model}_{f|m}.glb`, материал ткани `fabric` перекрашивается `material.color`, фурнитура `trim` не трогается.
- Слоты: `feet, bottom, top, coat, head, accessory`; одна вещь на слот, халат (`coat`) поверх `top`. Логика в `src/configurator/look.ts` (чистые функции, покрыты тестами).
- Образ в URL: `?g=f&top=anorak.pink.M&bottom=joggers.pink.M`, неверные части отбрасываются.
- `LookRenderer`: `three` и `photo` (2D-фолбэк), методы `zoomIn/zoomOut/reset/focus(slot)/rotate(deg)`.
- Выбор цвета у вещи с моделью надевает её и наводит камеру на зону (`useLook.focusOn`).

### Модель данных (`src/server/db/schema.ts`)
`color`, `size_chart`, `product`, `variant` (цена в копейках, остаток, вес, габариты, маркировка), `media`, `order` (номер, токен, статус, канал, клиент, суммы, время согласий, версия оферты, поля оплаты и отправки), `order_item` (снимки цены/названия/цвета/размера, коды маркировки), `order_event`, `lead`, `content_field`, `content_revision`, `setting`, `notification_outbox`, `admin_user`, `audit_log`.

Статусы заявки: `new → in_progress → contacted → confirmed → shipped → completed`, `cancelled`; для оплаты `awaiting_payment`, `paid`, `refunded`.

## 2. Этап 2: админка

**Цель:** менеджер без разработчика меняет тексты, цены, цвета и обрабатывает заявки с телефона.

Задачи:
1. Вход `/admin/login`: email + пароль (argon2), одноразовый код на email или в Telegram, ограничение попыток, сессия в httpOnly cookie, `noindex`. Первый владелец из `ADMIN_BOOTSTRAP_EMAIL`.
2. Роли `owner` (всё) и `manager` (заявки, каталог без удаления, контент). Каждое изменение пишется в `audit_log`.
3. Заявки: список (фильтры по статусу и дате, поиск по номеру/имени/телефону), карточка (состав, клиент, история `order_event`, заметка), смена статуса, `tel:` и «Написать», экспорт CSV. Удалить тестовые заявки MF-00001…MF-00004.
4. Каталог: товары (поля `product`, публикация), варианты таблицей с редактированием в ячейках, цвета (`color.hex`), загрузка фото (sharp → WebP/AVIF) и GLB (проверка: материал `fabric`, размер файла), размерные сетки, сертификаты, импорт/экспорт CSV.
5. Перевести конфигуратор, сетку и карточку с `src/catalog/data.ts` на данные из БД (серверная загрузка + `revalidateTag`). `data.ts` остаётся только источником сидов.
6. Контент: формы из реестра `registry.ts` (страница → секция → поле), счётчик символов, история в `content_revision`, «Вернуть по умолчанию». `getField` читает `content_field` с кешем и revalidate ≤ 60 с.
7. Настройки (`setting`): реквизиты продавца, контакты, условия доставки и возврата, Telegram chat id + «Отправить тестовое сообщение», флаги `payments.enabled`, `delivery.cdekEnabled`, `telegram.sendContacts`, индексация.

Приёмка: заголовок главной и цена товара, изменённые в админке, видны на сайте за минуту; заявка обрабатывается с телефона 375 px; e2e на вход, смену статуса и правку цены.

## 3. Этап 3: Telegram и письма

1. Воркер очереди `notification_outbox` (интервал 10 с, экспоненциальные повторы до 10 попыток, `last_error`), запускается в процессе приложения или отдельным контейнером.
2. Сообщение о заявке: номер, сумма, состав (товар, цвет, размер, кол-во), имя, город, комментарий, ссылка в админку. Телефон и email только при `telegram.sendContacts = true`.
3. Inline-кнопки «Взять в работу», «Связались», «Отменить»: `POST /api/telegram/webhook` с проверкой `X-Telegram-Bot-Api-Secret-Token`, смена статуса + `order_event`, бот редактирует сообщение и пишет имя менеджера.
4. Письма (SMTP, React Email): дубль заявки менеджеру, «Заявка принята» покупателю.
5. Формы «Задать вопрос» и «Подобрать размер» → таблица `lead` → тот же путь.

Переменные: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SMTP_*`. Приёмка: тестовая заявка в чате, статус меняется кнопкой; при недоступном Telegram заявка сохраняется и досылается.

## 4. Этап 4: вёрстка страниц и юридический контур

1. Сверить токены с Figma («Конфигуратор итог»), заменить временный шрифт заголовков (Unbounded) на лицензированный.
2. Страницы: главная, О бренде, Покупателям (доставка, оплата, обмен и возврат: 7 дней, претензия 10 дней, FAQ), Контакты, подвал с реквизитами на всех страницах, страница ошибки.
3. Юридические страницы с текстами от заказчика; версия оферты в `setting.offer.version`.
4. Cookie-баннер «Принять / Настроить / Отклонить»; Яндекс Метрика (`YM_COUNTER_ID`) загружается только после согласия. Сейчас на стейдже Метрику вставляет HostCare сервера: решение за владельцем (см. открытые вопросы).
5. SEO: title/description/H1 из реестра, canonical от `APP_URL`, `sitemap.xml`, Open Graph, микроразметка Organization, Product/Offer, BreadcrumbList. Индексация включается только при заполненных реквизитах.

Приёмка: скриншоты 375 и 1440 px всех страниц, нет запросов к mc.yandex.ru до согласия, Lighthouse mobile Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.

## 5. Этап 5: оплата и доставка

1. `YooKassaProvider` (СБП + карты), чеки 54-ФЗ, webhook статусов → `paid` / `refunded`, оформление переводит на оплату при `payments.enabled`.
2. `CdekProvider` v2: расчёт стоимости и срока, выбор ПВЗ на карте, создание отправки из админки, трек-номер в заявке и письме.
3. Вес и габариты вариантов обязательны при включённом СДЭК.

Приёмка: оплата в песочнице ЮKassa проходит, чек формируется; стоимость СДЭК видна до отправки заказа.

## 6. Как работать

```bash
git clone -b claude/festive-clarke-rnf8vy https://github.com/Neeklo1606/MED2D.git medform && cd medform
pnpm install && cp .env.example .env
export DATABASE_URL=postgres://medform:medform@localhost:5432/medform
pnpm dev
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm drizzle-kit generate --name <изменение>   # новая миграция после правки schema.ts
```

Правила: тексты только через реестр, деньги в копейках, суммы на сервере, без зарубежных сервисов с ПДн, новые зависимости согласовывать, к pull request скриншоты 375/1440 и что проверено.

Статусы критериев приёмки: `docs/audit.md`. Открытые вопросы: `docs/blockers.md`. Отчёт этапа 1: `docs/report-2026-11-20.md`.
