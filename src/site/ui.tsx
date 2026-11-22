import Link from "next/link";

export function Section({ title, children, action, id }: { title?: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className="mx-auto max-w-[1440px] scroll-mt-4 px-5 py-8 md:px-10 md:py-12">
      {(title || action) && (
        <div className="mb-5 flex items-end justify-between gap-4">
          {title && <h2 id={id ? `${id}-title` : undefined} className="font-display text-2xl font-black uppercase leading-tight md:text-4xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ButtonLink({ href, children, variant = "dark", className = "" }: { href: string; children: React.ReactNode; variant?: "dark" | "light" | "outline" | "accent"; className?: string }) {
  const cls = {
    dark: "bg-ink text-white",
    light: "bg-white text-ink",
    outline: "border border-ink text-ink",
    accent: "bg-accent text-white",
  }[variant];
  return <Link href={href} className={`press inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full px-6 font-semibold ${cls} ${className}`}>{children}</Link>;
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-5 md:px-10 md:pt-8">
      <h1 className="font-display text-[30px] font-black uppercase leading-[1.05] md:text-5xl">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">{lead}</p>}
    </div>
  );
}
