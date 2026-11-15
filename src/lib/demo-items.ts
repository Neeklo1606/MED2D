/** Временные демо-данные для превью на стейдже. Цены из макета, см. docs/blockers.md. */
export const demoItems = [
  { slug: "anorak", title: "Рубашка-анорак хирургическая", priceRub: 3200, colors: ["#8fb8e8", "#1d2a4d", "#1f8a70", "#2d5be3", "#f2a7c3", "#ffffff"], sizes: ["XS", "S", "M", "L", "XL"], worn: true },
  { slug: "joggers", title: "Брюки-джоггеры хирургические", priceRub: 3000, colors: ["#8fb8e8", "#1d2a4d", "#1f8a70", "#2d5be3", "#f2a7c3", "#ffffff"], sizes: ["XS", "S", "M", "L", "XL"], worn: true },
  { slug: "tshirt", title: "Футболка оверсайз", priceRub: 2200, colors: ["#ffffff", "#9a9ca3", "#2d5be3"], sizes: ["XS", "S", "M", "L", "XL"], worn: false },
  { slug: "clogs", title: "Сабо", priceRub: 3000, colors: ["#9a9ca3", "#1d2a4d", "#111111", "#f2a7c3", "#ffffff"], sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"], worn: true },
];

export const formatRub = (v: number) => new Intl.NumberFormat("ru-RU").format(v) + " ₽";
