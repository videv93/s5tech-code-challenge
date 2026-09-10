/**
 * Problem 4 — Three ways to sum to n (TypeScript)
 *
 * Input:  n — any integer.
 * Output: the summation to n, i.e. sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15.
 *
 * The brief's snippet is written as `func sum_to_n_a(n: number): number` — `func`
 * is Go syntax and is not valid TypeScript, so it is read here as `function`,
 * which is what the surrounding "in TypeScript" instruction asks for.
 *
 * Assumptions (declared per the brief):
 *  - The result is always < Number.MAX_SAFE_INTEGER, so `number` suffices and no
 *    BigInt is needed. That bound caps |n| at 94,906,265.
 *  - `n` may be negative. "Summation to n" is read symmetrically: the sum of every
 *    integer between 1 and n inclusive, walking in whichever direction n lies, so
 *    sum_to_n(-5) === -15 and the identity sum_to_n(-n) === -sum_to_n(n) holds.
 *  - sum_to_n(0) === 0.
 *  - TypeScript's `number` does not encode "integer", so the contract is enforced
 *    at runtime: callers on the JS side of a boundary can still pass 1.5.
 */

/** Runtime narrowing of `number` down to the integer domain the contract requires. */
function assertInteger(n: number): void {
  if (!Number.isInteger(n)) {
    throw new TypeError(`sum_to_n expects an integer, received: ${String(n)}`);
  }
}

/**
 * (a) Closed form — Gauss's pairing identity.
 *
 *   Pair the first and last term, the second and second-to-last, and so on:
 *   every pair sums to (n + 1), and there are n/2 of them ⇒ n * (n + 1) / 2.
 *
 * Time:  O(1) — three arithmetic ops, independent of n.
 * Space: O(1) — no allocation, no call stack growth.
 *
 * Efficiency: strictly the best of the three and the only one that does not
 * degrade as n grows; sum_to_n_a(94_906_265) costs exactly as much as
 * sum_to_n_a(1). The single hazard is the intermediate `magnitude *
 * (magnitude + 1)`, which is ~2× the final result and so momentarily larger
 * than MAX_SAFE_INTEGER for inputs the brief has already excluded. Within the
 * stated contract it is exact — the test suite pins the boundary value.
 *
 * This is the implementation to ship.
 */
export function sum_to_n_a(n: number): number {
  assertInteger(n);
  const sign = Math.sign(n);
  const magnitude = Math.abs(n);
  return (sign * (magnitude * (magnitude + 1))) / 2;
}

/**
 * (b) Iterative accumulation — one forward pass, constant memory.
 *
 * Time:  O(n) — exactly |n| additions.
 * Space: O(1) — a single scalar accumulator.
 *
 * Efficiency: the baseline. Predictable, branch-free in the hot loop (`step` is
 * ±1, so the same body walks up toward a positive n or down toward a negative
 * one) and allocation-free, which makes it JIT-friendly and GC-silent. It is
 * ~8 orders of magnitude slower than (a) at the top of the input range — at
 * n = 94.9M this is ~95 million additions where (a) does three — but it never
 * risks an intermediate overflow, since the running total only ever moves
 * through values bounded by the final result.
 */
export function sum_to_n_b(n: number): number {
  assertInteger(n);
  const step = Math.sign(n);
  let total = 0;
  for (let i = step; i !== n + step; i += step) {
    total += i;
  }
  return total;
}

/**
 * (c) Divide and conquer — split the range, recurse on both halves.
 *
 *   sum(lo..hi) = sum(lo..mid) + sum(mid+1..hi)
 *
 * Time:  O(n) — the recursion tree has ~2n nodes and each does O(1) work, so
 *        halving does *not* beat the loop here; there is no subproblem reuse to
 *        exploit. By the Master theorem T(n) = 2T(n/2) + O(1) ⇒ Θ(n).
 * Space: O(log n) — the call stack is only as deep as the number of halvings,
 *        ~27 frames at the top of the permitted input range.
 *
 * Efficiency: the slowest of the three by a constant factor — every element
 * costs a function call rather than an addition. It earns its place as the
 * recursive strategy that is actually *safe*: naive linear recursion
 * (`sum(n) = n + sum(n-1)`) is also O(n) time but O(n) stack, and blows
 * `RangeError: Maximum call stack size exceeded` somewhere around n ≈ 10⁴ —
 * far below the range this function must accept. Halving the range trades that
 * cliff for logarithmic depth, so it is correct across the whole contract.
 * Included to show the shape; (a) remains the right answer.
 */
export function sum_to_n_c(n: number): number {
  assertInteger(n);
  if (n === 0) return 0;
  const sign = Math.sign(n);
  return sign * sumRange(1, Math.abs(n));
}

/** Inclusive sum of the ascending range [lo, hi]; assumes lo <= hi. */
function sumRange(lo: number, hi: number): number {
  if (lo === hi) return lo;
  const mid = Math.floor((lo + hi) / 2);
  return sumRange(lo, mid) + sumRange(mid + 1, hi);
}
