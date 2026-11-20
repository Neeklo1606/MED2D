"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function MobileMenu({ items, label, close }: { items: { href: string; label: string }[]; label: string; close: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  useEffect(() => { setOpen(false); }, [path]); // eslint-disable-line react-hooks/set-state-in-effect
  return (
    <>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full lg:hidden">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} className="m-0 h-dvh max-h-none w-[min(86vw,360px)] max-w-none bg-surface p-0 backdrop:bg-black/40">
        <div className="flex items-center justify-between px-5 py-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}>
          <span className="font-display text-lg font-black">MEDFORM</span>
          <button type="button" aria-label={close} onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <nav className="px-3">
          <ul>
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={path === i.href ? "page" : undefined} className={`press flex min-h-14 items-center rounded-[var(--radius-md)] px-3 font-display text-lg font-bold uppercase ${path === i.href ? "text-accent" : ""}`}>{i.label}</Link>
              </li>
            ))}
            <li><Link href="/cart" className="press flex min-h-14 items-center rounded-[var(--radius-md)] px-3 font-display text-lg font-bold uppercase">Корзина</Link></li>
          </ul>
        </nav>
      </dialog>
    </>
  );
}
