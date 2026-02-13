import AuthGate from '../../_components/AuthGate';
import EditProductForm from './EditProductForm';
import { notFound } from 'next/navigation';
import { requireAdminOnServer } from '@/lib/auth/server-session';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Admin • Ürün Düzenle' };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdminOnServer();
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      category: true,
      categoryId: true,
      priceCents: true,
      description: true,
      isActive: true,
      isInStock: true,
      venueId: true,
    },
  });
  if (!product) notFound();

  const categories = await prisma.category.findMany({
    where: { venueId: product.venueId },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true },
  });

  return (
    <AuthGate>
      <main className="max-w-screen-sm mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Ürün Düzenle</h1>
        <EditProductForm product={product} categories={categories} />
      </main>
    </AuthGate>
  );
}
