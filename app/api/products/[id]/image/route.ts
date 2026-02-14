import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { StorageAdapter } from '@/lib/storage';
import { getStorageAdapter } from '@/lib/storage/provider';
import { ensureAdmin, ensureRequestCsrf } from '@/lib/api/guards';

const MAX = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg','image/png','image/webp'];

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureRequestCsrf(req);
  if (csrfError) return csrfError;

  const product = await prisma.product.findUnique({ where: { id: params.id }, select: { id: true, imageUrl: true } });
  if (!product) {
    return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Geçersiz form verisi' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya zorunlu' }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: 'Dosya çok büyük' }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Geçersiz MIME' }, { status: 400 });
  }

  let adapter: StorageAdapter;
  try {
    adapter = getStorageAdapter();
  } catch (err) {
    console.error('PRODUCT_IMAGE_STORAGE_CONFIG_ERROR', err);
    return NextResponse.json({ error: 'Storage ayari eksik veya gecersiz' }, { status: 500 });
  }

  let stored: { url: string; remove?: () => Promise<void> } | null = null;
  try {
    stored = await adapter.save(file, { folder: 'uploads' });
  } catch (err) {
    console.error('PRODUCT_IMAGE_SAVE_ERROR', err);
    const message =
      process.env.NODE_ENV === 'development' && err instanceof Error
        ? `Fotoğraf yüklenemedi: ${err.message}`
        : 'Fotoğraf yüklenemedi';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await prisma.product.update({ where: { id: product.id }, data: { imageUrl: stored.url } });
  } catch (err) {
    await stored.remove?.().catch((removeError) => {
      console.warn('PRODUCT_IMAGE_CLEANUP_ERROR', removeError);
    });
    console.error('PRODUCT_IMAGE_ASSIGN_ERROR', err);
    return NextResponse.json({ error: 'Fotoğraf kaydedilemedi' }, { status: 500 });
  }

  if (product.imageUrl && typeof adapter.remove === 'function') {
    adapter.remove(product.imageUrl).catch((removeError) => {
      console.warn('PRODUCT_IMAGE_REMOVE_ORPHAN_ERROR', removeError);
    });
  }

  return NextResponse.json({ url: stored.url });
}
