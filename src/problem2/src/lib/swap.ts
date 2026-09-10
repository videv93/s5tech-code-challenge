import { divide, multiply } from './decimal';
import { toDecimalString } from './api';
import type { Token } from './tokens';

/** Simulated network fee, as a fraction of the input amount. */
export const FEE_RATE = 0.003; // 0.3%

export interface Quote {
  /**
   * Destination units per source unit *after* the fee — the rate actually
   * applied. `netOut === fromAmount * effectiveRate` by construction, which is
   * what lets the server derive the same figure the user was quoted.
   */
  effectiveRate: string;
  /** Amount received before fees, exact. */
  grossOut: string;
  /** Amount received after fees — what the user actually gets. */
  netOut: string;
  /** Fee, denominated in the destination token. */
  feeAmount: string;
  /** Minimum guaranteed by the slippage setting. */
  minimumReceived: string;
  /** Destination units per source unit. */
  rate: number;
  /** USD value of the input leg. */
  fromUsd: number;
  /** USD value of the output leg. */
  toUsd: number;
  /**
   * Difference between the two legs' USD value, as a fraction. With a static
   * price feed this only ever reflects the fee, but the field exists because a
   * swap UI that hides price impact is hiding the thing that costs users money.
   */
  priceImpact: number;
}

/**
 * Compute a quote. Returns null when the inputs cannot produce one, rather than
 * a partly-filled object — a caller cannot then render half a quote by mistake.
 */
export function computeQuote(
  amount: string,
  from: Token | null,
  to: Token | null,
  slippagePercent: number,
): Quote | null {
  if (!from || !to || amount === '') return null;

  const rate = from.price / to.price;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const rateString = toDecimalString(rate);
  if (rateString === null) return null;

  // Exact string maths, not parseFloat — see lib/decimal.ts for why.
  const grossOut = multiply(amount, rateString, 8);
  if (grossOut === null) return null;

  /**
   * The net amount is derived from a single effective rate rather than as
   * "gross minus fee". Both give the same number here, but only this form can be
   * handed to a server that derives `toAmount = fromAmount * rate` — and the
   * order record has to say what the user was actually quoted, not a
   * pre-fee figure they never agreed to.
   */
  const effectiveRate = toDecimalString(rate * (1 - FEE_RATE));
  if (effectiveRate === null) return null;

  const netOut = multiply(amount, effectiveRate, 8);
  if (netOut === null) return null;

  const feeAmount = subtract(grossOut, netOut);
  const minimumReceived = multiply(netOut, String(1 - slippagePercent / 100), 8) ?? netOut;

  const fromUsd = Number(amount) * from.price;
  const toUsd = Number(netOut) * to.price;

  return {
    effectiveRate,
    grossOut,
    netOut,
    feeAmount,
    minimumReceived,
    rate,
    fromUsd,
    toUsd,
    priceImpact: fromUsd > 0 ? (fromUsd - toUsd) / fromUsd : 0,
  };
}

/** `a - b` over decimal strings, via divide/multiply's exact representation. */
function subtract(a: string, b: string): string {
  const scale = '100000000'; // 8dp
  const left = BigInt(multiply(a, scale, 0) ?? '0');
  const right = BigInt(multiply(b, scale, 0) ?? '0');
  const result = left - right;
  return divide(result.toString(), scale, 8) ?? '0';
}

/**
 * Amount of `from` equivalent to `percent` of the balance.
 *
 * 100% short-circuits to the balance verbatim. Routing it through the
 * multiplication would round at 8 decimal places, so "Max" on a token with a
 * tiny balance would quietly quote slightly less than the user actually holds —
 * and the resulting amount would no longer compare equal to their balance.
 * Percentages below 100 keep 18 places, matching the input field's own limit.
 */
export function percentOfBalance(balance: string, percent: number): string {
  if (percent === 100) return balance;
  return multiply(balance, String(percent / 100), 18) ?? '0';
}
