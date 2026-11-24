import Link from "next/link";
import { getField } from "@/content/registry";
import CartButton from "./CartButton";
import Logo from "./Logo";

/** Шапка по макету «Конфигуратор итог»: телефон — белая плашка с логотипом и круглая корзина; десктоп — подпись, логотип по центру, «Корзина». */
export default function Header() {
  return (
    <>
      <header className="flex items-center gap-[10px] px-5 pt-[10px] md:px-10 lg:hidden">
        <Link href="/catalog" aria-label={getField("global.header.home")} className="flex h-11 flex-1 items-center rounded-full bg-surface pl-[17px]">
          <Logo className="h-[9.5px] w-auto" />
        </Link>
        <CartButton label={getField("global.header.cart")} round />
      </header>
      <header className="relative mx-auto hidden h-[68px] max-w-[1440px] items-center justify-between px-6 lg:flex">
        <Link href="/catalog" className="text-[13px] leading-none text-accent">{getField("global.header.tagline")}</Link>
        <Link href="/catalog" aria-label={getField("global.header.home")} className="absolute left-1/2 top-[26px] -translate-x-1/2">
          <Logo className="h-[15.4px] w-auto" />
        </Link>
        <CartButton label={getField("global.header.cart")} />
      </header>
    </>
  );
}
