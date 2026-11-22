import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_URL, INDEXING_ENABLED } from "@/lib/env";
import { getField } from "@/content/registry";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import NavigationProgress from "@/features/app-feel/NavigationProgress";
import ServiceWorker from "@/features/app-feel/ServiceWorker";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: getField("home.seo.title"),
  description: getField("home.seo.description"),
  alternates: { canonical: "/" },
  robots: INDEXING_ENABLED ? undefined : { index: false, follow: false },
  appleWebApp: { capable: true, title: "MEDFORM", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png", icon: "/icons/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f3f3f3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <NavigationProgress />
        <div role="status" className="bg-ink px-4 py-2 text-center text-xs text-white" style={{ paddingTop: "max(8px, env(safe-area-inset-top, 0px))" }}>{getField("global.staging.notice")}</div>
        <Header />
        {children}
        <Footer />
        <Toast />
        <CookieBanner ymId={process.env.YM_COUNTER_ID ?? ""} />
        <ServiceWorker buildId={process.env.APP_VERSION ?? "dev"} />
      </body>
    </html>
  );
}
