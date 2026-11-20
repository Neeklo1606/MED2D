/**
 * Временный каталог до этапа БД (шаг 3). Цены из макета, остальное price_pending.
 * Источник состава и цветов: docs/tz.md. HEX цветов приблизительные (docs/design-tokens.md).
 */
export type Slot = "top" | "bottom" | "coat" | "head" | "feet" | "accessory";
export type Gender = "f" | "m";

export const COLORS: Record<string, { name: string; hex: string }> = {
  white: { name: "белый", hex: "#F4F4F2" },
  lightblue: { name: "голубой", hex: "#81A1D2" },
  navy: { name: "тёмно-синий", hex: "#1F2B5F" },
  emerald: { name: "изумрудный", hex: "#244F56" },
  blue: { name: "синий", hex: "#2738A2" },
  pink: { name: "розовый", hex: "#E5B2BB" },
  grey: { name: "серый", hex: "#9A9DA3" },
  black: { name: "чёрный", hex: "#1B1B1D" },
  silver: { name: "серебристый", hex: "#C9CCD1" },
};

export interface Product {
  slug: string;
  /** Имя GLB без суффикса пола: public/3d/models/{model}_{g}.glb */
  model: string | null;
  slot: Slot;
  title: string;
  short: string;
  priceRub: number | null;
  colors: string[];
  sizes: string[];
  category: "top" | "bottom" | "coat" | "head" | "feet" | "accessory";
}

// порядок как в макете: тёмно-синий, синий, изумрудный, голубой, розовый, белый
const SCRUB = ["navy", "blue", "emerald", "lightblue", "pink", "white"];
const CLOTH = ["XS", "S", "M", "L", "XL"];

export const PRODUCTS: Product[] = [
  { slug: "anorak", model: "top_anorak", slot: "top", category: "top", title: "Медицинский верх", short: "Оверсайз, V-вырез, карман-кенгуру", priceRub: 3200, colors: SCRUB, sizes: CLOTH },
  { slug: "tshirt", model: "top_tshirt", slot: "top", category: "top", title: "Футболка оверсайз", short: "Хлопок, свободная посадка, под халат или анорак.", priceRub: 2200, colors: ["white", "grey", "blue"], sizes: CLOTH },
  { slug: "joggers", model: "bottom_joggers", slot: "bottom", category: "bottom", title: "Медицинские брюки", short: "Свободный крой, карманы-карго, пояс на резинке", priceRub: 3000, colors: SCRUB, sizes: CLOTH },
  { slug: "halat", model: "coat_halat", slot: "coat", category: "coat", title: "Халат медицинский унисекс", short: "Классический белый халат, надевается поверх верха.", priceRub: null, colors: ["white"], sizes: CLOTH },
  { slug: "cap", model: "head_cap", slot: "head", category: "head", title: "Шапочка медицинская", short: "Регулируемая завязка, одна посадка.", priceRub: null, colors: SCRUB, sizes: [] },
  { slug: "dokerka", model: "head_dokerka", slot: "head", category: "head", title: "Головной убор докерка", short: "Мягкая трикотажная шапка.", priceRub: null, colors: SCRUB, sizes: [] },
  { slug: "sabo", model: "feet_sabo", slot: "feet", category: "feet", title: "Сабо", short: "Лёгкие, с фиксирующим ремешком.", priceRub: 3000, colors: ["grey", "navy", "black", "pink", "white"], sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] },
  { slug: "lanyard", model: null, slot: "accessory", category: "accessory", title: "Шнурок для телефона и пропуска", short: "Прочная лента с карабином.", priceRub: null, colors: ["black", "grey", "blue"], sizes: [] },
  { slug: "shopper", model: null, slot: "accessory", category: "accessory", title: "Шопер", short: "Вместительная сумка для смены.", priceRub: null, colors: ["silver"], sizes: [] },
];

export const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));

export const CATEGORIES: { id: Product["category"]; label: string }[] = [
  { id: "top", label: "Верх" },
  { id: "bottom", label: "Низ" },
  { id: "coat", label: "Халат" },
  { id: "head", label: "Голова" },
  { id: "feet", label: "Обувь" },
  { id: "accessory", label: "Аксессуары" },
];

export const formatRub = (v: number) => new Intl.NumberFormat("ru-RU").format(v) + " ₽";
