"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bySlug, COLORS, formatRub, PRODUCTS, type Product, type Slot } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { fromQuery, missingSizes, toQuery, total, wornList } from "./look";
import { DEFAULT_LOOK, useCart, useLook, useToast } from "./store";
import ProductGallery from "@/shop/ProductGallery";
import ProductImage from "@/shop/ProductImage";
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
/**
 * Фирменный знак за моделью (из макета): две сцепленные дуги «n» и «u», вторая = первая, повёрнутая на 180°.
 * Пропорции 690 × 395, мягкий серый градиент.
 */
function BrandMark() {
  const piece = "M0,395V190A190,190 0 0 1 190,0H495V190H195V100H190A85,85 0 0 0 105,185V395Z";
  return (
    <svg viewBox="0 0 690 395" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[71%] -translate-x-1/2 -translate-y-1/2 lg:w-[111%]">
      <defs>
        <linearGradient id="bm-a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity="0.075" /><stop offset="1" stopColor="#000" stopOpacity="0.035" /></linearGradient>
        <linearGradient id="bm-b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0.02" /><stop offset="1" stopColor="#000" stopOpacity="0.065" /></linearGradient>
      </defs>
      <path d={piece} fill="url(#bm-a)" />
      <path d={piece} fill="url(#bm-b)" transform="rotate(180 345 197.5)" />
    </svg>
  );
}

/* ---------- управление моделью ---------- */

/** Квадратная кнопка модели и приближения: 34 px на телефоне, 38 px на десктопе; зона нажатия шире видимой. */
function SquareBtn({ on, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" {...rest}
      className={`relative grid size-[34px] place-items-center rounded-[9px] text-[16px] leading-none transition-colors after:absolute after:-inset-[5px] lg:size-[38px] lg:rounded-[10px] lg:text-[17px] ${on ? "bg-accent text-white" : "border border-[#e2e2e2] bg-surface text-ink hover:border-ink/25"} ${className}`} />
  );
}

function Controls({ stage }: { stage: React.RefObject<LookRendererHandle | null> }) {
  const gender = useLook((s) => s.look.gender);
  const setGender = useLook((s) => s.setGender);
  return (
    <div className="pointer-events-none flex items-end justify-between gap-4 [&_button]:pointer-events-auto">
      <div role="group" aria-labelledby="stage-gender">
        <p id="stage-gender" className="mb-[9px] text-[12.5px] leading-none text-muted-soft">{t("catalog.stage.gender")}</p>
        <div className="flex gap-[5px]">
          {(["f", "m"] as const).map((g) => (
            <SquareBtn key={g} on={gender === g} aria-pressed={gender === g} aria-label={g === "f" ? t("catalog.stage.genderF") : t("catalog.stage.genderM")} onClick={() => setGender(g)}>{g === "f" ? "Ж" : "М"}</SquareBtn>
          ))}
        </div>
      </div>
      <div role="group" aria-labelledby="stage-zoom" className="text-right">
        <p id="stage-zoom" className="mb-[9px] text-[12.5px] leading-none text-muted-soft">{t("catalog.stage.zoom")}</p>
        <div className="flex justify-end gap-[5px]">
          <SquareBtn aria-label={t("catalog.stage.zoomIn")} onClick={() => stage.current?.zoomIn()} className="text-accent"><span className="text-[24px] font-light leading-none">+</span></SquareBtn>
          <SquareBtn aria-label={t("catalog.stage.zoomOut")} onClick={() => stage.current?.zoomOut()} className="!text-[#c4c4c4]"><span className="text-[24px] font-light leading-none">−</span></SquareBtn>
        </div>
      </div>
    </div>
  );
}

const pill = "inline-flex h-[31px] items-center rounded-full border border-[#e2e2e2] bg-surface px-4 text-[13px] leading-none shadow-[0_1px_2px_rgb(0_0_0/0.04)]";

