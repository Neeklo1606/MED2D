export const metadata = { title: "Нет соединения", robots: { index: false } };

export default function Offline() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="font-display text-2xl font-black uppercase">Нет соединения</p>
      <p className="mt-3 text-sm text-muted">Проверьте интернет. Корзина сохранена на этом устройстве.</p>
    </main>
  );
}
