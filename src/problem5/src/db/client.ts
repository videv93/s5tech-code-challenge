import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client.js';
import { env, isProduction } from '../config/env.js';

/**
 * Prisma 7 takes the connection through a driver adapter rather than a `url` in
 * the schema. Swapping SQLite for PostgreSQL is therefore a change here plus the
 * `provider` line in schema.prisma — see the README.
 */
const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
});

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
