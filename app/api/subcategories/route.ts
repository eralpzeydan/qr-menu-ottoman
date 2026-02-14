import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';
import { subCategoryCreateSchema } from '@/lib/schemas';
import { toProductSlug } from '@/lib/products/slug';

export async function POST(req: NextRequest) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  const parsed = subCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, venueId: data.venueId },
    select: { id: true, venueId: true },
  });
  if (!category) {
    return NextResponse.json({ error: 'Geçerli kategori bulunamadı' }, { status: 400 });
  }

  const slug = toProductSlug(data.name);
  if (!slug) {
    return NextResponse.json({ error: 'İsimden slug üretilemedi' }, { status: 400 });
  }

  let displayOrder = data.displayOrder;
  if (displayOrder === undefined) {
    const agg = await prisma.subCategory.aggregate({
      where: { categoryId: category.id },
      _max: { displayOrder: true },
    });
    displayOrder = (agg._max.displayOrder ?? -1) + 1;
  }

  try {
    const subCategory = await prisma.subCategory.create({
      data: {
        venueId: category.venueId,
        categoryId: category.id,
        name: data.name.trim(),
        slug,
        displayOrder,
        isVisible: data.isVisible ?? true,
      },
      select: {
        id: true,
        venueId: true,
        categoryId: true,
        name: true,
        slug: true,
        displayOrder: true,
        isVisible: true,
      },
    });
    return NextResponse.json({ subCategory }, { status: 201 });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: string }).code === 'string'
        ? (err as { code: string }).code
        : undefined;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Bu alt kategori bu kategoride zaten var' }, { status: 409 });
    }
    console.error('SUBCATEGORY_CREATE_ERROR', err);
    return NextResponse.json({ error: 'Alt kategori oluşturulamadı' }, { status: 500 });
  }
}

