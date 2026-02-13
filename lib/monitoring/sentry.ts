import * as Sentry from '@sentry/nextjs';

/**
 * Adds custom context to Sentry events for better debugging
 */
export function addSentryContext(context: {
  venueId?: string;
  tableId?: string;
  userAgent?: string;
  userId?: string;
  endpoint?: string;
}) {
  if (context.venueId) {
    Sentry.setTag('venueId', context.venueId);
    Sentry.setContext('venue', { venueId: context.venueId });
  }

  if (context.tableId) {
    Sentry.setTag('tableId', context.tableId);
    Sentry.setContext('table', { tableId: context.tableId });
  }

  if (context.userAgent) {
    Sentry.setContext('browser', { userAgent: context.userAgent });
  }

  if (context.userId) {
    Sentry.setUser({ id: context.userId });
  }

  if (context.endpoint) {
    Sentry.setTag('endpoint', context.endpoint);
  }
}

/**
 * Captures an error with custom context
 */
export function captureErrorWithContext(
  error: Error | unknown,
  context?: {
    venueId?: string;
    tableId?: string;
    userAgent?: string;
    userId?: string;
    endpoint?: string;
    extras?: Record<string, unknown>;
  }
) {
  if (context) {
    addSentryContext(context);

    if (context.extras) {
      Sentry.setContext('extras', context.extras);
    }
  }

  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureException(new Error(String(error)));
  }
}

/**
 * Captures a message with custom context
 */
export function captureMessageWithContext(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    venueId?: string;
    tableId?: string;
    userAgent?: string;
    userId?: string;
    endpoint?: string;
    extras?: Record<string, unknown>;
  }
) {
  if (context) {
    addSentryContext(context);

    if (context.extras) {
      Sentry.setContext('extras', context.extras);
    }
  }

  Sentry.captureMessage(message, level);
}

/**
 * Wraps a function with Sentry transaction tracking
 */
export function withSentryTransaction<T>(
  name: string,
  operation: string,
  fn: () => T | Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: operation,
    },
    async () => {
      return await fn();
    }
  );
}

/**
 * Tracks menu access errors specifically
 */
export function trackMenuAccessError(
  error: Error | unknown,
  venueId: string,
  tableId?: string,
  userAgent?: string
) {
  captureErrorWithContext(error, {
    venueId,
    tableId,
    userAgent,
    endpoint: 'menu-access',
    extras: {
      errorType: 'menu-access-failure',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Tracks successful menu loads for success rate monitoring
 */
export function trackMenuAccessSuccess(
  venueId: string,
  tableId?: string,
  loadTimeMs?: number
) {
  Sentry.addBreadcrumb({
    category: 'menu',
    message: 'Menu loaded successfully',
    level: 'info',
    data: {
      venueId,
      tableId,
      loadTimeMs,
    },
  });

  // Track performance metric
  if (loadTimeMs) {
    if (venueId) {
      Sentry.setTag('venueId', venueId);
    }
    Sentry.metrics.distribution('menu.load_time', loadTimeMs, {
      unit: 'millisecond',
    });
  }
}
