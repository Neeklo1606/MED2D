import type { Metadata } from "next";
import { getField as t } from "@/content/registry";
import { PageTitle, Section } from "@/site/ui";
import QuestionForm from "@/site/QuestionForm";

export const metadata: Metadata = { title: t("contacts.seo.title"), alternates: { canonical: "/contacts" } };

export default function Contacts() {
  return (
    <main>
      <PageTitle title={t("contacts.page.title")} lead={t("contacts.page.lead")} />
      <Section>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-[var(--radius-lg)] bg-ink p-6 text-white lg:self-start">
            <p className="font-display text-2xl font-black">MEDFORM</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-white/60">Часы работы</dt><dd className="mt-0.5 text-base">{t("contacts.info.hours")}</dd></div>
              <div><dt className="text-white/60">Телефон, email, адрес</dt><dd className="mt-0.5 text-white/80">{t("contacts.info.pending")}</dd></div>
            </dl>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-surface p-5 md:p-6">
            <h2 className="font-display text-lg font-black uppercase">{t("contacts.form.title")}</h2>
            <QuestionForm />
          </div>
        </div>
      </Section>
    </main>
  );
}
