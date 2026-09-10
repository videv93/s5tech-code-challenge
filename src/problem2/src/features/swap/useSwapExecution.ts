import { useMutation } from '@tanstack/react-query';
import { createSwapOrder, type SwapOrder } from '@/lib/api';
import { FEE_RATE } from '@/lib/swap';
import type { Token } from '@/lib/tokens';
import { walletAddress } from '@/lib/wallet';
import type { CompletedSwap } from './SwapReceipt';

export interface SwapRequest {
  from: Token;
  to: Token;
  amountIn: string;
  amountOut: string;
  usdValue: number;
  /** The post-fee rate the user was quoted at. */
  effectiveRate: string;
  /** Pre-fee rate, recorded on the order for auditability. */
  grossRate: string;
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
      /**
       * The *effective* rate is submitted, not the raw price ratio. The server
       * derives `toAmount = fromAmount * rate`, so sending the pre-fee rate
       * would record an amount larger than the one the user agreed to — the
       * receipt would then contradict the quote it was printed from.
       */
      const order: SwapOrder = await createSwapOrder({
        fromCurrency: request.from.symbol,
        toCurrency: request.to.symbol,
        fromAmount: request.amountIn,
        rate: request.effectiveRate,
        walletAddress,
        note: `Quoted at 1 ${request.from.symbol} = ${request.grossRate} ${request.to.symbol}, less ${(FEE_RATE * 100).toFixed(1)}% fee`,
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
