/** Логотип MEDFORM с фирменной кавычкой (как в макете). */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-start font-display font-black uppercase tracking-tight ${className}`}>
      <svg viewBox="0 0 10 7" className="mr-[0.08em] mt-[0.12em] h-[0.42em] w-[0.6em] text-accent" aria-hidden>
        <path d="M3 0h7L7 7H0z" fill="currentColor" />
      </svg>
      MEDFORM
    </span>
  );
}
