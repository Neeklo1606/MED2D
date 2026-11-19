import type { Metadata } from "next";
import Link from "next/link";
import { getField as t } from "@/content/registry";
import { rub } from "@/lib/checkout";
import { getOrderByToken } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: t("order.seo.title"), robots: { index: false, follow: false } };

const STATUS: Record<string, string> = {
  new: "Новая", in_progress: "В работе", contacted: "Менеджер связался", confirmed: "Подтверждена", shipped: "Отправлена",
  completed: "Выполнена", cancelled: "Отменена", awaiting_payment: "Ожидает оплаты", paid: "Оплачена", refunded: "Возврат",
};

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await getOrderByToken(token);
  if (!o) {
    return <main className="mx-auto max-w-xl px-4 py-16 text-center"><p>{t("order.page.notFound")}</p><Link href="/" className="press mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-white">На главную</Link></main>;
  }
  const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Moscow" }).format(o.createdAt);
  return (
    <main className="mx-auto max-w-[720px] px-4 pb-16 pt-2 md:px-10">
      <div className="rounded-[var(--radius-lg)] bg-accent p-6 text-white">
        <div className="flex size-12 items-center justify-center rounded-full bg-white/20" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h1 className="mt-4 font-display text-2xl font-black uppercase">{t("order.page.title")}</h1>
        <p className="mt-1 text-sm opacity-90">{t("order.page.number")}: <strong className="font-display text-base">{o.number}</strong> · {date}</p>
        <p className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{STATUS[o.status] ?? o.status}</p>
      </div>

      <section className="mt-4 rounded-[var(--radius-lg)] bg-surface p-5">
        <h2 className="font-display text-sm font-bold uppercase">{t("order.next.title")}</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {[t("order.next.step1"), t("order.next.step2"), t("order.next.step3")].map((s, i) => (
            <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-[var(--radius-lg)] bg-surface p-5">
        <ul className="space-y-2 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>{i.titleSnapshot}<span className="block text-xs text-muted">{i.colorSnapshot}{i.sizeSnapshot ? `, ${i.sizeSnapshot}` : ""} · {i.qty} шт.</span></span>
              <span className="tabular-nums">{rub(i.priceSnapshotKop * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Товары</dt><dd className="tabular-nums">{rub(o.itemsTotalKop)}</dd></div>
          <div className="flex justify-between"><dt>Доставка</dt><dd className="text-muted">{o.deliveryKop === null ? "сообщит менеджер" : rub(o.deliveryKop)}</dd></div>
          <div className="flex justify-between pt-1 font-semibold"><dt>Итого</dt><dd className="tabular-nums">{rub(o.totalKop)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">{o.deliveryMethod === "courier" ? "Курьер" : "Пункт выдачи"}: {o.city}, {o.address}</p>
      </section>

      <p className="mt-4 text-sm text-muted">{t("order.page.saveLink")}</p>
      <Link href="/catalog" className="press mt-4 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">{t("order.page.continue")}</Link>
    </main>
  );
}
