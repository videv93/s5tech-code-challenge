import { useMutation } from '@tanstack/react-query';
import { ApiError, createSwapOrder, toDecimalString, type SwapOrder } from '@/lib/api';
import type { Token } from '@/lib/tokens';
import { walletAddress } from '@/lib/wallet';
import type { CompletedSwap } from './SwapReceipt';

export interface SwapRequest {
  from: Token;
  to: Token;
  amountIn: string;
  amountOut: string;
  usdValue: number;
}

/**
 * Submits the swap to the Problem 5 service — the same domain, so this is a real
 * order rather than a simulated one. The resulting row is retrievable at
 * `GET /api/v1/swap-orders/:id`, which is what makes the receipt verifiable.
 *
 * Settlement itself is still notional: the service records the order as PENDING
 * and no funds move. That is the honest boundary — the API call is real, the
 * blockchain leg is not, and the UI says so rather than implying otherwise.
 */
export function useSwapExecution(onSuccess: (swap: CompletedSwap) => void) {
  return useMutation<CompletedSwap, Error, SwapRequest>({
    mutationFn: async (request) => {
      const rate = toDecimalString(request.from.price / request.to.price);
      if (rate === null) {
        throw new ApiError(
          'UNQUOTABLE_PAIR',
          'This pair cannot be quoted at the current prices.',
          0,
        );
      }

      const order: SwapOrder = await createSwapOrder({
        fromCurrency: request.from.symbol,
        toCurrency: request.to.symbol,
        fromAmount: request.amountIn,
        rate,
        walletAddress,
        note: `Swap from the web client`,
      });

      return {
        from: request.from,
        to: request.to,
        // The server's figures, not the client's: `toAmount` is derived
        // server-side, so showing the response is what the record actually says.
        amountIn: order.fromAmount,
        amountOut: order.toAmount,
        usdValue: request.usdValue,
        orderId: order.id,
        status: order.status,
        completedAt: order.createdAt,
      };
    },
    // A failed submission is not retried automatically: the user should decide
    // whether to resubmit something that moves money.
    retry: false,
    onSuccess,
  });
}
