import type { Metadata } from "next";
import { getField } from "@/content/registry";
import CartView from "@/shop/CartView";

export const metadata: Metadata = { title: getField("cart.seo.title"), robots: { index: false } };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-32 pt-5 md:px-10 md:pt-8 lg:pb-16">
      <h1 className="mb-5 font-display text-[30px] font-black uppercase leading-[1.05] md:text-5xl">{getField("cart.page.title")}</h1>
      <CartView />
    </main>
  );
}
