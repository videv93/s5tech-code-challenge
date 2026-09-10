import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db/client.js';
import { API_PREFIX } from '../config/constants.js';

export const ORDERS_PATH = `${API_PREFIX}/swap-orders`;

/** In-process app — no port binding, so no flaky "address already in use". */
export const app: Express = createApp();
export const api = () => request(app);

export async function resetDatabase(): Promise<void> {
  await prisma.swapOrder.deleteMany();
}

export const validOrder = {
  fromCurrency: 'ETH',
  toCurrency: 'USDC',
  fromAmount: '1.5',
  rate: '2500',
  walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
};

export async function createOrder(overrides: Record<string, unknown> = {}) {
  const response = await api().post(ORDERS_PATH).send({ ...validOrder, ...overrides });
  if (response.status !== 201) {
    throw new Error(`Fixture creation failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body.data as Record<string, string>;
}
