import Link from "next/link";
import { getField } from "@/content/registry";
import { demoItems, formatRub } from "@/lib/demo-items";

export const dynamic = "force-static";

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <span key={c + i} className={`size-7 rounded-full border border-line ${i === 0 ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />
      ))}
    </div>
  );
}

function ProductCard({ item }: { item: (typeof demoItems)[number] }) {
  return (
    <article className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex gap-3">
        <div className="size-20 shrink-0 rounded-[var(--radius-md)] bg-bg" aria-hidden />
        <div className="min-w-0">
          <h3 className="font-display text-xs font-bold uppercase leading-snug">{item.title}</h3>
          <p className="mt-1 text-sm font-semibold">{formatRub(item.priceRub)}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-line pt-3">
        <p className="text-xs text-muted">{getField("home.preview.color")}</p>
        <Swatches colors={item.colors} />
        <p className="text-xs text-muted">{getField("home.preview.size")}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.sizes.slice(0, 5).map((s, i) => (
            <span key={s} className={`grid min-h-9 min-w-9 place-items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold ${i === 2 ? "bg-ink text-white" : "border border-line"}`}>{s}</span>
          ))}
        </div>
        <p className="text-xs underline underline-offset-2">{getField("home.preview.details")}</p>
        <span className={`flex min-h-11 items-center justify-center rounded-full text-sm font-semibold ${item.worn ? "border border-ink bg-surface" : "bg-ink text-white"}`}>
          {item.worn ? getField("home.preview.takeOff") : getField("home.preview.tryOn")}
        </span>
      </div>
    </article>
  );
}

export default function Home() {
  const worn = demoItems.filter((i) => i.worn);
  const total = worn.reduce((s, i) => s + i.priceRub, 0);
  return (
    <>
      <main className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-16 md:px-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,340px)]">
        <section className="space-y-6">
          <h1 className="font-display text-3xl font-black uppercase leading-[1.05] md:text-5xl lg:text-[44px]">
            {getField("home.hero.titleStart")} <span className="text-accent">{getField("home.hero.titleAccent")}</span>
          </h1>
          <p className="max-w-md text-base text-muted">{getField("home.hero.subtitle")}</p>
          <div className="rounded-[var(--radius-lg)] bg-accent p-5 text-white">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-sm font-bold uppercase">{getField("home.total.label")}</span>
              <span className="font-display text-2xl font-black">{formatRub(total)}</span>
            </div>
            <ul className="mt-4 divide-y divide-white/25 text-sm">
              {worn.map((i) => (
                <li key={i.slug} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">{i.title}</span>
                  <span className="shrink-0 font-semibold">{formatRub(i.priceRub)}</span>
                </li>
              ))}
            </ul>
            <span className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-ink">{getField("home.total.addAll")}</span>
          </div>
          <div>
            <Link href="/catalog" className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">{getField("home.hero.cta")}</Link>
            <p className="mt-2 text-xs text-muted">{getField("home.hero.ctaNote")}</p>
          </div>
        </section>

        <section aria-label="Превью модели" className="relative min-h-[420px] overflow-hidden rounded-[var(--radius-lg)] md:min-h-[640px]">
          <span aria-hidden className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-[22vw] font-black leading-none text-brandmark lg:text-[180px]">MF</span>
          <svg aria-hidden viewBox="0 0 200 500" className="absolute left-1/2 top-6 h-[85%] -translate-x-1/2">
            <circle cx="100" cy="45" r="28" fill="#d6d7db" />
            <rect x="58" y="80" width="84" height="150" rx="26" fill="#f2a7c3" />
            <rect x="62" y="225" width="36" height="210" rx="16" fill="#f2a7c3" opacity=".9" />
            <rect x="102" y="225" width="36" height="210" rx="16" fill="#f2a7c3" opacity=".9" />
            <rect x="56" y="432" width="44" height="22" rx="10" fill="#9a9ca3" />
            <rect x="100" y="432" width="44" height="22" rx="10" fill="#9a9ca3" />
          </svg>
          <span className="absolute right-4 top-4 inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm">{getField("home.preview.removeAll")}</span>
          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-sm">
            <span className="text-muted">{getField("home.preview.gender")}:</span>
            <span className="grid size-11 place-items-center rounded-full bg-accent font-semibold text-white">Ж</span>
            <span className="grid size-11 place-items-center rounded-full border border-line bg-surface font-semibold">М</span>
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{getField("home.preview.zoom")}:</span>
            <span className="grid size-11 place-items-center rounded-full border border-line bg-surface text-lg">+</span>
            <span className="grid size-11 place-items-center rounded-full border border-line bg-surface text-lg">−</span>
          </div>
        </section>

        <section aria-label="Товары" className="grid gap-4 sm:grid-cols-2 lg:max-h-[760px] lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
          {demoItems.map((i) => <ProductCard key={i.slug} item={i} />)}
        </section>
      </main>
      <footer className="border-t border-line px-4 py-6 text-xs text-muted md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2">
          <span>{getField("global.footer.copyright")}</span>
          <span>{getField("global.footer.dev")}</span>
        </div>
      </footer>
    </>
  );
}
