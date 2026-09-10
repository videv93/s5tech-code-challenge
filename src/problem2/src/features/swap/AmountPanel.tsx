import { forwardRef } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
import { TokenIcon } from '@/components/TokenIcon';
import { formatTokenAmount, formatUsd } from '@/lib/format';
import type { Token } from '@/lib/tokens';
import { cn } from '@/lib/utils';

interface AmountPanelProps {
  label: string;
  token: Token | null;
  balance: string;
  value: string;
  usdValue: number | null;
  readOnly?: boolean;
  loading?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onValueChange?: (value: string) => void;
  onSelectToken: () => void;
  onPercent?: (percent: number) => void;
}

const PERCENTS = [25, 50, 75, 100] as const;

export const AmountPanel = forwardRef<HTMLInputElement, AmountPanelProps>(function AmountPanel(
  {
    label,
    token,
    balance,
    value,
    usdValue,
    readOnly = false,
    loading = false,
    invalid = false,
    describedBy,
    onValueChange,
    onSelectToken,
    onPercent,
  },
  ref,
) {
  const hasBalance = Number(balance) > 0;

  // The editable field shows exactly what the user typed; the read-only quote is
  // display-formatted, since "2486.7794779" is a number nobody reads as money.
  const displayValue = readOnly && value !== '' ? formatTokenAmount(value) : value;

  // A long quote must not overflow the panel or push the token pill off-screen.
  const fontSize =
    displayValue.length > 16 ? 'text-xl' : displayValue.length > 11 ? 'text-2xl' : 'text-3xl';

  return (
    <div
      className={cn(
        'surface-panel rounded-[var(--radius-panel)] border p-4 transition-colors duration-200',
        invalid ? 'border-[var(--color-danger-400)]' : 'border-transparent focus-within:border-brand-400/60',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          {label}
        </span>
        {token && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Wallet aria-hidden className="size-3.5" />
            <span className="tabular-nums">{formatTokenAmount(balance)}</span>
            <span className="sr-only">{token.symbol} available</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <input
          ref={ref}
          value={displayValue}
          onChange={(event) => onValueChange?.(event.target.value)}
          readOnly={readOnly}
          // `inputMode="decimal"` gives mobile the numeric keypad while the
          // field stays type="text" — a type="number" input silently discards
          // values the browser dislikes and cannot hold a partial "1." while
          // the user is still typing.
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0"
          aria-label={`${label} amount`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none',
            fontSize,
            'transition-[font-size] duration-150',
            'placeholder:text-[var(--text-tertiary)]',
            readOnly && 'cursor-default',
            loading && 'animate-pulse text-[var(--text-tertiary)]',
          )}
        />

        <button
          type="button"
          onClick={onSelectToken}
          aria-label={token ? `Change token, currently ${token.symbol}` : 'Select a token'}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 font-semibold',
            'border border-[var(--border-subtle)] bg-[var(--surface-card)]',
            'transition-[background-color,transform] duration-150 hover:bg-[var(--surface-panel-hover)] active:scale-[0.97]',
          )}
        >
          {token ? (
            <>
              <TokenIcon symbol={token.symbol} src={token.iconUrl} size={26} />
              <span className="max-w-24 truncate">{token.symbol}</span>
            </>
          ) : (
            <span className="pl-2">Select</span>
          )}
          <ChevronDown aria-hidden className="size-4 text-[var(--text-tertiary)]" />
        </button>
      </div>

      <div className="mt-1.5 flex h-6 items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)] tabular-nums">
          {usdValue === null ? '' : formatUsd(usdValue)}
        </span>

        {onPercent && hasBalance && (
          <div className="flex gap-1">
            {PERCENTS.map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => onPercent(percent)}
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand-500 transition-colors hover:bg-brand-500/10"
              >
                {percent === 100 ? 'MAX' : `${percent}%`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
