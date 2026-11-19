import { bySlug, type Gender, type Product, type Slot } from "@/catalog/data";

export const SLOT_ORDER: Slot[] = ["feet", "bottom", "top", "coat", "head", "accessory"];

export interface Worn { slug: string; color: string; size: string | null }
export interface Look { gender: Gender; slots: Partial<Record<Slot, Worn>> }

export const emptyLook = (gender: Gender = "f"): Look => ({ gender, slots: {} });

/** Надеть вещь: одна вещь на слот, новая заменяет старую. */
export function wear(look: Look, w: Worn): Look {
  const p = bySlug.get(w.slug);
  if (!p) return look;
  return { ...look, slots: { ...look.slots, [p.slot]: w } };
}

export function takeOff(look: Look, slot: Slot): Look {
  const slots = { ...look.slots };
  delete slots[slot];
  return { ...look, slots };
}

export const clearLook = (look: Look): Look => ({ gender: look.gender, slots: {} });

export function wornList(look: Look): { slot: Slot; worn: Worn; product: Product }[] {
  return SLOT_ORDER.flatMap((slot) => {
    const worn = look.slots[slot];
    const product = worn && bySlug.get(worn.slug);
    return worn && product ? [{ slot, worn, product }] : [];
  });
}

export function total(look: Look): number {
  return wornList(look).reduce((s, x) => s + (x.product.priceRub ?? 0), 0);
}

/** Вещи, которым нужен размер, но он не выбран. */
export function missingSizes(look: Look): Slot[] {
  return wornList(look).filter((x) => x.product.sizes.length > 0 && !x.worn.size).map((x) => x.slot);
}

/** ?g=f&top=anorak.pink.M&bottom=joggers.pink */
export function toQuery(look: Look): string {
  const q = new URLSearchParams({ g: look.gender });
  for (const { slot, worn } of wornList(look)) {
    q.set(slot, [worn.slug, worn.color, worn.size].filter(Boolean).join("."));
  }
  return q.toString();
}

/** Неверные части молча отбрасываются. */
export function fromQuery(search: string): Look {
  const q = new URLSearchParams(search);
  let look = emptyLook(q.get("g") === "m" ? "m" : "f");
  for (const slot of SLOT_ORDER) {
    const raw = q.get(slot);
    if (!raw) continue;
    const [slug, color, size] = raw.split(".");
    const p = bySlug.get(slug);
    if (!p || p.slot !== slot || !p.colors.includes(color)) continue;
    look = wear(look, { slug, color, size: size && p.sizes.includes(size) ? size : null });
  }
  return look;
}
