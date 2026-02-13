import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { productCreateSchema } from '@/lib/schemas';
import { ensureAdmin, ensureCsrf, ensureRequestCsrf } from '@/lib/api/guards';
import { toProductSlug } from '@/lib/products/slug';
import { resolveCategorySelection } from '@/lib/products/category';

export async function GET(req: NextRequest) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureRequestCsrf(req);
  if (csrfError) return csrfError;
  const rl = await rateLimit(req, { key: 'products:get', limit: 120, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q') || '';
  const activeRaw = searchParams.get('active');
  const isActiveFilter = (activeRaw === null || activeRaw === '') ? undefined : activeRaw === 'true';
  
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    isActive: isActiveFilter,
    ...(category ? { category } : {}),
    OR: q ? [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } }
    ] : undefined
  };

  const items = await prisma.product.findMany({
    where, orderBy: { createdAt: 'desc' },
    select: { id:true, name:true, slug:true, category:true, description:true, priceCents:true, imageUrl:true, isInStock:true, isActive:true, venueId:true }
  });

  const res = NextResponse.json({ items });
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  return res;
}

export async function POST(req: NextRequest) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;

  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  // Body
  const body = await req.json().catch(() => null);
  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let categorySelection: { categoryId: string | null; categoryValue: string };
  try {
    categorySelection = await resolveCategorySelection({
      categoryId: data.categoryId,
      category: data.category,
    });
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: number }).status === 'number'
        ? (err as { status: number }).status
        : 400;
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message?: string }).message === 'string'
        ? (err as { message?: string }).message
        : 'Kategori seçilemedi';
    return NextResponse.json({ error: message }, { status });
  }

  // venueId hem gerçek id hem de slug (örn. "ornek-kafe") olabilir → id’ye çevir
  let venueId = data.venueId;
  let venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    venue = await prisma.venue.findUnique({ where: { slug: venueId } });
  }
  if (!venue) {
    return NextResponse.json({ error: 'Geçerli bir mekan (venue) bulunamadı' }, { status: 400 });
  }
  venueId = venue.id;

  // slug üret
  const baseSlugRaw = data.slug || data.name || '';
  const normalizedSlug = toProductSlug(baseSlugRaw);
  const slug = normalizedSlug || 'urun';

  // Oluşturmayı dene; slug çakışırsa anlamlı hata ver veya otomatik son ek dene
  try {
    const created = await prisma.product.create({
      data: {
        venueId,
        name: data.name,
        slug,
        category: categorySelection.categoryValue,
        categoryId: categorySelection.categoryId,
        description: data.description ?? null,
        priceCents: data.priceCents,
        isActive: data.isActive ?? true,
        isInStock: data.isInStock ?? true,
        dietTags: data.dietTags && data.dietTags.length ? JSON.stringify(data.dietTags) : null,
      },
      select: { id: true }
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    const code =
      typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code?: string }).code === 'string'
        ? (e as { code: string }).code
        : undefined;
    if (code === 'P2002') {
      // Aynı slug mevcut → 2..10 son ek deneyelim
      for (let i = 2; i <= 10; i++) {
        try {
          const created = await prisma.product.create({
            data: {
              venueId,
              name: data.name,
              slug: `${slug}-${i}`,
              category: categorySelection.categoryValue,
              categoryId: categorySelection.categoryId,
              description: data.description ?? null,
              priceCents: data.priceCents,
              isActive: data.isActive ?? true,
              isInStock: data.isInStock ?? true,
              dietTags: data.dietTags && data.dietTags.length ? JSON.stringify(data.dietTags) : null,
            },
            select: { id: true }
          });
          return NextResponse.json({ id: created.id }, { status: 201 });
        } catch (err) {
          const nestedCode =
            typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: string }).code === 'string'
              ? (err as { code: string }).code
              : undefined;
          if (nestedCode !== 'P2002') throw err;
        }
      }
      return NextResponse.json({ error: 'Bu isimle ürün zaten var (slug çakışması)' }, { status: 409 });
    }
    console.error('PRODUCT_CREATE_ERROR', e);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }
}
