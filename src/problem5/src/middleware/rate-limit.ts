import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors.js';

/**
 * A deliberately small fixed-window limiter, in-process and in-memory.
 *
 * This is honest about its limits rather than pretending to be production
 * infrastructure: it does not survive a restart and does not coordinate across
 * instances, so behind more than one replica the effective limit multiplies. For
 * a single-node service it stops trivial abuse; at scale the same interface is
 * backed by Redis (`INCR` + `EXPIRE`) — see the README's improvements section.
 */
const WINDOW_MS = 60_000;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export const rateLimit: RequestHandler = (req, res, next) => {
  if (env.RATE_LIMIT_PER_MINUTE === 0) return next();

  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const existing = windows.get(key);

  const window: Window =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + WINDOW_MS };

  window.count += 1;
  windows.set(key, window);

  const remaining = Math.max(0, env.RATE_LIMIT_PER_MINUTE - window.count);
  res.setHeader('RateLimit-Limit', env.RATE_LIMIT_PER_MINUTE);
  res.setHeader('RateLimit-Remaining', remaining);
  res.setHeader('RateLimit-Reset', Math.ceil((window.resetAt - now) / 1000));

  if (window.count > env.RATE_LIMIT_PER_MINUTE) {
    return next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please retry shortly'));
  }

  // Opportunistic sweep so an unbounded key space cannot grow into a leak.
  if (windows.size > 10_000) {
    for (const [entryKey, entry] of windows) {
      if (entry.resetAt <= now) windows.delete(entryKey);
    }
  }

  next();
};
