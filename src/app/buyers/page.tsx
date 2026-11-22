import type { Metadata } from "next";
import Link from "next/link";
import { getField as t } from "@/content/registry";
import { PageTitle, Section } from "@/site/ui";

export const metadata: Metadata = { title: t("buyers.seo.title"), alternates: { canonical: "/buyers" } };

const BLOCKS = [
  { id: "delivery", n: "01" },
  { id: "payment", n: "02" },
  { id: "returns", n: "03" },
] as const;

export default function Buyers() {
  return (
    <main>
      <PageTitle title={t("buyers.page.title")} />
      <nav aria-label="Разделы" className="mx-auto mt-4 flex max-w-[1440px] gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:px-10">
        {[...BLOCKS.map((b) => ({ id: b.id, label: t(`buyers.${b.id}.title`) })), { id: "faq", label: t("buyers.faq.title") }].map((x) => (
          <a key={x.id} href={`#${x.id}`} className="press inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold">{x.label}</a>
        ))}
      </nav>
      <Section>
        <div className="grid gap-3 lg:grid-cols-3">
          {BLOCKS.map((b) => (
            <article key={b.id} id={b.id} className="scroll-mt-4 rounded-[var(--radius-lg)] bg-surface p-6">
              <p className="font-display text-sm font-black text-accent">{b.n}</p>
              <h2 className="mt-2 font-display text-xl font-black uppercase">{t(`buyers.${b.id}.title`)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">{t(`buyers.${b.id}.text`)}</p>
            </article>
          ))}
        </div>
      </Section>
      <Section id="faq" title={t("buyers.faq.title")}>
        <div className="divide-y divide-line rounded-[var(--radius-lg)] bg-surface">
          {[1, 2, 3, 4].map((n) => (
            <details key={n} className="group px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold">
                {t(`buyers.faq.q${n}`)}
                <span aria-hidden className="text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-sm text-muted md:text-base">{t(`buyers.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link href="/contacts" className="underline underline-offset-2">{t("contacts.form.title")}</Link>
        </p>
      </Section>
    </main>
  );
}
