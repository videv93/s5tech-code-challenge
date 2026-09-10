import { describe, expect, it } from 'vitest';
import { compare, divide, isPositive, isValidDecimal, multiply, normalise } from './decimal';

describe('multiply', () => {
  it.each([
    ['2', '3', '6'],
    ['1.5', '2500', '3750'],
    ['0.5', '0.5', '0.25'],
    ['0', '2500', '0'],
  ])('%s × %s = %s', (a, b, expected) => {
    expect(multiply(a, b)).toBe(expected);
  });

  // The reason this module exists instead of `parseFloat`.
  it('is exact where IEEE-754 is not', () => {
    expect(0.1 * 0.2).not.toBe(0.02);
    expect(multiply('0.1', '0.2')).toBe('0.02');
  });

  it('handles amounts beyond Number.MAX_SAFE_INTEGER', () => {
    expect(multiply('9007199254740993', '2', 0)).toBe('18014398509481986');
  });

  it('returns null rather than NaN for malformed input', () => {
    expect(multiply('abc', '2')).toBeNull();
    expect(multiply('', '2')).toBeNull();
  });
});

describe('divide', () => {
  it('divides exactly where it can', () => {
    expect(divide('10', '4')).toBe('2.5');
  });

  it('rounds half-up at the requested precision', () => {
    expect(divide('1', '3', 4)).toBe('0.3333');
    expect(divide('2', '3', 4)).toBe('0.6667');
  });

  it('refuses to divide by zero instead of returning Infinity', () => {
    expect(divide('1', '0')).toBeNull();
  });
});

describe('compare', () => {
  it.each([
    ['1', '2', -1],
    ['2', '1', 1],
    ['1.0', '1', 0],
    ['0.30000000000000004', '0.3', 1],
  ])('compare(%s, %s) = %i', (a, b, expected) => {
    expect(compare(a, b)).toBe(expected);
  });

  // The insufficient-balance check depends on this being exact: a float compare
  // would reject a user trying to spend precisely their whole balance.
  it('treats an exact balance as equal, not greater', () => {
    expect(compare('4.1994', '4.1994')).toBe(0);
  });
});

describe('validity helpers', () => {
  it.each(['1', '0.5', '.5', '0', '123.456789'])('accepts %s', (input) => {
    expect(isValidDecimal(input)).toBe(true);
  });

  it.each(['', 'abc', '1.2.3', '1e5', '-'])('rejects %s', (input) => {
    expect(isValidDecimal(input)).toBe(false);
  });

  it('distinguishes zero from positive', () => {
    expect(isPositive('0')).toBe(false);
    expect(isPositive('0.00000001')).toBe(true);
  });
});

describe('normalise', () => {
  it('strips insignificant digits without changing the value', () => {
    expect(normalise('01.500')).toBe('1.5');
    expect(normalise('0.10')).toBe('0.1');
  });
});
