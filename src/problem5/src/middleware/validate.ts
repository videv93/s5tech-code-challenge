import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType, ZodError } from 'zod';
import { AppError } from '../shared/errors.js';

/**
 * Parse-don't-validate at the edge: a handler only ever sees data that has
 * already been narrowed to its schema's *output* type, so nothing downstream
 * re-checks shapes. Using the parsed value (not the raw one) is what makes the
 * schemas' transforms take effect — uppercased tickers, `?limit=20` coerced to a
 * number, ISO strings turned into comparable values.
 *
 * Express 5 exposes `req.query` and `req.params` as getter-only properties, so
 * validated values live on `res.locals.validated` rather than being reassigned
 * onto the request. `validated(res)` below is the typed way back out.
 */

export interface ValidatedBag {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare module 'express-serve-static-core' {
  interface Locals {
    validated?: ValidatedBag;
  }
}

function bag(res: Response): ValidatedBag {
  res.locals.validated ??= {};
  return res.locals.validated;
}

/** Read a validated value back out with the type the schema produced. */
export function validated<T>(res: Response, key: keyof ValidatedBag): T {
  const value = bag(res)[key];
  if (value === undefined) {
    // A programming error, not a client error: a handler asked for something no
    // middleware validated. Failing loudly beats handling `undefined` downstream.
    throw new Error(`No validated '${key}' on this route — is the validator wired up?`);
  }
  return value as T;
}

function makeValidator(
  key: keyof ValidatedBag,
  pick: (req: Request) => unknown,
): <T>(schema: ZodType<T>) => RequestHandler {
  return (schema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(pick(req));
    if (!result.success) return next(AppError.validation(formatIssues(result.error)));
    bag(res)[key] = result.data;
    if (key === 'body') req.body = result.data;
    next();
  };
}

export const validateBody = makeValidator('body', (req) => req.body);
export const validateQuery = makeValidator('query', (req) => req.query);
export const validateParams = makeValidator('params', (req) => req.params);

/** Flatten Zod issues into a stable, client-friendly list. */
export function formatIssues(error: ZodError): Array<{ field: string; message: string; code: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}
