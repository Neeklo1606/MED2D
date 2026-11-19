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
  f("home.hero.ctaNote", "text", "Подпись под кнопкой", "3D-конфигуратор: вращайте модель и меняйте цвета", 80),
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
  f("catalog.seo.title", "text", "SEO title каталога", "Конфигуратор образа MEDFORM", 70),
  f("catalog.seo.description", "text", "SEO description каталога", "Соберите капсулу медицинской одежды на 3D-модели: цвет, размер и заявка в один клик.", 160),
  f("catalog.hero.titleStart", "text", "Заголовок, начало", "Соберите свою", 40),
  f("catalog.hero.titleAccent", "text", "Заголовок, акцент", "капсулу", 20),
  f("catalog.hero.subtitle", "text", "Подзаголовок", "Надевайте вещи на модель, меняйте цвет и размер. Модель можно вращать.", 200),
  f("catalog.total.label", "text", "Заголовок Итого", "Итого", 20),
  f("catalog.total.empty", "text", "Пустой образ", "Наденьте вещи из списка, чтобы собрать образ.", 120),
  f("catalog.total.addAll", "text", "Кнопка добавить образ", "Добавить весь образ в корзину", 40),
  f("catalog.total.addAllShort", "text", "Кнопка добавить образ (мобильная)", "Добавить образ", 24),
  f("catalog.total.addOne", "text", "Подсказка добавить одну вещь", "Добавить в корзину", 30),
  f("catalog.total.remove", "text", "Подсказка снять вещь", "Снять", 20),
  f("catalog.stage.removeAll", "text", "Кнопка Снять всё", "Снять всё", 20),
  f("catalog.stage.gender", "text", "Подпись переключателя модели", "Модель", 20),
  f("catalog.stage.zoom", "text", "Подпись зума", "Приближение", 20),
  f("catalog.stage.reset", "text", "Кнопка сброса камеры", "Сбросить вид", 20),
  f("catalog.stage.hint", "text", "Подсказка вращения", "Вращайте модель пальцем или мышью", 60),
  f("catalog.stage.mode3d", "text", "Переключатель 3D", "3D", 10),
  f("catalog.stage.mode2d", "text", "Переключатель 2D", "2D", 10),
  f("catalog.card.color", "text", "Подпись цвета", "Цвет", 20),
  f("catalog.card.size", "text", "Подпись размера", "Размер", 20),
  f("catalog.card.sizeChart", "text", "Ссылка на таблицу размеров", "Таблица размеров", 30),
  f("catalog.card.tryOn", "text", "Кнопка Примерить", "Примерить", 20),
  f("catalog.card.takeOff", "text", "Кнопка Снять", "Снять", 20),
  f("catalog.card.pricePending", "text", "Цена не задана", "Цена уточняется", 30),
  f("catalog.card.sizeMissing", "text", "Ошибка: нет размера", "Выберите размер", 40),
  f("catalog.card.oneSize", "text", "Без размера", "Один размер", 30),
  f("catalog.toast.added", "text", "Тост: добавлено", "Добавлено в корзину", 40),
  f("catalog.toast.addedLook", "text", "Тост: образ добавлен", "Образ добавлен в корзину", 40),
  f("catalog.toast.needSizes", "text", "Тост: нужны размеры", "Выберите размер у отмеченных вещей", 60),
  f("catalog.toast.pending", "text", "Тост: есть вещи без цены", "Вещи с ценой «уточняется» пока нельзя добавить", 80),
  f("catalog.sizeChart.title", "text", "Заголовок таблицы размеров", "Как выбрать размер", 40),
  f("catalog.sizeChart.hint", "text", "Подсказка таблицы размеров", "Измерьте обхват груди и бёдер по самой широкой части. Если между размерами, берите больший: модели свободного кроя.", 240),
  f("catalog.sizeChart.close", "text", "Закрыть таблицу", "Закрыть", 20),
];

const byId = new Map(registry.map((d) => [`${d.page}.${d.section}.${d.key}`, d]));

export function getField(id: string): string {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown content field: ${id}`);
  return def.default;
}
