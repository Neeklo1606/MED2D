import type { Metadata } from "next";
import { getField } from "@/content/registry";
import CheckoutView from "@/shop/CheckoutView";

export const metadata: Metadata = { title: getField("checkout.seo.title"), robots: { index: false } };

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-32 pt-5 md:px-10 md:pt-8 lg:pb-16">
      <h1 className="font-display text-[30px] font-black uppercase leading-[1.05] md:text-5xl">{getField("checkout.page.title")}</h1>
      <p className="mb-5 mt-2 max-w-xl text-[15px] leading-snug text-muted">{getField("checkout.page.lead")}</p>
      <CheckoutView />
    </main>
  );
}
