import { describe, expect, it } from 'vitest';
import { computeQuote, FEE_RATE, percentOfBalance } from './swap';
import type { Token } from './tokens';

const token = (symbol: string, price: number): Token => ({
  symbol,
  price,
  quotedAt: '2023-08-29T07:10:40.000Z',
  iconUrl: '',
});

const ETH = token('ETH', 2000);
const USDC = token('USDC', 1);

describe('computeQuote', () => {
  it('converts at the ratio of the two prices', () => {
    const quote = computeQuote('1', ETH, USDC, 0.5);
    expect(quote?.rate).toBe(2000);
    expect(quote?.grossOut).toBe('2000');
  });

  it('deducts the fee from the amount received', () => {
    const quote = computeQuote('1', ETH, USDC, 0.5);
    expect(quote?.feeAmount).toBe(String(2000 * FEE_RATE));
    expect(quote?.netOut).toBe('1994');
  });

  it('applies slippage to the minimum received', () => {
    const quote = computeQuote('1', ETH, USDC, 1);
    expect(Number(quote?.minimumReceived)).toBeCloseTo(1994 * 0.99, 6);
  });

  it('prices both legs in USD', () => {
    const quote = computeQuote('2', ETH, USDC, 0.5);
    expect(quote?.fromUsd).toBe(4000);
    expect(quote?.toUsd).toBeCloseTo(3988, 6);
  });

  it('reports price impact as the round-trip loss', () => {
    const quote = computeQuote('1', ETH, USDC, 0.5);
    expect(quote?.priceImpact).toBeCloseTo(FEE_RATE, 6);
  });

  // Returning null rather than a half-filled object means a caller cannot
  // accidentally render an incomplete quote.
  it.each([
    ['no amount', '', ETH, USDC],
    ['no source token', '1', null, USDC],
    ['no destination token', '1', ETH, null],
  ])('returns null with %s', (_label, amount, from, to) => {
    expect(computeQuote(amount, from, to, 0.5)).toBeNull();
  });

  it('survives a token whose price is zero', () => {
    expect(computeQuote('1', ETH, token('DEAD', 0), 0.5)).toBeNull();
  });

  it('stays exact for amounts a float would round', () => {
    const quote = computeQuote('0.1', token('A', 3), token('B', 1), 0);
    // 0.1 * 3 = 0.30000000000000004 in floating point.
    expect(quote?.grossOut).toBe('0.3');
  });
});

describe('percentOfBalance', () => {
  it.each([
    ['100', 25, '25'],
    ['100', 100, '100'],
    ['4.1994', 50, '2.0997'],
  ])('%s at %i%% = %s', (balance, percent, expected) => {
    expect(percentOfBalance(balance, percent)).toBe(expected);
  });

  // MAX must yield exactly the balance, or the insufficient-balance check
  // rejects the user's own "spend everything" click.
  it('returns the balance exactly at 100%', () => {
    expect(percentOfBalance('0.000012345678', 100)).toBe('0.000012345678');
  });
});
