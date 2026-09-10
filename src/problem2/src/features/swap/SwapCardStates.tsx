import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';

/**
 * The skeleton mirrors the real layout's dimensions so the card does not jump
 * when prices arrive. A spinner in the middle of an empty box is easier to
 * write and worse to look at.
 */
export function SwapCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading token prices"
      className="surface-card w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="skeleton h-6 w-16 rounded-lg" />
        <div className="skeleton size-8 rounded-lg" />
      </div>
      <div className="skeleton h-[7.5rem] rounded-[var(--radius-panel)]" />
      <div className="my-1 flex justify-center">
        <div className="skeleton size-10 rounded-xl" />
      </div>
      <div className="skeleton h-[7.5rem] rounded-[var(--radius-panel)]" />
      <div className="skeleton mt-3 h-12 rounded-[var(--radius-panel)]" />
      <div className="skeleton mt-4 h-14 rounded-2xl" />
      <span className="sr-only">Loading token prices…</span>
    </div>
  );
}

interface SwapLoadErrorProps {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

/**
 * An error state that says what failed, why it matters, and what to do — rather
 * than "Something went wrong", which tells the user nothing and offers no exit.
 */
export function SwapLoadError({ message, onRetry, retrying }: SwapLoadErrorProps) {
  return (
    <div
      role="alert"
      className="surface-card w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-8 text-center"
    >
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--color-danger-400)]/12">
        <AlertCircle aria-hidden className="size-6 text-[var(--color-danger-400)]" />
      </div>
      <h2 className="mt-4 text-base font-semibold">Couldn’t load token prices</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-[var(--text-secondary)]">
        Without live prices we can’t quote an exchange rate, so the form is disabled rather than
        showing you a number we can’t stand behind.
      </p>
      <p className="mt-3 font-mono text-xs text-[var(--text-tertiary)]">{message}</p>
      <Button onClick={onRetry} loading={retrying} className="mt-5">
        {!retrying && <RefreshCw aria-hidden className="size-4" />}
        Try again
      </Button>
    </div>
  );
}
