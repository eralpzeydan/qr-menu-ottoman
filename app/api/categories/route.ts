import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';
import { categoryCreateSchema } from '@/lib/schemas';
import { toProductSlug } from '@/lib/products/slug';

export async function POST(req: NextRequest) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const venue = await prisma.venue.findFirst({
    where: { OR: [{ id: data.venueId }, { slug: data.venueId }] },
    select: { id: true },
  });
  if (!venue) {
    return NextResponse.json({ error: 'Geçerli bir mekan bulunamadı' }, { status: 400 });
  }

  const slug = toProductSlug(data.name);
  if (!slug) {
    return NextResponse.json({ error: 'İsimden slug üretilemedi' }, { status: 400 });
  }

  let displayOrder = data.displayOrder;
  if (displayOrder === undefined) {
    const agg = await prisma.category.aggregate({
      where: { venueId: venue.id },
      _max: { displayOrder: true },
    });
    displayOrder = (agg._max.displayOrder ?? -1) + 1;
  }

  try {
    const category = await prisma.category.create({
      data: {
        venueId: venue.id,
        name: data.name.trim(),
        slug,
        imageUrl: data.imageUrl?.trim() || null,
        displayOrder,
        isVisible: data.isVisible ?? true,
      },
      select: {
        id: true,
        venueId: true,
        name: true,
        slug: true,
        imageUrl: true,
        displayOrder: true,
        isVisible: true,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: string }).code === 'string'
        ? (err as { code: string }).code
        : undefined;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Bu slug bu mekanda zaten var' }, { status: 409 });
    }
    console.error('CATEGORY_CREATE_ERROR', err);
    return NextResponse.json({ error: 'Kategori oluşturulamadı' }, { status: 500 });
  }
}
