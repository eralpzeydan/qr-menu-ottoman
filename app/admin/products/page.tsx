import AuthGate from '../_components/AuthGate';
import Link from 'next/link';
import InlinePrice from './InlinePrice';
import DeleteButton from './DeleteButton';
import { prisma } from '@/lib/prisma';
import { requireAdminOnServer } from '@/lib/auth/server-session';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  categoryRel?: { name: string | null } | null;
  priceCents: number;
  isActive: boolean;
};

async function getProducts(): Promise<ProductRow[]> {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        categoryRel: { select: { name: true } },
        priceCents: true,
        isActive: true,
      },
  });
}
export const metadata = { title: 'Admin • Ürünler' };

export default async function ProductsPage() {
  await requireAdminOnServer();
  const items = await getProducts();

  return (
    <AuthGate>
      <main className="max-w-screen-lg mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Ürünler</h1>
          <Link href="/admin/products/new" className="rounded bg-black text-white px-3 py-2">
            Yeni Ürün
          </Link>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Ad</th>
                <th className="text-left p-2">Kategori</th>
                <th className="text-left p-2">Fiyat (TL)</th>
                <th className="text-left p-2">Durum</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.categoryRel?.name ?? p.category ?? '—'}</td>
                  <td className="p-2"><InlinePrice id={p.id} price={p.priceCents}/></td>
                  <td className="p-2">{p.isActive ? 'Aktif' : 'Pasif'}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Link className="underline" href={`/admin/products/${p.id}`}>Düzenle</Link>
                      <DeleteButton id={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {items.length===0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">Ürün yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AuthGate>
  );
}
