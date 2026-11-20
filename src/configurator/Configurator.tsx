"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bySlug, CATEGORIES, COLORS, formatRub, PRODUCTS, type Product, type Slot } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { fromQuery, missingSizes, toQuery, total, wornList } from "./look";
import { DEFAULT_LOOK, useCart, useLook, useToast } from "./store";
import PhotoRenderer from "./renderers/PhotoRenderer";
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

function useActions(setCat: (c: Product["category"]) => void) {
  const add = useCart((s) => s.add);
  const toast = useToast((s) => s.show);
  const setInvalid = useLook((s) => s.setInvalid);
  const flag = (slots: Slot[]) => {
    setInvalid(slots);
    const first = wornList(useLook.getState().look).find((x) => slots.includes(x.slot));
    if (first) {
      setCat(first.product.category);
      requestAnimationFrame(() => focusCard(first.product.slug));
    }
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
    const look = useLook.getState().look;
    const x = wornList(look).find((w) => w.slot === slot);
    if (!x) return;
    if (x.product.sizes.length && !x.worn.size) return flag([slot]);
    if (x.product.priceRub === null) return toast(t("catalog.toast.pending"));
    add([{ slug: x.worn.slug, color: x.worn.color, size: x.worn.size }]);
    toast(t("catalog.toast.added"));
  };
  /** Одна вещь из карточки (в том числе не надетая и без 3D-модели). false = нужен размер. */
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

/* ---------- мелкие элементы ---------- */

const Price = ({ p }: { p: Product }) =>
  p.priceRub === null ? <span className="text-muted">{t("catalog.card.pricePending")}</span> : <span>{formatRub(p.priceRub)}</span>;

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

function IconX() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

function RoundBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`grid size-11 place-items-center rounded-full border border-line bg-surface text-lg font-semibold shadow-sm ${props.className ?? ""}`} />;
}

/* ---------- сцена ---------- */

