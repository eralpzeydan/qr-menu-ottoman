import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prisma = vi.hoisted(() => ({
  product: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  venue: {
    findUnique: vi.fn(),
  },
  category: {
    findFirst: vi.fn(),
  },
  priceHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const rateLimit = vi.hoisted(() => vi.fn());
const csrfMocks = vi.hoisted(() => ({
  verifyCsrfFromRequest: vi.fn(),
  verifyCsrf: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({ readSession: vi.fn() }));
const storageSave = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit }));
vi.mock('@/lib/auth/csrf', () => csrfMocks);
vi.mock('@/lib/auth/session', () => sessionMocks);
vi.mock('@/lib/storage/local', () => ({ localAdapter: { save: storageSave } }));
vi.mock('@/lib/storage/supabase', () => ({
  isSupabaseStorageEnabled: () => false,
  supabaseAdapter: { save: vi.fn() },
}));
vi.mock('@/lib/storage/provider', () => ({
  getStorageAdapter: () => ({ save: storageSave, remove: vi.fn() }),
}));

const { verifyCsrfFromRequest, verifyCsrf } = csrfMocks;
const { readSession } = sessionMocks;

import { GET as productsGET, POST as productsPOST } from '@/app/api/products/route';
import { PATCH as productPATCH, DELETE as productDELETE } from '@/app/api/products/[id]/route';
import { POST as productImagePOST } from '@/app/api/products/[id]/image/route';
import { POST as productChangePOST } from '@/app/api/products/[id]/change/route';

describe('Products API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockReturnValue({ ok: true, remaining: 1 });
    verifyCsrfFromRequest.mockImplementation(() => {});
    verifyCsrf.mockImplementation(() => {});
    readSession.mockResolvedValue({ user: { role: 'ADMIN' } });
    prisma.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Latte' }]);
    prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1', slug: 'ornek-kafe' });
    prisma.product.create.mockResolvedValue({ id: 'p-created' });
    prisma.product.update.mockResolvedValue({ id: 'p1' });
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', priceCents: 1000 });
    storageSave.mockResolvedValue({ url: '/uploads/img.jpg' });
    prisma.category.findFirst.mockResolvedValue(null);
  });

  function buildRequest(path: string, init?: RequestInit) {
    return new Request(`http://localhost${path}`, init) as unknown as NextRequest;
  }

  describe('GET /api/products', () => {
    it('returns filtered products when csrf passes and rate limit ok', async () => {
      const res = await productsGET(buildRequest('/api/products?q=latte&category=COLD'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: [{ id: 'p1', name: 'Latte' }] });
      expect(prisma.product.findMany).toHaveBeenCalled();
    });

    it('returns 403 when csrf fails', async () => {
      verifyCsrfFromRequest.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const res = await productsGET(buildRequest('/api/products'));
      expect(res.status).toBe(403);
    });

    it('returns 429 when rate limit exceeded', async () => {
      rateLimit.mockReturnValue({ ok: false, remaining: 0 });
      const res = await productsGET(buildRequest('/api/products'));
      expect(res.status).toBe(429);
    });
  });

  describe('POST /api/products', () => {
    it('rejects when user not admin', async () => {
      readSession.mockResolvedValue({ user: undefined });
      const req = buildRequest('/api/products', { method: 'POST', body: JSON.stringify({}) });
      const res = await productsPOST(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid body', async () => {
      const req = buildRequest('/api/products', { method: 'POST', body: JSON.stringify({ name: '' }) });
      const res = await productsPOST(req);
      expect(res.status).toBe(400);
    });

    it('returns 403 when csrf verification fails', async () => {
      verifyCsrf.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const body = {
        venueId: 'ornek-kafe',
        name: 'Mocha',
        category: 'HOT',
        priceCents: 1500,
      };
      const req = buildRequest('/api/products', { method: 'POST', body: JSON.stringify(body) });
      const res = await productsPOST(req);
      expect(res.status).toBe(403);
    });

    it('creates a product when payload is valid and slug unique', async () => {
      const body = {
        venueId: 'ornek-kafe',
        name: 'Flat White',
        category: 'HOT',
        priceCents: 1200,
      };
      const req = buildRequest('/api/products', { method: 'POST', body: JSON.stringify(body) });
      const res = await productsPOST(req);
      expect(res.status).toBe(201);
      expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ name: 'Flat White', slug: 'flat-white' }),
      }));
    });

    it('retries slug when unique constraint hits', async () => {
      let attempts = 0;
      prisma.product.create.mockImplementation(async () => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error('duplicate') as any;
          error.code = 'P2002';
          throw error;
        }
        return { id: 'second-slug' };
      });
      const body = {
        venueId: 'ornek-kafe',
        name: 'Latte',
        category: 'HOT',
        priceCents: 1300,
      };
      const res = await productsPOST(buildRequest('/api/products', { method: 'POST', body: JSON.stringify(body) }));
      expect(res.status).toBe(201);
      expect(attempts).toBe(2);
    });

    it('returns 409 when slug keeps colliding', async () => {
      prisma.product.create.mockImplementation(() => {
        const err = new Error('duplicate') as any;
        err.code = 'P2002';
        throw err;
      });
      const body = {
        venueId: 'ornek-kafe',
        name: 'Latte',
        category: 'HOT',
        priceCents: 1300,
      };
      const res = await productsPOST(buildRequest('/api/products', { method: 'POST', body: JSON.stringify(body) }));
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json).toEqual({ error: 'Bu isimle ürün zaten var (slug çakışması)' });
    });

    it('returns 400 when venue not found', async () => {
      prisma.venue.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const body = {
        venueId: 'missing',
        name: 'Latte',
        category: 'HOT',
        priceCents: 1200,
      };
      const res = await productsPOST(buildRequest('/api/products', { method: 'POST', body: JSON.stringify(body) }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Geçerli bir mekan (venue) bulunamadı' });
    });
  });

  describe('PATCH /api/products/[id] & DELETE', () => {
    it('rejects PATCH without admin session', async () => {
      readSession.mockResolvedValue({ user: undefined });
      const res = await productPATCH(
        buildRequest('/api/products/123', { method: 'PATCH', body: JSON.stringify({ name: 'Latte' }) }),
        { params: { id: '123' } }
      );
      expect(res.status).toBe(401);
    });

    it('updates product with normalized slug', async () => {
      const res = await productPATCH(
        buildRequest('/api/products/123', { method: 'PATCH', body: JSON.stringify({ slug: 'NEW-SLUG', name: 'Latte' }) }),
        { params: { id: '123' } }
      );
      expect(res.status).toBe(200);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: expect.objectContaining({ slug: 'new-slug', name: 'Latte' }),
      });
    });

    it('returns 403 on PATCH when csrf fails', async () => {
      verifyCsrf.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const res = await productPATCH(
        buildRequest('/api/products/123', { method: 'PATCH', body: JSON.stringify({ name: 'Latte' }) }),
        { params: { id: '123' } }
      );
      expect(res.status).toBe(403);
    });

    it('soft deletes product on DELETE', async () => {
      const res = await productDELETE(buildRequest('/api/products/p1', { method: 'DELETE' }), { params: { id: 'p1' } });
      expect(res.status).toBe(200);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ isActive: false }),
      });
    });

    it('returns 403 on DELETE when csrf fails', async () => {
      verifyCsrf.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const res = await productDELETE(buildRequest('/api/products/p1', { method: 'DELETE' }), { params: { id: 'p1' } });
      expect(res.status).toBe(403);
    });

    it('returns 409 on PATCH when slug already exists', async () => {
      const err = new Error('duplicate') as any;
      err.code = 'P2002';
      prisma.product.update.mockRejectedValueOnce(err);
      const res = await productPATCH(
        buildRequest('/api/products/123', { method: 'PATCH', body: JSON.stringify({ slug: 'latte' }) }),
        { params: { id: '123' } }
      );
      expect(res.status).toBe(409);
    });

    it('returns 404 when DELETE target missing', async () => {
      const err = new Error('missing') as any;
      err.code = 'P2025';
      prisma.product.update.mockRejectedValueOnce(err);
      const res = await productDELETE(buildRequest('/api/products/p1', { method: 'DELETE' }), { params: { id: 'p1' } });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/products/[id]/image', () => {
    function buildImageReq(file?: File) {
      return {
        formData: async () => ({
          get: () => file,
        }),
      } as any;
    }

    it('returns 400 when file missing', async () => {
      const res = await productImagePOST(buildImageReq(undefined), { params: { id: 'p1' } });
      expect(res.status).toBe(400);
    });

    it('rejects files that are too large', async () => {
      const large = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
      const res = await productImagePOST(buildImageReq(large), { params: { id: 'p1' } });
      expect(res.status).toBe(413);
    });

    it('rejects invalid mime types', async () => {
      const file = new File([new Uint8Array(10)], 'doc.txt', { type: 'text/plain' });
      const res = await productImagePOST(buildImageReq(file), { params: { id: 'p1' } });
      expect(res.status).toBe(400);
    });

    it('saves valid image and updates prisma', async () => {
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await productImagePOST(buildImageReq(file), { params: { id: 'p1' } });
      expect(res.status).toBe(200);
      expect(storageSave).toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { imageUrl: '/uploads/img.jpg' } });
    });

    it('returns 403 when csrf header missing', async () => {
      verifyCsrfFromRequest.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await productImagePOST(buildImageReq(file), { params: { id: 'p1' } });
      expect(res.status).toBe(403);
    });

    it('returns 500 when storage adapter fails', async () => {
      storageSave.mockRejectedValueOnce(new Error('upload fail'));
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await productImagePOST(buildImageReq(file), { params: { id: 'p1' } });
      expect(res.status).toBe(500);
    });

    it('returns 500 when prisma update fails after upload', async () => {
      prisma.product.update.mockRejectedValueOnce(new Error('db'));
      const file = new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' });
      const res = await productImagePOST(buildImageReq(file), { params: { id: 'p1' } });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/products/[id]/change', () => {
    function buildChangeReq(body: any) {
      return new Request('http://localhost/api/products/p1/change', {
        method: 'POST',
        body: JSON.stringify(body),
      }) as unknown as NextRequest;
    }

    it('rejects invalid payloads', async () => {
      const res = await productChangePOST(buildChangeReq({ newPriceCents: -1 }), { params: { id: 'p1' } });
      expect(res.status).toBe(400);
    });

    it('rejects when not admin', async () => {
      readSession.mockResolvedValue({ user: undefined });
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1200, reason: 'update' }), { params: { id: 'p1' } });
      expect(res.status).toBe(401);
    });

    it('returns 404 when product missing', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1200, reason: 'update' }), { params: { id: 'p1' } });
      expect(res.status).toBe(404);
    });

    it('rejects when price unchanged', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', priceCents: 1500 });
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1500, reason: 'same' }), { params: { id: 'p1' } });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Fiyat değişmedi' });
    });

    it('creates price history and updates product', async () => {
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1200, reason: 'seasonal' }), { params: { id: 'p1' } });
      expect(res.status).toBe(200);
      expect(prisma.priceHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ newPriceCents: 1200, reason: 'seasonal' }),
      }));
      expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'p1' },
        data: { priceCents: 1200 },
      }));
    });

    it('returns 403 when csrf check fails', async () => {
      verifyCsrf.mockImplementation(() => {
        throw new Error('bad csrf');
      });
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1300, reason: 'adjust' }), { params: { id: 'p1' } });
      expect(res.status).toBe(403);
    });

    it('returns 500 when transaction throws', async () => {
      prisma.$transaction.mockRejectedValueOnce(new Error('db'));
      const res = await productChangePOST(buildChangeReq({ newPriceCents: 1300, reason: 'adjust' }), { params: { id: 'p1' } });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Beklenmeyen hata' });
    });
  });
});
