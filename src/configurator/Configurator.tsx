"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bySlug, CATEGORIES, COLORS, formatRub, PRODUCTS, type Product, type Slot } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { fromQuery, missingSizes, toQuery, total, wornList } from "./look";
import { DEFAULT_LOOK, useCart, useLook, useToast } from "./store";
import ProductImage from "@/shop/ProductImage";
import SizeChart from "@/shop/SizeChart";
import PhotoRenderer from "./renderers/PhotoRenderer";
import { detectRenderer, type LookRendererHandle, type RendererKind } from "./renderers/types";

/** Заглушка на время загрузки 3D-модуля: занимает ровно место сцены, без сдвига вёрстки. */
function StageLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status" aria-live="polite">
      <div aria-hidden className="absolute bottom-[4%] left-1/2 h-[86%] w-[26%] -translate-x-1/2 animate-pulse rounded-t-[999px] rounded-b-[40px] bg-black/[0.04]" />
      <span className="relative flex items-center gap-2 rounded-full bg-surface/95 px-3.5 py-2 text-[13px] text-muted shadow-sm">
        <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        {t("catalog.stage.loading")}
      </span>
    </div>
  );
}

const ThreeRenderer = dynamic(() => import("./renderers/ThreeRenderer"), { ssr: false, loading: StageLoading });

/* ---------- состояние страницы ---------- */

/** Синхронизация образа с URL. Отдельный компонент: подписка на образ не перерисовывает всю страницу. */
function UrlSync() {
  const setLook = useLook((s) => s.setLook);
  const look = useLook((s) => s.look);
  const ready = useRef(false);
  useEffect(() => {
    const parsed = fromQuery(window.location.search);
    // ссылка с ?g= — это сохранённый образ (в том числе пустой после «Снять всё»); без неё показываем образ по умолчанию
    const saved = new URLSearchParams(window.location.search).has("g");
    setLook(saved || Object.keys(parsed.slots).length ? parsed : { ...DEFAULT_LOOK, gender: parsed.gender });
    ready.current = true;
  }, [setLook]);
  useEffect(() => {
    if (!ready.current) return;
    const id = setTimeout(() => window.history.replaceState(window.history.state, "", `?${toQuery(look)}${window.location.hash}`), 300);
    return () => clearTimeout(id);
  }, [look]);
  return null;
}

function focusCard(slug: string) {
  const el = [...document.querySelectorAll<HTMLElement>(`[data-card="${slug}"]`)].find((e) => e.offsetParent !== null);
  el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  // фокус на группу размеров, чтобы выбрать размер с клавиатуры (spec 2.5)
  const size = el?.querySelector<HTMLElement>('[role="radiogroup"][aria-label^="Размер"] [role="radio"]');
  size?.focus({ preventScroll: true });
}

/** Действия корзины из конфигуратора: обычные функции над сторами, стабильные между рендерами. */
const toast = (text: string) => useToast.getState().show(text);
const addToCart = (items: { slug: string; color: string; size: string | null }[]) => useCart.getState().add(items);

function flag(slots: Slot[]) {
  useLook.getState().setInvalid(slots);
  const first = wornList(useLook.getState().look).find((x) => slots.includes(x.slot));
  if (first) requestAnimationFrame(() => focusCard(first.product.slug));
  toast(t("catalog.toast.needSizes"));
}
function addAll() {
  const look = useLook.getState().look;
  const miss = missingSizes(look);
  if (miss.length) return flag(miss);
  const list = wornList(look);
  if (!list.length) return toast(t("catalog.total.empty"));
  const priced = list.filter((x) => x.product.priceRub !== null);
  if (priced.length) addToCart(priced.map((x) => ({ slug: x.worn.slug, color: x.worn.color, size: x.worn.size })));
  toast(priced.length < list.length ? t("catalog.toast.pending") : t("catalog.toast.addedLook"));
}
function addOne(slot: Slot) {
  const x = wornList(useLook.getState().look).find((w) => w.slot === slot);
  if (!x) return;
  if (x.product.sizes.length && !x.worn.size) return flag([slot]);
  if (x.product.priceRub === null) return toast(t("catalog.toast.pending"));
  addToCart([{ slug: x.worn.slug, color: x.worn.color, size: x.worn.size }]);
  toast(t("catalog.toast.added"));
}
/** Одна вещь из карточки (в том числе не надетая и без модели). false = нужен размер. */
function addItem(slug: string) {
  const p = bySlug.get(slug);
  const pick = useLook.getState().picks[slug];
  if (!p || !pick) return true;
  if (p.sizes.length && !pick.size) { toast(t("catalog.card.sizeMissing")); return false; }
  if (p.priceRub === null) { toast(t("catalog.toast.pending")); return true; }
  addToCart([{ slug, color: pick.color, size: pick.size }]);
  toast(t("catalog.toast.added"));
  return true;
}

