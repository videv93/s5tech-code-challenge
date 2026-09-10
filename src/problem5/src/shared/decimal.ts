/**
 * Exact decimal multiplication over string operands.
 *
 * Deliberately not `Number(a) * Number(b)`: doubles cannot represent most
 * decimal fractions, and token amounts routinely carry 18 decimal places — well
 * past the ~15 significant digits a double holds exactly. Working with BigInt
 * over the scaled integers keeps every digit.
 *
 * In a production service this would be `decimal.js` (already a transitive
 * dependency of Prisma); it is written out here to make the reasoning explicit
 * rather than to reinvent the library.
 */

/** Maximum decimal places retained in a product, matching the schema's Decimal. */
const MAX_SCALE = 18;

function split(value: string): { digits: bigint; scale: number } {
  const [whole = '0', fraction = ''] = value.split('.');
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

export function multiplyDecimals(a: string, b: string): string {
  const left = split(a);
  const right = split(b);
  const product = left.digits * right.digits;
  const scale = left.scale + right.scale;
  return trimScale(format(product, scale));
}

function format(digits: bigint, scale: number): string {
  if (scale === 0) return digits.toString();
  const negative = digits < 0n;
  const raw = (negative ? -digits : digits).toString().padStart(scale + 1, '0');
  const whole = raw.slice(0, raw.length - scale);
  const fraction = raw.slice(raw.length - scale);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Drop trailing zeros, and any digits beyond the column's scale. */
function trimScale(value: string): string {
  if (!value.includes('.')) return value;
  const [whole = '0', fraction = ''] = value.split('.');
  const truncated = fraction.slice(0, MAX_SCALE).replace(/0+$/, '');
  return truncated.length > 0 ? `${whole}.${truncated}` : whole;
}
