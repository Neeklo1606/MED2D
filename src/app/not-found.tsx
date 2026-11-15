import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-6xl font-black text-accent">404</p>
        <p className="mt-3">Страница не найдена</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-white">На главную</Link>
      </div>
    </main>
  );
}
