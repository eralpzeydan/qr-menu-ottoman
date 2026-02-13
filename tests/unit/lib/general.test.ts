import { describe, it, expect, beforeEach, afterAll, vi, afterEach } from 'vitest';
import { fmtTRY } from '@/lib/format';
import { toError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

describe('fmtTRY', () => {
  it('formats cents as Turkish Lira currency without kuruş', () => {
    const result = fmtTRY(12300);
    expect(result).toBe('₺123');
  });

  it('handles zero cents', () => {
    expect(fmtTRY(0)).toBe('₺0');
  });
});

describe('toError utility', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('uses fallback message in production', () => {
    process.env.NODE_ENV = 'production';
    const err = toError(new Error('internal'), 'Fallback');
    expect(err).toEqual({ status: 500, message: 'Fallback' });
  });

  it('exposes original message in non-production', () => {
    const err = toError(new Error('detailed error'), 'Fallback');
    expect(err).toEqual({ status: 500, message: 'detailed error' });
  });

  it('preserves explicit status on error', () => {
    const custom = Object.assign(new Error('boom'), { status: 404 });
    const err = toError(custom, 'Fallback');
    expect(err).toEqual({ status: 404, message: 'boom' });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });
});

describe('rateLimit helper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first request and tracks remaining quota', async () => {
    const req = { headers: new Headers([['x-forwarded-for', '203.0.113.4']]) } as any;
    const result = await rateLimit(req, { limit: 2, windowMs: 1000, key: 'test' });
    expect(result).toEqual({ ok: true, remaining: 1 });
  });

  it('blocks after the limit and recovers after the window', async () => {
    const req = { headers: new Headers(), ip: '10.0.0.5' } as any;
    expect(await rateLimit(req, { limit: 1, windowMs: 1000, key: 'test2' })).toMatchObject({ ok: true });
    expect(await rateLimit(req, { limit: 1, windowMs: 1000, key: 'test2' })).toMatchObject({ ok: false, remaining: 0 });
    vi.advanceTimersByTime(1001);
    expect(await rateLimit(req, { limit: 1, windowMs: 1000, key: 'test2' })).toMatchObject({ ok: true });
  });
});

describe('i18n message files', () => {
  it('share the same keys between locales', () => {
    const enKeys = Object.keys(en).sort();
    const trKeys = Object.keys(tr).sort();
    expect(trKeys).toEqual(enKeys);
  });
});
