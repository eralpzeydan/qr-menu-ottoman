import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readSession } from './session';

export async function requireAdmin(req: NextRequest, res?: Response) {
  const response = res ?? NextResponse.next();
  const session = await readSession(req, response);
  if (!session.user || session.user.role !== 'ADMIN') {
    const err = new Error('Yetkisiz') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return session.user;
}
