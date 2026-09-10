import { useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { usePrices, useWalletBalances } from './hooks';
import { balanceKey, selectVisibleBalances, withPresentation } from './selectors';
import { WalletRow } from './WalletRow';

/**
 * [18] The original referenced `BoxProps`, `WalletRow`, `useWalletBalances`,
 * `usePrices`, `classes`, `React` and `useMemo` without importing any of them.
 * Declared/imported here so the module actually compiles.
 */
type BoxProps = ComponentPropsWithoutRef<'div'>;

/**
 * [17] `classes` was used but never defined. In a real codebase this is a CSS
 * module import; a literal keeps this sample self-contained.
 */
const classes = { row: 'wallet-row' } as const;

/**
 * [1] `interface Props extends BoxProps {}` — an empty interface extension adds
 * nothing, and `@typescript-eslint/no-empty-object-type` flags it. A type alias
 * says the same thing honestly.
 * [16] `children` is now declared and actually rendered. The original
 * destructured it out of props and then dropped it on the floor, silently
 * discarding anything a caller nested inside <WalletPage>.
 */
type Props = BoxProps & { children?: ReactNode };

/**
 * [19] Plain function component rather than `React.FC`. `React.FC` adds nothing
 * once props are annotated, and the redundant `(props: Props)` annotation on an
 * already-typed `React.FC<Props>` was pure noise.
 */
export function WalletPage({ children, ...rest }: Props) {
  const balances = useWalletBalances();
  const prices = usePrices();

  /**
   * [9] Split into two memos on their real dependencies. The original listed
   * `prices` in the dependency array of a computation that never read `prices`,
   * so every price tick — which for a wallet is roughly continuous — threw away
   * the memo and re-ran the whole filter and sort. Ordering depends only on
   * `balances`, so it survives price updates now.
   */
  const visibleBalances = useMemo(() => selectVisibleBalances(balances), [balances]);

  /**
   * [13] The original left `formattedBalances` and `rows` outside `useMemo`
   * entirely, so both arrays — and every element in them — were rebuilt on every
   * single render, defeating any memoisation downstream.
   */
  const rows = useMemo(
    () =>
      withPresentation(visibleBalances, prices).map((balance) => (
        <WalletRow
          className={classes.row}
          key={balanceKey(balance)}
          currency={balance.currency}
          amount={balance.amount}
          usdValue={balance.usdValue}
          formattedAmount={balance.formatted}
        />
      )),
    [visibleBalances, prices],
  );

  return (
    <div {...rest}>
      {rows}
      {children}
    </div>
  );
}
