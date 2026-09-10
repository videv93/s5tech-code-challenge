# Problem 1 — Three ways to sum to n

Three unique JavaScript implementations of `sum_to_n`, in [`sum-to-n.js`](./sum-to-n.js).

## Run

```bash
npm install
npm test          # vitest run — 65 assertions
npm run test:watch
```

## The three approaches

| | Strategy | Time | Space | Notes |
|---|---|---|---|---|
| `sum_to_n_a` | Closed form (Gauss) | **O(1)** | **O(1)** | The one to ship. Constant work regardless of `n`. |
| `sum_to_n_b` | Iterative accumulation | O(n) | O(1) | The obvious loop; a scalar accumulator, no allocation. |
| `sum_to_n_c` | Build range → `reduce` | O(n) | **O(n)** | Declarative, but allocates an `n`-element array first. |

`sum_to_n_a` is the correct production choice: it is the only one whose cost does
not grow with the input. `sum_to_n_c` is included as a genuinely different
*strategy* (build-then-fold rather than fold-in-place), not as a recommendation —
at the top of the permitted input range it would try to allocate ~95M elements.

## Assumptions declared

The brief says "any integer" but only illustrates a positive case, so:

1. **Negative `n` is defined symmetrically.** `sum_to_n(-5) === -15`, i.e. the sum
   of every integer between 1 and `n` inclusive, walking in whichever direction
   `n` lies. This preserves `sum_to_n(-n) === -sum_to_n(n)` for all `n`, which the
   test suite asserts. The alternative reading — "return 0 for anything below 1" —
   silently discards information, so I chose the total function.
2. **`sum_to_n(0) === 0`** (empty range).
3. **No `BigInt`.** The brief guarantees the result stays under
   `Number.MAX_SAFE_INTEGER`, which bounds `|n|` at `94,906,265`. The test suite
   pins that exact boundary and checks the closed form is still exact there.
4. **Non-integer input is out of contract and throws `TypeError`.** Each function
   validates up front rather than failing silently — without the guard, `1.5`
   would spin `sum_to_n_b` into an infinite loop and leak `NaN` from the others.

## Testing notes

`sum-to-n.test.js` runs the same suite against all three implementations via
`describe.each`, compares each against an independent naive oracle, and sweeps
`n` from -500 to 500 asserting all three agree at every point — so a divergence
between implementations fails the build, not just a divergence from an expected
constant.
