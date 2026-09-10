import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectDatabase, prisma } from './db/client.js';

const app = createApp();

async function main(): Promise<void> {
  // Fail fast: if the database is unreachable, say so at boot rather than
  // serving 500s to the first users who arrive.
  await prisma.$queryRaw`SELECT 1`;

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, docs: `http://localhost:${env.PORT}/docs` },
      'Server listening',
    );
  });

  /**
   * Graceful shutdown: stop accepting new connections, let in-flight requests
   * finish, then close the pool. Without this, a deploy drops whatever requests
   * were mid-flight — and the failure looks like a random 502 to the user.
   */
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Backstop: never hang a deploy forever on one stuck connection.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
