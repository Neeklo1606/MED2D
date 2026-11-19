import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getField } from "@/content/registry";

const DOCS: Record<string, string> = {
  offer: "Публичная оферта",
  privacy: "Политика обработки персональных данных",
  consent: "Согласие на обработку персональных данных",
  cookies: "Политика использования cookies",
  requisites: "Реквизиты продавца",
};

export function generateStaticParams() { return Object.keys(DOCS).map((doc) => ({ doc })); }

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc] ?? "Документ" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const title = DOCS[doc];
  if (!title) notFound();
  return (
    <main className="mx-auto max-w-[720px] px-4 pb-16 pt-2 md:px-10">
      <h1 className="font-display text-2xl font-black uppercase">{title}</h1>
      <p className="mt-4 rounded-[var(--radius-md)] bg-surface p-5 text-sm">{getField("legal.pending.text")}</p>
    </main>
  );
}
