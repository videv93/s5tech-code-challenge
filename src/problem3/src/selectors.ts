import { formatAmount } from './format';
import { getPriority, UNSUPPORTED_PRIORITY } from './priority';
import type { FormattedWalletBalance, PriceMap, WalletBalance } from './types';

/**
 * Filter to the balances worth showing, ordered by chain priority (highest
 * first). Extracted from the component as a pure function so the ordering rules
 * can be unit-tested without rendering anything.
 *
 * [6] Fixes the `ReferenceError`: the original computed `balancePriority` and
 *     then tested an undeclared `lhsPriority`.
 * [7] Fixes the inverted predicate: the original kept balances with
 *     `amount <= 0` — i.e. it showed exactly the empty wallets and hid every
 *     one with funds in it.
 * [8] Fixes the comparator: the original had no `return 0` branch, so equal
 *     priorities (Zilliqa vs Neo, both 20) returned `undefined`. A comparator
 *     returning a non-number is outside the spec's contract and forfeits the
 *     stability guarantee V8 otherwise provides.
 * [20] Adds a deterministic tiebreak on currency, so equal-priority rows keep a
 *     fixed order across renders instead of depending on input order.
 * [21] Decorate–sort–undecorate: `getPriority` is called once per balance (n
 *     times) instead of twice per comparison (2·n·log n times). At 200 balances
 *     that is 200 lookups rather than ~3,000.
 */
export function selectVisibleBalances(balances: readonly WalletBalance[]): WalletBalance[] {
  return balances
    .map((balance) => ({ balance, priority: getPriority(balance.blockchain) }))
    .filter(({ balance, priority }) => priority > UNSUPPORTED_PRIORITY && balance.amount > 0)
    .sort((lhs, rhs) => rhs.priority - lhs.priority || lhs.balance.currency.localeCompare(rhs.balance.currency))
    .map(({ balance }) => balance);
}

/**
 * Attach the presentation-only fields (formatted amount, fiat value).
 *
 * [9] Kept separate from `selectVisibleBalances` so the two can be memoised on
 *     different dependencies: prices tick constantly, but a price change cannot
 *     reorder the list, so re-sorting on every tick is wasted work.
 * [10] The original computed `formattedBalances` and then never used it —
 *     rendering `sortedBalances` instead, so every row received
 *     `formattedAmount={undefined}`. Here the formatted list is the only thing
 *     the rows can be built from.
 * [14] A token with no price yields `usdValue: null` rather than `NaN`.
 */
export function withPresentation(
  balances: readonly WalletBalance[],
  prices: PriceMap,
): FormattedWalletBalance[] {
  return balances.map((balance) => {
    const price = prices[balance.currency];
    return {
      ...balance,
      formatted: formatAmount(balance.amount),
      usdValue: price === undefined ? null : price * balance.amount,
    };
  });
}

/**
 * [12] Stable identity for a row. `currency` alone is not guaranteed unique —
 * the same symbol can exist on several chains (USDC on Ethereum and Arbitrum) —
 * so the key is the pair. The original used the array index, which is the worst
 * possible choice for a list that re-sorts: React then matches row 0 to row 0
 * across renders even though a different token now occupies that slot, so any
 * component state or DOM identity follows the *position* rather than the asset.
 */
export function balanceKey(balance: WalletBalance): string {
  return `${balance.blockchain}:${balance.currency}`;
}
