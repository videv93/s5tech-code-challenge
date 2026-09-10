/**
 * Display formatting. Kept apart from `decimal.ts` on purpose: that module is
 * about being *exact*, this one is about being *readable*. Mixing the two is how
 * a rounded display value ends up being submitted as the real amount.
 */

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0.00';
  // Sub-cent amounts are common with low-value tokens; "$0.00" reads as "free".
  if (Math.abs(value) < 0.01) return '<$0.01';
  if (Math.abs(value) >= 1_000_000) return compactUsd.format(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Token amounts need adaptive precision: 1,234.56 SWTH and 0.00004521 WBTC are
 * both "an amount", and a single fixed precision renders one of them useless.
 */
export function formatTokenAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return '—';
  if (numeric === 0) return '0';

  const magnitude = Math.abs(numeric);
  const decimals = magnitude >= 1000 ? 2 : magnitude >= 1 ? 4 : magnitude >= 0.0001 ? 6 : 8;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(numeric);

  // Never render a non-zero amount as "0" — say it is small instead.
  return formatted === '0' ? '<0.00000001' : formatted;
}

/** Exchange rate line: "1 ETH = 1,635.42 USDC". */
export function formatRate(from: string, to: string, rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  const decimals = rate >= 1000 ? 2 : rate >= 1 ? 4 : 8;
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(rate);
  return `1 ${from} = ${value} ${to}`;
}

export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const seconds = Math.round((then - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return 'just now';
}

/** 0x71C7…976F — enough to recognise, short enough to fit. */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  return address.length <= lead + tail ? address : `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
