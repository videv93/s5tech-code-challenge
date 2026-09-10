/**
 * [15] The original called `amount.toFixed()` with no argument, which rounds to
 * zero decimal places — a balance of 12.3456 rendered as "12". For a wallet
 * that is a data-integrity bug, not a cosmetic one. `Intl.NumberFormat` also
 * gives us grouping separators and locale awareness for free.
 */
const AMOUNT_DECIMALS = 4;

const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: AMOUNT_DECIMALS,
});

const usdFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

export function formatAmount(amount: number): string {
  return amountFormatter.format(amount);
}

export function formatUsd(usdValue: number | null): string {
  // [14] A missing price is rendered as an explicit placeholder rather than the
  // "NaN" the original produced from `undefined * amount`.
  return usdValue === null ? '—' : usdFormatter.format(usdValue);
}
