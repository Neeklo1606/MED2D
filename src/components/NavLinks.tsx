"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Основное меню" className="hidden lg:block">
      <ul className="flex gap-1">
        {items.map((i) => {
          const on = path === i.href || path.startsWith(i.href + "/");
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${on ? "bg-surface font-semibold" : "text-muted hover:bg-surface/60 hover:text-ink"}`}>{i.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
