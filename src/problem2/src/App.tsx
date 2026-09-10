import * as Tooltip from '@radix-ui/react-tooltip';
import { Moon, Sun, Wallet } from 'lucide-react';
import { SwapCard } from '@/features/swap/SwapCard';
import { useTheme } from '@/hooks/useTheme';
import { truncateAddress } from '@/lib/format';
import { walletAddress } from '@/lib/wallet';

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <Tooltip.Provider delayDuration={200}>
      {/* Decorative only, so it is hidden from assistive technology. */}
      <div aria-hidden className="aurora pointer-events-none fixed inset-0 overflow-hidden" />

      <div className="relative flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-white">
              <Wallet aria-hidden className="size-4" />
            </span>
            Swapper
          </span>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium sm:inline-flex">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-success-500)]" />
              {truncateAddress(walletAddress)}
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center sm:pt-0">
          <div className="w-full max-w-[27rem]">
            <SwapCard />
          </div>
        </main>

        {/* Says exactly which parts are real. Balances are mocked and no funds
            move, but a submitted swap is a genuine row in the Problem 5 service,
            so the receipt links to a record that can be fetched back. */}
        <footer className="px-4 pb-6 text-center text-xs text-[var(--text-tertiary)]">
          Demo build — balances are simulated and no funds move, but each swap is
          recorded by a{' '}
          <a
            href="https://api.duelcode.online/docs"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--text-secondary)]"
          >
            live API
          </a>
          . Prices from{' '}
          <a
            href="https://interview.switcheo.com/prices.json"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--text-secondary)]"
          >
            interview.switcheo.com
          </a>
          .
        </footer>
      </div>
    </Tooltip.Provider>
  );
}
