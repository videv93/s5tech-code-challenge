import type { Prisma, SwapOrder } from '../../db/generated/client.js';
import { AppError } from '../../shared/errors.js';
import { multiplyDecimals } from '../../shared/decimal.js';
import { swapOrderRepository } from './swap-order.repository.js';
import type {
  CreateSwapOrderInput,
  ListSwapOrdersQuery,
  SwapOrderStatus,
  UpdateSwapOrderInput,
} from './swap-order.schema.js';

/**
 * Legal status transitions. An order settles once; letting a CONFIRMED order
 * slide back to PENDING would let a caller replay a settlement. Encoding this as
 * data rather than as `if` statements makes the whole state machine reviewable
 * at a glance, and makes the terminal states obvious (empty arrays).
 */
const ALLOWED_TRANSITIONS: Record<SwapOrderStatus, readonly SwapOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'FAILED', 'CANCELLED'],
  CONFIRMED: [],
  FAILED: [],
  CANCELLED: [],
};

/** Wire representation: Decimals as strings, dates as ISO-8601. */
export interface SwapOrderDto {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  walletAddress: string;
  status: SwapOrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialising Decimal as a string is deliberate. `JSON.parse` turns a JSON
 * number back into a double on the client, reintroducing exactly the precision
 * loss the Decimal column exists to prevent.
 */
export function toDto(order: SwapOrder): SwapOrderDto {
  return {
    id: order.id,
    fromCurrency: order.fromCurrency,
    toCurrency: order.toCurrency,
    fromAmount: order.fromAmount.toString(),
    toAmount: order.toAmount.toString(),
    rate: order.rate.toString(),
    walletAddress: order.walletAddress,
    status: order.status as SwapOrderStatus,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export const swapOrderService = {
  /**
   * `toAmount` is derived server-side from `fromAmount * rate` and is not
   * accepted from the client. Taking all three from the request would let a
   * caller submit an internally inconsistent order, and there would be no way to
   * tell later which of the three fields was the wrong one.
   */
  async create(input: CreateSwapOrderInput): Promise<SwapOrderDto> {
    const toAmount = multiplyDecimals(input.fromAmount, input.rate);
    const order = await swapOrderRepository.create({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromAmount: input.fromAmount,
      rate: input.rate,
      toAmount,
      walletAddress: input.walletAddress,
      note: input.note ?? null,
    });
    return toDto(order);
  },

  async findById(id: string): Promise<SwapOrderDto> {
    const order = await swapOrderRepository.findById(id);
    if (!order) throw AppError.notFound('SwapOrder', id);
    return toDto(order);
  },

  async list(query: ListSwapOrdersQuery) {
    const { data, total } = await swapOrderRepository.list(query);
    return {
      data: data.map(toDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        hasNextPage: query.page * query.limit < total,
      },
    };
  },

  async update(id: string, input: UpdateSwapOrderInput): Promise<SwapOrderDto> {
    const existing = await swapOrderRepository.findById(id);
    if (!existing) throw AppError.notFound('SwapOrder', id);

    const currentStatus = existing.status as SwapOrderStatus;

    if (input.status !== undefined && input.status !== currentStatus) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed.includes(input.status)) {
        throw AppError.conflict(
          `cannot transition a ${currentStatus} order to ${input.status}`,
          { from: currentStatus, to: input.status, allowed },
        );
      }
    }

    // A settled order is a financial record; amending its amount after the fact
    // would rewrite what actually happened.
    if (input.fromAmount !== undefined && currentStatus !== 'PENDING') {
      throw AppError.conflict(`cannot change the amount of a ${currentStatus} order`, {
        status: currentStatus,
      });
    }

    const data: Prisma.SwapOrderUpdateInput = {};
    if (input.fromAmount !== undefined) {
      data.fromAmount = input.fromAmount;
      // Keep the derived field consistent — the rate is fixed at quote time.
      data.toAmount = multiplyDecimals(input.fromAmount, existing.rate.toString());
    }
    if (input.walletAddress !== undefined) data.walletAddress = input.walletAddress;
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;

    return toDto(await swapOrderRepository.update(id, data));
  },

  async delete(id: string): Promise<void> {
    const existing = await swapOrderRepository.findById(id);
    if (!existing) throw AppError.notFound('SwapOrder', id);
    await swapOrderRepository.delete(id);
  },
};
