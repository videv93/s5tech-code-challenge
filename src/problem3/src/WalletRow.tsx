import { memo } from 'react';
import { formatUsd } from './format';

export interface WalletRowProps {
  className?: string;
  currency: string;
  amount: number;
  usdValue: number | null;
  formattedAmount: string;
}

/**
 * [13] `memo` is what makes the parent's `useMemo` pay off: without it, a new
 * element array on every render re-renders every row regardless. With stable
 * props and stable keys, a price tick now re-renders only the rows whose
 * `usdValue` actually changed.
 */
export const WalletRow = memo(function WalletRow({
  className,
  currency,
  amount,
  usdValue,
  formattedAmount,
}: WalletRowProps) {
  return (
    <div className={className} data-testid="wallet-row" data-currency={currency}>
      <span data-testid="row-currency">{currency}</span>
      <span data-testid="row-amount" title={String(amount)}>
        {formattedAmount}
      </span>
      <span data-testid="row-usd">{formatUsd(usdValue)}</span>
    </div>
  );
});
