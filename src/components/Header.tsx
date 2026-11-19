import Link from "next/link";
import { getField } from "@/content/registry";
import CartButton from "./CartButton";

export default function Header() {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 md:px-10 md:py-4">
      <span className="hidden text-sm text-muted sm:block">{getField("global.header.tagline")}</span>
      <Link href="/" className="col-start-2 text-center font-display text-xl font-black tracking-tight md:text-2xl">MEDFORM</Link>
      <span className="col-start-3 justify-self-end"><CartButton label={getField("global.header.cart")} /></span>
    </header>
  );
}
