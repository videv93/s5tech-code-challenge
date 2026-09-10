import { z } from 'zod';

/**
 * Client for the Problem 5 service. The two halves of this submission describe
 * the same domain, so the swap form submits real orders rather than pretending
 * to: a completed swap here is a row in that database, retrievable at
 * `GET /api/v1/swap-orders/:id`.
 */
export const API_BASE_URL =
  import.meta.env['VITE_API_URL'] ?? 'https://api.duelcode.online';

/** Mirrors the server's DTO — amounts are strings on the wire, deliberately. */
const swapOrderSchema = z.object({
  id: z.string(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmount: z.string(),
  toAmount: z.string(),
  rate: z.string(),
  walletAddress: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED']),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SwapOrder = z.infer<typeof swapOrderSchema>;

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

/** Carries the server's own code and correlation id, so failures stay diagnosable. */
export class ApiError extends Error {
  // Written out rather than declared as constructor parameter properties, which
  // `erasableSyntaxOnly` disallows — that syntax emits code, and this project
  // requires every type annotation to be erasable.
  readonly code: string;
  readonly status: number;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * Render a number as a plain decimal string.
 *
 * `String(0.000000159)` gives `"1.59e-7"`, and the API's validator rejects
 * exponential notation — so a swap between a cheap token and an expensive one
 * (SWTH → WBTC, rate ≈ 1.6e-7) would fail with a 422 that looks like a server
 * bug. `toFixed` avoids the exponent for anything below 1e21.
 */
export function toDecimalString(value: number, maxDecimals = 18): string | null {
  if (!Number.isFinite(value) || value <= 0 || value >= 1e21) return null;
  const fixed = value.toFixed(maxDecimals);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' || Number(trimmed) === 0 ? null : trimmed;
}

export interface CreateSwapOrderInput {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  rate: string;
  walletAddress: string;
  note?: string;
}

/**
 * `toAmount` is deliberately absent: the server derives it from
 * `fromAmount * rate`. Sending all three would let the client submit an
 * internally inconsistent order.
 */
export async function createSwapOrder(
  input: CreateSwapOrderInput,
  signal?: AbortSignal,
): Promise<SwapOrder> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/swap-orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (cause) {
    // A network-level failure — offline, DNS, CORS, the service down. Say that,
    // rather than surfacing "Failed to fetch" to someone about to move money.
    throw new ApiError(
      'NETWORK_ERROR',
      'Could not reach the swap service. Your funds were not moved.',
      0,
      undefined,
      cause,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = errorSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(
        parsed.data.error.code,
        parsed.data.error.message,
        response.status,
        parsed.data.error.requestId,
        parsed.data.error.details,
      );
    }
    throw new ApiError('UNEXPECTED_ERROR', `The service responded ${response.status}`, response.status);
  }

  // The success envelope is validated too: a shape change should fail loudly
  // here rather than surface as `undefined` in the receipt.
  const parsed = z.object({ data: swapOrderSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError('UNEXPECTED_RESPONSE', 'The swap service returned an unexpected response', 200);
  }
  return parsed.data.data;
}

export function orderUrl(id: string): string {
  return `${API_BASE_URL}/api/v1/swap-orders/${id}`;
}
