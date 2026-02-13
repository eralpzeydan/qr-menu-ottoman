import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));
const ironSessionMock = vi.hoisted(() => ({
  getIronSession: vi.fn(),
}));
const bcryptMock = vi.hoisted(() => ({ compare: vi.fn() }));
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('iron-session', () => ironSessionMock);
vi.mock('bcryptjs', () => ({ default: { compare: bcryptMock.compare } }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: rateLimitMock }));

const { getIronSession } = ironSessionMock;
const bcryptCompare = bcryptMock.compare;

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { GET as meGET } from '@/app/api/auth/me/route';
import { GET as csrfGET } from '@/app/api/csrf/route';

const TEST_CSRF_TOKEN = 'csrf-test-token';

function csrfHeaders(extra?: HeadersInit) {
  return {
    'x-csrf-token': TEST_CSRF_TOKEN,
    cookie: `XSRF-TOKEN=${TEST_CSRF_TOKEN}`,
    ...extra,
  };
}

describe('Auth API routes', () => {
  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      bcryptCompare.mockResolvedValue(true);
      getIronSession.mockResolvedValue({ user: undefined, save: vi.fn() });
      rateLimitMock.mockReturnValue({ ok: true, remaining: 9 });
    });

    function buildRequest(body: any) {
      return new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: csrfHeaders({ 'content-type': 'application/json' }),
      }) as unknown as NextRequest;
    }

    it('returns 400 when body is invalid', async () => {
      const res = await loginPOST(buildRequest({ email: 'bad', password: '1' }));
      expect(res.status).toBe(400);
    });

    it('returns 401 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await loginPOST(buildRequest({ email: 'a@b.com', password: 'secret1' }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Geçersiz bilgiler' });
    });

    it('sets iron-session when credentials are valid', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'hash', role: 'ADMIN' });
      const save = vi.fn();
      getIronSession.mockResolvedValue({ user: undefined, save });
      const res = await loginPOST(buildRequest({ email: 'a@b.com', password: 'secret1' }));
      expect(res.status).toBe(200);
      expect(save).toHaveBeenCalled();
    });

    it('returns 401 when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: 'hash' });
      bcryptCompare.mockResolvedValue(false);
      const res = await loginPOST(buildRequest({ email: 'a@b.com', password: 'wrongpass' }));
      expect(res.status).toBe(401);
    });

    it('returns 403 when csrf headers missing', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'secret1' }),
      }) as unknown as NextRequest;
      const res = await loginPOST(req);
      expect(res.status).toBe(403);
    });

    it('returns 429 when rate limit exceeded', async () => {
      rateLimitMock.mockReturnValueOnce({ ok: false, remaining: 0 });
      const res = await loginPOST(buildRequest({ email: 'a@b.com', password: 'secret1' }));
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: 'Çok fazla deneme yapıldı' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('destroys the current session', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      getIronSession.mockResolvedValue({ destroy });
      const req = new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: csrfHeaders(),
      }) as unknown as NextRequest;
      const res = await logoutPOST(req);
      expect(res.status).toBe(200);
      expect(destroy).toHaveBeenCalled();
    });

    it('returns 403 when csrf headers missing', async () => {
      const destroy = vi.fn();
      getIronSession.mockResolvedValue({ destroy });
      const req = new Request('http://localhost/api/auth/logout', { method: 'POST' }) as unknown as NextRequest;
      const res = await logoutPOST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when session missing', async () => {
      getIronSession.mockResolvedValue({ user: undefined });
      const req = new Request('http://localhost/api/auth/me') as unknown as NextRequest;
      const res = await meGET(req);
      expect(res.status).toBe(401);
    });

    it('returns current session user', async () => {
      const user = { id: 'u1', email: 'test@example.com', role: 'ADMIN' as const };
      getIronSession.mockResolvedValue({ user });
      const req = new Request('http://localhost/api/auth/me') as unknown as NextRequest;
      const res = await meGET(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user });
    });
  });

  describe('GET /api/csrf', () => {
    it('returns ok and sets csrf cookie', async () => {
      const res = await csrfGET();
      expect(res.status).toBe(200);
      const cookie = res.cookies.get('XSRF-TOKEN');
      expect(cookie?.value).toHaveLength(64);
      expect(cookie?.httpOnly).toBe(false);
    });
  });
});
