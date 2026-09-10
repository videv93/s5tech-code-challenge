import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PriceMap, WalletBalance } from './types';

/** Mutable fixtures the mocked hooks read from, so a test can "tick" the price feed. */
let currentBalances: readonly WalletBalance[] = [];
let currentPrices: PriceMap = {};

vi.mock('./hooks', () => ({
  useWalletBalances: () => currentBalances,
  usePrices: () => currentPrices,
}));

/** Wrap the real selector so we can count how often the sort actually runs. */
const sortSpy = vi.fn();
vi.mock('./selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./selectors')>();
  return {
    ...actual,
    selectVisibleBalances: (balances: readonly WalletBalance[]) => {
      sortSpy();
      return actual.selectVisibleBalances(balances);
    },
  };
});

const { WalletPage } = await import('./WalletPage');

const balance = (
  currency: string,
  amount: number,
  blockchain: WalletBalance['blockchain'],
): WalletBalance => ({ currency, amount, blockchain });

beforeEach(() => {
  sortSpy.mockClear();
  currentBalances = [
    balance('NEO', 10, 'Neo'),
    balance('EMPTY', 0, 'Ethereum'),
    balance('OSMO', 2.5, 'Osmosis'),
    balance('ETH', 1.23456, 'Ethereum'),
    balance('SWTH', 100, 'Ethereum'),
  ];
  currentPrices = { OSMO: 0.5, ETH: 2000, NEO: 12 };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WalletPage', () => {
  // [6] The original threw ReferenceError before rendering anything at all.
  it('renders without throwing', () => {
    expect(() => render(<WalletPage />)).not.toThrow();
  });

  // [7] The original showed exactly the empty balances and hid the funded ones.
  it('shows funded balances and hides empty ones', () => {
    render(<WalletPage />);
    const currencies = screen.getAllByTestId('row-currency').map((el) => el.textContent);
    expect(currencies).toContain('ETH');
    expect(currencies).not.toContain('EMPTY');
  });

  it('orders rows by chain priority', () => {
    render(<WalletPage />);
    const currencies = screen.getAllByTestId('row-currency').map((el) => el.textContent);
    expect(currencies).toEqual(['OSMO', 'ETH', 'SWTH', 'NEO']);
  });

  // [10] Every row used to receive formattedAmount={undefined} → blank column.
  it('renders a non-empty formatted amount in every row', () => {
    render(<WalletPage />);
    for (const row of screen.getAllByTestId('wallet-row')) {
      expect(within(row).getByTestId('row-amount').textContent).not.toBe('');
    }
  });

  // [15] toFixed() with no argument rendered this as "1".
  it('does not truncate a fractional balance to whole units', () => {
    render(<WalletPage />);
    const row = screen.getAllByTestId('wallet-row').find((el) => el.dataset['currency'] === 'ETH');
    expect(within(row!).getByTestId('row-amount').textContent).toBe('1.2346');
  });

  // [14] undefined * amount used to render the literal string "NaN".
  it('renders a placeholder, not NaN, for a token with no price', () => {
    render(<WalletPage />);
    const row = screen.getAllByTestId('wallet-row').find((el) => el.dataset['currency'] === 'SWTH');
    const usd = within(row!).getByTestId('row-usd').textContent ?? '';
    expect(usd).not.toContain('NaN');
    expect(usd).toBe('—');
  });

  // [12] Keys must follow the asset, not the array index.
  it('keys rows by chain and currency so re-sorting preserves identity', () => {
    const { rerender } = render(<WalletPage />);
    const before = screen.getAllByTestId('wallet-row').map((el) => el.dataset['currency']);
    const firstNode = screen.getAllByTestId('wallet-row')[0];

    // A price change must not disturb the DOM nodes backing each asset.
    currentPrices = { ...currentPrices, ETH: 2500 };
    rerender(<WalletPage />);

    const after = screen.getAllByTestId('wallet-row').map((el) => el.dataset['currency']);
    expect(after).toEqual(before);
    expect(screen.getAllByTestId('wallet-row')[0]).toBe(firstNode);
  });

  // [9] THE headline fix: the original listed `prices` in the sort memo's deps,
  // so every tick of the price feed re-ran the whole filter + sort.
  it('does not re-sort when only prices change', () => {
    const { rerender } = render(<WalletPage />);
    expect(sortSpy).toHaveBeenCalledTimes(1);

    currentPrices = { ...currentPrices, ETH: 2500 };
    rerender(<WalletPage />);
    currentPrices = { ...currentPrices, ETH: 2600 };
    rerender(<WalletPage />);
    currentPrices = { ...currentPrices, ETH: 2700 };
    rerender(<WalletPage />);

    expect(sortSpy).toHaveBeenCalledTimes(1);
  });

  it('does re-sort when the balances themselves change', () => {
    const { rerender } = render(<WalletPage />);
    expect(sortSpy).toHaveBeenCalledTimes(1);

    currentBalances = [...currentBalances, balance('ZIL', 42, 'Zilliqa')];
    rerender(<WalletPage />);

    expect(sortSpy).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId('row-currency').map((el) => el.textContent)).toContain('ZIL');
  });

  // [16] The original destructured children out of props and never rendered it.
  it('renders children instead of silently dropping them', () => {
    render(
      <WalletPage>
        <span data-testid="child">footer</span>
      </WalletPage>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('forwards remaining box props to the container', () => {
    const { container } = render(<WalletPage className="wallet-page" id="wallet" />);
    const root = container.querySelector('#wallet');
    expect(root).toHaveClass('wallet-page');
  });
});
