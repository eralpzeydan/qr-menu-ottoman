import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { ensureAdmin, ensureRequestCsrf } from '@/lib/api/guards';
import { rateLimit } from '@/lib/rate-limit';

type Body = { url?: string; format?: 'svg' | 'png' };

export async function POST(req: NextRequest, { params }: { params: { tableId: string } }) {
  const tableId = params.tableId?.trim();
  if (!tableId || !/^[a-zA-Z0-9_-]{1,64}$/.test(tableId)) {
    return NextResponse.json({ error: 'Geçersiz masa kimliği' }, { status: 400 });
  }

  const authError = await ensureAdmin(req);
  if (authError) return authError;
  const csrfError = ensureRequestCsrf(req);
  if (csrfError) return csrfError;

  const rl = await rateLimit(req, { key: `qr:${tableId}`, limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as Body | null;
  const rawUrl = body?.url?.trim();
  if (!rawUrl) return NextResponse.json({ error: 'URL zorunlu' }, { status: 400 });
  if (rawUrl.length > 512) {
    return NextResponse.json({ error: 'URL çok uzun' }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json({ error: 'URL http/https ile başlamalı' }, { status: 400 });
  }
  const format = body?.format ?? 'svg';
  const safeName = tableId.replace(/[^a-zA-Z0-9_-]/g, '');
  const downloadBase = safeName ? `qr-${safeName}` : 'qr-table';

  if (format === 'png') {
    const png = await QRCode.toBuffer(rawUrl, { width: 512, errorCorrectionLevel: 'M' });
    const body = new Uint8Array(png.buffer, png.byteOffset, png.byteLength);
    return new NextResponse(body as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${downloadBase}.png"`,
      },
    });
  }
  const svg = await QRCode.toString(rawUrl, { type: 'svg', errorCorrectionLevel: 'M', width: 256 });
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="${downloadBase}.svg"`,
    }
  });
}
