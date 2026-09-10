import { describe, expect, it } from 'vitest';
import { balanceKey, selectVisibleBalances, withPresentation } from './selectors';
import { getPriority, UNSUPPORTED_PRIORITY } from './priority';
import type { PriceMap, WalletBalance } from './types';

const balance = (
  currency: string,
  amount: number,
  blockchain: WalletBalance['blockchain'],
): WalletBalance => ({ currency, amount, blockchain });

describe('selectVisibleBalances', () => {
  // [7] The original kept `amount <= 0` — the exact inverse of what a wallet wants.
  it('keeps only balances with a positive amount', () => {
    const result = selectVisibleBalances([
      balance('ETH', 1, 'Ethereum'),
      balance('ZERO', 0, 'Ethereum'),
      balance('NEG', -5, 'Ethereum'),
    ]);
    expect(result.map((b) => b.currency)).toEqual(['ETH']);
  });

  it('drops balances on unsupported chains', () => {
    const result = selectVisibleBalances([
      balance('ETH', 1, 'Ethereum'),
      balance('XXX', 1, 'Solana' as WalletBalance['blockchain']),
    ]);
    expect(result.map((b) => b.currency)).toEqual(['ETH']);
  });

  it('orders by chain priority, highest first', () => {
    const result = selectVisibleBalances([
      balance('ETH', 1, 'Ethereum'),
      balance('NEO', 1, 'Neo'),
      balance('OSMO', 1, 'Osmosis'),
      balance('ARB', 1, 'Arbitrum'),
    ]);
    expect(result.map((b) => b.blockchain)).toEqual(['Osmosis', 'Ethereum', 'Arbitrum', 'Neo']);
  });

  // [8][20] Zilliqa and Neo both have priority 20 — the original comparator
  // returned `undefined` for this pair.
  it('breaks priority ties deterministically regardless of input order', () => {
    const zil = balance('ZIL', 1, 'Zilliqa');
    const neo = balance('NEO', 1, 'Neo');
    expect(selectVisibleBalances([zil, neo]).map((b) => b.currency)).toEqual(['NEO', 'ZIL']);
    expect(selectVisibleBalances([neo, zil]).map((b) => b.currency)).toEqual(['NEO', 'ZIL']);
  });

  // [23] `.sort()` mutates in place; the source array must survive untouched.
  it('does not mutate the input array', () => {
    const input = [balance('NEO', 1, 'Neo'), balance('OSMO', 1, 'Osmosis')];
    const snapshot = input.map((b) => b.currency);
    selectVisibleBalances(input);
    expect(input.map((b) => b.currency)).toEqual(snapshot);
  });

  it('handles an empty list', () => {
    expect(selectVisibleBalances([])).toEqual([]);
  });
});

describe('getPriority', () => {
  // [5] Constant-time lookup replacing the linear switch; same table.
  it.each([
    ['Osmosis', 100],
    ['Ethereum', 50],
    ['Arbitrum', 30],
    ['Zilliqa', 20],
    ['Neo', 20],
  ] as const)('maps %s to %i, matching the original switch', (chain, expected) => {
    expect(getPriority(chain)).toBe(expected);
  });

  // [3] A typo used to vanish into `any` and silently hide the balance.
  it('falls back to the unsupported sentinel for unknown chains', () => {
    expect(getPriority('Etherium')).toBe(UNSUPPORTED_PRIORITY);
  });
});

describe('withPresentation', () => {
  const prices: PriceMap = { ETH: 2000, ZIL: 0.02 };

  // [15] `toFixed()` with no argument rounded 12.3456 to "12".
  it('formats amounts without truncating to whole units', () => {
    const [row] = withPresentation([balance('ETH', 12.3456, 'Ethereum')], prices);
    expect(row?.formatted).not.toBe('12');
    expect(row?.formatted).toContain('12.3456');
  });

  it('computes the fiat value from the price feed', () => {
    const [row] = withPresentation([balance('ETH', 2, 'Ethereum')], prices);
    expect(row?.usdValue).toBe(4000);
  });

  // [14] The original produced `undefined * amount` → NaN in the UI.
  it('yields null rather than NaN for a token with no price', () => {
    const [row] = withPresentation([balance('SWTH', 5, 'Ethereum')], prices);
    expect(row?.usdValue).toBeNull();
  });

  // [10] The original mapped rows off the unformatted array, so this was undefined.
  it('always attaches a formatted amount', () => {
    const rows = withPresentation(
      [balance('ETH', 1, 'Ethereum'), balance('ZIL', 2, 'Zilliqa')],
      prices,
    );
    expect(rows.every((r) => typeof r.formatted === 'string' && r.formatted.length > 0)).toBe(true);
  });
});

describe('balanceKey', () => {
  // [12] The same symbol exists on multiple chains, so currency alone collides.
  it('distinguishes the same currency on different chains', () => {
    expect(balanceKey(balance('USDC', 1, 'Ethereum'))).not.toBe(
      balanceKey(balance('USDC', 1, 'Arbitrum')),
    );
  });

  it('is stable for the same asset', () => {
    expect(balanceKey(balance('USDC', 1, 'Ethereum'))).toBe(balanceKey(balance('USDC', 99, 'Ethereum')));
  });
});
