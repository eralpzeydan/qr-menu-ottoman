import { prisma } from '@/lib/prisma';

type CategoryInput = {
  categoryId?: string | null;
  category?: string | null;
};

export async function resolveCategorySelection({ categoryId, category }: CategoryInput) {
  const resolvedValue = (category ?? '').trim();

  if (categoryId) {
    const record = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!record) {
      const err = new Error('Kategori bulunamadı');
      (err as Error & { status?: number }).status = 400;
      throw err;
    }
    return {
      categoryId: record.id,
      categoryValue: resolvedValue || record.slug || record.name || record.id,
    };
  }

  if (resolvedValue) {
    const normalized = resolvedValue.toLowerCase();
    const record = await prisma.category.findFirst({
      where: {
        OR: [
          { slug: normalized },
          { name: resolvedValue },
        ],
      },
    });
    if (record) {
      return {
        categoryId: record.id,
        categoryValue: record.slug || record.name || resolvedValue,
      };
    }
    return { categoryId: null, categoryValue: resolvedValue };
  }

  const err = new Error('Kategori zorunlu');
  (err as Error & { status?: number }).status = 400;
  throw err;
}
