import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('next/headers', () => {
  let headerToken: string | null = null;
  let cookieToken: string | null = null;
  return {
    headers: () => ({
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'x-csrf-token' || key === 'x-xsrf-token') return headerToken;
        return null;
      },
    }),
    cookies: () => ({
      get: (name: string) =>
        name === 'XSRF-TOKEN' && cookieToken !== null ? { value: cookieToken } : undefined,
    }),
    __setTokens: (header?: string | null, cookie?: string | null) => {
      headerToken = header ?? null;
      cookieToken = cookie ?? null;
    },
  };
});

const headersModule = await import('next/headers');
const { __setTokens } = headersModule as any;

const ironSessionMock = vi.hoisted(() => ({
  getIronSession: vi.fn(),
}));

vi.mock('iron-session', () => ironSessionMock);

const { getIronSession } = ironSessionMock;

import { verifyCsrfFromRequest, verifyCsrf } from '@/lib/auth/csrf';
import { requireAdmin } from '@/lib/auth/permissions';
import { readSession, getSession } from '@/lib/auth/session';
import { ensureCsrf, getCsrf } from '@/app/admin/_components/csrfClient';

describe('verifyCsrfFromRequest', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.CSRF_DEV_PERMISSIVE;
  });

  it('throws when header and cookie mismatch', () => {
    const req = {
      headers: new Headers([
        ['x-csrf-token', 'abc'],
        ['cookie', 'XSRF-TOKEN=xyz'],
      ]),
    } as unknown as NextRequest;
    expect(() => verifyCsrfFromRequest(req)).toThrow('CSRF token doğrulanamadı');
  });

  it('passes when tokens match', () => {
    const req = {
      headers: new Headers([
        ['x-xsrf-token', 'token123'],
        ['cookie', 'foo=bar; XSRF-TOKEN=token123'],
      ]),
    } as unknown as NextRequest;
    expect(() => verifyCsrfFromRequest(req)).not.toThrow();
  });

  it('allows permissive dev bypass when enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.CSRF_DEV_PERMISSIVE = '1';
    const req = {
      headers: new Headers(),
    } as unknown as NextRequest;
    expect(() => verifyCsrfFromRequest(req)).not.toThrow();
  });
});

describe('verifyCsrf (server helpers)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.CSRF_DEV_PERMISSIVE;
    __setTokens(null, null);
  });

  it('throws without matching tokens', () => {
    __setTokens('abc', 'xyz');
    expect(() => verifyCsrf()).toThrow('CSRF token doğrulanamadı');
  });

  it('passes when both tokens match', () => {
    __setTokens('secure', 'secure');
    expect(() => verifyCsrf()).not.toThrow();
  });

  it('skips validation when dev permissive flag is set', () => {
    process.env.NODE_ENV = 'development';
    process.env.CSRF_DEV_PERMISSIVE = '1';
    __setTokens(undefined, undefined);
    expect(() => verifyCsrf()).not.toThrow();
  });
});

describe('requireAdmin', () => {
  it('returns the admin user when session is authorized', async () => {
    const user = { id: '1', email: 'a', role: 'ADMIN' as const };
    getIronSession.mockResolvedValue({ user });
    const result = await requireAdmin({} as any, {} as any);
    expect(result).toEqual(user);
  });

  it('throws 401 when user missing or not admin', async () => {
    getIronSession.mockResolvedValue({ user: { role: 'VIEWER' } });
    await expect(requireAdmin({} as any, {} as any)).rejects.toMatchObject({ status: 401 });
  });
});

describe('session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIronSession.mockResolvedValue({ user: { id: '1' } });
  });

  it('readSession delegates to iron-session', async () => {
    const req = {} as any;
    const res = {} as any;
    const session = await readSession(req, res);
    expect(getIronSession).toHaveBeenCalledWith(req, res, expect.objectContaining({ cookieName: 'qrmenu_session' }));
    expect(session).toEqual({ user: { id: '1' } });
  });

  it('getSession delegates to iron-session', async () => {
    const req = {} as any;
    const res = {} as any;
    await getSession(req, res);
    expect(getIronSession).toHaveBeenCalledTimes(1);
  });
});

describe('csrfClient helpers', () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.document = { cookie: '' } as any;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  });

  it('reads csrf token from cookies', () => {
    globalThis.document.cookie = 'foo=bar; XSRF-TOKEN=abc%20123';
    expect(getCsrf()).toBe('abc 123');
  });

  it('fetches csrf endpoint when cookie missing', async () => {
    await ensureCsrf();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/csrf', { credentials: 'include', cache: 'no-store' });
  });

  it('skips fetch when csrf cookie already present', async () => {
    globalThis.document.cookie = 'XSRF-TOKEN=value';
    await ensureCsrf();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
