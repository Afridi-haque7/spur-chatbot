import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client for the process.
 *
 * In dev we keep it on globalThis so `tsx watch` hot-reloads don't spawn a new
 * pool on every reload (a classic source of "too many connections" errors).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
