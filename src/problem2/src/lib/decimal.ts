/**
 * Exact decimal arithmetic over strings, backed by BigInt.
 *
 * A swap form is the last place to reach for `parseFloat`. `0.1 + 0.2` is
 * `0.30000000000000004`, and an 18-decimal token amount has more significant
 * digits than an IEEE-754 double can hold — so a user who types their full
 * balance and hits "Max" can end up quoting a number that is not their balance.
 * Every amount here stays a string from input to display.
 *
 * Scoped deliberately to the four operations this form needs. A production app
 * would use decimal.js or dnum; this is small enough to read in one sitting and
 * keeps the dependency list honest.
 */

const SCALE = 24; // internal working precision, well beyond any token's decimals

interface Fixed {
  value: bigint; // scaled by 10^SCALE
}

function fromString(input: string): Fixed | null {
  const trimmed = input.trim();
  if (!/^-?\d*(\.\d*)?$/.test(trimmed) || trimmed === '' || trimmed === '.' || trimmed === '-') {
    return null;
  }
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace('-', '').split('.');
  const padded = fraction.padEnd(SCALE, '0').slice(0, SCALE);
  const magnitude = BigInt(`${whole || '0'}${padded}`);
  return { value: negative ? -magnitude : magnitude };
}

function toString(fixed: Fixed, decimals: number): string {
  const negative = fixed.value < 0n;
  const magnitude = negative ? -fixed.value : fixed.value;
  const raw = magnitude.toString().padStart(SCALE + 1, '0');
  const whole = raw.slice(0, raw.length - SCALE);
  let fraction = raw.slice(raw.length - SCALE);

  // Round half-up at the requested precision rather than truncating, so a
  // displayed amount is the nearest representable one.
  if (decimals < SCALE) {
    const keep = fraction.slice(0, decimals);
    const nextDigit = Number(fraction[decimals] ?? '0');
    if (nextDigit >= 5) {
      const bumped = (BigInt(`1${keep || ''}`) + 1n).toString().slice(1);
      // A carry out of the fraction has to propagate into the whole part.
      if (bumped.length > keep.length) {
        const carried = (BigInt(whole) + 1n).toString();
        return `${negative ? '-' : ''}${trimTrailing(carried, '0'.repeat(decimals))}`;
      }
      fraction = bumped;
    } else {
      fraction = keep;
    }
  }

  return `${negative ? '-' : ''}${trimTrailing(whole, fraction)}`;
}

function trimTrailing(whole: string, fraction: string): string {
  const cleanedWhole = whole.replace(/^0+(?=\d)/, '');
  const cleanedFraction = fraction.replace(/0+$/, '');
  return cleanedFraction ? `${cleanedWhole}.${cleanedFraction}` : cleanedWhole;
}

const ONE = 10n ** BigInt(SCALE);

/** `a * b`, exact. Returns null if either operand is not a decimal. */
export function multiply(a: string, b: string, decimals = 8): string | null {
  const left = fromString(a);
  const right = fromString(b);
  if (!left || !right) return null;
  return toString({ value: (left.value * right.value) / ONE }, decimals);
}

/** `a / b`, to `decimals` places. Returns null on a non-decimal or divide-by-zero. */
export function divide(a: string, b: string, decimals = 8): string | null {
  const left = fromString(a);
  const right = fromString(b);
  if (!left || !right || right.value === 0n) return null;
  return toString({ value: (left.value * ONE) / right.value }, decimals);
}

/** -1, 0 or 1. Returns null if either operand is not a decimal. */
export function compare(a: string, b: string): -1 | 0 | 1 | null {
  const left = fromString(a);
  const right = fromString(b);
  if (!left || !right) return null;
  if (left.value < right.value) return -1;
  if (left.value > right.value) return 1;
  return 0;
}

export function isValidDecimal(input: string): boolean {
  return fromString(input) !== null;
}

export function isPositive(input: string): boolean {
  const parsed = fromString(input);
  return parsed !== null && parsed.value > 0n;
}

/** Normalise for display: strip leading/trailing noise without changing value. */
export function normalise(input: string, decimals = 8): string | null {
  const parsed = fromString(input);
  return parsed ? toString(parsed, decimals) : null;
}
