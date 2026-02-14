import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { capitalizeWords } from '@/lib/format';
import { trackMenuAccessError, trackMenuAccessSuccess } from '@/lib/monitoring/sentry';

function safeTrackMenuAccessError(error: unknown, venueId: string, tableId?: string, userAgent?: string) {
  try {
    trackMenuAccessError(error, venueId, tableId, userAgent);
  } catch (trackingError) {
    console.warn('SENTRY_TRACK_MENU_ERROR_FAILED', trackingError);
  }
}

function safeTrackMenuAccessSuccess(venueId: string, tableId?: string, loadTime?: number) {
  try {
    trackMenuAccessSuccess(venueId, tableId, loadTime);
  } catch (trackingError) {
    console.warn('SENTRY_TRACK_MENU_SUCCESS_FAILED', trackingError);
  }
}

export async function GET(req: NextRequest, { params }: { params: { slug: string }}) {
  const startTime = Date.now();
  const userAgent = req.headers.get('user-agent') ?? undefined;
  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('tableId') ?? undefined;

  try {
    const rl = await rateLimit(req, { key: 'menu:get', limit: 120, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });

    const venue = await prisma.venue.findUnique({
      where: { slug: params.slug },
      select: { id:true, name:true, slug:true, announcement:true, openingHours:true }
    });

    if (!venue) {
      // Track 404 errors for monitoring venue slug issues
      safeTrackMenuAccessError(
        new Error(`Venue not found: ${params.slug}`),
        'unknown',
        tableId,
        userAgent
      );
      return NextResponse.json({ error: 'Mekan bulunamadı' }, { status: 404 });
    }

    const categories = await prisma.category.findMany({
      where: { venueId: venue.id, isVisible: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, imageUrl: true, displayOrder: true },
    });
    const subCategories = await prisma.subCategory.findMany({
      where: { venueId: venue.id, isVisible: true },
      orderBy: [{ categoryId: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, categoryId: true, venueId: true, name: true, slug: true, displayOrder: true },
    });

    const products = await prisma.product.findMany({
      where: { venueId: venue.id, isActive: true, deletedAt: null },
      orderBy: [
        { categoryId: 'asc' },
        { subCategoryId: 'asc' },
        { priceCents: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        categoryId: true,
        subCategoryId: true,
        description: true,
        priceCents: true,
        imageUrl: true,
        isInStock: true,
        dietTags: true,
      },
    });

    const normalizedProducts = products.map((product) => ({
      ...product,
      name: capitalizeWords(product.name),
    }));

    // Fire-and-forget view log - don't block response on this
    prisma.viewLog.create({
      data: {
        venueId: venue.id,
        tableId: tableId ?? null,
        userAgent: userAgent ?? null
      }
    }).catch((error) => {
      console.error('Failed to log view:', error);
    });

    // Track successful menu load
    const loadTime = Date.now() - startTime;
    safeTrackMenuAccessSuccess(venue.id, tableId, loadTime);

    const res = NextResponse.json({ venue, products: normalizedProducts, categories, subCategories });
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('Menu API error:', error);

    // Track menu access errors with context
    safeTrackMenuAccessError(error, 'unknown', tableId, userAgent);

    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? `${error.message}`
        : 'Menü yüklenirken bir hata oluştu. Lütfen tekrar deneyin.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
