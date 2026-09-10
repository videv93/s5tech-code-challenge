import { describe, expect, it } from 'vitest';
import { multiplyDecimals } from './decimal.js';

describe('multiplyDecimals', () => {
  it.each([
    ['1.5', '2500', '3750'],
    ['2', '3', '6'],
    ['0.5', '0.5', '0.25'],
    ['100', '0.0041', '0.41'],
    ['0', '2500', '0'],
    ['1', '1', '1'],
  ])('%s × %s = %s', (a, b, expected) => {
    expect(multiplyDecimals(a, b)).toBe(expected);
  });

  // The whole reason this function exists rather than `Number(a) * Number(b)`.
  it('is exact where IEEE-754 is not', () => {
    expect(0.1 * 0.2).not.toBe(0.02); // the float result is 0.020000000000000004
    expect(multiplyDecimals('0.1', '0.2')).toBe('0.02');
  });

  it('keeps every digit of an 18-decimal token amount', () => {
    // A double holds ~15-17 significant digits; this has 19.
    expect(multiplyDecimals('1.234567890123456789', '1')).toBe('1.234567890123456789');
  });

  it('survives amounts larger than Number.MAX_SAFE_INTEGER', () => {
    expect(multiplyDecimals('9007199254740993', '2')).toBe('18014398509481986');
  });

  it('normalises trailing zeros so equal values compare equal as strings', () => {
    expect(multiplyDecimals('1.50', '2')).toBe('3');
  });
});
