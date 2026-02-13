import { getIronSession } from 'iron-session';
import type { SessionOptions } from 'iron-session';
import type { NextRequest } from 'next/server';

export type SessionData = {
  user?: { id: string; email: string; role: 'ADMIN' | 'VIEWER' }
};

let cachedSecret: string | null = null;

function resolveSessionSecret() {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }
  cachedSecret = secret;
  return secret;
}

export const sessionOptions: SessionOptions = {
  password: resolveSessionSecret(),
  cookieName: 'qrmenu_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  },
};

export async function readSession(req: NextRequest, res: Response) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

export const getSession = readSession;
