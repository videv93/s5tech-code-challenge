import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuration is validated once, at boot, against a schema. A missing or
 * malformed DATABASE_URL should stop the process immediately with a readable
 * message — not surface as a connection error on the first request an hour later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see .env.example)'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated allowlist, or `*` for any origin. */
  CORS_ORIGIN: z.string().default('*'),
  /** Max requests per IP per minute. 0 disables the limiter. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(120),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Deliberately console + exit rather than throw: this runs before the logger
  // exists, and a stack trace here would bury the actual problem.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
