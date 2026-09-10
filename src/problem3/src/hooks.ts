import { useSyncExternalStore } from 'react';
import type { PriceMap, WalletBalance } from './types';

/**
 * Stand-ins for the data hooks the brief references but does not provide.
 * They exist so the refactor compiles and can be rendered in tests; the shapes
 * are what matters, not the implementations.
 *
 * Note the return types are `readonly` — the original called `.sort()` on the
 * array straight out of `useWalletBalances()`. `Array.prototype.sort` mutates
 * in place, so had `filter` not already produced a fresh copy, that line would
 * have been reordering the hook's cached array underneath every other consumer.
 * Typing the source as `readonly` makes that class of mistake a compile error.
 */

const NO_BALANCES: readonly WalletBalance[] = [];
const NO_PRICES: PriceMap = {};

export function useWalletBalances(): readonly WalletBalance[] {
  return useSyncExternalStore(
    () => () => {},
    () => NO_BALANCES,
    () => NO_BALANCES,
  );
}

export function usePrices(): PriceMap {
  return useSyncExternalStore(
    () => () => {},
    () => NO_PRICES,
    () => NO_PRICES,
  );
}
