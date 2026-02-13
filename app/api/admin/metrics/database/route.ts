import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbMetrics } from '@/lib/monitoring/database';
import { ensureAdmin } from '@/lib/api/guards';

/**
 * GET /api/admin/metrics/database
 * Returns database query metrics
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const adminCheck = await ensureAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const metrics = dbMetrics.getMetrics();

  return NextResponse.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}

/**
 * DELETE /api/admin/metrics/database
 * Resets database metrics
 * Requires admin authentication
 */
export async function DELETE(request: NextRequest) {
  // Require admin authentication
  const adminCheck = await ensureAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  dbMetrics.reset();

  return NextResponse.json({
    success: true,
    message: 'Database metrics reset successfully',
    timestamp: new Date().toISOString(),
  });
}
