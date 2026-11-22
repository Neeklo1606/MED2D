"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bySlug, COLORS } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { checkoutSchema, fieldErrors, rub } from "@/lib/checkout";
import { useCart, useLook } from "@/configurator/store";
import { toQuery } from "@/configurator/look";
import { useCartHydrated, useQuote } from "./hooks";

type Form = {
  name: string; phone: string; email: string; city: string;
  deliveryMethod: "" | "pickup" | "courier"; address: string; comment: string;
  consentPd: boolean; consentMarketing: boolean; website: string;
};
const EMPTY: Form = { name: "", phone: "", email: "", city: "", deliveryMethod: "pickup", address: "", comment: "", consentPd: false, consentMarketing: false, website: "" };
const DRAFT = "medform-checkout-draft";
const ORDER: (keyof Form | "items" | "form")[] = ["items", "name", "phone", "email", "city", "deliveryMethod", "address", "consentPd", "form"];

function loadDraft(): Form {
  try {
    const raw = sessionStorage.getItem(DRAFT);
    // согласия не восстанавливаем: их ставят заново
    return raw ? { ...EMPTY, ...JSON.parse(raw), consentPd: false, consentMarketing: false, website: "" } : EMPTY;
  } catch { return EMPTY; }
}

function Field({ id, label, optional, error, hint, children }: { id: string; label: string; optional?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted">{optional ? t("checkout.field.optional") : t("checkout.field.required")}</span>
      </label>
      {hint && <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

const inputCls = (err?: string) =>
  `block min-h-12 w-full rounded-[var(--radius-md)] border bg-surface px-4 text-base outline-none focus:border-ink ${err ? "border-red-600" : "border-line"}`;

export default function CheckoutView() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const items = useCart((s) => s.items);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const { quote } = useQuote(items, hydrated && items.length > 0, form.city);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { setForm(loadDraft()); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    const { consentPd: _a, consentMarketing: _b, website: _c, ...draft } = form;
    try { sessionStorage.setItem(DRAFT, JSON.stringify(draft)); } catch { /* приватный режим */ }
  }, [form]);

  const parsed = checkoutSchema.safeParse({ ...form, items });
  const clientErrors = parsed.success ? {} : fieldErrors(parsed.error);
  const err = (k: keyof Form) => serverErrors[k] ?? (touched[k] ? clientErrors[k] : undefined);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => { const n = { ...e }; delete n[k]; delete n.form; return n; });
  };
  const blur = (k: keyof Form) => () => setTouched((x) => ({ ...x, [k]: true }));
  const a11y = (k: keyof Form, hint?: boolean) => ({
    id: k, name: k, "aria-invalid": !!err(k) || undefined,
    "aria-describedby": [hint ? `${k}-hint` : "", err(k) ? `${k}-error` : ""].filter(Boolean).join(" ") || undefined,
    onBlur: blur(k),
  });

  const lines = quote && quote.lines.length === items.length ? quote.lines : null;
  const method = quote?.delivery.find((d) => d.id === form.deliveryMethod);
  // до ответа сервера показываем цены каталога, чтобы итог не «мигал»
  const localItemsKop = items.reduce((sum, it) => sum + (bySlug.get(it.slug)?.priceRub ?? 0) * 100 * it.qty, 0);
  const itemsKop = quote?.itemsTotalKop ?? localItemsKop;
  const totalKop = itemsKop + (method?.priceKop ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])));
    if (!parsed.success) {
      const first = ORDER.find((k) => clientErrors[k]);
      requestAnimationFrame(() => (first && first !== "items" ? document.getElementById(first)?.focus() : errorBox.current?.focus()));
      return;
    }
    setSending(true);
    try {
      const look = toQuery(useLook.getState().look);
      const utm = Object.fromEntries([...new URLSearchParams(window.location.search)].filter(([k]) => k.startsWith("utm_")));
      const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, items, look, utm }) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 201) {
        useCart.getState().clear();
        try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
        router.replace(data.redirectUrl);
        return;
      }
      setServerErrors(data.errors ?? { form: "Не удалось отправить заявку. Попробуйте ещё раз." });
      requestAnimationFrame(() => errorBox.current?.focus());
    } catch {
      setServerErrors({ form: "Нет соединения. Проверьте интернет: введённые данные сохранены." });
      requestAnimationFrame(() => errorBox.current?.focus());
    } finally {
      setSending(false);
    }
  }

  if (hydrated && !items.length) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-surface p-8 text-center">
        <h2 className="font-display text-lg font-bold uppercase">{t("cart.empty.title")}</h2>
        <Link href="/catalog" className="press mt-5 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">{t("cart.empty.cta")}</Link>
      </div>
    );
  }

  const topErrors = Object.entries(serverErrors).filter(([k]) => k === "form" || k === "items");

  return (
    <form noValidate onSubmit={submit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="space-y-6">
        {topErrors.length > 0 && (
          <div ref={errorBox} tabIndex={-1} role="alert" className="rounded-[var(--radius-md)] border border-red-600 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">{t("checkout.errors.title")}</p>
            {topErrors.map(([k, v]) => <p key={k} className="mt-1">{v}</p>)}
          </div>
        )}

        <fieldset className="space-y-4 rounded-[var(--radius-lg)] bg-surface p-5">
          <legend className="float-left mb-3 font-display text-sm font-bold uppercase">{t("checkout.section.contacts")}</legend>
          <div className="clear-both space-y-4">
            <Field id="name" label={t("checkout.field.name")} error={err("name")}>
              <input {...a11y("name")} className={inputCls(err("name"))} autoComplete="name" enterKeyHint="next" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field id="phone" label={t("checkout.field.phone")} error={err("phone")}>
              <input {...a11y("phone")} className={inputCls(err("phone"))} type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" placeholder="+7 900 000-00-00" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field id="email" label={t("checkout.field.email")} error={err("email")}>
              <input {...a11y("email")} className={inputCls(err("email"))} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false} enterKeyHint="next" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-[var(--radius-lg)] bg-surface p-5">
          <legend className="float-left mb-3 font-display text-sm font-bold uppercase">{t("checkout.section.delivery")}</legend>
          <div className="clear-both space-y-4">
            <Field id="city" label={t("checkout.field.city")} error={err("city")}>
              <input {...a11y("city")} className={inputCls(err("city"))} autoComplete="address-level2" enterKeyHint="next" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <div role="radiogroup" aria-labelledby="method-label" id="deliveryMethod" tabIndex={-1}>
              <p id="method-label" className="text-sm font-semibold">{t("checkout.field.method")}</p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {(quote?.delivery ?? [{ id: "pickup", label: "Пункт выдачи СДЭК", priceKop: null, note: "" }, { id: "courier", label: "Курьер до двери", priceKop: null, note: "" }]).map((d) => (
                  <label key={d.id} className={`press flex min-h-14 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3 ${form.deliveryMethod === d.id ? "border-ink ring-1 ring-ink" : "border-line"}`}>
                    <input type="radio" name="deliveryMethod" value={d.id} checked={form.deliveryMethod === d.id} onChange={() => set("deliveryMethod", d.id)} className="mt-1 size-4 accent-[var(--color-accent)]" />
                    <span className="text-sm">
                      <span className="block font-semibold">{d.label}</span>
                      <span className="block text-xs text-muted">{d.priceKop === null ? d.note : `${rub(d.priceKop)} · ${d.note}`}</span>
                    </span>
                  </label>
                ))}
              </div>
              {err("deliveryMethod") && <p className="mt-1 text-sm text-red-700">{err("deliveryMethod")}</p>}
            </div>
            <Field id="address" label={t("checkout.field.address")} hint={t("checkout.field.addressHint")} error={err("address")}>
              <input {...a11y("address", true)} className={inputCls(err("address"))} autoComplete="street-address" enterKeyHint="next" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-[var(--radius-lg)] bg-surface p-5">
          <legend className="float-left mb-3 font-display text-sm font-bold uppercase">{t("checkout.section.comment")}</legend>
          <div className="clear-both">
            <Field id="comment" label={t("checkout.field.comment")} optional>
              <textarea id="comment" name="comment" rows={3} className={`${inputCls()} py-3`} enterKeyHint="done" value={form.comment} onChange={(e) => set("comment", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        {/* honeypot */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Сайт<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} /></label>
        </div>

        <div className="space-y-3 rounded-[var(--radius-lg)] bg-surface p-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" id="consentPd" checked={form.consentPd} onChange={(e) => set("consentPd", e.target.checked)} onBlur={blur("consentPd")}
              aria-invalid={!!err("consentPd") || undefined} aria-describedby={err("consentPd") ? "consentPd-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
            <span>
              {t("checkout.consent.pdBefore")} <Link href="/legal/consent" className="underline" target="_blank">{t("checkout.consent.pdLink")}</Link> {t("checkout.consent.pdAfter")}{" "}
              <Link href="/legal/offer" className="underline" target="_blank">{t("checkout.consent.offerLink")}</Link>
            </span>
          </label>
          {err("consentPd") && <p id="consentPd-error" className="text-sm text-red-700">{err("consentPd")}</p>}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
            <span>{t("checkout.consent.marketing")}</span>
          </label>
        </div>
      </div>

      <aside className="mt-6 lg:sticky lg:top-4 lg:mt-0 lg:self-start">
        <div className="rounded-[var(--radius-lg)] bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-bold uppercase">{t("checkout.summary.title")}</h2>
            <Link href="/cart" className="-my-3 inline-flex min-h-11 items-center text-sm underline underline-offset-2">{t("checkout.summary.edit")}</Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 size-3 shrink-0 rounded-full border border-line" style={{ background: COLORS[it.color]?.hex }} />
                <span className="min-w-0 flex-1">{lines?.[i]?.title ?? bySlug.get(it.slug)?.title ?? it.slug}<span className="block text-xs text-muted">{COLORS[it.color]?.name}{it.size ? `, ${it.size}` : ""} · {it.qty} шт.</span></span>
                <span className="shrink-0 tabular-nums">{(() => { const k = lines?.[i] ? lines[i].priceKop : (bySlug.get(it.slug)?.priceRub ?? null) === null ? null : bySlug.get(it.slug)!.priceRub! * 100; return k === null ? "—" : rub(k * it.qty); })()}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt>{t("cart.summary.items")}</dt><dd className="tabular-nums">{rub(itemsKop)}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t("cart.summary.delivery")}</dt><dd className="text-right text-muted">{method?.priceKop != null ? rub(method.priceKop) : "сообщит менеджер"}</dd></div>
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-display text-sm font-bold uppercase">{t("cart.summary.total")}</span>
            <span className="font-display text-2xl font-black tabular-nums">{rub(totalKop)}</span>
          </div>
          <p className="mt-2 text-xs text-muted">{t("cart.summary.payNote")}</p>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none lg:mt-4 lg:border-0 lg:p-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
            <button type="submit" disabled={sending} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-semibold text-white disabled:opacity-70">
              {sending ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />{t("checkout.form.sending")}</> : <>{t("checkout.form.submit")}{quote && <span className="tabular-nums opacity-90">· {rub(totalKop)}</span>}</>}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}
