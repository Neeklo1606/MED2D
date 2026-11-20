import type { Metadata } from "next";
import { getField as t } from "@/content/registry";
import HeroModel from "@/site/HeroModel";
import { ButtonLink, PageTitle, Section } from "@/site/ui";

export const metadata: Metadata = { title: t("about.seo.title"), alternates: { canonical: "/about" } };

export default function About() {
  return (
    <main>
      <PageTitle title={t("about.hero.title")} lead={t("about.hero.lead")} />
      <Section>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[1, 2, 3].map((n) => (
              <li key={n} className="rounded-[var(--radius-lg)] bg-surface p-5 md:p-6">
                <h2 className="font-display text-base font-bold uppercase">{t(`about.values.v${n}t`)}</h2>
                <p className="mt-2 text-sm text-muted md:text-base">{t(`about.values.v${n}d`)}</p>
              </li>
            ))}
          </ul>
          <div className="relative h-[60svh] min-h-[400px] overflow-hidden rounded-[var(--radius-lg)] bg-surface lg:h-auto"><HeroModel /></div>
        </div>
      </Section>
      <Section title={t("about.production.title")}>
        <p className="max-w-3xl text-base text-muted md:text-lg">{t("about.production.text")}</p>
        <div className="mt-6"><ButtonLink href="/catalog" variant="accent">{t("home.cta.button")}</ButtonLink></div>
      </Section>
    </main>
  );
}
