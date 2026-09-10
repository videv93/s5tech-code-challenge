import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/db/generated/client.js';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' }),
});

const WALLETS = [
  '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
  'zil1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzuqzx',
];

const PAIRS = [
  { from: 'ETH', to: 'USDC', rate: '2500' },
  { from: 'ETH', to: 'USDT', rate: '2498.5' },
  { from: 'SWTH', to: 'USDC', rate: '0.0041' },
  { from: 'ATOM', to: 'OSMO', rate: '4.2' },
  { from: 'USDC', to: 'ETH', rate: '0.0004' },
  { from: 'NEO', to: 'USDC', rate: '11.75' },
];

const STATUSES = ['PENDING', 'CONFIRMED', 'CONFIRMED', 'FAILED', 'CANCELLED'] as const;

/** Exact string multiplication — same reasoning as src/shared/decimal.ts. */
function multiply(a: string, b: string): string {
  const scale = (v: string) => (v.split('.')[1] ?? '').length;
  const digits = (v: string) => BigInt(v.replace('.', ''));
  const total = scale(a) + scale(b);
  const raw = (digits(a) * digits(b)).toString().padStart(total + 1, '0');
  if (total === 0) return raw;
  const result = `${raw.slice(0, -total)}.${raw.slice(-total)}`;
  return result.replace(/\.?0+$/, '') || '0';
}

async function main(): Promise<void> {
  await prisma.swapOrder.deleteMany();

  const now = Date.now();
  const orders = Array.from({ length: 24 }, (_, index) => {
    const pair = PAIRS[index % PAIRS.length]!;
    const fromAmount = String((index + 1) * 0.25);
    return {
      fromCurrency: pair.from,
      toCurrency: pair.to,
      fromAmount,
      rate: pair.rate,
      toAmount: multiply(fromAmount, pair.rate),
      walletAddress: WALLETS[index % WALLETS.length]!,
      status: STATUSES[index % STATUSES.length]!,
      note: index % 4 === 0 ? `Seeded order #${index + 1}` : null,
      // Spread across the last 24 hours so date filters have something to bite on.
      createdAt: new Date(now - index * 60 * 60 * 1000),
    };
  });

  await prisma.swapOrder.createMany({ data: orders });
  console.log(`Seeded ${orders.length} swap orders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