function Stage({ kind, setKind, webgl }: { kind: RendererKind; setKind: (k: RendererKind) => void; webgl: boolean }) {
  const look = useLook((s) => s.look);
  const setGender = useLook((s) => s.setGender);
  const clear = useLook((s) => s.clear);
  const ref = useRef<LookRendererHandle>(null);
  const focus = useLook((s) => s.focus);
  useEffect(() => { if (focus.n) ref.current?.focus(focus.slot); }, [focus, kind]);
  const label = wornList(look).map((x) => `${x.product.title}, ${COLORS[x.worn.color]?.name}`).join("; ") || t("catalog.total.empty");
  return (
    <div className="relative h-full overflow-hidden rounded-[var(--radius-lg)]">
      <span aria-hidden className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-[42vw] font-black leading-none text-brandmark lg:text-[260px]">MF</span>
      <div className="absolute inset-0">
        {kind === "three" ? <ThreeRenderer ref={ref} look={look} label={label} /> : <PhotoRenderer ref={ref} look={look} label={label} />}
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        <div className="flex rounded-full border border-line bg-surface p-1 text-xs font-semibold" role="group" aria-label="Режим отображения">
          {(["photo", "three"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} disabled={k === "three" && !webgl} onClick={() => setKind(k)} className={`min-h-9 min-w-9 rounded-full px-2.5 disabled:opacity-40 ${kind === k ? "bg-ink text-white" : ""}`}>
              {k === "three" ? t("catalog.stage.mode3d") : t("catalog.stage.mode2d")}
            </button>
          ))}
        </div>
        <button type="button" onClick={clear} className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm font-semibold">{t("catalog.stage.removeAll")}</button>
      </div>

      <p className="pointer-events-none absolute left-3 top-4 hidden max-w-[180px] text-xs text-muted lg:block">{kind === "three" ? t("catalog.stage.hint") : t("catalog.stage.hintPhoto")}</p>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-sm">
        <span className="hidden text-muted sm:inline">{t("catalog.stage.gender")}:</span>
        {(["f", "m"] as const).map((g) => (
          <button key={g} type="button" aria-pressed={look.gender === g} aria-label={g === "f" ? "Женская модель" : "Мужская модель"} onClick={() => setGender(g)}
            className={`grid size-11 place-items-center rounded-full font-semibold ${look.gender === g ? "bg-accent text-white" : "border border-line bg-surface"}`}>
            {g === "f" ? "Ж" : "М"}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-sm">
        <RoundBtn aria-label="Приблизить" onClick={() => ref.current?.zoomIn()}>+</RoundBtn>
        <RoundBtn aria-label="Отдалить" onClick={() => ref.current?.zoomOut()}>−</RoundBtn>
        <RoundBtn aria-label={kind === "photo" ? t("catalog.stage.flip") : t("catalog.stage.rotate")} onClick={() => ref.current?.rotate(90)} className="text-base">↻</RoundBtn>
        <RoundBtn aria-label={t("catalog.stage.reset")} onClick={() => ref.current?.reset()} className="text-base">⤢</RoundBtn>
      </div>
    </div>
  );
}

/* ---------- карточка ---------- */

function ProductCard({ p, mobile, onSizeChart, onAddItem }: { p: Product; mobile?: boolean; onSizeChart: () => void; onAddItem: (slug: string) => boolean }) {
  const pick = useLook((s) => s.picks[p.slug]);
  const worn = useLook((s) => s.look.slots[p.slot]?.slug === p.slug);
  const flagged = useLook((s) => s.invalid.includes(p.slot) && s.look.slots[p.slot]?.slug === p.slug);
  const [needSize, setNeedSize] = useState(false);
  const invalid = flagged || (needSize && !pick.size);
  const { toggle, setColor, setSize } = useLook.getState();
  const canWear = p.model !== null;
  return (
    <article data-card={p.slug}
      className={`rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-card)] ${mobile ? "w-[82vw] max-w-[320px] shrink-0 snap-center" : ""} ${invalid ? "ring-2 ring-red-600" : worn ? "ring-1 ring-ink/20" : ""}`}>
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-[var(--radius-md)] bg-bg" aria-hidden>
          <span className="size-9 rounded-full border border-line" style={{ background: COLORS[pick.color]?.hex }} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-[11px] font-bold uppercase leading-snug">{p.title}</h3>
          <p className="mt-1 text-sm font-semibold"><Price p={p} /></p>
          <p className="mt-1 line-clamp-2 text-xs text-muted">{p.short}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5 border-t border-line pt-3">
        <div>
          <p className="text-xs text-muted">{t("catalog.card.color")}: <span className="text-ink">{COLORS[pick.color]?.name}</span></p>
          <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="mt-1.5 flex flex-wrap gap-1">
            {p.colors.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={pick.color === c} aria-label={COLORS[c].name} onClick={() => setColor(p.slug, c)}
                className="grid size-10 place-items-center rounded-full">
                <span className={`size-7 rounded-full border border-line ${pick.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: COLORS[c].hex }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted">{t("catalog.card.size")}</p>
            {p.sizes.length > 0 && <button type="button" onClick={onSizeChart} className="text-xs underline underline-offset-2">{t("catalog.card.sizeChart")}</button>}
          </div>
          {p.sizes.length ? (
            <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${p.title}`} className="mt-1.5 flex flex-wrap gap-1.5">
              {p.sizes.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={pick.size === s} onClick={() => setSize(p.slug, s)}
                  className={`grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold ${pick.size === s ? "bg-ink text-white" : "border border-line"}`}>{s}</button>
              ))}
            </div>
          ) : <p className="mt-1 text-xs">{t("catalog.card.oneSize")}</p>}
          {invalid && <p role="alert" className="mt-1.5 text-xs font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}
        </div>
        <div className="flex gap-2">
          {canWear && (
            <button type="button" onClick={() => toggle(p.slug)} aria-pressed={worn}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold ${worn ? "border border-ink bg-surface" : "bg-ink text-white"}`}>
              {worn ? t("catalog.card.takeOff") : t("catalog.card.tryOn")}
            </button>
          )}
          <button type="button" onClick={() => setNeedSize(!onAddItem(p.slug))} aria-label={`${t("catalog.total.addOne")}: ${p.title}`}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink px-4 text-sm font-semibold ${canWear ? "" : "flex-1"}`}>
            <IconCart />{!canWear && t("catalog.total.addOne")}
          </button>
        </div>
        <Link href={`/product/${p.slug}`} className="block text-center text-xs underline underline-offset-2">{t("catalog.card.details")}</Link>
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
    <li className="py-2">
      <div className="flex items-center gap-1">
        <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); focusOn(slot); }} className="no-press flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] text-left hover:bg-white/10">
          <span className="size-4 shrink-0 rounded-full border border-white/60" style={{ background: COLORS[worn.color]?.hex }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{product.title}</span>
            <span className="block text-xs opacity-80">{COLORS[worn.color]?.name}{worn.size ? `, ${worn.size}` : `, ${product.sizes.length ? "размер не выбран" : "один размер"}`} · {open ? "свернуть" : "изменить"}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{product.priceRub === null ? "—" : formatRub(product.priceRub)}</span>
        </button>
        <button type="button" aria-label={`${t("catalog.total.addOne")}: ${product.title}`} onClick={() => onAdd(slot)} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/15"><IconCart /></button>
        <button type="button" aria-label={`${t("catalog.total.remove")}: ${product.title}`} onClick={() => remove(slot)} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/15"><IconX /></button>
      </div>
      {open && (
        <div className="mt-1 space-y-2 rounded-[var(--radius-md)] bg-white/10 p-2.5">
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
                  className={`grid min-h-10 min-w-10 place-items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold ${worn.size === z ? "bg-white text-ink" : "border border-white/50"}`}>{z}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function TotalRows({ onAdd }: { onAdd: (s: Slot) => void }) {
  const look = useLook((s) => s.look);
  const list = wornList(look);
  if (!list.length) return <p className="py-3 text-sm opacity-80">{t("catalog.total.empty")}</p>;
  return <ul className="divide-y divide-white/25 text-sm">{list.map(({ slot }) => <TotalRow key={slot} slot={slot} onAdd={onAdd} />)}</ul>;
}

function TotalCard({ onAdd, onAddAll }: { onAdd: (s: Slot) => void; onAddAll: () => void }) {
  const sum = useLook((s) => total(s.look));
  return (
    <div className="rounded-[var(--radius-lg)] bg-accent p-5 text-white">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-sm font-bold uppercase">{t("catalog.total.label")}</span>
        <span className="font-display text-2xl font-black tabular-nums">{formatRub(sum)}</span>
      </div>
      <div className="mt-3"><TotalRows onAdd={onAdd} /></div>
      <button type="button" onClick={onAddAll} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-ink">{t("catalog.total.addAll")}</button>
    </div>
  );
}

function MobileBar({ onAdd, onAddAll }: { onAdd: (s: Slot) => void; onAddAll: () => void }) {
  const [open, setOpen] = useState(false);
  const sum = useLook((s) => total(s.look));
  const count = useLook((s) => wornList(s.look).length);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-accent text-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {open && <div id="look-sheet" className="max-h-[45svh] overflow-y-auto border-b border-white/20 px-4 pt-2"><TotalRows onAdd={onAdd} /></div>}
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" aria-expanded={open} aria-controls="look-sheet" onClick={() => setOpen(!open)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-left">
          <span className="font-display text-xs font-bold uppercase">{t("catalog.total.label")}</span>
          <span className="font-display text-lg font-black tabular-nums">{formatRub(sum)}</span>
          <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[11px] font-semibold" aria-label={`Вещей: ${count}`}>{count}</span>
          <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
        </button>
        <button type="button" onClick={onAddAll} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-ink">{t("catalog.total.addAllShort")}</button>
      </div>
    </div>
  );
}

function SizeChart({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const rows = [["XS", "84-88", "88-92"], ["S", "88-92", "92-96"], ["M", "92-100", "96-104"], ["L", "100-108", "104-112"], ["XL", "108-116", "112-120"]];
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(92vw,420px)] rounded-[var(--radius-lg)] p-5 backdrop:bg-black/40">
      <h2 className="font-display text-base font-bold uppercase">{t("catalog.sizeChart.title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("catalog.sizeChart.hint")}</p>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead><tr className="text-left text-muted"><th className="py-1">Размер</th><th>Грудь, см</th><th>Бёдра, см</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-line"><td className="py-1.5 font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Значения предварительные, уточняются у фабрики.</p>
      <button type="button" onClick={() => ref.current?.close()} className="mt-4 min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-white">{t("catalog.sizeChart.close")}</button>
    </dialog>
  );
}

/* ---------- страница ---------- */

const noop = () => () => {};

export default function Configurator() {
  useUrlSync();
  // По умолчанию фото-модель (как в макете); 3D доступно переключателем, если есть WebGL.
  const webgl = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind) === "three";
  const [kind, setKind] = useState<RendererKind>("photo");
  const [cat, setCat] = useState<Product["category"]>("top");
  const [chart, setChart] = useState(false);
  const { addAll, addOne, addItem } = useActions(setCat);
  const focusOn = useLook((s) => s.focusOn);
  const wornSlots = useLook((s) => s.look.slots);

  return (
    <>
      <div className="mx-auto max-w-[1440px] pb-28 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,350px)] lg:gap-6 lg:px-10 lg:pb-12">
        <section className="px-4 lg:px-0">
          <h1 className="font-display text-[22px] font-black uppercase leading-[1.05] md:text-4xl lg:text-[40px]">
            {t("catalog.hero.titleStart")} <span className="text-accent">{t("catalog.hero.titleAccent")}</span>
          </h1>
          <p className="mt-2 hidden max-w-md text-sm text-muted sm:block md:text-base">{t("catalog.hero.subtitle")}</p>
          <div className="mt-6 hidden lg:block"><TotalCard onAdd={addOne} onAddAll={addAll} /></div>
        </section>

        <section aria-label="Модель" className="mt-2 h-[60svh] min-h-[380px] px-2 lg:mt-0 lg:h-[calc(100svh-120px)] lg:max-h-[860px] lg:min-h-[620px] lg:px-0">
          <Stage kind={kind} setKind={setKind} webgl={webgl} />
        </section>

        {/* мобильные табы и лента */}
        <section aria-label="Вещи" className="lg:hidden">
          <div role="tablist" aria-label="Категории" className="sticky top-0 z-30 flex gap-2 overflow-x-auto bg-bg px-4 py-3 [scrollbar-width:none]">
            {CATEGORIES.map((c) => {
              const has = PRODUCTS.some((p) => p.category === c.id && wornSlots[p.slot]?.slug === p.slug);
              return (
                <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => { setCat(c.id); focusOn(c.id === "accessory" ? "full" : c.id); }}
                  className={`relative min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${cat === c.id ? "bg-ink text-white" : "border border-line bg-surface"}`}>
                  {c.label}{has && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" aria-label="надето" />}
                </button>
              );
            })}
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
            {PRODUCTS.filter((p) => p.category === cat).map((p) => <ProductCard key={p.slug} p={p} mobile onSizeChart={() => setChart(true)} onAddItem={addItem} />)}
          </div>
        </section>

        {/* десктопная колонка */}
        <section aria-label="Вещи" className="hidden lg:block">
          <div className="flex max-h-[calc(100svh-120px)] flex-col gap-4 overflow-y-auto pb-2 pr-1 lg:max-h-[860px]">
            {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} onSizeChart={() => setChart(true)} onAddItem={addItem} />)}
          </div>
        </section>
      </div>
      <MobileBar onAdd={addOne} onAddAll={addAll} />
      {chart && <SizeChart onClose={() => setChart(false)} />}
    </>
  );
}
