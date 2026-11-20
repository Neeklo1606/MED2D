"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getField as t } from "@/content/registry";

type Consent = { analytics: boolean; at: string };
const KEY = "medform-consent";
const read = (): Consent | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
let listeners: (() => void)[] = [];
const subscribe = (cb: () => void) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; };
const snapshot = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return "x"; } };

function loadMetrika(id: string) {
  if (!id || document.getElementById("ym-tag")) return;
  const s = document.createElement("script");
  s.id = "ym-tag"; s.async = true; s.src = "https://mc.yandex.ru/metrika/tag.js";
  s.onload = () => (window as unknown as { ym?: (...a: unknown[]) => void }).ym?.(Number(id), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  document.head.appendChild(s);
}

/** Cookie-баннер: аналитика (Яндекс Метрика) грузится только после согласия. */
export default function CookieBanner({ ymId }: { ymId: string }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "x");
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const consent = raw && raw !== "x" ? read() : null;
  useEffect(() => { if (consent?.analytics) loadMetrika(ymId); }, [consent?.analytics, ymId]);
  if (raw) return null;
  const save = (a: boolean) => {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: a, at: new Date().toISOString() })); } catch { /* приватный режим */ }
    listeners.forEach((l) => l());
  };
  return (
    <div role="dialog" aria-label="Настройки cookies" className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-xl rounded-[var(--radius-lg)] bg-surface p-4 shadow-2xl ring-1 ring-line" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <p className="text-sm">{t("global.cookies.text")} <Link href="/legal/cookies" className="underline">{t("global.cookies.more")}</Link></p>
      {settings && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-start gap-3 text-muted"><input type="checkbox" checked disabled className="mt-0.5 size-5" />{t("global.cookies.necessary")}</label>
          <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-accent)]" />{t("global.cookies.analytics")}</label>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {settings ? (
          <button type="button" onClick={() => save(analytics)} className="min-h-11 flex-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">{t("global.cookies.save")}</button>
        ) : (
          <>
            <button type="button" onClick={() => save(true)} className="min-h-11 flex-1 rounded-full bg-ink px-4 text-sm font-semibold text-white">{t("global.cookies.accept")}</button>
            <button type="button" onClick={() => setSettings(true)} className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold">{t("global.cookies.settings")}</button>
            <button type="button" onClick={() => save(false)} className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold">{t("global.cookies.decline")}</button>
          </>
        )}
      </div>
    </div>
  );
}
