import type { Metadata } from "next";
import { getField } from "@/content/registry";
import CartView from "@/shop/CartView";

export const metadata: Metadata = { title: getField("cart.seo.title"), robots: { index: false } };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-32 pt-2 md:px-10 lg:pb-16">
      <h1 className="mb-4 font-display text-2xl font-black uppercase md:text-4xl">{getField("cart.page.title")}</h1>
      <CartView />
    </main>
  );
}
