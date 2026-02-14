import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { productPatchSchema } from '@/lib/schemas';
import { toProductSlug } from '@/lib/products/slug';
import { ensureAdmin, ensureCsrf } from '@/lib/api/guards';
import { resolveCategorySelection } from '@/lib/products/category';
import { resolveSubCategorySelection } from '@/lib/products/subcategory';

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 });
  }
  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const existing = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, venueId: true, categoryId: true, subCategoryId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
  }

  const updateData: Prisma.ProductUncheckedUpdateInput = {};
  if (d.name) updateData.name = d.name;
  if (d.slug) {
    const normalized = toProductSlug(d.slug);
    if (!normalized) {
      return NextResponse.json({ error: 'Geçersiz slug' }, { status: 400 });
    }
    updateData.slug = normalized;
  }
  let nextCategoryId: string | null = existing.categoryId ?? null;
  if (d.category !== undefined || d.categoryId) {
    try {
      const selection = await resolveCategorySelection({ categoryId: d.categoryId, category: d.category });
      updateData.category = selection.categoryValue;
      updateData.categoryId = selection.categoryId;
      nextCategoryId = selection.categoryId;
      if (d.subCategoryId === undefined) {
        updateData.subCategoryId = null;
      }
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
          : 'Kategori güncellenemedi';
      return NextResponse.json({ error: message }, { status });
    }
  }
  if (d.subCategoryId !== undefined) {
    if (d.subCategoryId === null) {
      updateData.subCategoryId = null;
    } else {
      if (!nextCategoryId) {
        return NextResponse.json({ error: 'Alt kategori için geçerli kategori zorunlu' }, { status: 400 });
      }
      try {
        const resolvedSubCategoryId = await resolveSubCategorySelection({
          subCategoryId: d.subCategoryId,
          categoryId: nextCategoryId,
          venueId: existing.venueId,
        });
        updateData.subCategoryId = resolvedSubCategoryId;
      } catch (err) {
        const status =
          typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: number }).status === 'number'
            ? (err as { status: number }).status
            : 400;
        const message = err instanceof Error ? err.message : 'Alt kategori güncellenemedi';
        return NextResponse.json({ error: message }, { status });
      }
    }
  }
  if (d.description !== undefined) updateData.description = d.description ?? null;
  if (d.priceCents !== undefined) updateData.priceCents = d.priceCents;
  if (d.isActive !== undefined) updateData.isActive = d.isActive;
  if (d.isInStock !== undefined) updateData.isInStock = d.isInStock;
  if (d.dietTags !== undefined) {
    updateData.dietTags = d.dietTags.length ? JSON.stringify(d.dietTags) : null;
  }

  try {
    await prisma.product.update({ where: { id: params.id }, data: updateData });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: string }).code === 'string'
        ? (err as { code: string }).code
        : undefined;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Bu slug zaten kullanımda' }, { status: 409 });
    }
    if (code === 'P2025') return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
    console.error('PRODUCT_PATCH_ERROR', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string }}) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureCsrf();
  if (csrfError) return csrfError;

  // Soft delete
  try {
    await prisma.product.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false }
    });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code?: string }).code === 'string'
        ? (err as { code: string }).code
        : undefined;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
    }
    console.error('PRODUCT_DELETE_ERROR', err);
    return NextResponse.json({ error: 'Beklenmeyen hata' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
