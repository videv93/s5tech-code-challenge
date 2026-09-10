/**
 * A single error type carrying everything the error middleware needs to render a
 * response. Throwing these from the service layer keeps HTTP concerns out of the
 * business logic while still letting it say "this is a 404, not a 500".
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  static notFound(resource: string, id: string): AppError {
    return new AppError(404, 'NOT_FOUND', `${resource} with id '${id}' was not found`);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: unknown): AppError {
    return new AppError(422, 'VALIDATION_ERROR', 'The request body or query failed validation', details);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }
}

/** Shape returned to clients for every failure. Documented in the OpenAPI spec. */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
