import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prisma = vi.hoisted(() => ({
  category: {
    create: vi.fn(),
    aggregate: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  venue: {
    findFirst: vi.fn(),
  },
  product: {
    count: vi.fn(),
  },
}));
const csrfMocks = vi.hoisted(() => ({
  verifyCsrf: vi.fn(),
  verifyCsrfFromRequest: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({ readSession: vi.fn() }));
const storageSave = vi.hoisted(() => vi.fn());
const storageRemove = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/auth/csrf', () => csrfMocks);
vi.mock('@/lib/auth/session', () => sessionMocks);
vi.mock('@/lib/storage/local', () => ({ localAdapter: { save: storageSave, remove: storageRemove } }));
vi.mock('@/lib/storage/supabase', () => ({
  isSupabaseStorageEnabled: () => false,
  supabaseAdapter: { save: storageSave, remove: storageRemove },
}));
vi.mock('@/lib/storage/provider', () => ({
  getStorageAdapter: () => ({ save: storageSave, remove: storageRemove }),
}));

const { verifyCsrf } = csrfMocks;
const { readSession } = sessionMocks;

import { POST as categoryPOST } from '@/app/api/categories/route';
import { DELETE as categoryDELETE } from '@/app/api/categories/[id]/route';
import { POST as categoryImagePOST } from '@/app/api/categories/[id]/image/route';

function buildRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init) as unknown as NextRequest;
}

describe('Categories API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCsrf.mockImplementation(() => {});
    csrfMocks.verifyCsrfFromRequest.mockImplementation(() => {});
    readSession.mockResolvedValue({ user: { role: 'ADMIN' } });
    prisma.venue.findFirst.mockResolvedValue({ id: 'venue-1' });
    prisma.category.aggregate.mockResolvedValue({ _max: { displayOrder: 2 } });
    prisma.category.create.mockResolvedValue({
      id: 'cat-1',
      venueId: 'venue-1',
      name: 'Brunch & More',
      slug: 'brunch-more',
      imageUrl: null,
      displayOrder: 3,
      isVisible: true,
    });
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', imageUrl: null });
    prisma.product.count.mockResolvedValue(0);
    prisma.category.update.mockResolvedValue({ id: 'cat-1' });
    storageSave.mockResolvedValue({ url: '/uploads/img.jpg' });
    storageRemove.mockResolvedValue(undefined);
  });

  describe('POST /api/categories', () => {
    it('creates category with auto slug and next display order', async () => {
      const body = { venueId: 'venue-1', name: 'Brunch & More' };
      const res = await categoryPOST(
        buildRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
        })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.category).toMatchObject({
        venueId: 'venue-1',
        name: 'Brunch & More',
        slug: 'brunch-more',
        displayOrder: 3,
      });
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 3, slug: 'brunch-more' }),
        })
      );
    });

    it('returns 400 when venue not found', async () => {
      prisma.venue.findFirst.mockResolvedValue(null);
      const res = await categoryPOST(
        buildRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ venueId: 'missing', name: 'Hot' }),
          headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
        })
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Geçerli bir mekan bulunamadı' });
    });

    it('returns 409 when slug already exists', async () => {
      const error = new Error('duplicate') as any;
      error.code = 'P2002';
      prisma.category.create.mockRejectedValue(error);
      const res = await categoryPOST(
        buildRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ venueId: 'venue-1', name: 'Hot' }),
          headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
        })
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Bu slug bu mekanda zaten var' });
    });

    it('returns 403 when csrf fails', async () => {
      verifyCsrf.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const res = await categoryPOST(
        buildRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ venueId: 'venue-1', name: 'Hot' }),
          headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
        })
      );
      expect(res.status).toBe(403);
    });

    it('returns 401 when user not admin', async () => {
      readSession.mockResolvedValue({ user: undefined });
      const res = await categoryPOST(
        buildRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ venueId: 'venue-1', name: 'Hot' }),
          headers: { 'content-type': 'application/json', 'x-csrf-token': 't' },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/categories/[id]', () => {
    it('returns 404 when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      const res = await categoryDELETE(buildRequest('/api/categories/unknown', { method: 'DELETE' }), {
        params: { id: 'unknown' },
      });
      expect(res.status).toBe(404);
    });

    it('blocks delete when products exist', async () => {
      prisma.product.count.mockResolvedValue(2);
      const res = await categoryDELETE(buildRequest('/api/categories/c1', { method: 'DELETE' }), {
        params: { id: 'c1' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Bu kategoriye bağlı ürünler var, silinemez' });
    });

    it('deletes category when allowed', async () => {
      prisma.product.count.mockResolvedValue(0);
      const res = await categoryDELETE(buildRequest('/api/categories/c1', { method: 'DELETE' }), {
        params: { id: 'c1' },
      });
      expect(res.status).toBe(200);
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('returns 401 when user not admin', async () => {
      readSession.mockResolvedValue({ user: undefined });
      const res = await categoryDELETE(buildRequest('/api/categories/c1', { method: 'DELETE' }), {
        params: { id: 'c1' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/categories/[id]/image', () => {
    function buildImageReq(file?: File) {
      return {
        formData: async () => ({
          get: () => file,
        }),
      } as any;
    }

    it('returns 404 when category missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      const res = await categoryImagePOST(buildImageReq(), { params: { id: 'missing' } });
      expect(res.status).toBe(404);
    });

    it('returns 400 when file missing', async () => {
      const res = await categoryImagePOST(buildImageReq(undefined), { params: { id: 'cat-1' } });
      expect(res.status).toBe(400);
    });

    it('rejects oversized file', async () => {
      const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(413);
    });

    it('rejects invalid mime', async () => {
      const file = new File([new Uint8Array(10)], 'file.txt', { type: 'text/plain' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(400);
    });

    it('uploads and updates category', async () => {
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(200);
      expect(storageSave).toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { imageUrl: '/uploads/img.jpg' },
      });
    });

    it('returns 403 when csrf fails', async () => {
      csrfMocks.verifyCsrfFromRequest.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(403);
    });

    it('returns 500 when storage fails', async () => {
      storageSave.mockRejectedValueOnce(new Error('fail'));
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(500);
    });

    it('returns 500 when prisma update fails', async () => {
      prisma.category.update.mockRejectedValueOnce(new Error('db'));
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await categoryImagePOST(buildImageReq(file), { params: { id: 'cat-1' } });
      expect(res.status).toBe(500);
    });
  });
});
