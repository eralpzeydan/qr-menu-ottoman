import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AwsClient } from 'aws4fetch';

const ALLOWED_MIME_PREFIXES = ['image/'];
const BLOCKED_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'set-cookie',
  'set-cookie2',
  'transfer-encoding',
]);

let awsClient: AwsClient | null = null;

function getAwsClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  if (!awsClient) {
    awsClient = new AwsClient({ accessKeyId, secretAccessKey });
  }
  return awsClient;
}

function buildR2ApiUrl(path: string) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) return null;

  const endpoint = process.env.R2_ENDPOINT?.replace(/\/+$/, '') ||
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  if (!endpoint) return null;

  const cleanPath = path.replace(/^\/+/, '');
  return `${endpoint}/${bucket}/${cleanPath}`;
}

async function fetchFromR2Api(path: string) {
  const client = getAwsClient();
  const apiUrl = buildR2ApiUrl(path);
  if (!client || !apiUrl) return null;

  return client.fetch(apiUrl, {
    method: 'GET',
    aws: { service: 's3', region: 'auto' },
    cache: 'no-store',
  });
}

function isAllowedHost(hostname: string) {
  if (hostname.endsWith('.r2.dev')) return true;

  const configured = process.env.R2_PUBLIC_BASE_URL;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.hostname === hostname) return true;
    } catch {
      // ignore invalid env
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'url parametresi zorunlu' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Geçersiz URL' }, { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Sadece https destekleniyor' }, { status: 400 });
  }
  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: 'Bu hosta izin verilmiyor' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    let upstream = await fetch(target.toString(), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!upstream.ok && target.hostname.endsWith('.r2.dev')) {
      const fallback = await fetchFromR2Api(target.pathname);
      if (fallback) upstream = fallback;
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Kaynak getirilemedi (${upstream.status})` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const isImage = ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
    if (!isImage) {
      return NextResponse.json({ error: 'Kaynak bir görsel değil' }, { status: 415 });
    }

    const headers = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    clearTimeout(timeout);

    if (target.hostname.endsWith('.r2.dev')) {
      try {
        const fallback = await fetchFromR2Api(target.pathname);
        if (fallback?.ok && fallback.body) {
          const contentType = fallback.headers.get('content-type') || 'application/octet-stream';
          const isImage = ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
          if (!isImage) {
            return NextResponse.json({ error: 'Kaynak bir görsel değil' }, { status: 415 });
          }
          const headers = new Headers();
          fallback.headers.forEach((value, key) => {
            if (!BLOCKED_HEADERS.has(key.toLowerCase())) headers.set(key, value);
          });
          headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
          return new NextResponse(fallback.body, { status: 200, headers });
        }
      } catch {
        // noop
      }
    }

    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Görsel alınamadı';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
