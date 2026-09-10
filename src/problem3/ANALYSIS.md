# Problem 3 — Messy React: issues found

24 findings against the original block ([`src/messy.original.tsx`](./src/messy.original.tsx)),
grouped by severity. Each is numbered; the same `[n]` markers appear as comments
in the refactored source so a reviewer can jump between the two.

Headline: **the component as written renders nothing but a crash, and if you fix
the crash it renders the wrong wallets with blank amounts.** The performance
problems are real but secondary — three of these are outright correctness bugs
that a single render would expose.

---

## A. Correctness — this code cannot work as written

### [6] `lhsPriority` is not defined — `ReferenceError` on first render 🔴
```ts
const balancePriority = getPriority(balance.blockchain);
if (lhsPriority > -99) {          // ← never declared
```
The filter computes `balancePriority` and then tests a completely different,
undeclared identifier. `lhsPriority` looks like a copy-paste escapee from the
comparator below it. In a module (strict mode) this throws
`ReferenceError: lhsPriority is not defined` the first time the callback runs,
so the component never mounts. TypeScript would have caught this at compile time
had the file been typechecked — which is a finding in itself.

**Fix:** use the value that was just computed.

### [7] The filter predicate is inverted — it hides every funded wallet 🔴
```ts
if (balance.amount <= 0) { return true; }
```
This *keeps* balances that are empty or negative and *discards* every balance
with funds in it. For a wallet page that is the exact opposite of the intent: the
user sees a list of their zero balances and none of their assets. Combined with
[6] it is invisible — the crash masks the logic error.

**Fix:** `balance.amount > 0`.

### [10] `formattedBalances` is computed and then thrown away 🔴
```ts
const formattedBalances = sortedBalances.map(...)   // never read again
const rows = sortedBalances.map((balance: FormattedWalletBalance) => ...)
```
`rows` maps over `sortedBalances`, not `formattedBalances`. Those objects have no
`formatted` property, so **every row receives `formattedAmount={undefined}`** and
renders a blank amount column. The intermediate array is pure garbage — allocated,
populated, collected, never read.

**Fix:** derive the rows from the formatted list (or fold formatting into one pass).

### [11] An unsound type annotation is what hides [10]
```ts
sortedBalances.map((balance: FormattedWalletBalance, index: number) => ...)
```
`sortedBalances` is `WalletBalance[]`. Annotating the callback parameter as
`FormattedWalletBalance` doesn't convert anything — it asserts a lie to the
compiler, which then cheerfully allows `balance.formatted`. This is the actual
root cause of [10]: the type system knew, and the annotation silenced it.
Bivariant callback-parameter checking means TS accepts this without even a
`// @ts-expect-error`.

**Fix:** never annotate a callback parameter more specifically than its source
array. Let inference do it; make `FormattedWalletBalance extends WalletBalance`
so the two shapes cannot drift.

### [8] The sort comparator has no `return 0` path 🔴
```ts
}).sort((lhs, rhs) => {
  if (leftPriority > rightPriority) return -1;
  else if (rightPriority > leftPriority) return 1;
  // falls through → returns undefined
});
```
Equal priorities — `Zilliqa` and `Neo` are both `20` — fall off the end and return
`undefined`. `Array.prototype.sort` requires a number; a non-number is outside the
contract, and the spec's stability guarantee only holds for a conforming
comparator. The result is ordering that can vary between engines and between
input permutations. Under `strict` TS also flags the implicit `undefined` return.

**Fix:** `rhs.priority - lhs.priority || <deterministic tiebreak>`.

### [2] `WalletBalance` has no `blockchain` field
The interface declares only `currency` and `amount`, yet `balance.blockchain` is
read in both the filter and the comparator. This is a compile error under any
honest configuration; it only survives because `getPriority(blockchain: any)`
absorbs it.

### [14] A missing price renders `NaN`
```ts
const usdValue = prices[balance.currency] * balance.amount;
```
`prices` is an index signature, so a token with no feed yields `undefined`, and
`undefined * amount` is `NaN` — which React renders as the literal string "NaN"
in the user's fiat column. (The sibling Problem 2 brief explicitly warns "not
every token has a price", so this is a live case, not a hypothetical.)

**Fix:** model the absence — `usdValue: number | null` — and render a placeholder.

### [15] `toFixed()` with no argument silently truncates balances
`amount.toFixed()` defaults to **zero** decimal places, so `12.3456` displays as
`12`. On a page whose entire job is to report how much money someone has, that is
a data-integrity bug, not a rounding preference.

**Fix:** an explicit precision via `Intl.NumberFormat`, which also gets grouping
separators and locale handling right.

### [16] `children` is destructured and then discarded
`const { children, ...rest } = props;` pulls `children` out so it is *not* in
`rest`, and the JSX never renders it. Any caller nesting content inside
`<WalletPage>` gets silent data loss — the worst failure mode, since nothing
errors.

### [17] `classes` is never defined
`className={classes.row}` references an identifier with no declaration or import.

### [18] Seven identifiers are used without imports
`BoxProps`, `WalletRow`, `useWalletBalances`, `usePrices`, `classes`, `useMemo`
and `React` all appear undeclared. Whatever else is true, this file does not
compile.

---

## B. Computational inefficiency

### [9] The `useMemo` dependency array defeats the memo 🟠
```ts
}, [balances, prices]);
```
The memoised computation **never reads `prices`** — it only filters and sorts by
blockchain. But `prices` is the fastest-changing value on the page (a live price
feed, ticking every few seconds), and every tick invalidates the memo and re-runs
the entire filter + sort. The `useMemo` is therefore not just useless, it is
actively misleading: it looks like the expensive work is cached when it is
running continuously.

