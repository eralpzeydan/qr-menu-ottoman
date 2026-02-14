import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: 'Kategori bulunamadı' }, { status: 404 });
  }

  const productCount = await prisma.product.count({ where: { categoryId: params.id, deletedAt: null } });
  if (productCount > 0) {
    return NextResponse.json({ error: 'Bu kategoriye bağlı ürünler var, silinemez' }, { status: 400 });
  }
  const subCategoryCount = await prisma.subCategory.count({ where: { categoryId: params.id } });
  if (subCategoryCount > 0) {
    return NextResponse.json({ error: 'Bu kategoriye bağlı alt kategoriler var, silinemez' }, { status: 400 });
  }

  try {
    await prisma.category.delete({ where: { id: params.id } });
  } catch (err) {
    console.error('CATEGORY_DELETE_ERROR', err);
    return NextResponse.json({ error: 'Kategori silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
