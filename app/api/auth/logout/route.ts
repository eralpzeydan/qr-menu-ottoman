export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { ensureRequestCsrf } from '@/lib/api/guards';

export async function POST(req: NextRequest) {
  const csrfError = ensureRequestCsrf(req);
  if (csrfError) return csrfError;

  const res = NextResponse.json({ ok: true });
  const session = await getSession(req, res);
  await session.destroy();
  return res;
}
