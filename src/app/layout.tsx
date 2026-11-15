import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_URL, INDEXING_ENABLED } from "@/lib/env";
import { getField } from "@/content/registry";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: getField("home.seo.title"),
  description: getField("home.seo.description"),
  alternates: { canonical: "/" },
  robots: INDEXING_ENABLED ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ededef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
