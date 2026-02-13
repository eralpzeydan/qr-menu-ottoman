import { PrismaClient } from '@prisma/client';
import {
  createSlowQueryMiddleware,
  createMetricsMiddleware,
} from './monitoring/database';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn', 'query']
  });

// Add monitoring middleware in production
if (process.env.NODE_ENV === 'production') {
  // Track slow queries (>500ms)
  prisma.$use(createSlowQueryMiddleware(500));

  // Collect metrics for all queries
  prisma.$use(createMetricsMiddleware(500));
}

// Always use singleton to prevent connection pool exhaustion
globalForPrisma.prisma = prisma;