/** Переключатель 3D / фото-модель (в макете фото; 3D — наш режим по умолчанию). */
function ViewToggle({ kind, setKind, webgl }: { kind: RendererKind; setKind: (k: RendererKind) => void; webgl: boolean }) {
  return (
    <div role="group" aria-label={t("catalog.stage.view")} className={`${pill} gap-0.5 !px-[3px]`}>
      {(["three", "photo"] as const).map((k) => (
        <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} disabled={k === "three" && !webgl}
          aria-label={k === "three" ? t("catalog.stage.mode3dLabel") : t("catalog.stage.mode2dLabel")}
          className={`relative h-[25px] rounded-full px-2.5 text-[12px] font-medium transition-colors after:absolute after:-inset-y-[9px] after:inset-x-0 disabled:opacity-40 ${kind === k ? "bg-ink text-white" : "text-ink"}`}>
          {k === "three" ? t("catalog.stage.mode3d") : t("catalog.stage.mode2d")}
        </button>
      ))}
    </div>
  );
}

function Stage({ kind, setKind, webgl, stage, desktop }: { kind: RendererKind; setKind: (k: RendererKind) => void; webgl: boolean; stage: React.RefObject<LookRendererHandle | null>; desktop: boolean }) {
  const look = useLook((s) => s.look);
  const clear = useLook((s) => s.clear);
  const label = wornList(look).map((x) => `${x.product.title}, ${COLORS[x.worn.color]?.name}`).join("; ") || t("catalog.total.empty");
  const empty = !Object.keys(look.slots).length;
  const removeAll = (
    <button type="button" onClick={clear} disabled={empty} className={`${pill} relative after:absolute after:-inset-y-[7px] after:inset-x-0 disabled:text-[#c9c9c9]`}>{t("catalog.stage.removeAll")}</button>
  );
  return (
    <div className="relative h-full">
      <BrandMark />
      <div className="absolute inset-0">
        {kind === "three" ? <ThreeRenderer ref={stage} look={look} label={label} /> : <PhotoRenderer ref={stage} look={look} label={label} />}
      </div>
      {kind === "three" && <GestureHint />}
      {desktop ? (
        <>
          <div className="absolute right-0 top-[21px]">{removeAll}</div>
          <div className="absolute left-0 top-[21px]"><ViewToggle kind={kind} setKind={setKind} webgl={webgl} /></div>
        </>
      ) : (
        <>
          <div className="absolute bottom-[2px] left-0">{removeAll}</div>
          <div className="absolute bottom-[2px] right-0"><ViewToggle kind={kind} setKind={setKind} webgl={webgl} /></div>
        </>
      )}
    </div>
  );
}

/* ---------- карточка ---------- */

