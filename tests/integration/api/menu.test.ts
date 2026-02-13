import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prisma = vi.hoisted(() => ({
  venue: { findUnique: vi.fn() },
  category: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  viewLog: { create: vi.fn() },
}));
const rateLimit = vi.hoisted(() => vi.fn());
const qrMocks = vi.hoisted(() => ({
  toBuffer: vi.fn(),
  toString: vi.fn(),
}));
const guardMocks = vi.hoisted(() => ({
  ensureAdmin: vi.fn(),
  ensureRequestCsrf: vi.fn(),
}));
const sentryMocks = vi.hoisted(() => ({
  trackMenuAccessError: vi.fn(),
  trackMenuAccessSuccess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit }));
vi.mock('qrcode', () => ({ default: qrMocks, ...qrMocks }));
vi.mock('@/lib/api/guards', () => guardMocks);
vi.mock('@/lib/monitoring/sentry', () => sentryMocks);

import { GET as menuGET } from '@/app/api/venue/[slug]/menu/route';
import { POST as qrPOST } from '@/app/api/qr/[tableId]/route';

describe('Menu and QR API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.mockReturnValue({ ok: true, remaining: 10 });
    prisma.venue.findUnique.mockResolvedValue({ id: 'v1', name: 'Cafe', slug: 'ornek-kafe' });
    prisma.category.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.viewLog.create.mockResolvedValue({ id: 'log1', venueId: 'v1', tableId: 'T1', userAgent: null, createdAt: new Date() });
    qrMocks.toBuffer.mockResolvedValue(Buffer.from('pngdata'));
    qrMocks.toString.mockResolvedValue('<svg></svg>');
    guardMocks.ensureAdmin.mockResolvedValue(null);
    guardMocks.ensureRequestCsrf.mockReturnValue(null);
  });

  function buildMenuRequest(slug = 'ornek-kafe') {
    return new Request(`http://localhost/api/venue/${slug}/menu?tableId=T1`, { method: 'GET' }) as unknown as NextRequest;
  }

  function buildQrRequest(body: any) {
    return new Request('http://localhost/api/qr/1', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest;
  }

  describe('GET /api/venue/[slug]/menu', () => {
    it('returns 404 when venue missing', async () => {
      prisma.venue.findUnique.mockResolvedValue(null);
      const res = await menuGET(buildMenuRequest(), { params: { slug: 'missing' } });
      expect(res.status).toBe(404);
    });

    it('returns venue data and logs view', async () => {
      const res = await menuGET(buildMenuRequest(), { params: { slug: 'ornek-kafe' } });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ venue: { id: 'v1', name: 'Cafe', slug: 'ornek-kafe' }, products: [], categories: [] });
      expect(prisma.viewLog.create).toHaveBeenCalled();
    });

    it('capitalizes product names for display', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'cortado',
          slug: 'cortado',
          category: null,
          categoryId: null,
          description: null,
          priceCents: 5500,
          imageUrl: null,
          isInStock: true,
          dietTags: [],
        },
        {
          id: 'p2',
          name: 'buzlu latte',
          slug: 'buzlu-latte',
          category: null,
          categoryId: null,
          description: null,
          priceCents: 6500,
          imageUrl: null,
          isInStock: true,
          dietTags: [],
        },
      ]);

      const res = await menuGET(buildMenuRequest(), { params: { slug: 'ornek-kafe' } });
      const body = await res.json();

      expect(body.products.map((p: any) => p.name)).toEqual(['Cortado', 'Buzlu Latte']);
    });

    it('returns 429 when rate limit exceeded', async () => {
      rateLimit.mockReturnValue({ ok: false, remaining: 0 });
      const res = await menuGET(buildMenuRequest(), { params: { slug: 'ornek-kafe' } });
      expect(res.status).toBe(429);
    });
  });

  describe('POST /api/qr/[tableId]', () => {
    it('requires url in payload', async () => {
      const res = await qrPOST(buildQrRequest({}), { params: { tableId: '1' } });
      expect(res.status).toBe(400);
    });

    it('returns svg by default', async () => {
      const res = await qrPOST(buildQrRequest({ url: 'https://example.com' }), { params: { tableId: '1' } });
      expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
      expect(await res.text()).toBe('<svg></svg>');
    });

    it('returns png when requested', async () => {
      const res = await qrPOST(buildQrRequest({ url: 'https://example.com', format: 'png' }), { params: { tableId: '1' } });
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(qrMocks.toBuffer).toHaveBeenCalled();
    });
  });
});