This is the single most valuable fix. **Ordering cannot change when a price
changes**, so the sort should depend on `balances` alone; formatting depends on
`prices` and is O(n) with no comparisons.

### [13] `formattedBalances` and `rows` are outside `useMemo` entirely 🟠
Both are recomputed on *every* render — including renders caused by an unrelated
parent state change. `rows` allocates a fresh array of fresh React elements each
time, so even a `memo`-wrapped `WalletRow` re-renders: new element objects mean
new props identity. Memoising the sort while leaving the element construction
unmemoised caches the cheap half and repeats the expensive half.

### [21] `getPriority` is called ~2·n·log n times instead of n
The comparator recomputes both operands' priorities on **every comparison**. For
200 balances that is roughly 3,000 lookups where 200 would do. The fix is the
classic decorate–sort–undecorate: compute each priority once, sort on the
decorated tuples, discard the decoration.

### [5] `getPriority` is a linear `switch` where a lookup would do
Six sequential string comparisons per call, and the chain→priority mapping is
scattered across control flow instead of being data. A `Record` lookup is O(1),
and — more importantly — makes the priority table something you can export,
test, and iterate.

### [4] `getPriority` is redefined on every render
It closes over nothing and is a pure function of its argument, so re-creating the
closure each render is wasted allocation. It belongs at module scope. (Had it
been passed to a memoised child, the unstable identity would also have broken
that child's memo.)

### [22] Three passes where two suffice
`filter` → `sort` → `map` (formatting) → `map` (rows) walks the list four times
and allocates four arrays. Two of those passes exist only because of the dead
`formattedBalances`. Worth collapsing — but note this is the *least* important
item in this section: at realistic wallet sizes (tens of tokens) the constant
factor is irrelevant next to [9], which re-runs the whole pipeline on a timer.

---

## C. React anti-patterns

### [12] `key={index}` on a list that re-sorts 🟠
The canonical React anti-pattern, and this is the case where it actually bites:
the list is **sorted**, so an item's index is not stable across renders. When
prices shift and the list reorders, React reconciles row 0 to row 0 even though a
different token now occupies that slot — so component state, focus, uncontrolled
input values and CSS transitions all follow the *position* rather than the asset.
It also defeats the diffing it was meant to help: a single insertion at the top
invalidates every subsequent row.

**Fix:** a key derived from identity. Note `currency` alone is **not** sufficient —
the same symbol exists on multiple chains (USDC on Ethereum and on Arbitrum) — so
the key must be `blockchain:currency`.

### [3] `blockchain: any` erases the whole type system
`any` here is what allows [2] (the missing field) to compile, and it means a typo
like `'Etherium'` silently returns `-99` and hides the balance. The set of chains
is closed and known — a union type turns those into compile errors.

### [1] `interface Props extends BoxProps {}`
An empty extension of a single interface adds nothing; `@typescript-eslint/no-empty-object-type`
flags it. `type Props = BoxProps` states the same intent without pretending to
extend.

### [19] `React.FC<Props>` *and* `(props: Props)`
Redundant — the annotation is applied twice. `React.FC` also historically implied
an unwanted `children` prop and is no longer the idiomatic default; a plain
function declaration with typed props is clearer and gets a real function name in
React DevTools and stack traces.

### [20] No deterministic tiebreak
With `Zilliqa` and `Neo` sharing priority `20`, their relative order is whatever
the input order happens to be. Even with a conforming comparator ([8]) this makes
the rendered order depend on backend response ordering, which produces spurious
DOM churn when the API returns the same data in a different sequence.

### [23] `.sort()` on an array that came from a hook
`sort` mutates in place. Here it happens to be safe — `filter` already produced a
fresh array — but it is one refactor away from disaster: delete or reorder the
`filter` and the code starts mutating the cached array inside `useWalletBalances`,
corrupting state for every other consumer with no error. Typing the hook's return
as `readonly WalletBalance[]` makes that a compile error rather than a landmine.

### [24] No loading or error state
`useWalletBalances()` and `usePrices()` are network-backed but the component
treats both as if they resolve synchronously and never fail. Out of scope for a
refactor of the given block — flagged as the first thing to add next.

---

## Summary of impact

| Priority | Findings | Effect |
|---|---|---|
| 🔴 Blocks all rendering | [6] | `ReferenceError` on mount |
| 🔴 Wrong data shown | [7], [10], [14], [15] | Empty wallets listed, amounts blank, `NaN` fiat, balances truncated to integers |
| 🟠 Performance | [9], [13], [21] | Full re-filter/re-sort + full element rebuild on every price tick |
| 🟠 Subtle UI corruption | [12] | Row state follows position, not asset, across re-sorts |
| 🟡 Type safety | [2], [3], [11] | The annotations are what *hid* [10] and [2] from the compiler |
| 🟡 Hygiene | [1], [4], [5], [16]–[20], [22]–[24] | Dead code, wasted allocation, missing imports, dropped children |

The through-line: **every runtime bug here was reachable by the type checker and
suppressed by a hand-written annotation.** `blockchain: any` hid the missing
field; `(balance: FormattedWalletBalance)` hid the wrong source array. Turning
those two `any`/assertion escapes into honest types is what makes the class of
bug in section A impossible rather than merely fixed.
