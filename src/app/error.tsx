"use client";
import Link from "next/link";
import { getField as t } from "@/content/registry";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[60svh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl font-black text-accent">500</p>
        <h1 className="mt-3 font-display text-xl font-black uppercase">{t("global.errors.title")}</h1>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="min-h-12 rounded-full bg-ink px-6 font-semibold text-white">{t("global.errors.retry")}</button>
          <Link href="/" className="press inline-flex min-h-12 items-center rounded-full border border-ink px-6 font-semibold">{t("global.errors.home")}</Link>
        </div>
      </div>
    </main>
  );
}
