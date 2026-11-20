import Link from "next/link";
import { getField } from "@/content/registry";
import CartButton from "./CartButton";
import MobileMenu from "./MobileMenu";
import NavLinks from "./NavLinks";
import { NAV } from "./nav";

export default function Header() {
  const nav = NAV();
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 md:px-10 md:py-4">
      <div className="flex items-center gap-2">
        <MobileMenu items={nav} label={getField("global.nav.menu")} close={getField("global.nav.close")} />
        <NavLinks items={nav} />
      </div>
      <Link href="/" className="col-start-2 text-center font-display text-xl font-black tracking-tight md:text-2xl" aria-label="MEDFORM, на главную">MEDFORM</Link>
      <span className="col-start-3 justify-self-end"><CartButton label={getField("global.header.cart")} /></span>
    </header>
  );
}
