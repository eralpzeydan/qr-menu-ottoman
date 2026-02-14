import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const subCategory = await prisma.subCategory.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!subCategory) {
    return NextResponse.json({ error: 'Alt kategori bulunamadı' }, { status: 404 });
  }

  const productCount = await prisma.product.count({ where: { subCategoryId: params.id, deletedAt: null } });
  if (productCount > 0) {
    return NextResponse.json({ error: 'Bu alt kategoriye bağlı ürünler var, silinemez' }, { status: 400 });
  }

  try {
    await prisma.subCategory.delete({ where: { id: params.id } });
  } catch (err) {
    console.error('SUBCATEGORY_DELETE_ERROR', err);
    return NextResponse.json({ error: 'Alt kategori silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

