"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bySlug, COLORS, formatRub, PRODUCTS, type Product, type Slot } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { fromQuery, missingSizes, toQuery, total, wornList } from "./look";
import { DEFAULT_LOOK, useCart, useLook, useToast } from "./store";
import PhotoRenderer, { PHOTO_PART, PhotoThumb } from "./renderers/PhotoRenderer";
import { detectRenderer, type LookRendererHandle, type RendererKind } from "./renderers/types";

const ThreeRenderer = dynamic(() => import("./renderers/ThreeRenderer"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">3D…</div>,
});

/* ---------- состояние страницы ---------- */

function useUrlSync() {
  const setLook = useLook((s) => s.setLook);
  const look = useLook((s) => s.look);
  const ready = useRef(false);
  useEffect(() => {
    const parsed = fromQuery(window.location.search);
    setLook(Object.keys(parsed.slots).length ? parsed : { ...DEFAULT_LOOK, gender: parsed.gender });
    ready.current = true;
  }, [setLook]);
  useEffect(() => {
    if (!ready.current) return;
    const id = setTimeout(() => window.history.replaceState(null, "", `?${toQuery(look)}`), 300);
    return () => clearTimeout(id);
  }, [look]);
}

function focusCard(slug: string) {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-card="${slug}"]`)].find((e) => e.offsetParent !== null);
  el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}

function useActions() {
  const add = useCart((s) => s.add);
  const toast = useToast((s) => s.show);
  const setInvalid = useLook((s) => s.setInvalid);
  const flag = (slots: Slot[]) => {
    setInvalid(slots);
    const first = wornList(useLook.getState().look).find((x) => slots.includes(x.slot));
    if (first) requestAnimationFrame(() => focusCard(first.product.slug));
    toast(t("catalog.toast.needSizes"));
  };
  const addAll = () => {
    const look = useLook.getState().look;
    const miss = missingSizes(look);
    if (miss.length) return flag(miss);
    const list = wornList(look);
    const priced = list.filter((x) => x.product.priceRub !== null);
    if (priced.length) add(priced.map((x) => ({ slug: x.worn.slug, color: x.worn.color, size: x.worn.size })));
    toast(priced.length < list.length ? t("catalog.toast.pending") : t("catalog.toast.addedLook"));
  };
  const addOne = (slot: Slot) => {
    const x = wornList(useLook.getState().look).find((w) => w.slot === slot);
    if (!x) return;
    if (x.product.sizes.length && !x.worn.size) return flag([slot]);
    if (x.product.priceRub === null) return toast(t("catalog.toast.pending"));
    add([{ slug: x.worn.slug, color: x.worn.color, size: x.worn.size }]);
    toast(t("catalog.toast.added"));
  };
  /** Одна вещь из карточки (в том числе не надетая и без модели). false = нужен размер. */
  const addItem = (slug: string) => {
    const p = bySlug.get(slug);
    const pick = useLook.getState().picks[slug];
    if (!p || !pick) return true;
    if (p.sizes.length && !pick.size) { toast(t("catalog.card.sizeMissing")); return false; }
    if (p.priceRub === null) { toast(t("catalog.toast.pending")); return true; }
    add([{ slug, color: pick.color, size: pick.size }]);
    toast(t("catalog.toast.added"));
    return true;
  };
  return { addAll, addOne, addItem };
}

/* ---------- иконки ---------- */

function IconCart({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M2 3.5h2.6l2.3 10.6c.1.6.7 1 1.3 1h9.6c.6 0 1.1-.4 1.3-1L21 6.5H6.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="9" cy="19.5" r="1.8" /><circle cx="17.5" cy="19.5" r="1.8" />
    </svg>
  );
}
const IconX = () => <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>;

/** Фирменный знак за моделью (крупная кавычка MEDFORM). */
function BrandMark() {
  return (
    <svg viewBox="0 0 170 100" aria-hidden className="pointer-events-none absolute left-1/2 top-[18%] w-[78%] -translate-x-1/2 text-brandmark">
      <path d="M0 100V46A46 46 0 0 1 46 0h78a46 46 0 0 1 46 46v26h-36V48a12 12 0 0 0-12-12H48a12 12 0 0 0-12 12v52z" fill="currentColor" />
      <rect x="62" y="56" width="46" height="44" rx="4" fill="currentColor" />
    </svg>
  );
}

/* ---------- управление моделью ---------- */

function SquareBtn({ on, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" {...rest}
      className={`grid size-9 place-items-center rounded-[11px] text-[15px] font-medium disabled:opacity-40 lg:size-11 lg:rounded-[13px] lg:text-base ${on ? "bg-accent text-white" : "border border-line bg-surface"} ${className}`} />
  );
}

function Controls({ stage }: { stage: React.RefObject<LookRendererHandle | null> }) {
  const gender = useLook((s) => s.look.gender);
  const setGender = useLook((s) => s.setGender);
  return (
    <div className="pointer-events-none flex items-start justify-between gap-4 [&_button]:pointer-events-auto">
      <div>
        <p className="mb-[9px] text-[14px] text-muted">{t("catalog.stage.gender")}</p>
        <div className="flex gap-[6px]">
          {(["f", "m"] as const).map((g) => (
            <SquareBtn key={g} on={gender === g} aria-pressed={gender === g} aria-label={g === "f" ? "Женская модель" : "Мужская модель"} onClick={() => setGender(g)}>{g === "f" ? "Ж" : "М"}</SquareBtn>
          ))}
        </div>
      </div>
      <div className="text-right">
        <p className="mb-[9px] text-[14px] text-muted">{t("catalog.stage.zoom")}</p>
        <div className="flex gap-2">
          <SquareBtn aria-label="Приблизить" onClick={() => stage.current?.zoomIn()} className="text-accent"><span className="text-[22px] font-light leading-none">+</span></SquareBtn>
          <SquareBtn aria-label="Отдалить" onClick={() => stage.current?.zoomOut()} className="text-muted"><span className="text-[22px] font-light leading-none">−</span></SquareBtn>
        </div>
      </div>
    </div>
  );
}

function Stage({ kind, setKind, webgl, stage }: { kind: RendererKind; setKind: (k: RendererKind) => void; webgl: boolean; stage: React.RefObject<LookRendererHandle | null> }) {
  const look = useLook((s) => s.look);
  const clear = useLook((s) => s.clear);
  const focus = useLook((s) => s.focus);
  useEffect(() => { if (focus.n) stage.current?.focus(focus.slot); }, [focus, kind, stage]);
  const label = wornList(look).map((x) => `${x.product.title}, ${COLORS[x.worn.color]?.name}`).join("; ") || t("catalog.total.empty");
  return (
    <div className="relative h-full">
      <BrandMark />
      <div className="absolute inset-0">
        {kind === "three" ? <ThreeRenderer ref={stage} look={look} label={label} /> : <PhotoRenderer ref={stage} look={look} label={label} />}
      </div>
      <button type="button" onClick={clear} className="absolute bottom-0 left-0 h-8 rounded-full border border-line bg-surface px-[18px] text-[13px] lg:h-11 lg:px-5 lg:text-[15px]">{t("catalog.stage.removeAll")}</button>
      <div className="absolute bottom-0 right-0 flex gap-[6px]">
        <button type="button" aria-label={kind === "photo" ? t("catalog.stage.flip") : t("catalog.stage.rotate")} onClick={() => stage.current?.rotate(90)}
          className="grid size-8 place-items-center rounded-full border border-line bg-surface lg:size-11">
          <svg viewBox="0 0 24 24" className="size-4 lg:size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>
        </button>
        <button type="button" aria-pressed={kind === "three"} disabled={!webgl && kind === "photo"} onClick={() => setKind(kind === "photo" ? "three" : "photo")}
          aria-label={kind === "photo" ? "Показать 3D-манекен" : "Показать фото-модель"}
          className="h-8 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold disabled:opacity-40 lg:h-11 lg:px-4 lg:text-sm">
          {kind === "photo" ? t("catalog.stage.mode3d") : t("catalog.stage.mode2d")}
        </button>
      </div>
    </div>
  );
}

/* ---------- карточка ---------- */

function Thumb({ p, color }: { p: Product; color: string }) {
  // миниатюра из фото только для вещей, которые сняты на фото-модели
  const part = ["anorak", "joggers", "sabo"].includes(p.slug) ? PHOTO_PART[p.slot] : undefined;
  if (part) return <PhotoThumb part={part} color={color} size={40} />;
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-bg" aria-hidden>
      <span className="size-6 rounded-full border border-line" style={{ background: COLORS[color]?.hex }} />
    </div>
  );
}

function ProductCard({ p, onSizeChart, onAddItem, mobile }: { p: Product; onSizeChart: () => void; onAddItem: (slug: string) => boolean; mobile?: boolean }) {
  const pick = useLook((s) => s.picks[p.slug]);
  const worn = useLook((s) => s.look.slots[p.slot]?.slug === p.slug);
  const flagged = useLook((s) => s.invalid.includes(p.slot) && s.look.slots[p.slot]?.slug === p.slug);
  const [needSize, setNeedSize] = useState(false);
  const invalid = flagged || (needSize && !pick.size);
  const { toggle, setColor, setSize } = useLook.getState();
  const canWear = p.model !== null;
  return (
    <article data-card={p.slug}
      className={`rounded-[16px] border bg-[#fcfcfc] p-4 ${mobile ? "w-[calc(100vw-40px)] max-w-[420px] shrink-0 snap-center" : ""} ${invalid ? "border-red-600 ring-1 ring-red-600" : "border-line"}`}>
      <div className="flex gap-3">
        <Thumb p={p} color={pick.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[12px] uppercase leading-tight">{p.title}</h3>
            <p className="shrink-0 font-display text-[12px] text-muted">{p.priceRub === null ? "" : formatRub(p.priceRub)}</p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted">{p.priceRub === null ? `${t("catalog.card.pricePending")} · ` : ""}{p.short}</p>
        </div>
      </div>

      <div className="mt-[14px] flex items-center gap-2">
        <span className="w-[52px] shrink-0 text-[12px] text-muted">{t("catalog.card.color")}:</span>
        <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="flex flex-wrap gap-0">
          {p.colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={pick.color === c} aria-label={COLORS[c].name} onClick={() => setColor(p.slug, c)}
              className="grid size-8 place-items-center rounded-full">
              <span className={`size-[25px] rounded-full ${c === "white" ? "border border-line" : ""} ${pick.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: COLORS[c].hex }} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[6px] flex items-center gap-2">
        <span className="flex w-[52px] shrink-0 items-center text-[12px] text-muted">{t("catalog.card.size")}:{p.sizes.length > 0 && <button type="button" onClick={onSizeChart} aria-label={t("catalog.card.sizeChart")} className="-my-2 ml-0.5 grid size-5 place-items-center"><span className="grid size-3 place-items-center rounded-full border border-muted text-[9px] leading-none">?</span></button>}</span>
        {p.sizes.length ? (
          <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${p.title}`} className="flex flex-wrap gap-1.5">
            {p.sizes.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={pick.size === s} onClick={() => setSize(p.slug, s)}
                className={`grid h-[26px] min-w-[26px] place-items-center rounded-full px-[7px] text-[12px] ${pick.size === s ? "bg-ink text-white" : "border border-line"}`}>{s}</button>
            ))}
          </div>
        ) : <span className="text-[12px]">{t("catalog.card.oneSize")}</span>}
      </div>
      {invalid && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}

      <div className="mt-[10px] flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1 text-[11.5px]">
          <Link href={`/product/${p.slug}`} className="underline underline-offset-2">{t("catalog.card.details")}</Link>
        </div>
        {canWear ? (
          <button type="button" onClick={() => toggle(p.slug)} aria-pressed={worn}
            className={`h-8 shrink-0 rounded-full px-4 text-[13px] ${worn ? "border border-line bg-surface" : "bg-ink text-white"}`}>
            {worn ? t("catalog.card.takeOff") : t("catalog.card.tryOn")}
          </button>
        ) : (
          <button type="button" onClick={() => setNeedSize(!onAddItem(p.slug))} aria-label={`${t("catalog.total.addOne")}: ${p.title}`}
            className="h-8 shrink-0 rounded-full bg-ink px-4 text-[13px] text-white">{t("product.buy.add")}</button>
        )}
      </div>
    </article>
  );
}

