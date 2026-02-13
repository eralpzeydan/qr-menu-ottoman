export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET() {
  const token = randomBytes(32).toString('hex');
  const res = NextResponse.json({ ok: true });
  res.cookies.set('XSRF-TOKEN', token, {
    httpOnly: false,                           // JS okuyacak (header'a koyacağız)
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });
  return res;
}
