import { prisma } from '@/lib/prisma';

type SubCategoryInput = {
  subCategoryId?: string | null;
  categoryId?: string | null;
  venueId?: string | null;
};

export async function resolveSubCategorySelection({
  subCategoryId,
  categoryId,
  venueId,
}: SubCategoryInput) {
  if (!subCategoryId) return null;

  const record = await prisma.subCategory.findUnique({
    where: { id: subCategoryId },
    select: { id: true, categoryId: true, venueId: true },
  });
  if (!record) {
    const err = new Error('Alt kategori bulunamadı');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (categoryId && record.categoryId !== categoryId) {
    const err = new Error('Alt kategori seçilen kategoriye ait değil');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (venueId && record.venueId !== venueId) {
    const err = new Error('Alt kategori seçilen mekana ait değil');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  return record.id;
}

