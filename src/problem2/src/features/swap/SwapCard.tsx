import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { useTokens } from '@/hooks/useTokens';
import { computeQuote, percentOfBalance } from '@/lib/swap';
import type { Token } from '@/lib/tokens';
import { buildWallet } from '@/lib/wallet';
import { cn } from '@/lib/utils';
import { AmountPanel } from './AmountPanel';
import { QuoteDetails } from './QuoteDetails';
import { DEFAULT_SLIPPAGE, SlippageSettings } from './SlippageSettings';
import { SwapCardSkeleton, SwapLoadError } from './SwapCardStates';
import { SwapReceipt, type CompletedSwap } from './SwapReceipt';
import { TokenSelectDialog } from './TokenSelectDialog';
import { buildSwapSchema, sanitiseAmountInput, type SwapFormValues } from './swap-schema';
import { useSwapExecution } from './useSwapExecution';
import { PriceFooter } from './PriceFooter';

type Side = 'from' | 'to';

const DEFAULT_PAIR = { from: 'ETH', to: 'USDC' } as const;

export function SwapCard() {
  const { data: tokens, isPending, isError, error, refetch, isFetching } = useTokens();

  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [pickerSide, setPickerSide] = useState<Side | null>(null);
  const [receipt, setReceipt] = useState<CompletedSwap | null>(null);
  /** Local overrides so a completed swap visibly moves the mock balances. */
  const [spent, setSpent] = useState<Record<string, number>>({});
  const amountRef = useRef<HTMLInputElement>(null);

  const balances = useMemo(() => {
    if (!tokens) return {};
    const base = buildWallet(tokens);
    return Object.fromEntries(
      Object.entries(base).map(([symbol, amount]) => [
        symbol,
        String(Math.max(0, Number(amount) + (spent[symbol] ?? 0))),
      ]),
    );
  }, [tokens, spent]);

  // Seed a sensible default pair once prices arrive, so the form is immediately
  // useful instead of presenting two empty selectors.
  useEffect(() => {
    if (!tokens || fromToken || toToken) return;
    setFromToken(tokens.find((t) => t.symbol === DEFAULT_PAIR.from) ?? tokens[0] ?? null);
    setToToken(tokens.find((t) => t.symbol === DEFAULT_PAIR.to) ?? tokens[1] ?? null);
  }, [tokens, fromToken, toToken]);

  const fromBalance = fromToken ? (balances[fromToken.symbol] ?? '0') : '0';

  const schema = useMemo(
    () =>
      buildSwapSchema({
        hasFromToken: fromToken !== null,
        hasToToken: toToken !== null,
        balance: fromBalance,
        symbol: fromToken?.symbol ?? null,
      }),
    [fromToken, toToken, fromBalance],
  );

  const form = useForm<SwapFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '' },
    // Validate as the user types, but only after the first blur or submit —
    // flagging "enter an amount" on an untouched field is nagging, not helping.
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  // `watch` subscribes this component to the amount field, which React Compiler
  // cannot memoise. That is the deliberate trade: the amount is the one value
  // the card genuinely re-renders on (it drives the quote), while every other
  // field stays uncontrolled. The derived values below are memoised by hand.
  // oxlint-disable-next-line react/incompatible-library
  const amount = form.watch('amount');
  const quote = useMemo(
    () => computeQuote(amount, fromToken, toToken, slippage),
    [amount, fromToken, toToken, slippage],
  );

  // Re-run validation when the pair changes: the same amount can be fine for one
  // token and over-balance for another.
  useEffect(() => {
    if (form.formState.isSubmitted || form.formState.touchedFields.amount) {
      void form.trigger('amount');
    }
  }, [fromToken, toToken, form]);

  const execution = useSwapExecution((completed) => {
    setSpent((current) => ({
      ...current,
      [completed.from.symbol]: (current[completed.from.symbol] ?? 0) - Number(completed.amountIn),
      [completed.to.symbol]: (current[completed.to.symbol] ?? 0) + Number(completed.amountOut),
    }));
    setReceipt(completed);
    form.reset({ amount: '' });
  });

  const handleFlip = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    // Carry the quoted output across as the new input — the user's intent when
    // flipping is usually "now go the other way with roughly this much".
    if (quote) form.setValue('amount', quote.netOut, { shouldValidate: true });
    amountRef.current?.focus();
  }, [fromToken, toToken, quote, form]);

  const handleSelectToken = useCallback(
    (token: Token) => {
      if (pickerSide === 'from') {
        if (token.symbol === toToken?.symbol) setToToken(fromToken);
        setFromToken(token);
      } else {
        if (token.symbol === fromToken?.symbol) setFromToken(toToken);
        setToToken(token);
      }
    },
    [pickerSide, fromToken, toToken],
  );

  const onSubmit = form.handleSubmit((values) => {
    if (!fromToken || !toToken || !quote) return;
    execution.mutate({
      from: fromToken,
      to: toToken,
      amountIn: values.amount,
      amountOut: quote.netOut,
      usdValue: quote.fromUsd,
    });
  });

  if (isPending) return <SwapCardSkeleton />;
  if (isError || !tokens) {
    return <SwapLoadError message={error?.message ?? 'Unknown error'} onRetry={() => void refetch()} retrying={isFetching} />;
  }

  const amountError = form.formState.errors.amount?.message;
  const canSubmit = quote !== null && !amountError && amount !== '' && !execution.isPending;

  return (
    <>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-label="Currency swap"
        className="surface-card w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-4 sm:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Swap</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void refetch()}
              aria-label="Refresh prices"
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
            >
              <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            </button>
            <SlippageSettings value={slippage} onChange={setSlippage} />
          </div>
        </div>

        <div className="relative">
          <AmountPanel
            ref={amountRef}
            label="You pay"
            token={fromToken}
            balance={fromBalance}
            value={amount}
            usdValue={quote?.fromUsd ?? null}
            invalid={Boolean(amountError)}
            describedBy={amountError ? 'amount-error' : undefined}
            onValueChange={(next) =>
              form.setValue('amount', sanitiseAmountInput(next, amount), {
                shouldValidate: form.formState.isSubmitted || form.formState.touchedFields.amount,
                shouldTouch: true,
              })
            }
            onSelectToken={() => setPickerSide('from')}
            onPercent={(percent) =>
              form.setValue('amount', percentOfBalance(fromBalance, percent), {
                shouldValidate: true,
                shouldTouch: true,
              })
            }
          />

          {/* Overlaps both panels so the direction of the swap is legible at a
              glance, without needing a label. */}
          <div className="relative z-10 flex h-0 items-center justify-center">
            <button
              type="button"
              onClick={handleFlip}
              aria-label="Swap the pay and receive tokens"
              className="group -my-3 grid size-10 place-items-center rounded-xl border-4 border-[var(--surface-card)] bg-[var(--surface-panel)] transition-colors hover:bg-[var(--surface-panel-hover)]"
            >
              <ArrowDown
                aria-hidden
                className="size-4 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-180"
              />
            </button>
          </div>

          <AmountPanel
            label="You receive"
            token={toToken}
            balance={toToken ? (balances[toToken.symbol] ?? '0') : '0'}
            value={quote ? quote.netOut : ''}
            usdValue={quote?.toUsd ?? null}
            readOnly
            onSelectToken={() => setPickerSide('to')}
          />
        </div>

        {/* One live region for both validation and execution errors, so a screen
            reader announces the problem without the user hunting for it. */}
        <div role="alert" aria-live="polite" id="amount-error">
          {amountError && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-[var(--color-danger-400)]">
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {amountError}
            </p>
          )}
          {execution.isError && !amountError && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-[var(--color-danger-400)]">
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {execution.error.message}
            </p>
          )}
        </div>

        {quote && fromToken && toToken && (
          <QuoteDetails quote={quote} from={fromToken} to={toToken} slippage={slippage} />
        )}

        <Button
          type="submit"
          size="lg"
          loading={execution.isPending}
          disabled={!canSubmit}
          className="mt-4 w-full"
        >
          {execution.isPending
            ? 'Confirming swap…'
            : amountError
              ? amountError
              : amount === ''
                ? 'Enter an amount'
                : `Swap ${fromToken?.symbol} for ${toToken?.symbol}`}
        </Button>

        <PriceFooter tokens={tokens} isFetching={isFetching} />
      </form>

      <TokenSelectDialog
        open={pickerSide !== null}
        onOpenChange={(open) => !open && setPickerSide(null)}
        tokens={tokens}
        balances={balances}
        selected={pickerSide === 'from' ? fromToken : toToken}
        counterpart={pickerSide === 'from' ? toToken : fromToken}
        onSelect={handleSelectToken}
      />

      <SwapReceipt swap={receipt} onDismiss={() => setReceipt(null)} />
    </>
  );
}