/** Попап карточки товара: обычные фото (без 3D), описание, цвет, размер, примерка и корзина. */
function ProductDialog({ p, onClose, onAddItem }: { p: Product; onClose: () => void; onAddItem: (slug: string) => boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pick = useLook((s) => s.picks[p.slug]);
  const worn = useLook((s) => s.look.slots[p.slot]?.slug === p.slug);
  const { toggle, setColor, setSize } = useLook.getState();
  const [needSize, setNeedSize] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const titleId = `dlg-${p.slug}`;
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className="m-0 mt-auto max-h-[92svh] w-full max-w-none overflow-y-auto rounded-t-[22px] bg-surface p-0 backdrop:bg-black/45 md:m-auto md:max-h-[86svh] md:w-[min(92vw,860px)] md:rounded-[22px]">
      <div className="md:grid md:grid-cols-[1.05fr_1fr]">
        <ProductGallery p={p} color={pick.color} className="h-[46svh] max-h-[420px] rounded-none md:h-full md:max-h-none md:min-h-[520px]" />
        <div className="p-5 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="font-display text-[18px] font-bold uppercase leading-[1.15] tracking-[-0.03em] md:text-[22px]">{p.title}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label={t("product.dialog.close")} className="relative -mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-bg after:absolute after:-inset-1">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <p className="mt-2 font-display text-[18px] font-bold tracking-[-0.03em] tabular-nums">{p.priceRub === null ? <span className="text-[14px] font-normal text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
          <p className="mt-2 text-[14px] leading-snug text-muted">{p.short}</p>

          <p className="mt-5 text-[13px] text-muted">{t("catalog.card.color")}: <span className="text-ink">{COLORS[pick.color]?.name}</span></p>
          <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="mt-2 flex flex-wrap gap-2.5">
            {p.colors.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={pick.color === c} aria-label={COLORS[c].name} onClick={() => setColor(p.slug, c)}
                className={`relative size-8 rounded-full after:absolute after:-inset-1.5 ${pick.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}>
                <span className={`block size-full rounded-full ${c === "white" || c === "silver" ? "border border-[#e2e2e2]" : ""}`} style={{ background: COLORS[c].hex }} />
              </button>
            ))}
          </div>
          {p.sizes.length > 0 && (
            <>
              <p className="mt-4 text-[13px] text-muted">{t("catalog.card.size")}{pick.size ? <>: <span className="text-ink">{pick.size}</span></> : ""}</p>
              <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${p.title}`} className="mt-2 flex flex-wrap gap-2">
                {p.sizes.map((z) => (
                  <button key={z} type="button" role="radio" aria-checked={pick.size === z} onClick={() => { setSize(p.slug, z); setNeedSize(false); }}
                    className={`grid h-11 min-w-11 place-items-center rounded-[10px] px-2 text-[14px] tabular-nums ${pick.size === z ? "bg-ink text-white" : needSize ? "border border-red-600/60" : "border border-[#e2e2e2]"}`}>{z}</button>
                ))}
              </div>
              {needSize && <p role="alert" className="mt-2 text-[13px] font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}
            </>
          )}
          <div className="mt-6 flex gap-2">
            {p.model !== null && (
              <button type="button" onClick={() => { toggle(p.slug); ref.current?.close(); }} aria-pressed={worn}
                className={`h-12 flex-1 rounded-full text-[14px] font-medium ${worn ? "border border-[#e2e2e2]" : "border border-ink"}`}>{worn ? t("catalog.card.takeOff") : t("catalog.card.tryOn")}</button>
            )}
            <button type="button" onClick={() => setNeedSize(!onAddItem(p.slug))} className="h-12 flex-1 rounded-full bg-ink text-[14px] font-medium text-white">{t("product.buy.add")}</button>
          </div>
          <Link href={`/product/${p.slug}`} className="mt-4 inline-flex min-h-11 items-center text-[13px] underline underline-offset-[3px]">{t("product.dialog.page")}</Link>
        </div>
      </div>
    </dialog>
  );
}

