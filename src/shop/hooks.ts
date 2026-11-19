"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CartLine } from "@/lib/checkout";
import { useCart } from "@/configurator/store";

/** Корзина из localStorage без мигания пустого состояния. */
export function useCartHydrated() {
  useEffect(() => { if (!useCart.persist.hasHydrated()) useCart.persist.rehydrate(); }, []);
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}

export interface QuoteLine extends CartLine { title: string; colorName: string; hex: string; priceKop: number | null; sizes: string[]; error: string | null }
export interface DeliveryOption { id: "pickup" | "courier"; label: string; priceKop: number | null; note: string }
export interface Quote { lines: QuoteLine[]; itemsTotalKop: number; delivery: DeliveryOption[] }

/** Пересчёт корзины на сервере (debounce 250 мс). */
export function useQuote(items: CartLine[], enabled: boolean, city = "") {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify([items, city]);
  useEffect(() => {
    if (!enabled) return;
    const n = ++seq.current;
    const id = setTimeout(async () => {
      try {
        const r = await fetch("/api/cart/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, city }) });
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as Quote;
        if (n === seq.current) { setQuote(data); setError(null); }
      } catch {
        if (n === seq.current) setError("Не удалось обновить цены. Проверьте интернет и попробуйте ещё раз.");
      }
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { quote, error };
}
