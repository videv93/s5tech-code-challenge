import { useMutation } from '@tanstack/react-query';
import { sleep } from '@/lib/utils';
import type { Token } from '@/lib/tokens';
import type { CompletedSwap } from './SwapReceipt';

export interface SwapRequest {
  from: Token;
  to: Token;
  amountIn: string;
  amountOut: string;
  usdValue: number;
}

function randomHash(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Simulated settlement. The brief explicitly permits mocking the backend, so
 * this models the parts that change the UI rather than pretending to be a chain:
 * a realistic delay, a resolved transaction hash, and a failure path.
 *
 * The occasional failure is deliberate. A form that has only ever been seen
 * succeeding has an untested error state, and that error state is what a user
 * meets on their worst day.
 */
export function useSwapExecution(onSuccess: (swap: CompletedSwap) => void) {
  return useMutation<CompletedSwap, Error, SwapRequest>({
    mutationFn: async (request) => {
      await sleep(1400 + Math.random() * 700);

      if (Math.random() < 0.12) {
        throw new Error('The network rejected this swap. Your funds were not moved.');
      }

      return {
        from: request.from,
        to: request.to,
        amountIn: request.amountIn,
        amountOut: request.amountOut,
        usdValue: request.usdValue,
        transactionHash: randomHash(),
        completedAt: new Date().toISOString(),
      };
    },
    onSuccess,
  });
}
