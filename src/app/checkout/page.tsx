import type { Metadata } from "next";
import { getField } from "@/content/registry";
import CheckoutView from "@/shop/CheckoutView";

export const metadata: Metadata = { title: getField("checkout.seo.title"), robots: { index: false } };

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-32 pt-2 md:px-10 lg:pb-16">
      <h1 className="font-display text-2xl font-black uppercase md:text-4xl">{getField("checkout.page.title")}</h1>
      <p className="mb-5 mt-1 max-w-xl text-sm text-muted">{getField("checkout.page.lead")}</p>
      <CheckoutView />
    </main>
  );
}
