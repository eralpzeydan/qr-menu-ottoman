import AuthGate from '../_components/AuthGate';
import CategoryManager from './CategoryManager';
import { requireAdminOnServer } from '@/lib/auth/server-session';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Admin • Kategoriler' };

export default async function CategoriesPage() {
  await requireAdminOnServer();
  const [venues, categories] = await Promise.all([
    prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.category.findMany({
      orderBy: [{ venueId: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        venueId: true,
        name: true,
        slug: true,
        imageUrl: true,
        displayOrder: true,
        isVisible: true,
      },
    }),
  ]);

  return (
    <AuthGate>
      <main className="max-w-screen-lg mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Kategoriler</h1>
          <a className="underline text-sm" href="/admin/products">Ürünler</a>
        </div>
        <CategoryManager venues={venues} initialCategories={categories} />
      </main>
    </AuthGate>
  );
}
