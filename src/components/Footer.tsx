import Link from "next/link";
import { getField } from "@/content/registry";
import { LEGAL, NAV } from "./nav";

export default function Footer() {
  return (
    <footer className="mt-8 bg-ink text-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr_1.4fr] md:px-10" style={{ paddingBottom: "max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))" }}>
        <div>
          <p className="font-display text-2xl font-black">MEDFORM</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">Medicine inside</p>
          <p className="mt-4 max-w-xs text-sm text-white/75">{getField("global.footer.about")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{getField("global.footer.shop")}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {NAV().map((i) => <li key={i.href}><Link href={i.href} className="inline-flex min-h-10 items-center hover:underline">{i.label}</Link></li>)}
            <li><Link href="/cart" className="inline-flex min-h-10 items-center hover:underline">{getField("global.header.cart")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{getField("global.footer.legal")}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {LEGAL.map((i) => <li key={i.href}><Link href={i.href} className="inline-flex min-h-10 items-center hover:underline">{i.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{getField("global.footer.seller")}</p>
          <p className="mt-3 rounded-[var(--radius-md)] border border-white/20 p-3 text-sm text-white/75">{getField("global.footer.requisitesPending")}</p>
          <p className="mt-3 text-sm text-white/75">{getField("contacts.info.hours")}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 px-5 py-4 text-xs text-white/50 md:px-10">
          <span>{getField("global.footer.copyright")}</span>
          <span>{getField("global.footer.dev")}</span>
        </div>
      </div>
    </footer>
  );
}