const ProductCard = memo(function ProductCard({ p, onAddItem, mobile }: { p: Product; onAddItem: (slug: string) => boolean; mobile?: boolean }) {
  const pick = useLook((s) => s.picks[p.slug]);
  const worn = useLook((s) => s.look.slots[p.slot]?.slug === p.slug);
  const flagged = useLook((s) => s.invalid.includes(p.slot) && s.look.slots[p.slot]?.slug === p.slug);
  const [needSize, setNeedSize] = useState(false);
  const invalid = flagged || (needSize && !pick.size);
  const { toggle, setColor, setSize } = useLook.getState();
  const canWear = p.model !== null;
  const titleId = `card-${p.slug}-${mobile ? "m" : "d"}`;
  const [details, setDetails] = useState(false);
  const btn = "relative h-[31px] shrink-0 rounded-full px-[15px] text-[13px] font-medium leading-none after:absolute after:-inset-y-[7px] after:inset-x-0";
  return (
    <article data-card={p.slug} data-cat={p.category} aria-labelledby={titleId}
      className={`relative flex flex-col rounded-[16px] border-[1.5px] bg-surface pb-[14px] pl-4 pr-[13px] pt-[14px] transition-[border-color] duration-200 ${mobile ? "w-[335px] max-w-[calc(100vw-40px)] shrink-0 snap-center" : "w-[328px]"} ${invalid ? "border-red-600" : "border-[#e9e9e9]"}`}>
      <div className="flex gap-[16px]">
        <button type="button" onClick={() => setDetails(true)} tabIndex={-1} aria-hidden className="size-[38px] shrink-0 overflow-hidden rounded-[8px] bg-[#f1f1f1]">
          <ProductImage slug={p.slug} color={pick.color} className="h-full w-full" />
        </button>
        <div className="min-w-0 flex-1 pt-[2px]">
          <div className="flex items-start justify-between gap-2">
            <h3 id={titleId} className="font-display text-[12.5px] font-bold uppercase leading-[1.15] tracking-[-0.05em] [text-wrap:nowrap]">{p.title}</h3>
            <p className="shrink-0 font-display text-[12.5px] font-bold leading-[1.15] tracking-[-0.045em] tabular-nums text-muted-soft">{p.priceRub === null ? "" : formatRub(p.priceRub)}</p>
          </div>
          <p className="mt-[5px] text-[11.5px] leading-[1.2] text-muted-soft">
            {worn && <span className="sr-only">{t("catalog.card.worn")}. </span>}
            {p.priceRub === null ? `${t("catalog.card.pricePending")} · ` : ""}{p.short}
          </p>
        </div>
      </div>

      <div className="mt-[11px] flex items-center">
        <span className="w-[55px] shrink-0 text-[12.5px] text-muted-soft">{t("catalog.card.color")}:</span>
        <div role="radiogroup" aria-label={`${t("catalog.card.color")}: ${p.title}`} className="flex flex-wrap gap-[6.5px] max-lg:gap-[7.5px]">
          {p.colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={pick.color === c} aria-label={COLORS[c].name} onClick={() => setColor(p.slug, c)}
              className={`no-press relative size-6 rounded-full after:absolute after:-inset-[5px] max-lg:size-[25px] ${pick.color === c ? "ring-[1.5px] ring-ink ring-offset-[2px] ring-offset-surface" : ""}`}>
              <span className={`block size-full rounded-full ${c === "white" || c === "silver" ? "border border-[#e2e2e2]" : ""}`} style={{ background: COLORS[c].hex }} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[9px] flex items-center">
        <span className="w-[55px] shrink-0 text-[12.5px] text-muted-soft">{t("catalog.card.size")}:</span>
        {p.sizes.length ? (
          <div role="radiogroup" aria-label={`${t("catalog.card.size")}: ${p.title}`} className="no-scrollbar -my-[6px] -mr-[13px] flex min-w-0 flex-1 gap-1 overflow-x-auto py-[6px] pl-[5px] -ml-[5px] pr-[13px] max-lg:gap-[7.5px]">
            {p.sizes.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={pick.size === s} onClick={() => { setSize(p.slug, s); setNeedSize(false); }}
                className={`no-press relative grid h-6 min-w-6 shrink-0 place-items-center rounded-[7px] px-1 text-[12px] leading-none tabular-nums after:absolute after:-inset-[5px] max-lg:h-[25px] max-lg:min-w-[25px] ${pick.size === s ? "bg-ink text-white" : invalid ? "border border-red-600/60 bg-surface" : "border border-[#e2e2e2] bg-surface hover:border-ink/30"}`}>{s}</button>
            ))}
          </div>
        ) : <span className="text-[12px]">{t("catalog.card.oneSize")}</span>}
      </div>
      {invalid && <p role="alert" className="mt-2 text-[12px] font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}

      <div className="mt-auto flex items-end justify-between gap-3 pt-[6px]">
        <button type="button" onClick={() => setDetails(true)} aria-haspopup="dialog" className="relative mb-[6px] text-[12px] leading-none underline underline-offset-[3px] after:absolute after:-inset-y-3 after:inset-x-0">{t("catalog.card.details")}</button>
        {canWear ? (
          <button type="button" onClick={() => toggle(p.slug)} aria-pressed={worn} aria-describedby={titleId}
            className={`${btn} ${worn ? "border-[1.5px] border-[#e2e2e2] bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)]" : "bg-ink text-white"}`}>
            {worn ? t("catalog.card.takeOff") : t("catalog.card.tryOn")}
          </button>
        ) : (
          <button type="button" onClick={() => setNeedSize(!onAddItem(p.slug))} aria-label={`${t("catalog.total.addOne")}: ${p.title}`} className={`${btn} bg-ink text-white`}>{t("product.buy.add")}</button>
        )}
      </div>
      {details && <ProductDialog p={p} onClose={() => setDetails(false)} onAddItem={onAddItem} />}
    </article>
  );
});

