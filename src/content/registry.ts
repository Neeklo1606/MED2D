/**
 * Реестр полей контента (см. раздел 4.1 мастер-промпта).
 * На этапе 0-1 значения берутся только из default. С этапа 7 поверх них
 * подставляются значения из таблицы content_field.
 */
export type FieldType = "text" | "richtext" | "image" | "link" | "number" | "boolean" | "list";

export interface FieldDef {
  page: string;
  section: string;
  key: string;
  type: FieldType;
  label: string;
  hint?: string;
  default: string;
  maxLength?: number;
}

const f = (id: string, type: FieldType, label: string, def: string, maxLength?: number, hint?: string): FieldDef => {
  const [page, section, key] = id.split(".");
  return { page, section, key, type, label, default: def, maxLength, hint };
};

export const registry: FieldDef[] = [
  f("global.header.tagline", "text", "Подпись слева в шапке", "Медицинская одежда", 40),
  f("global.header.cart", "text", "Кнопка корзины", "Корзина", 20),
  f("global.staging.notice", "text", "Плашка тестовой версии", "Тестовая версия сайта. Заказы не принимаются, реквизиты продавца будут добавлены.", 160),
  f("global.footer.copyright", "text", "Копирайт в подвале", "MEDFORM. Medicine inside", 80),
  f("global.footer.dev", "text", "Подпись разработчика", "Разработка: neeklo.studio", 80),
  f("home.seo.title", "text", "SEO title главной", "MEDFORM: медицинская одежда унисекс", 70),
  f("home.seo.description", "text", "SEO description главной", "Медицинская одежда MEDFORM: анораки, джоггеры, халаты, сабо. Соберите капсулу в онлайн-конфигураторе.", 160),
  f("home.hero.titleStart", "text", "Заголовок, начало", "Соберите свою", 40),
  f("home.hero.titleAccent", "text", "Заголовок, акцентное слово", "капсулу", 20),
  f("home.hero.subtitle", "text", "Подзаголовок", "Выберите вещи, цвет и размер: посмотрите образ на модели и отправьте заявку в один клик.", 200),
  f("home.hero.cta", "text", "Кнопка первого экрана", "Собрать образ", 30),
  f("home.hero.ctaNote", "text", "Подпись под кнопкой", "Конфигуратор в разработке: этап 3 плана работ", 80),
  f("home.total.label", "text", "Заголовок блока Итого", "Итого", 20),
  f("home.total.addAll", "text", "Кнопка добавления образа", "Добавить весь образ в корзину", 40),
  f("home.preview.gender", "text", "Подпись переключателя модели", "Модель", 20),
  f("home.preview.zoom", "text", "Подпись зума", "Приближение", 20),
  f("home.preview.removeAll", "text", "Кнопка Снять всё", "Снять всё", 20),
  f("home.preview.color", "text", "Подпись выбора цвета", "Цвет", 20),
  f("home.preview.size", "text", "Подпись выбора размера", "Размер", 20),
  f("home.preview.tryOn", "text", "Кнопка Примерить", "Примерить", 20),
  f("home.preview.takeOff", "text", "Кнопка Снять", "Снять", 20),
  f("home.preview.details", "text", "Ссылка на карточку", "Подробное описание и фото", 40),
];

const byId = new Map(registry.map((d) => [`${d.page}.${d.section}.${d.key}`, d]));

export function getField(id: string): string {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown content field: ${id}`);
  return def.default;
}
