# Problem 3 — Messy React

## Deliverables

1. **[`ANALYSIS.md`](./ANALYSIS.md)** — the main deliverable. 24 findings, grouped
   by severity, each explaining the mechanism and the fix.
2. **[`src/`](./src)** — the refactored component. Every fix carries an inline
   `[n]` comment matching the finding number in the analysis.
3. **[`src/messy.original.tsx`](./src/messy.original.tsx)** — the block as given,
   kept verbatim for diffing (excluded from the build; it does not compile).

## Run

```bash
npm install
npm test        # vitest run — 29 tests
npm run typecheck
```

## Headline

The component as written **crashes on mount** (`lhsPriority` is undeclared), and
with that fixed it renders **the wrong wallets with blank amount columns** (an
inverted filter predicate, plus a formatted array that is computed and then never
used). The performance problems are real, but they are second in line behind
three outright correctness bugs.

The most valuable *performance* fix is one line: the `useMemo` that filters and
sorts lists `prices` in its dependency array but never reads `prices`. Since
prices tick continuously and a price change cannot reorder the list, that memo
was re-running the entire pipeline on a timer while looking like it was caching.

## Refactor at a glance

| File | Role |
|---|---|
| `types.ts` | `Blockchain` union derived from the priority table; `blockchain` added to `WalletBalance`; `FormattedWalletBalance extends WalletBalance` so the shapes cannot drift. |
| `priority.ts` | `getPriority` hoisted to module scope, `switch` → O(1) `Record` lookup. |
| `selectors.ts` | Pure, unit-testable filter/sort/format. Decorate–sort–undecorate; deterministic tiebreak; identity-based row keys. |
| `format.ts` | `Intl.NumberFormat` with explicit precision, replacing `toFixed()`. |
| `WalletRow.tsx` | `memo`'d presentational row — which is what makes the parent's memoisation actually pay off. |
| `WalletPage.tsx` | Two memos on their *real* dependencies; children rendered; imports declared. |

## The findings are tested, not just asserted

The suite is written so each fix has a test that fails against the original
behaviour — including the performance claim, which is usually left as prose:

```ts
it('does not re-sort when only prices change', () => {
  const { rerender } = render(<WalletPage />);
  expect(sortSpy).toHaveBeenCalledTimes(1);
  // three price ticks…
  expect(sortSpy).toHaveBeenCalledTimes(1);   // was 4 with the original deps array
});
```

Other pinned behaviours: rows survive a re-sort as the *same DOM nodes* (finding
[12], row keys), a token with no price renders `—` and never `NaN` ([14]), a
fractional balance renders `1.2346` not `1` ([15]), and the input array is never
mutated ([23]).

## Assumptions declared

- `WalletRow`, `BoxProps`, `useWalletBalances` and `usePrices` were referenced but
  never provided. Minimal stand-ins are included so the refactor compiles and can
  be rendered; the *shapes* are the part that matters.
- The filter predicate was `amount <= 0`. I read this as a typo for `> 0` — a
  wallet page listing only the user's empty balances makes no sense. If the
  intent really was "flag dust balances", the fix is the same one-line change in
  the other direction, and the assumption is isolated to `selectVisibleBalances`.
- Row keys use `blockchain:currency` rather than `currency` alone, since the same
  symbol legitimately exists on multiple chains (USDC on Ethereum and Arbitrum).
- Loading and error states for the two data hooks are out of scope for a refactor
  of the given block, but flagged as finding [24] — the first thing to add next.
