/**
 * Problem 1 — Three ways to sum to n (JavaScript)
 *
 * Input:  n — any integer.
 * Output: the summation to n, i.e. sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15.
 *
 * Assumptions (declared per the brief):
 *  - The result is always < Number.MAX_SAFE_INTEGER, so no BigInt is needed.
 *  - `n` may be negative. "Summation to n" is read symmetrically: the sum of
 *    every integer between 1 and n inclusive, walking in whichever direction n
 *    lies. So sum_to_n(-5) === -1 + -2 + -3 + -4 + -5 === -15.
 *    This keeps the identity sum_to_n(-n) === -sum_to_n(n) true for all n.
 *  - sum_to_n(0) === 0.
 *  - Non-integer / non-finite input is out of contract; each implementation
 *    guards with a shared validator so the failure is loud rather than silent
 *    (an infinite loop or NaN leaking into a caller's arithmetic).
 */

/** @param {number} n */
function assertInteger(n) {
  if (!Number.isInteger(n)) {
    throw new TypeError(`sum_to_n expects an integer, received: ${String(n)}`);
  }
}

/**
 * (a) Closed form — Gauss's pairing formula.
 *
 * For positive n the sum 1..n is n * (n + 1) / 2. For negative n the magnitude
 * is the same series over |n|, negated, which `sign` restores.
 *
 * Time:  O(1)
 * Space: O(1)
 *
 * This is the implementation to ship. `n * (n + 1)` is the only risk: it can
 * exceed MAX_SAFE_INTEGER one step before the halving brings it back in range,
 * but the brief guarantees results stay inside the safe range, which bounds
 * |n| at ~94,906,265 — well clear of that.
 */
var sum_to_n_a = function (n) {
  assertInteger(n);
  const sign = Math.sign(n);
  const magnitude = Math.abs(n);
  return (sign * (magnitude * (magnitude + 1))) / 2;
};

/**
 * (b) Iterative accumulation — a single forward pass.
 *
 * Time:  O(n)
 * Space: O(1)
 *
 * The obvious loop. `step` is ±1 so the same body walks up towards a positive n
 * or down towards a negative one, and the `i !== n + step` bound covers both
 * directions without branching inside the loop.
 */
var sum_to_n_b = function (n) {
  assertInteger(n);
  const step = Math.sign(n);
  let total = 0;
  for (let i = step; i !== n + step; i += step) {
    total += i;
  }
  return total;
};

/**
 * (c) Functional — materialise the range, then reduce it.
 *
 * Time:  O(n)
 * Space: O(n)  ← the array is fully allocated before reduction
 *
 * The most declarative of the three and the most expensive: it trades a scalar
 * accumulator for an n-element array. Included as a genuinely distinct strategy
 * (build-then-fold rather than fold-in-place), not as a recommendation — at the
 * upper end of the allowed range this would try to allocate ~95M elements.
 */
var sum_to_n_c = function (n) {
  assertInteger(n);
  const sign = Math.sign(n);
  return Array.from({ length: Math.abs(n) }, (_, index) => sign * (index + 1)).reduce(
    (total, value) => total + value,
    0,
  );
};

export { sum_to_n_a, sum_to_n_b, sum_to_n_c };
