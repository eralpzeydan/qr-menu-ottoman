import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productPriceChangeSchema } from '@/lib/schemas';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 });
  }
  const parsed = productPriceChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { newPriceCents, reason } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: 'Ürün yok' }, { status: 404 });
  if (product.priceCents === newPriceCents) {
    return NextResponse.json({ error: 'Fiyat değişmedi' }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.priceHistory.create({
        data: {
          productId: product.id,
          oldPriceCents: product.priceCents,
          newPriceCents,
          reason,
        }
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { priceCents: newPriceCents }
      })
    ]);
  } catch (err) {
    console.error('PRODUCT_PRICE_CHANGE_ERROR', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, newPriceCents });
}
