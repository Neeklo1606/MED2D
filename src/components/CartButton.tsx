"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/configurator/store";

export default function CartButton({ label }: { label: string }) {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  useEffect(() => { useCart.persist.rehydrate(); }, []);
  return (
    <Link href="/cart" data-cart-button className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-accent px-4 text-sm font-semibold">
      {label}
      <span className="inline-grid size-6 place-items-center rounded-full bg-accent text-xs text-white" aria-label={`Товаров в корзине: ${count}`}>{count}</span>
    </Link>
  );
}
