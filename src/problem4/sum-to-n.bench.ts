import { bench, describe } from 'vitest';
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum-to-n.js';

// Empirical backing for the complexity comments in sum-to-n.ts.
// Run with `npm run bench`.
for (const n of [1_000, 100_000]) {
  describe(`n = ${n.toLocaleString()}`, () => {
    bench('sum_to_n_a — closed form, O(1)', () => void sum_to_n_a(n));
    bench('sum_to_n_b — iterative, O(n)', () => void sum_to_n_b(n));
    bench('sum_to_n_c — divide & conquer, O(n) with call overhead', () => void sum_to_n_c(n));
  });
}
