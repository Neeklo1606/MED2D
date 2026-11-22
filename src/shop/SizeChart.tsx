"use client";
import { useEffect, useRef } from "react";
import { getField as t } from "@/content/registry";

const ROWS = [["XS", "84-88", "88-92"], ["S", "88-92", "92-96"], ["M", "92-100", "96-104"], ["L", "100-108", "104-112"], ["XL", "108-116", "112-120"]];

/** Таблица размеров: модальный dialog (фокус внутри, Esc и тап по фону закрывают). */
export default function SizeChart({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const close = () => ref.current?.close();
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="size-chart-title"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="fade-up m-auto w-[min(calc(100vw-32px),440px)] rounded-[var(--radius-lg)] bg-surface p-0 text-ink backdrop:bg-black/45">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="size-chart-title" className="pt-2 font-display text-base uppercase leading-tight">{t("catalog.sizeChart.title")}</h2>
          <button type="button" onClick={close} aria-label={t("catalog.sizeChart.close")} className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full hover:bg-bg">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="mt-2 text-sm leading-snug text-muted">{t("catalog.sizeChart.hint")}</p>
        <table className="mt-4 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="pb-2 font-medium">{t("catalog.sizeChart.colSize")}</th>
              <th scope="col" className="pb-2 font-medium">{t("catalog.sizeChart.colChest")}</th>
              <th scope="col" className="pb-2 font-medium">{t("catalog.sizeChart.colHips")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-t border-line">
                <th scope="row" className="py-2.5 text-left font-semibold">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{t("catalog.sizeChart.note")}</p>
        <button type="button" onClick={close} className="press mt-5 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-white">{t("catalog.sizeChart.close")}</button>
      </div>
    </dialog>
  );
}
