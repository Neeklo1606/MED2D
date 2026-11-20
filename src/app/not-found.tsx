import Link from "next/link";
import { getField as t } from "@/content/registry";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[60svh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="font-display text-7xl font-black text-accent">404</p>
        <p className="mt-3">{t("global.errors.notFound")}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/catalog" className="press inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">{t("home.hero.cta")}</Link>
          <Link href="/" className="press inline-flex min-h-12 items-center rounded-full border border-ink px-6 font-semibold">{t("global.errors.home")}</Link>
        </div>
      </div>
    </main>
  );
}
