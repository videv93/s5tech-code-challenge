import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { PRICES_URL } from '@/lib/tokens';
import { API_BASE_URL } from '@/lib/api';

/**
 * A fixture that keeps the awkward parts of the real feed rather than an
 * idealised version of it: a duplicate currency with two different dates, and a
 * token with an unusable price. Testing against a tidied-up fixture is how the
 * duplicate-handling bug ships.
 */
export const PRICE_FIXTURE = [
  { currency: 'ETH', date: '2023-08-29T07:10:40.000Z', price: 1645.9337 },
  { currency: 'USDC', date: '2023-08-29T07:10:30.000Z', price: 0.989832 },
  { currency: 'SWTH', date: '2023-08-29T07:10:40.000Z', price: 0.00414 },
  { currency: 'WBTC', date: '2023-08-29T07:10:40.000Z', price: 26002.82 },
  { currency: 'ATOM', date: '2023-08-29T07:10:50.000Z', price: 7.1858 },
  { currency: 'OSMO', date: '2023-08-29T07:10:45.000Z', price: 0.3772 },
  { currency: 'STATOM', date: '2023-08-29T07:10:45.000Z', price: 8.51 },
  // Duplicate: the later date must win.
  { currency: 'BUSD', date: '2023-08-29T07:10:40.000Z', price: 0.9 },
  { currency: 'BUSD', date: '2023-08-29T09:00:00.000Z', price: 1.0 },
  // Unpriceable: must be dropped, not offered and then failed on.
  { currency: 'GHOST', date: '2023-08-29T07:10:40.000Z', price: 0 },
];

/** Echoes back a plausible order, deriving toAmount the way the server does. */
export function swapOrderResponse(body: Record<string, string>) {
  const toAmount = String(Number(body['fromAmount']) * Number(body['rate']));
  return {
    data: {
      id: '3f1e0e2c-1111-4000-8000-000000000001',
      fromCurrency: String(body['fromCurrency']).toUpperCase(),
      toCurrency: String(body['toCurrency']).toUpperCase(),
      fromAmount: body['fromAmount'],
      toAmount,
      rate: body['rate'],
      walletAddress: body['walletAddress'],
      status: 'PENDING',
      note: body['note'] ?? null,
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z',
    },
  };
}

export const handlers = [
  http.get(PRICES_URL, () => HttpResponse.json(PRICE_FIXTURE)),

  http.post(`${API_BASE_URL}/api/v1/swap-orders`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json(swapOrderResponse(body), { status: 201 });
  }),
  // Icon requests from <img> — answered so `onUnhandledRequest: 'error'` stays strict.
  http.get('https://raw.githubusercontent.com/*', () => new HttpResponse(null, { status: 200 })),
];

export const server = setupServer(...handlers);
