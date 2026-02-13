import type { Prisma } from '@prisma/client';
import { captureMessageWithContext } from './sentry';

/**
 * Middleware to log slow database queries
 * Tracks queries that take longer than the threshold
 */
export function createSlowQueryMiddleware(thresholdMs = 500) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>
  ) => {
    const startTime = Date.now();
    const result = await next(params);
    const duration = Date.now() - startTime;

    // Log queries slower than threshold
    if (duration > thresholdMs) {
      const queryDetails = {
        model: params.model || 'unknown',
        action: params.action,
        duration,
        threshold: thresholdMs,
      };

      // Send to Sentry
      captureMessageWithContext(
        `Slow query detected: ${params.model}.${params.action} (${duration}ms)`,
        'warning',
        {
          extras: {
            ...queryDetails,
            // Include args only in development for debugging
            ...(process.env.NODE_ENV !== 'production' && {
              args: JSON.stringify(params.args, null, 2),
            }),
          },
        }
      );

    }

    return result;
  };
}

/**
 * Middleware to track all database queries (sampling)
 * Only tracks a percentage of queries to avoid overwhelming logs
 */
export function createQuerySamplingMiddleware(sampleRate = 0.1) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>
  ) => {
    const shouldSample = Math.random() < sampleRate;

    if (shouldSample) {
      return next(params);
    }

    return next(params);
  };
}

/**
 * Interface for database metrics
 */
export interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  queriesByModel: Record<string, number>;
  slowQueriesByModel: Record<string, number>;
}

/**
 * Simple in-memory metrics collector
 * For production, consider using a proper metrics system
 */
class DatabaseMetricsCollector {
  private metrics: DatabaseMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    queriesByModel: {},
    slowQueriesByModel: {},
  };

  private queryTimes: number[] = [];
  private readonly MAX_QUERY_TIMES = 1000; // Keep last 1000 query times for avg calculation

  recordQuery(params: {
    model: string | undefined;
    action: string;
    duration: number;
    isSlow: boolean;
  }) {
    const model = params.model || 'unknown';

    this.metrics.totalQueries++;
    this.queryTimes.push(params.duration);

    // Keep only last MAX_QUERY_TIMES
    if (this.queryTimes.length > this.MAX_QUERY_TIMES) {
      this.queryTimes.shift();
    }

    // Update average
    this.metrics.averageQueryTime =
      this.queryTimes.reduce((sum, time) => sum + time, 0) /
      this.queryTimes.length;

    // Update by model
    this.metrics.queriesByModel[model] =
      (this.metrics.queriesByModel[model] || 0) + 1;

    if (params.isSlow) {
      this.metrics.slowQueries++;
      this.metrics.slowQueriesByModel[model] =
        (this.metrics.slowQueriesByModel[model] || 0) + 1;
    }
  }

  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      queriesByModel: {},
      slowQueriesByModel: {},
    };
    this.queryTimes = [];
  }
}

export const dbMetrics = new DatabaseMetricsCollector();

/**
 * Middleware to collect metrics
 */
export function createMetricsMiddleware(thresholdMs = 500) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>
  ) => {
    const startTime = Date.now();
    const result = await next(params);
    const duration = Date.now() - startTime;

    dbMetrics.recordQuery({
      model: params.model,
      action: params.action,
      duration,
      isSlow: duration > thresholdMs,
    });

    return result;
  };
}
