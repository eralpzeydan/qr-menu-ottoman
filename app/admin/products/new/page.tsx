import AuthGate from '../../_components/AuthGate';
import NewProductForm from './NewProductForm';
import { requireAdminOnServer } from '@/lib/auth/server-session';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Admin • Yeni Ürün' };

export default async function NewProductPage() {
  await requireAdminOnServer();
  const [venues, categories] = await Promise.all([
    prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, venueId: true },
    }),
  ]);
  return (
    <AuthGate>
      <main className="max-w-screen-sm mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Yeni Ürün</h1>
        <NewProductForm venues={venues} categories={categories} />
      </main>
    </AuthGate>
  );
}