/** Мобильная карусель карточек: карточка по центру, соседние видны по краям (как в макете). */
function CardRail({ onAddItem }: { onAddItem: (slug: string) => boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  // при первом показе по центру — первая надетая вещь (в макете «Медицинский верх»)
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const id = setTimeout(() => {
      const slots = useLook.getState().look.slots;
      const first = PRODUCTS.find((p) => slots[p.slot]?.slug === p.slug && p.slot !== "feet");
      const card = first && el.querySelector<HTMLElement>(`[data-card="${first.slug}"]`);
      if (card) el.scrollLeft = card.offsetLeft - el.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    }, 50);
    return () => clearTimeout(id);
  }, []);
  return (
    <div ref={rail} data-scroller className="no-scrollbar flex snap-x snap-mandatory items-start gap-[7px] overflow-x-auto px-5 md:px-10">
      {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} mobile onAddItem={onAddItem} />)}
    </div>
  );
}

/* ---------- итог ---------- */

const IconCircleX = () => (
  <svg viewBox="0 0 20 20" className="size-[26px] lg:size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><circle cx="10" cy="10" r="9.2" /><path d="M6.6 6.6l6.8 6.8M13.4 6.6l-6.8 6.8" /></svg>
);

function TotalRow({ slot, onAdd }: { slot: Slot; onAdd: (s: Slot) => void }) {
  const worn = useLook((s) => s.look.slots[slot]);
  const remove = useLook((s) => s.remove);
  const product = worn ? bySlug.get(worn.slug) : undefined;
  if (!worn || !product) return null;
  return (
    <li className="flex h-[40px] items-center gap-[14px] border-b border-white/25 lg:h-[30px] lg:gap-[9px]">
      <span className="min-w-0 flex-1 truncate text-[13px] text-white/75 max-lg:text-[13.5px]">
        {product.title}<span className="sr-only">, {COLORS[worn.color]?.name}{worn.size ? `, ${worn.size}` : ""}</span>
      </span>
      <span className="shrink-0 font-display text-[12px] font-bold tracking-[-0.02em] tabular-nums text-white/75">{product.priceRub === null ? "—" : formatRub(product.priceRub)}</span>
      <button type="button" aria-label={`${t("catalog.total.remove")}: ${product.title}`} onClick={() => remove(slot)} className="relative grid shrink-0 place-items-center text-white/85 after:absolute after:-inset-[9px] lg:after:-inset-[6px]"><IconCircleX /></button>
      <button type="button" aria-label={`${t("catalog.total.addOne")}: ${product.title}`} onClick={() => onAdd(slot)} className="relative grid size-[26px] shrink-0 place-items-center rounded-full bg-white text-ink after:absolute after:-inset-[9px] lg:size-[22px] lg:after:-inset-[6px]"><IconCart className="size-[15px] lg:size-[13px]" /></button>
    </li>
  );
}

/** ИТОГО: на десктопе чёрный блок, на телефоне синий (как в макете); верхний правый угол скруглён сильнее. */
function TotalBlock({ onAdd, onAddAll }: { onAdd: (s: Slot) => void; onAddAll: () => void }) {
  const look = useLook((s) => s.look);
  // порядок строк как в каталоге (в макете: футболка, верх, брюки, сабо)
  const list = wornList(look).sort((a, b) => PRODUCTS.indexOf(a.product) - PRODUCTS.indexOf(b.product));
  return (
    <div className="on-accent rounded-[14px] rounded-tr-[32px] bg-accent px-4 pb-4 pt-[22px] text-white lg:rounded-[12px] lg:rounded-tr-[30px] lg:bg-[#0b0b0b] lg:pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[18.5px] font-bold uppercase leading-none tracking-[-0.03em]">{t("catalog.total.label")}</h2>
        <span className="font-display text-[18.5px] font-bold leading-none tracking-[-0.03em] tabular-nums" aria-live="polite">{formatRub(total(look))}</span>
      </div>
      {list.length ? (
        <ul className="mt-[11px]">{list.map(({ slot }) => <TotalRow key={slot} slot={slot} onAdd={onAdd} />)}</ul>
      ) : <p className="mt-[18px] text-[14px] text-white/85">{t("catalog.total.empty")}</p>}
      <button type="button" onClick={onAddAll} disabled={!list.length}
        className="mt-[18px] flex h-[33px] w-full items-center justify-center rounded-full bg-white px-4 text-[13.5px] font-semibold text-ink disabled:opacity-60 lg:mt-[19px] lg:h-[30px] lg:text-[13px]">{t("catalog.total.addAll")}</button>
    </div>
  );
}

/* ---------- страница ---------- */

