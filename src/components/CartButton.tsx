"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/configurator/store";

function CartIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M2 3.5h2.6l2.3 10.6c.1.6.7 1 1.3 1h9.6c.6 0 1.1-.4 1.3-1L21 6.5H6.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="9" cy="19.5" r="1.7" /><circle cx="17.5" cy="19.5" r="1.7" />
    </svg>
  );
}

export default function CartButton({ label, round }: { label: string; round?: boolean }) {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  useEffect(() => { useCart.persist.rehydrate(); }, []);
  if (round) {
    return (
      <Link href="/cart" data-cart-button aria-label={`${label}: ${count}`} className="press relative grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white">
        <CartIcon className="size-5" />
        <span className={`absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-semibold leading-5 text-white ${count ? "" : "hidden"}`}>{count}</span>
      </Link>
    );
  }
  return (
    <Link href="/cart" data-cart-button className="press inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-accent px-4 text-sm font-semibold">
      {label}
      <span className="inline-grid size-6 place-items-center rounded-full bg-accent text-xs text-white" aria-label={`Товаров в корзине: ${count}`}>{count}</span>
    </Link>
  );
}
