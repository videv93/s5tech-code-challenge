import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

declare module 'express-serve-static-core' {
  interface Locals {
    requestId: string;
  }
}

/**
 * Every request gets a correlation id, echoed in the response header, attached
 * to each log line and included in every error body — so a user reporting "it
 * failed" can hand over one string that finds the exact request in the logs.
 * An inbound `x-request-id` is honoured so the id survives across services.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.header('x-request-id');
  const id = inbound && inbound.length <= 128 ? inbound : randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (_req, res) => (res as { locals?: { requestId?: string } }).locals?.requestId ?? randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
