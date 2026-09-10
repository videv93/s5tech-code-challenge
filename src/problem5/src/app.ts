import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { API_PREFIX } from './config/constants.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { httpLogger, requestId } from './middleware/request-context.js';
import { rateLimit } from './middleware/rate-limit.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { swapOrderRoutes } from './modules/swap-orders/swap-order.routes.js';
import { docsRoutes } from './docs/docs.routes.js';

/**
 * The app is built by a factory and exported separately from the server that
 * listens on a port. Tests can then drive it through supertest in-process — no
 * port binding, no teardown races, no flaky "address already in use".
 */
export { API_PREFIX };

export function createApp(): Express {
  const app = express();

  // Behind a load balancer, req.ip must come from X-Forwarded-For or the rate
  // limiter buckets every client under the proxy's address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      exposedHeaders: ['x-request-id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    }),
  );
  // Bounded body size — the default is 100kb, but stating it makes the limit a
  // decision rather than an accident.
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit);

  // Health checks sit outside the versioned prefix and ahead of the API so an
  // orchestrator can probe them without caring about API versions.
  app.use(healthRoutes);
  app.use('/docs', docsRoutes);

  app.use(`${API_PREFIX}/swap-orders`, swapOrderRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
