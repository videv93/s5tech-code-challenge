/**
 * Shared constants live outside app.ts so the OpenAPI document can reference the
 * route prefix without importing the app — that import cycle (app → docs →
 * openapi → app) leaves `API_PREFIX` uninitialised at module-evaluation time.
 */
export const API_PREFIX = '/api/v1';
