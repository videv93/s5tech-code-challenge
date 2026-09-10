import { Router } from 'express';
import { prisma } from '../../db/client.js';
import { asyncHandler } from '../../middleware/async-handler.js';

export const healthRoutes = Router();

/**
 * Liveness: is the process up? Deliberately does not touch the database — a
 * liveness probe that fails on a database blip gets the container killed and
 * restarted, which fixes nothing and turns a degradation into an outage.
 */
healthRoutes.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Readiness: can this instance serve traffic? This one *does* check the
 * database, because an instance that cannot reach it should be taken out of the
 * load balancer rotation.
 */
healthRoutes.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ready', database: 'up' });
    } catch {
      res.status(503).json({ status: 'not-ready', database: 'down' });
    }
  }),
);
