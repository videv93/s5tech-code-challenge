import { useMutation } from '@tanstack/react-query';
import { ApiError, createSwapOrder, type SwapOrder } from '@/lib/api';
import { normalise } from '@/lib/decimal';
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
       * The amount is canonicalised before it goes on the wire.
       *
       * The input deliberately accepts the half-finished forms real typing
       * produces — `.5`, `1.` — because rejecting them mid-keystroke makes the
       * field feel broken. The API's decimal format requires a digit on each
       * side of the point, so `.5` reaches it as `0.5`. Without this the form
       * quotes happily and then fails on submit with a validation error that
       * looks like a server fault.
       */
      const fromAmount = normalise(request.amountIn, 18);
      if (fromAmount === null) {
        throw new ApiError('INVALID_AMOUNT', 'That amount could not be read as a number.', 0);
      }

      /**
       * The *effective* rate is submitted, not the raw price ratio. The server
       * derives `toAmount = fromAmount * rate`, so sending the pre-fee rate
       * would record an amount larger than the one the user agreed to — the
       * receipt would then contradict the quote it was printed from.
       */
      const order: SwapOrder = await createSwapOrder({
        fromCurrency: request.from.symbol,
        toCurrency: request.to.symbol,
        fromAmount,
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
