import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../db/generated/client.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';
import { AppError, type ErrorResponseBody } from '../shared/errors.js';
import { formatIssues } from './validate.js';

/** 404 for anything the router did not match. Mounted after all routes. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorResponseBody = {
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      requestId: res.locals.requestId,
    },
  };
  res.status(404).json(body);
};

/**
 * One place that turns any thrown value into an HTTP response, so no handler
 * needs a try/catch and no error path can accidentally leak a stack trace.
 * Express identifies this as error middleware by its four-parameter arity —
 * hence the unused `_next`.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { statusCode, code, message, details } = normalise(err);

  // 5xx is our bug and gets a full stack; 4xx is the client's and gets a line.
  if (statusCode >= 500) {
    logger.error({ err, requestId: res.locals.requestId }, 'Unhandled error');
  } else {
    logger.warn({ code, message, requestId: res.locals.requestId }, 'Request failed');
  }

  const body: ErrorResponseBody = {
    error: {
      code,
      // Never surface an internal message in production: exception text leaks
      // table names, file paths and query fragments.
      message: statusCode >= 500 && isProduction ? 'Internal server error' : message,
      ...(details === undefined ? {} : { details }),
      requestId: res.locals.requestId,
    },
  };

  res.status(statusCode).json(body);
};

function normalise(err: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  // A schema that ran outside the validation middleware.
  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'The request failed validation',
      details: formatIssues(err),
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2025': // Record required but not found
        return { statusCode: 404, code: 'NOT_FOUND', message: 'The requested record does not exist' };
      case 'P2002': // Unique constraint violation
        return {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A record with these values already exists',
          details: { fields: (err.meta as { target?: string[] } | undefined)?.target },
        };
      case 'P2003': // Foreign key constraint violation
        return { statusCode: 409, code: 'CONFLICT', message: 'Referenced record does not exist' };
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, code: 'BAD_REQUEST', message: 'The query was malformed' };
  }

  // Malformed JSON: body-parser throws a SyntaxError carrying a status.
  if (err instanceof SyntaxError && 'body' in err) {
    return { statusCode: 400, code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Internal server error',
  };
}
