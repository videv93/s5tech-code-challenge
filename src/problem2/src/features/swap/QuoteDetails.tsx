import { useId, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { formatRate, formatTokenAmount, formatUsd } from '@/lib/format';
import type { Quote } from '@/lib/swap';
import { FEE_RATE } from '@/lib/swap';
import type { Token } from '@/lib/tokens';
import { cn } from '@/lib/utils';

interface QuoteDetailsProps {
  quote: Quote;
  from: Token;
  to: Token;
  slippage: number;
}

function Row({ label, hint, value }: { label: string; hint?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="flex items-center gap-1 text-[var(--text-secondary)]">
        {label}
        {hint && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button type="button" aria-label={`What is ${label}?`} className="text-[var(--text-tertiary)]">
                <Info className="size-3.5" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                sideOffset={6}
                className="z-50 max-w-56 rounded-lg bg-[var(--text-primary)] px-2.5 py-1.5 text-xs text-[var(--surface-card)] shadow-lg"
              >
                {hint}
                <Tooltip.Arrow className="fill-[var(--text-primary)]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Collapsed by default — the rate is what most users need, and the rest is
 * detail. But it is *present*: a swap UI that hides fees, minimum received and
 * price impact is hiding exactly the numbers that cost the user money.
 */
export function QuoteDetails({ quote, from, to, slippage }: QuoteDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const impactPercent = quote.priceImpact * 100;
  const impactTone =
    impactPercent >= 5
      ? 'text-[var(--color-danger-400)]'
      : impactPercent >= 1
        ? 'text-[var(--color-warning-400)]'
        : 'text-[var(--text-primary)]';

  return (
    <div className="mt-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] px-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex w-full items-center justify-between py-3 text-sm"
      >
        <span className="font-medium tabular-nums">{formatRate(from.symbol, to.symbol, quote.rate)}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div
        id={contentId}
        hidden={!expanded}
        className="border-t border-[var(--border-subtle)] py-2"
      >
        <Row
          label="Expected output"
          value={`${formatTokenAmount(quote.netOut)} ${to.symbol}`}
        />
        <Row
          label="Minimum received"
          hint={`If the rate moves more than ${slippage}% against you, the swap is cancelled instead of filled at a worse price.`}
          value={`${formatTokenAmount(quote.minimumReceived)} ${to.symbol}`}
        />
        <Row
          label="Price impact"
          hint="The difference in USD value between what you put in and what you get out."
          value={<span className={impactTone}>{impactPercent.toFixed(2)}%</span>}
        />
        <Row
          label={`Network fee (${(FEE_RATE * 100).toFixed(1)}%)`}
          hint="Simulated for this demo — a real swap would quote the on-chain gas cost here."
          value={`${formatTokenAmount(quote.feeAmount)} ${to.symbol}`}
        />
        <Row label="Value in" value={formatUsd(quote.fromUsd)} />
        <Row label="Value out" value={formatUsd(quote.toUsd)} />
      </div>
    </div>
  );
}
