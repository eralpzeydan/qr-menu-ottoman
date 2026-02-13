import { LRUCache } from 'lru-cache';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

const cache = new LRUCache<string, { count: number; ts: number }>({ max: 2000 });
let redis: Redis | null | undefined;

function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return redis;
  }
  redis = new Redis({ url, token });
  return redis;
}

function clientId(req: NextRequest) {
  if (req.ip) return req.ip;
  const realIp = req.headers.get('x-real-ip')?.split(',')[0]?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return '127.0.0.1';
}

async function redisRateLimit(identifier: string, { limit, windowMs, key }: { limit: number; windowMs: number; key: string }) {
  const client = getRedis();
  if (!client) return null;

  const redisKey = `rl:${key}:${identifier}`;
  const count = await client.incr(redisKey);
  if (count === 1) {
    await client.pexpire(redisKey, windowMs);
  }
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function rateLimit(req: NextRequest, { limit = 60, windowMs = 60_000, key = 'default' } = {}) {
  const id = clientId(req);
  const redisResult = await redisRateLimit(id, { limit, windowMs, key });
  if (redisResult) {
    // Track rate limit hits in production
    if (!redisResult.ok && process.env.NODE_ENV === 'production') {
      const { trackRateLimitHit } = await import('./monitoring/rate-limit');
      trackRateLimitHit(id, key, limit, windowMs);
    }
    return redisResult;
  }

  const cacheKey = `${key}:${id}`;
  const now = Date.now();
  const entry = cache.get(cacheKey);

  if (!entry || now - entry.ts > windowMs) {
    cache.set(cacheKey, { count: 1, ts: now }, { ttl: windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    // Track rate limit hits in production
    if (process.env.NODE_ENV === 'production') {
      const { trackRateLimitHit } = await import('./monitoring/rate-limit');
      trackRateLimitHit(id, key, limit, windowMs);
    }
    return { ok: false, remaining: 0 };
  }
  entry.count++;
  cache.set(cacheKey, entry, { ttl: windowMs });
  return { ok: true, remaining: limit - entry.count };
}
