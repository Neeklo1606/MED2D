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
      <header className="hidden grid-cols-[1fr_auto_1fr] items-center gap-3 px-10 py-4 lg:grid">
        <NavLinks items={nav} />
        <Link href="/" className="col-start-2" aria-label="MEDFORM, на главную"><Logo className="text-2xl" /></Link>
        <span className="col-start-3 justify-self-end"><CartButton label={getField("global.header.cart")} /></span>
      </header>
    </>
  );
}
