import type { Metadata } from "next";
import { getField } from "@/content/registry";
import Configurator from "@/configurator/Configurator";

export const metadata: Metadata = {
  title: getField("catalog.seo.title"),
  description: getField("catalog.seo.description"),
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  return (
    <main><Configurator /></main>
  );
}
