import { z } from 'zod';
import { API_PREFIX } from '../config/constants.js';
import {
  createSwapOrderSchema,
  listSwapOrdersQuerySchema,
  SWAP_ORDER_STATUSES,
  updateSwapOrderSchema,
} from '../modules/swap-orders/swap-order.schema.js';

/**
 * The OpenAPI document is *generated from the same Zod schemas the routes
 * validate with* (`z.toJSONSchema`, native in Zod 4). Hand-written API docs
 * drift from the implementation within about two sprints; this cannot, because
 * there is only one definition of each shape.
 */
const jsonSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: 'draft-7', io: 'input', unrepresentable: 'any' });

const swapOrderResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    fromCurrency: { type: 'string', example: 'ETH' },
    toCurrency: { type: 'string', example: 'USDC' },
    // Amounts are strings on the wire — see swap-order.service.ts for why.
    fromAmount: { type: 'string', example: '1.5' },
    toAmount: { type: 'string', example: '3750' },
    rate: { type: 'string', example: '2500' },
    walletAddress: { type: 'string' },
    status: { type: 'string', enum: SWAP_ORDER_STATUSES },
    note: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id', 'fromCurrency', 'toCurrency', 'fromAmount', 'toAmount', 'rate',
    'walletAddress', 'status', 'note', 'createdAt', 'updatedAt',
  ],
} as const;

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string' },
        details: {},
        requestId: { type: 'string', format: 'uuid' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

/** Turn the list query schema into OpenAPI query parameters. */
function queryParameters() {
  const schema = jsonSchema(listSwapOrdersQuerySchema) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  return Object.entries(schema.properties ?? {}).map(([name, definition]) => ({
    name,
    in: 'query' as const,
    required: schema.required?.includes(name) ?? false,
    schema: definition,
    description: QUERY_DESCRIPTIONS[name],
  }));
}

const QUERY_DESCRIPTIONS: Record<string, string> = {
  status: 'Filter by status. Repeat the parameter to match several.',
  fromCurrency: 'Exact match on the sold ticker (case-insensitive).',
  toCurrency: 'Exact match on the bought ticker (case-insensitive).',
  walletAddress: 'Exact match on the destination wallet.',
  minAmount: 'Lower bound (inclusive) on fromAmount.',
  maxAmount: 'Upper bound (inclusive) on fromAmount.',
  createdAfter: 'ISO-8601 lower bound (inclusive) on createdAt.',
  createdBefore: 'ISO-8601 upper bound (inclusive) on createdAt.',
  q: 'Free-text search across note and walletAddress.',
  page: '1-based page number.',
  limit: 'Page size, 1-100. Capped so a client cannot request the whole table.',
  sortBy: 'Column to sort by.',
  sortOrder: 'Sort direction.',
};

const idParameter = {
  name: 'id',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Swap Orders API',
    version: '1.0.0',
    description:
      'Problem 5 — a CRUD service over swap orders, built with Express 5, TypeScript and Prisma.\n\n' +
      'Monetary amounts are transported as **strings**, not numbers: `JSON.parse` would turn a JSON ' +
      'number back into an IEEE-754 double on the client and silently lose precision on any token ' +
      'with more than ~15 significant digits.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Swap orders', description: 'Create, read, update and delete swap orders.' },
    { name: 'System', description: 'Liveness and readiness probes.' },
  ],
  paths: {
    [`${API_PREFIX}/swap-orders`]: {
      post: {
        tags: ['Swap orders'],
        summary: 'Create a swap order',
        description:
          '`toAmount` is derived server-side as `fromAmount * rate` and is not accepted from the client.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: jsonSchema(createSwapOrderSchema) } },
        },
        responses: {
          201: {
            description: 'Created. The `Location` header points at the new resource.',
            headers: { Location: { schema: { type: 'string' } } },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/SwapOrder' } },
                },
              },
            },
          },
          422: errorResponse('Validation failed'),
          429: errorResponse('Rate limited'),
        },
      },
      get: {
        tags: ['Swap orders'],
        summary: 'List swap orders with filters',
        parameters: queryParameters(),
        responses: {
          200: {
            description: 'A page of swap orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/SwapOrder' } },
                    meta: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        hasNextPage: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          422: errorResponse('Invalid filter parameters'),
        },
      },
    },
    [`${API_PREFIX}/swap-orders/{id}`]: {
      get: {
        tags: ['Swap orders'],
        summary: 'Get one swap order',
        parameters: [idParameter],
        responses: {
          200: {
            description: 'The swap order',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/SwapOrder' } } },
              },
            },
          },
          404: errorResponse('No such swap order'),
          422: errorResponse('id is not a UUID'),
        },
      },
      patch: {
        tags: ['Swap orders'],
        summary: 'Update a swap order',
        description:
          'Partial update. `fromCurrency`, `toCurrency` and `rate` are immutable — they define the ' +
          'order, and changing them would rewrite history rather than update a record. Status changes ' +
          'are checked against the state machine: PENDING may become CONFIRMED, FAILED or CANCELLED; ' +
          'those three are terminal.',
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: jsonSchema(updateSwapOrderSchema) } },
        },
        responses: {
          200: {
            description: 'The updated swap order',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/SwapOrder' } } },
              },
            },
          },
          404: errorResponse('No such swap order'),
          409: errorResponse('Illegal status transition, or amount change on a settled order'),
          422: errorResponse('Validation failed'),
        },
      },
      delete: {
        tags: ['Swap orders'],
        summary: 'Delete a swap order',
        parameters: [idParameter],
        responses: {
          204: { description: 'Deleted. No content.' },
          404: errorResponse('No such swap order'),
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness probe',
        description: 'Does not touch the database — see health.routes.ts for why.',
        responses: { 200: { description: 'Process is alive' } },
      },
    },
    '/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness probe',
        responses: {
          200: { description: 'Ready to serve traffic' },
          503: { description: 'Database unreachable' },
        },
      },
    },
  },
  components: {
    schemas: {
      SwapOrder: swapOrderResponseSchema,
      Error: errorResponseSchema,
    },
  },
} as const;