/* ---------- первая подсказка жеста (один раз, до первого касания сцены) ---------- */

const HINT_KEY = "medform-stage-hint";
let hintSeen: boolean | null = null;
const hintListeners = new Set<() => void>();
const readHint = () => {
  if (hintSeen === null) { try { hintSeen = localStorage.getItem(HINT_KEY) === "1"; } catch { hintSeen = false; } }
  return hintSeen;
};
function dismissHint() {
  if (readHint()) return;
  hintSeen = true;
  try { localStorage.setItem(HINT_KEY, "1"); } catch { /* приватный режим */ }
  hintListeners.forEach((l) => l());
}
const subscribeHint = (cb: () => void) => { hintListeners.add(cb); return () => { hintListeners.delete(cb); }; };

const coarseMq = () => window.matchMedia("(pointer: coarse), (hover: none)");
const subscribeCoarse = (cb: () => void) => { const m = coarseMq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

function GestureHint() {
  const seen = useSyncExternalStore(subscribeHint, readHint, () => true);
  const coarse = useSyncExternalStore(subscribeCoarse, () => coarseMq().matches || navigator.maxTouchPoints > 0, () => true);
  if (seen) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[92px] z-10 flex justify-center lg:bottom-28" aria-live="polite">
      <p className="fade-up flex items-center gap-2 rounded-full bg-ink/85 py-2 pl-3 pr-4 text-[13px] font-medium text-white shadow-lg backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="hint-sway size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-3.9-1.9L4.6 15.2a1.5 1.5 0 0 1 2.3-1.9L9 15" />
        </svg>
        {coarse ? t("catalog.stage.hint") : t("catalog.stage.hintMouse")}
      </p>
    </div>
  );
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
const IconCheck = () => <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const IconRotate = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16.5 7.5C15.6 4.2 14 2 12 2 9.2 2 7 6.5 7 12s2.2 10 5 10c.3 0 .7-.1 1-.2" />
    <path d="m15.2 13.7 3.8 1.9-1.9 3.8" />
    <path d="M19 15.6c-1.8.9-4.3 1.4-7 1.4-5.5 0-10-2.2-10-5s4.5-5 10-5c4.8 0 8.9 1.7 9.8 4" />
  </svg>
);
const IconFit = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
  </svg>
);

/** Фирменный знак за моделью (крупная кавычка MEDFORM). */
function BrandMark() {
  return (
    <svg viewBox="0 0 170 100" aria-hidden className="pointer-events-none absolute left-1/2 top-[18%] w-[78%] max-w-[520px] -translate-x-1/2 text-brandmark">
      <path d="M0 100V46A46 46 0 0 1 46 0h78a46 46 0 0 1 46 46v26h-36V48a12 12 0 0 0-12-12H48a12 12 0 0 0-12 12v52z" fill="currentColor" />
      <rect x="62" y="56" width="46" height="44" rx="4" fill="currentColor" />
    </svg>
  );
}

/* ---------- управление моделью ---------- */

function SquareBtn({ on, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" {...rest}
      className={`grid size-11 place-items-center rounded-[12px] border text-[15px] font-medium transition-colors disabled:opacity-40 lg:rounded-[13px] lg:text-base ${on ? "border-accent bg-accent text-white shadow-[0_4px_12px_rgb(6_70_176/0.25)]" : "border-line bg-surface hover:border-ink/25"} ${className}`} />
  );
}

