"use client";
import Link from "next/link";
import { useState } from "react";
import { getField as t } from "@/content/registry";

export default function QuestionForm() {
  const [f, setF] = useState({ name: "", contact: "", message: "", consentPd: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const set = (k: keyof typeof f, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "question", ...f }) });
      if (r.status === 201) { setState("sent"); return; }
      const d = await r.json().catch(() => ({}));
      setErrors(d.errors ?? { form: "Не удалось отправить. Попробуйте ещё раз." });
    } catch { setErrors({ form: "Нет соединения. Текст сохранён, попробуйте ещё раз." }); }
    setState("idle");
  }

  if (state === "sent") return <p role="status" className="mt-4 rounded-[var(--radius-md)] bg-bg p-4 font-semibold">{t("contacts.form.sent")}</p>;
  const input = (k: string) => `mt-1.5 block min-h-12 w-full rounded-[var(--radius-md)] border bg-surface px-4 text-base outline-none focus:border-ink ${errors[k] ? "border-red-600" : "border-line"}`;
  return (
    <form noValidate onSubmit={submit} className="mt-4 space-y-4">
      <div>
        <label htmlFor="q-name" className="text-sm font-semibold">{t("contacts.form.name")}</label>
        <input id="q-name" autoComplete="name" className={input("name")} value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name || undefined} />
        {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="q-contact" className="text-sm font-semibold">{t("contacts.form.contact")}</label>
        <input id="q-contact" autoComplete="tel" inputMode="email" className={input("contact")} value={f.contact} onChange={(e) => set("contact", e.target.value)} aria-invalid={!!errors.contact || undefined} />
        {errors.contact && <p className="mt-1 text-sm text-red-700">{errors.contact}</p>}
      </div>
      <div>
        <label htmlFor="q-message" className="text-sm font-semibold">{t("contacts.form.message")}</label>
        <textarea id="q-message" rows={4} className={`${input("message")} py-3`} value={f.message} onChange={(e) => set("message", e.target.value)} aria-invalid={!!errors.message || undefined} />
        {errors.message && <p className="mt-1 text-sm text-red-700">{errors.message}</p>}
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></div>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={f.consentPd} onChange={(e) => set("consentPd", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
        <span>{t("checkout.consent.pdBefore")} <Link href="/legal/consent" className="underline" target="_blank">{t("checkout.consent.pdLink")}</Link></span>
      </label>
      {errors.consentPd && <p className="text-sm text-red-700">{errors.consentPd}</p>}
      {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}
      <button type="submit" disabled={state === "sending"} className="press flex min-h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-white disabled:opacity-70">{state === "sending" ? t("checkout.form.sending") : t("contacts.form.submit")}</button>
    </form>
  );
}
