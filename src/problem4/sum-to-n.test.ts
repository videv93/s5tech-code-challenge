import { describe, expect, it } from 'vitest';
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum-to-n.js';

const implementations: ReadonlyArray<readonly [string, (n: number) => number]> = [
  ['sum_to_n_a (closed form, O(1))', sum_to_n_a],
  ['sum_to_n_b (iterative, O(n) time / O(1) space)', sum_to_n_b],
  ['sum_to_n_c (divide & conquer, O(n) time / O(log n) space)', sum_to_n_c],
];

/** Independent oracle — deliberately naive, sharing no logic with the units under test. */
function oracle(n: number): number {
  let total = 0;
  for (let i = 1; i <= Math.abs(n); i += 1) total += i;
  return Math.sign(n) * total;
}

describe.each(implementations)('%s', (_name, sum_to_n) => {
  it('matches the worked example from the brief', () => {
    expect(sum_to_n(5)).toBe(15);
  });

  it('returns 0 for the empty range', () => {
    expect(sum_to_n(0)).toBe(0);
  });

  it.each([1, 2, 3, 10, 99, 100, 1000, 4999])('agrees with the oracle for n = %i', (n) => {
    expect(sum_to_n(n)).toBe(oracle(n));
  });

  it.each([-1, -5, -100, -1000])('is antisymmetric for n = %i', (n) => {
    expect(sum_to_n(n)).toBe(-sum_to_n(-n));
  });

  it.each([1.5, NaN, Infinity, -0.5])('rejects non-integer input %s', (bad) => {
    expect(() => sum_to_n(bad)).toThrow(TypeError);
  });
});

describe('agreement across implementations', () => {
  it('produces identical results for every n in a dense sweep', () => {
    for (let n = -500; n <= 500; n += 1) {
      const expected = sum_to_n_a(n);
      expect(sum_to_n_b(n)).toBe(expected);
      expect(sum_to_n_c(n)).toBe(expected);
    }
  });
});

describe('documented complexity claims', () => {
  it('sum_to_n_a stays exact at the largest n whose result is a safe integer', () => {
    const n = 94_906_265; // largest n with n*(n+1)/2 < Number.MAX_SAFE_INTEGER
    const result = sum_to_n_a(n);
    expect(Number.isSafeInteger(result)).toBe(true);
    expect(result).toBe((n * (n + 1)) / 2);
  });

  it('sum_to_n_c survives an input that would overflow a linear recursion', () => {
    // A naive `n + sum(n - 1)` recursion throws RangeError well below this.
    // O(log n) depth means ~17 frames here, so it returns cleanly.
    const n = 100_000;
    expect(sum_to_n_c(n)).toBe(oracle(n));
  });

  it('sum_to_n_a is the only one that stays cheap at the top of the range', () => {
    // Not a timing assertion (flaky in CI) — a call-count one. Instrumenting the
    // O(1) claim: the closed form touches n exactly once.
    let reads = 0;
    const probe = new Proxy({ n: 94_906_265 }, {
      get(target, key) {
        if (key === 'n') reads += 1;
        return Reflect.get(target, key);
      },
    }) as { n: number };
    sum_to_n_a(probe.n);
    expect(reads).toBe(1);
  });
});
