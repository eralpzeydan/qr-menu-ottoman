import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/permissions';
import { toError } from '@/lib/errors';
import { verifyCsrf, verifyCsrfFromRequest } from '@/lib/auth/csrf';

export async function ensureAdmin(req: NextRequest) {
  try {
    await requireAdmin(req);
    return null;
  } catch (err) {
    const { status, message } = toError(err, 'Yetkisiz');
    return NextResponse.json({ error: message }, { status });
  }
}

export function ensureCsrf() {
  try {
    verifyCsrf();
    return null;
  } catch {
    return NextResponse.json({ error: 'CSRF token doğrulanamadı' }, { status: 403 });
  }
}

export function ensureRequestCsrf(req: NextRequest) {
  try {
    verifyCsrfFromRequest(req);
    return null;
  } catch {
    return NextResponse.json({ error: 'CSRF token doğrulanamadı' }, { status: 403 });
  }
}
