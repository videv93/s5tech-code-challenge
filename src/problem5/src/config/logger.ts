import pino from 'pino';
import { env, isProduction, isTest } from './env.js';

/**
 * Structured JSON logs in production (so they are greppable in Elasticsearch/
 * Kibana), pretty-printed locally, silent under test so the suite output stays
 * readable.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[redacted]',
  },
});
