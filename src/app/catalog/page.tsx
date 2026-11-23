import type { Metadata } from "next";
import { getField } from "@/content/registry";
import Configurator from "@/configurator/Configurator";
import ModelPreload from "@/configurator/ModelPreload";
import CatalogGrid from "@/shop/CatalogGrid";

export const metadata: Metadata = {
  title: getField("catalog.seo.title"),
  description: getField("catalog.seo.description"),
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  return (
    <main><ModelPreload /><Configurator /><CatalogGrid /></main>
  );
}
