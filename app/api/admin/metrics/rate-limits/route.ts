import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimitMonitor } from '@/lib/monitoring/rate-limit';
import { ensureAdmin } from '@/lib/api/guards';

/**
 * GET /api/admin/metrics/rate-limits
 * Returns rate limit hit statistics
 * Requires admin authentication
 *
 * Query params:
 * - hours: Number of hours to look back (default: 24)
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const adminCheck = await ensureAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const { searchParams } = new URL(request.url);
  const hoursParam = searchParams.get('hours');
  const hours = hoursParam ? parseInt(hoursParam, 10) : 24;

  // Get stats for the specified time period
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stats = rateLimitMonitor.getStats(since);

  return NextResponse.json({
    success: true,
    data: {
      ...stats,
      period: {
        hours,
        from: since.toISOString(),
        to: new Date().toISOString(),
      },
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * DELETE /api/admin/metrics/rate-limits
 * Resets rate limit statistics
 * Requires admin authentication
 */
export async function DELETE(request: NextRequest) {
  // Require admin authentication
  const adminCheck = await ensureAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  rateLimitMonitor.reset();

  return NextResponse.json({
    success: true,
    message: 'Rate limit metrics reset successfully',
    timestamp: new Date().toISOString(),
  });
}
