import { COLORS } from "@/catalog/data";

/**
 * Фото товара из 3D-модели в выбранном цвете (tools/3d/thumbs.mjs):
 * `/products/<slug>.webp` — вещь в белой ткани со складками и тенями, `<slug>-mask.webp` — где ткань.
 * Цвет накладывается через mask-image + multiply, поэтому одна картинка на все цвета, фурнитура не красится.
 */
export default function ProductImage({ slug, color, className = "", alt = "" }: { slug: string; color: string; className?: string; alt?: string }) {
  const hex = COLORS[color]?.hex ?? "#ffffff";
  const mask = `url(/products/${slug}-mask.webp)`;
  return (
    <div className={`relative isolate ${className}`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/products/${slug}.webp`} alt="" draggable={false} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
      <div
        className="absolute inset-0 transition-[background-color] duration-200 motion-reduce:transition-none"
        style={{ backgroundColor: hex, mixBlendMode: "multiply", WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }}
      />
    </div>
  );
}
