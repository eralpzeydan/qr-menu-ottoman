// lib/auth/csrf.ts
import type { NextRequest } from 'next/server';
import { headers, cookies } from 'next/headers';

// Header'lardaki cookie stringinden bir cookie'yi çek
function readCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function verifyCsrfFromRequest(req: NextRequest) {
  // Header token: x-csrf-token veya x-xsrf-token
  const headerToken =
    req.headers.get('x-csrf-token') ||
    req.headers.get('x-xsrf-token');

  // Cookie token: header'daki "cookie" raw string'ten oku (en güvenlisi)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieToken = readCookie(cookieHeader, 'XSRF-TOKEN');

  // DEV'de geçici olarak kolaylaştırmak istersen .env'e CSRF_DEV_PERMISSIVE=1 koyabilirsin:
  if (process.env.NODE_ENV !== 'production' && process.env.CSRF_DEV_PERMISSIVE === '1') {
    if (!headerToken || !cookieToken) {
      console.warn('[CSRF] DEV PERMISSIVE: header/cookie eksik -> bypass');
      return;
    }
  }

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new Error('CSRF token doğrulanamadı');
  }
}

export function verifyCsrf() {
  const headerToken =
    headers().get('x-csrf-token') ||
    headers().get('x-xsrf-token');

  const cookieToken = cookies().get('XSRF-TOKEN')?.value;

  if (process.env.NODE_ENV !== 'production' && process.env.CSRF_DEV_PERMISSIVE === '1') {
    if (!headerToken || !cookieToken) {
      console.warn('[CSRF] DEV PERMISSIVE: header/cookie eksik -> bypass');
      return;
    }
  }

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new Error('CSRF token doğrulanamadı');
  }
}
