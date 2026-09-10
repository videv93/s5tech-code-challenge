import type { Prisma, SwapOrder } from '../../db/generated/client.js';
import { prisma } from '../../db/client.js';
import type { ListSwapOrdersQuery } from './swap-order.schema.js';

/**
 * The only layer that knows Prisma exists. Keeping query construction here means
 * the service can be reasoned about (and the storage engine swapped) without
 * touching business rules.
 */

export interface Page<T> {
  data: T[];
  total: number;
}

/** Translate validated query parameters into a Prisma `where` clause. */
function buildWhere(query: ListSwapOrdersQuery): Prisma.SwapOrderWhereInput {
  const where: Prisma.SwapOrderWhereInput = {};

  if (query.status?.length) where.status = { in: query.status };
  if (query.fromCurrency) where.fromCurrency = query.fromCurrency;
  if (query.toCurrency) where.toCurrency = query.toCurrency;
  if (query.walletAddress) where.walletAddress = query.walletAddress;

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.fromAmount = {
      ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
      ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
    };
  }

  if (query.createdAfter !== undefined || query.createdBefore !== undefined) {
    where.createdAt = {
      ...(query.createdAfter !== undefined ? { gte: new Date(query.createdAfter) } : {}),
      ...(query.createdBefore !== undefined ? { lte: new Date(query.createdBefore) } : {}),
    };
  }

  if (query.q) {
    where.OR = [{ note: { contains: query.q } }, { walletAddress: { contains: query.q } }];
  }

  return where;
}

export const swapOrderRepository = {
  async create(data: Prisma.SwapOrderCreateInput): Promise<SwapOrder> {
    return prisma.swapOrder.create({ data });
  },

  async findById(id: string): Promise<SwapOrder | null> {
    return prisma.swapOrder.findUnique({ where: { id } });
  },

  /**
   * One round trip for the page and one for the count, issued together. Total
   * count is what lets a client render "page 3 of 12"; if this list ever grows
   * past the point where COUNT(*) hurts, the migration path is keyset
   * pagination on (createdAt, id) — noted in the README's improvements section.
   */
  async list(query: ListSwapOrdersQuery): Promise<Page<SwapOrder>> {
    const where = buildWhere(query);
    const [data, total] = await prisma.$transaction([
      prisma.swapOrder.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.swapOrder.count({ where }),
    ]);
    return { data, total };
  },

  async update(id: string, data: Prisma.SwapOrderUpdateInput): Promise<SwapOrder> {
    return prisma.swapOrder.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await prisma.swapOrder.delete({ where: { id } });
  },
};
