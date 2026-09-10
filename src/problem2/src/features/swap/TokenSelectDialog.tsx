import { useDeferredValue, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Search, X } from 'lucide-react';
import { TokenIcon } from '@/components/TokenIcon';
import { formatTokenAmount, formatUsd } from '@/lib/format';
import { POPULAR_SYMBOLS, type Token } from '@/lib/tokens';
import { cn } from '@/lib/utils';

interface TokenSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: Token[];
  balances: Record<string, string>;
  selected: Token | null;
  /** The token on the other leg — shown as unavailable rather than hidden. */
  counterpart: Token | null;
  onSelect: (token: Token) => void;
}

/**
 * Radix Dialog rather than a hand-rolled modal: focus trapping, `Escape`,
 * scroll locking, `aria-modal` and focus restoration on close are all things
 * that are easy to half-implement and very visible to anyone using a keyboard
 * or a screen reader.
 */
export function TokenSelectDialog({
  open,
  onOpenChange,
  tokens,
  balances,
  selected,
  counterpart,
  onSelect,
}: TokenSelectDialogProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // Keeps typing responsive while the list re-filters on a slower device.
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const matched = needle
      ? tokens.filter((token) => token.symbol.toLowerCase().includes(needle))
      : tokens;

    // Sort by wallet value: the token you hold most of is the one you are most
    // likely to be looking for.
    return [...matched].sort((a, b) => {
      const valueA = Number(balances[a.symbol] ?? 0) * a.price;
      const valueB = Number(balances[b.symbol] ?? 0) * b.price;
      if (valueA !== valueB) return valueB - valueA;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [tokens, balances, deferredQuery]);

  const popular = useMemo(
    () => POPULAR_SYMBOLS.map((symbol) => tokens.find((t) => t.symbol === symbol)).filter(Boolean) as Token[],
    [tokens],
  );

  const handleSelect = (token: Token) => {
    onSelect(token);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            // Focus the search box, not the close button — typing is what the
            // user came here to do.
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)]',
            'bg-[var(--surface-overlay)] shadow-2xl',
            'max-h-[min(36rem,calc(100dvh-4rem))]',
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <Dialog.Title className="text-base font-semibold">Select a token</Dialog.Title>
            <Dialog.Close
              aria-label="Close token list"
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Search the token list, then choose a token to swap.
          </Dialog.Description>

          <div className="px-5">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or symbol"
                aria-label="Search tokens"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-brand-400"
              />
            </div>
          </div>

          {popular.length > 0 && !deferredQuery && (
            <div className="flex flex-wrap gap-2 px-5 pt-4">
              {popular.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => handleSelect(token)}
                  disabled={token.symbol === counterpart?.symbol}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors hover:bg-[var(--surface-panel)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TokenIcon symbol={token.symbol} src={token.iconUrl} size={20} />
                  {token.symbol}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">
                No token matches “{deferredQuery}”.
              </p>
            ) : (
              <ul role="listbox" aria-label="Tokens">
                {results.map((token) => {
                  const balance = balances[token.symbol] ?? '0';
                  const isSelected = token.symbol === selected?.symbol;
                  // Shown but disabled, not hidden: a token vanishing from the
                  // list reads as a bug, whereas "already on the other side" is
                  // information.
                  const isCounterpart = token.symbol === counterpart?.symbol;

                  return (
                    <li key={token.symbol}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={isCounterpart}
                        onClick={() => handleSelect(token)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                          'hover:bg-[var(--surface-panel)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                          isSelected && 'bg-[var(--surface-panel)]',
                        )}
                      >
                        <TokenIcon symbol={token.symbol} src={token.iconUrl} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 font-semibold">
                            {token.symbol}
                            {isCounterpart && (
                              <span className="rounded-md bg-[var(--surface-panel-hover)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                                In use
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-[var(--text-secondary)] tabular-nums">
                            {formatUsd(token.price)}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-medium tabular-nums">
                            {formatTokenAmount(balance)}
                          </span>
                          <span className="block text-xs text-[var(--text-secondary)] tabular-nums">
                            {formatUsd(Number(balance) * token.price)}
                          </span>
                        </span>
                        {isSelected && <Check aria-hidden className="size-4 text-brand-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
