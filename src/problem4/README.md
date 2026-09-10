# Problem 4 — Three ways to sum to n (TypeScript)

Three unique implementations in [`sum-to-n.ts`](./sum-to-n.ts), each annotated
with its complexity in-source as the brief asks.

## Run

```bash
npm install
npm test         # vitest run — 58 assertions
npm run typecheck # tsc --noEmit, strict + noUncheckedIndexedAccess
npm run bench     # vitest bench — empirical backing for the claims below
```

## Complexity & efficiency

| | Strategy | Time | Space | Verdict |
|---|---|---|---|---|
| `sum_to_n_a` | Closed form (Gauss pairing) | **O(1)** | **O(1)** | **Ship this.** Cost independent of `n`. |
| `sum_to_n_b` | Iterative accumulation | O(n) | O(1) | Baseline. Allocation-free, JIT-friendly. |
| `sum_to_n_c` | Divide & conquer recursion | O(n) | O(log n) | Slowest, but the *safe* recursive shape. |

**`sum_to_n_a`** pairs the first and last terms: every pair sums to `n + 1` and
there are `n/2` of them, giving `n * (n + 1) / 2` in three arithmetic operations.
The one hazard is the intermediate `n * (n + 1)`, ~2× the final result — but the
brief bounds the result below `MAX_SAFE_INTEGER`, capping `|n|` at `94,906,265`,
comfortably inside range. The suite pins that exact boundary.

**`sum_to_n_b`** does `|n|` additions against a scalar accumulator. `step` is ±1
so one branch-free loop body serves both directions. It never risks an
intermediate overflow — the running total only passes through values bounded by
the final answer.

**`sum_to_n_c`** splits `sum(lo..hi)` into two halves. Note that halving does
**not** beat the loop: `T(n) = 2T(n/2) + O(1) ⇒ Θ(n)` by the Master theorem,
because there is no subproblem reuse to exploit. Its point is the *space* column.
The naive recursion `sum(n) = n + sum(n - 1)` is also O(n) time but O(n) stack
and throws `RangeError: Maximum call stack size exceeded` around n ≈ 10⁴ — far
inside the range this function must accept. Halving trades that cliff for ~27
stack frames at worst. The suite asserts it survives `n = 100_000`.

### Measured (`npm run bench`, Node 26, Apple silicon)

| n | `sum_to_n_a` | `sum_to_n_b` | `sum_to_n_c` |
|---|---|---|---|
| 1,000 | 31.9M ops/s | 1.70M ops/s | 123K ops/s |
| 100,000 | 34.0M ops/s | 4,638 ops/s | 1,081 ops/s |

The table is the analysis made visible: growing `n` by 100× leaves (a) flat
(within noise) while (b) and (c) each fall ~366× and ~114×, and (c) trails (b) by
a constant ~4× — one function call per element instead of one addition.

## Assumptions declared

1. **`func` → `function`.** The brief's snippet uses Go's `func` keyword, which is
   not valid TypeScript. Read as `function`, per the "in TypeScript" instruction.
2. **Negative `n` is defined symmetrically:** `sum_to_n(-5) === -15`, preserving
   `sum_to_n(-n) === -sum_to_n(n)`. Asserted in the suite.
3. **`sum_to_n(0) === 0`** (empty range).
4. **No `BigInt`** — the stated bound makes `number` sufficient.
5. **Integer-ness is enforced at runtime.** TypeScript's `number` cannot express
   "integer", and these functions sit at a boundary JS callers can cross, so each
   validates and throws `TypeError`. Without it, `1.5` spins `sum_to_n_b` forever
   and recurses `sum_to_n_c` past its base case.

## Testing notes

`describe.each` runs one shared suite against all three implementations, each
checked against an independent naive oracle. A dense sweep from -500 to 500
asserts all three agree at every point, so a divergence *between* implementations
fails the build. The complexity claims are tested rather than merely asserted in
prose: a `Proxy` counts that the closed form reads `n` exactly once, and
`sum_to_n_c` is exercised at a depth that would break linear recursion.
