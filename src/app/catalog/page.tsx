import type { Metadata } from "next";
import { getField } from "@/content/registry";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import Configurator from "@/configurator/Configurator";

export const metadata: Metadata = {
  title: getField("catalog.seo.title"),
  description: getField("catalog.seo.description"),
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  return (
    <>
      <div role="status" className="bg-ink px-4 py-2 text-center text-xs text-white">{getField("global.staging.notice")}</div>
      <Header />
      <main><Configurator /></main>
      <Toast />
    </>
  );
}
