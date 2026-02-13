import { captureMessageWithContext } from './sentry';

/**
 * Interface for rate limit event
 */
export interface RateLimitEvent {
  ip: string;
  endpoint: string;
  limit: number;
  windowMs: number;
  timestamp: Date;
}

/**
 * Simple in-memory collector for rate limit hits
 */
class RateLimitMonitor {
  private events: RateLimitEvent[] = [];
  private readonly MAX_EVENTS = 1000; // Keep last 1000 events

  recordHit(event: Omit<RateLimitEvent, 'timestamp'>) {
    const fullEvent: RateLimitEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Keep only last MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Send to Sentry for tracking
    captureMessageWithContext(
      'Rate limit exceeded',
      'warning',
      {
        endpoint: event.endpoint,
        extras: {
          ip: event.ip,
          limit: event.limit,
          windowMs: event.windowMs,
          timestamp: fullEvent.timestamp.toISOString(),
        },
      }
    );

    // Log to console in production for immediate visibility
    console.warn(`[RATE LIMIT] IP: ${event.ip}, Endpoint: ${event.endpoint}`);
  }

  getEvents(options?: {
    endpoint?: string;
    ip?: string;
    since?: Date;
  }): RateLimitEvent[] {
    let filtered = this.events;

    if (options?.endpoint) {
      filtered = filtered.filter((e) => e.endpoint === options.endpoint);
    }

    if (options?.ip) {
      filtered = filtered.filter((e) => e.ip === options.ip);
    }

    if (options?.since) {
      const since = options.since;
      filtered = filtered.filter((e) => e.timestamp >= since);
    }

    return filtered;
  }

  getStats(since?: Date) {
    const events = since
      ? this.events.filter((e) => e.timestamp >= since)
      : this.events;

    const byEndpoint: Record<string, number> = {};
    const byIp: Record<string, number> = {};
    const topOffenders: Record<string, number> = {};

    events.forEach((event) => {
      // By endpoint
      byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;

      // By IP
      byIp[event.ip] = (byIp[event.ip] || 0) + 1;

      // Top offenders (IP + endpoint combo)
      const key = `${event.ip}:${event.endpoint}`;
      topOffenders[key] = (topOffenders[key] || 0) + 1;
    });

    // Sort top offenders
    const sortedOffenders = Object.entries(topOffenders)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => {
        const [ip, endpoint] = key.split(':');
        return { ip, endpoint, hits: count };
      });

    return {
      totalHits: events.length,
      byEndpoint,
      byIp,
      topOffenders: sortedOffenders,
      timeRange: {
        from: events.length > 0 ? events[0].timestamp : null,
        to: events.length > 0 ? events[events.length - 1].timestamp : null,
      },
    };
  }

  reset() {
    this.events = [];
  }
}

export const rateLimitMonitor = new RateLimitMonitor();

/**
 * Track rate limit hit
 */
export function trackRateLimitHit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number
) {
  rateLimitMonitor.recordHit({
    ip,
    endpoint,
    limit,
    windowMs,
  });
}
