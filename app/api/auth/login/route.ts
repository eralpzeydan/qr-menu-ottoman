// app/api/auth/login/route.ts
export const runtime = 'nodejs'; // bcrypt için node runtime

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/schemas';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { ensureRequestCsrf } from '@/lib/api/guards';

export async function POST(req: NextRequest) {
  const csrfError = ensureRequestCsrf(req);
  if (csrfError) return csrfError;

  const rl = await rateLimit(req, { key: 'auth:login', limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Çok fazla deneme yapıldı' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Geçersiz bilgiler' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Geçersiz bilgiler' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getSession(req, res);
  const role: 'ADMIN' | 'VIEWER' = user.role === 'VIEWER' ? 'VIEWER' : 'ADMIN';
  session.user = { id: user.id, email: user.email, role };
  await session.save();

  return res;
}
