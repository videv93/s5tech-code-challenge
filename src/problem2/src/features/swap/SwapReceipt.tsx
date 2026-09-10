import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { orderUrl } from '@/lib/api';
import { formatTokenAmount, formatUsd, truncateAddress } from '@/lib/format';
import type { Token } from '@/lib/tokens';
import { walletAddress } from '@/lib/wallet';

export interface CompletedSwap {
  from: Token;
  to: Token;
  amountIn: string;
  amountOut: string;
  usdValue: number;
  /** Identifier of the row created by the API — the receipt is verifiable. */
  orderId: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  completedAt: string;
}

interface SwapReceiptProps {
  swap: CompletedSwap | null;
  onDismiss: () => void;
}

/**
 * A confirmation the user can actually verify, rather than a toast that vanishes
 * before it can be read. Financial actions deserve a receipt — the exact amounts,
 * where it went, and a reference to quote if something looks wrong.
 */
export function SwapReceipt({ swap, onDismiss }: SwapReceiptProps) {
  return (
    <Dialog.Root open={swap !== null} onOpenChange={(open) => !open && onDismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-6 text-center shadow-2xl">
          {swap && (
            <>
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--color-success-500)]/15">
                <Check aria-hidden className="size-7 text-[var(--color-success-500)]" strokeWidth={3} />
              </div>

              <Dialog.Title className="mt-4 text-lg font-semibold">Order submitted</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-secondary)]">
                {formatUsd(swap.usdValue)} recorded by the swap service.
              </Dialog.Description>

              <div className="mt-5 flex items-center justify-center gap-3 rounded-[var(--radius-panel)] bg-[var(--surface-panel)] p-4">
                <span className="flex flex-col items-center gap-1.5">
                  <TokenIcon symbol={swap.from.symbol} src={swap.from.iconUrl} size={32} />
                  <span className="text-sm font-semibold tabular-nums">
                    {formatTokenAmount(swap.amountIn)}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">{swap.from.symbol}</span>
                </span>
                <ArrowRight aria-hidden className="size-4 text-[var(--text-tertiary)]" />
                <span className="flex flex-col items-center gap-1.5">
                  <TokenIcon symbol={swap.to.symbol} src={swap.to.iconUrl} size={32} />
                  <span className="text-sm font-semibold tabular-nums">
                    {formatTokenAmount(swap.amountOut)}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">{swap.to.symbol}</span>
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-left text-xs">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">To wallet</dt>
                  <dd className="font-medium tabular-nums">{truncateAddress(walletAddress)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">Status</dt>
                  <dd className="font-medium">{swap.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">Order</dt>
                  <dd>
                    {/* The receipt is checkable: this resolves to the real
                        record in the Problem 5 service. */}
                    <a
                      href={orderUrl(swap.orderId)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-medium tabular-nums underline decoration-dotted underline-offset-2"
                    >
                      {truncateAddress(swap.orderId, 8, 6)}
                      <ExternalLink aria-hidden className="size-3 text-[var(--text-tertiary)]" />
                    </a>
                  </dd>
                </div>
              </dl>

              <Button size="lg" onClick={onDismiss} className="mt-5 w-full">
                Make another swap
              </Button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
