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
  f("catalog.stage.rotate", "text", "Кнопка поворота модели", "Повернуть модель", 30),
  f("catalog.card.details", "text", "Ссылка на карточку товара", "Подробное описание и фото", 40),
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
  f("cart.seo.title", "text", "SEO title корзины", "Корзина MEDFORM", 70),
  f("cart.page.title", "text", "Заголовок корзины", "Корзина", 30),
  f("cart.page.viewLook", "text", "Кнопка образ на модели", "Посмотреть образ на 3D-модели", 40),
  f("cart.empty.title", "text", "Пустая корзина: заголовок", "В корзине пока пусто", 60),
  f("cart.empty.text", "text", "Пустая корзина: текст", "Соберите образ в конфигураторе и добавьте вещи сюда.", 160),
  f("cart.empty.cta", "text", "Пустая корзина: кнопка", "Собрать образ", 30),
  f("cart.line.size", "text", "Подпись размера в строке", "Размер", 20),
  f("cart.line.remove", "text", "Удалить из корзины", "Удалить", 20),
  f("cart.summary.items", "text", "Итог: товары", "Товары", 20),
  f("cart.summary.delivery", "text", "Итог: доставка", "Доставка", 20),
  f("cart.summary.deliveryNote", "text", "Итог: условия доставки", "СДЭК по России. Стоимость и срок менеджер сообщит при подтверждении заявки.", 200),
  f("cart.summary.total", "text", "Итог: всего", "Итого", 20),
  f("cart.summary.cta", "text", "Кнопка оформить", "Оформить заявку", 30),
  f("cart.summary.payNote", "text", "Пояснение об оплате", "Оплата при подтверждении заявки. Онлайн-оплата появится позже.", 160),
  f("cart.summary.fix", "text", "Есть ошибки в корзине", "Исправьте отмеченные позиции, чтобы продолжить", 80),
  f("checkout.seo.title", "text", "SEO title оформления", "Оформление заявки MEDFORM", 70),
  f("checkout.page.title", "text", "Заголовок оформления", "Оформление заявки", 40),
  f("checkout.page.lead", "text", "Подзаголовок оформления", "Без регистрации. Менеджер свяжется с вами, подтвердит наличие, доставку и оплату.", 200),
  f("checkout.section.contacts", "text", "Секция контакты", "Контакты", 30),
  f("checkout.section.delivery", "text", "Секция получение", "Получение", 30),
  f("checkout.section.comment", "text", "Секция комментарий", "Комментарий", 30),
  f("checkout.field.name", "text", "Поле имя", "Имя", 30),
  f("checkout.field.phone", "text", "Поле телефон", "Телефон", 30),
  f("checkout.field.email", "text", "Поле email", "Email", 30),
  f("checkout.field.city", "text", "Поле город", "Город", 30),
  f("checkout.field.method", "text", "Поле способ получения", "Способ получения", 40),
  f("checkout.field.address", "text", "Поле адрес", "Адрес или пункт выдачи", 40),
  f("checkout.field.addressHint", "text", "Подсказка адреса", "Улица, дом, квартира или адрес пункта СДЭК", 80),
  f("checkout.field.comment", "text", "Поле комментарий", "Комментарий к заявке", 40),
  f("checkout.field.optional", "text", "Метка необязательного поля", "необязательно", 20),
  f("checkout.field.required", "text", "Метка обязательного поля", "обязательно", 20),
  f("checkout.consent.pdBefore", "text", "Согласие ПДн: начало", "Даю", 20),
  f("checkout.consent.pdLink", "text", "Согласие ПДн: ссылка", "согласие на обработку персональных данных", 80),
  f("checkout.consent.pdAfter", "text", "Согласие ПДн: окончание", "и принимаю условия", 40),
  f("checkout.consent.offerLink", "text", "Ссылка на оферту", "публичной оферты", 40),
  f("checkout.consent.marketing", "text", "Согласие на рассылки", "Хочу получать новости и скидки MEDFORM (необязательно)", 120),
  f("checkout.form.submit", "text", "Кнопка отправить", "Отправить заявку", 30),
  f("checkout.form.sending", "text", "Отправка", "Отправляем…", 30),
  f("checkout.summary.title", "text", "Итог заказа", "Ваша заявка", 30),
  f("checkout.summary.edit", "text", "Изменить корзину", "Изменить", 20),
  f("checkout.errors.title", "text", "Заголовок ошибок", "Проверьте отмеченные поля", 60),
  f("order.seo.title", "text", "SEO title заказа", "Заявка принята", 70),
  f("order.page.title", "text", "Заголовок заказа", "Заявка принята", 40),
  f("order.page.number", "text", "Подпись номера", "Номер заявки", 30),
  f("order.next.title", "text", "Что дальше: заголовок", "Что дальше", 30),
  f("order.next.step1", "text", "Что дальше: шаг 1", "Менеджер свяжется с вами в течение рабочего дня (пн-пт, 10:00-19:00 мск).", 160),
  f("order.next.step2", "text", "Что дальше: шаг 2", "Подтвердит наличие, размеры, стоимость доставки и способ оплаты.", 160),
  f("order.next.step3", "text", "Что дальше: шаг 3", "После оплаты отправим заказ и пришлём трек-номер СДЭК.", 160),
  f("order.page.saveLink", "text", "Подсказка сохранить ссылку", "Сохраните эту страницу: по ссылке можно проверить статус заявки.", 160),
  f("order.page.continue", "text", "Кнопка продолжить", "Вернуться к покупкам", 40),
  f("order.page.notFound", "text", "Заказ не найден", "Заявка не найдена. Проверьте ссылку из письма.", 120),
  f("legal.pending.text", "text", "Заглушка юр. документа", "Текст документа готовится и будет опубликован до запуска продаж.", 200),
  f("catalog.grid.title", "text", "Заголовок сетки товаров", "Все товары", 40),
  f("catalog.grid.filters", "text", "Подпись фильтров", "Фильтр по категориям", 40),
  f("product.crumbs.home", "text", "Крошки: главная", "Главная", 20),
  f("product.crumbs.catalog", "text", "Крошки: каталог", "Каталог", 20),
  f("product.gallery.pending", "text", "Подпись вместо фото", "Фото появятся после съёмки образцов", 60),
  f("product.buy.add", "text", "Кнопка в корзину", "В корзину", 20),
  f("product.buy.tryOn", "text", "Кнопка примерить на модели", "Примерить на модели", 30),
  f("product.info.composition", "text", "Подпись состава", "Состав", 20),
  f("product.info.care", "text", "Подпись ухода", "Уход", 20),
  f("product.info.manufacturer", "text", "Подпись производителя", "Производитель", 30),
  f("product.info.country", "text", "Подпись страны", "Страна", 20),
  f("product.info.certificate", "text", "Подпись сертификата", "Декларация соответствия", 40),
  f("product.info.pending", "text", "Значение не заполнено", "уточняется", 20),
];

const byId = new Map(registry.map((d) => [`${d.page}.${d.section}.${d.key}`, d]));

export function getField(id: string): string {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown content field: ${id}`);
  return def.default;
}
