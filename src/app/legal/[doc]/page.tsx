import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getField } from "@/content/registry";
import { LEGAL } from "@/components/nav";
import { PageTitle, Section } from "@/site/ui";

const DOCS = Object.fromEntries(LEGAL.map((d) => [d.href.split("/").pop()!, d.label]));

export function generateStaticParams() { return Object.keys(DOCS).map((doc) => ({ doc })); }

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc] ?? "Документ", alternates: { canonical: `/legal/${doc}` } };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const title = DOCS[doc];
  if (!title) notFound();
  return (
    <main>
      <PageTitle title={title} />
      <Section>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-[var(--radius-lg)] bg-surface p-6 text-sm md:text-base">
            <p className="rounded-[var(--radius-md)] bg-bg p-4">{getField("legal.pending.text")}</p>
          </article>
          <nav aria-label="Документы" className="rounded-[var(--radius-lg)] bg-surface p-3">
            <ul>
              {LEGAL.map((d) => (
                <li key={d.href}>
                  <Link href={d.href} aria-current={d.href.endsWith(`/${doc}`) ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm ${d.href.endsWith(`/${doc}`) ? "bg-bg font-semibold" : "text-muted hover:text-ink"}`}>{d.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Section>
    </main>
  );
}
