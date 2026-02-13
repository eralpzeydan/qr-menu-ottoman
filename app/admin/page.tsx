import AuthGate from './_components/AuthGate';
import { prisma } from '@/lib/prisma';
import { requireAdminOnServer } from '@/lib/auth/server-session';

export const metadata = { title: 'Admin • Dashboard' };

export default async function AdminHome() {
  await requireAdminOnServer();
  const [productCount, venueCount] = await Promise.all([
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.venue.count(),
  ]);

  return (
    <AuthGate>
      <main className="max-w-screen-md mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Toplam Ürün" value={productCount} />
          <Stat label="Mekan" value={venueCount} />
        </div>

        <div className="flex gap-3">
          <a className="underline" href="/admin/products">Ürünler</a>
          <a className="underline" href="/admin/products/new">Yeni Ürün</a>
          <a className="underline" href="/admin/categories">Kategoriler</a>
        </div>
      </main>
    </AuthGate>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
