import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

type Rule = {
  matcher: RegExp;
  key: string;
  limit: number;
  windowMs: number;
};

const RULES: Rule[] = [
  // Public menu endpoint needs higher limit for customer access
  { matcher: /^\/api\/venue\/[^/]+\/menu/, key: 'api:menu', limit: 300, windowMs: 60_000 },
  { matcher: /^\/api\/products/, key: 'api:products', limit: 60, windowMs: 30_000 },
  { matcher: /^\/admin(\/|$)/, key: 'page:admin', limit: 30, windowMs: 60_000 },
];

const DEFAULT_RULE: Rule = { matcher: /.*/, key: 'global', limit: 300, windowMs: 60_000 };

function pickRule(pathname: string) {
  for (const rule of RULES) {
    if (rule.matcher.test(pathname)) return rule;
  }
  return DEFAULT_RULE;
}

export async function middleware(req: NextRequest) {
  if (req.method !== 'GET') return NextResponse.next();

  const pathname = req.nextUrl.pathname || '/';
  const rule = pickRule(pathname);
  const result = await rateLimit(req, {
    limit: rule.limit,
    windowMs: rule.windowMs,
    key: `middleware:${rule.key}`,
  });

  if (result.ok) return NextResponse.next();

  const retrySeconds = Math.ceil(rule.windowMs / 1000);
  const res = NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });
  res.headers.set('Retry-After', retrySeconds.toString());
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|images/|seed/|uploads/).*)',
  ],
};
