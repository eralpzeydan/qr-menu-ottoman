import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdmin } from '@/lib/api/guards';

/**
 * GET /api/admin/analytics/accessibility
 * Analyzes the accessibility fix impact by comparing ViewLog data
 * Requires admin authentication
 *
 * Returns:
 * - Total menu views
 * - Views per day
 * - User agent breakdown
 * - Success rate estimation
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const adminCheck = await ensureAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Get total views since the fix
    const totalViews = await prisma.viewLog.count({
      where: {
        createdAt: {
          gte: since,
        },
      },
    });

    // Get views per day
    const viewsPerDay = await prisma.$queryRaw<
      { date: Date; views: bigint }[]
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as views
      FROM "ViewLog"
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get user agent breakdown
    const userAgentBreakdown = await prisma.$queryRaw<
      { user_agent: string | null; count: bigint }[]
    >`
      SELECT
        user_agent,
        COUNT(*) as count
      FROM "ViewLog"
      WHERE created_at >= ${since}
      GROUP BY user_agent
      ORDER BY count DESC
      LIMIT 20
    `;

    // Get venue breakdown
    const venueBreakdown = await prisma.viewLog.groupBy({
      by: ['venueId'],
      where: {
        createdAt: {
          gte: since,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    // Get venue names
    const venueIds = venueBreakdown.map((v) => v.venueId);
    const venues = await prisma.venue.findMany({
      where: {
        id: {
          in: venueIds,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const venueMap = Object.fromEntries(
      venues.map((v) => [v.id, { name: v.name, slug: v.slug }])
    );

    const venueStats = venueBreakdown.map((v) => ({
      venueId: v.venueId,
      venueName: venueMap[v.venueId]?.name || 'Unknown',
      venueSlug: venueMap[v.venueId]?.slug || 'unknown',
      views: v._count.id,
    }));

    // Parse user agents to get device types
    const deviceBreakdown = {
      mobile: 0,
      desktop: 0,
      tablet: 0,
      bot: 0,
      unknown: 0,
    };

    userAgentBreakdown.forEach((ua) => {
      const agent = ua.user_agent?.toLowerCase() || '';
      if (agent.includes('bot') || agent.includes('crawler')) {
        deviceBreakdown.bot++;
      } else if (
        agent.includes('mobile') ||
        agent.includes('android') ||
        agent.includes('iphone')
      ) {
        deviceBreakdown.mobile++;
      } else if (agent.includes('tablet') || agent.includes('ipad')) {
        deviceBreakdown.tablet++;
      } else if (
        agent.includes('windows') ||
        agent.includes('mac') ||
        agent.includes('linux')
      ) {
        deviceBreakdown.desktop++;
      } else if (agent === '') {
        deviceBreakdown.unknown++;
      } else {
        deviceBreakdown.mobile++; // Default to mobile
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalViews,
          period: {
            days,
            from: since.toISOString(),
            to: new Date().toISOString(),
          },
          averageViewsPerDay: Math.round(totalViews / days),
        },
        viewsPerDay: viewsPerDay.map((v) => ({
          date: v.date,
          views: Number(v.views),
        })),
        deviceBreakdown,
        topUserAgents: userAgentBreakdown
          .slice(0, 10)
          .map((ua) => ({
            userAgent: ua.user_agent || 'Unknown',
            count: Number(ua.count),
          })),
        venueStats,
        notes: [
          'This data represents successful menu loads (ViewLog entries)',
          'To calculate error rate, compare with Sentry error count',
          'Success rate = (ViewLog count) / (ViewLog count + Sentry errors) * 100',
          `Target: < 1% error rate (< ${Math.round(totalViews * 0.01)} errors for ${totalViews} views)`,
        ],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Accessibility analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch accessibility analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
