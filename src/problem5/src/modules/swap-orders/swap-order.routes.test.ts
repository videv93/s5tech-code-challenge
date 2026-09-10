import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createOrder, ORDERS_PATH, resetDatabase, validOrder } from '../../test/helpers.js';
import { disconnectDatabase } from '../../db/client.js';

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('POST /swap-orders — create', () => {
  it('creates an order and returns 201 with a Location header', async () => {
    const response = await api().post(ORDERS_PATH).send(validOrder);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      fromCurrency: 'ETH',
      toCurrency: 'USDC',
      fromAmount: '1.5',
      status: 'PENDING',
    });
    expect(response.headers['location']).toBe(`${ORDERS_PATH}/${response.body.data.id}`);
  });

  it('derives toAmount server-side rather than trusting the client', async () => {
    const order = await createOrder({ fromAmount: '1.5', rate: '2500' });
    expect(order['toAmount']).toBe('3750');
  });

  it('preserves precision that a float would destroy', async () => {
    // 0.1 * 0.2 === 0.020000000000000004 in IEEE-754.
    const order = await createOrder({ fromAmount: '0.1', rate: '0.2' });
    expect(order['toAmount']).toBe('0.02');
  });

  it('normalises ticker symbols to uppercase', async () => {
    const order = await createOrder({ fromCurrency: 'eth', toCurrency: 'usdc' });
    expect(order['fromCurrency']).toBe('ETH');
    expect(order['toCurrency']).toBe('USDC');
  });

  it.each([
    ['a negative amount', { fromAmount: '-1' }],
    ['a zero amount', { fromAmount: '0' }],
    ['a zero rate', { rate: '0' }],
    ['a short wallet address', { walletAddress: 'abc' }],
    ['an unknown field', { unexpected: true }],
  ])('rejects %s with 422', async (_label, patch) => {
    const response = await api().post(ORDERS_PATH).send({ ...validOrder, ...patch });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a swap from a currency to itself', async () => {
    const response = await api().post(ORDERS_PATH).send({ ...validOrder, toCurrency: 'ETH' });
    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body.error.details)).toContain('must differ');
  });

  it('names the offending fields in the error body', async () => {
    const response = await api().post(ORDERS_PATH).send({ ...validOrder, fromAmount: '-1' });
    const fields = (response.body.error.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('fromAmount');
  });

  it('returns 400, not 500, for malformed JSON', async () => {
    const response = await api()
      .post(ORDERS_PATH)
      .set('content-type', 'application/json')
      .send('{"fromCurrency":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });
});

describe('GET /swap-orders — list with filters', () => {
  beforeEach(async () => {
    await createOrder({ fromCurrency: 'ETH', toCurrency: 'USDC', fromAmount: '1', note: 'alpha' });
    await createOrder({ fromCurrency: 'SWTH', toCurrency: 'USDC', fromAmount: '10', note: 'beta' });
    await createOrder({ fromCurrency: 'NEO', toCurrency: 'USDT', fromAmount: '100' });
  });

  it('returns every order with pagination metadata', async () => {
    const response = await api().get(ORDERS_PATH);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.meta).toMatchObject({ page: 1, total: 3, totalPages: 1, hasNextPage: false });
  });

  it('filters by currency', async () => {
    const response = await api().get(ORDERS_PATH).query({ fromCurrency: 'swth' });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].fromCurrency).toBe('SWTH');
  });

  it('filters by status, accepting the parameter more than once', async () => {
    const [first] = (await api().get(ORDERS_PATH)).body.data;
    await api().patch(`${ORDERS_PATH}/${first.id}`).send({ status: 'CONFIRMED' });

    const response = await api().get(`${ORDERS_PATH}?status=CONFIRMED&status=FAILED`);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe('CONFIRMED');
  });

  it('filters by amount range', async () => {
    const response = await api().get(ORDERS_PATH).query({ minAmount: '5', maxAmount: '50' });
    expect(response.body.data.map((o: { fromAmount: string }) => o.fromAmount)).toEqual(['10']);
  });

  it('searches free text across note and wallet address', async () => {
    const response = await api().get(ORDERS_PATH).query({ q: 'alpha' });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].note).toBe('alpha');
  });

  it('paginates deterministically', async () => {
    const first = await api().get(ORDERS_PATH).query({ limit: 2, page: 1 });
    const second = await api().get(ORDERS_PATH).query({ limit: 2, page: 2 });

    expect(first.body.data).toHaveLength(2);
    expect(second.body.data).toHaveLength(1);
    expect(first.body.meta.hasNextPage).toBe(true);
    expect(second.body.meta.hasNextPage).toBe(false);

    // No row may appear on two pages — the trap that an unstable sort sets.
    const ids = [...first.body.data, ...second.body.data].map((o: { id: string }) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('sorts by the requested column and direction', async () => {
    const response = await api().get(ORDERS_PATH).query({ sortBy: 'fromAmount', sortOrder: 'asc' });
    expect(response.body.data.map((o: { fromAmount: string }) => o.fromAmount)).toEqual(['1', '10', '100']);
  });

  it('caps the page size so a client cannot request the whole table', async () => {
    const response = await api().get(ORDERS_PATH).query({ limit: 5000 });
    expect(response.status).toBe(422);
  });

  it.each([
    ['an unsortable column', { sortBy: 'walletAddress' }],
    ['an unknown status', { status: 'ALMOST' }],
    ['an unknown filter', { colour: 'red' }],
    ['minAmount above maxAmount', { minAmount: '10', maxAmount: '1' }],
  ])('rejects %s with 422', async (_label, query) => {
    const response = await api().get(ORDERS_PATH).query(query);
    expect(response.status).toBe(422);
  });

  it('returns an empty page rather than 404 when nothing matches', async () => {
    const response = await api().get(ORDERS_PATH).query({ fromCurrency: 'DOGE' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });
});

describe('GET /swap-orders/:id — details', () => {
  it('returns the order', async () => {
    const created = await createOrder();
    const response = await api().get(`${ORDERS_PATH}/${created['id']}`);
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(created['id']);
  });

  it('returns 404 for an id that does not exist', async () => {
    const response = await api().get(`${ORDERS_PATH}/3f1e0e2c-0000-4000-8000-000000000000`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422, not 500, for an id that is not a UUID', async () => {
    const response = await api().get(`${ORDERS_PATH}/not-a-uuid`);
    expect(response.status).toBe(422);
  });
});

describe('PATCH /swap-orders/:id — update', () => {
  it('applies a partial update and leaves other fields alone', async () => {
    const created = await createOrder({ note: 'before' });
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ note: 'after' });

    expect(response.status).toBe(200);
    expect(response.body.data.note).toBe('after');
    expect(response.body.data.fromAmount).toBe(created['fromAmount']);
  });

  it('recomputes toAmount when the amount changes', async () => {
    const created = await createOrder({ fromAmount: '1', rate: '2500' });
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ fromAmount: '2' });
    expect(response.body.data.toAmount).toBe('5000');
  });

  it('clears a nullable field when sent null', async () => {
    const created = await createOrder({ note: 'temporary' });
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ note: null });
    expect(response.body.data.note).toBeNull();
  });

  it('advances the status through a legal transition', async () => {
    const created = await createOrder();
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ status: 'CONFIRMED' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CONFIRMED');
  });

  it('refuses to reopen a settled order', async () => {
    const created = await createOrder();
    await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ status: 'CONFIRMED' });

    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ status: 'PENDING' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('refuses to amend the amount of a settled order', async () => {
    const created = await createOrder();
    await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ status: 'CONFIRMED' });

    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ fromAmount: '99' });
    expect(response.status).toBe(409);
  });

  it('rejects an attempt to change the immutable rate', async () => {
    const created = await createOrder();
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({ rate: '1' });
    expect(response.status).toBe(422);
  });

  it('rejects an empty body', async () => {
    const created = await createOrder();
    const response = await api().patch(`${ORDERS_PATH}/${created['id']}`).send({});
    expect(response.status).toBe(422);
  });

  it('returns 404 for an id that does not exist', async () => {
    const response = await api()
      .patch(`${ORDERS_PATH}/3f1e0e2c-0000-4000-8000-000000000000`)
      .send({ note: 'x' });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /swap-orders/:id', () => {
  it('deletes the order and returns 204 with no body', async () => {
    const created = await createOrder();
    const response = await api().delete(`${ORDERS_PATH}/${created['id']}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect((await api().get(`${ORDERS_PATH}/${created['id']}`)).status).toBe(404);
  });

  it('is not silently idempotent — a second delete reports 404', async () => {
    const created = await createOrder();
    await api().delete(`${ORDERS_PATH}/${created['id']}`);
    expect((await api().delete(`${ORDERS_PATH}/${created['id']}`)).status).toBe(404);
  });
});

describe('cross-cutting behaviour', () => {
  it('echoes a correlation id on every response', async () => {
    const response = await api().get(ORDERS_PATH).set('x-request-id', 'trace-me-123');
    expect(response.headers['x-request-id']).toBe('trace-me-123');
  });

  it('includes the correlation id in error bodies', async () => {
    const response = await api().get(`${ORDERS_PATH}/nope`).set('x-request-id', 'trace-me-456');
    expect(response.body.error.requestId).toBe('trace-me-456');
  });

  it('sets security headers', async () => {
    const response = await api().get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('answers 404 with a JSON body for an unknown route', async () => {
    const response = await api().get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('serves the OpenAPI document generated from the validation schemas', async () => {
    const response = await api().get('/docs/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.paths[ORDERS_PATH].post).toBeDefined();
  });

  it('reports liveness and readiness', async () => {
    expect((await api().get('/health')).body.status).toBe('ok');
    expect((await api().get('/ready')).body.database).toBe('up');
  });
});
