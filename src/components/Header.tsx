import Link from "next/link";
import { getField } from "@/content/registry";
import CartButton from "./CartButton";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";
import NavLinks from "./NavLinks";
import { NAV } from "./nav";

export default function Header() {
  const nav = NAV();
  return (
    <>
      {/* мобильная шапка: белая плашка с логотипом + круглая корзина */}
      <header className="flex items-center gap-[10px] px-5 pt-[10px] lg:hidden">
        <div className="flex h-[43px] flex-1 items-center justify-between rounded-full bg-surface pl-4 pr-0.5">
          <Link href="/" aria-label="MEDFORM, на главную"><Logo className="text-[15px]" /></Link>
          <MobileMenu items={nav} label={getField("global.nav.menu")} close={getField("global.nav.close")} />
        </div>
        <CartButton label={getField("global.header.cart")} round />
      </header>
      {/* десктоп */}
      {/* 1024–1279: логотип слева, меню, корзина; от 1280: логотип по центру, как в макете */}
      <header className="mx-auto hidden max-w-[1440px] items-center gap-6 px-10 py-4 lg:flex xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-3">
        <Link href="/" className="shrink-0 rounded-[var(--radius-sm)] xl:col-start-2 xl:row-start-1" aria-label="MEDFORM, на главную"><Logo className="text-[22px] xl:text-2xl" /></Link>
        <div className="flex-1 xl:col-start-1 xl:row-start-1"><NavLinks items={nav} /></div>
        <span className="shrink-0 xl:col-start-3 xl:justify-self-end"><CartButton label={getField("global.header.cart")} /></span>
      </header>
    </>
  );
}
