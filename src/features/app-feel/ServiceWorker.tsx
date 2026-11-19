"use client";
import { useEffect } from "react";

/** Регистрирует /sw.js. NEXT_PUBLIC_SW=off снимает воркер и чистит кеш. */
export default function ServiceWorker({ buildId }: { buildId: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NEXT_PUBLIC_SW === "off" || process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      caches?.keys().then((ks) => ks.filter((k) => k.startsWith("mf-")).forEach((k) => caches.delete(k)));
      return;
    }
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId)}`, { scope: "/" }).catch(() => {});
  }, [buildId]);
  return null;
}