const noop = () => () => {};
const mq = () => window.matchMedia("(min-width: 1024px)");
const subscribeMq = (cb: () => void) => { const m = mq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

export default function Configurator() {
  const webgl = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind) === "three";
  // реалистичная 3D-модель по умолчанию, если устройство тянет WebGL; фото-модель — переключателем
  const [choice, setKind] = useState<RendererKind | null>(null);
  const kind: RendererKind = choice ?? (webgl ? "three" : "photo");
  const stage = useRef<LookRendererHandle>(null);
  // сцену монтируем только в видимой раскладке (3D тяжёлое)
  const desktop = useSyncExternalStore(subscribeMq, () => mq().matches, () => false);
  const stageEl = <Stage kind={kind} setKind={setKind} webgl={webgl} stage={stage} desktop={desktop} />;

  const title = (() => { const [first, ...rest] = t("catalog.hero.titleStart").split(" "); return <>{first}<br />{rest.join(" ")} </>; })();

  return (
    <>
      <UrlSync />
      {/* телефон и планшет: мобильный макет */}
      <div className="pb-8 lg:hidden">
        <section className="px-5 pt-[30px] md:px-10">
          <h1 className="font-display text-[33px] font-bold uppercase leading-[35px] tracking-[-0.06em] [text-wrap:initial] md:text-5xl">
            {title}<span className="text-accent">{t("catalog.hero.titleAccent")}</span>
          </h1>
          <p className="mt-[19px] max-w-[300px] text-[13.65px] leading-[17px] text-muted-soft md:max-w-xl md:text-[16px] md:leading-snug">{t("catalog.hero.subtitle")}</p>
        </section>
        <section aria-label={t("catalog.stage.gender")} onPointerDownCapture={dismissHint} onWheelCapture={dismissHint}
          className="relative mx-5 mt-[25px] h-[333px] md:mx-10 md:h-[560px]">
          {!desktop && stageEl}
          <div className="absolute inset-x-0 top-0 z-10"><Controls stage={stage} /></div>
        </section>
        <section aria-label={t("catalog.card.list")} className="mt-[26px]">
          <CardRail onAddItem={addItem} />
        </section>
        <section aria-label={t("catalog.total.label")} className="mt-3 px-5 md:px-10">
          <div className="md:max-w-[560px]"><TotalBlock onAdd={addOne} onAddAll={addAll} /></div>
        </section>
      </div>

      {/* десктоп: макет 1440 × 720 — слева заголовок и ИТОГО, по центру модель, справа карточки */}
      <div className="relative mx-auto hidden h-[calc(100svh-68px)] max-h-[900px] min-h-[652px] max-w-[1440px] grid-cols-[minmax(0,1fr)_448px_minmax(0,1fr)] px-6 pb-[26px] lg:grid">
        <section className="flex min-h-0 flex-col justify-between">
          <div className="pt-[50px]">
            <h1 className="font-display text-[43px] font-bold uppercase leading-[51px] tracking-[-0.04em] [text-wrap:initial]">
              {title}<span className="text-accent">{t("catalog.hero.titleAccent")}</span>
            </h1>
            <p className="mt-[27px] max-w-[380px] text-[13.6px] leading-[18px] text-muted-soft">{t("catalog.hero.subtitle")}</p>
          </div>
          <div aria-label={t("catalog.total.label")} role="region" className="w-[331px]"><TotalBlock onAdd={addOne} onAddAll={addAll} /></div>
        </section>
        <section aria-label={t("catalog.stage.gender")} onPointerDownCapture={dismissHint} onWheelCapture={dismissHint} className="relative mt-[5px]">
          {desktop && stageEl}
          <div className="absolute inset-x-0 bottom-0 z-10"><Controls stage={stage} /></div>
        </section>
        <section aria-label={t("catalog.card.list")} className="flex min-h-0 justify-end">
          <div className="no-scrollbar -mb-[26px] flex min-h-0 flex-col gap-[6px] overflow-y-auto overscroll-contain pb-10 pt-[26px] [mask-image:linear-gradient(to_bottom,#000_calc(100%-90px),transparent)]">
            {PRODUCTS.map((p) => <ProductCard key={p.slug} p={p} onAddItem={addItem} />)}
          </div>
        </section>
      </div>
    </>
  );
}
