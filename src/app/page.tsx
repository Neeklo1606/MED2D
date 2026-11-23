import Link from "next/link";
import { COLORS, formatRub, PRODUCTS } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import HeroModel from "@/site/HeroModel";
import { ButtonLink, Section } from "@/site/ui";
import ProductImage from "@/shop/ProductImage";

export const dynamic = "force-static";

const FEATURED = ["anorak", "joggers", "tshirt", "sabo"];

export default function Home() {
  const featured = FEATURED.map((s) => PRODUCTS.find((p) => p.slug === s)!).filter(Boolean);
  return (
    <main>
      {/* первый экран */}
      <section className="mx-auto grid max-w-[1440px] items-center gap-6 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-10">
        <div className="pt-5 lg:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{t("home.hero.eyebrow")}</p>
          <h1 className="mt-3 font-display text-[28px] font-black uppercase leading-[1.02] min-[390px]:text-[30px] md:text-6xl">
            {t("home.hero.h1Start")} <span className="text-accent">{t("home.hero.h1Accent")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted md:text-lg">{t("home.hero.lead")}</p>
          <div className="mt-6 flex flex-col gap-2.5 min-[400px]:flex-row min-[400px]:flex-wrap">
            <ButtonLink href="/catalog" variant="accent" className="min-[400px]:flex-1 sm:flex-none">{t("home.hero.cta")}</ButtonLink>
            <ButtonLink href="/catalog#all-products" variant="outline" className="min-[400px]:flex-1 sm:flex-none">{t("home.hero.secondary")}</ButtonLink>
          </div>
        </div>
        <div className="relative h-[62svh] min-h-[420px] overflow-hidden rounded-[var(--radius-lg)] lg:h-[720px]">
          <span aria-hidden className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-[46vw] font-black leading-none text-brandmark lg:text-[300px]">MF</span>
          <div className="absolute inset-0"><HeroModel /></div>
        </div>
      </section>

      {/* преимущества */}
      <Section id="features" title={t("home.features.title")}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="rounded-[var(--radius-lg)] bg-surface p-5">
              <span className="grid size-10 place-items-center rounded-full bg-accent font-display text-sm font-black text-white" aria-hidden>{n}</span>
              <h3 className="mt-4 font-display text-sm font-bold uppercase">{t(`home.features.f${n}t`)}</h3>
              <p className="mt-2 text-sm text-muted">{t(`home.features.f${n}d`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* товары */}
      <Section id="featured" title={t("home.products.title")} action={<Link href="/catalog#all-products" className="hidden text-sm underline underline-offset-2 sm:inline">{t("home.products.all")}</Link>}>
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {featured.map((p) => (
            <li key={p.slug}>
              <Link href={`/product/${p.slug}`} className="press press-lg flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-card p-3 transition-colors hover:border-ink/20 md:p-4">
                <div className="aspect-square rounded-[12px] bg-bg p-3" aria-hidden>
                  <ProductImage slug={p.slug} color={p.colors[0]} className="h-full w-full" />
                </div>
                <h3 className="mt-3 font-display text-[12px] font-bold uppercase leading-[1.2] md:text-[13px]">{p.title}</h3>
                <p className="mt-1 text-sm font-semibold">{p.priceRub === null ? <span className="text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/catalog#all-products" className="mt-4 inline-block text-sm underline underline-offset-2 sm:hidden">{t("home.products.all")}</Link>
      </Section>

      {/* о бренде + как заказать */}
      <Section>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] bg-ink p-6 text-white md:p-8">
            <h2 className="font-display text-2xl font-black uppercase md:text-3xl">{t("home.about.title")}</h2>
            <p className="mt-3 max-w-lg text-white/80">{t("home.about.text")}</p>
            <div className="mt-6"><ButtonLink href="/about" variant="light">{t("home.about.link")}</ButtonLink></div>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-surface p-6 md:p-8">
            <h2 className="font-display text-2xl font-black uppercase md:text-3xl">{t("home.buyers.title")}</h2>
            <ol className="mt-4 space-y-3">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">{n}</span><span>{t(`home.buyers.s${n}`)}</span></li>
              ))}
            </ol>
            <Link href="/buyers" className="mt-5 inline-block text-sm underline underline-offset-2">{t("home.buyers.link")}</Link>
          </div>
        </div>
      </Section>

      {/* финальный призыв */}
      <Section>
        <div className="flex flex-col items-start justify-between gap-5 rounded-[var(--radius-lg)] bg-accent p-6 text-white md:flex-row md:items-center md:p-10">
          <h2 className="font-display text-2xl font-black uppercase md:text-4xl">{t("home.cta.title")}</h2>
          <ButtonLink href="/catalog" variant="light">{t("home.cta.button")}</ButtonLink>
        </div>
      </Section>
    </main>
  );
}