function Controls({ stage }: { stage: React.RefObject<LookRendererHandle | null> }) {
  const gender = useLook((s) => s.look.gender);
  const setGender = useLook((s) => s.setGender);
  return (
    <div className="pointer-events-none flex items-start justify-between gap-4 [&_button]:pointer-events-auto">
      <div role="group" aria-labelledby="stage-gender">
        <p id="stage-gender" className="mb-1.5 text-[12px] text-muted lg:text-[14px]">{t("catalog.stage.gender")}</p>
        <div className="flex gap-1.5">
          {(["f", "m"] as const).map((g) => (
            <SquareBtn key={g} on={gender === g} aria-pressed={gender === g} aria-label={g === "f" ? t("catalog.stage.genderF") : t("catalog.stage.genderM")} onClick={() => setGender(g)}>{g === "f" ? "Ж" : "М"}</SquareBtn>
          ))}
        </div>
      </div>
      <div role="group" aria-labelledby="stage-zoom" className="text-right">
        <p id="stage-zoom" className="mb-1.5 text-[12px] text-muted lg:text-[14px]">{t("catalog.stage.zoom")}</p>
        <div className="flex gap-1.5">
          <SquareBtn aria-label={t("catalog.stage.zoomIn")} onClick={() => stage.current?.zoomIn()} className="text-accent"><span className="text-[22px] font-light leading-none">+</span></SquareBtn>
          <SquareBtn aria-label={t("catalog.stage.zoomOut")} onClick={() => stage.current?.zoomOut()}><span className="text-[22px] font-light leading-none">−</span></SquareBtn>
          <SquareBtn aria-label={t("catalog.stage.reset")} title={t("catalog.stage.reset")} onClick={() => stage.current?.reset()}><IconFit /></SquareBtn>
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
  const pill = "h-11 rounded-full border border-line bg-surface/95 backdrop-blur-sm";
  return (
    <div className="relative h-full">
      <BrandMark />
      <div className="absolute inset-0">
        {kind === "three" ? <ThreeRenderer ref={stage} look={look} label={label} /> : <PhotoRenderer ref={stage} look={look} label={label} />}
      </div>
      {kind === "three" && <GestureHint />}
      <button type="button" onClick={clear} disabled={!Object.keys(look.slots).length}
        className={`${pill} absolute bottom-0 left-0 px-4 text-[14px] disabled:opacity-50 lg:px-5 lg:text-[15px]`}>{t("catalog.stage.removeAll")}</button>
      <div className="absolute bottom-0 right-0 flex items-center gap-1.5">
        <button type="button" aria-label={kind === "photo" ? t("catalog.stage.flip") : t("catalog.stage.rotate")} title={kind === "photo" ? t("catalog.stage.flip") : t("catalog.stage.rotate")}
          onClick={() => stage.current?.rotate(kind === "photo" ? 180 : 90)} className={`${pill} grid w-11 place-items-center`}>
          <IconRotate />
        </button>
        <div role="group" aria-label={t("catalog.stage.view")} className={`${pill} flex items-center gap-0.5 p-[3px]`}>
          {(["three", "photo"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} disabled={k === "three" && !webgl}
              aria-label={k === "three" ? t("catalog.stage.mode3dLabel") : t("catalog.stage.mode2dLabel")}
              title={k === "three" && !webgl ? t("catalog.stage.no3d") : undefined}
              className={`h-full min-w-11 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-40 ${kind === k ? "bg-ink text-white" : "text-ink hover:bg-bg"}`}>
              {k === "three" ? t("catalog.stage.mode3d") : t("catalog.stage.mode2d")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- карточка ---------- */

const ProductCard = memo(function ProductCard({ p, onSizeChart, onAddItem, mobile }: { p: Product; onSizeChart: () => void; onAddItem: (slug: string) => boolean; mobile?: boolean }) {
  const pick = useLook((s) => s.picks[p.slug]);
  const worn = useLook((s) => s.look.slots[p.slot]?.slug === p.slug);
  const flagged = useLook((s) => s.invalid.includes(p.slot) && s.look.slots[p.slot]?.slug === p.slug);
  const [needSize, setNeedSize] = useState(false);
  const invalid = flagged || (needSize && !pick.size);
  const { toggle, setColor, setSize } = useLook.getState();
  const canWear = p.model !== null;
  const titleId = `card-${p.slug}-${mobile ? "m" : "d"}`;
  return (
    <article data-card={p.slug} data-cat={p.category} aria-labelledby={titleId}
      className={`relative flex flex-col rounded-[var(--radius-card)] border bg-card p-4 transition-[border-color,box-shadow] duration-200 ${mobile ? "w-[min(calc(100vw-56px),340px)] shrink-0 snap-start" : ""} ${invalid ? "border-red-600 ring-1 ring-red-600" : worn ? "border-accent ring-1 ring-accent" : "border-line"}`}>
      <div className="flex gap-3">
        <div className={`relative size-12 shrink-0 rounded-[12px] bg-bg p-0.5 ${worn ? "ring-2 ring-accent" : ""}`} aria-hidden>
          <ProductImage slug={p.slug} color={pick.color} className="h-full w-full" />
          {worn && <span className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full border-2 border-card bg-accent text-white"><IconCheck /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 id={titleId} className="pt-0.5 font-display text-[12px] uppercase leading-[1.2] lg:text-[13px]">{p.title}</h3>
            <p className="shrink-0 pt-0.5 font-display text-[12px] tabular-nums text-muted lg:text-[13px]">{p.priceRub === null ? "" : formatRub(p.priceRub)}</p>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            {worn && <span className="sr-only">{t("catalog.card.worn")}. </span>}
            {p.priceRub === null ? `${t("catalog.card.pricePending")} · ` : ""}{p.short}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[12px] text-muted">{t("catalog.card.color")}: <span className="text-ink">{COLORS[pick.color]?.name}</span></p>
        <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="-mx-[9px] mt-0.5 flex flex-wrap">
          {p.colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={pick.color === c} aria-label={COLORS[c].name} onClick={() => setColor(p.slug, c)}
              className="no-press group grid size-11 place-items-center rounded-full">
              <span className={`size-[26px] rounded-full transition-[box-shadow,transform] duration-150 group-active:scale-90 ${c === "white" || c === "silver" ? "border border-line" : ""} ${pick.color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`} style={{ background: COLORS[c].hex }} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-muted">{t("catalog.card.size")}{p.sizes.length > 0 && pick.size ? <>: <span className="text-ink">{pick.size}</span></> : ""}</p>
          {p.sizes.length > 0 && (
            <button type="button" onClick={onSizeChart} className="no-press -my-3 -mr-1 flex min-h-11 items-center gap-1 px-1 text-[12px] text-ink underline decoration-line underline-offset-[3px] hover:decoration-ink">
              {t("catalog.card.sizeChart")}
            </button>
          )}
        </div>
        {p.sizes.length ? (
          <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${p.title}`} className="-mx-1 mt-0.5 flex flex-wrap">
            {p.sizes.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={pick.size === s} onClick={() => { setSize(p.slug, s); setNeedSize(false); }}
                className="no-press group grid h-11 min-w-11 place-items-center">
                <span className={`grid h-8 min-w-9 place-items-center rounded-full px-2 text-[12px] font-medium tabular-nums transition-colors group-active:scale-95 ${pick.size === s ? "bg-ink text-white" : invalid ? "border border-red-600/60 bg-surface" : "border border-line bg-surface group-hover:border-ink/30"}`}>{s}</span>
              </button>
            ))}
          </div>
        ) : <p className="flex h-11 items-center text-[12px]">{t("catalog.card.oneSize")}</p>}
      </div>
      {invalid && <p role="alert" className="mt-1 text-[13px] font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Link href={`/product/${p.slug}`} className="-my-1 inline-flex min-h-11 items-center text-[12px] underline underline-offset-[3px]">{t("catalog.card.details")}</Link>
        {canWear ? (
          <button type="button" onClick={() => toggle(p.slug)} aria-pressed={worn} aria-describedby={titleId}
            className={`h-11 shrink-0 rounded-full px-5 text-[14px] font-medium transition-colors ${worn ? "border border-line bg-surface hover:border-ink/30" : "bg-ink text-white"}`}>
            {worn ? t("catalog.card.takeOff") : t("catalog.card.tryOn")}
          </button>
        ) : (
          <button type="button" onClick={() => setNeedSize(!onAddItem(p.slug))} aria-label={`${t("catalog.total.addOne")}: ${p.title}`}
            className="h-11 shrink-0 rounded-full bg-ink px-5 text-[14px] font-medium text-white">{t("product.buy.add")}</button>
        )}
      </div>
    </article>
  );
});

/** Мобильная лента карточек с чипами категорий: активная категория следует за прокруткой. */
function CardRail({ onSizeChart, onAddItem }: { onSizeChart: () => void; onAddItem: (slug: string) => boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState<Product["category"]>(PRODUCTS[0].category);
  const cats = CATEGORIES.filter((c) => PRODUCTS.some((p) => p.category === c.id));
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cards = [...el.querySelectorAll<HTMLElement>("[data-card]")];
        const x = el.scrollLeft + 40;
        let cur = cards[0];
        for (const c of cards) if (c.offsetLeft <= x) cur = c;
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) cur = cards[cards.length - 1];
        const next = cur?.dataset.cat as Product["category"] | undefined;
        if (next) setCat(next);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  const go = (id: Product["category"]) => {
    const el = rail.current;
    const card = el?.querySelector<HTMLElement>(`[data-cat="${id}"]`);
    if (!el || !card) return;
    setCat(id);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: smooth ? "smooth" : "auto" });
  };
  return (
    <>
      <div role="group" aria-label={t("catalog.card.categories")} className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pb-3 md:px-10">
        {cats.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => go(c.id)}
            className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors ${cat === c.id ? "bg-ink text-white" : "border border-line bg-surface"}`}>{c.label}</button>
        ))}
      </div>
      <div ref={rail} data-scroller className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 items-stretch gap-2.5 overflow-x-auto px-5 pb-2 pt-1 md:scroll-px-10 md:px-10">
        {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} mobile onSizeChart={onSizeChart} onAddItem={onAddItem} />)}
      </div>
    </>
  );
}

/* ---------- итог ---------- */

function TotalRow({ slot, onAdd }: { slot: Slot; onAdd: (s: Slot) => void }) {
  const worn = useLook((s) => s.look.slots[slot]);
  const remove = useLook((s) => s.remove);
  const [open, setOpen] = useState(false);
  const product = worn ? bySlug.get(worn.slug) : undefined;
  if (!worn || !product) return null;
  const { setColor, setSize } = useLook.getState();
  const detail = `${COLORS[worn.color]?.name}${worn.size ? `, ${worn.size}` : product.sizes.length ? `, ${t("catalog.total.noSize")}` : ""}`;
  return (
    <li className="py-0.5">
      <div className="flex items-center gap-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="no-press flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left">
          <span className="block truncate text-[14px] text-white">{product.title}</span>
          <span className="flex min-w-0 items-center gap-1 text-[11.5px] text-white/70">
            <span className="truncate">{detail}</span>
            <svg viewBox="0 0 24 24" className={`size-3.5 shrink-0 text-white transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            <span className="sr-only">{open ? t("catalog.total.collapse") : t("catalog.total.change")}</span>
          </span>
        </button>
        <span className="shrink-0 pl-1 font-display text-[12px] tabular-nums text-white/90 lg:text-[13px]">{product.priceRub === null ? "—" : formatRub(product.priceRub)}</span>
        <button type="button" aria-label={`${t("catalog.total.remove")}: ${product.title}`} onClick={() => remove(slot)} className="grid size-11 shrink-0 place-items-center rounded-full">
          <span className="grid size-[22px] place-items-center rounded-full border border-white"><IconX /></span>
        </button>
        <button type="button" aria-label={`${t("catalog.total.addOne")}: ${product.title}`} onClick={() => onAdd(slot)} className="-ml-2 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-full">
          <span className="grid size-[22px] place-items-center rounded-full bg-white text-ink"><IconCart className="size-[12px]" /></span>
        </button>
      </div>
      {open && (
        <div className="fade-up mb-2 mt-1 space-y-1 rounded-[16px] bg-white/10 p-2">
          <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${product.title}`} className="flex flex-wrap">
            {product.colors.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={worn.color === c} aria-label={COLORS[c].name} onClick={() => setColor(product.slug, c)} className="no-press grid size-11 place-items-center rounded-full">
                <span className={`size-7 rounded-full border border-white/50 ${worn.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-accent" : ""}`} style={{ background: COLORS[c].hex }} />
              </button>
            ))}
          </div>
          {product.sizes.length > 0 && (
            <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${product.title}`} className="flex flex-wrap gap-1">
              {product.sizes.map((z) => (
                <button key={z} type="button" role="radio" aria-checked={worn.size === z} onClick={() => setSize(product.slug, z)}
                  className={`grid h-11 min-w-11 place-items-center rounded-full px-2 text-sm font-medium tabular-nums ${worn.size === z ? "bg-white text-ink" : "border border-white/50"}`}>{z}</button>
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
    <div ref={innerRef} className="on-accent rounded-[var(--radius-total)] bg-accent px-4 pb-4 pt-[18px] text-white lg:rounded-[var(--radius-total-lg)] lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[18px] uppercase lg:text-[24px]">{t("catalog.total.label")}</h2>
        <span className="font-display text-[18px] tabular-nums lg:text-[24px]" aria-live="polite">{formatRub(total(look))}</span>
      </div>
      {list.length ? (
        <ul className="mt-2 divide-y divide-white/25 border-b border-white/25">{list.map(({ slot }) => <TotalRow key={slot} slot={slot} onAdd={onAdd} />)}</ul>
      ) : <p className="mt-3 text-sm text-white/85">{t("catalog.total.empty")}</p>}
      <button type="button" onClick={onAddAll} disabled={!list.length}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-white px-4 text-[14px] font-semibold text-ink disabled:opacity-60 lg:text-[15px]">{t("catalog.total.addAll")}</button>
    </div>
  );
}

/** Мобильная панель: видна, только пока блок ИТОГО ниже экрана. */
function StickyTotal({ target, onAddAll }: { target: React.RefObject<HTMLDivElement | null>; onAddAll: () => void }) {
  const [hidden, setHidden] = useState(true);
  // панель не закрывает низ карточек: пока лента вещей у нижнего края экрана, панель спрятана
  const [overRail, setOverRail] = useState(false);
  const sum = useLook((s) => total(s.look));
  const count = useLook((s) => Object.keys(s.look.slots).length);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.15 });
    io.observe(el);
    const rail = [...document.querySelectorAll<HTMLElement>("[data-scroller]")].find((r) => r.offsetParent !== null);
    const io2 = rail ? new IntersectionObserver(([e]) => setOverRail(e.isIntersecting), { rootMargin: "-82% 0px 0px 0px" }) : null;
    if (rail) io2!.observe(rail);
    return () => { io.disconnect(); io2?.disconnect(); };
  }, [target]);
  if (hidden || overRail || !count) return null;
  return (
    <div className="on-accent fade-up fixed inset-x-3 z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-full bg-accent py-1.5 pl-5 pr-1.5 text-white shadow-[0_8px_24px_rgb(6_70_176/0.35)] lg:hidden" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
      <button type="button" onClick={() => target.current?.scrollIntoView({ behavior: "smooth", block: "center" })} className="no-press flex min-h-11 min-w-0 flex-1 items-baseline gap-2 text-left">
        <span className="font-display text-[13px] uppercase">{t("catalog.total.label")}</span>
        <span className="truncate font-display text-[17px] tabular-nums">{formatRub(sum)}</span>
      </button>
      <button type="button" onClick={onAddAll} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-white px-4 text-[14px] font-semibold text-ink">{t("catalog.total.addAllShort")}</button>
    </div>
  );
}

/* ---------- страница ---------- */

const noop = () => () => {};
const mq = () => window.matchMedia("(min-width: 1024px)");
const subscribeMq = (cb: () => void) => { const m = mq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

export default function Configurator() {
  const webgl = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind) === "three";
  // реалистичная 3D-модель по умолчанию, если устройство тянет WebGL; фото-модель остаётся переключателем
  const [choice, setKind] = useState<RendererKind | null>(null);
  const kind: RendererKind = choice ?? (webgl ? "three" : "photo");
  const [chart, setChart] = useState(false);
  const openChart = useCallback(() => setChart(true), []);
  const stage = useRef<LookRendererHandle>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  // сцену монтируем только в видимой раскладке (3D тяжёлое)
  const desktop = useSyncExternalStore(subscribeMq, () => mq().matches, () => false);
  const stageEl = <Stage kind={kind} setKind={setKind} webgl={webgl} stage={stage} />;

  const heading = (
    <>
      <h1 className="font-display text-[27px] uppercase leading-[1.02] tracking-[-0.03em] [text-wrap:initial] min-[390px]:text-[29px] md:text-5xl lg:text-[36px] xl:text-[34px] 2xl:text-[38px]">
        {(() => { const [first, ...rest] = t("catalog.hero.titleStart").split(" "); return <>{first}<br />{rest.join(" ")} </>; })()}<span className="text-accent">{t("catalog.hero.titleAccent")}</span>
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-[1.3] text-muted md:max-w-xl md:text-[17px] lg:text-[16px] lg:leading-snug xl:text-[17px]">{t("catalog.hero.subtitle")}</p>
    </>
  );

  return (
    <>
      <UrlSync />
      {/* телефон и планшет: как в мобильном макете */}
      <div className="pb-8 lg:hidden">
        <section className="px-5 pt-[22px] md:px-10 md:pt-8">{heading}</section>
        <section aria-label={t("catalog.stage.gender")} onPointerDownCapture={dismissHint} onWheelCapture={dismissHint}
          className="relative mx-5 mt-5 h-[352px] min-[390px]:h-[380px] md:mx-10 md:h-[560px]">
          {!desktop && stageEl}
          <div className="absolute inset-x-0 top-0 z-10"><Controls stage={stage} /></div>
        </section>
        <section aria-label={t("catalog.card.list")} className="mt-7">
          <CardRail onSizeChart={openChart} onAddItem={addItem} />
        </section>
        <section aria-label={t("catalog.total.label")} className="mt-3 px-5 md:px-10">
          <div className="md:max-w-[560px]"><TotalBlock onAdd={addOne} onAddAll={addAll} innerRef={totalRef} /></div>
        </section>
        <StickyTotal target={totalRef} onAddAll={addAll} />
      </div>

      {/* 1024–1279: модель слева (липкая), справа ИТОГО и карточки; от 1280: три колонки как в макете */}
      <div className="mx-auto hidden max-w-[1440px] gap-x-8 gap-y-6 px-10 pb-12 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:[grid-template-areas:'intro_intro'_'stage_total'_'stage_cards'] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)_minmax(0,400px)] xl:grid-rows-[auto_1fr] xl:gap-y-8 xl:[grid-template-areas:'intro_stage_cards'_'total_stage_cards'] 2xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)_minmax(0,420px)]">
        <section className="[grid-area:intro]">{heading}</section>
        <section aria-label={t("catalog.total.label")} className="[grid-area:total] xl:self-start">
          <TotalBlock onAdd={addOne} onAddAll={addAll} />
        </section>
        <section aria-label={t("catalog.stage.gender")} onPointerDownCapture={dismissHint} onWheelCapture={dismissHint}
          className="sticky top-4 flex h-[calc(100svh-32px)] max-h-[860px] min-h-[560px] flex-col self-start [grid-area:stage] xl:static xl:h-[calc(100svh-150px)] xl:min-h-[620px]">
          <div className="relative min-h-0 flex-1">
            {desktop && stageEl}
            <div className="absolute inset-x-0 top-0 z-10"><Controls stage={stage} /></div>
          </div>
        </section>
        <section aria-label={t("catalog.card.list")} className="[grid-area:cards]">
          <div className="flex flex-col gap-3 xl:max-h-[calc(100svh-110px)] xl:min-h-[660px] xl:overflow-y-auto xl:overscroll-contain xl:pb-8 xl:pr-1 xl:[mask-image:linear-gradient(to_bottom,#000_calc(100%-40px),transparent)] xl:[scrollbar-width:thin]">
            {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} onSizeChart={openChart} onAddItem={addItem} />)}
          </div>
        </section>
      </div>
      {chart && <SizeChart onClose={() => setChart(false)} />}
    </>
  );
}
