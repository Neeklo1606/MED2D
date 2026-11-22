"use client";
import Link from "next/link";
import { COLORS, bySlug } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { rub } from "@/lib/checkout";
import { useCart } from "@/configurator/store";
import { emptyLook, toQuery, wear } from "@/configurator/look";
import { useCartHydrated, useQuote } from "./hooks";
import ProductImage from "./ProductImage";

export function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line" role="group" aria-label={label}>
      <button type="button" className="press grid size-11 place-items-center text-lg" aria-label="Меньше" disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="press grid size-11 place-items-center text-lg" aria-label="Больше" disabled={value >= 20} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-surface" />)}
    </div>
  );
}

export default function CartView() {
  const hydrated = useCartHydrated();
  const items = useCart((s) => s.items);
  const { setQty, setSize, setColor, removeAt } = useCart.getState();
  const { quote, error } = useQuote(items, hydrated && items.length > 0);
  const lines = quote && quote.lines.length === items.length ? quote.lines : null;
  const hasErrors = !!lines?.some((l) => l.error);
  const count = items.reduce((n, i) => n + i.qty, 0);
  // Образ на модели из вещей корзины (по одной на слот, последняя побеждает)
  const lookFromCart = items.reduce((l, it) => (bySlug.get(it.slug)?.model ? wear(l, { slug: it.slug, color: it.color, size: it.size }) : l), emptyLook("f"));
  const lookHref = Object.keys(lookFromCart.slots).length ? `/catalog?${toQuery(lookFromCart)}` : null;
  // Пока сервер не ответил (или недоступен), показываем цены каталога: без «скелетов» и прыжков вёрстки.
  // Оформление всё равно доступно только после пересчёта на сервере.
  const localKop = (slug: string) => { const r = bySlug.get(slug)?.priceRub; return r == null ? null : r * 100; };
  const itemsKop = lines ? quote!.itemsTotalKop : items.reduce((s, it) => s + (localKop(it.slug) ?? 0) * it.qty, 0);

  if (!hydrated) return <CartSkeleton />;
  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-surface p-8 text-center">
        <h2 className="font-display text-lg font-bold uppercase">{t("cart.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("cart.empty.text")}</p>
        <Link href="/catalog" className="press mt-5 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">{t("cart.empty.cta")}</Link>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <ul className="space-y-3">
        {items.map((it, i) => {
          const p = bySlug.get(it.slug);
          const q = lines?.[i];
          const sizes = q?.sizes.length ? q.sizes : p?.sizes ?? [];
          return (
            <li key={`${it.slug}-${it.color}-${it.size}`} className="rounded-[var(--radius-lg)] bg-surface p-4">
              <div className="flex gap-3">
                <Link href={`/product/${it.slug}`} tabIndex={-1} aria-hidden className="size-16 shrink-0 rounded-[var(--radius-md)] bg-bg p-1 md:size-20">
                  <ProductImage slug={it.slug} color={it.color} className="h-full w-full" />
                </Link>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[12px] font-bold uppercase leading-snug md:text-[13px]">{q?.title ?? p?.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">{COLORS[it.color]?.name}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {(() => { const k = q ? q.priceKop : localKop(it.slug); return k === null ? <span className="font-normal text-muted">{t("catalog.card.pricePending")}</span> : rub(k * it.qty); })()}
                  </p>
                </div>
                <button type="button" onClick={() => removeAt(i)} className="press -mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted" aria-label={`${t("cart.line.remove")}: ${q?.title ?? p?.title}`}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                </button>
              </div>
              {p && p.colors.length > 1 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-xs text-muted">{t("catalog.card.color")}: <span className="text-ink">{COLORS[it.color]?.name}</span></p>
                  <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="-mx-1.5 mt-1 flex flex-wrap">
                    {p.colors.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={it.color === c} aria-label={COLORS[c].name} onClick={() => setColor(i, c)} className="grid size-10 place-items-center rounded-full">
                        <span className={`size-7 rounded-full ${c === "white" || c === "silver" ? "border border-line" : ""} ${it.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: COLORS[c].hex }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                {sizes.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted">{t("cart.line.size")}{!it.size && <span className="font-semibold text-red-700"> · {t("catalog.card.sizeMissing")}</span>}</p>
                    <div role="radiogroup" aria-label={`${t("cart.line.size")}: ${q?.title ?? p?.title}`} className="mt-1 flex flex-wrap gap-1.5">
                      {sizes.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={it.size === s} onClick={() => setSize(i, s)}
                          className={`press grid min-h-11 min-w-11 place-items-center rounded-full px-2.5 text-[13px] font-semibold tabular-nums ${it.size === s ? "bg-ink text-white" : !it.size ? "border border-red-600/60" : "border border-line"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                ) : <span />}
                <Stepper value={it.qty} onChange={(v) => setQty(i, v)} label={`Количество: ${q?.title ?? p?.title}`} />
              </div>
              {q?.error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{q.error}</p>}
            </li>
          );
        })}
      </ul>

      <aside className="mt-4 lg:mt-0 lg:self-start lg:sticky lg:top-4">
        {lookHref && (
          <Link href={lookHref} className="press mb-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-ink bg-surface text-sm font-semibold">{t("cart.page.viewLook")}</Link>
        )}
        <div className="rounded-[var(--radius-lg)] bg-surface p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>{t("cart.summary.items")}, {count} шт.</dt><dd className="tabular-nums">{rub(itemsKop)}</dd></div>
            <div className="flex justify-between"><dt>{t("cart.summary.delivery")}</dt><dd className="text-muted">по тарифу СДЭК</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">{t("cart.summary.deliveryNote")}</p>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-display text-sm font-bold uppercase">{t("cart.summary.total")}</span>
            <span className="font-display text-2xl font-black tabular-nums">{rub(itemsKop)}</span>
          </div>
          <p className="mt-2 text-xs text-muted">{t("cart.summary.payNote")}</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {hasErrors && <p className="mt-3 text-sm font-semibold text-red-700">{t("cart.summary.fix")}</p>}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none lg:mt-4 lg:border-0 lg:p-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
            <Link href="/checkout" aria-disabled={hasErrors || !lines} onClick={(e) => (hasErrors || !lines) && e.preventDefault()}
              className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white ${hasErrors || !lines ? "bg-muted" : "bg-accent"}`}>
              {t("cart.summary.cta")}{lines && !hasErrors && <span className="tabular-nums opacity-90">· {rub(quote!.itemsTotalKop)}</span>}
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