/* ---------- итог ---------- */

function TotalRow({ slot, onAdd }: { slot: Slot; onAdd: (s: Slot) => void }) {
  const worn = useLook((s) => s.look.slots[slot]);
  const remove = useLook((s) => s.remove);
  const [open, setOpen] = useState(false);
  const product = worn ? bySlug.get(worn.slug) : undefined;
  if (!worn || !product) return null;
  const { setColor, setSize, focusOn } = useLook.getState();
  return (
    <li className="py-[5px]">
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); focusOn(slot); }} className="no-press group min-w-0 flex-1 text-left">
          <span className="block truncate text-[13px] text-white/90">{product.title}</span>
          <span className="hidden text-[10.5px] text-white/60 group-aria-expanded:block">{COLORS[worn.color]?.name}{worn.size ? `, ${worn.size}` : product.sizes.length ? ", размер не выбран" : ""} · {open ? "свернуть" : "изменить"}</span>
        </button>
        <span className="shrink-0 font-display text-[12px] tabular-nums text-white/85">{product.priceRub === null ? "—" : formatRub(product.priceRub)}</span>
        <button type="button" aria-label={`${t("catalog.total.remove")}: ${product.title}`} onClick={() => remove(slot)} className="grid size-8 shrink-0 place-items-center">
          <span className="grid size-[19px] place-items-center rounded-full border border-white"><IconX /></span>
        </button>
        <button type="button" aria-label={`${t("catalog.total.addOne")}: ${product.title}`} onClick={() => onAdd(slot)} className="-ml-1.5 grid size-8 shrink-0 place-items-center">
          <span className="grid size-[19px] place-items-center rounded-full bg-white text-ink"><IconCart className="size-[11px]" /></span>
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-[16px] bg-white/10 p-3">
          <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${product.title}`} className="flex flex-wrap gap-1">
            {product.colors.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={worn.color === c} aria-label={COLORS[c].name} onClick={() => setColor(product.slug, c)} className="grid size-10 place-items-center rounded-full">
                <span className={`size-7 rounded-full border border-white/50 ${worn.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-accent" : ""}`} style={{ background: COLORS[c].hex }} />
              </button>
            ))}
          </div>
          {product.sizes.length > 0 && (
            <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${product.title}`} className="flex flex-wrap gap-1.5">
              {product.sizes.map((z) => (
                <button key={z} type="button" role="radio" aria-checked={worn.size === z} onClick={() => setSize(product.slug, z)}
                  className={`grid h-10 min-w-10 place-items-center rounded-full px-2 text-sm font-medium ${worn.size === z ? "bg-white text-ink" : "border border-white/50"}`}>{z}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function TotalBlock({ onAdd, onAddAll, innerRef }: { onAdd: (s: Slot) => void; onAddAll: () => void; innerRef?: React.Ref<HTMLDivElement> }) {
  const look = useLook((s) => s.look);
  const list = wornList(look);
  return (
    <div ref={innerRef} className="rounded-[23px] bg-accent px-4 pb-4 pt-[18px] text-white lg:rounded-[28px] lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[18px] uppercase lg:text-[24px]">{t("catalog.total.label")}</span>
        <span className="font-display text-[18px] tabular-nums lg:text-[24px]">{formatRub(total(look))}</span>
      </div>
      {list.length ? (
        <ul className="mt-[10px] divide-y divide-white/25 border-b border-white/25">{list.map(({ slot }) => <TotalRow key={slot} slot={slot} onAdd={onAdd} />)}</ul>
      ) : <p className="mt-3 text-sm text-white/80">{t("catalog.total.empty")}</p>}
      <button type="button" onClick={onAddAll} className="mt-[14px] flex h-8 w-full items-center justify-center rounded-full bg-white text-[12.5px] font-semibold text-ink lg:h-12 lg:text-[15px]">{t("catalog.total.addAll")}</button>
    </div>
  );
}

/** Мобильная панель: видна, только пока блок ИТОГО за пределами экрана. */
function StickyTotal({ target, onAddAll }: { target: React.RefObject<HTMLDivElement | null>; onAddAll: () => void }) {
  const [hidden, setHidden] = useState(true);
  const sum = useLook((s) => total(s.look));
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  if (hidden) return null;
  return (
    <div className="fixed inset-x-3 z-40 flex items-center gap-3 rounded-full bg-accent py-2 pl-5 pr-2 text-white shadow-lg lg:hidden" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
      <button type="button" onClick={() => target.current?.scrollIntoView({ behavior: "smooth", block: "center" })} className="no-press flex min-h-11 flex-1 items-baseline gap-2 text-left">
        <span className="font-display text-sm uppercase">{t("catalog.total.label")}</span>
        <span className="font-display text-lg tabular-nums">{formatRub(sum)}</span>
      </button>
      <button type="button" onClick={onAddAll} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-ink">{t("catalog.total.addAllShort")}</button>
    </div>
  );
}

function SizeChart({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const rows = [["XS", "84-88", "88-92"], ["S", "88-92", "92-96"], ["M", "92-100", "96-104"], ["L", "100-108", "104-112"], ["XL", "108-116", "112-120"]];
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(92vw,420px)] rounded-[24px] p-5 backdrop:bg-black/40">
      <h2 className="font-display text-base uppercase">{t("catalog.sizeChart.title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("catalog.sizeChart.hint")}</p>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead><tr className="text-left text-muted"><th className="py-1">Размер</th><th>Грудь, см</th><th>Бёдра, см</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-line"><td className="py-1.5 font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Значения предварительные, уточняются у фабрики.</p>
      <button type="button" onClick={() => ref.current?.close()} className="mt-4 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-white">{t("catalog.sizeChart.close")}</button>
    </dialog>
  );
}

/* ---------- страница ---------- */

const noop = () => () => {};
const mq = () => window.matchMedia("(min-width: 1024px)");
const subscribeMq = (cb: () => void) => { const m = mq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

export default function Configurator() {
  useUrlSync();
  const webgl = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind) === "three";
  const [kind, setKind] = useState<RendererKind>("photo");
  const [chart, setChart] = useState(false);
  const { addAll, addOne, addItem } = useActions();
  const stage = useRef<LookRendererHandle>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  // сцену монтируем только в видимой раскладке (3D тяжёлое)
  const desktop = useSyncExternalStore(subscribeMq, () => mq().matches, () => false);
  const stageEl = <Stage kind={kind} setKind={setKind} webgl={webgl} stage={stage} />;

  const heading = (
    <>
      <h1 className="font-display text-[31px] uppercase leading-[1.02] tracking-[-0.03em] md:text-5xl lg:text-[34px]">
        {(() => { const [first, ...rest] = t("catalog.hero.titleStart").split(" "); return <>{first}<br />{rest.join(" ")} </>; })()}<span className="text-accent">{t("catalog.hero.titleAccent")}</span>
      </h1>
      <p className="mt-[18px] max-w-md text-[15px] leading-[1.15] text-muted lg:text-[17px] lg:leading-snug">{t("catalog.hero.subtitle")}</p>
    </>
  );

  return (
    <>
      {/* мобильная версия: как в макете */}
      <div className="pb-8 lg:hidden">
        <section className="px-5 pt-[22px]">{heading}</section>
        <section aria-label="Модель" className="relative mx-5 mt-[26px] h-[352px]">
          {!desktop && stageEl}
          <div className="absolute inset-x-0 top-0 z-10"><Controls stage={stage} /></div>
        </section>
        <section aria-label="Вещи" className="mt-[30px]">
          <div className="flex snap-x snap-mandatory items-start gap-[10px] overflow-x-auto px-5 pb-1 [scrollbar-width:none]" style={{ scrollPaddingInline: 20 }}>
            {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} mobile onSizeChart={() => setChart(true)} onAddItem={addItem} />)}
          </div>
        </section>
        <section aria-label="Итого" className="mt-[14px] px-5">
          <TotalBlock onAdd={addOne} onAddAll={addAll} innerRef={totalRef} />
        </section>
        <StickyTotal target={totalRef} onAddAll={addAll} />
      </div>

      {/* десктоп: заголовок и ИТОГО слева, модель по центру, карточки справа */}
      <div className="mx-auto hidden max-w-[1440px] grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,400px)] gap-8 px-10 pb-12 pt-4 lg:grid">
        <section>
          {heading}
          <div className="mt-8"><TotalBlock onAdd={addOne} onAddAll={addAll} /></div>
        </section>
        <section aria-label="Модель" className="flex h-[calc(100svh-150px)] max-h-[860px] min-h-[600px] flex-col">
          <div className="relative min-h-0 flex-1">
            {desktop && stageEl}
            <div className="absolute inset-x-0 top-0 z-10"><Controls stage={stage} /></div>
          </div>
        </section>
        <section aria-label="Вещи">
          <div className="flex max-h-[calc(100svh-110px)] flex-col gap-4 overflow-y-auto pb-2 pr-1 lg:max-h-[880px]">
            {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} onSizeChart={() => setChart(true)} onAddItem={addItem} />)}
          </div>
        </section>
      </div>
      {chart && <SizeChart onClose={() => setChart(false)} />}
    </>
  );
}
