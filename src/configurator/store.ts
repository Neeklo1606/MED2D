"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { bySlug, PRODUCTS, type Gender, type Slot } from "@/catalog/data";
import { clearLook, emptyLook, takeOff, wear, type Look } from "./look";

interface Pick { color: string; size: string | null }

interface LookState {
  look: Look;
  picks: Record<string, Pick>;
  invalid: Slot[];
  setLook: (l: Look) => void;
  setGender: (g: Gender) => void;
  toggle: (slug: string) => void;
  setColor: (slug: string, color: string) => void;
  setSize: (slug: string, size: string) => void;
  remove: (slot: Slot) => void;
  clear: () => void;
  setInvalid: (s: Slot[]) => void;
}

const initialPicks = Object.fromEntries(PRODUCTS.map((p) => [p.slug, { color: p.colors[0], size: null }]));

export const DEFAULT_LOOK: Look = {
  gender: "f",
  slots: {
    top: { slug: "anorak", color: "lightblue", size: null },
    bottom: { slug: "joggers", color: "lightblue", size: null },
    feet: { slug: "sabo", color: "grey", size: null },
  },
};

export const useLook = create<LookState>()((set, get) => ({
  look: emptyLook(),
  picks: initialPicks,
  invalid: [],
  setLook: (look) => {
    const picks = { ...get().picks };
    for (const w of Object.values(look.slots)) if (w) picks[w.slug] = { color: w.color, size: w.size };
    set({ look, picks });
  },
  setGender: (gender) => set({ look: { ...get().look, gender } }),
  toggle: (slug) => {
    const p = bySlug.get(slug);
    if (!p) return;
    const { look, picks } = get();
    if (look.slots[p.slot]?.slug === slug) set({ look: takeOff(look, p.slot) });
    else set({ look: wear(look, { slug, ...picks[slug] }), invalid: get().invalid.filter((s) => s !== p.slot) });
  },
  setColor: (slug, color) => {
    const p = bySlug.get(slug);
    if (!p) return;
    const { look, picks } = get();
    const next = { ...picks[slug], color };
    const worn = look.slots[p.slot]?.slug === slug;
    set({ picks: { ...picks, [slug]: next }, look: worn ? wear(look, { slug, ...next }) : look });
  },
  setSize: (slug, size) => {
    const p = bySlug.get(slug);
    if (!p) return;
    const { look, picks, invalid } = get();
    const next = { ...picks[slug], size };
    const worn = look.slots[p.slot]?.slug === slug;
    set({
      picks: { ...picks, [slug]: next },
      look: worn ? wear(look, { slug, ...next }) : look,
      invalid: invalid.filter((s) => s !== p.slot),
    });
  },
  remove: (slot) => set({ look: takeOff(get().look, slot) }),
  clear: () => set({ look: clearLook(get().look), invalid: [] }),
  setInvalid: (invalid) => set({ invalid }),
}));

export interface CartItem { slug: string; color: string; size: string | null; qty: number }

interface CartState {
  items: CartItem[];
  add: (items: Omit<CartItem, "qty">[]) => void;
  setQty: (i: number, qty: number) => void;
  removeAt: (i: number) => void;
}

const safeStorage = createJSONStorage(() => {
  try { return window.localStorage; } catch { return undefined as unknown as Storage; }
});

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (add) => {
        const items = [...get().items];
        for (const a of add) {
          const i = items.findIndex((x) => x.slug === a.slug && x.color === a.color && x.size === a.size);
          if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + 1 };
          else items.push({ ...a, qty: 1 });
        }
        set({ items });
      },
      setQty: (i, qty) => set({ items: get().items.map((x, j) => (j === i ? { ...x, qty: Math.max(1, qty) } : x)) }),
      removeAt: (i) => set({ items: get().items.filter((_, j) => j !== i) }),
    }),
    { name: "medform-cart", storage: safeStorage, skipHydration: true },
  ),
);

interface ToastState { text: string | null; show: (t: string) => void }
let timer: ReturnType<typeof setTimeout> | undefined;
export const useToast = create<ToastState>()((set) => ({
  text: null,
  show: (text) => {
    clearTimeout(timer);
    set({ text });
    timer = setTimeout(() => set({ text: null }), 2600);
  },
}));
