import { z } from 'zod';

export const SWAP_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'] as const;
export type SwapOrderStatus = (typeof SWAP_ORDER_STATUSES)[number];

/**
 * Money is validated as a decimal *string* and never round-trips through a JS
 * number. `0.1 + 0.2 !== 0.3`, and a token amount with 18 decimals exceeds the
 * 15-17 significant digits an IEEE-754 double can represent exactly — silently.
 * Numbers are accepted for ergonomics but immediately normalised to a string.
 */
const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,18})?$/, 'must be a non-negative decimal with at most 18 decimal places'),
  );

const positiveDecimalString = decimalString.refine(
  (value) => Number(value) > 0,
  'must be greater than zero',
);

/** Ticker symbols are normalised to uppercase so filtering is predictable. */
const currencyCode = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[A-Za-z0-9._-]+$/, 'must be a ticker symbol, e.g. ETH or USDC')
  .transform((value) => value.toUpperCase());

const walletAddress = z
  .string()
  .trim()
  .min(8, 'looks too short to be a wallet address')
  .max(128);

export const createSwapOrderSchema = z
  .object({
    fromCurrency: currencyCode,
    toCurrency: currencyCode,
    fromAmount: positiveDecimalString,
    /** Quoted rate in toCurrency per fromCurrency. `toAmount` is derived from it. */
    rate: positiveDecimalString,
    walletAddress,
    note: z.string().trim().max(500).optional(),
  })
  .strict() // reject unknown keys rather than silently dropping them
  .refine((body) => body.fromCurrency !== body.toCurrency, {
    message: 'fromCurrency and toCurrency must differ',
    path: ['toCurrency'],
  });

/**
 * PATCH semantics: every field optional, but at least one required — an empty
 * body is a client bug, and answering 200 to it hides that.
 *
 * Note what is *not* updatable: `fromCurrency`, `toCurrency` and `rate`. Those
 * define the order's identity; changing them would rewrite history rather than
 * update a record. Correcting them means cancelling and re-creating.
 */
export const updateSwapOrderSchema = z
  .object({
    fromAmount: positiveDecimalString.optional(),
    walletAddress: walletAddress.optional(),
    status: z.enum(SWAP_ORDER_STATUSES).optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'provide at least one field to update',
  });

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'fromAmount', 'status'] as const;

/**
 * List filters. Every parameter is optional and every one is typed — a bad
 * `limit` or an unsortable column is a 422 with a readable message, not an
 * unbounded table scan.
 */
export const listSwapOrdersQuerySchema = z
  .object({
    status: z
      .union([z.enum(SWAP_ORDER_STATUSES), z.array(z.enum(SWAP_ORDER_STATUSES))])
      .optional()
      .transform((value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value])),
    fromCurrency: currencyCode.optional(),
    toCurrency: currencyCode.optional(),
    walletAddress: z.string().trim().min(1).optional(),
    minAmount: decimalString.optional(),
    maxAmount: decimalString.optional(),
    createdAfter: z.iso.datetime({ offset: true }).optional(),
    createdBefore: z.iso.datetime({ offset: true }).optional(),
    /** Free-text match against note and wallet address. */
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    // Capped: without an upper bound, `?limit=1000000` is a denial-of-service
    // primitive handed to every client.
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(SORTABLE_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(
    (query) =>
      query.minAmount === undefined ||
      query.maxAmount === undefined ||
      Number(query.minAmount) <= Number(query.maxAmount),
    { message: 'minAmount must not exceed maxAmount', path: ['minAmount'] },
  )
  .refine(
    (query) =>
      query.createdAfter === undefined ||
      query.createdBefore === undefined ||
      new Date(query.createdAfter) <= new Date(query.createdBefore),
    { message: 'createdAfter must not be later than createdBefore', path: ['createdAfter'] },
  );

export const idParamSchema = z.object({
  id: z.uuid('must be a UUID'),
});

export type CreateSwapOrderInput = z.infer<typeof createSwapOrderSchema>;
export type UpdateSwapOrderInput = z.infer<typeof updateSwapOrderSchema>;
export type ListSwapOrdersQuery = z.infer<typeof listSwapOrdersQuerySchema>;
