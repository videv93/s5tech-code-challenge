import { describe, expect, it } from 'vitest';
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum-to-n.js';

const implementations = [
  ['sum_to_n_a (closed form)', sum_to_n_a],
  ['sum_to_n_b (iterative)', sum_to_n_b],
  ['sum_to_n_c (functional)', sum_to_n_c],
];

/** Independent oracle: deliberately naive, so it shares no logic with the units under test. */
const oracle = (n) => {
  let total = 0;
  for (let i = 1; i <= Math.abs(n); i += 1) total += i;
  return Math.sign(n) * total;
};

describe.each(implementations)('%s', (_name, sum_to_n) => {
  it('matches the worked example from the brief', () => {
    expect(sum_to_n(5)).toBe(15);
  });

  it('returns 0 for the empty range', () => {
    expect(sum_to_n(0)).toBe(0);
  });

  it('handles the single-element range', () => {
    expect(sum_to_n(1)).toBe(1);
  });

  it.each([1, 2, 3, 10, 99, 100, 1000, 4999])('agrees with the oracle for n = %i', (n) => {
    expect(sum_to_n(n)).toBe(oracle(n));
  });

  it.each([-1, -5, -100, -1000])('is antisymmetric for n = %i', (n) => {
    expect(sum_to_n(n)).toBe(-sum_to_n(-n));
  });

  it.each([1.5, NaN, Infinity, '5', null, undefined])('rejects non-integer input %s', (bad) => {
    expect(() => sum_to_n(bad)).toThrow(TypeError);
  });
});

describe('agreement across implementations', () => {
  it('produces identical results for every n in a dense sweep', () => {
    for (let n = -500; n <= 500; n += 1) {
      const [a, b, c] = [sum_to_n_a(n), sum_to_n_b(n), sum_to_n_c(n)];
      expect(b).toBe(a);
      expect(c).toBe(a);
    }
  });
});

describe('sum_to_n_a (closed form) at the documented limit', () => {
  it('stays exact at the largest n whose result is a safe integer', () => {
    const n = 94_906_265; // largest n with n*(n+1)/2 < Number.MAX_SAFE_INTEGER
    expect(Number.isSafeInteger(sum_to_n_a(n))).toBe(true);
    expect(sum_to_n_a(n)).toBe(oracle(n));
  });
});
